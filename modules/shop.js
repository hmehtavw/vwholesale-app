// ═══════════════════════════════════════════════════════════════
// CONTRACTOR BID + DAILY LOG + PAYMENT MODULE
// ═══════════════════════════════════════════════════════════════

async function renderContractorBidForm(requestId) {
  const { data: r } = await VW_DB.client.from('labor_requests')
    .select('*').eq('id', requestId).single();
  if (!r) return;

  const prof = VW_AUTH.getCurrentProfile();
  const { data: cp } = await VW_DB.client.from('contractor_profiles')
    .select('*').eq('profile_id', prof?.id).single().catch(() => ({ data: null }));

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>📝 Submit Bid — ${r.request_no}</h3>
  <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:12px;font-size:11px">
    <div style="font-weight:700;margin-bottom:4px">${r.customer_name} · ${r.total_sqft} sqft · ${r.work_type}</div>
    <div style="color:var(--text3)">${r.site_address}</div>
    <div style="color:var(--text3);margin-top:2px">Floor: ${r.floor_level===0?'Ground':r.floor_level+'th floor'} · Access: ${r.site_access?.replace('_',' ')} · Existing: ${r.old_flooring?.replace('_',' ')}</div>
    ${r.notes?`<div style="color:var(--text2);margin-top:4px;font-style:italic">"${r.notes}"</div>`:''}
  </div>

  <!-- PRICE TYPE -->
  <div class="form-group">
    <label>Pricing Type</label>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button id="pt-sqft" onclick="selectBidPriceType('per_sqft')"
        style="flex:1;padding:10px;border-radius:8px;border:2px solid var(--gold);background:var(--gold-muted);cursor:pointer;font-size:12px;font-weight:700;color:var(--gold)">
        ₹ per Sqft
      </button>
      ${r.total_sqft <= 80 ? `
      <button id="pt-lump" onclick="selectBidPriceType('lumpsum')"
        style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:12px;font-weight:700;color:var(--text3)">
        Lump Sum
      </button>` : ''}
    </div>
  </div>

  <!-- PER SQFT SECTION -->
  <div id="bid-sqft-section">
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">Rate per sqft by tile size</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>
          <label style="font-size:9px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Small tiles<br><span style="font-weight:400">Below 300mm</span></label>
          <input type="number" id="bid-rate-small" placeholder="₹/sqft" step="0.5"
            style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;font-size:13px;font-weight:700;color:var(--gold);text-align:center;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:9px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Medium tiles<br><span style="font-weight:400">300–600mm</span></label>
          <input type="number" id="bid-rate-medium" placeholder="₹/sqft" step="0.5"
            style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;font-size:13px;font-weight:700;color:var(--gold);text-align:center;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:9px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Large tiles<br><span style="font-weight:400">Above 600mm</span></label>
          <input type="number" id="bid-rate-large" placeholder="₹/sqft" step="0.5"
            style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;font-size:13px;font-weight:700;color:var(--gold);text-align:center;box-sizing:border-box">
        </div>
      </div>
    </div>
  </div>

  <!-- LUMP SUM SECTION -->
  <div id="bid-lump-section" style="display:none">
    <div class="form-group">
      <label>Total Lump Sum Amount (₹)</label>
      <input type="number" id="bid-lumpsum" placeholder="Total for complete job" step="100"
        style="font-size:18px;font-weight:800;color:var(--gold)">
    </div>
  </div>

  <!-- JOB DETAILS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div class="form-group" style="margin:0">
      <label>Estimated Days</label>
      <input type="number" id="bid-days" placeholder="Days to complete" min="1">
    </div>
    <div class="form-group" style="margin:0">
      <label>Earliest Start Date</label>
      <input type="date" id="bid-start" min="${new Date().toISOString().split('T')[0]}">
    </div>
  </div>

  <!-- OLD TILE REMOVAL -->
  ${r.old_flooring !== 'bare_cement' ? `
  <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:10px">
    <div style="font-size:12px;font-weight:700;margin-bottom:6px">🔨 Old ${r.old_flooring?.replace('_',' ')} Removal</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button id="otr-yes" onclick="toggleOldTileRemoval(true)"
        style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);cursor:pointer;font-size:12px">
        ✅ I can handle removal
      </button>
      <button id="otr-no" onclick="toggleOldTileRemoval(false)"
        style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);cursor:pointer;font-size:12px">
        ❌ Not included
      </button>
    </div>
    <div id="otr-charge-row" style="display:none">
      <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Demolition Charge (₹)</label>
      <input type="number" id="bid-demo-charge" placeholder="Extra charge for removal" step="100"
        style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;box-sizing:border-box">
    </div>
  </div>` : ''}

  <div class="form-group">
    <label>Notes to Customer (optional)</label>
    <textarea id="bid-notes" rows="2" placeholder="Any clarifications, conditions, or questions..."
      style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px;resize:vertical;box-sizing:border-box"></textarea>
  </div>

  <button onclick="VW_LABOR.submitContractorBid(${requestId})"
    style="width:100%;padding:14px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    📤 Submit Bid
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  const s = document.createElement('script');
  s.textContent = `
    window._bidPriceType = 'per_sqft';
    window._otrIncluded = false;
    function selectBidPriceType(t) {
      window._bidPriceType = t;
      document.getElementById('bid-sqft-section').style.display = t==='per_sqft'?'block':'none';
      const ls = document.getElementById('bid-lump-section');
      if(ls) ls.style.display = t==='lumpsum'?'block':'none';
      const sqftBtn = document.getElementById('pt-sqft');
      const lumpBtn = document.getElementById('pt-lump');
      if(sqftBtn) { sqftBtn.style.borderColor=t==='per_sqft'?'var(--gold)':'var(--border)'; sqftBtn.style.background=t==='per_sqft'?'var(--gold-muted)':'var(--bg2)'; sqftBtn.style.color=t==='per_sqft'?'var(--gold)':'var(--text3)'; }
      if(lumpBtn) { lumpBtn.style.borderColor=t==='lumpsum'?'var(--gold)':'var(--border)'; lumpBtn.style.background=t==='lumpsum'?'var(--gold-muted)':'var(--bg2)'; lumpBtn.style.color=t==='lumpsum'?'var(--gold)':'var(--text3)'; }
    }
    function toggleOldTileRemoval(inc) {
      window._otrIncluded = inc;
      document.getElementById('otr-charge-row').style.display = inc?'block':'none';
      const yb=document.getElementById('otr-yes'), nb=document.getElementById('otr-no');
      if(yb){yb.style.background=inc?'rgba(34,197,94,0.1)':'var(--bg3)';yb.style.borderColor=inc?'var(--green)':'var(--border)';}
      if(nb){nb.style.background=!inc?'rgba(239,68,68,0.08)':'var(--bg3)';nb.style.borderColor=!inc?'var(--red)':'var(--border)';}
    }
  `;
  document.body.appendChild(s);
}

