/* === checkin.js === */

const DEFAULT_CATEGORIES = {
  'Tiles': ['Floor Tiles','Wall Tiles','Outdoor/Parking Tiles','Bathroom Tiles','Designer/Digital Tiles'],
  'Sanitary': ['Commode','Wash Basin','Bathroom Fittings','Shower & Accessories'],
  'Plywood': ['Plywood Sheets','Flush Doors','Laminates','MDF/Particle Board'],
  'Electricals': ['Switches & Sockets','Wires & Cables','Lighting','MCB/Distribution Board'],
  'Paints': ['Interior Emulsion','Exterior/Weatherproof','Wood Finishes','Primers & Putty'],
  'Plumbing': ['Pipes & Fittings','Taps & Mixers','Water Tanks','Bathroom Plumbing'],
  'Appliances': ['Fans','Geysers','Kitchen Appliances','Water Purifiers']
};
const VISITOR_TYPES = [
  { key:'brand', label:'Brand / Vendor', icon:'🏷️' },
  { key:'authority', label:'Authority / Govt', icon:'🏛️' },
  { key:'delivery', label:'Delivery', icon:'🚚' },
  { key:'pickup', label:'Pickup', icon:'📦' },
  { key:'interview', label:'Interview / HR', icon:'💼' },
  { key:'other', label:'Other', icon:'❓' }
];

let reqItems = [];
let currentCategories = null; // cached {department: [subcategories]}
let cachedTodayVisits = [];
let cachedVisitDepts = {}; // visitId -> [department names]

async function getCategories() {
  if (currentCategories) return currentCategories;
  const saved = await VW_DB.getSetting('categories', null);
  currentCategories = saved || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  return currentCategories;
}

async function getDepartmentNames() {
  const cats = await getCategories();
  return Object.keys(cats);
}

function setCategoriesCache(cats) { currentCategories = cats; }

async function renderCheckin() {
  const todayVisits = await getTodayVisits(); // fetch fresh data each time
  const active = todayVisits.filter(v=>v.status==='active'||v.status==='pending').length;
  const deptNames = await getDepartmentNames(); // needed for dept count + filter buttons
  return `
  <div class="module-header">
    <h2>Check-in</h2>
  </div>

  <!-- LIVE STATS -->
  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card gold">
      <div class="mc-label">Today's Walk-ins</div>
      <div class="mc-value" id="today-count">${todayVisits.length}</div>
    </div>
    <div class="metric-card ${active>0?'success':''}">
      <div class="mc-label">Active Now</div>
      <div class="mc-value" id="active-count">${active}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Completed</div>
      <div class="mc-value">${todayVisits.filter(v=>v.status==='completed').length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Departments</div>
      <div class="mc-value">${deptNames.length}</div>
    </div>
  </div>

  <!-- WHO'S CHECKING IN -->
  <div class="card" style="margin-bottom:12px">
    <h3 class="card-title">Who's checking in?</h3>
    <div class="entry-type-grid">
      <button class="entry-type-btn active" onclick="selectEntryType('customer', this)"><span class="et-icon">🧑‍🤝‍🧑</span>Customer</button>
      ${VISITOR_TYPES.map(v => `<button class="entry-type-btn" onclick="selectEntryType('${v.key}', this)"><span class="et-icon">${v.icon}</span>${v.label}</button>`).join('')}
    </div>
  </div>

  <div id="checkin-form-area"></div>

  <!-- TODAY'S ACTIVITY -->
  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Today's Activity</h3>
      <span style="font-size:12px;color:var(--text3)">${new Date().toLocaleDateString('en-IN',{dateStyle:'medium'})}</span>
    </div>
    <div class="search-row" style="margin-bottom:8px">
      <input type="text" id="activity-search" placeholder="🔍 Search by name" oninput="applyActivityFilters()">
      <select id="activity-status-filter" onchange="applyActivityFilters()" style="width:120px">
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
    </div>
    <div class="filter-row" style="margin-bottom:10px">
      ${deptNames.slice(0,6).map(d=>`<button class="filter-btn" onclick="document.getElementById('activity-dept-filter').value='${d}';applyActivityFilters()">${d}</button>`).join('')}
    </div>
    <select id="activity-dept-filter" onchange="applyActivityFilters()" style="display:none">
      <option value="all">All</option>
      ${deptNames.map(d=>`<option value="${d}">${d}</option>`).join('')}
    </select>
    <div id="today-visits-list" class="visit-list">${await renderTodayVisits(todayVisits)}</div>
  </div>
  `;
}

