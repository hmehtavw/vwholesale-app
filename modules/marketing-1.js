
// ── OAUTH CALLBACKS — capture at page load before anything else ──
(function() {
  const p = new URLSearchParams(window.location.search);
  const code = p.get('code'), state = p.get('state'), err = p.get('error');

  // GBP OAuth — redirect to dedicated callback page
  if (code && state === 'gbp_oauth') {
    window.location.replace('/gbp-callback/?code=' + encodeURIComponent(code) + '&state=gbp_oauth');
    return;
  }

  // Meta OAuth — capture code for handleMetaOAuth()
  if (state === 'meta_oauth') {
    if (code) {
      window._metaOAuthCode = code;
    } else if (err) {
      window._metaOAuthError = err + (p.get('error_description') ? ': ' + p.get('error_description') : '');
    }
    // Clean URL immediately
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

// ── CONFIG ──
const MKT_SB_URL = 'https://ndamdnlsuktucqtcbhgp.supabase.co';
const MKT_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYW1kbmxzdWt0dWNxdGNiaGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTg1MzgsImV4cCI6MjA5Njk5NDUzOH0.7pGJu4bbNhl4E-4Do24jS9_p6nLUa1eN4JXQSqEF9VU';
const sb = supabase.createClient(MKT_SB_URL, MKT_SB_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'vw-marketing-auth',
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
let mktProfile = null;
let mktAccess = { level: 'none', extra_pages: [] };

// Page bundles per level. Deliberately small at the bottom: an inbox agent
// should see an inbox, not a marketing suite.
const MKT_LEVEL_PAGES = {
  none:      [],
  inbox:     ['inbox'],
  creator:   ['command','content','poster','calendar','greetings','brand','brand-profile','inbox'],
  publisher: ['command','cmo','content','poster','calendar','greetings','approvals','social','gbp','whatsapp',
              'brand','brand-profile','inbox','email','web-push','reviews'],
  ads:       ['command','ads','analytics','segments'],
  analyst:   ['command','analytics','reviews','competitors','segments','audit'],
  manager:   ['command','cmo','campaigns','poster','content','calendar','approvals','greetings','social','gbp',
              'whatsapp','ads','local-seo','website-seo','reviews','analytics','competitors','segments',
              'agents','brand-profile','brand','inbox','email','web-push'],
  admin:     null, // null = everything
};

const MKT_LEVEL_LABELS = {
  none:'No access', inbox:'Inbox agent', creator:'Content creator', publisher:'Publisher',
  ads:'Ads manager', analyst:'Analyst (read-only)', manager:'Marketing manager', admin:'Admin (full)',
};

function mktCan(page) {
  // Failsafe: an admin must never be locked out by a state bug, a stale cached
  // build, or a half-applied migration. profiles.role is the source of truth.
  if (mktProfile && mktProfile.role === 'admin') {
    if (mktAccess.level !== 'admin') {
      mktAccess = { level: 'admin', can_publish: true, can_broadcast: true,
                    can_spend: true, can_manage_keys: true, extra_pages: [] };
    }
    return true;
  }
  if (mktAccess.level === 'admin') return true;
  const base = MKT_LEVEL_PAGES[mktAccess.level] || [];
  return base.indexOf(page) >= 0 || (mktAccess.extra_pages || []).indexOf(page) >= 0;
}
function mktCanPublish()   { return mktAccess.level === 'admin' || !!mktAccess.can_publish; }
function mktCanBroadcast() { return mktAccess.level === 'admin' || !!mktAccess.can_broadcast; }
function mktCanSpend()     { return mktAccess.level === 'admin' || !!mktAccess.can_spend; }
function mktCanKeys()      { return mktAccess.level === 'admin' || !!mktAccess.can_manage_keys; }

// Hide nav the user cannot use, and land them somewhere they can.
function mktApplyAccess() {
  document.querySelectorAll('.mkt-nav-item[data-page]').forEach(function (b) {
    if (!mktCan(b.dataset.page)) b.style.display = 'none';
  });
  document.querySelectorAll('.mkt-nav-section').forEach(function (sec) {
    let n = sec.nextElementSibling, any = false;
    while (n && !n.classList.contains('mkt-nav-section')) {
      if (n.classList && n.classList.contains('mkt-nav-item') && n.style.display !== 'none') any = true;
      n = n.nextElementSibling;
    }
    if (!any) sec.style.display = 'none';
  });
  const badge = document.getElementById('mkt-user-role');
  if (badge) badge.textContent = MKT_LEVEL_LABELS[mktAccess.level] || mktAccess.level;
}
let aiPaused = false;

// ── AUTH ──
async function mktLogin() {
  const phone = (document.getElementById('mkt-phone').value || '').trim();
  const pin   = (document.getElementById('mkt-pin').value   || '').trim();
  const errEl = document.getElementById('mkt-login-err');
  const btn   = document.getElementById('mkt-login-btn');
  errEl.style.display = 'none';

  if (phone.length < 10) { showErr('Enter valid 10-digit phone number'); return; }
  if (pin.length < 4)    { showErr('Enter your PIN'); return; }

  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }

  function showErr(msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
    if (btn) { btn.textContent = 'Sign In to Marketing →'; btn.disabled = false; }
  }

  try {
    const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
      email: phone + '@vwholesale.app',
      password: pin
    });
    if (authErr) { showErr('Wrong phone or PIN: ' + authErr.message); return; }

    const uid = auth?.user?.id;
    if (!uid) { showErr('No user returned — try again'); return; }

    const profRes = await sb.from('profiles').select('*').eq('id', uid).single().then(r=>r, ()=>({data:null,error:'not found'}));
    const profile = profRes?.data;

    if (!profile) {
      showErr('Profile not found for this login. Sign in to the Staff Portal first. '
        + '(uid ' + String(uid).slice(0, 8) + ')');
      return;
    }

    // Access reuses the staff portal's permission system (profiles.permissions),
    // which already has a 'marketing' key and an admin UI. An earlier version of
    // this used a separate marketing_access table — that was duplication and is gone.
    const perms = Array.isArray(profile.permissions) ? profile.permissions : [];
    const isAdmin = profile.role === 'admin';
    const hasMarketing = isAdmin || perms.indexOf('marketing') >= 0;

    if (!hasMarketing) {
      await sb.auth.signOut();
      // Say WHY, not just no — otherwise diagnosing a lockout means reading source.
      showErr('No marketing access for ' + (profile.name || 'this user')
        + '. Role: "' + (profile.role || 'none') + '", status: "' + (profile.status || '?') + '"'
        + ', permissions: [' + perms.join(', ') + ']. '
        + 'An admin can grant "Marketing" in Staff Portal -> Settings -> Permissions.');
      return;
    }

    // Admins get keys and spend. Everyone else gets the work, not the credentials.
    mktAccess = isAdmin
      ? { level: 'admin', can_publish: true, can_broadcast: true, can_spend: true, can_manage_keys: true, extra_pages: [] }
      : { level: 'manager', can_publish: true, can_broadcast: false, can_spend: false, can_manage_keys: false, extra_pages: [] };

    mktProfile = profile;
    showMktApp();

  } catch(e) {
    showErr('Error: ' + (e.message || String(e)));
  }
}


function showMktApp() {
  document.getElementById('mkt-login').style.display = 'none';
  document.getElementById('mkt-layout').style.display = 'flex';
  // Repair access BEFORE painting the label — otherwise an admin whose
  // mktAccess was still at its default reads "No access" while having full access.
  if (mktProfile && mktProfile.role === 'admin' && mktAccess.level !== 'admin') {
    mktAccess = { level: 'admin', can_publish: true, can_broadcast: true,
                  can_spend: true, can_manage_keys: true, extra_pages: [] };
  }
  mktApplyAccess();
  const infoEl = document.getElementById('mkt-user-info');
  if (infoEl) infoEl.textContent = (mktProfile?.name||'') + ' · ' + (MKT_LEVEL_LABELS[mktAccess.level] || mktAccess.level);
  startClock();
  loadAIPauseStatus();


  // Handle OAuth callbacks
  const _urlCheck = new URLSearchParams(window.location.search);
  if (_urlCheck.get('gbp') === 'connected') {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => showMktToast('✅ Google Business Profile connected!'), 500);
    mktNav('gbp'); return;
  }
  if (window._metaOAuthCode) {
    const code = window._metaOAuthCode;
    window._metaOAuthCode = null;
    setTimeout(() => handleMetaOAuth(code), 500);
    mktNav('integrations'); return;
  }
  if (window._metaOAuthError) {
    setTimeout(() => showMktToast('❌ Meta connection failed: ' + window._metaOAuthError), 500);
    window._metaOAuthError = null;
  }
  mktNav('command');
  // Auto-run trend scout if scheduled
  setTimeout(checkAndRunTrendScout, 3000);
  // Auto-sync Instagram ID silently on every load
  setTimeout(autoSyncInstagramId, 5000);
  // Check Meta token expiry and auto-refresh if needed
  setTimeout(checkAndRefreshMetaToken, 8000);
}

function startClock() {
  const el = document.getElementById('mkt-time');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', hour12:true});
  };
  tick();
  setInterval(tick, 30000);
}

async function mktSignOut() {
  await sb.auth.signOut();
  window.location.reload();
}


// ── NAVIGATION ──
const PAGE_TITLES = {
  command: 'Command Centre', cmo: 'AI CMO', bi: 'Business Intelligence', campaigns: 'Campaigns',
  content: 'Content Studio', calendar: 'Content Calendar', approvals: 'Approvals',
  social: 'Social Media', gbp: 'Google Business Profile', whatsapp: 'WhatsApp',
  ads: 'Advertising', 'local-seo': 'Local SEO', 'website-seo': 'Website SEO',
  reviews: 'Reviews & Reputation', analytics: 'Analytics', competitors: 'Competitor Intelligence',
  segments: 'Customer Segments', greetings: 'Greetings Engine', agents: 'AI Agents', brand: 'Brand Knowledge',
  integrations: 'Integrations', audit: 'Audit Logs', settings: 'Settings'
};

function mktNav(page) {
  document.querySelectorAll('.mkt-nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if (!mktCan(page)) {
    setContent('<div style="text-align:center;padding:60px 20px">'
      + '<div style="font-size:34px;margin-bottom:10px">\uD83D\uDD12</div>'
      + '<div style="font-size:15px;font-weight:700;margin-bottom:6px">No access to this page</div>'
      + '<div style="font-size:12px;color:var(--text3)">Your level: <b>'
      + (MKT_LEVEL_LABELS[mktAccess.level] || mktAccess.level) + '</b><br>Ask an admin if you need this.</div></div>');
    document.getElementById('mkt-page-title').textContent = 'Restricted';
    return;
  }
  document.getElementById('mkt-page-title').textContent = PAGE_TITLES[page] || page;
  const renderers = {
    poster: renderPosterStudio, command: renderCommandCentre, cmo: renderAICMO,
    campaigns: renderCampaigns, content: renderContentStudio, calendar: renderCalendar,
    approvals: renderApprovals, social: renderSocial, gbp: renderGBP, whatsapp: renderWhatsApp,
    ads: renderAds, 'local-seo': renderLocalSEO, 'website-seo': renderWebsiteSEO,
    reviews: renderReviews, analytics: renderAnalytics, competitors: renderCompetitors,
    segments: renderSegments, greetings: renderGreetings, agents: renderAgents,
    'brand-profile': renderBrandProfile, brand: renderBrand,
    integrations: renderIntegrations, audit: renderAudit, settings: renderSettings,
    'web-push': renderWebPush, 'email': renderEmail
  };
  // Pages defined in separate JS files — looked up at call time
  const externalRenderers = { inbox: 'renderInbox', bi: 'renderBI' };
  if (externalRenderers[page]) {
    const fn = window[externalRenderers[page]];
    if (typeof fn === 'function') { fn(); return; }
  }
  if (renderers[page]) renderers[page]();
  else renderComingSoon(PAGE_TITLES[page] || page);
}

function setContent(html) { document.getElementById('mkt-content').innerHTML = html; }

function showMktToast(msg, duration = 3000) {
  let toast = document.getElementById('mkt-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mkt-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap;max-width:90vw';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, duration);
}

function renderComingSoon(title) {
  setContent(`<div class="mkt-empty">
    <div class="mkt-empty-icon">🚧</div>
    <div class="mkt-empty-title">${title}</div>
    <div style="font-size:12px;margin-top:4px">Coming in next build</div>
  </div>`);
}

// ── COMMAND CENTRE ──
async function generateReelScript(topic, event) {
  if (event) event.stopPropagation();
  if (!topic) { showMktToast('No topic for this reel'); return; }

  const btn = event?.target;
  if (btn) { btn.textContent = '⏳ Writing…'; btn.disabled = true; }
  showMktToast('🎬 Generating reel script for: ' + topic);

  try {
    const { data: bp } = await sb.from('brand_profile').select('*').limit(1).maybeSingle().then(r=>r,()=>({data:null}));

    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Reel Script Generator',
        prompt: `Write a complete Instagram/YouTube Shorts reel script for V Wholesale, Vijayawada.

TOPIC: ${topic}
STORE: V Wholesale | Visit V Wholesale| 8712697930

Return JSON:
{
  "duration": "30-45 seconds",
  "hook": "First 3 seconds — what to say/show to stop the scroll",
  "shots": [
    {"scene": 1, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 5},
    {"scene": 2, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 8},
    {"scene": 3, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 8},
    {"scene": 4, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 7},
    {"scene": 5, "what_to_film": "...", "onscreen_text": "...", "duration_sec": 7}
  ],
  "voiceover": "Optional spoken script that matches the shots",
  "telugu_hook": "The hook translated to Telugu for Telugu audience version",
  "caption": "Instagram caption with hook + hashtags",
  "hashtags": ["#Vijayawada","#HomeRenovation","...12 more"],
  "best_time_to_post": "e.g. Tuesday 7pm"
}`,
        context: { topic }
      })
    });
    const data = await res.json();
    const script = data.output;
    if (!script) throw new Error('Script generation failed');

    // Show in a modal overlay
    const shots = (script.shots||[]).map((sh, i) =>
      `<div style="padding:8px;background:var(--bg3);border-radius:6px;margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:var(--gold)">Scene ${i+1} · ${sh.duration_sec||'?'}s</div>
        <div style="font-size:11px;margin-top:3px"><b>📹 Film:</b> ${sh.what_to_film}</div>
        <div style="font-size:11px;margin-top:2px"><b>📝 Text:</b> ${sh.onscreen_text}</div>
      </div>`).join('');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;overflow-y:auto;padding:20px';
    ov.innerHTML = `
      <div style="max-width:500px;margin:0 auto;background:var(--bg2);border-radius:12px;padding:20px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="font-size:15px;font-weight:900">🎬 Reel Script: ${topic}</div>
          <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
        </div>
        <div style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:10px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--gold)">⚡ HOOK (first 3 seconds)</div>
          <div style="font-size:13px;margin-top:4px">${script.hook||''}</div>
          ${script.telugu_hook ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">తెలుగు: ${script.telugu_hook}</div>` : ''}
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">SHOT LIST · ${script.duration||'30-45 seconds'}</div>
        ${shots}
        ${script.voiceover ? `<div style="margin-top:10px;padding:8px;background:var(--bg3);border-radius:6px"><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:4px">🎙️ VOICEOVER</div><div style="font-size:11px;line-height:1.8">${script.voiceover}</div></div>` : ''}
        <div style="margin-top:10px;padding:8px;background:var(--bg3);border-radius:6px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:4px">📌 CAPTION + HASHTAGS</div>
          <div style="font-size:11px;line-height:1.8">${script.caption||''}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(script)},null,2)).then(()=>showMktToast('📋 Script copied!'))" class="mkt-btn mkt-btn-ghost" style="flex:1;font-size:11px;padding:8px">📋 Copy All</button>
          <button onclick="this.closest('[style*=fixed]').remove()" class="mkt-btn mkt-btn-primary" style="flex:1;font-size:11px;padding:8px">✓ Got It</button>
        </div>
        ${script.best_time_to_post ? `<div style="font-size:10px;color:var(--text3);text-align:center;margin-top:8px">Best time to post: ${script.best_time_to_post}</div>` : ''}
      </div>`;
    document.body.appendChild(ov);
    showMktToast('✅ Reel script ready!');
  } catch(e) {
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '🎬 Get Script'; btn.disabled = false; }
  }
}


async function renderApprovals() {
  const { data: approvals } = await sb.from('marketing_approvals').select('*').order('created_at',{ascending:false}).then(r=>r,()=>({data:[]}));
  const pending = (approvals||[]).filter(a=>a.status==='pending');
  const done = (approvals||[]).filter(a=>a.status!=='pending');

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Approvals Queue</h3>
    <div style="font-size:12px;color:var(--text3)">Review and approve AI-recommended actions before execution</div>
  </div>

  ${pending.length === 0 ? `
  <div class="mkt-card">
    <div class="mkt-empty">
      <div class="mkt-empty-icon">✅</div>
      <div class="mkt-empty-title">All Clear</div>
      <div style="font-size:12px;color:var(--text3)">No pending approvals. Run the AI CMO to generate recommendations.</div>
      <button class="mkt-btn mkt-btn-primary" onclick="mktNav('cmo');setTimeout(()=>generateCMOBrief(),400)" style="margin-top:16px">🧠 Run AI CMO</button>
    </div>
  </div>` : `
  <div style="display:grid;gap:10px">
    ${pending.map(a => `
    <div class="mkt-card" style="border-left:4px solid var(--gold)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:14px;font-weight:800">${a.title}</div>
          <div style="font-size:11px;color:var(--text3)">${a.agent_name||'AI'} · ${new Date(a.created_at).toLocaleDateString('en-IN')}</div>
        </div>
        <span class="badge badge-gold">pending</span>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">${a.description}</div>
      ${a.estimated_cost > 0 ? `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">Estimated cost: ₹${a.estimated_cost}</div>` : ''}
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" onclick="approveAction(${a.id})">✅ Approve</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="rejectAction(${a.id})" style="color:var(--red)">❌ Reject</button>
      </div>
    </div>`).join('')}
  </div>`}

  ${done.length > 0 ? `
  <div class="mkt-card" style="margin-top:12px">
    <div class="mkt-card-title">History</div>
    <table class="mkt-table">
      <tr><th>Action</th><th>Status</th><th>Date</th></tr>
      ${done.map(a=>`<tr>
        <td style="font-weight:700">${a.title}</td>
        <td><span class="badge ${a.status==='approved'?'badge-green':'badge-red'}">${a.status}</span></td>
        <td style="color:var(--text3)">${new Date(a.created_at).toLocaleDateString('en-IN')}</td>
      </tr>`).join('')}
    </table>
  </div>` : ''}
  `);
}

async function renderGBP() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading…</div>`);

  const { data: conn } = await sb.from('social_connections').select('*').eq('platform','gbp').single().then(r=>r,()=>({data:null}));
  const isConnected = conn?.status === 'connected' && conn?.access_token_set;

  // Handle OAuth callback from URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('gbp') === 'connected') {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => showMktToast('✅ Google Business Profile connected!'), 300);
  }

  // Load previous posts for learning context
  const { data: prevPosts } = await sb.from('marketing_audit_logs')
    .select('details,created_at').eq('action','gbp_post_created')
    .order('created_at',{ascending:false}).limit(5)
    .then(r=>r,()=>({data:[]}));

  // Get next topic from content calendar
  const today = new Date().toISOString().split('T')[0];
  const { data: calItem } = await sb.from('content_calendar')
    .select('topic,content_type,notes,cal_date')
    .gte('cal_date', today)
    .in('status',['planned','scripted'])
    .order('cal_date',{ascending:true})
    .limit(1).maybeSingle()
    .then(r=>r,()=>({data:null}));

  const suggestedTopic = calItem?.topic || '';

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📍 Google Business Profile</h3>
      <div style="font-size:12px;color:var(--text3)">Post updates and offers to Google Maps</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span class="badge ${isConnected?'badge-green':'badge-gray'}">${isConnected?'✅ Connected':'Not Connected'}</span>
      ${isConnected ? '<button onclick="disconnectGBP()" style="background:none;border:none;color:var(--text3);font-size:10px;cursor:pointer">Disconnect</button>' : ''}
    </div>
  </div>

  ${!isConnected ? `
  <div class="mkt-card" style="text-align:center;padding:32px;margin-bottom:16px">
    <div style="font-size:40px;margin-bottom:12px">📍</div>
    <div style="font-size:14px;font-weight:700;margin-bottom:6px">Connect Google Business Profile</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:20px">Connect once to enable GBP posting from this portal</div>
    <button class="mkt-btn mkt-btn-primary" onclick="connectGBP()" style="padding:12px 28px;font-size:14px;font-weight:700">🔗 Connect GBP</button>
  </div>` : ''}

  <!-- MAIN POST CREATOR — Clean, minimal UI -->
  <div class="mkt-card" style="margin-bottom:14px">

    <!-- Topic selector -->
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Post Topic</div>
      <div style="display:flex;gap:8px">
        <input id="gbp-topic" class="mkt-form-input" style="flex:1" placeholder="What is this post about?"
          value="${suggestedTopic}" oninput="gbpTopicChanged()">
        <select id="gbp-post-type" class="mkt-form-select" style="width:140px">
          <option value="standard">📢 Update</option>
          <option value="offer">💰 Offer</option>
          <option value="event">📅 Event</option>
        </select>
      </div>
      ${calItem ? `<div style="font-size:11px;color:var(--gold);margin-top:4px">📅 From your content calendar: ${calItem.cal_date} — ${calItem.content_type||'post'}</div>` : ''}
    </div>

    <!-- ONE button — everything happens automatically -->
    <button id="gbp-create-btn" class="mkt-btn mkt-btn-primary" onclick="createGBPPost()" 
      style="width:100%;padding:16px;font-size:15px;font-weight:900;letter-spacing:.3px">
      ✨ Create GBP Post
    </button>

    <!-- Progress indicator — shows during AI processing -->
    <div id="gbp-progress" style="display:none;margin-top:16px">
      <div style="display:grid;gap:6px" id="gbp-steps"></div>
    </div>
  </div>

  <!-- OUTPUT — appears after creation -->
  <div id="gbp-output" style="display:none">

    <!-- Content preview -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Post Content</div>
        <button onclick="regenerateGBPContent()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Regenerate</button>
      </div>
      <textarea id="gbp-text" class="mkt-form-input" rows="6" style="font-size:13px;line-height:1.7;resize:vertical"></textarea>
    </div>

    <!-- Image section — 2 variations -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Post Image</div>
        <div style="display:flex;gap:6px">
          <button onclick="regenerateGBPImage()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 New Images</button>
          <label class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px;cursor:pointer;margin:0">
            📁 Upload
            <input type="file" id="gbp-image-upload" accept="image/jpeg,image/png,image/webp" onchange="handleGBPImageUpload(this)" style="display:none">
          </label>
        </div>
      </div>

      <!-- Image variations grid -->
      <div id="gbp-variations" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"></div>
      <input type="hidden" id="gbp-image-url">

      <!-- Selected image preview -->
      <div id="gbp-selected-preview" style="display:none;border-radius:8px;overflow:hidden;border:2px solid var(--gold)">
        <img id="gbp-preview-img" src="" style="width:100%;max-height:240px;object-fit:cover;display:block;cursor:zoom-in" onclick="openGBPImageFullscreen(this.src)">
        <div style="background:rgba(0,0,0,.6);padding:6px 10px;display:flex;justify-content:space-between;align-items:center">
          <span id="gbp-preview-label" style="font-size:10px;color:#fff"></span>
          <button onclick="openGBPImageFullscreen(document.getElementById('gbp-preview-img').src)" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">⛶ Fullscreen</button>
        </div>
      </div>
    </div>

    <!-- Verify + Publish -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div id="gbp-verify-result" style="display:none;margin-bottom:12px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="mkt-btn mkt-btn-ghost" onclick="verifyGBPPost()" style="padding:12px;font-weight:700">🔍 Verify Content</button>
        <button class="mkt-btn mkt-btn-primary" onclick="publishGBPPost()" style="padding:12px;font-weight:700">🚀 Publish to GBP</button>
      </div>
    </div>
  </div>

  <!-- Post history -->
  <div class="mkt-card">
    <div class="mkt-card-title">📋 Recent GBP Posts</div>
    <div id="gbp-history">
      ${(prevPosts||[]).length ? (prevPosts||[]).map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:18px">📍</div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600">${p.details?.post_text||p.details?.topic||'GBP Post'}</div>
            <div style="font-size:10px;color:var(--text3)">${new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
          <span class="badge badge-green">Posted</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px">No posts yet</div>'}
    </div>
  </div>`);
}

// Track step progress
async function renderAgents() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading agents…</div>`);

  const [
    { data: notifications },
    { data: agentRuns }
  ] = await Promise.all([
    sb.from('agent_notifications')
      .select('*')
      .or('resolved.eq.false,resolved.is.null')
      .order('created_at',{ascending:false})
      .limit(30)
      .then(r=>r,()=>({data:[]})),
    sb.from('ai_agent_runs').select('*').order('created_at',{ascending:false}).limit(5).then(r=>r,()=>({data:[]}))
  ]);

  const pending = (notifications||[]).filter(n => n.response === 'pending');
  const recent = (notifications||[]).filter(n => n.response !== 'pending').slice(0,8);

  const typeIcon = {
    trend_alert:'🔥',
    approval_request:'✅',
    monthly_review:'📊',
    quarterly_review:'📈',
    performance_report:'📉'
  };
  const typeLabel = {
    trend_alert:'Trend Alert',
    approval_request:'Content Ready for Approval',
    monthly_review:'Monthly Review',
    quarterly_review:'Quarterly Review',
    performance_report:'Performance Report'
  };

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">🤖 AI Agents</h3>
      <div style="font-size:12px;color:var(--text3)">Agents create content automatically — you approve before publishing</div>
    </div>
    ${pending.length
      ? `<span class="badge badge-red">${pending.length} need approval</span>`
      : '<span class="badge badge-green">All clear</span>'}
  </div>

  <!-- HOW IT WORKS -->
  <div class="mkt-card" style="margin-bottom:14px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2)">
    <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">⚡ How automation works</div>
    <div style="display:flex;gap:0;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--text2)">
      ${['📅 Calendar plans the day','→','🤖 Agent auto-creates content for all channels','→','📬 Notification sent here','→','✅ You approve','→','🚀 Published everywhere'].map(s=>
        s==='→'
          ? `<span style="color:var(--text3);margin:0 6px">→</span>`
          : `<span style="background:var(--bg3);border-radius:6px;padding:3px 8px;margin:2px">${s}</span>`
      ).join('')}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">
      📅 Go to Calendar → click <b>⚡ Auto-Create</b> on any planned day → content appears here for your approval
    </div>
  </div>

  <!-- AGENT CARDS -->
  <div style="display:grid;gap:8px;margin-bottom:16px">
    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">🔥</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Trend Scout</div>
          <div style="font-size:11px;color:var(--text3)">Scans home building trends for Vijayawada · alerts when opportunity found</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">Last run: ${agentRuns?.find(r=>r.agent_name==='Trend Scout')?.created_at
            ? new Date(agentRuns.find(r=>r.agent_name==='Trend Scout').created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
            : 'Never'}</div>
        </div>
        <button onclick="runTrendScout(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">▶ Run</button>
      </div>
      <div id="trend-scout-result"></div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">📅</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Calendar Auto-Creator</div>
          <div style="font-size:11px;color:var(--text3)">Opens calendar → click ⚡ Auto-Create on any day → content created for all channels automatically</div>
        </div>
        <button onclick="mktNav('calendar')" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Open Calendar</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">📊</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Review Agent</div>
          <div style="font-size:11px;color:var(--text3)">Monthly + quarterly performance analysis with AI recommendations</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="generateReview('monthly',this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 10px">Monthly</button>
          <button onclick="generateReview('quarterly',this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 10px">Quarterly</button>
        </div>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">💬</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">WhatsApp Content Prep</div>
          <div style="font-size:11px;color:var(--text3)">Generate broadcast messages ready to send via Interakt</div>
        </div>
        <button onclick="generateWhatsAppBroadcast()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Generate</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">⭐</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Review Reply Generator</div>
          <div style="font-size:11px;color:var(--text3)">Auto-generate professional replies to Google reviews</div>
        </div>
        <button onclick="generateReviewReply()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Generate</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">👷</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Contractor Club Content Kit</div>
          <div style="font-size:11px;color:var(--text3)">Generate ready-made posts for contractors to share on WhatsApp/Instagram</div>
        </div>
        <button onclick="generateContractorContent()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Generate</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">🚀</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Bulk Generate This Month</div>
          <div style="font-size:11px;color:var(--text3)">Generate content for all planned calendar days in one click</div>
        </div>
        <button onclick="bulkGenerateMonth()" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">🚀 Bulk Run</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">⭐</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Post-Purchase Review Requests</div>
          <div style="font-size:11px;color:var(--text3)">Auto-send review requests to recent customers via Email + WhatsApp</div>
        </div>
        <button onclick="runReviewRequestAgent(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">▶️ Run Now</button>
      </div>
      <div id="review-request-output" style="margin-top:10px"></div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">📊</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">Campaign ROI Tracker</div>
          <div style="font-size:11px;color:var(--text3)">Link marketing campaigns to billing data to track real revenue</div>
        </div>
        <button onclick="mktNav('analytics')" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">View →</button>
      </div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">📝</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">SEO Blog Generator</div>
          <div style="font-size:11px;color:var(--text3)">Auto-generate SEO blog posts targeting Vijayawada keywords for vwholesale.in</div>
        </div>
        <button onclick="generateSEOBlogPost(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Generate</button>
      </div>
      <div id="seo-blog-output" style="margin-top:10px"></div>
    </div>

    <div class="mkt-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:26px">▶️</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">YouTube SEO Optimizer</div>
          <div style="font-size:11px;color:var(--text3)">Generate optimized titles, descriptions and tags for YouTube videos</div>
        </div>
        <button onclick="generateYouTubeSEO(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Optimize</button>
      </div>
      <div id="yt-seo-output" style="margin-top:10px"></div>
    </div>
  </div>

  <!-- PENDING APPROVALS -->
  ${pending.length ? `
  <div style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px">
    📬 Waiting for your approval
    <span class="badge badge-red">${pending.length}</span>
  </div>
  <div style="display:grid;gap:10px;margin-bottom:20px">
    ${pending.map(n => `
    <div class="mkt-card" style="border-left:3px solid ${n.notification_type==='trend_alert'?'#f59e0b':'var(--gold)'}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="font-size:24px;flex-shrink:0">${typeIcon[n.notification_type]||'🔔'}</div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3)">${typeLabel[n.notification_type]||n.notification_type}</div>
            <div style="font-size:10px;color:var(--text3)">${new Date(n.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <div style="font-size:12px;color:var(--text1);line-height:1.8;white-space:pre-wrap;margin-bottom:10px;max-height:120px;overflow-y:auto">${n.message}</div>
          <div style="display:flex;gap:8px">
            <button onclick="respondNotification('${n.id}','yes',this)" class="mkt-btn mkt-btn-primary" style="font-size:12px;padding:8px 16px">✅ Approve & Publish</button>
            <button onclick="respondNotification('${n.id}','no',this)" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:8px 16px">✏️ Edit First</button>
            <button onclick="respondNotification('${n.id}','dismiss',this)" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--text3)">✗ Skip</button>
          </div>
        </div>
      </div>
    </div>`).join('')}
  </div>` : `
  <div class="mkt-card" style="text-align:center;padding:20px;margin-bottom:16px">
    <div style="font-size:28px;margin-bottom:8px">📭</div>
    <div style="font-size:13px;font-weight:700;margin-bottom:4px">No pending approvals</div>
    <div style="font-size:12px;color:var(--text3)">Go to Calendar → click ⚡ Auto-Create on a planned day to generate content</div>
    <button onclick="mktNav('calendar')" class="mkt-btn mkt-btn-primary" style="margin-top:12px;padding:8px 20px;font-size:12px">📅 Open Calendar</button>
  </div>`}

  <!-- RECENT ACTIVITY -->
  ${recent.length ? `
  <div style="font-size:13px;font-weight:700;margin-bottom:8px">Recent activity</div>
  <div style="display:grid;gap:5px">
    ${recent.map(n=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg3);border-radius:8px">
      <span style="font-size:16px">${typeIcon[n.notification_type]||'🔔'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.message?.slice(0,80)||''}…</div>
        <div style="font-size:10px;color:var(--text3)">${new Date(n.created_at).toLocaleString('en-IN',{day:'numeric',month:'short'})} · ${n.response||'seen'}</div>
      </div>
      <span class="badge ${n.response==='yes'?'badge-green':'badge-gray'}">${n.response==='yes'?'Approved':n.response==='no'?'Editing':'Skipped'}</span>
    </div>`).join('')}
  </div>` : ''}
  `);
}


