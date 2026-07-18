/* === hr.js === */

const TEAM_LABELS = {
  specialist: 'Specialist (gets department tasks)',
  TL: 'Team Lead / TL (escalation level 2)',
  floor_manager: 'Floor Manager (escalation level 3)',
  store_manager: 'Store Manager (escalation level 4)',
  management: 'Management (escalation level 5 / urgent)',
  hr: 'HR (gets interview visitors)',
  purchase: 'Purchase (gets pickup/delivery visitors)',
  inventory: 'Inventory (gets delivery visitors)',
  other: 'Other'
};

async function renderHR() {
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const attendance = await VW_DB.all(VW_DB.STORES.attendance);
  const leaves = await VW_DB.all(VW_DB.STORES.leaves);
  const today = new Date().toDateString();
  const todayAtt = attendance.filter(a => new Date(a.date).toDateString() === today);
  const presentToday = todayAtt.filter(a => a.status === 'present').length;
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;

  return `
  <div class="module-header">
    <h2>HR & Team</h2>
    <div class="stat-row">
      <div class="stat"><span class="stat-num">${staff.length}</span><span class="stat-label">Team</span></div>
      <div class="stat"><span class="stat-num" style="color:var(--green)">${presentToday}</span><span class="stat-label">Present</span></div>
      <div class="stat"><span class="stat-num" style="color:var(--gold)">${pendingLeaves}</span><span class="stat-label">Leave Req</span></div>
    </div>
  </div>

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Employee Onboarding</h3>
      <button class="btn-sm" onclick="showCreateOffer()">+ New Offer</button>
    </div>
    <div id="offers-pipeline-list">${await renderOffersPipeline()}</div>
  </div>

  <div class="card">
    <h3 class="card-title">Today's Attendance — ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</h3>
    <div id="attendance-list">
      ${await renderAttendanceList(staff, todayAtt)}
    </div>
    <button class="btn-primary full-width" style="margin-top:14px" onclick="markAllPresent()">✓ Mark All Present</button>
  </div>

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Team Directory</h3>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" onclick="downloadImportTemplate('staff')">📄 Template</button>
        <button class="btn-sm" onclick="triggerExcelImport('staff')">📥 Import Excel</button>
        <button class="btn-sm" onclick="showAddStaff()">+ Add</button>
      </div>
    </div>
    <div id="staff-list">
      ${renderStaffList(staff)}
    </div>
  </div>

  ${pendingLeaves ? `
  <div class="card">
    <h3 class="card-title">Pending Leave Requests</h3>
    <div id="leave-approvals">
      ${await renderPendingLeaves(leaves, staff)}
    </div>
  </div>` : ''}

  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Leave Requests</h3>
      <button class="btn-sm" onclick="showApplyLeave()">+ Apply</button>
    </div>
    <div id="all-leaves">
      ${await renderAllLeaves(leaves, staff)}
    </div>
  </div>

  <div class="card">
    <h3 class="card-title">Attendance Summary — This Month</h3>
    <div id="att-summary">
      ${await renderAttSummary(staff, attendance)}
    </div>
  </div>
  `;
}

async function renderAttendanceList(staff, todayAtt) {
  if (!staff.length) return '<p class="empty-msg">No staff added yet</p>';
  const attMap = {};
  todayAtt.forEach(a => attMap[a.staffId] = a);

  return staff.map(s => {
    const att = attMap[s.id];
    const status = att?.status || 'not-marked';
    const statusColors = { present: 'var(--green)', absent: 'var(--red)', late: 'var(--gold)', leave: 'var(--blue)', 'not-marked': '#555' };
    const statusLabels = { present: 'Present', absent: 'Absent', late: 'Late', leave: 'On Leave', 'not-marked': 'Not Marked' };
    return `
    <div class="att-row">
      <div class="staff-avatar">${(s.name||'?')[0]}</div>
      <div class="staff-info">
        <div class="staff-name">${s.name}</div>
        <div class="staff-meta">${s.department} · ${s.role}</div>
      </div>
      <div class="att-controls">
        <button class="att-btn ${status==='present'?'att-active-green':''}" onclick="markAtt(${s.id},'present')" title="Present">P</button>
        <button class="att-btn ${status==='absent'?'att-active-red':''}" onclick="markAtt(${s.id},'absent')" title="Absent">A</button>
        <button class="att-btn ${status==='late'?'att-active-gold':''}" onclick="markAtt(${s.id},'late')" title="Late">L</button>
        <button class="att-btn ${status==='leave'?'att-active-blue':''}" onclick="markAtt(${s.id},'leave')" title="Leave">LV</button>
      </div>
    </div>`;
  }).join('');
}




async function renderAttSummary(staff, attendance) {
  if (!staff.length) return '<p class="empty-msg">No data yet</p>';
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthAtt = attendance.filter(a => new Date(a.date) >= monthStart);
  const workingDays = Math.max(1, Math.ceil((new Date() - monthStart) / 86400000));

  return staff.map(s => {
    const sAtt = monthAtt.filter(a => a.staffId === s.id);
    const present = sAtt.filter(a => a.status === 'present' || a.status === 'late').length;
    const absent = sAtt.filter(a => a.status === 'absent').length;
    const onLeave = sAtt.filter(a => a.status === 'leave').length;
    const pct = Math.round(present / workingDays * 100);
    return `
    <div class="att-summary-row">
      <div class="staff-avatar" style="width:32px;height:32px;font-size:13px">${(s.name||'?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:13px;font-weight:500">${s.name}</span>
          <span style="font-size:12px;color:var(--gold)">${pct}%</span>
        </div>
        <div class="stock-bar-bg"><div class="stock-bar" style="width:${pct}%;background:${pct>=80?'var(--green)':pct>=60?'var(--gold)':'var(--red)'}"></div></div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${present}P · ${absent}A · ${onLeave}L (${workingDays} days)</div>
      </div>
    </div>`;
  }).join('');
}

