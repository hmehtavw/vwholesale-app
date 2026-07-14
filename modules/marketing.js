
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

    if (!profile) { showErr('Profile not found. Login with Staff Portal first.'); return; }

    const OK_ROLES = ['admin','owner','manager','marketing','store_manager','floor_manager','sales_head'];
    if (!OK_ROLES.includes(profile.role)) {
      await sb.auth.signOut();
      showErr('Role "' + profile.role + '" has no marketing access');
      return;
    }

    mktProfile = profile;
    showMktApp();

  } catch(e) {
    showErr('Error: ' + (e.message || String(e)));
  }
}


function showMktApp() {
  document.getElementById('mkt-login').style.display = 'none';
  document.getElementById('mkt-layout').style.display = 'flex';
  const infoEl = document.getElementById('mkt-user-info');
  if (infoEl) infoEl.textContent = (mktProfile?.name||'') + ' · ' + (mktProfile?.role||'');
  startClock();
  // loadAIPauseStatus — reserved for future AI pause/resume control


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
  command: 'Command Centre', cmo: 'AI CMO', campaigns: 'Campaigns',
  content: 'Content Studio', calendar: 'Content Calendar', approvals: 'Approvals',
  social: 'Social Media', gbp: 'Google Business Profile', whatsapp: 'WhatsApp',
  ads: 'Advertising', 'local-seo': 'Local SEO', 'website-seo': 'Website SEO',
  reviews: 'Reviews & Reputation', analytics: 'Analytics', competitors: 'Competitor Intelligence',
  segments: 'Customer Segments', greetings: 'Greetings Engine', agents: 'AI Agents', brand: 'Brand Knowledge',
  integrations: 'Integrations', audit: 'Audit Logs', settings: 'Settings'
};

function mktNav(page) {
  document.querySelectorAll('.mkt-nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.getElementById('mkt-page-title').textContent = PAGE_TITLES[page] || page;
  const renderers = {
    poster: renderPosterStudio, command: renderCommandCentre, cmo: renderAICMO, campaigns: renderCampaigns,
    content: renderContentStudio, calendar: renderCalendar, approvals: renderApprovals,
    social: renderSocial, gbp: renderGBP, whatsapp: renderWhatsApp,
    ads: renderAds, 'local-seo': renderLocalSEO, 'website-seo': renderWebsiteSEO,
    reviews: renderReviews, analytics: renderAnalytics, competitors: renderCompetitors,
    segments: renderSegments, greetings: renderGreetings, agents: renderAgents, 'brand-profile': renderBrandProfile, brand: renderBrand,
    integrations: renderIntegrations, audit: renderAudit, settings: renderSettings
  };
  if (renderers[page]) renderers[page]();
  else renderComingSoon(PAGE_TITLES[page] || page);
}

function setContent(html) { document.getElementById('mkt-content').innerHTML = html; }

function showMktToast(msg, duration = 3000) {
  let toast = document.getElementById('mkt-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mkt-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap;max-width:90vw';
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
STORE: V Wholesale | NH65, Bhavanipuram, Vijayawada | 8712697930

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
      <button class="mkt-btn mkt-btn-primary" onclick="mktNav('cmo')" style="margin-top:16px">🧠 Run AI CMO</button>
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
          <button onclick="runReview('monthly',this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 10px">Monthly</button>
          <button onclick="runReview('quarterly',this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 10px">Quarterly</button>
        </div>
      </div>
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
  const {data:bp} = await sb.from('brand_profile').select('*').limit(1).then(r=>r,()=>({data:[]}));
  const p = (bp||[])[0] || {};
  const {data:sc} = await sb.from('social_connections').select('*').then(r=>r,()=>({data:[]}));
  const connections = {};
  (sc||[]).forEach(c=>{connections[c.platform]=c;});

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Brand Profile</h3>
    <div style="font-size:12px;color:var(--text3)">Set once — used automatically in every poster and content piece</div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">🏢 Business Details</div>
    <div class="mkt-grid-2">
      <div class="mkt-form-group"><label class="mkt-form-label">Business Name</label><input id="bp-name" class="mkt-form-input" value="${p.business_name||'V Wholesale'}"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Tagline</label><input id="bp-tag" class="mkt-form-input" value="${p.tagline||'Build Better. Pay Less.'}"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Phone</label><input id="bp-phone" class="mkt-form-input" value="${p.phone||'8712697930'}"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Website</label><input id="bp-web" class="mkt-form-input" value="${p.website||'https://vwholesale.in'}"></div>
      <div class="mkt-form-group mkt-grid-2" style="grid-column:1/-1"><label class="mkt-form-label">Address</label><input id="bp-addr" class="mkt-form-input" value="${p.address||'NH65, Bhavanipuram, Vijayawada 520012'}" style="grid-column:1/-1"></div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">🎨 Brand Colors</div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div><label class="mkt-form-label">Primary (Navy)</label>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="color" id="bp-primary" value="${p.primary_color||'#1a2744'}" style="width:44px;height:36px;border:none;border-radius:6px;cursor:pointer;background:none">
          <input id="bp-primary-hex" class="mkt-form-input" value="${p.primary_color||'#1a2744'}" style="width:100px" oninput="document.getElementById('bp-primary').value=this.value">
        </div>
      </div>
      <div><label class="mkt-form-label">Secondary (Gold)</label>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="color" id="bp-secondary" value="${p.secondary_color||'#c9a84c'}" style="width:44px;height:36px;border:none;border-radius:6px;cursor:pointer;background:none">
          <input id="bp-secondary-hex" class="mkt-form-input" value="${p.secondary_color||'#c9a84c'}" style="width:100px" oninput="document.getElementById('bp-secondary').value=this.value">
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:16px">
        <div style="width:60px;height:60px;border-radius:10px;background:${p.primary_color||'#1a2744'}" id="color-preview-primary"></div>
        <div style="width:60px;height:60px;border-radius:10px;background:${p.secondary_color||'#c9a84c'}" id="color-preview-secondary"></div>
        <div style="font-size:11px;color:var(--text3)">Live preview</div>
      </div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">📸 Brand Photos</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Upload store interior, product showcase, lifestyle photos. Used as hero images in posters.</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px" id="bp-photos-grid">
      ${(p.brand_photos||[]).map((ph,i)=>`
      <div style="aspect-ratio:1;border-radius:8px;overflow:hidden;position:relative;background:var(--bg3)">
        <img src="${ph}" style="width:100%;height:100%;object-fit:cover">
        <button onclick="removePhoto(${i})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.7);border:none;border-radius:50%;width:20px;height:20px;color:#fff;cursor:pointer;font-size:11px">✕</button>
      </div>`).join('')}
      <div style="aspect-ratio:1;border-radius:8px;border:2px dashed var(--border2);display:flex;align-items:center;justify-content:center;cursor:pointer;background:var(--bg3)" onclick="document.getElementById('bp-file-input').click()">
        <div style="text-align:center"><div style="font-size:24px">+</div><div style="font-size:10px;color:var(--text3)">Add Photo</div></div>
      </div>
      <input type="file" id="bp-file-input" accept="image/*" multiple style="display:none" onchange="uploadBrandPhotos(this)">
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">🔌 Social Connections</div>
    <div style="display:grid;gap:8px">
      ${['instagram','facebook','gbp','whatsapp'].map(pl=>{
        const c = connections[pl]||{};
        const labels={instagram:'Instagram',facebook:'Facebook',gbp:'Google Business Profile',whatsapp:'WhatsApp (Interakt)'};
        const icons={instagram:'📸',facebook:'👥',gbp:'📍',whatsapp:'💬'};
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg3);border-radius:8px">
          <span style="font-size:20px">${icons[pl]}</span>
          <div style="flex:1"><div style="font-size:13px;font-weight:700">${labels[pl]}</div></div>
          <span class="badge ${c.status==='connected'?'badge-green':c.status==='setup'||c.status==='partial'?'badge-gold':'badge-gray'}">${c.status||'not connected'}</span>
          <button class="mkt-btn mkt-btn-ghost" onclick="connectPlatform('${pl}')" style="font-size:11px">${c.status==='connected'?'Manage':'Connect'}</button>
        </div>`;
      }).join('')}
    </div>
  </div>

  <button class="mkt-btn mkt-btn-primary" onclick="saveBrandProfile()" style="width:100%;padding:14px;font-size:14px">💾 Save Brand Profile</button>`);
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
    <div id="meta-status-detail" style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:11px;color:#22c55e">✅ Connected — auto-publishing active</div>
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
        <div style="font-size:14px;font-weight:700">WhatsApp Business (Interakt)</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Broadcast messages to customer list + approvals to 9038010175</div>
      </div>
      ${statusBadge(waOk, !waOk ? 'WABA approval pending' : null)}
    </div>
    <div style="margin-top:10px;padding:10px;background:var(--bg3);border-radius:8px;font-size:11px;color:var(--text3)">
      ${waOk
        ? '✅ WABA active · Phone: 8712697930 · Notifications to 9038010175 active'
        : '⏳ Waiting for Interakt WABA approval for 8712697930. All notification flows are coded and ready — will activate automatically once approved.'}
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
        {text:'V Wholesale — Premium Home Building Materials in Vijayawada. Tiles, Granite, Marble & more. Visit us at NH65, Bhavanipuram. 📞 8712697930 | vwholesale.in\n\n#Vijayawada #HomeRenovation #VWholesale #Tiles #Marble'},
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
  const daysSinceStrategy = lastSession
    ? Math.floor((Date.now()-new Date(lastSession.created_at).getTime())/86400000)
    : 999;

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
  <div style="background:linear-gradient(135deg,#0A1628,#1a2a8a);border:1px solid rgba(201,168,76,.3);border-radius:14px;padding:20px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="font-size:36px">🤖</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:900;color:#fff">${greeting}, Himansu</div>
        <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:2px">${todayDateStr}</div>
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
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
    ${[
      {icon:'📅', label:'Calendar', page:'calendar'},
      {icon:'🤖', label:'AI Agents', page:'agents'},
      {icon:'📸', label:'Create Post', page:'content'},
      {icon:'🖼️', label:'AI Photoshoot', fn:'openAIPhotoshoot()'},
      {icon:'📢', label:'Boost Post', page:'ads'},
      {icon:'📊', label:'Analytics', page:'analytics'},
      {icon:'🔌', label:'Integrations', page:'integrations'},
      {icon:'🔥', label:'Trend Scout', fn:"mktNav('agents');setTimeout(()=>runTrendScout(),400)"},
    ].map(a=>`
    <button onclick="${a.fn||"mktNav('"+a.page+"')"}" class="mkt-btn mkt-btn-ghost" style="flex-direction:column;align-items:center;padding:12px 6px;gap:6px;display:flex;font-size:11px;height:70px">
      <span style="font-size:22px">${a.icon}</span>
      <span style="color:var(--text2)">${a.label}</span>
    </button>`).join('')}
  </div>

  <!-- CHANNEL STATUS -->
  <div class="mkt-card">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🔌 Channel Status</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${[
        {icon:'📍', name:'GBP', status:'API pending', color:'#f59e0b'},
        {icon:'📸', name:'Instagram', status:'Connected', color:'#22c55e'},
        {icon:'👤', name:'Facebook', status:'Connected', color:'#22c55e'},
        {icon:'🧵', name:'Threads', status:'Connected', color:'#22c55e'},
        {icon:'▶️', name:'YouTube', status:'Connected', color:'#22c55e'},
        {icon:'💬', name:'WhatsApp', status:'WABA pending', color:'#f59e0b'},
      ].map(c=>`
      <div style="text-align:center;padding:8px;background:var(--bg3);border-radius:8px">
        <div style="font-size:18px">${c.icon}</div>
        <div style="font-size:11px;font-weight:600;margin-top:2px">${c.name}</div>
        <div style="font-size:9px;color:${c.color};margin-top:2px">${c.status}</div>
      </div>`).join('')}
    </div>
  </div>`);
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
    const briefing = typeof data.output === 'string' ? data.output : data.output?.master_text || 'Ready to help you grow V Wholesale today.';

    if (out) out.innerHTML = `<div style="margin-top:14px;padding:12px;background:rgba(255,255,255,.05);border-radius:8px;font-size:12px;color:rgba(255,255,255,.85);line-height:1.8;border-left:3px solid var(--gold)">${briefing}</div>`;
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

BRAND: V Wholesale | NH65, Bhavanipuram, Vijayawada | Phone: 8712697930 | vwholesale.in
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

  // Save channel posts
  if (window._csCurrentPostId) {
    const channelRows = channels.map(ch => ({
      content_post_id: window._csCurrentPostId,
      channel: ch,
      adapted_text: adaptedVersions[ch]?.text || text,
      image_url: imageUrl,
      image_size: adaptedVersions[ch]?.size || '1:1',
      status: 'pending'
    }));
    await sb.from('channel_posts').insert(channelRows).then(()=>{}).catch(()=>{});
    await sb.from('content_posts').update({status:'published',approved_at:new Date().toISOString()}).eq('id',window._csCurrentPostId);
  }

  const el = document.getElementById('cs-verify-result');
  if (el) el.innerHTML = `
    <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:10px;padding:14px">
      <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">📋 Content saved + text copied!</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Post manually to each channel below. Image: click Open to view/download.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="https://business.google.com/posts" target="_blank" class="mkt-btn mkt-btn-primary" style="font-size:11px;text-decoration:none;padding:8px 12px">📍 Open GBP ↗</a>
        <a href="https://www.instagram.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">📸 Instagram ↗</a>
        <a href="https://www.facebook.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">👤 Facebook ↗</a>
        ${imageUrl?`<a href="${imageUrl}" download target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:8px 12px">⬇ Download Image</a>`:''}
      </div>
    </div>`;
  showMktToast('✅ Published and saved to all channels');
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
              <button onclick="editCalendarItem('${item.id}','${(item.topic||'').replace(/'/g,"\'")}','${item.content_type||'reel'}','${(item.notes||'').replace(/'/g,"\'")}',true)"
                class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px" title="Edit topic">✏️</button>
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
      return `
      <div id="cal-row-${item.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${isToday?'rgba(201,168,76,.08)':'var(--bg3)'};border-radius:8px;border:1px solid ${isToday?'rgba(201,168,76,.3)':'var(--border)'}">
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
          ${existing ? `<span style="font-size:9px;color:${statusColor};font-weight:600">${existing.status}</span>` : ''}
          <button onclick="editCalendarItem('${item.id}','${(item.topic||'').replace(/'/g,"\'")}','${item.content_type||'image'}','${(item.notes||'').replace(/'/g,"\'")}',false)"
            class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">✏️</button>
          <button onclick="quickCreateFromCalendar('${(item.topic||'').replace(/'/g,"\'")}','${item.content_type||'image'}','bilingual')"
            class="mkt-btn ${existing?'mkt-btn-ghost':'mkt-btn-primary'}" style="font-size:10px;padding:3px 8px">
            ${existing?'✏️ Regen':'⚡ Create'}
          </button>
        </div>
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

function editCalendarItem(id, currentTopic, type, currentNotes, isReel) {
  const ov = document.createElement('div');
  ov.id = 'edit-cal-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
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

  // Update the calendar item
  await sb.from('content_calendar').update({
    topic, notes, content_type:type, is_reel:type==='reel', status:'planned', updated_at:new Date().toISOString()
  }).eq('id', id);

  showMktToast('✅ Saved — generating content…');
  // Auto-generate content
  await quickCreateFromCalendar(topic, type, 'bilingual');
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

async function openStrategySession() {
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
STORE: V Wholesale | NH65, Bhavanipuram, Vijayawada | 8712697930 | vwholesale.in
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
LANGUAGE: ${lang === 'bilingual' ? 'Telugu headline + English body' : lang === 'te' ? 'Full Telugu' : 'English'}
STORE: V Wholesale | NH65, Bhavanipuram, Vijayawada | 8712697930 | vwholesale.in
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">+ Add Post — ${new Date(dateStr+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">🤖 AI Plan — ${monthName}</div>
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">📋 ${monthName} Plan</div>
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">📋 15th Review — Plan ${nextMonthName}</div>
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
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
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

async function generateReview(typeOverride, btnEl) {
  const period = typeOverride || document.getElementById('review-period')?.value || 'monthly';
  const btn = btnEl || document.querySelector('[onclick="generateReview()"]');
  const out = document.getElementById('review-output');
  if (btn) { btn.textContent = '⏳ Generating…'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:12px">⏳ AI is analysing your content performance…</div>';

  try {
    const now = new Date();
    let startDate, endDate = now.toISOString(), periodLabel;

    if (period === 'weekly') {
      startDate = new Date(now.getTime()-7*86400000).toISOString();
      periodLabel = 'Week of '+new Date(now.getTime()-7*86400000).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
    } else if (period === 'fortnightly') {
      startDate = new Date(now.getTime()-14*86400000).toISOString();
      periodLabel = 'Fortnight ending '+now.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
    } else if (period === 'monthly') {
      const m = document.getElementById('review-month')?.value || now.toISOString().slice(0,7);
      const [yr,mo] = m.split('-').map(Number);
      startDate = new Date(yr,mo-1,1).toISOString();
      endDate = new Date(yr,mo,0,23,59,59).toISOString();
      periodLabel = new Date(yr,mo-1,1).toLocaleString('en-IN',{month:'long',year:'numeric'});
    } else if (period === 'quarterly') {
      const q = Math.floor(now.getMonth()/3);
      startDate = new Date(now.getFullYear(),q*3,1).toISOString();
      periodLabel = now.getFullYear()+'-Q'+(q+1);
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(),0,1).toISOString();
      periodLabel = 'Year '+now.getFullYear();
    } else if (period === 'custom') {
      startDate = new Date(document.getElementById('review-from')?.value).toISOString();
      endDate = new Date(document.getElementById('review-to')?.value+'T23:59:59').toISOString();
      periodLabel = document.getElementById('review-from')?.value+' to '+document.getElementById('review-to')?.value;
    }

    // Fetch period data
    const [
      {data: posts},
      {data: channels},
      {data: perf},
      {data: calItems},
      {data: stratSessions}
    ] = await Promise.all([
      sb.from('content_posts').select('topic,post_type,language,status').gte('created_at', startDate).lte('created_at', endDate).then(r=>r,()=>({data:[]})),
      sb.from('channel_posts').select('channel,status').gte('created_at', startDate).lte('created_at', endDate).then(r=>r,()=>({data:[]})),
      sb.from('post_performance').select('*').gte('recorded_at', startDate).lte('recorded_at', endDate).then(r=>r,()=>({data:[]})),
      sb.from('content_calendar').select('topic,content_type,status').gte('cal_date', startDate.split('T')[0]).lte('cal_date', endDate.split('T')[0]).then(r=>r,()=>({data:[]})),
      sb.from('strategy_sessions').select('summary,key_themes').gte('created_at', startDate).then(r=>r,()=>({data:[]}))
    ]);

    const res = await fetch(MKT_SB_URL+'/functions/v1/content-notifications', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action: 'generate_review',
        period_type: period,
        period_label: periodLabel,
        start_date: startDate,
        end_date: endDate,
        data_summary: {
          total_posts: (posts||[]).length,
          published: (channels||[]).filter(c=>c.status==='published').length,
          channels_used: [...new Set((channels||[]).map(c=>c.channel))],
          formats: [...new Set((posts||[]).map(p=>p.post_type))],
          avg_engagement: (perf||[]).length ? ((perf||[]).reduce((a,p)=>a+(p.engagement_rate||0),0)/(perf||[]).length).toFixed(1) : null,
          planned_vs_actual: { planned:(calItems||[]).length, created:(posts||[]).length },
          strategy_themes: (stratSessions||[]).map(s=>s.key_themes).join(', ')
        }
      })
    });
    const data = await res.json();

    // Show inline
    const reviewData = data.review || data;
    if (out) out.innerHTML = `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:8px">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">📊 ${periodLabel} Review</div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
          ${[
            {l:'Posts created', v:(posts||[]).length},
            {l:'Published', v:(channels||[]).filter(c=>c.status==='published').length},
            {l:'Avg engagement', v:(perf||[]).length?((perf||[]).reduce((a,p)=>a+(p.engagement_rate||0),0)/(perf||[]).length).toFixed(1)+'%':'—'},
          ].map(s=>`<div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
            <div style="font-size:16px;font-weight:700;color:var(--gold)">${s.v}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${s.l}</div>
          </div>`).join('')}
        </div>

        ${reviewData.ai_recommendations?.length ? `
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase">AI Recommendations</div>
        ${reviewData.ai_recommendations.map(r=>`
        <div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
          <span style="background:${r.priority==='high'?'rgba(239,68,68,.2)':r.priority==='medium'?'rgba(245,158,11,.2)':'rgba(34,197,94,.2)'};
            color:${r.priority==='high'?'#ef4444':r.priority==='medium'?'#f59e0b':'#22c55e'};
            border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;flex-shrink:0;margin-top:2px">${(r.priority||'').toUpperCase()}</span>
          <div><div style="font-size:12px;font-weight:600">${r.action}</div><div style="font-size:11px;color:var(--text3)">${r.reason}</div></div>
        </div>`).join('')}` : '<div style="font-size:12px;color:var(--text3)">Review saved — no recommendations yet</div>'}

        <button onclick="approveReview('${reviewData.id||''}')" class="mkt-btn mkt-btn-primary" style="width:100%;margin-top:10px;padding:8px;font-size:12px">✅ Approve & Archive</button>
      </div>`;

    showMktToast('✅ '+periodLabel+' review generated');
  } catch(e) {
    if (out) out.innerHTML = `<div style="color:var(--red);padding:8px;font-size:12px">❌ ${e.message}</div>`;
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '📊 Generate Review'; btn.disabled = false; }
  }
}

async function approveReview(reviewId) {
  if (!reviewId) return;
  await sb.from('monthly_reviews').update({status:'approved'}).eq('id', reviewId);
  showMktToast('✅ Review approved — recommendations applied to future planning');
  renderAnalytics();
}


async function addGATracking() {
  const gaId = document.getElementById('ga-id').value.trim();
  if (!gaId.startsWith('G-')) { showMktToast('Enter valid GA4 ID (starts with G-)'); return; }
  await sb.from('marketing_settings').upsert({key:'ga4_measurement_id', value:gaId, is_secret:false, description:'Google Analytics 4 Measurement ID'},{onConflict:'key'});
  await sb.from('marketing_integrations').upsert({name:'Google Analytics 4', provider:'google', status:'connected', credentials_set:true, notes:`Measurement ID: ${gaId}`},{onConflict:'name'});
  showMktToast('✅ GA4 ID saved — tracking code will be added to all pages');
}