async function runTrendScout(btn) {
  if (btn) { btn.textContent = '⏳ Scanning…'; btn.disabled = true; }
  const el = document.getElementById('trend-scout-result');
  if (el) el.innerHTML = '<span style="color:var(--text3)">⏳ Scanning trends for Vijayawada home building…</span>';

  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/trend-scout', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    if (data.alerted) {
      if (el) el.innerHTML = `<div style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);border-radius:8px;padding:10px;margin-top:6px">
        <div style="font-size:12px;font-weight:700;color:var(--gold)">🔥 Trend found!</div>
        <div style="font-size:12px;margin:4px 0"><b>Trend:</b> ${data.trend}</div>
        <div style="font-size:12px;margin:4px 0"><b>Idea:</b> ${data.content_idea}</div>
        <div style="font-size:11px;color:var(--text3)">Urgency: ${data.urgency} · Saved to notifications</div>
      </div>`;
      showMktToast('🔥 Trend found — check notifications!');
    } else {
      if (el) el.innerHTML = `<span style="color:var(--text3)">✅ Scanned at ${new Date().toLocaleTimeString('en-IN')} — no high-relevance trends right now (relevance: ${data.relevance}/10)</span>`;
      showMktToast('✅ No trending topics right now');
    }
  } catch(e) {
    if (el) el.innerHTML = `<span style="color:var(--red)">❌ ${e.message}</span>`;
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '▶ Run Now'; btn.disabled = false; }
  }
}

async function runReview(type, btn) {
  if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }
  showMktToast('📊 Generating '+type+' review…');
  try {
    const now = new Date();
    const period_label = type === 'quarterly'
      ? now.getFullYear()+'-Q'+Math.ceil((now.getMonth()+1)/3)
      : now.toISOString().slice(0,7);
    const start_date = type === 'quarterly'
      ? new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1).toISOString()
      : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const res = await fetch(MKT_SB_URL+'/functions/v1/content-notifications', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'generate_review', period_type:type, period_label, start_date })
    });
    const data = await res.json();
    showMktToast('✅ '+type.charAt(0).toUpperCase()+type.slice(1)+' review generated');
    setTimeout(() => renderAgents(), 1000);
  } catch(e) {
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = type.charAt(0).toUpperCase()+type.slice(1); btn.disabled = false; }
  }
}

async function respondNotification(id, response, btn) {
  if (btn) { btn.disabled = true; }
  try {
    await sb.from('agent_notifications').update({
      response, responded_at: new Date().toISOString(), resolved: response !== 'pending'
    }).eq('id', id);

    if (response === 'yes') {
      // Check if it's a trend alert — open content studio with suggestion
      const { data: notif } = await sb.from('agent_notifications').select('notification_type,message').eq('id',id).single().then(r=>r,()=>({data:null}));
      if (notif?.notification_type === 'trend_alert') {
        showMktToast('✅ Approved — opening Content Studio to create trend post');
        setTimeout(() => mktNav('content'), 800);
      } else {
        showMktToast('✅ Approved');
      }
    } else {
      showMktToast(response === 'no' ? '✗ Skipped' : 'Dismissed');
    }
    setTimeout(() => renderAgents(), 600);
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) btn.disabled = false;
  }
}


async function renderBrandProfile() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading brand profile…</div>`);

  const { data: bp } = await sb.from('brand_profile').select('*').limit(1).maybeSingle().then(r=>r,()=>({data:null}));

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <h3 style="font-size:16px;font-weight:900">🏷️ Brand Profile & Voice</h3>
      <div style="font-size:12px;color:var(--text3)">Defines how AI writes for V Wholesale across all channels</div>
    </div>
    <button onclick="saveBrandProfile()" class="mkt-btn mkt-btn-primary" style="font-size:12px;padding:8px 16px;font-weight:700">💾 Save</button>
  </div>

  <div style="display:grid;gap:12px">

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">🏪 Store Identity</div>
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Brand name</label>
          <input id="bp-name" class="mkt-form-input" value="${bp?.name||'V Wholesale'}" placeholder="V Wholesale">
        </div>
        <div>
          <label class="mkt-form-label">Tagline</label>
          <input id="bp-tagline" class="mkt-form-input" value="${bp?.tagline||'Home Depot for Tier 2 India'}" placeholder="Your tagline">
        </div>
        <div>
          <label class="mkt-form-label">Store address</label>
          <input id="bp-address" class="mkt-form-input" value="${bp?.address||'Visit V Wholesale'}" placeholder="Address">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="mkt-form-label">Phone</label>
            <input id="bp-phone" class="mkt-form-input" value="${bp?.phone||'8712697930'}" placeholder="Phone">
          </div>
          <div>
            <label class="mkt-form-label">Website</label>
            <input id="bp-website" class="mkt-form-input" value="${bp?.website||'vwholesale.in'}" placeholder="Website">
          </div>
        </div>
      </div>
    </div>

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">🎯 Target Audience</div>
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Primary audiences</label>
          <input id="bp-audience" class="mkt-form-input" value="${bp?.target_audience||'Home owners, Contractors, Architects, Interior Designers, Builders'}" placeholder="Who you sell to">
        </div>
        <div>
          <label class="mkt-form-label">Target geography</label>
          <input id="bp-geography" class="mkt-form-input" value="${bp?.geography||'Vijayawada + 100km radius — Guntur, Eluru, Tenali, Mangalagiri, Machilipatnam'}" placeholder="Target area">
        </div>
        <div>
          <label class="mkt-form-label">Key products / categories</label>
          <input id="bp-products" class="mkt-form-input" value="${bp?.products||'Tiles, Granite, Marble, Sanitaryware, Paints, Electricals, TISAN (private label)'}" placeholder="Products">
        </div>
      </div>
    </div>

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">🗣️ Brand Voice</div>
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Tone of voice</label>
          <select id="bp-tone" class="mkt-form-select">
            ${['Confident & Premium','Warm & Friendly','Expert & Educational','Bold & Direct','Local & Approachable'].map(t=>`<option value="${t}" ${(bp?.tone||'Confident & Premium')===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mkt-form-label">Language preference</label>
          <select id="bp-language" class="mkt-form-select">
            ${[{v:'bilingual',l:'Bilingual — Telugu headline + English body (recommended)'},{v:'te',l:'Telugu first'},{v:'en',l:'English first'},{v:'hi',l:'Hindi (for North Indian contractors)'}].map(o=>`<option value="${o.v}" ${(bp?.language_pref||'bilingual')===o.v?'selected':''}>${o.l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mkt-form-label">Key messages to always include</label>
          <textarea id="bp-messages" class="mkt-form-input" rows="2" placeholder="e.g. Vijayawada's largest tile showroom, 5000+ products, expert guidance">${bp?.key_messages||'Vijayawada\u2019s premium home building store \u00B7 5000+ products \u00B7 Expert guidance \u00B7 Contractor Club benefits'}</textarea>
        </div>
        <div>
          <label class="mkt-form-label">Words / phrases to AVOID</label>
          <textarea id="bp-avoid" class="mkt-form-input" rows="2" placeholder="e.g. cheap, discount, cheap prices — use 'value' instead">${bp?.words_to_avoid||'cheap, cheapest, low quality, best price (use value, premium, competitive pricing)'}</textarea>
        </div>
        <div>
          <label class="mkt-form-label">Competitors (internal only — never mention in posts)</label>
          <input id="bp-competitors" class="mkt-form-input" value="${bp?.competitors||'IBO, Hippo Homes, local tile shops'}" placeholder="Competitors">
        </div>
        <div>
          <label class="mkt-form-label">Unique selling points (USPs)</label>
          <textarea id="bp-usps" class="mkt-form-input" rows="3" placeholder="What makes V Wholesale different">${bp?.usps||'Largest selection in Vijayawada \u00B7 Contractor Club with 2% referral bonus \u00B7 TISAN private label \u00B7 Expert staff \u00B7 Home delivery \u00B7 EMI options'}</textarea>
        </div>
      </div>
    </div>

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">📢 Content Defaults</div>
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Default CTA (Call to Action)</label>
          <input id="bp-cta" class="mkt-form-input" value="${bp?.default_cta||'Visit us at Visit V Wholesale \u00B7 Call 8712697930 \u00B7 vwholesale.in'}" placeholder="Your standard CTA">
        </div>
        <div>
          <label class="mkt-form-label">Always-on hashtags (added to every post)</label>
          <input id="bp-hashtags" class="mkt-form-input" value="${bp?.always_hashtags||'#VWholesale #Vijayawada #HomeRenovation #BuildingMaterials #Tiles'}" placeholder="#yourbrand #yourcity">
        </div>
        <div>
          <label class="mkt-form-label">Instagram handle</label>
          <input id="bp-instagram" class="mkt-form-input" value="${bp?.instagram_handle||'@vwholesaleindia'}" placeholder="@handle">
        </div>
      </div>
    </div>

    <button onclick="saveBrandProfile()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-size:14px;font-weight:700">💾 Save Brand Profile</button>
  </div>`);
}

async function saveBrandProfile() {
  const data = {
    name: document.getElementById('bp-name')?.value||'V Wholesale',
    tagline: document.getElementById('bp-tagline')?.value||'',
    address: document.getElementById('bp-address')?.value||'',
    phone: document.getElementById('bp-phone')?.value||'',
    website: document.getElementById('bp-website')?.value||'',
    target_audience: document.getElementById('bp-audience')?.value||'',
    geography: document.getElementById('bp-geography')?.value||'',
    products: document.getElementById('bp-products')?.value||'',
    tone: document.getElementById('bp-tone')?.value||'Confident & Premium',
    language_pref: document.getElementById('bp-language')?.value||'bilingual',
    key_messages: document.getElementById('bp-messages')?.value||'',
    words_to_avoid: document.getElementById('bp-avoid')?.value||'',
    competitors: document.getElementById('bp-competitors')?.value||'',
    usps: document.getElementById('bp-usps')?.value||'',
    default_cta: document.getElementById('bp-cta')?.value||'',
    always_hashtags: document.getElementById('bp-hashtags')?.value||'',
    instagram_handle: document.getElementById('bp-instagram')?.value||'',
    updated_at: new Date().toISOString()
  };

  const { data: existing } = await sb.from('brand_profile').select('id').limit(1).maybeSingle().then(r=>r,()=>({data:null}));
  if (existing?.id) {
    await sb.from('brand_profile').update(data).eq('id', existing.id);
  } else {
    await sb.from('brand_profile').insert({...data, created_at:new Date().toISOString()});
  }
  showMktToast('✅ Brand profile saved — AI will use this for all future content');
}


// ── BULK CONTENT GENERATION ──
async function bulkGenerateMonth() {
  const { data: calItems } = await sb.from('content_calendar')
    .select('*')
    .gte('cal_date', new Date().toISOString().split('T')[0])
    .lte('cal_date', new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().split('T')[0])
    .neq('status','published')
    .order('cal_date',{ascending:true})
    .then(r=>r,()=>({data:[]}));

  const pending = (calItems||[]).filter(c => c.status === 'planned');
  if (!pending.length) { showMktToast('No planned posts this month — add some to the calendar first'); return; }

  const confirmed = confirm(`Generate content for all ${pending.length} planned posts this month? This will create content for all channels and send for approval.`);
  if (!confirmed) return;

  showMktToast(`⏳ Generating ${pending.length} posts… this will take a moment`);
  let success = 0;

  for (const item of pending) {
    try {
      await quickCreateFromCalendar(item.topic, item.content_type||'image', 'bilingual');
      success++;
      showMktToast(`✅ ${success}/${pending.length} — ${item.topic.slice(0,30)}`);
      await new Promise(r => setTimeout(r, 2000)); // Rate limit between calls
    } catch(e) {
      console.error('Bulk gen error:', item.topic, e.message);
    }
  }
  showMktToast(`✅ Bulk generation complete — ${success}/${pending.length} posts created. Check AI Agents for approvals.`);
  mktNav('agents');
}

// ── HASHTAG RESEARCH ──
async function generateHashtags(topic, btn) {
  if (btn) { btn.textContent='⏳…'; btn.disabled=true; }
  try {
    const { data: bp } = await sb.from('brand_profile').select('always_hashtags,geography,products').limit(1).maybeSingle().then(r=>r,()=>({data:null}));
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Hashtag Research',
        prompt: `Generate a comprehensive hashtag set for V Wholesale Vijayawada for this topic: "${topic||'home renovation'}"

Geography: ${bp?.geography||'Vijayawada, Andhra Pradesh'}
Products: ${bp?.products||'Tiles, Granite, Marble, Sanitaryware'}
Always-on tags: ${bp?.always_hashtags||'#VWholesale #Vijayawada'}

Return JSON:
{
  "primary": ["#5-8 high-relevance tags for this specific topic"],
  "local": ["#5 Vijayawada/Andhra Pradesh local tags"],
  "category": ["#5 home building category tags"],
  "trending": ["#3 currently trending related tags"],
  "always_on": ["#VWholesale","#Vijayawada","#HomeRenovation","#BuildingMaterials"],
  "full_set": "complete recommended set of 20-25 hashtags as one string"
}`,
        context: { topic }
      })
    });
    const data = await res.json();
    const tags = data.output;
    if (!tags?.full_set) throw new Error('Generation failed');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:480px;border:1px solid var(--border)">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px">🏷️ Hashtags for: ${topic||'your post'}</div>
        ${[
          {label:'Primary', tags:tags.primary, color:'var(--gold)'},
          {label:'Local', tags:tags.local, color:'#22c55e'},
          {label:'Category', tags:tags.category, color:'#3b82f6'},
          {label:'Trending', tags:tags.trending, color:'#a855f7'},
        ].map(g=>`
        <div style="margin-bottom:10px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:5px;text-transform:uppercase">${g.label}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${(g.tags||[]).map(t=>`<span style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:3px 8px;font-size:11px;color:${g.color}">${t}</span>`).join('')}
          </div>
        </div>`).join('')}
        <div style="background:var(--bg3);border-radius:8px;padding:10px;margin-top:8px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">FULL SET (copy all)</div>
          <div style="font-size:11px;color:var(--text2);line-height:1.8">${tags.full_set}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button onclick="navigator.clipboard.writeText('${(tags.full_set||'').replace(/'/g,"\'")}').then(()=>showMktToast('📋 Copied!'))" class="mkt-btn mkt-btn-primary" style="flex:1;padding:8px;font-size:12px">📋 Copy All</button>
          <button onclick="this.closest('[style*=fixed]').remove()" class="mkt-btn mkt-btn-ghost" style="padding:8px 14px">Close</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🏷️ Hashtags'; btn.disabled=false; } }
}

// ── REVIEW RESPONSE AI ──
async function generateWhatsAppBroadcast(topic, audience) {
  if (!topic) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:440px;border:1px solid var(--border)">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px">💬 WhatsApp Broadcast Generator</div>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          <div>
            <label class="mkt-form-label">Topic / Campaign</label>
            <input id="wa-topic" class="mkt-form-input" placeholder="e.g. Diwali tile offer, New marble collection, Contractor Club">
          </div>
          <div>
            <label class="mkt-form-label">Target audience</label>
            <select id="wa-audience" class="mkt-form-select">
              <option value="all">All customers</option>
              <option value="contractors">Contractors only</option>
              <option value="homeowners">Home owners</option>
              <option value="architects">Architects & Designers</option>
            </select>
          </div>
          <div>
            <label class="mkt-form-label">Offer / key detail (optional)</label>
            <input id="wa-offer" class="mkt-form-input" placeholder="e.g. 15% off, free delivery above ₹50,000">
          </div>
        </div>
        <button onclick="generateWhatsAppBroadcast(document.getElementById('wa-topic')?.value, document.getElementById('wa-audience')?.value)" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">✨ Generate Messages</button>
        <div id="wa-output" style="margin-top:12px"></div>
      </div>`;
    document.body.appendChild(ov);
    return;
  }

  const outEl = document.getElementById('wa-output');
  if (outEl) outEl.innerHTML = '<div style="padding:10px;color:var(--text3);font-size:12px">⏳ Writing WhatsApp messages…</div>';

  try {
    const offer = document.getElementById('wa-offer')?.value||'';
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'WhatsApp Broadcast',
        prompt: `Write 3 WhatsApp broadcast messages for V Wholesale Vijayawada.

Topic: ${topic}
Audience: ${audience||'all customers'}
Offer/Detail: ${offer||'none'}
Store: V Wholesale | Visit V Wholesale| 8712697930 | vwholesale.in

Rules:
- Each message max 200 characters (WhatsApp best practice)
- Personal, conversational tone (not formal)
- Telugu version for message 3
- Start with greeting, end with CTA
- No formal language

Return JSON:
{
  "message1": "Urgent/offer focused version",
  "message2": "Warm/relationship version",
  "message3": "Telugu version",
  "best_time": "Best time to send this broadcast"
}`,
        context: { topic, audience }
      })
    });
    const data = await res.json();
    const msgs = data.output;
    if (!msgs?.message1) throw new Error('Generation failed');

    if (outEl) outEl.innerHTML = `
      <div style="display:grid;gap:8px;margin-top:4px">
        ${[
          {label:'Version 1 — Offer focused', msg:msgs.message1, color:'var(--gold)'},
          {label:'Version 2 — Relationship', msg:msgs.message2, color:'#22c55e'},
          {label:'Version 3 — Telugu', msg:msgs.message3, color:'#a855f7'},
        ].map(v=>`
        <div style="background:var(--bg3);border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:${v.color};margin-bottom:5px;text-transform:uppercase">${v.label}</div>
          <div style="font-size:12px;line-height:1.8;color:var(--text2)">${v.msg}</div>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(v.msg)}).then(()=>showMktToast('📋 Copied!'))" class="mkt-btn mkt-btn-ghost" style="margin-top:6px;font-size:10px;padding:3px 10px">📋 Copy</button>
        </div>`).join('')}
        <div style="font-size:11px;color:var(--text3);text-align:center">Best time: ${msgs.best_time||'10am-12pm or 6pm-8pm'}</div>
      </div>`;
  } catch(e) {
    if (outEl) outEl.innerHTML = `<div style="color:var(--red);font-size:11px">❌ ${e.message}</div>`;
  }
}

// ── CONTRACTOR CLUB CONTENT ──
async function generateContractorContent(contractorName, projectType) {
  if (!contractorName) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:440px;border:1px solid var(--border)">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px">👷 Contractor Club Content Kit</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Generate ready-made social posts for your contractors to share</div>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          <div>
            <label class="mkt-form-label">Contractor name</label>
            <input id="cc-name" class="mkt-form-input" placeholder="e.g. Ravi Kumar (Painter)">
          </div>
          <div>
            <label class="mkt-form-label">Project type</label>
            <select id="cc-project" class="mkt-form-select">
              <option value="tile-work">Tile flooring / wall work</option>
              <option value="painting">Painting project</option>
              <option value="bathroom">Bathroom renovation</option>
              <option value="kitchen">Kitchen renovation</option>
              <option value="full-home">Full home renovation</option>
              <option value="new-construction">New construction</option>
            </select>
          </div>
          <div>
            <label class="mkt-form-label">Location (optional)</label>
            <input id="cc-location" class="mkt-form-input" placeholder="e.g. Guntur, Vijayawada, Mangalagiri">
          </div>
        </div>
        <button onclick="generateContractorContent(document.getElementById('cc-name')?.value, document.getElementById('cc-project')?.value)" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">✨ Generate Kit</button>
        <div id="cc-output" style="margin-top:12px"></div>
      </div>`;
    document.body.appendChild(ov);
    return;
  }

  const outEl = document.getElementById('cc-output');
  if (outEl) outEl.innerHTML = '<div style="padding:10px;color:var(--text3);font-size:12px">⏳ Creating content kit…</div>';

  try {
    const location = document.getElementById('cc-location')?.value || 'Vijayawada';
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Contractor Content Kit',
        prompt: `Create a social media content kit for a contractor to share about their project.

Contractor: ${contractorName}
Project type: ${projectType||'renovation'}
Location: ${location}
Materials sourced from: V Wholesale, Visit V Wholesale(8712697930)

Generate 3 posts the contractor can copy-paste to their WhatsApp status or Instagram:
1. Project announcement post (when starting work)
2. Mid-project progress update
3. Project completion post (with V Wholesale mention)

Return JSON:
{
  "post1": { "text": "...", "caption": "WhatsApp or Instagram caption" },
  "post2": { "text": "...", "caption": "WhatsApp or Instagram caption" },
  "post3": { "text": "...", "caption": "WhatsApp or Instagram caption — includes V Wholesale mention naturally" },
  "story_text": "One-line story/status text",
  "referral_reminder": "Reminder text about V Wholesale Contractor Club referral bonus"
}`,
        context: { contractorName, projectType, location }
      })
    });
    const data = await res.json();
    const kit = data.output;
    if (!kit?.post1) throw new Error('Generation failed');

    if (outEl) outEl.innerHTML = `
      <div style="display:grid;gap:8px">
        ${[
          {label:'Post 1 — Project Start', post:kit.post1},
          {label:'Post 2 — Progress Update', post:kit.post2},
          {label:'Post 3 — Completion (with V Wholesale)', post:kit.post3},
        ].map((p,i)=>`
        <div style="background:var(--bg3);border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:5px;text-transform:uppercase">${p.label}</div>
          <div style="font-size:12px;line-height:1.8;color:var(--text2)">${p.post?.text||''}</div>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(p.post?.text||'')}).then(()=>showMktToast('📋 Post ${i+1} copied!'))" class="mkt-btn mkt-btn-ghost" style="margin-top:6px;font-size:10px;padding:3px 10px">📋 Copy</button>
        </div>`).join('')}
        <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:4px">💰 REFERRAL REMINDER TO SHARE</div>
          <div style="font-size:11px;color:var(--text2)">${kit.referral_reminder||''}</div>
        </div>
      </div>`;
  } catch(e) {
    if (outEl) outEl.innerHTML = `<div style="color:var(--red);font-size:11px">❌ ${e.message}</div>`;
  }
}

// ── A/B COPY VARIANTS ──
async function generateABVariants(topic, type, btn) {
  if (btn) { btn.textContent='⏳ Generating 3 variants…'; btn.disabled=true; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'A/B Variants',
        prompt: `Write 3 different copy variants for the same social media post for V Wholesale Vijayawada.

Topic: ${topic}
Format: ${type||'Instagram post'}
Each variant should have a different angle/hook to test what resonates.

Return JSON:
{
  "variant_a": { "hook": "Angle A label", "text": "Full post copy", "why": "Why this angle might work" },
  "variant_b": { "hook": "Angle B label", "text": "Full post copy", "why": "Why this angle might work" },
  "variant_c": { "hook": "Angle C label", "text": "Full post copy", "why": "Why this angle might work" },
  "recommendation": "Which variant to try first and why"
}`,
        context: { topic, type }
      })
    });
    const data = await res.json();
    const vars = data.output;
    if (!vars?.variant_a) throw new Error('Generation failed');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;overflow-y:auto;padding:20px';
    ov.innerHTML = `
      <div style="max-width:520px;margin:0 auto;background:var(--bg2);border-radius:12px;padding:20px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="font-size:15px;font-weight:700">🧪 A/B Variants: ${topic}</div>
          <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
        </div>
        ${['a','b','c'].map(v=>`
        <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:11px;font-weight:700;color:var(--gold)">Variant ${v.toUpperCase()} — ${vars['variant_'+v]?.hook||''}</span>
          </div>
          <div style="font-size:12px;line-height:1.8;color:var(--text2);margin-bottom:8px">${vars['variant_'+v]?.text||''}</div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:6px">💡 ${vars['variant_'+v]?.why||''}</div>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(vars['variant_'+v]?.text||'')}).then(()=>showMktToast('📋 Variant ${v.toUpperCase()} copied!'))" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 10px">📋 Copy</button>
        </div>`).join('')}
        ${vars.recommendation ? `<div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:10px"><div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:4px">⭐ AI Recommendation</div><div style="font-size:11px;color:var(--text2)">${vars.recommendation}</div></div>` : ''}
      </div>`;
    document.body.appendChild(ov);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🧪 A/B Variants'; btn.disabled=false; } }
}

async function renderBrand() {
  const { data: knowledge } = await sb.from('brand_knowledge').select('*').order('category').then(r=>r, ()=>({data:[]}));
  const categories = [...new Set((knowledge||[]).map(k=>k.category))];

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">Brand Knowledge</h3>
      <div style="font-size:12px;color:var(--text3)">Facts and guidelines the AI uses to generate accurate content</div>
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="showAddKnowledge()">+ Add Knowledge</button>
  </div>

  <div id="brand-add-form" style="display:none" class="mkt-card">
    <div class="mkt-card-title">Add Brand Knowledge</div>
    <div class="mkt-grid-2">
      <div class="mkt-form-group">
        <label class="mkt-form-label">Category</label>
        <select id="bk-cat" class="mkt-form-select">
          <option value="business">Business Info</option>
          <option value="positioning">Brand Positioning</option>
          <option value="products">Products & Pricing</option>
          <option value="geography">Geography & Service Area</option>
          <option value="tone">Tone & Voice</option>
          <option value="compliance">Compliance & Prohibited</option>
          <option value="customers">Customer Info</option>
          <option value="faq">FAQ</option>
        </select>
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Title</label>
        <input type="text" id="bk-title" class="mkt-form-input" placeholder="e.g. Store Timings">
      </div>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Content</label>
      <textarea id="bk-content" class="mkt-form-textarea" placeholder="Enter the verified fact or guideline…"></textarea>
    </div>
    <div style="display:flex;gap:8px">
      <button class="mkt-btn mkt-btn-primary" onclick="saveBrandKnowledge()">Save</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('brand-add-form').style.display='none'">Cancel</button>
    </div>
  </div>

  ${categories.map(cat => `
  <div class="mkt-card">
    <div class="mkt-card-title">${cat.charAt(0).toUpperCase()+cat.slice(1)}</div>
    <div style="display:grid;gap:8px">
      ${(knowledge||[]).filter(k=>k.category===cat).map(k=>`
      <div style="padding:10px;background:var(--bg3);border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:12px;font-weight:700">${k.title}</div>
          <span class="badge ${k.is_approved?'badge-green':'badge-gold'}">${k.is_approved?'approved':'pending'}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);line-height:1.5">${k.content}</div>
      </div>`).join('')}
    </div>
  </div>`).join('')}`);
}

