// AI QUOTATION ASSISTANT — Edge Function
// Modes: ocr_requirements | price_match | discount_suggestion | competitor_intel | tat_check

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const sb = createClient(SB_URL, SB_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
}

async function claude(messages: any[], system: string, maxTokens = 1500) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": AI_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function imgBase64(url: string) {
  try {
    const r = await fetch(url, { headers: { "Authorization": `Bearer ${SB_KEY}`, "apikey": SB_KEY } });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let b = ""; const c = 8192;
    for (let i = 0; i < bytes.length; i += c) b += String.fromCharCode(...bytes.subarray(i, i + c));
    return btoa(b);
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const { mode, request_id } = body;

    // 1. OCR — extract items from requirement photos
    if (mode === "ocr_requirements") {
      const { photo_urls } = body;
      if (!photo_urls?.length) return json({ error: "No photos" }, 400);
      const imgs = (await Promise.all(photo_urls.map(imgBase64))).filter(Boolean);
      if (!imgs.length) return json({ error: "Could not load photos" }, 400);
      const content: any[] = [
        ...imgs.map(b64 => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } })),
        { type: "text", text: `Extract all building material items from these photos (may be handwritten in Telugu/Hindi/English).
Return ONLY JSON: {"items":[{"product":"name","category":"Tiles|Sanitaryware|CP Fittings|Pipes|Electrical|Paints|Plywood|Granite|Marble|Waterproofing|Hardware|Other","quantity":"number or null","unit":"sqft/nos/rft/box or null","brand_requested":"brand or null","notes":"any special notes"}],"reading_confidence":"high|medium|low","unreadable_parts":"describe or null"}` }
      ];
      const raw = await claude([{ role: "user", content }], "Expert at reading building material lists in Telugu, Hindi, English.", 2000);
      let parsed: any;
      try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { parsed = { items: [], reading_confidence: "low" }; }
      if (request_id) {
        await sb.from("quotation_requests").update({ ocr_items: parsed.items, ocr_confidence: parsed.reading_confidence }).eq("id", request_id);
        await sb.from("quotation_timeline").insert({ request_id, action: "ai_ocr_complete", actor_name: "AI", actor_role: "System", note: `Extracted ${parsed.items?.length || 0} items. Confidence: ${parsed.reading_confidence}` });
      }
      return json({ success: true, ...parsed });
    }

    // 2. Price match — pull prices from catalog context
    if (mode === "price_match") {
      const { items, construction_stage, estimated_sqft } = body;
      if (!items?.length) return json({ error: "No items" }, 400);
      const { data: catalogs } = await sb.from("catalogs").select("name,brand,category").eq("is_team_visible", true);
      const catalogCtx = (catalogs||[]).map(c => `${c.brand} (${c.category})`).join(", ");
      const itemsList = items.map((it: any, i: number) => `${i+1}. ${it.product} | Cat: ${it.category} | Qty: ${it.quantity||"?"} ${it.unit||""} | Brand: ${it.brand_requested||"any"}`).join("\n");
      const prompt = `V Wholesale, Vijayawada AP. Available brands: ${catalogCtx}.
Site: ${construction_stage||"plastering"} stage, ${estimated_sqft||"unknown"} sqft.

Items to price:
${itemsList}

Return ONLY JSON:
{"priced_items":[{"item_index":1,"product":"name","category":"cat","quantity_unit":"qty unit","brand_suggested":"brand","unit_price_min":100,"unit_price_max":150,"total_min":1000,"total_max":1500,"margin_pct":18,"notes":"rationale"}],"grand_total_min":50000,"grand_total_max":80000,"discount_room_pct":8,"pricing_confidence":"high|medium|low"}`;
      const raw = await claude([{ role: "user", content: prompt }], "V Wholesale pricing assistant for Vijayawada building materials.", 2500);
      let priced: any;
      try { priced = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { priced = { priced_items: [], error: "Parse failed", raw }; }
      if (request_id) {
        await sb.from("quotation_requests").update({ ai_price_suggestion: priced }).eq("id", request_id);
        await sb.from("quotation_timeline").insert({ request_id, action: "ai_price_match_complete", actor_name: "AI", actor_role: "System", note: `AI priced ${priced.priced_items?.length||0} items. Total: ₹${((priced.grand_total_min||0)/100000).toFixed(1)}L–₹${((priced.grand_total_max||0)/100000).toFixed(1)}L` });
      }
      return json({ success: true, ...priced });
    }

    // 3. Discount suggestion
    if (mode === "discount_suggestion") {
      const { pipeline_value, construction_stage, competitor_products, total_amount } = body;
      const prompt = `V Wholesale sales strategist. 
Pipeline value: ₹${((pipeline_value||0)/100000).toFixed(1)}L | Stage: ${construction_stage} | Quotation: ₹${((total_amount||0)/100000).toFixed(1)}L | Competitors: ${competitor_products?.join(", ")||"none"}
Return ONLY JSON: {"recommended_discount_pct":5,"discount_range":"3-8","max_discount_pct":10,"strategy":"aggressive|competitive|standard|premium","rationale":"2 sentences","talking_points":["point1","point2","point3"],"urgency_message":"closing line"}`;
      const raw = await claude([{ role: "user", content: prompt }], "B2B sales strategist for building materials wholesale in Vijayawada.", 600);
      let s: any;
      try { s = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { s = { recommended_discount_pct: 5, rationale: raw }; }
      return json({ success: true, ...s });
    }

    // 4. Competitor intelligence
    if (mode === "competitor_intel") {
      const { competitor_products, requirements, construction_stage } = body;
      if (!competitor_products?.length) return json({ success: true, threat_level: "low", strategy: "standard" });
      const prompt = `V Wholesale vs competitors at a site in Vijayawada.
Competitors spotted: ${competitor_products.join(", ")} | Needs: ${requirements?.join(", ")||"general"} | Stage: ${construction_stage}
Return ONLY JSON: {"threat_level":"low|medium|high","our_advantage":["a1","a2","a3"],"pricing_strategy":"undercut|match|premium","pricing_adjustment_pct":-5,"key_pitch":"what to say","products_to_highlight":["our product1","product2"]}`;
      const raw = await claude([{ role: "user", content: prompt }], "Competitive intelligence analyst for V Wholesale building materials.", 600);
      let intel: any;
      try { intel = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { intel = { threat_level: "medium", key_pitch: raw }; }
      return json({ success: true, ...intel });
    }

    // 5. TAT check
    if (mode === "tat_check") {
      const { data: active } = await sb.from("quotation_requests")
        .select("id,request_no,status,urgency,tl_deadline,cat_mgr_deadline,mgmt_deadline,requested_at")
        .in("status", ["requested","in_preparation","with_tl","with_cat_mgr","with_management"]);
      const now = new Date();
      const overdue: any[] = [], warnings: any[] = [];
      for (const q of (active||[])) {
        const deadline = q.status === "with_tl" ? q.tl_deadline : q.status === "with_cat_mgr" ? q.cat_mgr_deadline : q.status === "with_management" ? q.mgmt_deadline : null;
        const stageName = q.status === "with_tl" ? "Quotation TL" : q.status === "with_cat_mgr" ? "Category Manager" : q.status === "with_management" ? "Management" : "Preparation";
        if (!deadline) continue;
        const diff = new Date(deadline).getTime() - now.getTime();
        if (diff < 0) overdue.push({ request_no: q.request_no, status: q.status, stage: stageName, overdue_min: Math.round(-diff/60000), urgency: q.urgency });
        else if (diff < 10*60000) warnings.push({ request_no: q.request_no, stage: stageName, minutes_left: Math.round(diff/60000) });
      }
      return json({ success: true, overdue, warnings, total_active: active?.length||0 });
    }

    return json({ error: "Unknown mode" }, 400);
  } catch(e) {
    return json({ error: String(e) }, 500);
  }
});
