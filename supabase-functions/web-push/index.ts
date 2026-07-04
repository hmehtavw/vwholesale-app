// Supabase Edge Function: web-push
// Sends Web Push notifications to subscribed users
// Deploy: supabase functions deploy web-push --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:himansu@vwholesale.in";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

// Base64url helpers
function base64UrlToUint8(b64: string): Uint8Array {
  const pad = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function uint8ToBase64Url(arr: Uint8Array): string {
  let bin = "";
  arr.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signJWT(payload: Record<string, unknown>, privateKeyBytes: Uint8Array): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const enc = (obj: unknown) => uint8ToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = enc(header) + "." + enc(payload);

  // Import private key
  const key = await crypto.subtle.importKey(
    "pkcs8", privateKeyBytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned)
  );
  return unsigned + "." + uint8ToBase64Url(new Uint8Array(sig));
}

async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string; icon?: string }
) {
  const audience = new URL(sub.endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const jwt = await signJWT(
    { aud: audience, exp: now + 86400, sub: VAPID_SUBJECT },
    base64UrlToUint8(VAPID_PRIVATE)
  );

  const vapidHeader = `vapid t=${jwt},k=${VAPID_PUBLIC}`;
  const bodyBytes = new TextEncoder().encode(JSON.stringify(payload));

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": vapidHeader,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "TTL": "86400",
    },
    body: bodyBytes,
  }).catch(() => ({ status: 0 }));

  return (res as Response).status;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { profile_id, title, body, url } = await req.json();
    if (!profile_id || !title) return json({ error: "Missing profile_id or title" }, 400);

    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get all subscriptions for this user
    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("profile_id", profile_id);

    if (!subs?.length) return json({ sent: 0, message: "No subscriptions found" });

    let sent = 0;
    const failed: string[] = [];

    for (const sub of subs) {
      const status = await sendPushToSubscription(sub, {
        title,
        body,
        url: url || "https://hmehtavw.github.io/vwholesale-app/",
        icon: "https://hmehtavw.github.io/vwholesale-app/icon-192.png",
      });

      if (status >= 200 && status < 300) {
        sent++;
        // Update last used
        await sb.from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("endpoint", sub.endpoint);
      } else if (status === 410 || status === 404) {
        // Subscription expired — remove it
        await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        failed.push(`expired:${sub.endpoint.slice(-20)}`);
      } else {
        failed.push(`error:${status}`);
      }
    }

    return json({ sent, failed: failed.length, total: subs.length });
  } catch(e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