async function renderIntegrations() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading integrations…</div>`);

  const [
    { data: settings },
    { data: social }
  ] = await Promise.all([
    sb.from('marketing_settings').select('key,value').then(r=>r,()=>({data:[]})),
    sb.from('social_connections').select('*').then(r=>r,()=>({data:[]}))
  ]);

  const cfg = {};
  (settings||[]).forEach(s => { cfg[s.key] = s.value; });
  const sc = {};
  (social||[]).forEach(s => { sc[s.platform] = s; });

  const gbpOk = sc.gbp?.status === 'connected' && sc.gbp?.access_token_set;
  const metaOk = sc.meta?.status === 'connected';
  const waOk = sc.whatsapp?.status === 'connected';

  const statusBadge = (ok, pendingText) => ok
    ? '<span class="badge badge-green">✅ Connected</span>'
    : pendingText
      ? `<span class="badge badge-yellow">⏳ ${pendingText}</span>`
      : '<span class="badge badge-gray">Not connected</span>';

  setContent(`
  <div style="margin-bottom:20px">
    <h3 style="font-size:16px;font-weight:900">🔌 Integrations</h3>
    <div style="font-size:12px;color:var(--text3)">Connect channels to enable auto-publishing</div>
  </div>

  <!-- GOOGLE BUSINESS PROFILE -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">📍</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">Google Business Profile</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Post updates, offers and events to Google Maps</div>
      </div>
      ${statusBadge(gbpOk, !gbpOk ? 'API approval pending' : null)}
    </div>
    ${gbpOk ? `
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:11px;color:var(--text3)">
      ✅ OAuth tokens saved · Case ID: 6-0399000041489 · API approval expected 7-10 working days from submission<br>
      Once approved: auto-posting activates automatically — no code change needed
    </div>` : `
    <button onclick="connectGBP()" class="mkt-btn mkt-btn-primary" style="margin-top:10px;font-size:12px;padding:8px 16px">🔗 Connect GBP</button>`}
  </div>

  <!-- META (Instagram + Facebook) -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">📸</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">Meta — Instagram + Facebook</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Auto-post to Instagram feed, stories, Facebook post and stories</div>
      </div>
      ${statusBadge(metaOk, null)}
    </div>
    ${metaOk ? `
    <div id="meta-status-detail" style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:11px;color:#22c55e">
      ✅ Connected · Page: ${cfg.META_PAGE_NAME||'V Wholesale'} · Instagram: @vwholesaleindia
      ${cfg.META_IG_ID ? `(ID: ${cfg.META_IG_ID})` : '— <span style="color:#f59e0b">click Sync Instagram ID</span>'}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button onclick="fetchMetaIgId()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Sync Instagram ID</button>
      <button onclick="disconnectMeta()" style="background:none;border:none;color:var(--text3);font-size:11px;cursor:pointer">Disconnect</button>
    </div>
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">🔑 Refresh token (paste from Graph API Explorer → V Wholesale app → Generate Access Token):</div>
      <div style="display:flex;gap:6px">
        <input id="meta-refresh-token" class="mkt-form-input" placeholder="EAAxxxxxxxx" style="font-size:11px;flex:1">
        <button onclick="connectMetaWithToken(document.getElementById('meta-refresh-token')?.value)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px;flex-shrink:0">Refresh</button>
      </div>
    </div>
    ` : `
    <div style="margin-top:10px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">To connect Instagram and Facebook, you need a Meta Business account with Pages access.</div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;margin-bottom:8px">Setup steps:</div>
        <div style="display:grid;gap:6px;font-size:11px;color:var(--text2)">
          <div style="display:flex;gap:8px"><span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0">1</span><span>Go to <a href="https://developers.facebook.com/apps" target="_blank" style="color:var(--gold)">developers.facebook.com/apps ↗</a> → Create App → Business type</span></div>
          <div style="display:flex;gap:8px"><span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0">2</span><span>Add Instagram Graph API + Facebook Pages API products</span></div>
          <div style="display:flex;gap:8px"><span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0">3</span><span>Get App ID + App Secret → paste below → click Connect</span></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input id="meta-app-id" class="mkt-form-input" placeholder="Meta App ID" style="font-size:12px">
        <input id="meta-app-secret" class="mkt-form-input" placeholder="Meta App Secret" type="password" style="font-size:12px">
      </div>
      <button onclick="connectMeta()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-size:12px;font-weight:700">🔗 Connect Meta via OAuth</button>
      <div style="margin-top:8px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">OR paste token from Graph API Explorer:</div>
        <div style="display:flex;gap:6px">
          <input id="meta-manual-token" class="mkt-form-input" placeholder="EAAxxxxxxxx" style="font-size:11px;flex:1">
          <button onclick="connectMetaWithToken(document.getElementById('meta-manual-token')?.value)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px;flex-shrink:0">Connect</button>
        </div>
      </div>
    </div>`}
  </div>

  <!-- WHATSAPP -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">💬</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">💬 WhatsApp Business (Meta Direct)</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Broadcast messages to customer list + approvals to 9038010175</div>
      </div>
      ${statusBadge(waOk, !waOk ? 'Verify connection' : null)}
    </div>
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:11px;color:var(--text3)">
      ${waOk
        ? '✅ Meta Direct API · Phone: +91 8712697930 · No Interakt fees'
        : '⏳ Click Verify to test Meta WhatsApp connection'}
    </div>
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">☁️ Cloud API registration (one-time)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button onclick="waCloudStatus(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">📋 Check Status</button>
        <button onclick="waWebhookCheck(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">🔗 Check Webhook</button>
        <button onclick="waPhoneWebhook(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">📞 Phone Webhook Override</button>
        <button onclick="waAudit(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">🔬 Token Audit</button>
        <input id="wa-register-pin" class="mkt-form-input" placeholder="6-digit PIN" maxlength="6" style="font-size:11px;width:110px">
        <button onclick="waCloudRegister(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">☁️ Register Number</button>
      </div>
      <div id="wa-register-output" style="margin-top:8px"></div>
    </div>
  </div>

  <!-- OPENAI + PEXELS -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">🤖</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">OpenAI + Pexels</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">AI content generation + stock photos</div>
      </div>
      <span class="badge badge-green">✅ Active</span>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text3)">gpt-4o-mini · gpt-image-1 (quality:high) · Pexels stock fallback</div>
  </div>

  <!-- TREND SCOUT SCHEDULE -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">🔥</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">Trend Scout — Auto Schedule</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Runs automatically and notifies you when a trend is found</div>
      </div>
      <span id="trend-schedule-status" class="badge badge-gray">Manual only</span>
    </div>
    <div style="margin-top:10px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Select how often to auto-scan:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${['Hourly','Every 4h','Twice daily','Daily'].map(freq=>`
        <button onclick="setTrendSchedule('${freq}',this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">${freq}</button>`).join('')}
        <button onclick="runTrendScout(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">▶ Run Now</button>
      </div>
    </div>
  </div>

  <!-- YOUTUBE -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">▶️</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">YouTube — @vwholesaleindia</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Track views, subscribers and upload Shorts</div>
      </div>
      <span id="yt-status-badge" class="badge ${cfg.YOUTUBE_API_KEY ? 'badge-green' : 'badge-yellow'}">${cfg.YOUTUBE_API_KEY ? '✅ API Key saved' : '⚙️ API Key needed'}</span>
    </div>
    <div style="margin-top:10px;display:grid;gap:8px">
      <div style="background:var(--bg3);border-radius:8px;padding:10px;font-size:11px;color:var(--text2)">
        <div style="margin-bottom:4px"><b>Channel:</b> V Wholesale India</div>
        <div style="margin-bottom:4px"><b>Channel ID:</b> UCFQfukKHctvBn_cSqBL66zg</div>
        <div><b>URL:</b> youtube.com/@vwholesaleindia</div>
      </div>
      <div>
        <label class="mkt-form-label">YouTube Data API v3 Key</label>
        <input id="yt-api-key" class="mkt-form-input" type="password" placeholder="AIza..." value="${cfg.YOUTUBE_API_KEY||''}" style="font-size:12px">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="saveYouTubeSettings()" class="mkt-btn mkt-btn-primary" style="flex:1;font-size:12px;padding:8px;font-weight:700">
          ${cfg.YOUTUBE_API_KEY ? '🔄 Update & Verify' : '🔗 Connect YouTube'}
        </button>
        ${cfg.YOUTUBE_API_KEY ? '<button onclick="loadYouTubeStats()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:8px 12px">📊 Load Stats</button>' : ''}
      </div>
      <div id="yt-stats-display"></div>
    </div>
  </div>

  <!-- THREADS -->
  <div class="mkt-card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">🧵</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">Threads @vwholesaleindia</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Auto-post to Threads — token connected</div>
      </div>
      <span id="threads-status-badge" class="badge badge-yellow">⏳ Verify</span>
    </div>
    <div id="threads-status-detail" style="margin-top:8px;font-size:11px;color:var(--text3)">Click Verify to confirm connection</div>
    <div style="margin-top:8px;display:grid;gap:6px">
      <div style="display:flex;gap:6px;align-items:center">
        <label class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px;cursor:pointer;margin:0;flex-shrink:0">
          📁 Upload Image
          <input type="file" id="threads-test-image-file" accept="image/*" onchange="threadsUploadTestImage(this)" style="display:none">
        </label>
        <div id="threads-test-image-status" style="font-size:11px;color:var(--text3)">No image selected</div>
        <input type="hidden" id="threads-test-image">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="verifyThreadsConnection()" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 14px">🔄 Verify</button>
        <button onclick="testThreadsPost()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 14px">🧪 Test Post with Image</button>
      </div>
    </div>
  </div>

  <!-- GITHUB (Blog) -->
  <div class="mkt-card">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">📝</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">GitHub (Blog auto-publish)</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">vwholesale.in/blog/ — posts publish automatically</div>
      </div>
      <span class="badge badge-green">✅ Active</span>
    </div>
  </div>`);
}

async function threadsUploadTestImage(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('threads-test-image-status');
  if (status) status.textContent = '⏳ Uploading…';
  try {
    const fname = 'threads/test_'+Date.now()+'_'+file.name.replace(/[^a-z0-9.]/gi,'_').toLowerCase();
    const { error } = await sb.storage.from('marketing-assets').upload(fname, file, {contentType:file.type, upsert:true});
    if (error) throw new Error(error.message);
    const { data: ud } = sb.storage.from('marketing-assets').getPublicUrl(fname);
    document.getElementById('threads-test-image').value = ud.publicUrl;
    if (status) status.innerHTML = '<span style="color:#22c55e">✅ '+file.name+' ready</span>';
    showMktToast('✅ Image uploaded and ready');
  } catch(e) {
    if (status) status.textContent = '❌ '+e.message;
    showMktToast('❌ Upload failed: '+e.message);
  }
}

async function verifyThreadsConnection() {
  const badge = document.getElementById('threads-status-badge');
  const detail = document.getElementById('threads-status-detail');
  if (badge) { badge.textContent = '⏳ Checking…'; badge.className = 'badge badge-gray'; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/threads-api', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'verify'})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    if (badge) { badge.textContent = '✅ Connected'; badge.className = 'badge badge-green'; }
    if (detail) detail.innerHTML = '✅ @'+data.username+' · ID: '+data.id;
    showMktToast('✅ Threads connected: @'+data.username);
  } catch(e) {
    if (badge) { badge.textContent = '❌ Error'; badge.className = 'badge badge-gray'; }
    if (detail) detail.textContent = '❌ '+e.message;
    showMktToast('❌ '+e.message);
  }
}

async function testThreadsPost() {
  if (!confirm('Post a test message to @vwholesaleindia on Threads?')) return;
  const btn = document.querySelector('[onclick="testThreadsPost()"]');
  if (btn) { btn.textContent='⏳ Posting…'; btn.disabled=true; }
  try {
    // Get image: first check manual input, then latest content post
    const manualImgUrl = (document.getElementById('threads-test-image')?.value||'').trim();
    const { data: lp } = await sb.from('content_posts').select('master_image_url').not('master_image_url','is',null).neq('master_image_url','').order('created_at',{ascending:false}).limit(1).maybeSingle().then(r=>r,()=>({data:null}));
    window._latestThreadsImageUrl = manualImgUrl || lp?.master_image_url || '';
    console.log('Threads image URL:', window._latestThreadsImageUrl||'none');

    const res = await fetch(MKT_SB_URL+'/functions/v1/threads-api', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify(Object.assign(
        {text:'V Wholesale — Premium Home Building Materials in Vijayawada. Tiles, Granite, Marble & more. Visit us at Visit V Wholesale. 📞 8712697930 | vwholesale.in\n\n#Vijayawada #HomeRenovation #VWholesale #Tiles #Marble'},
        window._latestThreadsImageUrl ? {action:'publish_image', image_url:window._latestThreadsImageUrl} : {action:'publish_text'}
      ))
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    showMktToast('✅ Test posted to Threads!');
    if (data.url) window.open(data.url, '_blank');
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🧪 Test Post'; btn.disabled=false; } }
}

async function checkAndRefreshMetaToken() {
  try {
    const { data: rows } = await sb.from('marketing_settings').select('key,value')
      .in('key',['META_TOKEN_EXPIRY','META_APP_ID','META_APP_SECRET','META_ACCESS_TOKEN'])
      .then(r=>r,()=>({data:[]}));
    const cfg = {}; (rows||[]).forEach(r=>{cfg[r.key]=r.value;});

    if (!cfg.META_ACCESS_TOKEN || !cfg.META_APP_ID || !cfg.META_APP_SECRET) return;

    const expiry = parseInt(cfg.META_TOKEN_EXPIRY||'0');
    const daysLeft = expiry ? Math.floor((expiry - Date.now()) / 86400000) : 0;

    // Refresh if expiring within 10 days or already expired
    if (expiry && daysLeft > 10) {
      console.log('[Meta] Token valid for', daysLeft, 'days');
      return;
    }

    console.log('[Meta] Token expiring soon (', daysLeft, 'days) — refreshing...');
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-setup', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'refresh_token',
        app_id: cfg.META_APP_ID,
        app_secret: cfg.META_APP_SECRET,
        token: cfg.META_ACCESS_TOKEN
      })
    });
    const data = await res.json();
    if (data.ok) {
      console.log('[Meta] Token refreshed successfully — valid for', data.expires_days, 'days');
      if (daysLeft <= 0) showMktToast('✅ Meta token refreshed automatically');
    } else {
      // Show warning if token is expired and couldn't refresh
      if (daysLeft <= 0) {
        showMktToast('⚠️ Meta token expired — go to Integrations → paste new token from developers.facebook.com/tools/explorer');
      }
    }
  } catch(e) {
    console.log('[Meta] Token refresh check failed:', e.message);
  }
}

async function autoSyncInstagramId() {
  // Silently keeps Instagram ID in sync — runs on every portal load
  try {
    const { data: rows } = await sb.from('marketing_settings').select('key,value')
      .in('key',['META_ACCESS_TOKEN','META_PAGE_ID','META_PAGE_TOKEN','META_IG_ID'])
      .then(r=>r,()=>({data:[]}));
    const cfg = {}; (rows||[]).forEach(r=>{cfg[r.key]=r.value;});
    if (!cfg.META_ACCESS_TOKEN || !cfg.META_PAGE_ID) return; // not connected
    // Only sync if IG ID is truly missing (empty string or null)
    if (cfg.META_IG_ID && cfg.META_IG_ID.length > 5) return; // already have valid ID

    // Fetch IG ID using saved page token or user token
    const token = cfg.META_PAGE_TOKEN || cfg.META_ACCESS_TOKEN;
    const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.META_PAGE_ID}?fields=instagram_business_account&access_token=${token}`);
    const data = await res.json();
    const igId = data.instagram_business_account?.id;
    if (igId && igId.length > 5) {
      await sb.from('marketing_settings').upsert({key:'META_IG_ID',value:igId},{onConflict:'key'});
      // Keep social_connections in sync
      await sb.from('social_connections').upsert([
        {platform:'instagram', status:'connected', access_token_set:true, updated_at:new Date().toISOString()},
        {platform:'facebook',  status:'connected', access_token_set:true, updated_at:new Date().toISOString()},
      ],{onConflict:'platform'}).then(()=>{}).catch(()=>{});
      console.log('[Meta] Instagram ID auto-synced:', igId);
    } else {
      console.log('[Meta] IG ID not found in this fetch — keeping existing value');
    }
  } catch(e) {
    console.log('[Meta] Auto-sync Instagram ID failed silently:', e.message);
  }
}

async function connectMeta() {
  const appId = (document.getElementById('meta-app-id')?.value||'').trim();
  const appSecret = (document.getElementById('meta-app-secret')?.value||'').trim();
  if (!appId || !appSecret) { showMktToast('Enter both App ID and App Secret'); return; }

  // Save credentials
  await sb.from('marketing_settings').upsert([
    { key: 'META_APP_ID', value: appId },
    { key: 'META_APP_SECRET', value: appSecret }
  ], { onConflict: 'key' });

  // Build OAuth URL
  const redirectUri = encodeURIComponent('https://vwholesale.in/marketing/');
  const scope = encodeURIComponent('pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,pages_show_list');
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=meta_oauth`;
  window.location.href = url;
}

async function handleMetaOAuth(code) {
  showMktToast('🔗 Completing Meta connection…');
  try {
    const { data: settings } = await sb.from('marketing_settings').select('key,value').in('key',['META_APP_ID','META_APP_SECRET']).then(r=>r,()=>({data:[]}));
    const cfg = {}; (settings||[]).forEach(s => { cfg[s.key] = s.value; });
    if (!cfg.META_APP_ID) { showMktToast('❌ Meta App ID not found — enter credentials first'); mktNav('integrations'); return; }

    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-oauth', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'exchange_code', code, app_id:cfg.META_APP_ID, app_secret:cfg.META_APP_SECRET||'' })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Meta connection failed');

    const _now = new Date().toISOString();
    await sb.from('social_connections').upsert([
      {platform:'meta',      status:'connected', access_token_set:true, connected_at:_now, updated_at:_now},
      {platform:'instagram', status:'connected', access_token_set:true, connected_at:_now, updated_at:_now},
      {platform:'facebook',  status:'connected', access_token_set:true, connected_at:_now, updated_at:_now},
    ],{onConflict:'platform'});

    showMktToast('✅ Meta (Instagram + Facebook) connected!');
  } catch(e) {
    showMktToast('❌ '+e.message);
  }
}

async function fetchMetaIgId() {
  const btn = document.querySelector('[onclick="fetchMetaIgId()"]');
  if (btn) { btn.textContent = '⏳ Syncing…'; btn.disabled = true; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-setup', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'fetch_ig_id'})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    // Only update display — don't re-render entire page (which resets status)
    const el = document.getElementById('meta-status-detail');
    if (data.ig_id && data.ig_id !== 'not_found') {
      if (el) el.innerHTML = '✅ Connected · Page: V Wholesale · Instagram: @vwholesaleindia (ID: '+data.ig_id+')';
      showMktToast('✅ Instagram ID: '+data.ig_id);
    } else {
      if (el) el.innerHTML = '✅ Facebook Page connected · Instagram not linked yet — link @vwholesaleindia to V Wholesale page in Facebook Settings → Linked Accounts';
      showMktToast('⚠️ Instagram not linked to Facebook page yet');
    }
  } catch(e) {
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '🔄 Sync Instagram ID'; btn.disabled = false; }
  }
}

async function disconnectMeta() {
  await sb.from('social_connections').update({status:'disconnected',access_token_set:false}).eq('platform','meta');
  await sb.from('marketing_settings').delete().in('key',['META_ACCESS_TOKEN','META_APP_ID','META_APP_SECRET','META_PAGE_ID','META_IG_ID']);
  showMktToast('Meta disconnected');
  renderIntegrations();
}

async function loadYouTubeStats() {
  const statsEl = document.getElementById('yt-stats-display');
  if (statsEl) statsEl.innerHTML = '<div style="font-size:11px;color:var(--text3)">⏳ Loading…</div>';
  try {
    const { data: rows } = await sb.from('marketing_settings').select('key,value').in('key',['YOUTUBE_CHANNEL_ID','YOUTUBE_API_KEY']).then(r=>r,()=>({data:[]}));
    const cfg = {}; (rows||[]).forEach(r=>{cfg[r.key]=r.value;});
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${cfg.YOUTUBE_CHANNEL_ID}&key=${cfg.YOUTUBE_API_KEY}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const ch = data.items?.[0];
    if (!ch) throw new Error('Channel not found');
    const subs = parseInt(ch.statistics?.subscriberCount||0).toLocaleString('en-IN');
    const views = parseInt(ch.statistics?.viewCount||0).toLocaleString('en-IN');
    const videos = parseInt(ch.statistics?.videoCount||0);
    if (statsEl) statsEl.innerHTML = `<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:10px;font-size:11px">
      <div style="font-weight:700;color:#22c55e;margin-bottom:6px">▶️ ${ch.snippet?.title}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${subs}</div><div style="color:var(--text3)">Subscribers</div></div>
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${views}</div><div style="color:var(--text3)">Views</div></div>
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${videos}</div><div style="color:var(--text3)">Videos</div></div>
      </div>
    </div>`;
  } catch(e) {
    if (statsEl) statsEl.innerHTML = `<div style="color:var(--red);font-size:11px">❌ ${e.message}</div>`;
    showMktToast('❌ '+e.message);
  }
}

async function saveYouTubeSettings() {
  const apiKey = (document.getElementById('yt-api-key')?.value||'').trim();
  if (!apiKey) { showMktToast('Enter the API Key'); return; }
  // Channel ID is already saved — read from DB
  const { data: chRow } = await sb.from('marketing_settings').select('value').eq('key','YOUTUBE_CHANNEL_ID').maybeSingle().then(r=>r,()=>({data:null}));
  const channelId = chRow?.value || 'UCFQfukKHctvBn_cSqBL66zg';

  showMktToast('⏳ Verifying YouTube connection…');
  try {
    // Test the API key by fetching channel info
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.items?.length) throw new Error('Channel not found — check Channel ID');

    const channel = data.items[0];
    const name = channel.snippet?.title || 'Unknown';
    const subs = parseInt(channel.statistics?.subscriberCount||0).toLocaleString('en-IN');
    const views = parseInt(channel.statistics?.viewCount||0).toLocaleString('en-IN');

    // Save to DB
    await sb.from('marketing_settings').upsert([
      {key:'YOUTUBE_CHANNEL_ID', value:channelId},
      {key:'YOUTUBE_API_KEY', value:apiKey},
      {key:'YOUTUBE_CHANNEL_NAME', value:name},
      {key:'YOUTUBE_SUBSCRIBER_COUNT', value:subs},
      {key:'YOUTUBE_VIEW_COUNT', value:views},
    ],{onConflict:'key'});

    await sb.from('social_connections').upsert({
      platform:'youtube', status:'connected', access_token_set:true,
      connected_at:new Date().toISOString(), updated_at:new Date().toISOString()
    },{onConflict:'platform'});

    const badge = document.getElementById('yt-status-badge');
    if (badge) { badge.textContent='✅ Connected'; badge.className='badge badge-green'; }

    const statsEl = document.getElementById('yt-stats-display');
    if (statsEl) statsEl.innerHTML = `<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:10px;font-size:11px">
      <div style="font-weight:700;color:#22c55e;margin-bottom:6px">✅ Connected — ${name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${subs}</div><div style="color:var(--text3)">Subscribers</div></div>
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${views}</div><div style="color:var(--text3)">Total Views</div></div>
        <div><div style="font-size:16px;font-weight:700;color:var(--gold)">${parseInt(channel.statistics?.videoCount||0)}</div><div style="color:var(--text3)">Videos</div></div>
      </div>
    </div>`;
    showMktToast('✅ YouTube connected: '+name+' · '+subs+' subscribers');
  } catch(e) {
    showMktToast('❌ '+e.message);
  }
}

async function setTrendSchedule(freq, btn) {
  await sb.from('marketing_settings').upsert([
    {key:'TREND_SCOUT_SCHEDULE', value:freq},
    {key:'TREND_SCOUT_NEXT_RUN', value:getTrendNextRun(freq)}
  ],{onConflict:'key'});
  const el = document.getElementById('trend-schedule-status');
  if (el) { el.textContent = freq; el.className = 'badge badge-green'; }
  showMktToast('✅ Trend Scout set to: '+freq+' — next run: '+new Date(getTrendNextRun(freq)).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}));
  document.querySelectorAll('[onclick*="setTrendSchedule"]').forEach(b => {
    b.classList.remove('mkt-btn-primary');
    b.classList.add('mkt-btn-ghost');
  });
  if (btn) { btn.classList.remove('mkt-btn-ghost'); btn.classList.add('mkt-btn-primary'); }
}

function getTrendNextRun(freq) {
  const now = Date.now();
  const intervals = {'Hourly':3600000,'Every 4h':14400000,'Twice daily':43200000,'Daily':86400000};
  return String(now + (intervals[freq]||86400000));
}

async function checkAndRunTrendScout() {
  // Called on portal load — runs trend scout if schedule says it's due
  try {
    const { data: rows } = await sb.from('marketing_settings').select('key,value')
      .in('key',['TREND_SCOUT_SCHEDULE','TREND_SCOUT_NEXT_RUN','TREND_SCOUT_LAST_RUN']).then(r=>r,()=>({data:[]}));
    const cfg = {}; (rows||[]).forEach(r=>{cfg[r.key]=r.value;});
    if (!cfg.TREND_SCOUT_SCHEDULE) return; // not scheduled
    const nextRun = parseInt(cfg.TREND_SCOUT_NEXT_RUN||'0');
    if (Date.now() < nextRun) return; // not time yet
    console.log('[Trend Scout] Auto-running — schedule:', cfg.TREND_SCOUT_SCHEDULE);
    // Run silently
    const res = await fetch(MKT_SB_URL+'/functions/v1/trend-scout',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:'{}'});
    const data = await res.json();
    // Set next run time
    await sb.from('marketing_settings').upsert([
      {key:'TREND_SCOUT_NEXT_RUN', value:getTrendNextRun(cfg.TREND_SCOUT_SCHEDULE)},
      {key:'TREND_SCOUT_LAST_RUN', value:String(Date.now())}
    ],{onConflict:'key'});
    if (data.alerted) showMktToast('🔥 Trend Scout found a trend! Check AI Agents.');
  } catch(e) { console.log('[Trend Scout] Auto-run error:', e.message); }
}


