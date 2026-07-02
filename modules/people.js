/* === crm.js === */

const STAGES = ['Lead','Visited','Quoted','Negotiating','Won','Lost'];
const STAGE_COLORS = { Lead:'#888', Visited:'#378ADD', Quoted:'#EF9F27', Negotiating:'#7F77DD', Won:'#22c55e', Lost:'#ef4444' };

// ---------- SHARED CUSTOMER PHONE LOOKUP ----------
// Used across New Quotation, New Invoice/Billing, and Visit entry: typing
// a 10-digit phone number that matches an existing customer auto-fills
// their known details, so the same person never has to be re-typed from
// scratch. Each context maps to a different set of field IDs to fill,
// since the three forms don't share identical field names.
const CUSTOMER_LOOKUP_FIELD_MAPS = {
  quote: { name: 'q-name', address: 'q-address', area: 'q-area' },
  invoice: { name: 'inv-cust-name', address: 'inv-cust-address', area: 'inv-cust-area' },
  visit: { name: 'visit-cust-name', address: 'visit-cust-address', area: 'visit-cust-area', type: 'ci-type' }
};

let customerLookupDebounce = null;

function lookupCustomerByPhone(phoneValue, context) {
  clearTimeout(customerLookupDebounce);
  const statusEl = document.getElementById(`${context}-customer-lookup-status`);
  const digits = (phoneValue || '').replace(/\D/g, '').slice(-10);

  if (digits.length < 10) {
    if (statusEl) statusEl.innerHTML = '';
    return;
  }

  customerLookupDebounce = setTimeout(async () => {
    const customers = await VW_DB.all(VW_DB.STORES.customers);
    const match = customers.find(c => (c.phone || '').replace(/\D/g, '').slice(-10) === digits);
    const fields = CUSTOMER_LOOKUP_FIELD_MAPS[context];

    if (match) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✓ Found: ${match.name} — details filled in below</span>`;
      if (fields) {
        const nameEl = document.getElementById(fields.name);
        const addrEl = document.getElementById(fields.address);
        const areaEl = document.getElementById(fields.area);
        const typeEl = fields.type ? document.getElementById(fields.type) : null;
        if (nameEl && !nameEl.value) nameEl.value = match.name || '';
        if (addrEl && !addrEl.value) addrEl.value = match.address || '';
        if (areaEl && !areaEl.value) areaEl.value = match.city || '';
        if (typeEl && match.type) typeEl.value = match.type;
      }
    } else {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--text3)">New customer — fill in their details below</span>`;
    }
  }, 400); // small debounce so it doesn't look up on every single keystroke
}
window.lookupCustomerByPhone = lookupCustomerByPhone;

async function renderCRM() {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const leads = await VW_DB.all(VW_DB.STORES.leads);
  const today = new Date();
  const dueFollowups = leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost' && l.followUpDate && new Date(l.followUpDate) <= today);
  const repurchaseDue = customers.filter(c => {
    if (!c.lastVisit) return false;
    const days = (today - new Date(c.lastVisit)) / 86400000;
    return days >= 30;
  });

  return `
  <div class="module-header">
    <h2>CRM & Sales</h2>
    <button class="btn-sm" onclick="showAddCustomer()">+ Customer</button>
  </div>

  <!-- CRM STATS HERO -->
  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card gold">
      <div class="mc-label">Total Customers</div>
      <div class="mc-value">${customers.length}</div>
    </div>
    <div class="metric-card ${dueFollowups.length?'danger':''}">
      <div class="mc-label">Follow-ups Due</div>
      <div class="mc-value">${dueFollowups.length}</div>
    </div>
    <div class="metric-card ${repurchaseDue.length>5?'danger':''}">
      <div class="mc-label">Re-engage</div>
      <div class="mc-value">${repurchaseDue.length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Pipeline</div>
      <div class="mc-value">${leads.filter(l=>l.stage!=='Won'&&l.stage!=='Lost').length}</div>
    </div>
  </div>

  ${dueFollowups.length ? `
  <div class="alert-card" style="margin-bottom:12px">
    <div class="alert-title">⏰ ${dueFollowups.length} Follow-up${dueFollowups.length>1?'s':''} Due Today</div>
    ${await renderFollowupAlerts(dueFollowups)}
  </div>` : ''}

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Customers</h3>
      <button class="btn-sm" onclick="showAddLead()">+ Lead</button>
    </div>
    <div class="search-row">
      <input type="text" id="cust-search" placeholder="🔍 Search name or phone..." oninput="searchCustomers(this.value)">
    </div>
    <div id="customer-list" class="customer-list">
      ${await renderCustomerList(customers)}
    </div>
  </div>

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Sales Pipeline</h3>
      <button class="btn-sm" onclick="showAddLead()">+ Lead</button>
    </div>
    <div class="pipeline-scroll">
      ${await renderPipeline(leads, customers)}
    </div>
  </div>

  ${repurchaseDue.length ? `
  <div class="card">
    <h3 class="card-title">🔔 Re-engage (30+ days silent)</h3>
    <div id="repurchase-list">
      ${renderRepurchaseList(repurchaseDue)}
    </div>
  </div>` : ''}

  <div id="add-customer-form" class="inline-form" style="display:none">
    <h3 class="card-title">Add Customer</h3>
    <input type="text" id="new-cust-name" placeholder="Name *">
    <input type="tel" id="new-cust-phone" placeholder="Phone *" maxlength="10">
    <input type="text" id="new-cust-city" placeholder="City">
    <label style="font-size:12px;color:var(--text3);margin-top:4px;display:block">Date of Birth (for birthday wishes)</label>
    <input type="date" id="new-cust-dob">
    <select id="new-cust-type">
      <option value="retail">Retail</option>
      <option value="b2b_pro">B2B Professional</option>
      <option value="b2b_shop">B2B Shop</option>
      <option value="contractor_club">Contractor Club</option>
    </select>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-primary" onclick="saveNewCustomer()">Save</button>
      <button class="btn-secondary" onclick="hideAddCustomer()">Cancel</button>
    </div>
  </div>
  `;
}

