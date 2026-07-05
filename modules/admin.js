/* === settings.js === */

// ============================================================
// SETTINGS PAGE — Tab-based, 5 groups
// My Account · Team & Access · Store Config · Integrations · Danger
// ============================================================

async function renderSettingsPage() {
  const profile = VW_AUTH.getCurrentProfile();
  const isAdmin = VW_AUTH.isAdmin();

  return `
  <div class="module-header"><h2>⚙️ Settings</h2></div>

  <div style="overflow-x:auto;white-space:nowrap;margin-bottom:14px;padding-bottom:4px">
    <button class="entry-type-btn active" id="stab-account" onclick="VW_SETTINGS.switchSettingsTab('account',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">👤</span>My Account</button>
    ${isAdmin ? `<button class="entry-type-btn" id="stab-team" onclick="VW_SETTINGS.switchSettingsTab('team',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">👥</span>Team</button>` : ''}
    ${isAdmin ? `<button class="entry-type-btn" id="stab-permissions" onclick="VW_SETTINGS.switchSettingsTab('permissions',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">🔐</span>Permissions</button>` : ''}
    ${isAdmin ? `<button class="entry-type-btn" id="stab-store" onclick="VW_SETTINGS.switchSettingsTab('store',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">🏪</span>Store</button>` : ''}
    ${isAdmin ? `<button class="entry-type-btn" id="stab-tile" onclick="VW_SETTINGS.switchSettingsTab('tile',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">🔲</span>Tile Settings</button>` : ''}
    ${isAdmin ? `<button class="entry-type-btn" id="stab-tools" onclick="VW_SETTINGS.switchSettingsTab('tools',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">🔧</span>Tools</button>` : ''}
    ${isAdmin ? `<button class="entry-type-btn" id="stab-danger" onclick="VW_SETTINGS.switchSettingsTab('danger',this)" style="display:inline-flex"><span class="et-icon" style="color:var(--red)">⚠️</span><span style="color:var(--red)">Danger</span></button>` : ''}
    ${isAdmin ? `<button class="entry-type-btn" id="stab-costs" onclick="VW_SETTINGS.switchSettingsTab('costs',this)" style="display:inline-flex;margin-left:6px"><span class="et-icon">💰</span>Costs</button>` : ''}
    ${isAdmin ? `<button class="entry-type-btn" id="stab-labor" onclick="VW_SETTINGS.switchSettingsTab('labor',this)" style="display:inline-flex;margin-left:6px"><span class="et-icon">🏗</span>Labor</button>` : ''}
    ${isAdmin ? `<button class="entry-type-btn" id="stab-promos" onclick="VW_SETTINGS.switchSettingsTab('promos',this)" style="display:inline-flex;margin-left:6px"><span class="et-icon">🎟</span>Promos</button>` : ''}
  </div>

  <div id="settings-tab-content">
    ${await renderSettingsAccount()}
  </div>`;
}

