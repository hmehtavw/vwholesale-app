
// ── GRAB OAUTH PARAMS IMMEDIATELY (before any redirects or auth) ──
(function() {
  const p = new URLSearchParams(window.location.search);
  const code = p.get('code');
  const state = p.get('state');
  if (code && state === 'gbp_oauth') {
    window._gbpOAuthCode = code;
    window._gbpOAuthState = state;
    // Clean URL immediately so Supabase auth doesn't get confused
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

// ── GRAB OAUTH PARAMS IMMEDIATELY ──
(function() {
  const p = new URLSearchParams(window.location.search);
  const code = p.get('code'), state = p.get('state');
  if (code && state === 'gbp_oauth') {
    // Redirect to dedicated callback page — do NOT handle here
    // marketing portal + Supabase auth interfere with token exchange
    window.location.replace('/gbp-callback/?code=' + encodeURIComponent(code) + '&state=gbp_oauth');
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
  loadAIPauseStatus();

  // Check for OAuth callbacks — IIFE at top already grabbed code into window._gbpOAuthCode
  if (window._gbpOAuthCode && window._gbpOAuthState === 'gbp_oauth') {
    mktNav('gbp');
    return;
  }

  // Returned from GBP callback page after successful connection
  const _urlCheck = new URLSearchParams(window.location.search);
  if (_urlCheck.get('gbp') === 'connected') {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => showMktToast('✅ Google Business Profile connected!'), 500);
    mktNav('gbp');
    return;
  }

  mktNav('command');
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
async function renderCommandCentre() {
  setContent(`<div style="text-align:center;padding:40px"><div style="font-size:24px">⏳</div><div style="color:var(--text3);margin-top:8px">Loading dashboard…</div></div>`);

  // Load data
  const [settingsRes, intRes, agentsRes, approvalsRes, socialRes] = await Promise.all([
    sb.from('marketing_settings').select('key,value').then(r=>r, ()=>({data:[]})),
    sb.from('marketing_integrations').select('*').then(r=>r, ()=>({data:[]})),
    sb.from('ai_agents').select('*').then(r=>r, ()=>({data:[]})),
    sb.from('marketing_approvals').select('*').eq('status','pending').then(r=>r, ()=>({data:[]})),
    sb.from('social_connections').select('platform,status,access_token_set').then(r=>r, ()=>({data:[]})),
  ]);

  const settings = {};
  (settingsRes.data||[]).forEach(s => { settings[s.key] = s.value; });
  const integrations = intRes.data || [];
  const agents = agentsRes.data || [];
  const approvals = approvalsRes.data || [];
  const socialConns = {};
  (socialRes.data||[]).forEach(s => { socialConns[s.platform] = s; });

  const gbpConnected = socialConns['gbp']?.status === 'connected' && socialConns['gbp']?.access_token_set;
  const waConnected  = socialConns['whatsapp']?.status === 'connected';
  const metaConnected = socialConns['meta']?.status === 'connected';

  // Build live integration list
  const liveIntegrations = [
    {name:'OpenAI (AI generation)', status:'connected', notes:'GPT-4o-mini + gpt-image-1'},
    {name:'Pexels (stock photos)',  status:'connected', notes:'API key configured'},
    {name:'GitHub (blog publish)',  status:'connected', notes:'Auto-publish to vwholesale.in/blog/'},
    {name:'Google Business Profile',status: gbpConnected?'connected':'not_connected', notes: gbpConnected?'Connected ✅ — ready to post':'Click to connect'},
    {name:'WhatsApp (Interakt)',    status: waConnected?'connected':'pending', notes: waConnected?'Live':'WABA approval pending for 8712697930'},
    {name:'Meta (Instagram/FB)',    status: metaConnected?'connected':'not_connected', notes: metaConnected?'Connected':'Not set up yet'},
  ];
  const connectedInt = liveIntegrations.filter(i => i.status === 'connected').length;
  const budget = parseInt(settings.marketing_budget_monthly_inr || 30000);

  setContent(`
  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <h2 style="font-size:20px;font-weight:900">Good ${new Date().getHours()<12?'Morning':'Afternoon'}, ${mktProfile?.name?.split(' ')[0]} 👋</h2>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · V Wholesale Marketing Intelligence</div>
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="runAICMO()">🧠 Get AI Briefing</button>
  </div>

  <!-- AI PAUSE WARNING -->
  ${aiPaused ? `<div style="background:rgba(239,68,68,.1);border:1px solid var(--red);border-radius:10px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
    <span style="font-size:20px">🛑</span>
    <div><div style="font-weight:700;color:var(--red)">All AI Actions Paused</div><div style="font-size:11px;color:var(--text3)">AI agents are running in recommend-only mode</div></div>
    <button onclick="toggleAIPause()" style="margin-left:auto;padding:6px 12px;background:var(--red);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700">Resume AI</button>
  </div>` : ''}

  <!-- PENDING APPROVALS ALERT -->
  ${approvals.length > 0 ? `<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="mktNav('approvals')">
    <span style="font-size:20px">✅</span>
    <div><div style="font-weight:700;color:var(--gold)">${approvals.length} Action${approvals.length>1?'s':''} Awaiting Your Approval</div><div style="font-size:11px;color:var(--text3)">Click to review and approve</div></div>
    <span style="margin-left:auto;font-size:18px;color:var(--gold)">→</span>
  </div>` : ''}

  <!-- KEY METRICS -->
  <div class="mkt-grid-4" style="margin-bottom:16px">
    <div class="stat-card">
      <div class="stat-label">Monthly Budget</div>
      <div class="stat-value">₹${(budget/1000).toFixed(0)}K</div>
      <div class="stat-sub">₹0 spent · ₹${(budget/1000).toFixed(0)}K remaining</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">AI Agents Active</div>
      <div class="stat-value" style="color:var(--purple)">${agents.filter(a=>a.status==='active').length}</div>
      <div class="stat-sub">${agents.length} total configured</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Integrations</div>
      <div class="stat-value" style="color:var(--green)">${connectedInt}</div>
      <div class="stat-sub">${integrations.length - connectedInt} not connected</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pending Approvals</div>
      <div class="stat-value" style="color:${approvals.length>0?'var(--gold)':'var(--green)'}">${approvals.length}</div>
      <div class="stat-sub">${approvals.length===0?'All clear':'Action required'}</div>
    </div>
  </div>

  <div class="mkt-grid-2">

    <!-- INTEGRATIONS STATUS -->
    <div class="mkt-card">
      <div class="mkt-card-title">Platform Integrations</div>
      <div style="display:grid;gap:8px">
        ${liveIntegrations.map(i => `
        <div class="integration-card">
          <div class="integration-dot ${i.status==='connected'?'dot-green':i.status==='partial'||i.status==='setup'?'dot-gold':'dot-gray'}"></div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700">${i.name}</div>
            <div style="font-size:10px;color:var(--text3)">${i.notes||i.status}</div>
          </div>
          <span class="badge ${i.status==='connected'?'badge-green':i.status==='partial'||i.status==='setup'?'badge-gold':'badge-gray'}">${i.status}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- AI AGENTS STATUS -->
    <div class="mkt-card">
      <div class="mkt-card-title">AI Agents</div>
      <div style="display:grid;gap:8px">
        ${agents.map(a => {
          const icons = {'AI CMO':'🧠','Content Agent':'✍️','SEO Agent':'🔍','Analytics Agent':'📈','GBP Agent':'📍','WhatsApp Agent':'💬'};
          const colors = {'orchestrator':'#8B5CF6','specialist':'#3B82F6'};
          return `<div class="agent-card">
            <div class="agent-icon" style="background:${colors[a.type]||'#374151'}20;color:${colors[a.type]||'#6B7280'}">${icons[a.name]||'🤖'}</div>
            <div style="flex:1">
              <div class="agent-name">${a.name}</div>
              <div class="agent-desc">Level ${a.autonomy_level} · ${a.model}</div>
            </div>
            <span class="badge ${a.status==='active'?'badge-green':'badge-gray'}">${a.status}</span>
          </div>`;
        }).join('')}
      </div>
      <button class="mkt-btn mkt-btn-ghost" onclick="mktNav('agents')" style="width:100%;margin-top:12px;font-size:11px">Configure Agents →</button>
    </div>

  </div>

  <!-- QUICK ACTIONS -->
  <div class="mkt-card" style="margin-top:4px">
    <div class="mkt-card-title">Quick Actions</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="mkt-btn mkt-btn-primary" onclick="runAICMO()">🧠 AI Weekly Briefing</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="mktNav('content')">✍️ Create Content</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="mktNav('gbp')">📍 GBP Post</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="mktNav('brand')">🏷️ Update Brand Knowledge</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="mktNav('integrations')">🔌 Connect Platform</button>
    </div>
  </div>

  <!-- SETUP CHECKLIST -->
  <div class="mkt-card" style="margin-top:4px">
    <div class="mkt-card-title">🚀 Setup Checklist</div>
    <div style="display:grid;gap:6px">
      ${[
        {done:true,  text:'vwholesale.in domain live'},
        {done:true,  text:'Google Search Console verified'},
        {done:true,  text:'Sitemap submitted'},
        {done:true,  text:'robots.txt configured'},
        {done:true,  text:'OpenAI API connected (GPT-4o-mini + image)'},
        {done:true,  text:'Pexels stock photos connected'},
        {done:true,  text:'GitHub blog auto-publish connected'},
        {done:true,  text:'Marketing database created'},
        {done:gbpConnected,  text:'Google Business Profile connected'},
        {done:false, text:'Create first GBP post'},
        {done:false, text:'Connect Meta Business (Instagram + Facebook)'},
        {done:false, text:'Complete Interakt WhatsApp WABA approval'},
        {done:false, text:'Set up Google Analytics 4'},
        {done:false, text:'Write first 5 blog articles'},
        {done:false, text:'Add DOBs for customers (greetings engine)'},
      ].map(item => `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
        <span style="color:${item.done?'var(--green)':'var(--text3)'}">${item.done?'✅':'⬜'}</span>
        <span style="color:${item.done?'var(--text2)':'var(--text3)'}">${item.text}</span>
      </div>`).join('')}
    </div>
  </div>`);
}

// ── AI CMO ──
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
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">Content Studio</h3>
      <div style="font-size:12px;color:var(--text3)">Create AI-assisted content in English, Telugu and Hindi</div>
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="showCreateContent()">+ Create Content</button>
  </div>

  <div id="content-form" style="display:none" class="mkt-card">
    <div class="mkt-card-title">New Content</div>
    <div class="mkt-grid-2">
      <div class="mkt-form-group">
        <label class="mkt-form-label">Content Type</label>
        <select id="ct-type" class="mkt-form-select">
          <option value="instagram_post">Instagram Post</option>
          <option value="instagram_reel">Instagram Reel Script</option>
          <option value="instagram_story">Instagram Story</option>
          <option value="facebook_post">Facebook Post</option>
          <option value="gbp_post">Google Business Post</option>
          <option value="whatsapp_message">WhatsApp Message</option>
        </select>
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Language</label>
        <select id="ct-lang" class="mkt-form-select">
          <option value="te">Telugu (తెలుగు)</option>
          <option value="en">English</option>
          <option value="hi">Hindi (हिन्दी)</option>
          <option value="te+en">Telugu + English</option>
        </select>
      </div>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Topic / Product / Offer</label>
      <input type="text" id="ct-topic" class="mkt-form-input" placeholder="e.g. Jaquar bathroom fittings, Tiles sale, Contractor Club benefits">
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Goal</label>
      <select id="ct-goal" class="mkt-form-select">
        <option value="walk_in">Drive Store Walk-ins</option>
        <option value="enquiry">Generate Enquiry / WhatsApp</option>
        <option value="awareness">Brand Awareness</option>
        <option value="contractor">Contractor Recruitment</option>
        <option value="product">Product Showcase</option>
        <option value="offer">Promote Offer/Deal</option>
      </select>
    </div>
    <div style="display:flex;gap:8px">
      <button class="mkt-btn mkt-btn-primary" onclick="generateContent()">🤖 Generate with AI</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('content-form').style.display='none'">Cancel</button>
    </div>
  </div>

  <div id="content-output"></div>

  <div class="mkt-card" style="margin-top:4px">
    <div class="mkt-card-title">Recent Content Drafts</div>
    <div id="content-list"><div style="color:var(--text3);font-size:12px;text-align:center;padding:20px">Loading…</div></div>
  </div>`);

  // Load recent content
  const { data: content } = await sb.from('marketing_content').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r, ()=>({data:[]}));
  const listEl = document.getElementById('content-list');
  if (content?.length) {
    listEl.innerHTML = `<table class="mkt-table">
      <tr><th>Type</th><th>Platform</th><th>Language</th><th>Status</th><th>Created</th><th>Action</th></tr>
      ${content.map(c=>`<tr>
        <td style="font-weight:700">${c.title||c.type}</td>
        <td>${c.platform||'—'}</td>
        <td>${c.language||'en'}</td>
        <td><span class="badge ${c.status==='approved'?'badge-green':c.status==='draft'?'badge-blue':'badge-gray'}">${c.status}</span></td>
        <td style="color:var(--text3)">${new Date(c.created_at).toLocaleDateString('en-IN')}</td>
        <td><button class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:4px 8px">View</button></td>
      </tr>`).join('')}
    </table>`;
  } else {
    listEl.innerHTML = '<div class="mkt-empty"><div class="mkt-empty-icon">✍️</div><div class="mkt-empty-title">No content yet</div><div style="font-size:12px;color:var(--text3)">Create your first piece of content above</div></div>';
  }
}

function showCreateContent() {
  document.getElementById('content-form').style.display = 'block';
  document.getElementById('content-form').scrollIntoView({behavior:'smooth'});
}

async function generateContent() {
  if (aiPaused) { alert('AI actions are paused.'); return; }
  const type = document.getElementById('ct-type').value;
  const lang = document.getElementById('ct-lang').value;
  const topic = document.getElementById('ct-topic').value;
  const goal = document.getElementById('ct-goal').value;
  if (!topic) { alert('Enter a topic'); return; }

  const outputEl = document.getElementById('content-output');
  outputEl.innerHTML = `<div class="mkt-card"><div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div><span style="font-size:12px;color:var(--text3);margin-left:8px">Generating ${type} in ${lang}…</span></div></div>`;

  const langMap = {te:'Telugu',en:'English',hi:'Hindi','te+en':'Telugu and English (bilingual)'};
  const typeMap = {instagram_post:'Instagram Post',instagram_reel:'Instagram Reel script with scene breakdown',instagram_story:'Instagram Story sequence',facebook_post:'Facebook Post',gbp_post:'Google Business Profile Post',whatsapp_message:'WhatsApp Message'};
  const goalMap = {walk_in:'drive store walk-ins to V Wholesale Vijayawada',enquiry:'generate WhatsApp enquiries',awareness:'build brand awareness',contractor:'recruit contractors to the Contractor Club',product:'showcase the product',offer:'promote a special offer or deal'};

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        action: 'generate_content',
        agent: 'Content Agent',
        model: 'gpt-4o-mini',
        prompt: `You are the Content Agent for V Wholesale, a home building superstore in Vijayawada, Andhra Pradesh.

Create a ${typeMap[type]} in ${langMap[lang]} about: "${topic}"
Goal: ${goalMap[goal]}

STRICT RULES:
- V Wholesale is at NH65, Bhavanipuram, Vijayawada
- Phone: 8712697930
- Website: https://vwholesale.in
- Never invent prices, discounts, or offers not specified
- Never fabricate customer reviews or testimonials
- Keep content authentic and locally relevant
- For Telugu content, use natural conversational Telugu

Respond ONLY in this JSON format:
{
  "title": "content title/description",
  "caption": "main caption text (in requested language)",
  "hashtags": ["hashtag1", "hashtag2"],
  "visual_brief": "describe what the visual/image should show",
  "call_to_action": "specific CTA text",
  "notes": "any important notes about this content"
}`,
        context: { topic, type, language: lang, goal, business: 'V Wholesale, Vijayawada' }
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const c = data.output;

    // Save to DB
    await sb.from('marketing_content').insert({
      type, platform: type.split('_')[0], language: lang,
      title: c.title, body: c.caption, caption: c.caption,
      hashtags: c.hashtags, visual_brief: c.visual_brief,
      call_to_action: c.call_to_action, status: 'draft',
      ai_generated: true, ai_model: data.model
    });

    outputEl.innerHTML = `
    <div class="mkt-card" style="border:1px solid rgba(139,92,246,.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="mkt-card-title" style="margin:0">✅ Content Generated</div>
        <div style="display:flex;gap:6px">
          <span class="badge badge-purple">AI Draft</span>
          <span class="badge badge-blue">${type}</span>
          <span class="badge badge-gold">${lang}</span>
        </div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">CAPTION</div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:13px;line-height:1.7;white-space:pre-wrap">${c.caption}</div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">HASHTAGS</div>
        <div>${(c.hashtags||[]).map(h=>`<span class="badge badge-blue" style="margin-right:4px">#${h.replace('#','')}</span>`).join('')}</div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">VISUAL BRIEF</div>
        <div style="font-size:12px;color:var(--text2)">${c.visual_brief}</div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">CALL TO ACTION</div>
        <div style="font-size:13px;font-weight:700;color:var(--green)">${c.call_to_action}</div>
      </div>
      ${c.notes ? `<div style="font-size:11px;color:var(--text3);font-style:italic">${c.notes}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="mkt-btn mkt-btn-primary" onclick="copyContent('${c.caption?.replace(/'/g,"\\'").replace(/\n/g,'\\n')}')">📋 Copy Caption</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="generateContent()">🔄 Regenerate</button>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:8px">${data.model} · $${(data.cost_usd||0).toFixed(4)} · Saved as draft</div>
    </div>`;

  } catch(e) {
    outputEl.innerHTML = `<div class="mkt-card" style="border-color:var(--red)"><div style="color:var(--red);font-size:12px">Error: ${e.message}<br><span style="color:var(--text3)">Check OpenAI API key in Supabase secrets</span></div></div>`;
  }
}

async function draftContent(type, platform, topic, lang) {
  mktNav('content');
  setTimeout(() => {
    showCreateContent();
    const typeMap = {post:'instagram_post',reel:'instagram_reel',story:'instagram_story'};
    const el = document.getElementById('ct-type');
    if (el) el.value = typeMap[type] || 'instagram_post';
    const topicEl = document.getElementById('ct-topic');
    if (topicEl) topicEl.value = topic;
    const langEl = document.getElementById('ct-lang');
    if (langEl) langEl.value = lang;
  }, 300);
}

function copyContent(text) {
  navigator.clipboard.writeText(text.replace(/\\n/g,'\n')).then(()=>showMktToast('Caption copied!'));
}

// ── BRAND PROFILE SETUP ──
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

async function saveBrandProfile() {
  const payload = {
    business_name: document.getElementById('bp-name')?.value,
    tagline: document.getElementById('bp-tag')?.value,
    phone: document.getElementById('bp-phone')?.value,
    website: document.getElementById('bp-web')?.value,
    address: document.getElementById('bp-addr')?.value,
    primary_color: document.getElementById('bp-primary')?.value,
    secondary_color: document.getElementById('bp-secondary')?.value,
    updated_at: new Date().toISOString()
  };
  const {data:existing} = await sb.from('brand_profile').select('id').limit(1).then(r=>r,()=>({data:[]}));
  if ((existing||[]).length) {
    await sb.from('brand_profile').update(payload).eq('id',(existing||[])[0].id);
  } else {
    await sb.from('brand_profile').insert(payload);
  }
  showMktToast('✅ Brand profile saved');
  await sb.from('marketing_audit_logs').insert({action:'brand_profile_updated',performed_by:mktProfile?.name,performed_by_type:'human'});
}

async function uploadBrandPhotos(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  showMktToast('Uploading photos…');
  const {data:existing} = await sb.from('brand_profile').select('id,brand_photos').limit(1).then(r=>r,()=>({data:[]}));
  const bp = (existing||[])[0];
  const photos = [...(bp?.brand_photos||[])];

  for (const file of files) {
    if (file.size > 5*1024*1024) { showMktToast('Max 5MB per photo'); continue; }
    const ext = file.name.split('.').pop();
    const path = `brand-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const {error} = await sb.storage.from('brand-assets').upload(path, file, {upsert:true});
    if (error) { showMktToast('Upload failed: '+error.message); continue; }
    const {data:{publicUrl}} = sb.storage.from('brand-assets').getPublicUrl(path);
    photos.push(publicUrl);
  }

  if (bp?.id) {
    await sb.from('brand_profile').update({brand_photos:photos}).eq('id',bp.id);
  } else {
    await sb.from('brand_profile').insert({brand_photos:photos});
  }
  showMktToast(`✅ ${files.length} photo(s) uploaded`);
  renderBrandProfile();
}

async function removePhoto(index) {
  const {data:existing} = await sb.from('brand_profile').select('id,brand_photos').limit(1).then(r=>r,()=>({data:[]}));
  const bp = (existing||[])[0];
  if (!bp) return;
  const photos = [...(bp.brand_photos||[])];
  photos.splice(index,1);
  await sb.from('brand_profile').update({brand_photos:photos}).eq('id',bp.id);
  renderBrandProfile();
}

async function connectPlatform(platform) {
  const guides = {
    instagram: 'To connect Instagram:\n1. Go to business.facebook.com\n2. Create a Meta App\n3. Add Instagram Basic Display\n4. Get Page Access Token\n5. Come back and paste it here\n\nContact support for guided setup.',
    facebook: 'To connect Facebook:\n1. Go to business.facebook.com\n2. Create Meta App with Pages API\n3. Generate Page Access Token\n4. Paste it here',
    gbp: 'Google Business Profile API requires:\n1. Google Cloud Console project\n2. Enable Business Profile API\n3. OAuth 2.0 credentials\n4. Authorize vwholesale.in\n\nThis will be set up in the next session.',
    whatsapp: 'WhatsApp via Interakt:\n1. Complete your Interakt setup\n2. Get your API key from Interakt dashboard\n3. Add it to Settings → Integrations'
  };
  alert(guides[platform]||'Connection guide coming soon');
}

// ── BRAND KNOWLEDGE ──
// ── BRAND KNOWLEDGE ──
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

function showAddKnowledge() {
  document.getElementById('brand-add-form').style.display = 'block';
}

async function saveBrandKnowledge() {
  const cat = document.getElementById('bk-cat').value;
  const title = document.getElementById('bk-title').value;
  const content = document.getElementById('bk-content').value;
  if (!title || !content) { alert('Enter title and content'); return; }
  await sb.from('brand_knowledge').insert({ category:cat, title, content, is_approved:true, language:'en' });
  showMktToast('✅ Brand knowledge saved');
  renderBrand();
}

// ── INTEGRATIONS ──
async function renderIntegrations() {
  const { data: integrations } = await sb.from('marketing_integrations').select('*').order('name').then(r=>r, ()=>({data:[]}));
  const { data: settings } = await sb.from('marketing_settings').select('key,value').then(r=>r, ()=>({data:[]}));

  const getInt = (name) => (integrations||[]).find(i=>i.name.toLowerCase().includes(name.toLowerCase()));
  const getSetting = (key) => (settings||[]).find(s=>s.key===key)?.value;

  const metaConn = getInt('meta') || getInt('facebook') || getInt('instagram');
  const waConn = getInt('whatsapp') || getInt('interakt');
  const gbpConn = getInt('google') || getInt('gbp');
  const ytConn = getInt('youtube');

  const platforms = [
    {
      name:'Meta Business (Instagram + Facebook)',
      icon:'📸',
      status: metaConn?.status || 'not_connected',
      description:'Connect once — publish to Instagram, Facebook and Threads. Enables auto-posting from Poster Studio.',
      steps:[
        'Create a Meta Business account at business.facebook.com',
        'Add your Instagram and Facebook Page to the Business account',
        'Go to Meta Developers → Create App → Business type',
        'Add Instagram Basic Display + Pages API permissions',
        'Generate access token and paste below'
      ],
      setupUrl:'https://developers.facebook.com/apps/',
      token_key:'META_ACCESS_TOKEN',
      page_key:'META_PAGE_ID'
    },
    {
      name:'WhatsApp Business API (Interakt)',
      icon:'💬',
      status: waConn?.status || 'pending',
      description:'Send broadcasts, automate greetings, quotation updates via Interakt. Number 8712697930 under Meta review.',
      steps:[
        'Complete Interakt WABA approval (number 8712697930 — under review)',
        'Add INTERAKT_API_KEY to Supabase Edge Function secrets',
        'Create and get approved message templates in Interakt',
        'Test with a single message before enabling broadcasts'
      ],
      setupUrl:'https://app.interakt.ai',
      token_key:'INTERAKT_API_KEY',
      note:'⏳ Number under Meta review — check Interakt dashboard'
    },
    {
      name:'Google Business Profile',
      icon:'📍',
      status: gbpConn?.status || 'not_connected',
      description:'Auto-post updates, offers and events to your GBP. Boosts local SEO and Maps visibility.',
      steps:[
        'Go to Google Cloud Console → Enable My Business API',
        'Create OAuth 2.0 credentials (Web application type)',
        'Add vwholesale.in to authorized redirect URIs',
        'Click Connect below to start the OAuth flow'
      ],
      setupUrl:'https://console.cloud.google.com/apis/library/mybusiness.googleapis.com',
      token_key:'GBP_ACCESS_TOKEN'
    },
    {
      name:'YouTube Data API',
      icon:'▶️',
      status: ytConn?.status || 'not_connected',
      description:'Upload Shorts and videos directly from the portal. Schedule posts to your V Wholesale YouTube channel.',
      steps:[
        'Google Cloud Console → Enable YouTube Data API v3',
        'Create OAuth 2.0 credentials',
        'Authorize your V Wholesale YouTube channel',
        'Click Connect below'
      ],
      setupUrl:'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
      token_key:'YOUTUBE_ACCESS_TOKEN'
    },
    {
      name:'Pexels (Stock Photos)',
      icon:'🖼️',
      status:'connected',
      description:'Free stock photos for poster hero images and blog articles. API key already configured.',
      setupUrl:'https://www.pexels.com/api/',
      note:'✅ API key configured in Supabase secrets'
    },
    {
      name:'OpenAI (AI Generation)',
      icon:'🤖',
      status:'connected',
      description:'Powers all AI features — poster captions, blog articles, ad copy, review replies, WhatsApp messages.',
      setupUrl:'https://platform.openai.com',
      note:'✅ API key configured — GPT-4o-mini for text, gpt-image-1 for posters'
    }
  ];

  const statusConfig = {
    connected:   {badge:'badge-green', label:'Connected ✓'},
    pending:     {badge:'badge-blue',  label:'Pending'},
    not_connected:{badge:'badge-gray', label:'Not Connected'},
    setup:       {badge:'badge-blue',  label:'Setup in progress'}
  };

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">🔌 Platform Integrations</h3>
      <div style="font-size:12px;color:var(--text3)">Connect external platforms to enable auto-publishing and automation</div>
    </div>
  </div>

  <div style="display:grid;gap:12px">
    ${platforms.map(p => {
      const cfg = statusConfig[p.status] || statusConfig.not_connected;
      const isConnected = p.status === 'connected';
      return `<div class="mkt-card" style="padding:16px;border-left:3px solid ${isConnected?'#22c55e':p.status==='pending'?'#f59e0b':'var(--border)'}">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:${p.steps?'12':'0'}px">
          <div style="font-size:28px;flex-shrink:0">${p.icon}</div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
              <div style="font-size:14px;font-weight:900">${p.name}</div>
              <span class="badge ${cfg.badge}">${cfg.label}</span>
            </div>
            <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:8px">${p.description}</div>
            ${p.note ? `<div style="font-size:11px;color:var(--text3);background:var(--bg3);padding:6px 10px;border-radius:6px;margin-bottom:8px">${p.note}</div>` : ''}
            ${p.steps && !isConnected ? `
            <div style="margin-bottom:10px">
              <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">SETUP STEPS</div>
              <div style="display:grid;gap:4px">
                ${p.steps.map((step,i)=>`<div style="display:flex;gap:8px;font-size:11px;color:var(--text2)">
                  <span style="width:16px;height:16px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${i+1}</span>
                  <span>${step}</span>
                </div>`).join('')}
              </div>
            </div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            <a href="${p.setupUrl}" target="_blank" class="mkt-btn ${isConnected?'mkt-btn-ghost':'mkt-btn-primary'}" style="font-size:11px;text-decoration:none;padding:5px 10px">
              ${isConnected ? 'Settings ↗' : 'Setup ↗'}
            </a>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <div class="mkt-card" style="margin-top:14px;background:rgba(201,168,76,0.05);border:1px solid rgba(201,168,76,0.2)">
    <div class="mkt-card-title" style="color:var(--gold)">📋 Integration Roadmap</div>
    <div style="display:grid;gap:6px;font-size:12px">
      ${[
        {status:'✅', item:'OpenAI — AI text + image generation'},
        {status:'✅', item:'Pexels — Stock photos for posters and blog'},
        {status:'✅', item:'GitHub — Blog article auto-publish'},
        {status:'✅', item:'Supabase — Database and edge functions'},
        {status:'⏳', item:'Interakt WhatsApp — WABA approval in progress'},
        {status:'🔲', item:'Meta Business OAuth — Instagram + Facebook publishing'},
        {status:'🔲', item:'Google Business Profile API — GBP auto-posting'},
        {status:'🔲', item:'YouTube Data API — Shorts upload'},
        {status:'🔲', item:'Google Search Console API — live SEO data in Analytics'},
        {status:'🔲', item:'Meta Ads API — auto-pull campaign stats'},
      ].map(r=>`<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--border)">
        <span style="font-size:14px;flex-shrink:0">${r.status}</span>
        <span style="color:var(--text2)">${r.item}</span>
      </div>`).join('')}
    </div>
  </div>`);
}

async function renderAgents() {
  const { data: agents } = await sb.from('ai_agents').select('*').order('name').then(r=>r, ()=>({data:[]}));
  const { data: runs } = await sb.from('ai_agent_runs').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r, ()=>({data:[]}));

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">AI Agents</h3>
    <div style="font-size:12px;color:var(--text3)">All agents run in Recommend mode (Level 1) by default</div>
  </div>

  <div style="display:grid;gap:10px;margin-bottom:16px">
    ${(agents||[]).map(a => `
    <div class="mkt-card" style="padding:14px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:800">${a.name}</div>
          <div style="font-size:11px;color:var(--text3)">${a.description}</div>
        </div>
        <span class="badge badge-purple">Level ${a.autonomy_level}</span>
        <span class="badge ${a.status==='active'?'badge-green':'badge-gray'}">${a.status}</span>
      </div>
      <div style="display:flex;gap:8px;font-size:10px;color:var(--text3)">
        <span>Model: ${a.model}</span>
        <span>·</span>
        <span>Provider: ${a.provider}</span>
        <span>·</span>
        <span>Max cost: $${a.max_cost_per_run}/run</span>
        ${a.last_run_at ? `<span>·</span><span>Last run: ${new Date(a.last_run_at).toLocaleDateString('en-IN')}</span>` : ''}
      </div>
    </div>`).join('')}
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">Recent Agent Runs</div>
    ${(runs||[]).length ? `<table class="mkt-table">
      <tr><th>Agent</th><th>Model</th><th>Status</th><th>Cost</th><th>Time</th></tr>
      ${(runs||[]).map(r=>`<tr>
        <td style="font-weight:700">${r.agent_name}</td>
        <td style="color:var(--text3)">${r.model}</td>
        <td><span class="badge ${r.status==='completed'?'badge-green':'badge-red'}">${r.status}</span></td>
        <td>$${(r.cost_usd||0).toFixed(4)}</td>
        <td style="color:var(--text3)">${new Date(r.created_at).toLocaleDateString('en-IN')}</td>
      </tr>`).join('')}
    </table>` : '<div class="mkt-empty"><div style="color:var(--text3);font-size:12px">No agent runs yet</div></div>'}
  </div>`);
}

// ── AI PAUSE ──
async function loadAIPauseStatus() {
  const { data } = await sb.from('marketing_settings').select('value').eq('key','global_ai_pause').single().then(r=>r, ()=>({data:null}));
  aiPaused = data?.value === 'true';
  const btn = document.getElementById('ai-pause-btn');
  if (btn) {
    btn.textContent = aiPaused ? '▶ Resume AI Actions' : '🛑 Pause All AI Actions';
    btn.className = 'ai-pause-btn' + (aiPaused ? ' paused' : '');
  }
}

async function toggleAIPause() {
  aiPaused = !aiPaused;
  await sb.from('marketing_settings').update({ value: aiPaused ? 'true' : 'false' }).eq('key', 'global_ai_pause');
  await sb.from('marketing_audit_logs').insert({ action: aiPaused ? 'ai_paused' : 'ai_resumed', performed_by: mktProfile?.name, performed_by_type: 'human' });
  loadAIPauseStatus();
  showMktToast(aiPaused ? '🛑 All AI Actions Paused' : '▶ AI Actions Resumed');
}


// ── DRAFT VIEWER ──
async function viewDraft(id) {
  const {data:c} = await sb.from('marketing_content').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!c) { showMktToast('Draft not found'); return; }

  const modal = document.createElement('div');
  modal.id = 'draft-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:999;overflow-y:auto;padding:20px;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:560px;overflow:hidden">
    <div style="background:#0A1628;padding:16px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:15px;font-weight:900;color:#fff">${c.title||c.type}</div>
        <div style="font-size:11px;color:#64748B">${c.platform||'—'} · ${c.language||'en'} · ${new Date(c.created_at).toLocaleDateString('en-IN')}</div>
      </div>
      <button onclick="document.getElementById('draft-modal').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">CAPTION</div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:13px;line-height:1.7;white-space:pre-wrap">${c.caption||c.body||'—'}</div>
      </div>
      ${c.hashtags?.length ? `<div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">HASHTAGS</div>
        <div>${(c.hashtags||[]).map(h=>`<span class="badge badge-blue" style="margin:2px">#${h.replace('#','')}</span>`).join('')}</div>
      </div>` : ''}
      ${c.visual_brief ? `<div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">VISUAL BRIEF</div>
        <div style="font-size:12px;color:var(--text2)">${c.visual_brief}</div>
      </div>` : ''}
      ${c.call_to_action ? `<div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">CALL TO ACTION</div>
        <div style="font-size:13px;font-weight:700;color:var(--green)">${c.call_to_action}</div>
      </div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="mkt-btn mkt-btn-primary" onclick="navigator.clipboard.writeText('${(c.caption||c.body||'').replace(/'/g,"\\'")}').then(()=>showMktToast('Copied!'))">📋 Copy Caption</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="approveDraft(${id})">✅ Approve</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('draft-modal').remove();draftContent('${c.type}','${c.platform||'Instagram'}','${(c.title||'').replace(/'/g,"\\'")}','${c.language||'en'}')">🔄 Regenerate</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="deleteDraft(${id});document.getElementById('draft-modal').remove()" style="color:var(--red)">🗑 Delete</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

async function approveDraft(id) {
  await sb.from('marketing_content').update({status:'approved',approved_by:mktProfile?.name,approved_at:new Date().toISOString()}).eq('id',id);
  showMktToast('✅ Draft approved');
  document.getElementById('draft-modal')?.remove();
  renderContentStudio();
}

async function deleteDraft(id) {
  if (!confirm('Delete this draft?')) return;
  await sb.from('marketing_content').delete().eq('id',id);
  showMktToast('Draft deleted');
  document.getElementById('draft-modal')?.remove();
  renderContentStudio();
}

// ── GBP ──
async function renderGBP() {
  setContent(`<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading GBP status…</div>`);

  // Check connection status
  const { data: conn } = await sb.from('social_connections').select('*').eq('platform','gbp').single().then(r=>r,()=>({data:null}));
  const { data: settings } = await sb.from('marketing_settings').select('key,value').in('key',['GBP_ACCESS_TOKEN','GBP_CLIENT_ID']).then(r=>r,()=>({data:[]}));
  const isConnected = conn?.status === 'connected' && conn?.access_token_set;

  // Check for OAuth callback code in URL (may have been set before nav)
  const urlParams = new URLSearchParams(window.location.search);
  const oauthCode = urlParams.get('code') || window._gbpOAuthCode;
  const oauthState = urlParams.get('state') || window._gbpOAuthState;
  if (oauthCode && oauthState === 'gbp_oauth') {
    window._gbpOAuthCode = null;
    window._gbpOAuthState = null;
    window.history.replaceState({}, '', window.location.pathname);
    await handleGBPCallback(oauthCode);
    return;
  }

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📍 Google Business Profile</h3>
      <div style="font-size:12px;color:var(--text3)">Post updates, offers and events to GBP automatically</div>
    </div>
    <span class="badge ${isConnected?'badge-green':'badge-gray'}">${isConnected?'✅ Connected':'Not Connected'}</span>
  </div>

  ${!isConnected ? `
  <!-- Connect GBP -->
  <div class="mkt-card" style="margin-bottom:14px;text-align:center;padding:32px">
    <div style="font-size:48px;margin-bottom:12px">📍</div>
    <div style="font-size:15px;font-weight:700;margin-bottom:8px">Connect Google Business Profile</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:20px;max-width:400px;margin-left:auto;margin-right:auto;line-height:1.7">
      Click below to connect your V Wholesale GBP account. You'll be redirected to Google to grant access, then brought back here automatically.
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="connectGBP()" style="padding:14px 32px;font-size:14px;font-weight:900">
      🔗 Connect Google Business Profile
    </button>
    <div style="font-size:11px;color:var(--text3);margin-top:12px">Uses your Google account: hmehta@vwholesale.in</div>
  </div>
  ` : `
  <!-- Connected — Post creator -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="width:40px;height:40px;background:#34a853;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">📍</div>
      <div>
        <div style="font-size:13px;font-weight:700">Google Business Profile — Connected ✅</div>
        <div style="font-size:11px;color:var(--text3)" id="gbp-location-name">Loading location…</div>
      </div>
      <button class="mkt-btn mkt-btn-ghost" onclick="disconnectGBP()" style="margin-left:auto;font-size:11px;color:var(--red)">Disconnect</button>
    </div>
  </div>
  `}

  <!-- GBP Post Creator (always visible) -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">✍️ Create GBP Post</div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Post Type</label>
      <select id="gbp-post-type" class="mkt-form-select">
        <option value="standard">📢 Update / Announcement</option>
        <option value="offer">💰 Offer / Promotion</option>
        <option value="event">📅 Event</option>
      </select>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Post Topic</label>
      <input id="gbp-topic" class="mkt-form-input" placeholder="e.g. Diwali special 20% off tiles, New Italian marble collection">
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button class="mkt-btn mkt-btn-ghost" onclick="generateGBPPost()" style="flex:1">🤖 Generate with AI</button>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Post Text</label>
      <textarea id="gbp-text" class="mkt-form-input" rows="5" style="resize:vertical;font-size:13px;line-height:1.7" placeholder="Your GBP post content will appear here after AI generation, or write manually…"></textarea>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Image (optional but recommended)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">
        <button class="mkt-btn mkt-btn-ghost" onclick="generateGBPImage()" style="font-size:11px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:3px">
          <span style="font-size:18px">🤖</span><span>Generate AI Image</span>
        </button>
        <button class="mkt-btn mkt-btn-ghost" onclick="useLatestPoster()" style="font-size:11px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:3px">
          <span style="font-size:18px">🎨</span><span>Use Latest Poster</span>
        </button>
        <label class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;margin:0">
          <span style="font-size:18px">📁</span><span>Upload Image</span>
          <input type="file" id="gbp-image-upload" accept="image/jpeg,image/png,image/webp" onchange="handleGBPImageUpload(this)" style="display:none">
        </label>
      </div>
      <div id="gbp-image-gen-status" style="display:none;text-align:center;padding:10px;color:var(--text3);font-size:12px"></div>
      <div id="gbp-image-preview" style="display:none;border-radius:10px;overflow:hidden;border:1px solid var(--border);position:relative">
        <img id="gbp-image-preview-img" src="" style="width:100%;height:160px;object-fit:cover">
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.6);padding:6px 10px;display:flex;justify-content:space-between;align-items:center">
          <span id="gbp-image-label" style="font-size:10px;color:#fff">Image ready</span>
          <button onclick="clearGBPImage()" style="background:rgba(239,68,68,.9);border:none;color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">✕ Remove</button>
        </div>
      </div>
      <input type="hidden" id="gbp-image-url">
    </div>
    <div style="display:flex;gap:8px">
      ${isConnected
        ? `<button class="mkt-btn mkt-btn-primary" onclick="postToGBP()" style="flex:1;padding:12px;font-weight:700">🚀 Post to Google Business Profile</button>`
        : `<button class="mkt-btn mkt-btn-ghost" style="flex:1;padding:12px;opacity:.5" disabled>🚀 Connect GBP first to post</button>`}
      <button class="mkt-btn mkt-btn-ghost" onclick="copyGBPPost()" style="padding:12px">📋 Copy</button>
    </div>
    <div id="gbp-result" style="display:none;margin-top:10px"></div>
  </div>

  <!-- Recent GBP posts -->
  <div class="mkt-card">
    <div class="mkt-card-title">📋 Post History</div>
    <div id="gbp-history"><div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">Post history will appear here after your first post</div></div>
  </div>`);

  // Load location name if connected
  if (isConnected) {
    loadGBPLocation();
  }

  // Load post history
  loadGBPHistory();
}

function connectGBP() {
  // Build OAuth URL directly in browser — no server call needed for this step
  const clientId = '825770975900-hu3d3edgjaup25ec16vin7jpjs4phlo5.apps.googleusercontent.com';
  const redirectUri = encodeURIComponent('https://vwholesale.in/marketing/');
  const scope = encodeURIComponent('https://www.googleapis.com/auth/business.manage');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=gbp_oauth`;
  showMktToast('🔗 Redirecting to Google…');
  window.location.href = url;
}

async function handleGBPCallback(code) {
  setContent(`<div style="text-align:center;padding:40px">
    <div style="font-size:32px;margin-bottom:12px">⏳</div>
    <div style="font-size:14px;font-weight:700">Connecting Google Business Profile…</div>
    <div style="font-size:12px;color:var(--text3);margin-top:8px">Exchanging authorization code…</div>
  </div>`);

  try {
    // Exchange code via edge function with retry
    let data = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(MKT_SB_URL + '/functions/v1/gbp-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
          body: JSON.stringify({ action: 'exchange_code', code })
        });
        if (res.status === 404) {
          // Cold start — wait and retry
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        data = await res.json();
        break;
      } catch(fetchErr) {
        if (attempt === 3) throw fetchErr;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!data) throw new Error('Edge function unavailable after 3 attempts — please try connecting again');
    if (!data.ok) throw new Error(data.error || 'Token exchange failed');

    showMktToast('✅ Google Business Profile connected!');
    await renderGBP();

  } catch(e) {
    console.error('GBP OAuth error:', e);
    showMktToast('❌ Connection failed: ' + e.message);
    setContent(`<div style="text-align:center;padding:40px">
      <div style="font-size:32px;margin-bottom:12px">❌</div>
      <div style="font-size:14px;font-weight:700;color:var(--red)">Connection Failed</div>
      <div style="font-size:12px;color:var(--text3);margin-top:8px">${e.message}</div>
      <button class="mkt-btn mkt-btn-primary" onclick="renderGBP()" style="margin-top:16px">← Back to GBP</button>
    </div>`);
  }
}

