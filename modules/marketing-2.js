

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

  <div class="mkt-card">
    <div class="mkt-card-title">🛑 Global AI Control</div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg3);border-radius:10px">
      <div>
        <div style="font-weight:700">Pause All AI Actions</div>
        <div style="font-size:12px;color:var(--text3)">Emergency stop — AI switches to recommend-only mode</div>
      </div>
      <button class="mkt-btn ${aiPaused?'mkt-btn-primary':'mkt-btn-ghost'}" onclick="toggleAIPause()" style="${aiPaused?'background:var(--red)':''}">
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
  const {data:bpArr} = await sb.from('brand_profile').select('*').limit(1).then(r=>r,()=>({data:[]}));
  const bp = (bpArr||[])[0]||{business_name:'V Wholesale',tagline:'Build Better. Pay Less.',phone:'8712697930',website:'https://vwholesale.in',address:'NH65, Bhavanipuram, Vijayawada'};

  setContent(`
  <div style="margin-bottom:16px">
    <h3 style="font-size:16px;font-weight:900">🎨 Poster Studio</h3>
    <div style="font-size:12px;color:var(--text3)">Generate with AI or upload your own → preview → publish everywhere</div>
  </div>

  <div class="mkt-grid-2" style="align-items:start;gap:16px">

    <!-- ═══ LEFT COLUMN: INPUT PANEL ═══ -->
    <div style="display:grid;gap:12px">

      <!-- MODE TOGGLE -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--bg3);border-radius:10px;padding:4px">
        <button id="ps-mode-ai" onclick="psSwitchMode('ai')"
          style="padding:10px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:700;background:var(--gold);color:#000;transition:all .2s">
          ✨ AI Generate
        </button>
        <button id="ps-mode-upload" onclick="psSwitchMode('upload')"
          style="padding:10px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:700;background:none;color:var(--text3);transition:all .2s">
          📁 Manual Upload
        </button>
      </div>

      <!-- AI GENERATE PANEL -->
      <div id="ps-ai-panel" class="mkt-card">
        <div class="mkt-card-title">📋 What's the poster about?</div>
        <div class="mkt-form-group">
          <label class="mkt-form-label">Topic / Product / Offer *</label>
          <input type="text" id="ps-topic" class="mkt-form-input"
            placeholder="e.g. Sunhearrt tiles, Monsoon bathroom offer, Contractor Club"
            onkeydown="if(event.key==='Enter') generateFullPoster()">
        </div>
        <div class="mkt-grid-2">
          <div class="mkt-form-group">
            <label class="mkt-form-label">Template</label>
            <select id="ps-template" class="mkt-form-select">
              <option value="product">Product Showcase</option>
              <option value="offer">Offer / Sale</option>
              <option value="contractor">Contractor Club</option>
              <option value="festival">Festival Special</option>
              <option value="store">Store Walk-in</option>
            </select>
          </div>
          <div class="mkt-form-group">
            <label class="mkt-form-label">Language</label>
            <select id="ps-lang" class="mkt-form-select">
              <option value="en">English</option>
              <option value="te">Telugu</option>
              <option value="te+en">Telugu + English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </div>
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:8px;padding:9px 12px;margin-bottom:12px;font-size:11.5px;color:var(--text3)">
          💡 gpt-image-2 generates the background · Canvas engine overlays all text · Zero garbled words · ~₹4/poster
        </div>
        <button class="mkt-btn mkt-btn-primary" onclick="generateFullPoster()" style="width:100%;padding:13px;font-size:14px;font-weight:900">
          ✨ Generate Poster
        </button>
      </div>

      <!-- MANUAL UPLOAD PANEL -->
      <div id="ps-upload-panel" class="mkt-card" style="display:none">
        <div class="mkt-card-title">📁 Upload Your Poster</div>
        <input type="file" id="ps-upload-file" accept="image/*" style="display:none" onchange="psHandleUpload()">
        <div id="ps-upload-zone" onclick="document.getElementById('ps-upload-file').click()"
          style="border:2px dashed var(--border);border-radius:10px;padding:28px;text-align:center;cursor:pointer;margin-bottom:12px;transition:border-color .2s"
          onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-size:36px;margin-bottom:8px">🖼</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">Click to upload poster</div>
          <div style="font-size:11px;color:var(--text3)">JPG or PNG · 1080×1080 recommended</div>
        </div>
        <div class="mkt-form-group">
          <label class="mkt-form-label">What is this poster about? *</label>
          <input type="text" id="ps-upload-topic" class="mkt-form-input"
            placeholder="e.g. Sunhearrt tiles available at V Wholesale"
            onkeydown="if(event.key==='Enter') psGenerateUploadCaption()">
        </div>
        <div class="mkt-grid-2">
          <div class="mkt-form-group">
            <label class="mkt-form-label">Template</label>
            <select id="ps-upload-template" class="mkt-form-select">
              <option value="product">Product Showcase</option>
              <option value="offer">Offer / Sale</option>
              <option value="contractor">Contractor Club</option>
              <option value="festival">Festival Special</option>
              <option value="store">Store Walk-in</option>
            </select>
          </div>
          <div class="mkt-form-group">
            <label class="mkt-form-label">Language</label>
            <select id="ps-upload-lang" class="mkt-form-select">
              <option value="en">English</option>
              <option value="te">Telugu</option>
              <option value="te+en">Telugu + English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </div>
        <button class="mkt-btn mkt-btn-primary" onclick="psGenerateUploadCaption()" style="width:100%;padding:11px;font-size:13px;font-weight:800">
          ✨ Generate Caption + Hashtags
        </button>
      </div>

      <!-- CAPTION BOX (shared, shown after generate or upload) -->
      <div class="mkt-card" id="ps-caption-card" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="mkt-card-title" style="margin:0">📝 Caption</div>
          <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="psEditCaption()">✏️ Edit</button>
        </div>
        <div id="ps-caption-display" style="background:var(--bg3);border-radius:8px;padding:11px;font-size:12px;line-height:1.7;white-space:pre-wrap;margin-bottom:10px;min-height:70px;cursor:pointer" onclick="psEditCaption()"></div>
        <textarea id="ps-caption-edit" rows="5" class="mkt-form-input" style="display:none;font-size:12px;line-height:1.7;resize:vertical;margin-bottom:8px"></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="mkt-btn mkt-btn-ghost" style="font-size:12px" onclick="copyCaptionPS()">📋 Copy Caption</button>
          <button class="mkt-btn mkt-btn-ghost" style="font-size:12px" onclick="downloadCurrentPoster()">⬇ Download PNG</button>
          <button class="mkt-btn mkt-btn-primary" style="font-size:12px" onclick="pushToStaffFeed()">📢 Push to Staff Feed</button>
          <button class="mkt-btn mkt-btn-ghost" style="font-size:12px;color:var(--purple)" onclick="generateFullPoster()">🔄 Regenerate</button>
        </div>
      </div>

      <!-- PUBLISH EVERYWHERE -->
      <div class="mkt-card" id="ps-publish-card" style="display:none">
        <div class="mkt-card-title">🚀 Publish Everywhere</div>
        <div style="display:grid;gap:8px">

          <!-- Instagram -->
          <div style="background:var(--bg3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">📸</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700">Instagram</div>
              <div style="font-size:11px;color:var(--text3)">Download poster → open app → paste caption</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="downloadCurrentPoster()">⬇ Save</button>
              <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="psPostInstagram()">Open →</button>
            </div>
          </div>

          <!-- WhatsApp -->
          <div style="background:var(--bg3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">💬</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700">WhatsApp Broadcast</div>
              <div style="font-size:11px;color:var(--text3)">Caption copied → open WhatsApp → send to broadcast</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="psPostWhatsApp()">Share →</button>
            </div>
          </div>

          <!-- Google Business Profile -->
          <div style="background:var(--bg3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">📍</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700">Google Business Profile</div>
              <div style="font-size:11px;color:var(--text3)">Add update with image and caption</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="copyCaptionPS()">📋 Copy</button>
              <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="window.open('https://business.google.com/','_blank')">Open →</button>
            </div>
          </div>

          <!-- Facebook -->
          <div style="background:var(--bg3);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">📘</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700">Facebook Page</div>
              <div style="font-size:11px;color:var(--text3)">Post to V Wholesale Facebook page</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="mkt-btn mkt-btn-ghost" style="font-size:11px" onclick="copyCaptionPS()">📋 Copy</button>
              <button class="mkt-btn mkt-btn-primary" style="font-size:11px" onclick="window.open('https://www.facebook.com/','_blank')">Open →</button>
            </div>
          </div>

        </div>

        <!-- Save to history -->
        <button class="mkt-btn mkt-btn-ghost" style="width:100%;margin-top:10px;font-size:12px" onclick="psSaveFinal()">
          💾 Save to History
        </button>
      </div>

    </div><!-- end left column -->

    <!-- ═══ RIGHT COLUMN: PREVIEW ═══ -->
    <div>
      <div class="mkt-card" style="padding:12px;position:sticky;top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="mkt-card-title" style="margin:0">Preview · 1080×1080</div>
          <span id="ps-source-badge" style="display:none;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(201,168,76,0.15);color:var(--gold)"></span>
        </div>
        <div id="ps-preview" style="background:var(--bg3);border-radius:10px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden">
          <div style="text-align:center;color:var(--text3)">
            <div style="font-size:48px;margin-bottom:8px">🎨</div>
            <div style="font-size:12px">Generate with AI or upload your poster</div>
          </div>
        </div>
      </div>

      <!-- History -->
      <div id="ps-history-card" class="mkt-card" style="display:none;margin-top:12px">
        <div class="mkt-card-title">Recent Posters</div>
        <div id="ps-history"></div>
      </div>
    </div>

  </div>`);

  loadPosterHistory();
}

