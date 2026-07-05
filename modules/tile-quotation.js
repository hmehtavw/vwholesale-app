async function renderTilesQuotationPage() {
  const _isResume = !!_tqResumeData;
  if (_tqResumeData) {
    _tqState = _tqResumeData; _tqResumeData = null;
  } else if (!_tqState?.rooms?.length && !_tqState?.customer?.name) {
    // Only reset to step 0 when there is genuinely nothing in progress.
    // Do NOT reset when we're re-rendering an active QQ / in-progress quote —
    // that would wipe the customer and rooms that were just set.
    _tqState = {
      step: 0,
      customer: { name:'', phone:'', site:'', id:null },
      contractor: null,
      rooms: [],
      currentFlat: '',
      tileSelections: {},
      spacerSelections: {},
      spacerType: 'plus',
      adhesiveSelections: {},
      beading: [],
      groutSelections: {},
      quotedPrices: {},
      accessories: [],
      floorTraps: [],
      soffit: {enabled:false},
      delivery: {type:'self', distanceKm:0, floors:[], beyondFt:false, siteAddress:''},
      laborRequired: null,
      addons: {},
      wallDesigns: {},
      _inWallDesign: false,
      _designSlot: null,
      currentRoomIdx: 0,
    };
  }
  // else: active quote in progress — keep _tqState as-is for re-render

  // Preload tile-size + spacer configs so the synchronous spacer step can read them
  try {
    _tqSizeCfg = await VW_DB.getSetting('tile_weight_config', { sizes:[] });
    _tqSpacerCfg = await VW_DB.getSetting('tile_spacer_config', { pcs_per_packet:100, clip_pcs_per_packet:50, spacers_per_tile:4, min_size_mm:300 });
    const _wc = await VW_DB.getSetting('tile_wastage_config', { breakage_pct: 10 });
    _tqState.breakagePct = (_wc && _wc.breakage_pct != null) ? _wc.breakage_pct : 10;
  } catch(e) { console.error('Spacer config preload failed:', e); }

  // Auto-fill from active check-in if available
  const profile = VW_AUTH.getCurrentProfile();
  if (!_isResume && window.activeVisit?.customerName) {
    _tqState.customer.name = window.activeVisit.customerName || '';
    _tqState.customer.phone = window.activeVisit.customerPhone || '';
    _tqState.customer.site = window.activeVisit.customerArea || '';
    _tqState.customer.id = window.activeVisit.customerId || null;
  }

  return _renderTQPage();
}


// ══════════════════════════════════════════════════════════════════════════════
// STEP 0: WHO'S INVOLVED — Customer + Contractor/Professional
// ══════════════════════════════════════════════════════════════════════════════
async function _renderStep0() {
  const st = _tqState;
  const c = st.contractor;

  // Pre-fill from active check-in if available
  if (window.activeVisit?.customerName && !st.customer.name) {
    st.customer.name  = window.activeVisit.customerName  || '';
    st.customer.phone = window.activeVisit.customerPhone || '';
    st.customer.site  = window.activeVisit.customerArea  || '';
    st.customer.id    = window.activeVisit.customerId    || null;
  }

  const custFound = st.customer._found; // set by searchCustomerByPhone

  return `
  <!-- CUSTOMER DETAILS -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">👤 Customer</h3>

    <!-- Phone-first search -->
    <div class="form-group" style="margin-bottom:8px">
      <label>Mobile Number *</label>
      <div style="display:flex;gap:6px">
        <input type="tel" id="tq-cust-phone" value="${st.customer.phone||''}"
          placeholder="Search by 10-digit mobile" maxlength="10" inputmode="numeric"
          style="flex:1;font-size:15px;font-weight:700;letter-spacing:0.05em"
          oninput="VW_TILES._onCustPhoneInput(this.value)">
        <button onclick="VW_TILES.searchCustomerByPhone(document.getElementById('tq-cust-phone')?.value)"
          style="padding:0 14px;background:var(--gold);color:#000;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0">
          🔍
        </button>
      </div>
    </div>

    <!-- Customer search results / form -->
    <div id="tq-cust-result">
      ${custFound === true ? `
      <!-- Found existing customer -->
      <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--green)">✓ ${st.customer.name}</div>
            <div style="font-size:11px;color:var(--text3)">${st.customer.phone} ${st.customer.site?'· '+st.customer.site:''}</div>
            ${st.customer.totalQuotes?`<div style="font-size:10px;color:var(--text3);margin-top:2px">${st.customer.totalQuotes} previous quotes</div>`:''}
          </div>
          <button onclick="VW_TILES._clearCustomer()"
            style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:0">✕</button>
        </div>
      </div>` : custFound === false ? `
      <!-- Not found — show add form -->
      <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px">
        <div style="font-size:11px;color:var(--gold);font-weight:600;margin-bottom:8px">New customer — fill details</div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Full Name *</label>
          <input type="text" id="tq-cust-name" value="${st.customer.name||''}"
            placeholder="Customer name" oninput="_tqState.customer.name=this.value;VW_TILES._updateStep0NextBtn()"
            style="font-size:14px">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Site / Area</label>
          <input type="text" id="tq-cust-site" value="${st.customer.site||''}"
            placeholder="e.g. Bhavanipuram" oninput="_tqState.customer.site=this.value">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Reference Image (optional)</label>
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Customer's inspiration photo, Pinterest image, or room photo</div>
          ${st.customer.referenceImageUrl ? `
          <div style="position:relative;margin-bottom:6px">
            <img src="${st.customer.referenceImageUrl}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
            <button onclick="_tqState.customer.referenceImageUrl=null;_tqState.customer.referenceImageName=null;VW_TILES._renderStep0()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:22px;height:22px;color:#fff;cursor:pointer;font-size:12px">✕</button>
          </div>` : ''}
          <input type="file" accept="image/*" onchange="VW_TILES._uploadTQReferenceImage(this)"
            style="width:100%;padding:6px;background:var(--bg3);border:1px dashed var(--border);border-radius:8px;font-size:11px">
        </div>
        <button onclick="VW_TILES._saveNewCustomer()"
          style="width:100%;padding:8px;background:var(--gold);color:#000;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">
          ✅ Save & Continue
        </button>
      </div>` : st.customer.name ? `
      <!-- Pre-filled from check-in -->
      <div style="background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.2);border-radius:10px;padding:10px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:700;color:#60A5FA;margin-bottom:4px">From check-in</div>
        <div style="font-size:13px;font-weight:600">${st.customer.name}</div>
        <div style="font-size:11px;color:var(--text3)">${st.customer.phone} ${st.customer.site?'· '+st.customer.site:''}</div>
      </div>` : `
      <!-- Idle — prompt to enter phone -->
      <div style="font-size:12px;color:var(--text3);padding:8px 0">
        Enter mobile number and tap 🔍 to search existing customers
      </div>`}
    </div>

    ${(st.customer.phone?.length===10 && (custFound || st.customer.name)) ? `
    <button onclick="VW_TILES.sendCustomerRegistrationLink()"
      style="font-size:11px;padding:5px 12px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:7px;color:#60A5FA;cursor:pointer;margin-top:4px">
      📲 Send quote tracker link
    </button>` : ''}
  </div>

  <!-- CONTRACTOR / PROFESSIONAL -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🔨 Contractor / Professional
      <span style="font-size:11px;font-weight:400;color:var(--text3)"> — optional</span>
    </h3>

    ${c ? `
    <!-- Contractor linked -->
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--green)">✓ ${c.name}</div>
          <div style="font-size:11px;color:var(--text3)">${c.phone}${c.tier?' · '+c.tier+' Member':''}</div>
        </div>
        <button onclick="VW_TILES.unlinkContractor()"
          style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;padding:0">✕</button>
      </div>
      <div style="font-size:10px;color:var(--text3)">Commission is set &amp; approved in the back-office Commissions module — never shown on the quote.</div>
    </div>` : `

    <!-- Contractor search — debounced, updates results div only -->
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <input type="text" id="tq-cont-search"
        placeholder="Search by name or phone..."
        style="flex:1;font-size:14px"
        oninput="VW_TILES._debouncedContractorSearch(this.value)">
      <button onclick="VW_TILES._showAddContractorForm()"
        style="padding:0 12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:13px;cursor:pointer;flex-shrink:0;color:var(--text)">
        + Add
      </button>
    </div>

    <!-- Results inject here without full re-render -->
    <div id="tq-cont-results">
      <div style="font-size:11px;color:var(--text3);padding:4px 0">
        Type to search registered contractors/professionals
      </div>
    </div>

    <!-- Add contractor form (hidden by default) -->
     <div id="tq-cont-add-form" style="display:none;background:var(--bg2);border-radius:10px;padding:10px;margin-top:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">Add Contractor</div>
        <button type="button" onclick="VW_TILES._showAddContractorForm()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:0;line-height:1">✕</button>
      </div>
      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group" style="margin:0;flex:1">
          <label>Name</label>
          <input type="text" id="tq-new-cont-name" placeholder="Full name" onkeydown="if(event.key==='Enter'){event.preventDefault();VW_TILES.addAndLinkContractor();}">
        </div>
        <div class="form-group" style="margin:0;flex:1">
          <label>Phone</label>
          <input type="tel" id="tq-new-cont-phone" placeholder="10-digit" maxlength="10" inputmode="numeric" onkeydown="if(event.key==='Enter'){event.preventDefault();VW_TILES.addAndLinkContractor();}">
        </div>
      </div>
      <div class="form-row" style="margin-bottom:10px">
        <div class="form-group" style="margin:0;flex:1">
          <label>Trade / Speciality</label>
          <select id="tq-new-cont-trade" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);font-size:13px;width:100%">
            <option value="">Select...</option>
            ${['Tile Layer','Mason','Interior Designer','Architect','Builder/Contractor','Plumber','Electrician','Other'].map(t=>`<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;flex:1">
          <label>Business Name</label>
          <input type="text" id="tq-new-cont-biz" placeholder="Optional">
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" onclick="VW_TILES.addAndLinkContractor()" class="btn-primary" style="flex:2">✅ Save & Link</button>
        <button type="button" onclick="VW_TILES._sendContractorRegLink()" style="flex:1;padding:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);border-radius:8px;color:#60A5FA;font-size:12px;cursor:pointer">📲 Send Reg Link</button>
      </div>
    </div>`}
  </div>

  <button class="btn-primary full-width" id="tq-step0-next"
    onclick="VW_TILES.tqNext()"
    ${(!st.customer.name && !st.customer._found)?'disabled style="opacity:0.5"':''}>
    ${!st.customer.name && !st.customer._found ? 'Enter customer details first' : 'Next → Rooms & Areas'}
  </button>`;
}


function _updateStep0NextBtn() {
  const btn = document.getElementById('tq-step0-next');
  if (!btn) return;
  const ready = !!(_tqState.customer.name || _tqState.customer._found);
  btn.disabled = !ready;
  btn.style.opacity = ready ? '1' : '0.5';
  btn.textContent = ready ? 'Next → Rooms & Areas' : 'Enter customer details first';
}


function linkContractor(ct) {
  _tqState.contractor = ct;
  _tqState._contractorSearch = '';
  _renderStep0().then(h=>{const el=document.getElementById('tq-step-content');if(el)el.innerHTML=h;});
}

function linkContractorById(id) {
  const ct = (_tqState._contractorResults||[]).find(c=>String(c.id)===String(id));
  if (!ct) { showToast('Contractor not found — search again','warn'); return; }
  linkContractor({ id:ct.id, name:ct.name||'', phone:ct.phone||'', trade:ct.professional_type||'', company:ct.company_name||'', tier:ct.tier||'', isExisting:true, loyaltyPoints:ct.loyalty_points||0 });
}

function unlinkContractor() {
  _tqState.contractor = null;
  _renderStep0().then(h=>{const el=document.getElementById('tq-step-content');if(el)el.innerHTML=h;});
}

function setContractorCommission(pct) {
  if (!_tqState.contractor) return;
  _tqState.contractor.commissionPct = pct;
  _tqState.contractor.customCommission = pct > 2;
  _renderStep0().then(h=>{const el=document.getElementById('tq-step-content');if(el)el.innerHTML=h;});
}

// ─── CUSTOMER HELPERS ─────────────────────────────────────────────────────────

// Auto-search when 10 digits entered — no button press needed
function _onCustPhoneInput(val) {
  const digits = val.replace(/\D/g,'');
  _tqState.customer.phone = digits;
  if (digits.length === 10) {
    searchCustomerByPhone(digits);
  } else {
    // Clear previous result if editing
    _tqState.customer._found = null;
    _tqState.customer.name = '';
    _tqState.customer.id = null;
    _updateStep0NextBtn();
    const el = document.getElementById('tq-cust-result');
    if (el) el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:4px 0">${10-digits.length} more digits...</div>`;
  }
}

async function searchCustomerByPhone(phone) {
  if (!phone || phone.length < 10) return;
  const el = document.getElementById('tq-cust-result');
  if (el) el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px 0">🔍 Searching...</div>';

  try {
    // 1. Search customers table (CRM)
    const { data: custRows } = await VW_DB.client
      .from('customers')
      .select('id, name, phone, address, last_visit')
      .eq('phone', phone)
      .limit(1);

    const found = custRows?.[0];
    if (found) {
      _tqState.customer = { ...found, site: found.address || '', _found: true, totalQuotes: 0 };
      if (el) el.innerHTML = `
        <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--green)">✓ ${found.name}</div>
              <div style="font-size:11px;color:var(--text3)">${found.phone}${found.address?' · '+found.address:''}</div>
            </div>
            <button onclick="VW_TILES._clearCustomer()"
              style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:0">✕</button>
          </div>
        </div>
        <button onclick="VW_TILES.sendCustomerRegistrationLink()"
          style="margin-top:6px;font-size:11px;padding:5px 12px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:7px;color:#60A5FA;cursor:pointer">
          📲 Send quote tracker link
        </button>`;
      _updateStep0NextBtn();
      return;
    }

    // 2. Fallback: search tile_quotations for any previous quote with this phone
    const { data: tqRows } = await VW_DB.client
      .from('tile_quotations')
      .select('customer_name, customer_phone, site_address, customer_id')
      .eq('customer_phone', phone)
      .not('customer_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const prevTQ = tqRows?.[0];
    if (prevTQ?.customer_name) {
      // Found in quote history — auto-create in customers table so they're in CRM
      let custId = prevTQ.customer_id;
      if (!custId) {
        const { data: newCust } = await VW_DB.client.from('customers').insert({
          name: prevTQ.customer_name, phone, address: prevTQ.site_address || '', source: 'quote_history', type: 'retail'
        }).select('id').single();
        custId = newCust?.id || null;
        // Link all their past quotes to this new customer id
        if (custId) {
          await VW_DB.client.from('tile_quotations').update({ customer_id: custId }).eq('customer_phone', phone).is('customer_id', null);
        }
      }
      _tqState.customer = { id: custId, name: prevTQ.customer_name, phone, site: prevTQ.site_address || '', _found: true, totalQuotes: 0 };
      if (el) el.innerHTML = `
        <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--green)">✓ ${prevTQ.customer_name}</div>
              <div style="font-size:11px;color:var(--text3)">${phone} · Found in quote history</div>
            </div>
            <button onclick="VW_TILES._clearCustomer()"
              style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:0">✕</button>
          </div>
        </div>`;
      _updateStep0NextBtn();
      return;
    }

    // 3. Genuinely new customer — show name entry form
    _tqState.customer._found = false;
    if (el) el.innerHTML = `
      <div style="background:var(--bg2);border-radius:10px;padding:10px">
        <div style="font-size:11px;color:var(--gold);font-weight:600;margin-bottom:8px">✦ New customer — ${phone}</div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Full Name *</label>
          <input type="text" id="tq-cust-name" value="${_tqState.customer.name||''}"
            placeholder="Customer name" oninput="_tqState.customer.name=this.value;VW_TILES._updateStep0NextBtn()"
            style="font-size:14px" autofocus>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Site Address <span style="color:var(--text3);font-weight:400">(optional)</span></label>
          <input type="text" id="tq-cust-site" value="${_tqState.customer.site||''}"
            placeholder="e.g. Benz Circle Plot 12"
            oninput="_tqState.customer.site=this.value">
        </div>
      </div>`;
    _updateStep0NextBtn();

  } catch(e) {
    console.error('searchCustomerByPhone error:', e);
    if (el) el.innerHTML = '<div style="font-size:12px;color:var(--red)">Search failed — enter name manually</div>';
  }
}


function _clearCustomer() {
  _tqState.customer = { name:'', phone:'', site:'', id:null, _found:null };
  const phoneEl = document.getElementById('tq-cust-phone');
  if (phoneEl) { phoneEl.value = ''; phoneEl.focus(); }
  _updateStep0NextBtn();
  const el = document.getElementById('tq-cust-result');
  if (el) el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:4px 0">Enter mobile number to search existing customers</div>`;
}

async function _saveNewCustomer() {
  const name = document.getElementById('tq-cust-name')?.value.trim() || _tqState.customer.name;
  const site = document.getElementById('tq-cust-site')?.value.trim() || _tqState.customer.site;
  const phone = _tqState.customer.phone;
  if (!name) { showToast('Enter customer name', 'warn'); return; }

  _tqState.customer.name = name;
  _tqState.customer.site = site;

  // Check if phone already exists before inserting. Use limit(1) (not maybeSingle)
  // so pre-existing duplicates don't throw and cascade into yet another insert.
  let saveError = null;
  try {
    const { data: existRows, error: selErr } = await VW_DB.client.from('customers')
      .select('id, name').eq('phone', phone).limit(1);
    if (selErr) throw selErr;
    const existing = existRows?.[0];
    if (existing) {
      // Phone exists — update and link to the existing record (no duplicate created)
      _tqState.customer.id = existing.id;
      const { error } = await VW_DB.client.from('customers').update({ name, address: site }).eq('id', existing.id);
      if (error) saveError = error;
    } else {
      const { data, error } = await VW_DB.client.from('customers')
        .insert({ name, phone, address: site }).select().single();
      if (error) saveError = error;
      else if (data?.id) _tqState.customer.id = data.id;
    }
  } catch(e) { saveError = e; }

  // Mark confirmed regardless so the staffer can proceed; warn if the write failed.
  _tqState.customer._found = true;
  if (saveError) {
    console.error('Customer save error:', saveError);
    showToast('Could not save customer to server — proceeding with entered details', 'warn');
  } else {
    showToast(`${name} saved ✓`, 'success');
  }

  // Re-render result area to show confirmed card
  const el = document.getElementById('tq-cust-result');
  if (el) el.innerHTML = `
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--green)">✓ ${name}</div>
          <div style="font-size:11px;color:var(--text3)">${phone}${site?' · '+site:''}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${saveError?'Saved locally — sync pending':'New customer saved'}</div>
        </div>
        <button onclick="VW_TILES._clearCustomer()"
          style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:0">✕</button>
      </div>
    </div>`;
  _updateStep0NextBtn();
}

// ─── CONTRACTOR HELPERS ───────────────────────────────────────────────────────

// Debounced search — waits 400ms after last keystroke, then searches
let _contSearchTimer = null;
function _debouncedContractorSearch(val) {
  clearTimeout(_contSearchTimer);
  const resultsEl = document.getElementById('tq-cont-results');

  if (!val || val.length < 2) {
    if (resultsEl) resultsEl.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:4px 0">Type to search registered contractors/professionals</div>`;
    return;
  }

  if (resultsEl) resultsEl.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:4px 0">Searching...</div>`;

  _contSearchTimer = setTimeout(async () => {
    try {
      // Search ALL contractors (not just approved) — staff add new ones as `pending`,
      // and they must be linkable to a quote immediately after saving.
      const { data, error } = await VW_DB.client
        .from('contractors')
        .select('id, name, phone, company_name, professional_type, approval_status, loyalty_points')
        .or(`name.ilike.%${val}%,phone.ilike.%${val}%,company_name.ilike.%${val}%`)
        .limit(6);
      if (error) console.error('Contractor search error:', error);

      if (!data?.length) {
        if (resultsEl) resultsEl.innerHTML = `
          <div style="padding:10px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
            No contractor found for "<strong>${val}</strong>" —
            <button onclick="VW_TILES._showAddContractorForm()" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:12px;font-weight:700;padding:0">+ Add New</button>
          </div>`;
        return;
      }

      _tqState._contractorResults = data;
      if (resultsEl) resultsEl.innerHTML = data.map(ct => `
        <div onclick="VW_TILES.linkContractorById('${ct.id}')"
          style="padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:600">${ct.name}${ct.approval_status && ct.approval_status!=='approved'?` <span style="font-size:9px;font-weight:700;color:var(--gold);background:var(--gold-muted);border-radius:4px;padding:1px 5px;vertical-align:middle">${ct.approval_status}</span>`:''}</div>
            <div style="font-size:11px;color:var(--text3)">${ct.phone||''}${ct.professional_type?' · '+ct.professional_type:''}</div>
            ${ct.company_name?`<div style="font-size:10px;color:var(--text3)">${ct.company_name}</div>`:''}
            <div style="font-size:10px;color:var(--gold)">${ct.loyalty_points||0} loyalty pts</div>
          </div>
          <span style="color:var(--gold);font-size:13px;font-weight:700;flex-shrink:0">Link →</span>
        </div>`).join('');
    } catch(e) {
      if (resultsEl) resultsEl.innerHTML = `<div style="color:var(--red);font-size:12px">Search failed</div>`;
    }
  }, 400); // 400ms debounce — fast enough, no per-keystroke DB call
}

function _showAddContractorForm() {
  const form = document.getElementById('tq-cont-add-form');
  const resultsEl = document.getElementById('tq-cont-results');
  if (form) {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') {
      if (resultsEl) resultsEl.style.display = 'none';
      document.getElementById('tq-new-cont-name')?.focus();
    } else {
      if (resultsEl) resultsEl.style.display = 'block';
    }
  }
}

async function _sendContractorRegLink() {
  const name  = document.getElementById('tq-new-cont-name')?.value.trim();
  const phone = document.getElementById('tq-new-cont-phone')?.value.trim();
  if (!phone || phone.length < 10) { showToast('Enter phone number first', 'warn'); return; }
  const storeInfo = await VW_DB.getSetting('store_info', { name:'V Wholesale', phone:'8712697930' });
  const msg = encodeURIComponent(
    `Hi ${name||''}! V Wholesale, Vijayawada invites you to join the Contractor Club.\n\nRegister to earn 2% commission on every sale you refer:\nhttps://hmehtavw.github.io/vwholesale-app/?contractor=register&phone=${phone}\n\nBenefits: Commission tracking, reward points, bank transfer or store credit.\n\nFor queries: ${storeInfo.phone}`
  );
  window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  showToast('Registration link sent via WhatsApp ✓', 'success');
  // Also link them immediately with the name+phone provided
  if (name) {
    linkContractor({ id:null, name, phone, isExisting:false, commissionPct:2, customCommission:false });
  }
}

async function addAndLinkContractor() {
  const name = document.getElementById('tq-new-cont-name')?.value.trim();
  const phone = document.getElementById('tq-new-cont-phone')?.value.trim();
  const trade = document.getElementById('tq-new-cont-trade')?.value;
  const biz   = document.getElementById('tq-new-cont-biz')?.value.trim();
  if (!name || !phone || phone.length < 10) { showToast('Enter name and 10-digit phone','warn'); return; }

  // Check if contractor already exists
  try {
    const { data: existing } = await VW_DB.client.from('contractors')
      .select('id, name, approval_status').eq('phone', phone).maybeSingle();
    if (existing) {
      linkContractor({ id: existing.id, name: existing.name||name, phone, isExisting: true, commissionPct: 2, customCommission: false });
      showToast(`${existing.name||name} already registered — linked ✓`, 'success');
      return;
    }
    // New contractor — insert
    const { data: inserted } = await VW_DB.client.from('contractors')
      .insert({ name, phone, company_name: biz||null, professional_type: trade||null, approval_status:'pending', signup_source:'staff' })
      .select().single();
    linkContractor({ id: inserted?.id||null, name, phone, trade, isExisting: false, commissionPct: 2, customCommission: false });
  } catch(e) {
    linkContractor({ id: null, name, phone, isExisting: false, commissionPct: 2, customCommission: false });
  }
  // Send WhatsApp registration message
  const storeInfo = await VW_DB.getSetting('store_info', { name:'V Wholesale', phone:'8712697930' });
  const msg = encodeURIComponent(
    `Hi ${name}! You've been linked to a tile quotation at V Wholesale, Vijayawada.

Register as a Contractor Club member to track your commission and rewards:
https://hmehtavw.github.io/vwholesale-app/?contractor=register&phone=${phone}

For queries: ${storeInfo.phone||'call us'}`
  );
  window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  showToast(`${name} linked · WhatsApp sent ✓`, 'success');
}

async function sendCustomerRegistrationLink() {
  const phone = _tqState.customer.phone;
  const name = _tqState.customer.name;
  if (!phone) return;
  const msg = encodeURIComponent(
    `Hi ${name||''}! Your tile quotation from V Wholesale, Vijayawada is being prepared.

Track your quote status here:
https://hmehtavw.github.io/vwholesale-app/?customer=register&phone=${phone}

Questions? Call us anytime.`
  );
  window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  showToast('Customer link sent via WhatsApp ✓', 'success');
}

// Step labels indexed by _tqState.step (0-8). 9 numbered steps; the wall-design
// planner and visualizer are interstitial and keep the surrounding step's number.
const TQ_STEP_NAMES = ['Customer','Rooms & Areas','Tile Size','Design, Tile & Price','Spacer','Adhesive','Grout & Epoxy','Add-ons','Summary'];
function _renderStepHeaderInner() {
  const s = _tqState.step;
  const total = TQ_STEP_NAMES.length;
  const stepName = TQ_STEP_NAMES[s] || '';
  return `
    ${s > 1 ? `<button onclick="VW_TILES.tqBack()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;padding:0;line-height:1">←</button>` : ''}
    <div style="flex:1">
      <div style="font-size:11px;color:var(--text3);font-weight:500">Step ${s+1} of ${total}</div>
      <div style="font-size:17px;font-weight:800;color:var(--text)">${stepName}</div>
    </div>
    <div style="font-size:11px;color:var(--text3)">${_tqState.customer?.name||''}</div>`;
}

async function _renderTQPage() {
  const s = _tqState.step;
  const stepContent = await _tqRenderStep(s);
  return `
  <div id="tq-step-header" style="padding:10px 16px 4px;display:flex;align-items:center;gap:10px">
    ${_renderStepHeaderInner()}
  </div>
  <div id="tq-step-content">
    ${stepContent}
  </div>`;
}

// ───── STEP 1: ROOM ENTRY ───────────────────────────────────
function _renderStep1() {
  // Check active visit
  const hasActiveVisit = !!window.activeVisit?.customerName;
  const profile = VW_AUTH.getCurrentProfile();
  const isQuotationTeam = ['admin','management','store_manager'].includes(profile?.role||'');

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Customer Details</h3>
    ${hasActiveVisit ? `
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:8px;margin-bottom:10px;font-size:11px;color:var(--green)">
      ✓ Auto-filled from active check-in: <strong>${window.activeVisit.customerName}</strong>
    </div>` : `
    <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:8px;padding:8px;margin-bottom:10px;font-size:11px;color:var(--text2)">
      ⚠️ No active check-in — search for existing customer or enter new customer details
    </div>`}
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Phone</label>
        <input type="tel" id="tq-cphone" value="${_tqState.customer.phone}" placeholder="9999999999" maxlength="10"
          oninput="_tqState.customer.phone=this.value;VW_TILES.lookupTileCustomer(this.value,'tq',true)">
        <div id="tq-cust-lookup" style="font-size:11px;color:var(--text3);margin-top:2px"></div>
      </div>
      <div class="form-group" style="margin:0;flex:1"><label>Customer Name *</label>
        <input type="text" id="tq-cname" value="${_tqState.customer.name}" placeholder="Ravi Teja"
          oninput="_tqState.customer.name=this.value">
      </div>
    </div>
    <div class="form-group"><label>Site / Project Address</label>
      <input type="text" id="tq-site" value="${_tqState.customer.site}" placeholder="e.g. Plot 45, Bhavanipuram"
        oninput="_tqState.customer.site=this.value">
    </div>
    <!-- OWNERSHIP WARNING shown by lookupTileCustomer if customer has another exec -->
    <div id="tq-ownership-warning" style="display:none"></div>
  </div>

  <div class="card" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 class="card-title" style="margin:0">Rooms & Areas</h3>
    </div>

    <!-- FLOOR PLAN UPLOAD OPTION -->
    <div style="background:rgba(96,165,250,0.06);border:1px dashed rgba(96,165,250,0.4);border-radius:12px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:#60A5FA;margin-bottom:6px">📐 Have a floor plan? Upload it</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">AI will read dimensions and auto-populate all rooms. You can edit measurements after.</div>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('tq-floorplan-input').click()"
          style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px;cursor:pointer;font-size:12px;color:var(--text)">
          📷 Upload Floor Plan
        </button>
        <button onclick="closeSheet();VW_TILES.tqAddRoom()" 
          style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px;cursor:pointer;font-size:12px;color:var(--text)">
          ✍️ Add Room Manually
        </button>
      </div>
      <input type="file" id="tq-floorplan-input" accept="image/*,application/pdf" style="display:none" onchange="VW_TILES.tqReadFloorPlan(this)">
      <div id="tq-floorplan-status" style="margin-top:8px;font-size:11px;color:var(--text3)"></div>
    </div>

    <!-- DIRECT SQFT ENTRY — quick option for contractors who know total area -->
    <div style="background:rgba(34,197,94,0.05);border:1px dashed rgba(34,197,94,0.3);border-radius:12px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:4px">⚡ Know the total sqft? Enter directly</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">Skip room-by-room. Enter total area and label. Good for contractor bulk orders or when measurements are confirmed separately.</div>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1">
          <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Total Sqft</label>
          <input type="number" id="tq-direct-sqft" placeholder="e.g. 450" min="1" step="0.5"
            style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:14px;font-weight:700;color:var(--green);box-sizing:border-box">
        </div>
        <div style="flex:1">
          <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Label</label>
          <input type="text" id="tq-direct-label" placeholder="e.g. Full Home Floor" value="Total Area"
            style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:10px;color:transparent;display:block;margin-bottom:3px">.</label>
          <button onclick="VW_TILES.tqAddDirectSqft()"
            style="padding:9px 14px;background:var(--green);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">
            + Add
          </button>
        </div>
      </div>
    </div>

    <!-- MULTI-FLAT / PROJECT MODE -->
    <div style="background:rgba(245,200,66,0.05);border:1px dashed var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:4px">🏢 Flat / Unit <span style="color:var(--text3);font-weight:400">(optional — for multi-flat projects)</span></div>
      <input type="text" id="tq-flat" value="${_tqState.currentFlat||''}" placeholder="e.g. Flat 101, Tower A 2BHK — leave blank for a single home"
        oninput="_tqState.currentFlat=this.value"
        style="width:100%;font-size:13px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:7px 9px;color:var(--text)">
      <div style="font-size:10px;color:var(--text3);margin-top:4px">Set this, add that flat's rooms, then change it for the next flat. The summary shows a per-flat breakdown plus a combined total.</div>
    </div>

    <div id="tq-rooms-list">
      ${_tqState.rooms.length ? _renderRoomsGrouped() : `
      <div style="text-align:center;padding:24px;color:var(--text3)">
        <div style="font-size:32px;margin-bottom:8px">🏠</div>
        <div style="font-size:13px">Tap "Add Room" to start measuring</div>
        <div style="font-size:11px;margin-top:4px">Add all rooms where tiles are required</div>
      </div>`}
    </div>
  </div>

  ${_tqState.rooms.length ? `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:13px;font-weight:700">Total Area</div>
      <div style="font-size:11px;color:var(--text3)">${_tqState.rooms.length} room(s) added</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:20px;font-weight:800;color:var(--gold)">${_tqTotalSqft().toFixed(1)} sqft</div>
    </div>
  </div>
  <button class="btn-primary full-width" onclick="VW_TILES.tqNext()">Next → Choose Tile Size</button>` : ''}`;
}

// Per-flat summary for multi-flat projects: area + boxes + price subtotal per
// flat, then the project total. Returns '' when no flats are tagged (single home).
function _renderTqFlatBreakdown(roomBOMs, st) {
  const anyFlat = (st.rooms||[]).some(r => r.flat);
  if (!anyFlat) return '';
  const qp = st.quotedPrices || {};
  const groups = {};
  (roomBOMs||[]).forEach(b => {
    const k = b.room?.flat || '— Unassigned —';
    const g = groups[k] || (groups[k] = { sqft:0, boxes:0, price:0 });
    g.sqft += b.roomSqft || 0;
    g.boxes += b.boxes || 0;
    const sp = qp[b.slot?.id] || {};
    if (sp.pricePerBox > 0) g.price += sp.pricePerBox * (b.boxes||0);
    else if (sp.pricePerSqft > 0) g.price += sp.pricePerSqft * (b.roomSqft||0);
    else if (st.selectedProduct?.mrp) g.price += st.selectedProduct.mrp * (b.boxes||0);
  });
  const entries = Object.entries(groups);
  const totSqft = entries.reduce((s,[,g])=>s+g.sqft,0);
  const totPrice = entries.reduce((s,[,g])=>s+g.price,0);
  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🏢 Per-Flat Breakdown</h3>
    ${entries.map(([flat,g])=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:13px;font-weight:700">${flat}</div>
        <div style="font-size:11px;color:var(--text3)">${g.sqft.toFixed(1)} sqft · ${g.boxes} boxes</div>
      </div>
      ${g.price>0?`<div style="font-size:14px;font-weight:700;color:var(--gold)">₹${Math.round(g.price).toLocaleString('en-IN')}</div>`:''}
    </div>`).join('')}
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:14px;font-weight:700">
      <span>Project Total · ${entries.length} flat(s)</span>
      <span style="color:var(--gold)">${totSqft.toFixed(1)} sqft${totPrice>0?` · ₹${Math.round(totPrice).toLocaleString('en-IN')}`:''}</span>
    </div>
  </div>`;
}

function _renderRoomsGrouped() {
  const rooms = _tqState.rooms || [];
  const anyFlat = rooms.some(r => r.flat);
  if (!anyFlat) return rooms.map((r,i) => _renderRoomCard(r,i)).join('');
  // Group by flat, preserving each room's original index for edit/remove.
  const groups = {};
  rooms.forEach((r,i) => { const k = r.flat || '— Unassigned —'; (groups[k] = groups[k] || []).push({ r, i }); });
  return Object.entries(groups).map(([flat, list]) => {
    const flatSqft = list.reduce((s,{r}) => s + r.areas.reduce((t,a)=>t+(a.sqft||0),0), 0);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:8px;padding:5px 10px;margin-bottom:6px">
        <span style="font-size:12px;font-weight:700;color:var(--gold)">🏢 ${flat}</span>
        <span style="font-size:11px;font-weight:700;color:var(--gold)">${flatSqft.toFixed(1)} sqft · ${list.length} room(s)</span>
      </div>
      ${list.map(({r,i}) => _renderRoomCard(r,i)).join('')}
    </div>`;
  }).join('');
}

function _renderRoomCard(r, i) {
  const def = ROOM_DEFS[r.type] || ROOM_DEFS['Custom Area'];
  const totalSqft = r.areas.reduce((s,a)=>s+(a.sqft||0), 0);
  return `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:700">${def.icon} ${r.label||r.type||'Room'}</div>
        <div style="font-size:11px;color:var(--text3)">${r.type} · ${r.areas.length} area(s)</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div style="font-size:14px;font-weight:700;color:var(--gold)">${totalSqft.toFixed(1)} sqft</div>
        <button onclick="VW_TILES.tqEditRoom(${i})" style="background:none;border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:11px;color:var(--text2);cursor:pointer">✏️ Edit</button>
        <button onclick="VW_TILES.tqRemoveRoom(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">✕</button>
      </div>
    </div>
    ${r.areas.map((a,ai) => {
      const cleanLabel = (a.label||'').replace(/ \+\d+% wastage/,'').replace(/ \+[\d.]+ft skirting \([^)]*\)/,'');
      const base = (a.base!=null) ? a.base : a.sqft;
      const wasteSqft = a.wastage ? base*a.wastage/100 : 0;
      const skirtSqft = (a.skirting && a.skirtingHeightIn) ? a.skirting*(a.skirtingHeightIn/12) : 0;
      const extras = [];
      if (a.skirting) extras.push(`skirting ${skirtSqft.toFixed(1)} (${a.skirting}ft×${a.skirtingHeightIn||4}″)`);
      if (a.wastage) extras.push(`${a.wastage}% waste ${wasteSqft.toFixed(1)}`);
      const breakdown = extras.length ? `${base.toFixed(base<10?1:0)} + ${extras.join(' + ')} = ` : '';
      return `<div style="font-size:11px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border)">
      ${cleanLabel}: ${breakdown}<strong>${a.sqft.toFixed(2)} sqft</strong>${r.type==='Bathroom'&&a.subType?`<span style="color:var(--text3)"> · ${a.subType}</span>`:''}
    </div>`;
    }).join('')}
    <button onclick="VW_TILES.tqAddArea(${i})" style="margin-top:6px;background:none;border:1px dashed var(--border);border-radius:8px;padding:4px 10px;font-size:11px;color:var(--text3);cursor:pointer;width:100%">
      + Add another area to this room
    </button>
  </div>`;
}

function tqAddRoom(editIdx) {
  const types = Object.keys(ROOM_DEFS);
  const sheet = document.getElementById('bottom-sheet');
  const isEdit = editIdx !== undefined;
  const existingRoom = isEdit ? _tqState.rooms[editIdx] : null;
  const defaultType = existingRoom?.type || 'Living Room';

   sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">${isEdit ? '✏️ Edit Room' : '+ Add Room'}</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Room Type</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">
      ${types.map(t => `
      <button onclick="VW_TILES.tqPickRoomType('${t.replace(/'/g,"\\'")}',this)"
        style="padding:8px 4px;border-radius:10px;border:${t===defaultType?'2px solid var(--gold)':'1px solid var(--border)'};
               background:${t===defaultType?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;
               font-size:11px;font-weight:${t===defaultType?700:400};color:${t===defaultType?'var(--gold)':'var(--text)'};
               text-align:center;line-height:1.3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:52px">
        <span style="font-size:18px">${ROOM_DEFS[t].icon}</span>
        <span>${t.replace(' Room','').replace(' Area','').replace('Custom','Custom')}</span>
      </button>`).join('')}
    </div>
    <select id="tq-room-type-sel" style="display:none">
      ${types.map(t => `<option value="${t}" ${t===defaultType?'selected':''}>${t}</option>`).join('')}
    </select>
    <div class="form-group"><label>Label <span style="font-weight:400;font-size:11px;color:var(--text3)">(rename if needed)</span></label>
      <input type="text" id="tq-room-label" value="${existingRoom?.label || defaultType}" placeholder="e.g. Master Bedroom">
    </div>
    <div id="tq-measure-form-area">
      ${_renderMeasureForm(defaultType, 0, existingRoom)}
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Cancel</button>
      <button class="btn-primary" style="flex:1" id="tq-save-room-btn" onclick="VW_TILES.tqSaveRoom('${defaultType.replace(/'/g,"\\'")}',${isEdit ? editIdx : 'undefined'})">${isEdit ? 'Update Room' : 'Add Room'}</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function tqEditRoom(i) { tqAddRoom(i); }

function tqSelectRoomType(type) {
  const formArea = document.getElementById('tq-measure-form-area');
  if (formArea) formArea.innerHTML = _renderMeasureForm(type, 0);
  const sel = document.getElementById('tq-room-type-sel');
  if (sel) sel.value = type;
  const saveBtn = document.getElementById('tq-save-room-btn') || document.querySelector('#bottom-sheet .btn-primary');
  if (saveBtn) saveBtn.setAttribute('onclick', `VW_TILES.tqSaveRoom('${type.replace(/'/g,"\\'")}',undefined)`);
  const labelEl = document.getElementById('tq-room-label');
  if (labelEl && Object.keys(ROOM_DEFS).includes(labelEl.value)) labelEl.value = type;
}

function tqPickRoomType(type, btn) {
  // Highlight selected button in 3-col grid
  if (btn) {
    const grid = btn.parentElement;
    if (grid) grid.querySelectorAll('button').forEach(b => {
      const sel = b === btn;
      b.style.border = sel ? '2px solid var(--gold)' : '1px solid var(--border)';
      b.style.background = sel ? 'var(--gold-muted)' : 'var(--bg2)';
      b.style.color = sel ? 'var(--gold)' : 'var(--text)';
      b.style.fontWeight = sel ? '700' : '400';
    });
  }
  tqSelectRoomType(type);
}

// Auto-calculate skirting from L and W when either changes
// Skirting = (L + W) × 2 running feet (room perimeter)
// If user has manually cleared it, don't overwrite — only auto-fill
function _autoSkirting(pfx) {
  const l = parseFloat(document.getElementById(`${pfx}-l`)?.value) || 0;
  const w = parseFloat(document.getElementById(`${pfx}-w`)?.value) || 0;
  const skirtEl = document.getElementById(`${pfx}-skirt`);
  const noteEl = document.getElementById(`${pfx}-skirt-note`);
  if (!skirtEl) return;

  // Only auto-fill if field is not manually cleared to 0 or empty by user action
  // We track whether user touched it via data-manual attribute
  const wasManuallyCleared = skirtEl.dataset.manual === 'true';

  if (!wasManuallyCleared && l > 0 && w > 0) {
    const perimeter = (l + w) * 2;
    skirtEl.value = perimeter;
    if (noteEl) noteEl.innerHTML = `✓ Auto: (${l}+${w})×2 = <strong>${perimeter} ft</strong> perimeter · 4" height · tap ✕ None to remove`;
  } else if (l > 0 && w > 0 && noteEl) {
    const perimeter = (l + w) * 2;
    if (noteEl) noteEl.innerHTML = `Perimeter would be ${perimeter} ft · skirting cleared`;
  }
}

// When user explicitly clears skirting, mark it as manual so auto-fill won't re-fill
function _skirtingManualClear(pfx) {
  const el = document.getElementById(`${pfx}-skirt`);
  if (el) { el.value = ''; el.dataset.manual = 'true'; }
}

// Skirting tile height: 3" or 4". Stored in a hidden input read by tqSaveRoom.
function _setSkirtHeight(pfx, h) {
  const hidden = document.getElementById(`${pfx}-skirt-h`);
  if (hidden) hidden.value = h;
  [3,4].forEach(x => {
    const b = document.getElementById(`${pfx}-skirt-h-${x}`);
    if (!b) return;
    const on = x === h;
    b.style.border = on ? '2px solid var(--gold)' : '1px solid var(--border)';
    b.style.background = on ? 'var(--gold-muted)' : 'var(--bg3)';
    b.style.color = on ? 'var(--gold)' : 'var(--text)';
  });
}

function _renderMeasureForm(type, areaIdx, prefill) {
  const pfx = `tq-m${areaIdx}`;
  const def = ROOM_DEFS[type] || ROOM_DEFS['Custom Area'];
  const p = prefill?.areas?.[0] || {};

  if (def.measureType === 'floor_lw' || def.measureType === 'floor_lw_skirting') return `
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Length (ft) *</label>
        <input type="number" id="${pfx}-l" value="${p.l||''}" placeholder="e.g. 13" min="0.5" step="0.5"
          oninput="VW_TILES._autoSkirting('${pfx}')"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Width (ft) *</label>
        <input type="number" id="${pfx}-w" value="${p.w||''}" placeholder="e.g. 14" min="0.5" step="0.5"
          oninput="VW_TILES._autoSkirting('${pfx}')"></div>
    </div>
    ${def.measureType==='floor_lw_skirting'?`
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Wastage</label>
        <div style="font-size:11px;color:var(--green);padding-top:7px">✓ Auto at design</div>
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Skirting <span style="color:var(--text3);font-weight:400;font-size:10px">running ft</span></label>
        <div style="display:flex;gap:4px;align-items:center">
          <input type="number" id="${pfx}-skirt" value="${p.skirting||''}" placeholder="auto from L+W" min="0" step="0.5" style="flex:1">
          <button type="button" onclick="VW_TILES._skirtingManualClear('${pfx}')"
            style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:11px;color:var(--text3);cursor:pointer;white-space:nowrap;flex-shrink:0">✕ None</button>
        </div>
        <div style="display:flex;gap:5px;align-items:center;margin-top:4px">
          <span style="font-size:10px;color:var(--text3)">Height:</span>
          ${[3,4].map(h=>`<button type="button" onclick="VW_TILES._setSkirtHeight('${pfx}',${h})"
            id="${pfx}-skirt-h-${h}"
            style="flex:1;padding:3px;border-radius:6px;font-size:11px;cursor:pointer;
              border:${(p.skirtingHeightIn||4)===h?'2px solid var(--gold)':'1px solid var(--border)'};
              background:${(p.skirtingHeightIn||4)===h?'var(--gold-muted)':'var(--bg3)'};
              color:${(p.skirtingHeightIn||4)===h?'var(--gold)':'var(--text)'}">${h}"</button>`).join('')}
          <input type="hidden" id="${pfx}-skirt-h" value="${p.skirtingHeightIn||4}">
        </div>
        <div id="${pfx}-skirt-note" style="font-size:9px;color:var(--text3);margin-top:2px">
          ${p.l && p.w ? `Auto: (${p.l}+${p.w})×2 = ${(parseFloat(p.l)+parseFloat(p.w))*2} ft perimeter` : 'Auto-fills from L & W · clear to skip'}
        </div>
      </div>
    </div>`:''}`;

  if (def.measureType === 'wall_hw') return `
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Height (ft)</label><input type="number" id="${pfx}-h" value="${p.h||''}" placeholder="e.g. 9" min="1" step="0.5"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Width (ft)</label><input type="number" id="${pfx}-w" value="${p.w||''}" placeholder="e.g. 8" min="0.5" step="0.5"></div>
    </div>
    <div style="font-size:11px;color:var(--green);margin-top:6px">✓ Wastage auto-calculated at the design step.</div>`;

  if (def.measureType === 'bathroom') {
    // Pre-fill from existing room data when editing.
    // `p` is areas[0]; the full sub-area list lives on `prefill.areas`.
    const ba = prefill?.areas || [];
    const wallArea = ba.find(a=>a.subType==='wall') || {};
    const floorArea = ba.find(a=>a.subType==='floor'||!a.subType) || {};
    const bh   = wallArea.h   !== undefined ? wallArea.h   : (p?.h   || '');
    const bw1l = wallArea.w1l !== undefined ? wallArea.w1l : (p?.w1l || '');
    const bw2w = wallArea.w2w !== undefined ? wallArea.w2w : (p?.w2w || '');
    const bw3l = wallArea.w3l !== undefined ? wallArea.w3l : (bw1l   || '');
    const bw4w = wallArea.w4w !== undefined ? wallArea.w4w : (p?.w4w || '');
    const bdw  = wallArea.dw  !== undefined ? wallArea.dw  : (p?.dw  || '');
    const bdh  = wallArea.dh  !== undefined ? wallArea.dh  : (p?.dh  || '');
    const bfl  = floorArea.l  !== undefined ? floorArea.l  : (p?.fl  || '');
    const bfw  = floorArea.w  !== undefined ? floorArea.w  : (p?.fw  || '');
    const bwaste = p?.wastage || '';
    const bwtl  = wallArea.l   !== undefined ? wallArea.l   : '';
    const wm    = (wallArea.w1l !== undefined && wallArea.w1l !== '') ? 'wallwise' : 'full';
    const noDoor = type === 'Kitchen'; // kitchens are open — no door deduction
    return `
    <!-- Wall measurement mode: full single length vs 4 separate walls -->
    <div style="display:flex;gap:6px;margin-bottom:10px;background:var(--bg3);border-radius:10px;padding:4px">
      <button type="button" id="${pfx}-wm-full" onclick="VW_TILES._tqWallMode('${pfx}','full')" style="flex:1;padding:7px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;background:${wm==='full'?'var(--gold)':'transparent'};color:${wm==='full'?'#000':'var(--text2)'}">Full Wall (25×7)</button>
      <button type="button" id="${pfx}-wm-wise" onclick="VW_TILES._tqWallMode('${pfx}','wallwise')" style="flex:1;padding:7px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;background:${wm==='wallwise'?'var(--gold)':'transparent'};color:${wm==='wallwise'?'#000':'var(--text2)'}">Wall-wise (4 sides)</button>
    </div>
    <input type="hidden" id="${pfx}-wallmode" value="${wm}">
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Wall Height (ft)</label><input type="number" id="${pfx}-h" value="${bh}" placeholder="7" min="1" step="0.5"></div>
    </div>
    <!-- FULL: one total length for all four walls -->
    <div id="${pfx}-wallfull" style="display:${wm==='full'?'block':'none'}">
      <div style="font-size:12px;font-weight:600;color:var(--text);margin:10px 0 8px">Total Wall Length <span style="font-weight:400;color:var(--text3)">— all sides added (e.g. 25)</span></div>
      <div class="form-row">
        <div class="form-group" style="margin:0;flex:1"><label>Total Length (ft)</label><input type="number" id="${pfx}-wtl" value="${bwtl}" placeholder="25" min="0.5" step="0.5"></div>
        ${noDoor?'':`<div class="form-group" style="margin:0;flex:1"><label>Door W (ft)</label><input type="number" id="${pfx}-dwf" value="${bdw}" placeholder="0" min="0" step="0.5"></div>
        <div class="form-group" style="margin:0;flex:1"><label>Door H (ft)</label><input type="number" id="${pfx}-dhf" value="${bdh}" placeholder="0" min="0" step="0.5"></div>`}
      </div>
    </div>
    <!-- WALL-WISE: 4 separate walls -->
    <div id="${pfx}-wallwise" style="display:${wm==='wallwise'?'block':'none'}">
      <div style="font-size:12px;font-weight:600;color:var(--text);margin:10px 0 8px">Wall 1 (Long Wall) — Length</div>
      <div class="form-group" style="margin-bottom:8px"><input type="number" id="${pfx}-w1l" value="${bw1l}" placeholder="10" min="0.5" step="0.5"></div>
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px">Wall 2 (Back) — Width</div>
      <div class="form-group" style="margin-bottom:8px"><input type="number" id="${pfx}-w2w" value="${bw2w}" placeholder="6" min="0.5" step="0.5"></div>
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px">Wall 3 (≈ Wall 1) — Length</div>
      <div class="form-group" style="margin-bottom:8px"><input type="number" id="${pfx}-w3l" value="${bw3l}" placeholder="10" min="0.5" step="0.5"></div>
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px">Wall 4 (Front${noDoor?'':' — deduct door'}) — Width</div>
      <div class="form-row">
        <div class="form-group" style="margin:0;flex:1"><label>Width</label><input type="number" id="${pfx}-w4w" value="${bw4w}" placeholder="6" min="0.5" step="0.5"></div>
        ${noDoor?'':`<div class="form-group" style="margin:0;flex:1"><label>Door W</label><input type="number" id="${pfx}-dw" value="${bdw}" placeholder="2.5" min="0" step="0.5"></div>
        <div class="form-group" style="margin:0;flex:1"><label>Door H</label><input type="number" id="${pfx}-dh" value="${bdh}" placeholder="7" min="0" step="0.5"></div>`}
      </div>
    </div>
    <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-top:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:700;color:var(--gold)">🔲 Floor Measurement</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="${pfx}-floor-chk" ${(bfl||bfw)?'checked':'checked'}
            onchange="const fg=document.getElementById('${pfx}-floor-grp');fg.style.display=this.checked?'block':'none'">
          <span style="font-size:11px;color:var(--text2)">Include floor tiles</span>
        </label>
      </div>
      <div id="${pfx}-floor-grp" style="display:block">
        <div class="form-row">
          <div class="form-group" style="margin:0;flex:1"><label>Length (ft)</label><input type="number" id="${pfx}-fl" value="${bfl}" placeholder="10" min="0.5" step="0.5"></div>
          <div class="form-group" style="margin:0;flex:1"><label>Width (ft)</label><input type="number" id="${pfx}-fw" value="${bfw}" placeholder="6" min="0.5" step="0.5"></div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">Uncheck only if floor was measured separately as another room.</div>
    </div>
    <div style="font-size:11px;color:var(--green);margin-top:4px">✓ Wastage auto-calculated from tile size &amp; cuts at the design step — no manual % needed.</div>`;}
    if (def.measureType === 'staircase') return `
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Step Width (ft)</label><input type="number" id="${pfx}-sw" placeholder="3.5" min="0.5" step="0.5"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Step Depth (ft)</label><input type="number" id="${pfx}-sd" placeholder="1" min="0.5" step="0.25"></div>
      <div class="form-group" style="margin:0;flex:1"><label>No. of Steps</label><input type="number" id="${pfx}-sn" placeholder="14" min="1" step="1"></div>
    </div>
    <div class="form-group"><label>Riser Height (ft) — optional</label><input type="number" id="${pfx}-rh" placeholder="0.5" min="0" step="0.25"></div>`;

  // Custom
  return `
    <div class="form-group"><label>Description</label><input type="text" id="${pfx}-desc" placeholder="e.g. Entrance foyer"></div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Length (ft)</label><input type="number" id="${pfx}-l" placeholder="10" min="0.5" step="0.5"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Width (ft)</label><input type="number" id="${pfx}-w" placeholder="8" min="0.5" step="0.5"></div>
    </div>
    <div style="font-size:11px;color:var(--green);margin-top:6px">✓ Wastage auto-calculated at the design step.</div>`;
}

function _tqWallMode(pfx, mode){
  const hid=document.getElementById(`${pfx}-wallmode`); if(hid) hid.value=mode;
  const full=document.getElementById(`${pfx}-wallfull`), wise=document.getElementById(`${pfx}-wallwise`);
  if(full) full.style.display = mode==='full'?'block':'none';
  if(wise) wise.style.display = mode==='wallwise'?'block':'none';
  const bf=document.getElementById(`${pfx}-wm-full`), bw=document.getElementById(`${pfx}-wm-wise`);
  if(bf){ bf.style.background=mode==='full'?'var(--gold)':'transparent'; bf.style.color=mode==='full'?'#000':'var(--text2)'; }
  if(bw){ bw.style.background=mode==='wallwise'?'var(--gold)':'transparent'; bw.style.color=mode==='wallwise'?'#000':'var(--text2)'; }
}

function tqSaveRoom(type, editIdx) {
  const label = document.getElementById('tq-room-label')?.value.trim() || type;
  const def = ROOM_DEFS[type] || ROOM_DEFS['Custom Area'];
  const pfx = 'tq-m0';
  // Wastage is truly optional - empty = 0, not 5%
  const wasteVal = document.getElementById(`${pfx}-waste`)?.value;
  const waste = wasteVal !== '' && wasteVal !== null && wasteVal !== undefined ? parseFloat(wasteVal)/100 : 0;
  const skirtVal = document.getElementById(`${pfx}-skirt`)?.value;
  const skirtRm = skirtVal !== '' && skirtVal !== null ? parseFloat(skirtVal)||0 : 0;
  const areas = [];

  if (def.measureType === 'floor_lw' || def.measureType === 'floor_lw_skirting') {
    const l = parseFloat(document.getElementById(`${pfx}-l`)?.value)||0;
    const w = parseFloat(document.getElementById(`${pfx}-w`)?.value)||0;
    if (!l||!w) { showToast('Enter length and width','warn'); return; }
    const base = l*w;
    // Skirting is in running feet; convert to sqft using chosen height (3" or 4")
    const skirtHIn = parseInt(document.getElementById(`${pfx}-skirt-h`)?.value || 4) || 4;
    const skirtSqft = skirtRm > 0 ? skirtRm * (skirtHIn/12) : 0;
    const sqft = base*(1+waste) + skirtSqft;
    const wasteLabel = waste>0 ? ` +${Math.round(waste*100)}% wastage` : '';
    const skirtLabel = skirtRm>0 ? ` +${skirtRm}ft skirting (${skirtHIn}")` : '';
    areas.push({ label:`${l}ft × ${w}ft${wasteLabel}${skirtLabel}`, sqft, base, l, w, wastage:waste>0?Math.round(waste*100):0, skirting:skirtRm, skirtingHeightIn:skirtHIn });
  } else if (def.measureType === 'wall_hw') {
    const h = parseFloat(document.getElementById(`${pfx}-h`)?.value)||0;
    const w = parseFloat(document.getElementById(`${pfx}-w`)?.value)||0;
    if (!h||!w) { showToast('Enter height and width','warn'); return; }
    const base = h*w;
    const sqft = base*(1+waste);
    areas.push({ label:`${h}ft H × ${w}ft W${waste>0?` +${Math.round(waste*100)}% wastage`:''}`, sqft, base, h, w, wastage:waste>0?Math.round(waste*100):0 });
  } else if (def.measureType === 'bathroom') {
    const wm = document.getElementById(`${pfx}-wallmode`)?.value || 'full';
    const h = parseFloat(document.getElementById(`${pfx}-h`)?.value)||0;
    const flChk = document.getElementById(`${pfx}-floor-chk`);
    const includeFloor = !flChk || flChk.checked; // default true if no checkbox found
    const fl = includeFloor ? (parseFloat(document.getElementById(`${pfx}-fl`)?.value)||0) : 0;
    const fw = includeFloor ? (parseFloat(document.getElementById(`${pfx}-fw`)?.value)||0) : 0;
    const floor = fl&&fw ? fl*fw*(1+waste) : 0;
    let wallBase = 0, wallMeta = null, wallLabel = '';
    if (wm === 'full') {
      // Customer gives one full perimeter length × height (e.g. 25 × 7).
      const wtl = parseFloat(document.getElementById(`${pfx}-wtl`)?.value)||0;
      const dwf = parseFloat(document.getElementById(`${pfx}-dwf`)?.value)||0;
      const dhf = parseFloat(document.getElementById(`${pfx}-dhf`)?.value)||0;
      if (h && wtl) {
        wallBase = Math.max(0, wtl*h - dwf*dhf);
        wallMeta = { subType:'wall', l:wtl, w:h, h, dw:dwf, dh:dhf, mode:'full' };
        wallLabel = `Wall ${wtl}×${h}ft`;
      }
    } else {
      const w1l = parseFloat(document.getElementById(`${pfx}-w1l`)?.value)||0;
      const w2w = parseFloat(document.getElementById(`${pfx}-w2w`)?.value)||0;
      const w3l = parseFloat(document.getElementById(`${pfx}-w3l`)?.value)||w1l;
      const w4w = parseFloat(document.getElementById(`${pfx}-w4w`)?.value)||0;
      const dw = parseFloat(document.getElementById(`${pfx}-dw`)?.value)||0;
      const dh = parseFloat(document.getElementById(`${pfx}-dh`)?.value)||0;
      if (h) {
        const wall1=h*w1l, wall2=h*w2w, wall3=h*w3l, wall4=Math.max(0,h*w4w-dw*dh);
        wallBase = wall1+wall2+wall3+wall4;
        if (wallBase>0) { wallMeta = { subType:'wall', h, w1l, w2w, w3l, w4w, dw, dh, l:(w1l+w2w+w3l+w4w), w:h, mode:'wallwise' }; wallLabel = 'Walls (4 sides)'; }
      }
    }
    if (!wallBase && !floor) { showToast('Enter wall height + length, or floor dimensions','warn'); return; }
    if (wallBase > 0 && wallMeta) areas.push({ label:wallLabel, sqft:wallBase*(1+waste), base:wallBase, ...wallMeta, wastage:waste>0?Math.round(waste*100):0 });
    if (floor) areas.push({ label:`Floor ${fl}×${fw}ft`, sqft:floor, base:fl*fw, subType:'floor', l:fl, w:fw, wastage:waste>0?Math.round(waste*100):0 });
  } else if (def.measureType === 'staircase') {
    const sw=parseFloat(document.getElementById(`${pfx}-sw`)?.value)||0;
    const sd=parseFloat(document.getElementById(`${pfx}-sd`)?.value)||0;
    const sn=parseInt(document.getElementById(`${pfx}-sn`)?.value)||0;
    const rh=parseFloat(document.getElementById(`${pfx}-rh`)?.value)||0;
    if (!sw||!sd||!sn) { showToast('Enter step dimensions and count','warn'); return; }
    const tread=sw*sd*sn, riser=rh>0?sw*rh*sn:0;
    const sqft=(tread+riser)*(1+waste);
    areas.push({ label:`${sn} steps × ${sw}ft × ${sd}ft${rh>0?` + ${rh}ft riser`:''}`, sqft, base:tread+riser, sn, sw, sd, rh, wastage:waste>0?Math.round(waste*100):0 });
  } else {
    const l=parseFloat(document.getElementById(`${pfx}-l`)?.value)||0;
    const w=parseFloat(document.getElementById(`${pfx}-w`)?.value)||0;
    if (!l||!w) { showToast('Enter dimensions','warn'); return; }
    areas.push({ label:`${l}ft × ${w}ft`, sqft:l*w*(1+waste), base:l*w, l, w, wastage:waste>0?Math.round(waste*100):0 });
  }

  if (!areas.length || !areas[0].sqft) { showToast('Could not calculate area — check dimensions','warn'); return; }

  if (editIdx !== undefined && editIdx >= 0) {
    _tqState.rooms[editIdx] = { id: _tqState.rooms[editIdx].id, type, label, areas, def, flat: _tqState.rooms[editIdx].flat || '' };
    showToast('Room updated ✓', 'success');
  } else {
    _tqState.rooms.push({ id: Date.now(), type, label, areas, def, flat: _tqState.currentFlat || '' });
  }
  closeSheet();
  _refreshStep1();
}

function tqAddArea(roomIdx) {
  const room = _tqState.rooms[roomIdx];
  if (!room) return;
  const def = ROOM_DEFS[room.type];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">+ Extra Area for ${room.label}</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div class="form-group"><label>Area Description</label><input type="text" id="tq-extra-label" placeholder="e.g. Gallery / Extension"></div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Length / Height (ft)</label><input type="number" id="tq-extra-l" placeholder="0" min="0.5" step="0.5"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Width (ft)</label><input type="number" id="tq-extra-w" placeholder="0" min="0.5" step="0.5"></div>
    </div>
    <div class="form-group"><label>Wastage %</label><input type="number" id="tq-extra-waste" placeholder="5" min="0" max="30" step="1"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Cancel</button>
      <button class="btn-primary" style="flex:1" onclick="VW_TILES.tqSaveExtraArea(${roomIdx})">Add Area</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function tqSaveExtraArea(roomIdx) {
  const lbl = document.getElementById('tq-extra-label')?.value.trim() || 'Extra Area';
  const l = parseFloat(document.getElementById('tq-extra-l')?.value)||0;
  const w = parseFloat(document.getElementById('tq-extra-w')?.value)||0;
  const waste = parseFloat(document.getElementById('tq-extra-waste')?.value||5)/100;
  if (!l||!w) { showToast('Enter dimensions','warn'); return; }
  const sqft = l*w*(1+waste);
  _tqState.rooms[roomIdx].areas.push({ label:`${lbl}: ${l}×${w}ft${waste>0?` +${Math.round(waste*100)}% wastage`:''}`, sqft, base:l*w, l, w, waste });
  closeSheet();
  _refreshStep1();
}

function tqRemoveRoom(i) {
  _tqState.rooms.splice(i,1);
  _refreshStep1();
}

function _tqTotalSqft() {
  return (_tqState.rooms||[]).reduce((s,r)=>s+(r.areas||[]).reduce((ss,a)=>ss+(a.sqft||0),0),0);
}

function _refreshStep1() {
  const el = document.getElementById('tq-step-content');
  if (el) el.innerHTML = _renderStep1();
}

// ───── STEP 2: TILE SIZE (per room) ─────────────────────────
// Each room gets its own tile size selection. We show one room at a time.

// ─── SHARED: get all tile selection slots (expands bathroom into wall+floor) ──
function _getTileSlots() {
  const slots = [];
  (_tqState.rooms || []).forEach(r => {
    const hasWall  = r.areas?.some(a => a.subType === 'wall');
    const hasFloor = r.areas?.some(a => a.subType === 'floor' || !a.subType);
    if ((r.def?.areaType === 'both') || (hasWall && hasFloor)) {
      const wallSqft  = (r.areas||[]).filter(a=>a.subType==='wall').reduce((s,a)=>s+(a.sqft||0),0);
      const floorSqft = (r.areas||[]).filter(a=>a.subType==='floor'||!a.subType).reduce((s,a)=>s+(a.sqft||0),0);
      if (wallSqft  > 0) slots.push({ id: r.id+'_wall',  room:r, subType:'wall',  sqft:wallSqft,  label:(r.label||r.type)+' — Wall',  icon:'🧱' });
      if (floorSqft > 0) slots.push({ id: r.id+'_floor', room:r, subType:'floor', sqft:floorSqft, label:(r.label||r.type)+' — Floor', icon:'🔲' });
    } else {
      const sqft = r.areas?.reduce((s,a)=>s+(a.sqft||0),0)||0;
      slots.push({ id: r.id, room:r, subType: hasWall ? 'wall' : 'floor', sqft, label:r.label||r.type, icon: ROOM_DEFS[r.type]?.icon||'🏠' });
    }
  });
  return slots;
}

async function _renderStep2() {
  const rooms = _tqState.rooms;
  if (!rooms || !rooms.length) return `<div class="card"><p style="color:var(--text3)">Add rooms first</p></div>`;

  let cfg;
  try { cfg = await VW_DB.getSetting('tile_weight_config', { sizes:[] }); }
  catch(e) { cfg = { sizes:[] }; }
  const activeMms = (cfg.sizes||[]).filter(s=>s.active!==false).map(s=>s.mm);
  const visible = activeMms.length > 0 ? TILE_SIZES.filter(ts=>activeMms.includes(ts.mm)) : TILE_SIZES;

  // Expand rooms into SELECTION SLOTS
  // Bathroom/Toilet with both wall + floor areas → two slots: roomId_wall and roomId_floor
  // All other rooms → one slot: roomId
  const slots = [];
  rooms.forEach(r => {
    let wallSqft = 0, floorSqft = 0; // declare at outer scope so always defined
    const hasWall = r.areas?.some(a => a.subType === 'wall');
    const hasFloor = r.areas?.some(a => a.subType === 'floor' || !a.subType);
    if (r.def?.areaType === 'both' || (hasWall && hasFloor)) {
      wallSqft  = (r.areas||[]).filter(a=>a.subType==='wall').reduce((s,a)=>s+(a.sqft||0),0);
      floorSqft = (r.areas||[]).filter(a=>a.subType==='floor'||!a.subType).reduce((s,a)=>s+(a.sqft||0),0);
      if (wallSqft  > 0) slots.push({ id: r.id + '_wall',  room: r, label: `${r.label||r.type} — Wall`,  icon:'🧱', subType:'wall',  sqft: wallSqft });
      if (floorSqft > 0) slots.push({ id: r.id + '_floor', room: r, label: `${r.label||r.type} — Floor`, icon:'🔲', subType:'floor', sqft: floorSqft });
    } else {
      wallSqft = (r.areas||[]).filter(a=>a.subType==='wall').reduce((s,a)=>s+(a.sqft||0),0);
      floorSqft = (r.areas||[]).filter(a=>a.subType==='floor'||!a.subType).reduce((s,a)=>s+(a.sqft||0),0);
      const totalSqft = wallSqft + floorSqft || (r.areas||[]).reduce((s,a)=>s+(a.sqft||0),0);
      slots.push({ id: r.id, room: r, label: r.label||r.type, icon: ROOM_DEFS[r.type]?.icon||'🏠', subType: hasWall ? 'wall' : 'floor', sqft: totalSqft });
    }
  });

  const pendingSlots = slots.filter(s => !_tqState.tileSelections[s.id]);
  const doneSlots = slots.filter(s => _tqState.tileSelections[s.id]);
  const currentSlot = pendingSlots[0] || slots[slots.length-1];
  const currentSel = _tqState.tileSelections[currentSlot?.id];

  // Filter sizes by subType (wall tiles vs floor tiles)
  const wallTypes = ['wall','dado','bathroom','kitchen'];
  const floorTypes = ['floor','parking','elevation'];
  const visibleSizes = visible.filter(ts => {
    if (!currentSlot) return true;
    if (currentSlot.subType === 'wall') return ts.type?.some(t => wallTypes.includes(t));
    if (currentSlot.subType === 'floor') return ts.type?.some(t => floorTypes.includes(t));
    return true;
  });
  // If filtered set is empty (unusual size config), show all
  const sizesToShow = visibleSizes.length >= 3 ? visibleSizes : visible;

  // Per-size stock availability — surface which sizes have ready stock vs. order-based
  // up front, so a size can never dead-end into "no product available" at the design step.
  let stockBySize = {};
  try {
    const { data: stk } = await VW_DB.client.from('products').select('tile_size_mm,stock').eq('category','Tiles').gt('stock',0);
    (stk||[]).forEach(p => {
      const k = (p.tile_size_mm||'').replace(/\s/g,'').toLowerCase();
      if (k) stockBySize[k] = (stockBySize[k]||0) + 1;
    });
  } catch(e) {}

  return `
  <!-- Progress: all slots (rooms × subtype) -->
  <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
    ${slots.map(s => {
      const sel = _tqState.tileSelections[s.id];
      const isCurrent = s.id === currentSlot?.id;
      return `<div style="flex:1;min-width:80px;padding:6px 8px;border-radius:8px;
        background:${sel?'rgba(34,197,94,0.1)':isCurrent?'var(--gold-muted)':'var(--bg2)'};
        border:1px solid ${sel?'var(--green)':isCurrent?'var(--gold)':'var(--border)'};
        font-size:10px;text-align:center">
        <div style="font-size:14px">${s.icon}</div>
        <div style="font-weight:700;color:${sel?'var(--green)':isCurrent?'var(--gold)':'var(--text3)'}">${s.label}</div>
        <div style="color:var(--text3)">${sel?sel.sizeMm+'mm ✓':isCurrent?'Selecting...':'Pending'}</div>
        <div style="color:var(--text3);font-size:9px">${s.sqft.toFixed(1)} sqft</div>
      </div>`;
    }).join('')}
  </div>

  ${currentSlot ? `
  <div class="card" style="border-color:var(--gold-border)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:22px">${currentSlot.icon}</span>
      <div>
        <h3 class="card-title" style="margin:0">${currentSlot.label}</h3>
        <div style="font-size:11px;color:var(--text3)">${currentSlot.sqft.toFixed(1)} sqft · ${currentSlot.subType === 'wall' ? 'Wall tiles — thinner, finer finish' : 'Floor tiles — anti-skid, durable'}</div>
      </div>
    </div>
    ${sizesToShow.length < visible.length ? `
    <div style="font-size:11px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:7px;padding:6px 10px;margin-bottom:10px;color:var(--text2)">
      Showing ${currentSlot.subType === 'wall' ? 'wall tile sizes' : 'floor tile sizes'} · <button onclick="VW_TILES._showAllSizesForSlot('${currentSlot.id}')" style="background:none;border:none;color:#60A5FA;cursor:pointer;font-size:11px;padding:0">Show all sizes</button>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
      ${sizesToShow.map(ts => {
        const sel = currentSel?.sizeId === ts.id;
        const _cnt = stockBySize[(ts.mm||'').replace(/\s/g,'').toLowerCase()] || 0;
        return `<button onclick="VW_TILES.tqSelectSizeForRoom('${currentSlot.id}','${ts.id}','${currentSlot.room.id}')"
          style="padding:10px 8px;border-radius:10px;cursor:pointer;text-align:left;
            background:${sel?'var(--gold-muted)':'var(--bg2)'};
            border:${sel?'2px solid var(--gold)':'1px solid var(--border)'}">
          <div style="font-size:13px;font-weight:700;color:${sel?'var(--gold)':'var(--text)'}">${ts.mm}mm</div>
          <div style="font-size:10px;color:var(--text3)">${ts.inch}</div>
          <div style="font-size:10px;color:var(--text3)">${(ts.type||[]).join(', ')}</div>
          <div style="font-size:10px;margin-top:3px;font-weight:600;color:${_cnt?'var(--green)':'var(--text3)'}">${_cnt ? '✓ '+_cnt+' design'+(_cnt>1?'s':'')+' in stock' : '◦ Order-based'}</div>
        </button>`;
      }).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Nav -->
  ${pendingSlots.length === 0 ? `
  <!-- ALL SLOTS DONE -->
  <div class="card" style="border-color:rgba(34,197,94,0.3);margin-top:10px;background:rgba(34,197,94,0.04)">
    <div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:8px">✅ All areas selected</div>
    ${slots.map(s=>`<div style="font-size:11px;color:var(--text3);margin-bottom:2px">${s.label} — ${(_tqState.tileSelections[s.id]?.sizeMm||'?')}mm ✓</div>`).join('')}
    <button class="btn-primary full-width" style="margin-top:10px" onclick="VW_TILES.tqNext()">
      Continue → Design
    </button>
  </div>` : currentSel ? `
  <!-- CURRENT SLOT SELECTED, MORE PENDING -->
  <div class="card" style="border-color:rgba(34,197,94,0.3);margin-top:10px">
    <div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:6px">✓ ${currentSlot.label} — ${currentSel.sizeMm}mm</div>
    <button class="btn-primary full-width" onclick="VW_TILES.tqNextRoom()">
      Next → ${pendingSlots[0]?.label}
    </button>
  </div>` : ''}

  <!-- Already selected summary -->
  ${doneSlots.length && pendingSlots.length ? `
  <div style="margin-top:10px;font-size:11px;color:var(--text3)">
    <strong>Done:</strong> ${doneSlots.map(s=>`${s.label} (${_tqState.tileSelections[s.id]?.sizeMm}mm)`).join(' · ')}
  </div>` : ''}

  <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES.tqBack()">← Back to Rooms</button>`;
}

function _showAllSizesForSlot(slotId) {
  // Remove the subType filter and re-render step 2 showing all sizes
  // Achieved by temporarily storing a flag in tileSelections
  if (!_tqState._showAllSizes) _tqState._showAllSizes = {};
  _tqState._showAllSizes[slotId] = true;
  _renderStep2().then(html => { const el = document.getElementById('tq-step-content'); if(el) el.innerHTML = html; });
}
function tqSelectSizeForRoom(slotId, sizeId, roomId) {
  const sz = TILE_SIZES.find(s=>s.id===sizeId);
  if (!sz) return;
  const _prevMm = _tqState.tileSelections[slotId]?.sizeMm; // detect a real size change
  // slotId may be roomId or roomId_wall or roomId_floor
  const actualRoomId = roomId || slotId;
  if (!_tqState.tileSelections[slotId]) _tqState.tileSelections[slotId] = {};
  _tqState.tileSelections[slotId].sizeId = sizeId;
  _tqState.tileSelections[slotId].sizeMm = sz.mm;
  _tqState.tileSelections[slotId].sizeLabel = sz.label;
  // Merge tiles_per_box from tile_weight_config into the size object so
  // _submitTileTotal and other callers always have the correct box count
  const _cfgEntry = (_tqSizeCfg?.sizes||[]).find(s=>s.mm===sz.mm);
  _tqState.tileSelections[slotId].size = { ...sz, tilesPerBox: _cfgEntry?.tiles_per_box || sz.tilesPerBox };
  _tqState.tileSelections[slotId].slotId = slotId;
  _tqState.tileSelections[slotId].roomId = actualRoomId;
  // subType: detect from slotId suffix
  _tqState.tileSelections[slotId].subType = slotId.endsWith('_wall') ? 'wall' : slotId.endsWith('_floor') ? 'floor' : null;
  // Size actually changed → drop design-step caches built for the OLD size, so the Design
  // step re-fetches tiles, palette and layout for the new size (fixes stale 300×450 showing
  // after switching to e.g. 600×1200).
  if (_prevMm && _prevMm !== sz.mm) {
    if (_tqState._dsTilesCache) delete _tqState._dsTilesCache[slotId];
    if (_tqState.design)        delete _tqState.design[slotId];
    if (_tqState.wallDesigns)   delete _tqState.wallDesigns[slotId];
  }
  // Auto-init spacer for this slot
  if (!_tqState.spacerSelections[slotId]) {
    const mmVal = parseInt(sz.mm.split('×')[0]);
    _tqState.spacerSelections[slotId] = { use: mmVal >= 300, mm: 3 };
  }
  // Re-render step 2 with proper error handling so it doesn't spin forever
  const el = document.getElementById('tq-step-content');
  if (el) el.innerHTML = '<div style="padding:20px;text-align:center"><div class="spinner"></div></div>';
  _renderStep2().then(html => {
    if (el) el.innerHTML = html;
  }).catch(err => {
    console.error('tqSelectSizeForRoom render error:', err);
    if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)">Error loading sizes — <button onclick="VW_TILES.tqBack()" style="color:var(--gold);background:none;border:none;cursor:pointer">go back</button></div>';
  });
}

// Legacy compat — single room selection
function tqSelectSize(id) { tqSelectSizeForRoom(_tqState.rooms[0]?.id, id, _tqState.rooms[0]?.id); }
function tqNextRoom() {
  const el = document.getElementById('tq-step-content');
  if (el) el.innerHTML = '<div style="padding:20px;text-align:center"><div class="spinner"></div></div>';
  _renderStep2().then(html => {
    if (el) el.innerHTML = html;
  }).catch(err => {
    console.error('tqNextRoom error:', err);
    if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)">Error — <button onclick="VW_TILES.tqBack()" style="color:var(--gold);background:none;border:none;cursor:pointer">go back</button></div>';
  });
}

// Legacy compat

// ───── STEP 3: SPACER (per room) ────────────────────────────
// Shared helper — converts tile dimensions (mm) to square feet per tile.
// Single source of truth; replaces 21 inline copies of (mm/25.4)*(mm/25.4)/144.
function tileSqftPerTile(mmH, mmW) {
  return (mmH / 25.4) * (mmW / 25.4) / 144;
}

// Spacers-per-tile for a given size: per-size value from Tile Settings, else the
// global default, else a size-based fallback. Single source of truth for the calc.
function _spacersPerTileFor(sz) {
  if (!sz) return _tqSpacerCfg.spacers_per_tile || 4;
  const cfg = (_tqSizeCfg.sizes || []).find(s => s.mm === sz.mm);
  if (cfg && cfg.spacers_per_tile) return cfg.spacers_per_tile;
  const maxMm = Math.max(...sz.mm.split('×').map(Number));
  return _tqSpacerCfg.spacers_per_tile || (maxMm >= 600 ? 6 : 4);
}

function _renderStep3() {
  const slots3 = _getTileSlots();
  const spacerType = _tqState.spacerType || 'plus';
  const plusPkt = _tqSpacerCfg.pcs_per_packet || 100;
  const clipPkt = _tqSpacerCfg.clip_pcs_per_packet || 50;
  const packetSize = spacerType === 'clip' ? clipPkt : plusPkt;

  // Auto-initialise spacer selections for every slot on first entry — 2mm cross by default
  if (!_tqState.spacerSelections) _tqState.spacerSelections = {};
  slots3.forEach(slot => {
    if (!_tqState.spacerSelections[slot.id]) {
      const sel = _tqState.tileSelections[slot.id] || {};
      const maxMm = sel.size?.mm ? Math.max(...sel.size.mm.split('×').map(Number)) : 600;
      _tqState.spacerSelections[slot.id] = { use: maxMm >= 300, mm: 3 };
    }
  });

  let totalTiles = 0, totalSpacers = 0;
  const rows = slots3.map(slot => {
    const r = slot.room;
    const sel = _tqState.tileSelections[slot.id] || {};
    const sp = _tqState.spacerSelections[slot.id] || { use: true, mm: 3 };
    const sz = sel.size;
    const roomSqft = slot.sqft;
    const [mmL, mmW] = sz ? sz.mm.split('×').map(Number) : [600,600];
    const sqftPerTile = tileSqftPerTile(mmL, mmW);
    const sptile = _spacersPerTileFor(sz);
    const tilesNeeded = sqftPerTile > 0 ? Math.ceil(roomSqft / sqftPerTile) : 0;
    const use = !!sp.use && !!sz;
    const slotSpacers = use ? tilesNeeded * sptile : 0;
    if (use) { totalTiles += tilesNeeded; totalSpacers += slotSpacers; }
    return { room:r, slot, use, sp, roomSqft, sz, tilesNeeded, sptile, slotSpacers };
  });

  // Whole-quotation packet suggestion — ONE rounding on the grand total, so a
  // half-packet left over in one room isn't double-charged in the next.
  const totalPackets = packetSize > 0 ? Math.ceil(totalSpacers / packetSize) : 0;
  _tqState.spacerResult = { type: spacerType, packetSize, totalTiles, totalSpacers, totalPackets, plusPkt, clipPkt };

  const typeBtn = (id, label, sub) => `
    <button onclick="VW_TILES.tqSetSpacerType('${id}')"
      style="flex:1;padding:8px;border-radius:8px;cursor:pointer;text-align:left;
        border:${spacerType===id?'2px solid var(--gold)':'1px solid var(--border)'};
        background:${spacerType===id?'var(--gold-muted)':'var(--bg2)'}">
      <div style="font-size:12px;font-weight:700;color:${spacerType===id?'var(--gold)':'var(--text)'}">${label}</div>
      <div style="font-size:10px;color:var(--text3)">${sub}</div>
    </button>`;

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Spacer Selection</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">
      Auto-filled: ✚ Cross, 2mm (standard). Mestri can change type or size per area.
    </p>

    <div style="font-size:11px;color:var(--text3);font-weight:600;margin-bottom:6px">Spacer type</div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      ${typeBtn('plus','✚ Cross / Plus', plusPkt+' pcs per packet · standard')}
      ${typeBtn('clip','📎 Clip + Plug', clipPkt+' pcs each · Mestri preference')}
    </div>

    ${rows.map(({room, slot, use, sp, roomSqft, sz, tilesNeeded, sptile, slotSpacers}) => `
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700">${slot?.label || room.label||room.type}</div>
          <div style="font-size:11px;color:var(--text3)">${sz?.mm||'No tile selected'}mm · ${roomSqft.toFixed(1)} sqft</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="VW_TILES.tqSetSpacerForRoom('${slot?.id||room.id}',true)"
            style="padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;
              border:${use?'2px solid var(--gold)':'1px solid var(--border)'};
              background:${use?'var(--gold-muted)':'var(--bg3)'};
              color:${use?'var(--gold)':'var(--text3)'}">Yes</button>
          <button onclick="VW_TILES.tqSetSpacerForRoom('${slot?.id||room.id}',false)"
            style="padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;
              border:${!use?'2px solid var(--red)':'1px solid var(--border)'};
              background:${!use?'rgba(239,68,68,0.1)':'var(--bg3)'};
              color:${!use?'var(--red)':'var(--text3)'}">No spacer</button>
        </div>
      </div>
      ${use && sz ? `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <span style="font-size:11px;color:var(--text3)">Joint width:</span>
        ${[2,3,4,5].map(mm=>`<button onclick="VW_TILES.tqSetSpacerMmForRoom('${slot?.id||room.id}',${mm})"
          style="padding:3px 8px;border-radius:5px;font-size:11px;cursor:pointer;
            border:${(sp.mm||3)===mm?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${(sp.mm||3)===mm?'var(--gold-muted)':'var(--bg3)'};
            color:${(sp.mm||3)===mm?'var(--gold)':'var(--text)'}">${mm}mm${mm===3?' ✓':''}</button>`).join('')}
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:8px;font-size:11px">
        <span style="color:var(--text3)">${tilesNeeded} tiles × ${sptile} per tile = </span>
        <strong style="color:var(--gold)">${slotSpacers} spacers</strong>
      </div>` : `<div style="font-size:11px;color:var(--text3)">No spacers for this area</div>`}
    </div>`).join('')}

    ${totalSpacers > 0 ? `
    <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:10px;padding:12px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px">
        <span>${totalTiles} tiles · ${totalSpacers} spacers needed</span>
        <span>${packetSize}/packet</span>
      </div>
      ${spacerType==='clip' ? `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700">Clip + Plug / Bush</span>
        <span style="font-size:14px;font-weight:800;color:var(--gold)">${totalPackets} pkt each</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div style="background:var(--bg3);border-radius:8px;padding:8px">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">📎 Clips (${clipPkt}/pkt)</div>
          <div style="display:flex;align-items:center;gap:6px">
            <button onclick="VW_TILES.tqAdjClipPkts(-1)" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:14px">−</button>
            <span style="font-size:16px;font-weight:800;color:var(--gold);min-width:24px;text-align:center" id="tq-clip-pkts">${_tqState._clipPkts ?? totalPackets}</span>
            <button onclick="VW_TILES.tqAdjClipPkts(1)" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:14px">+</button>
          </div>
          <div style="font-size:10px;color:var(--gold);margin-top:3px;font-weight:700">₹170/pkt · ₹${((_tqState._clipPkts??totalPackets)*170).toLocaleString('en-IN')}</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:8px">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">🔩 Clip Bush (${clipPkt}/pkt)</div>
          <div style="display:flex;align-items:center;gap:6px">
            <button onclick="VW_TILES.tqAdjBushPkts(-1)" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:14px">−</button>
            <span style="font-size:16px;font-weight:800;color:var(--gold);min-width:24px;text-align:center" id="tq-bush-pkts">${_tqState._bushPkts ?? totalPackets}</span>
            <button onclick="VW_TILES.tqAdjBushPkts(1)" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:14px">+</button>
          </div>
          <div style="font-size:10px;color:var(--gold);margin-top:3px;font-weight:700">₹170/pkt · ₹${((_tqState._bushPkts??totalPackets)*170).toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text3)">Both clips and bush are required. Adjust packets if mestri estimates differently.</div>` : `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:700">Total Spacers · ₹90/pkt</span>
        <span style="font-size:18px;font-weight:800;color:var(--gold)">${totalPackets} packets</span>
      </div>
      <div style="font-size:11px;color:var(--gold);font-weight:700;margin-top:2px">₹${(totalPackets*90).toLocaleString('en-IN')}</div>`}
      <div style="font-size:10px;color:var(--text3);margin-top:4px">Rounded once across the whole quotation — no half-packet wasted between rooms.</div>
    </div>` : ''}
  </div>
  <button class="btn-primary full-width" onclick="VW_TILES.tqNext()">Next → Adhesive</button>
  <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES.tqBack()">← Back</button>`;
}

function tqSetSpacerType(type) {
  _tqState.spacerType = type;
  if (type !== 'clip') { delete _tqState._clipPkts; delete _tqState._bushPkts; }
  const el = document.getElementById('tq-step-content');
  if (el) el.innerHTML = _renderStep3();
}
function tqAdjClipPkts(delta) {
  const current = _tqState._clipPkts ?? (_tqState.spacerResult?.totalPackets || 0);
  _tqState._clipPkts = Math.max(0, current + delta);
  const el = document.getElementById('tq-step-content');
  if (el) el.innerHTML = _renderStep3();
}
function tqAdjBushPkts(delta) {
  const current = _tqState._bushPkts ?? (_tqState.spacerResult?.totalPackets || 0);
  _tqState._bushPkts = Math.max(0, current + delta);
  const el = document.getElementById('tq-step-content');
  if (el) el.innerHTML = _renderStep3();
}

function tqSetSpacerForRoom(roomId, use) {
  if (!_tqState.spacerSelections[roomId]) _tqState.spacerSelections[roomId] = { mm: 3 };
  _tqState.spacerSelections[roomId].use = use;
  document.getElementById('tq-step-content').innerHTML = _renderStep3();
}

function tqSetSpacerMmForRoom(roomId, mm) {
  if (!_tqState.spacerSelections[roomId]) _tqState.spacerSelections[roomId] = { use: true };
  _tqState.spacerSelections[roomId].mm = mm;
  document.getElementById('tq-step-content').innerHTML = _renderStep3();
}

// Legacy compat
function tqSetSpacer(use) { Object.keys(_tqState.spacerSelections).forEach(id => _tqState.spacerSelections[id].use = use); document.getElementById('tq-step-content').innerHTML = _renderStep3(); }
function tqSetSpacerMm(mm) { Object.keys(_tqState.spacerSelections).forEach(id => _tqState.spacerSelections[id].mm = mm); document.getElementById('tq-step-content').innerHTML = _renderStep3(); }


// ───── STEP 4: ADHESIVE (per room, floor vs wall aware) ────
function _renderStep4() {
  const rooms = _tqState.rooms;
  let totalAdhBags = 0, totalCemBags = 0, totalSandBags = 0;

  // Use slots so bathroom wall and floor get separate adhesive calculation
  const slots4 = _getTileSlots();
  const roomAdh = slots4.map(slot => {
    const r = slot.room;
    const sel = _tqState.tileSelections[slot.id] || {};
    const sz = sel.size;
    const sizeMm = sz ? parseInt(sz.mm.split('×')[0]) : 300;
    const isLarge = sizeMm >= 600;
    const isWall = slot.subType === 'wall';
    const isFloor = slot.subType === 'floor' || !slot.subType;
    const roomSqft = slot.sqft;
    const wallSqft = isWall ? roomSqft : 0;
    const floorSqft = isFloor ? roomSqft : 0;

    // Method: stored in adhesiveSelections, or auto-pick
    const existingMethod = _tqState.adhesiveSelections?.[slot.id]?.method;
    // Wall: always adhesive. Floor + large tile: adhesive. Floor + small: mortar option
    const method = existingMethod || (isWall ? 'adhesive' : isLarge ? 'adhesive' : 'adhesive');
    const isNone = method === 'none';
    const adhType = isLarge ? 'C2 Premium (T2)' : 'C1 Standard (T1)';
    const floorCoverage = isLarge ? 40 : 44;
    const wallCoverage = isLarge ? 30 : 40;

    // Calculate bags — skip if none
    const coverage = isWall ? wallCoverage : floorCoverage;
    let adhBags = 0, cemBags = 0, sandBags = 0;
    if (!isNone) {
      if (method === 'mortar') {
        cemBags = Math.ceil(roomSqft * 4 / 100);
        sandBags = Math.ceil(roomSqft * 11 / 100);
      } else if (method === 'mix') {
        const full = roomSqft > 0 ? Math.ceil(roomSqft / coverage) : 0;
        cemBags = Math.ceil(full / 6);
        adhBags = Math.max(0, full - cemBags);
      } else {
        adhBags = roomSqft > 0 ? Math.ceil(roomSqft / coverage) : 0;
      }
    }

    // Auto-populate adhesiveSelections so BOM is always accurate
    if (!_tqState.adhesiveSelections) _tqState.adhesiveSelections = {};
    _tqState.adhesiveSelections[slot.id] = { method, adhBags, cemBags, sandBags };

    return { room: r, slot, sz, sizeMm, isLarge, isWall, isFloor, roomSqft, wallSqft, floorSqft, method, isNone, adhType, floorCoverage, wallCoverage, adhBags, cemBags, sandBags };
  });

  // Aggregate totals from slots
  _getTileSlots().forEach(slot => {
    const adh = _tqState.adhesiveSelections?.[slot.id];
    const r = slot.room;
    if (adh) {
      totalAdhBags += adh.adhBags || 0;
      totalCemBags += adh.cemBags || 0;
      totalSandBags += adh.sandBags || 0;
    }
  });

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Adhesive — Per Room</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">
      Pick adhesive or cement mortar for each area. Default is ready-mix adhesive; switch any area to traditional cement + sand.
    </p>

    ${roomAdh.map(({room, slot, sz, sizeMm, isLarge, isWall, isFloor, roomSqft, wallSqft, floorSqft, method, isNone, adhType, floorCoverage, wallCoverage, adhBags, cemBags, sandBags}) => `
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700">${slot?.label||room.label||room.type}</div>
          <div style="font-size:10px;color:var(--text3)">${sz?.mm||'No tile'}mm · ${roomSqft.toFixed(1)} sqft · ${isWall?'Wall tile':'Floor tile'}${isLarge?' · Large format':''}</div>
        </div>
        ${isLarge || isWall ? `<span style="font-size:10px;background:rgba(245,200,66,0.15);color:var(--gold);border-radius:5px;padding:2px 7px;font-weight:600">${isWall?'Wall':'Large'} · ${adhType}</span>` : ''}
      </div>

      ${roomSqft > 0 ? `
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
        <button onclick="VW_TILES.setAdhMethodForRoom('${slot?.id||room.id}','adhesive')"
          style="flex:1;min-width:70px;padding:6px;border-radius:7px;font-size:11px;cursor:pointer;
            border:${method==='adhesive'?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${method==='adhesive'?'var(--gold-muted)':'var(--bg3)'}">
          <div style="font-weight:600;color:${method==='adhesive'?'var(--gold)':'var(--text)'}">Ready-mix</div>
          <div style="font-size:9px;color:var(--text3)">${adhType}</div>
        </button>
        <button onclick="VW_TILES.setAdhMethodForRoom('${slot?.id||room.id}','mix')"
          style="flex:1;min-width:70px;padding:6px;border-radius:7px;font-size:11px;cursor:pointer;
            border:${method==='mix'?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${method==='mix'?'var(--gold-muted)':'var(--bg3)'}">
          <div style="font-weight:600;color:${method==='mix'?'var(--gold)':'var(--text)'}">Adh + Cement</div>
          <div style="font-size:9px;color:var(--text3)">Mestri mix</div>
        </button>
        <button onclick="VW_TILES.setAdhMethodForRoom('${slot?.id||room.id}','mortar')"
          style="flex:1;min-width:70px;padding:6px;border-radius:7px;font-size:11px;cursor:pointer;
            border:${method==='mortar'?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${method==='mortar'?'var(--gold-muted)':'var(--bg3)'}">
          <div style="font-weight:600;color:${method==='mortar'?'var(--gold)':'var(--text)'}">Mortar</div>
          <div style="font-size:9px;color:var(--text3)">Cement + sand</div>
        </button>
        <button onclick="VW_TILES.setAdhMethodForRoom('${slot?.id||room.id}','none')"
          style="flex:1;min-width:70px;padding:6px;border-radius:7px;font-size:11px;cursor:pointer;
            border:${method==='none'?'2px solid var(--red)':'1px solid var(--border)'};
            background:${method==='none'?'rgba(239,68,68,0.08)':'var(--bg3)'}">
          <div style="font-weight:600;color:${method==='none'?'var(--red)':'var(--text3)'}">⊘ None</div>
          <div style="font-size:9px;color:var(--text3)">Not required</div>
        </button>
      </div>` : ''}

      ${method==='mix' && roomSqft>0 ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:7px 9px;margin-bottom:8px;font-size:10px;color:var(--text2);line-height:1.45">
        ⚠️ <strong style="color:var(--red)">Not recommended.</strong> Tile adhesive already contains cement in a balanced ratio. Adding more dilutes the polymers and lowers bond strength &amp; flexibility (can crack/hollow). V Wholesale does not advise this — it's here only because some Mestris insist on it.
      </div>` : ''}

      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${isNone ? `<div style="width:100%;text-align:center;padding:8px;font-size:11px;color:var(--text3);background:var(--bg3);border-radius:7px">⊘ No adhesive for this area</div>` : ''}
        ${adhBags > 0 ? `<div style="flex:1;background:var(--bg3);border-radius:7px;padding:7px;min-width:80px;text-align:center">
          <div style="font-size:10px;color:var(--text3)">Adhesive (20kg)</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${adhBags}</div>
          <div style="font-size:9px;color:var(--text3)">bags</div>
        </div>` : ''}
        ${cemBags > 0 ? `<div style="flex:1;background:var(--bg3);border-radius:7px;padding:7px;min-width:80px;text-align:center">
          <div style="font-size:10px;color:var(--text3)">Cement (50kg)</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${cemBags}</div>
          <div style="font-size:9px;color:var(--text3)">bags</div>
        </div>` : ''}
        ${sandBags > 0 ? `<div style="flex:1;background:var(--bg3);border-radius:7px;padding:7px;min-width:80px;text-align:center">
          <div style="font-size:10px;color:var(--text3)">Sand (50kg)</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${sandBags}</div>
          <div style="font-size:9px;color:var(--text3)">bags</div>
        </div>` : ''}
      </div>
    </div>`).join('')}

    <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:10px;padding:10px">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">Material Totals</div>
      ${totalAdhBags>0?`<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span>🧲 Adhesive (20kg)</span><span style="font-weight:800;color:var(--gold)">${totalAdhBags} bags</span></div>`:''}
      ${totalCemBags>0?`<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span>🏗 Cement (50kg)</span><span style="font-weight:800;color:var(--gold)">${totalCemBags} bags</span></div>`:''}
      ${totalSandBags>0?`<div style="display:flex;justify-content:space-between;font-size:13px"><span>🪨 Sand (50kg)</span><span style="font-weight:800;color:var(--gold)">${totalSandBags} bags</span></div>`:''}
      ${(totalAdhBags+totalCemBags+totalSandBags)===0?`<div style="font-size:12px;color:var(--text3)">Select a method per area above.</div>`:''}
    </div>
  </div>
  <button class="btn-primary full-width" onclick="VW_TILES.tqNext()">Next → Grout</button>
  <button onclick="VW_TILES.tqSkipAdhesive()" style="width:100%;padding:10px;border-radius:10px;background:none;border:1px dashed var(--border);font-size:13px;color:var(--text3);cursor:pointer;margin-top:8px">Skip — no adhesive for this project</button>
  <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES.tqBack()">← Back</button>`;
}

// Tile Size → Spacer → Adhesive →
//   Beading → Brand/Stock (dead stock priority) → Grout →
//   Summary + T&C + Sanitary suggestions

function setAdhMethodForRoom(roomId, method) {
  if (!_tqState.adhesiveSelections[roomId]) _tqState.adhesiveSelections[roomId] = {};
  _tqState.adhesiveSelections[roomId].method = method;
  document.getElementById('tq-step-content').innerHTML = _renderStep4();
}


// ───── STEP 5: BEADING ──────────────────────────────────────
function _renderStep5() {
  const selectedBeads = _tqState.beading;
  const sz = _tqState.selectedSize;
  const szMm = sz ? parseInt(sz.mm.split('×')[0]) : 300;
  const suggestedSize = szMm >= 800 ? 12 : szMm >= 600 ? 10 : 8;
  const isWet = _tqState.rooms.some(r=>r.type==='Bathroom'||r.type==='Utility');

  const MATERIALS = [
    { key:'SS', label:'Stainless Steel', icon:'⭐', desc:'Premium · Rust-proof · Recommended for wet areas & kitchen', color:'rgba(245,200,66,0.1)', border:'var(--gold-border)' },
    { key:'Aluminium', label:'Aluminium', icon:'🔘', desc:'Good quality · Budget-friendly · Anodised finish · Dry areas', color:'var(--bg2)', border:'var(--border)' },
    { key:'PVC', label:'PVC', icon:'⚪', desc:'Economy · Flexible · Easy to cut · Not for wet/outdoor use', color:'var(--bg2)', border:'var(--border)' },
  ];

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Corner Beading & Edge Profiles</h3>
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:12px;font-size:11px;color:var(--text2)">
      Suggested: <strong>${suggestedSize}mm</strong> for ${sz?.mm||'your'} tile size
      ${isWet?' · <strong style="color:var(--gold)">Wet area detected — SS recommended</strong>':''}
    </div>

    ${MATERIALS.map(mat => {
      const beads = BEADING_CATALOG.filter(b => b.material === mat.key);
      return `
      <div style="background:${mat.color};border:1px solid ${mat.border};border-radius:12px;padding:10px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;margin-bottom:4px">${mat.icon} ${mat.label}</div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:8px">${mat.desc}</div>
        ${beads.map(b => {
          const isSelected = selectedBeads.find(sb=>sb.id===b.id);
          return `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;background:${isSelected?'rgba(245,200,66,0.12)':'var(--bg3)'};border:${isSelected?'1px solid var(--gold-border)':'1px solid transparent'};border-radius:8px;margin-bottom:4px">
            <input type="checkbox" ${isSelected?'checked':''} onchange="VW_TILES.tqToggleBead('${b.id}',this.checked)" style="width:16px;height:16px;flex-shrink:0">
            <div style="flex:1">
              <div style="font-size:12px;font-weight:${isSelected?700:400};color:${isSelected?'var(--gold)':'var(--text)'}">${b.size}mm ${b.material} Bead</div>
              <div style="font-size:10px;color:var(--text3)">${b.note}</div>
            </div>
            ${isSelected ? `
            <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;flex-direction:column;align-items:flex-end">
              <div style="display:flex;align-items:center;gap:4px">
                <input type="number" value="${isSelected.pcs||2}" min="1" step="1"
                  onchange="VW_TILES.tqSetBeadPcs('${b.id}',this.value)"
                  style="width:44px;text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text)">
                <span style="font-size:10px;color:var(--text3)">pcs</span>
              </div>
              <div style="font-size:9px;color:var(--text3)">${Math.round((isSelected.pcs||2)*213)/100}m · 1pc=7ft/2.13m</div>
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}

    ${selectedBeads.length > 0 ? `
    <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:10px;font-size:12px">
      <div style="font-weight:600;margin-bottom:4px">Selected (${selectedBeads.length}):</div>
      ${selectedBeads.map(b=>`<div style="color:var(--text2)">${b.size}mm ${b.material} — ${b.rm||5} metres</div>`).join('')}
    </div>` : `
    <button onclick="VW_TILES.tqSkipBeading()" style="width:100%;padding:10px;border-radius:10px;background:none;border:1px dashed var(--border);font-size:13px;color:var(--text3);cursor:pointer;margin-top:4px">
      Skip — No beading required for this project
    </button>`}
  </div>
  <button class="btn-primary full-width" onclick="VW_TILES.tqNext()">Next → Select Brand & Tiles</button>
  <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES.tqBack()">← Back</button>`;
}

function tqToggleBead(id, checked) {
  if (checked) {
    const b = BEADING_CATALOG.find(x=>x.id===id);
    if (b && !_tqState.beading.find(x=>x.id===id)) _tqState.beading.push({...b, rm:5});
  } else {
    _tqState.beading = _tqState.beading.filter(x=>x.id!==id);
  }
  document.getElementById('tq-step-content').innerHTML = _renderStep5();
}
function tqSetBeadPcs(id, val) {
  const b = (_tqState.beading||[]).find(x=>x.id===id);
  if (b) { b.pcs = parseInt(val)||1; b.rm = Math.round(b.pcs * 2.13 * 10)/10; }
}
function tqSetBeadRm(id, val) { tqSetBeadPcs(id, Math.round(parseFloat(val||0)/2.13)||1); }
function tqSkipBeading() { tqNext(); }
function tqSkipAdhesive() { _tqState.adhesiveSelections = {}; tqNext(); }
// Check live stock for an Add-ons item (cleaner/sponge/cloth/cement/sand) by name keyword.
async function tqCheckAddonStock(label, el) {
  const orig = el ? el.textContent : '';
  if (el) { el.textContent = '…'; el.disabled = true; }
  try {
    const l = (label||'').toLowerCase();
    const kw = l.includes('cleaner') ? 'cleaner'
      : l.includes('sponge') ? 'sponge'
      : l.includes('cloth') ? 'cloth'
      : l.includes('cement') ? 'cement'
      : l.includes('sand') ? 'sand'
      : l.includes('mortar') ? 'cement'
      : label;
    const { data } = await VW_DB.client.from('products').select('name,stock,price,mrp').ilike('name','%'+kw+'%').limit(8);
    if (!data || !data.length) {
      if (el) { el.textContent = 'Not in catalog'; el.style.color = 'var(--text3)'; el.style.borderColor = 'var(--border)'; el.disabled = false; }
      showToast(`No "${label}" product in catalog yet`, 'warn');
      return;
    }
    const totalStock = data.reduce((s,p)=>s+(p.stock||0),0);
    const p0 = data[0];
    if (el) {
      el.textContent = totalStock>0 ? `${totalStock} in stock` : 'Out of stock';
      el.style.color = totalStock>0 ? 'var(--green)' : 'var(--red)';
      el.style.borderColor = totalStock>0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
      el.disabled = false;
    }
    showToast(`${p0.name}: ${totalStock>0?totalStock+' in stock':'out of stock'}${(p0.price||p0.mrp)?' · ₹'+(p0.price||p0.mrp):''}`, totalStock>0?'success':'warn');
  } catch(e) {
    if (el) { el.textContent = orig||'Check stock'; el.disabled = false; }
    showToast('Could not check stock', 'warn');
  }
}

// ───── STEP 6: STOCK PUSH (DEAD STOCK PRIORITY) ─────────────
async function _renderStep6() {
  const totalSqft = _tqTotalSqft();
  const sz = _tqState.selectedSize;

  // Fetch products from Supabase with dead stock scoring
  let products = [];
  try {
    const { data } = await VW_DB.client
      .from('products')
      .select('*')
      .eq('category','Tiles')
      .gt('stock', 0)
      .order('purchase_date', { ascending: true, nullsFirst: false });
    products = data || [];
  } catch(e) {}

  // Also check IndexedDB
  if (!products.length) {
    const local = await VW_DB.all(VW_DB.STORES.products);
    products = local.filter(p => (p.category||'').toLowerCase().includes('tile') && (p.stock||0) > 0);
  }

  // Fetch non-inventory tiles (approved, order-based)
  let nonInvProducts = [];
  try {
    const slots = _getTileSlots();
    const primarySlot = slots.find(s=>_tqState.tileSelections[s.id]?.size) || slots[0];
    const sizeMm = primarySlot ? (_tqState.tileSelections[primarySlot.id]?.sizeMm || '') : '';
    const surface = primarySlot?.subType || 'both';
    if (window.VW_NON_INV) {
      const niResult = await VW_NON_INV.fetchTilesForQuotation(sizeMm, surface);
      nonInvProducts = niResult.onRequest || [];
    }
  } catch(e) {}

  // Combine: stock first, then non-inventory
  const allProducts = [
    ...products.map(p => ({...p, _isStock: true})),
    ...nonInvProducts,
  ];

  // Calculate box requirement
  // Sqft per tile from actual mm dimensions (mm ÷ 25.4 = inches, L×W ÷ 144 = sqft)
  let sz_sqft_actual = 3.875; // default 600×600
  if (sz?.mm) {
    const [mmL, mmW] = sz.mm.split('×').map(Number);
    if (mmL && mmW) {
      const li = mmL / 25.4, wi = mmW / 25.4; // mm to inches (exact)
      sz_sqft_actual = (li * wi) / 144; // sq inches to sqft
    }
  }
  // Tiles per box: get from settings first, then TILE_SIZES, else estimate
  const sizeConfig = (await VW_DB.getSetting('tile_weight_config', {sizes:[]})).sizes
    ?.find(s=>s.mm===sz?.mm);
  // Industry standard tiles per box by tile area:
  // 100×100 (0.108 sqft) → 25/box, 150×150 (0.243) → 25, 200×200 (0.431) → 16,
  // 300×300 (0.969) → 10, 300×450 (1.453) → 6, 300×600 (1.938) → 6,
  // 400×400 (1.722) → 6, 600×600 (3.875) → 4, 800×800 (6.889) → 2, 800×1600 → 1
  const tilesPerBox = sizeConfig?.tiles_per_box || sz?.tilesPerBox || (
    sz_sqft_actual < 0.15 ? 25 :  // 100×100
    sz_sqft_actual < 0.35 ? 25 :  // 150×150
    sz_sqft_actual < 0.60 ? 16 :  // 200×200
    sz_sqft_actual < 1.20 ? 10 :  // 300×300
    sz_sqft_actual < 2.50 ? 6  :  // 300×450, 300×600, 400×400, 400×800
    sz_sqft_actual < 5.00 ? 4  :  // 600×600, 600×900, 600×1200
    sz_sqft_actual < 9.00 ? 2  :  // 800×800, 800×1600
    1                              // 1000×1000+, slabs
  );
  const sqftPerBox = sz_sqft_actual * tilesPerBox;
  const sz_coverage = sqftPerBox;
  const reqBoxes = products.length
    ? Math.ceil(totalSqft / (products[0]?.coverage_per_box || products[0]?.coveragePerBox || sqftPerBox))
    : Math.ceil(totalSqft / sqftPerBox);

  // Dead stock scoring: combine age score + quantity match score
  const scored = products.map(p => {
    const ageScore = p.purchase_date
      ? Math.min(100, Math.floor((Date.now() - new Date(p.purchase_date).getTime()) / (1000*60*60*24)))
      : 0;
    const pBoxes = p.coveragePerBox ? Math.ceil(totalSqft / p.coveragePerBox) : 0;
    const qtyDiff = pBoxes ? Math.abs((p.stock||0) - pBoxes) : 999;
    const qtyScore = Math.max(0, 100 - qtyDiff*5); // closer = higher score
    const deadScore = (ageScore * 0.6) + (qtyScore * 0.4); // 60% age, 40% qty match
    return { ...p, ageScore, qtyScore, deadScore, reqBoxes: pBoxes };
  }).sort((a,b) => b.deadScore - a.deadScore);

  const deadStockItems = scored.filter(p => (p.dead_stock_flag || p.ageScore > 90) && p.stock > 0);

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Select Tile — Stock & Order-Based</h3>
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:12px;display:flex;justify-content:space-between">
      <div><div style="font-size:12px;color:var(--text3)">Area needed</div><div style="font-size:15px;font-weight:700">${totalSqft.toFixed(1)} sqft</div></div>
      <div><div style="font-size:12px;color:var(--text3)">Tile size</div><div style="font-size:13px;font-weight:600">${sz?.mm||'—'}mm</div></div>
      <div><div style="font-size:12px;color:var(--text3)">Est. boxes</div><div style="font-size:15px;font-weight:700;color:var(--gold)">${reqBoxes}</div></div>
    </div>

    ${deadStockItems.length ? `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:4px">🔥 Special Price — Clear Stock</div>
      <div style="font-size:11px;color:var(--text2)">These tiles are aged stock — available at special pricing. Executive incentive applies.</div>
    </div>` : ''}

    ${[...(scored||[]), ...nonInvProducts].length ? [...(scored||[]), ...nonInvProducts].map((p, i) => {
      const isDead = p.dead_stock_flag || p.ageScore > 90;
      const sel = _tqState.selectedProduct?.id === p.id;
      const pBoxes = p.is_non_inventory ? reqBoxes : (p.coveragePerBox ? Math.ceil(totalSqft / p.coveragePerBox) : '—');
      const isNI = !!p.is_non_inventory;
      const ageLabel = p.purchase_date ? Math.floor(p.ageScore) + ' days' : 'New stock';
      return `
      <div onclick="VW_TILES.tqSelectProduct(${JSON.stringify({id:p.id,name:p.name||p.model,brand:p.brand,coverage:p.coveragePerBox,stock:p.stock,reqBoxes:pBoxes}).replace(/"/g,'&quot;')})"
        style="background:${sel?'var(--gold-muted)':isDead?'rgba(239,68,68,0.05)':'var(--bg2)'};border:${sel?'2px solid var(--gold)':isDead?'1px solid rgba(239,68,68,0.3)':'1px solid var(--border)'};border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:${sel?'var(--gold)':'var(--text)'}">${isDead?'🔥 ':''}${p.name||p.model||'—'}</div>
            <div style="font-size:11px;color:var(--text3)">${p.brand||'—'} · Stock: ${p.stock||0} boxes · Age: ${ageLabel}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${p.mrp ? `<div style="font-size:13px;font-weight:700;color:var(--gold)">₹${p.mrp}/box</div>` : ''}
            <div style="font-size:11px;color:${(p.stock||0)>=(typeof pBoxes==='number'?pBoxes:0)?'var(--green)':'var(--red)'}">
            Need: ${pBoxes} boxes · In stock: ${p.stock||0} ${(p.stock||0)>=(typeof pBoxes==='number'?pBoxes:0)?'✅ Sufficient':'⚠️ Insufficient — check with manager'}
          </div>
          </div>
        </div>
        ${isDead && p.executive_incentive_pct ? `
        <div style="font-size:10px;color:var(--gold);margin-top:4px">⭐ ${p.executive_incentive_pct}% executive incentive for selling this stock</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:6px">
          <div style="font-size:10px;background:var(--bg3);border-radius:4px;padding:2px 6px;color:var(--text3)">
            Dead stock score: ${Math.round(p.deadScore)}/100
          </div>
          ${p.tile_finish?`<div style="font-size:10px;background:var(--bg3);border-radius:4px;padding:2px 6px;color:var(--text3)">${p.tile_finish}</div>`:''}
        </div>
      </div>`;
    }).join('') : `
    <div style="text-align:center;padding:24px;color:var(--text3)">
      <div style="font-size:32px;margin-bottom:8px">📦</div>
      <div style="font-size:13px">No tiles in stock yet</div>
      <div style="font-size:11px;margin-top:4px">Add tiles to Inventory → the best stock will show here</div>
    </div>`}
  </div>
  ${_tqState.selectedProduct ? `
  <!-- PRICING CARD -->
  ${(() => {
    const prod = _tqState.selectedProduct;
    const slots = _getTileSlots();
    // One pricing card covering all slots (same product selected for all)
    const firstSlot = slots[0];
    const qp = _tqState.quotedPrices[firstSlot?.id] || {};
    const invPrice = prod.price || prod.sale_price || prod.mrp || 0;
    const quotedBox = qp.pricePerBox || invPrice;
    // Calculate per-sqft from box price
    const sel = firstSlot ? (_tqState.tileSelections[firstSlot.id] || {}) : {};
    const sz = sel.size;
    const cfgEntry = sz ? ((_tqState._weightCfg?.sizes||[]).find(s=>s.mm===sz.mm)) : null;
    const tilesPerBox = cfgEntry?.tiles_per_box || 4;
    const sqftPerBox = sz ? (() => {
      const [mmL,mmW] = sz.mm.split('×').map(Number);
      return tileSqftPerTile(mmL, mmW) * tilesPerBox;
    })() : 0;
    const quotedSqft = sqftPerBox > 0 ? Math.round(quotedBox/sqftPerBox*100)/100 : 0;
    const totalBoxes = _getTileSlots().reduce((s,sl)=>{
      const b = _tqState.tileSelections[sl.id];
      if(!b?.size) return s;
      const [mmL,mmW] = b.size.mm.split('×').map(Number);
      const spf = tileSqftPerTile(mmL, mmW);
      const tpb = cfgEntry?.tiles_per_box || 4;
      const spb = spf * tpb;
      return s + (spb > 0 ? Math.ceil(sl.sqft/spb) : 0);
    }, 0);
    const totalValue = quotedBox * totalBoxes;
    const commissionAmt = _tqState.contractor ? Math.round(totalValue * (_tqState.contractor.commissionPct/100)) : 0;
    const isAboveInv = quotedBox > invPrice && invPrice > 0;
    return `
    <div class="card" style="margin-bottom:10px;border-color:${isAboveInv?'rgba(34,197,94,0.4)':'var(--gold-border)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 class="card-title" style="margin:0">💰 Pricing</h3>
        ${invPrice>0?`<div style="font-size:10px;color:var(--text3)">Inventory ref: ₹${invPrice}/box</div>`:''}
      </div>
      <div class="form-row" style="margin-bottom:8px">
        <div class="form-group" style="margin:0;flex:1">
          <label>Price per Box (₹)</label>
          <input type="number" id="tq-price-box" value="${quotedBox||''}" placeholder="Enter price"
            step="10" min="0" style="font-size:16px;font-weight:700"
            oninput="VW_TILES._updateQuotedPrice(this.value,'box')">
        </div>
        <div class="form-group" style="margin:0;flex:1">
          <label>Price per Sqft (₹) <span style="font-size:9px;color:var(--text3)">auto</span></label>
          <input type="number" id="tq-price-sqft" value="${quotedSqft||''}" placeholder="Auto"
            step="0.5" min="0" readonly
            style="font-size:16px;font-weight:700;background:var(--bg3);color:var(--text2)">
        </div>
      </div>
      ${isAboveInv?`<div style="font-size:11px;color:var(--green);margin-bottom:6px">✨ Premium pricing — ₹${quotedBox-invPrice}/box above inventory price</div>`:''}
      <div class="form-group" style="margin-bottom:8px">
        <label>Pricing Note <span style="font-size:10px;color:var(--text3)">(optional — shown to approver)</span></label>
        <input type="text" id="tq-price-note" value="${qp.note||''}" placeholder="e.g. Contractor deal, bulk rate"
          oninput="VW_TILES._updatePriceNote(this.value)">
      </div>
      <div style="background:var(--bg2);border-radius:8px;padding:8px;font-size:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="color:var(--text3)">Total (${totalBoxes} boxes × ₹${quotedBox})</span>
          <strong>₹${totalValue.toLocaleString('en-IN')}</strong>
        </div>
        ${commissionAmt>0?`<div style="display:flex;justify-content:space-between;font-size:11px">
          <span style="color:var(--text3)">Contractor commission (${_tqState.contractor.commissionPct}%)</span>
          <span style="color:var(--gold)">₹${commissionAmt.toLocaleString('en-IN')}</span>
        </div>`:''}
      </div>
    </div>`;
  })()}
  <button class="btn-primary full-width" onclick="VW_TILES.tqNext()">Next → Grout & Epoxy</button>` : ''}
  <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES.tqBack()">← Back</button>`;
}

function tqSelectProduct(p) {
  _tqState.selectedProduct = p;
  // Auto-populate quoted price from inventory sale price per box
  // Executive can override upward — no MRP ceiling
  const slots = _getTileSlots();
  const firstWallOrFloor = slots[0];
  if (firstWallOrFloor && !_tqState.quotedPrices[firstWallOrFloor.id]) {
    _tqState.quotedPrices[firstWallOrFloor.id] = {
      pricePerBox: p.price || p.sale_price || 0,
      pricePerSqft: 0,
      note: '',
      upsell: false,
    };
  }
  // Auto-suggest grout colour from tile
  _autoSuggestGroutColour(p);
  document.getElementById('tq-step-content').innerHTML = '<div style="padding:16px;text-align:center"><div class="spinner"></div></div>';
  _renderStep6().then(html => { document.getElementById('tq-step-content').innerHTML = html; });
}

// Auto-suggest grout colour based on tile brand/finish/colour
function _autoSuggestGroutColour(product) {
  const GROUT_COLOURS = [
    { id:'white',      name:'White',       hex:'#f8f8f8' },
    { id:'ivory',      name:'Ivory',       hex:'#f5edd5' },
    { id:'light_grey', name:'Light Grey',  hex:'#c8c8c8' },
    { id:'grey',       name:'Grey',        hex:'#888888' },
    { id:'dark_grey',  name:'Dark Grey',   hex:'#444444' },
    { id:'charcoal',   name:'Charcoal',    hex:'#2a2a2a' },
    { id:'mocha',      name:'Mocha',       hex:'#8b7355' },
    { id:'beige',      name:'Beige',       hex:'#d4bc94' },
  ];
  if (!product) return;
  const name = (product.name || product.design_name || '').toLowerCase();
  const finish = (product.tile_finish || product.finish || '').toLowerCase();
  // Heuristic: guess from product name keywords
  let suggestions = ['white','light_grey']; // default
  if (/dark|black|charcoal|anthracite|nero/.test(name)) suggestions = ['charcoal','dark_grey'];
  else if (/wood|teak|oak|timber|brown|walnut/.test(name)) suggestions = ['mocha','beige'];
  else if (/beige|cream|sand|stone|marble/.test(name)) suggestions = ['ivory','beige'];
  else if (/grey|gray|ash|concrete|cement/.test(name)) suggestions = ['grey','light_grey'];
  else if (/white|bianco|snow/.test(name)) suggestions = ['white','ivory'];
  // Store suggestions in state (not auto-selected — user confirms)
  _tqState._groutSuggestions = suggestions;
}

// ───── STEP 7: GROUT / EPOXY ────────────────────────────────
function _renderStep7() {
  const slots = _getTileSlots();

  // Initialise per-slot grout state if not present
  if (!_tqState.groutSelections) _tqState.groutSelections = {};
  slots.forEach(slot => {
    if (!_tqState.groutSelections[slot.id]) {
      const sz = _tqState.tileSelections[slot.id]?.size;
      const maxMm = sz?.mm ? Math.max(...sz.mm.split('×').map(Number)) : 600;
      // Suggest epoxy for wet areas (wall tiles or large format ≥ 400mm)
      const suggestEpoxy = slot.subType === 'wall' || maxMm >= 400;
      _tqState.groutSelections[slot.id] = {
        type: suggestEpoxy ? 'epoxy' : 'cement',
        color: 'grey',
        colorHex: '#9CA3AF',
      };
    }
  });

  const COLORS = [
    {id:'white',     label:'White',     hex:'#F5F5F0'},
    {id:'ivory',     label:'Ivory',     hex:'#F0EBD8'},
    {id:'beige',     label:'Beige',     hex:'#D4C5A0'},
    {id:'grey',      label:'Grey',      hex:'#9CA3AF'},
    {id:'dark_grey', label:'Dark Grey', hex:'#4B5563'},
    {id:'black',     label:'Black',     hex:'#1F2937'},
    {id:'brown',     label:'Brown',     hex:'#78543A'},
    {id:'red',       label:'Red Oxide', hex:'#9B3C2A'},
  ];

  // Compute per-slot grout kg using Saint-Gobain method
  function calcSlotGroutKg(slot, isEpoxy) {
    const sel = _tqState.tileSelections[slot.id] || {};
    const sz = sel.size;
    const spacerMm = _tqState.spacerSelections?.[slot.id]?.mm || 3;
    const roomSqft = slot.sqft || 0;
    if (!sz || roomSqft <= 0) return 0;
    const [L_mm, W_mm] = sz.mm.split('×').map(Number);
    const T_mm = sz.thickness || sz.thicknessMm || 9;
    const density = isEpoxy ? 1.8e-6 : 1.6e-6;
    const Area_mm2 = (roomSqft / 10.764) * 1e6;
    const raw = ((L_mm + W_mm) / (L_mm * W_mm)) * T_mm * spacerMm * Area_mm2 * density;
    return Math.max(0.5, Math.round(raw * 1.10 * 10) / 10);
  }

  // Build totals for summary at bottom
  let totalCementKg = 0, totalEpoxyKg = 0, anySelected = false;
  slots.forEach(slot => {
    const g = _tqState.groutSelections[slot.id] || {};
    if (g.type === 'cement') { totalCementKg += calcSlotGroutKg(slot, false); anySelected = true; }
    else if (g.type === 'epoxy') { totalEpoxyKg += calcSlotGroutKg(slot, true); anySelected = true; }
  });

  const slotCards = slots.map(slot => {
    const g = _tqState.groutSelections[slot.id] || {};
    const sel = _tqState.tileSelections[slot.id] || {};
    const sz = sel.size;
    const room = slot.room;
    const label = slot.label || room?.label || room?.type || 'Room';
    const maxMm = sz?.mm ? Math.max(...sz.mm.split('×').map(Number)) : 600;
    const suggestEpoxy = slot.subType === 'wall' || maxMm >= 400;
    const cementKg = calcSlotGroutKg(slot, false);
    const epoxyKg  = calcSlotGroutKg(slot, true);
    const displayKg = g.type === 'epoxy' ? epoxyKg : g.type === 'cement' ? cementKg : 0;

    return `
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700">${label}</div>
          <div style="font-size:10px;color:var(--text3)">${sz?.mm||'—'}mm · ${(slot.sqft||0).toFixed(1)} sqft · ${slot.subType==='wall'?'Wall':'Floor'}</div>
        </div>
        ${suggestEpoxy ? `<span style="font-size:9px;background:rgba(245,200,66,0.15);color:var(--gold);border-radius:5px;padding:2px 7px;font-weight:600">💡 Epoxy recommended</span>` : ''}
      </div>

      <!-- Type selection -->
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button onclick="VW_TILES.setGroutTypeForSlot('${slot.id}','cement')"
          style="flex:1;padding:8px;border-radius:8px;cursor:pointer;
            border:${g.type==='cement'?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${g.type==='cement'?'var(--gold-muted)':'var(--bg3)'}">
          <div style="font-size:11px;font-weight:700;color:${g.type==='cement'?'var(--gold)':'var(--text)'}">Cement Grout</div>
          <div style="font-size:9px;color:var(--text3)">Standard · easy repair</div>
        </button>
        <button onclick="VW_TILES.setGroutTypeForSlot('${slot.id}','epoxy')"
          style="flex:1;padding:8px;border-radius:8px;cursor:pointer;
            border:${g.type==='epoxy'?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${g.type==='epoxy'?'var(--gold-muted)':'var(--bg3)'}">
          <div style="font-size:11px;font-weight:700;color:${g.type==='epoxy'?'var(--gold)':'var(--text)'}">⭐ Epoxy Grout</div>
          <div style="font-size:9px;color:var(--text3)">Waterproof · anti-fungal</div>
        </button>
        <button onclick="VW_TILES.setGroutTypeForSlot('${slot.id}','none')"
          style="flex:1;padding:8px;border-radius:8px;cursor:pointer;
            border:${g.type==='none'?'2px solid var(--text3)':'1px solid var(--border)'};
            background:${g.type==='none'?'var(--bg3)':'var(--bg3)'}">
          <div style="font-size:11px;font-weight:700;color:${g.type==='none'?'var(--text2)':'var(--text3)'}">⊘ None</div>
          <div style="font-size:9px;color:var(--text3)">Not required</div>
        </button>
      </div>

      ${g.type !== 'none' ? `
      <!-- Colour picker -->
      <div style="font-size:10px;color:var(--text3);font-weight:600;margin-bottom:5px">Colour</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px">
        ${COLORS.map(c => `
        <button onclick="VW_TILES.setGroutColorForSlot('${slot.id}','${c.id}','${c.hex}')"
          style="padding:6px 2px;border-radius:8px;border:${g.color===c.id?'2px solid var(--gold)':'1px solid var(--border)'};background:var(--bg2);cursor:pointer">
          <div style="width:100%;height:18px;border-radius:4px;background:${c.hex};border:1px solid rgba(0,0,0,0.1);margin-bottom:3px"></div>
          <div style="font-size:9px;color:${g.color===c.id?'var(--gold)':'var(--text3)'};font-weight:${g.color===c.id?700:400}">${c.label}</div>
        </button>`).join('')}
      </div>
      <!-- Quantity -->
      <div style="background:var(--bg3);border-radius:7px;padding:7px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:var(--text3)">${g.type==='epoxy'?'⭐ Epoxy':'🪨 Cement'} Grout needed</div>
        <div style="font-size:15px;font-weight:800;color:var(--gold)">${displayKg} kg</div>
      </div>` : `
      <div style="background:var(--bg3);border-radius:7px;padding:8px;text-align:center;font-size:11px;color:var(--text3)">
        ⊘ Grout not included for this area
      </div>`}
    </div>`;
  }).join('');

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🎨 Grout — Per Area</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:12px">
      Select grout type and colour for each area. Wall tiles &amp; large format: Epoxy recommended.
    </p>
    ${slotCards}
    ${anySelected ? `
    <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:10px;padding:10px">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px">Total Grout Required</div>
      ${totalCementKg>0?`<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>🪨 Cement Grout</span><span style="font-weight:800;color:var(--gold)">${Math.ceil(totalCementKg*10)/10} kg</span></div>`:''}
      ${totalEpoxyKg>0?`<div style="display:flex;justify-content:space-between;font-size:12px"><span>⭐ Epoxy Grout</span><span style="font-weight:800;color:var(--gold)">${Math.ceil(totalEpoxyKg*10)/10} kg</span></div>`:''}
      <div style="font-size:10px;color:var(--text3);margin-top:6px">Includes 10% wastage. Confirm with installer before purchase.</div>
    </div>` : ''}
  </div>
  <button class="btn-primary full-width" onclick="VW_TILES.tqNext()">Next → Add-ons</button>
  <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES.tqBack()">← Back</button>`;
}
// Direct sqft entry — creates a single flat area room bypassing room-by-room measurement
function tqAddDirectSqft() {
  const sqft = parseFloat(document.getElementById('tq-direct-sqft')?.value);
  const label = (document.getElementById('tq-direct-label')?.value || 'Total Area').trim();
  if (!sqft || sqft <= 0) { showToast('Enter a valid sqft value', 'warn'); return; }

  const roomId = 'room_direct_' + Date.now();
  const areaId = 'area_direct_' + Date.now();
  const newRoom = {
    id: roomId,
    type: label,
    label: label,
    surface: 'floor',
    areas: [{
      id: areaId,
      sqft: sqft,
      subType: 'floor',
      label: label,
      directEntry: true,  // flag so summary shows differently
    }],
    _directSqft: sqft,
  };
  if (!_tqState.rooms) _tqState.rooms = [];
  _tqState.rooms.push(newRoom);

  // Clear inputs
  const sqftEl = document.getElementById('tq-direct-sqft');
  const labelEl = document.getElementById('tq-direct-label');
  if (sqftEl) sqftEl.value = '';
  if (labelEl) labelEl.value = 'Total Area';

  // Re-render rooms list
  const listEl = document.getElementById('tq-rooms-list');
  if (listEl) listEl.innerHTML = _renderRoomsGrouped();
  showToast(`${label} — ${sqft} sqft added`, 'success');
}

function tqSetGroutType(t) { _tqState.grout = _tqState.grout||{}; _tqState.grout.type=t; document.getElementById('tq-step-content').innerHTML=_renderStep7(); }
function tqSetGroutColor(c,hex) { _tqState.grout = _tqState.grout||{}; _tqState.grout.color=c; _tqState.grout.colorHex=hex; document.getElementById('tq-step-content').innerHTML=_renderStep7(); }

// Per-slot grout setters (new per-room grout step)
function setGroutTypeForSlot(slotId, type) {
  if (!_tqState.groutSelections) _tqState.groutSelections = {};
  if (!_tqState.groutSelections[slotId]) _tqState.groutSelections[slotId] = {};
  _tqState.groutSelections[slotId].type = type;
  document.getElementById('tq-step-content').innerHTML = _renderStep7();
}
function setGroutColorForSlot(slotId, colorId, hex) {
  if (!_tqState.groutSelections) _tqState.groutSelections = {};
  if (!_tqState.groutSelections[slotId]) _tqState.groutSelections[slotId] = {};
  _tqState.groutSelections[slotId].color = colorId;
  _tqState.groutSelections[slotId].colorHex = hex;
  document.getElementById('tq-step-content').innerHTML = _renderStep7();
}

// ───── STEP 8: SUMMARY + T&C ────────────────────────────────
// ════════════ STEP: ADD-ONS & MATERIALS (own step before Summary) ════════════
async function _renderStepAddons() {
  const totalSqft = _tqTotalSqft();
  const boxesNeeded = Math.max(1, Math.ceil(totalSqft / 15));
  const rooms = _tqState.rooms || [];

  // Detect room types for smart suggestions
  const hasBath  = rooms.some(r => ['Bathroom','Toilet','Wash Area','Master Bedroom'].some(t => r.type?.includes(t.split(' ')[0])));
  const hasShower = rooms.some(r => r.type?.includes('Bathroom') || r.type?.includes('Wash'));
  const hasKitchen = rooms.some(r => r.type?.includes('Kitchen'));

  // Fetch suggested products from inventory (live stock only)
  let bathSuggestions = [], kitchenSuggestions = [];
  if (hasBath || hasShower) {
    const { data } = await VW_DB.client.from('products')
      .select('id,name,brand,subcategory,price,unit,stock')
      .eq('is_active', true).gt('stock', 0)
      .in('subcategory', ['Divertor','Concealed Cistern','Flush Tank','Shower','Floor Trap','Faucets','Valves'])
      .order('subcategory').limit(12);
    bathSuggestions = data || [];
  }
  if (hasKitchen) {
    const { data } = await VW_DB.client.from('products')
      .select('id,name,brand,subcategory,price,unit,stock')
      .eq('is_active', true).gt('stock', 0)
      .in('subcategory', ['Mixers','Faucets','Valves'])
      .limit(6);
    kitchenSuggestions = data || [];
  }

  const suggCard = (p) => {
    const added = (_tqState.extraProducts||[]).some(x=>x.id===p.id);
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;margin-bottom:6px;border:${added?'1.5px solid var(--green)':'1px solid var(--border)'};background:${added?'rgba(34,197,94,0.06)':'var(--bg2)'}">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:${added?'var(--green)':'var(--text)'}">${p.name}</div>
        <div style="font-size:10px;color:var(--text3)">${p.brand||''} · ₹${Number(p.price).toLocaleString('en-IN')}/${p.unit||'pc'} · ${p.stock} in stock</div>
      </div>
      <button onclick="VW_TILES.tqAddInventoryProduct(${p.id})"
        style="padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;border:none;cursor:pointer;flex-shrink:0;
          background:${added?'rgba(34,197,94,0.15)':'var(--gold)'};color:${added?'var(--green)':'#000'}">
        ${added?'✓ Added':'+ Add'}
      </button>
    </div>`;
  };

  const bathCard = (hasBath || hasShower) && bathSuggestions.length ? `
  <div class="card" style="margin-bottom:10px;border-color:rgba(96,165,250,0.4)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <h3 class="card-title" style="margin:0">🚿 Bathroom work detected</h3>
      <span style="font-size:10px;color:var(--text3)">Before tiling</span>
    </div>
    <p style="font-size:11px;color:var(--text3);margin-bottom:10px">These need to be installed <strong>before</strong> tiles go up. Add to this quote now?</p>
    ${bathSuggestions.map(suggCard).join('')}
  </div>` : '';

  const kitCard = hasKitchen && kitchenSuggestions.length ? `
  <div class="card" style="margin-bottom:10px;border-color:rgba(251,191,36,0.4)">
    <h3 class="card-title">🍳 Kitchen work detected</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:10px">Fittings that should be placed before kitchen wall tiles are laid:</p>
    ${kitchenSuggestions.map(suggCard).join('')}
  </div>` : '';

  return `
  <!-- SMART CONTEXT SUGGESTIONS (room-type driven) -->
  ${bathCard}
  ${kitCard}

  <!-- ADD PRODUCTS FROM INVENTORY -->
  <div class="card" style="margin-bottom:10px;border-color:var(--gold-border)">
    <h3 class="card-title">🛒 Add Products from Inventory</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:8px">Search any product and pull it into this quotation with live stock.</p>
    <input id="tq-inv-search" type="text" placeholder="🔍 Search product name…" oninput="VW_TILES.tqSearchInventory(this.value)" autocomplete="off"
      style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;margin-bottom:8px;box-sizing:border-box">
    <div id="tq-inv-results"></div>
    <div id="tq-inv-added">${_renderExtraProductsList()}</div>
  </div>

  <!-- FLOOR TRAP SELECTOR -->
  <div class="card" style="margin-bottom:10px;border-color:rgba(34,197,94,0.3)">
    <h3 class="card-title">🕳 Floor Trap / Nahani Trap Selection</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">
      Floor traps must be positioned and fixed <strong>before</strong> tiles are laid. Select size now so it goes on the quotation.
    </p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px" id="tq-trap-grid">
      ${[
        { id:'ft1', size:'90×50mm', label:'90×50mm (2")', use:'Small bathroom, hand wash', material:'PVC Nahani' },
        { id:'ft2', size:'90×63mm', label:'90×63mm (2.5")', use:'Standard bathroom, shower', material:'PVC Nahani' },
        { id:'ft3', size:'110×75mm', label:'110×75mm (3")', use:'Master bathroom, wash area', material:'PVC / SS304' },
        { id:'ft4', size:'110×90mm', label:'110×90mm (3.5")', use:'Bathroom with bathtub', material:'PVC / SS304' },
        { id:'ft5', size:'110×110mm', label:'110×110mm (4")', use:'Kitchen, utility, large bath', material:'PVC / SS304' },
        { id:'ft6', size:'300×300mm', label:'300×300mm SS Square', use:'Modern shower area, hotel style', material:'SS304 Square' },
        { id:'ft7', size:'200×200mm', label:'200×200mm SS Square', use:'Compact modern bathroom', material:'SS304 Square' },
        { id:'ft8', size:'channel', label:'Channel Drain (linear)', use:'Walk-in shower, balcony, terrace', material:'SS304 / ABS' },
      ].map(t => {
        const sel = (_tqState.floorTraps||[]).find(x=>x.id===t.id);
        return `<div onclick="VW_TILES.tqToggleTrap(${JSON.stringify(t).replace(/"/g,'&quot;')})"
          style="background:${sel?'rgba(34,197,94,0.08)':'var(--bg2)'};border:${sel?'2px solid var(--green)':'1px solid var(--border)'};border-radius:10px;padding:10px;cursor:pointer">
          <div style="font-size:12px;font-weight:700;color:${sel?'var(--green)':'var(--text)'}">${t.label}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${t.material}</div>
          <div style="font-size:10px;color:var(--text3)">${t.use}</div>
          ${sel?`<div style="font-size:10px;color:var(--green);margin-top:3px">✓ Selected · Qty: <input type="number" value="${sel.qty||1}" min="1" onclick="event.stopPropagation()" onchange="VW_TILES.tqSetTrapQty('${t.id}',this.value)" style="width:36px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:1px 4px;font-size:11px;color:var(--text)"> nos</div>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- CORRECT SEQUENCE / WATERPROOFING -->
  <div class="card" style="margin-bottom:10px;border-color:rgba(96,165,250,0.3)">
    <h3 class="card-title">🔴 Critical Sequence — Do This Before Tiles</h3>
    <p style="font-size:12px;color:var(--gold);font-weight:600;margin-bottom:10px">
      Wrong sequence = tile failure. Follow this order exactly:
    </p>
    <div style="position:relative;padding-left:24px">
      ${[
        { step:1, icon:'🔧', title:'Plumbing First (CPVC/PVC pipes)', note:'All hot & cold water lines, drainage pipes. Cannot change after waterproofing.', urgent:true, advisory:true },
        { step:2, icon:'🕳', title:'Fix Floor Trap Position', note:'Mark and fix drain position. Height must account for tile thickness (8–15mm) + adhesive (6–10mm).', urgent:true, advisory:true },
        { step:3, icon:'💧', title:'Waterproofing Membrane (BEFORE tiles)', note:'2–3 coats of Dr. Fixit / MYK Laticrete / Pidilite on floor + 150mm up walls. Ponding test 48 hrs. Only then tile.', urgent:true, advisory:true },
        { step:4, icon:'🔲', title:'Tile Laying', note:'Use tile adhesive (not cement for tiles ≥ 600mm). Bottom to top for walls.', urgent:false, advisory:false },
        { step:5, icon:'✅', title:'Grout / Epoxy', note:'After adhesive cures 24hrs. Epoxy grout at floor-wall junction is mandatory.', urgent:false, advisory:false },
      ].map(s=>`
      <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:22px;height:22px;border-radius:50%;background:${s.urgent?'rgba(239,68,68,0.15)':'rgba(34,197,94,0.1)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${s.urgent?'var(--red)':'var(--green)'};flex-shrink:0">${s.step}</div>
        <div>
          <div style="font-size:12px;font-weight:700">${s.icon} ${s.title}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${s.note}</div>
          ${s.advisory?`<div style="font-size:10px;color:var(--text3);margin-top:2px;font-style:italic">Advisory only — V Wholesale does not supply plumbing services</div>`:''}
        </div>
      </div>`).join('')}
    </div>
  </div>

  <!-- SOFFIT PANEL / PVC CEILING ADDON -->
  <div class="card" style="margin-bottom:10px;border-color:var(--gold-border)">
    <h3 class="card-title">✨ Add-on: Soffit Panel / PVC Ceiling</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">
      Available for washrooms, balconies, and bathrooms. Want to add a ceiling or soffit panel to this quotation?
    </p>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button onclick="VW_TILES.tqToggleSoffit(true)"
        style="flex:1;padding:12px;border-radius:12px;border:${_tqState.soffit?.enabled?'2px solid var(--gold)':'1px solid var(--border)'};background:${_tqState.soffit?.enabled?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;font-size:13px;font-weight:700;color:${_tqState.soffit?.enabled?'var(--gold)':'var(--text)'}">
        ✅ Yes — Add Soffit Panel
      </button>
      <button onclick="VW_TILES.tqToggleSoffit(false)"
        style="flex:1;padding:12px;border-radius:12px;border:${!_tqState.soffit?.enabled?'2px solid var(--gold)':'1px solid var(--border)'};background:${!_tqState.soffit?.enabled?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;font-size:13px;color:${!_tqState.soffit?.enabled?'var(--gold)':'var(--text)'}">
        Skip for now
      </button>
    </div>

    ${_tqState.soffit?.enabled ? `
    <div style="background:var(--bg2);border-radius:12px;padding:12px">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px">Select Panel Type</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:10px">
        ${[
          {id:'pvc_3inch', label:'PVC Panel 3"', width:75, note:'Most common bathroom ceiling'},
          {id:'pvc_4inch', label:'PVC Panel 4"', width:100, note:'Balcony, larger washrooms'},
          {id:'pvc_5inch', label:'PVC Panel 5"', width:125, note:'Wide panel, fewer joints'},
          {id:'soffit_8mm', label:'Soffit Panel 8mm', width:200, note:'Premium look, hotels, restaurants'},
          {id:'pvc_louver', label:'PVC Louver', width:100, note:'Ventilated ceiling'},
          {id:'wpc_wall', label:'WPC Wall Panel', width:150, note:'Wall cladding, not ceiling'},
        ].map(p=>{
          const sel = _tqState.soffit?.type===p.id;
          return `<button onclick="VW_TILES.tqSelectSoffit('${p.id}',${p.width})"
            style="background:${sel?'var(--gold-muted)':'var(--bg2)'};border:${sel?'2px solid var(--gold)':'1px solid var(--border)'};border-radius:8px;padding:8px;cursor:pointer;text-align:left">
            <div style="font-size:12px;font-weight:700;color:${sel?'var(--gold)':'var(--text)'}">${p.label}</div>
            <div style="font-size:10px;color:var(--text3)">${p.note}</div>
          </button>`;
        }).join('')}
      </div>

      ${_tqState.soffit?.type ? (() => {
        const bathrooms = (_tqState.rooms||[]).filter(r=>{const t=r.type||'';return t==='Bathroom'||t==='Toilet'||t.includes('Wash')||t.includes('Balcony');});
        const totalCeilSqft = bathrooms.reduce((s,r)=>s+(r.areas||[]).reduce((ss,a)=>ss+(a.base||a.sqft||0),0),0)*1.1;
        const panelWidthFt = (_tqState.soffit?.panelWidth||100)/304.8;
        const roomLen = 10; // avg
        const stripsPerSqft = 1/panelWidthFt;
        const totalStrips = Math.ceil(totalCeilSqft * stripsPerSqft);
        const panelLen = 10; // 10ft standard
        const pcs = Math.ceil(totalStrips * (roomLen/panelLen));
        return `
        <div style="background:rgba(245,200,66,0.08);border-radius:10px;padding:10px">
          <div style="font-size:12px;font-weight:600;margin-bottom:6px">Auto-calculated Requirement</div>
          <div style="font-size:13px;color:var(--text2)">Wet areas: <strong style="color:var(--gold)">${totalCeilSqft.toFixed(1)} sqft</strong></div>
          <div style="font-size:13px;color:var(--text2)">Panels needed: <strong style="color:var(--gold)">${pcs} pcs</strong> (10ft × ${_tqState.soffit.panelWidth}mm)</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Bathrooms: ${bathrooms.map(r=>r.label).join(', ')||'None added'}</div>
          <div style="font-size:11px;color:var(--text3)">Price to be confirmed from inventory</div>
        </div>`;
      })() : ''}
    </div>` : ''}
  </div>

  <!-- ADDONS: Cement, Sand, Tile Cleaner, Accessories -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🧱 Material Addons <span style="font-size:11px;color:var(--text3);font-weight:400">(optional — add to quote)</span></h3>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
      Based on ${totalSqft.toFixed(0)} sqft floor area. Rough estimates — confirm with installer.
    </div>
    ${await _renderAddonSuggestions(totalSqft, boxesNeeded)}
  </div>

  <!-- LABOR QUESTION -->
  <div class="card" style="margin-bottom:10px;border-color:rgba(34,197,94,0.3)">
    <h3 class="card-title">🔨 Tile Laying Labor</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:12px">
      Do you need a professional tile layer? V Wholesale can connect you with verified contractors who procure material from us — quality assured.
    </p>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button onclick="VW_TILES.setLaborRequired(true)"
        style="flex:1;padding:12px;border-radius:10px;border:${_tqState.laborRequired?'2px solid var(--green)':'1px solid var(--border)'};background:${_tqState.laborRequired?'rgba(34,197,94,0.08)':'var(--bg2)'};cursor:pointer;font-size:13px;font-weight:700;color:${_tqState.laborRequired?'var(--green)':'var(--text)'}">
        ✅ Yes, need labor
      </button>
      <button onclick="VW_TILES.setLaborRequired(false)"
        style="flex:1;padding:12px;border-radius:10px;border:${_tqState.laborRequired===false?'2px solid var(--gold)':'1px solid var(--border)'};background:${_tqState.laborRequired===false?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;font-size:13px;color:${_tqState.laborRequired===false?'var(--gold)':'var(--text)'}">
        Not required
      </button>
    </div>
    ${_tqState.laborRequired ? `
    <div style="background:rgba(34,197,94,0.06);border-radius:10px;padding:10px;font-size:11px;color:var(--text2)">
      ✅ Your requirement will be shared with our verified contractor network. They will contact you with competitive rates. All material procurement through V Wholesale — quality assured.
    </div>` : ''}
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
    <button class="btn-secondary" style="flex:1;min-width:80px" onclick="VW_TILES.tqBack()">← Back</button>
    <button class="btn-primary" style="flex:1;min-width:80px;background:var(--gold);color:#000" onclick="VW_TILES.tqNext()">Continue → Summary</button>
  </div>`;
}
function _rerenderStepAddons(){ _renderStepAddons().then(html=>{const el=document.getElementById('tq-step-content'); if(el)el.innerHTML=html;}); }
function setAddonTab(key) { _tqState._addonTab = key; _rerenderStepAddons(); }

// ───── Inventory → Quotation: search & add arbitrary products ─────
let _tqInvResults = [];
let _tqInvSearchTimer = null;
function _renderExtraProductsList() {
  const items = _tqState.extraProducts || [];
  if (!items.length) return '';
  let total = 0;
  const rows = items.map(p => {
    const line = (p.price||0) * (p.qty||1); total += line;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600">${p.name}</div>
        <div style="font-size:10px;color:var(--text3)">₹${p.price||0}/${p.unit||'unit'}${p.stock!=null?` · ${p.stock} in stock`:''}</div>
      </div>
      <input type="number" value="${p.qty||1}" min="1" onchange="VW_TILES.tqSetExtraQty(${p.id},this.value)" style="width:44px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px;font-size:12px;color:var(--text);text-align:center">
      <div style="font-size:12px;font-weight:700;color:var(--gold);min-width:56px;text-align:right">₹${line.toLocaleString('en-IN')}</div>
      <button onclick="VW_TILES.tqRemoveExtra(${p.id})" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;line-height:1">✕</button>
    </div>`;
  }).join('');
  return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border2)">
    <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px;letter-spacing:0.04em">ADDED PRODUCTS</div>
    ${rows}
    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;margin-top:4px"><span>Products subtotal</span><span style="color:var(--gold)">₹${total.toLocaleString('en-IN')}</span></div>
  </div>`;
}
function tqSearchInventory(q) {
  clearTimeout(_tqInvSearchTimer);
  const box = document.getElementById('tq-inv-results');
  if (!q || q.trim().length < 2) { if (box) box.innerHTML=''; return; }
  _tqInvSearchTimer = setTimeout(async () => {
    if (box) box.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:6px">Searching…</div>';
    try {
      const { data } = await VW_DB.client.from('products')
        .select('id,name,price,mrp,unit,stock,brand').ilike('name','%'+q.trim()+'%').eq('is_active',true).limit(12);
      _tqInvResults = data || [];
      if (!_tqInvResults.length) { if (box) box.innerHTML='<div style="font-size:11px;color:var(--text3);padding:6px">No products found</div>'; return; }
      if (box) box.innerHTML = _tqInvResults.map(p => {
        const price = p.price||p.mrp||0;
        const added = (_tqState.extraProducts||[]).some(x=>x.id===p.id);
        const inStock = (p.stock??0) > 0;
        return `<div onclick="VW_TILES.tqAddInventoryProduct(${p.id})"
          style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;${added?'opacity:0.5':''}">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600">${p.name}</div>
            <div style="font-size:10px;color:var(--text3)">₹${price}/${p.unit||'unit'} · ${inStock?`<span style="color:var(--green)">${p.stock} in stock</span>`:'<span style="color:var(--red)">out of stock</span>'}</div>
          </div>
          <span style="font-size:11px;color:var(--gold);font-weight:700;white-space:nowrap">${added?'✓ Added':'+ Add'}</span>
        </div>`;
      }).join('');
    } catch(e) { if (box) box.innerHTML='<div style="font-size:11px;color:var(--red);padding:6px">Search failed</div>'; }
  }, 300);
}
function tqAddInventoryProduct(id) {
  // Product may be in _tqInvResults (search) or in the rendered category tab
  // We fetch from Supabase directly to ensure we have VWP
  if (!_tqState.extraProducts) _tqState.extraProducts = [];
  if (_tqState.extraProducts.some(x=>x.id===id)) { showToast('Already added','info'); return; }

  // Try local results first
  const local = _tqInvResults.find(x=>x.id===id);
  if (local) {
    const vwp = Number(local.vwp || local.price || local.mrp || 0);
    _tqState.extraProducts.push({ id:local.id, name:local.name, mrp:Number(local.mrp||0), price:vwp, unit:local.unit||'unit', stock:(local.stock==null?null:Number(local.stock)), qty:1 });
    _rerenderStepAddons();
    showToast(local.name+' added','success');
    return;
  }

  // Fetch from Supabase (category tab product)
  VW_DB.client.from('products').select('id,name,brand,mrp,price,vwp,unit,stock').eq('id',id).single()
    .then(({ data: p }) => {
      if (!p) { showToast('Product not found','warn'); return; }
      if (_tqState.extraProducts.some(x=>x.id===p.id)) { showToast('Already added','info'); return; }
      const vwp = Number(p.vwp || p.price || p.mrp || 0);
      _tqState.extraProducts.push({ id:p.id, name:p.name, mrp:Number(p.mrp||0), price:vwp, unit:p.unit||'unit', stock:(p.stock==null?null:Number(p.stock)), qty:1 });
      _rerenderStepAddons();
      showToast(p.name+' added','success');
    });
}
function tqSetExtraQty(id, qty) {
  const p = (_tqState.extraProducts||[]).find(x=>x.id===id); if (!p) return;
  p.qty = Math.max(1, parseInt(qty)||1);
  const added = document.getElementById('tq-inv-added'); if (added) added.innerHTML = _renderExtraProductsList();
}
function tqRemoveExtra(id) {
  _tqState.extraProducts = (_tqState.extraProducts||[]).filter(x=>x.id!==id);
  const added = document.getElementById('tq-inv-added'); if (added) added.innerHTML = _renderExtraProductsList();
}

async function _renderStep8() {
  try {
    return await _renderStep8Inner();
  } catch(e) {
    console.error('_renderStep8 crash:', e);
    return `<div class="card" style="border-color:var(--red-border)">
      <h3 class="card-title" style="color:var(--red)">⚠️ Summary could not load</h3>
      <div style="font-size:12px;background:var(--bg2);border-radius:8px;padding:8px;margin-bottom:10px;word-break:break-all;color:var(--text2)">${e?.message||String(e)}</div>
      <p style="font-size:12px;color:var(--text3)">Your room data is safe. Try going back to an earlier step or submitting directly.</p>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button onclick="VW_TILES.tqBack()" class="btn-secondary" style="flex:1">← Go Back</button>
        <button onclick="VW_TILES.tqSubmitForApproval()" class="btn-primary" style="flex:1;background:var(--gold);color:#000">📤 Submit Anyway</button>
      </div>
    </div>`;
  }
}

async function _renderStep8Inner() {
  const st = _tqState;   // ← was accidentally removed when wrapper was added
  const totalSqft = _tqTotalSqft();
  const quoteNo = `TQ/${getFinancialYearLabel()}/${String(Date.now()).slice(-4)}`;

  // Pre-render the materials stock card (async) so it embeds in the template
  const materialsCard = await _tqRenderMaterialsCard(st).catch(()=>'');

  // ── Aggregate per-room tile selections ──
  const rooms = st.rooms || [];
  const weightCfg0 = await VW_DB.getSetting('tile_weight_config', { sizes:[] });

  // Per-room tile BOM
  // BOM uses slots so bathroom wall+floor tiles calculated separately
  const slotsForBOM = _getTileSlots();
  const roomBOMs = slotsForBOM.map(slot => {
    const r = slot.room;
    const sel = st.tileSelections[slot.id] || {};
    const sz = sel.size;
    const roomSqft = slot.sqft;
    if (!sz || !roomSqft) return { room:r, slot, roomSqft, boxes:0, sz:null, weightKg:0 };

    const [mmL, mmW] = sz.mm.split('×').map(Number);
    const sqftPerTile = tileSqftPerTile(mmL, mmW);
    const cfgEntry = (weightCfg0.sizes||[]).find(s=>s.mm===sz.mm);
    const tilesPerBox = cfgEntry?.tiles_per_box || (sqftPerTile<0.5?25:sqftPerTile<1.5?10:sqftPerTile<2.5?6:sqftPerTile<5?4:2);
    const sqftPerBox = sqftPerTile * tilesPerBox;
    // Prefer the Design step's own box count (cut-waste + door-subtraction + breakage already
    // applied) so the Summary matches exactly what staff saw; fall back to area-based only if
    // this slot's design was never built.
    const dsResult = _tqState.design?.[slot.id]?.result;
    const dsBoxes = dsResult?.totalBoxes;
    const designTiles = (dsResult?.tiles?.length > 0) ? dsResult.tiles : null;
    // Prefer: (1) QQ-computed per-code boxes stored on submit, (2) Design step boxes, (3) area-based
    const qqBoxes = sel._qqBoxes;
    const boxes = (qqBoxes > 0) ? qqBoxes
      : (dsBoxes != null && dsBoxes > 0) ? dsBoxes
      : (sqftPerBox > 0 ? Math.ceil(roomSqft / sqftPerBox) : 0);
    const wtPerBox = cfgEntry?.weight_per_box || 20;
    return { room:r, slot, roomSqft, sz, boxes, sqftPerTile, tilesPerBox, sqftPerBox, weightKg: boxes*wtPerBox, designTiles };
  });;

  const boxesNeeded = roomBOMs.reduce((s,b)=>s+b.boxes, 0);
  const totalWeightKg = roomBOMs.reduce((s,b)=>s+b.weightKg, 0);

  // Primary tile/size for grout (use most common or first)
  const sz = roomBOMs.find(b=>b.sz)?.sz || st.selectedSize;
  const prod = st.selectedProduct;
  // Show MRP from selected product(s) as indicative pricing
  // Price each slot from the per-slot price captured in the Design step
  // (pricePerBox, else pricePerSqft); fall back to the selected product's MRP.
  // Iterates slots (not rooms) so a bathroom's wall + floor both count.
  const tileTotal = (() => {
    let total = 0;
    const qp = st.quotedPrices || {};
    roomBOMs.forEach(bom => {
      if (!bom?.boxes) return;
      const sp = qp[bom.slot?.id] || {};
      if (sp.pricePerBox > 0) total += sp.pricePerBox * bom.boxes;
      else if (sp.pricePerSqft > 0) total += sp.pricePerSqft * bom.roomSqft;
      else if (st.selectedProduct?.mrp) total += st.selectedProduct.mrp * bom.boxes;
    });
    return total;
  })();
  const hasPricing = tileTotal > 0;
  const extraProducts = _tqState.extraProducts || [];
  const extraTotal = extraProducts.reduce((s,p)=>s+((p.price||0)*(p.qty||1)),0);

  // ── Spacers — use the whole-quotation result computed in the Spacer step ──
  // (falls back to a slot-based recompute if that step wasn't visited). One
  // rounding on the grand total, and slot-based so bathroom wall/floor count.
  let totalSpacerPkts;
  if (_tqState.spacerResult && _tqState.spacerResult.totalPackets != null) {
    totalSpacerPkts = _tqState.spacerResult.totalPackets;
  } else {
    let totalSpacers = 0;
    const packetSize = (_tqState.spacerType === 'clip' ? (_tqSpacerCfg.clip_pcs_per_packet||50) : (_tqSpacerCfg.pcs_per_packet||100));
    _getTileSlots().forEach(slot => {
      const sp = st.spacerSelections[slot.id];
      const sel = st.tileSelections[slot.id];
      if (!sp?.use || !sel?.size) return;
      const [mmL, mmW] = (sel.size.mm||'600×600').split('×').map(Number);
      const sqftPerTile = tileSqftPerTile(mmL, mmW);
      const tilesNeeded = sqftPerTile > 0 ? Math.ceil(slot.sqft/sqftPerTile) : 0;
      totalSpacers += tilesNeeded * _spacersPerTileFor(sel.size);
    });
    totalSpacerPkts = packetSize > 0 ? Math.ceil(totalSpacers / packetSize) : 0;
  }
  const spacerQty = totalSpacerPkts;

  // ── Adhesive aggregated from adhesiveSelections ──
  let totalAdhBags = 0, totalCemBags = 0, totalSandBags = 0;
  rooms.forEach(r => {
    const adh = st.adhesiveSelections[r.id];
    if (!adh) return;
    totalAdhBags += adh.adhBags || 0;
    totalCemBags += adh.cemBags || 0;
    totalSandBags += adh.sandBags || 0;
  });

  // ── Grout — per slot (using groutSelections for per-room type) ──
  let totalGroutCementKg = 0, totalGroutEpoxyKg = 0;
  _getTileSlots().forEach(slot => {
    const g = (st.groutSelections||{})[slot.id] || st.grout || {};
    if (g.type === 'none') return;
    const sel = st.tileSelections?.[slot.id] || {};
    const sz2 = sel.size;
    if (!sz2?.mm) return;
    const [mmL, mmW] = sz2.mm.split('×').map(Number);
    const T = sz2.thickness || sz2.thicknessMm || 9;
    const J = (st.spacerSelections?.[slot.id]?.mm || 3);
    const roomSqft = slot.sqft || 0;
    if (roomSqft <= 0) return;
    const Area_mm2 = (roomSqft / 10.764) * 1e6;
    const base = ((mmL+mmW)/(mmL*mmW))*T*J*Area_mm2*1.10;
    if (g.type === 'epoxy') totalGroutEpoxyKg  += Math.max(0.5, Math.round(base*1.8e-6*10)/10);
    else                    totalGroutCementKg  += Math.max(0.5, Math.round(base*1.6e-6*10)/10);
  });
  const groutKg = Math.round((totalGroutCementKg + totalGroutEpoxyKg)*10)/10;
  const anyGrout = st.groutSelections
    ? Object.values(st.groutSelections).some(g => g.type !== 'none')
    : (st.grout?.type !== 'none');
  const adt = ADHESIVE_TYPES?.[sz?.adhesive||'cement_mix'];

  // ── Accessory prices — fixed prices for spacers, inventory for adhesive/grout ──
  // Spacer prices are fixed: Cross/Plus ₹90/pkt, Clip ₹170/pkt, Bush ₹170/pkt
  const _isClip = (st.spacerType || 'plus') === 'clip';
  const _clipPkts = st._clipPkts ?? (st.spacerResult?.totalPackets || 0);
  const _bushPkts = st._bushPkts ?? (st.spacerResult?.totalPackets || 0);
  const _savedAccPrices = st._savedAccPrices || {};
  const _accPrices = {
    spacerPerPkt: _isClip ? 170 : 90,  // fixed: cross=₹90, clip=₹170, bush=₹170
    adhPerBag:    _savedAccPrices.adhPerBag    || 0,
    groutPerKg:   _savedAccPrices.groutPerKg   || 0,
    source: 'fixed+inventory',
  };
  const _groutTypes = st.groutSelections
    ? Object.values(st.groutSelections).map(g=>g?.type).filter(t=>t&&t!=='none')
    : [st.grout?.type||'cement'];
  const _epoxDominant = _groutTypes.filter(t=>t==='epoxy').length >= _groutTypes.filter(t=>t==='cement').length;
  try {
    const [adhRes, groutRes] = await Promise.all([
      _accPrices.adhPerBag  ? null : VW_DB.client.from('products').select('price,mrp').or('name.ilike.%adhesive%,name.ilike.%tile fix%,name.ilike.%tile adhesive%').eq('is_active',true).limit(1),
      _accPrices.groutPerKg ? null : VW_DB.client.from('products').select('price,mrp').or(_epoxDominant?'name.ilike.%epoxy%,name.ilike.%epoxy grout%':'name.ilike.%grout%').eq('is_active',true).limit(1),
    ]);
    if (adhRes?.data?.[0])   _accPrices.adhPerBag  = adhRes.data[0].price  || adhRes.data[0].mrp  || 0;
    if (groutRes?.data?.[0]) _accPrices.groutPerKg = groutRes.data[0].price || groutRes.data[0].mrp || 0;
  } catch(_) {}

  // Spacer cost — clip type gets clip + bush separately
  const spacerCostRaw = _isClip
    ? (_clipPkts * 170) + (_bushPkts * 170)
    : (spacerQty > 0 ? spacerQty * 90 : 0);
  const spacerCost = spacerCostRaw > 0 ? spacerCostRaw : (spacerQty > 0 ? -1 : 0);
  const adhCost    = totalAdhBags > 0 ? (_accPrices.adhPerBag > 0  ? totalAdhBags * _accPrices.adhPerBag   : -1) : 0;
  const groutCost  = (groutKg > 0 && anyGrout) ? (_accPrices.groutPerKg > 0 ? Math.ceil(groutKg) * _accPrices.groutPerKg : -1) : 0;
  const accTotalKnown = [spacerCost, adhCost, groutCost].filter(c => c > 0).reduce((s,c) => s+c, 0);
  const accHasTBD     = [spacerCost, adhCost, groutCost].some(c => c === -1);
  const accTotal      = accTotalKnown;

  // ── Weight + Vehicle + Floor Delivery ──
  const weightCfg = await VW_DB.getSetting('tile_weight_config', { sizes:[] });
  const floorCfg = await VW_DB.getSetting('floor_delivery_config', { loading_within_10ft:5, loading_beyond_10ft:8, floor_rates_per_box:{'G':0,'1':6,'2':10,'3':14,'4':18,'5':22} });
  const vehicleCfg = await VW_DB.getSetting('vehicle_config', { vehicles:[], store_lat:16.5206153, store_lng:80.5999189 });

  // weight computed from roomBOMs above

  // totalWeightKg already computed in roomBOMs
   const transportConfig = await VW_DB.getSetting('transport_config', {
    lightVehiclePerKm: 25, heavyVehiclePerKm: 45, minimumCharge: 300
  });
  const vehicles = vehicleCfg.vehicles?.length ? vehicleCfg.vehicles : [
    { label:'Mini Truck / Tata Ace', icon:'🚐', max_kg:1500, per_km: transportConfig.lightVehiclePerKm||25, base_fare: transportConfig.minimumCharge||300 },
    { label:'Large Truck', icon:'🚛', max_kg:8000, per_km: transportConfig.heavyVehiclePerKm||45, base_fare: transportConfig.minimumCharge||300 },
  ];
  const autoVehicle = vehicles.find(v=>totalWeightKg <= (v.max_kg||9999)) || vehicles[vehicles.length-1];

  // Weight per box for the primary tile size (from config, else averaged) — drives the weight card.
  const weightPerBox = (() => {
    const cfgE = (weightCfg.sizes||[]).find(s=>s.mm===sz?.mm);
    if (cfgE?.weight_per_box) return cfgE.weight_per_box;
    return boxesNeeded > 0 ? Math.round(totalWeightKg/boxesNeeded) : 0;
  })();

  // Floor delivery state (stored in _tqState.delivery)
  if (!st.delivery) st.delivery = { type:'self', dropPin:null, distanceKm:0, floors:[], beyondFt:false };

  const floorRates = floorCfg.floor_rates_per_box || {};
  // Loading rate: use per-tile-size loading_per_box from settings; fall back to flat floor_delivery rate
  const _loadingRateForSlot = (slotId) => {
    const sel = st.tileSelections?.[slotId];
    const cfgE = sel?.size?.mm ? (weightCfg.sizes||[]).find(s=>s.mm===sel.size.mm) : null;
    return cfgE?.loading_per_box ?? floorCfg.loading_within_10ft ?? 20;
  };
  // Compute total loading based on per-size rate × boxes for that slot
  const loadingRatePerBox = (() => {
    if (!boxesNeeded) return floorCfg.loading_within_10ft || 20;
    let weightedTotal = 0;
    _getTileSlots().forEach(slot => {
      const dsBoxes = st.design?.[slot.id]?.result?.totalBoxes || 0;
      const bom = roomBOMs.find(b=>b.slot?.id===slot.id);
      const slotBoxes = dsBoxes || bom?.boxes || 0;
      weightedTotal += _loadingRateForSlot(slot.id) * slotBoxes;
    });
    return boxesNeeded > 0 ? Math.round(weightedTotal / boxesNeeded) : (floorCfg.loading_within_10ft || 20);
  })();
  const loadingExtra = floorCfg.loading_beyond_10ft || loadingRatePerBox;

  // ── DELIVERY COST CALCULATION ─────────────────────────────────────
  // Structure (per tile size loading rate = loadingRatePerBox):
  //   Loading at store:      rate × boxes
  //   Unloading (≤10ft):     rate × boxes
  //   Beyond 10ft extra:     rate × boxes  (same as loading — harder site)
  //   Floor carry (per floor level):  rate × floorLevel × boxes  (cumulative per floor)
  //
  // For 300×450 (₹12): beyond 10ft, 2nd floor = 12×(2+1+2)boxes = ₹60/box
  // For 600×1200 (₹20): within 10ft, ground   = 20×2×boxes      = ₹40/box

  let floorCost = 0;
  let loadingCost = 0;
  if (st.delivery.type === 'delivery') {
    // Loading + unloading + optional beyond-10ft (all at per-tile-size rate)
    const beyondMultiplier = st.delivery.beyondFt ? 3 : 2; // 3× = load+unload+beyond; 2× = load+unload
    loadingCost = loadingRatePerBox * beyondMultiplier * boxesNeeded;
    // Floor carrying: per-tile-size rate × floor_level × boxes at that floor
    for (const f of (st.delivery.floors||[])) {
      const floorLevel = f.floor === 'G' ? 0 : parseInt(f.floor) || 0;
      floorCost += loadingRatePerBox * floorLevel * (f.boxes || 0);
    }
  }

  // Distance-based transport — new formula: min_charge for first free_km, then +per_km beyond
  const freeKm = vehicleCfg.free_km ?? autoVehicle?.free_km ?? 5;
  const perKm = autoVehicle?.per_km || 22;
  const minCharge = autoVehicle?.min_charge ?? autoVehicle?.base_fare ?? 0;
  const distKm = st.delivery.distanceKm || 0;
  const transportCost = st.delivery.type === 'delivery' && distKm > 0
    ? Math.max(minCharge, minCharge + Math.round(perKm * Math.max(0, distKm - freeKm)))
    : 0;
  // Allow staff to override transport amount manually
  const transportOverride = st.delivery.transportOverride ?? null;

  // Cache computed costs in state for submission payload
  st.delivery._transportCost = st.delivery.type==='delivery' ? (transportOverride??transportCost) : 0;
  st.delivery._loadingCost   = loadingCost;
  st.delivery._floorCost     = floorCost;

  return `
  <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:14px;padding:16px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:16px;font-weight:800;font-family:'Syne',sans-serif">V Wholesale</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Tile Quotation · ${quoteNo}</div>
      </div>
      <div style="font-size:11px;color:var(--text3);text-align:right">
        ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
      </div>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gold-border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:14px;font-weight:700">${st.customer.name||'Customer'}</div>
          ${st.customer.phone?`<div style="font-size:12px;color:var(--text3)">📞 ${st.customer.phone}</div>`:''}
          ${st.customer.site?`<div style="font-size:12px;color:var(--text3)">📍 ${st.customer.site}</div>`:''}
          ${st.contractor?`<div style="font-size:12px;color:var(--gold);margin-top:3px">🏗 ${st.contractor.name||st.contractor}</div>`:`<div style="font-size:11px;color:var(--text3);margin-top:3px">No contractor</div>`}
        </div>
        <button onclick="VW_TILES._tqEditCustomerFromSummary()"
          style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;background:var(--bg3);border:1px solid var(--border);color:var(--text2);cursor:pointer;flex-shrink:0;margin-left:10px">
          ✎ Edit / Add Contractor
        </button>
      </div>
    </div>
  </div>

  <!-- ROOMS SUMMARY -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Measurement Summary</h3>
    ${(st.rooms||[]).map(r=>`
    <div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:13px;font-weight:600">${ROOM_DEFS[r.type]?.icon||'🏠'} ${r.label}</span>
        <span style="font-size:13px;font-weight:700;color:var(--gold)">${(r.areas||[]).reduce((s,a)=>s+(a.sqft||0),0).toFixed(1)} sqft</span>
      </div>
      ${(r.areas||[]).map(a=>`<div style="font-size:11px;color:var(--text3);margin-top:2px">${a.label}</div>`).join('')}
    </div>`).join('')}
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:14px;font-weight:700">
      <span>Total Area</span>
      <span style="color:var(--gold)">${totalSqft.toFixed(1)} sqft</span>
    </div>
  </div>

  ${_renderTqFlatBreakdown(roomBOMs, st)}

  ${_renderClubbedOrder()}

  <!-- BOM -->
  <!-- BILL OF MATERIALS — per room breakdown -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📋 Bill of Materials</h3>

    <!-- Per-room tile breakdown -->
    ${roomBOMs.filter(b=>b.sz).map(b=>{
      const sp = st.spacerSelections[b.slot?.id||b.room.id] || {};
      const adh = st.adhesiveSelections[b.slot?.id||b.room.id] || {};
      const [mmL,mmW] = (b.sz.mm||"600×600").split("×").map(Number);
      const spPerTile = Math.max(mmL,mmW)>=600?6:4;
      const tiles = b.sqftPerTile>0?Math.ceil(b.roomSqft/b.sqftPerTile):0;
      const spPkts = sp.use ? Math.ceil(tiles*spPerTile/100) : 0;
      // Multi-tile pattern: show each design tile as its own line
      const isMultiTile = b.designTiles && b.designTiles.length > 1;
      const tileRows = isMultiTile
        ? b.designTiles.map(t => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border2)">
            <div>
              <div style="font-size:12px;font-weight:700">${t.name}</div>
              <div style="font-size:10px;color:var(--text3)">${t.pcs} pcs · ${(t.pcs*t.sqftPerTile).toFixed(1)} sqft</div>
              ${t.brand?`<div style="font-size:10px;color:var(--text3)">${t.brand}${t.finish?' · '+t.finish:''}</div>`:''}
            </div>
            <div style="text-align:right">
              <div style="font-size:16px;font-weight:800;color:var(--gold)">${t.boxes}</div>
              <div style="font-size:9px;color:var(--text3)">boxes</div>
              ${t.lineTotal>0?`<div style="font-size:10px;color:var(--text2);margin-top:1px">₹${t.lineTotal.toLocaleString('en-IN')}</div>`:''}
            </div>
          </div>`).join('')
        : `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div>
              <div style="font-size:13px;font-weight:700">${b.slot?.label||b.room.label||b.room.type}</div>
              <div style="font-size:10px;color:var(--text3)">${b.sz.mm}mm · ${b.roomSqft.toFixed(1)} sqft · ${(b.sqftPerTile||0).toFixed(3)} sqft/tile · ${b.tilesPerBox} tiles/box</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:20px;font-weight:800;color:var(--gold)">${b.boxes}</div>
              <div style="font-size:10px;color:var(--text3)">boxes</div>
            </div>
          </div>`;
      return `
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px">
      ${isMultiTile ? `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700">${b.slot?.label||b.room.label||b.room.type}</div>
          <div style="font-size:10px;color:var(--text3)">${b.sz.mm}mm · ${b.roomSqft.toFixed(1)} sqft · <span style="color:var(--gold);font-weight:700">${b.designTiles.length} tile pattern</span></div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:var(--gold)">${b.boxes} total</div>
          <div style="font-size:9px;color:var(--text3)">boxes</div>
        </div>
      </div>
      ${tileRows}` : tileRows}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${spPkts>0?`<span style="font-size:10px;background:var(--bg3);border-radius:5px;padding:3px 8px;color:var(--text2)">📦 ${spPkts} spacer pkts (${sp.mm||3}mm)</span>`:""}
        ${adh.adhBags?`<span style="font-size:10px;background:var(--bg3);border-radius:5px;padding:3px 8px;color:var(--text2)">🧲 ${adh.adhBags} adhesive bags</span>`:""}
        ${adh.cemBags?`<span style="font-size:10px;background:var(--bg3);border-radius:5px;padding:3px 8px;color:var(--text2)">🏗 ${adh.cemBags} cement + ${adh.sandBags} sand bags</span>`:""}
      </div>
    </div>`;
    }).join("")}

    <!-- GRAND TOTAL BOM -->
    <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:12px">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px">📦 Grand Total — All Areas</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
        <div style="text-align:center;background:var(--bg2);border-radius:8px;padding:8px">
          <div style="font-size:10px;color:var(--text3)">Total Area</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${totalSqft.toFixed(1)}</div>
          <div style="font-size:10px;color:var(--text3)">sqft</div>
        </div>
        <div style="text-align:center;background:var(--bg2);border-radius:8px;padding:8px">
          <div style="font-size:10px;color:var(--text3)">Total Boxes</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${boxesNeeded}</div>
          <div style="font-size:10px;color:var(--text3)">boxes</div>
        </div>
        <div style="text-align:center;background:var(--bg2);border-radius:8px;padding:8px">
          <div style="font-size:10px;color:var(--text3)">Weight</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${(totalWeightKg/1000).toFixed(2)}</div>
          <div style="font-size:10px;color:var(--text3)">tonnes</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
        ${spacerQty>0?`<div style="text-align:center;background:var(--bg2);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--text3)">Spacers</div><div style="font-size:15px;font-weight:800;color:var(--gold)">${_tqState.spacerType==='clip'?`${spacerQty}+${spacerQty}`:`${spacerQty} packets`}</div>${_tqState.spacerType==='clip'?`<div style="font-size:9px;color:var(--text3)">clip + plug</div>`:''}</div>`:""}
        ${totalAdhBags>0?`<div style="text-align:center;background:var(--bg2);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--text3)">Adhesive</div><div style="font-size:15px;font-weight:800;color:var(--gold)">${totalAdhBags} bags</div></div>`:""}
        ${totalCemBags>0?`<div style="text-align:center;background:var(--bg2);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--text3)">Cement+Sand</div><div style="font-size:13px;font-weight:800;color:var(--gold)">${totalCemBags}+${totalSandBags} bags</div></div>`:""}
        ${anyGrout && groutKg>0 ? `<div style="text-align:center;background:var(--bg2);border-radius:8px;padding:8px"><div style="font-size:10px;color:var(--text3)">Grout</div><div style="font-size:15px;font-weight:800;color:var(--gold)">${groutKg} kg</div>${totalGroutCementKg>0&&totalGroutEpoxyKg>0?`<div style="font-size:9px;color:var(--text3)">${totalGroutCementKg}kg cement · ${totalGroutEpoxyKg}kg epoxy</div>`:''}</div>`:""}
      </div>
    </div>
    ${hasPricing ? `
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-top:8px">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700">
        <span>Indicative Tile Cost (MRP)</span>
        <span style="color:var(--gold)">₹${tileTotal.toLocaleString('en-IN')}</span>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px">Final price set by management during approval</div>
    </div>` : `
    <div style="margin-top:8px;font-size:11px;color:var(--text3);text-align:center">
      💡 Tile pricing will be set by management during approval
    </div>`}
  </div>
  ${extraProducts.length ? `
  <!-- ADDITIONAL PRODUCTS (from inventory) -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🛒 Additional Products</h3>
    ${extraProducts.map(p=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${p.name}</div>
        <div style="font-size:11px;color:var(--text3)">${p.qty||1} ${p.unit||'unit'} × ₹${p.price||0}</div>
      </div>
      <span style="font-size:13px;font-weight:700;color:var(--gold)">₹${((p.price||0)*(p.qty||1)).toLocaleString('en-IN')}</span>
    </div>`).join('')}
    <div style="display:flex;justify-content:space-between;padding-top:8px;font-size:13px;font-weight:800">
      <span>Products Subtotal</span><span style="color:var(--gold)">₹${extraTotal.toLocaleString('en-IN')}</span>
    </div>
  </div>` : ''}
  ${(() => {
    const addons = st.addons || {};
    const addonDefs = [
      { id:'cleaner', icon:'🧴', label:'Tile Cleaner', unit:'bottle', note:'Post-installation cleaning' },
      { id:'sponge',  icon:'🧽', label:'Grouting Sponge', unit:'pcs', note:'For grout application' },
      { id:'cloth',   icon:'🧻', label:'Waste Cloth Packet', unit:'packet', note:'Wiping & finishing' },
    ];
    const selected = addonDefs.filter(a => addons[a.id]);
    if (!selected.length) return '';
    return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🧰 Installation Accessories</h3>
    ${selected.map(a=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${a.icon} ${a.label}</div>
        <div style="font-size:11px;color:var(--text3)">${a.note} · Price set at billing</div>
      </div>
      <span style="font-size:12px;font-weight:600;color:var(--text3);background:var(--bg2);padding:3px 8px;border-radius:6px">Included</span>
    </div>`).join('')}
    <div style="font-size:10px;color:var(--text3);margin-top:8px;padding:6px 8px;background:var(--bg2);border-radius:6px">
      💡 Prices for accessories confirmed by cashier at point of sale
    </div>
  </div>`;
  })()}
  <!-- AI ROOM VISUALIZER TEASER -->
  <div class="card" style="margin-bottom:10px;background:linear-gradient(135deg,rgba(96,165,250,0.08),rgba(139,92,246,0.06));border-color:rgba(96,165,250,0.3)">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-size:28px">🎨</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">Room Visualizer</div>
        <div style="font-size:11px;color:var(--text3)">See how these tiles look in your space — before buying</div>
      </div>
      <button onclick="VW_TILES.openTileVisualizer()"
        style="padding:8px 12px;background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.4);border-radius:8px;color:#60A5FA;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">
        ✨ Visualize
      </button>
    </div>
    <div style="margin-top:12px">${(()=>{try{return _tqRenderParametricRoom();}catch(e){return '';}})()}</div>
    <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:2px">To-scale preview · tap ✨ Visualize for the full view + AI render</div>
  </div>

  <!-- WEIGHT + VEHICLE CARD (admin-rate, exec read-only) -->
  <div class="card" style="margin-bottom:10px;border-color:rgba(96,165,250,0.3)">
    <h3 class="card-title">⚖️ Total Weight & Vehicle</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Total Weight</div>
        <div style="font-size:20px;font-weight:800;color:var(--text)">${totalWeightKg ? totalWeightKg.toLocaleString('en-IN')+' kg' : '—'}</div>
        <div style="font-size:10px;color:var(--text3)">${boxesNeeded} boxes × ${weightPerBox||'?'} kg/box</div>
        ${!weightPerBox?`<div style="font-size:10px;color:var(--gold);margin-top:3px">⚠️ Weight not set for this tile size in Settings</div>`:''}
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Recommended Vehicle</div>
        <div style="font-size:22px">${autoVehicle?.icon||'🚚'}</div>
        <div style="font-size:12px;font-weight:700;color:var(--text)">${autoVehicle?.label||'—'}</div>
        <div style="font-size:10px;color:var(--text3)">Max ${autoVehicle?.max_kg||'?'} kg</div>
      </div>
    </div>
    <div style="font-size:10px;color:var(--text3);padding:6px 8px;background:var(--bg2);border-radius:6px">
      🔒 Weight per box and vehicle rates are set by admin in Settings. Execs cannot edit.
    </div>
  </div>

  <!-- DELIVERY TYPE + FLOOR + DISTANCE -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🚚 Delivery & Loading</h3>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button onclick="VW_TILES.setDeliveryType('self')"
        style="flex:1;padding:10px;border-radius:10px;border:${st.delivery.type!=='delivery'?'2px solid var(--gold)':'1px solid var(--border)'};background:${st.delivery.type!=='delivery'?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;font-size:12px;font-weight:700;color:${st.delivery.type!=='delivery'?'var(--gold)':'var(--text)'}">
        🏪 Self Pickup<br><span style="font-size:10px;font-weight:400">Loading only</span>
      </button>
      <button onclick="VW_TILES.setDeliveryType('delivery')"
        style="flex:1;padding:10px;border-radius:10px;border:${st.delivery.type==='delivery'?'2px solid var(--gold)':'1px solid var(--border)'};background:${st.delivery.type==='delivery'?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;font-size:12px;font-weight:700;color:${st.delivery.type==='delivery'?'var(--gold)':'var(--text)'}">
        🚚 Delivery<br><span style="font-size:10px;font-weight:400">Loading + transport</span>
      </button>
    </div>

    ${st.delivery.type==='delivery' ? `
    <!-- DISTANCE / DROP PIN -->
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px">📍 Customer Site Distance</div>
      <!-- Site address / distance input -->
      <div class="form-group" style="margin-bottom:8px">
        <label>Customer Site Address / Pincode</label>
        <input type="text" id="tq-del-addr" value="${st.delivery.siteAddress||st.customer.site||''}"
          placeholder="e.g. Bhavanipuram, Vijayawada — 520012"
          oninput="_tqState.delivery.siteAddress=this.value"
          style="font-size:13px">
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button onclick="VW_TILES.calcDeliveryDistanceFromAddress()"
          style="flex:1;padding:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);border-radius:8px;color:#60A5FA;font-size:12px;font-weight:600;cursor:pointer">
          📍 Auto-calculate distance
        </button>
        <a href="https://www.google.com/maps/dir/V+Wholesale+Vijayawada/${encodeURIComponent(st.delivery.siteAddress||st.customer.site||'Vijayawada')}"
          target="_blank" rel="noopener"
          style="flex:1;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text2);font-size:12px;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:4px">
          🗺 Open Google Maps
        </a>
      </div>
      <div class="form-group" style="margin:0">
        <label>Distance (km) <span style="font-size:10px;color:var(--text3)">— enter from Maps or auto-calculate</span></label>
        <input type="number" id="tq-del-dist" value="${distKm||''}" placeholder="e.g. 7.8"
          step="0.1" min="0"
          oninput="_tqState.delivery.distanceKm=parseFloat(this.value)||0;VW_TILES._rerenderStep8()">
      </div>
      ${distKm>0?`
      <div style="font-size:12px;padding:6px 0;border-top:1px solid var(--border);margin-top:6px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span>${autoVehicle?.icon||'🚚'} ${autoVehicle?.label||'—'}</span>
          <span style="font-weight:700;color:var(--gold)">₹${(transportOverride??transportCost).toLocaleString('en-IN')}</span>
        </div>
        <div style="font-size:10px;color:var(--text3)">${distKm<=freeKm?`Within ${freeKm}km free — min charge applies`:`${distKm}km · ₹${minCharge} min + ₹${perKm}/km × ${Math.max(0,distKm-freeKm).toFixed(1)}km beyond ${freeKm}km`}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
          <span style="font-size:11px;color:var(--text3);flex-shrink:0">Override ₹:</span>
          <input type="number" value="${transportOverride??''}" placeholder="Auto (${transportCost})" min="0" step="10" inputmode="numeric"
            oninput="_tqState.delivery.transportOverride=this.value?parseFloat(this.value):null;VW_TILES._rerenderStep8()"
            style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;color:var(--text)">
          ${transportOverride!=null?`<button onclick="_tqState.delivery.transportOverride=null;VW_TILES._rerenderStep8()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px">Reset</button>`:''}
        </div>
      </div>`:''}
    </div>

    <!-- LOADING + UNLOADING -->
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px">🏗 Loading & Unloading</div>

      <!-- LOADING at store (mandatory) -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg3);border-radius:7px;margin-bottom:6px">
        <div>
          <div style="font-size:11px;font-weight:600">Loading at Store</div>
          <div style="font-size:10px;color:var(--text3)">Mandatory · ${boxesNeeded} boxes × ₹${loadingRatePerBox}/box</div>
        </div>
        <span style="font-weight:700;color:var(--gold)">₹${(boxesNeeded*loadingRatePerBox).toLocaleString('en-IN')}</span>
      </div>

      <!-- UNLOADING at site: within or beyond 10ft -->
      <div style="font-size:11px;font-weight:600;margin-bottom:5px;margin-top:8px">Unloading at Customer Site</div>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button onclick="VW_TILES.setLoadingType(false)"
          style="flex:1;padding:8px;border-radius:8px;border:${!st.delivery.beyondFt?'2px solid var(--gold)':'1px solid var(--border)'};background:${!st.delivery.beyondFt?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;font-size:11px;color:${!st.delivery.beyondFt?'var(--gold)':'var(--text)'}">
          ✓ Within 10ft of vehicle<br><span style="font-size:10px;font-weight:400">₹${loadingRatePerBox}/box</span>
        </button>
        <button onclick="VW_TILES.setLoadingType(true)"
          style="flex:1;padding:8px;border-radius:8px;border:${st.delivery.beyondFt?'2px solid var(--gold)':'1px solid var(--border)'};background:${st.delivery.beyondFt?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;font-size:11px;color:${st.delivery.beyondFt?'var(--gold)':'var(--text)'}">
          Beyond 10ft / Manual lift<br><span style="font-size:10px;font-weight:400">₹${loadingRatePerBox}+₹${loadingRatePerBox}/box</span>
        </button>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;padding:5px 8px;background:var(--bg3);border-radius:7px">
        <span>Unloading: ${boxesNeeded} × ₹${loadingRatePerBox}/box${st.delivery.beyondFt?' + ₹'+loadingRatePerBox+'/box beyond':''}</span>
        <span style="font-weight:700;color:var(--gold)">₹${(boxesNeeded*loadingRatePerBox*(st.delivery.beyondFt?2:1)).toLocaleString('en-IN')}</span>
      </div>
    </div>

    <!-- FLOOR DELIVERY: per-floor box allocation from purchased tiles -->
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">🏢 Floor Distribution</div>
        <div style="font-size:10px;color:var(--text3)">Total: ${boxesNeeded} boxes</div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
        Rate = ₹${loadingRatePerBox}/box per floor (based on tile size). 2nd floor = ₹${loadingRatePerBox*2}/box, 3rd = ₹${loadingRatePerBox*3}/box, etc.
      </div>
      <div id="tq-floor-lines">
        ${(st.delivery.floors||[]).map((f,i)=>{
          const floorLevel = f.floor==='G'?0:parseInt(f.floor)||0;
          const lineCost = loadingRatePerBox * floorLevel * (f.boxes||0);
          return `
          <div style="background:var(--bg3);border-radius:8px;padding:8px;margin-bottom:6px">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
              <select onchange="VW_TILES.setFloorLine(${i},'floor',this.value)"
                style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:5px;font-size:12px;color:var(--text)">
                ${['1','2','3','4','5'].map((fl,idx)=>{
                  const lbl = ['1st','2nd','3rd','4th','5th'][idx];
                  const flr = loadingRatePerBox*(idx+1);
                  return `<option value="${fl}" ${String(f.floor)===fl?'selected':''}>${lbl} Floor · ₹${flr}/box</option>`;
                }).join('')}
              </select>
              <div style="display:flex;align-items:center;gap:4px">
                <input type="number" value="${f.boxes||0}" min="0" max="${boxesNeeded}"
                  placeholder="boxes"
                  style="width:55px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:5px;font-size:12px;color:var(--text);text-align:center"
                  onchange="VW_TILES.setFloorLine(${i},'boxes',this.value)">
                <span style="font-size:10px;color:var(--text3)">boxes</span>
              </div>
              <button onclick="VW_TILES.removeFloorLine(${i})"
                style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;flex-shrink:0">✕</button>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3)">
              <span>${['1st','2nd','3rd','4th','5th'][floorLevel-1]||f.floor+'th'} Floor · ₹${loadingRatePerBox*floorLevel}/box (${loadingRatePerBox}×${floorLevel} floors)</span>
              <span style="color:var(--gold);font-weight:600">₹${lineCost.toLocaleString('en-IN')}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      <button onclick="VW_TILES.addFloorLine()"
        style="font-size:11px;background:none;border:1px dashed var(--border);border-radius:8px;padding:5px 12px;color:var(--text3);cursor:pointer;width:100%;margin-top:4px">
        + Add Floor
      </button>
      ${floorCost>0?`
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;padding:6px 0;border-top:1px solid var(--border);margin-top:8px">
        <span>Total floor delivery</span>
        <span style="color:var(--gold)">₹${floorCost.toLocaleString('en-IN')}</span>
      </div>`:''}
    </div>

    <!-- DELIVERY COST TOTAL -->
    ${(transportCost+loadingCost+floorCost)>0?`
    <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:10px">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:6px">Delivery Cost Summary</div>
      ${st.delivery.type==='delivery'&&(transportOverride??transportCost)>0?`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>${autoVehicle?.icon||'🚚'} Transport${distKm<=freeKm?' (within '+freeKm+'km)':' ('+distKm+'km)'}</span><span>₹${(transportOverride??transportCost).toLocaleString('en-IN')}</span></div>`:''}
      ${loadingCost>0?`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>Loading + Unloading (${boxesNeeded} boxes × ₹${loadingRatePerBox*(st.delivery?.beyondFt?3:2)}/box)</span><span>₹${loadingCost.toLocaleString('en-IN')}</span></div>`:''}
      ${floorCost>0?`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>Floor delivery</span><span>₹${floorCost.toLocaleString('en-IN')}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;padding:6px 0;border-top:1px solid var(--gold-border);margin-top:4px"><span>Total Delivery</span><span style="color:var(--gold)">₹${((transportOverride??transportCost)+loadingCost+floorCost).toLocaleString('en-IN')}</span></div>
    </div>` : ''}
    ` : `
    <!-- SELF PICKUP: Loading only -->
    <div style="background:var(--bg2);border-radius:10px;padding:10px">
      <div style="font-size:12px;font-weight:600;margin-bottom:6px">🏗 Loading at Store</div>
      <div style="display:flex;justify-content:space-between;padding:4px 0">
        <span style="font-size:12px;color:var(--text2)">${boxesNeeded} boxes × ₹${loadingRatePerBox}/box</span>
        <span style="font-size:13px;font-weight:700;color:var(--gold)">₹${(boxesNeeded*loadingRatePerBox).toLocaleString('en-IN')}</span>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">Rate from Tile Settings · Packing is free</div>
    </div>`}
  </div>

  <!-- GRAND TOTAL — Complete line-item breakdown -->
  ${(() => {
    const effectiveTransport = st.delivery.type==='delivery' ? (transportOverride??transportCost) : 0;
    const effectiveLoading = st.delivery.type==='delivery' ? loadingCost : (boxesNeeded*loadingRatePerBox);
    const effectiveFloor = floorCost;
    const extraTotal = (st.extraProducts||[]).reduce((s,p)=>s+((p.price||0)*(p.qty||1)),0);
    const grandTotal = tileTotal + extraTotal + accTotal + effectiveTransport + effectiveLoading + effectiveFloor;
    if (!grandTotal) return '';

    // Per-room tile lines
    const tileLines = roomBOMs.filter(b=>b.sz&&b.boxes>0).map(b => {
      const qp = (st.quotedPrices||{})[b.slot?.id||b.room.id] || {};
      const lineAmt = qp.pricePerSqft>0 ? Math.round(qp.pricePerSqft * b.roomSqft) : (qp.pricePerBox>0 ? qp.pricePerBox*b.boxes : 0);
      const tileName = (() => {
        const ds = b.designTiles;
        if (ds?.length>1) return ds.map(t=>t.name||'').join(' + ');
        const sel = st.tileSelections?.[b.slot?.id||b.room.id];
        return sel?.tile_name || b.sz.mm+'mm tile';
      })();
      return { label:`${b.slot?.label||b.room.label||b.room.type}`, sub:`${tileName} · ${b.sz.mm}mm · ${b.boxes} boxes`, amt:lineAmt };
    });

    const row = (lbl,sub,amt,gold)=>`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border2)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:${gold?'var(--gold)':'var(--text)'}">${lbl}</div>
        ${sub?`<div style="font-size:10px;color:var(--text3);margin-top:1px">${sub}</div>`:''}
      </div>
      <div style="font-size:13px;font-weight:700;color:${gold?'var(--gold)':'var(--text)'};flex-shrink:0;margin-left:10px">${amt>0?'₹'+amt.toLocaleString('en-IN'):'—'}</div>
    </div>`;

    return `
  <div class="card" style="margin-bottom:14px;border-color:var(--gold-border)">
    <h3 class="card-title" style="color:var(--gold)">💰 Grand Total — Complete Breakdown</h3>

    ${tileTotal>0?`
    <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">📦 Tiles</div>
    ${tileLines.map(l=>row(l.label,l.sub,l.amt,false)).join('')}
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;font-weight:700;margin-bottom:8px">
      <span style="color:var(--text2)">Tiles Subtotal</span><span style="color:var(--gold)">₹${tileTotal.toLocaleString('en-IN')}</span>
    </div>`:''}

    ${extraTotal>0?`
    <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🛒 Add-on Products</div>
    ${(st.extraProducts||[]).map(p=>row(p.name,`${p.qty||1} ${p.unit||'pcs'} × ₹${(p.price||0).toLocaleString('en-IN')}`,Math.round((p.price||0)*(p.qty||1)),false)).join('')}
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;font-weight:700;margin-bottom:8px">
      <span style="color:var(--text2)">Add-ons Subtotal</span><span style="color:var(--gold)">₹${extraTotal.toLocaleString('en-IN')}</span>
    </div>`:``}

    ${(accTotal > 0 || accHasTBD) ? `
    <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🧰 Installation Materials</div>
    ${spacerCost > 0 ? (
      _isClip
        ? row('📎 Clips + 🔩 Bush', `${_clipPkts} clip pkts × ₹170 + ${_bushPkts} bush pkts × ₹170`, spacerCost, false)
        : row('📦 Tile Spacers', `${spacerQty} pkt${spacerQty>1?'s':''} × ₹90/pkt`, spacerCost, false)
    ) : ''}
    ${spacerCost === -1 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>📦 Tile Spacers</span><span style="color:var(--text3);font-size:11px">${spacerQty} pkts · price TBD</span></div>` : ''}
    ${adhCost > 0     ? row('🧲 Tile Adhesive',   `${totalAdhBags} bag${totalAdhBags>1?'s':''} × ₹${_accPrices.adhPerBag}/bag`, adhCost, false) : ''}
    ${adhCost === -1  ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>🧲 Tile Adhesive</span><span style="color:var(--text3);font-size:11px">${totalAdhBags} bags · price TBD</span></div>` : ''}
    ${groutCost > 0 ? (
      totalGroutCementKg > 0 && totalGroutEpoxyKg > 0
        ? row('Grout (cement + epoxy)', `${totalGroutCementKg}kg cement · ${totalGroutEpoxyKg}kg epoxy`, groutCost, false)
        : row(totalGroutEpoxyKg > 0 ? '⭐ Epoxy Grout' : '🪨 Cement Grout', `${Math.ceil(groutKg)} kg × ₹${_accPrices.groutPerKg}/kg`, groutCost, false)
    ) : ''}
    ${groutCost === -1 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>${totalGroutEpoxyKg>0?'⭐ Epoxy Grout':'🪨 Cement Grout'}</span><span style="color:var(--text3);font-size:11px">${Math.ceil(groutKg)} kg · price TBD</span></div>` : ''}
    ${accTotal > 0 ? `
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;font-weight:700;margin-bottom:8px">
      <span style="color:var(--text2)">Materials Subtotal</span><span style="color:var(--gold)">₹${accTotal.toLocaleString('en-IN')}</span>
    </div>` : ''}
    ${accHasTBD ? `<div style="font-size:10px;color:var(--text3);background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:6px;padding:6px 8px;margin-bottom:8px">
      ⚠️ Some material prices not yet set — TL will set during approval. Final total may be higher.
    </div>` : ''}` : ''}

    ${(effectiveTransport+effectiveLoading+effectiveFloor)>0?`
    <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🚛 Transport & Delivery</div>
    ${effectiveTransport>0?row(autoVehicle?.icon+' '+(autoVehicle?.label||'Transport'),distKm<=freeKm?`Within ${freeKm}km — min charge`:`${distKm}km · ₹${minCharge} + ₹${perKm}/km beyond ${freeKm}km${transportOverride!=null?' (manual override)':''}`,effectiveTransport,false):''}
    ${effectiveLoading>0?row(st.delivery?.type==='delivery'?'🏗 Loading + Unloading':'🏗 Loading at Store',`${boxesNeeded} boxes × ₹${loadingRatePerBox}/box${st.delivery?.type==='delivery'?' (load+unload'+(st.delivery?.beyondFt?'+beyond':'')+(st.delivery?.floors?.length?' +floor carry':'')+')':', store loading only'}`,effectiveLoading,false):''}
    ${effectiveFloor>0?row('🏢 Floor Delivery',`${(st.delivery.floors||[]).map(f=>`${f.boxes||0} boxes to ${f.floor==='G'?'Ground':f.floor+'st/nd/rd floor'}`).join(' + ')}`,effectiveFloor,false):''}
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;font-weight:700;margin-bottom:8px">
      <span style="color:var(--text2)">Delivery Subtotal</span><span style="color:var(--gold)">₹${(effectiveTransport+effectiveLoading+effectiveFloor).toLocaleString('en-IN')}</span>
    </div>`:''}

    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:rgba(245,200,66,0.1);border:2px solid var(--gold-border);border-radius:10px;margin-top:4px">
      <div>
        <div style="font-size:14px;font-weight:800;color:var(--gold)">GRAND TOTAL</div>
        <div style="font-size:10px;color:var(--text3)">GST inclusive · All charges${accHasTBD?' · excl. material prices':''}</div>
      </div>
      <div style="font-size:22px;font-weight:800;color:var(--gold)">₹${grandTotal.toLocaleString('en-IN')}</div>
    </div>
  </div>`;
  })()}

  <!-- PLUMBING REMINDER — if bathroom rooms detected but no bathroom products added -->
  ${(() => {
    const hasBath = (st.rooms||[]).some(r=>['Bathroom','Toilet','Wash','Bath'].some(k=>r.type?.includes(k)));
    const hasBathProduct = (st.extraProducts||[]).some(p=>['Divertor','Cistern','Shower','Faucet','Flush'].some(k=>p.name?.includes(k)));
    return hasBath && !hasBathProduct ? `
  <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.3);border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;color:#60A5FA;margin-bottom:4px">🚿 Bathroom plumbing reminder</div>
    <div style="font-size:11px;color:var(--text2)">Bathroom rooms in this quote — have you checked divertor, concealed cistern, shower fittings? These must be installed before tiles go up.</div>
    <button onclick="VW_TILES.tqBack()" style="margin-top:8px;padding:5px 14px;background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.4);border-radius:8px;color:#60A5FA;font-size:11px;font-weight:700;cursor:pointer">← Go to Add-ons (Step 7)</button>
  </div>` : '';
  })()}


  <!-- T&C -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">Terms & Conditions</h3>
    <ol style="padding-left:16px">
      ${[
        'All prices are GST inclusive. GST breakup provided at invoice.',
        'Returns accepted within 30 days from the date of dispatch only. Original invoice mandatory for all return requests.',
        'Transit damage due to road conditions, handling, weather, or any cause beyond our control is not the responsibility of V Wholesale or our contracted labor. We recommend customers inspect material at time of delivery.',
        'Measurements in this quotation are indicative only, provided to assist planning. Customer must verify all dimensions with their tile layer before purchase. V Wholesale is not responsible for any discrepancy between quoted and actual measurements.',
        'All material quantities are suggested as per industry standard. Please confirm final quantities with your installer before purchase.',
        'Tile designs and stock are subject to change without notice. Discontinued or out-of-stock designs cannot be guaranteed for future supply.',
        'If additional tiles are required after purchase, immediate availability of the same design and batch cannot be promised. Plan your requirement with adequate buffer (we recommend 5–10% extra).',
        'Tile colours may vary slightly between manufacturing batches. Purchase the full requirement in one order to ensure batch consistency.',
        'Prices valid for 7 days from quotation date. Stock availability may change. Payment: 50% advance on order, balance before dispatch.',
        'This quotation covers material supply only. Tile laying, waterproofing, adhesive application, and workmanship quality are the responsibility of the customer and their contractor.',
        'Waterproofing must be completed and ponding-tested before tile laying begins. V Wholesale is not responsible for leakage or damage due to inadequate waterproofing.',
        'All disputes are subject to Vijayawada jurisdiction only.',
      ].map(t=>`<li style="font-size:11px;color:var(--text2);margin-bottom:5px;line-height:1.5">${t}</li>`).join('')}
    </ol>
  </div>

  <!-- MATERIALS STATUS -->
  ${materialsCard}

  <!-- SUBMIT FOR APPROVAL — wizard is for executives to create and submit only -->
  <div class="card" style="margin-bottom:10px;border-color:rgba(96,165,250,0.3)">
    ${st._approvalStatus && st._approvalStatus !== 'draft' ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:14px;padding:6px 14px;border-radius:20px;font-weight:700;background:${st._approvalStatus==='approved'?'rgba(34,197,94,0.15)':st._approvalStatus==='rejected'?'rgba(239,68,68,0.15)':'rgba(245,200,66,0.15)'};color:${st._approvalStatus==='approved'?'var(--green)':st._approvalStatus==='rejected'?'var(--red)':'var(--gold)'}">
        ${st._approvalStatus==='approved'?'✅ Approved':st._approvalStatus==='rejected'?'❌ Rejected':'⏳ Pending Approval'}
      </span>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Quote is in the approval queue. You will be notified once approved.</div>
    <button onclick="VW_TILES._tqRequestEdit()" style="width:100%;padding:10px;background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);border-radius:10px;color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px">
      ✏️ Edit with Reason (re-enter approval flow)
    </button>
    ` : `
    <h3 class="card-title">📤 Submit for Approval</h3>
    ${!st.customer.name ? `
    <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:6px">👤 Customer Name Required</div>
      <input id="tq-submit-cust-name" type="text" placeholder="Customer name..." value="${st.customer?.name||''}"
        oninput="_tqState.customer.name=this.value"
        style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-size:13px;box-sizing:border-box">
      <div style="font-size:10px;color:var(--text3);margin-top:4px">Enter before submitting for approval</div>
    </div>
    ` : ''}
    <p style="font-size:12px;color:var(--text2);margin-bottom:12px">
      Once submitted, approval chain starts automatically: <strong>TL / Sr Exec → Floor Manager → Store Manager → Management</strong> — 30 sec at each level.
    </p>
    <div style="background:var(--bg2);border-radius:10px;padding:10px;font-size:12px;color:var(--text3)">
      After final approval → you can print &amp; share with customer · Cashier collects advance &amp; holds stock
    </div>
    `}
  </div>

  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn-secondary" style="flex:1;min-width:80px" onclick="VW_TILES.tqBack()">← Edit</button>
    ${!st._approvalStatus || st._approvalStatus === 'draft' ? `
    <button class="btn-primary" id="tq-submit-btn" style="flex:1;min-width:80px;background:var(--gold);color:#000" onclick="VW_TILES.tqSubmitForApproval()">📤 Submit for Approval</button>
    ` : `
    <button class="btn-secondary" style="flex:1;min-width:80px" onclick="VW_TILES.tqSharePDF()">📄 Print / Share</button>
    `}
  </div>
  <button style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);color:#60A5FA;font-size:12px;font-weight:700;cursor:pointer"
    onclick="typeof VW_LABOR!=='undefined' && VW_LABOR.renderCreateLaborRequest(${JSON.stringify(st._savedQuoteId||null)})">
    🏗 Also need tile laying? Request Labor
  </button>
  <div style="font-size:11px;color:var(--text3);margin-top:8px;text-align:center">
    ${!st._approvalStatus || st._approvalStatus === 'draft' ? 'Print &amp; Share unlocked only after management approves this quotation' : 'Use "Edit with Reason" to reopen and modify after approval'}
  </div>`;
}

// ───── NAV HELPERS ──────────────────────────────────────────
async function _renderAddonSuggestions(totalSqft, boxesNeeded) {
  // Category tabs mapping to product categories in inventory
  const TABS = [
    { key:'grout',          label:'🪨 Grout',         categories:['Grout'] },
    { key:'adhesive',       label:'🧲 Adhesive',       categories:['Adhesive'] },
    { key:'spacer',         label:'📦 Spacers',        categories:['Spacer'] },
    { key:'profiles',       label:'📐 Profiles',       categories:['Profiles'] },
    { key:'waterproofing',  label:'💧 Waterproofing',  categories:['Waterproofing'] },
    { key:'cleaning',       label:'🧴 Cleaning',       categories:['Accessories'] },
    { key:'other',          label:'🔍 Other',          categories:null }, // open search
  ];

  const activeTab = _tqState._addonTab || 'grout';

  // Fetch products for active tab
  let tabProducts = [];
  const activeTabDef = TABS.find(t => t.key === activeTab);
  if (activeTabDef?.categories) {
    const { data } = await VW_DB.client
      .from('products')
      .select('id,name,brand,category,subcategory,mrp,price,vwp,unit,stock')
      .in('category', activeTabDef.categories)
      .eq('is_active', true)
      .order('subcategory,name')
      .limit(30);
    tabProducts = data || [];
  }

  const addedIds = new Set(((_tqState.extraProducts)||[]).map(p=>p.id));

  const productCard = (p) => {
    const vwp   = p.vwp || p.price || 0;
    const mrp   = p.mrp || 0;
    const disc  = mrp > vwp && vwp > 0 ? Math.round((mrp-vwp)/mrp*100) : 0;
    const added = addedIds.has(p.id);
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:10px;border-radius:10px;margin-bottom:6px;
      border:${added?'2px solid var(--green)':'1px solid var(--border)'};
      background:${added?'rgba(34,197,94,0.05)':'var(--bg2)'}">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:${added?'var(--green)':'var(--text)'}">${p.name}</div>
        <div style="font-size:10px;color:var(--text3)">${p.brand||''} · ${p.subcategory||p.category}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:3px">
          ${vwp > 0 ? `<span style="font-size:12px;font-weight:800;color:var(--gold)">₹${vwp.toLocaleString('en-IN')}/${p.unit||'pc'}</span>` : ''}
          ${mrp > 0 && mrp !== vwp ? `<span style="font-size:10px;color:var(--text3);text-decoration:line-through">MRP ₹${mrp.toLocaleString('en-IN')}</span>` : ''}
          ${disc > 0 ? `<span style="font-size:10px;color:var(--green);font-weight:700">${disc}% off</span>` : ''}
          <span style="font-size:10px;color:${p.stock>0?'var(--text3)':'var(--red)'}">${p.stock>0?p.stock+' in stock':'Out of stock'}</span>
        </div>
      </div>
      <button onclick="VW_TILES.tqAddInventoryProduct(${p.id})"
        style="padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer;flex-shrink:0;
          background:${added?'rgba(34,197,94,0.15)':'var(--gold)'};color:${added?'var(--green)':'#000'}">
        ${added?'✓ Added':'+ Add'}
      </button>
    </div>`;
  };

  const tabButtons = TABS.map(t => `
    <button onclick="VW_TILES.setAddonTab('${t.key}')"
      style="flex:0 0 auto;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;
        border:${activeTab===t.key?'2px solid var(--gold)':'1px solid var(--border)'};
        background:${activeTab===t.key?'var(--gold-muted)':'var(--bg2)'};
        color:${activeTab===t.key?'var(--gold)':'var(--text3)'}">
      ${t.label}
    </button>`).join('');

  const productList = activeTab === 'other'
    ? `<input id="tq-addon-search" type="text" placeholder="🔍 Search any product…"
        oninput="VW_TILES.tqSearchInventory(this.value)"
        style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;margin-bottom:8px;box-sizing:border-box">
      <div id="tq-inv-results"></div>`
    : tabProducts.length
      ? tabProducts.map(productCard).join('')
      : `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">No products found in this category</div>`;

  return `
  <!-- CATEGORY TABS -->
  <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;-webkit-overflow-scrolling:touch">
    ${tabButtons}
  </div>

  <!-- PRODUCTS -->
  <div id="tq-addon-products">
    ${productList}
  </div>

  <!-- ADDED ITEMS -->
  <div id="tq-inv-added">${_renderExtraProductsList()}</div>
  <div style="font-size:10px;color:var(--text3);padding:8px;background:rgba(245,200,66,0.06);border-radius:8px;border:1px solid var(--gold-border);margin-top:8px">
    💡 Prices shown are VWP (V Wholesale Price). Final price confirmed during approval.
  </div>`;
}


// ─── FLOOR TRAP FUNCTIONS ────────────────────────────────────
function tqToggleTrap(t) {
  if (!_tqState.floorTraps) _tqState.floorTraps = [];
  const idx = _tqState.floorTraps.findIndex(x => x.id === t.id);
  if (idx >= 0) {
    _tqState.floorTraps.splice(idx, 1);
  } else {
    _tqState.floorTraps.push({ ...t, qty: 1 });
  }
  const grid = document.getElementById('tq-trap-grid');
  if (grid) {
    const traps = [
      { id:'ft1', size:'90x50mm',  label:'90x50mm (2")',         use:'Small bathroom, hand wash',         material:'PVC Nahani' },
      { id:'ft2', size:'90x63mm',  label:'90x63mm (2.5")',        use:'Standard bathroom, shower',         material:'PVC Nahani' },
      { id:'ft3', size:'110x75mm', label:'110x75mm (3")',         use:'Master bathroom, wash area',        material:'PVC / SS304' },
      { id:'ft4', size:'110x90mm', label:'110x90mm (3.5")',       use:'Bathroom with bathtub',             material:'PVC / SS304' },
      { id:'ft5', size:'110x110mm',label:'110x110mm (4")',        use:'Kitchen, utility, large bath',      material:'PVC / SS304' },
      { id:'ft6', size:'300x300mm',label:'300x300mm SS Square',   use:'Modern shower area, hotel style',   material:'SS304 Square' },
      { id:'ft7', size:'200x200mm',label:'200x200mm SS Square',   use:'Compact modern bathroom',           material:'SS304 Square' },
      { id:'ft8', size:'channel',  label:'Channel Drain (linear)',use:'Walk-in shower, balcony, terrace',  material:'SS304 / ABS' },
    ];
    grid.innerHTML = traps.map(trap => {
      const sel = (_tqState.floorTraps||[]).find(x=>x.id===trap.id);
      const selStyle = sel ? 'background:rgba(34,197,94,0.08);border:2px solid var(--green)' : 'background:var(--bg2);border:1px solid var(--border)';
      const titleColor = sel ? 'var(--green)' : 'var(--text)';
      const qtyHtml = sel ? `<div style="font-size:10px;color:var(--green);margin-top:3px">Qty: <input type="number" value="${sel.qty||1}" min="1" onclick="event.stopPropagation()" onchange="VW_TILES.tqSetTrapQty('${trap.id}',this.value)" style="width:36px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:1px 4px;font-size:11px;color:var(--text)"> nos</div>` : '';
      return `<div onclick="VW_TILES.tqToggleTrap(${JSON.stringify(trap).replace(/'/g, '').replace(/"/g,'&quot;')})" style="${selStyle};border-radius:10px;padding:10px;cursor:pointer"><div style="font-size:12px;font-weight:700;color:${titleColor}">${trap.label}</div><div style="font-size:10px;color:var(--text3);margin-top:2px">${trap.material}</div><div style="font-size:10px;color:var(--text3)">${trap.use}</div>${qtyHtml}</div>`;
    }).join('');
  }
}

function tqSetTrapQty(id, val) {
  const trap = (_tqState.floorTraps||[]).find(x=>x.id===id);
  if (trap) trap.qty = parseInt(val)||1;
}

function tqToggleSoffit(enabled) {
  if (!_tqState.soffit) _tqState.soffit = {};
  _tqState.soffit.enabled = enabled;
  if (!enabled) _tqState.soffit.type = null;
  _rerenderStepAddons();
}

function tqSelectSoffit(type, widthMm) {
  if (!_tqState.soffit) _tqState.soffit = {};
  _tqState.soffit.enabled = true;
  _tqState.soffit.type = type;
  _tqState.soffit.widthMm = widthMm;
  _rerenderStepAddons();
}

function toggleAddon(id, checked) {
  if (!_tqState.addons) _tqState.addons = {};
  _tqState.addons[id] = checked;
}

function setLaborRequired(val) {
  _tqState.laborRequired = val;
  _rerenderStepAddons();
}

async function postLaborFromQuotation() {
  const st = _tqState;
  if (!st.laborRequired) return;
  const fy = getFinancialYearLabel();
  const { data: seq } = await VW_DB.client.from('settings').select('value').eq('key','labor_seq_'+fy).single().catch(()=>({data:null}));
  const next = ((seq?.value)||0)+1;
  const reqNo = `LAB/${fy}/${String(next).padStart(4,'0')}`;
  await VW_DB.client.from('settings').upsert({ key:'labor_seq_'+fy, value:next });
  await VW_DB.client.from('labor_requirements').insert({
    req_no: reqNo,
    customer_name: st.customer.name || 'Unknown',
    customer_phone: (st.customer.phone || '').replace(/(\d{6})(\d{4})/, 'XXXXXX$2'), // mask first 6 digits
    site_address: st.customer.site || '',
    work_type: 'tile_laying',
    total_area_sqft: _tqTotalSqft(),
    tile_brand: st.selectedProduct?.brand || '',
    tile_size: st.selectedSize?.label || '',
    start_date: null,
    procurement_confirmed: true,
    posted_by: VW_AUTH.getCurrentProfile()?.name || '',
    status: 'open',
  });
  showToast(`Labor requirement ${reqNo} posted ✓ — contractors will bid`, 'success');
}


// ───── NAV HELPERS ──────────────────────────────────────────
function _updateStepHeader() {
  const h = document.getElementById('tq-step-header');
  if (h) h.innerHTML = _renderStepHeaderInner();
  window.scrollTo({top:0,behavior:'smooth'});
}


// ─── WALL DESIGN PLANNER (Step 2.5) ─────────────────────────────────────────
// Free-form tile grid — every cell independently assigned a design.
// Orientation toggle: Horizontal (tile wider than tall) or Vertical (tile taller than wide).
// All wall sides share same pattern. Boxes calculated per design type.

const WALL_DESIGNS = [
  { id:'L',  label:'Light',    short:'L', color:'#e8e8e8', textColor:'#333' },
  { id:'D',  label:'Dark',     short:'D', color:'#3a3a3a', textColor:'#fff' },
  { id:'H1', label:'HL 1',     short:'1', color:'#c8860a', textColor:'#fff' },
  { id:'H2', label:'HL 2',     short:'2', color:'#1a6b3c', textColor:'#fff' },
  { id:'H3', label:'HL 3',     short:'3', color:'#1a3a6b', textColor:'#fff' },
  { id:'BD', label:'Border',   short:'B', color:'#7a3010', textColor:'#fff' },
];

function _getWallGrid(slotId) {
  const sel = _tqState.tileSelections[slotId];
  const sz = sel?.size;
  if (!sz) return null;
  const wd = _tqState.wallDesigns?.[slotId] || {};
  const orient = (sel?.subType==='wall') ? (wd.orient || 'H') : 'H'; // floors always horizontal; H=horiz, V=vert

  const [mmL, mmW] = sz.mm.split('×').map(Number);
  // Horizontal: tile placed with longer dim as width
  // Vertical:   tile placed with shorter dim as width (rotated 90°)
  const tileWidthMm  = orient === 'H' ? Math.max(mmL,mmW) : Math.min(mmL,mmW);
  const tileHeightMm = orient === 'H' ? Math.min(mmL,mmW) : Math.max(mmL,mmW);

  const slot = _getTileSlots().find(s=>s.id===slotId);
  const room = slot?.room;
  const wallArea = room?.areas?.find(a=>a.subType==='wall');
  const wallH = wallArea?.h || wallArea?.w || 7;  // h = stored height; fallback 7ft not 8ft
  // Use stored perimeter (wallArea.l) directly — computing from sqft/h gives wrong length
  // because sqft has door deductions, making the visual wall shorter than reality
  const wallLengthFt = wallArea?.l || (wallH > 0 ? (slot?.sqft||0) / wallH : 0);

  const tileWidthFt  = tileWidthMm / 304.8;
  const tileHeightFt = tileHeightMm / 304.8;

  const cols = Math.max(1, Math.ceil(wallLengthFt / tileWidthFt));
  const rows = Math.max(1, Math.ceil(wallH / tileHeightFt));

  // Wall area in sqft — prefer the slot's stored sqft (already accounts for door
  // deductions etc.), fall back to length × height if slot is unavailable.
  const wallSqft = slot?.sqft || (wallLengthFt * wallH) || 0;

  // Cap at 25 cols × 20 rows for mobile
  const displayCols = Math.min(cols, 25);
  const displayRows = Math.min(rows, 20);

  // Grid: array of rows × cols, each cell = design id
  const totalCells = displayRows * displayCols;
  let cells = wd.cells;
  if (!cells || cells.length !== totalCells) {
    cells = new Array(totalCells).fill('L');
    if (wd.cells && wd.cells.length > 0) {
      // Preserve as much as possible if grid resized
      for (let i=0; i<Math.min(cells.length, wd.cells.length); i++) cells[i]=wd.cells[i];
    }
  }

  const sqftPerTile = tileSqftPerTile(mmL, mmW);
  const cfgEntry = (_tqState._weightCfg?.sizes||[]).find(s=>s.mm===sz.mm);
  const tilesPerBox = cfgEntry?.tiles_per_box || (sqftPerTile<0.5?25:sqftPerTile<1.5?10:sqftPerTile<2.5?6:sqftPerTile<5?4:2);
  const sqftPerBox = sqftPerTile * tilesPerBox;

  return { sz, orient, tileWidthMm, tileHeightMm, tileWidthFt, tileHeightFt,
           wallH, wallLengthFt, wallSqft, cols: displayCols, rows: displayRows,
           capped: (cols > displayCols || rows > displayRows),
           cells, sqftPerTile, tilesPerBox, sqftPerBox, slot };
}

function _renderWallDesignPlanner(slot) {
  _tqState._inWallDesign = true;
  _tqState._designSlot = slot.id;
  if (!_tqState.wallDesigns) _tqState.wallDesigns = {};
  if (!_tqState.wallDesigns[slot.id]) _tqState.wallDesigns[slot.id] = {};

  const g = _getWallGrid(slot.id);
  if (!g) return '<div class="card"><p style="color:var(--red)">Select tile size first</p></div>';

  const wd = _tqState.wallDesigns[slot.id];
  // Sync cells into state
  wd.cells = g.cells;
  wd.orient = g.orient;

  // Count cells per design → calculate boxes
  const countByDesign = {};
  WALL_DESIGNS.forEach(d => { countByDesign[d.id] = 0; });
  g.cells.forEach(c => { countByDesign[c] = (countByDesign[c]||0)+1; });

  // Active design (currently painting with)
  const activePaint = wd.activePaint || 'L';

  // Cell pixel size for display — aim for ~30px wide cells on mobile (320px content width)
  const cellPx = Math.max(20, Math.min(38, Math.floor(300 / g.cols)));

  return `
  <!-- Orientation toggle -->
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <button onclick="VW_TILES._setWallOrient('${slot.id}','H')"
      style="flex:1;padding:9px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;
        border:${g.orient==='H'?'2px solid var(--gold)':'1px solid var(--border)'};
        background:${g.orient==='H'?'var(--gold-muted)':'var(--bg2)'};
        color:${g.orient==='H'?'var(--gold)':'var(--text)'}">
      ↔ Horizontal<br><span style="font-size:10px;font-weight:400">${g.tileWidthMm}mm wide × ${g.tileHeightMm}mm tall</span>
    </button>
    <button onclick="VW_TILES._setWallOrient('${slot.id}','V')"
      style="flex:1;padding:9px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;
        border:${g.orient==='V'?'2px solid var(--gold)':'1px solid var(--border)'};
        background:${g.orient==='V'?'var(--gold-muted)':'var(--bg2)'};
        color:${g.orient==='V'?'var(--gold)':'var(--text)'}">
      ↕ Vertical<br><span style="font-size:10px;font-weight:400">${g.tileHeightMm}mm wide × ${g.tileWidthMm}mm tall</span>
    </button>
  </div>

  <!-- Info bar -->
  <div style="background:var(--bg2);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--text2)">
    🧱 ${slot.label} · ${g.wallH}ft H × ${g.wallLengthFt.toFixed(1)}ft L ·
    Grid: ${g.rows} rows × ${g.cols} cols = ${g.rows*g.cols} tiles shown
    ${g.capped ? ' (capped for display)' : ''}
  </div>

  <!-- Paint palette — select active design -->
  <div style="margin-bottom:10px">
    <div style="font-size:10px;color:var(--text3);margin-bottom:5px;font-weight:600;text-transform:uppercase">Tap a colour to paint · then tap tiles in the grid</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      ${WALL_DESIGNS.map(d=>`
      <button onclick="VW_TILES._selectPaint('${slot.id}','${d.id}')"
        style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;cursor:pointer;
          border:${activePaint===d.id?'2px solid var(--gold)':'1px solid var(--border)'};
          background:${activePaint===d.id?'var(--gold-muted)':'var(--bg2)'}">
        <div style="width:18px;height:18px;border-radius:3px;background:${d.color};border:1px solid rgba(0,0,0,0.15)"></div>
        <span style="font-size:11px;font-weight:700;color:${activePaint===d.id?'var(--gold)':'var(--text)'}">${d.label}</span>
      </button>`).join('')}
    </div>
  </div>

  <!-- Tile grid -->
  <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:12px">
    <div style="display:inline-block;border:1px solid var(--border);border-radius:8px;overflow:hidden;user-select:none">
      <!-- Column numbers -->
      <div style="display:flex;background:var(--bg3)">
        <div style="width:${Math.round(cellPx*0.7)}px;flex-shrink:0"></div>
        ${Array.from({length:g.cols},(_,c)=>`
        <div style="width:${cellPx}px;text-align:center;font-size:8px;color:var(--text3);padding:2px 0;flex-shrink:0">${c+1}</div>`).join('')}
      </div>
      ${Array.from({length:g.rows},(_,r)=>`
      <div style="display:flex">
        <div style="width:${Math.round(cellPx*0.7)}px;font-size:8px;color:var(--text3);display:flex;align-items:center;justify-content:center;background:var(--bg3);flex-shrink:0">${r+1}</div>
        ${Array.from({length:g.cols},(_,c)=>{
          const idx = r*g.cols+c;
          const dId = g.cells[idx]||'L';
          const d = WALL_DESIGNS.find(x=>x.id===dId)||WALL_DESIGNS[0];
          return `<div onclick="VW_TILES._paintCell('${slot.id}',${idx})"
            style="width:${cellPx}px;height:${Math.round(cellPx*g.tileHeightMm/g.tileWidthMm)}px;
              background:${d.color};border:1px solid rgba(0,0,0,0.08);
              display:flex;align-items:center;justify-content:center;
              font-size:${cellPx>28?'9':'7'}px;font-weight:700;color:${d.textColor};
              cursor:pointer;flex-shrink:0"
            title="${d.label}">${cellPx>24?d.short:''}</div>`;
        }).join('')}
      </div>`).join('')}
    </div>
  </div>

  <!-- Quick fill buttons -->
  <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px">
    <div style="font-size:10px;color:var(--text3);width:100%;margin-bottom:3px;font-weight:600;text-transform:uppercase">Quick fill:</div>
    <button onclick="VW_TILES._fillAll('${slot.id}','L')" style="font-size:10px;padding:4px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;cursor:pointer">All Light</button>
    <button onclick="VW_TILES._fillRow('${slot.id}',0,'D')" style="font-size:10px;padding:4px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;cursor:pointer">Top row Dark</button>
    <button onclick="VW_TILES._fillRow('${slot.id}',${g.rows-1},'D')" style="font-size:10px;padding:4px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;cursor:pointer">Bottom row Dark</button>
    <button onclick="VW_TILES._fillRow('${slot.id}',${Math.floor(g.rows/2)},'H1')" style="font-size:10px;padding:4px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;cursor:pointer">Middle row HL1</button>
    <button onclick="VW_TILES._fillCol('${slot.id}',0,'BD')" style="font-size:10px;padding:4px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;cursor:pointer">First col Border</button>
    <button onclick="VW_TILES._fillCol('${slot.id}',${g.cols-1},'BD')" style="font-size:10px;padding:4px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;cursor:pointer">Last col Border</button>
  </div>

  <!-- Box summary by design -->
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">📦 Boxes by Design</div>
    ${WALL_DESIGNS.filter(d=>countByDesign[d.id]>0).map(d=>{
      const tiles = countByDesign[d.id];
      const sqft  = tiles * g.sqftPerTile;
      const exact = sqft / g.sqftPerBox;
      const fl = Math.floor(exact);
      const cl = Math.ceil(exact);
      const saved = wd[d.id+'_boxes'] ?? cl; // default to ceiling
      return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border2)">
        <div style="width:14px;height:14px;border-radius:3px;background:${d.color};border:1px solid rgba(0,0,0,0.15);flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700">${d.label}</div>
          <div style="font-size:10px;color:var(--text3)">${tiles} tiles · ${sqft.toFixed(1)} sqft · ${exact.toFixed(2)} boxes</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          ${fl !== cl ? `<button onclick="VW_TILES._setDesignBoxes('${d.id}','${slot.id}',${fl})"
            style="min-width:36px;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;
              border:${saved===fl?'2px solid var(--red)':'1px solid var(--border)'};
              background:${saved===fl?'rgba(239,68,68,0.1)':'var(--bg3)'};
              color:${saved===fl?'var(--red)':'var(--text)'}">${fl}<span style="font-size:9px">↓</span>
          </button>` : ''}
          <button onclick="VW_TILES._setDesignBoxes('${d.id}','${slot.id}',${cl})"
            style="min-width:36px;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;
              border:${saved===cl?'2px solid var(--green)':'1px solid var(--border)'};
              background:${saved===cl?'rgba(34,197,94,0.1)':'var(--bg3)'};
              color:${saved===cl?'var(--green)':'var(--text)'}">${cl}<span style="font-size:9px">↑</span>
          </button>
        </div>
      </div>`;
    }).join('')}
    <div style="display:flex;justify-content:space-between;padding-top:8px;font-size:12px;font-weight:700">
      <span>Total confirmed boxes</span>
      <span style="color:var(--gold)">${WALL_DESIGNS.filter(d=>countByDesign[d.id]>0).reduce((s,d)=>{
        const saved = wd[d.id+'_boxes'] ?? Math.ceil(countByDesign[d.id]*g.sqftPerTile/g.sqftPerBox);
        return s+saved;
      },0)} boxes</span>
    </div>
  </div>

  <button class="btn-primary full-width" onclick="VW_TILES._confirmWallDesign('${slot.id}')">
    ✅ Confirm Design & Continue
  </button>
  <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES._skipWallDesign('${slot.id}')">
    Skip — use total area only
  </button>`;
}

// ─── Grid interaction helpers ─────────────────────────────────────────────────

function _selectPaint(slotId, designId) {
  if (!_tqState.wallDesigns[slotId]) _tqState.wallDesigns[slotId] = {};
  _tqState.wallDesigns[slotId].activePaint = designId;
  const slot = _getTileSlots().find(s=>s.id===slotId);
  if (slot) { const el=document.getElementById('tq-step-content'); if(el) el.innerHTML=_renderWallDesignPlanner(slot); }
}

function _paintCell(slotId, idx) {
  const wd = _tqState.wallDesigns[slotId];
  if (!wd) return;
  const paint = wd.activePaint || 'L';
  if (!wd.cells) return;
  wd.cells[idx] = paint;
  // Update just this cell's colour without full re-render (fast paint)
  const g = _getWallGrid(slotId);
  const d = WALL_DESIGNS.find(x=>x.id===paint) || WALL_DESIGNS[0];
  const cells = document.querySelectorAll('[onclick*="_paintCell"]');
  // Find the specific cell by its onclick attribute
  for (const cell of cells) {
    if (cell.getAttribute('onclick') === `VW_TILES._paintCell('${slotId}',${idx})`) {
      cell.style.background = d.color;
      cell.style.color = d.textColor;
      cell.textContent = g ? d.short : '';
      break;
    }
  }
  // Update box summary in background
  _updateDesignSummary(slotId, g);
}

function _updateDesignSummary(slotId, g) {
  // Recompute counts and update summary text without full re-render
  if (!g) return;
  const wd = _tqState.wallDesigns[slotId];
  if (!wd?.cells) return;
  const countByDesign = {};
  WALL_DESIGNS.forEach(d => { countByDesign[d.id] = 0; });
  wd.cells.forEach(c => { countByDesign[c] = (countByDesign[c]||0)+1; });
  // Update tiles/sqft/boxes text for each design row
  WALL_DESIGNS.filter(d=>countByDesign[d.id]>=0).forEach(d => {
    const tiles = countByDesign[d.id];
    const sqft  = tiles * g.sqftPerTile;
    const exact = g.sqftPerBox > 0 ? sqft / g.sqftPerBox : 0;
    // Find the summary text elements by scanning DOM
    // (full re-render is safer here — only triggers if user pauses)
  });
}

function _setWallOrient(slotId, orient) {
  if (!_tqState.wallDesigns[slotId]) _tqState.wallDesigns[slotId] = {};
  _tqState.wallDesigns[slotId].orient = orient;
  _tqState.wallDesigns[slotId].cells = null; // reset grid on orientation change
  const slot = _getTileSlots().find(s=>s.id===slotId);
  if (slot) { const el=document.getElementById('tq-step-content'); if(el) el.innerHTML=_renderWallDesignPlanner(slot); }
}

function _fillAll(slotId, designId) {
  const wd = _tqState.wallDesigns[slotId];
  if (!wd?.cells) return;
  wd.cells = wd.cells.map(()=>designId);
  const slot = _getTileSlots().find(s=>s.id===slotId);
  if (slot) { const el=document.getElementById('tq-step-content'); if(el) el.innerHTML=_renderWallDesignPlanner(slot); }
}

function _fillRow(slotId, rowIdx, designId) {
  const g = _getWallGrid(slotId);
  const wd = _tqState.wallDesigns[slotId];
  if (!g || !wd?.cells) return;
  for (let c=0; c<g.cols; c++) wd.cells[rowIdx*g.cols+c] = designId;
  const slot = _getTileSlots().find(s=>s.id===slotId);
  if (slot) { const el=document.getElementById('tq-step-content'); if(el) el.innerHTML=_renderWallDesignPlanner(slot); }
}

function _fillCol(slotId, colIdx, designId) {
  const g = _getWallGrid(slotId);
  const wd = _tqState.wallDesigns[slotId];
  if (!g || !wd?.cells) return;
  for (let r=0; r<g.rows; r++) wd.cells[r*g.cols+colIdx] = designId;
  const slot = _getTileSlots().find(s=>s.id===slotId);
  if (slot) { const el=document.getElementById('tq-step-content'); if(el) el.innerHTML=_renderWallDesignPlanner(slot); }
}

function _setDesignBoxes(designId, slotId, boxes) {
  if (!_tqState.wallDesigns[slotId]) _tqState.wallDesigns[slotId] = {};
  _tqState.wallDesigns[slotId][designId+'_boxes'] = boxes;
  const slot = _getTileSlots().find(s=>s.id===slotId);
  if (slot) { const el=document.getElementById('tq-step-content'); if(el) el.innerHTML=_renderWallDesignPlanner(slot); }
}

// Legacy row/col helpers (kept for compat)

function _confirmWallDesign(slotId) {
  if (!_tqState.wallDesigns[slotId]) _tqState.wallDesigns[slotId] = {};
  // Auto-save ceiling boxes for any design without explicit choice
  const g = _getWallGrid(slotId);
  if (g) {
    const wd = _tqState.wallDesigns[slotId];
    const countByDesign = {};
    WALL_DESIGNS.forEach(d => { countByDesign[d.id] = 0; });
    (wd.cells||[]).forEach(c => { countByDesign[c] = (countByDesign[c]||0)+1; });
    WALL_DESIGNS.forEach(d => {
      if (countByDesign[d.id] > 0 && wd[d.id+'_boxes'] === undefined) {
        const exact = countByDesign[d.id] * g.sqftPerTile / g.sqftPerBox;
        wd[d.id+'_boxes'] = Math.ceil(exact);
      }
    });
  }
  _tqState.wallDesigns[slotId].confirmed = true;
  tqNext();
}

function _skipWallDesign(slotId) {
  if (!_tqState.wallDesigns[slotId]) _tqState.wallDesigns[slotId] = {};
  _tqState.wallDesigns[slotId].confirmed = true;
  _tqState.wallDesigns[slotId].skipped = true;
  tqNext();
}


function _updateQuotedPrice(val, mode) {
  const slots = _getTileSlots();
  const firstSlot = slots[0];
  if (!firstSlot) return;
  if (!_tqState.quotedPrices[firstSlot.id]) _tqState.quotedPrices[firstSlot.id] = {};
  const qp = _tqState.quotedPrices[firstSlot.id];
  qp.pricePerBox = parseFloat(val)||0;
  // Update sqft display
  const el = document.getElementById('tq-price-sqft');
  if (el) {
    const sel = _tqState.tileSelections[firstSlot.id];
    const sz = sel?.size;
    if (sz) {
      const [mmL,mmW] = sz.mm.split('×').map(Number);
      const cfgEntry = (_tqState._weightCfg?.sizes||[]).find(s=>s.mm===sz.mm);
      const tpb = cfgEntry?.tiles_per_box || 4;
      const spb = tileSqftPerTile(mmL, mmW) * tpb;
      el.value = spb > 0 ? Math.round(qp.pricePerBox/spb*100)/100 : '';
    }
  }
}

function _updatePriceNote(val) {
  const slots = _getTileSlots();
  const firstSlot = slots[0];
  if (!firstSlot) return;
  if (!_tqState.quotedPrices[firstSlot.id]) _tqState.quotedPrices[firstSlot.id] = {};
  _tqState.quotedPrices[firstSlot.id].note = val;
}


function selectGroutColour(colourId) {
  if (!_tqState.grout) _tqState.grout = {};
  _tqState.grout.colorId = colourId;
  const GROUT_COLOURS = [
    {id:'white',hex:'#f8f8f8',name:'White'},{id:'ivory',hex:'#f5edd5',name:'Ivory'},
    {id:'light_grey',hex:'#c8c8c8',name:'Light Grey'},{id:'grey',hex:'#888888',name:'Grey'},
    {id:'dark_grey',hex:'#444444',name:'Dark Grey'},{id:'charcoal',hex:'#2a2a2a',name:'Charcoal'},
    {id:'mocha',hex:'#8b7355',name:'Mocha'},{id:'beige',hex:'#d4bc94',name:'Beige'},
  ];
  const col = GROUT_COLOURS.find(c=>c.id===colourId);
  if (col) { _tqState.grout.colorHex = col.hex; _tqState.grout.colorName = col.name; }
  // Also save to all slot groutSelections
  _getTileSlots().forEach(s => {
    if (!_tqState.groutSelections[s.id]) _tqState.groutSelections[s.id] = {};
    Object.assign(_tqState.groutSelections[s.id], { colorId: colourId, colorHex: col?.hex, colorName: col?.name });
  });
  document.getElementById('tq-step-content').innerHTML = _renderStep7();
}


// ─── WALL VISUALIZER — rendered after design planning ─────────────────────────
function _renderWallVisualizer() {
  const slots = _getTileSlots().filter(s => _tqState.tileSelections[s.id]?.size && _tqState.wallDesigns[s.id]?.cells);

  if (!slots.length) {
    // No designs — skip
    tqNext();
    return '<div style="padding:20px;text-align:center"><div class="spinner"></div></div>';
  }

  return `
  <div style="padding:0 0 8px">
    <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text)">🖼 Wall Preview</div>

    ${slots.map(slot => {
      const g = _getWallGrid(slot.id);
      if (!g) return '';
      const wd = _tqState.wallDesigns[slot.id];
      const grout = _tqState.groutSelections[slot.id] || _tqState.grout || {};
      const groutColor = grout.colorHex || '#888';
      const GAP = 2; // px gap to simulate grout joint
      const cellW = Math.max(14, Math.min(32, Math.floor(280 / g.cols)));
      const cellH = Math.round(cellW * g.tileHeightMm / g.tileWidthMm);

      return `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase">
          ${slot.label} · ${g.wallH}ft × ${g.wallLengthFt.toFixed(1)}ft · ${g.orient==='H'?'Horizontal':'Vertical'} lay
        </div>
        <!-- Grout background = grout colour, tiles shown as coloured cells with gap -->
        <div style="display:inline-block;background:${groutColor};border-radius:4px;padding:${GAP}px;
          box-shadow:0 2px 8px rgba(0,0,0,0.2)">
          ${Array.from({length:g.rows},(_,r)=>`
          <div style="display:flex;gap:${GAP}px;margin-bottom:${GAP}px">
            ${Array.from({length:g.cols},(_,c)=>{
              const idx = r*g.cols+c;
              const dId = (wd.cells||[])[idx]||'L';
              const d = WALL_DESIGNS.find(x=>x.id===dId)||WALL_DESIGNS[0];
              return `<div style="width:${cellW}px;height:${cellH}px;background:${d.color};border-radius:1px"></div>`;
            }).join('')}
          </div>`).join('')}
        </div>
        <!-- Legend -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
          ${WALL_DESIGNS.filter(d=>(wd.cells||[]).includes(d.id)).map(d=>{
            const count = (wd.cells||[]).filter(c=>c===d.id).length;
            const boxes = wd[d.id+'_boxes'] || Math.ceil(count*g.sqftPerTile/g.sqftPerBox);
            return `<div style="display:flex;align-items:center;gap:4px;font-size:10px">
              <div style="width:10px;height:10px;background:${d.color};border:1px solid rgba(0,0,0,0.2)"></div>
              <span>${d.label}: <strong>${boxes} boxes</strong></span>
            </div>`;
          }).join('')}
          <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text3)">
            <div style="width:10px;height:10px;background:${groutColor};border:1px solid rgba(0,0,0,0.2)"></div>
            <span>Grout: ${grout.colorName||'Selected'}</span>
          </div>
        </div>
      </div>`;
    }).join('')}

    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-secondary" style="flex:1" onclick="VW_TILES._redesignWall()">
        ← Redesign
      </button>
      <button class="btn-primary" style="flex:1" onclick="VW_TILES.tqNext()">
        Looks Good → Continue
      </button>
    </div>
  </div>`;
}

function _redesignWall() {
  // Go back to first wall/floor slot's design planner
  const allSlots = _getTileSlots().filter(s => _tqState.tileSelections[s.id]?.size);
  if (allSlots.length > 0) {
    // Reset first slot's confirmation
    allSlots.forEach(s => { if (_tqState.wallDesigns[s.id]) _tqState.wallDesigns[s.id].confirmed = false; });
    _tqState._inWallDesign = true;
    _tqState._showVisualizer = false;
    const el = document.getElementById('tq-step-content');
    if (el) el.innerHTML = _renderWallDesignPlanner(allSlots[0]);
  }
}

// ════════════ STEP: DESIGN, TILE & PRICE (per slot) ════════════
// Evolves the wall designer: real tiles per slot (size-filtered, inventory-first +
// non-inventory fallback), grid painting, box-by-tile (auto round-up + manual ↓/↑),
// per-SFT price → box rate → line total.
const _DS_SWATCH = ['#c8860a','#1a6b3c','#1a3a6b','#7a3010','#6b1a5a','#0a6b6b','#8a6d1a','#555'];

function _dsSlots() { return _getTileSlots().filter(s => _tqState.tileSelections[s.id]?.size); }
function _dsCur() {
  const slots = _dsSlots();
  if (!slots.length) return null;
  let i = _tqState._designIdx || 0;
  if (i >= slots.length) i = slots.length - 1;
  if (i < 0) i = 0;
  _tqState._designIdx = i;
  return slots[i];
}
function _dsState(slotId) {
  if (!_tqState.design) _tqState.design = {};
  if (!_tqState.design[slotId]) _tqState.design[slotId] = { palette:[], activeIdx:0, boxesOverride:{}, priceOverride:{}, cells:null };
  return _tqState.design[slotId];
}
function _dsTPB(sizeMm) {
  const norm = (sizeMm||'').replace(/\s/g,'');
  const cfg = ((_tqSizeCfg||{}).sizes||[]).find(s=>(s.mm||'').replace(/\s/g,'')===norm);
  return cfg?.tiles_per_box || 0;
}
function _dsMapProduct(p, sizeMm, isStock) {
  const tpb = p.tiles_per_box || _dsTPB(sizeMm) || 4;
  const cov = p.coverage_per_box || 0;
  const perSft = p.price_per_sqft || (cov ? (p.price||p.mrp||0)/cov : 0);
  return { key:(isStock?'':'ni_')+String(p.id||p.name||Math.random()), name:p.name||'Tile', brand:p.brand||'',
           finish:p.tile_finish||p.finish||'', tilesPerBox:tpb, coverage:cov, imageUrl:p.image_url||'',
           perSft:Math.round((perSft||0)*100)/100, boxPrice:p.price||p.mrp||0, stock:p.stock||0, isStock };
}
async function _dsFetchTiles(slot) {
  if (!_tqState._dsTilesCache) _tqState._dsTilesCache = {};
  if (!_tqState._dsTilesCacheSize) _tqState._dsTilesCacheSize = {};
  const sel = _tqState.tileSelections[slot.id];
  const sizeMm = sel?.size?.mm || sel?.sizeMm || '';
  // Cache is keyed by slot, but the tiles depend on the slot's CURRENT size. If the stamped
  // size no longer matches, the cache is stale (size was changed) — re-fetch for the new size.
  if (_tqState._dsTilesCache[slot.id] && _tqState._dsTilesCacheSize[slot.id] === sizeMm)
    return _tqState._dsTilesCache[slot.id];
  const want = sizeMm.replace(/\s/g,'').toLowerCase();
  let tiles = [];
  try {
    const { data } = await VW_DB.client.from('products').select('*').eq('category','Tiles').gt('stock',0);
    tiles = (data||[]).filter(p => {
      const ps = (p.tile_size_mm||'').replace(/\s/g,'').toLowerCase();
      return want ? ps === want : true;   // strict size match — never a wrong size
    }).map(p => _dsMapProduct(p, sizeMm, true));
  } catch(e){}
  if (window.VW_NON_INV) {
    try {
      const ni = await VW_NON_INV.fetchTilesForQuotation(sizeMm, slot.subType||'both');
      (ni.onRequest||[]).forEach(p => tiles.push(_dsMapProduct(p, sizeMm, false)));
    } catch(e){}
  }
  _tqState._dsTilesCache[slot.id] = tiles;
  _tqState._dsTilesCacheSize[slot.id] = sizeMm;
  return tiles;
}
async function _renderStepDesign() {
  const slot = _dsCur();
  if (!slot) return _dsRenderInner();
  await _dsFetchTiles(slot);
  return _dsRenderInner();
}
function _dsRerender() {
  const el = document.getElementById('tq-step-content');
  if (el) el.innerHTML = _dsRenderInner();
}
function _dsRenderInner() {
  const slot = _dsCur();
  if (!slot) return `<div class="card"><p style="color:var(--text2)">Pick tile sizes first (Step 3).</p>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES.tqBack()">← Back</button></div>`;
  const slots = _dsSlots();
  const idx = _tqState._designIdx || 0;
  const tiles = (_tqState._dsTilesCache||{})[slot.id] || [];
  const st = _dsState(slot.id);
  const sel = _tqState.tileSelections[slot.id];
  const sizeMm = sel?.size?.mm || '';
  const g = _getWallGrid(slot.id);
  // ── Re-edit invalidation: if the tile size, room dimensions, or areas changed since
  // the last render, throw away the stale result/overrides so it recomputes fresh.
  // (Palette and price overrides are deliberate user choices — we keep those.)
  const _sig = `${sizeMm}|${slot.subType}|${(slot.room?.areas||[]).map(a=>`${a.l||0}×${a.w||0}:${a.base||0}:${a.skirting||0}:${a.skirtingHeightIn||0}:${a.dw||0}:${a.dh||0}`).join('|')}`;
  if (st._sig && st._sig !== _sig) {
    delete st.result;
    st.boxesOverride = {};
    st.cells = null;
  }
  st._sig = _sig;
  // keep cells sized to the current grid
  if (g) {
    const need = g.rows * g.cols;
    if (!Array.isArray(st.cells) || st.cells.length !== need) st.cells = new Array(need).fill(0);
  }
  // map palette keys → tile objects
  const pal = (st.palette||[]).map(k => tiles.find(t=>t.key===k)).filter(Boolean);
  if (st.activeIdx >= pal.length) st.activeIdx = 0;

  // --- palette picker ---
  const inPal = k => (st.palette||[]).includes(k);
  const palettePicker = `
    <div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;margin-bottom:6px">
      Tiles for ${sizeMm}mm ${slot.subType==='wall'?'wall':'floor'} · tap to add to this room${tiles.length?'':' — none in stock'}
    </div>
    ${tiles.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px">
      ${tiles.map((t,i)=>{
        const on = inPal(t.key);
        const swatch = on ? _DS_SWATCH[(st.palette.indexOf(t.key))%_DS_SWATCH.length] : 'var(--bg3)';
        return `<div onclick="VW_TILES._dsTogglePalette('${t.key}')" style="display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;cursor:pointer;
          border:${on?'2px solid var(--gold)':'1px solid var(--border)'};background:${on?'var(--gold-muted)':'var(--bg2)'}">
          <div style="width:18px;height:18px;border-radius:4px;flex-shrink:0;border:1px solid rgba(0,0,0,0.2);background:${t.imageUrl?`url('${t.imageUrl}') center/cover, ${swatch}`:swatch}"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700">${t.name}</div>
            <div style="font-size:10px;color:var(--text3)">${[t.brand,t.finish].filter(Boolean).join(' · ')||'—'} · ${t.isStock?`Stock ${t.stock}`:'Non-inventory (order)'} · ${t.tilesPerBox}/box</div>
          </div>
          <div style="font-size:11px;color:var(--gold);font-weight:700;flex-shrink:0">${t.perSft?`₹${t.perSft}/sft`:'set price'}</div>
        </div>`;
      }).join('')}
    </div>` : `<div style="font-size:11px;color:var(--text2);padding:10px;background:var(--bg2);border-radius:9px;margin-bottom:6px">
      No ${sizeMm}mm tile in live inventory. Non-inventory options are pulled automatically when available; otherwise change the size in Step 3.
    </div>`}`;

  if (!pal.length) {
    return `
    <div style="background:var(--bg2);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:11px;color:var(--text2);display:flex;justify-content:space-between;align-items:center">
      <span>🎨 ${slot.label} · ${sizeMm}mm · ${(g?g.wallSqft:0).toFixed?.(0)||''} · ${idx+1} of ${slots.length}</span>
      <button onclick="VW_TILES._dsEditSizes()" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:10px;color:var(--text3);cursor:pointer">✎ Edit sizes</button>
    </div>
    ${palettePicker}
    <div style="font-size:11px;color:var(--text3);text-align:center;padding:10px">Add at least one tile to design this area.</div>
    <button class="btn-secondary full-width" style="margin-top:6px" onclick="VW_TILES.tqBack()">← Back</button>`;
  }

  // --- grid ---
  const cellPx = g ? Math.max(20, Math.min(38, Math.floor(300 / g.cols))) : 30;
  const grid = g ? `
  <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:10px">
    <div style="display:inline-block;border:1px solid var(--border);border-radius:8px;overflow:hidden;user-select:none">
      ${Array.from({length:g.rows},(_,r)=>`
      <div style="display:flex">
        ${Array.from({length:g.cols},(_,c)=>{
          const ci = r*g.cols+c;
          const pi = st.cells[ci] ?? 0;
          const col = _DS_SWATCH[pi%_DS_SWATCH.length];
          const _img = pal[pi]?.imageUrl;
          const _bg = _img ? `url('${_img}') center/cover, ${col}` : col;
          return `<div onclick="VW_TILES._dsPaint(${ci})" style="width:${cellPx}px;height:${Math.round(cellPx*g.tileHeightMm/g.tileWidthMm)}px;
            background:${_bg};border:1px solid rgba(0,0,0,0.12);cursor:pointer;flex-shrink:0"></div>`;
        }).join('')}
      </div>`).join('')}
    </div>
  </div>` : '';

  // --- box-by-tile summary ---
  const counts = {};
  (st.cells||[]).forEach(pi => counts[pi]=(counts[pi]||0)+1);
  const sqftPerTile = g ? g.sqftPerTile : 0;
  const totalCells = (st.cells||[]).length || 1;
  // ── Area-based tile count: net sqft × (1 + waste%) ÷ sqftPerTile.
  // Single buffer (default 10%) covers cut waste, offcuts, and breakage.
  // No grid ceil×ceil — that method scraps every offcut and massively over-counts on large tiles.
  let realTiles;
  {
    const slotNow = _dsCur();
    const wastePct = _tqState.breakagePct ?? 10;
    const areas = (slotNow?.room?.areas||[]).filter(a =>
      slotNow.subType==='wall' ? a.subType==='wall' : (a.subType==='floor'||!a.subType));
    let netSqft = 0;
    for (const a of areas) {
      let base = a.base || 0;
      if (!base) base = a.sqft || 0; // fallback for areas entered without L×W
      if (a.dw && a.dh) base = Math.max(0, base - a.dw * a.dh); // subtract door/window
      netSqft += base;
      if (a.skirting && a.skirtingHeightIn) netSqft += a.skirting * (a.skirtingHeightIn / 12);
    }
    if (!netSqft) netSqft = slot.sqft || 0; // slot-level fallback
    realTiles = sqftPerTile > 0 ? Math.ceil(netSqft * (1 + wastePct / 100) / sqftPerTile) : totalCells;
  }
  const _wastePct = _tqState.breakagePct ?? 10;
  const scale = totalCells ? realTiles/totalCells : 1;
  let totalAmount = 0, totalBoxes = 0;
  const resultTiles = [];
  const lines = pal.map((t,pi)=>{
    const pcs = Math.round((counts[pi]||0) * scale);
    const tpb = t.tilesPerBox||4;
    const exact = pcs/tpb;
    const fl = Math.floor(exact), cl = Math.ceil(exact);
    const boxes = st.boxesOverride[pi] ?? cl;
    const sqftPerBox = sqftPerTile*tpb;
    // Price is a function of Brand + Size + Finish — same combo, same price everywhere.
    if (!_tqState._dsPriceByCombo) _tqState._dsPriceByCombo = {};
    const _combo = `${(t.brand||'').toLowerCase().trim()}|${sizeMm}|${(t.finish||'').toLowerCase().trim()}`;
    if (_tqState._dsPriceByCombo[_combo] == null) _tqState._dsPriceByCombo[_combo] = (st.priceOverride[pi] ?? t.perSft ?? 0);
    const perSft = _tqState._dsPriceByCombo[_combo];
    const boxPrice = Math.round(perSft*sqftPerBox);
    const lineTotal = boxes*boxPrice;
    const spare = boxes*tpb - pcs;
    totalAmount += lineTotal; totalBoxes += boxes;
    resultTiles.push({ key:t.key, name:t.name, brand:t.brand||'', finish:t.finish||'', size:sizeMm,
      pcs, tpb, boxes, perSft, sqftPerTile, lineTotal, isStock:t.isStock });
    const swatch = _DS_SWATCH[pi%_DS_SWATCH.length];
    return `
    <div style="padding:8px 0;border-bottom:1px solid var(--border2)">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:14px;height:14px;border-radius:3px;background:${swatch};flex-shrink:0;border:1px solid rgba(0,0,0,0.2)"></div>
        <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700">${t.name}</div>
          <div style="font-size:10px;color:var(--text3)">${pcs} pcs · ${(pcs*sqftPerTile).toFixed(1)} sqft · needs ${exact.toFixed(2)} box${spare>0?` · <span style="color:var(--gold)">+${spare} spare (wastage)</span>`:''}</div></div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          ${fl!==cl?`<button onclick="VW_TILES._dsBoxes(${pi},${fl})" title="Trim wastage — round down to ${fl} boxes" style="min-width:34px;padding:4px 7px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:${boxes===fl?'2px solid var(--red)':'1px solid var(--border)'};background:${boxes===fl?'rgba(239,68,68,0.1)':'var(--bg3)'};color:${boxes===fl?'var(--red)':'var(--text)'}">${fl}<span style="font-size:9px">↓</span></button>`:''}
          <button onclick="VW_TILES._dsBoxes(${pi},${cl})" title="Include wastage — round up to ${cl} boxes" style="min-width:34px;padding:4px 7px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:${boxes===cl?'2px solid var(--gold)':'1px solid var(--border)'};background:${boxes===cl?'var(--gold-muted)':'var(--bg3)'};color:${boxes===cl?'var(--gold)':'var(--text)'}">${cl}<span style="font-size:9px">↑</span></button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-left:22px;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--text3)">₹</span>
        <input type="number" value="${perSft? (Math.round(perSft*100)/100) : ''}" placeholder="per sft" min="0" step="any" inputmode="decimal"
          oninput="VW_TILES._dsPriceLive(${pi},this.value)" onchange="VW_TILES._dsPrice(${pi},this.value)"
          style="width:62px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 6px;font-size:12px;color:var(--text)">
        <span style="font-size:10px;color:var(--text3)">/sft · or ₹</span>
        <input type="number" value="${boxPrice||''}" placeholder="per box" min="0" step="any" inputmode="decimal"
          oninput="VW_TILES._dsBoxPriceLive(${pi},this.value,${sqftPerBox})" onchange="VW_TILES._dsBoxPrice(${pi},this.value,${sqftPerBox})"
          style="width:72px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 6px;font-size:12px;color:var(--text)">
        <span style="font-size:10px;color:var(--text3)">/box × ${boxes}</span>
        <span style="flex:1;text-align:right;font-size:13px;font-weight:700;color:var(--gold)">₹${lineTotal.toLocaleString('en-IN')}</span>
      </div>
    </div>`;
  }).join('');
  st.result = { totalBoxes, totalAmount, tiles: resultTiles };

  const last = idx >= slots.length-1;
  return `
  <div style="background:var(--bg2);border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:11px;color:var(--text2);display:flex;justify-content:space-between;align-items:center">
    <span>🎨 ${slot.label} · ${sizeMm}mm · ${slot.subType==='wall'?'Wall':'Floor'} · room ${idx+1} of ${slots.length}</span>
    <button onclick="VW_TILES._dsEditSizes()" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:10px;color:var(--text3);cursor:pointer">✎ Edit sizes</button>
  </div>
  ${palettePicker}
  ${pal.length>1?`<div style="font-size:10px;color:var(--text3);margin-bottom:5px">Tap a tile below, then tap grid cells to design. One tile fills the whole room by default.</div>
  <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
    ${pal.map((t,pi)=>`<button onclick="VW_TILES._dsSetActive(${pi})" style="display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;cursor:pointer;border:${st.activeIdx===pi?'2px solid var(--gold)':'1px solid var(--border)'};background:${st.activeIdx===pi?'var(--gold-muted)':'var(--bg2)'}">
      <div style="width:14px;height:14px;border-radius:3px;background:${_DS_SWATCH[pi%_DS_SWATCH.length]}"></div>
      <span style="font-size:11px;font-weight:700;color:${st.activeIdx===pi?'var(--gold)':'var(--text)'}">${t.name.length>14?t.name.slice(0,14)+'…':t.name}</span></button>`).join('')}
    <button onclick="VW_TILES._dsFillAll()" style="font-size:10px;padding:5px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;cursor:pointer">Fill all</button>
    <button onclick="VW_TILES._dsCopyCol1()" style="font-size:10px;padding:5px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;cursor:pointer">Copy 1st column →</button>
  </div>
  ${(g && slot.subType==='wall')?`<div style="display:flex;gap:6px;margin-bottom:8px">
    <button onclick="VW_TILES._dsOrient('H')" style="flex:1;padding:7px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:${g.orient==='H'?'2px solid var(--gold)':'1px solid var(--border)'};background:${g.orient==='H'?'var(--gold-muted)':'var(--bg2)'};color:${g.orient==='H'?'var(--gold)':'var(--text)'}">↔ Horizontal</button>
    <button onclick="VW_TILES._dsOrient('V')" style="flex:1;padding:7px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:${g.orient==='V'?'2px solid var(--gold)':'1px solid var(--border)'};background:${g.orient==='V'?'var(--gold-muted)':'var(--bg2)'};color:${g.orient==='V'?'var(--gold)':'var(--text)'}">↕ Vertical</button>
  </div>`:''}
  ${grid}`:''}
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:4px">📦 Boxes &amp; price by tile</div>
    ${lines}
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;font-weight:800">
      <span>${totalBoxes} boxes</span><span style="color:var(--gold)">₹${totalAmount.toLocaleString('en-IN')}</span>
    </div>
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border2);font-size:10px;color:var(--text3)">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--text3)">🛡 Breakage buffer:</span>
        <input type="number" value="${_wastePct}" min="0" max="20" step="1" inputmode="numeric"
          style="width:42px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:2px 6px;font-size:12px;color:var(--text);text-align:center"
          onchange="VW_TILES._dsSetBreakage(this.value)">
        <span style="font-size:10px;color:var(--text3)">% &nbsp;·&nbsp; 0 = exact sqft, no buffer</span>
        ${_wastePct>0?`<span style="font-size:10px;color:var(--gold)">+${_wastePct}% = ${((slot.sqft||0)*(1+_wastePct/100)).toFixed(1)} sqft with buffer</span>`:`<span style="font-size:10px;color:var(--green)">No buffer — exact sqft used</span>`}
      </div>
    </div>
  </div>
  <button class="btn-primary full-width" style="background:var(--gold);color:#000" onclick="VW_TILES._dsContinue()">${last?'Confirm Design → Spacer':'Confirm → Next Room'}</button>
  <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_TILES._dsPrev()">← ${idx>0?'Previous Room':'Back'}</button>`;
}
function _dsTogglePalette(key) {
  const slot = _dsCur(); if(!slot) return;
  const st = _dsState(slot.id);
  const i = st.palette.indexOf(key);
  if (i>=0) {
    st.palette.splice(i,1);
    // remap any cells that pointed at/after removed index
    st.cells = (st.cells||[]).map(pi => pi===i?0:(pi>i?pi-1:pi));
    if (st.activeIdx>=st.palette.length) st.activeIdx=0;
  } else {
    if (st.palette.length>=4) { showToast('Up to 4 tiles per room','warn'); return; }
    st.palette.push(key);
    st.activeIdx = st.palette.length-1;
  }
  _dsRerender();
}
function _dsSetActive(i){ const s=_dsCur(); if(s){_dsState(s.id).activeIdx=i; _dsRerender();} }
function _dsPaint(ci){ const s=_dsCur(); if(!s)return; const st=_dsState(s.id); if(!st.cells)return; st.cells[ci]=st.activeIdx||0; _dsRerender(); }
function _dsFillAll(){ const s=_dsCur(); if(!s)return; const st=_dsState(s.id); st.cells=(st.cells||[]).map(()=>st.activeIdx||0); _dsRerender(); }
// Copy the design painted in the 1st column down each row across ALL columns. Lets staff lay out
// one vertical profile, replicate it across the whole area, then tweak individual cells by hand.
function _dsCopyCol1(){
  const s=_dsCur(); if(!s)return;
  const st=_dsState(s.id);
  const g=_getWallGrid(s.id);
  if(!g||!Array.isArray(st.cells))return;
  for(let r=0;r<g.rows;r++){
    const v=st.cells[r*g.cols] ?? 0;            // value in column 0 of this row
    for(let c=1;c<g.cols;c++) st.cells[r*g.cols+c]=v;
  }
  _dsRerender();
}
function _dsOrient(o){ const s=_dsCur(); if(!s)return; if(!_tqState.wallDesigns)_tqState.wallDesigns={}; if(!_tqState.wallDesigns[s.id])_tqState.wallDesigns[s.id]={}; _tqState.wallDesigns[s.id].orient=o; _dsState(s.id).cells=null; _dsRerender(); }
function _dsBoxes(pi,n){ const s=_dsCur(); if(!s)return; _dsState(s.id).boxesOverride[pi]=n; _dsRerender(); }
function _dsToggleBreakage(){ _tqState.breakageOff = !_tqState.breakageOff; _dsRerender(); }
function _dsSetBreakage(v){ _tqState.breakagePct = Math.max(0, Math.min(20, parseFloat(v)||0)); _dsRerender(); }
function _dsStorePrice(pi,v){
  const s=_dsCur(); if(!s)return;
  const st=_dsState(s.id);
  const t=((_tqState._dsTilesCache||{})[s.id]||[]).find(x=>x.key===(st.palette||[])[pi]);
  const sizeMm=_tqState.tileSelections[s.id]?.size?.mm||'';
  if(t){
    if(!_tqState._dsPriceByCombo)_tqState._dsPriceByCombo={};
    const combo=`${(t.brand||'').toLowerCase().trim()}|${sizeMm}|${(t.finish||'').toLowerCase().trim()}`;
    _tqState._dsPriceByCombo[combo]=parseFloat(v)||0;
  }
}
// Live: store on each keystroke WITHOUT re-rendering — keeps the input focused so the
// full number (including decimals like 28.50) can be typed in one go.
function _dsPriceLive(pi,v){ _dsStorePrice(pi,v); }
// Commit: store + re-render to refresh box price and totals. Fires on blur / change.
function _dsPrice(pi,v){ _dsStorePrice(pi,v); _dsRerender(); }

// Box-price entry (#4A): the user can price per BOX instead of per sft. We convert to the
// single source of truth (per-sft = boxPrice / sqftPerBox) so the entered box price is honored
// exactly (line total = boxes × box price) and both inputs stay in sync.
function _dsStoreBoxPrice(pi,v,sqftPerBox){
  const s=_dsCur(); if(!s)return;
  const st=_dsState(s.id);
  const t=((_tqState._dsTilesCache||{})[s.id]||[]).find(x=>x.key===(st.palette||[])[pi]);
  const sizeMm=_tqState.tileSelections[s.id]?.size?.mm||'';
  if(t && sqftPerBox>0){
    if(!_tqState._dsPriceByCombo)_tqState._dsPriceByCombo={};
    const combo=`${(t.brand||'').toLowerCase().trim()}|${sizeMm}|${(t.finish||'').toLowerCase().trim()}`;
    const box=parseFloat(v)||0;
    _tqState._dsPriceByCombo[combo]= box>0 ? (box/sqftPerBox) : 0;
  }
}
function _dsBoxPriceLive(pi,v,sqftPerBox){ _dsStoreBoxPrice(pi,v,sqftPerBox); }
function _dsBoxPrice(pi,v,sqftPerBox){ _dsStoreBoxPrice(pi,v,sqftPerBox); _dsRerender(); }
function _dsEditSizes(){ _tqState.step=2; _renderStep2().then(html=>{const el=document.getElementById('tq-step-content'); if(el)el.innerHTML=html; _updateStepHeader();}); }
async function _dsContinue(){
  const slots=_dsSlots(); const idx=_tqState._designIdx||0;
  const slot=_dsCur(); if(slot){ const st=_dsState(slot.id); if(!st.palette||!st.palette.length){ showToast('Add a tile for this room','warn'); return; } st.confirmed=true; }
  if (idx < slots.length-1) {
    _tqState._designIdx = idx+1;
    const ns=_dsCur(); if(ns) await _dsFetchTiles(ns);
    _dsRerender();
  } else {
    tqNext();
  }
}
function _dsPrev(){
  const idx=_tqState._designIdx||0;
  if (idx>0){ _tqState._designIdx=idx-1; const s=_dsCur(); if(s){_dsFetchTiles(s).then(()=>_dsRerender());} }
  else { tqBack(); }
}

// Club the same design across rooms so box rounding happens once on the combined
// piece count (Brand+Design+Size+Finish), not per room.
function _tqClubbedTiles() {
  const byDesign = {};
  Object.values(_tqState.design||{}).forEach(d => {
    (d.result?.tiles||[]).forEach(t => {
      const key = `${t.brand}|${t.name}|${t.size}|${t.finish}`.toLowerCase();
      if (!byDesign[key]) byDesign[key] = { name:t.name, brand:t.brand, size:t.size, finish:t.finish,
        tpb:t.tpb||1, perSft:t.perSft||0, sqftPerTile:t.sqftPerTile||0, isStock:t.isStock, pcs:0, roomBoxes:0 };
      byDesign[key].pcs += t.pcs||0;
      byDesign[key].roomBoxes += t.boxes||0;
    });
  });
  return Object.values(byDesign).map(d => {
    const clubbedBoxes = Math.ceil(d.pcs / (d.tpb||1));
    const amount = clubbedBoxes * Math.round((d.perSft||0) * (d.sqftPerTile||0) * (d.tpb||1));
    return { ...d, clubbedBoxes, saved: Math.max(0, d.roomBoxes - clubbedBoxes), amount };
  });
}
function _renderClubbedOrder() {
  const clubbed = _tqClubbedTiles();
  if (!clubbed.length) return '';
  const totalBoxes = clubbed.reduce((s,d)=>s+d.clubbedBoxes,0);
  const totalSaved = clubbed.reduce((s,d)=>s+d.saved,0);
  const totalAmount = clubbed.reduce((s,d)=>s+d.amount,0);
  return `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;margin-bottom:8px">📦 Combined Tile Order <span style="font-size:10px;font-weight:400;color:var(--text3)">— clubbed by design across rooms</span></div>
    ${clubbed.map(d=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border2)">
      <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700">${d.name}</div>
        <div style="font-size:10px;color:var(--text3)">${[d.brand,d.size?d.size+'mm':'',d.finish].filter(Boolean).join(' · ')} · ${d.pcs} pcs${d.saved>0?` · <span style="color:var(--green)">saved ${d.saved} box${d.saved>1?'es':''}</span>`:''}</div></div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px;font-weight:800;color:var(--gold)">${d.clubbedBoxes} box${d.clubbedBoxes>1?'es':''}</div>
        <div style="font-size:10px;color:var(--text3)">₹${d.amount.toLocaleString('en-IN')}</div>
      </div>
    </div>`).join('')}
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;font-weight:800">
      <span>${totalBoxes} boxes${totalSaved>0?` · ${totalSaved} saved by clubbing`:''}</span>
      <span style="color:var(--gold)">₹${totalAmount.toLocaleString('en-IN')}</span>
    </div>
  </div>`;
}

// Unified step dispatch for the reordered flow:
// 0 Customer · 1 Rooms · 2 Tile Size · 3 Design/Tile/Price · 4 Spacer ·
// 5 Adhesive · 6 Grout · 7 Add-ons · 8 Summary
async function _tqRenderStep(s) {
  switch (s) {
    case 0: return await _renderStep0();
    case 1: return _renderStep1();
    case 2: return await _renderStep2();
    case 3: return await _renderStepDesign();
    case 4: return _renderStep3();          // Spacer
    case 5: return _renderStep4();          // Adhesive
    case 6: return _renderStep7();          // Grout & Epoxy
    case 7: return await _renderStepAddons();
    case 8: return await _renderStep8();    // Summary
    default: return _renderStep1();
  }
}

async function tqNext() {
  // Step 0: validate customer — contractor is OPTIONAL
  if (_tqState.step === 0) {
    const name = _tqState.customer.name || document.getElementById('tq-cust-name')?.value.trim();
    if (!name) { showToast('Enter or search customer to continue', 'warn'); return; }
    _tqState.customer.name = name;
    _tqState.customer.phone = _tqState.customer.phone || document.getElementById('tq-cust-phone')?.value.trim() || '';
    _tqState.customer.site = _tqState.customer.site || document.getElementById('tq-cust-site')?.value.trim() || '';
    if (!_tqState.customer.id && _tqState.customer.phone?.length === 10) {
      await _saveNewCustomer();
    }
  }
  _tqState.step = Math.min(8, _tqState.step + 1);
  const el = document.getElementById('tq-step-content');
  if (el) {
    el.innerHTML = '<div style="padding:20px;text-align:center"><div class="spinner"></div></div>';
    try {
      el.innerHTML = await _tqRenderStep(_tqState.step);
      _updateStepHeader();
      _tqAutoSave();
    } catch(err) {
      console.error('tqNext render error (step '+_tqState.step+'):', err);
      _updateStepHeader(); // keep header in sync with the step that actually failed
      el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--red)">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px">Could not load this step</div>
        <div style="font-size:11px;background:var(--bg2);border-radius:8px;padding:8px;margin-bottom:10px;word-break:break-all;text-align:left;color:var(--text2)">${err?.message||String(err)}</div>
        <button onclick="VW_TILES.tqBack()" style="color:var(--gold);background:none;border:1px solid var(--gold-border);border-radius:8px;padding:8px 16px;cursor:pointer">← Go back</button>
      </div>`;
    }
  }
}

async function tqBack() {
  _tqState.step = Math.max(1, _tqState.step - 1);
  const el = document.getElementById('tq-step-content');
  if (el) {
    try {
      el.innerHTML = await _tqRenderStep(_tqState.step);
      _updateStepHeader();
      _tqAutoSave();
    } catch(err) {
      console.error('tqBack render error (step '+_tqState.step+'):', err);
    }
  }
}

// Edit with Reason — re-opens from TQ Summary page. Delegates to tqEditQuote.
async function _uploadTQReferenceImage(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `tq-references/${Date.now()}.${ext}`;
  const { error } = await VW_DB.client.storage
    .from('visit-photos')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) { showToast('Upload failed: ' + error.message, 'error'); return; }
  const { data: urlData } = VW_DB.client.storage.from('visit-photos').getPublicUrl(path);
  _tqState.customer.referenceImageUrl  = urlData?.publicUrl || null;
  _tqState.customer.referenceImageName = file.name;
  showToast('Reference image uploaded ✅', 'success');
  // Re-render step 0 to show preview
  const content = document.getElementById('tq-step-content');
  if (content) content.innerHTML = await _renderStep0();
}

async function _tqRequestEdit() {
  const id = _tqState._savedQuoteId || _tqState._draftId;
  if (!id) {
    _tqState._approvalStatus = null;
    _rerenderStep8();
    showToast('Quote not yet saved — edit freely', 'info');
    return;
  }

  // If previously approved/submitted — ask for reason and save a revision snapshot
  if (_tqState._approvalStatus && _tqState._approvalStatus !== 'draft') {
    const reason = prompt('Reason for editing this quotation? (This will be recorded in revision history)');
    if (reason === null) return; // cancelled
    const prof = VW_AUTH.getCurrentProfile();

    // Save current state as a revision snapshot BEFORE editing
    const { data: current } = await VW_DB.client.from('tile_quotations')
      .select('*').eq('id', id).single().catch(()=>({ data: null }));

    if (current) {
      const { data: lastRev } = await VW_DB.client
        .from('tq_revisions').select('version').eq('tq_id', id)
        .order('version', { ascending: false }).limit(1).single()
        .catch(()=>({ data: null }));

      const nextVersion = (lastRev?.version || current.version || 1);
      await VW_DB.client.from('tq_revisions').insert({
        tq_id: id,
        tq_no: current.tq_no,
        version: nextVersion,
        snapshot: current,
        changed_by: prof?.id || null,
        changed_by_name: prof?.name || '',
        change_reason: reason,
      }).catch(()=>{});

      // Bump version on the live quote
      await VW_DB.client.from('tile_quotations')
        .update({ version: nextVersion + 1, approval_status: 'draft' })
        .eq('id', id).catch(()=>{});
    }
    showToast(`Revision v${(current?.version||1)} saved — editing now`, 'info');
  }

  await tqEditQuote(id);
}

// Auto-save the in-progress tile quotation as a draft so nothing is ever lost and it can be
// resumed from the Tile Quotes list. Fire-and-forget — never blocks navigation.
async function _tqAutoSave() {
  const st = _tqState;
  if (!st || !st.customer || !st.customer.name) return;          // need a customer first
  if (st._approvalStatus && st._approvalStatus !== 'draft') return;  // never auto-touch a submitted/approved quote
  if (st._autoSaving) return; st._autoSaving = true;
  try {
    const profile = VW_AUTH.getCurrentProfile();
    const payload = {
      customer_name: st.customer.name, customer_phone: st.customer.phone || '',
      customer_id: st.customer.id || null, site_address: st.customer.site || '',
      quoted_prices: st.quotedPrices || {}, wall_designs: st.wallDesigns || {},
      design_tiles: Object.fromEntries(Object.entries(st.design||{}).map(([k,v])=>[k,v?.result?.tiles||[]])),
      rooms: st.rooms || [], tile_selections: st.tileSelections || {},
      spacer_selections: st.spacerSelections || {}, adhesive_selections: st.adhesiveSelections || {},
      grout_selections: st.groutSelections || {}, selected_size: st.selectedSize || null,
      selected_product: st.selectedProduct || null, spacer: st.spacer || {}, adhesive: st.adhesive || {},
      beading: st.beading || [], grout: st.grout || {}, addons: st.addons || {},
      floor_traps: st.floorTraps || [], soffit: st.soffit || {}, delivery: st.delivery || {},
      total_area_sqft: _tqTotalSqft(), labor_required: st.laborRequired || false,
      extra_products: st.extraProducts || [],
      breakage_pct: st.breakagePct ?? 10,
      draft_step: st.step || 0, updated_at: new Date().toISOString(),
    };
    const id = st._savedQuoteId || st._draftId;
    if (id) {
      await VW_DB.client.from('tile_quotations').update(payload).eq('id', id).eq('approval_status','draft');
    } else {
      const fy = getFinancialYearLabel();
      payload.tq_no = 'TQ/'+fy+'/D'+String(Date.now()).slice(-5);  // provisional draft number
      payload.status = 'draft'; payload.approval_status = 'draft';
      payload.created_by = profile?.name || ''; payload.created_by_id = profile?.id || null;
      const { data, error } = await VW_DB.client.from('tile_quotations').insert(payload).select('id').single();
      if (!error && data) st._draftId = data.id;
    }
  } catch(e) { console.warn('TQ auto-save skipped:', e?.message||e); }
  finally { st._autoSaving = false; }
}

// ───── DELIVERY + FLOOR HELPERS ─────────────────────────────
function setDeliveryType(type) {
  if (!_tqState.delivery) _tqState.delivery={type:'self',distanceKm:0,floors:[],beyondFt:false};
  _tqState.delivery.type=type; _rerenderStep8();
}
function setLoadingType(beyond) { _tqState.delivery.beyondFt=beyond; _rerenderStep8(); }
function addFloorLine() {
  if(!_tqState.delivery) _tqState.delivery={type:'delivery',distanceKm:0,floors:[],beyondFt:false};
  if(!_tqState.delivery.floors) _tqState.delivery.floors=[];
  _tqState.delivery.floors.push({floor:'1',boxes:10}); // default 1st floor, 10 boxes
  _rerenderStep8();
}
function removeFloorLine(i){_tqState.delivery.floors.splice(i,1);_rerenderStep8();}
function setFloorLine(i,field,val){if(_tqState.delivery?.floors?.[i])_tqState.delivery.floors[i][field]=field==='boxes'?parseInt(val)||0:val;}
// Calculate delivery distance from address using Nominatim geocoding
async function calcDeliveryDistanceFromAddress() {
  const addr = document.getElementById('tq-del-addr')?.value?.trim() ||
                _tqState.delivery.siteAddress || _tqState.customer.site;
  if (!addr || addr.length < 5) { showToast('Enter site address first', 'warn'); return; }
  _tqState.delivery.siteAddress = addr;
  showToast('Calculating distance...', 'info');
  try {
    // Geocode address via Nominatim
    const encoded = encodeURIComponent(addr + ', Andhra Pradesh, India');
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'VWholesale/1.0' } });
    const data = await res.json();
    if (data[0]) {
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
      // Haversine distance from V Wholesale store (16.5206153°N, 80.5999189°E)
      const R = 6371;
      const dLat = (lat - 16.5206153) * Math.PI / 180;
      const dLng = (lng - 80.5999189) * Math.PI / 180;
      const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
        Math.cos(16.5206153*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
      const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 10) / 10;
      _tqState.delivery.distanceKm = distKm;
      showToast(`Distance: ${distKm} km (straight-line · add 20-30% for road distance)`, 'success');
      const el = document.getElementById('tq-del-dist');
      if (el) el.value = distKm;
      _rerenderStep8();
    } else {
      showToast('Address not found — enter distance manually', 'warn');
    }
  } catch(e) {
    showToast('Could not calculate — enter distance manually', 'warn');
  }
}

// Legacy pincode-based distance (kept for backward compat)
async function calcDeliveryDistance(pincode) {
  if (!pincode || pincode.length < 6) return;
  _tqState.delivery.pincode = pincode;
  // Redirect to address-based calc
  _tqState.delivery.siteAddress = _tqState.delivery.siteAddress || pincode;
  calcDeliveryDistanceFromAddress();
}


async function _rerenderStep8() {
  const el = document.getElementById('tq-step-content');
  if (el) el.innerHTML = await _renderStep8();
}

// ───── PDF SHARE (generates printable HTML, opens print dialog) ─
function tqSharePDF() {
  // Print/Share only allowed after management approval
  // If we have a saved quote ID with approval status, check it
  const savedId = _tqState._savedQuoteId;
  const approvalStatus = _tqState._approvalStatus;

  if (savedId && approvalStatus && approvalStatus !== 'approved') {
    const statusMsg = {
      pending_approval: 'still pending approval from management',
      rejected: 'was rejected — revise and resubmit first',
      draft: 'not yet submitted for approval',
    }[approvalStatus] || approvalStatus;
    showToast(`Cannot print — quotation is ${statusMsg}`, 'warn');
    return;
  }

  const html = _buildPrintHTML();
  const win = window.open('','_blank');
  if (!win) { showToast('Allow popups to open PDF','warn'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>{ win.print(); }, 800);
  // After print dialog, guide user to share via WA
  setTimeout(()=>{
    const phone = (_tqState.customer.phone||'').replace(/\D/g,'');
    if (phone) {
      const msg = encodeURIComponent('*V Wholesale — Tile Quotation*\n\nDear '+(_tqState.customer.name||'Customer')+',\n\nPlease find your tile quotation attached as PDF.\n\nTotal area: '+_tqTotalSqft().toFixed(1)+' sqft\n\nFor any queries: 📞 8712697930\n— V Wholesale, Vijayawada');
      window.open('https://wa.me/91'+phone+'?text='+msg,'_blank');
    }
  }, 2000);
}

// ───── PRINT ────────────────────────────────────────────────
function tqPrint() {
  // Print/Share only allowed after management approval
  const savedId = _tqState._savedQuoteId;
  const approvalStatus = _tqState._approvalStatus;

  if (savedId && approvalStatus && approvalStatus !== 'approved') {
    const statusMsg = {
      pending_approval: 'still pending approval from management',
      rejected: 'was rejected — revise and resubmit first',
      draft: 'not yet submitted for approval',
    }[approvalStatus] || approvalStatus;
    showToast(`Cannot print — quotation is ${statusMsg}`, 'warn');
    return;
  }

  const html = _buildPrintHTML();
  const win = window.open('','_blank');
  if (!win) { showToast('Allow popups to print','warn'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(), 800);
}

function _buildPrintHTML(overrideState) {
  const st = overrideState || _tqState;
  const slots = _getTileSlots ? _getTileSlots() : [];

  // Build per-slot BOM rows
  const slotRows = slots.map(slot => {
    const sel = (st.tileSelections||{})[slot.id] || {};
    const sz = sel.size;
    const qp = (st.quotedPrices||{})[slot.id] || {};
    const roomSqft = slot.sqft || 0;
    if (!sz || !roomSqft) return '';
    const [mmL,mmW] = sz.mm.split('×').map(Number);
    const tilesPerBox = sz.tilesPerBox || (mmL>=600&&mmW>=1200?2:mmL>=600?4:6);
    const spb = tileSqftPerTile(mmL,mmW)*tilesPerBox;
    const boxes = spb>0 ? Math.ceil(roomSqft/spb) : 0;
    const lineTotal = qp.pricePerBox>0 ? qp.pricePerBox*boxes : (qp.pricePerSqft>0 ? Math.round(qp.pricePerSqft*roomSqft) : 0);
    const priceStr = qp.pricePerBox>0 ? '₹'+qp.pricePerBox.toLocaleString('en-IN')+'/box' : (qp.pricePerSqft>0 ? '₹'+qp.pricePerSqft+'/sqft' : 'As approved');
    const label = slot.label || slot.room?.label || slot.room?.type || 'Room';
    // Tile image if available
    const imgUrl = sel.photos?.[0]?.url || sel.imageUrl || '';
    const imgHtml = imgUrl ? '<img src="'+imgUrl+'" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #ddd;margin-right:6px;vertical-align:middle">' : '';
    return '<tr><td>'+label+'<br><small style="color:#666">'+sz.mm+'mm</small></td>' +
      '<td>'+imgHtml+(sel.tile_name||'—')+'<br><small style="color:#666">'+(sel.brand||'')+'</small></td>' +
      '<td style="text-align:center">'+roomSqft.toFixed(1)+'</td>' +
      '<td style="text-align:center">'+boxes+'</td>' +
      '<td style="text-align:right">'+priceStr+'</td>' +
      '<td style="text-align:right;font-weight:700">'+(lineTotal>0?'₹'+lineTotal.toLocaleString('en-IN'):'—')+'</td></tr>';
  }).filter(Boolean).join('');

  // Totals
  const totalSqft = _tqTotalSqft ? _tqTotalSqft() : 0;
  const tileTotal = slots.reduce((sum,slot) => {
    const qp = (st.quotedPrices||{})[slot.id] || {};
    const sel = (st.tileSelections||{})[slot.id] || {};
    const sz = sel.size;
    if (!sz) return sum;
    const [mmL,mmW] = sz.mm.split('×').map(Number);
    const tilesPerBox = sz.tilesPerBox || (mmL>=600&&mmW>=1200?2:mmL>=600?4:6);
    const spb = tileSqftPerTile(mmL,mmW)*tilesPerBox;
    const boxes = spb>0 ? Math.ceil((slot.sqft||0)/spb) : 0;
    if (qp.pricePerBox>0) return sum+qp.pricePerBox*boxes;
    if (qp.pricePerSqft>0) return sum+Math.round(qp.pricePerSqft*(slot.sqft||0));
    return sum;
  }, 0);

  const extraProducts = st.extraProducts||[];
  const extraTotal = extraProducts.reduce((s,p)=>s+((p.price||0)*(p.qty||1)),0);
  const del = st.delivery||{};
  const deliveryTotal = (del.transportCost||0)+(del.loadingCost||0)+(del.floorCost||0);
  const grandTotal = tileTotal+extraTotal+deliveryTotal;

  // Accessory summary
  const accLines = [];
  const gs = st.groutSelections||{};
  let hasGrout = Object.values(gs).some(g=>g?.type&&g.type!=='none');
  if (hasGrout) accLines.push('Grout/Epoxy: as per approved quantities');
  if (Object.values(st.spacerSelections||{}).some(s=>s?.use)) accLines.push('Tile Spacers: as per approved quantities');
  if (Object.values(st.adhesiveSelections||{}).some(a=>a?.method&&a.method!=='none')) accLines.push('Tile Adhesive: as per approved quantities');

  const quoteNo = st.tqNo || st._savedQuoteId || ('TQ/'+getFinancialYearLabel()+'/'+new Date().getFullYear());
  const printDate = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  const contractor = st.contractor;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Tile Quotation ${quoteNo}</title>
<style>
  @page { size: A4; margin: 12mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #C8972B; padding-bottom: 10px; margin-bottom: 14px; }
  .logo-name { font-size: 20px; font-weight: 900; color: #C8972B; letter-spacing: -0.5px; }
  .logo-sub { font-size: 10px; color: #666; margin-top: 2px; }
  .quote-badge { font-size: 15px; font-weight: 800; color: #C8972B; text-align: right; }
  .quote-meta { font-size: 10px; color: #666; text-align: right; margin-top: 3px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .info-box { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px; }
  .info-label { font-size: 9px; font-weight: 700; color: #999; text-transform: uppercase; margin-bottom: 3px; }
  .info-val { font-size: 12px; font-weight: 600; }
  h3 { font-size: 12px; font-weight: 800; margin: 12px 0 6px; color: #333; background: #f5c842; padding: 4px 8px; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
  th { background: #2d2d2d; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  td { padding: 7px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafafa; }
  .total-row td { font-weight: 800; background: #fef9e7 !important; border-top: 2px solid #C8972B; }
  .grand-total { background: #C8972B; color: #fff; padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin: 10px 0; }
  .grand-total-label { font-size: 13px; font-weight: 700; }
  .grand-total-val { font-size: 20px; font-weight: 900; }
  .tc-box { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-top: 10px; }
  .tc-box ol { padding-left: 14px; margin: 4px 0 0; }
  .tc-box li { font-size: 9px; color: #555; margin-bottom: 2px; line-height: 1.4; }
  .sig-box { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
  .sig-line { width: 160px; border-top: 1px solid #333; padding-top: 4px; font-size: 9px; color: #666; text-align: center; }
  .footer { margin-top: 12px; text-align: center; font-size: 9px; color: #aaa; }
  .stamp-area { border: 1px dashed #ccc; width: 80px; height: 60px; text-align: center; font-size: 9px; color: #bbb; padding-top: 22px; }
  @media print { button { display: none !important; } .no-print { display: none !important; } }
</style>
</head>
<body>

<button onclick="window.print()" class="no-print"
  style="position:fixed;top:12px;right:12px;background:#C8972B;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;z-index:999">
  🖨 Print / Save PDF
</button>

<!-- HEADER -->
<div class="header">
  <div>
    <div class="logo-name">V Wholesale</div>
    <div class="logo-sub">Vassure Wholesale Pvt. Ltd.</div>
    <div class="logo-sub">NH-65 Bhavanipuram, Vijayawada · 8712697930</div>
    <div class="logo-sub">vassurewholesale.com · GST: 37AAFCV7043G1ZX</div>
  </div>
  <div>
    <div class="quote-badge">TILE QUOTATION</div>
    <div class="quote-meta">No: <strong>${quoteNo}</strong></div>
    <div class="quote-meta">Date: ${printDate}</div>
    <div class="quote-meta">Valid: 7 days from date</div>
  </div>
</div>

<!-- CUSTOMER & PROJECT -->
<div class="info-grid">
  <div class="info-box">
    <div class="info-label">Customer</div>
    <div class="info-val">${st.customer?.name||'—'}</div>
    <div style="font-size:11px;color:#666;margin-top:2px">📞 ${st.customer?.phone||'—'}</div>
    <div style="font-size:11px;color:#666">📍 ${st.customer?.site||'—'}</div>
  </div>
  <div class="info-box">
    <div class="info-label">Project Details</div>
    <div class="info-val">Total Area: ${totalSqft.toFixed(1)} sqft</div>
    ${contractor?'<div style="font-size:11px;color:#666;margin-top:2px">Contractor: '+contractor.name+'</div>':''}
    <div style="font-size:11px;color:#666;margin-top:2px">Delivery: ${del.type==='delivery'?'Delivery to site':'Self Pickup'}</div>
  </div>
</div>

<!-- TILE BOM -->
<h3>📋 Tile Bill of Materials</h3>
<table>
  <thead>
    <tr>
      <th>Room / Area</th>
      <th>Tile</th>
      <th style="text-align:center">Sqft</th>
      <th style="text-align:center">Boxes</th>
      <th style="text-align:right">Rate</th>
      <th style="text-align:right">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${slotRows || '<tr><td colspan="6" style="text-align:center;color:#999">Price to be set during approval</td></tr>'}
    ${tileTotal>0?'<tr class="total-row"><td colspan="4"><strong>Tiles Subtotal</strong></td><td></td><td style="text-align:right">₹'+tileTotal.toLocaleString('en-IN')+'</td></tr>':''}
  </tbody>
</table>

<!-- EXTRAS -->
${extraProducts.length?`
<h3>🛒 Additional Products</h3>
<table>
  <thead><tr><th>Product</th><th>Brand</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    ${extraProducts.map(p=>'<tr><td>'+p.name+'</td><td style="color:#666">'+( p.brand||'—')+'</td><td style="text-align:center">'+(p.qty||1)+' '+(p.unit||'pc')+'</td><td style="text-align:right">₹'+(p.price||0).toLocaleString('en-IN')+'</td><td style="text-align:right;font-weight:700">₹'+((p.price||0)*(p.qty||1)).toLocaleString('en-IN')+'</td></tr>').join('')}
    <tr class="total-row"><td colspan="4"><strong>Products Subtotal</strong></td><td style="text-align:right">₹${extraTotal.toLocaleString('en-IN')}</td></tr>
  </tbody>
</table>`:''}

<!-- ACCESSORIES -->
${accLines.length?`
<h3>🧰 Installation Materials</h3>
<table>
  <tbody>
    ${accLines.map(l=>'<tr><td>'+l+'</td></tr>').join('')}
    <tr><td style="font-size:10px;color:#888">Prices confirmed by cashier at billing. Quantities as per approved BOM.</td></tr>
  </tbody>
</table>`:''}

<!-- DELIVERY -->
${deliveryTotal>0?`
<h3>🚛 Delivery Charges</h3>
<table>
  <tbody>
    ${del.transportCost>0?'<tr><td>Transport</td><td style="text-align:right">₹'+del.transportCost.toLocaleString('en-IN')+'</td></tr>':''}
    ${del.loadingCost>0?'<tr><td>Loading + Unloading</td><td style="text-align:right">₹'+del.loadingCost.toLocaleString('en-IN')+'</td></tr>':''}
    ${del.floorCost>0?'<tr><td>Floor Delivery</td><td style="text-align:right">₹'+del.floorCost.toLocaleString('en-IN')+'</td></tr>':''}
    <tr class="total-row"><td><strong>Delivery Subtotal</strong></td><td style="text-align:right">₹${deliveryTotal.toLocaleString('en-IN')}</td></tr>
  </tbody>
</table>`:''}

<!-- GRAND TOTAL -->
${grandTotal>0?`
<div class="grand-total">
  <div>
    <div class="grand-total-label">GRAND TOTAL</div>
    <div style="font-size:10px;opacity:0.85">GST inclusive · All charges</div>
  </div>
  <div class="grand-total-val">₹${grandTotal.toLocaleString('en-IN')}</div>
</div>`:'<div style="background:#f5c842;padding:10px;border-radius:8px;font-size:12px;font-weight:700;text-align:center;margin:10px 0">Price to be confirmed after management approval</div>'}

<!-- TERMS -->
<div class="tc-box">
  <div style="font-size:10px;font-weight:700;margin-bottom:4px">Terms & Conditions</div>
  <ol>
    <li>All prices are GST inclusive. GST breakup provided at invoice.</li>
    <li>Returns accepted within 30 days from dispatch. Original invoice mandatory.</li>
    <li>Measurements in this quotation are indicative only. Customer must verify with tile layer before purchase.</li>
    <li>Tile colours may vary slightly between manufacturing batches. Purchase full requirement in one order.</li>
    <li>Prices valid for 7 days from quotation date. Payment: 50% advance on order, balance before dispatch.</li>
    <li>This quotation covers material supply only. Tile laying and workmanship are the customer's responsibility.</li>
    <li>All disputes are subject to Vijayawada jurisdiction only.</li>
  </ol>
</div>

<!-- SIGNATURES -->
<div class="sig-box">
  <div>
    <div class="sig-line">Customer Signature &amp; Date</div>
  </div>
  <div>
    <div class="stamp-area">Store Seal</div>
  </div>
  <div>
    <div class="sig-line">Authorised Signatory</div>
  </div>
</div>

<div class="footer">V Wholesale · Vassure Wholesale Pvt. Ltd. · Vijayawada · This is a computer-generated quotation</div>

</body>
</html>`;
}

async function _tqBuildApprovalBOM(q, approverLevel) {
  const slots = Object.entries(q.tile_selections||{});
  if (!slots.length) return '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">No tile details — enter price below.</div>';

  // Which tiers can this approver offer?
  const tierRights = {
    tl:            ['tier1'],
    sr_executive:  ['tier1'],
    floor_manager: ['tier1','tier2'],
    store_manager: ['tier1','tier2','tier3'],
    management:    ['tier1','tier2','tier3','tier4'],
    admin:         ['tier1','tier2','tier3','tier4'],
  };
  const myTiers = tierRights[approverLevel] || [];
  const canManualOverride = ['management','admin'].includes(approverLevel);

  // Pre-compute sqft per slot from rooms area data
  const slotSqft = {};
  (q.rooms||[]).forEach(function(r) {
    (r.areas||[]).forEach(function(a) {
      var sid = a.slotId || (r.id + '_' + (a.subType||'floor'));
      slotSqft[sid] = (slotSqft[sid]||0) + (a.sqft||0);
    });
    if (!slotSqft[r.id]) slotSqft[r.id] = (r.areas||[]).reduce(function(s,a){return s+(a.sqft||0);},0);
  });

  // Merge same tile_name + size.mm across all slots into one row
  const groups = {};
  const productIds = [];
  slots.forEach(function(entry) {
    var slotId = entry[0], sel = entry[1];
    if (!sel || !sel.size || !sel.size.mm || !sel.tile_name) return;
    var key = sel.tile_name + '|' + sel.size.mm;
    var mmParts = sel.size.mm.split('\u00d7').map(Number);
    var mmH = mmParts[0], mmW = mmParts[1];
    var tilesPerBox = sel.size.tilesPerBox || (mmH>=600&&mmW>=1200?2:mmH>=600?4:6);
    var spb = tileSqftPerTile(mmH, mmW) * tilesPerBox;
    var qp  = ((q.quoted_prices||{})[slotId]) || {};
    var boxP  = qp.pricePerBox>0  ? qp.pricePerBox  : qp.pricePerSqft>0 ? Math.round(qp.pricePerSqft*spb) : 0;
    var sqftP = qp.pricePerSqft>0 ? qp.pricePerSqft : (boxP>0&&spb>0) ? parseFloat((boxP/spb).toFixed(1)) : 0;
    var areaSqft = slotSqft[slotId] || slotSqft[slotId.replace(/_floor$|_wall$/,'')] || sel._sqft || 0;
    var boxes = sel._qqBoxes > 0 ? sel._qqBoxes : (spb > 0 && areaSqft > 0 ? Math.ceil(areaSqft / spb) : 0);
    if (!groups[key]) {
      groups[key] = { tile_name:sel.tile_name, brand:sel.brand||'', size_mm:sel.size.mm, spb:spb, totalBoxes:0, totalSqft:0, slotIds:[], initBox:boxP, initSqft:sqftP, productId: sel.product_id||sel.productId||null };
      if (sel.product_id||sel.productId) productIds.push(sel.product_id||sel.productId);
    }
    groups[key].totalBoxes += boxes;
    groups[key].totalSqft  += areaSqft;
    groups[key].slotIds.push(slotId);
    if (boxP > groups[key].initBox) { groups[key].initBox = boxP; groups[key].initSqft = sqftP; }
  });

  // Fetch tier prices for all tile products (if any have product IDs)
  const tierPrices = {};
  if (productIds.length && myTiers.length) {
    try {
      const { data: prods } = await VW_DB.client
        .from('products')
        .select('id,mrp,price,vwp,tier1_price,tier2_price,tier3_price,tier4_price')
        .in('id', productIds);
      (prods||[]).forEach(p => { tierPrices[p.id] = p; });
    } catch(_) {}
  }

  const TIER_LABELS = { tier1:'Tier 1', tier2:'Tier 2', tier3:'Tier 3', tier4:'Tier 4' };

  return Object.values(groups).map(function(g, idx) {
    const tp = g.productId ? tierPrices[g.productId] : null;
    const mrp = tp?.mrp || 0;
    const vwp = tp?.vwp || tp?.price || 0;

    // Build tier buttons
    const tierButtons = myTiers.length && tp ? myTiers.map(function(tier) {
      const tierPrice = tp[tier+'_price'];
      if (!tierPrice) return '';
      const sqftPrice = g.spb > 0 ? (tierPrice/g.spb).toFixed(1) : '';
      const discVsMrp = mrp > 0 ? Math.round((mrp-tierPrice)/mrp*100) : 0;
      const discVsVwp = vwp > 0 ? Math.round((vwp-tierPrice)/vwp*100) : 0;
      return '<button onclick="(function(){' +
        'var b=document.getElementById(\'tq-box-'+idx+'\');' +
        'var s=document.getElementById(\'tq-sqft-'+idx+'\');' +
        'if(b)b.value='+tierPrice+';if(s)s.value=\''+sqftPrice+'\';' +
        'this.parentElement.querySelectorAll(\'.tier-btn\').forEach(function(x){x.style.borderColor=\'var(--border)\';x.style.background=\'var(--bg3)\';});' +
        'this.style.borderColor=\'var(--gold)\';this.style.background=\'var(--gold-muted)\';' +
        '}).call(this)" class="tier-btn"' +
        ' style="flex:1;padding:7px 4px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);cursor:pointer;text-align:center">' +
        '<div style="font-size:10px;font-weight:700;color:var(--gold)">' + TIER_LABELS[tier] + '</div>' +
        '<div style="font-size:12px;font-weight:800">₹'+Number(tierPrice).toLocaleString('en-IN')+'</div>' +
        '<div style="font-size:9px;color:var(--text3)">' + (discVsMrp>0?discVsMrp+'% off MRP':'') + (discVsVwp>0?' · '+discVsVwp+'% off VWP':'') + '</div>' +
        '</button>';
    }).filter(Boolean).join('') : '';

    const vwpBtn = (tp && vwp > 0) ? '<button onclick="(function(){' +
      'var b=document.getElementById(\'tq-box-'+idx+'\');var s=document.getElementById(\'tq-sqft-'+idx+'\');' +
      'var spb='+g.spb.toFixed(4)+';if(b)b.value='+Math.round(vwp*g.spb)+';if(s)s.value=\''+vwp.toFixed(1)+'\';' +
      'this.parentElement.querySelectorAll(\'.tier-btn\').forEach(function(x){x.style.borderColor=\'var(--border)\';x.style.background=\'var(--bg3)\';});' +
      'this.style.borderColor=\'var(--gold)\';this.style.background=\'var(--gold-muted)\';' +
      '}).call(this)" class="tier-btn"' +
      ' style="flex:1;padding:7px 4px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);cursor:pointer;text-align:center">' +
      '<div style="font-size:10px;font-weight:700;color:var(--text2)">VWP</div>' +
      '<div style="font-size:12px;font-weight:800">₹'+Number(vwp).toLocaleString('en-IN')+'</div>' +
      '<div style="font-size:9px;color:var(--text3)">' + (mrp>0?Math.round((mrp-vwp)/mrp*100)+'% off MRP':'Standard') + '</div>' +
      '</button>' : '';

    const mrpLine = mrp > 0 ? '<div style="font-size:10px;color:var(--text3);margin-bottom:6px">MRP: ₹'+Number(mrp).toLocaleString('en-IN')+'/sqft' + (vwp>0?' · VWP: ₹'+Number(vwp).toLocaleString('en-IN')+'/sqft':'') + '</div>' : '';

    return '<div style="background:var(--bg3);border-radius:9px;padding:9px 11px;margin-bottom:8px;border-left:3px solid var(--gold)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">' +
        '<div><div style="font-size:13px;font-weight:700">' + g.tile_name + '</div>' +
        '<div style="font-size:11px;color:var(--text3)">' + g.brand + ' \u00b7 ' + g.size_mm + (g.totalSqft>0?' \u00b7 '+g.totalSqft.toFixed(1)+' sqft':'') + '</div></div>' +
        (g.totalBoxes>0 ? '<div style="font-size:16px;font-weight:900;color:var(--gold)">' + g.totalBoxes + ' boxes</div>' : '<div style="font-size:11px;color:var(--text3)">boxes TBD</div>') +
      '</div>' +
      mrpLine +
      (g.initBox===0 ? '<div style="font-size:11px;color:var(--text3);background:rgba(245,200,66,0.06);border:1px dashed var(--gold-border);border-radius:6px;padding:5px 8px;margin-bottom:8px">💡 Set price below — tap a tier or enter manually</div>' : '') +
      // Tier quick-select buttons
      ((vwpBtn || tierButtons) ? '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">' + vwpBtn + tierButtons + '</div>' : '') +
      // Manual price inputs
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">\u20b9 / BOX</label>' +
        '<input type="number" id="tq-box-' + idx + '" value="' + (g.initBox||'') + '" step="10" min="0" placeholder="Enter \u20b9/box"' +
          ' data-spb="' + g.spb.toFixed(4) + '" data-idx="' + idx + '" data-slots="' + g.slotIds.join(',') + '"' +
          ' style="width:100%;padding:8px;border:1.5px solid var(--gold-border);border-radius:7px;background:var(--bg2);color:var(--gold);font-size:15px;font-weight:800;text-align:center;box-sizing:border-box"' +
          ' oninput="(function(el){var s=parseFloat(el.dataset.spb)||1,i=el.dataset.idx,sf=document.getElementById(\'tq-sqft-\'+i);if(sf)sf.value=s>0?((parseFloat(el.value)||0)/s).toFixed(1):\'\';})(this)"></div>' +
        '<div><label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">\u20b9 / SQFT</label>' +
        '<input type="number" id="tq-sqft-' + idx + '" value="' + (g.initSqft||'') + '" step="0.5" min="0"' +
          ' data-spb="' + g.spb.toFixed(4) + '" data-idx="' + idx + '"' +
          ' style="width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;background:var(--bg2);color:var(--text);font-size:14px;text-align:center;box-sizing:border-box"' +
          ' oninput="(function(el){var s=parseFloat(el.dataset.spb)||1,i=el.dataset.idx,bx=document.getElementById(\'tq-box-\'+i);if(bx)bx.value=Math.round((parseFloat(el.value)||0)*s)||\'\';})(this)"></div>' +
      '</div>' +
      (canManualOverride ? '<div style="font-size:10px;color:var(--text3);margin-top:4px">✏️ Management: can enter any price above</div>' : '') +
    '</div>';
  }).join('') + _buildAccessoryPriceInputs(q);
}

function _buildAccessoryPriceInputs(q) {
  const st = q._decoded || {};
  const gs = q.grout_selections || st.groutSelections || {};
  const as = q.adhesive_selections || st.adhesiveSelections || {};
  const ss = q.spacer_selections || st.spacerSelections || {};

  const hasSpacers  = Object.values(ss).some(s => s?.use);
  const hasAdhesive = Object.values(as).some(s => s?.method && s.method !== 'none' && s.method !== 'mortar' && (s.adhBags||0) > 0);
  const hasGrout    = Object.values(gs).some(g => g?.type && g.type !== 'none');
  const hasMortar   = Object.values(as).some(s => s?.method === 'mortar');

  if (!hasSpacers && !hasAdhesive && !hasGrout && !hasMortar) return '';

  const saved = q.accessory_prices || {};

  const accInput = (id, label, unit, initVal) =>
    `<div style="margin-bottom:8px">` +
    `<label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">${label} (₹/${unit})</label>` +
    `<input type="number" id="tq-acc-${id}" value="${initVal||''}" step="1" min="0" placeholder="Enter price"` +
    ` style="width:100%;padding:8px;border:1px solid var(--gold-border);border-radius:7px;background:var(--bg2);color:var(--gold);font-size:14px;text-align:center;box-sizing:border-box">` +
    `</div>`;

  return `<div style="background:var(--bg3);border-radius:9px;padding:9px 11px;margin-bottom:8px;border-left:3px solid #6B7280">` +
    `<div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">🧰 Installation Material Prices</div>` +
    (hasSpacers  ? accInput('spacer',  '📦 Spacers',       'pkt', saved.spacerPerPkt) : '') +
    (hasAdhesive ? accInput('adhesive','🧲 Tile Adhesive', 'bag', saved.adhPerBag)    : '') +
    (hasMortar   ? accInput('cement',  '🏗 Cement',        'bag', saved.cementPerBag) : '') +
    (hasGrout    ? accInput('grout',   '🪨 Grout',         'kg',  saved.groutPerKg)   : '') +
    `<div style="font-size:10px;color:var(--text3);margin-top:4px">These are added to the final total shown to customer.</div>` +
    `</div>`;
}

async function _tqCheckMaterialStock(searchTerms, qtyNeeded) {
  try {
    const { data: products } = await VW_DB.client.from('products').select('id,name,stock,unit,price,category')
      .or(searchTerms.map(t=>`name.ilike.%${t}%`).join(','))
      .eq('is_active', true).limit(5);
    if (!products?.length) return { status:'to_order', stockQty:0, product:null };
    const p = products[0];
    const stock = parseFloat(p.stock)||0;
    if (stock <= 0) return { status:'out_of_stock', stockQty:0, product:p };
    if (stock < qtyNeeded) return { status:'low_stock', stockQty:stock, product:p };
    return { status:'in_stock', stockQty:stock, product:p };
  } catch(e) { return { status:'to_order', stockQty:0, product:null }; }
}

async function _tqCreateMaterialIntents(quoteId, q) {
  try {
    const items = _tqGetMaterialsList(q);
    if (!items.length) return 0;
    // Delete any existing intents for this quote (re-run on re-collect)
    await VW_DB.client.from('tq_material_intents').delete().eq('tq_id', quoteId);
    const profile = VW_AUTH.getCurrentProfile();
    const intents = [];
    for (const item of items) {
      const { status, stockQty, product } = await _tqCheckMaterialStock(item.search.filter(Boolean), item.qty);
      intents.push({
        tq_id: quoteId, tq_no: q.tq_no, customer_name: q.customer_name,
        item_name: item.name, item_type: item.type,
        qty_needed: item.qty, unit: item.unit,
        qty_in_stock: stockQty, stock_status: status,
        product_id: product?.id || item.productId || null,
        status: status === 'in_stock' ? 'in_stock' : 'pending',
        created_by: profile?.name || '',
      });
    }
    if (intents.length) await VW_DB.client.from('tq_material_intents').insert(intents);
    return intents.filter(i=>i.status==='pending').length;
  } catch(e) { console.warn('Material intents error:', e); return 0; }
}

function _tqGetMaterialsList(q) {
  const items = [];
  const state = q._decoded || {};
  // Spacers
  const spacerRes = state.spacerResult;
  if (spacerRes?.totalPackets > 0) {
    const typeLabel = (state.spacerType||'plus')==='clip' ? 'Clip+Plug Spacer' : 'Cross Spacer';
    const mmLabel = Object.values(state.spacerSelections||{})[0]?.mm || 3;
    items.push({ name:`${mmLabel}mm ${typeLabel}`, type:'spacer', qty:spacerRes.totalPackets, unit:'pkt',
      search:[`${mmLabel}mm`,`spacer`] });
  }
  // Adhesive
  Object.entries(state.adhesiveSelections||{}).forEach(([slotId, a]) => {
    if (a?.type && a.type !== 'cement') {
      const bags = a.bags || a.qty || 0;
      if (bags > 0) items.push({ name:a.name||a.type||'Tile Adhesive', type:'adhesive', qty:bags, unit:'bag',
        search:['adhesive','tile adhesive',a.name||''] });
    }
  });
  // Grout
  Object.entries(state.groutSelections||{}).forEach(([slotId, g]) => {
    if (g?.qty > 0) items.push({ name:g.name||g.color||'Tile Grout', type:'grout', qty:g.qty, unit:'kg',
      search:['grout',g.name||g.color||''] });
  });
  // Beading
  (state.beading||[]).forEach(b => {
    if (b.qty > 0) items.push({ name:b.type||'Beading', type:'beading', qty:b.qty, unit:'rft',
      search:['beading',b.type||''] });
  });
  // Extra products from inventory search
  (state.extraProducts||[]).forEach(ep => {
    if (ep.qty > 0) items.push({ name:ep.name||'Item', type:'extra', qty:ep.qty, unit:ep.unit||'pc',
      search:[ep.name||''], productId:ep.id });
  });
  return items;
}

async function _tqRenderMaterialsCard(st) {
  const items = _tqGetMaterialsList(st);
  if (!items.length) return '';
  const statusIcon = { in_stock:'✅', low_stock:'⚠️', out_of_stock:'❌', to_order:'📋' };
  const statusLabel = { in_stock:'In Stock', low_stock:'Low Stock', out_of_stock:'Out of Stock', to_order:'To Order' };
  const statusColor = { in_stock:'var(--green)', low_stock:'var(--gold)', out_of_stock:'var(--red)', to_order:'#378ADD' };

  const rows = await Promise.all(items.map(async item => {
    const { status, stockQty, product } = await _tqCheckMaterialStock(item.search.filter(Boolean), item.qty);
    return { ...item, status, stockQty, product };
  }));

  const needsOrdering = rows.filter(r=>r.status!=='in_stock');
  const allGood = needsOrdering.length === 0;

  return `<div class="card" style="margin-bottom:10px;border-color:${allGood?'rgba(34,197,94,0.3)':'rgba(96,165,250,0.3)'}">
    <h3 class="card-title">📦 Materials Status</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:10px">${allGood ? 'All materials in stock ✅' : `${needsOrdering.length} item${needsOrdering.length>1?'s':''} need sourcing — inventory will be notified when advance is collected`}</p>
    ${rows.map(r=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border2)">
      <div>
        <div style="font-size:12px;font-weight:600">${r.name}</div>
        <div style="font-size:10px;color:var(--text3)">${r.qty} ${r.unit} needed${r.product?' · '+r.product.name:''}</div>
      </div>
      <div style="text-align:right">
        <span style="font-size:11px;font-weight:700;color:${statusColor[r.status]}">${statusIcon[r.status]} ${statusLabel[r.status]}</span>
        ${r.stockQty>0?`<div style="font-size:10px;color:var(--text3)">${r.stockQty} in stock</div>`:''}
      </div>
    </div>`).join('')}
    ${!allGood?`<div style="font-size:10px;color:#378ADD;margin-top:8px;padding:6px;background:rgba(55,138,221,0.08);border-radius:6px">📋 Collecting advance will automatically flag ${needsOrdering.length} item${needsOrdering.length>1?'s':''} for sourcing in the inventory dashboard.</div>`:''}
  </div>`;
}

async function qqConvertExisting(id) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id', id).single();
  if (!q) { showToast('Estimate not found', 'warn'); return; }
  window._qqData = {
    _qqId: id,
    _tqNo: q.tq_no,
    customer: { name: q.customer_name||'', phone: q.customer_phone||'', site: q.site_address||'', id: q.customer_id||null },
    rooms: q.rooms || [],
    adding: null, designing: null, editingIdx: null,
  };

  // Clear stale price keys then restore from saved quoted_prices
  // Uses same precise matching as qqEditExisting to get correct window key format
  Object.keys(window).filter(k => k.startsWith('qqprice_')).forEach(k => { try { delete window[k]; } catch(e){} });
  (q.rooms || []).forEach((room, ri) => {
    ['wall', 'floor'].forEach(surface => {
      const design = surface === 'wall' ? room.wallDesign : room.floorDesign;
      if (!design?.pattern?.length) return;
      const type = surface === 'wall' ? 'wl' : 'fl';
      [...new Set(design.pattern)].forEach(code => {
        const codeLower = code.toLowerCase().replace(/[^a-z0-9]/g, '');
        const slotEntry = Object.entries(q.tile_selections || {}).find(([sid]) =>
          sid.startsWith('qq' + ri + '_') && sid.endsWith('_' + surface + '_' + codeLower)
        );
        if (!slotEntry) return;
        const qp = (q.quoted_prices || {})[slotEntry[0]];
        if (qp?.pricePerBox > 0) {
          window['qqprice_' + type + '_' + ri + '_' + code] = qp.pricePerBox;
          if (qp.pricePerSqft > 0) window['qqprice_' + type + '_sqft_' + ri + '_' + code] = qp.pricePerSqft;
        }
      });
    });
  });

  await _qqConvertToFullTQ();
}

async function qqDeleteEstimate(id) {
  if (!confirm('Delete this estimate? This cannot be undone.')) return;
  const { error } = await VW_DB.client.from('tile_quotations').delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  showToast('Estimate deleted', 'success');
  const container = document.getElementById('app-content');
  if (container) container.innerHTML = await renderTileQuotesList();
}

async function qqEditExisting(id) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id', id).single();
  if (!q) { showToast('Estimate not found', 'warn'); return; }

  // Restore _qqData from saved record
  window._qqData = {
    _qqId: id,
    _tqNo: q.tq_no,
    customer: { name: q.customer_name||'', phone: q.customer_phone||'', site: q.site_address||'', id: q.customer_id||null },
    rooms: q.rooms || [],
    adding: null, designing: null, editingIdx: null,
  };

  // Clear any stale price keys from previous session
  Object.keys(window).filter(k => k.startsWith('qqprice_')).forEach(k => { try { delete window[k]; } catch(e){} });

  // Restore saved prices from quoted_prices back into window price keys
  // Slot format: qq{ri}_{timestamp}_{surface}_{codeLowered}
  // Window key:  qqprice_{wl|fl}_{ri}_{ORIGINAL_CODE}
  (q.rooms || []).forEach((room, ri) => {
    ['wall', 'floor'].forEach(surface => {
      const design = surface === 'wall' ? room.wallDesign : room.floorDesign;
      if (!design || !design.pattern || !design.pattern.length) return;
      const type = surface === 'wall' ? 'wl' : 'fl';
      [...new Set(design.pattern)].forEach(code => {
        const codeLower = code.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Precise match: starts with qq{ri}_ AND ends with _{surface}_{codeLower}
        // Works for both stable IDs (qq0_wall_d) and old timestamp IDs (qq0_1782..._wall_d)
        const slotEntry = Object.entries(q.tile_selections || {}).find(([sid]) =>
          sid.startsWith('qq' + ri + '_') && sid.endsWith('_' + surface + '_' + codeLower)
        );
        if (!slotEntry) return;
        const qp = (q.quoted_prices || {})[slotEntry[0]];
        if (qp && qp.pricePerBox > 0) {
          window['qqprice_' + type + '_' + ri + '_' + code] = qp.pricePerBox;
          // Also restore sqft price so the ₹/sqft input shows the saved value, not inventory default
          if (qp.pricePerSqft > 0) window['qqprice_' + type + '_sqft_' + ri + '_' + code] = qp.pricePerSqft;
        }
      });
    });
  });

  // Load price history in background
  _qqLoadPriceHistory().catch(() => {});

  // Open QQ output with restored prices
  _qqScreen('output');
}

async function renderTileQuotesList() {
  const profile = VW_AUTH.getCurrentProfile();
  const myRole = profile?.role || '';
  // Who can action pending approvals at their level:
  const isApprover = ['admin','management','store_manager','floor_manager','tl','sr_executive'].includes(myRole);
  const isCashier = ['admin','accounts'].includes(myRole);
  const isExec = ['executive','reception'].includes(myRole);

  // Fetch quotes
  let query = VW_DB.client.from('tile_quotations')
    .select('id,tq_no,customer_name,customer_phone,total_area_sqft,approval_status,status,created_by,created_at,advance_amount,quoted_price_per_sqft,selected_size,advance_receipt_no,rejection_reason,approval_log,source,grand_total')
    .order('created_at', {ascending:false}).limit(60);

  // Executives see only their own quotes
  if (isExec) query = query.eq('created_by', profile?.name||'');

  const { data: quotes } = await query;
  const allRaw = quotes || [];

  // Split Quick Quotes from Full TQ quotes — double-filter for safety
  const qqEstimates = allRaw.filter(q => q.source === 'quick_quote');
  const allQuotes   = allRaw.filter(q => q.source !== 'quick_quote' && q.source !== null || (!q.source && !q.tq_no?.startsWith('QQ/')));

  const LEVEL_LABELS_TQ = { tl:'TL / Sr Executive', floor_manager:'Floor Manager', store_manager:'Store Manager', management:'Management' };

  // Get current chain level label from approval_log
  const currentLevel = (q) => {
    const log = q.approval_log || [];
    const last = log[log.length-1];
    if (!last || q.approval_status !== 'pending_approval') return '';
    return LEVEL_LABELS_TQ[last.level] || last.level;
  };

  // Can I action this quote right now?
  const canIApprove = (q) => {
    if (q.approval_status !== 'pending_approval') return false;
    // Admin and management can always approve any pending TQ
    if (myRole === 'admin' || myRole === 'management') return true;
    const log = q.approval_log || [];
    const last = log[log.length-1];
    if (!last || last.status !== 'pending') return false;
    const allowedRoles = (window.TQ_LEVEL_ROLES || {})[last.level] || [last.level];
    return allowedRoles.includes(myRole);
  };

  const statusBadge = (s, q) => {
    const lvl = currentLevel(q);
    const map = {
      draft: ['Draft','#888'],
      pending_approval: [`⏳ ${lvl||'Pending'}`,canIApprove(q)?'#EF9F27':'#888'],
      approved: ['✅ Approved','#22c55e'],
      rejected: ['❌ Rejected','#ef4444'],
      advance_collected: ['💰 Advance Collected','#378ADD'],
      converted: ['🧾 Invoiced','#7F77DD'],
    };
    const [label, color] = map[s] || [s,'#888'];
    return `<span style="font-size:10px;font-weight:700;color:${color};background:${color}18;padding:2px 8px;border-radius:6px">${label}</span>`;
  };

  const pendingApproval = allQuotes.filter(q => q.approval_status === 'pending_approval');
  const myPending = pendingApproval.filter(canIApprove); // Quotes I can action NOW
  const otherPending = pendingApproval.filter(q => !canIApprove(q)); // Awaiting other levels
  const approved = allQuotes.filter(q => q.approval_status === 'approved' && !q.advance_amount);
  const withAdvance = allQuotes.filter(q => q.advance_amount > 0);
  const rejected = allQuotes.filter(q => q.approval_status === 'rejected');
  const myDrafts = allQuotes.filter(q => q.approval_status === 'draft');

  const renderCard = (q, highlight) => `
  <div onclick="VW_TILES.openTileQuote(${q.id})"
    style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer;
      border:1px solid ${highlight?'var(--gold-border)':q.approval_status==='approved'?'rgba(34,197,94,0.2)':q.approval_status==='rejected'?'rgba(239,68,68,0.2)':'var(--border)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">${q.customer_name||'—'}</div>
        <div style="font-size:11px;color:var(--text3)">${q.tq_no} · ${parseFloat(q.total_area_sqft||0).toFixed(1)} sqft</div>
      </div>
      ${statusBadge(q.approval_status, q)}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:11px;color:var(--text3)">${new Date(q.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · ${q.created_by||'—'}</div>
      <div style="font-size:13px;font-weight:800;color:var(--gold)">
        ${q.grand_total > 0 ? '₹'+parseInt(q.grand_total).toLocaleString('en-IN') :
          q.quoted_price_per_sqft > 0 ? '₹'+q.quoted_price_per_sqft+'/sqft' :
          q.advance_amount > 0 ? '<span style="color:#378ADD">₹'+parseInt(q.advance_amount).toLocaleString('en-IN')+' advance</span>' :
          '<span style="color:var(--text3);font-size:11px">Price TBD</span>'}
      </div>
    </div>
    ${q.rejection_reason ? `<div style="font-size:11px;color:var(--red);margin-top:4px;padding:4px 8px;background:rgba(239,68,68,0.06);border-radius:6px">Rejected: ${q.rejection_reason}</div>` : ''}
  </div>`;

  return `
  <div class="module-header">
    <h2>🏠 Tile Quotations</h2>
    <div style="display:flex;gap:6px">
      <button class="btn-sm" style="background:rgba(245,200,66,0.15);border:1px solid var(--gold-border);color:var(--gold)" onclick="VW_TILES.openQuickQuote()">⚡ Quick</button>
      <button class="btn-sm" style="background:var(--gold);color:#000" onclick="navigateTo('tiles')">+ New</button>
    </div>
  </div>

  <!-- QUICK ESTIMATES — internal rough calculations, not for approval -->
  ${qqEstimates.length ? `
  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">⚡ Quick Estimates (${qqEstimates.length}) — Internal Only</div>
    ${qqEstimates.map(q => `
    <div style="background:var(--bg2);border-radius:10px;padding:10px 12px;margin-bottom:6px;border:1px dashed var(--gold-border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700">${q.customer_name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${q.tq_no||'—'} · ${parseFloat(q.total_area_sqft||0).toFixed(0)} sqft · ${q.total_boxes||0} boxes</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(q.created_at).toLocaleDateString('en-IN')} · By ${q.created_by||'—'}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:8px">
          ${q.grand_total ? `<div style="font-size:14px;font-weight:900;color:var(--gold)">₹${parseInt(q.grand_total).toLocaleString('en-IN')}</div>` : ''}
          <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:rgba(245,200,66,0.12);color:var(--gold);font-weight:700;border:1px solid var(--gold-border)">ESTIMATE</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button onclick="VW_TILES.qqEditExisting(${q.id})"
          style="flex:1;padding:7px;border-radius:7px;background:var(--bg3);border:1px solid var(--border);color:var(--text);font-size:11px;font-weight:700;cursor:pointer">
          ✏️ Edit
        </button>
        <button onclick="VW_TILES.qqConvertExisting(${q.id})"
          style="flex:2;padding:7px;border-radius:7px;background:var(--gold);border:none;color:#000;font-size:11px;font-weight:700;cursor:pointer">
          📋 Convert to Full TQ
        </button>
        <button onclick="VW_TILES.qqDeleteEstimate(${q.id})"
          style="padding:7px 10px;border-radius:7px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);color:var(--red);font-size:11px;cursor:pointer">
          🗑
        </button>
      </div>
    </div>`).join('')}
  </div>` : ''}

  <!-- MY ACTION REQUIRED — quotes at my level right now -->
  ${myPending.length ? `
  <div style="background:rgba(245,200,66,0.08);border:2px solid var(--gold-border);border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:4px">⏳ Needs Your Approval (${myPending.length})</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Auto-escalates to next level in 30 seconds if no action</div>
    ${myPending.map(q => renderCard(q, true)).join('')}
  </div>` : ''}

  <!-- PENDING AT OTHER LEVELS -->
  ${isApprover && otherPending.length ? `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--text3);margin-bottom:8px">⏳ Pending at Other Levels (${otherPending.length})</div>
    ${otherPending.map(q => renderCard(q, false)).join('')}
  </div>` : ''}

  <!-- APPROVED — CASHIER ACTION NEEDED -->
  ${(isCashier || myRole === 'admin') && approved.length ? `
  <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:8px">✅ Approved — Collect Advance (${approved.length})</div>
    ${approved.map(q => renderCard(q, false)).join('')}
  </div>` : ''}

  ${withAdvance.length ? `
  <div class="card" style="margin-bottom:12px">
    <h3 class="card-title">💰 Advance Collected (${withAdvance.length})</h3>
    ${withAdvance.map(q => renderCard(q, false)).join('')}
  </div>` : ''}

  ${myDrafts.length ? `
  <div class="card" style="margin-bottom:12px">
    <h3 class="card-title">📝 My Drafts (${myDrafts.length})</h3>
    ${myDrafts.map(q => renderCard(q, false)).join('')}
  </div>` : ''}

  ${rejected.length ? `
  <div class="card" style="margin-bottom:12px">
    <h3 class="card-title">❌ Rejected — Revise & Resubmit (${rejected.length})</h3>
    ${rejected.map(q => renderCard(q, false)).join('')}
  </div>` : ''}

  <!-- CHAIN INFO for executives -->
  ${isExec && !allQuotes.length ? `
  <div class="card"><p class="empty-msg">No tile quotations yet — tap + New Quote to start</p></div>` : ''}

  ${!allQuotes.length && !isExec ? `
  <div class="card"><p class="empty-msg">No tile quotations in the system yet</p></div>` : ''}

  <div style="margin-top:8px;padding:10px;background:var(--bg2);border-radius:10px;font-size:11px;color:var(--text3)">
    📋 Approval chain: <strong>TL / Sr Executive → Floor Manager → Store Manager → Management</strong> · 30 sec auto-escalation at each level
  </div>`;
}

async function tqApprove() {
  const quoteId = _tqState._reviewingQuoteId;
  if (!quoteId) { showToast('No quotation selected', 'warn'); return; }

  // Read per-tile prices — each input's data-slots may cover multiple slotIds (merged same tile)
  const { data: q } = await VW_DB.client.from('tile_quotations').select('tile_selections,quoted_prices').eq('id',quoteId).single();
  const editedPrices = { ...(q?.quoted_prices||{}) };

  let firstBoxPrice = 0, firstSqftPrice = 0;
  // Iterate visible BOM inputs (one per merged tile group)
  document.querySelectorAll('[id^="tq-box-"]').forEach(el => {
    const idx  = el.dataset.idx;
    const slots = (el.dataset.slots||'').split(',').filter(Boolean);
    const boxVal  = parseFloat(el.value)||0;
    const sqftEl  = document.getElementById('tq-sqft-' + idx);
    const sqftVal = parseFloat(sqftEl?.value||0)||0;
    if ((boxVal > 0 || sqftVal > 0) && slots.length) {
      // Apply the same price to ALL slots in this merged group
      slots.forEach(slotId => {
        editedPrices[slotId] = {};
        if (boxVal  > 0) editedPrices[slotId].pricePerBox  = boxVal;
        if (sqftVal > 0) editedPrices[slotId].pricePerSqft = sqftVal;
      });
      if (!firstBoxPrice  && boxVal)  firstBoxPrice  = boxVal;
      if (!firstSqftPrice && sqftVal) firstSqftPrice = sqftVal;
    }
  });

  // Fallback to old single inputs if no slot inputs found
  const sqft = firstSqftPrice || parseFloat(document.getElementById('tq-quoted-sqft-0')?.value||0)||0;
  const box  = firstBoxPrice  || parseFloat(document.getElementById('tq-quoted-box-0')?.value||0)||0;
  const note = document.getElementById('tq-price-note')?.value||'';

  // Read accessory prices if entered
  const accessoryPrices = {};
  const spacerEl   = document.getElementById('tq-acc-spacer');
  const adhesiveEl = document.getElementById('tq-acc-adhesive');
  const cementEl   = document.getElementById('tq-acc-cement');
  const groutEl    = document.getElementById('tq-acc-grout');
  if (spacerEl?.value)   accessoryPrices.spacerPerPkt  = parseFloat(spacerEl.value)||0;
  if (adhesiveEl?.value) accessoryPrices.adhPerBag     = parseFloat(adhesiveEl.value)||0;
  if (cementEl?.value)   accessoryPrices.cementPerBag  = parseFloat(cementEl.value)||0;
  if (groutEl?.value)    accessoryPrices.groutPerKg    = parseFloat(groutEl.value)||0;

  await VW_ESCALATION.approveTileQuoteStep(quoteId, sqft, box, note, editedPrices, accessoryPrices);
  closeSheet();
  navigateTo('tile_quotes');
}

async function tqCollectAdvance(quoteId) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id',quoteId).single();
  if (!q) return;
  if (q.approval_status !== 'approved') { showToast('Quote must be approved first', 'warn'); return; }

  const totalSqft = parseFloat(q.total_area_sqft||0);
  const pricePerSqft = q.quoted_price_per_sqft || (q.selected_product?.price_per_sqft || 0);
  const suggestedTotal = pricePerSqft > 0 ? Math.round(totalSqft * pricePerSqft) : 0;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>💰 Collect Advance — ${q.tq_no}</h3>
    <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700">${q.customer_name}</div>
      <div style="font-size:12px;color:var(--text3)">${q.site_address||''}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px">${totalSqft.toFixed(1)} sqft · ${q.tq_no}</div>
      ${pricePerSqft > 0 ? `<div style="font-size:14px;font-weight:700;color:var(--gold);margin-top:4px">₹${pricePerSqft}/sqft · Est. Total ₹${suggestedTotal.toLocaleString('en-IN')}</div>` : ''}
      ${q.quoted_price_per_box ? `<div style="font-size:12px;color:var(--text3)">₹${q.quoted_price_per_box}/box</div>` : ''}
      ${q.price_edit_note ? `<div style="font-size:11px;color:var(--gold);margin-top:4px">Note: ${q.price_edit_note}</div>` : ''}
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Advance Amount (₹) *</label>
        <input type="number" id="adv-amount" placeholder="e.g. 10000" min="1" step="500">
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Payment Mode *</label>
        <select id="adv-mode">
          <option value="cash">Cash</option>
          <option value="upi">UPI / GPay</option>
          <option value="card">Card</option>
          <option value="neft">NEFT / Transfer</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Transaction Ref / UPI ID / Cheque No <span style="color:var(--text3);font-size:10px">(optional)</span></label>
      <input type="text" id="adv-ref" placeholder="e.g. UPI Ref: 4281930847">
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Cancel</button>
      <button class="btn-primary" style="flex:2;background:var(--gold);color:#000" onclick="VW_TILES.tqConfirmAdvance(${quoteId})">
        ✅ Collect Advance & Hold Stock
      </button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function tqConfirmAdvance(quoteId) {
  const amount = parseFloat(document.getElementById('adv-amount')?.value||0);
  const mode = document.getElementById('adv-mode')?.value || 'cash';
  const ref = document.getElementById('adv-ref')?.value.trim() || '';
  if (!amount || amount < 1) { showToast('Enter advance amount', 'warn'); return; }

  const profile = VW_AUTH.getCurrentProfile();
  const fy = getFinancialYearLabel();

  // Get receipt number
  const { data: seqRow } = await VW_DB.client.from('settings').select('value').eq('key','advance_receipt_seq').maybeSingle();
  const next = ((seqRow?.value)||0) + 1;
  const receiptNo = `ARN/${fy}/${String(next).padStart(4,'0')}`;
  await VW_DB.client.from('settings').upsert({ key:'advance_receipt_seq', value:next });

  // Update quote
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id',quoteId).single();
  const log = q?.approval_log || [];
  log.push({ action:'advance_collected', by:profile?.name||'', at:new Date().toISOString(), amount, mode, ref, receiptNo });

  await VW_DB.client.from('tile_quotations').update({
    advance_amount: amount,
    advance_mode: mode,
    advance_receipt_no: receiptNo,
    advance_collected_at: new Date().toISOString(),
    advance_collected_by: profile?.name||'',
    advance_collected_by_id: profile?.id||null,
    stock_hold_placed_at: new Date().toISOString(),
    hold_active: true,
    hold_expires_at: new Date(Date.now() + 90*24*60*60*1000).toISOString(),
    advance_received_at: new Date().toISOString(),
    status: 'advance_collected',
    approval_log: log,
  }).eq('id', quoteId);

  // Place hold on stock
  if (q.selected_product?.id) await placeStockHold(quoteId, amount);

  // Create sourcing intents for any materials not in stock — inventory team gets notified
  const _decoded = {
    spacerResult: q.spacer_result || {},
    spacerType: q.spacer?.type || 'plus',
    spacerSelections: q.spacer_selections || {},
    adhesiveSelections: q.adhesive_selections || {},
    groutSelections: q.grout_selections || {},
    beading: q.beading || [],
    extraProducts: q.extra_products || [],
  };
  const toProcure = await _tqCreateMaterialIntents(quoteId, { ...q, _decoded });

  await auditLog('advance_collected','tile_quotation',quoteId,q.customer_name,null,{amount,mode,receiptNo},'Advance collected');

  closeSheet();

  // Print receipt
  tqPrintAdvanceReceipt({ ...q, advance_amount:amount, advance_mode:mode, advance_receipt_no:receiptNo }, ref);
  showToast(`₹${amount.toLocaleString('en-IN')} collected · ${receiptNo} · Stock held${toProcure>0?' · '+toProcure+' items flagged for sourcing':''}`, 'success');
  navigateTo('tile_quotes');
}

async function tqConfirmEditQuote(id) {
  const reason = document.getElementById('tq-edit-reason-main')?.value.trim();
  if (!reason) {
    showToast('Reason is required', 'warn');
    document.getElementById('tq-edit-reason-main')?.focus();
    return;
  }

  const profile = VW_AUTH.getCurrentProfile();
  const byName  = profile?.name || 'Staff';
  const now     = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });

  // Fetch current approval_log
  const { data: q } = await VW_DB.client.from('tile_quotations')
    .select('approval_log,approval_status').eq('id', id).single();
  if (!q) { showToast('Quote not found', 'warn'); return; }

  // Auto-reject any pending steps in the approval log
  const log = (q.approval_log || []).map(step => {
    if (step.status === 'pending') {
      return {
        ...step,
        status: 'auto_rejected',
        autoRejectedAt: now,
        autoRejectedBy: byName,
        autoRejectedById: profile?.id || null,
        autoRejectedReason: `Re-edited by ${byName} on ${dateStr} — Reason: ${reason}`,
      };
    }
    return step;
  });

  // Add an edit record to the log for full audit trail
  log.push({
    level: 'edit',
    status: 'edited',
    editedAt: now,
    editedBy: byName,
    editedById: profile?.id || null,
    reason,
    previousStatus: q.approval_status,
  });

  // Reset quote to draft
  const { error } = await VW_DB.client.from('tile_quotations').update({
    approval_status: 'draft',
    status: 'draft',
    approval_log: log,
    approval_submitted_at: null,
    approval_submitted_by: null,
    approval_submitted_by_id: null,
    draft_step: 8,
    updated_at: now,
  }).eq('id', id);

  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  await auditLog('tq_edit_requested', 'tile_quotation', id, q.approval_status, 'draft', { reason }, `Re-edit by ${byName}`);

  closeSheet();
  showToast('Quote re-opened for editing', 'success');

  // Load into TQ wizard so staff can make changes
  delete _pageCache['tiles']; delete _pageCacheTTL['tiles'];
  tqResumeDraft(id);
}

async function tqConfirmReject(quoteId) {
  const reason = document.getElementById('tq-reject-reason')?.value.trim();
  if (!reason) { showToast('Enter a rejection reason', 'warn'); return; }
  await VW_ESCALATION.rejectTileQuoteStep(quoteId, reason);
  await auditLog('tile_quote_rejected','tile_quotation',quoteId,'','',{reason},'Rejected');
  closeSheet();
  showToast('Rejected — executive will be notified', 'info');
  navigateTo('tile_quotes');
}

async function tqEditQuote(id) {
  if (!id) return;
  const { data: q } = await VW_DB.client.from('tile_quotations')
    .select('tq_no,customer_name,approval_status,advance_amount,approval_log,source')
    .eq('id', id).single();
  if (!q) { showToast('Quote not found', 'warn'); return; }

  // Quick Quote estimates → edit directly in QQ flow, no approval concerns
  if (q.source === 'quick_quote') {
    closeSheet();
    await qqEditExisting(id);
    return;
  }

  // HARD STOP — advance collected = permanently locked
  if (q.advance_amount > 0) {
    showToast('Cannot edit — advance of ₹' + parseInt(q.advance_amount).toLocaleString('en-IN') + ' already collected', 'warn');
    return;
  }

  const isPending = q.approval_status === 'pending_approval';
  const isApproved = q.approval_status === 'approved';
  const sheet = document.getElementById('bottom-sheet');

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:20px">✏️</span>
      <div>
        <div style="font-size:15px;font-weight:800">Edit Quote</div>
        <div style="font-size:11px;color:var(--text3)">${q.tq_no} · ${q.customer_name}</div>
      </div>
    </div>

    ${isPending ? `
    <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px">
      ⚠️ This quote is <strong>pending approval</strong>. Editing will <strong>auto-reject</strong> the current approval step and restart the full chain from TL after you re-submit.
    </div>` : isApproved ? `
    <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px">
      ⚠️ This quote is <strong>approved</strong>. Editing will move it back to draft and require a fresh approval from TL after re-submit.
    </div>` : `
    <div style="background:rgba(245,200,66,0.07);border:1px solid var(--gold-border);border-radius:8px;padding:8px;margin-bottom:12px;font-size:12px;color:var(--text3)">
      Quote will reload into the wizard. Make changes and re-submit for approval.
    </div>`}

    <div class="form-group" style="margin-bottom:12px">
      <label>Reason for editing <span style="color:var(--red)">*</span></label>
      <textarea id="tq-edit-reason-main" rows="3"
        placeholder="e.g. Customer changed tile selection · Measurement correction · Price revision"
        style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg2);color:var(--text);font-size:13px;box-sizing:border-box;resize:none"></textarea>
    </div>

    <div style="display:flex;gap:8px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Cancel</button>
      <button style="flex:2;padding:12px;border-radius:10px;background:var(--gold);border:none;color:#000;font-weight:700;font-size:14px;cursor:pointer"
        onclick="VW_TILES.tqConfirmEditQuote(${id})">
        ✏️ Edit Quote
      </button>
    </div>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  setTimeout(() => document.getElementById('tq-edit-reason-main')?.focus(), 150);
}

function tqPrintAdvanceReceipt(q, txnRef) {
  const win = window.open('', '_blank');
  const now = new Date();
  win.document.write(`<!DOCTYPE html><html><head><title>Advance Receipt ${q.advance_receipt_no}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:420px;margin:20px auto;padding:24px;color:#111;font-size:13px}
    .brand{font-size:18px;font-weight:700;text-align:center;margin-bottom:4px}
    .brand-sub{font-size:11px;color:#666;text-align:center;margin-bottom:16px}
    .receipt-title{text-align:center;font-size:16px;font-weight:700;border:2px solid #111;padding:8px;margin-bottom:14px;letter-spacing:1px}
    .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:12px}
    .row strong{color:#111}
    .amount-box{background:#f9f5e8;border:2px solid #C8972B;border-radius:8px;padding:12px;text-align:center;margin:14px 0}
    .amount{font-size:28px;font-weight:800;color:#C8972B}
    .note{font-size:11px;color:#666;text-align:center;margin-top:16px;line-height:1.5}
    .sign{display:flex;justify-content:space-between;margin-top:36px;font-size:11px}
    .sign div{text-align:center;border-top:1px solid #999;padding-top:4px;width:140px}
    .print-btn{display:block;margin:0 0 16px;padding:10px 24px;background:#C8972B;color:#000;border:none;border-radius:8px;cursor:pointer;font-size:14px;width:100%}
    @media print{.print-btn{display:none}}
    .wa-btn{display:block;margin:0 0 16px;padding:10px 24px;background:#25D366;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;width:100%}
    @media print{.wa-btn{display:none}}
  </style></head><body>
  <button class="print-btn" onclick="window.print()">🖨 Print Receipt</button>
  <button class="wa-btn" onclick="shareReceiptWA()">💬 Share via WhatsApp</button>
  <div class="brand">Vassure Wholesale Pvt Ltd</div>
  <div class="brand-sub">1-1-153, NH-65, Bhavanipuram, Vijayawada · 8712697930</div>
  <div class="receipt-title">ADVANCE RECEIPT</div>

  <div class="row"><span>Receipt No.</span><strong>${q.advance_receipt_no}</strong></div>
  <div class="row"><span>Date</span><strong>${now.toLocaleDateString('en-IN',{dateStyle:'long'})}</strong></div>
  <div class="row"><span>Time</span><strong>${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</strong></div>
  <div class="row"><span>Quote No.</span><strong>${q.tq_no}</strong></div>
  <div class="row"><span>Customer Name</span><strong>${q.customer_name}</strong></div>
  <div class="row"><span>Phone</span><strong>${q.customer_phone||'—'}</strong></div>
  <div class="row"><span>Site Address</span><strong>${q.site_address||'—'}</strong></div>
  <div class="row"><span>Tile / Product</span><strong>${q.selected_product?.name||q.selected_product?.brand||'As per quotation'}</strong></div>
  <div class="row"><span>Total Area</span><strong>${parseFloat(q.total_area_sqft||0).toFixed(1)} sqft</strong></div>
  ${q.quoted_price_per_sqft ? `<div class="row"><span>Agreed Rate</span><strong>₹${q.quoted_price_per_sqft}/sqft</strong></div>` : ''}

  <div class="amount-box">
    <div style="font-size:12px;margin-bottom:4px">Amount Received</div>
    <div class="amount">₹${(q.advance_amount||0).toLocaleString('en-IN')}</div>
    <div style="font-size:12px;margin-top:4px;color:#666">Mode: ${(q.advance_mode||'cash').toUpperCase()}${txnRef?' · Ref: '+txnRef:''}</div>
  </div>

  <div class="row"><span>Stock Hold Valid Until</span><strong>${new Date(Date.now()+90*24*60*60*1000).toLocaleDateString('en-IN')}</strong></div>

  <div class="note">
    This advance confirms your order and holds the selected tile stock for 90 days.<br>
    Balance payment due before dispatch. This receipt is not a tax invoice.<br>
    Returns subject to V Wholesale terms & conditions.
  </div>

  <div class="sign">
    <div>Customer Signature</div>
    <div>For Vassure Wholesale Pvt Ltd<br>Authorised by</div>
  </div>

  </body></html>`);
  win.document.close();
}

async function tqReject() {
  const quoteId = _tqState._reviewingQuoteId;
  if (!quoteId) { showToast('No quotation selected', 'warn'); return; }
  const { data: q } = await VW_DB.client.from('tile_quotations').select('tq_no,customer_name').eq('id',quoteId).single();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 style="color:var(--red)">❌ Reject Tile Quotation</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:12px">${q?.tq_no} · ${q?.customer_name}</p>
    <div class="form-group">
      <label>Reason *</label>
      <textarea id="tq-reject-reason" rows="3" placeholder="e.g. Price too low — minimum ₹65/sqft · Tile not available · Needs re-measurement"
        style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg2);color:var(--text);font-size:13px"></textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Cancel</button>
      <button style="flex:2;padding:12px;border-radius:10px;background:var(--red);border:none;color:#fff;font-weight:700;cursor:pointer"
        onclick="VW_TILES.tqConfirmReject(${quoteId})">❌ Reject & Notify Executive</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function tqConvertToInvoice(id) {
  const { data: q } = await VW_DB.client
    .from('tile_quotations')
    .select('*')
    .eq('id', id)
    .single();

  if (!q) { showToast('Quotation not found', 'error'); return; }
  if (!q.advance_amount) { showToast('Collect advance first before converting to invoice', 'warn'); return; }

  // Build cart items from TQ
  const pricePerSqft = q.quoted_price_per_sqft || 0;
  const totalSqft    = parseFloat(q.total_area_sqft || 0);
  const tileTotal    = Math.round(pricePerSqft * totalSqft);
  const extraProducts= q.extra_products || [];
  const extraTotal   = extraProducts.reduce((s, p) => s + ((p.price || 0) * (p.qty || 1)), 0);
  const deliveryCost = (q.delivery?.transportCost || 0) + (q.delivery?.loadingCost || 0) + (q.delivery?.floorCost || 0);
  const grandTotal   = q.grand_total || (tileTotal + extraTotal + deliveryCost);
  const balanceDue   = grandTotal - (q.advance_amount || 0);

  // Navigate to billing and pre-populate
  closeSheet();
  await navigateTo('billing');

  // Wait for billing to load then populate
  setTimeout(() => {
    // Set customer
    if (typeof setActiveCustomer === 'function' && q.customer_id) {
      setActiveCustomer(q.customer_id);
    }

    // Add tile item to cart
    if (typeof addManualLineItem === 'function') {
      addManualLineItem({
        name: `Tiles — ${q.tq_no} (${totalSqft.toFixed(1)} sqft @ ₹${pricePerSqft}/sqft)`,
        price: tileTotal,
        qty: 1,
        gst: 12,
        hsn: '6907',
        fromTQ: id,
      });

      // Add extra products
      extraProducts.forEach(p => {
        addManualLineItem({
          name: p.name,
          price: p.price || 0,
          qty: p.qty || 1,
          gst: 18,
        });
      });

      // Add delivery if any
      if (deliveryCost > 0) {
        addManualLineItem({
          name: 'Delivery & Transport',
          price: deliveryCost,
          qty: 1,
          gst: 18,
        });
      }
    }

    // Show advance deduction message
    if (balanceDue < grandTotal) {
      showToast(`₹${(q.advance_amount||0).toLocaleString('en-IN')} advance already collected — balance due: ₹${balanceDue.toLocaleString('en-IN')}`, 'info');
    }
  }, 600);
}

async function tqReprintReceipt(id) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id',id).single();
  if (!q) return;
  tqPrintAdvanceReceipt(q, '');
}

async function tqSaveQuote() { return tqSubmitForApproval(); }

async function tqSubmitForApproval() {
  const st = _tqState;
  if (!st.customer.name) { showToast('Enter customer name first', 'warn'); return; }
  if (!st.rooms.length) { showToast('Add at least one room', 'warn'); return; }
  // Disable button to prevent double-submit
  const btn = document.querySelector('[onclick*="tqSubmitForApproval"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Submitting...'; }
  const restoreBtn = () => { if (btn) { btn.disabled = false; btn.innerHTML = '📤 Submit for Approval'; } };
  const profile = VW_AUTH.getCurrentProfile();
  const fy = getFinancialYearLabel();

  try {
    const { data: seqNum, error: seqErr } = await VW_DB.client.rpc('get_next_seq', { p_fy: fy, p_type: 'tq' });
    if (seqErr) throw new Error('Could not get TQ number: ' + seqErr.message);
    const tqNo = `TQ/${fy}/${String(seqNum).padStart(4,'0')}`;

    // Compute totals for insert
    const allRooms = st.rooms || [];
    const weightCfgSub = await VW_DB.getSetting('tile_weight_config', {sizes:[]});
    let totalBoxesSub = 0, totalWeightSub = 0;
    // Slot-based + prefers the Design step's box count (cut-waste/door/breakage applied) so the
    // saved quote matches the Summary and the Design step exactly.
    _getTileSlots().forEach(slot => {
      const sel = st.tileSelections?.[slot.id];
      if (!sel?.size) return;
      const [mmL,mmW] = sel.size.mm.split('×').map(Number);
      const sqftPerTile = tileSqftPerTile(mmL, mmW);
      const cfg = (weightCfgSub.sizes||[]).find(s=>s.mm===sel.size.mm);
      const tpb = cfg?.tiles_per_box || (sqftPerTile<1.5?10:sqftPerTile<2.5?6:sqftPerTile<5?4:2);
      const dsBoxes = _tqState.design?.[slot.id]?.result?.totalBoxes;
      const boxes = (dsBoxes != null && dsBoxes > 0) ? dsBoxes
        : (sqftPerTile>0 ? Math.ceil((slot.sqft||0)/(sqftPerTile*tpb)) : 0);
      totalBoxesSub += boxes;
      totalWeightSub += boxes * (cfg?.weight_per_box || 20);
    });

    // Compute commission — sum per-slot value (not firstSlot price × total boxes)
    const contractorCommission = (() => {
      if (!st.contractor) return null;
      const slots = _getTileSlots();
      let totalValue = 0;
      slots.forEach(s => {
        const sel = st.tileSelections[s.id];
        if (!sel?.size) return;
        const qp = st.quotedPrices[s.id];
        if (!qp) return;
        const [mmL,mmW] = sel.size.mm.split('×').map(Number);
        const spf = tileSqftPerTile(mmL, mmW);
        const cfgC = (weightCfgSub.sizes||[]).find(cs=>cs.mm===sel.size.mm);
        const tpb = cfgC?.tiles_per_box || sel.size.tilesPerBox || 6; // config first, not hardcoded 4
        const spb = spf * tpb;
        const slotBoxes = (sel._qqBoxes > 0) ? sel._qqBoxes : (spb > 0 ? Math.ceil(s.sqft/spb) : 0);
        if (qp.pricePerBox > 0) totalValue += qp.pricePerBox * slotBoxes;
        else if (qp.pricePerSqft > 0) totalValue += qp.pricePerSqft * s.sqft;
      });
      const pct = st.contractor.commissionPct || 2;
      return {
        contractor_name: st.contractor.name,
        contractor_phone: st.contractor.phone,
        contractor_id: st.contractor.id || null,
        commission_pct: pct,
        commission_amount: Math.round(totalValue * pct / 100),
        needs_approval: pct > 2,
        status: 'pending',
      };
    })();

    // Compute grand total for submission
    const _submitTileTotal = (() => {
      let t = 0;
      _getTileSlots().forEach(slot => {
        const qp = st.quotedPrices?.[slot.id];
        if (!qp) return;
        if (qp.pricePerSqft > 0) { t += Math.round(qp.pricePerSqft * slot.sqft); return; }
        if (qp.pricePerBox > 0) {
          const sel = st.tileSelections?.[slot.id];
          if (!sel?.size?.mm) return;
          const [mmL,mmW] = sel.size.mm.split('×').map(Number);
          const sqftPerTile = tileSqftPerTile(mmL, mmW);
          // Use same box count logic as summary tileTotal: prefer design → QQ → weightCfg
          const cfgEntry = (weightCfgSub.sizes||[]).find(s=>s.mm===sel.size.mm);
          const tilesPerBox = cfgEntry?.tiles_per_box || (sqftPerTile<0.5?25:sqftPerTile<1.5?10:sqftPerTile<2.5?6:sqftPerTile<5?4:2);
          const dsBoxes = st.design?.[slot.id]?.result?.totalBoxes;
          const qqBoxes = sel._qqBoxes;
          const boxes = (qqBoxes > 0) ? qqBoxes
            : (dsBoxes != null && dsBoxes > 0) ? dsBoxes
            : (sqftPerTile * tilesPerBox > 0 ? Math.ceil(slot.sqft / (sqftPerTile * tilesPerBox)) : 0);
          t += qp.pricePerBox * boxes;
        }
      });
      return t;
    })();
    const _submitExtraTotal = (st.extraProducts||[]).reduce((s,p)=>s+((p.price||0)*(p.qty||1)),0);
    const _submitDeliveryTotal = (st.delivery?._transportCost||0)+(st.delivery?._loadingCost||0)+(st.delivery?._floorCost||0);
    const _submitGrandTotal = _submitTileTotal + _submitExtraTotal + _submitDeliveryTotal;
    // First slot price per sqft (for approval display)
    const _firstSlot = _getTileSlots()[0];
    const _firstQP = _firstSlot ? (st.quotedPrices?.[_firstSlot.id]) : null;
    const _quotedPricePerSqft = _firstQP?.pricePerSqft || 0;

    const _tqPayload = {
      source: 'full_tq',
      tq_no: tqNo,
      customer_name: st.customer.name,
      customer_phone: st.customer.phone,
      customer_id: st.customer.id || null,
      site_address: st.customer.site,
      contractor_commission: contractorCommission,
      quoted_prices: st.quotedPrices || {},
      quoted_price_per_sqft: _quotedPricePerSqft,
      grand_total: _submitGrandTotal > 0 ? _submitGrandTotal : null,
      wall_designs: st.wallDesigns || {},
      design_tiles: Object.fromEntries(Object.entries(st.design||{}).map(([k,v])=>[k,v?.result?.tiles||[]])),
      rooms: st.rooms || [],
      tile_selections: st.tileSelections || {},
      spacer_selections: st.spacerSelections || {},
      adhesive_selections: st.adhesiveSelections || {},
      grout_selections: st.groutSelections || {},
      selected_size: st.selectedSize || null,
      selected_product: st.selectedProduct || null,
      spacer: st.spacer || {},
      adhesive: st.adhesive || {},
      beading: st.beading || [],
      grout: st.grout || {},
      addons: st.addons || {},
      floor_traps: st.floorTraps || [],
      soffit: st.soffit || {},
      delivery: {
        ...(st.delivery||{}),
        transportCost: st.delivery?._transportCost || 0,
        loadingCost:   st.delivery?._loadingCost   || 0,
        floorCost:     st.delivery?._floorCost      || 0,
      },
      total_area_sqft: _tqTotalSqft(),
      total_boxes: totalBoxesSub,
      total_weight_kg: totalWeightSub,
      labor_required: st.laborRequired || false,
      extra_products: st.extraProducts || [],
      breakage_pct: st.breakagePct ?? 10,
      approval_status: 'pending_approval',
      approval_submitted_at: new Date().toISOString(),
      approval_submitted_by: profile?.name || '',
      approval_submitted_by_id: profile?.id || null,
      status: 'pending_approval',
      created_by: profile?.name || '',
      created_by_id: profile?.id || null,
      draft_step: 8,
    };
    // If this quote was auto-saved as a draft, convert that same row to a submitted quote
    // (so we don't leave a duplicate draft behind); otherwise create it fresh.
    const _existingId = st._savedQuoteId || st._draftId;
    let data, error;
    if (_existingId) {
      ({ data, error } = await VW_DB.client.from('tile_quotations').update(_tqPayload).eq('id', _existingId).select().single());
    } else {
      ({ data, error } = await VW_DB.client.from('tile_quotations').insert(_tqPayload).select().single());
    }
    if (error) throw error;
    st._savedQuoteId = data.id; st._draftId = data.id; st._approvalStatus = 'pending_approval';

    // Start the escalation chain: TL/SrExec → FloorMgr → StoreMgr → Management (30s each)
    await VW_ESCALATION.startTileQuoteApproval(data.id);

    if (st.laborRequired) await postLaborFromQuotation(data.id, tqNo);

    await auditLog('tile_quotation_submitted', 'tile_quotation', data.id, st.customer.name, null,
      { tqNo }, 'Submitted — escalation chain started');

    // Show "under review" screen with upsell instead of navigating away
    const tqNoSaved = tqNo;
    const quoteIdSaved = data.id;
    _tqState = { step:1, customer:{name:'',phone:'',site:'',id:null}, rooms:[], currentFlat:'', tileSelections:{}, spacerSelections:{}, adhesiveSelections:{}, beading:[], groutSelections:{}, floorTraps:[], soffit:{enabled:false}, delivery:{type:'self',floors:[],beyondFt:false,distanceKm:0}, addons:{}, laborRequired:null };
    // Prevent realtime liveRefresh from overwriting the success screen
    if (typeof window !== 'undefined') window.currentPage = 'tile_quote_submitted';
    if (typeof currentPage !== 'undefined') currentPage = 'tile_quote_submitted';
    const appDiv = document.getElementById('app-content');
    if (appDiv) appDiv.innerHTML = `
      <div style="padding:24px;text-align:center;max-width:400px;margin:0 auto">
        <div style="font-size:52px;margin-bottom:12px">✅</div>
        <h2 style="margin-bottom:6px;font-size:18px">Submitted for Approval</h2>
        <div style="font-size:15px;font-weight:800;color:var(--gold);margin-bottom:4px">${tqNoSaved}</div>
        <p style="color:var(--text2);font-size:12px;margin-bottom:12px">
          Approval chain started automatically.<br>
          <strong>TL / Sr Exec → Floor Manager → Store Manager → Management</strong>
        </p>
        ${contractorCommission ? `
        <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px">
          <div style="font-weight:700;margin-bottom:3px">🔨 ${contractorCommission.contractor_name}</div>
          <div style="color:var(--text2)">Commission: ₹${contractorCommission.commission_amount.toLocaleString('en-IN')} (${contractorCommission.commission_pct}%)</div>
          ${contractorCommission.needs_approval?'<div style="color:var(--gold);font-size:11px;margin-top:2px">⚠️ Above 2% — needs management approval</div>':''}
        </div>` : ''}
        <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">💡 While you wait for approval…</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Show the customer how their space will look with these tiles — increase confidence and conversion</div>
          <button onclick="navigateTo('tile_visualizer')"
            style="width:100%;padding:12px;background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.4);border-radius:10px;color:#60A5FA;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px">
            🎨 Open Room Visualizer
          </button>
          <button onclick="navigateTo('catalog')"
            style="width:100%;padding:10px;background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);border-radius:10px;color:var(--gold);font-size:12px;font-weight:600;cursor:pointer;margin-bottom:8px">
            📖 Show Product Catalog
          </button>
        </div>
        <button onclick="navigateTo('tile_quotes')"
          style="width:100%;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:12px;cursor:pointer">
          View All Quotations
        </button>
      </div>`;

  } catch(e) {
    console.error('TQ submit error:', e);
    restoreBtn();
    showToast(`Submit failed: ${e?.message || 'Check connection and try again'}`, 'error');
  }
}

async function tqResumeDraft(id) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id',id).single();
  if (!q) { showToast('Draft not found','warn'); return; }
  _tqResumeData = {
    ...q,
    customer:{ name:q.customer_name||'', phone:q.customer_phone||'', site:q.site_address||'', id:q.customer_id||null },
    contractor: q.contractor_commission ? { name:q.contractor_commission.contractor_name, phone:q.contractor_commission.contractor_phone, id:q.contractor_commission.contractor_id, commissionPct:q.contractor_commission.commission_pct } : null,
    rooms: q.rooms||[], currentFlat:'',
    tileSelections: q.tile_selections||{}, spacerSelections: q.spacer_selections||{},
    spacerType: q.spacer?.type||'plus', adhesiveSelections: q.adhesive_selections||{},
    beading: q.beading||[], groutSelections: q.grout_selections||{}, quotedPrices: q.quoted_prices||{},
    accessories: q.accessories||[], floorTraps: q.floor_traps||[], soffit: q.soffit||{enabled:false},
    delivery: q.delivery||{type:'self',distanceKm:0,floors:[],beyondFt:false,siteAddress:''},
    laborRequired: q.labor_required||null, addons: q.addons||{}, wallDesigns: q.wall_designs||{},
    extraProducts: q.extra_products||[],
    selectedSize: q.selected_size||null, selectedProduct: q.selected_product||null,
    spacer: q.spacer||{}, adhesive: q.adhesive||{}, grout: q.grout||{},
    _inWallDesign:false, _designSlot:null, currentRoomIdx:0,
    step: Math.min(8, Math.max(1, q.draft_step||1)),
    breakagePct: q.breakage_pct ?? 10,
    _savedQuoteId: id, _draftId: (q.status==='draft' ? id : null), _approvalStatus: q.approval_status,
    _savedAccPrices: q.accessory_prices || {},
  };
  if (typeof closeSheet === 'function') closeSheet();
  navigateTo('tiles');
}

async function openTileQuote(id) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id',id).single();
  if (!q) return;
  // Quick Quote estimates always open in QQ flow, never the TQ wizard
  if (q.source === 'quick_quote') { return qqEditExisting(id); }
  // Full TQ drafts open back in the wizard at the step they left off
  if (q.status === 'draft' || q.approval_status === 'draft') { return tqResumeDraft(id); }
  const profile = VW_AUTH.getCurrentProfile();
  const myRole = profile?.role || '';
  const LEVEL_LABELS_TQ = { tl:'TL / Sr Executive', floor_manager:'Floor Manager', store_manager:'Store Manager', management:'Management' };

  // Determine if I can action the current pending step
  const log = q.approval_log || [];
  const lastStep = log[log.length - 1];
  const myAllowedRoles = lastStep ? ((window.TQ_LEVEL_ROLES||{})[lastStep.level] || [lastStep.level]) : [];
  const canIAction = q.approval_status === 'pending_approval' && lastStep?.status === 'pending' &&
    (myRole === 'admin' || myAllowedRoles.includes(myRole));
  const isCashier = ['admin','accounts'].includes(myRole);

  // Pre-compute approval BOM HTML (async — needs tier price fetch)
  const approvalBomHtml = canIAction ? await _tqBuildApprovalBOM(q, lastStep?.level || myRole) : '';

  const sheet = document.getElementById('bottom-sheet');
  const totalSqft = parseFloat(q.total_area_sqft||0);
  const pricePerSqft = q.quoted_price_per_sqft || 0;
  const pricePerBox = q.quoted_price_per_box || 0;
  const estTotal = pricePerSqft > 0 ? Math.round(totalSqft * pricePerSqft) : 0;

  // Store quote ID for approve/reject/print functions
  _tqState._reviewingQuoteId = id;
  _tqState._savedQuoteId = id;
  _tqState._approvalStatus = q.approval_status;

  // Build escalation chain timeline
  const chainTimeline = log.length ? `
  <div style="margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Approval Chain</div>
    ${log.map((step, idx) => {
      const isLast = idx === log.length - 1;
      const stepLabel = LEVEL_LABELS_TQ[step.level] || step.level;
      const statusIcon = step.status === 'approved' ? '✅' : step.status === 'rejected' ? '❌' : step.status === 'timeout' ? '⏭' : isLast ? '⏳' : '○';
      const statusColor = step.status === 'approved' ? 'var(--green)' : step.status === 'rejected' ? 'var(--red)' : step.status === 'timeout' ? 'var(--text3)' : isLast ? 'var(--gold)' : 'var(--text3)';
      const approverNames = step.approverNames?.length ? step.approverNames.join(', ') : step.roles?.join('/') || '';
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;${idx < log.length-1 ? 'border-bottom:1px solid var(--border2)' : ''}">
        <span style="font-size:14px;flex-shrink:0">${statusIcon}</span>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:${statusColor}">${stepLabel}</div>
          <div style="font-size:10px;color:var(--text3)">${approverNames}${step.approvedBy ? ' · Approved by '+step.approvedBy : ''}${step.rejectedBy ? ' · Rejected by '+step.rejectedBy : ''}${step.editedPricePerSqft ? ` · Price: ₹${step.editedPricePerSqft}/sqft` : ''}</div>
          ${step.rejectReason ? `<div style="font-size:10px;color:var(--red)">${step.rejectReason}</div>` : ''}
        </div>
        <div style="font-size:10px;color:var(--text3)">${new Date(step.notifiedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>`;
    }).join('')}
  </div>` : '';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div>
        <h3 style="margin:0">${q.customer_name}</h3>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">${q.tq_no} · ${new Date(q.created_at).toLocaleDateString('en-IN')}</div>
      </div>
      <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;background:var(--bg2)">
        ${q.approval_status?.replace('_',' ')||'draft'}
      </span>
    </div>

    <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px">
      <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Site</span><span>${q.site_address||'—'}</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Total Area</span><span style="font-weight:700">${totalSqft.toFixed(1)} sqft</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Tile Size</span><span>${q.selected_size?.label||'—'}</span></div>
      ${pricePerSqft>0?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Price</span><span style="font-weight:700;color:var(--gold)">₹${pricePerSqft}/sqft${pricePerBox?` · ₹${pricePerBox}/box`:''}</span></div>`:''}
      ${estTotal>0?`<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border2)"><span style="color:var(--text3)">Tile Subtotal</span><span style="font-weight:700;color:var(--gold)">₹${estTotal.toLocaleString('en-IN')}</span></div>`:''}
      ${q.price_edit_note?`<div style="font-size:11px;color:var(--gold);padding:4px 0">Note: ${q.price_edit_note}</div>`:''}
      ${(() => {
        const extras = q.extra_products || [];
        if (!extras.length) return '';
        const extTotal = extras.reduce((s,p)=>s+((p.price||0)*(p.qty||1)),0);
        return `<div style="padding:6px 0">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:3px">🛒 Add-ons</div>
          ${extras.map(p=>`<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:11px"><span style="color:var(--text2)">${p.name} ×${p.qty||1}</span><span>₹${Math.round((p.price||0)*(p.qty||1)).toLocaleString('en-IN')}</span></div>`).join('')}
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-top:3px;border-bottom:1px solid var(--border2);padding-bottom:5px"><span style="color:var(--text3)">Add-ons</span><span style="color:var(--gold)">₹${extTotal.toLocaleString('en-IN')}</span></div>
        </div>`;
      })()}
      ${(() => {
        const del = q.delivery || {};
        const sT = del.transportCost||del.transport_cost||0;
        const sL = del.loadingCost||del.loading_cost||0;
        const sF = del.floorCost||del.floor_cost||0;
        const dT = sT+sL+sF;
        if (!dT) return '';
        return `<div style="padding:6px 0">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:3px">🚛 Delivery</div>
          ${sT?`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span style="color:var(--text2)">Transport</span><span>₹${sT.toLocaleString('en-IN')}</span></div>`:''}
          ${sL?`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span style="color:var(--text2)">Loading + Unloading</span><span>₹${sL.toLocaleString('en-IN')}</span></div>`:''}
          ${sF?`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span style="color:var(--text2)">Floor Delivery</span><span>₹${sF.toLocaleString('en-IN')}</span></div>`:''}
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-top:3px;border-bottom:1px solid var(--border2);padding-bottom:5px"><span style="color:var(--text3)">Delivery</span><span style="color:var(--gold)">₹${dT.toLocaleString('en-IN')}</span></div>
        </div>`;
      })()}
      ${q.grand_total>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;font-weight:800;background:rgba(245,200,66,0.08);margin:-2px -6px;padding:8px 6px;border-radius:7px;margin-top:4px"><span style="color:var(--gold)">GRAND TOTAL</span><span style="color:var(--gold)">₹${parseInt(q.grand_total).toLocaleString('en-IN')}</span></div>`:''}
      ${q.rejection_reason?`<div style="color:var(--red);padding:4px 0">Rejected: ${q.rejection_reason}</div>`:''}
      ${q.advance_amount>0?`<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Advance</span><span style="font-weight:700;color:#378ADD">₹${parseInt(q.advance_amount).toLocaleString('en-IN')} · ${q.advance_receipt_no}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Submitted by</span><span>${q.created_by||'—'}</span></div>
      ${q.version>1?`<div style="display:flex;justify-content:space-between;padding:3px 0;margin-top:4px"><span style="color:var(--text3)">Version</span><span style="font-weight:700;color:var(--gold)">v${q.version} (revised)</span></div>`:''}
    </div>

    ${await (async ()=>{
      if (!q.id) return '';
      const { data: revs } = await VW_DB.client.from('tq_revisions')
        .select('version,changed_by_name,change_reason,created_at')
        .eq('tq_id', q.id).order('version', { ascending: false }).limit(10)
        .catch(()=>({ data: [] }));
      if (!revs?.length) return '';
      return '<div style="margin-bottom:12px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">📋 Revision History</div>' +
        revs.map(r=>'<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border2);font-size:11px">' +
          '<div><span style="font-weight:700;color:var(--gold)">v'+r.version+'</span>' +
          '<span style="color:var(--text3);margin-left:6px">'+(r.changed_by_name||'—')+'</span>' +
          (r.change_reason?'<div style="font-size:10px;color:var(--text3);margin-top:1px">&quot;'+r.change_reason+'&quot;</div>':'') +
          '</div><div style="color:var(--text3);font-size:10px">'+new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</div>' +
          '</div>').join('') +
        '</div>';
    })()}

    ${chainTimeline}

    ${canIAction ? `
    <div style="margin-bottom:12px;background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:12px">
      <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--gold)">⚡ Your Action Required — ${LEVEL_LABELS_TQ[lastStep.level]||''}</div>
      ${approvalBomHtml}
      <div class="form-group" style="margin-bottom:10px">
        <label style="font-size:11px">Price note / reason (optional)</label>
        <input type="text" id="tq-price-note" placeholder="e.g. Special rate · Seasonal offer · Premium tile" value="${q.price_edit_note||''}">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="VW_TILES.tqApprove()" style="flex:2;padding:13px;border-radius:10px;background:rgba(34,197,94,0.1);border:2px solid var(--green);color:var(--green);font-size:13px;font-weight:700;cursor:pointer">
          ✅ Approve${lastStep.level !== 'management' ? ' & Pass Up' : ' — Final'}
        </button>
        <button onclick="VW_TILES.tqReject()" style="flex:1;padding:13px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.4);color:var(--red);font-size:13px;font-weight:700;cursor:pointer">
          ❌ Reject
        </button>
      </div>
    </div>` : ''}

    ${(isCashier || myRole === 'admin') && q.approval_status === 'approved' && !q.advance_amount ? `
    <button class="btn-primary full-width" style="background:var(--gold);color:#000;font-size:14px;padding:14px;margin-bottom:8px" onclick="closeSheet();VW_TILES.tqCollectAdvance(${id})">
      💰 Collect Advance & Hold Stock
    </button>` : ''}

    ${q.advance_amount > 0 ? `
    <button class="btn-secondary full-width" style="margin-bottom:8px" onclick="VW_TILES.tqReprintReceipt(${id})">🖨 Reprint Advance Receipt</button>
    <button class="btn-primary full-width" style="background:#25D366;color:#fff;margin-bottom:8px;font-size:14px;padding:13px" onclick="closeSheet();VW_TILES.tqConvertToInvoice(${id})">
      🧾 Convert to Invoice & Bill
    </button>` : ''}

    ${q.approval_status === 'approved' ? `
    <button class="btn-primary full-width" style="margin-bottom:8px;background:#25D366" onclick="VW_TILES.tqPrintFromId(${id})">📄 Print & Share with Customer</button>` : `
    <div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:8px;font-size:11px;color:var(--text3);text-align:center">
      🔒 Print & Share enabled after final approval
    </div>`}

    ${!q.advance_amount ? `
    <button onclick="VW_TILES.tqEditQuote(${id})" style="width:100%;padding:11px;border-radius:10px;background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px">
      ✏️ Edit Quote
    </button>` : `
    <div style="background:var(--bg2);border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px;color:var(--text3);text-align:center">
      🔒 Editing locked — advance collected
    </div>`}
    <button class="btn-secondary full-width" onclick="closeSheet()">Close</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// Resume an auto-saved draft tile quotation at the step where it was left off.

async function tqPrintFromId(id) {
  const { data: q } = await VW_DB.client.from('tile_quotations').select('*').eq('id',id).single();
  if (!q) return;
  if (q.approval_status !== 'approved') {
    showToast('Cannot print — quotation not yet approved by management', 'warn');
    return;
  }
  // Build state object from saved quote data
  const printState = {
    ...q,
    customer: { name:q.customer_name, phone:q.customer_phone, site:q.site_address },
    rooms: q.rooms||[],
    tileSelections: q.tile_selections||{},
    quotedPrices: q.quoted_prices||{},
    spacerSelections: q.spacer_selections||{},
    adhesiveSelections: q.adhesive_selections||{},
    groutSelections: q.grout_selections||{},
    extraProducts: q.extra_products||[],
    delivery: q.delivery||{},
    contractor: q.contractor_commission ? { name:q.contractor_commission.contractor_name } : null,
    tqNo: q.tq_no,
    _approvalStatus: q.approval_status,
  };

  // Override _tqState temporarily so _getTileSlots and _tqTotalSqft work
  const _prevState = _tqState;
  _tqState = printState;
  const html = _buildPrintHTML(printState);
  _tqState = _prevState;

  const win = window.open('','_blank');
  if (!win) { showToast('Allow popups to print','warn'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(), 800);
}

// ───── GRANITE (preserved + improved) ──────────────────────
let graniteItems = [];
let graniteCustomer = { name:'', phone:'' };

function renderGraniteQuotationPage() {
  graniteItems = [{ id:Date.now(), name:'', width:0, height:0, pcs:1, pricePerSft:0 }];
  return `
  <div class="module-header"><h2>🪨 Granite Quotation</h2></div>
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Customer</h3>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Name *</label><input type="text" id="gq-cust-name" placeholder="Customer Name" oninput="graniteCustomer.name=this.value"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Phone</label><input type="tel" id="gq-cust-phone" placeholder="9999999999" maxlength="10" oninput="graniteCustomer.phone=this.value;VW_TILES.lookupTileCustomer(this.value,'gq')">
        <div id="gq-cust-lookup" style="font-size:11px;color:var(--text3);margin-top:2px"></div></div>
    </div>
  </div>
  <div class="card" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 class="card-title" style="margin:0">Granite Items</h3>
      <button class="btn-sm" onclick="VW_TILES.addGranitePiece()">+ Add Piece</button>
    </div>
    <div style="background:var(--bg2);border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px;color:var(--text3)">
      Formula: Width (inch) × Height (inch) ÷ 144 = SFT per piece
    </div>
    <div id="gq-items-list">${graniteItems.map((g,i)=>renderGraniteRow(g,i)).join('')}</div>
    <div id="gq-totals" style="padding:10px 0;border-top:1px solid var(--border);margin-top:8px"></div>
  </div>
  <button class="btn-primary full-width" onclick="VW_TILES.generateGraniteQuote()">Generate Quotation</button>`;
}

function renderGraniteRow(g, i) {
  return `
  <div id="gr-row-${g.id}" style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px">
    <div class="form-group"><label>Granite Name / Type</label>
      <input type="text" placeholder="e.g. SK Blue, Black Galaxy" value="${g.name}"
        oninput="VW_TILES.updateGraniteItem(${g.id},'name',this.value)"></div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Width (inch)</label>
        <input type="number" placeholder="39" value="${g.width||''}" oninput="VW_TILES.updateGraniteItem(${g.id},'width',this.value)"></div>
      <div class="form-group" style="margin:0;flex:1"><label>Height (inch)</label>
        <input type="number" placeholder="120" value="${g.height||''}" oninput="VW_TILES.updateGraniteItem(${g.id},'height',this.value)"></div>
      <div class="form-group" style="margin:0;flex:1"><label>No. of Pcs</label>
        <input type="number" placeholder="1" value="${g.pcs||1}" min="1" oninput="VW_TILES.updateGraniteItem(${g.id},'pcs',this.value)"></div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1"><label>Price/SFT (₹)</label>
        <input type="number" placeholder="0" value="${g.pricePerSft||''}" oninput="VW_TILES.updateGraniteItem(${g.id},'pricePerSft',this.value)"></div>
      <div class="form-group" style="margin:0;flex:1"><label>SFT (auto)</label>
        <input type="text" readonly value="${g.width&&g.height?((g.width*g.height/144)*g.pcs).toFixed(2)+' SFT':''}" style="background:var(--bg3);color:var(--gold);font-weight:700"></div>
    </div>
    <button onclick="VW_TILES.removeGranitePiece(${g.id})" style="background:none;border:none;color:var(--red);font-size:12px;cursor:pointer;margin-top:4px">Remove</button>
  </div>`;
}

function addGranitePiece() {
  graniteItems.push({ id:Date.now(), name:'', width:0, height:0, pcs:1, pricePerSft:0 });
  document.getElementById('gq-items-list').innerHTML = graniteItems.map((g,i)=>renderGraniteRow(g,i)).join('');
  updateGraniteTotals();
}
function removeGranitePiece(id) {
  graniteItems = graniteItems.filter(g=>g.id!==id);
  document.getElementById('gq-items-list').innerHTML = graniteItems.map((g,i)=>renderGraniteRow(g,i)).join('');
  updateGraniteTotals();
}
function updateGraniteItem(id, field, val) {
  const g = graniteItems.find(x=>x.id===id);
  if (!g) return;
  g[field] = field==='name' ? val : parseFloat(val)||0;
  const row = document.getElementById(`gr-row-${id}`);
  if (row && field!=='name') {
    const sftInput = row.querySelectorAll('input[readonly]')[0];
    if (sftInput && g.width && g.height) sftInput.value = ((g.width*g.height/144)*g.pcs).toFixed(2)+' SFT';
  }
  updateGraniteTotals();
}
function updateGraniteTotals() {
  const totalSft = graniteItems.reduce((s,g)=>s+(g.width&&g.height?(g.width*g.height/144)*g.pcs:0),0);
  const totalAmt = graniteItems.reduce((s,g)=>s+(g.width&&g.height&&g.pricePerSft?(g.width*g.height/144)*g.pcs*g.pricePerSft:0),0);
  const el = document.getElementById('gq-totals');
  if (el) el.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700">
      <span>Total: ${totalSft.toFixed(2)} SFT</span>
      ${totalAmt?`<span style="color:var(--gold)">₹${totalAmt.toLocaleString('en-IN')}</span>`:''}
    </div>`;
}
function generateGraniteQuote() {
  showToast('Granite quotation generated — review and send via WhatsApp','success');
}

// ───── INVENTORY: TILE CATEGORY (enhanced add product form) ──
function renderTileInventoryAddForm(p = {}) {
  return `
  <div class="card" style="margin-bottom:10px;border-color:rgba(96,165,250,0.3)">
    <h3 class="card-title">🔲 Tile-Specific Details</h3>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Tile Size (mm)</label>
        <select id="inv-tile-size" onchange="VW_TILES.onTileSizeChange(this.value)">
          <option value="">Select size</option>
          ${TILE_SIZES.map(ts=>`<option value="${ts.mm}" ${p.tile_size_mm===ts.mm?'selected':''}>${ts.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Tile Type</label>
        <select id="inv-tile-type">
          ${['FLOOR','WALL','PARKING','ELEVATION','DADO','KITCHEN','BATHROOM'].map(t=>`<option value="${t}" ${p.tile_type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Finish</label>
        <select id="inv-tile-finish">
          ${['MATT','GLOSSY','SATIN','POLISHED','SUGAR','CARVING','METALLIC','STONE LOOK'].map(f=>`<option value="${f}" ${p.tile_finish===f?'selected':''}>${f}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Thickness (mm)</label>
        <input type="number" id="inv-tile-thick" value="${p.tile_thickness_mm||9}" min="6" max="20" step="1">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Tiles Per Box</label>
        <input type="number" id="inv-tiles-per-box" value="${p.tiles_per_box||4}" min="1" step="1" oninput="VW_TILES.calcCoverage()">
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Coverage Per Box (sqft)</label>
        <input type="number" id="inv-coverage-box" value="${p.coverage_per_box||''}" placeholder="auto" step="0.1">
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Box Weight (kg)</label>
        <input type="number" id="inv-box-weight" value="${p.box_weight_kg||''}" placeholder="e.g. 25" step="0.5">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Purchase Date <span style="color:var(--text3)">(for stock age)</span></label>
        <input type="date" id="inv-purchase-date" value="${p.purchase_date||new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Dead Stock?</label>
        <select id="inv-dead-stock">
          <option value="false" ${!p.dead_stock_flag?'selected':''}>No</option>
          <option value="true" ${p.dead_stock_flag?'selected':''}>Yes — Special Price</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin:0;flex:1">
        <label>Recommended Adhesive</label>
        <input type="text" id="inv-rec-adhesive" value="${p.recommended_adhesive||''}" placeholder="auto from size" readonly style="background:var(--bg3);color:var(--text3)">
      </div>
      <div class="form-group" style="margin:0;flex:1">
        <label>Executive Incentive %</label>
        <input type="number" id="inv-incentive-pct" value="${p.executive_incentive_pct||0}" min="0" max="10" step="0.5" placeholder="0">
      </div>
    </div>
  </div>`;
}

function onTileSizeChange(mm) {
  const ts = TILE_SIZES.find(s=>s.mm===mm);
  if (!ts) return;
  const adh = document.getElementById('inv-rec-adhesive');
  if (adh) adh.value = ADHESIVE_TYPES[ts.adhesive]?.label || ts.adhesive;
  calcCoverage();
}

function calcCoverage() {
  const mm = document.getElementById('inv-tile-size')?.value || '';
  const ts = TILE_SIZES.find(s=>s.mm===mm);
  const ppc = parseInt(document.getElementById('inv-tiles-per-box')?.value||4);
  if (ts && ppc) {
    const [w,h] = mm.split('×').map(Number);
    const sqft_per_tile = (w/304.8)*(h/304.8); // mm to ft
    const coverage = (sqft_per_tile*ppc).toFixed(2);
    const el = document.getElementById('inv-coverage-box');
    if (el && !el.value) el.value = coverage;
  }
}

// ───── FLOOR PLAN AI READER ─────────────────────────────────
// Robustly pull a rooms[] array out of whatever shape the OCR/vision function returns:
// direct {rooms:[...]}, nested {data:{rooms}}, or a JSON block embedded in a text field.
function _findRoomsArray(data){
  if (Array.isArray(data?.rooms)) return data.rooms;
  if (Array.isArray(data?.data?.rooms)) return data.data.rooms;
  const texts = [];
  for (const k of ['description','response','content','text','output','result','message']) {
    if (typeof data?.[k] === 'string') texts.push(data[k]);
  }
  texts.push(typeof data === 'string' ? data : JSON.stringify(data || {}));
  for (const t of texts){
    if (!t) continue;
    const i = t.indexOf('"rooms"');
    if (i < 0) continue;
    let start = t.lastIndexOf('{', i);
    if (start < 0) start = t.indexOf('{');
    if (start < 0) continue;
    // Walk braces to find the balanced object that holds "rooms".
    let depth = 0;
    for (let j = start; j < t.length; j++){
      if (t[j] === '{') depth++;
      else if (t[j] === '}'){
        depth--;
        if (depth === 0){
          try { const obj = JSON.parse(t.slice(start, j+1)); if (Array.isArray(obj.rooms)) return obj.rooms; } catch(e){}
          break;
        }
      }
    }
  }
  return null;
}

async function tqReadFloorPlan(input) {
  const file = input.files?.[0];
  if (!file) return;
  const status = document.getElementById('tq-floorplan-status');
  if (status) status.innerHTML = '<span style="color:var(--gold)">⏳ AI reading floor plan dimensions...</span>';

  const b64 = await new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 1400;
        const ratio = Math.min(max/img.width, max/img.height, 1);
        canvas.width = Math.round(img.width*ratio);
        canvas.height = Math.round(img.height*ratio);
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        res(canvas.toDataURL('image/jpeg',0.92).split(',')[1]);
      };
      img.onerror = () => res(e.target.result.split(',')[1]);
      if (file.type.includes('image')) img.src = e.target.result;
      else res(e.target.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });

  try {
    const url = `${VW_DB.client.supabaseUrl}/functions/v1/room-visualizer`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${VW_DB.client.supabaseKey}`, 'apikey':VW_DB.client.supabaseKey },
      body: JSON.stringify({
        mode: 'floor_plan',
        imageBase64: b64,
        image: b64,                                   // alias for compatibility
        mimeType: file.type || 'image/jpeg',
        prompt: `Analyze this floor plan image and extract all room dimensions. 
Return ONLY valid JSON like this:
{
  "rooms": [
    {"type": "Living Room", "length": 15, "width": 12, "unit": "ft"},
    {"type": "Master Bedroom", "length": 12, "width": 10, "unit": "ft"},
    {"type": "Bathroom", "length": 5, "width": 4, "unit": "ft"},
    {"type": "Kitchen", "length": 10, "width": 8, "unit": "ft"}
  ],
  "notes": "any relevant notes about the plan"
}
Use standard room types. Convert to feet if dimensions are in meters (1m = 3.28ft) or mm. If no dimensions visible, estimate from scale. Include all rooms visible.`
      })
    });
    const data = await res.json();

    // Parse rooms from AI response (robust to nested / text-wrapped JSON)
    const rooms = _findRoomsArray(data);

    if (rooms?.length) {
      // Auto-populate rooms from floor plan
      _tqState.rooms = [];
      for (const r of rooms) {
        const type = Object.keys(ROOM_DEFS).find(t => t.toLowerCase().includes((r.type||'').toLowerCase().split(' ')[0])) || 'Custom Area';
        const l = parseFloat(r.length)||0;
        const w = parseFloat(r.width)||0;
        if (l&&w) {
          _tqState.rooms.push({
            id: Date.now()+Math.random(),
            type,
            label: r.type || type,
            areas: [{ label:`${l}ft × ${w}ft (from floor plan)`, sqft:l*w*1.05, base:l*w, l, w, waste:0.05, fromFloorPlan:true }],
            def: ROOM_DEFS[type]||ROOM_DEFS['Custom Area'],
            flat: _tqState.currentFlat || '',
          });
        }
      }
      if (status) status.innerHTML = `<span style="color:var(--green)">✅ Found ${_tqState.rooms.length} rooms from floor plan. Review and edit below.</span>`;
      _refreshStep1();
    } else {
      const raw = (typeof data==='string'?data:JSON.stringify(data||{})).slice(0,160).replace(/</g,'&lt;');
      const pdfHint = (file.type||'').includes('pdf') ? ' A clear photo or screenshot of the plan usually reads better than a PDF.' : '';
      if (status) status.innerHTML = `<span style="color:var(--text3)">⚠️ Couldn't auto-read dimensions — add rooms manually below.${pdfHint}</span>`
        + `<div style="font-size:9px;color:var(--text3);opacity:.6;margin-top:3px;word-break:break-all">debug: ${raw}</div>`;
    }
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:var(--red)">Error reading floor plan: ${e.message}</span>`;
  }
}

async function lookupTileCustomer(phone, prefix, showOwnershipWarning) { return lookupTileCustomerFull(phone, prefix, showOwnershipWarning); }


// ───── Parametric (basic) room render — to-scale, design-applied, free & instant ─────
function _tqParametricSVG(slotId) {
  const g = (typeof _getWallGrid==='function') ? _getWallGrid(slotId) : null;
  if (!g || !g.cols || !g.rows) return '';
  const st = (typeof _dsState==='function') ? _dsState(slotId) : null;
  const tiles = (_tqState._dsTilesCache||{})[slotId] || [];
  const pal = (st?.palette||[]).map(k => tiles.find(t=>t.key===k)).filter(Boolean);
  const slot = _getTileSlots().find(s=>s.id===slotId);
  const need = g.rows*g.cols;
  const cells = (st?.cells && st.cells.length===need) ? st.cells : new Array(need).fill(0);
  const W = 320;
  let aspect = (g.wallLengthFt>0) ? (g.wallH/g.wallLengthFt)
            : (g.tileWidthMm>0 ? (g.tileHeightMm*g.rows)/(g.tileWidthMm*g.cols) : 0.4);
  let H = Math.round(W*aspect); H = Math.max(72, Math.min(H, 240));
  const cw = W/g.cols, ch = H/g.rows;
  let body = '';
  for (let r=0;r<g.rows;r++) for (let c=0;c<g.cols;c++) {
    const ci = r*g.cols+c;
    const pi = cells[ci] ?? 0;
    const col = _DS_SWATCH[pi%_DS_SWATCH.length];
    const img = pal[pi]?.imageUrl;
    const x=(c*cw).toFixed(1), y=(r*ch).toFixed(1), w=(cw+0.6).toFixed(1), h=(ch+0.6).toFixed(1);
    body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col}"/>`;
    if (img) body += `<image href="${img}" xlink:href="${img}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
    body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="rgba(0,0,0,0.16)" stroke-width="0.5"/>`;
  }
  const icon = slot?.subType==='wall' ? '🧱' : '🔲';
  const dim = (g.wallLengthFt>0) ? `${g.wallLengthFt.toFixed(1)} ft × ${g.wallH.toFixed(1)} ft` : '';
  return `<div style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px">
      <span>${icon} ${slot?.label||'Area'}</span><span>${dim}</span>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#222">
      <svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display:block">${body}</svg>
    </div>
  </div>`;
}
function _tqRenderParametricRoom() {
  const sel = _tqState.tileSelections || {};
  const slots = _getTileSlots().filter(s=>sel[s.id]?.size);
  if (!slots.length) return '<div style="padding:20px;text-align:center;color:var(--text3)">Select tiles first to preview the design</div>';
  let out = '';
  slots.forEach(s => { out += _tqParametricSVG(s.id); });
  return out || '<div style="padding:20px;text-align:center;color:var(--text3)">No design laid out yet — build a design to preview</div>';
}
function openTileVisualizer() {
  const slots = _getTileSlots().filter(s=>_tqState.tileSelections[s.id]?.size);
  if (!slots.length) { showToast('Select a tile first (Step 6)', 'warn'); return; }
  const sheet = document.getElementById('bottom-sheet');
  if (!sheet) return;
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="margin:0">🎨 Room Visualizer</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">To-scale preview with your selected design. Walls show the row-by-row layout.</div>
    <div style="max-height:48vh;overflow-y:auto;padding-right:2px">${_tqRenderParametricRoom()}</div>
    <div id="tq-ai-desc" style="margin-top:8px"></div>
    <button onclick="VW_TILES.tqAiDescribe()" style="width:100%;margin-top:8px;padding:11px;background:var(--bg2);border:1px solid var(--gold-border);border-radius:10px;color:var(--gold);font-size:13px;font-weight:700;cursor:pointer">✨ AI Description (how it'll look)</button>
    <button onclick="VW_TILES.tqAiVisualize()" style="width:100%;margin-top:8px;padding:12px;background:linear-gradient(135deg,#60A5FA,#8B5CF6);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">📷 AI Realistic Render (photo)</button>
    <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:6px">Basic preview & description are free · the photo render costs per image — use for closing / advance-paying customers</div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Close</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay')?.classList.add('open');
}
function tqAiVisualize() {
  // Premium photorealistic render — pre-select the quote's tile so it's one tap from a result.
  try {
    const slots = _getTileSlots().filter(s=>_tqState.tileSelections[s.id]?.size);
    let pid = null;
    for (const s of slots) {
      const st = (typeof _dsState==='function') ? _dsState(s.id) : null;
      const key = (st?.palette||[])[0];
      if (key) { const n = parseInt(String(key).replace(/^ni_/,'')); if (!isNaN(n)) { pid = n; break; } }
    }
    if (pid == null) pid = _tqState.selectedProduct?.id || null;
    if (pid != null) _visPreseedId = pid;
  } catch(e) {}
  if (typeof closeSheet === 'function') closeSheet();
  navigateTo('visualizer');
}
// Instant AI description of the actual design + dimensions (text mode — no photo, low cost).
async function tqAiDescribe() {
  const box = document.getElementById('tq-ai-desc');
  if (box) box.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px">✨ Generating AI description…</div>';
  try {
    const slots = _getTileSlots().filter(s=>_tqState.tileSelections[s.id]?.size);
    const products = [];
    let dims = [];
    slots.forEach(s => {
      const sel = _tqState.tileSelections[s.id];
      const dsTiles = _tqState.design?.[s.id]?.result?.tiles || [];
      if (dsTiles.length) dsTiles.forEach(t => products.push({ name:t.name, category:'Tiles', brand:t.brand||'', size:(sel?.size?.mm||'') }));
      else if (sel?.size) products.push({ name:(s.label||'Tile'), category:'Tiles', size:sel.size.mm });
      const a = (s.room?.areas||[]).find(x=>x.subType===s.subType) || (s.room?.areas||[])[0];
      if (a?.l && (a?.w||a?.h)) dims.push(`${s.label||s.subType}: ${a.l}ft × ${(a.h||a.w)}ft`);
    });
    const roomType = (slots[0]?.room?.type) || 'room';
    const res = await fetch(`${VW_DB.client.supabaseUrl}/functions/v1/room-visualizer`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${VW_DB.client.supabaseKey}`,'apikey':VW_DB.client.supabaseKey},
      body: JSON.stringify({ mode:'describe', roomType, dimensions: dims.join('; '), products })
    });
    const data = await res.json();
    if (box) box.innerHTML = data?.description
      ? `<div style="font-size:12px;line-height:1.55;color:var(--text2);background:var(--bg2);border:1px solid var(--gold-border);border-radius:10px;padding:12px">✨ ${data.description}</div>`
      : '<div style="font-size:11px;color:var(--text3);padding:8px">AI description unavailable right now — try again.</div>';
    _logApiUsage('ai_visualizer_describe', { success:!!data?.description });
  } catch(e) {
    _logApiUsage('ai_visualizer_describe', { success:false });
    if (box) box.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:8px">Could not reach AI — check connection.</div>';
  }
}

// ───── AI API USAGE LOGGER ───────────────────────────────────────
const _API_COST = {
  ai_visualizer_describe: 0.001,
  ai_visualizer_render:   0.020,
  grn_scan:               0.015,
  catalog_ocr:            0.010,
};
async function _logApiUsage(type, opts) {
  try {
    const success = opts?.success !== false;
    const meta = opts?.meta || {};
    const model = opts?.model || 'claude-sonnet-4-6';
    const profile = VW_AUTH.getCurrentProfile();
    await VW_DB.client.from('api_usage_log').insert({
      call_type: type, called_by: profile?.name||'',
      called_by_id: profile?.id||null,
      cost_usd: _API_COST[type]||0, model, success, meta,
    });
  } catch(e) {} // silent — never break the actual feature
}

// ═══════════════════════════════════════════════════════════════════
// ⚡ QUICK QUOTE — fast tap-based room entry + smart tile matching
// Staff: tap room → pick mode → enter 2 numbers → preference chips
// → AI picks from live inventory → confirm → Summary in 60–90 sec
// ═══════════════════════════════════════════════════════════════════

const _QQ_ROOMS = [
  { type:'Living Room',     icon:'🛋', def:'floor', mode:'lw',   skirting:true  },
  { type:'Drawing Hall',    icon:'🏛', def:'floor', mode:'lw',   skirting:true  },
  { type:'Dining Room',     icon:'🍽', def:'floor', mode:'lw',   skirting:true  },
  { type:'Master Bedroom',  icon:'🛏', def:'floor', mode:'lw',   skirting:true  },
  { type:'Bedroom',         icon:'🛏', def:'floor', mode:'lw',   skirting:true  },
  { type:'Kids Room',       icon:'🧒', def:'floor', mode:'lw',   skirting:true  },
  { type:'Kitchen',         icon:'🍳', def:'both',  mode:'bath', skirting:false },
  { type:'Bathroom',        icon:'🚿', def:'both',  mode:'bath', skirting:false },
  { type:'Toilet',          icon:'🚽', def:'both',  mode:'bath', skirting:false },
  { type:'Wash Area',       icon:'🫧', def:'both',  mode:'bath', skirting:false },
  { type:'Balcony',         icon:'🌿', def:'floor', mode:'lw',   skirting:false },
  { type:'Corridor / Passage',icon:'🚶',def:'floor',mode:'lw',  skirting:false },
  { type:'Pooja Room',      icon:'🙏', def:'both',  mode:'bath', skirting:false },
  { type:'Parking',         icon:'🚗', def:'floor', mode:'lw',   skirting:false },
  { type:'Staircase',       icon:'🏗', def:'floor', mode:'lw',   skirting:false },
  { type:'Elevation',       icon:'🏠', def:'wall',  mode:'bath', skirting:false },
];

window._qqData = null;