async function switchSettingsTab(tab, btn) {
  document.querySelectorAll('[id^="stab-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('settings-tab-content');
  if (!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  switch(tab) {
    case 'account':     container.innerHTML = await renderSettingsAccount(); break;
    case 'team':        container.innerHTML = await renderSettingsTeam(); break;
    case 'permissions': container.innerHTML = await renderSettingsPermissions(); break;
    case 'store':       container.innerHTML = await renderSettingsStore(); break;
    case 'tile':        container.innerHTML = await renderTileSettings(); break;
    case 'tools':       container.innerHTML = await renderSettingsTools(); break;
    case 'danger':      container.innerHTML = await renderSettingsDanger(); break;
    case 'costs':       container.innerHTML = await VW_SETTINGS.renderCostOptimizationTab(); break;
    case 'labor':       container.innerHTML = await renderLaborSettings(); break;
    case 'promos':      container.innerHTML = await renderPromoSettings(); break;
  }
}

// ===== TAB 1: MY ACCOUNT =====
async function renderSettingsAccount() {
  const profile = VW_AUTH.getCurrentProfile();
  const pinResets = await VW_DB.all(VW_DB.STORES.pinResetRequests).then(p=>p.filter(r=>r.status==='pending'));
  return `
  <div class="card">
    <h3 class="card-title">👤 My Account</h3>
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border2);margin-bottom:12px">
      <div style="width:48px;height:48px;border-radius:50%;background:var(--gold);color:#000;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${(profile?.name||'?')[0].toUpperCase()}</div>
      <div>
        <div style="font-size:15px;font-weight:700">${profile?.name||'—'}</div>
        <div style="font-size:12px;color:var(--text3)">${profile?.role||'—'} · ${profile?.phone||'—'}</div>
      </div>
    </div>
    <div class="form-group">
      <label>Display Name</label>
      <input type="text" id="set-name" value="${profile?.name||''}">
    </div>
    <button class="btn-primary" onclick="VW_SETTINGS.saveAccountName()">Save Name</button>
  </div>

  <div class="card">
    <h3 class="card-title">🔐 Change PIN</h3>
    <div class="form-group"><label>Current PIN</label><input type="password" id="set-old-pin" maxlength="6" inputmode="numeric" placeholder="6-digit PIN"></div>
    <div class="form-group"><label>New PIN</label><input type="password" id="set-new-pin" maxlength="6" inputmode="numeric" placeholder="6-digit PIN"></div>
    <div class="form-group"><label>Confirm New PIN</label><input type="password" id="set-confirm-pin" maxlength="6" inputmode="numeric" placeholder="Repeat new PIN"></div>
    <button class="btn-primary" onclick="VW_SETTINGS.changePIN()">Change PIN</button>
  </div>

  ${pinResets.length && VW_AUTH.isAdmin() ? `
  <div class="card">
    <h3 class="card-title">🔓 PIN Reset Requests <span class="badge" style="background:var(--red)">${pinResets.length}</span></h3>
    ${pinResets.map(r => `
    <div class="task-card">
      <div style="font-size:13px;font-weight:600">${r.name||r.phone}</div>
      <div style="font-size:12px;color:var(--text3)">${r.phone} · Requested ${new Date(r.createdAt).toLocaleDateString('en-IN')}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input type="number" id="reset-pin-${r.id}" placeholder="New 6-digit PIN" maxlength="6" style="flex:1">
        <button class="btn-sm" style="background:var(--gold);color:#000" onclick="VW_SETTINGS.approveResetPin(${r.id})">Set PIN</button>
      </div>
    </div>`).join('')}
  </div>` : ''}

  <!-- LOGOUT — always visible -->
  <div class="card" style="border-color:rgba(239,68,68,0.3)">
    <h3 class="card-title" style="color:var(--text)">🚪 Session</h3>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
      Logged in as <strong>${profile?.name||'—'}</strong> · ${profile?.role||'—'} · ${profile?.phone||'—'}
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
      💡 Tip: You can also log out by tapping your name in the top-right corner of any screen.
    </div>
    <button onclick="VW_AUTH.signOut().then(()=>location.reload())"
      style="width:100%;background:rgba(239,68,68,0.1);border:1.5px solid rgba(239,68,68,0.4);border-radius:12px;padding:14px;font-size:14px;font-weight:700;color:var(--red);cursor:pointer">
      🚪 Log Out
    </button>
  </div>`;
}

async function saveAccountName() {
  const name = document.getElementById('set-name')?.value.trim();
  if (!name) { showToast('Enter a name', 'warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  const rec = await VW_DB.getById(VW_DB.STORES.profiles, profile.id);
  rec.name = name;
  await VW_DB.put(VW_DB.STORES.profiles, rec);
  showToast('Name updated', 'success');
}

async function changePIN() {
  const oldPin = document.getElementById('set-old-pin')?.value;
  const newPin = document.getElementById('set-new-pin')?.value;
  const confirmPin = document.getElementById('set-confirm-pin')?.value;
  if (newPin.length !== 6) { showToast('New PIN must be 6 digits', 'warn'); return; }
  if (newPin !== confirmPin) { showToast('PINs do not match', 'warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  const email = `${profile.phone.replace(/\D/g,'').slice(-10)}@vwholesale.app`;
  const { error } = await VW_DB.client.auth.updateUser({ password: newPin });
  if (error) { showToast('Could not change PIN — ' + error.message, 'warn'); return; }
  showToast('PIN changed successfully', 'success');
  document.getElementById('set-old-pin').value = '';
  document.getElementById('set-new-pin').value = '';
  document.getElementById('set-confirm-pin').value = '';
}

async function approveResetPin(requestId) {
  const newPin = document.getElementById(`reset-pin-${requestId}`)?.value;
  if (!newPin || newPin.length !== 6) { showToast('Enter a 6-digit PIN', 'warn'); return; }
  const req = await VW_DB.getById(VW_DB.STORES.pinResetRequests, requestId);
  if (!req) return;
  req.status = 'approved';
  req.approvedByName = VW_AUTH.getCurrentProfile()?.name||'';
  req.approvedAt = new Date().toISOString();
  req.newPin = newPin;
  await VW_DB.put(VW_DB.STORES.pinResetRequests, req);
  if (req.phone) {
    const msg = encodeURIComponent(`Hi ${req.name||''},\n\nYour V Wholesale PIN has been reset.\n\nNew PIN: *${newPin}*\n\nLog in at: https://hmehtavw.github.io/vwholesale-app/\n\nPlease change it after logging in.\n\n— V Wholesale`);
    window.open(`https://wa.me/91${req.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
  }
  showToast('PIN reset — sent to staff via WhatsApp', 'success');
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsAccount();
}

// ===== TAB 2: TEAM =====
async function renderSettingsTeam() {
  const profiles = await VW_DB.all(VW_DB.STORES.profiles);
  const roles = ['admin','management','sales_head','asm','sr_sales','executive','staff','reception','accounts','dispatch','pending'];
  const roleColors = { admin:'var(--gold)', executive:'#378ADD', staff:'#22c55e', reception:'#7F77DD', accounts:'#06b6d4', dispatch:'#f97316', pending:'#888' };
  const pending = profiles.filter(p=>p.role==='pending'||p.status==='pending');
  const active = profiles.filter(p=>p.role!=='pending'&&p.status!=='pending');

  return `
  <!-- HOW TO CHANGE PERMISSIONS GUIDE -->
  <div class="announce-card" style="margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:4px">🔐 How to edit user rights</div>
    <div style="font-size:12px;color:var(--text2);line-height:1.6">
      <b>Change role</b> — Use the dropdown next to each person below. Role sets their default page access.<br>
      <b>Edit individual permissions</b> — Tap "Edit Rights" next to any person, or go to the Permissions tab above.
    </div>
  </div>

  ${pending.length ? `
  <div class="card" style="border-color:rgba(245,200,66,0.35);margin-bottom:12px">
    <h3 class="card-title">⏳ Pending Approval <span class="badge badge-gold">${pending.length}</span></h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">New accounts awaiting role assignment</p>
    ${pending.map(p => `
    <div class="task-card">
      <div style="font-size:14px;font-weight:600;margin-bottom:8px">${p.name||'Unknown'} · <span style="color:var(--text2);font-weight:400">${p.phone||'—'}</span></div>
      <div class="form-group" style="margin:0 0 8px">
        <select id="role-select-${p.id}">
          ${roles.filter(r=>r!=='pending').map(r=>`<option value="${r}">${ROLE_DISPLAY[r]||r}</option>`).join('')}
        </select>
      </div>
      <button class="btn-primary full-width" onclick="VW_SETTINGS.approveProfile('${p.id}')">✓ Approve</button>
    </div>`).join('')}
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">Team Members <span class="badge">${active.length}</span></h3>
    ${active.map(p => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--gold-muted);color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${(p.name||'?')[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--text)">${p.name||'—'}</div>
        <div style="font-size:12px;color:var(--text2)">${p.phone||'—'}</div>
      </div>
      <select onchange="VW_SETTINGS.updateProfileRole('${p.id}',this.value)" style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;color:var(--text);max-width:90px">
        ${roles.filter(r=>r!=='pending').map(r=>`<option value="${r}" ${p.role===r?'selected':''}>${ROLE_DISPLAY[r]||r}</option>`).join('')}
      </select>
      <button class="btn-sm" onclick="VW_SETTINGS.openUserPermissions('${p.id}')" style="flex-shrink:0">🔐 Rights</button>
    </div>`).join('')}
  </div>`;
}

async function openUserPermissions(profileId) {
  const prof = await VW_DB.getById(VW_DB.STORES.profiles, profileId);
  if (!prof) return;
  const sheet = document.getElementById('bottom-sheet');
  const userPerms = prof.featurePermissions || {};

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>🔐 ${prof.name||prof.phone}</h3>
    <p class="sheet-meta">Role: <strong>${prof.role}</strong> — Toggle individual rights below. Changes apply immediately.</p>

    <div style="margin-bottom:12px;display:flex;gap:8px">
      <button class="btn-sm" onclick="VW_SETTINGS.clearUserPermissions('${profileId}');closeSheet();setTimeout(()=>VW_SETTINGS.openUserPermissions('${profileId}'),100)">Reset to role defaults</button>
    </div>

    ${Object.entries(FEATURE_PERMISSIONS).map(([featKey, feat]) => `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px;padding:6px 0;border-bottom:1px solid var(--border)">${feat.icon} ${feat.label}</div>
      ${Object.entries(feat.actions).map(([actKey, act]) => {
        const key = `${featKey}.${actKey}`;
        const hasOverride = key in userPerms;
        const roleDefault = act[prof.role] === true;
        const currentVal = hasOverride ? userPerms[key] : roleDefault;
        return `
        <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <div>
            <div style="font-size:14px;color:var(--text)">${act.label}</div>
            <div style="font-size:11px;color:var(--text3)">${hasOverride?'⚙️ Custom override':'Role default'}</div>
          </div>
          <div style="position:relative;width:44px;height:24px;flex-shrink:0">
            <input type="checkbox" ${currentVal?'checked':''} style="opacity:0;position:absolute;width:100%;height:100%;cursor:pointer;z-index:1;margin:0"
              onchange="VW_SETTINGS.setUserPermission('${profileId}','${key}',this.checked);this.closest('label').querySelector('.toggle-track').style.background=this.checked?'var(--gold)':'var(--bg3)'">
            <div class="toggle-track" style="position:absolute;inset:0;border-radius:12px;background:${currentVal?'var(--gold)':'var(--bg3)'};border:1px solid var(--border2);transition:background 0.2s"></div>
            <div style="position:absolute;top:3px;left:${currentVal?'22px':'3px'};width:18px;height:18px;border-radius:50%;background:#fff;transition:left 0.2s;pointer-events:none"></div>
          </div>
        </label>`;
      }).join('')}
    </div>`).join('')}

    <button class="btn-secondary full-width" style="margin-top:10px" onclick="closeSheet()">Done</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function approveProfile(profileId) {
  const sel = document.getElementById('role-select-'+profileId);
  const role = sel?.value || 'staff';
  const rec = await VW_DB.getById(VW_DB.STORES.profiles, profileId);
  if (!rec) return;
  rec.role = role;
  rec.status = 'approved';
  rec.approvedAt = new Date().toISOString();
  rec.approvedBy = VW_AUTH.getCurrentProfile()?.name||'';
  await VW_DB.put(VW_DB.STORES.profiles, rec);
  showToast(`${rec.name} approved as ${role}`, 'success');
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsTeam();
}

async function updateProfileRole(profileId, role) {
  const rec = await VW_DB.getById(VW_DB.STORES.profiles, profileId);
  if (!rec) return;
  rec.role = role;
  await VW_DB.put(VW_DB.STORES.profiles, rec);
  showToast(`Role updated to ${role}`, 'success');
}

// ===== TAB 3: PERMISSIONS =====
async function renderSettingsPermissions() {
  const profiles = await VW_DB.all(VW_DB.STORES.profiles);
  const nonAdmin = profiles.filter(p=>p.role!=='admin'&&p.role!=='pending'&&p.status==='approved');

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🔐 Page Access — By Person</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
      Control which sections each person can access. These are the actual navigation permissions —
      toggling a section on/off controls whether that person sees it in their app.
    </p>
    <div id="perm-people-list">
      ${nonAdmin.map(p => {
        const perms = Array.isArray(p.permissions) ? p.permissions : null;
        const activePerms = perms || [];
        return `
        <div style="padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--gold-muted);color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${(p.name||'?')[0].toUpperCase()}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600;color:var(--text)">${p.name||p.phone}</div>
              <div style="font-size:12px;color:var(--text2)">Role: ${p.role} ${perms?'· Custom permissions':'· Using role defaults'}</div>
            </div>
            ${perms ? `<button class="btn-sm" style="color:var(--text3)" onclick="VW_SETTINGS.resetToRoleDefaults('${p.id}')">Reset</button>` : ''}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${Object.entries(PERMISSION_LABELS).map(([key, label]) => {
              const isOn = perms ? activePerms.includes(key) : (ROLE_PAGES[p.role]||[]).some(pg => (PERMISSION_PAGES[key]||[]).includes(pg));
              return `<label style="display:flex;align-items:center;gap:5px;padding:5px 10px;background:${isOn?'var(--gold-muted)':'var(--bg3)'};border:1px solid ${isOn?'var(--gold)':'var(--border2)'};border-radius:20px;cursor:pointer;font-size:12px;font-weight:${isOn?'600':'400'};color:${isOn?'var(--gold)':'var(--text2)'};transition:all 0.15s">
                <input type="checkbox" ${isOn?'checked':''} style="display:none"
                  onchange="VW_SETTINGS.togglePersonPerm('${p.id}','${key}',this.checked,'${p.role}')">
                <span>${isOn?'✓':''} ${label.split(' ')[0]}</span>
              </label>`;
            }).join('')}
          </div>
        </div>`;
      }).join('') || '<p class="empty-msg">No active team members</p>'}
    </div>
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📋 Role Defaults (for reference)</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">What each role can access by default. Individual overrides above take priority.</p>
    ${['executive','reception','accounts','dispatch','staff'].map(role => `
    <div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;text-transform:capitalize">${role}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${(ROLE_PAGES[role]||[]).map(pg => `<span class="badge" style="font-size:10px">${pg}</span>`).join('')}
      </div>
    </div>`).join('')}
  </div>

  <div class="card">
    <h3 class="card-title">⚡ Feature Actions (advanced)</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:10px">Fine-grained control within pages — e.g. can view but not delete. Tap "🔐 Rights" next to any person in the Team tab.</p>
    <button class="btn-secondary full-width" onclick="VW_SETTINGS.switchSettingsTab('team', document.getElementById('stab-team'))">Go to Team → Rights buttons ↗</button>
  </div>`;
}

async function togglePersonPerm(profileId, permKey, isOn, role) {
  const prof = await VW_DB.getById(VW_DB.STORES.profiles, profileId);
  if (!prof) return;
  // Get current perms — if none set yet, start from role defaults
  let perms = Array.isArray(prof.permissions) ? [...prof.permissions] : 
    Object.keys(PERMISSION_PAGES).filter(k => (ROLE_PAGES[role]||[]).some(pg => (PERMISSION_PAGES[k]||[]).includes(pg)));
  if (isOn) { if (!perms.includes(permKey)) perms.push(permKey); }
  else { perms = perms.filter(p => p !== permKey); }
  prof.permissions = perms;
  await VW_DB.put(VW_DB.STORES.profiles, prof);
  showToast(`${prof.name}: ${PERMISSION_LABELS[permKey]?.split(' ')[0]} ${isOn?'enabled':'disabled'}`, 'success');
}

async function resetToRoleDefaults(profileId) {
  const prof = await VW_DB.getById(VW_DB.STORES.profiles, profileId);
  if (!prof) return;
  delete prof.permissions;
  await VW_DB.put(VW_DB.STORES.profiles, prof);
  showToast(`${prof.name} reset to role defaults`, 'success');
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsPermissions();
}

async function renderSettingsStore() {
  const waConfig = await VW_DB.getSetting('whatsapp_config', {});
  const loyaltyConfig = await VW_DB.getSetting('loyalty_config', { pointValue:1, earnRate:1, maxRedeemPct:10 });
  const categories = await VW_DB.getSetting('product_categories', ['Tiles','Sanitary','Electrical','Paints','Plumbing','Hardware','Plywood','Steel','Waterproofing','Glass','Appliances']);
  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📱 WhatsApp & Store Info</h3>
    <div class="form-group"><label>Store Display Name</label><input type="text" id="wa-store-name" value="${waConfig.storeName||'V Wholesale'}"></div>
    <div class="form-group"><label>Google Review URL</label>
      <input type="text" id="wa-review-url" value="${waConfig.googleReviewUrl||''}" placeholder="https://g.page/r/your-review-link/review">
      <div style="font-size:11px;color:var(--text3);margin-top:3px">Get this from Google Business Profile → Get more reviews</div>
    </div>
    <div class="form-group"><label>🖥️ Kiosk URL (open on store tablet)</label>
      <div style="display:flex;gap:8px">
        <input type="text" value="${window.location.origin}/vwholesale-app/?kiosk=1" readonly style="flex:1;font-size:11px;background:var(--bg2)">
        <button class="btn-sm" onclick="navigator.clipboard.writeText('${window.location.origin}/vwholesale-app/?kiosk=1');showToast('Kiosk URL copied!','success')">📋</button>
      </div>
    </div>
    <button class="btn-primary" onclick="VW_SETTINGS.saveWAConfig()">Save Store Info</button>
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">⭐ Loyalty Points</h3>
    <div class="form-group"><label>Points earned per ₹100 spent</label><input type="number" id="loy-earn-rate" value="${loyaltyConfig.earnRate||1}" min="0.1" step="0.1"></div>
    <div class="form-group"><label>₹ value per point redeemed</label><input type="number" id="loy-point-value" value="${loyaltyConfig.pointValue||1}" min="0.1" step="0.1"></div>
    <div class="form-group"><label>Max redemption per bill</label>
      <select id="loy-max-redeem">
        <option value="5" ${loyaltyConfig.maxRedeemPct==5?'selected':''}>5% of bill</option>
        <option value="10" ${loyaltyConfig.maxRedeemPct==10?'selected':''}>10% of bill</option>
        <option value="20" ${loyaltyConfig.maxRedeemPct==20?'selected':''}>20% of bill</option>
        <option value="100" ${loyaltyConfig.maxRedeemPct==100?'selected':''}>No limit</option>
      </select>
    </div>
    <button class="btn-primary" onclick="VW_SETTINGS.saveLoyaltyConfig()">Save Loyalty Config</button>
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🏷️ Product Categories</h3>
    <div id="categories-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      ${(categories||[]).map(c=>`<span style="padding:4px 10px;background:var(--bg2);border-radius:8px;font-size:12px;display:flex;align-items:center;gap:4px">${c}<button onclick="VW_SETTINGS.removeCategory('${c}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px">×</button></span>`).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <input type="text" id="new-category-input" placeholder="New category..." style="flex:1">
      <button class="btn-sm" onclick="VW_SETTINGS.addCategory()">+ Add</button>
    </div>
  </div>

  <div style="background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.2);border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px;color:var(--text2)">
    📦 Loading, unloading, transport rates and floor delivery charges have been moved to <strong>Tile Settings</strong> tab for a cleaner setup experience.
    <button class="btn-sm" style="margin-left:8px;margin-top:4px" onclick="VW_SETTINGS.switchSettingsTab('tile',document.getElementById('stab-tile'))">→ Open Tile Settings</button>
  </div>

  <div style="background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.2);border-radius:10px;padding:10px;font-size:12px;color:var(--text2)">
    💡 Tile weight, floor delivery rates, and tile-specific configuration → go to <strong>Tile Settings</strong> tab
    <button class="btn-sm" style="margin-left:8px" onclick="VW_SETTINGS.switchSettingsTab('tile',document.getElementById('stab-tile'))">→ Open Tile Settings</button>
  </div>`;
}

async function renderTileSettings() {
  // Load all tile config
  const weightCfg = await VW_DB.getSetting('tile_weight_config', { sizes:[] });
  const floorCfg = await VW_DB.getSetting('floor_delivery_config', {
    floor_rates_per_box:{'G':0,'1':6,'2':10,'3':14,'4':18,'5':22}
  });
  const groutCfg = await VW_DB.getSetting('tile_grout_config', {
    joint_width_default_mm: 3,
    density_factor: 1.6,
    wastage_pct: 5,
  });
  const spacerCfg = await VW_DB.getSetting('tile_spacer_config', {
    pcs_per_packet: 100, clip_pcs_per_packet: 50, spacers_per_tile: 4, min_size_mm: 300,
  });
  const wastageCfg = await VW_DB.getSetting('tile_wastage_config', { breakage_pct: 10 });
  const vehicleCfg = await VW_DB.getSetting('vehicle_config', {
    free_km: 5,
    vehicles: [
      { id:'auto', icon:'🛺', label:'Auto / Three Wheeler', max_kg:300, per_km:20, min_charge:250, free_km:5 },
      { id:'appe', icon:'🛺', label:'Appe / Compact 3-Wheeler', max_kg:600, per_km:35, min_charge:500, free_km:5 },
      { id:'tata_ace', icon:'🚐', label:'Tata Ace / Mini Truck', max_kg:1200, per_km:40, min_charge:750, free_km:5 },
      { id:'dost', icon:'🚛', label:'Dost / Medium Truck', max_kg:3500, per_km:50, min_charge:1250, free_km:5 },
    ],
  });

  // All tile sizes from TILE_SIZES constant in tiles_granite.js
  // Exact inch conversion: mm ÷ 25.4 = inches, sqft = (L_inch × W_inch) / 144
  function mmToSqft(mm) {
    const [l,w] = mm.split('×').map(Number);
    if(!l||!w) return 0;
    const li = l/25.4, wi = w/25.4;
    return Math.round((li*wi/144)*1000)/1000; // keep 3 decimal places, no rounding
  }
  const SIZES = window.TILE_SIZES_SETTINGS || [
    {mm:'100×100'},{mm:'150×150'},{mm:'200×200'},{mm:'200×300'},{mm:'250×375'},
    {mm:'300×300'},{mm:'300×450'},{mm:'300×600'},{mm:'400×400'},{mm:'400×800'},
    {mm:'450×900'},{mm:'600×600'},{mm:'600×900'},{mm:'600×1200'},{mm:'800×800'},
    {mm:'800×1600'},{mm:'1000×1000'},{mm:'1200×1200'},{mm:'1200×1800'},
    {mm:'2400×800'},{mm:'3000×800'},{mm:'1200×2400'},{mm:'800×2400'},
  ];

  // Merge stored weights into size list
  const weightMap = {};
  (weightCfg?.sizes||[]).forEach(s => { weightMap[s.mm] = s; });
  const sizeRows = SIZES.map(s => ({
    ...s,
    weight: weightMap[s.mm]?.weight_per_box || '',
    sqft: mmToSqft(s.mm),
    tiles_per_box: weightMap[s.mm]?.tiles_per_box || '',
    thickness_mm: weightMap[s.mm]?.thickness_mm || '',
    spacer_required: weightMap[s.mm]?.spacer_required !== false,
    spacers_per_tile: weightMap[s.mm]?.spacers_per_tile || '',
    loading_per_box: weightMap[s.mm]?.loading_per_box ?? 20,
    active: weightMap[s.mm]?.active !== false,
  }));

  return `
  <div class="module-header" style="margin-bottom:14px">
    <h2 style="font-size:16px">🔲 Tile Settings</h2>
    <button class="btn-sm" style="background:var(--gold);color:#000" onclick="VW_SETTINGS.saveTileSettings()">💾 Save All</button>
  </div>


  <!-- TILE SIZE MASTER TABLE -->
  <div class="card" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 class="card-title" style="margin:0">📐 Tile Size Configuration</h3>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" onclick="VW_SETTINGS.autoFillDefaultWeights()">⚡ Auto-fill</button>
        <button class="btn-sm" onclick="VW_SETTINGS.addCustomSize()">+ Add Size</button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
      Sqft/tile = (L × W in inches) ÷ 144 · Exact 3-decimal precision · Checkboxes auto-save on change
    </div>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:760px">
        <thead>
          <tr style="border-bottom:2px solid var(--border);background:var(--bg2)">
            <th style="text-align:left;padding:8px 6px;color:var(--text3);font-weight:600;white-space:nowrap">Size (mm)</th>
            <th style="text-align:center;padding:8px 4px;color:var(--gold);font-weight:700">Sqft/pc</th>
            <th style="text-align:center;padding:8px 4px;color:var(--text3);font-weight:600">Tiles/Box</th>
            <th style="text-align:center;padding:8px 4px;color:var(--text3);font-weight:600">Thick mm</th>
            <th style="text-align:center;padding:8px 4px;color:var(--text3);font-weight:600">Wt/Box kg</th>
            <th style="text-align:center;padding:8px 4px;color:var(--gold);font-weight:700;white-space:nowrap">₹/box Load</th>
            <th style="text-align:center;padding:8px 4px;color:var(--text3);font-weight:600">Spacer ✓</th>
            <th style="text-align:center;padding:8px 4px;color:var(--text3);font-weight:600;white-space:nowrap">Spacers/Tile</th>
            <th style="text-align:center;padding:8px 4px;color:var(--text3);font-weight:600">Active ✓</th>
            <th style="text-align:center;padding:8px 4px;color:var(--text3);font-weight:600">Del</th>
          </tr>
        </thead>
        <tbody id="ts-size-tbody">
          ${sizeRows.map((s, i) => `
          <tr id="ts-row-${i}" style="border-bottom:1px solid var(--border2);${!s.active?'opacity:0.5':''}">
            <td style="padding:7px 6px;font-weight:700;white-space:nowrap;font-size:13px">${s.mm}
              <div style="font-size:9px;color:var(--text3);font-weight:400">${(() => {
                const [l,w] = s.mm.split('×').map(Number);
                const li = Math.round(l/25.4*10)/10, wi = Math.round(w/25.4*10)/10;
                return li+'×'+wi+'"';
              })()}</div>
            </td>
            <td style="text-align:center;padding:7px 4px;color:var(--gold);font-weight:800;font-size:13px">${s.sqft}</td>
            <td style="text-align:center;padding:4px 2px">
              <input type="number" id="ts-tpb-${i}" value="${s.tiles_per_box||''}" placeholder="—"
                style="width:46px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)" min="1" step="1"
                onchange="VW_SETTINGS.saveTileWeightTable()">
            </td>
            <td style="text-align:center;padding:4px 2px">
              <input type="number" id="ts-thick-${i}" value="${s.thickness_mm||''}" placeholder="—"
                style="width:46px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)" min="5" max="25" step="1"
                onchange="VW_SETTINGS.saveTileWeightTable()">
            </td>
            <td style="text-align:center;padding:4px 2px">
              <input type="number" id="ts-wt-${i}" value="${s.weight||''}" placeholder="—"
                style="width:50px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)" min="1" max="150" step="0.5"
                onchange="VW_SETTINGS.saveTileWeightTable()">
            </td>
            <td style="text-align:center;padding:4px 2px">
              <input type="number" id="ts-load-${i}" value="${s.loading_per_box??20}" placeholder="20"
                style="width:50px;text-align:center;background:var(--bg2);border:1.5px solid var(--gold-border);border-radius:6px;padding:3px;font-size:12px;font-weight:700;color:var(--gold)" min="0" step="1"
                onchange="VW_SETTINGS.saveTileWeightTable()" title="Loading + unloading charge per box for this tile size">
            </td>
            <td style="text-align:center;padding:4px 2px">
              <input type="checkbox" id="ts-spc-${i}" ${s.spacer_required?'checked':''}
                style="width:18px;height:18px;cursor:pointer" onchange="VW_SETTINGS.saveTileWeightTable()">
            </td>
            <td style="text-align:center;padding:4px 2px">
              <input type="number" id="ts-spt-${i}" value="${s.spacers_per_tile||''}" placeholder="auto"
                style="width:52px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)" min="2" max="12" step="1"
                onchange="VW_SETTINGS.saveTileWeightTable()" title="Spacers per tile piece for this size">
            </td>
            <td style="text-align:center;padding:4px 2px">
              <input type="checkbox" id="ts-act-${i}" ${s.active?'checked':''}
                style="width:18px;height:18px;cursor:pointer"
                onchange="document.getElementById('ts-row-${i}').style.opacity=this.checked?'1':'0.5';VW_SETTINGS.saveTileWeightTable()">
            </td>
            <td style="text-align:center;padding:4px 2px">
              <button onclick="VW_SETTINGS.deleteTileSize(${i})"
                style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px" title="Delete size">✕</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-primary" style="flex:1" onclick="VW_SETTINGS.saveTileWeightTable()">💾 Save All Changes</button>
    </div>
  </div>

  <!-- FLOOR DELIVERY RATES -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">🏢 Floor Delivery Rates</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:4px">Extra carrying charge per box when delivery is above ground floor. Loading & unloading rates are now set per tile size in the table above (₹/box Load column).</p>
    <div style="font-size:11px;color:var(--text3);background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:8px;padding:8px;margin-bottom:12px">
      💡 Set ₹0 for Ground floor. These charges stack on top of the per-tile loading rate.
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:2px solid var(--border)">
          ${['Ground','1st Floor','2nd Floor','3rd Floor','4th Floor','5th Floor'].map((f,i)=>
            `<th style="text-align:center;padding:6px;color:var(--text3);font-weight:600">${f}</th>`).join('')}
        </tr></thead>
        <tbody><tr>
          ${['G','1','2','3','4','5'].map(fl => `
          <td style="text-align:center;padding:6px 4px">
            <div style="background:var(--bg2);border-radius:8px;padding:8px 4px">
              <input type="number" id="ts-floor-${fl}" value="${(floorCfg?.floor_rates_per_box||{})[fl]||0}" min="0" step="1"
                style="width:50px;text-align:center;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:4px;font-size:13px;font-weight:700;color:var(--text)">
              <div style="font-size:10px;color:var(--text3);margin-top:2px">₹/box</div>
            </div>
          </td>`).join('')}
        </tr></tbody>
      </table>
    </div>
    <button class="btn-primary full-width" style="margin-top:12px" onclick="VW_SETTINGS.saveFloorConfig()">💾 Save Floor Rates</button>
  </div>

  <!-- GROUT FORMULA CONFIG -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">🧪 Grout Formula (Saint-Gobain)</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">Formula: ((L+W)/(L×W)) × Thickness × JointWidth × Area_m² × DensityFactor × (1 + Wastage%)</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div class="form-group" style="margin:0">
        <label>Default Joint Width (mm)</label>
        <input type="number" id="ts-grout-joint" value="${groutCfg.joint_width_default_mm||3}" min="1" max="10" step="1">
      </div>
      <div class="form-group" style="margin:0">
        <label>Density Factor</label>
        <input type="number" id="ts-grout-density" value="${groutCfg.density_factor||1.6}" min="1" max="2.5" step="0.1">
        <div style="font-size:10px;color:var(--text3)">Saint-Gobain = 1.6</div>
      </div>
      <div class="form-group" style="margin:0">
        <label>Wastage % buffer</label>
        <input type="number" id="ts-grout-waste" value="${groutCfg.wastage_pct||5}" min="0" max="20" step="1">
      </div>
    </div>
    <button class="btn-primary" style="margin-top:10px" onclick="VW_SETTINGS.saveGroutConfig()">💾 Save Grout Config</button>
  </div>

  <!-- TILE WASTE BUFFER -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">🛡 Tile Waste Buffer</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:10px">Single buffer added to the net area covering cut waste, offcuts, and breakage. Applied to every tile quote using the formula: net sqft × (1 + buffer%) ÷ sqft-per-tile.</p>
    <div class="form-group" style="margin:0;max-width:200px">
      <label>Default Waste Buffer %</label>
      <input type="number" id="ts-breakage-pct" value="${wastageCfg.breakage_pct ?? 10}" min="0" max="25" step="1">
      <div style="font-size:10px;color:var(--text3)">Recommended: 10% (covers cutting, offcuts, handling). Plain small tiles can go 7–8%; diagonal/pattern layouts 12–15%.</div>
    </div>
    <button class="btn-primary" style="margin-top:10px" onclick="VW_SETTINGS.saveBreakageConfig()">💾 Save Waste Buffer</button>
  </div>

  <!-- SPACER CONFIG -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">📦 Spacer Configuration</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:10px">Two spacer types: Cross/Plus (single packet) and Clip+Plug leveling (clip & plug bought separately). Per-tile quantity is set per size in the table above.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group" style="margin:0">
        <label>✚ Cross / Plus — pcs/packet</label>
        <input type="number" id="ts-spacer-pkt" value="${spacerCfg.pcs_per_packet||100}" min="10" step="10">
        <div style="font-size:10px;color:var(--text3)">Standard + spacers · usually 100</div>
      </div>
      <div class="form-group" style="margin:0">
        <label>📎 Clip + Plug — pcs/packet</label>
        <input type="number" id="ts-spacer-clip-pkt" value="${spacerCfg.clip_pcs_per_packet||50}" min="10" step="10">
        <div style="font-size:10px;color:var(--text3)">Leveling clips & plugs · usually 50 each</div>
      </div>
      <div class="form-group" style="margin:0">
        <label>Default spacers per tile</label>
        <input type="number" id="ts-spacer-tile" value="${spacerCfg.spacers_per_tile||4}" min="2" max="12" step="1">
        <div style="font-size:10px;color:var(--text3)">Fallback when a size has no per-tile value</div>
      </div>
      <div class="form-group" style="margin:0">
        <label>Min size for spacer (mm)</label>
        <input type="number" id="ts-spacer-min" value="${spacerCfg.min_size_mm||300}" min="100" step="50">
        <div style="font-size:10px;color:var(--text3)">Below this = no spacer needed</div>
      </div>
    </div>
    <button class="btn-primary" style="margin-top:10px" onclick="VW_SETTINGS.saveSpacerConfig()">💾 Save Spacer Config</button>
  </div>

  <!-- TRANSPORT CONFIG — per vehicle rates -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">🚛 Transport Rates</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:4px">Vehicle is auto-selected by total shipment weight. Rates apply per km beyond the free km distance.</p>
    <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:8px;padding:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:12px;color:var(--text2)">🎁 Free delivery within <strong>${vehicleCfg?.free_km ?? 5} km</strong> (first 5km included in min charge)</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;color:var(--text3)">Free km:</span>
        <input type="number" id="ts-free-km" value="${vehicleCfg?.free_km ?? 5}" min="0" max="20" step="1"
          style="width:50px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px;font-size:13px;font-weight:700;color:var(--text);text-align:center">
      </div>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:520px">
        <thead>
          <tr style="border-bottom:2px solid var(--border);background:var(--bg2)">
            <th style="text-align:left;padding:8px 6px;color:var(--text3);font-weight:600">Vehicle</th>
            <th style="text-align:center;padding:8px 4px;color:var(--text3);font-weight:600">Max Weight</th>
            <th style="text-align:center;padding:8px 4px;color:var(--gold);font-weight:700">Min Charge ₹</th>
            <th style="text-align:center;padding:8px 4px;color:var(--gold);font-weight:700">₹/km (beyond free)</th>
          </tr>
        </thead>
        <tbody>
          ${(vehicleCfg?.vehicles || []).map((v, i) => `
          <tr style="border-bottom:1px solid var(--border2)">
            <td style="padding:8px 6px">
              <span style="font-size:16px;margin-right:6px">${v.icon||'🚚'}</span>
              <span style="font-weight:600">${v.label||v.id}</span>
            </td>
            <td style="text-align:center;padding:4px;color:var(--text3);font-size:11px">${v.max_kg >= 9999 ? '—' : v.max_kg+'kg'}</td>
            <td style="text-align:center;padding:4px 2px">
              <input type="number" id="ts-veh-min-${i}" value="${v.min_charge||0}" min="0" step="50"
                style="width:70px;text-align:center;background:var(--bg2);border:1px solid var(--gold-border);border-radius:6px;padding:4px;font-size:13px;font-weight:700;color:var(--gold)">
            </td>
            <td style="text-align:center;padding:4px 2px">
              <input type="number" id="ts-veh-km-${i}" value="${v.per_km||0}" min="0" step="1"
                style="width:70px;text-align:center;background:var(--bg2);border:${v.per_km>0?'1px solid var(--gold-border)':'1px solid var(--border)'};border-radius:6px;padding:4px;font-size:13px;font-weight:700;color:${v.per_km>0?'var(--gold)':'var(--text2)'}">
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <button class="btn-primary full-width" style="margin-top:12px" onclick="VW_SETTINGS.saveVehicleConfig()">💾 Save Transport Rates</button>
  </div>`;
}

async function saveVehicleConfig() {
  const existing = await VW_DB.getSetting('vehicle_config', { vehicles:[], free_km:5 });
  const freeKm = parseInt(document.getElementById('ts-free-km')?.value||5)||5;
  const vehicles = (existing.vehicles||[]).map((v, i) => ({
    ...v,
    min_charge: parseFloat(document.getElementById(`ts-veh-min-${i}`)?.value ?? v.min_charge) || 0,
    per_km: parseFloat(document.getElementById(`ts-veh-km-${i}`)?.value ?? v.per_km) || 0,
    free_km: freeKm,
  }));
  await VW_DB.setSetting('vehicle_config', { ...existing, vehicles, free_km: freeKm });
  showToast('Transport rates saved ✓', 'success');
}
const ALL_TILE_SIZES_DEFAULT = [
  '100×100','150×150','200×200','200×300','250×375',
  '300×300','300×450','300×600','400×400','400×800',
  '450×900','600×600','600×900','600×1200','800×800',
  '800×1600','1000×1000','1200×1200','1200×1800',
  '2400×800','3000×800','1200×2400','800×2400',
];


async function saveTileWeightTable() {
  const tbody = document.getElementById('ts-size-tbody');
  if (!tbody) { showToast('Tile size table not visible', 'warn'); return; }
  const rows = tbody.querySelectorAll('tr[id^="ts-row-"]');
  const sizes = [];
  rows.forEach((row, i) => {
    const mmEl = row.querySelector('td:first-child');
    const mm = mmEl?.textContent?.trim().split('\n')[0]?.trim();
    if (!mm) return;
    const [l,w] = mm.split('×').map(Number);
    const li = l/25.4, wi = w/25.4;
    const sqft = Math.round(li*wi/144*1000)/1000;
    sizes.push({
      mm,
      sqft,
      tiles_per_box: parseFloat(document.getElementById(`ts-tpb-${i}`)?.value||0)||null,
      thickness_mm: parseFloat(document.getElementById(`ts-thick-${i}`)?.value||0)||null,
      weight_per_box: parseFloat(document.getElementById(`ts-wt-${i}`)?.value||0)||null,
      loading_per_box: parseFloat(document.getElementById(`ts-load-${i}`)?.value||20)||20,
      spacer_required: document.getElementById(`ts-spc-${i}`)?.checked !== false,
      spacers_per_tile: parseInt(document.getElementById(`ts-spt-${i}`)?.value||0)||null,
      active: document.getElementById(`ts-act-${i}`)?.checked !== false,
    });
  });
  await VW_DB.setSetting('tile_weight_config', { sizes });
  showToast('Saved ✓', 'success');
}

async function deleteTileSize(i) {
  if (!confirm('Delete this tile size?')) return;
  const row = document.getElementById(`ts-row-${i}`);
  if (row) { row.remove(); await saveTileWeightTable(); }
}

async function addCustomSize() {
  const mm = prompt('Enter size in mm (e.g. 1500×3000):');
  if (!mm || !mm.includes('×')) { showToast('Enter format like 600×1200', 'warn'); return; }
  const tbody = document.getElementById('ts-size-tbody');
  if (!tbody) return;
  const i = tbody.querySelectorAll('tr').length;
  const [l,w] = mm.split('×').map(Number);
  const li = l/25.4, wi = w/25.4;
  const sqft = Math.round(li*wi/144*1000)/1000;
  const tr = document.createElement('tr');
  tr.id = `ts-row-${i}`;
  tr.style.borderBottom = '1px solid var(--border2)';
  tr.innerHTML = `
    <td style="padding:7px 6px;font-weight:700;white-space:nowrap;font-size:13px">${mm}</td>
    <td style="text-align:center;padding:7px 4px;color:var(--gold);font-weight:800">${sqft}</td>
    <td style="text-align:center;padding:4px 2px"><input type="number" id="ts-tpb-${i}" placeholder="—" style="width:46px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)" onchange="VW_SETTINGS.saveTileWeightTable()"></td>
    <td style="text-align:center;padding:4px 2px"><input type="number" id="ts-thick-${i}" placeholder="—" style="width:46px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)" onchange="VW_SETTINGS.saveTileWeightTable()"></td>
    <td style="text-align:center;padding:4px 2px"><input type="number" id="ts-wt-${i}" placeholder="—" style="width:50px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)" onchange="VW_SETTINGS.saveTileWeightTable()"></td>
    <td style="text-align:center;padding:4px 2px"><input type="checkbox" id="ts-spc-${i}" checked style="width:18px;height:18px" onchange="VW_SETTINGS.saveTileWeightTable()"></td>
    <td style="text-align:center;padding:4px 2px"><input type="number" id="ts-spt-${i}" placeholder="auto" style="width:52px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)" min="2" max="12" step="1" onchange="VW_SETTINGS.saveTileWeightTable()"></td>
    <td style="text-align:center;padding:4px 2px"><input type="checkbox" id="ts-act-${i}" checked style="width:18px;height:18px" onchange="VW_SETTINGS.saveTileWeightTable()"></td>
    <td style="text-align:center;padding:4px 2px"><button onclick="VW_SETTINGS.deleteTileSize(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px">✕</button></td>
  `;
  tbody.appendChild(tr);
  showToast(`${mm} added — fill in details and save`, 'info');
}

async function saveFloorConfig() {
  const floor_rates_per_box = {};
  ['G','1','2','3','4','5'].forEach(fl => {
    floor_rates_per_box[fl] = parseFloat(document.getElementById(`ts-floor-${fl}`)?.value||document.getElementById(`fl-floor-${fl}`)?.value||0)||0;
  });
  // Preserve existing loading values so Summary fallback still works if ever needed
  const existing = await VW_DB.getSetting('floor_delivery_config', {});
  await VW_DB.setSetting('floor_delivery_config', {
    ...existing,
    floor_rates_per_box,
  });
  showToast('Floor delivery rates saved ✓', 'success');
}

async function saveGroutConfig() {
  await VW_DB.setSetting('tile_grout_config', {
    joint_width_default_mm: parseFloat(document.getElementById('ts-grout-joint')?.value||3)||3,
    density_factor: parseFloat(document.getElementById('ts-grout-density')?.value||1.6)||1.6,
    wastage_pct: parseFloat(document.getElementById('ts-grout-waste')?.value||5)||5,
  });
  showToast('Grout config saved ✓', 'success');
}

async function saveBreakageConfig() {
  const pct = Math.max(0, Math.min(20, parseFloat(document.getElementById('ts-breakage-pct')?.value||5)||0));
  await VW_DB.setSetting('tile_wastage_config', { breakage_pct: pct });
  showToast('Breakage buffer saved ✓ — applies to new quotes', 'success');
}

async function saveSpacerConfig() {
  await VW_DB.setSetting('tile_spacer_config', {
    pcs_per_packet: parseInt(document.getElementById('ts-spacer-pkt')?.value||100)||100,
    clip_pcs_per_packet: parseInt(document.getElementById('ts-spacer-clip-pkt')?.value||50)||50,
    spacers_per_tile: parseInt(document.getElementById('ts-spacer-tile')?.value||4)||4,
    min_size_mm: parseInt(document.getElementById('ts-spacer-min')?.value||300)||300,
  });
  showToast('Spacer config saved ✓', 'success');
}

async function autoFillDefaultWeights() {
  // Standard weight defaults per tile industry norms
  const defaults = {
    '100×100':3, '150×150':4, '200×200':6, '200×300':7,
    '300×300':10,'300×450':12,'300×600':14,'400×400':16,
    '400×800':20,'450×900':22,'600×600':24,'600×900':28,
    '600×1200':32,'800×800':30,'800×1600':38,'1000×1000':40,
  };
  const defaultTiles = {
    '100×100':25,'150×150':25,'200×200':18,'200×300':15,
    '300×300':12,'300×450':10,'300×600':8,'400×400':8,
    '400×800':6,'450×900':5,'600×600':4,'600×900':3,
    '600×1200':3,'800×800':2,'800×1600':2,'1000×1000':1,
  };
  const defaultThick = {
    '100×100':7,'150×150':7,'200×200':8,'200×300':8,
    '300×300':8,'300×450':8,'300×600':8,'400×400':9,
    '400×800':9,'450×900':9,'600×600':9,'600×900':9,
    '600×1200':9,'800×800':9,'800×1600':10,'1000×1000':10,
  };
  const SIZES = window.TILE_SIZES_SETTINGS || [
    {mm:'100×100'},{mm:'150×150'},{mm:'200×200'},{mm:'200×300'},
    {mm:'300×300'},{mm:'300×450'},{mm:'300×600'},{mm:'400×400'},
    {mm:'400×800'},{mm:'450×900'},{mm:'600×600'},{mm:'600×900'},
    {mm:'600×1200'},{mm:'800×800'},{mm:'800×1600'},{mm:'1000×1000'},
  ];
  SIZES.forEach((s, i) => {
    const wt = document.getElementById(`ts-wt-${i}`);
    const tpb = document.getElementById(`ts-tpb-${i}`);
    const thick = document.getElementById(`ts-thick-${i}`);
    if (wt && !wt.value) wt.value = defaults[s.mm] || '';
    if (tpb && !tpb.value) tpb.value = defaultTiles[s.mm] || '';
    if (thick && !thick.value) thick.value = defaultThick[s.mm] || '';
  });
  showToast('Default weights filled — review then Save', 'info');
}

async function saveTileSettings() {
  await saveTileWeightTable();
  await saveFloorConfig();
  await saveGroutConfig();
  await saveSpacerConfig();
}


let _packingRules = [];
let _categories = [];
let _escalationContacts = [];

async function saveWAConfig() {
  await VW_DB.setSetting('whatsapp_config', {
    storeName: document.getElementById('wa-store-name')?.value.trim()||'V Wholesale',
    googleReviewUrl: document.getElementById('wa-review-url')?.value.trim()||''
  });
  showToast('Store info saved', 'success');
}

async function saveLoyaltyConfig() {
  const cfg = {
    earnRate: parseFloat(document.getElementById('loy-earn-rate')?.value)||1,
    pointValue: parseFloat(document.getElementById('loy-point-value')?.value)||1,
    maxRedeemPct: parseFloat(document.getElementById('loy-max-redeem')?.value)||10
  };
  await VW_DB.setSetting('loyalty_config', cfg);
  window._loyaltyConfig = cfg;
  showToast('Loyalty config saved', 'success');
}

async function addCategory() {
  const val = document.getElementById('new-category-input')?.value.trim();
  if (!val) return;
  const cats = await VW_DB.getSetting('product_categories', []);
  if (!cats.includes(val)) { cats.push(val); await VW_DB.setSetting('product_categories', cats); }
  document.getElementById('new-category-input').value = '';
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsStore();
}

async function removeCategory(cat) {
  const cats = await VW_DB.getSetting('product_categories', []);
  await VW_DB.setSetting('product_categories', cats.filter(c=>c!==cat));
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsStore();
}

async function addPackingRule() {
  const rules = await VW_DB.getSetting('packing_charge_rules', []);
  rules.push({ minAmount: 0, maxAmount: null, charge: 0 });
  await VW_DB.setSetting('packing_charge_rules', rules);
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsStore();
}

async function removePackingRule(idx) {
  const rules = await VW_DB.getSetting('packing_charge_rules', []);
  rules.splice(idx, 1);
  await VW_DB.setSetting('packing_charge_rules', rules);
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsStore();
}

async function updatePackingRule(idx, field, val) {
  const rules = await VW_DB.getSetting('packing_charge_rules', []);
  if (rules[idx]) rules[idx][field] = parseFloat(val)||0;
  await VW_DB.setSetting('packing_charge_rules', rules);
}

async function savePackingRules() {
  showToast('Packing rules saved', 'success');
}

// ===== LOADING CONFIG =====
let _loadingConfig = null;

async function addLoadingRule() {
  const cfg = await VW_DB.getSetting('loading_config', { rules:[] });
  cfg.rules = cfg.rules || [];
  cfg.rules.push({ category:'', chargePerUnit:0, unit:'box', minCharge:0 });
  await VW_DB.setSetting('loading_config', cfg);
  const c = document.getElementById('settings-tab-content');
  if (c) c.innerHTML = await renderSettingsStore();
}

async function removeLoadingRule(idx) {
  const cfg = await VW_DB.getSetting('loading_config', { rules:[] });
  cfg.rules.splice(idx, 1);
  await VW_DB.setSetting('loading_config', cfg);
  const c = document.getElementById('settings-tab-content');
  if (c) c.innerHTML = await renderSettingsStore();
}

async function updateLoadingRule(idx, field, val) {
  const cfg = _loadingConfig || await VW_DB.getSetting('loading_config', { rules:[] });
  if (cfg.rules[idx]) cfg.rules[idx][field] = isNaN(val) ? val : (parseFloat(val)||0);
  _loadingConfig = cfg;
  await VW_DB.setSetting('loading_config', cfg);
}

async function saveLoadingConfig() {
  const cfg = _loadingConfig || await VW_DB.getSetting('loading_config', { rules:[] });
  cfg.ccSilverDiscount = parseFloat(document.getElementById('cc-silver-disc')?.value)||10;
  cfg.ccGoldDiscount = parseFloat(document.getElementById('cc-gold-disc')?.value)||20;
  await VW_DB.setSetting('loading_config', cfg);
  _loadingConfig = null;
  showToast('Loading rules saved ✓', 'success');
}

async function saveTransportConfig() {
  const cfg = {
    lightVehiclePerKm: parseFloat(document.getElementById('transport-light')?.value)||25,
    heavyVehiclePerKm: parseFloat(document.getElementById('transport-heavy')?.value)||45,
    minimumCharge: parseFloat(document.getElementById('transport-min')?.value)||300,
    freeAbove: parseFloat(document.getElementById('transport-free-above')?.value)||0,
    storeLat: parseFloat(document.getElementById('store-lat')?.value)||16.5206153,
    storeLng: parseFloat(document.getElementById('store-lng')?.value)||80.5999189,
  };
  await VW_DB.setSetting('transport_config', cfg);
  showToast('Transport config saved ✓', 'success');
}

async function saveTileWeights() {
  const current = await VW_DB.getSetting('tile_weight_config', {sizes:[]});
  const updated = (current.sizes||[]).map((s,i) => ({
    ...s,
    weight_per_box: parseFloat(document.getElementById(`twt-${i}`)?.value) || s.weight_per_box || 0,
  }));
  await VW_DB.setSetting('tile_weight_config', {...current, sizes:updated});
  showToast('Tile weights saved ✓', 'success');
}

// saveFloorConfig moved to renderTileSettings section above

async function saveEscalationConfig() {
  const cfg = {
    tlMinutes: parseInt(document.getElementById('esc-tl-mins')?.value)||60,
    fmMinutes: parseInt(document.getElementById('esc-fm-mins')?.value)||180,
    smMinutes: parseInt(document.getElementById('esc-sm-mins')?.value)||360,
    managementPhone: document.getElementById('esc-mgmt-phone')?.value.trim()||'',
    businessHoursStart: 9,
    businessHoursEnd: 21,
  };
  await VW_DB.setSetting('escalation_config', cfg);
  showToast('Escalation config saved ✓', 'success');
}

// ===== LOADING CHARGE CALCULATOR =====
async function calculateLoadingCharge(items, ccTier) {
  const cfg = await VW_DB.getSetting('loading_config', { rules:[], ccSilverDiscount:10, ccGoldDiscount:20 });
  const rules = cfg.rules || [];
  const HEAVY_CATS = ['tiles','granite','sanitary'];
  let total = 0;
  for (const item of items) {
    const cat = (item.category||item.department||'').toLowerCase();
    if (!HEAVY_CATS.some(h => cat.includes(h))) continue;
    const rule = rules.find(r => r.category && cat.includes(r.category.toLowerCase()));
    if (!rule) continue;
    const charge = Math.max(rule.minCharge||0, (item.qty||1) * (rule.chargePerUnit||0));
    total += charge;
  }
  if (total > 0 && ccTier) {
    const discPct = ccTier === 'Gold' ? (cfg.ccGoldDiscount||20) : ccTier === 'Silver' ? (cfg.ccSilverDiscount||10) : 0;
    total = Math.round(total * (1 - discPct/100));
  }
  return Math.round(total);
}

// ===== TRANSPORT CHARGE CALCULATOR =====
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function calculateTransportCharge(siteLat, siteLng, isHeavyVehicle, orderTotal) {
  const cfg = await VW_DB.getSetting('transport_config', {
    lightVehiclePerKm:25, heavyVehiclePerKm:45, minimumCharge:300, freeAbove:0,
    storeLat:16.5206153, storeLng:80.5999189
  });
  if (cfg.freeAbove > 0 && orderTotal >= cfg.freeAbove) return { charge:0, km:0, reason:'Free above ₹'+cfg.freeAbove };
  if (!siteLat || !siteLng) return { charge: cfg.minimumCharge||300, km:0, reason:'Min charge (no GPS)' };
  const km = haversineKm(cfg.storeLat, cfg.storeLng, siteLat, siteLng);
  const rate = isHeavyVehicle ? (cfg.heavyVehiclePerKm||45) : (cfg.lightVehiclePerKm||25);
  const charge = Math.max(cfg.minimumCharge||300, Math.round(km * rate));
  return { charge, km: Math.round(km*10)/10, rate, reason:`${Math.round(km*10)/10}km × ₹${rate}/km` };
}

window.calculateLoadingCharge = calculateLoadingCharge;
window.calculateTransportCharge = calculateTransportCharge;
window.haversineKm = haversineKm;

async function addEscalation() {
  const contacts = await VW_DB.getSetting('escalation_contacts', []);
  contacts.push({ name: '', phone: '' });
  await VW_DB.setSetting('escalation_contacts', contacts);
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsStore();
}

async function removeEscalation(idx) {
  const contacts = await VW_DB.getSetting('escalation_contacts', []);
  contacts.splice(idx, 1);
  await VW_DB.setSetting('escalation_contacts', contacts);
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsStore();
}

async function updateEscalation(idx, field, val) {
  const contacts = await VW_DB.getSetting('escalation_contacts', []);
  if (contacts[idx]) contacts[idx][field] = val;
  await VW_DB.setSetting('escalation_contacts', contacts);
}

async function saveEscalation() {
  showToast('Escalation contacts saved', 'success');
}

// ===== TAB 5: TOOLS =====
async function renderSettingsTools() {
  const pendingProducts = await VW_DB.all(VW_DB.STORES.pendingProducts).then(p=>p.filter(x=>x.status==='pending'));
  const promoCodes = await VW_DB.getSetting('promo_codes', {});

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📥 Download Entire Data</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">Export all invoices, customers, products, staff, attendance, quotations as Excel</p>
    <button class="btn-primary full-width" onclick="VW_SETTINGS.downloadAllData()">📊 Download All Data</button>
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🧪 Auto Testing</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">Run automated smoke tests to verify app health, database, and feature status</p>
    <button class="btn-secondary full-width" onclick="navigateTo('autotest')">▶ Open Test Suite</button>
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🎟️ Promo Codes & Gift Vouchers</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">Create discount codes usable at billing checkout</p>
    <div id="promo-codes-list">
      ${Object.entries(promoCodes).length ? Object.entries(promoCodes).map(([code, promo]) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--gold)">${code}</div>
          <div style="font-size:12px;color:var(--text2)">${promo.type==='pct'?promo.value+'% off':'₹'+promo.value+' off'} · ${promo.label||''} ${promo.expiry?'· Expires '+promo.expiry:''}</div>
        </div>
        <button class="btn-sm" style="color:var(--red)" onclick="VW_SETTINGS.deletePromoCode('${code}')">Remove</button>
      </div>`).join('') : '<p class="empty-msg">No promo codes yet</p>'}
    </div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px">Add New Code</div>
      <div class="form-group"><label>Code</label><input type="text" id="new-promo-code" placeholder="e.g. DIWALI10" style="text-transform:uppercase"></div>
      <div class="form-group"><label>Label</label><input type="text" id="new-promo-label" placeholder="e.g. Diwali Special"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group"><label>Type</label><select id="new-promo-type"><option value="pct">% Discount</option><option value="flat">Flat ₹ Off</option></select></div>
        <div class="form-group"><label>Value</label><input type="number" id="new-promo-value" placeholder="10 or 500"></div>
      </div>
      <div class="form-group"><label>Expiry (optional)</label><input type="date" id="new-promo-expiry"></div>
      <button class="btn-primary full-width" onclick="VW_SETTINGS.addPromoCode()">Add Code</button>
    </div>
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📦 Pending Product Approvals <span class="badge">${pendingProducts.length}</span></h3>
    ${!pendingProducts.length ? '<p class="empty-msg">No pending products</p>' :
    pendingProducts.map(p=>`
    <div class="task-card">
      <div class="task-card-header"><span class="task-dept">${p.name}</span><span class="badge">${p.category||'—'}</span></div>
      <div style="font-size:12px;color:var(--text2)">₹${p.price||0} · ${p.submittedByName||'—'}</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn-sm" style="background:#22c55e;color:#fff" onclick="VW_SETTINGS.approvePendingProduct(${p.id})">✓ Approve</button>
        <button class="btn-sm" style="color:var(--red)" onclick="VW_SETTINGS.rejectPendingProduct(${p.id})">✕ Reject</button>
      </div>
    </div>`).join('')}
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📥 Excel Import</h3>
    <button class="btn-secondary full-width" onclick="VW_EXCEL.showExcelImport()">📊 Open Excel Import Tool</button>
  </div>

  <div class="card">
    <h3 class="card-title">🔍 Customer Deduplication</h3>
    <button class="btn-secondary full-width" onclick="navigateTo('dedup')">Open Dedup Tool</button>
  </div>`;
}

async function approvePendingProduct(id) {
  const p = await VW_DB.getById(VW_DB.STORES.pendingProducts, id);
  if (!p) return;
  await VW_DB.put(VW_DB.STORES.products, {
    name: p.name, category: p.category, price: p.price, unit: p.unit,
    gst: p.gst||18, stock: 0, lowStockThreshold: 5, active: true, createdAt: new Date().toISOString()
  });
  p.status = 'approved';
  await VW_DB.put(VW_DB.STORES.pendingProducts, p);
  showToast(`${p.name} added to inventory`, 'success');
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsTools();
}

async function rejectPendingProduct(id) {
  const p = await VW_DB.getById(VW_DB.STORES.pendingProducts, id);
  if (!p) return;
  p.status = 'rejected';
  await VW_DB.put(VW_DB.STORES.pendingProducts, p);
  showToast('Product rejected', 'info');
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsTools();
}

// ===== TAB 6: DANGER ZONE =====
async function renderSettingsDanger() {
  return `
  <div class="card" style="border-color:rgba(239,68,68,0.4)">
    <h3 class="card-title" style="color:var(--red)">⚠️ Danger Zone</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:14px">These actions are irreversible. Be absolutely sure before proceeding.</p>

    <div style="padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:4px">Clear All Visits</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Delete all check-in records. Invoice history is not affected.</div>
      <button class="btn-secondary" style="color:var(--red)" onclick="VW_SETTINGS.confirmDangerAction('visits','Clear All Visits')">Clear Visits</button>
    </div>

    <div style="padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:4px">Reset All Sequences</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Reset invoice/quotation counters to start from 1. Use on April 1 if needed manually.</div>
      <button class="btn-secondary" style="color:var(--red)" onclick="VW_SETTINGS.confirmDangerAction('sequences','Reset Sequences')">Reset Sequences</button>
    </div>

    <div style="padding:12px;background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.5);border-radius:8px">
      <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:4px">⚠️ Factory Reset</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Delete ALL data — invoices, customers, staff, products. This cannot be undone.</div>
      <button class="btn-secondary" style="color:var(--red);border-color:var(--red)" onclick="VW_SETTINGS.confirmDangerAction('factory','FACTORY RESET — Delete Everything')">Factory Reset</button>
    </div>
  </div>`;
}

async function confirmDangerAction(action, label) {
  const confirm1 = window.confirm(`Are you sure you want to: ${label}?\n\nThis cannot be undone.`);
  if (!confirm1) return;
  const confirm2 = window.prompt(`Type "CONFIRM" to proceed with: ${label}`);
  if (confirm2 !== 'CONFIRM') { showToast('Cancelled', 'info'); return; }
  if (action === 'visits') {
    const all = await VW_DB.all(VW_DB.STORES.visits);
    for (const v of all) { await VW_DB.client.from('visits').delete().eq('id', v.id); }
    showToast('All visits cleared', 'success');
  } else if (action === 'sequences') {
    await VW_DB.client.from('invoice_sequences').delete().neq('id', 0);
    await VW_DB.client.from('quotation_sequences').delete().neq('id', 0);
    await VW_DB.client.from('po_sequences').delete().neq('fy_label', '');
    showToast('Sequences reset', 'success');
  } else if (action === 'factory') {
    showToast('Factory reset initiated — refreshing...', 'warn');
    setTimeout(() => { localStorage.clear(); window.location.reload(); }, 2000);
  }
}

function showLanguagePicker() {
  const sheet = document.getElementById('bottom-sheet');
  const langs = [
    { code:'en', label:'English', native:'English', flag:'🇬🇧' },
    { code:'te', label:'Telugu', native:'తెలుగు', flag:'🏛' },
    { code:'hi', label:'Hindi', native:'हिंदी', flag:'🇮🇳' },
    { code:'bn', label:'Bengali', native:'বাংলা', flag:'🐯' },
    { code:'or', label:'Odia', native:'ଓଡ଼ିଆ', flag:'🌸' },
  ];
  const current = localStorage.getItem('vw_lang') || 'en';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>🌐 App Language / భాష / भाषा / ভাষা / ଭାଷା</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:14px">Navigation and key UI labels will change. You can change this anytime from Settings.</p>
    ${langs.map(l => `
    <div onclick="setLanguage('${l.code}');closeSheet()" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;cursor:pointer;background:${current===l.code?'rgba(245,200,66,0.1)':'var(--bg2)'};border:2px solid ${current===l.code?'var(--gold-border)':'transparent'};margin-bottom:8px">
      <span style="font-size:28px">${l.flag}</span>
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--text)">${l.native}</div>
        <div style="font-size:12px;color:var(--text3)">${l.label}</div>
      </div>
      ${current===l.code?'<span style="margin-left:auto;color:var(--gold);font-size:20px">✓</span>':''}
    </div>`).join('')}`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

window.VW_SETTINGS = {
  renderSettingsPage, switchSettingsTab,
  renderTileSettings, saveTileSettings, saveTileWeightTable, saveFloorConfig,
  saveGroutConfig, saveBreakageConfig, saveSpacerConfig, autoFillDefaultWeights,
  deleteTileSize, addCustomSize, saveVehicleConfig,
  saveAccountName, changePIN, approveResetPin,
  approveProfile, updateProfileRole,
  togglePersonPerm, resetToRoleDefaults,
  saveRolePermission, loadUserPermissions, setUserPermission, clearUserPermissions,
  openUserPermissions,
  saveWAConfig, saveLoyaltyConfig,
  addCategory, removeCategory,
  addPackingRule, removePackingRule, updatePackingRule, savePackingRules,
  addLoadingRule, removeLoadingRule, updateLoadingRule, saveLoadingConfig,
  saveTransportConfig, saveEscalationConfig, saveTileWeights,
  addEscalation, removeEscalation, updateEscalation, saveEscalation,
  approvePendingProduct, rejectPendingProduct,
  confirmDangerAction,
  downloadAllData, addPromoCode, deletePromoCode,
  showLanguagePicker
};

// Legacy exports for backward compatibility
window.saveWAConfig = saveWAConfig;
window.saveLoyaltyConfig = saveLoyaltyConfig;
window.savePackingRules = savePackingRules;
window.initPackingRulesUI = () => {}; // no-op, handled by tab now

// ===== DOWNLOAD ALL DATA =====
async function downloadAllData() {
  showToast('Preparing export...', 'info');
  try {
    const XLSX = window.XLSX || await new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => res(window.XLSX); document.head.appendChild(s);
    });
    const [invoices, customers, products, quotations, staff, attendance, vendors, pos, pettyCash, vouchers] = await Promise.all([
      VW_DB.all(VW_DB.STORES.invoices),
      VW_DB.all(VW_DB.STORES.customers),
      VW_DB.all(VW_DB.STORES.products),
      VW_DB.all(VW_DB.STORES.quotations),
      VW_DB.all(VW_DB.STORES.staff),
      VW_DB.all(VW_DB.STORES.attendance),
      VW_DB.all(VW_DB.STORES.vendors),
      VW_DB.all(VW_DB.STORES.purchaseOrders),
      VW_DB.all(VW_DB.STORES.pettyCash),
      VW_DB.all(VW_DB.STORES.paymentVouchers),
    ]);
    const wb = XLSX.utils.book_new();

    // Invoices
    const invRows = invoices.map(i => ({
      'Invoice No': i.invoiceNo||'', 'Date': i.date?.split('T')[0]||'',
      'Customer': i.customerName||'', 'Phone': i.customerPhone||'',
      'Total': i.total||0, 'GST': i.gstAmt||0, 'Payment': i.paymentMethod||'',
      'Credit Sale': i.creditSale?'Yes':'No', 'Status': i.approvalStatus||'',
      'Executive': i.salesExecutiveName||'', 'Items': (i.items||[]).length
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), 'Invoices');

    // Customers
    const custRows = customers.map(c => ({
      'Name': c.name||'', 'Phone': c.phone||'', 'Type': c.type||'',
      'City': c.city||'', 'Visits': c.visitCount||0, 'DOB': c.dateOfBirth||'',
      'Last Visit': c.lastVisit?.split('T')[0]||'', 'Total Spend': c.totalSpend||0
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custRows), 'Customers');

    // Products
    const prodRows = products.map(p => ({
      'Name': p.name||'', 'Category': p.category||'', 'Brand': p.brand||'',
      'Price': p.price||0, 'GST%': p.gst||0, 'Stock': p.stock||0,
      'Unit': p.unit||'', 'Low Stock Alert': p.lowStockThreshold||5
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodRows), 'Products');

    // Quotations
    const quoteRows = quotations.map(q => ({
      'Quote No': q.quoteNo||'', 'Date': q.date?.split('T')[0]||'',
      'Customer': q.customerName||'', 'Site': q.siteName||'',
      'Total': q.grandTotal||0, 'Status': q.status||'', 'Approval': q.approvalStatus||''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(quoteRows), 'Quotations');

    // Staff
    const staffRows = staff.map(s => ({
      'Name': s.name||'', 'Designation': s.designation||'', 'Department': s.department||'',
      'Phone': s.phone||'', 'Joining Date': s.joiningDate||'', 'Gross Salary': s.grossSalary||0,
      'Bank': s.bankName||'', 'Account No': s.bankAccount||'', 'Active': s.active!==false?'Yes':'No'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffRows), 'Staff');

    // Attendance
    const attRows = attendance.map(a => ({
      'Staff ID': a.staffId||'', 'Date': a.date||'', 'Punch In': a.punchIn||'',
      'Punch Out': a.punchOut||'', 'Working': a.finalWorking||0, 'Breaks': (a.breaks||[]).length
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attRows), 'Attendance');

    // Petty Cash
    const pcRows = pettyCash.map(e => ({
      'Date': e.date||'', 'Type': e.type||'', 'Category': e.category||'',
      'Description': e.description||'', 'Amount': e.amount||0, 'By': e.addedByName||''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pcRows), 'Petty Cash');

    // Vendors & POs
    const vendorRows = vendors.map(v => ({
      'Name': v.name||'', 'Category': v.category||'', 'Phone': v.phone||'',
      'GST': v.gstNo||'', 'Rating': v.rating||0
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendorRows), 'Vendors');

    const fileName = `VWholesale-FullExport-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('Full data exported successfully!', 'success');
  } catch(e) {
    console.error('Export error:', e);
    showToast('Export failed — ' + e.message, 'warn');
  }
}

// ===== PROMO CODES =====
async function addPromoCode() {
  const code = document.getElementById('new-promo-code')?.value.trim().toUpperCase().replace(/\s/g,'');
  const value = parseFloat(document.getElementById('new-promo-value')?.value)||0;
  if (!code || !value) { showToast('Enter code and value', 'warn'); return; }
  const promos = await VW_DB.getSetting('promo_codes', {});
  promos[code] = {
    label: document.getElementById('new-promo-label')?.value.trim()||code,
    type: document.getElementById('new-promo-type')?.value||'pct',
    value, expiry: document.getElementById('new-promo-expiry')?.value||'',
    createdAt: new Date().toISOString()
  };
  await VW_DB.setSetting('promo_codes', promos);
  showToast(`Promo code ${code} added`, 'success');
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsTools();
}

async function deleteBillingPromoCode(code) {
  const promos = await VW_DB.getSetting('promo_codes', {});
  delete promos[code];
  await VW_DB.setSetting('promo_codes', promos);
  showToast(`${code} removed`, 'info');
  const container = document.getElementById('settings-tab-content');
  if (container) container.innerHTML = await renderSettingsTools();
}

// Add to VW_SETTINGS exports

// ===== FEATURE PERMISSION HELPERS (used by openUserPermissions sheet) =====
async function saveRolePermission(feature, action, role, value) {
  const key = `role_perms_${role}`;
  const current = await VW_DB.getSetting(key, {});
  current[`${feature}.${action}`] = value;
  await VW_DB.setSetting(key, current);
  if (FEATURE_PERMISSIONS[feature]?.actions[action]) {
    FEATURE_PERMISSIONS[feature].actions[action][role] = value;
  }
  showToast('Permission updated', 'success');
}

async function loadUserPermissions(profileId) {
  if (!profileId) return;
  const container = document.getElementById('user-perms-detail');
  if (!container) return;
  const prof = await VW_DB.getById(VW_DB.STORES.profiles, profileId);
  if (!prof) return;
  const userPerms = prof.featurePermissions || {};
  container.innerHTML = `<p style="font-size:13px;color:var(--text2)">Use the 🔐 Rights button in the Team tab for a better interface.</p>`;
}

async function setUserPermission(profileId, key, value) {
  const prof = await VW_DB.getById(VW_DB.STORES.profiles, profileId);
  if (!prof) return;
  const perms = prof.featurePermissions || {};
  perms[key] = value;
  prof.featurePermissions = perms;
  await VW_DB.put(VW_DB.STORES.profiles, prof);
  showToast('Permission updated', 'success');
}

async function clearUserPermissions(profileId) {
  const prof = await VW_DB.getById(VW_DB.STORES.profiles, profileId);
  if (!prof) return;
  prof.featurePermissions = {};
  await VW_DB.put(VW_DB.STORES.profiles, prof);
  showToast('Feature overrides cleared', 'success');
}


// =====================================================
// COST OPTIMIZATION GUIDE (Settings tab)
// =====================================================
async function renderCostOptimizationTab() {
  return `
  <div class="card" style="margin-bottom:10px;border-color:var(--gold-border)">
    <h3 class="card-title">💰 Cost Optimization for V Wholesale</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
      Based on your current setup, here are ways to reduce Google Workspace, SIM, and calling costs.
    </p>

    <!-- EMAIL -->
    <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">📧 Email (Google Workspace)</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">You're paying ~₹125/user/month for Google Workspace. Options:</div>
      <div style="font-size:13px;color:var(--text);margin-bottom:6px">✅ <strong>Best option: Zoho Mail Free</strong></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Free for up to 5 users with custom domain (vwholesale.in email). Same features as Google Workspace basic.</div>
      <a href="https://www.zoho.com/mail/free-email-hosting.html" target="_blank" class="btn-sm" style="display:inline-block;text-decoration:none">Open Zoho Mail →</a>
      <div style="font-size:12px;color:var(--text3);margin-top:8px">💡 For WhatsApp-heavy teams like yours, email matters less. Zoho free covers all your needs.</div>
    </div>

    <!-- CALLING / SIM -->
    <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">📞 Staff Calling (Personal SIMs)</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Staff calling customers from personal numbers — 3 problems: customer data leak, cost, no tracking.</div>
      <div style="font-size:13px;color:var(--text);margin-bottom:4px">✅ <strong>Recommended: Exotel</strong></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">₹2,500–5,000/month for unlimited calling from a single V Wholesale number. Staff dials from app — customer only sees your business number. All calls recorded, tracked in CRM.</div>
      <a href="https://exotel.com" target="_blank" class="btn-sm" style="display:inline-block;text-decoration:none">Exotel Plans →</a>
      <div style="font-size:13px;color:var(--text);margin-top:8px;margin-bottom:4px">Budget option: <strong>Knowlarity</strong></div>
      <div style="font-size:12px;color:var(--text2)">Similar features, slightly cheaper. Good for small teams.</div>
    </div>

    <!-- WHATSAPP BUSINESS API -->
    <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">💬 WhatsApp (Currently personal numbers)</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Staff sending from personal WhatsApp — same risks. Switch to WhatsApp Business API:</div>
      <div style="font-size:13px;color:var(--text);margin-bottom:4px">✅ <strong>Interakt / AiSensy / Wati</strong></div>
      <div style="font-size:12px;color:var(--text2)">₹1,500–3,000/month. One V Wholesale WhatsApp number, multiple staff can send, all messages tracked, automated templates for quotations/invoices.</div>
    </div>

    <!-- TOTAL SAVINGS ESTIMATE -->
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:12px">
      <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:8px">💚 Estimated savings</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span>Google Workspace → Zoho Free</span>
        <span style="color:var(--green)">Save ₹625–1,250/month</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span>Personal SIMs → Exotel</span>
        <span style="color:var(--green)">Save ₹2,000–4,000/month</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0">
        <span>Personal WA → WA Business API</span>
        <span style="color:var(--green)">+ CRM integration</span>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--green);margin-top:8px">Total: Save ₹3,000–6,000/month + data protection</div>
    </div>
  </div>`;
}
window.VW_SETTINGS.renderCostOptimizationTab = renderCostOptimizationTab;




/* === onboarding.js === */

// ===== EMPLOYEE ONBOARDING (self-service) =====
// Stage 1: HR creates an offer (role/salary/terms), the app generates an
// offer letter PDF-ready print view, HR sets a one-time PIN, and gets a
// shareable link to send the candidate via WhatsApp.
//
// Stage 2 (separate, candidate-facing): the candidate opens the link,
// enters the PIN, reviews and accepts the offer letter, then fills in
// their full onboarding details (personal info, photo, documents, bank,
// emergency contact, education/experience, references).
//
// Stage 3: HR reviews each submission in a queue and approves it into a
// real Staff Directory entry.

const OFFER_STATUS_LABELS = {
  sent: 'Link Sent — Awaiting Response',
  accepted: 'Offer Accepted — Filling Form',
  submitted: 'Submitted — Awaiting HR Review',
  approved: 'Approved — Added to Team',
  rejected: 'Rejected'
};

async function renderOffersPipeline() {
  const offers = await VW_DB.all(VW_DB.STORES.staffOffers);
  const active = offers.filter(o => o.status !== 'approved' && o.status !== 'rejected');
  active.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!active.length) return '<p class="empty-msg">No offers in progress — tap "+ New Offer" to start onboarding someone</p>';
  return active.map(o => `
    <div class="cust-row" onclick="openOfferDetail(${o.id})">
      <div class="cust-info"><div class="cust-name">${o.candidateName}</div><div class="cust-meta">${o.role} &middot; ${OFFER_STATUS_LABELS[o.status]||o.status}</div></div>
    </div>`).join('');
}
window.renderOffersPipeline = renderOffersPipeline;

function showCreateOffer() {
  const sheet = document.getElementById('bottom-sheet');
  const depts = ['Tiles','Sanitary','Plywood','Electricals','Paints','Plumbing','Appliances','HR','Purchase','Inventory','Management','Accounts'];
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Offer</h3>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Candidate Name *</label><input type="text" id="of-name"></div>
      <div class="form-group" style="flex:1"><label>Phone *</label><input type="tel" id="of-phone" maxlength="10"></div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Role *</label><input type="text" id="of-role" placeholder="e.g. Sales Executive"></div>
      <div class="form-group" style="flex:1"><label>Department</label>
        <select id="of-dept">${depts.map(d=>`<option>${d}</option>`).join('')}</select></div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Monthly Salary (₹) *</label><input type="number" id="of-salary"></div>
      <div class="form-group" style="flex:1"><label>Start Date *</label><input type="date" id="of-startdate"></div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Probation (months)</label><input type="number" id="of-probation" value="3"></div>
      <div class="form-group" style="flex:1"><label>Reporting Manager</label><input type="text" id="of-manager"></div>
    </div>
    <div class="form-group"><label>Additional Clauses / Terms (optional)</label>
      <textarea id="of-clauses" rows="3" placeholder="Any specific terms for this offer"></textarea>
    </div>
    <button class="btn-primary full-width" style="margin-top:8px" onclick="createOffer()">Generate Offer &amp; Continue</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showCreateOffer = showCreateOffer;

function generateOfferPin() {
  // A short, easy-to-read-aloud-or-type PIN — not a security-grade
  // secret, just enough to confirm the right person opened the link.
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function createOffer() {
  const name = document.getElementById('of-name').value.trim();
  const phone = document.getElementById('of-phone').value.trim();
  const role = document.getElementById('of-role').value.trim();
  const salary = parseFloat(document.getElementById('of-salary').value);
  const startDate = document.getElementById('of-startdate').value;
  if (!name || !phone || !role || !salary || !startDate) return showToast('Fill all required fields', 'warn');

  const profile = VW_AUTH.getCurrentProfile();
  const offer = {
    candidateName: name, candidatePhone: phone, role,
    department: document.getElementById('of-dept').value,
    salary, startDate,
    probationMonths: parseFloat(document.getElementById('of-probation').value) || 3,
    reportingManager: document.getElementById('of-manager').value.trim(),
    customClauses: document.getElementById('of-clauses').value.trim(),
    pin: generateOfferPin(),
    status: 'sent',
    createdByName: profile ? profile.name : '',
    createdAt: new Date().toISOString()
  };
  const id = await VW_DB.put(VW_DB.STORES.staffOffers, offer);
  offer.id = id;
  showOfferReadyToShare(offer);
}
window.createOffer = createOffer;

function showOfferReadyToShare(offer) {
  const link = `${window.location.origin}${window.location.pathname}?onboard=${offer.id}`;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Offer Ready</h3>
    <p class="sheet-meta">Share both the link and PIN with ${offer.candidateName} — they'll need both to open the form.</p>
    <div class="req-item-card" style="margin:10px 0">
      <div style="font-size:12px;color:var(--text3)">Link</div>
      <div style="font-size:13px;word-break:break-all;margin-bottom:8px">${link}</div>
      <div style="font-size:12px;color:var(--text3)">PIN</div>
      <div style="font-size:20px;font-weight:700;letter-spacing:2px">${offer.pin}</div>
    </div>
    <button class="btn-secondary full-width" onclick="printOfferLetter(${offer.id})">📄 Preview / Print Offer Letter</button>
    <button class="btn-wa full-width" style="margin-top:8px" onclick="shareOfferViaWhatsApp(${offer.id})">💬 Share via WhatsApp</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function shareOfferViaWhatsApp(offerId) {
  const offer = await VW_DB.getById(VW_DB.STORES.staffOffers, offerId);
  const link = `${window.location.origin}${window.location.pathname}?onboard=${offer.id}`;
  const msg = `Hi ${offer.candidateName}! 🎉 Welcome to V Wholesale.\n\nPlease complete your onboarding here:\n${link}\n\nYour access PIN: *${offer.pin}*\n\n(Keep this PIN private — it confirms it's really you completing the form.)`;
  const phone = (offer.candidatePhone||'').replace(/\D/g,'');
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}
window.shareOfferViaWhatsApp = shareOfferViaWhatsApp;

async function openOfferDetail(offerId) {
  const offer = await VW_DB.getById(VW_DB.STORES.staffOffers, offerId);
  if (!offer) return;
  const link = `${window.location.origin}${window.location.pathname}?onboard=${offer.id}`;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${offer.candidateName}</h3>
    <p class="sheet-meta">${offer.role} &middot; ${OFFER_STATUS_LABELS[offer.status]||offer.status}</p>
    <div class="req-item-card" style="margin:10px 0">
      <div style="font-size:12px;color:var(--text3)">Link</div>
      <div style="font-size:13px;word-break:break-all;margin-bottom:8px">${link}</div>
      <div style="font-size:12px;color:var(--text3)">PIN</div>
      <div style="font-size:18px;font-weight:700;letter-spacing:2px">${offer.pin}</div>
    </div>
    <button class="btn-secondary full-width" onclick="printOfferLetter(${offer.id})">📄 Preview / Print Offer Letter</button>
    <button class="btn-wa full-width" style="margin-top:8px" onclick="shareOfferViaWhatsApp(${offer.id})">💬 Share via WhatsApp</button>
    ${offer.status === 'submitted' ? `<button class="btn-primary full-width" style="margin-top:8px" onclick="reviewOfferSubmission(${offer.id})">📋 Review Submission</button>` : ''}
    ${offer.status === 'rejected' && offer.rejectReason ? `<p style="font-size:12px;color:var(--text3);margin-top:8px">Rejected by ${offer.reviewedByName||''}: ${offer.rejectReason}</p>` : ''}
    ${offer.status === 'approved' ? `<button class="btn-secondary full-width" style="margin-top:8px" onclick="openStaff(${offer.approvedStaffId});closeSheet()">View in Staff Directory →</button>` : ''}
    <button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="confirmCancelOffer(${offer.id})">✕ Cancel This Offer</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.openOfferDetail = openOfferDetail;

async function confirmCancelOffer(offerId) {
  if (!confirm('Cancel this offer? The candidate\'s link will stop working.')) return;
  await VW_DB.del(VW_DB.STORES.staffOffers, offerId);
  showToast('Offer cancelled', 'info');
  closeSheet();
  navigateTo('hr');
}
window.confirmCancelOffer = confirmCancelOffer;

async function printOfferLetter(offerId) {
  const offer = await VW_DB.getById(VW_DB.STORES.staffOffers, offerId);
  if (!offer) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Offer Letter - ${offer.candidateName}</title>
  <style>
    body{font-family:Georgia,serif;max-width:750px;margin:0 auto;padding:40px;color:#1a1a1a;line-height:1.7}
    .letterhead{text-align:center;border-bottom:2px solid #C8972B;padding-bottom:16px;margin-bottom:28px}
    .letterhead h1{font-size:22px;margin:0;color:#1a1a1a}
    .letterhead p{font-size:12px;color:var(--text3);margin:4px 0 0}
    .date-line{text-align:right;font-size:13px;color:var(--text3);margin-bottom:20px}
    p{font-size:14px;margin:12px 0}
    .terms-list{margin:16px 0;padding-left:20px}
    .terms-list li{font-size:14px;margin:6px 0}
    .sign-block{margin-top:48px;font-size:13px}
    .print-btn{display:block;margin:0 0 24px;padding:10px 24px;background:#C8972B;color:#000;border:none;border-radius:8px;cursor:pointer;font-size:14px}
    @media print{.print-btn{display:none}}
  </style></head><body>
  <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
  <div class="letterhead">
    <h1>Vassure Wholesale Pvt Ltd</h1>
    <p>1-1-153, NH-65, Beside Padmaja Suzuki, VD Puram, Bhavanipuram, Vijayawada, Andhra Pradesh - 520012</p>
  </div>
  <div class="date-line">${new Date(offer.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</div>
  <p>Dear ${offer.candidateName},</p>
  <p>We are pleased to offer you the position of <strong>${offer.role}</strong>${offer.department ? ` in our ${offer.department} department` : ''} at Vassure Wholesale Pvt Ltd ("V Wholesale"). We were impressed by your background and look forward to you joining our team.</p>
  <p><strong>Key terms of this offer:</strong></p>
  <ul class="terms-list">
    <li>Position: ${offer.role}</li>
    <li>Monthly Salary: ₹${Number(offer.salary).toLocaleString('en-IN')}</li>
    <li>Start Date: ${new Date(offer.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</li>
    <li>Probation Period: ${offer.probationMonths} months</li>
    ${offer.reportingManager ? `<li>Reporting Manager: ${offer.reportingManager}</li>` : ''}
  </ul>
  ${offer.customClauses ? `<p><strong>Additional terms:</strong></p><p>${offer.customClauses.replace(/\n/g,'<br>')}</p>` : ''}
  <p>This offer is contingent upon successful completion of the onboarding process, including verification of the documents you provide. Please confirm your acceptance of this offer through the onboarding link shared with you separately.</p>
  <p>We're excited to have you on board and look forward to a successful journey together.</p>
  <div class="sign-block">
    <p>Warm regards,</p>
    <p><strong>${offer.createdByName || 'HR Team'}</strong><br>Vassure Wholesale Pvt Ltd</p>
  </div>
  </body></html>`);
  win.document.close();
}
window.printOfferLetter = printOfferLetter;

// ===== CANDIDATE-FACING FLOW (no login — standalone) =====
// State lives in a single object since this is a multi-step flow outside
// the normal app navigation system.
let candidateState = { offer: null, step: 'pin', formData: {}, extraDocs: [] };

function hideAppShellForCandidate() {
  const header = document.getElementById('app-header');
  const nav = document.getElementById('bottom-nav');
  if (header) header.style.display = 'none';
  if (nav) nav.style.display = 'none';
}

async function renderCandidateEntry(offerId) {
  hideAppShellForCandidate();
  const content = document.getElementById('app-content');
  const offer = await VW_DB.getById(VW_DB.STORES.staffOffers, parseInt(offerId));

  if (!offer) {
    content.innerHTML = candidateWrapper(`<p style="text-align:center;color:var(--text3)">This link is no longer valid. Please contact HR for a new one.</p>`);
    return;
  }
  candidateState.offer = offer;

  if (offer.status === 'submitted' || offer.status === 'approved') {
    content.innerHTML = candidateWrapper(`
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:40px;margin-bottom:12px">✅</div>
        <h2 style="margin:0 0 8px">Already Submitted</h2>
        <p style="color:var(--text3);font-size:14px">Thanks ${offer.candidateName}, your details have already been submitted. HR will be in touch soon.</p>
      </div>`);
    return;
  }
  if (offer.status === 'rejected') {
    content.innerHTML = candidateWrapper(`<p style="text-align:center;color:var(--text3)">This offer is no longer active. Please contact HR.</p>`);
    return;
  }

  candidateState.step = 'pin';
  renderCandidatePinScreen();
}
window.VW_ONBOARDING = window.VW_ONBOARDING || {};
window.VW_ONBOARDING.renderCandidateEntry = renderCandidateEntry;

function candidateWrapper(innerHtml) {
  return `<div style="max-width:480px;margin:0 auto;padding:24px 16px 60px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:22px;font-weight:700;color:var(--gold)">V Wholesale</div>
      <div style="font-size:12px;color:var(--text3)">Employee Onboarding</div>
    </div>
    ${innerHtml}
  </div>`;
}

function renderCandidatePinScreen() {
  const content = document.getElementById('app-content');
  content.innerHTML = candidateWrapper(`
    <h2 style="margin:0 0 4px">Hi ${candidateState.offer.candidateName} 👋</h2>
    <p style="color:var(--text3);font-size:14px;margin-bottom:20px">Enter the PIN that was shared with you to continue.</p>
    <div class="form-group"><input type="text" id="cand-pin" maxlength="4" inputmode="numeric" placeholder="4-digit PIN" style="font-size:24px;text-align:center;letter-spacing:8px"></div>
    <p id="cand-pin-error" style="color:var(--red);font-size:13px;text-align:center;display:none">Incorrect PIN — please check and try again.</p>
    <button class="btn-primary full-width" style="margin-top:12px" onclick="checkCandidatePin()">Continue</button>
  `);
}

function checkCandidatePin() {
  const entered = document.getElementById('cand-pin').value.trim();
  if (entered === candidateState.offer.pin) {
    candidateState.step = 'offer_review';
    renderCandidateOfferReview();
  } else {
    document.getElementById('cand-pin-error').style.display = 'block';
  }
}
window.checkCandidatePin = checkCandidatePin;

function renderCandidateOfferReview() {
  const o = candidateState.offer;
  const content = document.getElementById('app-content');
  content.innerHTML = candidateWrapper(`
    <h2 style="margin:0 0 12px">Your Offer Letter</h2>
    <div class="req-item-card" style="text-align:left;line-height:1.7">
      <p>Dear ${o.candidateName},</p>
      <p>We are pleased to offer you the position of <strong>${o.role}</strong>${o.department ? ` in our ${o.department} department` : ''} at Vassure Wholesale Pvt Ltd.</p>
      <ul style="padding-left:18px;margin:12px 0">
        <li>Monthly Salary: ₹${Number(o.salary).toLocaleString('en-IN')}</li>
        <li>Start Date: ${new Date(o.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</li>
        <li>Probation: ${o.probationMonths} months</li>
        ${o.reportingManager ? `<li>Reporting Manager: ${o.reportingManager}</li>` : ''}
      </ul>
      ${o.customClauses ? `<p>${o.customClauses.replace(/\n/g,'<br>')}</p>` : ''}
    </div>
    <label class="route-check-row" style="margin-top:16px">
      <input type="checkbox" id="cand-accept-checkbox">
      <span>I, ${o.candidateName}, accept this offer and agree to the terms above.</span>
    </label>
    <button class="btn-primary full-width" style="margin-top:12px" onclick="acceptOfferAndContinue()">Accept &amp; Continue</button>
  `);
}

async function acceptOfferAndContinue() {
  if (!document.getElementById('cand-accept-checkbox').checked) {
    return showToast('Please confirm acceptance to continue', 'warn');
  }
  candidateState.offer.status = 'accepted';
  await VW_DB.put(VW_DB.STORES.staffOffers, candidateState.offer);
  candidateState.step = 'form';
  renderCandidateForm();
}
window.acceptOfferAndContinue = acceptOfferAndContinue;

function renderCandidateForm() {
  const content = document.getElementById('app-content');
  content.innerHTML = candidateWrapper(`
    <h2 style="margin:0 0 4px">Your Details</h2>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px">Fill in everything below — all required for your records with us.</p>

    <h3 style="font-size:14px;color:var(--gold);margin:18px 0 8px">Personal Information</h3>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Date of Birth *</label><input type="date" id="cf-dob"></div>
      <div class="form-group" style="flex:1"><label>Gender</label><select id="cf-gender"><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option></select></div>
    </div>
    <div class="form-group"><label>Current Address *</label><textarea id="cf-address" rows="2"></textarea></div>
    <div class="form-group"><label>Personal Email *</label><input type="email" id="cf-email"></div>

    <h3 style="font-size:14px;color:var(--gold);margin:18px 0 8px">Photo</h3>
    <div class="form-group"><label>Passport-size photo *</label><input type="file" accept="image/*" id="cf-photo"></div>

    <h3 style="font-size:14px;color:var(--gold);margin:18px 0 8px">ID Proof</h3>
    <div class="form-group"><label>Aadhaar Number *</label><input type="text" id="cf-aadhaar" maxlength="12" placeholder="12-digit number"></div>
    <div class="form-group"><label>Upload Aadhaar (front) *</label><input type="file" accept="image/*,.pdf" id="cf-aadhaar-file"></div>
    <div class="form-group"><label>PAN Number *</label><input type="text" id="cf-pan" maxlength="10" placeholder="ABCDE1234F" style="text-transform:uppercase"></div>
    <div class="form-group"><label>Upload PAN *</label><input type="file" accept="image/*,.pdf" id="cf-pan-file"></div>

    <div id="cand-extra-docs-list"></div>
    <button class="btn-sm" style="margin:6px 0 18px" onclick="addCandidateExtraDoc()">+ Add Another Document</button>

    <h3 style="font-size:14px;color:var(--gold);margin:18px 0 8px">Bank Details</h3>
    <div class="form-group"><label>Account Holder Name *</label><input type="text" id="cf-bank-name"></div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Account Number *</label><input type="text" id="cf-bank-acc"></div>
      <div class="form-group" style="flex:1"><label>IFSC Code *</label><input type="text" id="cf-bank-ifsc" style="text-transform:uppercase"></div>
    </div>

    <h3 style="font-size:14px;color:var(--gold);margin:18px 0 8px">Emergency Contact</h3>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Name *</label><input type="text" id="cf-emergency-name"></div>
      <div class="form-group" style="flex:1"><label>Relationship</label><input type="text" id="cf-emergency-rel" placeholder="e.g. Father, Spouse"></div>
    </div>
    <div class="form-group"><label>Phone *</label><input type="tel" id="cf-emergency-phone" maxlength="10"></div>

    <h3 style="font-size:14px;color:var(--gold);margin:18px 0 8px">Education</h3>
    <div class="form-group"><label>Highest Qualification *</label><input type="text" id="cf-education" placeholder="e.g. B.Com, Andhra University, 2021"></div>

    <h3 style="font-size:14px;color:var(--gold);margin:18px 0 8px">Work Experience</h3>
    <div class="form-group"><label>Previous Employer(s) &amp; Role(s) (if any)</label><textarea id="cf-experience" rows="2" placeholder="Leave blank if this is your first job"></textarea></div>

    <h3 style="font-size:14px;color:var(--gold);margin:18px 0 8px">References</h3>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Reference Name</label><input type="text" id="cf-ref-name"></div>
      <div class="form-group" style="flex:1"><label>Reference Phone</label><input type="tel" id="cf-ref-phone" maxlength="10"></div>
    </div>

    <button class="btn-primary full-width" style="margin-top:18px" onclick="submitCandidateForm()">Submit My Details</button>
  `);
}

function addCandidateExtraDoc() {
  const idx = candidateState.extraDocs.length;
  candidateState.extraDocs.push({ label: '', file: null });
  const container = document.getElementById('cand-extra-docs-list');
  const row = document.createElement('div');
  row.className = 'input-row';
  row.style.marginTop = '6px';
  row.innerHTML = `
    <div class="form-group" style="flex:1"><input type="text" placeholder="Document name (e.g. Driving License)" id="cf-extra-label-${idx}"></div>
    <div class="form-group" style="flex:1.2"><input type="file" accept="image/*,.pdf" id="cf-extra-file-${idx}"></div>
  `;
  container.appendChild(row);
}
window.addCandidateExtraDoc = addCandidateExtraDoc;

function readFileAsDataUrlCandidate(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitCandidateForm() {
  const required = [
    ['cf-dob','Date of Birth'], ['cf-address','Current Address'], ['cf-email','Personal Email'],
    ['cf-aadhaar','Aadhaar Number'], ['cf-pan','PAN Number'],
    ['cf-bank-name','Account Holder Name'], ['cf-bank-acc','Account Number'], ['cf-bank-ifsc','IFSC Code'],
    ['cf-emergency-name','Emergency Contact Name'], ['cf-emergency-phone','Emergency Contact Phone'],
    ['cf-education','Highest Qualification']
  ];
  for (const [id, label] of required) {
    if (!document.getElementById(id).value.trim()) return showToast(`${label} is required`, 'warn');
  }
  const photoFile = document.getElementById('cf-photo').files[0];
  const aadhaarFile = document.getElementById('cf-aadhaar-file').files[0];
  const panFile = document.getElementById('cf-pan-file').files[0];
  if (!photoFile || !aadhaarFile || !panFile) return showToast('Please upload your photo, Aadhaar, and PAN', 'warn');

  showToast('Submitting — please wait, this can take a moment...', 'info');

  try {
    const offerId = candidateState.offer.id;
    const photoUrl = await VW_DB.uploadOnboardingDoc(await readFileAsDataUrlCandidate(photoFile), `onboarding-${offerId}/photo`);
    const aadhaarUrl = await VW_DB.uploadOnboardingDoc(await readFileAsDataUrlCandidate(aadhaarFile), `onboarding-${offerId}/aadhaar`);
    const panUrl = await VW_DB.uploadOnboardingDoc(await readFileAsDataUrlCandidate(panFile), `onboarding-${offerId}/pan`);

    const extraDocs = [];
    for (let i = 0; i < candidateState.extraDocs.length; i++) {
      const labelEl = document.getElementById(`cf-extra-label-${i}`);
      const fileEl = document.getElementById(`cf-extra-file-${i}`);
      const file = fileEl && fileEl.files[0];
      if (!file) continue;
      const path = await VW_DB.uploadOnboardingDoc(await readFileAsDataUrlCandidate(file), `onboarding-${offerId}/extra-${i}`);
      extraDocs.push({ label: labelEl.value.trim() || `Document ${i+1}`, path });
    }

    const submittedData = {
      dob: document.getElementById('cf-dob').value,
      gender: document.getElementById('cf-gender').value,
      address: document.getElementById('cf-address').value.trim(),
      email: document.getElementById('cf-email').value.trim(),
      photoPath: photoUrl,
      aadhaarNumber: document.getElementById('cf-aadhaar').value.trim(),
      aadhaarPath: aadhaarUrl,
      panNumber: document.getElementById('cf-pan').value.trim().toUpperCase(),
      panPath: panUrl,
      extraDocs,
      bankAccountName: document.getElementById('cf-bank-name').value.trim(),
      bankAccountNumber: document.getElementById('cf-bank-acc').value.trim(),
      bankIfsc: document.getElementById('cf-bank-ifsc').value.trim().toUpperCase(),
      emergencyContactName: document.getElementById('cf-emergency-name').value.trim(),
      emergencyContactRelation: document.getElementById('cf-emergency-rel').value.trim(),
      emergencyContactPhone: document.getElementById('cf-emergency-phone').value.trim(),
      education: document.getElementById('cf-education').value.trim(),
      experience: document.getElementById('cf-experience').value.trim(),
      referenceName: document.getElementById('cf-ref-name').value.trim(),
      referencePhone: document.getElementById('cf-ref-phone').value.trim()
    };

    candidateState.offer.status = 'submitted';
    candidateState.offer.submittedData = submittedData;
    candidateState.offer.submittedAt = new Date().toISOString();
    await VW_DB.put(VW_DB.STORES.staffOffers, candidateState.offer);

    // Show induction checklist before final confirmation
    renderInductionChecklist();
  } catch (e) {
    console.error('Onboarding submission error:', e);
    showToast('Something went wrong submitting — please try again', 'warn');
  }
}
window.submitCandidateForm = submitCandidateForm;

const INDUCTION_CHECKLIST = [
  { id: 'ic1', text: 'I have read and understood the V Wholesale Code of Conduct' },
  { id: 'ic2', text: 'I have read and understood the Leave & Attendance Policy' },
  { id: 'ic3', text: 'I have read and understood the Customer Handling Guidelines' },
  { id: 'ic4', text: 'I have read and understood the Data Privacy & Confidentiality Policy' },
  { id: 'ic5', text: 'I understand that company property must be used responsibly' },
  { id: 'ic6', text: 'I have noted emergency contacts and evacuation procedures' },
  { id: 'ic7', text: 'I agree to maintain professional conduct at all times' },
  { id: 'ic8', text: 'I acknowledge that violation of policies may lead to disciplinary action' },
];

function renderInductionChecklist() {
  const content = document.getElementById('app-content');
  const name = candidateState.offer?.candidateName || 'Employee';
  content.innerHTML = candidateWrapper(`
    <h2 style="margin:0 0 4px">📋 Induction Checklist</h2>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px">Please read and acknowledge each point below. You must tick all items before completing onboarding.</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
      ${INDUCTION_CHECKLIST.map(item => `
      <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer">
        <input type="checkbox" id="${item.id}" style="margin-top:2px;width:18px;height:18px;accent-color:var(--gold);flex-shrink:0" onchange="updateInductionProgress()">
        <span style="font-size:13px;line-height:1.5">${item.text}</span>
      </label>`).join('')}
    </div>
    <div id="induction-progress" style="font-size:12px;color:var(--text3);margin-bottom:12px">0 of ${INDUCTION_CHECKLIST.length} items acknowledged</div>
    <div style="margin-bottom:16px">
      <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">Digital Signature *</label>
      <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Type your full name below as your digital signature to confirm you have read and agree to all the above policies.</p>
      <input type="text" id="induction-signature" placeholder="Type your full name: ${name}" style="text-align:center;font-style:italic" oninput="updateInductionProgress()">
    </div>
    <button id="induction-submit-btn" class="btn-primary full-width" onclick="completeInduction()" disabled style="opacity:0.5">Complete Onboarding</button>
  `);
}
window.renderInductionChecklist = renderInductionChecklist;

function updateInductionProgress() {
  const checked = INDUCTION_CHECKLIST.filter(item => document.getElementById(item.id)?.checked).length;
  const sig = document.getElementById('induction-signature')?.value.trim();
  const name = candidateState.offer?.candidateName || '';
  const sigMatch = sig.toLowerCase().replace(/\s+/g,' ') === name.toLowerCase().replace(/\s+/g,' ');
  const el = document.getElementById('induction-progress');
  const btn = document.getElementById('induction-submit-btn');
  if (el) el.textContent = `${checked} of ${INDUCTION_CHECKLIST.length} items acknowledged${sigMatch ? ' · Signature ✓' : ' · Signature needed'}`;
  if (btn) {
    const allDone = checked === INDUCTION_CHECKLIST.length && sigMatch;
    btn.disabled = !allDone;
    btn.style.opacity = allDone ? '1' : '0.5';
  }
}
window.updateInductionProgress = updateInductionProgress;

async function completeInduction() {
  const sig = document.getElementById('induction-signature')?.value.trim();
  if (!sig) { showToast('Please sign with your full name', 'warn'); return; }
  const offer = candidateState.offer;
  offer.inductionCompleted = true;
  offer.inductionSignature = sig;
  offer.inductionCompletedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.staffOffers, offer);

  const content = document.getElementById('app-content');
  content.innerHTML = candidateWrapper(`
    <div style="text-align:center;padding:30px 0">
      <div style="font-size:56px;margin-bottom:12px">🎉</div>
      <h2 style="margin:0 0 8px">Welcome to V Wholesale, ${offer.candidateName}!</h2>
      <p style="color:var(--text3);font-size:14px;margin-bottom:16px">Your onboarding is complete. HR will review your details and send you your app login via WhatsApp.</p>
      <div style="background:rgba(200,151,43,0.1);border:1px solid rgba(200,151,43,0.3);border-radius:12px;padding:16px;text-align:left">
        <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:8px">What happens next:</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          1. HR reviews your submission<br>
          2. Once approved, you'll receive your app login PIN on WhatsApp<br>
          3. Download the app or open it in your browser<br>
          4. Log in with your phone number and the PIN sent to you
        </div>
      </div>
    </div>`);
}
window.completeInduction = completeInduction;

// ===== STAGE 3: HR REVIEW QUEUE =====
async function reviewOfferSubmission(offerId) {
  const offer = await VW_DB.getById(VW_DB.STORES.staffOffers, offerId);
  if (!offer || !offer.submittedData) return;
  const d = offer.submittedData;

  const photoUrl = await VW_DB.getOnboardingDocUrl(d.photoPath);
  const aadhaarUrl = await VW_DB.getOnboardingDocUrl(d.aadhaarPath);
  const panUrl = await VW_DB.getOnboardingDocUrl(d.panPath);
  const extraDocUrls = [];
  for (const doc of (d.extraDocs||[])) {
    extraDocUrls.push({ label: doc.label, url: await VW_DB.getOnboardingDocUrl(doc.path) });
  }

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-avatar-row">
      ${photoUrl ? `<img src="${photoUrl}" style="width:56px;height:56px;border-radius:50%;object-fit:cover">` : `<div class="sheet-avatar">${offer.candidateName[0]}</div>`}
      <div><h3 style="margin:0">${offer.candidateName}</h3><p style="margin:0;font-size:13px;color:#888">${offer.role} &middot; ${offer.department||''}</p></div>
    </div>

    <div class="req-item-card" style="margin-top:10px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">Personal Information</div>
      <div style="font-size:12px;line-height:1.7">
        DOB: ${d.dob ? new Date(d.dob).toLocaleDateString('en-IN') : '—'} &middot; Gender: ${d.gender||'—'}<br>
        Address: ${d.address||'—'}<br>
        Email: ${d.email||'—'}
      </div>
    </div>

    <div class="req-item-card" style="margin-top:8px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">ID Proof</div>
      <div style="font-size:12px;line-height:1.7">
        Aadhaar: ${d.aadhaarNumber||'—'} ${aadhaarUrl ? `· <a href="${aadhaarUrl}" target="_blank" style="color:var(--gold)">View</a>` : ''}<br>
        PAN: ${d.panNumber||'—'} ${panUrl ? `· <a href="${panUrl}" target="_blank" style="color:var(--gold)">View</a>` : ''}
        ${extraDocUrls.map(doc => `<br>${doc.label}: ${doc.url ? `<a href="${doc.url}" target="_blank" style="color:var(--gold)">View</a>` : '—'}`).join('')}
      </div>
    </div>

    <div class="req-item-card" style="margin-top:8px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">Bank Details</div>
      <div style="font-size:12px;line-height:1.7">
        ${d.bankAccountName||'—'} &middot; ${d.bankAccountNumber||'—'} &middot; ${d.bankIfsc||'—'}
      </div>
    </div>

    <div class="req-item-card" style="margin-top:8px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">Emergency Contact</div>
      <div style="font-size:12px;line-height:1.7">
        ${d.emergencyContactName||'—'} (${d.emergencyContactRelation||'—'}) &middot; ${d.emergencyContactPhone||'—'}
      </div>
    </div>

    <div class="req-item-card" style="margin-top:8px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">Education &amp; Experience</div>
      <div style="font-size:12px;line-height:1.7">
        ${d.education||'—'}
        ${d.experience ? `<br>${d.experience}` : ''}
      </div>
    </div>

    ${d.referenceName ? `
    <div class="req-item-card" style="margin-top:8px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">Reference</div>
      <div style="font-size:12px">${d.referenceName} &middot; ${d.referencePhone||'—'}</div>
    </div>` : ''}

    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn-primary full-width" onclick="approveOfferIntoStaff(${offer.id})">✓ Approve &amp; Add to Team</button>
      <button class="btn-secondary full-width" style="color:var(--red)" onclick="confirmRejectOfferSubmission(${offer.id})">✕ Reject</button>
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.reviewOfferSubmission = reviewOfferSubmission;

async function approveOfferIntoStaff(offerId) {
  const offer = await VW_DB.getById(VW_DB.STORES.staffOffers, offerId);
  if (!offer) return;
  const d = offer.submittedData || {};
  const profile = VW_AUTH.getCurrentProfile();

  // Step 1: Create Supabase auth account using their phone + the PIN from the offer
  // This means they can log in immediately — no self-registration needed
  const phone = (offer.candidatePhone||'').replace(/\D/g,'').slice(-10);
  const email = `${phone}@vwholesale.app`;
  const pin = offer.pin || '123456';

  let authUserId = null;
  try {
    const { data: signUpData, error: signUpErr } = await VW_DB.client.auth.admin
      ? await VW_DB.client.auth.admin.createUser({ email, password: pin, email_confirm: true })
      : await VW_DB.client.auth.signUp({ email, password: pin });
    if (signUpErr && !signUpErr.message?.includes('already registered')) {
      console.warn('Auth account creation warning:', signUpErr.message);
    }
    authUserId = signUpData?.user?.id || signUpData?.id;
  } catch(e) {
    console.warn('Could not auto-create auth account:', e.message);
  }

  // Step 2: Create staff record
  const staffId = await VW_DB.put(VW_DB.STORES.staff, {
    name: offer.candidateName, phone: offer.candidatePhone, role: offer.role,
    department: offer.department, team: 'specialist', salary: offer.salary,
    joinDate: offer.startDate, joiningDate: offer.startDate,
    grossSalary: offer.salary * 12,
    attendanceName: offer.candidateName,
    dob: d.dob, gender: d.gender, address: d.address, personalEmail: d.email,
    photoPath: d.photoPath, aadhaarNumber: d.aadhaarNumber, aadhaarPath: d.aadhaarPath,
    panNumber: d.panNumber, panPath: d.panPath, extraDocs: d.extraDocs || [],
    bankAccountName: d.bankAccountName, bankAccountNumber: d.bankAccountNumber,
    bankIfsc: d.bankIfsc, bankName: '',
    emergencyContactName: d.emergencyContactName, emergencyContactPhone: d.emergencyContactPhone,
    education: d.education, experience: d.experience,
    referenceName: d.referenceName, referencePhone: d.referencePhone,
    active: true, createdAt: new Date().toISOString()
  });

  // Step 3: Create profile record so they can log in
  if (authUserId) {
    await VW_DB.put(VW_DB.STORES.profiles, {
      id: authUserId,
      phone, name: offer.candidateName,
      role: offer.role || 'staff',
      status: 'approved',
      staffId,
      approvedAt: new Date().toISOString(),
      approvedBy: profile?.name || ''
    });
  }

  // Step 4: Mark offer approved
  offer.status = 'approved';
  offer.reviewedByName = profile?.name || '';
  offer.reviewedAt = new Date().toISOString();
  offer.approvedStaffId = staffId;
  offer.authAccountCreated = !!authUserId;
  await VW_DB.put(VW_DB.STORES.staffOffers, offer);

  // Step 5: WhatsApp them their login details
  if (phone) {
    const loginMsg = encodeURIComponent(
      `Hi ${offer.candidateName}! 🎉\n\nWelcome to V Wholesale! Your onboarding is complete.\n\n` +
      `*Your App Login Details:*\n` +
      `📱 Phone: ${offer.candidatePhone}\n` +
      `🔐 PIN: ${pin}\n\n` +
      `🔗 App: https://hmehtavw.github.io/vwholesale-app/\n\n` +
      `Please login and change your PIN immediately from Settings.\n\n` +
      `— HR Team, V Wholesale`
    );
    window.open(`https://wa.me/91${phone}?text=${loginMsg}`, '_blank');
  }

  showToast(`${offer.candidateName} approved — login credentials sent via WhatsApp`, 'success');
  closeSheet();
  navigateTo('hr');
}
window.approveOfferIntoStaff = approveOfferIntoStaff;

function confirmRejectOfferSubmission(offerId) {
  const reason = prompt('Reason for rejecting (optional, for your own records):');
  if (reason === null) return;
  rejectOfferSubmission(offerId, reason);
}
window.confirmRejectOfferSubmission = confirmRejectOfferSubmission;

async function rejectOfferSubmission(offerId, reason) {
  const offer = await VW_DB.getById(VW_DB.STORES.staffOffers, offerId);
  if (!offer) return;
  const profile = VW_AUTH.getCurrentProfile();
  offer.status = 'rejected';
  offer.reviewedByName = profile ? profile.name : '';
  offer.reviewedAt = new Date().toISOString();
  offer.rejectReason = reason || '';
  await VW_DB.put(VW_DB.STORES.staffOffers, offer);
  showToast('Submission rejected', 'info');
  closeSheet();
  navigateTo('hr');
}




/* === reports.js === */

// ===================== HELPERS =====================
function isSameDay(d1, d2) { return new Date(d1).toDateString() === new Date(d2).toDateString(); }

function avgResponseMinutes(entries) {
  const times = entries.filter(e => e.respondedAt).map(e => (new Date(e.respondedAt) - new Date(e.notifiedAt)) / 60000);
  if (!times.length) return null;
  return (times.reduce((a,b)=>a+b,0) / times.length).toFixed(1);
}


// ===================== TODAY'S OPERATIONS REPORT =====================
async function buildOpsReport(daysBack = 0) {
  const visits = await VW_DB.all(VW_DB.STORES.visits);
  const tasks = await VW_DB.all(VW_DB.STORES.tasks);
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);

  const targetDate = new Date(); targetDate.setDate(targetDate.getDate() - daysBack);
  const dayVisits = visits.filter(v => isSameDay(v.date, targetDate));
  const dayTasks = tasks.filter(t => isSameDay(t.createdAt, targetDate));
  const dayInvoices = invoices.filter(i => isSameDay(i.date, targetDate));

  const customerVisits = dayVisits.filter(v => v.visitorType === 'customer');
  const visitorEntries = dayVisits.filter(v => v.visitorType !== 'customer');

  const visitorByType = {};
  VISITOR_TYPES.forEach(vt => visitorByType[vt.key] = visitorEntries.filter(v=>v.visitorType===vt.key).length);

  const taskByDept = {};
  const deptNames = await VW_CHECKIN.getDepartmentNames();
  deptNames.forEach(d => taskByDept[d] = { total: 0, won: 0, lost: 0, active: 0 });
  dayTasks.forEach(t => {
    if (!taskByDept[t.department]) taskByDept[t.department] = { total: 0, won: 0, lost: 0, active: 0 };
    taskByDept[t.department].total++;
    if (t.stage === 'Won') taskByDept[t.department].won++;
    else if (t.stage === 'Lost') taskByDept[t.department].lost++;
    else taskByDept[t.department].active++;
  });

  const visitEscalations = customerVisits.filter(v => (v.escalationLog||[]).length > 1).length;
  const taskEscalations = dayTasks.filter(t => (t.escalationLog||[]).length > 1).length;

  const allVisitExecEntries = customerVisits.flatMap(v => (v.escalationLog||[]).filter(l=>l.level==='executive'));
  const avgVisitResponse = avgResponseMinutes(allVisitExecEntries);

  const allTaskEntries = dayTasks.flatMap(t => t.escalationLog||[]);
  const avgTaskResponse = avgResponseMinutes(allTaskEntries);

  const revenue = dayInvoices.reduce((s,i)=>s+(i.total||0), 0);
  const urgentCount = dayVisits.filter(v => (v.escalationLog||[]).some(l=>l.level==='management')).length;

  return {
    date: targetDate, customerVisits, visitorEntries, visitorByType, taskByDept,
    visitEscalations, taskEscalations, avgVisitResponse, avgTaskResponse, revenue, urgentCount,
    dayTasks
  };
}

async function renderOpsReport(daysBack = 0) {
  const r = await buildOpsReport(daysBack);
  const label = daysBack === 0 ? 'Today' : r.date.toLocaleDateString('en-IN', {weekday:'short', day:'numeric', month:'short'});

  return `
  <div class="metric-grid-4">
    <div class="metric-card gold"><div class="mc-label">Customer Walk-ins</div><div class="mc-value">${r.customerVisits.length}</div></div>
    <div class="metric-card"><div class="mc-label">Visitors</div><div class="mc-value">${r.visitorEntries.length}</div></div>
    <div class="metric-card"><div class="mc-label">Tasks Created</div><div class="mc-value">${r.dayTasks.length}</div></div>
    <div class="metric-card"><div class="mc-label">Revenue</div><div class="mc-value">&#8377;${Math.round(r.revenue/1000)||0}K</div></div>
  </div>

  ${r.urgentCount ? `<div class="alert-card"><div class="alert-title">&#128680; ${r.urgentCount} visit(s) went unattended 4+ minutes</div></div>` : ''}

  <div class="card">
    <h3 class="card-title">Response Times — ${label}</h3>
    <div class="metric-grid-2">
      <div class="metric-card"><div class="mc-label">Avg Exec Response</div><div class="mc-value">${r.avgVisitResponse ? r.avgVisitResponse+' min' : '—'}</div></div>
      <div class="metric-card"><div class="mc-label">Avg Task Response</div><div class="mc-value">${r.avgTaskResponse ? r.avgTaskResponse+' min' : '—'}</div></div>
    </div>
    <div class="metric-grid-2" style="margin-top:8px">
      <div class="metric-card"><div class="mc-label">Visits Escalated</div><div class="mc-value">${r.visitEscalations} / ${r.customerVisits.length}</div></div>
      <div class="metric-card"><div class="mc-label">Tasks Escalated</div><div class="mc-value">${r.taskEscalations} / ${r.dayTasks.length}</div></div>
    </div>
  </div>

  <div class="card">
    <h3 class="card-title">Visitor Breakdown — ${label}</h3>
    ${r.visitorEntries.length ? VISITOR_TYPES.map(vt => r.visitorByType[vt.key] ? `
      <div class="cust-row" style="cursor:default">
        <div class="staff-avatar">${vt.icon}</div>
        <div class="cust-info"><div class="cust-name">${vt.label}</div></div>
        <div class="badge">${r.visitorByType[vt.key]}</div>
      </div>` : '').join('') : '<p class="empty-msg">No visitors</p>'}
  </div>

  <div class="card">
    <h3 class="card-title">Requirements by Department — ${label}</h3>
    ${Object.entries(r.taskByDept).filter(([,v])=>v.total>0).length ? Object.entries(r.taskByDept).filter(([,v])=>v.total>0).map(([dept,v]) => `
      <div class="cust-row" style="cursor:default">
        <div class="staff-avatar">${dept[0]}</div>
        <div class="cust-info"><div class="cust-name">${dept}</div><div class="cust-meta">${v.won} won &middot; ${v.lost} lost &middot; ${v.active} active</div></div>
        <div class="badge">${v.total}</div>
      </div>`).join('') : '<p class="empty-msg">No requirements logged</p>'}
  </div>
  `;
}

// ===================== WEEKLY REPORT =====================
async function renderWeeklyReport() {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(await buildOpsReport(i));

  const totalWalkins = days.reduce((s,d)=>s+d.customerVisits.length, 0);
  const totalVisitors = days.reduce((s,d)=>s+d.visitorEntries.length, 0);
  const totalTasks = days.reduce((s,d)=>s+d.dayTasks.length, 0);
  const totalRevenue = days.reduce((s,d)=>s+d.revenue, 0);
  const wonTasks = days.reduce((s,d)=>s+d.dayTasks.filter(t=>t.stage==='Won').length, 0);
  const lostTasks = days.reduce((s,d)=>s+d.dayTasks.filter(t=>t.stage==='Lost').length, 0);
  const convRate = (wonTasks+lostTasks) ? Math.round(wonTasks/(wonTasks+lostTasks)*100) : 0;

  return `
  <div class="metric-grid-4">
    <div class="metric-card gold"><div class="mc-label">Walk-ins (7d)</div><div class="mc-value">${totalWalkins}</div></div>
    <div class="metric-card"><div class="mc-label">Visitors (7d)</div><div class="mc-value">${totalVisitors}</div></div>
    <div class="metric-card"><div class="mc-label">Tasks (7d)</div><div class="mc-value">${totalTasks}</div></div>
    <div class="metric-card"><div class="mc-label">Win Rate</div><div class="mc-value">${convRate}%</div></div>
  </div>

  <div class="card">
    <h3 class="card-title">Revenue This Week</h3>
    <div class="mc-value" style="font-size:28px;margin-bottom:10px">&#8377;${totalRevenue.toLocaleString('en-IN')}</div>
    <div style="position:relative;width:100%;height:180px"><canvas id="weekly-chart"></canvas></div>
  </div>

  <div class="card">
    <h3 class="card-title">Day by Day</h3>
    ${days.map(d => `
      <div class="cust-row" style="cursor:default">
        <div class="staff-avatar">${new Date(d.date).toLocaleDateString('en-IN',{weekday:'short'})[0]}</div>
        <div class="cust-info"><div class="cust-name">${new Date(d.date).toLocaleDateString('en-IN',{weekday:'short', day:'numeric', month:'short'})}</div>
        <div class="cust-meta">${d.customerVisits.length} walk-ins &middot; ${d.dayTasks.length} tasks &middot; &#8377;${Math.round(d.revenue/1000)}K</div></div>
      </div>`).join('')}
  </div>
  `;
}

function drawWeeklyChart(days) {
  const canvas = document.getElementById('weekly-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: days.map(d=>new Date(d.date).toLocaleDateString('en-IN',{weekday:'short'})),
      datasets: [{ label: 'Revenue', data: days.map(d=>d.revenue), backgroundColor: '#C8972B' }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ ticks:{color:'var(--text3)'}, grid:{color:'#222'} }, x:{ ticks:{color:'var(--text3)'}, grid:{display:false} } } }
  });
}

// ===================== STAFF PERFORMANCE =====================
async function renderStaffPerformance() {
  const execs = await VW_DB.all(VW_DB.STORES.executives);
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const visits = await VW_DB.all(VW_DB.STORES.visits);
  const tasks = await VW_DB.all(VW_DB.STORES.tasks);

  execs.sort((a,b)=>a.order-b.order);

  const execRows = execs.map(e => {
    const entries = visits.flatMap(v => (v.escalationLog||[]).filter(l => l.level==='executive' && l.staffId === e.id));
    const accepted = entries.filter(en=>en.status==='accepted').length;
    const timedOut = entries.filter(en=>en.status==='timeout').length;
    const avgResp = avgResponseMinutes(entries);
    return { name: e.name, assigned: entries.length, accepted, timedOut, avgResp, status: e.status };
  });

  const specialistRows = staff.filter(s => ['specialist','TL'].includes(s.team)).map(s => {
    const myTasks = tasks.filter(t => (t.escalationLog||[]).some(l=>l.staffId===s.id) || t.assignedTo===s.id);
    const won = myTasks.filter(t=>t.stage==='Won').length;
    const lost = myTasks.filter(t=>t.stage==='Lost').length;
    const active = myTasks.filter(t=>!['Won','Lost'].includes(t.stage)).length;
    const conv = (won+lost) ? Math.round(won/(won+lost)*100) : null;
    const entries = myTasks.flatMap(t => (t.escalationLog||[]).filter(l=>l.staffId===s.id));
    const avgResp = avgResponseMinutes(entries);
    return { name: s.name, dept: s.department, team: s.team, assigned: myTasks.length, won, lost, active, conv, avgResp };
  });

  return `
  <div class="card">
    <h3 class="card-title">Store Executives</h3>
    ${execRows.length ? execRows.map(r => `
      <div class="cust-row" style="cursor:default">
        <div class="staff-avatar">${r.name[0]}</div>
        <div class="cust-info">
          <div class="cust-name">${r.name} <span style="font-size:11px;color:var(--text3)">(${r.status})</span></div>
          <div class="cust-meta">${r.assigned} assigned &middot; ${r.accepted} accepted &middot; ${r.timedOut} timed out${r.avgResp ? ' &middot; avg '+r.avgResp+' min' : ''}</div>
        </div>
      </div>`).join('') : '<p class="empty-msg">No executives configured</p>'}
  </div>

  <div class="card">
    <h3 class="card-title">Department Specialists &amp; TLs</h3>
    ${specialistRows.length ? specialistRows.map(r => `
      <div class="cust-row" style="cursor:default">
        <div class="staff-avatar">${r.name[0]}</div>
        <div class="cust-info">
          <div class="cust-name">${r.name} <span style="font-size:11px;color:var(--text3)">(${r.dept})</span></div>
          <div class="cust-meta">${r.assigned} tasks &middot; ${r.won} won &middot; ${r.lost} lost &middot; ${r.active} active${r.conv!==null ? ' &middot; '+r.conv+'% win rate' : ''}${r.avgResp ? ' &middot; avg '+r.avgResp+' min' : ''}</div>
        </div>
      </div>`).join('') : '<p class="empty-msg">No specialists configured</p>'}
  </div>
  `;
}

window.VW_REPORTS = { renderOpsReport, renderWeeklyReport, renderStaffPerformance, drawWeeklyChart, buildOpsReport };




/* === analytics.js === */

async function renderAnalytics() {
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);
  const visits = await VW_DB.all(VW_DB.STORES.visits);
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const leads = await VW_DB.all(VW_DB.STORES.leads);
  const feedback = await VW_DB.all(VW_DB.STORES.feedback);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthInv = invoices.filter(i => new Date(i.date) >= monthStart);
  const prevMonthInv = invoices.filter(i => { const d=new Date(i.date); return d>=prevMonthStart&&d<=prevMonthEnd; });
  const thisMonthRevenue = thisMonthInv.reduce((s,i)=>s+(i.total||0),0);
  const prevMonthRevenue = prevMonthInv.reduce((s,i)=>s+(i.total||0),0);
  const revGrowth = prevMonthRevenue ? Math.round((thisMonthRevenue-prevMonthRevenue)/prevMonthRevenue*100) : 0;
  const avgOrderValue = invoices.length ? Math.round(invoices.reduce((s,i)=>s+(i.total||0),0)/invoices.length) : 0;
  const avgRating = feedback.length ? (feedback.reduce((s,f)=>s+(f.rating||0),0)/feedback.length).toFixed(1) : '—';
  const convRate = leads.length ? Math.round(leads.filter(l=>l.stage==='Won').length/leads.length*100) : 0;
  const repeatCustomers = customers.filter(c => (c.visitCount||0)>1).length;
  const repeatRate = customers.length ? Math.round(repeatCustomers/customers.length*100) : 0;

  const html = `
  <div class="module-header">
    <h2>Analytics</h2>
    <div style="font-size:12px;color:var(--text3);margin-top:4px">${now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div>
  </div>
  <div class="entry-type-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
    <button class="entry-type-btn active" onclick="switchAnalyticsTab('revenue',this)">&#128202; Revenue</button>
    <button class="entry-type-btn" onclick="switchAnalyticsTab('ops',this)">&#128203; Operations</button>
    <button class="entry-type-btn" onclick="switchAnalyticsTab('staff',this)">&#128101; Staff</button>
  </div>
  <div id="analytics-tab-content">
  <div class="metric-grid-4">
    <div class="metric-card gold">
      <div class="mc-label">This Month</div>
      <div class="mc-value">&#8377;${Math.round(thisMonthRevenue/1000)||0}K</div>
      <div style="font-size:11px;margin-top:4px;color:${revGrowth>=0?'var(--green)':'var(--red)'}">${revGrowth>=0?'&#8593;':'&#8595;'}${Math.abs(revGrowth)}% vs last month</div>
    </div>
    <div class="metric-card"><div class="mc-label">Avg Order</div><div class="mc-value">&#8377;${Math.round(avgOrderValue/1000)||0}K</div></div>
    <div class="metric-card"><div class="mc-label">Repeat Rate</div><div class="mc-value">${repeatRate}%</div></div>
    <div class="metric-card"><div class="mc-label">Conversion</div><div class="mc-value">${convRate}%</div></div>
  </div>
  <div class="card">
    <h3 class="card-title">Daily Revenue — Last 14 Days</h3>
    <div style="position:relative;width:100%;height:200px"><canvas id="daily-revenue-chart"></canvas></div>
  </div>
  <div class="card">
    <h3 class="card-title">Revenue by Department</h3>
    <div style="position:relative;width:100%;height:220px"><canvas id="dept-revenue-chart"></canvas></div>
    <div id="dept-legend" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"></div>
  </div>
  <div class="card">
    <h3 class="card-title">Revenue Engine Breakdown</h3>
    <div id="engine-breakdown">${await renderEngineBreakdown(customers, invoices)}</div>
  </div>
  <div class="card">
    <h3 class="card-title">Walk-ins — Last 30 Days</h3>
    <div style="position:relative;width:100%;height:180px"><canvas id="walkin-chart"></canvas></div>
  </div>
  <div class="card">
    <h3 class="card-title">Key Insights</h3>
    <div>${generateInsights(invoices, visits, customers, leads, feedback)}</div>
  </div>
  </div>
  `;

  // Schedule chart rendering after DOM is updated
  setTimeout(() => drawAnalyticsCharts(invoices, visits), 50);

  return html;
}

async function switchAnalyticsTab(tab, btn) {
  document.querySelectorAll('.entry-type-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const content = document.getElementById('analytics-tab-content');
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  if (tab === 'revenue') {
    const html = await renderAnalytics();
    // re-extract just the tab content portion isn't trivial; simplest: re-navigate
    navigateTo('analytics');
    return;
  } else if (tab === 'ops') {
    content.innerHTML = `
      <div class="entry-type-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:14px">
        <button class="entry-type-btn active" onclick="switchOpsView('today',this)">Today</button>
        <button class="entry-type-btn" onclick="switchOpsView('week',this)">This Week</button>
      </div>
      <div id="ops-content">${await VW_REPORTS.renderOpsReport(0)}</div>
    `;
  } else if (tab === 'staff') {
    content.innerHTML = await VW_REPORTS.renderStaffPerformance();
  }
}

async function switchOpsView(view, btn) {
  const container = btn.closest('.entry-type-grid');
  container.querySelectorAll('.entry-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const opsContent = document.getElementById('ops-content');
  if (view === 'today') {
    opsContent.innerHTML = await VW_REPORTS.renderOpsReport(0);
  } else {
    opsContent.innerHTML = await VW_REPORTS.renderWeeklyReport();
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(await VW_REPORTS.buildOpsReport(i));
    setTimeout(() => VW_REPORTS.drawWeeklyChart(days), 50);
  }
}

window.switchAnalyticsTab = switchAnalyticsTab;
window.switchOpsView = switchOpsView;

function drawAnalyticsCharts(invoices, visits) {
  if (typeof Chart === 'undefined') return;

  // Daily revenue - last 14 days
  const days14 = Array.from({length:14}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-13+i); return d;
  });
  const dailyRev = days14.map(d => {
    const key = d.toDateString();
    return invoices.filter(i => new Date(i.date).toDateString()===key).reduce((s,i)=>s+(i.total||0),0);
  });
  const dayLabels = days14.map(d => d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}));

  const dc = document.getElementById('daily-revenue-chart');
  if (dc) {
    new Chart(dc, {
      type: 'bar',
      data: { labels: dayLabels, datasets: [{ label: 'Revenue', data: dailyRev.map(v=>Math.round(v)), backgroundColor: 'rgba(200,151,43,0.7)', borderColor: '#C8972B', borderWidth: 1, borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#888', maxRotation: 45, autoSkip: false } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { font: { size: 10 }, color: '#888', callback: v => '₹'+Math.round(v/1000)+'K' } } } }
    });
  }

  // Dept doughnut
  const deptColors = { Tiles:'#378ADD', Sanitary:'#1D9E75', Plywood:'#7F77DD', Electricals:'#EF9F27', Paints:'#D85A30', Plumbing:'#D4537E', Appliances:'#888780' };
  const depts = Object.keys(deptColors);
  const deptRev = {};
  depts.forEach(d => deptRev[d] = 0);
  visits.forEach(v => {
    if (!v.invoiceId || !deptRev.hasOwnProperty(v.department)) return;
    const inv = invoices.find(i => i.id===v.invoiceId);
    if (inv) deptRev[v.department] = (deptRev[v.department]||0) + (inv.total||0);
  });
  const deptData = depts.map(d => Math.round(deptRev[d]||0));

  const drc = document.getElementById('dept-revenue-chart');
  if (drc) {
    new Chart(drc, {
      type: 'doughnut',
      data: { labels: depts, datasets: [{ data: deptData, backgroundColor: depts.map(d=>deptColors[d]), borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '65%' }
    });
  }
  const legend = document.getElementById('dept-legend');
  if (legend) {
    legend.innerHTML = depts.map(d =>
      `<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#aaa">` +
      `<span style="width:8px;height:8px;border-radius:2px;background:${deptColors[d]};display:inline-block"></span>${d}</span>`
    ).join('');
  }

  // Walk-ins
  const days30 = Array.from({length:30}, (_,i) => { const d=new Date(); d.setDate(d.getDate()-29+i); return d; });
  const walkins = days30.map(d => visits.filter(v => new Date(v.date).toDateString()===d.toDateString()).length);
  const walkLabels = days30.map((d,i) => i%5===0 ? d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '');

  const wc = document.getElementById('walkin-chart');
  if (wc) {
    new Chart(wc, {
      type: 'line',
      data: { labels: walkLabels, datasets: [{ label: 'Walk-ins', data: walkins, borderColor: '#7F77DD', backgroundColor: 'rgba(127,119,221,0.1)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#888' } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { font: { size: 10 }, color: '#888', callback: v => Math.round(v) } } } }
    });
  }
}

async function renderEngineBreakdown(customers, invoices) {
  const total = invoices.reduce((s,i)=>s+(i.total||0),0);
  const engines = [
    { name:'Retail', type:'retail', color:'#378ADD' },
    { name:'B2B Professionals', type:'b2b_pro', color:'#1D9E75' },
    { name:'B2B Shops', type:'b2b_shop', color:'#7F77DD' },
    { name:'TISAN / Private Label', type:'tisan', color:'#D85A30' },
    { name:'Contractor Club', type:'contractor_club', color:'#EF9F27' },
  ];
  const custTypeMap = {};
  customers.forEach(c => custTypeMap[c.id] = c.type);

  return engines.map(e => {
    const engineTotal = invoices.filter(i => custTypeMap[i.customerId]===e.type).reduce((s,i)=>s+(i.total||0),0);
    const pct = total ? Math.round(engineTotal/total*100) : 0;
    return `<div class="engine-row-an">
      <div class="engine-dot" style="background:${e.color}"></div>
      <div class="engine-name-an">${e.name}</div>
      <div class="engine-bar-bg-an"><div class="engine-bar-an" style="width:${pct}%;background:${e.color}"></div></div>
      <div class="engine-pct-an">${pct}%</div>
      <div class="engine-val-an">&#8377;${Math.round(engineTotal/1000)||0}K</div>
    </div>`;
  }).join('');
}

function generateInsights(invoices, visits, customers, leads, feedback) {
  const insights = [];
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthRev = invoices.filter(i=>new Date(i.date)>=monthStart).reduce((s,i)=>s+(i.total||0),0);
  const daysIn = today.getDate();
  const projected = Math.round(thisMonthRev/daysIn*30);

  if (projected > 0) insights.push({ icon:'📈', text:`At current pace, projected ₹${Math.round(projected/1000)}K this month.`, color:'var(--green)' });
  const repeatCount = customers.filter(c=>(c.visitCount||0)>1).length;
  if (repeatCount > 0) insights.push({ icon:'🔁', text:`${repeatCount} customers have visited more than once — strong retention.`, color:'var(--blue)' });
  const dueFollowups = leads.filter(l=>l.stage!=='Won'&&l.stage!=='Lost'&&l.followUpDate&&new Date(l.followUpDate)<=today).length;
  if (dueFollowups > 0) insights.push({ icon:'⏰', text:`${dueFollowups} leads have overdue follow-ups. Contact them today.`, color:'var(--gold)' });
  const avgRating = feedback.length ? feedback.reduce((s,f)=>s+(f.rating||0),0)/feedback.length : 0;
  if (avgRating > 0) insights.push({ icon:'⭐', text:`Average rating ${avgRating.toFixed(1)}/5. ${avgRating>=4?'Excellent — use this in investor updates.':'Focus on lower-rated departments.'}`, color: avgRating>=4?'var(--green)':'var(--gold)' });
  const repurchaseDue = customers.filter(c=>c.lastVisit&&(today-new Date(c.lastVisit))/86400000>=30).length;
  if (repurchaseDue > 0) insights.push({ icon:'📞', text:`${repurchaseDue} customers haven't visited in 30+ days. A WhatsApp nudge could bring them back.`, color:'#7F77DD' });

  if (!insights.length) return '<p class="empty-msg">Add customer and sales data to generate insights</p>';
  return insights.map(i => `<div class="insight-row"><span class="insight-icon">${i.icon}</span><span class="insight-text" style="color:${i.color}">${i.text}</span></div>`).join('');
}

window.VW_ANALYTICS = { renderAnalytics };

// =====================================================
// USER BEHAVIOUR REPORT (admin only)
// =====================================================
async function renderUserBehaviourTab() {
  const { data: events } = await VW_DB.client
    .from('user_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  const list = events || [];

  // Aggregate by user
  const byUser = {};
  list.forEach(e => {
    const key = e.user_name || 'Unknown';
    if (!byUser[key]) byUser[key] = { name: key, role: e.user_role, pageViews: 0, actions: 0, errors: 0, lastSeen: e.created_at };
    if (e.event_type === 'page_view') byUser[key].pageViews++;
    else if (e.event_type === 'action') byUser[key].actions++;
    else if (e.event_type === 'error') byUser[key].errors++;
    if (e.created_at > byUser[key].lastSeen) byUser[key].lastSeen = e.created_at;
  });

  const errors = list.filter(e => e.event_type === 'error');
  const topPages = {};
  list.filter(e => e.event_type === 'page_view').forEach(e => {
    topPages[e.page] = (topPages[e.page]||0)+1;
  });
  const sortedPages = Object.entries(topPages).sort((a,b)=>b[1]-a[1]).slice(0,8);

  return `
  <div style="margin-bottom:14px">
    <h3 class="card-title">👥 User Activity (last 200 events)</h3>
    ${Object.values(byUser).map(u => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:13px;font-weight:600">${u.name} <span style="font-size:11px;color:var(--text3)">${u.role}</span></div>
        <div style="font-size:11px;color:var(--text3)">Last: ${new Date(u.lastSeen).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</div>
      </div>
      <div style="display:flex;gap:12px;font-size:12px">
        <span style="color:var(--blue)">📄 ${u.pageViews}</span>
        <span style="color:var(--green)">✓ ${u.actions}</span>
        ${u.errors?`<span style="color:var(--red)">⚠️ ${u.errors}</span>`:''}
      </div>
    </div>`).join('')}
  </div>

  <div style="margin-bottom:14px">
    <h3 class="card-title">📊 Most Used Pages</h3>
    ${sortedPages.map(([page, count]) => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px">${page}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:${Math.round(count/sortedPages[0][1]*80)}px;height:6px;background:var(--gold);border-radius:3px"></div>
        <span style="font-size:12px;color:var(--text3)">${count}</span>
      </div>
    </div>`).join('')}
  </div>

  ${errors.length ? `
  <div>
    <h3 class="card-title" style="color:var(--red)">⚠️ Recent Errors (${errors.length})</h3>
    ${errors.slice(0,10).map(e => `
    <div style="background:rgba(239,68,68,0.06);border-radius:8px;padding:8px;margin-bottom:6px">
      <div style="font-size:12px;font-weight:600;color:var(--red)">${e.action}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px">${e.error_message||'—'}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">${e.user_name||'Unknown'} · ${new Date(e.created_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</div>
    </div>`).join('')}
  </div>` : '<div style="font-size:13px;color:var(--green);text-align:center;padding:16px">✓ No errors recorded</div>'}`;
}

if (window.VW_ANALYTICS) window.VW_ANALYTICS.renderUserBehaviourTab = renderUserBehaviourTab;




/* === training.js === */

// ===== TRAINING / LMS MODULE =====
const TRAINING_CATEGORIES = ['Tiles','Sanitary','Plywood','Electricals','Paints','Plumbing','Appliances','HR','Purchase','Inventory','Management','Accounts'];

async function currentUserIsTrainingAdmin() {
  return VW_AUTH.isAdmin();
}

async function renderTraining() {
  const materials = await VW_DB.all(VW_DB.STORES.trainingMaterials);
  const isAdmin = await currentUserIsTrainingAdmin();

  return `
  <div class="module-header">
    <h2>Training</h2>
    <div style="display:flex;gap:6px">
      ${isAdmin ? `<button class="btn-sm" onclick="showManageTrainingExperts()">👤 Experts</button>` : ''}
      ${isAdmin ? `<button class="btn-sm" onclick="showAddTrainingMaterial()">+ Add Material</button>` : ''}
    </div>
  </div>

  <div class="filter-row" id="training-cat-filters">
    <button class="filter-btn active" onclick="filterTrainingCat('all',this)">All</button>
    ${TRAINING_CATEGORIES.map(c => `<button class="filter-btn" onclick="filterTrainingCat('${c}',this)">${c}</button>`).join('')}
  </div>

  <div id="training-list">${renderTrainingList(materials)}</div>
  `;
}

function renderTrainingList(materials) {
  if (!materials.length) return '<p class="empty-msg">No training materials yet.</p>';
  const typeIcons = { manual: '📘', sop: '📋', video: '🎬' };
  const sorted = [...materials].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sorted.map(m => `
    <div class="card" style="margin-bottom:8px;cursor:pointer" onclick="openTrainingMaterial(${m.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:14px;font-weight:600">${typeIcons[m.type]||'📄'} ${m.title}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${m.category || 'General'} · ${m.type.toUpperCase()}</div>
        </div>
      </div>
    </div>`).join('');
}

async function filterTrainingCat(cat, btnEl) {
  document.querySelectorAll('#training-cat-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  const materials = await VW_DB.all(VW_DB.STORES.trainingMaterials);
  const filtered = cat === 'all' ? materials : materials.filter(m => m.category === cat);
  document.getElementById('training-list').innerHTML = renderTrainingList(filtered);
}

function showAddTrainingMaterial() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Add Training Material</h3>
    <div class="form-group"><label>Title *</label><input type="text" id="tm-title" placeholder="e.g. Tile Installation SOP"></div>
    <div class="form-group"><label>Type *</label>
      <select id="tm-type" onchange="toggleTrainingTypeFields()">
        <option value="manual">Manual</option>
        <option value="sop">SOP (Standard Operating Procedure)</option>
        <option value="video">Video</option>
      </select>
    </div>
    <div class="form-group"><label>Category</label>
      <select id="tm-category"><option value="">General (everyone)</option>${TRAINING_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select>
    </div>
    <div id="tm-content-field" class="form-group"><label>Content</label><textarea id="tm-content" rows="6" placeholder="Write the manual/SOP content here..."></textarea></div>
    <div id="tm-file-field" class="form-group" style="display:none"><label>Attach a file (optional, PDF/doc)</label><input type="file" id="tm-file" accept=".pdf,.doc,.docx"></div>
    <div id="tm-video-field" class="form-group" style="display:none">
      <label>Video File *</label>
      <input type="file" id="tm-video" accept="video/*">
      <p style="font-size:11px;color:var(--text3);margin-top:4px">Hosted privately — only people logged into the app can view it, and access is cut off the moment someone leaves the team.</p>
      <div id="tm-video-progress" style="font-size:12px;margin-top:4px"></div>
    </div>
    <button class="btn-primary full-width" onclick="saveTrainingMaterial()">Save</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showAddTrainingMaterial = showAddTrainingMaterial;

function toggleTrainingTypeFields() {
  const type = document.getElementById('tm-type').value;
  document.getElementById('tm-content-field').style.display = type === 'video' ? 'none' : 'block';
  document.getElementById('tm-file-field').style.display = type === 'video' ? 'none' : 'block';
  document.getElementById('tm-video-field').style.display = type === 'video' ? 'block' : 'none';
}
window.toggleTrainingTypeFields = toggleTrainingTypeFields;

async function saveTrainingMaterial() {
  const title = document.getElementById('tm-title').value.trim();
  const type = document.getElementById('tm-type').value;
  if (!title) return showToast('Enter a title', 'warn');

  const profile = VW_AUTH.getCurrentProfile();
  const record = {
    title, type, category: document.getElementById('tm-category').value || null,
    createdByName: profile ? profile.name : '', createdAt: new Date().toISOString()
  };

  if (type === 'video') {
    const videoInput = document.getElementById('tm-video');
    const file = videoInput.files[0];
    if (!file) return showToast('Choose a video file', 'warn');
    const progressEl = document.getElementById('tm-video-progress');
    if (progressEl) progressEl.textContent = 'Uploading — this can take a while for large videos...';
    try {
      record.videoPath = await VW_DB.uploadTrainingFile(file, 'video');
    } catch (e) {
      if (progressEl) progressEl.innerHTML = '<span style="color:var(--red)">Upload failed — try again</span>';
      return;
    }
  } else {
    record.content = document.getElementById('tm-content').value.trim();
    const fileInput = document.getElementById('tm-file');
    const file = fileInput.files[0];
    if (file) {
      try { record.filePath = await VW_DB.uploadTrainingFile(file, 'doc'); }
      catch (e) { showToast('File attachment failed, but saving the rest', 'warn'); }
    }
  }

  await VW_DB.put(VW_DB.STORES.trainingMaterials, record);
  showToast('Training material saved', 'success');
  closeSheet();
  navigateTo('training');
}
window.saveTrainingMaterial = saveTrainingMaterial;

async function openTrainingMaterial(id) {
  const m = await VW_DB.getById(VW_DB.STORES.trainingMaterials, id);
  if (!m) return;
  const isAdmin = await currentUserIsTrainingAdmin();
  const questions = (await VW_DB.all(VW_DB.STORES.trainingQuestions)).filter(q => q.materialId === id);
  const answers = await VW_DB.all(VW_DB.STORES.trainingAnswers);
  const canAnswer = await currentUserCanAnswerTraining(m.category);

  let mediaHtml = '';
  if (m.type === 'video' && m.videoPath) {
    const url = await VW_DB.getTrainingFileUrl(m.videoPath);
    mediaHtml = url ? `<video controls style="width:100%;border-radius:10px;margin-bottom:10px" src="${url}"></video>` : '<p style="color:var(--red);font-size:12px">Video unavailable right now</p>';
  } else if (m.filePath) {
    const url = await VW_DB.getTrainingFileUrl(m.filePath);
    mediaHtml = url ? `<a href="${url}" target="_blank" class="btn-secondary full-width" style="margin-bottom:10px;text-align:center;display:block">📎 Open Attached File</a>` : '';
  }

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${m.title}</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:10px">${m.category || 'General'} · ${m.type.toUpperCase()}${m.createdByName ? ' · by '+m.createdByName : ''}</p>
    ${mediaHtml}
    ${m.content ? `<div style="font-size:13px;line-height:1.6;white-space:pre-wrap;margin-bottom:14px">${m.content}</div>` : ''}

    <div style="border-top:1px solid var(--border);padding-top:10px">
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">❓ Questions</div>
      ${questions.length ? questions.map(q => {
        const a = answers.find(x => x.questionId === q.id);
        return `
        <div style="margin-bottom:10px;padding:8px;background:var(--bg2);border-radius:8px">
          <div style="font-size:13px;font-weight:600">${q.question}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">asked by ${q.askedByName||'—'}</div>
          ${a
            ? `<div style="font-size:12px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">💬 ${a.answer}<div style="font-size:11px;color:var(--text3);margin-top:2px">— ${a.answeredByName}</div></div>`
            : (canAnswer ? `<button class="btn-sm" style="margin-top:6px" onclick="showAnswerTrainingQuestion(${q.id},${id})">Answer</button>` : `<div style="font-size:11px;color:var(--gold);margin-top:4px">Awaiting an answer</div>`)
          }
        </div>`;
      }).join('') : '<p class="empty-msg">No questions yet</p>'}
      <button class="btn-secondary full-width" onclick="showAskTrainingQuestion(${id},'${(m.category||'').replace(/'/g,"\\'")}')">Ask a Question</button>
    </div>
    ${isAdmin ? `<button class="btn-secondary full-width" style="margin-top:10px;color:var(--red)" onclick="deleteTrainingMaterial(${id})">🗑 Delete</button>` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.openTrainingMaterial = openTrainingMaterial;

function showAskTrainingQuestion(materialId, category) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Ask a Question</h3>
    <div class="form-group"><label>Your Question *</label><textarea id="tq-question" rows="3" placeholder="What would you like to know?"></textarea></div>
    <button class="btn-primary full-width" onclick="submitTrainingQuestion(${materialId},'${category.replace(/'/g,"\\'")}')">Submit</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showAskTrainingQuestion = showAskTrainingQuestion;

async function submitTrainingQuestion(materialId, category) {
  const question = document.getElementById('tq-question').value.trim();
  if (!question) return showToast('Enter your question', 'warn');
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.trainingQuestions, {
    materialId, category: category || null, question,
    askedByName: profile ? profile.name : '', askedByStaffId: profile ? profile.staffId : null,
    status: 'open', createdAt: new Date().toISOString()
  });
  showToast('Question submitted', 'success');
  openTrainingMaterial(materialId);
}
window.submitTrainingQuestion = submitTrainingQuestion;

function showAnswerTrainingQuestion(questionId, materialId) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Answer Question</h3>
    <div class="form-group"><label>Your Answer *</label><textarea id="ta-answer" rows="4"></textarea></div>
    <button class="btn-primary full-width" onclick="submitTrainingAnswer(${questionId},${materialId})">Submit Answer</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showAnswerTrainingQuestion = showAnswerTrainingQuestion;

async function submitTrainingAnswer(questionId, materialId) {
  const answer = document.getElementById('ta-answer').value.trim();
  if (!answer) return showToast('Enter an answer', 'warn');
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.trainingAnswers, {
    questionId, answer, answeredByName: profile ? profile.name : '', answeredAt: new Date().toISOString()
  });
  const q = await VW_DB.getById(VW_DB.STORES.trainingQuestions, questionId);
  if (q) { q.status = 'answered'; await VW_DB.put(VW_DB.STORES.trainingQuestions, q); }
  showToast('Answer submitted', 'success');
  openTrainingMaterial(materialId);
}
window.submitTrainingAnswer = submitTrainingAnswer;

async function deleteTrainingMaterial(id) {
  await VW_DB.del(VW_DB.STORES.trainingMaterials, id);
  showToast('Material deleted', 'info');
  closeSheet();
  navigateTo('training');
}
window.deleteTrainingMaterial = deleteTrainingMaterial;

// Mirrors the server-side can_answer_training() RLS function: Management
// or the assigned expert for this category can answer — kept in sync
// with the database check so the UI only ever offers an Answer button to
// someone who'll actually be allowed to submit it.
async function currentUserCanAnswerTraining(category) {
  if (VW_AUTH.isAdmin()) return true;
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile || !profile.staffId) return false;
  const staff = await VW_DB.getById(VW_DB.STORES.staff, profile.staffId);
  if (!staff) return false;
  if (staff.team === 'management') return true;
  if (!category) return false;
  const experts = await VW_DB.all(VW_DB.STORES.trainingExperts);
  return experts.some(e => e.category === category && e.staffId === staff.id);
}
window.currentUserCanAnswerTraining = currentUserCanAnswerTraining;

// ===== Category expert assignment (Admin only) =====
async function showManageTrainingExperts() {
  const [staff, experts] = await Promise.all([
    VW_DB.all(VW_DB.STORES.staff), VW_DB.all(VW_DB.STORES.trainingExperts)
  ]);
  // Per your seniority rule: only level 2+ can be assigned as a category
  // expert, mirroring how level 2+ self-approves product photos.
  const eligible = staff.filter(s => (s.seniorityLevel||1) >= 2);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Category Experts</h3>
    <p class="sheet-meta">Only Senior/Lead or Head/Manager-level staff can be assigned. They'll be able to answer Training questions for their category, alongside Management.</p>
    ${TRAINING_CATEGORIES.map(cat => {
      const current = experts.filter(e => e.category === cat);
      return `
      <div class="form-group">
        <label>${cat}</label>
        <select onchange="assignTrainingExpert('${cat}', this.value)">
          <option value="">— none —</option>
          ${eligible.map(s => `<option value="${s.id}" ${current.some(c=>c.staffId===s.id)?'selected':''}>${s.name}</option>`).join('')}
        </select>
      </div>`;
    }).join('')}
    <button class="btn-secondary full-width" onclick="navigateTo('training')">Done</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.showManageTrainingExperts = showManageTrainingExperts;

async function assignTrainingExpert(category, staffId) {
  const experts = await VW_DB.all(VW_DB.STORES.trainingExperts);
  // Replace any existing expert for this category — one expert per
  // category at a time keeps "who answers this" unambiguous.
  for (const e of experts.filter(x => x.category === category)) {
    await VW_DB.del(VW_DB.STORES.trainingExperts, e.id);
  }
  if (staffId) {
    await VW_DB.put(VW_DB.STORES.trainingExperts, { category, staffId: parseInt(staffId), assignedAt: new Date().toISOString() });
  }
  showToast('Updated', 'success');
}
window.assignTrainingExpert = assignTrainingExpert;

window.VW_TRAINING = {
  renderTraining, filterTrainingCat, showAddTrainingMaterial, saveTrainingMaterial,
  openTrainingMaterial, showAskTrainingQuestion, submitTrainingQuestion,
  showAnswerTrainingQuestion, submitTrainingAnswer, deleteTrainingMaterial,
  showManageTrainingExperts, assignTrainingExpert, toggleTrainingTypeFields
};




/* === excel_import.js === */

// ===== EXCEL IMPORT (HR & Inventory) =====
// Shared logic: read an uploaded .xlsx/.csv, match its columns to known
// fields by header text (case/spacing-insensitive, with common aliases),
// route anything unrecognized into a flexible "customFields" object
// instead of silently dropping it or inventing a real database column,
// show a preview of what will be added/updated, then commit on confirm.

const IMPORT_FIELD_MAPS = {
  staff: {
    requiredKey: 'phone', // used to match existing records for update-vs-create
    fields: {
      name: ['name', 'employee name', 'full name', 'staff name'],
      phone: ['phone', 'mobile', 'mobile number', 'contact number', 'phone number'],
      role: ['role', 'designation', 'position'],
      department: ['department', 'dept'],
      team: ['team', 'team type'],
      salary: ['salary', 'monthly salary', 'pay', 'ctc'],
      joinDate: ['join date', 'joining date', 'date of joining', 'doj'],
      dob: ['dob', 'date of birth'],
      gender: ['gender', 'sex'],
      address: ['address', 'current address'],
      personalEmail: ['email', 'personal email', 'email address'],
      aadhaarNumber: ['aadhaar', 'aadhaar number', 'aadhar', 'aadhar number'],
      panNumber: ['pan', 'pan number'],
      bankAccountName: ['bank account name', 'account holder name'],
      bankAccountNumber: ['bank account number', 'account number'],
      bankIfsc: ['ifsc', 'ifsc code'],
      emergencyContactName: ['emergency contact name', 'emergency contact'],
      emergencyContactPhone: ['emergency contact phone', 'emergency phone'],
      education: ['education', 'qualification'],
      experience: ['experience', 'work experience']
    }
  },
  products: {
    requiredKey: 'barcode',
    fields: {
      name: ['name', 'product name', 'item name'],
      brand: ['brand'],
      model: ['model'],
      category: ['category', 'department'],
      pricingMode: ['pricing mode', 'price mode', 'mode'],
      price: ['price', 'price (net/final incl gst)', 'net price', 'selling price', 'mrp'],
      pricingBasicPrice: ['basic price', 'basic price (excl gst)', 'basic'],
      pricingMrp: ['mrp price'],
      pricingDiscPct: ['discount %', 'discount percent', 'disc %'],
      costPrice: ['cost price', 'cost', 'purchase price'],
      stock: ['stock', 'quantity', 'qty'],
      unit: ['unit', 'uom'],
      gst: ['gst', 'gst %', 'gst percent', 'tax'],
      barcode: ['barcode', 'sku', 'item code', 'barcode (leave blank for auto-qr)'],
      hsn: ['hsn', 'hsn code', 'hsn/sac', 'sac']
    }
  }
};

function normalizeHeader(h) {
  return String(h||'').toLowerCase().trim().replace(/\s+/g,' ');
}

function matchColumnsToFields(headers, entityType) {
  const map = IMPORT_FIELD_MAPS[entityType];
  const matched = {};   // header -> fieldKey
  const unmatched = []; // headers with no field match

  headers.forEach(h => {
    const norm = normalizeHeader(h);
    let foundField = null;
    for (const [fieldKey, aliases] of Object.entries(map.fields)) {
      if (aliases.includes(norm)) { foundField = fieldKey; break; }
    }
    if (foundField) matched[h] = foundField;
    else unmatched.push(h);
  });

  return { matched, unmatched };
}

let importState = { entityType: null, rows: [], headers: [], matched: {}, unmatched: [], newFieldLabels: {} };

function triggerExcelImport(entityType) {
  importState = { entityType, rows: [], headers: [], matched: {}, unmatched: [], newFieldLabels: {} };
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = (e) => handleExcelFileSelected(e.target.files[0]);
  input.click();
}
window.triggerExcelImport = triggerExcelImport;

function handleExcelFileSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      if (!rows.length) return showToast('That file has no data rows', 'warn');

      const headers = Object.keys(rows[0]);
      const { matched, unmatched } = matchColumnsToFields(headers, importState.entityType);
      importState.rows = rows;
      importState.headers = headers;
      importState.matched = matched;
      importState.unmatched = unmatched;

      showImportPreview();
    } catch (err) {
      console.error('Excel parse error:', err);
      showToast('Could not read that file — make sure it\'s a valid Excel/CSV', 'warn');
    }
  };
  reader.readAsArrayBuffer(file);
}

function showImportPreview() {
  const { rows, matched, unmatched, entityType } = importState;
  const entityLabel = entityType === 'staff' ? 'staff' : 'products';

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Import Preview</h3>
    <p class="sheet-meta">${rows.length} row(s) found in the file.</p>

    <div class="req-item-card" style="margin:10px 0">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">Matched Columns</div>
      ${Object.entries(matched).map(([h,f]) => `<div style="font-size:12px;padding:2px 0">"${h}" &rarr; ${f}</div>`).join('') || '<div style="font-size:12px;color:var(--text3)">None matched</div>'}
    </div>

    ${unmatched.length ? `
    <div class="req-item-card" style="margin:10px 0;border-color:var(--gold)">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px;color:var(--gold)">⚠️ New Columns Found</div>
      <p style="font-size:12px;color:var(--text3);margin-bottom:8px">These don't match any existing field. They'll be saved as custom fields on each ${entityLabel === 'staff' ? 'staff' : 'product'} record (visible and editable) — they will NOT become permanent database columns unless you ask for that later.</p>
      ${unmatched.map((h,i) => `<div style="font-size:12px;padding:3px 0">"${h}" &mdash; save as: <input type="text" value="${h}" style="width:140px;display:inline-block" id="newfield-${i}"></div>`).join('')}
    </div>` : ''}

    <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border2);border-radius:8px;margin:10px 0">
      ${rows.slice(0,5).map(r => `<div style="font-size:11px;padding:6px 10px;border-bottom:1px solid var(--border2)">${Object.values(r).join(' · ')}</div>`).join('')}
      ${rows.length > 5 ? `<div style="font-size:11px;padding:6px 10px;color:var(--text3)">...and ${rows.length-5} more</div>` : ''}
    </div>

    <button class="btn-primary full-width" onclick="confirmExcelImport()">Import ${rows.length} Row(s)</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function confirmExcelImport() {
  const { rows, matched, unmatched, entityType } = importState;
  const map = IMPORT_FIELD_MAPS[entityType];
  const store = entityType === 'staff' ? VW_DB.STORES.staff : VW_DB.STORES.products;

  unmatched.forEach((h,i) => {
    const input = document.getElementById(`newfield-${i}`);
    importState.newFieldLabels[h] = input ? input.value.trim() || h : h;
  });

  const existing = await VW_DB.all(store);
  const existingByKey = {};
  existing.forEach(r => { if (r[map.requiredKey]) existingByKey[String(r[map.requiredKey]).trim()] = r; });

  let added = 0, updated = 0;
  for (const row of rows) {
    const record = { customFields: {} };
    for (const [header, fieldKey] of Object.entries(matched)) {
      let val = row[header];
      if (['salary','price','costPrice','stock','gst'].includes(fieldKey)) val = parseFloat(val) || 0;
      record[fieldKey] = val;
    }
    for (const header of unmatched) {
      const label = importState.newFieldLabels[header] || header;
      if (row[header] !== '') record.customFields[label] = row[header];
    }

    const keyVal = record[map.requiredKey] ? String(record[map.requiredKey]).trim() : null;
    const existingRecord = keyVal ? existingByKey[keyVal] : null;

    if (existingRecord) {
      Object.assign(existingRecord, record, { customFields: { ...(existingRecord.customFields||{}), ...record.customFields } });
      await VW_DB.put(store, existingRecord);
      updated++;
    } else {
      if (entityType === 'staff') {
        record.team = record.team || 'specialist';
      } else {
        record.stock = record.stock || 0;
        record.unit = record.unit || 'pc';
        record.gst = record.gst || 18;
        // Auto-generate a QR/barcode if the import row left it blank —
        // every product needs a unique scannable code, this avoids staff
        // having to manually fill it in for every single row.
        if (!record.barcode) record.barcode = `VW-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random().toString(36).toUpperCase().slice(2,5)}`;
        // Compute the final GST-inclusive price from whichever pricing
        // mode columns were filled in, defaulting to treating the plain
        // "price" column as already inclusive (net_gst) for backwards
        // compatibility with old-style templates.
        if (!record.pricingMode) record.pricingMode = 'net_gst';
        const gstPct = parseFloat(record.gst) || 18;
        if (record.pricingMode === 'basic_gst' && record.pricingBasicPrice) {
          record.price = record.pricingBasicPrice * (1 + gstPct/100);
        } else if ((record.pricingMode === 'mrp_disc' || record.pricingMode === 'mrp_disc_gst') && record.pricingMrp) {
          const afterDisc = record.pricingMrp * (1 - (record.pricingDiscPct||0)/100);
          record.price = record.pricingMode === 'mrp_disc' ? afterDisc : afterDisc * (1 + gstPct/100);
        }
        // price column (net_gst) is already the final price, no further math needed
      }
      record.createdAt = new Date().toISOString();
      await VW_DB.put(store, record);
      added++;
    }
  }

  showToast(`Import complete: ${added} added, ${updated} updated`, 'success');
  closeSheet();
  navigateTo(entityType === 'staff' ? 'hr' : 'inventory');
}
window.confirmExcelImport = confirmExcelImport;

// ---------- DOWNLOADABLE TEMPLATES ----------
// Builds a starter .xlsx with the correct column headers (the canonical
// name for each known field) plus one example row, so people importing
// data don't have to guess what to call each column.
const IMPORT_TEMPLATE_EXAMPLES = {
  staff: {
    headers: ['Name','Phone','Role','Department','Team','Salary','Join Date','DOB','Gender','Address','Email','Aadhaar Number','PAN Number','Bank Account Name','Bank Account Number','IFSC','Emergency Contact Name','Emergency Contact Phone','Education','Experience'],
    example: ['Ramesh Kumar','9876543210','Sales Executive','Tiles','specialist',18000,'2026-01-15','1998-04-20','Male','12-3-45, Bhavanipuram, Vijayawada','ramesh@example.com','123456789012','ABCDE1234F','Ramesh Kumar','1234567890123','SBIN0001234','Suresh Kumar','9876500000','B.Com, Andhra University, 2021','2 years at XYZ Hardware as Sales Associate']
  },
  products: {
    headers: ['Name','Brand','Model','Category','Pricing Mode','Price (Net/Final incl GST)','Basic Price (excl GST)','MRP','Discount %','GST %','Cost Price','Stock','Unit','Barcode (leave blank for auto-QR)','HSN'],
    example: ['PVC Pipe 1 inch','Ashirvad','SDR 13.5','Plumbing','net_gst',450,'','','',18,380,100,'pc','PLB-001','39172190'],
    notes: [
      'Pricing Mode options: net_gst (price already includes GST), basic_gst (basic price, GST added on top), mrp_disc (MRP minus discount = final price, GST included), mrp_disc_gst (MRP minus discount, then GST added)',
      'Fill only the price column relevant to the chosen Pricing Mode — leave others blank',
      'Barcode column: leave blank to auto-generate a VW-XXXXXX QR code on import'
    ]
  }
};

function downloadImportTemplate(entityType) {
  const t = IMPORT_TEMPLATE_EXAMPLES[entityType];
  const rows = [t.headers, t.example];
  if (t.notes) {
    rows.push([]); // blank row
    t.notes.forEach(note => rows.push([note]));
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `${entityType === 'staff' ? 'staff' : 'products'}_import_template.xlsx`);
}
window.downloadImportTemplate = downloadImportTemplate;

// VW_EXCEL namespace — referenced from Settings Tools tab
window.VW_EXCEL = {
  showExcelImport: function() {
    // Show import type selection sheet
    const sheet = document.getElementById('bottom-sheet');
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>📊 Excel Import</h3>
      <p class="sheet-meta">Import staff or product data from an Excel or CSV file</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn-primary full-width" onclick="triggerExcelImport('staff')">👥 Import Staff / HR Data</button>
        <button class="btn-secondary full-width" onclick="triggerExcelImport('inventory')">📦 Import Products / Inventory</button>
        <button class="btn-secondary full-width" onclick="triggerExcelImport('customers')">🤝 Import Customers</button>
        <button class="btn-sm full-width" style="text-align:center" onclick="downloadImportTemplate('staff')">📥 Download Staff Template</button>
        <button class="btn-sm full-width" style="text-align:center" onclick="downloadImportTemplate('inventory')">📥 Download Inventory Template</button>
      </div>
      <button class="btn-secondary full-width" style="margin-top:12px" onclick="closeSheet()">Cancel</button>
    `;
    sheet.classList.add('open');
    document.getElementById('sheet-overlay').classList.add('open');
  }
};




/* === tasks.js === */

// STAGES and STAGE_COLORS defined in crm.js (shared)

async function renderMyTasks() {
  const profile = VW_AUTH.getCurrentProfile();
  const allTasks = await VW_DB.all(VW_DB.STORES.tasks);

  let myTasks = [];
  if (profile && profile.role === 'staff' && profile.staffId) {
    myTasks = allTasks.filter(t => t.assignedTo === profile.staffId);
  } else if (profile && profile.role === 'admin') {
    myTasks = allTasks;
  } else {
    myTasks = [];
  }

  const pending = myTasks.filter(t => t.status === 'pending');
  const active = myTasks.filter(t => ['accepted','in_progress','quoted','negotiating'].includes(t.status) || (t.stage && !['Won','Lost'].includes(t.stage) && t.status !== 'pending'));
  const done = myTasks.filter(t => t.stage === 'Won' || t.stage === 'Lost');

  // Fetch tile quotations for approval section
  const { data: allTQs } = await VW_DB.client
    .from('tile_quotations')
    .select('id,tq_no,customer_name,approval_status,status,created_by,created_at,total_area_sqft,total_boxes,grand_total,approval_log,site_address')
    .in('approval_status', ['pending_approval','approved','rejected','advance_collected','converted'])
    .order('created_at', { ascending: false })
    .limit(100);
  const tqs = allTQs || [];

  const LEVEL_LABELS = { tl:'TL / Sr Exec', floor_manager:'Floor Manager', store_manager:'Store Manager', management:'Management' };
  const statusMeta = {
    pending_approval: { label:'⏳ Pending', color:'var(--gold)', bg:'rgba(245,200,66,0.1)' },
    approved:         { label:'✅ Approved', color:'var(--green)', bg:'rgba(34,197,94,0.1)' },
    rejected:         { label:'❌ Rejected', color:'var(--red)', bg:'rgba(239,68,68,0.1)' },
    advance_collected:{ label:'💰 Advance', color:'#378ADD', bg:'rgba(55,138,221,0.1)' },
    converted:        { label:'🧾 Invoiced', color:'var(--green)', bg:'rgba(34,197,94,0.08)' },
  };

  function renderTQCard(q) {
    const sm = statusMeta[q.approval_status] || statusMeta.pending_approval;
    const log = q.approval_log || [];
    const lastStep = log[log.length-1];
    const waitingAt = lastStep?.status==='pending' ? (LEVEL_LABELS[lastStep.level]||lastStep.level) : null;
    const sqft = parseFloat(q.total_area_sqft||0).toFixed(0);
    const dt = new Date(q.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
    return `
    <div onclick="VW_TILES.openTileQuote(${q.id})" style="background:var(--bg2);border:1px solid ${sm.color}33;border-left:3px solid ${sm.color};border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:700">${q.customer_name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${q.tq_no||'Draft'} · ${dt} · by ${q.created_by||'—'}</div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:${sm.bg};color:${sm.color};white-space:nowrap">${sm.label}</span>
      </div>
      <div style="display:flex;gap:10px;font-size:11px;color:var(--text3)">
        ${sqft>0?`<span>📐 ${sqft} sqft</span>`:''}
        ${q.total_boxes?`<span>📦 ${q.total_boxes} boxes</span>`:''}
        ${q.grand_total?`<span style="color:var(--gold);font-weight:700">₹${parseInt(q.grand_total).toLocaleString('en-IN')}</span>`:''}
      </div>
      ${waitingAt?`<div style="font-size:11px;color:var(--gold);margin-top:5px;font-weight:600">⏳ Awaiting: ${waitingAt}</div>`:''}
    </div>`;
  }

  return `
  <div class="module-header">
    <h2>My Tasks</h2>
    <div class="stat-row">
      <div class="stat"><span class="stat-num" style="color:var(--gold)">${pending.length}</span><span class="stat-label">New</span></div>
      <div class="stat"><span class="stat-num">${active.length}</span><span class="stat-label">Active</span></div>
      <div class="stat"><span class="stat-num" style="color:var(--green)">${done.filter(t=>t.stage==='Won').length}</span><span class="stat-label">Won</span></div>
    </div>
  </div>

  <!-- ── TILE QUOTATION APPROVALS ── -->
  <div class="card" style="margin-bottom:12px;border-color:var(--gold-border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 class="card-title" style="margin:0">📋 Tile Quote Approvals <span style="font-size:11px;font-weight:400;color:var(--text3)">(${tqs.filter(q=>q.approval_status==='pending_approval').length} pending)</span></h3>
      <button onclick="navigateTo('tile_quotes')" style="font-size:11px;padding:4px 10px;border-radius:8px;background:var(--bg3);border:1px solid var(--border);cursor:pointer;color:var(--text2)">View All</button>
    </div>
    <!-- Filter chips -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px" id="tq-filter-chips">
      ${['all','pending_approval','approved','rejected','advance_collected','converted'].map((f,i)=>{
        const labels = {all:'All',pending_approval:'⏳ Pending',approved:'✅ Approved',rejected:'❌ Rejected',advance_collected:'💰 Advance',converted:'🧾 Invoiced'};
        return `<button onclick="filterTQTasks('${f}')" id="tqf-${f}"
          style="padding:5px 12px;border-radius:16px;font-size:11px;font-weight:700;cursor:pointer;border:${i===0?'2px solid var(--gold)':'1px solid var(--border)'};background:${i===0?'rgba(245,200,66,0.12)':'var(--bg2)'};color:${i===0?'var(--gold)':'var(--text2)'}">
          ${labels[f]}${f==='pending_approval'?` (${tqs.filter(q=>q.approval_status===f).length})`:''}
        </button>`;
      }).join('')}
    </div>
    <!-- Quote list -->
    <div id="tq-task-list">
      ${tqs.length ? tqs.map(renderTQCard).join('') : '<p class="empty-msg">No quotations yet</p>'}
    </div>
  </div>

  ${profile && profile.role === 'staff' && !profile.staffId ? `
  <div class="alert-card">
    <div class="alert-title">&#9888;&#65039; Account not linked to a team member yet</div>
    <p style="font-size:13px;color:var(--text2)">Management needs to link your account to a staff record before tasks can be routed to you.</p>
  </div>` : ''}

  ${pending.length ? `
  <div class="alert-card">
    <div class="alert-title">🔔 New Tasks Awaiting Response</div>
    ${pending.map(t => renderTaskRow(t, true)).join('')}
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">Active Tasks (${active.length})</h3>
    ${active.length ? active.map(t => renderTaskRow(t, false)).join('') : '<p class="empty-msg">No active tasks</p>'}
  </div>

  <div class="card">
    <h3 class="card-title">Completed (${done.length})</h3>
    ${done.length ? done.slice(-10).reverse().map(t => renderTaskRow(t, false)).join('') : '<p class="empty-msg">No completed tasks yet</p>'}
  </div>
  `;
}

function renderTaskRow(t, showAccept) {
  const stageColor = STAGE_COLORS[t.stage] || '#888';
  return `
  <div class="task-card" onclick="openTaskDetail(${t.id})">
    <div class="task-card-header">
      <span class="task-dept">${t.customerName || 'Customer'} · ${t.department}</span>
      <span class="task-stage" style="color:${stageColor}">${t.stage||'Lead'}</span>
    </div>
    <div class="task-desc">${t.description || 'No description'}</div>
    <div class="task-meta">${t.qty?t.qty+' · ':''}${t.budget?'₹'+Number(t.budget).toLocaleString('en-IN'):''}</div>
    ${showAccept ? `<button class="btn-primary full-width" style="margin-top:8px" onclick="event.stopPropagation();acceptTask(${t.id})">✓ Accept Task</button>` : ''}
  </div>`;
}

async function acceptTask(taskId) {
  const task = await VW_DB.getById(VW_DB.STORES.tasks, taskId);
  const log = task.escalationLog || [];
  const last = log[log.length-1];
  if (last) { last.status = 'accepted'; last.respondedAt = new Date().toISOString(); }
  task.status = 'accepted';
  await VW_DB.put(VW_DB.STORES.tasks, task);
  showToast('Task accepted', 'success');
  navigateTo('tasks');
}

async function openTaskDetail(taskId) {
  const task = await VW_DB.getById(VW_DB.STORES.tasks, taskId);
  const customer = task.customerId ? await VW_DB.getById(VW_DB.STORES.customers, task.customerId) : null;
  const visit = task.visitId ? await VW_DB.getById(VW_DB.STORES.visits, task.visitId) : null;
  const phone = customer ? VW_AUTH.maskPhone(customer.phone, visit) : '';
  const categories = await VW_CHECKIN.getCategories();
  const subcats = categories[task.department] || [];

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${task.department}${task.subcategory ? ' &middot; '+task.subcategory : ''}</h3>
    <p class="sheet-meta">${task.customerName || 'Customer'} ${phone ? '· '+phone : ''}</p>
    ${subcats.length ? `<div class="form-group"><label>Sub-category</label>
      <select id="task-subcategory">
        <option value="" ${!task.subcategory?'selected':''}>— none —</option>
        ${subcats.map(s=>`<option ${s===task.subcategory?'selected':''}>${s}</option>`).join('')}
      </select></div>` : ''}
    <div class="form-group"><label>Requirement (editable)</label><textarea id="task-desc" rows="2" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:10px;color:var(--text);font-family:inherit;font-size:14px">${task.description||''}</textarea></div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Qty / Area</label><input type="text" id="task-qty" value="${task.qty||''}"></div>
      <div class="form-group" style="flex:1"><label>Budget (₹)</label><input type="number" id="task-budget" value="${task.budget||''}"></div>
    </div>
    <div class="form-group"><label>Stage</label>
      <select id="task-stage">${STAGES.map(s=>`<option ${s===task.stage?'selected':''}>${s}</option>`).join('')}</select>
    </div>
    <div class="form-group">
      <label>Outcome / Notes</label>
      <div style="position:relative">
        <textarea id="task-outcome" rows="2" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;padding:10px;padding-right:78px;color:var(--text);font-family:inherit;font-size:14px" placeholder="e.g. Quoted ₹85/sqft, customer comparing with competitor">${task.outcome||''}</textarea>
        <button type="button" id="lang-task-outcome" class="lang-btn" onclick="cycleVoiceLang(this)" title="Voice input language">EN</button>
        <button type="button" id="mic-task-outcome" class="mic-btn" onclick="toggleVoiceInput('task-outcome', this)" title="Speak to add notes">🎤</button>
      </div>
    </div>
    <div class="form-group"><label>Follow-up Date</label><input type="date" id="task-followup" value="${task.followUpDate||''}"></div>
    ${task.status === 'pending' ? `<button class="btn-primary full-width" style="margin-bottom:8px" onclick="acceptTask(${taskId});closeSheet()">✓ Accept Task (I'll handle this)</button>` : ''}
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-primary" onclick="saveTaskDetail(${taskId})">Save</button>
      ${customer ? `<button class="btn-wa" onclick="openWhatsApp('${customer.phone}','${customer.name}')">💬 WhatsApp</button><button class="btn-call" onclick="callPhone('${customer.phone}')">📞 Call</button>` : ''}
    </div>
    ${VW_AUTH.isAdmin() ? `<button class="btn-secondary full-width" style="margin-top:8px;color:var(--red)" onclick="confirmDeleteTask(${taskId})">🗑 Delete Task</button>` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveTaskDetail(taskId) {
  const task = await VW_DB.getById(VW_DB.STORES.tasks, taskId);
  const subcatEl = document.getElementById('task-subcategory');
  if (subcatEl) task.subcategory = subcatEl.value || null;
  task.description = document.getElementById('task-desc').value;
  task.qty = document.getElementById('task-qty').value;
  task.budget = document.getElementById('task-budget').value;
  task.stage = document.getElementById('task-stage').value;
  task.outcome = document.getElementById('task-outcome').value;
  task.followUpDate = document.getElementById('task-followup').value;
  if (['Won','Lost'].includes(task.stage)) task.status = 'completed';
  else if (task.status === 'pending') task.status = 'accepted';
  task.updatedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.tasks, task);

  // sync linked lead
  const leads = await VW_DB.all(VW_DB.STORES.leads);
  const lead = leads.find(l => l.taskId === taskId);
  if (lead) {
    lead.stage = task.stage;
    lead.value = task.budget;
    lead.notes = task.description;
    lead.followUpDate = task.followUpDate;
    await VW_DB.put(VW_DB.STORES.leads, lead);
  }

  showToast('Task updated', 'success');
  closeSheet();
  navigateTo(currentPage === 'tasks' ? 'tasks' : currentPage);
}

async function confirmDeleteTask(taskId) {
  if (!confirm('Delete this task permanently? This cannot be undone.')) return;
  await VW_DB.del(VW_DB.STORES.tasks, taskId);
  showToast('Task deleted', 'info');
  closeSheet();
  navigateTo(currentPage === 'tasks' ? 'tasks' : currentPage);
}
window.confirmDeleteTask = confirmDeleteTask;

// Live filter for TQ approval cards in Tasks page
async function filterTQTasks(status) {
  // Update chip styles
  ['all','pending_approval','approved','rejected','advance_collected','converted'].forEach(f => {
    const btn = document.getElementById('tqf-'+f);
    if (!btn) return;
    const active = f === status;
    btn.style.border = active ? '2px solid var(--gold)' : '1px solid var(--border)';
    btn.style.background = active ? 'rgba(245,200,66,0.12)' : 'var(--bg2)';
    btn.style.color = active ? 'var(--gold)' : 'var(--text2)';
  });

  const el = document.getElementById('tq-task-list');
  if (!el) return;
  el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px">Loading…</div>';

  const statuses = status === 'all'
    ? ['pending_approval','approved','rejected','advance_collected','converted']
    : [status];

  const { data } = await VW_DB.client
    .from('tile_quotations')
    .select('id,tq_no,customer_name,approval_status,created_by,created_at,total_area_sqft,total_boxes,grand_total,approval_log')
    .in('approval_status', statuses)
    .order('created_at', { ascending: false })
    .limit(100);

  const tqs = data || [];
  if (!tqs.length) { el.innerHTML = '<p class="empty-msg">No quotes in this category</p>'; return; }

  const LEVEL_LABELS = { tl:'TL / Sr Exec', floor_manager:'Floor Manager', store_manager:'Store Manager', management:'Management' };
  const statusMeta = {
    pending_approval: { label:'⏳ Pending', color:'var(--gold)', bg:'rgba(245,200,66,0.1)' },
    approved:         { label:'✅ Approved', color:'var(--green)', bg:'rgba(34,197,94,0.1)' },
    rejected:         { label:'❌ Rejected', color:'var(--red)', bg:'rgba(239,68,68,0.1)' },
    advance_collected:{ label:'💰 Advance', color:'#378ADD', bg:'rgba(55,138,221,0.1)' },
    converted:        { label:'🧾 Invoiced', color:'var(--green)', bg:'rgba(34,197,94,0.08)' },
  };

  el.innerHTML = tqs.map(q => {
    const sm = statusMeta[q.approval_status] || statusMeta.pending_approval;
    const log = q.approval_log || [];
    const lastStep = log[log.length-1];
    const waitingAt = lastStep?.status==='pending' ? (LEVEL_LABELS[lastStep.level]||lastStep.level) : null;
    const sqft = parseFloat(q.total_area_sqft||0).toFixed(0);
    const dt = new Date(q.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
    return `
    <div onclick="VW_TILES.openTileQuote(${q.id})" style="background:var(--bg2);border:1px solid ${sm.color}33;border-left:3px solid ${sm.color};border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:700">${q.customer_name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${q.tq_no||'Draft'} · ${dt} · by ${q.created_by||'—'}</div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:${sm.bg};color:${sm.color};white-space:nowrap">${sm.label}</span>
      </div>
      <div style="display:flex;gap:10px;font-size:11px;color:var(--text3)">
        ${sqft>0?`<span>📐 ${sqft} sqft</span>`:''}
        ${q.total_boxes?`<span>📦 ${q.total_boxes} boxes</span>`:''}
        ${q.grand_total?`<span style="color:var(--gold);font-weight:700">₹${parseInt(q.grand_total).toLocaleString('en-IN')}</span>`:''}
      </div>
      ${waitingAt?`<div style="font-size:11px;color:var(--gold);margin-top:5px;font-weight:600">⏳ Awaiting: ${waitingAt}</div>`:''}
    </div>`;
  }).join('');
}
window.filterTQTasks = filterTQTasks;

window.VW_TASKS = { renderMyTasks, acceptTask, openTaskDetail, saveTaskDetail };
window.acceptTask = acceptTask;
window.openTaskDetail = openTaskDetail;
window.saveTaskDetail = saveTaskDetail;





// ═══════════════════════════════════════════════════════════════
// LABOR SETTINGS TAB
// ═══════════════════════════════════════════════════════════════
async function renderLaborSettings() {
  const cfg = await VW_DB.getSetting('labor_config', {
    commission_floor: 20,
    commission_wall: 25,
    commission_both: 22,
    commission_type: 'percent',
    stage_deduction_grouting: 5,
    stage_deduction_cleaning: 2,
    site_deposit_default: 20,
    site_deposit_min: 10,
    site_deposit_max: 20,
    min_contractor_score: 40,
    wallet_min_topup: 500,
  });

  return `
  <div style="font-size:12px;font-weight:700;margin-bottom:12px;color:var(--text2)">🏗 Labor Commission & Payment Settings</div>

  <!-- COMMISSION -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">💰 Commission Structure</h3>
    <div class="form-group">
      <label>Commission Type</label>
      <select id="ls-comm-type" style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
        <option value="percent" ${cfg.commission_type==='percent'?'selected':''}>% of total job value</option>
        <option value="per_sqft" ${cfg.commission_type==='per_sqft'?'selected':''}>Fixed ₹ per sqft</option>
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div class="form-group" style="margin:0">
        <label>Floor Only</label>
        <input type="number" id="ls-comm-floor" value="${cfg.commission_floor}" step="0.5" min="0">
      </div>
      <div class="form-group" style="margin:0">
        <label>Wall Only</label>
        <input type="number" id="ls-comm-wall" value="${cfg.commission_wall}" step="0.5" min="0">
      </div>
      <div class="form-group" style="margin:0">
        <label>Floor + Wall</label>
        <input type="number" id="ls-comm-both" value="${cfg.commission_both}" step="0.5" min="0">
      </div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:4px">TDS deducted separately at 1% from contractor payment.</div>
  </div>

  <!-- STAGE DEDUCTIONS -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📉 Stage-wise Deductions (₹/sqft withheld)</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:10px">Amount held back per sqft when work is incomplete. Released when that stage is done.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group" style="margin:0">
        <label>Grouting Pending (₹/sqft)</label>
        <input type="number" id="ls-ded-grout" value="${cfg.stage_deduction_grouting}" step="0.5" min="0" placeholder="e.g. 5">
      </div>
      <div class="form-group" style="margin:0">
        <label>Cleaning Pending (₹/sqft)</label>
        <input type="number" id="ls-ded-clean" value="${cfg.stage_deduction_cleaning}" step="0.5" min="0" placeholder="e.g. 2">
      </div>
    </div>
  </div>

  <!-- SITE DEPOSIT -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🔒 Site Deposit Rules</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div class="form-group" style="margin:0">
        <label>Default %</label>
        <input type="number" id="ls-dep-default" value="${cfg.site_deposit_default}" min="10" max="20" step="1">
      </div>
      <div class="form-group" style="margin:0">
        <label>Minimum %</label>
        <input type="number" id="ls-dep-min" value="${cfg.site_deposit_min}" min="5" max="15" step="1">
      </div>
      <div class="form-group" style="margin:0">
        <label>Maximum %</label>
        <input type="number" id="ls-dep-max" value="${cfg.site_deposit_max}" min="15" max="30" step="1">
      </div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:4px">Executives can negotiate within min-max range. Refunded on clean handover.</div>
  </div>

  <!-- OTHER -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">⚙️ Other Settings</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group" style="margin:0">
        <label>Min Contractor Score</label>
        <input type="number" id="ls-min-score" value="${cfg.min_contractor_score}" min="0" max="100" step="5">
      </div>
      <div class="form-group" style="margin:0">
        <label>Min Wallet Top-up (₹)</label>
        <input type="number" id="ls-wallet-topup" value="${cfg.wallet_min_topup}" min="100" step="100">
      </div>
    </div>
  </div>

  <button onclick="saveLaborSettings()"
    style="width:100%;padding:13px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    💾 Save Labor Settings
  </button>`;
}

async function saveLaborSettings() {
  const cfg = {
    commission_type:          document.getElementById('ls-comm-type')?.value || 'percent',
    commission_floor:         parseFloat(document.getElementById('ls-comm-floor')?.value) || 20,
    commission_wall:          parseFloat(document.getElementById('ls-comm-wall')?.value) || 25,
    commission_both:          parseFloat(document.getElementById('ls-comm-both')?.value) || 22,
    stage_deduction_grouting: parseFloat(document.getElementById('ls-ded-grout')?.value) || 5,
    stage_deduction_cleaning: parseFloat(document.getElementById('ls-ded-clean')?.value) || 2,
    site_deposit_default:     parseFloat(document.getElementById('ls-dep-default')?.value) || 20,
    site_deposit_min:         parseFloat(document.getElementById('ls-dep-min')?.value) || 10,
    site_deposit_max:         parseFloat(document.getElementById('ls-dep-max')?.value) || 20,
    min_contractor_score:     parseFloat(document.getElementById('ls-min-score')?.value) || 40,
    wallet_min_topup:         parseFloat(document.getElementById('ls-wallet-topup')?.value) || 500,
  };
  await VW_DB.setSetting('labor_config', cfg);
  showToast('Labor settings saved ✅', 'success');
}
window.saveLaborSettings = saveLaborSettings;

// ═══════════════════════════════════════════════════════════════
// PROMO CODE ADMIN
// ═══════════════════════════════════════════════════════════════
async function renderPromoSettings() {
  const { data: codes } = await VW_DB.client
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false });

  return `
  <div style="font-size:12px;font-weight:700;margin-bottom:12px;color:var(--text2)">🎟 Promo Code Management</div>

  <!-- ADD NEW CODE -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">+ Create New Promo Code</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group" style="margin:0">
        <label>Code *</label>
        <input type="text" id="pc-code" placeholder="e.g. SUMMER20" style="text-transform:uppercase"
          oninput="this.value=this.value.toUpperCase()">
      </div>
      <div class="form-group" style="margin:0">
        <label>Description</label>
        <input type="text" id="pc-desc" placeholder="e.g. Summer sale 20% off">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
      <div class="form-group" style="margin:0">
        <label>Type</label>
        <select id="pc-type">
          <option value="percent">% Discount</option>
          <option value="flat">Flat ₹ Off</option>
        </select>
      </div>
      <div class="form-group" style="margin:0">
        <label>Value</label>
        <input type="number" id="pc-value" placeholder="e.g. 10 or 200" min="1">
      </div>
      <div class="form-group" style="margin:0">
        <label>Max Discount (₹)</label>
        <input type="number" id="pc-max" placeholder="Leave blank = unlimited">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
      <div class="form-group" style="margin:0">
        <label>Min Order (₹)</label>
        <input type="number" id="pc-min" placeholder="0 = no minimum" value="0">
      </div>
      <div class="form-group" style="margin:0">
        <label>Usage Limit</label>
        <input type="number" id="pc-limit" placeholder="Leave blank = unlimited">
      </div>
      <div class="form-group" style="margin:0">
        <label>Valid Until</label>
        <input type="date" id="pc-expiry">
      </div>
    </div>
    <button onclick="savePromoCode()"
      style="width:100%;margin-top:10px;padding:10px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer">
      + Create Code
    </button>
  </div>

  <!-- EXISTING CODES -->
  <div style="font-size:12px;font-weight:700;margin-bottom:8px">Active Codes (${codes?.filter(c=>c.is_active).length||0})</div>
  ${!(codes?.length) ? '<p class="empty-msg">No promo codes yet</p>' :
  codes.map(c => `
  <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px;border:1px solid ${c.is_active?'var(--border)':'var(--border2)'}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:14px;font-weight:900;font-family:monospace;color:${c.is_active?'var(--gold)':'var(--text3)'}">${c.code}</span>
        <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:${c.is_active?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.08)'};color:${c.is_active?'var(--green)':'var(--red)'}">${c.is_active?'Active':'Inactive'}</span>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="togglePromoCode(${c.id},${c.is_active})"
          style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);font-size:11px;cursor:pointer">
          ${c.is_active?'Disable':'Enable'}
        </button>
        <button onclick="deletePromoCode(${c.id})"
          style="padding:4px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:var(--red);font-size:11px;cursor:pointer">
          Delete
        </button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text2)">${c.description||'—'}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:3px">
      ${c.discount_type==='percent'?c.discount_value+'% off':' ₹'+c.discount_value+' off'}
      ${c.max_discount_amount?' · Max ₹'+c.max_discount_amount:''}
      ${c.min_order_value?' · Min order ₹'+c.min_order_value:''}
      · Used ${c.used_count||0}/${c.usage_limit||'∞'}
      ${c.valid_until?' · Expires '+new Date(c.valid_until).toLocaleDateString('en-IN'):''}
    </div>
  </div>`).join('')}`;
}

async function savePromoCode() {
  const code  = document.getElementById('pc-code')?.value?.trim().toUpperCase();
  const desc  = document.getElementById('pc-desc')?.value?.trim();
  const type  = document.getElementById('pc-type')?.value;
  const value = parseFloat(document.getElementById('pc-value')?.value);
  const max   = parseFloat(document.getElementById('pc-max')?.value) || null;
  const min   = parseFloat(document.getElementById('pc-min')?.value) || 0;
  const limit = parseInt(document.getElementById('pc-limit')?.value) || null;
  const expiry= document.getElementById('pc-expiry')?.value;

  if (!code || !value) { showToast('Code and value are required', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();
  const { error } = await VW_DB.client.from('promo_codes').insert({
    code, description: desc || null, discount_type: type, discount_value: value,
    max_discount_amount: max, min_order_value: min, usage_limit: limit,
    valid_until: expiry ? new Date(expiry).toISOString() : null,
    is_active: true, created_by: prof?.id,
  });

  if (error) { showToast(error.message.includes('unique') ? 'Code already exists' : error.message, 'error'); return; }
  showToast(`Code ${code} created ✅`, 'success');
  VW_SETTINGS.switchSettingsTab('promos', document.getElementById('stab-promos'));
}

async function togglePromoCode(id, currentActive) {
  await VW_DB.client.from('promo_codes').update({ is_active: !currentActive }).eq('id', id);
  showToast(currentActive ? 'Code disabled' : 'Code enabled', 'success');
  VW_SETTINGS.switchSettingsTab('promos', document.getElementById('stab-promos'));
}

async function deletePromoCode(id) {
  if (!confirm('Delete this promo code?')) return;
  await VW_DB.client.from('promo_codes').delete().eq('id', id);
  showToast('Code deleted', 'info');
  VW_SETTINGS.switchSettingsTab('promos', document.getElementById('stab-promos'));
}

window.savePromoCode = savePromoCode;
window.togglePromoCode = togglePromoCode;
window.deletePromoCode = deletePromoCode;
window.deleteBillingPromoCode = deleteBillingPromoCode;

// ═══════════════════════════════════════════════════════════════
// CUSTOMER BROADCAST — Send push to all/segment customers
// ═══════════════════════════════════════════════════════════════
async function renderBroadcastPage() {
  // Count push subscribers
  const { count: pushCount } = await VW_DB.client
    .from('push_subscriptions')
    .select('id', { count:'exact', head:true });

  return `
  <div class="module-header"><h2>📢 Customer Broadcast</h2></div>

  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:6px">Push Notification Reach</div>
    <div style="font-size:28px;font-weight:900;color:var(--gold)">${pushCount||0}</div>
    <div style="font-size:11px;color:var(--text3)">customers with notifications enabled</div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">📤 Send Push Notification</h3>
    <div class="form-group">
      <label>Title *</label>
      <input type="text" id="bc-title" placeholder="e.g. 🎉 Weekend Sale — 15% off all tiles!">
    </div>
    <div class="form-group">
      <label>Message *</label>
      <textarea id="bc-body" rows="3" placeholder="e.g. Shop now at V Wholesale and save big this weekend. Offer valid till Sunday!"
        style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px;resize:vertical;box-sizing:border-box"></textarea>
    </div>
    <div class="form-group">
      <label>Target</label>
      <select id="bc-target">
        <option value="all">All customers (${pushCount||0})</option>
        <option value="customers">Customers only</option>
        <option value="contractors">Contractors only</option>
      </select>
    </div>
    <div id="bc-preview" style="background:var(--bg3);border-radius:10px;padding:10px;margin-bottom:10px;font-size:11px;color:var(--text3)">
      Preview will appear here as you type...
    </div>
    <button onclick="sendBroadcast()" style="width:100%;padding:12px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
      📤 Send to ${pushCount||0} customers
    </button>
  </div>

  <div id="bc-result"></div>`;
}

async function sendBroadcast() {
  const title  = document.getElementById('bc-title')?.value?.trim();
  const body   = document.getElementById('bc-body')?.value?.trim();
  const target = document.getElementById('bc-target')?.value;

  if (!title || !body) { showToast('Title and message required', 'warn'); return; }

  const btn = document.querySelector('[onclick="sendBroadcast()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    // Get all push subscriptions for target
    let query = VW_DB.client.from('push_subscriptions').select('profile_id');
    const { data: subs } = await query;

    if (!subs?.length) { showToast('No subscribers found', 'warn'); if (btn) { btn.disabled=false; btn.textContent='Send'; } return; }

    let sent = 0;
    const unique = [...new Set(subs.map(s => s.profile_id))];

    for (const profileId of unique) {
      try {
        await sendWebPush(profileId, title, body, 'https://hmehtavw.github.io/vwholesale-app/');
        sent++;
      } catch(e) {}
    }

    const resultEl = document.getElementById('bc-result');
    if (resultEl) resultEl.innerHTML = `
      <div style="background:rgba(34,197,94,0.08);border:1px solid var(--green);border-radius:10px;padding:12px">
        <div style="font-size:14px;font-weight:700;color:var(--green)">✅ Broadcast sent</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">Delivered to ${sent} of ${unique.length} subscribers</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${new Date().toLocaleString('en-IN')}</div>
      </div>`;
    showToast(`Broadcast sent to ${sent} customers`, 'success');
  } catch(e) {
    showToast('Broadcast failed: ' + e.message, 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
}

window.renderBroadcastPage = renderBroadcastPage;
window.sendBroadcast = sendBroadcast;
