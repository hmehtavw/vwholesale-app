// Supabase Edge Function: generate-poster v3
// Strategy: Pexels stock photo for hero (real photo, zero text) + GPT-4o-mini for content
// Canvas compositor on client handles ALL text/branding overlay
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

// ── Pexels search queries by template ──
const PEXELS_QUERIES: Record<string, string[]> = {
  product:    ["luxury marble floor interior", "premium tile living room", "modern home interior tiles", "elegant marble foyer"],
  offer:      ["bright modern home interior", "luxury apartment living room", "contemporary home design"],
  contractor: ["luxury home renovation", "modern villa interior", "premium home construction finished"],
  festival:   ["festive indian home interior", "luxury home decoration", "elegant living room lighting"],
  store:      ["tile showroom interior", "home improvement store", "luxury material showroom"],
};

// ── Fetch hero image from Pexels ──
async function fetchPexelsHero(template: string): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;
  const queries = PEXELS_QUERIES[template] || PEXELS_QUERIES.product;
  const query = queries[Math.floor(Math.random() * queries.length)];

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=square`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    const data = await res.json();
    const photos = data?.photos || [];
    if (!photos.length) return null;
    // Pick a random photo from top results
    const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 8))];
    const imgUrl = photo?.src?.large || photo?.src?.medium;
    if (!imgUrl) return null;
    // Fetch and convert to base64
    const imgRes = await fetch(imgUrl);
    const buffer = await imgRes.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return b64;
  } catch (e) {
    console.error("Pexels fetch error:", e);
    return null;
  }
}

// ── Fallback: DALL-E with very strict no-text prompt ──
async function fetchDalleHero(template: string): Promise<string | null> {
  const prompts: Record<string, string> = {
    product: "Photorealistic luxury Indian home interior. Large format beige marble floor tiles with natural veining. Modern living room, soft warm lighting, indoor plants, contemporary furniture. Ultra clean image with absolutely NO TEXT, NO WORDS, NO LETTERS, NO SIGNS, NO LOGOS anywhere. Pure interior photography.",
    offer:   "Photorealistic bright modern apartment interior with premium marble floor. Sunlit living space, minimal furniture, lush plants. NO TEXT NO WORDS NO LETTERS NO SIGNS anywhere in the image. Pure architectural photography.",
    contractor: "Photorealistic luxury finished home interior showcasing premium flooring. Beautiful marble or large-format tile floor. NO TEXT NO WORDS NO LETTERS NO SIGNS anywhere. Pure interior design photography.",
    festival: "Photorealistic elegant Indian home interior with warm festive lighting. Premium marble floors reflecting warm glow. NO TEXT NO WORDS NO LETTERS NO SIGNS anywhere. Pure interior photography.",
    store:   "Photorealistic premium tile showroom interior. Backlit display panels with marble tile samples. NO TEXT NO WORDS NO LETTERS NO SIGNS anywhere. Pure commercial photography.",
  };
  const prompt = prompts[template] || prompts.product;

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
        quality: "hd",
        style: "natural"
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.data?.[0]?.b64_json || null;
  } catch (e) {
    console.error("DALL-E error:", e);
    return null;
  }
}

// ── GPT-4o-mini: generate all poster text content ──
async function generateContent(topic: string, template: string, language: string, businessName: string) {
  const langNote = language === 'te' ? 'Write headline_line1 and headline_line2 in Telugu script' :
                   language === 'hi' ? 'Write headline_line1 and headline_line2 in Hindi script' :
                   'Write all text in English';

  const prompt = `You are a marketing copywriter for ${businessName}, a premium home building materials store in Vijayawada, Andhra Pradesh, India.

Topic: "${topic}"
Template type: ${template}
Language rule: ${langNote}

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
  "caption": "Full Instagram caption with emojis and hashtags"
}

Rules:
- headline_line1: extracted BRAND NAME in ALL CAPS, max 12 chars (e.g. SUNHEARRT, KAJARIA, ASIAN)
- headline_line2: PRODUCT CATEGORY in ALL CAPS, max 10 chars (e.g. TILES, PAINTS, GRANITE)
- subheadline: max 38 chars, availability/offer
- body: max 42 chars, one descriptive line
- feature_gold: 3 short phrases joined by " • "
- usage: one line about where it's used
- feature1/2/3: each max 4 words
- caption: rich Instagram post with emojis, call to action, 5-8 hashtags`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 700,
        temperature: 0.6,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const d = await res.json();
    const text = d.choices?.[0]?.message?.content || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    // Sensible fallback
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
      caption: `✨ ${topic} now at V Wholesale, Vijayawada! 📞 8712697930 | vwholesale.in #VWholesale #Vijayawada #Tiles #HomeDesign`
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

  const { topic = "Premium Tiles", template = "product", language = "en", business_name = "V Wholesale" } = body;

  try {
    // Run content generation and image fetch in parallel
    const [content, pexelsB64] = await Promise.all([
      generateContent(topic, template, language, business_name),
      fetchPexelsHero(template),
    ]);

    // Use Pexels if available, fall back to DALL-E
    let image_b64 = pexelsB64;
    let image_source = "pexels";
    if (!image_b64) {
      console.log("Pexels unavailable, falling back to DALL-E");
      image_b64 = await fetchDalleHero(template);
      image_source = "dalle";
    }
    if (!image_b64) throw new Error("Could not fetch hero image from any source");

    return json({ ok: true, image_b64, image_source, content });
  } catch (e) {
    console.error("generate-poster error:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