async function submitContractorBid(requestId) {
  const days = parseInt(document.getElementById('bid-days')?.value) || 0;
  const start = document.getElementById('bid-start')?.value;
  if (!days || !start) { showToast('Enter estimated days and start date', 'warn'); return; }

  const priceType = window._bidPriceType || 'per_sqft';
  const lumpsum = parseFloat(document.getElementById('bid-lumpsum')?.value) || 0;
  const rSmall  = parseFloat(document.getElementById('bid-rate-small')?.value) || 0;
  const rMedium = parseFloat(document.getElementById('bid-rate-medium')?.value) || 0;
  const rLarge  = parseFloat(document.getElementById('bid-rate-large')?.value) || 0;

  if (priceType === 'lumpsum' && !lumpsum) { showToast('Enter lump sum amount', 'warn'); return; }
  if (priceType === 'per_sqft' && !rLarge && !rMedium && !rSmall) { showToast('Enter at least one rate', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();
  const { data: cp } = await VW_DB.client.from('contractor_profiles')
    .select('id,name').eq('profile_id', prof?.id).single().catch(() => ({ data: null }));

  const { error } = await VW_DB.client.from('contractor_bids').insert({
    request_id: requestId,
    contractor_profile_id: cp?.id || null,
    contractor_name: cp?.name || prof?.name || '',
    price_type: priceType,
    price_per_sqft_small: rSmall || null,
    price_per_sqft_medium: rMedium || null,
    price_per_sqft_large: rLarge || null,
    lumpsum_amount: lumpsum || null,
    estimated_days: days,
    earliest_start_date: start,
    old_tile_removal: window._otrIncluded || false,
    old_tile_removal_charge: parseFloat(document.getElementById('bid-demo-charge')?.value) || null,
    notes: document.getElementById('bid-notes')?.value || '',
    status: 'submitted',
  });

  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Bid submitted ✅ — customer will review and respond', 'success');
  closeSheet();
}

// ── DAILY LOG UPLOAD ──────────────────────────────────────────

async function renderDailyLogUpload(jobId) {
  const { data: job } = await VW_DB.client.from('labor_jobs').select('*').eq('id', jobId).single();
  if (!job) return;

  // Check if already submitted today
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await VW_DB.client.from('labor_daily_logs')
    .select('id,contractor_confirmed_sqft,payment_status')
    .eq('job_id', jobId).eq('log_date', today).single().catch(() => ({ data: null }));

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>📸 Today's Work Update — ${job.job_no}</h3>
  <div style="font-size:11px;color:var(--text3);margin-bottom:14px">
    ${job.total_sqft_completed || 0} sqft done so far · ${job.total_sqft} sqft total
  </div>

  ${existing ? `
  <div style="background:rgba(34,197,94,0.08);border:1px solid var(--green);border-radius:10px;padding:12px;margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;color:var(--green)">✅ Today's log already submitted</div>
    <div style="font-size:11px;color:var(--text3);margin-top:4px">${existing.contractor_confirmed_sqft} sqft confirmed · Payment: ${existing.payment_status}</div>
  </div>` : ''}

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📷 Upload Today's Work Photos</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:8px">Upload 2-4 clear photos showing today's tile laying progress. AI will analyse and estimate sqft.</p>
    <input type="file" id="daily-photos" multiple accept="image/*" onchange="previewDailyPhotos(this)"
      style="width:100%;padding:8px;background:var(--bg2);border:1px dashed var(--border);border-radius:8px;font-size:12px">
    <div id="daily-photo-previews" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
  </div>

  <button onclick="VW_LABOR.analyseDailyPhotos(${jobId})"
    id="analyse-btn"
    style="width:100%;padding:12px;border-radius:10px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);color:#60A5FA;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px">
    🤖 Analyse Photos with AI
  </button>

  <!-- AI RESULT + CONTRACTOR CONFIRMATION -->
  <div id="daily-ai-result" style="display:none;background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">🤖 AI Analysis</div>
    <div id="ai-analysis-content"></div>

    <div style="margin-top:12px">
      <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:6px">✏️ Confirm sqft completed today</label>
      <input type="number" id="confirmed-sqft" step="0.5" min="0"
        style="width:100%;padding:10px;background:var(--bg3);border:1.5px solid var(--gold-border);border-radius:8px;font-size:18px;font-weight:800;color:var(--gold);text-align:center;box-sizing:border-box">
    </div>

    <div style="margin-top:8px">
      <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:6px">Work stage today</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${['laying','grouting_pending','cleaning_pending','complete'].map(s=>`
        <button id="stage-${s}" onclick="selectDailyStage('${s}')"
          style="flex:1;min-width:80px;padding:7px 4px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);cursor:pointer;font-size:10px;font-weight:700">
          ${s==='laying'?'🔲 Laying':s==='grouting_pending'?'🪨 Grout pending':s==='cleaning_pending'?'🧴 Clean pending':'✅ Complete'}
        </button>`).join('')}
      </div>
    </div>

    <div class="form-group" style="margin-top:10px;margin-bottom:0">
      <label>Notes for customer (optional)</label>
      <input type="text" id="daily-notes" placeholder="e.g. Bathroom floor complete, kitchen in progress">
    </div>
  </div>

  <div id="daily-amount-preview" style="display:none;background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:12px">
    <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Amount due from customer today</div>
    <div id="daily-amount-value" style="font-size:24px;font-weight:900;color:var(--gold)"></div>
    <div id="daily-deduction-note" style="font-size:10px;color:var(--text3);margin-top:3px"></div>
  </div>

  <button id="submit-daily-log" onclick="VW_LABOR.submitDailyLog(${jobId})" style="display:none;width:100%;padding:14px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    ✅ Confirm & Notify Customer
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  const s = document.createElement('script');
  s.textContent = `
    window._dailyPhotosData = [];
    window._dailyStage = 'laying';
    window._aiSuggestion = null;

    function previewDailyPhotos(input) {
      const preview = document.getElementById('daily-photo-previews');
      window._dailyPhotosData = [];
      if (!preview) return;
      preview.innerHTML = '';
      const files = Array.from(input.files).slice(0,4);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result.split(',')[1];
          const mediaType = file.type || 'image/jpeg';
          window._dailyPhotosData.push({ base64, mediaType });
          preview.innerHTML += '<img src="'+e.target.result+'" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">';
        };
        reader.readAsDataURL(file);
      });
    }

    function selectDailyStage(s) {
      window._dailyStage = s;
      window.selectDailyStage = selectDailyStage;
      ['laying','grouting_pending','cleaning_pending','complete'].forEach(t => {
        const btn = document.getElementById('stage-'+t);
        if(btn){btn.style.background=t===s?'var(--gold-muted)':'var(--bg3)';btn.style.borderColor=t===s?'var(--gold)':'var(--border)';btn.style.color=t===s?'var(--gold)':'var(--text)';}
      });
      updateAmountPreview();
    }

    function updateAmountPreview() {
      const sqft = parseFloat(document.getElementById('confirmed-sqft')?.value) || 0;
      if (!sqft) return;
      const stage = window._dailyStage || 'laying';
      const deductions = ${JSON.stringify((await VW_DB.client.from('labor_requests').select('stage_deductions').eq('id', job.request_id).single().then(r=>r.data?.stage_deductions).catch(()=>null)) || { laying:0, grouting_pending:5, cleaning_pending:2 })};
      const baseRate = ${job.agreed_price_large || job.agreed_price_medium || job.agreed_price_small || 0};
      const deductRate = deductions[stage] || 0;
      const effectiveRate = Math.max(0, baseRate - deductRate);
      const amount = Math.round(sqft * effectiveRate);

      const preview = document.getElementById('daily-amount-preview');
      const amtEl = document.getElementById('daily-amount-value');
      const noteEl = document.getElementById('daily-deduction-note');
      const submitBtn = document.getElementById('submit-daily-log');

      if (preview) preview.style.display = 'block';
      if (amtEl) amtEl.textContent = '₹'+amount.toLocaleString('en-IN');
      if (noteEl) noteEl.textContent = sqft+' sqft × ₹'+effectiveRate+'/sqft'+(deductRate>0?' (₹'+deductRate+'/sqft held for '+stage.replace('_',' ')+')'  :'');
      if (submitBtn) submitBtn.style.display = 'block';
    }
  `;
  document.body.appendChild(s);
}

async function analyseDailyPhotos(jobId) {
  const photos = window._dailyPhotosData || [];
  if (!photos.length) { showToast('Upload photos first', 'warn'); return; }

  const btn = document.getElementById('analyse-btn');
  if (btn) { btn.disabled = true; btn.textContent = '🤖 Analysing...'; }

  const { data: job } = await VW_DB.client.from('labor_jobs').select('total_sqft').eq('id', jobId).single().catch(() => ({ data: null }));

  try {
    const res = await fetch(`https://ndamdnlsuktucqtcbhgp.supabase.co/functions/v1/labor-photo-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': VW_DB.client.supabaseKey },
      body: JSON.stringify({ photos, totalSqft: job?.total_sqft, tileSize: 'mixed' }),
    });
    const { data } = await res.json();
    window._aiSuggestion = data;

    const result = document.getElementById('daily-ai-result');
    const content = document.getElementById('ai-analysis-content');
    const sqftInput = document.getElementById('confirmed-sqft');

    if (result) result.style.display = 'block';
    if (content) content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:900;color:var(--gold)">${data.sqft_estimate || '?'}</div>
          <div style="font-size:10px;color:var(--text3)">sqft estimated</div>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${(data.work_stage||'').replace('_',' ')}</div>
          <div style="font-size:10px;color:var(--text3)">work stage</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px">${data.observations || ''}</div>
      <div style="font-size:10px;color:var(--text3)">Confidence: ${data.confidence || 'medium'} · ${data.rooms_detected || 1} room(s) detected</div>
    `;
    if (sqftInput && data.sqft_estimate) sqftInput.value = data.sqft_estimate;
    // Auto-select detected stage via window function
    if (data.work_stage && typeof window.selectDailyStage === 'function') window.selectDailyStage(data.work_stage);

    showToast('AI analysis complete — confirm the numbers below', 'success');
  } catch(e) {
    showToast('AI analysis failed — enter sqft manually', 'warn');
    const result = document.getElementById('daily-ai-result');
    if (result) result.style.display = 'block';
  }

  if (btn) { btn.disabled = false; btn.textContent = '🔄 Re-analyse'; }
}

async function submitDailyLog(jobId) {
  const confirmedSqft = parseFloat(document.getElementById('confirmed-sqft')?.value) || 0;
  if (!confirmedSqft) { showToast('Confirm sqft completed today', 'warn'); return; }

  const stage = window._dailyStage || 'laying';
  const notes = document.getElementById('daily-notes')?.value || '';
  const prof = VW_AUTH.getCurrentProfile();
  const today = new Date().toISOString().split('T')[0];

  // Get job and request for rate + deduction config
  const { data: job } = await VW_DB.client.from('labor_jobs').select('*').eq('id', jobId).single();
  const { data: req } = await VW_DB.client.from('labor_requests').select('stage_deductions,commission_type,commission_value,tds_pct,wallet_id,customer_name,customer_phone').eq('id', job.request_id).single();

  const baseRate = job.agreed_price_large || job.agreed_price_medium || job.agreed_price_small || 0;
  const deductions = req?.stage_deductions || {};
  const deductRate = deductions[stage] || 0;
  const effectiveRate = Math.max(0, baseRate - deductRate);
  const amountDue = Math.round(confirmedSqft * effectiveRate);

  // Save daily log
  const { data: log } = await VW_DB.client.from('labor_daily_logs').insert({
    job_id: jobId,
    log_date: today,
    photos: (window._dailyPhotosData || []).map(p => ({ mediaType: p.mediaType })),
    ai_analysis: window._aiSuggestion || null,
    ai_sqft_suggestion: window._aiSuggestion?.sqft_estimate || null,
    ai_work_stage: window._aiSuggestion?.work_stage || null,
    contractor_confirmed_sqft: confirmedSqft,
    contractor_confirmed_stage: stage,
    contractor_notes: notes,
    deduction_per_sqft: deductRate,
    amount_due: amountDue,
    payment_status: 'notified',
    customer_notified_at: new Date().toISOString(),
  }).select('id').single();

  // Update job total sqft completed
  await VW_DB.client.from('labor_jobs').update({
    total_sqft_completed: (job.total_sqft_completed || 0) + confirmedSqft,
    status: stage === 'complete' ? 'completed' : 'in_progress',
  }).eq('id', jobId);

  // Notify customer via wallet notification
  if (req?.wallet_id) {
    await createPersistedNotification({
      category: 'labor_payment_due',
      title: `🏗 Payment Due — ${job.job_no}`,
      body: `${confirmedSqft} sqft completed today${deductRate > 0 ? ` · ₹${deductRate}/sqft held (${stage.replace('_',' ')})` : ''} · ₹${amountDue.toLocaleString('en-IN')} due now`,
      relatedTable: 'labor_daily_logs',
      relatedId: log?.id,
      actions: [
        { label: '💳 Pay Now', action: 'pay_labor_log' },
        { label: '👁 View Job', action: 'open_labor_job' },
      ],
    }).catch(() => {});
  }

  showToast(`✅ Customer notified — ₹${amountDue.toLocaleString('en-IN')} due`, 'success');
  closeSheet();
}

async function processLaborPayment(logId) {
  const { data: log } = await VW_DB.client.from('labor_daily_logs').select('*').eq('id', logId).single();
  const { data: job } = await VW_DB.client.from('labor_jobs').select('*').eq('id', log.job_id).single();
  const { data: req } = await VW_DB.client.from('labor_requests')
    .select('wallet_id,commission_type,commission_value,tds_pct').eq('id', job.request_id).single();

  if (!req?.wallet_id) { showToast('No wallet linked to this job', 'error'); return; }

  const { data: wallet } = await VW_DB.client.from('customer_wallets').select('balance').eq('id', req.wallet_id).single();
  const bal = parseFloat(wallet?.balance || 0);
  const due = log.amount_due || 0;

  if (bal < due) {
    showToast(`Insufficient wallet balance. Available: ₹${bal.toLocaleString('en-IN')} · Due: ₹${due.toLocaleString('en-IN')}`, 'warn');
    return;
  }

  // Calculate commission and TDS
  const commValue = req.commission_value || 0;
  const commType  = req.commission_type || 'percent';
  const commission = commType === 'percent' ? Math.round(due * commValue / 100) : Math.round(due * commValue);
  const tds = Math.round((due - commission) * (req.tds_pct || 1) / 100);
  const netToContractor = due - commission - tds;

  // Debit wallet
  const newBalance = bal - due;
  const prof = VW_AUTH.getCurrentProfile();

  await VW_DB.client.from('wallet_transactions').insert({
    wallet_id: req.wallet_id,
    type: 'labor_payment',
    amount: due,
    balance_after: newBalance,
    description: `Labor payment — ${job.job_no} · ${log.log_date} · ${log.contractor_confirmed_sqft} sqft`,
    reference_type: 'labor_daily_log',
    reference_id: logId,
    payment_method: 'wallet',
    processed_by: prof?.id,
    processed_by_name: prof?.name || '',
  });

  await VW_DB.client.from('customer_wallets').update({
    balance: newBalance,
    total_spent: (parseFloat((await VW_DB.client.from('customer_wallets').select('total_spent').eq('id',req.wallet_id).single().then(r=>r.data?.total_spent).catch(()=>0))||0) + due),
    last_activity_at: new Date().toISOString(),
  }).eq('id', req.wallet_id);

  // Save payment record
  await VW_DB.client.from('labor_payments').insert({
    job_id: job.id,
    log_id: logId,
    amount_collected: due,
    commission_amount: commission,
    tds_amount: tds,
    net_to_contractor: netToContractor,
    payment_method: 'wallet',
    wallet_transaction_id: null,
  });

  // Mark log as paid
  await VW_DB.client.from('labor_daily_logs').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', logId);

  // Update job totals
  await VW_DB.client.from('labor_jobs').update({
    total_billed: (job.total_billed || 0) + due,
    total_paid_to_contractor: (job.total_paid_to_contractor || 0) + netToContractor,
  }).eq('id', job.id);

  showToast(`₹${due.toLocaleString('en-IN')} paid · Contractor receives ₹${netToContractor.toLocaleString('en-IN')} (after commission + TDS)`, 'success');
}

// Expose
window.VW_LABOR.renderContractorBidForm = renderContractorBidForm;
window.VW_LABOR.submitContractorBid = submitContractorBid;
window.VW_LABOR.renderDailyLogUpload = renderDailyLogUpload;
window.VW_LABOR.analyseDailyPhotos = analyseDailyPhotos;
window.VW_LABOR.submitDailyLog = submitDailyLog;
window.VW_LABOR.processLaborPayment = processLaborPayment;

// ── REVIEWS ───────────────────────────────────────────────────

async function renderLaborReviewForm(jobId, reviewerType, stage) {
  const { data: job } = await VW_DB.client.from('labor_jobs').select('*').eq('id', jobId).single();
  if (!job) return;

  const isFinal = stage === 'final';
  const revieweeName = reviewerType === 'customer' ? job.contractor_name : job.customer_name;
  const revieweeType = reviewerType === 'customer' ? 'contractor' : 'customer';

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>${isFinal ? '⭐ Final Review' : '📊 Stage Review'}</h3>
  <p style="font-size:12px;color:var(--text3);margin-bottom:14px">
    ${reviewerType === 'customer' ? `How is ${revieweeName}'s work?` : `How is ${revieweeName} as a customer?`}
  </p>

  <!-- STAR RATING -->
  <div style="text-align:center;margin-bottom:16px">
    <div id="star-display" style="font-size:40px;letter-spacing:4px">⭐⭐⭐⭐⭐</div>
    <div style="display:flex;justify-content:center;gap:8px;margin-top:8px">
      ${[1,2,3,4,5].map(n=>`
      <button onclick="setReviewRating(${n})"
        id="star-${n}"
        style="width:44px;height:44px;border-radius:50%;border:2px solid ${n<=3?'var(--gold)':'var(--border)'};background:${n<=3?'var(--gold-muted)':'var(--bg2)'};cursor:pointer;font-size:18px">
        ${n<=3?'⭐':'☆'}
      </button>`).join('')}
    </div>
    <div id="rating-label" style="font-size:12px;color:var(--gold);margin-top:6px;font-weight:700">Good</div>
  </div>

  ${isFinal ? `
  <!-- DETAILED REVIEW (final only) -->
  <div class="form-group">
    <label>${reviewerType === 'customer' ? 'Review the contractor\'s work' : 'Review this customer'}</label>
    <textarea id="review-text" rows="3" placeholder="${reviewerType === 'customer' ?
      'Quality of work, punctuality, cleanliness, behaviour...' :
      'Payment behaviour, cooperation, site access, clarity of instructions...'}"
      style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px;resize:vertical;box-sizing:border-box"></textarea>
  </div>
  ${reviewerType === 'customer' ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    ${['Work Quality','Punctuality','Cleanliness','Behaviour'].map(tag=>`
    <button id="tag-${tag.replace(' ','_')}" onclick="toggleReviewTag('${tag}')"
      style="padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:11px;font-weight:600">
      ${tag}
    </button>`).join('')}
  </div>` : ''}
  <div class="form-group">
    <label>Upload photos of finished work (optional)</label>
    <input type="file" id="review-photos" multiple accept="image/*"
      style="width:100%;padding:8px;background:var(--bg2);border:1px dashed var(--border);border-radius:8px;font-size:12px">
  </div>` : ''}

  <button onclick="VW_LABOR.submitReview('${jobId}','${reviewerType}','${stage}')"
    style="width:100%;padding:14px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    Submit Review
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Later</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  const s = document.createElement('script');
  s.textContent = `
    window._reviewRating = 3;
    window._reviewTags = [];
    const ratingLabels = {1:'Poor',2:'Below Average',3:'Good',4:'Very Good',5:'Excellent'};
    function setReviewRating(n) {
      window._reviewRating = n;
      for(let i=1;i<=5;i++){
        const btn=document.getElementById('star-'+i);
        if(btn){btn.textContent=i<=n?'⭐':'☆';btn.style.background=i<=n?'var(--gold-muted)':'var(--bg2)';btn.style.borderColor=i<=n?'var(--gold)':'var(--border)';}
      }
      const lbl=document.getElementById('rating-label');
      if(lbl)lbl.textContent=ratingLabels[n]||'';
    }
    function toggleReviewTag(tag) {
      const idx = window._reviewTags.indexOf(tag);
      if(idx>=0) window._reviewTags.splice(idx,1); else window._reviewTags.push(tag);
      const btn = document.getElementById('tag-'+tag.replace(' ','_'));
      if(btn){btn.style.background=window._reviewTags.includes(tag)?'var(--gold-muted)':'var(--bg2)';btn.style.borderColor=window._reviewTags.includes(tag)?'var(--gold)':'var(--border)';}
    }
  `;
  document.body.appendChild(s);
}

async function submitReview(jobId, reviewerType, stage) {
  const rating = window._reviewRating || 3;
  const text = document.getElementById('review-text')?.value || '';
  const prof = VW_AUTH.getCurrentProfile();

  const { data: job } = await VW_DB.client.from('labor_jobs').select('*').eq('id', jobId).single();

  await VW_DB.client.from('labor_reviews').insert({
    job_id: jobId,
    reviewer_type: reviewerType,
    reviewer_id: prof?.id,
    reviewer_name: prof?.name || '',
    reviewee_type: reviewerType === 'customer' ? 'contractor' : 'customer',
    reviewee_id: reviewerType === 'customer' ? job.contractor_profile_id : job.customer_id,
    review_stage: stage,
    rating,
    review_text: text,
  });

  // Update contractor average rating
  if (reviewerType === 'customer') {
    const { data: allRevs } = await VW_DB.client.from('labor_reviews')
      .select('rating').eq('reviewee_id', job.contractor_profile_id).eq('reviewer_type', 'customer');
    const avgRating = allRevs?.length
      ? allRevs.reduce((s,r) => s + r.rating, 0) / allRevs.length
      : rating;
    await VW_DB.client.from('contractor_profiles')
      .update({ avg_rating: Math.round(avgRating * 10) / 10 })
      .eq('id', job.contractor_profile_id);
  }

  showToast('Review submitted ✅', 'success');
  closeSheet();
}

window.VW_LABOR.renderLaborReviewForm = renderLaborReviewForm;
window.VW_LABOR.submitReview = submitReview;

// ═══════════════════════════════════════════════════════════════
// CONTRACTOR PROFILE + KYC
// ═══════════════════════════════════════════════════════════════

async function renderContractorProfilePage() {
  const prof = VW_AUTH.getCurrentProfile();
  let { data: cp } = await VW_DB.client
    .from('contractor_profiles')
    .select('*')
    .eq('profile_id', prof?.id)
    .single()
    .catch(() => ({ data: null }));

  // Auto-create if not exists
  if (!cp) {
    const { data: newCp } = await VW_DB.client
      .from('contractor_profiles')
      .insert({ profile_id: prof?.id, name: prof?.name || '', phone: prof?.phone || '' })
      .select('*').single().catch(() => ({ data: null }));
    cp = newCp;
  }

  const kycColor = cp?.kyc_status === 'approved' ? 'var(--green)' : cp?.kyc_status === 'pending' ? 'var(--gold)' : 'var(--red)';
  const kycLabel = cp?.kyc_status === 'approved' ? '✅ KYC Verified' : cp?.kyc_status === 'pending' ? '⏳ Under Review' : '❌ KYC Required';
  const scoreColor = (cp?.contractor_score || 0) >= 70 ? 'var(--green)' : (cp?.contractor_score || 0) >= 40 ? 'var(--gold)' : 'var(--red)';

  return `
  <div class="module-header"><h2>👷 My Contractor Profile</h2></div>

  <!-- SCORE CARD -->
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:16px;margin-bottom:14px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:18px;font-weight:900">${cp?.name || prof?.name || '—'}</div>
        <div style="font-size:12px;opacity:0.7;margin-top:2px">${cp?.phone || prof?.phone || '—'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:30px;font-weight:900;color:${scoreColor}">${Math.round(cp?.contractor_score || 0)}</div>
        <div style="font-size:10px;opacity:0.7">Score / 100</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px;text-align:center">
      <div><div style="font-size:18px;font-weight:800;color:#f5c842">${cp?.total_jobs_completed || 0}</div><div style="font-size:10px;opacity:0.7">Jobs Done</div></div>
      <div><div style="font-size:18px;font-weight:800;color:#f5c842">${cp?.avg_rating?.toFixed(1) || '—'}</div><div style="font-size:10px;opacity:0.7">Avg Rating</div></div>
      <div><div style="font-size:18px;font-weight:800;color:#f5c842">${cp?.total_sqft_laid ? Math.round(cp.total_sqft_laid).toLocaleString('en-IN') : '0'}</div><div style="font-size:10px;opacity:0.7">Sqft Laid</div></div>
    </div>
    <div style="margin-top:10px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:11px;opacity:0.8">${cp?.is_active ? '🟢 Active — receiving job requests' : '🔴 Inactive — not receiving requests'}</span>
      <span style="font-size:11px;font-weight:700;color:${kycColor}">${kycLabel}</span>
    </div>
  </div>

  <!-- ACTIVATION TOGGLE -->
  ${cp?.kyc_status === 'approved' ? `
  <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:12px">
    <div>
      <div style="font-size:13px;font-weight:700">Receive Job Requests</div>
      <div style="font-size:11px;color:var(--text3)">Turn off when unavailable or on holiday</div>
    </div>
    <button onclick="VW_LABOR.toggleContractorActive(${cp?.id}, ${cp?.is_active})"
      style="padding:8px 16px;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:700;
        background:${cp?.is_active ? 'var(--green)' : 'var(--bg3)'};color:${cp?.is_active ? '#fff' : 'var(--text3)'}">
      ${cp?.is_active ? '✓ Active' : 'Activate'}
    </button>
  </div>` : ''}

  <!-- SERVICE AREA -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📍 Service Area</h3>
    <div class="form-group">
      <label>Your Location / Area</label>
      <input type="text" id="cp-location" value="${cp?.location_label || ''}" placeholder="e.g. Bhavanipuram, Vijayawada">
    </div>
    <div class="form-group">
      <label>Service Radius</label>
      <div style="display:flex;gap:8px">
        ${[10,20,30].map(km=>`
        <button id="cp-radius-${km}" onclick="selectRadius(${km})"
          style="flex:1;padding:10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;
            border:${(cp?.service_radius_km||10)===km?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${(cp?.service_radius_km||10)===km?'var(--gold-muted)':'var(--bg2)'};
            color:${(cp?.service_radius_km||10)===km?'var(--gold)':'var(--text)'}">
          ${km} km
        </button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Work Types</label>
      <div style="display:flex;gap:8px">
        ${['floor','wall','both'].map(w=>`
        <button id="cp-wt-${w}" onclick="toggleWorkType('${w}')"
          style="flex:1;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;
            border:${(cp?.work_types||['both']).includes(w)?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${(cp?.work_types||['both']).includes(w)?'var(--gold-muted)':'var(--bg2)'}">
          ${w==='floor'?'🏠 Floor':w==='wall'?'🧱 Wall':'🏠+🧱 Both'}
        </button>`).join('')}
      </div>
    </div>
    <button onclick="VW_LABOR.saveContractorProfile(${cp?.id})"
      style="width:100%;padding:10px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer">
      Save Service Details
    </button>
  </div>

  <!-- BANK DETAILS -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🏦 Bank Account (for payments)</h3>
    ${cp?.kyc_status === 'approved' ? `
    <div style="background:rgba(34,197,94,0.08);border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px;color:var(--green)">
      ✅ Bank verified — payments will be transferred directly
    </div>` : ''}
    <div class="form-group">
      <label>Account Number</label>
      <input type="text" id="cp-account" value="${cp?.bank_account_no || ''}" placeholder="Bank account number">
    </div>
    <div class="form-group">
      <label>IFSC Code</label>
      <input type="text" id="cp-ifsc" value="${cp?.bank_ifsc || ''}" placeholder="e.g. SBIN0001234" style="text-transform:uppercase">
    </div>
    <div class="form-group">
      <label>Bank Name</label>
      <input type="text" id="cp-bank-name" value="${cp?.bank_name || ''}" placeholder="e.g. State Bank of India">
    </div>
  </div>

  <!-- KYC DOCUMENTS -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📄 KYC Documents</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:12px">Required to receive payments. Verified within 1 working day.</p>
    ${[
      { id:'pan', label:'PAN Card *', field:'pan_card_url', hint:'Clear photo of your PAN card' },
      { id:'aadhaar', label:'Aadhaar Card *', field:'aadhaar_url', hint:'Front side of Aadhaar card' },
      { id:'passbook', label:'Bank Passbook / Cheque', field:'passbook_url', hint:'First page of passbook or cancelled cheque' },
    ].map(doc => `
    <div style="margin-bottom:10px">
      <label style="font-size:11px;font-weight:700;display:block;margin-bottom:3px">${doc.label}</label>
      <div style="font-size:10px;color:var(--text3);margin-bottom:5px">${doc.hint}</div>
      ${cp?.[doc.field] ? `<div style="font-size:11px;color:var(--green);margin-bottom:5px">✅ Uploaded</div>` : ''}
      <input type="file" id="cp-${doc.id}" accept="image/*,application/pdf"
        style="width:100%;padding:6px;background:var(--bg2);border:1px dashed var(--border);border-radius:8px;font-size:11px">
    </div>`).join('')}
    <button onclick="VW_LABOR.submitContractorKYC(${cp?.id})"
      style="width:100%;padding:10px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px">
      📤 Submit for KYC Verification
    </button>
  </div>

  </div>`;

  // Inject scripts safely (not inline — avoids HTML parser terminating extras.js)
  const _cpWorkTypesVal = cp?.work_types || ['both'];
  setTimeout(() => {
    window._cpRadius = cp?.service_radius_km || 10;
    window._cpWorkTypes = _cpWorkTypesVal.slice();
    window.selectRadius = function(km) {
      window._cpRadius = km;
      [10,20,30].forEach(r => {
        const btn = document.getElementById('cp-radius-'+r);
        if(btn){btn.style.borderColor=r===km?'var(--gold)':'var(--border)';btn.style.background=r===km?'var(--gold-muted)':'var(--bg2)';btn.style.color=r===km?'var(--gold)':'var(--text)';}
      });
    };
    window.toggleWorkType = function(w) {
      const idx = window._cpWorkTypes.indexOf(w);
      if(idx>=0) window._cpWorkTypes.splice(idx,1); else window._cpWorkTypes.push(w);
      ['floor','wall','both'].forEach(t => {
        const btn = document.getElementById('cp-wt-'+t);
        if(btn){btn.style.borderColor=window._cpWorkTypes.includes(t)?'var(--gold)':'var(--border)';btn.style.background=window._cpWorkTypes.includes(t)?'var(--gold-muted)':'var(--bg2)';}
      });
    };
  }, 50);

  return html;
}

async function saveContractorProfile(cpId) {
  const update = {
    location_label: document.getElementById('cp-location')?.value?.trim() || null,
    service_radius_km: window._cpRadius || 10,
    work_types: window._cpWorkTypes || ['both'],
    bank_account_no: document.getElementById('cp-account')?.value?.trim() || null,
    bank_ifsc: document.getElementById('cp-ifsc')?.value?.trim()?.toUpperCase() || null,
    bank_name: document.getElementById('cp-bank-name')?.value?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  await VW_DB.client.from('contractor_profiles').update(update).eq('id', cpId);
  showToast('Profile saved ✅', 'success');
  navigateTo('contractor_profile');
}

async function submitContractorKYC(cpId) {
  const prof = VW_AUTH.getCurrentProfile();
  const panFile     = document.getElementById('cp-pan')?.files?.[0];
  const aadhaarFile = document.getElementById('cp-aadhaar')?.files?.[0];
  const passbookFile= document.getElementById('cp-passbook')?.files?.[0];

  if (!panFile || !aadhaarFile) { showToast('PAN and Aadhaar are required', 'warn'); return; }

  const uploadDoc = async (file, path) => {
    if (!file) return null;
    const { data, error } = await VW_DB.client.storage
      .from('kyc-documents')
      .upload(path, file, { upsert: true });
    return error ? null : data?.path;
  };

  const panPath      = await uploadDoc(panFile,      `contractor/${cpId}/pan.${panFile.name.split('.').pop()}`);
  const aadhaarPath  = await uploadDoc(aadhaarFile,  `contractor/${cpId}/aadhaar.${aadhaarFile.name.split('.').pop()}`);
  const passbookPath = await uploadDoc(passbookFile, `contractor/${cpId}/passbook.${passbookFile?.name.split('.').pop()}`);

  await VW_DB.client.from('contractor_profiles').update({
    pan_card_url: panPath || undefined,
    aadhaar_url: aadhaarPath || undefined,
    passbook_url: passbookPath || undefined,
    kyc_status: 'pending',
  }).eq('id', cpId);

  // Notify management for KYC review
  const { data: mgmt } = await VW_DB.client.from('profiles')
    .select('id').in('role', ['management','admin']).eq('status','approved');
  for (const m of mgmt || []) {
    await createPersistedNotification({
      category: 'kyc_review',
      title: `📄 Contractor KYC Submitted`,
      body: `${prof?.name || ''} has submitted KYC documents for verification`,
      recipientId: m.id,
      relatedTable: 'contractor_profiles',
      relatedId: cpId,
      actions: [{ label: '👁 Review KYC', action: 'open_contractor_kyc' }],
    }).catch(() => {});
  }

  showToast('KYC documents submitted — verified within 1 working day', 'success');
  navigateTo('contractor_profile');
}

async function toggleContractorActive(cpId, currentlyActive) {
  await VW_DB.client.from('contractor_profiles')
    .update({ is_active: !currentlyActive }).eq('id', cpId);
  showToast(currentlyActive ? 'You are now inactive' : 'You are now active — will receive job requests', 'success');
  navigateTo('contractor_profile');
}

window.VW_LABOR.renderContractorProfilePage = renderContractorProfilePage;
window.VW_LABOR.saveContractorProfile = saveContractorProfile;
window.VW_LABOR.submitContractorKYC = submitContractorKYC;
window.VW_LABOR.toggleContractorActive = toggleContractorActive;

// ═══════════════════════════════════════════════════════════════
// B2C SHOP — HomeRun style quick commerce
// ═══════════════════════════════════════════════════════════════

const SHOP_CATEGORIES = [
  { key:'Tiles',        icon:'⬜', label:'Tiles',          color:'#8B5CF6' },
  { key:'Sanitary',     icon:'🚿', label:'Sanitary',       color:'#3B82F6' },
  { key:'Plumbing',     icon:'🔧', label:'Plumbing',       color:'#06B6D4' },
  { key:'Electricals',  icon:'⚡', label:'Electricals',    color:'#F59E0B' },
  { key:'Paints',       icon:'🎨', label:'Paints',         color:'#EC4899' },
  { key:'Hardware',     icon:'🔩', label:'Hardware',       color:'#6B7280' },
  { key:'Tools',        icon:'🛠', label:'Tools',          color:'#EF4444' },
  { key:'Appliances',   icon:'📦', label:'Appliances',     color:'#10B981' },
  { key:'Plywood',      icon:'🪵', label:'Plywood',        color:'#92400E' },
  { key:'Grout',        icon:'🪨', label:'Grout',          color:'#64748B' },
  { key:'Adhesive',     icon:'🧲', label:'Adhesive',       color:'#F97316' },
  { key:'Waterproofing',icon:'💧', label:'Waterproofing',  color:'#0EA5E9' },
  { key:'Profiles',     icon:'📏', label:'Profiles',       color:'#A78BFA' },
  { key:'False Ceiling',icon:'🏗', label:'False Ceiling',  color:'#34D399' },
  { key:'Spacer',       icon:'🔳', label:'Spacers',        color:'#94A3B8' },
  { key:'Accessories',  icon:'🧰', label:'Accessories',    color:'#FB923C' },
];

let _shopCart = {}; // {productId: qty}
let _shopCategory = null;
let _shopSearch = '';

async function renderShopPage() {
  const prof = VW_AUTH.getCurrentProfile();
  const isGuest = !prof;

  if (prof?.id) {
    const { data: cart } = await VW_DB.client.from('carts')
      .select('items').eq('profile_id', prof.id).single().catch(() => ({ data: null }));
    if (cart?.items) {
      _shopCart = {};
      (cart.items || []).forEach(i => { _shopCart[i.product_id] = i.qty; });
    }
  }

  const cartCount = Object.values(_shopCart).reduce((a,b) => a+b, 0);

  return `
  <div id="shop-root">

    <!-- STICKY HEADER -->
    <div class="hr-header">
      <div class="hr-topbar">
        <button class="hr-hamburger">☰</button>

        <!-- 60 MINS BADGE -->
        <div class="hr-delivery-badge">
          <span>60</span>
          <span style="font-size:8px;font-weight:700">Mins</span>
        </div>

        <!-- DELIVER TO -->
        <div class="hr-deliver-to">
          <div class="label">Deliver To</div>
          <div class="pincode">
            📍 Vijayawada <span style="color:#2a7a3b;font-size:11px">▾</span>
          </div>
        </div>

        <!-- VW LOGO -->
        <div class="hr-logo">VW</div>

        <!-- ACCOUNT + CART -->
        <div class="hr-icons">
          ${isGuest ? `
          <button class="hr-icon-btn" onclick="VW_AUTH.showAuthScreen()" title="Login">👤</button>` : `
          <button class="hr-icon-btn" onclick="navigateTo('customer_profile')" title="Account">👤</button>`}
          <button class="hr-icon-btn" onclick="VW_SHOP.openCart()" title="Cart">
            🛍
            ${cartCount > 0 ? `<span class="hr-cart-badge">${cartCount}</span>` : ''}
          </button>
        </div>
      </div>

      <!-- SEARCH -->
      <div class="hr-search">
        <div class="hr-search-inner">
          <span style="color:#999;font-size:16px">🔍</span>
          <input id="shop-search-input" type="text"
            placeholder="Search for Cement, Tiles, Paints..."
            value="${_shopSearch}"
            oninput="VW_SHOP.shopSearch(this.value)">
          ${_shopSearch ? `<button onclick="VW_SHOP.shopSearch('')" style="background:none;border:none;color:#999;cursor:pointer;font-size:16px">✕</button>` : `
          <button onclick="VW_SHOP.openBarcodeScanner()" style="background:none;border:none;cursor:pointer;font-size:16px">📷</button>`}
        </div>
      </div>
    </div>

    ${_shopSearch ? `
    <!-- SEARCH RESULTS -->
    <div style="background:#fff;padding:12px">
      <div style="font-size:12px;color:#888;margin-bottom:8px">Results for "<strong>${_shopSearch}</strong>"</div>
    </div>
    <div id="shop-products-grid" style="background:#fff;padding:0 12px 12px;display:grid;grid-template-columns:1fr 1fr;gap:10px"></div>
    ` : `

    <!-- TRUST STRIP -->
    <div class="hr-trust-strip">
      <div class="hr-trust-item">
        <div class="hr-trust-icon">💵</div>
        <span class="hr-trust-title">Pay on Delivery</span>
        <span class="hr-trust-sub">Pay after you receive &amp; verify</span>
      </div>
      <div class="hr-trust-item">
        <div class="hr-trust-icon">🔄</div>
        <span class="hr-trust-title">7 Day Return</span>
        <span class="hr-trust-sub">Any quality issue, we replace</span>
      </div>
      <div class="hr-trust-item">
        <div class="hr-trust-icon">🏷</div>
        <span class="hr-trust-title">Best Prices</span>
        <span class="hr-trust-sub">Unbeatable pricing, always</span>
      </div>
      <div class="hr-trust-item">
        <div class="hr-trust-icon">🚚</div>
        <span class="hr-trust-title">10K+ Orders</span>
        <span class="hr-trust-sub">Vijayawada's trusted store</span>
      </div>
    </div>

    <!-- HERO BANNER -->
    <div class="hr-hero-banner" onclick="VW_SHOP.filterCategory('Tiles')">
      <div class="hr-hero-inner">
        <div style="position:absolute;right:-5px;top:-5px;font-size:80px;opacity:0.08;line-height:1">⬜</div>
        <div class="hr-hero-eyebrow">⚡ Vijayawada's #1 Home Store</div>
        <div class="hr-hero-title">BULK PRICES<br><span style="color:#c8972b">SLASHED!</span></div>
        <div class="hr-hero-sub">Tiles · Sanitaryware · Paints · Hardware & More</div>
        <div class="hr-hero-cta">Shop Now →</div>
      </div>
    </div>

    <!-- CATEGORY GRID -->
    <div class="hr-section">
      <div class="hr-section-header">
        <div>
          <div class="hr-section-title">Shop by Category</div>
        </div>
        <div class="hr-see-all" onclick="VW_SHOP.filterCategory(null)">View all</div>
      </div>
      <div class="hr-cat-grid">
        ${SHOP_CATEGORIES.slice(0,12).map(c => `
        <div class="hr-cat-card" onclick="VW_SHOP.filterCategory('${c.key}')">
          <div class="hr-cat-img" style="background:${c.color}18;border-color:${c.color}33">${c.icon}</div>
          <div class="hr-cat-name">${c.label}</div>
        </div>`).join('')}
        <div class="hr-cat-card" onclick="VW_SHOP.filterCategory(null)">
          <div class="hr-cat-img" style="background:#f3f4f6;border-color:#ddd">
            <span style="font-size:18px;color:#666">+4</span>
          </div>
          <div class="hr-cat-name" style="color:#666">More</div>
        </div>
        <div class="hr-cat-card" onclick="navigateTo('tile_visualizer')">
          <div class="hr-cat-img" style="background:#ede9fe;border-color:#c4b5fd">🪟</div>
          <div class="hr-cat-name" style="color:#7c3aed">Visualizer</div>
        </div>
        <div class="hr-cat-card" onclick="navigateTo('mood_board')">
          <div class="hr-cat-img" style="background:#fce7f3;border-color:#f9a8d4">🎨</div>
          <div class="hr-cat-name" style="color:#be185d">Mood Board</div>
        </div>
        <div class="hr-cat-card" onclick="VW_TILES.openQuickQuote()">
          <div class="hr-cat-img" style="background:#fffbeb;border-color:#fcd34d">📐</div>
          <div class="hr-cat-name" style="color:#b45309">Tile Quote</div>
        </div>
      </div>
    </div>

    <!-- DEALS OF THE WEEK -->
    <div style="padding:14px 0 0">
      <div class="hr-section-header" style="padding:0 12px">
        <div>
          <div class="hr-section-title">Deals Of The Week</div>
          <div class="hr-section-sub">At our lowest ever price</div>
        </div>
        <div class="hr-see-all" onclick="VW_SHOP.filterCategory(null)">View all →</div>
      </div>
    </div>
    <!-- HORIZONTAL SCROLL DEALS — filled by JS -->
    <div id="shop-deals-scroll" class="hr-deals-scroll">
      <div style="display:flex;align-items:center;justify-content:center;width:100%;padding:20px;color:#888;font-size:13px">Loading deals...</div>
    </div>

    <!-- TILES SPECIALIST STRIP -->
    <div style="margin:0 12px 14px;background:linear-gradient(135deg,#1a0f35,#2d1b69);border-radius:14px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;font-weight:800;color:#A78BFA;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">🏆 Tile Specialist</div>
          <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:2px">Find Your Perfect Tile</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5)">600+ designs · All sizes in stock</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div onclick="VW_TILES.openQuickQuote()" style="background:#f5c842;color:#000;font-size:10px;font-weight:800;padding:7px 14px;border-radius:8px;cursor:pointer;text-align:center;white-space:nowrap">📐 Get Quote</div>
          <div onclick="VW_SHOP.requestTileSample()" style="background:rgba(255,255,255,0.12);color:#fff;font-size:10px;font-weight:700;padding:7px 14px;border-radius:8px;cursor:pointer;text-align:center;white-space:nowrap;border:1px solid rgba(255,255,255,0.2)">🏠 Try Sample</div>
        </div>
      </div>
    </div>

    <!-- TRUST SECTION 2 -->
    <div class="hr-trust2">
      <div class="hr-trust2-item">
        <div class="hr-trust2-icon">⚡</div>
        <div class="hr-trust2-label">Lightning Fast</div>
      </div>
      <div class="hr-trust2-item">
        <div class="hr-trust2-icon">✅</div>
        <div class="hr-trust2-label">100% Genuine</div>
      </div>
      <div class="hr-trust2-item">
        <div class="hr-trust2-icon">💵</div>
        <div class="hr-trust2-label">Pay on Delivery</div>
      </div>
      <div class="hr-trust2-item">
        <div class="hr-trust2-icon">📦</div>
        <div class="hr-trust2-label">No Min Order</div>
      </div>
    </div>

    <!-- OFFERS PROMO BANNER -->
    <div class="hr-promo-banner">
      <div>
        <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);margin-bottom:4px">🎁 FIRST ORDER OFFER</div>
        <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:2px">10% OFF with WELCOME10</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.6)">Free delivery on orders above ₹2,000</div>
      </div>
      <div onclick="navigateTo('offers')" style="background:#f5c842;color:#000;font-size:11px;font-weight:800;padding:8px 14px;border-radius:10px;cursor:pointer;white-space:nowrap;flex-shrink:0">
        View Offers
      </div>
    </div>

    <!-- SPACER -->
    <div style="height:20px"></div>

  `}

  </div>`;

  // After render, load deals into horizontal scroll
  setTimeout(() => {
    if (!_shopSearch) {
      loadShopProducts(null, '');   // load deals section
    }
  }, 80);
}


async function loadShopProducts(category, search) {
  // After category tap — fill the grid
  if (category || search) {
    const container = document.getElementById('shop-products-grid');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:13px">Loading...</div>';

    let query = VW_DB.client.from('products')
      .select('id,name,brand,category,subcategory,price,vwp,mrp,stock,unit,images,photos')
      .eq('is_active', true).order('stock', { ascending: false }).limit(40);

    if (category) query = query.eq('category', category);
    if (search)   query = query.ilike('name', `%${search}%`);

    const { data: products } = await query;

    if (!products?.length) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#888">
        <div style="font-size:40px;margin-bottom:8px">${search ? '🔍' : '📦'}</div>
        <div style="font-size:14px;font-weight:700;color:#333">${search ? 'No results for "'+search+'"' : 'Coming soon!'}</div>
        <div style="font-size:12px;margin-top:4px;color:#888">Call us: 8712697930</div>
      </div>`;
      return;
    }
    container.style.cssText = 'background:#fff;padding:0 12px 12px;display:grid;grid-template-columns:1fr 1fr;gap:10px';
    container.innerHTML = products.map(p => homeRunProductCard(p)).join('');
    return;
  }

  // Home page — fill the horizontal deals scroll
  const dealsEl = document.getElementById('shop-deals-scroll');
  if (!dealsEl) return;

  const { data: products } = await VW_DB.client.from('products')
    .select('id,name,brand,category,price,vwp,mrp,stock,unit,images,photos')
    .eq('is_active', true).gt('stock', 0)
    .order('mrp', { ascending: false }).limit(12);

  if (!products?.length) {
    dealsEl.innerHTML = '<div style="padding:20px;color:#888;font-size:13px">No products yet</div>';
    return;
  }

  dealsEl.innerHTML = products.map(p => {
    const price  = p.vwp || p.price || 0;
    const mrp    = p.mrp || 0;
    const disc   = mrp > price && price > 0 ? Math.round((mrp - price) / mrp * 100) : 0;
    const qty    = _shopCart[p.id] || 0;
    const oos    = !p.stock || p.stock <= 0;
    const img    = p.images?.[0] || p.photos?.[0]?.url || p.photos?.[0] || null;
    const cat    = SHOP_CATEGORIES.find(c => c.key === p.category);
    const icon   = cat?.icon || '📦';
    const color  = cat?.color || '#6B7280';

    return `
    <div class="hr-deal-card">
      <div class="hr-deal-img" style="background:${img ? '#f3f4f6' : color+'18'}">
        ${img
          ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover">`
          : `<span style="font-size:52px">${icon}</span>`}
        ${disc > 0 ? `<div class="hr-deal-disc">${disc}% OFF</div>` : ''}
        <div class="hr-deal-assured">⚡ ASSURED</div>
      </div>
      <div class="hr-deal-body">
        ${p.brand ? `<div style="font-size:10px;color:#888;font-weight:600;margin-bottom:2px">${p.brand}</div>` : ''}
        <div class="hr-deal-name">${p.name}</div>
        <div style="font-size:10px;color:#2a7a3b;font-weight:700;margin-bottom:4px">⚡ 7 Day Replacement</div>
        <div class="hr-deal-row">
          <div>
            <span class="hr-deal-price">₹${price.toLocaleString('en-IN')}</span>
            ${mrp > price ? `<span class="hr-deal-mrp">₹${mrp.toLocaleString('en-IN')}</span>` : ''}
          </div>
          ${oos
            ? `<span style="font-size:10px;color:#999">Out of stock</span>`
            : qty === 0
              ? `<button class="hr-add-btn" onclick="VW_SHOP.addToCart(${p.id})">ADD</button>`
              : `<div class="hr-qty-ctrl">
                  <button class="hr-qty-btn" onclick="VW_SHOP.removeFromCart(${p.id})">−</button>
                  <span class="hr-qty-num">${qty}</span>
                  <button class="hr-qty-btn" onclick="VW_SHOP.addToCart(${p.id})">+</button>
                </div>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function homeRunProductCard(p) {
  const price  = p.vwp || p.price || 0;
  const mrp    = p.mrp || 0;
  const disc   = mrp > price && price > 0 ? Math.round((mrp - price) / mrp * 100) : 0;
  const qty    = _shopCart[p.id] || 0;
  const oos    = !p.stock || p.stock <= 0;
  const img    = p.images?.[0] || p.photos?.[0]?.url || p.photos?.[0] || null;
  const cat    = SHOP_CATEGORIES.find(c => c.key === p.category);
  const icon   = cat?.icon || '📦';
  const color  = cat?.color || '#6B7280';

  return `
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;position:relative">
    <div style="height:110px;background:${img ? '#f3f4f6' : color+'18'};display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">
      ${img
        ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`
        : `<span style="font-size:36px">${icon}</span>`}
      ${disc > 0 ? `<div style="position:absolute;top:6px;left:6px;background:#2a7a3b;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px">${disc}% OFF</div>` : ''}
    </div>
    <div style="padding:8px">
      ${p.brand ? `<div style="font-size:9px;color:#888;font-weight:600;margin-bottom:2px">${p.brand}</div>` : ''}
      <div style="font-size:11px;font-weight:700;line-height:1.3;color:#1a1a1a;margin-bottom:4px;min-height:28px">${p.name}</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-bottom:6px">
        <span style="font-size:14px;font-weight:900;color:#1a1a1a">₹${price.toLocaleString('en-IN')}</span>
        <span style="font-size:9px;color:#888">${p.unit||'pc'}</span>
        ${mrp > price ? `<span style="font-size:9px;color:#bbb;text-decoration:line-through">₹${mrp.toLocaleString('en-IN')}</span>` : ''}
      </div>
      ${oos
        ? `<div style="text-align:center;padding:6px;background:#f3f4f6;border-radius:6px;font-size:10px;color:#888">Out of Stock</div>`
        : qty === 0
          ? `<div style="display:flex;align-items:center;justify-content:space-between;border:1.5px solid #2a7a3b;border-radius:8px;overflow:hidden">
              <button onclick="VW_SHOP.addToCart(${p.id})" style="flex:1;padding:7px;background:none;border:none;font-size:11px;font-weight:800;color:#2a7a3b;cursor:pointer">+ Add</button>
              <div style="width:1px;height:30px;background:#2a7a3b;opacity:0.3"></div>
              <div style="width:36px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#2a7a3b;cursor:pointer" onclick="VW_SHOP.addToCart(${p.id})">+</div>
            </div>`
          : `<div style="display:flex;align-items:center;justify-content:space-between;border:1.5px solid #2a7a3b;border-radius:8px;overflow:hidden">
              <button onclick="VW_SHOP.removeFromCart(${p.id})" style="width:32px;height:30px;background:none;border:none;font-size:18px;font-weight:900;color:#2a7a3b;cursor:pointer">−</button>
              <span style="font-size:13px;font-weight:800;color:#1a1a1a">${qty}</span>
              <button onclick="VW_SHOP.addToCart(${p.id})" style="width:32px;height:30px;background:#2a7a3b;border:none;font-size:16px;font-weight:900;color:#fff;cursor:pointer">+</button>
            </div>`}
    </div>
  </div>`;
}

function filterCategory(cat) {
  _shopCategory = cat;
  if (!cat) {
    // Reset to home
    renderShopPage().then(html => {
      const root = document.getElementById('main-content');
      if (root) root.innerHTML = html;
      loadShopProducts(null, '');
    });
    return;
  }

  // Show category page inline — HomeRun style
  const root = document.getElementById('main-content');
  if (!root) { renderShopPage().then(html => { document.getElementById('main-content').innerHTML = html; loadShopProducts(cat, ''); }); return; }

  const catCfg = SHOP_CATEGORIES.find(c => c.key === cat) || { icon:'📦', label: cat, color:'#666' };

  root.innerHTML = `
  <style>
    #shop-root { background: #fff; color: #1a1a1a; margin: -12px -12px 0; min-height: 100vh; }
    .hr-add-btn { background: #2a7a3b; color: #fff; border: none; border-radius: 8px; padding: 7px 18px; font-size: 13px; font-weight: 800; cursor: pointer; }
    .hr-qty-ctrl { display: flex; align-items: center; border: 2px solid #2a7a3b; border-radius: 8px; overflow: hidden; }
    .hr-qty-btn { background: none; border: none; color: #2a7a3b; font-size: 18px; font-weight: 900; cursor: pointer; width: 30px; height: 32px; display: flex; align-items: center; justify-content: center; }
    .hr-qty-num { font-size: 13px; font-weight: 800; color: #1a1a1a; min-width: 20px; text-align: center; }
  </style>
  <div id="shop-root">
    <!-- MINI HEADER -->
    <div style="background:#fff;border-bottom:1px solid #eee;padding:10px 14px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100">
      <button onclick="VW_SHOP.filterCategory(null)" style="background:none;border:none;font-size:20px;cursor:pointer;color:#333;padding:0">←</button>
      <div style="width:36px;height:36px;background:${catCfg.color}18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">${catCfg.icon}</div>
      <div style="flex:1">
        <div style="font-size:16px;font-weight:900;color:#1a1a1a">${catCfg.label}</div>
      </div>
      <button onclick="VW_SHOP.openCart()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#333;position:relative;padding:0">
        🛍 <span id="cat-cart-count" style="position:absolute;top:-4px;right:-4px;background:#2a7a3b;color:#fff;border-radius:50%;width:16px;height:16px;font-size:9px;font-weight:900;display:${Object.values(_shopCart).reduce((a,b)=>a+b,0)>0?'flex':'none'};align-items:center;justify-content:center">${Object.values(_shopCart).reduce((a,b)=>a+b,0)}</span>
      </button>
    </div>

    <!-- SEARCH IN CATEGORY -->
    <div style="padding:10px 14px">
      <div style="display:flex;align-items:center;background:#f3f4f6;border-radius:12px;padding:9px 14px;gap:8px">
        <span style="color:#999;font-size:15px">🔍</span>
        <input type="text" placeholder="Search in ${catCfg.label}..."
          oninput="VW_SHOP.shopSearch(this.value)"
          style="flex:1;background:none;border:none;outline:none;font-size:13px;color:#1a1a1a">
      </div>
    </div>

    <!-- PRODUCT GRID -->
    <div id="shop-products-grid" style="background:#fff;padding:0 12px 20px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="grid-column:1/-1;text-align:center;padding:30px;color:#888;font-size:13px">Loading ${catCfg.label}...</div>
    </div>
  </div>`;

  loadShopProducts(cat, '');
}

function shopSearch(val) {
  _shopSearch = val;
  const container = document.getElementById('shop-products-grid');
  if (container) loadShopProducts(null, val);
}

async function openCart() {
  // Guest login gate — show login prompt before cart
  const prof = VW_AUTH.getCurrentProfile();
  if (!prof) {
    const sheet = document.getElementById('bottom-sheet');
    sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:48px;margin-bottom:12px">🔒</div>
      <h3 style="margin-bottom:6px">Login to view cart</h3>
      <p style="font-size:13px;color:var(--text3);margin-bottom:20px">Create a free account to place orders, track deliveries, and earn loyalty points</p>
      <button onclick="closeSheet();VW_AUTH.showAuthScreen()"
        style="width:100%;padding:13px;border-radius:12px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
        Login / Sign Up — Free
      </button>
      <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:none;border:1px solid var(--border);color:var(--text2);cursor:pointer">Continue browsing</button>
    </div>`;
    sheet.classList.add('open');
    document.getElementById('sheet-overlay').classList.add('open');
    return;
  }

  const productIds = Object.keys(_shopCart).map(Number);
  if (!productIds.length) { showToast('Your cart is empty', 'info'); return; }

  const { data: products } = await VW_DB.client.from('products')
    .select('id,name,brand,price,vwp,mrp,unit,stock')
    .in('id', productIds);

  const prodMap = {};
  (products||[]).forEach(p => { prodMap[p.id] = p; });

  const subtotal = productIds.reduce((sum, id) => {
    const p = prodMap[id];
    const price = p?.vwp || p?.price || 0;
    return sum + price * (_shopCart[id] || 0);
  }, 0);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <h3 style="margin:0">🛒 Your Cart</h3>
    <button onclick="VW_SHOP.clearCart()" style="background:none;border:none;font-size:12px;color:var(--text3);cursor:pointer">Clear all</button>
  </div>

  ${productIds.map(id => {
    const p = prodMap[id];
    const qty = _shopCart[id] || 0;
    const price = p?.vwp || p?.price || 0;
    return p ? `
    <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700">${p.name}</div>
        <div style="font-size:11px;color:var(--text3)">${p.brand||''} · ₹${price.toLocaleString('en-IN')}/${p.unit||'pc'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button onclick="VW_SHOP.removeFromCart(${id});VW_SHOP.openCart()" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:14px">−</button>
        <span style="font-size:14px;font-weight:800;min-width:20px;text-align:center">${qty}</span>
        <button onclick="VW_SHOP.addToCart(${id});VW_SHOP.openCart()" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:14px">+</button>
      </div>
      <div style="font-size:13px;font-weight:800;color:var(--gold);min-width:60px;text-align:right">₹${(price*qty).toLocaleString('en-IN')}</div>
    </div>` : '';
  }).join('')}

  <div style="margin-top:12px;padding:12px;background:var(--bg2);border-radius:10px">
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
      <span style="color:var(--text3)">Subtotal</span><span style="font-weight:700">₹${subtotal.toLocaleString('en-IN')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px">
      <span style="color:var(--text3)">Delivery</span><span style="color:var(--green);font-weight:600">Calculated at checkout</span>
    </div>
  </div>

  <button onclick="VW_SHOP.proceedToCheckout()" style="width:100%;margin-top:12px;padding:14px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    Proceed to Checkout → ₹${subtotal.toLocaleString('en-IN')}
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">
    Continue Shopping
  </button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function clearCart() {
  _shopCart = {};
  _saveCartToSupabase();
  closeSheet();
  showToast('Cart cleared', 'info');
}

async function proceedToCheckout() {
  closeSheet();
  navigateTo('checkout');
}

function openTileQuotation() {
  closeSheet();
  navigateTo('tile_quotes');
  setTimeout(() => VW_TILES.openTileQuotation?.(), 300);
}

async function requestTileSample() {
  // Show tile sample request sheet
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>🏠 Try Tile Sample at Home</h3>
  <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px">
    <div style="font-weight:700;color:#8B5CF6;margin-bottom:6px">How it works:</div>
    <div style="color:var(--text2);line-height:1.6">
      1. Select tiles you want to try<br>
      2. We deliver samples to your site (₹500/tile + transport)<br>
      3. See them in your actual space<br>
      4. Return within 2 hours<br>
      5. Buy → we deduct ₹500/tile from your bill (100% redeemable)
    </div>
  </div>
  <div class="form-group">
    <label>Delivery Address</label>
    <input type="text" id="sample-address" placeholder="Full site address for sample delivery">
  </div>
  <div class="form-group">
    <label>Phone Number</label>
    <input type="tel" id="sample-phone" placeholder="10-digit mobile" maxlength="10">
  </div>
  <div class="form-group">
    <label>Which tiles do you want to try? (tile names / codes)</label>
    <textarea id="sample-tiles" rows="3" placeholder="e.g. 600×1200 White Marble, 300×600 Wood texture..."
      style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px;resize:vertical;box-sizing:border-box"></textarea>
  </div>
  <div style="font-size:11px;color:var(--text3);margin-bottom:12px">
    Available within 15km of our store · Vijayawada only · Subject to stock availability
  </div>
  <button onclick="VW_SHOP.submitSampleRequest()" style="width:100%;padding:13px;border-radius:10px;background:#8B5CF6;border:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer">
    📤 Request Sample Visit
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function submitSampleRequest() {
  const address = document.getElementById('sample-address')?.value?.trim();
  const phone   = document.getElementById('sample-phone')?.value?.trim();
  const tiles   = document.getElementById('sample-tiles')?.value?.trim();

  if (!address || !phone || !tiles) { showToast('Fill in all fields', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();
  await VW_DB.client.from('sample_requests').insert({
    profile_id: prof?.id || null,
    customer_name: prof?.name || '',
    customer_phone: phone,
    delivery_address: { address },
    products: [{ description: tiles }],
    charge_per_pc: 500,
    status: 'pending',
  }).catch(() => {});

  // Notify management + dispatch
  await createPersistedNotification({
    category: 'sample_request',
    title: '🏠 Tile Sample Request',
    body: `${phone} · ${address} · ${tiles}`,
    actions: [{ label: '📞 Call Customer', action: 'call' }],
  }).catch(() => {});

  showToast('Sample request submitted! We will call you within 30 minutes to confirm.', 'success');
  closeSheet();
}

function selectDeliveryAddress() {
  navigateTo('my_addresses');
}

window.VW_SHOP = {
  renderShopPage, loadShopProducts, addToCart, removeFromCart,
  filterCategory, shopSearch, openCart, clearCart,
  proceedToCheckout, openTileQuotation, requestTileSample,
  submitSampleRequest, selectDeliveryAddress,
};

// ═══════════════════════════════════════════════════════════════
// CHECKOUT FLOW
// ═══════════════════════════════════════════════════════════════

const DELIVERY_SLOTS = [
  { id:'slot1', label:'Within 90 minutes', time:'ASAP', surcharge:0, icon:'⚡' },
  { id:'slot2', label:'Today 2pm–5pm',     time:'14:00', surcharge:0, icon:'🌤' },
  { id:'slot3', label:'Today 5pm–8pm',     time:'17:00', surcharge:0, icon:'🌆' },
  { id:'slot4', label:'Tomorrow 10am–1pm', time:'10:00', surcharge:0, icon:'📅' },
  { id:'slot5', label:'Tomorrow 2pm–5pm',  time:'14:00', surcharge:0, icon:'📅' },
];

const VJ_PINCODES = ['520001','520002','520003','520004','520007','520008','520010',
  '520011','520012','520013','520015','521108','521109','521110','521111','521456'];

let _checkoutState = {
  step: 'address',    // address | slot | payment | confirm
  address: null,
  slot: null,
  payMethod: 'wallet',
  deliveryType: 'delivery', // delivery | pickup
  products: [],
  subtotal: 0,
  deliveryCharge: 0,
  total: 0,
};

async function renderCheckoutPage() {
  const prof = VW_AUTH.getCurrentProfile();
  const productIds = Object.keys(_shopCart).map(Number);

  if (!productIds.length) {
    return `<div class="module-header"><h2>Checkout</h2></div>
    <div style="text-align:center;padding:40px">
      <div style="font-size:40px">🛒</div>
      <div style="font-size:14px;font-weight:700;margin:8px 0">Your cart is empty</div>
      <button onclick="navigateTo('shop')" style="padding:10px 20px;background:var(--gold);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Browse Products</button>
    </div>`;
  }

  // Load products
  const { data: products } = await VW_DB.client.from('products')
    .select('id,name,brand,price,vwp,mrp,unit,stock,images').in('id', productIds);
  const prodMap = {};
  (products||[]).forEach(p => prodMap[p.id] = p);

  _checkoutState.products = productIds.map(id => ({
    product_id: id,
    name: prodMap[id]?.name || '',
    brand: prodMap[id]?.brand || '',
    qty: _shopCart[id],
    price: prodMap[id]?.vwp || prodMap[id]?.price || 0,
    unit: prodMap[id]?.unit || 'pc',
  }));
  _checkoutState.subtotal = _checkoutState.products.reduce((s,p) => s + p.price * p.qty, 0);

  // Load saved addresses
  const { data: addresses } = await VW_DB.client.from('customer_addresses')
    .select('*').eq('profile_id', prof?.id || '').order('is_default', { ascending: false });

  return `
  <div class="module-header">
    <button onclick="navigateTo('shop')" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text3)">←</button>
    <h2>Checkout</h2>
  </div>

  <!-- ORDER SUMMARY -->
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">🛒 Order Summary</div>
    ${_checkoutState.products.map(p => `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
      <span style="color:var(--text2)">${p.name} × ${p.qty} ${p.unit}</span>
      <span style="font-weight:700">₹${(p.price*p.qty).toLocaleString('en-IN')}</span>
    </div>`).join('')}
    <div style="border-top:1px solid var(--border2);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-size:13px;font-weight:800">
      <span>Subtotal</span><span style="color:var(--gold)">₹${_checkoutState.subtotal.toLocaleString('en-IN')}</span>
    </div>
  </div>

  <!-- DELIVERY TYPE -->
  <div style="display:flex;gap:8px;margin-bottom:14px">
    <button id="dt-delivery" onclick="VW_SHOP.setDeliveryType('delivery')"
      style="flex:1;padding:12px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;
        border:${_checkoutState.deliveryType==='delivery'?'2px solid var(--gold)':'1px solid var(--border)'};
        background:${_checkoutState.deliveryType==='delivery'?'var(--gold-muted)':'var(--bg2)'}">
      🚚 Home Delivery<br><span style="font-size:10px;font-weight:400;color:var(--text3)">90 min within Vijayawada</span>
    </button>
    <button id="dt-pickup" onclick="VW_SHOP.setDeliveryType('pickup')"
      style="flex:1;padding:12px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;
        border:${_checkoutState.deliveryType==='pickup'?'2px solid var(--gold)':'1px solid var(--border)'};
        background:${_checkoutState.deliveryType==='pickup'?'var(--gold-muted)':'var(--bg2)'}">
      🏪 Store Pickup<br><span style="font-size:10px;font-weight:400;color:var(--text3)">Free · Ready in 30 min</span>
    </button>
  </div>

  ${_checkoutState.deliveryType === 'delivery' ? `
  <!-- DELIVERY ADDRESS -->
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">📍 Delivery Address</div>
    ${(addresses||[]).map(a => `
    <div onclick="VW_SHOP.selectAddress(${a.id})"
      style="padding:10px 12px;border-radius:10px;margin-bottom:8px;cursor:pointer;
        border:${_checkoutState.address?.id===a.id?'2px solid var(--gold)':'1px solid var(--border)'};
        background:${_checkoutState.address?.id===a.id?'var(--gold-muted)':'var(--bg2)'}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700">${a.label} ${a.is_default?'⭐':''}</span>
        ${_checkoutState.address?.id===a.id?'<span style="color:var(--gold);font-size:12px">✓ Selected</span>':''}
      </div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px">${a.address_line1}${a.area?', '+a.area:''}</div>
      <div style="font-size:11px;color:var(--text3)">${a.city} - ${a.pincode||''}</div>
    </div>`).join('')}
    <button onclick="VW_SHOP.addNewAddress()"
      style="width:100%;padding:10px;border-radius:10px;border:1px dashed var(--border);background:none;color:var(--text3);font-size:12px;cursor:pointer">
      + Add New Address
    </button>
    ${_checkoutState.address ? `
    <div style="background:rgba(34,197,94,0.08);border:1px solid var(--green);border-radius:8px;padding:8px;margin-top:8px;font-size:11px;color:var(--green)">
      ✅ Delivering to: ${_checkoutState.address.address_line1}, ${_checkoutState.address.city}
    </div>` : ''}
  </div>` : `
  <!-- PICKUP INFO -->
  <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:4px">🏪 Pickup from Store</div>
    <div style="font-size:11px;color:var(--text3)">1-1-153, NH 65, Bhavanipuram, Vijayawada</div>
    <div style="font-size:11px;color:var(--green);margin-top:4px;font-weight:600">Ready in 30–45 minutes after order</div>
  </div>`}

  <!-- DELIVERY SLOT -->
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">⏰ ${_checkoutState.deliveryType==='delivery'?'Delivery':'Pickup'} Slot</div>
    ${DELIVERY_SLOTS.map(slot => `
    <div onclick="VW_SHOP.selectSlot('${slot.id}')"
      style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:6px;cursor:pointer;
        border:${_checkoutState.slot?.id===slot.id?'2px solid var(--gold)':'1px solid var(--border)'};
        background:${_checkoutState.slot?.id===slot.id?'var(--gold-muted)':'var(--bg2)'}">
      <span style="font-size:20px">${slot.icon}</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:${_checkoutState.slot?.id===slot.id?'var(--gold)':'var(--text)'}">${slot.label}</div>
      </div>
      ${_checkoutState.slot?.id===slot.id?'<span style="color:var(--gold);font-weight:700">✓</span>':''}
    </div>`).join('')}
  </div>

  <!-- LOYALTY POINTS -->
  ${await (async () => {
    const { data: cust } = await VW_DB.client.from('customers')
      .select('loyalty_points').eq('phone', prof?.phone || '').single().catch(() => ({ data: null }));
    const points = cust?.loyalty_points || 0;
    const cfg = await VW_DB.getSetting('loyalty_config', { pointValue:1, maxRedeemPct:10 });
    const maxRedeem = Math.min(points, Math.floor(_checkoutState.subtotal * (cfg.maxRedeemPct||10) / 100 / (cfg.pointValue||1)));
    const redeemValue = Math.floor(maxRedeem * (cfg.pointValue||1));
    if (points < 10) return '';
    return `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;margin-bottom:8px">⭐ Loyalty Points</div>
      <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <div style="font-size:13px;font-weight:700">${points.toLocaleString('en-IN')} points available</div>
            <div style="font-size:11px;color:var(--text3)">= ₹${(points*(cfg.pointValue||1)).toLocaleString('en-IN')} value</div>
          </div>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" id="use-loyalty" onchange="VW_SHOP.toggleLoyaltyRedeem(${maxRedeem},${redeemValue})"
              ${_checkoutState.loyaltyRedeem ? 'checked' : ''}>
            <span style="font-size:12px;font-weight:700">Use points</span>
          </label>
        </div>
        ${_checkoutState.loyaltyRedeem ? `
        <div style="background:rgba(34,197,94,0.08);border-radius:8px;padding:8px;font-size:12px;color:var(--green)">
          ✅ Using ${maxRedeem} points → ₹${redeemValue} discount applied
        </div>` : `
        <div style="font-size:11px;color:var(--text3)">
          Redeem up to ${maxRedeem} points = ₹${redeemValue} off this order
        </div>`}
      </div>
    </div>`;
  })()}

  <!-- PROMO CODE -->
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">🎟 Promo Code</div>
    <div style="display:flex;gap:8px">
      <input type="text" id="promo-code-input" placeholder="Enter code (e.g. WELCOME10)"
        style="flex:1;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:13px;text-transform:uppercase"
        oninput="this.value=this.value.toUpperCase()">
      <button onclick="VW_SHOP.applyPromoCode()"
        style="padding:10px 16px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer">
        Apply
      </button>
    </div>
    <div id="promo-result" style="font-size:12px;margin-top:6px"></div>
  </div>

  <!-- PAYMENT METHOD -->
  <div style="margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">💳 Payment</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      ${[
        { key:'wallet', icon:'👛', label:'VW Wallet' },
        { key:'cod',    icon:'💵', label:'Cash on Delivery' },
        { key:'online', icon:'📱', label:'UPI / Card' },
      ].map(m => `
      <button onclick="VW_SHOP.selectPayment('${m.key}')"
        style="padding:10px 6px;border-radius:10px;cursor:pointer;text-align:center;
          border:${_checkoutState.payMethod===m.key?'2px solid var(--gold)':'1px solid var(--border)'};
          background:${_checkoutState.payMethod===m.key?'var(--gold-muted)':'var(--bg2)'}">
        <div style="font-size:20px;margin-bottom:4px">${m.icon}</div>
        <div style="font-size:10px;font-weight:700;color:${_checkoutState.payMethod===m.key?'var(--gold)':'var(--text)'}">${m.label}</div>
      </button>`).join('')}
    </div>
  </div>

  <!-- TOTAL + PLACE ORDER -->
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
      <span style="color:var(--text3)">Subtotal</span><span>₹${_checkoutState.subtotal.toLocaleString('en-IN')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
      <span style="color:var(--text3)">Delivery</span>
      <span style="color:var(--green)">${_checkoutState.deliveryType==='pickup'?'Free':'₹0 (within Vijayawada)'}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:900;padding:8px 0 0;border-top:1px solid var(--border2);margin-top:6px">
      <span>Total</span><span style="color:var(--gold)">₹${_checkoutState.subtotal.toLocaleString('en-IN')}</span>
    </div>
  </div>

  <button onclick="VW_SHOP.placeOrder()"
    style="width:100%;padding:15px;border-radius:12px;background:var(--gold);border:none;color:#000;font-size:15px;font-weight:900;cursor:pointer">
    ✅ Place Order · ₹${_checkoutState.subtotal.toLocaleString('en-IN')}
  </button>
  <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:8px">
    GST inclusive · All prices shown are final · Delivery within Vijayawada only
  </div>`;
}

function setDeliveryType(type) {
  _checkoutState.deliveryType = type;
  navigateTo('checkout');
}

function selectAddress(id) {
  VW_DB.client.from('customer_addresses').select('*').eq('id', id).single()
    .then(({ data }) => {
      _checkoutState.address = data;
      navigateTo('checkout');
    });
}

function selectSlot(slotId) {
  _checkoutState.slot = DELIVERY_SLOTS.find(s => s.id === slotId);
  navigateTo('checkout');
}

function selectPayment(method) {
  _checkoutState.payMethod = method;
  navigateTo('checkout');
}

function addNewAddress() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>📍 Add Delivery Address</h3>
  <div class="form-group">
    <label>Label</label>
    <div style="display:flex;gap:8px">
      ${['Home','Work','Site','Other'].map(l => `
      <button id="lbl-${l}" onclick="selectAddrLabel('${l}')"
        style="flex:1;padding:7px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;
          border:${l==='Home'?'2px solid var(--gold)':'1px solid var(--border)'};
          background:${l==='Home'?'var(--gold-muted)':'var(--bg2)'}">
        ${l}
      </button>`).join('')}
    </div>
  </div>
  <div class="form-group">
    <label>Full Address *</label>
    <input type="text" id="addr-line1" placeholder="House/Flat no, Street name">
  </div>
  <div class="form-group">
    <label>Area / Locality</label>
    <input type="text" id="addr-area" placeholder="e.g. Bhavanipuram, Kanuru">
  </div>
  <div class="form-group">
    <label>Pincode *</label>
    <input type="text" id="addr-pin" placeholder="6-digit pincode" maxlength="6" inputmode="numeric"
      oninput="checkPincode(this.value)">
    <div id="pincode-msg" style="font-size:11px;margin-top:4px"></div>
  </div>
  <div class="form-group">
    <label>Phone for delivery</label>
    <input type="tel" id="addr-phone" placeholder="10-digit mobile" maxlength="10">
  </div>
  <label style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:14px;cursor:pointer">
    <input type="checkbox" id="addr-default"> Set as default address
  </label>
  <button onclick="VW_SHOP.saveAddress()" style="width:100%;padding:13px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    Save Address
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  const s = document.createElement('script');
  s.textContent = `
    window._addrLabel = 'Home';
    window.selectAddrLabel = function(l) {
      window._addrLabel = l;
      ['Home','Work','Site','Other'].forEach(x => {
        const b = document.getElementById('lbl-'+x);
        if(b){b.style.borderColor=x===l?'var(--gold)':'var(--border)';b.style.background=x===l?'var(--gold-muted)':'var(--bg2)';}
      });
    };
    window.checkPincode = function(pin) {
      const msg = document.getElementById('pincode-msg');
      if (!msg) return;
      const valid = ['520001','520002','520003','520004','520007','520008','520010','520011','520012','520013','520015','521108','521109','521110','521111','521456'];
      if (pin.length === 6) {
        msg.textContent = valid.includes(pin) ? '✅ Delivery available in your area' : '⚠️ Delivery not available for this pincode yet';
        msg.style.color = valid.includes(pin) ? 'var(--green)' : 'var(--red)';
      }
    };
  `;
  document.body.appendChild(s);
}

async function saveAddress() {
  const line1 = document.getElementById('addr-line1')?.value?.trim();
  const area  = document.getElementById('addr-area')?.value?.trim();
  const pin   = document.getElementById('addr-pin')?.value?.trim();
  const phone = document.getElementById('addr-phone')?.value?.trim();
  const isDefault = document.getElementById('addr-default')?.checked;

  if (!line1 || !pin) { showToast('Fill address and pincode', 'warn'); return; }
  if (!VJ_PINCODES.includes(pin)) { showToast('Delivery not available for this pincode', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();
  if (isDefault) {
    await VW_DB.client.from('customer_addresses')
      .update({ is_default: false }).eq('profile_id', prof?.id || '').catch(() => {});
  }

  const { data: addr } = await VW_DB.client.from('customer_addresses').insert({
    profile_id: prof?.id || null,
    label: window._addrLabel || 'Home',
    address_line1: line1,
    area: area || null,
    city: 'Vijayawada',
    pincode: pin,
    phone: phone || null,
    is_default: isDefault,
  }).select('*').single();

  _checkoutState.address = addr;
  closeSheet();
  showToast('Address saved ✅', 'success');
  navigateTo('checkout');
}

async function placeOrder() {
  const { deliveryType, address, slot, payMethod, products, subtotal } = _checkoutState;

  if (deliveryType === 'delivery' && !address) {
    showToast('Please select a delivery address', 'warn'); return;
  }
  if (!slot) { showToast('Please select a delivery slot', 'warn'); return; }
  if (!products.length) { showToast('Cart is empty', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();
  const btn = document.querySelector('[onclick="VW_SHOP.placeOrder()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing order...'; }

  try {
    // For online payment — create Cashfree order first
    if (payMethod === 'online') {
      const cfRes = await fetch(
        'https://ndamdnlsuktucqtcbhgp.supabase.co/functions/v1/cashfree-order',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
            'apikey': VW_DB.client.supabaseKey },
          body: JSON.stringify({
            order_id: `TEMP_${Date.now()}`,
            order_amount: subtotal,
            customer_name: prof?.name || '',
            customer_phone: prof?.phone || '',
          }),
        }
      );
      const cfData = await cfRes.json();
      if (cfData.error) throw new Error('Payment init failed: ' + cfData.error);
      // Load Cashfree JS SDK dynamically
      if (!window.Cashfree) {
        const cfScript = document.createElement('script');
        cfScript.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        document.head.appendChild(cfScript);
        await new Promise(res => { cfScript.onload = res; });
      }
      const cashfreeObj = window.Cashfree({ mode: 'sandbox' });
      cashfreeObj.checkout({
        paymentSessionId: cfData.payment_session_id,
        returnUrl: window.location.href + '?cf_order=' + cfData.cf_order_id,
      });
      if (btn) { btn.disabled = false; btn.textContent = `✅ Place Order · ₹${subtotal.toLocaleString('en-IN')}`; }
      return;
    }
    // For wallet payment — check balance first
    if (payMethod === 'wallet') {
      const { data: wallet } = await VW_DB.client.from('customer_wallets')
        .select('balance').eq('profile_id', prof?.id || '').single().catch(() => ({ data: null }));
      const bal = parseFloat(wallet?.balance || 0);
      if (bal < subtotal) {
        showToast(`Insufficient wallet balance. Available: ₹${bal.toLocaleString('en-IN')} · Required: ₹${subtotal.toLocaleString('en-IN')}`, 'warn');
        if (btn) { btn.disabled = false; btn.textContent = `✅ Place Order · ₹${subtotal.toLocaleString('en-IN')}`; }
        return;
      }
    }

    // Create order
    const { data: order, error } = await VW_DB.client.from('orders').insert({
      profile_id: prof?.id || null,
      customer_name: prof?.name || '',
      customer_phone: prof?.phone || '',
      delivery_address: deliveryType === 'delivery' ? address : { label: 'Store Pickup', address_line1: '1-1-153, NH 65, Bhavanipuram, Vijayawada' },
      items: products,
      subtotal: subtotal,
      delivery_charge: 0,
      total: subtotal,
      payment_method: payMethod,
      payment_status: payMethod === 'cod' ? 'pending' : 'pending',
      delivery_type: deliveryType,
      delivery_slot: slot?.label,
      status: 'placed',
    }).select('id,order_no').single();

    if (error) throw new Error(error.message);

    // Deduct from wallet if wallet payment
    if (payMethod === 'wallet') {
      const { data: wallet } = await VW_DB.client.from('customer_wallets')
        .select('id,balance,total_spent').eq('profile_id', prof?.id || '').single().catch(() => ({ data: null }));
      if (wallet) {
        const newBal = parseFloat(wallet.balance) - subtotal;
        await VW_DB.client.from('customer_wallets').update({
          balance: newBal,
          total_spent: parseFloat(wallet.total_spent || 0) + subtotal,
          last_activity_at: new Date().toISOString(),
        }).eq('id', wallet.id);
        await VW_DB.client.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          type: 'purchase',
          amount: subtotal,
          balance_after: newBal,
          description: `Order ${order.order_no}`,
          reference_type: 'order',
          reference_id: order.id,
          payment_method: 'wallet',
        });
      }
    }

    // Clear cart
    _shopCart = {};
    await VW_DB.client.from('carts').upsert({
      profile_id: prof?.id, items: [], updated_at: new Date().toISOString()
    }, { onConflict: 'profile_id' }).catch(() => {});

    // Award loyalty points (1 point per ₹100 spent by default)
    const loyaltyCfg = await VW_DB.getSetting('loyalty_config', { earnRate: 1, pointValue: 1 });
    const pointsEarned = Math.floor((subtotal - (_checkoutState.promoDiscount||0)) / 100 * (loyaltyCfg.earnRate || 1));
    if (pointsEarned > 0 && prof?.phone) {
      await VW_DB.client.from('customers')
        .update({ loyalty_points: VW_DB.client.rpc('increment_loyalty', { p_phone: prof.phone, p_points: pointsEarned }) })
        .eq('phone', prof.phone).catch(() => {});
    }

    // Increment promo code used_count if one was applied
    if (_checkoutState.promoCode) {
      await VW_DB.client.from('promo_codes')
        .update({ used_count: VW_DB.client.rpc('increment_count', {}) })
        .eq('code', _checkoutState.promoCode).catch(async () => {
          // Fallback: manual increment
          const { data: pc } = await VW_DB.client.from('promo_codes')
            .select('used_count').eq('code', _checkoutState.promoCode).single().catch(() => ({ data: null }));
          if (pc) await VW_DB.client.from('promo_codes')
            .update({ used_count: (pc.used_count || 0) + 1 }).eq('code', _checkoutState.promoCode).catch(() => {});
        });
      _checkoutState.promoCode = null;
      _checkoutState.promoDiscount = 0;
    }

    // Notify store
    await createPersistedNotification({
      category: 'new_order',
      title: `🛒 New Order — ${order.order_no}`,
      body: `${prof?.name||''} · ₹${subtotal.toLocaleString('en-IN')} · ${deliveryType==='pickup'?'Pickup':'Delivery to '+address?.area}`,
      actions: [{ label: '👁 View Order', action: 'open_order' }],
    }).catch(() => {});

    // Show success
    showOrderConfirmation(order.order_no, subtotal, deliveryType, slot);

  } catch(e) {
    showToast('Order failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = `✅ Place Order · ₹${subtotal.toLocaleString('en-IN')}`; }
  }
}

function showOrderConfirmation(orderNo, total, deliveryType, slot) {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
  <div style="text-align:center;padding:40px 20px">
    <div style="font-size:60px;margin-bottom:16px">🎉</div>
    <h2 style="margin-bottom:8px">Order Placed!</h2>
    <div style="font-size:16px;font-weight:900;color:var(--gold);margin-bottom:6px">${orderNo}</div>
    <div style="font-size:14px;color:var(--text2);margin-bottom:4px">₹${total.toLocaleString('en-IN')}</div>
    <div style="font-size:13px;color:var(--text3);margin-bottom:24px">
      ${deliveryType==='pickup'?'Ready for pickup in 30–45 minutes':'Expected: '+slot?.label}
    </div>
    <div style="background:var(--bg2);border-radius:12px;padding:16px;margin-bottom:20px;text-align:left">
      <div style="font-size:12px;font-weight:700;margin-bottom:8px">What happens next:</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.8">
        ✅ Order confirmed<br>
        📦 Items being picked & packed<br>
        ${deliveryType==='pickup'?'🏪 Come collect from store':'🚚 Out for delivery soon'}<br>
        📞 Our team will call if needed
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button onclick="navigateTo('my_orders')" style="padding:12px 20px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer">
        📋 Track Order
      </button>
      <button onclick="navigateTo('shop')" style="padding:12px 20px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);font-size:13px;cursor:pointer">
        🛒 Shop More
      </button>
    </div>
    <div style="margin-top:16px;font-size:11px;color:var(--text3)">
      Questions? Call us: <a href="tel:8712697930" style="color:var(--gold)">8712697930</a>
    </div>
  </div>`;
}

async function renderMyOrdersPage() {
  const prof = VW_AUTH.getCurrentProfile();
  const { data: orders } = await VW_DB.client.from('orders')
    .select('id,order_no,items,total,status,delivery_type,delivery_slot,placed_at,delivery_address')
    .eq('profile_id', prof?.id || '')
    .order('placed_at', { ascending: false })
    .limit(20);

  const statusConfig = {
    placed:             { label:'⏳ Order Placed',         color:'var(--gold)' },
    confirmed:          { label:'✅ Confirmed',             color:'var(--green)' },
    picking:            { label:'📦 Picking & Packing',    color:'#60A5FA' },
    out_for_delivery:   { label:'🚚 Out for Delivery',     color:'#8B5CF6' },
    delivered:          { label:'✓ Delivered',             color:'var(--green)' },
    cancelled:          { label:'Cancelled',               color:'var(--red)' },
  };

  return `
  <div class="module-header"><h2>📋 My Orders</h2></div>
  ${!(orders?.length) ? `
  <div style="text-align:center;padding:40px">
    <div style="font-size:40px">📦</div>
    <div style="font-size:14px;font-weight:700;margin:8px 0">No orders yet</div>
    <button onclick="navigateTo('shop')" style="padding:10px 20px;background:var(--gold);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Start Shopping</button>
  </div>` :
  orders.map(o => {
    const sc = statusConfig[o.status] || { label: o.status, color:'var(--text3)' };
    const itemCount = (o.items||[]).reduce((s,i) => s+(i.qty||1), 0);
    return `
    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:800">${o.order_no}</div>
          <div style="font-size:11px;color:var(--text3)">${new Date(o.placed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(245,200,66,0.1);color:${sc.color}">${sc.label}</span>
      </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:800">${o.order_no}</div>
          <div style="font-size:11px;color:var(--text3)">${new Date(o.placed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(245,200,66,0.1);color:${sc.color}">${sc.label}</span>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${itemCount} item${itemCount>1?'s':''} · ₹${parseFloat(o.total||0).toLocaleString('en-IN')}</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">${o.delivery_type==='pickup'?'🏪 Store Pickup':'🚚 '+( o.delivery_address?.area||o.delivery_address?.address_line1||'Home delivery')} · ${o.delivery_slot||''}</div>
      <button onclick="navigateTo('track_order',{id:${o.id}})"
        style="width:100%;padding:8px;border-radius:8px;background:var(--bg3);border:1px solid var(--border);color:var(--text);font-size:12px;font-weight:600;cursor:pointer">
        📍 Track Order
      </button>
    </div>`;
  }).join('')}`;
}

// Expose new checkout functions on VW_SHOP
window.VW_SHOP.renderCheckoutPage = renderCheckoutPage;
window.VW_SHOP.setDeliveryType = setDeliveryType;
window.VW_SHOP.selectAddress = selectAddress;
window.VW_SHOP.selectSlot = selectSlot;
window.VW_SHOP.selectPayment = selectPayment;
window.VW_SHOP.addNewAddress = addNewAddress;
window.VW_SHOP.saveAddress = saveAddress;
window.VW_SHOP.placeOrder = placeOrder;
window.VW_SHOP.renderMyOrdersPage = renderMyOrdersPage;

// ═══════════════════════════════════════════════════════════════
// ORDER MANAGEMENT — Staff Dashboard
// ═══════════════════════════════════════════════════════════════

const ORDER_STATUS_FLOW = {
  placed:           { label:'⏳ Placed',           next:'confirmed',         color:'var(--gold)',    action:'Confirm Order' },
  confirmed:        { label:'✅ Confirmed',          next:'picking',           color:'var(--green)',   action:'Start Picking' },
  picking:          { label:'📦 Picking & Packing', next:'out_for_delivery',  color:'#60A5FA',       action:'Mark Ready / Out' },
  out_for_delivery: { label:'🚚 Out for Delivery',  next:'delivered',         color:'#8B5CF6',       action:'Mark Delivered' },
  delivered:        { label:'✓ Delivered',           next:null,               color:'var(--green)',   action:null },
  cancelled:        { label:'✗ Cancelled',           next:null,               color:'var(--red)',     action:null },
};

async function renderOrdersDashboard() {
  const searchQ = window._ordersSearch || '';
  const dateFilter = window._ordersDate || '';

  let query = VW_DB.client
    .from('orders')
    .select('id,order_no,customer_name,customer_phone,items,total,status,delivery_type,delivery_slot,placed_at,delivery_address,payment_method,payment_status')
    .not('status','in','("delivered","cancelled")')
    .order('placed_at', { ascending: true })
    .limit(50);

  if (searchQ) {
    query = VW_DB.client.from('orders')
      .select('id,order_no,customer_name,customer_phone,items,total,status,delivery_type,delivery_slot,placed_at,delivery_address,payment_method,payment_status')
      .or(`order_no.ilike.%${searchQ}%,customer_name.ilike.%${searchQ}%,customer_phone.ilike.%${searchQ}%`)
      .order('placed_at', { ascending: false })
      .limit(30);
  } else if (dateFilter) {
    const start = new Date(dateFilter); start.setHours(0,0,0,0);
    const end   = new Date(dateFilter); end.setHours(23,59,59,999);
    query = VW_DB.client.from('orders')
      .select('id,order_no,customer_name,customer_phone,items,total,status,delivery_type,delivery_slot,placed_at,delivery_address,payment_method,payment_status')
      .gte('placed_at', start.toISOString())
      .lte('placed_at', end.toISOString())
      .order('placed_at', { ascending: false })
      .limit(50);
  }

  const { data: orders } = await query;

  const { data: recentDone } = !searchQ && !dateFilter ? await VW_DB.client
    .from('orders')
    .select('id,order_no,customer_name,total,status,delivered_at')
    .in('status',['delivered','cancelled'])
    .order('placed_at', { ascending: false })
    .limit(10) : { data: [] };

  const statCounts = {};
  (orders||[]).forEach(o => { statCounts[o.status] = (statCounts[o.status]||0)+1; });

  return `
  <div class="module-header">
    <h2>🛒 Orders</h2>
    <button onclick="navigateTo('orders')" style="background:none;border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer">🔄</button>
  </div>

  <!-- SEARCH + DATE FILTER -->
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <input type="text" id="orders-search" placeholder="Search by name, phone, order no..."
      value="${searchQ}"
      oninput="window._ordersSearch=this.value;clearTimeout(window._ordersSearchTimer);window._ordersSearchTimer=setTimeout(()=>navigateTo('orders'),400)"
      style="flex:1;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px">
    <input type="date" id="orders-date"
      value="${dateFilter}"
      onchange="window._ordersDate=this.value;navigateTo('orders')"
      style="padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px;width:130px">
    ${(searchQ||dateFilter) ? `<button onclick="window._ordersSearch='';window._ordersDate='';document.getElementById('orders-search').value='';navigateTo('orders')" style="padding:8px;border-radius:8px;background:var(--bg2);border:1px solid var(--border);font-size:12px;cursor:pointer">✕ Clear</button>` : ''}
  </div>

  ${!searchQ && !dateFilter ? `
  <!-- STAT PILLS -->
  <div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:14px;padding-bottom:4px">
    ${Object.entries(ORDER_STATUS_FLOW).filter(([k])=>k!=='delivered'&&k!=='cancelled').map(([status,cfg]) => `
    <div style="flex:0 0 auto;background:var(--bg2);border-radius:10px;padding:8px 14px;text-align:center;min-width:80px">
      <div style="font-size:20px;font-weight:900;color:${cfg.color}">${statCounts[status]||0}</div>
      <div style="font-size:10px;color:var(--text3);white-space:nowrap">${cfg.label.replace(/[⏳✅📦🚚✓✗]/g,'').trim()}</div>
    </div>`).join('')}
  </div>` : ''}

  <!-- ORDERS -->
  ${!(orders?.length) ? `
  <div style="text-align:center;padding:30px;color:var(--text3)">
    <div style="font-size:32px">📭</div>
    <div style="font-size:13px;margin-top:8px">${searchQ||dateFilter ? 'No orders match your search' : 'No active orders right now'}</div>
  </div>` :
  orders.map(o => renderOrderCard(o)).join('')}

  ${recentDone?.length && !searchQ && !dateFilter ? `
  <div style="font-size:12px;font-weight:700;color:var(--text3);margin:16px 0 8px;text-transform:uppercase;letter-spacing:.05em">Recent Completed</div>
  ${recentDone.map(o => `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2);font-size:12px">
    <div>
      <span style="font-weight:700">${o.order_no}</span>
      <span style="color:var(--text3);margin-left:6px">${o.customer_name}</span>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <span style="color:var(--gold);font-weight:700">₹${parseFloat(o.total||0).toLocaleString('en-IN')}</span>
      <span style="font-size:10px;color:${o.status==='delivered'?'var(--green)':'var(--red)'}">${o.status==='delivered'?'✓ Done':'✗ Cancelled'}</span>
    </div>
  </div>`).join('')}` : ''}`;
}

function renderOrderCard(o) {
  const sc = ORDER_STATUS_FLOW[o.status] || { label:o.status, color:'var(--text3)', action:null };
  const itemCount = (o.items||[]).reduce((s,i)=>s+(i.qty||1),0);
  const addr = o.delivery_address;
  const isPickup = o.delivery_type === 'pickup';

  return `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:10px;border-left:4px solid ${sc.color}">
    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:14px;font-weight:900">${o.order_no}</div>
        <div style="font-size:12px;font-weight:700;margin-top:1px">${o.customer_name}</div>
        <div style="font-size:11px;color:var(--text3)">${o.customer_phone}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;color:${sc.color};background:${sc.color}15;padding:3px 8px;border-radius:20px;margin-bottom:4px">${sc.label}</div>
        <div style="font-size:14px;font-weight:900;color:var(--gold)">₹${parseFloat(o.total||0).toLocaleString('en-IN')}</div>
      </div>
    </div>

    <!-- ORDER DETAILS -->
    <div style="background:var(--bg3);border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="color:var(--text3)">${itemCount} item${itemCount>1?'s':''}</span>
        <span style="font-weight:700;color:${o.payment_status==='paid'?'var(--green)':'var(--gold)'}">${o.payment_method?.toUpperCase()} · ${o.payment_status==='paid'?'✓ Paid':'Pending'}</span>
      </div>
      <div style="color:var(--text2)">
        ${isPickup ? '🏪 Store Pickup' : `🚚 ${addr?.address_line1||''}, ${addr?.area||addr?.city||''}`}
      </div>
      <div style="color:var(--text3);margin-top:2px">⏰ ${o.delivery_slot||'—'}</div>
    </div>

    <!-- ITEMS -->
    <div style="margin-bottom:8px">
      ${(o.items||[]).slice(0,3).map(i =>
        `<div style="font-size:11px;color:var(--text2);padding:2px 0">${i.name} × ${i.qty} ${i.unit||'pc'} — ₹${((i.price||0)*(i.qty||1)).toLocaleString('en-IN')}</div>`
      ).join('')}
      ${(o.items||[]).length > 3 ? `<div style="font-size:10px;color:var(--text3)">+${o.items.length-3} more items</div>` : ''}
    </div>

    <!-- ACTIONS -->
    <div style="display:flex;gap:8px">
      ${sc.action ? `
      <button onclick="VW_SHOP.updateOrderStatus('${o.id}','${sc.next}')"
        style="flex:2;padding:10px;border-radius:8px;background:${sc.color};border:none;color:${sc.color==='var(--gold)'?'#000':'#fff'};font-size:12px;font-weight:700;cursor:pointer">
        ${sc.action}
      </button>` : ''}
      <button onclick="VW_SHOP.callCustomer('${o.customer_phone}')"
        style="flex:1;padding:10px;border-radius:8px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25d366;font-size:12px;font-weight:700;cursor:pointer">
        📞 Call
      </button>
      <button onclick="VW_SHOP.cancelOrder('${o.id}')"
        style="flex:0 0 auto;padding:10px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:var(--red);font-size:12px;cursor:pointer">
        ✗
      </button>
    </div>
  </div>`;
}

async function updateOrderStatus(orderId, newStatus) {
  const update = { status: newStatus };
  if (newStatus === 'delivered') update.delivered_at = new Date().toISOString();
  if (newStatus === 'confirmed') update.confirmed_at = new Date().toISOString();

  await VW_DB.client.from('orders').update(update).eq('id', orderId);

  // Notify customer
  const { data: o } = await VW_DB.client.from('orders')
    .select('order_no,profile_id,customer_name,delivery_slot').eq('id', orderId).single();

  const msgs = {
    confirmed:        `✅ Your order ${o?.order_no} is confirmed and being prepared!`,
    picking:          `📦 ${o?.order_no} is being picked & packed. Ready soon!`,
    out_for_delivery: `🚚 ${o?.order_no} is on the way! Expected: ${o?.delivery_slot||'shortly'}`,
    delivered:        `✓ ${o?.order_no} delivered. Thank you for shopping at V Wholesale! 🙏`,
  };

  if (o?.profile_id && msgs[newStatus]) {
    // In-app notification
    await createPersistedNotification({
      category: 'order_update',
      title: 'V Wholesale · Order Update',
      body: msgs[newStatus],
      recipientId: o.profile_id,
      relatedTable: 'orders',
      relatedId: orderId,
    }).catch(() => {});
    // Web push — works when app is closed
    fetch('https://ndamdnlsuktucqtcbhgp.supabase.co/functions/v1/web-push', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey': VW_DB.client.supabaseKey },
      body: JSON.stringify({ profile_id: o.profile_id, title: 'V Wholesale · Order Update', body: msgs[newStatus] }),
    }).catch(() => {});
  }

  showToast(`Order marked as ${newStatus}`, 'success');
  navigateTo('orders');
}

function callCustomer(phone) {
  window.open(`tel:${phone}`, '_self');
}

async function cancelOrder(orderId) {
  const reason = prompt('Reason for cancellation?');
  if (!reason) return;

  const { data: o } = await VW_DB.client.from('orders')
    .select('total,payment_method,profile_id,order_no').eq('id', orderId).single();

  await VW_DB.client.from('orders').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason,
  }).eq('id', orderId);

  // Refund to wallet if paid by wallet
  if (o?.payment_method === 'wallet' && o?.profile_id) {
    const { data: wallet } = await VW_DB.client.from('customer_wallets')
      .select('id,balance').eq('profile_id', o.profile_id).single().catch(() => ({ data: null }));
    if (wallet) {
      const newBal = parseFloat(wallet.balance) + parseFloat(o.total || 0);
      await VW_DB.client.from('customer_wallets').update({ balance: newBal }).eq('id', wallet.id);
      await VW_DB.client.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'refund',
        amount: o.total,
        balance_after: newBal,
        description: `Refund — Order ${o.order_no} cancelled`,
        reference_type: 'order',
        reference_id: orderId,
      });
    }
  }

  // Notify customer
  if (o?.profile_id) {
    await createPersistedNotification({
      category: 'order_cancelled',
      title: `Order Cancelled — ${o.order_no}`,
      body: `Your order has been cancelled. ${o.payment_method==='wallet'?'Amount refunded to your VW Wallet.':''}`,
      recipientId: o.profile_id,
    }).catch(() => {});
  }

  showToast('Order cancelled' + (o?.payment_method==='wallet'?' · Refund processed':''), 'success');
  navigateTo('orders');
}

// Expose
window.VW_SHOP.renderOrdersDashboard = renderOrdersDashboard;
window.VW_SHOP.updateOrderStatus = updateOrderStatus;
window.VW_SHOP.callCustomer = callCustomer;
window.VW_SHOP.cancelOrder = cancelOrder;

// ═══════════════════════════════════════════════════════════════
// MY ADDRESSES PAGE
// ═══════════════════════════════════════════════════════════════

async function renderMyAddressesPage() {
  const prof = VW_AUTH.getCurrentProfile();
  const { data: addresses } = await VW_DB.client
    .from('customer_addresses')
    .select('*')
    .eq('profile_id', prof?.id || '')
    .order('is_default', { ascending: false });

  return `
  <div class="module-header">
    <h2>📍 My Addresses</h2>
    <button onclick="VW_SHOP.addNewAddress()" style="background:var(--gold);border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;color:#000">+ Add</button>
  </div>

  ${!(addresses?.length) ? `
  <div style="text-align:center;padding:40px">
    <div style="font-size:40px">📍</div>
    <div style="font-size:14px;font-weight:700;margin:8px 0">No addresses saved</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Add your delivery address to checkout faster</div>
    <button onclick="VW_SHOP.addNewAddress()" style="padding:10px 20px;background:var(--gold);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">+ Add Address</button>
  </div>` :
  addresses.map(a => `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:10px;border:${a.is_default?'2px solid var(--gold)':'1px solid var(--border)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:13px;font-weight:700">${a.label}</span>
        ${a.is_default ? '<span style="font-size:10px;background:var(--gold-muted);color:var(--gold);padding:2px 7px;border-radius:10px;font-weight:700">Default</span>' : ''}
      </div>
      <div style="display:flex;gap:8px">
        ${!a.is_default ? `<button onclick="VW_SHOP.setDefaultAddress(${a.id})" style="background:none;border:none;font-size:11px;color:var(--text3);cursor:pointer">Set default</button>` : ''}
        <button onclick="VW_SHOP.deleteAddress(${a.id})" style="background:none;border:none;font-size:11px;color:var(--red);cursor:pointer">Delete</button>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text2)">${a.address_line1}</div>
    ${a.area ? `<div style="font-size:12px;color:var(--text3)">${a.area}</div>` : ''}
    <div style="font-size:12px;color:var(--text3)">${a.city} - ${a.pincode||''}</div>
    ${a.phone ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">📞 ${a.phone}</div>` : ''}
  </div>`).join('')}`;
}

async function setDefaultAddress(id) {
  const prof = VW_AUTH.getCurrentProfile();
  await VW_DB.client.from('customer_addresses')
    .update({ is_default: false }).eq('profile_id', prof?.id || '');
  await VW_DB.client.from('customer_addresses')
    .update({ is_default: true }).eq('id', id);
  showToast('Default address updated', 'success');
  navigateTo('my_addresses');
}

async function deleteAddress(id) {
  if (!confirm('Delete this address?')) return;
  await VW_DB.client.from('customer_addresses').delete().eq('id', id);
  showToast('Address deleted', 'info');
  navigateTo('my_addresses');
}

window.VW_SHOP.renderMyAddressesPage = renderMyAddressesPage;
window.VW_SHOP.setDefaultAddress = setDefaultAddress;
window.VW_SHOP.deleteAddress = deleteAddress;

// ═══════════════════════════════════════════════════════════════
// ORDER TRACKING — Customer view with visual progress
// ═══════════════════════════════════════════════════════════════

async function renderOrderTrackingPage(orderId) {
  const prof = VW_AUTH.getCurrentProfile();

  // Get order — allow viewing by profile_id or order_no
  let query = VW_DB.client.from('orders').select('*');
  if (orderId) {
    query = isNaN(orderId)
      ? query.eq('order_no', orderId)
      : query.eq('id', orderId);
  } else {
    // Show most recent order
    query = query.eq('profile_id', prof?.id || '').order('placed_at', { ascending: false }).limit(1);
  }
  const { data: orders } = await query.limit(1);
  const o = Array.isArray(orders) ? orders[0] : orders;

  if (!o) return `
  <div class="module-header"><h2>Track Order</h2></div>
  <div style="text-align:center;padding:40px;color:var(--text3)">
    <div style="font-size:40px">📦</div>
    <div style="margin-top:8px">Order not found</div>
    <button onclick="navigateTo('my_orders')" style="margin-top:16px;padding:10px 20px;background:var(--gold);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">My Orders</button>
  </div>`;

  const steps = [
    { status:'placed',           icon:'✅', label:'Order Placed',      time: o.placed_at },
    { status:'confirmed',        icon:'📋', label:'Confirmed',         time: o.confirmed_at },
    { status:'picking',          icon:'📦', label:'Picking & Packing', time: null },
    { status:'out_for_delivery', icon:'🚚', label: o.delivery_type==='pickup'?'Ready for Pickup':'Out for Delivery', time: null },
    { status:'delivered',        icon:'🎉', label: o.delivery_type==='pickup'?'Picked Up':'Delivered', time: o.delivered_at },
  ];

  const statusOrder = ['placed','confirmed','picking','out_for_delivery','delivered'];
  const currentIdx = statusOrder.indexOf(o.status);
  const isCancelled = o.status === 'cancelled';

  const addr = o.delivery_address;
  const itemCount = (o.items||[]).reduce((s,i)=>s+(i.qty||1),0);

  return `
  <div class="module-header">
    <button onclick="navigateTo('my_orders')" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text3)">←</button>
    <h2>Track Order</h2>
  </div>

  <!-- ORDER HEADER -->
  <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:16px;font-weight:900">${o.order_no}</div>
        <div style="font-size:12px;color:var(--text3)">${new Date(o.placed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:900;color:var(--gold)">₹${parseFloat(o.total||0).toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:${o.payment_status==='paid'?'var(--green)':'var(--gold)'}">${o.payment_method?.toUpperCase()} · ${o.payment_status==='paid'?'Paid':'Pending'}</div>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text2)">${itemCount} item${itemCount>1?'s':''}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:3px">
      ${o.delivery_type==='pickup'?'🏪 Store Pickup · 1-1-153 NH65 Bhavanipuram':'🚚 '+( addr?.address_line1||'')+', '+(addr?.area||addr?.city||'')}
    </div>
    <div style="font-size:11px;color:var(--text3)">⏰ ${o.delivery_slot||'—'}</div>
  </div>

  ${isCancelled ? `
  <!-- CANCELLED -->
  <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-bottom:14px;text-align:center">
    <div style="font-size:32px;margin-bottom:8px">❌</div>
    <div style="font-size:14px;font-weight:700;color:var(--red)">Order Cancelled</div>
    ${o.cancellation_reason ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">Reason: ${o.cancellation_reason}</div>` : ''}
    ${o.payment_method==='wallet' ? '<div style="font-size:12px;color:var(--green);margin-top:6px;font-weight:600">✓ Amount refunded to VW Wallet</div>' : ''}
  </div>` : `

  <!-- PROGRESS TRACKER -->
  <div style="background:var(--bg2);border-radius:12px;padding:16px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:16px">Order Progress</div>
    ${steps.map((step, idx) => {
      const done = idx <= currentIdx;
      const active = idx === currentIdx;
      const isLast = idx === steps.length - 1;
      return `
      <div style="display:flex;gap:12px;align-items:flex-start${isLast?'':';margin-bottom:0'}">
        <!-- ICON + LINE -->
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;
            background:${done?'var(--gold)':active?'var(--gold-muted)':'var(--bg3)'};
            border:${active?'2px solid var(--gold)':done?'none':'1px solid var(--border)'};
            ${active?'box-shadow:0 0 0 4px rgba(245,200,66,0.15)':''}">
            ${done?step.icon:'<span style="font-size:12px;color:var(--text3)">'+(idx+1)+'</span>'}
          </div>
          ${!isLast ? `<div style="width:2px;height:24px;margin:4px 0;background:${idx<currentIdx?'var(--gold)':'var(--border)'}"></div>` : ''}
        </div>
        <!-- LABEL -->
        <div style="padding-top:8px;padding-bottom:${isLast?'0':'20px'}">
          <div style="font-size:13px;font-weight:${active?'800':done?'600':'400'};color:${active?'var(--gold)':done?'var(--text)':'var(--text3)'}">
            ${step.label}
          </div>
          ${step.time ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${new Date(step.time).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
          ${active && o.status !== 'delivered' ? '<div style="font-size:11px;color:var(--gold);margin-top:2px;font-weight:600">In progress...</div>' : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`}

  <!-- ITEMS -->
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">Items Ordered</div>
    ${(o.items||[]).map(i => `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid var(--border2)">
      <span style="color:var(--text2)">${i.name} × ${i.qty} ${i.unit||'pc'}</span>
      <span style="font-weight:700">₹${((i.price||0)*(i.qty||1)).toLocaleString('en-IN')}</span>
    </div>`).join('')}
    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;padding:8px 0 0">
      <span>Total</span><span style="color:var(--gold)">₹${parseFloat(o.total||0).toLocaleString('en-IN')}</span>
    </div>
  </div>

  <!-- HELP -->
  <div style="text-align:center;font-size:12px;color:var(--text3);margin-bottom:8px">
    Need help with your order?
  </div>
  <a href="tel:8712697930" style="display:block;text-align:center;padding:12px;border-radius:10px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25d366;font-size:13px;font-weight:700;text-decoration:none">
    📞 Call V Wholesale · 8712697930
  </a>`;
}

window.VW_SHOP.renderOrderTrackingPage = renderOrderTrackingPage;

// ═══════════════════════════════════════════════════════════════
// CONTRACTOR MARKUP & SHARE FLOW
// ═══════════════════════════════════════════════════════════════

async function renderContractorShopPage() {
  // Contractors see net price (below VWP) — configurable in settings
  const cfg = await VW_DB.getSetting('contractor_config', {
    net_price_discount_pct: 10, // contractor sees VWP - 10% = net price
    markup_limit_pct: 40,        // max markup contractor can add
  });

  return `
  <div class="module-header">
    <h2>🏗 Products to Share</h2>
    <div style="font-size:11px;color:var(--text3)">Your net price = VWP − ${cfg.net_price_discount_pct}%</div>
  </div>
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px;font-size:11px">
    <div style="font-weight:700;color:var(--gold);margin-bottom:3px">How contractor pricing works:</div>
    <div style="color:var(--text2)">1. You see net price (your cost from V Wholesale)</div>
    <div style="color:var(--text2)">2. Add your margin — share with customer</div>
    <div style="color:var(--text2)">3. Customer orders → V Wholesale delivers → you earn margin</div>
    <div style="color:var(--text2);margin-top:3px">TDS 1% + applicable taxes deducted before payout</div>
  </div>

  <!-- Category tabs reuse shop categories -->
  <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch">
    ${SHOP_CATEGORIES.map(c => `
    <button onclick="VW_SHOP.filterCategory('${c.key}');renderContractorProductGrid('${c.key}',${cfg.net_price_discount_pct})"
      style="flex:0 0 auto;padding:8px 14px;border-radius:20px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:11px;font-weight:700">
      ${c.icon} ${c.label}
    </button>`).join('')}
  </div>

  <div id="contractor-product-grid" style="margin-top:12px">
    <div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">Select a category above</div>
  </div>`;
}

async function renderContractorProductGrid(category, discountPct) {
  const container = document.getElementById('contractor-product-grid');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Loading...</div>';

  const { data: products } = await VW_DB.client.from('products')
    .select('id,name,brand,category,price,vwp,mrp,unit,stock,images,photos')
    .eq('category', category)
    .eq('is_active', true)
    .gt('stock', 0)
    .limit(30);

  if (!products?.length) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">No products in this category</div>';
    return;
  }

  // Pre-compute net prices for all products
  const cfg = await VW_DB.getSetting('contractor_config', { tiles_discount_pct:15, sanitary_discount_pct:8, default_discount_pct:10 });
  const getNetPrice = (vwp, category) => {
    const disc = category === 'Tiles' ? (cfg.tiles_discount_pct||15)
      : category === 'Sanitary' ? (cfg.sanitary_discount_pct||8)
      : (cfg.default_discount_pct||10);
    return Math.round(vwp * (1 - disc/100));
  };

  container.innerHTML = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    ${products.map(p => {
      const vwp = p.vwp || p.price || 0;
      const netPrice = getNetPrice(vwp, p.category);
      const img = p.images?.[0] || p.photos?.[0]?.url || p.photos?.[0] || null;
      return `
      <div style="background:var(--bg2);border-radius:12px;overflow:hidden;border:1px solid var(--border)">
        <div style="height:90px;background:var(--bg3);display:flex;align-items:center;justify-content:center">
          ${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:28px">${SHOP_CATEGORIES.find(c=>c.key===p.category)?.icon||'📦'}</span>`}
        </div>
        <div style="padding:8px">
          <div style="font-size:11px;font-weight:700;margin-bottom:4px;line-height:1.3">${p.name}</div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:6px">${p.brand||''}</div>
          <div style="background:var(--bg3);border-radius:6px;padding:5px 6px;margin-bottom:6px">
            <div style="font-size:9px;color:var(--text3)">Your net price</div>
            <div style="font-size:13px;font-weight:900;color:var(--green)">₹${netPrice.toLocaleString('en-IN')}</div>
            <div style="font-size:9px;color:var(--text3)">Customer MRP: ₹${(p.mrp||vwp).toLocaleString('en-IN')}</div>
          </div>
          <button onclick="VW_SHOP.openMarkupSheet(${p.id},'${p.name.replace(/'/g,"\\'")}',${netPrice},${p.mrp||vwp})"
            style="width:100%;padding:7px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:11px;font-weight:800;cursor:pointer">
            Share with Customer →
          </button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function openMarkupSheet(productId, productName, netPrice, mrp) {
  const sheet = document.getElementById('bottom-sheet');
  const suggestedMarkup = Math.round((mrp - netPrice) * 0.5); // suggest 50% of available margin
  const suggestedPrice = netPrice + suggestedMarkup;

  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>📤 Share with Customer</h3>
  <div style="font-size:13px;font-weight:700;margin-bottom:12px">${productName}</div>

  <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
      <span style="color:var(--text3)">Your net price</span>
      <span style="font-weight:700;color:var(--green)">₹${netPrice.toLocaleString('en-IN')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
      <span style="color:var(--text3)">Market MRP</span>
      <span>₹${mrp.toLocaleString('en-IN')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
      <span style="color:var(--text3)">Max available margin</span>
      <span style="color:var(--gold);font-weight:700">₹${(mrp - netPrice).toLocaleString('en-IN')}</span>
    </div>
  </div>

  <div class="form-group">
    <label>Your selling price to customer (₹)</label>
    <input type="number" id="markup-price" value="${suggestedPrice}" min="${netPrice}" max="${mrp}"
      oninput="updateMarkupPreview(${netPrice})"
      style="font-size:18px;font-weight:800;color:var(--gold)">
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px">
      <span style="color:var(--text3)">Min: ₹${netPrice.toLocaleString('en-IN')}</span>
      <span style="color:var(--text3)">Max: ₹${mrp.toLocaleString('en-IN')}</span>
    </div>
  </div>

  <div id="markup-preview" style="background:rgba(34,197,94,0.08);border:1px solid var(--green);border-radius:10px;padding:10px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:13px">
      <span style="color:var(--text3)">Your margin</span>
      <span id="markup-margin" style="font-weight:800;color:var(--green)">₹${suggestedMarkup.toLocaleString('en-IN')}</span>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:3px">After TDS 1% deduction</div>
  </div>

  <div class="form-group">
    <label>Customer Name (optional)</label>
    <input type="text" id="markup-cust-name" placeholder="For personalised message">
  </div>

  <button onclick="VW_SHOP.shareProductWithCustomer(${productId},'${productName.replace(/'/g,"\\'")}',${netPrice})"
    style="width:100%;padding:14px;border-radius:10px;background:rgba(37,211,102,1);border:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer">
    💬 Share via WhatsApp
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  const s = document.createElement('script');
  s.textContent = `
    window.updateMarkupPreview = function(netPrice) {
      const price = parseFloat(document.getElementById('markup-price')?.value) || netPrice;
      const margin = Math.max(0, price - netPrice);
      const afterTds = Math.round(margin * 0.99);
      const el = document.getElementById('markup-margin');
      if (el) el.textContent = '₹' + afterTds.toLocaleString('en-IN') + ' (after TDS)';
    };
  `;
  document.body.appendChild(s);
}

async function shareProductWithCustomer(productId, productName, netPrice) {
  const custPrice = parseFloat(document.getElementById('markup-price')?.value) || netPrice;
  const custName  = document.getElementById('markup-cust-name')?.value?.trim() || '';
  const prof = VW_AUTH.getCurrentProfile();

  // Build WhatsApp message
  const msg = encodeURIComponent(
    `${custName ? 'Hi ' + custName + ',' : 'Hi,'}\n\n` +
    `I'd like to share this product from V Wholesale:\n\n` +
    `📦 *${productName}*\n` +
    `💰 Special Price for you: *₹${custPrice.toLocaleString('en-IN')}*\n\n` +
    `🏪 Available at V Wholesale, Vijayawada\n` +
    `📞 Order via WhatsApp: 8712697930\n` +
    `🚚 Same-day delivery available\n\n` +
    `Shared by: ${prof?.name || 'V Wholesale Contractor'}`
  );

  window.open(`https://wa.me/?text=${msg}`, '_blank');
  closeSheet();
  showToast('WhatsApp opened — share with your customer', 'success');
}

// Expose
window.VW_SHOP.renderContractorShopPage = renderContractorShopPage;
window.VW_SHOP.openMarkupSheet = openMarkupSheet;
window.VW_SHOP.shareProductWithCustomer = shareProductWithCustomer;
window.renderContractorProductGrid = renderContractorProductGrid;

// ═══════════════════════════════════════════════════════════════
// CUSTOMER PROFILE PAGE
// ═══════════════════════════════════════════════════════════════

async function renderCustomerProfilePage() {
  const prof = VW_AUTH.getCurrentProfile();
  if (!prof) return '<div class="empty-msg">Not logged in</div>';

  // Fetch loyalty points from customers table
  const { data: cust } = await VW_DB.client.from('customers')
    .select('id,name,phone,email,loyalty_points,cc_enrolled_at,cc_tier')
    .eq('phone', prof.phone).single().catch(() => ({ data: null }));

  const points = cust?.loyalty_points || 0;
  const cfg = await VW_DB.getSetting('loyalty_config', { pointValue:1, earnRate:1 });
  const pointsValue = Math.floor(points * (cfg.pointValue || 1));

  // Fetch order count
  const { count: orderCount } = await VW_DB.client.from('orders')
    .select('id', { count:'exact', head:true })
    .eq('profile_id', prof.id)
    .eq('status','delivered');

  return `
  <div class="module-header"><h2>👤 My Profile</h2></div>

  <!-- PROFILE CARD -->
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:20px;margin-bottom:14px;color:#fff">
    <div style="font-size:22px;font-weight:900;margin-bottom:4px">${prof.name || '—'}</div>
    <div style="font-size:13px;opacity:0.7;margin-bottom:12px">📞 ${prof.phone || '—'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#f5c842">${points.toLocaleString('en-IN')}</div>
        <div style="font-size:10px;opacity:0.7">Loyalty Points</div>
        <div style="font-size:11px;color:#f5c842;margin-top:2px">= ₹${pointsValue.toLocaleString('en-IN')} value</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:900;color:#f5c842">${orderCount || 0}</div>
        <div style="font-size:10px;opacity:0.7">Orders Delivered</div>
      </div>
    </div>
  </div>

  <!-- EDIT PROFILE -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Edit Profile</h3>
    <div class="form-group">
      <label>Full Name</label>
      <input type="text" id="cp-name" value="${prof.name||''}" placeholder="Your name">
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="cp-email" value="${prof.email||''}" placeholder="your@email.com">
    </div>
    <button onclick="VW_SHOP.saveCustomerProfile()" style="width:100%;padding:10px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer">
      Save Changes
    </button>
  </div>

  <!-- QUICK LINKS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
    ${[
      { icon:'📦', label:'My Orders', page:'my_orders' },
      { icon:'👛', label:'My Wallet', page:'wallet' },
      { icon:'📍', label:'My Addresses', page:'my_addresses' },
      { icon:'📐', label:'My Quotes', page:'tile_quotes' },
    ].map(item => `
    <button onclick="navigateTo('${item.page}')"
      style="padding:12px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);cursor:pointer;text-align:center">
      <div style="font-size:22px;margin-bottom:4px">${item.icon}</div>
      <div style="font-size:11px;font-weight:700">${item.label}</div>
    </button>`).join('')}
  </div>

  <!-- SIGN OUT -->
  <button onclick="VW_AUTH.signOut()"
    style="width:100%;padding:10px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:var(--red);font-size:13px;cursor:pointer">
    Sign Out
  </button>`;
}

async function saveCustomerProfile() {
  const name  = document.getElementById('cp-name')?.value?.trim();
  const email = document.getElementById('cp-email')?.value?.trim();
  const prof  = VW_AUTH.getCurrentProfile();
  if (!name) { showToast('Name is required', 'warn'); return; }

  await VW_DB.client.from('profiles').update({ name, email: email || null }).eq('id', prof.id);
  showToast('Profile updated ✅', 'success');
}

window.VW_SHOP.renderCustomerProfilePage = renderCustomerProfilePage;
window.VW_SHOP.saveCustomerProfile = saveCustomerProfile;

// ═══════════════════════════════════════════════════════════════
// CUSTOMER RETURN REQUEST
// ═══════════════════════════════════════════════════════════════

async function renderCustomerReturnRequest() {
  const prof = VW_AUTH.getCurrentProfile();

  // Get delivered orders that can be returned (within 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: orders } = await VW_DB.client.from('orders')
    .select('id,order_no,items,total,delivered_at')
    .eq('profile_id', prof?.id || '')
    .eq('status', 'delivered')
    .gte('delivered_at', sevenDaysAgo)
    .order('delivered_at', { ascending: false });

  return `
  <div class="module-header"><h2>↩ Return Request</h2></div>
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px">
    <div style="font-weight:700;color:var(--gold);margin-bottom:4px">Return Policy</div>
    <div style="color:var(--text2);line-height:1.6">
      ✅ Returns accepted within 7 days of delivery<br>
      ✅ Unused, unopened products only<br>
      ✅ Original packaging required<br>
      ⚠️ Tiles (opened boxes) — not returnable<br>
      ✅ Refund to VW Wallet within 2-3 working days
    </div>
  </div>

  ${!(orders?.length) ? `
  <div style="text-align:center;padding:30px;color:var(--text3)">
    <div style="font-size:32px">📦</div>
    <div style="font-size:13px;margin-top:8px">No eligible orders for return</div>
    <div style="font-size:11px;margin-top:4px">Only delivered orders from last 7 days are eligible</div>
  </div>` :
  `<div style="font-size:12px;font-weight:700;margin-bottom:8px">Select order to return from:</div>
  ${orders.map(o => `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer;border:1px solid var(--border)"
    onclick="VW_SHOP.openReturnForm(${o.id},'${o.order_no}')">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:700">${o.order_no}</div>
        <div style="font-size:11px;color:var(--text3)">Delivered ${new Date(o.delivered_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:700;color:var(--gold)">₹${parseFloat(o.total||0).toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:var(--text3)">${(o.items||[]).length} item(s)</div>
      </div>
    </div>
    <div style="font-size:10px;color:var(--gold);margin-top:4px;font-weight:600">Tap to start return →</div>
  </div>`).join('')}`}`;
}

function openReturnForm(orderId, orderNo) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>↩ Return — ${orderNo}</h3>
  <div class="form-group">
    <label>Reason for Return *</label>
    <select id="return-reason">
      <option value="">Select reason</option>
      <option value="damaged">Product damaged on delivery</option>
      <option value="wrong_item">Wrong item delivered</option>
      <option value="not_as_described">Not as described</option>
      <option value="defective">Product defective</option>
      <option value="changed_mind">Changed mind</option>
    </select>
  </div>
  <div class="form-group">
    <label>Describe the issue</label>
    <textarea id="return-desc" rows="3" placeholder="Please describe what's wrong with the product..."
      style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px;resize:vertical;box-sizing:border-box"></textarea>
  </div>
  <div class="form-group">
    <label>Photo of product (optional but helps)</label>
    <input type="file" id="return-photo" accept="image/*"
      style="width:100%;padding:6px;background:var(--bg2);border:1px dashed var(--border);border-radius:8px;font-size:11px">
  </div>
  <div style="background:rgba(34,197,94,0.08);border:1px solid var(--green);border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--green)">
    ✅ Refund will be credited to your VW Wallet within 2-3 working days of pickup
  </div>
  <button onclick="VW_SHOP.submitReturnRequest(${orderId},'${orderNo}')"
    style="width:100%;padding:13px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    Submit Return Request
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function submitReturnRequest(orderId, orderNo) {
  const reason = document.getElementById('return-reason')?.value;
  const desc   = document.getElementById('return-desc')?.value?.trim();
  if (!reason) { showToast('Select a reason', 'warn'); return; }
  if (!desc) { showToast('Describe the issue', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();

  await VW_DB.client.from('customer_returns').insert({
    order_id: orderId,
    profile_id: prof?.id || null,
    customer_name: prof?.name || '',
    customer_phone: prof?.phone || '',
    return_reason: reason,
    description: desc,
    status: 'requested',
    created_at: new Date().toISOString(),
  }).catch(() => {});

  // Notify management
  await createPersistedNotification({
    category: 'return_request',
    title: `↩ Return Request — ${orderNo}`,
    body: `${prof?.name||''} · ${reason.replace('_',' ')} · ${desc.slice(0,50)}`,
    actions: [{ label: '👁 Review', action: 'open_returns' }],
  }).catch(() => {});

  showToast('Return request submitted ✅ — we will arrange pickup within 24 hours', 'success');
  closeSheet();
}

window.VW_SHOP.renderCustomerReturnRequest = renderCustomerReturnRequest;
window.VW_SHOP.openReturnForm = openReturnForm;
window.VW_SHOP.submitReturnRequest = submitReturnRequest;

// ═══════════════════════════════════════════════════════════════
// CONTRACTOR KYC APPROVAL — Management view
// ═══════════════════════════════════════════════════════════════

async function renderContractorKYCReview() {
  const { data: pending } = await VW_DB.client
    .from('contractor_profiles')
    .select('id,name,phone,kyc_status,pan_card_url,aadhaar_url,passbook_url,pan_no,bank_account_no,bank_ifsc,bank_name,contractor_score,created_at')
    .in('kyc_status', ['pending','approved','rejected'])
    .order('created_at', { ascending: false })
    .limit(30);

  const statusColor = { pending:'var(--gold)', approved:'var(--green)', rejected:'var(--red)' };

  return `
  <div class="module-header">
    <h2>👷 Contractor KYC</h2>
    <div style="font-size:11px;color:var(--text3)">${pending?.filter(p=>p.kyc_status==='pending').length||0} pending</div>
  </div>

  ${!(pending?.length) ? '<p class="empty-msg">No contractor KYC submissions yet</p>' :
  pending.map(cp => `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:10px;border-left:4px solid ${statusColor[cp.kyc_status]||'var(--border)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:14px;font-weight:700">${cp.name||'—'}</div>
        <div style="font-size:12px;color:var(--text3)">${cp.phone||'—'}</div>
      </div>
      <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${statusColor[cp.kyc_status]}20;color:${statusColor[cp.kyc_status]}">
        ${cp.kyc_status}
      </span>
    </div>

    <!-- BANK DETAILS -->
    <div style="background:var(--bg3);border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px">
      <div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--text3)">Account</span><span>${cp.bank_account_no||'—'}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--text3)">IFSC</span><span>${cp.bank_ifsc||'—'}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--text3)">Bank</span><span>${cp.bank_name||'—'}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--text3)">PAN</span><span>${cp.pan_no||'—'}</span></div>
    </div>

    <!-- DOCUMENTS -->
    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      ${[
        { label:'PAN Card', url: cp.pan_card_url },
        { label:'Aadhaar', url: cp.aadhaar_url },
        { label:'Passbook', url: cp.passbook_url },
      ].map(doc => doc.url ? `
      <a href="${VW_DB.client.storage.from('kyc-documents').getPublicUrl(doc.url).data?.publicUrl||'#'}" target="_blank"
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);color:#60A5FA;font-size:11px;font-weight:600;text-decoration:none">
        📄 ${doc.label}
      </a>` : `<span style="font-size:11px;color:var(--text3);padding:5px 10px;border-radius:8px;background:var(--bg3)">❌ ${doc.label}</span>`
      ).join('')}
    </div>

    <!-- ACTIONS -->
    ${cp.kyc_status === 'pending' ? `
    <div style="display:flex;gap:8px">
      <button onclick="VW_LABOR.approveContractorKYC(${cp.id})"
        style="flex:1;padding:10px;border-radius:8px;background:var(--green);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
        ✅ Approve KYC
      </button>
      <button onclick="VW_LABOR.rejectContractorKYC(${cp.id})"
        style="flex:1;padding:10px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--red);font-size:12px;font-weight:700;cursor:pointer">
        ❌ Reject
      </button>
    </div>` : cp.kyc_status === 'approved' ? `
    <div style="font-size:11px;color:var(--green)">✅ KYC approved — contractor can receive payments</div>` : `
    <div style="font-size:11px;color:var(--red)">❌ KYC rejected</div>`}
  </div>`).join('')}`;
}

async function approveContractorKYC(cpId) {
  const prof = VW_AUTH.getCurrentProfile();
  await VW_DB.client.from('contractor_profiles').update({
    kyc_status: 'approved',
    kyc_reviewed_at: new Date().toISOString(),
    kyc_reviewed_by: prof?.id,
    is_active: true,
  }).eq('id', cpId);

  // Get contractor profile_id to notify them
  const { data: cp } = await VW_DB.client.from('contractor_profiles')
    .select('profile_id,name').eq('id', cpId).single().catch(() => ({ data: null }));

  if (cp?.profile_id) {
    await createPersistedNotification({
      category: 'kyc_approved',
      title: '✅ KYC Verified — You can now receive jobs!',
      body: 'Your documents have been verified. Your account is now active.',
      recipientId: cp.profile_id,
    }).catch(() => {});
    await sendWebPush(cp.profile_id, '✅ KYC Approved!', 'Your contractor account is now active. Start receiving jobs!').catch(() => {});
  }

  showToast('KYC approved — contractor activated ✅', 'success');
  navigateTo('contractor_kyc');
}

async function rejectContractorKYC(cpId) {
  const reason = prompt('Reason for rejection (will be shared with contractor):');
  if (!reason) return;

  const prof = VW_AUTH.getCurrentProfile();
  await VW_DB.client.from('contractor_profiles').update({
    kyc_status: 'rejected',
    kyc_reviewed_at: new Date().toISOString(),
    kyc_reviewed_by: prof?.id,
  }).eq('id', cpId);

  const { data: cp } = await VW_DB.client.from('contractor_profiles')
    .select('profile_id').eq('id', cpId).single().catch(() => ({ data: null }));

  if (cp?.profile_id) {
    await createPersistedNotification({
      category: 'kyc_rejected',
      title: '❌ KYC Verification Failed',
      body: `Reason: ${reason}. Please resubmit with correct documents.`,
      recipientId: cp.profile_id,
    }).catch(() => {});
  }

  showToast('KYC rejected — contractor notified', 'warn');
  navigateTo('contractor_kyc');
}

window.VW_LABOR.approveContractorKYC = approveContractorKYC;
window.VW_LABOR.rejectContractorKYC = rejectContractorKYC;
window.VW_LABOR.renderContractorKYCReview = renderContractorKYCReview;

// ═══════════════════════════════════════════════════════════════
// SAMPLE REQUEST MANAGEMENT — Staff view
// ═══════════════════════════════════════════════════════════════

async function renderSampleRequestsDashboard() {
  const { data: samples } = await VW_DB.client
    .from('sample_requests')
    .select('*')
    .order('placed_at', { ascending: false })
    .limit(30);

  const statusColor = {
    pending:'var(--gold)', out:'#60A5FA',
    returned:'var(--green)', redeemed:'var(--green)', forfeited:'var(--red)'
  };

  return `
  <div class="module-header">
    <h2>🏠 Sample Requests</h2>
    <div style="font-size:11px;color:var(--text3)">${samples?.filter(s=>s.status==='pending').length||0} pending</div>
  </div>

  ${!(samples?.length) ? '<p class="empty-msg">No sample requests yet</p>' :
  samples.map(s => {
    const addr = typeof s.delivery_address === 'string' ? JSON.parse(s.delivery_address||'{}') : (s.delivery_address||{});
    const sc = statusColor[s.status] || 'var(--text3)';
    return `
    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:10px;border-left:4px solid ${sc}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:700">${s.customer_name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${s.customer_phone||'—'}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${addr.address||addr.address_line1||'No address'}</div>
        </div>
        <div style="text-align:right">
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:${sc}20;color:${sc}">${s.status}</span>
          <div style="font-size:11px;color:var(--gold);margin-top:4px;font-weight:700">₹${s.total_charge||500}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">
        ${(s.products||[]).map(p => p.description || p.name || '').join(', ') || 'Products not specified'}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:8px">
        Placed: ${new Date(s.placed_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
        ${s.return_deadline ? ` · Return by: ${new Date(s.return_deadline).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${s.status === 'pending' ? `
        <button onclick="VW_SHOP.dispatchSample(${s.id})"
          style="flex:1;padding:8px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:12px;font-weight:700;cursor:pointer">
          🚚 Mark Dispatched
        </button>` : ''}
        ${s.status === 'out' ? `
        <button onclick="VW_SHOP.markSampleReturned(${s.id})"
          style="flex:1;padding:8px;border-radius:8px;background:var(--green);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
          ✅ Mark Returned
        </button>
        <button onclick="VW_SHOP.markSampleForfeited(${s.id})"
          style="flex:1;padding:8px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--red);font-size:11px;cursor:pointer">
          ⏰ Forfeited
        </button>` : ''}
        <a href="tel:${s.customer_phone}"
          style="padding:8px 12px;border-radius:8px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25d366;font-size:12px;font-weight:700;text-decoration:none">
          📞
        </a>
      </div>
    </div>`;
  }).join('')}`;
}

async function dispatchSample(id) {
  const returnDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2hrs from now
  await VW_DB.client.from('sample_requests').update({
    status: 'out',
    return_deadline: returnDeadline,
  }).eq('id', id);
  showToast('Marked as dispatched — 2hr return window started', 'success');
  navigateTo('sample_requests');
}

async function markSampleReturned(id) {
  await VW_DB.client.from('sample_requests').update({
    status: 'returned',
    returned_at: new Date().toISOString(),
  }).eq('id', id);
  showToast('Sample returned ✅', 'success');
  navigateTo('sample_requests');
}

async function markSampleForfeited(id) {
  await VW_DB.client.from('sample_requests').update({ status: 'forfeited' }).eq('id', id);
  showToast('Marked as forfeited — charge not refundable', 'warn');
  navigateTo('sample_requests');
}

window.VW_SHOP.renderSampleRequestsDashboard = renderSampleRequestsDashboard;
window.VW_SHOP.dispatchSample = dispatchSample;
window.VW_SHOP.markSampleReturned = markSampleReturned;
window.VW_SHOP.markSampleForfeited = markSampleForfeited;

// ═══════════════════════════════════════════════════════════════
// OFFERS & PROMOTIONS PAGE
// ═══════════════════════════════════════════════════════════════

async function renderOffersPage() {
  // Fetch active offers from settings
  const offers = await VW_DB.getSetting('active_offers', []);
  // Fetch featured products (most discounted)
  const { data: featured } = await VW_DB.client.from('products')
    .select('id,name,brand,category,price,vwp,mrp,unit,images,photos')
    .eq('is_active', true)
    .gt('mrp', 0)
    .gt('stock', 0)
    .order('mrp', { ascending: false })
    .limit(6);

  const discounted = (featured||[]).filter(p => {
    const price = p.vwp || p.price || 0;
    return p.mrp > price * 1.1; // at least 10% discount
  }).slice(0, 6);

  return `
  <div class="module-header"><h2>🎁 Offers & Deals</h2></div>

  <!-- HERO OFFER BANNER -->
  <div style="background:linear-gradient(135deg,#f5c842,#f59e0b);border-radius:16px;padding:20px;margin-bottom:16px;color:#000">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🔥 Today's Special</div>
    <div style="font-size:20px;font-weight:900;margin-bottom:4px">Free Delivery</div>
    <div style="font-size:13px;font-weight:600;opacity:0.8">On all orders above ₹2,000 within Vijayawada</div>
    <button onclick="navigateTo('shop')" style="margin-top:12px;padding:8px 20px;border-radius:20px;background:#000;color:#f5c842;border:none;font-size:12px;font-weight:800;cursor:pointer">
      Shop Now →
    </button>
  </div>

  <!-- LOYALTY OFFER -->
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:14px;padding:16px;margin-bottom:16px;color:#fff">
    <div style="font-size:11px;font-weight:700;color:#f5c842;margin-bottom:6px">⭐ LOYALTY REWARDS</div>
    <div style="font-size:16px;font-weight:800;margin-bottom:4px">Earn 1 point for every ₹100</div>
    <div style="font-size:12px;opacity:0.7;margin-bottom:10px">Redeem points on future purchases · No expiry</div>
    <div style="display:flex;gap:8px">
      <div style="flex:1;background:rgba(255,255,255,0.08);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:16px;font-weight:900;color:#f5c842">1pt</div>
        <div style="font-size:9px;opacity:0.7">per ₹100</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.08);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:16px;font-weight:900;color:#f5c842">= ₹1</div>
        <div style="font-size:9px;opacity:0.7">per point</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.08);border-radius:8px;padding:8px;text-align:center">
        <div style="font-size:16px;font-weight:900;color:#f5c842">∞</div>
        <div style="font-size:9px;opacity:0.7">no expiry</div>
      </div>
    </div>
  </div>

  <!-- TILE SAMPLE OFFER -->
  <div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:14px;padding:16px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:#8B5CF6;margin-bottom:6px">🏠 TRY BEFORE YOU BUY</div>
    <div style="font-size:16px;font-weight:800;margin-bottom:4px">Tile Sample at Home</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">
      ₹500 per tile · 100% redeemable on purchase · 2-hour return window
    </div>
    <button onclick="VW_SHOP.requestTileSample()" style="width:100%;padding:10px;border-radius:10px;background:#8B5CF6;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer">
      Request Sample Visit →
    </button>
  </div>

  <!-- CONTRACTOR OFFER -->
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:14px;padding:16px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">👷 CONTRACTOR CLUB</div>
    <div style="font-size:16px;font-weight:800;margin-bottom:4px">Special Trade Pricing</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">
      Register as a contractor · Get exclusive net pricing · Earn on every referral
    </div>
    <button onclick="navigateTo('contractor_profile')" style="width:100%;padding:10px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer">
      Join Contractor Club →
    </button>
  </div>

  ${discounted.length ? `
  <!-- FEATURED DEALS -->
  <div style="font-size:13px;font-weight:700;margin-bottom:10px">🔥 Best Deals Right Now</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    ${discounted.map(p => {
      const price = p.vwp || p.price || 0;
      const disc = Math.round((p.mrp - price) / p.mrp * 100);
      const img = p.images?.[0] || p.photos?.[0]?.url || p.photos?.[0] || null;
      return `
      <div onclick="navigateTo('shop')" style="background:var(--bg2);border-radius:12px;overflow:hidden;border:1px solid var(--border);cursor:pointer">
        <div style="position:relative">
          <div style="height:90px;background:var(--bg3);display:flex;align-items:center;justify-content:center">
            ${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:28px">${SHOP_CATEGORIES.find(c=>c.key===p.category)?.icon||'📦'}</span>`}
          </div>
          <div style="position:absolute;top:6px;right:6px;background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px">${disc}% OFF</div>
        </div>
        <div style="padding:8px">
          <div style="font-size:11px;font-weight:700;margin-bottom:2px;line-height:1.3">${p.name}</div>
          <div style="display:flex;align-items:baseline;gap:4px">
            <span style="font-size:13px;font-weight:900;color:var(--gold)">₹${price.toLocaleString('en-IN')}</span>
            <span style="font-size:10px;color:var(--text3);text-decoration:line-through">₹${p.mrp.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>` : ''}`;
}

window.VW_SHOP.renderOffersPage = renderOffersPage;

// ═══════════════════════════════════════════════════════════════
// PRICE HISTORY FOR RETURNING CUSTOMERS
// ═══════════════════════════════════════════════════════════════

async function renderPriceHistoryForCustomer(customerId) {
  // Fetch past TQs for this customer with prices
  const { data: tqs } = await VW_DB.client
    .from('tile_quotations')
    .select('tq_no,created_at,quoted_price_per_sqft,grand_total,total_area_sqft,approval_status')
    .eq('customer_id', customerId)
    .in('approval_status', ['approved','advance_collected'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (!tqs?.length) return '';

  return `
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:10px">
    <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">📋 Previous Quotes for this Customer</div>
    ${tqs.map(q => `
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border2)">
      <div>
        <span style="font-weight:600">${q.tq_no}</span>
        <span style="color:var(--text3);margin-left:6px">${new Date(q.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
      </div>
      <div style="text-align:right">
        ${q.quoted_price_per_sqft ? `<span style="color:var(--gold);font-weight:700">₹${q.quoted_price_per_sqft}/sqft</span>` : ''}
        ${q.grand_total ? `<span style="color:var(--text3);margin-left:4px">· ₹${parseInt(q.grand_total).toLocaleString('en-IN')}</span>` : ''}
      </div>
    </div>`).join('')}
    <div style="font-size:10px;color:var(--text3);margin-top:4px">Approved quotes only · Shown to help you quote consistently</div>
  </div>`;
}

window.VW_TILES = window.VW_TILES || {};
window.VW_TILES.renderPriceHistoryForCustomer = renderPriceHistoryForCustomer;

// ═══════════════════════════════════════════════════════════════
// BARCODE / QR SCANNER — Product lookup via camera
// ═══════════════════════════════════════════════════════════════

async function openBarcodeScanner(onResult) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>📷 Scan Product Barcode</h3>
  <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Point camera at product barcode or QR code</p>

  <div id="barcode-scanner-area" style="background:#000;border-radius:12px;overflow:hidden;aspect-ratio:4/3;position:relative;margin-bottom:14px">
    <video id="barcode-video" style="width:100%;height:100%;object-fit:cover" autoplay playsinline muted></video>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:100px;border:2px solid var(--gold);border-radius:8px;pointer-events:none">
      <div style="position:absolute;top:-1px;left:-1px;width:20px;height:20px;border-top:3px solid var(--gold);border-left:3px solid var(--gold);border-radius:2px 0 0 0"></div>
      <div style="position:absolute;top:-1px;right:-1px;width:20px;height:20px;border-top:3px solid var(--gold);border-right:3px solid var(--gold);border-radius:0 2px 0 0"></div>
      <div style="position:absolute;bottom:-1px;left:-1px;width:20px;height:20px;border-bottom:3px solid var(--gold);border-left:3px solid var(--gold);border-radius:0 0 0 2px"></div>
      <div style="position:absolute;bottom:-1px;right:-1px;width:20px;height:20px;border-bottom:3px solid var(--gold);border-right:3px solid var(--gold);border-radius:0 0 2px 0"></div>
    </div>
    <div style="position:absolute;bottom:12px;width:100%;text-align:center;color:rgba(255,255,255,0.7);font-size:11px">Hold barcode within frame</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
    <div class="form-group" style="margin:0">
      <label>Or enter barcode manually</label>
      <input type="text" id="manual-barcode" placeholder="Barcode number" inputmode="numeric"
        oninput="VW_SHOP.lookupBarcode(this.value,true)">
    </div>
    <div class="form-group" style="margin:0">
      <label>Or search by name</label>
      <input type="text" id="manual-name-search" placeholder="Product name"
        oninput="VW_SHOP.quickProductSearch(this.value)">
    </div>
  </div>

  <div id="barcode-result" style="min-height:60px"></div>

  <button onclick="VW_SHOP.stopScanner();closeSheet()" style="width:100%;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer;margin-top:8px">
    Close Scanner
  </button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  // Store callback
  window._barcodeCallback = onResult || null;

  // Start camera + BarcodeDetector if available
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('barcode-video');
    if (video) {
      video.srcObject = stream;
      window._scannerStream = stream;
    }

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e'] });
      const scanLoop = async () => {
        if (!document.getElementById('barcode-video')) return; // sheet closed
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            VW_SHOP.lookupBarcode(code, false);
            return; // stop loop after first detect
          }
        } catch(e) {}
        setTimeout(scanLoop, 300);
      };
      video.addEventListener('loadedmetadata', scanLoop);
    } else {
      document.getElementById('barcode-scanner-area').insertAdjacentHTML('beforeend',
        '<div style="position:absolute;bottom:40px;width:100%;text-align:center;color:var(--gold);font-size:11px;font-weight:700">Camera scan not supported on this browser — enter barcode manually</div>'
      );
    }
  } catch(e) {
    document.getElementById('barcode-scanner-area').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3);font-size:13px;padding:20px;text-align:center">Camera access denied.<br>Enter barcode manually below.</div>';
  }
}

function stopScanner() {
  const stream = window._scannerStream;
  if (stream) { stream.getTracks().forEach(t => t.stop()); window._scannerStream = null; }
}

async function lookupBarcode(code, isManual) {
  if (!code || code.length < 4) return;
  const resultEl = document.getElementById('barcode-result');
  if (resultEl) resultEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px">Searching...</div>';

  const { data: products } = await VW_DB.client.from('products')
    .select('id,name,brand,category,price,vwp,mrp,unit,stock')
    .or(`barcode.eq.${code},model.ilike.%${code}%`)
    .limit(3);

  if (!products?.length) {
    if (resultEl) resultEl.innerHTML = `<div style="font-size:12px;color:var(--red);padding:8px">No product found for "${code}"</div>`;
    return;
  }

  if (isManual && products.length === 1) {
    // Auto-stop camera and select
    stopScanner();
  }

  renderBarcodeResults(products);
}

async function quickProductSearch(name) {
  if (!name || name.length < 2) return;
  const { data: products } = await VW_DB.client.from('products')
    .select('id,name,brand,category,price,vwp,mrp,unit,stock')
    .ilike('name', `%${name}%`)
    .limit(5);
  renderBarcodeResults(products);
}

function renderBarcodeResults(products) {
  const resultEl = document.getElementById('barcode-result');
  if (!resultEl || !products?.length) return;

  resultEl.innerHTML = products.map(p => {
    const price = p.vwp || p.price || 0;
    return `
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer"
      onclick="VW_SHOP.selectScannedProduct(${p.id},'${p.name.replace(/'/g,"\\'")}',${price})">
      <div>
        <div style="font-size:13px;font-weight:700">${p.name}</div>
        <div style="font-size:11px;color:var(--text3)">${p.brand||''} · ${p.category} · Stock: ${p.stock||0}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:900;color:var(--gold)">₹${price.toLocaleString('en-IN')}</div>
        <div style="font-size:10px;color:var(--text3)">${p.unit||'pc'}</div>
      </div>
    </div>`;
  }).join('');
}

function selectScannedProduct(id, name, price) {
  stopScanner();
  if (window._barcodeCallback) {
    window._barcodeCallback({ id, name, price });
  } else {
    // Default: add to shop cart
    addToCart(id);
    showToast(`${name} added to cart`, 'success');
  }
  closeSheet();
}

window.VW_SHOP.openBarcodeScanner = openBarcodeScanner;
window.VW_SHOP.stopScanner = stopScanner;
window.VW_SHOP.lookupBarcode = lookupBarcode;
window.VW_SHOP.quickProductSearch = quickProductSearch;
window.VW_SHOP.selectScannedProduct = selectScannedProduct;

// ═══════════════════════════════════════════════════════════════
// PROMO CODE VALIDATION
// ═══════════════════════════════════════════════════════════════

async function applyPromoCode() {
  const code = document.getElementById('promo-code-input')?.value?.trim().toUpperCase();
  const resultEl = document.getElementById('promo-result');
  if (!code) return;
  if (resultEl) resultEl.innerHTML = '<span style="color:var(--text3)">Checking...</span>';

  const { data: promo } = await VW_DB.client.from('promo_codes')
    .select('*').eq('code', code).eq('is_active', true).single().catch(() => ({ data: null }));

  if (!promo) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--red)">❌ Invalid or expired code</span>';
    return;
  }

  const now = new Date();
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--red)">❌ This code has expired</span>';
    return;
  }
  if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--red)">❌ This code has reached its usage limit</span>';
    return;
  }

  const subtotal = _checkoutState.subtotal || 0;
  if (promo.min_order_value && subtotal < promo.min_order_value) {
    if (resultEl) resultEl.innerHTML = `<span style="color:var(--red)">❌ Minimum order ₹${promo.min_order_value.toLocaleString('en-IN')} required</span>`;
    return;
  }

  // Calculate discount
  let discount = promo.discount_type === 'percent'
    ? Math.round(subtotal * promo.discount_value / 100)
    : promo.discount_value;

  if (promo.max_discount_amount) discount = Math.min(discount, promo.max_discount_amount);

  _checkoutState.promoCode = code;
  _checkoutState.promoDiscount = discount;
  _checkoutState.promoDescription = promo.description;

  if (resultEl) resultEl.innerHTML = `<span style="color:var(--green)">✅ ${promo.description} — ₹${discount.toLocaleString('en-IN')} off applied!</span>`;

  // Refresh total display
  const totalEl = document.querySelector('[onclick="VW_SHOP.placeOrder()"]');
  const total = subtotal - discount;
  if (totalEl) {
    totalEl.textContent = `✅ Place Order · ₹${total.toLocaleString('en-IN')}`;
    _checkoutState.total = total;
  }
  showToast(`₹${discount.toLocaleString('en-IN')} discount applied! 🎉`, 'success');
}

window.VW_SHOP.applyPromoCode = applyPromoCode;

// Add scanner button to shop header
window.VW_SHOP.openBarcodeScanner = openBarcodeScanner;

// ═══════════════════════════════════════════════════════════════
// TILE MOOD BOARD — AI-powered tile combination suggestions
// ═══════════════════════════════════════════════════════════════

async function renderTileMoodBoard() {
  const { data: tiles } = await VW_DB.client
    .from('products')
    .select('id,name,brand,category,subcategory,price,vwp,mrp,unit,images,photos')
    .eq('category', 'Tiles')
    .eq('is_active', true)
    .gt('stock', 0)
    .limit(30);

  const rooms = ['Living Room', 'Master Bedroom', 'Bathroom', 'Kitchen', 'Balcony', 'Outdoor'];
  const styles = ['Modern', 'Classic', 'Rustic', 'Minimalist', 'Luxury', 'Traditional'];

  return `
  <div class="module-header"><h2>🎨 Tile Mood Board</h2></div>
  <p style="font-size:12px;color:var(--text3);margin-bottom:14px">AI suggests the best tile combinations for your space</p>

  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">Tell us about your space</h3>
    <div class="form-group">
      <label>Room Type</label>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
        ${rooms.map((r,i) => `
        <button id="mb-room-${i}" onclick="selectMBRoom('${r}',${i})"
          style="flex:0 0 auto;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;
            border:${i===0?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${i===0?'var(--gold-muted)':'var(--bg2)'};
            color:${i===0?'var(--gold)':'var(--text)'}">
          ${r}
        </button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Style Preference</label>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
        ${styles.map((s,i) => `
        <button id="mb-style-${i}" onclick="selectMBStyle('${s}',${i})"
          style="flex:0 0 auto;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;
            border:${i===0?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${i===0?'var(--gold-muted)':'var(--bg2)'};
            color:${i===0?'var(--gold)':'var(--text)'}">
          ${s}
        </button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Budget Range (₹/sqft)</label>
      <div style="display:flex;gap:8px">
        ${[['Under ₹50','0','50'],['₹50-100','50','100'],['₹100-200','100','200'],['₹200+','200','9999']].map(([label,min,max],i) => `
        <button id="mb-budget-${i}" onclick="selectMBBudget(${min},${max},${i})"
          style="flex:1;padding:8px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;
            border:${i===1?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${i===1?'var(--gold-muted)':'var(--bg2)'}">
          ${label}
        </button>`).join('')}
      </div>
    </div>
    <button onclick="VW_SHOP.generateMoodBoard()"
      style="width:100%;padding:12px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
      ✨ Generate Mood Board
    </button>
  </div>

  <div id="mood-board-result"></div>`;
}

async function generateMoodBoard() {
  const room  = window._mbRoom  || 'Living Room';
  const style = window._mbStyle || 'Modern';
  const minB  = window._mbBudgetMin ?? 50;
  const maxB  = window._mbBudgetMax ?? 100;

  const resultEl = document.getElementById('mood-board-result');
  if (resultEl) resultEl.innerHTML = `
    <div style="text-align:center;padding:30px">
      <div style="font-size:40px;animation:spin 1.5s linear infinite">✨</div>
      <div style="font-size:14px;font-weight:700;margin-top:12px">Curating your mood board...</div>
    </div>`;

  // Fetch matching tiles
  const { data: tiles } = await VW_DB.client.from('products')
    .select('id,name,brand,subcategory,price,vwp,mrp,unit,images,photos')
    .eq('category','Tiles').eq('is_active',true).gt('stock',0)
    .gte('vwp', minB).lte('vwp', maxB <= 9999 ? maxB : 99999)
    .limit(20);

  if (!tiles?.length) {
    if (resultEl) resultEl.innerHTML = '<p class="empty-msg">No tiles found in this budget range</p>';
    return;
  }

  // Use Claude to suggest combinations
  try {
    const tileList = tiles.map(t => `${t.name} (${t.brand||''}) ₹${t.vwp||t.price}/sqft`).join(', ');
    const prompt = `You are a tile design expert for V Wholesale in Vijayawada, India.
A customer wants tiles for their ${room} in a ${style} style. Budget: ₹${minB}-${maxB}/sqft.

Available tiles: ${tileList}

Suggest 3 curated combinations (name each combination). For each:
- Primary tile (floor)
- Accent tile (feature wall or border, if applicable)  
- Why this works for ${room} in ${style} style
- Estimated total look

Return ONLY valid JSON array with structure:
[{"name":"...", "primary":"tile name", "accent":"tile name or null", "reason":"...", "look":"..."}]`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data?.content?.[0]?.text || '[]';
    const suggestions = JSON.parse(text.replace(/```json\n?|```/g,'').trim());

    if (resultEl) resultEl.innerHTML = `
    <div style="font-size:13px;font-weight:700;margin-bottom:12px">✨ Curated for your ${room} — ${style} Style</div>
    ${suggestions.map((s,i) => {
      const primaryTile = tiles.find(t => t.name.toLowerCase().includes(s.primary?.toLowerCase().split(' ')[0]||''));
      const accentTile  = s.accent ? tiles.find(t => t.name.toLowerCase().includes(s.accent?.toLowerCase().split(' ')[0]||'')) : null;
      return `
      <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid var(--border)">
        <div style="font-size:14px;font-weight:800;color:var(--gold);margin-bottom:6px">Look ${i+1}: ${s.name}</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          ${[primaryTile, accentTile].filter(Boolean).map(t => {
            const img = t?.images?.[0] || t?.photos?.[0]?.url || t?.photos?.[0] || null;
            const price = t?.vwp || t?.price || 0;
            return `
            <div style="flex:1;background:var(--bg3);border-radius:8px;overflow:hidden">
              ${img ? `<img src="${img}" style="width:100%;height:80px;object-fit:cover">` : `<div style="height:80px;display:flex;align-items:center;justify-content:center;font-size:28px">⬜</div>`}
              <div style="padding:6px">
                <div style="font-size:10px;font-weight:700;line-height:1.3">${t?.name||''}</div>
                <div style="font-size:11px;color:var(--gold);font-weight:700">₹${price}/sqft</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${s.reason}</div>
        <div style="font-size:11px;color:var(--text3);font-style:italic">"${s.look}"</div>
        <button onclick="navigateTo('shop')" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:12px;font-weight:700;cursor:pointer">
          🛒 Shop These Tiles
        </button>
      </div>`;
    }).join('')}`;

  } catch(e) {
    // Fallback — show random selections from stock
    const picks = tiles.sort(() => Math.random() - 0.5).slice(0, 6);
    if (resultEl) resultEl.innerHTML = `
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">Tiles for your ${room}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${picks.map(p => shopProductCard(p)).join('')}
    </div>`;
  }
}

const _mbSelections = { room: 'Living Room', style: 'Modern', budgetMin: 50, budgetMax: 100 };
setTimeout(() => {
  window._mbRoom = 'Living Room';
  window._mbStyle = 'Modern';
  window._mbBudgetMin = 50;
  window._mbBudgetMax = 100;
  window.selectMBRoom = (r, i) => {
    window._mbRoom = r;
    document.querySelectorAll('[id^="mb-room-"]').forEach((b,idx) => {
      b.style.borderColor = idx===i?'var(--gold)':'var(--border)';
      b.style.background  = idx===i?'var(--gold-muted)':'var(--bg2)';
      b.style.color       = idx===i?'var(--gold)':'var(--text)';
    });
  };
  window.selectMBStyle = (s, i) => {
    window._mbStyle = s;
    document.querySelectorAll('[id^="mb-style-"]').forEach((b,idx) => {
      b.style.borderColor = idx===i?'var(--gold)':'var(--border)';
      b.style.background  = idx===i?'var(--gold-muted)':'var(--bg2)';
      b.style.color       = idx===i?'var(--gold)':'var(--text)';
    });
  };
  window.selectMBBudget = (min, max, i) => {
    window._mbBudgetMin = min; window._mbBudgetMax = max;
    document.querySelectorAll('[id^="mb-budget-"]').forEach((b,idx) => {
      b.style.borderColor = idx===i?'var(--gold)':'var(--border)';
      b.style.background  = idx===i?'var(--gold-muted)':'var(--bg2)';
    });
  };
}, 0);

window.VW_SHOP.renderTileMoodBoard = renderTileMoodBoard;
window.VW_SHOP.generateMoodBoard = generateMoodBoard;

// ─── LOYALTY REDEEM TOGGLE ────────────────────────────────────
function toggleLoyaltyRedeem(maxPoints, redeemValue) {
  const checked = document.getElementById('use-loyalty')?.checked;
  _checkoutState.loyaltyRedeem = checked ? maxPoints : 0;
  _checkoutState.loyaltyRedeemValue = checked ? redeemValue : 0;
  // Update total display
  const total = _checkoutState.subtotal - (_checkoutState.promoDiscount||0) - (_checkoutState.loyaltyRedeemValue||0);
  const btn = document.querySelector('[onclick="VW_SHOP.placeOrder()"]');
  if (btn) btn.textContent = `✅ Place Order · ₹${Math.max(0,total).toLocaleString('en-IN')}`;
  showToast(checked ? `₹${redeemValue} loyalty discount applied` : 'Loyalty points removed', 'info');
}
window.VW_SHOP.toggleLoyaltyRedeem = toggleLoyaltyRedeem;

// ─── CONTRACTOR SCORE AUTO-CALCULATION ───────────────────────
async function recalculateContractorScore(cpId) {
  // Score = 100 points max
  // 40 pts: job completion rate (jobs completed / jobs accepted * 40)
  // 30 pts: average rating (avg_rating / 5 * 30)
  // 20 pts: response rate (response_rate * 20 / 100)
  // 10 pts: purchase value bonus (total_purchase_value > 50000 = 10, > 10000 = 5)

  const { data: cp } = await VW_DB.client.from('contractor_profiles')
    .select('*').eq('id', cpId).single().catch(() => ({ data: null }));
  if (!cp) return;

  const completionRate = cp.total_jobs_completed > 0 ? Math.min(1, cp.total_jobs_completed / Math.max(1, cp.total_jobs_completed)) : 0;
  const ratingScore   = ((cp.avg_rating || 0) / 5) * 30;
  const responseScore = ((cp.response_rate || 100) / 100) * 20;
  const purchaseScore = cp.total_purchase_value >= 50000 ? 10 : cp.total_purchase_value >= 10000 ? 5 : 0;
  const completionScore = completionRate * 40;

  const newScore = Math.round(Math.min(100, completionScore + ratingScore + responseScore + purchaseScore));

  await VW_DB.client.from('contractor_profiles')
    .update({ contractor_score: newScore }).eq('id', cpId);

  return newScore;
}
window.VW_LABOR.recalculateContractorScore = recalculateContractorScore;

// ─── RETURNS STAFF MANAGEMENT ─────────────────────────────────
async function renderStaffReturnsPage() {
  const { data: returns } = await VW_DB.client
    .from('customer_returns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  const statusColor = { requested:'var(--gold)', scheduled:'#60A5FA', picked_up:'var(--green)', completed:'var(--green)', rejected:'var(--red)' };

  return `
  <div class="module-header">
    <h2>↩ Returns Management</h2>
    <div style="font-size:11px;color:var(--text3)">${returns?.filter(r=>r.status==='requested').length||0} pending</div>
  </div>

  ${!(returns?.length) ? '<p class="empty-msg">No return requests yet</p>' :
  returns.map(r => {
    const sc = statusColor[r.status] || 'var(--text3)';
    return `
    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:10px;border-left:4px solid ${sc}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:700">${r.customer_name||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${r.customer_phone||'—'}</div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:${sc}20;color:${sc}">${r.status}</span>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:4px">${r.return_reason?.replace('_',' ')||'—'}</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">${r.description||''}</div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:8px">${new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      <div style="display:flex;gap:6px">
        ${r.status === 'requested' ? `
        <button onclick="VW_SHOP.scheduleReturnPickup(${r.id})"
          style="flex:1;padding:8px;border-radius:8px;background:#60A5FA;border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
          📅 Schedule Pickup
        </button>
        <button onclick="VW_SHOP.rejectReturn(${r.id})"
          style="flex:1;padding:8px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--red);font-size:12px;cursor:pointer">
          ❌ Reject
        </button>` : ''}
        ${r.status === 'scheduled' ? `
        <button onclick="VW_SHOP.markReturnPickedUp(${r.id})"
          style="flex:1;padding:8px;border-radius:8px;background:var(--green);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
          ✅ Mark Picked Up
        </button>` : ''}
        <a href="tel:${r.customer_phone}"
          style="padding:8px 12px;border-radius:8px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25d366;font-size:12px;text-decoration:none">
          📞
        </a>
      </div>
    </div>`;
  }).join('')}`;
}

async function scheduleReturnPickup(id) {
  const date = prompt('Pickup date (DD/MM/YYYY):');
  const time = prompt('Pickup time (e.g. 10am-12pm):');
  if (!date || !time) return;

  await VW_DB.client.from('customer_returns').update({
    status: 'scheduled',
    pickup_scheduled_at: new Date().toISOString(),
    pickup_notes: `${date} ${time}`,
  }).eq('id', id).catch(() => {});

  // Notify customer
  const { data: ret } = await VW_DB.client.from('customer_returns')
    .select('profile_id,customer_name').eq('id', id).single().catch(() => ({ data: null }));
  if (ret?.profile_id) {
    await createPersistedNotification({
      category: 'return_scheduled',
      title: '📦 Return Pickup Scheduled',
      body: `Your return pickup is scheduled for ${date} at ${time}. Please keep the item ready.`,
      recipientId: ret.profile_id,
    }).catch(() => {});
  }

  showToast('Pickup scheduled — customer notified', 'success');
  navigateTo('staff_returns');
}

async function markReturnPickedUp(id) {
  const { data: ret } = await VW_DB.client.from('customer_returns')
    .select('profile_id,order_id').eq('id', id).single().catch(() => ({ data: null }));

  await VW_DB.client.from('customer_returns').update({
    status: 'picked_up',
    picked_up_at: new Date().toISOString(),
  }).eq('id', id);

  // Refund to wallet
  if (ret?.order_id) {
    const { data: order } = await VW_DB.client.from('orders')
      .select('total,payment_method').eq('id', ret.order_id).single().catch(() => ({ data: null }));
    if (order?.payment_method === 'wallet' && ret?.profile_id) {
      const { data: wallet } = await VW_DB.client.from('customer_wallets')
        .select('id,balance').eq('profile_id', ret.profile_id).single().catch(() => ({ data: null }));
      if (wallet) {
        const newBal = parseFloat(wallet.balance) + parseFloat(order.total);
        await VW_DB.client.from('customer_wallets').update({ balance: newBal }).eq('id', wallet.id);
        await VW_DB.client.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          type: 'refund',
          amount: order.total,
          balance_after: newBal,
          description: 'Return refund',
        });
      }
    }
  }

  showToast('Return picked up — refund processed', 'success');
  navigateTo('staff_returns');
}

async function rejectReturn(id) {
  const reason = prompt('Reason for rejection:');
  if (!reason) return;
  await VW_DB.client.from('customer_returns').update({ status: 'rejected' }).eq('id', id);
  showToast('Return rejected', 'warn');
  navigateTo('staff_returns');
}

window.VW_SHOP.renderStaffReturnsPage = renderStaffReturnsPage;
window.VW_SHOP.scheduleReturnPickup = scheduleReturnPickup;
window.VW_SHOP.markReturnPickedUp = markReturnPickedUp;
window.VW_SHOP.rejectReturn = rejectReturn;

// ═══════════════════════════════════════════════════════════════
// B2B CONTRACTOR PRICING TIER
// ═══════════════════════════════════════════════════════════════

async function getContractorNetPrice(vwp, category) {
  // Get contractor discount config from settings
  const cfg = await VW_DB.getSetting('contractor_config', {
    net_price_discount_pct: 10,
    tiles_discount_pct: 15,   // higher discount on tiles
    sanitary_discount_pct: 8,
    default_discount_pct: 10,
  });

  const disc = category === 'Tiles' ? (cfg.tiles_discount_pct || 15)
    : category === 'Sanitary' ? (cfg.sanitary_discount_pct || 8)
    : (cfg.net_price_discount_pct || cfg.default_discount_pct || 10);

  return Math.round(vwp * (1 - disc / 100));
}

async function renderContractorPricingSettings() {
  const cfg = await VW_DB.getSetting('contractor_config', {
    net_price_discount_pct: 10,
    tiles_discount_pct: 15,
    sanitary_discount_pct: 8,
    default_discount_pct: 10,
    markup_limit_pct: 40,
  });

  return `
  <div style="font-size:12px;font-weight:700;margin-bottom:12px">🏗 Contractor Net Pricing</div>
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:10px;margin-bottom:12px;font-size:11px;color:var(--text2)">
    Contractors see VWP minus these discounts. They add their own markup to earn margin.
  </div>
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">Category-wise Discounts (% off VWP)</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group" style="margin:0">
        <label>Tiles</label>
        <input type="number" id="cp-tiles-disc" value="${cfg.tiles_discount_pct||15}" min="0" max="40" step="1">
      </div>
      <div class="form-group" style="margin:0">
        <label>Sanitary</label>
        <input type="number" id="cp-sanitary-disc" value="${cfg.sanitary_discount_pct||8}" min="0" max="40" step="1">
      </div>
      <div class="form-group" style="margin:0">
        <label>All Other Categories</label>
        <input type="number" id="cp-default-disc" value="${cfg.default_discount_pct||10}" min="0" max="40" step="1">
      </div>
      <div class="form-group" style="margin:0">
        <label>Max Markup Allowed (%)</label>
        <input type="number" id="cp-markup-limit" value="${cfg.markup_limit_pct||40}" min="0" max="100" step="5">
      </div>
    </div>
    <button onclick="saveContractorPricingConfig()"
      style="width:100%;margin-top:10px;padding:10px;border-radius:8px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer">
      💾 Save Contractor Pricing
    </button>
  </div>`;
}

async function saveContractorPricingConfig() {
  const cfg = {
    tiles_discount_pct:    parseFloat(document.getElementById('cp-tiles-disc')?.value) || 15,
    sanitary_discount_pct: parseFloat(document.getElementById('cp-sanitary-disc')?.value) || 8,
    default_discount_pct:  parseFloat(document.getElementById('cp-default-disc')?.value) || 10,
    net_price_discount_pct:parseFloat(document.getElementById('cp-default-disc')?.value) || 10,
    markup_limit_pct:      parseFloat(document.getElementById('cp-markup-limit')?.value) || 40,
  };
  await VW_DB.setSetting('contractor_config', cfg);
  showToast('Contractor pricing saved ✅', 'success');
}

window.VW_SHOP.renderContractorPricingSettings = renderContractorPricingSettings;
window.VW_SHOP.getContractorNetPrice = getContractorNetPrice;
window.saveContractorPricingConfig = saveContractorPricingConfig;
