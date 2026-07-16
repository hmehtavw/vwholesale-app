// ── UNIFIED INBOX ──
// WhatsApp: live, two-way, with media.
// Website:  live via the website-chat edge function.
// Instagram / Facebook: webhook handlers exist, but Meta gates inbound DMs
// behind App Review (pages_messaging / instagram_manage_messages). They render
// as explicitly unavailable rather than pretending to work.

const INBOX_CHANNELS = {
  whatsapp:  { icon: '💬', label: 'WhatsApp',  color: '#25D366' },
  website:   { icon: '🌐', label: 'Website',   color: '#3b82f6' },
  instagram: { icon: '📸', label: 'Instagram', color: '#e1306c', blocked: 'Requires instagram_manage_messages + Meta App Review' },
  facebook:  { icon: '👤', label: 'Facebook',  color: '#1877f2', blocked: 'Requires pages_messaging + Meta App Review' },
};

let _inboxFilter = 'all';
let _inboxActive = null;
let _inboxTimer = null;
let _inboxSearch = '';
let _inboxLastUnread = -1;
let _inboxPendingFile = null;
const _inboxOrigTitle = typeof document !== 'undefined' ? document.title : '';

function inboxMeta(ch) {
  return INBOX_CHANNELS[ch] || { icon: '❓', label: ch || 'Unknown', color: 'var(--text3)' };
}

function inboxEsc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
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

function inboxWindowLeft(lastInboundAt) {
  const ms = 24 * 3600 * 1000 - (Date.now() - new Date(lastInboundAt).getTime());
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function inboxTick(status) {
  if (status === 'read') return '<span style="color:#53bdeb">&#10003;&#10003;</span>';
  if (status === 'delivered') return '<span style="color:var(--text3)">&#10003;&#10003;</span>';
  if (status === 'failed') return '<span style="color:#ef4444">&#10005;</span>';
  return '<span style="color:var(--text3)">&#10003;</span>';
}

function inboxNotify(total) {
  // Chime only on a genuine increase, and never on first paint.
  if (_inboxLastUnread >= 0 && total > _inboxLastUnread) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.05;
      o.start(); o.stop(ctx.currentTime + 0.12);
    } catch (_) { /* autoplay blocked pre-interaction — not worth surfacing */ }
  }
  _inboxLastUnread = total;
  document.title = total > 0 ? '(' + total + ') ' + _inboxOrigTitle : _inboxOrigTitle;
  const nav = document.querySelector('[data-page="inbox"]');
  if (nav) {
    let b = nav.querySelector('.inbox-badge');
    if (total > 0) {
      if (!b) {
        b = document.createElement('span');
        b.className = 'inbox-badge';
        b.style.cssText = 'background:#ef4444;color:#fff;border-radius:9px;font-size:9px;padding:1px 6px;margin-left:6px;font-weight:700';
        nav.appendChild(b);
      }
      b.textContent = total;
    } else if (b) b.remove();
  }
}

async function renderInbox() {
  setContent('<div style="text-align:center;padding:40px;color:var(--text3)">Loading inbox...</div>');
  await inboxDraw();
  if (_inboxTimer) clearInterval(_inboxTimer);
  _inboxTimer = setInterval(function () {
    if (document.getElementById('inbox-thread-list')) inboxRefresh();
    else { clearInterval(_inboxTimer); _inboxTimer = null; }
  }, 15000);
}

// Non-destructive update. The old version called setContent() on every poll,
// which wiped whatever you were typing and made Refresh appear to do nothing
// because the DOM was rebuilt identically.
async function inboxRefresh() {
  const threads = await inboxFetchThreads();
  inboxPaintList(threads);
  if (_inboxActive) await inboxPaintMessages(true);
}