async function renderCommandCentre() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading your AI CMO briefing…</div>`);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime()-86400000).toISOString().split('T')[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const [
    {data: todayPosts},
    {data: monthPosts},
    {data: channelPosts},
    {data: calToday},
    {data: calMonth},
    {data: notifications},
    {data: ytSettings},
    {data: stratSessions}
  ] = await Promise.all([
    sb.from('content_posts').select('*').gte('created_at', yesterday+'T00:00:00').then(r=>r,()=>({data:[]})),
    sb.from('content_posts').select('id,post_type,status').gte('created_at', monthStart).then(r=>r,()=>({data:[]})),
    sb.from('channel_posts').select('channel,status').eq('status','published').gte('created_at', monthStart).then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('*').eq('cal_date', todayStr).then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('*').gte('cal_date', todayStr).order('cal_date',{ascending:true}).limit(30).then(r=>r,()=>({data:[]})),
    sb.from('agent_notifications').select('*').or('resolved.eq.false,resolved.is.null').eq('response','pending').order('created_at',{ascending:false}).limit(5).then(r=>r,()=>({data:[]})),
    sb.from('marketing_settings').select('key,value').in('key',['YOUTUBE_SUBSCRIBER_COUNT','YOUTUBE_VIDEO_COUNT','META_IG_ID']).then(r=>r,()=>({data:[]})),
    sb.from('strategy_sessions').select('*').order('created_at',{ascending:false}).limit(1).then(r=>r,()=>({data:[]}))
  ]);

  const ytCfg = {}; (ytSettings||[]).forEach(r=>{ytCfg[r.key]=r.value;});
  const monthPublished = (channelPosts||[]).length;
  const pendingApprovals = (notifications||[]).length;
  const todayCalItems = calToday||[];
  const lastSession = (stratSessions||[])[0];
  const daysSinceSession = lastSession
    ? Math.floor((Date.now()-new Date(lastSession.created_at).getTime())/86400000)
    : 999;
  const daysSinceStrategy = daysSinceSession; // alias
  const sessionDue = daysSinceSession >= 12;
  const nextStrategyDate = getNextStrategyDate();

  // AI CMO suggestions based on data
  const suggestions = [];
  if (todayCalItems.length === 0) suggestions.push({icon:'📅', text:'No content planned for today — open Calendar to add a post', action:"mktNav('calendar')", urgent:true});
  if (pendingApprovals > 0) suggestions.push({icon:'✅', text:`${pendingApprovals} post${pendingApprovals>1?'s':''} waiting for your approval`, action:"mktNav('agents')", urgent:true});
  if (daysSinceStrategy >= 12) suggestions.push({icon:'🧠', text:'Strategy session overdue — plan your content for the next fortnight', action:"mktNav('calendar');setTimeout(openStrategySession,400)", urgent:true});
  if (monthPublished < 5) suggestions.push({icon:'📢', text:'Only '+monthPublished+' posts published this month — target is 15-20', action:"mktNav('calendar')", urgent:false});
  if (!ytCfg.META_IG_ID) suggestions.push({icon:'📸', text:'Instagram not connected — sync it in Integrations', action:"mktNav('integrations')", urgent:false});
  suggestions.push({icon:'🔥', text:'Run Trend Scout to find today\u2019s opportunities', action:"mktNav('agents')", urgent:false});
  suggestions.push({icon:'🎬', text:'Record a reel \u2014 your audience engages 3x more with video', action:"mktNav('calendar')", urgent:false});

  const todayDateStr = now.toLocaleDateString('en-IN',{weekday:'long', day:'numeric', month:'long', year:'numeric'});

  setContent(`
  <!-- CMO GREETING -->
  <div style="background:linear-gradient(135deg,#EEF2F7,#E8EDF5);border:1px solid rgba(201,168,76,.5);border-radius:14px;padding:20px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="font-size:36px">🤖</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:900;color:var(--text)">${greeting}, Himansu</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${todayDateStr}</div>
        <div style="font-size:12px;color:var(--gold);margin-top:6px;font-weight:600">
          ${monthPublished} posts published this month · ${(monthPosts||[]).length} created · ${pendingApprovals} pending approval
        </div>
      </div>
      <button onclick="generateCMOBriefing(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:8px 14px;flex-shrink:0">🧠 AI Briefing</button>
    </div>
    <div id="cmo-briefing-output" style="margin-top:0"></div>
  </div>

  <!-- STRATEGY SESSION BANNER IN CMO -->
  ${sessionDue ? `
  <div class="mkt-card" style="margin-bottom:14px;border-left:3px solid #ef4444;background:rgba(239,68,68,.04)">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">🧠</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">Strategy Session Due
          <span class="badge badge-red" style="margin-left:8px">Overdue</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          ${lastSession
            ? `Last session was ${daysSinceSession} days ago · Next: ${nextStrategyDate}`
            : 'No sessions yet — plan your first content strategy'}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">
          📅 ${(calMonth||[]).length} posts planned ahead · ${(calMonth||[]).filter(c=>c.is_reel).length} reels · ${(calMonth||[]).filter(c=>!c.is_reel&&c.content_type!=='reel').length} other
        </div>
      </div>
      <button onclick="openStrategySession()" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:8px 14px;flex-shrink:0">🧠 Start Session</button>
    </div>
  </div>` : `
  <div class="mkt-card" style="margin-bottom:14px;border-left:3px solid var(--gold);background:rgba(201,168,76,.04)">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">🧠</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">Content Strategy Active</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          ${lastSession
            ? `Last session: ${new Date(lastSession.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · Next due: ${nextStrategyDate}`
            : 'No sessions yet'}
          ${lastSession?.summary ? ` · "${lastSession.summary.slice(0,60)}…"` : ''}
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px">
          📅 <b>${(calMonth||[]).length}</b> posts planned · <b>${(calMonth||[]).filter(c=>c.is_reel).length}</b> reels · 
          Next: ${calMonth?.[0] ? new Date(calMonth[0].cal_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' — '+calMonth[0].topic : 'Nothing scheduled'}
        </div>
      </div>
      <button onclick="openStrategySession()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px;flex-shrink:0">💬 Update</button>
    </div>
  </div>`}

  <!-- TODAY'S PLAN -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">📅 Today's Content</div>
      ${todayCalItems.length ? todayCalItems.map(item=>`
      <div style="padding:8px;background:var(--bg3);border-radius:6px;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600">${item.topic||'Untitled'}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${item.content_type||'post'} · ${item.status||'planned'}</div>
        <div style="display:flex;gap:5px;margin-top:6px">
          ${item.is_reel
            ? `<button onclick="generateAndShowReelScript('${(item.topic||'').replace(/'/g,"\'")}','${item.id}',this)" class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:3px 8px">🎬 Script</button>`
            : `<button onclick="quickCreateFromCalendar('${(item.topic||'').replace(/'/g,"\'")}','${item.content_type||'image'}','bilingual')" class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:3px 8px">⚡ Create</button>`}
        </div>
      </div>`).join('')
      : `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">
          Nothing planned for today
          <button onclick="addCalendarItem()" class="mkt-btn mkt-btn-primary" style="display:block;margin:8px auto 0;font-size:11px;padding:6px 12px">+ Add Today</button>
        </div>`}
    </div>

    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">📊 This Month</div>
      <div style="display:grid;gap:8px">
        ${[
          {label:'Posts Created', value:(monthPosts||[]).length, color:'var(--gold)'},
          {label:'Published', value:monthPublished, color:'#22c55e'},
          {label:'Reels', value:(monthPosts||[]).filter(p=>p.post_type==='reel').length, color:'#a855f7'},
          {label:'Pending Approval', value:pendingApprovals, color:pendingApprovals>0?'#f59e0b':'var(--text3)'},
        ].map(m=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3);border-radius:6px">
          <div style="font-size:11px;color:var(--text2)">${m.label}</div>
          <div style="font-size:16px;font-weight:700;color:${m.color}">${m.value}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- AI SUGGESTIONS -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">💡 AI Suggestions for Today</div>
    <div style="display:grid;gap:8px">
      ${suggestions.map(s=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:${s.urgent?'rgba(201,168,76,.06)':'var(--bg3)'};border:1px solid ${s.urgent?'rgba(201,168,76,.2)':'var(--border)'};border-radius:8px;cursor:pointer" onclick="${s.action}">
        <span style="font-size:20px;flex-shrink:0">${s.icon}</span>
        <div style="flex:1;font-size:12px;color:var(--text2)">${s.text}</div>
        <span style="font-size:16px;color:var(--text3)">›</span>
      </div>`).join('')}
    </div>
  </div>

  <!-- QUICK ACTIONS -->
  <div style="font-size:12px;font-weight:700;margin-bottom:10px">⚡ Quick Actions</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;max-height:300px;overflow-y:auto">
    ${[
      {icon:'📅', label:'Calendar', page:'calendar'},
      {icon:'🤖', label:'AI Agents', page:'agents'},
      {icon:'📸', label:'Create Post', page:'content'},
      {icon:'🖼️', label:'AI Photoshoot', fn:'openAIPhotoshoot()'},
      {icon:'📢', label:'Boost Post', page:'ads'},
      {icon:'📊', label:'Analytics', page:'analytics'},
      {icon:'🔌', label:'Integrations', page:'integrations'},
      {icon:'🔥', label:'Trend Scout', fn:"mktNav('agents');setTimeout(()=>runTrendScout(),400)"},
      {icon:'💬', label:'WhatsApp', fn:"generateWhatsAppBroadcast()"},
      {icon:'⭐', label:'Review Reply', fn:"generateReviewReply()"},
      {icon:'👷', label:'Contractor Kit', fn:"generateContractorContent()"},
      {icon:'🏷️', label:'Hashtags', fn:"generateHashtags(prompt('Topic for hashtags:')||'home renovation')"},
      {icon:'🧪', label:'A/B Variants', fn:"generateABVariants(prompt('Topic:')||'tiles',prompt('Format:')||'Instagram post')"},
      {icon:'🚀', label:'Bulk Generate', fn:"bulkGenerateMonth()"},
    ].map(a=>`
    <button onclick="${a.fn||"mktNav('"+a.page+"')"}" class="mkt-btn mkt-btn-ghost" style="flex-direction:column;align-items:center;padding:12px 6px;gap:6px;display:flex;font-size:11px;height:70px">
      <span style="font-size:22px">${a.icon}</span>
      <span style="color:var(--text2)">${a.label}</span>
    </button>`).join('')}
  </div>

  <!-- BUSINESS INTELLIGENCE STRIP -->
  <div class="mkt-card" id="bi-strip" style="margin-bottom:0">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:12px;font-weight:700">📊 Business Intelligence</div>
      <div style="display:flex;gap:6px">
        <button onclick="mktNav('bi')" style="background:none;border:none;color:var(--gold);font-size:10px;cursor:pointer;font-weight:700">View Full →</button>
        <button onclick="loadBIStrip()" style="background:none;border:none;color:var(--text3);font-size:10px;cursor:pointer">↻</button>
      </div>
    </div>
    <div id="bi-strip-content" style="font-size:11px;color:var(--text3)">Loading…</div>
  </div>

  <!-- CHANNEL STATUS -->
  <div class="mkt-card">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🔌 Channel Status</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${[
        {icon:'📍', name:'GBP', status:'Quota pending', color:'#f59e0b'},
        {icon:'📸', name:'Instagram', status:'Connected', color:'#22c55e'},
        {icon:'👤', name:'Facebook', status:'Connected', color:'#22c55e'},
        {icon:'🧵', name:'Threads', status:'Connected', color:'#22c55e'},
        {icon:'▶️', name:'YouTube', status:'Connected', color:'#22c55e'},
        {icon:'💬', name:'WhatsApp', status:'Connected', color:'#22c55e'},
      ].map(c=>`
      <div style="text-align:center;padding:8px;background:var(--bg3);border-radius:8px">
        <div style="font-size:18px">${c.icon}</div>
        <div style="font-size:11px;font-weight:600;margin-top:2px">${c.name}</div>
        <div style="font-size:9px;color:${c.color};margin-top:2px">${c.status}</div>
      </div>`).join('')}
    </div>
  </div>`);
  // Load BI strip async after render
  setTimeout(loadBIStrip, 300);
}

async function loadBIStrip() {
  const el = document.getElementById('bi-strip-content');
  if (!el) return;
  el.innerHTML = '<span style="color:var(--text3)">Loading intelligence…</span>';
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/business-intelligence',{
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY}
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const s = data.snapshot;
    const momArrow = s.revenue.mom_change_pct >= 0 ? '↑' : '↓';
    const momColor = s.revenue.mom_change_pct >= 0 ? '#22c55e' : '#ef4444';
    const hotStage = s.hot_leads?.[0];
    const topCat = s.top_categories?.[0];
    const slowCat = s.slow_movers?.[0];

    el.innerHTML = `
      <!-- Revenue row -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:15px;font-weight:900;color:var(--gold)">₹${s.revenue.this_month_lakhs}L</div>
          <div style="font-size:9px;color:var(--text3)">This month</div>
        </div>
        <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:15px;font-weight:900;color:var(--text2)">₹${s.revenue.last_month_lakhs}L</div>
          <div style="font-size:9px;color:var(--text3)">Last month</div>
        </div>
        <div style="background:var(--bg2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:15px;font-weight:900;color:${momColor}">${momArrow}${Math.abs(s.revenue.mom_change_pct)}%</div>
          <div style="font-size:9px;color:var(--text3)">MoM</div>
        </div>
      </div>

      <!-- Key signals row -->
      <div style="display:grid;gap:6px">
        ${hotStage ? `
        <div style="display:flex;align-items:center;gap:8px;background:rgba(201,168,76,.08);border-radius:8px;padding:8px;border-left:3px solid var(--gold)">
          <div style="font-size:16px">🔥</div>
          <div>
            <div style="font-weight:700;color:var(--gold);font-size:11px">Immediate opportunity</div>
            <div style="color:var(--text2);font-size:11px">${hotStage.reachable} reachable customers → ready to buy <b>${hotStage.next_buy}</b></div>
          </div>
        </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${topCat ? `
          <div style="background:var(--bg2);border-radius:8px;padding:8px">
            <div style="font-size:9px;color:#22c55e;font-weight:700;margin-bottom:3px">🏆 TOP SELLER</div>
            <div style="font-size:12px;font-weight:700">${topCat.category}</div>
            <div style="font-size:10px;color:var(--text3)">₹${topCat.revenue_lakhs}L · ${topCat.unique_customers} customers</div>
          </div>` : ''}
          ${slowCat ? `
          <div style="background:var(--bg2);border-radius:8px;padding:8px">
            <div style="font-size:9px;color:#f59e0b;font-weight:700;margin-bottom:3px">⚠️ NEEDS PUSH</div>
            <div style="font-size:12px;font-weight:700">${slowCat}</div>
            <div style="font-size:10px;color:var(--text3)">Low sales — content can help</div>
          </div>` : ''}
        </div>
        <!-- Pipeline summary -->
        <div style="background:var(--bg2);border-radius:8px;padding:8px">
          <div style="font-size:9px;color:var(--text3);font-weight:700;margin-bottom:5px">👥 PIPELINE — reachable customers by stage</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${(s.customer_pipeline||[]).filter(p=>p.reachable>0).slice(0,6).map(p=>`
            <div style="background:var(--bg3);border-radius:5px;padding:3px 7px;text-align:center">
              <div style="font-size:12px;font-weight:700;color:var(--gold)">${p.reachable}</div>
              <div style="font-size:8px;color:var(--text3)">${p.stage.replace('_',' ')}</div>
            </div>`).join('')}
          </div>
        </div>
        <!-- Field visits -->
        ${s.field_intelligence?.total_visits > 0 ? `
        <div style="background:var(--bg2);border-radius:8px;padding:8px">
          <div style="font-size:9px;color:#3b82f6;font-weight:700;margin-bottom:3px">🏗️ FIELD INTELLIGENCE</div>
          <div style="font-size:11px;color:var(--text2)">${s.field_intelligence.total_visits.toLocaleString()} sites visited · ${s.field_intelligence.valid_phone.toLocaleString()} with contact</div>
        </div>` : ''}
      </div>
      <div style="font-size:9px;color:var(--text3);margin-top:8px;text-align:right">Updated ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>`;
  } catch(e) {
    if (el) el.innerHTML = `<span style="color:var(--red)">⚠️ Could not load — ${e.message}</span>`;
  }
}

async function generateCMOBriefing(btn) {
  if (btn) { btn.textContent='⏳ Thinking…'; btn.disabled=true; }
  const out = document.getElementById('cmo-briefing-output');
  if (out) out.innerHTML='';

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      {data: posts},
      {data: cal},
      {data: sessions}
    ] = await Promise.all([
      sb.from('content_posts').select('topic,post_type,status').gte('created_at', monthStart).then(r=>r,()=>({data:[]})),
      sb.from('content_calendar').select('topic,content_type,cal_date,status').gte('cal_date', now.toISOString().split('T')[0]).limit(7).then(r=>r,()=>({data:[]})),
      sb.from('strategy_sessions').select('summary,key_themes').order('created_at',{ascending:false}).limit(1).then(r=>r,()=>({data:[]}))
    ]);

    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'AI CMO',
        prompt: `You are the AI CMO for V Wholesale, Vijayawada — India's premium home building materials store.

Today: ${now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
Month: ${now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
Posts this month: ${(posts||[]).length} created, ${(posts||[]).filter(p=>p.status==='published').length} published
Upcoming calendar: ${(cal||[]).map(c=>`${new Date(c.cal_date).getDate()} ${c.topic}`).join(', ')||'empty'}
Last strategy: ${(sessions||[])[0]?.summary?.slice(0,100)||'none'}

Write a short, sharp AI CMO morning briefing for Himansu. Like a real CMO would:
- What worked yesterday (infer from data)
- Top 2-3 priorities for today
- One bold suggestion
- Keep it under 80 words, conversational, direct

Return as plain text, no JSON.`,
        context: {}
      })
    });
    const data = await res.json();
    const briefing = typeof data.output === 'string' ? data.output : (data.output?.message || data.output?.master_text || 'Ready to help you grow V Wholesale today.');

    if (out) out.innerHTML = `<div style="margin-top:14px;padding:12px;background:var(--bg3);border-radius:8px;font-size:12px;color:var(--text2);line-height:1.8;border-left:3px solid var(--gold)">${briefing}</div>`;
  } catch(e) {
    if (out) out.innerHTML = `<div style="margin-top:10px;font-size:11px;color:var(--text3)">Briefing unavailable — ${e.message}</div>`;
  } finally {
    if (btn) { btn.textContent='🧠 AI Briefing'; btn.disabled=false; }
  }
}


async function renderAICMO() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading your CMO brief…</div>`);

  // Pull live data for context
  const [
    {data:campaigns}, {data:posters}, {data:calItems},
    {data:blogs}, {data:competitors}, {data:feedPosts}
  ] = await Promise.all([
    sb.from('campaigns').select('name,status,spent_inr,budget_inr,conversions').eq('status','active').then(r=>r,()=>({data:[]})),
    sb.from('poster_history').select('created_at').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('status,cal_date').gte('cal_date', new Date().toISOString().split('T')[0]).lte('cal_date', new Date(Date.now()+7*86400000).toISOString().split('T')[0]).then(r=>r,()=>({data:[]})),
    sb.from('blog_posts').select('status').then(r=>r,()=>({data:[]})),
    sb.from('competitors').select('id').then(r=>r,()=>({data:[]})),
    sb.from('daily_posts_feed').select('created_at').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).then(r=>r,()=>({data:[]}))
  ]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">🤖 AI CMO — Weekly Marketing Brief</h3>
    <div style="font-size:12px;color:var(--text3)">${dateStr}</div>
  </div>

  <!-- Status snapshot -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
    ${[
      {icon:'📣',label:'Active Campaigns',val:(campaigns||[]).length,color:'#22c55e'},
      {icon:'🎨',label:'Posters This Week',val:(posters||[]).length,color:'var(--gold)'},
      {icon:'📢',label:'Posts to Staff',val:(feedPosts||[]).length,color:'#3b82f6'}
    ].map(m=>'<div class="mkt-card" style="padding:10px;text-align:center">'
      +'<div style="font-size:20px">'+m.icon+'</div>'
      +'<div style="font-size:18px;font-weight:900;color:'+m.color+'">'+m.val+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+m.label+'</div>'
    +'</div>').join('')}
  </div>

  <!-- AI Weekly Brief -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="width:40px;height:40px;background:linear-gradient(135deg,#c9a84c,#f59e0b);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">🤖</div>
      <div>
        <div style="font-size:14px;font-weight:900">Your AI Chief Marketing Officer</div>
        <div style="font-size:11px;color:var(--text3)">Get a personalised weekly marketing plan based on your actual data</div>
      </div>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">What's happening this week? (optional)</label>
      <input id="cmo-context" class="mkt-form-input" placeholder="e.g. Pushing Italian marble, Ganesh Chaturthi coming up, sales slow on Tuesdays">
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="generateCMOBrief()" style="width:100%;padding:14px;font-size:14px;font-weight:900">🧠 Generate This Week's Marketing Plan</button>
    <div id="cmo-output" style="display:none;margin-top:14px">
      <div style="background:var(--bg3);border-radius:10px;padding:16px">
        <div id="cmo-content" style="font-size:13px;line-height:1.8;white-space:pre-wrap;color:var(--text1)"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="mkt-btn mkt-btn-ghost" onclick="copyText('cmo-content')" style="flex:1">📋 Copy Brief</button>
        <button class="mkt-btn mkt-btn-primary" onclick="generateCMOBrief()" style="flex:1">🔄 Regenerate</button>
      </div>
    </div>
  </div>

  <!-- Weekly content schedule -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">📅 This Week's Content Plan</div>
    <div style="display:grid;gap:6px">
      ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day,i) => {
        const d = new Date(today);
        const diff = i - today.getDay();
        d.setDate(today.getDate() + diff);
        const dateStr = d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
        const isToday = d.toDateString() === today.toDateString();
        const isPast = d < today && !isToday;
        const calDay = (calItems||[]).filter(c=>c.cal_date===d.toISOString().split('T')[0]);
        const postTypes = {
          'Monday':'🏠 Project Proof — before/after tile installation',
          'Wednesday':'📦 Product Spotlight — feature a brand or new arrival',
          'Friday':'🏗️ Contractor Club — recruit contractors, mention 2% bonus',
          'Saturday':'⭐ Customer Story — testimonial or review',
          'Tuesday':'',
          'Thursday':'',
          'Sunday':''
        };
        const hint = postTypes[day];
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:'+(isToday?'rgba(201,168,76,0.08)':'var(--bg3)')+';border-radius:8px;border:'+(isToday?'1px solid rgba(201,168,76,0.3)':'1px solid transparent')+'">'
          +'<div style="min-width:32px;text-align:center"><div style="font-size:11px;font-weight:700;color:'+(isToday?'var(--gold)':isPast?'var(--text3)':'var(--text2)')+'">'+day.slice(0,3)+'</div>'
          +'<div style="font-size:10px;color:var(--text3)">'+dateStr+'</div></div>'
          +'<div style="flex:1"><div style="font-size:11px;color:'+(isPast?'var(--text3)':'var(--text1)')+';">'
          +(calDay.length?'📌 '+calDay.length+' item(s) planned':hint?hint:'<span style="color:var(--text3)">No content planned</span>')+'</div></div>'
          +(isToday?'<span class="badge badge-green" style="font-size:9px">TODAY</span>':'')
        +'</div>';
      }).join('')}
    </div>
  </div>

  <!-- Quick actions -->
  <div class="mkt-card">
    <div class="mkt-card-title">⚡ Act on AI Recommendations</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${[
        {label:"Generate Today's Poster",icon:'🎨',page:'poster'},
        {label:'Write Blog Article',icon:'📝',page:'website-seo'},
        {label:'Plan Calendar',icon:'📅',page:'calendar'},
        {label:'Send WhatsApp',icon:'💬',page:'whatsapp'},
        {label:'Check Competitors',icon:'🔍',page:'competitors'},
        {label:'View Analytics',icon:'📊',page:'analytics'}
      ].map(a=>'<button class="mkt-btn mkt-btn-ghost" onclick="mktNav(\''+a.page+'\');" style="display:flex;align-items:center;gap:8px;padding:10px;font-size:12px;font-weight:600">'
        +'<span style="font-size:18px">'+a.icon+'</span>'+a.label+'</button>'
      ).join('')}
    </div>
  </div>`);
}

async function generateCMOBrief() {
  const context = (document.getElementById('cmo-context')?.value||'').trim();
  const btn = document.querySelector('[onclick="generateCMOBrief()"]');
  if (btn) { btn.textContent = '⏳ Generating…'; btn.disabled = true; }

  const [
    {data:campaigns}, {data:posters7}, {data:blogs},
    {data:competitors}, {data:calItems}, {data:greetings7}
  ] = await Promise.all([
    sb.from('campaigns').select('name,status,spent_inr,budget_inr,impressions,conversions').then(r=>r,()=>({data:[]})),
    sb.from('poster_history').select('topic,template,created_at').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).then(r=>r,()=>({data:[]})),
    sb.from('blog_posts').select('title,status').then(r=>r,()=>({data:[]})),
    sb.from('competitors').select('name').then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('topic,status,cal_date,is_reel').gte('cal_date', new Date().toISOString().split('T')[0]).lte('cal_date', new Date(Date.now()+7*86400000).toISOString().split('T')[0]).then(r=>r,()=>({data:[]})),
    sb.from('greeting_log').select('person_name,greeting_type').gte('created_at', new Date(Date.now()-7*86400000).toISOString()).then(r=>r,()=>({data:[]}))
  ]);

  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-IN',{weekday:'long'});

  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({
      task:'cmo_weekly_brief', language:'en',
      topic:'Weekly marketing brief',
      context:{
        business:'V Wholesale', location:'Vijayawada, Andhra Pradesh',
        today: today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}),
        day_of_week: dayOfWeek,
        active_campaigns: (campaigns||[]).filter(c=>c.status==='active').map(c=>c.name),
        posters_this_week: (posters7||[]).length,
        upcoming_calendar: (calItems||[]).map(c=>c.topic||c.cal_date),
        blog_count: {published:(blogs||[]).filter(b=>b.status==='published').length, draft:(blogs||[]).filter(b=>b.status==='draft').length},
        competitors_tracked: (competitors||[]).map(c=>c.name),
        greetings_sent: (greetings7||[]).length,
        extra_context: context || 'none'
      }
    })
  });

  const data = await res.json();
  const content = data.content||data.text||'';

  const out = document.getElementById('cmo-output');
  const cont = document.getElementById('cmo-content');
  if (out) out.style.display='block';
  if (cont) cont.textContent = content || 'No brief generated — try again';

  if (btn) { btn.textContent = "🧠 Generate This Week's Marketing Plan"; btn.disabled = false; }
}

function copyText(id) {
  const el = document.getElementById(id);
  if (el) navigator.clipboard.writeText(el.textContent||'').then(()=>showMktToast('📋 Copied!'));
}

async function runAICMO() {
  if (aiPaused) { alert('AI actions are paused. Resume first.'); return; }

  const outputEl = document.getElementById('cmo-output');
  if (outputEl) {
    outputEl.innerHTML = `<div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div><span style="font-size:12px;color:var(--text3);margin-left:8px">AI CMO is analysing your business data…</span></div>`;
  }

  // Gather business context
  const [products, campaigns, integrations] = await Promise.all([
    sb.from('products').select('id,name,category,stock,price').limit(20).then(r=>r.data||[], ()=>[]),
    sb.from('marketing_campaigns').select('*').limit(5).then(r=>r.data||[], ()=>[]),
    sb.from('marketing_integrations').select('name,status').then(r=>r.data||[], ()=>[]),
  ]);

  const context = {
    business: 'V Wholesale — Omnichannel home building store, Vijayawada, Andhra Pradesh',
    website: 'https://vwholesale.in (just launched)',
    monthly_budget_inr: 30000,
    primary_goals: ['Store walk-ins', 'Quotations', 'GBP visibility', 'Contractor Club growth'],
    priority_channels: ['Website SEO', 'Google Business Profile', 'WhatsApp', 'Instagram', 'Reels'],
    languages: ['Telugu (primary)', 'English', 'Hindi'],
    target_locations: ['Vijayawada', 'Guntur', 'Mangalagiri', 'Tenali', 'Eluru'],
    product_categories: ['Tiles', 'Sanitaryware', 'Granite', 'Paints', 'Electricals', 'Plumbing'],
    total_products: products.length,
    integrations_status: integrations,
    active_campaigns: campaigns.length,
    date: new Date().toLocaleDateString('en-IN'),
  };

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        action: 'weekly_briefing',
        agent: 'AI CMO',
        model: 'gpt-4o-mini',
        prompt: `You are the AI CMO for V Wholesale, a home building superstore in Vijayawada, Andhra Pradesh.

Your role: Analyse current business context and produce a structured weekly marketing briefing.

STRICT RULES:
- Only recommend actions based on facts provided
- Never invent data, sales figures, or customer testimonials
- Always specify approval level needed (recommend/draft/approve/auto)
- Focus on local Vijayawada market
- Prioritise Telugu language content for local channels

