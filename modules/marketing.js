
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
  segments: 'Customer Segments', agents: 'AI Agents', brand: 'Brand Knowledge',
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
    segments: renderSegments, agents: renderAgents, 'brand-profile': renderBrandProfile, brand: renderBrand,
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
async function renderCalendar() {
  const { data: posts } = await sb.from('poster_history')
    .select('*').order('created_at',{ascending:false}).limit(20)
    .then(r=>r,()=>({data:[]}));

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today); monday.setDate(today.getDate() - (dayOfWeek===0?6:dayOfWeek-1));
  const weekLabel = monday.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});

  // Scheduled slots for this week
  const slots = [
    { day:'Monday',    date: new Date(monday), type:'Project Proof',    icon:'🏠', hint:'Before/after tile installation photo from a recent job. Tag the customer (with permission).', lang:'te' },
    { day:'Wednesday', date: new Date(monday), type:'Product / Offer',  icon:'📦', hint:'Spotlight a brand or product. Mention price range or any current offer.', lang:'en' },
    { day:'Friday',    date: new Date(monday), type:'Contractor Club',  icon:'🏆', hint:'Recruit contractors. Mention 2% commission, Silver/Gold/Platinum tiers, WhatsApp to join.', lang:'te+en' },
    { day:'Saturday',  date: new Date(monday), type:'Customer Story',   icon:'⭐', hint:'Happy customer quote or photo. Ask them to Google review V Wholesale.', lang:'te' },
  ];
  slots[0].date.setDate(monday.getDate() + 0);
  slots[1].date.setDate(monday.getDate() + 2);
  slots[2].date.setDate(monday.getDate() + 4);
  slots[3].date.setDate(monday.getDate() + 5);

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📅 Weekly Content Planner</h3>
      <div style="font-size:12px;color:var(--text3)">Week of ${weekLabel} · Write copy → upload poster → copy & post manually</div>
    </div>
  </div>

  <!-- WEEKLY SLOTS -->
  <div style="display:grid;gap:12px;margin-bottom:16px" id="cal-slots">
    ${slots.map((s,i) => {
      const dateStr = s.date.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
      const isToday = s.date.toDateString() === today.toDateString();
      const isPast  = s.date < today && !isToday;
      return `
      <div style="background:var(--bg2);border:1px solid ${isToday?'var(--gold)':'var(--border)'};border-radius:12px;overflow:hidden">
        <!-- Slot header -->
        <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:${isToday?'rgba(201,168,76,0.08)':'var(--bg3)'}">
          <div style="font-size:22px">${s.icon}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:900;color:${isToday?'var(--gold)':'var(--text)'}">${s.day} · ${dateStr}</div>
            <div style="font-size:11px;color:var(--text3)">${s.type} · ${s.lang==='te'?'Telugu':s.lang==='en'?'English':'Telugu + English'}</div>
          </div>
          ${isPast?`<span style="font-size:10px;color:var(--text3);font-weight:600">PAST</span>`:''}
          ${isToday?`<span style="background:var(--gold);color:#000;font-size:10px;font-weight:900;padding:2px 8px;border-radius:10px">TODAY</span>`:''}
        </div>
        <!-- Slot body -->
        <div style="padding:14px 16px;display:grid;gap:10px">
          <div style="font-size:11px;color:var(--text3);background:var(--bg3);padding:8px 10px;border-radius:6px;line-height:1.5">
            💡 ${s.hint}
          </div>
          <!-- Caption input -->
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);display:block;margin-bottom:4px">CAPTION / COPY</label>
            <textarea id="cal-caption-${i}" rows="3" class="mkt-form-input" style="resize:vertical;font-size:12px;line-height:1.6"
              placeholder="Write your post caption here... include emojis, call to action, and hashtags"></textarea>
          </div>
          <!-- Poster upload -->
          <div style="display:flex;gap:8px;align-items:flex-start">
            <div style="flex:1">
              <label style="font-size:11px;font-weight:700;color:var(--text3);display:block;margin-bottom:4px">POSTER IMAGE</label>
              <input type="file" id="cal-img-${i}" accept="image/*" style="display:none" onchange="calPreviewImg(${i})">
              <div id="cal-img-preview-${i}" onclick="document.getElementById('cal-img-${i}').click()"
                style="border:2px dashed var(--border);border-radius:8px;padding:16px;text-align:center;cursor:pointer;font-size:12px;color:var(--text3);min-height:60px;display:flex;align-items:center;justify-content:center;gap:8px"
                onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
                📎 Click to upload poster (JPG/PNG)
              </div>
            </div>
          </div>
          <!-- Action buttons -->
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="calCopyCaption(${i})">📋 Copy Caption</button>
            <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="calDownloadImg(${i})">⬇ Download Poster</button>
            <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="calSaveDraft(${i},'${s.type}','${s.lang}','${s.date.toISOString().slice(0,10)}')">💾 Save Draft</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <!-- SAVED DRAFTS -->
  <div class="mkt-card" id="cal-drafts-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="mkt-card-title" style="margin:0">Saved Drafts & Posts</div>
      <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="renderCalendar()">↺ Refresh</button>
    </div>
    <div id="cal-drafts">
      ${(posts||[]).length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">No drafts yet — save your first post above</div>`
        : (posts||[]).map(p=>`
          <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)">
            ${p.image_url
              ? `<img src="${p.image_url}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0">`
              : `<div style="width:48px;height:48px;background:var(--bg3);border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">🖼</div>`
            }
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.topic||p.headline||'Draft'}</div>
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px">${p.template||'post'} · ${new Date(p.created_at).toLocaleDateString('en-IN')}</div>
              ${p.caption?`<div style="font-size:11px;color:var(--text2);line-height:1.4">${p.caption.slice(0,90)}${p.caption.length>90?'…':''}</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
              ${p.caption?`<button class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px" onclick="navigator.clipboard.writeText(${JSON.stringify(p.caption)}).then(()=>showMktToast('📋 Copied!'))">📋 Copy</button>`:''}
              ${p.image_url?`<a class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px;text-decoration:none" href="${p.image_url}" download="poster.png">⬇ Save</a>`:''}
              <button class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--red)" onclick="calDeleteDraft(${p.id})">🗑</button>
            </div>
          </div>`).join('')
      }
    </div>
  </div>

  <!-- QUICK POSTING GUIDE -->
  <div class="mkt-card" style="margin-top:4px">
    <div class="mkt-card-title">📲 How to Post (Manual Flow)</div>
    <div style="display:grid;gap:6px">
      ${[
        ['1','Download the poster image using ⬇ Download Poster'],
        ['2','Copy the caption using 📋 Copy Caption'],
        ['3','Open Instagram → + New Post → select the poster image'],
        ['4','Paste the caption, add location: V Wholesale Vijayawada'],
        ['5','For GBP: Google Business → Add Update → paste caption + image'],
        ['6','For WhatsApp: Open Broadcast list → paste caption + image'],
      ].map(([n,t])=>`
      <div style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--bg3);border-radius:6px">
        <span style="width:20px;height:20px;border-radius:50%;background:var(--gold);color:#000;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0">${n}</span>
        <span style="font-size:12px;color:var(--text2)">${t}</span>
      </div>`).join('')}
    </div>
  </div>
  `);
}