// ── MODE SWITCH ──
function psSwitchMode(mode) {
  const isAI = mode === 'ai';
  document.getElementById('ps-ai-panel').style.display     = isAI ? '' : 'none';
  document.getElementById('ps-upload-panel').style.display = isAI ? 'none' : '';
  const aiBtn  = document.getElementById('ps-mode-ai');
  const upBtn  = document.getElementById('ps-mode-upload');
  aiBtn.style.background  = isAI ? 'var(--gold)' : 'none';
  aiBtn.style.color       = isAI ? '#000' : 'var(--text3)';
  upBtn.style.background  = isAI ? 'none' : 'var(--gold)';
  upBtn.style.color       = isAI ? 'var(--text3)' : '#000';
  // Reset publish area if switching
  document.getElementById('ps-caption-card').style.display  = 'none';
  document.getElementById('ps-publish-card').style.display  = 'none';
  const preview = document.getElementById('ps-preview');
  preview.innerHTML = `<div style="text-align:center;color:var(--text3)"><div style="font-size:48px;margin-bottom:8px">${isAI?'🎨':'📁'}</div><div style="font-size:12px">${isAI?'Enter a topic and click Generate':'Upload your poster image'}</div></div>`;
  currentPosterB64 = null; currentCaption = '';
}

// ── MANUAL UPLOAD HANDLER ──
function psHandleUpload() {
  const file = document.getElementById('ps-upload-file')?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const b64 = e.target.result.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
    currentPosterB64 = b64;

    // Show preview immediately
    const preview = document.getElementById('ps-preview');
    preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;cursor:zoom-in" onclick="window.open(this.src)" title="Click to zoom">`;

    // Badge
    const badge = document.getElementById('ps-source-badge');
    if (badge) { badge.textContent = '📁 Uploaded'; badge.style.display = ''; }

    // Upload zone thumbnail
    const zone = document.getElementById('ps-upload-zone');
    if (zone) zone.innerHTML = `<img src="${e.target.result}" style="max-height:72px;border-radius:6px;object-fit:contain"><div style="font-size:11px;color:var(--gold);margin-top:6px;font-weight:700">✅ ${file.name}</div>`;

    // Show caption card with placeholder — user can generate or type manually
    currentCaption = '';
    const disp = document.getElementById('ps-caption-display');
    const edit = document.getElementById('ps-caption-edit');
    if (disp) { disp.style.display = 'none'; }
    if (edit) {
      edit.value = '';
      edit.placeholder = 'Click "Generate Caption + Hashtags" above, or type your own caption here...';
      edit.style.display = 'block';
      edit.oninput = () => { currentCaption = edit.value; };
    }
    document.getElementById('ps-caption-card').style.display  = '';
    document.getElementById('ps-publish-card').style.display  = '';
    showMktToast('✅ Poster loaded — fill the topic and generate caption');
  };
  reader.readAsDataURL(file);
}