async function inboxFetchThreads() {
  const { data: all } = await sb.from('inbox_contacts').select('*')
    .order('last_message_at', { ascending: false }).limit(300)
    .then(function (r) { return r; }, function () { return { data: [] }; });
  window._inboxAllThreads = all || [];
  inboxNotify((all || []).reduce(function (a, t) { return a + (t.unread_count || 0); }, 0));

  let threads = all || [];
  if (_inboxFilter !== 'all') threads = threads.filter(function (t) { return t.channel === _inboxFilter; });
  if (_inboxSearch) {
    const s = _inboxSearch.toLowerCase();
    threads = threads.filter(function (t) {
      return (t.contact_name || '').toLowerCase().indexOf(s) >= 0 || (t.contact_id || '').indexOf(s) >= 0;
    });
  }
  window._inboxThreads = threads;
  return threads;
}

async function inboxDraw() {
  const threads = await inboxFetchThreads();

  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">'
    + '<div><h3 style="font-size:16px;font-weight:900">Inbox</h3>'
    + '<div style="font-size:12px;color:var(--text3)">All customer conversations in one place</div></div>'
    + '<div style="display:flex;gap:6px;align-items:center">'
    + '<input id="inbox-search" class="mkt-form-input" placeholder="Search name or number..." '
    + 'value="' + inboxEsc(_inboxSearch) + '" style="font-size:11px;width:180px;padding:6px 10px">'
    + '<button onclick="inboxDraw()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Refresh</button>'
    + '</div></div>';

  const counts = {};
  (window._inboxAllThreads || []).forEach(function (t) {
    counts[t.channel] = (counts[t.channel] || 0) + (t.unread_count || 0);
  });

  html += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
  const pills = [['all', 'All', '\uD83D\uDCE5']].concat(
    Object.keys(INBOX_CHANNELS).map(function (k) { return [k, INBOX_CHANNELS[k].label, INBOX_CHANNELS[k].icon]; }));
  pills.forEach(function (p) {
    const on = _inboxFilter === p[0];
    const c = p[0] === 'all'
      ? Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0)
      : (counts[p[0]] || 0);
    const blocked = INBOX_CHANNELS[p[0]] && INBOX_CHANNELS[p[0]].blocked;
    html += '<button onclick="inboxSetFilter(\'' + p[0] + '\')" class="mkt-btn ' + (on ? 'mkt-btn-primary' : 'mkt-btn-ghost') + '" '
      + 'style="font-size:11px;padding:5px 12px' + (blocked ? ';opacity:.5' : '') + '"'
      + (blocked ? ' title="' + inboxEsc(blocked) + '"' : '') + '>'
      + p[2] + ' ' + p[1]
      + (c ? ' <span style="background:#ef4444;color:#fff;border-radius:8px;padding:0 5px;font-size:9px;margin-left:3px">' + c + '</span>' : '')
      + '</button>';
  });
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:300px 1fr;gap:12px;align-items:start">'
    + '<div id="inbox-thread-list" class="mkt-card" style="padding:0;max-height:560px;overflow-y:auto"></div>'
    + '<div id="inbox-conversation" class="mkt-card" style="height:560px;display:flex;flex-direction:column;padding:12px"></div>'
    + '</div>';

  setContent(html);

  const si = document.getElementById('inbox-search');
  if (si) {
    si.oninput = function () {
      _inboxSearch = this.value.trim();
      clearTimeout(window._inboxSearchT);
      window._inboxSearchT = setTimeout(async function () {
        inboxPaintList(await inboxFetchThreads());
      }, 250);
    };
  }

  inboxPaintList(threads);
  if (_inboxActive) await inboxPaintMessages();
  else inboxEmptyPane();
}

function inboxEmptyPane() {
  const p = document.getElementById('inbox-conversation');
  if (p) p.innerHTML = '<div style="margin:auto;text-align:center;color:var(--text3)">'
    + '<div style="font-size:30px;margin-bottom:8px">\uD83D\uDCAC</div>'
    + '<div style="font-size:12px">Select a conversation</div></div>';
}

