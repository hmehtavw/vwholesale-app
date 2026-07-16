// ── BUSINESS INTELLIGENCE DASHBOARD — V Wholesale ──
// Full BI page with actionable signals, not just display numbers

let _biData = null; // cached snapshot

async function renderBI() {
  setContent(`
    <div style="text-align:center;padding:40px;color:var(--text3)">
      <div style="font-size:32px;margin-bottom:12px">📊</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">Loading Business Intelligence…</div>
      <div style="font-size:12px">Pulling revenue, pipeline, stock and field data</div>
    </div>`);

  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/business-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY }
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

  <!-- REVENUE TREND -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">💰 Revenue Snapshot</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
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
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Month-on-month</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:var(--bg3);border-radius:8px;padding:10px">
        <div style="font-size:10px;color:var(--text3);margin-bottom:3px">ACTIVE CUSTOMERS (60 days)</div>
        <div style="font-size:18px;font-weight:900;color:var(--gold)">${s.customers.active_60d}</div>
        <div style="font-size:10px;color:var(--text3)">of ${s.customers.total} total</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:10px">
        <div style="font-size:10px;color:var(--text3);margin-bottom:3px">REACHABLE (have phone)</div>
        <div style="font-size:18px;font-weight:900;color:#22c55e">${s.customers.reachable}</div>
        <div style="font-size:10px;color:var(--text3)">can be contacted</div>
      </div>
    </div>
  </div>

  <!-- PIPELINE OPPORTUNITIES — ACTIONABLE -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🔥 Pipeline — Who's Ready to Buy</div>
    <div style="display:grid;gap:10px">
      ${(s.customer_pipeline || []).filter(p => p.reachable >= 3).map(p => `
      <div style="background:var(--bg3);border-radius:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:13px;font-weight:700">${p.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">
              <span style="color:var(--gold);font-weight:700">${p.reachable}</span> reachable · 
              <span style="color:#22c55e">${p.active_30d}</span> active this month · 
              ${p.total} total
            </div>
          </div>
          <div style="background:rgba(201,168,76,.15);border-radius:8px;padding:6px 10px;text-align:center;min-width:60px">
            <div style="font-size:18px;font-weight:900;color:var(--gold)">${p.reachable}</div>
            <div style="font-size:9px;color:var(--text3)">reachable</div>
          </div>
        </div>
        <div style="background:rgba(37,99,235,.08);border-radius:8px;padding:8px;margin-bottom:10px;border-left:3px solid #3b82f6">
          <div style="font-size:11px;color:var(--text2)">→ Next purchase: <b style="color:#60a5fa">${p.next_buy}</b></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          <button onclick="biViewCustomers('${p.stage}','${p.next_buy}')" 
            class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:8px 6px;text-align:center">
            👥 See Who
          </button>
          <button onclick="biWhatsAppSegment('${p.stage}','${p.next_buy}',${p.reachable})" 
            class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:8px 6px;text-align:center;color:#22c55e;border-color:#22c55e">
            💬 WhatsApp
          </button>
          <button onclick="biCreateContent('${p.stage}','${p.next_buy}')" 
            class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:8px 6px;text-align:center">
            ✍️ Create Post
          </button>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- TOP SELLERS -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🏆 What's Selling (Last 12 Months)</div>
    <div style="display:grid;gap:8px">
      ${(s.top_categories || []).slice(0, 8).map((c, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="min-width:24px;font-size:13px;font-weight:900;color:${i < 3 ? 'var(--gold)' : 'var(--text3)'}">#${i + 1}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${c.category}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px">${c.stage?.replace(/_/g,' ')} stage · ${c.unique_customers} customers · ${c.transactions} transactions</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:900;color:var(--gold)">₹${c.revenue_lakhs}L</div>
          <div style="font-size:9px;color:var(--text3)">revenue</div>
        </div>
        <button onclick="biCreateContent('${c.stage}','${c.category}')"
          class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:5px 8px;flex-shrink:0">
          ✍️ Post
        </button>
      </div>`).join('')}
    </div>
  </div>

  <!-- SLOW MOVERS — PUSH THESE -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:4px">⚠️ Needs a Push — Low Sales Categories</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">These categories have stock but low sales — content can help move them</div>
    <div style="display:grid;gap:8px">
      ${(s.slow_movers || []).slice(0, 5).map(cat => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(245,158,11,.06);border-radius:8px;border-left:3px solid #f59e0b">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${cat}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">Low visibility — needs content attention</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="biViewStock('${cat}')"
            class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:6px 8px">
            📦 Stock
          </button>
          <button onclick="biWhatsAppCategory('${cat}')"
            class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:6px 8px;color:#22c55e;border-color:#22c55e">
            💬 WA
          </button>
          <button onclick="biCreateContent(null,'${cat}')"
            class="mkt-btn mkt-btn-primary" style="font-size:10px;padding:6px 8px">
            ✍️ Post
          </button>
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
        <div style="font-size:10px;color:var(--text3)">Sites with valid contact</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:900;color:#22c55e">${s.customers.reachable}</div>
        <div style="font-size:10px;color:var(--text3)">Converted to customers</div>
      </div>
    </div>
    <div style="display:grid;gap:6px">
      ${Object.entries(s.field_intelligence.by_stage || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([stage, count]) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
        </div>
        <div style="font-size:13px;font-weight:900;color:var(--gold);min-width:40px;text-align:right">${count}</div>
        <div style="width:80px;height:6px;background:var(--border);border-radius:3px">
          <div style="height:6px;background:var(--gold);border-radius:3px;width:${Math.round(count / s.field_intelligence.total_visits * 100 * 5)}%;max-width:100%"></div>
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- STOCK SUMMARY -->
  <div class="mkt-card" style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">📦 Stock by Category</div>
    <div style="display:grid;gap:6px">
      ${(s.stock_summary || []).slice(0, 8).map(st => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${st.category}</div>
          <div style="font-size:10px;color:var(--text3)">${st.skus} SKUs${st.dead_skus > 0 ? ` · <span style="color:#ef4444">${st.dead_skus} dead stock</span>` : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;font-weight:700;color:${st.stock_value_lakhs > 2 ? 'var(--gold)' : 'var(--text2)'}">₹${st.stock_value_lakhs}L</div>
          <div style="font-size:9px;color:var(--text3)">value</div>
        </div>
        <button onclick="biViewStock('${st.category}')"
          class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:5px 8px;flex-shrink:0">
          View
        </button>
      </div>`).join('')}
    </div>
  </div>

  <!-- COMPETITOR TRACKER -->
  <div class="mkt-card">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🔍 Competitor Tracking</div>
    ${(s.competitors || []).length ? `
    <div style="display:grid;gap:8px">
      ${s.competitors.map(name => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${name}</div>
          <div style="font-size:10px;color:var(--text3)">Vijayawada competitor</div>
        </div>
        <button onclick="mktNav('competitors')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:6px 10px">
          🔍 Analyse
        </button>
      </div>`).join('')}
    </div>` : `
    <div style="text-align:center;padding:20px;color:var(--text3)">
      <div style="font-size:24px;margin-bottom:6px">🔍</div>
      <div style="font-size:12px">No competitors tracked yet</div>
      <button onclick="mktNav('competitors')" class="mkt-btn mkt-btn-ghost" style="margin-top:10px;font-size:11px">Add Competitors</button>
    </div>`}
  </div>`);
}

// ── ACTION HANDLERS ──

async function biViewCustomers(stage, nextBuy) {
  // Show customer list in a bottom sheet
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--bg2);border-radius:16px 16px 0 0;z-index:9999;max-height:80vh;overflow-y:auto;padding:20px;border-top:1px solid var(--border)';
  sheet.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:14px;font-weight:900">${stage.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())} Stage Customers</div>
        <div style="font-size:11px;color:var(--text3)">Ready to buy: ${nextBuy}</div>
      </div>
      <button onclick="this.closest('div[style]').remove();document.getElementById('bi-overlay').remove()" 
        style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
    </div>
    <div id="bi-customer-list" style="font-size:12px;color:var(--text3)">Loading…</div>`;

  const overlay = document.createElement('div');
  overlay.id = 'bi-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9998';
  overlay.onclick = () => { sheet.remove(); overlay.remove(); };

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  // Fetch customers at this stage
  const { data: customers } = await sb.from('customers')
    .select('id,name,phone,last_visit,total_spend,construction_stage')
    .eq('construction_stage', stage)
    .not('phone', 'is', null)
    .order('last_visit', { ascending: false })
    .limit(50)
    .then(r => r, () => ({ data: [] }));

  const list = document.getElementById('bi-customer-list');
  if (!customers?.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">No customers found at this stage</div>';
    return;
  }

  list.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:11px;color:var(--text3)">${customers.length} customers</div>
      <button onclick="biWhatsAppSegment('${stage}','${nextBuy}',${customers.filter(c=>c.phone).length})" 
        class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">💬 WhatsApp All</button>
    </div>
    <div style="display:grid;gap:6px">
      ${customers.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${c.name || 'Unknown'}</div>
          <div style="font-size:10px;color:var(--text3)">
            ${c.phone || 'No phone'} · 
            Last: ${c.last_visit ? new Date(c.last_visit).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '?'} · 
            ₹${Math.round((c.total_spend||0)/1000)}K spent
          </div>
        </div>
        ${c.phone ? `
        <a href="https://wa.me/91${c.phone}?text=Hi%20${encodeURIComponent(c.name?.split(' ')[0]||'')}" 
          target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:5px 8px;text-decoration:none">
          💬
        </a>` : ''}
      </div>`).join('')}
    </div>`;
}

function biWhatsAppSegment(stage, nextBuy, count) {
  // Navigate to WhatsApp page with pre-filled segment
  mktNav('whatsapp');
  setTimeout(() => {
    showMktToast(`💬 WhatsApp targeting ${count} ${stage.replace(/_/g,' ')} customers → ${nextBuy}`);
    // Pre-fill segment if WhatsApp page has that UI
    const segEl = document.getElementById('wa-segment-filter');
    if (segEl) segEl.value = stage;
  }, 500);
}

function biWhatsAppCategory(category) {
  mktNav('whatsapp');
  setTimeout(() => {
    showMktToast(`💬 WhatsApp campaign for ${category} — select your audience`);
  }, 500);
}

async function biCreateContent(stage, category) {
  // Navigate to content studio with pre-filled context
  mktNav('content');
  setTimeout(() => {
    const topicEl = document.getElementById('cs-topic-input') || document.getElementById('content-topic');
    if (topicEl) {
      topicEl.value = stage
        ? `${category} — for customers at ${stage.replace(/_/g,' ')} stage`
        : `${category} — Why V Wholesale is your best choice`;
      topicEl.dispatchEvent(new Event('input'));
    }
    showMktToast(`✍️ Creating content for ${category}${stage ? ' → '+stage.replace(/_/g,' ') : ''}`);
  }, 600);
}

async function biViewStock(category) {
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--bg2);border-radius:16px 16px 0 0;z-index:9999;max-height:80vh;overflow-y:auto;padding:20px;border-top:1px solid var(--border)';
  sheet.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:14px;font-weight:900">📦 ${category} — Stock</div>
      <button onclick="this.closest('div[style]').remove();document.getElementById('bi-overlay').remove()"
        style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
    </div>
    <div id="bi-stock-list" style="font-size:12px;color:var(--text3)">Loading…</div>`;

  const overlay = document.createElement('div');
  overlay.id = 'bi-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9998';
  overlay.onclick = () => { sheet.remove(); overlay.remove(); };
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  const { data: products } = await sb.from('products')
    .select('name,brand,stock,price,cost_price,dead_stock_flag,last_grn')
    .ilike('category', `%${category}%`)
    .order('stock', { ascending: false })
    .limit(30)
    .then(r => r, () => ({ data: [] }));

  const list = document.getElementById('bi-stock-list');
  if (!products?.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">No products found</div>';
    return;
  }

  const totalValue = products.reduce((sum, p) => sum + (Number(p.stock||0) * Number(p.cost_price||p.price||0)), 0);

  list.innerHTML = `
    <div style="background:rgba(201,168,76,.08);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px">
      <b>${products.length}</b> SKUs · Total stock value: <b style="color:var(--gold)">₹${Math.round(totalValue/1000)}K</b>
    </div>
    <div style="display:grid;gap:6px">
      ${products.map(p => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border-radius:8px;${p.dead_stock_flag ? 'border-left:3px solid #ef4444' : ''}">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${p.name}</div>
          <div style="font-size:10px;color:var(--text3)">
            ${p.brand || ''} · ₹${p.price||0}/unit
            ${p.dead_stock_flag ? ' · <span style="color:#ef4444">Dead stock</span>' : ''}
          </div>
        </div>
        <div style="text-align:right;min-width:50px">
          <div style="font-size:14px;font-weight:900;color:${Number(p.stock)>10?'#22c55e':Number(p.stock)>0?'#f59e0b':'#ef4444'}">${p.stock||0}</div>
          <div style="font-size:9px;color:var(--text3)">units</div>
        </div>
      </div>`).join('')}
    </div>`;
}

window.renderBI = renderBI;
window.biViewCustomers = biViewCustomers;
window.biWhatsAppSegment = biWhatsAppSegment;
window.biWhatsAppCategory = biWhatsAppCategory;
window.biCreateContent = biCreateContent;
window.biViewStock = biViewStock;
