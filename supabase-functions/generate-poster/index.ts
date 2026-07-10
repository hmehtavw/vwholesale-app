// Supabase Edge Function: generate-poster v4
// Hero image: gpt-image-2 (primary) with empty left panel | Pexels stock (fallback)
// Content: GPT-4o-mini for all poster copy
// Canvas compositor on client overlays ALL text/branding — zero AI text in image
// Deploy: supabase functions deploy generate-poster --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY") || "";

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

// ── 1. gpt-image-2: hero background with empty left panel ──
// Left 40% = solid navy reserved for Canvas text overlay
// Right 60% = luxury interior/product scene, zero text
async function fetchGptImage2Hero(template: string): Promise<string | null> {
  const base = `Square 1024x1024 image. LEFT 40% must be solid plain dark navy blue (#1a2744) — completely empty, no objects, no decoration, reserved for text. RIGHT 60% contains the scene. CRITICAL: NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO LOGOS, NO WATERMARKS, NO SIGNS anywhere in the entire image.`;

  const scenes: Record<string, string> = {
    product:    `${base} RIGHT SIDE: Ultra-photorealistic luxury Indian home interior. Grand living room with stunning large-format marble porcelain floor tiles, cream and beige with natural gold veining. Warm professional architectural lighting, lush indoor tropical plants, premium contemporary furniture. Magazine editorial quality.`,
    offer:      `${base} RIGHT SIDE: Bright sunlit modern Indian apartment. Premium marble-look large-format floor tiles reflecting natural light. Minimalist contemporary furniture, lush plants, open airy space. Professional real estate photography style.`,
    contractor: `${base} RIGHT SIDE: Luxury newly finished Indian home interior. Premium large-format marble floor tiles throughout. Dramatic warm lighting, high-end renovation aesthetic, aspirational professional photography.`,
    festival:   `${base} RIGHT SIDE: Elegant festive Indian home interior. Premium marble floors with warm golden ambient lighting and decorative accents. Rich warm tones, celebration atmosphere, luxury photography.`,
    store:      `${base} RIGHT SIDE: Premium tile showroom interior with backlit wall display panels showing marble and granite tile collections. Elegant retail spotlighting, spacious modern layout, luxury commercial photography.`,
  };

  const prompt = scenes[template] || scenes.product;

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
        quality: "high",
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error("gpt-image-2 error:", data.error.message);
      return null;
    }
    return data.data?.[0]?.b64_json || null;
  } catch (e) {
    console.error("gpt-image-2 fetch error:", e);
    return null;
  }
}

// ── 2. Pexels: real stock photography fallback (guaranteed no text) ──
const PEXELS_QUERIES: Record<string, string[]> = {
  product:    ["luxury marble floor interior", "premium tile living room", "modern home interior tiles"],
  offer:      ["bright modern home interior", "luxury apartment living room", "contemporary home design"],
  contractor: ["luxury home renovation finished", "premium home interior marble"],
  festival:   ["festive indian home interior", "luxury home golden lighting"],
  store:      ["tile showroom interior", "luxury material showroom display"],
};

async function fetchPexelsHero(template: string): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;
  const queries = PEXELS_QUERIES[template] || PEXELS_QUERIES.product;
  const query = queries[Math.floor(Math.random() * queries.length)];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&orientation=square`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    const data = await res.json();
    const photos = data?.photos || [];
    if (!photos.length) return null;
    const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 8))];
    const imgUrl = photo?.src?.large || photo?.src?.medium;
    if (!imgUrl) return null;
    const imgRes = await fetch(imgUrl);
    const buffer = await imgRes.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  } catch (e) {
    console.error("Pexels error:", e);
    return null;
  }
}

// ── 3. GPT-4o-mini: generate all poster text content ──
async function generateContent(
  topic: string, template: string, language: string, businessName: string
): Promise<Record<string, unknown>> {
  const langNote =
    language === "te" ? "Write headline_line1 and headline_line2 in Telugu script" :
    language === "hi" ? "Write headline_line1 and headline_line2 in Hindi script" :
    "Write all text in English";

  const prompt = `You are a marketing copywriter for ${businessName}, a premium home building materials store in Vijayawada, Andhra Pradesh, India.

