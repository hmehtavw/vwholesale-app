// ── UNIFIED INBOX ──
// One inbox for WhatsApp / Instagram / Facebook / Website.
// WhatsApp is live. The others render as soon as their webhooks deliver —
// no code changes needed here, only permissions + App Review on Meta's side.

const INBOX_CHANNELS = {
  whatsapp:  { icon: '💬', label: 'WhatsApp',  color: '#25D366' },
  instagram: { icon: '📸', label: 'Instagram', color: '#e1306c' },
  facebook:  { icon: '👤', label: 'Facebook',  color: '#1877f2' },
  website:   { icon: '🌐', label: 'Website',   color: '#3b82f6' },
};

let _inboxFilter = 'all';
let _inboxActive = null;   // { channel, contact_id }
let _inboxTimer = null;

function inboxChannelMeta(ch) {
  return INBOX_CHANNELS[ch] || { icon: '❓', label: ch || 'Unknown', color: 'var(--text3)' };
}

function inboxTimeAgo(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd';
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Meta only allows free-form replies within 24h of the customer's last message.
function inboxWindowOpen(lastInboundAt) {
  if (!lastInboundAt) return false;
  return (Date.now() - new Date(lastInboundAt).getTime()) < 24 * 3600 * 1000;
}

async function renderInbox() {
  setContent('<div style="text-align:center;padding:40px;color:var(--text3)">Loading inbox…</div>');
  await inboxDraw();
  // Light polling so new messages appear without a manual refresh
  if (_inboxTimer) clearInterval(_inboxTimer);
  _inboxTimer = setInterval(() => {
    if (document.getElementById('inbox-thread-list')) inboxDraw(true);
    else { clearInterval(_inboxTimer); _inboxTimer = null; }
  }, 20000);
}

async function inboxDraw(quiet) {
  let q = sb.from('inbox_contacts').select('*').order('last_message_at', { ascending: false }).limit(100);
  if (_inboxFilter !== 'all') q = q.eq('channel', _inboxFilter);
  const { data: threads } = await q.then(r => r, () => ({ data: [] }));

  const totalUnread = (threads || []).reduce((a, t) => a + (t.unread_count || 0), 0);

  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
    + '<div><h3 style="font-size:16px;font-weight:900">📥 Inbox'
    + (totalUnread ? ' <span class="badge badge-red" style="margin-left:6px">' + totalUnread + ' unread</span>' : '')
    + '</h3>'
    + '<div style="font-size:12px;color:var(--text3)">All customer messages in one place</div></div>'
    + '<button onclick="inboxDraw()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Refresh</button></div>';

  // Channel filter pills
  html += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
  const pills = [['all', 'All', '📥']].concat(
    Object.keys(INBOX_CHANNELS).map(k => [k, INBOX_CHANNELS[k].label, INBOX_CHANNELS[k].icon])
  );
  pills.forEach(function (p) {
    const on = _inboxFilter === p[0];
    html += '<button onclick="inboxSetFilter(\'' + p[0] + '\')" class="mkt-btn ' + (on ? 'mkt-btn-primary' : 'mkt-btn-ghost') + '" '
      + 'style="font-size:11px;padding:5px 12px">' + p[2] + ' ' + p[1] + '</button>';
  });
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:280px 1fr;gap:12px;align-items:start">';

  // ── Thread list ──
  html += '<div id="inbox-thread-list" class="mkt-card" style="padding:0;max-height:520px;overflow-y:auto">';
  if (!(threads || []).length) {
    html += '<div style="text-align:center;padding:30px 16px;color:var(--text3)">'
      + '<div style="font-size:26px;margin-bottom:6px">📭</div>'
      + '<div style="font-size:12px;font-weight:600;margin-bottom:4px">No messages yet</div>'
      + '<div style="font-size:11px">When a customer messages you, it appears here</div></div>';
  } else {
    window._inboxThreads = threads;
    threads.forEach(function (t, i) {
      const m = inboxChannelMeta(t.channel);
      const active = _inboxActive && _inboxActive.channel === t.channel && _inboxActive.contact_id === t.contact_id;
      const unread = t.unread_count || 0;
      html += '<div onclick="inboxOpen(' + i + ')" style="display:flex;gap:10px;padding:10px 12px;cursor:pointer;'
        + 'border-bottom:1px solid var(--border);' + (active ? 'background:var(--bg3)' : '') + '">'
        + '<div style="font-size:18px;flex-shrink:0">' + m.icon + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:12px;font-weight:' + (unread ? '700' : '600') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + (t.contact_name || '+' + t.contact_id) + '</div>'
        + '<div style="font-size:10px;color:' + m.color + '">' + m.label + '</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
        + '<div style="font-size:10px;color:var(--text3)">' + inboxTimeAgo(t.last_message_at) + '</div>'
        + (unread ? '<div style="background:#ef4444;color:#fff;border-radius:9px;font-size:9px;padding:1px 6px;margin-top:3px;display:inline-block">' + unread + '</div>' : '')
        + '</div></div>';
    });
  }
  html += '</div>';

  // ── Conversation pane ──
  html += '<div id="inbox-conversation" class="mkt-card" style="min-height:520px;display:flex;flex-direction:column">'
    + '<div style="margin:auto;text-align:center;color:var(--text3)">'
    + '<div style="font-size:26px;margin-bottom:6px">💬</div>'
    + '<div style="font-size:12px">Select a conversation</div></div></div>';

  html += '</div>';

  setContent(html);

  // Re-open the active thread after a redraw so polling doesn't close it
  if (_inboxActive) {
    const idx = (threads || []).findIndex(t => t.channel === _inboxActive.channel && t.contact_id === _inboxActive.contact_id);
    if (idx >= 0) await inboxOpen(idx, true);
  }
}

function inboxSetFilter(ch) {
  _inboxFilter = ch;
  inboxDraw();
}

async function inboxOpen(index, keepScroll) {
  const t = (window._inboxThreads || [])[index];
  if (!t) return;
  _inboxActive = { channel: t.channel, contact_id: t.contact_id };

  const pane = document.getElementById('inbox-conversation');
  if (!pane) return;
  if (!keepScroll) pane.innerHTML = '<div style="margin:auto;color:var(--text3);font-size:12px">Loading…</div>';

  const { data: msgs } = await sb.from('inbox_messages').select('*')
    .eq('channel', t.channel).eq('contact_id', t.contact_id)
    .order('created_at', { ascending: true }).limit(200)
    .then(r => r, () => ({ data: [] }));

  // Mark as read
  if (t.unread_count > 0) {
    await sb.from('inbox_messages').update({ is_read: true })
      .eq('channel', t.channel).eq('contact_id', t.contact_id).eq('is_read', false)
      .then(() => {}, () => {});
    await sb.from('inbox_contacts').update({ unread_count: 0 }).eq('id', t.id).then(() => {}, () => {});
  }

  const m = inboxChannelMeta(t.channel);
  const open = inboxWindowOpen(t.last_inbound_at);

  let h = '<div style="display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:10px">'
    + '<span style="font-size:20px">' + m.icon + '</span>'
    + '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + (t.contact_name || '+' + t.contact_id) + '</div>'
    + '<div style="font-size:10px;color:' + m.color + '">' + m.label + ' · +' + t.contact_id + '</div></div>'
    + (t.channel === 'whatsapp'
        ? '<span class="badge ' + (open ? 'badge-green' : 'badge-yellow') + '" style="font-size:9px">'
          + (open ? '24h window open' : 'window closed') + '</span>'
        : '')
    + '</div>';

  // Messages
  h += '<div id="inbox-msgs" style="flex:1;overflow-y:auto;max-height:360px;display:flex;flex-direction:column;gap:6px;padding:4px">';
  if (!(msgs || []).length) {
    h += '<div style="margin:auto;color:var(--text3);font-size:12px">No messages in this thread</div>';
  } else {
    msgs.forEach(function (msg) {
      const out = msg.direction === 'out';
      h += '<div style="display:flex;justify-content:' + (out ? 'flex-end' : 'flex-start') + '">'
        + '<div style="max-width:75%;background:' + (out ? 'rgba(37,211,102,.12)' : 'var(--bg3)') + ';'
        + 'border-radius:10px;padding:8px 10px">'
        + '<div style="font-size:12px;color:var(--text2);line-height:1.6;white-space:pre-wrap">'
        + (msg.message_text || '') + '</div>'
        + '<div style="font-size:9px;color:var(--text3);margin-top:3px;text-align:right">'
        + new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        + (out ? ' · ' + (msg.status || 'sent') : '') + '</div>'
        + '</div></div>';
    });
  }
  h += '</div>';

  // Reply box
  h += '<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px">';
  if (t.channel === 'whatsapp' && !open) {
    h += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:10px;font-size:11px;color:var(--text2)">'
      + '<b style="color:#f59e0b">Free replies unavailable</b><br>'
      + 'Meta only allows free-form replies within 24 hours of the customer\'s last message. '
      + 'This window has closed — send an approved template instead.'
      + '<button onclick="mktNav(\'whatsapp\')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:4px 10px;margin-top:8px">Go to Templates</button>'
      + '</div>';
  } else if (t.channel === 'whatsapp') {
    h += '<div style="display:flex;gap:6px">'
      + '<input id="inbox-reply" class="mkt-form-input" placeholder="Type a reply…" style="flex:1;font-size:12px" '
      + 'onkeydown="if(event.key===\'Enter\')inboxSendReply(this)">'
      + '<button onclick="inboxSendReply(this)" class="mkt-btn mkt-btn-primary" style="font-size:12px;padding:8px 14px">Send</button>'
      + '</div>';
  } else {
    h += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">'
      + 'Replying on ' + m.label + ' is not connected yet</div>';
  }
  h += '</div>';

  pane.innerHTML = h;
  const box = document.getElementById('inbox-msgs');
  if (box) box.scrollTop = box.scrollHeight;
}

async function inboxSendReply(btn) {
  const input = document.getElementById('inbox-reply');
  const message = (input?.value || '').trim();
  if (!message || !_inboxActive) return;
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/meta-whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'send_text', phone: _inboxActive.contact_id, message })
    });
    const d = await res.json();
    if (d.ok) {
      if (input) input.value = '';
      await inboxDraw(true);
    } else {
      showMktToast(d.error || 'Send failed');
    }
  } catch (e) {
    showMktToast(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}
