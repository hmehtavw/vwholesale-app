

async function generateReview(typeOverride, btnEl) {
  const period = typeOverride || document.getElementById('review-period')?.value || 'monthly';
  const btn = btnEl || document.querySelector('[onclick="generateReview()"]');
  const out = document.getElementById('review-output');
  if (btn) { btn.textContent = '⏳ Generating…'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:12px">⏳ AI is analysing your content performance…</div>';

  try {
    const now = new Date();
    let startDate, endDate = now.toISOString(), periodLabel;

    if (period === 'weekly') {
      startDate = new Date(now.getTime()-7*86400000).toISOString();
      periodLabel = 'Week of '+new Date(now.getTime()-7*86400000).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
    } else if (period === 'fortnightly') {
      startDate = new Date(now.getTime()-14*86400000).toISOString();
      periodLabel = 'Fortnight ending '+now.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
    } else if (period === 'monthly') {
      const m = document.getElementById('review-month')?.value || now.toISOString().slice(0,7);
      const [yr,mo] = m.split('-').map(Number);
      startDate = new Date(yr,mo-1,1).toISOString();
      endDate = new Date(yr,mo,0,23,59,59).toISOString();
      periodLabel = new Date(yr,mo-1,1).toLocaleString('en-IN',{month:'long',year:'numeric'});
    } else if (period === 'quarterly') {
      const q = Math.floor(now.getMonth()/3);
      startDate = new Date(now.getFullYear(),q*3,1).toISOString();
      periodLabel = now.getFullYear()+'-Q'+(q+1);
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(),0,1).toISOString();
      periodLabel = 'Year '+now.getFullYear();
    } else if (period === 'custom') {
      startDate = new Date(document.getElementById('review-from')?.value).toISOString();
      endDate = new Date(document.getElementById('review-to')?.value+'T23:59:59').toISOString();
      periodLabel = document.getElementById('review-from')?.value+' to '+document.getElementById('review-to')?.value;
    }

    // Fetch period data
    const [
      {data: posts},
      {data: channels},
      {data: perf},
      {data: calItems},
      {data: stratSessions}
    ] = await Promise.all([
      sb.from('content_posts').select('topic,post_type,language,status').gte('created_at', startDate).lte('created_at', endDate).then(r=>r,()=>({data:[]})),
      sb.from('channel_posts').select('channel,status').gte('created_at', startDate).lte('created_at', endDate).then(r=>r,()=>({data:[]})),
      sb.from('post_performance').select('*').gte('recorded_at', startDate).lte('recorded_at', endDate).then(r=>r,()=>({data:[]})),
      sb.from('content_calendar').select('topic,content_type,status').gte('cal_date', startDate.split('T')[0]).lte('cal_date', endDate.split('T')[0]).then(r=>r,()=>({data:[]})),
      sb.from('strategy_sessions').select('summary,key_themes').gte('created_at', startDate).then(r=>r,()=>({data:[]}))
    ]);

    const res = await fetch(MKT_SB_URL+'/functions/v1/content-notifications', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action: 'generate_review',
        period_type: period,
        period_label: periodLabel,
        start_date: startDate,
        end_date: endDate,
        data_summary: {
          total_posts: (posts||[]).length,
          published: (channels||[]).filter(c=>c.status==='published').length,
          channels_used: [...new Set((channels||[]).map(c=>c.channel))],
          formats: [...new Set((posts||[]).map(p=>p.post_type))],
          avg_engagement: (perf||[]).length ? ((perf||[]).reduce((a,p)=>a+(p.engagement_rate||0),0)/(perf||[]).length).toFixed(1) : null,
          planned_vs_actual: { planned:(calItems||[]).length, created:(posts||[]).length },
          strategy_themes: (stratSessions||[]).map(s=>s.key_themes).join(', ')
        }
      })
    });
    const data = await res.json();

    // Show inline
    const reviewData = data.review || data;
    if (out) out.innerHTML = `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:8px">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">📊 ${periodLabel} Review</div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
          ${[
            {l:'Posts created', v:(posts||[]).length},
            {l:'Published', v:(channels||[]).filter(c=>c.status==='published').length},
            {l:'Avg engagement', v:(perf||[]).length?((perf||[]).reduce((a,p)=>a+(p.engagement_rate||0),0)/(perf||[]).length).toFixed(1)+'%':'—'},
          ].map(s=>`<div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
            <div style="font-size:16px;font-weight:700;color:var(--gold)">${s.v}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${s.l}</div>
          </div>`).join('')}
        </div>

        ${reviewData.ai_recommendations?.length ? `
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase">AI Recommendations</div>
        ${reviewData.ai_recommendations.map(r=>`
        <div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
          <span style="background:${r.priority==='high'?'rgba(239,68,68,.2)':r.priority==='medium'?'rgba(245,158,11,.2)':'rgba(34,197,94,.2)'};
            color:${r.priority==='high'?'#ef4444':r.priority==='medium'?'#f59e0b':'#22c55e'};
            border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;flex-shrink:0;margin-top:2px">${(r.priority||'').toUpperCase()}</span>
          <div><div style="font-size:12px;font-weight:600">${r.action}</div><div style="font-size:11px;color:var(--text3)">${r.reason}</div></div>
        </div>`).join('')}` : '<div style="font-size:12px;color:var(--text3)">Review saved — no recommendations yet</div>'}

        <button onclick="approveReview('${reviewData.id||''}')" class="mkt-btn mkt-btn-primary" style="width:100%;margin-top:10px;padding:8px;font-size:12px">✅ Approve & Archive</button>
      </div>`;

    showMktToast('✅ '+periodLabel+' review generated');
  } catch(e) {
    if (out) out.innerHTML = `<div style="color:var(--red);padding:8px;font-size:12px">❌ ${e.message}</div>`;
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent = '📊 Generate Review'; btn.disabled = false; }
  }
}

async function approveReview(reviewId) {
  if (!reviewId) return;
  await sb.from('monthly_reviews').update({status:'approved'}).eq('id', reviewId);
  showMktToast('✅ Review approved — recommendations applied to future planning');
  renderAnalytics();
}


async function addGATracking() {
  const gaId = document.getElementById('ga-id').value.trim();
  if (!gaId.startsWith('G-')) { showMktToast('Enter valid GA4 ID (starts with G-)'); return; }
  await sb.from('marketing_settings').upsert({key:'ga4_measurement_id', value:gaId, is_secret:false, description:'Google Analytics 4 Measurement ID'},{onConflict:'key'});
  await sb.from('marketing_integrations').upsert({name:'Google Analytics 4', provider:'google', status:'connected', credentials_set:true, notes:`Measurement ID: ${gaId}`},{onConflict:'name'});
  showMktToast('✅ GA4 ID saved — tracking code will be added to all pages');
}

// ── AUDIT ──
async function renderAudit() {
  const { data: logs } = await sb.from('marketing_audit_logs').select('*').order('created_at',{ascending:false}).limit(50).then(r=>r,()=>({data:[]}));
  const { data: runs } = await sb.from('ai_agent_runs').select('*').order('created_at',{ascending:false}).limit(20).then(r=>r,()=>({data:[]}));

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Audit Logs</h3>
    <div style="font-size:12px;color:var(--text3)">Complete record of all marketing actions and AI runs</div>
  </div>

  <div class="mkt-tabs">
    <button class="mkt-tab active" onclick="showAuditTab('actions',this)">User Actions</button>
    <button class="mkt-tab" onclick="showAuditTab('ai',this)">AI Agent Runs</button>
  </div>

  <div id="audit-actions" class="mkt-card">
    ${(logs||[]).length > 0 ? `<table class="mkt-table">
      <tr><th>Action</th><th>By</th><th>Type</th><th>Date</th></tr>
      ${(logs||[]).map(l=>`<tr>
        <td style="font-weight:700">${l.action}</td>
        <td>${l.performed_by||'system'}</td>
        <td><span class="badge ${l.performed_by_type==='human'?'badge-blue':'badge-purple'}">${l.performed_by_type}</span></td>
        <td style="color:var(--text3);font-size:11px">${new Date(l.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
      </tr>`).join('')}
    </table>` : '<div class="mkt-empty"><div style="color:var(--text3);font-size:12px">No user actions logged yet</div></div>'}
  </div>

  <div id="audit-ai" style="display:none" class="mkt-card">
    ${(runs||[]).length > 0 ? `<table class="mkt-table">
      <tr><th>Agent</th><th>Trigger</th><th>Model</th><th>Cost</th><th>Status</th><th>Date</th></tr>
      ${(runs||[]).map(r=>`<tr>
        <td style="font-weight:700">${r.agent_name}</td>
        <td style="color:var(--text3)">${r.trigger}</td>
        <td style="font-size:11px;color:var(--text3)">${r.model}</td>
        <td style="color:var(--green)">$${(r.cost_usd||0).toFixed(4)}</td>
        <td><span class="badge ${r.status==='completed'?'badge-green':'badge-red'}">${r.status}</span></td>
        <td style="color:var(--text3);font-size:11px">${new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
      </tr>`).join('')}
    </table>` : '<div class="mkt-empty"><div style="color:var(--text3);font-size:12px">No AI runs yet</div></div>'}
  </div>`);
}

function showAuditTab(tab, btn) {
  document.querySelectorAll('.mkt-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('audit-actions').style.display = tab==='actions'?'block':'none';
  document.getElementById('audit-ai').style.display = tab==='ai'?'block':'none';
}

// ── SETTINGS ──
async function renderSettings() {
  const { data: settings } = await sb.from('marketing_settings').select('*').order('key').then(r=>r,()=>({data:[]}));

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">Settings</h3>
    <div style="font-size:12px;color:var(--text3)">Marketing panel configuration</div>
  </div>

  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">Team access</div>
    <div style="font-size:12px;color:var(--text3);line-height:1.7">
      Marketing access is managed in the <b>Staff Portal &rarr; Settings &rarr; Permissions</b>,
      alongside every other permission — one place, not two.<br><br>
      Give someone the <b>Marketing</b> permission to let them in here.
      Give <b>Inbox (customer chats)</b> instead if they only need to answer customers —
      that opens the inbox inside the Staff Portal, where they can also see the customer's
      orders and quotations while replying.<br><br>
      API keys and ad spend stay restricted to <b>admins</b>.
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">🛑 Global AI Control</div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg3);border-radius:10px">
      <div>
        <div style="font-weight:700">Pause All AI Actions</div>
        <div style="font-size:12px;color:var(--text3)">Emergency stop — AI switches to recommend-only mode</div>
      </div>
      <button class="mkt-btn ${_aiPaused?'mkt-btn-primary':'mkt-btn-ghost'}" onclick="toggleAIPause()" style="${aiPaused?'background:var(--red)':''}">
        ${aiPaused?'▶ Resume AI':'🛑 Pause AI'}
      </button>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">💰 Budget Controls</div>
    <div style="display:grid;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">Monthly Marketing Budget</div><div style="font-size:11px;color:var(--text3)">Total budget including ads and tools</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px">₹</span>
          <input type="number" id="setting-budget" value="${(settings||[]).find(s=>s.key==='marketing_budget_monthly_inr')?.value||30000}" class="mkt-form-input" style="width:100px">
          <button class="mkt-btn mkt-btn-ghost" onclick="saveSetting('marketing_budget_monthly_inr','setting-budget')" style="font-size:11px">Save</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">Auto-Spend Limit (per action)</div><div style="font-size:11px;color:var(--text3)">AI can spend up to this without approval</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px">₹</span>
          <input type="number" id="setting-auto-limit" value="${(settings||[]).find(s=>s.key==='marketing_budget_auto_limit_inr')?.value||5000}" class="mkt-form-input" style="width:100px">
          <button class="mkt-btn mkt-btn-ghost" onclick="saveSetting('marketing_budget_auto_limit_inr','setting-auto-limit')" style="font-size:11px">Save</button>
        </div>
      </div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">🤖 AI Model Settings</div>
    <div style="display:grid;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">Primary Model</div><div style="font-size:11px;color:var(--text3)">Used for complex tasks (AI CMO briefings)</div></div>
        <select id="setting-model" class="mkt-form-select" style="width:160px" onchange="saveSetting('openai_model_primary','setting-model')">
          <option value="gpt-4o" ${(settings||[]).find(s=>s.key==='openai_model_primary')?.value==='gpt-4o'?'selected':''}>GPT-4o</option>
          <option value="gpt-4o-mini" ${(settings||[]).find(s=>s.key==='openai_model_primary')?.value==='gpt-4o-mini'?'selected':''}>GPT-4o Mini</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">Fast Model</div><div style="font-size:11px;color:var(--text3)">Used for content, posts, quick tasks</div></div>
        <select id="setting-model-fast" class="mkt-form-select" style="width:160px" onchange="saveSetting('openai_model_fast','setting-model-fast')">
          <option value="gpt-4o-mini" ${(settings||[]).find(s=>s.key==='openai_model_fast')?.value==='gpt-4o-mini'?'selected':''}>GPT-4o Mini</option>
          <option value="gpt-4o" ${(settings||[]).find(s=>s.key==='openai_model_fast')?.value==='gpt-4o'?'selected':''}>GPT-4o</option>
        </select>
      </div>
    </div>
  </div>

  <div class="mkt-card">
    <div class="mkt-card-title">📋 All Settings</div>
    <table class="mkt-table">
      <tr><th>Key</th><th>Value</th></tr>
      ${(settings||[]).filter(s=>!s.is_secret).map(s=>`<tr>
        <td style="font-size:11px;color:var(--text3)">${s.key}</td>
        <td style="font-size:12px">${s.value}</td>
      </tr>`).join('')}
    </table>
  </div>`);
}

async function saveSetting(key, inputId) {
  const value = document.getElementById(inputId)?.value;
  if (!value) return;
  await sb.from('marketing_settings').update({value, updated_at:new Date().toISOString()}).eq('key',key);
  showMktToast('✅ Setting saved');
}

// ── POSTER STUDIO — Canvas Compositor (hero image + text overlay) ──
function openAIPhotoshoot() {
  const ov = document.createElement('div');
  ov.id = 'photoshoot-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:99999;overflow-y:auto;padding:20px';
  ov.innerHTML = `
    <div style="max-width:520px;margin:0 auto;background:var(--bg2);border-radius:14px;padding:20px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div style="font-size:16px;font-weight:900">🖼️ AI Photoshoot</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Upload a product photo → AI places it in 8 professional scenes</div>
        </div>
        <button onclick="document.getElementById('photoshoot-overlay').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">✕</button>
      </div>

      <!-- Upload Product -->
      <div style="margin-bottom:14px">
        <label class="mkt-form-label">Product photo <span style="color:var(--text3);font-weight:400">(tile, granite slab, sanitaryware, paint can, etc)</span></label>
        <label style="display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed var(--border);border-radius:10px;padding:20px;cursor:pointer;background:var(--bg3);min-height:100px" id="photoshoot-drop-zone">
          <span id="photoshoot-preview-area" style="font-size:36px">📷</span>
          <span id="photoshoot-upload-label" style="font-size:12px;color:var(--text3);margin-top:8px">Click to upload product photo</span>
          <input type="file" id="photoshoot-file" accept="image/*" onchange="photoshootPreview(this)" style="display:none">
        </label>
      </div>

      <!-- Product Name -->
      <div style="margin-bottom:14px">
        <label class="mkt-form-label">Product name / description</label>
        <input id="photoshoot-product" class="mkt-form-input" placeholder="e.g. Italian Carrara Marble 60x120cm, Jaquar Basin, Asian Paints Royale">
      </div>

      <!-- Scene Selection -->
      <div style="margin-bottom:14px">
        <label class="mkt-form-label">Select scenes <span style="color:var(--text3);font-weight:400">(choose up to 4)</span></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${[
            {id:'bathroom', icon:'🚿', label:'Luxury Bathroom'},
            {id:'kitchen', icon:'🍳', label:'Modern Kitchen'},
            {id:'living', icon:'🛋️', label:'Living Room'},
            {id:'bedroom', icon:'🛏️', label:'Master Bedroom'},
            {id:'showroom', icon:'🏪', label:'Showroom Display'},
            {id:'exterior', icon:'🏠', label:'Home Exterior'},
            {id:'construction', icon:'🏗️', label:'Under Construction'},
            {id:'studio', icon:'✨', label:'Studio / White Background'},
          ].map(s=>`
          <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px">
            <input type="checkbox" name="ps-scene" value="${s.id}" style="accent-color:var(--gold)"> ${s.icon} ${s.label}
          </label>`).join('')}
        </div>
      </div>

      <button onclick="runAIPhotoshoot()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-size:14px;font-weight:700">✨ Generate AI Photoshoot</button>
      <div id="photoshoot-results" style="margin-top:14px"></div>
    </div>`;
  document.body.appendChild(ov);
}

function photoshootPreview(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('photoshoot-preview-area');
    const label = document.getElementById('photoshoot-upload-label');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" style="max-height:80px;max-width:200px;border-radius:6px;object-fit:contain">`;
    if (label) label.textContent = file.name;
  };
  reader.readAsDataURL(file);
}

async function runAIPhotoshoot() {
  const fileInput = document.getElementById('photoshoot-file');
  const product = (document.getElementById('photoshoot-product')?.value||'').trim();
  const scenes = [...document.querySelectorAll('input[name="ps-scene"]:checked')].map(el=>el.value);

  if (!fileInput?.files?.[0]) { showMktToast('Upload a product photo first'); return; }
  if (!product) { showMktToast('Enter the product name'); return; }
  if (scenes.length === 0) { showMktToast('Select at least one scene'); return; }
  if (scenes.length > 4) { showMktToast('Select up to 4 scenes only'); return; }

  const btn = document.querySelector('[onclick="runAIPhotoshoot()"]');
  if (btn) { btn.textContent='⏳ Generating…'; btn.disabled=true; }

  const results = document.getElementById('photoshoot-results');
  if (results) results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">⏳ AI is creating your product scenes… (~30-60 seconds)</div>';

  const sceneLabels = {
    bathroom:'luxurious modern bathroom with marble walls and ambient lighting',
    kitchen:'contemporary modular kitchen with island counter',
    living:'elegant living room with neutral tones and natural light',
    bedroom:'master bedroom suite with designer furniture',
    showroom:'professional retail showroom display with spotlighting',
    exterior:'premium home exterior facade with landscaping',
    construction:'active construction site being tiled by workers',
    studio:'clean white studio background with soft shadows'
  };

  try {
    // Upload product image to Supabase storage first
    const file = fileInput.files[0];
    const fname = 'photoshoot/'+Date.now()+'_'+file.name.replace(/[^a-z0-9.]/gi,'_').toLowerCase();
    const { error: upErr } = await sb.storage.from('marketing-assets').upload(fname, file, {contentType:file.type, upsert:true});
    if (upErr) throw new Error('Upload failed: '+upErr.message);
    const { data: urlData } = sb.storage.from('marketing-assets').getPublicUrl(fname);
    const productUrl = urlData.publicUrl;

    // Generate scenes in parallel (max 2 at a time to avoid rate limits)
    const generatedImages = [];
    for (let i = 0; i < scenes.length; i += 2) {
      const batch = scenes.slice(i, i+2);
      const batchResults = await Promise.all(batch.map(async sceneId => {
        const res = await fetch(MKT_SB_URL+'/functions/v1/gbp-image', {
          method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
          body: JSON.stringify({
            action:'generate_scene',
            product_name: product,
            product_image_url: productUrl,
            scene: sceneLabels[sceneId] || sceneId,
            scene_id: sceneId,
            brand: 'V Wholesale Vijayawada',
            prompt_override: `Professional product photography: ${product} installed/displayed in a ${sceneLabels[sceneId]||sceneId}. Photo-realistic, architectural photography style, warm lighting, premium quality. The product should be the hero of the image. V Wholesale branding can be subtle.`
          })
        });
        const data = await res.json();
        return { sceneId, url: data.image_url || data.urls?.[0] || null, error: data.error };
      }));
      generatedImages.push(...batchResults);

      // Show progress
      if (results) results.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">⏳ Generated ${generatedImages.filter(g=>g.url).length}/${scenes.length} scenes…</div>`;
    }

    // Display results
    const successImages = generatedImages.filter(g => g.url);
    if (!successImages.length) throw new Error('No images generated — try again');

    if (results) results.innerHTML = `
      <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--text1)">✅ ${successImages.length} scenes generated for: ${product}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${successImages.map(img=>`
        <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
          <img src="${img.url}" style="width:100%;height:140px;object-fit:cover;display:block">
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.7));padding:8px">
            <div style="font-size:10px;color:#fff;font-weight:600">${img.sceneId.charAt(0).toUpperCase()+img.sceneId.slice(1)}</div>
          </div>
          <div style="position:absolute;top:6px;right:6px;display:flex;gap:4px">
            <a href="${img.url}" download style="background:rgba(0,0,0,.6);border:none;border-radius:4px;padding:4px 6px;font-size:10px;color:#fff;text-decoration:none">⬇️</a>
            <button onclick="usePhotoshootImage('${img.url}','${product}')" style="background:rgba(201,168,76,.9);border:none;border-radius:4px;padding:4px 6px;font-size:10px;color:#000;cursor:pointer;font-weight:700">Use</button>
          </div>
        </div>`).join('')}
      </div>
      <button onclick="openAIPhotoshoot()" class="mkt-btn mkt-btn-ghost" style="width:100%;margin-top:10px;font-size:12px;padding:8px">🔄 Generate New Scenes</button>`;

  } catch(e) {
    if (results) results.innerHTML = `<div style="color:var(--red);padding:12px;font-size:12px;text-align:center">❌ ${e.message}</div>`;
    showMktToast('❌ '+e.message);
  } finally {
    if (btn) { btn.textContent='✨ Generate AI Photoshoot'; btn.disabled=false; }
  }
}

async function usePhotoshootImage(imageUrl, product) {
  // Save to content_posts as master image and open content studio
  showMktToast('✅ Image saved — opening Content Studio');
  document.getElementById('photoshoot-overlay')?.remove();
  mktNav('content');
  setTimeout(() => {
    const topicEl = document.getElementById('cs-topic');
    if (topicEl) topicEl.value = product;
    // Pre-fill the image URL for publishing
    window._photoshootImageUrl = imageUrl;
    showMktToast('Topic and image ready — click Create to generate captions');
  }, 500);
}

async function renderPosterStudio() {
  setContent(`
  <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
    <div>
      <h3 style="font-size:16px;font-weight:900;margin:0">🎨 Poster Studio</h3>
      <div style="font-size:12px;color:var(--text3)">Write your brief → AI generates everything → edit, download, publish</div>
    </div>
    <button class="mkt-btn mkt-btn-ghost" onclick="psShowLibrary()" style="font-size:12px">📚 Library</button>
  </div>

  <div style="display:grid;gap:16px">

    <!-- BRIEF INPUT -->
    <div class="mkt-card">
      <div class="mkt-card-title">📝 What do you want to post about?</div>
      <textarea id="ps-brief" class="mkt-form-input" rows="5" style="font-size:13px;line-height:1.7;resize:vertical"
        placeholder="Write freely — include product names, offers, prices, context, audience. Example: We got new Kajaria tiles — wood finish, marble look, anti-skid. Sizes 2x2 and 2x4. Starting ₹45/sft. 10% off this week for contractors."></textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">
        <div style="display:flex;gap:6px;align-items:center">
          <label style="font-size:12px;color:var(--text3)">Tone:</label>
          <select id="ps-tone" class="mkt-form-select" style="font-size:12px;padding:5px 8px">
            <option value="product">Product Launch</option>
            <option value="offer">Offer / Sale</option>
            <option value="festival">Festival</option>
            <option value="story">Story / Behind Scenes</option>
            <option value="contractor">Contractor Club</option>
            <option value="educational">Educational / Tips</option>
          </select>
        </div>
        <button class="mkt-btn mkt-btn-primary" onclick="psGenerateBrief()" style="font-size:13px;font-weight:800;padding:9px 20px">
          ✨ Generate Everything
        </button>
        <div id="ps-brief-loading" style="display:none;font-size:12px;color:var(--gold)">⏳ AI is working…</div>
      </div>
    </div>

    <!-- OUTPUTS — hidden until generated -->
    <div id="ps-outputs" style="display:none;display:grid;gap:12px">

      <!-- TOPIC + HEADLINE + MESSAGE -->
      <div class="mkt-card">
        <div class="mkt-card-title">📌 Content Fields</div>
        <div style="display:grid;gap:10px">

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Topic / Post Title</label>
              <button class="mkt-btn mkt-btn-ghost" onclick="psCopy('ps-out-topic')" style="font-size:10px;padding:2px 8px">📋 Copy</button>
            </div>
            <input id="ps-out-topic" class="mkt-form-input" style="font-size:13px;font-weight:700" placeholder="AI will generate…">
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Poster Headline <span style="font-weight:400">(bold text on poster)</span></label>
              <button class="mkt-btn mkt-btn-ghost" onclick="psCopy('ps-out-headline')" style="font-size:10px;padding:2px 8px">📋 Copy</button>
            </div>
            <input id="ps-out-headline" class="mkt-form-input" style="font-size:13px;font-weight:700" placeholder="AI will generate…">
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Poster Message <span style="font-weight:400">(supporting line, 8–12 words)</span></label>
              <button class="mkt-btn mkt-btn-ghost" onclick="psCopy('ps-out-message')" style="font-size:10px;padding:2px 8px">📋 Copy</button>
            </div>
            <input id="ps-out-message" class="mkt-form-input" style="font-size:13px" placeholder="AI will generate…">
          </div>

        </div>
      </div>

      <!-- CAPTIONS -->
      <div class="mkt-card">
        <div class="mkt-card-title">📝 Captions</div>
        <div style="display:grid;gap:10px">

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">English Caption <span style="font-weight:400">(150–200 words)</span></label>
              <button class="mkt-btn mkt-btn-ghost" onclick="psCopy('ps-out-caption-en')" style="font-size:10px;padding:2px 8px">📋 Copy</button>
            </div>
            <textarea id="ps-out-caption-en" class="mkt-form-input" rows="5" style="font-size:12px;line-height:1.7;resize:vertical" placeholder="AI will generate…"></textarea>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Telugu Caption</label>
              <button class="mkt-btn mkt-btn-ghost" onclick="psCopy('ps-out-caption-te')" style="font-size:10px;padding:2px 8px">📋 Copy</button>
            </div>
            <textarea id="ps-out-caption-te" class="mkt-form-input" rows="4" style="font-size:12px;line-height:1.7;resize:vertical" placeholder="AI will generate…"></textarea>
          </div>

        </div>
      </div>

      <!-- HASHTAGS + KEYWORDS -->
      <div class="mkt-card">
        <div class="mkt-card-title">🏷️ Hashtags & Keywords</div>
        <div style="display:grid;gap:10px">

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Hashtags</label>
              <button class="mkt-btn mkt-btn-ghost" onclick="psCopy('ps-out-hashtags')" style="font-size:10px;padding:2px 8px">📋 Copy</button>
            </div>
            <textarea id="ps-out-hashtags" class="mkt-form-input" rows="2" style="font-size:12px;line-height:1.7;resize:vertical" placeholder="#Vijayawada #VWholesale…"></textarea>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">SEO Keywords <span style="font-weight:400">(for GBP + website)</span></label>
              <button class="mkt-btn mkt-btn-ghost" onclick="psCopy('ps-out-keywords')" style="font-size:10px;padding:2px 8px">📋 Copy</button>
            </div>
            <textarea id="ps-out-keywords" class="mkt-form-input" rows="2" style="font-size:12px;line-height:1.7;resize:vertical" placeholder="tiles Vijayawada, floor tiles price…"></textarea>
          </div>

        </div>
      </div>

      <!-- POSTER GENERATION -->
      <div class="mkt-card">
        <div class="mkt-card-title">🖼️ Generate Poster</div>

        <div style="margin-bottom:12px">
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">Select Platforms / Sizes</label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px" id="ps-platform-grid">
            ${[
              {id:'square',label:'Instagram Feed',size:'1080×1080',icon:'📸',checked:true},
              {id:'story',label:'Instagram Story',size:'1080×1920',icon:'📱',checked:true},
              {id:'landscape',label:'Facebook Post',size:'1200×630',icon:'👤',checked:true},
              {id:'whatsapp',label:'WhatsApp Status',size:'1080×1920',icon:'💬',checked:false},
              {id:'youtube',label:'YouTube Thumbnail',size:'1280×720',icon:'▶️',checked:false},
              {id:'gbp',label:'Google Business',size:'1200×900',icon:'📍',checked:false},
              {id:'print_a4',label:'Print A4',size:'2480×3508',icon:'🖨️',checked:false},
              {id:'custom',label:'Custom Size',size:'',icon:'⚙️',checked:false},
            ].map(p => `
            <label style="display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color .15s" class="ps-platform-opt">
              <input type="checkbox" name="ps-platform" value="${p.id}" ${p.checked?'checked':''} style="accent-color:var(--gold);width:14px;height:14px" onchange="psUpdateCustomSize(this)">
              <div>
                <div style="font-size:12px;font-weight:700">${p.icon} ${p.label}</div>
                <div style="font-size:10px;color:var(--text3)">${p.size||'Set below'}</div>
              </div>
            </label>`).join('')}
          </div>
          <!-- Custom size inputs -->
          <div id="ps-custom-size" style="display:none;margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="mkt-form-group" style="margin:0">
              <label class="mkt-form-label">Width (px)</label>
              <input id="ps-custom-w" type="number" class="mkt-form-input" value="1080" min="100" max="4000">
            </div>
            <div class="mkt-form-group" style="margin:0">
              <label class="mkt-form-label">Height (px)</label>
              <input id="ps-custom-h" type="number" class="mkt-form-input" value="1080" min="100" max="4000">
            </div>
          </div>
        </div>

        <button class="mkt-btn mkt-btn-primary" onclick="psGeneratePosters()" style="width:100%;padding:13px;font-size:14px;font-weight:900">
          🤖 Generate Poster for Selected Platforms
        </button>
        <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:6px">
          Uses the headline, message and topic from above · ~60-90 seconds
        </div>
      </div>

      <!-- POSTER PREVIEWS + DOWNLOAD -->
      <div id="ps-poster-results" style="display:none" class="mkt-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="mkt-card-title" style="margin:0">✅ Generated Posters</div>
          <button class="mkt-btn mkt-btn-primary" onclick="psDownloadAll()" style="font-size:12px;padding:6px 14px">⬇ Download All (ZIP)</button>
        </div>
        <div id="ps-poster-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px"></div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <button class="mkt-btn mkt-btn-ghost" onclick="psSaveToLibrary()" style="font-size:12px">💾 Save to Library</button>
        </div>
      </div>

    </div>

    <!-- LIBRARY (hidden by default) -->
    <div id="ps-library" style="display:none" class="mkt-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="mkt-card-title" style="margin:0">📚 Poster Library</div>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('ps-library').style.display='none'" style="font-size:12px">✕ Close</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        ${['All','Social','Print','Custom'].map(f=>`<button class="mkt-btn mkt-btn-ghost ps-lib-filter" onclick="psFilterLibrary('${f.toLowerCase()}')" style="font-size:11px;padding:4px 10px">${f}</button>`).join('')}
      </div>
      <div id="ps-lib-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        <div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;grid-column:1/-1">Loading library…</div>
      </div>
    </div>

  </div>`);

  // Init
  document.getElementById('ps-outputs').style.display = 'none';
  psLoadLibraryInBackground();
}

