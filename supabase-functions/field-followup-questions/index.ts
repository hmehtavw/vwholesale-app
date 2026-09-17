// Supabase Edge Function: field-followup-questions
// Analyses previous visit data and generates smart follow-up questions
// Deploy: supabase functions deploy field-followup-questions --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { parentVisitId, staffId } = await req.json();
    if (!parentVisitId) return json({ error: "parentVisitId required" }, 400);

    const sb = createClient(SB_URL, SB_SERVICE);

    // Fetch parent visit + all previous visits to same site
    const { data: parentVisit } = await sb.from("field_visits")
      .select("*").eq("id", parentVisitId).single();
    if (!parentVisit) return json({ error: "Visit not found" }, 404);

    // Get all previous visits to same address
    const { data: previousVisits } = await sb.from("field_visits")
      .select("id,created_at,construction_stage,notes,site_contacts,ai_requirements,ai_stage_detected,visit_quality_score,competitor_products,customer_requirements")
      .eq("site_address", parentVisit.site_address)
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false })
      .limit(5);

    const visitCount = previousVisits?.length || 1;
    const lastVisit = previousVisits?.[0];
    const contacts = parentVisit.site_contacts || [];
    const contactNames = contacts.map((c: Record<string,string>) => c.name || 'Unknown').join(", ");
    const stage = parentVisit.construction_stage || "unknown";
    const aiReqs = parentVisit.ai_requirements || [];
    const competitors = parentVisit.competitor_products || [];
    const missingContacts = [];
    const hasOwner = contacts.some((c: Record<string,string>) => c.role === "Owner");
    const hasArchitect = contacts.some((c: Record<string,string>) => c.role === "Architect");
    const hasContractor = contacts.some((c: Record<string,string>) => c.role === "Contractor");
    if (!hasOwner) missingContacts.push("Owner");
    if (!hasArchitect) missingContacts.push("Architect");
    if (!hasContractor) missingContacts.push("Contractor");

    const prompt = `You are a field sales coach for V Wholesale, a building materials retailer in Vijayawada, India.

A field rep is about to make their follow-up visit #${visitCount + 1} to this construction site.

Previous visit data:
- Site: ${parentVisit.site_address}
- Stage last time: ${stage}
- Contacts captured so far: ${contactNames || "none"}
- Missing contacts: ${missingContacts.join(", ") || "none"}
- AI detected requirements last time: ${aiReqs.join(", ") || "unknown"}
- Competitor materials spotted: ${JSON.stringify(competitors) || "none"}
- Visit notes: ${parentVisit.notes || "none"}
- Previous visit quality score: ${parentVisit.visit_quality_score || "unknown"}%

Generate 5-7 smart, specific follow-up questions the rep should ask/check during this visit.
Questions should:
1. Build on what was captured last time
2. Try to get missing information (contacts, stage update, decisions made)
3. Probe competitor situation and customer's buying decision timeline
4. Be conversational and natural — not robotic
5. Include at least 1 question about new contacts not captured yet

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "The exact question to ask",
      "category": "stage_update|contact|competitor|timeline|requirement|budget",
      "why": "One line: why this question matters for sales",
      "answer_type": "text|yes_no|select",
      "options": ["option1", "option2"] // only if select type
    }
  ],
  "priority_action": "The single most important thing to achieve in this visit",
  "red_flags": ["any concern from previous data worth noting"]
}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiBody = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiBody?.error?.message || "AI error");

    const rawText = aiBody?.content?.[0]?.text ?? "{}";
    let result: Record<string, unknown> = {};
    try { result = JSON.parse(rawText.replace(/```json\n?|```/g, "").trim()); }
    catch { throw new Error("Could not parse AI response"); }

    // Save questions to visit
    await sb.from("field_visits").update({
      followup_questions: result.questions,
    }).eq("id", parentVisitId);

    return json({ success: true, ...result });
  } catch(e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
