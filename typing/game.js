(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const fingers = {
    lp: {name:'左手 · 小指',short:'小指',home:'a',keys:'qaz',color:'#b74776',soft:'#fbeaf2'},
    lr: {name:'左手 · 无名指',short:'无名指',home:'s',keys:'wsx',color:'#ad5d15',soft:'#fff0db'},
    lm: {name:'左手 · 中指',short:'中指',home:'d',keys:'edc',color:'#267a5c',soft:'#e5f5ed'},
    li: {name:'左手 · 食指',short:'食指',home:'f',keys:'rtfgvb',color:'#2d5bdf',soft:'#e9efff'},
    ri: {name:'右手 · 食指',short:'食指',home:'j',keys:'yuhjnm',color:'#6a4bd1',soft:'#efebff'},
    rm: {name:'右手 · 中指',short:'中指',home:'k',keys:'ik',color:'#147b91',soft:'#e1f4f8'},
    rr: {name:'右手 · 无名指',short:'无名指',home:'l',keys:'ol',color:'#956c10',soft:'#fbf2d9'},
    rp: {name:'右手 · 小指',short:'小指',home:';',keys:'p',color:'#b34444',soft:'#ffecec'}
  };
  const keyFinger = {};
  Object.entries(fingers).forEach(([id,f]) => [...f.keys].forEach(k => keyFinger[k] = id));
  const lessons = [
    {title:'看手指 · 跟着练',tag:'跟着练',timed:false,hidden:false},
    {title:'连起来 · 开始计时',tag:'计时练习',timed:true,hidden:false},
    {title:'少提示 · 6 秒挑战',tag:'6 秒挑战',timed:true,hidden:true}
  ];
  const state = {lesson:0,index:0,phase:'active',collected:new Set(),done:new Set(),errors:0,missed:new Set(),demoTimer:null,sound:true,voice:true,startedAt:null,elapsed:0,best:null,runs:0,frame:null};
  const target = () => alphabet[state.index];
  const fingerFor = k => fingers[keyFinger[k]];
  const displayTime = seconds => (Math.ceil(seconds*100-0.0000001)/100).toFixed(2);
  function cancelDemo(){clearTimeout(state.demoTimer);state.demoTimer=null;}
  function setFeedback(message,kind=''){$('feedback').textContent=message;$('feedback').className='feedback '+kind;}
  function buildLessons(){
    $('lessonNav').replaceChildren();
    lessons.forEach((lesson,i)=>{
      const b=document.createElement('button');b.type='button';b.className='lesson-button'+(state.done.has(i)?' done':'');
      b.innerHTML=`<span class="number">${String(i+1).padStart(2,'0')}</span><span>${lesson.title}</span>`;
      if(i===state.lesson)b.setAttribute('aria-current','step');
      b.addEventListener('click',()=>{startLesson(i);b.blur();});$('lessonNav').append(b);
    });
  }
  function keyButton(k){
    const f=fingerFor(k);const b=document.createElement('button');b.type='button';b.className='key'+('fj'.includes(k)?' home':'');b.dataset.key=k;
    b.style.setProperty('--key-ink',f.color);b.style.setProperty('--key-soft',f.soft);
    b.innerHTML=`<span class="lower">${k}</span><span class="upper">${k.toUpperCase()}</span>`;
    b.setAttribute('aria-label',`${k.toUpperCase()} 键，${f.name}，点击看示范`);
    b.addEventListener('click',()=>{demonstrate(k);b.blur();});return b;
  }
  function util(text,wide=false){const s=document.createElement('span');s.className='key util'+(wide?' wide':'');s.textContent=text;s.setAttribute('aria-hidden','true');return s;}
  function buildKeyboard(){
    const rows=[['Tab','qwertyuiop','[  ]'],['Caps','asdfghjkl',';  ↵'],['Shift','zxcvbnm',',  .  /']];
    rows.forEach(([first,letters,last],i)=>{const row=document.createElement('div');row.className='key-row';row.append(util(first,i>0));
      [...letters].forEach(k=>row.append(keyButton(k)));row.append(util(last,true));if(i===2)row.append(util('Shift',true));$('keyboard').append(row);
    });
  }
  function buildHand(side){
    const left=side==='left';const ids=left?['lp','lr','lm','li']:['ri','rm','rr','rp'];
    const xs=left?[17,65,113,161]:[62,110,158,206];
    const tops=left?[56,26,12,32]:[32,12,26,56];
    let svg='<svg viewBox="0 0 270 184" role="img" aria-label="'+(left?'左手：小指A，无名指S，中指D，食指F':'右手：食指J，中指K，无名指L，小指分号')+'"><rect class="palm" x="'+(left?22:65)+'" y="107" width="180" height="62" rx="26"/>';
    ids.forEach((id,i)=>{const f=fingers[id];svg+=`<g data-finger="${id}" style="--key-ink:${f.color};--key-soft:${f.soft}"><rect class="digit" x="${xs[i]}" y="${tops[i]}" width="37" height="${126-tops[i]}" rx="18"/><text class="home-letter" x="${xs[i]+18.5}" y="${tops[i]+32}" text-anchor="middle">${f.home.toUpperCase()}</text><text class="finger-name" x="${xs[i]+18.5}" y="${tops[i]-7}" text-anchor="middle">${f.short}</text></g>`;});
    svg+=`<rect class="palm" x="${left?202:24}" y="102" width="34" height="57" rx="17" transform="rotate(${left?-26:26} ${left?219:41} 130)"/><text class="finger-name" x="${left?229:32}" y="174" text-anchor="middle">拇指</text></svg>`;
    $(side+'Hand').innerHTML=svg;
  }
  function buildCollection(){
    [...alphabet].forEach(k=>{const s=document.createElement('span');s.className='alphabet-cell';s.dataset.letter=k;s.textContent=k;s.setAttribute('aria-label',`${k.toUpperCase()}，还没练`);$('alphabetCollection').append(s);});
  }
  function updateCollection(){
    $('collectedCount').textContent=`${state.collected.size} / 26`;
    document.querySelectorAll('.alphabet-cell').forEach(el=>{const collected=state.collected.has(el.dataset.letter);el.classList.toggle('collected',collected);el.setAttribute('aria-label',el.dataset.letter.toUpperCase()+(collected?'，练过了':'，还没练'));});
  }
  function highlightFinger(id){document.querySelectorAll('[data-finger]').forEach(group=>group.querySelectorAll('.digit,.home-letter,.finger-name').forEach(el=>el.classList.toggle('active',group.dataset.finger===id)));}
  function render(){
    const k=target();if(!k)return;const f=fingerFor(k);const lesson=lessons[state.lesson];
    document.documentElement.style.setProperty('--finger',f.color);document.documentElement.style.setProperty('--finger-soft',f.soft);
    $('targetLetter').textContent=k;$('targetUpper').textContent=k.toUpperCase()+' 键';
    $('lessonTag').textContent=lesson.tag+' · 从 a 到 z';
    $('roundCount').textContent=`${state.index} / 26`;
    const percentage=Math.round(state.index/26*100);$('progressFill').style.width=percentage+'%';document.querySelector('.progress').setAttribute('aria-valuenow',percentage);
    document.body.classList.toggle('hint-hidden',lesson.hidden);
    $('instructionLabel').textContent=lesson.hidden?'从 a 到 z，连着打':'看亮起的手指，跟着按';
    $('fingerInstruction').textContent=lesson.hidden?'下一个：'+k:f.name;
    const row='qwertyuiop'.includes(k)?'上':'zxcvbnm'.includes(k)?'下':'中';
    $('movementInstruction').textContent=lesson.hidden?'按完回家，接着打下一个。':k===f.home?`手指的家就在 ${k.toUpperCase()}，按一下，松开。`:`向${row==='中'?'旁边':row}伸一下，按完回 ${f.home.toUpperCase()}。`;
    setFeedback(state.index===0?(lesson.timed?'按 a 开始计时，顺着打到 z。':'从 a 开始，顺着打到 z。'):state.errors?`继续！按 ${k}，当前错键 ${state.errors} 次。`:`轮到 ${k}，继续！`);
    document.querySelectorAll('.key[data-key]').forEach(el=>{el.classList.toggle('target',el.dataset.key===k);el.classList.remove('wrong','pressed');});
    highlightFinger(keyFinger[k]);renderSequence();
  }
  function renderSequence(){
    $('sequence').replaceChildren();
    [...alphabet].forEach((k,i)=>{const s=document.createElement('span');s.className='sequence-letter'+(i<state.index?' past':i===state.index?' current':'');s.textContent=k;if(i===state.index)s.setAttribute('aria-current','true');$('sequence').append(s);});
  }
  function updateClock(){
    const timed=lessons[state.lesson].timed;
    $('clock').innerHTML=`${timed?displayTime(state.elapsed):'—'}<span>秒</span>`;
    $('clockLabel').textContent=timed?(state.startedAt===null?'按 a 就开始':state.phase==='complete'?'本轮用时':'目标 6.00 秒'):'跟练不用计时';
    $('bestLabel').textContent=state.best===null?'挑战目标：6.00 秒':`本次最佳 ${displayTime(state.best)} 秒`;
  }
  function tick(){
    if(state.phase!=='active'||state.startedAt===null)return;
    state.elapsed=(performance.now()-state.startedAt)/1000;updateClock();state.frame=requestAnimationFrame(tick);
  }
  function startLesson(i){
    window.TypingSounds?.stop();
    cancelDemo();cancelAnimationFrame(state.frame);if('speechSynthesis' in window)window.speechSynthesis.cancel();
    if($('finishDialog').open)$('finishDialog').close();state.lesson=i;state.index=0;state.phase='active';state.errors=0;state.missed.clear();state.startedAt=null;state.elapsed=0;
    buildLessons();render();updateClock();if(state.sound)speakTarget();
  }
  function soundTone(correct){
    if(!state.sound)return;
    window.TypingSounds?.enable();
    if(correct)window.TypingSounds?.correct(state.index);else window.TypingSounds?.retry();
  }
  function localVoice(){if(!('speechSynthesis' in window))return null;const voices=window.speechSynthesis.getVoices().filter(v=>v.localService&&/^zh[-_]/i.test(v.lang));return voices.find(v=>/^zh[-_]CN$/i.test(v.lang))||voices[0]||null;}
  function say(text){if(!state.sound||!state.voice)return;const voice=localVoice();if(!voice)return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=1;utterance.volume=.7;window.speechSynthesis.speak(utterance);}
  function speakTarget(){const k=target();if(!k||lessons[state.lesson].timed)return;const f=fingerFor(k);say(`${f.name.replace(' · ','')}，按，${k.toUpperCase()}`);}
  function updateVoiceAvailability(){const available=!!localVoice();$('voiceNote').textContent=available?'跟练有手指语音提示。计时中只播放短音效，完成后有过关旋律。':'当前浏览器没有本地中文语音，跟练用画面提示。按键和过关仍有音效。';}
  function acceptKey(k,receivedAt){
    if(state.phase!=='active')return;const expected=target();if(!expected)return;cancelDemo();
    document.querySelectorAll('.key.pressed').forEach(el=>el.classList.remove('pressed'));
    if(k!==expected){
      if(state.startedAt!==null||state.index>0){state.errors++;state.missed.add(expected);}
      document.body.classList.remove('hint-hidden');
      setFeedback(`这是 ${k===' '?'空格':k}，现在要按 ${expected}。${state.startedAt!==null?'时间继续走。':''}`,'retry');
      const el=[...document.querySelectorAll('.key[data-key]')].find(node=>node.dataset.key===k);el?.classList.add('wrong');setTimeout(()=>el?.classList.remove('wrong'),220);
      highlightFinger(keyFinger[expected]);$('fingerInstruction').textContent=fingerFor(expected).name;
      $('targetTile').classList.remove('shake');void $('targetTile').offsetWidth;$('targetTile').classList.add('shake');soundTone(false);return;
    }
    if(lessons[state.lesson].timed&&state.startedAt===null){if('speechSynthesis' in window)window.speechSynthesis.cancel();state.startedAt=receivedAt;state.frame=requestAnimationFrame(tick);}
    state.collected.add(k);updateCollection();soundTone(true);state.index++;
    if(state.index===26){finish(receivedAt);return;}
    render();if(!lessons[state.lesson].timed)speakTarget();
  }
  function demonstrate(k){
    if(state.phase!=='active')return;cancelDemo();
    document.body.classList.remove('hint-hidden');highlightFinger(keyFinger[k]);const f=fingerFor(k);
    setFeedback(`位置示范：${k.toUpperCase()} 用${f.name.replace(' · ','')}。请在实体键盘上按 ${target()}。`);
    document.querySelectorAll('.key[data-key]').forEach(el=>el.classList.toggle('pressed',el.dataset.key===k));
    state.demoTimer=setTimeout(()=>{if(state.phase==='active')render();},1600);
  }
  function finish(receivedAt){
    state.phase='complete';state.done.add(state.lesson);cancelAnimationFrame(state.frame);
    if(state.startedAt!==null){state.elapsed=(receivedAt-state.startedAt)/1000;state.runs++;if(state.errors===0&&(state.best===null||state.elapsed<state.best))state.best=state.elapsed;}
    buildLessons();updateClock();$('progressFill').style.width='100%';document.querySelector('.progress').setAttribute('aria-valuenow','100');$('roundCount').textContent='26 / 26';renderSequence();
    const timed=lessons[state.lesson].timed;const won=timed&&state.elapsed<=6&&state.errors===0;
    $('finishTitle').textContent=won?'6 秒挑战成功！':timed?`${displayTime(state.elapsed)} 秒，完整打完！`:'a 到 z，顺着打完啦！';
    $('finishDescription').textContent=won?'26 个字母，一气呵成，没有错键！':timed?(state.errors?`错键 ${state.errors} 次。先把整串打顺，再试一次。`:'没有错键！保持正确的手指，再一点点加速。'):'下一轮可以开计时了。看手指提示，把整串连起来。';
    $('finishLetters').replaceChildren();[...alphabet].forEach(k=>{const el=document.createElement('span');el.textContent=k;$('finishLetters').append(el);});
    $('reviewDescription').textContent=state.missed.size?`再留意这几个字母：${[...state.missed].join('、')}。`:timed&&state.best!==null?`本次最佳（无错键）：${displayTime(state.best)} 秒。`:'按完回家，双手放松。';
    $('practiceSummary').textContent=state.runs?`已完成 ${state.runs} 轮计时 · ${state.best===null?'继续练准':'最佳 '+displayTime(state.best)+' 秒'}`:'先练顺序，再练速度';
    $('nextLesson').textContent=state.lesson===0?'开始计时':state.lesson===1?'试试 6 秒挑战':'再挑战一轮';
    $('finishDialog').showModal();if(state.sound){window.TypingSounds?.celebrate(won);}
  }
  document.addEventListener('keydown',event=>{
    const receivedAt=performance.now();
    if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||$('helpDialog').open||$('finishDialog').open)return;
    if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.target.isContentEditable)return;
    const match=/^Key([A-Z])$/.exec(event.code);const k=match?match[1].toLowerCase():/^[a-z]$/i.test(event.key)?event.key.toLowerCase():event.key.length===1?event.key:null;
    if(k===null)return;event.preventDefault();acceptKey(k,receivedAt);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){window.TypingSounds?.stop();if('speechSynthesis' in window)window.speechSynthesis.cancel();}});
  $('helpButton').addEventListener('click',()=>{$('helpDialog').showModal();if('speechSynthesis' in window)window.speechSynthesis.cancel();});
  $('closeHelp').addEventListener('click',()=>$('helpDialog').close());$('startFromHelp').addEventListener('click',()=>$('helpDialog').close());
  $('helpDialog').addEventListener('close',()=>{if(state.phase==='active')render();});
  $('soundButton').addEventListener('click',()=>{state.sound=!state.sound;$('soundButton').setAttribute('aria-pressed',String(state.sound));$('soundButton').textContent='声音：'+(state.sound?'开':'关');if(state.sound){soundTone(true);speakTarget();}else{window.TypingSounds?.disable();if('speechSynthesis' in window)window.speechSynthesis.cancel();}$('soundButton').blur();});
  $('voiceToggle').addEventListener('change',()=>{state.voice=$('voiceToggle').checked;if(!state.voice&&'speechSynthesis' in window)window.speechSynthesis.cancel();else if(state.voice)speakTarget();});
  $('repeatLesson').addEventListener('click',()=>startLesson(state.lesson));$('nextLesson').addEventListener('click',()=>startLesson(Math.min(state.lesson+1,2)));$('closeFinish').addEventListener('click',()=>$('finishDialog').close());
  $('restartButton').addEventListener('click',()=>{startLesson(state.lesson);$('restartButton').blur();});
  if('speechSynthesis' in window)window.speechSynthesis.addEventListener('voiceschanged',updateVoiceAvailability);
  buildKeyboard();buildHand('left');buildHand('right');buildCollection();startLesson(0);updateVoiceAvailability();
})();