async function loadGBPLocation() {
  const res = await fetch(`${MKT_SB_URL}/functions/v1/gbp-oauth`, {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({action:'get_locations'})
  });
  const data = await res.json();
  const el = document.getElementById('gbp-location-name');
  if (!el) return;
  if (data.ok && data.locations?.length) {
    const loc = data.locations[0];
    el.textContent = loc.title + ' — ' + (loc.storefrontAddress?.addressLines?.[0] || 'Vijayawada');
    // Store location name
    await sb.from('marketing_settings').upsert(
      {key:'GBP_LOCATION_NAME', value:loc.name},
      {onConflict:'key'}
    );
  } else {
    el.textContent = 'V Wholesale — Vijayawada';
  }
}

async function postToGBP() {
  const text = (document.getElementById('gbp-text')?.value||'').trim();
  const type = document.getElementById('gbp-post-type')?.value||'standard';
  const imageUrl = (document.getElementById('gbp-image-url')?.value||'').trim();

  if (!text) { showMktToast('Write or generate post text first'); return; }

  const btn = document.querySelector('[onclick="postToGBP()"]');
  if (btn) { btn.textContent = '⏳ Posting…'; btn.disabled = true; }

  const result = document.getElementById('gbp-result');
  if (result) result.style.display = 'block';

  try {
    // Step 1: Get location name — fetch from edge fn if not cached
    showMktToast('🔍 Getting GBP location…');
    const { data: locSetting } = await sb.from('marketing_settings').select('value').eq('key','GBP_LOCATION_NAME').maybeSingle().then(r=>r,()=>({data:null}));
    let locationName = locSetting?.value || null;

    if (!locationName) {
      // Fetch locations via edge function
      const locRes = await fetch(`${MKT_SB_URL}/functions/v1/gbp-oauth`, {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body:JSON.stringify({action:'get_locations'})
      });
      const locData = await locRes.json();
      if (!locData.ok) throw new Error('Could not fetch GBP location: ' + (locData.error||'unknown'));
      if (!locData.locations?.length) throw new Error('No GBP locations found on this account');
      locationName = locData.locations[0].name;
      // Save for next time
      await sb.from('marketing_settings').upsert({key:'GBP_LOCATION_NAME', value:locationName},{onConflict:'key'});
    }

    // Step 2: Create the post
    showMktToast('🚀 Posting to Google Business Profile…');
    const res = await fetch(`${MKT_SB_URL}/functions/v1/gbp-oauth`, {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body:JSON.stringify({action:'create_post', location_name:locationName, post_text:text, post_type:type, media_url:imageUrl||null})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Post failed');

    showMktToast('✅ Posted to Google Business Profile!');
    if (result) result.innerHTML = '<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:14px;font-size:12px">'
      + '<div style="color:#22c55e;font-weight:700;margin-bottom:8px">✅ Post published to Google Business Profile!</div>'
      + '<div style="color:var(--text2);margin-bottom:10px">Visible on Google Maps and Search in 2-5 minutes.</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<a href="https://business.google.com/posts" target="_blank" class="mkt-btn mkt-btn-primary" style="font-size:11px;text-decoration:none;padding:6px 12px">📍 View on GBP Dashboard ↗</a>'
      + '<a href="https://www.google.com/search?q=V+Wholesale+Vijayawada" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;padding:6px 12px">🔍 Search V Wholesale on Google ↗</a>'
      + '</div></div>';
    document.getElementById('gbp-text').value = '';
    loadGBPHistory();

  } catch(e) {
    showMktToast('❌ ' + e.message);
    if (result) result.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;font-size:12px;color:#ef4444">❌ ' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent = '🚀 Post to Google Business Profile'; btn.disabled = false; }
  }
}

async function loadGBPHistory() {
  const { data: logs } = await sb.from('marketing_audit_logs').select('*').eq('action','gbp_post_created').order('created_at',{ascending:false}).limit(10).then(r=>r,()=>({data:[]}));
  const el = document.getElementById('gbp-history');
  if (!el) return;
  if (!(logs||[]).length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">No posts yet</div>';
    return;
  }
  el.innerHTML = '<div style="display:grid;gap:6px">' + logs.map(l=>`
    <div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:8px;padding:10px">
      <div style="font-size:18px">📍</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600">${l.details?.post_text||'GBP Post'}…</div>
        <div style="font-size:11px;color:var(--text3)">${new Date(l.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <span class="badge badge-green">Published</span>
    </div>`).join('') + '</div>';
}

async function useLatestPoster() {
  showMktToast('🎨 Fetching latest poster…');
  const { data } = await sb.from('poster_history').select('poster_url,topic,created_at').order('created_at',{ascending:false}).limit(1).single().then(r=>r,()=>({data:null}));
  if (!data?.poster_url) { showMktToast('No posters found — generate one in Poster Studio first'); return; }
  const input = document.getElementById('gbp-image-url');
  if (input) input.value = data.poster_url;
  setGBPImage(data.poster_url, '🎨 ' + (data.topic||'Latest Poster'));
  showMktToast('✅ Latest poster loaded — ' + (data.topic||'poster'));
}

async function generateGBPImage() {
  const topic = (document.getElementById('gbp-topic')?.value||'').trim()
    || (document.getElementById('gbp-text')?.value||'').split(' ').slice(0,6).join(' ');
  if (!topic) { showMktToast('Enter a post topic first'); return; }

  const btns = document.querySelectorAll('[onclick="generateGBPImage()"]');
  btns.forEach(b => { b.style.opacity='.5'; b.style.pointerEvents='none'; });
  const status = document.getElementById('gbp-image-gen-status');
  if (status) {
    status.style.display='block';
    status.innerHTML='<div class="ai-thinking" style="justify-content:center"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div>'
      +'<div style="margin-top:6px;font-size:11px">Finding best image for your post…</div>';
  }

  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/gbp-image', {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body:JSON.stringify({topic})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Image generation failed');
    const imgUrl = data.image_url || '';
    if (!imgUrl) throw new Error('No image URL returned');
    const label = data.source === 'pexels' ? '🖼️ Stock Photo' : '🤖 AI Generated';
    setGBPImage(imgUrl, label + ' — ' + topic);
    showMktToast('✅ Image ready (' + (data.source||'AI') + ')');
  } catch(e) {
    showMktToast('❌ ' + e.message);
    if (status) status.innerHTML = '<div style="color:var(--red);font-size:11px">❌ ' + e.message + '<br><span style="color:var(--text3)">Try 📁 Upload Image instead</span></div>';
  } finally {
    btns.forEach(b => { b.style.opacity=''; b.style.pointerEvents=''; });
    if (status && !status.innerHTML.includes('❌')) setTimeout(() => { status.style.display='none'; }, 2000);
  }
}