Respond ONLY in this JSON format:
{
  "summary": "2-3 sentence overview of current marketing situation",
  "top_priorities": ["priority 1", "priority 2", "priority 3"],
  "weekly_actions": [
    {"action": "action description", "channel": "channel name", "effort": "low/medium/high", "impact": "low/medium/high", "approval": "auto/draft/approve", "reason": "why this matters"}
  ],
  "content_ideas": [
    {"type": "post/reel/story", "platform": "Instagram/GBP/WhatsApp", "topic": "topic", "language": "en/te/hi", "hook": "opening line idea"}
  ],
  "risks": ["risk 1", "risk 2"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "budget_recommendation": {"gbp_boost": 0, "meta_ads": 0, "google_ads": 0, "reason": "rationale"}
}`,
        context
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    const output = data.output;
    if (outputEl) {
      outputEl.innerHTML = `
      <div style="display:grid;gap:12px">

        <div class="ai-message ai">
          <div style="font-size:10px;font-weight:700;color:var(--purple);margin-bottom:6px">🧠 AI CMO WEEKLY BRIEFING · ${new Date().toLocaleDateString('en-IN')}</div>
          <div style="font-size:13px;line-height:1.7">${output.summary || 'Analysis complete.'}</div>
        </div>

        <div class="mkt-grid-2">
          <div class="mkt-card" style="margin:0">
            <div class="mkt-card-title">🎯 Top Priorities</div>
            ${(output.top_priorities||[]).map((p,i) => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--purple);font-weight:800">${i+1}</span>${p}</div>`).join('')}
          </div>
          <div class="mkt-card" style="margin:0">
            <div class="mkt-card-title">💡 Opportunities</div>
            ${(output.opportunities||[]).map(o => `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid var(--border)">• ${o}</div>`).join('')}
            <div class="mkt-card-title" style="margin-top:12px">⚠️ Risks</div>
            ${(output.risks||[]).map(r => `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid var(--border);color:var(--red)">• ${r}</div>`).join('')}
          </div>
        </div>

        <div class="mkt-card" style="margin:0">
          <div class="mkt-card-title">📋 This Week's Actions</div>
          <div style="display:grid;gap:8px">
            ${(output.weekly_actions||[]).map(a => `
            <div style="display:flex;gap:12px;align-items:flex-start;padding:10px;background:var(--bg3);border-radius:8px">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700">${a.action}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px">${a.channel} · ${a.reason}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                <span class="badge badge-blue">${a.impact} impact</span>
                <span class="badge ${a.approval==='auto'?'badge-green':a.approval==='draft'?'badge-blue':'badge-gold'}">${a.approval}</span>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <div class="mkt-card" style="margin:0">
          <div class="mkt-card-title">💡 Content Ideas This Week</div>
          <div style="display:grid;gap:6px">
            ${(output.content_ideas||[]).map(c => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:8px">
              <span class="badge badge-purple">${c.platform}</span>
              <span class="badge badge-gray">${c.type}</span>
              <span class="badge ${c.language==='te'?'badge-gold':c.language==='hi'?'badge-blue':'badge-gray'}">${c.language}</span>
              <div style="flex:1;font-size:12px"><strong>${c.topic}</strong> — "${c.hook}"</div>
              <button class="mkt-btn mkt-btn-ghost" onclick="draftContent('${c.type}','${c.platform}','${c.topic.replace(/'/g,"\\'")}','${c.language}')" style="font-size:10px;padding:4px 8px">Draft →</button>
            </div>`).join('')}
          </div>
        </div>

        <div style="font-size:10px;color:var(--text3);text-align:center;padding:8px">
          Generated by AI CMO · ${data.model} · $${(data.cost_usd||0).toFixed(4)} · ${data.duration_ms}ms
        </div>
      </div>`;
    }

  } catch(e) {
    if (outputEl) outputEl.innerHTML = `<div style="color:var(--red);padding:16px;text-align:center">
      <div style="font-size:20px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:700">AI CMO Error</div>
      <div style="font-size:12px;margin-top:4px">${e.message}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px">Make sure OpenAI API key is set in Supabase Edge Function secrets</div>
    </div>`;
  }
}

// ── CONTENT STUDIO ──
async function renderContentStudio() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading studio…</div>`);

  // Load brand profile + upcoming calendar + recent learning
  const [
    {data: bp},
    {data: calItems},
    {data: learning}
  ] = await Promise.all([
    sb.from('brand_profile').select('*').limit(1).maybeSingle().then(r=>r,()=>({data:null})),
    sb.from('content_calendar').select('*').gte('cal_date', new Date().toISOString().split('T')[0]).in('status',['planned','scripted']).order('cal_date',{ascending:true}).limit(10).then(r=>r,()=>({data:[]})),
    sb.from('ai_learning_log').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r,()=>({data:[]}))
  ]);

  const CHANNELS = [
    {id:'gbp',          label:'📍 GBP',              size:'1:1',      auto:true},
    {id:'instagram_feed',label:'📸 Instagram Feed',  size:'1:1/4:5',  auto:false},
    {id:'instagram_story',label:'📱 Instagram Story',size:'9:16',     auto:false},
    {id:'facebook_post', label:'👤 Facebook Post',   size:'1.91:1',   auto:false},
    {id:'facebook_story',label:'📖 Facebook Story',  size:'9:16',     auto:false},
    {id:'whatsapp_bc',   label:'💬 WhatsApp Broadcast',size:'1:1',    auto:false},
    {id:'whatsapp_status',label:'💚 WA Status',      size:'9:16',     auto:false},
    {id:'threads',       label:'🧵 Threads',          size:'1:1',     auto:false},
    {id:'x',             label:'𝕏 X / Twitter',      size:'16:9',    auto:false},
    {id:'youtube',       label:'▶️ YouTube',          size:'16:9',    auto:false},
  ];

  const POST_TYPES = [
    {id:'image',    label:'🖼️ Image post'},
    {id:'reel',     label:'🎬 Reel (manual record)'},
    {id:'gif',      label:'✨ GIF / Motion'},
    {id:'festival', label:'🎉 Festival / Occasion'},
    {id:'qa',       label:'❓ Tip / Q&A carousel'},
  ];

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">✍️ Content Studio</h3>
      <div style="font-size:12px;color:var(--text3)">One brief → all channels. AI writes, you approve.</div>
    </div>
  </div>

  <!-- STEP 1: What are we creating? -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Step 1 — What are we creating?</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div>
        <label class="mkt-form-label">Topic / Campaign</label>
        <input id="cs-topic" class="mkt-form-input"
          value="${(calItems||[])[0]?.topic||''}"
          placeholder="e.g. Italian marble new collection, Diwali offer, Kajaria tiles">
        ${(calItems||[]).length ? `<div style="font-size:10px;color:var(--gold);margin-top:3px">📅 Next from calendar: ${(calItems||[])[0]?.cal_date} — ${(calItems||[])[0]?.topic}</div>` : ''}
      </div>
      <div>
        <label class="mkt-form-label">Post type</label>
        <select id="cs-type" class="mkt-form-select" onchange="csTypeChanged(this.value)">
          ${POST_TYPES.map(t=>`<option value="${t.id}">${t.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Language selector -->
    <div style="margin-bottom:10px">
      <label class="mkt-form-label">Language</label>
      <div style="display:flex;gap:6px">
        ${[
          {id:'bilingual', label:'🇮🇳 Bilingual (Telugu headline + English body)', default:true},
          {id:'te',        label:'తెలుగు Telugu'},
          {id:'en',        label:'🇬🇧 English'},
        ].map(l=>`
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:11px;flex:1">
            <input type="radio" name="cs-lang" value="${l.id}" ${l.default?'checked':''} style="accent-color:var(--gold)">
            ${l.label}
          </label>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">💡 Bilingual recommended — Telugu stops the scroll, English boosts SEO. Festival posts auto-switch to Telugu.</div>
    </div>

    <!-- Channel selection -->
    <div>
      <label class="mkt-form-label">Publish to channels</label>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px">
        ${CHANNELS.map(c=>`
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:11px">
            <input type="checkbox" name="cs-channel" value="${c.id}" ${c.id==='gbp'?'checked':''} style="accent-color:var(--gold)">
            <span style="flex:1">${c.label}</span>
            <span style="font-size:9px;color:var(--text3)">${c.size}</span>
          </label>`).join('')}
      </div>
    </div>
  </div>

  <!-- Reel-specific: shown only for reel type -->
  <div id="cs-reel-section" style="display:none" class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Reel brief (AI prepares, you record)</div>
    <div style="font-size:12px;color:var(--text2);line-height:1.7">
      After creating, you'll get:<br>
      • Hook line (first 3 seconds to stop scroll)<br>
      • Shot list (what to film, scene by scene)<br>
      • On-screen text for each scene<br>
      • Voiceover script (optional)<br>
      • Caption with hashtags + SEO keywords
    </div>
  </div>

  <!-- GIF section -->
  <div id="cs-gif-section" style="display:none" class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">GIF / Motion style</div>
    <div style="display:grid;gap:6px">
      ${[
        {id:'before_after', label:'Before / After reveal', desc:'Upload 2 photos — AI creates wipe animation'},
        {id:'product_loop', label:'Product showcase loop', desc:'AI generates product images and animates as carousel'},
        {id:'text_reveal',  label:'Text reveal animation', desc:'Animated text card — great for WhatsApp status'},
      ].map(g=>`
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
          <input type="radio" name="cs-gif" value="${g.id}" ${g.id==='before_after'?'checked':''} style="accent-color:var(--gold)">
          <div><div style="font-size:12px;font-weight:600">${g.label}</div><div style="font-size:11px;color:var(--text3)">${g.desc}</div></div>
        </label>`).join('')}
    </div>
    <div style="margin-top:8px">
      <label class="mkt-form-label">Upload before photo (for before/after)</label>
      <input type="file" id="cs-before-img" accept="image/*" class="mkt-form-input" style="padding:4px">
      <label class="mkt-form-label" style="margin-top:6px">Upload after photo</label>
      <input type="file" id="cs-after-img" accept="image/*" class="mkt-form-input" style="padding:4px">
    </div>
  </div>

  <!-- CREATE BUTTON -->
  <button id="cs-create-btn" class="mkt-btn mkt-btn-primary" onclick="createUnifiedContent()"
    style="width:100%;padding:16px;font-size:15px;font-weight:900;letter-spacing:.3px;margin-bottom:12px">
    ✨ Create Content for All Channels
  </button>

  <!-- PROGRESS -->
  <div id="cs-progress" style="display:none;margin-bottom:12px" class="mkt-card">
    <div id="cs-steps" style="display:grid;gap:6px"></div>
  </div>

  <!-- OUTPUT -->
  <div id="cs-output" style="display:none">

    <!-- Master content -->
    <div class="mkt-card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Master content</div>
        <div style="display:flex;gap:6px">
          <button onclick="csRegenContent()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Regenerate</button>
          <button onclick="csCopyMaster()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">📋 Copy</button>
        </div>
      </div>
      <textarea id="cs-master-text" class="mkt-form-input" rows="7" style="font-size:13px;line-height:1.8;resize:vertical"></textarea>
      <div id="cs-seo-keywords" style="margin-top:8px;display:none">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">SEO KEYWORDS</div>
        <div id="cs-kw-pills" style="display:flex;flex-wrap:wrap;gap:4px"></div>
      </div>
    </div>

    <!-- Reel script (shown for reel type) -->
    <div id="cs-reel-output" style="display:none" class="mkt-card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">🎬 Reel script & shot list</div>
      <div id="cs-reel-content" style="font-size:12px;line-height:1.9;white-space:pre-wrap;color:var(--text1)"></div>
    </div>

    <!-- Image section -->
    <div class="mkt-card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700">Visuals</div>
        <div style="display:flex;gap:6px">
          <button onclick="csRegenImage()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 New images</button>
          <label class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px;cursor:pointer;margin:0">
            📁 Upload <input type="file" id="cs-img-upload" accept="image/*" onchange="csHandleUpload(this)" style="display:none">
          </label>
        </div>
      </div>
      <div id="cs-image-variations" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"></div>
      <div id="cs-selected-image" style="display:none;border-radius:8px;overflow:hidden;border:2px solid var(--gold)">
        <img id="cs-selected-img" src="" style="width:100%;max-height:220px;object-fit:cover;display:block;cursor:zoom-in" onclick="openGBPImageFullscreen(this.src)">
        <div style="background:rgba(0,0,0,.6);padding:6px 10px;display:flex;justify-content:space-between">
          <span id="cs-img-label" style="font-size:10px;color:#fff"></span>
          <button onclick="openGBPImageFullscreen(document.getElementById('cs-selected-img').src)" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">⛶ Fullscreen</button>
        </div>
      </div>
      <input type="hidden" id="cs-image-url">
    </div>

    <!-- Channel adaptations -->
    <div class="mkt-card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Channel versions <span style="font-size:11px;color:var(--text3);font-weight:400">— tap to expand</span></div>
      <div id="cs-channel-versions" style="display:grid;gap:6px"></div>
    </div>

    <!-- Approve + Publish -->
    <div class="mkt-card" style="margin-bottom:12px">
      <div id="cs-verify-result" style="margin-bottom:10px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <button class="mkt-btn mkt-btn-ghost" onclick="csVerify()" style="padding:12px;font-weight:700">🔍 Verify</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="csSendForApproval()" style="padding:12px;font-weight:700">📲 Send for Approval</button>
        <button class="mkt-btn mkt-btn-primary" onclick="csPublishAll()" style="padding:12px;font-weight:700">🚀 Publish All</button>
      </div>
    </div>
  </div>`);
}

function csTypeChanged(type) {
  document.getElementById('cs-reel-section').style.display = type === 'reel' ? 'block' : 'none';
  document.getElementById('cs-gif-section').style.display = type === 'gif' ? 'block' : 'none';
  if (type === 'festival') {
    // Auto-switch to Telugu for festivals
    const teRadio = document.querySelector('input[name="cs-lang"][value="te"]');
    if (teRadio) teRadio.checked = true;
    showMktToast('🎉 Festival post — switched to Telugu automatically');
  }
}

function csStep(idx, status, msg) {
  window._csSteps = window._csSteps || {};
  window._csSteps[idx] = {status, msg};
  const el = document.getElementById('cs-steps');
  if (!el) return;
  const icons = {pending:'⏳', done:'✅', error:'❌'};
  el.innerHTML = Object.values(window._csSteps).map(s =>
    `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:${s.status==='done'?'var(--green)':s.status==='error'?'var(--red)':'var(--text2)'}">
      <span>${icons[s.status]||'⏳'}</span><span>${s.msg}</span>
    </div>`).join('');
}

async function createUnifiedContent() {
  const topic = (document.getElementById('cs-topic')?.value||'').trim();
  if (!topic) { showMktToast('Enter a topic first'); return; }

  const postType = document.getElementById('cs-type')?.value || 'image';
  const language = document.querySelector('input[name="cs-lang"]:checked')?.value || 'bilingual';
  const channels = [...document.querySelectorAll('input[name="cs-channel"]:checked')].map(c=>c.value);

  const btn = document.getElementById('cs-create-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creating…'; }
  document.getElementById('cs-progress').style.display = 'block';
  document.getElementById('cs-output').style.display = 'none';
  window._csSteps = {};
  window._csCurrentTopic = topic;
  window._csCurrentType = postType;
  window._csCurrentLang = language;
  window._csChannels = channels;

  try {
    // Load context for AI learning
    const [
      {data: bp},
      {data: recentPosts},
      {data: topPerformers}
    ] = await Promise.all([
      sb.from('brand_profile').select('*').limit(1).maybeSingle().then(r=>r,()=>({data:null})),
      sb.from('content_posts').select('topic,master_text,language,post_type').order('created_at',{ascending:false}).limit(5).then(r=>r,()=>({data:[]})),
      sb.from('ai_learning_log').select('*').order('engagement_rate',{ascending:false}).limit(3).then(r=>r,()=>({data:[]}))
    ]);

    // Build language instruction
    const langInstructions = {
      bilingual: 'Write with a Telugu headline/greeting (2-4 words in Telugu script), then English body. End with a Telugu CTA like "ఇప్పుడే సందర్శించండి!" followed by English contact.',
      te: 'Write entirely in Telugu script. Natural Telugu as spoken in Vijayawada.',
      en: 'Write entirely in English.'
    };

    const learningContext = (topPerformers||[]).length
      ? 'High-performing past patterns: ' + (topPerformers||[]).map(p=>`${p.post_type} ${p.language} ${p.what_worked}`).join('; ')
      : '';

    const recentContext = (recentPosts||[]).length
      ? 'Recent posts (avoid repeating): ' + (recentPosts||[]).map(p=>p.topic).join(', ')
      : '';

    // STAGE 1: Master content
    csStep(1, 'pending', 'Writing master content…');

    const postTypePrompts = {
      image: 'Write a promotional post for an image.',
      reel: 'Write a reel caption (short, punchy, hook-first).',
      gif: 'Write a short animated post caption.',
      festival: 'Write a warm festival greeting with business mention. Telugu preferred.',
      qa: 'Write a tip or Q&A post in carousel slide format (5 slides: question → answer steps → CTA).'
    };

    const contentRes = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action: 'generate_text', agent: 'Content Studio',
        prompt: `You are writing social media content for V Wholesale, a premium home building materials store in Vijayawada, Andhra Pradesh, India.

TOPIC: ${topic}
POST TYPE: ${postType}
${postTypePrompts[postType]||''}

LANGUAGE: ${langInstructions[language]}

BRAND: V Wholesale | Visit V Wholesale| Phone: 8712697930 | vwholesale.in
CATEGORIES: Tiles, Granite, Marble, Sanitaryware, Paints, Electricals, Flooring, False Ceiling

${learningContext}
${recentContext}

REQUIREMENTS:
- 200-400 characters of main content
- After content: blank line, then 10-15 hashtags
- Hashtags mix: local (#Vijayawada #AndhraPradesh #Bhavanipuram), category, intent (#HomeRenovation #InteriorDesign), brand (#VWholesale)
- Natural tone — written like a real store owner, not a corporate ad

Return JSON:
{
  "master_text": "full post with hashtags",
  "seo_keywords": ["5-7 search keywords"],
  "reel_script": ${postType === 'reel' ? '{"hook":"","shots":["scene 1","scene 2","scene 3"],"onscreen_text":["text 1","text 2","text 3"],"voiceover":"optional script","caption":"short caption"}' : 'null'}
}`,
        context: { topic, language, type: postType, brand: 'V Wholesale' }
      })
    });
    const contentData = await contentRes.json();
    const output = contentData.output || {};
    const masterText = output.master_text || '';
    const seoKeywords = output.seo_keywords || [];
    const reelScript = output.reel_script;

    if (!masterText) throw new Error('Content generation failed');

    document.getElementById('cs-master-text').value = masterText;

    if (seoKeywords.length) {
      document.getElementById('cs-seo-keywords').style.display = 'block';
      document.getElementById('cs-kw-pills').innerHTML = seoKeywords.map(k=>
        `<span style="background:rgba(201,168,76,.1);color:var(--gold);border:1px solid rgba(201,168,76,.3);border-radius:12px;padding:2px 8px;font-size:10px">${k}</span>`
      ).join('');
    }

    if (reelScript && postType === 'reel') {
      document.getElementById('cs-reel-output').style.display = 'block';
      const shots = (reelScript.shots||[]).map((sh,i)=>(i+1)+'. '+sh).join('\n');
      const onscreen = (reelScript.onscreen_text||[]).map((t,i)=>'Scene '+(i+1)+': '+t).join('\n');
      document.getElementById('cs-reel-content').textContent =
        '🎬 HOOK (first 3 seconds):\n' + reelScript.hook + '\n\n' +
        '📹 SHOT LIST:\n' + shots + '\n\n' +
        '📝 ON-SCREEN TEXT:\n' + onscreen + '\n\n' +
        (reelScript.voiceover ? '🎙️ VOICEOVER:\n' + reelScript.voiceover + '\n\n' : '') +
        '📌 CAPTION:\n' + reelScript.caption;
    }

    csStep(1, 'done', 'Content written in ' + (language==='bilingual'?'Telugu + English':language==='te'?'Telugu':'English'));

    // STAGE 2: Generate image (skip for reel type)
    if (postType !== 'reel') {
      csStep(2, 'pending', 'Generating 2 poster variations…');
      const imgRes = await fetch(`${MKT_SB_URL}/functions/v1/gbp-image`, {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({topic, post_text: masterText})
      });
      const imgData = await imgRes.json();
      if (imgData.ok && imgData.image_url) {
        window._csVariations = imgData.variations || [imgData.image_url];
        csRenderVariations(imgData.variations||[imgData.image_url], imgData.image_url, imgData.qa_score);
        csStep(2, 'done', `${(imgData.variations||[imgData.image_url]).length} variations ready · QA ${imgData.qa_score||'?'}/10`);
      } else {
        csStep(2, 'done', 'Image generation pending — upload manually');
      }
    } else {
      csStep(2, 'done', 'Reel — record using script above, upload separately');
    }

    // STAGE 3: Adapt for each channel
    csStep(3, 'pending', 'Adapting for ' + channels.length + ' channels…');
    await csAdaptChannels(masterText, channels, language);
    csStep(3, 'done', channels.length + ' channel versions ready');

    // STAGE 4: Save to DB
    csStep(4, 'pending', 'Saving content…');
    const { data: savedPost } = await sb.from('content_posts').insert({
      topic, language, post_type: postType,
      master_text: masterText,
      seo_keywords: seoKeywords,
      hashtags: (masterText.match(/#\w+/g)||[]),
      reel_script: reelScript || null,
      status: 'draft',
      updated_at: new Date().toISOString()
    }).select().single().then(r=>r,()=>({data:null}));

    window._csCurrentPostId = savedPost?.id;
    csStep(4, 'done', 'Saved as draft');

    // Show output
    document.getElementById('cs-output').style.display = 'block';
    setTimeout(() => document.getElementById('cs-output')?.scrollIntoView({behavior:'smooth',block:'start'}), 300);

  } catch(e) {
    csStep(99, 'error', e.message);
    showMktToast('❌ ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Create Content for All Channels'; }
    setTimeout(() => { document.getElementById('cs-progress').style.display='none'; }, 3000);
  }
}

function csRenderVariations(urls, selectedUrl, qaScore) {
  const grid = document.getElementById('cs-image-variations');
  if (!grid) return;
  grid.innerHTML = urls.map((url, i) => `
    <div onclick="csSelectVariation(${i})" data-cvi="${i}"
      style="cursor:pointer;border-radius:8px;overflow:hidden;border:2px solid ${url===selectedUrl?'var(--gold)':'var(--border)'};transition:border .2s">
      <img src="${url}" style="width:100%;height:100px;object-fit:cover;display:block">
      <div style="padding:3px 6px;font-size:10px;text-align:center;color:var(--text3)">
        Option ${i+1}${url===selectedUrl?' ✓':''}${i===0&&qaScore?' · QA '+qaScore+'/10':''}
      </div>
    </div>`).join('');
  csSelectVariation(0, true);
}

function csSelectVariation(idx, silent) {
  const vars = window._csVariations || [];
  if (!vars[idx]) return;
  document.getElementById('cs-image-url').value = vars[idx];
  const preview = document.getElementById('cs-selected-image');
  const img = document.getElementById('cs-selected-img');
  const lbl = document.getElementById('cs-img-label');
  if (preview) preview.style.display = 'block';
  if (img) img.src = vars[idx];
  if (lbl) lbl.textContent = 'Option ' + (idx+1) + ' selected';
  document.querySelectorAll('[data-cvi]').forEach((el,i) => {
    el.style.borderColor = i===idx ? 'var(--gold)' : 'var(--border)';
  });
  if (!silent) showMktToast('Option '+(idx+1)+' selected');
}

async function csAdaptChannels(masterText, channels, language) {
  const CHANNEL_RULES = {
    gbp:             {name:'📍 GBP',              size:'1:1',     note:'No hashtags in body. Max 1500 chars. Local focus.'},
    instagram_feed:  {name:'📸 Instagram Feed',   size:'1:1',     note:'All hashtags. Hook in first line. 150-300 chars.'},
    instagram_story: {name:'📱 Instagram Story',  size:'9:16',    note:'Ultra short. 1-2 lines. Strong CTA.'},
    facebook_post:   {name:'👤 Facebook Post',    size:'1.91:1',  note:'Conversational. 100-200 chars. Fewer hashtags (5).'},
    facebook_story:  {name:'📖 Facebook Story',   size:'9:16',    note:'Very short. 1 line + CTA.'},
    whatsapp_bc:     {name:'💬 WhatsApp Broadcast',size:'1:1',    note:'Personal tone. No hashtags. Include phone 8712697930.'},
    whatsapp_status: {name:'💚 WhatsApp Status',  size:'9:16',    note:'Max 2 lines. Eye-catching. No hashtags.'},
    threads:         {name:'🧵 Threads',           size:'1:1',     note:'Conversational. 150 chars. 2-3 hashtags.'},
    x:               {name:'𝕏 X',                size:'16:9',    note:'Max 280 chars. 2-3 hashtags. Hook-first.'},
    youtube:         {name:'▶️ YouTube',           size:'16:9',    note:'Title + description. SEO keywords. Chapters if reel.'},
  };

  const adaptedVersions = {};
  // For now adapt top 4 channels shown + simple rule-based adaptation for others
  for (const ch of channels) {
    const rule = CHANNEL_RULES[ch];
    if (!rule) continue;
    // Simple adaptation rules (no extra API call to save cost)
    let adapted = masterText;
    if (ch === 'gbp') {
      adapted = masterText.replace(/#[\w\u0C00-\u0C7F]+/g,'').replace(/\s+#[\s\S]*$/,'').trim();
      if (adapted.length > 1500) adapted = adapted.slice(0,1497)+'…';
    } else if (ch === 'whatsapp_bc') {
      adapted = masterText.replace(/#[\w\u0C00-\u0C7F]+/g,'').replace(/\s+#[\s\S]*$/,'').trim();
    } else if (ch === 'instagram_story' || ch === 'facebook_story' || ch === 'whatsapp_status') {
      adapted = masterText.split('\n')[0].slice(0,120);
    } else if (ch === 'x') {
      const noHash = masterText.replace(/#\w+/g,'').trim();
      adapted = noHash.slice(0,240) + ' #VWholesale #Vijayawada';
    } else if (ch === 'threads') {
      adapted = masterText.slice(0,280);
    }
    adaptedVersions[ch] = {name: rule.name, size: rule.size, text: adapted};
  }

  window._csAdaptedVersions = adaptedVersions;
  const container = document.getElementById('cs-channel-versions');
  if (!container) return;
  container.innerHTML = Object.entries(adaptedVersions).map(([ch, v]) => `
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div onclick="toggleChannelVersion('${ch}')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg3);cursor:pointer">
        <span style="font-size:12px;font-weight:600;flex:1">${v.name}</span>
        <span style="font-size:10px;color:var(--text3)">${v.size}</span>
        <span style="font-size:10px;color:var(--text3)">${v.text.length} chars</span>
        <span id="ch-toggle-${ch}" style="font-size:11px;color:var(--text3)">▸</span>
      </div>
      <div id="ch-content-${ch}" style="display:none;padding:10px 12px">
        <textarea class="mkt-form-input" id="ch-text-${ch}" rows="4" style="font-size:11px;line-height:1.7">${v.text}</textarea>
        <button onclick="navigator.clipboard.writeText(document.getElementById('ch-text-${ch}').value).then(()=>showMktToast('📋 Copied!'))" class="mkt-btn mkt-btn-ghost" style="margin-top:6px;font-size:11px;padding:4px 10px">📋 Copy</button>
      </div>
    </div>`).join('');
}

function toggleChannelVersion(ch) {
  const el = document.getElementById('ch-content-'+ch);
  const toggle = document.getElementById('ch-toggle-'+ch);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (toggle) toggle.textContent = isOpen ? '▸' : '▾';
}

async function csAdaptLanguage() {
  const topic = window._csCurrentTopic;
  const lang = window._csCurrentLang;
  const type = window._csCurrentType;
  const channels = window._csChannels || ['gbp'];
  if (!topic) return;
  await createUnifiedContent();
}

async function csRegenContent() {
  const topic = (document.getElementById('cs-topic')?.value||window._csCurrentTopic||'').trim();
  if (!topic) { showMktToast('No topic'); return; }
  showMktToast('🔄 Regenerating…');
  await createUnifiedContent();
}

async function csRegenImage() {
  const topic = window._csCurrentTopic || (document.getElementById('cs-topic')?.value||'').trim();
  const text = document.getElementById('cs-master-text')?.value || '';
  showMktToast('🤖 Generating new images…');
  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/gbp-image`, {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({topic, post_text: text})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    window._csVariations = data.variations || [data.image_url];
    csRenderVariations(data.variations||[data.image_url], data.image_url, data.qa_score);
    showMktToast('✅ New variations ready');
  } catch(e) { showMktToast('❌ '+e.message); }
}

function csHandleUpload(input) {
  const file = input.files[0]; if(!file) return;
  const url = URL.createObjectURL(file);
  window._csVariations = [url];
  csRenderVariations([url], url, null);
  document.getElementById('cs-image-url').value = url;
  showMktToast('✅ Image uploaded');
}

function csCopyMaster() {
  navigator.clipboard.writeText(document.getElementById('cs-master-text')?.value||'').then(()=>showMktToast('📋 Copied!'));
}

function csVerify() {
  const text = document.getElementById('cs-master-text')?.value || '';
  const passes = [], checks = [];
  if (text.length >= 100) passes.push('Length good (' + text.length + ' chars)');
  else checks.push('Too short');
  if ((text.match(/#\w+/g)||[]).length >= 8) passes.push((text.match(/#\w+/g)||[]).length + ' hashtags');
  else checks.push('Add more hashtags');
  if (text.includes('8712697930') || text.includes('vwholesale')) passes.push('Contact info present');
  else checks.push('Missing contact info');
  const el = document.getElementById('cs-verify-result');
  if (el) el.innerHTML = `<div style="background:var(--bg3);border-radius:8px;padding:10px;font-size:12px">
    ${passes.map(p=>`<div style="color:var(--green)">✅ ${p}</div>`).join('')}
    ${checks.map(c=>`<div style="color:#f59e0b">⚠️ ${c}</div>`).join('')}
    ${!checks.length?'<div style="color:var(--green);font-weight:700;margin-top:6px">✅ Ready to publish</div>':''}
  </div>`;
  showMktToast(checks.length ? '⚠️ ' + checks[0] : '✅ Content verified');
}

async function csSendForApproval() {
  const topic = window._csCurrentTopic || (document.getElementById('cs-topic')?.value||'').trim();
  const imageUrl = document.getElementById('cs-image-url')?.value || '';

  const btn = document.querySelector('[onclick="csSendForApproval()"]');
  if (btn) { btn.textContent = '⏳ Sending…'; btn.disabled = true; }

  try {
    // Call notification edge function — handles WhatsApp + DB
    const res = await fetch(MKT_SB_URL+'/functions/v1/content-notifications', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action: 'send_approval',
        agent_name: 'Content Studio',
        topic,
        message: 'Content ready for approval: "'+topic+'". Image: '+(imageUrl?'attached':'not yet')+'. Review in portal.',
        image_url: imageUrl
      })
    });
    const data = await res.json();

    if (window._csCurrentPostId) {
      await sb.from('content_posts').update({status:'pending_approval'}).eq('id', window._csCurrentPostId);
    }

    const waStatus = data.whatsapp_sent
      ? '📲 WhatsApp alert sent to 9038010175'
      : '🔔 Logged in portal (WhatsApp will activate once WABA approved)';

    const el = document.getElementById('cs-verify-result');
    if (el) el.innerHTML = '<div style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:10px;font-size:12px;color:var(--gold)">⏳ Approval requested · '+waStatus+'</div>';
    showMktToast('✅ Approval request sent');
  } catch(e) {
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '📲 Send for Approval'; btn.disabled = false; }
  }
}

async function csPublishAll() {
  const text = document.getElementById('cs-master-text')?.value || '';
  const imageUrl = document.getElementById('cs-image-url')?.value || '';
  const channels = window._csChannels || ['gbp'];
  const adaptedVersions = window._csAdaptedVersions || {};
  if (!text) { showMktToast('No content to publish'); return; }

  await navigator.clipboard.writeText(text).catch(()=>{});

  // Track per-channel results for the summary
  const results = {}; // channel -> {ok, url, error}

  // --- AUTO-PUBLISH: Threads ---
  if (channels.includes('threads')) {
    try {
      const threadsText = adaptedVersions['threads']?.text || text;
      const payload = imageUrl
        ? { action:'publish_image', text:threadsText, image_url:imageUrl }
        : { action:'publish_text',  text:threadsText };
      const r = await fetch(MKT_SB_URL+'/functions/v1/threads-api', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify(payload)
      }).then(r=>r.json()).catch(e=>({ok:false,error:e.message}));
      results['threads'] = r.ok ? {ok:true, url:r.url} : {ok:false, error:r.error||'Unknown error'};
    } catch(e) {
      results['threads'] = {ok:false, error:e.message};
    }
  }

  // --- MANUAL channels: Instagram, Facebook, GBP (API pending or quota=0) ---
  // These open in a new tab; staff posts manually
  const manualChannels = channels.filter(ch => !['threads'].includes(ch));

  // Save channel posts to DB
  if (window._csCurrentPostId) {
    const channelRows = channels.map(ch => ({
      content_post_id: window._csCurrentPostId,
      channel: ch,
      adapted_text: adaptedVersions[ch]?.text || text,
      image_url: imageUrl,
      image_size: adaptedVersions[ch]?.size || '1:1',
      status: results[ch]?.ok ? 'published' : (results[ch]?.ok === false ? 'failed' : 'pending'),
      published_at: results[ch]?.ok ? new Date().toISOString() : null,
      platform_post_url: results[ch]?.url || null
    }));
    await sb.from('channel_posts').insert(channelRows).then(()=>{}).catch(()=>{});
    await sb.from('content_posts').update({status:'published',approved_at:new Date().toISOString()}).eq('id',window._csCurrentPostId);
  }

  // Build result summary
  const threadsResult = results['threads'];
  const el = document.getElementById('cs-verify-result');
  if (el) el.innerHTML = `
    <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:10px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">📤 Publishing complete</div>
      ${threadsResult ? `
        <div style="font-size:12px;margin-bottom:8px">
          🧵 Threads: ${threadsResult.ok
            ? `<span style="color:#22c55e">✅ Posted${threadsResult.url ? ` — <a href="${threadsResult.url}" target="_blank" style="color:var(--gold)">View post ↗</a>` : ''}</span>`
            : `<span style="color:var(--red)">❌ Failed — ${threadsResult.error}</span>`}
        </div>` : ''}
      ${manualChannels.length ? `
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Text copied to clipboard. Post manually to:</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${manualChannels.includes('gbp')||manualChannels.includes('google_business')
            ? `<a href="https://business.google.com/posts" target="_blank" class="mkt-btn mkt-btn-primary" style="font-size:11px;text-decoration:none;padding:8px 12px">📍 GBP ↗</a>` : ''}
          ${manualChannels.includes('instagram_feed')
            ? `<a href="https://www.instagram.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">📸 Instagram ↗</a>` : ''}
          ${manualChannels.includes('facebook_post')
            ? `<a href="https://www.facebook.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">👤 Facebook ↗</a>` : ''}
          ${imageUrl ? `<a href="${imageUrl}" download target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">⬇ Download Image</a>` : ''}
        </div>` : ''}
    </div>`;
  showMktToast(threadsResult?.ok ? '✅ Threads posted! Manual channels copied.' : '✅ Content saved — post manually');
}

