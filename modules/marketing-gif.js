// ═══════════════════════════════════════════════════════
// GIF STUDIO — V Wholesale Marketing Portal
// Browser-based GIF + WebM creator with Canvas animation
// Architecture: BrowserAnimationRenderer (v1)
//               FfmpegWorkerRenderer (planned, v2)
// ═══════════════════════════════════════════════════════

// ── DB schema for gif_campaigns ──
// id, title, topic, headline, poster_message, caption_en, caption_te, hashtags
// mode: 'slideshow' | 'animated_text'
// animation_style: 'cinematic' | 'typewriter' | 'bold_reveal'
// duration: 'short' | 'medium' | 'custom'
// custom_duration_sec, frame_count
// background_url, background_b64
// frames: jsonb (array of frame objects)
// render_backend: 'browser' | 'ffmpeg_worker'
// render_status: 'draft' | 'render_pending' | 'rendering' | 'done' | 'failed'
// gif_url, webm_url, preview_url
// linked_poster_id (non-destructive — original poster preserved)
// calendar_id (optional — linked to calendar post)
// created_at, updated_at

// ── Renderer interface (adapter pattern) ──
class BrowserAnimationRenderer {
  constructor(config) {
    this.config = config; // { canvas, frames, fps, duration, onProgress }
    this.cancelled = false;
    this.progress = 0;
  }
  async renderPreview() { /* animates on canvas in real time */ }
  async renderGif() { /* returns Blob via gifenc Worker */ }
  async renderVideo() { /* returns Blob via MediaRecorder, WebM */ }
  cancel() { this.cancelled = true; }
  getProgress() { return this.progress; }
}
// FfmpegWorkerRenderer planned for v2 — same interface

