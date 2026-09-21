// Supabase Edge Function: ai-site-analysis
// Analyses construction site photos using Claude vision to detect stage,
// requirements, and estimated order value. Updates field_visits table.
//
// Deploy: supabase functions deploy ai-site-analysis --no-verify-jwt
// Secrets needed:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service role key>
//   supabase secrets set SUPABASE_URL=https://ndamdnlsuktucqtcbhgp.supabase.co

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL         = "claude-sonnet-4-6";
const MAX_PHOTOS    = 5; // Vision context limit

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, "content-type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are a senior construction site analyst for V Wholesale, a premium home building materials retailer in India (tiles, granite, marble, sanitaryware, CP fittings, paints, plywood, PVC pipes, electrical wires).

Your job: analyse construction site photos and identify what building materials the site needs RIGHT NOW and in the upcoming 30 days.

V Wholesale product categories:
- Tiles (floor, wall, elevation, parking)
- Granite & Marble (countertops, flooring)
- Sanitaryware (WCs, wash basins, bathtubs)
- CP Fittings (taps, showers, mixers)
- Paints (interior, exterior, waterproofing)
- Plywood & Laminates
- PVC Pipes & Fittings
- Electrical Wires & Conduits
- Waterproofing Solutions
- Adhesives & Grouts

Pricing reference for value estimation (Vijayawada, Andhra Pradesh market rates):
- Tiles: ₹35–200/sqft depending on grade
- Granite: ₹80–300/sqft
- Sanitaryware set per bathroom: ₹8,000–40,000
- CP Fittings per bathroom: ₹5,000–25,000
- Paints per room coat: ₹15–50/sqft
- Plywood per sheet: ₹800–2,500
- Waterproofing per sqft: ₹20–60

Always respond in valid JSON only. No markdown, no explanation outside the JSON.`;

const ANALYSIS_PROMPT = (ctx: {
  stage?: string;
  projectType?: string;
  sqft?: number;
  city?: string;
}) => `Analyse the construction site photos provided.