async function selectEntryType(type, btn) {
  document.querySelectorAll('.entry-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  reqItems = [];
  const area = document.getElementById('checkin-form-area');
  if (type === 'customer') {
    await getCategories();
    area.innerHTML = renderCustomerForm();
  } else {
    area.innerHTML = renderVisitorForm(type);
    loadRoutingPreview(type);
  }
}

function renderCustomerForm() {
  return `
  <div class="card" id="checkin-form-card">
    <h3 class="card-title">Customer Details</h3>
    <div class="form-group">
      <label>Customer Phone *</label>
      <input type="tel" id="ci-phone" placeholder="10-digit mobile" maxlength="10" inputmode="numeric" oninput="lookupCustomerByPhone(this.value,'visit')">
      <div id="visit-customer-lookup-status" style="font-size:12px;margin-top:4px"></div>
    </div>
    <div class="form-group"><label>Customer Name *</label><input type="text" id="visit-cust-name" placeholder="Full name"></div>
    <div class="form-group"><label>Address</label><input type="text" id="visit-cust-address" placeholder="Optional"></div>
    <div class="form-group"><label>Area</label><input type="text" id="visit-cust-area" placeholder="e.g. Bhavanipuram"></div>
    <div class="form-group">
      <label>Customer Type</label>
      <select id="ci-type">
        <option value="retail">Retail (walk-in)</option>
        <option value="b2b_pro">B2B Professional (contractor/architect)</option>
        <option value="b2b_shop">B2B Shop owner</option>
        <option value="contractor_club">Contractor Club member</option>
      </select>
    </div>
  </div>

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">What do they need? <span class="badge" id="req-count">0</span></h3>
      <button class="btn-sm" onclick="addReqItem()">+ Add Item</button>
    </div>
    <div id="req-items-list"><p class="empty-msg">Tap "+ Add Item" for each product/department they're interested in</p></div>
  </div>

  <button class="btn-primary full-width" onclick="submitCheckin()" style="margin-bottom:14px">
    <span>✓ Check In &amp; Notify Team</span>
  </button>
  `;
}

function addReqItem() {
  const id = Date.now() + Math.random();
  const depts = Object.keys(currentCategories || DEFAULT_CATEGORIES);
  const dept = depts[0];
  const subcats = (currentCategories || DEFAULT_CATEGORIES)[dept] || [];
  reqItems.push({ id, department: dept, subcategory: subcats[0] || '', description: '', qty: '', budget: '' });
  renderReqItems();
}

function removeReqItem(id) {
  reqItems = reqItems.filter(r => r.id !== id);
  renderReqItems();
}

function updateReqItem(id, field, value) {
  const item = reqItems.find(r => r.id === id);
  if (!item) return;
  item[field] = value;
  if (field === 'department') {
    const subcats = (currentCategories || DEFAULT_CATEGORIES)[value] || [];
    item.subcategory = subcats[0] || '';
    renderReqItems();
  }
}

function renderReqItems() {
  document.getElementById('req-count').textContent = reqItems.length;
  const list = document.getElementById('req-items-list');
  if (!reqItems.length) { list.innerHTML = '<p class="empty-msg">Tap the Add Item button for each product or department they are interested in</p>'; return; }
  const cats = currentCategories || DEFAULT_CATEGORIES;
  const depts = Object.keys(cats);
  list.innerHTML = reqItems.map((item, i) => {
    const subcats = cats[item.department] || [];
    return `
    <div class="req-item-card">
      <div class="req-item-header">
        <span class="req-item-no">Item ${i+1}</span>
        <button class="remove-btn" onclick="removeReqItem(${item.id})">✕</button>
      </div>
      <div class="input-row">
        <div class="form-group" style="flex:1">
          <label>Category</label>
          <select onchange="updateReqItem(${item.id},'department',this.value)">
            ${depts.map(d=>`<option ${d===item.department?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label>Sub-category</label>
          <select onchange="updateReqItem(${item.id},'subcategory',this.value)">
            ${subcats.length ? subcats.map(s=>`<option ${s===item.subcategory?'selected':''}>${s}</option>`).join('') : '<option value="">— none —</option>'}
          </select>
        </div>
      </div>
      <div class="form-group"><label>What are they looking for?</label>
        <input type="text" placeholder="e.g. 500 sqft tiles for living room" value="${item.description}" oninput="updateReqItem(${item.id},'description',this.value)"></div>
      <div class="input-row">
        <div class="form-group" style="flex:1"><label>Qty / Area</label><input type="text" placeholder="e.g. 500 sqft" value="${item.qty}" oninput="updateReqItem(${item.id},'qty',this.value)"></div>
        <div class="form-group" style="flex:1"><label>Budget (₹)</label><input type="number" placeholder="e.g. 50000" value="${item.budget}" oninput="updateReqItem(${item.id},'budget',this.value)"></div>
      </div>
    </div>`;
  }).join('');
}

async function submitCheckin() {
  const phone = document.getElementById('ci-phone').value.trim();
  const name = document.getElementById('visit-cust-name').value.trim();
  const address = document.getElementById('visit-cust-address')?.value.trim() || '';
  const area = document.getElementById('visit-cust-area')?.value.trim() || '';
  const type = document.getElementById('ci-type').value;

  if (!phone || !name) return showToast('Please fill phone and name', 'warn');
  if (phone.length < 10) return showToast('Enter valid 10-digit phone', 'warn');
  if (!reqItems.length) return showToast('Add at least one requirement item', 'warn');

  let customer;
  const existing = await VW_DB.getByIndex(VW_DB.STORES.customers, 'phone', phone);
  if (existing.length) {
    customer = existing[0];
    customer.visitCount = (customer.visitCount || 0) + 1;
    customer.lastVisit = new Date().toISOString();
    if (address && !customer.address) customer.address = address;
    if (area && !customer.city) customer.city = area;
    await VW_DB.put(VW_DB.STORES.customers, customer);
  } else {
    const newId = await VW_DB.put(VW_DB.STORES.customers, { name, phone, address, city: area, type, visitCount: 1, createdAt: new Date().toISOString(), lastVisit: new Date().toISOString() });
    customer = await VW_DB.getById(VW_DB.STORES.customers, newId);
  }

  const visitId = await VW_DB.put(VW_DB.STORES.visits, {
    customerId: customer.id, customerName: customer.name, visitorType: 'customer',
    date: new Date().toISOString(), status: 'pending', escalationLog: [], type
  });

  await VW_ESCALATION.startVisitRouting(visitId);

  for (const item of reqItems) {
    const taskId = await VW_DB.put(VW_DB.STORES.tasks, {
      visitId, customerId: customer.id, customerName: customer.name,
      department: item.department, subcategory: item.subcategory || null, description: item.description, qty: item.qty, budget: item.budget,
      status: 'pending', stage: 'Lead', escalationLog: [], createdAt: new Date().toISOString()
    });
    await VW_ESCALATION.routeTask(taskId);

    await VW_DB.put(VW_DB.STORES.leads, {
      customerId: customer.id, department: item.department, value: item.budget || '',
      stage: 'Visited', followUpDate: new Date(Date.now()+3*86400000).toISOString().split('T')[0],
      notes: item.description, taskId, createdAt: new Date().toISOString()
    });
  }

  showToast(`${name} checked in — ${reqItems.length} item(s) routed to team`, 'success');

  // Also write to Supabase visits table so security kiosk and dashboard can see it
  try {
    await VW_DB.client.from('visits').insert({
      visitor_name: name, visitor_phone: phone,
      visitor_type: 'customer', checkin_type: 'customer',
      status: 'active', security_checkin: false,
      date: new Date().toISOString(), created_at: new Date().toISOString(),
      purpose: reqItems.map(r=>r.description||r.department).join(', '),
      persons_count: 1, self_checkin_complete: true,
    });
  } catch(e) { console.warn('Supabase visit sync:', e.message); }

  // Set activeVisit so Tile Quotation auto-fills this customer
  window.activeVisit = {
    visitId, customerId: customer.id, customerName: customer.name,
    customerPhone: phone, customerArea: area || customer.city || '',
  };
  await auditLog('customer_checkin', 'customer', customer.id, customer.name, null, { phone, area }, 'Walk-in check-in');

  // Auto-generate and send portal link via WhatsApp
  try {
    const profile = VW_AUTH.getCurrentProfile();
    if (typeof generateCustomerPortalLink === 'function') {
      const token = await generateCustomerPortalLink(customer.id, phone, profile?.name||'auto_checkin');
      const link = `${window.location.origin}/?customer=${token}`;
      // Show option to send portal link (non-blocking)
      showToast(`${name} checked in ✓ — tap to send portal link`, 'success');
      setTimeout(() => {
        const el = document.getElementById('today-visits-list');
        const banner = document.createElement('div');
        banner.style.cssText = 'background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.3);border-radius:10px;padding:10px;margin-bottom:8px';
        banner.innerHTML = `<div style="font-size:12px;font-weight:600;margin-bottom:6px">📲 Send portal link to ${name}?</div>
          <button onclick="window.open('https://wa.me/91${phone.replace(/\\D/g,'')}?text='+encodeURIComponent('Welcome to V Wholesale! View your quotes & wishlist: ${link}'),'_blank');this.parentElement.remove()"
            style="background:#25D366;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;margin-right:6px">💬 Send via WhatsApp</button>
          <button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:11px;color:var(--text3);cursor:pointer">Skip</button>`;
        if (el) el.insertAdjacentElement('beforebegin', banner);
      }, 1000);
    }
  } catch(e) { console.log('Portal link error:', e.message); }

  reqItems = [];
  document.getElementById('checkin-form-area').innerHTML = renderCustomerForm();

  const todayVisits = await getTodayVisits();
  document.getElementById('today-visits-list').innerHTML = await renderTodayVisits(todayVisits);
  document.getElementById('today-count').textContent = todayVisits.length;
  document.getElementById('active-count').textContent = todayVisits.filter(v=>v.status==='active'||v.status==='pending').length;
}

function renderVisitorForm(type) {
  const meta = VISITOR_TYPES.find(v=>v.key===type);
  const purposePlaceholders = {
    interview: 'Position applying for',
    delivery: 'PO number / supplier',
    pickup: 'What are they collecting',
  };
  return `
  <div class="card" id="checkin-form-card">
    <h3 class="card-title">${meta.icon} ${meta.label} Check-in</h3>
    <div class="form-group"><label>Name *</label><input type="text" id="v-name" placeholder="Visitor name"></div>
    <div class="form-group"><label>Organization / Company</label><input type="text" id="v-org" placeholder="e.g. Kajaria Ceramics"></div>
    <div class="form-group"><label>Phone (optional)</label><input type="tel" id="v-phone" placeholder="10-digit mobile" maxlength="10"></div>
    <div class="form-group"><label>Purpose / Notes</label><input type="text" id="v-purpose" placeholder="${purposePlaceholders[type] || 'Reason for visit'}"></div>
    <div class="form-group"><label>Who will be notified?</label>
      <div id="v-routing-preview" class="routing-preview">Loading...</div>
    </div>
    <button class="btn-primary full-width" onclick="submitVisitorCheckin('${type}')">✓ Check In &amp; Notify</button>
  </div>`;
}

