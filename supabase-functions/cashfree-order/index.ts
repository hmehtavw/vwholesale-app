// Supabase Edge Function: cashfree-order
// Creates a Cashfree payment order and returns payment session ID
// Deploy: supabase functions deploy cashfree-order --no-verify-jwt
// Secrets: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV (sandbox|production)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const APP_ID    = Deno.env.get("CASHFREE_APP_ID")!;
const SECRET    = Deno.env.get("CASHFREE_SECRET_KEY")!;
const CF_ENV    = Deno.env.get("CASHFREE_ENV") || "sandbox";
const BASE_URL  = CF_ENV === "production"
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { order_id, order_amount, customer_name, customer_phone, customer_email, return_url } = await req.json();

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
        return_url: return_url || "https://hmehtavw.github.io/vwholesale-app/?order={order_id}",
        notify_url: `https://ndamdnlsuktucqtcbhgp.supabase.co/functions/v1/cashfree-webhook`,
      },
      order_note: `V Wholesale order ${order_id}`,
    };

    const res = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": APP_ID,
        "x-client-secret": SECRET,
      },
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
