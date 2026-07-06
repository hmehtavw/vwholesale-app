// Load price history from recent approved/pending quotes
// Builds: window._qqPriceHistory[productId] = { pricePerBox, tqNo, date }
async function _qqLoadPriceHistory() {
  const { data } = await VW_DB.client
    .from('tile_quotations')
    .select('tq_no, tile_selections, quoted_prices, created_at')
    .in('approval_status', ['approved', 'pending_approval'])
    .order('created_at', { ascending: false })
    .limit(50);

  const history = {};
  (data||[]).forEach(q => {
    const tqNo = q.tq_no;
    const dateStr = new Date(q.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    Object.entries(q.tile_selections||{}).forEach(([slotId, sel]) => {
      const pid = sel?.productId;
      if (!pid) return;
      const qp = (q.quoted_prices||{})[slotId];
      const priceBox = qp?.pricePerBox || 0;
      if (!priceBox) return;
      // Keep most recent approved price per product
      if (!history[pid]) {
        history[pid] = { pricePerBox: priceBox, tqNo, date: dateStr };
      }
    });
  });
  window._qqPriceHistory = history;
}

async function openQuickQuote() {
  // Clean up any stale price keys from previous QQ sessions
  Object.keys(window).filter(k => k.startsWith('qqprice_')).forEach(k => { try { delete window[k]; } catch(e){} });
  // Load price history in background — ready by the time user reaches Output screen
  window._qqPriceHistory = {};
  _qqLoadPriceHistory().catch(() => {});
  window._qqData = {
    customer: { name:'', phone:'', site:'', _found:null },
    rooms: [],    // each room stores floorDesign + wallDesign after measurement
    adding: null, // room form being filled
    designing: null, // { roomIdx, surface, step, size, pendingCodes, currentCodeIdx, assignSearch }
  };
  if (!_tqSizeCfg?.sizes?.length) {
    try { _tqSizeCfg = await VW_DB.getSetting('tile_weight_config', { sizes:[] }); } catch(e) {}
  }
  _qqScreen('customer');
}

function _qqSheet(inner, title) {
  const sh = document.getElementById('bottom-sheet');
  sh.innerHTML = `<div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px">
      <h3 style="margin:0;font-size:15px">⚡ ${title}</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div style="max-height:76vh;overflow-y:auto;padding-right:2px">${inner}</div>`;
  sh.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function _qqEsc(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// ── SCREEN: Customer ──────────────────────────────────────────────
function _qqScreen(screen) {
  if (screen==='customer') {
    const d = _qqData.customer;
    const foundHtml = d._found ? `
      <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--green)">✓ ${_qqEsc(d.name)}</div>
            <div style="font-size:11px;color:var(--text3)">${_qqEsc(d.phone)}${d.site?' · '+_qqEsc(d.site):''}</div>
          </div>
          <button onclick="VW_TILES._qqClearCustomer()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px">✕</button>
        </div>
      </div>` :
      d._found===false ? `<div style="font-size:12px;color:var(--text3);padding:4px 0 8px">New customer — enter name below</div>` :
      d.phone?.length ? `<div style="font-size:12px;color:var(--text3);padding:4px 0 8px">${10-(d.phone?.length||0)} more digits…</div>` : '';

    const showNameField = !d._found; // show name input when not found or new
    _qqSheet(`
      <div class="form-group">
        <label>Phone Number *</label>
        <div style="display:flex;gap:6px">
          <input type="tel" id="qq-phone" value="${_qqEsc(d.phone||'')}"
            placeholder="10-digit mobile" maxlength="10" inputmode="numeric"
            style="flex:1;font-size:15px;font-weight:700;letter-spacing:0.05em"
            oninput="VW_TILES._qqPhoneInput(this.value)">
          <button onclick="VW_TILES._qqSearchPhone()" style="padding:0 14px;background:var(--gold);color:#000;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;flex-shrink:0">🔍</button>
        </div>
      </div>
      <div id="qq-cust-result">${foundHtml}</div>
      ${showNameField ? `
      <div class="form-group"><label>${d._found===false?'Customer Name *':'Name (if phone not found)'}</label>
        <input type="text" id="qq-name" value="${_qqEsc(d.name||'')}" placeholder="e.g. Ravi Kumar" autocomplete="name">
      </div>
      <div class="form-group"><label>Site Address <span style="color:var(--text3);font-size:10px">(optional)</span></label>
        <input type="text" id="qq-site" value="${_qqEsc(d.site||'')}" placeholder="e.g. Benz Circle, Plot 12">
      </div>` : ''}
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:10px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">🏗 Contractor</div>
        <div style="font-size:12px;color:var(--text2)">Skipped in Quick Quote — can be added after via Edit in Full Wizard</div>
      </div>
      <button class="btn-primary full-width" onclick="VW_TILES._qqFromCustomer()">Next → Add Rooms</button>
    `, 'Quick Quote — Step 1: Customer');
    setTimeout(()=>{ const p=document.getElementById('qq-phone'); if(!d._found&&p) p.focus(); },80);
  }
  else if (screen==='rooms')         _qqShowRooms();
  else if (screen==='design_size')   _qqShowDesignSize();
  else if (screen==='design_pattern') _qqShowDesignPattern();
  else if (screen==='design_assign') _qqShowTileAssign();
  else if (screen==='output')        _qqShowOutput();
}

async function _qqPhoneInput(val) {
  const digits = val.replace(/\D/g,'');
  _qqData.customer.phone = digits;
  _qqData.customer._found = null;
  _qqData.customer.name = '';
  _qqData.customer.id = null;
  if (digits.length === 10) await _qqSearchPhone();
  else {
    const el=document.getElementById('qq-cust-result');
    if(el) el.innerHTML=digits.length?`<div style="font-size:12px;color:var(--text3);padding:4px 0">${10-digits.length} more digits…</div>`:'';
  }
}

async function _qqSearchPhone() {
  const digits = (document.getElementById('qq-phone')?.value||_qqData.customer.phone||'').replace(/\D/g,'');
  if (digits.length < 10) { showToast('Enter 10-digit number','warn'); return; }
  const el = document.getElementById('qq-cust-result');
  if (el) el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">🔍 Searching…</div>';
  try {
    // 1. Search customers table first
    const { data: custData } = await VW_DB.client.from('customers').select('id,name,phone,address').eq('phone',digits).limit(1);
    const found = custData?.[0];
    if (found) {
      _qqData.customer = { ...found, phone:digits, site:found.address||'', _found:true };
      _qqScreen('customer');
      return;
    }

    // 2. Fallback: search previous tile_quotations for this phone number
    const { data: tqData } = await VW_DB.client.from('tile_quotations')
      .select('customer_name,customer_phone,site_address,customer_id')
      .eq('customer_phone', digits)
      .not('customer_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const prevTQ = tqData?.[0];
    if (prevTQ?.customer_name) {
      _qqData.customer = {
        name: prevTQ.customer_name,
        phone: digits,
        site: prevTQ.site_address || '',
        id: prevTQ.customer_id || null,
        _found: true,
      };
      // Ensure this customer gets a proper record in customers table
      _qqEnsureCustomer().catch(() => {});
    } else {
      _qqData.customer = { ..._qqData.customer, phone:digits, _found:false };
    }
    _qqScreen('customer');
  } catch(e) {
    if (el) el.innerHTML = '<div style="font-size:12px;color:var(--red)">Search failed — enter name manually</div>';
  }
}

function _qqClearCustomer() {
  _qqData.customer = { name:'', phone:'', site:'', id:null, _found:null };
  _qqScreen('customer');
}

// ── Ensure QQ customer exists in customers table and has an ID ────────────────
// Called after customer confirm — creates customer if not already in CRM
async function _qqEnsureCustomer() {
  const c = _qqData.customer;
  if (!c.phone || !c.name) return;
  if (c.id) return; // already linked to a customer record
  try {
    // Double-check customers table (search may have missed due to timing)
    const { data: existing } = await VW_DB.client.from('customers')
      .select('id,name,phone,address').eq('phone', c.phone).limit(1).maybeSingle();
    if (existing?.id) {
      _qqData.customer.id = existing.id;
      return;
    }
    // Create new customer record
    const { data: newCust, error } = await VW_DB.client.from('customers').insert({
      name: c.name,
      phone: c.phone,
      address: c.site || '',
      source: 'quick_quote',
      type: 'retail',
    }).select('id').single();
    if (!error && newCust?.id) {
      _qqData.customer.id = newCust.id;
    }
  } catch(e) { /* silent — customer linking is non-critical */ }
}

async function _qqFromCustomer() {
  const d = _qqData.customer;
  // Phone must be entered first
  const phone = (document.getElementById('qq-phone')?.value || '').replace(/\D/g,'');
  if (!phone || phone.length < 10) {
    showToast('Enter a 10-digit phone number first', 'warn');
    document.getElementById('qq-phone')?.focus();
    return;
  }
  // If not found from DB — need name
  if (!d._found) {
    const name = document.getElementById('qq-name')?.value.trim();
    const site = document.getElementById('qq-site')?.value.trim();
    if (!name) { showToast('Enter customer name', 'warn'); return; }
    _qqData.customer.name = name;
    _qqData.customer.site = site || '';
  }
  _qqData.customer.phone = phone;
  // Ensure customer is saved to Supabase BEFORE moving to rooms
  // so they're immediately findable if a second QQ starts right after
  await _qqEnsureCustomer().catch(() => {});
  _qqScreen('rooms');
  _qqAutoSave().catch(() => {});
}

// ── SCREEN: Rooms ─────────────────────────────────────────────────
function _qqShowRooms() {
  const rooms = _qqData.rooms;

  const roomChips = rooms.map((r,i) => {
    const def = _QQ_ROOMS.find(t=>t.type===r.type)||{icon:'🏠'};
    const sq = _qqSqft(r);
    const hasFloorDesign = r.floorDesign?.pattern?.length > 0 && Object.keys(r.floorDesign.tileMap||{}).length === new Set(r.floorDesign.pattern).size;
    const hasWallDesign  = r.wallDesign?.pattern?.length > 0  && Object.keys(r.wallDesign.tileMap||{}).length  === new Set(r.wallDesign.pattern).size;
    const needsFloor = r.surface==='floor'||r.surface==='both';
    const needsWall  = r.surface==='wall'||r.surface==='both';
    const allDone = (!needsFloor || hasFloorDesign) && (!needsWall || hasWallDesign);

    return `
    <div style="background:var(--bg2);border-radius:12px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:14px;font-weight:700">${def.icon} ${r.type} <span style="font-size:11px;font-weight:400;color:var(--text3)">${sq.toFixed(0)} sqft</span></div>
        <div style="display:flex;gap:4px">
          <button onclick="VW_TILES._qqEditRoom(${i})" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text2);cursor:pointer;font-size:11px;padding:2px 8px">✎ Edit</button>
          <button onclick="VW_TILES._qqRm(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">✕</button>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${needsFloor ? `<button onclick="VW_TILES._qqDesignTile(${i},'floor')"
          style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:${hasFloorDesign?'1px solid var(--green)':'1px solid var(--gold-border)'};background:${hasFloorDesign?'rgba(34,197,94,0.1)':'rgba(245,200,66,0.08)'};color:${hasFloorDesign?'var(--green)':'var(--gold)'}">
          ${hasFloorDesign?'✓ Floor: '+r.floorDesign.size+' '+r.floorDesign.patternStr:'+ Design Floor Tile'}
        </button>` : ''}
        ${needsWall ? `<button onclick="VW_TILES._qqDesignTile(${i},'wall')"
          style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:${hasWallDesign?'1px solid var(--green)':'1px solid var(--gold-border)'};background:${hasWallDesign?'rgba(34,197,94,0.1)':'rgba(245,200,66,0.08)'};color:${hasWallDesign?'var(--green)':'var(--gold)'}">
          ${hasWallDesign?'✓ Wall: '+r.wallDesign.size+' '+r.wallDesign.patternStr:'+ Design Wall Tile'}
        </button>` : ''}
      </div>
    </div>`;
  }).join('');

  const allRoomsDone = rooms.length > 0 && rooms.every(r => {
    const hasFloorDesign = !( r.surface==='floor'||r.surface==='both') || (r.floorDesign?.pattern?.length>0 && Object.keys(r.floorDesign.tileMap||{}).length===new Set(r.floorDesign.pattern).size);
    const hasWallDesign  = !( r.surface==='wall' ||r.surface==='both') || (r.wallDesign?.pattern?.length>0  && Object.keys(r.wallDesign.tileMap||{}).length===new Set(r.wallDesign.pattern).size);
    return hasFloorDesign && hasWallDesign;
  });

  const addForm = _qqData.adding ? _qqAddForm() : `
    <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Add a Room</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      ${_QQ_ROOMS.map(rt=>`<button onclick="VW_TILES._qqPick('${rt.type}')" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 10px;border:1px solid var(--border);border-radius:12px;background:var(--bg2);cursor:pointer;min-width:60px;text-align:center">
        <span style="font-size:20px">${rt.icon}</span>
        <span style="font-size:10px;font-weight:700;color:var(--text2)">${rt.type.replace(' Room','').replace(' / Passage','').replace(' Hall','')}</span>
      </button>`).join('')}
    </div>`;

  _qqSheet(`
    ${rooms.length?`<div style="margin-bottom:4px">${roomChips}</div>`:''}
    ${addForm}
    ${allRoomsDone ? `
    <button class="btn-primary full-width" style="margin-top:8px;background:var(--gold);color:#000" onclick="VW_TILES._qqScreen('output')">
      📊 View Calculation & Quote
    </button>` : rooms.length && !_qqData.adding ? `
    <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:8px">
      Add tile designs for each room to generate output
    </div>` : ''}
  `, `Quick Quote — Step 2: Rooms (${rooms.length} added)`);
}

function _qqPick(type) {
  const def = _QQ_ROOMS.find(t=>t.type===type)||{icon:'🏠',def:'floor',mode:'lw',skirting:false};
  _qqData.adding = { type, surface:def.def, mode:def.mode, skirting:def.skirting, skirtingIn:3,
    l:'', w:'', sqft:'', wl:'', wh:'7', hasDoor:true, dw:'2.5', dh:'6.5', fl:'', fw:'' };
  _qqShowRooms();
}

function _qqAddForm() {
  const r = _qqData.adding;
  const def = _QQ_ROOMS.find(t=>t.type===r.type)||{icon:'🏠'};
  const isFloor = r.surface==='floor'||r.surface==='both';
  const isWall  = r.surface==='wall'||r.surface==='both';
  const noDoor  = r.type==='Kitchen';

  const surfBtn = (s,lbl) => `<button onclick="VW_TILES._qqSet('surface','${s}')" style="flex:1;padding:7px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:${r.surface===s?'2px solid var(--gold)':'1px solid var(--border)'};background:${r.surface===s?'var(--gold-muted)':'var(--bg3)'};color:${r.surface===s?'var(--gold)':'var(--text2)'}">${lbl}</button>`;
  const modeBtn = (m,lbl) => `<button onclick="VW_TILES._qqSet('mode','${m}')" style="flex:1;padding:6px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;border:${r.mode===m?'2px solid var(--gold)':'1px solid var(--border)'};background:${r.mode===m?'var(--gold-muted)':'var(--bg3)'};color:${r.mode===m?'var(--gold)':'var(--text2)'}">${lbl}</button>`;
  const skBtn  = (v,lbl) => `<button onclick="VW_TILES._qqSet('skirtingIn',${v})" style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;border:${r.skirtingIn==v?'2px solid var(--gold)':'1px solid var(--border)'};background:${r.skirtingIn==v?'var(--gold-muted)':'var(--bg3)'};color:${r.skirtingIn==v?'var(--gold)':'var(--text)'}">${lbl}</button>`;

  const liveFloor = r.mode==='lw'&&parseFloat(r.l)&&parseFloat(r.w) ? `<div style="font-size:12px;font-weight:700;color:var(--gold);margin:4px 0">${(parseFloat(r.l)*parseFloat(r.w)).toFixed(1)} sqft floor</div>` : '';
  const liveWall  = parseFloat(r.wl)&&parseFloat(r.wh) ? `<div style="font-size:12px;font-weight:700;color:var(--gold);margin:4px 0">${Math.max(0,parseFloat(r.wl)*parseFloat(r.wh)-(r.hasDoor&&!noDoor?parseFloat(r.dw||0)*parseFloat(r.dh||0):0)).toFixed(1)} sqft wall</div>` : '';

  return `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:14px;font-weight:700">${def.icon} ${r.type}</div>
      <button onclick="VW_TILES._qqCancelAdd()" style="background:none;border:none;color:var(--text3);cursor:pointer">✕</button>
    </div>

    <!-- Surface -->
    <div style="display:flex;gap:6px;margin-bottom:12px">
      ${surfBtn('floor','🔲 Floor only')}${surfBtn('both','Floor + Wall')}${surfBtn('wall','🧱 Wall only')}
    </div>

    ${isFloor?`
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Floor Measurement</div>
    <div style="display:flex;gap:6px;margin-bottom:8px">${modeBtn('lw','L × W (ft)')}${modeBtn('sqft','Direct sqft')}</div>
    ${r.mode==='lw'?`
      <div class="form-row">
        <div class="form-group" style="margin:0;flex:1"><label>Length (ft)</label><input type="number" id="qq-l" value="${r.l}" placeholder="e.g. 20" inputmode="decimal" step="0.5" oninput="VW_TILES._qqSetV('l',this.value)"></div>
        <div class="form-group" style="margin:0;flex:1"><label>Width (ft)</label><input type="number" id="qq-w" value="${r.w}" placeholder="e.g. 15" inputmode="decimal" step="0.5" oninput="VW_TILES._qqSetV('w',this.value)"></div>
      </div>${liveFloor}
      <div style="display:flex;gap:6px;align-items:center;margin-top:8px">
        <span style="font-size:11px;color:var(--text3)">Skirting:</span>
        ${skBtn(3,'3"')}${skBtn(4,'4"')}${skBtn(0,'No')}
      </div>` :
    `<div class="form-group"><label>Floor Area (sqft)</label><input type="number" id="qq-sqft" value="${r.sqft}" placeholder="e.g. 250" inputmode="decimal" step="0.5" oninput="VW_TILES._qqSetV('sqft',this.value)"></div>`}
    `:''}

    ${isWall?`
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin:${isFloor?'12px':0} 0 6px">Wall Measurement</div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:2"><label>Total Wall Length (ft) <span style="font-weight:400;color:var(--text3)">all 4 sides added</span></label>
        <input type="number" id="qq-wl" value="${r.wl}" placeholder="e.g. 28" inputmode="decimal" step="0.5" oninput="VW_TILES._qqSetV('wl',this.value)"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Height (ft)</label>
        <input type="number" id="qq-wh" value="${r.wh}" placeholder="7" inputmode="decimal" step="0.5" oninput="VW_TILES._qqSetV('wh',this.value)"></div>
    </div>${liveWall}
    ${!noDoor?`
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--text3)">Door deduction:</span>
      <button onclick="VW_TILES._qqSet('hasDoor','true')"  style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;border:${r.hasDoor?'2px solid var(--gold)':'1px solid var(--border)'};background:${r.hasDoor?'var(--gold-muted)':'var(--bg3)'}">
        ${r.hasDoor?'✓ Yes':'Yes'}</button>
      <button onclick="VW_TILES._qqSet('hasDoor','false')" style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;border:${!r.hasDoor?'2px solid var(--red,#ef4444)':'1px solid var(--border)'};background:${!r.hasDoor?'rgba(239,68,68,0.1)':'var(--bg3)'}">
        ${!r.hasDoor?'✓ No door':'No door'}</button>
      ${r.hasDoor?`<input type="number" value="${r.dw}" placeholder="W" style="width:42px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:var(--bg3);color:var(--text)" inputmode="decimal" step="0.5" oninput="VW_TILES._qqSetV('dw',this.value)">
        <span style="font-size:10px;color:var(--text3)">×</span>
        <input type="number" value="${r.dh}" placeholder="H" style="width:42px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:11px;background:var(--bg3);color:var(--text)" inputmode="decimal" step="0.5" oninput="VW_TILES._qqSetV('dh',this.value)"><span style="font-size:10px;color:var(--text3)">ft</span>`:''}
    </div>`:''}`:''}

    <button class="btn-primary full-width" style="margin-top:14px" onclick="VW_TILES._qqSave()">${_qqData.editingIdx !== undefined && _qqData.editingIdx !== null ? '✓ Update Room' : '✓ Add Room'}</button>
  </div>`;
}

function _qqSet(field, val) {
  if (!_qqData.adding) return;
  if (field === 'hasDoor') {
    // Force strict boolean — never store string 'false' which is truthy!
    _qqData.adding.hasDoor = (val === true || val === 'true');
  } else {
    _qqData.adding[field] = val==='true'?true:val==='false'?false:val;
  }
  _qqShowRooms();
}
function _qqSetV(field, val) { if (!_qqData.adding) return; _qqData.adding[field]=val; }
function _qqCancelAdd() { _qqData.adding=null; _qqData.editingIdx=null; _qqShowRooms(); }
function _qqRm(i) {
  _qqData.rooms.splice(i, 1);
  // Clear all price keys — indices have shifted, old keys are now stale
  Object.keys(window).filter(k => k.startsWith('qqprice_'))
    .forEach(k => { try { delete window[k]; } catch(e){} });
  _qqShowRooms();
}
function _qqEditRoom(i) {
  // Load existing room into the add form for editing
  _qqData.adding = { ..._qqData.rooms[i] };
  _qqData.editingIdx = i;  // _qqSave will update at this index instead of pushing
  _qqShowRooms();
}

function _qqSqft(r) {
  let t=0;
  if (r.surface==='floor'||r.surface==='both') {
    if (r.mode==='sqft') t+=parseFloat(r.sqft)||0;
    else { const l=parseFloat(r.l)||0,w=parseFloat(r.w)||0; t+=l*w; if(r.skirtingIn>0) t+=2*(l+w)*(r.skirtingIn/12); }
  }
  if (r.surface==='wall'||r.surface==='both') {
    const wl=parseFloat(r.wl)||0,wh=parseFloat(r.wh)||0;
    const dw=r.hasDoor===true&&r.type!=='Kitchen'?parseFloat(r.dw)||0:0;
    const dh=r.hasDoor===true&&r.type!=='Kitchen'?parseFloat(r.dh)||0:0;
    t+=Math.max(0,wl*wh-dw*dh);
  }
  return t;
}

function _qqSave() {
  const r = _qqData.adding;
  if (!r) return;
  // Sync latest typed values from DOM
  ['l','w','sqft','wl','wh','dw','dh'].forEach(f=>{ const el=document.getElementById('qq-'+f); if(el) r[f]=el.value; });
  // Auto-fill wall length from floor dimensions for "both" surface rooms (bathroom, kitchen, etc.)
  if ((r.surface==='both') && !parseFloat(r.wl) && parseFloat(r.l) && parseFloat(r.w)) {
    r.wl = String(Math.round(2 * (parseFloat(r.l) + parseFloat(r.w)) * 10) / 10);
    showToast(`Wall length auto-set to ${r.wl}ft (perimeter). Adjust if needed.`, 'info');
  }
  // Validate measurements explicitly per surface (not via combined _qqSqft which adds wall+floor)
  if (r.surface === 'floor' || r.surface === 'both') {
    if (r.mode === 'lw' && (!parseFloat(r.l) || !parseFloat(r.w))) { showToast('Enter floor length and width','warn'); return; }
    if (r.mode === 'sqft' && !parseFloat(r.sqft)) { showToast('Enter floor area (sqft)','warn'); return; }
  }
  if (r.surface === 'wall' || r.surface === 'both') {
    if (!parseFloat(r.wl)) { showToast('Enter total wall length','warn'); return; }
    if (!parseFloat(r.wh)) { showToast('Enter wall height','warn'); return; }
  }
  if (_qqData.editingIdx !== undefined && _qqData.editingIdx !== null) {
    // Update existing room instead of pushing duplicate
    _qqData.rooms[_qqData.editingIdx] = { ..._qqData.adding };
    _qqData.editingIdx = null;
  } else {
    _qqData.rooms.push({ ..._qqData.adding });
  }
  _qqData.adding = null;
  _qqShowRooms();
  // Auto-save room data so it's persisted even if user exits before Save Estimate
  _qqAutoSave().catch(() => {});
}

// ── SCREEN: Tile Design (replaces Preferences/Match/Apply) ─────────

function _qqDesignTile(roomIdx, surface) {
  _qqData.designing = { roomIdx, surface, assignSearch: '' };
  const room = _qqData.rooms[roomIdx];
  const existing = surface === 'floor' ? room.floorDesign : room.wallDesign;
  if (existing?.size) { _qqData.designing.size = existing.size; _qqScreen('design_pattern'); }
  else _qqScreen('design_size');
}

function _qqShowDesignSize() {
  const d = _qqData.designing;
  const room = _qqData.rooms[d.roomIdx];
  const existing = d.surface === 'floor' ? room.floorDesign : room.wallDesign;
  const isFloor = d.surface === 'floor';
  // Tile sizes appropriate for surface
  const allSizes = [
    {mm:'300×300',  lbl:'300×300',   note:'Floor / Wall / Bathroom'},
    {mm:'300×450',  lbl:'300×450',   note:'Wall · 1ft × 1.5ft'},
    {mm:'300×600',  lbl:'300×600',   note:'Wall · 1ft × 2ft'},
    {mm:'400×400',  lbl:'400×400',   note:'Floor · ~1.3ft sq'},
    {mm:'600×600',  lbl:'600×600',   note:'Floor / Wall · 2ft sq'},
    {mm:'600×1200', lbl:'600×1200',  note:'Floor / Wall · 2ft × 4ft'},
    {mm:'800×800',  lbl:'800×800',   note:'Floor · 2.6ft sq'},
    {mm:'800×1600', lbl:'800×1600',  note:'Floor · 2.6ft × 5.2ft'},
    {mm:'1200×1200',lbl:'1200×1200', note:'Floor Slab · 4ft sq'},
    {mm:'1200×1800',lbl:'1200×1800', note:'Floor / Wall Slab · 4ft × 6ft'},
    {mm:'2400×800', lbl:'2400×800',  note:'Floor / Wall Slab · 8ft × 2.6ft'},
    {mm:'3000×800', lbl:'3000×800',  note:'Floor / Wall Slab · 10ft × 2.6ft'},
  ];
  const sizes = isFloor
    ? allSizes.filter(s => !['300×450','300×600'].includes(s.mm))
    : allSizes.filter(s => !['800×800','800×1600','1200×1200'].includes(s.mm));

  _qqSheet(`
    <div style="font-size:12px;color:var(--text3);margin-bottom:4px">${room.type} · ${isFloor?'🔲 Floor':'🧱 Wall'}</div>
    <div style="font-size:14px;font-weight:700;margin-bottom:12px">Select Tile Size</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px">
      ${sizes.map(sz => `
        <button onclick="VW_TILES._qqPickDesignSize('${sz.mm}')"
          style="padding:10px 8px;border-radius:10px;border:${existing?.size===sz.mm?'2px solid var(--gold)':'1px solid var(--border)'};background:${existing?.size===sz.mm?'var(--gold-muted)':'var(--bg2)'};color:${existing?.size===sz.mm?'var(--gold)':'var(--text)'};cursor:pointer;text-align:left">
          <div style="font-size:14px;font-weight:800">${sz.lbl}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${sz.note}</div>
        </button>
      `).join('')}
    </div>
    <button onclick="VW_TILES._qqScreen('rooms')" class="btn-secondary full-width">← Back to Rooms</button>
  `, `Design Size — ${room.type}`);
}

function _qqPickDesignSize(mm) {
  const d = _qqData.designing;
  const room = _qqData.rooms[d.roomIdx];
  d.size = mm;
  const design = { size: mm, pattern: [], tileMap: {}, patternStr: '' };
  if (d.surface === 'floor') room.floorDesign = design;
  else room.wallDesign = design;
  _qqScreen('design_pattern');
}

function _qqShowDesignPattern() {
  const d = _qqData.designing;
  const room = _qqData.rooms[d.roomIdx];
  const design = d.surface === 'floor' ? room.floorDesign : room.wallDesign;
  if (!design) { _qqScreen('design_size'); return; }

  const [mmH, mmW] = design.size.split('×').map(Number);
  // Wall: rows = round(height / tile_height_ft); 300mm tile ≈ 1ft = 1 tile per row
  const tileH_ft = mmH / 304.8;
  const wallH_ft = parseFloat(room.wh || 7);
  const rows = d.surface === 'wall' ? Math.round(wallH_ft / tileH_ft) : 0;

  const tileW_ft = mmW / 304.8;
  const wallLen = parseFloat(room.wl || (room.l&&room.w ? 2*(parseFloat(room.l)+parseFloat(room.w)) : 0));
  const cols = Math.ceil(wallLen / tileW_ft);

  const patternStr = design.patternStr || '';
  const codes = patternStr ? patternStr.split(':').map(s=>s.trim().toUpperCase()).filter(Boolean) : [];
  const valid = d.surface === 'wall' ? codes.length === rows : codes.length >= 1;
  const rowNote = d.surface === 'wall'
    ? `${rows} rows for ${wallH_ft}ft height (${design.size.split('×')[0]}mm = ~1 tile per ft)`
    : `Enter tile codes (1 for single tile, or A:B for 2-tile pattern)`;

  _qqSheet(`
    <div style="font-size:12px;color:var(--text3);margin-bottom:4px">${room.type} · ${d.surface==='floor'?'Floor':'Wall'} · <strong>${design.size}mm</strong></div>
    <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px">
      ${d.surface === 'wall' ? `
      <div>📐 Wall: ${room.wl}ft × ${room.wh}ft</div>
      <div style="color:var(--gold);font-weight:700;margin-top:3px">→ <strong>${rows} rows</strong> required (enter ${rows} codes, one per row bottom→top)</div>
      <div style="color:var(--text3);margin-top:2px">Columns across: ~${cols} (last column cut to fit)</div>
      ` : `<div>📐 Floor: ${room.l||'?'}×${room.w||'?'}ft | Single or multi-tile pattern</div>`}
    </div>
    <div style="font-size:13px;font-weight:700;margin-bottom:6px">Enter Pattern (shortcodes separated by :)</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:6px">
      Use <strong>short codes 1–3 chars</strong>: L, D, HL, M, A, B, HL1, HL2…<br>
      Example for ${rows||7} rows: <strong>L:L:D:D:HL:D:L</strong>
    </div>
    <input type="text" id="qq-pattern-input" value="${patternStr}"
      placeholder="${d.surface==='wall'?Array(rows||7).fill('?').join(':'):'A'}"
      style="width:100%;padding:12px;border-radius:10px;border:1px solid ${valid?'var(--green)':patternStr?'var(--red)':'var(--border)'};background:var(--bg3);color:var(--text);font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;box-sizing:border-box;margin-bottom:8px"
      oninput="VW_TILES._qqPatternLive(this.value)">
    <div id="qq-pattern-preview" style="margin-bottom:12px;min-height:28px">${_qqPatternPreview(codes,rows)}</div>
    <div style="display:flex;gap:8px">
      <button onclick="VW_TILES._qqScreen('design_size')" class="btn-secondary" style="flex:1">← Size</button>
      <button id="qq-pat-next" onclick="VW_TILES._qqConfirmPattern()"
        class="btn-primary" style="flex:1;background:var(--gold);color:#000;${valid?'':'opacity:.45;cursor:not-allowed'}" ${valid?'':'disabled'}>
        ${valid ? 'Next → Assign Tiles' : (d.surface==='wall'&&codes.length>0 ? 'Need '+rows+' codes, entered '+codes.length : 'Next → Assign Tiles')}
      </button>
    </div>
  `, `Pattern — ${d.surface==='floor'?'Floor':'Wall'}`);
}

function _qqPatternPreview(codes, requiredRows) {
  if (!codes.length) return '<div style="font-size:11px;color:var(--text3)">Enter pattern above</div>';
  const unique = [...new Set(codes)];
  const colors = ['#F5C842','#60A5FA','#34D399','#F87171','#A78BFA','#FB923C','#38BDF8','#4ADE80','#FBBF24','#2DD4BF'];
  const cm = {}; unique.forEach((c,i) => { cm[c] = colors[i % colors.length]; });
  const valid = requiredRows ? codes.length === requiredRows : codes.length >= 1;
  return `
    <div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin-bottom:6px">
      ${codes.map(c=>`<span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:6px;background:${cm[c]}22;border:2px solid ${cm[c]};color:${cm[c]};font-size:10px;font-weight:800">${c.slice(0,3)}</span>`).join('')}
      <span style="font-size:11px;margin-left:6px;color:${valid?'var(--green)':'var(--red)'}">${codes.length}/${requiredRows||codes.length} ${valid?'✓':requiredRows?'← need '+requiredRows:''}</span>
    </div>
    <div style="font-size:11px;color:var(--text3)">${unique.length} tile type${unique.length>1?'s':''}: ${unique.map(c=>`<strong>${c}</strong>`).join(', ')}</div>`;
}

function _qqPatternLive(val) {
  const d = _qqData.designing;
  if (!d) return;
  const room = _qqData.rooms[d.roomIdx];
  const design = d.surface === 'floor' ? room.floorDesign : room.wallDesign;
  if (design) design.patternStr = val.toUpperCase();
  const codes = val ? val.split(':').map(s=>s.trim().toUpperCase()).filter(Boolean) : [];
  const [mmH] = (design?.size||'300×300').split('×').map(Number);
  const rows = d.surface === 'wall' ? Math.round(parseFloat(room.wh||7) / (mmH/304.8)) : 0;
  const pv = document.getElementById('qq-pattern-preview');
  if (pv) pv.innerHTML = _qqPatternPreview(codes, rows);
  const valid = rows ? codes.length === rows : codes.length >= 1;
  const nb = document.getElementById('qq-pat-next');
  if (nb) { nb.disabled = !valid; nb.style.opacity = valid ? '1' : '.45'; }
}

function _qqConfirmPattern() {
  const d = _qqData.designing;
  const room = _qqData.rooms[d.roomIdx];
  const design = d.surface === 'floor' ? room.floorDesign : room.wallDesign;
  const patEl = document.getElementById('qq-pattern-input');
  if (patEl) design.patternStr = patEl.value.toUpperCase();
  design.pattern = design.patternStr.split(':').map(s=>s.trim().toUpperCase()).filter(Boolean);
  // Remove stale tileMap entries for removed codes
  const unique = new Set(design.pattern);
  Object.keys(design.tileMap).forEach(k => { if (!unique.has(k)) delete design.tileMap[k]; });
  d.pendingCodes = [...unique];
  d.currentCodeIdx = 0;
  _qqScreen('design_assign');
}

async function _qqShowTileAssign() {
  const d = _qqData.designing;
  const room = _qqData.rooms[d.roomIdx];
  const design = d.surface === 'floor' ? room.floorDesign : room.wallDesign;
  if (!d.pendingCodes?.length) { _qqShowRooms(); return; }
  const code = d.pendingCodes[d.currentCodeIdx];
  if (!code) { _qqShowRooms(); return; }
  const existing = design.tileMap[code];

  const [mmH, mmW] = design.size.split('\u00d7').map(Number);
  const tileW_ft = mmW / 304.8;
  const cols = Math.ceil((d.surface==='wall' ? parseFloat(room.wl||0) : parseFloat(room.l||0)) / tileW_ft) || 1;
  const codeRows = design.pattern.filter(c=>c===code).length;
  const estimatedTiles = codeRows * cols;

  const colors = ['#F5C842','#60A5FA','#34D399','#F87171','#A78BFA','#FB923C','#38BDF8','#4ADE80'];
  const allCodes = [...new Set(design.pattern)];
  const codeColor = colors[allCodes.indexOf(code) % colors.length] || '#F5C842';

  // Fetch inventory tiles for this size
  let tiles = [];
  try {
    const { data } = await VW_DB.client.from('products')
      .select('id,name,brand,tile_size_mm,tile_finish,colour_family,price_per_sqft,stock,tiles_per_box')
      .eq('category','Tiles').eq('tile_size_mm', design.size).eq('is_active',true)
      .order('stock', { ascending: true });
    tiles = data || [];
  } catch(e) {}

  // Store for in-place search filter — no re-render needed
  window._qqAssignMeta = { tiles, code, codeColor, estimatedTiles, existing };

  const _buildList = (list) => {
    if (!list.length) return '<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">No tiles match</div>';
    return list.map(t => {
      const tpb = t.tiles_per_box || 6;
      const boxesNeeded = Math.ceil(estimatedTiles / tpb);
      const stockOk = t.stock >= boxesNeeded;
      const sel = existing?.id === t.id;
      return '<div onclick="VW_TILES._qqAssignTile(' + "'"+code+"'"+','+t.id+',' + "'"+_qqEsc(t.name)+"','"+_qqEsc(t.brand||'')+"','"+t.tile_size_mm+"',"+t.price_per_sqft+','+t.stock+','+tpb+')"' +
        ' style="padding:10px;border-radius:10px;margin-bottom:6px;cursor:pointer;border:'+(sel?'2px solid '+codeColor:'1px solid var(--border)')+';background:'+(sel?codeColor+'15':'var(--bg2)')+'">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;gap:8px">'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+t.name+'</div>'+
            '<div style="font-size:11px;color:var(--text3)">'+(t.brand||'')+' \u00b7 '+(t.tile_finish||'')+' \u00b7 '+(t.colour_family||'')+'</div>'+
            '<div style="font-size:11px;color:var(--text3)">\u20b9'+t.price_per_sqft+'/sqft \u00b7 '+tpb+' tiles/box</div>'+
          '</div>'+
          '<div style="text-align:right;flex-shrink:0">'+
            '<div style="font-size:12px;color:'+(stockOk?'var(--green)':'var(--red)')+';font-weight:700">'+t.stock+' boxes</div>'+
            '<div style="font-size:10px;color:var(--text3)">need ~'+boxesNeeded+'</div>'+
            (sel?'<div style="color:'+codeColor+';font-size:18px">\u2713</div>':'')+
          '</div>'+
        '</div>'+
      '</div>';
    }).join('');
  };
  window._qqAssignBuildList = _buildList;

  const sq = d.assignSearch || '';
  const initial = sq ? tiles.filter(t => t.name.toLowerCase().includes(sq.toLowerCase()) || (t.brand||'').toLowerCase().includes(sq.toLowerCase())) : tiles;

  _qqSheet(`
    <div style="font-size:11px;color:var(--text3);margin-bottom:6px">
      Code ${d.currentCodeIdx+1}/${d.pendingCodes.length} \u00b7 ${room.type} \u00b7 ${design.size}
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;background:${codeColor}22;border:2px solid ${codeColor};color:${codeColor};font-size:${code.length>3?'10':'16'}px;font-weight:900;flex-shrink:0;overflow:hidden;padding:2px">${code.length>5?code.slice(0,4)+'\u2026':code}</span>
      <div>
        <div style="font-size:15px;font-weight:700">Assign tile for <span style="color:${codeColor}">"${code}"</span></div>
        <div style="font-size:11px;color:var(--text3)">${d.surface==='floor'?'Floor pattern':'Wall rows'}: ${design.patternStr} \u00b7 ~${estimatedTiles} tiles needed</div>
      </div>
    </div>
    <input type="search" placeholder="Search tile name or brand..." value="${_qqEsc(sq)}"
      id="qq-assign-search"
      style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-size:13px;box-sizing:border-box;margin-bottom:8px"
      oninput="VW_TILES._qqAssignFilter(this.value)" autocomplete="off" autocorrect="off" spellcheck="false">
    ${tiles.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--text3)">No '+design.size+' tiles in inventory</div>' : ''}
    <div id="qq-assign-results" style="max-height:260px;overflow-y:auto">${_buildList(initial)}</div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button onclick="VW_TILES._qqAssignBack()" class="btn-secondary" style="flex:1">\u2190 Pattern</button>
      <button onclick="VW_TILES._qqAssignNext()"
        style="flex:2;padding:12px;border-radius:10px;background:${codeColor};border:none;color:#000;font-weight:700;cursor:pointer">
        ${d.currentCodeIdx < d.pendingCodes.length-1 ? 'Next Code \u2192' : '\u2713 Done \u2014 View Rooms'}
      </button>
    </div>`, 'Assign Tile — Code '+(d.currentCodeIdx+1)+'/'+d.pendingCodes.length);

  // Autofocus search if returning to assign screen with existing search
  if (sq) setTimeout(() => { const el = document.getElementById('qq-assign-search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }}, 80);
}


// _qqAssignFilter — updates ONLY the results list, never re-renders the sheet
// This fixes the single-character search bug caused by full sheet re-render on each keystroke
function _qqAssignFilter(val) {
  if (_qqData.designing) _qqData.designing.assignSearch = val;
  const meta = window._qqAssignMeta;
  if (!meta) return;
  const results = document.getElementById('qq-assign-results');
  if (!results) return;
  const q = val.toLowerCase();
  const filtered = q ? meta.tiles.filter(t =>
    t.name.toLowerCase().includes(q) || (t.brand||'').toLowerCase().includes(q)
  ) : meta.tiles;
  results.innerHTML = window._qqAssignBuildList ? window._qqAssignBuildList(filtered) : '';
}

function _qqAssignSearch(val) {
  if (_qqData.designing) _qqData.designing.assignSearch = val;
  _qqScreen('design_assign');
}

function _qqAssignTile(code, id, name, brand, size, price, stock, tpb) {
  const d = _qqData.designing;
  const room = _qqData.rooms[d.roomIdx];
  const design = d.surface === 'floor' ? room.floorDesign : room.wallDesign;
  design.tileMap[code] = { id, name, brand, size, price_per_sqft: price, stock, tiles_per_box: tpb };
  _qqScreen('design_assign');
  // Auto-save progress silently
  _qqAutoSave().catch(()=>{});
}

function _qqAssignNext() {
  const d = _qqData.designing;
  d.assignSearch = '';
  if (d.currentCodeIdx < d.pendingCodes.length - 1) {
    d.currentCodeIdx++;
    _qqScreen('design_assign');
  } else {
    _qqData.designing = null;
    _qqShowRooms();
  }
}

function _qqAssignBack() {
  _qqData.designing.assignSearch = '';
  _qqScreen('design_pattern');
}

// ── CALCULATION ENGINE ─────────────────────────────────────────────

function _qqCalcWall(wallLen_ft, wallH_ft, hasDoor, dw, dh, design) {
  if (!design?.size || !design.pattern?.length) return null;
  const [mmH, mmW] = design.size.split('×').map(Number);
  const tileH_ft = mmH / 304.8;  // e.g. 300mm → 0.984ft → ~1ft per row
  const tileW_ft = mmW / 304.8;  // e.g. 450mm → 1.476ft per column

  const rows = Math.round(wallH_ft / tileH_ft);   // 7ft → 7 rows
  const cols = Math.ceil(wallLen_ft / tileW_ft);   // 25ft → 17 cols

  // Door deduction (column-based, at bottom rows)
  const doorCols = (hasDoor && dw) ? Math.min(Math.ceil(dw / tileW_ft), cols) : 0;
  const doorRows = (hasDoor && dh) ? Math.round(dh / tileH_ft) : 0;

  const pattern = design.pattern; // array of codes, length = rows (bottom→top)
  const tileMap = design.tileMap;

  // Count per code with door deduction
  const codeData = {};
  pattern.forEach((code, rowIdx) => {
    if (!codeData[code]) codeData[code] = { grossTiles: 0, doorTiles: 0 };
    codeData[code].grossTiles += cols;
    // Row 0 = bottom. Door is at bottom doorRows rows, occupying doorCols columns
    if (rowIdx < doorRows) codeData[code].doorTiles += doorCols;
  });

  // Use tile_weight_config tiles_per_box (authoritative), not products.tiles_per_box
  const cfgSzW = (_tqSizeCfg?.sizes||[]).find(s=>s.mm===design.size);
  const results = {};
  for (const [code, counts] of Object.entries(codeData)) {
    const tile = tileMap[code];
    if (!tile) continue;
    const codeRows = pattern.filter(c=>c===code).length;
    const netTiles = counts.grossTiles - counts.doorTiles;
    const tpb = cfgSzW?.tiles_per_box || tile.tiles_per_box || 6; // config first
    const boxes = Math.ceil(netTiles / tpb);
    const sqftPerTile = tileSqftPerTile(mmH, mmW);
    const sqft = netTiles * sqftPerTile;
    const amount = sqft * (tile.price_per_sqft || 0);
    const stockOk = tile.stock >= boxes;
    results[code] = { code, tile, codeRows, rowNums: pattern.map((c,i)=>c===code?i+1:null).filter(Boolean),
      grossTiles: counts.grossTiles, doorTiles: counts.doorTiles, netTiles,
      boxes, sqft, amount, stockOk };
  }

  const totalBoxes = Object.values(results).reduce((s,r)=>s+r.boxes,0);
  const totalAmount = Object.values(results).reduce((s,r)=>s+r.amount,0);
  const lastColCut = (cols * tileW_ft) > wallLen_ft;
  return { rows, cols, results, totalBoxes, totalAmount, lastColCut, wallLen_ft, wallH_ft, design };
}

function _qqCalcFloor(room, design) {
  if (!design?.size) return null;
  const [mmH, mmW] = design.size.split('×').map(Number);
  const sqftPerTile = tileSqftPerTile(mmH, mmW);

  // FLOOR-ONLY sqft — never add wall area even for 'both' surface rooms
  let floorSqft;
  if (room.mode === 'sqft') {
    floorSqft = parseFloat(room.sqft) || 0;
  } else {
    const l = parseFloat(room.l) || 0;
    const w = parseFloat(room.w) || 0;
    floorSqft = l * w;
    if (room.skirtingIn > 0) floorSqft += 2 * (l + w) * (room.skirtingIn / 12);
  }
  if (!floorSqft) return null;

  const pattern = design.pattern;
  const tileMap = design.tileMap;
  const uniqueCodes = [...new Set(pattern)];
  const totalParts = pattern.length || 1;
  // Use tile_weight_config tiles_per_box (authoritative), not products.tiles_per_box
  const cfgSz = (_tqSizeCfg?.sizes||[]).find(s=>s.mm===design.size);

  const results = {};
  for (const code of uniqueCodes) {
    const tile = tileMap[code];
    if (!tile) continue;
    const codeParts = pattern.filter(c=>c===code).length;
    const codeSqft = totalParts > 1 ? floorSqft * (codeParts / totalParts) : floorSqft;
    const tiles = Math.ceil(codeSqft / sqftPerTile);
    const tpb = cfgSz?.tiles_per_box || tile.tiles_per_box || 6; // config first
    const boxes = Math.ceil(tiles / tpb);
    const amount = codeSqft * (tile.price_per_sqft || 0);
    const stockOk = tile.stock >= boxes;
    results[code] = { code, tile, codeParts, netTiles: tiles, boxes, sqft: codeSqft, amount, stockOk };
  }

  const totalBoxes = Object.values(results).reduce((s,r)=>s+r.boxes,0);
  const totalAmount = Object.values(results).reduce((s,r)=>s+r.amount,0);
  return { floorSqft, results, totalBoxes, totalAmount, design };
}

// ── SCREEN: Output ─────────────────────────────────────────────────

function _qqShowOutput() {
  const rooms = _qqData.rooms;
  const cust = _qqData.customer || {};
  const colors = ['#F5C842','#60A5FA','#34D399','#F87171','#A78BFA','#FB923C','#38BDF8','#4ADE80','#FBBF24','#2DD4BF'];

  let html = '';
  let grandBoxes = 0, grandAmount = 0;
  // Track which price KEY each tile was last priced with (not the value — value is read live)
  const _sessionHintKeys = {}; // tile.id → { label, boxKey, sqftPerBox, type, ri, code, sqftKey }

  // Customer name banner — always visible at top
  html += `<div style="background:var(--bg2);border-radius:10px;padding:8px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
    <span style="font-size:16px">👤</span>
    ${cust.name ? `
      <div style="flex:1">
        <div style="font-size:13px;font-weight:800">${cust.name}</div>
        ${cust.phone?`<div style="font-size:11px;color:var(--text3)">${cust.phone}</div>`:''}
      </div>
    ` : `
      <div style="flex:1">
        <div style="font-size:11px;color:var(--red);font-weight:700;margin-bottom:4px">⚠️ Customer name required</div>
        <input id="qq-cust-name" type="text" placeholder="Enter customer name..."
          style="width:100%;padding:6px 8px;border-radius:8px;border:1px solid rgba(239,68,68,0.5);background:var(--bg3);color:var(--text);font-size:13px;font-weight:700;box-sizing:border-box"
          oninput="_qqData.customer.name=this.value" autofocus>
      </div>
    `}
    <button onclick="VW_TILES._qqScreen('customer')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text3);font-size:11px;cursor:pointer">Edit</button>
  </div>`;

  rooms.forEach((room, ri) => {
    const def = _QQ_ROOMS.find(t=>t.type===room.type)||{icon:'🏠'};
    html += `<div style="margin-bottom:16px">
      <div style="font-size:15px;font-weight:800;padding:6px 0;border-bottom:2px solid var(--gold);margin-bottom:10px;display:flex;align-items:center;gap:6px">
        <span>${def.icon}</span><span>${room.type}</span>
      </div>`;

    // Floor
    if ((room.surface==='floor'||room.surface==='both') && room.floorDesign) {
      const fc = _qqCalcFloor(room, room.floorDesign);
      if (fc) {
        const codeList = Object.entries(fc.results);
        // Skirting display — floor-only area breakdown
        const rawSqft = (room.mode==='sqft') ? (parseFloat(room.sqft)||0) : (parseFloat(room.l)||0)*(parseFloat(room.w)||0);
        const skirtSqft = Math.max(0, fc.floorSqft - rawSqft);
        const skirtNote = skirtSqft > 0.1 ? ` · incl. skirting ${skirtSqft.toFixed(1)} sqft` : '';
        html += `<div style="margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px">🔲 Floor · ${room.floorDesign.size}</div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:6px">${rawSqft.toFixed(1)} sqft${skirtNote} = <strong>${fc.floorSqft.toFixed(1)} sqft total</strong></div>`;

        codeList.forEach(([code, r], ci) => {
          const col = colors[ci % colors.length];
          const cfgSz_fl = (_tqSizeCfg?.sizes||[]).find(s=>s.mm===fc.design.size);
          const tpb_fl = cfgSz_fl?.tiles_per_box || r.tile.tiles_per_box || 6;
          const [mmH_f, mmW_f] = (fc.design.size).split('×').map(Number);
          const sqftPerBox_fl = tileSqftPerTile(mmH_f, mmW_f) * tpb_fl;
          const defaultBoxPrice_f = Math.round((r.tile.price_per_sqft||0) * sqftPerBox_fl);
          const boxKey  = `qqprice_fl_${ri}_${code}`;
          const sqftKey = `qqprice_fl_sqft_${ri}_${code}`;
          // Set default price into window key if not already set — ensures Save Estimate always has a price
          if (window[boxKey] === undefined && defaultBoxPrice_f > 0) window[boxKey] = defaultBoxPrice_f;
          if (window[sqftKey] === undefined && (r.tile.price_per_sqft||0) > 0) window[sqftKey] = r.tile.price_per_sqft;
          const boxPrice_f  = window[boxKey]  ?? defaultBoxPrice_f;
          const sqftPrice_f = window[sqftKey] ?? (r.tile.price_per_sqft||0);
          const amount_f = r.boxes * boxPrice_f;
          grandBoxes += r.boxes; grandAmount += amount_f;
          html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:8px;background:var(--bg2);margin-bottom:4px;border-left:3px solid ${col}">
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:5px;background:${col}22;border:1.5px solid ${col};color:${col};font-size:9px;font-weight:800">${code.length>3?code.slice(0,3):code}</span>
                <span style="font-size:12px;font-weight:700">${r.tile.name}</span>
                ${!r.stockOk?`<span style="font-size:10px;color:var(--red);font-weight:700">⚠️ low stock</span>`:''}
              </div>
              <div style="font-size:11px;color:var(--text3)">${r.tile.brand} · ${r.sqft.toFixed(1)} sqft · ${r.boxes} boxes</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">
                <span style="font-size:11px;color:var(--text3)">₹/box:</span>
                <input id="qq-box-fl-${ri}-${code}" type="number" value="${boxPrice_f}" min="0" step="10" inputmode="decimal"
                  style="width:65px;padding:3px 6px;border:1px solid var(--gold-border);border-radius:6px;font-size:12px;font-weight:700;background:var(--bg3);color:var(--gold);text-align:center"
                  oninput="VW_TILES._qqUpdatePrice('fl',${ri},'${code}',${sqftPerBox_fl.toFixed(4)},'${boxKey}','${sqftKey}',true,this.value)">
                <span style="font-size:11px;color:var(--text3)">or ₹/sqft:</span>
                <input id="qq-sqft-fl-${ri}-${code}" type="number" value="${sqftPrice_f}" min="0" step="1" inputmode="decimal"
                  style="width:55px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg3);color:var(--text);text-align:center"
                  oninput="VW_TILES._qqUpdatePrice('fl',${ri},'${code}',${sqftPerBox_fl.toFixed(4)},'${boxKey}','${sqftKey}',false,this.value)">
                <span id="qq-amt-fl-${ri}-${code}" data-boxes="${r.boxes}" style="font-size:11px;color:var(--gold);font-weight:700">= ₹${Math.round(amount_f).toLocaleString('en-IN')}</span>
              </div>
              ${(()=>{
                const sh = _sessionHintKeys[r.tile.id];
                if (sh) return `<div id="qq-hint-fl-${ri}-${code}" data-hint-src="${sh.boxKey}" data-apply-type="fl" data-apply-ri="${ri}" data-apply-code="${code}" data-apply-spb="${sqftPerBox_fl.toFixed(4)}" data-apply-bk="${boxKey}" data-apply-sk="${sqftKey}" data-hint-label="${sh.label}" style="margin-top:4px;display:none;width:100%;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;text-align:left;box-sizing:border-box" onclick="VW_TILES._qqApplyHint(this)">💡 Same tile — ₹<span class="hint-price"></span>/box in ${sh.label} — <span class="hint-action">tap to use</span></div>`;
                const ph = window._qqPriceHistory?.[r.tile.id];
                if (ph) return `<button type="button" onclick="VW_TILES._qqUpdatePrice('fl',${ri},'${code}',${sqftPerBox_fl.toFixed(4)},'${boxKey}','${sqftKey}',true,${ph.pricePerBox})" style="margin-top:4px;width:100%;padding:3px 8px;border-radius:5px;background:rgba(245,200,66,0.07);border:1px dashed var(--gold-border);color:var(--gold);font-size:10px;cursor:pointer;text-align:left">💡 Previously quoted ₹${ph.pricePerBox}/box on ${ph.tqNo} (${ph.date}) — tap to use</button>`;
                return '';
              })()}
              ${(_sessionHintKeys[r.tile.id] = { label: room.type+' Floor', boxKey, sqftKey, sqftPerBox: sqftPerBox_fl }, '')}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:15px;font-weight:800">${r.boxes} <span style="font-size:11px;font-weight:400">boxes</span></div>
              <div style="font-size:11px;color:var(--text3)">${r.netTiles} tiles</div>
            </div>
          </div>`;
        });
        const flCustomTotal = codeList.reduce((s,[code,r])=>s+r.boxes*(window[`qqprice_fl_${ri}_${code}`]??Math.round((r.tile.price_per_sqft||0)*((fc.design.size.split('×').map(Number).reduce((a,b)=>a*(b/25.4),1)/144)*((_tqSizeCfg?.sizes||[]).find(s=>s.mm===fc.design.size)?.tiles_per_box||r.tile.tiles_per_box||6)))),0);
        html += `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;padding:4px 6px;color:var(--text3)">
          <span>Floor total</span><span>${fc.totalBoxes} boxes · <span id="qq-fl-total-${ri}">₹${Math.round(flCustomTotal).toLocaleString('en-IN')}</span></span>
        </div></div>`;
      }
    }

    // Wall
    if ((room.surface==='wall'||room.surface==='both') && room.wallDesign) {
      const wLen = parseFloat(room.wl)||0;
      const wH   = parseFloat(room.wh)||7;
      // Strict boolean check — prevents string 'false' being truthy
      const hasDoorStrict = room.hasDoor === true;
      const dw   = hasDoorStrict ? parseFloat(room.dw)||0 : 0;
      const dh   = hasDoorStrict ? parseFloat(room.dh)||0 : 0;
      const wc   = _qqCalcWall(wLen, wH, hasDoorStrict, dw, dh, room.wallDesign);
      if (wc) {
        const allCodes = Object.keys(wc.results);
        html += `<div style="margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px">🧱 Wall · ${room.wallDesign.size} · ${wc.rows} rows × ${wc.cols} cols${wc.lastColCut?' · last col cut':''}</div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Pattern: ${room.wallDesign.patternStr}</div>`;

        Object.entries(wc.results).forEach(([code, r], ci) => {
          const col = colors[ci % colors.length];
          const cfgSzWl = (_tqSizeCfg?.sizes||[]).find(s=>s.mm===wc.design.size);
          const tpbWl = cfgSzWl?.tiles_per_box || r.tile.tiles_per_box || 6;
          const [mmH_w, mmW_w] = (wc.design.size).split('×').map(Number);
          const sqftPerBox_wl = tileSqftPerTile(mmH_w, mmW_w) * tpbWl;
          const defaultBoxPrice_wl = Math.round((r.tile.price_per_sqft||0) * sqftPerBox_wl);
          const wBoxKey  = `qqprice_wl_${ri}_${code}`;
          const wSqftKey = `qqprice_wl_sqft_${ri}_${code}`;
          // Set default price into window key if not already set
          if (window[wBoxKey] === undefined && defaultBoxPrice_wl > 0) window[wBoxKey] = defaultBoxPrice_wl;
          if (window[wSqftKey] === undefined && (r.tile.price_per_sqft||0) > 0) window[wSqftKey] = r.tile.price_per_sqft;
          const boxPrice_w  = window[wBoxKey]  ?? defaultBoxPrice_wl;
          const sqftPrice_w = window[wSqftKey] ?? (r.tile.price_per_sqft||0);
          const amount_w = r.boxes * boxPrice_w;
          grandBoxes += r.boxes; grandAmount += amount_w;
          html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:8px;background:var(--bg2);margin-bottom:4px;border-left:3px solid ${col}">
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:5px;background:${col}22;border:1.5px solid ${col};color:${col};font-size:9px;font-weight:800">${code.length>3?code.slice(0,3):code}</span>
                <span style="font-size:12px;font-weight:700">${r.tile.name}</span>
                ${!r.stockOk?`<span style="font-size:10px;color:var(--red);font-weight:700">⚠️ low</span>`:''}
              </div>
              <div style="font-size:11px;color:var(--text3)">${r.tile.brand} · Rows ${r.rowNums.join(',')} (${r.codeRows}R) · ${r.netTiles} tiles · stock:${r.tile.stock}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">
                <span style="font-size:11px;color:var(--text3)">₹/box:</span>
                <input id="qq-box-wl-${ri}-${code}" type="number" value="${boxPrice_w}" min="0" step="10" inputmode="decimal"
                  style="width:65px;padding:3px 6px;border:1px solid var(--gold-border);border-radius:6px;font-size:12px;font-weight:700;background:var(--bg3);color:var(--gold);text-align:center"
                  oninput="VW_TILES._qqUpdatePrice('wl',${ri},'${code}',${sqftPerBox_wl.toFixed(4)},'${wBoxKey}','${wSqftKey}',true,this.value)">
                <span style="font-size:11px;color:var(--text3)">or ₹/sqft:</span>
                <input id="qq-sqft-wl-${ri}-${code}" type="number" value="${sqftPrice_w}" min="0" step="1" inputmode="decimal"
                  style="width:55px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg3);color:var(--text);text-align:center"
                  oninput="VW_TILES._qqUpdatePrice('wl',${ri},'${code}',${sqftPerBox_wl.toFixed(4)},'${wBoxKey}','${wSqftKey}',false,this.value)">
                <span id="qq-amt-wl-${ri}-${code}" data-boxes="${r.boxes}" style="font-size:11px;color:var(--gold);font-weight:700">= ₹${Math.round(amount_w).toLocaleString('en-IN')}</span>
              </div>
              ${(()=>{
                const sh = _sessionHintKeys[r.tile.id];
                if (sh) return `<div id="qq-hint-wl-${ri}-${code}" data-hint-src="${sh.boxKey}" data-apply-type="wl" data-apply-ri="${ri}" data-apply-code="${code}" data-apply-spb="${sqftPerBox_wl.toFixed(4)}" data-apply-bk="${wBoxKey}" data-apply-sk="${wSqftKey}" data-hint-label="${sh.label}" style="margin-top:4px;display:none;width:100%;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;text-align:left;box-sizing:border-box" onclick="VW_TILES._qqApplyHint(this)">💡 Same tile — ₹<span class="hint-price"></span>/box in ${sh.label} — <span class="hint-action">tap to use</span></div>`;
                const ph = window._qqPriceHistory?.[r.tile.id];
                if (ph) return `<button type="button" onclick="VW_TILES._qqUpdatePrice('wl',${ri},'${code}',${sqftPerBox_wl.toFixed(4)},'${wBoxKey}','${wSqftKey}',true,${ph.pricePerBox})" style="margin-top:4px;width:100%;padding:3px 8px;border-radius:5px;background:rgba(245,200,66,0.07);border:1px dashed var(--gold-border);color:var(--gold);font-size:10px;cursor:pointer;text-align:left">💡 Previously quoted ₹${ph.pricePerBox}/box on ${ph.tqNo} (${ph.date}) — tap to use</button>`;
                return '';
              })()}
              ${(_sessionHintKeys[r.tile.id] = { label: room.type+' Wall', boxKey: wBoxKey, sqftKey: wSqftKey, sqftPerBox: sqftPerBox_wl }, '')}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:15px;font-weight:800">${r.boxes} <span style="font-size:11px;font-weight:400">boxes</span></div>
              <div style="font-size:11px;color:var(--text3)">${r.sqft.toFixed(1)} sqft</div>
            </div>
          </div>`;
        });
        // Wall total using per-box prices
        const wallTotalAmt = Object.values(wc.results).reduce((s,r2)=>{
          const pk=`qqprice_wl_${ri}_${r2.code}`;
          const [mH,mW]=(r2.tile.size||wc.design.size).split('×').map(Number);
          const def=Math.round((r2.tile.price_per_sqft||0)*tileSqftPerTile(mH,mW)*(r2.tile.tiles_per_box||6));
          return s+r2.boxes*(window[pk]??def);
        },0);
        html += `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;padding:4px 6px;color:var(--text3)">
          <span>Wall total</span><span>${wc.totalBoxes} boxes · <span id="qq-wl-total-${ri}">₹${Math.round(wallTotalAmt).toLocaleString('en-IN')}</span></span>
        </div></div>`;
      }
    }
    html += '</div>';
  });

  // ── Merged Tile Summary (same tile across rooms consolidated into 1 row) ──
  const _mergedTiles = {};
  _qqData.rooms.forEach((room, ri) => {
    if ((room.surface==='floor'||room.surface==='both') && room.floorDesign) {
      const fc = _qqCalcFloor(room, room.floorDesign);
      if (fc) Object.entries(fc.results).forEach(([code, r]) => {
        const key = `${r.tile.id}_${room.floorDesign.size}`;
        if (!_mergedTiles[key]) _mergedTiles[key] = { tile:r.tile, size:room.floorDesign.size, boxes:0, sqft:0, priceBoxKey:null, sqftPerBox:0 };
        _mergedTiles[key].boxes += r.boxes;
        _mergedTiles[key].sqft  += r.sqft;
        if (!_mergedTiles[key].priceBoxKey) {
          const cfgM = (_tqSizeCfg?.sizes||[]).find(s=>s.mm===room.floorDesign.size);
          const tpbM = cfgM?.tiles_per_box || r.tile.tiles_per_box || 6;
          const [mH,mW] = room.floorDesign.size.split('×').map(Number);
          _mergedTiles[key].sqftPerBox = tileSqftPerTile(mH,mW)*tpbM;
          _mergedTiles[key].priceBoxKey = `qqprice_fl_${ri}_${code}`;
        }
      });
    }
    if ((room.surface==='wall'||room.surface==='both') && room.wallDesign) {
      const wLen2=parseFloat(room.wl)||0, wH2=parseFloat(room.wh)||7;
      const dw2=room.hasDoor===true?parseFloat(room.dw)||0:0, dh2=room.hasDoor===true?parseFloat(room.dh)||0:0;
      const wc = _qqCalcWall(wLen2, wH2, room.hasDoor===true, dw2, dh2, room.wallDesign);
      if (wc) Object.entries(wc.results).forEach(([code, r]) => {
        const key = `${r.tile.id}_${room.wallDesign.size}`;
        if (!_mergedTiles[key]) _mergedTiles[key] = { tile:r.tile, size:room.wallDesign.size, boxes:0, sqft:0, priceBoxKey:null, sqftPerBox:0 };
        _mergedTiles[key].boxes += r.boxes;
        _mergedTiles[key].sqft  += r.sqft;
        if (!_mergedTiles[key].priceBoxKey) {
          const cfgM = (_tqSizeCfg?.sizes||[]).find(s=>s.mm===room.wallDesign.size);
          const tpbM = cfgM?.tiles_per_box || r.tile.tiles_per_box || 6;
          const [mH,mW] = room.wallDesign.size.split('×').map(Number);
          _mergedTiles[key].sqftPerBox = tileSqftPerTile(mH,mW)*tpbM;
          _mergedTiles[key].priceBoxKey = `qqprice_wl_${ri}_${code}`;
        }
      });
    }
  });

  const mergedEntries = Object.values(_mergedTiles);
  if (mergedEntries.length > 0) {
    html += `<div style="margin-top:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">📋 Consolidated Material List</div>`;
    mergedEntries.forEach(m => {
      const boxP  = window[m.priceBoxKey] ?? 0;
      const sqftP = m.sqftPerBox > 0 ? +(boxP / m.sqftPerBox).toFixed(1) : 0;
      const amt   = m.boxes * boxP;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg2);border-radius:8px;margin-bottom:4px;border-left:3px solid var(--gold)"
        data-cml-bk="${m.priceBoxKey}" data-cml-boxes="${m.boxes}">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700">${m.tile.name}</div>
          <div style="font-size:11px;color:var(--text3)">${m.tile.brand} · ${m.size} · ${m.sqft.toFixed(1)} sqft</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:900;color:var(--gold)">${m.boxes} boxes</div>
          <div class="cml-amt" style="font-size:11px;color:var(--text3)">${amt>0?`₹${Math.round(amt).toLocaleString('en-IN')}`:''}</div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  // Grand total + submit
  html += `
    <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-top:4px;border:1px solid var(--gold-border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:16px;font-weight:800">Grand Total</span>
        <span style="font-size:20px;font-weight:900;color:var(--gold)">${grandBoxes} boxes</span>
      </div>
      ${grandAmount?`<div style="font-size:14px;color:var(--text2);margin-bottom:10px" id="qq-grand-est">₹${Math.round(grandAmount).toLocaleString('en-IN')} estimated</div>`:''}
    </div>
    ${!_qqData?.customer?.name ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px;margin-bottom:10px">
      <div style="font-size:12px;color:var(--red);font-weight:700;margin-bottom:6px">⚠️ Customer name required to submit</div>
      <input id="qq-submit-name" type="text" placeholder="Enter customer name..."
        style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(239,68,68,0.4);background:var(--bg3);color:var(--text);font-size:13px;box-sizing:border-box"
        oninput="_qqData.customer.name=this.value">
    </div>` : ''}
    <div style="display:flex;gap:8px;margin-top:4px">
      <button onclick="VW_TILES._qqScreen('rooms')" class="btn-secondary" style="flex:1">← Edit Rooms</button>
      <button onclick="VW_TILES._qqSaveEstimate()" class="btn-secondary" style="flex:1">💾 Save Estimate</button>
    </div>
    <button onclick="VW_TILES._qqConvertToFullTQ()" style="width:100%;margin-top:8px;padding:13px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
      📋 Convert to Full Quotation
    </button>`;

  _qqSheet(html, 'Quick Quote — Output');
  // Update same-tile hints with current prices after DOM renders
  setTimeout(_qqUpdateHints, 0);
}

// ── Price update WITHOUT full re-render (fixes scroll reset) ──────
function _qqUpdatePrice(type, ri, code, sqftPerBox, boxKey, sqftKey, isBox, val) {
  const v = parseFloat(val)||0;
  let boxP, sqftP;
  if (isBox) { boxP = v; sqftP = sqftPerBox>0 ? +(v/sqftPerBox).toFixed(2) : 0; }
  else { sqftP = v; boxP = Math.round(v * sqftPerBox); }
  window[boxKey] = boxP;
  window[sqftKey] = sqftP;
  // Update BOTH input fields (both box and sqft inputs need to reflect the change)
  const boxEl  = document.getElementById(`qq-box-${type}-${ri}-${code}`);
  const sqftEl = document.getElementById(`qq-sqft-${type}-${ri}-${code}`);
  if (boxEl)  boxEl.value  = boxP;
  if (sqftEl) sqftEl.value = sqftP;
  // Recompute all totals in place
  _qqRecomputeTotals();
}

function _qqRecomputeTotals() {
  let grand = 0;
  (_qqData?.rooms||[]).forEach((room, ri) => {
    if (room.floorDesign?.pattern) {
      let flTotal = 0;
      [...new Set(room.floorDesign.pattern)].forEach(code => {
        const amtEl = document.getElementById(`qq-amt-fl-${ri}-${code}`);
        const boxes = parseInt(amtEl?.dataset.boxes||0);
        const boxP  = window[`qqprice_fl_${ri}_${code}`] ?? 0;
        flTotal += boxes * boxP;
        if (amtEl) amtEl.textContent = '= ₹' + Math.round(boxes*boxP).toLocaleString('en-IN');
      });
      const flTel = document.getElementById(`qq-fl-total-${ri}`);
      if (flTel) flTel.textContent = `₹${Math.round(flTotal).toLocaleString('en-IN')}`;
      grand += flTotal;
    }
    if (room.wallDesign?.pattern) {
      let wlTotal = 0;
      [...new Set(room.wallDesign.pattern)].forEach(code => {
        const amtEl = document.getElementById(`qq-amt-wl-${ri}-${code}`);
        const boxes = parseInt(amtEl?.dataset.boxes||0);
        const boxP  = window[`qqprice_wl_${ri}_${code}`] ?? 0;
        wlTotal += boxes * boxP;
        if (amtEl) amtEl.textContent = '= ₹' + Math.round(boxes*boxP).toLocaleString('en-IN');
      });
      const wlTel = document.getElementById(`qq-wl-total-${ri}`);
      if (wlTel) wlTel.textContent = `₹${Math.round(wlTotal).toLocaleString('en-IN')}`;
      grand += wlTotal;
    }
  });
  const grandEl = document.getElementById('qq-grand-est');
  if (grandEl) grandEl.textContent = '₹' + Math.round(grand).toLocaleString('en-IN') + ' estimated';

  // Sync consolidated material list amounts with the live price keys
  document.querySelectorAll('[data-cml-bk]').forEach(row => {
    const boxP   = window[row.dataset.cmlBk] || 0;
    const boxes  = parseInt(row.dataset.cmlBoxes) || 0;
    const amtEl  = row.querySelector('.cml-amt');
    if (amtEl) amtEl.textContent = (boxP > 0 && boxes > 0)
      ? '₹' + Math.round(boxes * boxP).toLocaleString('en-IN') : '';
  });

  // Update same-tile hint displays with current prices
  _qqUpdateHints();
}

// ── Update all same-tile hint buttons live (reads current prices, not render-time values) ─
function _qqUpdateHints() {
  document.querySelectorAll('[data-hint-src]').forEach(el => {
    const srcKey = el.dataset.hintSrc;
    const srcPrice = window[srcKey] || 0;
    if (srcPrice <= 0) { el.style.display = 'none'; return; }

    const applyKey = el.dataset.applyBk;
    const curPrice = window[applyKey] || 0;
    const priceEl  = el.querySelector('.hint-price');
    const actionEl = el.querySelector('.hint-action');
    if (priceEl) priceEl.textContent = srcPrice;

    if (curPrice > 0 && curPrice === srcPrice) {
      // ✅ Prices match — show confirmation in green
      el.style.display = 'block';
      el.style.background = 'rgba(34,197,94,0.08)';
      el.style.border = '1px solid var(--green)';
      el.style.color = 'var(--green)';
      el.style.cursor = 'default';
      el.textContent = '✅ ₹' + srcPrice + '/box — price matching';
      el.onclick = null;
    } else {
      // 💡 Hint — show tap to use
      el.style.display = 'block';
      el.style.background = 'rgba(245,200,66,0.15)';
      el.style.border = '1.5px solid var(--gold-border)';
      el.style.color = 'var(--gold)';
      el.style.cursor = 'pointer';
      // Always restore onclick — may have been null'd during a prior price-match state
      el.onclick = function() { VW_TILES._qqApplyHint(this); };
      el.innerHTML = '💡 Same tile — ₹<span class="hint-price">' + srcPrice + '</span>/box in ' +
        (el.dataset.hintLabel || '') + ' — <span class="hint-action">tap to use</span>';
    }
  });
}

// ── Apply a same-tile hint by reading its source price ─────────────────────────
function _qqApplyHint(el) {
  const srcKey  = el.dataset.hintSrc;
  const srcPrice = window[srcKey] || 0;
  if (!srcPrice) return;
  const type = el.dataset.applyType;
  const ri   = parseInt(el.dataset.applyRi);
  const code = el.dataset.applyCode;
  const spb  = parseFloat(el.dataset.applySpb || 1);
  const bk   = el.dataset.applyBk;
  const sk   = el.dataset.applySk;
  _qqUpdatePrice(type, ri, code, spb, bk, sk, true, srcPrice);
}

// ── Silent auto-save (no toast) — called after customer confirm + each room add ─
let _qqAutoSaveTimer = null;
async function _qqAutoSave() {
  // Debounce — wait 1.5s after last call to avoid rapid DB writes
  if (_qqAutoSaveTimer) clearTimeout(_qqAutoSaveTimer);
  await new Promise(res => { _qqAutoSaveTimer = setTimeout(res, 1500); });
  if (!_qqData?.customer?.name?.trim()) return;
  const fy = getFinancialYearLabel();
  const profile = VW_AUTH.getCurrentProfile();

  // Rebuild tile_selections and quoted_prices from current state
  // (saves real tile data — not empty objects that wipe price data on auto-save)
  const tileSelectionsAS = {};
  const quotedPricesAS = {};
  let totalSqftAS = 0, totalBoxesAS = 0;
  (_qqData.rooms || []).forEach((r, ri) => {
    ['floor', 'wall'].forEach(surface => {
      const design = surface === 'floor' ? r.floorDesign : r.wallDesign;
      if (!design?.pattern?.length || !design.tileMap) return;
      const type = surface === 'floor' ? 'fl' : 'wl';
      [...new Set(design.pattern)].forEach(code => {
        const tile = design.tileMap[code];
        if (!tile) return;
        const codeLower = code.toLowerCase().replace(/[^a-z0-9]/g, '');
        const slotId = 'qq' + ri + '_' + surface + '_' + codeLower;
        tileSelectionsAS[slotId] = { tile_name: tile.name, brand: tile.brand||'', productId: tile.id, size: { mm: design.size, tilesPerBox: tile.tiles_per_box || 6 } };
        const boxP  = window['qqprice_' + type + '_' + ri + '_' + code] || 0;
        const sqftP = window['qqprice_' + type + '_sqft_' + ri + '_' + code] || 0;
        if (boxP > 0) quotedPricesAS[slotId] = { pricePerBox: boxP, pricePerSqft: sqftP };
      });
    });
  });

  const payload = {
    customer_name: _qqData.customer.name,
    customer_phone: _qqData.customer.phone || '',
    customer_id: _qqData.customer.id || null,
    site_address: _qqData.customer.site || '',
    rooms: _qqData.rooms || [],
    tile_selections: tileSelectionsAS,
    quoted_prices: quotedPricesAS,
    total_area_sqft: totalSqftAS,
    total_boxes: totalBoxesAS,
    breakage_pct: 10,
    draft_step: 8,
    updated_at: new Date().toISOString(),
  };

  try {
    if (_qqData._qqId) {
      await VW_DB.client.from('tile_quotations').update(payload).eq('id', _qqData._qqId);
    } else {
      const { data: qqSeq, error: qqSeqErr } = await VW_DB.client.rpc('get_next_seq', { p_fy: fy, p_type: 'qq' });
      const tqNo = `QQ/${fy}/${String(qqSeq||1).padStart(4,'0')}`;
      const { data, error } = await VW_DB.client.from('tile_quotations').insert({
        ...payload,
        tq_no: tqNo,
        source: 'quick_quote',
        status: 'draft',
        approval_status: 'draft',
        created_by: profile?.name || '',
        created_by_id: profile?.id || null,
        created_at: new Date().toISOString(),
      }).select('id').single();
      if (!error && data?.id) {
        _qqData._qqId = data.id;
        _qqData._tqNo = tqNo;
        const titleEl = document.querySelector('#bottom-sheet .sheet-title');
        if (titleEl && tqNo) titleEl.textContent = titleEl.textContent + ' · ' + tqNo;
      }
    }
  } catch(e) { /* silent — auto-save failure is non-critical */ }
}

// Alias — silent auto-save triggered from room add/edit
async function _qqSaveEstimate() {
  try {
    const payload = await _qqBuildPayload();
    if (!payload) return;

    const fy = getFinancialYearLabel();
    const profile = VW_AUTH.getCurrentProfile();
    let savedTqNo = '';

    if (_qqData._qqId) {
      const { error } = await VW_DB.client.from('tile_quotations').update({
        ...payload, updated_at: new Date().toISOString()
      }).eq('id', _qqData._qqId);
      if (error) throw error;
      savedTqNo = _qqData._tqNo || '';
    } else {
      const { data: qqSeqS } = await VW_DB.client.rpc('get_next_seq', { p_fy: fy, p_type: 'qq' });
      const tqNo = `QQ/${fy}/${String(qqSeqS||1).padStart(4,'0')}`;
      const { data, error } = await VW_DB.client.from('tile_quotations').insert({
        ...payload,
        tq_no: tqNo,
        source: 'quick_quote',
        status: 'draft',
        approval_status: 'draft',
        created_by: profile?.name || '',
        created_by_id: profile?.id || null,
        created_at: new Date().toISOString(),
      }).select('id').single();
      if (error) throw error;
      _qqData._qqId = data.id;
      _qqData._tqNo = tqNo;
      savedTqNo = tqNo;
    }

    // Close sheet, navigate to dashboard, then show toast on the fresh page
    closeSheet();
    delete _pageCache['dashboard']; delete _pageCacheTTL['dashboard'];
    await navigateTo('dashboard');
    showToast('✓ Estimate saved · ' + savedTqNo, 'success');

  } catch(e) {
    console.error('_qqSaveEstimate error:', e);
    showToast('Save failed: ' + (e?.message || String(e)), 'error');
  }
}

// ── Map QQ room data → TQ wizard tileSelections + quotedPrices format ─────────
// Called during convert so the TQ wizard opens with sizes, tiles, and prices pre-filled
function _qqToTQSelections(rooms) {
  const tileSelections = {};
  const quotedPrices   = {};

  rooms.forEach((room, ri) => {
    const rid    = 'qq' + ri;
    const surf   = room.surface; // 'floor', 'wall', 'both'
    const isBoth = surf === 'both';

    // ── FLOOR ──
    if ((surf === 'floor' || isBoth) && room.floorDesign?.size) {
      const fd     = room.floorDesign;
      const slotId = isBoth ? rid + '_floor' : rid;
      const codes  = [...new Set(fd.pattern || [])];
      const firstCode = codes[0];
      const firstTile = firstCode ? fd.tileMap?.[firstCode] : null;

      tileSelections[slotId] = {
        sizeMm: fd.size, sizeLabel: fd.size, slotId, roomId: rid, subType: 'floor',
        size: { mm: fd.size, tilesPerBox: firstTile?.tiles_per_box || 4 },
        ...(firstTile ? { selectedTileId: firstTile.id, name: firstTile.name,
          brand: firstTile.brand, pricePerSqft: firstTile.price_per_sqft || 0 } : {}),
      };
      const bk  = `qqprice_fl_${ri}_${firstCode}`;
      const sk  = `qqprice_fl_sqft_${ri}_${firstCode}`;
      const boxP = window[bk] || 0;
      const sqfP = window[sk] || firstTile?.price_per_sqft || 0;
      if (boxP > 0 || sqfP > 0) quotedPrices[slotId] = { pricePerBox: boxP, pricePerSqft: sqfP };
    }

    // ── WALL ──
    if ((surf === 'wall' || isBoth) && room.wallDesign?.size) {
      const wd     = room.wallDesign;
      const slotId = isBoth ? rid + '_wall' : rid;
      const codes  = [...new Set(wd.pattern || [])];
      const firstCode = codes[0];
      const firstTile = firstCode ? wd.tileMap?.[firstCode] : null;

      tileSelections[slotId] = {
        sizeMm: wd.size, sizeLabel: wd.size, slotId, roomId: rid, subType: 'wall',
        size: { mm: wd.size, tilesPerBox: firstTile?.tiles_per_box || 6 },
        ...(firstTile ? { selectedTileId: firstTile.id, name: firstTile.name,
          brand: firstTile.brand, pricePerSqft: firstTile.price_per_sqft || 0 } : {}),
      };
      const bk  = `qqprice_wl_${ri}_${firstCode}`;
      const sk  = `qqprice_wl_sqft_${ri}_${firstCode}`;
      const boxP = window[bk] || 0;
      const sqfP = window[sk] || firstTile?.price_per_sqft || 0;
      if (boxP > 0 || sqfP > 0) quotedPrices[slotId] = { pricePerBox: boxP, pricePerSqft: sqfP };
    }
  });

  return { tileSelections, quotedPrices };
}

// ── Convert Quick Quote → Full Tile Quotation (with full TQ wizard) ───────────
async function _qqConvertToFullTQ() {
  const d = _qqData;
  if (!d?.rooms?.length) { showToast('No rooms — go back and add rooms', 'warn'); return; }
  if (!d.customer?.name?.trim()) { showToast('Enter customer name first', 'warn'); return; }

  // Save the QQ first if not yet saved
  if (!d._qqId) {
    await _qqSaveEstimate();
    if (!d._qqId) return; // save failed
  }

  const qqId = d._qqId;
  const fy = getFinancialYearLabel();
  const profile = VW_AUTH.getCurrentProfile();

  const payload = await _qqBuildPayload();
  if (!payload) return;

  try {
    // Get next sequential TQ number
    let tqNo;
    const { data: tqSeqC, error: seqErr } = await VW_DB.client.rpc('get_next_seq', { p_fy: fy, p_type: 'tq' });
    if (seqErr || !tqSeqC) {
      showToast('Could not get TQ number: ' + (seqErr?.message||'RPC failed'), 'error');
      return;
    }
    tqNo = `TQ/${fy}/${String(tqSeqC).padStart(4,'0')}`;

    // Map QQ room data → TQ wizard slot format so tiles, sizes & prices carry forward
    const tqSels = _qqToTQSelections(_qqData.rooms);

    // Transform QQ-shaped rooms → TQ-wizard-shaped rooms.
    // The TQ wizard (_getTileSlots, _renderStep2, tqSubmitForApproval) requires rooms
    // with { id, areas:[{sqft, subType}], def:{areaType} }. QQ rooms lack these, which
    // made every slot id "undefined", broke the carried-forward tile matching, zeroed
    // all totals, and caused Submit for Approval to fail on converted quotations.
    // Room ids MUST be 'qq'+index to match the slot ids _qqToTQSelections generates.
    const tqRooms = _qqData.rooms.map((room, ri) => {
      const areas = [];
      // Floor area — mirrors _qqSqft floor math (sqft mode or l×w + skirting)
      if (room.surface === 'floor' || room.surface === 'both') {
        let fsq = 0;
        if (room.mode === 'sqft') fsq = parseFloat(room.sqft) || 0;
        else {
          const l = parseFloat(room.l) || 0, w = parseFloat(room.w) || 0;
          fsq = l * w;
          if (room.skirtingIn > 0) fsq += 2 * (l + w) * (room.skirtingIn / 12);
        }
        if (fsq > 0) areas.push({ sqft: Math.round(fsq * 10) / 10, subType: 'floor' });
      }
      // Wall area — mirrors _qqSqft wall math (wl×wh − door)
      if (room.surface === 'wall' || room.surface === 'both') {
        const wl = parseFloat(room.wl) || 0, wh = parseFloat(room.wh) || 0;
        const dw = room.hasDoor === true && room.type !== 'Kitchen' ? parseFloat(room.dw) || 0 : 0;
        const dh = room.hasDoor === true && room.type !== 'Kitchen' ? parseFloat(room.dh) || 0 : 0;
        const wsq = Math.max(0, wl * wh - dw * dh);
        if (wsq > 0) areas.push({ sqft: Math.round(wsq * 10) / 10, subType: 'wall' });
      }
      return {
        ...room,                                  // keep QQ fields (floorDesign/wallDesign/etc.)
        id: 'qq' + ri,                            // matches _qqToTQSelections slot ids
        label: room.label || room.type,
        def: { areaType: room.surface },
        areas,
      };
    });

    // Create the Full TQ record with TQ-compatible tile data
    const { data: newTQ, error } = await VW_DB.client.from('tile_quotations').insert({
      customer_name: _qqData.customer.name,
      customer_phone: _qqData.customer.phone || '',
      customer_id: _qqData.customer.id || null,
      site_address: _qqData.customer.site || '',
      rooms: tqRooms,                         // TQ-wizard-shaped rooms (id + areas + def)
      tile_selections: tqSels.tileSelections, // TQ-format: slot IDs the wizard expects
      quoted_prices: tqSels.quotedPrices,     // TQ-format: price per room surface
      total_area_sqft: payload.total_area_sqft,
      total_boxes: payload.total_boxes,
      grand_total: payload.grand_total,
      breakage_pct: 10,
      tq_no: tqNo,
      source: 'full_tq',
      converted_from_qq_id: qqId,
      status: 'draft',
      approval_status: 'draft',
      draft_step: 2, // open at Step 2 — tile sizes already pre-selected from QQ
      created_by: profile?.name || '',
      created_by_id: profile?.id || null,
      created_at: new Date().toISOString(),
    }).select('id').single();
    if (error) throw error;

    // Delete the QQ record
    const { error: delErr } = await VW_DB.client.from('tile_quotations').delete().eq('id', qqId);
    if (!delErr) {
      _qqData._qqId = null;
      delete _pageCache['tile_quotes']; delete _pageCacheTTL['tile_quotes'];
    }

    // Open TQ wizard — rooms carry over, tiles need re-selection in TQ wizard
    closeSheet();
    showToast(`Converted → ${tqNo} · Rooms, tiles & prices carried forward`, 'success');
    _tqState = { ..._tqState, _fromQQConvert: true };
    tqResumeDraft(newTQ.id);
  } catch (e) {
    showToast('Conversion failed: ' + e.message, 'error');
  }
}

// ── Build the common data payload from _qqData (shared by save + convert) ─────
async function _qqBuildPayload() {
  try {
  const d = _qqData;
  const nameEl = document.getElementById('qq-cust-name');
  if (nameEl?.value?.trim()) d.customer.name = nameEl.value.trim();

  if (!d?.rooms?.length) { showToast('No rooms added', 'warn'); return null; }
  if (!d.customer?.name?.trim()) {
    showToast('Enter customer name first', 'warn');
    document.getElementById('qq-cust-name')?.focus();
    return null;
  }

  const rooms = [];
  const tileSelections = {}, quotedPrices = {};
  let totalSqft = 0, totalBoxes = 0;

  d.rooms.forEach((r, ri) => {
    const rid = 'qq' + ri; // stable across saves — no timestamp drift
    const areas = [];
    if ((r.surface==='floor'||r.surface==='both') && r.floorDesign?.pattern?.length) {
      let sqft;
      if (r.mode==='sqft') { sqft = parseFloat(r.sqft)||0; }
      else { const l=parseFloat(r.l)||0,w=parseFloat(r.w)||0; sqft=l*w; if(r.skirtingIn>0) sqft+=2*(l+w)*(r.skirtingIn/12); }
      if (sqft > 0) {
        areas.push({ subType:'floor', sqft, base:sqft, label:'Floor', l:parseFloat(r.l)||0, w:parseFloat(r.w)||0, wastage:0 });
        const mainTile = r.floorDesign.tileMap[r.floorDesign.pattern[0]];
        if (mainTile) {
          const [mmH,mmW] = r.floorDesign.size.split('×').map(Number);
          const spf = tileSqftPerTile(mmH, mmW);
          const cfg = (_tqSizeCfg?.sizes||[]).find(s=>s.mm===r.floorDesign.size);
          const tpb = cfg?.tiles_per_box || mainTile.tiles_per_box || 6;
          const spb = spf*tpb;
          // Use UNIQUE codes only — iterating pattern directly causes box explosion
          // (e.g. L:L:L:HL1:D:D creates 5 slots instead of 3 unique-code slots)
          const fc = _qqCalcFloor(r, r.floorDesign);
          if (!fc) return;
          [...new Set(r.floorDesign.pattern)].forEach(code => {
            const tile = r.floorDesign.tileMap[code];
            if (!tile) return;
            const result = fc.results?.[code];
            if (!result) return;
            const slotId = rid + '_floor_' + code.toLowerCase().replace(/[^a-z0-9]/g,'');
            const boxKey = 'qqprice_fl_' + ri + '_' + code;
            const boxP = window[boxKey] || 0;
            tileSelections[slotId] = { tile_name:tile.name, brand:tile.brand||'', productId:tile.id, size:{mm:r.floorDesign.size, tilesPerBox:tpb}, _qqBoxes:result.boxes };
            if (boxP > 0) quotedPrices[slotId] = { pricePerBox:boxP, pricePerSqft:spb>0?+(boxP/spb).toFixed(1):0 };
            totalBoxes += result.boxes;
          });
          totalSqft += sqft;
        }
      }
    }
    if ((r.surface==='wall'||r.surface==='both') && r.wallDesign?.pattern?.length) {
      const wl=parseFloat(r.wl)||0, wh=parseFloat(r.wh)||7;
      const dw=r.hasDoor===true?parseFloat(r.dw)||0:0, dh=r.hasDoor===true?parseFloat(r.dh)||0:0;
      const base = Math.max(0, wl*wh - dw*dh);
      if (base > 0) {
        areas.push({ subType:'wall', sqft:base, base, label:'Wall', l:wl, h:wh, dw, dh, mode:'full', wastage:0 });
        // Use UNIQUE codes only — iterating full pattern causes box explosion
        // e.g. L:L:L:HL1:D:D:D would create 6 slots instead of 3 unique-code slots
        const wc = _qqCalcWall(wl, wh, r.hasDoor===true, dw, dh, r.wallDesign);
        const [mmHw,mmWw] = r.wallDesign.size.split('\u00d7').map(Number);
        const spfw=tileSqftPerTile(mmHw, mmWw);
        const cfgw=(_tqSizeCfg?.sizes||[]).find(s=>s.mm===r.wallDesign.size);
        if (wc) [...new Set(r.wallDesign.pattern)].forEach(code => {
          const tile = r.wallDesign.tileMap[code];
          if (!tile) return;
          const result = wc.results?.[code];
          if (!result) return;
          const tpbw=cfgw?.tiles_per_box||tile.tiles_per_box||6;
          const spbw=spfw*tpbw;
          const slotId = rid + '_wall_' + code.toLowerCase().replace(/[^a-z0-9]/g,'');
          const wBoxKey = 'qqprice_wl_' + ri + '_' + code;
          const wBoxP = window[wBoxKey] || 0;
          tileSelections[slotId] = { tile_name:tile.name, brand:tile.brand||'', productId:tile.id, size:{mm:r.wallDesign.size, tilesPerBox:tpbw}, _qqBoxes:result.boxes };
          if (wBoxP > 0) quotedPrices[slotId] = { pricePerBox:wBoxP, pricePerSqft:spbw>0?+(wBoxP/spbw).toFixed(1):0 };
          totalBoxes += result.boxes;
        });
        totalSqft += base;
      }
    }
    rooms.push({ id:rid, type:r.type, label:r.label||r.type, surface:r.surface, areas, l:r.l, w:r.w, wl:r.wl, wh:r.wh, hasDoor:r.hasDoor===true, dw:r.dw, dh:r.dh, skirtingIn:r.skirtingIn, mode:r.mode, sqft:r.sqft, floorDesign:r.floorDesign, wallDesign:r.wallDesign });
  });

  // Grand total estimate
  let grandTotal = 0;
  Object.entries(quotedPrices).forEach(([slotId, qp]) => {
    const sel = tileSelections[slotId];
    if (sel?._qqBoxes && qp.pricePerBox) grandTotal += sel._qqBoxes * qp.pricePerBox;
  });

  return {
    customer_name: d.customer.name,
    customer_phone: d.customer.phone || '',
    customer_id: d.customer.id || null,
    site_address: d.customer.site || '',
    rooms,
    tile_selections: tileSelections,
    quoted_prices: quotedPrices,
    total_area_sqft: totalSqft,
    total_boxes: totalBoxes,
    grand_total: grandTotal > 0 ? Math.round(grandTotal) : null,
    breakage_pct: 10,
    draft_step: 8,
    updated_at: new Date().toISOString(),
  };
  } catch(e) {
    console.error('_qqBuildPayload error:', e);
    showToast('Could not build payload: ' + (e?.message || String(e)), 'error');
    return null;
  }
}



// Jump from Summary back to Step 0 (Customer/Contractor) for editing
async function _tqEditCustomerFromSummary() {
  _tqState.step = 0;
  const content = document.getElementById('tq-step-content');
  if (content) content.innerHTML = await _renderStep0();
  _updateStepHeader();
  window.scrollTo(0,0);
}

window.VW_TILES = {
  // New tiles quotation
  renderTilesQuotationPage, tqNext, tqBack, linkContractor, linkContractorById, unlinkContractor, setContractorCommission, addAndLinkContractor, sendCustomerRegistrationLink, _onCustPhoneInput, searchCustomerByPhone, _clearCustomer, _saveNewCustomer, _updateStep0NextBtn, _debouncedContractorSearch, _showAddContractorForm, _sendContractorRegLink, selectGroutColour, _updateQuotedPrice, _updatePriceNote, _renderWallVisualizer, _redesignWall,
  // Rooms
  tqAddRoom, tqSelectRoomType, tqPickRoomType, _autoSkirting, _skirtingManualClear, _setSkirtHeight, tqSaveRoom, tqEditRoom, tqAddArea, tqSaveExtraArea, tqRemoveRoom, _tqWallMode,
  tqSelectSizeForRoom, tqNextRoom, tqSetSpacerForRoom, tqSetSpacerMmForRoom, tqSetSpacerType, setAdhMethodForRoom, tqSetBeadPcs,
  setGroutTypeForSlot, setGroutColorForSlot,
  tqAdjClipPkts, tqAdjBushPkts,
  tqAddDirectSqft,
  tqSelectSize, tqSetSpacer, tqSetSpacerMm,
  tqToggleBead, tqSetBeadRm, tqSkipBeading, tqSkipAdhesive, tqCheckAddonStock, tqSearchInventory, tqAddInventoryProduct, tqSetExtraQty, tqRemoveExtra,
  setAddonTab,
  tqSelectProduct,
  tqSetGroutType, tqSetGroutColor,
  // Floor trap + soffit
  tqToggleTrap, tqSetTrapQty, tqToggleSoffit, tqSelectSoffit,
  // Actions
  tqSharePDF, tqPrint, tqSaveQuote, tqSubmitForApproval, _tqRequestEdit,
  tqConvertToInvoice,
  tqEditQuote, tqConfirmEditQuote, _tqBuildApprovalBOM,
  tqApprove, tqReject, tqConfirmReject,
  tqCollectAdvance, tqConfirmAdvance, tqPrintAdvanceReceipt, tqReprintReceipt,
  _tqCheckMaterialStock, _tqGetMaterialsList, _tqCreateMaterialIntents, _tqRenderMaterialsCard,
  openQuickQuote, _qqLoadPriceHistory, _qqEnsureCustomer, _qqSaveEstimate, _qqConvertToFullTQ, _qqBuildPayload,
  qqEditExisting, qqConvertExisting, qqDeleteEstimate, _qqScreen, _qqPhoneInput, _qqSearchPhone, _qqClearCustomer, _qqFromCustomer,
  _qqSet, _qqSetV, _qqPick, _qqSave, _qqCancelAdd, _qqRm, _qqEditRoom,
  _qqPref: ()=>{}, _qqMatchTiles: ()=>{}, _qqShowMatch: ()=>{}, _qqToggle: ()=>{}, _qqApply: ()=>{}, // legacy stubs
  _qqDesignTile, _qqPickDesignSize, _qqPatternLive, _qqConfirmPattern,
  _qqAssignSearch, _qqAssignFilter, _qqAssignTile, _qqAssignNext, _qqAssignBack,
  _qqAutoSave,
  _qqShowOutput, _qqUpdatePrice, _qqRecomputeTotals, _qqUpdateHints, _qqApplyHint,
  _tqEditCustomerFromSummary,
  renderTileQuotesList, openTileQuote, tqPrintFromId,
  toggleAddon, setLaborRequired, postLaborFromQuotation,
  // Delivery + floor
  setDeliveryType, setLoadingType, addFloorLine, removeFloorLine, setFloorLine, calcDeliveryDistance, calcDeliveryDistanceFromAddress, _rerenderStep8,
  // Inventory
  renderTileInventoryAddForm, onTileSizeChange, calcCoverage, injectTileFields, tqReadFloorPlan, openTileVisualizer, tqAiVisualize, tqAiDescribe, _showAllSizesForSlot, _getTileSlots, _getWallGrid, _renderWallDesignPlanner, _selectPaint, _paintCell, _setWallOrient, _fillAll, _fillRow, _fillCol, _setDesignBoxes, _confirmWallDesign, _skipWallDesign,
  _renderStepDesign, _renderStepAddons, _rerenderStepAddons, _dsTogglePalette, _dsSetActive, _dsPaint, _dsFillAll, _dsCopyCol1, _dsOrient, _dsBoxes, _dsToggleBreakage, _dsSetBreakage, _dsPrice, _dsPriceLive, _dsBoxPrice, _dsBoxPriceLive, _dsEditSizes, _dsContinue, _dsPrev,
  // Granite
  renderGraniteQuotationPage, addGranitePiece, updateGraniteItem,
  removeGranitePiece, generateGraniteQuote,
  // Shared
  lookupTileCustomer, lookupTileCustomerFull,
  forwardToExecutive,
  confirmAddAccessories: async () => {},
  // Quotation history
  saveQuoteHistory, renderTileQuoteHistory,
  // Stock hold + pre-order
  placeStockHold, releaseStockHold, extendStockHold, renderHoldAlerts, placePreOrder,
  renderAdvanceSection, collectAdvance,
  // Hold reminders
  scheduleHoldReminders, checkAndSendHoldReminders,
};

// Export key constants to window for use in tests and tile_inventory module
window.TILE_SIZES = TILE_SIZES;
window.ADHESIVE_TYPES = ADHESIVE_TYPES;
window.BEADING_CATALOG = BEADING_CATALOG;
window.ROOM_DEFS = ROOM_DEFS;

// Tiles have their own inventory (size/finish/photo/coverage + rack-shelf stock).
// In the general product form, selecting Tiles redirects to that dedicated flow
// rather than mixing tile fields in here.
function injectTileFields(category) {
  const el = document.getElementById('np-tile-fields');
  if (!el) return;
  if ((category||'').toLowerCase().includes('tile')) {
    el.innerHTML = `
    <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin:8px 0">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px">🔲 Tiles use a dedicated inventory</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Tiles need size, finish, coverage, photo and rack/shelf stock — add them in Tile Stock for accurate quoting, not the general product form.</div>
      <button type="button" class="btn-primary" style="padding:7px 12px" onclick="closeSheet(); navigateTo('tile_inventory');">Go to Tile Stock →</button>
    </div>`;
  } else {
    el.innerHTML = '';
  }
}

// =====================================================
// QUOTATION HISTORY (edit tracking)
// =====================================================
async function saveQuoteHistory(tileQuoteId, action, notes) {
  const profile = VW_AUTH.getCurrentProfile();
  const snap = JSON.parse(JSON.stringify(_tqState)); // deep copy snapshot
  try {
    await VW_DB.client.from('quotation_history').insert({
      tile_quotation_id: tileQuoteId,
      action, notes: notes||'',
      changed_by_name: profile?.name||'',
      changed_by_role: profile?.role||'',
      snapshot: snap,
    });
  } catch(e) { /* silent */ }
}

async function renderTileQuoteHistory(tileQuoteId) {
  const { data } = await VW_DB.client.from('quotation_history')
    .select('*').eq('tile_quotation_id', tileQuoteId)
    .order('changed_at', { ascending: false });
  const history = data || [];
  const icons = { created:'✏️', edited:'🔄', approved:'✅', converted:'🧾', cancelled:'❌', hold_placed:'🔒', hold_released:'🔓' };
  return history.map(h=>`
  <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:18px;flex-shrink:0">${icons[h.action]||'📋'}</span>
    <div>
      <div style="font-size:12px;font-weight:600">${h.action.replace(/_/g,' ')}</div>
      <div style="font-size:11px;color:var(--text3)">${h.changed_by_name} (${h.changed_by_role}) · ${new Date(h.changed_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</div>
      ${h.notes?`<div style="font-size:11px;color:var(--text2)">${h.notes}</div>`:''}
    </div>
  </div>`).join('') || '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px">No history yet</div>';
}

// =====================================================
// STOCK HOLD (advance payment blocks selected tiles)
// =====================================================
async function placeStockHold(tileQuoteId, advanceAmount) {
  const st = _tqState;
  const prod = st.selectedProduct;
  if (!prod || !advanceAmount) { showToast('Select a tile and enter advance amount','warn'); return; }
  const holdUntil = new Date(Date.now() + 90*24*60*60*1000).toISOString();
  const profile = VW_AUTH.getCurrentProfile();

  const { data, error } = await VW_DB.client.from('stock_holds').insert({
    tile_quotation_id: tileQuoteId,
    product_id: prod.id||null,
    product_name: `${prod.brand||''} ${prod.name||''}`,
    boxes_held: prod.reqBoxes||0,
    customer_name: st.customer.name,
    customer_phone: st.customer.phone,
    advance_amount: advanceAmount,
    advance_received_at: new Date().toISOString(),
    hold_expires_at: holdUntil,
    status: 'active',
    created_by: profile?.name||'',
  }).select().single();

  if (error) { showToast('Error placing hold: '+error.message,'error'); return; }

  // Update tile quotation with hold info
  await VW_DB.client.from('tile_quotations').update({
    advance_amount: advanceAmount,
    advance_received_at: new Date().toISOString(),
    hold_active: true,
    hold_expires_at: holdUntil,
  }).eq('id', tileQuoteId);

  // Save to history
  await saveQuoteHistory(tileQuoteId, 'hold_placed', `Advance ₹${advanceAmount} · Hold until ${new Date(holdUntil).toLocaleDateString('en-IN')}`);

  showToast(`Stock held for 90 days ✓ — ${prod.reqBoxes} boxes of ${prod.name} blocked for ${st.customer.name}`, 'success');
  return data;
}

async function releaseStockHold(holdId, reason) {
  await VW_DB.client.from('stock_holds').update({
    status: 'released',
    released_by: VW_AUTH.getCurrentProfile()?.name||'',
    released_at: new Date().toISOString(),
    release_reason: reason||'management_released',
  }).eq('id', holdId);
  showToast('Stock hold released ✓', 'success');
}

// Dashboard alert for SM/Management — holds expiring or > 90 days
async function renderHoldAlerts() {
  const ninetyDaysAgo = new Date(Date.now() - 90*24*60*60*1000).toISOString();
  const { data: expiredHolds } = await VW_DB.client.from('stock_holds')
    .select('*').eq('status','active').lt('hold_expires_at', new Date().toISOString());
  const { data: expiringHolds } = await VW_DB.client.from('stock_holds')
    .select('*').eq('status','active')
    .gte('hold_expires_at', new Date().toISOString())
    .lte('hold_expires_at', new Date(Date.now()+7*24*60*60*1000).toISOString());

  const all = [...(expiredHolds||[]), ...(expiringHolds||[])];
  if (!all.length) return '';

  return `
  <div class="alert-card" style="margin-bottom:10px;border-color:rgba(239,68,68,0.4)">
    <div class="alert-title">🔒 ${all.length} Stock Hold${all.length>1?'s':''} Need Attention</div>
    ${all.map(h=>{
      const expired = new Date(h.hold_expires_at) < new Date();
      return `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;font-weight:600">${h.customer_name||'—'} · ${h.product_name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${h.boxes_held} boxes · Advance: ₹${(h.advance_amount||0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px;color:${expired?'var(--red)':'var(--gold)'}">${expired?'⚠️ Expired':'⏰ Expiring'}: ${new Date(h.hold_expires_at).toLocaleDateString('en-IN')}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="VW_TILES.releaseStockHold(${h.id},'management_released')" style="font-size:11px;background:none;border:1px solid var(--red);border-radius:6px;padding:3px 8px;color:var(--red);cursor:pointer">Release</button>
          <button onclick="VW_TILES.extendStockHold(${h.id})" style="font-size:11px;background:none;border:1px solid var(--green);border-radius:6px;padding:3px 8px;color:var(--green);cursor:pointer">Extend</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

async function extendStockHold(holdId) {
  const newExpiry = new Date(Date.now() + 90*24*60*60*1000).toISOString();
  await VW_DB.client.from('stock_holds').update({ hold_expires_at: newExpiry }).eq('id', holdId);
  showToast('Hold extended by 90 days ✓', 'success');
  document.getElementById('app-content').innerHTML = await renderDashboard();
}

// =====================================================
// PRE-ORDER (out-of-stock demand capture)
// =====================================================
async function placePreOrder(productInfo) {
  const st = _tqState;
  const { data, error } = await VW_DB.client.from('pre_orders').insert({
    product_name: productInfo.name||'',
    tile_size: productInfo.size||'',
    brand: productInfo.brand||'',
    finish: productInfo.finish||'',
    boxes_requested: productInfo.boxes||1,
    customer_name: st.customer.name,
    customer_phone: st.customer.phone,
    executive_name: VW_AUTH.getCurrentProfile()?.name||'',
    status: 'pending',
    notes: `Pre-order from tile quotation. Customer: ${st.customer.name}`,
  }).select().single();
  if (error) { showToast('Error: '+error.message,'error'); return; }
  showToast(`Pre-order placed ✓ — we'll notify ${st.customer.name} when stock arrives`, 'success');
  return data;
}

// =====================================================
// ADVANCE PAYMENT SHEET (shown in Step 8)
// =====================================================
function renderAdvanceSection(savedQuoteId) {
  // Advance is now only allowed AFTER management approval chain
  // Cashier collects advance via TQ List → openTileQuote → tqCollectAdvance
  return `
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px;color:var(--text2)">
    💡 Advance collection is handled by Cashier / Accounts after this quotation is approved by management. Go to <strong>More → TQ List</strong> to track approval status.
  </div>`;
}

async function collectAdvance(tileQuoteId) {
  // Legacy stub — redirect to proper cashier flow
  showToast('Use TQ List → open the approved quote → Collect Advance', 'info');
}


// =====================================================
// HOLD REMINDERS — Inventory reminder to exec + customer
// =====================================================
async function scheduleHoldReminders(holdId, custPhone, execName, productName, custName, holdExpiry) {
  const now = new Date();
  const expiry = new Date(holdExpiry);

  // Schedule reminder milestones
  const milestones = [
    { days: 30, type: '30d', label: '30-day check-in' },
    { days: 60, type: '60d', label: '60-day follow-up' },
    { days: 85, type: '85d', label: '5-day warning' },
    { days: 90, type: '90d', label: 'Expiry reminder' },
  ];

  for (const m of milestones) {
    const reminderDate = new Date(now.getTime() + m.days * 24 * 60 * 60 * 1000);
    if (reminderDate < expiry || m.days === 90) {
      await VW_DB.client.from('hold_reminders').insert({
        hold_id: holdId,
        reminder_type: m.type,
        next_reminder_at: reminderDate.toISOString(),
        sent_to_exec: false, sent_to_customer: false,
      });
    }
  }
}

async function checkAndSendHoldReminders() {
  const now = new Date().toISOString();
  const { data: due } = await VW_DB.client.from('hold_reminders')
    .select('*, stock_holds(*)').lte('next_reminder_at', now)
    .eq('sent_to_exec', false).limit(10);

  if (!due?.length) return;

  for (const reminder of due) {
    const hold = reminder.stock_holds;
    if (!hold) continue;

    const daysLeft = Math.max(0, Math.floor((new Date(hold.hold_expires_at) - new Date()) / (1000*60*60*24)));
    const isExpiring = daysLeft <= 5;
    const isExpired = daysLeft <= 0;

    // In-app notification to exec
    try {
      await VW_DB.client.from('notifications').insert({
        recipient_role: 'executive',
        title: isExpired ? '⚠️ Stock Hold Expired' : `🔒 Hold Reminder — ${daysLeft}d left`,
        body: `${hold.customer_name}: ${hold.boxes_held} boxes of ${hold.product_name} hold ${isExpired?'has expired!':isExpiring?'expires in '+daysLeft+' days!':'check in needed'}`,
        type: 'hold_reminder', reference_id: hold.id, read: false,
        created_at: new Date().toISOString(),
      });
    } catch(e) {}

    // WhatsApp to customer (exec-initiated)
    if (hold.customer_phone && isExpiring) {
      const waMsg = encodeURIComponent(
        `*V Wholesale — Your Tile Booking Reminder* 🏠\n\n` +
        `Dear ${hold.customer_name},\n\n` +
        `Your tile selection is ${isExpired?'expired':'expiring in '+daysLeft+' days'}:\n` +
        `📦 ${hold.boxes_held} boxes of ${hold.product_name}\n` +
        `💰 Advance paid: ₹${(hold.advance_amount||0).toLocaleString('en-IN')}\n\n` +
        (isExpired?
          `The hold period has ended. Please contact us to renew or convert to invoice.\n\n`:
          `Please visit us soon to confirm your order before the hold expires.\n\n`) +
        `📞 V Wholesale: 8712697930 · Vijayawada`
      );
      // Note: This opens WA for exec to send — not auto-sent
      console.log('Hold reminder WA ready for:', hold.customer_phone, 'msg length:', waMsg.length);
    }

    // Mark as sent
    await VW_DB.client.from('hold_reminders').update({
      sent_to_exec: true, sent_at: new Date().toISOString()
    }).eq('id', reminder.id);
  }
}

// Auto-check reminders every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(checkAndSendHoldReminders, 30*60*1000);
}


// ===== ENHANCED CUSTOMER LOOKUP WITH OWNERSHIP WARNING =====
// Override the previous lookupTileCustomer with full version
async function lookupTileCustomerFull(phone, prefix, showOwnershipWarning) {
  const digits = (phone||'').replace(/\D/g,'');
  if (digits.length < 10) return;
  const last10 = digits.slice(-10);
  const el = document.getElementById(`${prefix}-cust-lookup`);
  const ownerWarn = document.getElementById(`${prefix}-ownership-warning`);
  if (el) el.innerHTML = `<span style="color:var(--text3)">Searching...</span>`;

  let found = null;
  try {
    // Try exact match on last 10 digits first
    const { data: exact } = await VW_DB.client.from('customers')
      .select('id,name,phone,address,area,city,total_spend,assigned_to,assigned_to_name')
      .or(`phone.eq.${last10},phone.ilike.%${last10}`)
      .limit(5);
    if (exact?.length) {
      // Pick best match — exact phone match preferred
      found = exact.find(c => (c.phone||'').replace(/\D/g,'').endsWith(last10)) || exact[0];
    }
  } catch(e) {
    console.log('Supabase lookup error:', e.message);
  }

  // Fallback to IndexedDB if Supabase returned nothing
  if (!found) {
    try {
      const local = await VW_DB.all(VW_DB.STORES.customers);
      found = local.find(c => (c.phone||'').replace(/\D/g,'').endsWith(last10));
    } catch(e) {}
  }

  if (found) {
    // Auto-fill name (only if empty)
    const nameEl = document.getElementById(`${prefix}-cname`) || document.getElementById(`${prefix}-cust-name`);
    if (nameEl && !nameEl.value) {
      nameEl.value = found.name || '';
      if (prefix==='tq') _tqState.customer.name = found.name || '';
      else if (prefix==='gq') graniteCustomer.name = found.name || '';
    }
    // Auto-fill site
    const siteEl = document.getElementById(`${prefix}-site`);
    if (siteEl && !siteEl.value) {
      const addr = found.area || found.city || found.address || '';
      siteEl.value = addr;
      if (prefix==='tq') _tqState.customer.site = addr;
    }
    if (prefix==='tq') _tqState.customer.id = found.id;
    else if (prefix==='gq') graniteCustomer.id = found.id;

    const spend = found.total_spend || found.totalSpend || 0;
    if (el) el.innerHTML = `<span style="color:var(--green)">✓ ${found.name}</span>${spend ? ` — ₹${Math.round(spend).toLocaleString('en-IN')} spent` : ' — existing customer'}`;

    // Ownership warning
    const profile = VW_AUTH.getCurrentProfile();
    const assignedTo = found.assigned_to_name || found.assigned_to;
    const isQuotTeam = ['admin','management','store_manager','floor_manager','tl'].includes(profile?.role||'');
    if (showOwnershipWarning && ownerWarn && assignedTo && assignedTo !== profile?.name && !isQuotTeam) {
      ownerWarn.style.display = 'block';
      ownerWarn.innerHTML = `
      <div style="background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-top:6px">
        <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:4px">⚠️ Previously handled by <strong>${assignedTo}</strong></div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:8px">Continue with this quotation or forward to ${assignedTo}?</div>
        <div style="display:flex;gap:6px">
          <button onclick="document.getElementById('${prefix}-ownership-warning').style.display='none'" style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:6px;font-size:11px;cursor:pointer">Continue (Take Over)</button>
          <button onclick="VW_TILES.forwardToExecutive('${assignedTo}','${found.name}')" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer">Forward to ${assignedTo}</button>
        </div>
      </div>`;
    } else if (ownerWarn) ownerWarn.style.display = 'none';
  } else {
    if (el) el.innerHTML = `<span style="color:var(--text3)">New customer — will be saved with this quotation</span>`;
    if (ownerWarn) ownerWarn.style.display = 'none';
  }
}


async function forwardToExecutive(execName, customerName) {
  const profile = VW_AUTH.getCurrentProfile();
  // assigned_to is a bigint (staff id) and tasks route by it — resolve the name.
  const { data: execRows } = await VW_DB.client.from('staff').select('id').ilike('name', execName).limit(1);
  const execId = execRows?.[0]?.id || null;
  await VW_DB.client.from('tasks').insert({
    title:`Tile Quotation Lead — ${customerName}`,
    description:`${profile?.name||'Executive'} forwarding customer ${customerName} for tile quotation follow-up.`,
    assigned_to:execId, assigned_to_name:execName, created_by:profile?.name||'',
    department:'Tiles',
    priority:'high', status:'pending',
    due_date:new Date(Date.now()+24*60*60*1000).toISOString().split('T')[0],
    created_at:new Date().toISOString(),
  });
  await auditLog('quotation_forward','customer',null,customerName,null,{to:execName},'Customer forwarded');
  showToast(`Forwarded to ${execName} — task created`,'success');
  setTimeout(()=>navigateTo('dashboard'),1500);
}