function psUpdateCustomSize(cb) {
  const customSizeDiv = document.getElementById('ps-custom-size');
  if (!customSizeDiv) return;
  const customChecked = document.querySelector('input[name="ps-platform"][value="custom"]')?.checked;
  customSizeDiv.style.display = customChecked ? 'grid' : 'none';
}

function psCopy(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.value || el.textContent || '';
  navigator.clipboard.writeText(text).then(() => showMktToast('📋 Copied!'));
}

async function psGenerateBrief() {
  const brief = (document.getElementById('ps-brief')?.value || '').trim();
  const tone = document.getElementById('ps-tone')?.value || 'product';
  if (!brief) { showMktToast('Please write your brief first'); return; }

  document.getElementById('ps-brief-loading').style.display = '';
  document.getElementById('ps-outputs').style.display = 'none';

    // Route through edge function — keeps OpenAI key server-side
    try {
    const fnRes = await fetch(MKT_SB_URL + '/functions/v1/content-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'generate_brief', brief, tone })
    });
    const fnData = await fnRes.json();
    if (!fnData.ok) throw new Error(fnData.error || 'Generation failed');
    psPopulateOutputs(fnData.content);
  } catch(e) {
    showMktToast('❌ ' + e.message);
  } finally {
    document.getElementById('ps-brief-loading').style.display = 'none';
  }
}

function psPopulateOutputs(content) {
  document.getElementById('ps-out-topic').value = content.topic || '';
  document.getElementById('ps-out-headline').value = content.headline || '';
  document.getElementById('ps-out-message').value = content.poster_message || '';
  document.getElementById('ps-out-caption-en').value = content.caption_en || '';
  document.getElementById('ps-out-caption-te').value = content.caption_te || '';
  document.getElementById('ps-out-hashtags').value = content.hashtags || '';
  document.getElementById('ps-out-keywords').value = content.seo_keywords || '';
  document.getElementById('ps-outputs').style.display = 'grid';
  // Smooth scroll to outputs
  document.getElementById('ps-outputs').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function psGeneratePosters() {
  const headline = document.getElementById('ps-out-headline')?.value?.trim();
  const message = document.getElementById('ps-out-message')?.value?.trim();
  const topic = document.getElementById('ps-out-topic')?.value?.trim();
  if (!topic || !headline) { showMktToast('Generate brief first or fill Topic + Headline'); return; }

  const selectedPlatforms = [...document.querySelectorAll('input[name="ps-platform"]:checked')].map(cb => cb.value);
  if (!selectedPlatforms.length) { showMktToast('Select at least one platform'); return; }

  // Map platform selections to format keys for the poster function
  const formatMap = {
    square: { size: '1024x1024', label: 'Instagram Feed', icon: '📸' },
    story: { size: '1024x1536', label: 'Instagram Story / WhatsApp', icon: '📱' },
    landscape: { size: '1536x1024', label: 'Facebook Post', icon: '👤' },
    whatsapp: { size: '1024x1536', label: 'WhatsApp Status', icon: '💬' },
    youtube: { size: '1536x1024', label: 'YouTube Thumbnail', icon: '▶️' },
    gbp: { size: '1536x1024', label: 'Google Business', icon: '📍' },
    print_a4: { size: '1024x1536', label: 'Print A4', icon: '🖨️' },
  };

  const resultsDiv = document.getElementById('ps-poster-results');
  const gridDiv = document.getElementById('ps-poster-grid');
  resultsDiv.style.display = 'block';
  gridDiv.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text3);grid-column:1/-1">
    <div style="font-size:24px;margin-bottom:8px">🤖</div>
    <div style="font-size:13px;font-weight:700">Generating ${selectedPlatforms.length} poster${selectedPlatforms.length>1?'s':''}…</div>
    <div style="font-size:11px;margin-top:4px">~60-90 seconds</div>
  </div>`;
  resultsDiv.scrollIntoView({ behavior: 'smooth' });

  // Store generated URLs for download/library
  window._psGeneratedPosters = [];

  const scheme = topic.toLowerCase().includes('granite') || topic.toLowerCase().includes('tile') || topic.toLowerCase().includes('marble')
    ? 'elegant cream and charcoal with natural stone textures and warm wood tones'
    : topic.toLowerCase().includes('paint') ? 'warm terracotta and sage green'
    : 'warm professional cream and charcoal';

  // Generate each unique size
  const uniqueSizes = [...new Set(selectedPlatforms.map(p => formatMap[p]?.size || '1024x1024'))];
  const generated = {};

  for (const size of uniqueSizes) {
    try {
      const apiSize = size;
      const prompt = size === '1024x1024'
        ? `Design a complete premium marketing poster for V Wholesale. Color scheme: ${scheme}. Style: real Indian lifestyle interior photography, editorial quality, warm and human. Elements: 1. "V Wholesale" at top with tagline "Build Better. Pay Less." 2. Bold headline: "${headline}" 3. Indian home lifestyle photo for: ${topic} 4. Message: "${message}" 5. Category strip: Tiles | Granite | Sanitaryware | Paints | Plywood | Furniture 6. Footer: +91 8712697930 | vwholesale.in | Visit V Wholesale. Square format. All text correct. No address. No watermark.`
        : size === '1024x1536'
        ? `Design a complete premium vertical Story poster for V Wholesale. Color: ${scheme}. Brand: "V Wholesale", tagline "Build Better. Pay Less.", headline "${headline}", message "${message}". Indian lifestyle photo for ${topic}. Two-row category strip: Tiles/Granite/Sanitaryware then Paints/Plywood/Furniture. Footer: +91 8712697930 | vwholesale.in | Visit V Wholesale. Vertical 2:3 format. All text correct. No address. No watermark.`
        : `Design a complete premium landscape marketing poster for V Wholesale. Color: ${scheme}. Left 40%: "V Wholesale" brand, tagline "Build Better. Pay Less.", headline "${headline}", message "${message}". Right 60%: Indian lifestyle photo for ${topic}. Category strip bottom. Footer: +91 8712697930 | vwholesale.in | Visit V Wholesale. Wide 3:2 format. All text correct. No address. No watermark.`;

      const fnRes = await fetch(MKT_SB_URL + '/functions/v1/content-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
        body: JSON.stringify({ action: 'generate_poster_image', prompt, size: apiSize })
      });
      if (fnRes.ok) {
        const fd = await fnRes.json();
        if (fd.b64) generated[size] = fd.b64;
      }
    } catch(e) { console.log('poster gen error:', e); }
  }

  // Render results
  if (!Object.keys(generated).length) {
    gridDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);grid-column:1/-1">Generation failed. Check OpenAI key in settings.</div>';
    return;
  }

  gridDiv.innerHTML = '';
  for (const plt of selectedPlatforms) {
    const size = formatMap[plt]?.size || '1024x1024';
    const b64 = generated[size];
    if (!b64) continue;
    const { label, icon } = formatMap[plt] || { label: plt, icon: '🖼' };
    const dataUrl = 'data:image/png;base64,' + b64;
    window._psGeneratedPosters.push({ label, size, b64, platform: plt });

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg3);border-radius:10px;overflow:hidden;border:1px solid var(--border)';
    card.innerHTML = `
      <img src="${dataUrl}" style="width:100%;display:block;cursor:pointer" onclick="window.open('${dataUrl}')" title="Click to zoom">
      <div style="padding:10px">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px">${icon} ${label}</div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:8px">${size.replace('x','×')} px</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="mkt-btn mkt-btn-primary" onclick="psDownloadOne('${plt}','${size}','${label}')" style="font-size:11px;padding:4px 10px">⬇ PNG</button>
          <button class="mkt-btn mkt-btn-ghost" onclick="psDownloadJpg('${plt}','${size}','${label}')" style="font-size:11px;padding:4px 10px">⬇ JPG</button>
          <button class="mkt-btn mkt-btn-ghost" onclick="psOpenInEditor('${plt}','${size}','${dataUrl}')" style="font-size:11px;padding:4px 10px" title="Open in Poster Editor to add text, badges, shapes">✏️ Edit</button>
        </div>
      </div>`;
    gridDiv.appendChild(card);
  }

  // Save to history
  await psSaveToLibraryAuto(topic, headline, message, selectedPlatforms);
}

function psDownloadOne(platform, size, label) {
  const poster = (window._psGeneratedPosters||[]).find(p => p.platform === platform);
  if (!poster) return;
  const a = document.createElement('a');
  a.href = 'data:image/png;base64,' + poster.b64;
  a.download = `vwholesale_${label.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_${size}.png`;
  a.click();
}

function psDownloadJpg(platform, size, label) {
  const poster = (window._psGeneratedPosters||[]).find(p => p.platform === platform);
  if (!poster) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const [w, h] = size.split('x').map(Number);
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.download = `vwholesale_${label.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_${size}.jpg`;
    a.click();
  };
  img.src = 'data:image/png;base64,' + poster.b64;
}

async function psDownloadAll() {
  const posters = window._psGeneratedPosters || [];
  if (!posters.length) { showMktToast('No posters to download'); return; }
  // Download each individually (no JSZip dependency — simple loop)
  for (const p of posters) {
    const a = document.createElement('a');
    a.href = 'data:image/png;base64,' + p.b64;
    a.download = `vwholesale_${p.label.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_${p.size}.png`;
    a.click();
    await new Promise(r => setTimeout(r, 300));
  }
  showMktToast('✅ All posters downloaded');
}

async function psSaveToLibraryAuto(topic, headline, message, platforms) {
  const caption = document.getElementById('ps-out-caption-en')?.value || '';
  const hashtags = document.getElementById('ps-out-hashtags')?.value || '';
  const posterUrls = {};
  // Upload each poster to storage and save URL
  for (const p of (window._psGeneratedPosters || [])) {
    try {
      const bytes = Uint8Array.from(atob(p.b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'image/png' });
      const filename = `poster-studio/${Date.now()}_${p.platform}.png`;
      const { error } = await sb.storage.from('calendar-images').upload(filename, blob, { contentType: 'image/png', upsert: true });
      if (!error) {
        const { data: pub } = sb.storage.from('calendar-images').getPublicUrl(filename);
        posterUrls[p.platform] = pub.publicUrl;
      }
    } catch(e) {}
  }
  // Save to poster_history
  const masterUrl = posterUrls.square || posterUrls.story || Object.values(posterUrls)[0] || null;
  await sb.from('poster_history').insert({
    topic, template: 'custom', language: 'en',
    caption, hashtags,
    image_url: masterUrl,
    platform_images: Object.keys(posterUrls).length ? posterUrls : null,
    status: 'draft',
    metadata: { headline, message, platforms }
  }).then(() => {}, () => {});
}

async function psSaveToLibrary() {
  await psSaveToLibraryAuto(
    document.getElementById('ps-out-topic')?.value || '',
    document.getElementById('ps-out-headline')?.value || '',
    document.getElementById('ps-out-message')?.value || '',
    (window._psGeneratedPosters || []).map(p => p.platform)
  );
  showMktToast('💾 Saved to library');
  psLoadLibraryInBackground();
}

function psShowLibrary() {
  const lib = document.getElementById('ps-library');
  if (!lib) return;
  lib.style.display = lib.style.display === 'none' ? 'block' : 'none';
  if (lib.style.display === 'block') psLoadLibraryInBackground();
}

async function psLoadLibraryInBackground() {
  const grid = document.getElementById('ps-lib-grid');
  if (!grid) return;
  const { data: history } = await sb.from('poster_history').select('*').order('created_at', { ascending: false }).limit(24).then(r => r, () => ({ data: [] }));
  if (!history?.length) {
    grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;grid-column:1/-1">No posters saved yet</div>';
    return;
  }
  grid.innerHTML = history.map(h => `
    <div style="background:var(--bg3);border-radius:10px;overflow:hidden;border:1px solid var(--border)">
      ${h.image_url
        ? `<img src="${h.image_url}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;cursor:pointer" onclick="window.open('${h.image_url}')" loading="lazy">`
        : `<div style="width:100%;aspect-ratio:1;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:28px">🖼</div>`}
      <div style="padding:8px">
        <div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">${h.topic||'—'}</div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:6px">${new Date(h.created_at).toLocaleDateString('en-IN')}</div>
        <div style="display:flex;gap:4px">
          ${h.image_url ? `<a href="${h.image_url}" download style="font-size:10px;padding:3px 8px" class="mkt-btn mkt-btn-ghost">⬇ PNG</a>` : ''}
          <button onclick="psDeleteHistory(${h.id})" style="font-size:10px;padding:3px 8px;background:none;border:1px solid var(--border);border-radius:5px;color:var(--text3);cursor:pointer">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

async function psFilterLibrary(filter) {
  // For now reload all — can extend with filter logic
  await psLoadLibraryInBackground();
}

async function psDeleteHistory(id) {
  if (!confirm('Delete this poster?')) return;
  await sb.from('poster_history').delete().eq('id', id);
  showMktToast('Deleted');
  psLoadLibraryInBackground();
}


async function copyPosterCaption(id) {
  const {data:h} = await sb.from('poster_history').select('caption').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (h?.caption) navigator.clipboard.writeText(h.caption).then(() => showMktToast('📋 Copied!'));
}
async function deletePosterHistory(id) {
  if (!confirm('Delete this poster?')) return;
  await sb.from('poster_history').delete().eq('id', id);
  showMktToast('Deleted'); loadPosterHistory();
}
async function loadPosterHistory() {
  const {data:history} = await sb.from('poster_history').select('*').order('created_at',{ascending:false}).limit(8).then(r=>r,()=>({data:[]}));
  const card = document.getElementById('ps-history-card');
  const el   = document.getElementById('ps-history');
  if (!card||!el) return;
  if (!(history||[]).length) return;
  card.style.display = 'block';
  el.innerHTML = (history||[]).map(h=>`
  <div onclick="viewPosterHistory(${h.id})" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:10px;align-items:flex-start" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='none'">
    ${h.image_url
      ? `<img src="${h.image_url}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid var(--border)" loading="lazy" onerror="this.style.display='none'">`
      : `<div style="width:52px;height:52px;background:var(--bg3);border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">🖼</div>`
    }
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.topic||'—'}</div>
        <span class="badge ${h.status==='published'?'badge-green':h.status==='scheduled'?'badge-blue':'badge-gray'}" style="flex-shrink:0">${h.status}</span>
      </div>
      <div style="font-size:11px;color:var(--text3)">${h.template||'product'} · ${h.language||'en'} · ${new Date(h.created_at).toLocaleDateString('en-IN')}</div>
      ${h.caption?`<div style="font-size:11px;color:var(--text3);line-height:1.4;margin-top:2px">${h.caption.slice(0,60)}${h.caption.length>60?'…':''}</div>`:''}
    </div>
    <span style="color:var(--text3);font-size:14px;flex-shrink:0">›</span>
  </div>`).join('');
}

// ── DRAFT VIEWER ──

// ── STUB PAGES ──
// ── STUB PAGES — rich coming soon UI ──
function _comingSoonCard(icon, title, desc, features, eta) {
  return `<div style="max-width:600px;margin:0 auto">
    <div class="mkt-card" style="text-align:center;padding:32px 24px">
      <div style="font-size:48px;margin-bottom:12px">${icon}</div>
      <div style="font-size:20px;font-weight:900;margin-bottom:8px">${title}</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:20px">${desc}</div>
      <div style="display:grid;gap:8px;text-align:left;margin-bottom:20px">
        ${features.map(f=>`<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:8px;padding:10px 14px">
          <span style="font-size:18px">${f.icon}</span>
          <div><div style="font-size:12px;font-weight:700">${f.title}</div><div style="font-size:11px;color:var(--text3)">${f.desc}</div></div>
        </div>`).join('')}
      </div>
      <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:10px;font-size:12px;color:#c9a84c;font-weight:700">🗓 ${eta}</div>
    </div>
  </div>`;
}

async function renderCampaigns() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">📣 Campaign Manager</h3>
    <div style="font-size:12px;color:var(--text3)">Plan, execute and track multi-channel marketing campaigns</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="showCampaignBuilder()">+ New Campaign</button>
  </div>
  <div id="camp-list"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div></div>`);
  await loadCampaigns();
}

async function loadCampaigns() {
  const {data:camps} = await sb.from('campaigns').select('*').order('created_at',{ascending:false}).then(r=>r,()=>({data:[]}));
  const el = document.getElementById('camp-list');
  if (!el) return;

  if (!(camps||[]).length) {
    el.innerHTML = `<div class="mkt-card" style="text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:12px">📣</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:8px">No campaigns yet</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px">Create your first campaign — set goal, budget, platforms and start tracking performance</div>
      <button class="mkt-btn mkt-btn-primary" onclick="showCampaignBuilder()">+ Create First Campaign</button>
    </div>`;
    return;
  }

  const statusColor = {draft:'var(--text3)', active:'#22c55e', paused:'#f59e0b', completed:'#64748b'};
  const statusBg = {draft:'badge-gray', active:'badge-green', paused:'badge-blue', completed:'badge-gray'};

  el.innerHTML = `
  <!-- Summary row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
    ${[
      {label:'Total Campaigns', val: camps.length, icon:'📣'},
      {label:'Active', val: camps.filter(c=>c.status==='active').length, icon:'🟢'},
      {label:'Total Budget', val: '₹'+((camps.reduce((s,c)=>s+(c.budget_inr||0),0)/1000).toFixed(0))+'K', icon:'💰'},
      {label:'Total Spent', val: '₹'+((camps.reduce((s,c)=>s+(c.spent_inr||0),0)/1000).toFixed(0))+'K', icon:'📊'}
    ].map(m=>`<div class="mkt-card" style="padding:12px;text-align:center">
      <div style="font-size:20px">${m.icon}</div>
      <div style="font-size:18px;font-weight:900;margin:4px 0">${m.val}</div>
      <div style="font-size:10px;color:var(--text3)">${m.label}</div>
    </div>`).join('')}
  </div>

  <!-- Campaign cards -->
  <div style="display:grid;gap:12px">
    ${camps.map(c => {
      const days = c.end_date ? Math.ceil((new Date(c.end_date)-new Date())/(1000*60*60*24)) : null;
      const pct = c.budget_inr > 0 ? Math.min(100, Math.round((c.spent_inr||0)/c.budget_inr*100)) : 0;
      const platforms = (c.platforms||[]);
      const cpl = c.conversions > 0 ? '₹'+Math.round((c.spent_inr||0)/c.conversions) : '—';
      return `<div class="mkt-card" style="padding:16px">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="font-size:15px;font-weight:900">${c.name}</div>
              <span class="badge ${statusBg[c.status]||'badge-gray'}">${c.status}</span>
            </div>
            <div style="font-size:12px;color:var(--text3)">${c.goal||'—'} · ${platforms.join(' · ')||'No platforms'}</div>
            ${c.start_date ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${new Date(c.start_date).toLocaleDateString('en-IN')} → ${c.end_date?new Date(c.end_date).toLocaleDateString('en-IN'):'ongoing'} ${days!==null&&days>0?'('+days+' days left)':days<=0?'(ended)':''}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="mkt-btn mkt-btn-ghost" onclick="editCampaign(${c.id})" style="font-size:11px;padding:4px 8px">✏️</button>
            <button class="mkt-btn mkt-btn-ghost" onclick="toggleCampaignStatus(${c.id},'${c.status}')" style="font-size:11px;padding:4px 8px">${c.status==='active'?'⏸ Pause':c.status==='paused'?'▶️ Resume':'▶️ Start'}</button>
            <button class="mkt-btn mkt-btn-ghost" onclick="deleteCampaign(${c.id})" style="font-size:11px;padding:4px 8px;color:var(--red)">🗑</button>
          </div>
        </div>

        <!-- Budget bar -->
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:4px">
            <span>Budget: ₹${(c.budget_inr||0).toLocaleString('en-IN')}</span>
            <span>Spent: ₹${(c.spent_inr||0).toLocaleString('en-IN')} (${pct}%)</span>
          </div>
          <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${pct>80?'#ef4444':pct>50?'#f59e0b':'#22c55e'};border-radius:3px;transition:width .3s"></div>
          </div>
        </div>

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
          ${[
            {label:'Impressions', val:(c.impressions||0).toLocaleString('en-IN')},
            {label:'Clicks', val:(c.clicks||0).toLocaleString('en-IN')},
            {label:'Conversions', val:(c.conversions||0).toLocaleString('en-IN')},
            {label:'Cost/Lead', val:cpl}
          ].map(m=>`<div style="background:var(--bg3);border-radius:8px;padding:8px;text-align:center">
            <div style="font-size:13px;font-weight:700">${m.val}</div>
            <div style="font-size:10px;color:var(--text3)">${m.label}</div>
          </div>`).join('')}
        </div>

        <!-- Update stats + AI tip -->
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="mkt-btn mkt-btn-ghost" onclick="updateCampaignStats(${c.id})" style="font-size:11px;padding:4px 10px">📊 Update Stats</button>
          <button class="mkt-btn mkt-btn-primary" onclick="getCampaignAITip(${c.id},'${c.name.replace(/'/g,"\'")}')" style="font-size:11px;padding:4px 10px">🤖 AI Tip</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function showCampaignBuilder(existing) {
  const c = existing || {};
  const m = document.createElement('div');
  m.id = 'camp-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:540px;overflow:hidden;margin-top:20px">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">${c.id?'✏️ Edit Campaign':'📣 New Campaign'}</div>
      <button onclick="document.getElementById('camp-modal').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">

      <div class="mkt-form-group">
        <label class="mkt-form-label">Campaign Name *</label>
        <input id="camp-name" class="mkt-form-input" value="${c.name||''}" placeholder="e.g. Monsoon Bathroom Sale, Diwali Tiles Offer">
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Goal *</label>
        <select id="camp-goal" class="mkt-form-select">
          ${['Brand Awareness','Store Walk-ins','Lead Generation','Contractor Club Signups','Product Launch','Festival Offer','Clearance Sale'].map(g=>`<option value="${g}" ${c.goal===g?'selected':''}>${g}</option>`).join('')}
        </select>
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Platforms</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
          ${['Instagram','Facebook','WhatsApp','GBP','YouTube','X (Manual)','Google Ads','Meta Ads'].map(p=>`
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;background:var(--bg3);padding:6px 10px;border-radius:6px;border:1px solid ${(c.platforms||[]).includes(p)?'var(--gold)':'var(--border)'}">
            <input type="checkbox" value="${p}" ${(c.platforms||[]).includes(p)?'checked':''} onchange="this.closest('label').style.borderColor=this.checked?'var(--gold)':'var(--border)'">
            ${p}
          </label>`).join('')}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mkt-form-group">
          <label class="mkt-form-label">Budget (₹)</label>
          <input id="camp-budget" type="number" class="mkt-form-input" value="${c.budget_inr||''}" placeholder="30000">
        </div>
        <div class="mkt-form-group">
          <label class="mkt-form-label">Spent so far (₹)</label>
          <input id="camp-spent" type="number" class="mkt-form-input" value="${c.spent_inr||''}" placeholder="0">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="mkt-form-group">
          <label class="mkt-form-label">Start Date</label>
          <input id="camp-start" type="date" class="mkt-form-input" value="${c.start_date||''}">
        </div>
        <div class="mkt-form-group">
          <label class="mkt-form-label">End Date</label>
          <input id="camp-end" type="date" class="mkt-form-input" value="${c.end_date||''}">
        </div>
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Target Audience</label>
        <input id="camp-audience" class="mkt-form-input" value="${c.target_audience||''}" placeholder="e.g. Homeowners 30-55, Contractors in Vijayawada">
      </div>

      <div class="mkt-form-group">
        <label class="mkt-form-label">Notes</label>
        <input id="camp-notes" class="mkt-form-input" value="${c.notes||''}" placeholder="Key message, offer details, etc.">
      </div>

      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="saveCampaign(${c.id||'null'})">💾 ${c.id?'Update Campaign':'Create Campaign'}</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('camp-modal').remove()">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

async function saveCampaign(id) {
  const name = (document.getElementById('camp-name')?.value||'').trim();
  if (!name) { showMktToast('Enter campaign name'); return; }
  const platforms = [...document.querySelectorAll('#camp-modal input[type=checkbox]:checked')].map(cb=>cb.value);
  const payload = {
    name,
    goal: document.getElementById('camp-goal')?.value||'Brand Awareness',
    platforms,
    budget_inr: parseFloat(document.getElementById('camp-budget')?.value||'0')||0,
    spent_inr: parseFloat(document.getElementById('camp-spent')?.value||'0')||0,
    start_date: document.getElementById('camp-start')?.value||null,
    end_date: document.getElementById('camp-end')?.value||null,
    target_audience: document.getElementById('camp-audience')?.value?.trim()||null,
    notes: document.getElementById('camp-notes')?.value?.trim()||null,
    updated_at: new Date().toISOString()
  };

  let error;
  if (id) {
    ({error} = await sb.from('campaigns').update(payload).eq('id',id));
  } else {
    payload.created_by = mktProfile?.name;
    payload.status = 'draft';
    ({error} = await sb.from('campaigns').insert(payload));
  }

  if (error) { showMktToast('❌ '+error.message); return; }
  document.getElementById('camp-modal')?.remove();
  showMktToast(id ? '✅ Campaign updated' : '✅ Campaign created');
  await loadCampaigns();
}

async function editCampaign(id) {
  const {data:c} = await sb.from('campaigns').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (c) showCampaignBuilder(c);
}

async function toggleCampaignStatus(id, currentStatus) {
  const next = currentStatus==='active' ? 'paused' : currentStatus==='paused' ? 'active' : 'active';
  await sb.from('campaigns').update({status:next,updated_at:new Date().toISOString()}).eq('id',id);
  showMktToast('Campaign '+(next==='active'?'started ▶️':'paused ⏸'));
  await loadCampaigns();
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign?')) return;
  await sb.from('campaigns').delete().eq('id',id);
  showMktToast('Deleted');
  await loadCampaigns();
}

function updateCampaignStats(id) {
  const m = document.createElement('div');
  m.id = 'stats-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:380px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">📊 Update Stats</div>
      <button onclick="document.getElementById('stats-modal').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:10px">
      <div class="mkt-form-group"><label class="mkt-form-label">Impressions</label><input id="stat-imp" type="number" class="mkt-form-input" placeholder="0"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Clicks</label><input id="stat-clk" type="number" class="mkt-form-input" placeholder="0"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Conversions (walk-ins / leads)</label><input id="stat-conv" type="number" class="mkt-form-input" placeholder="0"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Amount Spent (₹)</label><input id="stat-spent" type="number" class="mkt-form-input" placeholder="0"></div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="saveStats(${id})">Save Stats</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('stats-modal').remove()">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

async function saveStats(id) {
  const payload = {
    impressions: parseInt(document.getElementById('stat-imp')?.value||'0')||0,
    clicks: parseInt(document.getElementById('stat-clk')?.value||'0')||0,
    conversions: parseInt(document.getElementById('stat-conv')?.value||'0')||0,
    spent_inr: parseFloat(document.getElementById('stat-spent')?.value||'0')||0,
    updated_at: new Date().toISOString()
  };
  await sb.from('campaigns').update(payload).eq('id',id);
  document.getElementById('stats-modal')?.remove();
  showMktToast('✅ Stats updated');
  await loadCampaigns();
}

async function getCampaignAITip(id, name) {
  showMktToast('🤖 Getting AI tip for '+name+'…');
  const {data:c} = await sb.from('campaigns').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!c) return;

  const cpl = c.conversions > 0 ? Math.round((c.spent_inr||0)/c.conversions) : null;
  const pct = c.budget_inr > 0 ? Math.round((c.spent_inr||0)/c.budget_inr*100) : 0;

  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({
      task:'campaign_tip',
      language:'en',
      context:{
        campaign_name: c.name,
        goal: c.goal,
        platforms: c.platforms,
        budget: c.budget_inr,
        spent: c.spent_inr,
        budget_used_pct: pct,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        cost_per_lead: cpl,
        days_left: c.end_date ? Math.ceil((new Date(c.end_date)-new Date())/(1000*60*60*24)) : null,
        target_audience: c.target_audience
      }
    })
  });

  const data = await res.json();
  const tip = data.content || data.text || 'No tip returned';

  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">🤖 AI Campaign Tip — ${c.name}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:20px">
      <div style="font-size:13px;line-height:1.8;white-space:pre-wrap">${tip}</div>
    </div>
    <div style="padding:0 16px 16px">
      <button class="mkt-btn mkt-btn-ghost" style="width:100%" onclick="this.closest('[style*=fixed]').remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

function renderSocial() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">📱 Social Media</h3>
    <div style="font-size:12px;color:var(--text3)">Connect platforms · Generate content · Publish everywhere</div></div>
  </div>

  <!-- Platform connection status -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div class="mkt-card-title">Platform Connections</div>
    <div style="display:grid;gap:10px">
      ${[
        {icon:'📸', name:'Instagram', size:'1080×1080 · Reels 9:16', status:'pending', action:'Connect via Meta Business', url:'https://business.facebook.com'},
        {icon:'👥', name:'Facebook Page', size:'1200×630 · Feed · Reels 9:16', status:'pending', action:'Same Meta Business account', url:'https://business.facebook.com'},
        {icon:'🧵', name:'Threads', size:'1080×1080 · Video 9:16', status:'pending', action:'Meta Graph API — same auth as Instagram', url:'https://business.facebook.com'},
        {icon:'▶️', name:'YouTube / Shorts', size:'1080×1920 · Max 60s for Shorts', status:'pending', action:'Authorize V Wholesale YouTube channel', url:'https://console.cloud.google.com'},
        {icon:'📍', name:'Google Business Profile', size:'1200×900 · Event posts', status:'pending', action:'Google OAuth — same account as Search Console', url:'https://console.cloud.google.com'},
        {icon:'💬', name:'WhatsApp Status', size:'1080×1920 · Via Interakt', status:'pending', action:'Complete Interakt BSP setup', url:'https://app.interakt.ai'},
        {icon:'✖️', name:'X (Twitter)', size:'1200×675 · Manual posting', status:'manual', action:'Manual — open X, paste content', url:'https://x.com/compose/tweet'}
      ].map(p => '<div style="display:flex;align-items:center;gap:12px;background:var(--bg3);border-radius:10px;padding:12px">'
        + '<div style="font-size:24px;width:36px;text-align:center">'+p.icon+'</div>'
        + '<div style="flex:1">'
        + '<div style="font-size:13px;font-weight:700">'+p.name+'</div>'
        + '<div style="font-size:11px;color:var(--text3)">'+p.size+'</div>'
        + '<div style="font-size:11px;color:var(--text3);margin-top:2px">→ '+p.action+'</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">'
        + '<span class="badge '+(p.status==='manual'?'badge-blue':'badge-gray')+'">'+(p.status==='manual'?'Manual':'Not connected')+'</span>'
        + '<a href="'+p.url+'" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px;text-decoration:none">'+(p.status==='manual'?'Open X ↗':'Setup ↗')+'</a>'
        + '</div></div>'
      ).join('')}
    </div>
  </div>

  <!-- Manual X posting helper -->
  <div class="mkt-card" style="margin-bottom:16px">
    <div class="mkt-card-title">✖️ Post to X (Twitter) — Manual</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Generate your caption below, copy it, then click Open X to paste and post.</div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Topic / What to post about</label>
      <input id="x-topic" class="mkt-form-input" placeholder="e.g. Kajaria premium tiles now available, Monsoon bathroom renovation">
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="mkt-btn mkt-btn-primary" onclick="generateXPost()" style="flex:1">🤖 Generate X Post</button>
      <a href="https://x.com/compose/tweet" target="_blank" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">Open X ↗</a>
    </div>
    <div id="x-output" style="display:none">
      <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">
        <div id="x-content" style="font-size:13px;line-height:1.7;white-space:pre-wrap"></div>
        <div id="x-chars" style="font-size:11px;color:var(--text3);margin-top:6px;text-align:right"></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" onclick="copyXPost()" style="flex:1">📋 Copy Post</button>
        <a href="https://x.com/compose/tweet" target="_blank" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">Open X ↗</a>
      </div>
    </div>
  </div>

  <!-- Publishing guide -->
  <div class="mkt-card">
    <div class="mkt-card-title">📖 One-Push Publishing — How it will work</div>
    <div style="display:grid;gap:8px">
      ${['1️⃣ Generate poster or upload your own in Poster Studio',
         '2️⃣ AI writes caption + hashtags for each platform automatically',
         '3️⃣ Preview how it looks on Instagram (square), YouTube (9:16), GBP (landscape)',
         '4️⃣ Select which platforms to post to',
         '5️⃣ One click — publishes to all selected platforms simultaneously',
         '6️⃣ Posts tracked in Content Calendar with status per platform'
        ].map(s=>'<div style="font-size:12px;padding:8px 10px;background:var(--bg3);border-radius:8px">'+s+'</div>').join('')}
    </div>
    <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:10px;font-size:12px;color:#c9a84c;margin-top:12px">
      ⚡ One-push publishing activates once Meta Business OAuth is connected. Currently use Poster Studio → copy caption → post manually per platform.
    </div>
  </div>`);
}

async function generateXPost() {
  const topic = (document.getElementById('x-topic')?.value||'').trim();
  if (!topic) { showMktToast('Enter a topic first'); return; }
  showMktToast('🤖 Writing X post…');

  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({
      task:'social_post',
      platform:'X',
      language:'en',
      topic,
      context:{business:'V Wholesale', location:'Vijayawada', max_chars:280}
    })
  });
  const data = await res.json();
  const content = data.content || data.text || '';
  if (!content) { showMktToast('❌ Generation failed'); return; }

  const out = document.getElementById('x-output');
  const cont = document.getElementById('x-content');
  const chars = document.getElementById('x-chars');
  if (out) out.style.display = 'block';
  if (cont) cont.textContent = content;
  if (chars) {
    const len = content.length;
    chars.textContent = len + '/280 characters';
    chars.style.color = len > 280 ? '#ef4444' : len > 240 ? '#f59e0b' : 'var(--text3)';
  }
}

function copyXPost() {
  const content = document.getElementById('x-content')?.textContent||'';
  navigator.clipboard.writeText(content).then(()=>showMktToast('📋 Copied — now paste in X'));
}

async function renderWhatsApp() {
  setContent('<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading WhatsApp…</div>');

  const [
    {data: settings},
    {data: broadcasts},
    {data: templates}
  ] = await Promise.all([
    sb.from('marketing_settings').select('key,value').in('key',['INTERAKT_API_KEY','INTERAKT_PHONE']).then(r=>r,()=>({data:[]})),
    sb.from('whatsapp_broadcasts').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r,()=>({data:[]})),
    sb.from('whatsapp_templates').select('*').eq('status','approved').then(r=>r,()=>({data:[]}))
  ]);

  const cfg = {}; (settings||[]).forEach(s=>{cfg[s.key]=s.value;});
  const isConnected = !!cfg.INTERAKT_API_KEY;
  const totalSent = (broadcasts||[]).reduce((a,b)=>a+(b.sent_count||0),0);

  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">'
    + '<div><h3 style="font-size:16px;font-weight:900">💬 WhatsApp Marketing</h3>'
    + '<div style="font-size:12px;color:var(--text3)">Powered by Interakt · ' + (cfg.INTERAKT_PHONE||'8712697930') + '</div></div>'
    + '<span class="badge ' + (isConnected?'badge-green':'badge-red') + '">' + (isConnected?'✅ Connected':'❌ Not Connected') + '</span></div>';

  // Stats
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:#25D366">' + totalSent + '</div><div style="font-size:11px;color:var(--text3)">Messages Sent</div></div>'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:var(--gold)">' + (broadcasts||[]).length + '</div><div style="font-size:11px;color:var(--text3)">Campaigns</div></div>'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:#3b82f6">' + (templates||[]).length + '</div><div style="font-size:11px;color:var(--text3)">Templates</div></div>'
    + '</div>';

  // SEND SINGLE MESSAGE
  html += '<div class="mkt-card" style="margin-bottom:14px">'
    + '<div style="font-size:12px;font-weight:700;margin-bottom:10px">📱 Send Single Message</div>'
    + '<div style="display:grid;gap:8px">'
    + '<input id="wa-single-phone" class="mkt-form-input" placeholder="Phone number e.g. 9876543210">'
    + '<textarea id="wa-single-msg" class="mkt-form-input" rows="3" placeholder="Type your message..."></textarea>'
    + '<div style="display:flex;gap:8px">'
    + '<button onclick="waAIWrite(this)" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:8px 12px">✨ AI Write</button>'
    + '<button onclick="waSendSingle()" class="mkt-btn mkt-btn-primary" style="flex:1;padding:8px;font-weight:700">Send WhatsApp</button>'
    + '</div></div></div>';

  // BROADCAST
  html += '<div class="mkt-card" style="margin-bottom:14px">'
    + '<div style="font-size:12px;font-weight:700;margin-bottom:10px">📢 Broadcast Campaign</div>'
    + '<div style="display:grid;gap:8px">'
    + '<div><label class="mkt-form-label">Campaign name</label><input id="wa-camp-name" class="mkt-form-input" placeholder="e.g. Diwali Offer 2026"></div>'
    + '<div><label class="mkt-form-label">Target segment</label>'
    + '<select id="wa-segment" class="mkt-form-select" onchange="waLoadSegmentCount(this.value)">'
    + '<option value="all">All customers</option>'
    + '<option value="contractor">Contractors only</option>'
    + '<option value="high_value">High value (>₹50k)</option>'
    + '<option value="inactive">Inactive 90 days</option>'
    + '<optgroup label="── By Construction Stage ──">'
    + '<option value="stage_structure">🧱 Structure stage (pipes/wires coming)</option>'
    + '<option value="stage_plumbing_roughin">🔧 Plumbing rough-in (tiles coming)</option>'
    + '<option value="stage_electrical_roughin">⚡ Electrical rough-in (tiles coming)</option>'
    + '<option value="stage_flooring">🪟 Flooring stage (sanitaryware coming)</option>'
    + '<option value="stage_bathroom">🚿 Bathroom stage (electricals coming)</option>'
    + '<option value="stage_electrical_fitout">💡 Electrical fit-out (plywood coming)</option>'
    + '<option value="stage_interiors">🛋️ Interiors stage (paint coming)</option>'
    + '<option value="stage_painting">🎨 Painting stage (furniture coming)</option>'
    + '<option value="stage_furniture">🛏️ Furniture stage (appliances coming)</option>'
    + '</optgroup>'
    + '<optgroup label="── Recency + Stage ──">'
    + '<option value="active_flooring">🔥 Active buyers at flooring (last 90 days)</option>'
    + '<option value="active_bathroom">🔥 Active buyers at bathroom (last 90 days)</option>'
    + '<option value="hot_leads">🎯 Hot leads — bought 60-120 days ago</option>'
    + '</optgroup>'
    + '</select></div>'
    + '<div id="wa-segment-count" style="font-size:11px;color:var(--text3)">Select segment to see count</div>'
    + '<div><label class="mkt-form-label">Message</label>'
    + '<textarea id="wa-broadcast-msg" class="mkt-form-input" rows="4" placeholder="Write your broadcast message..."></textarea></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button onclick="waAIGenBroadcast()" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:8px 12px">✨ AI Generate</button>'
    + '<button onclick="waSendBroadcast()" class="mkt-btn mkt-btn-primary" style="flex:1;padding:8px;font-weight:700">🚀 Send Broadcast</button>'
    + '</div></div></div>';

  // TEMPLATES
  html += '<div class="mkt-card" style="margin-bottom:14px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    + '<div style="font-size:12px;font-weight:700">📋 Approved Templates</div>'
    + '<button onclick="syncWATemplates(this)" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 10px">🔄 Sync from Interakt</button></div>'
    + '<div style="font-size:10px;color:var(--text3);margin-bottom:8px">Click Use Template — variables {{1}} {{2}} get filled before sending</div>'
    + '<div style="display:grid;gap:8px">';

  (templates||[]).forEach(t => {
    html += '<div style="background:var(--bg3);border-radius:8px;padding:10px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--gold)">' + t.name + '</div>'
      + '<span class="badge badge-green" style="font-size:9px">' + t.category + '</span></div>'
      + '<div style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:6px">' + (t.body||'').slice(0,120) + '…</div>'
      + '<button onclick="loadWATemplate(this)" data-name="' + t.name + '" data-lang="' + (t.language||'en') + '" data-varcount="' + (t.var_count||0) + '" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px" data-body="' + encodeURIComponent((t.body||'').slice(0,400)) + '">Use Template</button>'
      + '</div>';
  });
  html += '</div></div>';

  // QUICK ACTIONS
  html += '<div class="mkt-card" style="margin-bottom:14px">'
    + '<div style="font-size:12px;font-weight:700;margin-bottom:10px">⚡ Quick Actions</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    + '<button onclick="waQuickAction(&quot;quotation&quot;)" class="mkt-btn mkt-btn-ghost" style="padding:10px;text-align:left"><div style="font-size:16px;margin-bottom:2px">📄</div><div style="font-size:11px;font-weight:600">Quotation Ready</div><div style="font-size:10px;color:var(--text3)">Notify customer</div></button>'
    + '<button onclick="waQuickAction(&quot;review&quot;)" class="mkt-btn mkt-btn-ghost" style="padding:10px;text-align:left"><div style="font-size:16px;margin-bottom:2px">⭐</div><div style="font-size:11px;font-weight:600">Review Request</div><div style="font-size:10px;color:var(--text3)">Post-purchase</div></button>'
    + '<button onclick="waQuickAction(&quot;festival&quot;)" class="mkt-btn mkt-btn-ghost" style="padding:10px;text-align:left"><div style="font-size:16px;margin-bottom:2px">🎉</div><div style="font-size:11px;font-weight:600">Festival Greeting</div><div style="font-size:10px;color:var(--text3)">All customers</div></button>'
    + '<button onclick="waQuickAction(&quot;contractor&quot;)" class="mkt-btn mkt-btn-ghost" style="padding:10px;text-align:left"><div style="font-size:16px;margin-bottom:2px">👷</div><div style="font-size:11px;font-weight:600">Contractor Update</div><div style="font-size:10px;color:var(--text3)">Referral earnings</div></button>'
    + '</div></div>';

  // RECENT BROADCASTS
  if ((broadcasts||[]).length) {
    html += '<div class="mkt-card"><div style="font-size:12px;font-weight:700;margin-bottom:10px">📊 Recent Broadcasts</div>'
      + '<div style="display:grid;gap:6px">';
    (broadcasts||[]).slice(0,5).forEach(b => {
      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">'
        + '<div style="flex:1"><div style="font-size:12px;font-weight:600">' + (b.campaign_name||'Broadcast') + '</div>'
        + '<div style="font-size:10px;color:var(--text3)">' + new Date(b.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) + '</div></div>'
        + '<div style="text-align:right"><div style="font-size:14px;font-weight:700;color:#25D366">' + (b.sent_count||0) + '</div>'
        + '<div style="font-size:9px;color:var(--text3)">sent</div></div></div>';
    });
    html += '</div></div>';
  }

  setContent(html);
}

function waAIGenBroadcast() {
  const name = (document.getElementById('wa-camp-name')?.value||'offer').trim();
  const seg = document.getElementById('wa-segment')?.value || 'all';
  generateWhatsAppBroadcast(name, seg);
}

async function waSendSingle() {
  const phone = (document.getElementById('wa-single-phone')?.value||'').trim();
  const message = (document.getElementById('wa-single-msg')?.value||'').trim();
  if (!phone) { showMktToast('Enter phone number'); return; }
  if (!message) { showMktToast('Enter a message or use a template above'); return; }

  // Free-form text. Meta only delivers this if the customer messaged us
  // within the last 24 hours (customer service window).
  // For proactive sends use an approved template via "Use Template".
  const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body: JSON.stringify({ action:'send_text', phone, message })
  });
  const d = await res.json();
  if (d.ok) {
    showMktToast('Sent to +91' + phone.replace(/[^0-9]/g,''));
  } else {
    const err = d.error || 'Send failed';
    const is24h = /131047|24 hour|re-?engagement|outside/i.test(err);
    showMktToast(is24h
      ? 'Outside 24h window — customer must message you first. Use an approved template instead.'
      : err);
  }
}

