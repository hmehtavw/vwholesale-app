// ============================================================
// V WHOLESALE — HR SELF-SERVICE MODULE (hr.js)
// Staff portal: My HR, Leaves, Salary, KPIs, Achievements,
//               Advances, Documents, Profile
// Admin: Payroll run, Incentive calc, Advance approvals
// ============================================================

const VW_HR_SELF = (() => {

// ── INCENTIVE CALCULATOR ──────────────────────────────────
function calcIncentive(slab, salesAmount) {
  if (!slab || !salesAmount || salesAmount < slab.min_target) return 0;
  const excess = salesAmount - slab.min_target;
  const slabs = slab.slabs || [];
  let pct = 0;
  for (const s of slabs) {
    if (salesAmount >= s.from && salesAmount < s.to) { pct = s.pct / 100; break; }
    if (salesAmount >= s.from && s.to >= 99999999) { pct = s.pct / 100; break; }
  }
  return Math.round((slab.flat_bonus || 0) + (excess * pct));
}

// ── PT SLAB (Andhra Pradesh) ──────────────────────────────
function calcPT(gross) {
  if (gross <= 15000) return 0;
  if (gross <= 20000) return 150;
  return 200;
}

// ── PROBATION CHECK ──────────────────────────────────────
function isOnProbation(joiningDate) {
  if (!joiningDate) return false;
  const end = new Date(joiningDate);
  end.setMonth(end.getMonth() + 6);
  return new Date() < end;
}

function probationEndDate(joiningDate) {
  if (!joiningDate) return null;
  const end = new Date(joiningDate);
  end.setMonth(end.getMonth() + 6);
  return end;
}

// ── QUARTER HELPER ────────────────────────────────────────
function getQuarter(date = new Date()) {
  const m = date.getMonth();
  const y = date.getFullYear();
  if (m < 3)  return { q: 1, y, start: `${y}-01-01`, end: `${y}-03-31` };
  if (m < 6)  return { q: 2, y, start: `${y}-04-01`, end: `${y}-06-30` };
  if (m < 9)  return { q: 3, y, start: `${y}-07-01`, end: `${y}-09-30` };
  return        { q: 4, y, start: `${y}-10-01`, end: `${y}-12-31` };
}

// ── TRIP ELIGIBILITY ──────────────────────────────────────
function calcTripEligibility(quartersHit) {
  if (quartersHit >= 4) return 'thailand_couple';
  if (quartersHit >= 3) return 'goa_couple';
  if (quartersHit >= 2) return 'goa_1pax';
  return null;
}

const TRIP_LABELS = {
  thailand_couple: { icon: '✈️', label: 'Thailand Trip (Couple)', color: '#F5C842' },
  goa_couple:      { icon: '🏖', label: 'Goa Trip (Couple)', color: '#22c55e' },
  goa_1pax:        { icon: '🏖', label: 'Goa Trip (Solo)', color: '#60A5FA' },
};

// ─────────────────────────────────────────────────────────
// MY HR DASHBOARD
// ─────────────────────────────────────────────────────────
async function renderMyHRPage() {
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return '<div class="empty-state">Please login first</div>';

  const [hrRes, lbRes] = await Promise.all([
    sb.from('staff_hr').select('*').eq('profile_id', profile.id).single().then(r=>r, ()=>({data:null})),
    sb.from('leave_balances').select('*').eq('profile_id', profile.id).eq('year', new Date().getFullYear()).single().then(r=>r, ()=>({data:null}))
  ]);

  const hr = hrRes?.data;
  const lb = lbRes?.data;
  const onProb = hr ? isOnProbation(hr.joining_date) : false;
  const probEnd = hr?.joining_date ? probationEndDate(hr.joining_date) : null;
  const clBal = parseFloat(lb?.cl_balance || 0).toFixed(1);
  const slBal = parseFloat(lb?.sl_balance || 0).toFixed(1);

  return `
  <div class="module-header"><h2>👤 My HR Portal</h2></div>

  <div style="background:linear-gradient(135deg,#0A1628,#1B4F8A);border-radius:16px;padding:16px;margin-bottom:14px;color:#fff">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="width:48px;height:48px;background:rgba(255,255,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;flex-shrink:0">
        ${(profile.name||'?').charAt(0).toUpperCase()}
      </div>
      <div>
        <div style="font-size:16px;font-weight:900">${profile.name}</div>
        <div style="font-size:11px;opacity:.7">${hr?.designation || profile.role} · ${hr?.department || 'V Wholesale'}</div>
        <div style="font-size:10px;opacity:.55">
          ${hr?.employee_code ? `Code: ${hr.employee_code} · ` : ''}
          Joined: ${hr?.joining_date ? new Date(hr.joining_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : 'Not set'}
        </div>
      </div>
    </div>
    ${onProb
      ? `<div style="background:rgba(245,165,0,.2);border:1px solid rgba(245,165,0,.4);border-radius:8px;padding:8px;font-size:11px">⏳ On Probation — ends ${probEnd ? probEnd.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '6 months from joining'}</div>`
      : `<div style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:8px;font-size:11px">✅ Confirmed Employee · Leaves: CL ${clBal} · SL ${slBal}</div>`
    }
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
    <div style="background:var(--bg2);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:var(--green)">${clBal}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">CL Left</div>
    </div>
    <div style="background:var(--bg2);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:var(--blue)">${slBal}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">SL Left</div>
    </div>
    <div style="background:var(--bg2);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:900;color:var(--gold)">${hr?.gross_salary ? '₹'+Math.round(hr.gross_salary/1000)+'K' : '—'}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">Monthly CTC</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    ${[
      { icon:'📅', label:'My Attendance',  sub:'Monthly view',        fn:'renderMyAttendance' },
      { icon:'🏖', label:'My Leaves',      sub:'Apply & track',       fn:'renderMyLeaves' },
      { icon:'💰', label:'My Salary',      sub:'Payslips & breakdown', fn:'renderMySalary' },
      { icon:'🎯', label:'My KPIs',        sub:'Monthly scores',       fn:'renderMyKPIs' },
      { icon:'🏆', label:'Achievements',   sub:'Quarters & trips',     fn:'renderMyAchievements' },
      { icon:'💸', label:'Advances',       sub:'Request & status',     fn:'renderMyAdvances' },
      { icon:'📁', label:'My Documents',   sub:'Upload & verify',      fn:'renderMyDocuments' },
      { icon:'✏️', label:'My Profile',     sub:'Update details',       fn:'renderMyProfile' },
    ].map(b => `
      <button class="qa-btn" onclick="VW_HR_SELF.${b.fn}()">
        <span class="qa-icon">${b.icon}</span>
        <span>${b.label}</span>
        <span style="font-size:10px;color:var(--text3)">${b.sub}</span>
      </button>`).join('')}
  </div>`;
}

// ─────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────
async function renderMyAttendance() {
  const profile = VW_AUTH.getCurrentProfile();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth()+1, 0);

  const { data: att } = await sb.from('attendance')
    .select('*').eq('staffId', profile.id)
    .gte('date', monthStart.toISOString().split('T')[0])
    .lte('date', monthEnd.toISOString().split('T')[0])
    .order('date').then(r=>r, ()=>({data:[]}));

  const attMap = {};
  (att||[]).forEach(a => { attMap[a.date?.split('T')[0]] = a; });

  const days = [];
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate()+1)) days.push(new Date(d));

  const present = (att||[]).filter(a => ['present','late'].includes(a.status)).length;
  const absent  = (att||[]).filter(a => a.status === 'absent').length;
  const leave   = (att||[]).filter(a => a.status === 'leave').length;
  const late    = (att||[]).filter(a => a.status === 'late').length;

  const content = document.getElementById('app-content');
  content.innerHTML = `
  <div class="module-header"><h2>📅 My Attendance — ${now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h2></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
    <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:var(--green)">${present}</div><div style="font-size:10px;color:var(--text3)">Present</div></div>
    <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:var(--red)">${absent}</div><div style="font-size:10px;color:var(--text3)">Absent</div></div>
    <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:var(--blue)">${leave}</div><div style="font-size:10px;color:var(--text3)">Leave</div></div>
    <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:var(--gold)">${late}</div><div style="font-size:10px;color:var(--text3)">Late</div></div>
  </div>
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px">
      ${['S','M','T','W','T','F','S'].map(d=>`<div style="text-align:center;font-size:10px;color:var(--text3);font-weight:700;padding:4px">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">
      ${Array(days[0].getDay()).fill(0).map(()=>'<div></div>').join('')}
      ${days.map(d => {
        const key = d.toISOString().split('T')[0];
        const a = attMap[key];
        const isFuture = d > now;
        const bg = isFuture ? 'var(--bg3)' : !a ? 'var(--bg3)' : a.status==='present'?'#15803d':a.status==='absent'?'#b91c1c':a.status==='leave'?'#1d4ed8':a.status==='late'?'#b45309':'var(--bg3)';
        const letter = !a||isFuture ? '' : a.status==='present'?'P':a.status==='absent'?'A':a.status==='leave'?'L':'La';
        return `<div style="aspect-ratio:1;border-radius:6px;background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:${isFuture?.3:1}">
          <span style="font-size:9px;color:rgba(255,255,255,.8)">${d.getDate()}</span>
          <span style="font-size:7px;color:#fff;font-weight:800">${letter}</span>
        </div>`;
      }).join('')}
    </div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:10px;color:var(--text3)">
    <span>🟢 Present</span><span>🔴 Absent</span><span>🔵 Leave</span><span>🟡 Late</span>
  </div>
  <button onclick="navigateTo('my_hr')" style="width:100%;margin-top:14px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);cursor:pointer;font-family:inherit">← Back to HR</button>`;
}

// ─────────────────────────────────────────────────────────
// LEAVES
// ─────────────────────────────────────────────────────────
async function renderMyLeaves() {
  const profile = VW_AUTH.getCurrentProfile();
  const year = new Date().getFullYear();

  const [lbRes, leavesRes, hrRes] = await Promise.all([
    sb.from('leave_balances').select('*').eq('profile_id', profile.id).eq('year', year).single().then(r=>r, ()=>({data:null})),
    sb.from('leaves').select('*').eq('staffId', profile.id).order('startDate', {ascending:false}).limit(20).then(r=>r, ()=>({data:[]})),
    sb.from('staff_hr').select('joining_date').eq('profile_id', profile.id).single().then(r=>r, ()=>({data:null}))
  ]);

  const lb = lbRes?.data || { cl_balance:0, sl_balance:0, cl_used:0, sl_used:0 };
  const leaves = leavesRes?.data || [];
  const onProb = hrRes?.data ? isOnProbation(hrRes.data.joining_date) : false;

  const content = document.getElementById('app-content');
  content.innerHTML = `
  <div class="module-header"><h2>🏖 My Leaves ${year}</h2><button class="btn-sm" onclick="VW_HR_SELF.showApplyLeave()">+ Apply</button></div>

  ${onProb ? `<div style="background:rgba(245,165,0,.1);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--gold)">⚠️ You are on probation. Leaves will be approved but are unpaid.</div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    <div style="background:var(--bg2);border-radius:12px;padding:14px">
      <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:4px">Casual Leave (CL)</div>
      <div style="font-size:26px;font-weight:900;color:var(--green)">${parseFloat(lb.cl_balance||0).toFixed(1)}</div>
      <div style="font-size:10px;color:var(--text3)">Available · ${parseFloat(lb.cl_used||0).toFixed(1)} used</div>
      <div style="font-size:10px;color:var(--text3)">Accrual: 1 per month</div>
    </div>
    <div style="background:var(--bg2);border-radius:12px;padding:14px">
      <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:4px">Sick Leave (SL)</div>
      <div style="font-size:26px;font-weight:900;color:var(--blue)">${parseFloat(lb.sl_balance||0).toFixed(1)}</div>
      <div style="font-size:10px;color:var(--text3)">Available · ${parseFloat(lb.sl_used||0).toFixed(1)} used</div>
      <div style="font-size:10px;color:var(--text3)">Accrual: 0.5 per month</div>
    </div>
  </div>

  <div style="background:rgba(245,200,66,.08);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--text2)">
    💡 Apply leave <strong>7+ days in advance</strong> to count as present for quarterly attendance bonus. Unused leaves carry forward.
  </div>

  <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">Leave History</div>
  ${leaves.length ? leaves.map(l => {
    const advDays = l.advanceDays ?? Math.round((new Date(l.startDate)-new Date(l.appliedAt||Date.now()))/(1000*60*60*24));
    return `<div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:13px;font-weight:700">${l.leaveType||'Leave'} · ${l.days||1} day${(l.days||1)>1?'s':''}</div>
          <div style="font-size:11px;color:var(--text3)">${l.startDate ? new Date(l.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}${l.endDate && l.endDate !== l.startDate ? ' → '+new Date(l.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : ''}</div>
          <div style="font-size:11px;color:var(--text3)">${l.reason||'—'}</div>
          ${advDays < 7 ? `<div style="font-size:10px;color:var(--gold)">⚠️ Applied ${advDays} days in advance (< 7 days — attendance bonus affected)</div>` : `<div style="font-size:10px;color:var(--green)">✅ Applied ${advDays} days in advance</div>`}
        </div>
        <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:800;flex-shrink:0;background:${l.status==='approved'?'rgba(34,197,94,.15)':l.status==='rejected'?'rgba(239,68,68,.15)':'rgba(245,200,66,.15)'};color:${l.status==='approved'?'var(--green)':l.status==='rejected'?'var(--red)':'var(--gold)'}">${l.status||'pending'}</span>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No leave history</div>'}
  <button onclick="navigateTo('my_hr')" style="width:100%;margin-top:14px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);cursor:pointer;font-family:inherit">← Back</button>`;
}

async function showApplyLeave() {
  const today = new Date().toISOString().split('T')[0];
  const sheet = document.getElementById('bottom-sheet');
  const overlay = document.getElementById('sheet-overlay');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="font-size:16px;font-weight:900;margin-bottom:4px">Apply for Leave</div>
    <div style="background:rgba(245,200,66,.08);border:1px solid var(--gold-border);border-radius:8px;padding:8px;margin-bottom:12px;font-size:11px;color:var(--gold)">
      ℹ️ Apply 7+ days in advance for planned leaves to maintain attendance bonus eligibility
    </div>
    <div style="display:grid;gap:10px">
      <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">LEAVE TYPE</label>
        <select id="lv-type" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
          <option value="CL">Casual Leave (CL)</option>
          <option value="SL">Sick Leave (SL)</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">FROM</label>
          <input type="date" id="lv-from" min="${today}" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
        </div>
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">TO</label>
          <input type="date" id="lv-to" min="${today}" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
        </div>
      </div>
      <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">REASON *</label>
        <textarea id="lv-reason" rows="3" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;resize:none" placeholder="Reason for leave…"></textarea>
      </div>
    </div>
    <button onclick="VW_HR_SELF.submitLeaveRequest()" style="width:100%;margin-top:14px;padding:12px;background:var(--blue);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Submit Request</button>
    <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;background:none;border:none;color:var(--text3);cursor:pointer;font-family:inherit">Cancel</button>`;
  sheet.classList.add('open');
  overlay?.classList.add('open');
}

async function submitLeaveRequest() {
  const profile = VW_AUTH.getCurrentProfile();
  const type  = document.getElementById('lv-type')?.value;
  const from  = document.getElementById('lv-from')?.value;
  const to    = document.getElementById('lv-to')?.value;
  const reason = document.getElementById('lv-reason')?.value?.trim();
  if (!from || !to)  { showToast('Select leave dates'); return; }
  if (!reason)       { showToast('Enter reason'); return; }
  const fromD = new Date(from);
  const toD   = new Date(to);
  if (toD < fromD)   { showToast('End date must be after start date'); return; }
  const days = Math.round((toD - fromD) / (1000*60*60*24)) + 1;
  const advanceDays = Math.round((fromD - new Date()) / (1000*60*60*24));
  const { error } = await sb.from('leaves').insert({
    staffId: profile.id, staffName: profile.name,
    leaveType: type, startDate: from, endDate: to, days, reason,
    advanceDays, status: 'pending', appliedAt: new Date().toISOString()
  });
  if (error) { showToast('Failed: '+error.message); return; }
  closeSheet();
  showToast(`✅ Leave request submitted — ${days} day${days>1?'s':''}`);
  renderMyLeaves();
}

// ─────────────────────────────────────────────────────────
// SALARY & PAYSLIPS
// ─────────────────────────────────────────────────────────
async function renderMySalary() {
  const profile = VW_AUTH.getCurrentProfile();
  const { data: slips } = await sb.from('payroll_runs')
    .select('*').eq('profile_id', profile.id)
    .order('month', {ascending:false}).limit(12).then(r=>r, ()=>({data:[]}));

  const content = document.getElementById('app-content');
  content.innerHTML = `
  <div class="module-header"><h2>💰 My Salary & Payslips</h2></div>
  ${(slips||[]).length ? (slips||[]).map(s => `
    <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <div style="font-size:14px;font-weight:800">${new Date(s.month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div>
          <div style="font-size:11px;color:var(--text3)">${s.days_present} of ${s.days_in_month} days</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:900;color:var(--green)">₹${(s.net_salary||0).toLocaleString('en-IN')}</div>
          <span style="font-size:10px;padding:2px 8px;border-radius:12px;background:${s.status==='paid'?'rgba(34,197,94,.15)':'rgba(245,200,66,.15)'};color:${s.status==='paid'?'var(--green)':'var(--gold)'}">${s.status||'draft'}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:10px;padding:10px;background:var(--bg3);border-radius:8px">
        <div style="color:var(--text3)">Basic <span style="color:var(--text);font-weight:700;float:right">₹${(s.basic||0).toLocaleString('en-IN')}</span></div>
        <div style="color:var(--text3)">HRA <span style="color:var(--text);font-weight:700;float:right">₹${(s.hra||0).toLocaleString('en-IN')}</span></div>
        <div style="color:var(--text3)">Allowance <span style="color:var(--text);font-weight:700;float:right">₹${(s.allowance||0).toLocaleString('en-IN')}</span></div>
        <div style="color:var(--text3)">Incentive <span style="color:var(--green);font-weight:700;float:right">+₹${(s.incentive||0).toLocaleString('en-IN')}</span></div>
        <div style="color:var(--text3)">PT <span style="color:var(--red);font-weight:700;float:right">-₹${(s.pt_deduct||0).toLocaleString('en-IN')}</span></div>
        ${(s.pf_deduct||0) > 0 ? `<div style="color:var(--text3)">PF <span style="color:var(--red);font-weight:700;float:right">-₹${(s.pf_deduct||0).toLocaleString('en-IN')}</span></div>` : ''}
        ${(s.advance_deduct||0) > 0 ? `<div style="color:var(--text3)">Advance <span style="color:var(--red);font-weight:700;float:right">-₹${(s.advance_deduct||0).toLocaleString('en-IN')}</span></div>` : ''}
      </div>
      <button onclick="VW_HR_SELF.printPayslip('${s.id}')" style="width:100%;padding:8px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text2);font-size:12px;cursor:pointer;font-family:inherit">🖨️ Print / Download Payslip</button>
    </div>`).join('') : `<div class="empty-state"><div style="font-size:40px;margin-bottom:10px">💰</div><div>No payslips generated yet</div><div style="font-size:12px;color:var(--text3);margin-top:4px">HR will generate your first payslip after month end</div></div>`}
  <button onclick="navigateTo('my_hr')" style="width:100%;margin-top:14px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);cursor:pointer;font-family:inherit">← Back</button>`;
}

async function printPayslip(payrollId) {
  const { data: s } = await sb.from('payroll_runs').select('*').eq('id', payrollId).single().then(r=>r, ()=>({data:null}));
  if (!s) { showToast('Payslip not found'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  const { data: hr } = await sb.from('staff_hr').select('*').eq('profile_id', profile.id).single().then(r=>r, ()=>({data:null}));
  const monthLabel = new Date(s.month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'});

  const html = `<!DOCTYPE html><html><head><title>Payslip ${monthLabel}</title><meta charset="UTF-8">
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:620px;margin:0 auto;font-size:13px}
.header{display:flex;justify-content:space-between;padding-bottom:14px;border-bottom:2px solid #1B4F8A;margin-bottom:16px}
.logo{font-size:22px;font-weight:900;color:#1B4F8A}.sub{font-size:11px;color:#666;margin-top:2px}
h3{font-size:12px;font-weight:700;color:#1B4F8A;border-bottom:1px solid #eee;padding:6px 0;margin:14px 0 8px;text-transform:uppercase;letter-spacing:.04em}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}
.field{margin-bottom:6px}.field .lbl{font-size:10px;color:#888}.field .val{font-weight:700}
.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0}
.row.total{font-weight:700;border-top:1px solid #ccc;border-bottom:none;margin-top:4px}
.net{background:#EBF5FF;border:1px solid #1B4F8A;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;margin-top:12px}
.note{font-size:10px;color:#999;text-align:center;margin-top:16px}
@media print{button{display:none}}</style></head><body>
<div class="header">
  <div><div class="logo">V Wholesale</div><div class="sub">Vassure Wholesale Pvt. Ltd.</div><div class="sub">Visit V Wholesale</div><div class="sub">GSTIN: 37AAJCV5725H1ZZ · Ph: 8712697930</div></div>
  <div style="text-align:right"><div style="font-weight:900;font-size:15px;color:#1B4F8A">SALARY SLIP</div><div class="sub">${monthLabel}</div><div class="sub">Generated: ${new Date().toLocaleDateString('en-IN')}</div></div>
</div>
<h3>Employee Details</h3>
<div class="grid2">
  <div class="field"><div class="lbl">Employee Name</div><div class="val">${profile.name}</div></div>
  <div class="field"><div class="lbl">Employee Code</div><div class="val">${hr?.employee_code||'—'}</div></div>
  <div class="field"><div class="lbl">Designation</div><div class="val">${hr?.designation||profile.role||'—'}</div></div>
  <div class="field"><div class="lbl">Department</div><div class="val">${hr?.department||'V Wholesale'}</div></div>
  <div class="field"><div class="lbl">Date of Joining</div><div class="val">${hr?.joining_date?new Date(hr.joining_date).toLocaleDateString('en-IN'):'—'}</div></div>
  <div class="field"><div class="lbl">Bank Account</div><div class="val">${hr?.bank_account||'—'}</div></div>
  <div class="field"><div class="lbl">PAN</div><div class="val">${hr?.pan_no||'—'}</div></div>
  <div class="field"><div class="lbl">Bank IFSC</div><div class="val">${hr?.bank_ifsc||'—'}</div></div>
</div>
<h3>Attendance</h3>
<div class="grid2">
  <div class="field"><div class="lbl">Working Days</div><div class="val">${s.days_in_month}</div></div>
  <div class="field"><div class="lbl">Days Present</div><div class="val" style="color:green">${s.days_present}</div></div>
  <div class="field"><div class="lbl">Days Absent / LOP</div><div class="val" style="color:red">${s.days_absent||0}</div></div>
</div>
<h3>Earnings</h3>
<div class="row"><span>Basic Salary</span><span>₹${(s.basic||0).toLocaleString('en-IN')}</span></div>
<div class="row"><span>House Rent Allowance (HRA)</span><span>₹${(s.hra||0).toLocaleString('en-IN')}</span></div>
<div class="row"><span>Other Allowances</span><span>₹${(s.allowance||0).toLocaleString('en-IN')}</span></div>
${(s.incentive||0)>0?`<div class="row"><span>Incentive / Performance Bonus</span><span style="color:green">₹${(s.incentive||0).toLocaleString('en-IN')}</span></div>`:''}
<div class="row total"><span>Gross Earnings</span><span>₹${((s.gross_earned||0)+(s.incentive||0)).toLocaleString('en-IN')}</span></div>
<h3>Deductions</h3>
<div class="row"><span>Professional Tax (PT)</span><span>₹${(s.pt_deduct||0).toLocaleString('en-IN')}</span></div>
${(s.pf_deduct||0)>0?`<div class="row"><span>Provident Fund (PF) — 12% of Basic</span><span>₹${(s.pf_deduct||0).toLocaleString('en-IN')}</span></div>`:''}
${(s.advance_deduct||0)>0?`<div class="row"><span>Advance Recovery</span><span>₹${(s.advance_deduct||0).toLocaleString('en-IN')}</span></div>`:''}
${(s.other_deduct||0)>0?`<div class="row"><span>Other Deductions</span><span>₹${(s.other_deduct||0).toLocaleString('en-IN')}</span></div>`:''}
<div class="row total"><span>Total Deductions</span><span style="color:red">₹${(s.total_deductions||0).toLocaleString('en-IN')}</span></div>
<div class="net"><span style="font-weight:900;font-size:14px">NET SALARY (Take Home)</span><span style="font-weight:900;font-size:22px;color:#1B4F8A">₹${(s.net_salary||0).toLocaleString('en-IN')}</span></div>
<div class="note">This is a computer-generated payslip and does not require a physical signature.<br>V Wholesale — Visit V Wholesale · 8712697930</div>
<button onclick="window.print()" style="display:block;margin:16px auto 0;padding:10px 24px;background:#1B4F8A;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer">🖨️ Print Payslip</button>
<script>setTimeout(()=>window.print(),500)</script></body></html>`;

  const w = window.open('','_blank','width=680,height=900');
  w.document.write(html);
  w.document.close();
}

// ─────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────
async function renderMyKPIs() {
  const profile = VW_AUTH.getCurrentProfile();
  const { data: scores } = await sb.from('kpi_scores')
    .select('*').eq('profile_id', profile.id)
    .order('month', {ascending:false}).limit(6).then(r=>r, ()=>({data:[]}));

  const content = document.getElementById('app-content');
  content.innerHTML = `
  <div class="module-header"><h2>🎯 My KPI Scores</h2></div>
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--text3)">
    📊 Rated monthly by your reporting manager. <strong style="color:var(--gold)">Top 3 executives & top 1 TL/Sr.Sales each quarter → ₹5,000 Gift Voucher</strong>.
  </div>
  ${(scores||[]).length ? (scores||[]).map(s => {
    const pct = Math.round((s.total_score/(s.max_score||100))*100);
    const col = pct>=80?'var(--green)':pct>=60?'var(--gold)':'var(--red)';
    return `<div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:800">${new Date(s.month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div>
        <div style="font-size:20px;font-weight:900;color:${col}">${s.total_score}/${s.max_score||100}</div>
      </div>
      <div style="background:var(--bg3);border-radius:4px;height:8px;margin-bottom:10px;overflow:hidden">
        <div style="background:${col};width:${pct}%;height:100%;border-radius:4px;transition:width .5s"></div>
      </div>
      ${(s.scores||[]).map(k=>`
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:5px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text2)">${k.kpi}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:60px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden"><div style="background:var(--blue);width:${Math.round((k.marks/k.max)*100)}%;height:100%"></div></div>
            <span style="font-weight:700;min-width:40px;text-align:right">${k.marks}/${k.max}</span>
          </div>
        </div>`).join('')}
      ${s.feedback?`<div style="margin-top:8px;font-size:11px;color:var(--text3);font-style:italic;padding:6px;background:var(--bg3);border-radius:6px">"${s.feedback}"</div>`:''}
      ${s.status==='acknowledged'?'':s.status==='submitted'?`<button onclick="VW_HR_SELF.acknowledgeKPI('${s.id}')" style="width:100%;margin-top:8px;padding:7px;background:none;border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--text2);cursor:pointer">Acknowledge Score</button>`:''}
    </div>`;
  }).join('') : `<div class="empty-state"><div style="font-size:40px;margin-bottom:8px">🎯</div><div>No KPI scores yet</div><div style="font-size:12px;color:var(--text3);margin-top:4px">Your manager will rate you monthly</div></div>`}
  <button onclick="navigateTo('my_hr')" style="width:100%;margin-top:14px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);cursor:pointer;font-family:inherit">← Back</button>`;
}

async function acknowledgeKPI(scoreId) {
  await sb.from('kpi_scores').update({ status: 'acknowledged' }).eq('id', scoreId);
  showToast('✅ KPI score acknowledged');
  renderMyKPIs();
}

// ─────────────────────────────────────────────────────────
// ACHIEVEMENTS & TRIPS
// ─────────────────────────────────────────────────────────
async function renderMyAchievements() {
  const profile = VW_AUTH.getCurrentProfile();
  const year = new Date().getFullYear();

  const { data: achievements } = await sb.from('staff_achievements')
    .select('*').eq('profile_id', profile.id).eq('year', year)
    .order('quarter').then(r=>r, ()=>({data:[]}));

  const quartersHit = (achievements||[]).filter(a => a.target_hit).length;
  const tripElig = calcTripEligibility(quartersHit);
  const trip = tripElig ? TRIP_LABELS[tripElig] : null;

  const content = document.getElementById('app-content');
  content.innerHTML = `
  <div class="module-header"><h2>🏆 Achievements & Rewards ${year}</h2></div>

  ${trip ? `
  <div style="background:linear-gradient(135deg,#0A1628,#F5C842);border-radius:14px;padding:16px;margin-bottom:14px;text-align:center;color:#fff">
    <div style="font-size:32px;margin-bottom:6px">${trip.icon}</div>
    <div style="font-size:16px;font-weight:900">${trip.label}</div>
    <div style="font-size:12px;opacity:.8;margin-top:4px">You are eligible! HR will contact you for booking.</div>
  </div>` : `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Hit targets to unlock yearly trips:</div>
    <div style="display:grid;gap:6px;font-size:11px">
      <div style="display:flex;gap:8px;align-items:center"><span>🏖</span><span style="color:var(--text2)"><strong>2 Quarters</strong> → Goa Trip (1 person)</span></div>
      <div style="display:flex;gap:8px;align-items:center"><span>🏖</span><span style="color:var(--text2)"><strong>3 Quarters</strong> → Goa Trip (Couple — 1+1)</span></div>
      <div style="display:flex;gap:8px;align-items:center"><span>✈️</span><span style="color:var(--gold)"><strong>All 4 Quarters</strong> → Thailand Trip (Couple — 1+1)</span></div>
    </div>
  </div>`}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
    ${[1,2,3,4].map(q => {
      const a = (achievements||[]).find(x => x.quarter === q);
      const { q: currQ } = getQuarter();
      const isCurrent = q === currQ;
      const hit = a?.target_hit;
      return `<div style="background:var(--bg2);border-radius:12px;padding:12px;border:2px solid ${hit?'var(--green)':isCurrent?'var(--blue)':'var(--border)'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;color:var(--text3);font-weight:700">Q${q} ${year}</span>
          <span style="font-size:18px">${hit?'✅':isCurrent?'⏳':'⭕'}</span>
        </div>
        ${a ? `
          <div style="font-size:12px;font-weight:700">₹${(a.sales_achieved||0).toLocaleString('en-IN')}</div>
          <div style="font-size:10px;color:var(--text3)">Target: ₹${(a.target||0).toLocaleString('en-IN')}</div>
          <div style="margin:6px 0;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden">
            <div style="background:${hit?'var(--green)':'var(--blue)'};width:${Math.min(100,Math.round((a.sales_achieved/a.target)*100))}%;height:100%"></div>
          </div>
          ${(a.incentive_earned||0)>0?`<div style="font-size:10px;color:var(--green)">Incentive: +₹${a.incentive_earned.toLocaleString('en-IN')}</div>`:''}
          ${(a.awards||[]).length?`<div style="font-size:10px;color:var(--gold);margin-top:4px">${a.awards.join(' · ')}</div>`:''}
          ${a.attendance_bonus_eligible?`<div style="font-size:10px;color:var(--green)">🎁 Attendance Bonus Eligible</div>`:''}
        ` : `<div style="font-size:11px;color:var(--text3)">${isCurrent?'In progress…':'Not started'}</div>`}
      </div>`;
    }).join('')}
  </div>

  <div style="background:var(--bg2);border-radius:12px;padding:12px;font-size:12px;color:var(--text3);text-align:center">
    ${quartersHit}/4 quarters hit · ${tripElig ? `🎉 Trip eligible: ${trip?.label}` : `${4-quartersHit} more to unlock ${quartersHit>=3?'Thailand':'next'} reward`}
  </div>
  <button onclick="navigateTo('my_hr')" style="width:100%;margin-top:14px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);cursor:pointer;font-family:inherit">← Back</button>`;
}

// ─────────────────────────────────────────────────────────
// ADVANCES
// ─────────────────────────────────────────────────────────
async function renderMyAdvances() {
  const profile = VW_AUTH.getCurrentProfile();
  const [hrRes, advRes] = await Promise.all([
    sb.from('staff_hr').select('joining_date,gross_salary').eq('profile_id', profile.id).single().then(r=>r, ()=>({data:null})),
    sb.from('staff_advances').select('*').eq('profile_id', profile.id).order('requested_at',{ascending:false}).limit(10).then(r=>r, ()=>({data:[]}))
  ]);
  const onProb = hrRes?.data ? isOnProbation(hrRes.data.joining_date) : true;
  const advances = advRes?.data || [];
  const totalPending = advances.filter(a => a.status==='approved' && a.months_remaining > 0).reduce((s,a) => s + ((a.months_remaining||0) * (a.monthly_deduct||0)), 0);

  const content = document.getElementById('app-content');
  content.innerHTML = `
  <div class="module-header"><h2>💸 Salary Advances</h2>
    ${!onProb?`<button class="btn-sm" onclick="VW_HR_SELF.showRequestAdvance()">+ Request</button>`:''}
  </div>

  ${onProb?`<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--red)">❌ Advance requests available after 6-month probation completion</div>`:''}
  ${totalPending>0?`<div style="background:rgba(245,200,66,.08);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;color:var(--gold)">⚠️ Outstanding advance: ₹${totalPending.toLocaleString('en-IN')} pending recovery</div>`:''}

  ${advances.length ? advances.map(a => `
    <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:16px;font-weight:900">₹${(a.amount||0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px;color:var(--text3)">${new Date(a.requested_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
        </div>
        <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:800;background:${a.status==='approved'?'rgba(34,197,94,.15)':a.status==='rejected'?'rgba(239,68,68,.15)':'rgba(245,200,66,.15)'};color:${a.status==='approved'?'var(--green)':a.status==='rejected'?'var(--red)':'var(--gold)'}">${a.status}</span>
      </div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px">${a.reason||'—'}</div>
      ${a.status==='approved'?`
        <div style="font-size:11px;padding:8px;background:var(--bg3);border-radius:8px">
          <div>Deduction: ${a.deduction_type==='monthly'?`₹${(a.monthly_deduct||0).toLocaleString('en-IN')}/month × ${a.months_remaining} month${(a.months_remaining||0)>1?'s':''} left`:'Full from next salary'}</div>
          <div style="color:var(--green)">Recovered so far: ₹${(a.total_deducted||0).toLocaleString('en-IN')}</div>
        </div>`:''}
      ${a.rejection_reason?`<div style="font-size:11px;color:var(--red);margin-top:6px">Reason: ${a.rejection_reason}</div>`:''}
    </div>`).join('') : '<div class="empty-state">No advance requests</div>'}
  <button onclick="navigateTo('my_hr')" style="width:100%;margin-top:14px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);cursor:pointer;font-family:inherit">← Back</button>`;
}

async function showRequestAdvance() {
  const profile = VW_AUTH.getCurrentProfile();
  const { data: hr } = await sb.from('staff_hr').select('gross_salary').eq('profile_id', profile.id).single().then(r=>r, ()=>({data:null}));
  const maxAdv = Math.round((hr?.gross_salary||0) * 2);
  const sheet = document.getElementById('bottom-sheet');
  const overlay = document.getElementById('sheet-overlay');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="font-size:16px;font-weight:900;margin-bottom:4px">Request Salary Advance</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:14px">Max eligible: ₹${maxAdv.toLocaleString('en-IN')} (2× monthly salary)</div>
    <div style="display:grid;gap:10px">
      <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">AMOUNT (₹) *</label>
        <input type="number" id="adv-amt" placeholder="Enter amount" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
      </div>
      <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">DEDUCTION TYPE</label>
        <select id="adv-type" onchange="document.getElementById('adv-months-row').style.display=this.value==='monthly'?'block':'none'" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
          <option value="full">Full deduction — next salary</option>
          <option value="monthly">Monthly installments (post-probation only)</option>
        </select>
      </div>
      <div id="adv-months-row" style="display:none">
        <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">SPREAD OVER (MONTHS)</label>
        <select id="adv-months" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
          <option value="2">2 months</option><option value="3">3 months</option>
          <option value="4">4 months</option><option value="6">6 months</option>
        </select>
      </div>
      <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">REASON *</label>
        <textarea id="adv-reason" rows="3" style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;resize:none" placeholder="Reason for advance…"></textarea>
      </div>
    </div>
    <button onclick="VW_HR_SELF.submitAdvanceRequest()" style="width:100%;margin-top:14px;padding:12px;background:var(--blue);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Submit Request</button>
    <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;background:none;border:none;color:var(--text3);cursor:pointer;font-family:inherit">Cancel</button>`;
  sheet.classList.add('open');
  overlay?.classList.add('open');
}

async function submitAdvanceRequest() {
  const profile = VW_AUTH.getCurrentProfile();
  const amount  = parseFloat(document.getElementById('adv-amt')?.value||0);
  const type    = document.getElementById('adv-type')?.value;
  const months  = parseInt(document.getElementById('adv-months')?.value||1);
  const reason  = document.getElementById('adv-reason')?.value?.trim();
  if (!amount || amount < 500) { showToast('Minimum advance is ₹500'); return; }
  if (!reason) { showToast('Enter reason'); return; }
  const { error } = await sb.from('staff_advances').insert({
    profile_id: profile.id, amount, reason,
    deduction_type: type,
    monthly_deduct: type==='monthly' ? Math.ceil(amount/months) : amount,
    months_remaining: type==='monthly' ? months : 1,
    status: 'pending', requested_at: new Date().toISOString()
  });
  if (error) { showToast('Failed: '+error.message); return; }
  closeSheet();
  showToast('✅ Advance request submitted — HR will respond within 24 hours');
  renderMyAdvances();
}

// ─────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────
const DOC_TYPES = [
  { key:'photo',            label:'Profile Photo',           icon:'📸', required:true },
  { key:'aadhaar',          label:'Aadhaar Card',            icon:'🪪', required:true },
  { key:'pan',              label:'PAN Card',                icon:'💳', required:true },
  { key:'bank_passbook',    label:'Bank Passbook/Statement', icon:'🏦', required:true },
  { key:'edu_cert',         label:'Education Certificate',   icon:'🎓', required:false },
  { key:'exp_letter',       label:'Experience Letter',       icon:'📄', required:false },
  { key:'offer_letter',     label:'Offer Letter (V Wholesale)', icon:'📋', required:false },
  { key:'appointment_letter',label:'Appointment Letter',    icon:'✉️', required:false },
];

async function renderMyDocuments() {
  const profile = VW_AUTH.getCurrentProfile();
  const { data: docs } = await sb.from('staff_documents').select('*').eq('profile_id', profile.id).then(r=>r, ()=>({data:[]}));
  const docMap = {};
  (docs||[]).forEach(d => { docMap[d.doc_type] = d; });
  const totalRequired = DOC_TYPES.filter(d=>d.required).length;
  const uploadedRequired = DOC_TYPES.filter(d=>d.required && docMap[d.key]?.status==='verified').length;

  const content = document.getElementById('app-content');
  content.innerHTML = `
  <div class="module-header"><h2>📁 My Documents</h2></div>
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:12px;font-weight:700">Required Documents</span>
      <span style="font-size:13px;font-weight:900;color:${uploadedRequired===totalRequired?'var(--green)':'var(--gold)'}">${uploadedRequired}/${totalRequired} verified</span>
    </div>
    <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
      <div style="background:${uploadedRequired===totalRequired?'var(--green)':'var(--blue)'};width:${Math.round((uploadedRequired/totalRequired)*100)}%;height:100%;border-radius:3px"></div>
    </div>
  </div>
  ${DOC_TYPES.map(dt => {
    const doc = docMap[dt.key];
    const stColor = !doc?'var(--text3)':doc.status==='verified'?'var(--green)':doc.status==='rejected'?'var(--red)':'var(--gold)';
    const stLabel = !doc?'Not uploaded':doc.status==='verified'?'✅ Verified':doc.status==='rejected'?'❌ Rejected — re-upload':'⏳ Pending HR review';
    return `<div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
      <span style="font-size:22px;flex-shrink:0">${dt.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700">${dt.label}${dt.required?' <span style="color:var(--gold);font-size:10px">★ Required</span>':''}</div>
        <div style="font-size:11px;color:${stColor}">${stLabel}</div>
        ${doc?.notes?`<div style="font-size:10px;color:var(--red);margin-top:2px">${doc.notes}</div>`:''}
        ${doc?.uploaded_at?`<div style="font-size:10px;color:var(--text3)">Uploaded: ${new Date(doc.uploaded_at).toLocaleDateString('en-IN')}</div>`:''}
      </div>
      <div style="flex-shrink:0;display:flex;gap:6px">
        ${doc?.file_url?`<a href="${doc.file_url}" target="_blank" style="padding:5px 8px;background:var(--bg3);border-radius:6px;font-size:11px;color:var(--text2);text-decoration:none">View</a>`:''}
        <label style="padding:5px 8px;background:${!doc?'var(--blue)':'var(--bg3)'};border-radius:6px;font-size:11px;color:${!doc?'#fff':'var(--text2)'};cursor:pointer">
          ${!doc?'Upload':'Update'}
          <input type="file" accept="image/*,.pdf" style="display:none" onchange="VW_HR_SELF.uploadDocument('${dt.key}','${dt.label}',this)">
        </label>
      </div>
    </div>`;
  }).join('')}
  <button onclick="navigateTo('my_hr')" style="width:100%;margin-top:14px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);cursor:pointer;font-family:inherit">← Back</button>`;
}

async function uploadDocument(docType, docLabel, input) {
  const profile = VW_AUTH.getCurrentProfile();
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { showToast('Max file size is 5MB'); return; }
  showToast('Uploading…');
  try {
    const ext = file.name.split('.').pop();
    const path = `staff-docs/${profile.id}/${docType}-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('staff-documents').upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = sb.storage.from('staff-documents').getPublicUrl(path);
    await sb.from('staff_documents').upsert({
      profile_id: profile.id, doc_type: docType, doc_name: docLabel,
      file_url: publicUrl, file_size: file.size, status: 'pending',
      uploaded_at: new Date().toISOString()
    }, { onConflict: 'profile_id,doc_type' });
    showToast(`✅ ${docLabel} uploaded — HR will verify shortly`);
    renderMyDocuments();
  } catch(e) { showToast('Upload failed: '+e.message); }
}

// ─────────────────────────────────────────────────────────
// MY PROFILE
// ─────────────────────────────────────────────────────────
async function renderMyProfile() {
  const profile = VW_AUTH.getCurrentProfile();
  const { data: hr } = await sb.from('staff_hr').select('*').eq('profile_id', profile.id).single().then(r=>r, ()=>({data:{}}));
  const content = document.getElementById('app-content');
  content.innerHTML = `
  <div class="module-header"><h2>✏️ My Profile</h2></div>
  <div style="display:grid;gap:12px">
    <div style="background:var(--bg2);border-radius:12px;padding:14px">
      <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px">Personal Info</div>
      <div style="display:grid;gap:8px">
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">NAME</label><div style="font-weight:700;padding:8px;background:var(--bg3);border-radius:8px">${profile.name}</div></div>
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">PHONE</label><div style="padding:8px;background:var(--bg3);border-radius:8px">${profile.phone}</div></div>
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">BLOOD GROUP</label>
          <select id="prof-blood" style="width:100%;padding:9px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
            ${['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b=>`<option value="${b}" ${hr?.blood_group===b?'selected':''}>${b}</option>`).join('')}
          </select>
        </div>
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">EMERGENCY CONTACT</label>
          <input id="prof-emg" value="${hr?.emergency_contact||''}" placeholder="Name: Phone" style="width:100%;padding:9px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
        </div>
      </div>
    </div>
    <div style="background:var(--bg2);border-radius:12px;padding:14px">
      <div style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px">Bank Details</div>
      <div style="display:grid;gap:8px">
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">ACCOUNT NUMBER</label>
          <input id="prof-bank" value="${hr?.bank_account||''}" placeholder="Account number" style="width:100%;padding:9px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
        </div>
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">IFSC CODE</label>
          <input id="prof-ifsc" value="${hr?.bank_ifsc||''}" placeholder="e.g. SBIN0001234" style="width:100%;padding:9px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
        </div>
        <div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">BANK NAME</label>
          <input id="prof-bname" value="${hr?.bank_name||''}" placeholder="e.g. State Bank of India" style="width:100%;padding:9px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit">
        </div>
      </div>
    </div>
    <button onclick="VW_HR_SELF.saveMyProfile()" style="width:100%;padding:12px;background:var(--blue);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">💾 Save Changes</button>
  </div>
  <button onclick="navigateTo('my_hr')" style="width:100%;margin-top:10px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);cursor:pointer;font-family:inherit">← Back</button>`;
}

async function saveMyProfile() {
  const profile = VW_AUTH.getCurrentProfile();
  const { error } = await sb.from('staff_hr').upsert({
    profile_id: profile.id,
    blood_group: document.getElementById('prof-blood')?.value,
    emergency_contact: document.getElementById('prof-emg')?.value?.trim(),
    bank_account: document.getElementById('prof-bank')?.value?.trim(),
    bank_ifsc: document.getElementById('prof-ifsc')?.value?.trim(),
    bank_name: document.getElementById('prof-bname')?.value?.trim(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'profile_id' });
  if (error) { showToast('Failed: '+error.message); return; }
  showToast('✅ Profile saved');
}

// ─────────────────────────────────────────────────────────
// ADMIN — PAYROLL RUN
// ─────────────────────────────────────────────────────────
async function runMonthlyPayroll(month) {
  const [staffRes, attRes] = await Promise.all([
    sb.from('staff_hr').select('*,profiles(name,role)'),
    sb.from('attendance').select('*').gte('date', month+'-01').lte('date', month+'-31')
  ]);
  const staff = staffRes.data || [];
  const att   = attRes.data || [];
  const daysInMonth = new Date(parseInt(month.slice(0,4)), parseInt(month.slice(5,7)), 0).getDate();
  const results = [];

  for (const hr of staff) {
    const myAtt = att.filter(a => a.staffId === hr.profile_id);
    const daysPresent = myAtt.filter(a => ['present','late','leave'].includes(a.status)).length;
    const daysAbsent  = daysInMonth - daysPresent;
    const gross = hr.gross_salary || 0;
    const perDay = gross / daysInMonth;
    const grossEarned = Math.round(perDay * daysPresent);
    const basic    = hr.basic    || Math.round(grossEarned * 0.6);
    const hra      = hr.hra      || Math.round(grossEarned * 0.25);
    const allowance = hr.allowance || Math.max(0, grossEarned - basic - hra);
    const pt = calcPT(grossEarned);
    const pf = gross <= 15000 ? Math.round(basic * 0.12) : 0;

    // Pending advance deduction
    const { data: advance } = await sb.from('staff_advances')
      .select('*').eq('profile_id', hr.profile_id).eq('status','approved')
      .gt('months_remaining',0).limit(1).single().then(r=>r, ()=>({data:null}));
    const advDeduct = advance ? Math.min(advance.monthly_deduct || advance.amount, advance.amount - (advance.total_deducted||0)) : 0;

    const totalDed = pt + pf + advDeduct;
    const netSalary = Math.max(0, grossEarned - totalDed);

    await sb.from('payroll_runs').upsert({
      month, profile_id: hr.profile_id,
      days_in_month: daysInMonth, days_present: daysPresent, days_absent: daysAbsent,
      basic, hra, allowance, gross_earned: grossEarned,
      incentive: 0, advance_deduct: advDeduct,
      pt_deduct: pt, pf_deduct: pf,
      total_deductions: totalDed, net_salary: netSalary,
      status: 'draft'
    }, { onConflict: 'profile_id,month' });

    if (advance && advDeduct > 0) {
      await sb.from('staff_advances').update({
        months_remaining: Math.max(0, advance.months_remaining - 1),
        total_deducted: (advance.total_deducted||0) + advDeduct
      }).eq('id', advance.id);
    }
    results.push({ name: hr.profiles?.name, gross: grossEarned, net: netSalary });
  }
  return results;
}

// ─────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────
return {
  renderMyHRPage, renderMyAttendance, renderMyLeaves, renderMySalary,
  renderMyKPIs, acknowledgeKPI, renderMyAchievements,
  renderMyAdvances, showRequestAdvance, submitAdvanceRequest,
  renderMyDocuments, uploadDocument,
  renderMyProfile, saveMyProfile,
  showApplyLeave, submitLeaveRequest,
  printPayslip, runMonthlyPayroll,
  calcIncentive, calcPT, isOnProbation, getQuarter, calcTripEligibility,
};

})();

window.VW_HR_SELF = VW_HR_SELF;