async function submitVisitorCheckin(type) {
  const name = document.getElementById('v-name').value.trim();
  const org = document.getElementById('v-org').value.trim();
  const phone = document.getElementById('v-phone').value.trim();
  const purpose = document.getElementById('v-purpose').value.trim();
  if (!name) return showToast('Visitor name is required', 'warn');

  const routing = await VW_DB.getSetting('visitorRouting', {});
  const targetList = routing[type] || [];
  let staff = await VW_DB.all(VW_DB.STORES.staff).catch(()=>[]);

  // Fallback: if IDB staff is empty, fetch from Supabase profiles
  if (!staff.length) {
    const { data: sbStaff } = await VW_DB.client.from('profiles')
      .select('id,name,role,phone').eq('status','approved')
      .in('role',['executive','sr_executive','tl','floor_manager','store_manager','management','admin'])
      .order('name').limit(20);
    staff = (sbStaff||[]).map(s=>({ id:s.id, name:s.name, role:s.role, phone:s.phone }));
  }

  // Backward-compat: older saved routing stored staff names (unordered);
  // newer stores numeric IDs in priority order. Preserve list order.
  let targets = targetList
    .map(entry => typeof entry === 'number' ? staff.find(s => s.id === entry) : staff.find(s => s.name === entry))
    .filter(Boolean);

  // Ultimate fallback: if routing config resolves to nobody, use first available executive
  if (!targets.length && staff.length) {
    const exec = staff.find(s=>['executive','sr_executive','tl'].includes(s.role)) || staff[0];
    if (exec) targets = [exec];
  }

  const visitId = await VW_DB.put(VW_DB.STORES.visits, {
    customerId: null, customerName: name, visitorType: type, organization: org, visitorPhone: phone, purpose,
    date: new Date().toISOString(), status: 'pending', meetingStatus: 'pending',
    visitorRoutingList: targets.map(t=>t.id),
    escalationLog: []
  });

  // Notify only the FIRST person on the ranked list — if they don't accept
  // within the usual escalation window, it moves to the next, and so on,
  // same pattern as visit/task/quotation escalation elsewhere in the app.
  if (targets.length) {
    const first = targets[0];
    await VW_NOTIFY.notify('visitor', null, [name, VISITOR_TYPES.find(v=>v.key===type).label], first.language || 'en', `visitor-${visitId}`);
    const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
    visit.escalationLog = [{ level: 'visitor_routing', staffId: first.id, name: first.name, notifiedAt: new Date().toISOString(), status: 'pending' }];
    await VW_DB.put(VW_DB.STORES.visits, visit);
  }

  showToast(`${name} checked in. ${targets[0]?.name || 'Reception'} notified.`, 'success');
  document.getElementById('checkin-form-area').innerHTML = '';
  const btns = document.querySelectorAll('.entry-type-btn');
  btns.forEach((b,i)=>b.classList.toggle('active', i===0));

  const todayVisits = await getTodayVisits();
  document.getElementById('today-visits-list').innerHTML = await renderTodayVisits(todayVisits);
  document.getElementById('today-count').textContent = todayVisits.length;
}

async function loadRoutingPreview(type) {
  const routing = await VW_DB.getSetting('visitorRouting', {});
  const targetList = routing[type] || [];
  const el = document.getElementById('v-routing-preview');
  if (!el) return;
  if (!targetList.length) { el.textContent = 'Reception (no contact configured)'; return; }

  // Try IDB staff first (has integer IDs matching the routing)
  let staff = await VW_DB.all(VW_DB.STORES.staff).catch(()=>[]);
  if (staff.length) {
    const names = targetList
      .map(entry => staff.find(s => s.id === entry || s.name === entry))
      .filter(Boolean).map(s => s.name);
    el.textContent = names.length ? names.join(' → ') : 'Reception (no match)';
    return;
  }

  // IDB is empty — routing uses integer IDs. Fall back to Supabase profiles
  // by position: get first available executives to show as "will notify"
  const { data: sbStaff } = await VW_DB.client.from('profiles')
    .select('id,name,role').eq('status','approved')
    .in('role',['executive','sr_executive','tl','floor_manager','store_manager','management','admin'])
    .order('name').limit(6);
  const executives = sbStaff || [];
  if (executives.length) {
    // Show the first person who would be notified (can't match int IDs to UUIDs, so use first exec)
    el.textContent = executives[0].name + (executives.length > 1 ? ` + ${executives.length - 1} backup` : '');
  } else {
    el.textContent = 'Reception (configure in Settings → Visitor Routing)';
  }
}

async function getTodayVisits() {
  // Fetch from BOTH Supabase (security kiosk entries) and IndexedDB (staff check-ins)
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

  // Supabase visits (security kiosk + any synced)
  let supaVisits = [];
  try {
    const { data } = await VW_DB.client.from('visits')
      .select('id,visitor_name,customer_name,visitor_type,checkin_type,visitor_phone,status,date,created_at,persons_count,meeting_person,company_name,security_checkin,purpose,notes')
      .gte('date', todayStart).lte('date', todayEnd)
      .order('date', { ascending: false }).limit(100);
    supaVisits = (data || []).map(v => ({
      id: 'sb_'+v.id,
      customerName: v.visitor_name || v.customer_name || 'Walk-in',
      visitorType: v.checkin_type || v.visitor_type || 'customer',
      visitorPhone: v.visitor_phone || '',
      status: v.status || 'pending',
      date: v.date || v.created_at,
      organization: v.company_name || '',
      purpose: v.purpose || v.notes || '',
      meetingPerson: v.meeting_person || '',
      personsCount: v.persons_count || 1,
      _source: 'supabase',
    }));
  } catch(e) { console.warn('Supabase visit fetch:', e.message); }

  // IndexedDB visits (staff check-in form)
  let idbVisits = [];
  try {
    const all = await VW_DB.all(VW_DB.STORES.visits);
    const todayStr = today.toDateString();
    idbVisits = all.filter(v => new Date(v.date).toDateString() === todayStr)
      .map(v => ({ ...v, _source:'idb' })).reverse();
  } catch(e) { console.warn('IDB visit fetch:', e.message); }

  // Merge, deduplicate by source+id
  const merged = [...supaVisits, ...idbVisits];
  cachedTodayVisits = merged.sort((a,b) => new Date(b.date) - new Date(a.date));

  const tasks = await VW_DB.all(VW_DB.STORES.tasks).catch(()=>[]);
  cachedVisitDepts = {};
  tasks.forEach(t => { (cachedVisitDepts[t.visitId] = cachedVisitDepts[t.visitId] || []).push(t.department); });

  return cachedTodayVisits;
}

async function applyActivityFilters() {
  const search = (document.getElementById('activity-search')?.value || '').toLowerCase().trim();
  const status = document.getElementById('activity-status-filter')?.value || 'all';
  const dept = document.getElementById('activity-dept-filter')?.value || 'all';

  const filtered = cachedTodayVisits.filter(v => {
    if (search && !(v.customerName||'').toLowerCase().includes(search)) return false;
    if (status !== 'all' && v.status !== status) return false;
    if (dept !== 'all' && !(cachedVisitDepts[v.id]||[]).includes(dept)) return false;
    return true;
  });

  const list = document.getElementById('today-visits-list');
  if (list) list.innerHTML = await renderTodayVisits(filtered);
}