async function waSendBroadcast() {
  const campName = (document.getElementById('wa-camp-name')?.value||'Broadcast').trim();
  const message = (document.getElementById('wa-broadcast-msg')?.value||'').trim();
  const segment = document.getElementById('wa-segment')?.value || 'all';
  if (!message) { showMktToast('Enter broadcast message'); return; }

  // Fetch customers based on segment
  let query = sb.from('customers').select('name,phone').not('phone','is',null);
  if (segment === 'contractor') query = query.eq('type','contractor');

  const { data: customers } = await query.limit(500).then(r=>r,()=>({data:[]}));
  const validCustomers = (customers||[]).filter(c=>c.phone && c.phone.replace(/[^0-9]/g,'').length >= 10);

  if (!validCustomers.length) { showMktToast('No customers found in this segment with valid phone numbers'); return; }

  const confirmed = confirm('Send to ' + validCustomers.length + ' customers in [' + segment + '] segment? ' + message.slice(0,80));


  if (!confirmed) return;

  showMktToast('⏳ Sending to ' + validCustomers.length + ' customers…');

  const broadcastList = validCustomers.map(c => ({ phone: c.phone, message }));
  const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body: JSON.stringify({ action:'send_broadcast', broadcast_list:broadcastList, campaign_name:campName })
  });
  const d = await res.json();
  if (d.ok) showMktToast('✅ Sent: ' + d.sent + ' · Failed: ' + d.failed);
  else showMktToast('❌ ' + (d.error||'Broadcast failed'));
  setTimeout(() => renderWhatsApp(), 2000);
}

async function waLoadSegmentCount(segment) {
  const el = document.getElementById('wa-segment-count');
  if (!el) return;
  el.textContent = '⏳ Counting…';
  const ninetyDaysAgo = new Date(Date.now() - 90*86400000).toISOString();
  const sixtyDaysAgo  = new Date(Date.now() - 60*86400000).toISOString();
  const oneTwentyDaysAgo = new Date(Date.now() - 120*86400000).toISOString();

  let query = sb.from('customers').select('id', {count:'exact',head:true}).not('phone','is',null);
  if (segment === 'contractor') {
    query = query.eq('type','contractor');
  } else if (segment === 'high_value') {
    query = query.gte('total_spent', 50000);
  } else if (segment === 'inactive') {
    query = query.lt('last_visit', ninetyDaysAgo);
  } else if (segment && segment.startsWith('stage_')) {
    query = query.eq('construction_stage', segment.replace('stage_',''));
  } else if (segment === 'active_flooring') {
    query = query.eq('construction_stage','flooring').gte('last_visit', ninetyDaysAgo);
  } else if (segment === 'active_bathroom') {
    query = query.eq('construction_stage','bathroom').gte('last_visit', ninetyDaysAgo);
  } else if (segment === 'hot_leads') {
    query = query.gte('last_visit', oneTwentyDaysAgo).lt('last_visit', sixtyDaysAgo)
      .in('construction_stage', ['structure','plumbing_roughin','electrical_roughin','flooring','bathroom']);
  }
  const { count } = await query.then(r=>r,()=>({count:0}));
  el.textContent = (count||0) + ' reachable customers in this segment';
}

function loadWATemplate(btn) {
  const name = btn.dataset.name || '';
  const body = decodeURIComponent(btn.dataset.body || '');
  const vars = (body.match(/{{\d+}}/g) || []);
  const varCount = parseInt(btn.dataset.varcount || '0') || vars.length;
  const varNames = ['Customer Name', 'Message Detail', 'Amount / Date / Phone', 'Value 4', 'Value 5'];

  // Build modal via DOM (avoids quote escaping issues)
  const existing = document.getElementById('wa-template-modal');
  if (existing) existing.remove();

  const ov = document.createElement('div');
  ov.id = 'wa-template-modal';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.8);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';

  const card = document.createElement('div');
  card.style.cssText = 'background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:480px;border:1px solid var(--border);margin:auto';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px';
  header.innerHTML = '<div style="font-size:15px;font-weight:700">💬 ' + name + '</div>';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer';
  closeBtn.onclick = () => ov.remove();
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Template body preview
  const preview = document.createElement('div');
  preview.style.cssText = 'background:var(--bg3);border-radius:8px;padding:10px;font-size:11px;color:var(--text2);line-height:1.8;margin-bottom:14px';
  preview.innerHTML = body.replace(/\n/g, '<br>');
  card.appendChild(preview);

  // Variable inputs
  if (varCount === 0) {
    const noVarNote = document.createElement('div');
    noVarNote.style.cssText = 'background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:6px;padding:8px;font-size:11px;color:#22c55e;margin-bottom:12px';
    noVarNote.textContent = '✅ This template has no variables — sends as-is to any number';
    card.appendChild(noVarNote);
  }
  if (varCount > 0) {
    const varDiv = document.createElement('div');
    varDiv.style.cssText = 'display:grid;gap:8px;margin-bottom:12px';
    for (let i = 1; i <= varCount; i++) {
      const d = document.createElement('div');
      const lbl = document.createElement('label');
      lbl.className = 'mkt-form-label';
      lbl.textContent = 'Variable ' + i + ' — replaces {{' + i + '}}';
      const inp = document.createElement('input');
      inp.id = 'wa-var-' + i;
      inp.className = 'mkt-form-input';
      inp.placeholder = varNames[i-1] || 'Value ' + i;
      d.appendChild(lbl);
      d.appendChild(inp);
      varDiv.appendChild(d);
    }
    card.appendChild(varDiv);
  }

  // Send to section
  const sendLabel = document.createElement('div');
  sendLabel.style.cssText = 'font-size:12px;font-weight:700;margin-bottom:8px';
  sendLabel.textContent = 'Send to:';
  card.appendChild(sendLabel);

  const sendGrid = document.createElement('div');
  sendGrid.style.cssText = 'display:grid;gap:8px;margin-bottom:12px';
  sendGrid.innerHTML = '<div><label class="mkt-form-label">Single phone number</label>'
    + '<input id="wa-send-phone" class="mkt-form-input" placeholder="9876543210" type="tel"></div>'
    + '<div style="text-align:center;font-size:11px;color:var(--text3)">— OR —</div>'
    + '<div><label class="mkt-form-label">Bulk — send to segment</label>'
    + '<select id="wa-send-segment" class="mkt-form-select">'
    + '<option value="">Select segment…</option>'
    + '<option value="all">All customers</option>'
    + '<option value="contractor">Contractors only</option>'
    + '<option value="high_value">High value (>₹50k)</option>'
    + '<option value="inactive">Inactive 90 days</option>'
    + '</select></div>';
  card.appendChild(sendGrid);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px';
  const sendBtn = document.createElement('button');
  sendBtn.className = 'mkt-btn mkt-btn-primary';
  sendBtn.style.cssText = 'flex:1;padding:10px;font-weight:700';
  sendBtn.textContent = '📤 Send via Interakt';
  sendBtn.onclick = () => sendWATemplateNow(name, varCount, btn.dataset.lang || 'en');
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'mkt-btn mkt-btn-ghost';
  cancelBtn.style.cssText = 'padding:10px 14px';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => ov.remove();
  btnRow.appendChild(sendBtn);
  btnRow.appendChild(cancelBtn);
  card.appendChild(btnRow);

  // Result area
  const result = document.createElement('div');
  result.id = 'wa-send-result';
  result.style.marginTop = '10px';
  card.appendChild(result);

  ov.appendChild(card);
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('wa-send-phone')?.focus(), 100);
}