function setGBPImage(url, label) {
  const hidden = document.getElementById('gbp-image-url');
  if (hidden) hidden.value = url;
  const preview = document.getElementById('gbp-image-preview');
  const img = document.getElementById('gbp-image-preview-img');
  const lbl = document.getElementById('gbp-image-label');
  if (preview && img) { img.src = url; preview.style.display='block'; }
  if (lbl) lbl.textContent = label || 'Image ready';
}

function showGBPImagePreview(url) { setGBPImage(url, 'Image ready'); }

function clearGBPImage() {
  const h = document.getElementById('gbp-image-url'); if(h) h.value='';
  const p = document.getElementById('gbp-image-preview'); if(p) p.style.display='none';
  const i = document.getElementById('gbp-image-preview-img'); if(i) i.src='';
  const u = document.getElementById('gbp-image-upload'); if(u) u.value='';
}

async function handleGBPImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { showMktToast('Image must be under 5MB'); return; }
  showMktToast('📁 Uploading…');
  try {
    const fileName = 'gbp/' + Date.now() + '_' + file.name.replace(/[^a-z0-9.]/gi,'_');
    const { data: up, error } = await sb.storage.from('marketing-assets').upload(fileName, file, {contentType:file.type, upsert:true});
    if (error) throw new Error(error.message);
    const { data: urlData } = sb.storage.from('marketing-assets').getPublicUrl(fileName);
    setGBPImage(urlData.publicUrl, '📁 ' + file.name);
    showMktToast('✅ Uploaded!');
  } catch(e) {
    setGBPImage(URL.createObjectURL(file), '⚠️ Local preview only');
    showMktToast('⚠️ Could not upload to storage — ' + e.message);
  }
}



