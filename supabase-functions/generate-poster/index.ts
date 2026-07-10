// Supabase Edge Function: generate-poster
// Generates ONLY a hero lifestyle image via OpenAI image API.
// All text/branding is composited on the client via HTML Canvas.
// Deploy: supabase functions deploy generate-poster --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

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

// Build a tight image-only prompt — NO TEXT in the image
function buildHeroPrompt(topic: string, template: string): string {
  const base = `Ultra-realistic architectural photography, premium interior design, professional commercial real estate photo. NO TEXT, NO WORDS, NO LABELS, NO SIGNS, NO WRITING anywhere in the image.`;

  const templatePrompts: Record<string, string> = {
    product: `Luxurious Indian home interior showcasing premium marble and porcelain floor tiles. Large format tiles in beige/cream/white tones with natural veining. Elegant living room or foyer, soft warm lighting, potted plants, modern furniture. Photo-realistic, magazine quality. ${base}`,
    offer: `Stunning modern Indian home with premium tiles on floors and walls. Bright, airy space with natural light. Marble-look large format tiles, contemporary furniture, lush indoor plants. Sale/promotion mood, vibrant and inviting. ${base}`,
    contractor: `Professional construction site transformed into a beautiful finished home. Split view: raw concrete on one side, finished premium tile flooring on the other. Hard hat on a table, architectural blueprints, tile samples. Industrial meets luxury aesthetic. ${base}`,
    festival: `Festive Indian home interior with premium tiles, decorated for celebration. Diyas, flowers, warm golden lighting, marble floors reflecting festival lights. Joyful, warm, premium aesthetic. ${base}`,
    store: `Modern retail showroom interior with premium tile displays on walls and floor. Backlit tile display panels, elegant lighting, professional retail atmosphere. Spacious, clean, premium. ${base}`,
  };

  return templatePrompts[template] || templatePrompts.product;
}

// Generate content text via GPT (headline, features, caption) — separate from image
async function generateContent(topic: string, template: string, language: string, businessName: string): Promise<Record<string, unknown>> {
  const langInstruction = language === 'te' ? 'Write in Telugu (తెలుగు) script' :
                          language === 'hi' ? 'Write in Hindi (हिन्दी) script' :
                          language === 'te+en' ? 'Write headline in Telugu, body in English' :
                          'Write in English';

  const prompt = `You are a marketing copywriter for ${businessName}, a premium home building materials retailer in Vijayawada, Andhra Pradesh.

Topic: "${topic}"
Template: ${template}
${langInstruction}

Return ONLY valid JSON, no markdown, no explanation:
{
  "brand_name": "Sunhearrt Tiles",
  "headline_line1": "SUNHEARRT",
  "headline_line2": "TILES",
  "subheadline": "Now Available at V Wholesale",
  "body": "Premium Wall & Floor Tile Collection",
  "feature1": "Luxury Marble Looks",
  "feature2": "Glossy, Matt & Designer Finishes",
  "feature3": "Premium Quality for Modern Homes",
  "badge": "AVAILABLE IN STORE",
  "cta": "VISIT OUR STORE TODAY",
  "caption": "Instagram caption here with hashtags",
  "strip_items": ["TILES", "GRANITE", "SANITARYWARE", "PAINTS", "ELECTRICALS"]
}

Rules:
- headline_line1: brand/product name in ALL CAPS (short, max 12 chars)
- headline_line2: category in ALL CAPS (max 8 chars)
- subheadline: availability/offer line (max 35 chars)
- body: one line description (max 45 chars)
- feature1/2/3: 3-4 words each
- Extract brand name from topic if mentioned (e.g. "Kajaria", "Sunhearrt", "Asian Paints")
- caption: full Instagram caption with emojis and hashtags`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 600,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const d = await res.json();
  const text = d.choices?.[0]?.message?.content || '{}';
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return {
      brand_name: topic.split(' ')[0] || 'Brand',
      headline_line1: topic.toUpperCase().slice(0, 12),
      headline_line2: "TILES",
      subheadline: "Now Available at V Wholesale",
      body: "Premium Wall & Floor Tile Collection",
      feature1: "Luxury Marble Looks",
      feature2: "Glossy, Matt & Designer Finishes",
      feature3: "Premium Quality for Modern Homes",
      badge: "AVAILABLE IN STORE",
      cta: "VISIT OUR STORE TODAY",
      caption: `✨ ${topic} now available at V Wholesale, Vijayawada! #VWholesale #Vijayawada #Tiles`,
      strip_items: ["TILES", "GRANITE", "SANITARYWARE", "PAINTS", "ELECTRICALS"]
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const {
    topic = "Premium Tiles",
    template = "product",
    language = "en",
    business_name = "V Wholesale",
  } = body;

  try {
    // Step 1: Generate text content
    const content = await generateContent(topic, template, language, business_name);

    // Step 2: Generate hero image only (NO text in image)
    const heroPrompt = buildHeroPrompt(topic, template);

    const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: heroPrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
        quality: "hd",
        style: "natural"
      })
    });

    const imgData = await imgRes.json();
    if (imgData.error) throw new Error(imgData.error.message);

    const image_b64 = imgData.data?.[0]?.b64_json;
    if (!image_b64) throw new Error("No image returned from DALL-E");

    return json({ ok: true, image_b64, content });

  } catch (e) {
    console.error("generate-poster error:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