function inboxPaintList(threads) {
  const el = document.getElementById('inbox-thread-list');
  if (!el) return;
  if (!threads.length) {
    el.innerHTML = '<div style="text-align:center;padding:34px 16px;color:var(--text3)">'
      + '<div style="font-size:28px;margin-bottom:6px">\uD83D\uDCED</div>'
      + '<div style="font-size:12px;font-weight:600;margin-bottom:4px">'
      + (_inboxSearch ? 'No matches' : 'No messages yet') + '</div>'
      + (_inboxSearch ? '' : '<div style="font-size:11px">Customer messages appear here</div>') + '</div>';
    return;
  }
  el.innerHTML = threads.map(function (t, i) {
    const m = inboxMeta(t.channel);
    const active = _inboxActive && _inboxActive.channel === t.channel && _inboxActive.contact_id === t.contact_id;
    const unread = t.unread_count || 0;
    return '<div onclick="inboxOpen(' + i + ')" style="display:flex;gap:10px;padding:11px 12px;cursor:pointer;'
      + 'border-bottom:1px solid var(--border);border-left:3px solid ' + (active ? m.color : 'transparent') + ';'
      + (active ? 'background:var(--bg3)' : (unread ? 'background:rgba(37,211,102,.05)' : '')) + '">'
      + '<div style="width:34px;height:34px;border-radius:50%;background:' + m.color + '22;display:flex;'
      + 'align-items:center;justify-content:center;font-size:15px;flex-shrink:0">' + m.icon + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:12.5px;font-weight:' + (unread ? '700' : '600') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      + inboxEsc(t.contact_name || '+' + t.contact_id) + '</div>'
      + '<div style="font-size:10px;color:' + m.color + '">' + m.label + '</div></div>'
      + '<div style="text-align:right;flex-shrink:0">'
      + '<div style="font-size:9.5px;color:var(--text3)">' + inboxTimeAgo(t.last_message_at) + '</div>'
      + (unread ? '<div style="background:#ef4444;color:#fff;border-radius:9px;font-size:9px;padding:1px 6px;margin-top:4px;display:inline-block;font-weight:700">' + unread + '</div>' : '')
      + '</div></div>';
  }).join('');
}

async function inboxOpen(index) {
  const t = (window._inboxThreads || [])[index];
  if (!t) return;
  _inboxActive = { channel: t.channel, contact_id: t.contact_id, id: t.id };
  _inboxPendingFile = null;
  await inboxPaintMessages();
  inboxPaintList(window._inboxThreads || []);
}