// ── Calendar helpers ──
function calPreviewImg(i) {
  const file = document.getElementById(`cal-img-${i}`)?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const el = document.getElementById(`cal-img-preview-${i}`);
    if (el) el.innerHTML = `<img src="${e.target.result}" style="max-height:80px;border-radius:6px;object-fit:contain">`;
  };
  reader.readAsDataURL(file);
}

function calCopyCaption(i) {
  const txt = document.getElementById(`cal-caption-${i}`)?.value?.trim();
  if (!txt) { showMktToast('Write a caption first'); return; }
  navigator.clipboard.writeText(txt).then(() => showMktToast('📋 Caption copied!'));
}

function calDownloadImg(i) {
  const file = document.getElementById(`cal-img-${i}`)?.files?.[0];
  if (!file) { showMktToast('Upload a poster image first'); return; }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = `vwholesale-poster-${Date.now()}.png`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function calSaveDraft(i, type, lang, dateStr) {
  const caption = document.getElementById(`cal-caption-${i}`)?.value?.trim();
  const file    = document.getElementById(`cal-img-${i}`)?.files?.[0];
  if (!caption && !file) { showMktToast('Add a caption or image first'); return; }

  let image_url = null;
  if (file) {
    try {
      await sb.storage.createBucket('brand-assets', { public: true }).catch(()=>{});
      const fname = `posters/${Date.now()}-${type.replace(/\W/g,'_').slice(0,20)}.png`;
      const { error } = await sb.storage.from('brand-assets').upload(fname, file, { contentType: file.type, upsert: true });
      if (!error) {
        const { data: urlData } = sb.storage.from('brand-assets').getPublicUrl(fname);
        image_url = urlData?.publicUrl || null;
      }
    } catch(e) { console.warn('Upload failed:', e.message); }
  }

  const { error } = await sb.from('poster_history').insert({
    topic: type,
    template: type.toLowerCase().replace(/\W/g,'_').slice(0,20),
    language: lang,
    caption,
    image_url,
    status: 'draft',
    created_by: mktProfile?.name,
    created_at: new Date(dateStr).toISOString()
  });

  if (error) { showMktToast('Save failed: ' + error.message); return; }
  showMktToast('✅ Draft saved!');
  // Clear the slot
  const capEl = document.getElementById(`cal-caption-${i}`);
  if (capEl) capEl.value = '';
  const prevEl = document.getElementById(`cal-img-preview-${i}`);
  if (prevEl) prevEl.innerHTML = '📎 Click to upload poster (JPG/PNG)';
  renderCalendar();
}

async function calDeleteDraft(id) {
  if (!confirm('Delete this draft?')) return;
  await sb.from('poster_history').delete().eq('id', id);
  showMktToast('Deleted');
  renderCalendar();
}


// ── ANALYTICS ──
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
  const topic = (document.getElementById('ps-upload-topic')?.value || '').trim();
  const template = document.getElementById('ps-upload-template')?.value || 'product';
  const lang = document.getElementById('ps-upload-lang')?.value || 'en';

  if (!topic) { showMktToast('Enter what the poster is about first'); return; }
  if (!currentPosterB64) { showMktToast('Upload a poster image first'); return; }

  const edit = document.getElementById('ps-caption-edit');
  const disp = document.getElementById('ps-caption-display');
  if (edit) { edit.value = '⏳ Generating caption...'; edit.disabled = true; edit.style.display = 'block'; }
  if (disp) disp.style.display = 'none';

  try {
    // Call edge function content-only (no image needed)
    const res = await fetch(`${MKT_SB_URL}/functions/v1/generate-poster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        topic, template, language: lang,
        caption_only: true,   // signal to skip image generation
        business_name: 'V Wholesale',
      })
    });
    const data = await res.json();

    // Build rich caption from content fields
    const c = data.content || {};
    const langNote = lang === 'te' ? '(Telugu caption below)' : lang === 'hi' ? '(Hindi caption below)' : '';

    const generatedCaption = c.caption ||
      `✨ ${c.headline_line1 || topic} ${c.headline_line2 || ''} — ${c.subheadline || 'Now Available at V Wholesale'}\n\n` +
      `${c.body || ''}\n\n` +
      `✅ ${c.feature1 || ''}\n✅ ${c.feature2 || ''}\n✅ ${c.feature3 || ''}\n\n` +
      `📍 V Wholesale, NH65, Bhavanipuram, Vijayawada\n` +
      `📞 Call: 8712697930 | 🌐 vwholesale.in\n\n` +
      `#VWholesale #Vijayawada #Tiles #HomeDesign #InteriorDesign #BuildingMaterials #${(c.headline_line1||topic).replace(/\s/g,'')} #HouseConstruction`;

    currentCaption = generatedCaption;
    if (edit) { edit.value = generatedCaption; edit.disabled = false; edit.oninput = () => { currentCaption = edit.value; }; }
    showMktToast('✅ Caption generated — edit if needed, then publish!');

  } catch(e) {
    // Fallback: build a decent caption from topic alone without the edge function
    const brand = topic.split(' ')[0];
    const fallback =
      `✨ ${topic} — Now Available at V Wholesale, Vijayawada!\n\n` +
      `🏠 Transform your home with premium quality products\n` +
      `💎 Elegant Designs • Modern Finishes • Lasting Quality\n` +
      `✅ Perfect for Living Rooms, Bedrooms & Bathrooms\n\n` +
      `📍 V Wholesale, NH65, Bhavanipuram, Vijayawada\n` +
      `📞 Call: 8712697930 | 🌐 vwholesale.in\n\n` +
      `#VWholesale #Vijayawada #${brand.replace(/\s/g,'')} #Tiles #HomeDesign #InteriorDesign #BuildingMaterials #HouseConstruction #AndhraPradesh`;

    currentCaption = fallback;
    if (edit) { edit.value = fallback; edit.disabled = false; edit.oninput = () => { currentCaption = edit.value; }; }
    showMktToast('Caption ready (offline fallback — edge function may need deployment)');
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
function renderCampaigns() { renderComingSoon('Campaigns — coming next session'); }
function renderSocial() { renderComingSoon('Social Media — connect Meta Business first'); }
function renderWhatsApp() { renderComingSoon('WhatsApp — complete Interakt setup first'); }
function renderAds() { renderComingSoon('Advertising — connect Google Ads & Meta Ads first'); }
function renderLocalSEO() { renderComingSoon('Local SEO — connecting Search Console data'); }
function renderWebsiteSEO() { renderComingSoon('Website SEO — analysing vwholesale.in'); }
function renderReviews() { renderComingSoon('Reviews & Reputation — connecting GBP API'); }
function renderCompetitors() { renderComingSoon('Competitor Intelligence — coming next session'); }
function renderSegments() { renderComingSoon('Customer Segments — coming next session'); }


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