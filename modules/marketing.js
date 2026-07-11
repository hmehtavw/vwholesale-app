
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
  const [settingsRes, intRes, agentsRes, approvalsRes] = await Promise.all([
    sb.from('marketing_settings').select('key,value').then(r=>r, ()=>({data:[]})),
    sb.from('marketing_integrations').select('*').then(r=>r, ()=>({data:[]})),
    sb.from('ai_agents').select('*').then(r=>r, ()=>({data:[]})),
    sb.from('marketing_approvals').select('*').eq('status','pending').then(r=>r, ()=>({data:[]})),
  ]);

  const settings = {};
  (settingsRes.data||[]).forEach(s => { settings[s.key] = s.value; });
  const integrations = intRes.data || [];
  const agents = agentsRes.data || [];
  const approvals = approvalsRes.data || [];

  const connectedInt = integrations.filter(i => i.status === 'connected').length;
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
        ${integrations.map(i => `
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
        {done:true, text:'vwholesale.in domain live'},
        {done:true, text:'Google Search Console verified'},
        {done:true, text:'Sitemap submitted (5 pages)'},
        {done:true, text:'robots.txt configured'},
        {done:true, text:'GBP website URL updated (pending approval)'},
        {done:true, text:'OpenAI API connected'},
        {done:true, text:'Marketing database foundation created'},
        {done:false, text:'Add OpenAI API key to Supabase secrets'},
        {done:false, text:'Connect Instagram/Facebook (Meta Business)'},
        {done:false, text:'Complete Interakt WhatsApp setup'},
        {done:false, text:'Set up Google Analytics 4'},
        {done:false, text:'Add product images (181 without images)'},
        {done:false, text:'Create first GBP post'},
        {done:false, text:'Configure vwholesalemart.com redirect'},
      ].map(item => `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
        <span style="color:${item.done?'var(--green)':'var(--text3)'}">${item.done?'✅':'⬜'}</span>
        <span style="color:${item.done?'var(--text2)':'var(--text3)'}">${item.text}</span>
      </div>`).join('')}
    </div>
  </div>`);
}