async function sendWATemplateNow(templateName, varCount, langCode) {
  const phone = (document.getElementById('wa-send-phone')?.value||'').trim();
  const segment = document.getElementById('wa-send-segment')?.value||'';
  if (!phone && !segment) { showMktToast('Enter a phone number or select a segment'); return; }

  // Get variable values
  const bodyValues = [];
  for (let i = 1; i <= varCount; i++) {
    bodyValues.push(document.getElementById('wa-var-' + i)?.value || 'V Wholesale');
  }

  const resultEl = document.getElementById('wa-send-result');
  if (resultEl) resultEl.innerHTML = '<div style="padding:8px;color:var(--text3);font-size:12px">⏳ Sending via Interakt…</div>';

  try {
    if (phone) {
      // Single send
      const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({ action:'send_template', phone, template_name:templateName, body_values:bodyValues, language_code: langCode||'en' })
      });
      const data = await res.json();
      if (data.ok || data.status === 200 || data.data?.result === 'success') {
        showMktToast('✅ WhatsApp sent to '+phone);
        if (resultEl) resultEl.innerHTML = '<div style="padding:8px;background:rgba(34,197,94,.1);border-radius:6px;font-size:12px;color:#22c55e">✅ Sent successfully to ' + phone + '</div>';
      } else {
        const errMsg = data.error || data.data?.message || JSON.stringify(data).slice(0,100);
        showMktToast('❌ ' + errMsg);
        if (resultEl) resultEl.innerHTML = '<div style="padding:8px;background:rgba(239,68,68,.1);border-radius:6px;font-size:12px;color:#ef4444">❌ ' + errMsg + '</div>';
      }
    } else {
      // Bulk send — fetch phones from CRM
      const phones = await getSegmentPhones(segment);
      if (!phones.length) { showMktToast('No customers found in this segment'); return; }
      if (!confirm('Send to ' + phones.length + ' customers in segment "' + segment + '"?')) return;

      const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({ action:'send_broadcast', phones, template_name:templateName, body_values:bodyValues, language_code: langCode||'en' })
      });
      const data = await res.json();
      showMktToast('✅ Sent to ' + data.sent + ' · Failed: ' + data.failed);
      if (resultEl) resultEl.innerHTML = '<div style="padding:8px;background:rgba(34,197,94,.1);border-radius:6px;font-size:12px;color:#22c55e">✅ Broadcast sent to ' + data.sent + ' customers</div>';

      await sb.from('push_notifications_log').insert({
        title:'WA Broadcast: ' + templateName, body:'Segment: ' + segment, 
        target:'whatsapp', sent_count:data.sent, created_at:new Date().toISOString()
      });
    }
  } catch(e) {
    showMktToast('❌ ' + e.message);
    if (resultEl) resultEl.innerHTML = '<div style="color:var(--red);font-size:11px">❌ ' + e.message + '</div>';
  }
}

async function getSegmentPhones(segment) {
  const ninetyDaysAgo = new Date(Date.now() - 90*86400000).toISOString();
  const sixtyDaysAgo  = new Date(Date.now() - 60*86400000).toISOString();
  const oneTwentyDaysAgo = new Date(Date.now() - 120*86400000).toISOString();

  let query = sb.from('customers').select('phone,type,total_spent,last_visit,construction_stage').not('phone','is',null);

  if (segment === 'contractor') {
    query = query.eq('type','contractor');
  } else if (segment === 'high_value') {
    query = query.gte('total_spent', 50000);
  } else if (segment === 'inactive') {
    query = query.lt('last_visit', ninetyDaysAgo);
  } else if (segment && segment.startsWith('stage_')) {
    // Direct stage filter — e.g. stage_flooring → construction_stage = 'flooring'
    const stageName = segment.replace('stage_', '');
    query = query.eq('construction_stage', stageName);
  } else if (segment === 'active_flooring') {
    query = query.eq('construction_stage', 'flooring').gte('last_visit', ninetyDaysAgo);
  } else if (segment === 'active_bathroom') {
    query = query.eq('construction_stage', 'bathroom').gte('last_visit', ninetyDaysAgo);
  } else if (segment === 'hot_leads') {
    // Bought 60-120 days ago — likely moving to next stage now
    query = query.gte('last_visit', oneTwentyDaysAgo).lt('last_visit', sixtyDaysAgo)
      .in('construction_stage', ['structure','plumbing_roughin','electrical_roughin','flooring','bathroom']);
  }
  // all = no filter

  const { data } = await query.limit(500).then(r=>r,()=>({data:[]}));
  return (data||[]).map(c => c.phone).filter(Boolean).map(p => p.replace(/\D/g,'').slice(-10));
}

function useWATemplate(name, body) {
  const el = document.getElementById('wa-broadcast-msg') || document.getElementById('wa-single-msg');
  if (el) el.value = body.replace(/\\n/g,'\n').replace(/{{1}}/g,'[Customer Name]').replace(/{{2}}/g,'[Detail]').replace(/{{3}}/g,'[Value]');

  showMktToast('✅ Template loaded — edit the placeholders');
}

async function waQuickAction(type) {
  const actions = {
    quotation: { title:'Quotation Notification', fields:[{l:'Customer phone',id:'qa-phone',p:'9876543210'},{l:'Customer name',id:'qa-name',p:'Ravi Kumar'},{l:'Quotation number',id:'qa-quot',p:'TQ-2026-001'},{l:'Total amount',id:'qa-total',p:'45,000'}] },
    review: { title:'Review Request', fields:[{l:'Customer phone',id:'qa-phone',p:'9876543210'},{l:'Customer name',id:'qa-name',p:'Ravi Kumar'},{l:'Product purchased',id:'qa-product',p:'Italian Marble Tiles'}] },
    festival: { title:'Festival Greeting', fields:[{l:'Festival name',id:'qa-festival',p:'Diwali'},{l:'Customer phone',id:'qa-phone',p:'9876543210'},{l:'Customer name',id:'qa-name',p:'Ravi Kumar'}] },
    contractor: { title:'Contractor Update', fields:[{l:'Contractor phone',id:'qa-phone',p:'9876543210'},{l:'Contractor name',id:'qa-name',p:'Kumar'},{l:'Update message',id:'qa-update',p:'You referred 3 new customers this month'},{l:'Referral earnings',id:'qa-earn',p:'2,500'}] },
  };

  const action = actions[type];
  if (!action) return;

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.className = 'wa-quick-modal';
  ov.innerHTML = '<div style="background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:400px;border:1px solid var(--border)">'
    + '<div style="font-size:15px;font-weight:700;margin-bottom:14px">💬 ' + action.title + '</div>'
    + '<div style="display:grid;gap:8px;margin-bottom:12px">'
    + action.fields.map(f => '<div><label class="mkt-form-label">' + f.l + '</label>'
      + (f.type==='select'
        ? '<select id="' + f.id + '" class="mkt-form-select">' + (f.opts||[]).map(o=>'<option>'+o+'</option>').join('') + '</select>'
        : '<input id="' + f.id + '" class="mkt-form-input" placeholder="' + f.p + '">') + '</div>'
    ).join('')
    + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button onclick="waQuickSend(this.dataset.type)" data-type="' + type + '" class="mkt-btn mkt-btn-primary" style="flex:1;padding:10px;font-weight:700">Send WhatsApp</button>'
    + '<button onclick="document.querySelectorAll(\'.wa-quick-modal\').forEach(e=>e.remove())" class="mkt-btn mkt-btn-ghost" style="padding:10px 14px">Cancel</button>'
    + '</div></div>';
  document.body.appendChild(ov);
}

async function waQuickSend(btnOrType) {
  const type = typeof btnOrType === 'string' ? btnOrType : (btnOrType?.dataset?.type||'quotation');
  const phone = (document.getElementById('qa-phone')?.value||'').trim();
  const name = (document.getElementById('qa-name')?.value||'Customer').trim();
  let message = '';

  if (type === 'quotation') {
    const quot = document.getElementById('qa-quot')?.value||'';
    const total = document.getElementById('qa-total')?.value||'';
    message = 'Hi ' + name + '! Your quotation from V Wholesale is ready. Quotation: ' + quot + '. Total: Rs ' + total + '. Valid 7 days. Call: 8712697930. Visit: Visit V Wholesale. Team V Wholesale';
  } else if (type === 'review') {
    const product = document.getElementById('qa-product')?.value||'your purchase';
    message = 'Hi ' + name + '! Thank you for shopping at V Wholesale. We hope you are loving your ' + product + '. Please rate us on Google - search V Wholesale Vijayawada. Your feedback means a lot! Team V Wholesale';
  } else if (type === 'contractor') {
    const earn = document.getElementById('qa-earn')?.value||'0';
    message = 'Hi ' + name + '! V Wholesale Contractor Club update: This month earnings: Rs ' + earn + '. Keep referring and earning! 2% on every referral. Call: 8712697930. Team V Wholesale';
  } else {
    const festival = document.getElementById('qa-festival')?.value||'festival';
    message = festival + ' subhakankshalu! V Wholesale nundi meeku mariyu meeru kutumbaaniki subhasirvadalu. Visit V Wholesale. 8712697930. Team V Wholesale';
  }

  if (!phone && type !== 'festival') { showMktToast('Enter phone number'); return; }
  document.querySelectorAll('.wa-quick-modal').forEach(e=>e.remove());

  // Map quick action types to actual approved Interakt templates
  // vwholesale_* templates on WABA 1183561931509509. Variable order must match
  // the approved template exactly — Meta rejects a mismatched parameter count.
  const val = function(id) { return (document.getElementById(id)?.value || '').trim(); };
  const templateMap = {
    // {{1}} name, {{2}} quotation no, {{3}} total
    quotation: { name:'vwholesale_quotation_ready',
                 values:[name || 'Customer', val('qa-quot'), val('qa-total')] },
    // {{1}} name, {{2}} product
    review:    { name:'vwholesale_feedback_request',
                 values:[name || 'Customer', val('qa-product') || 'your purchase'] },
    // {{1}} festival, {{2}} name
    festival:  { name:'vwholesale_festival_greeting',
                 values:[val('qa-festival') || 'the festival', name || 'Customer'] },
    // {{1}} name, {{2}} update, {{3}} earnings
    contractor:{ name:'vwholesale_contractor_update',
                 values:[name || 'Customer', val('qa-update'), val('qa-earn')] },
  };
  const tmpl = templateMap[type];
  if (!tmpl) { showMktToast('Unknown quick action: ' + type); return; }
  if (tmpl.values.some(function(v) { return !v; })) {
    showMktToast('Please fill every field — Meta rejects templates with empty variables');
    return;
  }

  const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body: JSON.stringify({ action:'send_template', phone, template_name: tmpl.name, body_values: tmpl.values, language_code:'en' })
  });
  const d = await res.json();
  showMktToast(d.ok ? '✅ WhatsApp sent to ' + name : '❌ ' + (d.error||'Send failed'));
}


async function waEvidence(btn) {
  const out = document.getElementById('wa-register-output');
  if (btn) { btn.textContent = 'Capturing...'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">Capturing all Graph API responses with timestamps...</div>';
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/wa-evidence', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({})
    });
    const d = await res.json();
    let txt = 'META SUPPORT EVIDENCE PACK\n';
    txt += 'Captured: ' + d.captured_at_utc + ' UTC\n';
    txt += '='.repeat(60) + '\n\n';
    (d.results || []).forEach(function(r) {
      txt += r.label + '\n';
      txt += 'URL: ' + r.url + '\n';
      txt += 'At:  ' + r.captured_at_utc + ' UTC\n';
      txt += 'HTTP ' + r.http_status + '\n';
      txt += r.raw + '\n\n' + '-'.repeat(60) + '\n\n';
    });
    let h = '<div style="background:var(--bg2);border-radius:6px;padding:8px;margin-top:6px">';
    h += '<pre style="white-space:pre-wrap;word-break:break-all;margin:0;font-size:9px;color:var(--text2);max-height:300px;overflow-y:auto">' + txt + '</pre>';
    h += '</div>';
    if (out) {
      out.innerHTML = h;
      const b = document.createElement('button');
      b.className = 'mkt-btn mkt-btn-primary';
      b.style.cssText = 'font-size:11px;padding:6px 12px;margin-top:6px';
      b.textContent = 'Copy evidence pack';
      b.onclick = function() { navigator.clipboard.writeText(txt).then(function(){ showMktToast('Copied — paste into the Meta ticket'); }); };
      out.appendChild(b);
    }
  } catch (e) {
    if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent = '📋 Capture Evidence'; btn.disabled = false; }
  }
}

async function waAudit(btn) {
  const out = document.getElementById('wa-register-output');
  if (btn) { btn.textContent = 'Auditing...'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">Auditing token identity...</div>';
  try {
    const r = await fetch(MKT_SB_URL + '/functions/v1/wa-audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'audit' })
    });
    const d = await r.json();
    const match = d.MATCHES_NEW_APP;
    let h = '<div style="background:var(--bg2);border-radius:6px;padding:10px;font-size:11px;line-height:1.9">';
    h += '<div style="font-weight:700;color:var(--gold);margin-bottom:6px">TOKEN AUDIT</div>';
    h += '<div><span style="color:var(--text3)">Token belongs to app:</span> '
      + (match ? '<span style="color:#22c55e">' : '<span style="color:#ef4444">')
      + (d.token_app_name || '?') + ' (' + (d.token_app_id || 'unknown') + ')</span></div>';
    h += '<div><span style="color:var(--text3)">Expected app:</span> V Wholesale WA (2156593291691763)</div>';
    h += '<div><span style="color:var(--text3)">Match:</span> '
      + (match ? '<span style="color:#22c55e">YES</span>' : '<span style="color:#ef4444">NO — THIS IS THE PROBLEM</span>') + '</div>';
    h += '<div><span style="color:var(--text3)">Type:</span> ' + (d.token_type || '?') + '</div>';
    h += '<div><span style="color:var(--text3)">Valid:</span> ' + (d.is_valid ? 'yes' : 'no') + '</div>';
    h += '<div><span style="color:var(--text3)">Expires:</span> ' + (d.expires_at === 0 ? 'never' : d.expires_at) + '</div>';
    h += '<div><span style="color:var(--text3)">System user:</span> ' + JSON.stringify(d.system_user || {}) + '</div>';
    h += '<div style="font-size:9px;color:var(--text3);margin-top:4px">scopes: ' + ((d.scopes || []).join(', ') || 'none') + '</div>';
    h += '</div>';
    if (!match) {
      h += '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:6px;padding:8px;font-size:11px;color:var(--text2);margin-top:8px;line-height:1.6">'
        + '<b style="color:#ef4444">Root cause candidate</b><br>'
        + 'Our system-user token was issued for a different app. Messages sent with it '
        + 'are attributed to that app, and its webhook events route there — not to '
        + 'V Wholesale WA. That would explain why neither inbound messages nor outbound '
        + 'status webhooks arrive, while Meta\'s dashboard test (which targets our callback '
        + 'directly) does.<br><br>'
        + '<b>Fix:</b> Business Settings → Users → System users → Vwholesale api → '
        + 'Add Assets → Apps → V Wholesale WA (Full control) → then Generate New Token '
        + 'selecting <b>V Wholesale WA</b>, with whatsapp_business_messaging + '
        + 'whatsapp_business_management.</div>';
    } else {
      h += '<button onclick="waRebind(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px;margin-top:8px">Controlled rebind (unsub + resub)</button>';
    }
    if (out) out.innerHTML = h;
  } catch (e) {
    if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent = '🔬 Token Audit'; btn.disabled = false; }
  }
}

async function waRebind(btn) {
  if (btn) { btn.textContent = 'Rebinding...'; btn.disabled = true; }
  const out = document.getElementById('wa-register-output');
  try {
    const r = await fetch(MKT_SB_URL + '/functions/v1/wa-audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'rebind' })
    });
    const d = await r.json();
    if (d.refused) { showMktToast(d.error); return; }
    const after = JSON.stringify(d.after_subscribe || {});
    showMktToast('Rebind done. Subscribed now: ' + after);
    if (out) out.innerHTML = '<pre style="white-space:pre-wrap;word-break:break-all;font-size:10px;background:var(--bg2);padding:8px;border-radius:6px">'
      + JSON.stringify(d, null, 2) + '</pre>';
  } catch (e) {
    showMktToast(e.message);
  } finally {
    if (btn) { btn.textContent = 'Controlled rebind (unsub + resub)'; btn.disabled = false; }
  }
}

// ── AI KILL SWITCH ──
// Two buttons called toggleAIPause() and nothing defined it — the emergency
// stop was a painted button. Harmless while nothing ran unattended; not
// harmless once cron posts to Instagram on its own.
let _aiPaused = false;

async function loadAIPauseStatus() {
  try {
    const { data } = await sb.from('marketing_settings').select('value')
      .eq('key', 'AI_PAUSED').maybeSingle().then(r => r, () => ({ data: null }));
    _aiPaused = data?.value === 'true';
  } catch (e) { _aiPaused = false; }
  paintAIPause();
}

function paintAIPause() {
  const b = document.getElementById('ai-pause-btn');
  if (!b) return;
  b.textContent = _aiPaused ? '▶️ Resume AI  (PAUSED)' : '🛑 Pause All AI Actions';
  b.style.background = _aiPaused ? '#ef4444' : '';
  b.style.color = _aiPaused ? '#fff' : '';
  b.style.fontWeight = _aiPaused ? '700' : '';
}

async function toggleAIPause() {
  const next = !_aiPaused;
  if (next && !confirm('Pause all AI actions?\n\nScheduled content generation and auto-posting will stop until you resume. Nothing already published is affected.')) return;
  try {
    const { error } = await sb.from('marketing_settings')
      .upsert({ key: 'AI_PAUSED', value: next ? 'true' : 'false' }, { onConflict: 'key' });
    if (error) { showMktToast('Could not change it: ' + error.message); return; }
    _aiPaused = next;
    paintAIPause();
    showMktToast(next ? 'AI paused — scheduled posting stopped' : 'AI resumed');
    if (typeof renderSettings === 'function' && document.getElementById('mkt-page-title')?.textContent === 'Settings') renderSettings();
  } catch (e) { showMktToast(e.message); }
}

async function waPhoneWebhook(btn) {
  const out = document.getElementById('wa-register-output');
  if (btn) { btn.textContent = 'Reading...'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">Reading phone-level webhook config...</div>';
  try {
    const r1 = await fetch(MKT_SB_URL + '/functions/v1/wa-phone-webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'phone_webhook' })
    });
    const d1 = await r1.json();
    const r2 = await fetch(MKT_SB_URL + '/functions/v1/wa-phone-webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'waba_webhook' })
    });
    const d2 = await r2.json();

    let h = '<div style="background:var(--bg2);border-radius:6px;padding:8px;font-size:10px;line-height:1.6">';
    h += '<div style="font-weight:700;color:var(--gold);margin-bottom:4px">PHONE ' + '1269550786231910' + ' (raw)</div>';
    h += '<pre style="white-space:pre-wrap;word-break:break-all;margin:0;font-size:10px;color:var(--text2)">' + (d1.raw_json || JSON.stringify(d1)) + '</pre>';
    h += '<div style="font-weight:700;color:var(--gold);margin:8px 0 4px">WABA (raw)</div>';
    h += '<pre style="white-space:pre-wrap;word-break:break-all;margin:0;font-size:10px;color:var(--text2)">' + (d2.raw_json || JSON.stringify(d2)) + '</pre>';
    h += '</div>';
    if (out) out.innerHTML = h;
  } catch (e) {
    if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent = '📞 Phone Webhook Override'; btn.disabled = false; }
  }
}


async function waWebhookCheck(btn) {
  const out = document.getElementById('wa-register-output');
  if (btn) { btn.textContent = 'Checking...'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">Checking...</div>';
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/wa-webhook-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'check' })
    });
    const d = await res.json();

    // v5 field names
    const viaUser = d.subscribed_apps_via_user_token || {};
    const apps = viaUser.data || [];
    const appErr = viaUser.error?.message;
    const phones = (d.phone_numbers_in_waba || {}).data || [];
    const phoneErr = (d.phone_numbers_in_waba || {}).error?.message;

    const green = function(s) { return '<span style="color:#22c55e">' + s + '</span>'; };
    const red = function(s) { return '<span style="color:#ef4444">' + s + '</span>'; };

    let h = '<div style="background:var(--bg2);border-radius:6px;padding:8px;font-size:11px;line-height:1.8">';
    h += '<div><span style="color:var(--text3)">WABA:</span> ' + (d.waba_id || '-') + '</div>';
    if (d.token_belongs_to_app) {
      const ta = d.token_belongs_to_app;
      const isNew = String(ta.id) === '2156593291691763';
      h += '<div><span style="color:var(--text3)">Our token belongs to app:</span> '
        + (isNew ? '<span style="color:#22c55e">' : '<span style="color:#f59e0b">')
        + (ta.name || ta.id) + ' (' + ta.id + ')</span></div>';
    }

    // Check 1: app subscribed to WABA
    h += '<div><span style="color:var(--text3)">App subscribed to WABA:</span> '
      + (apps.length ? green('yes (' + apps.length + ')') : red(appErr || 'no')) + '</div>';
    if (apps.length) {
      h += '<div style="font-size:9px;color:var(--text3)">'
        + apps.map(function(a) { return a.whatsapp_business_api_data?.name || a.id || JSON.stringify(a); }).join(', ') + '</div>';
    }

    // Check 2: phone number in WABA
    h += '<div><span style="color:var(--text3)">Phone numbers in WABA:</span> '
      + (phones.length ? green(phones.length + '') : red(phoneErr || '0')) + '</div>';
    phones.forEach(function(p) {
      h += '<div style="font-size:9px;color:var(--text3)">' + (p.display_phone_number || '?') + ' — id ' + p.id + ' — ' + (p.platform_type || '?') + '</div>';
    });

    // Check 3: app webhook
    h += '<div><span style="color:var(--text3)">Callback URL:</span> ' + (d.app_webhook_callback ? green('set') : red('missing')) + '</div>';
    h += '<div><span style="color:var(--text3)">Active:</span> ' + (d.app_webhook_active ? green('yes') : red('no')) + '</div>';
    const flds = d.app_webhook_fields || [];
    h += '<div><span style="color:var(--text3)">messages field:</span> ' + (flds.indexOf('messages') >= 0 ? green('subscribed') : red('no')) + '</div>';
    h += '</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
    h += '<button onclick="waInstallWebhook(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">Reinstall webhook</button>';
    h += '<button onclick="waRemoveOldApp(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px">Fix app routing</button>';
    h += '</div>';
    if (apps.length > 1) {
      h += '<div style="font-size:10px;color:#f59e0b;margin-top:6px;line-height:1.5">'
        + 'Two apps are subscribed to this WABA. The old app has no WhatsApp webhook, '
        + 'so Meta may be routing inbound messages to it and they disappear. '
        + 'Removing it should leave only V Wholesale WA receiving messages.</div>';
    }
    if (out) out.innerHTML = h;
  } catch (e) {
    if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent = '🔗 Check Webhook'; btn.disabled = false; }
  }
}

async function waRemoveOldApp(btn) {
  if (!confirm('Remove the app our system-user token belongs to from this WABA, then subscribe V Wholesale WA properly?\n\nThis only affects WhatsApp message routing for this WABA. Instagram, Facebook and Threads are unaffected.')) return;
  if (btn) { btn.textContent = 'Fixing...'; btn.disabled = true; }
  const out = document.getElementById('wa-register-output');
  try {
    // 1. Remove whichever app our system-user token represents (likely the old one)
    const r1 = await fetch(MKT_SB_URL + '/functions/v1/wa-webhook-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'unsubscribe_via_user_token' })
    });
    const d1 = await r1.json();
    // 2. Subscribe the NEW app using its own app token
    const r2 = await fetch(MKT_SB_URL + '/functions/v1/wa-webhook-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'subscribe_new_app' })
    });
    const d2 = await r2.json();
    const msg = 'Removed: ' + (d1.ok ? 'OK' : (d1.error || 'failed'))
      + ' | Subscribed new app: ' + (d2.ok ? 'OK' : (d2.error || 'failed'));
    showMktToast(msg);
    if (out) out.innerHTML = '<div style="font-size:10px;background:var(--bg2);padding:6px;border-radius:4px">' + msg + '</div>';
    setTimeout(waWebhookCheck, 1000);
  } catch (e) {
    showMktToast(e.message);
  } finally {
    if (btn) { btn.textContent = 'Fix app routing'; btn.disabled = false; }
  }
}

async function waInstallWebhook(btn) {
  // DISABLED: this used the system-user token, which belongs to the OLD app.
  // Running it re-subscribed the wrong app to the WABA and undid the fix.
  // Use Token Audit -> Rebind instead; that path refuses on app-ID mismatch.
  showMktToast('Disabled — use Token Audit. This button used a token from the wrong app.');
}

async function waCloudStatus(btn) {
  const out = document.getElementById('wa-register-output');
  if (btn) { btn.textContent = 'Checking...'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">Checking Cloud API status...</div>';
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/meta-whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'status' })
    });
    const d = await res.json();
    if (out) {
      const rows = [
        ['Phone', d.display_phone_number || '—'],
        ['Name', d.verified_name || '—'],
        ['Quality', d.quality_rating || '—'],
        ['Status', d.status || '—'],
        ['Verification', d.code_verification_status || '—'],
        ['Platform', d.platform_type || '—'],
      ];
      out.innerHTML = '<div style="background:var(--bg2);border-radius:6px;padding:8px;font-size:11px">'
        + (d.error ? '<div style="color:var(--red)">' + d.error + '</div>'
          : rows.map(function(r) { return '<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--text3)">' + r[0] + '</span><span style="font-weight:600">' + r[1] + '</span></div>'; }).join(''))
        + '</div>';
    }
  } catch (e) {
    if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent = '📋 Check Status'; btn.disabled = false; }
  }
}