Site context provided by field rep:
- Construction stage (rep's assessment): ${ctx.stage || "not specified"}
- Project type: ${ctx.projectType || "not specified"}
- Estimated area: ${ctx.sqft ? ctx.sqft + " sqft" : "not specified"}
- City: ${ctx.city || "Vijayawada, AP"}

IMPORTANT on value estimation:
- NEVER return 0 for estimated_value_min or estimated_value_max — every site has some material need
- Finishing/tiling_ready/tiling_in_progress are the HIGHEST value stages — tiles, granite, sanitaryware, CP fittings, paints are all needed NOW
- Even handover/renovation sites need replacement tiles, fixtures, paints — estimate for that
- Minimum value for any visited site is ₹50,000. Most residential sites are ₹3L–₹30L range.
- Base estimate on sqft if visible: avg 3BHK = 1500 sqft, tiles alone = ₹35–120/sqft

Return ONLY this JSON structure:
{
  "stage_detected": "one of: foundation | structure | brick_work | plastering | tiling_ready | tiling_in_progress | finishing | renovation",
  "stage_confidence": "high | medium | low",
  "stage_notes": "brief observation about what you see that determines the stage",
  "requirements": [
    "list each V Wholesale product category needed, ordered by urgency",
    "examples: Tiles, Granite & Marble, Sanitaryware, CP Fittings, Paints, Plywood & Laminates, Waterproofing Solutions, PVC Pipes & Fittings, Electrical Wires & Conduits, Adhesives & Grouts"
  ],
  "requirements_detail": {
    "immediate": ["needed within 2 weeks"],
    "upcoming": ["needed within 30 days"],
    "future": ["needed after 30 days"]
  },
  "estimated_sqft": <number or null — your estimate of total built-up area>,
  "estimated_value_min": <number in INR — conservative total order estimate, NEVER 0>,
  "estimated_value_max": <number in INR — optimistic total order estimate, NEVER 0>,
  "num_bathrooms_detected": <number or null>,
  "competitor_materials_spotted": ["any branded materials you can identify in photos"],
  "suggestion": "2-3 sentences: specific, actionable advice for the field rep on what to pitch first and why, referencing what you actually saw in the photos",
  "crm_note": "1-2 sentences for the backend CRM team — what follow-up action to take and when"
}`;

async function fetchImageAsBase64(url: string, serviceKey: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    // Add auth header for Supabase storage URLs to ensure access
    const headers: Record<string, string> = {};
    if (url.includes("supabase.co/storage")) {
      headers["Authorization"] = `Bearer ${serviceKey}`;
      headers["apikey"] = serviceKey;
    }
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.error(`Failed to fetch image ${url}: ${res.status} ${res.statusText}`);
      return null;
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const mediaType = contentType.split(";")[0].trim() as "image/jpeg" | "image/png" | "image/webp";
    const buf = await res.arrayBuffer();
    // Use a chunked approach for large images to avoid stack overflow
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    return { base64, mediaType };
  } catch (e) {
    console.error(`Error fetching image ${url}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const {
      visitId,
      photoUrls,
      context,   // { stage, projectType, sqft, city }
    } = await req.json();

    if (!visitId) return json({ error: "visitId required" }, 400);
    if (!photoUrls?.length) return json({ error: "photoUrls required" }, 400);

    const sb = createClient(SB_URL, SB_SERVICE);

    // Fetch images as base64 (parallel, max MAX_PHOTOS)
    const imageResults = await Promise.all(
      photoUrls.slice(0, MAX_PHOTOS).map((url: string) => fetchImageAsBase64(url, SB_SERVICE))
    );
    const validImages = imageResults.filter(Boolean) as { base64: string; mediaType: string }[];

    if (!validImages.length) {
      return json({ error: "Could not fetch any images" }, 400);
    }

    // Build Claude message content
    const content: unknown[] = [
      ...validImages.map(img => ({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType,
          data: img.base64,
        },
      })),
      {
        type: "text",
        text: ANALYSIS_PROMPT(context || {}),
      },
    ];

    // Call Claude vision
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    const aiBody = await aiRes.json();
    if (!aiRes.ok) {
      throw new Error(aiBody?.error?.message || `Claude API error ${aiRes.status}`);
    }

    const rawText: string = aiBody?.content?.[0]?.text ?? "{}";
    let analysis: Record<string, unknown> = {};
    try {
      analysis = JSON.parse(rawText.replace(/```json\n?|```/g, "").trim());
    } catch {
      throw new Error("Could not parse AI response: " + rawText.slice(0, 200));
    }

    // Save to field_visits
    // Safety: normalize stage (remove invalid values like "handover")
    const validStages = ["foundation","structure","brick_work","plastering","tiling_ready","tiling_in_progress","finishing","renovation"];
    let detectedStage = (analysis.stage_detected as string || "").toLowerCase().replace(/\s+/g,'_');
    if (!validStages.includes(detectedStage)) {
      // Map invalid stages to closest valid one
      if (detectedStage.includes("handover") || detectedStage.includes("complete")) detectedStage = "finishing";
      else if (detectedStage.includes("tile")) detectedStage = "tiling_ready";
      else detectedStage = "plastering"; // safe default
    }

    // Safety: ensure value is never 0 — apply stage-based minimums
    const stageMinValues: Record<string, [number,number]> = {
      foundation: [50000, 200000],
      structure: [200000, 800000],
      brick_work: [500000, 2000000],
      plastering: [800000, 3000000],
      tiling_ready: [1500000, 5000000],
      tiling_in_progress: [1000000, 4000000],
      finishing: [1200000, 4500000],
      renovation: [300000, 1500000],
    };
    const [minFloor, maxFloor] = stageMinValues[detectedStage] || [300000, 1500000];
    const valueMin = Math.max(Number(analysis.estimated_value_min) || 0, minFloor);
    const valueMax = Math.max(Number(analysis.estimated_value_max) || 0, maxFloor, valueMin * 2);

    const { error: updateErr } = await sb.from("field_visits").update({
      ai_analysis: analysis,
      ai_stage_detected: detectedStage,
      ai_requirements: analysis.requirements,
      ai_estimated_value_min: valueMin,
      ai_estimated_value_max: valueMax,
      ai_product_suggestions: analysis.requirements_detail || [],
    }).eq("id", visitId);

    if (updateErr) throw updateErr;

    // Also append CRM note to the visit notes if present
    if (analysis.crm_note) {
      const { data: visit } = await sb.from("field_visits")
        .select("notes").eq("id", visitId).single();
      const updatedNotes = [
        visit?.notes,
        `[AI CRM Note] ${analysis.crm_note}`,
      ].filter(Boolean).join("\n\n");
      await sb.from("field_visits").update({ notes: updatedNotes }).eq("id", visitId);
    }

    return json({ success: true, analysis });

  } catch (e) {
    console.error("[ai-site-analysis]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