// ── AUDIT ──
async function renderAudit() {
  const { data: logs } = await sb.from('marketing_audit_logs').select('*').order('created_at',{ascending:false}).limit(50).then(r=>r,()=>({data:[]}));
  const { data: runs } = await sb.from('ai_agent_runs').select('*').order('created_at',{ascending:false}).limit(20).then(r=>r,()=>({data:[]}));

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Audit Logs</h3>
    <div style="font-size:12px;color:var(--text3)">Complete record of all marketing actions and AI runs</div>
  </div>

  <div class="mkt-tabs">
    <button class="mkt-tab active" onclick="showAuditTab('actions',this)">User Actions</button>
    <button class="mkt-tab" onclick="showAuditTab('ai',this)">AI Agent Runs</button>
  </div>

  <div id="audit-actions" class="mkt-card">
    ${(logs||[]).length > 0 ? `<table class="mkt-table">
      <tr><th>Action</th><th>By</th><th>Type</th><th>Date</th></tr>
      ${(logs||[]).map(l=>`<tr>
        <td style="font-weight:700">${l.action}</td>
        <td>${l.performed_by||'system'}</td>
        <td><span class="badge ${l.performed_by_type==='human'?'badge-blue':'badge-purple'}">${l.performed_by_type}</span></td>
        <td style="color:var(--text3);font-size:11px">${new Date(l.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
      </tr>`).join('')}
    </table>` : '<div class="mkt-empty"><div style="color:var(--text3);font-size:12px">No user actions logged yet</div></div>'}
  </div>

  <div id="audit-ai" style="display:none" class="mkt-card">
    ${(runs||[]).length > 0 ? `<table class="mkt-table">
      <tr><th>Agent</th><th>Trigger</th><th>Model</th><th>Cost</th><th>Status</th><th>Date</th></tr>
      ${(runs||[]).map(r=>`<tr>
        <td style="font-weight:700">${r.agent_name}</td>
        <td style="color:var(--text3)">${r.trigger}</td>
        <td style="font-size:11px;color:var(--text3)">${r.model}</td>
        <td style="color:var(--green)">$${(r.cost_usd||0).toFixed(4)}</td>
        <td><span class="badge ${r.status==='completed'?'badge-green':'badge-red'}">${r.status}</span></td>
        <td style="color:var(--text3);font-size:11px">${new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
      </tr>`).join('')}
    </table>` : '<div class="mkt-empty"><div style="color:var(--text3);font-size:12px">No AI runs yet</div></div>'}
  </div>`);
}

function showAuditTab(tab, btn) {
  document.querySelectorAll('.mkt-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('audit-actions').style.display = tab==='actions'?'block':'none';
  document.getElementById('audit-ai').style.display = tab==='ai'?'block':'none';
}

// ── SETTINGS ──
async function renderSettings() {
  const { data: settings } = await sb.from('marketing_settings').select('*').order('key').then(r=>r,()=>({data:[]}));

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Settings</h3>
    <div style="font-size:12px;color:var(--text3)">Marketing panel configuration</div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">🛑 Global AI Control</div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg3);border-radius:10px">
      <div>
        <div style="font-weight:700">Pause All AI Actions</div>
        <div style="font-size:12px;color:var(--text3)">Emergency stop — AI switches to recommend-only mode</div>
      </div>
      <button class="mkt-btn ${aiPaused?'mkt-btn-primary':'mkt-btn-ghost'}" onclick="toggleAIPause()" style="${aiPaused?'background:var(--red)':''}">
        ${aiPaused?'▶ Resume AI':'🛑 Pause AI'}
      </button>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">💰 Budget Controls</div>
    <div style="display:grid;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">Monthly Marketing Budget</div><div style="font-size:11px;color:var(--text3)">Total budget including ads and tools</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px">₹</span>
          <input type="number" id="setting-budget" value="${(settings||[]).find(s=>s.key==='marketing_budget_monthly_inr')?.value||30000}" class="mkt-form-input" style="width:100px">
          <button class="mkt-btn mkt-btn-ghost" onclick="saveSetting('marketing_budget_monthly_inr','setting-budget')" style="font-size:11px">Save</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">Auto-Spend Limit (per action)</div><div style="font-size:11px;color:var(--text3)">AI can spend up to this without approval</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px">₹</span>
          <input type="number" id="setting-auto-limit" value="${(settings||[]).find(s=>s.key==='marketing_budget_auto_limit_inr')?.value||5000}" class="mkt-form-input" style="width:100px">
          <button class="mkt-btn mkt-btn-ghost" onclick="saveSetting('marketing_budget_auto_limit_inr','setting-auto-limit')" style="font-size:11px">Save</button>
        </div>
      </div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">🤖 AI Model Settings</div>
    <div style="display:grid;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">Primary Model</div><div style="font-size:11px;color:var(--text3)">Used for complex tasks (AI CMO briefings)</div></div>
        <select id="setting-model" class="mkt-form-select" style="width:160px" onchange="saveSetting('openai_model_primary','setting-model')">
          <option value="gpt-4o" ${(settings||[]).find(s=>s.key==='openai_model_primary')?.value==='gpt-4o'?'selected':''}>GPT-4o</option>
          <option value="gpt-4o-mini" ${(settings||[]).find(s=>s.key==='openai_model_primary')?.value==='gpt-4o-mini'?'selected':''}>GPT-4o Mini</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">Fast Model</div><div style="font-size:11px;color:var(--text3)">Used for content, posts, quick tasks</div></div>
        <select id="setting-model-fast" class="mkt-form-select" style="width:160px" onchange="saveSetting('openai_model_fast','setting-model-fast')">
          <option value="gpt-4o-mini" ${(settings||[]).find(s=>s.key==='openai_model_fast')?.value==='gpt-4o-mini'?'selected':''}>GPT-4o Mini</option>
          <option value="gpt-4o" ${(settings||[]).find(s=>s.key==='openai_model_fast')?.value==='gpt-4o'?'selected':''}>GPT-4o</option>
        </select>
      </div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">📋 All Settings</div>
    <table class="mkt-table">
      <tr><th>Key</th><th>Value</th></tr>
      ${(settings||[]).filter(s=>!s.is_secret).map(s=>`<tr>
        <td style="font-size:11px;color:var(--text3)">${s.key}</td>
        <td style="font-size:12px">${s.value}</td>
      </tr>`).join('')}
    </table>
  </div>`);
}

async function saveSetting(key, inputId) {
  const value = document.getElementById(inputId)?.value;
  if (!value) return;
  await sb.from('marketing_settings').update({value, updated_at:new Date().toISOString()}).eq('key',key);
  showMktToast('✅ Setting saved');
}

// ── POSTER STUDIO — Canvas Compositor (hero image + text overlay) ──
function openAIPhotoshoot() {
  const ov = document.createElement('div');
  ov.id = 'photoshoot-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;overflow-y:auto;padding:20px';
  ov.innerHTML = `
    <div style="max-width:520px;margin:0 auto;background:var(--bg2);border-radius:14px;padding:20px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div style="font-size:16px;font-weight:900">🖼️ AI Photoshoot</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Upload a product photo → AI places it in 8 professional scenes</div>
        </div>
        <button onclick="document.getElementById('photoshoot-overlay').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
      </div>

      <!-- Upload Product -->
      <div style="margin-bottom:14px">
        <label class="mkt-form-label">Product photo <span style="color:var(--text3);font-weight:400">(tile, granite slab, sanitaryware, paint can, etc)</span></label>
        <label style="display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed var(--border);border-radius:10px;padding:20px;cursor:pointer;background:var(--bg3);min-height:100px" id="photoshoot-drop-zone">
          <span id="photoshoot-preview-area" style="font-size:36px">📷</span>
          <span id="photoshoot-upload-label" style="font-size:12px;color:var(--text3);margin-top:8px">Click to upload product photo</span>
          <input type="file" id="photoshoot-file" accept="image/*" onchange="photoshootPreview(this)" style="display:none">
        </label>
      </div>

      <!-- Product Name -->
      <div style="margin-bottom:14px">
        <label class="mkt-form-label">Product name / description</label>
        <input id="photoshoot-product" class="mkt-form-input" placeholder="e.g. Italian Carrara Marble 60x120cm, Jaquar Basin, Asian Paints Royale">
      </div>

      <!-- Scene Selection -->
      <div style="margin-bottom:14px">
        <label class="mkt-form-label">Select scenes <span style="color:var(--text3);font-weight:400">(choose up to 4)</span></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${[
            {id:'bathroom', icon:'🚿', label:'Luxury Bathroom'},
            {id:'kitchen', icon:'🍳', label:'Modern Kitchen'},
            {id:'living', icon:'🛋️', label:'Living Room'},
            {id:'bedroom', icon:'🛏️', label:'Master Bedroom'},
            {id:'showroom', icon:'🏪', label:'Showroom Display'},
            {id:'exterior', icon:'🏠', label:'Home Exterior'},
            {id:'construction', icon:'🏗️', label:'Under Construction'},
            {id:'studio', icon:'✨', label:'Studio / White Background'},
          ].map(s=>`
          <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px">
            <input type="checkbox" name="ps-scene" value="${s.id}" style="accent-color:var(--gold)"> ${s.icon} ${s.label}
          </label>`).join('')}
        </div>
      </div>

      <button onclick="runAIPhotoshoot()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-size:14px;font-weight:700">✨ Generate AI Photoshoot</button>
      <div id="photoshoot-results" style="margin-top:14px"></div>
    </div>`;
  document.body.appendChild(ov);
}

function photoshootPreview(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('photoshoot-preview-area');
    const label = document.getElementById('photoshoot-upload-label');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" style="max-height:80px;max-width:200px;border-radius:6px;object-fit:contain">`;
    if (label) label.textContent = file.name;
  };
  reader.readAsDataURL(file);
}

async function runAIPhotoshoot() {
  const fileInput = document.getElementById('photoshoot-file');
  const product = (document.getElementById('photoshoot-product')?.value||'').trim();
  const scenes = [...document.querySelectorAll('input[name="ps-scene"]:checked')].map(el=>el.value);

  if (!fileInput?.files?.[0]) { showMktToast('Upload a product photo first'); return; }
  if (!product) { showMktToast('Enter the product name'); return; }
  if (scenes.length === 0) { showMktToast('Select at least one scene'); return; }
  if (scenes.length > 4) { showMktToast('Select up to 4 scenes only'); return; }

  const btn = document.querySelector('[onclick="runAIPhotoshoot()"]');
  if (btn) { btn.textContent='⏳ Generating…'; btn.disabled=true; }

  const results = document.getElementById('photoshoot-results');
  if (results) results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">⏳ AI is creating your product scenes… (~30-60 seconds)</div>';

  const sceneLabels = {
    bathroom:'luxurious modern bathroom with marble walls and ambient lighting',
    kitchen:'contemporary modular kitchen with island counter',
    living:'elegant living room with neutral tones and natural light',
    bedroom:'master bedroom suite with designer furniture',
    showroom:'professional retail showroom display with spotlighting',
    exterior:'premium home exterior facade with landscaping',
    construction:'active construction site being tiled by workers',
    studio:'clean white studio background with soft shadows'
  };

  try {
    // Upload product image to Supabase storage first
    const file = fileInput.files[0];
    const fname = 'photoshoot/'+Date.now()+'_'+file.name.replace(/[^a-z0-9.]/gi,'_').toLowerCase();
    const { error: upErr } = await sb.storage.from('marketing-assets').upload(fname, file, {contentType:file.type, upsert:true});
    if (upErr) throw new Error('Upload failed: '+upErr.message);
    const { data: urlData } = sb.storage.from('marketing-assets').getPublicUrl(fname);
    const productUrl = urlData.publicUrl;

    // Generate scenes in parallel (max 2 at a time to avoid rate limits)
    const generatedImages = [];
    for (let i = 0; i < scenes.length; i += 2) {
      const batch = scenes.slice(i, i+2);
      const batchResults = await Promise.all(batch.map(async sceneId => {
        const res = await fetch(MKT_SB_URL+'/functions/v1/gbp-image', {
          method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
          body: JSON.stringify({
            action:'generate_scene',
            product_name: product,
            product_image_url: productUrl,
            scene: sceneLabels[sceneId] || sceneId,
            scene_id: sceneId,
            brand: 'V Wholesale Vijayawada',
            prompt_override: `Professional product photography: ${product} installed/displayed in a ${sceneLabels[sceneId]||sceneId}. Photo-realistic, architectural photography style, warm lighting, premium quality. The product should be the hero of the image. V Wholesale branding can be subtle.`
          })
        });
        const data = await res.json();
        return { sceneId, url: data.image_url || data.urls?.[0] || null, error: data.error };
      }));
      generatedImages.push(...batchResults);

      // Show progress
      if (results) results.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">⏳ Generated ${generatedImages.filter(g=>g.url).length}/${scenes.length} scenes…</div>`;
    }

    // Display results
    const successImages = generatedImages.filter(g => g.url);
    if (!successImages.length) throw new Error('No images generated — try again');

    if (results) results.innerHTML = `
      <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--text1)">✅ ${successImages.length} scenes generated for: ${product}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${successImages.map(img=>`
        <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
          <img src="${img.url}" style="width:100%;height:140px;object-fit:cover;display:block">
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.7));padding:8px">
            <div style="font-size:10px;color:#fff;font-weight:600">${img.sceneId.charAt(0).toUpperCase()+img.sceneId.slice(1)}</div>
          </div>
          <div style="position:absolute;top:6px;right:6px;display:flex;gap:4px">
            <a href="${img.url}" download style="background:rgba(0,0,0,.6);border:none;border-radius:4px;padding:4px 6px;font-size:10px;color:#fff;text-decoration:none">⬇️</a>
            <button onclick="usePhotoshootImage('${img.url}','${product}')" style="background:rgba(201,168,76,.9);border:none;border-radius:4px;padding:4px 6px;font-size:10px;color:#000;cursor:pointer;font-weight:700">Use</button>
          </div>
        </div>`).join('')}
      </div>
      <button onclick="openAIPhotoshoot()" class="mkt-btn mkt-btn-ghost" style="width:100%;margin-top:10px;font-size:12px;padding:8px">🔄 Generate New Scenes</button>`;

  } catch(e) {
    if (results) results.innerHTML = `<div style="color:var(--red);padding:12px;font-size:12px;text-align:center">❌ ${e.message}</div>`;
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent='✨ Generate AI Photoshoot'; btn.disabled=false; }
  }
}

async function usePhotoshootImage(imageUrl, product) {
  // Save to content_posts as master image and open content studio
  showMktToast('✅ Image saved — opening Content Studio');
  document.getElementById('photoshoot-overlay')?.remove();
  mktNav('content');
  setTimeout(() => {
    const topicEl = document.getElementById('cs-topic');
    if (topicEl) topicEl.value = product;
    // Pre-fill the image URL for publishing
    window._photoshootImageUrl = imageUrl;
    showMktToast('Topic and image ready — click Create to generate captions');
  }, 500);
}

async function renderPosterStudio() {
  const {data:bpArr} = await sb.from('brand_profile').select('*').limit(1).then(r=>r,()=>({data:[]}));
  const bp = (bpArr||[])[0]||{business_name:'V Wholesale',tagline:'Build Better. Pay Less.',phone:'8712697930',website:'https://vwholesale.in',address:'NH65, Bhavanipuram, Vijayawada'};

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">🎨 Poster Studio</h3>
    <div style="font-size:12px;color:var(--text3)">Generate with AI or upload your own → preview → publish everywhere</div>
  </div>

  <div class="mkt-grid-2" style="align-items:start;gap:16px">

    <!-- ═══ LEFT COLUMN: INPUT PANEL ═══ -->
    <div style="display:grid;gap:12px">

      <!-- MODE TOGGLE -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--bg3);border-radius:10px;padding:4px">
        <button id="ps-mode-ai" onclick="psSwitchMode('ai')"
          style="padding:10px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:700;background:var(--gold);color:#000;transition:all .2s">
          ✨ AI Generate
        </button>
        <button id="ps-mode-upload" onclick="psSwitchMode('upload')"
          style="padding:10px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:700;background:none;color:var(--text3);transition:all .2s">
          📁 Manual Upload
        </button>
      </div>

      <!-- AI GENERATE PANEL -->
      <div id="ps-ai-panel" class="mkt-card">
        <div class="mkt-card-title">📋 What's the poster about?</div>
        <div class="mkt-form-group">
          <label class="mkt-form-label">Topic / Product / Offer *</label>
          <input type="text" id="ps-topic" class="mkt-form-input"
            placeholder="e.g. Sunhearrt tiles, Monsoon bathroom offer, Contractor Club"
            onkeydown="if(event.key==='Enter') generateFullPoster()">
        </div>
        <div class="mkt-grid-2">
          <div class="mkt-form-group">
            <label class="mkt-form-label">Template</label>
            <select id="ps-template" class="mkt-form-select">
              <option value="product">Product Showcase</option>
              <option value="offer">Offer / Sale</option>
              <option value="contractor">Contractor Club</option>
              <option value="festival">Festival Special</option>
              <option value="store">Store Walk-in</option>
            </select>
          </div>
          <div class="mkt-form-group">
            <label class="mkt-form-label">Language</label>
            <select id="ps-lang" class="mkt-form-select">
              <option value="en">English</option>
              <option value="te">Telugu</option>
              <option value="te+en">Telugu + English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </div>
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:8px;padding:9px 12px;margin-bottom:12px;font-size:11.5px;color:var(--text3)">
          💡 gpt-image-2 generates the background · Canvas engine overlays all text · Zero garbled words · ~₹4/poster
        </div>
        <button class="mkt-btn mkt-btn-primary" onclick="generateFullPoster()" style="width:100%;padding:13px;font-size:14px;font-weight:900">
          ✨ Generate Poster
        </button>
      </div>

      <!-- MANUAL UPLOAD PANEL -->
      <div id="ps-upload-panel" class="mkt-card" style="display:none">
        <div class="mkt-card-title">📁 Upload Your Poster</div>
        <input type="file" id="ps-upload-file" accept="image/*" style="display:none" onchange="psHandleUpload()">
        <div id="ps-upload-zone" onclick="document.getElementById('ps-upload-file').click()"
          style="border:2px dashed var(--border);border-radius:10px;padding:28px;text-align:center;cursor:pointer;margin-bottom:12px;transition:border-color .2s"
          onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-size:36px;margin-bottom:8px">🖼</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">Click to upload poster</div>
          <div style="font-size:11px;color:var(--text3)">JPG or PNG · 1080×1080 recommended</div>
        </div>
        <div class="mkt-form-group">
          <label class="mkt-form-label">What is this poster about? *</label>
          <input type="text" id="ps-upload-topic" class="mkt-form-input"
            placeholder="e.g. Sunhearrt tiles available at V Wholesale"
            onkeydown="if(event.key==='Enter') psGenerateUploadCaption()">
        </div>
        <div class="mkt-grid-2">
          <div class="mkt-form-group">
            <label class="mkt-form-label">Template</label>
            <select id="ps-upload-template" class="mkt-form-select">
              <option value="product">Product Showcase</option>
              <option value="offer">Offer / Sale</option>
              <option value="contractor">Contractor Club</option>
              <option value="festival">Festival Special</option>
              <option value="store">Store Walk-in</option>
            </select>
          </div>
          <div class="mkt-form-group">
            <label class="mkt-form-label">Language</label>
            <select id="ps-upload-lang" class="mkt-form-select">
              <option value="en">English</option>
              <option value="te">Telugu</option>
              <option value="te+en">Telugu + English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </div>
        <button class="mkt-btn mkt-btn-primary" onclick="psGenerateUploadCaption()" style="width:100%;padding:11px;font-size:13px;font-weight:800">
          ✨ Generate Caption + Hashtags
        </button>
      </div>

      <!-- CAPTION BOX (shared, shown after generate or upload) -->
      <div class="mkt-card" id="ps-caption-card" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="mkt-card-title" style="margin:0">📝 Caption</div>
          <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="psEditCaption()">✏️ Edit</button>
        </div>
        <div id="ps-caption-display" style="background:var(--bg3);border-radius:8px;padding:11px;font-size:12px;line-height:1.7;white-space:pre-wrap;margin-bottom:10px;min-height:70px;cursor:pointer" onclick="psEditCaption()"></div>
        <textarea id="ps-caption-edit" rows="5" class="mkt-form-input" style="display:none;font-size:12px;line-height:1.7;resize:vertical;margin-bottom:8px"></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="mkt-btn mkt-btn-ghost" style="font-size:12px" onclick="copyCaptionPS()">📋 Copy Caption</button>
          <button class="mkt-btn mkt-btn-ghost" style="font-size:12px" onclick="downloadCurrentPoster()">⬇ Download PNG</button>
          <button class="mkt-btn mkt-btn-primary" style="font-size:12px" onclick="pushToStaffFeed()">📢 Push to Staff Feed</button>
          <button class="mkt-btn mkt-btn-ghost" style="font-size:12px;color:var(--purple)" onclick="generateFullPoster()">🔄 Regenerate</button>
        </div>
      </div>

      <!-- PUBLISH EVERYWHERE -->
      <div class="mkt-card" id="ps-publish-card" style="display:none">
        <div class="mkt-card-title">🚀 Publish Everywhere</div>
        <div style="display:grid;gap:8px">

          <!-- Instagram -->
          <div style="background:var(--bg3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">📸</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700">Instagram</div>
              <div style="font-size:11px;color:var(--text3)">Download poster → open app → paste caption</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="downloadCurrentPoster()">⬇ Save</button>
              <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="psPostInstagram()">Open →</button>
            </div>
          </div>

          <!-- WhatsApp -->
          <div style="background:var(--bg3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">💬</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700">WhatsApp Broadcast</div>
              <div style="font-size:11px;color:var(--text3)">Caption copied → open WhatsApp → send to broadcast</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="psPostWhatsApp()">Share →</button>
            </div>
          </div>

          <!-- Google Business Profile -->
          <div style="background:var(--bg3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">📍</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700">Google Business Profile</div>
              <div style="font-size:11px;color:var(--text3)">Add update with image and caption</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="copyCaptionPS()">📋 Copy</button>
              <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="window.open('https://business.google.com/','_blank')">Open →</button>
            </div>
          </div>

          <!-- Facebook -->
          <div style="background:var(--bg3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">📘</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700">Facebook Page</div>
              <div style="font-size:11px;color:var(--text3)">Post to V Wholesale Facebook page</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="copyCaptionPS()">📋 Copy</button>
              <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="window.open('https://www.facebook.com/','_blank')">Open →</button>
            </div>
          </div>

        </div>

        <!-- Save to history -->
        <button class="mkt-btn mkt-btn-ghost" style="width:100%;margin-top:10px;font-size:12px" onclick="psSaveFinal()">
          💾 Save to History
        </button>
      </div>

    </div><!-- end left column -->

    <!-- ═══ RIGHT COLUMN: PREVIEW ═══ -->
    <div>
      <div class="mkt-card" style="padding:12px;position:sticky;top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="mkt-card-title" style="margin:0">Preview · 1080×1080</div>
          <span id="ps-source-badge" style="display:none;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(201,168,76,0.15);color:var(--gold)"></span>
        </div>
        <div id="ps-preview" style="background:var(--bg3);border-radius:10px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden">
          <div style="text-align:center;color:var(--text3)">
            <div style="font-size:48px;margin-bottom:8px">🎨</div>
            <div style="font-size:12px">Generate with AI or upload your poster</div>
          </div>
        </div>
      </div>

      <!-- History -->
      <div id="ps-history-card" class="mkt-card" style="display:none;margin-top:12px">
        <div class="mkt-card-title">Recent Posters</div>
        <div id="ps-history"></div>
      </div>
    </div>

  </div>`);

  loadPosterHistory();
}

// ── MODE SWITCH ──
function psSwitchMode(mode) {
  const isAI = mode === 'ai';
  document.getElementById('ps-ai-panel').style.display     = isAI ? '' : 'none';
  document.getElementById('ps-upload-panel').style.display = isAI ? 'none' : '';
  const aiBtn  = document.getElementById('ps-mode-ai');
  const upBtn  = document.getElementById('ps-mode-upload');
  aiBtn.style.background  = isAI ? 'var(--gold)' : 'none';
  aiBtn.style.color       = isAI ? '#000' : 'var(--text3)';
  upBtn.style.background  = isAI ? 'none' : 'var(--gold)';
  upBtn.style.color       = isAI ? 'var(--text3)' : '#000';
  // Reset publish area if switching
  document.getElementById('ps-caption-card').style.display  = 'none';
  document.getElementById('ps-publish-card').style.display  = 'none';
  const preview = document.getElementById('ps-preview');
  preview.innerHTML = `<div style="text-align:center;color:var(--text3)"><div style="font-size:48px;margin-bottom:8px">${isAI?'🎨':'📁'}</div><div style="font-size:12px">${isAI?'Enter a topic and click Generate':'Upload your poster image'}</div></div>`;
  currentPosterB64 = null; currentCaption = '';
}

// ── MANUAL UPLOAD HANDLER ──
function psHandleUpload() {
  const file = document.getElementById('ps-upload-file')?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const b64 = e.target.result.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
    currentPosterB64 = b64;

    // Show preview immediately
    const preview = document.getElementById('ps-preview');
    preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;cursor:zoom-in" onclick="window.open(this.src)" title="Click to zoom">`;

    // Badge
    const badge = document.getElementById('ps-source-badge');
    if (badge) { badge.textContent = '📁 Uploaded'; badge.style.display = ''; }

    // Upload zone thumbnail
    const zone = document.getElementById('ps-upload-zone');
    if (zone) zone.innerHTML = `<img src="${e.target.result}" style="max-height:72px;border-radius:6px;object-fit:contain"><div style="font-size:11px;color:var(--gold);margin-top:6px;font-weight:700">✅ ${file.name}</div>`;

    // Show caption card with placeholder — user can generate or type manually
    currentCaption = '';
    const disp = document.getElementById('ps-caption-display');
    const edit = document.getElementById('ps-caption-edit');
    if (disp) { disp.style.display = 'none'; }
    if (edit) {
      edit.value = '';
      edit.placeholder = 'Click "Generate Caption + Hashtags" above, or type your own caption here...';
      edit.style.display = 'block';
      edit.oninput = () => { currentCaption = edit.value; };
    }
    document.getElementById('ps-caption-card').style.display  = '';
    document.getElementById('ps-publish-card').style.display  = '';
    showMktToast('✅ Poster loaded — fill the topic and generate caption');
  };
  reader.readAsDataURL(file);
}

