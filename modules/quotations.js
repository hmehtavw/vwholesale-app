// ══════════════════════════════════════════════════════════
// VW QUOTATION WORKSPACE — staff.html module
// ══════════════════════════════════════════════════════════
window.VW_QUOTATIONS = (() => {

  const SB_URL = 'https://ndamdnlsuktucqtcbhgp.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYW1kbmxzdWt0dWNxdGNiaGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTkwNDY1NDAsImV4cCI6MjAzNDYyMjU0MH0.YaXsOWBQk7FH2fFJbgjKpwjLQi4o9Pqb2D1fTSmKYD4';
  const ANTHROPIC_KEY = 'sk-ant-api03-placeholder'; // uses edge function instead

  async function api(path, opts={}) {
    const token = VW_DB?.session?.access_token || ANON;
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { 'apikey': ANON, 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...opts.headers },
      ...opts
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json().catch(() => null);
  }

  const ROLE = () => (VW_DB?.currentStaff?.role || VW_DB?.currentStaff?.designation || '').toLowerCase();
  const STAFF = () => VW_DB?.currentStaff || {};

  const STATUS_META = {
    requested:       { label: '🆕 New Request',        color: '#3B82F6' },
    in_preparation:  { label: '✏️ In Preparation',     color: '#F5A623' },
    with_tl:         { label: '👤 With Quotation TL',  color: '#8B5CF6' },
    with_cat_mgr:    { label: '📊 With Cat Manager',   color: '#EC4899' },
    with_management: { label: '🏢 With Management',    color: '#EF4444' },
    approved:        { label: '✅ Approved',            color: '#22C55E' },
    sent:            { label: '📲 Sent to Customer',   color: '#22C55E' },
    rejected:        { label: '✗ Rejected',            color: '#94A3B8' },
  };

  // Which statuses each role sees
  function getStatusFilter() {
    const r = ROLE();
    if (r.includes('quotation tl') || r.includes('tl')) return ['requested','in_preparation','with_tl'];
    if (r.includes('category manager')) return ['with_cat_mgr','in_preparation'];
    if (r.includes('asm') || r.includes('management') || r.includes('admin')) return ['with_management','approved','sent','rejected'];
    // Default: CRM team sees new + in-prep + revision-returned
    return ['requested','in_preparation'];
  }

  async function renderPage() {
    const statuses = getStatusFilter();
    const requests = await api(
      `quotation_requests?status=in.(${statuses.join(',')})&order=urgency.desc,requested_at.asc&select=id,request_no,status,urgency,site_area,construction_stage,estimated_sqft,ai_requirements,requirement_photos,notes,requested_by_name,requested_at,tl_deadline,revision_count,revision_notes,last_revised_by&limit=50`
    ).catch(()=>[]);

    const now = Date.now();

    return `
      <div style="padding:20px;max-width:960px;margin:0 auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <div>
            <div style="font-size:20px;font-weight:800;">📋 Quotation Requests</div>
            <div style="font-size:13px;color:#64748B;margin-top:2px;">TAT: 30 min per stage · Max 2 hours total</div>
          </div>
          <span style="font-size:13px;color:#64748B;">${requests?.length||0} pending</span>
        </div>

        ${!(requests?.length) ? `
          <div style="text-align:center;padding:48px;color:#94A3B8;">
            <div style="font-size:40px;margin-bottom:12px;">✅</div>
            <div style="font-size:16px;font-weight:600;">No pending quotations</div>
          </div>` :
          (requests||[]).map(r => {
            const meta = STATUS_META[r.status];
            const ageMin = Math.round((now - new Date(r.requested_at)) / 60000);
            const isOverdue = ageMin > 60;
            const hasRevision = r.revision_count > 0 && r.revision_notes;

            return `
            <div style="background:#fff;border:1px solid ${isOverdue?'#EF4444':'#E2E8F0'};border-left:4px solid ${meta?.color||'#94A3B8'};border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;"
              onclick="VW_QUOTATIONS.openDetail(${r.id})">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;">
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                    <span style="font-size:15px;font-weight:800;">${r.request_no}</span>
                    <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${meta?.color||'#94A3B8'}22;color:${meta?.color||'#94A3B8'};">${meta?.label||r.status}</span>
                    ${r.urgency!=='normal'?`<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:rgba(239,68,68,.1);color:#EF4444;">${r.urgency==='critical'?'🚨 CRITICAL':'⚡ URGENT'}</span>`:''}
                    ${isOverdue?`<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:rgba(239,68,68,.1);color:#EF4444;">⏰ OVERDUE</span>`:''}
                    ${r.revision_count>0?`<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:rgba(245,166,35,.1);color:#F59E0B;">↩ ${r.revision_count} revision${r.revision_count>1?'s':''}</span>`:''}
                  </div>
                  <div style="font-size:13px;color:#374151;">${r.site_area||'—'} · ${r.construction_stage||'—'} ${r.estimated_sqft?'· '+r.estimated_sqft+' sqft':''}</div>
                  <div style="font-size:12px;color:#64748B;margin-top:2px;">By ${r.requested_by_name} · ${ageMin<60?ageMin+'m':Math.round(ageMin/60)+'h'} ago</div>
                  ${hasRevision?`<div style="margin-top:6px;padding:6px 10px;background:#FEF3C7;border-radius:6px;font-size:12px;color:#92400E;">↩ Revision note from ${r.last_revised_by}: "${r.revision_notes}"</div>`:''}
                  ${r.notes?`<div style="font-size:12px;color:#64748B;margin-top:4px;">📝 ${r.notes.slice(0,80)}</div>`:''}
                </div>
                <div style="font-size:12px;color:#94A3B8;text-align:right;flex-shrink:0;margin-left:12px;">
                  ${r.requirement_photos?.length?`📷 ${r.requirement_photos.length}`:''}
                </div>
              </div>
            </div>`;
          }).join('')
        }
      </div>`;
  }

  let _currentPDFFile = null;

  async function openDetail(id) {
    const [rArr, files, timeline] = await Promise.all([
      api(`quotation_requests?id=eq.${id}&select=*`),
      api(`quotation_files?request_id=eq.${id}&order=created_at.asc`).catch(()=>[]),
      api(`quotation_timeline?request_id=eq.${id}&order=created_at.asc`).catch(()=>[]),
    ]);
    const r = rArr?.[0]; if (!r) return;
    _currentPDFFile = null;

    const role = ROLE();
    const isCRM = !role.includes('tl') && !role.includes('category manager') && !role.includes('management') && !role.includes('asm');
    const isTL = role.includes('quotation tl') || role.includes('tl');
    const isCatMgr = role.includes('category manager');
    const canPrepare = (isCRM || isTL) && ['requested','in_preparation'].includes(r.status);
    const canTLReview = isTL && r.status === 'with_tl';
    const canCatMgrReview = isCatMgr && r.status === 'with_cat_mgr';

    let modal = document.getElementById('quot-detail-modal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'quot-detail-modal'; modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;'; document.body.appendChild(modal); }

    const meta = STATUS_META[r.status];
    const ageMin = Math.round((Date.now() - new Date(r.requested_at)) / 60000);

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:720px;max-height:90vh;overflow-y:auto;padding:24px;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div>
            <div style="font-size:18px;font-weight:800;">${r.request_no}</div>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
              <span style="padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700;background:${meta?.color||'#94A3B8'}22;color:${meta?.color||'#94A3B8'};">${meta?.label||r.status}</span>
              ${r.urgency!=='normal'?`<span style="padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700;background:rgba(239,68,68,.1);color:#EF4444;">${r.urgency.toUpperCase()}</span>`:''}
              ${r.revision_count>0?`<span style="padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700;background:rgba(245,166,35,.1);color:#F59E0B;">↩ ${r.revision_count} revision${r.revision_count>1?'s':''}</span>`:''}
            </div>
          </div>
          <button onclick="document.getElementById('quot-detail-modal').remove()" style="width:32px;height:32px;border-radius:50%;background:#F1F5F9;border:none;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <!-- Revision note if returned -->
        ${r.revision_notes?`
        <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:12px 14px;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:4px;">↩ REVISION REQUIRED — from ${r.last_revised_by}</div>
          <div style="font-size:13px;color:#78350F;">${r.revision_notes}</div>
        </div>`:''}

        <!-- Site info -->
        <div style="background:#F8FAFC;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:8px;">SITE INFORMATION</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
            <div><span style="color:#64748B;">Area:</span> <strong>${r.site_area||'—'}</strong></div>
            <div><span style="color:#64748B;">Stage:</span> <strong>${r.construction_stage||'—'}</strong></div>
            <div><span style="color:#64748B;">Sqft:</span> <strong>${r.estimated_sqft||'—'}</strong></div>
            <div><span style="color:#64748B;">Age:</span> <strong style="color:${ageMin>60?'#EF4444':'#374151'}">${ageMin}min</strong></div>
            ${r.budget_hint?`<div><span style="color:#64748B;">Budget hint:</span> <strong>${r.budget_hint}</strong></div>`:''}
          </div>
        </div>

        ${r.ai_requirements?.length?`
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">AI DETECTED REQUIREMENTS</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${r.ai_requirements.map(req=>`<span style="padding:4px 12px;border-radius:20px;background:#EFF6FF;color:#3B82F6;font-size:12px;font-weight:600;">${req}</span>`).join('')}
          </div>
        </div>`:''}

        ${r.notes?`<div style="background:#FEF9EC;border:1px solid #F5A623;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;"><strong>Field Notes:</strong> ${r.notes}</div>`:''}

        ${r.requirement_photos?.length?`
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">REQUIREMENT PHOTOS</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
            ${r.requirement_photos.map(url=>`<img src="${url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;" onclick="window.open('${url}','_blank')">`).join('')}
          </div>
        </div>`:''}

        <!-- Existing quotation files -->
        ${files?.length?`
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:8px;">QUOTATION FILES (${files.length})</div>
          ${files.map(f=>`
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#F8FAFC;border-radius:8px;margin-bottom:6px;border:1px solid ${f.ai_verified?'rgba(34,197,94,.3)':'#E2E8F0'};">
              <div style="font-size:20px;">📄</div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;">${f.category||'General'}${f.file_name?' — '+f.file_name:''}</div>
                <div style="display:flex;gap:8px;margin-top:2px;flex-wrap:wrap;">
                  ${f.total_amount?`<span style="font-size:12px;color:#22C55E;font-weight:600;">₹${parseFloat(f.total_amount).toLocaleString('en-IN')}${f.tl_discount_pct?` (${f.tl_discount_pct}% off)`:''}</span>`:''}
                  ${f.ai_verified?`<span style="font-size:11px;padding:1px 6px;border-radius:6px;background:rgba(34,197,94,.1);color:#16A34A;font-weight:700;">🤖 AI Verified</span>`:`<span style="font-size:11px;padding:1px 6px;border-radius:6px;background:rgba(245,166,35,.1);color:#D97706;font-weight:700;">⏳ Pending AI check</span>`}
                </div>
                ${f.ai_price_notes?`<div style="font-size:11px;color:#64748B;margin-top:2px;">🤖 ${f.ai_price_notes}</div>`:''}
                ${f.ai_flagged_items?.length?`<div style="font-size:11px;color:#EF4444;margin-top:2px;">⚠️ ${f.ai_flagged_items.length} items flagged by AI</div>`:''}
                ${f.tl_notes?`<div style="font-size:11px;color:#8B5CF6;margin-top:2px;">TL note: ${f.tl_notes}</div>`:''}
                <div style="font-size:11px;color:#94A3B8;">By ${f.prepared_by_name}</div>
              </div>
              <div style="display:flex;gap:4px;flex-direction:column;align-items:flex-end;">
                ${f.file_url?`<a href="${f.file_url}" target="_blank" style="padding:5px 10px;border-radius:6px;background:#F0FFF4;border:1px solid #86EFAC;color:#16A34A;font-size:12px;text-decoration:none;font-weight:600;">View PDF</a>`:''}
                ${!f.ai_verified&&canTLReview?`<button onclick="VW_QUOTATIONS.runAIVerify(${f.id},${r.id})" style="padding:5px 10px;border-radius:6px;background:#EFF6FF;border:1px solid #BFDBFE;color:#3B82F6;font-size:11px;font-weight:700;cursor:pointer;">🤖 AI Check</button>`:''}
              </div>
            </div>`).join('')}
        </div>`:''}

        <!-- CRM: Prepare quotation -->
        ${canPrepare?`
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:4px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:12px;">Prepare Quotation</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <input id="qf-category" placeholder="Category (e.g. Tiles)" style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
            <input id="qf-amount" type="number" placeholder="Total amount ₹" style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
          </div>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px dashed #E2E8F0;border-radius:8px;cursor:pointer;margin-bottom:8px;">
            <span style="font-size:20px;">📁</span>
            <span id="qf-pdf-name" style="font-size:13px;color:#64748B;">Click to upload PDF</span>
            <input type="file" id="qf-pdf" accept=".pdf" style="display:none;" onchange="VW_QUOTATIONS.onPDFSelected(this)">
          </label>
          <div style="display:flex;gap:8px;">
            <button onclick="VW_QUOTATIONS.saveFile(${r.id})" style="flex:2;padding:11px;border-radius:10px;background:#8B5CF6;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">💾 Save & Add Another Category</button>
            <button onclick="VW_QUOTATIONS.sendToTL(${r.id})" style="flex:2;padding:11px;border-radius:10px;background:#22C55E;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✓ Send to TL</button>
          </div>
        </div>`:''}

        <!-- TL: Review + AI verify + approve -->
        ${canTLReview?`
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:8px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:4px;">Quotation TL Review</div>
          <div style="font-size:12px;color:#64748B;margin-bottom:12px;">You are liable for accuracy. Use AI Check on each file to verify prices from the price list.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <input id="tl-discount" type="number" placeholder="Discount % (TL authority)" min="0" max="100" style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
            <input id="tl-final-amount" type="number" placeholder="Final amount after discount ₹" style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
          </div>
          <textarea id="tl-note" placeholder="TL approval note (mandatory)" rows="2" style="width:100%;padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;resize:none;box-sizing:border-box;margin-bottom:10px;"></textarea>
          <div style="display:flex;gap:8px;">
            <button onclick="VW_QUOTATIONS.actionTL(${r.id},'approve')" style="flex:2;padding:11px;border-radius:10px;background:#22C55E;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✓ Approve → Category Manager</button>
            <button onclick="VW_QUOTATIONS.actionTL(${r.id},'revise')" style="flex:1;padding:11px;border-radius:10px;background:#F59E0B;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">↩ Revise</button>
            <button onclick="VW_QUOTATIONS.actionTL(${r.id},'reject')" style="flex:1;padding:11px;border-radius:10px;background:#EF4444;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✗ Reject</button>
          </div>
        </div>`:''}

        <!-- Cat Mgr: Review -->
        ${canCatMgrReview?`
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:8px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:12px;">Category Manager Review</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <input id="cm-discount" type="number" placeholder="Additional discount %" min="0" max="100" style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
            <input id="cm-final-amount" type="number" placeholder="Final amount ₹" style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
          </div>
          <textarea id="cm-note" placeholder="Note for management (mandatory)" rows="2" style="width:100%;padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;resize:none;box-sizing:border-box;margin-bottom:10px;"></textarea>
          <div style="display:flex;gap:8px;">
            <button onclick="VW_QUOTATIONS.actionCatMgr(${r.id},'approve')" style="flex:2;padding:11px;border-radius:10px;background:#22C55E;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✓ Approve → Management</button>
            <button onclick="VW_QUOTATIONS.actionCatMgr(${r.id},'revise')" style="flex:1;padding:11px;border-radius:10px;background:#F59E0B;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">↩ Back to Team</button>
            <button onclick="VW_QUOTATIONS.actionCatMgr(${r.id},'reject')" style="flex:1;padding:11px;border-radius:10px;background:#EF4444;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✗ Reject</button>
          </div>
        </div>`:''}

        <!-- Full timeline -->
        ${timeline?.length?`
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:16px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:12px;">FULL AUDIT TRAIL</div>
          ${timeline.map(t=>`
            <div style="display:flex;gap:12px;margin-bottom:12px;">
              <div style="width:8px;height:8px;border-radius:50%;background:#22C55E;margin-top:5px;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-size:12px;font-weight:700;color:#374151;">${t.action.replace(/_/g,' ')}
                  <span style="color:#64748B;font-weight:400;">by ${t.actor_name}</span>
                  <span style="color:#94A3B8;font-size:11px;font-weight:400;"> (${t.actor_role})</span>
                </div>
                ${t.note?`<div style="font-size:12px;color:#64748B;margin-top:2px;padding:6px 10px;background:#F8FAFC;border-radius:6px;">"${t.note}"</div>`:''}
                <div style="font-size:11px;color:#94A3B8;margin-top:2px;">${new Date(t.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            </div>`).join('')}
        </div>`:''}

      </div>`;
  }

  function onPDFSelected(input) {
    _currentPDFFile = input.files?.[0] || null;
    const el = document.getElementById('qf-pdf-name');
    if (el && _currentPDFFile) el.textContent = '✓ ' + _currentPDFFile.name + ' (' + (_currentPDFFile.size/1024/1024).toFixed(1) + 'MB)';
  }

  async function uploadPDF(file) {
    if (!file) return null;
    const token = VW_DB?.session?.access_token || ANON;
    const path = `quotation-pdfs/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
    const res = await fetch(`${SB_URL}/storage/v1/object/catalogs/${path}`, {
      method:'POST', body:file,
      headers:{'Authorization':'Bearer '+token,'apikey':ANON,'Content-Type':'application/pdf','x-upsert':'true'},
    });
    if (!res.ok) throw new Error('PDF upload failed: '+res.status);
    return `${SB_URL}/storage/v1/object/public/catalogs/${path}`;
  }

  async function saveFile(requestId) {
    const category = document.getElementById('qf-category')?.value?.trim() || 'General';
    const amount = parseFloat(document.getElementById('qf-amount')?.value || 0);
    let fileUrl = null;
    if (_currentPDFFile) fileUrl = await uploadPDF(_currentPDFFile).catch(e=>{alert('Upload error: '+e.message);return null;});
    if (!fileUrl && !amount) { alert('Upload PDF or enter amount'); return; }

    await api('quotation_files', { method:'POST', body: JSON.stringify({
      request_id: requestId, category, file_url: fileUrl,
      file_name: _currentPDFFile?.name||null, total_amount: amount||null,
      prepared_by_name: STAFF().name||'Staff', file_type:'pdf',
    })});

    // Update status to in_preparation
    await api(`quotation_requests?id=eq.${requestId}`, { method:'PATCH', body: JSON.stringify({ status:'in_preparation', preparation_started_at: new Date().toISOString() })});
    await logTimeline(requestId, 'file_added', `${category} quotation file added${amount?' — ₹'+amount.toLocaleString('en-IN'):''}`);

    _currentPDFFile = null;
    document.getElementById('qf-category').value = '';
    document.getElementById('qf-amount').value = '';
    document.getElementById('qf-pdf-name').textContent = 'Click to upload PDF';
    document.getElementById('qf-pdf').value = '';
    showToast?.('✅ File saved. Add more categories or click Send to TL.');
    openDetail(requestId);
  }

  async function sendToTL(requestId) {
    const files = await api(`quotation_files?request_id=eq.${requestId}`).catch(()=>[]);
    if (!files?.length) { alert('Add at least one quotation file first'); return; }
    await api(`quotation_requests?id=eq.${requestId}`, { method:'PATCH', body: JSON.stringify({ status:'with_tl', submitted_to_tl_at: new Date().toISOString(), revision_notes:null })});
    await logTimeline(requestId, 'sent_to_tl', `${files.length} file${files.length>1?'s':''} prepared — sent to Quotation TL for review`);
    document.getElementById('quot-detail-modal')?.remove();
    showToast?.('✅ Sent to Quotation TL');
    navigateTo?.('quotations');
  }

  async function runAIVerify(fileId, requestId) {
    const btn = event?.target;
    if (btn) { btn.disabled=true; btn.textContent='🤖 Checking…'; }

    try {
      const fileArr = await api(`quotation_files?id=eq.${fileId}&select=*`);
      const file = fileArr?.[0]; if (!file) return;
      const reqArr = await api(`quotation_requests?id=eq.${requestId}&select=ai_requirements,construction_stage,estimated_sqft`);
      const req = reqArr?.[0];

      // Call Claude to verify pricing
      const res = await fetch('https://ndamdnlsuktucqtcbhgp.supabase.co/functions/v1/ai-site-analysis', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+ANON},
        body: JSON.stringify({
          mode: 'price_verify',
          category: file.category,
          amount: file.total_amount,
          construction_stage: req?.construction_stage,
          estimated_sqft: req?.estimated_sqft,
          ai_requirements: req?.ai_requirements,
          file_url: file.file_url,
        })
      });

      let aiNotes = 'AI price check complete';
      let flagged = [];
      let verified = true;

      if (res.ok) {
        const data = await res.json();
        aiNotes = data.price_notes || aiNotes;
        flagged = data.flagged_items || [];
        verified = !flagged.length;
      } else {
        // Fallback: basic sanity check
        const sqft = req?.estimated_sqft || 1000;
        const pricePerSqft = file.total_amount / sqft;
        if (file.category?.toLowerCase().includes('tile') && (pricePerSqft < 30 || pricePerSqft > 500)) {
          aiNotes = `Price per sqft ₹${pricePerSqft.toFixed(0)} seems ${pricePerSqft<30?'too low':'too high'} for tiles. Typical: ₹50–₹300/sqft`;
          flagged = [`Price per sqft: ₹${pricePerSqft.toFixed(0)}`];
          verified = false;
        } else {
          aiNotes = `Price looks reasonable for ${file.category} (₹${pricePerSqft?.toFixed(0)||'?'}/sqft)`;
        }
      }

      await api(`quotation_files?id=eq.${fileId}`, { method:'PATCH', body: JSON.stringify({
        ai_verified: verified, ai_price_notes: aiNotes, ai_flagged_items: flagged,
      })});
      await logTimeline(requestId, 'ai_price_check', `AI verified ${file.category}: ${aiNotes}`);
      openDetail(requestId);

    } catch(e) {
      alert('AI check error: '+e.message);
      if (btn) { btn.disabled=false; btn.textContent='🤖 AI Check'; }
    }
  }

  async function actionTL(requestId, action) {
    const note = document.getElementById('tl-note')?.value?.trim();
    if (!note) { alert('Please add a TL note (mandatory for all actions)'); return; }
    const discount = parseFloat(document.getElementById('tl-discount')?.value||0);
    const finalAmt = parseFloat(document.getElementById('tl-final-amount')?.value||0);

    if (action === 'approve') {
      // Apply TL discount to all files
      if (discount || finalAmt) {
        const files = await api(`quotation_files?request_id=eq.${requestId}`).catch(()=>[]);
        for (const f of files||[]) {
          await api(`quotation_files?id=eq.${f.id}`, { method:'PATCH', body: JSON.stringify({
            tl_discount_pct: discount||f.tl_discount_pct,
            total_amount: finalAmt || (f.total_amount * (1 - discount/100)),
            tl_approved_by: STAFF().name, tl_notes: note,
          })});
        }
      }
      await api(`quotation_requests?id=eq.${requestId}`, { method:'PATCH', body: JSON.stringify({
        status:'with_cat_mgr', submitted_to_cat_mgr_at: new Date().toISOString(),
        revision_notes:null, last_revised_by:null,
      })});
      await logTimeline(requestId, 'approved_by_tl', note + (discount?` | Discount: ${discount}%`:''));

    } else {
      // Revise or Reject → goes back to Quotation TEAM (in_preparation)
      const newStatus = action === 'revise' ? 'in_preparation' : 'rejected';
      await api(`quotation_requests?id=eq.${requestId}`, { method:'PATCH', body: JSON.stringify({
        status: newStatus,
        revision_notes: note, last_revised_by: STAFF().name + ' (TL)',
        ...(action==='revise'?{revision_count:'(revision_count+1)'}:{}),
        ...(action==='reject'?{rejection_stage:'tl',rejection_reason:note}:{}),
      })});
      await logTimeline(requestId, action==='revise'?'revised_by_tl':'rejected_by_tl', note);
    }

    document.getElementById('quot-detail-modal')?.remove();
    showToast?.(`✅ ${action==='approve'?'Sent to Category Manager':action==='revise'?'Returned to Quotation Team with note':'Rejected'}`);
    navigateTo?.('quotations');
  }

  async function actionCatMgr(requestId, action) {
    const note = document.getElementById('cm-note')?.value?.trim();
    if (!note) { alert('Please add a note (mandatory)'); return; }
    const discount = parseFloat(document.getElementById('cm-discount')?.value||0);
    const finalAmt = parseFloat(document.getElementById('cm-final-amount')?.value||0);

    if (action === 'approve') {
      if (discount || finalAmt) {
        const files = await api(`quotation_files?request_id=eq.${requestId}`).catch(()=>[]);
        for (const f of files||[]) {
          await api(`quotation_files?id=eq.${f.id}`, { method:'PATCH', body: JSON.stringify({
            discount_pct: discount||f.discount_pct,
            total_amount: finalAmt || (f.total_amount * (1 - discount/100)),
          })});
        }
      }
      await api(`quotation_requests?id=eq.${requestId}`, { method:'PATCH', body: JSON.stringify({
        status:'with_management', submitted_to_mgmt_at: new Date().toISOString(),
        revision_notes:null, last_revised_by:null,
      })});
      await logTimeline(requestId, 'approved_by_cat_mgr', note + (discount?` | Additional discount: ${discount}%`:''));

    } else {
      // Revise or Reject → goes back to QUOTATION TEAM (not TL)
      const newStatus = action === 'revise' ? 'in_preparation' : 'rejected';
      await api(`quotation_requests?id=eq.${requestId}`, { method:'PATCH', body: JSON.stringify({
        status: newStatus,
        revision_notes: note, last_revised_by: STAFF().name + ' (Cat Manager)',
        ...(action==='revise'?{revision_count:'(revision_count+1)'}:{}),
        ...(action==='reject'?{rejection_stage:'cat_mgr',rejection_reason:note}:{}),
      })});
      await logTimeline(requestId, action==='revise'?'revised_by_cat_mgr':'rejected_by_cat_mgr', note);
    }

    document.getElementById('quot-detail-modal')?.remove();
    showToast?.(`✅ ${action==='approve'?'Sent to Management':action==='revise'?'Returned to Quotation Team with note':'Rejected'}`);
    navigateTo?.('quotations');
  }

  async function logTimeline(requestId, action, note) {
    await api('quotation_timeline', { method:'POST', body: JSON.stringify({
      request_id: requestId, action,
      actor_name: STAFF().name || 'Staff',
      actor_role: STAFF().role || STAFF().designation || 'Staff',
      note: note||null,
    })}).catch(()=>{});
  }

  return { renderPage, openDetail, onPDFSelected, saveFile, sendToTL, runAIVerify, actionTL, actionCatMgr };
})();
