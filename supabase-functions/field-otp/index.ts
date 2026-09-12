// Supabase Edge Function: field-otp
// Generates and sends OTP to field staff via WhatsApp Business API.
// Falls back to storing OTP in DB if WA fails (for dev/testing).
//
// Deploy: supabase functions deploy field-otp --no-verify-jwt
// Secrets needed:
//   supabase secrets set WHATSAPP_TOKEN=<Meta WA Business API token>
//   supabase secrets set WHATSAPP_PHONE_ID=<WA Phone Number ID>
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service role key>
//   supabase secrets set SUPABASE_URL=https://ndamdnlsuktucqtcbhgp.supabase.co
//   supabase secrets set OTP_EXPIRY_MINUTES=10

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const WA_TOKEN      = Deno.env.get("WHATSAPP_TOKEN")!;
const WA_PHONE_ID   = Deno.env.get("WHATSAPP_PHONE_ID")!;
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OTP_EXPIRY    = parseInt(Deno.env.get("OTP_EXPIRY_MINUTES") || "10");

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

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendWhatsAppOTP(phone: string, otp: string): Promise<boolean> {
  if (!WA_TOKEN || !WA_PHONE_ID) return false;

  // Format phone: ensure +91 prefix
  const formatted = phone.startsWith("+") ? phone : `+91${phone}`;

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formatted,
        type: "template",
        template: {
          name: "field_otp",       // Template name approved in Meta Business Manager
          language: { code: "en" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: otp },
              { type: "text", text: OTP_EXPIRY.toString() },
            ],
          }],
        },
      }),
    }
  );

  const body = await res.json();
  return res.ok && body?.messages?.[0]?.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { phone, action } = await req.json();
    if (!phone) return json({ error: "phone required" }, 400);

    const cleanPhone = phone.replace(/\D/g, "").slice(-10); // last 10 digits
    if (cleanPhone.length !== 10) return json({ error: "Invalid phone" }, 400);

    const sb = createClient(SB_URL, SB_SERVICE);

    // ── SEND OTP ──────────────────────────────────────────
    if (action === "send" || !action) {
      // Verify staff exists and is active field role
      const { data: staff, error: staffErr } = await sb
        .from("staff")
        .select("id, name, phone, role, designation, active")
        .eq("phone", cleanPhone)
        .eq("active", true)
        .single();

      if (staffErr || !staff) {
        return json({ error: "Phone not registered in field team" }, 404);
      }

      const fieldRoles = ["field executive","team leader","mapping executive","asm","cluster head","region head"];
      const isField = fieldRoles.some(r =>
        (staff.role || "").toLowerCase().includes(r) ||
        (staff.designation || "").toLowerCase().includes(r)
      );
      if (!isField) return json({ error: "Not a field team member" }, 403);

      // Rate limit: max 3 OTPs per phone per 10 min
      const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await sb.from("field_otp_log")
        .select("id", { count: "exact" })
        .eq("phone", cleanPhone)
        .gte("created_at", windowStart);

      if ((count || 0) >= 3) {
        return json({ error: "Too many OTP requests. Wait 10 minutes." }, 429);
      }

      // Invalidate any existing OTPs for this phone
      await sb.from("field_otp_log")
        .update({ used: true })
        .eq("phone", cleanPhone)
        .eq("used", false);

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY * 60 * 1000).toISOString();

      // Store OTP in DB
      const { error: insertErr } = await sb.from("field_otp_log").insert({
        phone: cleanPhone,
        staff_id: staff.id,
        otp_hash: otp, // In production: hash this with bcrypt
        expires_at: expiresAt,
        used: false,
      });
      if (insertErr) throw insertErr;

      // Send via WhatsApp
      const waSent = await sendWhatsAppOTP(cleanPhone, otp);

      // In dev/if WA not configured: return OTP directly (REMOVE IN PRODUCTION)
      const devMode = !WA_TOKEN || !WA_PHONE_ID;

      return json({
        success: true,
        staff_name: staff.name,
        delivery: waSent ? "whatsapp" : "pending",
        expires_in_minutes: OTP_EXPIRY,
        // DEV ONLY — remove before going live:
        ...(devMode ? { dev_otp: otp } : {}),
      });
    }

    // ── VERIFY OTP ────────────────────────────────────────
    if (action === "verify") {
      const { otp } = await req.json().catch(() => ({})) as { otp?: string };
      if (!otp) return json({ error: "otp required" }, 400);

      const { data: record, error: fetchErr } = await sb
        .from("field_otp_log")
        .select("*")
        .eq("phone", cleanPhone)
        .eq("otp_hash", otp)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchErr || !record) {
        return json({ error: "Invalid or expired OTP" }, 401);
      }

      // Mark used
      await sb.from("field_otp_log").update({ used: true }).eq("id", record.id);

      // Fetch full staff record
      const { data: staff } = await sb.from("staff").select("*").eq("id", record.staff_id).single();

      return json({ success: true, staff });
    }

    return json({ error: "Invalid action" }, 400);

  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