// ── AI CAPTION GENERATION FOR UPLOADED POSTER ──
async function psGenerateUploadCaption() {
  const topic    = (document.getElementById('ps-upload-topic')?.value || '').trim();
  const template = document.getElementById('ps-upload-template')?.value || 'product';
  const lang     = document.getElementById('ps-upload-lang')?.value || 'en';

  if (!topic)           { showMktToast('Enter what the poster is about first'); return; }
  if (!currentPosterB64){ showMktToast('Upload a poster image first'); return; }

  const edit = document.getElementById('ps-caption-edit');
  const disp = document.getElementById('ps-caption-display');
  if (edit) { edit.value = '⏳ Generating caption...'; edit.disabled = true; edit.style.display = 'block'; }
  if (disp) disp.style.display = 'none';

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/generate-poster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ topic, template, language: lang, caption_only: true, business_name: 'V Wholesale' })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'API error');

    const c = data.content || {};

    // Use AI-generated caption directly — it's already rich with emojis + hashtags
    // Only build manually if caption field is missing
    let caption = c.caption || '';
    if (!caption) {
      // Extract clean brand name from headline_line1
      const brand = (c.headline_line1 || topic.split(' ')[0]).replace(/\s/g,'');
      const cat   = (c.headline_line2 || 'Tiles').replace(/\s/g,'');
      caption =
        `✨ ${c.headline_line1||''} ${c.headline_line2||''} — ${c.subheadline||'Now Available at V Wholesale'}\n\n` +
        `${c.body||'Premium Wall & Floor Tile Collection'}\n\n` +
        `💎 ${c.feature_gold||'Elegant Designs • Modern Finishes • Lasting Quality'}\n\n` +
        `✅ ${c.feature1||'Luxury Marble Looks'}\n` +
        `✅ ${c.feature2||'Glossy, Matt & Designer Finishes'}\n` +
        `✅ ${c.feature3||'Premium Quality for Modern Homes'}\n\n` +
        `📍 V Wholesale, NH65, Bhavanipuram, Vijayawada\n` +
        `📞 Call: 8712697930 | 🌐 vwholesale.in\n\n` +
        `#VWholesale #Vijayawada #${brand} #${cat} #HomeDesign #InteriorDesign #LuxuryLiving #BuildingMaterials #AndhraPradesh`;
    }

    currentCaption = caption;
    if (edit) { edit.value = caption; edit.disabled = false; edit.oninput = () => { currentCaption = edit.value; }; }
    showMktToast('✅ Caption generated — edit if needed, then publish!');

  } catch(e) {
    console.warn('Edge function error, using fallback:', e.message);
    // Clean fallback — extract brand word from topic properly
    const words  = topic.trim().split(/\s+/);
    const brand  = words[0] || 'Brand';
    const cat    = words.find(w => ['tiles','tile','granite','paints','paint','sanitary','bathware','electrical'].includes(w.toLowerCase())) || 'Tiles';

    const fallback =
      `✨ ${topic} — Now Available at V Wholesale, Vijayawada!\n\n` +
      `🏠 Transform your home with premium quality\n` +
      `💎 Elegant Designs • Modern Finishes • Lasting Quality\n` +
      `✅ Perfect for Living Rooms, Bedrooms & Bathrooms\n\n` +
      `📍 V Wholesale, NH65, Bhavanipuram, Vijayawada\n` +
      `📞 Call: 8712697930 | 🌐 vwholesale.in\n\n` +
      `#VWholesale #Vijayawada #${brand} #${cat} #HomeDesign #InteriorDesign #LuxuryLiving #BuildingMaterials #AndhraPradesh`;

    currentCaption = fallback;
    if (edit) { edit.value = fallback; edit.disabled = false; edit.oninput = () => { currentCaption = edit.value; }; }
    showMktToast('Caption ready — you can edit before posting');
  }
}


// ── CAPTION EDIT TOGGLE ──
function psEditCaption() {
  const disp = document.getElementById('ps-caption-display');
  const edit = document.getElementById('ps-caption-edit');
  if (!disp || !edit) return;
  if (edit.style.display === 'none') {
    edit.value = currentCaption;
    edit.style.display = 'block';
    disp.style.display = 'none';
    edit.focus();
    edit.oninput = () => { currentCaption = edit.value; };
  } else {
    currentCaption = edit.value;
    disp.textContent = currentCaption;
    disp.style.display = '';
    edit.style.display = 'none';
  }
}

// ── PUBLISH ACTIONS ──
function psPostInstagram() {
  copyCaptionPS();
  downloadCurrentPoster();
  setTimeout(() => window.open('https://www.instagram.com/', '_blank'), 600);
  showMktToast('📋 Caption copied + poster downloading → paste in Instagram');
}

function psPostWhatsApp() {
  const txt = currentCaption || 'Check out our latest offer at V Wholesale, Vijayawada!';
  copyCaptionPS();
  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
}

async function psSaveFinal() {
  const label = document.getElementById('ps-upload-topic')?.value?.trim() ||
                document.getElementById('ps-topic')?.value?.trim() ||
                'Poster';
  if (!currentPosterB64) { showMktToast('No poster to save'); return; }

  let image_url = null;
  try {
    await sb.storage.createBucket('brand-assets', { public: true }).catch(()=>{});
    const byteArr = Uint8Array.from(atob(currentPosterB64), c => c.charCodeAt(0));
    const blob = new Blob([byteArr], { type: 'image/png' });
    const fname = `posters/${Date.now()}-${label.replace(/\W/g,'_').slice(0,30)}.png`;
    const { error } = await sb.storage.from('brand-assets').upload(fname, blob, { contentType: 'image/png', upsert: true });
    if (!error) {
      const { data: u } = sb.storage.from('brand-assets').getPublicUrl(fname);
      image_url = u?.publicUrl || null;
    }
  } catch(e) { console.warn('Upload err:', e.message); }

  await sb.from('poster_history').insert({
    topic: label, template: 'manual', language: 'en',
    caption: currentCaption, image_url, status: 'draft',
    created_by: mktProfile?.name
  });
  showMktToast('✅ Saved to history!');
  loadPosterHistory();
}



// ── POSTER CANVAS COMPOSITOR ──
// Hero image from DALL-E 3 HD + all text/branding composited on HTML Canvas
// Eliminates ALL text garbling from image generation models

let currentPosterB64 = null;
let currentCaption = '';
let currentPosterContent = null;

async function generateFullPoster() {
  const topic = (document.getElementById('ps-topic')?.value||'').trim();
  const template = document.getElementById('ps-template')?.value||'product';
  const lang = document.getElementById('ps-lang')?.value||'en';
  if (!topic) { showMktToast('Enter a topic first'); return; }

  const preview = document.getElementById('ps-preview');
  const setStatus = (msg) => {
    const el = document.getElementById('ps-status');
    if (el) el.textContent = msg;
  };

  preview.innerHTML = `
  <div style="text-align:center;padding:40px">
    <div class="ai-thinking" style="justify-content:center;margin-bottom:16px">
      <div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>
    </div>
    <div style="font-size:14px;font-weight:700;color:var(--text2)" id="ps-status">✍️ Writing content…</div>
    <div style="font-size:12px;color:var(--text3);margin-top:6px">Then generating premium hero image with DALL-E 3 HD</div>
    <div style="font-size:11px;color:var(--text3);margin-top:4px">~30–50 seconds</div>
  </div>`;

  const {data:bpArr} = await sb.from('brand_profile').select('*').limit(1).then(r=>r,()=>({data:[]}));
  const bp = (bpArr||[])[0]||{};

  try {
    setStatus('✍️ Writing poster content…');
    const res = await fetch(`${MKT_SB_URL}/functions/v1/generate-poster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        topic, template, language: lang,
        business_name: bp.business_name||'V Wholesale',
        phone: bp.phone||'8712697930',
        website: bp.website||'vwholesale.in',
        address: bp.address||'NH65, Bhavanipuram, Vijayawada',
        tagline: bp.tagline||'Build Better. Pay Less.',
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Generation failed');

    setStatus('🎨 Compositing poster with Canvas engine…');
    currentPosterContent = data.content;
    currentCaption = data.content?.caption || `✨ ${topic} now at V Wholesale, Vijayawada! 📞 8712697930 | vwholesale.in #VWholesale #Vijayawada`;

    const bizInfo = {
      name: bp.business_name || 'V Wholesale',
      phone: bp.phone || '8712697930',
      website: (bp.website || 'vwholesale.in').replace('https://','').replace('http://',''),
      address: bp.address || 'NH65, Bhavanipuram, Vijayawada',
      tagline: (bp.tagline || 'Beautiful Spaces. Built to Last.').toUpperCase(),
    };

    const posterB64 = await composePosterCanvas(data.image_b64, data.content, bizInfo);
    currentPosterB64 = posterB64;

    preview.innerHTML = `<img src="data:image/png;base64,${posterB64}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;cursor:zoom-in" onclick="window.open(this.src)" title="Click to zoom">`;

    // Show source badge
    const badge = document.getElementById('ps-source-badge');
    if (badge) { badge.textContent = `✨ ${data.image_source === 'gpt-image-2' ? 'gpt-image-2' : 'Stock Photo'}`; badge.style.display = ''; }

    // Populate caption in new unified card
    const capDisp = document.getElementById('ps-caption-display');
    const capEdit = document.getElementById('ps-caption-edit');
    if (capDisp) { capDisp.textContent = currentCaption; capDisp.style.display = ''; }
    if (capEdit) { capEdit.value = currentCaption; capEdit.style.display = 'none'; }
    document.getElementById('ps-caption-card').style.display  = '';
    document.getElementById('ps-publish-card').style.display  = '';

    // Save composited poster to Supabase Storage (upsert=true to never fail on duplicate)
    let image_url = null;
    try {
      const byteArr = Uint8Array.from(atob(posterB64), c => c.charCodeAt(0));
      const blob = new Blob([byteArr], { type: 'image/png' });
      const filename = `posters/${Date.now()}-${topic.replace(/[^a-z0-9]/gi,'_').slice(0,30)}.png`;

      // Ensure bucket exists (creates if missing — idempotent)
      await sb.storage.createBucket('brand-assets', { public: true }).catch(()=>{});

      const { data: upData, error: upErr } = await sb.storage.from('brand-assets').upload(filename, blob, { contentType: 'image/png', upsert: true });
      if (upErr) {
        console.error('Storage upload error:', upErr.message, upErr);
      } else {
        const { data: urlData } = sb.storage.from('brand-assets').getPublicUrl(filename);
        image_url = urlData?.publicUrl || null;
        console.log('Poster uploaded:', image_url);
      }
    } catch(uploadErr) {
      console.error('Upload exception:', uploadErr.message);
    }

    // Insert history record and get the new ID so we can cache b64 locally
    const { data: inserted } = await sb.from('poster_history').insert({
      topic, template, language: lang,
      headline: data.content?.headline_line1,
      caption: currentCaption,
      image_url,
      status: 'draft',
      created_by: mktProfile?.name
    }).select('id').single().then(r=>r, ()=>({data:null}));

    // Cache composited poster in sessionStorage by ID (survives page nav, not hard refresh)
    if (inserted?.id) {
      try { sessionStorage.setItem(`poster_b64_${inserted.id}`, posterB64); } catch(e) {}
    }

    loadPosterHistory();
    showMktToast(image_url ? '✅ Poster saved! Click image to zoom or download.' : '✅ Poster ready! (Storage upload failed — download now to save)');

  } catch(e) {
    preview.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red)">
      <div style="font-size:32px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:700;margin-bottom:4px">Generation Failed</div>
      <div style="font-size:12px;color:var(--text2)">${e.message}</div>
      <div style="font-size:11px;margin-top:8px;color:var(--text3)">Check OpenAI credits &amp; OPENAI_API_KEY secret in Supabase</div>
    </div>`;
  }
}

// ─────────────────────────────────────────────────────────
//  CANVAS COMPOSITOR — matches ChatGPT poster style
//  Navy left panel + hero photo right half + full text overlay
// ─────────────────────────────────────────────────────────
async function composePosterCanvas(heroB64, content, biz) {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');

  const NAVY  = '#1a2744';
  const GOLD  = '#c9a84c';
  const WHITE = '#ffffff';

  // Layout constants — hard split
  const SPLIT_X  = 442;   // left panel width
  const HERO_TOP = 0;
  const HERO_H   = 815;   // hero image zone height (top 75.5%)
  const BOT_Y    = HERO_H;
  const STRIP_Y  = S - 130;
  const FOOT_Y   = S - 90;

  // ── 1. Full navy canvas ──
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, S, S);

  // ── 2. Hero image — RIGHT HALF ONLY, strictly clipped ──
  try {
    const img = await loadImgB64(heroB64);
    ctx.save();
    // Clip strictly to right panel — no overlap with left text zone
    ctx.beginPath();
    ctx.rect(SPLIT_X, HERO_TOP, S - SPLIT_X, HERO_H);
    ctx.clip();
    const sc = Math.max((S - SPLIT_X) / img.width, HERO_H / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, SPLIT_X + ((S - SPLIT_X) - dw)/2, (HERO_H - dh)/2, dw, dh);
    ctx.restore();

    // Gold curved border between left panel and hero
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(SPLIT_X + 8, HERO_H / 2, HERO_H / 2 + 16, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();

    // Left-edge fade on hero (navy → transparent, 60px wide)
    const grad = ctx.createLinearGradient(SPLIT_X, 0, SPLIT_X + 60, 0);
    grad.addColorStop(0, 'rgba(26,39,68,1)');
    grad.addColorStop(1, 'rgba(26,39,68,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(SPLIT_X, HERO_TOP, 60, HERO_H);
  } catch(e) { console.warn('Hero image error:', e.message); }

  // ── 3. Solid navy LEFT PANEL — covers any bleed from hero ──
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, SPLIT_X, HERO_H);

  // ── 4. TOP-RIGHT badge ──
  ctx.save();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(S - 132, 0); ctx.lineTo(S, 0); ctx.lineTo(S, 86); ctx.lineTo(S - 148, 86);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = NAVY; ctx.textAlign = 'center';
  ctx.font = 'bold 10px Arial'; ctx.fillText('★ ★ ★', S - 66, 15);
  ctx.font = 'bold 12px Arial'; ctx.fillText('AVAILABLE', S - 66, 32);
  ctx.font = 'bold 12px Arial'; ctx.fillText('IN STORE', S - 66, 50);
  ctx.font = 'bold 10px Arial'; ctx.fillText('★ ★ ★', S - 66, 68);
  ctx.textAlign = 'left'; ctx.restore();

  // ── 5. V WHOLESALE LOGO + NAME ──
  psDrawVLogo(ctx, 36, 26, 50, GOLD);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 20px Arial';
  ctx.fillText('V WHOLESALE', 96, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '9.5px Arial';
  ctx.fillText('TILES  •  SANITARY  •  BATHWARE', 96, 64);

  // ── 6. HEADLINE LINE 1 — brand name, gold, large ──
  const h1 = (content?.headline_line1 || 'SUNHEARRT').toUpperCase();
  ctx.fillStyle = GOLD;
  psFitText(ctx, h1, 'bold', 36, 215, SPLIT_X - 50, 88, 44);

  // ── 7. HEADLINE LINE 2 — category, white, larger ──
  const h2 = (content?.headline_line2 || 'TILES').toUpperCase();
  ctx.fillStyle = WHITE;
  psFitText(ctx, h2, 'bold', 36, 340, SPLIT_X - 50, 116, 58);

  // Gold rule + diamond
  ctx.fillStyle = GOLD;
  ctx.fillRect(36, 362, SPLIT_X - 70, 2.5);
  ctx.save();
  ctx.translate(SPLIT_X / 2, 362);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();

  // ── 8. SUBHEADLINE — gold bar ──
  const sub = content?.subheadline || 'Now Available at V Wholesale';
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 374, SPLIT_X + 20, 44);
  ctx.fillStyle = NAVY;
  ctx.font = 'bold 16px Arial';
  ctx.fillText(sub, 36, 402);

  // ── 9. BODY TEXT ──
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 15.5px Arial';
  const bodyTxt = content?.body || 'Premium Wall & Floor Tile Collection';
  ctx.fillText(bodyTxt, 36, 444);

  // Gold italic features
  ctx.fillStyle = GOLD;
  ctx.font = 'italic 13px Arial';
  const featLine = content?.feature_gold || 'Elegant Designs • Modern Finishes • Lasting Quality';
  psWrapText(ctx, featLine, 36, 466, SPLIT_X - 50, 18);

  // Thin gold rule
  ctx.strokeStyle = 'rgba(201,168,76,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36, 490); ctx.lineTo(SPLIT_X - 20, 490); ctx.stroke();

  // House icon + usage line
  psHouseIcon(ctx, 36, 500, GOLD);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '12.5px Arial';
  const usageTxt = content?.usage || 'Perfect for Living Rooms, Bedrooms, Bathrooms & Outdoor Spaces';
  psWrapText(ctx, usageTxt, 62, 508, SPLIT_X - 60, 17);

  // ── 10. BOTTOM ZONE — dark band across full width ──
  ctx.fillStyle = 'rgba(8,15,35,0.72)';
  ctx.fillRect(0, BOT_Y, S, STRIP_Y - BOT_Y);

  // ── 11. FEATURE ICONS — 3 equal columns ──
  const iconY   = BOT_Y + 12;
  const COL_W   = S / 3;
  const icons   = ['◈', '⬡', '✦'];
  const flabels = [
    (content?.feature1 || 'Luxury Marble Looks').replace(' & ', '\n& '),
    (content?.feature2 || 'Glossy, Matt &\nDesigner Finishes'),
    (content?.feature3 || 'Premium Quality\nfor Modern Homes'),
  ];
  [0, 1, 2].forEach(i => {
    const cx = COL_W * i + COL_W / 2;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, iconY + 28, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
    ctx.fillText(icons[i], cx, iconY + 36);
    ctx.fillStyle = WHITE; ctx.font = '11.5px Arial';
    flabels[i].split('\n').forEach((ln, li) => ctx.fillText(ln, cx, iconY + 70 + li * 15));
    if (i < 2) {
      ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(COL_W * (i + 1), iconY + 8);
      ctx.lineTo(COL_W * (i + 1), iconY + 92);
      ctx.stroke();
    }
  });
  ctx.textAlign = 'left';

  // ── 12. CATEGORY STRIP — gold bar ──
  const stripItems = content?.strip_items || ['TILES', 'GRANITE', 'SANITARYWARE', 'PAINTS', 'ELECTRICALS'];
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, STRIP_Y, S, 38);
  ctx.fillStyle = NAVY;
  ctx.font = 'bold 12.5px Arial';
  ctx.textAlign = 'center';
  const sw = S / stripItems.length;
  stripItems.forEach((item, i) => ctx.fillText(item.toUpperCase(), sw * i + sw / 2, STRIP_Y + 25));
  ctx.textAlign = 'left';

  // ── 13. FOOTER — navy bar ──
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, FOOT_Y, S, S - FOOT_Y);
  // Gold top rule
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, FOOT_Y, S, 2);

  // Left: business details
  ctx.fillStyle = GOLD; ctx.font = 'bold 26px Arial';
  ctx.fillText(biz.name || 'V Wholesale', 36, FOOT_Y + 33);
  ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = '11.5px Arial';
  ctx.fillText('📍 ' + (biz.address || 'NH65, Bhavanipuram, Vijayawada'), 36, FOOT_Y + 53);
  ctx.fillText('📞 Call: ' + (biz.phone || '8712697930'), 36, FOOT_Y + 69);
  ctx.fillText('🌐 ' + (biz.website || 'vwholesale.in'), 36, FOOT_Y + 85);

  // Right: CTA button
  const ctaW = 258, ctaH = 48;
  const ctaX = S - ctaW - 36;
  const ctaY = FOOT_Y + 20;
  ctx.fillStyle = 'rgba(201,168,76,0.1)';
  psRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 24, 24, 24, 24); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  psRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 24, 24, 24, 24); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.font = 'bold 13.5px Arial'; ctx.textAlign = 'center';
  ctx.fillText((content?.cta || 'VISIT OUR STORE TODAY').toUpperCase() + '  ›', ctaX + ctaW / 2, ctaY + 30);
  ctx.textAlign = 'left';

  // Bottom tagline centre
  ctx.fillStyle = 'rgba(201,168,76,0.7)'; ctx.font = 'italic 11px Arial'; ctx.textAlign = 'center';
  ctx.fillText(biz.tagline || 'BEAUTIFUL SPACES. BUILT TO LAST.', S / 2, S - 8);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
}

// ── CANVAS UTILS ──
function loadImgB64(b64) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Image load failed'));
    img.src = 'data:image/png;base64,' + b64;
  });
}
function psRoundedRect(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x+tl, y);
  ctx.lineTo(x+w-tr, y); ctx.arcTo(x+w, y, x+w, y+tr, tr);
  ctx.lineTo(x+w, y+h-br); ctx.arcTo(x+w, y+h, x+w-br, y+h, br);
  ctx.lineTo(x+bl, y+h); ctx.arcTo(x, y+h, x, y+h-bl, bl);
  ctx.lineTo(x, y+tl); ctx.arcTo(x, y, x+tl, y, tl);
  ctx.closePath();
}
function psFitText(ctx, text, weight, x, y, maxW, startSz, minSz) {
  let sz = startSz;
  ctx.font = `${weight} ${sz}px Arial`;
  while (ctx.measureText(text).width > maxW && sz > minSz) {
    sz -= 4; ctx.font = `${weight} ${sz}px Arial`;
  }
  ctx.fillText(text, x, y);
}
function psWrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' '); let line = '';
  for (const w of words) {
    const t = line + w + ' ';
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line.trim(), x, y); y += lineH; line = w + ' '; }
    else line = t;
  }
  ctx.fillText(line.trim(), x, y);
}
function psDrawVLogo(ctx, x, y, sz, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5;
  // Diamond outline
  ctx.beginPath();
  ctx.moveTo(x+sz/2,y); ctx.lineTo(x+sz,y+sz/2); ctx.lineTo(x+sz/2,y+sz); ctx.lineTo(x,y+sz/2);
  ctx.closePath(); ctx.stroke();
  // V shape
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(x+sz*0.24,y+sz*0.3); ctx.lineTo(x+sz*0.5,y+sz*0.72); ctx.lineTo(x+sz*0.76,y+sz*0.3);
  ctx.stroke();
  // Crown dots
  [0.2,0.5,0.8].forEach(p => { ctx.beginPath(); ctx.arc(x+sz*p,y+sz*0.16,3.5,0,Math.PI*2); ctx.fill(); });
  ctx.restore();
}
function psHouseIcon(ctx, x, y, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x,y+9); ctx.lineTo(x+10,y); ctx.lineTo(x+20,y+9);
  ctx.moveTo(x+2,y+9); ctx.lineTo(x+2,y+20); ctx.lineTo(x+18,y+20); ctx.lineTo(x+18,y+9);
  ctx.moveTo(x+7,y+14); ctx.lineTo(x+7,y+20); ctx.lineTo(x+13,y+20); ctx.lineTo(x+13,y+14); ctx.closePath();
  ctx.stroke(); ctx.restore();
}

// ── POSTER ACTIONS ──
function downloadCurrentPoster() {
  if (!currentPosterB64) { showMktToast('Generate a poster first'); return; }
  const a = document.createElement('a');
  a.download = 'vwholesale-poster-' + Date.now() + '.png';
  a.href = 'data:image/png;base64,' + currentPosterB64;
  a.click();
  showMktToast('✅ Downloaded!');
}
function copyCaptionPS() {
  // Sync from edit textarea if it's open
  const edit = document.getElementById('ps-caption-edit');
  if (edit && edit.style.display !== 'none') currentCaption = edit.value;
  if (!currentCaption) { showMktToast('No caption yet — write one or generate first'); return; }
  navigator.clipboard.writeText(currentCaption).then(() => showMktToast('📋 Caption copied!'));
}
async function regeneratePoster(topic, template, lang) {
  const topicEl = document.getElementById('ps-topic');
  const tmplEl  = document.getElementById('ps-template');
  const langEl  = document.getElementById('ps-lang');
  if (topicEl) topicEl.value = topic;
  if (tmplEl)  tmplEl.value  = template;
  if (langEl)  langEl.value  = lang;
  document.getElementById('mkt-content').scrollTo({top:0, behavior:'smooth'});
  showMktToast('Ready — click ✨ Generate Poster');
}

async function viewPosterHistory(id) {
  const {data:h} = await sb.from('poster_history').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!h) { showMktToast('Not found'); return; }

  // Check if we have the composited image cached in sessionStorage
  let cachedB64 = null;
  try { cachedB64 = sessionStorage.getItem(`poster_b64_${id}`); } catch(e) {}

  // Decide what image source to show
  const imgSrc = h.image_url || (cachedB64 ? `data:image/png;base64,${cachedB64}` : null);
  const downloadHref = h.image_url || (cachedB64 ? `data:image/png;base64,${cachedB64}` : null);

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:520px;overflow:hidden;margin-top:20px">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:14px;font-weight:900;color:#fff">${h.topic||'Poster'}</div>
        <div style="font-size:11px;color:#64748B">${h.template||'product'} · ${h.language||'en'} · ${new Date(h.created_at).toLocaleDateString('en-IN')}</div>
      </div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      ${imgSrc
        ? `<img src="${imgSrc}" style="width:100%;border-radius:10px;display:block;cursor:zoom-in" loading="lazy"
             onclick="window.open(this.src)"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`
        : ''
      }
      <div style="background:var(--bg3);border-radius:10px;padding:32px;text-align:center;color:var(--text3);font-size:13px${imgSrc?';display:none':''}">
        <div style="font-size:32px;margin-bottom:8px">🖼</div>
        Click Regenerate to recreate this poster.
      </div>
      ${h.caption?`<div style="background:var(--bg3);border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">CAPTION</div>
        <div style="font-size:12px;line-height:1.7;white-space:pre-wrap;max-height:120px;overflow-y:auto">${h.caption}</div>
      </div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${downloadHref?`<a href="${downloadHref}" download="vwholesale-poster-${h.id}.png" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">⬇ Download</a>`:''}
        <button class="mkt-btn mkt-btn-primary" style="flex:1"
          onclick="this.closest('[style*=fixed]').remove();
          document.getElementById('ps-topic').value='${(h.topic||'').replace(/'/g,"\\'")}';
          document.getElementById('ps-template').value='${h.template||'product'}';
          document.getElementById('ps-lang').value='${h.language||'en'}';
          mktNav('poster')">🔄 Regenerate</button>
        <button class="mkt-btn mkt-btn-ghost" style="color:var(--red)"
          onclick="if(confirm('Delete?')){deletePosterHistory(${h.id});this.closest('[style*=fixed]').remove();}">🗑 Delete</button>
        ${h.caption?`<button class="mkt-btn mkt-btn-ghost" onclick="copyPosterCaption(${h.id})">📋 Copy</button>`:''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
}

