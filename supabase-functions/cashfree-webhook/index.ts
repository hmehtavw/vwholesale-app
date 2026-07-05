// Cashfree payment webhook — marks orders as paid when payment succeeds
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    const eventType = body?.type;
    const data = body?.data;

    if (eventType === "PAYMENT_SUCCESS" || eventType === "ORDER_PAID") {
      // Extract VW order_no from Cashfree order_id (format: VW_ORDERID_TIMESTAMP)
      const cfOrderId = data?.order?.order_id || data?.order_id || "";
      const parts = cfOrderId.split("_");
      // order_id is the second part (parts[1])
      const vwOrderId = parts.length >= 3 ? parts[1] : null;

      if (vwOrderId) {
        // Update order payment status
        await sb.from("orders")
          .update({ payment_status: "paid", confirmed_at: new Date().toISOString(), status: "confirmed" })
          .eq("id", vwOrderId);

        // Notify store team
        const { data: order } = await sb.from("orders")
          .select("order_no,customer_name,total,profile_id")
          .eq("id", vwOrderId).single();

        if (order) {
          await sb.from("settings").upsert({
            key: `webhook_order_${vwOrderId}`,
            value: JSON.stringify({ paid: true, at: new Date().toISOString() })
          }).catch(() => {});
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...cors, "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "content-type": "application/json" }
    });
  }
});