// ── AI CAPTION GENERATION FOR UPLOADED POSTER ──
async function psGenerateUploadCaption() {
  const topic    = (document.getElementById('ps-upload-topic')?.value || '').trim();
  const template = document.getElementById('ps-upload-template')?.value || 'product';
  const lang     = document.getElementById('ps-upload-lang')?.value || 'en';

  if (!topic)           { showMktToast('Enter what the poster is about first'); return; }
  if (!currentPosterB64){ showMktToast('Upload a poster image first'); return; }

  const edit = document.getElementById('ps-caption-edit');
  const disp = document.getElementById('ps-caption-display');
  if (edit) { edit.value = '⏳ Generating caption...'; edit.disabled = true; edit.style.display = 'block'; }
  if (disp) disp.style.display = 'none';

  try {
    const res = await fetch(`${MKT_SB_URL}/functions/v1/generate-poster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ topic, template, language: lang, caption_only: true, business_name: 'V Wholesale' })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'API error');

    const c = data.content || {};

    // Use AI-generated caption directly — it's already rich with emojis + hashtags
    // Only build manually if caption field is missing
    let caption = c.caption || '';
    if (!caption) {
      // Extract clean brand name from headline_line1
      const brand = (c.headline_line1 || topic.split(' ')[0]).replace(/\s/g,'');
      const cat   = (c.headline_line2 || 'Tiles').replace(/\s/g,'');
      caption =
        `✨ ${c.headline_line1||''} ${c.headline_line2||''} — ${c.subheadline||'Now Available at V Wholesale'}\n\n` +
        `${c.body||'Premium Wall & Floor Tile Collection'}\n\n` +
        `💎 ${c.feature_gold||'Elegant Designs • Modern Finishes • Lasting Quality'}\n\n` +
        `✅ ${c.feature1||'Luxury Marble Looks'}\n` +
        `✅ ${c.feature2||'Glossy, Matt & Designer Finishes'}\n` +
        `✅ ${c.feature3||'Premium Quality for Modern Homes'}\n\n` +
        `📍 V Wholesale, NH65, Bhavanipuram, Vijayawada\n` +
        `📞 Call: 8712697930 | 🌐 vwholesale.in\n\n` +
        `#VWholesale #Vijayawada #${brand} #${cat} #HomeDesign #InteriorDesign #LuxuryLiving #BuildingMaterials #AndhraPradesh`;
    }

    currentCaption = caption;
    if (edit) { edit.value = caption; edit.disabled = false; edit.oninput = () => { currentCaption = edit.value; }; }
    showMktToast('✅ Caption generated — edit if needed, then publish!');

  } catch(e) {
    console.warn('Edge function error, using fallback:', e.message);
    // Clean fallback — extract brand word from topic properly
    const words  = topic.trim().split(/\s+/);
    const brand  = words[0] || 'Brand';
    const cat    = words.find(w => ['tiles','tile','granite','paints','paint','sanitary','bathware','electrical'].includes(w.toLowerCase())) || 'Tiles';

    const fallback =
      `✨ ${topic} — Now Available at V Wholesale, Vijayawada!\n\n` +
      `🏠 Transform your home with premium quality\n` +
      `💎 Elegant Designs • Modern Finishes • Lasting Quality\n` +
      `✅ Perfect for Living Rooms, Bedrooms & Bathrooms\n\n` +
      `📍 V Wholesale, NH65, Bhavanipuram, Vijayawada\n` +
      `📞 Call: 8712697930 | 🌐 vwholesale.in\n\n` +
      `#VWholesale #Vijayawada #${brand} #${cat} #HomeDesign #InteriorDesign #LuxuryLiving #BuildingMaterials #AndhraPradesh`;

    currentCaption = fallback;
    if (edit) { edit.value = fallback; edit.disabled = false; edit.oninput = () => { currentCaption = edit.value; }; }
    showMktToast('Caption ready — you can edit before posting');
  }
}


// ── CAPTION EDIT TOGGLE ──
function psEditCaption() {
  const disp = document.getElementById('ps-caption-display');
  const edit = document.getElementById('ps-caption-edit');
  if (!disp || !edit) return;
  if (edit.style.display === 'none') {
    edit.value = currentCaption;
    edit.style.display = 'block';
    disp.style.display = 'none';
    edit.focus();
    edit.oninput = () => { currentCaption = edit.value; };
  } else {
    currentCaption = edit.value;
    disp.textContent = currentCaption;
    disp.style.display = '';
    edit.style.display = 'none';
  }
}

// ── PUBLISH ACTIONS ──
function psPostInstagram() {
  copyCaptionPS();
  downloadCurrentPoster();
  setTimeout(() => window.open('https://www.instagram.com/', '_blank'), 600);
  showMktToast('📋 Caption copied + poster downloading → paste in Instagram');
}

function psPostWhatsApp() {
  const txt = currentCaption || 'Check out our latest offer at V Wholesale, Vijayawada!';
  copyCaptionPS();
  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
}

async function psSaveFinal() {
  const label = document.getElementById('ps-upload-topic')?.value?.trim() ||
                document.getElementById('ps-topic')?.value?.trim() ||
                'Poster';
  if (!currentPosterB64) { showMktToast('No poster to save'); return; }

  let image_url = null;
  try {
    await sb.storage.createBucket('brand-assets', { public: true }).catch(()=>{});
    const byteArr = Uint8Array.from(atob(currentPosterB64), c => c.charCodeAt(0));
    const blob = new Blob([byteArr], { type: 'image/png' });
    const fname = `posters/${Date.now()}-${label.replace(/\W/g,'_').slice(0,30)}.png`;
    const { error } = await sb.storage.from('brand-assets').upload(fname, blob, { contentType: 'image/png', upsert: true });
    if (!error) {
      const { data: u } = sb.storage.from('brand-assets').getPublicUrl(fname);
      image_url = u?.publicUrl || null;
    }
  } catch(e) { console.warn('Upload err:', e.message); }

  await sb.from('poster_history').insert({
    topic: label, template: 'manual', language: 'en',
    caption: currentCaption, image_url, status: 'draft',
    created_by: mktProfile?.name
  });
  showMktToast('✅ Saved to history!');
  loadPosterHistory();
}



// ── POSTER CANVAS COMPOSITOR ──
// Hero image from DALL-E 3 HD + all text/branding composited on HTML Canvas
// Eliminates ALL text garbling from image generation models

let currentPosterB64 = null;
let currentCaption = '';
let currentPosterContent = null;