async function copyPosterCaption(id) {
  const {data:h} = await sb.from('poster_history').select('caption').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (h?.caption) navigator.clipboard.writeText(h.caption).then(() => showMktToast('📋 Copied!'));
}
async function deletePosterHistory(id) {
  if (!confirm('Delete this poster?')) return;
  await sb.from('poster_history').delete().eq('id', id);
  showMktToast('Deleted'); loadPosterHistory();
}
async function loadPosterHistory() {
  const {data:history} = await sb.from('poster_history').select('*').order('created_at',{ascending:false}).limit(8).then(r=>r,()=>({data:[]}));
  const card = document.getElementById('ps-history-card');
  const el   = document.getElementById('ps-history');
  if (!card||!el) return;
  if (!(history||[]).length) return;
  card.style.display = 'block';
  el.innerHTML = (history||[]).map(h=>`
  <div onclick="viewPosterHistory(${h.id})" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:10px;align-items:flex-start" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='none'">
    ${h.image_url
      ? `<img src="${h.image_url}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid var(--border)" loading="lazy" onerror="this.style.display='none'">`
      : `<div style="width:52px;height:52px;background:var(--bg3);border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">🖼</div>`
    }
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.topic||'—'}</div>
        <span class="badge ${h.status==='published'?'badge-green':h.status==='scheduled'?'badge-blue':'badge-gray'}" style="flex-shrink:0">${h.status}</span>
      </div>
      <div style="font-size:11px;color:var(--text3)">${h.template||'product'} · ${h.language||'en'} · ${new Date(h.created_at).toLocaleDateString('en-IN')}</div>
      ${h.caption?`<div style="font-size:11px;color:var(--text3);line-height:1.4;margin-top:2px">${h.caption.slice(0,60)}${h.caption.length>60?'…':''}</div>`:''}
    </div>
    <span style="color:var(--text3);font-size:14px;flex-shrink:0">›</span>
  </div>`).join('');
}

// ── DRAFT VIEWER ──

// ── STUB PAGES ──
// ── STUB PAGES — rich coming soon UI ──
function _comingSoonCard(icon, title, desc, features, eta) {
  return `<div style="max-width:600px;margin:0 auto">
    <div class="mkt-card" style="text-align:center;padding:32px 24px">
      <div style="font-size:48px;margin-bottom:12px">${icon}</div>
      <div style="font-size:20px;font-weight:900;margin-bottom:8px">${title}</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:20px">${desc}</div>
      <div style="display:grid;gap:8px;text-align:left;margin-bottom:20px">
        ${features.map(f=>`<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:8px;padding:10px 14px">
          <span style="font-size:18px">${f.icon}</span>
          <div><div style="font-size:12px;font-weight:700">${f.title}</div><div style="font-size:11px;color:var(--text3)">${f.desc}</div></div>
        </div>`).join('')}
      </div>
      <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:10px;font-size:12px;color:#c9a84c;font-weight:700">🗓 ${eta}</div>
    </div>
  </div>`;
}

async function renderCampaigns() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">📣 Campaign Manager</h3>
    <div style="font-size:12px;color:var(--text3)">Plan, execute and track multi-channel marketing campaigns</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="showCampaignBuilder()">+ New Campaign</button>
  </div>
  <div id="camp-list"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div></div>`);
  await loadCampaigns();
}

async function loadCampaigns() {
  const {data:camps} = await sb.from('campaigns').select('*').order('created_at',{ascending:false}).then(r=>r,()=>({data:[]}));
  const el = document.getElementById('camp-list');
  if (!el) return;

  if (!(camps||[]).length) {
    el.innerHTML = `<div class="mkt-card" style="text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:12px">📣</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:8px">No campaigns yet</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px">Create your first campaign — set goal, budget, platforms and start tracking performance</div>
      <button class="mkt-btn mkt-btn-primary" onclick="showCampaignBuilder()">+ Create First Campaign</button>
    </div>`;
    return;
  }

  const statusColor = {draft:'var(--text3)', active:'#22c55e', paused:'#f59e0b', completed:'#64748b'};
  const statusBg = {draft:'badge-gray', active:'badge-green', paused:'badge-blue', completed:'badge-gray'};

  el.innerHTML = `
  <!-- Summary row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
    ${[
      {label:'Total Campaigns', val: camps.length, icon:'📣'},
      {label:'Active', val: camps.filter(c=>c.status==='active').length, icon:'🟢'},
      {label:'Total Budget', val: '₹'+((camps.reduce((s,c)=>s+(c.budget_inr||0),0)/1000).toFixed(0))+'K', icon:'💰'},
      {label:'Total Spent', val: '₹'+((camps.reduce((s,c)=>s+(c.spent_inr||0),0)/1000).toFixed(0))+'K', icon:'📊'}
    ].map(m=>`<div class="mkt-card" style="padding:12px;text-align:center">
      <div style="font-size:20px">${m.icon}</div>
      <div style="font-size:18px;font-weight:900;margin:4px 0">${m.val}</div>
      <div style="font-size:10px;color:var(--text3)">${m.label}</div>
    </div>`).join('')}
  </div>

  <!-- Campaign cards -->
  <div style="display:grid;gap:12px">
    ${camps.map(c => {
      const days = c.end_date ? Math.ceil((new Date(c.end_date)-new Date())/(1000*60*60*24)) : null;
      const pct = c.budget_inr > 0 ? Math.min(100, Math.round((c.spent_inr||0)/c.budget_inr*100)) : 0;
      const platforms = (c.platforms||[]);
      const cpl = c.conversions > 0 ? '₹'+Math.round((c.spent_inr||0)/c.conversions) : '—';
      return `<div class="mkt-card" style="padding:16px">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="font-size:15px;font-weight:900">${c.name}</div>
              <span class="badge ${statusBg[c.status]||'badge-gray'}">${c.status}</span>
            </div>
            <div style="font-size:12px;color:var(--text3)">${c.goal||'—'} · ${platforms.join(' · ')||'No platforms'}</div>
            ${c.start_date ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${new Date(c.start_date).toLocaleDateString('en-IN')} → ${c.end_date?new Date(c.end_date).toLocaleDateString('en-IN'):'ongoing'} ${days!==null&&days>0?'('+days+' days left)':days<=0?'(ended)':''}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="mkt-btn mkt-btn-ghost" onclick="editCampaign(${c.id})" style="font-size:11px;padding:4px 8px">✏️</button>
            <button class="mkt-btn mkt-btn-ghost" onclick="toggleCampaignStatus(${c.id},'${c.status}')" style="font-size:11px;padding:4px 8px">${c.status==='active'?'⏸ Pause':c.status==='paused'?'▶️ Resume':'▶️ Start'}</button>
            <button class="mkt-btn mkt-btn-ghost" onclick="deleteCampaign(${c.id})" style="font-size:11px;padding:4px 8px;color:var(--red)">🗑</button>
          </div>
        </div>

        <!-- Budget bar -->
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px">
            <span>Budget: ₹${(c.budget_inr||0).toLocaleString('en-IN')}</span>
            <span>Spent: ₹${(c.spent_inr||0).toLocaleString('en-IN')} (${pct}%)</span>
          </div>
          <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${pct>80?'#ef4444':pct>50?'#f59e0b':'#22c55e'};border-radius:3px;transition:width .3s"></div>
          </div>
        </div>

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
          ${[
            {label:'Impressions', val:(c.impressions||0).toLocaleString('en-IN')},
            {label:'Clicks', val:(c.clicks||0).toLocaleString('en-IN')},
            {label:'Conversions', val:(c.conversions||0).toLocaleString('en-IN')},
            {label:'Cost/Lead', val:cpl}
          ].map(m=>`<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center">
            <div style="font-size:13px;font-weight:700">${m.val}</div>
            <div style="font-size:10px;color:var(--text3)">${m.label}</div>
          </div>`).join('')}
        </div>

        <!-- Update stats + AI tip -->
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="mkt-btn mkt-btn-ghost" onclick="updateCampaignStats(${c.id})" style="font-size:11px;padding:4px 10px">📊 Update Stats</button>
          <button class="mkt-btn mkt-btn-primary" onclick="getCampaignAITip(${c.id},'${c.name.replace(/'/g,"\'")}')" style="font-size:11px;padding:4px 10px">🤖 AI Tip</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function showCampaignBuilder(existing) {
  const c = existing || {};
  const m = document.createElement('div');
  m.id = 'camp-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:540px;overflow:hidden;margin-top:20px">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">${c.id?'✏️ Edit Campaign':'📣 New Campaign'}</div>
      <button onclick="document.getElementById('camp-modal').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">

      <div class="mkt-form-group">
        <label class="mkt-form-label">Campaign Name *</label>
        <input id="camp-name" class="mkt-form-input" value="${c.name||''}" placeholder="e.g. Monsoon Bathroom Sale, Diwali Tiles Offer">
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Goal *</label>
        <select id="camp-goal" class="mkt-form-select">
          ${['Brand Awareness','Store Walk-ins','Lead Generation','Contractor Club Signups','Product Launch','Festival Offer','Clearance Sale'].map(g=>`<option value="${g}" ${c.goal===g?'selected':''}>${g}</option>`).join('')}
        </select>
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Platforms</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
          ${['Instagram','Facebook','WhatsApp','GBP','YouTube','X (Manual)','Google Ads','Meta Ads'].map(p=>`
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;background:var(--bg3);padding:6px 10px;border-radius:6px;border:1px solid ${(c.platforms||[]).includes(p)?'var(--gold)':'var(--border)'}">
            <input type="checkbox" value="${p}" ${(c.platforms||[]).includes(p)?'checked':''} onchange="this.closest('label').style.borderColor=this.checked?'var(--gold)':'var(--border)'">
            ${p}
          </label>`).join('')}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mkt-form-group">
          <label class="mkt-form-label">Budget (₹)</label>
          <input id="camp-budget" type="number" class="mkt-form-input" value="${c.budget_inr||''}" placeholder="30000">
        </div>
        <div class="mkt-form-group">
          <label class="mkt-form-label">Spent so far (₹)</label>
          <input id="camp-spent" type="number" class="mkt-form-input" value="${c.spent_inr||''}" placeholder="0">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mkt-form-group">
          <label class="mkt-form-label">Start Date</label>
          <input id="camp-start" type="date" class="mkt-form-input" value="${c.start_date||''}">
        </div>
        <div class="mkt-form-group">
          <label class="mkt-form-label">End Date</label>
          <input id="camp-end" type="date" class="mkt-form-input" value="${c.end_date||''}">
        </div>
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Target Audience</label>
        <input id="camp-audience" class="mkt-form-input" value="${c.target_audience||''}" placeholder="e.g. Homeowners 30-55, Contractors in Vijayawada">
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Notes</label>
        <input id="camp-notes" class="mkt-form-input" value="${c.notes||''}" placeholder="Key message, offer details, etc.">
      </div>

      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="saveCampaign(${c.id||'null'})">💾 ${c.id?'Update Campaign':'Create Campaign'}</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('camp-modal').remove()">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

async function saveCampaign(id) {
  const name = (document.getElementById('camp-name')?.value||'').trim();
  if (!name) { showMktToast('Enter campaign name'); return; }
  const platforms = [...document.querySelectorAll('#camp-modal input[type=checkbox]:checked')].map(cb=>cb.value);
  const payload = {
    name,
    goal: document.getElementById('camp-goal')?.value||'Brand Awareness',
    platforms,
    budget_inr: parseFloat(document.getElementById('camp-budget')?.value||'0')||0,
    spent_inr: parseFloat(document.getElementById('camp-spent')?.value||'0')||0,
    start_date: document.getElementById('camp-start')?.value||null,
    end_date: document.getElementById('camp-end')?.value||null,
    target_audience: document.getElementById('camp-audience')?.value?.trim()||null,
    notes: document.getElementById('camp-notes')?.value?.trim()||null,
    updated_at: new Date().toISOString()
  };

  let error;
  if (id) {
    ({error} = await sb.from('campaigns').update(payload).eq('id',id));
  } else {
    payload.created_by = mktProfile?.name;
    payload.status = 'draft';
    ({error} = await sb.from('campaigns').insert(payload));
  }

  if (error) { showMktToast('❌ '+error.message); return; }
  document.getElementById('camp-modal')?.remove();
  showMktToast(id ? '✅ Campaign updated' : '✅ Campaign created');
  await loadCampaigns();
}

async function editCampaign(id) {
  const {data:c} = await sb.from('campaigns').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (c) showCampaignBuilder(c);
}

async function toggleCampaignStatus(id, currentStatus) {
  const next = currentStatus==='active' ? 'paused' : currentStatus==='paused' ? 'active' : 'active';
  await sb.from('campaigns').update({status:next,updated_at:new Date().toISOString()}).eq('id',id);
  showMktToast('Campaign '+(next==='active'?'started ▶️':'paused ⏸'));
  await loadCampaigns();
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign?')) return;
  await sb.from('campaigns').delete().eq('id',id);
  showMktToast('Deleted');
  await loadCampaigns();
}

function updateCampaignStats(id) {
  const m = document.createElement('div');
  m.id = 'stats-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:380px;overflow:hidden">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">📊 Update Stats</div>
      <button onclick="document.getElementById('stats-modal').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:10px">
      <div class="mkt-form-group"><label class="mkt-form-label">Impressions</label><input id="stat-imp" type="number" class="mkt-form-input" placeholder="0"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Clicks</label><input id="stat-clk" type="number" class="mkt-form-input" placeholder="0"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Conversions (walk-ins / leads)</label><input id="stat-conv" type="number" class="mkt-form-input" placeholder="0"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Amount Spent (₹)</label><input id="stat-spent" type="number" class="mkt-form-input" placeholder="0"></div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="saveStats(${id})">Save Stats</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('stats-modal').remove()">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

async function saveStats(id) {
  const payload = {
    impressions: parseInt(document.getElementById('stat-imp')?.value||'0')||0,
    clicks: parseInt(document.getElementById('stat-clk')?.value||'0')||0,
    conversions: parseInt(document.getElementById('stat-conv')?.value||'0')||0,
    spent_inr: parseFloat(document.getElementById('stat-spent')?.value||'0')||0,
    updated_at: new Date().toISOString()
  };
  await sb.from('campaigns').update(payload).eq('id',id);
  document.getElementById('stats-modal')?.remove();
  showMktToast('✅ Stats updated');
  await loadCampaigns();
}

async function getCampaignAITip(id, name) {
  showMktToast('🤖 Getting AI tip for '+name+'…');
  const {data:c} = await sb.from('campaigns').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!c) return;

  const cpl = c.conversions > 0 ? Math.round((c.spent_inr||0)/c.conversions) : null;
  const pct = c.budget_inr > 0 ? Math.round((c.spent_inr||0)/c.budget_inr*100) : 0;

  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({
      task:'campaign_tip',
      language:'en',
      context:{
        campaign_name: c.name,
        goal: c.goal,
        platforms: c.platforms,
        budget: c.budget_inr,
        spent: c.spent_inr,
        budget_used_pct: pct,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        cost_per_lead: cpl,
        days_left: c.end_date ? Math.ceil((new Date(c.end_date)-new Date())/(1000*60*60*24)) : null,
        target_audience: c.target_audience
      }
    })
  });

  const data = await res.json();
  const tip = data.content || data.text || 'No tip returned';

  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;overflow:hidden">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">🤖 AI Campaign Tip — ${c.name}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:20px">
      <div style="font-size:13px;line-height:1.8;white-space:pre-wrap">${tip}</div>
    </div>
    <div style="padding:0 16px 16px">
      <button class="mkt-btn mkt-btn-ghost" style="width:100%" onclick="this.closest('[style*=fixed]').remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

function renderSocial() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">📱 Social Media</h3>
    <div style="font-size:12px;color:var(--text3)">Connect platforms · Generate content · Publish everywhere</div></div>
  </div>

  <!-- Platform connection status -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div class="mkt-card-title">Platform Connections</div>
    <div style="display:grid;gap:10px">
      ${[
        {icon:'📸', name:'Instagram', size:'1080×1080 · Reels 9:16', status:'pending', action:'Connect via Meta Business', url:'https://business.facebook.com'},
        {icon:'👥', name:'Facebook Page', size:'1200×630 · Feed · Reels 9:16', status:'pending', action:'Same Meta Business account', url:'https://business.facebook.com'},
        {icon:'🧵', name:'Threads', size:'1080×1080 · Video 9:16', status:'pending', action:'Meta Graph API — same auth as Instagram', url:'https://business.facebook.com'},
        {icon:'▶️', name:'YouTube / Shorts', size:'1080×1920 · Max 60s for Shorts', status:'pending', action:'Authorize V Wholesale YouTube channel', url:'https://console.cloud.google.com'},
        {icon:'📍', name:'Google Business Profile', size:'1200×900 · Event posts', status:'pending', action:'Google OAuth — same account as Search Console', url:'https://console.cloud.google.com'},
        {icon:'💬', name:'WhatsApp Status', size:'1080×1920 · Via Interakt', status:'pending', action:'Complete Interakt BSP setup', url:'https://app.interakt.ai'},
        {icon:'✖️', name:'X (Twitter)', size:'1200×675 · Manual posting', status:'manual', action:'Manual — open X, paste content', url:'https://x.com/compose/tweet'}
      ].map(p => '<div style="display:flex;align-items:center;gap:12px;background:var(--bg3);border-radius:10px;padding:12px">'
        + '<div style="font-size:24px;width:36px;text-align:center">'+p.icon+'</div>'
        + '<div style="flex:1">'
        + '<div style="font-size:13px;font-weight:700">'+p.name+'</div>'
        + '<div style="font-size:11px;color:var(--text3)">'+p.size+'</div>'
        + '<div style="font-size:11px;color:var(--text3);margin-top:2px">→ '+p.action+'</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">'
        + '<span class="badge '+(p.status==='manual'?'badge-blue':'badge-gray')+'">'+(p.status==='manual'?'Manual':'Not connected')+'</span>'
        + '<a href="'+p.url+'" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px;text-decoration:none">'+(p.status==='manual'?'Open X ↗':'Setup ↗')+'</a>'
        + '</div></div>'
      ).join('')}
    </div>
  </div>

  <!-- Manual X posting helper -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div class="mkt-card-title">✖️ Post to X (Twitter) — Manual</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Generate your caption below, copy it, then click Open X to paste and post.</div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Topic / What to post about</label>
      <input id="x-topic" class="mkt-form-input" placeholder="e.g. Kajaria premium tiles now available, Monsoon bathroom renovation">
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="mkt-btn mkt-btn-primary" onclick="generateXPost()" style="flex:1">🤖 Generate X Post</button>
      <a href="https://x.com/compose/tweet" target="_blank" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">Open X ↗</a>
    </div>
    <div id="x-output" style="display:none">
      <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">
        <div id="x-content" style="font-size:13px;line-height:1.7;white-space:pre-wrap"></div>
        <div id="x-chars" style="font-size:11px;color:var(--text3);margin-top:6px;text-align:right"></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" onclick="copyXPost()" style="flex:1">📋 Copy Post</button>
        <a href="https://x.com/compose/tweet" target="_blank" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">Open X ↗</a>
      </div>
    </div>
  </div>

  <!-- Publishing guide -->
  <div class="mkt-card">
    <div class="mkt-card-title">📖 One-Push Publishing — How it will work</div>
    <div style="display:grid;gap:8px">
      ${['1️⃣ Generate poster or upload your own in Poster Studio',
         '2️⃣ AI writes caption + hashtags for each platform automatically',
         '3️⃣ Preview how it looks on Instagram (square), YouTube (9:16), GBP (landscape)',
         '4️⃣ Select which platforms to post to',
         '5️⃣ One click — publishes to all selected platforms simultaneously',
         '6️⃣ Posts tracked in Content Calendar with status per platform'
        ].map(s=>'<div style="font-size:12px;padding:8px 10px;background:var(--bg3);border-radius:8px">'+s+'</div>').join('')}
    </div>
    <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:10px;font-size:12px;color:#c9a84c;margin-top:12px">
      ⚡ One-push publishing activates once Meta Business OAuth is connected. Currently use Poster Studio → copy caption → post manually per platform.
    </div>
  </div>`);
}

async function generateXPost() {
  const topic = (document.getElementById('x-topic')?.value||'').trim();
  if (!topic) { showMktToast('Enter a topic first'); return; }
  showMktToast('🤖 Writing X post…');

  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({
      task:'social_post',
      platform:'X',
      language:'en',
      topic,
      context:{business:'V Wholesale', location:'Vijayawada', max_chars:280}
    })
  });
  const data = await res.json();
  const content = data.content || data.text || '';
  if (!content) { showMktToast('❌ Generation failed'); return; }

  const out = document.getElementById('x-output');
  const cont = document.getElementById('x-content');
  const chars = document.getElementById('x-chars');
  if (out) out.style.display = 'block';
  if (cont) cont.textContent = content;
  if (chars) {
    const len = content.length;
    chars.textContent = len + '/280 characters';
    chars.style.color = len > 280 ? '#ef4444' : len > 240 ? '#f59e0b' : 'var(--text3)';
  }
}