async function waCloudRegister(btn) {
  const pin = (document.getElementById('wa-register-pin')?.value || '').trim();
  const out = document.getElementById('wa-register-output');
  if (!/^\d{6}$/.test(pin)) { showMktToast('Enter a 6-digit PIN'); return; }
  if (btn) { btn.textContent = 'Registering...'; btn.disabled = true; }
  if (out) out.innerHTML = '<div style="font-size:11px;color:var(--text3)">Registering on Cloud API...</div>';
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/meta-whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'register', pin: pin })
    });
    const d = await res.json();
    if (d.ok) {
      showMktToast('Number registered on Cloud API');
      if (out) out.innerHTML = '<div style="background:rgba(34,197,94,.1);border-radius:6px;padding:8px;font-size:11px;color:#22c55e">Registered. WhatsApp sending is now live.</div>';
    } else {
      showMktToast('Register failed');
      if (out) out.innerHTML = '<div style="background:rgba(239,68,68,.1);border-radius:6px;padding:8px;font-size:11px;color:#ef4444">'
        + (d.error || 'Failed') + (d.code ? '<br><span style="opacity:.7">Code: ' + d.code + '</span>' : '') + '</div>';
    }
  } catch (e) {
    if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent = '☁️ Register Number'; btn.disabled = false; }
  }
}

async function verifyInterakt(btn) {
  if (btn) { btn.textContent='⏳ Verifying…'; btn.disabled=true; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'verify' })
    });
    const data = await res.json();
    if (data.connected) {
      showMktToast('✅ Interakt connected! Templates: '+data.template_count);
      await sb.from('social_connections').upsert({platform:'whatsapp',status:'connected',access_token_set:true,updated_at:new Date().toISOString()},{onConflict:'platform'});
      renderWhatsApp();
    } else {
      showMktToast('❌ Connection failed — check API key in Integrations');
    }
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🔗 Verify Connection'; btn.disabled=false; } }
}

async function generateWABroadcast() {
  const template = document.getElementById('wa-template')?.value||'festival_offer';
  const audience = document.getElementById('wa-audience')?.value||'all';
  const offer = (document.getElementById('wa-offer')?.value||'').trim();
  const lang = document.getElementById('wa-lang')?.value||'te+en';

  showMktToast('🤖 Writing broadcast message…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({
      task:'whatsapp_broadcast', platform:'WhatsApp', language:lang,
      topic:template+(offer?' — '+offer:''),
      context:{
        business:'V Wholesale', location:'Vijayawada',
        template, audience, offer,
        phone:'8712697930', website:'vwholesale.in'
      }
    })
  });
  const data = await res.json();
  const content = data.content||data.text||'';
  if (!content) { showMktToast('❌ Failed to generate'); return; }

  document.getElementById('wa-broadcast-output').style.display='block';
  document.getElementById('wa-broadcast-content').textContent = content;
}

function copyWABroadcast() {
  navigator.clipboard.writeText(document.getElementById('wa-broadcast-content')?.textContent||'')
    .then(()=>showMktToast('📋 Copied! Paste in WhatsApp Business or Interakt'));
}

async function sendWABroadcast(templateName, bodyValues, phones, btn) {
  if (!phones?.length) { showMktToast('No phone numbers provided'); return; }
  if (!templateName) { showMktToast('Select a template first'); return; }
  if (btn) { btn.textContent='⏳ Sending…'; btn.disabled=true; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'send_broadcast', template_name:templateName, body_values:bodyValues||[], phones, language_code:'en' })
    });
    const data = await res.json();
    if (data.ok) {
      showMktToast('✅ Sent to '+data.sent+' · Failed: '+data.failed);
      // Log to DB
      await sb.from('push_notifications_log').insert({title:'WhatsApp: '+templateName, body:'Sent to '+data.sent+' numbers', target:'whatsapp', sent_count:data.sent, created_at:new Date().toISOString()});
    } else showMktToast('❌ '+data.error);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='📤 Send Broadcast'; btn.disabled=false; } }
}
async function generateWAMessage() {
  const details = (document.getElementById('wa-details')?.value||'').trim();
  if (!details) { showMktToast('Enter what the message is about first'); return; }
  showMktToast('🤖 Writing WhatsApp message…');
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'generate_text', agent:'WhatsApp AI Write',
        prompt: 'Write a WhatsApp message for V Wholesale Vijayawada about: ' + details + '. Keep under 160 characters. Warm, direct, includes CTA. Return just the message text.',
        context: {}
      })
    });
    const data = await res.json();
    const content = typeof data.output === 'string' ? data.output : (data.output?.message || data.output?.master_text) || data.output?.whatsapp_text || '';
    if (!content) throw new Error('No content generated');
    const outEl = document.getElementById('wa-output');
    const contentEl = document.getElementById('wa-content');
    if (outEl) outEl.style.display = 'block';
    if (contentEl) contentEl.textContent = content;
    showMktToast('✅ Message ready');
  } catch(e) { showMktToast('❌ ' + e.message); }
}

async function waAIWrite(btn) {
  // Use custom modal — browser prompt() closes on window switch
  const ov = document.createElement('div');
  ov.id = 'wa-ai-write-modal';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--bg2);border-radius:12px;padding:20px;width:100%;max-width:400px;border:1px solid var(--border)';
  card.innerHTML = '<div style="font-size:14px;font-weight:700;margin-bottom:10px">✨ AI Write WhatsApp Message</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Describe what this message is about and AI will write it</div>'
    + '<textarea id="wa-ai-topic" class="mkt-form-input" rows="3" placeholder="e.g. V Wholesale running 40 rs per sft tile sale this month, valid till end of July, visit V Wholesale"></textarea>'
    + '<div style="display:flex;gap:8px;margin-top:10px">'
    + '<button id="wa-ai-generate-btn" class="mkt-btn mkt-btn-primary" style="flex:1;padding:10px;font-weight:700">✨ Generate</button>'
    + '<button id="wa-ai-cancel-btn" class="mkt-btn mkt-btn-ghost" style="padding:10px 14px">Cancel</button>'
    + '</div>'
    + '<div id="wa-ai-output" style="margin-top:10px"></div>';
  ov.appendChild(card);
  document.body.appendChild(ov);
  // Wire cancel button
  const cancelBtn = document.getElementById('wa-ai-cancel-btn');
  if (cancelBtn) cancelBtn.onclick = () => ov.remove();
  setTimeout(() => document.getElementById('wa-ai-topic')?.focus(), 100);

  document.getElementById('wa-ai-generate-btn').onclick = async () => {
    const topic = (document.getElementById('wa-ai-topic')?.value||'').trim();
    if (!topic) { showMktToast('Enter what the message is about'); return; }
    const gBtn = document.getElementById('wa-ai-generate-btn');
    if (gBtn) { gBtn.textContent='⏳ Writing…'; gBtn.disabled=true; }
    try {
      const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({
          action:'generate_text', agent:'WhatsApp AI Write',
          prompt: 'Write a WhatsApp message for V Wholesale Vijayawada. Topic: ' + topic + '. Keep under 200 characters. Warm, direct, includes CTA to visit or call 8712697930. Return just the message text, no JSON.',
          context: {}
        })
      });
      const data = await res.json();
      console.log('[WA AI Write] API response:', JSON.stringify(data).slice(0,500));
      // Parse output — marketing-ai returns various formats
      let msg = '';
      if (typeof data.output === 'string') {
        msg = data.output;
      } else if (typeof data.output === 'object' && data.output !== null) {
        msg = data.output.message || data.output.master_text || data.output.whatsapp_text || data.output.text || Object.values(data.output)[0] || '';
      } else if (data.result) {
        msg = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
      } else if (data.content) {
        msg = data.content;
      } else if (data.text) {
        msg = data.text;
      } else if (data.message) {
        msg = data.message;
      }
      msg = (msg||'').trim();
      if (!msg) throw new Error('Empty response from AI — console has details');

      const outEl = document.getElementById('wa-ai-output');
      if (outEl) {
        outEl.innerHTML = '';
        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = 'background:var(--bg3);border-radius:8px;padding:10px;font-size:12px;line-height:1.8;color:var(--text2);margin-bottom:8px';
        msgDiv.textContent = msg;
        outEl.appendChild(msgDiv);
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px';
        const copyBtn2 = document.createElement('button');
        copyBtn2.className = 'mkt-btn mkt-btn-ghost';
        copyBtn2.style.cssText = 'font-size:11px;padding:5px 10px';
        copyBtn2.textContent = 'Copy';
        copyBtn2.onclick = function() { navigator.clipboard.writeText(msg).then(function() { showMktToast('Copied!'); }); };
        const useBtn2 = document.createElement('button');
        useBtn2.className = 'mkt-btn mkt-btn-primary';
        useBtn2.style.cssText = 'font-size:11px;padding:5px 10px';
        useBtn2.textContent = 'Use this message';
        useBtn2.onclick = function() { fillWAMessage(msg); var m = document.getElementById('wa-ai-write-modal'); if(m) m.remove(); };
        btnRow.appendChild(copyBtn2);
        btnRow.appendChild(useBtn2);
        outEl.appendChild(btnRow);
      }
      } catch(e) {
      const outEl = document.getElementById('wa-ai-output');
      if (outEl) outEl.innerHTML = '<div style="color:var(--red);font-size:11px">❌ ' + e.message + '</div>';
    } finally {
      if (gBtn) { gBtn.textContent='✨ Generate'; gBtn.disabled=false; }
    }
  };
}

function fillWAMessage(msg) {
  // Fill into single message input or broadcast message
  const singleEl = document.getElementById('wa-single-msg');
  const broadcastEl = document.getElementById('wa-broadcast-msg');
  if (singleEl) singleEl.value = msg;
  if (broadcastEl) broadcastEl.value = msg;
  showMktToast('✅ Message filled');
}

async function syncWATemplates(btn) {
  if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }
  showMktToast('🔄 Fetching templates from Interakt…');
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'get_templates' })
    });
    const data = await res.json();
    const templates = data.templates || [];
    if (!templates.length) { showMktToast('⚠️ No templates returned from Interakt'); return; }

    for (const t of templates) {
      const body = t.body || t.components?.find(c=>c.type==='BODY')?.text || t.content || '';
      const varNums = (body.match(/{{\d+}}/g)||[]).map(v=>parseInt(v.replace(/[{}]/g,'')));
      const varCount = varNums.length ? Math.max(...varNums) : 0;
      const status = (t.status||t.approvalStatus||'').toLowerCase().includes('approv') ? 'approved' : (t.status||'pending').toLowerCase();
      await sb.from('whatsapp_templates').upsert({
        name: t.name,
        status,
        language: t.language || t.languageCode || 'en',
        category: t.category || 'MARKETING',
        body: body.slice(0,500),
        var_count: varCount
      },{onConflict:'name'}).then(r=>r,()=>null);
    }
    showMktToast('✅ Synced ' + templates.length + ' templates');
    renderWhatsApp();
  } catch(e) {
    showMktToast('❌ ' + e.message);
  } finally {
    if (btn) { btn.textContent = '🔄 Sync from Interakt'; btn.disabled = false; }
  }
}

function copyWAMessage() {
  navigator.clipboard.writeText(document.getElementById('wa-content')?.textContent||'').then(()=>showMktToast('📋 Copied!'));
}

async function generateAdCopy() {
  const topic = (document.getElementById('ads-topic')?.value||'').trim();
  if (!topic) { showMktToast('Enter a topic'); return; }
  showMktToast('🤖 Generating ad copy…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'ad_copy',language:'en',topic,context:{business:'V Wholesale',location:'Vijayawada, Andhra Pradesh',budget_inr:30000}})});
  const data = await res.json();
  const out = document.getElementById('ads-output');
  if (out) { out.style.display='block'; out.textContent=data.content||data.text||'No output'; }
}

function renderAds() {
  // Async wrapper
  _renderAdsAsync();
}

async function _renderAdsAsync() {
  setContent(`<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading ads…</div>`);

  const [
    { data: settings },
    { data: contentPosts }
  ] = await Promise.all([
    sb.from('marketing_settings').select('key,value').in('key',['META_AD_ACCOUNT_ID','META_ACCESS_TOKEN','META_PAGE_ID','META_IG_ID']).then(r=>r,()=>({data:[]})),
    sb.from('content_posts').select('id,topic,post_type,master_text,master_image_url,status,created_at').order('created_at',{ascending:false}).limit(20).then(r=>r,()=>({data:[]}))
  ]);

  const cfg = {};
  (settings||[]).forEach(s => { cfg[s.key] = s.value; });
  const isReady = !!(cfg.META_AD_ACCOUNT_ID && cfg.META_ACCESS_TOKEN);

  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div>
      <h3 style="font-size:16px;font-weight:900">📢 Advertising</h3>
      <div style="font-size:12px;color:var(--text3)">Boost posts · Run campaigns · Track performance · All via Meta Ads API</div>
    </div>
    <span class="badge ${isReady?'badge-green':'badge-yellow'}">${isReady?'✅ Ad Account Ready':'⚙️ Setup needed'}</span>
  </div>

  ${!isReady ? `
  <div class="mkt-card" style="margin-bottom:14px;border-left:3px solid var(--gold)">
    <div style="font-size:13px;font-weight:700;margin-bottom:10px">⚙️ Connect Meta Ad Account</div>
    <div style="display:grid;gap:8px;margin-bottom:10px">
      <div>
        <label class="mkt-form-label">Ad Account ID <span style="color:var(--text3);font-weight:400">(Ads Manager URL → act_XXXXXXXXX)</span></label>
        <input id="ad-account-id" class="mkt-form-input" placeholder="act_1234567890" value="${cfg.META_AD_ACCOUNT_ID||''}">
      </div>
      <div>
        <label class="mkt-form-label">System User Access Token <span style="color:var(--text3);font-weight:400">(Business Settings → System Users → Generate Token)</span></label>
        <input id="ads-token" class="mkt-form-input" type="password" placeholder="EAAxxxxxxxxxx">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label class="mkt-form-label">Facebook Page ID</label>
          <input id="ads-page-id" class="mkt-form-input" placeholder="${cfg.META_PAGE_ID||'auto-filled if Meta connected'}" value="${cfg.META_PAGE_ID||''}">
        </div>
        <div>
          <label class="mkt-form-label">Instagram Account ID</label>
          <input id="ads-ig-id" class="mkt-form-input" placeholder="${cfg.META_IG_ID||'auto-filled if Meta connected'}" value="${cfg.META_IG_ID||''}">
        </div>
      </div>
    </div>
    <button onclick="saveAdAccountSettings()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:10px;font-weight:700">💾 Save & Verify</button>
    <div style="margin-top:10px;background:var(--bg3);border-radius:8px;padding:10px;font-size:11px;color:var(--text3)">
      <b>How to get System User Token:</b><br>
      business.facebook.com → Settings → Users → System Users → select Admin user → Generate New Token → select your app → tick: ads_management, ads_read, business_management → Generate
    </div>
  </div>` : ''}

  <!-- BOOST A POST -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;margin-bottom:4px">⚡ Boost a post</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Amplify an existing post. Fastest way to increase reach with paid spend.</div>
    <div style="display:grid;gap:8px">
      <div>
        <label class="mkt-form-label">Select post</label>
        <select id="boost-post-select" class="mkt-form-select" onchange="adsBoostPreview()">
          <option value="">— Choose post to boost —</option>
          ${(contentPosts||[]).map(p=>`<option value="${p.id}" data-text="${(p.master_text||p.topic||'').slice(0,80).replace(/"/g,'&quot;')}" data-img="${p.master_image_url||''}">${p.topic||'Untitled'} · ${p.post_type||'image'} · ${new Date(p.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>
          <label class="mkt-form-label">Daily budget (₹)</label>
          <input id="boost-budget" class="mkt-form-input" type="number" value="200" min="100" step="50" oninput="adsUpdateTotal()">
        </div>
        <div>
          <label class="mkt-form-label">Days</label>
          <input id="boost-days" class="mkt-form-input" type="number" value="5" min="1" max="30" oninput="adsUpdateTotal()">
        </div>
        <div>
          <label class="mkt-form-label">Total spend</label>
          <div id="boost-total-display" style="padding:8px 10px;background:var(--bg3);border-radius:6px;font-size:13px;font-weight:700;color:var(--gold)">₹1,000</div>
        </div>
      </div>
      <div>
        <label class="mkt-form-label">Objective</label>
        <select id="boost-objective" class="mkt-form-select">
          <option value="POST_ENGAGEMENT">Post engagement (likes, comments, shares)</option>
          <option value="REACH">Maximum reach</option>
          <option value="LINK_CLICKS">Website clicks (vwholesale.in)</option>
          <option value="VIDEO_VIEWS">Video views (for reels)</option>
        </select>
      </div>

      <!-- Audience -->
      <div style="background:var(--bg3);border-radius:8px;padding:10px">
        <div style="font-size:11px;font-weight:700;margin-bottom:8px;color:var(--text3)">TARGET AUDIENCE</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Location</label>
            <input id="aud-location" class="mkt-form-input" value="Vijayawada, Andhra Pradesh" style="font-size:11px">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Radius (km)</label>
            <input id="aud-radius" class="mkt-form-input" type="number" value="100" style="font-size:11px">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Age min</label>
            <input id="aud-age-min" class="mkt-form-input" type="number" value="25" style="font-size:11px">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Age max</label>
            <input id="aud-age-max" class="mkt-form-input" type="number" value="55" style="font-size:11px">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Gender</label>
            <select id="aud-gender" class="mkt-form-select" style="font-size:11px">
              <option value="ALL">All</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
            </select>
          </div>
        </div>
        <div>
          <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Interests</label>
          <input id="aud-interests" class="mkt-form-input" value="Home improvement, Interior design, Real estate, Construction" style="font-size:11px">
        </div>
      </div>

      <div id="boost-preview-card" style="display:none;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:10px;font-size:11px"></div>

      <button onclick="boostPost()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-size:14px;font-weight:700" ${!isReady?'disabled':''}>
        ⚡ Boost Post
      </button>
      ${!isReady ? '<div style="font-size:11px;color:var(--text3);text-align:center">Connect Ad Account above first</div>' : ''}
    </div>
  </div>

  <!-- FULL CAMPAIGN -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:700">🎯 Full campaign</div>
        <div style="font-size:11px;color:var(--text3)">Custom creatives, objectives, A/B testing, conversion tracking</div>
      </div>
      <button onclick="adsToggleCampaign()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px" id="camp-toggle">▸ Expand</button>
    </div>
    <div id="full-campaign-form" style="display:none;margin-top:12px">
      <div style="display:grid;gap:8px">
        <div>
          <label class="mkt-form-label">Campaign name</label>
          <input id="camp-name" class="mkt-form-input" placeholder="V Wholesale July — Marble Collection">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="mkt-form-label">Objective</label>
            <select id="camp-objective" class="mkt-form-select">
              <option value="AWARENESS">Brand Awareness</option>
              <option value="TRAFFIC">Website Traffic</option>
              <option value="ENGAGEMENT" selected>Engagement</option>
              <option value="LEADS">Lead Generation</option>
              <option value="SALES">Sales</option>
            </select>
          </div>
          <div>
            <label class="mkt-form-label">Platforms</label>
            <select id="camp-platform" class="mkt-form-select">
              <option value="both">Facebook + Instagram</option>
              <option value="ig">Instagram only</option>
              <option value="fb">Facebook only</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div>
            <label class="mkt-form-label">Total budget (₹)</label>
            <input id="camp-budget" class="mkt-form-input" type="number" value="5000" min="500">
          </div>
          <div>
            <label class="mkt-form-label">Duration (days)</label>
            <input id="camp-days" class="mkt-form-input" type="number" value="14" min="3">
          </div>
          <div>
            <label class="mkt-form-label">CTA button</label>
            <select id="camp-cta" class="mkt-form-select">
              <option value="CALL_NOW">Call Now</option>
              <option value="LEARN_MORE">Learn More</option>
              <option value="SHOP_NOW">Shop Now</option>
              <option value="CONTACT_US">Contact Us</option>
              <option value="GET_DIRECTIONS">Get Directions</option>
            </select>
          </div>
        </div>
        <div>
          <label class="mkt-form-label">Ad creative — use existing post</label>
          <select id="camp-post" class="mkt-form-select">
            <option value="">— Select post as creative —</option>
            ${(contentPosts||[]).map(p=>`<option value="${p.id}">${p.topic||'Untitled'} · ${p.post_type||'image'}</option>`).join('')}
          </select>
        </div>
        <button onclick="createCampaign()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:12px;font-weight:700" ${!isReady?'disabled':''}>🚀 Create Campaign</button>
      </div>
    </div>
  </div>

  <!-- ACTIVE CAMPAIGNS -->
  <div class="mkt-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700">📊 Active campaigns</div>
      ${isReady?'<button onclick="loadAdCampaigns()" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:4px 10px">🔄 Refresh</button>':''}
    </div>
    <div id="ad-campaigns-list">
      <div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">${isReady?'Loading…':'Connect Ad Account above to see campaigns'}</div>
    </div>
  </div>`);

  if (isReady) loadAdCampaigns();
}

function adsUpdateTotal() {
  const b = parseInt(document.getElementById('boost-budget')?.value||'200');
  const d = parseInt(document.getElementById('boost-days')?.value||'5');
  const el = document.getElementById('boost-total-display');
  if (el) el.textContent = '₹'+((b*d)||0).toLocaleString('en-IN');
}

function adsBoostPreview() {
  const sel = document.getElementById('boost-post-select');
  const opt = sel?.options[sel.selectedIndex];
  const preview = document.getElementById('boost-preview-card');
  if (!preview || !opt?.value) { if(preview) preview.style.display='none'; return; }
  preview.style.display = 'block';
  const text = opt.dataset?.text||'';
  const img = opt.dataset?.img||'';
  preview.innerHTML = '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:6px">📄 POST PREVIEW</div>'
    + (img?`<img src="${img}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;float:right;margin-left:8px">`:'' )
    + `<div style="font-size:11px;line-height:1.6">${text}${text.length>=80?'…':''}</div>`;
}

function adsToggleCampaign() {
  const form = document.getElementById('full-campaign-form');
  const btn = document.getElementById('camp-toggle');
  if (!form) return;
  const open = form.style.display !== 'none';
  form.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = open ? '▸ Expand' : '▾ Collapse';
}

async function connectMetaWithToken(shortToken) {
  if (!shortToken) { showMktToast('No token provided'); return; }
  showMktToast('⏳ Connecting Meta account…');
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-setup', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({action:'refresh_token', token:shortToken, app_id:'1349983417313052', app_secret:'35ea04214f2c708bd8236310f545e1c8'})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Connection failed');
    showMktToast('✅ Meta connected! '+(data.page_name?'Page: '+data.page_name:'')+(data.ig_id?' · Instagram: '+data.ig_id:'')+(data.expires_days?' · Valid '+data.expires_days+' days':''));
    // Update social_connections badge in portal
    setTimeout(() => mktNav('integrations'), 1000);
  } catch(e) {
    showMktToast('❌ '+e.message);
  }
}

async function saveAdAccountSettings() {
  const rawId = (document.getElementById('ad-account-id')?.value||'').trim();
  const token = (document.getElementById('ads-token')?.value||'').trim();
  const pageId = (document.getElementById('ads-page-id')?.value||'').trim();
  const igId = (document.getElementById('ads-ig-id')?.value||'').trim();
  if (!rawId || !token) { showMktToast('Ad Account ID and Token required'); return; }
  const adId = rawId.startsWith('act_') ? rawId : 'act_'+rawId;

  showMktToast('⏳ Verifying…');
  try {
    const test = await fetch(`https://graph.facebook.com/v19.0/${adId}?fields=name,currency,account_status&access_token=${token}`);
    const d = await test.json();
    if (d.error) throw new Error(d.error.message);

    const rows = [{key:'META_AD_ACCOUNT_ID',value:adId},{key:'META_ACCESS_TOKEN',value:token}];
    if (pageId) rows.push({key:'META_PAGE_ID',value:pageId});
    if (igId) rows.push({key:'META_IG_ID',value:igId});
    await sb.from('marketing_settings').upsert(rows,{onConflict:'key'});

    showMktToast('✅ Ad Account connected: '+d.name+' ('+d.currency+')');
    setTimeout(_renderAdsAsync, 600);
  } catch(e) { showMktToast('❌ '+e.message); }
}

async function boostPost() {
  const postId = document.getElementById('boost-post-select')?.value;
  if (!postId) { showMktToast('Select a post to boost'); return; }
  const budget = parseInt(document.getElementById('boost-budget')?.value||'200');
  const days = parseInt(document.getElementById('boost-days')?.value||'5');
  const objective = document.getElementById('boost-objective')?.value||'POST_ENGAGEMENT';
  const ageMin = parseInt(document.getElementById('aud-age-min')?.value||'25');
  const ageMax = parseInt(document.getElementById('aud-age-max')?.value||'55');
  const gender = document.getElementById('aud-gender')?.value||'ALL';
  const interests = (document.getElementById('aud-interests')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);

  const btn = document.querySelector('[onclick="boostPost()"]');
  if (btn) { btn.textContent='⏳ Boosting…'; btn.disabled=true; }
  try {
    const { data: post } = await sb.from('content_posts').select('*').eq('id',postId).single().then(r=>r,()=>({data:null}));
    if (!post) throw new Error('Post not found');

    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'boost_post', post_text:post.master_text||post.topic||'', image_url:post.master_image_url||'',
        objective, daily_budget_inr:budget, duration_days:days,
        targeting:{age_min:ageMin,age_max:ageMax,gender,interests,location:'Vijayawada',radius_km:100}
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Boost failed');
    showMktToast('✅ Boosted! Campaign: '+data.campaign_id);
    await sb.from('marketing_audit_logs').insert({action:'ad_boost',details:{post_id:postId,budget:budget*days,campaign_id:data.campaign_id},created_at:new Date().toISOString()}).then(()=>{}).catch(()=>{});
    setTimeout(loadAdCampaigns, 800);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='⚡ Boost Post'; btn.disabled=false; } }
}