// ══════════════════════════════════════════
// RENDER GIF STUDIO
// ══════════════════════════════════════════
async function renderGifStudio() {
  setContent(`
  <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
    <div>
      <h3 style="font-size:16px;font-weight:900;margin:0">✨ GIF Studio</h3>
      <div style="font-size:12px;color:var(--text3)">Brief → Storyboard → Animate → Export GIF + WebM</div>
    </div>
    <button class="mkt-btn mkt-btn-ghost" onclick="gsShowLibrary()" style="font-size:12px">📚 Library</button>
  </div>

  <div style="display:grid;gap:16px">

    <!-- BRIEF -->
    <div class="mkt-card">
      <div class="mkt-card-title">📝 What's this GIF about?</div>
      <textarea id="gs-brief" class="mkt-form-input" rows="4" style="font-size:13px;line-height:1.7;resize:vertical"
        placeholder="Write freely — product, offer, festival, story. Example: New Kajaria tiles just arrived — wood finish, marble look, anti-skid. Great for bathrooms and kitchens."></textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">
        <div style="display:flex;gap:6px;align-items:center">
          <label style="font-size:12px;color:var(--text3)">Tone:</label>
          <select id="gs-tone" class="mkt-form-select" style="font-size:12px;padding:5px 8px">
            <option value="product">Product Launch</option>
            <option value="offer">Offer / Sale</option>
            <option value="festival">Festival</option>
            <option value="educational">Educational</option>
            <option value="contractor">Contractor Club</option>
          </select>
        </div>
        <button class="mkt-btn mkt-btn-primary" onclick="gsGenerateBrief()" style="font-size:13px;font-weight:800;padding:9px 20px">
          ✨ Generate Storyboard
        </button>
        <div id="gs-brief-loading" style="display:none;font-size:12px;color:var(--gold)">⏳ AI writing storyboard…</div>
      </div>
    </div>

    <!-- STORYBOARD + SETTINGS — hidden until generated -->
    <div id="gs-storyboard-section" style="display:none;display:grid;gap:12px">

      <!-- CONTENT FIELDS -->
      <div class="mkt-card">
        <div class="mkt-card-title">📌 Content</div>
        <div style="display:grid;gap:10px">
          ${[
            { id:'gs-out-topic', label:'Topic', single:true },
            { id:'gs-out-headline', label:'Headline (appears on GIF)', single:true },
            { id:'gs-out-message', label:'Supporting Message (8–12 words)', single:true },
          ].map(f=>`
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${f.label}</label>
              <button class="mkt-btn mkt-btn-ghost" onclick="gsCopy('${f.id}')" style="font-size:10px;padding:2px 8px">📋</button>
            </div>
            <input id="${f.id}" class="mkt-form-input" style="font-size:13px;font-weight:700" placeholder="AI will generate…">
          </div>`).join('')}
          ${[
            { id:'gs-out-caption-en', label:'Caption (English)', rows:4 },
            { id:'gs-out-caption-te', label:'Caption (Telugu)', rows:3 },
            { id:'gs-out-hashtags', label:'Hashtags', rows:2 },
            { id:'gs-out-keywords', label:'SEO Keywords', rows:2 },
          ].map(f=>`
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${f.label}</label>
              <button class="mkt-btn mkt-btn-ghost" onclick="gsCopy('${f.id}')" style="font-size:10px;padding:2px 8px">📋</button>
            </div>
            <textarea id="${f.id}" class="mkt-form-input" rows="${f.rows}" style="font-size:12px;line-height:1.7;resize:vertical" placeholder="AI will generate…"></textarea>
          </div>`).join('')}
        </div>
      </div>

      <!-- GIF SETTINGS -->
      <div class="mkt-card">
        <div class="mkt-card-title">⚙️ GIF Settings</div>
        <div style="display:grid;gap:14px">

          <!-- Mode -->
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">Mode</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <label style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:2px solid var(--gold);border-radius:8px;padding:10px 12px;cursor:pointer">
                <input type="radio" name="gs-mode" value="animated_text" checked style="margin-top:2px;accent-color:var(--gold)">
                <div>
                  <div style="font-size:12px;font-weight:700">🎬 Animated Text</div>
                  <div style="font-size:10px;color:var(--text3)">Text animates over a photo background</div>
                </div>
              </label>
              <label style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer">
                <input type="radio" name="gs-mode" value="slideshow" style="margin-top:2px;accent-color:var(--gold)">
                <div>
                  <div style="font-size:12px;font-weight:700">🖼️ Slideshow</div>
                  <div style="font-size:10px;color:var(--text3)">Multiple frames fade/slide between them</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Animation Style -->
          <div id="gs-style-section">
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">Animation Style</label>
            <div style="display:grid;gap:6px">
              ${[
                { id:'cinematic', label:'🎞️ Cinematic', desc:'Logo fade → headline slide → gold line draw → message fade → CTA settle. Default for premium posts.', default:true },
                { id:'typewriter', label:'⌨️ Typewriter', desc:'Text types in character by character. Best for educational or informative posts.' },
                { id:'bold_reveal', label:'💥 Bold Reveal', desc:'Headline zooms in then settles. High energy — best for offers and sales.' },
              ].map(s=>`
              <label style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:${s.default?'2px solid var(--gold)':'1px solid var(--border)'};border-radius:8px;padding:10px 12px;cursor:pointer">
                <input type="radio" name="gs-style" value="${s.id}" ${s.default?'checked':''} style="margin-top:2px;accent-color:var(--gold)">
                <div>
                  <div style="font-size:12px;font-weight:700">${s.label}</div>
                  <div style="font-size:10px;color:var(--text3)">${s.desc}</div>
                </div>
              </label>`).join('')}
            </div>
          </div>

          <!-- Duration -->
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">Duration</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${[
                { id:'short', label:'Short', desc:'6s', sub:'Stories, Status' },
                { id:'medium', label:'Medium', desc:'12s', sub:'Facebook, GBP' },
                { id:'custom', label:'Custom', desc:'', sub:'3–30s' },
              ].map((d,i)=>`
              <label style="flex:1;min-width:90px;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg3);border:${i===0?'2px solid var(--gold)':'1px solid var(--border)'};border-radius:8px;padding:10px 8px;cursor:pointer;text-align:center" onclick="gsToggleDuration(this,'${d.id}')">
                <input type="radio" name="gs-duration" value="${d.id}" ${i===0?'checked':''} style="display:none">
                <div style="font-size:13px;font-weight:800">${d.label}</div>
                <div style="font-size:11px;color:var(--gold);font-weight:700">${d.desc}</div>
                <div style="font-size:10px;color:var(--text3)">${d.sub}</div>
              </label>`).join('')}
            </div>
            <div id="gs-custom-duration" style="display:none;margin-top:10px;display:flex;align-items:center;gap:8px">
              <input id="gs-custom-sec" type="number" class="mkt-form-input" value="10" min="3" max="30" style="width:80px">
              <span style="font-size:12px;color:var(--text3)">seconds (3–30)</span>
            </div>
          </div>

          <!-- Slideshow frames (shown only in slideshow mode) -->
          <div id="gs-frames-section" style="display:none">
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">Frames</label>
            <div id="gs-frames-list" style="display:grid;gap:8px"></div>
            <button class="mkt-btn mkt-btn-ghost" onclick="gsAddFrame()" style="font-size:12px;margin-top:8px;width:100%">+ Add Frame</button>
          </div>

          <!-- Output size -->
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">Output Size</label>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
              ${[
                { id:'square', label:'Square', size:'1080×1080', ch:'Instagram Feed, Threads', checked:true },
                { id:'story', label:'Story', size:'1080×1920', ch:'Instagram Story, WhatsApp' },
                { id:'portrait_feed', label:'Feed Portrait', size:'1080×1350', ch:'Instagram Feed' },
                { id:'landscape', label:'Landscape', size:'1920×1080', ch:'Facebook, YouTube' },
              ].map(s=>`
              <label style="display:flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer">
                <input type="checkbox" name="gs-size" value="${s.id}" ${s.checked?'checked':''} style="accent-color:var(--gold)">
                <div>
                  <div style="font-size:11px;font-weight:700">${s.label}</div>
                  <div style="font-size:10px;color:var(--gold)">${s.size}</div>
                  <div style="font-size:10px;color:var(--text3)">${s.ch}</div>
                </div>
              </label>`).join('')}
            </div>
          </div>

        </div>
      </div>

      <!-- BACKGROUND -->
      <div class="mkt-card">
        <div class="mkt-card-title">🖼️ Background</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <button class="mkt-btn mkt-btn-primary" onclick="gsGenerateBackground()" style="font-size:12px;padding:10px">
            🤖 AI Generate Background
          </button>
          <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('gs-bg-upload').click()" style="font-size:12px;padding:10px">
            📁 Upload Your Own
          </button>
          <input type="file" id="gs-bg-upload" accept="image/*" style="display:none" onchange="gsHandleBgUpload(this)">
        </div>
        <div id="gs-bg-preview" style="display:none;margin-top:8px">
          <img id="gs-bg-img" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover;display:block">
          <div style="font-size:11px;color:var(--text3);margin-top:4px" id="gs-bg-label"></div>
        </div>
        <div id="gs-bg-loading" style="display:none;font-size:12px;color:var(--gold);text-align:center;padding:16px">🤖 Generating background image…</div>
      </div>

      <!-- PREVIEW + RENDER -->
      <div class="mkt-card">
        <div class="mkt-card-title">▶️ Preview & Export</div>

        <!-- Canvas preview -->
        <div style="text-align:center;margin-bottom:12px">
          <canvas id="gs-canvas" width="540" height="540"
            style="border-radius:10px;max-width:100%;background:#111;display:block;margin:0 auto"></canvas>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button class="mkt-btn mkt-btn-ghost" onclick="gsPreviewAnimation()" style="font-size:12px;flex:1">
            ▶️ Preview Animation
          </button>
          <button class="mkt-btn mkt-btn-ghost" onclick="gsStopAnimation()" style="font-size:12px">
            ⏹ Stop
          </button>
        </div>

        <!-- Progress -->
        <div id="gs-render-progress" style="display:none;margin-bottom:12px">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px" id="gs-render-status">Rendering…</div>
          <div style="background:var(--bg3);border-radius:4px;height:6px;overflow:hidden">
            <div id="gs-render-bar" style="background:var(--gold);height:6px;width:0%;transition:width .3s"></div>
          </div>
          <button class="mkt-btn mkt-btn-ghost" onclick="gsCancelRender()" style="font-size:11px;margin-top:6px">✕ Cancel</button>
        </div>

        <!-- Export buttons -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="mkt-btn mkt-btn-primary" onclick="gsRenderGif()" style="font-size:13px;font-weight:800;padding:11px">
            ✨ Export GIF
          </button>
          <button class="mkt-btn mkt-btn-ghost" onclick="gsRenderVideo()" style="font-size:13px;padding:11px">
            🎬 Export WebM
          </button>
        </div>
        <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:6px">
          GIF — works everywhere incl. WhatsApp · WebM — best for Instagram/Facebook (browser codec, not guaranteed MP4)
        </div>

        <!-- Download links (shown after render) -->
        <div id="gs-download-links" style="display:none;margin-top:12px;display:grid;gap:8px"></div>

        <!-- Save -->
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <button class="mkt-btn mkt-btn-ghost" onclick="gsSaveCampaign()" style="font-size:12px;width:100%">
            💾 Save to Library
          </button>
        </div>
      </div>

    </div>

    <!-- LIBRARY -->
    <div id="gs-library" style="display:none" class="mkt-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="mkt-card-title" style="margin:0">📚 GIF Library</div>
        <button class="mkt-btn mkt-btn-ghost" onclick="document.getElementById('gs-library').style.display='none'" style="font-size:12px">✕</button>
      </div>
      <div id="gs-lib-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        <div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;grid-column:1/-1">Loading…</div>
      </div>
    </div>

  </div>`);

  // Init
  document.getElementById('gs-storyboard-section').style.display = 'none';
  document.getElementById('gs-download-links').style.display = 'none';

  // Mode toggle listener
  document.querySelectorAll('input[name="gs-mode"]').forEach(r => {
    r.addEventListener('change', () => {
      const isSlideshow = r.value === 'slideshow';
      document.getElementById('gs-frames-section').style.display = isSlideshow ? 'block' : 'none';
      document.getElementById('gs-style-section').style.display = isSlideshow ? 'none' : 'block';
      if (isSlideshow && !document.getElementById('gs-frames-list').children.length) gsInitDefaultFrames();
    });
  });

  gsLoadLibraryInBackground();
}

