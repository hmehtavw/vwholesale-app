
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
              ? `<button onclick="calGeneratePosters('${item.id}')" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px" title="Auto-generate poster for all platforms">🤖 Auto Poster</button>`
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
    image:    ['instagram_feed','instagram_story','facebook_post','facebook_story','threads','gbp'],
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
    // Adapt caption per channel
    let adapted = fullCaption;
    if (ch === 'gbp') adapted = caption.slice(0,300);
    if (ch === 'threads') adapted = (caption + (hashtags?'\n\n'+hashtags:'')).slice(0,500);
    if (ch === 'instagram_story' || ch === 'facebook_story') adapted = item.caption?.slice(0,100) || '';
    if (ch === 'whatsapp_story') adapted = (caption + (teCaption?'\n\n'+teCaption:'')).slice(0,700);
    if (ch === 'youtube') adapted = fullCaption + '\n\n📍 Visit V Wholesale| 8712697930 | vwholesale.in';

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

async function calGeneratePosters(calendarId) {
  // Disable button immediately to prevent double-clicks
  const btn = document.querySelector(`button[onclick="calGeneratePosters('${calendarId}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

  showMktToast('⏳ Clearing old poster and generating fresh ones… (~60-90s)');
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
        logo_b64: VW_LOGO_B64
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