async function renderCustomerList(customers, search = '') {
  let list = search ? customers.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)) : customers;
  list = list.slice(-50).reverse();
  if (!list.length) return '<p class="empty-msg">No customers yet</p>';
  return list.map(c => {
    const daysSince = c.lastVisit ? Math.floor((new Date() - new Date(c.lastVisit)) / 86400000) : null;
    const typeLabel = { retail:'Retail', b2b_pro:'B2B Pro', b2b_shop:'B2B Shop', contractor_club:'Contractor' }[c.type] || c.type;
    const lastSeenColor = daysSince === null ? '#888' : daysSince === 0 ? '#22c55e' : daysSince <= 30 ? '#22c55e' : daysSince <= 90 ? 'var(--gold)' : 'var(--red)';
    const lastSeenLabel = daysSince === null ? 'New' : daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : daysSince + 'd ago';
    return `
    <div class="cust-row" onclick="openCustomer(${c.id})">
      <div class="cust-avatar">${(c.name||'?')[0].toUpperCase()}</div>
      <div class="cust-info">
        <div class="cust-name">${c.name}</div>
        <div class="cust-meta">${c.phone||'—'} · ${typeLabel} · ${c.visitCount || 1} visit${(c.visitCount||1) > 1 ? 's' : ''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:600;color:${lastSeenColor}">${lastSeenLabel}</div>
        ${c.totalSpend ? `<div style="font-size:10px;color:var(--text3)">₹${Math.round((c.totalSpend||0)/1000)}K</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function searchCustomers(val) {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  document.getElementById('customer-list').innerHTML = await renderCustomerList(customers, val);
}

async function renderPipeline(leads, customers) {
  const custMap = {};
  customers.forEach(c => custMap[c.id] = c);
  if (!leads.length) return '<p class="empty-msg">No leads yet — add from the button above</p>';
  return STAGES.filter(s => s !== 'Lost').map(stage => {
    const stageleads = leads.filter(l => l.stage === stage);
    return `
    <div class="pipeline-col">
      <div class="pipeline-header" style="color:${STAGE_COLORS[stage]}">${stage} <span class="badge">${stageleads.length}</span></div>
      ${stageleads.map(l => `
        <div class="pipeline-card" onclick="openLead(${l.id})">
          <div class="pc-name">${custMap[l.customerId]?.name || 'Unknown'}</div>
          <div class="pc-dept">${l.department || ''}</div>
          <div class="pc-val">${l.value ? '₹' + Number(l.value).toLocaleString('en-IN') : ''}</div>
          ${l.followUpDate ? `<div class="pc-date">📅 ${new Date(l.followUpDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>` : ''}
        </div>`).join('') || '<div style="font-size:12px;color:var(--text3);padding:8px">Empty</div>'}
    </div>`;
  }).join('');
}

async function renderFollowupAlerts(leads) {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const custMap = {};
  customers.forEach(c => custMap[c.id] = c);
  return leads.slice(0,5).map(l => {
    const c = custMap[l.customerId] || {};
    return `
    <div class="followup-row">
      <div class="fu-info"><div class="fu-name">${c.name || 'Unknown'}</div><div class="fu-dept">${l.department || ''} · ${l.stage}</div></div>
      <button class="btn-wa-sm" onclick="openWhatsApp('${c.phone}','${c.name}')">💬 WhatsApp</button>
    </div>`;
  }).join('');
}

function renderRepurchaseList(customers) {
  if (!customers.length) return '<p class="empty-msg">No customers due for re-engagement</p>';
  return customers.slice(0,20).map(c => {
    const days = Math.floor((new Date() - new Date(c.lastVisit)) / 86400000);
    return `
    <div class="cust-row">
      <div class="cust-avatar">${(c.name||'?')[0].toUpperCase()}</div>
      <div class="cust-info"><div class="cust-name">${c.name}</div><div class="cust-meta">${c.phone} · Last seen ${days} days ago</div></div>
      <button class="btn-wa-sm" onclick="sendFollowupReminder('${c.phone}','${(c.name||'').replace(/'/g,"\\'")}',${days})">💬</button>
    </div>`;
  }).join('');
}

function sendFollowupReminder(phone, name, days) {
  const msg = VW_NOTIFY.waEncode(VW_NOTIFY.bilingual(
    `Hello ${name}! It's been ${days} days since your last visit to V Wholesale, Vijayawada. We have new arrivals and offers waiting for you — do visit us again for your home needs! 🏠`,
    `నమస్కారం ${name}! వీ హోల్‌సేల్‌ను సందర్శించి ${days} రోజులు అయింది. మా వద్ద కొత్త వస్తువులు మరియు ఆఫర్లు ఉన్నాయి — మీ ఇంటి అవసరాల కోసం మరోసారి సందర్శించండి! 🏠`
  ));
  window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
}

async function openCustomer(id) {
  const c = await VW_DB.getById(VW_DB.STORES.customers, id);
  const visits = await VW_DB.getByIndex(VW_DB.STORES.visits, 'customerId', id);
  const invoices = await VW_DB.getByIndex(VW_DB.STORES.invoices, 'customerId', id);
  const allTasks = await VW_DB.getByIndex(VW_DB.STORES.tasks, 'customerId', id);
  const allQuotes = await VW_DB.all(VW_DB.STORES.quotations);
  const digits = (c.phone||'').replace(/\D/g,'').slice(-10);
  const myQuotes = allQuotes.filter(q => q.customerId === id || (q.contact||'').replace(/\D/g,'').slice(-10) === digits);
  myQuotes.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  const totalSpend = invoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const lastInvoice = invoices.length ? invoices.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0] : null;
  const stageColors = { Lead:'#888', Visited:'#378ADD', Quoted:'#EF9F27', Negotiating:'#7F77DD', Won:'#22c55e', Lost:'#ef4444' };
  const quoteStatusColors = { draft:'#888', sent:'#378ADD', converted:'#22c55e' };
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-avatar-row">
      <div class="sheet-avatar">${(c.name||'?')[0].toUpperCase()}</div>
      <div><h3 style="margin:0">${c.name}</h3><p style="margin:0;font-size:13px;color:#888">${c.phone} · ${c.type || 'retail'}</p></div>
    </div>
    <div class="sheet-stats">
      <div class="sheet-stat"><span>${visits.length}</span><small>Visits</small></div>
      <div class="sheet-stat"><span>${invoices.length}</span><small>Orders</small></div>
      <div class="sheet-stat"><span>₹${Math.round(totalSpend/1000)}K</span><small>Spent</small></div>
    </div>
    <div class="sheet-actions">
      <button class="btn-primary" onclick="goToCart(${c.id},null);closeSheet()">🛒 New Bill</button>
      <button class="btn-secondary" onclick="showAddLead(${c.id});closeSheet()">➕ Add Lead</button>
      <button class="btn-wa" onclick="openWhatsApp('${c.phone}','${c.name}')">💬 WhatsApp</button>
      <button class="btn-call" onclick="callPhone('${c.phone}')">📞 Call</button>
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px;background:var(--bg2)" onclick="closeSheet();navigateTo('ledger',{customerId:${c.id}})">📒 View Full Customer Ledger</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_SERVICE.showAddWorkOrder(${c.id},'${(c.name||'').replace(/'/g,"\\'")}')">🔧 New Work Order</button>
    ${lastInvoice ? `<button class="btn-secondary full-width" style="margin-top:8px" onclick="repeatLastOrder(${c.id})">🔁 Repeat Last Order (₹${Math.round(lastInvoice.total||0).toLocaleString('en-IN')})</button>` : ''}
    ${VW_AUTH.isAdmin() ? `<button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="confirmDeleteCustomer(${c.id},'${(c.name||'').replace(/'/g,"\\'")}')">🗑 Delete Customer</button>` : ''}

    ${invoices.length ? `
    <div class="sheet-section-label">Recent Purchases (${invoices.length} total)</div>
    ${(() => {
      const sorted = invoices.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
      const daysSinceLast = lastInvoice ? Math.floor((Date.now()-new Date(lastInvoice.date))/(1000*60*60*24)) : null;
      return `
      ${daysSinceLast !== null ? `<div style="font-size:12px;color:${daysSinceLast>90?'var(--red)':daysSinceLast>30?'var(--gold)':'#22c55e'};margin-bottom:8px">
        🕐 Last purchase: ${daysSinceLast === 0 ? 'Today' : daysSinceLast === 1 ? 'Yesterday' : daysSinceLast+' days ago'}
      </div>` : ''}
      ${sorted.slice(0,5).map(inv => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div>
          <div style="font-size:13px;font-weight:600">${inv.invoiceNo||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${new Date(inv.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})} · ${(inv.items||[]).length} item${(inv.items||[]).length!==1?'s':''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">₹${(inv.total||0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px;color:${inv.creditSale?'var(--red)':'#22c55e'}">${inv.creditSale?'Credit':'Paid'}</div>
        </div>
      </div>`).join('')}
      ${sorted.length > 5 ? `<div style="font-size:12px;color:var(--text3);padding:6px 0">+ ${sorted.length-5} more — view in Ledger</div>` : ''}`;
    })()}
    ` : ''}
    ${myQuotes.length ? `
    <div class="sheet-section-label">Quotations (${myQuotes.length})</div>
    ${myQuotes.map(q => `
      <div class="task-card" onclick="openQuotationDetail(${q.id})">
        <div class="task-card-header">
          <span class="task-dept">${q.quoteNo || 'Q-'+q.id} &middot; ${new Date(q.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</span>
          <span class="task-stage" style="color:${quoteStatusColors[q.status]||'#888'}">${q.status==='converted'?'Converted':q.status==='sent'?'Sent':'Draft'}</span>
        </div>
        <div class="task-desc">${(q.items||[]).length} item${(q.items||[]).length!==1?'s':''}</div>
        <div class="task-meta">₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}</div>
      </div>`).join('')}
    ` : ''}
    ${allTasks.length ? `
    <div class="sheet-section-label">Requirement History (${allTasks.length})</div>
    ${allTasks.slice().reverse().map(t => `
      <div class="task-card" onclick="openTaskDetail(${t.id})">
        <div class="task-card-header">
          <span class="task-dept">${t.department} · ${new Date(t.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</span>
          <span class="task-stage" style="color:${stageColors[t.stage]||'#888'}">${t.stage||'Lead'}</span>
        </div>
        <div class="task-desc">${t.description || 'No description'}</div>
        <div class="task-meta">${t.qty?t.qty+' · ':''}${t.budget?'₹'+Number(t.budget).toLocaleString('en-IN'):''} ${t.assignedToName ? '· '+t.assignedToName : ''}</div>
      </div>`).join('')}
    ` : ''}
  `;
  sheet.classList.add('open'); document.getElementById('sheet-overlay').classList.add('open');
}

async function confirmDeleteCustomer(id, name) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Delete ${name}?</h3>
    <p class="sheet-meta">This permanently deletes this customer AND their visits, requirement tasks, leads, and quotations. Invoices/bills already generated are kept for your financial records, just unlinked from this customer. This cannot be undone.</p>
    <div class="sheet-actions">
      <button class="btn-secondary" style="color:var(--red)" onclick="deleteCustomerCascade(${id})">🗑 Delete Everything</button>
      <button class="btn-secondary" onclick="openCustomer(${id})">Cancel</button>
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.confirmDeleteCustomer = confirmDeleteCustomer;

async function deleteCustomerCascade(id) {
  const [visits, tasks, leads, quotes] = await Promise.all([
    VW_DB.getByIndex(VW_DB.STORES.visits, 'customerId', id),
    VW_DB.getByIndex(VW_DB.STORES.tasks, 'customerId', id),
    VW_DB.all(VW_DB.STORES.leads),
    VW_DB.all(VW_DB.STORES.quotations)
  ]);
  await Promise.all(visits.map(v => VW_DB.del(VW_DB.STORES.visits, v.id)));
  await Promise.all(tasks.map(t => VW_DB.del(VW_DB.STORES.tasks, t.id)));
  await Promise.all(leads.filter(l => l.customerId === id).map(l => VW_DB.del(VW_DB.STORES.leads, l.id)));
  await Promise.all(quotes.filter(q => q.customerId === id).map(q => VW_DB.del(VW_DB.STORES.quotations, q.id)));
  await VW_DB.del(VW_DB.STORES.customers, id);
  showToast('Customer and related records deleted', 'info');
  closeSheet();
  navigateTo('crm');
}
window.deleteCustomerCascade = deleteCustomerCascade;

function showAddCustomer() { document.getElementById('add-customer-form').style.display = 'block'; }
function hideAddCustomer() { document.getElementById('add-customer-form').style.display = 'none'; }

async function saveNewCustomer() {
  const name = document.getElementById('new-cust-name').value.trim();
  const phone = document.getElementById('new-cust-phone').value.trim();
  if (!name || !phone) return showToast('Name and phone required', 'warn');
  await VW_DB.put(VW_DB.STORES.customers, {
    name, phone,
    type: document.getElementById('new-cust-type').value,
    city: document.getElementById('new-cust-city').value,
    dateOfBirth: document.getElementById('new-cust-dob')?.value || '',
    visitCount: 0, createdAt: new Date().toISOString()
  });
  showToast('Customer saved', 'success');
  hideAddCustomer();
  navigateTo('crm');
}

async function showAddLead(customerId = null) {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const deptNames = await VW_CHECKIN.getDepartmentNames();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Lead</h3>
    <div class="form-group">
      <label>Customer</label>
      <select id="lead-cust">${customers.map(c => `<option value="${c.id}" ${c.id == customerId ? 'selected' : ''}>${c.name} (${c.phone})</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>Department</label>
      <select id="lead-dept">${deptNames.map(d => `<option>${d}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>Est. Value (₹) *</label>
      <input type="number" id="lead-val" placeholder="e.g. 50000">
    </div>
    <div class="form-group">
      <label>Stage</label>
      <select id="lead-stage">${STAGES.map(s => `<option>${s}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>Follow-up Date *</label>
      <input type="date" id="lead-date" value="${new Date(Date.now()+3*86400000).toISOString().split('T')[0]}">
    </div>
    <div class="form-group">
      <label>Notes</label>
      <input type="text" id="lead-notes" placeholder="What are they looking for?">
    </div>
    <button class="btn-primary full-width" onclick="saveLead()">Save Lead</button>
  `;
  sheet.classList.add('open'); document.getElementById('sheet-overlay').classList.add('open');
}

async function saveLead() {
  const value = document.getElementById('lead-val').value;
  const followUpDate = document.getElementById('lead-date').value;
  if (!value || parseFloat(value) <= 0) return showToast('Enter an estimated value', 'warn');
  if (!followUpDate) return showToast('Pick a follow-up date', 'warn');
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.leads, {
    customerId: parseInt(document.getElementById('lead-cust').value),
    department: document.getElementById('lead-dept').value,
    value, stage: document.getElementById('lead-stage').value,
    followUpDate, notes: document.getElementById('lead-notes').value,
    // Attribution — track who created this lead and from where
    assignedTo: profile?.id || null,
    assignedToName: profile?.name || '',
    customerName: document.getElementById('lead-cust')?.options[document.getElementById('lead-cust').selectedIndex]?.text?.split(' ·')[0] || '',
    source: profile?.role === 'executive' ? 'field_team' : 'store',
    sourceName: profile?.name || '',
    createdAt: new Date().toISOString()
  });
  showToast('Lead saved', 'success');
  closeSheet();
  navigateTo('crm');
}

async function openLead(id) {
  const lead = await VW_DB.getById(VW_DB.STORES.leads, id);
  const customer = await VW_DB.getById(VW_DB.STORES.customers, lead.customerId);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${customer?.name || 'Lead'}</h3>
    <p style="font-size:13px;color:#888">${lead.department} · ${lead.stage}</p>
    ${lead.value ? `<p style="font-size:15px;font-weight:500">Est. value: ₹${Number(lead.value).toLocaleString('en-IN')}</p>` : ''}
    ${lead.notes ? `<p style="font-size:13px">${lead.notes}</p>` : ''}
    <div class="form-group"><label>Move Stage</label>
    <select id="move-stage">${STAGES.map(s => `<option ${s===lead.stage?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="form-group"><label>Follow-up Date</label>
    <input type="date" id="move-date" value="${lead.followUpDate || ''}"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn-primary" onclick="updateLead(${id})">Update</button>
      <button class="btn-wa" onclick="openWhatsApp('${customer?.phone}','${customer?.name}')">💬 WhatsApp</button>
      ${customer?.phone ? `<button class="btn-call" onclick="callPhone('${customer.phone}')">📞</button>` : ''}
    </div>
  `;
  sheet.classList.add('open'); document.getElementById('sheet-overlay').classList.add('open');
}

async function updateLead(id) {
  const followUpDate = document.getElementById('move-date').value;
  if (!followUpDate) return showToast('Pick a follow-up date', 'warn');
  const lead = await VW_DB.getById(VW_DB.STORES.leads, id);
  lead.stage = document.getElementById('move-stage').value;
  lead.followUpDate = followUpDate;
  lead.updatedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.leads, lead);
  showToast('Lead updated', 'success');
  closeSheet();
  navigateTo('crm');
}

window.VW_CRM = { renderCRM, searchCustomers, openCustomer, showAddLead, saveLead, openLead, updateLead, showAddCustomer, saveNewCustomer };
window.sendFollowupReminder = sendFollowupReminder;




/* === contractor.js === */

// =====================================================
// CONTRACTOR PORTAL v2 — Complete B2B Module
// Features:
// - Contractor login with language selection on first activation
// - Tile measurement app inside portal
// - Margin settings (% or ₹/sqft)
// - Design catalog sharing with customer link
// - Loyalty points system (auto on non-margin products)
// - Awards section (Top Contractor in region)
// - Labor marketplace (bid using points)
// - GST/TDS payout tracking (Sec 194C)
// =====================================================

// ===== LANGUAGES =====
const CONTRACTOR_LANGS = {
  en: { name:'English', native:'English', greeting:'Welcome' },
  te: { name:'Telugu', native:'తెలుగు', greeting:'స్వాగతం' },
  hi: { name:'Hindi', native:'हिंदी', greeting:'स्वागत है' },
  bn: { name:'Bengali', native:'বাংলা', greeting:'স্বাগতম' },
  or: { name:'Odia', native:'ଓଡ଼ିଆ', greeting:'ସ୍ୱାଗତ' },
};

const PORTAL_STRINGS = {
  en: { stock:'Available Stock', myPoints:'My Points', awards:'Awards', bid:'Place Bid', measurement:'Measurement', catalog:'Catalog', labor:'Labor Bids', rewards:'Rewards Store', logout:'Logout', margin:'My Margin', share:'Share Link' },
  te: { stock:'అందుబాటులో ఉన్న స్టాక్', myPoints:'నా పాయింట్లు', awards:'అవార్డులు', bid:'బిడ్ ఇవ్వండి', measurement:'కొలత', catalog:'కేటలాగ్', labor:'లేబర్ బిడ్లు', rewards:'రివార్డ్స్', logout:'లాగ్ అవుట్', margin:'నా మార్జిన్', share:'లింక్ పంచుకోండి' },
  hi: { stock:'उपलब्ध स्टॉक', myPoints:'मेरे पॉइंट्स', awards:'पुरस्कार', bid:'बोली लगाएं', measurement:'माप', catalog:'कैटलॉग', labor:'लेबर बिड्स', rewards:'रिवॉर्ड्स', logout:'लॉग आउट', margin:'मेरा मार्जिन', share:'लिंक शेयर करें' },
  bn: { stock:'স্টক', myPoints:'আমার পয়েন্ট', awards:'পুরস্কার', bid:'বিড করুন', measurement:'পরিমাপ', catalog:'ক্যাটালগ', labor:'শ্রম বিড', rewards:'পুরস্কার', logout:'লগ আউট', margin:'আমার মার্জিন', share:'লিংক শেয়ার করুন' },
  or: { stock:'ଷ୍ଟକ', myPoints:'ମୋ ପଏଣ୍ଟ', awards:'ପୁରସ୍କାର', bid:'ବିଡ ଦିଅ', measurement:'ମାପ', catalog:'କ୍ୟାଟାଲଗ', labor:'ଶ୍ରମ ବିଡ', rewards:'ପୁରସ୍କାର', logout:'ଲଗ ଆଉଟ', margin:'ମୋ ମାର୍ଜିନ', share:'ଲିଙ୍କ ଶେୟାର' },
};

const TDS_RULES = {
  individual:{rate:1,label:'Individual/HUF'},huf:{rate:1,label:'HUF'},
  company:{rate:2,label:'Company/Firm/LLP'},firm:{rate:2,label:'Partnership Firm'},llp:{rate:2,label:'LLP'},
};
const GST_ON_COMMISSION = 18;
const TDS_SINGLE_LIMIT = 30000;
const TDS_ANNUAL_LIMIT = 100000;

// ===== CONTRACTOR PORTAL PUBLIC PAGE (?contractor=TOKEN) =====
async function renderContractorPublicPortal(token) {
  const { data: contractor } = await VW_DB.client
    .from('contractors').select('*').eq('portal_token', token).single();
  if (!contractor) return `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center">
      <div><div style="font-size:48px">🔒</div>
        <div style="font-size:16px;font-weight:700;margin-top:12px">Invalid or expired link</div>
        <div style="font-size:13px;color:var(--text3);margin-top:8px">Contact V Wholesale: 8712697930</div>
      </div>
    </div>`;

  // First time? Show language selection
  const { data: profile } = await VW_DB.client.from('contractor_profiles')
    .select('*').eq('contractor_id', contractor.id).single();

  if (!profile || !profile.first_login_done) {
    return renderContractorFirstActivation(contractor, token);
  }

  const lang = profile.language || 'en';
  const str = PORTAL_STRINGS[lang] || PORTAL_STRINGS.en;
  const { data: products } = await VW_DB.client.from('products')
    .select('id,name,brand,tile_size_mm,tile_size_label,tile_finish,coverage_per_box,tiles_per_box,mrp,stock,dead_stock_flag,purchase_date')
    .eq('category','Tiles').gt('stock',0).order('purchase_date',{ascending:true});
  const tiles = products || [];
  const margin_type = contractor.margin_type || 'percentage';
  const margin_val = contractor.margin_value || 15;
  const pts = contractor.loyalty_points || 0;

  const { data: awards } = await VW_DB.client.from('contractor_awards')
    .select('*').eq('contractor_id', contractor.id).order('created_at',{ascending:false}).limit(5);

  return `
  <div style="min-height:100vh;background:var(--bg);padding-bottom:80px">
    <!-- HEADER -->
    <div style="background:var(--header-bg);padding:16px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:50">
      <div>
        <div style="font-size:16px;font-weight:800;color:#F5C842;font-family:'Syne',sans-serif">V Wholesale</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.6)">${CONTRACTOR_LANGS[lang]?.greeting||'Welcome'}, ${contractor.name}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:700;color:#F5C842">${pts} pts</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.5)">${str.myPoints}</div>
      </div>
    </div>

    <!-- AWARDS BANNER -->
    ${(awards||[]).length ? `
    <div style="background:linear-gradient(135deg,rgba(245,200,66,0.15),rgba(245,200,66,0.05));padding:12px 16px;border-bottom:1px solid var(--gold-border)">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:4px">🏆 ${str.awards}</div>
      ${awards.map(a=>`<div style="font-size:11px;color:var(--text2)">🥇 ${a.award_type?.replace(/_/g,' ')} — ${a.period}</div>`).join('')}
    </div>` : ''}

    <!-- NAV TABS -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);background:var(--bg2);overflow-x:auto">
      ${[
        {id:'stock',label:str.stock||'Stock',icon:'📦'},
        {id:'catalog',label:str.catalog||'Catalog',icon:'📋'},
        {id:'measurement',label:str.measurement||'Measure',icon:'📐'},
        {id:'labor',label:str.labor||'Labor Bids',icon:'🔨'},
        {id:'rewards',label:str.rewards||'Rewards',icon:'🎁'},
        {id:'awards',label:str.awards||'Awards',icon:'🏆'},
        {id:'margin',label:str.margin||'Margin',icon:'💰'},
      ].map(tab=>`
      <button onclick="VW_CONTRACTOR.switchPortalTab('${tab.id}','${token}','${lang}')"
        id="ptab-${tab.id}"
        style="padding:10px 12px;background:none;border:none;border-bottom:2px solid transparent;font-size:11px;color:var(--text3);cursor:pointer;white-space:nowrap;margin-bottom:-2px;flex-shrink:0">
        ${tab.icon} ${tab.label}
      </button>`).join('')}
    </div>

    <!-- CONTENT AREA -->
    <div id="portal-content" style="padding:16px">
      ${await _renderPortalStock(tiles, contractor, lang, margin_type, margin_val)}
    </div>
  </div>`;
}

function renderContractorFirstActivation(contractor, token) {
  return `
  <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center">
    <div style="font-size:40px;margin-bottom:16px">🏠</div>
    <div style="font-size:22px;font-weight:800;color:var(--gold);font-family:'Syne',sans-serif;margin-bottom:6px">V Wholesale</div>
    <div style="font-size:14px;color:var(--text2);margin-bottom:28px">Welcome, ${contractor.name}!</div>

    <div style="font-size:15px;font-weight:700;margin-bottom:16px">Choose Your Language / భాషను ఎంచుకోండి</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:360px;margin-bottom:24px">
      ${Object.entries(CONTRACTOR_LANGS).map(([code, lang])=>`
      <button onclick="VW_CONTRACTOR.activateContractor('${contractor.id}','${token}','${code}')"
        style="background:var(--bg2);border:2px solid var(--border);border-radius:14px;padding:16px 12px;cursor:pointer;text-align:center">
        <div style="font-size:20px;margin-bottom:6px">${code==='en'?'🇬🇧':code==='te'?'🏛':code==='hi'?'🇮🇳':code==='bn'?'🐯':'🌸'}</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${lang.native}</div>
        <div style="font-size:11px;color:var(--text3)">${lang.name}</div>
      </button>`).join('')}
    </div>

    <div style="font-size:11px;color:var(--text3)">You can change this later in settings</div>
  </div>`;
}

async function activateContractor(contractorId, token, lang) {
  // Create or update contractor profile with chosen language
  const { data: existing } = await VW_DB.client.from('contractor_profiles')
    .select('id').eq('contractor_id', contractorId).single();

  if (existing) {
    await VW_DB.client.from('contractor_profiles').update({ language: lang, first_login_done: true }).eq('contractor_id', contractorId);
  } else {
    await VW_DB.client.from('contractor_profiles').insert({
      contractor_id: parseInt(contractorId), language: lang,
      first_login_done: true, portal_token: token,
    });
  }
  await VW_DB.client.from('contractors').update({ language: lang }).eq('id', contractorId);

  // Reload portal
  const el = document.body;
  el.innerHTML = '<div style="padding:20px;text-align:center">⏳ Loading...</div>';
  const html = await renderContractorPublicPortal(token);
  el.innerHTML = html;
}

async function switchPortalTab(tabId, token, lang) {
  // Update active tab styling
  document.querySelectorAll('[id^="ptab-"]').forEach(b => {
    b.style.color = 'var(--text3)';
    b.style.borderBottom = '2px solid transparent';
  });
  const active = document.getElementById(`ptab-${tabId}`);
  if (active) { active.style.color = 'var(--gold)'; active.style.borderBottom = '2px solid var(--gold)'; }

  const { data: c } = await VW_DB.client.from('contractors').select('*').eq('portal_token', token).single();
  const el = document.getElementById('portal-content');
  if (!el || !c) return;

  const str = PORTAL_STRINGS[lang] || PORTAL_STRINGS.en;
  const { data: products } = await VW_DB.client.from('products')
    .select('*').eq('category','Tiles').gt('stock',0).order('purchase_date',{ascending:true});
  const tiles = products || [];

  if (tabId === 'stock') el.innerHTML = await _renderPortalStock(tiles, c, lang, c.margin_type, c.margin_value);
  else if (tabId === 'catalog') el.innerHTML = await _renderPortalCatalog(c, lang);
  else if (tabId === 'measurement') el.innerHTML = _renderPortalMeasurement(c, lang);
  else if (tabId === 'labor') el.innerHTML = await _renderPortalLaborBids(c, lang);
  else if (tabId === 'rewards') el.innerHTML = await _renderPortalRewards(c, lang);
  else if (tabId === 'awards') el.innerHTML = await _renderPortalAwards(c, lang);
  else if (tabId === 'margin') el.innerHTML = _renderPortalMarginSettings(c, lang);
}


// ===== PORTAL STOCK TAB =====
async function _renderPortalStock(tiles, c, lang, margin_type, margin_val) {
  const str = PORTAL_STRINGS[lang] || PORTAL_STRINGS.en;
  return `
  <div style="margin-bottom:12px">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">${str.stock}</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
      Your margin: ${margin_type==='per_sqft'?`₹${margin_val}/sqft`:`${margin_val}%`} | Net pricing shown
    </div>
    <input type="text" id="portal-search" placeholder="Search tile..." oninput="VW_CONTRACTOR.filterPortalStock(this.value)"
      style="margin-bottom:10px;font-size:13px">
  </div>
  <div id="portal-stock-list">
    ${tiles.map(p => {
      const netPrice = p.mrp || 0;
      const coverSqft = p.coverage_per_box || 1;
      const clientPrice = margin_type === 'per_sqft'
        ? Math.round(netPrice + margin_val * coverSqft)
        : Math.round(netPrice * (1 + margin_val/100));
      return `
      <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid ${p.dead_stock_flag?'rgba(239,68,68,0.3)':'var(--border)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700">${p.dead_stock_flag?'🔥 ':''}${p.name||p.tile_size_label||'—'}</div>
            <div style="font-size:11px;color:var(--text3)">${p.brand||'—'} · ${p.tile_size_mm||''}mm · ${p.tile_finish||''}</div>
            <div style="font-size:11px;color:var(--text3)">Stock: ${p.stock} boxes · ${coverSqft} sqft/box</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:10px;color:var(--text3)">Net: ₹${netPrice}/box</div>
            <div style="font-size:14px;font-weight:700;color:var(--gold)">Client: ₹${clientPrice}/box</div>
            <div style="font-size:10px;color:var(--green)">Your margin: ₹${clientPrice-netPrice}/box</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button onclick="VW_CONTRACTOR.shareProductLink('${p.id}','${c.portal_token||''}')"
            style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:6px;font-size:11px;color:var(--text);cursor:pointer">
            📤 ${str.share}
          </button>
          <button onclick="VW_CONTRACTOR.addToMeasurement('${p.id}','${p.name||''}')"
            style="flex:1;background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:8px;padding:6px;font-size:11px;color:var(--gold);cursor:pointer">
            📐 Select for Quote
          </button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function filterPortalStock(val) {
  const items = document.querySelectorAll('#portal-stock-list > div');
  items.forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(val.toLowerCase()) ? '' : 'none';
  });
}

function shareProductLink(productId, token) {
  const link = `${window.location.origin}/vwholesale-app/?contractor=${token}&product=${productId}`;
  if (navigator.share) {
    navigator.share({ title:'V Wholesale Tile', url: link });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(()=>showToast('Link copied','success'));
  }
}

// ===== PORTAL MEASUREMENT TAB (contractor measures at site) =====
function _renderPortalMeasurement(c, lang) {
  const str = PORTAL_STRINGS[lang] || PORTAL_STRINGS.en;
  if (!window._portalRooms) window._portalRooms = [];
  return `
  <div style="margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">📐 Site Measurement</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Measure at customer site → auto-calculates tile requirement → create quote</div>

    <!-- MANUAL SLIP OCR -->
    <div style="background:rgba(96,165,250,0.06);border:1px dashed rgba(96,165,250,0.4);border-radius:10px;padding:10px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:#60A5FA;margin-bottom:4px">📷 Have a handwritten measurement slip?</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px">Upload photo of handwritten slip or floor plan — AI will extract all measurements automatically.</div>
      <button onclick="document.getElementById('portal-slip-input').click()"
        style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;color:var(--text)">
        📷 Upload Slip / Floor Plan
      </button>
      <input type="file" id="portal-slip-input" accept="image/*" capture="environment" style="display:none" onchange="VW_CONTRACTOR.readMeasurementSlip(this)">
      <div id="slip-status" style="font-size:11px;color:var(--text3);margin-top:6px"></div>
    </div>

    <!-- ROOMS -->
    <div id="portal-rooms-list">
      ${window._portalRooms.map((r,i)=>`
      <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;font-weight:600">${r.label}</div>
          <div style="font-size:11px;color:var(--text3)">${r.sqft.toFixed(1)} sqft</div>
        </div>
        <button onclick="VW_CONTRACTOR.removePortalRoom(${i})" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer">✕</button>
      </div>`).join('')}
    </div>

    <div class="form-group" style="margin-bottom:8px"><label>Room / Area</label>
      <input type="text" id="pm-room" placeholder="e.g. Living Room, Bathroom 1"></div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Length (ft)</label><input type="number" id="pm-l" placeholder="12" min="0.5" step="0.5"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Width (ft)</label><input type="number" id="pm-w" placeholder="10" min="0.5" step="0.5"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Wastage %</label><input type="number" id="pm-waste" value="10" min="0" max="30" step="1"></div>
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_CONTRACTOR.addPortalRoom()">+ Add Room</button>

    ${window._portalRooms.length ? `
    <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-top:12px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:13px;font-weight:700">Total Area</div><div style="font-size:11px;color:var(--text3)">${window._portalRooms.length} area(s)</div></div>
      <div style="font-size:18px;font-weight:800;color:var(--gold)">${window._portalRooms.reduce((s,r)=>s+r.sqft,0).toFixed(1)} sqft</div>
    </div>
    <button class="btn-primary full-width" style="margin-top:10px" onclick="VW_CONTRACTOR.createPortalQuote('${c.portal_token||''}')">
      📋 Create Quotation from Measurements
    </button>` : ''}`;
}

async function readMeasurementSlip(input) {
  const file = input.files?.[0];
  if (!file) return;
  const status = document.getElementById('slip-status');
  if (status) status.innerHTML = '<span style="color:var(--gold)">⏳ AI reading measurement slip...</span>';

  const b64 = await new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 1200;
        const ratio = Math.min(max/img.width, max/img.height, 1);
        canvas.width = Math.round(img.width*ratio);
        canvas.height = Math.round(img.height*ratio);
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        res(canvas.toDataURL('image/jpeg',0.9).split(',')[1]);
      };
      img.onerror = () => res(e.target.result.split(',')[1]);
      if (file.type.includes('image')) img.src = e.target.result;
      else res(e.target.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });

  try {
    const res = await fetch(`${VW_DB.client.supabaseUrl}/functions/v1/room-visualizer`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${VW_DB.client.supabaseKey}`,'apikey':VW_DB.client.supabaseKey},
      body: JSON.stringify({
        mode:'floor_plan', imageBase64: b64,
        prompt:`This is a handwritten measurement slip or floor plan. Extract all room measurements.
Return ONLY JSON: {"rooms":[{"label":"Room Name","length":12,"width":10,"unit":"ft","notes":"any note"}]}
Convert to feet if in meters (×3.28) or mm (÷304.8). Estimate if not visible. Include ALL rooms/areas.`
      })
    });
    const data = await res.json();
    let rooms = null;
    try {
      const text = data.description || data.response || JSON.stringify(data);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) rooms = JSON.parse(match[0]).rooms;
    } catch(e) {}

    if (rooms?.length) {
      if (!window._portalRooms) window._portalRooms = [];
      for (const r of rooms) {
        const l = parseFloat(r.length)||0, w = parseFloat(r.width)||0;
        if (l&&w) window._portalRooms.push({ label: r.label||'Area', sqft: l*w*1.05, l, w });
      }
      if (status) status.innerHTML = `<span style="color:var(--green)">✅ ${rooms.length} areas extracted. Review below.</span>`;
      document.getElementById('portal-rooms-list').innerHTML = window._portalRooms.map((r,i)=>`
        <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-size:12px;font-weight:600">${r.label}</div><div style="font-size:11px;color:var(--text3)">${r.sqft.toFixed(1)} sqft</div></div>
          <button onclick="VW_CONTRACTOR.removePortalRoom(${i})" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer">✕</button>
        </div>`).join('');
    } else {
      if (status) status.innerHTML = `<span style="color:var(--text3)">Could not read automatically — please enter measurements manually below.</span>`;
    }
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}

function addPortalRoom() {
  const label = document.getElementById('pm-room')?.value.trim()||'Area';
  const l = parseFloat(document.getElementById('pm-l')?.value||0);
  const w = parseFloat(document.getElementById('pm-w')?.value||0);
  const waste = parseFloat(document.getElementById('pm-waste')?.value||10)/100;
  if (!l||!w) { showToast('Enter length and width','warn'); return; }
  if (!window._portalRooms) window._portalRooms = [];
  window._portalRooms.push({ label, sqft: l*w*(1+waste), l, w, waste });
  document.getElementById('pm-room').value='';
  document.getElementById('pm-l').value='';
  document.getElementById('pm-w').value='';
  switchPortalTab('measurement', document.querySelector('[id^="ptab-"]')?.dataset?.token||'', 'en');
}

function removePortalRoom(i) {
  if (window._portalRooms) window._portalRooms.splice(i,1);
  switchPortalTab('measurement','','en');
}

async function createPortalQuote(token) {
  const rooms = window._portalRooms || [];
  if (!rooms.length) { showToast('Add at least one room','warn'); return; }
  const totalSqft = rooms.reduce((s,r)=>s+r.sqft,0);
  showToast(`Quote created for ${totalSqft.toFixed(1)} sqft — check with V Wholesale team`, 'success');
  // In a real implementation this would save to tile_quotations via Supabase
}

// ===== PORTAL CATALOG TAB =====
async function _renderPortalCatalog(c, lang) {
  const { data: catalog } = await VW_DB.client.from('catalog_products')
    .select('*').order('brand').limit(100);
  const items = catalog || [];
  return `
  <div style="margin-bottom:12px">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">📋 Design Catalog</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Tiles from our brand catalogs — can be pre-ordered if not in stock</div>
    <input type="text" placeholder="Search by brand, size, finish..." style="margin-bottom:10px;font-size:13px">
  </div>
  ${items.length===0 ? `
  <div style="text-align:center;padding:32px;color:var(--text3)">
    <div style="font-size:32px;margin-bottom:8px">📋</div>
    <div style="font-size:13px">No catalog products yet</div>
    <div style="font-size:11px;margin-top:6px">V Wholesale team adds products from brand PDFs</div>
  </div>` :
  items.map(p=>`
  <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:6px;border:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between">
      <div>
        <div style="font-size:12px;font-weight:700">${p.design_name||p.series_name||'—'}</div>
        <div style="font-size:11px;color:var(--text3)">${p.brand||'—'} · ${p.tile_size_label||p.tile_size_mm||'—'} · ${p.finish||''}</div>
        ${p.mrp?`<div style="font-size:11px;color:var(--gold)">₹${p.mrp}/box</div>`:''}
      </div>
      <div style="text-align:right">
        <span style="font-size:10px;background:${p.is_in_stock?'rgba(34,197,94,0.12)':'rgba(245,200,66,0.12)'};color:${p.is_in_stock?'var(--green)':'var(--gold)'};padding:2px 6px;border-radius:4px">
          ${p.is_in_stock?'In Stock':'Pre-order'}
        </span>
      </div>
    </div>
  </div>`).join('')}`;
}

// ===== PORTAL LABOR BIDS TAB =====
async function _renderPortalLaborBids(c, lang) {
  const str = PORTAL_STRINGS[lang] || PORTAL_STRINGS.en;
  const { data: requirements } = await VW_DB.client.from('labor_requirements')
    .select('*').in('status',['open','bidding']).order('created_at',{ascending:false}).limit(20);
  // Own bids via token-scoped RPC — anon can't read contractor_bids directly (keeps rival
  // bid amounts private); the RPC returns only this contractor's bids.
  const { data: myBids } = await VW_DB.client.rpc('get_contractor_bids', { p_token: c.portal_token })
    .then(r => ({ data: r.data || [] })).catch(() => ({ data: [] }));

  return `
  <div style="margin-bottom:12px">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">🔨 ${str.labor}</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Bid for tile laying work. Use loyalty points to feature your bid. Procurement must be from V Wholesale.</div>
    <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:8px;padding:8px;margin-bottom:10px;font-size:11px;color:var(--text2)">
      ⭐ Your points: <strong style="color:var(--gold)">${c.loyalty_points||0} pts</strong> · Use points to feature your bid and get more leads
    </div>
  </div>

  <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">Open Requirements</div>
  ${!requirements?.length ? `<div style="font-size:13px;color:var(--text3);text-align:center;padding:20px">No open requirements right now</div>` :
  requirements.map(r=>`
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid var(--border)">
    <div style="font-size:13px;font-weight:700">${r.work_type?.replace(/_/g,' ')||'Tile Work'}</div>
    <div style="font-size:11px;color:var(--text2)">📍 ${r.site_address||'Vijayawada'} · ${r.total_area_sqft||'?'} sqft</div>
    <div style="font-size:11px;color:var(--text3)">Tile: ${r.tile_brand||'?'} ${r.tile_size||''} · Start: ${r.start_date||'Flexible'}</div>
    ${r.budget_min||r.budget_max?`<div style="font-size:11px;color:var(--gold)">Budget: ₹${r.budget_min||'?'} – ₹${r.budget_max||'?'}</div>`:''}
    <div style="display:flex;gap:6px;margin-top:8px">
      <button onclick="VW_CONTRACTOR.openBidForm(${r.id},'${c.portal_token||''}')"
        style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:700;cursor:pointer">
        ${str.bid}
      </button>
    </div>
  </div>`).join('')}

  ${myBids?.length ? `
  <div style="font-size:12px;font-weight:700;color:var(--text);margin:14px 0 8px">My Bids</div>
  ${myBids.map(b=>`
  <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
    <div><div style="font-size:12px;font-weight:600">₹${(b.rate_per_sqft||0)}/sqft · ₹${(b.bid_amount||0).toLocaleString('en-IN')}</div>
    <div style="font-size:10px;color:var(--text3)">${b.timeline_days} days · ${b.is_featured?'⭐ Featured':''}</div></div>
    <span style="font-size:11px;color:${b.status==='awarded'?'var(--green)':b.status==='rejected'?'var(--red)':'var(--gold)'}">● ${b.status}</span>
  </div>`).join('')}` : ''}`;
}

async function openBidForm(reqId, token) {
  const { data: c } = await VW_DB.client.from('contractors').select('*').eq('portal_token', token).single();
  const pts = c?.loyalty_points || 0;
  const sheet = document.getElementById('bottom-sheet') || document.createElement('div');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">Place Bid</h3>
      <button onclick="this.closest('[id=bottom-sheet]')?.classList.remove('open')" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Rate per Sqft (₹)</label><input type="number" id="bid-rate" placeholder="45" min="1"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Total Bid (₹)</label><input type="number" id="bid-total" placeholder="Auto"></div>
    </div>
    <div class="form-group"><label>Timeline (days)</label><input type="number" id="bid-days" placeholder="7" min="1"></div>
    <div class="form-group"><label>Description / Inclusions</label><textarea id="bid-desc" placeholder="What's included in your bid..."></textarea></div>
    <div class="form-row">
      <div style="flex:1;display:flex;align-items:center;gap:6px"><input type="checkbox" id="bid-wp"><label style="font-size:12px">Includes Waterproofing</label></div>
      <div style="flex:1;display:flex;align-items:center;gap:6px"><input type="checkbox" id="bid-adh"><label style="font-size:12px">Includes Adhesive</label></div>
    </div>
    <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;margin-bottom:4px">⭐ Feature your bid (optional)</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Spend 50 pts to feature your bid at the top. Your balance: ${pts} pts</div>
      <input type="checkbox" id="bid-feature" ${pts<50?'disabled':''}>
      <label style="font-size:12px;margin-left:6px">Feature my bid (50 pts) ${pts<50?'— not enough points':''}</label>
    </div>
    <button class="btn-primary full-width" onclick="VW_CONTRACTOR.submitBid(${reqId},'${token}')">Submit Bid</button>`;
  sheet.classList?.add('open');
  document.getElementById('sheet-overlay')?.classList.add('open');
}

async function submitBid(reqId, token) {
  const { data: c } = await VW_DB.client.from('contractors').select('*').eq('portal_token', token).single();
  if (!c) return;
  const rate = parseFloat(document.getElementById('bid-rate')?.value||0);
  const total = parseFloat(document.getElementById('bid-total')?.value||0);
  const days = parseInt(document.getElementById('bid-days')?.value||7);
  const desc = document.getElementById('bid-desc')?.value.trim()||'';
  const featured = document.getElementById('bid-feature')?.checked && (c.loyalty_points||0)>=50;

  if (!rate) { showToast('Enter rate per sqft','warn'); return; }

  const { error } = await VW_DB.client.from('contractor_bids').insert({
    requirement_id: reqId, contractor_id: c.id, contractor_name: c.name,
    bid_amount: total||0, rate_per_sqft: rate, timeline_days: days, description: desc,
    includes_waterproofing: document.getElementById('bid-wp')?.checked||false,
    includes_adhesive: document.getElementById('bid-adh')?.checked||false,
    points_used: featured?50:0, is_featured: featured,
  });

  if (error) { showToast('Error: '+error.message,'error'); return; }

  if (featured) {
    await VW_DB.client.from('contractors').update({ loyalty_points: (c.loyalty_points||0)-50 }).eq('id',c.id);
    await VW_DB.client.from('contractor_loyalty').insert({
      contractor_id: c.id, transaction_type:'bid_spent', points:-50,
      description:'Featured bid for labor work', balance_after:(c.loyalty_points||0)-50,
    });
  }

  document.getElementById('bottom-sheet')?.classList.remove('open');
  showToast('Bid submitted ✓', 'success');
}

// ===== PORTAL REWARDS TAB =====
async function _renderPortalRewards(c, lang) {
  const str = PORTAL_STRINGS[lang] || PORTAL_STRINGS.en;
  const { data: rewards } = await VW_DB.client.from('rewards_catalog')
    .select('*').eq('is_active', true).order('points_required');
  const pts = c.loyalty_points || 0;

  return `
  <div style="margin-bottom:12px">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">🎁 ${str.rewards}</div>
    <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;color:var(--gold)">Your Balance: ${pts} points</div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px">Use points to buy tools, vouchers and more at discounted prices</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    ${(rewards||[]).map(r=>{
      const canAfford = pts >= r.points_required;
      const discPrice = r.cash_price ? Math.round(r.cash_price*(1-r.discount_pct/100)) : null;
      return `
      <div style="background:var(--bg2);border-radius:12px;padding:12px;border:1px solid ${canAfford?'var(--gold-border)':'var(--border)'}">
        <div style="font-size:28px;margin-bottom:6px">${r.category==='tool'?'🔧':r.category==='voucher'?'🎫':r.category==='training'?'🎓':'🎁'}</div>
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px">${r.name}</div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:8px">${r.description||''}</div>
        <div style="font-size:13px;font-weight:700;color:${canAfford?'var(--gold)':'var(--text3)'}">⭐ ${r.points_required} pts</div>
        ${discPrice?`<div style="font-size:10px;color:var(--green)">or ₹${discPrice} <s style="color:var(--text3)">₹${r.cash_price}</s></div>`:''}
        <button onclick="VW_CONTRACTOR.redeemReward(${r.id},'${c.portal_token||''}')"
          ${!canAfford?'disabled':''}
          style="width:100%;margin-top:8px;padding:7px;border-radius:8px;border:none;background:${canAfford?'var(--gold)':'var(--bg3)'};color:${canAfford?'#000':'var(--text3)'};font-size:11px;font-weight:600;cursor:${canAfford?'pointer':'not-allowed'}">
          ${canAfford?'Redeem':'Need '+(r.points_required-pts)+' more pts'}
        </button>
      </div>`;
    }).join('')}
  </div>`;
}

async function redeemReward(rewardId, token) {
  if (window._redeemInFlight) return; window._redeemInFlight = true;
  try {
  const { data: c } = await VW_DB.client.from('contractors').select('*').eq('portal_token',token).single();
  const { data: reward } = await VW_DB.client.from('rewards_catalog').select('*').eq('id',rewardId).single();
  if (!c||!reward) return;
  if ((c.loyalty_points||0) < reward.points_required) { showToast('Not enough points','warn'); return; }

  const { error } = await VW_DB.client.from('rewards_redemptions').insert({
    redeemer_type:'contractor', redeemer_id:c.id, redeemer_name:c.name,
    reward_id:rewardId, reward_name:reward.name, points_used:reward.points_required,
  });
  if (error) { showToast('Error: '+error.message,'error'); return; }

  const newPts = (c.loyalty_points||0) - reward.points_required;
  await VW_DB.client.from('contractors').update({ loyalty_points: newPts }).eq('id',c.id);
  await VW_DB.client.from('contractor_loyalty').insert({
    contractor_id:c.id, transaction_type:'reward_purchased', points:-reward.points_required,
    description:`Redeemed: ${reward.name}`, balance_after:newPts,
  });
  showToast(`${reward.name} redeemed ✓ — V Wholesale team will arrange delivery`, 'success');
  } finally { window._redeemInFlight = false; }
}

// ===== PORTAL AWARDS TAB =====
async function _renderPortalAwards(c, lang) {
  const { data: allAwards } = await VW_DB.client.from('contractor_awards')
    .select('*').order('created_at',{ascending:false}).limit(20);
  const myAwards = (allAwards||[]).filter(a=>a.contractor_id===c.id);
  const leaderboard = (allAwards||[]).filter(a=>a.award_type==='top_monthly').slice(0,10);

  return `
  <div style="margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">🏆 Awards & Leaderboard</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Top contractors in your region get recognition and bonus rewards</div>
  </div>
  ${myAwards.length ? `
  <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">🌟 My Awards</div>
    ${myAwards.map(a=>`<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--gold-border)">
      🏅 ${a.award_type?.replace(/_/g,' ')} · ${a.period} ${a.region?`· ${a.region}`:''} · Rank #${a.rank||'?'}
    </div>`).join('')}
  </div>` : ''}
  <div style="font-size:12px;font-weight:700;margin-bottom:8px">Monthly Leaderboard</div>
  ${leaderboard.length ? leaderboard.map((a,i)=>`
  <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:16px;width:28px;text-align:center">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:600;color:${a.contractor_id===c.id?'var(--gold)':'var(--text)'}">${a.contractor_name} ${a.contractor_id===c.id?'(You)':''}</div>
      <div style="font-size:10px;color:var(--text3)">₹${(a.purchase_value||0).toLocaleString('en-IN')} · ${a.points_earned||0} pts</div>
    </div>
  </div>`).join('') : '<div style="text-align:center;padding:20px;color:var(--text3)">Leaderboard updates monthly</div>'}`;
}

// ===== PORTAL MARGIN SETTINGS TAB =====
function _renderPortalMarginSettings(c, lang) {
  const str = PORTAL_STRINGS[lang] || PORTAL_STRINGS.en;
  return `
  <div style="margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">💰 ${str.margin}</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Set how you want to earn on tile sales. Loyalty points auto-credited on non-margin products.</div>
  </div>
  <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">Margin Type</div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button onclick="document.getElementById('m-type-pct').click()"
        style="flex:1;padding:12px;border-radius:10px;border:${(c.margin_type||'percentage')==='percentage'?'2px solid var(--gold)':'1px solid var(--border)'};background:${(c.margin_type||'percentage')==='percentage'?'var(--gold-muted)':'var(--bg2)'};cursor:pointer">
        <div style="font-size:13px;font-weight:700;color:${(c.margin_type||'percentage')==='percentage'?'var(--gold)':'var(--text)'}">% Percentage</div>
        <div style="font-size:11px;color:var(--text3)">e.g. 15% on each box</div>
      </button>
      <button onclick="document.getElementById('m-type-sqft').click()"
        style="flex:1;padding:12px;border-radius:10px;border:${c.margin_type==='per_sqft'?'2px solid var(--gold)':'1px solid var(--border)'};background:${c.margin_type==='per_sqft'?'var(--gold-muted)':'var(--bg2)'};cursor:pointer">
        <div style="font-size:13px;font-weight:700;color:${c.margin_type==='per_sqft'?'var(--gold)':'var(--text)'}">₹ Per Sqft</div>
        <div style="font-size:11px;color:var(--text3)">Fixed amount per sqft</div>
      </button>
    </div>
    <input type="radio" id="m-type-pct" name="m-type" value="percentage" ${(c.margin_type||'percentage')==='percentage'?'checked':''} style="display:none" onchange="document.getElementById('m-label').textContent='%'">
    <input type="radio" id="m-type-sqft" name="m-type" value="per_sqft" ${c.margin_type==='per_sqft'?'checked':''} style="display:none" onchange="document.getElementById('m-label').textContent='₹/sqft'">

    <div class="form-group">
      <label>Your Margin <span id="m-label">${c.margin_type==='per_sqft'?'₹/sqft':'%'}</span></label>
      <input type="number" id="m-value" value="${c.margin_value||15}" min="0.5" step="0.5" placeholder="${c.margin_type==='per_sqft'?'e.g. 8':'e.g. 15'}">
    </div>
    <button class="btn-primary full-width" onclick="VW_CONTRACTOR.saveMarginSettings('${c.portal_token||''}')">Save Margin Settings</button>
  </div>

  <div style="background:rgba(34,197,94,0.06);border-radius:10px;padding:12px">
    <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:6px">🔄 Auto Loyalty Points</div>
    <div style="font-size:11px;color:var(--text2)">On products where you don't add margin — you automatically earn loyalty points (1 pt per ₹100 purchased). These can be redeemed in the rewards store or used to bid for labor work.</div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">⚠️ Margin products do NOT earn loyalty points — your margin IS the reward.</div>
  </div>`;
}

async function saveMarginSettings(token) {
  const type = document.querySelector('input[name="m-type"]:checked')?.value || 'percentage';
  const value = parseFloat(document.getElementById('m-value')?.value||15);
  await VW_DB.client.from('contractors').update({ margin_type:type, margin_value:value }).eq('portal_token', token);
  showToast('Margin settings saved ✓','success');
}

// ===== ADMIN CONTRACTOR MANAGEMENT PAGE =====
async function renderContractorPortalPage() {
  const { data: contractors } = await VW_DB.client.from('contractors')
    .select('*').order('created_at',{ascending:false});
  const list = contractors || [];
  const active = list.filter(c=>c.status==='active').length;

  return `
  <div class="module-header">
    <h2>🤝 Contractors</h2>
    <div style="display:flex;gap:6px">
      <button class="btn-sm" onclick="VW_CONTRACTOR.shareSignupLink()" style="background:var(--bg2);border:1px solid var(--border)">🔗 Signup Link</button>
      <button class="btn-sm" style="background:var(--gold);color:#000" onclick="VW_CONTRACTOR.addContractor()">+ Add</button>
    </div>
  </div>
  <div class="metric-grid-4" style="margin-bottom:12px">
    <div class="metric-card gold"><div class="mc-label">Active</div><div class="mc-value">${active}</div></div>
    <div class="metric-card"><div class="mc-label">Total</div><div class="mc-value">${list.length}</div></div>
    <div class="metric-card"><div class="mc-label">Total Paid</div><div class="mc-value">₹${Math.round(list.reduce((s,c)=>s+(c.annual_paid||0),0)/1000)}K</div></div>
    <div class="metric-card"><div class="mc-label">TDS</div><div class="mc-value">₹${Math.round(list.reduce((s,c)=>s+(c.tds_deducted||0),0)/1000)}K</div></div>
  </div>
  <!-- GST/TDS NOTICE -->
  <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px;font-size:11px;color:var(--text2)">
    <div style="font-weight:700;color:var(--gold);margin-bottom:3px">📋 GST/TDS — Section 194C</div>
    TDS: 1% Individual/HUF · 2% Company/Firm/LLP | Threshold: >₹30K single or >₹1L annual (excl. GST) | GST on margin: 18%
  </div>
  <!-- LABOR REQUIREMENTS -->
  <div class="card" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 class="card-title" style="margin:0">Labor Requirements</h3>
      <button class="btn-sm" onclick="VW_CONTRACTOR.postLaborRequirement()">+ Post Work</button>
    </div>
    <div id="labor-req-list" style="font-size:12px;color:var(--text3)">Loading...</div>
  </div>
  <div class="card">
    <h3 class="card-title">Contractors</h3>
    ${list.length===0?`<div style="text-align:center;padding:24px;color:var(--text3)"><div style="font-size:32px">🤝</div><div style="margin-top:8px">No contractors yet</div></div>`:
    list.map(c=>_renderContractorRow(c)).join('')}
  </div>`;
}

function _renderContractorRow(c) {
  const tdsRule = TDS_RULES[c.entity_type]||TDS_RULES.individual;
  const overThreshold = (c.annual_paid||0)>TDS_ANNUAL_LIMIT;
  return `
  <div onclick="VW_CONTRACTOR.openContractor(${c.id})" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
    <div style="display:flex;justify-content:space-between">
      <div>
        <div style="font-size:13px;font-weight:700">${c.name} ${c.company_name?`(${c.company_name})`:''}</div>
        <div style="font-size:11px;color:var(--text3)">${c.phone||'—'} · ${tdsRule.label} · Margin: ${c.margin_type==='per_sqft'?`₹${c.margin_value}/sqft`:`${c.margin_value||15}%`}</div>
        <div style="font-size:11px;color:var(--text3)">Pts: ${c.loyalty_points||0} · Annual: ₹${(c.annual_paid||0).toLocaleString('en-IN')}</div>
      </div>
      <div style="text-align:right">
        <span style="font-size:11px;background:${c.status==='active'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.1)'};color:${c.status==='active'?'var(--green)':'var(--red)'};padding:2px 8px;border-radius:4px">${c.status}</span>
        ${overThreshold?`<div style="font-size:10px;color:var(--gold);margin-top:3px">⚠️ TDS threshold</div>`:''}
        <button onclick="event.stopPropagation();VW_CONTRACTOR.sharePortalLink(${c.id},'${c.portal_token||''}')"
          style="font-size:11px;background:none;border:1px solid var(--border);border-radius:6px;padding:2px 8px;cursor:pointer;margin-top:4px;color:var(--text2)">🔗 Link</button>
      </div>
    </div>
  </div>`;
}

// ===== LABOR REQUIREMENT POSTING (by executive/admin) =====
async function postLaborRequirement() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">Post Labor Requirement</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div class="form-group"><label>Customer Name *</label><input type="text" id="lr-cname" placeholder="e.g. Ravi Teja"></div>
    <div class="form-group"><label>Customer Phone</label><input type="tel" id="lr-phone" placeholder="9999999999" maxlength="10"></div>
    <div class="form-group"><label>Site Address</label><input type="text" id="lr-site" placeholder="Plot 45, Bhavanipuram"></div>
    <div class="form-group"><label>Work Type</label>
      <select id="lr-type">
        <option value="tile_laying">Tile Laying</option>
        <option value="granite_work">Granite Work</option>
        <option value="waterproofing">Waterproofing</option>
        <option value="all">All (Tile + Waterproofing)</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Total Area (sqft)</label><input type="number" id="lr-area" placeholder="500"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Start Date</label><input type="date" id="lr-start"></div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Budget Min (₹)</label><input type="number" id="lr-bmin" placeholder="10000"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Budget Max (₹)</label><input type="number" id="lr-bmax" placeholder="20000"></div>
    </div>
    <div class="form-group"><label>Tile Details</label><input type="text" id="lr-tile" placeholder="e.g. TISAN 600×600 Matt"></div>
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:8px;margin-bottom:12px;font-size:11px;color:var(--text2)">
      ✅ Procurement from V Wholesale is mandatory for all work orders posted here
    </div>
    <button class="btn-primary full-width" onclick="VW_CONTRACTOR.saveLaborRequirement()">Post Requirement</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveLaborRequirement() {
  const name = document.getElementById('lr-cname')?.value.trim();
  if (!name) { showToast('Customer name required','warn'); return; }
  const fy = getFinancialYearLabel();
  const { data: seq } = await VW_DB.client.from('settings').select('value').eq('key','labor_seq_'+fy).single();
  const next = ((seq?.value)||0)+1;
  const reqNo = `LAB/${fy}/${String(next).padStart(4,'0')}`;
  await VW_DB.client.from('settings').upsert({ key:'labor_seq_'+fy, value:next });
  const { error } = await VW_DB.client.from('labor_requirements').insert({
    req_no: reqNo,
    customer_name: name,
    customer_phone: document.getElementById('lr-phone')?.value.trim()||'',
    site_address: document.getElementById('lr-site')?.value.trim()||'',
    work_type: document.getElementById('lr-type')?.value||'tile_laying',
    total_area_sqft: parseFloat(document.getElementById('lr-area')?.value||0),
    start_date: document.getElementById('lr-start')?.value||null,
    budget_min: parseFloat(document.getElementById('lr-bmin')?.value||0)||null,
    budget_max: parseFloat(document.getElementById('lr-bmax')?.value||0)||null,
    tile_brand: document.getElementById('lr-tile')?.value.trim()||'',
    procurement_confirmed: true,
    posted_by: VW_AUTH.getCurrentProfile()?.name||'',
  });
  if (error) { showToast('Error: '+error.message,'error'); return; }
  closeSheet();
  showToast(`Requirement ${reqNo} posted ✓ — contractors can bid now`, 'success');
}

// ===== ADD/SAVE CONTRACTOR =====
function addContractor() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">Add Contractor</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Name *</label><input type="text" id="cc-name" placeholder="Rajesh Kumar"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Phone *</label><input type="tel" id="cc-phone" placeholder="9999999999" maxlength="10"></div>
    </div>
    <div class="form-group"><label>Company (optional)</label><input type="text" id="cc-company" placeholder="Rajesh Constructions"></div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Entity Type</label>
        <select id="cc-entity"><option value="individual">Individual/HUF</option><option value="company">Company/LLP</option><option value="firm">Partnership Firm</option></select>
      </div>
      <div class="form-group" style="margin:0;flex:1"><label>PAN</label><input type="text" id="cc-pan" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase"></div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Region</label>
        <select id="cc-region"><option value="">Any</option><option value="Vijayawada">Vijayawada</option><option value="Guntur">Guntur</option><option value="Krishna Dist">Krishna Dist</option><option value="Other">Other</option></select>
      </div>
      <div class="form-group" style="margin:0;flex:1"><label>Margin %</label><input type="number" id="cc-margin" value="15" min="0.5" step="0.5"></div>
    </div>
    <button class="btn-primary full-width" onclick="VW_CONTRACTOR.saveContractor()">Add Contractor</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveContractor() {
  const name = document.getElementById('cc-name')?.value.trim();
  const phone = document.getElementById('cc-phone')?.value.trim();
  if (!name||!phone) { showToast('Name and phone required','warn'); return; }
  const token = Math.random().toString(36).slice(2)+Date.now().toString(36);
  const { error } = await VW_DB.client.from('contractors').insert({
    name, phone,
    company_name: document.getElementById('cc-company')?.value.trim()||null,
    entity_type: document.getElementById('cc-entity')?.value||'individual',
    pan_number: (document.getElementById('cc-pan')?.value||'').toUpperCase()||null,
    margin_type: 'percentage', margin_value: parseFloat(document.getElementById('cc-margin')?.value||15),
    region: document.getElementById('cc-region')?.value||null,
    portal_token: token,
    created_by: VW_AUTH.getCurrentProfile()?.name||'',
  });
  if (error) { showToast('Error: '+error.message,'error'); return; }
  closeSheet();
  showToast('Contractor added ✓','success');
  navigateTo('contractor_portal');
}

async function sharePortalLink(id, token) {
  // Commission share-gate: if this contractor has a commission still in approval,
  // the portal/profile link stays locked until it clears Management.
  try {
    const { data: comm } = await VW_DB.client.from('contractor_commissions').select('status').eq('contractor_id', id);
    const rows = comm || [];
    if (rows.some(r=>r.status==='pending') && !rows.some(r=>r.status==='approved')) {
      showToast('Portal link locked — commission is still pending approval','warn');
      if (typeof navigateTo==='function') navigateTo('commissions');
      return;
    }
  } catch(_) {}
  if (!token) {
    token = Math.random().toString(36).slice(2)+Date.now().toString(36);
    await VW_DB.client.from('contractors').update({portal_token:token}).eq('id',id);
  }
  const link = `${window.location.origin}/vwholesale-app/?contractor=${token}`;
  const { data: c } = await VW_DB.client.from('contractors').select('name,phone').eq('id',id).single();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin-bottom:10px">🔗 Portal Link — ${c?.name||''}</h3>
    <div style="background:var(--bg2);border-radius:8px;padding:10px;font-size:12px;word-break:break-all;color:var(--text2);margin-bottom:10px">${link}</div>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" style="flex:1" onclick="navigator.clipboard.writeText('${link}').then(()=>showToast('Copied','success'))">📋 Copy</button>
      <button class="btn-wa" style="flex:1" onclick="window.open('https://wa.me/91${(c?.phone||'').replace(/\\D/g,'')}?text='+encodeURIComponent('V Wholesale Portal: ${link}'),'_blank')">💬 WA</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function openContractor(id) {
  const { data: c } = await VW_DB.client.from('contractors').select('*').eq('id',id).single();
  const { data: txns } = await VW_DB.client.from('contractor_transactions').select('*').eq('contractor_id',id).limit(10);
  if (!c) return;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">${c.name}</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px;font-size:12px">
      <div>${c.phone} · ${TDS_RULES[c.entity_type]?.label||'Individual'} · TDS ${TDS_RULES[c.entity_type]?.rate||1}%</div>
      <div>Margin: ${c.margin_type==='per_sqft'?`₹${c.margin_value}/sqft`:`${c.margin_value||15}%`} · Region: ${c.region||'—'}</div>
      <div>Loyalty: ${c.loyalty_points||0} pts · Annual paid: ₹${(c.annual_paid||0).toLocaleString('en-IN')} · TDS: ₹${(c.tds_deducted||0).toLocaleString('en-IN')}</div>
    </div>
    ${(txns||[]).length ? `
    <div style="font-size:12px;font-weight:700;margin-bottom:6px">Transactions</div>
    ${(txns||[]).map(t=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:11px;display:flex;justify-content:space-between">
      <span>${t.invoice_no||'—'}</span><span style="color:var(--gold)">₹${Math.round(t.net_payout||0).toLocaleString('en-IN')}</span><span style="color:var(--text3)">${t.payment_status}</span>
    </div>`).join('')}` : '<div style="font-size:12px;color:var(--text3)">No transactions yet</div>'}
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet();VW_CONTRACTOR.sharePortalLink(${c.id},'${c.portal_token||''}')">🔗 Share</button>
      <button class="btn-primary" style="flex:1" onclick="VW_CONTRACTOR.downloadMeasurementSheet(${c.id})">📐 Sheet</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function downloadMeasurementSheet() {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Measurement Sheet</title>
<style>body{font-family:Arial;font-size:12px;margin:20mm}h1{color:#C8972B;font-size:18px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#f5c842;padding:6px 8px;text-align:left;font-size:11px}td{padding:7px;border:1px solid #ddd}@media print{button{display:none}}</style>
</head><body>
<div style="display:flex;justify-content:space-between;margin-bottom:16px">
  <div><h1>V Wholesale — Measurement Sheet</h1><div>NH-65 Bhavanipuram, Vijayawada · 8712697930</div></div>
  <div style="text-align:right"><div>Date: ${new Date().toLocaleDateString('en-IN')}</div><div>Site: ___________________________</div><div>Customer: ______________________</div></div>
</div>
<table><tr><th>Room/Area</th><th>L(ft)</th><th>W(ft)</th><th>H(ft)</th><th>Area(sqft)</th><th>Wastage%</th><th>Notes</th></tr>
${['Living Room','Drawing Hall','Master Bedroom','Bedroom 2','Bedroom 3','Kitchen Floor','Kitchen Wall','Bathroom 1 (Wall)','Bathroom 1 (Floor)','Bathroom 2 (Wall)','Bathroom 2 (Floor)','Wash Area','Balcony','Parking','Pooja Room Floor','Pooja Room Wall','Elevation','Corridor','Extra 1','Extra 2'].map(r=>`<tr><td>${r}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
</table>
<table><tr><th>Area</th><th>Brand</th><th>Size</th><th>Finish</th><th>Design Code</th><th>Boxes</th><th>Price/Box</th></tr>
${Array(10).fill(0).map(()=>`<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}
</table>
<div style="display:flex;gap:40px;margin-top:20px"><div>Customer: ____________________</div><div>Executive: ___________________</div><div>Date: ______________</div></div>
<p style="font-size:10px;color:#888;margin-top:10px">V Wholesale — Vassure Wholesale Pvt. Ltd. All measurements verified on site before order confirmation.</p>
</body></html>`;
  const win=window.open('','_blank');
  if(win){win.document.write(html);win.document.close();setTimeout(()=>win.print(),800);}
}

function calcContractorPayout(grossMargin, entityType, annualPaid) {
  const tdsRule = TDS_RULES[entityType]||TDS_RULES.individual;
  const gstOnMargin = grossMargin * GST_ON_COMMISSION / 100;
  const needsTDS = grossMargin > TDS_SINGLE_LIMIT || (annualPaid+grossMargin) > TDS_ANNUAL_LIMIT;
  const tdsDeducted = needsTDS ? grossMargin * tdsRule.rate / 100 : 0;
  const netPayout = grossMargin - gstOnMargin - tdsDeducted;
  return { gstOnMargin, tdsDeducted, netPayout, tdsRate: tdsRule.rate, needsTDS };
}



// =====================================================
// CONTRACTOR SIGNUP — Separate URL: ?signup=contractor
// Full onboarding form with professional type,
// experience, radius, language, approval flow
// =====================================================

const PROFESSIONAL_TYPES = [
  { id:'tile_mestri',  label:'Tile Contractor / Mestri',   icon:'🔲', note:'Tile laying, waterproofing, grouting' },
  { id:'civil',        label:'Civil Contractor',            icon:'🏗', note:'RCC, masonry, plaster, flooring' },
  { id:'interior',     label:'Interior Designer',           icon:'🛋', note:'Space planning, furniture, décor' },
  { id:'architect',    label:'Architect',                   icon:'📐', note:'Building design and planning' },
  { id:'builder',      label:'Builder / Developer',         icon:'🏢', note:'Residential/commercial construction' },
  { id:'plumber',      label:'Plumber',                    icon:'🔧', note:'Plumbing, pipework, waterproofing' },
  { id:'electrician',  label:'Electrician',                icon:'⚡', note:'Electrical wiring and fitting' },
  { id:'painter',      label:'Painter',                    icon:'🎨', note:'Wall painting and texture work' },
  { id:'carpenter',    label:'Carpenter / Wood Worker',    icon:'🪚', note:'Doors, windows, furniture, woodwork' },
  { id:'kitchen',      label:'Modular Kitchen Contractor', icon:'🍳', note:'Kitchen design and installation' },
  { id:'renovation',   label:'Home Renovation Contractor', icon:'🏠', note:'Full home renovation and finishing' },
  { id:'waterproofing',label:'Waterproofing Specialist',   icon:'💧', note:'Terrace, bathroom, basement WP' },
  { id:'other',        label:'Other Professional',         icon:'🤝', note:'Tell us more below' },
];

const HEARD_FROM_OPTIONS = [
  { id:'walk_in', label:'Walked into V Wholesale store' },
  { id:'referral', label:'Referred by another contractor' },
  { id:'social', label:'Social media (Instagram/Facebook)' },
  { id:'google', label:'Google search' },
  { id:'vw_team', label:'V Wholesale team called me' },
  { id:'other', label:'Other' },
];

async function renderContractorSignupPage() {
  return `
  <div style="min-height:100vh;padding:0;background:var(--bg)">
    <!-- HEADER -->
    <div style="background:var(--header-bg);padding:20px 16px 24px;text-align:center">
      <div style="font-size:24px;font-weight:800;color:#F5C842;font-family:'Syne',sans-serif;margin-bottom:4px">V Wholesale</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.7)">Contractor & Professional Registration</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">NH-65 Bhavanipuram, Vijayawada</div>
    </div>

    <!-- PROGRESS BAR -->
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border)">
      ${['Who are you?','Your details','Work info','Finish'].map((s,i)=>`
      <div id="signup-step-${i}" style="flex:1;padding:8px 4px;text-align:center;font-size:10px;color:${i===0?'var(--gold)':'var(--text3)'};border-bottom:2px solid ${i===0?'var(--gold)':'transparent'};cursor:pointer">${s}</div>`).join('')}
    </div>

    <!-- STEP 1: Professional Type -->
    <div id="signup-content" style="padding:16px;padding-bottom:80px">
      ${_renderSignupStep1()}
    </div>
  </div>`;
}

function _renderSignupStep1() {
  return `
  <div style="margin-bottom:16px">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">What do you do? 👷</div>
    <div style="font-size:13px;color:var(--text2)">Select your primary profession. This helps us send you the right leads.</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="prof-type-grid">
    ${PROFESSIONAL_TYPES.map(p=>`
    <button onclick="VW_CONTRACTOR.selectProfType('${p.id}',this)"
      id="ptype-${p.id}"
      style="background:var(--bg2);border:2px solid var(--border);border-radius:12px;padding:12px 8px;cursor:pointer;text-align:left">
      <div style="font-size:22px;margin-bottom:6px">${p.icon}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text)">${p.label}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">${p.note}</div>
    </button>`).join('')}
  </div>
  <div style="margin-top:16px;display:none" id="signup-next-1">
    <button class="btn-primary full-width" onclick="VW_CONTRACTOR.signupNextStep(1)">Continue →</button>
  </div>`;
}

function selectProfType(typeId, btn) {
  document.querySelectorAll('[id^="ptype-"]').forEach(b => {
    b.style.borderColor='var(--border)'; b.style.background='var(--bg2)';
  });
  btn.style.borderColor='var(--gold)'; btn.style.background='var(--gold-muted)';
  window._signupData = window._signupData || {};
  window._signupData.professional_type = typeId;
  document.getElementById('signup-next-1').style.display='block';
}

function signupNextStep(currentStep) {
  const el = document.getElementById('signup-content');
  if (!el) return;
  if (currentStep === 1) {
    if (!window._signupData?.professional_type) { showToast('Select your profession','warn'); return; }
    el.innerHTML = _renderSignupStep2();
    _updateSignupProgress(1);
  } else if (currentStep === 2) {
    const name = document.getElementById('su-name')?.value.trim();
    const phone = document.getElementById('su-phone')?.value.trim();
    if (!name||!phone||phone.length<10) { showToast('Name and 10-digit phone required','warn'); return; }
    window._signupData = {...(window._signupData||{}),
      name, phone,
      whatsapp_number: document.getElementById('su-wa')?.value.trim()||phone,
      language: document.getElementById('su-lang')?.value||'en',
    };
    el.innerHTML = _renderSignupStep3();
    _updateSignupProgress(2);
  } else if (currentStep === 3) {
    window._signupData = {...(window._signupData||{}),
      business_name: document.getElementById('su-biz')?.value.trim()||null,
      city: document.getElementById('su-city')?.value.trim()||'Vijayawada',
      area: document.getElementById('su-area')?.value.trim()||'',
      pincode: document.getElementById('su-pin')?.value.trim()||'',
      years_experience: parseInt(document.getElementById('su-exp')?.value||0),
      work_radius_km: parseFloat(document.getElementById('su-radius')?.value||20),
      pan_number: (document.getElementById('su-pan')?.value||'').toUpperCase().trim()||null,
      gst_number: document.getElementById('su-gst')?.value.trim()||null,
      willing_to_bid: document.getElementById('su-bid')?.checked||false,
      heard_from: document.getElementById('su-heard')?.value||'other',
    };
    el.innerHTML = _renderSignupStep4();
    _updateSignupProgress(3);
  }
}



function _renderSignupStep2() {
  return `
  <div style="margin-bottom:16px">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">Your Details 📋</div>
    <div style="font-size:13px;color:var(--text2)">We'll use this to create your V Wholesale contractor account.</div>
  </div>
  <div class="form-row">
    <div class="form-group" style="margin:0;flex:1"><label>Full Name *</label><input type="text" id="su-name" placeholder="Rajesh Kumar" autocomplete="name"></div>
    <div class="form-group" style="margin:0;flex:1"><label>Mobile Number *</label><input type="tel" id="su-phone" placeholder="9999999999" maxlength="10" autocomplete="tel"></div>
  </div>
  <div class="form-group"><label>WhatsApp Number <span style="color:var(--text3)">(if different)</span></label>
    <input type="tel" id="su-wa" placeholder="Same as mobile if blank" maxlength="10"></div>
  <div class="form-group"><label>Preferred Language</label>
    <select id="su-lang">
      <option value="en">English</option>
      <option value="te">తెలుగు (Telugu)</option>
      <option value="hi">हिंदी (Hindi)</option>
      <option value="bn">বাংলা (Bengali)</option>
      <option value="or">ଓଡ଼ିଆ (Odia)</option>
    </select>
  </div>
  <div style="display:flex;gap:8px;margin-top:8px">
    <button class="btn-secondary" style="flex:0.4" onclick="VW_CONTRACTOR.signupBack(1)">← Back</button>
    <button class="btn-primary" style="flex:1" onclick="VW_CONTRACTOR.signupNextStep(2)">Continue →</button>
  </div>`;
}

function _renderSignupStep3() {
  return `
  <div style="margin-bottom:16px">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">Work Information 🏗</div>
    <div style="font-size:13px;color:var(--text2)">Tell us about your work area and experience.</div>
  </div>
  <div class="form-group"><label>Business / Firm Name <span style="color:var(--text3)">(optional)</span></label>
    <input type="text" id="su-biz" placeholder="Rajesh Constructions"></div>
  <div class="form-row">
    <div class="form-group" style="margin:0;flex:1"><label>City</label>
      <input type="text" id="su-city" value="Vijayawada" placeholder="Vijayawada"></div>
    <div class="form-group" style="margin:0;flex:1"><label>Area / Locality</label>
      <input type="text" id="su-area" placeholder="Bhavanipuram"></div>
  </div>
  <div class="form-row">
    <div class="form-group" style="margin:0;flex:1"><label>Pincode</label>
      <input type="text" id="su-pin" placeholder="520010" maxlength="6"></div>
    <div class="form-group" style="margin:0;flex:1"><label>Years of Experience</label>
      <input type="number" id="su-exp" placeholder="5" min="0" max="50"></div>
  </div>

  <!-- WORK RADIUS -->
  <div class="form-group">
    <label>How far from our store do you work? (km)</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      ${[10,20,30,50,100,0].map(r=>`
      <button onclick="document.getElementById('su-radius').value='${r||999}';this.closest('.form-group').querySelectorAll('.radius-btn').forEach(b=>b.style.borderColor='var(--border)');this.style.borderColor='var(--gold)'"
        class="radius-btn"
        style="padding:6px 12px;border-radius:20px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:12px;color:var(--text)">
        ${r===0?'Pan AP':r+' km'}
      </button>`).join('')}
    </div>
    <input type="number" id="su-radius" value="20" min="5" style="margin-top:8px" placeholder="Or enter exact km">
  </div>

  <div class="form-row">
    <div class="form-group" style="margin:0;flex:1"><label>PAN Number <span style="color:var(--text3)">(optional)</span></label>
      <input type="text" id="su-pan" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase"></div>
    <div class="form-group" style="margin:0;flex:1"><label>GST Number <span style="color:var(--text3)">(optional)</span></label>
      <input type="text" id="su-gst" placeholder="29ABCDE..."></div>
  </div>

  <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:12px">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <input type="checkbox" id="su-bid" style="margin-top:2px;width:16px;height:16px;flex-shrink:0">
      <div>
        <div style="font-size:13px;font-weight:600">I want to bid for tile labor work</div>
        <div style="font-size:11px;color:var(--text3)">V Wholesale will notify me when customers near my area need tile laying. I agree all material procurement will be from V Wholesale.</div>
      </div>
    </div>
  </div>

  <div class="form-group"><label>How did you hear about V Wholesale?</label>
    <select id="su-heard">
      ${HEARD_FROM_OPTIONS.map(o=>`<option value="${o.id}">${o.label}</option>`).join('')}
    </select>
  </div>

  <div style="display:flex;gap:8px;margin-top:8px">
    <button class="btn-secondary" style="flex:0.4" onclick="VW_CONTRACTOR.signupBack(2)">← Back</button>
    <button class="btn-primary" style="flex:1" onclick="VW_CONTRACTOR.signupNextStep(3)">Review & Submit →</button>
  </div>`;
}

function _renderSignupStep4() {
  const d = window._signupData || {};
  const profType = PROFESSIONAL_TYPES.find(p=>p.id===d.professional_type);
  return `
  <div style="margin-bottom:16px">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">Review & Submit ✅</div>
    <div style="font-size:13px;color:var(--text2)">Check your details before submitting for approval.</div>
  </div>
  <div style="background:var(--bg2);border-radius:14px;padding:16px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <div style="font-size:36px">${profType?.icon||'🤝'}</div>
      <div>
        <div style="font-size:15px;font-weight:700">${d.name||'—'}</div>
        <div style="font-size:13px;color:var(--gold)">${profType?.label||'—'}</div>
        <div style="font-size:12px;color:var(--text3)">${d.phone||'—'}</div>
      </div>
    </div>
    ${[
      ['Area', `${d.area||''} ${d.city||'Vijayawada'} · ${d.pincode||''}`],
      ['Work Radius', d.work_radius_km==='999'?'Pan Andhra Pradesh':d.work_radius_km+' km from V Wholesale'],
      ['Experience', (d.years_experience||0)+' years'],
      ['Business', d.business_name||'—'],
      ['Language', {en:'English',te:'Telugu',hi:'Hindi',bn:'Bengali',or:'Odia'}[d.language]||'English'],
      ['PAN', d.pan_number||'Not provided'],
      ['Willing to bid', d.willing_to_bid?'Yes — will bid for labor leads':'No'],
      ['Heard from', HEARD_FROM_OPTIONS.find(o=>o.id===d.heard_from)?.label||'—'],
    ].map(([k,v])=>`
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="color:var(--text3)">${k}</span><span style="color:var(--text);font-weight:500;text-align:right;max-width:60%">${v}</span>
    </div>`).join('')}
  </div>

  <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:16px;font-size:12px;color:var(--text2)">
    <div style="font-weight:700;color:var(--gold);margin-bottom:4px">📋 What happens next?</div>
    Your profile will be reviewed by V Wholesale team within 24 hours. Once approved, you'll get a WhatsApp message with your portal login link. You can then start bidding for work and accessing exclusive contractor pricing.
  </div>

  <div style="display:flex;gap:8px">
    <button class="btn-secondary" style="flex:0.4" onclick="VW_CONTRACTOR.signupBack(3)">← Edit</button>
    <button class="btn-primary" style="flex:1;background:var(--green)" id="signup-submit-btn" onclick="VW_CONTRACTOR.submitContractorSignup()">
      Submit for Approval ✓
    </button>
  </div>`;
}

async function submitContractorSignup() {
  const d = window._signupData || {};
  const btn = document.getElementById('signup-submit-btn');
  if (btn) { btn.disabled=true; btn.textContent='Submitting...'; }

  const token = Math.random().toString(36).slice(2)+Date.now().toString(36);
  const { data, error } = await VW_DB.client.from('contractors').insert({
    name: d.name,
    phone: d.phone,
    whatsapp_number: d.whatsapp_number||d.phone,
    professional_type: d.professional_type,
    company_name: d.business_name||null,
    city: d.city||'Vijayawada',
    area: d.area||'',
    pincode: d.pincode||'',
    years_experience: d.years_experience||0,
    work_radius_km: d.work_radius_km==='999'?9999:parseFloat(d.work_radius_km)||20,
    pan_number: d.pan_number||null,
    gst_number: d.gst_number||null,
    willing_to_bid: d.willing_to_bid||false,
    heard_from: d.heard_from||'other',
    language: d.language||'en',
    portal_token: token,
    approval_status: 'pending',
    signup_source: 'web',
    status: 'pending', // not active until approved
    entity_type: 'individual',
    margin_type: 'percentage',
    margin_value: 15,
  }).select().single();

  if (error) {
    if (btn) { btn.disabled=false; btn.textContent='Submit for Approval ✓'; }
    if (error.message?.includes('duplicate') || error.code==='23505') {
      showToast('This phone number is already registered','warn');
    } else {
      showToast('Error: '+error.message,'error');
    }
    return;
  }

  // Alert V Wholesale team via WhatsApp
  const profType = PROFESSIONAL_TYPES.find(p=>p.id===d.professional_type);
  const notifyMsg = encodeURIComponent(
    `*New Contractor Signup — V Wholesale*\n\n` +
    `Name: ${d.name}\nPhone: ${d.phone}\nType: ${profType?.label||d.professional_type}\n` +
    `City: ${d.city||'Vijayawada'} · ${d.area||''}\nRadius: ${d.work_radius_km} km\n` +
    `Bids: ${d.willing_to_bid?'Yes':'No'}\n\nAction needed: Approve in Contractors section.`
  );
  window.open(`https://wa.me/918712697930?text=${notifyMsg}`, '_blank');

  // Show success
  const el = document.getElementById('signup-content');
  if (el) el.innerHTML = `
    <div style="text-align:center;padding:40px 16px">
      <div style="font-size:60px;margin-bottom:16px">✅</div>
      <div style="font-size:20px;font-weight:800;color:var(--gold);margin-bottom:8px">Application Submitted!</div>
      <div style="font-size:14px;color:var(--text2);margin-bottom:16px">
        Thank you, ${d.name}. Your application is under review.
      </div>
      <div style="background:var(--bg2);border-radius:14px;padding:16px;margin-bottom:20px;font-size:13px;color:var(--text2);text-align:left">
        <div style="font-weight:700;margin-bottom:8px">📱 What's next:</div>
        <div style="margin-bottom:6px">1. V Wholesale team will review your profile</div>
        <div style="margin-bottom:6px">2. You'll receive a WhatsApp message within 24 hours</div>
        <div style="margin-bottom:6px">3. Message will contain your personal portal link</div>
        <div>4. Use the link to see stock, bid for work, and earn rewards</div>
      </div>
      <div style="font-size:13px;color:var(--text3)">📞 Questions? Call 8712697930</div>
      <div style="margin-top:20px;font-size:16px;font-weight:700;color:#F5C842;font-family:'Syne',sans-serif">V Wholesale · Vijayawada</div>
    </div>`;
  window._signupData = null;
}

function signupBack(toStep) {
  const el = document.getElementById('signup-content');
  if (!el) return;
  if (toStep===1) { el.innerHTML=_renderSignupStep1(); _updateSignupProgress(0); }
  else if (toStep===2) { el.innerHTML=_renderSignupStep2(); _updateSignupProgress(1); }
  else if (toStep===3) { el.innerHTML=_renderSignupStep3(); _updateSignupProgress(2); }
}



function _updateSignupProgress(activeIdx) {
  document.querySelectorAll('[id^="signup-step-"]').forEach((el,i) => {
    el.style.color = i<=activeIdx ? 'var(--gold)' : 'var(--text3)';
    el.style.borderColor = i===activeIdx ? 'var(--gold)' : 'transparent';
    el.style.borderBottom = `2px solid ${i===activeIdx?'var(--gold)':'transparent'}`;
  });
}

// Admin approval page inside contractor portal
async function renderPendingContractors() {
  const { data: pending } = await VW_DB.client.from('contractors')
    .select('*').eq('approval_status','pending').order('created_at',{ascending:false});
  const list = pending || [];
  if (!list.length) return '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">No pending approvals</div>';

  return `
  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">🟡 Pending Contractor Approvals (${list.length})</div>
  ${list.map(c=>{
    const profType = PROFESSIONAL_TYPES.find(p=>p.id===c.professional_type);
    return `
    <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:12px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700">${profType?.icon||'🤝'} ${c.name}</div>
          <div style="font-size:12px;color:var(--text2)">${profType?.label||c.professional_type||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${c.phone} · ${c.area||''} ${c.city||''} · ${c.work_radius_km}km radius</div>
          <div style="font-size:11px;color:var(--text3)">${c.years_experience||0} yrs exp · Willing to bid: ${c.willing_to_bid?'Yes':'No'}</div>
          <div style="font-size:11px;color:var(--text3)">Applied: ${new Date(c.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
        </div>
        <div style="text-align:right">
          ${c.pan_number?`<div style="font-size:10px;color:var(--text3)">PAN: ${c.pan_number}</div>`:''}
          <div style="font-size:10px;color:var(--text3)">Lang: ${{en:'EN',te:'తె',hi:'हि',bn:'বা',or:'ଓ'}[c.language]||'EN'}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="VW_CONTRACTOR.approveContractor(${c.id})"
          style="flex:1;background:var(--green);color:#fff;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:700;cursor:pointer">
          ✓ Approve & Send Link
        </button>
        <button onclick="VW_CONTRACTOR.rejectContractor(${c.id})"
          style="flex:1;background:none;border:1px solid var(--red);border-radius:8px;padding:8px;font-size:12px;color:var(--red);cursor:pointer">
          Reject
        </button>
      </div>
    </div>`;
  }).join('')}`;
}

async function approveContractor(contractorId) {
  const profile = VW_AUTH.getCurrentProfile();
  const { data: c } = await VW_DB.client.from('contractors').select('*').eq('id',contractorId).single();
  if (!c) return;
  await VW_DB.client.from('contractors').update({
    approval_status: 'approved',
    status: 'active',
    approved_by: profile?.name||'admin',
    approved_at: new Date().toISOString(),
  }).eq('id', contractorId);

  // Send WhatsApp with portal link
  const link = `${window.location.origin}/vwholesale-app/?contractor=${c.portal_token}`;
  const profType = PROFESSIONAL_TYPES.find(p=>p.id===c.professional_type);
  const msg = encodeURIComponent(
    `*Welcome to V Wholesale Contractor Network!* 🎉\n\n` +
    `Dear ${c.name},\n\n` +
    `Your registration as a *${profType?.label||'Contractor'}* has been approved!\n\n` +
    `Your exclusive contractor portal:\n${link}\n\n` +
    `✅ View V Wholesale stock with net pricing\n` +
    `✅ Set your markup and share with clients\n` +
    `✅ Bid for tile laying work in your area\n` +
    `✅ Earn loyalty points and rewards\n\n` +
    `📞 Support: 8712697930\n— V Wholesale, Vijayawada`
  );
  window.open(`https://wa.me/91${(c.whatsapp_number||c.phone).replace(/\D/g,'')}?text=${msg}`, '_blank');
  showToast(`${c.name} approved — WhatsApp opening`, 'success');
  navigateTo('contractor_portal');
}

async function rejectContractor(contractorId) {
  const reason = prompt('Reason for rejection (optional):') || '';
  await VW_DB.client.from('contractors').update({
    approval_status: 'rejected',
    status: 'rejected',
    rejection_reason: reason,
    approved_by: VW_AUTH.getCurrentProfile()?.name||'admin',
    approved_at: new Date().toISOString(),
  }).eq('id', contractorId);
  showToast('Contractor rejected', 'warn');
  navigateTo('contractor_portal');
}






// ── ADMIN UTILS ──

function shareSignupLink() {
  const link = `${window.location.origin}/vwholesale-app/?signup=contractor`;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin-bottom:10px">🔗 Contractor Signup Link</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">Share this link with contractors and professionals. They fill in their details and you approve.</p>
    <div style="background:var(--bg2);border-radius:8px;padding:10px;font-size:12px;word-break:break-all;color:var(--text2);margin-bottom:10px">${link}</div>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" style="flex:1" onclick="navigator.clipboard.writeText('${link}').then(()=>showToast('Copied ✓','success'))">📋 Copy</button>
      <button class="btn-wa" style="flex:1" onclick="window.open('https://wa.me/?text='+encodeURIComponent('Register as a V Wholesale Contractor / Professional:\\n${link}'),'_blank')">💬 Share</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// ── SINGLE CLEAN EXPORT (all functions defined above) ──
window.VW_CONTRACTOR = {
  // Portal pages
  renderContractorPortalPage, renderContractorPublicPortal, renderContractorSignupPage,
  // Admin management
  addContractor, saveContractor, openContractor, sharePortalLink, shareSignupLink,
  downloadMeasurementSheet, calcContractorPayout,
  renderPendingContractors, approveContractor, rejectContractor,
  // Portal tabs
  switchPortalTab, activateContractor, filterPortalStock, shareProductLink,
  addPortalRoom, removePortalRoom, createPortalQuote, readMeasurementSlip,
  openBidForm, submitBid, redeemReward, saveMarginSettings,
  // Labor marketplace
  postLaborRequirement, saveLaborRequirement,
  // Signup flow
  selectProfType, signupNextStep, signupBack, submitContractorSignup,
};

// addToMeasurement stub - adds product to active measurement session
function addToMeasurement(productId, productName) {
  if (!window._portalMeasurementSelection) window._portalMeasurementSelection = [];
  window._portalMeasurementSelection.push({ productId, productName });
  showToast(`${productName} added to measurement quote`, 'success');
}
// Add to VW_CONTRACTOR
window.VW_CONTRACTOR.addToMeasurement = addToMeasurement;




