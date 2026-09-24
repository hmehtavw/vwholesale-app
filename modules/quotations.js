// ══════════════════════════════════════════════════════════
// VW QUOTATION WORKSPACE — staff.html module
// CRM Team / Quotation TL / Category Manager views
// ══════════════════════════════════════════════════════════
window.VW_QUOTATIONS = (() => {

  const SB_URL = 'https://ndamdnlsuktucqtcbhgp.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYW1kbmxzdWt0dWNxdGNiaGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTkwNDY1NDAsImV4cCI6MjAzNDYyMjU0MH0.YaXsOWBQk7FH2fFJbgjKpwjLQi4o9Pqb2D1fTSmKYD4';

  async function api(path, opts={}) {
    const token = VW_DB?.session?.access_token || ANON;
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { 'apikey': ANON, 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...opts.headers },
      ...opts
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json().catch(() => null);
  }

  const ROLE = () => VW_DB?.currentStaff?.role || VW_DB?.currentStaff?.designation || '';

  // Status label + color per stage
  const STATUS_META = {
    requested:       { label: 'New Request',     color: '#3B82F6', bg: 'rgba(59,130,246,.12)' },
    in_preparation:  { label: 'In Preparation',  color: '#F5A623', bg: 'rgba(245,166,35,.12)' },
    with_tl:         { label: 'With TL',         color: '#8B5CF6', bg: 'rgba(139,92,246,.12)' },
    with_cat_mgr:    { label: 'With Cat Manager',color: '#EC4899', bg: 'rgba(236,72,153,.12)' },
    with_management: { label: 'With Management', color: '#EF4444', bg: 'rgba(239,68,68,.12)'  },
    approved:        { label: 'Approved',        color: '#22C55E', bg: 'rgba(34,197,94,.12)'  },
    sent:            { label: 'Sent to Customer',color: '#22C55E', bg: 'rgba(34,197,94,.12)'  },
    rejected:        { label: 'Rejected',        color: '#94A3B8', bg: 'rgba(148,163,184,.12)'},
  };

  async function renderPage() {
    const role = ROLE().toLowerCase();
    let statusFilter = [];
    if (role.includes('quotation tl') || role.includes('quotation team')) {
      statusFilter = ['requested','in_preparation','with_tl'];
    } else if (role.includes('category manager')) {
      statusFilter = ['with_cat_mgr'];
    } else {
      // Default — show all active ones
      statusFilter = ['requested','in_preparation','with_tl','with_cat_mgr','with_management'];
    }

    const query = statusFilter.length
      ? `quotation_requests?status=in.(${statusFilter.join(',')})&order=urgency.desc,requested_at.asc&select=id,request_no,status,urgency,site_area,construction_stage,estimated_sqft,ai_requirements,requirement_photos,notes,requested_by_name,requested_at,tl_deadline,cat_mgr_deadline,mgmt_deadline,revision_count`
      : `quotation_requests?order=requested_at.desc&limit=50&select=id,request_no,status,urgency,site_area,construction_stage,estimated_sqft,ai_requirements,requirement_photos,notes,requested_by_name,requested_at,tl_deadline,revision_count`;

    const requests = await api(query).catch(() => []);
    const now = new Date();

    return `
      <div style="padding:20px;max-width:960px;margin:0 auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <div>
            <div style="font-size:20px;font-weight:800;">📋 Quotation Requests</div>
            <div style="font-size:13px;color:#64748B;margin-top:2px;">TAT: 30 min per stage · Max 2 hours total</div>
          </div>
          <div style="font-size:13px;color:#64748B;">${requests?.length || 0} active</div>
        </div>

        ${!(requests?.length) ? `
          <div style="text-align:center;padding:48px;color:#64748B;">
            <div style="font-size:40px;margin-bottom:12px;">✅</div>
            <div style="font-size:16px;font-weight:600;">No pending quotations</div>
          </div>` :
          (requests||[]).map(r => {
            const meta = STATUS_META[r.status] || STATUS_META.requested;
            const ageMin = Math.round((now - new Date(r.requested_at)) / 60000);
            const ageStr = ageMin < 60 ? ageMin+'m ago' : Math.round(ageMin/60)+'h ago';
            const isOverdue = ageMin > 60;
            const isUrgent = r.urgency === 'urgent' || r.urgency === 'critical';
            const reqs = r.ai_requirements || [];

            return `
            <div style="background:#fff;border:1px solid ${isOverdue?'#EF4444':'#E2E8F0'};border-left:4px solid ${isOverdue?'#EF4444':meta.color};border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;"
              onclick="VW_QUOTATIONS.openDetail(${r.id})">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="font-size:14px;font-weight:800;color:#0F172A;">${r.request_no}</span>
                    <span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${meta.bg};color:${meta.color};">${meta.label}</span>
                    ${isUrgent ? `<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:rgba(239,68,68,.1);color:#EF4444;">${r.urgency==='critical'?'🚨 CRITICAL':'⚡ URGENT'}</span>` : ''}
                    ${isOverdue ? `<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:rgba(239,68,68,.1);color:#EF4444;">⏰ OVERDUE</span>` : ''}
                  </div>
                  <div style="font-size:13px;color:#374151;margin-bottom:4px;">${r.site_area||'—'} · ${r.construction_stage||'—'} ${r.estimated_sqft?'· '+r.estimated_sqft+' sqft':''}</div>
                  ${reqs.length ? `<div style="font-size:12px;color:#64748B;">Needs: ${reqs.slice(0,4).join(', ')}</div>` : ''}
                  ${r.notes ? `<div style="font-size:12px;color:#64748B;margin-top:2px;">📝 ${r.notes.slice(0,80)}${r.notes.length>80?'…':''}</div>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:12px;color:#64748B;">${r.requested_by_name}</div>
                  <div style="font-size:11px;color:${isOverdue?'#EF4444':'#94A3B8'};margin-top:2px;">${ageStr}</div>
                  ${r.requirement_photos?.length ? `<div style="font-size:11px;color:#64748B;margin-top:4px;">📷 ${r.requirement_photos.length} photo${r.requirement_photos.length>1?'s':''}</div>` : ''}
                  ${r.revision_count ? `<div style="font-size:11px;color:#F59E0B;margin-top:2px;">↩ ${r.revision_count} revision${r.revision_count>1?'s':''}</div>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')
        }
      </div>`;
  }

  async function openDetail(id) {
    const [r, files, timeline] = await Promise.all([
      api(`quotation_requests?id=eq.${id}&select=*`).then(d=>d?.[0]),
      api(`quotation_files?request_id=eq.${id}&order=created_at.asc`).catch(()=>[]),
      api(`quotation_timeline?request_id=eq.${id}&order=created_at.asc`).catch(()=>[]),
    ]);
    if (!r) return;

    const role = ROLE().toLowerCase();
    const meta = STATUS_META[r.status] || STATUS_META.requested;
    const now = new Date();
    const ageMin = Math.round((now - new Date(r.requested_at)) / 60000);
    const canPrepare = role.includes('quotation') && ['requested','in_preparation'].includes(r.status);
    const canApproveTL = (role.includes('quotation tl') || role.includes('tl')) && r.status === 'with_tl';
    const canApproveCatMgr = role.includes('category manager') && r.status === 'with_cat_mgr';
    const canApproveManagement = (role.includes('asm') || role.includes('management') || role.includes('admin')) && r.status === 'with_management';

    // Build modal
    let modal = document.getElementById('quot-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'quot-detail-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:700px;max-height:90vh;overflow-y:auto;padding:24px;">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-size:18px;font-weight:800;">${r.request_no}</div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <span style="padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700;background:${meta.bg};color:${meta.color};">${meta.label}</span>
              ${r.urgency!=='normal'?`<span style="padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700;background:rgba(239,68,68,.1);color:#EF4444;">${r.urgency.toUpperCase()}</span>`:''}
            </div>
          </div>
          <button onclick="document.getElementById('quot-detail-modal').remove()"
            style="width:32px;height:32px;border-radius:50%;background:#F1F5F9;border:none;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <!-- Site info (NO customer contact) -->
        <div style="background:#F8FAFC;border-radius:10px;padding:14px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:8px;">SITE INFORMATION</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
            <div><span style="color:#64748B;">Area:</span> <strong>${r.site_area||'—'}</strong></div>
            <div><span style="color:#64748B;">Stage:</span> <strong>${r.construction_stage||'—'}</strong></div>
            <div><span style="color:#64748B;">Sqft:</span> <strong>${r.estimated_sqft||'—'}</strong></div>
            <div><span style="color:#64748B;">By:</span> <strong>${r.requested_by_name}</strong></div>
            <div><span style="color:#64748B;">Age:</span> <strong style="color:${ageMin>60?'#EF4444':'#374151'}">${ageMin}min ago</strong></div>
            ${r.budget_hint?`<div><span style="color:#64748B;">Budget:</span> <strong>${r.budget_hint}</strong></div>`:''}
          </div>
        </div>

        ${r.ai_requirements?.length ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">AI REQUIREMENTS</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${r.ai_requirements.map(req=>`<span style="padding:4px 12px;border-radius:20px;background:#EFF6FF;color:#3B82F6;font-size:12px;font-weight:600;">${req}</span>`).join('')}
          </div>
        </div>` : ''}

        ${r.notes ? `
        <div style="background:#FEF9EC;border:1px solid #F5A623;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;">
          <strong>Field Notes:</strong> ${r.notes}
        </div>` : ''}

        ${r.requirement_photos?.length ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">REQUIREMENT PHOTOS</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
            ${r.requirement_photos.map(url=>`<img src="${url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;" onclick="window.open('${url}','_blank')">`).join('')}
          </div>
        </div>` : ''}

        <!-- Quotation files already prepared -->
        ${files?.length ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">QUOTATION FILES (${files.length})</div>
          ${files.map(f=>`
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#F8FAFC;border-radius:8px;margin-bottom:6px;">
              <div style="font-size:20px;">📄</div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;">${f.category||'General'} ${f.file_name?'— '+f.file_name:''}</div>
                ${f.total_amount?`<div style="font-size:12px;color:#22C55E;font-weight:600;">₹${f.total_amount.toLocaleString('en-IN')}${f.discount_pct?` (${f.discount_pct}% disc)`:''}</div>`:''}
                <div style="font-size:11px;color:#64748B;">By ${f.prepared_by_name||'—'}</div>
              </div>
              ${f.file_url?`<a href="${f.file_url}" target="_blank" style="padding:6px 12px;border-radius:6px;background:#F0FFF4;border:1px solid #86EFAC;color:#16A34A;font-size:12px;text-decoration:none;font-weight:600;">View PDF</a>`:''}
            </div>`).join('')}
        </div>` : ''}

        <!-- Actions based on role & status -->
        ${canPrepare ? `
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:8px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:12px;">Prepare Quotation</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <input id="qf-category" placeholder="Category (e.g. Tiles)" style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
            <input id="qf-amount" type="number" placeholder="Total amount (₹)" style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
          </div>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <label style="flex:1;padding:12px;border:2px dashed #E2E8F0;border-radius:8px;text-align:center;cursor:pointer;font-size:13px;color:#64748B;">
              📁 Upload PDF
              <input type="file" id="qf-pdf" accept=".pdf" style="display:none;" onchange="VW_QUOTATIONS.onPDFSelected(this)">
            </label>
            <div id="qf-pdf-name" style="flex:1;padding:12px;background:#F8FAFC;border-radius:8px;font-size:12px;color:#64748B;display:flex;align-items:center;">No file selected</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="VW_QUOTATIONS.saveAndSendToTL(${r.id})"
              style="flex:1;padding:11px;border-radius:10px;background:#8B5CF6;border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">
              ✓ Save & Send to TL
            </button>
            <button onclick="VW_QUOTATIONS.addMoreCategory(${r.id})"
              style="padding:11px 16px;border-radius:10px;background:#F8FAFC;border:1px solid #E2E8F0;color:#374151;font-size:14px;cursor:pointer;">
              + More Category
            </button>
          </div>
        </div>` : ''}

        ${canApproveTL ? `
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:8px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:12px;">TL Review</div>
          <textarea id="tl-note" placeholder="Note (optional — for revisions or adjustments)" rows="2"
            style="width:100%;padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;resize:none;box-sizing:border-box;margin-bottom:10px;"></textarea>
          <div style="display:flex;gap:8px;">
            <button onclick="VW_QUOTATIONS.actionTL(${r.id},'approve')"
              style="flex:1;padding:11px;border-radius:10px;background:#22C55E;border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">✓ Approve → Category Manager</button>
            <button onclick="VW_QUOTATIONS.actionTL(${r.id},'revise')"
              style="flex:1;padding:11px;border-radius:10px;background:#F59E0B;border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">↩ Revise</button>
            <button onclick="VW_QUOTATIONS.actionTL(${r.id},'reject')"
              style="flex:1;padding:11px;border-radius:10px;background:#EF4444;border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">✗ Reject</button>
          </div>
        </div>` : ''}

        ${canApproveCatMgr ? `
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:8px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:12px;">Category Manager Review</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <input id="cm-discount" type="number" placeholder="Discount % (if any)" min="0" max="100"
              style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
            <input id="cm-final-amount" type="number" placeholder="Final amount (₹)"
              style="padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;outline:none;">
          </div>
          <textarea id="cm-note" placeholder="Note for management (optional)" rows="2"
            style="width:100%;padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;resize:none;box-sizing:border-box;margin-bottom:10px;"></textarea>
          <div style="display:flex;gap:8px;">
            <button onclick="VW_QUOTATIONS.actionCatMgr(${r.id},'approve')"
              style="flex:1;padding:11px;border-radius:10px;background:#22C55E;border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">✓ Approve → Management</button>
            <button onclick="VW_QUOTATIONS.actionCatMgr(${r.id},'revise')"
              style="flex:1;padding:11px;border-radius:10px;background:#F59E0B;border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">↩ Revise</button>
            <button onclick="VW_QUOTATIONS.actionCatMgr(${r.id},'reject')"
              style="flex:1;padding:11px;border-radius:10px;background:#EF4444;border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">✗ Reject</button>
          </div>
        </div>` : ''}

        <!-- Timeline -->
        ${timeline?.length ? `
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:16px;">
          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:10px;">TIMELINE</div>
          ${timeline.map(t=>`
            <div style="display:flex;gap:10px;margin-bottom:8px;">
              <div style="width:8px;height:8px;border-radius:50%;background:#22C55E;margin-top:5px;flex-shrink:0;"></div>
              <div>
                <div style="font-size:12px;font-weight:600;">${t.action} <span style="color:#64748B;font-weight:400;">by ${t.actor_name} (${t.actor_role})</span></div>
                ${t.note?`<div style="font-size:12px;color:#64748B;">${t.note}</div>`:''}
                <div style="font-size:11px;color:#94A3B8;">${new Date(t.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            </div>`).join('')}
        </div>` : ''}

      </div>`;
  }

  let _currentQuotPDF = null;

  function onPDFSelected(input) {
    _currentQuotPDF = input.files?.[0] || null;
    const nameEl = document.getElementById('qf-pdf-name');
    if (nameEl && _currentQuotPDF) nameEl.textContent = '✓ ' + _currentQuotPDF.name;
  }

  async function uploadQuotPDF(file) {
    if (!file) return null;
    const token = VW_DB?.session?.access_token || ANON;
    const path = `quotation-pdfs/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
    const res = await fetch(`${SB_URL}/storage/v1/object/catalogs/${path}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer '+token, 'apikey': ANON, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
      body: file,
    });
    if (!res.ok) throw new Error('PDF upload failed');
    return `${SB_URL}/storage/v1/object/public/catalogs/${path}`;
  }

  async function saveAndSendToTL(requestId) {
    const category = document.getElementById('qf-category')?.value?.trim() || 'General';
    const amount = parseFloat(document.getElementById('qf-amount')?.value || 0);
    const staffName = VW_DB?.currentStaff?.name || 'Staff';

    let fileUrl = null;
    if (_currentQuotPDF) {
      fileUrl = await uploadQuotPDF(_currentQuotPDF).catch(e => { alert('PDF upload error: '+e.message); return null; });
    }

    if (!fileUrl && !amount) { alert('Upload a PDF or enter the total amount'); return; }

    await api('quotation_files', { method: 'POST', body: JSON.stringify({
      request_id: requestId, category, file_url: fileUrl,
      file_name: _currentQuotPDF?.name || null,
      total_amount: amount || null,
      prepared_by_name: staffName, file_type: 'pdf',
    })});

    await api(`quotation_requests?id=eq.${requestId}`, { method: 'PATCH', body: JSON.stringify({
      status: 'with_tl', submitted_to_tl_at: new Date().toISOString(),
    })});

    await api('quotation_timeline', { method: 'POST', body: JSON.stringify({
      request_id: requestId, action: 'sent_to_tl',
      actor_name: staffName, actor_role: VW_DB?.currentStaff?.role || 'CRM Team',
      note: `${category} quotation prepared${amount?' — ₹'+amount.toLocaleString('en-IN'):''}`,
    })});

    document.getElementById('quot-detail-modal')?.remove();
    showToast?.('✅ Sent to TL for review');
    navigateTo?.('quotations');
  }

  async function actionTL(requestId, action) {
    const note = document.getElementById('tl-note')?.value?.trim();
    const staffName = VW_DB?.currentStaff?.name || 'TL';

    const nextStatus = action === 'approve' ? 'with_cat_mgr' : action === 'revise' ? 'in_preparation' : 'rejected';
    await api(`quotation_requests?id=eq.${requestId}`, { method: 'PATCH', body: JSON.stringify({
      status: nextStatus,
      ...(action === 'approve' ? { submitted_to_cat_mgr_at: new Date().toISOString() } : {}),
      ...(action !== 'approve' ? { revision_count: '(revision_count + 1)' } : {}),
      ...(action === 'reject' ? { rejection_stage: 'tl', rejection_reason: note } : {}),
    })});

    await api('quotation_timeline', { method: 'POST', body: JSON.stringify({
      request_id: requestId,
      action: action === 'approve' ? 'approved_by_tl' : action === 'revise' ? 'revised_by_tl' : 'rejected_by_tl',
      actor_name: staffName, actor_role: 'Quotation TL', note: note || null,
    })});

    document.getElementById('quot-detail-modal')?.remove();
    showToast?.(`✅ ${action === 'approve' ? 'Sent to Category Manager' : action === 'revise' ? 'Sent back for revision' : 'Rejected'}`);
    navigateTo?.('quotations');
  }

  async function actionCatMgr(requestId, action) {
    const note = document.getElementById('cm-note')?.value?.trim();
    const discount = parseFloat(document.getElementById('cm-discount')?.value || 0);
    const finalAmount = parseFloat(document.getElementById('cm-final-amount')?.value || 0);
    const staffName = VW_DB?.currentStaff?.name || 'Category Manager';

    const nextStatus = action === 'approve' ? 'with_management' : action === 'revise' ? 'with_tl' : 'rejected';

    // Update file discount if provided
    if ((discount || finalAmount) && action === 'approve') {
      const files = await api(`quotation_files?request_id=eq.${requestId}`).catch(()=>[]);
      if (files?.length) {
        await api(`quotation_files?request_id=eq.${requestId}`, { method: 'PATCH', body: JSON.stringify({
          discount_pct: discount || null,
          total_amount: finalAmount || files[0].total_amount,
        })});
      }
    }

    await api(`quotation_requests?id=eq.${requestId}`, { method: 'PATCH', body: JSON.stringify({
      status: nextStatus,
      ...(action === 'approve' ? { submitted_to_mgmt_at: new Date().toISOString() } : {}),
      ...(action === 'reject' ? { rejection_stage: 'cat_mgr', rejection_reason: note } : {}),
    })});

    await api('quotation_timeline', { method: 'POST', body: JSON.stringify({
      request_id: requestId,
      action: action === 'approve' ? 'approved_by_cat_mgr' : action === 'revise' ? 'revised_by_cat_mgr' : 'rejected_by_cat_mgr',
      actor_name: staffName, actor_role: 'Category Manager', note: note || null,
    })});

    document.getElementById('quot-detail-modal')?.remove();
    showToast?.(`✅ ${action === 'approve' ? 'Sent to Management for final approval' : action === 'revise' ? 'Sent back to TL' : 'Rejected'}`);
    navigateTo?.('quotations');
  }

  return { renderPage, openDetail, onPDFSelected, saveAndSendToTL, actionTL, actionCatMgr };
})();
