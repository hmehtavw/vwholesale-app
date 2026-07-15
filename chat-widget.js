/* ── V WHOLESALE LIVE CHAT ──
 * One shared widget for every public page. Include with:
 *   <script src="/chat-widget.js" defer></script>
 *
 * Lead capture: name + phone required before the first message.
 * Deliberately NO OTP — it gates the moment a customer is asking a question,
 * which is the worst possible place to add friction. A fake number costs one
 * wasted call; a lost lead costs a sale. For a verified number we offer
 * "Chat on WhatsApp" instead, where WhatsApp does the verifying for us.
 *
 * Messages land in the same unified inbox as WhatsApp.
 */
(function () {
  if (window.__vwChatLoaded) return;
  window.__vwChatLoaded = true;

  var FN = 'https://ndamdnlsuktucqtcbhgp.supabase.co/functions/v1/website-chat';
  var WA = '918712697945';
  var VID_KEY = 'vw_chat_vid';
  var ME_KEY = 'vw_chat_me';

  var vid = localStorage.getItem(VID_KEY);
  if (!vid) {
    vid = 'web_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(VID_KEY, vid);
  }
  var me = null;
  try { me = JSON.parse(localStorage.getItem(ME_KEY) || 'null'); } catch (e) { me = null; }

  var open = false, timer = null, seenStaff = 0, msgCache = [];

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function $(id) { return document.getElementById(id); }

  var css = ''
    + '#vw-chat-btn{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;'
    + 'background:#0A1628;color:#C9A84C;border:2px solid #C9A84C;font-size:24px;cursor:pointer;z-index:99998;'
    + 'box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;'
    + 'transition:transform .15s;font-family:Arial,sans-serif}'
    + '#vw-chat-btn:hover{transform:scale(1.06)}'
    + '#vw-chat-dot{position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;'
    + 'background:#ef4444;border:2px solid #fff;display:none}'
    + '#vw-chat-panel{position:fixed;bottom:86px;right:20px;width:342px;max-width:calc(100vw - 32px);'
    + 'height:470px;max-height:calc(100vh - 120px);background:#fff;border-radius:12px;z-index:99999;display:none;'
    + 'flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.28);overflow:hidden;font-family:Arial,sans-serif}'
    + '#vw-chat-head{background:#0A1628;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0}'
    + '#vw-chat-body{flex:1;overflow-y:auto;padding:12px;background:#f6f7f9;display:flex;flex-direction:column;gap:7px}'
    + '#vw-chat-foot{padding:9px;border-top:1px solid #eee;display:flex;gap:6px;background:#fff;flex-shrink:0}'
    + '#vw-chat-input{flex:1;border:1px solid #ddd;border-radius:18px;padding:9px 13px;font-size:13px;outline:none;font-family:inherit}'
    + '#vw-chat-input:focus{border-color:#C9A84C}'
    + '#vw-chat-send{background:#C9A84C;color:#000;border:none;border-radius:18px;padding:9px 16px;'
    + 'font-weight:700;cursor:pointer;font-size:13px;font-family:inherit}'
    + '.vw-b{max-width:80%;padding:8px 11px;border-radius:11px;font-size:13px;line-height:1.5;word-break:break-word}'
    + '.vw-in{background:#fff;align-self:flex-start;border-bottom-left-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.07);color:#222}'
    + '.vw-out{background:#dcf8c6;align-self:flex-end;border-bottom-right-radius:3px;color:#111}'
    + '.vw-f{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:7px;padding:9px 11px;'
    + 'font-size:13px;margin-bottom:8px;outline:none;font-family:inherit}'
    + '.vw-f:focus{border-color:#C9A84C}'
    + '.vw-err{color:#c0392b;font-size:11px;margin:-4px 0 8px}'
    + '@media(max-width:480px){#vw-chat-panel{right:8px;left:8px;width:auto;bottom:78px}}';

  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var wrap = document.createElement('div');
  wrap.innerHTML = ''
    + '<button id="vw-chat-btn" aria-label="Chat with V Wholesale">&#128172;<span id="vw-chat-dot"></span></button>'
    + '<div id="vw-chat-panel" role="dialog" aria-label="Chat with V Wholesale">'
    +   '<div id="vw-chat-head">'
    +     '<div style="width:32px;height:32px;border-radius:50%;background:#C9A84C;display:flex;'
    +       'align-items:center;justify-content:center;font-weight:900;color:#0A1628;font-size:15px">V</div>'
    +     '<div style="flex:1">'
    +       '<div style="color:#fff;font-size:13px;font-weight:700">V Wholesale</div>'
    +       '<div style="color:rgba(255,255,255,.6);font-size:10px">NH65, Bhavanipuram &middot; 8712697930</div>'
    +     '</div>'
    +     '<button id="vw-chat-x" aria-label="Close" style="background:none;border:none;'
    +       'color:rgba(255,255,255,.7);font-size:21px;cursor:pointer;line-height:1;padding:0 4px">&times;</button>'
    +   '</div>'
    +   '<div id="vw-chat-body"></div>'
    +   '<div id="vw-chat-foot" style="display:none">'
    +     '<input id="vw-chat-input" placeholder="Type a message..." autocomplete="off">'
    +     '<button id="vw-chat-send">Send</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(wrap);

  function waLink(pre) {
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(pre || 'Hi, I have a question about');
  }

  // Gate: name + phone. Shown once, then remembered.
  function paintGate(err) {
    var b = $('vw-chat-body');
    $('vw-chat-foot').style.display = 'none';
    b.innerHTML = ''
      + '<div class="vw-b vw-in" style="max-width:100%;margin-bottom:4px">'
      +   'Hello! Welcome to V Wholesale.<br>Tell us who you are and we will reply shortly.'
      + '</div>'
      + '<div style="background:#fff;border-radius:9px;padding:12px;box-shadow:0 1px 2px rgba(0,0,0,.07)">'
      +   '<input id="vw-g-name" class="vw-f" placeholder="Your name" autocomplete="name">'
      +   '<input id="vw-g-phone" class="vw-f" placeholder="Mobile number" inputmode="numeric" autocomplete="tel" maxlength="10">'
      +   (err ? '<div class="vw-err">' + esc(err) + '</div>' : '')
      +   '<button id="vw-g-go" style="width:100%;background:#C9A84C;color:#000;border:none;border-radius:7px;'
      +     'padding:10px;font-weight:700;cursor:pointer;font-size:13px;font-family:inherit">Start chat</button>'
      +   '<div style="text-align:center;margin:10px 0 8px;color:#999;font-size:11px">or</div>'
      +   '<a href="' + waLink() + '" target="_blank" rel="noopener" style="display:block;text-align:center;'
      +     'background:#25D366;color:#fff;border-radius:7px;padding:10px;font-weight:700;'
      +     'text-decoration:none;font-size:13px">Chat on WhatsApp</a>'
      +   '<div style="font-size:10px;color:#999;text-align:center;margin-top:7px;line-height:1.5">'
      +     'We use your number only to reply to this enquiry.</div>'
      + '</div>';

    $('vw-g-go').onclick = submitGate;
    $('vw-g-phone').oninput = function () { this.value = this.value.replace(/\D/g, ''); };
    ['vw-g-name', 'vw-g-phone'].forEach(function (id) {
      $(id).onkeydown = function (e) { if (e.key === 'Enter') submitGate(); };
    });
    $('vw-g-name').focus();
  }

  function submitGate() {
    var name = ($('vw-g-name').value || '').trim();
    var phone = ($('vw-g-phone').value || '').trim();
    if (name.length < 2) return paintGate('Please enter your name');
    if (!/^[6-9]\d{9}$/.test(phone)) return paintGate('Enter a valid 10-digit mobile number');
    me = { name: name, phone: phone };
    localStorage.setItem(ME_KEY, JSON.stringify(me));
    paintChat();
    poll();
  }

  function paintChat() {
    $('vw-chat-foot').style.display = 'flex';
    render(msgCache);
    var i = $('vw-chat-input');
    if (i) i.focus();
  }

  function render(msgs) {
    var b = $('vw-chat-body');
    if (!b || !me) return;
    var h = '';
    if (!msgs.length) {
      h += '<div class="vw-b vw-in">Hi ' + esc(me.name.split(' ')[0])
        + '! How can we help you today?<br><br>You can also call <b>8712697930</b> '
        + 'or <a href="' + waLink() + '" target="_blank" rel="noopener" style="color:#25D366;font-weight:700">'
        + 'chat on WhatsApp</a>.</div>';
    }
    msgs.forEach(function (m) {
      h += '<div class="vw-b ' + (m.direction === 'out' ? 'vw-out' : 'vw-in') + '">' + esc(m.message_text) + '</div>';
    });
    b.innerHTML = h;
    b.scrollTop = b.scrollHeight;
  }

  async function poll() {
    try {
      var r = await fetch(FN, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'poll', visitor_id: vid })
      });
      var d = await r.json();
      if (!d.ok) return;
      msgCache = d.messages || [];
      var staff = msgCache.filter(function (m) { return m.direction === 'out'; }).length;
      if (!open && staff > seenStaff) $('vw-chat-dot').style.display = 'block';
      if (open) {
        seenStaff = staff;
        $('vw-chat-dot').style.display = 'none';
        if (me) render(msgCache);
      }
    } catch (e) { /* offline — this is a nicety, fail quiet */ }
  }

  async function send() {
    var i = $('vw-chat-input');
    var msg = (i.value || '').trim();
    if (!msg || !me) return;
    i.value = '';
    msgCache.push({ direction: 'in', message_text: msg });
    render(msgCache);
    try {
      await fetch(FN, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send', visitor_id: vid, message: msg,
          name: me.name, phone: me.phone, page: location.pathname
        })
      });
    } catch (e) {
      msgCache.push({ direction: 'out', message_text: 'Could not send. Please call 8712697930.' });
      render(msgCache);
    }
    setTimeout(poll, 1200);
  }

  function toggle() {
    open = !open;
    $('vw-chat-panel').style.display = open ? 'flex' : 'none';
    if (!open) return;
    $('vw-chat-dot').style.display = 'none';
    if (me) { paintChat(); poll(); } else paintGate();
    if (!timer) timer = setInterval(poll, 8000);
  }

  $('vw-chat-btn').onclick = toggle;
  $('vw-chat-x').onclick = toggle;
  $('vw-chat-send').onclick = send;
  $('vw-chat-input').onkeydown = function (e) { if (e.key === 'Enter') send(); };

  // Background poll so the unread dot shows even before the panel is opened
  if (me) { setTimeout(poll, 3000); setInterval(poll, 30000); }
})();