async function createCampaign() {
  const name = (document.getElementById('camp-name')?.value||'').trim();
  if (!name) { showMktToast('Enter campaign name'); return; }
  const objective = document.getElementById('camp-objective')?.value||'ENGAGEMENT';
  const budget = parseInt(document.getElementById('camp-budget')?.value||'5000');
  const days = parseInt(document.getElementById('camp-days')?.value||'14');
  const platform = document.getElementById('camp-platform')?.value||'both';
  const cta = document.getElementById('camp-cta')?.value||'CALL_NOW';
  const postId = document.getElementById('camp-post')?.value;

  const btn = document.querySelector('[onclick="createCampaign()"]');
  if (btn) { btn.textContent='⏳ Creating…'; btn.disabled=true; }
  try {
    let postData = null;
    if (postId) {
      const { data: p } = await sb.from('content_posts').select('*').eq('id',postId).single().then(r=>r,()=>({data:null}));
      postData = p;
    }
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({
        action:'create_campaign', campaign_name:name, objective, total_budget_inr:budget, duration_days:days, platform, cta,
        post_text:postData?.master_text||'', image_url:postData?.master_image_url||'',
        targeting:{age_min:25,age_max:55,gender:'ALL',interests:['Home improvement','Interior design','Real estate'],location:'Vijayawada',radius_km:100}
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Failed');
    showMktToast('✅ Campaign created! ID: '+data.campaign_id);
    setTimeout(loadAdCampaigns, 800);
  } catch(e) { showMktToast('❌ '+e.message); }
  finally { if (btn) { btn.textContent='🚀 Create Campaign'; btn.disabled=false; } }
}

async function loadAdCampaigns() {
  const el = document.getElementById('ad-campaigns-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:12px;font-size:12px;color:var(--text3)">⏳ Loading from Meta…</div>';
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({action:'get_campaigns'})});
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    const campaigns = data.campaigns||[];
    if (!campaigns.length) { el.innerHTML='<div style="text-align:center;padding:16px;font-size:12px;color:var(--text3)">No campaigns yet</div>'; return; }
    const SC = {ACTIVE:'#22c55e',PAUSED:'#f59e0b',DELETED:'#ef4444',ARCHIVED:'#94a3b8'};
    el.innerHTML = campaigns.map(c=>`
    <div style="padding:10px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:${c.insights?'8px':'0'}">
        <div style="flex:1"><div style="font-size:12px;font-weight:700">${c.name}</div><div style="font-size:10px;color:var(--text3)">${c.objective||''}</div></div>
        <span style="background:${SC[c.status]||'#94a3b8'}22;color:${SC[c.status]||'#94a3b8'};border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700">${c.status}</span>
        ${c.status==='ACTIVE'?`<button onclick="pauseCampaign('${c.id}')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">⏸</button>`:`<button onclick="resumeCampaign('${c.id}')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">▶</button>`}
      </div>
      ${c.insights?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">
        ${[{l:'Reach',v:c.insights.reach||'—'},{l:'Impressions',v:c.insights.impressions||'—'},{l:'Clicks',v:c.insights.clicks||'—'},{l:'Spend',v:c.insights.spend?'₹'+Math.round(c.insights.spend):'—'}]
        .map(m=>`<div style="text-align:center;background:var(--bg3);border-radius:5px;padding:5px"><div style="font-size:12px;font-weight:700">${m.v}</div><div style="font-size:9px;color:var(--text3)">${m.l}</div></div>`).join('')}
      </div>`:''}
    </div>`).join('');
  } catch(e) { el.innerHTML=`<div style="text-align:center;padding:12px;font-size:12px;color:var(--text3)">${e.message}</div>`; }
}

async function pauseCampaign(id) {
  const r = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({action:'update_campaign',campaign_id:id,status:'PAUSED'})});
  const d = await r.json(); showMktToast(d.ok?'⏸ Paused':'❌ '+d.error); if(d.ok) setTimeout(loadAdCampaigns,500);
}

async function resumeCampaign(id) {
  const r = await fetch(MKT_SB_URL+'/functions/v1/meta-ads',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({action:'update_campaign',campaign_id:id,status:'ACTIVE'})});
  const d = await r.json(); showMktToast(d.ok?'▶ Resumed':'❌ '+d.error); if(d.ok) setTimeout(loadAdCampaigns,500);
}


function renderLocalSEO() {
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">📍 Local SEO</h3>'
    +'<div style="font-size:12px;color:var(--text3)">Dominate Google Maps · Local Search · Near Me queries</div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">🎯 Target Keywords (Vijayawada)</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'
    +['tiles near me Vijayawada','granite price Vijayawada','bathroom fittings V Wholesale','flooring shop Andhra Pradesh',
      'sanitaryware showroom Vijayawada','paint shop Bhavanipuram','home building materials Vijayawada',
      'Kajaria tiles dealer near me','Italian marble Vijayawada','contractor materials supply Vijayawada'
     ].map(k=>'<span class="badge badge-blue">'+k+'</span>').join('')
    +'</div>'
    +'<button class="mkt-btn mkt-btn-ghost" onclick="generateLocalKeywords()" style="font-size:11px">🤖 Generate More Keywords</button>'
    +'<div id="local-kw-output" style="display:none;margin-top:10px;background:var(--bg3);border-radius:8px;padding:10px;font-size:12px"></div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">📋 Local SEO Checklist</div><div style="display:grid;gap:6px">'
    +[{t:'GBP — Business name, address, phone exactly matching everywhere',done:true},
      {t:'GBP — Add all product categories (Tiles, Granite, Sanitaryware, Paints, Electricals)',done:true},
      {t:'GBP — Post weekly (using GBP Post Generator in this portal)',done:false},
      {t:'GBP — Upload 20+ photos of showroom and products',done:false},
      {t:'GBP — Answer all Q&A questions',done:false},
      {t:'Justdial — Create/claim listing with correct NAP',done:false},
      {t:'IndiaMart — Supplier profile with product catalogue',done:false},
      {t:'Sulekha — Business listing',done:false},
      {t:'vwholesale.in — Add LocalBusiness schema markup',done:false},
      {t:'Get 5+ customer reviews on GBP this month',done:false}
     ].map(item=>'<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">'
      +'<div style="width:18px;height:18px;border-radius:4px;background:'+(item.done?'#22c55e':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">'+(item.done?'✓':'')+'</div>'
      +'<div style="font-size:12px;'+(item.done?'color:var(--text3);text-decoration:line-through':'')+'">'+ item.t+'</div></div>'
     ).join('')
    +'</div></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">📁 Directory Links</div>'
    +'<div style="display:grid;gap:8px">'
    +[{n:'Google Business Profile',url:'https://business.google.com'},
      {n:'Justdial',url:'https://www.justdial.com/vap/jd-biz/'},
      {n:'IndiaMart',url:'https://seller.indiamart.com'},
      {n:'Sulekha',url:'https://www.sulekha.com/business/add-business'},
      {n:'Yellow Pages India',url:'https://www.yellowpages.in/add-business'}
     ].map(d=>'<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:10px">'
      +'<div style="font-size:12px;font-weight:600">'+d.n+'</div>'
      +'<a href="'+d.url+'" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none">Open ↗</a></div>'
     ).join('')+'</div></div>');
}
async function generateLocalKeywords() {
  showMktToast('🤖 Finding local keywords…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'local_keywords',language:'en',topic:'local SEO keywords',context:{business:'V Wholesale',location:'Vijayawada, Andhra Pradesh, Visit V Wholesale',categories:'tiles, granite, sanitaryware, paints, electricals'}})});
  const data = await res.json();
  const out = document.getElementById('local-kw-output');
  if (out) { out.style.display='block'; out.textContent=data.content||data.text||''; }
}

function renderWebsiteSEO() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">🌐 Website SEO + Blog Engine</h3>
    <div style="font-size:12px;color:var(--text3)">vwholesale.in · AI-written SEO articles · Published automatically</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="showNewBlogModal()">✍️ Write Article</button>
  </div>

  <!-- SEO Status -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">
    ${[
      {icon:'✅',label:'HTTPS',val:'Live',color:'var(--green)'},
      {icon:'🗺️',label:'Sitemap',val:'Submitted',color:'var(--green)'},
      {icon:'🤖',label:'robots.txt',val:'Active',color:'var(--green)'},
      {icon:'🔍',label:'Search Console',val:'Verified',color:'var(--green)'},
      {icon:'📝',label:'/blog/',val:'Live',color:'var(--green)'}
    ].map(m=>'<div class="mkt-card" style="padding:10px;text-align:center"><div style="font-size:18px">'+m.icon+'</div>'
      +'<div style="font-size:13px;font-weight:700;color:'+m.color+'">'+m.val+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+m.label+'</div></div>').join('')}
  </div>

  <!-- Blog articles list -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="mkt-card-title" style="margin:0">📝 Blog Articles</div>
      <div style="display:flex;gap:6px">
        <a href="https://vwholesale.in/blog/" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none">View Blog ↗</a>
        <button class="mkt-btn mkt-btn-primary" onclick="showNewBlogModal()" style="font-size:11px">✍️ New Article</button>
      </div>
    </div>
    <div id="blog-list"><div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading…</div></div>
  </div>

  <!-- SEO Checklist -->
  <div class="mkt-card" style="margin-bottom:14px">
    <div class="mkt-card-title">📋 SEO Checklist</div>
    <div style="display:grid;gap:6px">
      ${[
        {t:'HTTPS secured — vwholesale.in',done:true},
        {t:'sitemap.xml submitted to Google Search Console',done:true},
        {t:'robots.txt configured',done:true},
        {t:'GBP website updated to vwholesale.in',done:true},
        {t:'Blog section /blog/ live and crawlable',done:true},
        {t:'Write 4+ blog articles (target: 1 per week)',done:false},
        {t:'Add LocalBusiness schema markup to homepage',done:false},
        {t:'Meta descriptions on all main pages',done:false},
        {t:'Page speed < 3s on mobile (check PageSpeed Insights)',done:false},
        {t:'10+ blog articles published for keyword coverage',done:false},
        {t:'Backlinks from local directories (Justdial, IndiaMart)',done:false}
      ].map(item=>'<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">'
        +'<div style="width:18px;height:18px;border-radius:4px;background:'+(item.done?'#22c55e':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">'+(item.done?'✓':'')+'</div>'
        +'<div style="font-size:12px;'+(item.done?'color:var(--text3);text-decoration:line-through':'')+'">'+item.t+'</div></div>').join('')}
    </div>
  </div>

  <!-- Tools -->
  <div class="mkt-card">
    <div class="mkt-card-title">🔗 SEO Tools</div>
    <div style="display:grid;gap:6px">
      ${[
        {n:'Google Search Console',url:'https://search.google.com/search-console/about?resource_id=https%3A%2F%2Fvwholesale.in%2F'},
        {n:'Google PageSpeed Insights',url:'https://pagespeed.web.dev/?url=https://vwholesale.in'},
        {n:'View vwholesale.in Blog',url:'https://vwholesale.in/blog/'},
        {n:'Rich Results Test',url:'https://search.google.com/test/rich-results?url=https://vwholesale.in'},
        {n:'Ahrefs Free Backlink Checker',url:'https://ahrefs.com/backlink-checker?input=vwholesale.in'}
      ].map(d=>'<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:10px">'
        +'<div style="font-size:12px;font-weight:600">'+d.n+'</div>'
        +'<a href="'+d.url+'" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:11px;text-decoration:none">Open ↗</a></div>').join('')}
    </div>
  </div>`);

  loadBlogList();
}

async function loadBlogList() {
  const el = document.getElementById('blog-list');
  if (!el) return;
  const { data: posts } = await sb.from('blog_posts').select('*').order('created_at',{ascending:false}).limit(20).then(r=>r,()=>({data:[]}));
  if (!(posts||[]).length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text3)">
      <div style="font-size:32px;margin-bottom:8px">📝</div>
      No articles yet — click ✍️ Write Article to generate your first SEO blog post with AI.
    </div>`;
    return;
  }
  el.innerHTML = '<div style="display:grid;gap:8px">' + posts.map(p=>`
  <div style="background:var(--bg3);border-radius:10px;padding:12px;cursor:pointer" onclick="viewBlogPost(${p.id})" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='var(--bg3)'">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div style="font-size:20px;margin-top:2px">${p.github_committed?'✅':'📝'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;margin-bottom:3px">${p.title}</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px">🔑 ${p.target_keyword||'—'} · ${p.word_count||0} words · SEO ${p.seo_score||'—'}/100</div>
        ${(p.tags||[]).length ? '<div style="display:flex;flex-wrap:wrap;gap:3px">' + (p.tags||[]).slice(0,5).map(t=>'<span class="badge badge-gray" style="font-size:9px">#'+t+'</span>').join('') + '</div>' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
        ${!p.github_committed?`<button class="mkt-btn mkt-btn-primary" onclick="publishBlog(${p.id})" style="font-size:10px;padding:3px 8px">🚀 Publish</button>`:`<a href="https://vwholesale.in/blog/${p.slug}/" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px;text-decoration:none">Live ↗</a>`}
        <button class="mkt-btn mkt-btn-ghost" onclick="deleteBlog(${p.id})" style="font-size:10px;padding:3px 8px;color:var(--red)">🗑</button>
      </div>
    </div>
  </div>`).join('') + '</div>';
}

function showNewBlogModal() {
  const topics = [
    'Best tiles for Indian bathrooms — buying guide',
    'How to choose granite countertops for kitchen in Andhra Pradesh',
    'Vitrified vs ceramic tiles — which is better for Indian homes',
    'Italian marble flooring — cost and maintenance guide Vijayawada',
    'Best paint brands in India for exterior walls — 2026 guide',
    'Bathroom fittings buying guide — what to look for',
    'False ceiling materials and costs — complete guide',
    'How to choose floor tiles for your living room in Vijayawada'
  ];
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:540px;overflow:hidden;margin-top:20px">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">✍️ Write SEO Blog Article</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;background:var(--bg3);border-radius:8px;padding:10px">
        🤖 AI will write a complete 800-1000 word SEO article targeting your keyword. Review it, then click Publish to add it live to vwholesale.in/blog/
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Article Title *</label>
        <input id="blog-title" class="mkt-form-input" placeholder="e.g. Best tiles for Indian bathrooms — buying guide">
        <div style="font-size:11px;color:var(--text3);margin-top:6px">Suggested topics:</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          ${topics.map(t=>`<button onclick="document.getElementById('blog-title').value='${t}';inferKeyword()" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:2px 6px">${t.slice(0,30)}…</button>`).join('')}
        </div>
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Target Keyword (what people Google to find this) *</label>
        <input id="blog-keyword" class="mkt-form-input" placeholder="e.g. bathroom tiles Vijayawada, granite price Andhra Pradesh">
      </div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Your Ideas / Key Points to Include (optional)</label>
        <textarea id="blog-ideas" class="mkt-form-input" rows="4" style="resize:vertical;font-size:12px;line-height:1.6" placeholder="e.g.&#10;- Mention that V Wholesale stocks 500+ tile designs&#10;- Include tips on choosing grout color&#10;- Talk about waterproofing importance&#10;- Mention our 10,000 sqft showroom at V Wholesale&#10;- Include price range ₹30-150 per sqft"></textarea>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">💡 Add your expertise, specific product details, prices, or anything the AI should include</div>
      </div>
      <button class="mkt-btn mkt-btn-primary" onclick="generateBlogArticle()" style="width:100%;padding:14px;font-size:14px;font-weight:900">🤖 Generate Article (~30 seconds)</button>
      <div id="blog-gen-status" style="display:none;text-align:center;padding:16px;color:var(--text3)"></div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
}

function inferKeyword() {
  const title = document.getElementById('blog-title')?.value||'';
  const kw = document.getElementById('blog-keyword');
  if (kw && !kw.value && title) {
    kw.value = title.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim().slice(0,60);
  }
}

async function generateBlogArticle() {
  const title = (document.getElementById('blog-title')?.value||'').trim();
  const keyword = (document.getElementById('blog-keyword')?.value||'').trim();
  const ideas = (document.getElementById('blog-ideas')?.value||'').trim();

  if (!title) { showMktToast('Enter an article title'); return; }
  if (!keyword) { showMktToast('Enter a target keyword'); return; }

  const btn = document.querySelector('[onclick="generateBlogArticle()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Writing article…'; }

  const status = document.getElementById('blog-gen-status');
  if (status) {
    status.style.display = 'block';
    status.innerHTML = '<div class="ai-thinking" style="justify-content:center"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div>'
      + '<div style="margin-top:10px;font-size:13px">AI is writing your article…</div>'
      + '<div style="font-size:11px;color:var(--text3);margin-top:4px">~30 seconds · 900-1100 words · hero image + keywords + hashtags</div>';
  }

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/write-blog-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ title, target_keyword: keyword, ideas: ideas || null })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server error ${res.status}: ${errText.slice(0,100)}`);
    }

    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || 'Generation failed');
    }

    if (!data.blog || !data.blog.id) {
      throw new Error('Article saved but ID missing — check blog_posts table');
    }

    // Close modal
    document.querySelector('[style*="position:fixed"][style*="z-index:9999"]')?.remove();
    showMktToast('✅ Article written! ' + (data.word_count||0) + ' words · SEO score ' + (data.seo_score||0) + '/100');

    await viewBlogPost(data.blog.id);
    await loadBlogList();

  } catch(e) {
    showMktToast('❌ ' + (e.message || 'Generation failed'));
    if (status) status.innerHTML = '<div style="color:var(--red);font-size:12px">❌ ' + (e.message||'Failed') + '</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Generate Article (~30 seconds)'; }
  }
}

async function viewBlogPost(id) {
  const {data:p} = await sb.from('blog_posts').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!p) return;

  // Extract meta, keywords, hashtags from content
  const metaMatch = (p.content_md||'').match(/<!--\s*meta:\s*(.+?)\s*-->/);
  const kwMatch = (p.content_md||'').match(/<!--\s*keywords:\s*(.+?)\s*-->/);
  const htMatch = (p.content_md||'').match(/<!--\s*hashtags:\s*(.+?)\s*-->/);
  const imgMatch = (p.content_md||'').match(/!\[([^\]]+)\]\(([^)]+)\)/);

  const metaDesc = metaMatch?.[1] || p.meta_description || '—';
  const keywords = kwMatch?.[1]?.split(',').map(k=>k.trim()) || (p.tags||[]);
  const hashtags = htMatch?.[1]?.split(' #').map(h=>h.replace(/^#/,'').trim()).filter(Boolean) || [];
  const heroImg = imgMatch?.[2] || '';

  // Clean content for display (remove comments)
  const cleanContent = (p.content_md||'').replace(/<!--.*?-->/gs,'').trim();

  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:720px;overflow:hidden;margin-top:20px">

    <!-- Header -->
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
      <div style="flex:1">
        <div style="font-size:15px;font-weight:900;color:var(--text);margin-bottom:4px">${p.title}</div>
        <div style="font-size:11px;color:#64748b">🔑 ${p.target_keyword} · ${p.word_count||0} words · SEO score: ${p.seo_score||'—'}/100 · ${p.status}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${!p.github_committed
          ? `<button class="mkt-btn mkt-btn-primary" onclick="publishBlog(${p.id});this.closest('[style*=fixed]').remove()" style="font-size:12px">🚀 Publish to Blog</button>`
          : `<a href="https://vwholesale.in/blog/${p.slug}/" target="_blank" class="mkt-btn mkt-btn-primary" style="font-size:12px;text-decoration:none">View Live ↗</a>`}
        <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
      </div>
    </div>

    <div style="padding:16px;display:grid;gap:12px">

      <!-- Hero Image -->
      ${heroImg ? `<div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">📸 HERO IMAGE (from Pexels)</div>
        <img src="${heroImg}" style="width:100%;border-radius:10px;max-height:220px;object-fit:cover" loading="lazy">
      </div>` : `<div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:12px;color:var(--text3);text-align:center">
        No hero image — add PEXELS_API_KEY to Supabase secrets for auto stock photos
      </div>`}

      <!-- Meta Description -->
      <div style="background:var(--bg3);border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">📄 META DESCRIPTION (${metaDesc.length} chars)</div>
        <div style="font-size:13px;line-height:1.6">${metaDesc}</div>
      </div>

      <!-- Keywords -->
      ${keywords.length ? `<div style="background:var(--bg3);border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">🔑 SEO KEYWORDS (${keywords.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${keywords.map(k=>`<span class="badge badge-blue">${k}</span>`).join('')}
        </div>
        <button onclick="navigator.clipboard.writeText('${keywords.join(', ')}').then(()=>showMktToast('Keywords copied!'))" class="mkt-btn mkt-btn-ghost" style="font-size:10px;margin-top:8px">📋 Copy Keywords</button>
      </div>` : ''}

      <!-- Hashtags -->
      ${hashtags.length ? `<div style="background:var(--bg3);border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">#️⃣ HASHTAGS FOR SOCIAL (${hashtags.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${hashtags.map(h=>`<span class="badge badge-gray">#${h}</span>`).join('')}
        </div>
        <button onclick="navigator.clipboard.writeText('${hashtags.map(h=>'#'+h).join(' ')}').then(()=>showMktToast('Hashtags copied!'))" class="mkt-btn mkt-btn-ghost" style="font-size:10px;margin-top:8px">📋 Copy Hashtags</button>
      </div>` : ''}

      <!-- Article content -->
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">📝 ARTICLE CONTENT</div>
        <div style="background:var(--bg3);border-radius:8px;padding:14px;font-size:12px;line-height:1.8;white-space:pre-wrap;max-height:350px;overflow-y:auto;color:var(--text1)">${cleanContent}</div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="mkt-btn mkt-btn-ghost" onclick="navigator.clipboard.writeText(\`${cleanContent.replace(/`/g,"'")}\`).then(()=>showMktToast('Article copied!'))" style="flex:1">📋 Copy Article</button>
        ${!p.github_committed
          ? `<button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="publishBlog(${p.id});this.closest('[style*=fixed]').remove()">🚀 Publish to vwholesale.in</button>`
          : `<a href="https://vwholesale.in/blog/${p.slug}/" target="_blank" class="mkt-btn mkt-btn-primary" style="flex:1;text-decoration:none;text-align:center">🌐 View Live Article ↗</a>`}
      </div>

    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
}

async function publishBlog(id) {
  showMktToast('🚀 Publishing to vwholesale.in/blog/…');
  const res = await fetch(`${MKT_SB_URL}/functions/v1/write-blog-post`, {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body:JSON.stringify({action:'commit', blog_id:id})
  });
  const data = await res.json();
  if (!data.ok) { showMktToast('❌ '+data.error); return; }
  showMktToast('✅ Published! Live at '+data.url);
  loadBlogList();
}

async function deleteBlog(id) {
  if (!confirm('Delete this article?')) return;
  await sb.from('blog_posts').delete().eq('id',id);
  showMktToast('Deleted');
  loadBlogList();
}

async function generateBlogOutline() {
  const topic = (document.getElementById('blog-topic')?.value||'').trim();
  const kw = (document.getElementById('blog-kw')?.value||'').trim();
  if (!topic) { showMktToast('Enter a blog topic'); return; }
  showMktToast('🤖 Generating blog outline…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'blog_outline',language:'en',topic,context:{business:'V Wholesale',location:'Vijayawada, Andhra Pradesh',target_keyword:kw,categories:'tiles, granite, sanitaryware, paints, electricals'}})});
  const data = await res.json();
  const out = document.getElementById('blog-output');
  if (out) { out.style.display='block'; out.textContent=data.content||data.text||''; }
}



function renderReviews() {
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">⭐ Reviews & Q&A</h3>'
    +'<div style="font-size:12px;color:var(--text3)">AI drafts replies · 4-5★ auto-approve · Manual review for 1-3★</div></div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">🤖 AI Review Reply Generator</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Paste a review → AI drafts the perfect reply → copy and post on GBP, Facebook, etc.</div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Platform</label>'
    +'<select id="rev-platform" class="mkt-form-select">'
    +'<option>Google Business Profile</option><option>Facebook</option><option>Instagram</option>'
    +'<option>Justdial</option><option>IndiaMart</option></select></div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Star Rating</label>'
    +'<select id="rev-stars" class="mkt-form-select"><option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>'
    +'<option value="4">⭐⭐⭐⭐ 4 Stars</option><option value="3">⭐⭐⭐ 3 Stars</option>'
    +'<option value="2">⭐⭐ 2 Stars</option><option value="1">⭐ 1 Star</option></select></div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Customer Review Text</label>'
    +'<textarea id="rev-text" class="mkt-form-input" rows="3" style="height:80px;resize:vertical" placeholder="Paste the customer review here…"></textarea></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="generateReviewReply()" style="width:100%;margin-bottom:10px">🤖 Generate Reply</button>'
    +'<div id="rev-output" style="display:none">'
    +'<div id="rev-flag" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-bottom:8px;font-size:12px;color:#ef4444"></div>'
    +'<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">'
    +'<div id="rev-reply" style="font-size:13px;line-height:1.8;white-space:pre-wrap"></div></div>'
    +'<div style="display:flex;gap:8px">'
    +'<button class="mkt-btn mkt-btn-primary" onclick="copyReviewReply()" style="flex:1">📋 Copy Reply</button>'
    +'<a href="https://business.google.com" target="_blank" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">Open GBP ↗</a>'
    +'</div></div></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">❓ FAQ Auto-Reply Generator</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Generate standard answers to common questions — use in WhatsApp auto-reply, website chatbot, Instagram DM.</div>'
    +'<div style="display:grid;gap:6px;margin-bottom:12px">'
    +['What are your store timings?','Where is your store located?','What brands of tiles do you stock?',
      'Do you offer home delivery?','What is the price of Italian marble?','Do you give discounts for bulk orders?',
      'Are you open on Sundays?','Do you have a showroom?'
     ].map(q=>'<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:8px;padding:10px">'
      +'<div style="font-size:12px">'+q+'</div>'
      +'<button class="mkt-btn mkt-btn-ghost" onclick="generateFAQAnswer(this)" data-q="'+q+'" style="font-size:10px;padding:3px 8px">Answer</button></div>'
     ).join('')
    +'</div>'
    +'<div id="faq-output" style="display:none;background:var(--bg3);border-radius:8px;padding:12px">'
    +'<div id="faq-q" style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px"></div>'
    +'<div id="faq-a" style="font-size:12px;line-height:1.7;white-space:pre-wrap"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="copyFAQ()" style="margin-top:8px;width:100%">📋 Copy Answer</button>'
    +'</div></div>');
}
async function generateReviewReply() {
  const stars = parseInt(document.getElementById('rev-stars')?.value||'5');
  const text = (document.getElementById('rev-text')?.value||'').trim();
  const platform = document.getElementById('rev-platform')?.value||'Google Business Profile';
  if (!text) { showMktToast('Paste the review text'); return; }
  showMktToast('🤖 Drafting reply…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'review_reply',language:'en',topic:'review reply',context:{stars,platform,review_text:text,business:'V Wholesale',location:'Vijayawada'}})});
  const data = await res.json();
  const reply = data.content||data.text||'';
  document.getElementById('rev-output').style.display='block';
  document.getElementById('rev-reply').textContent=reply;
  const flag = document.getElementById('rev-flag');
  if (stars <= 3) { flag.style.display='block'; flag.textContent='⚠️ '+stars+'-star review — please review the reply carefully before posting. Consider calling the customer directly first.'; }
  else { flag.style.display='none'; }
}
function copyReviewReply() { navigator.clipboard.writeText(document.getElementById('rev-reply')?.textContent||'').then(()=>showMktToast('📋 Copied!')); }
async function generateFAQAnswer(btn) {
  const q = btn.dataset.q;
  showMktToast('🤖 Generating answer…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'faq_answer',language:'te+en',topic:'FAQ answer',context:{question:q,business:'V Wholesale',location:'Visit V Wholesale',timings:'10am-8pm Mon-Sat, 11am-6pm Sun',phone:'8712697930',website:'vwholesale.in'}})});
  const data = await res.json();
  document.getElementById('faq-output').style.display='block';
  document.getElementById('faq-q').textContent='Q: '+q;
  document.getElementById('faq-a').textContent=data.content||data.text||'';
}
function copyFAQ() { const t=(document.getElementById('faq-q')?.textContent||'')+'\n'+(document.getElementById('faq-a')?.textContent||''); navigator.clipboard.writeText(t).then(()=>showMktToast('📋 Copied!')); }

async function renderCompetitors() {
  setContent(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">🔍 Competitor Intelligence</h3>
    <div style="font-size:12px;color:var(--text3)">Monitor competitors — keywords, content, hashtags, strategy gaps</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="showAddCompetitor()">+ Add Competitor</button>
  </div>
  <div id="comp-list"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div></div>`);
  await loadCompetitors();
}