async function renderTodayVisits(visits) {
  if (!visits.length) return '<p class="empty-msg">No activity yet today</p>';
  return visits.map(v => {
    // Type icon mapping (handles both old and new checkin_type values)
    const typeIconMap = {
      customer:'🧑‍🤝‍🧑', vendor:'🚚', supplier:'🚚', delivery:'🚚', product_return:'🔄',
      payment:'💵', sample:'📦', other:'🏢', other_self:'🏢', other_notify:'🔔',
      bank:'🏦', inspector:'🔍', contractor:'🏗', interview:'👤', official:'🏛', media:'📰',
    };
    const vtype = v.visitorType || v.checkin_type || 'other';
    const isCustomer = vtype === 'customer';
    const isSecurity = !!v._source || v.security_checkin;
    const icon = typeIconMap[vtype] || '❓';
    const meta = VISITOR_TYPES?.find(t=>t.key===vtype);
    const label = isCustomer ? 'Customer' : (meta?.label || vtype.replace(/_/g,' '));

    // Status label
    const statusMap = { pending:'⏳ Waiting', active:'🟡 In Progress', completed:'✅ Done', closed:'✅ Done' };
    let statusColor = v.status==='completed'||v.status==='closed' ? 'var(--green)' : v.status==='active' ? 'var(--gold)' : '#888';
    const statusText = statusMap[v.status] || v.status;

    // Extra info for kiosk entries
    const extra = isSecurity ? [
      v.personsCount > 1 ? `${v.personsCount} persons` : '',
      v.meetingPerson ? `Meeting: ${v.meetingPerson}` : '',
      v.organization || '',
    ].filter(Boolean).join(' · ') : '';

    // Use safe ID for onclick (Supabase entries have 'sb_' prefix)
    const safeId = String(v.id).startsWith('sb_') ? `'${v.id}'` : v.id;
    const time = new Date(v.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

    return `
    <div class="visit-row" onclick="openVisitDetail(${safeId})" style="cursor:pointer">
      <div class="visit-avatar">${icon}</div>
      <div class="visit-info">
        <div class="visit-name">${v.customerName || 'Walk-in'}${v.personsCount>1?' +'+((v.personsCount||1)-1):''}</div>
        <div class="visit-meta">${label} · ${time}${isSecurity?' · 🔒 Kiosk':''}${extra?' · '+extra:''}</div>
      </div>
      <div class="visit-status" style="color:${statusColor};font-size:11px">${statusText}</div>
    </div>`;
  }).join('');
}

async function openVisitDetail(visitId) {
  const sheet = document.getElementById('bottom-sheet');

  // Handle Supabase kiosk entries (id prefixed with 'sb_')
  if (String(visitId).startsWith('sb_')) {
    const numId = String(visitId).replace('sb_','');
    const { data: sv } = await VW_DB.client.from('visits').select('*').eq('id', numId).single();
    if (!sv) return;
    const typeIconMap = { customer:'🧑‍🤝‍🧑', vendor:'🚚', other:'🏢', other_self:'🏢', other_notify:'🔔' };
    const icon = typeIconMap[sv.checkin_type||sv.visitor_type] || '🏢';
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>${icon} ${sv.visitor_name||'Visitor'}</h3>
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">${new Date(sv.date||sv.created_at).toLocaleString('en-IN')} · Kiosk check-in</div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;font-size:12px">
        ${sv.visitor_phone?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Phone</span><span>${sv.visitor_phone}</span></div>`:''}
        ${sv.company_name?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Company</span><span>${sv.company_name}</span></div>`:''}
        ${sv.persons_count>1?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Persons</span><span>${sv.persons_count}</span></div>`:''}
        ${sv.meeting_person?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Meeting</span><span>${sv.meeting_person}</span></div>`:''}
        ${sv.purpose||sv.notes?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Purpose</span><span style="text-align:right;max-width:60%">${sv.purpose||sv.notes}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Status</span><span style="color:var(--gold)">${sv.status}</span></div>
      </div>
      ${sv.meeting_person_phone?`<a href="https://wa.me/91${sv.meeting_person_phone.replace(/\D/g,'').replace(/^91/,'')}" target="_blank" style="display:block;margin-top:10px;padding:10px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);border-radius:10px;color:#25d366;font-weight:700;text-align:center;font-size:13px;text-decoration:none">📱 WhatsApp ${sv.meeting_person}</a>`:''}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button onclick="VW_CHECKIN.updateKioskVisitStatus(${numId},'active')" style="flex:1;padding:8px;border-radius:8px;background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);color:var(--gold);font-size:12px;cursor:pointer">🟡 Active</button>
        <button onclick="VW_CHECKIN.updateKioskVisitStatus(${numId},'completed')" style="flex:1;padding:8px;border-radius:8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:var(--green);font-size:12px;cursor:pointer">✅ Complete</button>
        <button onclick="closeSheet()" style="padding:8px 14px;border-radius:8px;background:var(--bg3);border:1px solid var(--border);color:var(--text3);font-size:12px;cursor:pointer">✕</button>
      </div>`;
    sheet.classList.add('open');
    document.getElementById('sheet-overlay').classList.add('open');
    return;
  }

  // IDB visit (existing logic)
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);

  if (visit.visitorType === 'customer') {
    const customer = await VW_DB.getById(VW_DB.STORES.customers, visit.customerId);
    const tasks = await VW_DB.getByIndex(VW_DB.STORES.tasks, 'visitId', visitId);
    const phone = VW_AUTH.maskPhone(customer?.phone, visit);

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>${customer?.name || 'Customer'}</h3>
      <p class="sheet-meta">${phone} · ${new Date(visit.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
      ${renderCheckinEscalationTimeline(visit.escalationLog)}
      <div class="sheet-section-label">Requirements (${tasks.length})</div>
      ${tasks.map(t => renderTaskCard(t)).join('')}
      <div class="sheet-actions">
        ${visit.status === 'pending' ? `<button class="btn-primary" onclick="acceptVisitUI(${visit.id})">✓ I'll Handle This</button>` : ''}
        ${visit.status !== 'completed' ? `<button class="btn-secondary" onclick="closeVisitUI(${visit.id})">✓ Close Visit (Customer Leaving)</button>` : '<div class="badge" style="font-size:13px">Visit Completed</div>'}
        <button class="btn-wa" onclick="openWhatsApp('${customer?.phone}','${customer?.name}')">💬 WhatsApp Customer</button>
        ${customer?.phone ? `<button class="btn-call" onclick="callPhone('${customer.phone}')">📞 Call</button>` : ''}
      </div>
    `;
  } else {
    const meta = VISITOR_TYPES.find(t=>t.key===visit.visitorType) || {label: visit.visitorType, icon:'❓'};
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>${meta.icon} ${visit.customerName}</h3>
      <p class="sheet-meta">${meta.label}${visit.organization ? ' · '+visit.organization : ''} · ${new Date(visit.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
      ${visit.purpose ? `<p class="sheet-notes">${visit.purpose}</p>` : ''}
      ${visit.notifiedStaff && visit.notifiedStaff.length ? `<p style="font-size:12px;color:var(--text3);margin-bottom:12px">Notified: ${visit.notifiedStaff.map(s=>s.name).join(', ')}</p>` : ''}
      ${visit.meetingStatus === 'pending' ? `
        <div class="form-group"><label>Meeting Time</label><input type="time" id="v-meeting-time" value="${new Date(Date.now()+15*60000).toTimeString().slice(0,5)}"></div>
        <div class="form-group"><label>Note for visitor</label><input type="text" id="v-meeting-note" placeholder="e.g. Meet at counter, ask for Balaji"></div>
        <div class="sheet-actions">
          <button class="btn-primary" onclick="acceptVisitor(${visit.id})">✓ Accept</button>
          <button class="btn-secondary" onclick="declineVisitor(${visit.id})">✕ Decline</button>
        </div>
      ` : visit.meetingStatus === 'accepted' ? `
        <div class="ref-result" style="margin-bottom:12px"><span class="ref-pct">Meeting confirmed</span><span class="ref-bonus" style="font-size:16px">${visit.meetingTime||''}</span></div>
        ${visit.meetingNotes ? `<p class="sheet-notes">${visit.meetingNotes}</p>` : ''}
        <div class="sheet-actions">
          ${visit.visitorPhone ? `<button class="btn-wa" onclick="openWhatsApp('${visit.visitorPhone}','${visit.customerName}')">💬 WhatsApp Visitor</button><button class="btn-call" onclick="callPhone('${visit.visitorPhone}')">📞 Call</button>` : ''}
          <button class="btn-secondary" onclick="closeVisitUI(${visit.id})">✓ Mark Completed</button>
        </div>
      ` : `<div class="badge" style="font-size:13px;color:var(--red)">Declined</div>`}
    `;
  }
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function renderCheckinEscalationTimeline(log) {
  if (!log || !log.length) return '';
  return `<div class="escalation-timeline">
    ${log.map(l => {
      const isUrgentLevel = ['floor_manager','store_manager','management'].includes(l.level);
      const statusIcon = l.status === 'accepted' ? '✅' : (isUrgentLevel && l.status === 'pending') ? '🚨' : l.status === 'pending' ? '⏳' : '⏭️';
      const who = l.name || (l.names ? l.names.join(', ') : 'Team');
      const levelLabel = VW_ESCALATION.LEVEL_LABELS[l.level] || l.level;
      return `<div class="esc-row"><span>${statusIcon}</span><span class="esc-name">${levelLabel}: ${who}</span><span class="esc-time">${new Date(l.notifiedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span></div>`;
    }).join('')}
  </div>`;
}

function renderTaskCard(t) {
  const stageColors = { Lead:'#888', Visited:'#378ADD', Quoted:'#EF9F27', Negotiating:'#7F77DD', Won:'#22c55e', Lost:'#ef4444' };
  return `
  <div class="task-card" onclick="openTaskDetail(${t.id})">
    <div class="task-card-header">
      <span class="task-dept">${t.department}${t.subcategory ? ' &middot; '+t.subcategory : ''}</span>
      <span class="task-stage" style="color:${stageColors[t.stage]||'#888'}">${t.stage||'Lead'}</span>
    </div>
    <div class="task-desc">${t.description || 'No description'}</div>
    <div class="task-meta">${t.qty?t.qty+' · ':''}${t.budget?'₹'+Number(t.budget).toLocaleString('en-IN'):''} ${t.assignedToName ? '· '+t.assignedToName : ''}</div>
  </div>`;
}

async function acceptVisitUI(visitId) {
  await VW_ESCALATION.acceptVisit(visitId);
  showToast("Visit accepted — you're now handling this customer", 'success');
  closeSheet();

  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  const customer = visit.customerId ? await VW_DB.getById(VW_DB.STORES.customers, visit.customerId) : null;

  if (customer && customer.phone) {
    const profile = VW_AUTH.getCurrentProfile();
    const handlerName = profile ? profile.name : 'our team';
    const tasks = await VW_DB.getByIndex(VW_DB.STORES.tasks, 'visitId', visitId);
    const deptList = [...new Set(tasks.map(t=>t.department))].join(', ');

    const msg = VW_NOTIFY.waEncode(VW_NOTIFY.bilingual(
      `Hello ${customer.name}! 🏠 Welcome to V Wholesale, Vijayawada. ${handlerName} will be assisting you today${deptList ? ' with your ' + deptList + ' requirements' : ''}. Let us know if you need anything!`,
      `నమస్కారం ${customer.name}! 🏠 వీ హోల్‌సేల్, విజయవాడకు స్వాగతం. ఈరోజు ${handlerName}${deptList ? ' మీ ' + deptList + ' అవసరాలలో' : ''} సహాయం చేస్తారు. మీకు ఏదైనా అవసరమైతే తెలియజేయండి!`
    ));
    const link = `https://wa.me/91${customer.phone}?text=${msg}`;

    const sheet = document.getElementById('bottom-sheet');
    sheet.innerHTML = `<div class="sheet-handle"></div><h3>Send Welcome Message?</h3>
      <p class="sheet-meta">Let ${customer.name} know ${handlerName} is assisting them today.</p>
      <div class="sheet-actions">
        <button class="btn-wa" onclick="window.open('${link}','_blank');closeSheet()">💬 Send via WhatsApp</button>
        <button class="btn-secondary" onclick="closeSheet()">Skip</button>
      </div>`;
    sheet.classList.add('open');
    document.getElementById('sheet-overlay').classList.add('open');
    return;
  }

  navigateTo('checkin');
}

async function closeVisitUI(visitId) {
  await showVisitCloseoutForm(visitId);
}

// ---------- VISIT CLOSE-OUT FORM ----------
// Shown every time a visit is closed. Everything here is optional and
// skippable — staff can tap "Close Visit" immediately without filling
// anything in, or take a moment to capture what happened, photos of what
// was selected/any issues, and an existing quotation/estimate the customer
// brought in (which routes to the Quotation Department with OCR).
let closeoutDraft = {};

async function showVisitCloseoutForm(visitId) {
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (!visit) return;
  closeoutDraft = { selectedItemsPhotos: [], issuePhotos: [], existingQuotePhoto: null, existingQuotePhotoDataUrl: null };

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Closing Visit — ${visit.customerName || 'Customer'}</h3>
    <p class="sheet-meta">Everything below is optional — fill in what's useful, skip the rest.</p>

    <div class="form-group">
      <label>What happened? (outcome notes)</label>
      <textarea id="co-notes" rows="3" placeholder="e.g. Customer liked the tiles but wants to compare with another shop's pricing before deciding"></textarea>
    </div>
    <div class="form-group">
      <label>Follow-up date / next visit plan</label>
      <input type="date" id="co-followup-date">
      <input type="text" id="co-followup-plan" placeholder="e.g. Call back after they check with their contractor" style="margin-top:6px">
    </div>

    <div class="form-group">
      <label>📸 Photos of items selected</label>
      <input type="file" id="co-selected-photos" accept="image/*" capture="environment" multiple onchange="handleCloseoutPhotoSelect(this,'selectedItemsPhotos')">
      <div id="co-selected-preview" class="photo-preview-row"></div>
    </div>
    <div class="form-group">
      <label>⚠️ Photos of any issues</label>
      <input type="file" id="co-issue-photos" accept="image/*" capture="environment" multiple onchange="handleCloseoutPhotoSelect(this,'issuePhotos')">
      <div id="co-issue-preview" class="photo-preview-row"></div>
    </div>
    <div class="form-group">
      <label>📋 Existing Quotation / Estimate the customer brought (if any)</label>
      <p style="font-size:11px;color:var(--text3);margin-bottom:6px">A photo of this gets sent to the Quotation Department, who'll prepare a matching quote and share it back to you on WhatsApp to forward to the customer.</p>
      <input type="file" id="co-quote-photo" accept="image/*" capture="environment" onchange="handleCloseoutQuotePhoto(this)">
      <div id="co-quote-preview" class="photo-preview-row"></div>
    </div>

    <button class="btn-primary full-width" style="margin-top:12px" onclick="finalizeVisitClose(${visitId})">Close Visit</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="finalizeVisitClose(${visitId}, true)">Skip All — Just Close</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showVisitCloseoutForm = showVisitCloseoutForm;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleCloseoutPhotoSelect(input, field) {
  const files = [...input.files];
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file);
    closeoutDraft[field].push(dataUrl);
  }
  const previewId = field === 'selectedItemsPhotos' ? 'co-selected-preview' : 'co-issue-preview';
  renderCloseoutPreview(previewId, closeoutDraft[field], field);
}
window.handleCloseoutPhotoSelect = handleCloseoutPhotoSelect;

async function handleCloseoutQuotePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  closeoutDraft.existingQuotePhotoDataUrl = dataUrl;
  renderCloseoutPreview('co-quote-preview', [dataUrl], 'existingQuotePhotoDataUrl');
}
window.handleCloseoutQuotePhoto = handleCloseoutQuotePhoto;

function renderCloseoutPreview(containerId, photos, field) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = photos.map((p,i) => `
    <div class="photo-thumb">
      <img src="${p}">
      <button onclick="removeCloseoutPhoto('${field}',${i},'${containerId}')">✕</button>
    </div>`).join('');
}

function removeCloseoutPhoto(field, idx, containerId) {
  if (field === 'existingQuotePhotoDataUrl') {
    closeoutDraft.existingQuotePhotoDataUrl = null;
    document.getElementById(containerId).innerHTML = '';
  } else {
    closeoutDraft[field].splice(idx, 1);
    renderCloseoutPreview(containerId, closeoutDraft[field], field);
  }
}
window.removeCloseoutPhoto = removeCloseoutPhoto;

async function finalizeVisitClose(visitId, skipAll = false) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `<div class="sheet-handle"></div><h3>Closing visit...</h3><div class="loading-state"><div class="spinner"></div></div>`;

  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (!skipAll && visit) {
    visit.outcomeNotes = document.getElementById('co-notes')?.value || '';
    const followDate = document.getElementById('co-followup-date')?.value || '';
    const followPlan = document.getElementById('co-followup-plan')?.value || '';
    visit.followUpDate = followDate || visit.followUpDate;
    visit.followUpPlan = followPlan;

    // Upload any selected photos to Storage, save the resulting paths.
    try {
      const selectedPaths = [];
      for (const dataUrl of closeoutDraft.selectedItemsPhotos) {
        selectedPaths.push(await VW_DB.uploadPhoto(dataUrl, `visit-${visitId}/selected`));
      }
      visit.selectedItemsPhotos = selectedPaths;

      const issuePaths = [];
      for (const dataUrl of closeoutDraft.issuePhotos) {
        issuePaths.push(await VW_DB.uploadPhoto(dataUrl, `visit-${visitId}/issues`));
      }
      visit.issuePhotos = issuePaths;

      if (closeoutDraft.existingQuotePhotoDataUrl) {
        const quotePath = await VW_DB.uploadPhoto(closeoutDraft.existingQuotePhotoDataUrl, `visit-${visitId}/existing-quote`);
        visit.existingQuotePhoto = quotePath;
        visit.quoteRequestStatus = 'pending';
        await VW_DB.put(VW_DB.STORES.visits, visit);
        await notifyQuotationDepartment(visit, closeoutDraft.existingQuotePhotoDataUrl);
      }
    } catch (e) {
      console.error('Photo upload error:', e);
      showToast('Some photos could not be uploaded — closing visit anyway', 'warn');
    }

    await VW_DB.put(VW_DB.STORES.visits, visit);
  }

  const link = await VW_ESCALATION.closeVisit(visitId);
  showToast('Visit closed', 'success');
  closeSheet();
  if (link) {
    const fbSheet = document.getElementById('bottom-sheet');
    fbSheet.innerHTML = `<div class="sheet-handle"></div><h3>Send Feedback Request?</h3><p class="sheet-meta">Send a WhatsApp message with a feedback link to the customer.</p>
      <div class="sheet-actions"><button class="btn-wa" onclick="window.open('${link}','_blank');closeSheet()">💬 Send via WhatsApp</button><button class="btn-secondary" onclick="closeSheet()">Skip</button></div>`;
    fbSheet.classList.add('open');
    document.getElementById('sheet-overlay').classList.add('open');
  }
  navigateTo('checkin');
}
window.finalizeVisitClose = finalizeVisitClose;

// Notifies everyone in the Quotation Department (people tagged
// is_quotation_dept=true, plus anyone with Billing permission) that a
// customer's existing quotation/estimate photo needs a matching quote
// prepared. Also kicks off OCR in the background so there's a structured
// starting point waiting for them when they open it.
async function notifyQuotationDepartment(visit, photoDataUrl) {
  const profiles = await VW_DB.all(VW_DB.STORES.profiles);
  const recipients = profiles.filter(p =>
    p.status === 'approved' && (p.isQuotationDept || (Array.isArray(p.permissions) && p.permissions.includes('billing')))
  );
  for (const r of recipients) {
    await VW_NOTIFY.notify('quote_request_received', null, [visit.customerName || 'a customer'], 'en', `quote-request-${visit.id}`);
  }

  // Fire OCR in the background — don't block visit closing on it.
  runQuotationOcr(visit.id, photoDataUrl).catch(e => console.error('OCR error:', e));
}

async function runQuotationOcr(visitId, photoDataUrl) {
  const [header, base64] = photoDataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mediaType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-quotation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ imageBase64: base64, mediaType })
  });
  const result = await res.json();
  if (!res.ok) { console.error('OCR failed:', result.error); return; }

  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  if (visit) {
    visit.existingQuoteOcr = result.data;
    await VW_DB.put(VW_DB.STORES.visits, visit);
  }
}

