// ════════════════════════════════════════════════════════════
// VW INTERNAL CHAT — Staff.html module
// Syncs with field.html via shared Supabase DB
// ════════════════════════════════════════════════════════════
window.VW_INTERNAL_CHAT = (() => {

  let currentChatId = null;
  let allStaff = [];
  let myChats = [];
  let currentProfile = null;
  let currentStaffId = null;
  let msgPollTimer = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let recTimerInterval = null;
  let recSeconds = 0;
  let isRecording = false;

  // ── Get current staff record ──
  async function getCurrentStaff() {
    const profile = VW_AUTH?.getCurrentProfile?.();
    if (!profile) return null;
    currentProfile = profile;
    const { data } = await VW_DB.client.from('staff')
      .select('id,name,designation,role,department,phone')
      .eq('phone', profile.phone).maybeSingle();
    if (data) currentStaffId = data.id;
    return data;
  }

  // ── Render main chat page ──
  async function renderChat() {
    const staff = await getCurrentStaff();
    if (!staff) return `<div style="padding:32px;text-align:center;color:#94a3b8;">Login required to access chat.</div>`;

    await loadAllStaff();
    startBadgePoll();

    return `
      <div style="height:calc(100vh - 60px);display:flex;flex-direction:column;background:#0F1923;color:#F0F4F8;">

        <!-- Chat list -->
        <div id="sc-list-view" style="display:flex;flex-direction:column;height:100%;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;background:#1A2634;border-bottom:1px solid #2A3A4A;">
            <div style="font-size:16px;font-weight:700;">Internal Chat</div>
            <div style="display:flex;gap:8px;">
              <button onclick="VW_INTERNAL_CHAT.openNewChatSheet()" 
                style="padding:7px 14px;border-radius:8px;background:#F5A623;border:none;color:#0F1923;font-weight:700;font-size:13px;cursor:pointer;">
                ✏️ New Chat
              </button>
              <button onclick="VW_INTERNAL_CHAT.openRequestsPanel()" 
                style="padding:7px 14px;border-radius:8px;background:rgba(245,166,35,.15);border:1px solid rgba(245,166,35,.4);color:#F5A623;font-weight:700;font-size:13px;cursor:pointer;">
                📋 Requests
              </button>
            </div>
          </div>

          <div style="padding:10px 16px;background:#1A2634;border-bottom:1px solid #1E2E3E;">
            <input id="sc-search" type="search" placeholder="Search chats…"
              style="width:100%;background:#243040;border:1px solid #2A3A4A;border-radius:20px;padding:9px 14px;color:#F0F4F8;font-size:14px;outline:none;"
              oninput="VW_INTERNAL_CHAT.filterList(this.value)">
          </div>

          <div id="sc-chat-list" style="flex:1;overflow-y:auto;">
            <div style="text-align:center;padding:32px;color:#506070;">Loading chats…</div>
          </div>
        </div>

        <!-- Conversation view (hidden) -->
        <div id="sc-conv-view" style="display:none;flex-direction:column;height:100%;">
          <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#1A2634;border-bottom:1px solid #2A3A4A;">
            <button onclick="VW_INTERNAL_CHAT.exitConv()" style="background:none;border:none;color:#8FA3B8;font-size:22px;cursor:pointer;">←</button>
            <div id="sc-conv-avatar" style="width:38px;height:38px;border-radius:50%;background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.3);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">💬</div>
            <div style="flex:1;min-width:0;">
              <div id="sc-conv-name" style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
              <div id="sc-conv-sub" style="font-size:11px;color:#506070;"></div>
            </div>
          </div>

          <div id="sc-messages" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:6px;">
          </div>

          <div style="background:#1A2634;border-top:1px solid #2A3A4A;padding:10px 12px;display:flex;align-items:flex-end;gap:8px;">
            <button id="sc-voice-btn" onclick="VW_INTERNAL_CHAT.toggleVoice()"
              style="width:40px;height:40px;border-radius:50%;border:none;background:#243040;color:#8FA3B8;font-size:18px;cursor:pointer;flex-shrink:0;">🎤</button>
            <div style="flex:1;position:relative;">
              <textarea id="sc-msg-input" placeholder="Type a message…" rows="1"
                style="width:100%;background:#243040;border:1px solid #2A3A4A;border-radius:20px;padding:10px 14px;font-size:14px;color:#F0F4F8;font-family:inherit;resize:none;outline:none;max-height:120px;"
                oninput="VW_INTERNAL_CHAT.autoResize(this)"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();VW_INTERNAL_CHAT.send();}"></textarea>
              <div id="sc-rec-indicator" style="display:none;position:absolute;inset:0;background:#243040;border:1px solid #EF4444;border-radius:20px;align-items:center;padding:0 14px;gap:8px;">
                <div style="width:8px;height:8px;border-radius:50%;background:#EF4444;animation:pulse 1s infinite;"></div>
                <span id="sc-rec-timer" style="font-size:13px;color:#EF4444;">0:00</span>
                <span style="font-size:12px;color:#506070;">Recording… tap 🎤 to send</span>
              </div>
            </div>
            <button onclick="VW_INTERNAL_CHAT.send()"
              style="width:40px;height:40px;border-radius:50%;border:none;background:#F5A623;color:#0F1923;font-size:18px;cursor:pointer;flex-shrink:0;">➤</button>
          </div>
        </div>

      </div>

      <!-- Directory sheet -->
      <div id="sc-dir-sheet" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:flex-end;">
        <div style="background:#1A2634;border-radius:20px 20px 0 0;width:100%;padding:20px;max-height:85vh;overflow-y:auto;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <div style="font-size:16px;font-weight:700;">Staff Directory</div>
            <button onclick="VW_INTERNAL_CHAT.closeDir()" style="background:none;border:none;color:#8FA3B8;font-size:22px;cursor:pointer;">✕</button>
          </div>
          <input id="sc-dir-search" type="search" placeholder="Search by name or department…"
            style="width:100%;background:#243040;border:1px solid #2A3A4A;border-radius:10px;padding:10px 14px;color:#F0F4F8;font-size:14px;outline:none;margin-bottom:14px;"
            oninput="VW_INTERNAL_CHAT.filterDir(this.value)">
          <div id="sc-directory"></div>
        </div>
      </div>

      <!-- Requests panel -->
      <div id="sc-req-panel" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:flex-end;">
        <div style="background:#1A2634;border-radius:20px 20px 0 0;width:100%;padding:20px;max-height:85vh;overflow-y:auto;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div style="font-size:16px;font-weight:700;">📋 Incoming Requests</div>
            <button onclick="VW_INTERNAL_CHAT.closeReqPanel()" style="background:none;border:none;color:#8FA3B8;font-size:22px;cursor:pointer;">✕</button>
          </div>
          <div id="sc-requests-list"><div style="text-align:center;padding:16px;color:#506070;">Loading…</div></div>
        </div>
      </div>
    `;
  }

  // ── Load after render ──
  async function afterRender() {
    await loadChatList();
  }

  async function loadAllStaff() {
    const { data } = await VW_DB.client.from('staff').select('id,name,designation,role,department').eq('active',true).order('name');
    allStaff = data || [];
  }

  // ── Chat list ──
  async function loadChatList() {
    if (!currentStaffId) return;
    const { data: mems } = await VW_DB.client.from('internal_chat_members')
      .select('chat_id,last_read_at,internal_chats(id,type,name,avatar_emoji,updated_at)')
      .eq('staff_id', currentStaffId);

    if (!mems?.length) {
      const el = document.getElementById('sc-chat-list');
      if (el) el.innerHTML = '<div style="text-align:center;padding:32px;color:#506070;font-size:13px;">No chats yet.<br>Click ✏️ New Chat to start.</div>';
      return;
    }

    const chatIds = mems.map(m=>m.chat_id);
    const { data: lastMsgs } = await VW_DB.client.from('internal_messages')
      .select('chat_id,content,type,created_at,sender_staff_id').in('chat_id',chatIds)
      .eq('is_deleted',false).order('created_at',{ascending:false});

    const lastMsgMap = {};
    (lastMsgs||[]).forEach(m => { if (!lastMsgMap[m.chat_id]) lastMsgMap[m.chat_id]=m; });

    const { data: unreadData } = await VW_DB.client.from('internal_messages')
      .select('chat_id,id,created_at').in('chat_id',chatIds).eq('is_deleted',false)
      .neq('sender_staff_id', currentStaffId);

    const unreadCount = {};
    mems.forEach(m => {
      const lr = new Date(m.last_read_at||0);
      unreadCount[m.chat_id] = (unreadData||[]).filter(msg => msg.chat_id===m.chat_id && new Date(msg.created_at)>lr).length;
    });

    const total = Object.values(unreadCount).reduce((a,b)=>a+b,0);
    const badge = document.getElementById('staff-chat-badge');
    if (badge) { badge.textContent=total; badge.style.display=total?'':'none'; }

    myChats = mems.map(m=>({
      ...m.internal_chats, lastMsg: lastMsgMap[m.chat_id], unread: unreadCount[m.chat_id]||0, membership: m
    })).sort((a,b)=>{
      const ta=a.lastMsg?new Date(a.lastMsg.created_at):new Date(a.updated_at||0);
      const tb=b.lastMsg?new Date(b.lastMsg.created_at):new Date(b.updated_at||0);
      return tb-ta;
    });

    renderList(myChats);
  }

  function renderList(chats) {
    const el = document.getElementById('sc-chat-list');
    if (!el) return;
    if (!chats.length) { el.innerHTML='<div style="text-align:center;padding:32px;color:#506070;font-size:13px;">No chats yet.</div>'; return; }
    el.innerHTML = chats.map(c=>{
      const last = c.lastMsg;
      const lastText = last ? (last.type==='voice'?'🎤 Voice note':last.type==='request'?'📋 Request':(last.content||'').substring(0,45)) : 'No messages';
      const lastTime = last ? fmtTime(last.created_at) : '';
      return `<div onclick="VW_INTERNAL_CHAT.openConv(${c.id})"
        style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #1E2E3E;cursor:pointer;"
        onmousedown="this.style.background='#243040'" onmouseup="this.style.background=''">
        <div style="width:44px;height:44px;border-radius:50%;background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;position:relative;">
          ${c.avatar_emoji||'💬'}
          ${c.unread?`<div style="position:absolute;top:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:#F5A623;color:#0F1923;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">${c.unread}</div>`:''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:14px;font-weight:${c.unread?700:600};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;color:#F0F4F8;">${c.name||'Chat'}</div>
            <div style="font-size:11px;color:#506070;flex-shrink:0;">${lastTime}</div>
          </div>
          <div style="font-size:13px;color:#506070;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${lastText}</div>
        </div>
      </div>`;
    }).join('');
  }

  function filterList(q) {
    const f = !q.trim() ? myChats : myChats.filter(c=>(c.name||'').toLowerCase().includes(q.toLowerCase()));
    renderList(f);
  }

  // ── Open conversation ──
  async function openConv(chatId) {
    currentChatId = chatId;
    const chat = myChats.find(c=>c.id===chatId)||{name:'Chat',avatar_emoji:'💬',type:'dm'};

    const listView = document.getElementById('sc-list-view');
    const convView = document.getElementById('sc-conv-view');
    if (listView) listView.style.display = 'none';
    if (convView) { convView.style.display = 'flex'; }

    const nameEl = document.getElementById('sc-conv-name');
    const subEl = document.getElementById('sc-conv-sub');
    const avEl = document.getElementById('sc-conv-avatar');
    if (nameEl) nameEl.textContent = chat.name||'Chat';
    if (subEl) subEl.textContent = chat.type==='dm'?'Direct message':chat.type+' channel';
    if (avEl) avEl.textContent = chat.avatar_emoji||(chat.type==='group'?'👥':'👤');

    await loadMessages(chatId);
    markRead(chatId);
    clearInterval(msgPollTimer);
    msgPollTimer = setInterval(()=>refreshMsgs(chatId), 5000);
  }

  async function loadMessages(chatId) {
    const { data: msgs } = await VW_DB.client.from('internal_messages')
      .select('*').eq('chat_id',chatId).eq('is_deleted',false)
      .order('created_at',{ascending:true}).limit(80);
    renderMsgs(msgs||[]);
    scrollBottom();
  }

  async function refreshMsgs(chatId) {
    if (currentChatId!==chatId) return;
    const { data: msgs } = await VW_DB.client.from('internal_messages')
      .select('*').eq('chat_id',chatId).eq('is_deleted',false)
      .order('created_at',{ascending:true}).limit(80);
    renderMsgs(msgs||[]);
    markRead(chatId);
  }

  function renderMsgs(msgs) {
    const el = document.getElementById('sc-messages');
    if (!el) return;
    if (!msgs.length) { el.innerHTML='<div style="text-align:center;padding:32px;color:#506070;font-size:13px;">No messages yet. Say hello! 👋</div>'; return; }

    const sMap = {};
    allStaff.forEach(s=>{sMap[s.id]=s.name;});
    let lastDate = null;

    el.innerHTML = msgs.map(m=>{
      const isMe = m.sender_staff_id===currentStaffId;
      const sName = sMap[m.sender_staff_id]||'Staff';
      const mDate = new Date(m.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      const mTime = fmtTime(m.created_at);
      let dateSep = '';
      if (mDate!==lastDate) { lastDate=mDate; dateSep=`<div style="text-align:center;margin:10px 0 6px;"><span style="font-size:11px;color:#506070;background:#1A2634;padding:3px 10px;border-radius:12px;">${mDate}</span></div>`; }

      let bubble = '';
      if (m.type==='voice') {
        bubble=`<div style="display:flex;align-items:center;gap:8px;min-width:160px;">
          <button onclick="VW_INTERNAL_CHAT.playVoice('${m.voice_url}')" style="width:34px;height:34px;border-radius:50%;border:none;background:${isMe?'rgba(0,0,0,.2)':'rgba(245,166,35,.15)'};color:${isMe?'#fff':'#F5A623'};font-size:14px;cursor:pointer;">▶</button>
          <div style="flex:1;"><div style="height:3px;background:${isMe?'rgba(255,255,255,.3)':'#2A3A4A'};border-radius:2px;"><div style="width:60%;height:100%;background:${isMe?'rgba(255,255,255,.6)':'#F5A623'};border-radius:2px;"></div></div>
          <div style="font-size:10px;color:${isMe?'rgba(255,255,255,.5)':'#506070'};margin-top:2px;">${m.voice_duration_s?fmtDur(m.voice_duration_s):'—'}</div></div>
        </div>${m.voice_transcript?`<div style="font-size:11px;color:${isMe?'rgba(255,255,255,.7)':'#8FA3B8'};margin-top:4px;font-style:italic;">"${m.voice_transcript}"</div>`:''}`;
      } else if (m.type==='request') {
        const meta=m.metadata||{};
        const sc=meta.status==='approved'?'#22C55E':meta.status==='rejected'?'#EF4444':'#F5A623';
        bubble=`<div style="font-size:12px;font-weight:700;color:${isMe?'rgba(255,255,255,.8)':'#F5A623'};margin-bottom:4px;">📋 ${(meta.request_type||'REQUEST').toUpperCase()}</div>
          <div style="font-size:13px;">${m.content}</div>
          ${!isMe?`<div style="margin-top:8px;display:flex;gap:6px;">
            <button onclick="VW_INTERNAL_CHAT.updateRequest(${meta.request_id||0},'approved',${m.id})" style="flex:1;padding:6px;border-radius:6px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#22C55E;font-size:12px;font-weight:600;cursor:pointer;">✓ Approve</button>
            <button onclick="VW_INTERNAL_CHAT.updateRequest(${meta.request_id||0},'rejected',${m.id})" style="flex:1;padding:6px;border-radius:6px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#EF4444;font-size:12px;font-weight:600;cursor:pointer;">✗ Reject</button>
          </div>`:`<div style="margin-top:4px;font-size:11px;padding:2px 8px;border-radius:10px;display:inline-block;background:${sc+'22'};color:${sc};">${meta.status||'pending'}</div>`}`;
      } else {
        bubble=`<div style="font-size:14px;line-height:1.5;">${(m.content||'').split('\n').join('<br>')}</div>`;
      }

      return `${dateSep}
        <div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'};margin-bottom:2px;">
          ${!isMe?`<div style="font-size:11px;color:#F5A623;font-weight:600;margin-bottom:3px;margin-left:12px;">${sName}</div>`:''}
          <div style="max-width:76%;padding:10px 12px;border-radius:${isMe?'18px 18px 4px 18px':'18px 18px 18px 4px'};
               background:${isMe?'#F5A623':'#243040'};color:${isMe?'#0F1923':'#F0F4F8'};
               border:${isMe?'none':'1px solid #2A3A4A'};">
            ${bubble}
            <div style="font-size:10px;color:${isMe?'rgba(15,25,35,.5)':'#506070'};margin-top:4px;text-align:right;">${mTime}${isMe?' ✓✓':''}</div>
          </div>
        </div>`;
    }).join('');
    scrollBottom();
  }

  function scrollBottom() {
    const el = document.getElementById('sc-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  async function markRead(chatId) {
    if (!currentStaffId) return;
    await VW_DB.client.from('internal_chat_members')
      .update({last_read_at: new Date().toISOString()})
      .eq('chat_id',chatId).eq('staff_id',currentStaffId);
  }

  function exitConv() {
    clearInterval(msgPollTimer);
    currentChatId = null;
    const lv=document.getElementById('sc-list-view');
    const cv=document.getElementById('sc-conv-view');
    if(lv) lv.style.display='flex';
    if(cv) cv.style.display='none';
    loadChatList();
  }

  // ── Send ──
  async function send() {
    const input = document.getElementById('sc-msg-input');
    const text = (input?.value||'').trim();
    if (!text||!currentChatId||!currentStaffId) return;
    input.value=''; autoResize(input);
    await VW_DB.client.from('internal_messages').insert({
      chat_id:currentChatId, sender_staff_id:currentStaffId, type:'text', content:text
    });
    await VW_DB.client.from('internal_chats').update({updated_at:new Date().toISOString()}).eq('id',currentChatId);
    refreshMsgs(currentChatId);
  }

  function autoResize(el) {
    if(!el) return;
    el.style.height='auto';
    el.style.height=Math.min(el.scrollHeight,120)+'px';
  }

  // ── Voice ──
  async function toggleVoice() {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => { if(e.data.size>0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunks,{type:'audio/webm'});
          await sendVoice(blob, recSeconds);
          stream.getTracks().forEach(t=>t.stop());
        };
        mediaRecorder.start();
        isRecording=true; recSeconds=0;
        const ri=document.getElementById('sc-rec-indicator');
        const mi=document.getElementById('sc-msg-input');
        const vb=document.getElementById('sc-voice-btn');
        if(ri){ri.style.display='flex';} if(mi) mi.style.display='none';
        if(vb){vb.style.background='#EF4444';vb.style.color='#fff';}
        recTimerInterval=setInterval(()=>{
          recSeconds++;
          const t=document.getElementById('sc-rec-timer');
          if(t) t.textContent=fmtDur(recSeconds);
          if(recSeconds>=120) toggleVoice();
        },1000);
      } catch(e) { showToast('Microphone permission denied'); }
    } else {
      clearInterval(recTimerInterval);
      isRecording=false;
      mediaRecorder?.stop();
      const ri=document.getElementById('sc-rec-indicator');
      const mi=document.getElementById('sc-msg-input');
      const vb=document.getElementById('sc-voice-btn');
      if(ri) ri.style.display='none'; if(mi) mi.style.display='';
      if(vb){vb.style.background='';vb.style.color='';}
    }
  }

  async function sendVoice(blob, dur) {
    if (!currentChatId||!currentStaffId) return;
    const fp=`internal_chat/voice/${currentStaffId}_${Date.now()}.webm`;
    const { error: upErr } = await VW_DB.client.storage.from('field-media').upload(fp,blob,{contentType:'audio/webm'});
    if(upErr){showToast('Voice upload failed');return;}
    const { data:{publicUrl} } = VW_DB.client.storage.from('field-media').getPublicUrl(fp);
    await VW_DB.client.from('internal_messages').insert({
      chat_id:currentChatId, sender_staff_id:currentStaffId,
      type:'voice', voice_url:publicUrl, voice_duration_s:dur
    });
    await VW_DB.client.from('internal_chats').update({updated_at:new Date().toISOString()}).eq('id',currentChatId);
    refreshMsgs(currentChatId);
  }

  function playVoice(url) {
    if(!url) return;
    new Audio(url).play().catch(()=>showToast('Cannot play audio'));
  }

  // ── Directory ──
  function openNewChatSheet() {
    const sh=document.getElementById('sc-dir-sheet');
    if(sh){sh.style.display='flex';}
    renderDirectory(allStaff);
  }

  function closeDir() {
    const sh=document.getElementById('sc-dir-sheet');
    if(sh) sh.style.display='none';
  }

  function filterDir(q) {
    const f=!q.trim()?allStaff:allStaff.filter(s=>
      s.name.toLowerCase().includes(q.toLowerCase())||(s.department||'').toLowerCase().includes(q.toLowerCase())||(s.designation||'').toLowerCase().includes(q.toLowerCase())
    );
    renderDirectory(f);
  }

  async function renderDirectory(staffList) {
    const el=document.getElementById('sc-directory');
    if(!el) return;
    const {data:conns} = await VW_DB.client.from('internal_connections')
      .select('*').or(`requester_staff_id.eq.${currentStaffId},target_staff_id.eq.${currentStaffId}`);
    const connMap={};
    (conns||[]).forEach(c=>{
      const oid=c.requester_staff_id===currentStaffId?c.target_staff_id:c.requester_staff_id;
      connMap[oid]=c.status;
    });
    const others=staffList.filter(s=>s.id!==currentStaffId);
    el.innerHTML=others.map(s=>{
      const st=connMap[s.id];
      let btn='';
      if(st==='accepted') btn=`<button onclick="VW_INTERNAL_CHAT.startDM(${s.id},'${s.name.replace(/'/g,"&#39;")}')" style="font-size:12px;padding:6px 12px;border-radius:8px;background:#22C55E;color:#fff;border:none;cursor:pointer;">Message</button>`;
      else if(st==='pending') btn=`<div style="font-size:12px;color:#506070;padding:6px 12px;">Pending…</div>`;
      else btn=`<button onclick="VW_INTERNAL_CHAT.connect(${s.id},'${s.name.replace(/'/g,"&#39;")}')" style="font-size:12px;padding:6px 12px;border-radius:8px;background:rgba(245,166,35,.15);color:#F5A623;border:1px solid rgba(245,166,35,.4);cursor:pointer;">Connect</button>`;
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1E2E3E;">
        <div style="width:38px;height:38px;border-radius:50%;background:#243040;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#F5A623;flex-shrink:0;">${s.name.charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:#F0F4F8;">${s.name}</div>
          <div style="font-size:11px;color:#506070;">${s.designation||s.role||'—'} · ${s.department||'—'}</div>
        </div>
        ${btn}
      </div>`;
    }).join('');
  }

  async function connect(targetId, targetName) {
    const {error}=await VW_DB.client.from('internal_connections').insert({
      requester_staff_id:currentStaffId, target_staff_id:targetId, status:'pending'
    });
    if(error&&!error.message.includes('duplicate')){showToast('Error: '+error.message);return;}
    showToast('Connect request sent to '+targetName);
    openNewChatSheet();
  }

  async function startDM(staffId, staffName) {
    const {data:existing}=await VW_DB.client.from('internal_chat_members')
      .select('chat_id,internal_chats(id,type)').eq('staff_id',currentStaffId);
    const myDmIds=(existing||[]).filter(m=>m.internal_chats?.type==='dm').map(m=>m.chat_id);
    let dmId=null;
    if(myDmIds.length){
      const {data:theirMems}=await VW_DB.client.from('internal_chat_members')
        .select('chat_id').eq('staff_id',staffId).in('chat_id',myDmIds);
      if(theirMems?.length) dmId=theirMems[0].chat_id;
    }
    if(!dmId){
      const {data:nc}=await VW_DB.client.from('internal_chats').insert({
        type:'dm', name:staffName, created_by_staff_id:currentStaffId, avatar_emoji:'👤'
      }).select().single();
      await VW_DB.client.from('internal_chat_members').insert([
        {chat_id:nc.id,staff_id:currentStaffId,role:'member'},
        {chat_id:nc.id,staff_id:staffId,role:'member'}
      ]);
      dmId=nc.id;
      myChats.unshift({id:dmId,name:staffName,type:'dm',avatar_emoji:'👤',unread:0});
    }
    closeDir();
    await openConv(dmId);
  }

  // ── Requests panel (HR/managers see incoming requests) ──
  async function openRequestsPanel() {
    const sh=document.getElementById('sc-req-panel');
    if(sh) sh.style.display='flex';
    const el=document.getElementById('sc-requests-list');
    if(!el) return;

    const {data:reqs}=await VW_DB.client.from('internal_requests')
      .select('*').order('created_at',{ascending:false}).limit(30);

    if(!reqs?.length){el.innerHTML='<div style="text-align:center;padding:24px;color:#506070;">No requests yet</div>';return;}

    const sMap={};
    allStaff.forEach(s=>{sMap[s.id]=s.name;});
    const typeIcon={leave:'🏖️',expense:'💰',complaint:'📢',asset:'📱',general:'✉️'};
    const stColor={pending:'#F5A623',approved:'#22C55E',rejected:'#EF4444',in_review:'#8B5CF6'};

    el.innerHTML=reqs.map(r=>`
      <div style="background:#243040;border-radius:10px;padding:14px;margin-bottom:10px;border-left:3px solid ${stColor[r.status]||'#2A3A4A'};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:14px;font-weight:700;">${typeIcon[r.type]||'📋'} ${r.title}</div>
          <div style="font-size:11px;padding:3px 8px;border-radius:10px;background:${(stColor[r.status]||'#506070')+'22'};color:${stColor[r.status]||'#506070'};">${r.status}</div>
        </div>
        <div style="font-size:12px;color:#8FA3B8;margin-bottom:8px;">From: ${sMap[r.requester_staff_id]||'—'} · ${new Date(r.created_at).toLocaleDateString('en-IN')}</div>
        <div style="font-size:12px;color:#506070;">${JSON.stringify(r.details).substring(0,120)}…</div>
        ${r.status==='pending'?`
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button onclick="VW_INTERNAL_CHAT.reviewRequest(${r.id},'approved')" style="flex:1;padding:8px;border-radius:8px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#22C55E;font-weight:700;font-size:13px;cursor:pointer;">✓ Approve</button>
            <button onclick="VW_INTERNAL_CHAT.reviewRequest(${r.id},'rejected')" style="flex:1;padding:8px;border-radius:8px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#EF4444;font-weight:700;font-size:13px;cursor:pointer;">✗ Reject</button>
            <button onclick="VW_INTERNAL_CHAT.reviewRequest(${r.id},'in_review')" style="padding:8px 12px;border-radius:8px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.4);color:#8B5CF6;font-weight:700;font-size:13px;cursor:pointer;">In Review</button>
          </div>` : r.reviewer_note ? `<div style="font-size:12px;color:#8FA3B8;margin-top:6px;font-style:italic;">Note: ${r.reviewer_note}</div>` : ''}
      </div>`).join('');
  }

  function closeReqPanel() {
    const sh=document.getElementById('sc-req-panel');
    if(sh) sh.style.display='none';
  }

  async function reviewRequest(reqId, status) {
    const note = status==='rejected' ? prompt('Reason for rejection (optional):') : null;
    await VW_DB.client.from('internal_requests').update({
      status, reviewer_note: note||null,
      reviewed_at: new Date().toISOString(),
      reviewed_by_staff_id: currentStaffId
    }).eq('id',reqId);
    showToast(status==='approved'?'✅ Request approved':'Request updated');
    openRequestsPanel();
  }

  async function updateRequest(reqId, status, msgId) {
    await reviewRequest(reqId, status);
    // Update the message metadata too
    if(msgId) {
      const {data:msg}=await VW_DB.client.from('internal_messages').select('metadata').eq('id',msgId).single();
      if(msg) {
        await VW_DB.client.from('internal_messages').update({
          metadata:{...(msg.metadata||{}), status}
        }).eq('id',msgId);
        if(currentChatId) refreshMsgs(currentChatId);
      }
    }
  }

  // ── Badge poll ──
  function startBadgePoll() {
    setInterval(async()=>{
      if(!currentStaffId||currentChatId) return;
      const {data:mems}=await VW_DB.client.from('internal_chat_members')
        .select('chat_id,last_read_at').eq('staff_id',currentStaffId);
      if(!mems?.length) return;
      const chatIds=mems.map(m=>m.chat_id);
      const {data:unread}=await VW_DB.client.from('internal_messages')
        .select('id,chat_id,created_at').in('chat_id',chatIds)
        .eq('is_deleted',false).neq('sender_staff_id',currentStaffId);
      const total=(unread||[]).filter(msg=>{
        const m=mems.find(mm=>mm.chat_id===msg.chat_id);
        return m&&new Date(msg.created_at)>new Date(m.last_read_at||0);
      }).length;
      const badge=document.getElementById('staff-chat-badge');
      if(badge){badge.textContent=total;badge.style.display=total?'':'none';}
    },15000);
  }

  // ── Utils ──
  function fmtTime(iso) {
    const d=new Date(iso), now=new Date();
    if(d.toDateString()===now.toDateString()) return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    if((now-d)<7*24*60*60*1000) return d.toLocaleDateString('en-IN',{weekday:'short'});
    return d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  }
  function fmtDur(sec){const m=Math.floor(sec/60),s=sec%60;return m+':'+String(s).padStart(2,'0');}

  // Public API
  return {
    renderChat, afterRender, loadChatList,
    openConv, exitConv, send, autoResize,
    filterList, openNewChatSheet, closeDir, filterDir,
    connect, startDM,
    toggleVoice, playVoice,
    openRequestsPanel, closeReqPanel, reviewRequest, updateRequest,
  };
})();