async function loadCompetitors() {
  const { data: comps } = await sb.from('competitors').select('*, competitor_reports(id,report_date,ai_summary,seo_score,keywords,ai_suggestions,created_at)').order('created_at',{ascending:false}).then(r=>r,()=>({data:[]}));
  const el = document.getElementById('comp-list');
  if (!el) return;
  if (!(comps||[]).length) {
    el.innerHTML = `<div class="mkt-card" style="text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:12px">🔍</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:8px">No competitors added yet</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px">Add your first competitor — website, Instagram, YouTube — and AI will analyse their strategy daily</div>
      <button class="mkt-btn mkt-btn-primary" onclick="showAddCompetitor()">+ Add First Competitor</button>
    </div>`;
    return;
  }
  el.innerHTML = '<div style="display:grid;gap:14px">' + comps.map(c => {
    const rep = (c.competitor_reports||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
    const kws = (rep?.keywords||[]).slice(0,4);
    const sug = (rep?.ai_suggestions||[]).slice(0,2);
    return `<div class="mkt-card" style="padding:16px">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
        <div style="width:44px;height:44px;background:var(--bg3);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🏢</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:900">${c.name}</div>
          <div style="font-size:11px;color:var(--gold);margin-top:2px">${c.category||'direct'} competitor</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">
            ${[c.website_url,c.instagram_url,c.facebook_url,c.youtube_url].filter(Boolean).map(u=>'<a href="'+u+'" target="_blank" style="color:var(--text3);text-decoration:none;margin-right:8px">🔗 '+u.replace('https://','').split('/')[0]+'</a>').join('')}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="mkt-btn mkt-btn-primary" id="analyse-btn-${c.id}" onclick="analyseCompetitor(${c.id})" style="font-size:11px;padding:4px 10px">🤖 Analyse</button>
          <button class="mkt-btn mkt-btn-ghost" onclick="deleteCompetitor(${c.id})" style="font-size:11px;padding:4px 10px;color:var(--red)">🗑</button>
        </div>
      </div>
      ${rep ? `<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">LAST ANALYSIS · ${new Date(rep.created_at).toLocaleDateString('en-IN')}</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:8px">${rep.ai_summary||'—'}</div>
        ${rep.seo_score?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:11px;color:var(--text3)">SEO:</span>
          <div style="flex:1;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden"><div style="height:100%;width:${rep.seo_score}%;background:${rep.seo_score>70?'#22c55e':rep.seo_score>40?'#f59e0b':'#ef4444'};border-radius:3px"></div></div>
          <span style="font-size:11px;font-weight:700">${rep.seo_score}/100</span>
        </div>`:''}
        ${kws.length?`<div style="margin-bottom:6px"><div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">TOP KEYWORDS</div><div style="display:flex;flex-wrap:wrap;gap:4px">${kws.map(k=>'<span class="badge badge-blue">'+k+'</span>').join('')}</div></div>`:''}
        ${sug.length?`<div><div style="font-size:10px;font-weight:700;color:var(--green);margin-bottom:4px">💡 ACTIONS FOR V WHOLESALE</div>${sug.map(s=>'<div style="font-size:11px;color:var(--text2);padding:3px 0;border-top:1px solid var(--border)">→ '+s+'</div>').join('')}</div>`:''}
      </div>
      <button class="mkt-btn mkt-btn-ghost" onclick="viewFullReport(${c.id},'${c.name.replace(/'/g,"\'")}')" style="font-size:11px;width:100%">📊 View Full Report</button>`
      : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">No analysis yet — click 🤖 Analyse</div>'}
    </div>`;
  }).join('') + '</div>';
}

// Store competitor data for analysis
const _compCache = {};

async function loadCompetitorCache() {
  const {data} = await sb.from('competitors').select('*').then(r=>r,()=>({data:[]}));
  (data||[]).forEach(c => { _compCache[c.id] = c; });
}

function showAddCompetitor() {
  const m = document.createElement('div');
  m.id = 'add-comp-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">🔍 Add Competitor</div>
      <button onclick="document.getElementById('add-comp-modal').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:10px">
      <div class="mkt-form-group"><label class="mkt-form-label">Competitor Name *</label>
        <input type="text" id="comp-name" class="mkt-form-input" placeholder="e.g. Somany Tiles Vijayawada, Kajaria Showroom"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Website URL</label>
        <input type="url" id="comp-website" class="mkt-form-input" placeholder="https://www.example.com"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Instagram</label>
        <input type="url" id="comp-instagram" class="mkt-form-input" placeholder="https://instagram.com/username"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Facebook</label>
        <input type="url" id="comp-facebook" class="mkt-form-input" placeholder="https://facebook.com/pagename"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">YouTube</label>
        <input type="url" id="comp-youtube" class="mkt-form-input" placeholder="https://youtube.com/@channel"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Category</label>
        <select id="comp-category" class="mkt-form-select">
          <option value="direct">Direct (same city)</option>
          <option value="regional">Regional (Andhra/Telangana)</option>
          <option value="national">National Brand</option>
          <option value="online">Online Competitor</option>
        </select></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Notes (optional)</label>
        <input type="text" id="comp-notes" class="mkt-form-input" placeholder="e.g. Strong on Instagram, weak on GBP"></div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="saveCompetitor(true)">💾 Save & Analyse Now</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="saveCompetitor(false)">Save Only</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

async function saveCompetitor(analyseNow) {
  const name = (document.getElementById('comp-name')?.value||'').trim();
  if (!name) { showMktToast('Enter competitor name'); return; }
  const payload = {
    name,
    website_url: document.getElementById('comp-website')?.value?.trim()||null,
    instagram_url: document.getElementById('comp-instagram')?.value?.trim()||null,
    facebook_url: document.getElementById('comp-facebook')?.value?.trim()||null,
    youtube_url: document.getElementById('comp-youtube')?.value?.trim()||null,
    category: document.getElementById('comp-category')?.value||'direct',
    notes: document.getElementById('comp-notes')?.value?.trim()||null,
    added_by: mktProfile?.name
  };
  const {data:comp,error} = await sb.from('competitors').insert(payload).select().single().then(r=>r,e=>({data:null,error:e}));
  if (!comp) { showMktToast('❌ Failed: '+(error?.message||'unknown')); return; }
  _compCache[comp.id] = comp;
  document.getElementById('add-comp-modal')?.remove();
  showMktToast('✅ Competitor saved!');
  await loadCompetitors();
  if (analyseNow) setTimeout(()=>analyseCompetitor(comp.id), 400);
}

async function analyseCompetitor(id) {
  const c = _compCache[id] || (await sb.from('competitors').select('*').eq('id',id).single().then(r=>r.data,()=>null));
  if (!c) { showMktToast('Competitor not found'); return; }
  _compCache[id] = c;

  const btn = document.getElementById('analyse-btn-'+id);
  if (btn) { btn.textContent = '⏳ Analysing…'; btn.disabled = true; }
  showMktToast('🤖 Analysing '+c.name+'… ~15 seconds');

  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/analyse-competitor', {
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body:JSON.stringify({competitor_id:id,name:c.name,website_url:c.website_url,instagram_url:c.instagram_url,facebook_url:c.facebook_url,youtube_url:c.youtube_url})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error||'Analysis failed');
    showMktToast('✅ Analysis complete for '+c.name);
  } catch(e) {
    showMktToast('❌ '+e.message);
  }
  await loadCompetitors();
}

async function deleteCompetitor(id) {
  if (!confirm('Delete this competitor and all their reports?')) return;
  await sb.from('competitors').delete().eq('id',id);
  showMktToast('Deleted');
  await loadCompetitors();
}

async function viewFullReport(compId, compName) {
  const {data:reports} = await sb.from('competitor_reports').select('*').eq('competitor_id',compId).order('created_at',{ascending:false}).limit(5).then(r=>r,()=>({data:[]}));
  const r = (reports||[])[0];
  if (!r) { showMktToast('No report yet — click Analyse first'); return; }

  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:620px;overflow:hidden;margin-top:20px">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:15px;font-weight:900;color:var(--text)">📊 ${compName}</div>
      <div style="font-size:11px;color:#64748B">${new Date(r.created_at).toLocaleDateString('en-IN')} · ${reports.length} report(s) total</div></div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">

      <div style="background:var(--bg3);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">AI SUMMARY</div>
        <div style="font-size:13px;line-height:1.7">${r.ai_summary||'—'}</div>
        ${r.seo_score?`<div style="display:flex;align-items:center;gap:8px;margin-top:10px">
          <span style="font-size:11px;color:var(--text3)">SEO Score:</span>
          <div style="flex:1;height:8px;background:var(--bg2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${r.seo_score}%;background:${r.seo_score>70?'#22c55e':r.seo_score>40?'#f59e0b':'#ef4444'};border-radius:4px"></div></div>
          <span style="font-size:13px;font-weight:900">${r.seo_score}/100</span>
        </div>`:''}
        ${r.estimated_traffic?`<div style="font-size:12px;color:var(--text3);margin-top:6px">📈 Traffic: <strong style="color:var(--text1)">${r.estimated_traffic}</strong></div>`:''}
      </div>

      ${(r.keywords||[]).length?`<div style="background:var(--bg3);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:8px">🔑 THEIR KEYWORDS</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${r.keywords.map(k=>'<span class="badge badge-blue">'+k+'</span>').join('')}</div>
      </div>`:''}

      ${(r.raw_data?.keywords_to_target||[]).length?`<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#22c55e;margin-bottom:8px">🎯 V WHOLESALE SHOULD TARGET</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${r.raw_data.keywords_to_target.map(k=>'<span class="badge badge-green">'+k+'</span>').join('')}</div>
      </div>`:''}

      ${(r.hashtags||[]).length?`<div style="background:var(--bg3);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:8px">#️⃣ HASHTAGS</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${r.hashtags.map(h=>'<span class="badge badge-gray">#'+h.replace('#','')+'</span>').join('')}</div>
      </div>`:''}

      ${(r.top_content||[]).length?`<div style="background:var(--bg3);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:8px">📱 CONTENT THAT WORKS FOR THEM</div>
        ${r.top_content.map(c=>`<div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:6px">
          <div style="font-size:11px;font-weight:700;color:var(--gold)">${c.type||'Post'}</div>
          <div style="font-size:12px;margin:4px 0">${c.topic||'—'}</div>
          <div style="font-size:11px;color:var(--text3)">${c.why_it_works||''}</div>
        </div>`).join('')}
      </div>`:''}

      ${(r.raw_data?.content_gaps||[]).length?`<div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:8px">💡 CONTENT V WHOLESALE SHOULD CREATE</div>
        ${r.raw_data.content_gaps.map(g=>'<div style="font-size:12px;padding:5px 0;border-top:1px solid rgba(201,168,76,0.15)">→ '+g+'</div>').join('')}
      </div>`:''}

      ${(r.ai_suggestions||[]).length?`<div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:#8b5cf6;margin-bottom:8px">🚀 ACTION PLAN FOR V WHOLESALE</div>
        ${r.ai_suggestions.map((s,i)=>`<div style="display:flex;gap:8px;font-size:12px;padding:5px 0;border-top:1px solid rgba(139,92,246,0.15)"><span style="color:#8b5cf6;font-weight:700">${i+1}.</span><span>${s}</span></div>`).join('')}
      </div>`:''}

      <button class="mkt-btn mkt-btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
}

async function renderSegments() {
  setContent('<div style="margin-bottom:16px"><h3 style="font-size:16px;font-weight:900">👥 Customer Segments</h3>'
    +'<div style="font-size:12px;color:var(--text3)">Smart segments from your 1,300+ customer base</div></div>'
    +'<div id="seg-stats"><div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading…</div></div>');
  await loadSegments();
}
async function loadSegments() {
  const el = document.getElementById('seg-stats');
  if (!el) return;
  const [{data:customers},{data:contractors}] = await Promise.all([
    sb.from('profiles').select('role,created_at',{count:'exact'}).in('role',['customer']).then(r=>r,()=>({data:[],count:0})),
    sb.from('profiles').select('role',{count:'exact'}).eq('role','contractor').then(r=>r,()=>({data:[],count:0}))
  ]);
  const total = (customers||[]).length + (contractors||[]).length;

  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">'
    +[{l:'Total Customers',v:total||'1,300+',i:'👥'},{l:'Contractors',v:(contractors||[]).length||'—',i:'🏗️'},
      {l:'With Birthday Data',v:'—',i:'🎂'},{l:'Active (last 90 days)',v:'—',i:'📅'}
     ].map(m=>'<div class="mkt-card" style="padding:12px;text-align:center"><div style="font-size:20px">'+m.i+'</div>'
      +'<div style="font-size:18px;font-weight:900;margin:4px 0">'+m.v+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+m.l+'</div></div>').join('')
    +'</div>'
    +'<div class="mkt-card" style="margin-bottom:16px"><div class="mkt-card-title">📋 Segment Definitions</div><div style="display:grid;gap:8px">'
    +[{icon:'💎',name:'High Value',desc:'Spent ₹10L+ lifetime · Priority for new arrivals + exclusive previews',color:'#c9a84c'},
      {icon:'🏗️',name:'Active Contractors',desc:'Contractor Club members · Targeted for bulk offers + referral rewards',color:'#8b5cf6'},
      {icon:'🏠',name:'Homeowners',desc:'Single large project · Target for tile/granite/bathroom complete packages',color:'#22c55e'},
      {icon:'😴',name:'Dormant (90+ days)',desc:'Haven\'t visited in 3+ months · Re-engage with special return offer',color:'#f59e0b'},
      {icon:'🆕',name:'New Customers',desc:'First purchase in last 30 days · Nurture with follow-up and next-buy offer',color:'#64748b'},
      {icon:'🎂',name:'Birthday This Month',desc:'Auto-generate personalised greeting + exclusive birthday offer',color:'#ef4444'}
     ].map(seg=>'<div style="display:flex;align-items:center;gap:12px;background:var(--bg3);border-radius:8px;padding:12px">'
      +'<div style="font-size:22px">'+seg.icon+'</div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:700;color:'+seg.color+'">'+seg.name+'</div>'
      +'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+seg.desc+'</div></div>'
      +'<button class="mkt-btn mkt-btn-ghost" data-seg="'+seg.name+'" onclick="pickSegment(this.dataset.seg)" style="font-size:10px;padding:3px 8px">Message</button></div>'
     ).join('')
    +'</div></div>'
    +'<div class="mkt-card"><div class="mkt-card-title">🤖 Segment Message Generator</div>'
    +'<div style="font-size:12px;color:var(--text3);margin-bottom:10px">Click "Message" on any segment above, or type a custom segment below.</div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Segment</label><input id="seg-name" class="mkt-form-input" placeholder="e.g. Dormant customers, High Value contractors"></div>'
    +'<div class="mkt-form-group"><label class="mkt-form-label">Offer / Hook</label><input id="seg-offer" class="mkt-form-input" placeholder="e.g. 15% off this weekend only, Free delivery above ₹50K"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="generateSegMsg()" style="width:100%;margin-bottom:10px">🤖 Generate Campaign Message</button>'
    +'<div id="seg-output" style="display:none;background:var(--bg3);border-radius:8px;padding:12px">'
    +'<div id="seg-msg" style="font-size:13px;line-height:1.8;white-space:pre-wrap"></div>'
    +'<button class="mkt-btn mkt-btn-primary" onclick="copySegMsg()" style="margin-top:8px;width:100%">📋 Copy</button></div></div>';
}

function pickSegment(name) {
  const el = document.getElementById('seg-name');
  if (el) { el.value = name; el.scrollIntoView({behavior:'smooth'}); }
}

async function generateSegMsg() {
  const seg = (document.getElementById('seg-name')?.value||'').trim();
  const offer = (document.getElementById('seg-offer')?.value||'').trim();
  if (!seg) { showMktToast('Enter a segment name'); return; }
  showMktToast('🤖 Generating message…');
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'segment_message',language:'te+en',topic:seg,context:{business:'V Wholesale',location:'Vijayawada',segment:seg,offer}})});
  const data = await res.json();
  document.getElementById('seg-output').style.display='block';
  document.getElementById('seg-msg').textContent=data.content||data.text||'';
}
function copySegMsg() { navigator.clipboard.writeText(document.getElementById('seg-msg')?.textContent||'').then(()=>showMktToast('📋 Copied!')); }


// ── AUTO LOGIN ON LOAD ──
window.addEventListener('load', async () => {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const uid = session.user?.id;
    if (!uid) return;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).single().then(r=>r, ()=>({data:null}));
    const OK = ['admin','owner','manager','marketing','store_manager','floor_manager','sales_head'];
    if (profile && OK.includes(profile.role)) {
      mktProfile = profile;
      showMktApp();
    }
  } catch(e) {
    console.log('Auto-login check:', e.message);
  }
});
// ── GREETINGS ENGINE ──
async function renderGreetings() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">🎂 Greetings Engine</h3>
    <div style="font-size:12px;color:var(--text3)">Birthday & Anniversary — Customers · Contractors · Staff</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="renderGreetings()">🔄 Refresh</button>
  </div>

  <div id="greetings-content"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Checking today's greetings…</div></div>`);
  await loadGreetings();
}

async function loadGreetings() {
  const el = document.getElementById('greetings-content');
  if (!el) return;

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/check-greetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    const today = data.today || [];
    const upcoming = data.upcoming || [];

    el.innerHTML = `
    <!-- Today's greetings -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div class="mkt-card-title">🎉 Today — ${data.date}</div>
      ${today.length === 0
        ? '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">🎉 No birthdays or anniversaries today</div>'
        : '<div style="display:grid;gap:10px">' + today.map(g => `
        <div style="background:var(--bg3);border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px">
          <div style="font-size:32px">${g.greeting_type === 'birthday' ? '🎂' : '💑'}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:900">${g.person_name || '—'}</div>
            <div style="font-size:12px;color:var(--text3)">${g.greeting_type === 'birthday' ? 'Birthday' : 'Anniversary'} · ${g.person_type} ${g.phone ? '· ' + g.phone : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            <button class="mkt-btn mkt-btn-primary" onclick="generateGreetingPoster('${(g.person_name||'').replace(/'/g,"\\'")}','${g.greeting_type}','${g.person_type}')" style="font-size:11px;padding:4px 10px">🎨 Generate Poster</button>
            <button class="mkt-btn mkt-btn-ghost" onclick="generateGreetingMessage('${(g.person_name||'').replace(/'/g,"\\'")}','${g.greeting_type}','${g.phone||''}')" style="font-size:11px;padding:4px 10px">💬 WhatsApp</button>
          </div>
        </div>`).join('') + '</div>'
      }
    </div>

    <!-- Upcoming 7 days -->
    ${upcoming.length ? `<div class="mkt-card" style="margin-bottom:14px">
      <div class="mkt-card-title">📅 Upcoming 7 Days</div>
      <div style="display:grid;gap:6px">
        ${upcoming.map(u => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">
          <div style="font-size:18px">${u.type === 'birthday' ? '🎂' : '💑'}</div>
          <div style="flex:1"><div style="font-size:12px;font-weight:700">${u.name}</div>
          <div style="font-size:11px;color:var(--text3)">${u.type} · ${u.date}</div></div>
          <span class="badge badge-blue">in ${u.days} day${u.days > 1 ? 's' : ''}</span>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Add DOB/Anniversary to customer -->
    <div class="mkt-card" style="margin-bottom:14px">
      <div class="mkt-card-title">➕ Add Birthday / Anniversary to Customer or Contractor</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Search by phone number and update their profile with DOB or Anniversary date.</div>
      <div class="mkt-form-group">
        <label class="mkt-form-label">Phone Number</label>
        <div style="display:flex;gap:8px">
          <input id="greet-phone" class="mkt-form-input" placeholder="e.g. 9876543210" style="flex:1">
          <button class="mkt-btn mkt-btn-primary" onclick="searchPersonForGreeting()">Search</button>
        </div>
      </div>
      <div id="greet-person-result" style="display:none"></div>
    </div>

    <!-- Recent greeting log -->
    <div class="mkt-card">
      <div class="mkt-card-title">📋 Recent Greetings Sent</div>
      <div id="greet-log"><div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">Loading…</div></div>
    </div>

    <!-- Poster + message output -->
    <div id="greet-output" style="display:none"></div>`;

    loadGreetingLog();

  } catch(e) {
    el.innerHTML = `<div class="mkt-card" style="text-align:center;padding:30px;color:var(--red)">❌ ${e.message}</div>`;
  }
}

async function loadGreetingLog() {
  const el = document.getElementById('greet-log');
  if (!el) return;
  const { data } = await sb.from('greeting_log').select('*').order('created_at', {ascending:false}).limit(10).then(r=>r,()=>({data:[]}));
  if (!(data||[]).length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px">No greetings sent yet</div>'; return; }
  el.innerHTML = '<div style="display:grid;gap:6px">' + (data||[]).map(g => `
  <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:8px">
    <div style="font-size:18px">${g.greeting_type === 'birthday' ? '🎂' : '💑'}</div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700">${g.person_name || '—'}</div>
      <div style="font-size:11px;color:var(--text3)">${g.greeting_type} · ${g.person_type} · ${new Date(g.created_at).toLocaleDateString('en-IN')}</div>
    </div>
    <span class="badge ${g.whatsapp_sent ? 'badge-green' : 'badge-gray'}">${g.whatsapp_sent ? '✅ Sent' : 'Pending'}</span>
  </div>`).join('') + '</div>';
}

async function searchPersonForGreeting() {
  const phone = (document.getElementById('greet-phone')?.value||'').trim();
  if (!phone) { showMktToast('Enter phone number'); return; }

  const el = document.getElementById('greet-person-result');
  el.style.display = 'block';
  el.innerHTML = '<div style="font-size:12px;color:var(--text3)">⏳ Searching…</div>';

  // Search in profiles and contractor_profiles
  const [{ data: profData }, { data: contData }] = await Promise.all([
    sb.from('profiles').select('id, name, phone, role, dob, anniversary').eq('phone', phone).limit(1).then(r=>r,()=>({data:[]})),
    sb.from('contractor_profiles').select('id, name, phone, dob, anniversary').eq('phone', phone).limit(1).then(r=>r,()=>({data:[]}))
  ]);

  const person = (profData||[])[0] || (contData||[])[0];
  const table = (profData||[])[0] ? 'profiles' : 'contractor_profiles';

  if (!person) {
    el.innerHTML = '<div style="font-size:12px;color:var(--red);padding:8px 0">No customer or contractor found with this phone number</div>';
    return;
  }

  el.innerHTML = `
  <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:12px;margin-bottom:10px">
    <div style="font-size:13px;font-weight:700">${person.name}</div>
    <div style="font-size:11px;color:var(--text3)">${person.phone} · ${person.role||'contractor'}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="mkt-form-group">
      <label class="mkt-form-label">Date of Birth</label>
      <input type="date" id="greet-dob" class="mkt-form-input" value="${person.dob||''}">
    </div>
    <div class="mkt-form-group">
      <label class="mkt-form-label">Wedding Anniversary</label>
      <input type="date" id="greet-ann" class="mkt-form-input" value="${person.anniversary||''}">
    </div>
  </div>
  <button class="mkt-btn mkt-btn-primary" onclick="savePersonDates('${person.id}','${table}')" style="width:100%">💾 Save Dates</button>`;
}

async function savePersonDates(id, table) {
  const dob = document.getElementById('greet-dob')?.value || null;
  const ann = document.getElementById('greet-ann')?.value || null;
  const { error } = await sb.from(table).update({ dob, anniversary: ann, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showMktToast('❌ ' + error.message); return; }
  showMktToast('✅ Dates saved! Will appear in tomorrow\'s greeting check.');
  document.getElementById('greet-person-result').style.display = 'none';
  document.getElementById('greet-phone').value = '';
}

async function generateGreetingPoster(name, type, personType) {
  showMktToast(`🎨 Generating ${type} poster for ${name}…`);

  const topic = type === 'birthday'
    ? `Happy Birthday ${name} — warm birthday wishes from V Wholesale team`
    : `Happy Anniversary ${name} — celebrating with you from V Wholesale`;

  // Reuse poster studio generate flow
  const res = await fetch(`${MKT_SB_URL}/functions/v1/generate-poster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
    body: JSON.stringify({
      topic, template: type === 'birthday' ? 'festival' : 'store',
      language: 'te+en',
      business_name: 'V Wholesale',
      phone: '8712697930', website: 'vwholesale.in',
      address: 'Visit V Wholesale',
      tagline: type === 'birthday' ? 'Wishing you joy and prosperity!' : 'Celebrating your special day!'
    })
  });
  const data = await res.json();
  if (!data.ok) { showMktToast('❌ ' + (data.error||'Failed')); return; }

  // Show output
  let outEl = document.getElementById('greet-output');
  if (!outEl) { outEl = document.createElement('div'); outEl.id = 'greet-output'; document.getElementById('greetings-content').appendChild(outEl); }
  outEl.style.display = 'block';
  outEl.innerHTML = `
  <div class="mkt-card" style="margin-top:14px">
    <div class="mkt-card-title">🎨 Generated Poster — ${name}</div>
    <img src="data:image/png;base64,${data.image_b64}" style="width:100%;border-radius:10px;margin-bottom:10px">
    <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:10px;font-size:13px;line-height:1.7">${data.caption||''}</div>
    <div style="display:flex;gap:8px">
      <button class="mkt-btn mkt-btn-primary" onclick="downloadGreetingPoster('${data.image_b64.slice(0,20)}...')">⬇ Download</button>
      <button class="mkt-btn mkt-btn-ghost" onclick="copyPosterCaption('Copied!'))">📋 Copy Caption</button>)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;margin-top:8px">📋 Copy Caption</button>
    </div>
  </div>`;

  // Save to greeting_log
  await sb.from('greeting_log').insert({
    person_type: personType, person_name: name,
    greeting_type: type, greeting_date: new Date().toISOString().split('T')[0],
    caption: data.caption, created_by: mktProfile?.name
  });
  loadGreetingLog();
}

function downloadGreetingPoster(b64Prefix) {
  // Find the full b64 from the img tag
  const img = document.querySelector('#greet-output img');
  if (!img) return;
  const full = img.src.replace('data:image/png;base64,', '');
  const a = document.createElement('a');
  a.download = 'vwholesale-greeting-' + Date.now() + '.png';
  a.href = 'data:image/png;base64,' + full;
  a.click();
}

async function generateGreetingMessage(name, type, phone) {
  showMktToast('🤖 Writing WhatsApp message…');
  const res = await fetch(`${MKT_SB_URL}/functions/v1/marketing-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
    body: JSON.stringify({
      task: 'whatsapp_message', platform: 'WhatsApp', language: 'te+en',
      topic: type === 'birthday' ? `Birthday greeting for ${name}` : `Anniversary greeting for ${name}`,
      context: { business: 'V Wholesale', location: 'Vijayawada', person_name: name, type }
    })
  });
  const data = await res.json();
  const msg = data.content || data.text || '';
  if (!msg) { showMktToast('❌ Failed to generate'); return; }

  // Show copy + WhatsApp link
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">💬 WhatsApp Greeting — ${name}</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px">
      <div style="background:var(--bg3);border-radius:8px;padding:12px;font-size:13px;line-height:1.8;white-space:pre-wrap;margin-bottom:12px">${msg}</div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="copyGreetMsg(this)" data-msg="${msg.replace(/"/g,'&quot;')}">📋 Copy Message</button>
        ${phone ? `<a href="https://wa.me/91${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}" target="_blank" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">Open WhatsApp ↗</a>` : ''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

function copyGreetMsg(btn) { navigator.clipboard.writeText(btn.dataset.msg||"").then(()=>showMktToast("📋 Copied!")); }


// ── STAFF FEED MANAGEMENT (Marketing side) ──
async function pushToStaffFeed(titleOverride) {
  if (!currentPosterB64) { showMktToast('Generate a poster first'); return; }
  const title = titleOverride || (document.getElementById('ps-topic')?.value||'').trim() || 'Today\'s Post';

  let image_url = null;
  try {
    const byteArr = Uint8Array.from(atob(currentPosterB64), c => c.charCodeAt(0));
    const blob = new Blob([byteArr], { type: 'image/png' });
    const filename = `feed/${Date.now()}-feed.png`;
    const { error: upErr } = await sb.storage.from('brand-assets').upload(filename, blob, { contentType: 'image/png', upsert: false });
    if (!upErr) {
      const { data: urlData } = sb.storage.from('brand-assets').getPublicUrl(filename);
      image_url = urlData?.publicUrl || null;
    }
  } catch(e) { console.warn('Upload:', e.message); }

  const { error } = await sb.from('daily_posts_feed').insert({
    post_date: new Date().toISOString().split('T')[0],
    title, caption: currentCaption,
    image_url, post_type: 'post',
    platforms: ['Instagram','Facebook','WhatsApp'],
    status: 'active', created_by: mktProfile?.name
  });

  if (error) { showMktToast('❌ ' + error.message); return; }
  showMktToast('✅ Pushed to Staff Feed!');
}

async function renderEmail() {
  setContent('<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading email marketing…</div>');

  const [
    {data: logs},
    {data: customers}
  ] = await Promise.all([
    sb.from('email_log').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r,()=>({data:[]})),
    sb.from('customers').select('id,name,email,type').not('email','is',null).limit(500).then(r=>r,()=>({data:[]}))
  ]);

  const totalSent = (logs||[]).reduce((a,l)=>a+(l.sent_count||1),0);
  const withEmail = (customers||[]).length;

  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">'
    + '<div><h3 style="font-size:16px;font-weight:900">✉️ Email Marketing</h3>'
    + '<div style="font-size:12px;color:var(--text3)">Powered by Resend · ' + withEmail + ' customers with email · Free up to 3,000/month</div></div>'
    + '<button onclick="verifyEmailConnection(this)" class="mkt-btn mkt-btn-ghost" style="font-size:11px;padding:6px 12px">🔗 Verify</button></div>';

  // Stats
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:var(--gold)">' + totalSent + '</div><div style="font-size:11px;color:var(--text3)">Total Sent</div></div>'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:#22c55e">' + withEmail + '</div><div style="font-size:11px;color:var(--text3)">Contacts with Email</div></div>'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:#3b82f6">' + (logs||[]).length + '</div><div style="font-size:11px;color:var(--text3)">Campaigns Sent</div></div>'
    + '</div>';

  // Compose email
  html += '<div class="mkt-card" style="margin-bottom:14px">'
    + '<div style="font-size:12px;font-weight:700;margin-bottom:10px">📧 Compose & Send</div>'
    + '<div style="display:grid;gap:8px">'
    + '<div><label class="mkt-form-label">Subject line</label><input id="email-subject" class="mkt-form-input" placeholder="e.g. Diwali Special — 15% off all tiles at V Wholesale"></div>'
    + '<div><label class="mkt-form-label">Message body</label><textarea id="email-body" class="mkt-form-input" rows="4" placeholder="Write your email message here…"></textarea></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    + '<div><label class="mkt-form-label">Target</label>'
    + '<select id="email-segment" class="mkt-form-select">'
    + '<option value="all">All with email (' + withEmail + ')</option>'
    + '<option value="contractor">Contractors only</option>'
    + '<option value="single">Single email</option>'
    + '</select></div>'
    + '<div><label class="mkt-form-label">Single email (if above = single)</label><input id="email-single" class="mkt-form-input" placeholder="customer@email.com"></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button onclick="generateEmailContent()" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:8px 12px">✨ AI Write</button>'
    + '<button onclick="sendEmailCampaign(this)" class="mkt-btn mkt-btn-primary" style="flex:1;padding:8px;font-weight:700">📧 Send Email</button>'
    + '</div></div></div>';

  // Quick templates
  html += '<div class="mkt-card" style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;margin-bottom:10px">⚡ Quick Email Templates</div>'
    + '<div style="display:grid;gap:6px">';
  const emailTemplates = [
    {icon:'🎉', label:'Festival Offer', subject:'Special Festival Offer from V Wholesale', body:'Dear Customer, Wishing you a joyous celebration! This festive season V Wholesale brings special offers on tiles, granite, marble and more. Visit Visit V Wholesaleor call 8712697930. Team V Wholesale'},
    {icon:'⭐', label:'Review Request', subject:'How was your V Wholesale experience?', body:'Dear Customer, Thank you for your recent purchase from V Wholesale. Would you spare 2 minutes to share your experience on Google? Your feedback helps us serve you better. Call 8712697930. Team V Wholesale'},
    {icon:'🆕', label:'New Arrivals', subject:'New Stock Alert from V Wholesale', body:'Dear Customer, Exciting news! New stock just arrived at V Wholesale — Italian Marble, vitrified tiles, premium sanitaryware. Visit Visit V Wholesale. Call 8712697930. Team V Wholesale'},
  ];
  // Store templates globally so buttons can access them after HTML render
  window._emailTemplates = emailTemplates;
  html += emailTemplates.map(function(t, i) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">'
      + '<span style="font-size:18px">' + t.icon + '</span>'
      + '<div style="flex:1"><div style="font-size:11px;font-weight:600">' + t.label + '</div>'
      + '<div style="font-size:10px;color:var(--text3)">' + t.subject + '</div></div>'
      + '<button onclick="useEmailTemplate(' + i + ')" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">Use</button></div>';
  }).join('');
  html += '</div></div>';

  // Recent sends
  if ((logs||[]).length) {
    html += '<div class="mkt-card"><div style="font-size:12px;font-weight:700;margin-bottom:10px">📋 Recent Emails</div><div style="display:grid;gap:6px">';
    (logs||[]).forEach(log => {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--bg3);border-radius:6px">'
        + '<div><div style="font-size:12px;font-weight:600">' + (log.subject||'') + '</div>'
        + '<div style="font-size:10px;color:var(--text3)">' + new Date(log.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) + ' · ' + (log.recipient||'') + '</div></div>'
        + '<div style="font-size:11px;color:' + (log.status==='sent'?'#22c55e':'#ef4444') + '">' + (log.sent_count||1) + ' sent</div></div>';
    });
    html += '</div></div>';
  }

  setContent(html);
}

