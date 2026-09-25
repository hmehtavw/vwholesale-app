// Supabase Edge Function: cashfree-order
// Creates Cashfree payment orders (checkout) AND payment links (shareable URL)
// Deploy: supabase functions deploy cashfree-order --no-verify-jwt
// Secrets: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV (sandbox|production)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_ID   = Deno.env.get("CASHFREE_APP_ID")!;
const SECRET   = Deno.env.get("CASHFREE_SECRET_KEY")!;
const CF_ENV   = Deno.env.get("CASHFREE_ENV") || "sandbox";
const SB_URL   = Deno.env.get("SUPABASE_URL")!;
const SB_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE_URL = CF_ENV === "production"
  ? "https://api.cashfree.com/pg"
  : "https://sandbox.cashfree.com/pg";

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

const cfHeaders = {
  "Content-Type": "application/json",
  "x-api-version": "2023-08-01",
  "x-client-id": APP_ID,
  "x-client-secret": SECRET,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const { mode } = body; // "checkout" | "payment_link"

    // ── MODE: PAYMENT LINK (shareable URL for WhatsApp) ──
    if (mode === "payment_link") {
      const {
        amount, customer_name, customer_phone, customer_email,
        description, invoice_id, notify_whatsapp = true
      } = body;

      if (!amount || !customer_phone) return json({ error: "amount and customer_phone required" }, 400);

      const linkId = `VWL_${invoice_id || Date.now()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      const payload: Record<string, unknown> = {
        link_id: linkId,
        link_amount: parseFloat(amount).toFixed(2),
        link_currency: "INR",
        link_purpose: (description || "V Wholesale Payment").replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50),
        customer_details: {
          customer_name: (customer_name || "Customer").replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50),
          customer_phone: customer_phone.replace(/\D/g, "").slice(-10),
          customer_email: `cust${customer_phone.replace(/\D/g,"").slice(-10)}@email.com`,
        },
        link_expiry_time: expiresAt,
      };

      const res = await fetch(`${BASE_URL}/links`, {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) return json({ error: data?.message || "Cashfree error", details: data }, res.status);

      const paymentUrl = data.link_url;

      // Log to DB
      const sb = createClient(SB_URL, SB_KEY);
      await sb.from("payment_links").insert({
        link_id: linkId,
        cf_link_id: data.link_id || linkId,
        invoice_id: invoice_id || null,
        customer_name: customer_name || null,
        customer_phone: customer_phone.replace(/\D/g,"").slice(-10),
        amount: parseFloat(amount),
        description: description || null,
        payment_url: paymentUrl,
        status: "active",
        expires_at: expiresAt,
      }).catch(() => {}); // non-fatal

      return json({
        success: true,
        link_id: linkId,
        payment_url: paymentUrl,
        amount: parseFloat(amount),
        expires_at: expiresAt,
        whatsapp_text: `Hello ${customer_name || ""}! 👋\n\nHere is your payment link for V Wholesale:\n\n💰 Amount: ₹${parseFloat(amount).toLocaleString("en-IN")}\n📋 ${description || "V Wholesale Payment"}\n\n🔗 Pay here: ${paymentUrl}\n\nLink valid for 7 days. Pay via UPI, Card, or Net Banking.\n\nThank you! 🙏\n— V Wholesale`,
      });
    }

    // ── MODE: CHECKOUT (existing — for B2C shop) ──
    const { order_id, order_amount, customer_name, customer_phone, customer_email, return_url } = body;
    if (!order_id || !order_amount || !customer_phone) {
      return json({ error: "Missing required fields" }, 400);
    }

    const payload = {
      order_id: `VW_${order_id}_${Date.now()}`,
      order_amount: parseFloat(order_amount).toFixed(2),
      order_currency: "INR",
      customer_details: {
        customer_id: `cust_${customer_phone}`,
        customer_name: customer_name || "Customer",
        customer_phone: customer_phone,
        customer_email: customer_email || `${customer_phone}@vwholesale.in`,
      },
      order_meta: {
        return_url: return_url || "https://vwholesale.in/?order={order_id}",
        notify_url: `https://ndamdnlsuktucqtcbhgp.supabase.co/functions/v1/cashfree-webhook`,
      },
      order_note: `V Wholesale order ${order_id}`,
    };

    const res = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: cfHeaders,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) return json({ error: data?.message || "Cashfree error", details: data }, res.status);

    return json({
      payment_session_id: data.payment_session_id,
      cf_order_id: data.cf_order_id,
      order_status: data.order_status,
    });

  } catch(e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