async function acceptVisitor(visitId) {
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  const time = document.getElementById('v-meeting-time').value;
  const note = document.getElementById('v-meeting-note').value;
  const profile = VW_AUTH.getCurrentProfile();
  visit.meetingStatus = 'accepted';
  visit.meetingTime = time;
  visit.meetingNotes = note;
  visit.status = 'active';
  visit.acceptedBy = profile ? profile.name : 'Staff';
  await VW_DB.put(VW_DB.STORES.visits, visit);

  if (visit.visitorPhone) {
    const handlerName = profile ? profile.name : 'our team';
    const msg = VW_NOTIFY.waEncode(VW_NOTIFY.bilingual(
      `Hello ${visit.customerName}! 🏠 Welcome to V Wholesale, Vijayawada. Your meeting is confirmed for ${time} with ${handlerName}. ${note || ''} See you soon!`,
      `నమస్కారం ${visit.customerName}! 🏠 వీ హోల్‌సేల్, విజయవాడకు స్వాగతం. మీ మీటింగ్ ${time} గంటలకు ${handlerName}తో ఖరారు చేయబడింది. ${note || ''} త్వరలో కలుద్దాం!`
    ));
    window.open(`https://wa.me/91${visit.visitorPhone}?text=${msg}`, '_blank');
  }
  showToast('Visitor accepted & notified', 'success');
  closeSheet();
  navigateTo('checkin');
}