function copyXPost() {
  const content = document.getElementById('x-content')?.textContent||'';
  navigator.clipboard.writeText(content).then(()=>showMktToast('📋 Copied — now paste in X'));
}

async function renderWhatsApp() {
  // Check if Interakt is configured
  const { data: waInt } = await sb.from('social_connections').select('*').eq('platform','whatsapp').single().then(r=>r,()=>({data:null}));
  const isLive = waInt?.status === 'connected' && waInt?.access_token_set;

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">💬 WhatsApp Automation</h3>
      <div style="font-size:12px;color:var(--text3)">Broadcasts · Greetings · Order updates via Interakt</div>
    </div>
    <span class="badge ${isLive?'badge-green':'badge-blue'}">${isLive?'✅ Live':'⏳ Pending WABA'}</span>
  </div>

  <!-- WABA STATUS -->
  ${!isLive ? `<div class="mkt-card" style="margin-bottom:14px;border-left:3px solid #f59e0b">
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div style="font-size:28px">⏳</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-bottom:4px">WhatsApp Business API — Under Meta Review</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:10px">Number 8712697930 is registered with Interakt and under Meta WABA approval. Typically takes 24-48 hours.</div>
        <div style="display:grid;gap:6px">
          ${[
            {done:true, step:'Create Interakt account'},
            {done:true, step:'Register number 8712697930'},
            {done:true, step:'Submit for Meta WABA approval'},
            {done:true, step:'Add INTERAKT_API_KEY to Supabase secrets'},
            {done:false, step:'Meta approves WABA (pending — check Interakt dashboard)'},
            {done:false, step:'Activate message templates in Interakt'},
            {done:false, step:'Enable WhatsApp broadcasts below'}
          ].map(s=>`<div style="display:flex;align-items:center;gap:8px;font-size:12px">
            <div style="width:16px;height:16px;border-radius:50%;background:${s.done?'#22c55e':'var(--bg3)'};display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;flex-shrink:0">${s.done?'✓':''}</div>
            <span style="color:${s.done?'var(--text3)':'var(--text1)'};${s.done?'text-decoration:line-through':''}">${s.step}</span>
          </div>`).join('')}
        </div>
        <a href="https://app.interakt.ai" target="_blank" class="mkt-btn mkt-btn-primary" style="margin-top:10px;font-size:12px;text-decoration:none;display:inline-block">Check Interakt Status ↗</a>
      </div>
    </div>
  </div>` : ''}

  <!-- BROADCAST BUILDER -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">📢 Broadcast Message Builder</div>
    ${!isLive ? '<div style="font-size:12px;color:var(--text3);background:rgba(0,0,0,.2);border-radius:8px;padding:10px;margin-bottom:12px;text-align:center">⚠️ Broadcast sending activates after WABA approval. Build and preview templates now.</div>' : ''}

    <div style="display:grid;gap:10px">
      <div class="mkt-form-group">
        <label class="mkt-form-label">Message Template</label>
        <select id="wa-template" class="mkt-form-select" onchange="previewWATemplate(this.value)">
          <option value="festival_offer">🎉 Festival / Seasonal Offer</option>
          <option value="product_launch">📦 New Product / Brand Arrival</option>
          <option value="contractor_club">🏗️ Contractor Club Invite</option>
          <option value="quotation_ready">📋 Quotation Ready (Order Update)</option>
          <option value="birthday_greeting">🎂 Birthday Greeting</option>
          <option value="re_engagement">😴 Re-engage Dormant Customer</option>
          <option value="custom">✏️ Custom Message</option>
        </select>
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Target Audience</label>
        <select id="wa-audience" class="mkt-form-select">
          <option value="all">All Customers (1,300+)</option>
          <option value="contractors">Contractors only</option>
          <option value="high_value">High Value (₹1L+ purchase history)</option>
          <option value="dormant">Dormant (not visited 90+ days)</option>
          <option value="recent">Recent customers (last 30 days)</option>
          <option value="birthday_this_month">Birthdays this month</option>
        </select>
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Key Message / Offer Details</label>
        <input id="wa-offer" class="mkt-form-input" placeholder="e.g. 20% off Italian marble tiles, valid this weekend only">
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Language</label>
        <select id="wa-lang" class="mkt-form-select">
          <option value="te+en">Telugu + English</option>
          <option value="en">English only</option>
          <option value="te">Telugu only</option>
        </select>
      </div>

      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" onclick="generateWABroadcast()" style="flex:1">🤖 Generate Message</button>
      </div>

      <div id="wa-broadcast-output" style="display:none">
        <div style="background:var(--bg3);border-radius:8px;padding:14px;margin-bottom:10px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:8px">PREVIEW — WhatsApp Message</div>
          <div id="wa-broadcast-content" style="font-size:13px;line-height:1.8;white-space:pre-wrap;color:var(--text1)"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="mkt-btn mkt-btn-ghost" onclick="copyWABroadcast()" style="flex:1">📋 Copy Message</button>
          ${isLive ? `<button class="mkt-btn mkt-btn-primary" onclick="sendWABroadcast()" style="flex:1">🚀 Send Broadcast</button>` : `<button class="mkt-btn mkt-btn-ghost" style="flex:1;opacity:.5" disabled>🚀 Send (activates after WABA)</button>`}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:8px;text-align:center">💡 Test on your own number first before broadcasting to all customers</div>
      </div>
    </div>
  </div>

  <!-- MESSAGE TEMPLATES -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">📋 Approved Message Templates</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">These need to be created and approved in Interakt before sending. Approval takes 1-2 days.</div>
    <div style="display:grid;gap:8px">
      ${[
        {name:'quotation_ready',status:'pending',desc:'Notify customer when their quotation is ready — with quote number and amount'},
        {name:'festival_offer',status:'pending',desc:'Festival special offer broadcast — with festival name, offer details, validity'},
        {name:'birthday_greeting',status:'pending',desc:'Birthday wish with exclusive discount code — personalised with customer name'},
        {name:'contractor_welcome',status:'pending',desc:'Welcome new Contractor Club member — with tier, benefits and referral code'},
        {name:'order_update',status:'pending',desc:'Order/delivery status update — with order details and next steps'},
        {name:'re_engagement',status:'pending',desc:'Re-engage customers who haven\'t visited in 90+ days — with special return offer'}
      ].map(t=>`<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:8px;padding:10px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;font-family:monospace;color:var(--gold)">${t.name}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${t.desc}</div>
        </div>
        <span class="badge ${t.status==='approved'?'badge-green':'badge-gray'}">${t.status==='approved'?'Approved':'Pending'}</span>
      </div>`).join('')}
    </div>
    <a href="https://app.interakt.ai" target="_blank" class="mkt-btn mkt-btn-ghost" style="width:100%;margin-top:10px;text-decoration:none;display:block;text-align:center">Create Templates in Interakt ↗</a>
  </div>

  <!-- MANUAL GENERATOR -->
  <div class="mkt-card">
    <div class="mkt-card-title">📨 Manual Message Generator</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Works right now — generate and copy, send manually from WhatsApp Business app.</div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Message Type</label>
      <select id="wa-type" class="mkt-form-select">
        <option value="offer">Festival / Seasonal Offer</option>
        <option value="product">New Product Arrival</option>
        <option value="contractor">Contractor Club Invite</option>
        <option value="followup">Customer Follow-up</option>
        <option value="quotation">Quotation Follow-up</option>
      </select>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Key Details</label>
      <input id="wa-details" class="mkt-form-input" placeholder="e.g. 20% off Italian marble tiles till Sunday">
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="generateWAMessage()" style="width:100%;margin-bottom:10px">🤖 Generate Message</button>
    <div id="wa-output" style="display:none">
      <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">
        <div id="wa-content" style="font-size:13px;line-height:1.8;white-space:pre-wrap"></div>
      </div>
      <button class="mkt-btn mkt-btn-primary" onclick="copyWAMessage()" style="width:100%">📋 Copy Message</button>
    </div>
  </div>`);
}

async function generateWABroadcast() {
  const template = document.getElementById('wa-template')?.value||'festival_offer';
  const audience = document.getElementById('wa-audience')?.value||'all';
  const offer = (document.getElementById('wa-offer')?.value||'').trim();
  const lang = document.getElementById('wa-lang')?.value||'te+en';

  showMktToast('🤖 Writing broadcast message…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({
      task:'whatsapp_broadcast', platform:'WhatsApp', language:lang,
      topic:template+(offer?' — '+offer:''),
      context:{
        business:'V Wholesale', location:'Vijayawada',
        template, audience, offer,
        phone:'8712697930', website:'vwholesale.in'
      }
    })
  });
  const data = await res.json();
  const content = data.content||data.text||'';
  if (!content) { showMktToast('❌ Failed to generate'); return; }

  document.getElementById('wa-broadcast-output').style.display='block';
  document.getElementById('wa-broadcast-content').textContent = content;
}

function copyWABroadcast() {
  navigator.clipboard.writeText(document.getElementById('wa-broadcast-content')?.textContent||'')
    .then(()=>showMktToast('📋 Copied! Paste in WhatsApp Business or Interakt'));
}

async function sendWABroadcast() {
  showMktToast('🚀 Sending via Interakt… (coming once WABA is approved)');
}

function previewWATemplate(val) {
  const offer = document.getElementById('wa-offer');
  if (!offer) return;
  const hints = {
    festival_offer:'e.g. 20% off Italian marble tiles, valid this Diwali weekend',
    product_launch:'e.g. Kajaria new Eternia collection now in stock at Vijayawada',
    contractor_club:'e.g. Join V Wholesale Contractor Club — 2% referral bonus',
    quotation_ready:'e.g. Quote #VW-26-27-045 ready — ₹1,24,500',
    birthday_greeting:'Auto-personalised — leave blank or add offer code',
    re_engagement:'e.g. Special 10% welcome back offer for returning customers',
    custom:'Write your own message details below'
  };
  offer.placeholder = hints[val]||'Enter key message details';
}

async function generateWAMessage() {
  const type = document.getElementById('wa-type')?.value||'offer';
  const details = (document.getElementById('wa-details')?.value||'').trim();
  showMktToast('🤖 Writing message…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{
    method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({task:'whatsapp_message',platform:'WhatsApp',language:'te+en',
      topic:type+(details?' — '+details:''),
      context:{business:'V Wholesale',location:'Vijayawada'}})
  });
  const data = await res.json();
  const content = data.content||data.text||'';
  if (!content) { showMktToast('❌ Failed'); return; }
  document.getElementById('wa-output').style.display='block';
  document.getElementById('wa-content').textContent=content;
}

function copyWAMessage() {
  navigator.clipboard.writeText(document.getElementById('wa-content')?.textContent||'').then(()=>showMktToast('📋 Copied!'));
}

async function generateAdCopy() {
  const topic = (document.getElementById('ads-topic')?.value||'').trim();
  if (!topic) { showMktToast('Enter a topic'); return; }
  showMktToast('🤖 Generating ad copy…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'ad_copy',language:'en',topic,context:{business:'V Wholesale',location:'Vijayawada, Andhra Pradesh',budget_inr:30000}})});
  const data = await res.json();
  const out = document.getElementById('ads-output');
  if (out) { out.style.display='block'; out.textContent=data.content||data.text||'No output'; }
}

function renderAds() {
  // Async wrapper
  _renderAdsAsync();
}

async function _renderAdsAsync() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading ads…</div>`);

  const [
    { data: settings },
    { data: contentPosts }
  ] = await Promise.all([
    sb.from('marketing_settings').select('key,value').in('key',['META_AD_ACCOUNT_ID','META_ACCESS_TOKEN','META_PAGE_ID','META_IG_ID']).then(r=>r,()=>({data:[]})),
    sb.from('content_posts').select('id,topic,post_type,master_text,master_image_url,status,created_at').order('created_at',{ascending:false}).limit(20).then(r=>r,()=>({data:[]}))
  ]);

  const cfg = {};
  (settings||[]).forEach(s => { cfg[s.key] = s.value; });
  const isReady = !!(cfg.META_AD_ACCOUNT_ID && cfg.META_ACCESS_TOKEN);

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📢 Advertising</h3>
      <div style="font-size:12px;color:var(--text3)">Boost posts · Run campaigns · Track performance · All via Meta Ads API</div>
    </div>
    <span class="badge ${isReady?'badge-green':'badge-yellow'}">${isReady?'✅ Ad Account Ready':'⚙️ Setup needed'}</span>
  </div>

  ${!isReady ? `
  <div class="mkt-card" style="margin-bottom:14px;border-left:3px solid var(--gold)">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">⚙️ Connect Meta Ad Account</div>
    <div style="display:grid;gap:8px;margin-bottom:10px">
      <div>
        <label class="mkt-form-label">Ad Account ID <span style="color:var(--text3);font-weight:400">(Ads Manager URL → act_XXXXXXXXX)</span></label>
        <input id="ad-account-id" class="mkt-form-input" placeholder="act_1234567890" value="${cfg.META_AD_ACCOUNT_ID||''}">
      </div>
      <div>
        <label class="mkt-form-label">System User Access Token <span style="color:var(--text3);font-weight:400">(Business Settings → System Users → Generate Token)</span></label>
        <input id="ads-token" class="mkt-form-input" type="password" placeholder="EAAxxxxxxxxxx">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label class="mkt-form-label">Facebook Page ID</label>
          <input id="ads-page-id" class="mkt-form-input" placeholder="${cfg.META_PAGE_ID||'auto-filled if Meta connected'}" value="${cfg.META_PAGE_ID||''}">
        </div>
        <div>
          <label class="mkt-form-label">Instagram Account ID</label>
          <input id="ads-ig-id" class="mkt-form-input" placeholder="${cfg.META_IG_ID||'auto-filled if Meta connected'}" value="${cfg.META_IG_ID||''}">
        </div>
      </div>
    </div>
    <button onclick="saveAdAccountSettings()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">💾 Save & Verify</button>
    <div style="margin-top:10px;background:var(--bg3);border-radius:8px;padding:10px;font-size:11px;color:var(--text3)">
      <b>How to get System User Token:</b><br>
      business.facebook.com → Settings → Users → System Users → select Admin user → Generate New Token → select your app → tick: ads_management, ads_read, business_management → Generate
    </div>
  </div>` : ''}

  <!-- BOOST A POST -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;margin-bottom:4px">⚡ Boost a post</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Amplify an existing post. Fastest way to increase reach with paid spend.</div>
    <div style="display:grid;gap:8px">
      <div>
        <label class="mkt-form-label">Select post</label>
        <select id="boost-post-select" class="mkt-form-select" onchange="adsBoostPreview()">
          <option value="">— Choose post to boost —</option>
          ${(contentPosts||[]).map(p=>`<option value="${p.id}" data-text="${(p.master_text||p.topic||'').slice(0,80).replace(/"/g,'&quot;')}" data-img="${p.master_image_url||''}">${p.topic||'Untitled'} · ${p.post_type||'image'} · ${new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>
          <label class="mkt-form-label">Daily budget (₹)</label>
          <input id="boost-budget" class="mkt-form-input" type="number" value="200" min="100" step="50" oninput="adsUpdateTotal()">
        </div>
        <div>
          <label class="mkt-form-label">Days</label>
          <input id="boost-days" class="mkt-form-input" type="number" value="5" min="1" max="30" oninput="adsUpdateTotal()">
        </div>
        <div>
          <label class="mkt-form-label">Total spend</label>
          <div id="boost-total-display" style="padding:8px 10px;background:var(--bg3);border-radius:6px;font-size:13px;font-weight:700;color:var(--gold)">₹1,000</div>
        </div>
      </div>
      <div>
        <label class="mkt-form-label">Objective</label>
        <select id="boost-objective" class="mkt-form-select">
          <option value="POST_ENGAGEMENT">Post engagement (likes, comments, shares)</option>
          <option value="REACH">Maximum reach</option>
          <option value="LINK_CLICKS">Website clicks (vwholesale.in)</option>
          <option value="VIDEO_VIEWS">Video views (for reels)</option>
        </select>
      </div>

      <!-- Audience -->
      <div style="background:var(--bg3);border-radius:8px;padding:10px">
        <div style="font-size:11px;font-weight:700;margin-bottom:8px;color:var(--text3)">TARGET AUDIENCE</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Location</label>
            <input id="aud-location" class="mkt-form-input" value="Vijayawada, Andhra Pradesh" style="font-size:11px">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Radius (km)</label>
            <input id="aud-radius" class="mkt-form-input" type="number" value="100" style="font-size:11px">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Age min</label>
            <input id="aud-age-min" class="mkt-form-input" type="number" value="25" style="font-size:11px">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Age max</label>
            <input id="aud-age-max" class="mkt-form-input" type="number" value="55" style="font-size:11px">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Gender</label>
            <select id="aud-gender" class="mkt-form-select" style="font-size:11px">
              <option value="ALL">All</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
            </select>
          </div>
        </div>
        <div>
          <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Interests</label>
          <input id="aud-interests" class="mkt-form-input" value="Home improvement, Interior design, Real estate, Construction" style="font-size:11px">
        </div>
      </div>

      <div id="boost-preview-card" style="display:none;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:10px;font-size:11px"></div>

      <button onclick="boostPost()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-size:14px;font-weight:700" ${!isReady?'disabled':''}>
        ⚡ Boost Post
      </button>
      ${!isReady ? '<div style="font-size:11px;color:var(--text3);text-align:center">Connect Ad Account above first</div>' : ''}
    </div>
  </div>

  <!-- FULL CAMPAIGN -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:700">🎯 Full campaign</div>
        <div style="font-size:11px;color:var(--text3)">Custom creatives, objectives, A/B testing, conversion tracking</div>
      </div>
      <button onclick="adsToggleCampaign()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px" id="camp-toggle">▸ Expand</button>
    </div>
    <div id="full-campaign-form" style="display:none;margin-top:12px">
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Campaign name</label>
          <input id="camp-name" class="mkt-form-input" placeholder="V Wholesale July — Marble Collection">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="mkt-form-label">Objective</label>
            <select id="camp-objective" class="mkt-form-select">
              <option value="AWARENESS">Brand Awareness</option>
              <option value="TRAFFIC">Website Traffic</option>
              <option value="ENGAGEMENT" selected>Engagement</option>
              <option value="LEADS">Lead Generation</option>
              <option value="SALES">Sales</option>
            </select>
          </div>
          <div>
            <label class="mkt-form-label">Platforms</label>
            <select id="camp-platform" class="mkt-form-select">
              <option value="both">Facebook + Instagram</option>
              <option value="ig">Instagram only</option>
              <option value="fb">Facebook only</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div>
            <label class="mkt-form-label">Total budget (₹)</label>
            <input id="camp-budget" class="mkt-form-input" type="number" value="5000" min="500">
          </div>
          <div>
            <label class="mkt-form-label">Duration (days)</label>
            <input id="camp-days" class="mkt-form-input" type="number" value="14" min="3">
          </div>
          <div>
            <label class="mkt-form-label">CTA button</label>
            <select id="camp-cta" class="mkt-form-select">
              <option value="CALL_NOW">Call Now</option>
              <option value="LEARN_MORE">Learn More</option>
              <option value="SHOP_NOW">Shop Now</option>
              <option value="CONTACT_US">Contact Us</option>
              <option value="GET_DIRECTIONS">Get Directions</option>
            </select>
          </div>
        </div>
        <div>
          <label class="mkt-form-label">Ad creative — use existing post</label>
          <select id="camp-post" class="mkt-form-select">
            <option value="">— Select post as creative —</option>
            ${(contentPosts||[]).map(p=>`<option value="${p.id}">${p.topic||'Untitled'} · ${p.post_type||'image'}</option>`).join('')}
          </select>
        </div>
        <button onclick="createCampaign()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-weight:700" ${!isReady?'disabled':''}>🚀 Create Campaign</button>
      </div>
    </div>
  </div>

  <!-- ACTIVE CAMPAIGNS -->
  <div class="mkt-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700">📊 Active campaigns</div>
      ${isReady?'<button onclick="loadAdCampaigns()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Refresh</button>':''}
    </div>
    <div id="ad-campaigns-list">
      <div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">${isReady?'Loading…':'Connect Ad Account above to see campaigns'}</div>
    </div>
  </div>`);

  if (isReady) loadAdCampaigns();
}