// ── BRIEF GENERATION ──
async function gsGenerateBrief() {
  const brief = (document.getElementById('gs-brief')?.value || '').trim();
  const tone = document.getElementById('gs-tone')?.value || 'product';
  if (!brief) { showMktToast('Please write your brief first'); return; }
  document.getElementById('gs-brief-loading').style.display = '';
  document.getElementById('gs-storyboard-section').style.display = 'none';
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/content-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({ action: 'generate_brief', brief, tone })
    });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || 'Generation failed');
    const c = d.content;
    document.getElementById('gs-out-topic').value = c.topic || '';
    document.getElementById('gs-out-headline').value = c.headline || '';
    document.getElementById('gs-out-message').value = c.poster_message || '';
    document.getElementById('gs-out-caption-en').value = c.caption_en || '';
    document.getElementById('gs-out-caption-te').value = c.caption_te || '';
    document.getElementById('gs-out-hashtags').value = c.hashtags || '';
    document.getElementById('gs-out-keywords').value = c.seo_keywords || '';
    // Auto-populate default frames for slideshow
    gsInitDefaultFrames(c);
    document.getElementById('gs-storyboard-section').style.display = 'grid';
    document.getElementById('gs-storyboard-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch(e) {
    showMktToast('❌ ' + e.message);
  } finally {
    document.getElementById('gs-brief-loading').style.display = 'none';
  }
}

// ── SLIDESHOW FRAME MANAGEMENT ──
let gsFrames = [];
function gsInitDefaultFrames(content) {
  const headline = content?.headline || document.getElementById('gs-out-headline')?.value || 'V Wholesale';
  const message = content?.poster_message || document.getElementById('gs-out-message')?.value || '';
  gsFrames = [
    { id: 1, type: 'hook',    headline: headline,      body: 'Discover premium quality', duration: 2.5 },
    { id: 2, type: 'product', headline: 'Our Collection', body: message,                  duration: 2.5 },
    { id: 3, type: 'offer',   headline: 'Best Prices',   body: 'Vijayawada\'s #1 choice', duration: 2.0 },
    { id: 4, type: 'cta',     headline: 'Visit Us Today', body: '+91 8712697930 | vwholesale.in', duration: 2.0 },
  ];
  gsRenderFrameList();
}
function gsRenderFrameList() {
  const list = document.getElementById('gs-frames-list');
  if (!list) return;
  list.innerHTML = gsFrames.map((f, i) => `
  <div style="background:var(--bg3);border-radius:8px;padding:10px 12px;border:1px solid var(--border);display:flex;gap:8px;align-items:flex-start">
    <div style="font-size:18px;flex-shrink:0;padding-top:2px">${{hook:'🎣',product:'🖼',offer:'💰',cta:'📞'}[f.type]||'📄'}</div>
    <div style="flex:1;display:grid;gap:6px">
      <div style="display:flex;gap:6px">
        <input value="${f.headline}" placeholder="Headline" class="mkt-form-input" style="font-size:12px;font-weight:700;flex:1"
          oninput="gsFrames[${i}].headline=this.value">
        <input value="${f.duration}" type="number" min="0.5" max="10" step="0.5" class="mkt-form-input" style="width:60px;font-size:12px"
          oninput="gsFrames[${i}].duration=parseFloat(this.value)">
        <span style="font-size:11px;color:var(--text3);padding-top:7px">s</span>
      </div>
      <input value="${f.body}" placeholder="Body text" class="mkt-form-input" style="font-size:12px"
        oninput="gsFrames[${i}].body=this.value">
    </div>
    <button onclick="gsRemoveFrame(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px 4px;flex-shrink:0">🗑</button>
  </div>`).join('');
}
function gsAddFrame() {
  gsFrames.push({ id: Date.now(), type: 'product', headline: '', body: '', duration: 2.5 });
  gsRenderFrameList();
}
function gsRemoveFrame(i) {
  gsFrames.splice(i, 1);
  gsRenderFrameList();
}