// ── AI CMO ──
async function renderAICMO() {
  setContent(`
  <div class="mkt-card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div style="width:48px;height:48px;background:rgba(139,92,246,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px">🧠</div>
      <div>
        <div style="font-size:16px;font-weight:900">AI CMO</div>
        <div style="font-size:12px;color:var(--text3)">Marketing Orchestrator · Level 1 (Recommend Only) · GPT-4o</div>
      </div>
      <button class="mkt-btn mkt-btn-primary" onclick="runAICMO()" style="margin-left:auto">▶ Run Now</button>
    </div>
    <div id="cmo-output">
      <div class="mkt-empty">
        <div class="mkt-empty-icon">🧠</div>
        <div class="mkt-empty-title">AI CMO Ready</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px">Click "Run Now" to get your weekly marketing briefing, strategy recommendations, and action plan.</div>
        <button class="mkt-btn mkt-btn-primary" onclick="runAICMO()" style="margin-top:16px">▶ Generate Weekly Briefing</button>
      </div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">Previous Runs</div>
    <div id="cmo-runs-list">
      <div style="color:var(--text3);font-size:12px;text-align:center;padding:20px">No runs yet</div>
    </div>
  </div>`);

  // Load previous runs
  const { data: runs } = await sb.from('ai_agent_runs').select('*').eq('agent_name','AI CMO').order('created_at',{ascending:false}).limit(5).then(r=>r, ()=>({data:[]}));
  const runsEl = document.getElementById('cmo-runs-list');
  if (runs?.length) {
    runsEl.innerHTML = runs.map(r => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:12px;font-weight:700">${new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        <div style="font-size:11px;color:var(--text3)">${r.model} · $${(r.cost_usd||0).toFixed(4)} · ${r.duration_ms}ms</div>
      </div>
      <span class="badge badge-green">${r.status}</span>
    </div>`).join('');
  }
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
  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Platform Integrations</h3>
    <div style="font-size:12px;color:var(--text3)">Connect your marketing platforms</div>
  </div>
  <div style="display:grid;gap:10px">
    ${(integrations||[]).map(i => `
    <div class="mkt-card" style="display:flex;align-items:center;gap:14px;padding:14px">
      <div style="width:40px;height:40px;background:var(--bg3);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">
        ${{
          'Google Search Console':'🔍','Google Business Profile':'📍','Instagram':'📸',
          'Facebook':'👥','WhatsApp Business':'💬','Google Ads':'📢','Meta Ads':'📱','OpenAI':'🧠'
        }[i.name]||'🔌'}
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:800">${i.name}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${i.notes||'—'}</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <span style="font-size:10px;color:${i.credentials_set?'var(--green)':'var(--text3)'}">🔑 Credentials ${i.credentials_set?'✓':'✗'}</span>
          <span style="font-size:10px;color:${i.read_tested?'var(--green)':'var(--text3)'}">📖 Read ${i.read_tested?'✓':'✗'}</span>
          <span style="font-size:10px;color:${i.write_tested?'var(--green)':'var(--text3)'}">✍️ Write ${i.write_tested?'✓':'✗'}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="badge ${i.status==='connected'?'badge-green':i.status==='setup'||i.status==='partial'?'badge-gold':'badge-gray'}">${i.status}</span>
        <button class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:4px 8px">${i.status==='connected'?'Configure':'Connect'}</button>
      </div>
    </div>`).join('')}
  </div>`);
}

// ── AI AGENTS ──
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
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">Google Business Profile</h3>
      <div style="font-size:12px;color:var(--text3)">Create posts, respond to reviews, manage your GBP presence</div>
    </div>
    <a href="https://business.google.com" target="_blank" class="mkt-btn mkt-btn-ghost">Open GBP ↗</a>
  </div>

  <div class="mkt-grid-2" style="margin-bottom:16px">
    <div class="stat-card">
      <div class="stat-label">GBP Status</div>
      <div class="stat-value" style="font-size:16px;color:var(--green)">✅ Live</div>
      <div class="stat-sub">vwholesale.in connected (pending)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Last Post</div>
      <div class="stat-value" style="font-size:16px;color:var(--gold)">10 days ago</div>
      <div class="stat-sub">Posting gap detected — post today</div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">📍 Create GBP Post with AI</div>
    <div class="mkt-grid-2">
      <div class="mkt-form-group">
        <label class="mkt-form-label">Post Type</label>
        <select id="gbp-type" class="mkt-form-select">
          <option value="whats_new">What's New</option>
          <option value="offer">Offer</option>
          <option value="event">Event</option>
          <option value="product">Product</option>
        </select>
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Language</label>
        <select id="gbp-lang" class="mkt-form-select">
          <option value="te">Telugu</option>
          <option value="en">English</option>
          <option value="te+en">Telugu + English</option>
        </select>
      </div>
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Topic / Product / Offer</label>
      <input type="text" id="gbp-topic" class="mkt-form-input" placeholder="e.g. New Kajaria tile collection, Monsoon offer on sanitaryware, Store walk-in">
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Call to Action</label>
      <select id="gbp-cta" class="mkt-form-select">
        <option value="call">Call Now</option>
        <option value="book">Book</option>
        <option value="learn_more">Learn More</option>
        <option value="visit">Visit Store</option>
        <option value="whatsapp">WhatsApp Us</option>
      </select>
    </div>
    <button class="mkt-btn mkt-btn-primary" onclick="generateGBPPost()">📍 Generate GBP Post</button>
  </div>

  <div id="gbp-output"></div>

  <div class="mkt-card">
    <div class="mkt-card-title">📋 GBP Post Ideas This Week</div>
    <div style="display:grid;gap:8px">
      ${[
        {day:'Monday', idea:'Project proof — show a completed tile installation from a recent customer', lang:'te'},
        {day:'Wednesday', idea:'Product spotlight — featured product from top-selling category', lang:'en'},
        {day:'Friday', idea:'Contractor Club recruitment — benefits of joining', lang:'te+en'},
        {day:'Saturday', idea:'Customer journey — before and after renovation story', lang:'te'},
      ].map(p => `<div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--purple);min-width:70px">${p.day}</div>
        <div style="flex:1;font-size:12px">${p.idea}</div>
        <span class="badge badge-gold">${p.lang}</span>
        <button class="mkt-btn mkt-btn-ghost" onclick="quickGBPPost('${p.idea}','${p.lang}')" style="font-size:10px;padding:4px 8px">Draft →</button>
      </div>`).join('')}
    </div>
  </div>`);
}

async function generateGBPPost() {
  const type = document.getElementById('gbp-type').value;
  const lang = document.getElementById('gbp-lang').value;
  const topic = document.getElementById('gbp-topic').value;
  const cta = document.getElementById('gbp-cta').value;
  if (!topic) { showMktToast('Enter a topic first'); return; }

  const outputEl = document.getElementById('gbp-output');
  outputEl.innerHTML = '<div class="mkt-card"><div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div><span style="font-size:12px;color:var(--text3);margin-left:8px">Writing GBP post…</span></div></div>';

  const langMap = {te:'Telugu',en:'English','te+en':'bilingual Telugu and English'};
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'gbp_post', agent:'GBP Agent', model:'gpt-4o-mini',
        prompt:`You are creating a Google Business Profile post for V Wholesale, Vijayawada.

Post type: ${type}
Language: ${langMap[lang]}
Topic: ${topic}
CTA: ${cta}

RULES:
- Max 1500 characters for GBP posts
- V Wholesale, NH65 Bhavanipuram, Vijayawada | 8712697930 | vwholesale.in
- Natural, local tone — not corporate
- Telugu should feel like a local Vijayawada person wrote it
- Never invent prices or discounts not specified

Respond ONLY in this JSON:
{
  "post_text": "the full GBP post text ready to copy-paste",
  "char_count": 0,
  "photo_suggestion": "what photo to use",
  "best_time_to_post": "best day and time",
  "notes": "any tips"
}`,
        context:{topic, type, lang, cta}
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const p = data.output;

    outputEl.innerHTML = `
    <div class="mkt-card" style="border:1px solid rgba(16,185,129,.3);margin-top:4px">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div class="mkt-card-title" style="margin:0">✅ GBP Post Ready</div>
        <div style="display:flex;gap:6px">
          <span class="badge badge-green">GBP Post</span>
          <span class="badge badge-gold">${lang}</span>
          <span class="badge badge-gray">${(p.char_count||p.post_text?.length||0)} chars</span>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:14px;font-size:13px;line-height:1.8;margin-bottom:12px;white-space:pre-wrap">${p.post_text}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="font-size:11px"><span style="color:var(--text3)">📸 Photo:</span> ${p.photo_suggestion}</div>
        <div style="font-size:11px"><span style="color:var(--text3)">⏰ Best time:</span> ${p.best_time_to_post}</div>
      </div>
      ${p.notes ? `<div style="font-size:11px;color:var(--text3);font-style:italic;margin-bottom:12px">${p.notes}</div>` : ''}
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" onclick="copyContent('${p.post_text?.replace(/'/g,"\'").replace(/\n/g,'\\n')}')">📋 Copy Post</button>
        <a href="https://business.google.com" target="_blank" class="mkt-btn mkt-btn-ghost">Open GBP to Post ↗</a>
        <button class="mkt-btn mkt-btn-ghost" onclick="generateGBPPost()">🔄 Regenerate</button>
      </div>
    </div>`;
  } catch(e) {
    outputEl.innerHTML = `<div class="mkt-card" style="border-color:var(--red)"><div style="color:var(--red);font-size:12px">Error: ${e.message}</div></div>`;
  }
}

function quickGBPPost(idea, lang) {
  document.getElementById('gbp-topic').value = idea;
  document.getElementById('gbp-lang').value = lang;
  generateGBPPost();
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
  const { data: runs } = await sb.from('ai_agent_runs').select('*').order('created_at',{ascending:false}).then(r=>r,()=>({data:[]}));
  const totalCost = (runs||[]).reduce((s,r)=>s+(r.cost_usd||0),0);
  const totalRuns = (runs||[]).length;

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Analytics & Reporting</h3>
    <div style="font-size:12px;color:var(--text3)">Connect Google Analytics for full data. AI usage tracked below.</div>
  </div>

  <div class="mkt-grid-4" style="margin-bottom:16px">
    <div class="stat-card">
      <div class="stat-label">AI Runs Total</div>
      <div class="stat-value" style="color:var(--purple)">${totalRuns}</div>
      <div class="stat-sub">All agents combined</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">AI Cost Total</div>
      <div class="stat-value" style="color:var(--green)">$${totalCost.toFixed(4)}</div>
      <div class="stat-sub">≈ ₹${(totalCost*84).toFixed(2)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Search Console</div>
      <div class="stat-value" style="font-size:16px">✅</div>
      <div class="stat-sub">Processing data (1-2 days)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Google Analytics</div>
      <div class="stat-value" style="font-size:16px;color:var(--gold)">⏳</div>
      <div class="stat-sub">Not connected yet</div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">📊 Connect Google Analytics 4</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.6">
      Google Analytics 4 will track website visitors, traffic sources, page views and conversion events for vwholesale.in.
    </div>
    <div style="display:grid;gap:8px;margin-bottom:12px">
      ${[
        {step:'1', text:'Go to analytics.google.com', done:false},
        {step:'2', text:'Create GA4 property for vwholesale.in', done:false},
        {step:'3', text:'Copy your Measurement ID (G-XXXXXXXXXX)', done:false},
        {step:'4', text:'Add it below and I will embed the tracking code', done:false},
      ].map(s=>`<div style="display:flex;gap:10px;align-items:center;font-size:12px">
        <span style="width:20px;height:20px;border-radius:50%;background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">${s.step}</span>
        <span style="color:${s.done?'var(--green)':'var(--text2)'}">${s.text}</span>
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <input type="text" id="ga-id" class="mkt-form-input" placeholder="G-XXXXXXXXXX" style="flex:1">
      <button class="mkt-btn mkt-btn-primary" onclick="addGATracking()">Add GA4 Tracking</button>
    </div>
  </div>

  <div class="mkt-card" style="margin-top:4px">
    <div class="mkt-card-title">🤖 AI Usage Log</div>
    ${(runs||[]).length > 0 ? `<table class="mkt-table">
      <tr><th>Agent</th><th>Model</th><th>Cost</th><th>Duration</th><th>Date</th></tr>
      ${(runs||[]).slice(0,20).map(r=>`<tr>
        <td style="font-weight:700">${r.agent_name}</td>
        <td style="color:var(--text3);font-size:11px">${r.model}</td>
        <td style="color:var(--green)">$${(r.cost_usd||0).toFixed(4)}</td>
        <td style="color:var(--text3)">${r.duration_ms}ms</td>
        <td style="color:var(--text3)">${new Date(r.created_at).toLocaleDateString('en-IN')}</td>
      </tr>`).join('')}
    </table>` : '<div class="mkt-empty"><div style="color:var(--text3);font-size:12px">No runs yet</div></div>'}
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