async function renderPendingLeaves(leaves, staff) {
  const staffMap = {}; staff.forEach(s => staffMap[s.id] = s);
  const pending = leaves.filter(l => l.status === 'pending');
  if (!pending.length) return '<p class="empty-msg">No pending requests</p>';
  return pending.map(l => `
    <div class="leave-row">
      <div class="fu-info">
        <div class="fu-name">${staffMap[l.staffId]?.name || 'Unknown'}</div>
        <div class="fu-dept">${l.type} · ${new Date(l.from).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${new Date(l.to).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
        ${l.reason ? `<div class="fu-dept" style="color:var(--text2)">${l.reason}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" style="color:var(--green);border-color:rgba(34,197,94,0.3)" onclick="approveLeave(${l.id},'approved')">✓</button>
        <button class="btn-sm" style="color:var(--red);border-color:rgba(239,68,68,0.3)" onclick="approveLeave(${l.id},'rejected')">✕</button>
      </div>
    </div>`).join('');
}


async function renderAllLeaves(leaves, staff) {
  if (!leaves.length) return '<p class="empty-msg">No leave requests yet</p>';
  const staffMap = {}; staff.forEach(s => staffMap[s.id] = s);
  const statusColors = { pending: 'var(--gold)', approved: 'var(--green)', rejected: 'var(--red)' };
  return leaves.slice(-20).reverse().map(l => `
    <div class="inv-row">
      <div class="inv-info">
        <div class="inv-name">${staffMap[l.staffId]?.name || 'Unknown'} · ${l.type}</div>
        <div class="inv-meta">${new Date(l.from).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${new Date(l.to).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · ${l.days} day${l.days>1?'s':''}</div>
      </div>
      <div style="color:${statusColors[l.status]||'#888'};font-size:13px;font-weight:600;text-transform:capitalize">${l.status}</div>
    </div>`).join('');
}




async function saveNewStaff() {
  const name = document.getElementById('ns-name').value.trim();
  const phone = document.getElementById('ns-phone').value.trim();
  const role = document.getElementById('ns-role').value.trim();
  if (!name || !phone || !role) return showToast('Fill required fields', 'warn');
  await VW_DB.put(VW_DB.STORES.staff, {
    name, phone, role, department: document.getElementById('ns-dept').value,
    team: document.getElementById('ns-team').value,
    seniorityLevel: parseInt(document.getElementById('ns-seniority').value) || 1,
    status: 'available', statusUpdatedAt: new Date().toISOString(),
    salary: parseFloat(document.getElementById('ns-salary').value)||0,
    joinDate: document.getElementById('ns-join').value,
    language: 'te', createdAt: new Date().toISOString()
  });
  showToast(`${name} added to team`, 'success');
  closeSheet();
  navigateTo('hr');
}

async function openStaff(id) {
  const s = await VW_DB.getById(VW_DB.STORES.staff, id);
  const att = await VW_DB.all(VW_DB.STORES.attendance);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthAtt = att.filter(a => a.staffId === id && new Date(a.date) >= monthStart);
  const present = monthAtt.filter(a => a.status === 'present' || a.status === 'late').length;
  const teamLabels = { specialist:'Specialist', TL:'Team Lead', hr:'HR', purchase:'Purchase', inventory:'Inventory', other:'Other/Management' };
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-avatar-row">
      <div class="sheet-avatar">${(s.name||'?')[0]}</div>
      <div><h3 style="margin:0">${s.name}</h3><p style="margin:0;font-size:13px;color:#888">${s.role} · ${s.department}${s.team ? ' · '+(teamLabels[s.team]||s.team) : ''}</p></div>
    </div>
    <div class="sheet-stats">
      <div class="sheet-stat"><span>${present}</span><small>Days/Month</small></div>
      <div class="sheet-stat"><span>${s.salary?'₹'+Math.round(s.salary/1000)+'K':'—'}</span><small>Salary</small></div>
      <div class="sheet-stat"><span>${s.joinDate?new Date(s.joinDate).toLocaleDateString('en-IN',{month:'short',year:'2-digit'}):'—'}</span><small>Joined</small></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-wa full-width" onclick="window.open('https://wa.me/91${s.phone}','_blank')">💬 WhatsApp ${s.name.split(' ')[0]}</button>
      <button class="btn-call" onclick="callPhone('${s.phone}')">📞</button>
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="showApplyLeave()">📋 Apply Leave</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="showEditStaff(${id})">✏️ Edit Details</button>
    ${s.customFields && Object.keys(s.customFields).length ? `
    <div class="req-item-card" style="margin-top:10px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">Additional Info (from import)</div>
      ${Object.entries(s.customFields).map(([k,v]) => `<div style="font-size:12px;padding:2px 0">${k}: ${v}</div>`).join('')}
    </div>` : ''}
    ${s.aadhaarNumber || s.panNumber ? `<button class="btn-secondary full-width" style="margin-top:8px" onclick="viewStaffOnboardingDocs(${id})">📄 View Onboarding Documents</button>` : ''}
    <button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="confirmDeleteStaff(${id})">🗑️ Remove from Team</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function viewStaffOnboardingDocs(id) {
  const s = await VW_DB.getById(VW_DB.STORES.staff, id);
  if (!s) return;
  const photoUrl = await VW_DB.getOnboardingDocUrl(s.photoPath);
  const aadhaarUrl = await VW_DB.getOnboardingDocUrl(s.aadhaarPath);
  const panUrl = await VW_DB.getOnboardingDocUrl(s.panPath);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${s.name} — Documents</h3>
    <div class="req-item-card" style="margin-top:10px;font-size:12px;line-height:1.8">
      ${s.dob ? `DOB: ${new Date(s.dob).toLocaleDateString('en-IN')}<br>` : ''}
      ${s.address ? `Address: ${s.address}<br>` : ''}
      ${s.personalEmail ? `Email: ${s.personalEmail}<br>` : ''}
      Aadhaar: ${s.aadhaarNumber||'—'} ${aadhaarUrl ? `· <a href="${aadhaarUrl}" target="_blank" style="color:var(--gold)">View</a>` : ''}<br>
      PAN: ${s.panNumber||'—'} ${panUrl ? `· <a href="${panUrl}" target="_blank" style="color:var(--gold)">View</a>` : ''}
      ${(s.extraDocs||[]).map(d => `<br>${d.label}: <a href="#" onclick="event.preventDefault();openExtraDoc('${d.path}')" style="color:var(--gold)">View</a>`).join('')}
      ${s.bankAccountNumber ? `<br><br>Bank: ${s.bankAccountName||''} &middot; ${s.bankAccountNumber} &middot; ${s.bankIfsc||''}` : ''}
      ${s.emergencyContactName ? `<br><br>Emergency Contact: ${s.emergencyContactName} (${s.emergencyContactRelation||''}) &middot; ${s.emergencyContactPhone||''}` : ''}
      ${s.education ? `<br><br>Education: ${s.education}` : ''}
      ${s.experience ? `<br>Experience: ${s.experience}` : ''}
      ${s.referenceName ? `<br><br>Reference: ${s.referenceName} &middot; ${s.referencePhone||''}` : ''}
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.viewStaffOnboardingDocs = viewStaffOnboardingDocs;

async function openExtraDoc(path) {
  const url = await VW_DB.getOnboardingDocUrl(path);
  if (url) window.open(url, '_blank');
}
window.openExtraDoc = openExtraDoc;

function showEditStaff(id) {
  VW_DB.getById(VW_DB.STORES.staff, id).then(s => {
    const depts = ['Tiles','Sanitary','Plywood','Electricals','Paints','Plumbing','Appliances','HR','Purchase','Inventory','Management','Accounts'];
    const teams = ['specialist','TL','floor_manager','store_manager','management','hr','purchase','inventory','other'];
    const teamLabels = TEAM_LABELS;
    const sheet = document.getElementById('bottom-sheet');
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>Edit ${s.name}</h3>
      <div class="form-group"><label>Name *</label><input type="text" id="es-name" value="${s.name||''}"></div>
      <div class="form-group"><label>Phone *</label><input type="tel" id="es-phone" value="${s.phone||''}" maxlength="10"></div>
      <div class="form-group"><label>Role *</label><input type="text" id="es-role" value="${s.role||''}"></div>
      <div class="form-group"><label>Department *</label>
        <select id="es-dept">${depts.map(d=>`<option ${d===s.department?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="form-group"><label>Seniority Level (within their department/category)</label>
        <select id="es-seniority">
          <option value="1" ${(s.seniorityLevel||1)===1?'selected':''}>1 — Staff</option>
          <option value="2" ${s.seniorityLevel===2?'selected':''}>2 — Senior / Lead</option>
          <option value="3" ${s.seniorityLevel===3?'selected':''}>3 — Head / Manager</option>
        </select>
      </div>
      <div class="form-group"><label>Team (controls routing) *</label>
        <select id="es-team">${teams.map(t=>`<option value="${t}" ${t===s.team?'selected':''}>${teamLabels[t]}</option>`).join('')}</select></div>
      <div class="form-group"><label>Salary (₹/month)</label><input type="number" id="es-salary" value="${s.salary||''}"></div>
      <button class="btn-primary full-width" onclick="saveEditStaff(${id})">Save Changes</button>
    `;
    sheet.classList.add('open');
    document.getElementById('sheet-overlay').classList.add('open');
  });
}

async function saveEditStaff(id) {
  const s = await VW_DB.getById(VW_DB.STORES.staff, id);
  const name = document.getElementById('es-name').value.trim();
  const phone = document.getElementById('es-phone').value.trim();
  const role = document.getElementById('es-role').value.trim();
  if (!name || !phone || !role) return showToast('Fill required fields', 'warn');
  s.name = name; s.phone = phone; s.role = role;
  s.department = document.getElementById('es-dept').value;
  s.seniorityLevel = parseInt(document.getElementById('es-seniority').value) || 1;
  s.team = document.getElementById('es-team').value;
  s.salary = parseFloat(document.getElementById('es-salary').value)||0;
  await VW_DB.put(VW_DB.STORES.staff, s);
  showToast('Details updated', 'success');
  closeSheet();
  navigateTo('hr');
}

async function confirmDeleteStaff(id) {
  const s = await VW_DB.getById(VW_DB.STORES.staff, id);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Remove ${s ? s.name : 'this member'}?</h3>
    <p class="sheet-meta">This removes them from the team directory and routing. Past attendance, leads, and tasks already assigned to them stay in records.</p>
    <div class="sheet-actions">
      <button class="btn-secondary" style="color:var(--red)" onclick="deleteStaff(${id})">🗑️ Remove</button>
      <button class="btn-secondary" onclick="openStaff(${id})">Cancel</button>
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function deleteStaff(id) {
  await VW_DB.del(VW_DB.STORES.staff, id);
  showToast('Team member removed', 'info');
  closeSheet();
  navigateTo('hr');
}

window.VW_HR = { renderHR, markAtt, markAllPresent, showAddStaff, saveNewStaff, openStaff, showApplyLeave, submitLeave, approveLeave, showEditStaff, saveEditStaff, confirmDeleteStaff, deleteStaff };
window.showAddStaff = showAddStaff;
window.saveNewStaff = saveNewStaff;
window.openStaff = openStaff;
window.showEditStaff = showEditStaff;
window.saveEditStaff = saveEditStaff;
window.confirmDeleteStaff = confirmDeleteStaff;
window.deleteStaff = deleteStaff;
window.markAtt = markAtt;
window.markAllPresent = markAllPresent;
window.showApplyLeave = showApplyLeave;
window.submitLeave = submitLeave;
window.approveLeave = approveLeave;




/* === hr_payroll.js === */

// ============================================================
// HR & PAYROLL MODULE — Session 8
// Staff Management · Attendance · Salary Calculator · Payslips
// Based on actual V Wholesale attendance + salary data structure
// ============================================================

// Name mapping between salary sheet and attendance system
const STAFF_NAME_MAP = {
  'Inturi Siva Charan': 'I Siva Charan',
  'Ramadugu Sravani': 'R. Sravani',
  'Gonnabhakthula Lokesh Kumar': 'Lokesh Kumar',
  'PVND sai pavan kumar': 'Sai Pavan',
  'Ravi Prakash': 'Ravi Prakash',
  'Imran': 'Sk. Imran',
  'CH Naveen': 'Naveen Chundru',
  'Durgarao': 'Bolli Durga Rao',
  'N Rajesh': 'N Rajesh',
  'K Adi Lakshmi': 'K Adi Lakshmi',
  'J Naga Sai': 'J Naga Sai',
  'Yarragunta Manasa': 'Y Manasa',
  'P.Lakshmi': 'P.Lakshmi',
  'Sandhya Rani': 'Sandhya Rani',
  'Narayanamma': 'Narayanamma',
  'B.Anand': 'Anand',
  'Y Alok': 'Alok',
  'D Priyanka': 'D Priyanka',
  'G.Mahesh': 'G.Mahesh',
  'B.Venkat Reddy': 'B.Venkat Reddy',
};

// ===== MAIN HR PAGE =====
async function renderHRPage() {
  const isAdmin = VW_AUTH.isAdmin();
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const today = new Date().toDateString();
  const attendance = await VW_DB.all(VW_DB.STORES.attendance);
  const todayAtt = attendance.filter(a => new Date(a.date).toDateString() === today);
  const presentToday = todayAtt.filter(a => a.punchIn).length;

  return `
  <div class="module-header"><h2>HR & Payroll</h2>
    ${isAdmin ? `<button class="btn-sm" onclick="VW_HR_PAYROLL.showAddStaff()">+ Add Staff</button>` : ''}
  </div>

  <!-- Today snapshot -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
    <div style="padding:10px;background:var(--bg2);border-radius:10px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:#22c55e">${presentToday}</div>
      <div style="font-size:11px;color:var(--text3)">Present Today</div>
    </div>
    <div style="padding:10px;background:var(--bg2);border-radius:10px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:var(--red)">${staff.filter(s=>s.active!==false).length - presentToday}</div>
      <div style="font-size:11px;color:var(--text3)">Absent</div>
    </div>
    <div style="padding:10px;background:var(--bg2);border-radius:10px;text-align:center">
      <div style="font-size:20px;font-weight:700">${staff.filter(s=>s.active!==false).length}</div>
      <div style="font-size:11px;color:var(--text3)">Total Staff</div>
    </div>
  </div>

  <div class="entry-type-grid" style="margin-bottom:12px">
    <button class="entry-type-btn active" id="hr-tab-staff" onclick="VW_HR_PAYROLL.switchHRTab('staff',this)"><span class="et-icon">👥</span>Staff</button>
    <button class="entry-type-btn" id="hr-tab-attendance" onclick="VW_HR_PAYROLL.switchHRTab('attendance',this)"><span class="et-icon">📋</span>Attendance</button>
    <button class="entry-type-btn" id="hr-tab-payroll" onclick="VW_HR_PAYROLL.switchHRTab('payroll',this)"><span class="et-icon">💰</span>Payroll</button>
    <button class="entry-type-btn" id="hr-tab-leaves" onclick="VW_HR_PAYROLL.switchHRTab('leaves',this)"><span class="et-icon">🏖</span>Leaves</button>
    <button class="entry-type-btn" id="hr-tab-greetings" onclick="VW_HR_PAYROLL.switchHRTab('greetings',this)"><span class="et-icon">🎂</span>Greetings</button>
  </div>

  <div id="hr-tab-content">
    ${await renderStaffList()}
  </div>`;
}

async function switchHRTab(tab, btn) {
  document.querySelectorAll('[id^="hr-tab-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('hr-tab-content');
  if (!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  switch(tab) {
    case 'staff':      container.innerHTML = await renderStaffList(); break;
    case 'attendance': container.innerHTML = await renderAttendanceView(); break;
    case 'payroll':    container.innerHTML = await renderPayrollView(); break;
    case 'greetings':  container.innerHTML = await renderStaffGreetings(); break;
    case 'leaves':     container.innerHTML = await renderLeavesView(); break;
  }
}

// ===== STAFF LIST =====
async function renderStaffList() {
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const active = staff.filter(s => s.active !== false);
  const inactive = staff.filter(s => s.active === false);
  const isAdmin = VW_AUTH.isAdmin();

  return `
  <div class="card">
    <h3 class="card-title">Active Staff <span class="badge">${active.length}</span></h3>
    ${!active.length ? `
      <p class="empty-msg">No staff added yet</p>
      ${isAdmin ? `<button class="btn-primary full-width" onclick="VW_HR_PAYROLL.showAddStaff()">+ Add First Staff Member</button>` : ''}
    ` : active.map(s => `
      <div class="cust-row" onclick="VW_HR_PAYROLL.openStaffDetail(${s.id})">
        <div class="staff-avatar" style="background:hsl(${(s.id||0)*47},60%,35%);color:#fff">${(s.name||'?')[0].toUpperCase()}</div>
        <div class="cust-info">
          <div class="cust-name">${s.name}</div>
          <div class="cust-meta">${s.designation||'—'} · ${s.department||'—'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:600">₹${Math.round((s.grossSalary||0)/1000)}K</div>
          <div style="font-size:11px;color:var(--text3)">${s.joiningDate||'—'}</div>
        </div>
      </div>`).join('')}
  </div>
  ${inactive.length ? `
  <div class="card">
    <h3 class="card-title">Exited Staff <span class="badge">${inactive.length}</span></h3>
    ${inactive.map(s => `
      <div class="cust-row" onclick="VW_HR_PAYROLL.openStaffDetail(${s.id})">
        <div class="staff-avatar" style="background:#555;color:#fff">${(s.name||'?')[0].toUpperCase()}</div>
        <div class="cust-info">
          <div class="cust-name" style="color:var(--text3)">${s.name}</div>
          <div class="cust-meta">Exit: ${s.exitDate||'—'}</div>
        </div>
      </div>`).join('')}
  </div>` : ''}`;
}

// ===== ADD / EDIT STAFF =====
async function showAddStaff(staffId) {
  const s = staffId ? await VW_DB.getById(VW_DB.STORES.staff, staffId) : null;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${s ? 'Edit Staff' : 'Add Staff Member'}</h3>
    <div class="form-group"><label>Full Name *</label><input type="text" id="st-name" value="${s?.name||''}"></div>
    <div class="form-group"><label>Designation</label><input type="text" id="st-designation" value="${s?.designation||''}" placeholder="e.g. Team Leader, Sales Executive"></div>
    <div class="form-group"><label>Department</label>
      <select id="st-dept">
        ${['Sales','Purchase','Accounts','Marketing','HR','Billing','Dispatch','Housekeeping','Management','Other'].map(d => `<option ${s?.department===d?'selected':''}>${d}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Reporting To</label><input type="text" id="st-reports" value="${s?.reportingTo||'Himansu Mehta'}"></div>
    <div class="form-group"><label>Phone</label><input type="tel" id="st-phone" value="${s?.phone||''}" maxlength="10"></div>
    <div class="form-group"><label>Joining Date</label><input type="date" id="st-joining" value="${s?.joiningDate||new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Gross Package (₹ per year) *</label><input type="number" id="st-gross" value="${s?.grossSalary||''}" placeholder="e.g. 240000 for ₹20K/month"></div>
    <div class="form-group"><label>Bank Account Number</label><input type="text" id="st-bank-acc" value="${s?.bankAccount||''}"></div>
    <div class="form-group"><label>IFSC Code</label><input type="text" id="st-ifsc" value="${s?.ifsc||''}"></div>
    <div class="form-group"><label>Bank Name</label><input type="text" id="st-bank-name" value="${s?.bankName||''}"></div>
    <div class="form-group"><label>PF Number</label><input type="text" id="st-pf" value="${s?.pfNumber||''}"></div>
    <div class="form-group"><label>ESI Number</label><input type="text" id="st-esi" value="${s?.esiNumber||''}"></div>
    <div class="form-group"><label>Attendance Name (as in Google Form)</label>
      <input type="text" id="st-att-name" value="${s?.attendanceName||''}" placeholder="Name as typed in attendance form">
    </div>
    <div class="form-group"><label>Date of Birth 🎂</label><input type="date" id="st-dob" value="${s?.dateOfBirth||''}"></div>
    <div class="form-group"><label>Work Anniversary Date 🎊 (if different from joining date)</label><input type="date" id="st-anniversary" value="${s?.anniversaryDate||s?.joiningDate||''}"></div>
    ${s ? `
    <div class="form-group"><label>Exit Date (leave blank if still active)</label><input type="date" id="st-exit" value="${s?.exitDate||''}"></div>` : ''}
    <button class="btn-primary full-width" onclick="VW_HR_PAYROLL.saveStaff(${staffId||'null'})">Save</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveStaff(staffId) {
  const name = document.getElementById('st-name')?.value.trim();
  const gross = parseFloat(document.getElementById('st-gross')?.value)||0;
  if (!name) { showToast('Enter staff name', 'warn'); return; }
  if (!gross) { showToast('Enter gross package', 'warn'); return; }
  const exitDate = document.getElementById('st-exit')?.value || '';
  const record = {
    name, designation: document.getElementById('st-designation')?.value.trim()||'',
    department: document.getElementById('st-dept')?.value||'',
    reportingTo: document.getElementById('st-reports')?.value.trim()||'Himansu Mehta',
    phone: document.getElementById('st-phone')?.value.trim()||'',
    joiningDate: document.getElementById('st-joining')?.value||'',
    grossSalary: gross,
    bankAccount: document.getElementById('st-bank-acc')?.value.trim()||'',
    ifsc: document.getElementById('st-ifsc')?.value.trim()||'',
    bankName: document.getElementById('st-bank-name')?.value.trim()||'',
    pfNumber: document.getElementById('st-pf')?.value.trim()||'',
    esiNumber: document.getElementById('st-esi')?.value.trim()||'',
    attendanceName: document.getElementById('st-att-name')?.value.trim()||name,
    dateOfBirth: document.getElementById('st-dob')?.value||'',
    anniversaryDate: document.getElementById('st-anniversary')?.value||'',
    exitDate, active: !exitDate,
    updatedAt: new Date().toISOString()
  };
  if (staffId) {
    const existing = await VW_DB.getById(VW_DB.STORES.staff, staffId);
    await VW_DB.put(VW_DB.STORES.staff, {...existing, ...record});
  } else {
    record.createdAt = new Date().toISOString();
    await VW_DB.put(VW_DB.STORES.staff, record);
  }
  showToast(`Staff ${staffId?'updated':'added'}`, 'success');
  closeSheet();
  navigateTo('hr');
}

// ===== STAFF DETAIL =====
async function openStaffDetail(id) {
  const [s, allAtt, allLeaves] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.staff, id),
    VW_DB.all(VW_DB.STORES.attendance),
    VW_DB.all(VW_DB.STORES.leaves)
  ]);
  if (!s) return;
  const isAdmin = VW_AUTH.isAdmin();

  // This month attendance
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const myAtt = allAtt.filter(a => a.staffId === id && new Date(a.date) >= monthStart);
  const presentDays = myAtt.reduce((sum, a) => sum + (a.finalWorking||0), 0);
  const monthLeaves = allLeaves.filter(l => l.staffId === id && l.status === 'approved' && new Date(l.fromDate) >= monthStart);

  // Salary breakdown
  const monthly = Math.round((s.grossSalary||0) / 12);
  const basic = Math.round(monthly * 0.6);
  const hra = Math.round(monthly * 0.25);
  const allowance = monthly - basic - hra;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h3 style="margin:0">${s.name}</h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0">${s.designation||'—'} · ${s.department||'—'}</p>
        <p style="font-size:12px;color:var(--text3);margin:0">Reports to: ${s.reportingTo||'—'}</p>
      </div>
      ${isAdmin ? `<button class="btn-sm" onclick="VW_HR_PAYROLL.showAddStaff(${id})">✏️ Edit</button>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:12px 0">
      <div style="padding:8px;background:var(--bg2);border-radius:8px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:#22c55e">${presentDays}</div>
        <div style="font-size:10px;color:var(--text3)">Days This Month</div>
      </div>
      <div style="padding:8px;background:var(--bg2);border-radius:8px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:var(--gold)">${monthLeaves.length}</div>
        <div style="font-size:10px;color:var(--text3)">Leaves Taken</div>
      </div>
      <div style="padding:8px;background:var(--bg2);border-radius:8px;text-align:center">
        <div style="font-size:16px;font-weight:700">₹${Math.round(monthly/1000)}K</div>
        <div style="font-size:10px;color:var(--text3)">Monthly CTC</div>
      </div>
    </div>

    <div class="req-item-card" style="margin-bottom:10px">
      ${s.phone ? `<div style="font-size:13px;padding:2px 0">📞 ${s.phone}</div>` : ''}
      <div style="font-size:12px;color:var(--text3);padding:2px 0">Joining: ${s.joiningDate||'—'}</div>
      ${s.bankAccount ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">Bank: ${s.bankName||''} · ${s.bankAccount}</div>` : ''}
      ${s.pfNumber ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">PF: ${s.pfNumber}</div>` : ''}
    </div>

    ${isAdmin ? `
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button class="btn-primary" style="flex:1" onclick="VW_HR_PAYROLL.generatePayslip(${id})">📄 Generate Payslip</button>
      <button class="btn-secondary" style="flex:1" onclick="VW_HR_PAYROLL.markAttendanceForStaff(${id},'${s.name}')">✓ Mark Attendance</button>
    </div>` : ''}

    <div class="sheet-section-label">This Month Attendance</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:6px">${presentDays} days present · ${30 - presentDays} absent/LOP</div>
    ${s.phone ? `<button class="btn-wa full-width" onclick="window.open('https://wa.me/91${s.phone.replace(/\D/g,'')}','_blank')">💬 WhatsApp</button>` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// ===== ATTENDANCE VIEW =====
async function renderAttendanceView() {
  const isAdmin = VW_AUTH.isAdmin();
  const [staff, attendance] = await Promise.all([
    VW_DB.all(VW_DB.STORES.staff),
    VW_DB.all(VW_DB.STORES.attendance)
  ]);
  const today = new Date();
  const todayStr = today.toDateString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayAtt = attendance.filter(a => new Date(a.date).toDateString() === todayStr);
  const activeStaff = staff.filter(s => s.active !== false);

  // Build today's status
  const todayStatus = {};
  todayAtt.forEach(a => todayStatus[a.staffId] = a);

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <h3 style="margin:0">Today — ${today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</h3>
    ${isAdmin ? `<button class="btn-sm" onclick="VW_HR_PAYROLL.markAllPresent()">✓ Mark All Present</button>` : ''}
  </div>

  <div class="card" style="margin-bottom:10px">
    ${!activeStaff.length ? '<p class="empty-msg">No staff added yet</p>' :
    activeStaff.map(s => {
      const att = todayStatus[s.id];
      const status = att?.punchIn ? (att.punchOut ? 'done' : 'in') : 'absent';
      const colors = { done: '#22c55e', in: '#f97316', absent: 'var(--red)' };
      const labels = { done: `✓ ${att?.punchIn?.slice(0,5)||''} – ${att?.punchOut?.slice(0,5)||''}`, in: `🟢 In since ${att?.punchIn?.slice(0,5)||''}`, absent: '— Not marked' };
      return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div style="width:32px;height:32px;border-radius:50%;background:hsl(${(s.id||0)*47},60%,35%);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${(s.name||'?')[0].toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${s.name}</div>
          <div style="font-size:11px;color:${colors[status]}">${labels[status]}</div>
        </div>
        ${isAdmin ? `
        <div style="display:flex;gap:4px">
          ${status === 'absent' ? `
            <button class="btn-sm" style="background:#22c55e;color:#fff" onclick="VW_HR_PAYROLL.markAtt(${s.id},'in')">In</button>
            <button class="btn-sm" style="background:#888;color:#fff" onclick="VW_HR_PAYROLL.markAtt(${s.id},'half')">½</button>` : ''}
          ${status === 'in' ? `<button class="btn-sm" onclick="VW_HR_PAYROLL.markAtt(${s.id},'out')">Out</button>` : ''}
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>

  <!-- Monthly summary -->
  <div class="card">
    <h3 class="card-title">Month Summary — ${today.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3>
    ${activeStaff.map(s => {
      const myAtt = attendance.filter(a => a.staffId === s.id && new Date(a.date) >= monthStart);
      const present = myAtt.reduce((sum,a) => sum+(a.finalWorking||0), 0);
      const totalDays = today.getDate();
      const pct = Math.round(present/totalDays*100);
      return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border2)">
        <div style="font-size:12px;flex:1">${s.name}</div>
        <div style="flex:2">
          <div style="background:var(--border);border-radius:3px;height:6px">
            <div style="background:${pct>=80?'#22c55e':pct>=60?'var(--gold)':'var(--red)'};height:6px;border-radius:3px;width:${pct}%"></div>
          </div>
        </div>
        <div style="font-size:13px;font-weight:600;min-width:60px;text-align:right">${present}/${totalDays} days</div>
      </div>`;
    }).join('')}
  </div>`;
}

async function markAtt(staffId, action) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0,5);
  const all = await VW_DB.all(VW_DB.STORES.attendance);
  const existing = all.find(a => a.staffId === staffId && a.date === todayStr);
  if (action === 'in' || action === 'half') {
    if (existing) {
      existing.punchIn = existing.punchIn || timeStr;
      if (action === 'half') existing.finalWorking = 0.5;
      else existing.finalWorking = 1;
      await VW_DB.put(VW_DB.STORES.attendance, existing);
    } else {
      await VW_DB.put(VW_DB.STORES.attendance, {
        staffId, date: todayStr, punchIn: timeStr,
        finalWorking: action === 'half' ? 0.5 : 1,
        createdAt: now.toISOString()
      });
    }
  } else if (action === 'out' && existing) {
    existing.punchOut = timeStr;
    await VW_DB.put(VW_DB.STORES.attendance, existing);
  }
  showToast('Attendance marked', 'success');
  const container = document.getElementById('hr-tab-content');
  if (container) container.innerHTML = await renderAttendanceView();
}

async function markAllPresent() {
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0,5);
  const all = await VW_DB.all(VW_DB.STORES.attendance);
  const active = staff.filter(s => s.active !== false);
  for (const s of active) {
    const existing = all.find(a => a.staffId === s.id && a.date === todayStr);
    if (!existing) {
      await VW_DB.put(VW_DB.STORES.attendance, {
        staffId: s.id, date: todayStr, punchIn: timeStr,
        finalWorking: 1, createdAt: now.toISOString()
      });
    }
  }
  showToast(`${active.length} staff marked present`, 'success');
  const container = document.getElementById('hr-tab-content');
  if (container) container.innerHTML = await renderAttendanceView();
}

// ===== PAYROLL VIEW =====
async function renderPayrollView() {
  const isAdmin = VW_AUTH.isAdmin();
  const [staff, attendance] = await Promise.all([
    VW_DB.all(VW_DB.STORES.staff),
    VW_DB.all(VW_DB.STORES.attendance)
  ]);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const active = staff.filter(s => s.active !== false);

  return `
  <div class="card">
    <h3 class="card-title">Payroll — ${now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Calculated on ${daysInMonth}-day month. Salary = (Gross/12) × (Days Present / Working Days)</p>
    ${active.map(s => {
      const myAtt = attendance.filter(a => a.staffId === s.id && new Date(a.date) >= monthStart);
      const presentDays = myAtt.reduce((sum,a) => sum+(a.finalWorking||0), 0);
      const lop = Math.max(0, daysInMonth - presentDays); // clamp — no negative LOP
      const monthly = Math.round((s.grossSalary||0)/12);
      const perDay = monthly / daysInMonth;
      const gross = Math.round(perDay * presentDays);
      const basic = Math.round(gross * 0.6);
      const hra = Math.round(gross * 0.25);
      const allowance = gross - basic - hra;
      // PF: 12% of basic (employee), ESI: 0.75% if salary < 21000
      const pfEmp = gross <= 180000/12 ? Math.round(basic * 0.12) : 0;
      const esiEmp = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
      const pt = gross <= 10000 ? 0 : gross <= 15000 ? 150 : 200;
      const totalDed = pfEmp + esiEmp + pt;
      const netSalary = gross - totalDed;

      return `
      <div style="margin-bottom:10px;padding:10px;background:var(--bg2);border-radius:8px" onclick="VW_HR_PAYROLL.generatePayslip(${s.id})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:13px;font-weight:600">${s.name}</div>
            <div style="font-size:11px;color:var(--text3)">${s.designation||'—'} · ${presentDays}/${daysInMonth} days</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:700;color:${lop>5?'var(--red)':'var(--text1)'}">₹${netSalary.toLocaleString('en-IN')}</div>
            <div style="font-size:11px;color:var(--text3)">Net · ${lop>0?`LOP: ${lop.toFixed(1)}d`:'Full month'}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px;font-size:11px;color:var(--text3)">
          <span>Gross: ₹${gross.toLocaleString('en-IN')}</span>
          <span>PF: ₹${pfEmp}</span>
          <span>PT: ₹${pt}</span>
          ${esiEmp ? `<span>ESI: ₹${esiEmp}</span>` : ''}
        </div>
      </div>`;
    }).join('')}
    ${isAdmin ? `
    <button class="btn-primary full-width" style="margin-top:8px" onclick="VW_HR_PAYROLL.generateAllPayslips()">📄 Generate All Payslips</button>` : ''}
  </div>`;
}

// ===== PAYSLIP GENERATOR =====
async function generatePayslip(staffId) {
  const [s, attendance] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.staff, staffId),
    VW_DB.all(VW_DB.STORES.attendance)
  ]);
  if (!s) return;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const monthName = now.toLocaleDateString('en-IN', {month:'long', year:'numeric'});
  const myAtt = attendance.filter(a => a.staffId === staffId && new Date(a.date) >= monthStart);
  const presentDays = myAtt.reduce((sum,a) => sum+(a.finalWorking||0), 0);
  const lop = daysInMonth - presentDays;
  const monthly = Math.round((s.grossSalary||0)/12);
  const perDay = monthly / daysInMonth;
  const gross = Math.round(perDay * presentDays);
  const basic = Math.round(gross * 0.6);
  const hra = Math.round(gross * 0.25);
  const allowance = gross - basic - hra;
  const pfEmp = gross <= 15000 ? Math.round(basic * 0.12) : 0;
  const pfEr = pfEmp;
  const esiEmp = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
  const esiEr = gross <= 21000 ? Math.round(gross * 0.0325) : 0;
  const pt = gross <= 10000 ? 0 : gross <= 15000 ? 150 : 200;
  const totalDed = pfEmp + esiEmp + pt;
  const netSalary = gross - totalDed;
  const ctc = gross + pfEr + esiEr;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="background:#fff;color:#000;padding:16px;border-radius:8px;font-family:Arial,sans-serif">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #C8972B;padding-bottom:10px">
        <div style="font-size:16px;font-weight:700;color:#C8972B">VASSURE WHOLESALE PVT LTD</div>
        <div style="font-size:11px;color:#555">V Wholesale · Vijayawada, Andhra Pradesh</div>
        <div style="font-size:13px;font-weight:600;margin-top:6px">SALARY SLIP — ${monthName}</div>
      </div>
      <!-- Employee details -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;margin-bottom:10px">
        <div><strong>Name:</strong> ${s.name}</div>
        <div><strong>Code:</strong> ${s.id}</div>
        <div><strong>Designation:</strong> ${s.designation||'—'}</div>
        <div><strong>Department:</strong> ${s.department||'—'}</div>
        <div><strong>Joining Date:</strong> ${s.joiningDate||'—'}</div>
        <div><strong>Bank:</strong> ${s.bankName||'—'}</div>
        <div><strong>Account No:</strong> ${s.bankAccount||'—'}</div>
        <div><strong>PF No:</strong> ${s.pfNumber||'—'}</div>
        <div><strong>Days in Month:</strong> ${daysInMonth}</div>
        <div><strong>Days Present:</strong> ${presentDays}</div>
        <div><strong>LOP Days:</strong> ${lop.toFixed(1)}</div>
        <div><strong>Gross CTC/yr:</strong> ₹${(s.grossSalary||0).toLocaleString('en-IN')}</div>
      </div>
      <!-- Earnings & Deductions -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div style="border:1px solid #ddd;border-radius:6px;padding:8px">
          <div style="font-weight:700;font-size:12px;color:#C8972B;margin-bottom:6px">EARNINGS</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span>BASIC + DA</span><span>₹${basic.toLocaleString('en-IN')}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span>HRA</span><span>₹${hra.toLocaleString('en-IN')}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span>Allowance</span><span>₹${allowance.toLocaleString('en-IN')}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;border-top:1px solid #ddd;margin-top:4px;padding-top:4px"><span>GROSS</span><span>₹${gross.toLocaleString('en-IN')}</span></div>
        </div>
        <div style="border:1px solid #ddd;border-radius:6px;padding:8px">
          <div style="font-weight:700;font-size:12px;color:#C8972B;margin-bottom:6px">DEDUCTIONS</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span>PF (Employee)</span><span>₹${pfEmp}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span>Professional Tax</span><span>₹${pt}</span></div>
          ${esiEmp ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span>ESI (Employee)</span><span>₹${esiEmp}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;border-top:1px solid #ddd;margin-top:4px;padding-top:4px"><span>TOTAL DED</span><span>₹${totalDed}</span></div>
        </div>
      </div>
      <!-- Net salary -->
      <div style="background:#C8972B;color:#fff;padding:10px;border-radius:6px;text-align:center;margin-bottom:8px">
        <div style="font-size:11px;margin-bottom:2px">NET SALARY PAYABLE</div>
        <div style="font-size:22px;font-weight:700">₹${netSalary.toLocaleString('en-IN')}</div>
      </div>
      <div style="font-size:10px;color:var(--text3);text-align:center">This is a computer-generated salary slip · Vassure Wholesale Pvt Ltd</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-wa" style="flex:1" onclick="VW_HR_PAYROLL.sendPayslipWhatsApp(${staffId},${netSalary})">💬 Send to Staff</button>
      <button class="btn-secondary" onclick="closeSheet()">Close</button>
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function sendPayslipWhatsApp(staffId, netSalary) {
  const s = await VW_DB.getById(VW_DB.STORES.staff, staffId);
  if (!s?.phone) { showToast('No phone number for this staff', 'warn'); return; }
  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const msg = encodeURIComponent(`Dear ${s.name},\n\nYour salary for ${monthName} has been processed.\n\nNet Salary: ₹${netSalary.toLocaleString('en-IN')}\n\nPlease contact HR for any queries.\n\n— V Wholesale HR`);
  window.open(`https://wa.me/91${s.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
}

async function generateAllPayslips() {
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const active = staff.filter(s => s.active !== false);
  showToast(`Generating ${active.length} payslips — opening one by one`, 'info');
  window._payslipQueue = active;
  window._payslipIdx = 0;
  if (active.length) await generatePayslip(active[0].id);
}

// ===== LEAVES VIEW =====
async function renderLeavesView() {
  const isAdmin = VW_AUTH.isAdmin();
  const profile = VW_AUTH.getCurrentProfile();
  const [leaves, staff] = await Promise.all([
    VW_DB.all(VW_DB.STORES.leaves),
    VW_DB.all(VW_DB.STORES.staff)
  ]);
  const staffMap = {}; staff.forEach(s => staffMap[s.id] = s);
  const pending = leaves.filter(l => l.status === 'pending').sort((a,b) => new Date(b.appliedAt)-new Date(a.appliedAt));
  const approved = leaves.filter(l => l.status === 'approved').sort((a,b) => new Date(b.fromDate)-new Date(a.fromDate)).slice(0,10);

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <h3 style="margin:0">Leave Management</h3>
    <button class="btn-sm" onclick="VW_HR_PAYROLL.showApplyLeave()">+ Apply Leave</button>
  </div>

  ${pending.length ? `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Pending Approval <span class="badge" style="background:var(--gold)">${pending.length}</span></h3>
    ${pending.map(l => {
      const s = staffMap[l.staffId];
      return `
      <div class="task-card">
        <div class="task-card-header">
          <span class="task-dept">${s?.name||'Unknown'}</span>
          <span style="font-size:12px;color:var(--gold)">${l.days} day${l.days>1?'s':''}</span>
        </div>
        <div style="font-size:12px;color:var(--text3)">${l.type} · ${new Date(l.fromDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} ${l.days>1?'→ '+new Date(l.toDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):''}</div>
        ${l.reason ? `<div style="font-size:12px;color:var(--text2);margin-top:3px">${l.reason}</div>` : ''}
        ${isAdmin ? `
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn-sm" style="background:#22c55e;color:#fff" onclick="VW_HR_PAYROLL.approveLeave(${l.id})">✓ Approve</button>
          <button class="btn-sm" style="color:var(--red)" onclick="VW_HR_PAYROLL.rejectLeave(${l.id})">✕ Reject</button>
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">Recent Leaves</h3>
    ${!approved.length ? '<p class="empty-msg">No leave records yet</p>' :
    approved.map(l => {
      const s = staffMap[l.staffId];
      return `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div>
          <div style="font-size:13px;font-weight:600">${s?.name||'—'}</div>
          <div style="font-size:12px;color:var(--text3)">${l.type} · ${new Date(l.fromDate).toLocaleDateString('en-IN')} · ${l.days} day${l.days>1?'s':''}</div>
        </div>
        <span class="badge" style="background:#22c55e">Approved</span>
      </div>`;
    }).join('')}
  </div>`;
}

async function showApplyLeave(staffId) {
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const profile = VW_AUTH.getCurrentProfile();
  const isAdmin = VW_AUTH.isAdmin();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Apply for Leave</h3>
    ${isAdmin ? `
    <div class="form-group"><label>Staff Member</label>
      <select id="leave-staff">
        ${staff.filter(s=>s.active!==false).map(s => `<option value="${s.id}" ${s.id===staffId?'selected':''}>${s.name}</option>`).join('')}
      </select>
    </div>` : `<p class="sheet-meta">Applying for: ${profile?.name||'—'}</p>`}
    <div class="form-group"><label>Leave Type</label>
      <select id="leave-type">
        <option>Casual Leave</option><option>Sick Leave</option><option>Earned Leave</option>
        <option>Loss of Pay</option><option>Compensatory Off</option><option>Other</option>
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group"><label>From Date</label><input type="date" id="leave-from" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>To Date</label><input type="date" id="leave-to" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="form-group"><label>Reason</label><textarea id="leave-reason" style="height:60px" placeholder="Brief reason for leave"></textarea></div>
    <button class="btn-primary full-width" onclick="VW_HR_PAYROLL.submitLeave()">Submit Leave Request</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function submitLeave() {
  const fromDate = document.getElementById('leave-from')?.value;
  const toDate = document.getElementById('leave-to')?.value;
  if (!fromDate || !toDate) { showToast('Select dates', 'warn'); return; }
  const from = new Date(fromDate), to = new Date(toDate);
  const days = Math.round((to-from)/(1000*60*60*24))+1;
  const isAdmin = VW_AUTH.isAdmin();
  const staffSel = document.getElementById('leave-staff');
  const staffId = isAdmin && staffSel ? parseInt(staffSel.value) : null;
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.leaves, {
    staffId, staffName: staffSel?.options[staffSel.selectedIndex]?.text||profile?.name||'',
    type: document.getElementById('leave-type')?.value||'Casual Leave',
    fromDate, toDate, days,
    reason: document.getElementById('leave-reason')?.value||'',
    status: isAdmin ? 'approved' : 'pending',
    appliedAt: new Date().toISOString(),
    appliedByName: profile?.name||''
  });
  showToast(`Leave request ${isAdmin?'approved':'submitted'}`, 'success');
  closeSheet();
  const container = document.getElementById('hr-tab-content');
  if (container) container.innerHTML = await renderLeavesView();
}

async function approveLeave(leaveId) {
  const l = await VW_DB.getById(VW_DB.STORES.leaves, leaveId);
  if (!l) return;
  l.status = 'approved';
  l.approvedBy = VW_AUTH.getCurrentProfile()?.name||'';
  l.approvedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.leaves, l);
  showToast('Leave approved', 'success');
  const container = document.getElementById('hr-tab-content');
  if (container) container.innerHTML = await renderLeavesView();
}

async function rejectLeave(leaveId) {
  const l = await VW_DB.getById(VW_DB.STORES.leaves, leaveId);
  if (!l) return;
  l.status = 'rejected';
  await VW_DB.put(VW_DB.STORES.leaves, l);
  showToast('Leave rejected', 'info');
  const container = document.getElementById('hr-tab-content');
  if (container) container.innerHTML = await renderLeavesView();
}

async function markAttendanceForStaff(staffId, staffName) {
  await markAtt(staffId, 'in');
}

window.VW_HR_PAYROLL = {
  renderHRPage, switchHRTab,
  showAddStaff, saveStaff, openStaffDetail,
  renderAttendanceView, markAtt, markAllPresent, markAttendanceForStaff,
  renderPayrollView, generatePayslip, generateAllPayslips, sendPayslipWhatsApp,
  renderLeavesView, showApplyLeave, submitLeave, approveLeave, rejectLeave
};




/* === dispatch.js === */

// ============================================================
// DISPATCH / GATE PASS / ACCOUNTS PAYMENT VERIFICATION WORKFLOW
// ============================================================
// Sequence: Invoice created (fulfillment method chosen) -> Accounts
// verifies payment (hard gate) -> Dispatch checks off each item
// individually with its own photo, marking any as pending if not ready
// -> Gate Pass (tick-box + printable slip) fires per batch leaving,
// possibly several per invoice for partial shipments -> a combined PDF
// of that batch's photos gets generated, shared with the customer, and
// saved internally. The invoice itself isn't "fully dispatched" until
// every single item is checked off, even though Gate Passes can fire on
// partial batches along the way.

const FULFILLMENT_LABELS = {
  self_pickup: 'Self Pickup by Customer',
  vw_delivery: 'V Wholesale Delivery (own truck)',
  self_transport: 'Customer\'s Own Transport',
  staff_pickup_deliver: 'Staff Picks from Vendor → Delivers to Site',
  direct_delivery: 'Direct from Vendor to Customer Site'
};

// ---------- ACCOUNTS QUEUE ----------
// Lists every invoice still waiting on payment verification. Once
// verified here, Dispatch's screens for that invoice become usable.
async function renderAccountsQueue() {
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const customerById = {}; customers.forEach(c => customerById[c.id] = c);

  // Only show invoices that have completed the approval chain (approved)
  // but haven't had payment verified yet. Invoices still in pending_approval
  // belong in the approval workflow, not here.
  const pending = invoices
    .filter(i => !i.paymentVerified && i.approvalStatus === 'approved')
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  const verified = invoices
    .filter(i => i.paymentVerified)
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
  const stillApproving = invoices
    .filter(i => !i.paymentVerified && i.approvalStatus === 'pending_approval')
    .length;

  return `
  <div class="module-header"><h2>Accounts — Payment Verification</h2></div>
  <div class="form-group" style="margin-bottom:10px">
    <input type="text" id="acc-invoice-search" placeholder="Search by invoice no, customer name, phone..." oninput="VW_DISPATCH.searchAccountsInvoices(this.value)">
  </div>
  ${stillApproving ? `<div style="padding:10px 12px;background:rgba(200,151,43,0.1);border-radius:8px;margin-bottom:10px;font-size:13px;color:var(--gold)">⏳ ${stillApproving} invoice${stillApproving>1?'s are':' is'} still awaiting management approval — they'll appear here once approved</div>` : ''}
  <div id="acc-invoice-results">
  <div class="card">
    <h3 class="card-title">Ready for Payment Verification <span class="badge">${pending.length}</span></h3>
    ${!pending.length ? '<p class="empty-msg">Nothing waiting — all caught up ✓</p>' : pending.map(inv => {
      const cust = customerById[inv.customerId];
      return `
      <div class="task-card" onclick="VW_DISPATCH.openAccountsVerify(${inv.id})">
        <div class="task-card-header">
          <span class="task-dept">${inv.invoiceNo}</span>
          <span class="badge" style="background:${inv.creditSale ? 'var(--gold)' : '#378ADD'}">${inv.creditSale ? 'Credit' : (inv.paymentMethod||'Cash')}</span>
        </div>
        <p style="font-size:13px;margin:4px 0">${cust ? cust.name+' &middot; '+cust.phone : 'Walk-in'} &middot; ₹${inv.total.toLocaleString('en-IN')}</p>
        ${inv.cashDiscountAmt ? `<p style="font-size:12px;color:var(--green)">Cash discount applied: −₹${inv.cashDiscountAmt.toLocaleString('en-IN')}</p>` : ''}
        ${inv.salesExecutiveName ? `<p style="font-size:12px;color:var(--text3)">Sales: ${inv.salesExecutiveName}${inv.createdByName && inv.createdByName!==inv.salesExecutiveName ? ' &middot; Billed by: '+inv.createdByName : ''}</p>` : ''}
        <p style="font-size:12px;color:var(--text3)">${new Date(inv.date).toLocaleDateString('en-IN')} &middot; ${FULFILLMENT_LABELS[inv.fulfillmentMethod] || 'Self Pickup'}</p>
      </div>`;
    }).join('')}
  </div>
  <div class="card">
    <h3 class="card-title">Recently Verified</h3>
    ${!verified.length ? '<p class="empty-msg">None yet</p>' : verified.map(inv => {
      const cust = customerById[inv.customerId];
      return `
      <div class="task-card" onclick="VW_DISPATCH.openAccountsVerify(${inv.id})">
        <div class="task-card-header"><span class="task-dept">${inv.invoiceNo}</span><span class="badge" style="background:#22c55e">✓ Verified</span></div>
        <p style="font-size:13px;margin:4px 0">${cust ? cust.name : 'Walk-in'} &middot; ₹${inv.total.toLocaleString('en-IN')}</p>
        <p style="font-size:12px;color:var(--text3)">by ${inv.paymentVerifiedBy||'—'} &middot; ${inv.paymentVerifiedAt ? new Date(inv.paymentVerifiedAt).toLocaleDateString('en-IN') : ''}</p>
      </div>`;
    }).join('')}
  </div>
  </div>`; // close acc-invoice-results
}

async function searchAccountsInvoices(term) {
  if (!term || term.length < 2) {
    const el = document.getElementById('acc-invoice-results');
    if (el) { navigateTo('accounts'); return; }
    return;
  }
  const t = term.toLowerCase();
  const [invoices, customers] = await Promise.all([VW_DB.all(VW_DB.STORES.invoices), VW_DB.all(VW_DB.STORES.customers)]);
  const custMap = {}; customers.forEach(c => custMap[c.id] = c);
  const matches = invoices.filter(i =>
    (i.invoiceNo||'').toLowerCase().includes(t) ||
    (custMap[i.customerId]?.name||'').toLowerCase().includes(t) ||
    (custMap[i.customerId]?.phone||'').includes(t)
  ).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);
  const el = document.getElementById('acc-invoice-results');
  if (!el) return;
  el.innerHTML = `<div class="card"><h3 class="card-title">Search Results (${matches.length})</h3>
    ${!matches.length ? '<p class="empty-msg">No invoices found</p>' :
    matches.map(inv => {
      const cust = custMap[inv.customerId];
      return `<div class="task-card" onclick="VW_DISPATCH.openAccountsVerify(${inv.id})">
        <div class="task-card-header">
          <span class="task-dept">${inv.invoiceNo}</span>
          <span class="badge" style="background:${inv.paymentVerified?'#22c55e':inv.creditSale?'var(--gold)':'#378ADD'}">${inv.paymentVerified?'✓ Verified':inv.creditSale?'Credit':'Pending'}</span>
        </div>
        <p style="font-size:13px;margin:4px 0">${cust?cust.name+' · '+cust.phone:'Walk-in'} · ₹${(inv.total||0).toLocaleString('en-IN')}</p>
        <p style="font-size:12px;color:var(--text3)">${new Date(inv.date).toLocaleDateString('en-IN')}</p>
      </div>`;
    }).join('')}
  </div>`;
}

window.VW_DISPATCH = {
  renderAccountsQueue, openAccountsVerify, confirmPaymentVerified, searchAccountsInvoices
};
// Expose for test suite
window.FULFILLMENT_LABELS = FULFILLMENT_LABELS;

async function openAccountsVerify(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const customer = inv.customerId ? await VW_DB.getById(VW_DB.STORES.customers, inv.customerId) : null;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${inv.invoiceNo}</h3>
    <p class="sheet-meta">${customer ? customer.name+' · '+customer.phone : 'Walk-in Customer'}</p>
    <div class="req-item-card" style="margin:10px 0">
      <div style="font-size:13px;padding:3px 0"><strong>Total:</strong> ₹${inv.total.toLocaleString('en-IN')}</div>
      <div style="font-size:13px;padding:3px 0"><strong>Payment Method:</strong> ${inv.creditSale ? 'Credit Sale' : (inv.paymentMethod||'Cash')}</div>
      <div style="font-size:13px;padding:3px 0"><strong>Amount Received:</strong> ₹${(inv.amountReceived||0).toLocaleString('en-IN')}</div>
      ${inv.creditSale ? `<div style="font-size:13px;padding:3px 0"><strong>Balance Due:</strong> ₹${(inv.balanceDue||0).toLocaleString('en-IN')}</div>` : ''}
      <div style="font-size:13px;padding:3px 0"><strong>Date:</strong> ${new Date(inv.date).toLocaleDateString('en-IN')}</div>
    </div>
    ${inv.paymentVerified ? `
      <p style="font-size:13px;color:#22c55e;text-align:center;padding:8px;background:rgba(34,197,94,0.08);border-radius:8px">✓ Payment verified by ${inv.paymentVerifiedBy||''} on ${inv.paymentVerifiedAt ? new Date(inv.paymentVerifiedAt).toLocaleDateString('en-IN') : ''}</p>
    ` : `
      <p style="font-size:12px;color:var(--text3);margin-bottom:10px">Confirm the payment shown above genuinely matches what's been received before approving — Dispatch can't start preparing this order until you do.</p>
      <button class="btn-primary full-width" onclick="VW_DISPATCH.confirmPaymentVerified(${invoiceId})">✓ Verify &amp; Approve for Dispatch</button>
    `}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function confirmPaymentVerified(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const profile = VW_AUTH.getCurrentProfile();
  inv.paymentVerified = true;
  inv.paymentVerifiedBy = profile ? profile.name : '';
  inv.paymentVerifiedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.invoices, inv);
  showToast('Payment verified — Dispatch can now proceed', 'success');
  closeSheet();
  navigateTo('accounts');
}

// ---------- DISPATCH QUEUE ----------
async function renderDispatchQueue() {
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const customerById = {}; customers.forEach(c => customerById[c.id] = c);

  // Only show invoices that have payment verified — Dispatch can't act
  // on anything until Accounts gives the green light.
  const ready = invoices.filter(i => i.paymentVerified && !isFullyDispatched(i))
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  const done = invoices.filter(i => i.paymentVerified && isFullyDispatched(i))
    .sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  const blocked = invoices.filter(i => !i.paymentVerified)
    .sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return `
  <div class="module-header"><h2>Dispatch</h2></div>
  ${blocked.length ? `
  <div class="card" style="border-color:var(--gold)">
    <h3 class="card-title" style="color:var(--gold)">⏳ Awaiting Accounts Approval (${blocked.length})</h3>
    ${blocked.map(inv => {
      const cust = customerById[inv.customerId];
      return `<div class="task-card" style="opacity:0.6">
        <div class="task-card-header"><span class="task-dept">${inv.invoiceNo}</span><span class="badge" style="background:var(--gold)">Payment Pending</span></div>
        <p style="font-size:13px;margin:4px 0">${cust ? cust.name : 'Walk-in'} &middot; ₹${inv.total.toLocaleString('en-IN')}</p>
      </div>`;
    }).join('')}
  </div>` : ''}
  <div class="card">
    <h3 class="card-title">Ready to Dispatch <span class="badge">${ready.length}</span></h3>
    ${!ready.length ? '<p class="empty-msg">Nothing ready — check back soon</p>' : ready.map(inv => {
      const cust = customerById[inv.customerId];
      const items = inv.items || [];
      const checkedCount = items.filter(i => i.dispatchStatus === 'checked').length;
      return `
      <div class="task-card" onclick="VW_DISPATCH.openDispatchDetail(${inv.id})">
        <div class="task-card-header">
          <span class="task-dept">${inv.invoiceNo}</span>
          <span class="badge" style="background:${checkedCount === 0 ? '#378ADD' : 'var(--gold)'}">
            ${checkedCount}/${items.length} checked
          </span>
        </div>
        <p style="font-size:13px;margin:4px 0">${cust ? cust.name+' &middot; '+cust.phone : 'Walk-in'} &middot; ₹${inv.total.toLocaleString('en-IN')}</p>
        <p style="font-size:12px;color:var(--text3)">${FULFILLMENT_LABELS[inv.fulfillmentMethod]||'Self Pickup'} &middot; ${new Date(inv.date).toLocaleDateString('en-IN')}</p>
      </div>`;
    }).join('')}
  </div>
  <div class="card">
    <h3 class="card-title">Fully Dispatched</h3>
    ${!done.length ? '<p class="empty-msg">None yet</p>' : done.map(inv => {
      const cust = customerById[inv.customerId];
      return `
      <div class="task-card" onclick="VW_DISPATCH.openDispatchDetail(${inv.id})">
        <div class="task-card-header"><span class="task-dept">${inv.invoiceNo}</span><span class="badge" style="background:#22c55e">✓ Dispatched</span></div>
        <p style="font-size:13px;margin:4px 0">${cust ? cust.name : 'Walk-in'} &middot; ₹${inv.total.toLocaleString('en-IN')}</p>
      </div>`;
    }).join('')}
  </div>`;
}

function isFullyDispatched(inv) {
  const items = inv.items || [];
  return items.length > 0 && items.every(i => i.dispatchStatus === 'checked');
}

// ---------- DISPATCH DETAIL — item-by-item checklist ----------
async function openDispatchDetail(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const customer = inv.customerId ? await VW_DB.getById(VW_DB.STORES.customers, inv.customerId) : null;
  const gatePasses = (await VW_DB.all(VW_DB.STORES.gatePasses)).filter(gp => gp.invoiceId === invoiceId);
  const items = inv.items || [];

  // Lowest-qty-first pick plan per item (from multi-location stock), shown on the checklist.
  // Prefer the snapshot taken at billing (locations are deducted at sale, so a
  // live recompute would read post-sale rows); fall back to live for older invoices.
  const pickInfo = {};
  for (let i = 0; i < items.length; i++) {
    const pid = items[i].productId;
    if (!pid) continue;
    if (Array.isArray(items[i].dispatchPick) && items[i].dispatchPick.length) {
      pickInfo[i] = { plan: items[i].dispatchPick, shortfall: 0 };
      continue;
    }
    try {
      const { locations } = await getProductStockLocations(pid);
      if (locations.length) pickInfo[i] = pickStockLowestFirst(locations, items[i].qty);
    } catch(_) {}
  }

  if (!inv.paymentVerified) {
    showToast('Accounts must verify payment first', 'warn');
    return;
  }

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${inv.invoiceNo}</h3>
    <p class="sheet-meta">${customer ? customer.name+' · '+customer.phone : 'Walk-in Customer'} &middot; ${FULFILLMENT_LABELS[inv.fulfillmentMethod]||'Self Pickup'}</p>

    <div class="form-group">
      <label>Fulfillment Method</label>
      <select id="dp-fulfillment-method" style="width:100%" onchange="VW_DISPATCH.onFulfillmentChange(this.value,${invoiceId})">
        <option value="self_pickup" ${inv.fulfillmentMethod==='self_pickup'?'selected':''}>Self Pickup by Customer</option>
        <option value="vw_delivery" ${inv.fulfillmentMethod==='vw_delivery'?'selected':''}>V Wholesale Delivery (own truck)</option>
        <option value="self_transport" ${inv.fulfillmentMethod==='self_transport'?'selected':''}>Customer's Own Transport</option>
        <option value="staff_pickup_deliver" ${inv.fulfillmentMethod==='staff_pickup_deliver'?'selected':''}>Staff Picks from Vendor → Delivers to Site</option>
        <option value="direct_delivery" ${inv.fulfillmentMethod==='direct_delivery'?'selected':''}>Direct from Vendor to Customer Site</option>
      </select>
    </div>

    <!-- Staff picks from vendor, delivers to site -->
    <div id="staff-pickup-fields" style="display:${inv.fulfillmentMethod==='staff_pickup_deliver'?'block':'none'}">
      <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.3);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:#60A5FA;margin-bottom:4px">🚶 Staff Pickup & Delivery</div>
        <div style="font-size:12px;color:var(--text2)">Your staff member goes to the vendor, picks up the material, and delivers directly to customer site. Gate pass records which staff member is handling this.</div>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin:0">
          <label>Staff Member Name</label>
          <input type="text" id="spd-staff-name" value="${inv.staffPickupName||''}" placeholder="Who is going to pick up">
        </div>
        <div class="form-group" style="margin:0">
          <label>Staff WhatsApp</label>
          <input type="tel" id="spd-staff-phone" value="${inv.staffPickupPhone||''}" placeholder="Send pickup instructions">
        </div>
      </div>
      <div class="form-group">
        <label>Vendor / Supplier to pick from</label>
        <input type="text" id="spd-vendor-name" value="${inv.staffPickupVendor||''}" placeholder="e.g. Ravi Tiles Depot, Bhavanipuram">
      </div>
      <div class="form-row">
        <div class="form-group" style="margin:0">
          <label>Vendor Phone</label>
          <input type="tel" id="spd-vendor-phone" value="${inv.staffPickupVendorPhone||''}" placeholder="Vendor contact">
        </div>
        <div class="form-group" style="margin:0">
          <label>Vehicle to Use</label>
          <input type="text" id="spd-vehicle" value="${inv.staffPickupVehicle||''}" placeholder="e.g. AP39AB1234">
        </div>
      </div>
    </div>

    <!-- Direct delivery extra fields -->
    <div id="direct-delivery-fields" style="display:${inv.fulfillmentMethod==='direct_delivery'?'block':'none'}">
      <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:6px">📦 Direct from Vendor/Supplier</div>
        <div style="font-size:12px;color:var(--text2)">Vendor or their driver delivers directly to customer site. They get a WhatsApp link to confirm delivery item by item.</div>
      </div>
      <div class="form-group">
        <label>Vendor / Supplier Name</label>
        <input type="text" id="dd-vendor-name" value="${inv.directDeliveryVendor||''}" placeholder="e.g. Ravi Tiles Depot">
      </div>
      <div class="form-group">
        <label>Vendor / Driver WhatsApp</label>
        <input type="tel" id="dd-vendor-phone" value="${inv.directDeliveryPhone||''}" placeholder="WhatsApp number to send delivery link">
      </div>
      <div class="form-group">
        <label>Vehicle No. (if known)</label>
        <input type="text" id="dd-vehicle" value="${inv.directDeliveryVehicle||''}" placeholder="e.g. AP16 AB 1234">
      </div>
      <div class="form-group">
        <label>Expected Delivery Date</label>
        <input type="date" id="dd-expected-date" value="${inv.directDeliveryDate||new Date().toISOString().split('T')[0]}">
      </div>
    </div>

    <h4 style="margin:12px 0 8px;font-size:14px">Items Checklist</h4>
    <div id="dp-items-list">
      ${items.map((item, idx) => renderDispatchItem(item, idx, invoiceId, pickInfo[idx])).join('')}
    </div>

    ${gatePasses.length ? `
    <h4 style="margin:16px 0 8px;font-size:14px">Gate Passes Issued</h4>
    <div id="dp-gate-passes">
      ${gatePasses.map(gp => `
        <div class="req-item-card" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600;font-size:13px">${gp.gatePassNo}</span>
            <button class="btn-sm" onclick="VW_DISPATCH.printGatePass(${gp.id})">🖨 Print</button>
          </div>
          <p style="font-size:12px;color:var(--text3);margin:4px 0">${(gp.itemIndexes||[]).length} item(s) &middot; ${gp.confirmedAt ? new Date(gp.confirmedAt).toLocaleDateString('en-IN') : 'Not confirmed'}</p>
        </div>`).join('')}
    </div>` : ''}

    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn-secondary" style="flex:1" onclick="VW_DISPATCH.saveFulfillmentMethod(${invoiceId})">💾 Save Changes</button>
      ${inv.fulfillmentMethod === 'self_pickup' ? 
        `<button class="btn-primary" style="flex:1" onclick="VW_DISPATCH.handleSelfPickup(${invoiceId})">📷 Self Pickup</button>` :
        inv.fulfillmentMethod === 'direct_delivery' ? 
        `<button class="btn-primary" style="flex:1;background:#25D366" onclick="VW_DISPATCH.createDirectDeliveryGatePass(${invoiceId})">📦 Send to Vendor</button>` :
        inv.fulfillmentMethod === 'staff_pickup_deliver' ? 
        `<button class="btn-primary" style="flex:1;background:#60A5FA" onclick="VW_DISPATCH.createStaffPickupGatePass(${invoiceId})">🚶 Send Task to Staff</button>` :
        `<button class="btn-primary" style="flex:1" onclick="VW_DISPATCH.openCreateGatePass(${invoiceId})">🛂 New Gate Pass</button>`}
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function renderDispatchItem(item, idx, invoiceId, pick) {
  const isChecked = item.dispatchStatus === 'checked';
  const pickBlock = pick && pick.plan && pick.plan.length ? `
    <div style="background:rgba(245,200,66,0.07);border:1px solid var(--gold-border);border-radius:8px;padding:7px 9px;margin-top:8px">
      <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:3px">📍 PICK (lowest stock first)</div>
      ${pick.plan.map(p=>`<div style="font-size:11px;display:flex;justify-content:space-between"><span>${p.warehouse_code||'—'} · ${p.rack_no||'—'}/${p.shelf_no||'—'}</span><strong>${p.take}</strong></div>`).join('')}
      ${pick.shortfall>0?`<div style="font-size:10px;color:var(--red);margin-top:3px">⚠ Short by ${pick.shortfall} — not enough in recorded locations</div>`:''}
    </div>` : '';
  return `
  <div class="req-item-card" id="dp-item-${idx}" style="margin-bottom:8px;border-color:${isChecked ? '#22c55e' : 'var(--border2)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${item.name}</div>
        <div style="font-size:12px;color:var(--text3)">${item.qty} ${item.unit||''} &middot; ₹${(item.price||0).toLocaleString('en-IN')}</div>
      </div>
      <span class="badge" style="background:${isChecked ? '#22c55e' : '#888'};white-space:nowrap">
        ${isChecked ? '✓ Checked' : 'Pending'}
      </span>
    </div>
    ${pickBlock}
    ${item.dispatchPhoto ? `<img src="${item.dispatchPhotoUrl||''}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-top:8px" onclick="window.open('${item.dispatchPhotoUrl||''}','_blank')">` : ''}
    <div style="display:flex;gap:6px;margin-top:8px">
      <input type="file" accept="image/*" capture="environment" style="display:none" id="dp-photo-${idx}" onchange="VW_DISPATCH.handleItemPhoto(this, ${invoiceId}, ${idx})">
      <button class="btn-sm" style="flex:1" onclick="document.getElementById('dp-photo-${idx}').click()">📷 ${item.dispatchPhoto ? 'Replace Photo' : 'Add Photo'}</button>
      ${!isChecked ? `<button class="btn-sm" style="flex:1;background:var(--gold);color:#000" onclick="VW_DISPATCH.markItemChecked(${invoiceId}, ${idx})">✓ Mark Checked</button>` : ''}
      ${isChecked ? `<button class="btn-sm" style="flex:1" onclick="VW_DISPATCH.markItemPending(${invoiceId}, ${idx})">↩ Mark Pending</button>` : ''}
    </div>
  </div>`;
}

async function handleItemPhoto(input, invoiceId, itemIdx) {
  const file = input.files[0];
  if (!file) return;
  showToast('Uploading photo...', 'info');
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const path = await VW_DB.uploadDispatchPhoto(dataUrl, inv.invoiceNo, itemIdx);
  const url = await VW_DB.getDispatchPhotoUrl(path);
  inv.items[itemIdx].dispatchPhoto = path;
  inv.items[itemIdx].dispatchPhotoUrl = url;
  await VW_DB.put(VW_DB.STORES.invoices, inv);
  showToast('Photo saved', 'success');
  await openDispatchDetail(invoiceId);
}

async function markItemChecked(invoiceId, itemIdx) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  inv.items[itemIdx].dispatchStatus = 'checked';
  inv.items[itemIdx].checkedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.invoices, inv);
  if (isFullyDispatched(inv)) showToast('All items checked — invoice fully dispatched! 🎉', 'success');
  else showToast('Item marked as checked', 'success');
  await openDispatchDetail(invoiceId);
}

async function markItemPending(invoiceId, itemIdx) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  inv.items[itemIdx].dispatchStatus = 'pending';
  inv.items[itemIdx].checkedAt = null;
  await VW_DB.put(VW_DB.STORES.invoices, inv);
  showToast('Item marked as pending', 'info');
  await openDispatchDetail(invoiceId);
}

async function saveFulfillmentMethod(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const method = document.getElementById('dp-fulfillment-method')?.value || inv.fulfillmentMethod;
  inv.fulfillmentMethod = method;

  // Save direct delivery details
  if (method === 'direct_delivery') {
    inv.directDeliveryVendor = document.getElementById('dd-vendor-name')?.value.trim() || '';
    inv.directDeliveryPhone = document.getElementById('dd-vendor-phone')?.value.trim() || '';
    inv.directDeliveryVehicle = document.getElementById('dd-vehicle')?.value.trim() || '';
    inv.directDeliveryDate = document.getElementById('dd-expected-date')?.value || '';
  }

  // Save staff pickup+deliver details
  if (method === 'staff_pickup_deliver') {
    inv.staffPickupName = document.getElementById('spd-staff-name')?.value.trim() || '';
    inv.staffPickupPhone = document.getElementById('spd-staff-phone')?.value.trim() || '';
    inv.staffPickupVendor = document.getElementById('spd-vendor-name')?.value.trim() || '';
    inv.staffPickupVendorPhone = document.getElementById('spd-vendor-phone')?.value.trim() || '';
    inv.staffPickupVehicle = document.getElementById('spd-vehicle')?.value.trim() || '';
  }

  await VW_DB.put(VW_DB.STORES.invoices, inv);
  showToast('Fulfillment method saved ✓', 'success');
  closeSheet();
}

// ---------- GATE PASS CREATION ----------
async function openCreateGatePass(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const items = inv.items || [];
  const checkedItems = items.map((item, idx) => ({ item, idx })).filter(({ item }) => {
    // Only show items that are checked but not already assigned to a gate pass
    return item.dispatchStatus === 'checked' && !item.gatePassId;
  });

  if (!checkedItems.length) {
    showToast('No checked items available for a new Gate Pass — check off some items first', 'warn');
    return;
  }

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Gate Pass — ${inv.invoiceNo}</h3>
    <p class="sheet-meta">Select which items are leaving in this batch</p>
    <div id="gp-items-list">
      ${checkedItems.map(({ item, idx }) => `
        <label class="route-check-row" style="margin-bottom:8px;padding:8px;background:var(--bg2);border-radius:8px">
          <input type="checkbox" name="gp-item" value="${idx}" checked>
          <span>${item.name} &middot; ${item.qty} ${item.unit||''}</span>
        </label>`).join('')}
    </div>
    <div class="form-group" style="margin-top:12px">
      <label>Vehicle / Transport Details (if applicable)</label>
      <input type="text" id="gp-vehicle" placeholder="e.g. AP16 AB 1234 or Customer Own Transport" value="${inv.vehicleNumber||''}">
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0">
        <label>Driver / Contact Name</label>
        <input type="text" id="gp-driver" placeholder="e.g. Ravi Kumar">
      </div>
      <div class="form-group" style="margin:0">
        <label>Driver WhatsApp</label>
        <input type="tel" id="gp-driver-phone" placeholder="Send delivery link" maxlength="10">
      </div>
    </div>
    <label class="route-check-row" style="margin-top:8px">
      <input type="checkbox" id="gp-confirm">
      <span>I confirm the goods listed are physically present, verified, and ready to leave the premises</span>
    </label>
    <button class="btn-primary full-width" style="margin-top:12px" onclick="VW_DISPATCH.confirmCreateGatePass(${invoiceId})">🛂 Generate Gate Pass</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function confirmCreateGatePass(invoiceId) {
  const confirmCheckbox = document.getElementById('gp-confirm');
  if (!confirmCheckbox?.checked) {
    showToast('Please tick the confirmation checkbox before generating the Gate Pass', 'warn');
    return;
  }

  const selectedIdxs = [...document.querySelectorAll('input[name="gp-item"]:checked')].map(cb => parseInt(cb.value));
  if (!selectedIdxs.length) {
    showToast('Select at least one item for this Gate Pass', 'warn');
    return;
  }

  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const profile = VW_AUTH.getCurrentProfile();
  const fy = getFinancialYearLabel();
  const nextSeq = await VW_DB.incrementGatePassSequence(fy);
  const gatePassNo = `GP/${fy}/${String(nextSeq).padStart(5, '0')}`;

  const gatePassId = await VW_DB.put(VW_DB.STORES.gatePasses, {
    invoiceId, invoiceNo: inv.invoiceNo,
    gatePassNo, itemIndexes: selectedIdxs,
    confirmed: true,
    confirmedByName: profile ? profile.name : '',
    confirmedAt: new Date().toISOString(),
    vehicleDetails: document.getElementById('gp-vehicle')?.value.trim() || '',
    driverName: document.getElementById('gp-driver')?.value.trim() || '',
    createdAt: new Date().toISOString()
  });

  // Mark each item as belonging to this gate pass
  selectedIdxs.forEach(idx => { inv.items[idx].gatePassId = gatePassId; });
  await VW_DB.put(VW_DB.STORES.invoices, inv);

  showToast(`Gate Pass ${gatePassNo} created`, 'success');
  closeSheet();

  // Create delivery tracking record
  const trackingLink = await VW_DISPATCH.createDeliveryTracking(
    gatePassNo, invoiceId,
    dispatchedItems.map(i => ({ name: i.name, qty: i.qty, unit: i.unit||'pc' })),
    driverName, driverPhone, vehicleDetails,
    inv.customerName || cust?.name || '',
    cust?.phone || ''
  ).catch(() => null);
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const cust = inv.customerId ? customers.find(c => c.id === inv.customerId) : null;
  const vehicleDetails = document.getElementById('gp-vehicle')?.value.trim();
  const driverName = document.getElementById('gp-driver')?.value.trim();
  const driverPhone = document.getElementById('gp-driver-phone')?.value.trim();
  const dispatchedItems = selectedIdxs.map(i => inv.items[i]);
  const itemList = dispatchedItems.map(i => `• ${i.name} (${i.qty} ${i.unit||'pc'})`).join('\n');
  const deliveryLink = `${window.location.origin}/?delivery=${encodeURIComponent(gatePassNo)}`;

  // Customer notification — include tracking link
  if (cust?.phone) {
    const msg = encodeURIComponent(
      `Dear ${cust.name},\n\nYour order from V Wholesale is on the way! 🚚\n\n` +
      `📋 Gate Pass: ${gatePassNo}\n📄 Invoice: ${inv.invoiceNo}\n` +
      (vehicleDetails ? `🚗 Vehicle: ${vehicleDetails}\n` : '') +
      (driverName ? `👤 Driver: ${driverName}\n` : '') +
      (trackingLink ? `\n🔗 Track your delivery live:\n${trackingLink}\n` : '') +
      `\n📦 Items being delivered:\n${itemList}\n\n` +
      `Please keep someone available to receive the delivery.\n\nThank you! 🙏\n— V Wholesale`
    );
    const waBtn = document.createElement('div');
    waBtn.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:#25D366;color:#fff;padding:12px 20px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
    waBtn.textContent = '💬 Send Delivery Alert to Customer';
    waBtn.onclick = () => { window.open(`https://wa.me/91${cust.phone.replace(/\D/g,'')}?text=${msg}`, '_blank'); waBtn.remove(); };
    document.body.appendChild(waBtn);
    setTimeout(() => waBtn.remove(), 8000);
  }

  // Driver notification with delivery confirmation link
  if (driverPhone) {
    const driverMsg = encodeURIComponent(
      `*V Wholesale — Delivery Assignment*\n\n` +
      `Gate Pass: ${gatePassNo}\n` +
      `Customer: ${cust?.name||inv.customerName||'Customer'}\n` +
      `Items: ${dispatchedItems.length}\n\n` +
      `📦 Tap this link at the delivery site to confirm:\n${deliveryLink}\n\n` +
      `Take a photo of delivered items and confirm delivery.`
    );
    setTimeout(() => {
      window.open(`https://wa.me/91${driverPhone.replace(/\D/g,'')}?text=${driverMsg}`, '_blank');
    }, 1000);
  }

  // Open the printable gate pass immediately
  const gp = await VW_DB.getById(VW_DB.STORES.gatePasses, gatePassId);
  printGatePass(gatePassId);
}

// ---------- GATE PASS PRINTING ----------
async function printGatePass(gatePassId) {
  const gp = await VW_DB.getById(VW_DB.STORES.gatePasses, gatePassId);
  if (!gp) return;
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, gp.invoiceId);
  if (!inv) return;
  const customer = inv.customerId ? await VW_DB.getById(VW_DB.STORES.customers, inv.customerId) : null;
  const selectedItems = (gp.itemIndexes||[]).map(idx => inv.items[idx]).filter(Boolean);

  const itemRows = selectedItems.map((item, i) => `
    <tr>
      <td style="text-align:center">${i+1}</td>
      <td>${item.name}</td>
      <td style="text-align:center">${item.qty} ${item.unit||''}</td>
      <td style="text-align:center">₹${(item.price||0).toLocaleString('en-IN')}</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Gate Pass ${gp.gatePassNo}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#111;font-size:13px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
    .brand{font-size:20px;font-weight:700}
    .gp-badge{font-size:22px;font-weight:700;color:#C8972B;text-align:right}
    .gp-no{font-size:13px;color:var(--text3);text-align:right}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f5f5f5;padding:12px;border-radius:6px;margin-bottom:16px;font-size:12.5px;line-height:1.7}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th{background:#f0f0f0;padding:8px;text-align:left;font-size:12px;border:1px solid #999}
    td{padding:7px 8px;font-size:12.5px;border:1px solid #ccc}
    .sign-section{display:flex;justify-content:space-between;margin-top:48px}
    .sign-box{text-align:center;width:180px;border-top:1.5px solid #333;padding-top:6px;font-size:12px}
    .print-btn{display:block;margin:0 0 20px;padding:10px 24px;background:#C8972B;color:#000;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
    @media print{.print-btn{display:none}}
    .status-box{border:2px solid #22c55e;color:#15803d;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;display:inline-block;margin-bottom:12px}
  </style></head><body>
  <button class="print-btn" onclick="window.print()">🖨 Print Gate Pass</button>
  <div class="header">
    <div>
      <div class="brand">Vassure Wholesale Pvt Ltd</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">Vijayawada, Andhra Pradesh</div>
    </div>
    <div>
      <div class="gp-badge">GATE PASS</div>
      <div class="gp-no">${gp.gatePassNo}</div>
    </div>
  </div>
  <div class="status-box">✓ CONFIRMED BY ${(gp.confirmedByName||'').toUpperCase()}</div>
  <div class="meta-grid">
    <div><strong>Invoice Ref:</strong> ${gp.invoiceNo}</div>
    <div><strong>Date:</strong> ${new Date(gp.confirmedAt||gp.createdAt).toLocaleDateString('en-IN')}</div>
    <div><strong>Customer:</strong> ${customer ? customer.name : 'Walk-in'}</div>
    <div><strong>Phone:</strong> ${customer ? customer.phone : '—'}</div>
    <div><strong>Fulfillment:</strong> ${FULFILLMENT_LABELS[inv.fulfillmentMethod]||'—'}</div>
    <div><strong>Vehicle/Transport:</strong> ${gp.vehicleDetails||'—'}</div>
    ${gp.driverName ? `<div><strong>Driver:</strong> ${gp.driverName}</div>` : ''}
    <div><strong>Time Out:</strong> _______________</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="sign-section">
    <div class="sign-box">Packed By<br><br></div>
    <div class="sign-box">Security Checked By<br><br></div>
    <div class="sign-box">Received By (Customer)<br><br></div>
  </div>
  </body></html>`);
  win.document.close();
}

// Extend VW_DISPATCH with the Dispatch workflow functions
window.VW_DISPATCH.renderDispatchQueue = renderDispatchQueue;
window.VW_DISPATCH.openDispatchDetail = openDispatchDetail;
window.VW_DISPATCH.handleItemPhoto = handleItemPhoto;
window.VW_DISPATCH.markItemChecked = markItemChecked;
window.VW_DISPATCH.markItemPending = markItemPending;
window.VW_DISPATCH.saveFulfillmentMethod = saveFulfillmentMethod;
window.VW_DISPATCH.openCreateGatePass = openCreateGatePass;
window.VW_DISPATCH.confirmCreateGatePass = confirmCreateGatePass;
window.VW_DISPATCH.printGatePass = printGatePass;

// =====================================================
// ENHANCED DISPATCH FLOWS
// =====================================================

// FLOW 1: Driver completes delivery at customer site
// Share a link with driver — they open on their phone, confirm items, take photo
async function renderDriverDeliveryPage(gatePassNo) {
  const gps = await VW_DB.all(VW_DB.STORES.gatePasses);
  const gp = gps.find(g => g.gatePassNo === gatePassNo);
  if (!gp) return `<div class="module-header"><h2>Gate Pass not found</h2></div>`;

  // Anon driver link — invoice is RLS-blocked; use the gate-pass-scoped RPC (see get_driver_delivery).
  const inv = await VW_DB.client.rpc('get_driver_delivery', { p_gate_pass_no: gp.gatePassNo }).then(r=>r.data).catch(()=>null);
  const items = (gp.itemIndexes||[]).map(i => inv?.items?.[i]).filter(Boolean);
  const isDelivered = gp.deliveryStatus === 'delivered';

  return `
  <div style="padding:16px;max-width:420px;margin:0 auto">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:14px;font-weight:800;color:var(--text);font-family:'Syne',sans-serif">V Wholesale</div>
      <div style="font-size:11px;color:var(--text3)">Driver Delivery Confirmation</div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div style="font-size:16px;font-weight:700;color:var(--text)">${gp.gatePassNo}</div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">${inv?.customerName||'Customer'} · ${inv?.invoiceNo||''}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">Driver: ${gp.driverName||'—'} · Vehicle: ${gp.vehicleDetails||'—'}</div>
    </div>

    ${isDelivered ? `
    <div class="card" style="border-color:rgba(34,197,94,0.4);background:rgba(34,197,94,0.05)">
      <div style="font-size:16px;font-weight:700;color:var(--green);text-align:center">✅ Delivery Complete</div>
      <div style="font-size:12px;color:var(--text2);text-align:center;margin-top:4px">Delivered at ${gp.deliveredAt ? new Date(gp.deliveredAt).toLocaleString('en-IN') : '—'}</div>
    </div>` : `
    <div class="card" style="margin-bottom:12px">
      <h3 class="card-title">Items to Deliver (${items.length})</h3>
      ${items.map((item, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <input type="checkbox" id="del-item-${i}" style="width:20px;height:20px" onchange="updateDeliveryCount()">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${item.name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">Qty: ${item.qty||1} ${item.unit||'pc'}</div>
        </div>
      </div>`).join('')}
      <div style="font-size:13px;color:var(--text3);padding:8px 0" id="delivery-count-msg">Tick all items delivered</div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <h3 class="card-title">📷 Delivery Photo</h3>
      <div id="del-photo-area" onclick="document.getElementById('del-photo-input').click()" 
        style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer">
        <div style="font-size:32px">📷</div>
        <div style="font-size:13px;color:var(--text3)">Take photo of delivered items at site</div>
      </div>
      <input type="file" id="del-photo-input" accept="image/*" capture="environment" style="display:none" 
        onchange="handleDeliveryPhoto(this)">
    </div>

    <div class="card" style="margin-bottom:12px">
      <h3 class="card-title">Customer Notes (optional)</h3>
      <textarea id="del-notes" placeholder="Any issues, customer comments..." style="height:60px"></textarea>
    </div>

    <button class="btn-primary full-width" style="padding:16px;font-size:15px" 
      onclick="confirmDelivery('${gatePassNo}', ${items.length})">
      ✅ Confirm Delivery Complete
    </button>`}
  </div>`;
}

function updateDeliveryCount() {
  const checked = document.querySelectorAll('[id^="del-item-"]:checked').length;
  const total = document.querySelectorAll('[id^="del-item-"]').length;
  const el = document.getElementById('delivery-count-msg');
  if (el) el.textContent = checked === total ? `✓ All ${total} items confirmed` : `${checked}/${total} items ticked`;
  if (el) el.style.color = checked === total ? 'var(--green)' : 'var(--text3)';
}

let _deliveryPhotoB64 = null;
function handleDeliveryPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _deliveryPhotoB64 = e.target.result.split(',')[1];
    const area = document.getElementById('del-photo-area');
    if (area) area.innerHTML = `<img src="${e.target.result}" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover"><div style="font-size:12px;color:var(--green);margin-top:6px">✓ Photo added</div>`;
  };
  reader.readAsDataURL(file);
}

async function confirmDelivery(gatePassNo, totalItems) {
  const checked = document.querySelectorAll('[id^="del-item-"]:checked').length;
  if (checked < totalItems) {
    showToast(`Please tick all ${totalItems} items before confirming`, 'warn'); return;
  }
  if (!_deliveryPhotoB64) {
    showToast('Please take a photo of the delivered items', 'warn'); return;
  }
  const notes = document.getElementById('del-notes')?.value.trim() || '';
  const gps = await VW_DB.all(VW_DB.STORES.gatePasses);
  const gp = gps.find(g => g.gatePassNo === gatePassNo);
  if (!gp) return;
  await VW_DB.put(VW_DB.STORES.gatePasses, {
    ...gp,
    deliveryStatus: 'delivered',
    deliveredAt: new Date().toISOString(),
    deliveryPhoto: _deliveryPhotoB64,
    deliveryNotes: notes
  });
  // Notify store
  showToast('✅ Delivery confirmed! Notifying store...', 'success');
  // Reload page
  const content = document.getElementById('app-content');
  if (content) content.innerHTML = await renderDriverDeliveryPage(gatePassNo);
}

// SELF-PICKUP — single consolidated photo
async function handleSelfPickup(invoiceId) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">Self Pickup</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">Customer is picking up. Take ONE photo of all items together.</p>
    <div id="pickup-photo-area" onclick="document.getElementById('pickup-photo-input').click()"
      style="border:2px dashed var(--border);border-radius:12px;padding:28px;text-align:center;cursor:pointer;margin-bottom:12px">
      <div style="font-size:40px">📷</div>
      <div style="font-size:14px;color:var(--text)">Take photo of all items</div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">One photo covers all items for self-pickup</div>
    </div>
    <input type="file" id="pickup-photo-input" accept="image/*" capture="environment" style="display:none" onchange="VW_DISPATCH.handlePickupPhoto(this,${invoiceId})">
    <div class="form-group"><label>Vehicle No. (optional)</label>
      <input type="text" id="pickup-vehicle" placeholder="e.g. AP39AB1234">
    </div>
    <div class="form-group"><label>Pickup by (Name)</label>
      <input type="text" id="pickup-person" placeholder="Person collecting the order">
    </div>
    <button class="btn-primary full-width" onclick="VW_DISPATCH.confirmSelfPickup(${invoiceId})">✅ Generate Gate Pass & Complete</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

let _pickupPhotoB64 = null;
async function handlePickupPhoto(input, invoiceId) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _pickupPhotoB64 = e.target.result.split(',')[1];
    const area = document.getElementById('pickup-photo-area');
    if (area) area.innerHTML = `<img src="${e.target.result}" style="width:100%;border-radius:8px;max-height:180px;object-fit:cover"><div style="font-size:12px;color:var(--green);margin-top:6px">✓ Photo taken</div>`;
  };
  reader.readAsDataURL(file);
}

async function confirmSelfPickup(invoiceId) {
  if (!_pickupPhotoB64) { showToast('Take a photo first', 'warn'); return; }
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const profile = VW_AUTH.getCurrentProfile();
  const fy = getFinancialYearLabel();
  const nextSeq = await VW_DB.incrementGatePassSequence(fy);
  const gatePassNo = `GP/${fy}/${String(nextSeq).padStart(5,'0')}`;
  const allIdxs = (inv.items||[]).map((_,i)=>i);
  await VW_DB.put(VW_DB.STORES.gatePasses, {
    invoiceId, invoiceNo: inv.invoiceNo,
    gatePassNo, itemIndexes: allIdxs,
    pickupType: 'self_pickup',
    driverName: document.getElementById('pickup-person')?.value.trim() || 'Self Pickup',
    vehicleDetails: document.getElementById('pickup-vehicle')?.value.trim() || '',
    deliveryPhoto: _pickupPhotoB64,
    deliveryStatus: 'delivered',
    deliveredAt: new Date().toISOString(),
    confirmed: true,
    confirmedByName: profile?.name || '',
    confirmedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
  _pickupPhotoB64 = null;
  closeSheet();
  showToast(`Gate Pass ${gatePassNo} created — Self Pickup complete ✓`, 'success');
  navigateTo('dispatch');
}

// VENDOR OUTSTANDING — shown on accounts dashboard
async function getVendorOutstanding() {
  const pos = await VW_DB.all(VW_DB.STORES.purchaseOrders);
  const pending = pos.filter(p => p.status !== 'received' && p.status !== 'cancelled' && (p.total||0) > 0);
  const totalOutstanding = pending.reduce((s,p) => s + (p.total||0), 0);
  return { pending, totalOutstanding, count: pending.length };
}

window.VW_DISPATCH.renderDriverDeliveryPage = renderDriverDeliveryPage;
window.VW_DISPATCH.confirmDelivery = confirmDelivery;
window.VW_DISPATCH.updateDeliveryCount = updateDeliveryCount;
window.VW_DISPATCH.handlePickupPhoto = handlePickupPhoto;
window.VW_DISPATCH.confirmSelfPickup = confirmSelfPickup;
window.VW_DISPATCH.handleSelfPickup = handleSelfPickup;
window.VW_DISPATCH.getVendorOutstanding = getVendorOutstanding;
window.handleDeliveryPhoto = handleDeliveryPhoto;

// ===== DIRECT DELIVERY FROM OUTSIDE VENDOR =====

function onFulfillmentChange(value, invoiceId) {
  const ddFields = document.getElementById('direct-delivery-fields');
  const spdFields = document.getElementById('staff-pickup-fields');
  if (ddFields) ddFields.style.display = value === 'direct_delivery' ? 'block' : 'none';
  if (spdFields) spdFields.style.display = value === 'staff_pickup_deliver' ? 'block' : 'none';
}

// Direct delivery gate pass — vendor confirms per item at customer site
async function createDirectDeliveryGatePass(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const vendorPhone = inv.directDeliveryPhone;
  const vendorName = inv.directDeliveryVendor || 'Vendor';
  if (!vendorPhone) { showToast('Add vendor WhatsApp number first — tap Save Changes', 'warn'); return; }

  const profile = VW_AUTH.getCurrentProfile();
  const fy = getFinancialYearLabel();
  const nextSeq = await VW_DB.incrementGatePassSequence(fy);
  const gatePassNo = `GP/${fy}/${String(nextSeq).padStart(5,'0')}`;
  const allIdxs = (inv.items||[]).map((_,i)=>i);

  const gatePassId = await VW_DB.put(VW_DB.STORES.gatePasses, {
    invoiceId, invoiceNo: inv.invoiceNo,
    gatePassNo, itemIndexes: allIdxs,
    pickupType: 'direct_delivery',
    driverName: vendorName,
    vehicleDetails: inv.directDeliveryVehicle || '',
    deliveryStatus: 'pending',
    confirmed: true,
    confirmedByName: profile?.name || '',
    confirmedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });

  // Build delivery link
  const deliveryLink = `${window.location.origin}/?delivery=${encodeURIComponent(gatePassNo)}`;
  const itemList = (inv.items||[]).map(i=>`• ${i.name} (${i.qty} ${i.unit||'pc'})`).join('\n');

  // WhatsApp to vendor/supplier
  const vendorMsg = encodeURIComponent(
    `*V Wholesale — Direct Delivery Request*\n\n` +
    `Gate Pass: ${gatePassNo}\n` +
    `Invoice: ${inv.invoiceNo}\n` +
    `Customer: ${inv.customerName||'Customer'}\n\n` +
    `📦 Items to deliver:\n${itemList}\n\n` +
    `📍 Deliver to customer site and tap the link below to confirm each item:\n${deliveryLink}\n\n` +
    `Please take a photo of all items at delivery and confirm.\n— V Wholesale, Vijayawada`
  );
  window.open(`https://wa.me/91${vendorPhone.replace(/\D/g,'')}?text=${vendorMsg}`, '_blank');

  // Also notify customer
  if (inv.customerId || inv.customerPhone) {
    const customers = await VW_DB.all(VW_DB.STORES.customers);
    const cust = inv.customerId ? customers.find(c => c.id === inv.customerId) : null;
    const custPhone = cust?.phone || inv.customerPhone;
    if (custPhone) {
      setTimeout(() => {
        const custMsg = encodeURIComponent(
          `Dear ${inv.customerName||'Customer'}, 🙏\n\n` +
          `Your order (${inv.invoiceNo}) will be delivered directly from our supplier *${vendorName}*.\n\n` +
          `📦 ${(inv.items||[]).length} item${(inv.items||[]).length>1?'s':''} on the way\n` +
          (inv.directDeliveryDate ? `📅 Expected: ${new Date(inv.directDeliveryDate).toLocaleDateString('en-IN')}\n` : '') +
          `\nPlease keep someone available at the delivery site.\n— V Wholesale, Vijayawada 📞 8712697930`
        );
        window.open(`https://wa.me/91${custPhone.replace(/\D/g,'')}?text=${custMsg}`, '_blank');
      }, 1500);
    }
  }

  showToast(`Gate Pass ${gatePassNo} sent to ${vendorName} via WhatsApp ✓`, 'success');
  closeSheet();
}

// Enhanced driver delivery page — item by item confirmation
async function renderDriverDeliveryPageDetailed(gatePassNo) {
  const gps = await VW_DB.all(VW_DB.STORES.gatePasses);
  const gp = gps.find(g => g.gatePassNo === gatePassNo);
  if (!gp) return '<div style="padding:20px;text-align:center">Gate Pass not found</div>';

  // Driver opens this link signed-out (anon), so the invoice is RLS-blocked. Pull the delivery
  // essentials (invoice no, customer name via join, items) through a gate-pass-scoped SECURITY
  // DEFINER RPC instead, without exposing the invoices table to the public.
  const inv = await VW_DB.client.rpc('get_driver_delivery', { p_gate_pass_no: gp.gatePassNo }).then(r=>r.data).catch(()=>null);
  const items = (gp.itemIndexes||[]).map(i => inv?.items?.[i]).filter(Boolean);
  const isDelivered = gp.deliveryStatus === 'delivered';
  const isDirectDelivery = gp.pickupType === 'direct_delivery';

  return `
  <div style="padding:16px;max-width:440px;margin:0 auto;min-height:100vh">
    <div style="text-align:center;padding:16px 0 12px;border-bottom:1px solid var(--border);margin-bottom:16px">
      <div style="font-size:16px;font-weight:800;color:var(--text);font-family:'Syne',sans-serif">V Wholesale</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">${isDirectDelivery ? 'Supplier Delivery Confirmation' : 'Driver Delivery Confirmation'}</div>
    </div>

    <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:15px;font-weight:700;color:var(--text)">${gp.gatePassNo}</div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">${inv?.customerName||'Customer'} · ${inv?.invoiceNo||''}</div>
      ${gp.vehicleDetails?`<div style="font-size:12px;color:var(--text3);margin-top:2px">🚗 ${gp.vehicleDetails}</div>`:''}
    </div>

    ${isDelivered ? `
    <div style="background:rgba(34,197,94,0.1);border:2px solid rgba(34,197,94,0.4);border-radius:16px;padding:24px;text-align:center;margin-bottom:16px">
      <div style="font-size:48px;margin-bottom:8px">✅</div>
      <div style="font-size:18px;font-weight:800;color:var(--green)">Delivery Complete</div>
      <div style="font-size:13px;color:var(--text2);margin-top:6px">Confirmed at ${gp.deliveredAt ? new Date(gp.deliveredAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—'}</div>
    </div>` : `

    <!-- PER-ITEM CHECKLIST -->
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">Tick each item as you deliver it (${items.length} items)</div>
    ${items.map((item, i) => `
    <div id="del-item-card-${i}" onclick="toggleDeliveryItem(${i},${items.length})"
      style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.2s;background:var(--bg2);border:2px solid var(--border)" id="del-item-card-${i}">
      <div id="del-item-check-${i}" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;transition:all 0.2s"></div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:600;color:var(--text)">${item.name||'—'}</div>
        <div style="font-size:12px;color:var(--text3)">Qty: ${item.qty||1} ${item.unit||'pc'}</div>
      </div>
    </div>`).join('')}

    <div id="del-count-msg" style="text-align:center;font-size:13px;color:var(--text3);padding:12px 0">Tap each item above after delivering it</div>

    <!-- PHOTO -->
    <div style="background:var(--bg2);border-radius:12px;padding:14px;margin:14px 0">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">📷 Take photo of delivered items</div>
      <div id="del-photo-preview" onclick="document.getElementById('del-photo-inp').click()"
        style="border:2px dashed var(--border);border-radius:10px;padding:24px;text-align:center;cursor:pointer">
        <div style="font-size:36px">📷</div>
        <div style="font-size:13px;color:var(--text3);margin-top:4px">Tap to take photo</div>
      </div>
      <input type="file" id="del-photo-inp" accept="image/*" capture="environment" style="display:none" onchange="handleDeliveryPhoto(this)">
    </div>

    <textarea id="del-notes-inp" placeholder="Any notes (issues, partial delivery, customer comments)..." style="width:100%;height:70px;border-radius:10px;padding:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);font-size:13px;font-family:inherit;box-sizing:border-box;margin-bottom:14px"></textarea>

    <button id="del-confirm-btn" onclick="confirmDelivery('${gatePassNo}', ${items.length})"
      style="width:100%;padding:18px;border-radius:14px;background:var(--bg3);border:none;font-size:16px;font-weight:700;color:var(--text3);cursor:not-allowed" disabled>
      Tick all items + take photo to confirm
    </button>`}
  </div>

  <scr` + `ipt>
  var _delChecked = new Set();
  var _delPhoto = null;
  window.toggleDeliveryItem = function(i, total) {
    const card = document.getElementById('del-item-card-' + i);
    const check = document.getElementById('del-item-check-' + i);
    if (!card || !check) return;
    if (_delChecked.has(i)) {
      _delChecked.delete(i);
      card.style.background = 'var(--bg2)';
      card.style.borderColor = 'var(--border)';
      check.style.background = 'transparent';
      check.style.borderColor = 'var(--border)';
      check.textContent = '';
    } else {
      _delChecked.add(i);
      card.style.background = 'rgba(34,197,94,0.08)';
      card.style.borderColor = 'rgba(34,197,94,0.4)';
      check.style.background = 'var(--green)';
      check.style.borderColor = 'var(--green)';
      check.textContent = '✓';
      check.style.color = '#fff';
    }
    var msg = document.getElementById('del-count-msg');
    var btn = document.getElementById('del-confirm-btn');
    if (msg) msg.textContent = _delChecked.size + '/' + total + ' items confirmed';
    if (btn) {
      var ready = _delChecked.size === total && _delPhoto;
      btn.disabled = !ready;
      btn.style.background = ready ? 'var(--green)' : 'var(--bg3)';
      btn.style.color = ready ? '#fff' : 'var(--text3)';
      btn.style.cursor = ready ? 'pointer' : 'not-allowed';
      btn.textContent = ready ? '✅ Confirm All Delivered' : (_delChecked.size + '/' + total + ' ticked' + (_delPhoto ? ' · Photo ✓' : ' · Photo needed'));
    }
  };
  window.handleDeliveryPhoto = function(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      _delPhoto = e.target.result.split(',')[1];
      var preview = document.getElementById('del-photo-preview');
      if (preview) preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;border-radius:8px;max-height:180px;object-fit:cover"><div style="font-size:12px;color:var(--green);margin-top:6px;text-align:center">✓ Photo taken</div>';
      // Re-check button state
      var total = ${items.length};
      var btn = document.getElementById('del-confirm-btn');
      if (btn) {
        var ready = _delChecked.size === total;
        btn.disabled = !ready;
        btn.style.background = ready ? 'var(--green)' : 'var(--bg3)';
        btn.style.color = ready ? '#fff' : 'var(--text3)';
        btn.style.cursor = ready ? 'pointer' : 'not-allowed';
        btn.textContent = ready ? '✅ Confirm All Delivered' : (_delChecked.size + '/' + total + ' ticked · Photo ✓');
      }
    };
    reader.readAsDataURL(file);
  };
  <\/script>`;
}

window.VW_DISPATCH.onFulfillmentChange = onFulfillmentChange;
window.VW_DISPATCH.createDirectDeliveryGatePass = createDirectDeliveryGatePass;
window.VW_DISPATCH.renderDriverDeliveryPageDetailed = renderDriverDeliveryPageDetailed;

// ===== STAFF PICKS FROM VENDOR, DELIVERS TO CUSTOMER SITE =====
async function createStaffPickupGatePass(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;

  const staffName = inv.staffPickupName;
  const staffPhone = inv.staffPickupPhone;
  const vendorName = inv.staffPickupVendor;
  const vendorPhone = inv.staffPickupVendorPhone;

  if (!staffName) { showToast('Enter staff member name first — tap Save Changes', 'warn'); return; }

  const profile = VW_AUTH.getCurrentProfile();
  const fy = getFinancialYearLabel();
  const nextSeq = await VW_DB.incrementGatePassSequence(fy);
  const gatePassNo = `GP/${fy}/${String(nextSeq).padStart(5,'0')}`;
  const allIdxs = (inv.items||[]).map((_,i)=>i);
  const itemList = (inv.items||[]).map(i=>`• ${i.name} (${i.qty} ${i.unit||'pc'})`).join('\n');
  const deliveryLink = `${window.location.origin}/?delivery=${encodeURIComponent(gatePassNo)}`;

  // Save gate pass
  await VW_DB.put(VW_DB.STORES.gatePasses, {
    invoiceId, invoiceNo: inv.invoiceNo,
    gatePassNo, itemIndexes: allIdxs,
    pickupType: 'staff_pickup_deliver',
    driverName: staffName,
    vehicleDetails: inv.staffPickupVehicle || '',
    deliveryStatus: 'pending',
    confirmed: true,
    confirmedByName: profile?.name || '',
    confirmedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });

  // Step 1: WhatsApp to vendor to keep material ready
  if (vendorPhone) {
    const vendorMsg = encodeURIComponent(
      `*V Wholesale — Material Pickup Request*\n\n` +
      `Our staff *${staffName}* will be coming to pick up the following material:\n\n` +
      `${itemList}\n\n` +
      `For Invoice: ${inv.invoiceNo}\n` +
      `Customer: ${inv.customerName||'Customer'}\n\n` +
      `Please keep the material ready.\n— V Wholesale, Vijayawada 📞 8712697930`
    );
    window.open(`https://wa.me/91${vendorPhone.replace(/\D/g,'')}?text=${vendorMsg}`, '_blank');
  }

  // Step 2: WhatsApp to staff with pickup + delivery instructions
  if (staffPhone) {
    setTimeout(() => {
      const staffMsg = encodeURIComponent(
        `*V Wholesale — Pickup & Delivery Task*\n\n` +
        `Gate Pass: ${gatePassNo}\n\n` +
        `📍 *STEP 1 — Pick up from:*\n${vendorName||'Vendor'}\n${vendorPhone?'📞 '+vendorPhone:''}\n\n` +
        `📦 *Items to collect:*\n${itemList}\n\n` +
        `🏠 *STEP 2 — Deliver to:*\n${inv.customerName||'Customer'}\n\n` +
        `✅ *After delivery, tap this link to confirm:*\n${deliveryLink}\n\n` +
        `Take a photo of all items at the delivery site before confirming.`
      );
      window.open(`https://wa.me/91${staffPhone.replace(/\D/g,'')}?text=${staffMsg}`, '_blank');
    }, 1500);
  }

  // Step 3: Notify customer their order is coming
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const cust = inv.customerId ? customers.find(c => c.id === inv.customerId) : null;
  const custPhone = cust?.phone || inv.customerPhone;
  if (custPhone) {
    setTimeout(() => {
      const custMsg = encodeURIComponent(
        `Dear ${inv.customerName||'Customer'}, 🙏\n\n` +
        `Your order (${inv.invoiceNo}) is being arranged.\n\n` +
        `Our team member *${staffName}* will collect and deliver your material today.\n\n` +
        `We'll notify you once it's on the way.\n— V Wholesale, Vijayawada 📞 8712697930`
      );
      window.open(`https://wa.me/91${custPhone.replace(/\D/g,'')}?text=${custMsg}`, '_blank');
    }, 3000);
  }

  showToast(`Gate Pass ${gatePassNo} created — ${staffName} notified via WhatsApp ✓`, 'success');
  closeSheet();
}

window.VW_DISPATCH.createStaffPickupGatePass = createStaffPickupGatePass;

// =====================================================
// DELIVERY TRACKING MODULE
// Customer-facing live tracking page
// URL: ?track=TOKEN
// =====================================================

async function renderDeliveryTrackingPage(token) {
  const { data: tracking } = await VW_DB.client
    .from('delivery_tracking')
    .select('*')
    .eq('tracking_token', token)
    .single();

  if (!tracking) {
    return `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
      <div style="text-align:center">
        <div style="font-size:48px;margin-bottom:16px">🔍</div>
        <h2 style="color:var(--text)">Tracking Not Found</h2>
        <p style="color:var(--text3);font-size:14px">This tracking link may have expired or is incorrect.<br>Please contact V Wholesale.</p>
        <div style="margin-top:16px;font-size:13px;color:var(--text3)">📞 8712697930 · V Wholesale, Vijayawada</div>
      </div>
    </div>`;
  }

  const statusSteps = [
    { key: 'dispatched', label: 'Order Dispatched', icon: '📦', desc: 'Your order has left V Wholesale store' },
    { key: 'in_transit', label: 'In Transit', icon: '🚚', desc: `${tracking.driver_name||'Driver'} is on the way${tracking.vehicle_no?' in '+tracking.vehicle_no:''}` },
    { key: 'delivered', label: 'Delivered', icon: '✅', desc: 'Your order has been delivered successfully' },
  ];
  const currentIdx = statusSteps.findIndex(s => s.key === tracking.status);

  return `
  <div style="min-height:100vh;background:var(--bg);padding:16px;max-width:440px;margin:0 auto">
    <!-- HEADER -->
    <div style="text-align:center;padding:16px 0 20px;border-bottom:1px solid var(--border);margin-bottom:20px">
      <div style="font-size:16px;font-weight:800;color:var(--text);font-family:'Syne',sans-serif">V Wholesale</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">Live Delivery Tracking</div>
    </div>

    <!-- GATE PASS / ORDER INFO -->
    <div style="background:var(--bg2);border-radius:14px;padding:16px;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700;color:var(--text)">${tracking.gate_pass_no||tracking.invoice_no}</div>
      <div style="font-size:13px;color:var(--text2);margin-top:4px">For: ${tracking.customer_name||'Customer'}</div>
      ${tracking.estimated_delivery ? `<div style="font-size:12px;color:var(--gold);margin-top:4px">Expected: ${new Date(tracking.estimated_delivery).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</div>` : ''}
    </div>

    <!-- STATUS TRACKER -->
    <div style="margin-bottom:20px">
      ${statusSteps.map((step, i) => {
        const done = i <= currentIdx;
        const current = i === currentIdx;
        return `
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:${i<statusSteps.length-1?'0':'0'}">
          <div style="display:flex;flex-direction:column;align-items:center">
            <div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid ${done?'var(--green)':'var(--border)'};background:${done?'rgba(34,197,94,0.1)':'var(--bg2)'};${current?'animation:pulse 2s infinite':''}">${step.icon}</div>
            ${i<statusSteps.length-1?`<div style="width:3px;height:40px;background:${done&&i<currentIdx?'var(--green)':'var(--border)'};margin:4px 0"></div>`:''}
          </div>
          <div style="padding-top:8px;flex:1">
            <div style="font-size:14px;font-weight:${current?'700':'500'};color:${done?'var(--text)':'var(--text3)'}">${step.label}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">${done?step.desc:''}</div>
            ${current && tracking.status==='delivered' && tracking.delivered_at ? `<div style="font-size:12px;color:var(--green);margin-top:2px">✓ ${new Date(tracking.delivered_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- ITEMS LIST -->
    ${(tracking.items||[]).length ? `
    <div style="background:var(--bg2);border-radius:14px;padding:14px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Your Order</div>
      ${(tracking.items||[]).map(item => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;color:var(--text)">${item.name||'—'}</span>
        <span style="font-size:13px;color:var(--text2)">${item.qty||1} ${item.unit||'pc'}</span>
      </div>`).join('')}
    </div>` : ''}

    <!-- DELIVERY PHOTO (if delivered) -->
    ${tracking.delivery_photo ? `
    <div style="background:var(--bg2);border-radius:14px;padding:14px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Delivery Photo</div>
      <img src="data:image/jpeg;base64,${tracking.delivery_photo}" style="width:100%;border-radius:10px">
    </div>` : ''}

    <!-- CONTACT -->
    <div style="text-align:center;padding:16px;font-size:13px;color:var(--text3)">
      Questions? Call us: <a href="tel:8712697930" style="color:var(--gold);font-weight:600">8712697930</a><br>
      <span style="font-size:11px">V Wholesale · Visit V Wholesale</span>
    </div>
  </div>`;
}

// Create tracking record when gate pass is generated
async function createDeliveryTracking(gatePassNo, invoiceId, items, driverName, driverPhone, vehicleNo, customerName, customerPhone) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await VW_DB.client.from('delivery_tracking').insert({
    gate_pass_no: gatePassNo,
    invoice_id: invoiceId,
    driver_name: driverName || '',
    driver_phone: driverPhone || '',
    vehicle_no: vehicleNo || '',
    customer_name: customerName || '',
    customer_phone: customerPhone || '',
    items: items || [],
    status: 'dispatched',
    dispatched_at: new Date().toISOString(),
    tracking_token: token
  });
  return `${window.location.origin}/?track=${token}`;
}

window.VW_DISPATCH.renderDeliveryTrackingPage = renderDeliveryTrackingPage;
window.VW_DISPATCH.createDeliveryTracking = createDeliveryTracking;




/* === grn.js === */

// =====================================================
// GRN — GOODS RECEIPT NOTE
// Scan supplier invoice → AI extracts items →
// Match against PO → approve/reject
// =====================================================

async function renderGRNPage() {
  const { data: grns } = await VW_DB.client
    .from('grn_receipts').select('*')
    .order('created_at', { ascending: false }).limit(50);
  const list = grns || [];
  const pending = list.filter(g => g.status === 'pending');

  return `
  <div class="module-header">
    <h2>📦 Goods Receipt (GRN)</h2>
    <button class="btn-sm" onclick="VW_GRN.newGRN()">+ New GRN</button>
  </div>

  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card ${pending.length?'danger':''}">
      <div class="mc-label">Pending Approval</div>
      <div class="mc-value">${pending.length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Total GRNs</div>
      <div class="mc-value">${list.length}</div>
    </div>
    <div class="metric-card gold">
      <div class="mc-label">Total Value</div>
      <div class="mc-value">₹${Math.round(list.reduce((s,g)=>s+(g.total_value||0),0)/1000)}K</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Approved</div>
      <div class="mc-value">${list.filter(g=>g.status==='approved').length}</div>
    </div>
  </div>

  ${pending.length ? `
  <div class="card" style="margin-bottom:10px;border-color:rgba(239,68,68,0.3)">
    <h3 class="card-title" style="color:var(--red)">⚠️ Pending GRNs</h3>
    ${pending.map(g => renderGRNRow(g)).join('')}
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">All GRNs</h3>
    ${list.length ? list.map(g => renderGRNRow(g)).join('') : '<p class="empty-msg">No GRNs yet — scan a supplier invoice to create one</p>'}
  </div>`;
}

function renderGRNRow(g) {
  const statusColor = { pending:'var(--gold)', approved:'var(--green)', rejected:'var(--red)' };
  return `
  <div onclick="VW_GRN.openGRN(${g.id})" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:13px;font-weight:600">${g.vendor_name||'Unknown Vendor'} · ${g.invoice_no||'No Invoice No.'}</div>
        <div style="font-size:11px;color:var(--text3)">${g.po_no?'PO: '+g.po_no+' · ':''} ${(g.items||[]).length} items · ${new Date(g.created_at).toLocaleDateString('en-IN')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:700">₹${Math.round(g.total_value||0).toLocaleString('en-IN')}</div>
        <span style="font-size:11px;color:${statusColor[g.status]||'var(--text3)'}">● ${g.status}</span>
      </div>
    </div>
  </div>`;
}

async function newGRN() {
  const pos = await VW_DB.all(VW_DB.STORES.purchaseOrders);
  const openPOs = pos.filter(p => p.status !== 'received' && p.status !== 'cancelled');
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">📦 New GRN</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">Photograph the supplier's invoice and AI will extract all items automatically.</p>

    ${openPOs.length ? `
    <div class="form-group"><label>Link to Purchase Order (optional)</label>
      <select id="grn-po-select">
        <option value="">No PO — direct purchase</option>
        ${openPOs.map(p=>`<option value="${p.id}" data-items='${JSON.stringify(p.items||[])}'>${p.poNo||'PO-'+p.id} · ${p.vendorName||'Vendor'} · ₹${Math.round(p.total||0).toLocaleString('en-IN')}</option>`).join('')}
      </select>
    </div>` : ''}

    <div id="grn-photo-area" onclick="document.getElementById('grn-photo-input').click()"
      style="border:2px dashed var(--border);border-radius:14px;padding:32px;text-align:center;cursor:pointer;margin-bottom:12px">
      <div style="font-size:48px;margin-bottom:8px">📄</div>
      <div style="font-size:15px;font-weight:600;color:var(--text)">Photograph supplier invoice</div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">AI will extract all items, quantities and amounts</div>
    </div>
    <input type="file" id="grn-photo-input" accept="image/*" capture="environment" style="display:none" onchange="VW_GRN.processGRNPhoto(this)">

    <div class="form-group"><label>Or enter manually — Vendor Name</label>
      <input type="text" id="grn-vendor-name" placeholder="e.g. Ravi Tiles Depot">
    </div>
    <button class="btn-secondary full-width" onclick="VW_GRN.openManualGRN()">Enter Items Manually Instead</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function processGRNPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;

  // Show loading state
  const area = document.getElementById('grn-photo-area');
  if (area) area.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
      <div class="spinner"></div>
      <div style="font-size:14px;font-weight:600">AI reading invoice...</div>
      <div style="font-size:12px;color:var(--text3)">Extracting items, quantities and amounts</div>
    </div>`;

  // Compress image
  const b64 = await new Promise((res) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1200;
        const ratio = Math.min(maxSize/img.width, maxSize/img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        res(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Get PO items for matching
  const poSelect = document.getElementById('grn-po-select');
  const poItemsRaw = poSelect?.options[poSelect.selectedIndex]?.dataset?.items;
  const poItems = poItemsRaw ? JSON.parse(poItemsRaw) : [];

  try {
    const SUPABASE_URL = VW_DB.client.supabaseUrl;
    const SUPABASE_KEY = VW_DB.client.supabaseKey;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/grn-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ imageBase64: b64, poItems })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    // Store parsed data and show review
    window._grnOCRData = { ...data, photoB64: b64 };
    showGRNReview(data, b64);
    _logApiUsage('grn_scan', { success:true, meta:{ items:data.items?.length||0 } });
  } catch(e) {
    _logApiUsage('grn_scan', { success:false });
    if (area) area.innerHTML = `
      <div style="text-align:center">
        <div style="font-size:32px">❌</div>
        <div style="font-size:13px;color:var(--red);margin-top:8px">${e.message}</div>
        <button class="btn-secondary" style="margin-top:10px" onclick="document.getElementById('grn-photo-input').click()">Try Again</button>
      </div>`;
  }
}

function showGRNReview(data, photoB64) {
  const sheet = document.getElementById('bottom-sheet');
  const items = data.items || [];

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">✅ Invoice Read — Review Items</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>

    <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        ${data.vendorName?`<div><span style="font-size:11px;color:var(--text3)">Vendor</span><div style="font-size:13px;font-weight:600">${data.vendorName}</div></div>`:''}
        ${data.invoiceNo?`<div><span style="font-size:11px;color:var(--text3)">Invoice No.</span><div style="font-size:13px;font-weight:600">${data.invoiceNo}</div></div>`:''}
        ${data.invoiceDate?`<div><span style="font-size:11px;color:var(--text3)">Date</span><div style="font-size:13px;font-weight:600">${data.invoiceDate}</div></div>`:''}
        ${data.grandTotal?`<div><span style="font-size:11px;color:var(--text3)">Total</span><div style="font-size:14px;font-weight:700;color:var(--gold)">₹${Math.round(data.grandTotal).toLocaleString('en-IN')}</div></div>`:''}
      </div>
    </div>

    <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">${items.length} items extracted — edit if needed</div>

    <div id="grn-items-review">
      ${items.map((item, i) => `
      <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px">
        <input type="text" value="${(item.name||'').replace(/"/g,'&quot;')}" style="width:100%;font-size:13px;font-weight:600;background:transparent;border:none;color:var(--text);padding:0;margin-bottom:6px" id="grn-item-name-${i}">
        <div style="display:flex;gap:8px">
          <div style="flex:1">
            <label style="font-size:10px;color:var(--text3)">QTY</label>
            <input type="number" value="${item.qty||1}" style="width:100%;font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text)" id="grn-item-qty-${i}">
          </div>
          <div style="flex:1">
            <label style="font-size:10px;color:var(--text3)">UNIT</label>
            <input type="text" value="${item.unit||'pc'}" style="width:100%;font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text)" id="grn-item-unit-${i}">
          </div>
          <div style="flex:1">
            <label style="font-size:10px;color:var(--text3)">RATE ₹</label>
            <input type="number" value="${item.rate||0}" style="width:100%;font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text)" id="grn-item-rate-${i}">
          </div>
        </div>
      </div>`).join('')}
    </div>

    <div style="font-size:12px;color:var(--text3);margin-bottom:14px">Review the items above. Edit any mistakes before saving.</div>
    <button class="btn-primary full-width" onclick="VW_GRN.saveGRN(${items.length}, '${(data.vendorName||'').replace(/'/g,"\\'")}', '${data.invoiceNo||''}', '${data.invoiceDate||''}', ${Math.round(data.grandTotal||0)})">
      💾 Save GRN — Submit for Approval
    </button>`;
}

async function saveGRN(itemCount, vendorName, invoiceNo, invoiceDate, grandTotal) {
  const poSelect = document.getElementById('grn-po-select');
  const poId = poSelect?.value ? parseInt(poSelect.value) : null;
  const poText = poSelect?.options[poSelect?.selectedIndex]?.text || '';
  const poNo = poText.split(' · ')[0] || '';

  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const name = document.getElementById(`grn-item-name-${i}`)?.value.trim();
    const qty = parseFloat(document.getElementById(`grn-item-qty-${i}`)?.value || 1);
    const unit = document.getElementById(`grn-item-unit-${i}`)?.value.trim() || 'pc';
    const rate = parseFloat(document.getElementById(`grn-item-rate-${i}`)?.value || 0);
    if (name) items.push({ name, qty, unit, rate, amount: qty * rate });
  }

  const { error } = await VW_DB.client.from('grn_receipts').insert({
    po_id: poId,
    po_no: poNo,
    vendor_name: vendorName || document.getElementById('grn-vendor-name')?.value.trim() || 'Unknown',
    invoice_no: invoiceNo,
    invoice_date: invoiceDate || null,
    items,
    total_value: grandTotal || items.reduce((s,i)=>s+i.amount,0),
    status: 'pending',
    created_by_name: VW_AUTH.getCurrentProfile()?.name || ''
  });

  if (error) { showToast('Error saving GRN: ' + error.message, 'error'); return; }
  closeSheet();
  showToast(`GRN saved — ${items.length} items pending approval ✓`, 'success');
  navigateTo('grn');
}

async function openGRN(id) {
  const { data: g } = await VW_DB.client.from('grn_receipts').select('*').eq('id', id).single();
  if (!g) return;
  const isAdmin = VW_AUTH.isAdmin();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">GRN #${g.id}</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">
      ${g.vendor_name} · ${g.invoice_no||'No Inv No'} · ₹${Math.round(g.total_value||0).toLocaleString('en-IN')}
    </div>
    <div style="margin-bottom:12px">
      ${(g.items||[]).map(item => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:13px">${item.name}</div>
          <div style="font-size:11px;color:var(--text3)">${item.qty} ${item.unit} × ₹${item.rate||0}</div>
        </div>
        <div style="font-size:13px;font-weight:600">₹${Math.round(item.amount||0).toLocaleString('en-IN')}</div>
      </div>`).join('')}
    </div>
    ${isAdmin && g.status === 'pending' ? `
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-primary" style="flex:1;background:var(--green)" onclick="VW_GRN.approveGRN(${g.id})">✓ Approve & Update Stock</button>
      <button class="btn-secondary" style="flex:1;color:var(--red)" onclick="VW_GRN.rejectGRN(${g.id})">✗ Reject</button>
    </div>` : `<div style="font-size:13px;color:var(--text3);text-align:center">${g.status.toUpperCase()} ${g.approved_by?'by '+g.approved_by:''}</div>`}`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function approveGRN(id) {
  const { data: g } = await VW_DB.client.from('grn_receipts').select('*').eq('id', id).single();
  if (!g) return;

  // Update stock for each item
  const products = await VW_DB.all(VW_DB.STORES.products);
  for (const item of (g.items||[])) {
    const match = products.find(p =>
      p.name?.toLowerCase().includes(item.name?.toLowerCase().slice(0,10)) ||
      item.name?.toLowerCase().includes(p.name?.toLowerCase().slice(0,10))
    );
    if (match) {
      const before = parseFloat(match.stock)||0;
      const addQty = parseFloat(item.qty)||0;
      await VW_DB.put(VW_DB.STORES.products, {
        ...match,
        stock: before + addQty,
        lastGrn: new Date().toISOString()
      });
      // Keep per-location rows in sync and log a user-attributed movement.
      if (match.warehouseZone && addQty > 0) {
        try { await VW_STOCK.addToLocation(match.id, match.warehouseZone, match.rackNo||'', match.shelfNo||'', addQty); } catch(_) {}
      }
      try {
        await recordStockMovement({
          productId: match.id, productName: match.name, delta: addQty, kind: 'restock',
          reason: `GRN — ${g.po_no||g.vendor_name||''}`, ref: g.invoice_no||'',
          stockBefore: before, stockAfter: before + addQty
        });
      } catch(_) {}
    }
  }

  await VW_DB.client.from('grn_receipts').update({
    status: 'approved',
    approved_by: VW_AUTH.getCurrentProfile()?.name || '',
    approved_at: new Date().toISOString()
  }).eq('id', id);

  closeSheet();
  showToast(`GRN approved — stock updated for ${(g.items||[]).length} items ✓`, 'success');
  navigateTo('grn');
}

async function rejectGRN(id) {
  await VW_DB.client.from('grn_receipts').update({ status: 'rejected', approved_by: VW_AUTH.getCurrentProfile()?.name || '', approved_at: new Date().toISOString() }).eq('id', id);
  closeSheet();
  showToast('GRN rejected', 'warn');
  navigateTo('grn');
}

function _manualGRNRow(i) {
  return `
  <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px" id="grn-row-${i}">
    <input type="text" placeholder="Item name" style="width:100%;font-size:13px;font-weight:600;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--text);margin-bottom:6px" id="grn-item-name-${i}">
    <div style="display:flex;gap:8px;align-items:flex-end">
      <div style="flex:1"><label style="font-size:10px;color:var(--text3)">QTY</label>
        <input type="number" value="1" min="0" style="width:100%;font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text)" id="grn-item-qty-${i}"></div>
      <div style="flex:1"><label style="font-size:10px;color:var(--text3)">UNIT</label>
        <input type="text" value="pc" style="width:100%;font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text)" id="grn-item-unit-${i}"></div>
      <div style="flex:1"><label style="font-size:10px;color:var(--text3)">RATE ₹</label>
        <input type="number" value="0" min="0" style="width:100%;font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text)" id="grn-item-rate-${i}"></div>
      <button onclick="document.getElementById('grn-row-${i}').remove()" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:0 4px">✕</button>
    </div>
  </div>`;
}

async function openManualGRN() {
  const openPOs = (await VW_DB.all(VW_DB.STORES.purchaseOrders)).filter(p => p.status !== 'received' && p.status !== 'cancelled');
  window._grnManualCount = 3;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">📦 Manual GRN Entry</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">Type the received items directly. Submitted for approval just like a scanned GRN.</p>
    ${openPOs.length ? `
    <div class="form-group"><label>Link to Purchase Order (optional)</label>
      <select id="grn-po-select">
        <option value="">No PO — direct purchase</option>
        ${openPOs.map(p=>`<option value="${p.id}">${p.poNo||'PO-'+p.id} · ${p.vendorName||'Vendor'} · ₹${Math.round(p.total||0).toLocaleString('en-IN')}</option>`).join('')}
      </select>
    </div>` : ''}
    <div class="form-group"><label>Vendor Name *</label><input type="text" id="grn-vendor-name" placeholder="e.g. Ravi Tiles Depot"></div>
    <div style="display:flex;gap:8px">
      <div class="form-group" style="flex:1"><label>Invoice No.</label><input type="text" id="grn-invoice-no" placeholder="e.g. INV-1234"></div>
      <div class="form-group" style="flex:1"><label>Invoice Date</label><input type="date" id="grn-invoice-date"></div>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;margin:6px 0 8px">Items received</div>
    <div id="grn-items-review">
      ${[0,1,2].map(i => _manualGRNRow(i)).join('')}
    </div>
    <button class="btn-secondary full-width" style="margin-bottom:12px" onclick="VW_GRN.addManualGRNRow()">+ Add Item Row</button>
    <button class="btn-primary full-width" onclick="VW_GRN.saveGRN(window._grnManualCount, '', document.getElementById('grn-invoice-no').value.trim(), document.getElementById('grn-invoice-date').value, 0)">
      💾 Save GRN — Submit for Approval
    </button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function addManualGRNRow() {
  const container = document.getElementById('grn-items-review');
  if (!container) return;
  const i = window._grnManualCount || 0;
  container.insertAdjacentHTML('beforeend', _manualGRNRow(i));
  window._grnManualCount = i + 1;
}

window.VW_GRN = {
  renderGRNPage, newGRN, processGRNPhoto, showGRNReview,
  saveGRN, openGRN, approveGRN, rejectGRN, openManualGRN, addManualGRNRow
};




/* === vendor.js === */

// ============================================================
// VENDOR / SUPPLIER MODULE
// Vendor onboarding, Purchase Orders, PO receipt → stock update
// ============================================================

// ===== VENDOR LIST =====
async function renderVendorsPage() {
  const vendors = await VW_DB.all(VW_DB.STORES.vendors);
  const pos = await VW_DB.all(VW_DB.STORES.purchaseOrders);
  const isAdmin = VW_AUTH.isAdmin();
  const sorted = [...vendors].sort((a,b) => (a.name||'').localeCompare(b.name||''));

  return `
  <div class="module-header">
    <h2>Vendors & Suppliers</h2>
    ${isAdmin ? `<button class="btn-sm" onclick="VW_VENDOR.showAddVendor()">+ Add Vendor</button>` : ''}
  </div>
  <div class="entry-type-grid" style="margin-bottom:12px">
    <button class="entry-type-btn active" id="vtab-list" onclick="VW_VENDOR.switchVendorTab('list',this)"><span class="et-icon">🏭</span>Vendors</button>
    <button class="entry-type-btn" id="vtab-po" onclick="VW_VENDOR.switchVendorTab('po',this)"><span class="et-icon">📋</span>Purchase Orders</button>
    <button class="entry-type-btn" id="vtab-rfq" onclick="VW_VENDOR.switchVendorTab('rfq',this)"><span class="et-icon">📨</span>RFQ</button>
  </div>
  <div id="vendor-tab-content">
    ${renderVendorList(sorted, pos)}
  </div>`;
}

function renderVendorList(vendors, pos) {
  if (!vendors.length) return `
    <div class="card">
      <p class="empty-msg">No vendors added yet</p>
      ${VW_AUTH.isAdmin() ? `<button class="btn-primary full-width" onclick="VW_VENDOR.showAddVendor()">+ Add First Vendor</button>` : ''}
    </div>`;

  return vendors.map(v => {
    const vendorPOs = pos.filter(p => p.vendorId === v.id);
    const openPOs = vendorPOs.filter(p => p.status === 'sent' || p.status === 'pending');
    const avgRating = v.ratings?.length
      ? (v.ratings.reduce((s,r) => s+r, 0) / v.ratings.length).toFixed(1)
      : null;
    return `
    <div class="task-card" onclick="VW_VENDOR.openVendor(${v.id})">
      <div class="task-card-header">
        <span class="task-dept">${v.name}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${avgRating ? `<span style="font-size:12px;color:var(--gold)">★ ${avgRating}</span>` : ''}
          ${openPOs.length ? `<span class="badge" style="background:#378ADD">${openPOs.length} open PO${openPOs.length>1?'s':''}</span>` : ''}
        </div>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-top:3px">
        ${v.categories?.join(', ')||'General'} · ${v.phone||'No phone'}
      </div>
      ${v.paymentTerms ? `<div style="font-size:11px;color:var(--text3)">Terms: ${v.paymentTerms}</div>` : ''}
    </div>`;
  }).join('');
}

async function switchVendorTab(tab, btn) {
  document.querySelectorAll('.entry-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('vendor-tab-content');
  if (!container) return;
  if (tab === 'list') {
    const [vendors, pos] = await Promise.all([VW_DB.all(VW_DB.STORES.vendors), VW_DB.all(VW_DB.STORES.purchaseOrders)]);
    container.innerHTML = renderVendorList([...vendors].sort((a,b)=>(a.name||'').localeCompare(b.name||'')), pos);
  } else if (tab === 'rfq') {
    container.innerHTML = await renderRFQTab();
  } else {
    const [pos, vendors] = await Promise.all([VW_DB.all(VW_DB.STORES.purchaseOrders), VW_DB.all(VW_DB.STORES.vendors)]);
    const vendorMap = {}; vendors.forEach(v => vendorMap[v.id] = v);
    container.innerHTML = renderPOList([...pos].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)), vendorMap);
  }
}

// ===== ADD / EDIT VENDOR =====
async function showAddVendor(vendorId) {
  const v = vendorId ? await VW_DB.getById(VW_DB.STORES.vendors, vendorId) : null;
  const categories = ['Tiles','Sanitary','Plywood','Electricals','Paints','Plumbing','Appliances','Hardware','Steel','Cement','Glass','Waterproofing','General'];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${v ? 'Edit Vendor' : 'Add Vendor'}</h3>
    <div class="form-group"><label>Business Name *</label><input type="text" id="vnd-name" value="${v?.name||''}"></div>
    <div class="form-group"><label>Contact Person</label><input type="text" id="vnd-contact" value="${v?.contactPerson||''}"></div>
    <div class="form-group"><label>Phone *</label><input type="tel" id="vnd-phone" value="${v?.phone||''}" maxlength="10"></div>
    <div class="form-group"><label>WhatsApp Number (if different)</label><input type="tel" id="vnd-wa" value="${v?.whatsapp||''}" maxlength="10" placeholder="Blank = same as phone"></div>
    <div class="form-group"><label>Categories Supplied</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
        ${categories.map(cat => `
          <label style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:var(--bg2);border-radius:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" name="vnd-cat" value="${cat}" ${(v?.categories||[]).includes(cat)?'checked':''}> ${cat}
          </label>`).join('')}
      </div>
    </div>
    <div class="form-group"><label>GST Number</label><input type="text" id="vnd-gst" value="${v?.gstNo||''}" placeholder="e.g. 37AABCV1234Z1Z5" style="text-transform:uppercase"></div>
    <div class="form-group"><label>Brands Supplied <span style="color:var(--text3);font-weight:400">(comma-separated — used to route POs)</span></label>
      <input type="text" id="vnd-brands" value="${(v?.brands||[]).join(', ')}" placeholder="e.g. Kajaria, Ashirvad, Asian Paints"></div>
    <div class="form-group"><label>Payment Terms</label>
      <select id="vnd-terms">
        <option value="" ${!v?.paymentTerms?'selected':''}>Select...</option>
        <option value="Immediate" ${v?.paymentTerms==='Immediate'?'selected':''}>Immediate (Cash on Delivery)</option>
        <option value="7 days" ${v?.paymentTerms==='7 days'?'selected':''}>7 days credit</option>
        <option value="15 days" ${v?.paymentTerms==='15 days'?'selected':''}>15 days credit</option>
        <option value="30 days" ${v?.paymentTerms==='30 days'?'selected':''}>30 days credit</option>
        <option value="45 days" ${v?.paymentTerms==='45 days'?'selected':''}>45 days credit</option>
        <option value="Custom" ${v?.paymentTerms==='Custom'?'selected':''}>Custom</option>
      </select>
    </div>
    <div class="form-group"><label>Address</label><input type="text" id="vnd-address" value="${v?.address||''}"></div>
    <div class="form-group"><label>Notes</label><input type="text" id="vnd-notes" value="${v?.notes||''}" placeholder="e.g. Best for bulk tiles, negotiable prices"></div>
    <button class="btn-primary full-width" onclick="VW_VENDOR.saveVendor(${vendorId||'null'})">Save Vendor</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveVendor(vendorId) {
  const name = document.getElementById('vnd-name')?.value.trim();
  const phone = document.getElementById('vnd-phone')?.value.trim();
  if (!name) { showToast('Vendor name is required', 'warn'); return; }
  const categories = [...document.querySelectorAll('input[name="vnd-cat"]:checked')].map(cb => cb.value);
  const profile = VW_AUTH.getCurrentProfile();
  const record = {
    name,
    contactPerson: document.getElementById('vnd-contact')?.value.trim()||'',
    phone,
    whatsapp: document.getElementById('vnd-wa')?.value.trim() || phone,
    categories,
    brands: (document.getElementById('vnd-brands')?.value||'').split(',').map(b=>b.trim()).filter(Boolean),
    gstNo: (document.getElementById('vnd-gst')?.value||'').toUpperCase().trim(),
    paymentTerms: document.getElementById('vnd-terms')?.value||'',
    address: document.getElementById('vnd-address')?.value.trim()||'',
    notes: document.getElementById('vnd-notes')?.value.trim()||'',
    addedByName: profile?.name||'',
    updatedAt: new Date().toISOString()
  };
  if (vendorId) {
    const existing = await VW_DB.getById(VW_DB.STORES.vendors, vendorId);
    Object.assign(existing, record);
    await VW_DB.put(VW_DB.STORES.vendors, existing);
  } else {
    record.ratings = [];
    record.createdAt = new Date().toISOString();
    await VW_DB.put(VW_DB.STORES.vendors, record);
  }
  showToast(`Vendor ${vendorId ? 'updated' : 'added'}`, 'success');
  closeSheet();
  navigateTo('vendors');
}

// ===== VENDOR DETAIL =====
async function openVendor(id) {
  const [v, allPOs, allProducts] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.vendors, id),
    VW_DB.all(VW_DB.STORES.purchaseOrders),
    VW_DB.all(VW_DB.STORES.products)
  ]);
  if (!v) return;
  const vendorPOs = allPOs.filter(p => p.vendorId === id).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const isAdmin = VW_AUTH.isAdmin();
  const avgRating = v.ratings?.length ? (v.ratings.reduce((s,r) => s+r,0)/v.ratings.length).toFixed(1) : null;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <h3 style="margin:0">${v.name}</h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0">${v.categories?.join(', ')||'General'}</p>
        ${avgRating ? `<p style="font-size:12px;color:var(--gold);margin:0">★ ${avgRating} avg rating (${v.ratings.length} order${v.ratings.length>1?'s':''})</p>` : ''}
      </div>
      ${isAdmin ? `<button class="btn-sm" onclick="VW_VENDOR.showAddVendor(${id})">✏️ Edit</button>` : ''}
    </div>
    <div class="req-item-card" style="margin-bottom:10px">
      ${v.phone ? `<div style="font-size:13px;padding:3px 0">📞 <a href="tel:${v.phone}" style="color:var(--text1)">${v.phone}</a>${v.contactPerson ? ' · '+v.contactPerson : ''}</div>` : ''}
      ${v.paymentTerms ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">💳 ${v.paymentTerms}</div>` : ''}
      ${v.gstNo ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">GST: ${v.gstNo}</div>` : ''}
      ${v.address ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">📍 ${v.address}</div>` : ''}
      ${v.notes ? `<div style="font-size:12px;color:var(--text3);padding:2px 0;font-style:italic">${v.notes}</div>` : ''}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      ${v.phone ? `<button class="btn-wa" style="flex:1" onclick="window.open('https://wa.me/91${(v.whatsapp||v.phone).replace(/\D/g,'')}','_blank')">💬 WhatsApp</button>` : ''}
      ${v.phone ? `<button class="btn-call" onclick="window.location='tel:${v.phone}'">📞 Call</button>` : ''}
      <button class="btn-primary" style="flex:1" onclick="VW_VENDOR.showCreatePO(${id})">📋 Create PO</button>
    </div>
    ${vendorPOs.length ? `
    <div class="sheet-section-label">Purchase Orders (${vendorPOs.length})</div>
    ${vendorPOs.slice(0,5).map(po => `
      <div class="task-card" onclick="VW_VENDOR.openPO(${po.id})">
        <div class="task-card-header">
          <span class="task-dept">${po.poNo}</span>
          <span class="badge" style="background:${po.status==='received'?'#22c55e':po.status==='sent'?'#378ADD':'var(--gold)'}">${po.status==='received'?'Received':po.status==='sent'?'Sent':'Draft'}</span>
        </div>
        <div style="font-size:12px;color:var(--text3)">${new Date(po.createdAt).toLocaleDateString('en-IN')} · ${po.items?.length||0} item${po.items?.length>1?'s':''} · ₹${(po.totalValue||0).toLocaleString('en-IN')}</div>
      </div>`).join('')}
    ` : '<p style="font-size:12px;color:var(--text3)">No purchase orders with this vendor yet</p>'}
    ${isAdmin && v.ratings?.length ? `
    <div class="sheet-section-label">Rating History</div>
    ${v.ratings.map((r,i) => `<div style="font-size:12px;padding:3px 0">Order ${i+1}: ${'★'.repeat(r)}${'☆'.repeat(5-r)}</div>`).join('')}` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// ===== CREATE PURCHASE ORDER =====
async function showCreatePO(vendorId, preselectProductId = null) {
  const [vendor, products] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.vendors, vendorId),
    VW_DB.all(VW_DB.STORES.products)
  ]);
  if (!vendor) return;
  const vendorBrands = (vendor.brands||[]).map(b=>String(b).toLowerCase());
  // Products this vendor supplies: brand match takes priority, then category.
  const brandMatched = vendorBrands.length ? products.filter(p => p.brand && vendorBrands.includes(String(p.brand).toLowerCase())) : [];
  const sortedProducts = [...products].sort((a,b) => {
    const aB = a.brand && vendorBrands.includes(String(a.brand).toLowerCase()) ? 0 : 1;
    const bB = b.brand && vendorBrands.includes(String(b.brand).toLowerCase()) ? 0 : 1;
    return aB - bB;
  });

  window._poDraft = { vendorId, vendorName: vendor.name, items: [], notes: '' };
  // Pre-add the product that triggered this PO (e.g. "Raise PO" from a low-stock item).
  if (preselectProductId) {
    const p = products.find(x => x.id === preselectProductId);
    if (p) window._poDraft.items.push({ productId: p.id, name: p.name, unit: p.unit||'pc', qty: 1, expectedRate: 0 });
  }

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Create Purchase Order</h3>
    <p class="sheet-meta">${vendor.name} · ${vendor.paymentTerms||'No terms set'}${vendorBrands.length ? ' · Brands: '+(vendor.brands||[]).join(', ') : ''}</p>

    <div class="form-group">
      <label>Add Items${brandMatched.length ? ` <span style="color:var(--gold);font-weight:400">(${brandMatched.length} match this vendor's brands)</span>` : ''}</label>
      <div style="display:flex;gap:8px">
        <select id="po-product-select" style="flex:1">
          <option value="">— Select product —</option>
          ${sortedProducts.map(p => `<option value="${p.id}" data-name="${p.name}" data-unit="${p.unit||'pc'}">${(p.brand && vendorBrands.includes(String(p.brand).toLowerCase()))?'⭐ ':''}${p.name} (${p.category}) — Stock: ${p.stock||0}</option>`).join('')}
        </select>
        <button class="btn-sm" onclick="VW_VENDOR.addPOItem()">+ Add</button>
      </div>
    </div>

    <div id="po-items-list" style="margin-bottom:12px"></div>

    <div class="form-group"><label>Delivery Expected By</label><input type="date" id="po-delivery-date" value="${new Date(Date.now()+7*86400000).toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Notes to Vendor</label><input type="text" id="po-notes" placeholder="e.g. Deliver before 10am, call before coming"></div>

    <div id="po-total-display" style="font-size:14px;font-weight:700;color:var(--gold);padding:8px 0"></div>

    <button class="btn-primary full-width" onclick="VW_VENDOR.savePO('pending_approval')" style="background:var(--gold);color:#000">
      📤 Submit for Management Approval
    </button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_VENDOR.savePO('draft')">💾 Save as Draft</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  renderPOItemsList();
}

// Raise a PO starting from a product/brand: find the vendor that supplies
// the product's brand (falls back to a vendor covering its category), then
// open the PO form with that vendor and the item pre-added.
async function createPOForProduct(productId) {
  const [product, vendors] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.products, productId),
    VW_DB.all(VW_DB.STORES.vendors)
  ]);
  if (!product) return;
  const brand = (product.brand||'').toLowerCase();
  let vendor = brand ? vendors.find(v => (v.brands||[]).some(b => String(b).toLowerCase() === brand)) : null;
  let routedBy = vendor ? 'brand' : '';
  if (!vendor) { vendor = vendors.find(v => (v.categories||[]).includes(product.category)); routedBy = vendor ? 'category' : ''; }
  if (!vendor) {
    showToast(`No vendor linked to ${product.brand||product.category||'this item'} yet — add the brand to a vendor first`, 'warn');
    return navigateTo('vendors');
  }
  showToast(`Routed to ${vendor.name}${routedBy==='brand'?` (supplies ${product.brand})`:` (${product.category})`}`, 'success');
  showCreatePO(vendor.id, productId);
}

function addPOItem() {
  const sel = document.getElementById('po-product-select');
  const opt = sel?.options[sel.selectedIndex];
  if (!opt?.value) return;
  const existing = window._poDraft.items.find(i => i.productId === parseInt(opt.value));
  if (existing) { existing.qty++; } else {
    window._poDraft.items.push({
      productId: parseInt(opt.value),
      name: opt.dataset.name,
      unit: opt.dataset.unit,
      qty: 1,
      expectedRate: 0
    });
    _poCheckLotWarning(parseInt(opt.value));
  }
  renderPOItemsList();
}

// ── Lot match warning on reorder ──
// If the product being reordered still has stock from an existing lot, warn the buyer:
// tiles from a different lot/shade batch can visibly mismatch on the same floor.
async function _poCheckLotWarning(productId) {
  try {
    const { data: p } = await VW_DB.client.from('products')
      .select('name,stock,current_lot_no,current_shade_no').eq('id', productId).single();
    if (!p) return;
    const hasLot = p.current_lot_no || p.current_shade_no;
    const stockNum = parseFloat(p.stock) || 0;
    if (!hasLot || stockNum <= 0) return;
    const item = (window._poDraft?.items||[]).find(i => i.productId === productId);
    if (item) item._lotWarning = {
      lot: p.current_lot_no || '—', shade: p.current_shade_no || '—', stock: stockNum,
    };
    renderPOItemsList();
    showToast(`⚠️ ${p.name}: existing stock is Lot ${p.current_lot_no||'?'}${p.current_shade_no?' / Shade '+p.current_shade_no:''} — request the SAME lot from vendor or expect shade variation`, 'warn');
  } catch(e) {}
}

function renderPOItemsList() {
  const container = document.getElementById('po-items-list');
  if (!container) return;
  if (!window._poDraft.items.length) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text3)">No items added yet</p>';
    updatePOTotal();
    return;
  }
  container.innerHTML = window._poDraft.items.map((item, i) => `
    <div style="display:flex;gap:8px;align-items:center;padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:6px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${item.name}</div>
        ${item._lotWarning ? `
        <div style="font-size:10px;background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);border-radius:6px;padding:4px 8px;margin-top:4px;color:var(--gold)">
          ⚠️ ${item._lotWarning.stock} in stock from Lot <strong>${item._lotWarning.lot}</strong>${item._lotWarning.shade!=='—'?` / Shade <strong>${item._lotWarning.shade}</strong>`:''} — request same lot to avoid shade mismatch
        </div>` : ''}
        <div style="display:flex;gap:8px;margin-top:4px">
          <input type="number" value="${item.qty}" min="1" style="width:70px"
            onchange="window._poDraft.items[${i}].qty=parseFloat(this.value)||1;VW_VENDOR.renderPOItemsList()"
            placeholder="Qty">
          <span style="font-size:12px;color:var(--text3);align-self:center">${item.unit}</span>
          <input type="number" value="${item.expectedRate||''}" min="0" style="width:90px"
            onchange="window._poDraft.items[${i}].expectedRate=parseFloat(this.value)||0;VW_VENDOR.updatePOTotal()"
            placeholder="₹ Rate">
        </div>
      </div>
      <button onclick="window._poDraft.items.splice(${i},1);VW_VENDOR.renderPOItemsList()"
        style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;flex-shrink:0">✕</button>
    </div>`).join('');
  updatePOTotal();
}

function updatePOTotal() {
  const total = (window._poDraft?.items||[]).reduce((s,i) => s + (i.qty||0)*(i.expectedRate||0), 0);
  const el = document.getElementById('po-total-display');
  if (el) el.textContent = total > 0 ? `Estimated Total: ₹${Math.round(total).toLocaleString('en-IN')}` : '';
}

async function savePO(status) {
  if (!window._poDraft?.items?.length) { showToast('Add at least one item', 'warn'); return; }
  const fy = getFinancialYearLabel();
  const seq = await VW_DB.incrementPOSequence(fy);
  const poNo = `PO/${fy}/${String(seq).padStart(5,'0')}`;
  const totalValue = window._poDraft.items.reduce((s,i) => s + (i.qty||0)*(i.expectedRate||0), 0);
  const prof = VW_AUTH.getCurrentProfile();

  const record = {
    poNo, vendorId: window._poDraft.vendorId, vendorName: window._poDraft.vendorName,
    items: window._poDraft.items,
    totalValue: Math.round(totalValue),
    deliveryDate: document.getElementById('po-delivery-date')?.value||'',
    notes: document.getElementById('po-notes')?.value||'',
    status: 'pending_approval',  // always goes to management first
    approval_status: 'pending_approval',
    createdByName: prof?.name||'',
    raised_by: prof?.id||null,
    createdAt: new Date().toISOString()
  };

  // Save to IndexedDB
  const newId = await VW_DB.put(VW_DB.STORES.purchaseOrders, record);
  record.id = newId;

  // Save to Supabase so Management can see it on any device
  const { data: sbPO } = await VW_DB.client.from('purchase_orders').insert({
    po_no: poNo,
    vendor_id: window._poDraft.vendorId,
    vendor_name: window._poDraft.vendorName,
    items: window._poDraft.items,
    total_value: Math.round(totalValue),
    delivery_date: document.getElementById('po-delivery-date')?.value||null,
    notes: document.getElementById('po-notes')?.value||'',
    approval_status: 'pending_approval',
    raised_by: prof?.id||null,
    created_by_name: prof?.name||'',
    date: new Date().toISOString().split('T')[0],
    status: 'pending_approval',
  }).select('id').single().then(r=>r, ()=>({data:null}));

  record.supabaseId = sbPO?.id;
  await VW_DB.put(VW_DB.STORES.purchaseOrders, record);

  // Auto-approve low-value POs (below threshold set in settings)
  const poSettings = await VW_DB.getSetting('po_config', { auto_approve_below: 5000 });
  const autoApproveThreshold = poSettings.auto_approve_below || 5000;

  if (totalValue <= autoApproveThreshold) {
    // Auto-approve — no management notification needed
    if (sbPO?.id) {
      await VW_DB.client.from('purchase_orders')
        .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'Auto (below ₹' + autoApproveThreshold.toLocaleString('en-IN') + ')' })
        .eq('id', sbPO.id).catch(() => {});
    }
    showToast(`${poNo} auto-approved (below ₹${autoApproveThreshold.toLocaleString('en-IN')}) ✅`, 'success');
  } else {
    // Notify Management via in-app bell
    try {
      const { data: mgmt } = await VW_DB.client.from('profiles')
        .select('id,name').in('role',['management','admin']).eq('status','approved');
      for (const m of mgmt||[]) {
        await createPersistedNotification({
          category: 'po_approval',
          title: `🛒 PO Approval Needed — ${poNo}`,
          body: `${prof?.name||'Purchase Manager'} raised PO for ${record.vendorName} · ₹${Math.round(totalValue).toLocaleString('en-IN')}`,
          recipientId: m.id,
          relatedTable: 'purchase_orders',
          relatedId: sbPO?.id,
          actions: [{ label: '👁 Review PO', action: 'open_po_approval' }],
        }).catch(()=>{});
      }
    } catch(_) {}
    showToast(`${poNo} submitted for Management approval`, 'success');
  }

  closeSheet();
  navigateTo('vendors');
}

async function sendPOWhatsApp(po) {
  const vendor = await VW_DB.getById(VW_DB.STORES.vendors, po.vendorId);
  if (!vendor?.phone) { showToast('Vendor has no phone number', 'warn'); return; }
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale';
  const itemLines = po.items.map(i =>
    `• ${i.name}: ${i.qty} ${i.unit}${i.expectedRate ? ' @ ₹'+i.expectedRate.toLocaleString('en-IN') : ''}`
  ).join('\n');
  const msg = encodeURIComponent(
    `*Purchase Order — ${po.poNo}*\n` +
    `From: ${storeName}\n` +
    `Date: ${new Date().toLocaleDateString('en-IN')}\n` +
    (po.deliveryDate ? `Delivery by: ${new Date(po.deliveryDate).toLocaleDateString('en-IN')}\n` : '') +
    `\n*Items Required:*\n${itemLines}\n` +
    (po.totalValue ? `\n*Estimated Value: ₹${po.totalValue.toLocaleString('en-IN')}*\n` : '') +
    (po.notes ? `\nNote: ${po.notes}\n` : '') +
    `\nPlease confirm receipt and availability. Thank you!`
  );
  const waPhone = (vendor.whatsapp||vendor.phone).replace(/\D/g,'');
  window.open(`https://wa.me/91${waPhone}?text=${msg}`, '_blank');
}

// ===== PO DETAIL & RECEIPT =====
async function openPO(id) {
  const [po, vendor] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.purchaseOrders, id),
    VW_DB.all(VW_DB.STORES.vendors)
  ]);
  if (!po) return;
  const v = vendor.find(v => v.id === po.vendorId);
  const isAdmin = VW_AUTH.isAdmin();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h3 style="margin:0">${po.poNo}</h3>
      <span class="badge" style="background:${po.status==='received'?'#22c55e':po.status==='sent'?'#378ADD':'var(--gold)'}">${po.status==='received'?'✓ Received':po.status==='sent'?'Sent':'Draft'}</span>
    </div>
    <p class="sheet-meta">${po.vendorName} · ${new Date(po.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</p>
    <div class="req-item-card" style="margin:10px 0">
      ${po.deliveryDate ? `<div style="font-size:12px;color:var(--text3)">Expected delivery: ${new Date(po.deliveryDate).toLocaleDateString('en-IN')}</div>` : ''}
      ${po.totalValue ? `<div style="font-size:13px;font-weight:600;color:var(--gold);margin-top:4px">Total: ₹${po.totalValue.toLocaleString('en-IN')}</div>` : ''}
    </div>
    <div style="margin-bottom:12px">
      ${(po.items||[]).map(item => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border2);font-size:13px">
          <span>${item.name}</span>
          <span style="color:var(--text3)">${item.qty} ${item.unit}${item.expectedRate?' @ ₹'+item.expectedRate.toLocaleString('en-IN'):''}</span>
        </div>`).join('')}
    </div>
    ${po.notes ? `<p style="font-size:12px;color:var(--text3);font-style:italic;margin-bottom:12px">${po.notes}</p>` : ''}
    ${po.status !== 'received' && po.status !== 'cancelled' ? `
    <div style="display:flex;gap:8px;margin-bottom:8px">
      ${v?.phone && (po.approval_status === 'approved' || po.status === 'approved') ? `
        <button class="btn-wa" style="flex:1" onclick="VW_VENDOR.sendPOWhatsApp(${JSON.stringify(po).replace(/"/g,'&quot;')})">💬 Send to Vendor</button>` : ''}
      ${isAdmin && (po.approval_status === 'approved' || po.status === 'approved') ? `
        <button class="btn-primary" style="flex:1" onclick="VW_VENDOR.showReceivePO(${po.id})">📦 Mark Received / GRN</button>` : ''}
    </div>
    ${isAdmin && (po.status === 'pending_approval' || po.approval_status === 'pending_approval') ? `
    <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">⚡ Management Action Required</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Review items and approve to send to vendor, or reject with a reason.</div>
      <div class="form-group" style="margin-bottom:10px">
        <label style="font-size:11px">Approval Note (optional)</label>
        <input type="text" id="po-approval-note-${po.id}" placeholder="e.g. Approved — check rate with vendor first">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="VW_VENDOR.approvePO(${po.id})" style="flex:2;padding:12px;border-radius:10px;background:rgba(34,197,94,0.1);border:2px solid var(--green);color:var(--green);font-size:13px;font-weight:700;cursor:pointer">
          ✅ Approve & Send to Vendor
        </button>
        <button onclick="VW_VENDOR.rejectPO(${po.id})" style="flex:1;padding:12px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.4);color:var(--red);font-size:13px;font-weight:700;cursor:pointer">
          ❌ Reject
        </button>
      </div>
    </div>` : ''}` : `
    <div style="font-size:12px;color:#22c55e">✓ Received ${po.receivedAt ? new Date(po.receivedAt).toLocaleDateString('en-IN') : ''} by ${po.receivedByName||'—'}</div>
    ${po.receivedNotes ? `<div style="font-size:12px;color:var(--text3)">${po.receivedNotes}</div>` : ''}`}
    ${isAdmin && po.status === 'received' ? `
    <div style="margin-top:8px">
      <label style="font-size:12px;color:var(--text3)">Rate this delivery:</label>
      <div style="display:flex;gap:6px;margin-top:4px">
        ${[1,2,3,4,5].map(n => `<button onclick="VW_VENDOR.rateVendorDelivery(${po.vendorId},${n})" style="background:${(v?.ratings||[]).slice(-1)[0]===n?'var(--gold)':'var(--bg2)'};border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:16px">★</button>`).join('')}
      </div>
    </div>` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function approvePO(poId) {
  const po = await VW_DB.getById(VW_DB.STORES.purchaseOrders, poId);
  if (!po) return;
  const prof = VW_AUTH.getCurrentProfile();
  const note = document.getElementById(`po-approval-note-${poId}`)?.value||'';

  po.status = 'approved';
  po.approval_status = 'approved';
  po.approvedBy = prof?.name||'';
  po.approvedAt = new Date().toISOString();
  po.approvalNote = note;
  await VW_DB.put(VW_DB.STORES.purchaseOrders, po);

  // Sync to Supabase
  if (po.supabaseId) {
    await VW_DB.client.from('purchase_orders').update({
      approval_status: 'approved',
      approved_by: prof?.id,
      approved_at: new Date().toISOString(),
      notes: note ? (po.notes ? po.notes+' | Approval: '+note : note) : po.notes,
    }).eq('id', po.supabaseId).catch(()=>{});
  }

  // Send WhatsApp to vendor
  await sendPOWhatsApp(po);

  // Notify Purchase Manager
  try {
    const { data: pm } = await VW_DB.client.from('profiles')
      .select('id,name').in('role',['purchase_manager','admin']).eq('status','approved');
    for (const p of pm||[]) {
      await createPersistedNotification({
        category: 'po_approved',
        title: `✅ ${po.poNo} Approved`,
        body: `Approved by ${prof?.name||'Management'} · WhatsApp sent to ${po.vendorName}`,
        recipientId: p.id,
        relatedTable: 'purchase_orders',
        relatedId: po.supabaseId,
        actions: [{ label: '👁 View PO', action: 'open_po_approval' }],
      }).catch(()=>{});
    }
  } catch(_) {}

  showToast(`${po.poNo} approved — WhatsApp sent to vendor`, 'success');
  closeSheet();
  navigateTo('vendors');
}

async function rejectPO(poId) {
  const po = await VW_DB.getById(VW_DB.STORES.purchaseOrders, poId);
  if (!po) return;
  const prof = VW_AUTH.getCurrentProfile();
  const note = document.getElementById(`po-approval-note-${poId}`)?.value||'';
  if (!note) { showToast('Please add a reason before rejecting', 'warn'); return; }

  po.status = 'rejected';
  po.approval_status = 'rejected';
  po.rejectionReason = note;
  po.rejectedBy = prof?.name||'';
  po.rejectedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.purchaseOrders, po);

  if (po.supabaseId) {
    await VW_DB.client.from('purchase_orders').update({
      approval_status: 'rejected',
      notes: 'Rejected: ' + note,
    }).eq('id', po.supabaseId).catch(()=>{});
  }

  // Notify Purchase Manager
  try {
    const { data: pm } = await VW_DB.client.from('profiles')
      .select('id').in('role',['purchase_manager','admin']).eq('status','approved');
    for (const p of pm||[]) {
      await createPersistedNotification({
        category: 'po_rejected',
        title: `❌ ${po.poNo} Rejected`,
        body: `Reason: ${note}`,
        recipientId: p.id,
        relatedTable: 'purchase_orders',
        relatedId: po.supabaseId,
      }).catch(()=>{});
    }
  } catch(_) {}

  showToast(`${po.poNo} rejected`, 'warn');
  closeSheet();
  navigateTo('vendors');
}

async function showReceivePO(poId) {
  const po = await VW_DB.getById(VW_DB.STORES.purchaseOrders, poId);
  if (!po) return;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>📦 GRN — ${po.poNo}</h3>
    <p class="sheet-meta">${po.vendorName} · Ordered ${(po.items||[]).reduce((s,i)=>s+(i.qty||0),0)} items total</p>
    <div style="font-size:11px;color:var(--text3);background:var(--bg2);border-radius:8px;padding:8px;margin-bottom:12px">
      Enter actual quantity received for each item. If short — choose to accept partial or reject.
    </div>

    ${(po.items||[]).map((item, i) => `
    <div style="padding:10px;background:var(--bg2);border-radius:10px;margin-bottom:10px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">${item.name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Ordered</label>
          <div style="padding:8px;background:var(--bg3);border-radius:7px;font-size:14px;font-weight:700;text-align:center">${item.qty} ${item.unit}</div>
        </div>
        <div>
          <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Actually Received</label>
          <input type="number" id="recv-qty-${i}" value="${item.qty}" min="0"
            style="width:100%;padding:8px;border:1.5px solid var(--gold-border);border-radius:7px;background:var(--bg3);color:var(--gold);font-size:14px;font-weight:700;text-align:center;box-sizing:border-box"
            oninput="checkShortage(${i},${item.qty})">
        </div>
      </div>
      <div id="shortage-action-${i}" style="display:none;margin-bottom:8px">
        <div style="font-size:11px;color:var(--red);font-weight:600;margin-bottom:6px">⚠️ Short delivery detected</div>
        <div style="display:flex;gap:6px">
          <button onclick="setShortageAction(${i},'accept_partial')"
            id="sa-accept-${i}"
            style="flex:1;padding:7px;border-radius:7px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:var(--bg3)">
            ✅ Accept Partial
          </button>
          <button onclick="setShortageAction(${i},'reject')"
            id="sa-reject-${i}"
            style="flex:1;padding:7px;border-radius:7px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:var(--bg3)">
            ❌ Reject Delivery
          </button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:6px">
        <div>
          <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Actual Rate (₹)</label>
          <input type="number" id="recv-rate-${i}" value="${item.expectedRate||''}" placeholder="₹ per unit"
            style="width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;background:var(--bg3);box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:10px;color:${item.productId?'var(--gold)':'var(--text3)'};font-weight:700;display:block;margin-bottom:3px">Lot / Batch No.</label>
          <input type="text" id="recv-lot-${i}" placeholder="e.g. L2024-07" value="${item.lot_no||''}"
            style="width:100%;padding:8px;border:1px solid ${item.productId?'var(--gold-border)':'var(--border)'};border-radius:7px;background:var(--bg3);box-sizing:border-box;font-size:12px">
        </div>
        <div>
          <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Shade No.</label>
          <input type="text" id="recv-shade-${i}" placeholder="e.g. S-03" value="${item.shade_no||''}"
            style="width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;background:var(--bg3);box-sizing:border-box;font-size:12px">
        </div>
      </div>
      ${item.productId ? `<div style="font-size:10px;color:var(--gold);padding:4px 0">⚠️ Tiles: always record Lot & Shade No. — customers must buy same batch for shade consistency</div>` : ''}
    </div>`).join('')}

    <div class="form-group"><label>Supplier Bill / Invoice No.</label><input type="text" id="recv-bill-no" placeholder="e.g. INV/2025/001"></div>
    <div class="form-group"><label>Notes</label><input type="text" id="recv-notes" placeholder="e.g. 2 items damaged, pending balance delivery"></div>
    <button class="btn-primary full-width" onclick="VW_VENDOR.confirmReceivePO(${poId})">✓ Confirm GRN & Update Stock</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_VENDOR.openPO(${poId})">← Back</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  // Inject shortage detection script
  const s = document.createElement('script');
  s.textContent = `
    window._shortageActions = {};
    function checkShortage(idx, ordered) {
      const received = parseFloat(document.getElementById('recv-qty-'+idx)?.value)||0;
      const div = document.getElementById('shortage-action-'+idx);
      if (div) div.style.display = received < ordered ? 'block' : 'none';
      if (received >= ordered) delete window._shortageActions[idx];
    }
    function setShortageAction(idx, action) {
      window._shortageActions[idx] = action;
      const accept = document.getElementById('sa-accept-'+idx);
      const reject = document.getElementById('sa-reject-'+idx);
      if (accept) accept.style.background = action==='accept_partial' ? 'rgba(34,197,94,0.15)' : 'var(--bg3)';
      if (reject) reject.style.background = action==='reject' ? 'rgba(239,68,68,0.1)' : 'var(--bg3)';
    }
  `;
  document.body.appendChild(s);
}

async function confirmReceivePO(poId) {
  const po = await VW_DB.getById(VW_DB.STORES.purchaseOrders, poId);
  if (!po) return;
  const prof = VW_AUTH.getCurrentProfile();
  let totalActual = 0;
  let hasShortage = false;
  let hasRejected = false;

  const grnItems = [];

  for (let i = 0; i < po.items.length; i++) {
    const item = po.items[i];
    const qtyReceived = parseFloat(document.getElementById(`recv-qty-${i}`)?.value) || 0;
    const rateActual  = parseFloat(document.getElementById(`recv-rate-${i}`)?.value) || item.expectedRate || 0;
    const shortageAction = window._shortageActions?.[i] || null;

    const isShort = qtyReceived < item.qty;
    if (isShort) {
      hasShortage = true;
      if (shortageAction === 'reject') { hasRejected = true; }
      else if (!shortageAction) {
        showToast(`Please select Accept Partial or Reject for ${item.name}`, 'warn');
        return;
      }
    }

    const grnItem = {
      productId: item.productId,
      name: item.name,
      unit: item.unit,
      qty_ordered: item.qty,
      qty_received: qtyReceived,
      actual_rate: rateActual,
      shortage_action: isShort ? shortageAction : null,
      lot_no: document.getElementById(`recv-lot-${i}`)?.value?.trim() || null,
      shade_no: document.getElementById(`recv-shade-${i}`)?.value?.trim() || null,
    };
    grnItems.push(grnItem);

    // Update stock only for accepted items
    if (item.productId && qtyReceived > 0 && shortageAction !== 'reject') {
      const product = await VW_DB.getById(VW_DB.STORES.products, item.productId);
      if (product) {
        product.stock = (product.stock||0) + qtyReceived;
        product.lastRestockDate = new Date().toISOString();
        product.lastRestockRate = rateActual;
        // Update current lot/shade on product
        if (grnItem.lot_no) product.current_lot_no = grnItem.lot_no;
        if (grnItem.shade_no) product.current_shade_no = grnItem.shade_no;
        await VW_DB.put(VW_DB.STORES.products, product);
        // Sync stock + lot to Supabase
        const stockUpdate = { stock: product.stock, last_restock_date: product.lastRestockDate };
        if (grnItem.lot_no) stockUpdate.current_lot_no = grnItem.lot_no;
        if (grnItem.shade_no) stockUpdate.current_shade_no = grnItem.shade_no;
        await VW_DB.client.from('products').update(stockUpdate).eq('id', item.productId).catch(()=>{});
      }
      totalActual += qtyReceived * rateActual;
    }
    item.qtyReceived = qtyReceived;
    item.actualRate = rateActual;
  }

  // Determine GRN status
  const grnStatus = hasRejected ? 'partial_rejected' : hasShortage ? 'partial' : 'complete';

  // Create GRN in Supabase
  const billNo = document.getElementById('recv-bill-no')?.value||'';
  const notes  = document.getElementById('recv-notes')?.value||'';
  const { data: grnRecord } = await VW_DB.client.from('grn').insert({
    po_id: po.supabaseId || null,
    vendor_id: po.vendorId,
    vendor_name: po.vendorName,
    received_by: prof?.id||null,
    received_by_name: prof?.name||'',
    received_at: new Date().toISOString(),
    items: grnItems,
    status: grnStatus,
    shortage_note: notes,
    total_received_value: Math.round(totalActual),
    has_shade_variation: grnItems.some(i => i.shade_no),
  }).select('id').single().then(r=>r, ()=>({data:null}));

  // Create product_lots records for items with lot/shade info
  const lotInserts = grnItems
    .filter(i => i.productId && i.qty_received > 0 && i.shortage_action !== 'reject' && (i.lot_no || i.shade_no))
    .map(i => ({
      product_id: i.productId,
      lot_no: i.lot_no || ('LOT-' + new Date().toISOString().split('T')[0]),
      shade_no: i.shade_no || null,
      qty_received: i.qty_received,
      qty_remaining: i.qty_received,
      grn_id: grnRecord?.id || null,
      po_id: po.supabaseId || null,
      vendor_id: po.vendorId,
      vendor_name: po.vendorName,
      received_by_name: prof?.name||'',
      is_current: true,
    }));
  if (lotInserts.length) {
    // Previous lots of these products are no longer the current batch
    const lotProductIds = [...new Set(lotInserts.map(l => l.product_id))];
    await VW_DB.client.from('product_lots')
      .update({ is_current: false })
      .in('product_id', lotProductIds).catch(()=>{});
    await VW_DB.client.from('product_lots').insert(lotInserts).catch(()=>{});
  }

  // Update PO status
  po.status = grnStatus === 'complete' ? 'received' : 'partially_received';
  po.receivedAt = new Date().toISOString();
  po.receivedByName = prof?.name||'';
  po.supplierBillNo = billNo;
  po.receivedNotes = notes;
  po.actualValue = Math.round(totalActual);
  await VW_DB.put(VW_DB.STORES.purchaseOrders, po);

  if (po.supabaseId) {
    await VW_DB.client.from('purchase_orders').update({
      status: po.status,
      received_at: po.receivedAt,
      received_by_name: po.receivedByName,
      supplier_bill_no: billNo,
      received_notes: notes,
      actual_value: po.actualValue,
    }).eq('id', po.supabaseId).catch(()=>{});
  }

  const msg = grnStatus === 'complete'
    ? `GRN complete — stock updated for all ${grnItems.length} items`
    : `GRN saved — partial receipt. ${hasRejected ? 'Some items rejected.' : 'Short delivery noted.'}`;

  showToast(msg, 'success');
  closeSheet();
  navigateTo('vendors');
}

async function rateVendorDelivery(vendorId, rating) {
  const vendor = await VW_DB.getById(VW_DB.STORES.vendors, vendorId);
  if (!vendor) return;
  vendor.ratings = [...(vendor.ratings||[]), rating];
  await VW_DB.put(VW_DB.STORES.vendors, vendor);
  showToast(`Rated ${rating}★`, 'success');
}

// ===== PO LIST =====
function renderPOList(pos, vendorMap) {
  if (!pos.length) return '<div class="card"><p class="empty-msg">No purchase orders yet</p></div>';
  const open = pos.filter(p => p.status !== 'received');
  const received = pos.filter(p => p.status === 'received');
  return `
  <div class="card">
    <h3 class="card-title">Open POs <span class="badge">${open.length}</span></h3>
    ${!open.length ? '<p class="empty-msg">No open purchase orders</p>' :
    open.map(po => `
      <div class="task-card" onclick="VW_VENDOR.openPO(${po.id})">
        <div class="task-card-header">
          <span class="task-dept">${po.poNo}</span>
          <span class="badge" style="background:${po.status==='approved'?'#22c55e':po.status==='pending_approval'?'var(--gold)':po.status==='rejected'?'var(--red)':po.status==='sent'?'#378ADD':'var(--text3)'}}">${po.status==='approved'?'✅ Approved':po.status==='pending_approval'?'⏳ Awaiting Approval':po.status==='rejected'?'❌ Rejected':po.status==='sent'?'Sent':'Draft'}</span>
        </div>
        <div style="font-size:12px;color:var(--text3)">${po.vendorName} · ${po.items?.length||0} items · ₹${(po.totalValue||0).toLocaleString('en-IN')}</div>
        ${po.deliveryDate ? `<div style="font-size:11px;color:${new Date(po.deliveryDate)<new Date()?'var(--red)':'var(--text3)'}">Expected: ${new Date(po.deliveryDate).toLocaleDateString('en-IN')}</div>` : ''}
      </div>`).join('')}
  </div>
  ${received.length ? `
  <div class="card">
    <h3 class="card-title">Received <span class="badge">${received.length}</span></h3>
    ${received.slice(0,8).map(po => `
      <div class="task-card" onclick="VW_VENDOR.openPO(${po.id})">
        <div class="task-card-header">
          <span class="task-dept">${po.poNo}</span>
          <span class="badge" style="background:#22c55e">✓ Received</span>
        </div>
        <div style="font-size:12px;color:var(--text3)">${po.vendorName} · ₹${(po.actualValue||po.totalValue||0).toLocaleString('en-IN')}</div>
      </div>`).join('')}
  </div>` : ''}`;
}

// ===== QUICK PO FROM LOW STOCK =====
// Called from Inventory when a product is below threshold
async function quickPOFromLowStock(productId) {
  const [product, vendors] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.products, productId),
    VW_DB.all(VW_DB.STORES.vendors)
  ]);
  if (!product) return;
  // Find vendors that supply this product's category
  const relevantVendors = vendors.filter(v => v.categories?.includes(product.category));
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Quick Purchase Order</h3>
    <p class="sheet-meta">${product.name} — Stock: ${product.stock||0} ${product.unit||'pc'} (Low)</p>
    <div class="form-group"><label>Select Vendor</label>
      <select id="qpo-vendor">
        <option value="">— Select vendor —</option>
        ${relevantVendors.length ? relevantVendors.map(v => `<option value="${v.id}">${v.name} (${v.paymentTerms||'No terms'})</option>`).join('') : ''}
        ${vendors.filter(v => !relevantVendors.includes(v)).map(v => `<option value="${v.id}">[Other] ${v.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Quantity to Order</label>
      <input type="number" id="qpo-qty" value="${Math.max(50, (product.lowStockThreshold||20)*3)}" min="1">
    </div>
    <div class="form-group"><label>Expected Rate (₹ per ${product.unit||'pc'})</label>
      <input type="number" id="qpo-rate" value="${product.lastRestockRate||product.price||''}">
    </div>
    <button class="btn-primary full-width" onclick="VW_VENDOR.saveQuickPO(${productId})">Create & Send PO</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveQuickPO(productId) {
  const vendorId = parseInt(document.getElementById('qpo-vendor')?.value);
  const qty = parseFloat(document.getElementById('qpo-qty')?.value)||0;
  const rate = parseFloat(document.getElementById('qpo-rate')?.value)||0;
  if (!vendorId) { showToast('Select a vendor', 'warn'); return; }
  if (!qty) { showToast('Enter quantity', 'warn'); return; }
  const [product, vendor] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.products, productId),
    VW_DB.getById(VW_DB.STORES.vendors, vendorId)
  ]);
  window._poDraft = {
    vendorId,
    vendorName: vendor.name,
    items: [{ productId, name: product.name, unit: product.unit||'pc', qty, expectedRate: rate }]
  };
  const fy = getFinancialYearLabel();
  const seq = await VW_DB.incrementPOSequence(fy);
  const poNo = `PO/${fy}/${String(seq).padStart(5,'0')}`;
  const record = {
    poNo, vendorId, vendorName: vendor.name,
    items: window._poDraft.items,
    totalValue: Math.round(qty * rate),
    status: 'sent',
    createdByName: VW_AUTH.getCurrentProfile()?.name||'',
    createdAt: new Date().toISOString()
  };
  const newId = await VW_DB.put(VW_DB.STORES.purchaseOrders, record);
  record.id = newId;
  await sendPOWhatsApp(record);
  showToast(`PO ${poNo} sent to ${vendor.name}`, 'success');
  closeSheet();
}

// ===== RFQ — REQUEST FOR QUOTATION TO MULTIPLE SUPPLIERS =====
async function renderRFQTab() {
  const vendors = await VW_DB.all(VW_DB.STORES.vendors);
  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📨 Request for Quotation (RFQ)</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">
      Send material requirement to multiple suppliers at once via WhatsApp. Whoever quotes first gets the PO.
    </p>
    <div class="form-group"><label>Material / Product Needed *</label>
      <textarea id="rfq-product" placeholder="e.g. Kajaria Vitrified Tiles 600×600 — 50 boxes&#10;RAK Ceramic Wall Tiles 300×600 — 100 boxes" style="height:80px"></textarea>
    </div>
    <div class="form-group"><label>Quantity & Unit</label>
      <input type="text" id="rfq-qty" placeholder="e.g. 50 boxes, 200 sqft, 5 bags">
    </div>
    <div class="form-group"><label>Required By Date</label>
      <input type="date" id="rfq-date" value="${new Date(Date.now()+3*86400000).toISOString().split('T')[0]}">
    </div>
    <div class="form-group"><label>Delivery Location</label>
      <input type="text" id="rfq-location" value="V Wholesale, Visit V Wholesale" placeholder="Delivery address">
    </div>
    <div class="form-group"><label>Additional Notes</label>
      <input type="text" id="rfq-notes" placeholder="e.g. ISI certified only, Brand preference if any">
    </div>

    <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Select Suppliers to Send To</div>
    ${vendors.length ? vendors.map(v => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" name="rfq-vendor" value="${v.id}" data-name="${v.name}" data-phone="${v.phone||''}" ${v.phone?'checked':''} style="width:18px;height:18px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${v.name}</div>
        <div style="font-size:11px;color:var(--text3)">${v.categories?.join(', ')||'General'} · ${v.phone||'⚠️ No phone'}</div>
      </div>
    </label>`).join('') : '<p class="empty-msg">No vendors added yet — add vendors first</p>'}

    <button class="btn-primary full-width" style="margin-top:14px" onclick="VW_VENDOR.sendRFQToAll()">
      💬 Send RFQ via WhatsApp to Selected Suppliers
    </button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_VENDOR.copyRFQText()">
      📋 Copy RFQ Text (paste manually)
    </button>
  </div>`;
}

function buildRFQMessage(product, qty, date, location, notes) {
  return `*V Wholesale — Request for Quotation (RFQ)*\n\nDear Supplier,\n\nWe require the following material:\n\n*Product/Material:*\n${product}\n\n*Quantity:* ${qty||'As per description'}\n*Required By:* ${date ? new Date(date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : 'Earliest possible'}\n*Delivery To:* ${location||'V Wholesale, Vijayawada'}\n${notes?`\n*Notes:* ${notes}\n`:''}\nPlease send your best quote including:\n✓ Price per unit\n✓ GST %\n✓ Delivery timeline\n✓ Payment terms\n\nQuickest quotation gets the order. Reply to this message.\n\n— V Wholesale, Vijayawada\n📞 Call us: 8712697930`;
}

async function sendRFQToAll() {
  const product = document.getElementById('rfq-product')?.value.trim();
  const qty = document.getElementById('rfq-qty')?.value.trim();
  const date = document.getElementById('rfq-date')?.value;
  const location = document.getElementById('rfq-location')?.value.trim();
  const notes = document.getElementById('rfq-notes')?.value.trim();

  if (!product) { showToast('Enter the product/material needed', 'warn'); return; }

  const selected = [...document.querySelectorAll('input[name="rfq-vendor"]:checked')];
  if (!selected.length) { showToast('Select at least one supplier', 'warn'); return; }

  const noPhone = selected.filter(cb => !cb.dataset.phone);
  if (noPhone.length) {
    showToast(`${noPhone.length} selected suppliers have no phone number — they'll be skipped`, 'warn');
  }

  const withPhone = selected.filter(cb => cb.dataset.phone);
  if (!withPhone.length) { showToast('None of the selected suppliers have phone numbers', 'warn'); return; }

  const msg = buildRFQMessage(product, qty, date, location, notes);
  const encoded = encodeURIComponent(msg);

  // Open WhatsApp for each supplier one by one
  let delay = 0;
  for (const cb of withPhone) {
    const phone = cb.dataset.phone.replace(/\D/g,'');
    setTimeout(() => {
      window.open(`https://wa.me/91${phone}?text=${encoded}`, '_blank');
    }, delay);
    delay += 800;
  }

  showToast(`RFQ sent to ${withPhone.length} supplier${withPhone.length>1?'s':''} via WhatsApp ✓`, 'success');
}

async function copyRFQText() {
  const product = document.getElementById('rfq-product')?.value.trim() || 'Material required';
  const qty = document.getElementById('rfq-qty')?.value.trim();
  const date = document.getElementById('rfq-date')?.value;
  const location = document.getElementById('rfq-location')?.value.trim();
  const notes = document.getElementById('rfq-notes')?.value.trim();
  const msg = buildRFQMessage(product, qty, date, location, notes);
  try {
    await navigator.clipboard.writeText(msg);
    showToast('RFQ text copied to clipboard ✓', 'success');
  } catch(e) {
    showToast('Copy failed — select and copy manually', 'warn');
  }
}

window.VW_VENDOR = {
  renderVendorsPage, openVendor, showAddVendor, saveVendor,
  showCreatePO, addPOItem, renderPOItemsList, updatePOTotal, savePO, createPOForProduct,
  approvePO, rejectPO,
  sendPOWhatsApp, openPO, showReceivePO, confirmReceivePO,
  rateVendorDelivery, switchVendorTab, quickPOFromLowStock, saveQuickPO,
  renderRFQTab, sendRFQToAll, copyRFQText
};




/* === accounts.js === */

// ============================================================
// ACCOUNTS MODULE
// Petty Cash · Payment Vouchers · Party Ledgers · GST Export
// The existing payment verification queue stays in dispatch.js
// ============================================================

// ===== MAIN ACCOUNTS PAGE =====
async function renderAccountsPage() {
  const profile = VW_AUTH.getCurrentProfile();
  const isAdmin = VW_AUTH.isAdmin();
  const isAccounts = profile?.role === 'accounts' || isAdmin;

  // Load vendor outstanding
  const vendorOutstanding = await VW_DISPATCH.getVendorOutstanding().catch(()=>({ pending:[], totalOutstanding:0, count:0 }));

  return `
  <div class="module-header"><h2>Accounts</h2></div>

  <!-- OUTSTANDING ALERTS -->
  ${vendorOutstanding.count > 0 ? `
  <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius);padding:12px;margin-bottom:12px;cursor:pointer" onclick="navigateTo('vendors')">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--red)">⚠️ ${vendorOutstanding.count} Vendor PO${vendorOutstanding.count>1?'s':''} Outstanding</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">Total: ₹${Math.round(vendorOutstanding.totalOutstanding).toLocaleString('en-IN')} pending payment</div>
      </div>
      <span style="color:var(--red);font-size:18px">→</span>
    </div>
  </div>` : ''}

  <div class="entry-type-grid" style="margin-bottom:14px">
    <button class="entry-type-btn active" id="acc-tab-verify" onclick="VW_ACCOUNTS.switchAccountsTab('verify',this)">
      <span class="et-icon">💳</span>Verification
    </button>
    <button class="entry-type-btn" id="acc-tab-petty" onclick="VW_ACCOUNTS.switchAccountsTab('petty',this)">
      <span class="et-icon">💵</span>Petty Cash
    </button>
    <button class="entry-type-btn" id="acc-tab-vouchers" onclick="VW_ACCOUNTS.switchAccountsTab('vouchers',this)">
      <span class="et-icon">📄</span>Vouchers
    </button>
    <button class="entry-type-btn" id="acc-tab-ledger" onclick="VW_ACCOUNTS.switchAccountsTab('ledger',this)">
      <span class="et-icon">📒</span>Party Ledger
    </button>
    <button class="entry-type-btn" id="acc-tab-gst" onclick="VW_ACCOUNTS.switchAccountsTab('gst',this)">
      <span class="et-icon">📊</span>GST
    </button>
  </div>
  <div id="accounts-tab-content">
    ${await VW_DISPATCH.renderAccountsQueue()}
  </div>`;
}

async function switchAccountsTab(tab, btn) {
  document.querySelectorAll('.entry-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('accounts-tab-content');
  if (!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  switch(tab) {
    case 'verify':  container.innerHTML = await VW_DISPATCH.renderAccountsQueue(); break;
    case 'petty':   container.innerHTML = await renderPettyCash(); break;
    case 'vouchers': container.innerHTML = await renderVouchers(); break;
    case 'ledger':  container.innerHTML = await renderPartyLedger(); break;
    case 'gst':     container.innerHTML = await renderGSTSummary(); break;
  }
}

// ===== PETTY CASH =====
async function renderPettyCash() {
  const entries = await VW_DB.all(VW_DB.STORES.pettyCash);
  const sorted = [...entries].sort((a,b) => new Date(b.date) - new Date(a.date));
  const today = new Date().toDateString();
  const todayEntries = sorted.filter(e => new Date(e.date).toDateString() === today);
  const balance = entries.reduce((s,e) => s + (e.type==='in' ? (e.amount||0) : -(e.amount||0)), 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthOut = entries.filter(e => e.type==='out' && new Date(e.date)>=monthStart).reduce((s,e)=>s+(e.amount||0),0);
  const isAdmin = VW_AUTH.isAdmin();

  return `
  <div class="card" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:22px;font-weight:700;color:${balance>=0?'#22c55e':'var(--red)'}">₹${Math.round(balance).toLocaleString('en-IN')}</div>
        <div style="font-size:12px;color:var(--text3)">Cash Balance</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:600;color:var(--red)">₹${Math.round(monthOut).toLocaleString('en-IN')}</div>
        <div style="font-size:12px;color:var(--text3)">Month Expenses</div>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" style="flex:1" onclick="VW_ACCOUNTS.showAddPettyCash('in')">+ Cash In</button>
      <button class="btn-secondary" style="flex:1;color:var(--red)" onclick="VW_ACCOUNTS.showAddPettyCash('out')">− Cash Out</button>
      <button class="btn-secondary" onclick="VW_ACCOUNTS.printPettyCash()">🖨</button>
    </div>
  </div>

  <div class="card">
    <h3 class="card-title">Recent Entries</h3>
    ${!sorted.length ? '<p class="empty-msg">No petty cash entries yet</p>' :
    sorted.slice(0,30).map(e => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${e.description||e.category||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${e.category||'Misc'} · ${new Date(e.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · ${e.addedByName||'—'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-weight:700;color:${e.type==='in'?'#22c55e':'var(--red)'}">
            ${e.type==='in'?'+':'−'}₹${(e.amount||0).toLocaleString('en-IN')}
          </div>
          ${e.type==='out'?`<button onclick="VW_ACCOUNTS.printPettyCashSlip(${e.id})" title="Print receipt for receiver" style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text3)">🖨</button>`:''}
        </div>
      </div>`).join('')}
  </div>`;
}

async function showAddPettyCash(type) {
  const categories = type === 'in'
    ? ['Opening Balance','Cash Sale','Owner Deposit','Other Income']
    : ['Tea/Refreshments','Auto/Travel','Stationery','Cleaning','Maintenance','Phone Bill','Advance to Staff','Miscellaneous'];
  const profile = VW_AUTH.getCurrentProfile();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${type==='in'?'💵 Cash In':'💸 Cash Out'}</h3>
    <div class="form-group"><label>Amount (₹) *</label><input type="number" id="pc-amount" min="1" placeholder="e.g. 500"></div>
    <div class="form-group"><label>Category *</label>
      <select id="pc-category">
        ${categories.map(c=>`<option>${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Description</label><input type="text" id="pc-desc" placeholder="e.g. Chai for staff, 10 persons"></div>
    <div class="form-group"><label>Date</label><input type="date" id="pc-date" value="${new Date().toISOString().split('T')[0]}"></div>
    <button class="btn-primary full-width" onclick="VW_ACCOUNTS.savePettyCash('${type}')">Save Entry</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function savePettyCash(type) {
  if (window._pcSaving) return; window._pcSaving = true;
  try {
  const amount = parseFloat(document.getElementById('pc-amount')?.value)||0;
  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.pettyCash, {
    type, amount,
    category: document.getElementById('pc-category')?.value||'Misc',
    description: document.getElementById('pc-desc')?.value.trim()||'',
    date: document.getElementById('pc-date')?.value || new Date().toISOString().split('T')[0],
    addedByName: profile?.name||'',
    createdAt: new Date().toISOString()
  });
  showToast(`₹${amount.toLocaleString('en-IN')} ${type==='in'?'cash in':'expense'} recorded`, 'success');
  closeSheet();
  const container = document.getElementById('accounts-tab-content');
  if (container) container.innerHTML = await renderPettyCash();
  } finally { window._pcSaving = false; }
}

// ===== PAYMENT VOUCHERS =====
async function renderVouchers() {
  const vouchers = await VW_DB.all(VW_DB.STORES.paymentVouchers);
  const sorted = [...vouchers].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const pending = sorted.filter(v => v.status === 'pending');
  const approved = sorted.filter(v => v.status === 'approved').slice(0,10);
  const isAdmin = VW_AUTH.isAdmin();

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <h3 style="margin:0">Payment Vouchers</h3>
    <button class="btn-sm" onclick="VW_ACCOUNTS.showAddVoucher()">+ New</button>
  </div>

  ${pending.length ? `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Pending Approval <span class="badge">${pending.length}</span></h3>
    ${pending.map(v => `
      <div class="task-card">
        <div class="task-card-header">
          <span class="task-dept">${v.voucherNo}</span>
          <span style="font-weight:700;color:var(--gold)">₹${(v.amount||0).toLocaleString('en-IN')}</span>
        </div>
        <div style="font-size:12px;color:var(--text3)">${v.payTo} · ${v.purpose||'—'}</div>
        <div style="font-size:11px;color:var(--text3)">${new Date(v.createdAt).toLocaleDateString('en-IN')} · By ${v.createdByName||'—'}</div>
        ${isAdmin ? `
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn-sm" style="background:#22c55e;color:#fff" onclick="VW_ACCOUNTS.approveVoucher(${v.id})">✓ Approve</button>
          <button class="btn-sm" style="color:var(--red)" onclick="VW_ACCOUNTS.rejectVoucher(${v.id})">✕ Reject</button>
          <button class="btn-sm" onclick="VW_ACCOUNTS.printVoucher(${v.id})">🖨</button>
        </div>` : ''}
      </div>`).join('')}
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">Recent Vouchers</h3>
    ${!approved.length && !sorted.length ? '<p class="empty-msg">No vouchers yet</p>' :
    (approved.length ? approved : []).map(v => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div>
          <div style="font-size:13px;font-weight:600">${v.voucherNo} · ${v.payTo}</div>
          <div style="font-size:11px;color:var(--text3)">${v.purpose||'—'} · ${new Date(v.createdAt).toLocaleDateString('en-IN')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;color:var(--red)">₹${(v.amount||0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px;color:#22c55e">✓ Approved</div>
        </div>
      </div>`).join('')}
  </div>`;
}

async function showAddVoucher() {
  const profile = VW_AUTH.getCurrentProfile();
  const vendors = await VW_DB.all(VW_DB.STORES.vendors);
  const voucherCount = (await VW_DB.all(VW_DB.STORES.paymentVouchers)).length + 1;
  const fy = getFinancialYearLabel();
  const voucherNo = `PV/${fy}/${String(voucherCount).padStart(4,'0')}`;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Payment Voucher</h3>
    <p class="sheet-meta">${voucherNo} · Requires Admin approval</p>
    <div class="form-group"><label>Pay To *</label>
      <input type="text" id="pv-payto" list="pv-payto-list" placeholder="e.g. Ramesh Tiles, or pick vendor">
      <datalist id="pv-payto-list">${vendors.map(v=>`<option value="${v.name}">`).join('')}</datalist>
    </div>
    <div class="form-group"><label>Amount (₹) *</label><input type="number" id="pv-amount" min="1"></div>
    <div class="form-group"><label>Payment Mode</label>
      <select id="pv-mode">
        <option>Cash</option><option>Bank Transfer (NEFT/IMPS)</option><option>Cheque</option><option>UPI</option>
      </select>
    </div>
    <div class="form-group"><label>Purpose / Description *</label><input type="text" id="pv-purpose" placeholder="e.g. Stock purchase advance, Rent May 2026"></div>
    <div class="form-group"><label>Reference / Bill No.</label><input type="text" id="pv-ref" placeholder="e.g. Vendor invoice no."></div>
    <button class="btn-primary full-width" onclick="VW_ACCOUNTS.saveVoucher('${voucherNo}')">Submit for Approval</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveVoucher(voucherNo) {
  if (window._voucherSaving) return; window._voucherSaving = true;
  try {
  const payTo = document.getElementById('pv-payto')?.value.trim();
  const amount = parseFloat(document.getElementById('pv-amount')?.value)||0;
  const purpose = document.getElementById('pv-purpose')?.value.trim();
  if (!payTo) { showToast('Enter who to pay', 'warn'); return; }
  if (!amount) { showToast('Enter amount', 'warn'); return; }
  if (!purpose) { showToast('Enter purpose', 'warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.paymentVouchers, {
    voucherNo, payTo, amount,
    paymentMode: document.getElementById('pv-mode')?.value||'Cash',
    purpose,
    reference: document.getElementById('pv-ref')?.value.trim()||'',
    status: VW_AUTH.isAdmin() ? 'approved' : 'pending',
    createdByName: profile?.name||'',
    createdAt: new Date().toISOString()
  });
  showToast(`Voucher ${voucherNo} ${VW_AUTH.isAdmin()?'created & approved':'submitted for approval'}`, 'success');
  closeSheet();
  const container = document.getElementById('accounts-tab-content');
  if (container) container.innerHTML = await renderVouchers();
  } finally { window._voucherSaving = false; }
}

async function approveVoucher(id) {
  const v = await VW_DB.getById(VW_DB.STORES.paymentVouchers, id);
  if (!v) return;
  v.status = 'approved';
  v.approvedByName = VW_AUTH.getCurrentProfile()?.name||'';
  v.approvedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.paymentVouchers, v);
  showToast('Voucher approved', 'success');
  const container = document.getElementById('accounts-tab-content');
  if (container) container.innerHTML = await renderVouchers();
}

async function rejectVoucher(id) {
  const v = await VW_DB.getById(VW_DB.STORES.paymentVouchers, id);
  if (!v) return;
  v.status = 'rejected';
  v.approvedByName = VW_AUTH.getCurrentProfile()?.name||'';
  await VW_DB.put(VW_DB.STORES.paymentVouchers, v);
  showToast('Voucher rejected', 'info');
  const container = document.getElementById('accounts-tab-content');
  if (container) container.innerHTML = await renderVouchers();
}

// ===== PARTY LEDGER =====
async function renderPartyLedger() {
  const [customers, invoices, vendors, pos] = await Promise.all([
    VW_DB.all(VW_DB.STORES.customers),
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.vendors),
    VW_DB.all(VW_DB.STORES.purchaseOrders)
  ]);

  // Customer ledger — who owes us money (unpaid credit sales)
  const creditByCustomer = {};
  invoices.filter(i => i.creditSale && !i.paymentVerified && i.approvalStatus === 'approved').forEach(i => {
    if (!creditByCustomer[i.customerId]) creditByCustomer[i.customerId] = { name: '', total: 0, count: 0 };
    const cust = customers.find(c => c.id === i.customerId);
    creditByCustomer[i.customerId].name = cust?.name || 'Unknown';
    creditByCustomer[i.customerId].phone = cust?.phone || '';
    creditByCustomer[i.customerId].total += i.total||0;
    creditByCustomer[i.customerId].count++;
    creditByCustomer[i.customerId].customerId = i.customerId;
  });
  const creditEntries = Object.values(creditByCustomer).sort((a,b) => b.total - a.total);
  const totalReceivable = creditEntries.reduce((s,e) => s+e.total, 0);

  // Vendor ledger — open POs (what we might owe vendors)
  const openPOs = pos.filter(p => p.status === 'sent').sort((a,b) => b.totalValue - a.totalValue);
  const totalPayable = openPOs.reduce((s,p) => s+(p.totalValue||0), 0);

  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
    <div style="padding:12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;text-align:center">
      <div style="font-size:18px;font-weight:700;color:#22c55e">₹${Math.round(totalReceivable/1000)}K</div>
      <div style="font-size:12px;color:var(--text3)">To Receive (Customers)</div>
    </div>
    <div style="padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;text-align:center">
      <div style="font-size:18px;font-weight:700;color:var(--red)">₹${Math.round(totalPayable/1000)}K</div>
      <div style="font-size:12px;color:var(--text3)">To Pay (Vendors)</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Receivables — Credit Sales Outstanding <span class="badge">${creditEntries.length}</span></h3>
    ${!creditEntries.length ? '<p class="empty-msg">No outstanding credit sales ✓</p>' :
    creditEntries.map(e => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div>
          <div style="font-size:13px;font-weight:600">${e.name}</div>
          <div style="font-size:12px;color:var(--text3)">${e.count} invoice${e.count>1?'s':''} unpaid · ${e.phone||'—'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;color:var(--red)">₹${Math.round(e.total).toLocaleString('en-IN')}</div>
          ${e.phone ? `<a href="https://wa.me/91${e.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hi, a friendly reminder about your outstanding amount of ₹'+Math.round(e.total).toLocaleString('en-IN')+' with V Wholesale. Please arrange payment at your earliest convenience. Thank you!')}" target="_blank" style="font-size:11px;color:#22c55e">💬 Remind</a>` : ''}
        </div>
      </div>`).join('')}
  </div>

  <div class="card">
    <h3 class="card-title">Payables — Open Vendor POs <span class="badge">${openPOs.length}</span></h3>
    ${!openPOs.length ? '<p class="empty-msg">No open purchase orders ✓</p>' :
    openPOs.map(po => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div>
          <div style="font-size:13px;font-weight:600">${po.vendorName}</div>
          <div style="font-size:12px;color:var(--text3)">${po.poNo} · ${po.items?.length||0} items</div>
        </div>
        <div style="font-weight:700;color:var(--gold)">₹${(po.totalValue||0).toLocaleString('en-IN')}</div>
      </div>`).join('')}
  </div>`;
}

// ===== GST SUMMARY & EXPORT =====
async function renderGSTSummary() {
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthInvoices = invoices.filter(i =>
    new Date(i.date) >= monthStart && i.approvalStatus === 'approved'
  );

  // Group by GST rate
  const gstSlabs = {};
  monthInvoices.forEach(inv => {
    (inv.items||[]).forEach(item => {
      if (item.isFreeGift) return;
      const rate = item.gst || 18;
      if (!gstSlabs[rate]) gstSlabs[rate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
      const inclPrice = item.price * item.qty;
      const taxable = inclPrice / (1 + rate/100);
      const gstAmt = inclPrice - taxable;
      gstSlabs[rate].taxable += taxable;
      gstSlabs[rate].cgst += gstAmt / 2;
      gstSlabs[rate].sgst += gstAmt / 2;
      gstSlabs[rate].total += inclPrice;
    });
  });

  const totalTaxable = Object.values(gstSlabs).reduce((s,g) => s+g.taxable, 0);
  const totalGST = Object.values(gstSlabs).reduce((s,g) => s+g.cgst+g.sgst, 0);

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">GST Summary — ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="padding:10px;background:var(--bg2);border-radius:8px;text-align:center">
        <div style="font-size:16px;font-weight:700">₹${Math.round(totalTaxable).toLocaleString('en-IN')}</div>
        <div style="font-size:12px;color:var(--text3)">Total Taxable Value</div>
      </div>
      <div style="padding:10px;background:var(--bg2);border-radius:8px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:var(--gold)">₹${Math.round(totalGST).toLocaleString('en-IN')}</div>
        <div style="font-size:12px;color:var(--text3)">Total GST Collected</div>
      </div>
    </div>
    ${Object.entries(gstSlabs).sort((a,b)=>b[0]-a[0]).map(([rate, vals]) => `
    <div style="padding:8px;background:var(--bg2);border-radius:6px;margin-bottom:6px">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px">${rate}% GST Slab</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text3)">
        <span>Taxable: ₹${Math.round(vals.taxable).toLocaleString('en-IN')}</span>
        <span>CGST: ₹${Math.round(vals.cgst).toLocaleString('en-IN')}</span>
        <span>SGST: ₹${Math.round(vals.sgst).toLocaleString('en-IN')}</span>
      </div>
    </div>`).join('')}
    <p style="font-size:11px;color:var(--text3);margin-top:8px">GST calculated on GST-inclusive prices using back-calculation. Verify with your CA before filing.</p>
  </div>

  <div class="card">
    <h3 class="card-title">Export for CA / Filing</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Download invoice-wise data for GSTR-1 preparation. Share with your Chartered Accountant.</p>
    <button class="btn-primary full-width" onclick="VW_ACCOUNTS.exportGSTData()">📥 Download GSTR-1 Data (Excel)</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_ACCOUNTS.exportFullLedger()">📥 Download Full Invoice Ledger</button>
  </div>`;
}

async function exportGSTData() {
  showToast('Preparing GST export...', 'info');
  const [invoices, customers] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.customers)
  ]);
  const custMap = {}; customers.forEach(c => custMap[c.id] = c);
  const approved = invoices.filter(i => i.approvalStatus === 'approved');

  const rows = [];
  approved.forEach(inv => {
    const cust = custMap[inv.customerId];
    (inv.items||[]).forEach(item => {
      if (item.isFreeGift) return;
      const rate = item.gst || 18;
      const inclPrice = item.price * item.qty;
      const taxable = inclPrice / (1 + rate/100);
      const gstAmt = inclPrice - taxable;
      rows.push({
        InvoiceNo: inv.invoiceNo,
        Date: (inv.date||'').split('T')[0],
        CustomerName: cust?.name || 'Walk-in',
        CustomerPhone: cust?.phone || '',
        CustomerGST: cust?.gstNo || '',
        ItemName: item.name,
        Qty: item.qty,
        Unit: item.unit||'pc',
        RateInclGST: item.price,
        GSTRate: rate,
        TaxableValue: Math.round(taxable),
        CGST: Math.round(gstAmt/2),
        SGST: Math.round(gstAmt/2),
        TotalInclGST: Math.round(inclPrice),
        PaymentMethod: inv.paymentMethod||'',
        CreditSale: inv.creditSale ? 'Yes' : 'No'
      });
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'GSTR-1 Data');
  XLSX.writeFile(wb, `VWholesale-GSTR1-${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('GST data exported', 'success');
}

async function exportFullLedger() {
  showToast('Preparing full ledger...', 'info');
  const [invoices, customers, returns, pettyCash, vouchers] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.customers),
    VW_DB.all(VW_DB.STORES.salesReturns),
    VW_DB.all(VW_DB.STORES.pettyCash),
    VW_DB.all(VW_DB.STORES.paymentVouchers)
  ]);
  const custMap = {}; customers.forEach(c => custMap[c.id] = c);

  const wb = XLSX.utils.book_new();

  // Invoices sheet
  const invRows = invoices.filter(i=>i.approvalStatus==='approved').map(i => ({
    InvoiceNo: i.invoiceNo,
    Date: (i.date||'').split('T')[0],
    Customer: custMap[i.customerId]?.name||'Walk-in',
    Phone: custMap[i.customerId]?.phone||'',
    Subtotal: i.subtotal||0,
    GST: i.gstAmt||0,
    Total: i.total||0,
    CashDiscount: i.cashDiscountAmt||0,
    PaymentMethod: i.paymentMethod||'',
    CreditSale: i.creditSale?'Yes':'No',
    PaymentVerified: i.paymentVerified?'Yes':'No',
    SalesExecutive: i.salesExecutiveName||''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), 'Invoices');

  // Returns sheet
  const retRows = returns.map(r => ({
    CreditNoteNo: r.creditNoteNo||'', Date: (r.createdAt||'').split('T')[0],
    Customer: custMap[r.customerId]?.name||'', RefundAmt: r.totalRefund||0,
    RefundMethod: r.refundMethod||'', InvoiceRef: r.invoiceNo||''
  }));
  if (retRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(retRows), 'Returns');

  // Petty Cash sheet
  const pcRows = pettyCash.map(e => ({
    Date: e.date||'', Type: e.type==='in'?'Cash In':'Cash Out',
    Category: e.category||'', Description: e.description||'',
    Amount: e.type==='in'?e.amount:-(e.amount||0), By: e.addedByName||''
  }));
  if (pcRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pcRows), 'Petty Cash');

  // Vouchers sheet
  const pvRows = vouchers.map(v => ({
    VoucherNo: v.voucherNo||'', Date: (v.createdAt||'').split('T')[0],
    PayTo: v.payTo||'', Amount: v.amount||0, Mode: v.paymentMode||'',
    Purpose: v.purpose||'', Status: v.status||'', By: v.createdByName||''
  }));
  if (pvRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pvRows), 'Vouchers');

  XLSX.writeFile(wb, `VWholesale-FullLedger-${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Full ledger exported', 'success');
}

window.VW_ACCOUNTS = {
  renderAccountsPage, switchAccountsTab,
  showAddPettyCash, savePettyCash,
  showAddVoucher, saveVoucher, approveVoucher, rejectVoucher,
  exportGSTData, exportFullLedger,
  printPettyCash, printVoucher
};

async function printPettyCashSlip(entryId) {
  const entries = await VW_DB.all(VW_DB.STORES.pettyCash);
  const e = entries.find(x => x.id === entryId);
  if (!e) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Petty Cash Slip</title>
  <style>
    body{font-family:Arial,sans-serif;margin:30px;color:#000;max-width:400px}
    h2{font-size:16px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:16px}
    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}
    .amount{font-size:28px;font-weight:700;text-align:center;margin:20px 0;padding:12px;border:2px solid #000;border-radius:6px}
    .sign-section{margin-top:40px}
    .sign-row{display:flex;justify-content:space-between;margin-top:30px}
    .sign-box{width:45%}
    .sign-line{border-top:1px solid #000;margin-bottom:6px;height:35px}
    .sign-label{font-size:11px;text-align:center}
    @media print{body{margin:10px}}
  </style></head><body>
  <h2>Vassure Wholesale Pvt. Ltd. — Petty Cash Receipt</h2>
  <div class="row"><span>Receipt No.</span><span>PC-${e.id}</span></div>
  <div class="row"><span>Date</span><span>${new Date(e.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span></div>
  <div class="row"><span>Category</span><span>${e.category||'Misc'}</span></div>
  <div class="row"><span>Description</span><span>${e.description||'—'}</span></div>
  <div class="row"><span>Paid By</span><span>${e.addedByName||'—'}</span></div>
  <div class="amount">₹${Math.round(e.amount||0).toLocaleString('en-IN')}</div>
  <div style="font-size:12px;text-align:center;color:#888">Cash Out — ${new Date(e.date).toLocaleDateString('en-IN')}</div>
  <div class="sign-section">
    <div class="sign-row">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-label">Paid By / Authorised</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-label">Receiver Signature</div>
      </div>
    </div>
    <div style="margin-top:20px;font-size:11px;color:#888;text-align:center">
      V Wholesale, Visit V Wholesale · This is a petty cash receipt
    </div>
  </div>
  </body></html>`);
  win.document.close();
  win.print();
}

window.VW_ACCOUNTS.printPettyCashSlip = printPettyCashSlip;

async function printPettyCash() {
  const entries = await VW_DB.all(VW_DB.STORES.pettyCash);
  const sorted = [...entries].sort((a,b) => new Date(b.date)-new Date(a.date));
  const balance = entries.reduce((s,e) => s+(e.type==='in'?(e.amount||0):-(e.amount||0)),0);
  const now = new Date();
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Petty Cash Register — V Wholesale</title>
  <style>body{font-family:Arial,sans-serif;margin:20px;color:#000}h2{font-size:18px;margin-bottom:4px}
  .sub{font-size:12px;color:var(--text3);margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#f0f0f0;padding:8px;text-align:left;border:1px solid #ddd}
  td{padding:7px 8px;border:1px solid #ddd}
  .in{color:green;font-weight:600}.out{color:red;font-weight:600}
  .balance{font-size:15px;font-weight:700;margin-top:16px}
  .sign{margin-top:40px;display:flex;justify-content:space-between}
  .sign-box{text-align:center;width:180px}
  .sign-line{border-top:1px solid #000;margin-bottom:4px;height:40px}
  @media print{body{margin:0}}
  </style></head><body>
  <h2>Vassure Wholesale Pvt Ltd — Petty Cash Register</h2>
  <div class="sub">Printed: ${now.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})} · V Wholesale, Vijayawada</div>
  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Added By</th><th>Cash In</th><th>Cash Out</th></tr></thead>
    <tbody>
      ${sorted.map(e=>`<tr>
        <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
        <td>${e.category||'—'}</td>
        <td>${e.description||'—'}</td>
        <td>${e.addedByName||'—'}</td>
        <td class="in">${e.type==='in'?'₹'+e.amount.toLocaleString('en-IN'):''}</td>
        <td class="out">${e.type==='out'?'₹'+e.amount.toLocaleString('en-IN'):''}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="balance">Balance: ₹${Math.round(balance).toLocaleString('en-IN')}</div>
  <div class="sign">
    <div class="sign-box"><div class="sign-line"></div><div style="font-size:12px">Prepared By</div></div>
    <div class="sign-box"><div class="sign-line"></div><div style="font-size:12px">Verified By</div></div>
    <div class="sign-box"><div class="sign-line"></div><div style="font-size:12px">Authorised By</div></div>
  </div>
  </body></html>`);
  win.document.close();
  win.print();
}

async function printVoucher(voucherId) {
  const vouchers = await VW_DB.all(VW_DB.STORES.paymentVouchers);
  const v = voucherId ? vouchers.find(x=>x.id===voucherId) : null;
  const items = v ? [v] : vouchers.filter(x=>x.status==='approved');
  const now = new Date();
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Payment Voucher — V Wholesale</title>
  <style>body{font-family:Arial,sans-serif;margin:20px;color:#000}
  .voucher{border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:20px;page-break-inside:avoid}
  h3{font-size:15px;margin-bottom:8px}
  .row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #eee}
  .amount{font-size:20px;font-weight:700;color:#c8972b;margin:10px 0}
  .sign{display:flex;justify-content:space-between;margin-top:30px}
  .sign-box{text-align:center;width:140px}
  .sign-line{border-top:1px solid #000;margin-bottom:4px;height:30px}
  @media print{body{margin:0}}
  </style></head><body>
  <h2 style="font-size:16px;margin-bottom:16px">Vassure Wholesale Pvt Ltd — Payment Voucher(s)</h2>
  ${items.map(v=>`
  <div class="voucher">
    <h3>Voucher #${v.id} — ${v.voucherType||'Payment'}</h3>
    <div class="row"><span>Pay To</span><span><strong>${v.payTo||'—'}</strong></span></div>
    <div class="row"><span>Date</span><span>${new Date(v.date||v.createdAt).toLocaleDateString('en-IN')}</span></div>
    <div class="row"><span>Mode</span><span>${v.paymentMode||'—'}</span></div>
    <div class="row"><span>Purpose</span><span>${v.purpose||'—'}</span></div>
    ${v.reference?`<div class="row"><span>Reference</span><span>${v.reference}</span></div>`:''}
    <div class="amount">₹${(v.amount||0).toLocaleString('en-IN')}</div>
    <div style="font-size:12px;color:#888">Created by: ${v.createdByName||'—'} · Status: ${v.status||'—'}</div>
    <div class="sign">
      <div class="sign-box"><div class="sign-line"></div><div style="font-size:11px">Prepared By</div></div>
      <div class="sign-box"><div class="sign-line"></div><div style="font-size:11px">Receiver Signature</div></div>
      <div class="sign-box"><div class="sign-line"></div><div style="font-size:11px">Authorised By</div></div>
    </div>
  </div>`).join('')}
  </body></html>`);
  win.document.close();
  win.print();
}




/* === field_team.js === */

// =====================================================
// V WHOLESALE — FIELD TEAM APP
// On-site order collection, GPS check-in/out,
// Customer visits tracking, follow-ups
// =====================================================

async function renderFieldTeamPage() {
  const profile = VW_AUTH.getCurrentProfile();
  const today = new Date().toISOString().split('T')[0];

  const { data: myVisits } = await VW_DB.client
    .from('field_visits')
    .select('*')
    .eq('executive_name', profile?.name || '')
    .gte('created_at', today + 'T00:00:00')
    .order('created_at', { ascending: false });

  const visits = myVisits || [];
  const checkedIn = visits.find(v => v.status === 'checked_in');
  const planned = visits.filter(v => v.status === 'planned');
  const completed = visits.filter(v => v.status === 'completed');

  const totalOrderValue = completed.reduce((s, v) => s + (v.order_value || 0), 0);

  return `
  <div class="module-header">
    <h2>🚗 Field Team</h2>
    <button class="btn-sm" onclick="VW_FIELD.newFieldVisit()">+ Visit</button>
  </div>

  <!-- TODAY STATS -->
  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card gold">
      <div class="mc-label">Today's Visits</div>
      <div class="mc-value">${visits.length}</div>
    </div>
    <div class="metric-card ${checkedIn?'success':''}">
      <div class="mc-label">Current Status</div>
      <div class="mc-value" style="font-size:16px">${checkedIn ? '📍 On Site' : '🏠 In Store'}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Completed</div>
      <div class="mc-value">${completed.length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Order Value</div>
      <div class="mc-value" style="font-size:16px">₹${Math.round(totalOrderValue/1000)}K</div>
    </div>
  </div>

  <!-- ACTIVE VISIT -->
  ${checkedIn ? `
  <div class="card" style="margin-bottom:12px;border-color:rgba(34,197,94,0.4);background:rgba(34,197,94,0.04)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="width:10px;height:10px;border-radius:50%;background:var(--green);animation:pulse 2s infinite"></div>
      <div style="font-size:14px;font-weight:700;color:var(--green)">Active Visit — On Site Now</div>
    </div>
    <div style="font-size:15px;font-weight:600;color:var(--text)">${checkedIn.customer_name || 'Unknown Customer'}</div>
    <div style="font-size:12px;color:var(--text3);margin-top:2px">${checkedIn.site_address || 'No address'} · ${checkedIn.visit_purpose}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:2px">Checked in: ${new Date(checkedIn.check_in_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn-primary" style="flex:1" onclick="VW_FIELD.checkOut(${checkedIn.id})">✓ Check Out</button>
      <button class="btn-secondary" onclick="VW_FIELD.openFieldVisit(${checkedIn.id})">📝 Add Notes</button>
    </div>
  </div>` : ''}

  <!-- PLANNED VISITS -->
  ${planned.length ? `
  <div class="card" style="margin-bottom:10px">
    <div class="card-header-row">
      <h3 class="card-title">📅 Today's Plan (${planned.length})</h3>
    </div>
    ${planned.map(v => renderFieldVisitRow(v)).join('')}
  </div>` : ''}

  <!-- ADD NEW VISIT -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Plan a Visit</h3>
    <button class="btn-primary full-width" onclick="VW_FIELD.newFieldVisit()">+ Add Customer Visit</button>
  </div>

  <!-- COMPLETED TODAY -->
  ${completed.length ? `
  <div class="card">
    <h3 class="card-title">✅ Completed Today (${completed.length})</h3>
    ${completed.map(v => renderFieldVisitRow(v)).join('')}
  </div>` : ''}`;
}

function renderFieldVisitRow(v) {
  const statusColors = {
    planned: 'var(--text3)',
    checked_in: 'var(--green)',
    completed: 'var(--blue)',
    cancelled: 'var(--red)'
  };
  const purposeIcons = {
    site_survey: '📐', follow_up: '📞', order_collection: '🛒',
    installation_check: '🔧', complaint: '⚠️'
  };
  return `
  <div onclick="VW_FIELD.openFieldVisit(${v.id})" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:16px">${purposeIcons[v.visit_purpose]||'🚗'}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text)">${v.customer_name||'Unknown'}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${v.site_address||''} · ${v.visit_purpose?.replace(/_/g,' ')}</div>
        ${v.notes?`<div style="font-size:12px;color:var(--text2);margin-top:2px">${v.notes.slice(0,60)}${v.notes.length>60?'...':''}</div>`:''}
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:10px">
        <span style="font-size:11px;color:${statusColors[v.status]};font-weight:600">${v.status.replace('_',' ').toUpperCase()}</span>
        ${v.order_value?`<div style="font-size:12px;color:var(--gold);margin-top:2px">₹${Math.round(v.order_value).toLocaleString('en-IN')}</div>`:''}
      </div>
    </div>
  </div>`;
}

async function newFieldVisit() {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="margin:0">Plan Field Visit</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div class="form-group"><label>Customer Phone</label>
      <input type="tel" id="fv-phone" placeholder="10-digit number" maxlength="10" oninput="VW_FIELD.lookupFieldCustomer(this.value)">
      <div id="fv-cust-status" style="font-size:12px;color:var(--text3);margin-top:4px"></div>
    </div>
    <div class="form-group"><label>Customer Name *</label>
      <input type="text" id="fv-cust-name" placeholder="Customer name" list="fv-cust-list">
      <datalist id="fv-cust-list">${customers.slice(0,50).map(c=>`<option value="${c.name}">`).join('')}</datalist>
    </div>
    <div class="form-group"><label>Site Address</label>
      <input type="text" id="fv-address" placeholder="e.g. Plot 12, Bhavanipuram Colony">
    </div>
    <div class="form-group"><label>Purpose</label>
      <select id="fv-purpose">
        <option value="site_survey">📐 Site Survey</option>
        <option value="follow_up">📞 Follow Up</option>
        <option value="order_collection">🛒 Order Collection</option>
        <option value="installation_check">🔧 Installation Check</option>
        <option value="complaint">⚠️ Complaint Visit</option>
      </select>
    </div>
    <div class="form-group"><label>Notes</label>
      <textarea id="fv-notes" placeholder="What to discuss, products to show..." style="height:60px"></textarea>
    </div>
    <button class="btn-primary full-width" onclick="VW_FIELD.saveFieldVisit()">Save Visit Plan</button>
    <button class="btn-wa full-width" style="margin-top:8px" onclick="VW_FIELD.saveAndCheckIn()">Save & Check In Now</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function lookupFieldCustomer(phone) {
  const el = document.getElementById('fv-cust-status');
  const nameInput = document.getElementById('fv-cust-name');
  if (!el || phone.length < 10) return;
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const match = customers.find(c => c.phone === phone);
  if (match) {
    el.innerHTML = `<span style="color:var(--green)">✓ ${match.name} · ${match.visitCount||0} visits · ₹${Math.round(match.totalSpend||0).toLocaleString('en-IN')} spent</span>`;
    if (nameInput && !nameInput.value) nameInput.value = match.name;
    window._fvCustomer = match;
  } else {
    el.innerHTML = `<span style="color:var(--text3)">New prospect</span>`;
    window._fvCustomer = null;
  }
}

async function saveFieldVisit(checkInNow = false) {
  const profile = VW_AUTH.getCurrentProfile();
  const name = document.getElementById('fv-cust-name')?.value.trim();
  if (!name) { showToast('Enter customer name', 'warn'); return; }

  const visitData = {
    executive_id: profile?.id || null,
    executive_name: profile?.name || '',
    customer_id: window._fvCustomer?.id || null,
    customer_name: name,
    customer_phone: document.getElementById('fv-phone')?.value.trim() || '',
    site_address: document.getElementById('fv-address')?.value.trim() || '',
    visit_purpose: document.getElementById('fv-purpose')?.value || 'follow_up',
    notes: document.getElementById('fv-notes')?.value.trim() || '',
    status: checkInNow ? 'checked_in' : 'planned',
    check_in_at: checkInNow ? new Date().toISOString() : null,
  };

  if (checkInNow) {
    // Get GPS
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
      visitData.check_in_lat = pos.coords.latitude;
      visitData.check_in_lng = pos.coords.longitude;
    } catch(e) { /* GPS unavailable */ }
  }

  const { data, error } = await VW_DB.client.from('field_visits').insert(visitData).select('id').single();
  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  closeSheet();
  showToast(checkInNow ? '📍 Checked in at site!' : '✓ Visit planned', 'success');
  navigateTo('field');
}

async function saveAndCheckIn() { await saveFieldVisit(true); }

async function checkOut(visitId) {
  const { data: visit } = await VW_DB.client.from('field_visits').select('*').eq('id', visitId).single();
  if (!visit) return;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Check Out — ${visit.customer_name}</h3>
    <div class="form-group"><label>Visit Outcome</label>
      <select id="co-outcome">
        <option value="order_placed">🛒 Order Placed</option>
        <option value="quote_given">📄 Quotation Given</option>
        <option value="follow_up_needed">📞 Follow-up Needed</option>
        <option value="not_interested">❌ Not Interested</option>
        <option value="already_bought">✓ Already Purchased Elsewhere</option>
      </select>
    </div>
    <div class="form-group"><label>Order Value (₹)</label>
      <input type="number" id="co-order-value" value="${visit.order_value||0}" min="0" placeholder="0 if no order">
    </div>
    <div class="form-group"><label>Next Action</label>
      <input type="text" id="co-next-action" placeholder="e.g. Call back in 3 days, send quotation">
    </div>
    <div class="form-group"><label>Next Action Date</label>
      <input type="date" id="co-next-date" value="${new Date(Date.now()+3*86400000).toISOString().split('T')[0]}">
    </div>
    <div class="form-group"><label>Summary Notes</label>
      <textarea id="co-notes" placeholder="What was discussed, customer interest level..." style="height:80px">${visit.notes||''}</textarea>
    </div>
    <button class="btn-primary full-width" onclick="VW_FIELD.confirmCheckOut(${visitId})">✓ Check Out & Save</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function confirmCheckOut(visitId) {
  const orderValue = parseFloat(document.getElementById('co-order-value')?.value || 0);
  const nextAction = document.getElementById('co-next-action')?.value.trim();
  const nextDate = document.getElementById('co-next-date')?.value;
  const notes = document.getElementById('co-notes')?.value.trim();
  const outcome = document.getElementById('co-outcome')?.value;

  // Get GPS
  let lat = null, lng = null;
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
    lat = pos.coords.latitude; lng = pos.coords.longitude;
  } catch(e) {}

  await VW_DB.client.from('field_visits').update({
    status: 'completed',
    check_out_at: new Date().toISOString(),
    check_in_lat: lat, check_in_lng: lng,
    order_value: orderValue,
    next_action: nextAction ? `${outcome}: ${nextAction}` : outcome,
    next_action_date: nextDate,
    notes,
  }).eq('id', visitId);

  // If order placed, add to CRM follow-up
  if (orderValue > 0 && nextAction) {
    const { data: visit } = await VW_DB.client.from('field_visits').select('customer_id,customer_name,executive_name,executive_id').eq('id', visitId).single();
    if (visit?.customer_id) {
      await VW_DB.client.from('tasks').insert({
        type: 'follow_up',
        customer_id: visit.customer_id,
        customer_name: visit.customer_name,
        assigned_to: visit.executive_id || null,
        assigned_to_name: visit.executive_name,
        description: `Field visit follow-up: ${nextAction}`,
        due_date: nextDate,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }
  }

  closeSheet();
  showToast('✓ Checked out — great work!', 'success');
  navigateTo('field');
}

async function openFieldVisit(visitId) {
  const { data: v } = await VW_DB.client.from('field_visits').select('*').eq('id', visitId).single();
  if (!v) return;
  const sheet = document.getElementById('bottom-sheet');
  const purposeLabels = { site_survey:'Site Survey', follow_up:'Follow Up', order_collection:'Order Collection', installation_check:'Installation Check', complaint:'Complaint' };

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="margin:0">${v.customer_name}</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">${purposeLabels[v.visit_purpose]||v.visit_purpose} · ${v.status?.toUpperCase()} · ${new Date(v.created_at).toLocaleDateString('en-IN')}</div>
    ${v.site_address?`<div style="font-size:13px;color:var(--text2);margin-bottom:8px">📍 ${v.site_address}</div>`:''}
    ${v.notes?`<div style="font-size:13px;color:var(--text);background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:10px">${v.notes}</div>`:''}
    ${v.order_value?`<div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:8px">₹${Math.round(v.order_value).toLocaleString('en-IN')} Order</div>`:''}
    ${v.next_action?`<div style="font-size:12px;color:var(--text2)">Next: ${v.next_action} · ${v.next_action_date||''}</div>`:''}
    <div style="display:flex;gap:8px;margin-top:14px">
      ${v.status==='planned'?`<button class="btn-primary" style="flex:1" onclick="closeSheet();VW_FIELD.checkIn(${v.id})">📍 Check In Now</button>`:''}
      ${v.status==='checked_in'?`<button class="btn-primary" style="flex:1" onclick="closeSheet();VW_FIELD.checkOut(${v.id})">✓ Check Out</button>`:''}
      ${v.customer_phone?`<button class="btn-wa" onclick="window.open('tel:${v.customer_phone}')">📞</button>`:''}
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function checkIn(visitId) {
  let lat = null, lng = null;
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
    lat = pos.coords.latitude; lng = pos.coords.longitude;
    showToast(`📍 GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
  } catch(e) { showToast('GPS unavailable — checking in without location', 'warn'); }

  await VW_DB.client.from('field_visits').update({
    status: 'checked_in',
    check_in_at: new Date().toISOString(),
    check_in_lat: lat, check_in_lng: lng
  }).eq('id', visitId);

  showToast('📍 Checked in at site!', 'success');
  navigateTo('field');
}

window.VW_FIELD = {
  renderFieldTeamPage, newFieldVisit, lookupFieldCustomer,
  saveFieldVisit, saveAndCheckIn, checkIn, checkOut,
  confirmCheckOut, openFieldVisit
};






// ── STAFF GREETINGS (HR Tab) ──
async function renderStaffGreetings() {
  const { data: allStaff } = await VW_DB.client.from('profiles')
    .select('id, name, phone, role, dob, anniversary')
    .not('role', 'in', '("customer","contractor","pending")')
    .order('name')
    .then(r=>r, ()=>({data:[]}));

  const today = new Date();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  const todayMD = `${mm}-${dd}`;
  const next7 = [];
  for (let i=1; i<=30; i++) {
    const d = new Date(today); d.setDate(today.getDate()+i);
    next7.push(`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }

  const todayBdays = (allStaff||[]).filter(s => s.dob && s.dob.slice(5,10) === todayMD);
  const todayAnns = (allStaff||[]).filter(s => s.anniversary && s.anniversary.slice(5,10) === todayMD);
  const upcomingBdays = (allStaff||[]).filter(s => s.dob && next7.includes(s.dob.slice(5,10)) && s.dob.slice(5,10) !== todayMD);
  const noDate = (allStaff||[]).filter(s => !s.dob && !s.anniversary);

  return `<div style="padding:4px">
    <!-- Today -->
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase">🎉 Today — ${dd}/${mm}</div>
      ${todayBdays.length === 0 && todayAnns.length === 0
        ? '<div style="color:var(--text3);font-size:13px;padding:12px 0">No birthdays or anniversaries today</div>'
        : [...todayBdays.map(p=>({...p,type:'birthday'})), ...todayAnns.map(p=>({...p,type:'anniversary'}))].map(p=>`
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
        <div style="font-size:32px">${p.type==='birthday'?'🎂':'💑'}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">${p.name}</div>
          <div style="font-size:12px;color:var(--text3)">${p.role} ${p.phone?'· '+p.phone:''}</div>
          <div style="font-size:11px;color:var(--gold)">${p.type==='birthday'?'Birthday today!':'Work Anniversary today!'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn-sm" onclick="VW_HR_PAYROLL.generateStaffGreeting('${(p.name||'').replace(/'/g,"\'")}','${p.type}','${p.phone||''}')">🎨 Generate Card</button>
        </div>
      </div>`).join('')
      }
    </div>

    <!-- Upcoming 30 days -->
    ${upcomingBdays.length ? `<div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase">📅 Upcoming Birthdays (30 days)</div>
      <div style="display:grid;gap:6px">
        ${upcomingBdays.map(p => {
          const dmd = p.dob.slice(5,10);
          const daysAway = next7.indexOf(dmd)+1;
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">
            <div style="font-size:20px">🎂</div>
            <div style="flex:1"><div style="font-size:13px;font-weight:600">${p.name}</div>
            <div style="font-size:11px;color:var(--text3)">${p.role} · ${p.dob.split('-').reverse().slice(0,2).join('/')}</div></div>
            <span style="font-size:11px;font-weight:700;color:var(--gold)">in ${daysAway} day${daysAway>1?'s':''}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Add DOB to staff -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">➕ Add DOB / Anniversary to Staff Member</div>
      <div style="margin-bottom:8px">
        <select id="hr-greet-staff" class="form-input" style="width:100%">
          <option value="">Select staff member…</option>
          ${(allStaff||[]).map(s=>`<option value="${s.id}" data-dob="${s.dob||''}" data-ann="${s.anniversary||''}">${s.name} (${s.role})</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:3px">Date of Birth</label>
          <input type="date" id="hr-greet-dob" class="form-input">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:3px">Work Anniversary</label>
          <input type="date" id="hr-greet-ann" class="form-input">
        </div>
      </div>
      <button class="btn-primary full-width" onclick="VW_HR_PAYROLL.saveStaffDates()">💾 Save Dates</button>
    </div>

    <!-- Staff without dates -->
    ${noDate.length ? `<div>
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase">⚠️ Staff Missing DOB (${noDate.length})</div>
      <div style="font-size:12px;color:var(--text3)">${noDate.map(s=>s.name).join(', ')}</div>
    </div>` : ''}
  </div>`;
}
window.renderStaffGreetings = renderStaffGreetings;

async function generateStaffGreeting(name, type, phone) {
  showToast('🎨 Generating greeting card…', 'info');
  const SB_URL = 'https://ndamdnlsuktucqtcbhgp.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYW1kbmxzdWt0dWNxdGNiaGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTg1MzgsImV4cCI6MjA5Njk5NDUzOH0.7pGJu4bbNhl4E-4Do24jS9_p6nLUa1eN4JXQSqEF9VU';

  const res = await fetch(`${SB_URL}/functions/v1/generate-poster`, {
    method:'POST', headers:{'Content-Type':'application/json','apikey':SB_KEY},
    body:JSON.stringify({
      topic: type==='birthday' ? `Happy Birthday ${name} — from the V Wholesale family` : `Happy Work Anniversary ${name} — thank you for your dedication`,
      template: 'festival', language: 'en',
      business_name: 'V Wholesale', phone: '8712697930',
      website: 'vwholesale.in', address: 'Visit V Wholesale',
      tagline: type==='birthday' ? 'Wishing you joy and success!' : 'Thank you for being part of our journey!'
    })
  });
  const data = await res.json();
  if (!data.ok) { showToast('❌ Generation failed: '+data.error, 'error'); return; }

  // Show card in modal
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML = `<div style="background:#1e293b;border-radius:16px;width:100%;max-width:420px;overflow:hidden">
    <div style="background:#0A1628;padding:14px;display:flex;justify-content:space-between;align-items:center">
      <div style="color:#fff;font-size:14px;font-weight:700">${type==='birthday'?'🎂':'💑'} ${name}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <img src="data:image/png;base64,${data.image_b64}" style="width:100%;display:block">
    <div style="padding:14px;display:grid;gap:8px">
      <button onclick="(()=>{const a=document.createElement('a');a.download='${name.replace(/\s/g,'-')}-${type}.png';a.href='data:image/png;base64,${data.image_b64}';a.click()})()" style="width:100%;padding:12px;background:var(--accent,#c9a84c);border:none;border-radius:8px;color:#000;font-size:13px;font-weight:700;cursor:pointer">⬇ Download & Share on WhatsApp</button>
      ${phone?`<a href="https://wa.me/91${phone.replace(/\D/g,'')}" target="_blank" style="display:block;padding:12px;background:#25D366;border-radius:8px;text-align:center;color:#fff;font-size:13px;font-weight:700;text-decoration:none">💬 Open ${name}'s WhatsApp</a>`:''}
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
}
window.generateStaffGreeting = generateStaffGreeting;

async function saveStaffDates() {
  const sel = document.getElementById('hr-greet-staff');
  const id = sel?.value;
  if (!id) { showToast('Select a staff member', 'warning'); return; }
  const dob = document.getElementById('hr-greet-dob')?.value || null;
  const ann = document.getElementById('hr-greet-ann')?.value || null;
  const { error } = await VW_DB.client.from('profiles').update({ dob, anniversary: ann }).eq('id', id);
  if (error) { showToast('❌ '+error.message, 'error'); return; }
  showToast('✅ Dates saved!', 'success');
  // Refresh greetings tab
  const container = document.getElementById('hr-tab-content');
  if (container) container.innerHTML = await renderStaffGreetings();
}
window.saveStaffDates = saveStaffDates;
