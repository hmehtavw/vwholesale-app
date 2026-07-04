// Supabase Edge Function: labor-photo-analysis
// Analyses daily work photos to estimate sqft completed and work stage.
// Deploy: supabase functions deploy labor-photo-analysis --no-verify-jwt
// Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-sonnet-4-6";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

const ANALYSIS_PROMPT = `You are analysing daily tile laying work progress photos for V Wholesale, a tile retailer in Vijayawada, India.

Analyse the photos and return ONLY a JSON object (no markdown) with:
{
  "sqft_estimate": number (approximate sqft of tiles laid — visible laid tiles only),
  "work_stage": "laying" | "grouting_pending" | "cleaning_pending" | "complete",
  "confidence": "high" | "medium" | "low",
  "rooms_detected": number (how many distinct rooms/areas visible),
  "observations": string (brief 1-2 sentence description of what you see),
  "stage_breakdown": {
    "laying_done_pct": number (0-100),
    "grouting_done_pct": number (0-100),
    "cleaning_done_pct": number (0-100)
  }
}

Work stages:
- "laying": tiles being placed, most/all tiles not yet grouted
- "grouting_pending": tiles laid but grout joints not filled
- "cleaning_pending": grouting done but haze/residue still visible on tiles  
- "complete": tiles laid, grouted, cleaned and finished

For sqft estimate: count visible tile rows/columns, estimate tile size from context.
If multiple photos, analyse all and give combined estimate.
Be conservative — underestimate rather than overestimate.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { photos, totalSqft, tileSize } = await req.json();
    if (!photos?.length) return json({ error: "No photos provided" }, 400);

    // Build image blocks (max 4 photos to stay within token limits)
    const imageBlocks = photos.slice(0, 4).map((p: { base64: string; mediaType?: string }) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: p.mediaType || "image/jpeg",
        data: p.base64,
      },
    }));

    const contextText = `Total job area: ${totalSqft || "unknown"} sqft. Tile size: ${tileSize || "unknown"}. Analyse the ${photos.length} photo(s) and estimate today's progress.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text", text: ANALYSIS_PROMPT + "\n\n" + contextText },
          ],
        }],
      }),
    });

    const body = await aiRes.json();
    if (!aiRes.ok) {
      return json({ error: body?.error?.message || `AI failed (${aiRes.status})` }, aiRes.status);
    }

    const text: string = body?.content?.[0]?.text ?? "{}";
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
    } catch (_) {
      return json({ data: {}, text, error: "Could not parse AI response" });
    }
    return json({ data });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
