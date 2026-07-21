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
  window._studioCalendarId = null;
  window._studioMode = 'gif';

  setContent(`
  <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
    <div>
      <h3 style="font-size:16px;font-weight:900;margin:0">✨ GIF Studio</h3>
      <div style="font-size:12px;color:var(--text3)">Brief → GIF Settings → AI Poster → Animated GIF/MP4</div>
    </div>
    <button class="mkt-btn mkt-btn-ghost" onclick="gsShowLibrary()" style="font-size:12px">📚 Library</button>
  </div>
  <div style="display:grid;gap:16px">

    <!-- BRIEF -->
    <div class="mkt-card">
      <div class="mkt-card-title">📝 What\'s this GIF about?</div>
      <textarea id="gs-brief" class="mkt-form-input" rows="3" style="font-size:13px;line-height:1.7;resize:vertical"
        placeholder="Write freely — product, offer, festival. Example: Bell Sanitaryware complete set at ₹15,999 only at V Wholesale."></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
        <label style="font-size:12px;color:var(--text3)">Tone:</label>
        <select id="gs-tone" class="mkt-form-select" style="font-size:12px;padding:5px 8px">
          <option value="product">Product Launch</option>
          <option value="offer">Offer / Sale</option>
          <option value="festival">Festival</option>
          <option value="educational">Educational</option>
          <option value="contractor">Contractor Club</option>
        </select>
      </div>
    </div>

    <!-- GIF SETTINGS -->
    <div class="mkt-card">
      <div class="mkt-card-title">⚙️ GIF Settings</div>
      <div style="display:grid;gap:14px">

        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">MODE</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label id="lbl-mode-animated_text" style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:2px solid var(--gold);border-radius:8px;padding:10px 12px;cursor:pointer">
              <input type="radio" name="gs-mode" value="animated_text" checked style="margin-top:2px;accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">🎬 Animated Text</div><div style="font-size:10px;color:var(--text3)">Text animates over AI poster background</div></div>
            </label>
            <label id="lbl-mode-slideshow" style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer">
              <input type="radio" name="gs-mode" value="slideshow" style="margin-top:2px;accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">🖼️ Slideshow</div><div style="font-size:10px;color:var(--text3)">3 AI poster frames fade between them</div></div>
            </label>
          </div>
        </div>

        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">ANIMATION STYLE</label>
          <div style="display:grid;gap:6px">
            <label id="lbl-style-cinematic" style="display:flex;align-items:flex-start;gap:10px;background:var(--bg3);border:2px solid var(--gold);border-radius:8px;padding:10px 14px;cursor:pointer">
              <input type="radio" name="gs-style" value="cinematic" checked style="margin-top:3px;accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">🎬 Cinematic</div><div style="font-size:11px;color:var(--text3)">Logo fade → headline slide → gold line draw → message fade → CTA settle. Default for premium posts.</div></div>
            </label>
            <label id="lbl-style-typewriter" style="display:flex;align-items:flex-start;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px;cursor:pointer">
              <input type="radio" name="gs-style" value="typewriter" style="margin-top:3px;accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">🖊️ Typewriter</div><div style="font-size:11px;color:var(--text3)">Text types in character by character. Best for educational or informative posts.</div></div>
            </label>
            <label id="lbl-style-bold_reveal" style="display:flex;align-items:flex-start;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px;cursor:pointer">
              <input type="radio" name="gs-style" value="bold_reveal" style="margin-top:3px;accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">💥 Bold Reveal</div><div style="font-size:11px;color:var(--text3)">Headline zooms in then settles. High energy — best for offers and sales.</div></div>
            </label>
          </div>
        </div>

        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">DURATION</label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <label id="lbl-dur-6" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg3);border:2px solid var(--gold);border-radius:8px;padding:12px;cursor:pointer;text-align:center">
              <input type="radio" name="gs-duration" value="6" checked style="display:none">
              <div style="font-size:13px;font-weight:700">Short</div>
              <div style="font-size:13px;font-weight:900;color:var(--gold);margin:2px 0">6s</div>
              <div style="font-size:10px;color:var(--text3)">Stories, Status</div>
            </label>
            <label id="lbl-dur-12" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;text-align:center">
              <input type="radio" name="gs-duration" value="12" style="display:none">
              <div style="font-size:13px;font-weight:700">Medium</div>
              <div style="font-size:13px;font-weight:900;color:var(--gold);margin:2px 0">12s</div>
              <div style="font-size:10px;color:var(--text3)">Facebook, GBP</div>
            </label>
            <label id="lbl-dur-custom" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;text-align:center">
              <input type="radio" name="gs-duration" value="custom" style="display:none">
              <div style="font-size:13px;font-weight:700">Custom</div>
              <div style="font-size:13px;font-weight:900;color:var(--gold);margin:2px 0">3–30s</div>
            </label>
          </div>
          <div id="gs-custom-duration-wrap" style="display:none;margin-top:8px">
            <input type="range" id="gs-custom-duration" min="3" max="30" value="10" style="width:100%;accent-color:var(--gold)">
            <div style="font-size:12px;color:var(--gold);text-align:center" id="gs-custom-duration-label">10s</div>
          </div>
        </div>

        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px">OUTPUT SIZE</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;cursor:pointer">
              <input type="checkbox" name="gs-size" value="square" checked style="accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">Square</div><div style="font-size:10px;color:var(--gold)">1080×1080</div><div style="font-size:10px;color:var(--text3)">Instagram Feed, Threads</div></div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;cursor:pointer">
              <input type="checkbox" name="gs-size" value="story" checked style="accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">Story</div><div style="font-size:10px;color:var(--gold)">1080×1920</div><div style="font-size:10px;color:var(--text3)">Instagram Story, WhatsApp</div></div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;cursor:pointer">
              <input type="checkbox" name="gs-size" value="portrait" checked style="accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">Feed Portrait</div><div style="font-size:10px;color:var(--gold)">1080×1350</div><div style="font-size:10px;color:var(--text3)">Instagram Feed</div></div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;cursor:pointer">
              <input type="checkbox" name="gs-size" value="landscape" checked style="accent-color:var(--gold)">
              <div><div style="font-size:12px;font-weight:700">Landscape</div><div style="font-size:10px;color:var(--gold)">1920×1080</div><div style="font-size:10px;color:var(--text3)">Facebook, YouTube</div></div>
            </label>
          </div>
        </div>

      </div>
    </div>

    <!-- GENERATE BUTTON -->
    <button id="studio-generate-btn" class="mkt-btn mkt-btn-primary" onclick="gsStudioGenerate()" style="font-size:14px;font-weight:900;padding:14px;width:100%">
      ✨ Generate AI Poster + Animate GIF
    </button>

    <!-- RESULTS -->
    <div id="studio-results" style="display:none"></div>

    <!-- LIBRARY -->
    <div id="gs-library-section" style="display:none">
      <div class="mkt-card">
        <div class="mkt-card-title">📚 GIF Library</div>
        <div id="gs-library-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px"></div>
      </div>
    </div>

  </div>\`);

  // Wire radio/checkbox label borders
  setTimeout(() => {
    ['gs-mode','gs-style','gs-duration'].forEach(name => {
      document.querySelectorAll('input[name="'+name+'"]').forEach(r => {
        r.addEventListener('change', () => {
          document.querySelectorAll('input[name="'+name+'"]').forEach(o => {
            const id = 'lbl-'+name.replace('gs-','')+'-'+o.value;
            const lbl = document.getElementById(id)||o.closest('label');
            if (lbl) lbl.style.border = o.checked ? '2px solid var(--gold)' : '1px solid var(--border)';
          });
          if (name==='gs-duration') {
            const wrap = document.getElementById('gs-custom-duration-wrap');
            if (wrap) wrap.style.display = r.value==='custom' ? 'block' : 'none';
          }
        });
      });
    });
    document.getElementById('gs-custom-duration')?.addEventListener('input', function() {
      const lbl = document.getElementById('gs-custom-duration-label');
      if (lbl) lbl.textContent = this.value + 's';
    });
  }, 100);
}

async function gsStudioGenerate() {
  const brief = (document.getElementById('gs-brief')?.value || '').trim();
  if (!brief) { showMktToast('Please write your brief first'); return; }
  const tone = document.getElementById('gs-tone')?.value || 'product';
  const mode = document.querySelector('input[name="gs-mode"]:checked')?.value || 'animated_text';
  const animStyle = document.querySelector('input[name="gs-style"]:checked')?.value || 'cinematic';
  const durVal = document.querySelector('input[name="gs-duration"]:checked')?.value || '6';
  const duration = durVal === 'custom' ? +(document.getElementById('gs-custom-duration')?.value || 10) : +durVal;
  const sizes = [...document.querySelectorAll('input[name="gs-size"]:checked')].map(c => c.value);
  window._gsSettings = { mode, animStyle, duration, sizes };
  await studioGenerate(brief, tone, 'gif');
}
window.gsStudioGenerate = gsStudioGenerate;

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
  const icons = {'hook':'🎣','product':'🖼','offer':'💰','cta':'📞'};
  list.innerHTML = '';
  gsFrames.forEach(function(f, i) {
    const div = document.createElement('div');
    div.style.cssText = 'background:var(--bg3);border-radius:8px;padding:10px 12px;border:1px solid var(--border);display:flex;gap:8px;align-items:flex-start';
    const icon = icons[f.type] || '📄';
    const headId = 'gs-frame-h-'+i, bodyId = 'gs-frame-b-'+i, durId = 'gs-frame-d-'+i;
    div.innerHTML = '<div style="font-size:18px;flex-shrink:0;padding-top:2px">'+icon+'</div>'
      +'<div style="flex:1;display:grid;gap:6px">'
      +'<div style="display:flex;gap:6px">'
      +'<input id="'+headId+'" value="'+f.headline.replace(/"/g,'&quot;')+'" placeholder="Headline" class="mkt-form-input" style="font-size:12px;font-weight:700;flex:1">'
      +'<input id="'+durId+'" type="number" value="'+f.duration+'" min="0.5" max="10" step="0.5" class="mkt-form-input" style="font-size:12px;width:60px" title="Duration (s)">'
      +'</div>'
      +'<input id="'+bodyId+'" value="'+(f.body||'').replace(/"/g,'&quot;')+'" placeholder="Body text" class="mkt-form-input" style="font-size:11px">'
      +'</div>';
    div.querySelector('#'+headId).addEventListener('input', function() { gsFrames[i].headline = this.value; });
    div.querySelector('#'+bodyId).addEventListener('input', function() { gsFrames[i].body = this.value; });
    div.querySelector('#'+durId).addEventListener('input', function() { gsFrames[i].duration = +this.value; });
    list.appendChild(div);
  });
}


window.gsRenderGif        = gsRenderGif;
window.gsRenderVideo      = gsRenderVideo;
window.gsCancelRender     = gsCancelRender;
window.gsSaveCampaign     = gsSaveCampaign;
window.gsShowLibrary      = gsShowLibrary;
window.gsDeleteHistory    = gsDeleteHistory;
window.gsCopy             = gsCopy;