async function renderCalendar() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading calendar…</div>`);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0];
  const monthLabel = now.toLocaleString('en-IN', {month:'long', year:'numeric'});
  const nextStrategyDate = getNextStrategyDate();

  const [
    {data: calItems},
    {data: contentPosts}
  ] = await Promise.all([
    sb.from('content_calendar').select('*').gte('cal_date', monthStart).lte('cal_date', monthEnd).order('cal_date',{ascending:true}).then(r=>r,()=>({data:[]})),
    sb.from('content_posts').select('id,topic,post_type,status,master_text,reel_script,created_at').gte('created_at', monthStart+'T00:00:00').then(r=>r,()=>({data:[]}))
  ]);
  const strategySessions = null;

  const contentByTopic = {};
  (contentPosts||[]).forEach(p => { contentByTopic[p.topic] = p; });

  const reelDays = (calItems||[]).filter(i => i.is_reel === true || i.content_type==='reel');
  const otherDays = (calItems||[]).filter(i => !i.is_reel && i.content_type!=='reel');

  const TYPE_ICON = {image:'🖼️', reel:'🎬', gif:'✨', festival:'🎉', qa:'❓', offer:'💰', post:'📝'};

  const lastSession = (strategySessions||[])[0];
  const daysSinceSession = lastSession
    ? Math.floor((Date.now() - new Date(lastSession.created_at).getTime()) / 86400000)
    : 999;
  const sessionDue = daysSinceSession >= 12;

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📅 ${monthLabel}</h3>
      <div style="font-size:12px;color:var(--text3)">${(calItems||[]).length} posts planned · ${reelDays.length} reels · ${otherDays.length} other</div>
    </div>
    <button onclick="addCalendarItem()" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 14px">+ Add</button>
  </div>

  <!-- REEL DAYS -->
  ${reelDays.length ? `
  <div style="margin-bottom:20px">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">🎬 Reel days — ${reelDays.length} this month</div>
    <div style="display:grid;gap:10px">
      ${reelDays.map(item => {
        const existing = contentByTopic[item.topic];
        const hasScript = existing?.reel_script;
        const date = new Date(item.cal_date);
        const isPast = date < now;
        const isToday = date.toISOString().split('T')[0] === now.toISOString().split('T')[0];
        return `
        <div class="mkt-card" id="cal-card-${item.id}" style="border-left:3px solid ${isToday?'var(--gold)':hasScript?'#22c55e':'var(--border)'}">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="text-align:center;min-width:44px">
              <div style="font-size:20px;font-weight:900;color:${isToday?'var(--gold)':'var(--text1)'}">${date.getDate()}</div>
              <div style="font-size:10px;color:var(--text3)">${date.toLocaleDateString('en-IN',{weekday:'short',month:'short'})}</div>
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700" id="cal-topic-display-${item.id}">${item.topic||'Untitled reel'}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px" id="cal-notes-display-${item.id}">${item.notes||''}</div>
            </div>
            <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
              <button onclick="editCalendarItemById('${item.id}',true)" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px" title="Edit topic">✏️</button>
              ${hasScript
                ? '<span class="badge badge-green" style="font-size:10px">✅ Script ready</span>'
                : `<button onclick="generateAndShowReelScript('${(item.topic||'').replace(/'/g,"\'")}','${item.id}',this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:5px 10px">🎬 Script</button>`}
            </div>
          </div>
          ${hasScript ? `<div id="reel-script-${item.id}" style="border-top:1px solid var(--border);padding-top:10px">${renderReelScriptInline(existing.reel_script, item.id, existing.id)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  <!-- ALL PLANNED POSTS -->
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">All planned posts</div>
  <div style="display:grid;gap:6px">
    ${(calItems||[]).length ? (calItems||[]).map(item => {
      const existing = contentByTopic[item.topic];
      const date = new Date(item.cal_date);
      const isToday = date.toISOString().split('T')[0] === now.toISOString().split('T')[0];
      const icon = TYPE_ICON[item.content_type||'post']||'📝';
      const statusColor = existing?.status === 'published' ? '#22c55e' : existing?.status === 'pending_approval' ? '#f59e0b' : 'var(--text3)';
      const isReady    = item.status === 'ready';
      const isApproved = item.status === 'approved';
      const hasImage   = !!item.image_url;
      const borderColor = isApproved ? '#22c55e' : isReady ? '#f59e0b' : isToday ? 'rgba(201,168,76,.3)' : 'var(--border)';
      const bgColor     = isApproved ? 'rgba(34,197,94,.06)' : isReady ? 'rgba(245,158,11,.06)' : isToday ? 'rgba(201,168,76,.08)' : 'var(--bg3)';

      const statusBadge = isApproved
        ? `<span style="font-size:9px;background:#064e3b;color:#6ee7b7;padding:2px 6px;border-radius:4px;font-weight:700">✅ APPROVED</span>`
        : isReady
        ? `<span style="font-size:9px;background:#451a03;color:#f59e0b;padding:2px 6px;border-radius:4px;font-weight:700">⏳ READY</span>`
        : existing ? `<span style="font-size:9px;color:${statusColor};font-weight:600">${existing.status}</span>` : '';

      const expandedPanel = (isReady || isApproved) ? `
        <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:10px;display:grid;gap:8px">
          ${item.visual_brief ? `
          <div style="background:var(--bg1);border-radius:6px;padding:8px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <div style="font-size:11px;color:var(--text3)">🎨 ChatGPT image prompt ready</div>
              <button onclick="navigator.clipboard.writeText(this.dataset.p).then(()=>showMktToast('✅ Prompt copied!'))" data-p="${(item.visual_brief||'').replace(/"/g,'&quot;')}" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px;flex-shrink:0">📋 Copy</button>
            </div>
            <div style="font-size:10px;color:var(--gold);line-height:1.8">${buildCalSizesList(item.platform||[])}</div>
          </div>` : ''}
          ${(item.hashtags||[]).length ? `
          <div style="font-size:11px;color:var(--gold);background:var(--bg1);border-radius:6px;padding:8px;line-height:1.7">${(item.hashtags||[]).join(' ')}
            <button onclick="navigator.clipboard.writeText(this.dataset.h).then(()=>showMktToast('✅ Hashtags copied!'))" data-h="${(item.hashtags||[]).join(' ').replace(/"/g,'&quot;')}" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:2px 6px;margin-left:6px">📋</button>
          </div>` : ''}
          ${item.caption ? `
          <div style="background:var(--bg1);border-radius:6px;padding:8px">
            <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">CAPTION</div>
            <div style="font-size:11px;color:var(--text2);line-height:1.5">${(item.caption||'').slice(0,150)}…</div>
          </div>` : ''}
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${hasImage
              ? `<span style="font-size:10px;color:#22c55e">✅ ${item.content_type==='reel'?'Video':'Image'} ready</span>`
              : ''}
            <button onclick="document.getElementById('cal-img-${item.id}').click()" class="mkt-btn ${hasImage?'mkt-btn-ghost':'mkt-btn-primary'}" style="font-size:11px;padding:6px 12px">${item.content_type==='reel'?'🎬 Upload Video':item.content_type==='gif'?'✨ Upload GIF':hasImage?'📸 Replace Image':'📸 Upload Image'}</button>
            ${item.content_type!=='reel'&&item.content_type!=='gif'
              ? `<button onclick="calGeneratePosters('${item.id}')" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px" title="Generate new AI background + poster (uses OpenAI credits)">🤖 Auto Poster</button>
                 ${hasImage?`<button onclick="calGeneratePosters('${item.id}',true)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px" title="Re-apply layout using existing background (free, no OpenAI cost)">🎨 Re-layout</button>`:''}`
              : ''}
            <button onclick="calPreviewPost('${item.id}')" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">👁 Preview</button>
            ${isReady && hasImage
              ? `<button onclick="calApproveItem('${item.id}')" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px;background:#22c55e">✅ Approve & Schedule</button>`
              : isApproved
              ? `<span style="font-size:10px;color:#6ee7b7">📅 Posts at ${item.post_time||'10:00'} IST on ${item.cal_date}</span>`
              : `<span style="font-size:10px;color:var(--text3)">Upload image first</span>`}
            ${isApproved ? `<button onclick="calUnapproveItem('${item.id}')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:4px 8px">↩ Undo</button>` : ''}
          </div>
          <input type="file" id="cal-img-${item.id}" accept="${item.content_type==='reel'?'video/*':'image/*,image/gif'}" style="display:none" onchange="calHandleImageUpload('${item.id}',this)">
        </div>` : '';

      return `
      <div id="cal-row-${item.id}" style="padding:10px 12px;background:${bgColor};border-radius:8px;border:1px solid ${borderColor}">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="text-align:center;min-width:36px">
            <div style="font-size:16px;font-weight:700;color:${isToday?'var(--gold)':'var(--text1)'}">${date.getDate()}</div>
            <div style="font-size:9px;color:var(--text3)">${date.toLocaleDateString('en-IN',{weekday:'short'})}</div>
          </div>
          <span style="font-size:18px">${icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.topic||'Untitled'}</div>
            <div style="font-size:10px;color:var(--text3)">${item.content_type||'post'} ${item.notes?'· '+item.notes.slice(0,40):''}</div>
          </div>
          <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
            ${statusBadge}
            <button onclick="editCalendarItemById('${item.id}',false)" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">✏️</button>
            ${!isApproved ? `<button onclick="calRegenerateItem('${item.id}')" class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:3px 8px">⚡ ${isReady?'Regen':'Create'}</button>` : ''}
          </div>
        </div>
        ${expandedPanel}
      </div>`;
    }).join('') : `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">No posts planned — click + Add or start a Strategy Session above</div>`}
  </div>`);
}

function getNextStrategyDate() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  // Fortnightly = 1st and 15th of each month
  if (day < 15) return new Date(year, month, 15).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  return new Date(year, month+1, 1).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}

// Safe wrapper — looks up item by id from DB to avoid special-char issues in onclick strings
async function editCalendarItemById(id, isReel) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', id).single();
  if (!item) { showMktToast('❌ Could not load item'); return; }
  editCalendarItem(item.id, item.topic || '', item.content_type || (isReel ? 'reel' : 'image'), item.notes || '', isReel);
}

function editCalendarItem(id, currentTopic, type, currentNotes, isReel) {
  const ov = document.createElement('div');
  ov.id = 'edit-cal-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
  ov.innerHTML = `
    <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:420px;border:1px solid var(--border)">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">✏️ Edit calendar day</div>
      <div style="display:grid;gap:10px">
        <div>
          <label class="mkt-form-label">Topic / Campaign name</label>
          <input id="edit-cal-topic" class="mkt-form-input" value="${currentTopic}" placeholder="What is this post about?">
        </div>
        <div>
          <label class="mkt-form-label">Notes for AI (optional)</label>
          <textarea id="edit-cal-notes" class="mkt-form-input" rows="2" placeholder="Any specific angles, products, offers to mention?">${currentNotes}</textarea>
        </div>
        <div>
          <label class="mkt-form-label">Format</label>
          <select id="edit-cal-type" class="mkt-form-select">
            ${[{id:'image',l:'🖼️ Image'},{id:'reel',l:'🎬 Reel'},{id:'gif',l:'✨ GIF'},{id:'festival',l:'🎉 Festival'},{id:'qa',l:'❓ Q&A'}]
              .map(t=>`<option value="${t.id}" ${type===t.id?'selected':''}>${t.l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button onclick="saveEditCalendarItem('${id}')" class="mkt-btn mkt-btn-primary" style="flex:1;padding:10px;font-weight:700">💾 Save & Auto-Generate</button>
        <button onclick="saveEditCalendarItemOnly('${id}')" class="mkt-btn mkt-btn-ghost" style="padding:10px 14px">Save only</button>
        <button onclick="document.getElementById('edit-cal-overlay').remove()" class="mkt-btn mkt-btn-ghost" style="padding:10px 12px">✕</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('edit-cal-topic')?.focus(), 100);
}

async function saveEditCalendarItem(id) {
  const topic = (document.getElementById('edit-cal-topic')?.value||'').trim();
  const notes = document.getElementById('edit-cal-notes')?.value||'';
  const type = document.getElementById('edit-cal-type')?.value||'image';
  if (!topic) { showMktToast('Enter a topic'); return; }
  document.getElementById('edit-cal-overlay')?.remove();

  // Platform distribution by content type
  const platformByType = {
    image:    ['instagram_feed','instagram_story','facebook_post','facebook_story','threads','gbp','whatsapp_story'],
    gif:      ['instagram_feed','instagram_story','facebook_post','facebook_story','threads','whatsapp_story'],
    reel:     ['instagram_feed','instagram_story','facebook_post','facebook_story','threads','youtube','whatsapp_story'],
    festival: ['instagram_feed','instagram_story','facebook_post','facebook_story','threads','gbp','whatsapp_story'],
    qa:       ['instagram_feed','facebook_post','threads'],
    post:     ['instagram_feed','facebook_post','threads'],
  };
  const platforms = platformByType[type] || platformByType['image'];

  // Update the calendar item
  await sb.from('content_calendar').update({
    topic, notes, content_type:type, is_reel:type==='reel',
    platform: platforms,
    status:'planned', updated_at:new Date().toISOString()
  }).eq('id', id);

  showMktToast('⏳ Generating caption + sending approval email…');

  // Trigger pipeline for this specific item
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/content-pipeline', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'generate_single', calendar_id: parseInt(id)})
    });
    const data = await res.json();
    if(data.ok) {
      showMktToast('✅ Done! Check hmehta@vwholesale.in for approval email');
    } else {
      showMktToast('⚠️ ' + (data.error||'Generation failed'));
    }
  } catch(e) {
    showMktToast('❌ ' + e.message);
  }
  renderCalendar();
}

async function saveEditCalendarItemOnly(id) {
  const topic = (document.getElementById('edit-cal-topic')?.value||'').trim();
  const notes = document.getElementById('edit-cal-notes')?.value||'';
  const type = document.getElementById('edit-cal-type')?.value||'image';
  if (!topic) { showMktToast('Enter a topic'); return; }
  document.getElementById('edit-cal-overlay')?.remove();
  await sb.from('content_calendar').update({
    topic, notes, content_type:type, is_reel:type==='reel', updated_at:new Date().toISOString()
  }).eq('id', id);
  showMktToast('✅ Topic updated');
  renderCalendar();
}

async function openStrategySession_OLD() {
  // Load last session for context
  const { data: sessions } = await sb.from('strategy_sessions').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle().then(r=>r,()=>({data:null}));
  const { data: calItems } = await sb.from('content_calendar').select('topic,content_type,cal_date').gte('cal_date', new Date().toISOString().split('T')[0]).order('cal_date',{ascending:true}).limit(20).then(r=>r,()=>({data:[]}));

  const existingTopics = (calItems||[]).map(c=>`${new Date(c.cal_date).getDate()} ${new Date(c.cal_date).toLocaleString('en-IN',{month:'short'})} — ${c.topic}`).join('\n');
  const now = new Date();
  const monthLabel = now.toLocaleString('en-IN',{month:'long',year:'numeric'});

  const ov = document.createElement('div');
  ov.id = 'strategy-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;overflow-y:auto;padding:20px';
  ov.innerHTML = `
    <div style="max-width:560px;margin:0 auto;background:var(--bg2);border-radius:12px;padding:20px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div style="font-size:16px;font-weight:900">🧠 Strategy Session — ${monthLabel}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Fortnightly planning — human + AI brain working together</div>
        </div>
        <button onclick="document.getElementById('strategy-overlay').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
      </div>

      ${sessions ? `
      <div style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px">
        <div style="font-weight:700;color:var(--gold);margin-bottom:4px">Last session — ${new Date(sessions.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
        <div style="color:var(--text2);line-height:1.7">${sessions.summary||'No summary recorded'}</div>
      </div>` : ''}

      ${existingTopics ? `
      <div style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px">
        <div style="font-weight:700;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Current calendar</div>
        <div style="color:var(--text2);line-height:1.9;white-space:pre-wrap">${existingTopics}</div>
      </div>` : ''}

      <div style="display:grid;gap:10px;margin-bottom:14px">
        <div>
          <label class="mkt-form-label">What's happening this month? <span style="color:var(--text3);font-weight:400">(promotions, new stock, events, festivals, season)</span></label>
          <textarea id="ss-happening" class="mkt-form-input" rows="3" placeholder="e.g. New marble shipment arrived. Bakrid next week. Monsoon season — good time for waterproofing push. Running 10% off on sanitaryware..."></textarea>
        </div>
        <div>
          <label class="mkt-form-label">Who do you want to reach? <span style="color:var(--text3);font-weight:400">(focus this fortnight)</span></label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            ${['Home owners','Contractors','Architects','Interior Designers','Builders'].map(a=>`
            <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:5px 10px">
              <input type="checkbox" name="ss-audience" value="${a}" style="accent-color:var(--gold)"> ${a}
            </label>`).join('')}
          </div>
        </div>
        <div>
          <label class="mkt-form-label">Any specific products or categories to push?</label>
          <input id="ss-products" class="mkt-form-input" placeholder="e.g. Italian marble, Jaquar sanitaryware, Asian Paints, vitrified tiles">
        </div>
        <div>
          <label class="mkt-form-label">Any topics you want AI to suggest for?</label>
          <textarea id="ss-ideas" class="mkt-form-input" rows="2" placeholder="e.g. something about monsoon renovation, a reel showing our showroom, contractor success story..."></textarea>
        </div>
        <div>
          <label class="mkt-form-label">Your notes / context for AI <span style="color:var(--text3);font-weight:400">(anything else)</span></label>
          <textarea id="ss-notes" class="mkt-form-input" rows="2" placeholder="e.g. We had low footfall last week. Competitors are running ads. A contractor brought 3 customers this week..."></textarea>
        </div>
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="runStrategySession()" class="mkt-btn mkt-btn-primary" style="flex:1;padding:12px;font-size:13px;font-weight:700">🧠 Generate Content Plan with AI</button>
        <button onclick="document.getElementById('strategy-overlay').remove()" class="mkt-btn mkt-btn-ghost" style="padding:12px 16px">Cancel</button>
      </div>

      <div id="ss-output" style="margin-top:16px"></div>
    </div>`;
  document.body.appendChild(ov);
}

async function runStrategySession() {
  const happening = (document.getElementById('ss-happening')?.value||'').trim();
  const products = (document.getElementById('ss-products')?.value||'').trim();
  const ideas = (document.getElementById('ss-ideas')?.value||'').trim();
  const notes = (document.getElementById('ss-notes')?.value||'').trim();
  const audiences = [...document.querySelectorAll('input[name="ss-audience"]:checked')].map(el=>el.value);

  const out = document.getElementById('ss-output');
  if (out) out.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">⏳ AI is planning your content strategy…</div>';

  try {
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate() - now.getDate();
    const { data: existing } = await sb.from('content_calendar').select('topic,content_type,cal_date').gte('cal_date', now.toISOString().split('T')[0]).lte('cal_date', new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0]).order('cal_date',{ascending:true}).then(r=>r,()=>({data:[]}));

    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Strategy Session',
        prompt: `You are the marketing strategist for V Wholesale, Vijayawada — a premium home building materials store. Home Depot for Tier 2 India. Target: Vijayawada + 100km radius (Guntur, Eluru, Tenali, Mangalagiri).

STRATEGY SESSION — ${now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
Days remaining this month: ${daysLeft}
Primary audiences this fortnight: ${audiences.join(', ')||'Home owners, Contractors'}

WHAT IS HAPPENING:
${happening||'Normal month'}

PRODUCTS TO PUSH:
${products||'Tiles, Granite, Marble, Sanitaryware'}

HUMAN IDEAS:
${ideas||'None specific'}

ADDITIONAL CONTEXT:
${notes||'None'}

EXISTING CALENDAR:
${(existing||[]).map(c=>`${c.cal_date}: ${c.topic} (${c.content_type})`).join('\n')||'Empty — suggest full plan'}

Based on everything above, create a smart content plan. Return JSON:
{
  "summary": "2-3 sentence summary of this fortnight strategy",
  "key_themes": ["theme1","theme2","theme3"],
  "suggested_posts": [
    {
      "suggested_date": "2026-07-XX",
      "topic": "specific compelling topic",
      "content_type": "image|reel|festival|qa",
      "notes": "angle to take, what to show, key message",
      "audience": "who this targets",
      "why": "why this topic works right now"
    }
  ],
  "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "hashtags": ["#Vijayawada","#HomeRenovation","...15 total"],
  "avoid": "what NOT to post this fortnight and why"
}`,
        context: { happening, products, ideas, audiences }
      })
    });

    const data = await res.json();
    const plan = data.output;
    if (!plan) throw new Error('Strategy generation failed');

    if (out) out.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:16px">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">🧠 AI Content Strategy</div>

        <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:12px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">STRATEGY SUMMARY</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.8">${plan.summary||''}</div>
          ${plan.key_themes?.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${plan.key_themes.map(t=>`<span style="background:var(--bg3);border-radius:12px;padding:3px 10px;font-size:11px;color:var(--gold)">${t}</span>`).join('')}</div>` : ''}
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase">SUGGESTED POSTS (${(plan.suggested_posts||[]).length})</div>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          ${(plan.suggested_posts||[]).map((post,i)=>`
          <div style="background:var(--bg3);border-radius:8px;padding:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <div style="font-size:12px;font-weight:700">${post.topic}</div>
              <div style="font-size:10px;color:var(--text3);flex-shrink:0;margin-left:8px">${post.suggested_date}</div>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:6px">${post.content_type} · ${post.audience} · ${post.why}</div>
            <div style="font-size:11px;color:var(--text2)">${post.notes}</div>
            <button onclick="addSuggestedPost('${post.topic.replace(/'/g,"\'")}','${post.content_type}','${post.suggested_date}','${(post.notes||'').replace(/'/g,"\'").replace(/\n/g,' ')}',this)"
              class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:4px 10px;margin-top:8px">+ Add to Calendar</button>
          </div>`).join('')}
        </div>

        ${plan.keywords?.length ? `
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase">SEO KEYWORDS</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">${plan.keywords.map(k=>`<span style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:3px 10px;font-size:11px;color:var(--text2)">${k}</span>`).join('')}</div>
        </div>` : ''}

        ${plan.hashtags?.length ? `
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase">HASHTAG SET</div>
          <div style="font-size:11px;color:var(--text2);line-height:1.8">${plan.hashtags.join(' ')}</div>
          <button onclick="navigator.clipboard.writeText('${plan.hashtags.join(' ')}').then(()=>showMktToast('📋 Hashtags copied!'))" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:4px 10px;margin-top:6px">📋 Copy Hashtags</button>
        </div>` : ''}

        ${plan.avoid ? `
        <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:8px;padding:10px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#ef4444;margin-bottom:4px">⚠️ AVOID THIS FORTNIGHT</div>
          <div style="font-size:11px;color:var(--text2)">${plan.avoid}</div>
        </div>` : ''}

        <button onclick="saveStrategySession('${(plan.summary||'').replace(/'/g,"\'")}','${(plan.key_themes||[]).join(', ').replace(/'/g,"\'")}',this)" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">💾 Save Session & Apply to Calendar</button>
      </div>`;

  } catch(e) {
    if (out) out.innerHTML = `<div style="color:var(--red);padding:10px">❌ ${e.message}</div>`;
    showMktToast('❌ '+e.message);
  }
}

async function addSuggestedPost(topic, type, date, notes, btn) {
  if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }
  try {
    await sb.from('content_calendar').insert({
      topic, content_type:type, cal_date:date, notes, is_reel:type==='reel',
      status:'planned', created_at:new Date().toISOString()
    });
    if (btn) { btn.textContent = '✅ Added'; btn.style.background='#22c55e'; btn.style.color='#000'; }
    showMktToast('✅ "'+topic+'" added to calendar');
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) { btn.textContent = '+ Add to Calendar'; btn.disabled = false; }
  }
}

async function saveStrategySession(summary, themes, btn) {
  if (btn) { btn.textContent = '⏳ Saving…'; btn.disabled = true; }
  try {
    await sb.from('strategy_sessions').insert({
      summary, key_themes:themes, created_at:new Date().toISOString()
    });
    showMktToast('✅ Strategy session saved!');
    document.getElementById('strategy-overlay')?.remove();
    renderCalendar();
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) { btn.textContent = '💾 Save Session'; btn.disabled = false; }
  }
}


async function generateAndShowReelScript(topic, calId, btn, regenerate) {
  if (!topic) { showMktToast('No topic for this reel'); return; }
  if (btn) { btn.textContent = '⏳ Writing script…'; btn.disabled = true; }

  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Reel Script Generator',
        prompt: `Write a complete Instagram Reel / YouTube Shorts script for V Wholesale, Vijayawada.

TOPIC: ${topic}
STORE: V Wholesale | Visit V Wholesale| 8712697930 | vwholesale.in
CATEGORIES: Tiles, Granite, Marble, Sanitaryware, Paints, Electricals

Return JSON:
{
  "duration": "30-45 seconds",
  "hook": "First 3 seconds — spoken line or text to stop the scroll",
  "telugu_hook": "Same hook in Telugu script for Telugu version",
  "shots": [
    {"scene": 1, "what_to_film": "specific instruction", "onscreen_text": "text overlay", "duration_sec": 5},
    {"scene": 2, "what_to_film": "specific instruction", "onscreen_text": "text overlay", "duration_sec": 8},
    {"scene": 3, "what_to_film": "specific instruction", "onscreen_text": "text overlay", "duration_sec": 8},
    {"scene": 4, "what_to_film": "specific instruction", "onscreen_text": "text overlay", "duration_sec": 7},
    {"scene": 5, "what_to_film": "specific instruction", "onscreen_text": "CTA text", "duration_sec": 7}
  ],
  "voiceover": "Full spoken script matching the shots",
  "caption": "Instagram caption with strong hook first line, then copy, then hashtags",
  "best_time_to_post": "e.g. Tuesday 7:00pm",
  "topic": "${topic}"
}`,
        context: { topic }
      })
    });
    const data = await res.json();
    const script = data.output;
    if (!script || typeof script !== 'object') throw new Error('Script generation failed');

    // Save to content_posts
    const { data: existing } = await sb.from('content_posts').select('id').eq('topic', topic).maybeSingle().then(r=>r,()=>({data:null}));
    if (existing?.id) {
      await sb.from('content_posts').update({reel_script: script, post_type:'reel', status:'scripted', updated_at:new Date().toISOString()}).eq('id', existing.id);
    } else {
      await sb.from('content_posts').insert({topic, post_type:'reel', reel_script:script, status:'scripted', language:'bilingual', created_at:new Date().toISOString(), updated_at:new Date().toISOString()});
    }

    // Update calendar item status
    if (calId) await sb.from('content_calendar').update({status:'scripted'}).eq('id', calId);

    // Show inline
    const scriptEl = document.getElementById('reel-script-'+calId);
    if (scriptEl) {
      scriptEl.style.display = 'block';
      scriptEl.style.borderTop = '1px solid var(--border)';
      scriptEl.style.paddingTop = '10px';
      scriptEl.innerHTML = renderReelScriptInline(script, calId, existing?.id||'');
    }
    if (btn) btn.outerHTML = '<span class="badge badge-green">✅ Script ready</span>';
    showMktToast('✅ Script ready — scroll down to see it');
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) { btn.textContent = '🎬 Generate Script'; btn.disabled = false; }
  }
}

async function uploadReel(input, calId, postId) {
  const file = input.files[0];
  if (!file) return;
  const maxMB = 200;
  if (file.size > maxMB*1024*1024) { showMktToast('Video must be under '+maxMB+'MB'); return; }

  const statusEl = document.getElementById('reel-upload-status-'+calId);
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--gold)">⏳ Uploading reel… ('+Math.round(file.size/1024/1024)+'MB)</span>';

  try {
    const fileName = 'reels/'+Date.now()+'_'+file.name.replace(/[^a-z0-9._]/gi,'_').toLowerCase();
    const { error } = await sb.storage.from('marketing-assets').upload(fileName, file, {contentType:file.type, upsert:true});
    if (error) throw new Error(error.message);

    const { data: urlData } = sb.storage.from('marketing-assets').getPublicUrl(fileName);
    const videoUrl = urlData.publicUrl;

    // Update content post with video URL
    if (postId) {
      await sb.from('content_posts').update({master_image_url: videoUrl, status:'recorded', updated_at:new Date().toISOString()}).eq('id', postId);
    }
    // Update calendar
    if (calId) await sb.from('content_calendar').update({status:'recorded'}).eq('id', calId).then(()=>{}).catch(()=>{});

    if (statusEl) statusEl.innerHTML = '<span style="color:#22c55e">✅ Reel uploaded! <a href="'+videoUrl+'" target="_blank" style="color:var(--gold)">View ↗</a></span>';
    showMktToast('✅ Reel uploaded and saved!');
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">❌ Upload failed: '+e.message+'</span>';
    showMktToast('❌ Upload failed: '+e.message);
  }
}

async function quickCreateFromCalendar(topic, type, language) {
  if (!topic) return;
  // Show inline generation status on the calendar card
  const btn = event?.target;
  if (btn) { btn.textContent = '⏳ Generating…'; btn.disabled = true; }
  showMktToast('⚡ Auto-creating content for: ' + topic);

  try {
    const lang = type === 'festival' ? 'te' : (language || 'bilingual');
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'Calendar Auto-Creator',
        prompt: `Create a social media post for V Wholesale, Vijayawada.

TOPIC: ${topic}
FORMAT: ${type || 'image'}
LANGUAGE: ${lang === 'bilingual' ? 'Telugu headline + English body' : lang === 'te' ? 'Full Telugu' : lang === 'hi' ? 'Hindi' : lang === 'ta' ? 'Tamil' : lang === 'kn' ? 'Kannada' : 'English'}
STORE: V Wholesale | Visit V Wholesale| 8712697930 | vwholesale.in
PRODUCTS: Tiles, Granite, Marble, Sanitaryware, Paints, Electricals

Return JSON:
{
  "master_text": "Full post copy ready to publish (hook + body + CTA)",
  "gbp_text": "GBP version — no hashtags, professional tone, under 300 chars",
  "instagram_caption": "Instagram version with hook + hashtags (12-15)",
  "facebook_text": "Facebook version — slightly longer, warm tone",
  "threads_text": "Threads version — conversational, under 200 chars",
  "whatsapp_text": "WhatsApp broadcast — personal, action-oriented",
  "hashtags": ["#Vijayawada","#HomeRenovation","...10 more"],
  "image_prompt": "Detailed description for AI image generation",
  "gif_frames": "If content_type is gif: describe 3 frames for before/after or product loop animation",
  "best_time": "e.g. Tuesday 7:00pm"
}`,
        context: { topic, type, language: lang }
      })
    });
    const data = await res.json();
    const content = data.output;
    if (!content) throw new Error('Generation failed');

    // Save to content_posts
    const { data: saved, error } = await sb.from('content_posts').upsert({
      topic,
      post_type: type || 'image',
      language: lang,
      master_text: content.master_text || '',
      status: 'pending_approval',
      reel_script: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'topic' }).select().single().then(r=>r,()=>({data:null,error:'save failed'}));

    // Save channel adaptations
    if (saved?.id) {
      const channelRows = [
        {content_post_id:saved.id, channel:'gbp',           adapted_text:content.gbp_text||'',           status:'pending_approval'},
        {content_post_id:saved.id, channel:'instagram_feed', adapted_text:content.instagram_caption||'',  status:'pending_approval'},
        {content_post_id:saved.id, channel:'facebook_post',  adapted_text:content.facebook_text||'',      status:'pending_approval'},
        {content_post_id:saved.id, channel:'threads',        adapted_text:content.threads_text||'',       status:'pending_approval'},
        {content_post_id:saved.id, channel:'whatsapp_bc',    adapted_text:content.whatsapp_text||'',      status:'pending_approval'},
      ].filter(r => r.adapted_text);
      await sb.from('channel_posts').upsert(channelRows, {onConflict:'content_post_id,channel'}).then(()=>{}).catch(()=>{});
    }

    // Update calendar status
    await sb.from('content_calendar').update({status:'scripted',updated_at:new Date().toISOString()}).eq('topic', topic).then(()=>{}).catch(()=>{});

    // Send for approval notification
    await sb.from('agent_notifications').insert({
      agent_name: 'Calendar Auto-Creator',
      notification_type: 'approval_request',
      message: 'New post ready for approval:\n\nTopic: "'+topic+'"\nType: '+type+'\nLanguage: '+lang+'\n\n'+content.master_text?.slice(0,200)+'\n\nBest time: '+(content.best_time||'TBD'),
      action_required: true,
      response: 'pending',
      created_at: new Date().toISOString()
    }).then(()=>{}).catch(()=>{});

    showMktToast('✅ Content created and sent for approval!');
    // Refresh calendar to show updated status
    setTimeout(() => renderCalendar(), 600);
  } catch(e) {
    showMktToast('❌ '+e.message);
    if (btn) { btn.textContent = '⚡ Auto-Create'; btn.disabled = false; }
  }
}