async function inboxPaintMessages(quiet) {
  const pane = document.getElementById('inbox-conversation');
  if (!pane || !_inboxActive) return;

  const t = (window._inboxThreads || []).find(function (x) {
    return x.channel === _inboxActive.channel && x.contact_id === _inboxActive.contact_id;
  }) || _inboxActive;

  const { data: msgs } = await sb.from('inbox_messages').select('*')
    .eq('channel', _inboxActive.channel).eq('contact_id', _inboxActive.contact_id)
    .order('created_at', { ascending: true }).limit(300)
    .then(function (r) { return r; }, function () { return { data: [] }; });

  // Keep an in-progress draft alive across a poll repaint.
  const draft = quiet ? (document.getElementById('inbox-reply') ? document.getElementById('inbox-reply').value : '') : '';
  const box0 = document.getElementById('inbox-msgs');
  const wasAtBottom = !box0 || (box0.scrollHeight - box0.scrollTop - box0.clientHeight < 60);

  if ((t.unread_count || 0) > 0) {
    await sb.from('inbox_messages').update({ is_read: true })
      .eq('channel', t.channel).eq('contact_id', t.contact_id).eq('is_read', false)
      .then(function () {}, function () {});
    if (t.id) await sb.from('inbox_contacts').update({ unread_count: 0 }).eq('id', t.id)
      .then(function () {}, function () {});
    t.unread_count = 0;
  }

  const m = inboxMeta(t.channel);
  const isWa = t.channel === 'whatsapp';
  const open = isWa ? inboxWindowOpen(t.last_inbound_at) : true;
  const left = (isWa && open) ? inboxWindowLeft(t.last_inbound_at) : null;

  let h = '<div style="display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:8px">'
    + '<div style="width:36px;height:36px;border-radius:50%;background:' + m.color + '22;display:flex;align-items:center;justify-content:center;font-size:16px">' + m.icon + '</div>'
    + '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + inboxEsc(t.contact_name || '+' + t.contact_id) + '</div>'
    + '<div style="font-size:10px;color:' + m.color + '">' + m.label + (isWa ? ' \u00B7 +' + inboxEsc(t.contact_id) : '') + '</div></div>'
    + (isWa ? '<span class="badge ' + (open ? 'badge-green' : 'badge-yellow') + '" style="font-size:9px">'
        + (open ? '24h window \u00B7 ' + left + ' left' : 'window closed') + '</span>' : '')
    + '</div>';

  h += '<div id="inbox-msgs" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding:6px 2px">';
  if (!msgs || !msgs.length) {
    h += '<div style="margin:auto;color:var(--text3);font-size:12px">No messages in this thread</div>';
  } else {
    let lastDay = '';
    msgs.forEach(function (msg) {
      const day = new Date(msg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      if (day !== lastDay) {
        lastDay = day;
        h += '<div style="text-align:center;margin:8px 0"><span style="background:var(--bg3);color:var(--text3);'
          + 'font-size:9.5px;padding:3px 10px;border-radius:10px">' + day + '</span></div>';
      }
      const out = msg.direction === 'out';
      h += '<div style="display:flex;justify-content:' + (out ? 'flex-end' : 'flex-start') + '">'
        + '<div style="max-width:72%;background:' + (out ? 'rgba(37,211,102,.14)' : 'var(--bg3)') + ';'
        + 'border-radius:10px;' + (out ? 'border-bottom-right-radius:3px' : 'border-bottom-left-radius:3px') + ';padding:7px 9px">';

      if (msg.media_url) {
        const mime = msg.media_mime || '';
        if (mime.indexOf('image') === 0 || msg.media_type === 'image') {
          h += '<img src="' + inboxEsc(msg.media_url) + '" style="max-width:220px;border-radius:6px;display:block;cursor:pointer" onclick="window.open(this.src,\'_blank\')">';
        } else if (mime.indexOf('video') === 0 || msg.media_type === 'video') {
          h += '<video src="' + inboxEsc(msg.media_url) + '" controls style="max-width:220px;border-radius:6px;display:block"></video>';
        } else if (mime.indexOf('audio') === 0 || msg.media_type === 'audio') {
          h += '<audio src="' + inboxEsc(msg.media_url) + '" controls style="max-width:215px"></audio>';
        } else {
          h += '<a href="' + inboxEsc(msg.media_url) + '" target="_blank" style="display:flex;align-items:center;gap:7px;color:var(--text2);text-decoration:none;padding:3px 0">'
            + '<span style="font-size:20px">\uD83D\uDCC4</span><span style="font-size:11.5px">'
            + inboxEsc(msg.media_filename || 'Download file') + '</span></a>';
        }
      } else if (msg.media_id) {
        h += '<div style="font-size:11px;color:var(--text3);font-style:italic">Media unavailable</div>';
      }

      if (msg.message_text) {
        h += '<div style="font-size:12.5px;color:var(--text2);line-height:1.55;white-space:pre-wrap;word-break:break-word'
          + (msg.media_url ? ';margin-top:5px' : '') + '">' + inboxEsc(msg.message_text) + '</div>';
      }

      h += '<div style="font-size:9px;color:var(--text3);margin-top:3px;text-align:right">'
        + new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        + (out ? ' ' + inboxTick(msg.status) : '') + '</div></div></div>';
    });
  }
  h += '</div>';

  h += '<div style="border-top:1px solid var(--border);padding-top:9px;margin-top:8px">';
  if (m.blocked) {
    h += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:9px;font-size:11px;color:var(--text2)">'
      + '<b style="color:#f59e0b">Replies unavailable on ' + m.label + '</b><br>' + inboxEsc(m.blocked) + '</div>';
  } else if (isWa && !open) {
    h += '<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:12px;font-size:11px">'
      + '<div style="font-weight:700;color:#f59e0b;margin-bottom:4px">⏰ 24-hour window closed</div>'
      + '<div style="color:var(--text2);margin-bottom:10px">Send an approved template to restart the conversation.</div>'
      + '<div style="display:grid;gap:6px" id="inbox-tmpl-list">Loading templates…</div>'
      + '</div>';
  } else {
  } else {
    h += '<div id="inbox-file-chip" style="display:none;align-items:center;gap:7px;background:var(--bg3);border-radius:6px;padding:5px 8px;margin-bottom:6px;font-size:11px"></div>'
      + '<div style="display:flex;gap:6px;align-items:flex-end">';
    if (isWa) {
      h += '<input type="file" id="inbox-file" style="display:none" accept="image/*,application/pdf,video/mp4,.doc,.docx,.xls,.xlsx" onchange="inboxPickFile(this)">'
        + '<button onclick="document.getElementById(\'inbox-file\').click()" class="mkt-btn mkt-btn-ghost" style="font-size:15px;padding:7px 10px" title="Attach image or file">\uD83D\uDCCE</button>'
        + '<button onclick="inboxSendLocation()" class="mkt-btn mkt-btn-ghost" style="font-size:15px;padding:7px 10px" title="Share store location">\uD83D\uDCCD</button>';
    }
    h += '<textarea id="inbox-reply" class="mkt-form-input" rows="1" placeholder="Type a reply..." '
      + 'style="flex:1;font-size:12.5px;resize:none;max-height:90px;padding:8px 10px" '
      + 'oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,90)+\'px\'" '
      + 'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();inboxSendReply(this)}"></textarea>'
      + '<button onclick="inboxSendReply(this)" class="mkt-btn mkt-btn-primary" style="font-size:12px;padding:9px 15px">Send</button></div>'
      + '<div style="font-size:9px;color:var(--text3);margin-top:4px">Enter to send \u00B7 Shift+Enter for a new line</div>';
  }
  h += '</div>';

  pane.innerHTML = h;

  const box = document.getElementById('inbox-msgs');
  if (box && wasAtBottom) box.scrollTop = box.scrollHeight;
  const ri = document.getElementById('inbox-reply');
  if (ri && draft) { ri.value = draft; ri.style.height = Math.min(ri.scrollHeight, 90) + 'px'; }
  if (ri && !quiet) ri.focus();
  if (ri && isWa) inboxBindPaste(ri);
  if (_inboxPendingFile) inboxShowChip();
  // Auto-load templates if 24h window closed
  if (document.getElementById('inbox-tmpl-list')) setTimeout(inboxLoadTemplates, 100);
}

// Paste a screenshot (or any copied image) straight into the reply box.
// Ctrl+Shift+S / PrtScn puts an image on the clipboard as a File with a
// generic name — give it something meaningful before it reaches the customer.
function inboxBindPaste(el) {
  if (el._vwPasteBound) return;
  el._vwPasteBound = true;

  el.addEventListener('paste', function (e) {
    const items = (e.clipboardData || window.clipboardData)?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind !== 'file') continue;
      const f = items[i].getAsFile();
      if (!f || !f.type.startsWith('image/')) continue;
      e.preventDefault();
      if (f.size > 16 * 1024 * 1024) { showMktToast('Image too large - WhatsApp allows up to 16MB'); return; }
      const ext = (f.type.split('/')[1] || 'png').split('+')[0];
      _inboxPendingFile = new File([f], 'screenshot-' + Date.now() + '.' + ext, { type: f.type });
      inboxShowChip();
      showMktToast('Screenshot attached - add a caption or press Send');
      return;
    }
  });

  // Drag and drop onto the conversation pane
  const pane = document.getElementById('inbox-conversation');
  if (pane && !pane._vwDropBound) {
    pane._vwDropBound = true;
    pane.addEventListener('dragover', function (e) {
      e.preventDefault();
      pane.style.outline = '2px dashed var(--gold)';
      pane.style.outlineOffset = '-4px';
    });
    pane.addEventListener('dragleave', function () { pane.style.outline = 'none'; });
    pane.addEventListener('drop', function (e) {
      e.preventDefault();
      pane.style.outline = 'none';
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      if (f.size > 16 * 1024 * 1024) { showMktToast('File too large - WhatsApp allows up to 16MB'); return; }
      _inboxPendingFile = f;
      inboxShowChip();
      showMktToast('Attached ' + f.name);
    });
  }
}

