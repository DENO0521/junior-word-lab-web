(function () {
  'use strict';
  const C = globalThis.WordPracticeCore, X = globalThis.WordLabExam, A = globalThis.WordLabAI, words = globalThis.WORDS;
  const byId = new Map(words.map(w => [w.id, w]));
  const STORAGE = 'word-lab-v2';
  const studentOnly = !!globalThis.WORD_LAB_STUDENT_ONLY;
  const EXAM_TYPES=['single','cloze','reading'];
  const typeNames = {single:'单项选择',cloze:'完形填空',reading:'阅读理解',meaning:'词义巩固',spelling:'错词拼写'};
  const paths = {
    book:'M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H4z M20 3h-4a3 3 0 0 0-3 3v15a4 4 0 0 1 4-2h3z',
    grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    pen:'m16 3 5 5-12 12-6 1 1-6z M14 5l5 5',
    spark:'m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
    check:'m5 12 4 4L19 6',
    arrow:'M4 12h16 m-6-6 6 6-6 6',
    download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
    upload:'M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5',
    clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
    repeat:'M3 10a8 8 0 0 1 13-6l3 3 M19 3v4h-4 M21 14a8 8 0 0 1-13 6l-3-3 M5 21v-4h4',
    help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 17h.01',
    volume:'M4 9h4l5-4v14l-5-4H4z M16 8a6 6 0 0 1 0 8 M19 5a10 10 0 0 1 0 14',
    settings:'M4 7h16 M4 17h16 M9 4v6 M15 14v6',
    shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z m-4 9 3 3 5-6',
    search:'M18 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 m-2 5 5 6',
    text:'M4 5h16 M12 5v15 M8 20h8',
    file:'M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h5'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.book}"/></svg>`;
  const e = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const el = selector => document.querySelector(selector);
  let stateMigrated=false;
  function fresh() {return {version:2,selection:'1-100',types:[...EXAM_TYPES],counts:{single:20,cloze:2,reading:2,clozeBlanks:8,readingQuestions:5},title:'第 1 周 · 中考题型词汇练习',draft:[],sections:[],source:'ai',assignment:null,studentName:'同学',students:{},endpoint:'/api/generate'};}
  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE));
      if (!stored || stored.version !== 2 || !Array.isArray(stored.draft) || !stored.students || typeof stored.students !== 'object') return fresh();
      const merged = {...fresh(),...stored};
      if (!Array.isArray(merged.types) || !merged.types.length || merged.types.some(t=>!EXAM_TYPES.includes(t))) merged.types=[...EXAM_TYPES];
      if(!merged.counts || typeof merged.counts!=='object')merged.counts=fresh().counts;
      merged.studentName = String(merged.studentName || '同学').slice(0,30);
      if(merged.assignment){
        const original=merged.assignment;merged.assignment=checkAssignment(original);
        migrateOptionOrderRecords(merged,original,merged.assignment);
      }
      try {
        const sections=Array.isArray(merged.sections)?merged.sections:[];
        const original=merged.draft;
        const paper={sections:sections.map(s=>({...s,questions:original.filter(q=>q.sectionId===s.id)})).filter(s=>s.questions.length)};
        const valid=original.length?X.validatePaper(paper,words,EXAM_TYPES):{sections:[],questions:[]};
        merged.sections=valid.sections;merged.draft=valid.questions.map(q=>({...q,approved:original.find(o=>o.id===q.id)?.approved===true}));
      } catch {merged.draft=[];}
      return merged;
    } catch { return fresh(); }
  }
  let state=readState(), nav=studentOnly?'student':'teacher', step='select', search='', wordPage=0, quiz=null, result=null, mistakeFilter='pending';
  const AI_STORAGE='word-lab-deepseek-v1';
  function readAISettings() {
    const defaults={apiKey:'',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',mode:'direct'};
    if(studentOnly)return defaults;
    let stored=null;
    try {stored=JSON.parse(localStorage.getItem(AI_STORAGE));}catch {}
    const config=stored&&typeof stored==='object'?stored:globalThis.WORD_LAB_TEACHER_CONFIG;
    if(config&&typeof config==='object')return {...defaults,apiKey:typeof config.apiKey==='string'?config.apiKey.trim():'',model:['deepseek-flash','deepseek-v4-pro'].includes(config.model)?config.model:defaults.model,mode:config.mode==='server'?'server':'direct'};
    if(['127.0.0.1','localhost'].includes(location.hostname))defaults.mode='server';
    return defaults;
  }
  let aiSettings=readAISettings(), generation=null;
  function settingsFromForm() {
    return {apiKey:el('#ai-api-key').value.trim(),baseUrl:'https://api.deepseek.com',model:el('#ai-model').value,mode:el('#ai-mode').value};
  }
  function showAISettings() {
    if(studentOnly)return;
    modal('DeepSeek 设置',`<p class="muted small">填入 Key 后保存，以后直接点「AI 生成中考题组」。</p><div class="field" style="margin-top:18px"><label for="ai-api-key">DeepSeek API Key</label><div class="input-row"><input id="ai-api-key" type="password" autocomplete="off" spellcheck="false" value="${e(aiSettings.apiKey)}" placeholder="粘贴你的 DeepSeek API Key"><button class="btn small" data-action="toggle-ai-key">显示</button></div></div><div class="field" style="margin-top:14px"><label for="ai-model">出题模型</label><select id="ai-model"><option value="deepseek-flash" ${aiSettings.model==='deepseek-flash'?'selected':''}>DeepSeek Flash · 日常出题</option><option value="deepseek-v4-pro" ${aiSettings.model==='deepseek-v4-pro'?'selected':''}>DeepSeek V4 Pro</option></select></div><p class="helper">更换后的 Key 会记在本机浏览器，学生作业不会带上 Key。</p><details class="ai-advanced"><summary>其他连接方式</summary><div class="field"><label for="ai-mode">连接方式</label><select id="ai-mode"><option value="direct" ${aiSettings.mode==='direct'?'selected':''}>直接连接 DeepSeek（无需安装）</option><option value="server" ${aiSettings.mode==='server'?'selected':''}>已有本机出题服务</option></select></div><div class="field"><label for="ai-endpoint">已有服务接口地址</label><input id="ai-endpoint" value="${e(state.endpoint)}" placeholder="/api/generate"></div></details><p id="ai-test-status" class="helper" role="status" aria-live="polite"></p>`,btn('test-ai-connection','测试连接','check')+btn('save-ai-settings','保存设置','check','primary'));
  }
  async function testAIConnection(button) {
    const status=el('#ai-test-status');button.disabled=true;status.textContent='正在检查连接…';
    try {if(!A)throw Error('请使用最新版教师 HTML。');await A.testConnection(settingsFromForm());status.textContent='连接成功，可以开始出题。';}
    catch(error){status.textContent=error.message;}
    finally{button.disabled=false;}
  }
  function showTeacherGuide() {
    modal('老师一分钟上手',`<p class="teacher-guide-lead">输入本周词号，生成题目，确认后发给学生练习。</p><ol class="teacher-guide-steps"><li><strong>选词、出题</strong><p>填词号，如 1-100；选题型，点击「AI 生成中考题组」。</p></li><li><strong>确认、发布</strong><p>检查文章、答案和解析，勾选审核通过，再点击「继续发布」→「发布这份作业」。</p></li><li><strong>发给学生</strong><p>点击「导出学生 HTML」，把文件发给学生打开做题。学生做完后导出成绩交给老师。</p></li></ol><p class="helper">学生在「我的错词本」复习。作业和成绩保存在各自浏览器，请及时导出留存。</p>`,btn('close-modal','知道了','check','primary'));
  }
  if (globalThis.WORD_LAB_ASSIGNMENT) {
    try {state.assignment=checkAssignment(globalThis.WORD_LAB_ASSIGNMENT);} catch(error) {setTimeout(()=>toast(error.message,true),0);}
  }
  let selected=[];
  try {selected=state.selection===''?[]:C.parseSelection(state.selection,words);} catch {state.selection='1-100';selected=words.slice(0,100);}
  function toast(message,failed=false) {
    const node=el('#toast');node.textContent=message;node.className=`toast ${failed?'error-toast':''}`;node.hidden=false;
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,failed?7500:4200);
  }
  function save() {
    try {localStorage.setItem(STORAGE,JSON.stringify(state));return true;}
    catch {toast('浏览器无法保存记录。请及时导出作业和成绩，避免关闭后丢失。',true);return false;}
  }
  function student() {
    const key=`student:${state.studentName}`;
    if (!Object.hasOwn(state.students,key) || !state.students[key] || typeof state.students[key]!=='object' || Array.isArray(state.students[key])) state.students[key]={mistakes:[],history:[],progress:{}};
    const s=state.students[key];
    if (!Array.isArray(s.mistakes))s.mistakes=[];
    if (!Array.isArray(s.history))s.history=[];
    if (!s.progress || typeof s.progress!=='object' || Array.isArray(s.progress))s.progress={};
    const validAnswers=answers=>Array.isArray(answers)&&answers.every(a=>a&&typeof a.questionId==='string'&&(a.wordId===null||byId.has(a.wordId))&&typeof a.correct==='boolean'&&typeof a.answer==='string');
    s.mistakes=s.mistakes.filter(m=>m&&byId.has(m.wordId)&&Number.isSafeInteger(m.wrongCount)&&m.wrongCount>=0&&Number.isSafeInteger(m.streak)&&m.streak>=0&&typeof m.mastered==='boolean');
    s.history=s.history.filter(h=>h&&typeof h.id==='string'&&typeof h.title==='string'&&validAnswers(h.answers)&&h.answers.length>0).slice(0,500);
    for(const [key,p] of Object.entries(s.progress))if(!p||!validAnswers(p.answers)||typeof p.completed!=='boolean')delete s.progress[key];
    return s;
  }
  function ranges(ids) {
    const sorted=[...new Set(ids)].sort((a,b)=>a-b), output=[];
    for(let i=0;i<sorted.length;i++) {let start=sorted[i],end=start;while(sorted[i+1]===end+1)end=sorted[++i];output.push(start===end?String(start):`${start}-${end}`);}
    return output.join(', ');
  }
  function selectedTypes() {return [...document.querySelectorAll('[name="question-type"]:checked')].map(n=>n.value);}
  function draftPaper(questions=state.draft) {return {sections:state.sections.map(s=>({...s,questions:questions.filter(q=>q.sectionId===s.id)})).filter(s=>s.questions.length)};}
  function paperStats(paper=draftPaper()) {return X.validatePaper(paper,selected,EXAM_TYPES);}
  function heading(kicker,title,desc,action='') {return `<div class="page-intro"><div><div class="eyebrow">${e(kicker)}</div><h1>${e(title)}</h1><p class="subtitle">${e(desc)}</p></div>${action}</div>`;}
  function btn(action,text,name='arrow',kind='') {return `<button class="btn ${kind}" data-action="${e(action)}" ${action==='generate-ai'&&generation?'disabled':''}>${icon(name)}${e(text)}</button>`;}
  function empty(title,desc,action='') {return `<div class="card empty"><div class="empty-mark">${icon('book')}</div><h2>${e(title)}</h2><p>${e(desc)}</p>${action}</div>`;}
  function overview(count,subtitle='本周已选词条') {
    return `<div class="overview"><section class="week-banner"><div><div class="banner-kicker">本周词汇 · 中考题型 · 基础难度</div><h2>每天 20 词，在文章里用起来</h2><p>单项选择、完形填空、阅读理解，连接背词与实战。</p></div><div class="mini-plan" aria-label="每周五天，每天20词">${['一','二','三','四','五'].map(d=>`<div class="day-bar"><span>20</span>周${d}</div>`).join('')}</div></section><section class="summary-card"><div class="label">${e(subtitle)}</div><div class="big">${count}<small>词条</small></div><div class="foot">AI 原创中考题型 · 老师审核后练习</div></section></div>`;
  }
  function render() {
    const s=student(), pending=s.mistakes.filter(m=>!m.mastered).length;
    const items=[...(!studentOnly?[['teacher','grid','本周作业']]:[]),['student','pen','学生练习'],['mistakes','repeat','我的错词本'],['history','clock','学习记录'],['help','help','使用帮助']];
    const titles={teacher:'本周作业',student:'学生练习',mistakes:'我的错词本',history:'学习记录',help:'使用帮助'};
    const body=quiz?renderQuiz():nav==='teacher'?renderTeacher():nav==='student'?renderStudent():nav==='mistakes'?renderMistakes():nav==='history'?renderHistory():renderHelp();
    el('#app').innerHTML=`<div class="layout"><aside class="sidebar"><div class="brand"><div class="brand-mark">W</div><div><div class="brand-name">词练1.1</div><div class="brand-en">WORD LAB</div></div></div><div class="nav-caption">LEARNING WORKSPACE</div><nav class="nav" aria-label="主要导航">${items.map(([key,ico,label])=>`<button data-nav="${key}" class="${nav===key?'active':''}" ${nav===key?'aria-current="page"':''}>${icon(ico)}${label}${key==='mistakes'&&pending?`<span class="count">${pending}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note"><strong>把记忆变成使用的能力</strong><p>先练习，再看反馈。<br>错一次的词，值得再练一次。</p></div><div class="sidebar-footer">SMALL STEPS. REAL PROGRESS.</div></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">学习工作台 <span>/</span> <strong>${titles[nav]}</strong></div><div class="top-actions"><span class="status-pill"><i class="dot"></i>记录保存在本机</span>${!studentOnly?`<div class="mode-switch" aria-label="切换视角"><button data-nav="teacher" class="${nav==='teacher'?'active':''}">老师端</button><button data-nav="student" class="${nav!=='teacher'?'active':''}">学生端</button></div>`:'<span class="tag">学生练习版</span>'}<div class="avatar">${nav==='teacher'?'师':'学'}</div></div></header><main id="main">${body}</main></div></div>`;
    if(nav==='teacher' && step==='select' && !quiz)renderWordRows();
  }
  function renderTeacher() {
    const approved=state.draft.filter(q=>q.approved).length;
    return heading('TEACHER WORKSPACE','用这一周的词，练中考题型。','输入本周词号，生成题目，确认后发给学生练习。',`<div class="row">${btn('teacher-guide','老师一分钟上手','help')}${btn('import-assignment','导入作业','upload','small')}</div>`)+
      overview(selected.length)+`<div class="steps" role="tablist" aria-label="作业制作步骤">${[['select','1','选词与出题'],['review','2',`审核题目${state.draft.length?` · ${state.draft.length}`:''}`],['publish','3','发布作业']].map(([id,n,t])=>`<button role="tab" aria-selected="${step===id}" class="${step===id?'active':''}" data-step="${id}"><span class="step-index">${n}</span>${t}</button>`).join('')}</div>`+
      (step==='select'?renderSelection():step==='review'?renderReview(approved):renderPublish(approved))+
      `<div class="footer-note">${icon('shield')}附件已核对：${words.length} 条词条；练习编号按原文顺序编排，原章节与原序号保留在词条中。</div>`;
  }
  function renderSelection() {
    const max=Math.max(...words.map(w=>w.id));
    return `<div class="teacher-grid"><section class="card"><div class="card-heading"><h2><span class="section-number">1</span>选择本周已学词汇</h2><span class="tag">${words.length} 词条词表</span></div><div class="field"><label for="range-input">输入练习编号或范围</label><div class="input-row"><input id="range-input" value="${e(state.selection)}" placeholder="例如 1-100，105，110-120"><button class="btn soft" data-action="apply-range">应用序号</button></div><p class="helper">支持连续范围和多个编号，例如：1-20，35，50-60</p></div><div class="quick-select"><span class="small muted">按周选择</span>${Array.from({length:Math.ceil(max/100)},(_,i)=>{const a=i*100+1,b=Math.min((i+1)*100,max);return `<button data-range="${a}-${b}" class="${state.selection===`${a}-${b}`?'active':''}">第 ${i+1} 周</button>`;}).join('')}</div><div class="table-toolbar"><div class="small"><strong id="selected-count">${selected.length}</strong><span class="muted"> 个词条已选择</span></div><input id="word-search" type="search" aria-label="搜索词表" value="${e(search)}" placeholder="搜索单词、词义或编号"></div><div class="word-table-wrap"><table class="word-table"><thead><tr><th style="width:32px"><span class="sr-only">选择</span></th><th>编号</th><th>单词 / 词性</th><th>中文释义</th></tr></thead><tbody id="word-rows"></tbody></table></div><div class="table-footer"><span id="word-page-label"></span><div class="row"><button class="btn small" data-action="word-prev">上一页</button><button class="btn small" data-action="word-next">下一页</button></div></div></section><section class="card"><div class="card-heading"><h2><span class="section-number">2</span>选择中考题型</h2><span class="tag gray">基础难度</span></div><div class="type-list">${[['single','pen','单项选择','完整句子或短对话，四选一。'],['cloze','file','完形填空','一篇连贯短文，8 个编号空，四选一。'],['reading','book','阅读理解','完整文章，5 题，含细节与主旨理解。']].map(([id,ico,title,desc])=>`<label class="type-card ${state.types.includes(id)?'checked':''}"><input type="checkbox" name="question-type" value="${id}" ${state.types.includes(id)?'checked':''}><span class="type-icon">${icon(ico)}</span><span><strong>${title}</strong><p>${desc}</p></span></label>`).join('')}</div><div class="exam-counts">${[['single','单选 / 题',50],['cloze','完形 / 篇',5],['reading','阅读 / 篇',5]].map(([key,label,max])=>`<div class="field"><label for="count-${key}">${label}</label><input id="count-${key}" type="number" min="1" max="${max}" value="${state.counts[key]}"></div>`).join('')}</div><div class="generation-note">建议 100 词搭配 20 道单选、2 篇完形、2 篇阅读，分成 5 个题组。AI 用本周词汇组织语篇，分别统计语境覆盖与直接考查。</div><div class="generation-actions">${btn('generate-ai','AI 生成中考题组','spark','primary')}${btn('load-sample','查看中考题型示例','book')}</div><div class="generation-footer"><button class="btn text small" data-action="prompt">导出 AI 提示词</button><button class="btn text small" data-action="import-questions">导入 AI 题组</button><button class="btn text small" data-action="ai-settings">${icon('settings')}DeepSeek 设置</button></div><p class="ai-config-summary">${aiSettings.mode==='server'?'使用已有出题服务':aiSettings.apiKey?'DeepSeek 已配置 · 可直接出题':'首次使用：在下方 DeepSeek 设置中粘贴 Key'}</p><div id="generation-status" class="helper" aria-live="polite"></div><button id="cancel-ai" class="btn text small" data-action="cancel-ai" ${generation?'':'hidden'}>停止出题</button><p class="helper">AI 原创 · 参照中考题型，不标为历年真题。</p></section></div>`;
  }
  function filteredWords() {const term=search.trim().toLowerCase();return words.filter(w=>!term || `${w.id} ${w.word} ${w.meaning} ${w.pos}`.toLowerCase().includes(term));}
  function renderWordRows() {
    const filtered=filteredWords(), pages=Math.max(1,Math.ceil(filtered.length/50));wordPage=Math.min(Math.max(0,wordPage),pages-1);
    const ids=new Set(selected.map(w=>w.id));
    el('#word-rows').innerHTML=filtered.slice(wordPage*50,wordPage*50+50).map(w=>`<tr class="${ids.has(w.id)?'selected':''}"><td><input type="checkbox" data-word="${w.id}" aria-label="选择 ${e(w.word)} 编号 ${w.id}" ${ids.has(w.id)?'checked':''}></td><td class="number">${String(w.id).padStart(3,'0')}</td><td><span class="word">${e(w.word)}</span> <span class="small muted">${e(w.pos)}</span><div class="small muted" title="${e(w.section)}">原章节第 ${w.sourceNumber} 条</div></td><td>${e(w.meaning)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">没有找到匹配词条。</td></tr>';
    el('#word-page-label').textContent=`第 ${wordPage+1} / ${pages} 页 · 共 ${filtered.length} 条`;
  }
  function renderReview(approved) {
    if(!state.draft.length)return empty('先生成一份中考题型练习','选词和题型后，调用 AI 生成，或导入外部 AI 返回的题组。没有 Key 时可先查看原创示例。',btn('back-select','返回选词','arrow','primary'));
    const stats=paperStats();
    return `<div class="card review-toolbar row between"><div><strong>${state.draft.length} 道题 · ${state.sections.length} 个题组</strong><p class="muted small">${approved} 道已审核 · ${state.source==='sample'?'原创示例':state.source==='import'?'老师导入':'AI 原创'} · 语境覆盖 ${stats.coveredWordIds.length} 词 / 直接考查 ${stats.testedWordIds.length} 词</p></div><div class="row">${btn('approve-all','全部标记已审核','check','small')}${btn('go-publish','继续发布','arrow','primary small')}</div></div><div class="notice">请检查文章连贯性、难度和答案依据。完形、阅读按整篇题组审核与选用；单选可逐题选择。关联词号决定答错后进入错词本的词，阅读题可留空。</div><div class="question-list">${state.sections.map(s=>{const qs=state.draft.filter(q=>q.sectionId===s.id);return `<section class="card exam-section"><div class="card-heading"><div><span class="tag">${typeNames[s.type]}</span><h2 style="margin-top:8px">${e(s.title)}</h2><p class="small muted">${qs.length} 道题${s.passage?' · 完整语篇':''}</p></div><div><label class="approve-label"><input type="checkbox" data-approve-section="${e(s.id)}" ${qs.every(q=>q.approved)?'checked':''}>整组审核通过</label>${s.passage?`<button class="btn text small" data-edit-section="${e(s.id)}">修改文章</button>`:''}</div></div>${s.passage?`<div class="exam-passage">${e(s.passage)}</div>`:''}<div class="question-list">${qs.map((q,i)=>`<article class="review-card ${q.approved?'approved':''}"><div class="review-top"><div class="row"><span class="tag gray">${String(i+1).padStart(2,'0')}</span><span class="muted small">${q.wordIds.length?'关联词：'+q.wordIds.map(id=>'#'+id+' '+e(byId.get(id).word)).join('、'):'阅读理解 · 未标注词汇考点'}</span></div>${s.type==='single'?`<label class="approve-label"><input type="checkbox" data-approve="${e(q.id)}" ${q.approved?'checked':''}>选用并审核</label>`:''}</div><p class="question-prompt">${e(q.prompt)}</p><div class="question-options">${q.options.map((o,n)=>`<div class="question-option ${o===q.answer?'correct':''}">${'ABCD'[n]}. ${e(o)}</div>`).join('')}</div><p class="answer-line">答案：${e(q.answer)}</p><p class="explanation">${e(q.explanation)}</p><div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn text small" data-edit="${e(q.id)}">${icon('pen')}修改题目与关联词</button></div></article>`).join('')}</div></section>`;}).join('')}</div>`;
  }
  function renderPublish(approved) {
    const qs=state.draft.filter(q=>q.approved);
    if(!approved)return empty('审核后再发布','请审核并选择需要学生练习的题目或整篇题组。',btn('go-review','去审核题目','check','primary'));
    const paper=paperStats(draftPaper(qs)), covered=new Set(paper.coveredWordIds),missing=selected.filter(w=>!covered.has(w.id));
    return `<section class="card publish-panel"><div class="card-heading"><h2>发布本周中考题型练习</h2><span class="tag">原创专项练习</span></div><div class="field"><label for="assignment-title">作业名称</label><input id="assignment-title" maxlength="100" value="${e(state.title)}"></div><div class="publish-stats"><div><strong>${qs.length}</strong><span>审核题目</span></div><div><strong>${paper.sections.length}</strong><span>完整题组</span></div><div><strong>${covered.size}</strong><span>语境覆盖词条</span></div></div><p class="small muted">直接考查 ${paper.testedWordIds.length} 个词条。语境覆盖按单词及常见词形匹配统计，老师需核对目标词义。</p>${missing.length?`<div class="notice">本周选中 ${selected.length} 词，尚未匹配到 ${missing.length} 词：${missing.slice(0,12).map(w=>e(w.word)).join('、')}${missing.length>12?'…':''}。<label style="display:block;margin-top:8px"><input id="partial-confirm" type="checkbox">我已核对，先发布这份练习</label></div>`:'<div class="notice info">所选词条均已匹配到练习语境。完形和阅读保留完整文章，学生按题组逐次完成。</div>'}<div class="row">${btn('publish','发布这份作业','check','primary')}${btn('go-review','返回审核','pen')}</div>${state.assignment?`<div class="export-actions">${btn('export-html','导出学生 HTML','download')}${btn('export-assignment','导出作业 JSON','file')}${btn('go-student','去学生端练习','arrow','soft')}</div><p class="helper">当前已发布：${e(state.assignment.title)}。学生 HTML 可直接双击、离线练习。</p>`:''}</section>`;
  }
  function profile() {return `<div class="profile-bar"><div class="profile-form"><label for="student-name">学生姓名 / 昵称</label><input id="student-name" maxlength="30" value="${e(state.studentName)}"><button class="btn small" data-action="save-name">保存姓名</button></div><span class="small muted">记录按姓名分别保存在当前浏览器</span></div>`;}
  function days() {
    const a=state.assignment;if(!a)return[];
    const pool=a.wordIds.map(id=>byId.get(id));
    return a.sections.map((section,index)=>({index,section,questions:section.questions,ids:X.coverageFor([section.passage,...section.questions.map(q=>q.prompt+' '+q.options.join(' '))].join(' '),pool)}));
  }
  function assignmentKey(assignment) {
    const text=JSON.stringify(assignment.sections.map(s=>({type:s.type,passage:s.passage,questions:s.questions})));let hash=2166136261;
    for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
    return `${assignment.id}:${(hash>>>0).toString(36)}`;
  }
  function migrateOptionOrderRecords(saved,previous,current) {
    try{
      const content=a=>JSON.stringify(a.sections.map(s=>({id:s.id,type:s.type,passage:s.passage,questions:s.questions.map(q=>({id:q.id,prompt:q.prompt,answer:q.answer,wordIds:q.wordIds,blankNumber:q.blankNumber,options:[...q.options].sort()}))})));
      if(content(previous)!==content(current))return;
      const before=assignmentKey(previous),after=assignmentKey(current);if(before===after)return;
      const oldPrefix=before+':day:',newPrefix=after+':day:';
      for(const learner of Object.values(saved.students)){
        if(!learner||typeof learner!=='object')continue;
        if(learner.progress&&typeof learner.progress==='object'&&!Array.isArray(learner.progress)){
          for(const [key,value] of Object.entries(learner.progress))if(key.startsWith(oldPrefix)){
            const next=newPrefix+key.slice(oldPrefix.length);
            if(!Object.hasOwn(learner.progress,next))learner.progress[next]=value;
            delete learner.progress[key];
          }
        }
        if(Array.isArray(learner.history))for(const entry of learner.history)if(entry&&typeof entry.id==='string'&&entry.id.startsWith(oldPrefix))entry.id=newPrefix+entry.id.slice(oldPrefix.length);
      }
      stateMigrated=true;
    }catch{/* Invalid saved records are handled by the normal state validator. */}
  }
  function renderStudent() {
    const a=state.assignment;
    const head=heading('STUDENT WORKSPACE','把这一周的词，用在中考题里。',a?`${a.title} · 老师已审核 · 原创专项练习`:'导入老师发来的作业，开始单选、完形与阅读练习。',btn('import-assignment','导入作业','upload'));
    if(result)return head+renderResult();
    if(!a)return head+profile()+empty('还没有发布的作业','老师选词、生成并审核完整题组后，即可发布和导出。',!studentOnly?btn('go-teacher','去老师端制作作业','arrow','primary'):'');
    const s=student();
    return head+profile()+overview(a.wordIds.length,'本周学习词汇')+`<div class="card-heading"><h2>我的中考题型练习</h2><span class="small muted">建议每天完成 1 组，保持完形与阅读文章完整</span></div><div class="day-grid">${days().map(d=>{const p=s.progress[`${assignmentKey(a)}:day:${d.index}`], n=p?.answers?.length||0,total=d.questions.length;return `<article class="card day-card"><div class="row between"><span class="day-number">GROUP ${String(d.index+1).padStart(2,'0')}</span><span class="tag ${n>=total?'':'gray'}">${n>=total?'已完成':n?'进行中':'待练习'}</span></div><h3>第 ${d.index+1} 组 · ${typeNames[d.section.type]}</h3><p class="small muted">${e(d.section.title)}</p><div class="words-preview" style="margin-top:10px">语境关联 ${d.ids.length} 个本周词条 · ${d.questions.length} 道题<br>${d.ids.slice(0,4).map(id=>e(byId.get(id).word)).join(' · ')}${d.ids.length>4?' …':''}</div><div class="progress"><span style="width:${Math.min(100,n/total*100)}%"></span></div><p class="small muted" style="margin-bottom:15px">已完成 ${n} / ${total} 题</p><button class="btn ${n>=total?'':'primary'}" data-start-day="${d.index}">${icon(n>=total?'check':'arrow')}${n>=total?'查看练习结果':n?'继续练习':'开始练习'}</button></article>`;}).join('')}</div><div class="footer-note">${icon('repeat')}答错时，老师标注的考点词进入错词本。阅读理解题不会把全文所有词计为错词。</div>`;
  }
  function startDay(index) {
    const d=days()[index];if(!d)throw Error('找不到本日作业。');
    const key=`${assignmentKey(state.assignment)}:day:${index}`, s=student();
    const progress=s.progress[key] ||= {answers:[],completed:false};
    if(progress.completed){result={answers:progress.answers,title:d.section.title,section:d.section,review:false,key};nav='student';render();return;}
    quiz={questions:d.questions,index:progress.answers.length,answers:progress.answers,selected:'',submitted:false,key,title:d.section.title,section:d.section,review:false};
    if(quiz.index>=quiz.questions.length){finishQuiz();return;}
    nav='student';result=null;render();focusAnswer();
  }
  function startMistakes() {
    const list=student().mistakes.filter(m=>!m.mastered).map(m=>byId.get(m.wordId)).filter(Boolean);
    if(!list.length){toast('目前没有需要复练的错词。');return;}
    const qs=C.generateBasic(list,['spelling','meaning']);
    quiz={questions:qs,index:0,answers:[],selected:'',submitted:false,key:`review:${Date.now()}`,title:'错词巩固',review:true};nav='mistakes';result=null;render();focusAnswer();
  }
  function focusAnswer() {setTimeout(()=>el('#answer-input')?.focus(),0);}
  function renderQuiz() {
    const q=quiz.questions[quiz.index], w=q.wordId?byId.get(q.wordId):null,section=quiz.section;
    const passageIds=section?.passage?X.coverageFor(section.passage,state.assignment.wordIds.map(id=>byId.get(id))):[];
    const picker=passageIds.length?`<details class="passage-wordpicker"><summary>标记这篇里不熟悉的词</summary><p class="helper">主动标记的词进入错词本，不计为答错次数。这里仅列本周词汇池中的词。</p><div class="row" style="margin-top:12px">${passageIds.map(id=>{const old=student().mistakes.find(m=>m.wordId===id);return `<button class="btn small ${old&&!old.mastered?'soft':''}" data-mark-word="${id}">${e(byId.get(id).word)}${old&&!old.mastered?' · 已收进':''}</button>`;}).join('')}</div></details>`:'';
    const passage=section?.passage?`<section class="card passage-card"><div class="card-heading"><h2>${e(section.title)}</h2><span class="tag">${typeNames[section.type]}</span></div><div class="exam-passage">${e(section.passage).replace(/\[(\d+)\]/g,(match,n)=>`<span class="passage-blank ${Number(n)===q.blankNumber?'current':''}">${match}</span>`)}</div>${picker}</section>`:'';
    return `<div class="quiz-wrap"><div class="quiz-header"><div class="row between"><button class="btn text small" data-action="exit-quiz">← 返回${quiz.review?'错词本':'练习题组'}</button><span class="tag">${e(quiz.title)}</span></div><div class="progress"><span style="width:${quiz.index/quiz.questions.length*100}%"></span></div><div class="quiz-progress-row"><span>${e(state.studentName)} · 先读题，再作答</span><span>${quiz.index+1} / ${quiz.questions.length}</span></div></div>${passage}<section class="card quiz-card" data-question-id="${e(q.id)}"><div class="row"><span class="tag">${typeNames[q.type]}</span><span class="small muted">${q.blankNumber?'第 '+q.blankNumber+' 空':'第 '+(quiz.index+1)+' 题'}</span>${quiz.submitted&&w?`<button class="btn text small word-audio" data-speak="${w.id}" aria-label="朗读关联词">${icon('volume')}听发音</button>`:''}</div><h1 class="question-prompt">${e(q.prompt)}</h1>${q.options.length?`<div class="quiz-options">${q.options.map((o,i)=>`<button class="quiz-option ${quiz.selected===o?'selected':''} ${quiz.submitted?(o===q.answer?'correct':quiz.selected===o?'wrong':''):''}" data-answer="${e(o)}" ${quiz.submitted?'disabled':''}><span class="option-letter">${'ABCD'[i]}</span><span>${e(o)}</span></button>`).join('')}</div>`:`<label for="answer-input" class="sr-only">输入英语答案</label><input id="answer-input" class="answer-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="在这里写出你的答案" value="${e(quiz.selected)}" ${quiz.submitted?'disabled':''}>`}${quiz.submitted?`<div class="feedback ${quiz.correct?'':'wrong'}" role="status"><strong>${quiz.correct?'答对了，继续保持！':'本题答错了，请看答案与解析。'}</strong><p>正确答案：<b>${e(q.answer)}</b></p><p>${e(q.explanation)}</p>${!quiz.correct?`<p>${(q.wordIds?.length||q.wordId)?'已将关联词加入错词本。':'本题未标注词汇考点；阅读答错不会将全文单词加入错词本。'}</p>`:''}</div>`:''}<div class="quiz-actions"><small>首次提交计入成绩。文章在每道题作答时都可查看。</small>${quiz.submitted?btn('next-question',quiz.index+1===quiz.questions.length?'查看结果':'下一题','arrow','primary'):btn('submit-answer','提交答案','check','primary')}</div></section></div>`;
  }
  function submitAnswer() {
    if(!quiz || quiz.submitted)return;
    if(el('#answer-input'))quiz.selected=el('#answer-input').value;
    if(!quiz.selected.trim()){toast('请先选择或填写答案。');return;}
    const q=quiz.questions[quiz.index],correct=C.gradeAnswer(q,quiz.selected),s=student();
    quiz.correct=correct;quiz.submitted=true;
    const ids=q.wordIds||(q.wordId?[q.wordId]:[]);
    quiz.answers.push({questionId:q.id,wordId:q.wordId??null,wordIds:ids,type:q.type,answer:quiz.selected,correct,at:new Date().toISOString()});
    // A normal correct answer does not count as a correction exercise for an old mistake.
    if(!correct || quiz.review)for(const id of ids)s.mistakes=C.updateMistake(s.mistakes,byId.get(id),correct);
    if(!quiz.review)s.progress[quiz.key]={answers:quiz.answers,completed:false};
    save();render();
  }
  function finishQuiz() {
    const s=student(), record={id:quiz.key,title:quiz.title,assignment:state.assignment?.title||'错词练习',answers:[...quiz.answers],review:quiz.review,at:new Date().toISOString()};
    if(!s.history.some(h=>h.id===record.id))s.history.unshift(record);
    if(!quiz.review)s.progress[quiz.key]={answers:quiz.answers,completed:true};
    result=record;quiz=null;nav='student';save();render();
  }
  function renderResult() {
    const answers=result.answers,correct=answers.filter(a=>a.correct).length,wrongQuestions=answers.filter(a=>!a.correct),wrong=[...new Set(wrongQuestions.flatMap(a=>a.wordIds||(a.wordId?[a.wordId]:[])))];
    return `<div class="card result-hero"><span class="tag">${e(result.title)} · 已完成</span><h2>这一组，完成了！</h2><p>看懂答案依据，再去错词本巩固相关词汇。</p></div><div class="stats-row"><div class="stat-item"><strong>${Math.round(correct/answers.length*100)}%</strong><span>本次正确率</span></div><div class="stat-item"><strong>${correct} / ${answers.length}</strong><span>首次提交答对</span></div><div class="stat-item"><strong>${wrongQuestions.length}</strong><span>本次答错题目</span></div></div>${wrong.length?`<div class="notice">本次关联待复习词：${wrong.map(id=>e(byId.get(id)?.word)).join('、')}。阅读理解的判断错误与单词不熟悉可能不同，请结合解析巩固。</div>`:''}<div class="row">${btn('go-mistakes','去错词本巩固','repeat','primary')}${btn('result-back','返回练习题组','arrow')}${btn('export-results','导出我的成绩','download')}</div>`;
  }
  function renderMistakes() {
    const s=student(),pending=s.mistakes.filter(m=>!m.mastered).length;
    const list=s.mistakes.filter(m=>mistakeFilter==='all' || (mistakeFilter==='mastered'?m.mastered:!m.mastered));
    return heading('MY WORD NOTEBOOK','容易忘的词，再练一次。','先看词义，再试着自己写出。连续两次复练正确，标记为已巩固。',btn('review-mistakes','开始错词复练','repeat','primary'))+profile()+`<div class="stats-row"><div class="stat-item"><strong>${pending}</strong><span>待巩固词条</span></div><div class="stat-item"><strong>${s.mistakes.filter(m=>m.mastered).length}</strong><span>已巩固词条</span></div><div class="stat-item"><strong>${s.mistakes.length}</strong><span>累计错词条目</span></div></div><div class="steps">${[['pending','待巩固'],['mastered','已巩固'],['all','全部错词']].map(([key,label])=>`<button data-filter="${key}" class="${mistakeFilter===key?'active':''}">${label}</button>`).join('')}</div>${list.length?`<div class="mistake-grid">${list.map(m=>{const w=byId.get(m.wordId);if(!w)return'';return `<article class="card mistake-card"><div class="row between"><span class="small muted">#${w.id} · ${e(w.pos)}</span><button class="btn text small" data-speak="${w.id}" aria-label="朗读 ${e(w.word)}">${icon('volume')}</button></div><p class="word">${e(w.word)}</p><p class="meaning">${e(w.meaning)}</p><div class="row between"><span class="muted">答错 ${m.wrongCount} 次</span><span class="tag ${m.mastered?'':'amber'}">${m.mastered?'已巩固':`连续正确 ${m.streak} / 2`}</span></div></article>`;}).join('')}</div>`:empty(mistakeFilter==='pending'?'目前没有待巩固的错词':'这里还没有记录',mistakeFilter==='pending'?'完成每日练习后，答错的词会出现在这里。':'切换筛选查看其他词条，或去做一组每日练习。',btn('go-student','去做每日练习','arrow','soft'))}`;
  }
  function renderHistory() {
    const s=student();
    return heading('MY LEARNING RECORD','每次练习，都看得见进步。','这里展示当前学生在此浏览器完成的练习。',btn('export-results','导出我的成绩','download'))+profile()+(s.history.length?`<div class="history-list">${s.history.map(h=>{const correct=h.answers.filter(a=>a.correct).length;return `<article class="card history-row"><div><strong>${e(h.title)}</strong> <span class="tag ${h.review?'amber':'gray'}">${h.review?'错词复练':'每日练习'}</span><p class="small muted">${e(h.assignment)} · ${new Date(h.at).toLocaleString('zh-CN')} · ${h.answers.length} 题</p></div><div class="history-score">${Math.round(correct/h.answers.length*100)}<small>%</small></div></article>`;}).join('')}</div>`:empty('从第一份练习开始','完成每日练习后，你的首次提交成绩会记录在这里。',btn('go-student','开始每日练习','arrow','primary')));
  }
  function renderHelp() {
    return heading('QUICK GUIDE','输入词号，生成题目，发给学生。','老师确认后练习，学生做完复习错词。')+`<div class="help-grid">${!studentOnly?`<section class="card"><h2>老师每周只做三步</h2><ol><li><strong>选词出题：</strong>填本周词号，如 1–100，选题型，点「AI 生成中考题组」。</li><li><strong>审核发布：</strong>检查文章、答案和解析，确认选用后点「继续发布」→「发布这份作业」。</li><li><strong>发给学生：</strong>点「导出学生 HTML」，把文件发给学生。学生做完导出成绩交给老师。</li></ol><div class="row">${btn('teacher-guide','老师一分钟上手','help','small')}</div></section>`:''}<section class="card"><h2>学生这样练</h2><ol><li>打开老师发的 HTML，填写姓名并保存。</li><li>选题组开始练习，提交答案后看中文解析。</li><li>到「我的错词本」复习，连续两次复练正确可标记巩固。</li><li>做完点击「导出我的成绩」，把文件交给老师。</li></ol></section>${!studentOnly?`<section class="card"><h2>DeepSeek 已在页面内设置</h2><p>${aiSettings.apiKey?'这份教师文件已配置 Key，直接选词出题即可。':'首次使用，粘贴 DeepSeek API Key 并保存。'} 无需安装程序或运行命令，出题时需要联网。</p><p>更换 Key 或模型时点击下方设置。学生 HTML 不携带 Key；预配置 Key 的教师文件只发给负责出题的老师。</p><div class="row" style="margin-top:15px">${btn('ai-settings','DeepSeek 设置','settings','small')}</div></section>`:''}<section class="card"><h2>作业与记录</h2><p>发布后要把导出的学生 HTML 发给学生，只分享网站地址不会带上作业。成绩保存在各自浏览器里，换设备前请导出留存；暂不自动汇总全班成绩。</p><p>词表共 ${words.length} 条，编号按原文顺序。示例只用于试用流程，真实 AI 出题使用老师选中的词。文章出现某词不代表该词已被直接考查。</p></section></div>`;
  }
  function checkAssignment(raw) {
    if(!raw || raw.kind!=='word-lab-assignment' || raw.version!==2 || typeof raw.id!=='string' || !raw.id || raw.id.length>100 || typeof raw.title!=='string' || !raw.title.trim() || raw.title.length>100 || !Array.isArray(raw.wordIds) || !raw.wordIds.length || raw.wordIds.length>words.length || new Set(raw.wordIds).size!==raw.wordIds.length)throw Error('作业文件格式无效。请导入本程序导出的中考题组 JSON。');
    const ws=raw.wordIds.map(id=>byId.get(id));if(ws.some(w=>!w))throw Error('作业包含当前词表中不存在的词条编号。');
    const paper=X.validatePaper(raw.paper,ws,EXAM_TYPES);
    return {kind:'word-lab-assignment',version:2,id:raw.id,title:raw.title.trim(),wordIds:ws.map(w=>w.id),paper,questions:paper.questions,sections:paper.sections,createdAt:typeof raw.createdAt==='string'?raw.createdAt:new Date().toISOString(),source:['ai','sample','import'].includes(raw.source)?raw.source:'import'};
  }
  function checkDraft() {
    const rangeInput=el('#range-input');
    if(rangeInput&&rangeInput.value.trim()!==state.selection){
      selected=C.parseSelection(rangeInput.value,words);state.selection=ranges(selected.map(w=>w.id));wordPage=0;rangeInput.value=state.selection;
      if(el('#selected-count'))el('#selected-count').textContent=selected.length;renderWordRows();
    }
    if(!selected.length)throw Error('请至少选择一个词条。');
    const types=selectedTypes();if(!types.length)throw Error('请至少选择一种中考题型。');
    for(const type of EXAM_TYPES){const input=el('#count-'+type);if(input){const n=Number(input.value),max=type==='single'?50:5;if(!Number.isInteger(n)||n<1||n>max)throw Error(`${typeNames[type]}数量须为 1–${max}。`);state.counts[type]=n;}}
    state.types=types;save();return types;
  }
  function setDraft(raw,source) {
    const valid=X.validatePaper(raw,selected,state.types);
    state.sections=valid.sections;state.draft=valid.questions.map(q=>({...q,approved:false}));state.source=source;save();step='review';render();toast(`生成 ${valid.sections.length} 个题组、${valid.questions.length} 道题，请老师审核。`);
  }
  function applyRange(value) {selected=C.parseSelection(value,words);state.selection=ranges(selected.map(w=>w.id));wordPage=0;save();render();}
  function download(name,content,mime='application/json') {
    const blob=new Blob([content],{type:`${mime};charset=utf-8`}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function safeName(value){return String(value).replace(/[\\/:*?"<>|]/g,'_').slice(0,70);}
  function modal(title,body,footer='') {
    const d=el('#modal');d.innerHTML=`<div class="card-heading"><h2 id="modal-title">${e(title)}</h2><button class="close-btn" data-action="close-modal" aria-label="关闭">×</button></div>${body}${footer?`<div class="row" style="justify-content:flex-end;margin-top:20px">${footer}</div>`:''}`;d.showModal();
  }
  function showPrompt() {
    if(!selected.length)throw Error('请先选择词条。');
    if(nav==='teacher' && step==='select')checkDraft();
    const value=X.makePrompt(selected,state.types,state.counts);
    modal('复制到你使用的 AI 工具',`<p class="muted small" style="margin-bottom:14px">让 AI 按提示词输出完整 JSON，再用「导入 AI 题目」载入审核。围绕 ${selected.length} 个词条生成单选、完整完形和阅读题组。</p><textarea id="prompt-text" aria-label="AI 出题提示词" readonly>${e(value)}</textarea>`,btn('download-prompt','下载提示词','download')+btn('copy-prompt','复制提示词','file','primary'));
  }
  function editQuestion(id) {
    const q=state.draft.find(q=>q.id===id);if(!q)return;
    modal('修改中考题目',`<div class="edit-grid"><p class="small muted">${typeNames[q.type]}。修改后，所在题组需要重新审核。</p><div class="field"><label for="edit-prompt">题干</label><textarea id="edit-prompt" style="min-height:85px">${e(q.prompt)}</textarea></div><div class="field"><label for="edit-options">四个选项（每行一个）</label><textarea id="edit-options" style="min-height:100px">${e(q.options.join('\n'))}</textarea></div><div class="field"><label for="edit-answer">标准答案（与一个选项完全一致）</label><input id="edit-answer" value="${e(q.answer)}"></div><div class="field"><label for="edit-word-ids">词汇考点编号（用逗号分隔，最多 3 个；阅读题可留空）</label><input id="edit-word-ids" value="${q.wordIds.join(', ')}"><p class="helper">答错后只将这些明确关联的词加入错词本。</p></div><div class="field"><label for="edit-explanation">中文解析与原文依据</label><textarea id="edit-explanation" style="min-height:80px">${e(q.explanation)}</textarea></div><input type="hidden" id="edit-id" value="${e(id)}"></div>`,btn('save-question','保存修改','check','primary'));
  }
  function editSection(id) {
    const section=state.sections.find(s=>s.id===id);if(!section)return;
    modal('修改完整文章',`<div class="edit-grid"><div class="field"><label for="section-title">题组标题</label><input id="section-title" value="${e(section.title)}"></div><div class="field"><label for="section-passage">文章${section.type==='cloze'?'（保留 [1]、[2] 等编号空）':''}</label><textarea id="section-passage" style="min-height:280px">${e(section.passage)}</textarea></div><input type="hidden" id="section-id" value="${e(id)}"></div>`,btn('save-section','保存文章','check','primary'));
  }
  function openImport(mode) {el('#file-input').dataset.mode=mode;el('#file-input').value='';el('#file-input').click();}
  async function exportHTML() {
    if(!state.assignment)throw Error('请先发布作业。');
    const assets=globalThis.WORD_LAB_ASSETS;if(!assets)throw Error('请先运行 node tools/package.js 生成导出资源，或使用交付的单文件版。');
    const scriptSafe=text=>text.replace(/<\/script/gi,'<\\/script');
    const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c');
    const config=`globalThis.WORD_LAB_STUDENT_ONLY=true;globalThis.WORD_LAB_ASSIGNMENT=${literal(state.assignment)};`;
    const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(state.assignment.title)} · 词练1.1</title><style>${assets.css.replace(/<\/style/gi,'<\\/style')}</style></head><body><a class="skip-link" href="#main">跳到主要内容</a><div id="app"></div><div id="toast" class="toast" role="status" aria-live="polite" hidden></div><dialog id="modal" aria-labelledby="modal-title"></dialog><input id="file-input" type="file" accept=".json,application/json" hidden><script>${scriptSafe(assets.vocabulary)}<\/script><script>${scriptSafe(assets.core)}<\/script><script>${scriptSafe(assets.exam)}<\/script><script>${config}<\/script><script>${scriptSafe(assets.app)}<\/script></body></html>`;
    download(`${safeName(state.assignment.title)}-学生练习.html`,html,'text/html');toast('学生练习 HTML 已导出，可离线打开。');
  }
  async function generateAI(button) {
    if(generation)throw Error('正在出题，请等待完成。');
    checkDraft();
    if(aiSettings.mode==='direct'&&!aiSettings.apiKey){showAISettings();el('#ai-test-status').textContent='首次使用，请填入 DeepSeek Key 并保存。';return;}
    const requestIds=selected.map(w=>w.id),requestTypes=[...state.types],requestCounts={...state.counts};
    const requestDraft=JSON.stringify({draft:state.draft,sections:state.sections,assignment:state.assignment,source:state.source});
    button.disabled=true;const status=el('#generation-status');
    if(status)status.textContent=`正在围绕 ${selected.length} 个词条生成中考题组，请稍候…`;
    const jobs=(requestTypes.includes('single')?1:0)+(requestTypes.includes('cloze')?requestCounts.cloze:0)+(requestTypes.includes('reading')?requestCounts.reading:0);
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),Math.max(180000,jobs*180000));generation=control;
    if(el('#cancel-ai'))el('#cancel-ai').hidden=false;
    try {
      let body;
      if(aiSettings.mode==='direct'){
        if(!A)throw Error('请使用最新版教师 HTML。');
        body=await A.generatePaper({wordIds:requestIds,types:requestTypes,counts:requestCounts},{...aiSettings},{words,exam:X,signal:control.signal,onProgress:progress=>{const current=el('#generation-status');if(current)current.textContent=progress.message;}});
      }else{
      if(location.protocol==='file:' && state.endpoint.startsWith('/'))throw Error('请在 DeepSeek 设置中选择「直接连接 DeepSeek」，即可双击文件出题。');
      const res=await fetch(state.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wordIds:requestIds,types:requestTypes,counts:requestCounts}),signal:control.signal});
      if(res.status===404)throw Error('AI 出题服务尚未接通。现在可以使用「导出 AI 提示词」和「导入 AI 题组」。');
      const text=await res.text();if(text.length>4*1024*1024)throw Error('AI 返回内容过大。');
      try{body=JSON.parse(text);}catch{throw Error('AI 出题服务尚未接通。请先导出 AI 提示词，生成后导入 AI 题组。');}
      if(!res.ok)throw Error(body.error||'AI 出题失败，请检查服务设置。');
      }
      if(selected.map(w=>w.id).join(',')!==requestIds.join(',') || state.types.join(',')!==requestTypes.join(',') || JSON.stringify(state.counts)!==JSON.stringify(requestCounts) || el('#range-input')&&el('#range-input').value.trim()!==state.selection)throw Error('出题期间选词或题型已改变，请按当前设置重新生成。');
      if(JSON.stringify({draft:state.draft,sections:state.sections,assignment:state.assignment,source:state.source})!==requestDraft)throw Error('出题期间作业已修改，已保留你的修改，请重新生成。');
      setDraft(body.paper,'ai');
    }catch(error){if(el('#generation-status'))el('#generation-status').textContent='生成未完成，原作业仍保留。';throw control.signal.aborted?Error('已停止出题，原作业仍保留。'):error;}
    finally{clearTimeout(timer);generation=null;button.disabled=false;document.querySelectorAll('[data-action="generate-ai"]').forEach(node=>node.disabled=false);if(el('#cancel-ai'))el('#cancel-ai').hidden=true;}
  }
  const handlers={
    'apply-range':()=>applyRange(el('#range-input').value),
    'word-prev':()=>{wordPage--;renderWordRows();},'word-next':()=>{wordPage++;renderWordRows();},
    'load-sample':()=>{selected=words.slice(0,20);state.selection='1-20';state.types=[...EXAM_TYPES];state.counts={single:5,cloze:1,reading:1,clozeBlanks:8,readingQuestions:5};setDraft(globalThis.WORD_LAB_SAMPLE,'sample');},
    'generate-ai':generateAI,
    'approve-all':()=>{state.draft.forEach(q=>q.approved=true);save();render();toast('已全部标记审核通过，请确认你已检查题目。');},
    'back-select':()=>{step='select';render();},'go-review':()=>{step='review';render();},'go-publish':()=>{step='publish';render();},
    'publish':()=>{
      const qs=state.draft.filter(q=>q.approved);if(!qs.length)throw Error('请先审核题组。');
      const paper=paperStats(draftPaper(qs)),missing=selected.some(w=>!paper.coveredWordIds.includes(w.id));
      if(missing&&!el('#partial-confirm')?.checked)throw Error('请核对未覆盖词汇并确认发布。');
      const title=el('#assignment-title').value.trim();if(!title)throw Error('请填写作业名称。');
      state.title=title;state.assignment=checkAssignment({kind:'word-lab-assignment',version:2,id:`assignment-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,wordIds:selected.map(w=>w.id),paper,source:state.source,createdAt:new Date().toISOString()});save();render();toast('中考题型作业已发布，可以导出和练习。');
    },
    'go-student':()=>{quiz=null;result=null;nav='student';render();},'go-teacher':()=>{if(studentOnly)return;nav='teacher';quiz=null;result=null;render();},
    'go-mistakes':()=>{quiz=null;result=null;nav='mistakes';render();},
    'save-name':()=>{const name=el('#student-name').value.trim();if(!name)throw Error('请填写姓名或昵称。');state.studentName=name.slice(0,30);result=null;save();render();toast('已切换到这位学生的记录。');},
    'submit-answer':submitAnswer,
    'next-question':()=>{if(!quiz?.submitted)return;quiz.index++;if(quiz.index>=quiz.questions.length)return finishQuiz();quiz.selected='';quiz.submitted=false;render();focusAnswer();},
    'exit-quiz':()=>{quiz=null;render();},'result-back':()=>{result=null;nav='student';render();},'review-mistakes':startMistakes,
    'import-assignment':()=>openImport('assignment'),
    'import-questions':()=>{checkDraft();modal('导入 AI 生成的题目',`<p class="small muted" style="margin-bottom:12px">粘贴 AI 返回的 JSON，或上传 JSON 文件。需要使用当前词汇池中的 ${selected.length} 个词条；导入后由老师审核。</p><textarea id="import-json" aria-label="AI 题目 JSON" placeholder='{"sections": [...]}'></textarea>`,btn('import-question-file','选择 JSON 文件','upload')+btn('import-question-text','导入并审核','check','primary'));},
    'import-question-file':()=>{el('#modal').close();openImport('questions');},
    'import-question-text':()=>{let raw;try{raw=JSON.parse(el('#import-json').value);}catch{throw Error('请输入有效 JSON，不要包含 Markdown 代码框。');}setDraft(raw.paper||raw,'import');el('#modal').close();},
    'export-assignment':()=>{if(!state.assignment)throw Error('请先发布作业。');download(`${safeName(state.assignment.title)}.json`,JSON.stringify(state.assignment,null,2));},
    'export-results':()=>download(`${safeName(state.studentName)}-词练1.1成绩.json`,JSON.stringify({kind:'word-lab-results',version:1,student:state.studentName,exportedAt:new Date().toISOString(),history:student().history,mistakes:student().mistakes.map(m=>({...m,word:byId.get(m.wordId)?.word,meaning:byId.get(m.wordId)?.meaning}))},null,2)),
    'export-html':exportHTML,'prompt':showPrompt,'close-modal':()=>el('#modal').close(),
    'download-prompt':()=>download('AI词汇练习提示词.txt',el('#prompt-text').value,'text/plain'),
    'copy-prompt':async()=>{try{await navigator.clipboard.writeText(el('#prompt-text').value);toast('提示词已复制。');}catch{el('#prompt-text').select();toast('请按 Ctrl+C 或长按复制选中的提示词。');}},
    'ai-settings':showAISettings,
    'teacher-guide':showTeacherGuide,
    'test-ai-connection':testAIConnection,
    'toggle-ai-key':button=>{const input=el('#ai-api-key');input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'显示':'隐藏';},
    'cancel-ai':()=>{if(generation)generation.abort();},
    'save-ai-settings':()=>{
      const config=settingsFromForm(),value=el('#ai-endpoint').value.trim();
      if(config.mode==='direct'&&!config.apiKey)throw Error('请先填入 DeepSeek API Key。');
      if(config.mode==='server'&&!/^\/(?!\/)/.test(value)&&!/^https?:\/\//i.test(value))throw Error('请输入已有出题服务的接口地址。');
      aiSettings=config;state.endpoint=value||'/api/generate';save();
      try{localStorage.setItem(AI_STORAGE,JSON.stringify(config));}catch{toast('本次已配置；浏览器无法记住 Key，下次打开需要重新填写。',true);}
      el('#modal').close();render();toast('已保存，可以开始出题。');
    },
    'save-question':()=>{
      const id=el('#edit-id').value,q=state.draft.find(q=>q.id===id),answer=el('#edit-answer').value.trim();
      const options=el('#edit-options').value.split('\n').map(x=>x.trim()).filter(Boolean),text=el('#edit-word-ids').value.trim();
      const ids=text?text.split(/[,，\s]+/).map(Number):[];
      const edited={...q,prompt:el('#edit-prompt').value.trim(),options,answer,wordIds:ids,wordId:ids[0]??null,explanation:el('#edit-explanation').value.trim()};
      const draft=state.draft.map(item=>item.id===id?edited:item);
      const valid=paperStats(draftPaper(draft));state.sections=valid.sections;state.draft=valid.questions.map(item=>({...item,approved:item.sectionId===q.sectionId?false:state.draft.find(old=>old.id===item.id)?.approved===true}));save();el('#modal').close();render();toast('已保存修改，请重新审核所在题组。');
    },
    'save-section':()=>{
      const id=el('#section-id').value,original=state.sections.find(s=>s.id===id);
      const changed={...original,title:el('#section-title').value.trim(),passage:el('#section-passage').value.trim()};
      const paper={sections:state.sections.map(s=>({...s,...(s.id===id?changed:{}),questions:state.draft.filter(q=>q.sectionId===s.id)}))};
      const valid=X.validatePaper(paper,words,EXAM_TYPES);state.sections=valid.sections;state.draft=valid.questions.map(q=>({...q,approved:q.sectionId===id?false:state.draft.find(old=>old.id===q.id)?.approved===true}));save();el('#modal').close();render();toast('文章已保存，请重新审核题组。');
    }

  };
  document.addEventListener('click',async event=>{
    const target=event.target.closest('button');if(!target)return;
    try {
      if(target.dataset.nav){if(studentOnly&&target.dataset.nav==='teacher')return;nav=target.dataset.nav;quiz=null;result=null;render();return;}
      if(target.dataset.step){step=target.dataset.step;render();return;}
      if(target.dataset.range){applyRange(target.dataset.range);return;}
      if(target.dataset.edit){editQuestion(target.dataset.edit);return;}
      if(target.dataset.editSection){editSection(target.dataset.editSection);return;}
      if(target.dataset.startDay!==undefined){startDay(Number(target.dataset.startDay));return;}
      if(target.dataset.filter){mistakeFilter=target.dataset.filter;render();return;}
      if(target.dataset.answer!==undefined&&quiz&&!quiz.submitted){quiz.selected=target.dataset.answer;render();return;}
      if(target.dataset.speak){const w=byId.get(Number(target.dataset.speak));if(!('speechSynthesis' in window))throw Error('当前浏览器不支持发音。');speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(w.word);utterance.lang='en-US';utterance.rate=.82;speechSynthesis.speak(utterance);return;}
      if(target.dataset.markWord){const id=Number(target.dataset.markWord),s=student();let old=s.mistakes.find(m=>m.wordId===id);if(!old){old={wordId:id,wrongCount:0};s.mistakes.push(old);}Object.assign(old,{selfMarked:true,streak:0,mastered:false,lastSeen:new Date().toISOString()});save();target.classList.add('soft');target.textContent=byId.get(id).word+' · 已收进';toast('已标记为待巩固词，不计入答错次数。');return;}
      const action=target.dataset.action;if(handlers[action])await handlers[action](target);
    }catch(error){toast(error.message||'操作未完成，请重试。',true);}
  });
  document.addEventListener('change',async event=>{
    const target=event.target;
    try {
      if(target.dataset.word){const id=Number(target.dataset.word);selected=target.checked?[...selected,byId.get(id)]:selected.filter(w=>w.id!==id);state.selection=ranges(selected.map(w=>w.id));save();el('#range-input').value=state.selection;el('#selected-count').textContent=selected.length;renderWordRows();return;}
      if(target.name==='question-type'){state.types=selectedTypes();target.closest('.type-card').classList.toggle('checked',target.checked);save();return;}
      if(target.id.startsWith('count-')){const key=target.id.slice(6);state.counts[key]=Number(target.value);save();return;}
      if(target.dataset.approveSection){const id=target.dataset.approveSection;state.draft.filter(q=>q.sectionId===id).forEach(q=>q.approved=target.checked);save();render();return;}
      if(target.dataset.approve){const q=state.draft.find(q=>q.id===target.dataset.approve);if(q)q.approved=target.checked;save();render();return;}
      if(target.id==='file-input'){
        const file=target.files[0];if(!file)return;if(file.size>4*1024*1024)throw Error('文件过大，最大支持 4 MB。');
        let raw;try{raw=JSON.parse(await file.text());}catch{throw Error('文件不是有效 JSON，请检查 AI 输出或导出格式。');}
        if(target.dataset.mode==='assignment'){
          const a=checkAssignment(raw);state.assignment=a;
          if(!studentOnly){state.selection=ranges(a.wordIds);selected=a.wordIds.map(id=>byId.get(id));state.types=[...new Set(a.questions.map(q=>q.type))];state.sections=a.sections;state.draft=a.questions.map(q=>({...q,approved:true}));state.source=a.source;state.title=a.title;}
          quiz=null;result=null;nav='student';save();render();toast('作业已导入，可以开始练习。');
        }else setDraft(raw.paper||raw,'import');
      }
    }catch(error){toast(error.message,true);}
  });
  document.addEventListener('input',event=>{if(event.target.id==='word-search'){search=event.target.value;wordPage=0;renderWordRows();}});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.id==='range-input'){event.preventDefault();try{applyRange(event.target.value);}catch(error){toast(error.message,true);}}if(event.key==='Enter'&&event.target.id==='answer-input'){event.preventDefault();submitAnswer();}});
  if(stateMigrated)save();
  render();
})();
