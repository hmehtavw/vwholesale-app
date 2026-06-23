// Supabase Edge Function: tile-catalog-ocr
// Server-side AI proxy for the tile-catalog extraction pipeline.
// Deploy with verify_jwt = false (same as your grn-ocr / ocr-quote-items).
//
//   supabase functions deploy tile-catalog-ocr --no-verify-jwt
//
// Requires the Anthropic key as a secret. Reuse whatever your grn-ocr uses:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (skip if already set)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// Match the model string your working grn-ocr function uses.
const MODEL = "claude-sonnet-4-6";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_PROMPT =
  'Extract every tile design from this catalog page. Return ONLY a JSON array, no markdown, ' +
  'each item: {"design_name","sku_code","series","size_mm","finish","colour_family","surface_type"}. ' +
  'Use null for unknown fields.';

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { base64, mediaType, isPDF, prompt } = await req.json();
    if (!base64) return json({ error: "No file data provided" }, 400);

    const fileBlock = isPDF
      ? { type: "document", source: { type: "base64", media_type: mediaType || "application/pdf", data: base64 } }
      : { type: "image",    source: { type: "base64", media_type: mediaType || "image/jpeg",       data: base64 } };

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: prompt || DEFAULT_PROMPT }] }],
      }),
    });

    const body = await aiRes.json();
    if (!aiRes.ok) {
      return json({ error: body?.error?.message || `AI request failed (${aiRes.status})` }, aiRes.status);
    }

    const text: string = body?.content?.[0]?.text ?? "[]";
    let data: unknown[] = [];
    try {
      data = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
    } catch (_) {
      // Return the raw text so the client can log what came back
      return json({ data: [], text });
    }
    return json({ data });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
