// ── STRATEGY SESSION — V Wholesale ──
// Rebuilt: BI snapshot first → AI asks questions → fortnightly calendar generated
// Separate file to avoid marketing-1.js truncation risk

const SS = {
  snapshot: null,       // BI data
  answers: {},          // user answers to questions
  questions: [],        // AI-generated questions
  currentQ: 0,          // which question we're on
  plan: null,           // generated calendar plan
  overlay: null
};

// ── ENTRY POINT ──
async function openStrategySession() {
  // Build overlay
  const ov = document.createElement('div');
  ov.id = 'strategy-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.92);z-index:99999;overflow-y:auto;padding:16px;';
  ov.innerHTML = `
    <div style="max-width:600px;margin:0 auto;background:var(--bg2);border-radius:16px;border:1px solid var(--border);overflow:hidden">
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:17px;font-weight:900;color:#fff">🧠 Strategy Session</div>
          <div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:2px">Fortnightly planning — AI + your judgement</div>
        </div>
        <button onclick="closeStrategySession()" style="background:rgba(255,255,255,.1);border:none;color:#fff;font-size:18px;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center">✕</button>
      </div>
      <div id="ss-body" style="padding:20px">
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:36px;margin-bottom:12px">📊</div>
          <div style="font-size:14px;font-weight:700;margin-bottom:6px">Loading your business intelligence…</div>
          <div style="font-size:12px;color:var(--text3)">Pulling revenue, pipeline, stock and field data</div>
          <div style="margin-top:16px;display:flex;justify-content:center;gap:6px">
            <div style="width:8px;height:8px;background:var(--gold);border-radius:50%;animation:pulse 1s infinite"></div>
            <div style="width:8px;height:8px;background:var(--gold);border-radius:50%;animation:pulse 1s infinite .2s"></div>
            <div style="width:8px;height:8px;background:var(--gold);border-radius:50%;animation:pulse 1s infinite .4s"></div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  SS.overlay = ov;

  // Fetch BI snapshot
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/business-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY }
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'BI fetch failed');
    SS.snapshot = data.snapshot;
    renderSSBriefing();
  } catch (e) {
    document.getElementById('ss-body').innerHTML = `
      <div style="text-align:center;padding:30px;color:var(--red)">
        <div style="font-size:24px;margin-bottom:8px">⚠️</div>
        <div style="font-weight:700">Could not load business data</div>
        <div style="font-size:12px;margin-top:4px;color:var(--text3)">${e.message}</div>
        <button onclick="closeStrategySession()" class="mkt-btn mkt-btn-ghost" style="margin-top:16px">Close</button>
      </div>`;
  }
}

function closeStrategySession() {
  document.getElementById('strategy-overlay')?.remove();
  SS.snapshot = null; SS.answers = {}; SS.questions = []; SS.currentQ = 0; SS.plan = null;
}

// ── STAGE 1: BI BRIEFING ──
function renderSSBriefing() {
  const s = SS.snapshot;
  if (!s) return;

  const momArrow = s.revenue.mom_change_pct >= 0 ? '↑' : '↓';
  const momColor = s.revenue.mom_change_pct >= 0 ? '#22c55e' : '#ef4444';

  // Find the biggest pipeline opportunity
  const hotStage = s.hot_leads?.[0];
  const slowPush = s.content_signals?.push_categories?.slice(0,2).join(', ') || 'None';

  // Field visit stage distribution
  const fieldStages = s.field_intelligence?.by_stage || {};
  const topFieldStage = Object.entries(fieldStages).sort((a,b)=>b[1]-a[1])[0];

  document.getElementById('ss-body').innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:900;color:var(--gold);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">📊 Your Business Right Now</div>

      <!-- Revenue -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="background:var(--bg3);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:18px;font-weight:900;color:var(--gold)">₹${s.revenue.this_month_lakhs}L</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">This month</div>
        </div>
        <div style="background:var(--bg3);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:18px;font-weight:900;color:var(--text2)">₹${s.revenue.last_month_lakhs}L</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">Last month</div>
        </div>
        <div style="background:var(--bg3);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:18px;font-weight:900;color:${momColor}">${momArrow}${Math.abs(s.revenue.mom_change_pct)}%</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">vs last month</div>
        </div>
      </div>

      <!-- Pipeline highlight -->
      ${hotStage ? `
      <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:4px">🔥 Biggest immediate opportunity</div>
        <div style="font-size:12px;color:var(--text1)">${hotStage.reachable} reachable customers at <b>${hotStage.stage.replace(/_/g,' ')}</b> stage → ready to buy <b>${hotStage.next_buy}</b></div>
      </div>` : ''}

      <!-- Top vs Slow -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="background:var(--bg3);border-radius:10px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:#22c55e;margin-bottom:6px">🏆 TOP SELLERS</div>
          ${(s.top_categories||[]).slice(0,4).map(c=>`
          <div style="font-size:11px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border)">
            ${c.category} <span style="color:var(--gold);float:right">₹${c.revenue_lakhs}L</span>
          </div>`).join('')}
        </div>
        <div style="background:var(--bg3);border-radius:10px;padding:10px">
          <div style="font-size:10px;font-weight:700;color:#f59e0b;margin-bottom:6px">⚠️ NEEDS PUSH</div>
          ${(s.slow_movers||[]).slice(0,4).map(c=>`
          <div style="font-size:11px;color:var(--text2);padding:3px 0;border-bottom:1px solid var(--border)">${c}</div>`).join('')}
        </div>
      </div>

      <!-- Field intelligence -->
      ${topFieldStage ? `
      <div style="background:var(--bg3);border-radius:10px;padding:10px;margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:#3b82f6;margin-bottom:4px">🏗️ FIELD INTELLIGENCE (${s.field_intelligence.total_visits.toLocaleString()} site visits)</div>
        <div style="font-size:11px;color:var(--text2)">Largest group: <b>${topFieldStage[0].replace(/_/g,' ')}</b> — ${topFieldStage[1]} sites</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${s.field_intelligence.valid_phone.toLocaleString()} sites with valid contact</div>
      </div>` : ''}

      <!-- Customer pipeline summary -->
      <div style="background:var(--bg3);border-radius:10px;padding:10px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">👥 CUSTOMER PIPELINE</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${(s.customer_pipeline||[]).filter(p=>p.reachable>0).map(p=>`
          <div style="background:var(--bg2);border-radius:6px;padding:4px 8px;text-align:center">
            <div style="font-size:13px;font-weight:700;color:var(--gold)">${p.reachable}</div>
            <div style="font-size:9px;color:var(--text3)">${p.stage.replace(/_/g,' ')}</div>
          </div>`).join('')}
        </div>
      </div>

      <div style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.7">
        Now I'll ask you <b style="color:var(--text1)">10 questions</b> to build the best fortnightly content plan. Takes about 3 minutes.
      </div>

      <button onclick="startSSQuestions()" class="mkt-btn mkt-btn-primary" style="width:100%;padding:14px;font-size:14px;font-weight:900">
        🧠 Start — Ask Me Questions
      </button>
    </div>`;
}

