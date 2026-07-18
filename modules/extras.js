/* === marketing.js === */

// ============================================================
// MARKETING OS — V Wholesale
// Calendar · Broadcast · Collaterals · SEO · Analytics
// ============================================================

// ===== FESTIVAL DATA =====
const FESTIVALS_2026 = [
  // June
  { date: '2026-06-21', name: 'Father\'s Day', telugu: 'తండ్రుల దినం', type: 'national', category: 'family' },
  // July
  { date: '2026-07-07', name: 'Bonalu', telugu: 'బోనాలు', type: 'telugu', category: 'festival' },
  { date: '2026-07-10', name: 'Muharram', telugu: 'మొహర్రం', type: 'national', category: 'festival' },
  { date: '2026-07-17', name: 'Eid ul-Adha', telugu: 'బక్రీద్', type: 'national', category: 'festival' },
  // August
  { date: '2026-08-08', name: 'Friendship Day', telugu: 'స్నేహితుల దినం', type: 'national', category: 'social' },
  { date: '2026-08-09', name: 'Nagula Chavithi', telugu: 'నాగుల చవితి', type: 'telugu', category: 'festival' },
  { date: '2026-08-15', name: 'Independence Day', telugu: 'స్వాతంత్ర్య దినోత్సవం', type: 'national', category: 'national' },
  { date: '2026-08-22', name: 'Raksha Bandhan', telugu: 'రాఖీ పౌర్ణమి', type: 'national', category: 'festival' },
  { date: '2026-08-23', name: 'Onam', telugu: 'ఓణం', type: 'national', category: 'festival' },
  { date: '2026-08-27', name: 'Janmashtami', telugu: 'కృష్ణాష్టమి', type: 'national', category: 'festival' },
  // September
  { date: '2026-09-07', name: 'Ganesh Chaturthi', telugu: 'వినాయక చవితి', type: 'telugu', category: 'festival' },
  { date: '2026-09-16', name: 'Milad-un-Nabi', telugu: 'మిలాద్-ఉన్-నబీ', type: 'national', category: 'festival' },
  { date: '2026-09-25', name: 'Navratri Begins', telugu: 'నవరాత్రులు', type: 'national', category: 'festival' },
  // October
  { date: '2026-10-02', name: 'Gandhi Jayanti', telugu: 'గాంధీ జయంతి', type: 'national', category: 'national' },
  { date: '2026-10-03', name: 'Dussehra / Vijayadashami', telugu: 'దసరా', type: 'telugu', category: 'festival' },
  { date: '2026-10-20', name: 'Diwali', telugu: 'దీపావళి', type: 'national', category: 'festival' },
  { date: '2026-10-21', name: 'Govardhan Puja', telugu: 'అన్నకూట్', type: 'national', category: 'festival' },
  { date: '2026-10-23', name: 'Bhai Dooj', telugu: 'భాయి దూజ్', type: 'national', category: 'festival' },
  // November
  { date: '2026-11-01', name: 'Andhra Pradesh Formation Day', telugu: 'ఆంధ్రప్రదేశ్ అవతరణ దినం', type: 'telugu', category: 'regional' },
  { date: '2026-11-14', name: 'Children\'s Day', telugu: 'బాలల దినం', type: 'national', category: 'social' },
  { date: '2026-11-30', name: 'Karthika Pournami', telugu: 'కార్తీక పౌర్ణమి', type: 'telugu', category: 'festival' },
  // December
  { date: '2026-12-06', name: 'Sampada / Bonalu End', telugu: 'సంపద', type: 'telugu', category: 'festival' },
  { date: '2026-12-25', name: 'Christmas', telugu: 'క్రిస్మస్', type: 'national', category: 'festival' },
  { date: '2026-12-31', name: 'New Year\'s Eve', telugu: 'నూతన సంవత్సర వేళ', type: 'national', category: 'social' },
  // January 2027
  { date: '2027-01-01', name: 'New Year', telugu: 'నూతన సంవత్సరం', type: 'national', category: 'social' },
  { date: '2027-01-14', name: 'Sankranti / Pongal', telugu: 'మకర సంక్రాంతి', type: 'telugu', category: 'festival' },
  { date: '2027-01-15', name: 'Bhogi', telugu: 'భోగి', type: 'telugu', category: 'festival' },
  { date: '2027-01-26', name: 'Republic Day', telugu: 'గణతంత్ర దినోత్సవం', type: 'national', category: 'national' },
  // February 2027
  { date: '2027-02-14', name: 'Valentine\'s Day', telugu: 'ప్రేమికుల దినం', type: 'national', category: 'social' },
  { date: '2027-02-26', name: 'Maha Shivaratri', telugu: 'మహాశివరాత్రి', type: 'telugu', category: 'festival' },
  // March 2027
  { date: '2027-03-08', name: 'Women\'s Day', telugu: 'మహిళా దినోత్సవం', type: 'national', category: 'social' },
  { date: '2027-03-21', name: 'Holi', telugu: 'హోలీ', type: 'national', category: 'festival' },
  { date: '2027-03-30', name: 'Telugu New Year (Ugadi)', telugu: 'ఉగాది', type: 'telugu', category: 'festival' },
];

// Greeting templates per festival category
const GREETING_TEMPLATES = {
  festival: {
    en: (name, store) => `🎉 Warm wishes on the occasion of ${name}!\n\nMay this festive season bring joy, prosperity, and happiness to your family and home.\n\n🏠 Planning to renovate or decorate your home this ${name}? Visit ${store} for the best deals on tiles, sanitary, electricals, and more!\n\nHappy ${name}! 🙏`,
    te: (name, teluguName, store) => `🎉 ${teluguName} శుభాకాంక్షలు!\n\nఈ పండుగ మీ కుటుంబానికి ఆనందం, సంతోషం తీసుకొచ్చాలని కోరుకుంటున్నాం. 🙏\n\n🏠 మీ ఇంటిని అందంగా మార్చాలని అనుకుంటున్నారా? ${store} లో అద్భుతమైన ఆఫర్లు చూడండి!\n\n${teluguName} శుభాకాంక్షలు! ✨`
  },
  national: {
    en: (name, store) => `🇮🇳 Happy ${name}!\n\nOn this special occasion, we at ${store} salute the spirit of our great nation. 🙏\n\nVisit us for the best home building materials in Vijayawada!\n\n— Team V Wholesale`,
    te: (name, teluguName, store) => `🇮🇳 ${teluguName} శుభాకాంక్షలు!\n\nఈ విశేష సందర్భంగా ${store} తరఫున మీ అందరికీ నమస్కారాలు. 🙏\n\n— V Wholesale బృందం`
  },
  social: {
    en: (name, store) => `💐 Happy ${name} from ${store}!\n\nThank you for being a valued part of our V Wholesale family. We appreciate your trust and support!\n\n🏠 Best home building & renovation materials in Vijayawada\n📍 Visit us or call for the best deals!`,
    te: (name, teluguName, store) => `💐 ${teluguName} సందర్భంగా ${store} తరఫున శుభాకాంక్షలు!\n\nమీ నమ్మకానికి, మద్దతుకు ధన్యవాదాలు! 🙏\n\n🏠 విజయవాడలో అత్యుత్తమ నిర్మాణ సామగ్రి`
  },
  family: {
    en: (name, store) => `💐 Happy ${name} from all of us at ${store}!\n\nWishing you and your family a wonderful day filled with love and joy. 🏠❤️`,
    te: (name, teluguName, store) => `💐 ${teluguName} సందర్భంగా ${store} తరఫున శుభాకాంక్షలు!\n\nమీ కుటుంబానికి ఆనందమయమైన రోజు కోరుకుంటున్నాం. 🏠❤️`
  }
};

// SEO Keywords for V Wholesale / Vijayawada
const SEO_KEYWORDS = {
  primary: [
    'tiles shop Vijayawada', 'sanitary ware Vijayawada', 'building materials Vijayawada',
    'home renovation Vijayawada', 'electrical shop Vijayawada', 'plumbing materials Vijayawada',
    'paint shop Vijayawada', 'hardware shop Vijayawada', 'V Wholesale Vijayawada',
    'wholesale building materials Andhra Pradesh'
  ],
  secondary: [
    'ceramic tiles price Vijayawada', 'bathroom fittings Vijayawada', 'LED lights wholesale Vijayawada',
    'modular kitchen Vijayawada', 'waterproofing materials Vijayawada', 'plywood dealers Vijayawada',
    'steel doors Vijayawada', 'granite tiles Vijayawada', 'construction materials Vijayawada',
    'interior design materials Vijayawada', 'home improvement store AP', 'TISAN products Vijayawada'
  ],
  local: [
    'tiles near Bhavanipuram', 'hardware shop Auto Nagar Vijayawada', 'building materials Krishnalanka',
    'sanitary ware MG Road Vijayawada', 'construction shop Vijayawada one town',
    'tiles Gannavaram road', 'home store Vijayawada'
  ],
  google_posts: [
    'New stock arrived — Premium tiles from ₹X/sqft',
    'Festival offer — 10% off on all sanitary fittings',
    'Contractor special — Bulk pricing on electrical items',
    'Home renovation package deals now available',
    'Free delivery above ₹10,000 in Vijayawada'
  ]
};

// ===== MAIN MARKETING PAGE =====
async function renderMarketingPage() {
  return `
  <div class="module-header"><h2>📣 Marketing OS</h2></div>
  <div style="overflow-x:auto;white-space:nowrap;margin-bottom:14px;padding-bottom:4px">
    <button class="entry-type-btn active" id="mktab-calendar" onclick="VW_MARKETING.switchMkTab('calendar',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">📅</span>Calendar</button>
    <button class="entry-type-btn" id="mktab-broadcast" onclick="VW_MARKETING.switchMkTab('broadcast',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">📢</span>Broadcast</button>
    <button class="entry-type-btn" id="mktab-collateral" onclick="VW_MARKETING.switchMkTab('collateral',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">🎨</span>Collaterals</button>
    <button class="entry-type-btn" id="mktab-seo" onclick="VW_MARKETING.switchMkTab('seo',this)" style="display:inline-flex;margin-right:6px"><span class="et-icon">🔍</span>SEO</button>
    <button class="entry-type-btn" id="mktab-analytics" onclick="VW_MARKETING.switchMkTab('analytics',this)" style="display:inline-flex"><span class="et-icon">📊</span>Analytics</button>
  </div>
  <div id="marketing-tab-content">
    ${await renderFestivalCalendar()}
  </div>`;
}

async function switchMkTab(tab, btn) {
  document.querySelectorAll('[id^="mktab-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('marketing-tab-content');
  if (!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  switch(tab) {
    case 'calendar':   container.innerHTML = await renderFestivalCalendar(); break;
    case 'broadcast':  container.innerHTML = await renderBroadcast(); break;
    case 'collateral': container.innerHTML = renderCollaterals(); break;
    case 'seo':        container.innerHTML = renderSEO(); break;
    case 'analytics':  container.innerHTML = await renderMarketingAnalytics(); break;
  }
}

// ===== TAB 1: FESTIVAL CALENDAR =====
async function renderFestivalCalendar() {
  const today = new Date();
  const upcoming = FESTIVALS_2026
    .filter(f => new Date(f.date) >= today)
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(0, 20);

  const typeColors = { telugu: '#C8972B', national: '#378ADD', regional: '#22c55e' };

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Upcoming Festivals & Events</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Tap any festival to create a WhatsApp greeting or social media post instantly</p>
    ${upcoming.map(f => {
      const date = new Date(f.date);
      const daysAway = Math.ceil((date - today) / (1000*60*60*24));
      const isThisWeek = daysAway <= 7;
      return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border2)">
        <div style="min-width:48px;text-align:center;padding:6px;background:${isThisWeek?'rgba(200,151,43,0.15)':'var(--bg2)'};border-radius:8px">
          <div style="font-size:16px;font-weight:700;color:${isThisWeek?'var(--gold)':'var(--text1)'}">${date.getDate()}</div>
          <div style="font-size:10px;color:var(--text3)">${date.toLocaleDateString('en-IN',{month:'short'})}</div>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${f.name} ${isThisWeek?'🔔':''}</div>
          <div style="font-size:12px;color:var(--text3)">${f.telugu} · <span style="color:${typeColors[f.type]||'#888'}">${f.type}</span> · ${daysAway===0?'Today':daysAway===1?'Tomorrow':daysAway+' days away'}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn-sm" onclick="VW_MARKETING.showFestivalContent('${f.name}','${f.telugu}','${f.category}')">✍️ Create</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

async function showFestivalContent(name, telugu, category) {
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale, Vijayawada';
  const tmpl = GREETING_TEMPLATES[category] || GREETING_TEMPLATES.festival;
  const enMsg = tmpl.en(name, storeName);
  const teMsg = tmpl.te(name, telugu, storeName);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${name} — ${telugu}</h3>
    <p class="sheet-meta">Choose content type and send or copy</p>

    <div class="entry-type-grid" style="margin-bottom:12px">
      <button class="entry-type-btn active" id="fcnt-en" onclick="document.getElementById('fcnt-en').classList.add('active');document.getElementById('fcnt-te').classList.remove('active');document.getElementById('festival-msg').value=window._festivalEnMsg">English</button>
      <button class="entry-type-btn" id="fcnt-te" onclick="document.getElementById('fcnt-te').classList.add('active');document.getElementById('fcnt-en').classList.remove('active');document.getElementById('festival-msg').value=window._festivalTeMsg">Telugu</button>
    </div>

    <textarea id="festival-msg" style="width:100%;height:160px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text1);font-size:13px;line-height:1.5;resize:vertical;box-sizing:border-box">${enMsg}</textarea>

    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-primary" style="flex:1" onclick="VW_MARKETING.broadcastFestival()">📢 Send to Customers</button>
      <button class="btn-secondary" onclick="navigator.clipboard.writeText(document.getElementById('festival-msg').value);showToast('Copied!','success')">📋 Copy</button>
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_MARKETING.generateAIContent('${name}','${telugu}','${category}')">✨ Generate AI Content</button>
    <button class="btn-secondary full-width" style="margin-top:8px;color:var(--text3)" onclick="closeSheet()">Close</button>
  `;
  window._festivalEnMsg = enMsg;
  window._festivalTeMsg = teMsg;
  window._currentFestivalName = name;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function generateAIContent(festivalName, teluguName, category) {
  showToast('Generating AI content...', 'info');
  const saveBtn = document.querySelector('#bottom-sheet .btn-secondary[onclick*="generateAI"]');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Generating...'; }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Create a WhatsApp marketing message for V Wholesale, a home building materials store in Vijayawada, Andhra Pradesh, for the ${festivalName} (${teluguName}) festival.

Requirements:
- Write TWO versions: one in English, one in Telugu
- Warm festive greeting + subtle product promotion
- Mention home renovation, tiles, sanitary, electrical, paints
- Include a call to action (visit store / call for deals)
- Keep it genuine, not salesy
- English: 80-100 words
- Telugu: 60-80 words (use Telugu script)

Format response as:
ENGLISH:
[message]

TELUGU:
[message]`
        }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const enMatch = text.match(/ENGLISH:\s*([\s\S]+?)(?=TELUGU:|$)/i);
    const teMatch = text.match(/TELUGU:\s*([\s\S]+?)$/i);
    if (enMatch) window._festivalEnMsg = enMatch[1].trim();
    if (teMatch) window._festivalTeMsg = teMatch[1].trim();
    const msgBox = document.getElementById('festival-msg');
    if (msgBox) msgBox.value = window._festivalEnMsg;
    showToast('AI content generated!', 'success');
  } catch(e) {
    showToast('AI generation failed — using template', 'warn');
  }
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '✨ Regenerate AI Content'; }
}

async function broadcastFestival() {
  const msg = document.getElementById('festival-msg')?.value || '';
  closeSheet();
  // Open broadcast with this message pre-filled
  window._broadcastPreFill = msg;
  document.getElementById('mktab-broadcast')?.click();
}

// ===== TAB 2: BROADCAST =====
async function renderBroadcast() {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const segments = {
    all: customers.filter(c => c.phone),
    retail: customers.filter(c => c.phone && (c.type === 'retail' || !c.type)),
    contractor: customers.filter(c => c.phone && c.type === 'contractor'),
    professional: customers.filter(c => c.phone && c.type === 'professional'),
    b2b: customers.filter(c => c.phone && c.type === 'b2b'),
  };

  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">WhatsApp Broadcast</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Messages open WhatsApp one by one — works without WhatsApp Business API. Best for up to 500 customers per session.</p>

    <div class="form-group">
      <label>Customer Segment</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">
        ${Object.entries(segments).map(([key, list]) => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg2);border-radius:8px;cursor:pointer;border:2px solid ${key==='all'?'var(--gold)':'transparent'}" onclick="VW_MARKETING.selectSegment('${key}')">
            <input type="radio" name="segment" value="${key}" ${key==='all'?'checked':''} style="accent-color:var(--gold)">
            <div>
              <div style="font-size:13px;font-weight:600;text-transform:capitalize">${key==='all'?'All Customers':key}</div>
              <div style="font-size:11px;color:var(--text3)">${list.length} contacts</div>
            </div>
          </label>`).join('')}
      </div>
    </div>

    <div class="form-group" style="margin-top:10px">
      <label>Message</label>
      <textarea id="broadcast-msg" style="width:100%;height:140px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text1);font-size:13px;line-height:1.5;resize:vertical;box-sizing:border-box" placeholder="Type your message here...">${window._broadcastPreFill||''}</textarea>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span id="broadcast-char-count" style="font-size:11px;color:var(--text3)">0 characters</span>
        <button style="background:none;border:none;color:var(--gold);font-size:11px;cursor:pointer" onclick="VW_MARKETING.generateBroadcastAI()">✨ AI Generate</button>
      </div>
    </div>

    <div class="form-group">
      <label>Quick Templates</label>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
        ${[
          {label:'🎉 Festival Offer', msg:'🎉 Festival Special Offer!\n\nDear Customer, this festive season get FLAT 10% off on all tiles and sanitary fittings at V Wholesale, Vijayawada.\n\n📍 Visit us today!\n📞 Call for home delivery above ₹10,000\n\n— Team V Wholesale'},
          {label:'📦 New Stock', msg:'📦 Fresh Stock Alert!\n\nDear Customer, exciting new products have arrived at V Wholesale!\n\n✅ Premium Tiles\n✅ Designer Sanitary Ware\n✅ LED Lighting Solutions\n\nVisit us to see the full collection. Best prices guaranteed!\n\n— V Wholesale, Vijayawada'},
          {label:'⭐ Review Request', msg:'Dear Customer,\n\nThank you for shopping at V Wholesale! 🙏\n\nWe hope you are happy with your purchase. It would mean a lot to us if you could share your experience on Google.\n\n👉 [Google Review Link]\n\nYour feedback helps us serve you better!\n\n— Team V Wholesale'},
          {label:'💰 Contractor Deal', msg:'Dear Contractor / Professional,\n\nExclusive B2B Pricing now available at V Wholesale, Vijayawada!\n\n✅ Bulk discounts on all categories\n✅ Credit facility available\n✅ Free delivery for bulk orders\n✅ Dedicated relationship manager\n\nCall us to know more about our Contractor Club benefits!\n\n— V Wholesale'}
        ].map(t => `
          <button class="btn-secondary" style="text-align:left;font-size:12px;padding:8px 12px" onclick="document.getElementById('broadcast-msg').value=${JSON.stringify(t.msg)};updateBroadcastCount()">${t.label}</button>`).join('')}
      </div>
    </div>

    <div id="broadcast-summary" style="padding:10px;background:rgba(200,151,43,0.1);border-radius:8px;margin-top:10px;font-size:13px">
      Select segment and write message, then tap Send
    </div>

    <button class="btn-primary full-width" style="margin-top:10px;font-size:15px" onclick="VW_MARKETING.startBroadcast()">📢 Start Broadcast</button>
    <p style="font-size:11px;color:var(--text3);text-align:center;margin-top:6px">Opens WhatsApp for each customer. Keep phone unlocked. ~3 seconds per customer.</p>
  </div>`;
}

function selectSegment(key) {
  document.querySelectorAll('[name="segment"]').forEach(r => {
    const label = r.closest('label');
    label.style.border = r.value === key ? '2px solid var(--gold)' : '2px solid transparent';
  });
  const radio = document.querySelector(`[name="segment"][value="${key}"]`);
  if (radio) radio.checked = true;
}

function updateBroadcastCount() {
  const msg = document.getElementById('broadcast-msg')?.value || '';
  const el = document.getElementById('broadcast-char-count');
  if (el) el.textContent = `${msg.length} characters`;
}

async function generateBroadcastAI() {
  showToast('Generating message...', 'info');
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: 'Write a short WhatsApp marketing message for V Wholesale, a home building materials store in Vijayawada (tiles, sanitary, electrical, paints, hardware). Warm, not salesy, 60-80 words, include a call to action. English only.'
        }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const box = document.getElementById('broadcast-msg');
    if (box) { box.value = text; updateBroadcastCount(); }
    showToast('Message generated!', 'success');
  } catch(e) { showToast('AI failed — write manually', 'warn'); }
}

async function startBroadcast() {
  const msg = document.getElementById('broadcast-msg')?.value.trim();
  if (!msg) { showToast('Write a message first', 'warn'); return; }
  const segmentVal = document.querySelector('[name="segment"]:checked')?.value || 'all';
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  let filtered = customers.filter(c => c.phone);
  if (segmentVal !== 'all') filtered = filtered.filter(c => c.type === segmentVal || (!c.type && segmentVal === 'retail'));

  if (!filtered.length) { showToast('No customers with phone in this segment', 'warn'); return; }

  // Save broadcast record
  await VW_DB.put(VW_DB.STORES.marketingCampaigns, {
    type: 'whatsapp_broadcast',
    segment: segmentVal,
    message: msg,
    recipientCount: filtered.length,
    sentAt: new Date().toISOString(),
    sentByName: VW_AUTH.getCurrentProfile()?.name || ''
  });

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>📢 Broadcast Started</h3>
    <p style="font-size:13px;color:var(--text3);margin-bottom:12px">${filtered.length} customers · Keep WhatsApp open</p>
    <div id="broadcast-progress" style="background:var(--bg2);border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-size:13px;margin-bottom:8px">Ready to send to <strong>${filtered.length}</strong> customers</div>
      <div style="background:var(--border);border-radius:4px;height:8px">
        <div id="broadcast-bar" style="background:var(--gold);height:8px;border-radius:4px;width:0%;transition:width 0.3s"></div>
      </div>
      <div id="broadcast-status" style="font-size:12px;color:var(--text3);margin-top:6px">Tap button below for each customer</div>
    </div>
    <div id="broadcast-current"></div>
    <button id="broadcast-next-btn" class="btn-primary full-width" onclick="VW_MARKETING.openNextWhatsApp()">💬 Open WhatsApp for Customer 1</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Done / Stop</button>
  `;
  window._broadcastQueue = filtered;
  window._broadcastMsg = msg;
  window._broadcastIdx = 0;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function openNextWhatsApp() {
  const queue = window._broadcastQueue || [];
  const idx = window._broadcastIdx || 0;
  if (idx >= queue.length) {
    showToast('Broadcast complete! 🎉', 'success');
    closeSheet();
    return;
  }
  const customer = queue[idx];
  const msg = encodeURIComponent(window._broadcastMsg || '');
  const phone = customer.phone.replace(/\D/g,'');
  window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  window._broadcastIdx = idx + 1;
  const pct = Math.round((idx + 1) / queue.length * 100);
  const bar = document.getElementById('broadcast-bar');
  const status = document.getElementById('broadcast-status');
  const btn = document.getElementById('broadcast-next-btn');
  const current = document.getElementById('broadcast-current');
  if (bar) bar.style.width = pct + '%';
  if (status) status.textContent = `${idx + 1} of ${queue.length} sent`;
  if (current) current.innerHTML = `<div style="font-size:12px;color:var(--text3);margin-bottom:8px">✓ Opened for: ${customer.name}</div>`;
  if (btn) btn.textContent = idx + 1 >= queue.length ? '✅ Done!' : `💬 Next → ${queue[idx+1]?.name||'Customer '+(idx+2)}`;
}

// ===== TAB 3: COLLATERALS =====
function renderCollaterals() {
  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Marketing Collaterals</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Generate posters, price lists, and offer cards instantly using AI</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn-secondary" style="text-align:left;padding:12px" onclick="VW_MARKETING.generateCollateral('offer_poster')">
        🎨 <strong>Festival Offer Poster</strong><br><span style="font-size:12px;color:var(--text3)">AI-generated poster text for WhatsApp status / print</span>
      </button>
      <button class="btn-secondary" style="text-align:left;padding:12px" onclick="VW_MARKETING.generateCollateral('price_list')">
        💰 <strong>Product Price List</strong><br><span style="font-size:12px;color:var(--text3)">Format your top products into a shareable price list</span>
      </button>
      <button class="btn-secondary" style="text-align:left;padding:12px" onclick="VW_MARKETING.generateCollateral('new_arrival')">
        📦 <strong>New Arrival Announcement</strong><br><span style="font-size:12px;color:var(--text3)">Announce new stock with product details</span>
      </button>
      <button class="btn-secondary" style="text-align:left;padding:12px" onclick="VW_MARKETING.generateCollateral('google_post')">
        📍 <strong>Google Business Post</strong><br><span style="font-size:12px;color:var(--text3)">AI-generated post for your Google Business Profile</span>
      </button>
      <button class="btn-secondary" style="text-align:left;padding:12px" onclick="VW_MARKETING.generateCollateral('instagram')">
        📸 <strong>Instagram Caption</strong><br><span style="font-size:12px;color:var(--text3)">Caption + hashtags in English and Telugu</span>
      </button>
      <button class="btn-secondary" style="text-align:left;padding:12px" onclick="VW_MARKETING.generateCollateral('review_request')">
        ⭐ <strong>Google Review Request</strong><br><span style="font-size:12px;color:var(--text3)">Personalised message asking customer for a review</span>
      </button>
    </div>
  </div>`;
}

async function generateCollateral(type) {
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale';
  const googleReviewLink = settings.googleReviewUrl || 'https://g.page/r/your-review-link';
  const prompts = {
    offer_poster: `Create a WhatsApp marketing poster text for V Wholesale, a home building materials store in Vijayawada. Include: headline, 3 key offers (tiles, sanitary, electricals), call to action. Bilingual - English and Telugu. Format as poster text, punchy and visual.`,
    price_list: `Create a formatted WhatsApp price list message for V Wholesale Vijayawada. Include sample price ranges for: Tiles (per sqft), Sanitary fittings, LED lights, Paints (per litre), Plumbing materials. Note these are sample ranges - format professionally. End with contact CTA.`,
    new_arrival: `Write a new stock arrival announcement for V Wholesale, home building materials store in Vijayawada. Exciting, energetic tone. Mention categories: premium tiles, designer sanitary, smart electrical solutions. Include visit/call CTA. 80 words English + 60 words Telugu.`,
    google_post: `Write a Google Business Profile post for V Wholesale, Vijayawada - home building and renovation materials store. Professional, local SEO optimised, 100-150 words. Include: what we sell, why choose us, location (Vijayawada), call to action. Use relevant keywords for local search.`,
    instagram: `Write an Instagram caption for V Wholesale Vijayawada, a home building materials store. Engaging, visual, aspirational home renovation theme. Include 15-20 relevant hashtags mix of English and Telugu. 50 words caption + hashtags.`,
    review_request: `Write a personalised WhatsApp message asking a customer to leave a Google review for V Wholesale Vijayawada. Warm, grateful tone, not pushy. Include placeholder [Customer Name] and [Google Review Link]. 50-60 words.`
  };

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>✨ Generating Content...</h3>
    <div style="text-align:center;padding:30px"><div class="spinner"></div></div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompts[type] }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || 'Could not generate content';
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>✨ Generated Content</h3>
      <textarea style="width:100%;height:220px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text1);font-size:13px;line-height:1.5;resize:vertical;box-sizing:border-box">${text}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary" style="flex:1" onclick="navigator.clipboard.writeText(this.closest('#bottom-sheet').querySelector('textarea').value);showToast('Copied!','success')">📋 Copy</button>
        <button class="btn-secondary" onclick="VW_MARKETING.generateCollateral('${type}')">🔄 Regenerate</button>
      </div>
      <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Done</button>
    `;
  } catch(e) {
    sheet.innerHTML = `<div class="sheet-handle"></div><h3>Error</h3><p>AI generation failed. Check connection.</p><button class="btn-primary full-width" onclick="closeSheet()">Close</button>`;
  }
}

// ===== TAB 4: SEO =====
function renderSEO() {
  const settings_google = 'https://business.google.com/create';
  return `
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🔍 SEO & Local Discovery</h3>

    <div style="padding:10px;background:rgba(200,151,43,0.1);border:1px solid rgba(200,151,43,0.3);border-radius:8px;margin-bottom:12px">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px">📍 Google Business Profile</div>
      <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Your #1 local SEO tool. Customers searching "tiles shop Vijayawada" see you first.</p>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" style="background:var(--gold);color:#000" onclick="window.open('https://business.google.com','_blank')">Manage Profile</button>
        <button class="btn-sm" onclick="VW_MARKETING.generateGooglePost()">✨ AI Post Generator</button>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">🎯 Primary Keywords — Use in Google posts, descriptions</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${SEO_KEYWORDS.primary.map(k => `<span style="padding:4px 10px;background:rgba(55,138,221,0.15);color:#378ADD;border-radius:12px;font-size:12px;cursor:pointer" onclick="navigator.clipboard.writeText('${k}');showToast('Copied!','success')">${k}</span>`).join('')}
      </div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">📍 Local Area Keywords</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${SEO_KEYWORDS.local.map(k => `<span style="padding:4px 10px;background:rgba(34,197,94,0.1);color:#22c55e;border-radius:12px;font-size:12px;cursor:pointer" onclick="navigator.clipboard.writeText('${k}');showToast('Copied!','success')">${k}</span>`).join('')}
      </div>
    </div>

    <div style="margin-bottom:14px">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">⭐ Google Review Strategy</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Send review requests after every invoice above ₹10,000. Target: 50+ reviews in 3 months.</div>
      <button class="btn-secondary full-width" onclick="VW_MARKETING.sendReviewRequests()">Send Review Request to Recent Customers</button>
    </div>

    <div>
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">📝 Google Post Ideas — Post weekly</div>
      ${SEO_KEYWORDS.google_posts.map((p,i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2)">
          <span style="font-size:13px">${p}</span>
          <button class="btn-sm" onclick="VW_MARKETING.generateGooglePost('${p.replace(/'/g,'')}')">✍️ Draft</button>
        </div>`).join('')}
    </div>
  </div>`;
}

async function generateGooglePost(topic) {
  const prompt = topic
    ? `Write a Google Business Profile post for V Wholesale Vijayawada about: "${topic}". Professional, local SEO optimised, 100-120 words, include call to action.`
    : `Write a Google Business Profile post for V Wholesale Vijayawada, home building materials store. Topic: why choose V Wholesale for your home renovation. 100-120 words, include local keywords like Vijayawada, tiles, sanitary, electricals.`;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `<div class="sheet-handle"></div><h3>📍 Google Business Post</h3><div style="text-align:center;padding:30px"><div class="spinner"></div></div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>📍 Google Business Post</h3>
      <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Copy and paste this into your Google Business Profile → Posts</p>
      <textarea style="width:100%;height:200px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);color:var(--text1);font-size:13px;line-height:1.5;resize:vertical;box-sizing:border-box">${text}</textarea>
      <button class="btn-primary full-width" style="margin-top:10px" onclick="navigator.clipboard.writeText(this.previousElementSibling.value);showToast('Copied — paste into Google Business!','success')">📋 Copy</button>
      <button class="btn-wa full-width" style="margin-top:8px" onclick="window.open('https://business.google.com','_blank')">📍 Open Google Business</button>
      <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Done</button>
    `;
  } catch(e) { closeSheet(); showToast('AI failed','warn'); }
}

async function sendReviewRequests() {
  const [invoices, customers] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.customers)
  ]);
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const reviewLink = settings.googleReviewUrl || 'https://g.page/r/your-review-link/review';
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);
  const eligible = invoices
    .filter(i => i.total >= 10000 && new Date(i.date) >= thirtyDaysAgo && i.approvalStatus === 'approved')
    .slice(0, 20);
  const custMap = {}; customers.forEach(c => custMap[c.id] = c);

  window._reviewQueue = eligible.map(i => custMap[i.customerId]).filter(c => c?.phone);
  window._reviewLink = reviewLink;
  window._broadcastMsg = `Dear [Customer],\n\nThank you for shopping at V Wholesale! 🙏\n\nWe hope you are happy with your purchase. A quick Google review from you would mean the world to us — it takes just 30 seconds!\n\n👉 ${reviewLink}\n\nThank you for your continued trust!\n\n— Team V Wholesale, Vijayawada`;
  window._broadcastQueue = window._reviewQueue;
  window._broadcastIdx = 0;

  showToast(`${window._reviewQueue.length} customers eligible for review request`, 'info');
  setTimeout(() => VW_MARKETING.startBroadcast(), 500);
}

// ===== TAB 5: ANALYTICS =====
async function renderMarketingAnalytics() {
  const [invoices, customers, leads, campaigns] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.customers),
    VW_DB.all(VW_DB.STORES.leads),
    VW_DB.all(VW_DB.STORES.marketingCampaigns)
  ]);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthInvoices = invoices.filter(i => new Date(i.date) >= monthStart && i.approvalStatus === 'approved');

  // Channel attribution
  const byChannel = {};
  monthInvoices.forEach(i => {
    const ch = i.orderSource || 'walk_in';
    if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0 };
    byChannel[ch].count++;
    byChannel[ch].revenue += i.total||0;
  });
  const channelLabels = {
    walk_in: '🏪 Walk-in', field_team: '🚗 Field Team', whatsapp: '💬 WhatsApp',
    referral: '🤝 Referral', instagram: '📸 Instagram', google: '🔍 Google',
    phone: '📞 Phone', other: '📌 Other'
  };

  // Lead sources
  const leadSources = {};
  leads.forEach(l => {
    const s = l.source || 'store';
    leadSources[s] = (leadSources[s]||0) + 1;
  });

  // Customer growth
  const monthCustomers = customers.filter(c => c.createdAt && new Date(c.createdAt) >= monthStart);

  // Campaign history
  const recentCampaigns = [...campaigns].sort((a,b) => new Date(b.sentAt)-new Date(a.sentAt)).slice(0,5);

  const totalRevenue = monthInvoices.reduce((s,i)=>s+(i.total||0),0);

  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
    <div style="padding:12px;background:var(--bg2);border-radius:10px;text-align:center">
      <div style="font-size:20px;font-weight:700;color:var(--gold)">₹${Math.round(totalRevenue/1000)}K</div>
      <div style="font-size:11px;color:var(--text3)">Month Revenue</div>
    </div>
    <div style="padding:12px;background:var(--bg2);border-radius:10px;text-align:center">
      <div style="font-size:20px;font-weight:700">${monthCustomers.length}</div>
      <div style="font-size:11px;color:var(--text3)">New Customers</div>
    </div>
    <div style="padding:12px;background:var(--bg2);border-radius:10px;text-align:center">
      <div style="font-size:20px;font-weight:700">${leads.filter(l=>l.stage!=='Won'&&l.stage!=='Lost').length}</div>
      <div style="font-size:11px;color:var(--text3)">Active Leads</div>
    </div>
    <div style="padding:12px;background:var(--bg2);border-radius:10px;text-align:center">
      <div style="font-size:20px;font-weight:700">${recentCampaigns.length}</div>
      <div style="font-size:11px;color:var(--text3)">Campaigns Sent</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Revenue by Channel — This Month</h3>
    ${!Object.keys(byChannel).length ? '<p class="empty-msg">No channel data yet — add order source when billing</p>' :
    Object.entries(byChannel).sort((a,b)=>b[1].revenue-a[1].revenue).map(([ch, data]) => {
      const pct = Math.round(data.revenue/totalRevenue*100);
      return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span>${channelLabels[ch]||ch}</span>
          <span style="font-weight:600">₹${Math.round(data.revenue/1000)}K (${pct}%)</span>
        </div>
        <div style="background:var(--border);border-radius:4px;height:8px">
          <div style="background:var(--gold);height:8px;border-radius:4px;width:${pct}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${data.count} invoice${data.count>1?'s':''}</div>
      </div>`;
    }).join('')}
  </div>

  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">Lead Sources</h3>
    ${Object.entries(leadSources).map(([src, count]) => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border2);font-size:13px">
        <span>${channelLabels[src]||src}</span>
        <span style="font-weight:600;color:var(--gold)">${count} leads</span>
      </div>`).join('') || '<p class="empty-msg">No leads yet</p>'}
  </div>

  ${recentCampaigns.length ? `
  <div class="card">
    <h3 class="card-title">Recent Campaigns</h3>
    ${recentCampaigns.map(c => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border2)">
        <div style="font-size:13px;font-weight:600">WhatsApp Broadcast — ${c.segment||'all'}</div>
        <div style="font-size:12px;color:var(--text3)">${c.recipientCount||0} recipients · ${new Date(c.sentAt).toLocaleDateString('en-IN')} · by ${c.sentByName||'—'}</div>
      </div>`).join('')}
  </div>` : ''}`;
}

window.VW_MARKETING = {
  renderMarketingPage, switchMkTab,
  showFestivalContent, generateAIContent, broadcastFestival,
  renderBroadcast, selectSegment, generateBroadcastAI, startBroadcast, openNextWhatsApp,
  renderCollaterals, generateCollateral,
  renderSEO, generateGooglePost, sendReviewRequests,
  renderMarketingAnalytics
};




/* === service.js === */

// ============================================================
// SERVICE VENDOR MODULE
// Work Orders · Progress Photos · Payment Stages · Sign-off
// ============================================================

const WORK_ORDER_STAGES = [
  { key: 'created', label: 'Order Created', color: '#888' },
  { key: 'assigned', label: 'Vendor Assigned', color: '#378ADD' },
  { key: 'advance_paid', label: 'Advance Paid', color: '#7F77DD' },
  { key: 'in_progress', label: 'Work In Progress', color: '#f97316' },
  { key: 'mid_payment', label: 'Mid Payment Done', color: '#06b6d4' },
  { key: 'completed', label: 'Work Completed', color: '#22c55e' },
  { key: 'signed_off', label: 'Customer Signed Off', color: '#22c55e' },
  { key: 'final_paid', label: 'Final Payment Done', color: '#C8972B' },
];

const SERVICE_CATEGORIES = [
  'Plumbing', 'Electrical', 'Painting', 'Carpentry', 'Tiling',
  'Waterproofing', 'False Ceiling', 'Flooring', 'Modular Kitchen',
  'AC Installation', 'Interior Design', 'Civil Work', 'Other'
];

// ===== MAIN PAGE =====
async function renderServicePage() {
  const [workOrders, vendors] = await Promise.all([
    VW_DB.all(VW_DB.STORES.workOrders),
    VW_DB.all(VW_DB.STORES.serviceVendors)
  ]);
  const isAdmin = VW_AUTH.isAdmin();

  const active = workOrders.filter(w => !['final_paid','signed_off'].includes(w.stage)).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const overdue = active.filter(w => w.expectedCompletionDate && new Date(w.expectedCompletionDate) < new Date());
  const completed = workOrders.filter(w => ['final_paid','signed_off'].includes(w.stage)).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));

  return `
  <div class="module-header">
    <h2>Service & Work Orders</h2>
    ${isAdmin ? `<button class="btn-sm" onclick="VW_SERVICE.showAddWorkOrder()">+ New Order</button>` : ''}
  </div>

  <div class="entry-type-grid" style="margin-bottom:12px">
    <button class="entry-type-btn active" id="svc-tab-active" onclick="VW_SERVICE.switchSvcTab('active',this)"><span class="et-icon">🔧</span>Active (${active.length})</button>
    <button class="entry-type-btn" id="svc-tab-vendors" onclick="VW_SERVICE.switchSvcTab('vendors',this)"><span class="et-icon">👷</span>Vendors</button>
    <button class="entry-type-btn" id="svc-tab-done" onclick="VW_SERVICE.switchSvcTab('done',this)"><span class="et-icon">✅</span>Completed</button>
  </div>

  ${overdue.length ? `
  <div style="padding:10px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;margin-bottom:10px">
    <div style="font-weight:600;font-size:13px;color:var(--red)">⚠️ ${overdue.length} Overdue Work Order${overdue.length>1?'s':''}</div>
    <div style="font-size:12px;color:var(--text3)">Expected completion date has passed</div>
  </div>` : ''}

  <div id="service-tab-content">
    ${renderWorkOrderList(active, workOrders, 'active')}
  </div>`;
}

async function switchSvcTab(tab, btn) {
  document.querySelectorAll('[id^="svc-tab-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('service-tab-content');
  if (!container) return;
  const [workOrders, serviceVendors] = await Promise.all([
    VW_DB.all(VW_DB.STORES.workOrders),
    VW_DB.all(VW_DB.STORES.serviceVendors)
  ]);
  if (tab === 'active') {
    const active = workOrders.filter(w => !['final_paid'].includes(w.stage)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    container.innerHTML = renderWorkOrderList(active, workOrders, 'active');
  } else if (tab === 'vendors') {
    container.innerHTML = renderServiceVendorList(serviceVendors);
  } else {
    const done = workOrders.filter(w => w.stage === 'final_paid').sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    container.innerHTML = renderWorkOrderList(done, workOrders, 'done');
  }
}

function renderWorkOrderList(orders, all, type) {
  if (!orders.length) return `<div class="card"><p class="empty-msg">${type==='done'?'No completed orders yet':'No active work orders — tap + New Order to create one'}</p></div>`;
  return orders.map(w => {
    const stage = WORK_ORDER_STAGES.find(s=>s.key===w.stage)||WORK_ORDER_STAGES[0];
    const isOverdue = w.expectedCompletionDate && new Date(w.expectedCompletionDate) < new Date() && w.stage !== 'final_paid';
    const totalPaid = (w.payments||[]).reduce((s,p)=>s+(p.amount||0),0);
    const balance = (w.totalValue||0) - totalPaid;
    return `
    <div class="task-card" onclick="VW_SERVICE.openWorkOrder(${w.id})">
      <div class="task-card-header">
        <span class="task-dept">${w.workOrderNo||'WO-'+w.id}</span>
        <span class="badge" style="background:${isOverdue?'var(--red)':stage.color}">${isOverdue?'⚠️ Overdue':stage.label}</span>
      </div>
      <div style="font-size:13px;font-weight:600;margin:4px 0">${w.customerName||'—'} · ${w.category||'—'}</div>
      <div style="font-size:12px;color:var(--text3)">${w.vendorName?'👷 '+w.vendorName+' · ':''}${w.siteName||w.siteAddress||'No site'}</div>
      <div style="display:flex;justify-content:space-between;margin-top:6px">
        <span style="font-size:12px;color:var(--text3)">${w.expectedCompletionDate?'Due: '+new Date(w.expectedCompletionDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):''}</span>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:700">₹${(w.totalValue||0).toLocaleString('en-IN')}</div>
          ${balance > 0 ? `<div style="font-size:11px;color:var(--red)">₹${balance.toLocaleString('en-IN')} pending</div>` : `<div style="font-size:11px;color:#22c55e">Fully paid</div>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderServiceVendorList(vendors) {
  const isAdmin = VW_AUTH.isAdmin();
  if (!vendors.length) return `
    <div class="card">
      <p class="empty-msg">No service vendors added yet</p>
      ${isAdmin ? `<button class="btn-primary full-width" onclick="VW_SERVICE.showAddServiceVendor()">+ Add Service Vendor</button>` : ''}
    </div>`;
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <span style="font-size:13px;color:var(--text2)">${vendors.length} service vendors</span>
    ${isAdmin ? `<button class="btn-sm" onclick="VW_SERVICE.showAddServiceVendor()">+ Add</button>` : ''}
  </div>
  ${vendors.map(v => {
    const avgRating = v.ratings?.length ? (v.ratings.reduce((s,r)=>s+r,0)/v.ratings.length).toFixed(1) : null;
    return `
    <div class="task-card" onclick="VW_SERVICE.openServiceVendor(${v.id})">
      <div class="task-card-header">
        <span class="task-dept">${v.name}</span>
        ${avgRating ? `<span style="color:var(--gold);font-size:12px">★ ${avgRating}</span>` : ''}
      </div>
      <div style="font-size:12px;color:var(--text3)">${v.categories?.join(', ')||'General'} · ${v.phone||'—'}</div>
      ${v.notes ? `<div style="font-size:11px;color:var(--text3);font-style:italic;margin-top:3px">${v.notes}</div>` : ''}
    </div>`;
  }).join('')}`;
}

// ===== ADD / EDIT SERVICE VENDOR =====
async function showAddServiceVendor(vendorId) {
  const v = vendorId ? await VW_DB.getById(VW_DB.STORES.serviceVendors, vendorId) : null;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${v ? 'Edit' : 'Add'} Service Vendor</h3>
    <div class="form-group"><label>Name / Business Name *</label><input type="text" id="sv-name" value="${v?.name||''}"></div>
    <div class="form-group"><label>Phone *</label><input type="tel" id="sv-phone" value="${v?.phone||''}" maxlength="10"></div>
    <div class="form-group"><label>Services Provided</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
        ${SERVICE_CATEGORIES.map(cat => `
          <label style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:var(--bg2);border-radius:6px;font-size:12px;cursor:pointer">
            <input type="checkbox" name="sv-cat" value="${cat}" ${(v?.categories||[]).includes(cat)?'checked':''}> ${cat}
          </label>`).join('')}
      </div>
    </div>
    <div class="form-group"><label>GST Number</label><input type="text" id="sv-gst" value="${v?.gstNo||''}"></div>
    <div class="form-group"><label>Notes</label><input type="text" id="sv-notes" value="${v?.notes||''}" placeholder="e.g. Reliable for bathroom tiling, available weekdays"></div>
    <button class="btn-primary full-width" onclick="VW_SERVICE.saveServiceVendor(${vendorId||'null'})">Save</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveServiceVendor(vendorId) {
  const name = document.getElementById('sv-name')?.value.trim();
  const phone = document.getElementById('sv-phone')?.value.trim();
  if (!name) { showToast('Enter vendor name', 'warn'); return; }
  const categories = [...document.querySelectorAll('input[name="sv-cat"]:checked')].map(cb => cb.value);
  const profile = VW_AUTH.getCurrentProfile();
  const record = {
    name, phone, categories,
    gstNo: document.getElementById('sv-gst')?.value.trim()||'',
    notes: document.getElementById('sv-notes')?.value.trim()||'',
    updatedAt: new Date().toISOString()
  };
  if (vendorId) {
    const existing = await VW_DB.getById(VW_DB.STORES.serviceVendors, vendorId);
    await VW_DB.put(VW_DB.STORES.serviceVendors, {...existing, ...record});
  } else {
    record.ratings = [];
    record.createdAt = new Date().toISOString();
    record.addedByName = profile?.name||'';
    await VW_DB.put(VW_DB.STORES.serviceVendors, record);
  }
  showToast(`Service vendor ${vendorId?'updated':'added'}`, 'success');
  closeSheet();
  navigateTo('service');
}

async function openServiceVendor(id) {
  const [v, allOrders] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.serviceVendors, id),
    VW_DB.all(VW_DB.STORES.workOrders)
  ]);
  if (!v) return;
  const vendorOrders = allOrders.filter(w => w.serviceVendorId === id);
  const isAdmin = VW_AUTH.isAdmin();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:10px">
      <div>
        <h3 style="margin:0">${v.name}</h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0">${v.categories?.join(', ')||'General'}</p>
      </div>
      ${isAdmin ? `<button class="btn-sm" onclick="VW_SERVICE.showAddServiceVendor(${id})">✏️ Edit</button>` : ''}
    </div>
    <div class="req-item-card" style="margin-bottom:10px">
      ${v.phone ? `<div style="font-size:13px">📞 <a href="tel:${v.phone}" style="color:var(--text1)">${v.phone}</a></div>` : ''}
      ${v.gstNo ? `<div style="font-size:12px;color:var(--text3)">GST: ${v.gstNo}</div>` : ''}
      ${v.notes ? `<div style="font-size:12px;color:var(--text3);font-style:italic">${v.notes}</div>` : ''}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      ${v.phone ? `<button class="btn-wa" style="flex:1" onclick="window.open('https://wa.me/91${v.phone.replace(/\D/g,'')}','_blank')">💬 WhatsApp</button>` : ''}
      ${v.phone ? `<button class="btn-call" onclick="window.location='tel:${v.phone}'">📞 Call</button>` : ''}
    </div>
    <div class="sheet-section-label">Work Orders (${vendorOrders.length})</div>
    ${vendorOrders.slice(0,5).map(w => {
      const stage = WORK_ORDER_STAGES.find(s=>s.key===w.stage)||WORK_ORDER_STAGES[0];
      return `<div class="task-card" onclick="VW_SERVICE.openWorkOrder(${w.id})">
        <div class="task-card-header"><span>${w.workOrderNo||'WO-'+w.id}</span><span class="badge" style="background:${stage.color}">${stage.label}</span></div>
        <div style="font-size:12px;color:var(--text3)">${w.customerName||'—'} · ₹${(w.totalValue||0).toLocaleString('en-IN')}</div>
      </div>`;
    }).join('') || '<p style="font-size:12px;color:var(--text3)">No work orders yet</p>'}
    ${isAdmin && v.ratings?.length ? `
    <div class="sheet-section-label">Ratings</div>
    <div style="font-size:13px">Average: ${'★'.repeat(Math.round(v.ratings.reduce((s,r)=>s+r,0)/v.ratings.length))} (${v.ratings.length} orders)</div>` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// ===== ADD WORK ORDER =====
async function showAddWorkOrder(customerId, customerName) {
  const [customers, serviceVendors] = await Promise.all([
    VW_DB.all(VW_DB.STORES.customers),
    VW_DB.all(VW_DB.STORES.serviceVendors)
  ]);
  const profile = VW_AUTH.getCurrentProfile();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Work Order</h3>

    <div class="form-group"><label>Customer *</label>
      <select id="wo-customer">
        <option value="">— Select customer —</option>
        ${customers.map(c => `<option value="${c.id}" data-name="${c.name}" ${c.id===customerId?'selected':''}>${c.name} · ${c.phone||'—'}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Service Category *</label>
      <select id="wo-category">
        <option value="">— Select category —</option>
        ${SERVICE_CATEGORIES.map(c => `<option>${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Site / Address</label><input type="text" id="wo-site" placeholder="e.g. House at Bhavanipuram, Flat 2B"></div>
    <div class="form-group"><label>Description of Work</label><textarea id="wo-desc" style="height:80px" placeholder="e.g. Complete bathroom tiling — 2 bathrooms, floor + walls"></textarea></div>
    <div class="form-group"><label>Assign Service Vendor</label>
      <select id="wo-vendor">
        <option value="">— Assign later —</option>
        ${serviceVendors.map(v => `<option value="${v.id}" data-name="${v.name}">${v.name} (${v.categories?.join(', ')||'General'})</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Total Work Value (₹) *</label><input type="number" id="wo-value" min="0" placeholder="e.g. 50000"></div>
    <div class="form-group"><label>Payment Structure</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px">
        <div><label style="font-size:11px;color:var(--text3)">Advance %</label><input type="number" id="wo-adv-pct" value="30" min="0" max="100"></div>
        <div><label style="font-size:11px;color:var(--text3)">Mid %</label><input type="number" id="wo-mid-pct" value="60" min="0" max="100"></div>
        <div><label style="font-size:11px;color:var(--text3)">Final %</label><input type="number" id="wo-fin-pct" value="10" min="0" max="100"></div>
      </div>
    </div>
    <div class="form-group"><label>Expected Completion Date</label><input type="date" id="wo-due" value="${new Date(Date.now()+14*86400000).toISOString().split('T')[0]}"></div>
    <button class="btn-primary full-width" onclick="VW_SERVICE.saveWorkOrder()">Create Work Order</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveWorkOrder() {
  const custSel = document.getElementById('wo-customer');
  const customerId = parseInt(custSel?.value);
  const customerName = custSel?.options[custSel.selectedIndex]?.dataset.name || '';
  const category = document.getElementById('wo-category')?.value;
  const totalValue = parseFloat(document.getElementById('wo-value')?.value)||0;
  if (!customerId) { showToast('Select a customer', 'warn'); return; }
  if (!category) { showToast('Select a category', 'warn'); return; }
  if (!totalValue) { showToast('Enter work value', 'warn'); return; }

  const vendorSel = document.getElementById('wo-vendor');
  const serviceVendorId = parseInt(vendorSel?.value)||null;
  const vendorName = serviceVendorId ? vendorSel?.options[vendorSel.selectedIndex]?.dataset.name||'' : '';

  const fy = getFinancialYearLabel();
  const all = await VW_DB.all(VW_DB.STORES.workOrders);
  const seq = (all.length + 1).toString().padStart(4,'0');
  const workOrderNo = `WO/${fy}/${seq}`;
  const advPct = parseFloat(document.getElementById('wo-adv-pct')?.value)||30;
  const midPct = parseFloat(document.getElementById('wo-mid-pct')?.value)||60;
  const finPct = parseFloat(document.getElementById('wo-fin-pct')?.value)||10;
  const profile = VW_AUTH.getCurrentProfile();

  await VW_DB.put(VW_DB.STORES.workOrders, {
    workOrderNo, customerId, customerName, category,
    siteName: document.getElementById('wo-site')?.value.trim()||'',
    description: document.getElementById('wo-desc')?.value.trim()||'',
    serviceVendorId, vendorName,
    totalValue,
    paymentStructure: { advancePct: advPct, midPct, finalPct: finPct },
    expectedCompletionDate: document.getElementById('wo-due')?.value||'',
    stage: serviceVendorId ? 'assigned' : 'created',
    payments: [],
    photos: [],
    notes: [],
    createdByName: profile?.name||'',
    createdAt: new Date().toISOString()
  });

  // WhatsApp notification to vendor if assigned
  if (serviceVendorId) {
    const vendor = await VW_DB.getById(VW_DB.STORES.serviceVendors, serviceVendorId);
    if (vendor?.phone) {
      const msg = encodeURIComponent(`Dear ${vendor.name},\n\nNew work order assigned: ${workOrderNo}\n\nCustomer: ${customerName}\nWork: ${category}\nSite: ${document.getElementById('wo-site')?.value||'—'}\nValue: ₹${totalValue.toLocaleString('en-IN')}\nDue: ${document.getElementById('wo-due')?.value||'—'}\n\nPlease confirm availability.\n\n— V Wholesale`);
      window.open(`https://wa.me/91${vendor.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
    }
  }
  showToast(`Work order ${workOrderNo} created`, 'success');
  closeSheet();
  navigateTo('service');
}

// ===== WORK ORDER DETAIL =====
async function openWorkOrder(id) {
  const wo = await VW_DB.getById(VW_DB.STORES.workOrders, id);
  if (!wo) return;
  const isAdmin = VW_AUTH.isAdmin();
  const stageIdx = WORK_ORDER_STAGES.findIndex(s => s.key === wo.stage);
  const totalPaid = (wo.payments||[]).reduce((s,p) => s+(p.amount||0), 0);
  const balance = (wo.totalValue||0) - totalPaid;
  const advAmt = Math.round((wo.totalValue||0) * (wo.paymentStructure?.advancePct||30) / 100);
  const midAmt = Math.round((wo.totalValue||0) * (wo.paymentStructure?.midPct||60) / 100);
  const finAmt = Math.round((wo.totalValue||0) * (wo.paymentStructure?.finalPct||10) / 100);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <h3 style="margin:0">${wo.workOrderNo}</h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0">${wo.customerName} · ${wo.category}</p>
        ${wo.siteName ? `<p style="font-size:12px;color:var(--text3);margin:0">📍 ${wo.siteName}</p>` : ''}
      </div>
      <span class="badge" style="background:${WORK_ORDER_STAGES[stageIdx]?.color||'#888'}">${WORK_ORDER_STAGES[stageIdx]?.label||wo.stage}</span>
    </div>

    <!-- Progress bar -->
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        ${WORK_ORDER_STAGES.slice(0,6).map((s,i) => `
          <div style="text-align:center;flex:1">
            <div style="width:20px;height:20px;border-radius:50%;margin:0 auto;background:${i<=stageIdx?s.color:'var(--border)'}"></div>
            <div style="font-size:9px;color:${i<=stageIdx?'var(--text1)':'var(--text3)'};margin-top:2px;line-height:1.2">${s.label.split(' ')[0]}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Financial summary -->
    <div class="req-item-card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>Total Value</span><strong>₹${(wo.totalValue||0).toLocaleString('en-IN')}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>Paid so far</span><strong style="color:#22c55e">₹${totalPaid.toLocaleString('en-IN')}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>Balance</span><strong style="color:${balance>0?'var(--red)':'#22c55e'}">₹${balance.toLocaleString('en-IN')}</strong></div>
    </div>

    <!-- Payment milestones -->
    <div style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px">Payment Milestones</div>
      ${[
        {label:'Advance', amt: advAmt, stageKey:'advance_paid'},
        {label:'Mid-payment', amt: midAmt, stageKey:'mid_payment'},
        {label:'Final', amt: finAmt, stageKey:'final_paid'}
      ].map(m => {
        const paid = (wo.payments||[]).find(p=>p.milestone===m.stageKey);
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border2)">
          <div>
            <div style="font-size:13px">${m.label}: ₹${m.amt.toLocaleString('en-IN')}</div>
            ${paid ? `<div style="font-size:11px;color:#22c55e">✓ Paid ${new Date(paid.paidAt).toLocaleDateString('en-IN')} by ${paid.paidByName}</div>` : ''}
          </div>
          ${isAdmin && !paid && stageIdx >= WORK_ORDER_STAGES.findIndex(s=>s.key===m.stageKey)-1 ?
            `<button class="btn-sm" style="background:var(--gold);color:#000" onclick="VW_SERVICE.recordPayment(${id},'${m.stageKey}',${m.amt})">Pay</button>` : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- Progress photos -->
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:13px;font-weight:600">Progress Photos (${(wo.photos||[]).length})</div>
        <button class="btn-sm" onclick="VW_SERVICE.addProgressPhoto(${id})">📷 Add</button>
      </div>
      ${(wo.photos||[]).length ? `
        <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
          ${wo.photos.map(p => `<img src="${p.url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0">`).join('')}
        </div>` : '<p style="font-size:12px;color:var(--text3)">No photos yet</p>'}
    </div>

    <!-- Stage actions -->
    ${isAdmin ? `
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
      ${wo.stage === 'in_progress' ? `<button class="btn-primary full-width" onclick="VW_SERVICE.updateStage(${id},'completed')">✅ Mark Work Completed</button>` : ''}
      ${wo.stage === 'completed' ? `<button class="btn-primary full-width" onclick="VW_SERVICE.requestCustomerSignoff(${id})">📋 Request Customer Sign-off</button>` : ''}
      ${wo.stage === 'signed_off' ? `<button class="btn-primary full-width" style="background:#22c55e" onclick="VW_SERVICE.updateStage(${id},'final_paid')">💰 Release Final Payment</button>` : ''}
      ${wo.stage === 'assigned' ? `<button class="btn-secondary full-width" onclick="VW_SERVICE.updateStage(${id},'in_progress')">🔧 Mark Work Started</button>` : ''}
    </div>` : ''}

    <!-- Vendor actions -->
    ${wo.vendorName ? `
    <div style="display:flex;gap:8px">
      <button class="btn-wa" style="flex:1" onclick="window.open('https://wa.me/91${wo.vendorPhone||''}','_blank')">💬 WhatsApp Vendor</button>
      <button class="btn-secondary" onclick="VW_SERVICE.rateServiceVendor(${wo.serviceVendorId})">⭐ Rate</button>
    </div>` : `
    <button class="btn-secondary full-width" onclick="VW_SERVICE.assignVendor(${id})">👷 Assign Vendor</button>`}
    <button class="btn-secondary full-width" style="margin-top:8px;color:var(--text3)" onclick="closeSheet()">Close</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function updateStage(workOrderId, newStage) {
  const wo = await VW_DB.getById(VW_DB.STORES.workOrders, workOrderId);
  if (!wo) return;
  wo.stage = newStage;
  wo.stageUpdatedAt = new Date().toISOString();
  wo.stageUpdatedBy = VW_AUTH.getCurrentProfile()?.name||'';
  await VW_DB.put(VW_DB.STORES.workOrders, wo);
  showToast(`Stage updated: ${WORK_ORDER_STAGES.find(s=>s.key===newStage)?.label}`, 'success');
  await openWorkOrder(workOrderId);
}

async function recordPayment(workOrderId, milestone, suggestedAmount) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Record Payment</h3>
    <p class="sheet-meta">${milestone.replace(/_/g,' ')} · Suggested: ₹${suggestedAmount.toLocaleString('en-IN')}</p>
    <div class="form-group"><label>Amount Paid (₹)</label><input type="number" id="pay-amount" value="${suggestedAmount}"></div>
    <div class="form-group"><label>Payment Mode</label>
      <select id="pay-mode"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option></select>
    </div>
    <div class="form-group"><label>Reference / UTR</label><input type="text" id="pay-ref" placeholder="UTR or cheque number"></div>
    <button class="btn-primary full-width" onclick="VW_SERVICE.confirmPayment(${workOrderId},'${milestone}')">✓ Confirm Payment</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_SERVICE.openWorkOrder(${workOrderId})">Cancel</button>
  `;
}

async function confirmPayment(workOrderId, milestone) {
  const amount = parseFloat(document.getElementById('pay-amount')?.value)||0;
  if (!amount) { showToast('Enter amount', 'warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  const wo = await VW_DB.getById(VW_DB.STORES.workOrders, workOrderId);
  if (!wo) return;
  wo.payments = [...(wo.payments||[]), {
    milestone, amount,
    mode: document.getElementById('pay-mode')?.value||'Cash',
    reference: document.getElementById('pay-ref')?.value||'',
    paidByName: profile?.name||'',
    paidAt: new Date().toISOString()
  }];
  // Auto advance stage
  const stageMap = { advance_paid: 'in_progress', mid_payment: 'in_progress', final_paid: 'final_paid' };
  if (stageMap[milestone]) wo.stage = stageMap[milestone];
  await VW_DB.put(VW_DB.STORES.workOrders, wo);
  showToast(`₹${amount.toLocaleString('en-IN')} payment recorded`, 'success');
  await openWorkOrder(workOrderId);
}

async function addProgressPhoto(workOrderId) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>📷 Add Progress Photo</h3>
    <div class="form-group"><label>Stage / Caption</label>
      <select id="photo-stage">
        <option>Before Work</option><option>Work Started</option><option>50% Complete</option>
        <option>90% Complete</option><option>After Completion</option><option>Issue Found</option>
      </select>
    </div>
    <div id="photo-preview" style="display:none;margin-bottom:12px">
      <img id="photo-img" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px">
    </div>
    <input type="file" id="photo-input" accept="image/*" capture="environment" style="display:none" onchange="VW_SERVICE.previewPhoto(this)">
    <button class="btn-primary full-width" onclick="document.getElementById('photo-input').click()">📷 Take / Upload Photo</button>
    <button class="btn-secondary full-width" id="photo-save-btn" style="display:none;margin-top:8px" onclick="VW_SERVICE.saveProgressPhoto(${workOrderId})">✓ Save Photo</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_SERVICE.openWorkOrder(${workOrderId})">Cancel</button>
  `;
}

function previewPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('photo-img');
    const preview = document.getElementById('photo-preview');
    const saveBtn = document.getElementById('photo-save-btn');
    if (img) img.src = e.target.result;
    if (preview) preview.style.display = '';
    if (saveBtn) saveBtn.style.display = '';
  };
  reader.readAsDataURL(file);
}

async function saveProgressPhoto(workOrderId) {
  const input = document.getElementById('photo-input');
  const file = input?.files[0];
  if (!file) { showToast('Take a photo first', 'warn'); return; }
  const stage = document.getElementById('photo-stage')?.value||'';
  const profile = VW_AUTH.getCurrentProfile();

  const saveBtn = document.getElementById('photo-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Uploading...'; }

  try {
    const dataUrl = await new Promise((res,rej) => {
      const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(file);
    });
    const path = `workorders/${workOrderId}-${Date.now()}.jpg`;
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    await VW_DB.client.storage.from('visit-photos').upload(path, bytes, {contentType:'image/jpeg'});
    const { data: pubUrl } = VW_DB.client.storage.from('visit-photos').getPublicUrl(path);

    const wo = await VW_DB.getById(VW_DB.STORES.workOrders, workOrderId);
    if (wo) {
      wo.photos = [...(wo.photos||[]), {
        url: pubUrl?.publicUrl||'', stage,
        addedByName: profile?.name||'',
        addedAt: new Date().toISOString()
      }];
      await VW_DB.put(VW_DB.STORES.workOrders, wo);
    }
    showToast('Photo saved', 'success');
    await openWorkOrder(workOrderId);
  } catch(e) {
    console.error('Photo upload error:', e);
    showToast('Upload failed — try again', 'warn');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '✓ Save Photo'; }
  }
}

async function requestCustomerSignoff(workOrderId) {
  const wo = await VW_DB.getById(VW_DB.STORES.workOrders, workOrderId);
  if (!wo) return;
  const cust = await VW_DB.getById(VW_DB.STORES.customers, wo.customerId);
  if (!cust?.phone) { showToast('No customer phone number', 'warn'); return; }
  const msg = encodeURIComponent(
    `Dear ${cust.name},\n\nThe work at your site (${wo.siteName||wo.category}) has been completed by our team.\n\nWork Order: ${wo.workOrderNo}\nCategory: ${wo.category}\n\nKindly confirm you are satisfied with the work so we can close the order.\n\nReply CONFIRM to approve or call us if you have any concerns.\n\nThank you!\n— V Wholesale`
  );
  window.open(`https://wa.me/91${cust.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
  wo.stage = 'signed_off';
  wo.signoffRequestedAt = new Date().toISOString();
  await VW_DB.put(VW_DB.STORES.workOrders, wo);
  showToast('Sign-off request sent', 'success');
  closeSheet();
}

async function assignVendor(workOrderId) {
  const vendors = await VW_DB.all(VW_DB.STORES.serviceVendors);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Assign Service Vendor</h3>
    <div class="form-group"><label>Select Vendor</label>
      <select id="assign-vendor">
        <option value="">— Select —</option>
        ${vendors.map(v => `<option value="${v.id}" data-name="${v.name}" data-phone="${v.phone||''}">${v.name} · ${v.categories?.join(', ')||'General'}</option>`).join('')}
      </select>
    </div>
    <button class="btn-primary full-width" onclick="VW_SERVICE.confirmAssignVendor(${workOrderId})">Assign & Notify</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_SERVICE.openWorkOrder(${workOrderId})">Cancel</button>
  `;
}

async function confirmAssignVendor(workOrderId) {
  const sel = document.getElementById('assign-vendor');
  const vendorId = parseInt(sel?.value);
  if (!vendorId) { showToast('Select a vendor', 'warn'); return; }
  const opt = sel?.options[sel.selectedIndex];
  const wo = await VW_DB.getById(VW_DB.STORES.workOrders, workOrderId);
  if (!wo) return;
  wo.serviceVendorId = vendorId;
  wo.vendorName = opt?.dataset.name||'';
  wo.vendorPhone = opt?.dataset.phone||'';
  wo.stage = 'assigned';
  await VW_DB.put(VW_DB.STORES.workOrders, wo);
  // Notify vendor
  if (opt?.dataset.phone) {
    const msg = encodeURIComponent(`Dear ${wo.vendorName},\n\nNew work order assigned: ${wo.workOrderNo}\nCustomer: ${wo.customerName}\nWork: ${wo.category}\nSite: ${wo.siteName||'—'}\nValue: ₹${(wo.totalValue||0).toLocaleString('en-IN')}\n\nPlease confirm availability.\n\n— V Wholesale`);
    window.open(`https://wa.me/91${opt.dataset.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
  }
  showToast(`Assigned to ${wo.vendorName}`, 'success');
  await openWorkOrder(workOrderId);
}

async function rateServiceVendor(vendorId) {
  if (!vendorId) return;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Rate Service Vendor</h3>
    <p class="sheet-meta">How was the quality of work?</p>
    <div style="display:flex;gap:10px;justify-content:center;padding:16px 0">
      ${[1,2,3,4,5].map(n => `
        <button onclick="VW_SERVICE.submitVendorRating(${vendorId},${n})" style="background:none;border:2px solid var(--border);border-radius:50%;width:48px;height:48px;font-size:20px;cursor:pointer">
          ${'★'}
        </button>`).join('')}
    </div>
    <button class="btn-secondary full-width" onclick="closeSheet()">Cancel</button>
  `;
}

async function submitVendorRating(vendorId, rating) {
  const v = await VW_DB.getById(VW_DB.STORES.serviceVendors, vendorId);
  if (!v) return;
  v.ratings = [...(v.ratings||[]), rating];
  await VW_DB.put(VW_DB.STORES.serviceVendors, v);
  showToast(`Rated ${rating}★`, 'success');
  closeSheet();
}

window.VW_SERVICE = {
  renderServicePage, switchSvcTab,
  showAddServiceVendor, saveServiceVendor, openServiceVendor,
  showAddWorkOrder, saveWorkOrder, openWorkOrder,
  updateStage, recordPayment, confirmPayment,
  addProgressPhoto, previewPhoto, saveProgressPhoto,
  requestCustomerSignoff, assignVendor, confirmAssignVendor,
  rateServiceVendor, submitVendorRating
};




/* === employee_app.js === */

// ============================================================
// EMPLOYEE SELF-SERVICE APP + KIOSK — Session 9
// Kiosk Punch In/Out · Employee Dashboard · Breaks · Chat
// Birthday/Anniversary · Leave Tracker · Announcements
// ============================================================

// Store GPS coordinates — update exact location from Google Maps
const STORE_LAT = 16.5206153;
const STORE_LNG = 80.5999189;
const BREAK_GEOFENCE_METERS = 50;
const PUNCH_GEOFENCE_METERS = 50;

// =====================================================
// KIOSK MODE — opened via ?kiosk=1
// Full screen, no login needed
// =====================================================
async function renderKioskMode() {
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const active = staff.filter(s => s.active !== false);
  const today = new Date().toISOString().split('T')[0];
  const attendance = await VW_DB.all(VW_DB.STORES.attendance);
  const todayAtt = {};
  attendance.filter(a => a.date === today).forEach(a => todayAtt[a.staffId] = a);

  const presentCount = Object.values(todayAtt).filter(a => a.punchIn && !a.punchOut).length;
  const now = new Date();

  // Start clock BEFORE returning — 100ms delay lets the HTML land in the DOM first
  setTimeout(() => {
    setInterval(() => {
      const el = document.getElementById('kiosk-clock');
      if (el) el.textContent = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    }, 1000);
  }, 100);

  return `
  <style>
    body { overflow: hidden; }
    .kiosk-wrap { min-height: 100vh; background: var(--header-bg); padding: 0; }
    .kiosk-header { background: linear-gradient(90deg, #C8972B, #f5c842); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
    .kiosk-time { font-size: 28px; font-weight: 700; color: #000; }
    .kiosk-date { font-size: 13px; color: #333; }
    .kiosk-present { background: rgba(0,0,0,0.2); padding: 6px 12px; border-radius: 20px; font-size: 13px; color: #000; font-weight: 600; }
    .kiosk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px; }
    .kiosk-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(200,151,43,0.2); border-radius: 16px; padding: 16px 12px; text-align: center; cursor: pointer; transition: all 0.2s; -webkit-tap-highlight-color: transparent; }
    .kiosk-card:active { transform: scale(0.96); background: rgba(200,151,43,0.15); }
    .kiosk-avatar { width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff; }
    .kiosk-name { font-size: 12px; font-weight: 600; color: #fff; margin-bottom: 4px; line-height: 1.3; }
    .kiosk-status { font-size: 10px; padding: 2px 8px; border-radius: 10px; display: inline-block; }
    .status-in { background: rgba(34,197,94,0.2); color: #22c55e; }
    .status-out { background: rgba(239,68,68,0.15); color: #ef4444; }
    .status-break { background: rgba(249,115,22,0.2); color: #f97316; }
    .kiosk-punch-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .kiosk-punch-card { background: var(--bg2); border: 2px solid #C8972B; border-radius: 24px; padding: 28px 20px; width: 100%; max-width: 360px; text-align: center; }
  </style>
  <div class="kiosk-wrap" id="kiosk-root">
    <div class="kiosk-header">
      <div>
        <div class="kiosk-time" id="kiosk-clock">${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="kiosk-date">${now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
      <div>
        <div class="kiosk-present">🟢 ${presentCount} In Store</div>
        <div style="font-size:11px;color:#333;margin-top:4px;text-align:center">V Wholesale</div>
      </div>
    </div>
    <p style="text-align:center;color:rgba(255,255,255,0.4);font-size:13px;padding:12px 0 0">Tap your name to Punch In or Out</p>
    <div class="kiosk-grid">
      ${active.map(s => {
        const att = todayAtt[s.id];
        const isIn = att?.punchIn && !att?.punchOut;
        const isOnBreak = att?.currentlyOnBreak;
        const status = isOnBreak ? 'break' : isIn ? 'in' : 'out';
        const statusLabel = isOnBreak ? '☕ On Break' : isIn ? `✓ In ${att.punchIn?.slice(0,5)||''}` : '— Not Punched';
        const color = `hsl(${(s.id||1)*47},65%,40%)`;
        return `
        <div class="kiosk-card" onclick="VW_EMPLOYEE.openKioskPunch(${s.id},'${s.name.replace(/'/g,"\\'")}','${status}')">
          <div class="kiosk-avatar" style="background:${color}">${s.name[0].toUpperCase()}</div>
          <div class="kiosk-name">${s.name.split(' ')[0]}</div>
          <div class="kiosk-status status-${status}">${statusLabel}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

async function openKioskPunch(staffId, staffName, currentStatus) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  const isIn = currentStatus === 'in' || currentStatus === 'break';
  const action = isIn ? 'Punch Out' : 'Punch In';
  const actionColor = isIn ? '#ef4444' : '#22c55e';

  const overlay = document.createElement('div');
  overlay.className = 'kiosk-punch-overlay';
  overlay.id = 'kiosk-overlay';
  overlay.innerHTML = `
    <div class="kiosk-punch-card">
      <div style="font-size:40px;margin-bottom:12px">${isIn ? '👋' : '👋'}</div>
      <h2 style="color:#fff;margin:0 0 4px;font-size:22px">${staffName.split(' ')[0]}</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:20px">${timeStr} · ${now.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
      <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin-bottom:20px">
        <div style="font-size:13px;color:rgba(255,255,255,0.6)">Current Status</div>
        <div style="font-size:16px;color:${currentStatus==='in'?'#22c55e':currentStatus==='break'?'#f97316':'#ef4444'};font-weight:600;margin-top:4px">
          ${currentStatus==='in'?'✓ In Store':currentStatus==='break'?'☕ On Break':'— Not Punched In'}
        </div>
      </div>
      <button style="background:${actionColor};color:#fff;border:none;border-radius:14px;padding:16px;width:100%;font-size:18px;font-weight:700;cursor:pointer;margin-bottom:10px" onclick="VW_EMPLOYEE.confirmKioskPunch(${staffId},'${action}')">
        ${action}
      </button>
      <button style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);border:none;border-radius:14px;padding:12px;width:100%;font-size:14px;cursor:pointer" onclick="document.getElementById('kiosk-overlay').remove()">
        Cancel
      </button>
    </div>`;
  document.body.appendChild(overlay);
}

async function confirmKioskPunch(staffId, action) {
  await recordKioskPunch(staffId, action);
}

async function recordKioskPunch(staffId, action, locationFailed) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0,5);
  const all = await VW_DB.all(VW_DB.STORES.attendance);
  const existing = all.find(a => a.staffId === staffId && a.date === today);

  if (action === 'Punch In') {
    if (existing) {
      existing.punchIn = existing.punchIn || timeStr;
      existing.finalWorking = 1;
      await VW_DB.put(VW_DB.STORES.attendance, existing);
    } else {
      await VW_DB.put(VW_DB.STORES.attendance, {
        staffId, date: today, punchIn: timeStr,
        finalWorking: 1, currentlyOnBreak: false,
        createdAt: now.toISOString()
      });
    }
  } else {
    if (existing) {
      existing.punchOut = timeStr;
      existing.currentlyOnBreak = false;
      // Calculate hours worked
      if (existing.punchIn) {
        const inParts = existing.punchIn.split(':').map(Number);
        const outParts = timeStr.split(':').map(Number);
        const hoursWorked = (outParts[0]*60+outParts[1] - inParts[0]*60-inParts[1]) / 60;
        existing.hoursWorked = Math.max(0, hoursWorked).toFixed(2);
      }
      await VW_DB.put(VW_DB.STORES.attendance, existing);
    }
  }

  // Show success and auto-close
  const overlay = document.getElementById('kiosk-overlay');
  if (overlay) {
    overlay.innerHTML = `
      <div class="kiosk-punch-card" style="text-align:center">
        <div style="font-size:60px;margin-bottom:12px">${action==='Punch In'?'✅':'👋'}</div>
        <h2 style="color:#fff;font-size:24px;margin:0 0 8px">${action} Successful!</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:15px">${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
        <div style="margin-top:16px;color:var(--gold);font-size:14px">Have a great ${action==='Punch In'?'day':'evening'}! 🙏</div>
      </div>`;
    setTimeout(() => {
      overlay.remove();
      // Refresh kiosk
      navigateTo('kiosk');
    }, 2500);
  }
  showToast(`${action} recorded`, 'success');
}

// =====================================================
// EMPLOYEE HOME DASHBOARD
// =====================================================
async function renderEmployeeDashboard() {
  const profile = VW_AUTH.getCurrentProfile();
  const [staff, allAtt, announcements, tasks, leaves] = await Promise.all([
    VW_DB.all(VW_DB.STORES.staff),
    VW_DB.all(VW_DB.STORES.attendance),
    VW_DB.all(VW_DB.STORES.announcements),
    VW_DB.all(VW_DB.STORES.tasks),
    VW_DB.all(VW_DB.STORES.leaves)
  ]);

  // Find this employee's staff record by matching name
  const myStaff = staff.find(s =>
    s.name === profile?.name ||
    s.attendanceName === profile?.name ||
    s.name?.toLowerCase().includes((profile?.name||'').toLowerCase().split(' ')[0])
  );

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const myTodayAtt = myStaff ? allAtt.find(a => a.staffId === myStaff.id && a.date === today) : null;
  const isIn = myTodayAtt?.punchIn && !myTodayAtt?.punchOut;
  const onBreak = myTodayAtt?.currentlyOnBreak;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const myMonthAtt = myStaff ? allAtt.filter(a => a.staffId === myStaff.id && new Date(a.date) >= monthStart) : [];
  const presentDays = myMonthAtt.reduce((s,a) => s+(a.finalWorking||0), 0);
  const myPendingLeave = leaves.filter(l => l.staffId === myStaff?.id && l.status === 'pending');
  const myTasks = tasks.filter(t => t.assignedToName === profile?.name && t.status !== 'resolved');
  const pinned = announcements.filter(a => a.pinned).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,3);
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Check birthdays/anniversaries today
  const todayMD = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const birthdayPeople = staff.filter(s => s.dateOfBirth && s.dateOfBirth.slice(5) === todayMD);
  const anniversaryPeople = staff.filter(s => s.joiningDate && s.joiningDate.slice(5) === todayMD && s.id !== myStaff?.id);

  return `
  <style>
    .emp-punch-card { background: linear-gradient(135deg, var(--bg2), var(--bg)); border: 1px solid rgba(200,151,43,0.3); border-radius: 20px; padding: 20px; margin-bottom: 14px; }
    .punch-status-ring { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 10px; border: 3px solid; }
    .emp-quick-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 14px 10px; text-align: center; cursor: pointer; transition: all 0.2s; -webkit-tap-highlight-color: transparent; }
    .emp-quick-btn:active { transform: scale(0.95); background: rgba(200,151,43,0.15); }
    .emp-quick-icon { font-size: 24px; display: block; margin-bottom: 6px; }
    .emp-quick-label { font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; }
    .announce-card { background: rgba(200,151,43,0.08); border: 1px solid rgba(200,151,43,0.2); border-radius: 12px; padding: 12px; margin-bottom: 8px; }
    .emp-stat { background: rgba(255,255,255,0.04); border-radius: 12px; padding: 12px; text-align: center; }
  </style>

  <!-- Greeting -->
  <div style="padding: 4px 0 14px">
    <div style="font-size: 22px; font-weight: 700; color: #fff;">${greeting}, ${(profile?.name||'').split(' ')[0]}! ${hour < 12 ? '☀️' : hour < 17 ? '🌤' : '🌙'}</div>
    <div style="font-size: 13px; color: rgba(255,255,255,0.4);">${now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
  </div>

  ${(birthdayPeople.length || anniversaryPeople.length) ? `
  <div style="background:linear-gradient(135deg,rgba(200,151,43,0.2),rgba(200,151,43,0.05));border:1px solid rgba(200,151,43,0.4);border-radius:16px;padding:14px;margin-bottom:14px">
    ${birthdayPeople.map(p => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="font-size:28px">🎂</div>
      <div>
        <div style="font-weight:700;color:#fff">Happy Birthday, ${p.name.split(' ')[0]}!</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5)">Wishing you a wonderful day 🎉</div>
      </div>
      ${p.phone ? `<button style="margin-left:auto;background:var(--gold);color:#000;border:none;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer" onclick="window.open('https://wa.me/91${p.phone.replace(/\D/g,'')}?text=${encodeURIComponent('Happy Birthday '+p.name.split(' ')[0]+'! 🎂🎉 Wishing you a wonderful year ahead! — V Wholesale Family')}','_blank')">💬 Wish</button>` : ''}
    </div>`).join('')}
    ${anniversaryPeople.map(p => `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-size:28px">🎊</div>
      <div>
        <div style="font-weight:700;color:#fff">Work Anniversary — ${p.name.split(' ')[0]}!</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5)">Thank you for being with us 🙏</div>
      </div>
    </div>`).join('')}
  </div>` : ''}

  <!-- Punch Status Card -->
  <div class="emp-punch-card">
    <div class="punch-status-ring" style="border-color:${onBreak?'#f97316':isIn?'#22c55e':'rgba(255,255,255,0.2)'};background:${onBreak?'rgba(249,115,22,0.1)':isIn?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.05)'}">
      ${onBreak ? '☕' : isIn ? '✅' : myTodayAtt?.punchOut ? '🏠' : '⏰'}
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:18px;font-weight:700;color:${onBreak?'#f97316':isIn?'#22c55e':'rgba(255,255,255,0.6)'}">
        ${onBreak ? 'On Break' : isIn ? 'In Store' : myTodayAtt?.punchOut ? 'Punched Out' : 'Not Checked In'}
      </div>
      ${myTodayAtt?.punchIn ? `<div style="font-size:12px;color:rgba(255,255,255,0.4)">In: ${myTodayAtt.punchIn?.slice(0,5)||'—'}${myTodayAtt?.punchOut?' · Out: '+myTodayAtt.punchOut?.slice(0,5):''}</div>` : ''}
    </div>
    <!-- Quick actions grid -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      <div class="emp-quick-btn" onclick="VW_EMPLOYEE.requestBreakOut()">
        <span class="emp-quick-icon">🚶</span><span class="emp-quick-label">Break Out</span>
      </div>
      <div class="emp-quick-btn" onclick="VW_EMPLOYEE.requestBreakIn()">
        <span class="emp-quick-icon">🔙</span><span class="emp-quick-label">Break In</span>
      </div>
      <div class="emp-quick-btn" onclick="VW_EMPLOYEE.showApplyLeaveEmp()">
        <span class="emp-quick-icon">📅</span><span class="emp-quick-label">Apply Leave</span>
      </div>
      <div class="emp-quick-btn" onclick="VW_EMPLOYEE.showMyPayslip()">
        <span class="emp-quick-icon">💰</span><span class="emp-quick-label">My Payslip</span>
      </div>
      <div class="emp-quick-btn" onclick="VW_EMPLOYEE.showMyAttendance()">
        <span class="emp-quick-icon">📋</span><span class="emp-quick-label">Attendance</span>
      </div>
      <div class="emp-quick-btn" onclick="VW_EMPLOYEE.openEmpChat()">
        <span class="emp-quick-icon">💬</span><span class="emp-quick-label">Team Chat</span>
      </div>
    </div>
  </div>

  <!-- Stats row -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
    <div class="emp-stat">
      <div style="font-size:20px;font-weight:700;color:#22c55e">${presentDays}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4)">Days This Month</div>
    </div>
    <div class="emp-stat">
      <div style="font-size:20px;font-weight:700;color:var(--gold)">${myTasks.length}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4)">Open Tasks</div>
    </div>
    <div class="emp-stat">
      <div style="font-size:20px;font-weight:700;color:${myPendingLeave.length?'#f97316':'rgba(255,255,255,0.6)'}">${myPendingLeave.length}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4)">Pending Leave</div>
    </div>
  </div>

  <!-- My Tasks today -->
  ${myTasks.length ? `
  <div style="margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:8px">📋 My Tasks</div>
    ${myTasks.slice(0,3).map(t => `
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;margin-bottom:6px" onclick="VW_TASKS.openTaskDetail(${t.id})">
      <div style="font-size:13px;font-weight:600;color:#fff">${t.description||'Task'}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px">${t.department||'—'} · ${t.customerName||'—'}</div>
    </div>`).join('')}
  </div>` : ''}

  <!-- Announcements -->
  ${pinned.length ? `
  <div>
    <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:8px">📢 Announcements</div>
    ${pinned.map(a => `
    <div class="announce-card">
      <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:4px">${a.title}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.7)">${a.body}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:6px">${new Date(a.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · ${a.postedByName||'Management'}</div>
    </div>`).join('')}
  </div>` : ''}`;
}

// =====================================================
// BREAK OUT / BREAK IN with Geofence
// =====================================================
async function requestBreakOut() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>☕ Break Out</h3>
    <p style="font-size:13px;color:var(--text3);margin-bottom:14px">Checking your location... must be within ${BREAK_GEOFENCE_METERS}m of store to punch break.</p>
    <div id="break-location-status" style="text-align:center;padding:16px">
      <div class="spinner"></div>
      <p style="color:var(--text3);font-size:13px;margin-top:8px">Getting location...</p>
    </div>
    <div id="break-form" style="display:none">
      <div class="form-group"><label>Reason *</label>
        <select id="break-reason">
          <option>Lunch</option>
          <option>Office Work</option>
          <option>Delivery</option>
          <option>Purchase</option>
          <option>Personal</option>
          <option>Other</option>
        </select>
      </div>
      <div class="form-group"><label>Vehicle</label>
        <select id="break-vehicle">
          <option value="">None / On Foot</option>
          <option>Bike (Personal)</option>
          <option>Bike Blue</option>
          <option>Auto</option>
          <option>Car</option>
          <option>Public Transport</option>
        </select>
      </div>
      <button class="btn-primary full-width" onclick="VW_EMPLOYEE.confirmBreakOut()">🚶 Punch Break Out</button>
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  // Get location
  await checkGeofence(BREAK_GEOFENCE_METERS, 'break-location-status', 'break-form');
}

async function requestBreakIn() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>🔙 Break In</h3>
    <p style="font-size:13px;color:var(--text3);margin-bottom:14px">Checking you are back at the store...</p>
    <div id="breakin-location-status" style="text-align:center;padding:16px">
      <div class="spinner"></div>
      <p style="color:var(--text3);font-size:13px;margin-top:8px">Getting location...</p>
    </div>
    <div id="breakin-form" style="display:none">
      <div class="form-group"><label>Vehicle Returned</label>
        <select id="breakin-vehicle">
          <option value="">None</option>
          <option>Bike (Personal)</option>
          <option>Bike Blue</option>
          <option>Auto</option>
          <option>Car</option>
        </select>
      </div>
      <button class="btn-primary full-width" onclick="VW_EMPLOYEE.confirmBreakIn()">✅ Punch Break In</button>
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  await checkGeofence(BREAK_GEOFENCE_METERS, 'breakin-location-status', 'breakin-form');
}

async function checkGeofence(radiusMeters, statusElId, formElId) {
  if (!navigator.geolocation) {
    document.getElementById(statusElId).innerHTML = `<p style="color:var(--red)">❌ Location not supported on this device</p>`;
    document.getElementById(formElId).style.display = '';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const dist = getDistance(pos.coords.latitude, pos.coords.longitude, STORE_LAT, STORE_LNG);
      const statusEl = document.getElementById(statusElId);
      const formEl = document.getElementById(formElId);
      if (dist <= radiusMeters) {
        if (statusEl) statusEl.innerHTML = `<div style="color:#22c55e;font-size:13px">✅ Location verified — ${Math.round(dist)}m from store</div>`;
        if (formEl) formEl.style.display = '';
      } else {
        if (statusEl) statusEl.innerHTML = `
          <div style="color:var(--red);font-size:13px;padding:10px">
            ❌ You are ${Math.round(dist)}m away from the store.<br>
            Must be within ${radiusMeters}m to punch break.<br>
            <span style="color:rgba(255,255,255,0.4);font-size:11px">Walk closer to the store and try again.</span>
          </div>
          <button class="btn-secondary" style="margin-top:8px" onclick="VW_EMPLOYEE.checkGeofenceRetry('${statusElId}','${formElId}',${radiusMeters})">🔄 Retry</button>`;
      }
    },
    (err) => {
      const el = document.getElementById(statusElId);
      if (el) el.innerHTML = `<p style="color:var(--gold);font-size:12px">⚠️ Could not get location. ${err.message}</p>`;
      // Allow punch anyway if location fails (admin can review)
      const formEl = document.getElementById(formElId);
      if (formEl) formEl.style.display = '';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function checkGeofenceRetry(statusElId, formElId, radius) {
  const el = document.getElementById(statusElId);
  if (el) el.innerHTML = '<div class="spinner"></div>';
  checkGeofence(radius, statusElId, formElId);
}
window.checkGeofenceRetry = checkGeofenceRetry;

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function confirmBreakOut() {
  const profile = VW_AUTH.getCurrentProfile();
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const myStaff = staff.find(s => s.name === profile?.name || s.attendanceName === profile?.name);
  if (!myStaff) { showToast('Staff record not found', 'warn'); return; }
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0,5);
  const all = await VW_DB.all(VW_DB.STORES.attendance);
  let att = all.find(a => a.staffId === myStaff.id && a.date === today);
  if (!att) { showToast('Please punch in first', 'warn'); return; }
  const breaks = att.breaks || [];
  breaks.push({
    reason: document.getElementById('break-reason')?.value||'Lunch',
    vehicle: document.getElementById('break-vehicle')?.value||'',
    outTime: timeStr, inTime: null,
    deductible: ['Lunch','Personal'].includes(document.getElementById('break-reason')?.value)
  });
  att.breaks = breaks;
  att.currentlyOnBreak = true;
  await VW_DB.put(VW_DB.STORES.attendance, att);
  showToast('Break out recorded 🚶', 'success');
  closeSheet();
  navigateTo('employeeapp');
}

async function confirmBreakIn() {
  const profile = VW_AUTH.getCurrentProfile();
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const myStaff = staff.find(s => s.name === profile?.name || s.attendanceName === profile?.name);
  if (!myStaff) { showToast('Staff record not found', 'warn'); return; }
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0,5);
  const all = await VW_DB.all(VW_DB.STORES.attendance);
  let att = all.find(a => a.staffId === myStaff.id && a.date === today);
  if (!att) return;
  const breaks = att.breaks || [];
  const openBreak = [...breaks].reverse().find(b => !b.inTime);
  if (openBreak) { openBreak.inTime = timeStr; openBreak.vehicleReturned = document.getElementById('breakin-vehicle')?.value||''; }
  att.breaks = breaks;
  att.currentlyOnBreak = false;
  await VW_DB.put(VW_DB.STORES.attendance, att);
  showToast('Break in recorded ✅', 'success');
  closeSheet();
  navigateTo('employeeapp');
}

// =====================================================
// TEAM CHAT
// =====================================================
async function openEmpChat() {
  const [messages, staff] = await Promise.all([
    VW_DB.all(VW_DB.STORES.chatMessages),
    VW_DB.all(VW_DB.STORES.staff)
  ]);
  const profile = VW_AUTH.getCurrentProfile();
  const groups = [
    { id: 'general', name: '🏠 V Wholesale Team', type: 'group' },
    { id: 'management', name: '👔 Management', type: 'group' },
    { id: 'sales', name: '💼 Sales Team', type: 'group' },
  ];
  // 1-on-1 chats
  const myDirects = [...new Set(
    messages.filter(m => m.toId === profile?.id || m.fromId === profile?.id)
      .map(m => m.fromId === profile?.id ? m.toId : m.fromId)
  )].filter(id => id && id !== profile?.id);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>💬 Team Chat</h3>
    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px;font-weight:600">CHANNELS</div>
      ${groups.map(g => {
        const count = messages.filter(m => m.channelId === g.id).length;
        const last = messages.filter(m => m.channelId === g.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:var(--bg2)" onclick="VW_EMPLOYEE.openChannel('${g.id}','${g.name}')">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${g.name}</div>
            ${last ? `<div style="font-size:11px;color:var(--text3)">${last.senderName}: ${(last.text||'').slice(0,40)}</div>` : `<div style="font-size:11px;color:var(--text3)">No messages yet</div>`}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px;font-weight:600">DIRECT MESSAGES</div>
      ${staff.filter(s=>s.active!==false && s.name !== profile?.name).slice(0,8).map(s => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:var(--bg2)" onclick="VW_EMPLOYEE.openDM(${s.id},'${s.name.replace(/'/g,"\\'")}')">
          <div style="width:36px;height:36px;border-radius:50%;background:hsl(${(s.id)*47},60%,35%);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">${s.name[0]}</div>
          <div style="font-size:13px;font-weight:600">${s.name}</div>
          <div style="margin-left:auto;font-size:11px;color:var(--text3)">${s.designation||''}</div>
        </div>`).join('')}
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Close</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function openChannel(channelId, channelName) {
  const profile = VW_AUTH.getCurrentProfile();
  const allMessages = await VW_DB.all(VW_DB.STORES.chatMessages);
  const msgs = allMessages.filter(m => m.channelId === channelId).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  renderChatWindow(channelName, msgs, async (text) => {
    await VW_DB.put(VW_DB.STORES.chatMessages, {
      channelId, text,
      fromId: profile?.id, senderName: profile?.name||'',
      createdAt: new Date().toISOString()
    });
  });
}

async function openDM(toStaffId, toName) {
  const profile = VW_AUTH.getCurrentProfile();
  const allMessages = await VW_DB.all(VW_DB.STORES.chatMessages);
  const msgs = allMessages.filter(m =>
    (m.fromId === profile?.id && m.toId === String(toStaffId)) ||
    (m.toId === profile?.id && m.fromId === String(toStaffId))
  ).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  renderChatWindow(toName, msgs, async (text) => {
    await VW_DB.put(VW_DB.STORES.chatMessages, {
      toId: String(toStaffId), text,
      fromId: profile?.id, senderName: profile?.name||'',
      isDm: true, createdAt: new Date().toISOString()
    });
  });
}

function renderChatWindow(title, msgs, sendFn) {
  const profile = VW_AUTH.getCurrentProfile();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 0 10px">
      <button onclick="VW_EMPLOYEE.openEmpChat()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer">←</button>
      <h3 style="margin:0;flex:1">${title}</h3>
    </div>
    <div id="chat-messages" style="height:300px;overflow-y:auto;padding:4px 0;display:flex;flex-direction:column;gap:6px">
      ${!msgs.length ? '<p style="text-align:center;color:var(--text3);font-size:13px;padding:20px">No messages yet — say hi! 👋</p>' :
      msgs.map(m => {
        const isMe = m.senderName === profile?.name || m.fromId === profile?.id;
        return `
        <div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'}">
          ${!isMe ? `<div style="font-size:10px;color:var(--text3);margin-bottom:2px;padding:0 4px">${m.senderName||'?'}</div>` : ''}
          <div style="max-width:75%;padding:8px 12px;border-radius:${isMe?'16px 16px 4px 16px':'16px 16px 16px 4px'};background:${isMe?'var(--gold)':'rgba(255,255,255,0.08)'};color:${isMe?'#000':'#fff'};font-size:13px">
            ${m.text}
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;padding:0 4px">${new Date(m.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--border)">
      <input type="text" id="chat-input" placeholder="Type a message..." style="flex:1" onkeydown="if(event.key==='Enter')VW_EMPLOYEE.sendChatMsg()">
      <button class="btn-primary" onclick="VW_EMPLOYEE.sendChatMsg()" style="flex-shrink:0">Send</button>
    </div>
  `;
  window._chatSendFn = sendFn;
  // Scroll to bottom
  setTimeout(() => {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 100);
}

async function sendChatMsg() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text || !window._chatSendFn) return;
  input.value = '';
  await window._chatSendFn(text);
  // Reload chat
  const msgs = await VW_DB.all(VW_DB.STORES.chatMessages);
  const profile = VW_AUTH.getCurrentProfile();
  // Re-render messages area
  const container = document.getElementById('chat-messages');
  if (container) {
    const relevantMsgs = msgs.filter(m => m.channelId || (m.fromId === profile?.id || m.toId === profile?.id))
      .sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt)).slice(-50);
    // Simple re-render
    container.innerHTML = relevantMsgs.map(m => {
      const isMe = m.senderName === profile?.name || m.fromId === profile?.id;
      return `<div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'}">
        ${!isMe ? `<div style="font-size:10px;color:var(--text3);margin-bottom:2px;padding:0 4px">${m.senderName||'?'}</div>` : ''}
        <div style="max-width:75%;padding:8px 12px;border-radius:${isMe?'16px 16px 4px 16px':'16px 16px 16px 4px'};background:${isMe?'var(--gold)':'rgba(255,255,255,0.08)'};color:${isMe?'#000':'#fff'};font-size:13px">${m.text}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;padding:0 4px">${new Date(m.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }
}

// =====================================================
// ANNOUNCEMENTS (Admin Posts, Staff Reads)
// =====================================================
async function showPostAnnouncement() {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>📢 Post Announcement</h3>
    <div class="form-group"><label>Title *</label><input type="text" id="ann-title" placeholder="e.g. Store Timing Change"></div>
    <div class="form-group"><label>Message *</label><textarea id="ann-body" style="height:100px" placeholder="Write your announcement..."></textarea></div>
    <div class="form-group"><label>Priority</label>
      <select id="ann-priority">
        <option value="normal">Normal</option>
        <option value="important">⚠️ Important</option>
        <option value="urgent">🚨 Urgent</option>
      </select>
    </div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px;cursor:pointer">
      <input type="checkbox" id="ann-pinned" checked> Pin to top (stays on everyone's home screen)
    </label>
    <button class="btn-primary full-width" onclick="VW_EMPLOYEE.saveAnnouncement()">Post Announcement</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveAnnouncement() {
  const title = document.getElementById('ann-title')?.value.trim();
  const body = document.getElementById('ann-body')?.value.trim();
  if (!title || !body) { showToast('Title and message required', 'warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.announcements, {
    title, body,
    priority: document.getElementById('ann-priority')?.value||'normal',
    pinned: document.getElementById('ann-pinned')?.checked||false,
    postedByName: profile?.name||'',
    createdAt: new Date().toISOString()
  });
  showToast('Announcement posted', 'success');
  closeSheet();
}

// =====================================================
// LEAVE APPLICATION (Employee facing)
// =====================================================
async function showMyPayslip() {
  const profile = VW_AUTH.getCurrentProfile();
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const myStaff = staff.find(s => s.name === profile?.name || s.attendanceName === profile?.name);
  if (!myStaff) { showToast('Staff record not linked to your account. Contact HR.', 'warn'); return; }
  await VW_HR_PAYROLL.generatePayslip(myStaff.id);
}

async function showMyAttendance() {
  const profile = VW_AUTH.getCurrentProfile();
  const [staff, allAtt] = await Promise.all([VW_DB.all(VW_DB.STORES.staff), VW_DB.all(VW_DB.STORES.attendance)]);
  const myStaff = staff.find(s => s.name === profile?.name || s.attendanceName === profile?.name);
  if (!myStaff) { showToast('Staff record not found', 'warn'); return; }
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const myAtt = allAtt.filter(a => a.staffId === myStaff.id && new Date(a.date) >= monthStart)
    .sort((a,b) => new Date(a.date)-new Date(b.date));
  const presentDays = myAtt.reduce((s,a)=>s+(a.finalWorking||0),0);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>📋 My Attendance — ${now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:#22c55e">${presentDays}</div>
        <div style="font-size:11px;color:var(--text3)">Days Present</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:var(--red)">${Math.max(0,now.getDate()-presentDays)}</div>
        <div style="font-size:11px;color:var(--text3)">Absent/LOP</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:700">${daysInMonth}</div>
        <div style="font-size:11px;color:var(--text3)">Working Days</div>
      </div>
    </div>
    <div style="max-height:300px;overflow-y:auto">
      ${myAtt.map(a => {
        const d = new Date(a.date);
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2);font-size:13px">
          <span>${d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span>
          <div style="display:flex;gap:8px;color:var(--text3);font-size:12px">
            ${a.punchIn?`<span>In: ${a.punchIn?.slice(0,5)}</span>`:''}
            ${a.punchOut?`<span>Out: ${a.punchOut?.slice(0,5)}</span>`:''}
            ${(a.breaks||[]).length?`<span>☕ ${a.breaks.length} break${a.breaks.length>1?'s':''}</span>`:''}
          </div>
          <span style="color:${a.finalWorking>=1?'#22c55e':a.finalWorking===0.5?'var(--gold)':'var(--red)'}">
            ${a.finalWorking>=1?'✓ Full':a.finalWorking===0.5?'½ Day':'—'}
          </span>
        </div>`;
      }).join('') || '<p style="color:var(--text3);font-size:13px;text-align:center;padding:20px">No attendance this month yet</p>'}
    </div>
    <button class="btn-secondary full-width" style="margin-top:10px" onclick="closeSheet()">Close</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function showApplyLeaveEmp() {
  const profile = VW_AUTH.getCurrentProfile();
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const myStaff = staff.find(s => s.name === profile?.name || s.attendanceName === profile?.name);
  const leaves = await VW_DB.all(VW_DB.STORES.leaves);
  const myLeaves = leaves.filter(l => l.staffId === myStaff?.id).sort((a,b)=>new Date(b.appliedAt)-new Date(a.appliedAt));

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>📅 Leave Application</h3>
    <div class="form-group"><label>Leave Type</label>
      <select id="emp-leave-type">
        <option>Casual Leave</option><option>Sick Leave</option>
        <option>Earned Leave</option><option>Loss of Pay</option><option>Compensatory Off</option>
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="form-group"><label>From Date</label><input type="date" id="emp-leave-from" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>To Date</label><input type="date" id="emp-leave-to" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div class="form-group"><label>Reason</label><textarea id="emp-leave-reason" style="height:60px" placeholder="Brief reason..."></textarea></div>
    <button class="btn-primary full-width" onclick="VW_EMPLOYEE.submitLeaveEmp()">Submit Request</button>

    ${myLeaves.length ? `
    <div style="margin-top:16px">
      <div style="font-size:12px;color:var(--text3);font-weight:600;margin-bottom:8px">MY LEAVE HISTORY</div>
      ${myLeaves.slice(0,5).map(l => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2);font-size:12px">
        <div><div style="font-weight:600">${l.type}</div><div style="color:var(--text3)">${new Date(l.fromDate).toLocaleDateString('en-IN')} · ${l.days} day${l.days>1?'s':''}</div></div>
        <span class="badge" style="background:${l.status==='approved'?'#22c55e':l.status==='rejected'?'var(--red)':'var(--gold)'}">${l.status}</span>
      </div>`).join('')}
    </div>` : ''}
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Close</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function submitLeaveEmp() {
  const fromDate = document.getElementById('emp-leave-from')?.value;
  const toDate = document.getElementById('emp-leave-to')?.value;
  if (!fromDate) { showToast('Select dates', 'warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const myStaff = staff.find(s => s.name === profile?.name || s.attendanceName === profile?.name);
  const days = Math.round((new Date(toDate)-new Date(fromDate))/(1000*60*60*24))+1;
  await VW_DB.put(VW_DB.STORES.leaves, {
    staffId: myStaff?.id||null,
    staffName: profile?.name||'',
    type: document.getElementById('emp-leave-type')?.value||'Casual Leave',
    fromDate, toDate, days,
    reason: document.getElementById('emp-leave-reason')?.value||'',
    status: 'pending',
    appliedAt: new Date().toISOString(),
    appliedByName: profile?.name||''
  });
  showToast('Leave request submitted! 🙏', 'success');
  closeSheet();
}

// =====================================================
// BIRTHDAY & ANNIVERSARY ADMIN WIDGET + AUTO WHATSAPP
// =====================================================
async function checkBirthdaysAndAnniversaries() {
  const staff = await VW_DB.all(VW_DB.STORES.staff);
  const today = new Date();
  const todayMD = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const birthdays = staff.filter(s => s.dateOfBirth && s.dateOfBirth.slice(5) === todayMD && s.active !== false);
  const anniversaries = staff.filter(s => {
    if (!s.joiningDate || s.active === false) return false;
    const jd = s.joiningDate.replace(/\./g,'-');
    return jd.slice(5) === todayMD;
  });
  return { birthdays, anniversaries };
}

async function sendBirthdayWishes() {
  const { birthdays, anniversaries } = await checkBirthdaysAndAnniversaries();
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale';

  for (const person of birthdays) {
    if (!person.phone) continue;
    const msg = encodeURIComponent(
      `🎂 Happy Birthday ${person.name.split(' ')[0]}! 🎉\n\nWishing you a wonderful birthday and a year filled with joy and success!\n\nWith love and warm wishes,\nTeam ${storeName} 🏠🙏`
    );
    window.open(`https://wa.me/91${person.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
    await new Promise(r => setTimeout(r, 1500));
  }

  for (const person of anniversaries) {
    if (!person.phone) continue;
    const years = new Date().getFullYear() - new Date(person.joiningDate).getFullYear();
    const msg = encodeURIComponent(
      `🎊 Happy Work Anniversary ${person.name.split(' ')[0]}!\n\nThank you for ${years} year${years>1?'s':''} of dedication and hard work at ${storeName}! You are truly valued. 🙏\n\n— Team ${storeName}`
    );
    window.open(`https://wa.me/91${person.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
    await new Promise(r => setTimeout(r, 1500));
  }
  showToast(`Wishes sent to ${birthdays.length + anniversaries.length} people`, 'success');
}

window.VW_EMPLOYEE = {
  renderKioskMode, openKioskPunch, confirmKioskPunch, recordKioskPunch,
  renderEmployeeDashboard,
  requestBreakOut, requestBreakIn, checkGeofence, checkGeofenceRetry,
  confirmBreakOut, confirmBreakIn,
  openEmpChat, openChannel, openDM, sendChatMsg,
  showPostAnnouncement, saveAnnouncement,
  showApplyLeaveEmp, submitLeaveEmp,
  showMyPayslip, showMyAttendance,
  checkBirthdaysAndAnniversaries, sendBirthdayWishes
};




/* === ledger.js === */

// ============================================================
// CUSTOMER LEDGER — full financial history per customer
// Accessed via: navigateTo('ledger', {customerId})
// ============================================================

async function renderCustomerLedger(customerId) {
  if (!customerId) return '<p class="empty-msg">No customer selected</p>';

  const [customer, allInvoices, allQuotations, allReturns, allFeedback, allLoyalty] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.customers, customerId),
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.quotations),
    VW_DB.all(VW_DB.STORES.salesReturns),
    VW_DB.all(VW_DB.STORES.feedback),
    VW_DB.all(VW_DB.STORES.loyaltyTransactions)
  ]);

  if (!customer) return '<p class="empty-msg">Customer not found</p>';

  const digits = (customer.phone||'').replace(/\D/g,'').slice(-10);

  // Gather all data for this customer
  const invoices = allInvoices
    .filter(i => i.customerId === customerId)
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  const quotations = allQuotations
    .filter(q => q.customerId === customerId || (q.contact||'').replace(/\D/g,'').slice(-10) === digits)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const returns = allReturns
    .filter(r => r.customerId === customerId)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const feedback = allFeedback
    .filter(f => f.customerId === customerId || f.phone === customer.phone)
    .sort((a,b) => new Date(b.date||b.createdAt) - new Date(a.date||a.createdAt));

  const loyalty = allLoyalty
    .filter(l => l.customerId === customerId)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Financial summary
  const totalSpend = invoices
    .filter(i => i.approvalStatus === 'approved')
    .reduce((s,i) => s + (i.total||0), 0);
  const totalReturns = returns.reduce((s,r) => s + (r.totalRefund||0), 0);
  const outstandingCredit = invoices
    .filter(i => i.creditSale && !i.paymentVerified && i.approvalStatus === 'approved')
    .reduce((s,i) => s + (i.total||0), 0);
  const loyaltyBalance = customer.loyaltyPoints || 0;
  const avgRating = feedback.length
    ? (feedback.reduce((s,f) => s+(f.rating||0), 0) / feedback.length).toFixed(1)
    : null;

  // Group quotations and invoices by project (siteName)
  const projects = {};
  const addToProject = (siteName, type, item) => {
    const key = siteName || '__no_project__';
    if (!projects[key]) projects[key] = { name: siteName||'General / Walk-in', quotations: [], invoices: [], total: 0 };
    projects[key][type].push(item);
    if (type === 'invoices' && item.approvalStatus === 'approved') projects[key].total += item.total||0;
  };

  quotations.forEach(q => addToProject(q.siteName, 'quotations', q));
  invoices.forEach(i => {
    // Try to match to a project via quotationId or siteName
    const matchedQuote = quotations.find(q => q.id === i.quotationId || (i.invoiceNo && q.invoiceNo === i.invoiceNo));
    addToProject(matchedQuote?.siteName || i.siteName || null, 'invoices', i);
  });

  const projectEntries = Object.entries(projects).sort((a,b) => b[1].total - a[1].total);

  return `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <button onclick="navigateTo('crm')" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;padding:0">←</button>
    <div>
      <h2 style="margin:0;font-size:18px">${customer.name}</h2>
      <p style="margin:0;font-size:12px;color:var(--text3)">${customer.phone} · ${customer.type||'retail'} · ${customer.city||'Vijayawada'}</p>
    </div>
  </div>

  <!-- Summary Cards -->
  <div class="snapshot-grid" style="margin-bottom:14px">
    <div class="snap-item">
      <div class="snap-val" style="color:var(--gold)">₹${totalSpend>=100000?Math.round(totalSpend/100000)+'L':totalSpend>=1000?Math.round(totalSpend/1000)+'K':Math.round(totalSpend).toLocaleString('en-IN')}</div>
      <div class="snap-label">Total Spend</div>
    </div>
    <div class="snap-item">
      <div class="snap-val">${invoices.length}</div>
      <div class="snap-label">Invoices</div>
    </div>
    <div class="snap-item">
      <div class="snap-val" style="color:${outstandingCredit>0?'var(--red)':'#22c55e'}">${outstandingCredit>0?'₹'+Math.round(outstandingCredit/1000)+'K':'₹0'}</div>
      <div class="snap-label">Outstanding</div>
    </div>
    <div class="snap-item">
      <div class="snap-val" style="color:var(--gold)">${loyaltyBalance}</div>
      <div class="snap-label">Points</div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn-primary" style="flex:1" onclick="goToCart(${customerId},null);navigateTo('cart')">🛒 New Bill</button>
    <button class="btn-secondary" style="flex:1" onclick="VW_QUOTATIONS.newQuotation(${customerId})">📋 New Quote</button>
    ${customer.phone ? `<button class="btn-wa" onclick="openWhatsApp('${customer.phone}','${customer.name}')">💬</button>` : ''}
    ${customer.phone ? `<button class="btn-call" onclick="callPhone('${customer.phone}')">📞</button>` : ''}
  </div>

  ${outstandingCredit > 0 ? `
  <div style="padding:10px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;margin-bottom:12px">
    <div style="font-weight:700;color:var(--red);font-size:13px">⚠️ Outstanding Balance: ₹${Math.round(outstandingCredit).toLocaleString('en-IN')}</div>
    <div style="font-size:12px;color:var(--text3);margin-top:2px">Credit sales pending payment — collect before next order</div>
  </div>` : ''}

  <!-- Projects View -->
  ${projectEntries.length > 1 ? `
  <div class="card">
    <h3 class="card-title">Projects / Sites <span class="badge">${projectEntries.length}</span></h3>
    ${projectEntries.map(([key, proj]) => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border2)" onclick="toggleLedgerProject('${key.replace(/'/g,"\\'")}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:13px">${proj.name}</div>
          <div style="font-size:12px;color:var(--text3)">${proj.quotations.length} quote${proj.quotations.length!==1?'s':''} · ${proj.invoices.length} invoice${proj.invoices.length!==1?'s':''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;color:var(--gold)">₹${Math.round(proj.total).toLocaleString('en-IN')}</div>
          <div style="font-size:11px;color:var(--text3)">▾ tap to expand</div>
        </div>
      </div>
      <div id="proj-${key.replace(/[^a-zA-Z0-9]/g,'-')}" style="display:none;margin-top:8px">
        ${proj.invoices.map(i => `
        <div style="display:flex;justify-content:space-between;padding:6px 8px;background:var(--bg2);border-radius:6px;margin-bottom:4px;cursor:pointer" onclick="event.stopPropagation();openInvoiceFromTab(${i.id})">
          <span style="font-size:12px">🧾 ${i.invoiceNo} · ${new Date(i.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
          <span style="font-size:13px;font-weight:600">₹${(i.total||0).toLocaleString('en-IN')}</span>
        </div>`).join('')}
        ${proj.quotations.map(q => `
        <div style="display:flex;justify-content:space-between;padding:6px 8px;background:var(--bg2);border-radius:6px;margin-bottom:4px;cursor:pointer" onclick="event.stopPropagation();openQuotationDetail(${q.id})">
          <span style="font-size:12px">📋 ${q.quoteNo||'Q-'+q.id} · ${new Date(q.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
          <span style="font-size:13px;font-weight:600">₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}</span>
        </div>`).join('')}
      </div>
    </div>`).join('')}
  </div>` : ''}

  <!-- Full Invoice History -->
  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Invoice History</h3>
      ${avgRating ? `<span style="font-size:12px;color:var(--gold)">★ ${avgRating} avg</span>` : ''}
    </div>
    ${!invoices.length ? '<p class="empty-msg">No invoices yet</p>' :
    invoices.map(i => {
      const isPending = i.approvalStatus === 'pending_approval';
      const isCredit = i.creditSale;
      return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border2);cursor:pointer" onclick="openInvoiceFromTab(${i.id})">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${i.invoiceNo}</div>
          <div style="font-size:12px;color:var(--text3)">${new Date(i.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})} · ${i.paymentMethod||'—'}</div>
          ${i.salesExecutiveName ? `<div style="font-size:11px;color:var(--text3)">Sales: ${i.salesExecutiveName}</div>` : ''}
          ${i.closurePhoto ? `<div style="font-size:11px;color:#22c55e">📸 Happy moment captured</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;color:${isPending?'var(--gold)':isCredit&&!i.paymentVerified?'var(--red)':'var(--text1)'}">₹${(i.total||0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px;color:${isPending?'var(--gold)':i.paymentVerified?'#22c55e':'var(--text3)'}">${isPending?'Pending approval':i.paymentVerified?'✓ Verified':isCredit?'Credit — unpaid':'Paid'}</div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <!-- Returns -->
  ${returns.length ? `
  <div class="card">
    <h3 class="card-title">Returns & Credit Notes <span class="badge">${returns.length}</span></h3>
    ${returns.map(r => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
      <div>
        <div style="font-size:13px;font-weight:600">${r.creditNoteNo||'Return'}</div>
        <div style="font-size:12px;color:var(--text3)">${new Date(r.createdAt).toLocaleDateString('en-IN')} · ${r.refundMethod}</div>
      </div>
      <div style="font-weight:700;color:var(--red)">−₹${(r.totalRefund||0).toLocaleString('en-IN')}</div>
    </div>`).join('')}
    <div style="display:flex;justify-content:flex-end;padding-top:8px;font-size:13px;color:var(--red);font-weight:700">
      Total returned: ₹${Math.round(totalReturns).toLocaleString('en-IN')}
    </div>
  </div>` : ''}

  <!-- Loyalty -->
  ${loyalty.length ? `
  <div class="card">
    <div class="card-header-row">
      <h3 class="card-title">Loyalty Points</h3>
      <span style="font-weight:700;color:var(--gold)">${loyaltyBalance} pts = ₹${Math.round(loyaltyBalance*0.1).toLocaleString('en-IN')}</span>
    </div>
    ${loyalty.slice(0,8).map(l => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border2);font-size:12px">
      <span style="color:var(--text3)">${l.description||l.type} · ${new Date(l.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
      <span style="font-weight:600;color:${l.points>0?'#22c55e':'var(--red)'}">${l.points>0?'+':''}${l.points} pts</span>
    </div>`).join('')}
    ${loyaltyBalance >= 250 ? `
    <button class="btn-sm" style="margin-top:8px;width:100%" onclick="goToCart(${customerId},null);navigateTo('cart')">Redeem points on next bill</button>` : ''}
  </div>` : ''}

  <!-- Feedback -->
  ${feedback.length ? `
  <div class="card">
    <h3 class="card-title">Feedback & Ratings</h3>
    ${feedback.map(f => `
    <div style="padding:8px 0;border-bottom:1px solid var(--border2)">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--gold)">${'★'.repeat(f.rating||0)}${'☆'.repeat(5-(f.rating||0))}</span>
        <span style="font-size:12px;color:var(--text3)">${new Date(f.date||f.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
      </div>
      ${f.comment ? `<div style="font-size:12px;color:var(--text2);margin-top:3px">"${f.comment}"</div>` : ''}
    </div>`).join('')}
  </div>` : ''}

  <!-- Customer Edit -->
  <div class="card">
    <h3 class="card-title">Customer Details</h3>
    <div style="font-size:13px;display:flex;flex-direction:column;gap:6px">
      <div><span style="color:var(--text3)">Phone:</span> ${customer.phone||'—'}</div>
      <div><span style="color:var(--text3)">Type:</span> ${customer.type||'retail'}</div>
      <div><span style="color:var(--text3)">City/Area:</span> ${customer.city||'—'}</div>
      <div><span style="color:var(--text3)">Address:</span> ${customer.address||'—'}</div>
      <div><span style="color:var(--text3)">Channel:</span> ${customer.preferredChannel||'—'}</div>
      <div><span style="color:var(--text3)">Member since:</span> ${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN') : '—'}</div>
    </div>
    <button class="btn-sm" style="margin-top:10px" onclick="editCustomerDetails(${customerId})">✏️ Edit Details</button>
  </div>
  `;
}

function toggleLedgerProject(key) {
  const safeKey = key.replace(/[^a-zA-Z0-9]/g,'-');
  const el = document.getElementById('proj-'+safeKey);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}
window.toggleLedgerProject = toggleLedgerProject;

async function editCustomerDetails(customerId) {
  const c = await VW_DB.getById(VW_DB.STORES.customers, customerId);
  if (!c) return;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Edit Customer</h3>
    <div class="form-group"><label>Name *</label><input type="text" id="ec-name" value="${c.name||''}"></div>
    <div class="form-group"><label>Phone</label><input type="tel" id="ec-phone" value="${c.phone||''}" maxlength="10"></div>
    <div class="form-group"><label>Type</label>
      <select id="ec-type">
        <option value="retail" ${c.type==='retail'?'selected':''}>Retail</option>
        <option value="contractor" ${c.type==='contractor'?'selected':''}>Contractor</option>
        <option value="professional" ${c.type==='professional'?'selected':''}>Professional</option>
        <option value="b2b" ${c.type==='b2b'?'selected':''}>B2B</option>
      </select>
    </div>
    <div class="form-group"><label>City / Area</label><input type="text" id="ec-city" value="${c.city||''}"></div>
    <div class="form-group"><label>Address</label><input type="text" id="ec-address" value="${c.address||''}"></div>
    <button class="btn-primary full-width" onclick="saveCustomerDetails(${customerId})">Save</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
window.editCustomerDetails = editCustomerDetails;

async function saveCustomerDetails(customerId) {
  const c = await VW_DB.getById(VW_DB.STORES.customers, customerId);
  if (!c) return;
  c.name = document.getElementById('ec-name')?.value.trim() || c.name;
  c.phone = document.getElementById('ec-phone')?.value.trim() || c.phone;
  c.type = document.getElementById('ec-type')?.value || c.type;
  c.city = document.getElementById('ec-city')?.value.trim() || c.city;
  c.address = document.getElementById('ec-address')?.value.trim() || c.address;
  await VW_DB.put(VW_DB.STORES.customers, c);
  showToast('Customer details saved', 'success');
  closeSheet();
  navigateTo('ledger', { customerId });
}
window.saveCustomerDetails = saveCustomerDetails;

window.VW_LEDGER = { renderCustomerLedger };




/* === visualizer.js === */

// =====================================================
// V WHOLESALE — ROOM VISUALIZER v2
// "Instagram filter" model — AI is completely invisible
// 
// Flow: Snap photo → Tap product swatch → See result
// No prompts, no typing, no AI visible to user
// Supports: real image editing (Gemini) + text fallback (Claude)
// =====================================================

let _visRoomPhoto = null;       // base64 of room photo
let _visSelectedProduct = null; // single selected product/swatch
let _visPreseedId = null; // product id to auto-select when arriving from a tile quote
let _visLastResult = null;      // last generated result image

// ===== PAINT SWATCHES (most common first entry point) =====
const PAINT_SWATCHES = [
  { label: 'Pearl White', color: '#F5F5F0', hex: '#F5F5F0', category: 'Cool Whites' },
  { label: 'Ivory', color: '#FFFFF0', hex: '#FFFFF0', category: 'Warm Whites' },
  { label: 'Cream', color: '#FFFDD0', hex: '#FFFDD0', category: 'Warm Whites' },
  { label: 'Blush', color: '#FFE4E1', hex: '#FFE4E1', category: 'Pinks' },
  { label: 'Sage Green', color: '#9DC183', hex: '#9DC183', category: 'Greens' },
  { label: 'Mint', color: '#98FF98', hex: '#98FF98', category: 'Greens' },
  { label: 'Sky Blue', color: '#87CEEB', hex: '#87CEEB', category: 'Blues' },
  { label: 'Navy', color: '#1B269A', hex: '#1B269A', category: 'Blues' },
  { label: 'Warm Grey', color: '#B2A9A1', hex: '#B2A9A1', category: 'Greys' },
  { label: 'Charcoal', color: '#36454F', hex: '#36454F', category: 'Greys' },
  { label: 'Terracotta', color: '#E2725B', hex: '#E2725B', category: 'Earthy' },
  { label: 'Mustard', color: '#FFDB58', hex: '#FFDB58', category: 'Earthy' },
  { label: 'Taupe', color: '#B5A89A', hex: '#B5A89A', category: 'Earthy' },
  { label: 'Sand', color: '#C2B280', hex: '#C2B280', category: 'Earthy' },
  { label: 'Peach', color: '#FFCBA4', hex: '#FFCBA4', category: 'Warm' },
  { label: 'Lavender', color: '#E6E6FA', hex: '#E6E6FA', category: 'Cool' },
];

async function renderVisualizerPage() {
  const products = await VW_DB.all(VW_DB.STORES.products);
  // Arriving from a tile quote? Pre-select that tile so it's highlighted and ready to apply.
  if (_visPreseedId != null) {
    const pp = products.find(x => x.id === _visPreseedId);
    if (pp) _visSelectedProduct = { ...pp, type: 'product', label: pp.name };
    _visPreseedId = null;
  }
  const tiles = products.filter(p => p.category === 'Tiles' || (p.category||'').toLowerCase().includes('tile'));
  const granite = products.filter(p => p.category === 'Granite' || (p.category||'').toLowerCase().includes('granite'));
  const paints = products.filter(p => (p.category||'').toLowerCase().includes('paint'));
  const others = products.filter(p => !['Tiles','Granite'].includes(p.category) && !(p.category||'').toLowerCase().includes('paint'));

  return `
  <div class="module-header" style="display:flex;align-items:center;gap:10px">
    ${(window._tqState?.rooms?.length||0) > 0 ? `<button onclick="navigateTo('tiles')" style="background:none;border:none;color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;padding:0;flex-shrink:0">← Quotation</button>` : ''}
    <h2 style="margin:0;flex:1">🎨 Visualizer</h2>
    <span style="font-size:11px;color:var(--text3);padding:3px 8px;background:var(--bg2);border-radius:20px">Beta</span>
  </div>

  <!-- STEP 1: PHOTO -->
  <div id="vis-photo-card" class="card" style="margin-bottom:12px">
    ${_visRoomPhoto ? `
    <div style="position:relative;border-radius:12px;overflow:hidden;margin-bottom:10px">
      <img src="data:image/jpeg;base64,${_visRoomPhoto}" style="width:100%;max-height:240px;object-fit:cover;display:block">
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.4) 0%,transparent 40%)"></div>
      <div style="position:absolute;bottom:10px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:600;color:#fff">📷 Your Room</span>
        <button onclick="VW_VIS.clearPhoto()" style="background:rgba(0,0,0,0.5);border:none;color:#fff;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">Change</button>
      </div>
    </div>` : `
    <div onclick="document.getElementById('vis-file-input').click()" style="background:rgba(255,255,255,0.03);border:2px dashed var(--border);border-radius:14px;padding:36px 20px;text-align:center;cursor:pointer">
      <div style="font-size:52px;margin-bottom:10px">📷</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">Snap your room</div>
      <div style="font-size:13px;color:var(--text3)">Take a photo or upload from gallery</div>
    </div>`}
    <input type="file" id="vis-file-input" accept="image/*" capture="environment" style="display:none" onchange="VW_VIS.handlePhoto(this)">
    ${!_visRoomPhoto ? `<button class="btn-secondary full-width" style="margin-top:10px" onclick="document.getElementById('vis-file-input').click()">📷 Take / Upload Photo</button>` : ''}
  </div>

  <!-- STEP 2: PRODUCT SWATCHES -->
  <div class="card" style="margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px">Tap a material to apply</div>

    <!-- Paint colours -->
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">🎨 Wall Paint</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:14px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      ${PAINT_SWATCHES.map(sw => `
      <div onclick="VW_VIS.selectSwatch(${JSON.stringify(sw).replace(/"/g,'&quot;')})"
        style="flex-shrink:0;text-align:center;cursor:pointer;opacity:${_visSelectedProduct?.hex===sw.hex?1:0.7};transform:${_visSelectedProduct?.hex===sw.hex?'scale(1.15)':'scale(1)'};transition:all 0.2s">
        <div style="width:44px;height:44px;border-radius:50%;background:${sw.color};border:${_visSelectedProduct?.hex===sw.hex?'3px solid var(--gold)':'3px solid rgba(255,255,255,0.2)'};box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>
        <div style="font-size:9px;color:var(--text3);margin-top:4px;white-space:nowrap;max-width:48px;overflow:hidden;text-overflow:ellipsis">${sw.label}</div>
      </div>`).join('')}
    </div>

    <!-- Tiles from inventory -->
    ${tiles.length ? `
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">🔲 Tiles</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:14px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      ${tiles.slice(0,12).map(p => `
      <div onclick="VW_VIS.selectProduct(${p.id})"
        style="flex-shrink:0;text-align:center;cursor:pointer;opacity:${_visSelectedProduct?.id===p.id?1:0.7};transform:${_visSelectedProduct?.id===p.id?'scale(1.1)':'scale(1)'};transition:all 0.2s">
        <div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#8B7355,#A0896A);border:${_visSelectedProduct?.id===p.id?'3px solid var(--gold)':'3px solid var(--border)'};display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden">
          ${p.imageUrl?`<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover">`:'🔲'}
        </div>
        <div style="font-size:9px;color:var(--text3);margin-top:4px;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name.slice(0,15)}</div>
        <div style="font-size:9px;color:var(--gold)">₹${p.price||0}/${p.unit||'box'}</div>
      </div>`).join('')}
    </div>` : ''}

    <!-- Granite from inventory -->
    ${granite.length ? `
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">🪨 Granite</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:14px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      ${granite.slice(0,8).map(p => `
      <div onclick="VW_VIS.selectProduct(${p.id})"
        style="flex-shrink:0;text-align:center;cursor:pointer;opacity:${_visSelectedProduct?.id===p.id?1:0.7};transform:${_visSelectedProduct?.id===p.id?'scale(1.1)':'scale(1)'};transition:all 0.2s">
        <div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#696969,#808080);border:${_visSelectedProduct?.id===p.id?'3px solid var(--gold)':'3px solid var(--border)'};display:flex;align-items:center;justify-content:center;font-size:22px">
          🪨
        </div>
        <div style="font-size:9px;color:var(--text3);margin-top:4px;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name.slice(0,15)}</div>
        <div style="font-size:9px;color:var(--gold)">₹${p.price||0}/sft</div>
      </div>`).join('')}
    </div>` : ''}
  </div>

  <!-- SELECTED + APPLY BUTTON -->
  <div id="vis-action-area">
    ${_visSelectedProduct ? `
    <div style="background:rgba(245,200,66,0.1);border:1px solid var(--gold-border);border-radius:12px;padding:12px;margin-bottom:10px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:8px;background:${_visSelectedProduct.color||'var(--bg3)'};border:2px solid var(--gold-border);flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:var(--gold)">${_visSelectedProduct.label||_visSelectedProduct.name}</div>
        <div style="font-size:11px;color:var(--text3)">${_visSelectedProduct.category||'Paint'} · Selected</div>
      </div>
      <button onclick="VW_VIS.clearSelection()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">✕</button>
    </div>
    ${_visRoomPhoto ? `
    <button class="btn-primary full-width" style="padding:16px;font-size:15px;letter-spacing:0.02em" onclick="VW_VIS.applyToRoom()">
      ✨ Apply to My Room
    </button>` : `
    <button class="btn-secondary full-width" onclick="document.getElementById('vis-file-input').click()">
      📷 Upload room photo to apply
    </button>`}` : `
    <div style="text-align:center;padding:16px;color:var(--text3);font-size:13px">
      ${_visRoomPhoto ? '← Tap a colour or material above' : '↑ Upload your room photo first'}
    </div>`}
  </div>

  <!-- RESULT AREA -->
  <div id="vis-result" style="margin-top:10px"></div>`;
}

function handlePhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  // Compress to 800px max for fast processing
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 800;
      const ratio = Math.min(maxSize/img.width, maxSize/img.height, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      _visRoomPhoto = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      refreshVisualizerPage();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function refreshVisualizerPage() {
  const el = document.getElementById('app-content');
  if (el) el.innerHTML = await renderVisualizerPage();
}

function selectSwatch(sw) {
  _visSelectedProduct = { ...sw, type: 'paint' };
  // Quick update — just refresh the action area and swatch selection
  refreshVisualizerPage();
}

async function selectProduct(productId) {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const p = products.find(x => x.id === productId);
  if (!p) return;
  _visSelectedProduct = { ...p, type: 'product', label: p.name };
  refreshVisualizerPage();
}

function clearPhoto() {
  _visRoomPhoto = null;
  refreshVisualizerPage();
}

function clearSelection() {
  _visSelectedProduct = null;
  refreshVisualizerPage();
}

async function applyToRoom() {
  if (!_visRoomPhoto || !_visSelectedProduct) return;
  const resultEl = document.getElementById('vis-result');
  if (!resultEl) return;

  resultEl.innerHTML = `
    <div class="card" style="border-color:var(--gold-border)">
      <div style="display:flex;flex-direction:column;align-items:center;padding:24px;gap:12px">
        <div style="font-size:40px;animation:spin 1.5s linear infinite">✨</div>
        <div style="font-size:15px;font-weight:700;color:var(--text)">Applying ${_visSelectedProduct.label||'material'}...</div>
        <div style="font-size:12px;color:var(--text3)">AI is redesigning your room</div>
      </div>
    </div>`;

  try {
    const SUPABASE_URL = VW_DB.client.supabaseUrl;
    const SUPABASE_KEY = VW_DB.client.supabaseKey;

    // Try image generation first (Gemini)
    const payload = {
      mode: 'visualize',
      roomType: 'room',
      imageBase64: _visRoomPhoto,
      swatchColor: _visSelectedProduct.color || null,
      swatchLabel: _visSelectedProduct.label || _visSelectedProduct.name,
      products: _visSelectedProduct.type === 'product' ? [_visSelectedProduct] : [],
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/room-visualizer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.resultImageBase64) {
      // SUCCESS — real image edit
      _visLastResult = data.resultImageBase64;
      renderImageResult(data.resultImageBase64, data.resultMimeType || 'image/jpeg', data.description);
      if (typeof _logApiUsage === 'function') _logApiUsage('ai_visualizer_render', { success:true, meta:{ has_image:true } });
    } else {
      // Fallback to text description
      const descPayload = { mode: 'describe', roomType: 'room', imageBase64: _visRoomPhoto, products: _visSelectedProduct.type === 'product' ? [_visSelectedProduct] : [] };
      const descRes = await fetch(`${SUPABASE_URL}/functions/v1/room-visualizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
        body: JSON.stringify(descPayload)
      });
      const descData = await descRes.json();
      if (typeof _logApiUsage === 'function') _logApiUsage('ai_visualizer_render', { success:false, meta:{ fallback:'describe', reason: data.message||'no image' } });
      renderTextResult(descData.description || 'Visualization complete.', data.message);
    }
  } catch(e) {
    if (typeof _logApiUsage === 'function') _logApiUsage('ai_visualizer_render', { success:false, meta:{ error: e.message } });
    resultEl.innerHTML = `<div class="alert-card"><div class="alert-title">Could not apply — check connection</div><button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_VIS.applyToRoom()">Try Again</button></div>`;
  }
}

function renderImageResult(imageBase64, mimeType, description) {
  const resultEl = document.getElementById('vis-result');
  if (!resultEl) return;

  resultEl.innerHTML = `
    <div class="card" style="border-color:var(--gold-border);margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:10px">✨ Your room with ${_visSelectedProduct?.label||'this material'}</div>

      <!-- BEFORE/AFTER SLIDER -->
      <div id="vis-compare" style="position:relative;border-radius:12px;overflow:hidden;user-select:none;touch-action:none">
        <img id="vis-after" src="data:${mimeType};base64,${imageBase64}" style="width:100%;display:block;border-radius:12px">
        <div id="vis-before-overlay" style="position:absolute;top:0;left:0;width:50%;height:100%;overflow:hidden">
          <img src="data:image/jpeg;base64,${_visRoomPhoto}" style="width:200%;height:100%;object-fit:cover">
        </div>
        <div id="vis-divider" style="position:absolute;top:0;left:50%;width:3px;height:100%;background:var(--gold);transform:translateX(-50%);cursor:ew-resize">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;background:var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;color:#000;box-shadow:0 2px 8px rgba(0,0,0,0.4)">⇔</div>
        </div>
        <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px">BEFORE</div>
        <div style="position:absolute;top:8px;right:8px;background:var(--gold);color:#000;font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px">AFTER</div>
      </div>
      <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:6px">← Slide to compare before/after →</div>

      ${description ? `<div style="font-size:13px;color:var(--text2);margin-top:12px;line-height:1.6">${description}</div>` : ''}

      ${_visSelectedProduct?.price ? `
      <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-top:12px">
        <div style="font-size:12px;color:var(--gold);font-weight:600">${_visSelectedProduct.label||_visSelectedProduct.name} — Available at V Wholesale</div>
        <div style="font-size:13px;color:var(--text);margin-top:2px">₹${_visSelectedProduct.price.toLocaleString('en-IN')}/${_visSelectedProduct.unit||'unit'}</div>
      </div>` : ''}

      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn-primary" style="flex:1" onclick="VW_VIS.createQuoteFromVis()">📄 Get Quote</button>
        <button class="btn-secondary" onclick="VW_VIS.shareResult()">💬 Share</button>
        <button class="btn-secondary" onclick="VW_VIS.tryAnother()" title="Try another material">↩️</button>
      </div>
    </div>`;

  // Wire up before/after slider
  setTimeout(() => initCompareSlider(), 100);
}

function renderTextResult(description, note) {
  const resultEl = document.getElementById('vis-result');
  if (!resultEl) return;
  const paras = description.split('\n').filter(l=>l.trim());
  resultEl.innerHTML = `
    <div class="card" style="border-color:var(--gold-border)">
      <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:10px">✨ Design Vision for Your Room</div>
      ${note ? `<div style="font-size:11px;color:var(--text3);margin-bottom:10px">${note}</div>` : ''}
      <div style="background:var(--bg2);border-radius:10px;padding:14px;line-height:1.7">
        ${paras.map(p => `<p style="font-size:13px;color:var(--text2);margin:0 0 10px">${p}</p>`).join('')}
      </div>
      ${_visSelectedProduct?.price ? `
      <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-top:12px">
        <div style="font-size:13px;font-weight:600;color:var(--gold)">${_visSelectedProduct.label||_visSelectedProduct.name} — Available Now</div>
        <div style="font-size:12px;color:var(--text);margin-top:2px">₹${_visSelectedProduct.price.toLocaleString('en-IN')}/${_visSelectedProduct.unit||'unit'}</div>
      </div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px">
        ${_visSelectedProduct?.type==='product' ? `<button class="btn-primary" style="flex:1" onclick="VW_VIS.createQuoteFromVis()">📄 Get Quote</button>` : ''}
        <button class="btn-secondary" style="flex:1" onclick="VW_VIS.tryAnother()">↩️ Try Another</button>
      </div>
    </div>`;
}

function initCompareSlider() {
  const container = document.getElementById('vis-compare');
  const divider = document.getElementById('vis-divider');
  const beforeOverlay = document.getElementById('vis-before-overlay');
  if (!container || !divider || !beforeOverlay) return;

  let isDragging = false;

  const setPosition = (x) => {
    const rect = container.getBoundingClientRect();
    const pct = Math.min(Math.max((x - rect.left) / rect.width * 100, 0), 100);
    divider.style.left = pct + '%';
    beforeOverlay.style.width = pct + '%';
    // Fix the before image to show correctly at current clip
    const beforeImg = beforeOverlay.querySelector('img');
    if (beforeImg) {
      beforeImg.style.width = (100 / pct * 100) + '%';
    }
  };

  divider.addEventListener('mousedown', () => isDragging = true);
  divider.addEventListener('touchstart', () => isDragging = true, { passive: true });
  document.addEventListener('mouseup', () => isDragging = false);
  document.addEventListener('touchend', () => isDragging = false);
  document.addEventListener('mousemove', e => { if (isDragging) setPosition(e.clientX); });
  document.addEventListener('touchmove', e => { if (isDragging && e.touches[0]) setPosition(e.touches[0].clientX); }, { passive: true });

  // Also make the whole container draggable
  container.addEventListener('mousedown', (e) => { isDragging = true; setPosition(e.clientX); });
  container.addEventListener('touchstart', (e) => { isDragging = true; if (e.touches[0]) setPosition(e.touches[0].clientX); }, { passive: true });
}

async function createQuoteFromVis() {
  if (!_visSelectedProduct?.id) {
    showToast('Select a specific product from inventory to create a quotation', 'warn');
    return;
  }
  quoteItems = [{
    id: Date.now() + Math.random(),
    brand: _visSelectedProduct.brand || '',
    model: _visSelectedProduct.model || '',
    description: _visSelectedProduct.name,
    department: _visSelectedProduct.category || '',
    qty: 1, mode: 'mrp_disc',
    mrp: _visSelectedProduct.price || 0, discPct: 0,
    costPrice: '', marginPct: '', addGst: false,
    gstPct: _visSelectedProduct.gst || 18,
    gstSlab: String(_visSelectedProduct.gst || 18),
    directPrice: '', brandMode: 'select', modelMode: 'select'
  }];
  navigateTo('quotations');
  setTimeout(() => showQuoteForm(), 400);
  showToast(`${_visSelectedProduct.name.slice(0,25)} loaded into quotation`, 'success');
}

function shareResult() {
  const productName = _visSelectedProduct?.label || _visSelectedProduct?.name || 'this material';
  const msg = `🏠 *V Wholesale Room Visualizer*\n\nI just saw how *${productName}* will look in my room!\n\nCome see it in person at V Wholesale, Visit V Wholesale\n📞 8712697930`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function tryAnother() {
  const resultEl = document.getElementById('vis-result');
  if (resultEl) resultEl.innerHTML = '';
  _visSelectedProduct = null;
  refreshVisualizerPage();
}

window.VW_VIS = {
  renderVisualizerPage, handlePhoto, refreshVisualizerPage,
  selectSwatch, selectProduct, clearPhoto, clearSelection,
  applyToRoom, createQuoteFromVis, shareResult, tryAnother,
  initCompareSlider,
};
// Expose for test suite
window.PAINT_SWATCHES = PAINT_SWATCHES;




/* === customer_portal.js === */

// =====================================================
// CUSTOMER PORTAL v1
// - ?customer=TOKEN public portal
// - Quotations, invoices, wishlist, delivery tracking
// - Wishlist sharing (WhatsApp group link)
// - Request quotation from portal
// - Auto-send on check-in
// - Self-registration via ?register=customer
// =====================================================

// ===== GENERATE + SEND PORTAL LINK =====
async function generateCustomerPortalLink(customerId, customerPhone, createdBy) {
  // Check if token already exists
  const { data: existing } = await VW_DB.client.from('customer_portal_tokens')
    .select('token').eq('customer_id', customerId).eq('is_active', true).single().then(r=>r, ()=>({data:null}));
  if (existing?.token) return existing.token;

  const token = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  await VW_DB.client.from('customer_portal_tokens').insert({
    customer_id: customerId, token, phone: customerPhone,
    created_by: createdBy||'system', is_active: true,
  });
  await auditLog('portal_link_generated', 'customer', customerId, null, null, {createdBy}, 'Customer portal link generated');
  return token;
}

async function sendPortalLinkWA(customerId, customerName, customerPhone, createdBy) {
  const token = await generateCustomerPortalLink(customerId, customerPhone, createdBy);
  const link = `${window.location.origin}/?customer=${token}`;
  const msg = encodeURIComponent(
    `*V Wholesale — Your Account Portal* 🏠\n\n` +
    `Dear ${customerName},\n\n` +
    `Your personal V Wholesale account is ready!\n\n` +
    `🔗 ${link}\n\n` +
    `You can view:\n✅ Your quotations & invoices\n✅ Delivery status\n✅ Your tile wishlist\n✅ Share wishlist with family\n\n` +
    `📞 V Wholesale · Vijayawada · 8712697930`
  );
  const phone = (customerPhone||'').replace(/\D/g,'');
  window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  return token;
}
window.generateCustomerPortalLink = generateCustomerPortalLink;
window.sendPortalLinkWA = sendPortalLinkWA;

// ===== PUBLIC CUSTOMER PORTAL =====
async function renderCustomerPortal(token) {
  // Load portal bundle via token-scoped SECURITY DEFINER RPC. This works for the anon
  // portal key without exposing customers/invoices/quotations/wishlists to the public,
  // and bumps last_active server-side. Returns null only for an invalid/inactive token.
  const { data: bundle } = await VW_DB.client.rpc('get_customer_portal', { p_token: token }).then(r=>r, ()=>({data:null}));

  if (!bundle) return `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">
    <div>
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:18px;font-weight:700">Invalid Link</div>
      <div style="font-size:13px;color:var(--text3);margin-top:8px">This link may have expired. Contact V Wholesale for a new link.</div>
      <div style="margin-top:16px"><a href="tel:8712697930" style="color:var(--gold);font-size:14px">📞 8712697930</a></div>
    </div>
  </div>`;

  const customer = bundle.customer || {};
  const customerId = customer?.id;
  // last_active is already bumped inside the RPC; audit is best-effort and must never block the portal
  try { await auditLog('portal_visit', 'customer', customer?.id, customer?.name, null, null, 'Customer portal visit'); } catch(e) {}

  const quotes = bundle.quotes || [];
  const invoices = bundle.invoices || [];
  const wishlist = bundle.wishlist || [];
  const tracking = bundle.tracking || [];

  const activeDeliveries = tracking.filter(t=>t.status!=='delivered').length;

  return `
  <div style="min-height:100vh;background:var(--bg);padding-bottom:80px">
    <!-- HEADER -->
    <div style="background:var(--header-bg);padding:20px 16px;position:sticky;top:0;z-index:50">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:800;color:#F5C842;font-family:'Syne',sans-serif">V Wholesale</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6)">Welcome, ${customer?.name||'Customer'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:rgba(255,255,255,0.5)">${customer?.phone||''}</div>
          ${activeDeliveries>0?`<div style="font-size:11px;color:var(--gold)">${activeDeliveries} active delivery</div>`:''}
        </div>
      </div>
    </div>

    <!-- QUICK STATS -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 16px">
      ${[
        ['Quotes', quotes.length, 'var(--text)'],
        ['Orders', invoices.length, 'var(--green)'],
        ['Wishlist', wishlist.length, 'var(--gold)'],
      ].map(([l,v,c])=>`
      <div style="background:var(--bg2);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:${c}">${v}</div>
        <div style="font-size:11px;color:var(--text3)">${l}</div>
      </div>`).join('')}
    </div>

    <div style="padding:0 16px">

    <!-- ACTIVE DELIVERIES -->
    ${tracking.filter(t=>t.status!=='delivered').map(t=>`
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:12px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:4px">🚚 Active Delivery — ${t.gate_pass_no||'—'}</div>
      <div style="font-size:11px;color:var(--text2)">${t.driver_name||'Driver'} · ${t.driver_phone||'—'}</div>
      <div style="font-size:11px;color:var(--text3);text-transform:capitalize">Status: ${t.status||'In progress'}</div>
    </div>`).join('')}

    <!-- QUOTATIONS -->
    ${quotes.length ? `
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;margin-top:6px">📋 My Quotations</div>
    ${quotes.map(q=>_renderCustomerCard(
      `${q.quote_type==='tiles'?'🔲':q.quote_type==='granite'?'🪨':'📄'} ${q.quote_no||'Draft'}`,
      q.grand_total?`₹${q.grand_total.toLocaleString('en-IN')}`:'',
      q.status, new Date(q.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})
    )).join('')}` : ''}

    <!-- INVOICES -->
    ${invoices.length ? `
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;margin-top:14px">🧾 My Orders</div>
    ${invoices.map(inv=>_renderCustomerCard(
      `🧾 ${inv.invoice_no}`,
      inv.grand_total?`₹${inv.grand_total.toLocaleString('en-IN')}`:'',
      inv.payment_status, new Date(inv.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})
    )).join('')}` : ''}

    <!-- WISHLIST -->
    ${wishlist.length ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;margin-bottom:8px">
      <div style="font-size:13px;font-weight:700">❤️ My Wishlist (${wishlist.length})</div>
      <button onclick="VW_CUSTOMER_PORTAL.shareWishlist('${token}')" style="background:none;border:none;font-size:12px;color:var(--gold);cursor:pointer">📤 Share</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${wishlist.slice(0,6).map(w=>{
        const p = w.products;
        const stock = (p?.tile_stock_locations||[]).reduce((s,l)=>s+(l.qty_boxes||0),0);
        return `
        <div style="background:var(--bg2);border-radius:10px;overflow:hidden;border:1px solid var(--border)">
          ${p?.image_url?`<img src="${p.image_url}" style="width:100%;height:80px;object-fit:cover">`:
          `<div style="width:100%;height:80px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:28px">🔲</div>`}
          <div style="padding:8px">
            <div style="font-size:11px;font-weight:600;color:var(--text)">${p?.name||'—'}</div>
            <div style="font-size:10px;color:var(--text3)">${p?.brand||''} · ${p?.tile_size_label||''}</div>
            ${p?.mrp?`<div style="font-size:11px;color:var(--gold);margin-top:2px">₹${(p.mrp).toLocaleString('en-IN')}/box</div>`:''}
            <div style="font-size:10px;color:${stock>5?'var(--green)':stock>0?'var(--gold)':'var(--red)'};margin-top:2px">${stock>0?stock+' boxes avail':'Out of stock'}</div>
          </div>
        </div>`;
      }).join('')}
    </div>` : `
    <div style="text-align:center;padding:24px;color:var(--text3);margin-top:10px">
      <div style="font-size:32px;margin-bottom:8px">❤️</div>
      <div style="font-size:13px">Your wishlist is empty</div>
      <div style="font-size:11px;margin-top:4px">Scan a tile QR code to add designs</div>
    </div>`}

    <!-- REQUEST NEW QUOTATION -->
    <div style="background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:14px;padding:16px;margin-top:8px">
      <div style="font-size:14px;font-weight:700;color:var(--gold);margin-bottom:6px">Need a Tile Quotation?</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Share your measurements or connect with our team</div>
      <div style="display:flex;gap:8px">
        <button onclick="window.open('https://wa.me/918712697930?text='+encodeURIComponent('Hi V Wholesale, I need a tile quotation. Customer: ${customer?.name||''} · Phone: ${customer?.phone||''}'),'_blank')"
          style="flex:1;background:#25D366;color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:600;cursor:pointer">
          💬 WhatsApp
        </button>
        <button onclick="window.location.href='tel:8712697930'"
          style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:13px;cursor:pointer;color:var(--text)">
          📞 Call Us
        </button>
      </div>
    </div>

    </div><!-- /padding -->
  </div>`;
}

function _renderCustomerCard(title, amount, status, date) {
  const statusColor = {converted:'var(--green)',paid:'var(--green)',pending:'var(--gold)',draft:'var(--text3)',approved:'var(--blue)'}[status]||'var(--text3)';
  return `
  <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:13px;font-weight:600;color:var(--text)">${title}</div>
      <div style="font-size:11px;color:var(--text3)">${date}</div>
    </div>
    <div style="text-align:right">
      ${amount?`<div style="font-size:13px;font-weight:700;color:var(--gold)">${amount}</div>`:''}
      <div style="font-size:11px;color:${statusColor}">● ${status||'—'}</div>
    </div>
  </div>`;
}

async function shareWishlist(token) {
  // Generate a shareable wishlist link (public, no login needed)
  const shareToken = 'wl_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  await VW_DB.client.from('customer_portal_tokens').update({ shared_token: shareToken }).eq('token', token).catch(()=>{});
  const link = `${window.location.origin}/?wishlist=${shareToken}`;
  const msg = encodeURIComponent(`*My V Wholesale Tile Wishlist* 🏠\n\nHere are the tiles I'm considering for my home:\n${link}\n\nYou can view designs, availability and prices.\n\n— via V Wholesale, Vijayawada`);
  if (navigator.share) {
    navigator.share({ title:'My Tile Wishlist', url: link });
  } else {
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }
}

// ===== CUSTOMER SELF-REGISTRATION =====
async function renderCustomerRegisterPage() {
  return `
  <div style="min-height:100vh;background:var(--bg);padding:24px 16px">
    <!-- HEADER -->
    <div style="text-align:center;margin-bottom:28px">
      <div style="font-size:24px;font-weight:800;color:#F5C842;font-family:'Syne',sans-serif;margin-bottom:4px">V Wholesale</div>
      <div style="font-size:13px;color:var(--text2)">Create your home-building account</div>
    </div>

    <div style="max-width:420px;margin:0 auto">
      <div class="form-group"><label>Full Name *</label><input type="text" id="cr-name" placeholder="Your full name" autocomplete="name"></div>
      <div class="form-group"><label>Mobile Number *</label><input type="tel" id="cr-phone" placeholder="10-digit mobile number" maxlength="10" autocomplete="tel"></div>
      <div class="form-group"><label>WhatsApp Number <span style="color:var(--text3)">(if different)</span></label><input type="tel" id="cr-wa" placeholder="Same as mobile if blank" maxlength="10"></div>
      <div class="form-group"><label>City / Area</label><input type="text" id="cr-area" placeholder="e.g. Bhavanipuram, Vijayawada"></div>
      <div class="form-group">
        <label>Project Type <span style="color:var(--text3)">(optional)</span></label>
        <select id="cr-project">
          <option value="">Select</option>
          <option value="new_home">New Home Construction</option>
          <option value="renovation">Home Renovation</option>
          <option value="bathroom">Bathroom Renovation</option>
          <option value="kitchen">Kitchen Renovation</option>
          <option value="commercial">Commercial Space</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>How did you hear about us?</label>
        <select id="cr-heard">
          <option value="">Select</option>
          <option value="walk_in">Visited store</option>
          <option value="referral">Friend/Contractor referral</option>
          <option value="google">Google search</option>
          <option value="social">Social media</option>
          <option value="wa_link">WhatsApp link</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style="background:rgba(245,200,66,0.08);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:16px;font-size:12px;color:var(--text2)">
        <div style="font-weight:700;color:var(--gold);margin-bottom:4px">What you get:</div>
        <div>✅ View your quotations and invoices anytime</div>
        <div>✅ Track your tile delivery live</div>
        <div>✅ Save tile designs to wishlist and share with family</div>
        <div>✅ Scan any tile QR code for live stock and price</div>
      </div>
      <button class="btn-primary full-width" id="cr-submit" onclick="VW_CUSTOMER_PORTAL.submitCustomerRegistration()" style="padding:16px;font-size:15px">
        Create My Account →
      </button>
      <div style="text-align:center;margin-top:14px;font-size:12px;color:var(--text3)">
        Already registered? Check your WhatsApp for your portal link.
      </div>
    </div>
  </div>`;
}

async function submitCustomerRegistration() {
  const name = document.getElementById('cr-name')?.value.trim();
  const phone = document.getElementById('cr-phone')?.value.trim().replace(/\D/g,'');
  if (!name||phone.length<10) { showToast('Name and 10-digit phone required','warn'); return; }
  const btn = document.getElementById('cr-submit');
  if (btn) { btn.disabled=true; btn.textContent='Creating account...'; }

  // Check if customer exists
  let customerId;
  const { data: existing } = await VW_DB.client.from('customers').select('id,name').ilike('phone','%'+phone+'%').single().then(r=>r, ()=>({data:null}));
  if (existing) {
    customerId = existing.id;
  } else {
    const { data: newCust } = await VW_DB.client.from('customers').insert({
      name, phone,
      whatsapp: document.getElementById('cr-wa')?.value.trim()||phone,
      address: document.getElementById('cr-area')?.value.trim()||'',
      source: document.getElementById('cr-heard')?.value||'self_register',
      project_type: document.getElementById('cr-project')?.value||'',
      created_at: new Date().toISOString(),
    }).select().single().then(r=>r, ()=>({data:null}));
    customerId = newCust?.id;
  }

  if (!customerId) {
    if (btn) { btn.disabled=false; btn.textContent='Create My Account →'; }
    showToast('Error creating account — try again','error'); return;
  }

  const token = await generateCustomerPortalLink(customerId, phone, 'self_register');
  const link = `${window.location.origin}/?customer=${token}`;
  const wa = (document.getElementById('cr-wa')?.value.trim()||phone).replace(/\D/g,'');
  const msg = encodeURIComponent(
    `*Welcome to V Wholesale, ${name}!* 🏠\n\n` +
    `Your account is ready.\n\n🔗 Your portal link:\n${link}\n\n` +
    `Save this link to:\n✅ View your quotations\n✅ Track deliveries\n✅ Build your tile wishlist\n\n` +
    `V Wholesale · Vijayawada · 8712697930`
  );

  await auditLog('customer_register', 'customer', customerId, name, null, {phone, source:'self_register'}, 'Self registration');

  const el = document.getElementById('app-content') || document.body;
  el.innerHTML = `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">
    <div>
      <div style="font-size:56px;margin-bottom:16px">🎉</div>
      <div style="font-size:22px;font-weight:800;color:var(--gold);margin-bottom:8px">Account Created!</div>
      <div style="font-size:14px;color:var(--text2);margin-bottom:20px">Welcome to V Wholesale, ${name}</div>
      <div style="background:var(--bg2);border-radius:14px;padding:16px;margin-bottom:20px;font-size:13px;color:var(--text2);text-align:left">
        <div style="font-weight:700;margin-bottom:8px">Your portal link:</div>
        <div style="font-size:11px;word-break:break-all;color:var(--text3)">${link}</div>
      </div>
      <button onclick="window.open('https://wa.me/91${wa}?text=${msg}','_blank')"
        style="width:100%;background:#25D366;color:#fff;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">
        📲 Open My Portal on WhatsApp
      </button>
      <button onclick="navigator.clipboard.writeText('${link}').then(()=>showToast('Link copied ✓','success'))"
        style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:13px;cursor:pointer;color:var(--text)">
        📋 Copy Portal Link
      </button>
      <div style="margin-top:16px;font-size:12px;color:var(--text3)">V Wholesale · Visit V Wholesale</div>
    </div>
  </div>`;

  // Alert V Wholesale team
  const notify = encodeURIComponent(`New customer self-registered:\n${name} · ${phone}\nArea: ${document.getElementById('cr-area')?.value||'—'}\nPortal: ${link}`);
  setTimeout(()=>window.open(`https://wa.me/918712697930?text=${notify}`,'_blank'),1500);
}

window.VW_CUSTOMER_PORTAL = {
  renderCustomerPortal, shareWishlist,
  renderCustomerRegisterPage, submitCustomerRegistration,
};




/* === extras.js === */

// ============================================================
// EXTRAS MODULE — Session 11
// Customer Portal · Contractor Club Portal · Customer Birthdays
// Stock Movement History · Quotation→Work Order · Executive Dashboard Card
// + migrate openStaff from hr.js
// ============================================================

// =====================================================
// 1. CUSTOMER PORTAL — shareable quotation link
// ?quote=QT2627XXXXX — no login needed, public read
// =====================================================
async function renderLegacyCustomerPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const quoteRef = urlParams.get('quote');
  if (!quoteRef) return;

  // Fetch directly from Supabase — customer is not logged in so IndexedDB is empty.
  // Uses a security-definer RPC because the quotations table itself is read-restricted
  // to approved staff; the RPC returns only the single quote matching this reference.
  let q = null;
  try {
    const { data: rows } = await VW_DB.client.rpc('get_public_quotation', { ref: String(quoteRef) });
    q = (rows && rows[0]) || null;

    // Normalize field names (Supabase uses snake_case, app uses camelCase)
    if (q) {
      q.quoteNo = q.quote_no || q.quoteNo || q.id;
      q.customerName = q.customer_name || q.customerName;
      q.siteName = q.site_name || q.siteName;
      q.grandTotal = q.grand_total || q.grandTotal || 0;
      q.createdAt = q.created_at || q.createdAt;
      q.items = q.items || [];
    }
  } catch(e) {
    // Fallback to IndexedDB if the RPC fails
    const quotations = await VW_DB.all(VW_DB.STORES.quotations);
    q = quotations.find(x => x.quoteNo === quoteRef || x.quote_no === quoteRef || String(x.id) === quoteRef);
  }

  if (!q) {
    document.getElementById('app-content').innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:var(--bg)">
        <div style="text-align:center;max-width:320px">
          <div style="font-size:48px;margin-bottom:12px">🔍</div>
          <h2 style="color:#fff;margin:0 0 8px">Quotation Not Found</h2>
          <p style="color:rgba(255,255,255,0.5);font-size:14px">The quotation link may have expired or is incorrect. Please contact V Wholesale.</p>
        </div>
      </div>`;
    return;
  }

  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale';
  const products = await VW_DB.all(VW_DB.STORES.products);
  const validUntil = q.expiryDate ? new Date(q.expiryDate) : new Date(new Date(q.createdAt).getTime() + 30*24*60*60*1000);
  const isExpired = validUntil < new Date();

  document.getElementById('app-nav').style.display = 'none';
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('app-content').innerHTML = `
  <div style="min-height:100vh;background:var(--bg);padding:0 0 40px">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#C8972B,#f5c842);padding:20px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:#000;letter-spacing:-0.5px">${storeName}</div>
      <div style="font-size:12px;color:rgba(0,0,0,0.6);margin-top:2px">Vijayawada · Home Building Materials</div>
    </div>

    <div style="max-width:480px;margin:0 auto;padding:16px">
      <!-- Quote header -->
      <div style="background:#111;border:1px solid rgba(200,151,43,0.3);border-radius:16px;padding:16px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px">Quotation</div>
            <div style="font-size:18px;font-weight:700;color:#fff">${q.quoteNo || 'Q-'+q.id}</div>
          </div>
          <span style="padding:4px 10px;border-radius:20px;font-size:13px;font-weight:600;background:${isExpired?'rgba(239,68,68,0.15)':'rgba(34,197,94,0.15)'};color:${isExpired?'#ef4444':'#22c55e'}">
            ${isExpired ? '⚠️ Expired' : `Valid until ${validUntil.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`}
          </span>
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6)">
          ${new Date(q.date||q.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
          ${q.customerName ? ` · Prepared for ${q.customerName}` : ''}
        </div>
        ${q.siteName ? `<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px">📍 ${q.siteName}</div>` : ''}
      </div>

      <!-- Items -->
      <div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Items</div>
        ${(q.items||[]).filter(i=>!i.isFreeGift).map((item,idx) => {
          const { netPrice, total } = item.netPrice !== undefined ? item : { netPrice: item.price||0, total: (item.price||0)*(item.qty||1) };
          return `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
            <div style="flex:1;padding-right:12px">
              <div style="font-size:13px;font-weight:600;color:#fff">${[item.brand,item.model,item.description].filter(Boolean).join(' ')}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px">${item.department||item.category||''} · ${item.qty} ${item.unit||'pc'} × ₹${Math.round(netPrice).toLocaleString('en-IN')}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:14px;font-weight:700;color:var(--gold)">₹${Math.round(total).toLocaleString('en-IN')}</div>
            </div>
          </div>`;
        }).join('')}
        ${(q.items||[]).filter(i=>i.isFreeGift).map(i=>`
          <div style="padding:8px 0;font-size:12px;color:#22c55e">🎁 Free Gift: ${i.name}</div>`).join('')}
        <!-- Total -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;margin-top:4px">
          <div style="font-size:14px;color:rgba(255,255,255,0.6)">Grand Total</div>
          <div style="font-size:22px;font-weight:800;color:var(--gold)">₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}</div>
        </div>
        ${q.terms ? `<div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:10px;line-height:1.6">${q.terms}</div>` : ''}
      </div>

      ${!isExpired ? `
      <!-- Accept / Contact -->
      <div style="background:#111;border:1px solid rgba(200,151,43,0.3);border-radius:16px;padding:16px;text-align:center">
        <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:4px">Ready to proceed?</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:14px">Contact us to confirm your order</div>
        <a href="https://wa.me/918712697930?text=${encodeURIComponent('Hi, I am confirming my quotation '+q.quoteNo+' for ₹'+Math.round(q.grandTotal||0).toLocaleString('en-IN')+'. Please proceed.')}"
          style="display:block;background:#25D366;color:#fff;padding:14px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:8px">
          💬 Confirm via WhatsApp
        </a>
        <a href="tel:+918712697930" style="display:block;background:rgba(255,255,255,0.08);color:#fff;padding:12px;border-radius:12px;text-decoration:none;font-size:14px">
          📞 Call Us
        </a>
      </div>` : ''}

      <div style="text-align:center;margin-top:20px;font-size:11px;color:rgba(255,255,255,0.2)">${storeName} · All prices are inclusive of GST</div>
    </div>
  </div>`;
}

// Generate shareable quotation link
function getQuotationShareLink(q) {
  return `${window.location.origin}/quote.html?quote=${encodeURIComponent(q.quoteNo||q.id)}`;
}
window.getQuotationShareLink = getQuotationShareLink;

// Add share button to quotation detail (called from quotations.js)
function shareQuotationLink(q) {
  const link = getQuotationShareLink(q);
  const msg = `Hi ${q.customerName||''},\n\nYour quotation from V Wholesale is ready to view:\n\n🔗 ${link}\n\nThis link shows all items and pricing. Tap "Confirm via WhatsApp" on the page to proceed.\n\n— V Wholesale, Vijayawada`;
  const phone = (q.contact||'').replace(/\D/g,'');
  const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
window.shareQuotationLink = shareQuotationLink;

// =====================================================
// 2. CONTRACTOR CLUB PORTAL
// Special view for contractors — their stats, referrals, club status
// =====================================================
async function renderContractorPortal() {
  const profile = VW_AUTH.getCurrentProfile();
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  // Find contractor customer linked to this profile
  const myCustomer = customers.find(c =>
    c.phone === profile?.phone ||
    c.profileId === profile?.id
  );

  if (!myCustomer) {
    return `
    <div style="text-align:center;padding:40px 20px">
      <div style="font-size:48px;margin-bottom:12px">🏗️</div>
      <h2>Contractor Club</h2>
      <p style="color:var(--text3);font-size:14px">Your contractor profile is not linked yet. Please contact V Wholesale to activate your Contractor Club membership.</p>
      <a href="https://wa.me/918712697930?text=Hi, I would like to join the V Wholesale Contractor Club" target="_blank" class="btn-wa full-width" style="margin-top:16px;display:block;text-decoration:none;text-align:center">💬 Request Membership</a>
    </div>`;
  }

  const [invoices, referrals, quotations] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.referralLedger),
    VW_DB.all(VW_DB.STORES.quotations)
  ]);

  const myInvoices = invoices.filter(i => i.customerId === myCustomer.id && i.approvalStatus === 'approved');
  const myReferrals = referrals.filter(r => r.referringCustomerId === myCustomer.id);
  const totalSpend = myInvoices.reduce((s,i)=>s+(i.total||0),0);
  const totalReferralEarned = myReferrals.reduce((s,r)=>s+(r.bonusAmount||0),0);
  const pendingReferral = myReferrals.filter(r=>r.status==='pending').reduce((s,r)=>s+(r.bonusAmount||0),0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthSpend = myInvoices.filter(i=>new Date(i.date)>=monthStart).reduce((s,i)=>s+(i.total||0),0);
  const myQuotes = quotations.filter(q => q.customerId === myCustomer.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  return `
  <div class="module-header"><h2>🏗️ Contractor Club</h2></div>

  <!-- Club card -->
  <div style="background:linear-gradient(135deg,var(--bg2),var(--bg));border:1px solid rgba(200,151,43,0.4);border-radius:20px;padding:20px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <div style="font-size:11px;color:rgba(200,151,43,0.6);text-transform:uppercase;letter-spacing:1px">Member</div>
        <div style="font-size:18px;font-weight:700;color:#fff">${myCustomer.name}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.4)">${myCustomer.phone}</div>
      </div>
      <div style="background:rgba(200,151,43,0.15);border:1px solid rgba(200,151,43,0.3);border-radius:10px;padding:8px 12px;text-align:center">
        <div style="font-size:11px;color:var(--gold)">Tier</div>
        <div style="font-size:14px;font-weight:700;color:var(--gold)">${totalSpend >= 500000 ? '⭐ Gold' : totalSpend >= 100000 ? 'Silver' : 'Standard'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div style="text-align:center">
        <div style="font-size:16px;font-weight:700;color:var(--gold)">₹${Math.round(totalSpend/1000)}K</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4)">Total Spend</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:16px;font-weight:700;color:#22c55e">₹${Math.round(totalReferralEarned/1000)}K</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4)">Referral Earned</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:16px;font-weight:700;color:#f97316">₹${Math.round(pendingReferral/1000)}K</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4)">Pending Payout</div>
      </div>
    </div>
  </div>

  <!-- Referral section -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🤝 Refer & Earn</h3>
    <p style="font-size:13px;color:var(--text3);margin-bottom:10px">Earn 2% bonus on every customer you refer to V Wholesale on their first purchase + 0.5% lifetime on all their future purchases.</p>
    <button class="btn-wa full-width" onclick="VW_EXTRAS.shareReferralLink('${myCustomer.id}','${myCustomer.name.replace(/'/g,"\\'")}')">💬 Share My Referral Link</button>
    ${myReferrals.length ? `
    <div style="margin-top:12px">
      <div style="font-size:13px;font-weight:600;color:var(--text3);margin-bottom:8px">MY REFERRALS</div>
      ${myReferrals.slice(0,5).map(r=>`
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2);font-size:12px">
        <span style="color:var(--text2)">${r.referredCustomerName||'Customer'}</span>
        <div style="text-align:right">
          <div style="font-weight:600;color:${r.status==='paid'?'#22c55e':'var(--gold)'}">₹${(r.bonusAmount||0).toLocaleString('en-IN')}</div>
          <div style="font-size:10px;color:var(--text3)">${r.status}</div>
        </div>
      </div>`).join('')}
    </div>` : ''}
  </div>

  <!-- My orders -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📋 My Orders</h3>
    ${!myInvoices.length ? '<p class="empty-msg">No orders yet</p>' :
    myInvoices.slice(0,5).sort((a,b)=>new Date(b.date)-new Date(a.date)).map(inv=>`
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
      <div>
        <div style="font-size:13px;font-weight:600">${inv.invoiceNo}</div>
        <div style="font-size:11px;color:var(--text3)">${new Date(inv.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">₹${(inv.total||0).toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:${inv.creditSale?'var(--gold)':'#22c55e'}">${inv.creditSale?'Credit':'Paid'}</div>
      </div>
    </div>`).join('')}
  </div>

  <!-- My quotations -->
  ${myQuotes.length ? `
  <div class="card">
    <h3 class="card-title">📄 My Quotations</h3>
    ${myQuotes.slice(0,5).map(q=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2)">
      <div>
        <div style="font-size:13px;font-weight:600">${q.quoteNo||'Q-'+q.id}</div>
        <div style="font-size:11px;color:var(--text3)">${new Date(q.date||q.createdAt).toLocaleDateString('en-IN')} · ₹${Math.round(q.grandTotal||0).toLocaleString('en-IN')}</div>
      </div>
      <button class="btn-sm" onclick="window.open('${window.location.origin}/quote.html?quote=${encodeURIComponent(q.quoteNo||q.id)}','_blank')">View</button>
    </div>`).join('')}
  </div>` : ''}`;
}

async function shareReferralLink(customerId, customerName) {
  const link = `${window.location.origin}/?ref=${customerId}`;
  const msg = `Hi! I am a V Wholesale Contractor Club member.\n\nV Wholesale is the best home building materials store in Vijayawada — tiles, sanitary, electrical, paints and more.\n\nVisit them and mention my name *${customerName}* to get priority service!\n\n📍 NH-65, Beside Padmaja Suzuki, Bhavanipuram, Vijayawada\n💬 +91 87126 97930`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

// =====================================================
// 3. CUSTOMER BIRTHDAY WISHES from CRM
// =====================================================
async function checkCustomerBirthdays() {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const today = new Date();
  const todayMD = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  return customers.filter(c => c.dateOfBirth && c.phone && c.dateOfBirth.slice(5) === todayMD);
}

async function sendCustomerBirthdayWishes() {
  const birthdays = await checkCustomerBirthdays();
  const settings = await VW_DB.getSetting('whatsapp_config', {});
  const storeName = settings.storeName || 'V Wholesale';
  if (!birthdays.length) { showToast('No customer birthdays today', 'info'); return; }
  for (const c of birthdays) {
    const msg = encodeURIComponent(`🎂 Happy Birthday ${c.name}!\n\nWishing you a wonderful birthday and a beautiful home! 🏠✨\n\nAs a special birthday treat, visit V Wholesale today and ask for your birthday surprise!\n\n— Team ${storeName}, Vijayawada 🙏`);
    window.open(`https://wa.me/91${c.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
    await new Promise(r=>setTimeout(r,1500));
  }
  showToast(`Birthday wishes sent to ${birthdays.length} customers`, 'success');
}
window.sendCustomerBirthdayWishes = sendCustomerBirthdayWishes;

// =====================================================
// 4. STOCK MOVEMENT HISTORY
// =====================================================
async function renderStockHistory(productId) {
  const [product, invoices, pos, returns] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.products, productId),
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.purchaseOrders),
    VW_DB.all(VW_DB.STORES.salesReturns)
  ]);
  if (!product) return;

  // Build movement log
  const movements = [];

  // Sales (stock out)
  invoices.filter(i=>i.approvalStatus==='approved').forEach(inv => {
    (inv.items||[]).forEach(item => {
      if (item.productId === productId || item.name === product.name) {
        movements.push({
          date: inv.date, type: 'out', qty: -(item.qty||0),
          reason: `Sale — ${inv.invoiceNo}`, ref: inv.invoiceNo,
          color: 'var(--red)'
        });
      }
    });
  });

  // Restocks from POs
  pos.filter(p=>p.status==='received').forEach(po => {
    (po.items||[]).forEach(item => {
      if (item.productId === productId) {
        movements.push({
          date: po.receivedAt||po.createdAt, type: 'in', qty: item.qtyReceived||item.qty||0,
          reason: `PO Receipt — ${po.poNo}`, ref: po.poNo,
          color: '#22c55e'
        });
      }
    });
  });

  // Returns (stock back in)
  returns.forEach(ret => {
    (ret.items||[]).forEach(item => {
      if (item.productId === productId || item.name === product.name) {
        movements.push({
          date: ret.createdAt, type: 'in', qty: item.qty||0,
          reason: `Return — ${ret.creditNoteNo||'CN'}`, ref: ret.creditNoteNo,
          color: '#06b6d4'
        });
      }
    });
  });

  movements.sort((a,b)=>new Date(b.date)-new Date(a.date));

  // User-wise movement log (opening stock, manual restocks, adjustments) —
  // these carry who did it, which the derived sales/PO/return rows don't.
  let logged = [];
  try {
    const res = await VW_DB.client.from('stock_movements').select('*').eq('product_id', productId).order('created_at', { ascending: false });
    logged = (res && res.data) || [];
  } catch (_) {}
  logged.forEach(m => {
    const isIn = (parseFloat(m.delta)||0) >= 0;
    movements.push({
      date: m.created_at, type: isIn ? 'in' : 'out', qty: parseFloat(m.delta)||0,
      reason: `${m.reason||m.kind||'Adjustment'}${m.by_name ? ' · by '+m.by_name : ''}`,
      ref: m.ref || '', color: isIn ? '#22c55e' : 'var(--red)'
    });
  });

  movements.sort((a,b)=>new Date(b.date)-new Date(a.date));

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>📦 ${product.name}</h3>
    <p class="sheet-meta">Current stock: ${product.stock||0} ${product.unit||'pc'}</p>
    <div style="max-height:400px;overflow-y:auto">
      ${!movements.length ? '<p class="empty-msg">No movement history yet</p>' :
      movements.map(m=>`
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div>
          <div style="font-size:13px;font-weight:600;color:${m.color}">${m.qty > 0 ? '+' : ''}${m.qty} ${product.unit||'pc'}</div>
          <div style="font-size:12px;color:var(--text3)">${m.reason}</div>
          <div style="font-size:11px;color:var(--text3)">${new Date(m.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</div>
        </div>
        <span class="badge" style="background:${m.type==='in'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'};color:${m.color};align-self:center">${m.type==='in'?'IN':'OUT'}</span>
      </div>`).join('')}
    </div>
    <button class="btn-secondary full-width" style="margin-top:10px" onclick="closeSheet()">Close</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

// =====================================================
// 5. QUOTATION → WORK ORDER CONVERSION
// =====================================================
async function convertQuotationToWorkOrder(quotationId) {
  const [q, customers, serviceVendors] = await Promise.all([
    VW_DB.getById(VW_DB.STORES.quotations, quotationId),
    VW_DB.all(VW_DB.STORES.customers),
    VW_DB.all(VW_DB.STORES.serviceVendors)
  ]);
  if (!q) return;
  const cust = customers.find(c => c.id === q.customerId);

  // Check if quotation has service/labour items
  const labourItems = (q.items||[]).filter(i =>
    ['Plumbing','Electrical','Painting','Carpentry','Tiling','Waterproofing','Installation','Labour','Service'].some(s =>
      (i.department||i.category||i.description||'').toLowerCase().includes(s.toLowerCase())
    )
  );

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>🔧 Convert to Work Order</h3>
    <p class="sheet-meta">${q.quoteNo} · ${cust?.name||q.customerName||'Customer'}</p>
    ${labourItems.length ? `
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:10px;margin-bottom:10px;font-size:12px;color:var(--text2)">
      ✓ Found ${labourItems.length} service item${labourItems.length>1?'s':''} in this quotation that can become work order tasks
    </div>` : ''}
    <div class="form-group"><label>Service Category *</label>
      <select id="wo-conv-cat">
        ${['Plumbing','Electrical','Painting','Carpentry','Tiling','Waterproofing','False Ceiling','Flooring','Modular Kitchen','Civil Work','Other'].map(c=>`<option>${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Site / Address</label>
      <input type="text" id="wo-conv-site" value="${q.address||q.siteName||cust?.address||''}" placeholder="Customer site address">
    </div>
    <div class="form-group"><label>Work Description</label>
      <textarea id="wo-conv-desc" style="height:80px">${labourItems.map(i=>i.description||i.name).join('\n')}</textarea>
    </div>
    <div class="form-group"><label>Assign Service Vendor</label>
      <select id="wo-conv-vendor">
        <option value="">— Assign later —</option>
        ${serviceVendors.map(v=>`<option value="${v.id}" data-name="${v.name}">${v.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Work Value (₹)</label>
      <input type="number" id="wo-conv-value" value="${Math.round(labourItems.reduce((s,i)=>{const {total}=i.netPrice!==undefined?i:{total:(i.price||0)*(i.qty||1)};return s+total;},0)||q.grandTotal||0)}">
    </div>
    <div class="form-group"><label>Expected Completion Date</label>
      <input type="date" id="wo-conv-due" value="${new Date(Date.now()+14*86400000).toISOString().split('T')[0]}">
    </div>
    <button class="btn-primary full-width" onclick="VW_EXTRAS.confirmConvertToWO(${quotationId})">Create Work Order</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function confirmConvertToWO(quotationId) {
  const q = await VW_DB.getById(VW_DB.STORES.quotations, quotationId);
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const cust = customers.find(c => c.id === q.customerId);
  const vendorSel = document.getElementById('wo-conv-vendor');
  const serviceVendorId = parseInt(vendorSel?.value)||null;
  const vendorName = serviceVendorId ? vendorSel?.options[vendorSel.selectedIndex]?.dataset.name||'' : '';
  const totalValue = parseFloat(document.getElementById('wo-conv-value')?.value)||0;
  const all = await VW_DB.all(VW_DB.STORES.workOrders);
  const fy = getFinancialYearLabel();
  const seq = String(all.length+1).padStart(4,'0');
  const workOrderNo = `WO/${fy}/${seq}`;
  const profile = VW_AUTH.getCurrentProfile();

  await VW_DB.put(VW_DB.STORES.workOrders, {
    workOrderNo, customerId: q.customerId, customerName: cust?.name||q.customerName||'',
    category: document.getElementById('wo-conv-cat')?.value||'Other',
    siteName: document.getElementById('wo-conv-site')?.value||'',
    description: document.getElementById('wo-conv-desc')?.value||'',
    serviceVendorId, vendorName,
    totalValue, paymentStructure: { advancePct:30, midPct:60, finalPct:10 },
    expectedCompletionDate: document.getElementById('wo-conv-due')?.value||'',
    stage: serviceVendorId ? 'assigned' : 'created',
    quotationId, quotationNo: q.quoteNo,
    payments:[], photos:[], notes:[],
    createdByName: profile?.name||'',
    createdAt: new Date().toISOString()
  });

  // Mark quotation as having a work order
  q.workOrderCreated = true;
  q.workOrderNo = workOrderNo;
  await VW_DB.put(VW_DB.STORES.quotations, q);

  showToast(`Work Order ${workOrderNo} created from ${q.quoteNo}`, 'success');
  closeSheet();
  navigateTo('service');
}

// =====================================================
// 6. EXECUTIVE DAILY SALES CARD on Admin Dashboard
// =====================================================
async function renderExecutiveSalesCard(invoices, staff, today) {
  const todayInv = invoices.filter(i =>
    new Date(i.date).toDateString() === today &&
    i.approvalStatus === 'approved'
  );
  if (!todayInv.length) return '';

  const byExec = {};
  todayInv.forEach(inv => {
    const name = inv.salesExecutiveName || inv.createdByName || 'Walk-in/Direct';
    if (!byExec[name]) byExec[name] = { count: 0, total: 0 };
    byExec[name].count++;
    byExec[name].total += inv.total||0;
  });

  const entries = Object.entries(byExec).sort((a,b)=>b[1].total-a[1].total);
  if (!entries.length) return '';
  const topTotal = entries[0][1].total || 1;

  return `
  <div class="card" style="margin-bottom:12px">
    <div class="card-header-row">
      <h3 class="card-title">Today's Leaderboard</h3>
      <span style="font-size:12px;color:var(--text3)">${todayInv.length} invoices</span>
    </div>
    ${entries.map(([name, data], i) => `
    <div class="lb-row">
      <div class="lb-rank ${i===0?'lb-rank-1':i===1?'lb-rank-2':'lb-rank-n'}">${i+1}</div>
      <div class="lb-info">
        <div class="lb-name">${name}</div>
        <div class="lb-bar-bg"><div class="lb-bar" style="width:${Math.round(data.total/topTotal*100)}%"></div></div>
      </div>
      <div>
        <div class="lb-val">₹${data.total>=100000?(data.total/100000).toFixed(1)+'L':data.total>=1000?Math.round(data.total/1000)+'K':Math.round(data.total)}</div>
        <div style="font-size:11px;color:var(--text3);text-align:right">${data.count} bill${data.count!==1?'s':''}</div>
      </div>
    </div>`).join('')}
  </div>`;
}

// =====================================================
// MIGRATE openStaff from hr.js — so hr.js can be gutted
// =====================================================
async function openStaffFull(id) {
  // Full staff detail with onboarding docs — was in hr.js
  const s = await VW_DB.getById(VW_DB.STORES.staff, id);
  if (!s) return;
  const isAdmin = VW_AUTH.isAdmin();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <h3 style="margin:0">${s.name}</h3>
        <p style="font-size:12px;color:var(--text3);margin:2px 0">${s.designation||s.role||'—'} · ${s.department||'—'}</p>
      </div>
      ${isAdmin ? `<button class="btn-sm" onclick="VW_HR_PAYROLL.showAddStaff(${id})">✏️ Edit</button>` : ''}
    </div>
    <div class="req-item-card" style="margin-bottom:10px">
      ${s.phone ? `<div style="font-size:13px;padding:2px 0">📞 ${s.phone}</div>` : ''}
      ${s.joiningDate ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">Joined: ${s.joiningDate}</div>` : ''}
      ${s.bankAccount ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">Bank: ${s.bankName||''} · ${s.bankAccount}</div>` : ''}
      ${s.aadhaarNumber ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">Aadhaar: ${s.aadhaarNumber}</div>` : ''}
      ${s.panNumber ? `<div style="font-size:12px;color:var(--text3);padding:2px 0">PAN: ${s.panNumber}</div>` : ''}
    </div>
    ${s.photoPath ? `<img src="${s.photoPath}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:10px">` : ''}
    <div style="display:flex;gap:8px">
      ${s.phone ? `<button class="btn-wa" style="flex:1" onclick="window.open('https://wa.me/91${(s.phone||'').replace(/\D/g,'')}','_blank')">💬 WhatsApp</button>` : ''}
      <button class="btn-primary" style="flex:1" onclick="VW_HR_PAYROLL.generatePayslip(${id})">📄 Payslip</button>
    </div>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Close</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
// Override the old openStaff proxy
window.openStaff = openStaffFull;

window.VW_EXTRAS = {
  renderLegacyCustomerPortal,
  getQuotationShareLink,
  shareQuotationLink,
  renderContractorPortal,
  shareReferralLink,
  checkCustomerBirthdays,
  sendCustomerBirthdayWishes,
  renderStockHistory,
  convertQuotationToWorkOrder,
  confirmConvertToWO,
  renderExecutiveSalesCard
};




/* === features.js === */

// ============================================================
// BATCH 1 FEATURES — 16 new features
// ============================================================

// ===== 1. ORDER SOURCE TRACKING =====
const ORDER_CHANNELS = [
  { value: 'walkin', label: '🚶 Walk-in' },
  { value: 'call', label: '📞 Phone Call' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'reference', label: '🤝 Reference/Referral' },
  { value: 'field_team', label: '🏃 Field Team' },
  { value: 'website', label: '🌐 Website/Online' },
  { value: 'other', label: '📋 Other' }
];

async function showOrderSourcePicker(customerId, onSelect) {
  const customer = customerId ? await VW_DB.getById(VW_DB.STORES.customers, customerId) : null;
  const current = customer ? customer.preferredChannel : null;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>How was this order received?</h3>
    <p class="sheet-meta">${customer ? customer.name : 'New customer'} &middot; Select the channel this order came through</p>
    ${ORDER_CHANNELS.map(c => `
      <div class="task-card" style="margin-bottom:8px;${c.value===current?'border-color:var(--gold)':''}" onclick="VW_FEATURES.selectOrderSource('${c.value}', ${customerId||'null'}, ${JSON.stringify(onSelect.toString())})">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:14px">${c.label}</span>
          ${c.value===current?'<span style="color:var(--gold);font-size:12px">Default</span>':''}
        </div>
      </div>`).join('')}
    ${['field_team','reference'].includes(current||'') ? `
      <div class="form-group" style="margin-top:8px">
        <label>Person name / detail</label>
        <input type="text" id="order-source-detail" value="${customer?.preferredChannelDetail||''}" placeholder="e.g. Rajesh Kumar">
      </div>` : ''}
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function selectOrderSource(channel, customerId, callbackStr) {
  const detail = document.getElementById('order-source-detail')?.value.trim() || '';
  if (customerId) {
    const cust = await VW_DB.getById(VW_DB.STORES.customers, customerId);
    if (cust) {
      cust.preferredChannel = channel;
      cust.preferredChannelDetail = detail;
      await VW_DB.put(VW_DB.STORES.customers, cust);
    }
  }
  closeSheet();
  showToast('Order source saved', 'success');
}
window.selectOrderSource = selectOrderSource;

// ===== 2. SPLIT PAYMENT =====

let splitRows = [];
function addSplitRow() {
  const idx = splitRows.length;
  splitRows.push({ method: 'Cash', amount: 0 });
  const container = document.getElementById('split-payment-rows');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'input-row';
  div.style.gap = '8px';
  div.id = `split-row-${idx}`;
  div.innerHTML = `
    <select onchange="VW_FEATURES.updateSplit(${idx},'method',this.value)" style="flex:1">
      <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
    </select>
    <input type="number" placeholder="Amount" style="flex:1" onchange="VW_FEATURES.updateSplit(${idx},'amount',this.value)">
    <button class="remove-btn" onclick="VW_FEATURES.removeSplitRow(${idx})">✕</button>`;
  container.appendChild(div);
}

function updateSplit(idx, field, value) {
  if (splitRows[idx]) splitRows[idx][field] = field === 'amount' ? parseFloat(value)||0 : value;
  const total = splitRows.reduce((s,r) => s + (r.amount||0), 0);
  const el = document.getElementById('split-total-check');
  if (el) el.textContent = `Total: ₹${total.toLocaleString('en-IN')}`;
}

function removeSplitRow(idx) {
  splitRows.splice(idx, 1);
  const row = document.getElementById(`split-row-${idx}`);
  if (row) row.remove();
}

function getSplitPayments() { return [...splitRows]; }

// ===== 3. SALESPERSON CREDITS =====
async function renderSalespersonPicker(invoiceId) {
  const [staff, execs] = await Promise.all([
    VW_DB.all(VW_DB.STORES.staff),
    VW_DB.all(VW_DB.STORES.executives)
  ]);
  const all = [
    ...execs.map(e => ({ id: 'exec-'+e.id, name: e.name, role: 'Executive' })),
    ...staff.filter(s => ['specialist','TL'].includes(s.team)).map(s => ({ id: 'staff-'+s.id, name: s.name, role: s.team === 'TL' ? 'Team Lead' : 'Specialist' }))
  ];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Salesperson Credits</h3>
    <p class="sheet-meta">Select who contributed to this sale — split % must total 100%</p>
    <div id="sp-list">
      ${all.map(p => `
        <label class="route-check-row" style="margin-bottom:6px;padding:8px;background:var(--bg2);border-radius:8px">
          <input type="checkbox" name="sp-credit" value="${p.id}" data-name="${p.name}" data-role="${p.role}">
          <span>${p.name} <span style="color:var(--text3);font-size:12px">${p.role}</span></span>
          <input type="number" value="100" min="1" max="100" style="width:56px;margin-left:auto" placeholder="%" id="sp-pct-${p.id}">
        </label>`).join('')}
    </div>
    <button class="btn-primary full-width" style="margin-top:12px" onclick="VW_FEATURES.saveSalespersonCredits(${invoiceId})">Save Credits</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveSalespersonCredits(invoiceId) {
  const checked = [...document.querySelectorAll('input[name="sp-credit"]:checked')];
  if (!checked.length) { showToast('Select at least one person', 'warn'); return; }
  const credits = checked.map(cb => ({
    staffId: cb.value,
    name: cb.dataset.name,
    role: cb.dataset.role,
    splitPct: parseFloat(document.getElementById('sp-pct-'+cb.value)?.value)||0
  }));
  const totalPct = credits.reduce((s,c) => s + c.splitPct, 0);
  if (Math.abs(totalPct - 100) > 0.1) { showToast(`Percentages must total 100% (currently ${totalPct}%)`, 'warn'); return; }
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  inv.salespersonCredits = credits;
  await VW_DB.put(VW_DB.STORES.invoices, inv);
  showToast('Salesperson credits saved', 'success');
  closeSheet();
}

// ===== 4. SALES RETURNS =====
async function showSalesReturn(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const customer = inv.customerId ? await VW_DB.getById(VW_DB.STORES.customers, inv.customerId) : null;
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Sales Return — ${inv.invoiceNo}</h3>
    <p class="sheet-meta">${customer ? customer.name : 'Walk-in'} &middot; Select items being returned</p>
    <div id="return-items">
      ${(inv.items||[]).map((item, idx) => `
        <label class="route-check-row" style="margin-bottom:6px;padding:8px;background:var(--bg2);border-radius:8px;display:block">
          <div style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" name="return-item" value="${idx}" data-name="${item.name}" data-price="${item.price}">
            <span style="flex:1">${item.name} &middot; ${item.qty} ${item.unit||''} &middot; ₹${(item.price||0).toLocaleString('en-IN')}</span>
          </div>
          <div style="margin-top:6px;margin-left:24px;display:flex;gap:8px">
            <input type="number" id="return-qty-${idx}" value="${item.qty}" min="1" max="${item.qty}" style="width:70px" placeholder="Qty">
            <input type="text" id="return-reason-${idx}" placeholder="Reason for return" style="flex:1">
          </div>
        </label>`).join('')}
    </div>
    <div class="form-group" style="margin-top:10px">
      <label>Refund Method</label>
      <select id="return-refund-method">
        <option value="Cash">Cash Refund</option>
        <option value="Credit Note">Credit Note (deduct from next purchase)</option>
        <option value="Adjust Next Invoice">Adjust in Next Invoice</option>
      </select>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <input type="text" id="return-notes" placeholder="Optional internal notes">
    </div>
    <button class="btn-primary full-width" style="margin-top:12px" onclick="VW_FEATURES.processReturn(${invoiceId})">Process Return</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function processReturn(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return;
  const checked = [...document.querySelectorAll('input[name="return-item"]:checked')];
  if (!checked.length) { showToast('Select items to return', 'warn'); return; }

  const profile = VW_AUTH.getCurrentProfile();
  const fy = getFinancialYearLabel();
  const seq = await VW_DB.incrementReturnSequence(fy);
  const creditNoteNo = `CN/${fy}/${String(seq).padStart(5,'0')}`;

  const returnItems = checked.map(cb => {
    const idx = parseInt(cb.value);
    const item = inv.items[idx];
    const qty = parseFloat(document.getElementById(`return-qty-${idx}`)?.value) || item.qty;
    const reason = document.getElementById(`return-reason-${idx}`)?.value || '';
    // Preserve productId from original invoice item for accurate stock restore
    return { name: item.name, qty, unit: item.unit, price: item.price, reason, productId: item.productId || null };
  });

  const totalRefund = returnItems.reduce((s,i) => s + i.price * i.qty, 0);
  const refundMethod = document.getElementById('return-refund-method')?.value || 'Cash';

  await VW_DB.put(VW_DB.STORES.salesReturns, {
    invoiceId, invoiceNo: inv.invoiceNo, customerId: inv.customerId,
    items: returnItems, totalRefund: Math.round(totalRefund),
    refundMethod, creditNoteNo,
    notes: document.getElementById('return-notes')?.value || '',
    processedByName: profile ? profile.name : '',
    createdAt: new Date().toISOString()
  });

  // Restock returned items — use productId from invoice item (reliable), fall back to name match
  for (const ri of returnItems) {
    let prod = null;
    if (ri.productId) {
      prod = await VW_DB.getById(VW_DB.STORES.products, ri.productId);
    }
    if (!prod) {
      prod = (await VW_DB.all(VW_DB.STORES.products)).find(p => p.name === ri.name);
    }
    if (prod) { prod.stock = (prod.stock||0) + ri.qty; await VW_DB.put(VW_DB.STORES.products, prod); }
  }

  showToast(`Return processed — Credit Note ${creditNoteNo}`, 'success');
  closeSheet();
}

// ===== 5. LOYALTY POINTS =====
const POINTS_PER_RS = 0.1; // 100 points per ₹1000 = 0.1 per rupee
const POINTS_VALUE = 0.1;  // 100 points = ₹10 = 0.1 per point
const MIN_REDEMPTION = 250; // min ₹250 worth of points to redeem

async function earnLoyaltyPoints(customerId, invoiceId, invoiceTotal) {
  if (!customerId) return;
  const points = Math.floor(invoiceTotal * POINTS_PER_RS);
  if (points <= 0) return;
  const cust = await VW_DB.getById(VW_DB.STORES.customers, customerId);
  if (!cust) return;
  cust.loyaltyPoints = (cust.loyaltyPoints || 0) + points;
  await VW_DB.put(VW_DB.STORES.customers, cust);
  await VW_DB.put(VW_DB.STORES.loyaltyTransactions, {
    customerId, invoiceId, type: 'earned', points,
    description: `Earned on invoice — ₹${invoiceTotal.toLocaleString('en-IN')}`,
    createdAt: new Date().toISOString()
  });
}

// ===== STAFF REWARDS POINTS =====
// Staff earn points on the bills they finalize, at an admin-set rate
// (setting 'staff_points_per_rs', default 0 = off, so the business controls the
// economics). Points live in loyalty_points keyed by staff_id and are spent in
// the Rewards Store. _adjustStaffPoints is the shared ledger writer.
async function _adjustStaffPoints(staffId, delta) {
  if (!staffId || !delta) return;
  const { data: row } = await VW_DB.client.from('loyalty_points').select('*').eq('staff_id', staffId).single().then(r=>r, ()=>({data:null}));
  if (row) {
    const update = { points: Math.max(0, (row.points||0) + delta), updated_at: new Date().toISOString() };
    if (delta > 0) update.lifetime_earned = (row.lifetime_earned||0) + delta;
    else update.lifetime_redeemed = (row.lifetime_redeemed||0) + Math.abs(delta);
    await VW_DB.client.from('loyalty_points').update(update).eq('staff_id', staffId);
  } else if (delta > 0) {
    await VW_DB.client.from('loyalty_points').insert({ staff_id: staffId, points: delta, lifetime_earned: delta, lifetime_redeemed: 0, updated_at: new Date().toISOString() });
  }
}

async function earnStaffPoints(invoiceTotal, invoiceId) {
  try {
    const profile = VW_AUTH.getCurrentProfile();
    const staffId = profile?.staffId;
    if (!staffId) return;
    const rate = parseFloat(await VW_DB.getSetting('staff_points_per_rs', 0)) || 0;
    if (rate <= 0) return;
    const points = Math.floor((invoiceTotal||0) * rate);
    if (points > 0) await _adjustStaffPoints(staffId, points);
  } catch(_) {}
}

async function showRedeemPoints(customerId, invoiceTotal) {
  const cust = await VW_DB.getById(VW_DB.STORES.customers, customerId);
  if (!cust) return;
  const points = cust.loyaltyPoints || 0;
  const maxRedeemValue = Math.floor(points * POINTS_VALUE);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Redeem Loyalty Points</h3>
    <p class="sheet-meta">${cust.name} has <strong>${points.toLocaleString()}</strong> points = ₹${maxRedeemValue.toLocaleString('en-IN')} value</p>
    ${maxRedeemValue < MIN_REDEMPTION ? `
      <p style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Minimum redemption is ₹${MIN_REDEMPTION} (${Math.ceil(MIN_REDEMPTION/POINTS_VALUE)} points). Customer currently has ₹${maxRedeemValue} worth.</p>
      <button class="btn-secondary full-width" onclick="closeSheet()">Close</button>
    ` : `
      <div class="form-group">
        <label>Points to redeem (max ${points.toLocaleString()})</label>
        <input type="number" id="redeem-points" value="${Math.min(points, Math.floor(invoiceTotal*0.3/POINTS_VALUE))}" max="${points}" min="${Math.ceil(MIN_REDEMPTION/POINTS_VALUE)}" oninput="VW_FEATURES.updateRedeemPreview()">
      </div>
      <div id="redeem-preview" style="font-size:13px;color:var(--green);padding:8px;background:rgba(34,197,94,0.08);border-radius:8px;margin-bottom:12px"></div>
      <button class="btn-primary full-width" onclick="VW_FEATURES.confirmRedeem(${customerId})">Redeem Points</button>
      <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
    `}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  updateRedeemPreview();
}

function updateRedeemPreview() {
  const pts = parseInt(document.getElementById('redeem-points')?.value)||0;
  const val = (pts * POINTS_VALUE).toFixed(2);
  const el = document.getElementById('redeem-preview');
  if (el) el.textContent = `${pts.toLocaleString()} points = ₹${parseFloat(val).toLocaleString('en-IN')} discount on this bill`;
}

async function confirmRedeem(customerId) {
  const pts = parseInt(document.getElementById('redeem-points')?.value)||0;
  if (pts < Math.ceil(MIN_REDEMPTION/POINTS_VALUE)) { showToast('Minimum redemption not met', 'warn'); return; }
  const cust = await VW_DB.getById(VW_DB.STORES.customers, customerId);
  if (!cust || (cust.loyaltyPoints||0) < pts) { showToast('Insufficient points', 'warn'); return; }
  cust.loyaltyPoints = (cust.loyaltyPoints||0) - pts;
  await VW_DB.put(VW_DB.STORES.customers, cust);
  const discount = pts * POINTS_VALUE;
  await VW_DB.put(VW_DB.STORES.loyaltyTransactions, {
    customerId, type: 'redeemed', points: -pts,
    description: `Redeemed for ₹${discount.toFixed(2)} discount`,
    createdAt: new Date().toISOString()
  });
  showToast(`₹${discount.toFixed(2)} discount applied — ${pts} points redeemed`, 'success');
  closeSheet();
  return discount;
}

// ===== 6. PROMOTIONS & SPIN & WIN =====
async function renderPromotionsPage() {
  const promos = await VW_DB.all(VW_DB.STORES.promotions);
  const redemptions = await VW_DB.all(VW_DB.STORES.promotionRedemptions);
  const active = promos.filter(p => p.active);
  const inactive = promos.filter(p => !p.active);
  const isAdmin = VW_AUTH.isAdmin();
  const recentRedemptions = [...redemptions].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,15);
  return `
  <div class="module-header"><h2>Promotions & Offers</h2>
    ${isAdmin ? `<button class="btn-sm" onclick="VW_FEATURES.showAddPromotion()">+ New</button>` : ''}
  </div>
  <div class="card">
    <h3 class="card-title">Active Promotions <span class="badge">${active.length}</span></h3>
    ${!active.length ? '<p class="empty-msg">No active promotions</p>' : active.map(p => `
      <div class="task-card" onclick="VW_FEATURES.openPromotion(${p.id})">
        <div class="task-card-header">
          <span class="task-dept">${p.name}</span>
          <span class="badge" style="background:${p.type==='spin_win'?'var(--gold)':'#378ADD'}">${p.type==='spin_win'?'🎰 Spin & Win':p.type==='promo_code'?'🏷 Code':'🎁 Threshold'}</span>
        </div>
        ${p.code ? `<p style="font-size:13px;font-family:monospace;letter-spacing:2px;margin:4px 0">${p.code}</p>` : ''}
        ${p.minInvoiceAmount ? `<p style="font-size:12px;color:var(--text3)">Min bill: ₹${p.minInvoiceAmount.toLocaleString('en-IN')}</p>` : ''}
        <p style="font-size:12px;color:var(--text3)">${p.validFrom||''} ${p.validUntil ? '→ '+p.validUntil : ''} &middot; Used ${p.usesCount||0}${p.maxUses?'/'+p.maxUses:''} times</p>
      </div>`).join('')}
  </div>
  ${inactive.length ? `
  <div class="card">
    <h3 class="card-title">Inactive</h3>
    ${inactive.map(p => `<div class="task-card" onclick="VW_FEATURES.openPromotion(${p.id})">
      <div class="task-card-header"><span class="task-dept" style="color:var(--text3)">${p.name}</span><span class="badge" style="background:#555">Inactive</span></div>
    </div>`).join('')}
  </div>` : ''}
  <div class="card">
    <h3 class="card-title">🎰 Spin & Win — Redemption Log</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:10px">Full audit trail — every spin logged with staff name, invoice, and gift won. Admin can void any entry.</p>
    ${!recentRedemptions.length ? '<p class="empty-msg">No spins yet</p>' : recentRedemptions.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div>
          <div style="font-size:13px;font-weight:600">${r.giftWon||'—'}</div>
          <div style="font-size:12px;color:var(--text3)">Invoice: ${r.invoiceId} &middot; By: ${r.redeemedByName||'—'} &middot; ₹${(r.invoiceTotal||0).toLocaleString('en-IN')}</div>
          <div style="font-size:11px;color:var(--text3)">${r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : ''}</div>
        </div>
        ${isAdmin ? `<button class="btn-sm" style="color:var(--red);flex-shrink:0" onclick="if(confirm('Void this gift? This will remove the free item from the invoice.'))VW_FEATURES.voidSpinRedemption(${r.id},${r.invoiceId})">Void</button>` : ''}
      </div>`).join('')}
  </div>`;
}

async function showAddPromotion() {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>New Promotion</h3>
    <div class="form-group"><label>Name *</label><input type="text" id="promo-name" placeholder="e.g. Monsoon Mega Offer"></div>
    <div class="form-group"><label>Type *</label>
      <select id="promo-type" onchange="VW_FEATURES.updatePromoTypeUI()">
        <option value="spin_win">🎰 Spin & Win (above ₹5,000)</option>
        <option value="promo_code">🏷 Promo Code</option>
        <option value="threshold_gift">🎁 Free Gift above threshold</option>
      </select>
    </div>
    <div id="promo-type-fields">
      <div class="form-group"><label>Min Invoice Amount (₹)</label><input type="number" id="promo-min-amount" value="5000"></div>
      <div class="form-group"><label>Gift Products (select which items to include in spin)</label>
        <select id="promo-gifts" multiple style="height:120px">
          ${products.map(p=>`<option value="${p.id}">${p.name} (${p.category})</option>`).join('')}
        </select>
        <p style="font-size:11px;color:var(--text3);margin-top:3px">Hold Ctrl/Cmd to select multiple</p>
      </div>
    </div>
    <div class="input-row">
      <div class="form-group" style="flex:1"><label>Valid From</label><input type="date" id="promo-from"></div>
      <div class="form-group" style="flex:1"><label>Valid Until</label><input type="date" id="promo-until"></div>
    </div>
    <div class="form-group"><label>Max Uses (blank = unlimited)</label><input type="number" id="promo-max-uses" placeholder="e.g. 100"></div>
    <button class="btn-primary full-width" onclick="VW_FEATURES.savePromotion()">Create Promotion</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function updatePromoTypeUI() {
  const type = document.getElementById('promo-type')?.value;
  const container = document.getElementById('promo-type-fields');
  if (!container) return;
  if (type === 'promo_code') {
    container.innerHTML = `
      <div class="form-group"><label>Promo Code * (uppercase, no spaces)</label><input type="text" id="promo-code" placeholder="e.g. MONSOON25" style="text-transform:uppercase"></div>
      <div class="form-group"><label>Discount Type</label>
        <select id="promo-disc-type"><option value="pct">Percentage (%)</option><option value="flat">Flat Amount (₹)</option></select>
      </div>
      <div class="form-group"><label>Discount Value</label><input type="number" id="promo-disc-value" placeholder="e.g. 10 for 10% or ₹500"></div>
      <div class="form-group"><label>Min Invoice Amount (₹)</label><input type="number" id="promo-min-amount" value="0"></div>`;
  } else {
    container.innerHTML = `
      <div class="form-group"><label>Min Invoice Amount (₹)</label><input type="number" id="promo-min-amount" value="${type==='spin_win'?5000:0}"></div>
      <div class="form-group"><label>Gift Products (select items for spin/gift)</label>
        <select id="promo-gifts" multiple style="height:120px"></select>
        <p style="font-size:11px;color:var(--text3);margin-top:3px">Hold Ctrl/Cmd to select multiple</p>
      </div>`;
    VW_DB.all(VW_DB.STORES.products).then(products => {
      const sel = document.getElementById('promo-gifts');
      if (sel) sel.innerHTML = products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    });
  }
}

async function savePromotion() {
  const name = document.getElementById('promo-name')?.value.trim();
  const type = document.getElementById('promo-type')?.value;
  if (!name) { showToast('Enter a promotion name', 'warn'); return; }
  const profile = VW_AUTH.getCurrentProfile();
  const record = {
    name, type,
    minInvoiceAmount: parseFloat(document.getElementById('promo-min-amount')?.value)||0,
    validFrom: document.getElementById('promo-from')?.value || null,
    validUntil: document.getElementById('promo-until')?.value || null,
    maxUses: parseInt(document.getElementById('promo-max-uses')?.value)||null,
    active: true, usesCount: 0,
    createdByName: profile ? profile.name : '',
    createdAt: new Date().toISOString()
  };
  if (type === 'promo_code') {
    record.code = (document.getElementById('promo-code')?.value||'').toUpperCase().trim();
    record.discountType = document.getElementById('promo-disc-type')?.value;
    record.discountValue = parseFloat(document.getElementById('promo-disc-value')?.value)||0;
    if (!record.code) { showToast('Enter a promo code', 'warn'); return; }
  } else {
    const giftSel = document.getElementById('promo-gifts');
    const giftIds = giftSel ? [...giftSel.selectedOptions].map(o=>o.value) : [];
    record.gifts = giftIds.map(id => ({ productId: id, probability: Math.floor(100/Math.max(giftIds.length,1)) }));
  }
  await VW_DB.put(VW_DB.STORES.promotions, record);
  showToast('Promotion created', 'success');
  closeSheet();
  navigateTo('promotions');
}

async function openPromotion(id) {
  const promo = await VW_DB.getById(VW_DB.STORES.promotions, id);
  if (!promo) return;
  const isAdmin = VW_AUTH.isAdmin();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${promo.name}</h3>
    <p class="sheet-meta">${promo.type==='spin_win'?'🎰 Spin & Win':promo.type==='promo_code'?'🏷 Promo Code':'🎁 Threshold Gift'} &middot; ${promo.active?'<span style="color:var(--green)">Active</span>':'<span style="color:var(--text3)">Inactive</span>'}</p>
    ${promo.code ? `<div style="font-size:24px;font-family:monospace;font-weight:700;text-align:center;letter-spacing:4px;padding:12px;background:var(--bg2);border-radius:8px;margin:8px 0">${promo.code}</div>` : ''}
    <div class="req-item-card" style="margin:10px 0">
      ${promo.minInvoiceAmount ? `<div style="font-size:13px;padding:3px 0"><strong>Min Bill:</strong> ₹${promo.minInvoiceAmount.toLocaleString('en-IN')}</div>` : ''}
      ${promo.discountValue ? `<div style="font-size:13px;padding:3px 0"><strong>Discount:</strong> ${promo.discountType==='pct'?promo.discountValue+'%':'₹'+promo.discountValue}</div>` : ''}
      <div style="font-size:13px;padding:3px 0"><strong>Valid:</strong> ${promo.validFrom||'—'} → ${promo.validUntil||'No expiry'}</div>
      <div style="font-size:13px;padding:3px 0"><strong>Used:</strong> ${promo.usesCount||0}${promo.maxUses?'/'+promo.maxUses:''} times</div>
    </div>
    ${promo.type === 'spin_win' ? `
    <div style="margin:12px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;font-weight:600">🎁 Wheel Gifts (max 8)</span>
        ${isAdmin ? `<button class="btn-sm" onclick="VW_FEATURES.editSpinGifts(${id})">✏️ Edit Gifts</button>` : ''}
      </div>
      ${(promo.gifts||[]).length ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${(promo.gifts).map((g,i) => `
            <div style="padding:6px 10px;background:var(--bg2);border-radius:8px;font-size:12px;border-left:3px solid hsl(${i*45},70%,50%)">
              ${g.name||'Gift '+(i+1)}
            </div>`).join('')}
        </div>` : '<p style="font-size:12px;color:var(--text3)">No gifts set yet — tap Edit Gifts to add up to 8</p>'}
    </div>` : ''}
    ${isAdmin ? `
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-secondary" style="flex:1" onclick="VW_FEATURES.togglePromotion(${id},${!promo.active})">${promo.active?'Deactivate':'Activate'}</button>
    </div>` : ''}
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function editSpinGifts(promoId) {
  const promo = await VW_DB.getById(VW_DB.STORES.promotions, promoId);
  if (!promo) return;
  const products = await VW_DB.all(VW_DB.STORES.products);
  const currentGifts = (promo.gifts || []).slice(0, 8);
  // Pad to 8 slots
  while (currentGifts.length < 8) currentGifts.push({ name: '', productId: null, probability: 1 });

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Edit Spin & Win Gifts</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Set up to 8 gifts on the wheel. Leave a slot blank to skip it. Change these anytime — takes effect immediately on the next spin.</p>
    ${currentGifts.map((g, i) => `
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <div style="width:28px;height:28px;border-radius:50%;background:hsl(${i*45},70%,50%);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0">${i+1}</div>
        <input type="text" id="gift-name-${i}" value="${g.name||''}" placeholder="Gift name (e.g. LED Bulb 9W)" style="flex:2" list="gift-products-${i}">
        <datalist id="gift-products-${i}">${products.map(p=>`<option value="${p.name}">`).join('')}</datalist>
        <input type="number" id="gift-prob-${i}" value="${g.probability||1}" min="1" max="10" style="width:50px" title="Probability weight (higher = more likely)">
      </div>`).join('')}
    <p style="font-size:11px;color:var(--text3);margin-bottom:12px">Probability weight: 1-10. Higher number = more likely to win. Equal weights = equal chance.</p>
    <button class="btn-primary full-width" onclick="VW_FEATURES.saveSpinGifts(${promoId})">Save Gifts</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="VW_FEATURES.openPromotion(${promoId})">Cancel</button>
  `;
}

async function saveSpinGifts(promoId) {
  const promo = await VW_DB.getById(VW_DB.STORES.promotions, promoId);
  if (!promo) return;
  const gifts = [];
  for (let i = 0; i < 8; i++) {
    const name = document.getElementById(`gift-name-${i}`)?.value.trim();
    const prob = parseInt(document.getElementById(`gift-prob-${i}`)?.value) || 1;
    if (name) gifts.push({ name, probability: prob, productId: null });
  }
  if (!gifts.length) { showToast('Add at least one gift', 'warn'); return; }
  promo.gifts = gifts;
  await VW_DB.put(VW_DB.STORES.promotions, promo);
  showToast(`${gifts.length} gift${gifts.length>1?'s':''} saved on the wheel`, 'success');
  await openPromotion(promoId);
}

async function togglePromotion(id, active) {
  const p = await VW_DB.getById(VW_DB.STORES.promotions, id);
  if (!p) return;
  p.active = active;
  await VW_DB.put(VW_DB.STORES.promotions, p);
  showToast(active ? 'Promotion activated' : 'Promotion deactivated', 'success');
  closeSheet();
  navigateTo('promotions');
}

async function showSpinWheel(invoiceId, invoiceTotal) {
  const promos = await VW_DB.all(VW_DB.STORES.promotions);
  const spinPromo = promos.find(p => p.active && p.type === 'spin_win'
    && invoiceTotal >= (p.minInvoiceAmount||5000)
    && (!p.validFrom || new Date(p.validFrom) <= new Date())
    && (!p.validUntil || new Date(p.validUntil) >= new Date()));
  if (!spinPromo || !spinPromo.gifts?.length) return false;

  // Theft prevention: each invoice spins exactly once
  const existing = await VW_DB.all(VW_DB.STORES.promotionRedemptions);
  if (existing.some(r => r.invoiceId === invoiceId)) return false;

  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv) return false;
  // Credit sales CAN spin — executive decides if customer is present
  // The cancel X lets them skip if customer has already left

  const products = await VW_DB.all(VW_DB.STORES.products);
  const gifts = spinPromo.gifts.slice(0, 8).map(g => {
    // Try to match gift name to a product for photo display
    const prod = products.find(p => p.name === g.name);
    return { ...g, photo: prod?.photos?.[0]?.url || null };
  });

  const colors = ['#C8972B','#378ADD','#22c55e','#ef4444','#7F77DD','#f97316','#06b6d4','#84cc16'];
  const segAngle = 360 / gifts.length;
  const segments = gifts.map((g, i) => {
    const color = colors[i % colors.length];
    const rotate = segAngle * i;
    return `<div class="spin-seg" style="transform:rotate(${rotate}deg);background:${color}">
      <span style="transform:rotate(${segAngle/2}deg)">${(g.name||'Gift').split(' ').slice(0,2).join(' ')}</span>
    </div>`;
  }).join('');

  // Store gifts in window to avoid JSON encoding issues in onclick attributes
  window._spinGifts = gifts;
  window._spinPromoId = spinPromo.id;
  window._spinInvoiceId = invoiceId;
  const isCreditSale = inv.creditSale;

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 4px">
      <h3 style="margin:0">🎰 Spin & Win!</h3>
      <button onclick="closeSheet()" style="background:none;border:1px solid var(--border);border-radius:20px;padding:4px 12px;color:var(--text3);font-size:13px;cursor:pointer">✕ Customer not present</button>
    </div>
    ${isCreditSale ? `<p style="font-size:12px;color:var(--gold);margin-bottom:8px">⚠️ Credit sale — only spin if customer is physically present. Tap ✕ if they've already left.</p>` : ''}
    <p style="text-align:center;font-size:13px;color:var(--text3);margin-bottom:12px">Bill ₹${invoiceTotal.toLocaleString('en-IN')} — Customer wins a FREE gift!</p>

    <div style="position:relative;width:260px;height:260px;margin:0 auto 16px">
      <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:24px solid var(--gold);z-index:10;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))"></div>
      <div id="spin-wheel" style="width:260px;height:260px;border-radius:50%;position:relative;overflow:hidden;border:4px solid var(--gold);box-shadow:0 4px 20px rgba(200,151,43,0.4);transition:transform 0s;transform:rotate(0deg)">
        ${segments}
      </div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:var(--bg1);border:3px solid var(--gold);display:flex;align-items:center;justify-content:center;z-index:5;font-size:18px">🎁</div>
    </div>

    <div id="spin-result-msg" style="text-align:center;min-height:50px;margin-bottom:10px"></div>

    <button class="btn-primary full-width" id="spin-btn" style="font-size:16px" onclick="VW_FEATURES.doSpin()">🎰 Spin the Wheel!</button>
    <p style="text-align:center;font-size:11px;color:var(--text3);margin-top:6px">Show screen to customer — let them tap Spin</p>

    <style>
      .spin-seg{position:absolute;width:50%;height:50%;top:0;right:0;transform-origin:0% 100%;clip-path:polygon(0 0,100% 0,100% 100%);display:flex;align-items:flex-start;justify-content:flex-end;padding:8px 4px 0 0}
      .spin-seg span{font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.7);display:block;max-width:60px;text-align:right;line-height:1.2}
    </style>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  return true;
}

let _spinInProgress = false;
async function doSpin() {
  if (_spinInProgress) return;
  _spinInProgress = true;

  // Read from window vars set by showSpinWheel — avoids JSON encoding issues
  const gifts = window._spinGifts || [];
  const promoId = window._spinPromoId;
  const invoiceId = window._spinInvoiceId;

  if (!gifts.length) { showToast('No gifts configured', 'warn'); _spinInProgress = false; return; }

  const btn = document.getElementById('spin-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Spinning...'; }

  // Weighted random winner selection
  const totalProb = gifts.reduce((s,g) => s+(g.probability||1), 0);
  let rand = Math.random() * totalProb;
  let winnerIdx = gifts.length - 1;
  let cumulative = 0;
  for (let i = 0; i < gifts.length; i++) {
    cumulative += (gifts[i].probability||1);
    if (rand <= cumulative) { winnerIdx = i; break; }
  }
  const winner = gifts[winnerIdx];

  // Calculate final rotation so the wheel lands on the winner's segment
  const segAngle = 360 / gifts.length;
  // Winner segment center angle
  const winnerCenter = segAngle * winnerIdx + segAngle / 2;
  // We want the pointer (top = 0°) to point at the winner
  // Add multiple full spins for excitement (5-8 full rotations)
  const spins = 5 + Math.floor(Math.random() * 4);
  const finalAngle = spins * 360 + (360 - winnerCenter);

  const wheel = document.getElementById('spin-wheel');
  if (wheel) {
    wheel.style.transition = `transform ${2.5 + Math.random()}s cubic-bezier(0.17,0.67,0.12,0.99)`;
    wheel.style.transform = `rotate(${finalAngle}deg)`;
  }

  // Show result after spin completes
  await new Promise(r => setTimeout(r, 4000));

  const resultEl = document.getElementById('spin-result-msg');
  if (resultEl) {
    resultEl.innerHTML = `
      <div style="font-size:36px;margin-bottom:6px">🎉</div>
      <div style="font-size:20px;font-weight:700;color:var(--gold)">${winner.name}</div>
      <p style="font-size:13px;color:var(--text3);margin-top:4px">Added FREE to the invoice!</p>`;
  }

  // Add won item to invoice as ₹0 free gift line
  try {
    const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
    if (inv) {
      inv.items = [...(inv.items||[]), {
        name: `🎁 ${winner.name} (Free Spin & Win Gift)`,
        qty: 1, unit: 'pc', price: 0, gst: 0, isFreeGift: true
      }];
      inv.spinWinGift = winner.name;
      inv.spinWinAt = new Date().toISOString();
      await VW_DB.put(VW_DB.STORES.invoices, inv);
    }

    // Record redemption with full audit trail (staff name, time, invoice)
    const promo = await VW_DB.getById(VW_DB.STORES.promotions, promoId);
    if (promo) { promo.usesCount = (promo.usesCount||0)+1; await VW_DB.put(VW_DB.STORES.promotions, promo); }
    const profile = VW_AUTH.getCurrentProfile();
    await VW_DB.put(VW_DB.STORES.promotionRedemptions, {
      promotionId: promoId, invoiceId,
      giftWon: winner.name,
      redeemedByName: profile?.name||'Unknown',
      redeemedByRole: profile?.role||'',
      invoiceTotal: inv?.total||0,
      createdAt: new Date().toISOString()
    });
  } catch(e) {
    console.error('Spin save error:', e);
    showToast('Gift recorded locally — sync may be needed', 'warn');
  }

  if (btn) { btn.disabled = false; btn.textContent = '✓ Confirm Gift Given'; btn.onclick = closeSheet; }
  _spinInProgress = false;
}

async function voidSpinRedemption(redemptionId, invoiceId) {
  if (!VW_AUTH.isAdmin()) { showToast('Admin only', 'warn'); return; }
  // Remove from redemptions
  await VW_DB.del(VW_DB.STORES.promotionRedemptions, redemptionId);
  // Remove the free gift line from the invoice
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (inv) {
    inv.items = (inv.items||[]).filter(i => !i.isFreeGift);
    inv.spinWinGift = null;
    await VW_DB.put(VW_DB.STORES.invoices, inv);
  }
  showToast('Spin & Win gift voided', 'info');
  closeSheet();
}

// ===== CLOSURE HAPPY MOMENT PHOTO (MANDATORY) =====
// Required after every invoice — blocks completion until photo is taken
// or Admin explicitly overrides. Photo feeds into:
// 1. Customer's WhatsApp feedback message (shared as a happy moment)
// 2. Salesperson incentive score (photo + 4-5 star feedback = fully satisfied)
// 3. Admin invoice archive — visual proof of delivery and customer presence

async function showClosurePhotoPrompt(invoiceId, invoiceNo, customerName) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="text-align:center;padding:8px 0 12px">
      <div style="font-size:32px;margin-bottom:6px">📸</div>
      <h3 style="margin:0 0 4px">Happy Moment!</h3>
      <p style="font-size:13px;color:var(--text3);margin-bottom:0">Take a photo with <strong>${customerName||'the customer'}</strong> to celebrate their purchase. Saves to their invoice and sends with the feedback message.</p>
    </div>

    <div id="closure-photo-preview" style="display:none;text-align:center;margin-bottom:12px">
      <img id="closure-photo-img" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;border:3px solid var(--gold)">
      <p style="font-size:12px;color:var(--green);margin-top:6px">✓ Photo ready</p>
    </div>

    <input type="file" id="closure-photo-input" accept="image/*" capture="environment" style="display:none" onchange="VW_FEATURES.previewClosurePhoto(this)">

    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn-primary" id="closure-take-btn" style="font-size:15px" onclick="document.getElementById('closure-photo-input').click()">📷 Take Photo with Customer</button>
      <button class="btn-secondary" id="closure-save-btn" style="display:none;background:var(--gold);color:#000;font-weight:700" onclick="VW_FEATURES.saveClosurePhoto(${invoiceId})">✓ Save &amp; Send Feedback to Customer</button>
      <button class="btn-secondary" onclick="closeSheet()" style="color:var(--text3);font-size:13px">Skip for now</button>
    </div>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function previewClosurePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('closure-photo-img');
    const preview = document.getElementById('closure-photo-preview');
    const saveBtn = document.getElementById('closure-save-btn');
    const takeBtn = document.getElementById('closure-take-btn');
    if (img) img.src = e.target.result;
    if (preview) preview.style.display = '';
    if (saveBtn) saveBtn.style.display = '';
    if (takeBtn) takeBtn.textContent = '🔄 Retake Photo';
  };
  reader.readAsDataURL(file);
}

async function saveClosurePhoto(invoiceId) {
  const input = document.getElementById('closure-photo-input');
  const file = input?.files[0];
  if (!file) { showToast('Please take a photo first', 'warn'); return; }

  const saveBtn = document.getElementById('closure-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  const profile = VW_AUTH.getCurrentProfile();
  let photoUrl = '';
  try {
    const dataUrl = await new Promise((res,rej) => {
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
    });
    const path = `closure/${invoiceId}-${Date.now()}.jpg`;
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    await VW_DB.client.storage.from('visit-photos').upload(path, bytes, { contentType: 'image/jpeg' });
    const { data: pubUrl } = VW_DB.client.storage.from('visit-photos').getPublicUrl(path);
    photoUrl = pubUrl?.publicUrl || '';
  } catch(e) {
    console.error('Closure photo upload error:', e);
    showToast('Photo upload failed — try again', 'warn');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '✓ Save & Send Feedback'; }
    return;
  }

  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (inv) {
    inv.closurePhoto = photoUrl;
    inv.closurePhotoBy = profile?.name || '';
    inv.closurePhotoByRole = profile?.role || '';
    inv.closurePhotoAt = new Date().toISOString();
    inv.closureComplete = true;
    await VW_DB.put(VW_DB.STORES.invoices, inv);
    // Send WhatsApp feedback message with the photo link
    await sendPostInvoiceFeedbackWithPhoto(inv, photoUrl);
  }

  showToast('Happy moment saved! Feedback sent 🎉', 'success');
  closeSheet();
}

// sendPostInvoiceFeedbackWithPhoto is defined below

async function sendPostInvoiceFeedbackWithPhoto(invoice, photoUrl) {
  if (!invoice.customerId) return;
  const customer = await VW_DB.getById(VW_DB.STORES.customers, invoice.customerId);
  if (!customer?.phone) return;
  const settings = await VW_DB.getById(VW_DB.STORES.settings, 'whatsapp_config');
  const storeName = settings?.value?.storeName || 'V Wholesale';
  const feedbackUrl = settings?.value?.feedbackUrl || '';

  const msg = encodeURIComponent(
    `Dear ${customer.name},\n\nThank you for shopping at ${storeName}! 🎉🏠\n\n` +
    `Your Invoice: *${invoice.invoiceNo}* | ₹${invoice.total?.toLocaleString('en-IN')}\n\n` +
    (photoUrl ? `📸 Your happy moment: ${photoUrl}\n\n` : '') +
    `We'd love to hear how we did — takes just 30 seconds:\n${feedbackUrl}\n\n` +
    `Your feedback helps our team and earns you bonus loyalty points! 🌟\n\n` +
    `Thank you for choosing ${storeName}. See you again! 🙏`
  );
  const phone = customer.phone.replace(/\D/g, '');
  window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
}

// Called from incentive tracking — checks if an invoice has a verified
// "fully satisfied" closure (photo taken + 4-5 star feedback received)
async function isFullySatisfiedClosure(invoiceId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invoiceId);
  if (!inv?.closurePhoto) return false;
  const feedbacks = await VW_DB.all(VW_DB.STORES.feedback);
  const fb = feedbacks.find(f => f.invoiceId === invoiceId || f.customerId === inv.customerId);
  return fb && fb.rating >= 4;
}
async function renderCatalogsPage() {
  const catalogs = await VW_DB.all(VW_DB.STORES.catalogs);
  const uploads = catalogs.filter(c => c.type === 'upload');
  const generated = catalogs.filter(c => c.type === 'generated');

  return `
  <div class="module-header"><h2>Catalogs & Pricesheets</h2>
    ${VW_AUTH.isAdmin() ? `<button class="btn-sm" onclick="VW_FEATURES.showUploadCatalog()">+ Upload</button>` : ''}
  </div>
  <div class="entry-type-grid" style="margin-bottom:14px">
    <button class="entry-type-btn active" onclick="VW_FEATURES.switchCatalogTab('upload',this)"><span class="et-icon">📄</span>Brand Catalogs</button>
    <button class="entry-type-btn" onclick="VW_FEATURES.switchCatalogTab('live',this)"><span class="et-icon">📊</span>Live Price List</button>
  </div>
  <div id="catalog-tab-content">
    ${renderUploadedCatalogs(uploads)}
  </div>`;
}

function renderUploadedCatalogs(catalogs) {
  if (!catalogs.length) return '<div class="card"><p class="empty-msg">No catalogs uploaded yet — tap + Upload to add brand MRP sheets, product catalogs, or pricesheets</p></div>';

  // Group by brand
  const byBrand = {};
  catalogs.forEach(c => {
    const brand = c.brand || 'Other';
    if (!byBrand[brand]) byBrand[brand] = [];
    byBrand[brand].push(c);
  });

  return Object.entries(byBrand).sort(([a],[b])=>a.localeCompare(b)).map(([brand, bCatalogs]) => `
    <div class="card" style="margin-bottom:10px">
      <div style="font-weight:700;font-size:13px;color:var(--gold);margin-bottom:10px">${brand}</div>
      ${bCatalogs.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(c => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border2)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
          <div style="font-size:11px;color:var(--text3)">${c.category?c.category+' · ':''}${c.uploadedByName||''} · ${c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : ''}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn-sm" onclick="window.open('${c.fileUrl}','_blank')">👁</button>
          <button class="btn-sm" onclick="VW_FEATURES.shareCatalog('${c.fileUrl}','${c.name}')">📤</button>
          <button class="btn-sm" style="background:rgba(245,200,66,0.12);color:var(--gold)" onclick="VW_FEATURES.replaceCatalog(${c.id},'${(c.name||'').replace(/'/g,"\\'")}','${(c.brand||'').replace(/'/g,"\\'")}','${(c.category||'').replace(/'/g,"\\'")}')">🔄</button>
          ${VW_AUTH.isAdmin() ? `<button class="btn-sm" style="color:var(--red)" onclick="VW_FEATURES.deleteCatalog(${c.id})">🗑</button>` : ''}
        </div>
      </div>`).join('')}
    </div>`).join('');
}

async function switchCatalogTab(tab, btn) {
  document.querySelectorAll('.entry-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('catalog-tab-content');
  if (tab === 'upload') {
    const catalogs = await VW_DB.all(VW_DB.STORES.catalogs);
    container.innerHTML = renderUploadedCatalogs(catalogs.filter(c => c.type==='upload'));
  } else {
    // Live Price List — pull from products, show brand + model + price in a clean table
    const products = await VW_DB.all(VW_DB.STORES.products);
    const byCategory = {};
    products.filter(p=>p.price>0).forEach(p => {
      const key = p.category||'Other';
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(p);
    });

    container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:12px;color:var(--text3)">Prices from inventory · ${products.filter(p=>p.price>0).length} products</div>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" onclick="VW_FEATURES.printLivePriceList()">🖨 Print</button>
        <button class="btn-sm" onclick="VW_FEATURES.uploadCatalogAsPriceList()">📤 Upload Price PDF</button>
      </div>
    </div>
    ${Object.entries(byCategory).sort(([a],[b])=>a.localeCompare(b)).map(([cat, prods]) => `
    <div class="card" style="margin-bottom:10px">
      <div style="font-weight:700;font-size:13px;color:var(--gold);margin-bottom:8px;text-transform:uppercase">${cat} <span style="font-size:11px;font-weight:400;color:var(--text3)">(${prods.length} items)</span></div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;padding:4px 2px;color:var(--text3);font-weight:600">Product</th>
          <th style="text-align:right;padding:4px 2px;color:var(--text3);font-weight:600">Price</th>
          <th style="text-align:right;padding:4px 2px;color:var(--text3);font-weight:600">MRP</th>
          <th style="text-align:center;padding:4px 2px;color:var(--text3);font-weight:600">Stock</th>
        </tr></thead>
        <tbody>
          ${prods.sort((a,b)=>(a.brand||'').localeCompare(b.brand||'')).map(p => `
          <tr style="border-bottom:1px solid var(--border2)">
            <td style="padding:5px 2px">
              <div style="font-weight:600">${p.brand?`<span style="color:var(--text3)">${p.brand}</span> `:''}${p.name}</div>
              ${p.model?`<div style="font-size:10px;color:var(--text3)">${p.model}</div>`:''}
            </td>
            <td style="text-align:right;padding:5px 2px;font-weight:700;color:var(--gold)">₹${(p.price||0).toLocaleString('en-IN')}<span style="font-size:10px;color:var(--text3)">/${p.unit||'pc'}</span></td>
            <td style="text-align:right;padding:5px 2px;color:var(--text3);font-size:11px">${p.mrp?'₹'+p.mrp.toLocaleString('en-IN'):'-'}</td>
            <td style="text-align:center;padding:5px 2px"><span style="font-size:11px;color:${(p.stock||0)<=5?'var(--red)':(p.stock||0)<=20?'var(--gold)':'var(--green)'}">${p.stock||0} ${p.unit||''}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('')}`;
  }
}

async function replaceCatalog(catalogId, currentName, currentBrand, currentCategory) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>🔄 Replace Catalog</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:12px">Upload a new version to replace the existing file. Name and brand will be preserved.</p>
    <div class="form-group"><label>Name</label><input type="text" id="rep-cat-name" value="${currentName}"></div>
    <div class="form-group"><label>Brand</label><input type="text" id="rep-cat-brand" value="${currentBrand}"></div>
    <div class="form-group"><label>Category</label><input type="text" id="rep-cat-category" value="${currentCategory}"></div>
    <div class="form-group"><label>New File (PDF or Image) *</label>
      <input type="file" id="rep-cat-file" accept=".pdf,image/*"></div>
    <div id="rep-cat-status" style="font-size:12px;color:var(--text3);margin-bottom:10px"></div>
    <div style="display:flex;gap:8px">
      <button class="btn-secondary" style="flex:1" onclick="closeSheet()">Cancel</button>
      <button class="btn-primary" style="flex:1" onclick="VW_FEATURES.doReplaceCatalog(${catalogId})">Replace File</button>
    </div>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function doReplaceCatalog(catalogId) {
  const name = document.getElementById('rep-cat-name')?.value.trim();
  const brand = document.getElementById('rep-cat-brand')?.value.trim();
  const category = document.getElementById('rep-cat-category')?.value.trim();
  const file = document.getElementById('rep-cat-file')?.files[0];
  if (!file) { showToast('Choose a new file first', 'warn'); return; }
  const statusEl = document.getElementById('rep-cat-status');
  if (statusEl) statusEl.textContent = 'Uploading new version...';
  try {
    const dataUrl = await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
    const { path, url } = await VW_DB.uploadCatalog(dataUrl, file.name);
    const profile = VW_AUTH.getCurrentProfile();
    await VW_DB.put(VW_DB.STORES.catalogs, {
      id: catalogId, name, brand, category, type:'upload',
      filePath: path, fileUrl: url,
      updatedAt: new Date().toISOString(),
      updatedByName: profile?.name||'',
    });
    closeSheet();
    showToast(`${name} updated ✓`, 'success');
    navigateTo('catalogs');
  } catch(e) {
    if (statusEl) statusEl.textContent = 'Upload failed — try again';
    showToast('Upload failed', 'warn');
  }
}

function uploadCatalogAsPriceList() {
  showToast('Upload a PDF price list under Brand Catalogs tab', 'info');
  setTimeout(() => document.querySelector('.entry-type-btn')?.click(), 500);
}

async function showUploadCatalog() {
  if (!VW_AUTH.isAdmin()) { showToast('Only Admin can add catalogs', 'warn'); return; }
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Upload Catalog / Pricesheet</h3>
    <div class="form-group"><label>Name *</label><input type="text" id="cat-name" placeholder="e.g. Ashirvad Pipes MRP June 2026"></div>
    <div class="form-group"><label>Brand</label><input type="text" id="cat-brand" placeholder="e.g. Ashirvad" list="cat-brand-list"><datalist id="cat-brand-list">${_inventoryBrandList.map(b=>`<option value="${b}">`).join('')}</datalist></div>
    <div class="form-group"><label>Category</label><input type="text" id="cat-category" placeholder="e.g. Plumbing"></div>
    <div class="form-group"><label>File (PDF or Image) *</label>
      <input type="file" id="cat-file" accept=".pdf,image/*">
    </div>
    <label class="route-check-row" style="margin-bottom:12px">
      <input type="checkbox" id="cat-customer-visible">
      <span>Visible to customers (shown on public catalog share link)</span>
    </label>
    <div id="cat-upload-status"></div>
    <button class="btn-primary full-width" onclick="VW_FEATURES.uploadCatalogFile()">Upload Catalog</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function uploadCatalogFile() {
  const name = document.getElementById('cat-name')?.value.trim();
  const fileInput = document.getElementById('cat-file');
  const file = fileInput?.files[0];
  if (!name || !file) { showToast('Fill in name and choose a file', 'warn'); return; }
  const statusEl = document.getElementById('cat-upload-status');
  if (statusEl) statusEl.textContent = 'Uploading...';
  const dataUrl = await new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
  const { path, url } = await VW_DB.uploadCatalog(dataUrl, file.name);
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.catalogs, {
    name, brand: document.getElementById('cat-brand')?.value.trim()||'',
    category: document.getElementById('cat-category')?.value.trim()||'',
    type: 'upload', filePath: path, fileUrl: url,
    isCustomerVisible: document.getElementById('cat-customer-visible')?.checked||false,
    isTeamVisible: true,
    uploadedByName: profile?.name||'',
    createdAt: new Date().toISOString()
  });
  showToast('Catalog uploaded', 'success');
  closeSheet();
  navigateTo('catalogs');
}

async function shareCatalog(url, name) {
  if (navigator.share) {
    await navigator.share({ title: name + ' — V Wholesale', url });
  } else {
    await navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard', 'success');
  }
}

async function deleteCatalog(id) {
  await VW_DB.del(VW_DB.STORES.catalogs, id);
  showToast('Catalog deleted', 'info');
  navigateTo('catalogs');
}

async function printLivePriceList() {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const byCategory = {};
  products.forEach(p => { byCategory[p.category||'Other'] = byCategory[p.category||'Other']||[]; byCategory[p.category||'Other'].push(p); });
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>V Wholesale Price List</title>
  <style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:24px;font-size:12px}
  h1{font-size:18px;font-weight:700}h2{font-size:13px;color:#C8972B;margin-top:16px;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}td,th{padding:5px 8px;border:1px solid #ddd}
  th{background:#f5f5f5;font-weight:700}.print-btn{padding:8px 20px;background:#C8972B;color:#000;border:none;cursor:pointer;border-radius:6px;margin-bottom:16px}
  @media print{.print-btn{display:none}}</style></head><body>
  <button class="print-btn" onclick="window.print()">Print</button>
  <h1>Vassure Wholesale Pvt Ltd — Price List</h1>
  <p style="color:#666">Generated: ${new Date().toLocaleDateString('en-IN')} | Prices inclusive of GST</p>
  ${Object.entries(byCategory).map(([cat,prods])=>`
    <h2>${cat}</h2>
    <table><tr><th>Product</th><th>Brand</th><th>Price</th><th>Unit</th></tr>
    ${prods.map(p=>`<tr><td>${p.name}</td><td>${p.brand||'—'}</td><td>₹${(p.price||0).toLocaleString('en-IN')}</td><td>${p.unit||'—'}</td></tr>`).join('')}
    </table>`).join('')}
  </body></html>`);
  win.document.close();
}

// ===== 8. END-OF-DAY RECONCILIATION =====
async function renderEODPage() {
  const today = new Date().toISOString().split('T')[0];
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);
  const todayInvoices = invoices.filter(i => (i.date||'').startsWith(today) && i.paymentVerified !== false);
  const systemTotals = { cash:0, upi:0, card:0, credit:0 };
  todayInvoices.forEach(inv => {
    if (inv.creditSale) { systemTotals.credit += inv.total||0; return; }
    const method = (inv.paymentMethod||'').toLowerCase();
    if (method === 'cash') systemTotals.cash += inv.amountReceived||0;
    else if (['upi','qr scan'].includes(method)) systemTotals.upi += inv.amountReceived||0;
    else if (['card','credit card','debit card'].includes(method)) systemTotals.card += inv.amountReceived||0;
  });
  const existing = (await VW_DB.all(VW_DB.STORES.eodReconciliations)).find(e => e.date === today);
  return `
  <div class="module-header"><h2>End of Day Reconciliation</h2></div>
  <div class="card">
    <h3 class="card-title">Today — ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</h3>
    <p style="font-size:13px;font-weight:600;margin-bottom:12px">System Totals (from invoices)</p>
    <div class="snapshot-grid">
      <div class="snap-item"><div class="snap-val">₹${Math.round(systemTotals.cash).toLocaleString('en-IN')}</div><div class="snap-label">Cash</div></div>
      <div class="snap-item"><div class="snap-val">₹${Math.round(systemTotals.upi).toLocaleString('en-IN')}</div><div class="snap-label">UPI/QR</div></div>
      <div class="snap-item"><div class="snap-val">₹${Math.round(systemTotals.card).toLocaleString('en-IN')}</div><div class="snap-label">Card</div></div>
      <div class="snap-item"><div class="snap-val">₹${Math.round(systemTotals.credit).toLocaleString('en-IN')}</div><div class="snap-label">Credit</div></div>
    </div>
    ${existing ? `
      <p style="color:#22c55e;font-size:13px;margin-top:12px">✓ Reconciled by ${existing.reconciledByName} — Cash difference: ₹${existing.differenceCash||0}</p>
    ` : `
      <h4 style="margin:16px 0 8px;font-size:13px">Actual Cash Count</h4>
      <div class="form-group"><label>Actual Cash in Drawer (₹)</label><input type="number" id="eod-actual-cash" placeholder="Count physical cash" oninput="VW_FEATURES.updateEODDiff(${systemTotals.cash})"></div>
      <div id="eod-cash-diff" style="font-size:13px;margin-bottom:8px"></div>
      <div class="form-group"><label>Actual UPI/QR (₹)</label><input type="number" id="eod-actual-upi" value="${Math.round(systemTotals.upi)}"></div>
      <div class="form-group"><label>Actual Card (₹)</label><input type="number" id="eod-actual-card" value="${Math.round(systemTotals.card)}"></div>
      <div class="form-group"><label>Notes / Discrepancy Reason</label><input type="text" id="eod-notes" placeholder="e.g. ₹50 shortage — petty cash used for chai"></div>
      <button class="btn-primary full-width" onclick="VW_FEATURES.submitEOD('${today}',${systemTotals.cash},${systemTotals.upi},${systemTotals.card},${systemTotals.credit})">✓ Submit Reconciliation</button>
    `}
  </div>`;
}

function updateEODDiff(systemCash) {
  const actual = parseFloat(document.getElementById('eod-actual-cash')?.value)||0;
  const diff = actual - systemCash;
  const el = document.getElementById('eod-cash-diff');
  if (el) el.innerHTML = `Difference: <strong style="color:${diff===0?'#22c55e':diff>0?'#378ADD':'var(--red)'}">${diff>=0?'+':''}₹${Math.abs(diff).toLocaleString('en-IN')}</strong>`;
}

async function submitEOD(date, sysCash, sysUpi, sysCard, sysCredit) {
  const actualCash = parseFloat(document.getElementById('eod-actual-cash')?.value)||0;
  const profile = VW_AUTH.getCurrentProfile();
  await VW_DB.put(VW_DB.STORES.eodReconciliations, {
    date, systemCash: Math.round(sysCash), systemUpi: Math.round(sysUpi),
    systemCard: Math.round(sysCard), systemCreditOutstanding: Math.round(sysCredit),
    actualCash, actualUpi: parseFloat(document.getElementById('eod-actual-upi')?.value)||0,
    actualCard: parseFloat(document.getElementById('eod-actual-card')?.value)||0,
    differenceCash: Math.round(actualCash - sysCash),
    notes: document.getElementById('eod-notes')?.value||'',
    reconciledByName: profile?.name||'',
    status: Math.abs(actualCash-sysCash) > 100 ? 'flagged' : 'reconciled',
    createdAt: new Date().toISOString()
  });
  showToast('End of day reconciliation saved', 'success');
  navigateTo('eod');
}

// ===== 9. POST-INVOICE WHATSAPP FEEDBACK =====
// Legacy single-call version — now routes through the unified function
async function sendPostInvoiceFeedback(invoice) {
  await sendPostInvoiceFeedbackWithPhoto(invoice, invoice.closurePhoto || null);
}

// ===== 10. QUOTATION EXPIRY =====
function renderQuotationExpiryBadge(q) {
  if (!q.expiryDate) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const expiry = new Date(q.expiryDate);
  const daysLeft = Math.round((expiry-today)/(1000*60*60*24));
  if (daysLeft < 0) return `<span class="badge" style="background:var(--red)">Expired ${Math.abs(daysLeft)}d ago</span>`;
  if (daysLeft <= 3) return `<span class="badge" style="background:var(--gold)">Expires in ${daysLeft}d</span>`;
  return `<span class="badge" style="background:#555">Valid ${daysLeft}d left</span>`;
}

// ===== 11. CONTRACTOR CLUB REFERRAL LEDGER =====
async function renderReferralLedger() {
  const ledger = await VW_DB.all(VW_DB.STORES.referralLedger);
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const custById = {}; customers.forEach(c => custById[c.id]=c);
  const pending = ledger.filter(r => r.status==='pending');
  const paid = ledger.filter(r => r.status==='paid').slice(-10).reverse();
  return `
  <div class="module-header"><h2>Contractor Club — Referral Ledger</h2></div>
  <div class="card">
    <h3 class="card-title">Pending Payouts <span class="badge">${pending.length}</span></h3>
    ${!pending.length ? '<p class="empty-msg">No pending referral payouts</p>' : pending.map(r => `
      <div class="task-card" style="margin-bottom:8px">
        <div class="task-card-header">
          <span class="task-dept">${custById[r.referringCustomerId]?.name||'Unknown'}</span>
          <span style="font-weight:700;color:var(--gold)">₹${(r.bonusAmount||0).toLocaleString('en-IN')}</span>
        </div>
        <p style="font-size:12px;color:var(--text3)">Referred: ${custById[r.referredCustomerId]?.name||'—'} · Invoice ${r.invoiceNo||'—'} · ₹${(r.invoiceTotal||0).toLocaleString('en-IN')}</p>
        ${VW_AUTH.isAdmin() ? `<button class="btn-sm" style="margin-top:6px" onclick="VW_FEATURES.markReferralPaid(${r.id})">✓ Mark Paid</button>` : ''}
      </div>`).join('')}
  </div>
  <div class="card">
    <h3 class="card-title">Recent Payouts</h3>
    ${!paid.length ? '<p class="empty-msg">None yet</p>' : paid.map(r=>`
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
        <span style="font-size:13px">${custById[r.referringCustomerId]?.name||'—'}</span>
        <span style="font-size:13px;color:#22c55e">₹${(r.bonusAmount||0).toLocaleString('en-IN')} paid</span>
      </div>`).join('')}
  </div>`;
}

async function markReferralPaid(id) {
  const r = await VW_DB.getById(VW_DB.STORES.referralLedger, id);
  if (!r) return;
  const profile = VW_AUTH.getCurrentProfile();
  r.status = 'paid';
  r.paidAt = new Date().toISOString();
  r.paidByName = profile?.name||'';
  await VW_DB.put(VW_DB.STORES.referralLedger, r);
  showToast('Referral payout marked as paid', 'success');
  navigateTo('club');
}

// ===== 12. TRAINING COMPLETION TRACKING =====
async function markTrainingComplete(materialId) {
  const profile = VW_AUTH.getCurrentProfile();
  if (!profile) return;
  try {
    await VW_DB.put(VW_DB.STORES.trainingCompletions, {
      staffProfileId: profile.id, materialId,
      completedAt: new Date().toISOString()
    });
    showToast('Marked as complete ✓', 'success');
  } catch(e) {
    // unique constraint means already completed — that's fine
    showToast('Already completed', 'info');
  }
}

async function getTrainingCompletions(profileId) {
  const all = await VW_DB.all(VW_DB.STORES.trainingCompletions);
  return new Set(all.filter(c => c.staffProfileId === profileId).map(c => c.materialId));
}

// ===== 13. INCENTIVE TRACKING =====
async function renderIncentivesPage() {
  const profile = VW_AUTH.getCurrentProfile();
  const isAdmin = VW_AUTH.isAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const qtrStart = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
  const yearStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)
    : new Date(now.getFullYear()-1, 3, 1);

  const [invoices, incentiveRules, feedbacks, reviews, staff] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.incentiveRules),
    VW_DB.all(VW_DB.STORES.feedback),
    VW_DB.getSetting('peer_reviews', {}),
    VW_DB.all(VW_DB.STORES.staff),
  ]);

  const approvedInv = invoices.filter(i => i.approvalStatus === 'approved');

  // Build per-person stats for month, quarter, year
  function buildStats(filteredInv) {
    const byPerson = {};
    filteredInv.forEach(inv => {
      const key = inv.salesExecutiveId || inv.createdByProfileId || inv.salesExecutiveName || 'unknown';
      const name = inv.salesExecutiveName || inv.createdByName || 'Unknown';
      if (!byPerson[key]) byPerson[key] = { name, total: 0, invoices: 0, closures: 0, avgFeedback: 0, feedbackCount: 0 };
      byPerson[key].total += inv.total || 0;
      byPerson[key].invoices++;
      if (inv.closurePhoto) byPerson[key].closures++;
      const fb = feedbacks.find(f => f.customerId === inv.customerId);
      if (fb?.rating) { byPerson[key].avgFeedback = ((byPerson[key].avgFeedback * byPerson[key].feedbackCount) + fb.rating) / (byPerson[key].feedbackCount + 1); byPerson[key].feedbackCount++; }
    });
    return byPerson;
  }

  const monthStats = buildStats(approvedInv.filter(i => new Date(i.date) >= monthStart));
  const qtrStats = buildStats(approvedInv.filter(i => new Date(i.date) >= qtrStart));
  const yearStats = buildStats(approvedInv.filter(i => new Date(i.date) >= yearStart));

  // Multi-slab incentive calc
  const defaultSlabs = [
    { minAmount: 0,       maxAmount: 500000,  pct: 0.25 },
    { minAmount: 500000,  maxAmount: 1000000, pct: 0.45 },
    { minAmount: 1000000, maxAmount: 2000000, pct: 0.60 },
    { minAmount: 2000000, maxAmount: null,    pct: 0.75 },
  ];
  const slabs = incentiveRules.length ? incentiveRules : defaultSlabs;

  function calcIncentive(total) {
    let incentive = 0;
    let remaining = total;
    for (const slab of slabs.sort((a,b)=>a.minAmount-b.minAmount)) {
      if (remaining <= 0) break;
      const slabMin = slab.minAmount || 0;
      const slabMax = slab.maxAmount || Infinity;
      if (total <= slabMin) continue;
      const slabTop = Math.min(total, slabMax);
      const inSlab = slabTop - slabMin;
      incentive += inSlab * (slab.pct / 100);
    }
    return Math.round(incentive);
  }

  // Best performer for month
  const monthPeople = Object.entries(monthStats).sort((a,b)=>b[1].total-a[1].total);
  const bestMonth = monthPeople[0];

  return `
  <div class="module-header"><h2>Incentives & Performance</h2>
    ${isAdmin ? `<button class="btn-sm" onclick="VW_FEATURES.showIncentiveSlabEditor()">⚙ Configure Slabs</button>` : ''}
  </div>

  <div class="entry-type-grid" style="margin-bottom:12px">
    <button class="entry-type-btn active" id="inc-tab-month" onclick="VW_FEATURES.switchIncentiveTab2('month',this)"><span class="et-icon">📅</span>Monthly</button>
    <button class="entry-type-btn" id="inc-tab-quarter" onclick="VW_FEATURES.switchIncentiveTab2('quarter',this)"><span class="et-icon">📊</span>Quarterly</button>
    <button class="entry-type-btn" id="inc-tab-annual" onclick="VW_FEATURES.switchIncentiveTab2('annual',this)"><span class="et-icon">🏆</span>Annual</button>
    <button class="entry-type-btn" id="inc-tab-review" onclick="VW_FEATURES.switchIncentiveTab2('review',this)"><span class="et-icon">⭐</span>Peer Review</button>
  </div>

  <div id="incentive-tab2-content">
    ${renderMonthlyIncentives(monthPeople, slabs, calcIncentive, bestMonth, now)}
  </div>`;
}

function renderMonthlyIncentives(monthPeople, slabs, calcIncentive, bestMonth, now) {
  const monthName = now.toLocaleDateString('en-IN', {month:'long',year:'numeric'});
  if (!monthPeople.length) return '<div class="card"><p class="empty-msg">No approved invoices this month yet</p></div>';

  return `
  ${bestMonth ? `
  <div style="background:linear-gradient(135deg,rgba(245,200,66,0.2),rgba(245,200,66,0.05));border:1px solid var(--gold-border);border-radius:16px;padding:16px;margin-bottom:14px;text-align:center">
    <div style="font-size:24px;margin-bottom:6px">🏆</div>
    <div style="font-size:11px;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Best Performer — ${monthName}</div>
    <div style="font-size:20px;font-weight:700;color:#fff">${bestMonth[1].name}</div>
    <div style="font-size:14px;color:var(--gold);font-weight:600">₹${Math.round(bestMonth[1].total/1000)}K billed · ₹${calcIncentive(bestMonth[1].total).toLocaleString('en-IN')} incentive</div>
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">Monthly Incentive Payouts — ${monthName}</h3>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Slab-based: ${slabs.map(s=>`${s.pct}% above ₹${Math.round(s.minAmount/1000)}K`).join(' · ')}</div>
    ${monthPeople.map(([key, p], i) => {
      const inc = calcIncentive(p.total);
      const topSlab = slabs.filter(s => p.total > s.minAmount).sort((a,b)=>b.minAmount-a.minAmount)[0];
      const nextSlab = slabs.find(s => s.minAmount > p.total);
      const toNext = nextSlab ? nextSlab.minAmount - p.total : 0;
      return `
      <div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:22px;height:22px;border-radius:50%;background:${i===0?'var(--gold)':i===1?'rgba(192,192,192,0.3)':i===2?'rgba(200,100,30,0.3)':'var(--bg3)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${i<3?'#000':'var(--text3)'}">${i+1}</div>
              <div style="font-size:14px;font-weight:600">${p.name}</div>
            </div>
            <div style="font-size:12px;color:var(--text2);margin-top:4px">${p.invoices} invoice${p.invoices!==1?'s':''} · ${p.closures} closures${p.feedbackCount?` · ★ ${p.avgFeedback.toFixed(1)}`:''}</div>
            ${toNext>0?`<div style="font-size:11px;color:var(--text3);margin-top:2px">₹${Math.round(toNext/1000)}K more to reach ${(topSlab?.pct||0)+0.2}% slab</div>`:''}
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:700;color:var(--gold)">₹${Math.round(p.total/1000)}K</div>
            <div style="font-size:13px;color:#22c55e;font-weight:600">+ ₹${inc.toLocaleString('en-IN')}</div>
            <div style="font-size:10px;color:var(--text3)">${topSlab?.pct||0}% slab</div>
          </div>
        </div>
        <div style="margin-top:8px;background:var(--bg3);border-radius:4px;height:6px;overflow:hidden">
          <div style="height:6px;background:var(--gold);border-radius:4px;width:${Math.min(100,Math.round(p.total/50000))}%"></div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

async function switchIncentiveTab2(tab, btn) {
  document.querySelectorAll('[id^="inc-tab-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('incentive-tab2-content');
  if (!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const now = new Date();
  const qtrStart = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
  const yearStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear()-1, 3, 1);
  const [invoices, rules, feedbacks] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.incentiveRules),
    VW_DB.all(VW_DB.STORES.feedback),
  ]);
  const slabs = rules.length ? rules : [{minAmount:0,maxAmount:500000,pct:0.25},{minAmount:500000,maxAmount:1000000,pct:0.45},{minAmount:1000000,maxAmount:2000000,pct:0.60},{minAmount:2000000,maxAmount:null,pct:0.75}];
  function calcInc(total) { let inc=0; for(const s of slabs.sort((a,b)=>a.minAmount-b.minAmount)){if(total<=s.minAmount)continue;const top=Math.min(total,s.maxAmount||Infinity);inc+=(top-s.minAmount)*(s.pct/100);} return Math.round(inc); }
  function buildP(invs) { const b={}; invs.filter(i=>i.approvalStatus==='approved').forEach(i=>{const k=i.salesExecutiveId||i.salesExecutiveName||'?';const n=i.salesExecutiveName||i.createdByName||'?';if(!b[k])b[k]={name:n,total:0,invoices:0};b[k].total+=i.total||0;b[k].invoices++;});return Object.entries(b).sort((a,z)=>z[1].total-a[1].total);}

  if (tab === 'month') {
    const ms = new Date(now.getFullYear(), now.getMonth(), 1);
    const people = buildP(invoices.filter(i=>new Date(i.date)>=ms));
    container.innerHTML = renderMonthlyIncentives(people, slabs, calcInc, people[0], now);
  } else if (tab === 'quarter') {
    const people = buildP(invoices.filter(i=>new Date(i.date)>=qtrStart));
    const qLabel = `Q${Math.floor(now.getMonth()/3)+1} ${now.getFullYear()}`;
    container.innerHTML = `<div class="card"><h3 class="card-title">Quarterly Performance — ${qLabel}</h3>
      ${people.map(([k,p],i)=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div><div style="font-weight:600">${i+1}. ${p.name}</div><div style="font-size:12px;color:var(--text2)">${p.invoices} invoices</div></div>
        <div style="text-align:right"><div style="font-size:15px;font-weight:700;color:var(--gold)">₹${Math.round(p.total/1000)}K</div><div style="font-size:12px;color:#22c55e">+₹${calcInc(p.total).toLocaleString('en-IN')}</div></div>
      </div>`).join('') || '<p class="empty-msg">No data this quarter</p>'}
    </div>`;
  } else if (tab === 'annual') {
    const people = buildP(invoices.filter(i=>new Date(i.date)>=yearStart));
    const fyLabel = `FY ${yearStart.getFullYear()}-${String(yearStart.getFullYear()+1).slice(-2)}`;
    container.innerHTML = `<div class="card"><h3 class="card-title">Annual Performance — ${fyLabel}</h3>
      ${people.map(([k,p],i)=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div><div style="font-weight:600">${i+1}. ${p.name}</div><div style="font-size:12px;color:var(--text2)">${p.invoices} invoices this FY</div></div>
        <div style="text-align:right"><div style="font-size:15px;font-weight:700;color:var(--gold)">₹${(p.total/100000).toFixed(1)}L</div><div style="font-size:12px;color:#22c55e">+₹${calcInc(p.total).toLocaleString('en-IN')}</div></div>
      </div>`).join('') || '<p class="empty-msg">No data this FY</p>'}
    </div>`;
  } else if (tab === 'review') {
    container.innerHTML = await renderPeerReview();
  }
}

async function renderPeerReview() {
  const [staff, reviews] = await Promise.all([
    VW_DB.all(VW_DB.STORES.staff),
    VW_DB.getSetting('peer_reviews', {})
  ]);
  const profile = VW_AUTH.getCurrentProfile();
  const active = staff.filter(s => s.active !== false && s.name !== profile?.name);
  const myReviews = reviews[profile?.name] || {};

  return `<div class="card">
    <h3 class="card-title">⭐ Peer Review</h3>
    <p style="font-size:12px;color:var(--text2);margin-bottom:12px">Rate your colleagues on teamwork, attitude, and customer handling. Used for Best Employee selection.</p>
    ${active.map(s => {
      const existing = myReviews[s.name] || {};
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">${s.name} <span style="color:var(--text3);font-size:11px">${s.designation||''}</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
          <div><label style="color:var(--text2);font-size:11px">Teamwork</label>
            <div style="display:flex;gap:4px;margin-top:2px">
              ${[1,2,3,4,5].map(n=>`<button onclick="VW_FEATURES.setReview('${s.name}','teamwork',${n},this)" style="background:${(existing.teamwork||0)>=n?'var(--gold)':'var(--bg3)'};border:none;border-radius:4px;padding:3px 6px;cursor:pointer;color:${(existing.teamwork||0)>=n?'#000':'var(--text3)'};font-size:12px">★</button>`).join('')}
            </div>
          </div>
          <div><label style="color:var(--text2);font-size:11px">Attitude</label>
            <div style="display:flex;gap:4px;margin-top:2px">
              ${[1,2,3,4,5].map(n=>`<button onclick="VW_FEATURES.setReview('${s.name}','attitude',${n},this)" style="background:${(existing.attitude||0)>=n?'var(--gold)':'var(--bg3)'};border:none;border-radius:4px;padding:3px 6px;cursor:pointer;color:${(existing.attitude||0)>=n?'#000':'var(--text3)'};font-size:12px">★</button>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}
    <button class="btn-primary full-width" style="margin-top:12px" onclick="VW_FEATURES.submitPeerReviews()">Submit Reviews</button>
  </div>`;
}

let _pendingReviews = {};
function setReview(personName, category, value, btn) {
  if (!_pendingReviews[personName]) _pendingReviews[personName] = {};
  _pendingReviews[personName][category] = value;
  // Update button visual
  const row = btn.parentElement;
  row.querySelectorAll('button').forEach((b,i) => {
    const n = i + 1;
    b.style.background = n <= value ? 'var(--gold)' : 'var(--bg3)';
    b.style.color = n <= value ? '#000' : 'var(--text3)';
  });
}

async function submitPeerReviews() {
  const profile = VW_AUTH.getCurrentProfile();
  const existing = await VW_DB.getSetting('peer_reviews', {});
  existing[profile?.name||'?'] = { ...(existing[profile?.name||'?']||{}), ..._pendingReviews, submittedAt: new Date().toISOString() };
  await VW_DB.setSetting('peer_reviews', existing);
  _pendingReviews = {};
  showToast('Peer reviews submitted! 🙏', 'success');
}

async function showIncentiveSlabEditor() {
  const rules = await VW_DB.all(VW_DB.STORES.incentiveRules);
  const slabs = rules.length ? rules : [
    {minAmount:0, maxAmount:500000, pct:0.25},
    {minAmount:500000, maxAmount:1000000, pct:0.45},
    {minAmount:1000000, maxAmount:2000000, pct:0.60},
    {minAmount:2000000, maxAmount:null, pct:0.75},
  ];
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>⚙️ Incentive Slabs</h3>
    <p class="sheet-meta">Set billing targets and incentive % for each tier</p>
    <div id="slab-list">
      ${slabs.map((s,i) => `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 32px;gap:6px;margin-bottom:8px;align-items:center">
        <div class="form-group" style="margin:0"><label style="font-size:10px">From ₹</label><input type="number" value="${s.minAmount||0}" id="slab-min-${i}" style="font-size:13px"></div>
        <div class="form-group" style="margin:0"><label style="font-size:10px">To ₹</label><input type="number" value="${s.maxAmount||''}" id="slab-max-${i}" placeholder="No limit" style="font-size:13px"></div>
        <div class="form-group" style="margin:0"><label style="font-size:10px">% Incentive</label><input type="number" value="${s.pct||0}" id="slab-pct-${i}" step="0.01" style="font-size:13px"></div>
        <button onclick="this.closest('div').remove()" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding-top:16px">×</button>
      </div>`).join('')}
    </div>
    <button class="btn-secondary full-width" style="margin-bottom:10px" onclick="VW_FEATURES.addSlabRow()">+ Add Tier</button>
    <button class="btn-primary full-width" onclick="VW_FEATURES.saveSlabs()">Save Slabs</button>
    <button class="btn-secondary full-width" style="margin-top:8px" onclick="closeSheet()">Cancel</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function addSlabRow() {
  const list = document.getElementById('slab-list');
  if (!list) return;
  const i = list.children.length;
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr 32px;gap:6px;margin-bottom:8px;align-items:center';
  div.innerHTML = `
    <div class="form-group" style="margin:0"><label style="font-size:10px">From ₹</label><input type="number" value="0" id="slab-min-${i}" style="font-size:13px"></div>
    <div class="form-group" style="margin:0"><label style="font-size:10px">To ₹</label><input type="number" id="slab-max-${i}" placeholder="No limit" style="font-size:13px"></div>
    <div class="form-group" style="margin:0"><label style="font-size:10px">%</label><input type="number" value="0" id="slab-pct-${i}" step="0.01" style="font-size:13px"></div>
    <button onclick="this.closest('div').remove()" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding-top:16px">×</button>`;
  list.appendChild(div);
}

async function saveSlabs() {
  const list = document.getElementById('slab-list');
  if (!list) return;
  const rows = list.querySelectorAll('div[style]');
  const newSlabs = [];
  rows.forEach((row, i) => {
    const min = parseFloat(row.querySelector(`[id^="slab-min"]`)?.value)||0;
    const maxEl = row.querySelector(`[id^="slab-max"]`)?.value;
    const max = maxEl ? parseFloat(maxEl) : null;
    const pct = parseFloat(row.querySelector(`[id^="slab-pct"]`)?.value)||0;
    newSlabs.push({ minAmount: min, maxAmount: max, pct });
  });
  // Save to incentiveRules store
  const existing = await VW_DB.all(VW_DB.STORES.incentiveRules);
  for (const r of existing) await VW_DB.client.from('incentive_rules').delete().eq('id', r.id);
  for (const s of newSlabs) await VW_DB.put(VW_DB.STORES.incentiveRules, s);
  showToast('Incentive slabs saved', 'success');
  closeSheet();
}

function renderPayoutCalculator(peopleEntries, rules, monthInvoices) {
  if (!peopleEntries.length) return '<div class="card"><p class="empty-msg">No approved invoices this month yet</p></div>';
  return `<div class="card">
    <h3 class="card-title">This Month — ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3>
    ${peopleEntries.map(([key, person]) => {
      const rule = rules.find(r => (r.role === person.role || r.role === 'executive') && r.active);
      const target = rule?.monthlyTarget || 0;
      const pct = target ? Math.min(100, Math.round(person.total/target*100)) : 0;
      const earned = rule ? person.total * (rule.basePct||0)/100 : 0;
      const bonus = rule ? (rule.bonusTiers||[]).filter(t => person.total >= target*(t.abovePct/100))
        .reduce((s,t) => s + person.total*(t.bonusPct/100), 0) : 0;
      return `
      <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border2)">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:600">${person.name}</span>
          <span style="font-size:12px;color:var(--text3)">${person.invoices} invoice${person.invoices!==1?'s':''}</span>
        </div>
        ${target ? `
        <div style="background:var(--bg2);border-radius:4px;height:8px;margin-bottom:6px">
          <div style="background:var(--gold);border-radius:4px;height:8px;width:${pct}%"></div>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="font-weight:600">₹${Math.round(person.total).toLocaleString('en-IN')} sold</span>
          ${target ? `<span style="color:var(--text3)">Target: ₹${target.toLocaleString('en-IN')} (${pct}%)</span>` : ''}
        </div>
        ${rule ? `<div style="font-size:14px;color:var(--gold);font-weight:700">
          Est. Payout: ₹${Math.round(earned+bonus).toLocaleString('en-IN')}
          <span style="font-size:11px;font-weight:400;color:var(--text3)"> (base ₹${Math.round(earned).toLocaleString('en-IN')}${bonus?` + ₹${Math.round(bonus).toLocaleString('en-IN')} bonus`:''})</span>
        </div>` : '<div style="font-size:12px;color:var(--text3)">No incentive rule set for this role</div>'}
      </div>`;
    }).join('')}
  </div>`;
}

function renderQualityScorecard(peopleEntries) {
  if (!peopleEntries.length) return '<div class="card"><p class="empty-msg">No approved invoices this month yet</p></div>';
  return `<div class="card">
    <h3 class="card-title">Quality Scorecard — ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:12px">Closure photo + customer rating ≥ 4★ = Fully Satisfied</p>
    ${peopleEntries.map(([key, person]) => {
      const closurePct = person.invoices ? Math.round(person.closures/person.invoices*100) : 0;
      const satPct = person.invoices ? Math.round(person.satisfied/person.invoices*100) : 0;
      return `
      <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border2)">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-weight:600">${person.name}</span>
          <span style="font-size:12px;color:var(--text3)">${person.invoices} invoices</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <div style="flex:1;min-width:80px;padding:8px;background:var(--bg2);border-radius:8px;text-align:center">
            <div style="font-size:18px;font-weight:700;color:${closurePct>=80?'#22c55e':closurePct>=50?'var(--gold)':'var(--red)'}">${closurePct}%</div>
            <div style="font-size:11px;color:var(--text3)">📸 Photos<br>${person.closures}/${person.invoices}</div>
          </div>
          <div style="flex:1;min-width:80px;padding:8px;background:var(--bg2);border-radius:8px;text-align:center">
            <div style="font-size:18px;font-weight:700;color:${satPct>=80?'#22c55e':satPct>=50?'var(--gold)':'var(--red)'}">${satPct}%</div>
            <div style="font-size:11px;color:var(--text3)">⭐ Satisfied<br>${person.satisfied}/${person.invoices}</div>
          </div>
          <div style="flex:1;min-width:80px;padding:8px;background:var(--bg2);border-radius:8px;text-align:center">
            <div style="font-size:18px;font-weight:700;color:var(--gold)">₹${Math.round(person.total/Math.max(person.invoices,1)/1000)}K</div>
            <div style="font-size:11px;color:var(--text3)">Avg Bill</div>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

async function switchIncentiveTab(tab, btn) {
  document.querySelectorAll('.entry-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const container = document.getElementById('incentive-tab-content');
  if (!container) return;
  const [invoices, rules, feedbacks] = await Promise.all([
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.incentiveRules),
    VW_DB.all(VW_DB.STORES.feedback)
  ]);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthInvoices = invoices.filter(i => new Date(i.date) >= monthStart && i.approvalStatus === 'approved');
  const byPerson = {};
  const addPerson = (key, name, role) => { if (!byPerson[key]) byPerson[key] = { name, role, total:0, invoices:0, closures:0, satisfied:0 }; };
  monthInvoices.forEach(inv => {
    const fb = feedbacks.find(f => f.invoiceId === inv.id || f.customerId === inv.customerId);
    const fullySatisfied = inv.closurePhoto && fb && fb.rating >= 4;
    const key = inv.salesExecutiveId || inv.createdByProfileId || 'unknown';
    addPerson(key, inv.salesExecutiveName || inv.createdByName || 'Unknown', 'executive');
    byPerson[key].total += inv.total||0;
    byPerson[key].invoices++;
    if (inv.closurePhoto) byPerson[key].closures++;
    if (fullySatisfied) byPerson[key].satisfied++;
  });
  const entries = Object.entries(byPerson);
  container.innerHTML = tab === 'payout'
    ? renderPayoutCalculator(entries, rules, monthInvoices)
    : renderQualityScorecard(entries);
}

async function showIncentiveRules() {
  const rules = await VW_DB.all(VW_DB.STORES.incentiveRules);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Incentive Rules</h3>
    ${rules.map(r => `
      <div class="req-item-card" style="margin-bottom:8px">
        <div style="font-weight:600">${r.role} — ${r.active?'Active':'Inactive'}</div>
        <div style="font-size:12px;color:var(--text3)">Target: ₹${(r.monthlyTarget||0).toLocaleString('en-IN')} · Base: ${r.basePct||0}%</div>
        ${(r.bonusTiers||[]).map(t=>`<div style="font-size:12px;color:var(--gold)">Above ${t.abovePct}% of target → +${t.bonusPct}% bonus</div>`).join('')}
      </div>`).join('')}
    <h4 style="margin:12px 0 8px;font-size:13px">Add / Update Rule</h4>
    <div class="form-group"><label>Role</label>
      <select id="irule-role"><option value="executive">Store Executive</option><option value="TL">Team Lead</option><option value="staff">Staff Specialist</option></select>
    </div>
    <div class="form-group"><label>Monthly Target (₹)</label><input type="number" id="irule-target" placeholder="e.g. 500000"></div>
    <div class="form-group"><label>Base Incentive % of sales</label><input type="number" id="irule-base" placeholder="e.g. 0.5" step="0.1"></div>
    <button class="btn-primary full-width" onclick="VW_FEATURES.saveIncentiveRule()">Save Rule</button>
  `;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveIncentiveRule() {
  const role = document.getElementById('irule-role')?.value;
  const target = parseFloat(document.getElementById('irule-target')?.value)||0;
  const basePct = parseFloat(document.getElementById('irule-base')?.value)||0;
  const rules = await VW_DB.all(VW_DB.STORES.incentiveRules);
  const existing = rules.find(r => r.role === role);
  if (existing) {
    existing.monthlyTarget = target; existing.basePct = basePct; existing.active = true;
    await VW_DB.put(VW_DB.STORES.incentiveRules, existing);
  } else {
    await VW_DB.put(VW_DB.STORES.incentiveRules, { role, monthlyTarget: target, basePct, bonusTiers: [], active: true, createdAt: new Date().toISOString() });
  }
  showToast('Incentive rule saved', 'success');
  closeSheet();
}

// ===== 14. DATA EXPORT =====
async function exportAllData() {
  showToast('Preparing export...', 'info');
  const [customers, invoices, quotations, products, staff] = await Promise.all([
    VW_DB.all(VW_DB.STORES.customers),
    VW_DB.all(VW_DB.STORES.invoices),
    VW_DB.all(VW_DB.STORES.quotations),
    VW_DB.all(VW_DB.STORES.products),
    VW_DB.all(VW_DB.STORES.staff)
  ]);
  const wb = XLSX.utils.book_new();

  const custRows = customers.map(c => ({ Name:c.name, Phone:c.phone, Type:c.type, LoyaltyPoints:c.loyaltyPoints||0, Channel:c.preferredChannel||'', City:c.city||'' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custRows), 'Customers');

  const invRows = invoices.map(i => ({ InvoiceNo:i.invoiceNo, Date:i.date?.split('T')[0]||'', Total:i.total||0, PaymentMethod:i.paymentMethod||'', Status:i.status||'', ApprovalStatus:i.approvalStatus||'' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), 'Invoices');

  const prodRows = products.map(p => ({ Name:p.name, Brand:p.brand||'', Model:p.model||'', Category:p.category||'', Price:p.price||0, Stock:p.stock||0, Unit:p.unit||'', Barcode:p.barcode||'' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodRows), 'Products');

  const staffRows = staff.map(s => ({ Name:s.name, Phone:s.phone||'', Department:s.department||'', Team:s.team||'', Role:s.role||'' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffRows), 'Staff');

  XLSX.writeFile(wb, `VWholesale-Export-${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Export downloaded', 'success');
}

// ===== 15. CUSTOMER DATA DEDUPLICATION =====
async function renderDedupTool() {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  // Find potential duplicates by phone similarity
  const byPhone = {}; const dupes = [];
  customers.forEach(c => {
    const phone = (c.phone||'').replace(/\D/g,'').slice(-10);
    if (!phone) return;
    byPhone[phone] = byPhone[phone]||[];
    byPhone[phone].push(c);
  });
  Object.values(byPhone).forEach(group => { if (group.length > 1) dupes.push(group); });

  return `
  <div class="module-header"><h2>Customer Deduplication</h2></div>
  <div class="card">
    <p style="font-size:13px;color:var(--text3);margin-bottom:12px">Customers with the same phone number — review and merge if they're the same person.</p>
    ${!dupes.length ? '<p class="empty-msg">No duplicate phone numbers found 🎉</p>' : dupes.map(group => `
      <div class="req-item-card" style="margin-bottom:12px">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--gold)">⚠️ Same phone: ${(group[0].phone||'').replace(/\D/g,'').slice(-10)}</div>
        ${group.map(c => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border2)">
            <div>
              <div style="font-size:13px;font-weight:600">${c.name}</div>
              <div style="font-size:12px;color:var(--text3)">${c.type||''} · ${c.loyaltyPoints||0} points</div>
            </div>
            ${VW_AUTH.isAdmin() ? `<button class="btn-sm" style="color:var(--red)" onclick="VW_FEATURES.deleteCustomer(${c.id})">Delete</button>` : ''}
          </div>`).join('')}
        ${VW_AUTH.isAdmin() ? `<button class="btn-sm" style="margin-top:8px" onclick="VW_FEATURES.mergeCustomers(${group.map(c=>c.id).join(',')})">🔀 Keep first, merge data</button>` : ''}
      </div>`).join('')}
  </div>`;
}

async function mergeCustomers(...ids) {
  const customers = await Promise.all(ids.map(id => VW_DB.getById(VW_DB.STORES.customers, id)));
  const [primary, ...duplicates] = customers.filter(Boolean);
  primary.loyaltyPoints = customers.reduce((s,c)=>s+(c.loyaltyPoints||0),0);
  await VW_DB.put(VW_DB.STORES.customers, primary);
  for (const dup of duplicates) {
    // Reassign invoices and quotations to primary
    const invoices = await VW_DB.all(VW_DB.STORES.invoices);
    for (const inv of invoices.filter(i => i.customerId === dup.id)) {
      inv.customerId = primary.id; await VW_DB.put(VW_DB.STORES.invoices, inv);
    }
    await VW_DB.del(VW_DB.STORES.customers, dup.id);
  }
  showToast('Customers merged successfully', 'success');
  navigateTo('settings');
}

async function deleteCustomer(id) {
  await VW_DB.del(VW_DB.STORES.customers, id);
  showToast('Customer deleted', 'info');
  navigateTo('settings');
}

// ===== 16. LOW STOCK & BIRTHDAY WHATSAPP ALERTS =====
async function checkAndSendLowStockAlerts() {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const lowStock = products.filter(p => (p.stock||0) <= (p.lowStockThreshold||20));
  if (!lowStock.length) return;
  const settings = await VW_DB.getById(VW_DB.STORES.settings, 'whatsapp_config');
  const purchaseMgrPhone = settings?.value?.purchaseManagerPhone;
  if (!purchaseMgrPhone) return;
  const msg = encodeURIComponent(
    `*V Wholesale — Low Stock Alert* 📦\n\n` +
    lowStock.map(p=>`• ${p.name} (${p.brand||'—'}): ${p.stock} ${p.unit||''} remaining (threshold: ${p.lowStockThreshold||20})`).join('\n') +
    `\n\nPlease arrange restock. — V Wholesale Customer OS`
  );
  window.open(`https://wa.me/91${purchaseMgrPhone.replace(/\D/g,'')}?text=${msg}`, '_blank');
}

async function checkAndSendBirthdayMessages() {
  const today = new Date();
  const todayMD = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const birthdays = customers.filter(c => c.dob && c.dob.slice(5,10) === todayMD && c.phone);
  if (!birthdays.length) { showToast('No customer birthdays today', 'info'); return; }
  const settings = await VW_DB.getById(VW_DB.STORES.settings, 'whatsapp_config');
  const storeName = settings?.value?.storeName || 'V Wholesale';
  for (const c of birthdays) {
    const msg = encodeURIComponent(`🎂 Happy Birthday ${c.name}!\n\nWishing you a wonderful birthday from all of us at ${storeName}. Thank you for being a valued customer! 🎉\n\nVisit us for special birthday offers! 🏠`);
    window.open(`https://wa.me/91${c.phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
  }
  showToast(`Birthday messages sent to ${birthdays.length} customer(s)`, 'success');
}

// ===== EXPORT =====
window.VW_FEATURES = {
  // Order source
  showOrderSourcePicker, selectOrderSource,
  // Split payment
  addSplitRow, updateSplit, removeSplitRow, getSplitPayments,
  // Salesperson
  renderSalespersonPicker, saveSalespersonCredits,
  // Returns
  showSalesReturn, processReturn,
  // Loyalty
  earnLoyaltyPoints, showRedeemPoints, updateRedeemPreview, confirmRedeem, earnStaffPoints,
  // Promotions
  renderPromotionsPage, showAddPromotion, updatePromoTypeUI, savePromotion,
  openPromotion, togglePromotion, showSpinWheel, doSpin, voidSpinRedemption,
  editSpinGifts, saveSpinGifts,
  // Closure photo
  showClosurePhotoPrompt, previewClosurePhoto, saveClosurePhoto,
  sendPostInvoiceFeedbackWithPhoto, isFullySatisfiedClosure,
  // Catalogs
  renderCatalogsPage, showUploadCatalog, uploadCatalogFile, shareCatalog,
  switchCatalogTab, deleteCatalog, replaceCatalog, doReplaceCatalog, uploadCatalogAsPriceList,
  printLivePriceList,
  renderEODPage, updateEODDiff, submitEOD,
  // WhatsApp
  sendPostInvoiceFeedback, checkAndSendLowStockAlerts, checkAndSendBirthdayMessages,
  // Quotation
  renderQuotationExpiryBadge,
  // Referral
  renderReferralLedger, markReferralPaid,
  // Training
  markTrainingComplete, getTrainingCompletions,
  // Incentives
  renderIncentivesPage, showIncentiveRules, saveIncentiveRule, switchIncentiveTab,
  switchIncentiveTab2, renderPeerReview, setReview, submitPeerReviews,
  showIncentiveSlabEditor, addSlabRow, saveSlabs,
  renderPayoutCalculator, renderQualityScorecard,
  // Data tools
  exportAllData, renderDedupTool, mergeCustomers, deleteCustomer
};

// =====================================================
// CUSTOMER RETURNS MODULE
// =====================================================
async function renderReturnsPage() {
  const returns = await VW_DB.client.from('customer_returns').select('*').order('created_at', { ascending: false }).limit(50);
  const rList = returns.data || [];
  const pending = rList.filter(r => r.status === 'pending');
  const completed = rList.filter(r => r.status === 'completed');

  return `
  <div class="module-header">
    <h2>↩️ Customer Returns</h2>
    <button class="btn-sm" onclick="VW_FEATURES.newReturn()">+ New Return</button>
  </div>

  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card ${pending.length?'danger':''}">
      <div class="mc-label">Pending</div>
      <div class="mc-value">${pending.length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Completed</div>
      <div class="mc-value">${completed.length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Total Returns</div>
      <div class="mc-value">${rList.length}</div>
    </div>
    <div class="metric-card gold">
      <div class="mc-label">Return Value</div>
      <div class="mc-value">₹${Math.round(rList.reduce((s,r)=>s+(r.total_return_value||0),0)/1000)}K</div>
    </div>
  </div>

  ${pending.length ? `
  <div class="card" style="margin-bottom:10px;border-color:rgba(239,68,68,0.3)">
    <h3 class="card-title" style="color:var(--red)">⚠️ Pending Returns</h3>
    ${pending.map(r => renderReturnRow(r)).join('')}
  </div>` : ''}

  <div class="card">
    <h3 class="card-title">All Returns</h3>
    ${rList.length ? rList.map(r => renderReturnRow(r)).join('') : '<p class="empty-msg">No returns yet</p>'}
  </div>`;
}

function renderReturnRow(r) {
  const statusColors = { pending:'var(--gold)', approved:'var(--blue)', completed:'var(--green)', rejected:'var(--red)' };
  return `
  <div style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="VW_FEATURES.openReturn(${r.id})">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:13px;font-weight:600">${r.return_no||'#'+r.id} · ${r.customer_name||'Walk-in'}</div>
        <div style="font-size:11px;color:var(--text3)">${r.original_invoice_no||'No invoice'} · ${r.return_type} · ${new Date(r.created_at).toLocaleDateString('en-IN')}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${r.return_reason||''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:700">₹${Math.round(r.total_return_value||0).toLocaleString('en-IN')}</div>
        <span class="badge" style="color:${statusColors[r.status]||'var(--text3)'}">${r.status}</span>
      </div>
    </div>
  </div>`;
}

async function newReturn() {
  const sheet = document.getElementById('bottom-sheet');
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);
  const recentInv = invoices.filter(i => i.approvalStatus === 'approved').slice(-50).reverse();

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="margin:0">New Customer Return</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div class="form-group"><label>Customer Phone</label>
      <input type="tel" id="ret-phone" placeholder="10-digit mobile" maxlength="10" oninput="VW_FEATURES.lookupReturnCustomer(this.value)">
      <div id="ret-cust-status" style="font-size:12px;color:var(--text3);margin-top:4px"></div>
    </div>
    <div class="form-group"><label>Original Invoice</label>
      <select id="ret-invoice">
        <option value="">Select invoice (or leave blank)</option>
        ${recentInv.map(i => `<option value="${i.id}" data-total="${i.total}">${i.invoiceNo} — ₹${Math.round(i.total||0).toLocaleString('en-IN')} — ${i.customerName||'Walk-in'}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Return Type</label>
      <select id="ret-type">
        <option value="refund">Refund (Cash / UPI)</option>
        <option value="exchange">Exchange (swap product)</option>
        <option value="credit_note">Credit Note (use in future)</option>
        <option value="repair">Repair / Warranty</option>
      </select>
    </div>
    <div class="form-group"><label>Return Reason *</label>
      <select id="ret-reason">
        <option>Damaged / Defective product</option>
        <option>Wrong product delivered</option>
        <option>Customer changed mind</option>
        <option>Size mismatch</option>
        <option>Duplicate order</option>
        <option>Quality issue</option>
        <option>Warranty claim</option>
        <option>Other</option>
      </select>
    </div>
    <div class="form-group"><label>Return Value ₹</label>
      <input type="number" id="ret-value" placeholder="Amount to return" min="0">
    </div>
    <div class="form-group"><label>Refund Method</label>
      <select id="ret-refund-method">
        <option value="cash">Cash</option>
        <option value="upi">UPI / Online</option>
        <option value="credit_note">Credit Note</option>
        <option value="exchange">Exchange Only</option>
      </select>
    </div>
    <div class="form-group"><label>Notes</label>
      <textarea id="ret-notes" placeholder="Any additional notes..." style="height:60px"></textarea>
    </div>
    <button class="btn-primary full-width" onclick="VW_FEATURES.saveReturn()">Save Return Request</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function lookupReturnCustomer(phone) {
  const el = document.getElementById('ret-cust-status');
  if (!el || phone.length < 10) return;
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const match = customers.find(c => c.phone === phone);
  if (match) {
    el.innerHTML = `<span style="color:var(--green)">✓ ${match.name} — ${match.visitCount||0} visits</span>`;
    window._retCustomer = match;
  } else {
    el.innerHTML = `<span style="color:var(--text3)">No customer found with this number</span>`;
    window._retCustomer = null;
  }
}

async function saveReturn() {
  const invoiceId = document.getElementById('ret-invoice')?.value;
  const invoiceEl = document.getElementById('ret-invoice');
  const invoiceNo = invoiceEl?.options[invoiceEl?.selectedIndex]?.text?.split(' — ')[0] || '';
  const returnValue = parseFloat(document.getElementById('ret-value')?.value || 0);
  const reason = document.getElementById('ret-reason')?.value;
  const type = document.getElementById('ret-type')?.value;
  const method = document.getElementById('ret-refund-method')?.value;
  const notes = document.getElementById('ret-notes')?.value;
  const cust = window._retCustomer;

  if (!reason) { showToast('Select a return reason', 'warn'); return; }
  if (returnValue <= 0) { showToast('Enter return value', 'warn'); return; }

  const returns = await VW_DB.client.from('customer_returns').select('id').order('id', { ascending: false }).limit(1);
  const lastId = returns.data?.[0]?.id || 0;
  const returnNo = `RET/${getFinancialYearLabel()}/${String(lastId+1).padStart(4,'0')}`;

  const { data, error } = await VW_DB.client.from('customer_returns').insert({
    return_no: returnNo,
    original_invoice_id: invoiceId || null,
    original_invoice_no: invoiceNo,
    customer_id: cust?.id || null,
    customer_name: cust?.name || 'Walk-in',
    customer_phone: document.getElementById('ret-phone')?.value || '',
    return_reason: reason,
    return_type: type,
    total_return_value: returnValue,
    refund_method: method,
    refund_amount: returnValue,
    notes, status: 'pending',
    created_by_name: VW_AUTH.getCurrentProfile()?.name || '',
  }).select('id').single();

  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  closeSheet();
  showToast(`Return ${returnNo} created — pending approval`, 'success');
  navigateTo('returns');
}

async function openReturn(id) {
  const { data: r } = await VW_DB.client.from('customer_returns').select('*').eq('id', id).single();
  if (!r) return;
  const isAdmin = VW_AUTH.isAdmin();
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="margin:0">${r.return_no||'Return #'+r.id}</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">
      ${r.customer_name} · ₹${Math.round(r.total_return_value||0).toLocaleString('en-IN')} · ${r.return_type}
    </div>
    <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--text3)">Reason</div>
      <div style="font-size:14px;color:var(--text);margin-top:2px">${r.return_reason}</div>
      ${r.original_invoice_no?`<div style="font-size:12px;color:var(--text3);margin-top:6px">Original Invoice: ${r.original_invoice_no}</div>`:''}
      ${r.notes?`<div style="font-size:12px;color:var(--text2);margin-top:4px">${r.notes}</div>`:''}
    </div>
    ${isAdmin && r.status === 'pending' ? `
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn-primary" style="flex:1;background:var(--green)" onclick="VW_FEATURES.approveReturn(${r.id})">✓ Approve</button>
      <button class="btn-secondary" style="flex:1;color:var(--red)" onclick="VW_FEATURES.rejectReturn(${r.id})">✗ Reject</button>
    </div>` : ''}
    ${isAdmin && r.status === 'approved' ? `
    <button class="btn-primary full-width" onclick="VW_FEATURES.completeReturn(${r.id})">✓ Mark as Completed (Refund Given)</button>` : ''}`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function approveReturn(id) {
  await VW_DB.client.from('customer_returns').update({
    status: 'approved', approved_by: VW_AUTH.getCurrentProfile()?.name || '', approved_at: new Date().toISOString()
  }).eq('id', id);
  closeSheet(); showToast('Return approved ✓', 'success'); navigateTo('returns');
}

async function rejectReturn(id) {
  await VW_DB.client.from('customer_returns').update({
    status: 'rejected', approved_by: VW_AUTH.getCurrentProfile()?.name || '', approved_at: new Date().toISOString()
  }).eq('id', id);
  closeSheet(); showToast('Return rejected', 'warn'); navigateTo('returns');
}

async function completeReturn(id) {
  const { data: r } = await VW_DB.client.from('customer_returns').select('*').eq('id', id).single();
  await VW_DB.client.from('customer_returns').update({
    status: 'completed', completed_by: VW_AUTH.getCurrentProfile()?.name || '', completed_at: new Date().toISOString()
  }).eq('id', id);

  // Auto-record in accounts based on refund method
  if (r?.total_return_value > 0) {
    if (r.refund_method === 'credit_note' && r.customer_id) {
      await VW_DB.client.from('payment_vouchers').insert({
        type: 'credit_note', customer_id: r.customer_id,
        customer_name: r.customer_name, amount: r.total_return_value,
        description: `Return ${r.return_no}: ${r.return_reason}`,
        status: 'approved', created_by_name: VW_AUTH.getCurrentProfile()?.name || '',
        created_at: new Date().toISOString()
      }).catch(()=>{});
      showToast(`Return complete — ₹${Math.round(r.total_return_value).toLocaleString('en-IN')} credit note in ledger ✓`, 'success');
    } else {
      await VW_DB.put(VW_DB.STORES.pettyCash, {
        type: 'out', amount: r.total_return_value,
        category: 'Customer Return Refund',
        description: `Return ${r.return_no}: ${r.customer_name} — ${r.return_reason}`,
        date: new Date().toISOString(), addedByName: VW_AUTH.getCurrentProfile()?.name || ''
      });
      showToast(`Return complete — ₹${Math.round(r.total_return_value).toLocaleString('en-IN')} refund in petty cash ✓`, 'success');
    }
  } else {
    showToast('Return completed ✓', 'success');
  }
  closeSheet(); navigateTo('returns');
}

window.VW_FEATURES.renderReturnsPage = renderReturnsPage;
window.VW_FEATURES.newReturn = newReturn;
window.VW_FEATURES.lookupReturnCustomer = lookupReturnCustomer;
window.VW_FEATURES.saveReturn = saveReturn;
window.VW_FEATURES.openReturn = openReturn;
window.VW_FEATURES.approveReturn = approveReturn;
window.VW_FEATURES.rejectReturn = rejectReturn;
window.VW_FEATURES.completeReturn = completeReturn;

// =====================================================
// GST MODULE — E-Invoice + E-Way Bill
// =====================================================
async function renderGSTPage() {
  const invoices = await VW_DB.all(VW_DB.STORES.invoices);
  const approved = invoices.filter(i => i.approvalStatus === 'approved');
  const withEInv = approved.filter(i => i.eInvoiceNo);
  const withEWay = approved.filter(i => i.eWayBillNo);
  const pendingEInv = approved.filter(i => !i.eInvoiceNo && (i.total || 0) >= 0);
  const pendingEWay = approved.filter(i => !i.eWayBillNo && (i.total || 0) >= 50000); // E-way needed above ₹50K

  return `
  <div class="module-header">
    <h2>📊 GST Compliance</h2>
  </div>

  <!-- STATUS CARDS -->
  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card gold">
      <div class="mc-label">E-Invoices Generated</div>
      <div class="mc-value">${withEInv.length}</div>
    </div>
    <div class="metric-card ${pendingEInv.length>0?'danger':''}">
      <div class="mc-label">Pending E-Invoice</div>
      <div class="mc-value">${pendingEInv.length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">E-Way Bills</div>
      <div class="mc-value">${withEWay.length}</div>
    </div>
    <div class="metric-card ${pendingEWay.length>0?'danger':''}">
      <div class="mc-label">Pending E-Way</div>
      <div class="mc-value">${pendingEWay.length}</div>
    </div>
  </div>

  <!-- GST SETUP NOTICE -->
  <div class="card" style="margin-bottom:10px;border-color:rgba(245,200,66,0.3)">
    <h3 class="card-title">⚙️ GST Portal Setup Required</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">
      To generate E-Invoices and E-Way Bills automatically, V Wholesale needs to be registered on the GST portal and API credentials need to be configured.
    </p>
    <div style="background:var(--bg2);border-radius:10px;padding:12px;font-size:12px;color:var(--text2);margin-bottom:12px">
      <div style="font-weight:600;color:var(--text);margin-bottom:6px">Steps to enable:</div>
      <div>1. Register on GST E-Invoice portal: einvoice1.gst.gov.in</div>
      <div>2. Get API credentials (username + password)</div>
      <div>3. Enter credentials in Settings → GST Config below</div>
      <div>4. E-invoices and E-Way Bills will be auto-generated</div>
    </div>
    <button class="btn-secondary full-width" onclick="VW_FEATURES.showGSTConfig()">⚙️ Configure GST API Credentials</button>
  </div>

  <!-- PENDING E-INVOICES -->
  ${pendingEInv.length ? `
  <div class="card" style="margin-bottom:10px">
    <div class="card-header-row">
      <h3 class="card-title">📄 Pending E-Invoice (${pendingEInv.length})</h3>
      <button class="btn-sm" onclick="VW_FEATURES.generateAllEInvoices()">Generate All</button>
    </div>
    ${pendingEInv.slice(0,10).map(inv => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:13px;font-weight:600">${inv.invoiceNo}</div>
        <div style="font-size:11px;color:var(--text3)">${inv.customerName||'Walk-in'} · ₹${Math.round(inv.total||0).toLocaleString('en-IN')} · ${new Date(inv.date).toLocaleDateString('en-IN')}</div>
      </div>
      <button class="btn-sm" onclick="VW_FEATURES.generateEInvoice(${inv.id})">Generate</button>
    </div>`).join('')}
    ${pendingEInv.length > 10 ? `<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">+${pendingEInv.length-10} more</div>` : ''}
  </div>` : ''}

  <!-- PENDING E-WAY BILLS (above ₹50K) -->
  ${pendingEWay.length ? `
  <div class="card" style="margin-bottom:10px">
    <div class="card-header-row">
      <h3 class="card-title">🚚 Pending E-Way Bill (${pendingEWay.length})</h3>
      <span style="font-size:11px;color:var(--text3)">Required above ₹50,000</span>
    </div>
    ${pendingEWay.slice(0,10).map(inv => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:13px;font-weight:600">${inv.invoiceNo}</div>
        <div style="font-size:11px;color:var(--text3)">${inv.customerName||'Walk-in'} · ₹${Math.round(inv.total||0).toLocaleString('en-IN')}</div>
      </div>
      <button class="btn-sm" onclick="VW_FEATURES.generateEWayBill(${inv.id})">E-Way</button>
    </div>`).join('')}
  </div>` : ''}

  <!-- GST RETURNS SUMMARY -->
  <div class="card">
    <h3 class="card-title">📋 GST Returns Summary</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Monthly GST output for GSTR-1 filing. Download from Accounts → GST Export.</p>
    <button class="btn-secondary full-width" onclick="navigateTo('accounts')">Go to GST Export →</button>
  </div>`;
}

async function showGSTConfig() {
  const config = await VW_DB.getSetting('gst_config', {});
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="margin:0">GST API Configuration</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div class="form-group"><label>GSTIN</label>
      <input type="text" id="gst-gstin" value="${config.gstin||''}" placeholder="e.g. 37AABCV1234A1Z5" maxlength="15">
    </div>
    <div class="form-group"><label>Legal Business Name</label>
      <input type="text" id="gst-name" value="${config.legalName||'Vassure Wholesale Pvt Ltd'}" placeholder="As per GST registration">
    </div>
    <div class="form-group"><label>E-Invoice API Username</label>
      <input type="text" id="gst-user" value="${config.apiUser||''}" placeholder="GST portal API username">
    </div>
    <div class="form-group"><label>E-Invoice API Password</label>
      <input type="password" id="gst-pass" placeholder="GST portal API password">
    </div>
    <div class="form-group"><label>API Environment</label>
      <select id="gst-env">
        <option value="sandbox" ${config.env!=='prod'?'selected':''}>Sandbox / Testing</option>
        <option value="prod" ${config.env==='prod'?'selected':''}>Production (Live)</option>
      </select>
    </div>
    <button class="btn-primary full-width" onclick="VW_FEATURES.saveGSTConfig()">Save GST Config</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveGSTConfig() {
  const config = {
    gstin: document.getElementById('gst-gstin')?.value.trim().toUpperCase(),
    legalName: document.getElementById('gst-name')?.value.trim(),
    apiUser: document.getElementById('gst-user')?.value.trim(),
    env: document.getElementById('gst-env')?.value,
  };
  if (document.getElementById('gst-pass')?.value) {
    config.apiPass = document.getElementById('gst-pass').value;
  }
  await VW_DB.setSetting('gst_config', config);
  closeSheet();
  showToast('GST config saved ✓ — E-invoice generation will be available once API credentials are verified', 'success');
}

async function generateEInvoice(invId) {
  const config = await VW_DB.getSetting('gst_config', {});
  if (!config.gstin || !config.apiUser) {
    showToast('Configure GST API credentials first', 'warn');
    VW_FEATURES.showGSTConfig();
    return;
  }
  // Show manual IRN entry until API is configured
  const sheet = document.getElementById('bottom-sheet');
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>E-Invoice — ${inv?.invoiceNo}</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Enter the IRN (Invoice Reference Number) from the GST portal:</p>
    <div class="form-group"><label>IRN (64-character hash)</label>
      <textarea id="irn-input" placeholder="Paste IRN from GST portal..." style="height:70px;font-family:monospace;font-size:12px"></textarea>
    </div>
    <div class="form-group"><label>Acknowledgement Number</label>
      <input type="text" id="ack-no" placeholder="e.g. 112310001234567">
    </div>
    <div class="form-group"><label>Acknowledgement Date</label>
      <input type="date" id="ack-date" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <button class="btn-primary full-width" onclick="VW_FEATURES.saveEInvoice(${invId})">Save E-Invoice Details</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveEInvoice(invId) {
  const irn = document.getElementById('irn-input')?.value.trim();
  const ackNo = document.getElementById('ack-no')?.value.trim();
  const ackDate = document.getElementById('ack-date')?.value;
  if (!irn) { showToast('Enter IRN from GST portal', 'warn'); return; }
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  await VW_DB.put(VW_DB.STORES.invoices, { ...inv, eInvoiceNo: irn, eInvoiceAckNo: ackNo, eInvoiceAckDate: ackDate, eInvoiceAt: new Date().toISOString() });
  closeSheet();
  showToast('E-Invoice details saved ✓', 'success');
  navigateTo('gst');
}

async function generateEWayBill(invId) {
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>E-Way Bill — ${inv?.invoiceNo}</h3>
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Generate E-Way Bill on GST portal and enter details here:</p>
    <div class="form-group"><label>E-Way Bill No.</label>
      <input type="text" id="eway-no" placeholder="12-digit E-Way Bill number">
    </div>
    <div class="form-group"><label>Vehicle No.</label>
      <input type="text" id="eway-vehicle" placeholder="e.g. AP39AB1234">
    </div>
    <div class="form-group"><label>Valid Until</label>
      <input type="date" id="eway-valid" value="${new Date(Date.now()+86400000).toISOString().split('T')[0]}">
    </div>
    <button class="btn-primary full-width" onclick="VW_FEATURES.saveEWayBill(${invId})">Save E-Way Bill</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function saveEWayBill(invId) {
  const eWayNo = document.getElementById('eway-no')?.value.trim();
  if (!eWayNo) { showToast('Enter E-Way Bill number', 'warn'); return; }
  const inv = await VW_DB.getById(VW_DB.STORES.invoices, invId);
  await VW_DB.put(VW_DB.STORES.invoices, {
    ...inv,
    eWayBillNo: eWayNo,
    eWayVehicle: document.getElementById('eway-vehicle')?.value.trim(),
    eWayValid: document.getElementById('eway-valid')?.value,
    eWayAt: new Date().toISOString()
  });
  closeSheet();
  showToast('E-Way Bill saved ✓', 'success');
  navigateTo('gst');
}

async function generateAllEInvoices() {
  showToast('Configure GST API to auto-generate — currently requires manual IRN entry', 'warn');
}

window.VW_FEATURES.renderGSTPage = renderGSTPage;
window.VW_FEATURES.showGSTConfig = showGSTConfig;
window.VW_FEATURES.saveGSTConfig = saveGSTConfig;
window.VW_FEATURES.generateEInvoice = generateEInvoice;
window.VW_FEATURES.saveEInvoice = saveEInvoice;
window.VW_FEATURES.generateEWayBill = generateEWayBill;
window.VW_FEATURES.saveEWayBill = saveEWayBill;
window.VW_FEATURES.generateAllEInvoices = generateAllEInvoices;

// =====================================================
// WISHLIST MODULE
// Executive adds products to customer's wishlist in-store
// Customer can view/buy later
// =====================================================
async function renderWishlistPage() {
  const profile = VW_AUTH.getCurrentProfile();
  const { data: items } = await VW_DB.client
    .from('wishlists')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  const wishlists = items || [];

  // Group by customer
  const byCustomer = {};
  wishlists.forEach(w => {
    const key = w.customer_id || w.customer_phone;
    if (!byCustomer[key]) byCustomer[key] = { name: w.customer_name, phone: w.customer_phone, items: [] };
    byCustomer[key].items.push(w);
  });
  const customers = Object.values(byCustomer);

  return `
  <div class="module-header">
    <h2>❤️ Wishlist</h2>
    <button class="btn-sm" onclick="VW_FEATURES.addToWishlist()">+ Add</button>
  </div>

  <div class="metric-grid-4" style="margin-bottom:14px">
    <div class="metric-card gold">
      <div class="mc-label">Active Wishlists</div>
      <div class="mc-value">${wishlists.length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Customers</div>
      <div class="mc-value">${customers.length}</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Potential Value</div>
      <div class="mc-value">₹${Math.round(wishlists.reduce((s,w)=>s+(w.product_price||0),0)/1000)}K</div>
    </div>
    <div class="metric-card">
      <div class="mc-label">Converted</div>
      <div class="mc-value">${(await VW_DB.client.from('wishlists').select('id',{count:'exact',head:true}).eq('status','purchased')).count||0}</div>
    </div>
  </div>

  <div class="card">
    <div class="search-row" style="margin-bottom:12px">
      <input type="text" id="wishlist-search" placeholder="🔍 Search customer or product..." oninput="VW_FEATURES.searchWishlists(this.value)">
    </div>
    <div id="wishlist-list">
      ${customers.length ? customers.map(c => `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text)">${c.name||'Unknown'}</div>
            <div style="font-size:11px;color:var(--text3)">${c.phone||''} · ${c.items.length} item${c.items.length>1?'s':''}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-sm" onclick="VW_FEATURES.createQuoteFromWishlist('${c.phone}')">📄 Quote</button>
            ${c.phone?`<button class="btn-sm" style="background:#25D366;color:#fff" onclick="VW_FEATURES.shareWishlistWA('${c.phone}','${(c.name||'').replace(/'/g,"\\'")}')">💬 WA</button>`:''}
          </div>
        </div>
        ${c.items.map(w => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:6px">
          <span style="font-size:20px">❤️</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;color:var(--text)">${w.product_name||'—'}</div>
            <div style="font-size:11px;color:var(--text3)">${w.product_category||''} ${w.product_price?'· ₹'+w.product_price.toLocaleString('en-IN'):''}</div>
            ${w.notes?`<div style="font-size:11px;color:var(--text2);margin-top:2px">${w.notes}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <button class="btn-sm" onclick="VW_FEATURES.markWishlistPurchased(${w.id})">✓ Bought</button>
            <button class="btn-sm" style="color:var(--red)" onclick="VW_FEATURES.removeWishlistItem(${w.id})">✕</button>
          </div>
        </div>`).join('')}
      </div>`).join('') : '<p class="empty-msg">No active wishlist items — add products while customers browse the store</p>'}
    </div>
  </div>`;
}

async function addToWishlist(prefilledCustomerId) {
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const products = await VW_DB.all(VW_DB.STORES.products);
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">Add to Wishlist ❤️</h3>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
    </div>
    <div class="form-group"><label>Customer Phone *</label>
      <input type="tel" id="wl-phone" placeholder="10-digit mobile" maxlength="10" oninput="VW_FEATURES.lookupWishlistCustomer(this.value)">
      <div id="wl-cust-status" style="font-size:12px;color:var(--text3);margin-top:4px"></div>
    </div>
    <div class="form-group"><label>Customer Name *</label>
      <input type="text" id="wl-name" placeholder="Customer name" list="wl-cust-list">
      <datalist id="wl-cust-list">${customers.slice(0,50).map(c=>`<option value="${c.name}">`).join('')}</datalist>
    </div>
    <div class="form-group"><label>Product</label>
      <input type="text" id="wl-product" placeholder="Search product..." list="wl-product-list" oninput="VW_FEATURES.lookupWishlistProduct(this.value)">
      <datalist id="wl-product-list">${products.slice(0,100).map(p=>`<option value="${p.name}" data-price="${p.price}" data-cat="${p.category||''}">`).join('')}</datalist>
      <div id="wl-product-status" style="font-size:12px;color:var(--text3);margin-top:4px"></div>
    </div>
    <div class="form-group"><label>Notes (what they're looking for)</label>
      <input type="text" id="wl-notes" placeholder="e.g. Needs 200 boxes, budget ₹50K, light colour preference">
    </div>
    <button class="btn-primary full-width" onclick="VW_FEATURES.saveWishlistItem()">❤️ Add to Wishlist</button>`;
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function lookupWishlistCustomer(phone) {
  if (phone.length < 10) return;
  const customers = await VW_DB.all(VW_DB.STORES.customers);
  const match = customers.find(c => c.phone === phone);
  const el = document.getElementById('wl-cust-status');
  const nameEl = document.getElementById('wl-name');
  if (match) {
    if (el) el.innerHTML = `<span style="color:var(--green)">✓ ${match.name} · ${match.visitCount||0} visits</span>`;
    if (nameEl && !nameEl.value) nameEl.value = match.name;
    window._wlCustomer = match;
  } else {
    if (el) el.innerHTML = `<span style="color:var(--text3)">New customer</span>`;
    window._wlCustomer = null;
  }
}

async function lookupWishlistProduct(name) {
  const products = await VW_DB.all(VW_DB.STORES.products);
  const match = products.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (match) {
    window._wlProduct = match;
    const el = document.getElementById('wl-product-status');
    if (el) el.innerHTML = `<span style="color:var(--green)">✓ ₹${match.price||0}/${match.unit||'unit'} · ${match.category||''}</span>`;
  }
}

async function saveWishlistItem() {
  const name = document.getElementById('wl-name')?.value.trim();
  const phone = document.getElementById('wl-phone')?.value.trim();
  const productName = document.getElementById('wl-product')?.value.trim();
  const notes = document.getElementById('wl-notes')?.value.trim();
  if (!name) { showToast('Enter customer name', 'warn'); return; }
  if (!productName) { showToast('Enter product name', 'warn'); return; }
  const p = window._wlProduct;
  const { error } = await VW_DB.client.from('wishlists').insert({
    customer_id: window._wlCustomer?.id || null,
    customer_name: name,
    customer_phone: phone || '',
    product_id: p?.id || null,
    product_name: productName,
    product_brand: p?.brand || '',
    product_price: p?.price || null,
    product_category: p?.category || '',
    added_by_name: VW_AUTH.getCurrentProfile()?.name || '',
    notes, status: 'active'
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  window._wlCustomer = null; window._wlProduct = null;
  closeSheet();
  showToast(`Added to ${name}'s wishlist ❤️`, 'success');
  navigateTo('wishlist');
}

async function markWishlistPurchased(id) {
  await VW_DB.client.from('wishlists').update({ status: 'purchased' }).eq('id', id);
  showToast('Marked as purchased ✓', 'success');
  navigateTo('wishlist');
}

async function removeWishlistItem(id) {
  await VW_DB.client.from('wishlists').delete().eq('id', id);
  showToast('Removed from wishlist', 'warn');
  navigateTo('wishlist');
}

async function createQuoteFromWishlist(phone) {
  const { data } = await VW_DB.client.from('wishlists').select('*').eq('customer_phone', phone).eq('status','active');
  if (!data?.length) return;
  quoteItems = data.map(w => ({
    id: Date.now()+Math.random(), brand: w.product_brand||'', model: '',
    description: w.product_name, department: w.product_category||'',
    qty: 1, mode: 'mrp_disc', mrp: w.product_price||0, discPct: 0,
    costPrice:'', marginPct:'', addGst:false, gstPct:18, gstSlab:'18',
    directPrice:'', brandMode:'new', modelMode:'new'
  }));
  navigateTo('quotations');
  setTimeout(() => showQuoteForm(), 400);
  showToast(`${data.length} wishlist items loaded into quote`, 'success');
}

async function shareWishlistWA(phone, name) {
  const { data } = await VW_DB.client.from('wishlists').select('product_name').eq('customer_phone', phone).eq('status','active');
  const items = (data||[]).map(w => w.product_name).filter(Boolean);
  const msg = `Dear ${name}, 🙏\n\nHere are the products from your V Wholesale wishlist:\n\n${items.map((p,i)=>`${i+1}. ${p}`).join('\n')}\n\nWould you like us to send a quotation?\n📞 8712697930 · V Wholesale, Vijayawada`;
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function searchWishlists(q) {
  // Simple client-side filter
  const items = document.querySelectorAll('#wishlist-list > div');
  items.forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

window.VW_FEATURES.renderWishlistPage = renderWishlistPage;
window.VW_FEATURES.addToWishlist = addToWishlist;
window.VW_FEATURES.lookupWishlistCustomer = lookupWishlistCustomer;
window.VW_FEATURES.lookupWishlistProduct = lookupWishlistProduct;
window.VW_FEATURES.saveWishlistItem = saveWishlistItem;
window.VW_FEATURES.markWishlistPurchased = markWishlistPurchased;
window.VW_FEATURES.removeWishlistItem = removeWishlistItem;
window.VW_FEATURES.createQuoteFromWishlist = createQuoteFromWishlist;
window.VW_FEATURES.shareWishlistWA = shareWishlistWA;
window.VW_FEATURES.searchWishlists = searchWishlists;





// ═══════════════════════════════════════════════════════════════
// CUSTOMER WALLET MODULE
// ═══════════════════════════════════════════════════════════════

async function getOrCreateWallet(customerId, customerName, customerPhone) {
  // Fetch existing wallet
  let { data: wallet } = await VW_DB.client
    .from('customer_wallets')
    .select('*')
    .eq('customer_id', customerId)
    .single()
    .then(r=>r, ()=>({data:null}));

  if (!wallet) {
    const { data: newWallet } = await VW_DB.client
      .from('customer_wallets')
      .insert({ customer_id: customerId, customer_name: customerName, customer_phone: customerPhone })
      .select('*').single();
    wallet = newWallet;
  }
  return wallet;
}

async function renderCustomerWallet(customerId) {
  const wallet = await getOrCreateWallet(customerId, '', '');
  if (!wallet) return '<div class="empty-msg">Wallet not available</div>';

  // Fetch last 10 transactions
  const { data: txns } = await VW_DB.client
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch active labor job if any
  const { data: activeJob } = await VW_DB.client
    .from('labor_jobs')
    .select('job_no,total_sqft,total_sqft_completed,agreed_rate_type,agreed_price_large,status,expected_end_date')
    .eq('customer_id', customerId)
    .in('status', ['not_started','in_progress','paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .then(r => ({ data: r.data?.[0] || null }))
    .then(r=>r, ()=>({data:null}));

  const bal = parseFloat(wallet.balance || 0);
  const kycBadge = wallet.kyc_status === 'approved'
    ? '<span style="font-size:10px;background:rgba(34,197,94,0.15);color:var(--green);border-radius:5px;padding:2px 7px;font-weight:700">✓ KYC Verified</span>'
    : wallet.kyc_status === 'pending'
    ? '<span style="font-size:10px;background:rgba(245,200,66,0.15);color:var(--gold);border-radius:5px;padding:2px 7px;font-weight:700">⏳ KYC Pending</span>'
    : bal >= 10000
    ? '<span style="font-size:10px;background:rgba(239,68,68,0.1);color:var(--red);border-radius:5px;padding:2px 7px;font-weight:700">⚠️ KYC Required for >₹10,000</span>'
    : '';

  // Active job summary
  const jobSummary = activeJob ? (() => {
    const remaining = (activeJob.total_sqft || 0) - (activeJob.total_sqft_completed || 0);
    const ratePerSqft = activeJob.agreed_price_large || 0;
    const estRemaining = Math.round(remaining * ratePerSqft);
    const daysLeft = activeJob.expected_end_date
      ? Math.max(0, Math.ceil((new Date(activeJob.expected_end_date) - new Date()) / 86400000))
      : null;
    return `
    <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:12px;padding:12px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">🏗 Active Labor Job — ${activeJob.job_no}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><div style="font-size:18px;font-weight:800">${activeJob.total_sqft_completed || 0}</div><div style="font-size:10px;color:var(--text3)">sqft done</div></div>
        <div><div style="font-size:18px;font-weight:800">${remaining.toFixed(0)}</div><div style="font-size:10px;color:var(--text3)">sqft left</div></div>
        <div><div style="font-size:18px;font-weight:800">${daysLeft !== null ? daysLeft+'d' : '—'}</div><div style="font-size:10px;color:var(--text3)">days left</div></div>
      </div>
      ${estRemaining > 0 ? `
      <div style="margin-top:8px;padding:8px;background:var(--bg3);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:11px;color:var(--text3)">Est. remaining payment</div>
        <div style="font-size:14px;font-weight:800;color:var(--gold)">₹${estRemaining.toLocaleString('en-IN')}</div>
      </div>
      ${bal < estRemaining ? `<div style="font-size:11px;color:var(--red);margin-top:6px;font-weight:600">⚠️ Wallet balance low — top up to avoid work pause</div>` : ''}` : ''}
    </div>`;
  })() : '';

  const txnRows = (txns || []).map(t => {
    const isCredit = ['topup','refund'].includes(t.type);
    const icon = t.type === 'topup' ? '↑' : t.type === 'refund' ? '↩' : '↓';
    const color = isCredit ? 'var(--green)' : 'var(--red)';
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border2)">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:28px;height:28px;border-radius:50%;background:${isCredit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${color}">${icon}</div>
        <div>
          <div style="font-size:12px;font-weight:600">${t.description || t.type}</div>
          <div style="font-size:10px;color:var(--text3)">${new Date(t.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:800;color:${color}">${isCredit ? '+' : '-'}₹${Math.abs(t.amount).toLocaleString('en-IN')}</div>
        <div style="font-size:10px;color:var(--text3)">Bal: ₹${parseFloat(t.balance_after||0).toLocaleString('en-IN')}</div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="module-header"><h2>👛 My Wallet</h2></div>

  <!-- BALANCE CARD -->
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:20px;margin-bottom:14px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
      <div style="font-size:12px;opacity:0.7">V Wholesale Wallet</div>
      ${kycBadge}
    </div>
    <div style="font-size:36px;font-weight:900;color:#f5c842;margin:8px 0">₹${bal.toLocaleString('en-IN')}</div>
    <div style="font-size:11px;opacity:0.6">Available Balance</div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button onclick="showWalletTopup(${wallet.id})" style="flex:1;padding:10px;border-radius:10px;background:#f5c842;color:#000;border:none;font-size:13px;font-weight:800;cursor:pointer">+ Top Up</button>
      <button onclick="showWalletRefund(${wallet.id})" style="flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);font-size:13px;cursor:pointer">↩ Refund</button>
    </div>
  </div>

  <!-- STATS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
    <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:var(--green)">₹${parseFloat(wallet.total_topped_up||0).toLocaleString('en-IN')}</div>
      <div style="font-size:10px;color:var(--text3)">Total Topped Up</div>
    </div>
    <div style="background:var(--bg2);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:var(--gold)">₹${parseFloat(wallet.total_spent||0).toLocaleString('en-IN')}</div>
      <div style="font-size:10px;color:var(--text3)">Total Spent</div>
    </div>
  </div>

  ${jobSummary}

  <!-- TRANSACTIONS -->
  <div style="background:var(--bg2);border-radius:12px;padding:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">Recent Transactions</div>
    ${txnRows || '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">No transactions yet</div>'}
    ${(txns||[]).length >= 10 ? `<button onclick="loadMoreWalletTxns(${wallet.id})" style="width:100%;padding:8px;margin-top:8px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text3);font-size:12px;cursor:pointer">Load more →</button>` : ''}
  </div>

  ${wallet.kyc_status === 'none' && bal >= 8000 ? `
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:12px;padding:12px;margin-top:12px">
    <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:4px">Complete KYC to unlock ₹1,00,000 limit</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Upload Aadhaar + PAN card. Takes 1 working day to verify.</div>
    <button onclick="showKYCUpload(${wallet.id})" style="padding:8px 16px;background:var(--gold);border:none;border-radius:8px;color:#000;font-size:12px;font-weight:700;cursor:pointer">Upload KYC Documents</button>
  </div>` : ''}`;
}

async function showWalletTopup(walletId) {
  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>↑ Top Up Wallet</h3>
  <p style="font-size:12px;color:var(--text3)">Add money to your V Wholesale Wallet. Use for labor payments, tile purchases, and more.</p>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
    ${[500,1000,2000,5000,10000,20000].map(amt=>`
    <button onclick="document.getElementById('topup-amount').value=${amt};updateTopupPreview()"
      style="padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:13px;font-weight:700">
      ₹${amt.toLocaleString('en-IN')}
    </button>`).join('')}
  </div>

  <div class="form-group">
    <label>Enter Amount (₹)</label>
    <input type="number" id="topup-amount" placeholder="Minimum ₹500" min="500" step="100"
      oninput="updateTopupPreview()" style="font-size:18px;font-weight:700;color:var(--gold)">
  </div>

  <div class="form-group">
    <label>Payment Method</label>
    <div style="display:flex;gap:8px">
      <button id="pay-upi" onclick="selectPayMethod('upi')"
        style="flex:1;padding:10px;border-radius:8px;border:2px solid var(--gold);background:var(--gold-muted);cursor:pointer;font-size:12px;font-weight:700;color:var(--gold)">
        📱 UPI
      </button>
      <button id="pay-cash" onclick="selectPayMethod('cash')"
        style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);cursor:pointer;font-size:12px;color:var(--text3)">
        💵 Cash at Store
      </button>
    </div>
  </div>

  <div id="topup-preview" style="display:none;background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:13px">
      <span>Amount to add</span><span id="topup-preview-amt" style="font-weight:700;color:var(--gold)">—</span>
    </div>
  </div>

  <button onclick="confirmWalletTopup(${walletId})"
    style="width:100%;padding:14px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    ✓ Confirm Top Up
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  const s = document.createElement('script');
  s.textContent = `
    window._topupPayMethod = 'upi';
    function selectPayMethod(m) {
      window._topupPayMethod = m;
      document.getElementById('pay-upi').style.borderColor = m==='upi'?'var(--gold)':'var(--border)';
      document.getElementById('pay-upi').style.background = m==='upi'?'var(--gold-muted)':'var(--bg2)';
      document.getElementById('pay-upi').style.color = m==='upi'?'var(--gold)':'var(--text3)';
      document.getElementById('pay-cash').style.borderColor = m==='cash'?'var(--gold)':'var(--border)';
      document.getElementById('pay-cash').style.background = m==='cash'?'var(--gold-muted)':'var(--bg2)';
      document.getElementById('pay-cash').style.color = m==='cash'?'var(--gold)':'var(--text3)';
    }
    function updateTopupPreview() {
      const amt = parseFloat(document.getElementById('topup-amount')?.value)||0;
      const preview = document.getElementById('topup-preview');
      const previewAmt = document.getElementById('topup-preview-amt');
      if (amt >= 500) {
        preview.style.display = 'block';
        previewAmt.textContent = '₹'+amt.toLocaleString('en-IN');
      } else {
        preview.style.display = 'none';
      }
    }
  `;
  document.body.appendChild(s);
}

async function confirmWalletTopup(walletId) {
  const amount = parseFloat(document.getElementById('topup-amount')?.value) || 0;
  if (amount < 500) { showToast('Minimum top-up is ₹500', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();
  const payMethod = window._topupPayMethod || 'cash';

  // Fetch current wallet
  const { data: wallet } = await VW_DB.client.from('customer_wallets').select('balance,total_topped_up').eq('id', walletId).single();
  if (!wallet) { showToast('Wallet not found', 'error'); return; }

  const newBalance = parseFloat(wallet.balance || 0) + amount;

  // Create transaction
  const { error } = await VW_DB.client.from('wallet_transactions').insert({
    wallet_id: walletId,
    customer_id: wallet.customer_id,
    type: 'topup',
    amount: amount,
    balance_after: newBalance,
    description: `Wallet top-up via ${payMethod === 'upi' ? 'UPI' : 'Cash at Store'}`,
    payment_method: payMethod,
    processed_by: prof?.id,
    processed_by_name: prof?.name || '',
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  // Update wallet balance
  await VW_DB.client.from('customer_wallets').update({
    balance: newBalance,
    total_topped_up: parseFloat(wallet.total_topped_up || 0) + amount,
    last_activity_at: new Date().toISOString(),
  }).eq('id', walletId);

  showToast(`₹${amount.toLocaleString('en-IN')} added to wallet ✅`, 'success');
  closeSheet();
}

async function showWalletRefund(walletId) {
  const { data: wallet } = await VW_DB.client.from('customer_wallets').select('*').eq('id', walletId).single();
  if (!wallet) return;
  const bal = parseFloat(wallet.balance || 0);

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <h3>↩ Request Refund</h3>
  <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:14px">
    <div style="font-size:12px;color:var(--text3)">Available Balance</div>
    <div style="font-size:24px;font-weight:900;color:var(--gold)">₹${bal.toLocaleString('en-IN')}</div>
  </div>
  ${bal < 100 ? `<div style="font-size:12px;color:var(--red);padding:8px">Minimum refund amount is ₹100</div>` : `
  <div class="form-group">
    <label>Refund Amount (₹)</label>
    <input type="number" id="refund-amount" value="${bal}" max="${bal}" min="100" placeholder="₹"
      style="font-size:18px;font-weight:700;color:var(--gold)">
  </div>
  <div class="form-group">
    <label>Bank Account Number</label>
    <input type="text" id="refund-account" placeholder="Enter bank account number">
  </div>
  <div class="form-group">
    <label>IFSC Code</label>
    <input type="text" id="refund-ifsc" placeholder="e.g. SBIN0001234">
  </div>
  <div class="form-group">
    <label>Account Holder Name</label>
    <input type="text" id="refund-name" placeholder="As per bank records">
  </div>
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--text3)">
    ⏱ Refunds processed within 3-5 working days · Free of charge
  </div>
  <button onclick="VW_WALLET.submitRefundRequest(${walletId})"
    style="width:100%;padding:14px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    Submit Refund Request
  </button>`}
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function submitRefundRequest(walletId) {
  const amount = parseFloat(document.getElementById('refund-amount')?.value) || 0;
  const account = document.getElementById('refund-account')?.value?.trim();
  const ifsc = document.getElementById('refund-ifsc')?.value?.trim();
  const name = document.getElementById('refund-name')?.value?.trim();

  if (amount < 100) { showToast('Minimum refund is ₹100', 'warn'); return; }
  if (!account || !ifsc || !name) { showToast('Enter complete bank details', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();

  // Notify management
  await createPersistedNotification({
    category: 'wallet_refund',
    title: `↩ Wallet Refund Request — ₹${amount.toLocaleString('en-IN')}`,
    body: `${name} · Account: ${account} · IFSC: ${ifsc}`,
    relatedTable: 'customer_wallets',
    relatedId: walletId,
    actions: [{ label: '👁 Process Refund', action: 'open_wallet' }],
  }).catch(() => {});

  showToast('Refund request submitted — processed within 3-5 working days', 'success');
  closeSheet();
}

// Expose wallet functions globally
window.VW_WALLET = {
  getOrCreateWallet,
  renderCustomerWallet,
  showWalletTopup,
  confirmWalletTopup,
  showWalletRefund,
  submitRefundRequest,
};
window.showWalletTopup = showWalletTopup;
window.showWalletRefund = showWalletRefund;

// ═══════════════════════════════════════════════════════════════
// LABOR REQUEST MODULE
// ═══════════════════════════════════════════════════════════════

async function renderCreateLaborRequest(tqId) {
  // Pre-fill from TQ if provided
  let tq = null;
  if (tqId) {
    const { data } = await VW_DB.client.from('tile_quotations')
      .select('*').eq('id', tqId).single().then(r=>r, ()=>({data:null}));
    tq = data;
  }

  const prof = VW_AUTH.getCurrentProfile();

  document.getElementById('bottom-sheet').innerHTML = `
  <div class="sheet-handle"></div>
  <h3>🏗 Request Tile Laying Labor</h3>
  <p style="font-size:12px;color:var(--text3);margin-bottom:14px">
    ${tq ? `Linked to ${tq.tq_no} · ${parseFloat(tq.total_area_sqft||0).toFixed(0)} sqft` : 'Fill in job details to find the best contractor for your project.'}
  </p>

  <!-- CUSTOMER DETAILS (pre-filled if from TQ) -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">👤 Customer & Site</h3>
    <div class="form-group">
      <label>Customer Name *</label>
      <input type="text" id="lr-cust-name" value="${tq?.customer_name||''}" placeholder="Full name">
    </div>
    <div class="form-group">
      <label>Phone *</label>
      <input type="tel" id="lr-cust-phone" value="${tq?.customer_phone||''}" placeholder="10-digit mobile" maxlength="10">
    </div>
    <div class="form-group">
      <label>Site Address *</label>
      <input type="text" id="lr-site-addr" value="${tq?.site_address||''}" placeholder="Full site address">
    </div>
  </div>

  <!-- WORK DETAILS -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📐 Work Details</h3>
    <div class="form-group">
      <label>Total Area (sqft) *</label>
      <input type="number" id="lr-sqft" value="${tq?.total_area_sqft||''}" placeholder="e.g. 450" min="1">
    </div>
    <div class="form-group">
      <label>Work Type</label>
      <div style="display:flex;gap:8px">
        ${['floor','wall','both'].map(w=>`
        <button id="lr-wt-${w}" onclick="selectWorkType('${w}')"
          style="flex:1;padding:8px;border-radius:8px;font-size:12px;cursor:pointer;
            border:${w==='both'?'2px solid var(--gold)':'1px solid var(--border)'};
            background:${w==='both'?'var(--gold-muted)':'var(--bg2)'}">
          ${w==='floor'?'🏠 Floor':w==='wall'?'🧱 Wall':'🏠+🧱 Both'}
        </button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Preferred Start Date</label>
      <input type="date" id="lr-start-date" min="${new Date().toISOString().split('T')[0]}">
    </div>
  </div>

  <!-- SITE CONDITIONS -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">🏗 Site Conditions</h3>

    <div class="form-group">
      <label>Material Status</label>
      <select id="lr-material">
        <option value="ready">✅ Ready at site</option>
        <option value="at_vw_store">📦 At V Wholesale store (needs delivery first)</option>
        <option value="partial">⚠️ Partial — some ready, some pending</option>
        <option value="not_ready">❌ Not purchased yet</option>
      </select>
    </div>

    <div class="form-group">
      <label>Floor Level</label>
      <select id="lr-floor">
        <option value="0">Ground Floor</option>
        <option value="1">1st Floor</option>
        <option value="2">2nd Floor</option>
        <option value="3">3rd Floor</option>
        <option value="4">4th Floor or higher</option>
      </select>
    </div>

    <div class="form-group">
      <label>Existing Flooring</label>
      <select id="lr-flooring">
        <option value="bare_cement">Bare Cement (new construction)</option>
        <option value="old_tiles">Old Tiles (removal needed)</option>
        <option value="marble">Marble / Granite (removal needed)</option>
        <option value="other">Other</option>
      </select>
    </div>

    <div class="form-group">
      <label>Site Access</label>
      <select id="lr-access">
        <option value="easy">Easy — wide staircase / lift available</option>
        <option value="narrow">Narrow staircase — manual carry</option>
        <option value="no_lift">No lift — manual carry to upper floor</option>
      </select>
    </div>
  </div>

  <!-- PHOTOS -->
  <div class="card" style="margin-bottom:10px">
    <h3 class="card-title">📷 Room Photos (Required)</h3>
    <p style="font-size:11px;color:var(--text3);margin-bottom:8px">Upload at least 1 photo per room. Contractors use these to plan their work and give accurate bids.</p>
    <input type="file" id="lr-photos" multiple accept="image/*" onchange="previewLRPhotos(this)"
      style="width:100%;padding:8px;background:var(--bg2);border:1px dashed var(--border);border-radius:8px;font-size:12px">
    <div id="lr-photo-previews" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>
  </div>

  <!-- NOTES -->
  <div class="card" style="margin-bottom:14px">
    <h3 class="card-title">📝 Additional Notes</h3>
    <textarea id="lr-notes" placeholder="Any special requirements, access instructions, or notes for the contractor..." rows="3"
      style="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:12px;resize:vertical;box-sizing:border-box"></textarea>
  </div>

  <button onclick="VW_LABOR.submitLaborRequest(${tqId||'null'})"
    style="width:100%;padding:14px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer">
    📤 Submit Request
  </button>
  <button onclick="closeSheet()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Cancel</button>`;

  document.getElementById('bottom-sheet').classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');

  const s = document.createElement('script');
  s.textContent = `
    window._lrWorkType = 'both';
    function selectWorkType(w) {
      window._lrWorkType = w;
      ['floor','wall','both'].forEach(t => {
        const btn = document.getElementById('lr-wt-'+t);
        if (btn) {
          btn.style.border = t===w?'2px solid var(--gold)':'1px solid var(--border)';
          btn.style.background = t===w?'var(--gold-muted)':'var(--bg2)';
        }
      });
    }
    function previewLRPhotos(input) {
      const preview = document.getElementById('lr-photo-previews');
      if (!preview) return;
      preview.innerHTML = '';
      Array.from(input.files).forEach(file => {
        const url = URL.createObjectURL(file);
        preview.innerHTML += '<img src="'+url+'" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">';
      });
    }
  `;
  document.body.appendChild(s);
}

async function submitLaborRequest(tqId) {
  const name  = document.getElementById('lr-cust-name')?.value?.trim();
  const phone = document.getElementById('lr-cust-phone')?.value?.trim();
  const addr  = document.getElementById('lr-site-addr')?.value?.trim();
  const sqft  = parseFloat(document.getElementById('lr-sqft')?.value) || 0;

  if (!name || !phone || !addr || !sqft) {
    showToast('Fill in all required fields', 'warn'); return;
  }

  const prof = VW_AUTH.getCurrentProfile();
  const { error, data } = await VW_DB.client.from('labor_requests').insert({
    customer_name: name,
    customer_phone: phone,
    site_address: addr,
    tq_id: tqId || null,
    total_sqft: sqft,
    work_type: window._lrWorkType || 'both',
    material_status: document.getElementById('lr-material')?.value || 'ready',
    material_location: 'at_site',
    floor_level: parseInt(document.getElementById('lr-floor')?.value || 0),
    old_flooring: document.getElementById('lr-flooring')?.value || 'bare_cement',
    site_access: document.getElementById('lr-access')?.value || 'easy',
    preferred_start_date: document.getElementById('lr-start-date')?.value || null,
    notes: document.getElementById('lr-notes')?.value || '',
    status: 'pending_approval',
    created_by: prof?.id,
    created_by_name: prof?.name || '',
    created_via: 'executive',
  }).select('id,request_no').single();

  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  // Notify management
  const { data: mgmt } = await VW_DB.client.from('profiles')
    .select('id').in('role', ['management','admin']).eq('status','approved');
  for (const m of mgmt || []) {
    await createPersistedNotification({
      category: 'labor_approval',
      title: `🏗 Labor Request — ${data.request_no}`,
      body: `${name} · ${sqft} sqft · ${addr}`,
      recipientId: m.id,
      relatedTable: 'labor_requests',
      relatedId: data.id,
      actions: [{ label: '👁 Review Request', action: 'open_labor_request' }],
    }).catch(() => {});
  }

  showToast(`${data.request_no} submitted for Management review`, 'success');
  closeSheet();
}

async function renderLaborRequestList() {
  const prof = VW_AUTH.getCurrentProfile();
  const isAdmin = ['admin','management'].includes(prof?.role);

  let query = VW_DB.client.from('labor_requests')
    .select('id,request_no,customer_name,site_address,total_sqft,work_type,status,created_at,created_by_name')
    .order('created_at', { ascending: false })
    .limit(30);

  if (!isAdmin) query = query.eq('created_by', prof?.id);

  const { data: requests } = await query;

  const statusConfig = {
    draft: { label:'Draft', color:'var(--text3)' },
    pending_approval: { label:'⏳ Awaiting Approval', color:'var(--gold)' },
    published: { label:'📢 Bidding Open', color:'#60A5FA' },
    accepted: { label:'✅ Contractor Assigned', color:'var(--green)' },
    in_progress: { label:'🔨 In Progress', color:'var(--gold)' },
    completed: { label:'✓ Complete', color:'var(--green)' },
    cancelled: { label:'Cancelled', color:'var(--red)' },
  };

  return `
  <div class="module-header">
    <h2>🏗 Labor Requests</h2>
    <button class="btn-sm" onclick="VW_LABOR.renderCreateLaborRequest(null)" style="background:var(--gold);color:#000">+ New Request</button>
  </div>
  ${!(requests?.length) ? '<p class="empty-msg">No labor requests yet</p>' :
  requests.map(r => {
    const sc = statusConfig[r.status] || { label: r.status, color: 'var(--text3)' };
    return `
    <div class="task-card" onclick="VW_LABOR.openLaborRequest(${r.id})" style="cursor:pointer">
      <div class="task-card-header">
        <span class="task-dept">${r.request_no}</span>
        <span class="badge" style="background:${sc.color};color:#000">${sc.label}</span>
      </div>
      <div style="font-size:13px;font-weight:600">${r.customer_name}</div>
      <div style="font-size:11px;color:var(--text3)">${r.site_address} · ${r.total_sqft} sqft · ${r.work_type}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px">By ${r.created_by_name} · ${new Date(r.created_at).toLocaleDateString('en-IN')}</div>
    </div>`;
  }).join('')}`;
}

async function openLaborRequest(id) {
  const { data: r } = await VW_DB.client.from('labor_requests').select('*').eq('id', id).single();
  if (!r) return;
  const prof = VW_AUTH.getCurrentProfile();
  const isAdmin = ['admin','management'].includes(prof?.role);

  const { data: bids } = await VW_DB.client.from('contractor_bids')
    .select('*').eq('request_id', id).order('submitted_at', { ascending: false });

  const sheet = document.getElementById('bottom-sheet');
  sheet.innerHTML = `
  <div class="sheet-handle"></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
    <div>
      <h3 style="margin:0">${r.request_no}</h3>
      <div style="font-size:12px;color:var(--text3)">${r.customer_name} · ${r.total_sqft} sqft</div>
    </div>
    <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;background:var(--bg2)">${r.status?.replace('_',' ')}</span>
  </div>

  <div style="background:var(--bg2);border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px">
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Site</span><span>${r.site_address}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Area</span><span>${r.total_sqft} sqft · ${r.work_type}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Material</span><span>${r.material_status?.replace('_',' ')}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Floor</span><span>${r.floor_level === 0 ? 'Ground' : r.floor_level+'st/nd/rd floor'}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="color:var(--text3)">Access</span><span>${r.site_access?.replace('_',' ')}</span></div>
    ${r.notes ? `<div style="padding:6px 0;border-top:1px solid var(--border2);margin-top:4px;color:var(--text3)">${r.notes}</div>` : ''}
  </div>

  <!-- MANAGEMENT APPROVAL -->
  ${isAdmin && r.status === 'pending_approval' ? `
  <div style="background:rgba(245,200,66,0.06);border:1px solid var(--gold-border);border-radius:10px;padding:12px;margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">⚡ Set Commission & Publish</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div>
        <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Commission Type</label>
        <select id="lr-comm-type" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:7px">
          <option value="percent">% of total</option>
          <option value="per_sqft">₹ per sqft</option>
        </select>
      </div>
      <div>
        <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Commission Value</label>
        <input type="number" id="lr-comm-val" placeholder="e.g. 25 or 5" step="0.5"
          style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;box-sizing:border-box">
      </div>
    </div>
    <div>
      <label style="font-size:10px;color:var(--text3);font-weight:700;display:block;margin-bottom:3px">Site Deposit % (min 10%, max 20%)</label>
      <input type="number" id="lr-deposit-pct" value="${r.site_deposit_pct||20}" min="10" max="20" step="1"
        style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;box-sizing:border-box">
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="VW_LABOR.publishLaborRequest(${id})" style="flex:1;padding:12px;border-radius:10px;background:var(--gold);border:none;color:#000;font-size:13px;font-weight:700;cursor:pointer">
        📢 Approve & Publish to Contractors
      </button>
      <button onclick="VW_LABOR.rejectLaborRequest(${id})" style="flex:1;padding:12px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);color:var(--red);font-size:13px;font-weight:700;cursor:pointer">
        ❌ Reject
      </button>
    </div>
  </div>` : ''}

  <!-- BIDS -->
  ${bids?.length ? `
  <div style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">📝 Bids Received (${bids.length})</div>
    ${bids.map(b => `
    <div style="background:var(--bg2);border-radius:10px;padding:10px;margin-bottom:8px;border:${b.status==='accepted'?'2px solid var(--green)':'1px solid var(--border)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px;font-weight:700">${b.contractor_name}</span>
        <span style="font-size:12px;font-weight:800;color:var(--gold)">${b.price_type==='lumpsum'?'₹'+b.lumpsum_amount+' lumpsum':'₹'+b.price_per_sqft_large+'/sqft'}</span>
      </div>
      <div style="font-size:11px;color:var(--text3)">${b.estimated_days} days · Start ${b.earliest_start_date||'TBD'}</div>
      ${b.old_tile_removal?`<div style="font-size:11px;color:var(--text3)">Demolition: ₹${b.old_tile_removal_charge||0}</div>`:''}
      ${b.notes?`<div style="font-size:11px;color:var(--text2);margin-top:3px">${b.notes}</div>`:''}
      ${r.status==='bidding' && b.status==='submitted' ? `
      <button onclick="VW_LABOR.acceptBid(${r.id},${b.id})" style="width:100%;margin-top:8px;padding:8px;border-radius:8px;background:var(--green);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
        ✅ Accept This Bid
      </button>` : ''}
    </div>`).join('')}
  </div>` : r.status === 'published' ? '<p class="empty-msg" style="text-align:center">No bids yet — notified contractors will submit soon</p>' : ''}

  <button onclick="closeSheet()" style="width:100%;padding:10px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);cursor:pointer">Close</button>`;

  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

async function publishLaborRequest(id) {
  const commType = document.getElementById('lr-comm-type')?.value || 'percent';
  const commVal  = parseFloat(document.getElementById('lr-comm-val')?.value) || 0;
  const depositPct = parseFloat(document.getElementById('lr-deposit-pct')?.value) || 20;

  if (!commVal) { showToast('Enter commission value', 'warn'); return; }
  if (depositPct < 10 || depositPct > 20) { showToast('Deposit must be 10–20%', 'warn'); return; }

  const prof = VW_AUTH.getCurrentProfile();
  const { data: r } = await VW_DB.client.from('labor_requests')
    .update({
      status: 'published',
      commission_type: commType,
      commission_value: commVal,
      site_deposit_pct: depositPct,
      management_approved_by: prof?.id,
      management_approved_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('request_no,total_sqft,customer_name,site_address')
    .single();

  // Find matching contractors and notify
  await notifyMatchingContractors(id, r);
  showToast('Published — matching contractors notified', 'success');
  closeSheet();
}

async function notifyMatchingContractors(requestId, r) {
  // Fetch active contractors with their scores
  const { data: contractors } = await VW_DB.client
    .from('contractor_profiles')
    .select('id,profile_id,name,contractor_score,service_radius_km')
    .eq('is_active', true)
    .eq('kyc_status', 'approved')
    .gte('contractor_score', 40)
    .order('contractor_score', { ascending: false });

  for (const c of contractors || []) {
    await createPersistedNotification({
      category: 'labor_bid_invite',
      title: `🏗 New Job Available — ${r.request_no}`,
      body: `${r.total_sqft} sqft · ${r.customer_name} · ${r.site_address}`,
      recipientId: c.profile_id,
      relatedTable: 'labor_requests',
      relatedId: requestId,
      actions: [{ label: '📝 View & Bid', action: 'open_labor_bid' }],
    }).catch(() => {});
  }
}

async function acceptBid(requestId, bidId) {
  const { data: bid } = await VW_DB.client.from('contractor_bids').select('*').eq('id', bidId).single();
  const { data: req } = await VW_DB.client.from('labor_requests').select('*').eq('id', requestId).single();
  if (!bid || !req) return;

  // Create labor job
  const { data: job } = await VW_DB.client.from('labor_jobs').insert({
    request_id: requestId,
    bid_id: bidId,
    contractor_profile_id: bid.contractor_profile_id,
    contractor_name: bid.contractor_name,
    customer_name: req.customer_name,
    customer_phone: req.customer_phone,
    site_address: req.site_address,
    total_sqft: req.total_sqft,
    agreed_rate_type: bid.price_type,
    agreed_price_small: bid.price_per_sqft_small,
    agreed_price_medium: bid.price_per_sqft_medium,
    agreed_price_large: bid.price_per_sqft_large,
    agreed_lumpsum: bid.lumpsum_amount,
    estimated_days: bid.estimated_days,
    start_date: bid.earliest_start_date,
    expected_end_date: bid.earliest_start_date
      ? new Date(new Date(bid.earliest_start_date).getTime() + (bid.estimated_days||7)*86400000).toISOString().split('T')[0]
      : null,
    status: 'not_started',
  }).select('id,job_no').single();

  // Update request + bid status
  await VW_DB.client.from('labor_requests').update({ status: 'accepted' }).eq('id', requestId);
  await VW_DB.client.from('contractor_bids').update({ status: 'accepted' }).eq('id', bidId);
  await VW_DB.client.from('contractor_bids').update({ status: 'rejected' }).eq('request_id', requestId).neq('id', bidId);

  // Notify contractor — now share customer address + phone
  await createPersistedNotification({
    category: 'bid_accepted',
    title: `✅ Your bid was accepted — ${job.job_no}`,
    body: `${req.customer_name} · ${req.customer_phone} · ${req.site_address}`,
    recipientId: bid.contractor_profile_id,
    relatedTable: 'labor_jobs',
    relatedId: job.id,
    actions: [{ label: '👁 View Job', action: 'open_labor_job' }],
  }).catch(() => {});

  showToast(`Bid accepted — ${job.job_no} created`, 'success');
  closeSheet();
}

async function rejectLaborRequest(id) {
  const reason = prompt('Reason for rejection?');
  if (!reason) return;
  await VW_DB.client.from('labor_requests').update({ status: 'cancelled' }).eq('id', id);
  showToast('Request rejected', 'warn');
  closeSheet();
}

// Expose
window.VW_LABOR = {
  renderCreateLaborRequest,
  submitLaborRequest,
  renderLaborRequestList,
  openLaborRequest,
  publishLaborRequest,
  acceptBid,
  rejectLaborRequest,
};


// ═══════════════════════════════════════════════════════════════
// WHATSAPP FOLLOW-UP AUTOMATION
// ═══════════════════════════════════════════════════════════════

const WA_FOLLOW_UP_TEMPLATES = {
  draft: {
    label: 'Quote Ready',
    message: (name, tqNo) =>
      `Hi ${name}, your tile quotation ${tqNo} from V Wholesale is ready! We'd love to help you finalize your selection. Can we schedule a visit or call? 📞 8712697930`,
  },
  approved: {
    label: 'Follow Up After Approval',
    message: (name, tqNo, price) =>
      `Hi ${name}, just checking in on your tile quotation ${tqNo}${price ? ` (₹${parseInt(price).toLocaleString('en-IN')})` : ''}. Have you had a chance to review? We can arrange a sample display or home visit if helpful. 🏠`,
  },
  advance_collected: {
    label: 'Delivery Reminder',
    message: (name, tqNo) =>
      `Hi ${name}, thank you for confirming order ${tqNo} with V Wholesale! Our team will coordinate delivery/pickup timing with you. Please let us know your preferred schedule. 🚚`,
  },
  no_response: {
    label: '3-Day No Response',
    message: (name) =>
      `Hi ${name}, hope your home project is going well! V Wholesale here — we wanted to check if you need any assistance with your tile or building material requirements. We're here to help! 😊`,
  },
};

async function renderFollowUpDashboard() {
  // Fetch TQs that need follow-up (approved but no advance, or draft more than 2 days old)
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

  const { data: needsFollowUp } = await VW_DB.client
    .from('tile_quotations')
    .select('id,tq_no,customer_name,customer_phone,approval_status,grand_total,created_at,updated_at')
    .in('approval_status', ['draft','approved'])
    .lt('updated_at', twoDaysAgo)
    .order('updated_at', { ascending: true })
    .limit(30);

  return `
  <div class="module-header">
    <h2>💬 WA Follow-ups</h2>
    <div style="font-size:11px;color:var(--text3)">${needsFollowUp?.length||0} need attention</div>
  </div>

  ${!(needsFollowUp?.length) ? `
  <div style="text-align:center;padding:30px;color:var(--text3)">
    <div style="font-size:32px">✅</div>
    <div style="font-size:13px;margin-top:8px">All caught up! No follow-ups needed.</div>
  </div>` :
  needsFollowUp.map(q => {
    const daysSince = Math.floor((Date.now() - new Date(q.updated_at)) / 86400000);
    const urgency = daysSince > 7 ? 'var(--red)' : daysSince > 3 ? 'var(--gold)' : 'var(--text3)';
    const tmpl = WA_FOLLOW_UP_TEMPLATES[q.approval_status] || WA_FOLLOW_UP_TEMPLATES.no_response;
    const message = tmpl.message(q.customer_name?.split(' ')[0] || q.customer_name, q.tq_no, q.grand_total);
    const waUrl = `https://wa.me/91${q.customer_phone}?text=${encodeURIComponent(message)}`;

    return `
    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:10px;border-left:4px solid ${urgency}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:700">${q.customer_name}</div>
          <div style="font-size:11px;color:var(--text3)">${q.tq_no} · ${q.approval_status}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:700;color:${urgency}">${daysSince}d ago</div>
          ${q.grand_total ? `<div style="font-size:11px;color:var(--gold)">₹${parseInt(q.grand_total).toLocaleString('en-IN')}</div>` : ''}
        </div>
      </div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px;line-height:1.5;background:var(--bg3);border-radius:8px;padding:8px">
        ${message.slice(0, 120)}...
      </div>
      <div style="display:flex;gap:6px">
        <a href="${waUrl}" target="_blank"
          style="flex:2;padding:9px;border-radius:8px;background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25d366;font-size:12px;font-weight:700;text-decoration:none;text-align:center">
          💬 Send on WhatsApp
        </a>
        <button onclick="VW_TILES.openTileQuote(${q.id})"
          style="flex:1;padding:9px;border-radius:8px;background:var(--bg3);border:1px solid var(--border);font-size:12px;cursor:pointer">
          👁 View TQ
        </button>
      </div>
    </div>`;
  }).join('')}`;
}

window.VW_FEATURES = window.VW_FEATURES || {};
window.VW_FEATURES.renderFollowUpDashboard = renderFollowUpDashboard;
window.renderFollowUpDashboard = renderFollowUpDashboard;

// ═══════════════════════════════════════════════════════════════
// CUSTOMER STATEMENT OF ACCOUNT
// ═══════════════════════════════════════════════════════════════

async function renderCustomerStatement(customerId) {
  if (!customerId) {
    // Show search first
    return `
    <div class="module-header"><h2>📄 Statement of Account</h2></div>
    <div class="card">
      <h3 class="card-title">Find Customer</h3>
      <div class="form-group">
        <label>Search by Name or Phone</label>
        <input type="text" id="stmt-search" placeholder="Type name or phone..."
          oninput="VW_FEATURES.searchStatementCustomer(this.value)">
      </div>
      <div id="stmt-search-results"></div>
    </div>`;
  }

  const { data: cust } = await VW_DB.client.from('customers')
    .select('*').eq('id', customerId).single().then(r=>r, ()=>({data:null}));
  if (!cust) return '<div class="empty-msg">Customer not found</div>';

  // Fetch all TQs for this customer
  const { data: tqs } = await VW_DB.client.from('tile_quotations')
    .select('tq_no,created_at,approval_status,grand_total,advance_amount,quoted_price_per_sqft,total_area_sqft')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch all invoices
  const { data: invs } = await VW_DB.client.from('invoices')
    .select('invoice_no,date,total,amount_received,payment_method,credit_sale')
    .eq('customer_id', customerId)
    .order('date', { ascending: false })
    .limit(20).then(r=>r, ()=>({data:[]}));

  const totalInvoiced = (invs||[]).reduce((s,i) => s + (i.total||0), 0);
  const totalReceived = (invs||[]).reduce((s,i) => s + (i.amount_received||i.total||0), 0);
  const totalAdvance  = (tqs||[]).reduce((s,q) => s + (q.advance_amount||0), 0);
  const outstanding   = Math.max(0, totalInvoiced - totalReceived);
  const loyaltyPoints = cust.loyalty_points || 0;

  return `
  <div class="module-header">
    <h2>📄 Statement</h2>
    <button onclick="printCustomerStatement(${customerId})" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer">🖨 Print</button>
  </div>

  <!-- CUSTOMER HEADER -->
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:14px;padding:16px;margin-bottom:14px;color:#fff">
    <div style="font-size:18px;font-weight:900">${cust.name}</div>
    <div style="font-size:12px;opacity:0.7;margin-bottom:10px">${cust.phone || '—'} · ${cust.city || 'Vijayawada'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
      <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:8px">
        <div style="font-size:16px;font-weight:900;color:#f5c842">₹${totalInvoiced.toLocaleString('en-IN')}</div>
        <div style="font-size:9px;opacity:0.7">Total Billed</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:8px">
        <div style="font-size:16px;font-weight:900;color:${outstanding>0?'#ef4444':'#4ade80'}">₹${outstanding.toLocaleString('en-IN')}</div>
        <div style="font-size:9px;opacity:0.7">Outstanding</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:8px">
        <div style="font-size:16px;font-weight:900;color:#f5c842">${loyaltyPoints}</div>
        <div style="font-size:9px;opacity:0.7">Loyalty Pts</div>
      </div>
    </div>
  </div>

  <!-- TQ HISTORY -->
  ${tqs?.length ? `
  <div style="font-size:12px;font-weight:700;margin-bottom:8px">📐 Tile Quotations (${tqs.length})</div>
  ${tqs.map(q => `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:6px;font-size:11px">
    <div>
      <span style="font-weight:700">${q.tq_no}</span>
      <span style="color:var(--text3);margin-left:6px">${new Date(q.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
      <div style="color:var(--text3)">${parseFloat(q.total_area_sqft||0).toFixed(0)} sqft${q.quoted_price_per_sqft?` · ₹${q.quoted_price_per_sqft}/sqft`:''}</div>
    </div>
    <div style="text-align:right">
      ${q.grand_total ? `<div style="font-weight:700;color:var(--gold)">₹${parseInt(q.grand_total).toLocaleString('en-IN')}</div>` : ''}
      ${q.advance_amount ? `<div style="color:var(--green);font-size:10px">Adv: ₹${q.advance_amount.toLocaleString('en-IN')}</div>` : ''}
      <span style="font-size:10px;padding:2px 6px;border-radius:10px;background:var(--bg3)">${q.approval_status?.replace('_',' ')}</span>
    </div>
  </div>`).join('')}` : ''}

  <!-- INVOICE HISTORY -->
  ${invs?.length ? `
  <div style="font-size:12px;font-weight:700;margin:12px 0 8px">🧾 Invoices (${invs.length})</div>
  ${invs.map(inv => `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:6px;font-size:11px">
    <div>
      <span style="font-weight:700">${inv.invoice_no}</span>
      <div style="color:var(--text3)">${new Date(inv.date).toLocaleDateString('en-IN')} · ${inv.payment_method}</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">₹${(inv.total||0).toLocaleString('en-IN')}</div>
      ${inv.credit_sale ? `<div style="color:var(--red);font-size:10px">Credit Sale</div>` : ''}
    </div>
  </div>`).join('')}` : '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">No invoices yet</div>'}

  <!-- OUTSTANDING ALERT -->
  ${outstanding > 0 ? `
  <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;margin-top:8px">
    <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:4px">⚠️ Outstanding Balance</div>
    <div style="font-size:20px;font-weight:900;color:var(--red)">₹${outstanding.toLocaleString('en-IN')}</div>
    <a href="https://wa.me/91${cust.phone}?text=${encodeURIComponent('Hi ' + cust.name.split(' ')[0] + ', this is V Wholesale. Your account has an outstanding balance of ₹' + outstanding.toLocaleString('en-IN') + '. Please arrange payment at your earliest convenience. Thank you!')}"
      target="_blank" style="display:block;margin-top:8px;padding:8px;border-radius:8px;background:#25D366;color:#fff;text-align:center;font-size:12px;font-weight:700;text-decoration:none">
      💬 Send WhatsApp Reminder
    </a>
  </div>` : ''}`;
}

async function searchStatementCustomer(query) {
  const el = document.getElementById('stmt-search-results');
  if (!el || !query || query.length < 2) return;

  const { data } = await VW_DB.client.from('customers')
    .select('id,name,phone,city')
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(5);

  el.innerHTML = (data||[]).map(c => `
  <div onclick="navigateTo('statement',{id:${c.id}})"
    style="padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:6px;cursor:pointer;border:1px solid var(--border)">
    <div style="font-size:13px;font-weight:700">${c.name}</div>
    <div style="font-size:11px;color:var(--text3)">${c.phone || '—'} · ${c.city || 'Vijayawada'}</div>
  </div>`).join('') || '<div style="font-size:12px;color:var(--text3)">No customers found</div>';
}

async function printCustomerStatement(customerId) {
  // Open printable version
  const win = window.open('', '_blank');
  win.document.write('<html><head><title>Statement</title><style>body{font-family:Arial;margin:20px;font-size:12px}@media print{.no-print{display:none}}</style></head><body>');
  win.document.write('<h2>V Wholesale — Statement of Account</h2>');
  win.document.write('<p>Loading...</p>');
  const _ps = win.document.createElement('script');
  _ps.textContent = 'window.onload = function(){ window.print(); }';
  win.document.head.appendChild(_ps);
  win.document.write('</body></html>');
  win.document.close();
}

window.VW_FEATURES = window.VW_FEATURES || {};
window.VW_FEATURES.renderCustomerStatement = renderCustomerStatement;
window.VW_FEATURES.searchStatementCustomer = searchStatementCustomer;
window.renderCustomerStatement = renderCustomerStatement;

// ── Wallet: load more transactions (was missing) ──
async function loadMoreWalletTxns(walletId) {
  try {
    const offset = window._walletTxnOffset || 10;
    const { data: txns } = await VW_DB.client
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .range(offset, offset + 9);
    if (!txns || !txns.length) { showToast('No more transactions'); return; }
    window._walletTxnOffset = offset + txns.length;
    const list = document.querySelector('#wallet-txn-list') || document.querySelector('[data-wallet-txns]');
    if (list) {
      list.insertAdjacentHTML('beforeend', txns.map(t => `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
          <div><div style="font-size:13px;font-weight:600">${t.description || t.type}</div>
          <div style="font-size:11px;color:var(--text3)">${new Date(t.created_at).toLocaleDateString('en-IN')}</div></div>
          <div style="font-size:14px;font-weight:800;color:${t.amount >= 0 ? 'var(--green)' : 'var(--red)'}">${t.amount >= 0 ? '+' : ''}₹${Math.abs(t.amount).toLocaleString('en-IN')}</div>
        </div>`).join(''));
    }
  } catch(e) { showToast('Failed to load transactions', 'error'); }
}
window.loadMoreWalletTxns = loadMoreWalletTxns;

// ── Wallet: KYC upload (was missing) ──
function showKYCUpload(walletId) {
  openSheet('kyc-upload', `
    <div class="sheet-handle"></div>
    <h3 style="font-size:16px;font-weight:900;margin-bottom:6px">KYC Documents</h3>
    <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Required for wallet balance above ₹10,000 (RBI guidelines)</div>
    <div style="display:grid;gap:10px">
      <label style="display:block;padding:14px;border:1.5px dashed var(--border);border-radius:10px;text-align:center;cursor:pointer;font-size:13px">
        📄 Upload Aadhaar (front & back)
        <input type="file" accept="image/*,.pdf" multiple style="display:none" onchange="handleKYCFile(this, ${walletId}, 'aadhaar')">
      </label>
      <label style="display:block;padding:14px;border:1.5px dashed var(--border);border-radius:10px;text-align:center;cursor:pointer;font-size:13px">
        🪪 Upload PAN Card
        <input type="file" accept="image/*,.pdf" style="display:none" onchange="handleKYCFile(this, ${walletId}, 'pan')">
      </label>
    </div>
    <div id="kyc-status" style="margin-top:12px;font-size:12px;color:var(--text3)"></div>
    <button onclick="closeSheet()" style="width:100%;margin-top:16px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Done</button>
  `);
}
window.showKYCUpload = showKYCUpload;

async function handleKYCFile(input, walletId, docType) {
  const status = document.getElementById('kyc-status');
  if (!input.files?.length) return;
  if (status) status.textContent = 'Uploading...';
  try {
    for (const file of input.files) {
      const path = `kyc/${walletId}/${docType}_${Date.now()}_${file.name}`;
      const { error } = await VW_DB.client.storage.from('documents').upload(path, file);
      if (error) throw error;
    }
    await VW_DB.client.from('customer_wallets').update({ kyc_status: 'submitted' }).eq('id', walletId);
    if (status) status.innerHTML = '<span style="color:var(--green)">✅ Uploaded. Under review (1-2 days).</span>';
    showToast('KYC documents uploaded', 'success');
  } catch(e) {
    if (status) status.innerHTML = '<span style="color:var(--red)">Upload failed. Try again or visit store.</span>';
  }
}
window.handleKYCFile = handleKYCFile;

// ════════════════════════════════════════════════════════════
// DAILY POSTS FEED — Staff Portal
// All staff see today's content. CRM/Sales can share.
// ════════════════════════════════════════════════════════════
async function renderDailyFeed() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const role = VW_AUTH?.getRole?.() || '';
  const profile = VW_AUTH?.getCurrentProfile?.() || {};
  const canShare = ['admin','owner','manager','sales_head','sales_executive','executive',
                    'sr_sales','sr_executive','tl','asm','crm','store_manager','floor_manager'].includes(role);

  main.innerHTML = `
  <div class="page-header" style="margin-bottom:16px">
    <h2 style="font-size:18px;font-weight:900;margin:0">📢 Today's Posts</h2>
    <p style="font-size:12px;color:var(--text3);margin:4px 0 0">Content created by marketing team for you to share</p>
  </div>
  <div id="feed-tabs" style="display:flex;gap:0;margin-bottom:16px;background:var(--bg2);border-radius:10px;padding:4px;border:1px solid var(--border)">
    <button onclick="loadStaffFeedTab('today',this)" style="flex:1;padding:8px;border:none;background:var(--accent);color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📅 Today</button>
    <button onclick="loadStaffFeedTab('week',this)" style="flex:1;padding:8px;border:none;background:none;color:var(--text2);border-radius:8px;font-size:12px;cursor:pointer">📆 This Week</button>
    <button onclick="loadStaffFeedTab('all',this)" style="flex:1;padding:8px;border:none;background:none;color:var(--text2);border-radius:8px;font-size:12px;cursor:pointer">📋 All</button>
  </div>
  <div id="staff-feed-list" style="display:grid;gap:12px"></div>`;

  await loadStaffFeedTab('today');
}

window.renderDailyFeed = renderDailyFeed;

async function loadStaffFeedTab(tab, btn) {
  // Update tab styles
  if (btn) {
    document.querySelectorAll('#feed-tabs button').forEach(b => {
      b.style.background = 'none';
      b.style.color = 'var(--text2)';
      b.style.fontWeight = '400';
    });
    btn.style.background = 'var(--accent)';
    btn.style.color = '#fff';
    btn.style.fontWeight = '700';
  }

  const el = document.getElementById('staff-feed-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3)">⏳ Loading…</div>';

  const today = new Date().toISOString().split('T')[0];
  let from = today;
  if (tab === 'week') from = new Date(Date.now()-6*86400000).toISOString().split('T')[0];
  if (tab === 'all') from = '2026-01-01';

  const { data: posts } = await VW_DB.client.from('daily_posts_feed')
    .select('*').eq('status','active').gte('post_date', from)
    .order('post_date',{ascending:false}).order('created_at',{ascending:false})
    .then(r=>r, ()=>({data:[]}));

  const role = VW_AUTH?.getRole?.() || '';
  const profile = VW_AUTH?.getCurrentProfile?.() || {};
  const canShare = ['admin','owner','manager','sales_head','sales_executive','executive',
                    'sr_sales','sr_executive','tl','asm','crm','store_manager','floor_manager'].includes(role);

  if (!(posts||[]).length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;background:var(--bg2);border-radius:12px;border:1px solid var(--border)">
      <div style="font-size:48px;margin-bottom:12px">📢</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">No posts yet${tab==='today'?' for today':''}</div>
      <div style="font-size:12px;color:var(--text3)">Marketing team will push content here. Check back soon.</div>
    </div>`;
    return;
  }

  el.innerHTML = (posts||[]).map(p => {
    const isToday = p.post_date === today;
    const typeIcon = {offer:'💰',wish:'🎉',product:'📦',announcement:'📣',post:'📝'}[p.post_type]||'📝';
    const waText = encodeURIComponent((p.caption||p.title||'') + '\n\n— V Wholesale, Vijayawada\n📞 8712697930 | 🌐 vwholesale.in');

    return `<div style="background:var(--bg2);border:1px solid ${isToday?'var(--accent)':'var(--border)'};border-radius:14px;overflow:hidden">
      ${isToday ? '<div style="background:var(--accent);color:#fff;font-size:10px;font-weight:700;padding:4px 14px;text-align:center">TODAY\'S POST</div>' : ''}
      ${p.image_url ? `<div style="aspect-ratio:1;overflow:hidden;max-height:320px"><img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover"></div>` : ''}
      <div style="padding:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:20px">${typeIcon}</span>
          <div>
            <div style="font-size:14px;font-weight:800">${p.title}</div>
            <div style="font-size:11px;color:var(--text3)">${new Date(p.post_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})} · ${(p.platforms||[]).join(', ')||'All platforms'}</div>
          </div>
        </div>
        ${p.caption ? `<div style="background:var(--bg3);border-radius:8px;padding:10px;font-size:12px;line-height:1.7;white-space:pre-wrap;margin-bottom:10px;max-height:120px;overflow-y:auto">${p.caption}</div>` : ''}

        ${canShare ? `
        <div style="display:grid;gap:8px">
          <div style="font-size:11px;font-weight:700;color:var(--text3)">📤 SHARE THIS POST</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${p.caption ? `<button onclick="copyFeedCaption('${(p.caption||'').replace(/'/g,"\\'").replace(/\n/g,'\\n').slice(0,200)}')" style="flex:1;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;color:var(--text1)">📋 Copy Caption</button>` : ''}
            ${p.image_url ? `<button onclick="window.open('${p.image_url}','_blank')" style="flex:1;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;color:var(--text1)">⬇ Save Image</button>` : ''}
          </div>
          <a href="https://wa.me/?text=${waText}" target="_blank" style="display:block;padding:12px;background:#25D366;border-radius:8px;text-align:center;color:#fff;font-size:13px;font-weight:700;text-decoration:none" onclick="trackFeedShare(${p.id},'${profile.name||role}','whatsapp')">
            💬 Share as WhatsApp Status
          </a>
        </div>` : `
        <div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;font-size:12px;color:var(--text3)">
          📌 Sharing available for CRM & Sales team only
        </div>`}
      </div>
    </div>`;
  }).join('');
}

window.loadStaffFeedTab = loadStaffFeedTab;

function copyFeedCaption(text) {
  navigator.clipboard.writeText(text.replace(/\\n/g,'\n')).then(()=>{
    showToast('📋 Caption copied! Now open Instagram and paste.', 'success');
  });
}
window.copyFeedCaption = copyFeedCaption;

async function trackFeedShare(feedId, staffName, platform) {
  await VW_DB.client.from('post_shares').insert({
    feed_id: feedId, staff_name: staffName, platform
  });
  // Increment shared count
  await VW_DB.client.rpc('increment_share_count', {feed_id: feedId}).then(()=>{},()=>{});
}
window.trackFeedShare = trackFeedShare;