// ── DURATION TOGGLE ──
function gsToggleDuration(label, id) {
  document.querySelectorAll('label[onclick*="gsToggleDuration"]').forEach(l => {
    l.style.border = '1px solid var(--border)';
    l.querySelector('input').checked = false;
  });
  label.style.border = '2px solid var(--gold)';
  label.querySelector('input').checked = true;
  document.getElementById('gs-custom-duration').style.display = id === 'custom' ? 'flex' : 'none';
}
function gsGetDurationSec() {
  const dur = document.querySelector('input[name="gs-duration"]:checked')?.value || 'short';
  if (dur === 'short') return 6;
  if (dur === 'medium') return 12;
  const custom = parseFloat(document.getElementById('gs-custom-sec')?.value || '10');
  return Math.min(30, Math.max(3, custom));
}

// ── BACKGROUND GENERATION ──
// Generate 3 full AI poster frames via generate-poster-v2 (same as calendar pipeline)
// Stores frames as b64 images to animate between
async function gsGenerateBackground() {
  const topic = (document.getElementById('gs-out-topic')?.value || document.getElementById('gs-brief')?.value || '').trim();
  const headline = document.getElementById('gs-out-headline')?.value?.trim() || topic;
  const message = document.getElementById('gs-out-message')?.value?.trim() || '';

  if (!topic) { showMktToast('Generate storyboard first to get topic and headline'); return; }

  const loading = document.getElementById('gs-bg-loading');
  const preview = document.getElementById('gs-bg-preview');
  loading.style.display = 'block';
  preview.style.display = 'none';
  loading.textContent = '🤖 Generating 3 AI poster frames via gpt-image-2… (~90 seconds)';

  try {
    // Use content-pipeline generate_poster_image for each frame
    const t = topic.toLowerCase();
    const scheme = t.includes('granite') || t.includes('tile') || t.includes('marble')
      ? 'elegant cream and charcoal with natural stone textures and warm wood tones'
      : t.includes('paint') ? 'warm terracotta and sage green'
      : t.includes('bathroom') || t.includes('sanitaryware') ? 'clean white and chrome with soft spa lighting'
      : 'warm professional cream and charcoal';

    const prompts = [
      // Frame 1: Brand/opening — clean with negative space for text
      `Design a complete premium marketing poster for V Wholesale. Color: ${scheme}. Style: real Indian lifestyle interior photography, editorial quality. Elements: "V Wholesale" at top with tagline "Build Better. Pay Less." Bold headline: "${headline}" Indian home lifestyle for: ${topic}. Message: "${message}" Category strip: Tiles|Granite|Sanitaryware|Paints|Plywood|Furniture Footer: +91 8712697930|vwholesale.in|Visit V Wholesale. Square format. All text correct. No watermark.`,
      // Frame 2: Hero product shot
      `Design a premium product-focused marketing poster for V Wholesale. Color: ${scheme}. Editorial quality Indian interior with ${topic} as hero. Headline: "${headline}" Supporting: "${message}" V Wholesale branding top. Footer: +91 8712697930|vwholesale.in|Visit V Wholesale. Square format.`,
      // Frame 3: CTA closing
      `Design a premium CTA closing poster for V Wholesale. Color: ${scheme}. Clean premium Indian home lifestyle. "Visit V Wholesale today" as main call to action. "+91 8712697930 | vwholesale.in" prominent. "Build Better. Pay Less." tagline. Category strip: Tiles|Granite|Sanitaryware|Paints|Plywood|Furniture. Square format. Premium finish.`
    ];

    const frames = [];
    for (let i = 0; i < prompts.length; i++) {
      loading.textContent = `🤖 Generating frame ${i+1}/3… (~30s each)`;
      const res = await fetch(MKT_SB_URL + '/functions/v1/content-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
        body: JSON.stringify({ action: 'generate_poster_image', prompt: prompts[i], size: '1024x1024' })
      });
      const d = await res.json();
      if (d.ok && d.b64) frames.push(d.b64);
      else console.log(`Frame ${i+1} failed:`, d.error);
    }

    if (!frames.length) throw new Error('All frame generation failed');

    // Store all frames
    window._gsFrameB64s = frames;
    window._gsFrameImgCache = {}; // clear cache
    window._gsBgB64 = frames[0];

    // Show first frame preview
    document.getElementById('gs-bg-img').src = 'data:image/png;base64,' + frames[0];
    document.getElementById('gs-bg-label').textContent = `✅ ${frames.length}/3 AI poster frames generated — click Preview Animation to see slideshow`;
    preview.style.display = 'block';

    // Auto-populate slideshow frames from AI output
    gsFrames = frames.map((b64, i) => ({
      id: i+1,
      type: ['hook','product','cta'][i],
      headline: [headline, headline, 'Visit V Wholesale Today'][i],
      body: [message, message, '+91 8712697930 | vwholesale.in'][i],
      duration: [2.5, 3.0, 2.5][i],
      b64
    }));
    gsRenderFrameList();

    showMktToast(`✅ ${frames.length} AI poster frames ready — click ▶️ Preview Animation`);
  } catch(e) {
    showMktToast('❌ ' + e.message);
  } finally {
    loading.style.display = 'none';
  }
}
function gsHandleBgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._gsBgB64 = e.target.result.split(',')[1];
    document.getElementById('gs-bg-img').src = e.target.result;
    document.getElementById('gs-bg-label').textContent = `Uploaded: ${file.name}`;
    document.getElementById('gs-bg-preview').style.display = 'block';
    showMktToast('✅ Background uploaded');
  };
  reader.readAsDataURL(file);
}

// ── CANVAS ANIMATION ENGINE ──
let gsAnimFrame = null;
let gsAnimRenderer = null;

function gsGetCanvas() { return document.getElementById('gs-canvas'); }

