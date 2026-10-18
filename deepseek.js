(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WordLabAI=api;
})(globalThis,function(root){
  'use strict';

  const defaults=Object.freeze({baseUrl:'https://api.deepseek.com',model:'deepseek-flash'});
  const TYPES=['single','cloze','reading'];
  const COUNT_DEFAULTS={single:20,cloze:2,reading:2,clozeBlanks:8,readingQuestions:5};
  const LABELS={single:'单项选择',cloze:'完形填空',reading:'阅读理解'};
  const trusted=Symbol('safeAIError');
  const MAX_RESPONSE_LENGTH=2*1024*1024;

  function error(message,code,status){
    const value=new Error(message);
    value.code=code;
    if(status)value.status=status;
    Object.defineProperty(value,trusted,{value:true});
    return value;
  }

  function readSettings(settings){
    if(!settings||typeof settings!=='object'||Array.isArray(settings))throw error('请填写 DeepSeek API 密钥。','INVALID_SETTINGS');
    const apiKey=typeof settings.apiKey==='string'?settings.apiKey.trim():'';
    if(!apiKey||/[\s\x00-\x1f\x7f]/.test(apiKey))throw error('请填写有效的 DeepSeek API 密钥。','INVALID_SETTINGS');
    const model=settings.model===undefined?defaults.model:typeof settings.model==='string'?settings.model.trim():'';
    if(!model||model.length>100||! /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(model))throw error('请填写有效的 DeepSeek 模型名称。','INVALID_SETTINGS');
    const address=settings.baseUrl===undefined?defaults.baseUrl:typeof settings.baseUrl==='string'?settings.baseUrl.trim():'';
    let url;
    try{url=new URL(address);}catch{throw error('服务地址须为 https://api.deepseek.com 或其 /v1 地址。','INVALID_SETTINGS');}
    if(url.origin!=='https://api.deepseek.com'||url.username||url.password||url.search||url.hash||!['/','/v1','/v1/'].includes(url.pathname))throw error('仅支持 DeepSeek 官方 HTTPS 服务地址及其 /v1 地址。','INVALID_SETTINGS');
    return {apiKey,model,baseUrl:url.origin+(url.pathname.startsWith('/v1')?'/v1':'')};
  }

  function noSecret(value,apiKey){
    if(JSON.stringify(value).includes(apiKey))throw error('AI 返回了无效内容，请重试。','INVALID_RESPONSE');
    return value;
  }

  function abortError(){return error('AI 请求已取消。','ABORTED');}
  function timeoutError(){return error('AI 请求超时，请减少试卷题量后重试。','TIMEOUT',504);}
  function checkAbort(signal){if(signal&&signal.aborted)throw abortError();}

  function httpError(status){
    if(status===401)return error('DeepSeek 密钥认证失败，请检查 API 密钥。','AUTH_ERROR',status);
    if(status===402)return error('DeepSeek 账户余额或额度不足，请充值后重试。','QUOTA_ERROR',status);
    if(status===429)return error('DeepSeek 请求过于频繁，请稍后重试。','RATE_LIMITED',status);
    if(status>=500)return error('DeepSeek 服务暂时繁忙，请稍后重试。','SERVICE_ERROR',status);
    return error('DeepSeek 请求失败，请检查模型及请求设置。','API_ERROR',status);
  }

  async function requestJSON(config,path,method,body,options){
    const fetchImpl=options.fetch||root.fetch;
    if(typeof fetchImpl!=='function'||typeof root.AbortController!=='function')throw error('当前浏览器缺少网络请求组件，请使用新版浏览器。','MISSING_DEPENDENCY');
    const timeoutMs=options.timeoutMs===undefined?180000:options.timeoutMs;
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw error('AI 请求超时设置无效。','INVALID_SETTINGS');
    const signal=options.signal;
    if(signal&&(typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw error('AI 请求取消设置无效。','INVALID_SETTINGS');
    checkAbort(signal);
    const controller=new root.AbortController();
    let rejectInterrupt,timedOut=false;
    const interrupted=new Promise((resolve,reject)=>{rejectInterrupt=reject;});
    const onAbort=()=>{controller.abort();rejectInterrupt(abortError());};
    if(signal)signal.addEventListener('abort',onAbort,{once:true});
    const timer=setTimeout(()=>{timedOut=true;controller.abort();rejectInterrupt(timeoutError());},timeoutMs);
    try{
      checkAbort(signal);
      return await Promise.race([
        (async()=>{
          const init={method,signal:controller.signal,headers:{Authorization:`Bearer ${config.apiKey}`},redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'};
          if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body);}
          const response=await fetchImpl.call(root,config.baseUrl+path,init);
          // Never read error bodies: providers may echo credentials or request data.
          if(!response||!response.ok)throw httpError(response&&response.status);
          const raw=await response.text();
          if(typeof raw!=='string'||raw.length>MAX_RESPONSE_LENGTH)throw error('DeepSeek 返回内容格式无效或过大，请减少题量后重试。','INVALID_RESPONSE');
          try{return JSON.parse(raw);}catch{throw error('DeepSeek 返回内容格式无效，请重试。','INVALID_RESPONSE');}
        })(),
        interrupted
      ]);
    }catch(cause){
      if(signal&&signal.aborted)throw abortError();
      if(timedOut)throw timeoutError();
      if(cause&&cause[trusted])throw cause;
      throw error('无法连接 DeepSeek，请检查网络连接后重试。','NETWORK_ERROR');
    }finally{
      clearTimeout(timer);
      if(signal)signal.removeEventListener('abort',onAbort);
    }
  }

  async function testConnection(settings,options={}){
    const config=readSettings(settings);
    const payload=await requestJSON(config,'/models','GET',undefined,options);
    if(!payload||!Array.isArray(payload.data)||!payload.data.length||payload.data.some(item=>!item||typeof item.id!=='string'||!item.id.trim()||item.id.length>200))throw error('DeepSeek 模型列表格式无效，请重试。','INVALID_RESPONSE');
    const models=[...new Set(payload.data.map(item=>item.id.trim()))];
    noSecret(models,config.apiKey);
    if(!models.includes(config.model))throw error('所选模型在此账户中不可用，请选择可用的 DeepSeek 模型。','MODEL_UNAVAILABLE');
    return noSecret({ok:true,model:config.model,models},config.apiKey);
  }

  function prepareRequest(request,options){
    const words=options.words||root.WORDS,exam=options.exam||root.WordLabExam;
    if(!Array.isArray(words)||!words.length||!exam||typeof exam.makePrompt!=='function'||typeof exam.validatePaper!=='function')throw error('词表或试卷校验组件未加载，请重新打开教师版。','MISSING_DEPENDENCY');
    if(!request||typeof request!=='object'||!Array.isArray(request.wordIds)||!request.wordIds.length||request.wordIds.length>words.length||request.wordIds.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(request.wordIds).size!==request.wordIds.length)throw error('请选择有效且不重复的词表序号。','INVALID_REQUEST');
    if(!Array.isArray(request.types)||!request.types.length||request.types.some(type=>!TYPES.includes(type))||new Set(request.types).size!==request.types.length)throw error('请选择有效且不重复的考试题型。','INVALID_REQUEST');
    const selected=request.wordIds.map(id=>words.find(word=>word&&word.id===id));
    if(selected.some(word=>!word))throw error('词表序号不存在。','INVALID_REQUEST');
    if(request.counts!==undefined&&(!request.counts||typeof request.counts!=='object'||Array.isArray(request.counts)||Object.keys(request.counts).some(key=>!Object.hasOwn(COUNT_DEFAULTS,key))))throw error('考试题量设置无效。','INVALID_REQUEST');
    const types=[...request.types],counts={...COUNT_DEFAULTS,...request.counts};
    for(const [name,max] of [['single',100],['cloze',10],['reading',10],['clozeBlanks',20],['readingQuestions',10]]){
      const min=TYPES.includes(name)&&!types.includes(name)?0:1;
      if(!Number.isSafeInteger(counts[name])||counts[name]<min||counts[name]>max)throw error('考试题量设置无效。','INVALID_REQUEST');
    }
    const groupCount=(types.includes('single')?1:0)+(types.includes('cloze')?counts.cloze:0)+(types.includes('reading')?counts.reading:0);
    const questionCount=(types.includes('single')?counts.single:0)+(types.includes('cloze')?counts.cloze*counts.clozeBlanks:0)+(types.includes('reading')?counts.reading*counts.readingQuestions:0);
    if(groupCount>20||questionCount>200)throw error('试卷最多支持 20 个题组、200 道题，请减少题量。','INVALID_REQUEST');
    const jobs=[];
    for(const type of types){
      const groups=type==='single'?1:counts[type];
      for(let index=0;index<groups;index++)jobs.push({type,count:type==='single'?counts.single:type==='cloze'?counts.clozeBlanks:counts.readingQuestions});
    }
    // Prepare every prompt before the first credential-bearing request.
    try{
      for(const [index,job] of jobs.entries()){
        const assigned=selected.slice(Math.floor(index*selected.length/jobs.length),Math.floor((index+1)*selected.length/jobs.length));
        if(!assigned.length)assigned.push(selected[index%selected.length]);
        const jobCounts={...counts,single:job.type==='single'?job.count:0,cloze:job.type==='cloze'?1:0,reading:job.type==='reading'?1:0};
        job.words=assigned;
        job.prompt=exam.makePrompt(assigned,[job.type],jobCounts)+`\n本次只生成一个 ${job.type} 板块，恰好 ${job.count} 道题。必须是原创考试模拟题，不得宣称为历年真题。题目目标词号只能来自本次提供的词表，把词条自然融入语境，不得声称文章中出现的每个词都被直接测试。仅输出要求的 JSON 对象。`;
      }
    }catch{throw error('所选词表或考试题量设置无效。','INVALID_REQUEST');}
    return {selected,types,exam,jobs};
  }

  function progress(options,completed,total,message){
    if(typeof options.onProgress==='function'){
      try{options.onProgress({completed,total,message});}catch{/* A display callback must not expose its error or interrupt the paper. */}
    }
  }

  async function generatePaper(request,settings,options={}){
    const {selected,types,exam,jobs}=prepareRequest(request,options);
    const config=readSettings(settings),sections=[];
    checkAbort(options.signal);
    for(const [index,job] of jobs.entries()){
      checkAbort(options.signal);
      progress(options,index,jobs.length,`正在生成第 ${index+1}/${jobs.length} 个题组：${LABELS[job.type]}（${job.count} 题）…`);
      const payload=await requestJSON(config,'/chat/completions','POST',{
        model:config.model,messages:[{role:'user',content:job.prompt}],response_format:{type:'json_object'},
        thinking:{type:'disabled'},max_tokens:8192,stream:false,temperature:0.4
      },options);
      const choice=payload&&Array.isArray(payload.choices)&&payload.choices[0];
      if(!choice||!choice.message||typeof choice.message.content!=='string'||!choice.message.content.trim())throw error('AI 返回的试卷内容格式无效，请重试。','INVALID_RESPONSE');
      if(choice.finish_reason&&choice.finish_reason!=='stop')throw error('AI 输出未完整生成，请减少题量后重试。','INVALID_RESPONSE');
      let raw;
      try{raw=JSON.parse(choice.message.content);}catch{throw error('AI 返回的试卷 JSON 格式无效，请重试。','INVALID_RESPONSE');}
      noSecret(raw,config.apiKey);
      try{
        const validated=exam.validatePaper(raw,job.words,[job.type]);
        if(validated.sections.length!==1||validated.sections[0].type!==job.type||validated.sections[0].questions.length!==job.count)throw new Error('Unexpected section count');
        const current=validated.sections[0],id=`exam-group${index+1}`;
        sections.push({...current,id,questions:current.questions.map((question,questionIndex)=>({...question,id:`exam-${index+1}-${questionIndex+1}`,sectionId:id}))});
      }catch{throw error('AI 返回的试卷题型、题量或篇章结构不符合要求，请重试。','INVALID_RESPONSE');}
      checkAbort(options.signal);
      progress(options,index+1,jobs.length,`已完成 ${index+1}/${jobs.length} 个题组。`);
    }
    checkAbort(options.signal);
    let paper;
    try{paper=exam.validatePaper({sections},selected,types);}catch{throw error('AI 试卷整体校验失败，请重试。','INVALID_RESPONSE');}
    return noSecret({paper,source:'ai',model:config.model},config.apiKey);
  }

  return {defaults,testConnection,generatePaper};
});