// ── STAGE 2: Q&A ──
async function startSSQuestions() {
  document.getElementById('ss-body').innerHTML = `
    <div style="text-align:center;padding:30px;color:var(--text3)">
      <div style="font-size:28px;margin-bottom:8px">🤔</div>
      <div style="font-size:13px">Generating questions based on your data…</div>
    </div>`;

  const s = SS.snapshot;

  // Generate questions using AI based on BI data
  try {
    const res = await fetch(MKT_SB_URL + '/functions/v1/marketing-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        action: 'generate_questions',
        agent: 'Strategy Session',
        prompt: `You are a sharp marketing strategist for V Wholesale, a home building materials store in Vijayawada, Andhra Pradesh.

Based on the business data provided, generate exactly 10 questions to ask the owner before planning a fortnightly content calendar.

Rules:
- Questions must be SPECIFIC to the data — reference actual numbers, categories, stages
- Mix of yes/no, multiple choice, and open-ended
- Cover: current priorities, upcoming events, stock to push, customer focus, competitor moves, content preferences
- Each question must have 2-4 suggested answer options PLUS a free-text option
- Questions should be conversational, not corporate
- Telugu market context: festivals, monsoon season, construction cycles

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "question text referencing actual data",
      "type": "choice",
      "options": ["option 1", "option 2", "option 3", "Other (type below)"],
      "allow_custom": true
    }
  ]
}`,
        context: {
          revenue_this_month: s.revenue.this_month_lakhs,
          revenue_last_month: s.revenue.last_month_lakhs,
          mom_change: s.revenue.mom_change_pct,
          top_categories: s.top_categories?.slice(0,5).map(c=>c.category),
          slow_movers: s.slow_movers?.slice(0,4),
          hot_leads: s.hot_leads?.slice(0,3),
          field_visits_total: s.field_intelligence?.total_visits,
          field_top_stage: Object.entries(s.field_intelligence?.by_stage||{}).sort((a,b)=>b[1]-a[1])[0]?.[0],
          competitors: s.competitors,
          content_signals: s.content_signals,
          customer_pipeline: s.customer_pipeline,
          fortnight_start: new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long'}),
          city: 'Vijayawada',
          season: 'Monsoon (July-September)'
        }
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    SS.questions = data.output?.questions || [];
    if (!SS.questions.length) throw new Error('No questions generated');
    SS.currentQ = 0;
    SS.answers = {};
    renderSSQuestion();

  } catch (e) {
    // Fallback to hardcoded questions if AI fails
    SS.questions = getFallbackQuestions(s);
    SS.currentQ = 0;
    SS.answers = {};
    renderSSQuestion();
  }
}

function getFallbackQuestions(s) {
  const topCat = s.top_categories?.[0]?.category || 'Tiles';
  const slowCat = s.slow_movers?.[0] || 'Furniture';
  const hotStage = s.hot_leads?.[0];
  return [
    { id:'q1', question:`Revenue ${s.revenue.mom_change_pct < 0 ? 'dropped' : 'grew'} ${Math.abs(s.revenue.mom_change_pct)}% vs last month. What's your main focus this fortnight?`, type:'choice', options:['Push footfall to store','Target contractors specifically','Push a specific product category','Run an offer or promotion'], allow_custom:true },
    { id:'q2', question:`${topCat} is your top seller. Any new stock or designs to feature this fortnight?`, type:'choice', options:['Yes — new arrivals to show','Yes — old stock to liquidate','No new stock, push existing range','Skip tiles this fortnight'], allow_custom:true },
    { id:'q3', question:`${slowCat} is barely moving — ₹${s.slow_movers_revenue || 'low'} last year. What should we do?`, type:'choice', options:['Push it with content — it needs visibility','Price is the issue — run an offer','Don\'t stock it — skip from content','Feature it once and see response'], allow_custom:true },
    { id:'q4', question: hotStage ? `${hotStage.reachable} customers are at ${hotStage.stage.replace(/_/g,' ')} stage and ready to buy ${hotStage.next_buy}. Should we run a WhatsApp campaign targeting them?` : 'Should we run a targeted WhatsApp campaign for specific customer segments this fortnight?', type:'choice', options:['Yes — send to them this week','Yes — but wait till next week','No — focus on social only','Let me decide after seeing the plan'], allow_custom:false },
    { id:'q5', question:'Any festivals or local events in the next 15 days we should post about?', type:'choice', options:['Ganesh Chaturthi (Aug 18)','Independence Day (Aug 15)','Raksha Bandhan (Aug 1)','No festivals — keep it product-focused'], allow_custom:true },
    { id:'q6', question:'Which audience should get the most content attention this fortnight?', type:'choice', options:['Homeowners building new homes','Contractors and mestris','Architects and interior designers','All equally'], allow_custom:false },
    { id:'q7', question:'We have 6,012 field visit records. Should the reels show real site visits and project transformations?', type:'choice', options:['Yes — real projects, real people','Yes — but keep faces off camera','No — product showcase only','Mix of both'], allow_custom:false },
    { id:'q8', question:'What tone should the content have this fortnight?', type:'choice', options:['Educational — teach homeowners','Promotional — show offers and products','Inspirational — beautiful home transformations','Trust-building — show expertise and team'], allow_custom:false },
    { id:'q9', question:'Any competitors (Tilesmart, Nataraj Electricals) doing anything we should counter or match?', type:'choice', options:['Yes — they\'re running offers (tell me below)','Yes — they\'re posting more content','No — focus on our own story','I haven\'t checked recently'], allow_custom:true },
    { id:'q10', question:'One thing you want every customer to know about V Wholesale after this fortnight?', type:'text', options:[], allow_custom:true }
  ];
}

function renderSSQuestion() {
  const q = SS.questions[SS.currentQ];
  if (!q) { renderSSPlanGeneration(); return; }

  const progress = Math.round(((SS.currentQ) / SS.questions.length) * 100);

  document.getElementById('ss-body').innerHTML = `
    <!-- Progress -->
    <div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:11px;color:var(--text3)">Question ${SS.currentQ + 1} of ${SS.questions.length}</div>
        <div style="font-size:11px;color:var(--gold)">${progress}% done</div>
      </div>
      <div style="height:4px;background:var(--bg3);border-radius:2px">
        <div style="height:4px;background:var(--gold);border-radius:2px;width:${progress}%;transition:width .3s"></div>
      </div>
    </div>

    <!-- Question -->
    <div style="background:var(--bg3);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;line-height:1.6;color:var(--text1)">${q.question}</div>
    </div>

    <!-- Answer options -->
    <div id="ss-options" style="display:grid;gap:8px;margin-bottom:12px">
      ${(q.options||[]).map((opt,i) => `
      <button onclick="ssSelectOption(this,'${opt.replace(/'/g,"\\'")}','${q.id}')"
        class="ss-opt-btn"
        style="text-align:left;padding:12px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text1);font-size:13px;cursor:pointer;transition:all .15s;width:100%">
        ${opt}
      </button>`).join('')}
    </div>

    ${q.allow_custom || q.type === 'text' ? `
    <div style="margin-bottom:16px">
      <textarea id="ss-custom-answer" class="mkt-form-input" rows="2"
        placeholder="${q.type === 'text' ? 'Your answer…' : 'Or type your own answer…'}"
        style="font-size:13px"></textarea>
    </div>` : ''}

    <div style="display:flex;gap:8px">
      ${SS.currentQ > 0 ? `<button onclick="ssPrevQuestion()" class="mkt-btn mkt-btn-ghost" style="padding:10px 16px">← Back</button>` : ''}
      <button onclick="ssNextQuestion('${q.id}')" class="mkt-btn mkt-btn-primary" style="flex:1;padding:12px;font-weight:700">
        ${SS.currentQ === SS.questions.length - 1 ? '✅ Done — Generate Plan' : 'Next →'}
      </button>
    </div>`;
}