function renderWhatsApp() {
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">💬 WhatsApp Automation</h3>'
    +'<div style="font-size:12px;color:var(--text3)">Broadcasts · Chatbot · Greetings via Interakt</div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">⚙️ Setup Checklist</div><div style="display:grid;gap:8px">'
    +[{step:'Create Interakt account at interakt.ai', url:'https://app.interakt.ai', done:false},
      {step:'Connect WhatsApp Business number', url:'https://app.interakt.ai', done:false},
      {step:'Get WABA approved by Meta (2-3 days)', url:'https://app.interakt.ai', done:false},
      {step:'Add INTERAKT_API_KEY to Supabase secrets', url:'MKT_SB_URL+"/settings/vault"', done:false},
      {step:'Create message templates in Interakt', url:'https://app.interakt.ai', done:false}
     ].map((s,i)=>'<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px">'
      +'<div style="width:24px;height:24px;border-radius:50%;background:'+(s.done?'#22c55e':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">'+(s.done?'✓':(i+1))+'</div>'
      +'<div style="flex:1;font-size:12px">'+s.step+'</div>'
      +'<a href="'+s.url+'" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px;text-decoration:none">Open ↗</a></div>'
     ).join('')+'</div></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">📨 Manual Message Generator</div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Type</label>'
    +'<select id="wa-type" class="mkt-form-select">'
    +'<option value="offer">Festival / Seasonal Offer</option>'
    +'<option value="product">New Product Arrival</option>'
    +'<option value="contractor">Contractor Club Invite</option>'
    +'<option value="followup">Customer Follow-up</option></select></div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Key Details</label>'
    +'<input id="wa-details" class="mkt-form-input" placeholder="e.g. 20% off Italian marble tiles till Sunday"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="generateWAMessage()" style="width:100%;margin-bottom:10px">🤖 Generate Message</button>'
    +'<div id="wa-output" style="display:none"><div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">'
    +'<div id="wa-content" style="font-size:13px;line-height:1.8;white-space:pre-wrap"></div></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="copyWAMessage()" style="width:100%">📋 Copy Message</button></div></div>');
}
async function generateWAMessage() {
  const type = document.getElementById('wa-type')?.value||'offer';
  const details = (document.getElementById('wa-details')?.value||'').trim();
  showMktToast('🤖 Writing message…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'whatsapp_message',platform:'WhatsApp',language:'te+en',topic:type+(details?' — '+details:''),context:{business:'V Wholesale',location:'Vijayawada'}})});
  const data = await res.json();
  const content = data.content||data.text||'';
  if (!content) { showMktToast('❌ Failed'); return; }
  document.getElementById('wa-output').style.display='block';
  document.getElementById('wa-content').textContent=content;
}
function copyWAMessage() { navigator.clipboard.writeText(document.getElementById('wa-content')?.textContent||'').then(()=>showMktToast('📋 Copied!')); }

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
async function generateAdCopy() {
  const topic = (document.getElementById('ads-topic')?.value||'').trim();
  if (!topic) { showMktToast('Enter a topic'); return; }
  showMktToast('🤖 Generating ad copy…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'ad_copy',language:'en',topic,context:{business:'V Wholesale',location:'Vijayawada, Andhra Pradesh',budget_inr:30000}})});
  const data = await res.json();
  const out = document.getElementById('ads-output');
  if (out) { out.style.display='block'; out.textContent=data.content||data.text||'No output'; }
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
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">🌐 Website SEO</h3>'
    +'<div style="font-size:12px;color:var(--text3)">vwholesale.in · Blog Engine · Keywords · Backlinks</div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">⚙️ Technical SEO Status — vwholesale.in</div><div style="display:grid;gap:6px">'
    +[{t:'HTTPS — vwholesale.in secured',done:true},
      {t:'sitemap.xml submitted to Google Search Console',done:true},
      {t:'robots.txt configured (blocks staff/admin/marketing)',done:true},
      {t:'Google Search Console verified',done:true},
      {t:'GBP website URL updated to vwholesale.in',done:true},
      {t:'Meta description on all pages',done:false},
      {t:'LocalBusiness schema markup on homepage',done:false},
      {t:'Blog section /blog/ with SEO articles',done:false},
      {t:'Page speed < 3 seconds on mobile',done:false},
      {t:'Product pages with structured data',done:false}
     ].map(item=>'<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">'
      +'<div style="width:18px;height:18px;border-radius:4px;background:'+(item.done?'#22c55e':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">'+(item.done?'✓':'')+'</div>'
      +'<div style="font-size:12px;'+(item.done?'color:var(--text3);text-decoration:line-through':'')+'">'+ item.t+'</div></div>'
     ).join('')
    +'</div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">📝 AI Blog Article Generator</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Generate SEO-optimised blog articles for vwholesale.in/blog/ — targeting Andhra Pradesh home building searches</div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Blog Topic</label>'
    +'<input id="blog-topic" class="mkt-form-input" placeholder="e.g. How to choose bathroom tiles for Indian homes, Best granite for kitchen countertops Vijayawada"></div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Target Keyword</label>'
    +'<input id="blog-kw" class="mkt-form-input" placeholder="e.g. bathroom tiles price Vijayawada"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="generateBlogOutline()" style="width:100%;margin-bottom:10px">🤖 Generate Blog Outline + SEO Brief</button>'
    +'<div id="blog-output" style="display:none;background:var(--bg3);border-radius:8px;padding:12px;white-space:pre-wrap;font-size:12px;line-height:1.7;max-height:300px;overflow-y:auto"></div></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">🔗 Useful SEO Tools</div><div style="display:grid;gap:6px">'
    +[{n:'Google Search Console',url:'https://search.google.com/search-console'},
      {n:'Google PageSpeed Insights',url:'https://pagespeed.web.dev/?url=https://vwholesale.in'},
      {n:'Google Rich Results Test',url:'https://search.google.com/test/rich-results'},
      {n:'Ahrefs Free Tools',url:'https://ahrefs.com/free-seo-tools'},
      {n:'Schema Markup Generator',url:'https://technicalseo.com/tools/schema-markup-generator/'}
     ].map(d=>'<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:10px">'
      +'<div style="font-size:12px;font-weight:600">'+d.n+'</div>'
      +'<a href="'+d.url+'" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none">Open ↗</a></div>'
     ).join('')+'</div></div>');
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
