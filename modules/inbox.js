/* ── STAFF PORTAL INBOX ──
 * Customer service view of the same inbox_messages / inbox_contacts the
 * marketing portal uses. One source of truth, two surfaces.
 *
 * The reason this exists separately from the marketing portal's inbox:
 * CONTEXT. When someone asks "has my marble been dispatched?", the person
 * answering needs the order, the quotation and the gate pass in front of them.
 * The marketing portal has none of that. This does.
 *
 * Permission: 'inbox' (see PERMISSION_PAGES in core.js)
 */
const VW_INBOX = (function () {

  const CH = {
    whatsapp:  { icon: '💬', label: 'WhatsApp',  color: '#25D366', reply: true },
    website:   { icon: '🌐', label: 'Website',   color: '#3b82f6', reply: true },
    instagram: { icon: '📸', label: 'Instagram', color: '#e1306c', reply: false },
    facebook:  { icon: '👤', label: 'Facebook',  color: '#1877f2', reply: false },
  };

  let filter = 'all';
  let active = null;
  let timer = null;

  function meta(ch) { return CH[ch] || { icon: '❓', label: ch || '?', color: '#888', reply: false }; }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  function ago(ts) {
    if (!ts) return '';
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'now';
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd';
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  // Meta blocks free-form replies more than 24h after the customer's last message.
  function windowOpen(lastInbound) {
    return lastInbound && (Date.now() - new Date(lastInbound).getTime()) < 24 * 3600 * 1000;
  }
  function windowLeft(lastInbound) {
    const ms = 24 * 3600 * 1000 - (Date.now() - new Date(lastInbound).getTime());
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  }

  // Digits only, last 10 — website contacts carry "Name (phone)" in contact_name.
  function phoneOf(t) {
    if (t.channel === 'whatsapp') return (t.contact_id || '').replace(/\D/g, '').slice(-10);
    const m = (t.contact_name || '').match(/(\d{10})/);
    return m ? m[1] : null;
  }

  async function renderInboxPage() {
    const { data: threads } = await sb.from('inbox_contacts').select('*')
      .order('last_message_at', { ascending: false }).limit(200)
      .then(r => r, () => ({ data: [] }));
    window._vwInbox = threads || [];

    const unread = (threads || []).reduce((a, t) => a + (t.unread_count || 0), 0);

    let h = '<div class="page-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
      + '<div><h2 style="margin:0">Inbox' + (unread ? ' <span class="badge" style="background:#ef4444;color:#fff">' + unread + '</span>' : '') + '</h2>'
      + '<div style="font-size:12px;color:var(--text3)">Customer messages from WhatsApp and the website</div></div>'
      + '<button class="btn-sm" onclick="VW_INBOX.refresh()">Refresh</button></div>';

    h += '<div style="display:flex;gap:6px;margin:10px 0;flex-wrap:wrap">';
    [['all', 'All', '📥']].concat(Object.keys(CH).map(k => [k, CH[k].label, CH[k].icon])).forEach(p => {
      const c = p[0] === 'all' ? unread
        : (threads || []).filter(t => t.channel === p[0]).reduce((a, t) => a + (t.unread_count || 0), 0);
      h += '<button class="btn-sm" onclick="VW_INBOX.setFilter(\'' + p[0] + '\')" '
        + 'style="' + (filter === p[0] ? 'background:var(--gold-muted);font-weight:700' : '') + '">'
        + p[2] + ' ' + p[1] + (c ? ' (' + c + ')' : '') + '</button>';
    });
    h += '</div>';

    h += '<div id="vw-inbox-grid" style="display:grid;grid-template-columns:280px 1fr;gap:10px;align-items:start">'
      + '<div id="vw-inbox-list" class="card" style="padding:0;max-height:540px;overflow-y:auto"></div>'
      + '<div id="vw-inbox-conv" class="card" style="height:540px;display:flex;flex-direction:column;padding:10px"></div>'
      + '</div>'
      + '<style>@media(max-width:820px){#vw-inbox-grid{grid-template-columns:1fr}}</style>';

    setTimeout(() => {
      paintList();
      if (active) openThread(active.channel, active.contact_id);
      else emptyPane();
      if (!timer) timer = setInterval(() => {
        if (document.getElementById('vw-inbox-list')) refresh();
        else { clearInterval(timer); timer = null; }
      }, 20000);
    }, 0);

    return h;
  }

  function emptyPane() {
    const p = document.getElementById('vw-inbox-conv');
    if (p) p.innerHTML = '<div style="margin:auto;text-align:center;color:var(--text3)">'
      + '<div style="font-size:28px;margin-bottom:6px">💬</div>'
      + '<div style="font-size:12px">Select a conversation</div></div>';
  }

  function paintList() {
    const el = document.getElementById('vw-inbox-list');
    if (!el) return;
    let list = window._vwInbox || [];
    if (filter !== 'all') list = list.filter(t => t.channel === filter);

    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:30px 14px;color:var(--text3)">'
        + '<div style="font-size:26px;margin-bottom:6px">📭</div>'
        + '<div style="font-size:12px">No messages</div></div>';
      return;
    }
    el.innerHTML = list.map(t => {
      const m = meta(t.channel);
      const on = active && active.channel === t.channel && active.contact_id === t.contact_id;
      const u = t.unread_count || 0;
      return '<div onclick="VW_INBOX.open(\'' + t.channel + '\',\'' + esc(t.contact_id) + '\')" '
        + 'style="display:flex;gap:9px;padding:10px 11px;cursor:pointer;border-bottom:1px solid var(--border);'
        + 'border-left:3px solid ' + (on ? m.color : 'transparent') + ';' + (on ? 'background:var(--bg3)' : '') + '">'
        + '<div style="width:30px;height:30px;border-radius:50%;background:' + m.color + '22;display:flex;'
        + 'align-items:center;justify-content:center;font-size:14px;flex-shrink:0">' + m.icon + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:12px;font-weight:' + (u ? '700' : '600') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + esc(t.contact_name || '+' + t.contact_id) + '</div>'
        + '<div style="font-size:9.5px;color:' + m.color + '">' + m.label + '</div></div>'
        + '<div style="text-align:right"><div style="font-size:9px;color:var(--text3)">' + ago(t.last_message_at) + '</div>'
        + (u ? '<div style="background:#ef4444;color:#fff;border-radius:8px;font-size:9px;padding:0 5px;margin-top:3px;display:inline-block">' + u + '</div>' : '')
        + '</div></div>';
    }).join('');
  }

  // The whole point of this page: who is this, and what have they bought?
  async function loadContext(t) {
    const phone = phoneOf(t);
    if (!phone) return '';
    const [{ data: cust }, { data: quotes }, { data: invs }] = await Promise.all([
      sb.from('customers').select('id,name,phone,type').eq('phone', phone).maybeSingle().then(r => r, () => ({ data: null })),
      sb.from('quotations').select('quotation_no,total,status,created_at').eq('customer_phone', phone)
        .order('created_at', { ascending: false }).limit(3).then(r => r, () => ({ data: [] })),
      sb.from('invoices').select('invoice_no,total,created_at').eq('customer_phone', phone)
        .order('created_at', { ascending: false }).limit(3).then(r => r, () => ({ data: [] })),
    ]);

    let h = '<div style="background:var(--bg3);border-radius:7px;padding:8px 10px;margin-bottom:8px;font-size:11px">';
    if (cust) {
      h += '<div style="font-weight:700;margin-bottom:3px">' + esc(cust.name) + ' · <span style="color:var(--text3)">'
        + esc(cust.type || 'customer') + '</span></div>';
    } else {
      h += '<div style="color:#f59e0b;font-weight:600;margin-bottom:3px">Not in CRM — new lead</div>';
    }
    if ((quotes || []).length) {
      h += '<div style="color:var(--text3);margin-top:4px">Recent quotes: '
        + quotes.map(q => esc(q.quotation_no) + ' (₹' + (q.total || 0) + ')').join(' · ') + '</div>';
    }
    if ((invs || []).length) {
      h += '<div style="color:var(--text3)">Recent bills: '
        + invs.map(i => esc(i.invoice_no) + ' (₹' + (i.total || 0) + ')').join(' · ') + '</div>';
    }
    if (!cust && !(quotes || []).length && !(invs || []).length) {
      h += '<div style="color:var(--text3)">No orders or quotes on ' + esc(phone) + '</div>';
    }
    h += '</div>';
    return h;
  }

  async function openThread(channel, contactId) {
    active = { channel, contact_id: contactId };
    const pane = document.getElementById('vw-inbox-conv');
    if (!pane) return;
    pane.innerHTML = '<div style="margin:auto;color:var(--text3);font-size:12px">Loading…</div>';

    const t = (window._vwInbox || []).find(x => x.channel === channel && x.contact_id === contactId) || active;

    const { data: msgs } = await sb.from('inbox_messages').select('*')
      .eq('channel', channel).eq('contact_id', contactId)
      .order('created_at', { ascending: true }).limit(200)
      .then(r => r, () => ({ data: [] }));

    if ((t.unread_count || 0) > 0) {
      await sb.from('inbox_messages').update({ is_read: true })
        .eq('channel', channel).eq('contact_id', contactId).eq('is_read', false).then(() => {}, () => {});
      if (t.id) await sb.from('inbox_contacts').update({ unread_count: 0 }).eq('id', t.id).then(() => {}, () => {});
      t.unread_count = 0;
      paintList();
    }

    const m = meta(channel);
    const isWa = channel === 'whatsapp';
    const open = isWa ? windowOpen(t.last_inbound_at) : true;
    const ctx = await loadContext(t);

    let h = '<div style="display:flex;align-items:center;gap:9px;padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:8px">'
      + '<div style="width:32px;height:32px;border-radius:50%;background:' + m.color + '22;display:flex;align-items:center;justify-content:center">' + m.icon + '</div>'
      + '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + esc(t.contact_name || '+' + contactId) + '</div>'
      + '<div style="font-size:10px;color:' + m.color + '">' + m.label + '</div></div>'
      + (isWa ? '<span class="badge" style="background:' + (open ? '#22c55e' : '#f59e0b') + ';color:#fff;font-size:9px">'
          + (open ? windowLeft(t.last_inbound_at) + ' left' : 'window closed') + '</span>' : '')
      + '</div>' + ctx;

    h += '<div id="vw-inbox-msgs" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding:4px 2px">';
    if (!(msgs || []).length) {
      h += '<div style="margin:auto;color:var(--text3);font-size:12px">No messages</div>';
    } else {
      msgs.forEach(msg => {
        const out = msg.direction === 'out';
        h += '<div style="display:flex;justify-content:' + (out ? 'flex-end' : 'flex-start') + '">'
          + '<div style="max-width:76%;background:' + (out ? 'rgba(37,211,102,.14)' : 'var(--bg3)') + ';border-radius:9px;padding:6px 9px">';
        if (msg.media_url) {
          const mime = msg.media_mime || '';
          if (mime.indexOf('image') === 0 || msg.media_type === 'image') {
            h += '<img src="' + esc(msg.media_url) + '" style="max-width:200px;border-radius:5px;display:block;cursor:pointer" onclick="window.open(this.src)">';
          } else {
            h += '<a href="' + esc(msg.media_url) + '" target="_blank" style="font-size:11px">📄 '
              + esc(msg.media_filename || 'File') + '</a>';
          }
        }
        if (msg.message_text) {
          h += '<div style="font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word'
            + (msg.media_url ? ';margin-top:4px' : '') + '">' + esc(msg.message_text) + '</div>';
        }
        h += '<div style="font-size:9px;color:var(--text3);text-align:right;margin-top:2px">'
          + new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          + (out ? ' · ' + esc(msg.status || 'sent') : '') + '</div></div></div>';
      });
    }
    h += '</div>';

    h += '<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:6px">';
    if (!m.reply) {
      h += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:6px">'
        + 'Replies on ' + m.label + ' are not connected yet</div>';
    } else if (isWa && !open) {
      h += '<div style="background:rgba(245,158,11,.08);border-radius:6px;padding:8px;font-size:11px">'
        + '<b style="color:#f59e0b">Cannot reply — 24h window closed.</b><br>'
        + 'WhatsApp only allows free replies within 24 hours of the customer\'s last message. '
        + 'Call them on ' + esc(phoneOf(t) || 'their number') + ' instead.</div>';
    } else {
      h += '<div style="display:flex;gap:6px">'
        + '<input id="vw-inbox-reply" class="input" placeholder="Type a reply…" style="flex:1;font-size:12px" '
        + 'onkeydown="if(event.key===\'Enter\')VW_INBOX.send(this)">'
        + '<button class="btn btn-primary btn-sm" onclick="VW_INBOX.send(this)">Send</button></div>';
    }
    h += '</div>';

    pane.innerHTML = h;
    const box = document.getElementById('vw-inbox-msgs');
    if (box) box.scrollTop = box.scrollHeight;
    const ri = document.getElementById('vw-inbox-reply');
    if (ri) ri.focus();
  }

  async function send(btn) {
    const i = document.getElementById('vw-inbox-reply');
    const msg = (i?.value || '').trim();
    if (!msg || !active) return;
    if (btn) btn.disabled = true;
    try {
      if (active.channel === 'website') {
        await sb.from('inbox_messages').insert({
          channel: 'website', direction: 'out', contact_id: active.contact_id,
          message_text: msg, status: 'sent', is_read: true,
        });
        await sb.from('inbox_contacts').update({ last_message_at: new Date().toISOString() })
          .eq('channel', 'website').eq('contact_id', active.contact_id).then(() => {}, () => {});
      } else {
        const r = await fetch(SUPABASE_URL + '/functions/v1/meta-whatsapp', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: 'send_text', phone: active.contact_id, message: msg })
        });
        const d = await r.json();
        if (!d.ok) { showToast(d.error || 'Send failed', 'error'); return; }
      }
      if (i) i.value = '';
      await refresh();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function refresh() {
    const { data } = await sb.from('inbox_contacts').select('*')
      .order('last_message_at', { ascending: false }).limit(200)
      .then(r => r, () => ({ data: [] }));
    window._vwInbox = data || [];
    paintList();
    if (active) await openThread(active.channel, active.contact_id);
  }

  return {
    renderInboxPage,
    open: openThread,
    send,
    refresh,
    setFilter: function (f) { filter = f; active = null; paintList(); emptyPane(); },
  };
})();