async function declineVisitor(visitId) {
  const visit = await VW_DB.getById(VW_DB.STORES.visits, visitId);
  visit.meetingStatus = 'declined';
  visit.status = 'completed';
  await VW_DB.put(VW_DB.STORES.visits, visit);
  showToast('Visitor marked as declined', 'warn');
  closeSheet();
  navigateTo('checkin');
}

async function updateKioskVisitStatus(sbId, status) {
  await VW_DB.client.from('visits').update({ status }).eq('id', sbId);
  showToast('Status updated ✓', 'success');
  closeSheet();
  const todayVisits = await getTodayVisits();
  const el = document.getElementById('today-visits-list');
  if (el) el.innerHTML = await renderTodayVisits(todayVisits);
}

window.VW_CHECKIN = {
  renderCheckin, selectEntryType, addReqItem, removeReqItem, updateReqItem,
  submitCheckin, submitVisitorCheckin, loadRoutingPreview,
  openVisitDetail, acceptVisitUI, closeVisitUI, acceptVisitor, declineVisitor,
  getTodayVisits, renderTodayVisits, getCategories, getDepartmentNames, setCategoriesCache, applyActivityFilters,
  updateKioskVisitStatus,
};
window.selectEntryType = selectEntryType;
window.applyActivityFilters = applyActivityFilters;
window.submitVisitorCheckin = submitVisitorCheckin;
window.addReqItem = addReqItem;
window.removeReqItem = removeReqItem;
window.updateReqItem = updateReqItem;
window.openVisitDetail = openVisitDetail;
window.acceptVisitUI = acceptVisitUI;
window.closeVisitUI = closeVisitUI;
window.acceptVisitor = acceptVisitor;
window.declineVisitor = declineVisitor;

// =====================================================
// SECURITY SELF-CHECKIN KIOSK
// A simple 3-button screen for security guard at entrance
// Notifies relevant staff when visitor arrives
// =====================================================