function ssSelectOption(btn, value, qId) {
  // Toggle selection
  document.querySelectorAll('.ss-opt-btn').forEach(b => {
    b.style.background = 'var(--bg3)';
    b.style.borderColor = 'var(--border)';
    b.style.color = 'var(--text1)';
  });
  btn.style.background = 'rgba(201,168,76,.15)';
  btn.style.borderColor = 'var(--gold)';
  btn.style.color = 'var(--gold)';
  SS.answers[qId] = value;
}

function ssNextQuestion(qId) {
  // Save answer — prefer typed custom answer if present
  const custom = document.getElementById('ss-custom-answer')?.value?.trim();
  if (custom) SS.answers[qId] = custom;
  else if (!SS.answers[qId]) {
    // No answer selected or typed — allow skip but note it
    SS.answers[qId] = 'No preference';
  }
  SS.currentQ++;
  renderSSQuestion();
}

function ssPrevQuestion() {
  SS.currentQ = Math.max(0, SS.currentQ - 1);
  renderSSQuestion();
}

// ── STAGE 3: GENERATE PLAN ──
async function renderSSPlanGeneration() {
  document.getElementById('ss-body').innerHTML = `
    <div style="text-align:center;padding:30px">
      <div style="font-size:36px;margin-bottom:12px">🗓️</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">Building your fortnightly calendar…</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Every 3rd day = reel · Festivals get their day · All topics based on your answers</div>
      <div style="display:flex;justify-content:center;gap:6px">
        <div style="width:8px;height:8px;background:var(--gold);border-radius:50%;animation:pulse 1s infinite"></div>
        <div style="width:8px;height:8px;background:var(--gold);border-radius:50%;animation:pulse 1s infinite .2s"></div>
        <div style="width:8px;height:8px;background:var(--gold);border-radius:50%;animation:pulse 1s infinite .4s"></div>
      </div>
    </div>`;

  try {
    // Calculate fortnight dates
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() + 1); // start tomorrow
    const end = new Date(start);
    end.setDate(start.getDate() + 13); // 14 days

    const res = await fetch(MKT_SB_URL + '/functions/v1/marketing-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': MKT_SB_KEY },
      body: JSON.stringify({
        action: 'generate_calendar',
        agent: 'Strategy Session',
        prompt: `You are a content strategist for V Wholesale, a home building materials store in Vijayawada, Andhra Pradesh (Telugu + English market).

Generate a 14-day content calendar based on the business data and owner's answers provided.

STRICT RULES:
1. Every 3rd day must be a REEL (days 3, 6, 9, 12) — reels are video, AI gives script, owner films
2. Festivals get their own day posted at 8am — do NOT put a festival on a reel day unless it falls exactly there
3. No two consecutive days with same content type
4. Topics must be specific to V Wholesale products — not generic home improvement
5. For reels: write a clear 30-45 second shoot direction the owner can follow
6. Mix of: product education, store showcase, customer benefit, contractor focus, seasonal/festival
7. Prices/offers = owner fills in manually — AI never invents numbers
8. Telugu audience: reference local context, Vijayawada, construction culture

Return ONLY valid JSON:
{
  "calendar": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "content_type": "image|reel|festival|gif",
      "topic": "specific topic title",
      "visual_brief": "what to show / film",
      "caption_direction": "tone and key points for caption — not the caption itself",
      "reel_script": "only for reel days — 30-45 sec shoot plan with scenes",
      "hashtags": ["#Vijayawada", "#HomeRenovation", "...8 more relevant ones"],
      "channels": ["instagram_feed","facebook_post","threads","youtube"],
      "post_time": "10:00",
      "priority": "high|medium",
      "is_reel": true|false,
      "is_festival": false
    }
  ],
  "summary": "2-3 sentence overview of this fortnight's strategy"
}`,
        context: {
          fortnight_start: start.toISOString().split('T')[0],
          fortnight_end: end.toISOString().split('T')[0],
          business_data: {
            top_categories: SS.snapshot?.top_categories?.slice(0,5).map(c=>c.category),
            slow_movers: SS.snapshot?.slow_movers,
            hot_leads: SS.snapshot?.hot_leads?.slice(0,2),
            competitors: SS.snapshot?.competitors,
            revenue_trend: SS.snapshot?.revenue
          },
          owner_answers: SS.answers,
          reel_days: [3,6,9,12],
          city: 'Vijayawada',
          season: 'Monsoon — July-September',
          store: 'V Wholesale | Visit V Wholesale| 8712697930'
        }
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    SS.plan = data.output;
    renderSSPlanPreview();

  } catch (e) {
    document.getElementById('ss-body').innerHTML = `
      <div style="text-align:center;padding:30px;color:var(--red)">
        <div style="font-size:24px;margin-bottom:8px">⚠️</div>
        <div style="font-weight:700">Plan generation failed</div>
        <div style="font-size:12px;margin-top:4px;color:var(--text3)">${e.message}</div>
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:center">
          <button onclick="renderSSPlanGeneration()" class="mkt-btn mkt-btn-primary">Retry</button>
          <button onclick="closeStrategySession()" class="mkt-btn mkt-btn-ghost">Close</button>
        </div>
      </div>`;
  }
}

// ── STAGE 4: PREVIEW & CONFIRM ──
function renderSSPlanPreview() {
  const plan = SS.plan;
  if (!plan?.calendar?.length) { renderSSPlanGeneration(); return; }

  const TYPE_ICON = { image:'🖼️', reel:'🎬', festival:'🎉', gif:'✨' };
  const TYPE_COLOR = { image:'var(--text3)', reel:'var(--gold)', festival:'#f59e0b', gif:'#a78bfa' };

  document.getElementById('ss-body').innerHTML = `
    <!-- Summary -->
    <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">🧠 STRATEGY SUMMARY</div>
      <div style="font-size:12px;color:var(--text2);line-height:1.7">${plan.summary || ''}</div>
    </div>

    <!-- Stats -->
    <div style="display:flex;gap:8px;margin-bottom:14px">
      ${[
        { label:'Total posts', val: plan.calendar.length, color:'var(--gold)' },
        { label:'Reels', val: plan.calendar.filter(c=>c.is_reel).length, color:'#f59e0b' },
        { label:'Festivals', val: plan.calendar.filter(c=>c.is_festival||c.content_type==='festival').length, color:'#22c55e' }
      ].map(s=>`
      <div style="flex:1;background:var(--bg3);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:${s.color}">${s.val}</div>
        <div style="font-size:10px;color:var(--text3)">${s.label}</div>
      </div>`).join('')}
    </div>

    <!-- Calendar list -->
    <div style="display:grid;gap:8px;margin-bottom:16px;max-height:340px;overflow-y:auto">
      ${plan.calendar.map((item, i) => {
        const d = new Date(item.date);
        const dateStr = d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
        const icon = TYPE_ICON[item.content_type] || '📝';
        const color = TYPE_COLOR[item.content_type] || 'var(--text3)';
        return `
        <div style="background:var(--bg3);border-radius:10px;padding:12px;border-left:3px solid ${color}">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="min-width:52px;text-align:center">
              <div style="font-size:11px;font-weight:700;color:${color}">${icon} ${item.content_type?.toUpperCase()}</div>
              <div style="font-size:10px;color:var(--text3)">${dateStr}</div>
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${item.topic}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${item.caption_direction?.slice(0,80) || item.visual_brief?.slice(0,80) || ''}…</div>
            </div>
            <div style="font-size:10px;color:var(--text3)">🕙 ${item.post_time||'10:00'}</div>
          </div>
          ${item.is_reel && item.reel_script ? `
          <div style="margin-top:8px;padding:8px;background:rgba(201,168,76,.06);border-radius:6px;font-size:11px;color:var(--text2);border-left:2px solid var(--gold)">
            🎬 <b>Shoot guide:</b> ${item.reel_script?.slice(0,120)}…
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- Actions -->
    <div style="display:grid;gap:8px">
      <button onclick="confirmSSPlan()" class="mkt-btn mkt-btn-primary" style="padding:14px;font-size:14px;font-weight:900">
        ✅ Save to Calendar — Start This Plan
      </button>
      <button onclick="renderSSPlanGeneration()" class="mkt-btn mkt-btn-ghost" style="padding:10px">
        🔄 Regenerate Plan
      </button>
      <button onclick="closeStrategySession()" class="mkt-btn mkt-btn-ghost" style="padding:10px">
        Cancel
      </button>
    </div>`;
}

// ── STAGE 5: SAVE TO CALENDAR ──
async function confirmSSPlan() {
  const btn = document.querySelector('[onclick="confirmSSPlan()"]');
  if (btn) { btn.textContent = '⏳ Saving to calendar…'; btn.disabled = true; }

  try {
    const plan = SS.plan;
    const today = new Date().toISOString().split('T')[0];

    // Remove existing future planned items to replace with this plan
    await sb.from('content_calendar')
      .delete()
      .gte('cal_date', today)
      .eq('status','planned')
      .then(r=>r, ()=>({}));

    // Insert new calendar items
    const rows = plan.calendar.map(item => ({
      cal_date: item.date,
      content_type: item.content_type || 'image',
      topic: item.topic,
      visual_brief: item.visual_brief || '',
      caption_direction: item.caption_direction || '',
      hashtags: item.hashtags || [],
      reel_script: item.reel_script || null,
      is_reel: item.is_reel || false,
      is_festival: item.is_festival || item.content_type === 'festival',
      platform: item.channels || ['instagram_feed','facebook_post','threads'],
      status: 'planned',
      priority: item.priority || 'medium',
      shoot_required: item.is_reel || false,
      notes: item.caption_direction || ''
    }));

    const { error } = await sb.from('content_calendar').insert(rows);
    if (error) throw new Error(error.message);

    // Save strategy session record
    await sb.from('strategy_sessions').insert({
      summary: plan.summary || '',
      key_themes: Object.values(SS.answers).join(' | '),
      suggested_posts: plan.calendar,
      notes: JSON.stringify(SS.answers)
    }).then(r=>r, ()=>({}));

    // Show success
    document.getElementById('ss-body').innerHTML = `
      <div style="text-align:center;padding:30px">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <div style="font-size:16px;font-weight:900;margin-bottom:6px">${plan.calendar.length} posts saved to calendar</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:20px">
          ${plan.calendar.filter(c=>c.is_reel).length} reels · 
          ${plan.calendar.filter(c=>c.content_type==='festival').length} festival posts · 
          ${plan.calendar.filter(c=>!c.is_reel&&c.content_type!=='festival').length} image posts
        </div>
        <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:12px;margin-bottom:20px;text-align:left">
          <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:4px">WHAT HAPPENS NEXT</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.8">
            ✅ AI generates caption + image 3 days before each post<br>
            📱 You get a WhatsApp preview to approve<br>
            🚀 Posts automatically at 10am on the day<br>
            🎬 Reel days: AI gives you the script — you film and upload
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button onclick="closeStrategySession();mktNav('calendar')" class="mkt-btn mkt-btn-primary">
            📅 View Calendar
          </button>
          <button onclick="closeStrategySession()" class="mkt-btn mkt-btn-ghost">
            Done
          </button>
        </div>
      </div>`;

  } catch (e) {
    showMktToast('❌ Save failed: ' + e.message);
    const btn = document.querySelector('[onclick="confirmSSPlan()"]');
    if (btn) { btn.textContent = '✅ Save to Calendar'; btn.disabled = false; }
  }
}

// Expose globally
window.openStrategySession = openStrategySession;
window.closeStrategySession = closeStrategySession;
window.startSSQuestions = startSSQuestions;
window.ssSelectOption = ssSelectOption;
window.ssNextQuestion = ssNextQuestion;
window.ssPrevQuestion = ssPrevQuestion;
window.renderSSPlanGeneration = renderSSPlanGeneration;
window.renderSSPlanPreview = renderSSPlanPreview;
window.confirmSSPlan = confirmSSPlan;