async function generateFullPoster() {
  const topic = (document.getElementById('ps-topic')?.value||'').trim();
  const template = document.getElementById('ps-template')?.value||'product';
  const lang = document.getElementById('ps-lang')?.value||'en';
  if (!topic) { showMktToast('Enter a topic first'); return; }

  const preview = document.getElementById('ps-preview');
  const setStatus = (msg) => {
    const el = document.getElementById('ps-status');
    if (el) el.textContent = msg;
  };

  preview.innerHTML = `
  <div style="text-align:center;padding:40px">
    <div class="ai-thinking" style="justify-content:center;margin-bottom:16px">
      <div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>
    </div>
    <div style="font-size:14px;font-weight:700;color:var(--text2)" id="ps-status">✍️ Writing content…</div>
    <div style="font-size:12px;color:var(--text3);margin-top:6px">Then generating premium hero image with DALL-E 3 HD</div>
    <div style="font-size:11px;color:var(--text3);margin-top:4px">~30–50 seconds</div>
  </div>`;

  const {data:bpArr} = await sb.from('brand_profile').select('*').limit(1).then(r=>r,()=>({data:[]}));
  const bp = (bpArr||[])[0]||{};

  try {
    setStatus('✍️ Writing poster content…');
    const res = await fetch(`${MKT_SB_URL}/functions/v1/generate-poster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        topic, template, language: lang,
        business_name: bp.business_name||'V Wholesale',
        phone: bp.phone||'8712697930',
        website: bp.website||'vwholesale.in',
        address: bp.address||'NH65, Bhavanipuram, Vijayawada',
        tagline: bp.tagline||'Build Better. Pay Less.',
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Generation failed');

    setStatus('🎨 Compositing poster with Canvas engine…');
    currentPosterContent = data.content;
    currentCaption = data.content?.caption || `✨ ${topic} now at V Wholesale, Vijayawada! 📞 8712697930 | vwholesale.in #VWholesale #Vijayawada`;

    const bizInfo = {
      name: bp.business_name || 'V Wholesale',
      phone: bp.phone || '8712697930',
      website: (bp.website || 'vwholesale.in').replace('https://','').replace('http://',''),
      address: bp.address || 'NH65, Bhavanipuram, Vijayawada',
      tagline: (bp.tagline || 'Beautiful Spaces. Built to Last.').toUpperCase(),
    };

    const posterB64 = await composePosterCanvas(data.image_b64, data.content, bizInfo);
    currentPosterB64 = posterB64;

    preview.innerHTML = `<img src="data:image/png;base64,${posterB64}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;cursor:zoom-in" onclick="window.open(this.src)" title="Click to zoom">`;

    // Show source badge
    const badge = document.getElementById('ps-source-badge');
    if (badge) { badge.textContent = `✨ ${data.image_source === 'gpt-image-2' ? 'gpt-image-2' : 'Stock Photo'}`; badge.style.display = ''; }

    // Populate caption in new unified card
    const capDisp = document.getElementById('ps-caption-display');
    const capEdit = document.getElementById('ps-caption-edit');
    if (capDisp) { capDisp.textContent = currentCaption; capDisp.style.display = ''; }
    if (capEdit) { capEdit.value = currentCaption; capEdit.style.display = 'none'; }
    document.getElementById('ps-caption-card').style.display  = '';
    document.getElementById('ps-publish-card').style.display  = '';

    // Save composited poster to Supabase Storage (upsert=true to never fail on duplicate)
    let image_url = null;
    try {
      const byteArr = Uint8Array.from(atob(posterB64), c => c.charCodeAt(0));
      const blob = new Blob([byteArr], { type: 'image/png' });
      const filename = `posters/${Date.now()}-${topic.replace(/[^a-z0-9]/gi,'_').slice(0,30)}.png`;

      // Ensure bucket exists (creates if missing — idempotent)
      await sb.storage.createBucket('brand-assets', { public: true }).catch(()=>{});

      const { data: upData, error: upErr } = await sb.storage.from('brand-assets').upload(filename, blob, { contentType: 'image/png', upsert: true });
      if (upErr) {
        console.error('Storage upload error:', upErr.message, upErr);
      } else {
        const { data: urlData } = sb.storage.from('brand-assets').getPublicUrl(filename);
        image_url = urlData?.publicUrl || null;
        console.log('Poster uploaded:', image_url);
      }
    } catch(uploadErr) {
      console.error('Upload exception:', uploadErr.message);
    }

    // Insert history record and get the new ID so we can cache b64 locally
    const { data: inserted } = await sb.from('poster_history').insert({
      topic, template, language: lang,
      headline: data.content?.headline_line1,
      caption: currentCaption,
      image_url,
      status: 'draft',
      created_by: mktProfile?.name
    }).select('id').single().then(r=>r, ()=>({data:null}));

    // Cache composited poster in sessionStorage by ID (survives page nav, not hard refresh)
    if (inserted?.id) {
      try { sessionStorage.setItem(`poster_b64_${inserted.id}`, posterB64); } catch(e) {}
    }

    loadPosterHistory();
    showMktToast(image_url ? '✅ Poster saved! Click image to zoom or download.' : '✅ Poster ready! (Storage upload failed — download now to save)');

  } catch(e) {
    preview.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red)">
      <div style="font-size:32px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:700;margin-bottom:4px">Generation Failed</div>
      <div style="font-size:12px;color:var(--text2)">${e.message}</div>
      <div style="font-size:11px;margin-top:8px;color:var(--text3)">Check OpenAI credits &amp; OPENAI_API_KEY secret in Supabase</div>
    </div>`;
  }
}

// ─────────────────────────────────────────────────────────
//  CANVAS COMPOSITOR — matches ChatGPT poster style
//  Navy left panel + hero photo right half + full text overlay
// ─────────────────────────────────────────────────────────
async function composePosterCanvas(heroB64, content, biz) {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');

  const NAVY  = '#1a2744';
  const GOLD  = '#c9a84c';
  const WHITE = '#ffffff';

  // Layout constants — hard split
  const SPLIT_X  = 442;   // left panel width
  const HERO_TOP = 0;
  const HERO_H   = 815;   // hero image zone height (top 75.5%)
  const BOT_Y    = HERO_H;
  const STRIP_Y  = S - 130;
  const FOOT_Y   = S - 90;

  // ── 1. Full navy canvas ──
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, S, S);

  // ── 2. Hero image — RIGHT HALF ONLY, strictly clipped ──
  try {
    const img = await loadImgB64(heroB64);
    ctx.save();
    // Clip strictly to right panel — no overlap with left text zone
    ctx.beginPath();
    ctx.rect(SPLIT_X, HERO_TOP, S - SPLIT_X, HERO_H);
    ctx.clip();
    const sc = Math.max((S - SPLIT_X) / img.width, HERO_H / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, SPLIT_X + ((S - SPLIT_X) - dw)/2, (HERO_H - dh)/2, dw, dh);
    ctx.restore();

    // Gold curved border between left panel and hero
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(SPLIT_X + 8, HERO_H / 2, HERO_H / 2 + 16, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();

    // Left-edge fade on hero (navy → transparent, 60px wide)
    const grad = ctx.createLinearGradient(SPLIT_X, 0, SPLIT_X + 60, 0);
    grad.addColorStop(0, 'rgba(26,39,68,1)');
    grad.addColorStop(1, 'rgba(26,39,68,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(SPLIT_X, HERO_TOP, 60, HERO_H);
  } catch(e) { console.warn('Hero image error:', e.message); }

  // ── 3. Solid navy LEFT PANEL — covers any bleed from hero ──
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, SPLIT_X, HERO_H);

  // ── 4. TOP-RIGHT badge ──
  ctx.save();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(S - 132, 0); ctx.lineTo(S, 0); ctx.lineTo(S, 86); ctx.lineTo(S - 148, 86);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = NAVY; ctx.textAlign = 'center';
  ctx.font = 'bold 10px Arial'; ctx.fillText('★ ★ ★', S - 66, 15);
  ctx.font = 'bold 12px Arial'; ctx.fillText('AVAILABLE', S - 66, 32);
  ctx.font = 'bold 12px Arial'; ctx.fillText('IN STORE', S - 66, 50);
  ctx.font = 'bold 10px Arial'; ctx.fillText('★ ★ ★', S - 66, 68);
  ctx.textAlign = 'left'; ctx.restore();

  // ── 5. V WHOLESALE LOGO + NAME ──
  psDrawVLogo(ctx, 36, 26, 50, GOLD);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 20px Arial';
  ctx.fillText('V WHOLESALE', 96, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '9.5px Arial';
  ctx.fillText('TILES  •  SANITARY  •  BATHWARE', 96, 64);

  // ── 6. HEADLINE LINE 1 — brand name, gold, large ──
  const h1 = (content?.headline_line1 || 'SUNHEARRT').toUpperCase();
  ctx.fillStyle = GOLD;
  psFitText(ctx, h1, 'bold', 36, 215, SPLIT_X - 50, 88, 44);

  // ── 7. HEADLINE LINE 2 — category, white, larger ──
  const h2 = (content?.headline_line2 || 'TILES').toUpperCase();
  ctx.fillStyle = WHITE;
  psFitText(ctx, h2, 'bold', 36, 340, SPLIT_X - 50, 116, 58);

  // Gold rule + diamond
  ctx.fillStyle = GOLD;
  ctx.fillRect(36, 362, SPLIT_X - 70, 2.5);
  ctx.save();
  ctx.translate(SPLIT_X / 2, 362);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();

  // ── 8. SUBHEADLINE — gold bar ──
  const sub = content?.subheadline || 'Now Available at V Wholesale';
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 374, SPLIT_X + 20, 44);
  ctx.fillStyle = NAVY;
  ctx.font = 'bold 16px Arial';
  ctx.fillText(sub, 36, 402);

  // ── 9. BODY TEXT ──
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 15.5px Arial';
  const bodyTxt = content?.body || 'Premium Wall & Floor Tile Collection';
  ctx.fillText(bodyTxt, 36, 444);

  // Gold italic features
  ctx.fillStyle = GOLD;
  ctx.font = 'italic 13px Arial';
  const featLine = content?.feature_gold || 'Elegant Designs • Modern Finishes • Lasting Quality';
  psWrapText(ctx, featLine, 36, 466, SPLIT_X - 50, 18);

  // Thin gold rule
  ctx.strokeStyle = 'rgba(201,168,76,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36, 490); ctx.lineTo(SPLIT_X - 20, 490); ctx.stroke();

  // House icon + usage line
  psHouseIcon(ctx, 36, 500, GOLD);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '12.5px Arial';
  const usageTxt = content?.usage || 'Perfect for Living Rooms, Bedrooms, Bathrooms & Outdoor Spaces';
  psWrapText(ctx, usageTxt, 62, 508, SPLIT_X - 60, 17);

  // ── 10. BOTTOM ZONE — dark band across full width ──
  ctx.fillStyle = 'rgba(8,15,35,0.72)';
  ctx.fillRect(0, BOT_Y, S, STRIP_Y - BOT_Y);

  // ── 11. FEATURE ICONS — 3 equal columns ──
  const iconY   = BOT_Y + 12;
  const COL_W   = S / 3;
  const icons   = ['◈', '⬡', '✦'];
  const flabels = [
    (content?.feature1 || 'Luxury Marble Looks').replace(' & ', '\n& '),
    (content?.feature2 || 'Glossy, Matt &\nDesigner Finishes'),
    (content?.feature3 || 'Premium Quality\nfor Modern Homes'),
  ];
  [0, 1, 2].forEach(i => {
    const cx = COL_W * i + COL_W / 2;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, iconY + 28, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
    ctx.fillText(icons[i], cx, iconY + 36);
    ctx.fillStyle = WHITE; ctx.font = '11.5px Arial';
    flabels[i].split('\n').forEach((ln, li) => ctx.fillText(ln, cx, iconY + 70 + li * 15));
    if (i < 2) {
      ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(COL_W * (i + 1), iconY + 8);
      ctx.lineTo(COL_W * (i + 1), iconY + 92);
      ctx.stroke();
    }
  });
  ctx.textAlign = 'left';

  // ── 12. CATEGORY STRIP — gold bar ──
  const stripItems = content?.strip_items || ['TILES', 'GRANITE', 'SANITARYWARE', 'PAINTS', 'ELECTRICALS'];
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, STRIP_Y, S, 38);
  ctx.fillStyle = NAVY;
  ctx.font = 'bold 12.5px Arial';
  ctx.textAlign = 'center';
  const sw = S / stripItems.length;
  stripItems.forEach((item, i) => ctx.fillText(item.toUpperCase(), sw * i + sw / 2, STRIP_Y + 25));
  ctx.textAlign = 'left';

  // ── 13. FOOTER — navy bar ──
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, FOOT_Y, S, S - FOOT_Y);
  // Gold top rule
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, FOOT_Y, S, 2);

  // Left: business details
  ctx.fillStyle = GOLD; ctx.font = 'bold 26px Arial';
  ctx.fillText(biz.name || 'V Wholesale', 36, FOOT_Y + 33);
  ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = '11.5px Arial';
  ctx.fillText('📍 ' + (biz.address || 'NH65, Bhavanipuram, Vijayawada'), 36, FOOT_Y + 53);
  ctx.fillText('📞 Call: ' + (biz.phone || '8712697930'), 36, FOOT_Y + 69);
  ctx.fillText('🌐 ' + (biz.website || 'vwholesale.in'), 36, FOOT_Y + 85);

  // Right: CTA button
  const ctaW = 258, ctaH = 48;
  const ctaX = S - ctaW - 36;
  const ctaY = FOOT_Y + 20;
  ctx.fillStyle = 'rgba(201,168,76,0.1)';
  psRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 24, 24, 24, 24); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  psRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 24, 24, 24, 24); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.font = 'bold 13.5px Arial'; ctx.textAlign = 'center';
  ctx.fillText((content?.cta || 'VISIT OUR STORE TODAY').toUpperCase() + '  ›', ctaX + ctaW / 2, ctaY + 30);
  ctx.textAlign = 'left';

  // Bottom tagline centre
  ctx.fillStyle = 'rgba(201,168,76,0.7)'; ctx.font = 'italic 11px Arial'; ctx.textAlign = 'center';
  ctx.fillText(biz.tagline || 'BEAUTIFUL SPACES. BUILT TO LAST.', S / 2, S - 8);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
}

// ── CANVAS UTILS ──
function loadImgB64(b64) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Image load failed'));
    img.src = 'data:image/png;base64,' + b64;
  });
}
function psRoundedRect(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x+tl, y);
  ctx.lineTo(x+w-tr, y); ctx.arcTo(x+w, y, x+w, y+tr, tr);
  ctx.lineTo(x+w, y+h-br); ctx.arcTo(x+w, y+h, x+w-br, y+h, br);
  ctx.lineTo(x+bl, y+h); ctx.arcTo(x, y+h, x, y+h-bl, bl);
  ctx.lineTo(x, y+tl); ctx.arcTo(x, y, x+tl, y, tl);
  ctx.closePath();
}
function psFitText(ctx, text, weight, x, y, maxW, startSz, minSz) {
  let sz = startSz;
  ctx.font = `${weight} ${sz}px Arial`;
  while (ctx.measureText(text).width > maxW && sz > minSz) {
    sz -= 4; ctx.font = `${weight} ${sz}px Arial`;
  }
  ctx.fillText(text, x, y);
}
function psWrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' '); let line = '';
  for (const w of words) {
    const t = line + w + ' ';
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line.trim(), x, y); y += lineH; line = w + ' '; }
    else line = t;
  }
  ctx.fillText(line.trim(), x, y);
}
function psDrawVLogo(ctx, x, y, sz, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5;
  // Diamond outline
  ctx.beginPath();
  ctx.moveTo(x+sz/2,y); ctx.lineTo(x+sz,y+sz/2); ctx.lineTo(x+sz/2,y+sz); ctx.lineTo(x,y+sz/2);
  ctx.closePath(); ctx.stroke();
  // V shape
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(x+sz*0.24,y+sz*0.3); ctx.lineTo(x+sz*0.5,y+sz*0.72); ctx.lineTo(x+sz*0.76,y+sz*0.3);
  ctx.stroke();
  // Crown dots
  [0.2,0.5,0.8].forEach(p => { ctx.beginPath(); ctx.arc(x+sz*p,y+sz*0.16,3.5,0,Math.PI*2); ctx.fill(); });
  ctx.restore();
}
function psHouseIcon(ctx, x, y, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x,y+9); ctx.lineTo(x+10,y); ctx.lineTo(x+20,y+9);
  ctx.moveTo(x+2,y+9); ctx.lineTo(x+2,y+20); ctx.lineTo(x+18,y+20); ctx.lineTo(x+18,y+9);
  ctx.moveTo(x+7,y+14); ctx.lineTo(x+7,y+20); ctx.lineTo(x+13,y+20); ctx.lineTo(x+13,y+14); ctx.closePath();
  ctx.stroke(); ctx.restore();
}

// ── POSTER ACTIONS ──
function downloadCurrentPoster() {
  if (!currentPosterB64) { showMktToast('Generate a poster first'); return; }
  const a = document.createElement('a');
  a.download = 'vwholesale-poster-' + Date.now() + '.png';
  a.href = 'data:image/png;base64,' + currentPosterB64;
  a.click();
  showMktToast('✅ Downloaded!');
}
function copyCaptionPS() {
  // Sync from edit textarea if it's open
  const edit = document.getElementById('ps-caption-edit');
  if (edit && edit.style.display !== 'none') currentCaption = edit.value;
  if (!currentCaption) { showMktToast('No caption yet — write one or generate first'); return; }
  navigator.clipboard.writeText(currentCaption).then(() => showMktToast('📋 Caption copied!'));
}
async function regeneratePoster(topic, template, lang) {
  const topicEl = document.getElementById('ps-topic');
  const tmplEl  = document.getElementById('ps-template');
  const langEl  = document.getElementById('ps-lang');
  if (topicEl) topicEl.value = topic;
  if (tmplEl)  tmplEl.value  = template;
  if (langEl)  langEl.value  = lang;
  document.getElementById('mkt-content').scrollTo({top:0, behavior:'smooth'});
  showMktToast('Ready — click ✨ Generate Poster');
}

async function viewPosterHistory(id) {
  const {data:h} = await sb.from('poster_history').select('*').eq('id',id).single().then(r=>r,()=>({data:null}));
  if (!h) { showMktToast('Not found'); return; }

  // Check if we have the composited image cached in sessionStorage
  let cachedB64 = null;
  try { cachedB64 = sessionStorage.getItem(`poster_b64_${id}`); } catch(e) {}

  // Decide what image source to show
  const imgSrc = h.image_url || (cachedB64 ? `data:image/png;base64,${cachedB64}` : null);
  const downloadHref = h.image_url || (cachedB64 ? `data:image/png;base64,${cachedB64}` : null);

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center';
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:100%;max-width:520px;overflow:hidden;margin-top:20px">
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:14px;font-weight:900;color:#fff">${h.topic||'Poster'}</div>
        <div style="font-size:11px;color:#64748B">${h.template||'product'} · ${h.language||'en'} · ${new Date(h.created_at).toLocaleDateString('en-IN')}</div>
      </div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#64748B;font-size:22px;cursor:pointer">✕</button>
    </div>
    <div style="padding:16px;display:grid;gap:12px">
      ${imgSrc
        ? `<img src="${imgSrc}" style="width:100%;border-radius:10px;display:block;cursor:zoom-in" loading="lazy"
             onclick="window.open(this.src)"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`
        : ''
      }
      <div style="background:var(--bg3);border-radius:10px;padding:32px;text-align:center;color:var(--text3);font-size:13px${imgSrc?';display:none':''}">
        <div style="font-size:32px;margin-bottom:8px">🖼</div>
        Click Regenerate to recreate this poster.
      </div>
      ${h.caption?`<div style="background:var(--bg3);border-radius:8px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:4px">CAPTION</div>
        <div style="font-size:12px;line-height:1.7;white-space:pre-wrap;max-height:120px;overflow-y:auto">${h.caption}</div>
      </div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${downloadHref?`<a href="${downloadHref}" download="vwholesale-poster-${h.id}.png" class="mkt-btn mkt-btn-ghost" style="text-decoration:none">⬇ Download</a>`:''}
        <button class="mkt-btn mkt-btn-primary" style="flex:1"
          onclick="this.closest('[style*=fixed]').remove();
          document.getElementById('ps-topic').value='${(h.topic||'').replace(/'/g,"\\'")}';
          document.getElementById('ps-template').value='${h.template||'product'}';
          document.getElementById('ps-lang').value='${h.language||'en'}';
          mktNav('poster')">🔄 Regenerate</button>
        <button class="mkt-btn mkt-btn-ghost" style="color:var(--red)"
          onclick="if(confirm('Delete?')){deletePosterHistory(${h.id});this.closest('[style*=fixed]').remove();}">🗑 Delete</button>
        ${h.caption?`<button class="mkt-btn mkt-btn-ghost" onclick="copyPosterCaption(${h.id})">📋 Copy</button>`:''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target===modal) modal.remove(); });
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">${c.id?'✏️ Edit Campaign':'📣 New Campaign'}</div>
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">📊 Update Stats</div>
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">🤖 AI Campaign Tip — ${c.name}</div>
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
  let query = sb.from('customers').select('id', {count:'exact',head:true}).not('phone','is',null);
  if (segment === 'contractor') query = query.eq('type','contractor');
  const { count } = await query.then(r=>r,()=>({count:0}));
  el.textContent = (count||0) + ' customers with phone numbers in this segment';
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
  // Fetch phone numbers from customers table based on segment
  let query = sb.from('customers').select('phone,type,total_spent,last_visit').not('phone','is',null);
  
  if (segment === 'contractor') {
    query = query.eq('type','contractor');
  } else if (segment === 'high_value') {
    query = query.gte('total_spent', 50000);
  } else if (segment === 'inactive') {
    const ninetyDaysAgo = new Date(Date.now() - 90*86400000).toISOString();
    query = query.lt('last_visit', ninetyDaysAgo);
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
    festival: { title:'Festival Greeting', fields:[{l:'Festival name',id:'qa-festival',p:'Diwali'},{l:'Target segment',id:'qa-seg',p:'all',type:'select',opts:['all','contractor','homeowner']}] },
    contractor: { title:'Contractor Update', fields:[{l:'Contractor phone',id:'qa-phone',p:'9876543210'},{l:'Contractor name',id:'qa-name',p:'Kumar'},{l:'This month earnings',id:'qa-earn',p:'2,500'}] },
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
    message = 'Hi ' + name + '! Your quotation from V Wholesale is ready. Quotation: ' + quot + '. Total: Rs ' + total + '. Valid 7 days. Call: 8712697930. Visit: NH65, Bhavanipuram, Vijayawada. Team V Wholesale';
  } else if (type === 'review') {
    const product = document.getElementById('qa-product')?.value||'your purchase';
    message = 'Hi ' + name + '! Thank you for shopping at V Wholesale. We hope you are loving your ' + product + '. Please rate us on Google - search V Wholesale Vijayawada. Your feedback means a lot! Team V Wholesale';
  } else if (type === 'contractor') {
    const earn = document.getElementById('qa-earn')?.value||'0';
    message = 'Hi ' + name + '! V Wholesale Contractor Club update: This month earnings: Rs ' + earn + '. Keep referring and earning! 2% on every referral. Call: 8712697930. Team V Wholesale';
  } else {
    const festival = document.getElementById('qa-festival')?.value||'festival';
    message = festival + ' subhakankshalu! V Wholesale nundi meeku mariyu meeru kutumbaaniki subhasirvadalu. NH65, Bhavanipuram, Vijayawada. 8712697930. Team V Wholesale';
  }

  if (!phone && type !== 'festival') { showMktToast('Enter phone number'); return; }
  document.querySelectorAll('.wa-quick-modal').forEach(e=>e.remove());

  // Map quick action types to actual approved Interakt templates
  // All vassure_* templates have no variables — fixed text approved by Meta
  const templateMap = {
    quotation: { name:'vassure_order_confirmation', values:[] },
    review:    { name:'vassure_feedback_request',   values:[] },
    festival:  { name:'vassure_special_event_greetings', values:[] },
    contractor:{ name:'vassure_bulk_order_assistance', values:[] },
  };
  const tmpl = templateMap[type] || { name:'vassure_promotional_offer', values:[] };

  const res = await fetch(MKT_SB_URL+'/functions/v1/meta-whatsapp', {
    method:'POST', headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},
    body: JSON.stringify({ action:'send_template', phone, template_name: tmpl.name, body_values: tmpl.values, language_code:'en' })
  });
  const d = await res.json();
  showMktToast(d.ok ? '✅ WhatsApp sent to ' + name : '❌ ' + (d.error||'Send failed'));
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
    const sa = d.subscribed_apps || {};
    const as = d.app_subscriptions || {};
    const ok = function(v) { return v ? '<span style="color:#22c55e">' + v + '</span>' : '<span style="color:#ef4444">missing</span>'; };

    let h = '<div style="background:var(--bg2);border-radius:6px;padding:8px;font-size:11px;line-height:1.8">';
    h += '<div><span style="color:var(--text3)">WABA:</span> ' + (d.waba_id || '-') + '</div>';
    h += '<div><span style="color:var(--text3)">App subscribed to WABA:</span> '
      + (sa.count ? '<span style="color:#22c55e">yes</span>' : '<span style="color:#ef4444">no</span>') + '</div>';

    if (as.readable) {
      h += '<div><span style="color:var(--text3)">Callback URL:</span> '
        + (as.callback_url ? '<span style="color:#22c55e">set</span>' : '<span style="color:#ef4444">MISSING</span>') + '</div>';
      if (as.callback_url) h += '<div style="font-size:9px;color:var(--text3);word-break:break-all">' + as.callback_url + '</div>';
      h += '<div><span style="color:var(--text3)">Active:</span> ' + (as.active ? '<span style="color:#22c55e">yes</span>' : '<span style="color:#ef4444">no</span>') + '</div>';
      h += '<div><span style="color:var(--text3)">messages field:</span> '
        + (as.has_messages ? '<span style="color:#22c55e">subscribed</span>' : '<span style="color:#ef4444">NOT subscribed</span>') + '</div>';
      if ((as.fields || []).length) h += '<div style="font-size:9px;color:var(--text3)">fields: ' + as.fields.join(', ') + '</div>';
      if ((as.all_objects || []).length) h += '<div style="font-size:9px;color:var(--text3)">objects: ' + as.all_objects.join(', ') + '</div>';
    } else {
      h += '<div style="color:#ef4444">Cannot read app config: ' + (as.error || 'unknown') + '</div>';
    }
    h += '</div>';

    if (!as.callback_url || !as.has_messages) {
      h += '<button onclick="waInstallWebhook(this)" class="mkt-btn mkt-btn-primary" style="font-size:11px;padding:6px 12px;margin-top:8px">Install webhook via API</button>';
    }
    if (out) out.innerHTML = h;
  } catch (e) {
    if (out) out.innerHTML = '<div style="color:var(--red);font-size:11px">' + e.message + '</div>';
  } finally {
    if (btn) { btn.textContent = '🔗 Check Webhook'; btn.disabled = false; }
  }
}