function gsSetCanvasSize(sizeKey) {
  const canvas = gsGetCanvas();
  const sizes = { square:1080, story:1080, portrait_feed:1080, landscape:1920 };
  const heights = { square:1080, story:1920, portrait_feed:1350, landscape:1080 };
  // Scale to fit preview (max 540px wide)
  const selectedSize = document.querySelector('input[name="gs-size"]:checked')?.value || 'square';
  const scale = 540 / sizes[selectedSize];
  canvas.width = sizes[selectedSize] * scale;
  canvas.height = heights[selectedSize] * scale;
  canvas.dataset.scale = scale;
  canvas.dataset.realW = sizes[selectedSize];
  canvas.dataset.realH = heights[selectedSize];
}

// Draw a frame — if AI poster frames exist, display them directly with crossfade
// Falls back to canvas text overlay if no AI frames available
function gsDrawFrame(ctx, w, h, bgImg, frameCfg, progress) {
  const mode = document.querySelector('input[name="gs-mode"]:checked')?.value || 'animated_text';
  const aiFrames = window._gsFrameB64s || [];

  // If we have AI poster frames, use them directly (highest quality)
  if (aiFrames.length > 0 && frameCfg?.b64) {
    const img = window._gsFrameImgCache = window._gsFrameImgCache || {};
    const key = frameCfg.b64.slice(0, 20);
    if (!img[key]) {
      const i = new Image();
      i.src = 'data:image/png;base64,' + frameCfg.b64;
      img[key] = i;
    }
    const frameImg = img[key];
    if (frameImg.complete && frameImg.naturalWidth > 0) {
      // Draw the full AI poster frame
      ctx.drawImage(frameImg, 0, 0, w, h);
      // Fade in/out at transitions
      const fadeIn = Math.min(1, progress * 8);   // fade in over first 0.125
      const fadeOut = Math.min(1, (1 - progress) * 8); // fade out last 0.125
      const alpha = Math.min(fadeIn, fadeOut);
      if (alpha < 1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }

  // Fallback: canvas text overlay on background image
  const GOLD = '#C9A84C';
  const scale = w / 1080;
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(17,17,17,0.88)');
    grad.addColorStop(0.5, 'rgba(17,17,17,0.55)');
    grad.addColorStop(1, 'rgba(17,17,17,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);
  }
  const headline = frameCfg?.headline || document.getElementById('gs-out-headline')?.value || 'V Wholesale';
  const message = frameCfg?.body || document.getElementById('gs-out-message')?.value || '';
  const m = Math.round(55 * scale);
  const style = document.querySelector('input[name="gs-style"]:checked')?.value || 'cinematic';
  if (mode === 'animated_text') {
    gsCinematicFrame(ctx, w, h, scale, m, GOLD, progress, headline, message, style);
  } else {
    gsSlideshowFrame(ctx, w, h, scale, m, GOLD, progress, frameCfg);
  }
  // Footer
  const fH = Math.round(h * 0.09);
  const fY = h - fH;
  ctx.fillStyle = '#F5F0E8';
  ctx.fillRect(0, fY, w, fH);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, fY, w, 2);
  ctx.fillStyle = '#1a1a18';
  ctx.font = `bold ${Math.round(fH * 0.28)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('+91 8712697930  |  vwholesale.in  |  Visit V Wholesale', w / 2, fY + fH * 0.65);
  ctx.textAlign = 'left';
}

function gsCinematicFrame(ctx, w, h, scale, m, GOLD, t, headline, message, style) {
  // Cinematic sequence:
  // 0.0–0.15: Logo fades in
  // 0.15–0.40: Headline slides in from left
  // 0.40–0.55: Gold line draws
  // 0.55–0.75: Message fades in
  // 0.75–0.90: Category cue
  // 0.90–1.00: CTA settle

  const ease = x => 1 - Math.pow(1 - x, 3); // ease-out cubic

  // Logo area (top)
  const headerH = Math.round(h * 0.13);
  const logoAlpha = t < 0.05 ? 0 : t < 0.18 ? ease((t - 0.05) / 0.13) : 1;
  ctx.globalAlpha = logoAlpha;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(22 * scale)}px Arial`;
  ctx.fillText('V WHOLESALE', m, headerH * 0.55);
  ctx.font = `${Math.round(11 * scale)}px Arial`;
  ctx.fillStyle = GOLD;
  ctx.fillText('BUILD BETTER. PAY LESS.', m + 2, headerH * 0.75);
  ctx.globalAlpha = 1;

  // Header rule
  if (logoAlpha > 0.5) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2 * scale;
    ctx.globalAlpha = logoAlpha;
    ctx.beginPath(); ctx.moveTo(0, headerH); ctx.lineTo(w, headerH); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const hlY = Math.round(h * 0.32);
  const hlSize = Math.round(64 * scale);

  if (style === 'typewriter') {
    // Typewriter: type headline character by character
    const typeProgress = t < 0.15 ? 0 : t < 0.55 ? ease((t - 0.15) / 0.40) : 1;
    const chars = Math.floor(typeProgress * headline.length);
    const displayText = headline.slice(0, chars) + (chars < headline.length && t < 0.55 ? '|' : '');
    ctx.fillStyle = '#F5F0E8';
    ctx.font = `bold ${hlSize}px Georgia, serif`;
    ctx.fillText(displayText, m, hlY);
  } else if (style === 'bold_reveal') {
    // Bold reveal: zoom in then settle
    const zoomT = t < 0.15 ? 0 : t < 0.45 ? ease((t - 0.15) / 0.30) : 1;
    const zoom = zoomT < 0.7 ? 1 + (1 - zoomT / 0.7) * 0.4 : 1; // zoom 1.4 → 1.0
    const alpha = t < 0.15 ? 0 : t < 0.35 ? ease((t - 0.15) / 0.20) : 1;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(m, hlY);
    ctx.scale(zoom, zoom);
    ctx.fillStyle = '#F5F0E8';
    ctx.font = `bold ${hlSize}px Georgia, serif`;
    ctx.fillText(headline, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  } else {
    // Cinematic: slide in from left
    const slideT = t < 0.15 ? 0 : t < 0.42 ? ease((t - 0.15) / 0.27) : 1;
    const offsetX = (1 - slideT) * -80 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hlY - hlSize - 10, w, hlSize * 2.5 + 20);
    ctx.clip();
    ctx.globalAlpha = slideT;
    ctx.fillStyle = '#F5F0E8';
    ctx.font = `bold ${hlSize}px Georgia, serif`;
    ctx.fillText(headline, m + offsetX, hlY);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Gold divider line draws
  const lineT = t < 0.40 ? 0 : t < 0.57 ? ease((t - 0.40) / 0.17) : 1;
  if (lineT > 0) {
    const lineY = hlY + Math.round(hlSize * 0.4);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5 * scale;
    ctx.globalAlpha = lineT;
    ctx.beginPath();
    ctx.moveTo(m, lineY);
    ctx.lineTo(m + Math.round(w * 0.24 * lineT), lineY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Message fades in
  const msgAlpha = t < 0.55 ? 0 : t < 0.78 ? ease((t - 0.55) / 0.23) : 1;
  if (msgAlpha > 0) {
    ctx.globalAlpha = msgAlpha * 0.94;
    ctx.fillStyle = '#F5F0E8';
    ctx.font = `${Math.round(24 * scale)}px Arial`;
    ctx.fillText(message, m, hlY + Math.round(hlSize * 0.8));
    ctx.globalAlpha = 1;
  }

  // Category labels appear
  const catAlpha = t < 0.75 ? 0 : t < 0.90 ? ease((t - 0.75) / 0.15) : 1;
  if (catAlpha > 0) {
    const cats = ['Tiles', 'Granite', 'Sanitaryware', 'Paints', 'Plywood', 'Furniture'];
    const stripY = h - Math.round(h * 0.09) - Math.round(h * 0.12);
    const catW = w / cats.length;
    ctx.fillStyle = '#111110';
    ctx.globalAlpha = catAlpha;
    ctx.fillRect(0, stripY, w, Math.round(h * 0.12));
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath(); ctx.moveTo(0, stripY); ctx.lineTo(w, stripY); ctx.stroke();
    cats.forEach((cat, i) => {
      const cx = catW * i + catW / 2;
      if (i > 0) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = scale;
        ctx.globalAlpha = catAlpha * 0.35;
        ctx.beginPath();
        ctx.moveTo(catW * i, stripY + h * 0.025);
        ctx.lineTo(catW * i, stripY + h * 0.095);
        ctx.stroke();
        ctx.globalAlpha = catAlpha;
      }
      ctx.fillStyle = '#F5F0E8';
      ctx.font = `bold ${Math.round(14 * scale)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(cat, cx, stripY + Math.round(h * 0.08));
      ctx.textAlign = 'left';
    });
    ctx.globalAlpha = 1;
  }
}

function gsSlideshowFrame(ctx, w, h, scale, m, GOLD, t, frame) {
  if (!frame) return;
  const hlSize = Math.round(60 * scale);
  const centerY = h * 0.42;
  // Fade in over first 0.3, stable, fade out last 0.2
  const alpha = t < 0.3 ? t / 0.3 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#F5F0E8';
  ctx.font = `bold ${hlSize}px Georgia, serif`;
  ctx.fillText(frame.headline || '', m, centerY);
  ctx.font = `${Math.round(26 * scale)}px Arial`;
  ctx.fillStyle = '#F5F0E8';
  ctx.fillText(frame.body || '', m, centerY + Math.round(hlSize * 0.8));
  // Gold line
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.moveTo(m, centerY + Math.round(hlSize * 0.2));
  ctx.lineTo(m + Math.round(w * 0.22), centerY + Math.round(hlSize * 0.2));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ── ANIMATION LOOP ──
async function gsLoadBgImage() {
  const b64 = window._gsBgB64;
  if (!b64) return null;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/png;base64,' + b64;
  });
}

async function gsPreviewAnimation() {
  gsStopAnimation();
  gsSetCanvasSize();
  const canvas = gsGetCanvas();
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const bgImg = await gsLoadBgImage();
  const totalSec = gsGetDurationSec();
  const mode = document.querySelector('input[name="gs-mode"]:checked')?.value || 'animated_text';
  const startTime = performance.now();

  function loop() {
    const elapsed = (performance.now() - startTime) / 1000;
    const progress = (elapsed % totalSec) / totalSec; // loops

    let frameCfg = null;
    const frames = gsFrames.length ? gsFrames : [];
    if (frames.length) {
      const frameDurs = frames.map(f => f.duration || 2.5);
      const totalFrameTime = frameDurs.reduce((a, b) => a + b, 0);
      const t = (elapsed % totalFrameTime);
      let acc = 0;
      for (let i = 0; i < frames.length; i++) {
        if (t < acc + frameDurs[i]) {
          const localT = (t - acc) / frameDurs[i];
          frameCfg = { ...frames[i], _localT: localT };
          break;
        }
        acc += frameDurs[i];
      }
    }

    ctx.clearRect(0, 0, w, h);
    // Use _localT as progress for both modes when we have frames
    gsDrawFrame(ctx, w, h, bgImg, frameCfg, frameCfg?._localT ?? progress);
    gsAnimFrame = requestAnimationFrame(loop);
  }
  loop();
  showMktToast('▶️ Previewing animation — click Stop to cancel');
}

function gsStopAnimation() {
  if (gsAnimFrame) { cancelAnimationFrame(gsAnimFrame); gsAnimFrame = null; }
}

// ── GIF EXPORT (gifenc via inline worker) ──
let gsRenderCancelled = false;

function gsShowProgress(label) {
  document.getElementById('gs-render-progress').style.display = 'block';
  document.getElementById('gs-render-status').textContent = label;
  document.getElementById('gs-render-bar').style.width = '0%';
}
function gsUpdateProgress(pct, label) {
  document.getElementById('gs-render-bar').style.width = pct + '%';
  if (label) document.getElementById('gs-render-status').textContent = label;
}
function gsHideProgress() {
  document.getElementById('gs-render-progress').style.display = 'none';
}
function gsCancelRender() {
  gsRenderCancelled = true;
  gsStopAnimation();
  gsHideProgress();
  showMktToast('Render cancelled');
}

async function gsRenderGif() {
  gsStopAnimation();
  gsRenderCancelled = false;
  const totalSec = gsGetDurationSec();
  const fps = 15; // balance quality vs file size
  const totalFrames = Math.round(totalSec * fps);
  const delay = Math.round(1000 / fps); // ms per frame

  gsSetCanvasSize();
  const canvas = gsGetCanvas();
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const bgImg = await gsLoadBgImage();
  const mode = document.querySelector('input[name="gs-mode"]:checked')?.value || 'animated_text';

  gsShowProgress(`⏳ Rendering ${totalFrames} frames for GIF…`);

  // Collect pixel data frames
  const renderedFrames = [];
  const frames = gsFrames.length ? gsFrames : [];
  for (let i = 0; i < totalFrames; i++) {
    if (gsRenderCancelled) return;
    const t = i / totalFrames;
    let frameCfg = null;
    if (frames.length) {
      const totalFrameTime = frames.reduce((a, f) => a + (f.duration || 2.5), 0);
      const elapsed = t * totalSec;
      const frameT = (elapsed % totalFrameTime);
      let acc = 0;
      for (const f of frames) {
        if (frameT < acc + (f.duration || 2.5)) {
          frameCfg = { ...f, _localT: (frameT - acc) / (f.duration || 2.5) };
          break;
        }
        acc += (f.duration || 2.5);
      }
    }
    ctx.clearRect(0, 0, w, h);
    gsDrawFrame(ctx, w, h, bgImg, frameCfg, frameCfg?._localT ?? t);
    renderedFrames.push({ data: ctx.getImageData(0, 0, w, h), delay });
    gsUpdateProgress(Math.round((i / totalFrames) * 60), `Rendering frame ${i + 1}/${totalFrames}…`);
    await new Promise(r => setTimeout(r, 0)); // yield to UI
  }

  gsUpdateProgress(65, 'Encoding GIF (this may take a moment)…');

  // Encode GIF using gifenc loaded from CDN via Worker
  let gifencSrc;
  try {
    const _r = await fetch('/assets/gifenc-worker.js');
    if (!_r.ok) throw new Error('HTTP ' + _r.status);
    gifencSrc = await _r.text();
  } catch(e) {
    throw new Error('Failed to load GIF encoder: ' + e.message);
  }
  const _wfn = 'self.onmessage=function(e){var f=e.data.frames,w=e.data.width,h=e.data.height,g=GIFEncoder();f.forEach(function(fr,i){var d=new Uint8ClampedArray(fr.data),p=quantize(d,256),ix=applyPalette(d,p);g.writeFrame(ix,w,h,{palette:p,delay:fr.delay,dispose:2});if(i%5===0)self.postMessage({type:"progress",pct:65+Math.round(i/f.length*30)});});g.finish();var b=g.bytes();self.postMessage({type:"done",buffer:b.buffer},[b.buffer]);};';
    const _wfn2 = 'self.onmessage=function(e){var f=e.data.frames,w=e.data.width,h=e.data.height,g=GIFEncoder();f.forEach(function(fr,i){var d=new Uint8ClampedArray(fr.data),p=quantize(d,256),ix=applyPalette(d,p);g.writeFrame(ix,w,h,{palette:p,delay:fr.delay,dispose:2});if(i%5===0)self.postMessage({type:"progress",pct:65+Math.round(i/f.length*30)});});g.finish();var b=g.bytes();self.postMessage({type:"done",buffer:b.buffer},[b.buffer]);};';
  const workerCode = gifencSrc + '\n' + _wfn2;
  const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(workerBlob);
  const worker = new Worker(workerUrl);

  const frameData = renderedFrames.map(f => ({ data: Array.from(f.data.data), delay: f.delay }));

  await new Promise((resolve, reject) => {
    worker.onmessage = async e => {
      if (e.data.type === 'progress') {
        gsUpdateProgress(e.data.pct, 'Encoding GIF…');
      } else if (e.data.type === 'done') {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        gsUpdateProgress(97, 'Uploading…');
        const blob = new Blob([e.data.buffer], { type: 'image/gif' });
        await gsHandleExportDone(blob, 'gif', 'image/gif');
        resolve();
      }
    };
    worker.onerror = e => { worker.terminate(); reject(new Error(e.message)); };
    worker.postMessage({ frames: frameData, width: w, height: h });
  }).catch(e => {
    showMktToast('❌ GIF encoding failed: ' + e.message);
    gsHideProgress();
  });
}

// ── WebM EXPORT (MediaRecorder) ──
async function gsRenderVideo() {
  gsStopAnimation();
  gsRenderCancelled = false;

  // Detect supported MIME type — never assume MP4
  const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m));
  if (!mimeType) {
    showMktToast('❌ MediaRecorder not supported in this browser');
    return;
  }
  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
  console.log('[GIF Studio] Recording as:', mimeType);

  gsSetCanvasSize();
  const canvas = gsGetCanvas();
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const bgImg = await gsLoadBgImage();
  const totalSec = gsGetDurationSec();
  const mode = document.querySelector('input[name="gs-mode"]:checked')?.value || 'animated_text';

  gsShowProgress(`🎬 Recording ${ext.toUpperCase()} (${totalSec}s)…`);

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const startTime = performance.now();
  recorder.start();

  await new Promise(resolve => {
    function loop() {
      if (gsRenderCancelled) { recorder.stop(); resolve(); return; }
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed >= totalSec) { recorder.stop(); resolve(); return; }
      const t = elapsed / totalSec;
      let frameCfg = null;
      if (mode === 'slideshow' && gsFrames.length) {
        const totalFT = gsFrames.reduce((a, f) => a + (f.duration || 2.5), 0);
        const ft = (elapsed % totalFT);
        let acc = 0;
        for (const f of gsFrames) {
          if (ft < acc + (f.duration || 2.5)) { frameCfg = { ...f, _localT: (ft - acc) / (f.duration || 2.5) }; break; }
          acc += (f.duration || 2.5);
        }
      }
      ctx.clearRect(0, 0, w, h);
      gsDrawFrame(ctx, w, h, bgImg, frameCfg, mode === 'animated_text' ? t : frameCfg?._localT || 0);
      gsUpdateProgress(Math.round((elapsed / totalSec) * 90), `Recording ${ext.toUpperCase()}: ${elapsed.toFixed(1)}s / ${totalSec}s`);
      requestAnimationFrame(loop);
    }
    loop();
  });

  gsUpdateProgress(92, 'Finalising…');
  await new Promise(r => setTimeout(r, 500));
  const blob = new Blob(chunks, { type: mimeType });
  await gsHandleExportDone(blob, ext, mimeType);
}

// ── HANDLE EXPORT DONE ──
async function gsHandleExportDone(blob, ext, mimeType) {
  gsUpdateProgress(98, 'Saving…');
  const topic = document.getElementById('gs-out-topic')?.value?.trim() || 'vwholesale';
  const filename = `vwholesale_gif_${Date.now()}.${ext}`;

  // Upload to Supabase
  let publicUrl = null;
  try {
    const arr = await blob.arrayBuffer();
    const bytes = new Uint8Array(arr);
    const path = `gif-studio/${filename}`;
    const { error } = await sb.storage.from('calendar-images').upload(path, bytes, { contentType: mimeType, upsert: true });
    if (!error) {
      const { data: pub } = sb.storage.from('calendar-images').getPublicUrl(path);
      publicUrl = pub.publicUrl;
    }
  } catch(e) { console.log('[GIF Studio] upload error:', e); }

  // Offer download
  const blobUrl = URL.createObjectURL(blob);
  const links = document.getElementById('gs-download-links');
  links.style.display = 'grid';
  links.innerHTML = `
    <div style="background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:12px">
      <div style="font-size:12px;font-weight:700;color:#22c55e;margin-bottom:8px">✅ ${ext.toUpperCase()} ready (${(blob.size/1024).toFixed(0)} KB) — ${mimeType}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="${blobUrl}" download="${filename}" class="mkt-btn mkt-btn-primary" style="font-size:12px;padding:7px 14px;text-decoration:none">
          ⬇ Download ${ext.toUpperCase()}
        </a>
        ${publicUrl ? `<a href="${publicUrl}" target="_blank" class="mkt-btn mkt-btn-ghost" style="font-size:12px;padding:7px 14px;text-decoration:none">🔗 View URL</a>` : ''}
      </div>
      ${ext !== 'mp4' && mimeType.includes('webm') ? '<div style="font-size:10px;color:var(--text3);margin-top:6px">WebM file — not MP4. Browser codec varies. Convert with HandBrake or FFmpeg for social upload.</div>' : ''}
    </div>`;

  gsHideProgress();
  showMktToast(`✅ ${ext.toUpperCase()} exported successfully`);
}

// ── SAVE CAMPAIGN ──
async function gsSaveCampaign() {
  const topic = document.getElementById('gs-out-topic')?.value?.trim() || '';
  const headline = document.getElementById('gs-out-headline')?.value?.trim() || '';
  const caption = document.getElementById('gs-out-caption-en')?.value?.trim() || '';
  const mode = document.querySelector('input[name="gs-mode"]:checked')?.value || 'animated_text';
  const style = document.querySelector('input[name="gs-style"]:checked')?.value || 'cinematic';
  const duration = gsGetDurationSec();

  await sb.from('poster_history').insert({
    topic: topic || 'GIF Campaign',
    template: `gif_${mode}`,
    language: 'en',
    caption,
    image_url: null,
    status: 'draft',
    metadata: { headline, mode, style, duration, frames: gsFrames, background_b64: window._gsBgB64 ? 'stored' : null }
  }).then(() => {}, () => {});
  showMktToast('💾 Campaign saved to library');
  gsLoadLibraryInBackground();
}

// ── LIBRARY ──
function gsShowLibrary() {
  const lib = document.getElementById('gs-library');
  if (!lib) return;
  lib.style.display = lib.style.display === 'none' ? 'block' : 'none';
  if (lib.style.display === 'block') gsLoadLibraryInBackground();
}
async function gsLoadLibraryInBackground() {
  const grid = document.getElementById('gs-lib-grid');
  if (!grid) return;
  const { data: history } = await sb.from('poster_history').select('*')
    .like('template', 'gif_%')
    .order('created_at', { ascending: false })
    .limit(20)
    .then(r => r, () => ({ data: [] }));
  if (!history?.length) {
    grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;grid-column:1/-1">No GIF campaigns saved yet</div>';
    return;
  }
  grid.innerHTML = history.map(h => `
    <div style="background:var(--bg3);border-radius:10px;overflow:hidden;border:1px solid var(--border)">
      <div style="width:100%;aspect-ratio:1;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:32px">✨</div>
      <div style="padding:8px">
        <div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">${h.topic||'—'}</div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px">${h.template||''} · ${new Date(h.created_at).toLocaleDateString('en-IN')}</div>
        <button onclick="gsDeleteHistory(${h.id})" style="font-size:10px;padding:3px 8px;background:none;border:1px solid var(--border);border-radius:5px;color:var(--text3);cursor:pointer">🗑 Delete</button>
      </div>
    </div>`).join('');
}
async function gsDeleteHistory(id) {
  if (!confirm('Delete this GIF campaign?')) return;
  await sb.from('poster_history').delete().eq('id', id);
  showMktToast('Deleted');
  gsLoadLibraryInBackground();
}

// ── UTILS ──
function gsCopy(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.value || el.textContent || '').then(() => showMktToast('📋 Copied!'));
}

window.renderGifStudio    = renderGifStudio;
window.gsGenerateBrief    = gsGenerateBrief;
window.gsAddFrame         = gsAddFrame;
window.gsRemoveFrame      = gsRemoveFrame;
window.gsToggleDuration   = gsToggleDuration;
window.gsGenerateBackground = gsGenerateBackground;
window.gsHandleBgUpload   = gsHandleBgUpload;
window.gsPreviewAnimation = gsPreviewAnimation;
window.gsStopAnimation    = gsStopAnimation;
window.gsRenderGif        = gsRenderGif;
window.gsRenderVideo      = gsRenderVideo;
window.gsCancelRender     = gsCancelRender;
window.gsSaveCampaign     = gsSaveCampaign;
window.gsShowLibrary      = gsShowLibrary;
window.gsDeleteHistory    = gsDeleteHistory;
window.gsCopy             = gsCopy;