async function disconnectGBP() {
  if (!confirm('Disconnect Google Business Profile?')) return;
  await sb.from('social_connections').update({status:'not_connected',access_token_set:false,connected_at:null}).eq('platform','gbp');
  await sb.from('marketing_settings').delete().in('key',['GBP_ACCESS_TOKEN','GBP_REFRESH_TOKEN','GBP_TOKEN_EXPIRY','GBP_LOCATION_NAME','GBP_ACCOUNT_NAME']);
  showMktToast('Disconnected');
  await renderGBP();
}

function copyGBPPost() {
  navigator.clipboard.writeText(document.getElementById('gbp-text')?.value||'').then(()=>showMktToast('📋 Copied!'));
}

async function generateGBPPost() {
  const topic = (document.getElementById('gbp-topic')?.value||'').trim();
  const type = document.getElementById('gbp-post-type')?.value||'standard';
  if (!topic) { showMktToast('Enter a topic first'); return; }

  const btn = document.querySelector('[onclick="generateGBPPost()"]');
  if (btn) { btn.textContent = '\u23F3 Writing\u2026'; btn.disabled = true; }
  showMktToast('\uD83E\uDD16 Writing GBP post\u2026');

  try {
    const typeLabel = {standard:'Update/Announcement', offer:'Offer/Promotion', event:'Event'}[type]||'Update';
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body:JSON.stringify({
        action:'generate_text',
        agent:'GBP Post Writer',
        prompt:'Write a Google Business Profile post for V Wholesale, a home building materials store in Vijayawada (NH65, Bhavanipuram). Post type: '+typeLabel+'. Topic: '+topic+'. Rules: max 1500 chars, include call to action with phone 8712697930 or visit vwholesale.in, mention Vijayawada. Return JSON: {"post_text":"..."}',
        context:{topic, type:typeLabel, business:'V Wholesale', location:'Vijayawada'}
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'AI failed');
    const content = data.output?.post_text || data.output?.text || data.output?.content || '';
    if (!content) throw new Error('AI returned empty post');
    const ta = document.getElementById('gbp-text');
    if (ta) ta.value = content;
    showMktToast('\u2705 Post written \u2014 review and post to GBP');
  } catch(e) {
    showMktToast('\u274C ' + e.message);
  } finally {
    if (btn) { btn.textContent = '\uD83E\uDD16 Generate with AI'; btn.disabled = false; }
  }
}

function quickGBPPost(idea) {
  const el = document.getElementById('gbp-topic');
  if (el) { el.value = idea; generateGBPPost(); }
}


// ── APPROVALS ──
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

async function approveAction(id) {
  await sb.from('marketing_approvals').update({status:'approved',approver:mktProfile?.name,approved_at:new Date().toISOString()}).eq('id',id);
  showMktToast('✅ Action approved');
  renderApprovals();
}

async function rejectAction(id) {
  const reason = prompt('Reason for rejection:');
  if (reason === null) return;
  await sb.from('marketing_approvals').update({status:'rejected',rejection_reason:reason}).eq('id',id);
  showMktToast('Action rejected');
  renderApprovals();
}

// ── CONTENT CALENDAR ──
// ── CONTENT CALENDAR — Monthly Planner ──
let _calYear = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-indexed
let _calItems = [];
let _calFestivals = [];

async function renderCalendar() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📅 Content Calendar</h3>
      <div style="font-size:12px;color:var(--text3)">Monthly planner — festivals, posts, reels, offers. Review every 15th.</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="mkt-btn mkt-btn-ghost" onclick="calPrevMonth()">← Prev</button>
      <button class="mkt-btn mkt-btn-primary" id="cal-month-label" onclick="calGoToday()">This Month</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="calNextMonth()">Next →</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="showCalPlanModal()">🤖 AI Plan Month</button>
    </div>
  </div>

  <!-- Month summary strip -->
  <div id="cal-summary" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px"></div>

  <!-- Calendar grid -->
  <div class="mkt-card" style="padding:10px;margin-bottom:14px">
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">
      ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>'<div style="font-size:10px;font-weight:700;text-align:center;color:var(--text3);padding:4px">'+d+'</div>').join("")}
    </div>
    <div id="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px"></div>
  </div>

  <!-- Day detail panel -->
  <div id="cal-day-panel" style="display:none"></div>

  <!-- Upcoming reels shooting plan -->
  <div class="mkt-card" style="margin-bottom:14px" id="cal-reel-panel">
    <div class="mkt-card-title">🎬 Reel Shooting Plan</div>
    <div id="cal-reels" style="font-size:12px;color:var(--text3);text-align:center;padding:16px">Loading…</div>
  </div>

  <!-- 15th Review reminder -->
  <div class="mkt-card" id="cal-review-reminder" style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);display:none">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:32px">📋</div>
      <div>
        <div style="font-size:13px;font-weight:900;color:var(--gold)">Monthly Content Review — 15th</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">Today is the 15th — review next month\'s topics and freeze the plan before AI generates all content.</div>
        <button class="mkt-btn mkt-btn-primary" onclick="showMonthReview()" style="margin-top:8px;font-size:12px">Start Review →</button>
      </div>
    </div>
  </div>`);

  // Show 15th review reminder if today is 14-16
  const todayDate = new Date().getDate();
  if (todayDate >= 14 && todayDate <= 16) {
    document.getElementById("cal-review-reminder").style.display = "block";
  }

  await loadCalendar();
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

  // Pull all marketing data from DB in parallel
  const [
    {data:posters}, {data:blogs}, {data:campaigns}, {data:calItems},
    {data:feedPosts}, {data:competitors}, {data:greetings}, {data:approvals}
  ] = await Promise.all([
    sb.from('poster_history').select('id,created_at,topic,template').order('created_at',{ascending:false}).limit(100).then(r=>r,()=>({data:[]})),
    sb.from('blog_posts').select('id,status,word_count,created_at').then(r=>r,()=>({data:[]})),
    sb.from('campaigns').select('id,name,status,budget_inr,spent_inr,impressions,clicks,conversions,created_at').then(r=>r,()=>({data:[]})),
    sb.from('content_calendar').select('id,status,content_type,is_reel,cal_date').order('cal_date',{ascending:false}).limit(100).then(r=>r,()=>({data:[]})),
    sb.from('daily_posts_feed').select('id,post_date,shared_count').then(r=>r,()=>({data:[]})),
    sb.from('competitors').select('id,name').then(r=>r,()=>({data:[]})),
    sb.from('greeting_log').select('id,greeting_type,created_at').then(r=>r,()=>({data:[]})),
    sb.from('marketing_approvals').select('id,status').then(r=>r,()=>({data:[]}))
  ]);

  // ── CALCULATE METRICS ──
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const last30 = new Date(now - 30*86400000);
  const last7   = new Date(now - 7*86400000);

  const postersThisMonth = (posters||[]).filter(p => {
    const d = new Date(p.created_at);
    return d.getMonth()===thisMonth && d.getFullYear()===thisYear;
  }).length;

  const totalImpressions = (campaigns||[]).reduce((s,c)=>s+(c.impressions||0),0);
  const totalClicks      = (campaigns||[]).reduce((s,c)=>s+(c.clicks||0),0);
  const totalConversions = (campaigns||[]).reduce((s,c)=>s+(c.conversions||0),0);
  const totalSpend       = (campaigns||[]).reduce((s,c)=>s+(c.spent_inr||0),0);
  const totalBudget      = (campaigns||[]).reduce((s,c)=>s+(c.budget_inr||0),0);
  const activeCampaigns  = (campaigns||[]).filter(c=>c.status==='active').length;
  const cpl = totalConversions>0 ? Math.round(totalSpend/totalConversions) : 0;
  const ctr = totalImpressions>0 ? ((totalClicks/totalImpressions)*100).toFixed(2) : '0.00';

  const publishedBlogs = (blogs||[]).filter(b=>b.status==='published').length;
  const draftBlogs     = (blogs||[]).filter(b=>b.status==='draft').length;

  const calPublished = (calItems||[]).filter(i=>i.status==='published').length;
  const calPlanned   = (calItems||[]).filter(i=>i.status==='planned').length;
  const calReels     = (calItems||[]).filter(i=>i.is_reel).length;
  const publishRate  = (calItems||[]).length>0 ? Math.round(calPublished/(calItems||[]).length*100) : 0;

  // Posters by week (last 8 weeks)
  const weeklyPosters = Array(8).fill(0);
  (posters||[]).forEach(p => {
    const daysAgo = Math.floor((now - new Date(p.created_at))/86400000);
    const week = Math.floor(daysAgo/7);
    if (week < 8) weeklyPosters[week]++;
  });
  weeklyPosters.reverse();
  const maxWeekly = Math.max(...weeklyPosters, 1);

  const totalShares = (feedPosts||[]).reduce((s,p)=>s+(p.shared_count||0),0);

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">📊 Marketing Analytics</h3>
    <div style="font-size:12px;color:var(--text3)">All data from your V Wholesale marketing activity</div>
  </div>

  <!-- TOP KPI ROW -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
    ${[
      {icon:'🎨',label:'Posters Created',val:(posters||[]).length,sub:'this month: '+postersThisMonth,color:'var(--gold)'},
      {icon:'📣',label:'Active Campaigns',val:activeCampaigns,sub:'of '+(campaigns||[]).length+' total',color:'#22c55e'},
      {icon:'📝',label:'Blog Articles',val:publishedBlogs,sub:draftBlogs+' drafts pending',color:'#3b82f6'},
      {icon:'🎂',label:'Greetings Sent',val:(greetings||[]).length,sub:'birthday + anniversary',color:'#f59e0b'}
    ].map(m=>'<div class="mkt-card" style="padding:12px;text-align:center">'
      +'<div style="font-size:22px">'+m.icon+'</div>'
      +'<div style="font-size:20px;font-weight:900;color:'+m.color+';margin:4px 0">'+m.val+'</div>'
      +'<div style="font-size:10px;font-weight:700;color:var(--text2)">'+m.label+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+m.sub+'</div>'
    +'</div>').join('')}
  </div>

  <!-- CAMPAIGN PERFORMANCE -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">📣 Campaign Performance (All Time)</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">
      ${[
        {label:'Impressions',val:totalImpressions.toLocaleString('en-IN'),icon:'👁'},
        {label:'Clicks',val:totalClicks.toLocaleString('en-IN'),icon:'🖱'},
        {label:'Conversions',val:totalConversions.toLocaleString('en-IN'),icon:'✅'},
        {label:'CTR',val:ctr+'%',icon:'📈'},
        {label:'Cost/Lead',val:cpl?'₹'+cpl.toLocaleString('en-IN'):'—',icon:'💰'}
      ].map(m=>'<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center">'
        +'<div style="font-size:16px">'+m.icon+'</div>'
        +'<div style="font-size:15px;font-weight:900;margin:3px 0">'+m.val+'</div>'
        +'<div style="font-size:10px;color:var(--text3)">'+m.label+'</div>'
      +'</div>').join('')}
    </div>
    ${totalBudget>0?`<div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px">
        <span>Total Budget: ₹${totalBudget.toLocaleString('en-IN')}</span>
        <span>Spent: ₹${totalSpend.toLocaleString('en-IN')} (${Math.round(totalSpend/totalBudget*100)}%)</span>
      </div>
      <div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100,Math.round(totalSpend/totalBudget*100))}%;background:${totalSpend/totalBudget>0.8?'#ef4444':'#22c55e'};border-radius:4px"></div>
      </div>
    </div>`:'<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Create campaigns and update stats to see performance data</div>'}
    ${(campaigns||[]).length?'<div style="display:grid;gap:6px">'+
      (campaigns||[]).slice(0,5).map(c=>'<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:8px;padding:10px">'
        +'<div style="flex:1"><div style="font-size:12px;font-weight:700">'+c.name+'</div>'
        +'<div style="font-size:11px;color:var(--text3)">'+c.status+' · ₹'+(c.spent_inr||0).toLocaleString('en-IN')+' spent · '+(c.conversions||0)+' conversions</div></div>'
        +'<span class="badge '+(c.status==='active'?'badge-green':c.status==='completed'?'badge-blue':'badge-gray')+'">'+c.status+'</span>'
      +'</div>').join('')+'</div>':''}
  </div>

  <!-- CONTENT ACTIVITY -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">

    <!-- Poster bar chart -->
    <div class="mkt-card">
      <div class="mkt-card-title">🎨 Posters — Last 8 Weeks</div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-bottom:6px">
        ${weeklyPosters.map((v,i)=>{
          const h = Math.round((v/maxWeekly)*80);
          const isLast = i===7;
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">'
            +'<div style="font-size:9px;color:var(--text3)">'+v+'</div>'
            +'<div style="width:100%;background:'+(isLast?'var(--gold)':'rgba(201,168,76,0.4)')+';border-radius:3px 3px 0 0;height:'+h+'px;min-height:2px"></div>'
          +'</div>';
        }).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3)">
        <span>8 weeks ago</span><span style="color:var(--gold);font-weight:700">This week</span>
      </div>
    </div>

    <!-- Content Calendar -->
    <div class="mkt-card">
      <div class="mkt-card-title">📅 Content Calendar</div>
      <div style="display:grid;gap:8px">
        ${[
          {label:'Published',val:calPublished,color:'#22c55e',pct:publishRate},
          {label:'Planned',val:calPlanned,color:'#f59e0b',pct:calPlanned?(calItems||[]).length>0?Math.round(calPlanned/(calItems||[]).length*100):0:0},
          {label:'Reels planned',val:calReels,color:'#8b5cf6',pct:null}
        ].map(m=>'<div>'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
          +'<span style="color:var(--text2)">'+m.label+'</span>'
          +'<span style="font-weight:700;color:'+m.color+'">'+m.val+(m.pct!==null?' ('+m.pct+'%)':'')+'</span></div>'
          +(m.pct!==null?'<div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+m.pct+'%;background:'+m.color+';border-radius:3px"></div></div>':'')
        +'</div>').join('')}
        <div style="font-size:11px;color:var(--text3);margin-top:4px">Publish rate: <strong style="color:var(--text1)">${publishRate}%</strong></div>
      </div>
    </div>
  </div>

  <!-- BLOG + FEED ROW -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
    <div class="mkt-card">
      <div class="mkt-card-title">📝 Blog Articles</div>
      <div style="display:grid;gap:8px">
        ${[
          {label:'Published',val:publishedBlogs,color:'#22c55e'},
          {label:'Drafts',val:draftBlogs,color:'#f59e0b'},
          {label:'Total words written',val:((blogs||[]).reduce((s,b)=>s+(b.word_count||0),0)).toLocaleString('en-IN'),color:'var(--text1)'}
        ].map(m=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg3);border-radius:8px">'
          +'<span style="font-size:12px">'+m.label+'</span>'
          +'<span style="font-size:14px;font-weight:900;color:'+m.color+'">'+m.val+'</span>'
        +'</div>').join('')}
        <a href="https://vwholesale.in/blog/" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none;text-align:center">View Live Blog ↗</a>
      </div>
    </div>

    <div class="mkt-card">
      <div class="mkt-card-title">📢 Staff Feed</div>
      <div style="display:grid;gap:8px">
        ${[
          {label:'Posts pushed',val:(feedPosts||[]).length,color:'var(--gold)'},
          {label:'Total shares',val:totalShares,color:'#22c55e'},
          {label:'Competitors tracked',val:(competitors||[]).length,color:'#3b82f6'}
        ].map(m=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg3);border-radius:8px">'
          +'<span style="font-size:12px">'+m.label+'</span>'
          +'<span style="font-size:14px;font-weight:900;color:'+m.color+'">'+m.val+'</span>'
        +'</div>').join('')}
        <div style="font-size:11px;color:var(--text3);padding:4px 0">Approvals pending: <strong style="color:${((approvals||[]).filter(a=>a.status==='pending').length>0?'#f59e0b':'#22c55e')}">${(approvals||[]).filter(a=>a.status==='pending').length}</strong></div>
      </div>
    </div>
  </div>

  <!-- QUICK ACTIONS -->
  <div class="mkt-card">
    <div class="mkt-card-title">⚡ Quick Actions</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
      ${[
        {label:'Generate Poster',icon:'🎨',page:'poster'},
        {label:'Write Blog Article',icon:'📝',page:'website-seo'},
        {label:'Add to Calendar',icon:'📅',page:'calendar'},
        {label:'Check Greetings',icon:'🎂',page:'greetings'},
        {label:'Add Competitor',icon:'🔍',page:'competitors'},
        {label:'Create Campaign',icon:'📣',page:'campaigns'}
      ].map(a=>'<button class="mkt-btn mkt-btn-ghost" onclick="mktNav(this.dataset.p)" data-p="'+a.page+'" style="display:flex;align-items:center;gap:8px;padding:10px;font-size:12px;font-weight:600;text-align:left">'
        +'<span style="font-size:18px">'+a.icon+'</span>'+a.label+'</button>'
      ).join('')}
    </div>
  </div>`);
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
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">💰 Paid Advertising</h3>'
    +'<div style="font-size:12px;color:var(--text3)">Google Ads · Meta Ads · Budget ₹30,000/month</div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'
    +[{l:'Monthly Budget',v:'₹30,000',i:'💰'},{l:'Google',v:'₹18,000',i:'🔍'},{l:'Meta (FB+IG)',v:'₹12,000',i:'🎯'}]
    .map(m=>'<div class="mkt-card" style="padding:12px;text-align:center"><div style="font-size:20px">'+m.i+'</div>'
      +'<div style="font-size:16px;font-weight:900;margin:4px 0">'+m.v+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+m.l+'</div></div>').join('')
    +'</div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">🔍 Google Ads (₹18,000/mo)</div>'
    +'<div style="display:grid;gap:8px">'
    +[{t:'Search Ads — ₹10,000',d:'tiles Vijayawada, granite price near me, bathroom fittings shop, flooring store Andhra Pradesh',note:'High intent buyers actively searching'},
      {t:'Local/Maps Ads — ₹5,000',d:'Appears in Google Maps when someone searches near NH65 / Bhavanipuram area',note:'Drives direct store walk-ins'},
      {t:'Display Retargeting — ₹3,000',d:'Re-shows ads to people who visited vwholesale.in but did not buy',note:'Low cost, high conversion'}
     ].map(a=>'<div style="background:var(--bg3);border-radius:8px;padding:10px">'
      +'<div style="font-size:12px;font-weight:700;margin-bottom:3px">'+a.t+'</div>'
      +'<div style="font-size:11px;color:var(--text3);margin-bottom:3px">'+a.d+'</div>'
      +'<div style="font-size:11px;color:var(--gold)">💡 '+a.note+'</div></div>').join('')
    +'</div><a href="https://ads.google.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="width:100%;margin-top:10px;text-decoration:none;display:block;text-align:center">Open Google Ads ↗</a></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">🎯 Meta Ads — Facebook + Instagram (₹12,000/mo)</div>'
    +'<div style="display:grid;gap:8px">'
    +[{t:'Reels Boost — ₹4,000',d:'Boost your best Reels to homeowners 28-55 within 50km of Vijayawada'},
      {t:'Lookalike Audience — ₹5,000',d:'Upload 1,300 customer list → Meta finds 50,000+ similar people in Andhra Pradesh'},
      {t:'Retargeting — ₹3,000',d:'Re-target people who visited vwholesale.in or engaged with your Instagram'}
     ].map(a=>'<div style="background:var(--bg3);border-radius:8px;padding:10px">'
      +'<div style="font-size:12px;font-weight:700;margin-bottom:3px">'+a.t+'</div>'
      +'<div style="font-size:11px;color:var(--text3)">'+a.d+'</div></div>').join('')
    +'</div><a href="https://business.facebook.com/adsmanager" target="_blank" class="mkt-btn mkt-btn-ghost" style="width:100%;margin-top:10px;text-decoration:none;display:block;text-align:center">Open Meta Ads Manager ↗</a></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">🤖 AI Ad Copy Generator</div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Product / Focus</label>'
    +'<input id="ads-topic" class="mkt-form-input" placeholder="e.g. Italian marble tiles, monsoon bathroom renovation"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="generateAdCopy()" style="width:100%;margin-bottom:10px">Generate Ad Copy + Keywords</button>'
    +'<div id="ads-output" style="display:none;background:var(--bg3);border-radius:8px;padding:12px;white-space:pre-wrap;font-size:12px;line-height:1.7"></div></div>');
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