function adsUpdateTotal() {
  const b = parseInt(document.getElementById('boost-budget')?.value||'200');
  const d = parseInt(document.getElementById('boost-days')?.value||'5');
  const el = document.getElementById('boost-total-display');
  if (el) el.textContent = '₹'+((b*d)||0).toLocaleString('en-IN');
}

function adsBoostPreview() {
  const sel = document.getElementById('boost-post-select');
  const opt = sel?.options[sel.selectedIndex];
  const preview = document.getElementById('boost-preview-card');
  if (!preview || !opt?.value) { if(preview) preview.style.display='none'; return; }
  preview.style.display = 'block';
  const text = opt.dataset?.text||'';
  const img = opt.dataset?.img||'';
  preview.innerHTML = '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:6px">📄 POST PREVIEW</div>'
    + (img?`<img src="${img}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;float:right;margin-left:8px">`:'' )
    + `<div style="font-size:11px;line-height:1.6">${text}${text.length>=80?'…':''}</div>`;
}

function adsToggleCampaign() {
  const form = document.getElementById('full-campaign-form');
  const btn = document.getElementById('camp-toggle');
  if (!form) return;
  const open = form.style.display !== 'none';
  form.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? '▸ Expand' : '▾ Collapse';
}

async function connectMetaWithToken(shortToken) {
  if (!shortToken) { showMktToast('No token provided'); return; }
  showMktToast('⏳ Connecting Meta account…');
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-setup', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'refresh_token', token:shortToken, app_id:'1349983417313052', app_secret:'35ea04214f2c708bd8236310f545e1c8'})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Connection failed');
    showMktToast('✅ Meta connected! Page: '+data.page_name+(data.ig_id?' · Instagram: '+data.ig_id:''));
    // Update social_connections badge in portal
    setTimeout(() => mktNav('integrations'), 1000);
  } catch(e) {
    showMktToast('❌ '+e.message);
  }
}

async function saveAdAccountSettings() {
  const rawId = (document.getElementById('ad-account-id')?.value||'').trim();
  const token = (document.getElementById('ads-token')?.value||'').trim();
  const pageId = (document.getElementById('ads-page-id')?.value||'').trim();
  const igId = (document.getElementById('ads-ig-id')?.value||'').trim();
  if (!rawId || !token) { showMktToast('Ad Account ID and Token required'); return; }
  const adId = rawId.startsWith('act_') ? rawId : 'act_'+rawId;

  showMktToast('⏳ Verifying…');
  try {
    const test = await fetch(`https://graph.facebook.com/v19.0/${adId}?fields=name,currency,account_status&access_token=${token}`);
    const d = await test.json();
    if (d.error) throw new Error(d.error.message);

    const rows = [{key:'META_AD_ACCOUNT_ID',value:adId},{key:'META_ACCESS_TOKEN',value:token}];
    if (pageId) rows.push({key:'META_PAGE_ID',value:pageId});
    if (igId) rows.push({key:'META_IG_ID',value:igId});
    await sb.from('marketing_settings').upsert(rows,{onConflict:'key'});

    showMktToast('✅ Ad Account connected: '+d.name+' ('+d.currency+')');
    setTimeout(_renderAdsAsync, 600);
  } catch(e) { showMktToast('❌ '+e.message); }
}

async function boostPost() {
  const postId = document.getElementById('boost-post-select')?.value;
  if (!postId) { showMktToast('Select a post to boost'); return; }
  const budget = parseInt(document.getElementById('boost-budget')?.value||'200');
  const days = parseInt(document.getElementById('boost-days')?.value||'5');
  const objective = document.getElementById('boost-objective')?.value||'POST_ENGAGEMENT';
  const ageMin = parseInt(document.getElementById('aud-age-min')?.value||'25');
  const ageMax = parseInt(document.getElementById('aud-age-max')?.value||'55');
  const gender = document.getElementById('aud-gender')?.value||'ALL';
  const interests = (document.getElementById('aud-interests')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);

  const btn = document.querySelector('[onclick="boostPost()"]');
  if (btn) { btn.textContent='⏳ Boosting…'; btn.disabled=true; }
  try {
    const { data: post } = await sb.from('content_posts').select('*').eq('id',postId).single().then(r=>r,()=>({data:null}));
    if (!post) throw new Error('Post not found');

    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'boost_post', post_text:post.master_text||post.topic||'', image_url:post.master_image_url||'',
        objective, daily_budget_inr:budget, duration_days:days,
        targeting:{age_min:ageMin,age_max:ageMax,gender,interests,location:'Vijayawada',radius_km:100}
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Boost failed');
    showMktToast('✅ Boosted! Campaign: '+data.campaign_id);
    await sb.from('marketing_audit_logs').insert({action:'ad_boost',details:{post_id:postId,budget:budget*days,campaign_id:data.campaign_id},created_at:new Date().toISOString()}).then(()=>{}).catch(()=>{});
    setTimeout(loadAdCampaigns, 800);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='⚡ Boost Post'; btn.disabled=false; } }
}

async function createCampaign() {
  const name = (document.getElementById('camp-name')?.value||'').trim();
  if (!name) { showMktToast('Enter campaign name'); return; }
  const objective = document.getElementById('camp-objective')?.value||'ENGAGEMENT';
  const budget = parseInt(document.getElementById('camp-budget')?.value||'5000');
  const days = parseInt(document.getElementById('camp-days')?.value||'14');
  const platform = document.getElementById('camp-platform')?.value||'both';
  const cta = document.getElementById('camp-cta')?.value||'CALL_NOW';
  const postId = document.getElementById('camp-post')?.value;

  const btn = document.querySelector('[onclick="createCampaign()"]');
  if (btn) { btn.textContent='⏳ Creating…'; btn.disabled=true; }
  try {
    let postData = null;
    if (postId) {
      const { data: p } = await sb.from('content_posts').select('*').eq('id',postId).single().then(r=>r,()=>({data:null}));
      postData = p;
    }
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'create_campaign', campaign_name:name, objective, total_budget_inr:budget, duration_days:days, platform, cta,
        post_text:postData?.master_text||'', image_url:postData?.master_image_url||'',
        targeting:{age_min:25,age_max:55,gender:'ALL',interests:['Home improvement','Interior design','Real estate'],location:'Vijayawada',radius_km:100}
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Failed');
    showMktToast('✅ Campaign created! ID: '+data.campaign_id);
    setTimeout(loadAdCampaigns, 800);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🚀 Create Campaign'; btn.disabled=false; } }
}

async function loadAdCampaigns() {
  const el = document.getElementById('ad-campaigns-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:12px;font-size:12px;color:var(--text3)">⏳ Loading from Meta…</div>';
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({action:'get_campaigns'})});
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const campaigns = data.campaigns||[];
    if (!campaigns.length) { el.innerHTML='<div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">No campaigns yet</div>'; return; }
    const SC = {ACTIVE:'#22c55e',PAUSED:'#f59e0b',DELETED:'#ef4444',ARCHIVED:'#94a3b8'};
    el.innerHTML = campaigns.map(c=>`
    <div style="padding:10px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:${c.insights?'8px':'0'}">
        <div style="flex:1"><div style="font-size:12px;font-weight:700">${c.name}</div><div style="font-size:10px;color:var(--text3)">${c.objective||''}</div></div>
        <span style="background:${SC[c.status]||'#94a3b8'}22;color:${SC[c.status]||'#94a3b8'};border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700">${c.status}</span>
        ${c.status==='ACTIVE'?`<button onclick="pauseCampaign('${c.id}')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">⏸</button>`:`<button onclick="resumeCampaign('${c.id}')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">▶</button>`}
      </div>
      ${c.insights?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">
        ${[{l:'Reach',v:c.insights.reach||'—'},{l:'Impressions',v:c.insights.impressions||'—'},{l:'Clicks',v:c.insights.clicks||'—'},{l:'Spend',v:c.insights.spend?'₹'+Math.round(c.insights.spend):'—'}]
        .map(m=>`<div style="text-align:center;background:var(--bg3);border-radius:5px;padding:5px"><div style="font-size:12px;font-weight:700">${m.v}</div><div style="font-size:9px;color:var(--text3)">${m.l}</div></div>`).join('')}
      </div>`:''}
    </div>`).join('');
  } catch(e) { el.innerHTML=`<div style="text-align:center;padding:12px;font-size:12px;color:var(--text3)">${e.message}</div>`; }
}

async function pauseCampaign(id) {
  const r = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({action:'update_campaign',campaign_id:id,status:'PAUSED'})});
  const d = await r.json(); showMktToast(d.ok?'⏸ Paused':'❌ '+d.error); if(d.ok) setTimeout(loadAdCampaigns,500);
}

async function resumeCampaign(id) {
  const r = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({action:'update_campaign',campaign_id:id,status:'ACTIVE'})});
  const d = await r.json(); showMktToast(d.ok?'▶ Resumed':'❌ '+d.error); if(d.ok) setTimeout(loadAdCampaigns,500);
}


function renderLocalSEO() {
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">📍 Local SEO</h3>'
    +'<div style="font-size:12px;color:var(--text3)">Dominate Google Maps · Local Search · Near Me queries</div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">🎯 Target Keywords (Vijayawada)</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'
    +['tiles near me Vijayawada','granite price Vijayawada','bathroom fittings NH65','flooring shop Andhra Pradesh',
      'sanitaryware showroom Vijayawada','paint shop Bhavanipuram','home building materials Vijayawada',
      'Kajaria tiles dealer near me','Italian marble Vijayawada','contractor materials supply Vijayawada'
     ].map(k=>'<span class="badge badge-blue">'+k+'</span>').join('')
    +'</div>'
    +'<button class="mkt-btn mkt-btn-ghost" onclick="generateLocalKeywords()" style="font-size:11px">🤖 Generate More Keywords</button>'
    +'<div id="local-kw-output" style="display:none;margin-top:10px;background:var(--bg3);border-radius:8px;padding:10px;font-size:12px"></div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">📋 Local SEO Checklist</div><div style="display:grid;gap:6px">'
    +[{t:'GBP — Business name, address, phone exactly matching everywhere',done:true},
      {t:'GBP — Add all product categories (Tiles, Granite, Sanitaryware, Paints, Electricals)',done:true},
      {t:'GBP — Post weekly (using GBP Post Generator in this portal)',done:false},
      {t:'GBP — Upload 20+ photos of showroom and products',done:false},
      {t:'GBP — Answer all Q&A questions',done:false},
      {t:'Justdial — Create/claim listing with correct NAP',done:false},
      {t:'IndiaMart — Supplier profile with product catalogue',done:false},
      {t:'Sulekha — Business listing',done:false},
      {t:'vwholesale.in — Add LocalBusiness schema markup',done:false},
      {t:'Get 5+ customer reviews on GBP this month',done:false}
     ].map(item=>'<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">'
      +'<div style="width:18px;height:18px;border-radius:4px;background:'+(item.done?'#22c55e':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">'+(item.done?'✓':'')+'</div>'
      +'<div style="font-size:12px;'+(item.done?'color:var(--text3);text-decoration:line-through':'')+'">'+ item.t+'</div></div>'
     ).join('')
    +'</div></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">📁 Directory Links</div>'
    +'<div style="display:grid;gap:8px">'
    +[{n:'Google Business Profile',url:'https://business.google.com'},
      {n:'Justdial',url:'https://www.justdial.com/vap/jd-biz/'},
      {n:'IndiaMart',url:'https://seller.indiamart.com'},
      {n:'Sulekha',url:'https://www.sulekha.com/business/add-business'},
      {n:'Yellow Pages India',url:'https://www.yellowpages.in/add-business'}
     ].map(d=>'<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:10px">'
      +'<div style="font-size:12px;font-weight:600">'+d.n+'</div>'
      +'<a href="'+d.url+'" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none">Open ↗</a></div>'
     ).join('')+'</div></div>');
}
async function generateLocalKeywords() {
  showMktToast('🤖 Finding local keywords…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'local_keywords',language:'en',topic:'local SEO keywords',context:{business:'V Wholesale',location:'Vijayawada, Andhra Pradesh, NH65, Bhavanipuram',categories:'tiles, granite, sanitaryware, paints, electricals'}})});
  const data = await res.json();
  const out = document.getElementById('local-kw-output');
  if (out) { out.style.display='block'; out.textContent=data.content||data.text||''; }
}

function renderWebsiteSEO() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">🌐 Website SEO + Blog Engine</h3>
    <div style="font-size:12px;color:var(--text3)">vwholesale.in · AI-written SEO articles · Published automatically</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="showNewBlogModal()">✍️ Write Article</button>
  </div>

  <!-- SEO Status -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">
    ${[
      {icon:'✅',label:'HTTPS',val:'Live',color:'var(--green)'},
      {icon:'🗺️',label:'Sitemap',val:'Submitted',color:'var(--green)'},
      {icon:'🤖',label:'robots.txt',val:'Active',color:'var(--green)'},
      {icon:'🔍',label:'Search Console',val:'Verified',color:'var(--green)'},
      {icon:'📝',label:'/blog/',val:'Live',color:'var(--green)'}
    ].map(m=>'<div class="mkt-card" style="padding:10px;text-align:center"><div style="font-size:18px">'+m.icon+'</div>'
      +'<div style="font-size:13px;font-weight:700;color:'+m.color+'">'+m.val+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+m.label+'</div></div>').join('')}
  </div>

  <!-- Blog articles list -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="mkt-card-title" style="margin:0">📝 Blog Articles</div>
      <div style="display:flex;gap:6px">
        <a href="https://vwholesale.in/blog/" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none">View Blog ↗</a>
        <button class="mkt-btn mkt-btn-primary" onclick="showNewBlogModal()" style="font-size:11px">✍️ New Article</button>
      </div>
    </div>
    <div id="blog-list"><div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading…</div></div>
  </div>

  <!-- SEO Checklist -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">📋 SEO Checklist</div>
    <div style="display:grid;gap:6px">
      ${[
        {t:'HTTPS secured — vwholesale.in',done:true},
        {t:'sitemap.xml submitted to Google Search Console',done:true},
        {t:'robots.txt configured',done:true},
        {t:'GBP website updated to vwholesale.in',done:true},
        {t:'Blog section /blog/ live and crawlable',done:true},
        {t:'Write 4+ blog articles (target: 1 per week)',done:false},
        {t:'Add LocalBusiness schema markup to homepage',done:false},
        {t:'Meta descriptions on all main pages',done:false},
        {t:'Page speed < 3s on mobile (check PageSpeed Insights)',done:false},
        {t:'10+ blog articles published for keyword coverage',done:false},
        {t:'Backlinks from local directories (Justdial, IndiaMart)',done:false}
      ].map(item=>'<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">'
        +'<div style="width:18px;height:18px;border-radius:4px;background:'+(item.done?'#22c55e':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">'+(item.done?'✓':'')+'</div>'
        +'<div style="font-size:12px;'+(item.done?'color:var(--text3);text-decoration:line-through':'')+'">'+item.t+'</div></div>').join('')}
    </div>
  </div>

  <!-- Tools -->
  <div class="mkt-card">
    <div class="mkt-card-title">🔗 SEO Tools</div>
    <div style="display:grid;gap:6px">
      ${[
        {n:'Google Search Console',url:'https://search.google.com/search-console/about?resource_id=https%3A%2F%2Fvwholesale.in%2F'},
        {n:'Google PageSpeed Insights',url:'https://pagespeed.web.dev/?url=https://vwholesale.in'},
        {n:'View vwholesale.in Blog',url:'https://vwholesale.in/blog/'},
        {n:'Rich Results Test',url:'https://search.google.com/test/rich-results?url=https://vwholesale.in'},
        {n:'Ahrefs Free Backlink Checker',url:'https://ahrefs.com/backlink-checker?input=vwholesale.in'}
      ].map(d=>'<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:10px">'
        +'<div style="font-size:12px;font-weight:600">'+d.n+'</div>'
        +'<a href="'+d.url+'" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none">Open ↗</a></div>').join('')}
    </div>
  </div>`);

  loadBlogList();
}