Topic: "${topic}"
Template: ${template}
Language: ${langNote}

Extract the BRAND NAME from the topic (e.g. "Sunhearrt" from "Sunhearrt tiles", "Kajaria" from "Kajaria tiles").

Return ONLY valid JSON (no markdown, no extra text):
{
  "headline_line1": "SUNHEARRT",
  "headline_line2": "TILES",
  "subheadline": "Now Available at V Wholesale",
  "body": "Premium Wall & Floor Tile Collection",
  "feature_gold": "Elegant Designs • Modern Finishes • Lasting Quality",
  "usage": "Perfect for Living Rooms, Bedrooms, Bathrooms & Outdoor Spaces",
  "feature1": "Luxury Marble Looks",
  "feature2": "Glossy, Matt & Designer Finishes",
  "feature3": "Premium Quality for Modern Homes",
  "badge": "AVAILABLE IN STORE",
  "cta": "VISIT OUR STORE TODAY",
  "strip_items": ["TILES", "GRANITE", "SANITARYWARE", "PAINTS", "ELECTRICALS"],
  "caption": "Full Instagram caption with emojis and 5-8 hashtags"
}

Rules:
- headline_line1: brand name in ALL CAPS, max 12 chars
- headline_line2: product category in ALL CAPS, max 10 chars
- subheadline: max 38 chars
- body: max 42 chars
- feature1/2/3: max 4 words each
- caption: rich, emojis, call-to-action, mention Vijayawada`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 700,
        temperature: 0.6,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await res.json();
    const text = d.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    const brand = topic.split(" ")[0]?.toUpperCase().slice(0, 12) || "BRAND";
    return {
      headline_line1: brand,
      headline_line2: "TILES",
      subheadline: "Now Available at V Wholesale",
      body: "Premium Wall & Floor Tile Collection",
      feature_gold: "Elegant Designs • Modern Finishes • Lasting Quality",
      usage: "Perfect for Living Rooms, Bedrooms, Bathrooms & Outdoor Spaces",
      feature1: "Luxury Marble Looks",
      feature2: "Glossy, Matt & Designer Finishes",
      feature3: "Premium Quality for Modern Homes",
      badge: "AVAILABLE IN STORE",
      cta: "VISIT OUR STORE TODAY",
      strip_items: ["TILES", "GRANITE", "SANITARYWARE", "PAINTS", "ELECTRICALS"],
      caption: `✨ ${topic} now at V Wholesale, Vijayawada! 📞 8712697930 | vwholesale.in #VWholesale #Vijayawada #Tiles #HomeDesign #InteriorDesign`,
    };
  }
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const {
    topic = "Premium Tiles",
    template = "product",
    language = "en",
    business_name = "V Wholesale",
  } = body;
  const captionOnly = body.caption_only === true || body.caption_only === 'true';

  try {
    // caption_only mode: just generate text content, skip image entirely
    if (captionOnly) {
      const content = await generateContent(topic, template, language, business_name);
      return json({ ok: true, content, image_b64: null, image_source: 'none' });
    }

    // Run content generation in parallel with image fetch
    const contentPromise = generateContent(topic, template, language, business_name);

    // Try gpt-image-2 first (best quality), fall back to Pexels stock
    let image_b64 = await fetchGptImage2Hero(template);
    let image_source = "gpt-image-2";

    if (!image_b64) {
      console.log("gpt-image-2 unavailable, trying Pexels stock");
      image_b64 = await fetchPexelsHero(template);
      image_source = "pexels";
    }

    if (!image_b64) throw new Error("Could not fetch hero image from any source");

    const content = await contentPromise;
    return json({ ok: true, image_b64, image_source, content });

  } catch (e) {
    console.error("generate-poster error:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