function addCalendarItem(defaultType) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
  ov.innerHTML = `
    <div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:400px;border:1px solid var(--border)">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">Add to calendar</div>
      <div style="display:grid;gap:8px">
        <input id="cal-topic" class="mkt-form-input" placeholder="Topic / campaign name">
        <input id="cal-date" class="mkt-form-input" type="date" value="${new Date().toISOString().split('T')[0]}">
        <select id="cal-type" class="mkt-form-select">
          ${[{id:'image',l:'🖼️ Image'},{id:'reel',l:'🎬 Reel'},{id:'gif',l:'✨ GIF'},{id:'festival',l:'🎉 Festival'},{id:'qa',l:'❓ Q&A'}]
            .map(t=>`<option value="${t.id}" ${defaultType===t.id?'selected':''}>${t.l}</option>`).join('')}
        </select>
        <select id="cal-lang" class="mkt-form-select">
          <option value="bilingual">Bilingual (recommended)</option>
          <option value="te">Telugu</option>
          <option value="en">English</option>
        </select>
        <textarea id="cal-notes" class="mkt-form-input" rows="2" placeholder="Notes (optional)"></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button onclick="saveCalendarItem()" class="mkt-btn mkt-btn-primary" style="flex:1;padding:10px;font-size:13px;font-weight:700">Save</button>
        <button onclick="this.closest('[style*=fixed]').remove()" class="mkt-btn mkt-btn-ghost" style="padding:10px 16px">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('cal-topic')?.focus(), 100);
}

async function saveCalendarItem() {
  const topic = (document.getElementById('cal-topic')?.value||'').trim();
  const date = document.getElementById('cal-date')?.value;
  const type = document.getElementById('cal-type')?.value||'image';
  const notes = document.getElementById('cal-notes')?.value||'';
  if (!topic || !date) { showMktToast('Enter topic and date'); return; }

  await sb.from('content_calendar').insert({topic, cal_date:date, content_type:type, is_reel:type==='reel', notes, status:'planned', created_at:new Date().toISOString()});
  document.querySelector('[style*="fixed"][style*="z-index:99999"]')?.remove();
  showMktToast('✅ Added to calendar');
  renderCalendar();
}


async function loadCalendar() {
  const monthName = new Date(_calYear, _calMonth, 1).toLocaleString("en-IN", {month:"long", year:"numeric"});
  const btn = document.getElementById("cal-month-label");
  if (btn) btn.textContent = monthName;

  // Load from DB
  const firstDay = `${_calYear}-${String(_calMonth+1).padStart(2,"0")}-01`;
  const lastDay  = `${_calYear}-${String(_calMonth+1).padStart(2,"0")}-${new Date(_calYear,_calMonth+1,0).getDate()}`;

  const [{data:items},{data:festivals}] = await Promise.all([
    sb.from("content_calendar").select("*").gte("cal_date",firstDay).lte("cal_date",lastDay).order("cal_date",{ascending:true}).then(r=>r,()=>({data:[]})),
    sb.from("festival_calendar").select("*").gte("festival_date",firstDay).lte("festival_date",lastDay).then(r=>r,()=>({data:[]}))
  ]);

  _calItems = items || [];
  _calFestivals = festivals || [];

  renderCalGrid();
  renderCalSummary();
  renderCalReels();
}

function renderCalGrid() {
  const grid = document.getElementById("cal-grid");
  if (!grid) return;

  const firstDay = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today = new Date();

  let html = "";
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div style="min-height:64px"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${_calYear}-${String(_calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayItems = _calItems.filter(i => i.cal_date === dateStr);
    const dayFests = _calFestivals.filter(f => f.festival_date === dateStr);
    const isToday = today.getFullYear()===_calYear && today.getMonth()===_calMonth && today.getDate()===d;
    const isReel = dayItems.some(i=>i.is_reel);
    const hasFest = dayFests.length > 0;
    const allDone = dayItems.length > 0 && dayItems.every(i=>i.status==="published");
    const hasDraft = dayItems.some(i=>["planned","scripted","ready"].includes(i.status));

    const bg = isToday ? "rgba(201,168,76,0.15)" : "var(--bg3)";
    const border = isToday ? "1px solid var(--gold)" : hasFest ? "1px solid rgba(139,92,246,0.4)" : "1px solid var(--border)";

    html += `<div onclick="calSelectDay(${d},'${dateStr}')" style="min-height:64px;background:${bg};border:${border};border-radius:6px;padding:4px;cursor:pointer;position:relative" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='${isToday?'var(--gold)':hasFest?'rgba(139,92,246,0.4)':'var(--border)'}'">
      <div style="font-size:11px;font-weight:${isToday?'900':'600'};color:${isToday?'var(--gold)':'var(--text1)'};">${d}</div>
      ${hasFest ? `<div style="font-size:9px;color:#8b5cf6;line-height:1.2;margin-top:1px;overflow:hidden;max-height:20px">${dayFests[0].festival_name.slice(0,14)}</div>` : ''}
      ${dayItems.slice(0,2).map(i=>`<div style="font-size:9px;padding:1px 3px;border-radius:3px;margin-top:1px;background:${i.status==='published'?'rgba(34,197,94,0.2)':i.status==='ready'?'rgba(59,130,246,0.2)':'rgba(201,168,76,0.15)'};color:${i.status==='published'?'#22c55e':i.status==='ready'?'#3b82f6':'var(--gold)'};overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${i.content_type==='reel'?'🎬':i.is_festival?'🎉':'📝'} ${(i.title||i.topic||'').slice(0,12)}</div>`).join('')}
      ${dayItems.length > 2 ? `<div style="font-size:9px;color:var(--text3)">+${dayItems.length-2} more</div>` : ''}
    </div>`;
  }

  grid.innerHTML = html;
}

function renderCalSummary() {
  const el = document.getElementById("cal-summary");
  if (!el) return;
  const total = _calItems.length;
  const published = _calItems.filter(i=>i.status==="published").length;
  const reels = _calItems.filter(i=>i.is_reel).length;
  const festivals = _calFestivals.length;
  const planned = _calItems.filter(i=>i.status==="planned").length;

  el.innerHTML = [
    {icon:"📝", label:"Total Posts", val:total},
    {icon:"✅", label:"Published", val:published},
    {icon:"🎬", label:"Reels", val:reels},
    {icon:"🎉", label:"Festivals", val:festivals},
    {icon:"📋", label:"Planned", val:planned}
  ].map(m=>`<div class="mkt-card" style="padding:10px;text-align:center">
    <div style="font-size:18px">${m.icon}</div>
    <div style="font-size:18px;font-weight:900;margin:2px 0">${m.val}</div>
    <div style="font-size:10px;color:var(--text3)">${m.label}</div>
  </div>`).join("");
}

function renderCalReels() {
  const el = document.getElementById("cal-reels");
  if (!el) return;
  const reels = _calItems.filter(i=>i.is_reel).sort((a,b)=>a.cal_date.localeCompare(b.cal_date));
  if (!reels.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--text3)">No reels planned this month — use AI Plan Month to generate the schedule</div>`;
    return;
  }
  el.innerHTML = `<div style="font-size:12px;color:var(--text2);margin-bottom:10px">📌 Schedule a cameraman for these dates</div>
  <div style="display:grid;gap:6px">` +
  reels.map(r=>`<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:8px;padding:10px">
    <div style="font-size:20px">🎬</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700">${r.topic||r.title||"Reel"}</div>
      <div style="font-size:11px;color:var(--text3)">${new Date(r.cal_date).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</div>
      ${r.reel_script ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${r.reel_script.slice(0,80)}…</div>` : ""}
    </div>
    <span class="badge ${r.status==="published"?"badge-green":r.status==="ready"?"badge-blue":"badge-gray"}">${r.status}</span>
  </div>`).join("") + "</div>";
}

function calSelectDay(d, dateStr) {
  const panel = document.getElementById("cal-day-panel");
  if (!panel) return;
  const dayItems = _calItems.filter(i=>i.cal_date===dateStr);
  const dayFests = _calFestivals.filter(f=>f.festival_date===dateStr);
  const dateLabel = new Date(dateStr+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  panel.style.display = "block";
  panel.innerHTML = `<div class="mkt-card" style="margin-bottom:14px;border:1px solid var(--gold)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:14px;font-weight:900">${dateLabel}</div>
      <div style="display:flex;gap:6px">
        <button class="mkt-btn mkt-btn-primary" onclick="showAddCalItem('${dateStr}')" style="font-size:11px">+ Add Post</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('cal-day-panel').style.display='none'" style="font-size:11px">✕</button>
      </div>
    </div>
    ${dayFests.map(f=>`<div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:10px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:700;color:#8b5cf6">🎉 ${f.festival_name}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${f.description||""}</div>
      ${(f.content_ideas||[]).length?`<div style="font-size:11px;color:var(--text2);margin-top:4px">Ideas: ${f.content_ideas.join(" · ")}</div>`:""}
      <button class="mkt-btn mkt-btn-ghost" onclick="addFestivalPost('${dateStr}','${f.festival_name.replace(/'/g,"\'")}','${(f.content_ideas||[])[0]||""}')" style="font-size:10px;margin-top:6px">+ Create Festival Post</button>
    </div>`).join("")}
    ${dayItems.length===0&&dayFests.length===0?`<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">No content planned — click + Add Post</div>`:""}
    <div style="display:grid;gap:8px">
      ${dayItems.map(item=>`<div style="background:var(--bg3);border-radius:8px;padding:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:16px">${item.is_reel?"🎬":item.is_festival?"🎉":"📝"}</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700">${item.title||item.topic||"Post"}</div>
            <div style="font-size:11px;color:var(--text3)">${item.content_type} · ${(item.platform||[]).join(", ")||"—"}</div>
          </div>
          <span class="badge ${item.status==="published"?"badge-green":item.status==="ready"?"badge-blue":item.status==="scripted"?"badge-blue":"badge-gray"}">${item.status}</span>
        </div>
        ${item.topic?`<div style="font-size:11px;color:var(--text2);margin-bottom:6px">${item.topic}</div>`:""}
        ${item.reel_script?`<div style="font-size:11px;background:var(--bg2);border-radius:6px;padding:8px;white-space:pre-wrap;margin-bottom:6px;line-height:1.5">${item.reel_script}</div>`:""}
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="mkt-btn mkt-btn-primary" onclick="generateCalItemContent(${item.id})" style="font-size:10px;padding:3px 8px">🤖 Generate Content</button>
          <button class="mkt-btn mkt-btn-ghost" onclick="updateCalStatus(${item.id},'${item.status}')" style="font-size:10px;padding:3px 8px">
            ${item.status==="planned"?"✏️ Mark Scripted":item.status==="scripted"?"✅ Mark Ready":item.status==="ready"?"📤 Mark Published":"✓ Done"}
          </button>
          <button class="mkt-btn mkt-btn-ghost" onclick="deleteCalItem(${item.id})" style="font-size:10px;padding:3px 8px;color:var(--red)">🗑</button>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
  panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function showAddCalItem(dateStr) {
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto";
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">+ Add Post — ${new Date(dateStr+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:10px">
      <div class="mkt-form-group"><label class="mkt-form-label">Content Type</label>
        <select id="ci-type" class="mkt-form-select">
          <option value="post">📝 Post (Photo/Graphic)</option>
          <option value="reel">🎬 Reel (Video)</option>
          <option value="story">💫 Story</option>
          <option value="festival">🎉 Festival Post</option>
          <option value="offer">💰 Offer / Promotion</option>
          <option value="gbp">📍 GBP Update</option>
          <option value="blog">📄 Blog Article</option>
        </select></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Title / Topic *</label>
        <input id="ci-topic" class="mkt-form-input" placeholder="e.g. Kajaria Premium Tiles — Monsoon Special"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Platforms</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${["Instagram","Facebook","WhatsApp","GBP","YouTube","X"].map(p=>`<label style="font-size:11px;background:var(--bg3);padding:4px 8px;border-radius:5px;cursor:pointer;display:flex;align-items:center;gap:4px"><input type="checkbox" value="${p}" ${["Instagram","Facebook"].includes(p)?"checked":""}> ${p}</label>`).join("")}
        </div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="mkt-form-group"><label class="mkt-form-label">Priority</label>
          <select id="ci-priority" class="mkt-form-select"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></div>
        <div class="mkt-form-group" style="display:flex;align-items:center;gap:8px;padding-top:20px">
          <label style="font-size:12px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="ci-reel"> Is a Reel shoot</label>
        </div>
      </div>
      <div class="mkt-form-group"><label class="mkt-form-label">Notes (optional)</label>
        <input id="ci-notes" class="mkt-form-input" placeholder="Any specific instructions or ideas"></div>
      <button class="mkt-btn mkt-btn-primary" onclick="saveCalItem('${dateStr}')" style="width:100%">Save to Calendar</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e=>{if(e.target===m)m.remove();});
}

async function saveCalItem(dateStr) {
  const topic = (document.getElementById("ci-topic")?.value||"").trim();
  if (!topic) { showMktToast("Enter a topic"); return; }
  const type = document.getElementById("ci-type")?.value||"post";
  const platforms = [...document.querySelectorAll('[style*="fixed"] input[type=checkbox]:checked')].map(cb=>cb.value).filter(v=>["Instagram","Facebook","WhatsApp","GBP","YouTube","X"].includes(v));
  const isReel = document.getElementById("ci-reel")?.checked||false;

  await sb.from("content_calendar").insert({
    cal_date: dateStr, content_type: type, topic, title: topic,
    platform: platforms, is_reel: isReel,
    priority: document.getElementById("ci-priority")?.value||"normal",
    notes: document.getElementById("ci-notes")?.value||null,
    status: "planned", created_by: mktProfile?.name
  });

  document.querySelector("[style*=fixed]")?.remove();
  showMktToast("✅ Added to calendar");
  await loadCalendar();
  calSelectDay(parseInt(dateStr.split("-")[2]), dateStr);
}

async function addFestivalPost(dateStr, festName, idea) {
  await sb.from("content_calendar").insert({
    cal_date: dateStr, content_type: "festival",
    title: festName, topic: idea || festName,
    festival_name: festName, is_festival: true,
    platform: ["Instagram","Facebook","GBP"],
    status: "planned", priority: "high",
    created_by: mktProfile?.name
  });
  showMktToast("✅ Festival post added");
  await loadCalendar();
  calSelectDay(parseInt(dateStr.split("-")[2]), dateStr);
}

async function updateCalStatus(id, current) {
  const next = {planned:"scripted", scripted:"ready", ready:"published", published:"planned"}[current]||"scripted";
  await sb.from("content_calendar").update({status:next, updated_at:new Date().toISOString()}).eq("id",id);
  showMktToast(`Status → ${next}`);
  await loadCalendar();
}

async function deleteCalItem(id) {
  if (!confirm("Remove this from calendar?")) return;
  await sb.from("content_calendar").delete().eq("id",id);
  showMktToast("Removed");
  await loadCalendar();
}

async function generateCalItemContent(id) {
  const {data:item} = await sb.from("content_calendar").select("*").eq("id",id).single().then(r=>r,()=>({data:null}));
  if (!item) return;
  showMktToast("🤖 Generating content…");
  const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
    method:"POST", headers:{"Content-Type":"application/json","apikey":MKT_SB_KEY},
    body:JSON.stringify({
      task: item.is_reel ? "reel_script" : "social_post",
      platform: (item.platform||["Instagram"])[0],
      language: "te+en", topic: item.topic||item.title,
      context:{business:"V Wholesale",location:"Vijayawada",type:item.content_type,festival:item.festival_name}
    })
  });
  const data = await res.json();
  const content = data.content||data.text||"";
  if (!content) { showMktToast("❌ Failed"); return; }

  const update = item.is_reel
    ? {reel_script: content, status:"scripted"}
    : {caption: content, status:"scripted"};
  await sb.from("content_calendar").update({...update, updated_at:new Date().toISOString()}).eq("id",id);
  showMktToast("✅ Content generated");
  await loadCalendar();
}

function calPrevMonth() { if (_calMonth === 0) { _calMonth=11; _calYear--; } else { _calMonth--; } loadCalendar(); }
function calNextMonth() { if (_calMonth === 11) { _calMonth=0; _calYear++; } else { _calMonth++; } loadCalendar(); }
function calGoToday() { _calYear=new Date().getFullYear(); _calMonth=new Date().getMonth(); loadCalendar(); }

function showCalPlanModal() {
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  const monthName = new Date(_calYear, _calMonth, 1).toLocaleString("en-IN",{month:"long",year:"numeric"});
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">🤖 AI Plan — ${monthName}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      <div style="font-size:13px;color:var(--text2);line-height:1.6">AI will create a complete month plan including:
        <ul style="margin:8px 0 0 16px;font-size:12px;color:var(--text3)">
          <li>Posts every Mon/Wed/Fri + weekend</li>
          <li>Reel on every 3rd day</li>
          <li>Festival posts auto-added</li>
          <li>Mix of product, offer, contractor, story content</li>
        </ul>
      </div>
      <div class="mkt-form-group"><label class="mkt-form-label">Focus for this month (optional)</label>
        <input id="plan-focus" class="mkt-form-input" placeholder="e.g. Push tiles + monsoon bathroom, Contractor Club recruitment"></div>
      <button class="mkt-btn mkt-btn-primary" onclick="runAIMonthPlan()" style="width:100%;padding:12px;font-size:14px;font-weight:900">🚀 Generate Month Plan</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click",e=>{if(e.target===m)m.remove();});
}

async function runAIMonthPlan() {
  const focus = (document.getElementById("plan-focus")?.value||"").trim();
  document.querySelector("[style*=fixed]")?.remove();
  showMktToast("🤖 Planning the month… this takes ~20 seconds");

  const monthName = new Date(_calYear, _calMonth, 1).toLocaleString("en-IN",{month:"long",year:"numeric"});
  const daysInMonth = new Date(_calYear, _calMonth+1, 0).getDate();
  const festivalsThisMonth = _calFestivals.map(f=>f.festival_name).join(", ");

  const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
    method:"POST", headers:{"Content-Type":"application/json","apikey":MKT_SB_KEY},
    body:JSON.stringify({
      task:"month_plan", language:"en",
      topic:`Content plan for ${monthName}`,
      context:{
        business:"V Wholesale", location:"Vijayawada, Andhra Pradesh",
        month: monthName, days_in_month: daysInMonth,
        festivals: festivalsThisMonth||"none this month",
        focus: focus||"balanced mix of product showcase, offers, contractor club, customer stories",
        categories:"Tiles, Granite, Marble, Sanitaryware, Bathroom Fittings, Paints, Electricals, Flooring",
        posting_days:"Mon Wed Fri every week, Sat optional, Reel every 3rd day",
        reel_note:"Manually shot by Himansu/staff — just plan topics and scripts"
      }
    })
  });
  const data = await res.json();
  const plan = data.content||data.text||"";

  // Show plan as a readable modal
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center";
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:600px;overflow:hidden;margin-top:20px">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">📋 ${monthName} Plan</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Review this plan. Add individual items to calendar using + Add Post on each day, or auto-import below.</div>
      <div style="background:var(--bg3);border-radius:8px;padding:14px;font-size:12px;line-height:1.8;white-space:pre-wrap;max-height:400px;overflow-y:auto">${plan}</div>
      <button class="mkt-btn mkt-btn-ghost" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>showMktToast('Copied!'))" style="width:100%;margin-top:10px">📋 Copy Plan</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click",e=>{if(e.target===modal)modal.remove();});
}

function showMonthReview() {
  const nextMonth = new Date(_calYear, _calMonth+1, 1);
  const nextMonthName = nextMonth.toLocaleString("en-IN",{month:"long",year:"numeric"});
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">📋 15th Review — Plan ${nextMonthName}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      <div style="font-size:13px;line-height:1.6;color:var(--text2)">
        You are reviewing content for <strong>${nextMonthName}</strong>.<br>
        Answer these questions then click Generate Plan.
      </div>
      <div class="mkt-form-group"><label class="mkt-form-label">1. What products/brands to push next month?</label>
        <input id="rev-products" class="mkt-form-input" placeholder="e.g. Asian Paints new range, Italian Marble, Somany tiles"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">2. Any offers or promotions planned?</label>
        <input id="rev-offers" class="mkt-form-input" placeholder="e.g. 15% off sanitaryware, free delivery above 50K"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">3. Reel topics (3 reels per month, every 3rd day)</label>
        <input id="rev-reels" class="mkt-form-input" placeholder="e.g. Showroom walkthrough, Tile laying timelapse, Customer testimonial"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">4. Any special events or launches?</label>
        <input id="rev-events" class="mkt-form-input" placeholder="e.g. New brand launch, Contractor Club meet, Store anniversary"></div>
      <button class="mkt-btn mkt-btn-primary" onclick="generateReviewPlan('${nextMonthName}')" style="width:100%;padding:12px;font-weight:900">🚀 Generate ${nextMonthName} Plan</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener("click",e=>{if(e.target===m)m.remove();});
}

async function generateReviewPlan(monthName) {
  const products = document.getElementById("rev-products")?.value||"";
  const offers = document.getElementById("rev-offers")?.value||"";
  const reels = document.getElementById("rev-reels")?.value||"";
  const events = document.getElementById("rev-events")?.value||"";
  document.querySelector("[style*=fixed]")?.remove();

  _calMonth = _calMonth === 11 ? 0 : _calMonth + 1;
  if (_calMonth === 0) _calYear++;
  await loadCalendar();
  showCalPlanModal();
  setTimeout(()=>{
    const fi = document.getElementById("plan-focus");
    if (fi) fi.value = [products,offers,reels,events].filter(Boolean).join(" | ");
  },300);
}


async function renderAnalytics() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading analytics…</div>`);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString();

  const [
    {data: contentPosts},
    {data: channelPosts},
    {data: performance},
    {data: reviews}
  ] = await Promise.all([
    sb.from('content_posts').select('*').gte('created_at', lastMonthStart).order('created_at',{ascending:false}).then(r=>r,()=>({data:[]})),
    sb.from('channel_posts').select('*').gte('created_at', lastMonthStart).then(r=>r,()=>({data:[]})),
    sb.from('post_performance').select('*').gte('recorded_at', lastMonthStart).then(r=>r,()=>({data:[]})),
    sb.from('monthly_reviews').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r,()=>({data:[]}))
  ]);

  const totalPosts = (contentPosts||[]).length;
  const thisMonth = (contentPosts||[]).filter(p => p.created_at >= new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  const publishedPosts = (channelPosts||[]).filter(p => p.status==='published').length;
  const avgEng = (performance||[]).length
    ? ((performance||[]).reduce((a,p)=>a+(p.engagement_rate||0),0)/(performance||[]).length).toFixed(1)
    : '—';

  const channelCounts = {};
  (channelPosts||[]).forEach(p => { channelCounts[p.channel]=(channelCounts[p.channel]||0)+1; });
  const formatCounts = {};
  (contentPosts||[]).forEach(p => { formatCounts[p.post_type||'image']=(formatCounts[p.post_type||'image']||0)+1; });

  const CHANNEL_LABELS = {gbp:'📍 GBP',instagram_feed:'📸 Instagram',facebook_post:'👤 Facebook',whatsapp_bc:'💬 WhatsApp',threads:'🧵 Threads',x:'𝕏 X',youtube:'▶️ YouTube'};
  const FORMAT_LABELS = {image:'🖼️ Image',reel:'🎬 Reel',gif:'✨ GIF',festival:'🎉 Festival',qa:'❓ Q&A'};
  const barW = (val, max) => Math.max(4, Math.round((val/Math.max(max,1))*100));

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📈 Analytics & Reviews</h3>
      <div style="font-size:12px;color:var(--text3)">Performance data + AI-powered reviews</div>
    </div>
  </div>

  <!-- KPI CARDS -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;max-height:300px;overflow-y:auto">
    ${[
      {label:'Posts Created', value:totalPosts, sub:thisMonth.length+' this month', color:'var(--gold)'},
      {label:'Published', value:publishedPosts, sub:(totalPosts-publishedPosts)+' pending', color:'#22c55e'},
      {label:'Avg Engagement', value:avgEng+'%', sub:(performance||[]).length+' data points', color:'#3b82f6'},
      {label:'Active Channels', value:Object.keys(channelCounts).length, sub:'of 9 channels', color:'#a855f7'},
    ].map(k=>`<div class="mkt-card" style="text-align:center;padding:14px">
      <div style="font-size:22px;font-weight:900;color:${k.color}">${k.value}</div>
      <div style="font-size:11px;font-weight:600;margin-top:2px">${k.label}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">${k.sub}</div>
    </div>`).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">Posts by channel</div>
      ${Object.keys(channelCounts).length ? Object.entries(channelCounts).sort((a,b)=>b[1]-a[1]).map(([ch,n])=>{
        const max=Math.max(...Object.values(channelCounts));
        return `<div style="margin-bottom:7px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span>${CHANNEL_LABELS[ch]||ch}</span><span style="font-weight:600">${n}</span></div>
          <div style="height:4px;background:var(--bg3);border-radius:2px"><div style="height:4px;background:var(--gold);border-radius:2px;width:${barW(n,max)}%"></div></div>
        </div>`;}).join('')
      : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">No data yet</div>'}
    </div>
    <div class="mkt-card">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">Posts by format</div>
      ${Object.keys(formatCounts).length ? Object.entries(formatCounts).sort((a,b)=>b[1]-a[1]).map(([fmt,n])=>{
        const max=Math.max(...Object.values(formatCounts));
        return `<div style="margin-bottom:7px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span>${FORMAT_LABELS[fmt]||fmt}</span><span style="font-weight:600">${n}</span></div>
          <div style="height:4px;background:var(--bg3);border-radius:2px"><div style="height:4px;background:#3b82f6;border-radius:2px;width:${barW(n,max)}%"></div></div>
        </div>`;}).join('')
      : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">No data yet</div>'}
    </div>
  </div>

  <!-- REVIEW GENERATOR -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div style="font-size:13px;font-weight:700;margin-bottom:12px">📊 Generate AI Review</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <label class="mkt-form-label">Review period</label>
        <select id="review-period" class="mkt-form-select" onchange="reviewPeriodChanged()">
          <option value="weekly">Weekly (last 7 days)</option>
          <option value="fortnightly">Fortnightly (last 14 days)</option>
          <option value="monthly" selected>Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom date range</option>
        </select>
      </div>
      <div id="review-month-picker">
        <label class="mkt-form-label">Month</label>
        <select id="review-month" class="mkt-form-select">
          ${Array.from({length:6},(_,i)=>{
            const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
            const val = d.toISOString().split('T')[0].slice(0,7);
            const lbl = d.toLocaleString('en-IN',{month:'long',year:'numeric'});
            return `<option value="${val}" ${i===0?'selected':''}>${lbl}</option>`;
          }).join('')}
        </select>
      </div>
    </div>
    <div id="review-custom-dates" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <label class="mkt-form-label">From</label>
        <input id="review-from" class="mkt-form-input" type="date" value="${new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0]}">
      </div>
      <div>
        <label class="mkt-form-label">To</label>
        <input id="review-to" class="mkt-form-input" type="date" value="${now.toISOString().split('T')[0]}">
      </div>
    </div>
    <button onclick="generateReview()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">📊 Generate Review</button>
    <div id="review-output" style="margin-top:12px"></div>
  </div>

  <!-- LIVE SOCIAL ANALYTICS -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700">📡 Live Social Analytics</div>
      <button onclick="loadSocialAnalytics()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Refresh</button>
    </div>
    <div id="social-analytics-output">
      <div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">Click Refresh to load live data from Instagram, Facebook and YouTube</div>
    </div>
  </div>

  <!-- PAST REVIEWS -->
  ${(reviews||[]).length ? `
  <div class="mkt-card">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">Past reviews</div>
    <div style="display:grid;gap:8px">
      ${(reviews||[]).map(r=>`
      <div style="padding:10px;background:var(--bg3);border-radius:8px;cursor:pointer" onclick="expandReview('${r.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:12px;font-weight:700">${r.period_label||r.period_type} Review</div>
            <div style="font-size:10px;color:var(--text3)">${new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
          <span class="badge ${r.status==='approved'?'badge-green':'badge-gray'}">${r.status||'draft'}</span>
        </div>
        <div id="review-expand-${r.id}" style="display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
          ${r.ai_recommendations?.length ? r.ai_recommendations.map(rec=>`
          <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="background:${rec.priority==='high'?'rgba(239,68,68,.2)':rec.priority==='medium'?'rgba(245,158,11,.2)':'rgba(34,197,94,.2)'};
              color:${rec.priority==='high'?'#ef4444':rec.priority==='medium'?'#f59e0b':'#22c55e'};
              border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;flex-shrink:0;margin-top:2px">${(rec.priority||'').toUpperCase()}</span>
            <div><div style="font-size:12px;font-weight:600">${rec.action}</div><div style="font-size:11px;color:var(--text3)">${rec.reason}</div></div>
          </div>`).join('') : '<div style="font-size:12px;color:var(--text3)">No recommendations recorded</div>'}
          ${r.status!=='approved'?`<button onclick="approveReview('${r.id}')" class="mkt-btn mkt-btn-primary" style="margin-top:8px;width:100%;padding:8px;font-size:12px">✅ Approve</button>`:''}
        </div>
      </div>`).join('')}
    </div>
  </div>` : ''}
  `);
}

async function loadSocialAnalytics() {
  const el = document.getElementById('social-analytics-output');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">⏳ Fetching live data from Meta + YouTube…</div>';

  const callFn = async (action) => {
    try {
      const r = await fetch(MKT_SB_URL+'/functions/v1/social-analytics', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({action}),
        signal: AbortSignal.timeout(30000)
      });
      if (!r.ok) return {ok:false, error:'HTTP '+r.status+' '+r.statusText};
      const text = await r.text();
      try { return JSON.parse(text); } catch { return {ok:false, error:'Invalid JSON: '+text.slice(0,100)}; }
    } catch(e) {
      return {ok:false, error: e.name==='TimeoutError' ? 'Timed out after 30s' : e.message};
    }
  };

  const [igRes, fbRes, ytRes] = await Promise.all([
    callFn('instagram_insights'),
    callFn('facebook_insights'),
    callFn('youtube_insights')
  ]);

  console.log('[Analytics] IG:', igRes.ok, igRes.error||'ok');
  console.log('[Analytics] FB:', fbRes.ok, fbRes.error||'ok');
  console.log('[Analytics] YT:', ytRes.ok, ytRes.error||'ok');

  const platforms = [
    { key:'ig', data:igRes, icon:'📸', name:'Instagram', color:'#e1306c' },
    { key:'fb', data:fbRes, icon:'👤', name:'Facebook', color:'#1877f2' },
    { key:'yt', data:ytRes, icon:'▶️', name:'YouTube', color:'#ff0000' }
  ];

  el.innerHTML = `
    <!-- PLATFORM HEADER CARDS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      ${platforms.map(p => {
        if (!p.data.ok) return `
          <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center;opacity:.6">
            <div style="font-size:22px">${p.icon}</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px">${p.name}</div>
            <div style="font-size:10px;color:var(--red);margin-top:4px">${p.data.error?.slice(0,30)||'Not connected'}</div>
          </div>`;

        const acc = p.data.account || {};
        const followerKey = acc.followers !== undefined ? 'followers' : acc.subscribers !== undefined ? 'subscribers' : 'fans';
        const followerCount = (acc.followers || acc.subscribers || acc.fans || 0).toLocaleString('en-IN');
        const secondKey = acc.media_count !== undefined ? 'Posts' : acc.video_count !== undefined ? 'Videos' : 'Page Likes';
        const secondVal = (acc.media_count || acc.video_count || acc.fans || 0).toLocaleString('en-IN');

        return `
          <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center">
            <div style="font-size:22px">${p.icon}</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px;color:var(--text1)">${p.name}</div>
            <div style="font-size:18px;font-weight:900;color:${p.color};margin-top:6px">${followerCount}</div>
            <div style="font-size:10px;color:var(--text3)">${followerKey}</div>
            <div style="font-size:12px;font-weight:600;color:var(--text2);margin-top:4px">${secondVal} <span style="font-size:10px;color:var(--text3)">${secondKey}</span></div>
          </div>`;
      }).join('')}
    </div>

    <!-- INSTAGRAM RECENT POSTS -->
    ${igRes.ok && igRes.posts?.length ? `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">📸 Instagram — Recent Posts</div>
      <div style="display:grid;gap:6px">
        ${igRes.posts.slice(0,5).map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text2)">${p.caption||p.type}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(p.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          </div>
          <div style="display:flex;gap:10px;font-size:11px;flex-shrink:0">
            <span title="Likes">❤️ ${p.likes.toLocaleString('en-IN')}</span>
            <span title="Comments">💬 ${p.comments.toLocaleString('en-IN')}</span>
            <span title="Reach" style="color:var(--gold)">👁 ${(p.reach||0).toLocaleString('en-IN')}</span>
            <span title="Engagement Rate" style="color:#22c55e">${p.engagement_rate}%</span>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- YOUTUBE RECENT VIDEOS -->
    ${ytRes.ok && ytRes.videos?.length ? `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">▶️ YouTube — Recent Videos</div>
      <div style="display:grid;gap:6px">
        ${ytRes.videos.slice(0,5).map(v=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">
          ${v.thumbnail?`<img src="${v.thumbnail}" style="width:48px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0">`:'<div style="width:48px;height:36px;background:var(--bg4);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">▶️</div>'}
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(v.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          </div>
          <div style="display:flex;gap:10px;font-size:11px;flex-shrink:0">
            <span title="Views">👁 ${v.views.toLocaleString('en-IN')}</span>
            <span title="Likes">❤️ ${v.likes.toLocaleString('en-IN')}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- FACEBOOK RECENT POSTS -->
    ${fbRes.ok && fbRes.posts?.length ? `
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">👤 Facebook — Recent Posts</div>
      <div style="display:grid;gap:6px">
        ${fbRes.posts.slice(0,3).map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text2)">${p.message||'Post'}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(p.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          </div>
          <div style="display:flex;gap:10px;font-size:11px;flex-shrink:0">
            <span>❤️ ${p.likes}</span>
            <span>💬 ${p.comments}</span>
            <span>🔁 ${p.shares}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}
  `;
}

function reviewPeriodChanged() {
  const period = document.getElementById('review-period')?.value;
  const monthPicker = document.getElementById('review-month-picker');
  const customDates = document.getElementById('review-custom-dates');
  if (monthPicker) monthPicker.style.display = period === 'monthly' ? 'block' : 'none';
  if (customDates) customDates.style.display = period === 'custom' ? 'grid' : 'none';
}

function expandReview(id) {
  const el = document.getElementById('review-expand-'+id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function runReviewRequestAgent(btn) {
  if (btn) { btn.textContent='⏳ Running…'; btn.disabled=true; }
  const out = document.getElementById('review-request-output');
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">⏳ Finding eligible customers…</div>';
  try {
    const sevenDaysAgo  = new Date(Date.now() -  7*86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30*86400000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90*86400000).toISOString(); // dedupe window

    // 1. Candidates: purchased 7-30 days ago
    const { data: candidates } = await sb.from('customers')
      .select('id,name,email,phone,last_visit,notes')
      .gte('last_visit', thirtyDaysAgo)
      .lte('last_visit', sevenDaysAgo)
      .not('phone', 'is', null)
      .limit(50)
      .then(r=>r, ()=>({data:[]}));

    if (!candidates?.length) {
      if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">No eligible customers found (purchased 7–30 days ago)</div>';
      return;
    }

    // 2. Already messaged in last 90 days — fetch by phone list
    const phones = candidates.map(c=>c.phone).filter(Boolean);
    const { data: alreadySent } = await sb.from('review_requests_log')
      .select('phone,sent_at')
      .in('phone', phones)
      .gte('sent_at', ninetyDaysAgo)
      .then(r=>r, ()=>({data:[]}));
    const sentPhones = new Set((alreadySent||[]).map(r=>r.phone));

    // 3. Filter out: already sent + complaints/damaged notes
    const COMPLAINT_PATTERN = /damage|broken|complaint|wrong|missing|refund|return|bad|issue|problem/i;
    const eligible = candidates.filter(c => {
      if (sentPhones.has(c.phone)) return false;          // already got review request
      if (c.notes && COMPLAINT_PATTERN.test(c.notes)) return false; // has complaint note
      return true;
    });

    if (!eligible.length) {
      if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">No new eligible customers — all either already messaged (90-day window) or have complaint notes</div>';
      return;
    }

    let waSent = 0, waFailed = 0, emailSent = 0;
    const logRows = [];

    for (const c of eligible) {
      // WhatsApp (primary channel)
      if (c.phone) {
        const r = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
          method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
          body: JSON.stringify({
            action:'send_template', phone:c.phone,
            template_name:'vwholesale_feedback_request',
            body_values:[c.name||'Customer', 'your recent purchase'],
            language_code:'en'
          })
        }).then(r=>r.json()).catch(()=>({ok:false}));
        const status = r.ok ? 'sent' : 'failed';
        if (r.ok) waSent++; else waFailed++;
        logRows.push({ customer_id:c.id, phone:c.phone, channel:'whatsapp', template_name:'vwholesale_feedback_request', status });
      }
      // Email (secondary, if available)
      if (c.email) {
        const er = await fetch(MKT_SB_URL+'/functions/v1/email-marketing', {
          method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
          body: JSON.stringify({ action:'send_review_request', to:c.email, customer_name:c.name||'Customer', product:'building materials' })
        }).then(r=>r.json()).catch(()=>({ok:false}));
        const status = er.ok ? 'sent' : 'failed';
        if (er.ok) emailSent++;
        logRows.push({ customer_id:c.id, phone:c.phone||null, channel:'email', template_name:'review_request_email', status });
      }
    }

    // 4. Write log so we never double-send
    if (logRows.length) {
      await sb.from('review_requests_log').insert(logRows).then(()=>{}).catch(()=>{});
    }

    const skipped = candidates.length - eligible.length;
    showMktToast('WhatsApp: ' + waSent + ' sent · ' + skipped + ' skipped (already sent or complaints)');
    if (out) out.innerHTML =
      '<div style="font-size:11px;color:#22c55e">✅ Done — ' + waSent + ' WhatsApp · ' + emailSent + ' email sent</div>'
      + (waFailed ? '<div style="font-size:10px;color:#f59e0b;margin-top:4px">⚠️ ' + waFailed + ' WhatsApp failed — template may still be in review</div>' : '')
      + (skipped ? '<div style="font-size:10px;color:var(--text3);margin-top:4px">ℹ️ ' + skipped + ' skipped — already messaged within 90 days or complaint note on file</div>' : '');
  } catch(e) {
    showMktToast('❌ ' + e.message);
    if (out) out.innerHTML = '<div style="font-size:11px;color:var(--red)">❌ ' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent='▶️ Run Now'; btn.disabled=false; }
  }
}

async function generateSEOBlogPost(btn) {
  const topic = prompt('Blog post topic? (leave blank for auto-suggest)') || 'tiles in vijayawada';
  if (btn) { btn.textContent='⏳ Writing…'; btn.disabled=true; }
  const out = document.getElementById('seo-blog-output');
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">⏳ Generating SEO blog post…</div>';
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'generate_text', agent:'SEO Blog',
        prompt: 'Write a short SEO blog post (400-500 words) for V Wholesale, Vijayawada targeting the keyword "' + topic + '". Include: H1 title, 2-3 subheadings, natural keyword usage, mention V Wholesale at Visit V Wholesale, call to action. Return just the blog post text.',
        context: {} })
    });
    const data = await res.json();
    const content = data.output?.message || typeof data.output === 'string' ? (data.output?.message || data.output) : '';
    if (out && content) {
      out.innerHTML = '<div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:12px;color:var(--text2);line-height:1.8;max-height:200px;overflow-y:auto">' + content + '</div>';
      const blogCopyBtn = document.createElement('button');
      blogCopyBtn.className = 'mkt-btn mkt-btn-ghost';
      blogCopyBtn.style.cssText = 'margin-top:8px;font-size:11px;padding:5px 10px';
      blogCopyBtn.textContent = 'Copy Blog Post';
      blogCopyBtn.onclick = function() { navigator.clipboard.writeText(content).then(function(){ showMktToast('Copied!'); }); };
      out.appendChild(blogCopyBtn);
    }
  } catch(e) { if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">❌ ' + e.message + '</div>'; }
  finally { if (btn) { btn.textContent='Generate'; btn.disabled=false; } }
}

async function generateYouTubeSEO(btn) {
  const videoTitle = prompt('Enter your video title or topic:');
  if (!videoTitle) return;
  if (btn) { btn.textContent='⏳ Optimizing…'; btn.disabled=true; }
  const out = document.getElementById('yt-seo-output');
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">⏳ Generating YouTube SEO…</div>';
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'generate_text', agent:'YouTube SEO',
        prompt: 'Generate YouTube SEO for V Wholesale Vijayawada. Video: "' + videoTitle + '". Return JSON: {"title":"optimized title under 60 chars","description":"300 word SEO description with keywords","tags":["10-15 tags"],"thumbnail_text":"short text for thumbnail overlay"}',
        context: {} })
    });
    const data = await res.json();
    let seo = data.output;
    if (typeof seo === 'string') try { seo = JSON.parse(seo); } catch { seo = { title: videoTitle, description: seo, tags: [], thumbnail_text: '' }; }
    if (typeof seo === 'object' && seo?.message) try { seo = JSON.parse(seo.message); } catch { seo = { title: videoTitle, description: seo.message, tags: [] }; }
    if (out) {
      out.innerHTML = '';
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;gap:8px';

      const addSection = (label, content) => {
        const d = document.createElement('div');
        d.style.cssText = 'background:var(--bg3);border-radius:6px;padding:8px';
        d.innerHTML = '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:4px">' + label + '</div>'
          + '<div style="font-size:12px;max-height:80px;overflow-y:auto">' + content + '</div>';
        const btn = document.createElement('button');
        btn.className = 'mkt-btn mkt-btn-ghost';
        btn.style.cssText = 'font-size:10px;padding:2px 8px;margin-top:4px';
        btn.textContent = 'Copy';
        btn.onclick = function() { navigator.clipboard.writeText(content).then(function(){ showMktToast('Copied!'); }); };
        d.appendChild(btn);
        grid.appendChild(d);
      };

      addSection('TITLE', seo?.title || videoTitle);
      addSection('DESCRIPTION', seo?.description || '');
      addSection('TAGS', (seo?.tags || []).join(', '));
      if (seo?.thumbnail_text) addSection('THUMBNAIL TEXT', seo.thumbnail_text);
      out.appendChild(grid);
    }
  } catch(e) { if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">❌ ' + e.message + '</div>'; }
  finally { if (btn) { btn.textContent='Optimize'; btn.disabled=false; } }
}
// ── Platform size definitions ──
const PLATFORM_SIZES = {
  instagram_feed:  { w:1080, h:1080, label:'Instagram Feed (1:1)' },
  instagram_story: { w:1080, h:1920, label:'Instagram Story (9:16)' },
  facebook_post:   { w:1200, h:630,  label:'Facebook Post (1.91:1)' },
  facebook_story:  { w:1080, h:1920, label:'Facebook Story (9:16)' },
  threads:         { w:1080, h:1080, label:'Threads (1:1)' },
  youtube:         { w:1280, h:720,  label:'YouTube (16:9)' },
  gbp:             { w:1200, h:900,  label:'Google Business (4:3)' },
  whatsapp_story:  { w:1080, h:1920, label:'WhatsApp Status (9:16)' },
};