async function loadBlogList() {
  const el = document.getElementById('blog-list');
  if (!el) return;
  const { data: posts } = await sb.from('blog_posts').select('*').order('created_at',{ascending:false}).limit(20).then(r=>r,()=>({data:[]}));
  if (!(posts||[]).length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text3)">
      <div style="font-size:32px;margin-bottom:8px">📝</div>
      No articles yet — click ✍️ Write Article to generate your first SEO blog post with AI.
    </div>`;
    return;
  }
  el.innerHTML = '<div style="display:grid;gap:8px">' + posts.map(p=>`
  <div style="background:var(--bg3);border-radius:10px;padding:12px;cursor:pointer" onclick="viewBlogPost(${p.id})" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='var(--bg3)'">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div style="font-size:20px;margin-top:2px">${p.github_committed?'✅':'📝'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;margin-bottom:3px">${p.title}</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px">🔑 ${p.target_keyword||'—'} · ${p.word_count||0} words · SEO ${p.seo_score||'—'}/100</div>
        ${(p.tags||[]).length ? '<div style="display:flex;flex-wrap:wrap;gap:3px">' + (p.tags||[]).slice(0,5).map(t=>'<span class="badge badge-gray" style="font-size:9px">#'+t+'</span>').join('') + '</div>' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
        ${!p.github_committed?`<button class="mkt-btn mkt-btn-primary" onclick="publishBlog(${p.id})" style="font-size:10px;padding:3px 8px">🚀 Publish</button>`:`<a href="https://vwholesale.in/blog/${p.slug}/" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px;text-decoration:none">Live ↗</a>`}
        <button class="mkt-btn mkt-btn-ghost" onclick="deleteBlog(${p.id})" style="font-size:10px;padding:3px 8px;color:var(--red)">🗑</button>
      </div>
    </div>
  </div>`).join('') + '</div>';
}

function showNewBlogModal() {
  const topics = [
    'Best tiles for Indian bathrooms — buying guide',
    'How to choose granite countertops for kitchen in Andhra Pradesh',
    'Vitrified vs ceramic tiles — which is better for Indian homes',
    'Italian marble flooring — cost and maintenance guide Vijayawada',
    'Best paint brands in India for exterior walls — 2026 guide',
    'Bathroom fittings buying guide — what to look for',
    'False ceiling materials and costs — complete guide',
    'How to choose floor tiles for your living room in Vijayawada'
  ];
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:540px;overflow:hidden;margin-top:20px">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">✍️ Write SEO Blog Article</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;background:var(--bg3);border-radius:8px;padding:10px">
        🤖 AI will write a complete 800-1000 word SEO article targeting your keyword. Review it, then click Publish to add it live to vwholesale.in/blog/
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Article Title *</label>
        <input id="blog-title" class="mkt-form-input" placeholder="e.g. Best tiles for Indian bathrooms — buying guide">
        <div style="font-size:11px;color:var(--text3);margin-top:6px">Suggested topics:</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          ${topics.map(t=>`<button onclick="document.getElementById('blog-title').value='${t}';inferKeyword()" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:2px 6px">${t.slice(0,30)}…</button>`).join('')}
        </div>
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Target Keyword (what people Google to find this) *</label>
        <input id="blog-keyword" class="mkt-form-input" placeholder="e.g. bathroom tiles Vijayawada, granite price Andhra Pradesh">
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Your Ideas / Key Points to Include (optional)</label>
        <textarea id="blog-ideas" class="mkt-form-input" rows="4" style="resize:vertical;font-size:12px;line-height:1.6" placeholder="e.g.&#10;- Mention that V Wholesale stocks 500+ tile designs&#10;- Include tips on choosing grout color&#10;- Talk about waterproofing importance&#10;- Mention our 10,000 sqft showroom on NH65&#10;- Include price range ₹30-150 per sqft"></textarea>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">💡 Add your expertise, specific product details, prices, or anything the AI should include</div>
      </div>
      <button class="mkt-btn mkt-btn-primary" onclick="generateBlogArticle()" style="width:100%;padding:14px;font-size:14px;font-weight:900">🤖 Generate Article (~30 seconds)</button>
      <div id="blog-gen-status" style="display:none;text-align:center;padding:16px;color:var(--text3)"></div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
}

function inferKeyword() {
  const title = document.getElementById('blog-title')?.value||'';
  const kw = document.getElementById('blog-keyword');
  if (kw && !kw.value && title) {
    kw.value = title.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim().slice(0,60);
  }
}

async function generateBlogArticle() {
  const title = (document.getElementById('blog-title')?.value||'').trim();
  const keyword = (document.getElementById('blog-keyword')?.value||'').trim();
  const ideas = (document.getElementById('blog-ideas')?.value||'').trim();

  if (!title) { showMktToast('Enter an article title'); return; }
  if (!keyword) { showMktToast('Enter a target keyword'); return; }

  const btn = document.querySelector('[onclick="generateBlogArticle()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Writing article…'; }

  const status = document.getElementById('blog-gen-status');
  if (status) {
    status.style.display = 'block';
    status.innerHTML = '<div class="ai-thinking" style="justify-content:center"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div>'
      + '<div style="margin-top:10px;font-size:13px">AI is writing your article…</div>'
      + '<div style="font-size:11px;color:var(--text3);margin-top:4px">~30 seconds · 900-1100 words · hero image + keywords + hashtags</div>';
  }

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/write-blog-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ title, target_keyword: keyword, ideas: ideas || null })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server error ${res.status}: ${errText.slice(0,100)}`);
    }

    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || 'Generation failed');
    }

    if (!data.blog || !data.blog.id) {
      throw new Error('Article saved but ID missing — check blog_posts table');
    }

    // Close modal
    document.querySelector('[style*="position:fixed"][style*="z-index:9999"]')?.remove();
    showMktToast('✅ Article written! ' + (data.word_count||0) + ' words · SEO score ' + (data.seo_score||0) + '/100');

    await viewBlogPost(data.blog.id);
    await loadBlogList();

  } catch(e) {
    showMktToast('❌ ' + (e.message || 'Generation failed'));
    if (status) status.innerHTML = '<div style="color:var(--red);font-size:12px">❌ ' + (e.message||'Failed') + '</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Generate Article (~30 seconds)'; }
  }
}

async function viewBlogPost(id) {
  const {data:p} = await sb.from('blog_posts').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!p) return;

  // Extract meta, keywords, hashtags from content
  const metaMatch = (p.content_md||'').match(/<!--\s*meta:\s*(.+?)\s*-->/);
  const kwMatch = (p.content_md||'').match(/<!--\s*keywords:\s*(.+?)\s*-->/);
  const htMatch = (p.content_md||'').match(/<!--\s*hashtags:\s*(.+?)\s*-->/);
  const imgMatch = (p.content_md||'').match(/!\[([^\]]+)\]\(([^)]+)\)/);

  const metaDesc = metaMatch?.[1] || p.meta_description || '—';
  const keywords = kwMatch?.[1]?.split(',').map(k=>k.trim()) || (p.tags||[]);
  const hashtags = htMatch?.[1]?.split(' #').map(h=>h.replace(/^#/,'').trim()).filter(Boolean) || [];
  const heroImg = imgMatch?.[2] || '';

  // Clean content for display (remove comments)
  const cleanContent = (p.content_md||'').replace(/<!--.*?-->/gs,'').trim();

  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:720px;overflow:hidden;margin-top:20px">

    <!-- Header -->
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
      <div style="flex:1">
        <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:4px">${p.title}</div>
        <div style="font-size:11px;color:#64748b">🔑 ${p.target_keyword} · ${p.word_count||0} words · SEO score: ${p.seo_score||'—'}/100 · ${p.status}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${!p.github_committed
          ? `<button class="mkt-btn mkt-btn-primary" onclick="publishBlog(${p.id});this.closest('[style*=fixed]').remove()" style="font-size:12px">🚀 Publish to Blog</button>`
          : `<a href="https://vwholesale.in/blog/${p.slug}/" target="_blank" class="mkt-btn mkt-btn-primary" style="font-size:12px;text-decoration:none">View Live ↗</a>`}
        <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
      </div>
    </div>

    <div style="padding:16px;display:grid;gap:12px">

      <!-- Hero Image -->
      ${heroImg ? `<div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">📸 HERO IMAGE (from Pexels)</div>
        <img src="${heroImg}" style="width:100%;border-radius:10px;max-height:220px;object-fit:cover" loading="lazy">
      </div>` : `<div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:12px;color:var(--text3);text-align:center">
        No hero image — add PEXELS_API_KEY to Supabase secrets for auto stock photos
      </div>`}

      <!-- Meta Description -->
      <div style="background:var(--bg3);border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">📄 META DESCRIPTION (${metaDesc.length} chars)</div>
        <div style="font-size:13px;line-height:1.6">${metaDesc}</div>
      </div>

      <!-- Keywords -->
      ${keywords.length ? `<div style="background:var(--bg3);border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">🔑 SEO KEYWORDS (${keywords.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${keywords.map(k=>`<span class="badge badge-blue">${k}</span>`).join('')}
        </div>
        <button onclick="navigator.clipboard.writeText('${keywords.join(', ')}').then(()=>showMktToast('Keywords copied!'))" class="mkt-btn mkt-btn-ghost" style="font-size:10px;margin-top:8px">📋 Copy Keywords</button>
      </div>` : ''}

      <!-- Hashtags -->
      ${hashtags.length ? `<div style="background:var(--bg3);border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">#️⃣ HASHTAGS FOR SOCIAL (${hashtags.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${hashtags.map(h=>`<span class="badge badge-gray">#${h}</span>`).join('')}
        </div>
        <button onclick="navigator.clipboard.writeText('${hashtags.map(h=>'#'+h).join(' ')}').then(()=>showMktToast('Hashtags copied!'))" class="mkt-btn mkt-btn-ghost" style="font-size:10px;margin-top:8px">📋 Copy Hashtags</button>
      </div>` : ''}

      <!-- Article content -->
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">📝 ARTICLE CONTENT</div>
        <div style="background:var(--bg3);border-radius:8px;padding:14px;font-size:12px;line-height:1.8;white-space:pre-wrap;max-height:350px;overflow-y:auto;color:var(--text1)">${cleanContent}</div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="mkt-btn mkt-btn-ghost" onclick="navigator.clipboard.writeText(\`${cleanContent.replace(/`/g,"'")}\`).then(()=>showMktToast('Article copied!'))" style="flex:1">📋 Copy Article</button>
        ${!p.github_committed
          ? `<button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="publishBlog(${p.id});this.closest('[style*=fixed]').remove()">🚀 Publish to vwholesale.in</button>`
          : `<a href="https://vwholesale.in/blog/${p.slug}/" target="_blank" class="mkt-btn mkt-btn-primary" style="flex:1;text-decoration:none;text-align:center">🌐 View Live Article ↗</a>`}
      </div>

    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
}

async function publishBlog(id) {
  showMktToast('🚀 Publishing to vwholesale.in/blog/…');
  const res = await fetch(`${MKT_SB_URL}/functions/v1/write-blog-post`, {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({action:'commit', blog_id:id})
  });
  const data = await res.json();
  if (!data.ok) { showMktToast('❌ '+data.error); return; }
  showMktToast('✅ Published! Live at '+data.url);
  loadBlogList();
}

async function deleteBlog(id) {
  if (!confirm('Delete this article?')) return;
  await sb.from('blog_posts').delete().eq('id',id);
  showMktToast('Deleted');
  loadBlogList();
}

async function generateBlogOutline() {
  const topic = (document.getElementById('blog-topic')?.value||'').trim();
  const kw = (document.getElementById('blog-kw')?.value||'').trim();
  if (!topic) { showMktToast('Enter a blog topic'); return; }
  showMktToast('🤖 Generating blog outline…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'blog_outline',language:'en',topic,context:{business:'V Wholesale',location:'Vijayawada, Andhra Pradesh',target_keyword:kw,categories:'tiles, granite, sanitaryware, paints, electricals'}})});
  const data = await res.json();
  const out = document.getElementById('blog-output');
  if (out) { out.style.display='block'; out.textContent=data.content||data.text||''; }
}



function renderReviews() {
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">⭐ Reviews & Q&A</h3>'
    +'<div style="font-size:12px;color:var(--text3)">AI drafts replies · 4-5★ auto-approve · Manual review for 1-3★</div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">🤖 AI Review Reply Generator</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Paste a review → AI drafts the perfect reply → copy and post on GBP, Facebook, etc.</div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Platform</label>'
    +'<select id="rev-platform" class="mkt-form-select">'
    +'<option>Google Business Profile</option><option>Facebook</option><option>Instagram</option>'
    +'<option>Justdial</option><option>IndiaMart</option></select></div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Star Rating</label>'
    +'<select id="rev-stars" class="mkt-form-select"><option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>'
    +'<option value="4">⭐⭐⭐⭐ 4 Stars</option><option value="3">⭐⭐⭐ 3 Stars</option>'
    +'<option value="2">⭐⭐ 2 Stars</option><option value="1">⭐ 1 Star</option></select></div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Customer Review Text</label>'
    +'<textarea id="rev-text" class="mkt-form-input" rows="3" style="height:80px;resize:vertical" placeholder="Paste the customer review here…"></textarea></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="generateReviewReply()" style="width:100%;margin-bottom:10px">🤖 Generate Reply</button>'
    +'<div id="rev-output" style="display:none">'
    +'<div id="rev-flag" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-bottom:8px;font-size:12px;color:#ef4444"></div>'
    +'<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">'
    +'<div id="rev-reply" style="font-size:13px;line-height:1.8;white-space:pre-wrap"></div></div>'
    +'<div style="display:flex;gap:8px">'
    +'<button class="mkt-btn mkt-btn-primary" onclick="copyReviewReply()" style="flex:1">📋 Copy Reply</button>'
    +'<a href="https://business.google.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">Open GBP ↗</a>'
    +'</div></div></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">❓ FAQ Auto-Reply Generator</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Generate standard answers to common questions — use in WhatsApp auto-reply, website chatbot, Instagram DM.</div>'
    +'<div style="display:grid;gap:6px;margin-bottom:12px">'
    +['What are your store timings?','Where is your store located?','What brands of tiles do you stock?',
      'Do you offer home delivery?','What is the price of Italian marble?','Do you give discounts for bulk orders?',
      'Are you open on Sundays?','Do you have a showroom?'
     ].map(q=>'<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:10px">'
      +'<div style="font-size:12px">'+q+'</div>'
      +'<button class="mkt-btn mkt-btn-ghost" onclick="generateFAQAnswer(this)" data-q="'+q+'" style="font-size:10px;padding:3px 8px">Answer</button></div>'
     ).join('')
    +'</div>'
    +'<div id="faq-output" style="display:none;background:var(--bg3);border-radius:8px;padding:12px">'
    +'<div id="faq-q" style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px"></div>'
    +'<div id="faq-a" style="font-size:12px;line-height:1.7;white-space:pre-wrap"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="copyFAQ()" style="margin-top:8px;width:100%">📋 Copy Answer</button>'
    +'</div></div>');
}
async function generateReviewReply() {
  const stars = parseInt(document.getElementById('rev-stars')?.value||'5');
  const text = (document.getElementById('rev-text')?.value||'').trim();
  const platform = document.getElementById('rev-platform')?.value||'Google Business Profile';
  if (!text) { showMktToast('Paste the review text'); return; }
  showMktToast('🤖 Drafting reply…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'review_reply',language:'en',topic:'review reply',context:{stars,platform,review_text:text,business:'V Wholesale',location:'Vijayawada'}})});
  const data = await res.json();
  const reply = data.content||data.text||'';
  document.getElementById('rev-output').style.display='block';
  document.getElementById('rev-reply').textContent=reply;
  const flag = document.getElementById('rev-flag');
  if (stars <= 3) { flag.style.display='block'; flag.textContent='⚠️ '+stars+'-star review — please review the reply carefully before posting. Consider calling the customer directly first.'; }
  else { flag.style.display='none'; }
}
function copyReviewReply() { navigator.clipboard.writeText(document.getElementById('rev-reply')?.textContent||'').then(()=>showMktToast('📋 Copied!')); }
async function generateFAQAnswer(btn) {
  const q = btn.dataset.q;
  showMktToast('🤖 Generating answer…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'faq_answer',language:'te+en',topic:'FAQ answer',context:{question:q,business:'V Wholesale',location:'NH65, Bhavanipuram, Vijayawada',timings:'10am-8pm Mon-Sat, 11am-6pm Sun',phone:'8712697930',website:'vwholesale.in'}})});
  const data = await res.json();
  document.getElementById('faq-output').style.display='block';
  document.getElementById('faq-q').textContent='Q: '+q;
  document.getElementById('faq-a').textContent=data.content||data.text||'';
}
function copyFAQ() { const t=(document.getElementById('faq-q')?.textContent||'')+'\n'+(document.getElementById('faq-a')?.textContent||''); navigator.clipboard.writeText(t).then(()=>showMktToast('📋 Copied!')); }

async function renderCompetitors() {
  setContent(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">🔍 Competitor Intelligence</h3>
    <div style="font-size:12px;color:var(--text3)">Monitor competitors — keywords, content, hashtags, strategy gaps</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="showAddCompetitor()">+ Add Competitor</button>
  </div>
  <div id="comp-list"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div></div>`);
  await loadCompetitors();
}

