// ── BUSINESS INTELLIGENCE DASHBOARD — V Wholesale ──
// Full BI page with actionable signals and in-sheet actions

let _biData = null;

// ── SHEET UTILITY ──
function biOpenSheet(html) {
  biCloseSheet();
  const overlay = document.createElement('div');
  overlay.id = 'bi-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.65);z-index:9998';
  overlay.onclick = biCloseSheet;

  const sheet = document.createElement('div');
  sheet.id = 'bi-sheet';
  sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--bg2);border-radius:16px 16px 0 0;z-index:9999;max-height:82vh;overflow-y:auto;padding:20px;border-top:1px solid var(--border)';
  sheet.innerHTML = html;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
}

function biCloseSheet() {
  document.getElementById('bi-overlay')?.remove();
  document.getElementById('bi-sheet')?.remove();
}
window.biCloseSheet = biCloseSheet;

// ── MAIN RENDER ──
async function renderBI() {
  setContent(`
    <div style="text-align:center;padding:40px;color:var(--text3)">
      <div style="font-size:32px;margin-bottom:12px">📊</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">Loading Business Intelligence…</div>
      <div style="font-size:12px">Pulling revenue, pipeline, stock and field data</div>
    </div>`);
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/business-intelligence', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY }
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'BI fetch failed');
    _biData = data.snapshot;
    renderBIPage(_biData);
  } catch (e) {
    setContent(`<div style="text-align:center;padding:40px;color:var(--red)">
      <div style="font-size:24px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:700">Could not load intelligence</div>
      <div style="font-size:12px;margin-top:4px;color:var(--text3)">${e.message}</div>
      <button onclick="renderBI()" class="mkt-btn mkt-btn-ghost" style="margin-top:16px">↻ Retry</button>
    </div>`);
  }
}