function inboxSetFilter(ch) {
  _inboxFilter = ch;
  _inboxActive = null;
  inboxDraw();
}

function inboxPickFile(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  if (f.size > 16 * 1024 * 1024) {
    showMktToast('File too large - WhatsApp allows up to 16MB');
    input.value = '';
    return;
  }
  _inboxPendingFile = f;
  inboxShowChip();
}

function inboxShowChip() {
  const chip = document.getElementById('inbox-file-chip');
  if (!chip || !_inboxPendingFile) return;
  const kb = Math.round(_inboxPendingFile.size / 1024);
  chip.style.display = 'flex';
  chip.innerHTML = '<span style="font-size:14px">\uD83D\uDCCE</span>'
    + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
    + inboxEsc(_inboxPendingFile.name) + ' <span style="color:var(--text3)">(' + kb + ' KB)</span></span>';
  const x = document.createElement('button');
  x.className = 'mkt-btn mkt-btn-ghost';
  x.style.cssText = 'font-size:10px;padding:2px 7px';
  x.textContent = 'x';
  x.onclick = function () {
    _inboxPendingFile = null;
    chip.style.display = 'none';
    const fi = document.getElementById('inbox-file');
    if (fi) fi.value = '';
  };
  chip.appendChild(x);
}

async function inboxSendReply(btn) {
  const input = document.getElementById('inbox-reply');
  const message = input ? input.value.trim() : '';
  if (!_inboxActive) return;
  if (!message && !_inboxPendingFile) return;
  if (btn) btn.disabled = true;

  try {
    // Website chat: staff replies live in our own table; the widget polls for them.
    if (_inboxActive.channel === 'website') {
      const now = new Date().toISOString();
      await sb.from('inbox_messages').insert({
        channel: 'website', direction: 'out', contact_id: _inboxActive.contact_id,
        message_text: message, status: 'sent', is_read: true,
      });
      await sb.from('inbox_contacts').update({ last_message_at: now })
        .eq('channel', 'website').eq('contact_id', _inboxActive.contact_id)
        .then(function () {}, function () {});
      if (input) { input.value = ''; input.style.height = 'auto'; }
      await inboxRefresh();
      return;
    }

    // WhatsApp media. Sent with the caption attached so it is one message, not two.
    if (_inboxPendingFile) {
      const f = _inboxPendingFile;
      showMktToast('Uploading ' + f.name + '...');
      const path = 'out/' + Date.now() + '-' + f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const up = await sb.storage.from('inbox-media').upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) { showMktToast('Upload failed: ' + up.error.message); return; }
      const pub = sb.storage.from('inbox-media').getPublicUrl(path);

      let kind = 'document';
      if (f.type.indexOf('image') === 0) kind = 'image';
      else if (f.type.indexOf('video') === 0) kind = 'video';
      else if (f.type.indexOf('audio') === 0) kind = 'audio';

      const res = await fetch(MKT_SB_URL + '/functions/v1/meta-whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
        body: JSON.stringify({
          action: 'send_media', phone: _inboxActive.contact_id,
          media_url: pub.data.publicUrl, media_type: kind,
          caption: message || undefined,
          filename: kind === 'document' ? f.name : undefined,
        })
      });
      const d = await res.json();
      if (!d.ok) { showMktToast(d.error || 'Send failed'); return; }

      _inboxPendingFile = null;
      const fi = document.getElementById('inbox-file'); if (fi) fi.value = '';
      const chip = document.getElementById('inbox-file-chip'); if (chip) chip.style.display = 'none';
      if (input) { input.value = ''; input.style.height = 'auto'; }
      await inboxRefresh();
      return;
    }

    const res = await fetch(MKT_SB_URL + '/functions/v1/meta-whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'send_text', phone: _inboxActive.contact_id, message: message })
    });
    const d = await res.json();
    if (d.ok) {
      if (input) { input.value = ''; input.style.height = 'auto'; }
      await inboxRefresh();
    } else {
      const err = d.error || 'Send failed';
      showMktToast(/131047|24 hour|re-?engagement/i.test(err)
        ? '24h window closed - use an approved template instead'
        : err);
    }
  } catch (e) {
    showMktToast(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── SEND STORE LOCATION ──
async function inboxSendLocation() {
  if (!_inboxActive) return;
  // V Wholesale coordinates — NH65, Bhavanipuram, Vijayawada
  const LAT = 16.5065;
  const LNG = 80.6383;
  const NAME = 'V Wholesale';
  const ADDRESS = 'Vijayawada';

  const res = await fetch(MKT_SB_URL + '/functions/v1/meta-whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
    body: JSON.stringify({
      action: 'send_location',
      phone: _inboxActive.contact_id,
      latitude: LAT,
      longitude: LNG,
      name: NAME,
      address: ADDRESS
    })
  }).then(r => r.json()).catch(e => ({ ok: false, error: e.message }));

  if (res.ok) {
    showMktToast('📍 Store location sent!');
    await inboxRefresh();
  } else {
    showMktToast('❌ ' + (res.error || 'Location send failed'));
  }
}
window.inboxSendLocation = inboxSendLocation;

// ── LOAD TEMPLATES IN 24H CLOSED BANNER ──
async function inboxLoadTemplates() {
  const el = document.getElementById('inbox-tmpl-list');
  if (!el || !_inboxActive) return;

  const { data: templates } = await sb.from('whatsapp_templates')
    .select('name, body, var_count')
    .eq('status', 'approved')
    .not('name', 'eq', 'hello_world')
    .order('name')
    .limit(6)
    .then(r => r, () => ({ data: [] }));

  if (!templates?.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:11px">No approved templates found</div>';
    return;
  }

  el.innerHTML = templates.map(t => `
    <div style="background:var(--bg3);border-radius:8px;padding:10px">
      <div style="font-size:11px;font-weight:700;margin-bottom:4px">${t.name.replace(/vwholesale_/,'').replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:8px;line-height:1.5">${t.body?.slice(0,80)}…</div>
      ${t.var_count > 0 ? `
        <div style="display:grid;gap:4px;margin-bottom:8px">
          ${Array.from({length:t.var_count},(_,i)=>`
          <input id="tmpl-var-${t.name}-${i}" class="mkt-form-input"
            placeholder="Variable ${i+1}${i===0?' (auto-fills customer name)':''}"
            style="font-size:11px;padding:6px 8px"
            ${i===0?'value="'+(_inboxActive.contact_name||'Customer').split(' ').find((p,j,a)=>j>0&&a[j-1].length<=2||j===0)||'Customer'+'"':''}>
          `).join('')}
        </div>` : ''}
      <button onclick="inboxSendTemplate('${t.name}',${t.var_count})"
        class="mkt-btn mkt-btn-primary" style="width:100%;font-size:11px;padding:7px">
        Send this template
      </button>
    </div>`).join('');
}
window.inboxLoadTemplates = inboxLoadTemplates;

async function inboxSendTemplate(templateName, varCount) {
  if (!_inboxActive) return;

  // Collect variable values
  const bodyVals = Array.from({ length: varCount }, (_, i) => {
    const el = document.getElementById(`tmpl-var-${templateName}-${i}`);
    return el?.value?.trim() || (i === 0 ? (_inboxActive.contact_name?.split(' ')[1] || 'Customer') : '');
  });

  const btn = document.querySelector(`[onclick="inboxSendTemplate('${templateName}',${varCount})"]`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending…'; }

  const res = await fetch(MKT_SB_URL + '/functions/v1/meta-whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
    body: JSON.stringify({
      action: 'send_template',
      phone: _inboxActive.contact_id,
      template_name: templateName,
      body_values: bodyVals,
      language_code: 'en'
    })
  }).then(r => r.json()).catch(e => ({ ok: false, error: e.message }));

  if (res.ok) {
    showMktToast('✅ Template sent!');
    await inboxRefresh();
  } else {
    showMktToast('❌ ' + (res.error || 'Failed'));
    if (btn) { btn.disabled = false; btn.textContent = 'Send this template'; }
  }
}
window.inboxSendTemplate = inboxSendTemplate;
