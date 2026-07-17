// meta-inbox-webhook — receives Instagram and Facebook DMs from Meta
// Handles:
//   GET  ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=... → webhook verification
//   POST {entry:[{messaging:[...]}]}                                → inbound messages
//
// On each inbound message:
//   1. Upsert inbox_contacts  (channel, contact_id, contact_name, last_message_at, unread_count)
//   2. Insert inbox_messages  (channel, direction:'in', contact_id, message_text, external_id)
//   3. Upsert customers       (name, source, type:'lead', ig_sender_id / fb_sender_id)
//
// Deploy: supabase functions deploy meta-inbox-webhook --no-verify-jwt
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_INBOX_VERIFY_TOKEN

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN  = Deno.env.get("META_INBOX_VERIFY_TOKEN") || "vwholesale_inbox_2026";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Fetch sender display name from Meta Graph API
async function fetchSenderName(
  senderId: string,
  channel: "instagram" | "facebook",
  pageToken: string
): Promise<string> {
  try {
    const fields = channel === "instagram" ? "name,username" : "name";
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${senderId}?fields=${fields}&access_token=${pageToken}`
    );
    const data = await res.json();
    if (data.name) return data.name;
    if (data.username) return `@${data.username}`;
  } catch (_) { /* name is cosmetic, never block on it */ }
  return channel === "instagram"
    ? `IG User ${senderId.slice(-6)}`
    : `FB User ${senderId.slice(-6)}`;
}

// Get the stored page access token
async function getPageToken(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await sb
    .from("marketing_settings")
    .select("value")
    .eq("key", "META_ACCESS_TOKEN")
    .maybeSingle();
  return data?.value || "";
}

// Core: process one inbound message event
async function processMessage(
  sb: ReturnType<typeof createClient>,
  channel: "instagram" | "facebook",
  senderId: string,
  messageId: string,
  messageText: string,
  timestamp: number,
  pageToken: string
): Promise<void> {
  const now = new Date(timestamp * 1000).toISOString();
  const senderName = await fetchSenderName(senderId, channel, pageToken);

  // 1. Upsert inbox_contacts
  const { data: contact } = await sb
    .from("inbox_contacts")
    .select("id, unread_count")
    .eq("channel", channel)
    .eq("contact_id", senderId)
    .maybeSingle();

  if (contact?.id) {
    await sb
      .from("inbox_contacts")
      .update({
        contact_name: senderName,
        last_message_at: now,
        last_inbound_at: now,
        unread_count: (contact.unread_count || 0) + 1,
      })
      .eq("id", contact.id);
  } else {
    await sb.from("inbox_contacts").insert({
      channel,
      contact_id: senderId,
      contact_name: senderName,
      last_message_at: now,
      last_inbound_at: now,
      unread_count: 1,
      created_at: now,
    });
  }

  // 2. Insert inbox_messages — skip duplicate (idempotent on external_id)
  const { data: dup } = await sb
    .from("inbox_messages")
    .select("id")
    .eq("external_id", messageId)
    .maybeSingle();

  if (!dup) {
    await sb.from("inbox_messages").insert({
      channel,
      direction: "in",
      contact_id: senderId,
      contact_name: senderName,
      message_text: messageText || "(media message)",
      external_id: messageId,
      is_read: false,
      status: "received",
      created_at: now,
    });
  }

  // 3. Create customer lead — only on first message from this sender
  const senderCol = channel === "instagram" ? "ig_sender_id" : "fb_sender_id";
  const sourceVal = channel === "instagram" ? "instagram_dm" : "facebook_dm";

  const { data: existingCust } = await sb
    .from("customers")
    .select("id")
    .eq(senderCol, senderId)
    .maybeSingle();

  if (!existingCust) {
    const preview = messageText?.slice(0, 120) || "(media)";
    await sb.from("customers").insert({
      name: senderName,
      source: sourceVal,
      type: "lead",
      [senderCol]: senderId,
      notes: `Lead via ${channel === "instagram" ? "Instagram" : "Facebook"} DM.\nFirst message: "${preview}"\nAuto-created ${new Date().toLocaleDateString("en-IN")}.`,
      created_at: now,
    }).then(() => {}, (e: unknown) => console.error("Customer insert failed:", e));
  }
}

// Main Deno handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // GET — Meta webhook verification ping
  if (req.method === "GET") {
    const url       = new URL(req.url);
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Meta webhook verified");
      return new Response(challenge, { status: 200, headers: cors });
    }
    console.warn("❌ Webhook verification failed — token mismatch");
    return new Response("Forbidden", { status: 403 });
  }

  // POST — inbound message events
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...cors, "content-type": "application/json" },
      });
    }

    // Respond 200 immediately — Meta retries if we take >20s
    const work = (async () => {
      try {
        const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
        const pageToken = await getPageToken(sb);
        const object  = body?.object as string;
        const entries = (body?.entry as Record<string, unknown>[]) || [];

        for (const entry of entries) {
          const messagingArr =
            (entry?.messaging as Record<string, unknown>[]) ||
            (entry?.changes as Record<string, unknown>[]) || [];

          for (const event of messagingArr) {
            // For "changes" format (some IG webhooks), drill into value
            const ev = (event?.value as Record<string, unknown>) || event;
            const msg = ev?.message as Record<string, unknown>;
            if (!msg || msg?.is_echo) continue;

            const sender    = (ev?.sender as Record<string, string>)?.id
                           || (event?.sender as Record<string, string>)?.id;
            const ts        = (ev?.timestamp as number)
                           || (event?.timestamp as number)
                           || Math.floor(Date.now() / 1000);
            const messageId = (msg?.mid as string) || `${object}_${sender}_${ts}`;
            const text      = (msg?.text as string) || "";

            if (!sender) continue;

            const channel: "instagram" | "facebook" =
              object === "instagram" ? "instagram" : "facebook";

            await processMessage(sb, channel, sender, messageId, text, ts, pageToken);
          }
        }
      } catch (e) {
        console.error("meta-inbox-webhook error:", e);
      }
    })();

    void work;

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