function useEmailTemplate(index) {
  const t = window._emailTemplates && window._emailTemplates[index];
  if (!t) return;
  fillEmailTemplate(t.subject, t.body);
}

function fillEmailTemplate(subject, body) {
  const s = document.getElementById('email-subject');
  const b = document.getElementById('email-body');
  if (s) s.value = subject;
  if (b) b.value = body;
}

async function generateEmailContent() {
  const subject = (document.getElementById('email-subject')?.value||'').trim() || prompt('Email topic?');
  if (!subject) return;
  showMktToast('✨ AI writing email…');
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'generate_text', agent:'Email Marketing',
        prompt: 'Write a professional marketing email for V Wholesale Vijayawada. Topic: ' + subject + '. Brand: V Wholesale — premium home building materials, Visit V Wholesale, 8712697930, vwholesale.in. Warm, professional tone. Include CTA. Under 200 words. Return just the email body text.',
        context: {} })
    });
    const data = await res.json();
    const content = data.output?.message || data.output?.master_text || typeof data.output === 'string' ? data.output : '';
    if (content) {
      const b = document.getElementById('email-body');
      if (b) b.value = content;
      showMktToast('✅ Email content ready');
    }
  } catch(e) { showMktToast('❌ ' + e.message); }
}

async function verifyEmailConnection(btn) {
  if (btn) { btn.textContent='⏳…'; btn.disabled=true; }
  try {
    const res = await fetch(MKT_SB_URL+'/functions/v1/email-marketing', {
      method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
      body: JSON.stringify({ action:'verify' })
    });
    const data = await res.json();
    if (data.connected) {
      const domains = data.domains?.join(', ') || 'vwholesale.in';
      const fromAddrs = data.from_addresses?.join(', ') || 'hello@vwholesale.in';
      showMktToast('✅ Resend connected! Verified domain: ' + domains + ' · Sending from: ' + fromAddrs);
    } else showMktToast('❌ ' + (data.error || 'Connection failed'));
  } catch(e) { showMktToast('❌ ' + e.message); }
  finally { if (btn) { btn.textContent='🔗 Verify'; btn.disabled=false; } }
}

function buildEmailHTML(subject, body) {
  const bodyHtml = body.split('\n').join('<br>');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #f4f4f4; color: #333; }
  .wrapper { max-width: 600px; margin: 0 auto; background: #fff; }
  .header { background:#EEF2F7; padding: 0; text-align: center; }
  .header-top { background:#EEF2F7; padding: 20px; }
  .header-top h1 { color: #C9A84C; font-size: 28px; letter-spacing: 2px; margin-bottom: 4px; }
  .header-top p { color: rgba(255,255,255,0.6); font-size: 12px; }
  .banner { background: linear-gradient(135deg, #0A1628, #1a3a5c); padding: 24px 30px; border-bottom: 3px solid #C9A84C; }
  .banner h2 { color: #fff; font-size: 20px; font-weight: 700; }
  .content { padding: 30px; background: #fff; }
  .content p { line-height: 1.8; color: #444; font-size: 14px; margin-bottom: 12px; }
  .cta-button { display: inline-block; background: #C9A84C; color: #000; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 16px 0; }
  .divider { border: none; border-top: 1px solid #eee; margin: 20px 0; }
  .store-info { background: #f9f9f9; padding: 20px 30px; border-top: 3px solid #C9A84C; }
  .store-info h3 { color: #0A1628; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .store-info p { font-size: 12px; color: #666; line-height: 1.6; }
  .footer { background:#EEF2F7; padding: 16px 30px; text-align: center; }
  .footer p { color: rgba(255,255,255,0.5); font-size: 11px; line-height: 1.6; }
  .footer a { color: #C9A84C; text-decoration: none; }
  @media (max-width: 600px) { .content { padding: 20px; } .banner { padding: 16px 20px; } }
</style>
</head>
<body>
<div class="wrapper">
  <!-- HEADER -->
  <div class="header-top">
    <h1>V <span style="color:#fff">Wholesale</span></h1>
    <p>Vijayawada's Premium Home Building Materials Store</p>
  </div>

  <!-- BANNER -->
  <div class="banner">
    <h2>${subject}</h2>
  </div>

  <!-- CONTENT -->
  <div class="content">
    <p>${bodyHtml}</p>
    <hr class="divider">
    <div style="text-align:center">
      <a href="https://vwholesale.in" class="cta-button">Visit vwholesale.in</a>
    </div>
  </div>

  <!-- STORE INFO -->
  <div class="store-info">
    <h3>📍 Visit Us</h3>
    <p>
      Visit V Wholesale 520012<br>
      📞 <a href="tel:8712697930" style="color:#0A1628">8712697930</a> &nbsp;|&nbsp;
      🌐 <a href="https://vwholesale.in" style="color:#0A1628">vwholesale.in</a><br>
      🕐 Mon–Sat: 9:00 AM – 7:00 PM
    </p>
    <p style="margin-top:10px">
      <strong>Products:</strong> Tiles · Granite · Marble · Sanitaryware · Paints · Electricals
    </p>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>
      © 2026 Vassure Wholesale Pvt Ltd · V Wholesale<br>
      <a href="https://vwholesale.in">vwholesale.in</a> · 8712697930 ·
      <a href="https://vwholesale.in/shop">Shop Online</a><br>
      <span style="font-size:10px;opacity:.6">You are receiving this email as a V Wholesale customer. 
      <a href="mailto:noreply@vwholesale.in?subject=Unsubscribe" style="color:rgba(255,255,255,.4)">Unsubscribe</a></span>
    </p>
  </div>
</div>
</body>
</html>`;
}

async function sendEmailCampaign(btn) {
  const subject = (document.getElementById('email-subject')?.value||'').trim();
  const body = (document.getElementById('email-body')?.value||'').trim();
  const segment = document.getElementById('email-segment')?.value||'all';
  const single = (document.getElementById('email-single')?.value||'').trim();

  if (!subject || !body) { showMktToast('Enter subject and message'); return; }
  if (btn) { btn.textContent='⏳ Sending…'; btn.disabled=true; }

  try {
    if (segment === 'single') {
      if (!single) { showMktToast('Enter email address'); return; }
      const res = await fetch(MKT_SB_URL+'/functions/v1/email-marketing', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({ action:'send_email', to:single, subject, html: buildEmailHTML(subject, body) })
      });
      const data = await res.json();
      if (data.ok) showMktToast('✅ Email sent to ' + single);
      else showMktToast('❌ ' + data.error);
    } else {
      // Fetch emails from CRM
      let query = sb.from('customers').select('email').not('email','is',null);
      if (segment === 'contractor') query = query.eq('type','contractor');
      const { data: contacts } = await query.limit(500).then(r=>r,()=>({data:[]}));
      const emails = (contacts||[]).map(c=>c.email).filter(Boolean);
      if (!emails.length) { showMktToast('No email contacts in this segment'); return; }
      if (!confirm('Send to ' + emails.length + ' contacts?')) return;

      const res = await fetch(MKT_SB_URL+'/functions/v1/email-marketing', {
        method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
        body: JSON.stringify({ action:'send_broadcast', emails, subject, html: buildEmailHTML(subject, body), campaign_name: subject })
      });
      const data = await res.json();
      showMktToast('✅ Sent to ' + data.sent + ' · Failed: ' + data.failed);
      renderEmail();
    }
  } catch(e) { showMktToast('❌ ' + e.message); }
  finally { if (btn) { btn.textContent='📧 Send Email'; btn.disabled=false; } }
}

async function renderWebPush() {
  setContent('<div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div>');

  const [
    {data: subs},
    {data: logs}
  ] = await Promise.all([
    sb.from('web_push_subscriptions').select('id,phone,subscribed_at,active').eq('active',true).order('subscribed_at',{ascending:false}).then(r=>r,()=>({data:[]})),
    sb.from('push_notifications_log').select('*').order('created_at',{ascending:false}).limit(10).then(r=>r,()=>({data:[]}))
  ]);

  const subCount = (subs||[]).length;

  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">'
    + '<div><h3 style="font-size:16px;font-weight:900">🔔 Web Push Notifications</h3>'
    + '<div style="font-size:12px;color:var(--text3)">Push alerts to customers on vwholesale.in · ' + subCount + ' subscribers</div></div></div>';

  // Stats
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:var(--gold)">' + subCount + '</div><div style="font-size:11px;color:var(--text3)">Active Subscribers</div></div>'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:#22c55e">' + (logs||[]).reduce((a,l)=>a+(l.sent_count||0),0) + '</div><div style="font-size:11px;color:var(--text3)">Total Sent</div></div>'
    + '<div class="mkt-card" style="text-align:center"><div style="font-size:24px;font-weight:900;color:#3b82f6">' + (logs||[]).length + '</div><div style="font-size:11px;color:var(--text3)">Campaigns</div></div>'
    + '</div>';

  // Send notification form
  html += '<div class="mkt-card" style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;margin-bottom:10px">📢 Send Push Notification</div>'
    + '<div style="display:grid;gap:8px">'
    + '<div><label class="mkt-form-label">Title (bold text)</label><input id="push-title" class="mkt-form-input" placeholder="e.g. Diwali Offer — 15% off all tiles"></div>'
    + '<div><label class="mkt-form-label">Message body</label><textarea id="push-body" class="mkt-form-input" rows="2" placeholder="e.g. Visit V Wholesale today. Limited stock. Visit V Wholesale."></textarea></div>'
    + '<div><label class="mkt-form-label">Target</label>'
    + '<select id="push-target" class="mkt-form-select">'
    + '<option value="all">All subscribers (' + subCount + ')</option>'
    + '<option value="ai">AI-generated message</option>'
    + '</select></div>'
    + '<div style="display:flex;gap:8px">'
    + '<button onclick="generatePushMessage()" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:8px 12px">✨ AI Write</button>'
    + '<button onclick="sendPushNotification()" class="mkt-btn mkt-btn-primary" style="flex:1;padding:8px;font-weight:700">🔔 Send to ' + subCount + ' subscribers</button>'
    + '</div></div></div>';

  // Quick notification templates
  const pushTemplates = [
    {icon:'🎉', title:'Festival Offer', body:'Visit V Wholesale today — special festival prices on tiles and granite. Visit V Wholesale.'},
    {icon:'🆕', title:'New Arrival', body:'New stock just arrived — Italian marble, vitrified tiles and more. First come first served!'},
    {icon:'⏰', title:'Weekend Sale', body:'This weekend only — extra 5% on all orders above 25000. Visit V Wholesale NH65.'},
    {icon:'📞', title:'Need Help?', body:'Our tile experts are ready. Call 8712697930 or visit V Wholesale NH65 today.'},
  ];
  html += '<div class="mkt-card" style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;margin-bottom:10px">⚡ Quick Templates</div><div style="display:grid;gap:6px">';
  pushTemplates.forEach(function(t) {
    html += '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg3);border-radius:6px">'
      + '<span style="font-size:18px">' + t.icon + '</span>'
      + '<div style="flex:1"><div style="font-size:11px;font-weight:600">' + t.title + '</div>'
      + '<div style="font-size:10px;color:var(--text3)">' + t.body.slice(0,60) + '...</div></div>'
      + '<button onclick="usePushTemplate(this)" data-title="' + t.title + '" data-body="' + t.body + '" class="mkt-btn mkt-btn-ghost" style="font-size:10px;padding:3px 8px">Use</button></div>';
  });
  html += '</div></div>';

  // Recent notifications
  if ((logs||[]).length) {
    html += '<div class="mkt-card"><div style="font-size:12px;font-weight:700;margin-bottom:10px">📋 Recent Notifications</div>'
      + '<div style="display:grid;gap:6px">';
    (logs||[]).forEach(log => {
      html += '<div style="padding:8px;background:var(--bg3);border-radius:6px">'
        + '<div style="display:flex;justify-content:space-between;margin-bottom:2px">'
        + '<div style="font-size:12px;font-weight:600">' + (log.title||'') + '</div>'
        + '<div style="font-size:10px;color:var(--text3)">' + new Date(log.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) + '</div></div>'
        + '<div style="font-size:11px;color:var(--text2)">' + (log.body||'') + '</div>'
        + '<div style="font-size:10px;color:var(--text3);margin-top:3px">Sent to ' + (log.sent_count||0) + ' subscribers</div></div>';
    });
    html += '</div></div>';
  }

  setContent(html);
}

function usePushTemplate(btn) {
  const t = document.getElementById('push-title');
  const b = document.getElementById('push-body');
  if (t) t.value = btn.dataset.title || '';
  if (b) b.value = btn.dataset.body || '';
}

async function generatePushMessage() {
  const topic = prompt('What is this notification about?');
  if (!topic) return;
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body: JSON.stringify({ action:'generate_text', agent:'Push Notification',
      prompt: 'Write a web push notification for V Wholesale Vijayawada about: ' + topic + '. Title: max 50 chars. Body: max 120 chars. Urgent and action-oriented. Return JSON: {"title":"...","body":"..."}',
      context: {} })
  });
  const d = await res.json();
  const msg = d.output;
  if (msg?.title) document.getElementById('push-title').value = msg.title;
  if (msg?.body) document.getElementById('push-body').value = msg.body;
  showMktToast('✅ AI message ready');
}

async function sendPushNotification() {
  const title = (document.getElementById('push-title')?.value||'').trim();
  const body = (document.getElementById('push-body')?.value||'').trim();
  const target = document.getElementById('push-target')?.value || 'all';
  if (!title || !body) { showMktToast('Enter title and message'); return; }

  const res = await fetch(MKT_SB_URL+'/functions/v1/web-push', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body: JSON.stringify({ action:'send', title, body, target })
  });
  const d = await res.json();
  if (d.ok) showMktToast('✅ Sent to ' + d.sent + ' subscribers!');
  else showMktToast('❌ ' + d.error);
  renderWebPush();
}

async function renderStaffFeed() {
  setContent(`
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><h3 style="font-size:16px;font-weight:900">📢 Staff Daily Feed</h3>
    <div style="font-size:12px;color:var(--text3)">Posts visible to all staff · CRM/Sales team shares as WhatsApp status</div></div>
    <button class="mkt-btn mkt-btn-primary" onclick="showAddFeedPost()">+ Add Post</button>
  </div>
  <div id="feed-list"><div style="text-align:center;padding:40px;color:var(--text3)">⏳ Loading…</div></div>`);
  await loadFeedPosts();
}

async function loadFeedPosts() {
  const el = document.getElementById('feed-list');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const { data: posts } = await sb.from('daily_posts_feed').select('*, post_shares(count)').gte('post_date', new Date(Date.now()-7*86400000).toISOString().split('T')[0]).order('post_date', {ascending:false}).order('created_at', {ascending:false}).then(r=>r,()=>({data:[]}));

  if (!(posts||[]).length) {
    el.innerHTML = `<div class="mkt-card" style="text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:12px">📢</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:8px">No posts in feed yet</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Generate a poster and click "Push to Staff Feed", or add a post manually</div>
      <button class="mkt-btn mkt-btn-primary" onclick="showAddFeedPost()">+ Add Post</button>
    </div>`;
    return;
  }

  // Group by date
  const byDate = {};
  (posts||[]).forEach(p => {
    const d = p.post_date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(p);
  });

  el.innerHTML = Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).map(date => {
    const label = date === today ? '📅 Today' : date === new Date(Date.now()-86400000).toISOString().split('T')[0] ? '📅 Yesterday' : '📅 ' + new Date(date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
    return `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase">${label}</div>
      <div style="display:grid;gap:10px">
        ${byDate[date].map(p => `
        <div class="mkt-card" style="padding:14px">
          <div style="display:flex;gap:12px">
            ${p.image_url ? `<img src="${p.image_url}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0">` : `<div style="width:72px;height:72px;background:var(--bg3);border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px">📝</div>`}
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;margin-bottom:3px">${p.title}</div>
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px">${(p.platforms||[]).join(' · ')||'—'} · ${p.post_type}</div>
              ${p.caption ? `<div style="font-size:11px;color:var(--text2);line-height:1.5;overflow:hidden;max-height:40px">${p.caption.slice(0,100)}${p.caption.length>100?'…':''}</div>` : ''}
              <div style="font-size:10px;color:var(--text3);margin-top:4px">Shared ${p.post_shares?.[0]?.count||0} times · by ${p.created_by||'—'}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
            <button class="mkt-btn mkt-btn-ghost" onclick="editFeedPost(${p.id})" style="font-size:11px;padding:3px 8px">✏️ Edit</button>
            <button class="mkt-btn mkt-btn-ghost" onclick="deleteFeedPost(${p.id})" style="font-size:11px;padding:3px 8px;color:var(--red)">🗑 Remove</button>
            <span class="badge ${p.status==='active'?'badge-green':'badge-gray'}">${p.status}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function showAddFeedPost() {
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  m.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;overflow:hidden">
    <div style="background:#EEF2F7;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:var(--text)">📢 Add to Staff Feed</div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:10px">
      <div class="mkt-form-group"><label class="mkt-form-label">Post Date</label>
        <input type="date" id="fp-date" class="mkt-form-input" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Title *</label>
        <input id="fp-title" class="mkt-form-input" placeholder="e.g. Diwali Offer — 20% off tiles"></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Type</label>
        <select id="fp-type" class="mkt-form-select">
          <option value="post">📝 Regular Post</option>
          <option value="offer">💰 Offer / Discount</option>
          <option value="wish">🎉 Festival Wish</option>
          <option value="product">📦 Product Showcase</option>
          <option value="announcement">📣 Announcement</option>
        </select></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Caption</label>
        <textarea id="fp-caption" class="mkt-form-input" rows="4" style="resize:vertical;font-size:12px;line-height:1.6" placeholder="Post caption with hashtags…"></textarea></div>
      <div class="mkt-form-group"><label class="mkt-form-label">Image URL (optional)</label>
        <input id="fp-image" class="mkt-form-input" placeholder="Paste image URL from brand-assets storage"></div>
      <div style="display:flex;gap:8px">
        <button class="mkt-btn mkt-btn-primary" style="flex:1" onclick="saveFeedPost()">📢 Push to Feed</button>
        <button class="mkt-btn mkt-btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e=>{if(e.target===m)m.remove();});
}

async function saveFeedPost() {
  const title = (document.getElementById('fp-title')?.value||'').trim();
  if (!title) { showMktToast('Enter a title'); return; }
  const { error } = await sb.from('daily_posts_feed').insert({
    post_date: document.getElementById('fp-date')?.value || new Date().toISOString().split('T')[0],
    title, caption: document.getElementById('fp-caption')?.value||null,
    image_url: document.getElementById('fp-image')?.value||null,
    post_type: document.getElementById('fp-type')?.value||'post',
    platforms: ['Instagram','Facebook','WhatsApp'],
    status: 'active', created_by: mktProfile?.name
  });
  if (error) { showMktToast('❌ '+error.message); return; }
  document.querySelector('[style*=fixed]')?.remove();
  showMktToast('✅ Pushed to staff feed!');
  await loadFeedPosts();
}

async function deleteFeedPost(id) {
  if (!confirm('Remove this post from staff feed?')) return;
  await sb.from('daily_posts_feed').delete().eq('id', id);
  showMktToast('Removed');
  await loadFeedPosts();
}

async function editFeedPost(id) {
  const {data:p} = await sb.from('daily_posts_feed').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!p) return;
  // Quick status toggle
  const newStatus = p.status === 'active' ? 'expired' : 'active';
  await sb.from('daily_posts_feed').update({status:newStatus}).eq('id',id);
  showMktToast(`Post ${newStatus}`);
  await loadFeedPosts();
}

// Expose render functions on window for lazy nav lookup
window.renderAudit = renderAudit;
window.renderSettings = renderSettings;
function psOpenInEditor(platform, size, dataUrl) {
  // Convert data URL to object URL and open in poster editor
  // Map platform to format key
  const formatMap = {
    instagram_feed:'square', threads:'square',
    instagram_story:'story', facebook_story:'story', whatsapp_story:'story',
    facebook_post:'landscape', youtube:'landscape', gbp:'landscape'
  };
  const key = formatMap[platform] || 'square';
  const overrideImages = { square: null, story: null, landscape: null };
  overrideImages[key] = dataUrl; // use data URL directly as bg
  openPosterEditor(null, overrideImages);
}
window.psOpenInEditor = psOpenInEditor;

window.renderPosterStudio = renderPosterStudio;
window.renderCampaigns = renderCampaigns;
window.renderSocial = renderSocial;
window.renderWhatsApp = renderWhatsApp;
window.renderAds = renderAds;
window.renderLocalSEO = renderLocalSEO;
window.renderWebsiteSEO = renderWebsiteSEO;
window.renderReviews = renderReviews;
window.renderCompetitors = renderCompetitors;
window.renderSegments = renderSegments;
window.renderGreetings = renderGreetings;
window.renderEmail = renderEmail;
window.renderWebPush = renderWebPush;