function renderBIPage(s) {
  const momArrow = s.revenue.mom_change_pct >= 0 ? '↑' : '↓';
  const momColor = s.revenue.mom_change_pct >= 0 ? '#22c55e' : '#ef4444';
  const ts = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div>
      <div style="font-size:15px;font-weight:900">📊 Business Intelligence</div>
      <div style="font-size:11px;color:var(--text3)">Updated ${ts} · ${s.customers.total.toLocaleString()} customers · ${s.field_intelligence.total_visits.toLocaleString()} field visits</div>
    </div>
    <button onclick="renderBI()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">↻ Refresh</button>
  </div>

  <!-- REVENUE -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">💰 Revenue Snapshot</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div style="background:var(--bg3);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:var(--gold)">₹${s.revenue.this_month_lakhs}L</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">This month</div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:var(--text2)">₹${s.revenue.last_month_lakhs}L</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Last month</div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:${momColor}">${momArrow}${Math.abs(s.revenue.mom_change_pct)}%</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">MoM</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:var(--bg3);border-radius:8px;padding:10px">
        <div style="font-size:10px;color:var(--text3);margin-bottom:3px">ACTIVE (60 days)</div>
        <div style="font-size:18px;font-weight:900;color:var(--gold)">${s.customers.active_60d}</div>
        <div style="font-size:10px;color:var(--text3)">of ${s.customers.total} total</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:10px">
        <div style="font-size:10px;color:var(--text3);margin-bottom:3px">REACHABLE</div>
        <div style="font-size:18px;font-weight:900;color:#22c55e">${s.customers.reachable}</div>
        <div style="font-size:10px;color:var(--text3)">have phone number</div>
      </div>
    </div>
  </div>

  <!-- PIPELINE -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🔥 Pipeline — Who's Ready to Buy</div>
    <div style="display:grid;gap:10px">
      ${(s.customer_pipeline || []).filter(p => p.reachable >= 3).map(p => `
      <div style="background:var(--bg3);border-radius:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-size:13px;font-weight:700">${p.stage.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">
              <span style="color:var(--gold);font-weight:700">${p.reachable}</span> reachable ·
              <span style="color:#22c55e">${p.active_30d}</span> active 30d · ${p.total} total
            </div>
          </div>
          <div style="background:rgba(201,168,76,.15);border-radius:8px;padding:5px 10px;text-align:center">
            <div style="font-size:18px;font-weight:900;color:var(--gold)">${p.reachable}</div>
            <div style="font-size:9px;color:var(--text3)">reachable</div>
          </div>
        </div>
        <div style="background:rgba(37,99,235,.08);border-radius:8px;padding:8px;margin-bottom:10px;border-left:3px solid #3b82f6">
          <div style="font-size:11px;color:var(--text2)">→ Next buy: <b style="color:#60a5fa">${p.next_buy}</b></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          <button onclick="biViewCustomers('${p.stage}','${p.next_buy}')"
            class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:8px 4px;text-align:center">
            👥 See Who
          </button>
          <button onclick="biWhatsAppCompose('${p.stage}','${p.next_buy}',${p.reachable})"
            class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:8px 4px;text-align:center;color:#22c55e;border-color:#22c55e">
            💬 WhatsApp
          </button>
          <button onclick="biCreateContent('${p.stage}','${p.next_buy}')"
            class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:8px 4px;text-align:center">
            ✍️ Post
          </button>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- TOP SELLERS -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🏆 What's Selling (Last 12 Months)</div>
    <div style="display:grid;gap:8px">
      ${(s.top_categories || []).slice(0,8).map((c,i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="min-width:22px;font-size:13px;font-weight:900;color:${i<3?'var(--gold)':'var(--text3)'}">#${i+1}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${c.category}</div>
          <div style="font-size:10px;color:var(--text3)">${(c.stage||'').replace(/_/g,' ')} · ${c.unique_customers} customers · ${c.transactions} txns</div>
        </div>
        <div style="text-align:right;min-width:44px">
          <div style="font-size:13px;font-weight:900;color:var(--gold)">₹${c.revenue_lakhs}L</div>
        </div>
        <button onclick="biCreateContent('${c.stage}','${c.category}')"
          class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:5px 8px">✍️</button>
      </div>`).join('')}
    </div>
  </div>

  <!-- SLOW MOVERS -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:4px">⚠️ Needs a Push</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Low sales — content can help move these</div>
    <div style="display:grid;gap:8px">
      ${(s.slow_movers || []).slice(0,5).map(cat => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(245,158,11,.06);border-radius:8px;border-left:3px solid #f59e0b">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${cat}</div>
          <div style="font-size:10px;color:var(--text3)">Low sales — needs visibility</div>
        </div>
        <div style="display:flex;gap:5px">
          <button onclick="biViewStock('${cat}')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:6px 8px">📦</button>
          <button onclick="biWhatsAppCompose(null,'${cat}',0)" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:6px 8px;color:#22c55e;border-color:#22c55e">💬</button>
          <button onclick="biCreateContent(null,'${cat}')" class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:6px 8px">✍️</button>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- FIELD INTELLIGENCE -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🏗️ Field Intelligence — ${s.field_intelligence.total_visits.toLocaleString()} Site Visits</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:900;color:#3b82f6">${s.field_intelligence.valid_phone.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--text3)">Sites with contact</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:900;color:#22c55e">${s.customers.reachable}</div>
        <div style="font-size:10px;color:var(--text3)">Converted customers</div>
      </div>
    </div>
    <div style="display:grid;gap:6px">
      ${Object.entries(s.field_intelligence.by_stage||{}).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([stage,count])=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">
        <div style="flex:1;font-size:12px;font-weight:600">${stage.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</div>
        <div style="font-size:13px;font-weight:900;color:var(--gold);min-width:36px;text-align:right">${count}</div>
        <div style="width:70px;height:5px;background:var(--border);border-radius:3px">
          <div style="height:5px;background:var(--gold);border-radius:3px;width:${Math.min(100,Math.round(count/s.field_intelligence.total_visits*500))}%"></div>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- STOCK -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">📦 Stock by Category</div>
    <div style="display:grid;gap:6px">
      ${(s.stock_summary||[]).slice(0,8).map(st=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${st.category}</div>
          <div style="font-size:10px;color:var(--text3)">${st.skus} SKUs${st.dead_skus>0?` · <span style="color:#ef4444">${st.dead_skus} dead</span>`:''}</div>
        </div>
        <div style="font-size:12px;font-weight:700;color:${st.stock_value_lakhs>2?'var(--gold)':'var(--text2)'}">₹${st.stock_value_lakhs}L</div>
        <button onclick="biViewStock('${st.category}')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:5px 8px">View</button>
      </div>`).join('')}
    </div>
  </div>

  <!-- COMPETITORS -->
  <div class="mkt-card">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🔍 Competitors</div>
    ${(s.competitors||[]).length ? s.competitors.map(name=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px;margin-bottom:6px">
      <div style="flex:1;font-size:12px;font-weight:700">${name}</div>
      <button onclick="mktNav('competitors')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:6px 10px">🔍 Analyse</button>
    </div>`).join('') : `
    <div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">
      <button onclick="mktNav('competitors')" class="mkt-btn mkt-btn-ghost" style="margin-top:8px;font-size:11px">Add Competitors</button>
    </div>`}
  </div>`);
}

// ── SEE WHO — customer list sheet ──
async function biViewCustomers(stage, nextBuy) {
  biOpenSheet(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:14px;font-weight:900">${stage.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</div>
        <div style="font-size:11px;color:var(--text3)">Ready to buy: ${nextBuy}</div>
      </div>
      <button onclick="biCloseSheet()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text1);font-size:16px;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    <div id="bi-clist">Loading…</div>`);

  const { data: customers } = await sb.from('customers')
    .select('id,name,phone,last_visit,total_spend')
    .eq('construction_stage', stage)
    .not('phone','is',null)
    .order('last_visit',{ascending:false})
    .limit(50)
    .then(r=>r,()=>({data:[]}));

  const el = document.getElementById('bi-clist');
  if (!el) return;
  if (!customers?.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">No customers found</div>'; return; }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:11px;color:var(--text3)">${customers.length} customers</div>
      <button onclick="biWhatsAppCompose('${stage}','${nextBuy}',${customers.length})"
        class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">💬 WhatsApp All ${customers.length}</button>
    </div>
    <div style="display:grid;gap:6px">
      ${customers.map(c=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${c.name||'Unknown'}</div>
          <div style="font-size:10px;color:var(--text3)">
            ${c.phone} · Last: ${c.last_visit?new Date(c.last_visit).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'?'} · ₹${Math.round((c.total_spend||0)/1000)}K
          </div>
        </div>
        <a href="https://wa.me/91${c.phone}" target="_blank"
          style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;text-decoration:none;font-size:16px">💬</a>
      </div>`).join('')}
    </div>`;
}

// ── WHATSAPP COMPOSE — in-sheet compose + send ──
async function biWhatsAppCompose(stage, category, count) {
  const TEMPLATES = [
    { name:'vwholesale_offer_alert',       label:'Special Offer',        vars:['customer name','offer details','valid till date'] },
    { name:'vwholesale_welcome',           label:'Welcome / Introduction', vars:['customer name'] },
    { name:'vwholesale_festival_greeting', label:'Festival Greeting',    vars:['festival name','customer name'] },
    { name:'vwholesale_feedback_request',  label:'Feedback / Review Request', vars:['customer name','product purchased'] },
  ];

  const stageLabel = stage ? stage.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase()) : '';

  biOpenSheet(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:14px;font-weight:900">💬 WhatsApp Campaign</div>
        <div style="font-size:11px;color:var(--text3)">${stageLabel||category} · ~${count} recipients</div>
      </div>
      <button onclick="biCloseSheet()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text1);font-size:16px;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>

    <!-- Template pick -->
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">CHOOSE TEMPLATE</div>
      <div style="display:grid;gap:6px" id="wa-template-list">
        ${TEMPLATES.map(t=>`
        <button onclick="biSelectTemplate('${t.name}','${t.label}','${t.vars.join('|')}')"
          id="tpl-${t.name}"
          style="text-align:left;padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text1);font-size:12px;cursor:pointer">
          <div style="font-weight:700">${t.label}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">Variables: ${t.vars.join(', ')}</div>
        </button>`).join('')}
      </div>
    </div>

    <!-- Variable fill -->
    <div id="wa-vars-section" style="display:none;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">FILL IN DETAILS</div>
      <div id="wa-vars-inputs"></div>
    </div>

    <!-- Audience -->
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">AUDIENCE</div>
      <select id="wa-audience-select" class="mkt-form-input" style="font-size:12px">
        ${stage ? `<option value="${stage}">Customers at ${stageLabel} stage (~${count} people)</option>` : ''}
        <option value="active_60d">Active last 60 days</option>
        <option value="all_with_phone">All customers with phone</option>
      </select>
    </div>

    <div id="wa-send-section" style="display:none">
      <div id="wa-preview-box" style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:12px;font-size:12px;color:var(--text2);line-height:1.7;border-left:3px solid #22c55e"></div>
      <button onclick="biSendWhatsApp('${stage}','${category}')"
        id="wa-send-btn" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-size:13px;font-weight:700">
        💬 Send to <span id="wa-recipient-count">?</span> customers
      </button>
    </div>
    <div id="wa-send-log" style="margin-top:10px;font-size:11px;font-family:monospace;max-height:140px;overflow-y:auto"></div>`);

  // Auto-select first template
  setTimeout(() => biSelectTemplate(TEMPLATES[0].name, TEMPLATES[0].label, TEMPLATES[0].vars.join('|')), 100);
}

window._biSelectedTemplate = null;
window._biTemplateVars = {};

function biSelectTemplate(name, label, varsStr) {
  window._biSelectedTemplate = name;
  window._biTemplateVars = {};

  // Highlight selected
  document.querySelectorAll('[id^="tpl-"]').forEach(b => {
    b.style.background = 'var(--bg3)'; b.style.borderColor = 'var(--border)';
  });
  const sel = document.getElementById('tpl-' + name);
  if (sel) { sel.style.background = 'rgba(201,168,76,.12)'; sel.style.borderColor = 'var(--gold)'; }

  // Show variable inputs
  const vars = varsStr.split('|');
  const varsSection = document.getElementById('wa-vars-section');
  const varsInputs = document.getElementById('wa-vars-inputs');
  if (varsSection && varsInputs) {
    varsSection.style.display = 'block';
    varsInputs.innerHTML = vars.map((v,i) => `
      <div style="margin-bottom:8px">
        <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">${v.toUpperCase()}</label>
        <input id="wa-var-${i}" class="mkt-form-input" placeholder="${v === 'customer name' ? 'Will be auto-filled per customer' : 'e.g. '+v}"
          style="font-size:12px" oninput="biUpdateWAPreview()" ${v==='customer name'?'disabled value="[Customer Name]"':''}>
      </div>`).join('');
    window._biVarNames = vars;
    biUpdateWAPreview();
  }
}
window.biSelectTemplate = biSelectTemplate;

function biUpdateWAPreview() {
  const vars = window._biVarNames || [];
  const values = vars.map((v,i) => {
    const el = document.getElementById('wa-var-'+i);
    return el?.value || v;
  });

  const preview = document.getElementById('wa-preview-box');
  const sendSection = document.getElementById('wa-send-section');
  const audienceEl = document.getElementById('wa-audience-select');

  if (preview) {
    preview.innerHTML = `<b style="color:var(--gold)">Template:</b> ${window._biSelectedTemplate}<br><b style="color:var(--gold)">Variables:</b> ${values.join(' · ')}<br><b style="color:var(--gold)">Audience:</b> ${audienceEl?.options[audienceEl?.selectedIndex]?.text || '?'}`;
  }
  if (sendSection) sendSection.style.display = 'block';

  // Estimate count
  const countEl = document.getElementById('wa-recipient-count');
  if (countEl && audienceEl) {
    const opt = audienceEl.value;
    if (opt === 'all_with_phone') countEl.textContent = _biData?.customers?.reachable || '?';
    else if (opt === 'active_60d') countEl.textContent = _biData?.customers?.active_60d || '?';
    else countEl.textContent = _biData?.customer_pipeline?.find(p=>p.stage===opt)?.reachable || '?';
  }
}
window.biUpdateWAPreview = biUpdateWAPreview;

async function biSendWhatsApp(stage, category) {
  const btn = document.getElementById('wa-send-btn');
  const log = document.getElementById('wa-send-log');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Fetching customers…'; }

  const waLog = (msg, col) => {
    if (log) { log.innerHTML += `<div style="color:${col||'var(--text3)'}">${msg}</div>`; log.scrollTop = log.scrollHeight; }
  };

  try {
    const audienceEl = document.getElementById('wa-audience-select');
    const audience = audienceEl?.value || stage;
    const vars = (window._biVarNames||[]).map((v,i)=>{
      const el = document.getElementById('wa-var-'+i);
      return el?.disabled ? null : (el?.value||v);
    });

    // Fetch target customers
    let query = sb.from('customers').select('id,name,phone').not('phone','is',null).limit(200);
    if (audience === 'active_60d') {
      query = query.gte('last_visit', new Date(Date.now()-60*86400000).toISOString());
    } else if (audience !== 'all_with_phone') {
      query = query.eq('construction_stage', audience);
    }
    const { data: customers } = await query.then(r=>r,()=>({data:[]}));

    if (!customers?.length) { waLog('No customers found for this audience', '#f59e0b'); return; }
    waLog(`Sending to ${customers.length} customers…`);

    let sent = 0, failed = 0;
    for (const c of customers) {
      // Build body_values — replace null (customer name) with actual name
      const bodyVals = (window._biVarNames||[]).map((v,i) => {
        if (v === 'customer name') return c.name?.split(' ')[0] || 'Customer';
        const el = document.getElementById('wa-var-'+i);
        return el?.value || v;
      });

      const r = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body:JSON.stringify({
          action:'send_template',
          phone: c.phone,
          template_name: window._biSelectedTemplate,
          body_values: bodyVals,
          language_code: window._biSelectedTemplate === 'hello_world' ? 'en_US' : 'en'
        })
      }).then(r=>r.json()).catch(()=>({ok:false,error:'Network error'}));

      if (r.ok) sent++;
      else { failed++; waLog(`⚠️ ${c.name}: ${r.error||'failed'}`, '#f59e0b'); }

      if (btn) btn.textContent = `⏳ ${sent+failed}/${customers.length}…`;
    }

    waLog(`✅ Done — ${sent} sent · ${failed} failed`, '#22c55e');
    if (btn) { btn.textContent = `✅ Sent to ${sent} customers`; }

  } catch (e) {
    waLog('❌ ' + e.message, '#ef4444');
    if (btn) { btn.disabled = false; btn.textContent = '💬 Send'; }
  }
}
window.biSendWhatsApp = biSendWhatsApp;

// ── CREATE CONTENT ──
function biCreateContent(stage, category) {
  biCloseSheet();
  mktNav('content');
  setTimeout(() => {
    const topicEl = document.getElementById('cs-topic-input') || document.querySelector('[id*="topic"]');
    if (topicEl) {
      topicEl.value = stage
        ? `${category} — for customers at ${stage.replace(/_/g,' ')} stage`
        : `${category} — Why V Wholesale is your best choice in Vijayawada`;
      topicEl.dispatchEvent(new Event('input'));
    }
    showMktToast(`✍️ Content Studio ready for ${category}`);
  }, 600);
}
window.biCreateContent = biCreateContent;

// ── STOCK VIEW ──
async function biViewStock(category) {
  biOpenSheet(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:14px;font-weight:900">📦 ${category} — Stock</div>
      <button onclick="biCloseSheet()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text1);font-size:16px;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    <div id="bi-slist">Loading…</div>`);

  const { data: products } = await sb.from('products')
    .select('name,brand,stock,price,cost_price,dead_stock_flag')
    .ilike('category','%'+category+'%')
    .order('stock',{ascending:false})
    .limit(30)
    .then(r=>r,()=>({data:[]}));

  const el = document.getElementById('bi-slist');
  if (!el) return;
  if (!products?.length) { el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text3)">No products found</div>'; return; }

  const totalVal = products.reduce((s,p)=>s+(Number(p.stock||0)*Number(p.cost_price||p.price||0)),0);
  el.innerHTML = `
    <div style="background:rgba(201,168,76,.08);border-radius:8px;padding:10px;margin-bottom:10px;font-size:12px">
      ${products.length} SKUs · Stock value: <b style="color:var(--gold)">₹${Math.round(totalVal/1000)}K</b>
    </div>
    <div style="display:grid;gap:6px">
      ${products.map(p=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px${p.dead_stock_flag?';border-left:3px solid #ef4444':''}">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${p.name}</div>
          <div style="font-size:10px;color:var(--text3)">${p.brand||''} · ₹${p.price||0}/unit${p.dead_stock_flag?' · <span style="color:#ef4444">Dead stock</span>':''}</div>
        </div>
        <div style="text-align:right;min-width:40px">
          <div style="font-size:15px;font-weight:900;color:${Number(p.stock)>10?'#22c55e':Number(p.stock)>0?'#f59e0b':'#ef4444'}">${p.stock||0}</div>
          <div style="font-size:9px;color:var(--text3)">units</div>
        </div>
      </div>`).join('')}
    </div>`;
}
window.biViewStock = biViewStock;

window.renderBI = renderBI;
window.biWhatsAppCompose = biWhatsAppCompose;
window.biViewCustomers = biViewCustomers;