// Smart crop: crop from centre of source image to target ratio
function cropImageToSize(img, targetW, targetH) {
  const canvas = document.createElement('canvas');
  canvas.width  = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = targetW / targetH;

  let sx, sy, sw, sh;
  if (srcRatio > dstRatio) {
    // Source is wider — crop sides
    sh = img.naturalHeight;
    sw = Math.round(sh * dstRatio);
    sx = Math.round((img.naturalWidth - sw) / 2);
    sy = 0;
  } else {
    // Source is taller — crop top/bottom (keep top-biased for portraits)
    sw = img.naturalWidth;
    sh = Math.round(sw / dstRatio);
    sx = 0;
    sy = Math.round((img.naturalHeight - sh) * 0.35); // 35% from top keeps faces/subjects
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

// Upload one canvas to Supabase storage, return public URL
async function uploadCanvasToStorage(canvas, path, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
      try {
        const res = await fetch(
          `${MKT_SB_URL}/storage/v1/object/calendar-images/${path}`,
          { method:'POST', headers:{'apikey':MKT_SB_KEY,'Authorization':`Bearer ${MKT_SB_KEY}`,'Content-Type':mimeType,'x-upsert':'true'}, body:blob }
        );
        if (!res.ok) { reject(new Error('Upload failed: ' + res.status)); return; }
        resolve(`${MKT_SB_URL}/storage/v1/object/public/calendar-images/${path}`);
      } catch(e) { reject(e); }
    }, mimeType, 0.92);
  });
}

// Main upload handler — auto-crops to all platform sizes
async function calHandleImageUpload(calendarId, input) {
  const file = input.files[0];
  if (!file) return;

  // Reels/videos — just upload as-is, no cropping
  if (file.type.startsWith('video/')) {
    showMktToast('⏳ Uploading video…');
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `calendar/${calendarId}_video_${Date.now()}.${ext}`;
      const res = await fetch(
        `${MKT_SB_URL}/storage/v1/object/calendar-images/${path}`,
        { method:'POST', headers:{'apikey':MKT_SB_KEY,'Authorization':`Bearer ${MKT_SB_KEY}`,'Content-Type':file.type,'x-upsert':'true'}, body:file }
      );
      if (!res.ok) throw new Error('Upload failed: ' + res.status);
      const url = `${MKT_SB_URL}/storage/v1/object/public/calendar-images/${path}`;
      await sb.from('content_calendar').update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', calendarId);
      showMktToast('✅ Video uploaded — click Approve & Schedule');
      renderCalendar();
    } catch(e) { showMktToast('❌ Upload failed: ' + e.message); }
    return;
  }

  // Load source image to get dimensions
  const imgEl = new Image();
  const objectUrl = URL.createObjectURL(file);
  imgEl.src = objectUrl;

  showMktToast('⏳ Processing image for all platforms…');

  await new Promise((resolve, reject) => {
    imgEl.onload = resolve;
    imgEl.onerror = reject;
  });

  // Get which platforms this calendar item needs
  const { data: calItem } = await sb.from('content_calendar').select('platform').eq('id', calendarId).single();
  const platforms = calItem?.platform || ['instagram_feed','facebook_post','threads'];

  // Deduplicate by size — no need to upload same crop twice
  const sizeMap = {}; // key: "WxH" → first platform that needs it
  const platformToSize = {}; // platform → "WxH"
  for (const ch of platforms) {
    const sz = PLATFORM_SIZES[ch];
    if (!sz) continue;
    const key = `${sz.w}x${sz.h}`;
    platformToSize[ch] = key;
    if (!sizeMap[key]) sizeMap[key] = { w:sz.w, h:sz.h, platforms:[] };
    sizeMap[key].platforms.push(ch);
  }

  const uploadedUrls = {}; // "WxH" → url
  const platformImages = {}; // platform → url

  let done = 0;
  const total = Object.keys(sizeMap).length;

  for (const [key, sz] of Object.entries(sizeMap)) {
    try {
      const canvas = cropImageToSize(imgEl, sz.w, sz.h);
      const path = `calendar/${calendarId}_${sz.w}x${sz.h}_${Date.now()}.jpg`;
      const url = await uploadCanvasToStorage(canvas, path, 'image/jpeg');
      uploadedUrls[key] = url;
      for (const ch of sz.platforms) platformImages[ch] = url;
      done++;
      showMktToast(`⏳ Processed ${done}/${total} sizes…`);
    } catch(e) {
      console.error(`Crop/upload failed for ${key}:`, e);
    }
  }

  URL.revokeObjectURL(objectUrl);

  if (!Object.keys(platformImages).length) {
    showMktToast('❌ All uploads failed'); return;
  }

  // Master image = square (instagram_feed) or first available
  const masterUrl = platformImages['instagram_feed'] || Object.values(platformImages)[0];

  await sb.from('content_calendar').update({
    image_url: masterUrl,
    platform_images: platformImages,
    updated_at: new Date().toISOString()
  }).eq('id', calendarId);

  const sizeCount = Object.keys(sizeMap).length;
  showMktToast(`✅ ${sizeCount} size${sizeCount>1?'s':''} generated — click Approve & Schedule`);
  renderCalendar();
}

async function calApproveItem(calendarId) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
  if (!item) { showMktToast('❌ Item not found'); return; }
  if (!item.image_url) { showMktToast('❌ Upload an image first'); return; }

  // Build final bilingual caption: English + Telugu + hashtags
  const parts = [item.caption, item.caption_te, (item.hashtags||[]).join(' ')].filter(Boolean);
  const finalCaption = parts.join('\n\n');

  await sb.from('content_calendar').update({
    status: 'approved',
    caption: finalCaption,          // lock combined caption for publishing
    approved_by: 'Himansu',
    approved_at: new Date().toISOString(),
    content_locked_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', calendarId);
  showMktToast(`✅ Approved! Will auto-post at ${item.post_time||'10:00'} IST on ${item.cal_date}`);
  renderCalendar();
}

async function calUnapproveItem(calendarId) {
  if (!confirm('Undo approval? Post will not be published until re-approved.')) return;
  await sb.from('content_calendar').update({ status:'ready', approved_at:null, content_locked_at:null, updated_at:new Date().toISOString() }).eq('id', calendarId);
  showMktToast('↩ Approval removed');
  renderCalendar();
}

// ── Calendar post preview ──
async function calPreviewPost(calendarId) {
  const { data: item } = await sb.from('content_calendar').select('*').eq('id', calendarId).single();
  if (!item) { showMktToast('❌ Item not found'); return; }

  const channels = item.platform || ['instagram_feed','facebook_post','threads'];
  const chMap = {
    instagram_feed:  { icon:'📸', name:'Instagram Feed' },
    instagram_story: { icon:'📸', name:'Instagram Story' },
    facebook_post:   { icon:'👤', name:'Facebook Post' },
    facebook_story:  { icon:'👤', name:'Facebook Story' },
    threads:         { icon:'🧵', name:'Threads' },
    youtube:         { icon:'▶️', name:'YouTube' },
    gbp:             { icon:'📍', name:'Google Business' },
    whatsapp_story:  { icon:'💬', name:'WhatsApp Status' },
  };
  const postDate = new Date(item.cal_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});

  const ov = document.createElement('div');
  ov.id = 'cal-preview-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.8);z-index:99999;overflow-y:auto;padding:20px';

  const caption = item.caption || '';
  const hashtags = (item.hashtags||[]).join(' ');
  const teCaption = item.caption_te || '';
  // Full bilingual caption: English + Telugu + hashtags — all in one
  const fullCaption = [caption, teCaption, hashtags].filter(Boolean).join('\n\n');

  // Image dimensions per platform
  const imgStyle = {
    instagram_feed:  'width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    instagram_story: 'width:56%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    facebook_post:   'width:100%;aspect-ratio:1.91/1;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    facebook_story:  'width:56%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    threads:         'width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    youtube:         'width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    gbp:             'width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
    whatsapp_story:  'width:56%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block',
  };

  const channelPreviews = channels.map(ch => {
    const c = chMap[ch] || { icon:'📱', name:ch };
    // Adapt caption per channel with correct platform limits + bilingual
    let adapted = fullCaption; // default: English + Telugu + hashtags
    if (ch === 'instagram_feed') {
      // Instagram: full bilingual + hashtags, max 2200 chars
      adapted = fullCaption.slice(0, 2200);
    } else if (ch === 'threads') {
      // Threads max 500 chars — cut at sentence boundary
      const threadsText = caption + (hashtags ? '\n\n' + hashtags : '');
      if (threadsText.length <= 500) {
        adapted = threadsText;
      } else {
        // Find last sentence end before 480 chars
        const chunk = threadsText.slice(0, 480);
        const lastPeriod = Math.max(chunk.lastIndexOf('. '), chunk.lastIndexOf('! '), chunk.lastIndexOf('? '));
        adapted = lastPeriod > 100 ? chunk.slice(0, lastPeriod + 1) : chunk + '…';
      }
    } else if (ch === 'facebook_post') {
      // Facebook: bilingual caption, no hard limit but keep reasonable
      adapted = fullCaption.slice(0, 2000);
    } else if (ch === 'instagram_story' || ch === 'facebook_story') {
      // Stories: punchy 2-line hook. Take first sentence only, clean cutoff
      const firstSentence = caption.split(/[.!?]/)[0].trim();
      const hook = firstSentence.length > 20 ? firstSentence + '.' : caption.split('\n')[0];
      adapted = hook.slice(0, 200) + '\n\n👉 Visit V Wholesale\n📞 +91 8712697930';
    } else if (ch === 'whatsapp_story') {
      // WhatsApp Status: bilingual short version
      const firstLine = caption.split('\n')[0].slice(0, 300);
      adapted = firstLine + (teCaption ? '\n\n' + teCaption.split('\n')[0].slice(0, 200) : '');
    } else if (ch === 'gbp') {
      // GBP: no hashtags, max 1500 chars, local SEO focus, cut at sentence boundary
      const gbpText = caption.replace(/#[\w\u0C00-\u0C7F]+/g, '').trim();
      if (gbpText.length <= 1500) {
        adapted = gbpText;
      } else {
        const chunk = gbpText.slice(0, 1480);
        const lastPeriod = Math.max(chunk.lastIndexOf('. '), chunk.lastIndexOf('! '));
        adapted = lastPeriod > 200 ? chunk.slice(0, lastPeriod + 1) : chunk + '…';
      }
    } else if (ch === 'youtube') {
      adapted = fullCaption + '\n\n📍 Visit V Wholesale | +91 8712697930 | vwholesale.in';
    }

    const rawImg = (item.platform_images && item.platform_images[ch]) || item.image_url || null;
    // Cache-bust SVG URLs so browser always fetches fresh version after regeneration
    const platformImg = rawImg ? (rawImg.includes('.svg') ? rawImg + '?t=' + (item.updated_at ? new Date(item.updated_at).getTime() : Date.now()) : rawImg) : null;
    const iStyle = imgStyle[ch] || imgStyle['instagram_feed'];
    const noImgH = (ch.includes('story') || ch === 'whatsapp_story') ? 'aspect-ratio:9/16;width:56%' : 'height:120px;width:100%';
    const isVideo = item.content_type === 'reel';
    const isGif   = item.content_type === 'gif';

    const mediaHtml = platformImg
      ? isVideo
        ? `<video src="${platformImg}" style="${iStyle}" controls muted playsinline></video>`
        : `<img src="${platformImg}" style="${iStyle}" onerror="this.style.display='none'">`
      : `<div style="background:var(--bg1);border-radius:8px;${noImgH};display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px;margin-bottom:10px">${isVideo?'🎬 No video yet':isGif?'✨ No GIF yet':'📸 No image yet'}</div>`;

    return `
    <div style="background:var(--bg3);border-radius:10px;padding:14px;border:1px solid var(--border)">
      <div style="font-size:12px;font-weight:700;color:var(--text1);margin-bottom:10px">${c.icon} ${c.name}</div>
      ${mediaHtml}
      <div style="font-size:12px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${adapted.replace(/</g,'&lt;')}</div>
    </div>`;
  }).join('');

  ov.innerHTML = `
  <div style="max-width:520px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-size:16px;font-weight:900;color:var(--text1)">${item.topic}</div>
        <div style="font-size:11px;color:var(--text3)">${postDate} · ${item.post_time||'10:00'} IST · ${item.content_type||'image'}</div>
      </div>
      <button onclick="document.getElementById('cal-preview-overlay').remove()" class="mkt-btn mkt-btn-ghost" style="padding:6px 12px">✕ Close</button>
    </div>

    ${item.reel_script ? `
    <div style="background:var(--bg3);border-radius:10px;padding:14px;border:1px solid var(--border);margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">🎬 Reel Script</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${item.reel_script.replace(/</g,'&lt;')}</div>
    </div>` : ''}

    <div style="display:grid;gap:12px;margin-bottom:16px">
      ${channelPreviews}
    </div>

    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('cal-preview-overlay').remove()" class="mkt-btn mkt-btn-ghost" style="flex:1;padding:10px">Close</button>
      ${item.status === 'ready' && item.image_url
        ? `<button onclick="document.getElementById('cal-preview-overlay').remove();calApproveItem('${item.id}')" class="mkt-btn mkt-btn-primary" style="flex:1;padding:10px;background:#22c55e;font-weight:700">✅ Approve & Schedule</button>`
        : ''}
    </div>
  </div>`;

  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

// Build sizes list for display in calendar row
function buildCalSizesList(platforms) {
  const sizes = {};
  for (const ch of (platforms||[])) {
    if (ch === 'instagram_feed' || ch === 'threads') sizes['1080\u00d71080 (1:1)'] = true;
    if (ch === 'instagram_story' || ch === 'facebook_story' || ch === 'whatsapp_story') sizes['1080\u00d71920 (9:16)'] = true;
    if (ch === 'facebook_post') sizes['1200\u00d7630 (1.91:1)'] = true;
    if (ch === 'youtube') sizes['1280\u00d7720 (16:9)'] = true;
    if (ch === 'gbp') sizes['1200\u00d7900 (4:3)'] = true;
  }
  const list = Object.keys(sizes);
  return list.length ? '📐 ' + list.join(' · ') : '';
}

// Direct regenerate — no edit form needed
async function calRegenerateItem(calendarId) {
  showMktToast('⏳ Generating caption + sending approval email…');
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/content-pipeline', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'generate_single', calendar_id: parseInt(calendarId)})
    });
    const data = await res.json();
    if (data.ok) {
      showMktToast('✅ Done! Check hmehta@vwholesale.in for approval email');
      renderCalendar();
    } else {
      showMktToast('⚠️ ' + (data.error||'Generation failed'));
    }
  } catch(e) {
    showMktToast('❌ ' + e.message);
  }
}
window.calRegenerateItem = calRegenerateItem;


// ── Auto poster generation via generate-poster-v2 ──
const VW_LOGO_B64 = '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';

async function calGeneratePosters(calendarId, reuseBg) {
  // Disable button immediately to prevent double-clicks
  const btn = document.querySelector(`button[onclick="calGeneratePosters('${calendarId}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

  showMktToast(reuseBg ? '🎨 Re-applying layout with existing background… (~20s, free)' : '⏳ Clearing old poster and generating fresh ones… (~60-90s)');
  try {
    // Step 1: Clear DB immediately and re-render so preview shows no old image
    await fetch(MKT_SB_URL + '/rest/v1/content_calendar?id=eq.' + calendarId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY, 'Authorization': 'Bearer ' + MKT_SB_KEY },
      body: JSON.stringify({ image_url: null, platform_images: null, updated_at: new Date().toISOString() })
    });
    renderCalendar(); // Re-render immediately so old preview disappears

    // Step 2: Generate new posters
    const res = await fetch(MKT_SB_URL + '/functions/v1/generate-poster-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        action: 'generate_posters',
        calendar_id: parseInt(calendarId),
        logo_b64: VW_LOGO_B64,
        reuse_bg: !!reuseBg
      })
    });
    const data = await res.json();
    if (data.ok) {
      const okCount = Object.values(data.results || {}).filter(r => r.ok).length;
      showMktToast(`✅ ${data.summary || okCount + ' posters generated'} — click Preview to review`);
      renderCalendar();
    } else {
      const errors = Object.values(data.results || {}).map(r => r.error).filter(Boolean);
      showMktToast('⚠️ ' + (data.error || errors[0] || 'Poster generation failed'));
      renderCalendar();
    }
  } catch(e) {
    showMktToast('❌ ' + e.message);
    renderCalendar();
  }
}
window.calGeneratePosters = calGeneratePosters;

window.calPreviewPost = calPreviewPost;
window.calApproveItem = calApproveItem;
window.calUnapproveItem = calUnapproveItem;

window.editCalendarItemById = editCalendarItemById;
// Expose render functions on window for lazy nav lookup
window.renderComingSoon = renderComingSoon;
window.renderApprovals = renderApprovals;
window.renderGBP = renderGBP;
window.renderAgents = renderAgents;
window.renderBrandProfile = renderBrandProfile;
window.renderBrand = renderBrand;
window.renderIntegrations = renderIntegrations;
window.renderCommandCentre = renderCommandCentre;
window.renderAICMO = renderAICMO;
window.renderContentStudio = renderContentStudio;
window.renderCalendar = renderCalendar;
window.renderAnalytics = renderAnalytics;