async function loadCompetitors() {
  const { data: comps } = await sb.from('competitors').select('*, competitor_reports(id,report_date,ai_summary,seo_score,keywords,ai_suggestions,created_at)').order('created_at',{ascending:false}).then(r=>r,()=>({data:[]}));
  const el = document.getElementById('comp-list');
  if (!el) return;
  if (!(comps||[]).length) {
    el.innerHTML = `<div class="mkt-card" style="text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:12px">🔍</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:8px">No competitors added yet</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px">Add your first competitor — website, Instagram, YouTube — and AI will analyse their strategy daily</div>
      <button class="mkt-btn mkt-btn-primary" onclick="showAddCompetitor()">+ Add First Competitor</button>
    </div>`;
    return;
  }
  el.innerHTML = '<div style="display:grid;gap:14px">' + comps.map(c => {
    const rep = (c.competitor_reports||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
    const kws = (rep?.keywords||[]).slice(0,4);
    const sug = (rep?.ai_suggestions||[]).slice(0,2);
    return `<div class="mkt-card" style="padding:16px">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
        <div style="width:44px;height:44px;background:var(--bg3);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🏢</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:900">${c.name}</div>
          <div style="font-size:11px;color:var(--gold);margin-top:2px">${c.category||'direct'} competitor</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">
            ${[c.website_url,c.instagram_url,c.facebook_url,c.youtube_url].filter(Boolean).map(u=>'<a href="'+u+'" target="_blank" style="color:var(--text3);text-decoration:none;margin-right:8px">🔗 '+u.replace('https://','').split('/')[0]+'</a>').join('')}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="mkt-btn mkt-btn-primary" id="analyse-btn-${c.id}" onclick="analyseCompetitor(${c.id})" style="font-size:11px;padding:4px 10px">🤖 Analyse</button>
          <button class="mkt-btn mkt-btn-ghost" onclick="deleteCompetitor(${c.id})" style="font-size:11px;padding:4px 10px;color:var(--red)">🗑</button>
        </div>
      </div>
      ${rep ? `<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">LAST ANALYSIS · ${new Date(rep.created_at).toLocaleDateString('en-IN')}</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:8px">${rep.ai_summary||'—'}</div>
        ${rep.seo_score?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:11px;color:var(--text3)">SEO:</span>
          <div style="flex:1;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden"><div style="height:100%;width:${rep.seo_score}%;background:${rep.seo_score>70?'#22c55e':rep.seo_score>40?'#f59e0b':'#ef4444'};border-radius:3px"></div></div>
          <span style="font-size:11px;font-weight:700">${rep.seo_score}/100</span>
        </div>`:''}
        ${kws.length?`<div style="margin-bottom:6px"><div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">TOP KEYWORDS</div><div style="display:flex;flex-wrap:wrap;gap:4px">${kws.map(k=>'<span class="badge badge-blue">'+k+'</span>').join('')}</div></div>`:''}
        ${sug.length?`<div><div style="font-size:10px;font-weight:700;color:var(--green);margin-bottom:4px">💡 ACTIONS FOR V WHOLESALE</div>${sug.map(s=>'<div style="font-size:11px;color:var(--text2);padding:3px 0;border-top:1px solid var(--border)">→ '+s+'</div>').join('')}</div>`:''}
      </div>
      <button class="mkt-btn mkt-btn-ghost" onclick="viewFullReport(${c.id},'${c.name.replace(/'/g,"\'")}')" style="font-size:11px;width:100%">📊 View Full Report</button>`
      : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">No analysis yet — click 🤖 Analyse</div>'}
    </div>`;
  }).join('') + '</div>';
}

// Store competitor data for analysis
const _compCache = {};

async function loadCompetitorCache() {
  const {data} = await sb.from('competitors').select('*').then(r=>r,()=>({data:[]}));
  (data||[]).forEach(c => { _compCache[c.id] = c; });
}

function showAddCompetitor() {
  const m = document.createElement('div');
  m.id = 'add-comp-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;overflow:hidden">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">🔍 Add Competitor</div>
      <button onclick="document.getElementById('add-comp-modal').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:10px">
      <div class="mkt-form-group"><label class="mkt-form-label">Competitor Name *</label>
        <input type="text" id="comp-name" class="mkt-form-input" placeholder="e.g. Somany Tiles Vijayawada, Kajaria Showroom"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Website URL</label>
        <input type="url" id="comp-website" class="mkt-form-input" placeholder="https://www.example.com"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Instagram</label>
        <input type="url" id="comp-instagram" class="mkt-form-input" placeholder="https://instagram.com/username"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Facebook</label>
        <input type="url" id="comp-facebook" class="mkt-form-input" placeholder="https://facebook.com/pagename"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">YouTube</label>
        <input type="url" id="comp-youtube" class="mkt-form-input" placeholder="https://youtube.com/@channel"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Category</label>
        <select id="comp-category" class="mkt-form-select">
          <option value="direct">Direct (same city)</option>
          <option value="regional">Regional (Andhra/Telangana)</option>
          <option value="national">National Brand</option>
          <option value="online">Online Competitor</option>
        </select></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Notes (optional)</label>
        <input type="text" id="comp-notes" class="mkt-form-input" placeholder="e.g. Strong on Instagram, weak on GBP"></div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="saveCompetitor(true)">💾 Save & Analyse Now</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="saveCompetitor(false)">Save Only</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

async function saveCompetitor(analyseNow) {
  const name = (document.getElementById('comp-name')?.value||'').trim();
  if (!name) { showMktToast('Enter competitor name'); return; }
  const payload = {
    name,
    website_url: document.getElementById('comp-website')?.value?.trim()||null,
    instagram_url: document.getElementById('comp-instagram')?.value?.trim()||null,
    facebook_url: document.getElementById('comp-facebook')?.value?.trim()||null,
    youtube_url: document.getElementById('comp-youtube')?.value?.trim()||null,
    category: document.getElementById('comp-category')?.value||'direct',
    notes: document.getElementById('comp-notes')?.value?.trim()||null,
    added_by: mktProfile?.name
  };
  const {data:comp,error} = await sb.from('competitors').insert(payload).select().single().then(r=>r,e=>({data:null,error:e}));
  if (!comp) { showMktToast('❌ Failed: '+(error?.message||'unknown')); return; }
  _compCache[comp.id] = comp;
  document.getElementById('add-comp-modal')?.remove();
  showMktToast('✅ Competitor saved!');
  await loadCompetitors();
  if (analyseNow) setTimeout(()=>analyseCompetitor(comp.id), 400);
}

async function analyseCompetitor(id) {
  const c = _compCache[id] || (await sb.from('competitors').select('*').eq('id',id).single().then(r=>r.data,()=>null));
  if (!c) { showMktToast('Competitor not found'); return; }
  _compCache[id] = c;

  const btn = document.getElementById('analyse-btn-'+id);
  if (btn) { btn.textContent = '⏳ Analysing…'; btn.disabled = true; }
  showMktToast('🤖 Analysing '+c.name+'… ~15 seconds');

  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/analyse-competitor', {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body:JSON.stringify({competitor_id:id,name:c.name,website_url:c.website_url,instagram_url:c.instagram_url,facebook_url:c.facebook_url,youtube_url:c.youtube_url})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Analysis failed');
    showMktToast('✅ Analysis complete for '+c.name);
  } catch(e) {
    showMktToast('❌ '+e.message);
  }
  await loadCompetitors();
}

async function deleteCompetitor(id) {
  if (!confirm('Delete this competitor and all their reports?')) return;
  await sb.from('competitors').delete().eq('id',id);
  showMktToast('Deleted');
  await loadCompetitors();
}

async function viewFullReport(compId, compName) {
  const {data:reports} = await sb.from('competitor_reports').select('*').eq('competitor_id',compId).order('created_at',{ascending:false}).limit(5).then(r=>r,()=>({data:[]}));
  const r = (reports||[])[0];
  if (!r) { showMktToast('No report yet — click Analyse first'); return; }

  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:620px;overflow:hidden;margin-top:20px">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:15px;font-weight:900;color:#fff">📊 ${compName}</div>
      <div style="font-size:11px;color:#64748B">${new Date(r.created_at).toLocaleDateString('en-IN')} · ${reports.length} report(s) total</div></div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">

      <div style="background:var(--bg3);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">AI SUMMARY</div>
        <div style="font-size:13px;line-height:1.7">${r.ai_summary||'—'}</div>
        ${r.seo_score?`<div style="display:flex;align-items:center;gap:8px;margin-top:10px">
          <span style="font-size:11px;color:var(--text3)">SEO Score:</span>
          <div style="flex:1;height:8px;background:var(--bg2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${r.seo_score}%;background:${r.seo_score>70?'#22c55e':r.seo_score>40?'#f59e0b':'#ef4444'};border-radius:4px"></div></div>
          <span style="font-size:13px;font-weight:900">${r.seo_score}/100</span>
        </div>`:''}
        ${r.estimated_traffic?`<div style="font-size:12px;color:var(--text3);margin-top:6px">📈 Traffic: <strong style="color:var(--text1)">${r.estimated_traffic}</strong></div>`:''}
      </div>

      ${(r.keywords||[]).length?`<div style="background:var(--bg3);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:8px">🔑 THEIR KEYWORDS</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${r.keywords.map(k=>'<span class="badge badge-blue">'+k+'</span>').join('')}</div>
      </div>`:''}

      ${(r.raw_data?.keywords_to_target||[]).length?`<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#22c55e;margin-bottom:8px">🎯 V WHOLESALE SHOULD TARGET</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${r.raw_data.keywords_to_target.map(k=>'<span class="badge badge-green">'+k+'</span>').join('')}</div>
      </div>`:''}

      ${(r.hashtags||[]).length?`<div style="background:var(--bg3);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:8px">#️⃣ HASHTAGS</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${r.hashtags.map(h=>'<span class="badge badge-gray">#'+h.replace('#','')+'</span>').join('')}</div>
      </div>`:''}

      ${(r.top_content||[]).length?`<div style="background:var(--bg3);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:8px">📱 CONTENT THAT WORKS FOR THEM</div>
        ${r.top_content.map(c=>`<div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:6px">
          <div style="font-size:11px;font-weight:700;color:var(--gold)">${c.type||'Post'}</div>
          <div style="font-size:12px;margin:4px 0">${c.topic||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${c.why_it_works||''}</div>
        </div>`).join('')}
      </div>`:''}

      ${(r.raw_data?.content_gaps||[]).length?`<div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:8px">💡 CONTENT V WHOLESALE SHOULD CREATE</div>
        ${r.raw_data.content_gaps.map(g=>'<div style="font-size:12px;padding:5px 0;border-top:1px solid rgba(201,168,76,0.15)">→ '+g+'</div>').join('')}
      </div>`:''}

      ${(r.ai_suggestions||[]).length?`<div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#8b5cf6;margin-bottom:8px">🚀 ACTION PLAN FOR V WHOLESALE</div>
        ${r.ai_suggestions.map((s,i)=>`<div style="display:flex;gap:8px;font-size:12px;padding:5px 0;border-top:1px solid rgba(139,92,246,0.15)"><span style="color:#8b5cf6;font-weight:700">${i+1}.</span><span>${s}</span></div>`).join('')}
      </div>`:''}

      <button class="mkt-btn mkt-btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

async function renderSegments() {
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">👥 Customer Segments</h3>'
    +'<div style="font-size:12px;color:var(--text3)">Smart segments from your 1,300+ customer base</div></div>'
    +'<div id="seg-stats"><div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading…</div></div>');
  await loadSegments();
}
async function loadSegments() {
  const el = document.getElementById('seg-stats');
  if (!el) return;
  const [{data:customers},{data:contractors}] = await Promise.all([
    sb.from('profiles').select('role,created_at',{count:'exact'}).in('role',['customer']).then(r=>r,()=>({data:[],count:0})),
    sb.from('profiles').select('role',{count:'exact'}).eq('role','contractor').then(r=>r,()=>({data:[],count:0}))
  ]);
  const total = (customers||[]).length + (contractors||[]).length;

  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">'
    +[{l:'Total Customers',v:total||'1,300+',i:'👥'},{l:'Contractors',v:(contractors||[]).length||'—',i:'🏗️'},
      {l:'With Birthday Data',v:'—',i:'🎂'},{l:'Active (last 90 days)',v:'—',i:'📅'}
     ].map(m=>'<div class="mkt-card" style="padding:12px;text-align:center"><div style="font-size:20px">'+m.i+'</div>'
      +'<div style="font-size:18px;font-weight:900;margin:4px 0">'+m.v+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+m.l+'</div></div>').join('')
    +'</div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">📋 Segment Definitions</div><div style="display:grid;gap:8px">'
    +[{icon:'💎',name:'High Value',desc:'Spent ₹10L+ lifetime · Priority for new arrivals + exclusive previews',color:'#c9a84c'},
      {icon:'🏗️',name:'Active Contractors',desc:'Contractor Club members · Targeted for bulk offers + referral rewards',color:'#8b5cf6'},
      {icon:'🏠',name:'Homeowners',desc:'Single large project · Target for tile/granite/bathroom complete packages',color:'#22c55e'},
      {icon:'😴',name:'Dormant (90+ days)',desc:'Haven\'t visited in 3+ months · Re-engage with special return offer',color:'#f59e0b'},
      {icon:'🆕',name:'New Customers',desc:'First purchase in last 30 days · Nurture with follow-up and next-buy offer',color:'#64748b'},
      {icon:'🎂',name:'Birthday This Month',desc:'Auto-generate personalised greeting + exclusive birthday offer',color:'#ef4444'}
     ].map(seg=>'<div style="display:flex;align-items:center;gap:12px;background:var(--bg3);border-radius:8px;padding:12px">'
      +'<div style="font-size:22px">'+seg.icon+'</div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:700;color:'+seg.color+'">'+seg.name+'</div>'
      +'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+seg.desc+'</div></div>'
      +'<button class="mkt-btn mkt-btn-ghost" data-seg="'+seg.name+'" onclick="pickSegment(this.dataset.seg)" style="font-size:10px;padding:3px 8px">Message</button></div>'
     ).join('')
    +'</div></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">🤖 Segment Message Generator</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-bottom:10px">Click "Message" on any segment above, or type a custom segment below.</div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Segment</label><input id="seg-name" class="mkt-form-input" placeholder="e.g. Dormant customers, High Value contractors"></div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Offer / Hook</label><input id="seg-offer" class="mkt-form-input" placeholder="e.g. 15% off this weekend only, Free delivery above ₹50K"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="generateSegMsg()" style="width:100%;margin-bottom:10px">🤖 Generate Campaign Message</button>'
    +'<div id="seg-output" style="display:none;background:var(--bg3);border-radius:8px;padding:12px">'
    +'<div id="seg-msg" style="font-size:13px;line-height:1.8;white-space:pre-wrap"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="copySegMsg()" style="margin-top:8px;width:100%">📋 Copy</button></div></div>';
}

function pickSegment(name) {
  const el = document.getElementById('seg-name');
  if (el) { el.value = name; el.scrollIntoView({behavior:'smooth'}); }
}

async function generateSegMsg() {
  const seg = (document.getElementById('seg-name')?.value||'').trim();
  const offer = (document.getElementById('seg-offer')?.value||'').trim();
  if (!seg) { showMktToast('Enter a segment name'); return; }
  showMktToast('🤖 Generating message…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'segment_message',language:'te+en',topic:seg,context:{business:'V Wholesale',location:'Vijayawada',segment:seg,offer}})});
  const data = await res.json();
  document.getElementById('seg-output').style.display='block';
  document.getElementById('seg-msg').textContent=data.content||data.text||'';
}
function copySegMsg() { navigator.clipboard.writeText(document.getElementById('seg-msg')?.textContent||'').then(()=>showMktToast('📋 Copied!')); }


// ── AUTO LOGIN ON LOAD ──
window.addEventListener('load', async () => {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const uid = session.user?.id;
    if (!uid) return;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).single().then(r=>r, ()=>({data:null}));
    const OK = ['admin','owner','manager','marketing','store_manager','floor_manager','sales_head'];
    if (profile && OK.includes(profile.role)) {
      mktProfile = profile;
      showMktApp();
    }
  } catch(e) {
    console.log('Auto-login check:', e.message);
  }
});
// ── GREETINGS ENGINE ──
async function renderGreetings() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">🎂 Greetings Engine</h3>
    <div style="font-size:12px;color:var(--text3)">Birthday & Anniversary — Customers · Contractors · Staff</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="renderGreetings()">🔄 Refresh</button>
  </div>

  <div id="greetings-content"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Checking today's greetings…</div></div>`);
  await loadGreetings();
}

async function loadGreetings() {
  const el = document.getElementById('greetings-content');
  if (!el) return;

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/check-greetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    const today = data.today || [];
    const upcoming = data.upcoming || [];

    el.innerHTML = `
    <!-- Today's greetings -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div class="mkt-card-title">🎉 Today — ${data.date}</div>
      ${today.length === 0
        ? '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">🎉 No birthdays or anniversaries today</div>'
        : '<div style="display:grid;gap:10px">' + today.map(g => `
        <div style="background:var(--bg3);border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px">
          <div style="font-size:32px">${g.greeting_type === 'birthday' ? '🎂' : '💑'}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:900">${g.person_name || '—'}</div>
            <div style="font-size:12px;color:var(--text3)">${g.greeting_type === 'birthday' ? 'Birthday' : 'Anniversary'} · ${g.person_type} ${g.phone ? '· ' + g.phone : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            <button class="mkt-btn mkt-btn-primary" onclick="generateGreetingPoster('${(g.person_name||'').replace(/'/g,"\\'")}','${g.greeting_type}','${g.person_type}')" style="font-size:11px;padding:4px 10px">🎨 Generate Poster</button>
            <button class="mkt-btn mkt-btn-ghost" onclick="generateGreetingMessage('${(g.person_name||'').replace(/'/g,"\\'")}','${g.greeting_type}','${g.phone||''}')" style="font-size:11px;padding:4px 10px">💬 WhatsApp</button>
          </div>
        </div>`).join('') + '</div>'
      }
    </div>

    <!-- Upcoming 7 days -->
    ${upcoming.length ? `<div class="mkt-card" style="margin-bottom:14px">
      <div class="mkt-card-title">📅 Upcoming 7 Days</div>
      <div style="display:grid;gap:6px">
        ${upcoming.map(u => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">
          <div style="font-size:18px">${u.type === 'birthday' ? '🎂' : '💑'}</div>
          <div style="flex:1"><div style="font-size:12px;font-weight:700">${u.name}</div>
          <div style="font-size:11px;color:var(--text3)">${u.type} · ${u.date}</div></div>
          <span class="badge badge-blue">in ${u.days} day${u.days > 1 ? 's' : ''}</span>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Add DOB/Anniversary to customer -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div class="mkt-card-title">➕ Add Birthday / Anniversary to Customer or Contractor</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Search by phone number and update their profile with DOB or Anniversary date.</div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Phone Number</label>
        <div style="display:flex;gap:8px">
          <input id="greet-phone" class="mkt-form-input" placeholder="e.g. 9876543210" style="flex:1">
          <button class="mkt-btn mkt-btn-primary" onclick="searchPersonForGreeting()">Search</button>
        </div>
      </div>
      <div id="greet-person-result" style="display:none"></div>
    </div>

    <!-- Recent greeting log -->
    <div class="mkt-card">
      <div class="mkt-card-title">📋 Recent Greetings Sent</div>
      <div id="greet-log"><div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">Loading…</div></div>
    </div>

    <!-- Poster + message output -->
    <div id="greet-output" style="display:none"></div>`;

    loadGreetingLog();

  } catch(e) {
    el.innerHTML = `<div class="mkt-card" style="text-align:center;padding:30px;color:var(--red)">❌ ${e.message}</div>`;
  }
}

async function loadGreetingLog() {
  const el = document.getElementById('greet-log');
  if (!el) return;
  const { data } = await sb.from('greeting_log').select('*').order('created_at', {ascending:false}).limit(10).then(r=>r,()=>({data:[]}));
  if (!(data||[]).length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">No greetings sent yet</div>'; return; }
  el.innerHTML = '<div style="display:grid;gap:6px">' + (data||[]).map(g => `
  <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">
    <div style="font-size:18px">${g.greeting_type === 'birthday' ? '🎂' : '💑'}</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700">${g.person_name || '—'}</div>
      <div style="font-size:11px;color:var(--text3)">${g.greeting_type} · ${g.person_type} · ${new Date(g.created_at).toLocaleDateString('en-IN')}</div>
    </div>
    <span class="badge ${g.whatsapp_sent ? 'badge-green' : 'badge-gray'}">${g.whatsapp_sent ? '✅ Sent' : 'Pending'}</span>
  </div>`).join('') + '</div>';
}

async function searchPersonForGreeting() {
  const phone = (document.getElementById('greet-phone')?.value||'').trim();
  if (!phone) { showMktToast('Enter phone number'); return; }

  const el = document.getElementById('greet-person-result');
  el.style.display = 'block';
  el.innerHTML = '<div style="font-size:12px;color:var(--text3)">⏳ Searching…</div>';

  // Search in profiles and contractor_profiles
  const [{ data: profData }, { data: contData }] = await Promise.all([
    sb.from('profiles').select('id, name, phone, role, dob, anniversary').eq('phone', phone).limit(1).then(r=>r,()=>({data:[]})),
    sb.from('contractor_profiles').select('id, name, phone, dob, anniversary').eq('phone', phone).limit(1).then(r=>r,()=>({data:[]}))
  ]);

  const person = (profData||[])[0] || (contData||[])[0];
  const table = (profData||[])[0] ? 'profiles' : 'contractor_profiles';

  if (!person) {
    el.innerHTML = '<div style="font-size:12px;color:var(--red);padding:8px 0">No customer or contractor found with this phone number</div>';
    return;
  }

  el.innerHTML = `
  <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:12px;margin-bottom:10px">
    <div style="font-size:13px;font-weight:700">${person.name}</div>
    <div style="font-size:11px;color:var(--text3)">${person.phone} · ${person.role||'contractor'}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="mkt-form-group">
      <label class="mkt-form-label">Date of Birth</label>
      <input type="date" id="greet-dob" class="mkt-form-input" value="${person.dob||''}">
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Wedding Anniversary</label>
      <input type="date" id="greet-ann" class="mkt-form-input" value="${person.anniversary||''}">
    </div>
  </div>
  <button class="mkt-btn mkt-btn-primary" onclick="savePersonDates('${person.id}','${table}')" style="width:100%">💾 Save Dates</button>`;
}

async function savePersonDates(id, table) {
  const dob = document.getElementById('greet-dob')?.value || null;
  const ann = document.getElementById('greet-ann')?.value || null;
  const { error } = await sb.from(table).update({ dob, anniversary: ann, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showMktToast('❌ ' + error.message); return; }
  showMktToast('✅ Dates saved! Will appear in tomorrow\'s greeting check.');
  document.getElementById('greet-person-result').style.display = 'none';
  document.getElementById('greet-phone').value = '';
}

async function generateGreetingPoster(name, type, personType) {
  showMktToast(`🎨 Generating ${type} poster for ${name}…`);

  const topic = type === 'birthday'
    ? `Happy Birthday ${name} — warm birthday wishes from V Wholesale team`
    : `Happy Anniversary ${name} — celebrating with you from V Wholesale`;

  // Reuse poster studio generate flow
  const res = await fetch(`${MKT_SB_URL}/functions/v1/generate-poster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
    body: JSON.stringify({
      topic, template: type === 'birthday' ? 'festival' : 'store',
      language: 'te+en',
      business_name: 'V Wholesale',
      phone: '8712697930', website: 'vwholesale.in',
      address: 'NH65, Bhavanipuram, Vijayawada',
      tagline: type === 'birthday' ? 'Wishing you joy and prosperity!' : 'Celebrating your special day!'
    })
  });
  const data = await res.json();
  if (!data.ok) { showMktToast('❌ ' + (data.error||'Failed')); return; }

  // Show output
  let outEl = document.getElementById('greet-output');
  if (!outEl) { outEl = document.createElement('div'); outEl.id = 'greet-output'; document.getElementById('greetings-content').appendChild(outEl); }
  outEl.style.display = 'block';
  outEl.innerHTML = `
  <div class="mkt-card" style="margin-top:14px">
    <div class="mkt-card-title">🎨 Generated Poster — ${name}</div>
    <img src="data:image/png;base64,${data.image_b64}" style="width:100%;border-radius:10px;margin-bottom:10px">
    <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px;font-size:13px;line-height:1.7">${data.caption||''}</div>
    <div style="display:flex;gap:8px">
      <button class="mkt-btn mkt-btn-primary" onclick="downloadGreetingPoster('${data.image_b64.slice(0,20)}...')">⬇ Download</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="copyPosterCaption('Copied!'))">📋 Copy Caption</button>)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;margin-top:8px">📋 Copy Caption</button>
    </div>
  </div>`;

  // Save to greeting_log
  await sb.from('greeting_log').insert({
    person_type: personType, person_name: name,
    greeting_type: type, greeting_date: new Date().toISOString().split('T')[0],
    caption: data.caption, created_by: mktProfile?.name
  });
  loadGreetingLog();
}

function downloadGreetingPoster(b64Prefix) {
  // Find the full b64 from the img tag
  const img = document.querySelector('#greet-output img');
  if (!img) return;
  const full = img.src.replace('data:image/png;base64,', '');
  const a = document.createElement('a');
  a.download = 'vwholesale-greeting-' + Date.now() + '.png';
  a.href = 'data:image/png;base64,' + full;
  a.click();
}

async function generateGreetingMessage(name, type, phone) {
  showMktToast('🤖 Writing WhatsApp message…');
  const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
    body: JSON.stringify({
      task: 'whatsapp_message', platform: 'WhatsApp', language: 'te+en',
      topic: type === 'birthday' ? `Birthday greeting for ${name}` : `Anniversary greeting for ${name}`,
      context: { business: 'V Wholesale', location: 'Vijayawada', person_name: name, type }
    })
  });
  const data = await res.json();
  const msg = data.content || data.text || '';
  if (!msg) { showMktToast('❌ Failed to generate'); return; }

  // Show copy + WhatsApp link
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;overflow:hidden">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">💬 WhatsApp Greeting — ${name}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px">
      <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:13px;line-height:1.8;white-space:pre-wrap;margin-bottom:12px">${msg}</div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="copyGreetMsg(this)" data-msg="${msg.replace(/"/g,'&quot;')}">📋 Copy Message</button>
        ${phone ? `<a href="https://wa.me/91${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}" target="_blank" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">Open WhatsApp ↗</a>` : ''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

function copyGreetMsg(btn) { navigator.clipboard.writeText(btn.dataset.msg||"").then(()=>showMktToast("📋 Copied!")); }


// ── STAFF FEED MANAGEMENT (Marketing side) ──
async function pushToStaffFeed(titleOverride) {
  if (!currentPosterB64) { showMktToast('Generate a poster first'); return; }
  const title = titleOverride || (document.getElementById('ps-topic')?.value||'').trim() || 'Today\'s Post';

  let image_url = null;
  try {
    const byteArr = Uint8Array.from(atob(currentPosterB64), c => c.charCodeAt(0));
    const blob = new Blob([byteArr], { type: 'image/png' });
    const filename = `feed/${Date.now()}-feed.png`;
    const { error: upErr } = await sb.storage.from('brand-assets').upload(filename, blob, { contentType: 'image/png', upsert: false });
    if (!upErr) {
      const { data: urlData } = sb.storage.from('brand-assets').getPublicUrl(filename);
      image_url = urlData?.publicUrl || null;
    }
  } catch(e) { console.warn('Upload:', e.message); }

  const { error } = await sb.from('daily_posts_feed').insert({
    post_date: new Date().toISOString().split('T')[0],
    title, caption: currentCaption,
    image_url, post_type: 'post',
    platforms: ['Instagram','Facebook','WhatsApp'],
    status: 'active', created_by: mktProfile?.name
  });

  if (error) { showMktToast('❌ ' + error.message); return; }
  showMktToast('✅ Pushed to Staff Feed!');
}

async function renderStaffFeed() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">📢 Staff Daily Feed</h3>
    <div style="font-size:12px;color:var(--text3)">Posts visible to all staff · CRM/Sales team shares as WhatsApp status</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="showAddFeedPost()">+ Add Post</button>
  </div>
  <div id="feed-list"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div></div>`);
  await loadFeedPosts();
}

async function loadFeedPosts() {
  const el = document.getElementById('feed-list');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const { data: posts } = await sb.from('daily_posts_feed').select('*, post_shares(count)').gte('post_date', new Date(Date.now()-7*86400000).toISOString().split('T')[0]).order('post_date', {ascending:false}).order('created_at', {ascending:false}).then(r=>r,()=>({data:[]}));

  if (!(posts||[]).length) {
    el.innerHTML = `<div class="mkt-card" style="text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:12px">📢</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:8px">No posts in feed yet</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Generate a poster and click "Push to Staff Feed", or add a post manually</div>
      <button class="mkt-btn mkt-btn-primary" onclick="showAddFeedPost()">+ Add Post</button>
    </div>`;
    return;
  }

  // Group by date
  const byDate = {};
  (posts||[]).forEach(p => {
    const d = p.post_date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(p);
  });

  el.innerHTML = Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).map(date => {
    const label = date === today ? '📅 Today' : date === new Date(Date.now()-86400000).toISOString().split('T')[0] ? '📅 Yesterday' : '📅 ' + new Date(date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
    return `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase">${label}</div>
      <div style="display:grid;gap:10px">
        ${byDate[date].map(p => `
        <div class="mkt-card" style="padding:14px">
          <div style="display:flex;gap:12px">
            ${p.image_url ? `<img src="${p.image_url}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0">` : `<div style="width:72px;height:72px;background:var(--bg3);border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px">📝</div>`}
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;margin-bottom:3px">${p.title}</div>
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px">${(p.platforms||[]).join(' · ')||'—'} · ${p.post_type}</div>
              ${p.caption ? `<div style="font-size:11px;color:var(--text2);line-height:1.5;overflow:hidden;max-height:40px">${p.caption.slice(0,100)}${p.caption.length>100?'…':''}</div>` : ''}
              <div style="font-size:10px;color:var(--text3);margin-top:4px">Shared ${p.post_shares?.[0]?.count||0} times · by ${p.created_by||'—'}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
            <button class="mkt-btn mkt-btn-ghost" onclick="editFeedPost(${p.id})" style="font-size:11px;padding:3px 8px">✏️ Edit</button>
            <button class="mkt-btn mkt-btn-ghost" onclick="deleteFeedPost(${p.id})" style="font-size:11px;padding:3px 8px;color:var(--red)">🗑 Remove</button>
            <span class="badge ${p.status==='active'?'badge-green':'badge-gray'}">${p.status}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function showAddFeedPost() {
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;overflow:hidden">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">📢 Add to Staff Feed</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:10px">
      <div class="mkt-form-group"><label class="mkt-form-label">Post Date</label>
        <input type="date" id="fp-date" class="mkt-form-input" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Title *</label>
        <input id="fp-title" class="mkt-form-input" placeholder="e.g. Diwali Offer — 20% off tiles"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Type</label>
        <select id="fp-type" class="mkt-form-select">
          <option value="post">📝 Regular Post</option>
          <option value="offer">💰 Offer / Discount</option>
          <option value="wish">🎉 Festival Wish</option>
          <option value="product">📦 Product Showcase</option>
          <option value="announcement">📣 Announcement</option>
        </select></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Caption</label>
        <textarea id="fp-caption" class="mkt-form-input" rows="4" style="resize:vertical;font-size:12px;line-height:1.6" placeholder="Post caption with hashtags…"></textarea></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Image URL (optional)</label>
        <input id="fp-image" class="mkt-form-input" placeholder="Paste image URL from brand-assets storage"></div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="saveFeedPost()">📢 Push to Feed</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e=>{if(e.target===m)m.remove();});
}

async function saveFeedPost() {
  const title = (document.getElementById('fp-title')?.value||'').trim();
  if (!title) { showMktToast('Enter a title'); return; }
  const { error } = await sb.from('daily_posts_feed').insert({
    post_date: document.getElementById('fp-date')?.value || new Date().toISOString().split('T')[0],
    title, caption: document.getElementById('fp-caption')?.value||null,
    image_url: document.getElementById('fp-image')?.value||null,
    post_type: document.getElementById('fp-type')?.value||'post',
    platforms: ['Instagram','Facebook','WhatsApp'],
    status: 'active', created_by: mktProfile?.name
  });
  if (error) { showMktToast('❌ '+error.message); return; }
  document.querySelector('[style*=fixed]')?.remove();
  showMktToast('✅ Pushed to staff feed!');
  await loadFeedPosts();
}

async function deleteFeedPost(id) {
  if (!confirm('Remove this post from staff feed?')) return;
  await sb.from('daily_posts_feed').delete().eq('id', id);
  showMktToast('Removed');
  await loadFeedPosts();
}

async function editFeedPost(id) {
  const {data:p} = await sb.from('daily_posts_feed').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!p) return;
  // Quick status toggle
  const newStatus = p.status === 'active' ? 'expired' : 'active';
  await sb.from('daily_posts_feed').update({status:newStatus}).eq('id',id);
  showMktToast(`Post ${newStatus}`);
  await loadFeedPosts();
}