async function waInstallWebhook(btn) {
  if (btn) { btn.textContent = 'Installing...'; btn.disabled = true; }
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/wa-webhook-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'install_webhook' })
    });
    const d = await res.json();
    showMktToast(d.ok ? 'Webhook installed' : (d.error || 'Install failed'));
    waWebhookCheck();
  } catch (e) {
    showMktToast(e.message);
  } finally {
    if (btn) { btn.textContent = 'Install webhook via API'; btn.disabled = false; }
  }
}

async function waWebhookSubscribe(btn) {
  if (btn) { btn.textContent = 'Subscribing...'; btn.disabled = true; }
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/wa-webhook-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'subscribe' })
    });
    const d = await res.json();
    showMktToast(d.ok ? 'App subscribed to WABA' : (d.error || 'Subscribe failed'));
    waWebhookCheck();
  } catch (e) {
    showMktToast(e.message);
  } finally {
    if (btn) { btn.textContent = 'Subscribe app to WABA'; btn.disabled = false; }
  }
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
    + '<textarea id="wa-ai-topic" class="mkt-form-input" rows="3" placeholder="e.g. V Wholesale running 40 rs per sft tile sale this month, valid till end of July, visit NH65"></textarea>'
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
    +['tiles near me Vijayawada','granite price Vijayawada','bathroom fittings NH65','flooring shop Andhra Pradesh',
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
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'local_keywords',language:'en',topic:'local SEO keywords',context:{business:'V Wholesale',location:'Vijayawada, Andhra Pradesh, NH65, Bhavanipuram',categories:'tiles, granite, sanitaryware, paints, electricals'}})});
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">✍️ Write SEO Blog Article</div>
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
        <textarea id="blog-ideas" class="mkt-form-input" rows="4" style="resize:vertical;font-size:12px;line-height:1.6" placeholder="e.g.&#10;- Mention that V Wholesale stocks 500+ tile designs&#10;- Include tips on choosing grout color&#10;- Talk about waterproofing importance&#10;- Mention our 10,000 sqft showroom on NH65&#10;- Include price range ₹30-150 per sqft"></textarea>
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
      <div style="flex:1">
        <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:4px">${p.title}</div>
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
  const res = await fetch(MKT_SB_URL+'/functions/v1/marketing-ai',{method:'POST',headers:{'Content-Type':'application/json','apikey':MKT_SB_KEY},body:JSON.stringify({task:'faq_answer',language:'te+en',topic:'FAQ answer',context:{question:q,business:'V Wholesale',location:'NH65, Bhavanipuram, Vijayawada',timings:'10am-8pm Mon-Sat, 11am-6pm Sun',phone:'8712697930',website:'vwholesale.in'}})});
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">🔍 Add Competitor</div>
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:15px;font-weight:900;color:#fff">📊 ${compName}</div>
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
      address: 'NH65, Bhavanipuram, Vijayawada',
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">💬 WhatsApp Greeting — ${name}</div>
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
    {icon:'🎉', label:'Festival Offer', subject:'Special Festival Offer from V Wholesale', body:'Dear Customer, Wishing you a joyous celebration! This festive season V Wholesale brings special offers on tiles, granite, marble and more. Visit NH65 Bhavanipuram Vijayawada or call 8712697930. Team V Wholesale'},
    {icon:'⭐', label:'Review Request', subject:'How was your V Wholesale experience?', body:'Dear Customer, Thank you for your recent purchase from V Wholesale. Would you spare 2 minutes to share your experience on Google? Your feedback helps us serve you better. Call 8712697930. Team V Wholesale'},
    {icon:'🆕', label:'New Arrivals', subject:'New Stock Alert from V Wholesale', body:'Dear Customer, Exciting news! New stock just arrived at V Wholesale — Italian Marble, vitrified tiles, premium sanitaryware. Visit NH65 Bhavanipuram Vijayawada. Call 8712697930. Team V Wholesale'},
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
        prompt: 'Write a professional marketing email for V Wholesale Vijayawada. Topic: ' + subject + '. Brand: V Wholesale — premium home building materials, NH65 Bhavanipuram, 8712697930, vwholesale.in. Warm, professional tone. Include CTA. Under 200 words. Return just the email body text.',
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
  .header { background: #0A1628; padding: 0; text-align: center; }
  .header-top { background: #0A1628; padding: 20px; }
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
  .footer { background: #0A1628; padding: 16px 30px; text-align: center; }
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
      NH65, Bhavanipuram, Vijayawada, Andhra Pradesh 520012<br>
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
    + '<div><label class="mkt-form-label">Message body</label><textarea id="push-body" class="mkt-form-input" rows="2" placeholder="e.g. Visit V Wholesale today. Limited stock. NH65 Bhavanipuram."></textarea></div>'
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
    {icon:'🎉', title:'Festival Offer', body:'Visit V Wholesale today — special festival prices on tiles and granite. NH65 Bhavanipuram.'},
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
    <div style="background:#0A1628;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:14px;font-weight:900;color:#fff">📢 Add to Staff Feed</div>
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
