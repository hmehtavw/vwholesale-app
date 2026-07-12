
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
    id="gbp-image-preview" style="display:none;border-radius:10px;border:1px solid var(--border);overflow:hidden">
        <img id="gbp-image-preview-img" src="" onclick="openGBPImageFullscreen(this.src)" style="width:100%;max-height:220px;object-fit:cover;cursor:zoom-in;display:block" title="Click to view full size">
        <div style="background:rgba(0,0,0,.7);padding:6px 10px;display:flex;justify-content:space-between;align-items:center">
          <span id="gbp-image-label" style="font-size:10px;color:#fff">Image ready</span>
          <div style="display:flex;gap:6px">
            <button onclick="openGBPImageFullscreen(document.getElementById(&apos;gbp-image-preview-img&apos;).src)" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">⛶ View</button>
            <button onclick="clearGBPImage()" style="background:rgba(239,68,68,.9);border:none;color:#fff;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">✕ Remove</button>
          </div>
        </div>
      </div>
      <input type="hidden" id="gbp-image-url">
    </div>
    <div style="display:flex;gap:8px">
      ${isConnected
        ? `<button class="mkt-btn mkt-btn-primary" onclick="postToGBP()" style="flex:1;padding:12px;font-weight:700">📋 Copy & Open GBP to Post</button>`
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
  const imageUrl = (document.getElementById('gbp-image-url')?.value||'').trim();

  if (!text) { showMktToast('Write or generate post text first'); return; }

  const result = document.getElementById('gbp-result');
  if (result) result.style.display = 'block';

  // Copy text to clipboard
  await navigator.clipboard.writeText(text).catch(()=>{});

  // Show manual posting instructions with direct GBP link
  if (result) result.innerHTML = `
    <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:10px;padding:16px">
      <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:10px">📋 Post text copied! Now post to GBP:</div>
      <div style="display:grid;gap:8px;margin-bottom:12px">
        <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px">
          <span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px;flex-shrink:0">1</span>
          <span>Click <strong>Open GBP</strong> below → goes to your business profile dashboard</span>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px">
          <span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px;flex-shrink:0">2</span>
          <span>Click <strong>Add update</strong> → paste text (already copied) → add image</span>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px">
          <span style="background:var(--gold);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px;flex-shrink:0">3</span>
          <span>Click <strong>Post</strong> → live on Google Maps in 2-5 minutes</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="https://business.google.com/posts" target="_blank" class="mkt-btn mkt-btn-primary" style="font-size:12px;text-decoration:none;padding:10px 16px">📍 Open GBP Dashboard ↗</a>
        <button class="mkt-btn mkt-btn-ghost" onclick="navigator.clipboard.writeText(document.getElementById('gbp-text')?.value||'').then(()=>showMktToast('📋 Copied again!'))" style="font-size:12px;padding:10px 16px">📋 Copy Text Again</button>
        ${imageUrl ? `<a href="${imageUrl}" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:12px;text-decoration:none;padding:10px 16px">🖼️ Open Image ↗</a>` : ''}
      </div>
      ${imageUrl ? '<div style="font-size:11px;color:var(--text3);margin-top:8px">💡 Right-click the image → Save As, then upload when creating the GBP post</div>' : ''}
    </div>`;

  // Log to post history
  await sb.from('marketing_audit_logs').insert({
    action: 'gbp_post_created',
    details: { post_text: text.slice(0,100), method: 'manual', has_image: !!imageUrl },
    created_at: new Date().toISOString()
  }).then(()=>{}).catch(()=>{});

  loadGBPHistory();
}


function openGBPImageFullscreen(url) {
  if (!url) return;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.93);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px';
  ov.onclick = () => ov.remove();
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:90vw;max-height:80vh;border-radius:8px;object-fit:contain';
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:10px;margin-top:14px';
  toolbar.onclick = e => e.stopPropagation();
  const cb = document.createElement('button');
  cb.textContent = '✕ Close';
  cb.style.cssText = 'background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:8px;padding:8px 20px;font-size:13px;cursor:pointer';
  cb.onclick = () => ov.remove();
  const dl = document.createElement('a');
  dl.href = url; dl.download = 'gbp-image.jpg'; dl.target = '_blank';
  dl.textContent = '⬇ Download Image';
  dl.style.cssText = 'background:#c9a84c;color:#000;border-radius:8px;padding:8px 20px;font-size:13px;text-decoration:none;font-weight:700';
  toolbar.appendChild(cb); toolbar.appendChild(dl);
  ov.appendChild(img); ov.appendChild(toolbar);
  document.body.appendChild(ov);
}

function setGBPImage(url, label) {
  const h = document.getElementById('gbp-image-url'); if(h) h.value = url;
  const p = document.getElementById('gbp-image-preview'); if(p) p.style.display = 'block';
  const i = document.getElementById('gbp-image-preview-img'); if(i) i.src = url;
  const l = document.getElementById('gbp-image-label'); if(l) l.textContent = label || 'Image ready';
  const st = document.getElementById('gbp-image-gen-status'); if(st) st.style.display = 'none';
}

function showGBPImagePreview(url) { setGBPImage(url, 'Image ready'); }

function clearGBPImage() {
  const h = document.getElementById('gbp-image-url'); if(h) h.value = '';
  const p = document.getElementById('gbp-image-preview'); if(p) p.style.display = 'none';
  const i = document.getElementById('gbp-image-preview-img'); if(i) i.src = '';
  const u = document.getElementById('gbp-image-upload'); if(u) u.value = '';
  const st = document.getElementById('gbp-image-gen-status'); if(st) st.style.display = 'none';
}

async function useLatestPoster() {
  showMktToast('🎨 Fetching latest poster…');
  const { data } = await sb.from('poster_history').select('poster_url,topic,created_at').order('created_at',{ascending:false}).limit(1).maybeSingle().then(r=>r,()=>({data:null}));
  if (!data?.poster_url) { showMktToast('No posters found — generate one in Poster Studio first'); return; }
  setGBPImage(data.poster_url, '🎨 ' + (data.topic||'Latest Poster'));
  showMktToast('✅ Latest poster loaded');
}

async function handleGBPImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { showMktToast('Image must be under 5MB'); return; }
  showMktToast('📁 Uploading image…');
  try {
    const fileName = 'gbp/' + Date.now() + '_' + file.name.replace(/[^a-z0-9.]/gi,'_').toLowerCase();
    const { data: up, error } = await sb.storage.from('marketing-assets').upload(fileName, file, {contentType:file.type, upsert:true});
    if (error) throw new Error(error.message);
    const { data: urlData } = sb.storage.from('marketing-assets').getPublicUrl(fileName);
    setGBPImage(urlData.publicUrl, '📁 ' + file.name + ' (uploaded ✅)');
    showMktToast('✅ Image uploaded and ready!');
  } catch(e) {
    // Use local URL — fine for manual posting (copy text → open GBP → upload image manually)
    setGBPImage(URL.createObjectURL(file), '📁 ' + file.name + ' — click ⬇ Download to save for GBP');
    showMktToast('✅ Image ready — download it to upload to GBP');
  }
}

async function getPexelsKey() {
  const { data } = await sb.from('marketing_settings').select('value').eq('key','PEXELS_API_KEY').maybeSingle().then(r=>r,()=>({data:null}));
  return data?.value || '';
}