async function renderSecurityKioskPage() {
  const todayVisits = await getTodayVisits();
  const recentVisits = todayVisits.slice(-5).reverse();

  // Fetch staff for meeting-person dropdown (vendor case)
  const { data: staffList } = await VW_DB.client
    .from('profiles').select('id,name,phone,role')
    .in('role',['admin','store_manager','floor_manager','tl','sr_executive','executive','management','accounts'])
    .eq('is_active',true).order('name').limit(40);
  const staff = staffList || [];

  // Store staff list globally for use in sheet functions
  window._kioskStaff = staff;

  const timeStr = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  const dateStr = new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});

  return `
  <div style="min-height:100vh;background:var(--bg);padding:20px;display:flex;flex-direction:column;align-items:center">
    <div style="text-align:center;margin-bottom:28px;margin-top:10px">
      <div style="font-size:18px;font-weight:800;color:var(--text);font-family:'Syne',sans-serif">V Wholesale</div>
      <div style="font-size:13px;color:var(--text2);margin-top:2px">Security Check-in</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${dateStr} · ${timeStr}</div>
    </div>

    <div style="width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px;margin-bottom:24px">

      <!-- CUSTOMER -->
      <button onclick="VW_CHECKIN.kioskCustomer()" style="background:var(--header-bg);border:2px solid var(--gold-border);border-radius:20px;padding:24px 20px;display:flex;align-items:center;gap:16px;cursor:pointer;width:100%;text-align:left;-webkit-tap-highlight-color:transparent">
        <div style="font-size:44px;flex-shrink:0">🧑‍🤝‍🧑</div>
        <div>
          <div style="font-size:19px;font-weight:800;color:#fff;font-family:'Syne',sans-serif">Customer</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:3px">First available executive will be notified</div>
        </div>
      </button>

      <!-- VENDOR / DELIVERY -->
      <button onclick="VW_CHECKIN.kioskVendor()" style="background:var(--bg2);border:2px solid rgba(96,165,250,0.35);border-radius:20px;padding:24px 20px;display:flex;align-items:center;gap:16px;cursor:pointer;width:100%;text-align:left;-webkit-tap-highlight-color:transparent">
        <div style="font-size:44px;flex-shrink:0">🚚</div>
        <div>
          <div style="font-size:19px;font-weight:800;color:var(--text);font-family:'Syne',sans-serif">Vendor / Delivery</div>
          <div style="font-size:12px;color:var(--text3);margin-top:3px">Self check-in required · Meeting person notified</div>
        </div>
      </button>

      <!-- OTHER -->
      <button onclick="VW_CHECKIN.kioskOther()" style="background:var(--bg2);border:2px solid var(--border);border-radius:20px;padding:24px 20px;display:flex;align-items:center;gap:16px;cursor:pointer;width:100%;text-align:left;-webkit-tap-highlight-color:transparent">
        <div style="font-size:44px;flex-shrink:0">🏢</div>
        <div>
          <div style="font-size:19px;font-weight:800;color:var(--text);font-family:'Syne',sans-serif">Other Visitor</div>
          <div style="font-size:12px;color:var(--text3);margin-top:3px">Self check-in or notify staff</div>
        </div>
      </button>
    </div>

    ${recentVisits.length ? `
    <div style="width:100%;max-width:380px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Today's Entries (${todayVisits.length})</div>
      ${recentVisits.map(v => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:18px">${v.checkin_type==='customer'?'🧑‍🤝‍🧑':v.checkin_type==='vendor'?'🚚':'🏢'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${v.visitor_name||v.customer_name||'Walk-in'}${v.persons_count>1?` + ${v.persons_count-1} more`:''}</div>
          <div style="font-size:10px;color:var(--text3)">${v.checkin_type||v.visitor_type||'—'} · ${new Date(v.date||v.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <span style="font-size:10px;padding:2px 7px;border-radius:6px;background:${v.status==='active'?'rgba(34,197,94,0.12)':'var(--bg3)'};color:${v.status==='active'?'var(--green)':'var(--text3)'};white-space:nowrap">${v.status}</span>
      </div>`).join('')}
    </div>` : ''}

    <div style="margin-top:20px;text-align:center">
      <button onclick="VW_CHECKIN.exitKioskToStaffCheckin()" style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:8px 18px;color:var(--text3);font-size:12px;cursor:pointer">
        → Staff Check-in (requires login)
      </button>
    </div>
  </div>`;
}

function _personsField(defaultVal) {
  return `<div class="form-group"><label>No. of Persons *</label>
    <div style="display:flex;gap:8px">
      ${[1,2,3,4,5].map(n=>`<button type="button" id="kp-${n}" onclick="VW_CHECKIN.setPersCount(${n})"
        style="flex:1;padding:10px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;border:${n===defaultVal?'2px solid var(--gold)':'1px solid var(--border)'};background:${n===defaultVal?'rgba(245,200,66,0.1)':'var(--bg2)'};color:${n===defaultVal?'var(--gold)':'var(--text2)'}">
        ${n}${n===5?'+':''}
      </button>`).join('')}
    </div>
    <input type="hidden" id="kiosk-persons" value="${defaultVal}">
  </div>`;
}

function setPersCount(n) {
  document.getElementById('kiosk-persons').value = n;
  [1,2,3,4,5].forEach(i => {
    const b = document.getElementById('kp-'+i);
    if (!b) return;
    b.style.border = i===n ? '2px solid var(--gold)' : '1px solid var(--border)';
    b.style.background = i===n ? 'rgba(245,200,66,0.1)' : 'var(--bg2)';
    b.style.color = i===n ? 'var(--gold)' : 'var(--text2)';
  });
}
window.setPersCount = setPersCount;

// ── CUSTOMER FLOW ──────────────────────────────────────────────
function kioskCustomer() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin:0 0 14px">🧑‍🤝‍🧑 Customer Check-in</h3>
    <div class="form-group"><label>Name <span style="color:var(--text3);font-size:10px">(optional)</span></label>
      <input type="text" id="kiosk-name" placeholder="e.g. Ravi Teja" autocomplete="name" style="font-size:16px">
    </div>
    <div class="form-group"><label>Phone <span style="color:var(--text3);font-size:10px">(optional)</span></label>
      <input type="tel" id="kiosk-phone" placeholder="10-digit mobile" maxlength="10" inputmode="numeric">
    </div>
    ${_personsField(1)}
    <button class="btn-primary full-width" onclick="VW_CHECKIN.submitCustomerCheckin()" style="margin-top:8px;font-size:15px;padding:14px">
      🔔 Notify Sales Team
    </button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  setTimeout(() => document.getElementById('kiosk-name')?.focus(), 80);
}

async function submitCustomerCheckin() {
  const name = document.getElementById('kiosk-name')?.value.trim() || 'Walk-in Customer';
  const phone = document.getElementById('kiosk-phone')?.value.trim() || '';
  const persons = parseInt(document.getElementById('kiosk-persons')?.value||1);
  try {
    await VW_DB.client.from('visits').insert({
      visitor_name: name, visitor_phone: phone,
      visitor_type: 'customer', checkin_type: 'customer',
      persons_count: persons, status: 'pending',
      security_checkin: true, self_checkin_complete: true,
      date: new Date().toISOString(), created_at: new Date().toISOString(),
      department: 'Sales', notes: `${persons} person(s)`,
    });
  } catch(e) { console.warn('Visit insert:', e); }
  closeSheet();
  _kioskConfirm('🧑‍🤝‍🧑', 'Sales team notified!', 'Someone will be with you at the entrance shortly. Please wait here.', null);
}

// ── VENDOR / DELIVERY FLOW ─────────────────────────────────────
function kioskVendor() {
  const staff = window._kioskStaff || [];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin:0 0 4px">🚚 Vendor / Delivery Check-in</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:14px">Self check-in is required to proceed.</p>

    <div class="form-group"><label>Visitor Type *</label>
      <select id="kiosk-vtype" style="font-size:14px">
        <option value="supplier">Supplier / Vendor</option>
        <option value="delivery">Delivery / Logistics</option>
        <option value="product_return">Product Return</option>
        <option value="payment">Payment Collection</option>
        <option value="sample">Sample Presentation</option>
      </select>
    </div>
    <div class="form-group"><label>Your Name *</label>
      <input type="text" id="kiosk-name" placeholder="e.g. Ramesh, Kaveri Tiles" autocomplete="name" style="font-size:16px">
    </div>
    <div class="form-group"><label>Company / Brand</label>
      <input type="text" id="kiosk-company" placeholder="e.g. Kajaria Ceramics" style="font-size:14px">
    </div>
    <div class="form-group"><label>Your Phone *</label>
      <input type="tel" id="kiosk-phone" placeholder="10-digit mobile" maxlength="10" inputmode="numeric">
    </div>
    <div class="form-group"><label>Meeting / Reporting To *</label>
      <select id="kiosk-meeting" style="font-size:14px">
        <option value="">Select person...</option>
        ${staff.map(s=>`<option value="${s.id}" data-phone="${s.phone||''}">${s.name}${s.role?' ('+s.role+')':''}</option>`).join('')}
        <option value="any">Any available staff</option>
      </select>
    </div>
    <div class="form-group"><label>Purpose / Reference</label>
      <input type="text" id="kiosk-purpose" placeholder="e.g. Deliver PO #1234, Present new range" style="font-size:13px">
    </div>
    ${_personsField(1)}
    <div id="kiosk-err" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
    <button class="btn-primary full-width" onclick="VW_CHECKIN.submitVendorCheckin()" style="margin-top:8px;font-size:15px;padding:14px">
      ✓ Complete Check-in & Notify
    </button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  setTimeout(() => document.getElementById('kiosk-name')?.focus(), 80);
}

async function submitVendorCheckin() {
  const name = document.getElementById('kiosk-name')?.value.trim();
  const phone = document.getElementById('kiosk-phone')?.value.trim();
  const company = document.getElementById('kiosk-company')?.value.trim();
  const vtype = document.getElementById('kiosk-vtype')?.value;
  const meetingEl = document.getElementById('kiosk-meeting');
  const meetingId = meetingEl?.value;
  const meetingName = meetingEl?.options[meetingEl.selectedIndex]?.text || '';
  const meetingPhone = meetingEl?.options[meetingEl.selectedIndex]?.dataset?.phone || '';
  const purpose = document.getElementById('kiosk-purpose')?.value.trim();
  const persons = parseInt(document.getElementById('kiosk-persons')?.value||1);
  const errEl = document.getElementById('kiosk-err');

  // Validation — vendor MUST self check-in
  if (!name) { errEl.textContent = '⚠ Name is required'; errEl.style.display=''; return; }
  if (!phone || phone.length < 10) { errEl.textContent = '⚠ Valid 10-digit phone is required'; errEl.style.display=''; return; }
  if (!meetingId) { errEl.textContent = '⚠ Please select who you are meeting'; errEl.style.display=''; return; }
  errEl.style.display = 'none';

  try {
    await VW_DB.client.from('visits').insert({
      visitor_name: name, visitor_phone: phone,
      visitor_type: vtype, checkin_type: 'vendor',
      company_name: company, persons_count: persons,
      meeting_person: meetingName, meeting_person_phone: meetingPhone,
      purpose, status: 'pending', security_checkin: true,
      self_checkin_complete: true,
      date: new Date().toISOString(), created_at: new Date().toISOString(),
    });
  } catch(e) { console.warn('Visit insert:', e); }

  // Build WhatsApp notification link for meeting person
  let waLink = null;
  if (meetingPhone && meetingPhone.length >= 10) {
    const digits = meetingPhone.replace(/\D/g,'');
    const countryPhone = digits.startsWith('91') ? digits : '91'+digits;
    const msg = `V Wholesale Security Alert 🔔\n\n${name}${company?' from '+company:''} is at the entrance to meet you.\nType: ${vtype}\nPersons: ${persons}\nPhone: ${phone}${purpose?'\nReason: '+purpose:''}\n\nTime: ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;
    waLink = `https://wa.me/${countryPhone}?text=${encodeURIComponent(msg)}`;
  }

  closeSheet();
  _kioskConfirm('🚚', 'Check-in Complete!',
    `Welcome${company?' from '+company:''}. ${meetingName ? meetingName+' has been notified.' : 'Our team has been notified.'}`,
    waLink ? { label:'📱 Send WhatsApp to '+meetingName.split(' ')[0], url: waLink } : null
  );
}

// ── OTHER VISITOR FLOW ─────────────────────────────────────────
function kioskOther() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin:0 0 14px">🏢 Other Visitor</h3>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:6px">
      <button onclick="VW_CHECKIN.kioskOtherSelfCheckin()" style="display:flex;align-items:center;gap:14px;padding:18px 16px;border-radius:14px;border:2px solid rgba(96,165,250,0.4);background:rgba(96,165,250,0.06);cursor:pointer;width:100%;text-align:left">
        <span style="font-size:30px;flex-shrink:0">📝</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">Self Check-in</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">Fill your details — notify meeting person</div>
        </div>
      </button>
      <button onclick="VW_CHECKIN.kioskOtherNotify()" style="display:flex;align-items:center;gap:14px;padding:18px 16px;border-radius:14px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;width:100%;text-align:left">
        <span style="font-size:30px;flex-shrink:0">🔔</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text)">Just Notify Staff</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">Tap and an executive will come to you</div>
        </div>
      </button>
    </div>
    <button class="btn-secondary full-width" style="margin-top:6px" onclick="closeSheet()">← Back</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function kioskOtherSelfCheckin() {
  const staff = window._kioskStaff || [];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="margin:0 0 14px">📝 Visitor Check-in</h3>
    <div class="form-group"><label>Visitor Type</label>
      <select id="kiosk-vtype" style="font-size:14px">
        <option value="bank">Bank / Finance</option>
        <option value="inspector">Inspector / Auditor</option>
        <option value="contractor">Contractor</option>
        <option value="interview">Job Interview</option>
        <option value="official">Government / Official</option>
        <option value="media">Press / Media</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="form-group"><label>Your Name *</label>
      <input type="text" id="kiosk-name" placeholder="Full name" autocomplete="name" style="font-size:16px">
    </div>
    <div class="form-group"><label>Your Phone</label>
      <input type="tel" id="kiosk-phone" placeholder="10-digit mobile" maxlength="10" inputmode="numeric">
    </div>
    <div class="form-group"><label>Organisation / Company</label>
      <input type="text" id="kiosk-company" placeholder="Optional" style="font-size:14px">
    </div>
    <div class="form-group"><label>Meeting / Here to See</label>
      <select id="kiosk-meeting" style="font-size:14px">
        <option value="any">Any available staff</option>
        ${staff.map(s=>`<option value="${s.id}" data-phone="${s.phone||''}">${s.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Purpose</label>
      <input type="text" id="kiosk-purpose" placeholder="Briefly describe your visit" style="font-size:13px">
    </div>
    ${_personsField(1)}
    <div id="kiosk-err" style="color:var(--red);font-size:12px;margin-bottom:8px;display:none"></div>
    <button class="btn-primary full-width" onclick="VW_CHECKIN.submitOtherCheckin()" style="margin-top:8px;font-size:15px;padding:14px">
      ✓ Complete Check-in
    </button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_CHECKIN.kioskOther()">← Back</button>`;
  setTimeout(() => document.getElementById('kiosk-name')?.focus(), 80);
}

async function submitOtherCheckin() {
  const name = document.getElementById('kiosk-name')?.value.trim();
  const errEl = document.getElementById('kiosk-err');
  if (!name) { errEl.textContent = '⚠ Name is required'; errEl.style.display=''; return; }
  errEl.style.display = 'none';

  const phone = document.getElementById('kiosk-phone')?.value.trim();
  const company = document.getElementById('kiosk-company')?.value.trim();
  const vtype = document.getElementById('kiosk-vtype')?.value;
  const meetingEl = document.getElementById('kiosk-meeting');
  const meetingName = meetingEl?.options[meetingEl?.selectedIndex]?.text || '';
  const meetingPhone = meetingEl?.options[meetingEl?.selectedIndex]?.dataset?.phone || '';
  const purpose = document.getElementById('kiosk-purpose')?.value.trim();
  const persons = parseInt(document.getElementById('kiosk-persons')?.value||1);

  try {
    await VW_DB.client.from('visits').insert({
      visitor_name: name, visitor_phone: phone,
      visitor_type: vtype, checkin_type: 'other_self',
      company_name: company, persons_count: persons,
      meeting_person: meetingName, meeting_person_phone: meetingPhone,
      purpose, status: 'pending', security_checkin: true, self_checkin_complete: true,
      date: new Date().toISOString(), created_at: new Date().toISOString(),
    });
  } catch(e) { console.warn('Visit insert:', e); }

  let waLink = null;
  if (meetingPhone && meetingPhone.length >= 10) {
    const digits = meetingPhone.replace(/\D/g,'');
    const cp = digits.startsWith('91') ? digits : '91'+digits;
    const msg = `V Wholesale Visitor 🏢\n${name}${company?' ('+company+')':''} is here to meet you.\nType: ${vtype}${purpose?'\nPurpose: '+purpose:''}\nPersons: ${persons}\nTime: ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;
    waLink = `https://wa.me/${cp}?text=${encodeURIComponent(msg)}`;
  }

  closeSheet();
  _kioskConfirm('🏢', 'Check-in Complete!', `Welcome, ${name.split(' ')[0]}. ${meetingName&&meetingName!=='Any available staff'?meetingName+' has been notified.':'Our team will be with you shortly.'}`, waLink?{label:'📱 WhatsApp '+meetingName.split(' ')[0],url:waLink}:null);
}

async function kioskOtherNotify() {
  const name = 'Visitor'; const persons = 1;
  try {
    await VW_DB.client.from('visits').insert({
      visitor_name: name, visitor_type: 'other', checkin_type: 'other_notify',
      persons_count: persons, status: 'pending', security_checkin: true, self_checkin_complete: false,
      date: new Date().toISOString(), created_at: new Date().toISOString(),
    });
  } catch(e) { console.warn('Visit insert:', e); }
  closeSheet();
  _kioskConfirm('🔔', 'Staff Notified!', 'An executive will come to you at the entrance shortly.', null);
}

// ── SHARED CONFIRM SCREEN ──────────────────────────────────────
function _kioskConfirm(icon, title, msg, action) {
  const content = document.getElementById('app-content');
  if (!content) return;
  content.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center">
      <div style="font-size:72px;margin-bottom:20px">${icon}</div>
      <div style="font-size:22px;font-weight:800;color:var(--green);font-family:'Syne',sans-serif;margin-bottom:10px">✓ ${title}</div>
      <div style="font-size:14px;color:var(--text2);max-width:320px;line-height:1.7;margin-bottom:24px">${msg}</div>
      ${action ? `<a href="${action.url}" target="_blank" style="display:block;padding:12px 24px;background:rgba(37,211,102,0.12);border:1px solid rgba(37,211,102,0.4);border-radius:12px;color:#25d366;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:14px">${action.label}</a>` : ''}
      <div style="font-size:12px;color:var(--text3);margin-bottom:24px">V Wholesale · Vijayawada</div>
      <button onclick="VW_CHECKIN.resetKioskPage()" style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:12px 28px;color:var(--text2);font-size:13px;cursor:pointer">← New Check-in</button>
    </div>`;
  setTimeout(() => VW_CHECKIN.resetKioskPage(), action ? 20000 : 8000);
}

// Legacy stubs (kept for backward compat)
async function securityNotifyCustomer() { kioskCustomer(); }
async function securityNotifyVendor() { kioskVendor(); }
async function securityNotifyOther() { kioskOther(); }
async function confirmSecurityNotify() {} // replaced

async function resetKioskPage() {
  const content = document.getElementById('app-content');
  if (content) content.innerHTML = await renderSecurityKioskPage();
}

// Add to VW_CHECKIN exports
// Exit kiosk mode and go to staff check-in (restores nav)
function exitKioskToStaffCheckin() {
  // Strip ?kiosk=security from URL so app starts normally
  const cleanUrl = window.location.pathname;
  window.location.href = cleanUrl; // Full reload with clean URL
}

window.VW_CHECKIN.renderSecurityKioskPage = renderSecurityKioskPage;
window.VW_CHECKIN.exitKioskToStaffCheckin = exitKioskToStaffCheckin;
window.VW_CHECKIN.securityNotifyCustomer = securityNotifyCustomer;
window.VW_CHECKIN.securityNotifyVendor = securityNotifyVendor;
window.VW_CHECKIN.securityNotifyOther = securityNotifyOther;
window.VW_CHECKIN.kioskCustomer = kioskCustomer;
window.VW_CHECKIN.kioskVendor = kioskVendor;
window.VW_CHECKIN.kioskOther = kioskOther;
window.VW_CHECKIN.kioskOtherSelfCheckin = kioskOtherSelfCheckin;
window.VW_CHECKIN.kioskOtherNotify = kioskOtherNotify;
window.VW_CHECKIN.submitCustomerCheckin = submitCustomerCheckin;
window.VW_CHECKIN.submitVendorCheckin = submitVendorCheckin;
window.VW_CHECKIN.submitOtherCheckin = submitOtherCheckin;
window.VW_CHECKIN.setPersCount = setPersCount;
window.VW_CHECKIN.confirmSecurityNotify = confirmSecurityNotify;
window.VW_CHECKIN.resetKioskPage = resetKioskPage;
window.VW_CHECKIN.confirmSecurityNotify = confirmSecurityNotify;
window.VW_CHECKIN.resetKioskPage = resetKioskPage;




