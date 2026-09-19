/* 通用闯关引擎：拼音火车 / Phonics 探险 共用 */
window.LearnEngine = function(cfg){
'use strict';
const $=id=>document.getElementById(id);
const DAILY_GOAL=cfg.dailyGoal||20;
let S={stars:{},wrong:{},daily:{date:'',n:0},sound:true};
function load(){try{const j=localStorage.getItem(cfg.key);if(j)S=Object.assign(S,JSON.parse(j));}catch(e){}}
function save(){try{localStorage.setItem(cfg.key,JSON.stringify(S));}catch(e){}}
function today(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function ensureDaily(){if(S.daily.date!==today())S.daily={date:today(),n:0};}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* 关卡拍平 */
const LEVELS=[];cfg.stages.forEach((st,si)=>st.levels.forEach((lv,li)=>{LEVELS.push(Object.assign({id:st.id+'-'+li,stage:st,stageIndex:si},lv));}));
const ALL={};LEVELS.forEach(l=>l.items.forEach(it=>{ALL[it.id]=it;it.level=l;}));
function isUnlocked(i){return i===0||(S.stars[LEVELS[i-1].id]||0)>=1;}
function wrongList(){return Object.keys(S.wrong).filter(k=>S.wrong[k]>0&&ALL[k]);}

/* 声音 */
let ctx=null,curAudio=null;
function tone(f,d,t,v,dl){if(!S.sound)return;try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.type=t||'square';o.frequency.value=f;o.connect(g);g.connect(ctx.destination);const s=ctx.currentTime+(dl||0);g.gain.setValueAtTime(0.0001,s);g.gain.exponentialRampToValueAtTime(v||0.12,s+0.01);g.gain.exponentialRampToValueAtTime(0.0001,s+d);o.start(s);o.stop(s+d+0.02);}catch(e){}}
const sndOk=()=>{tone(660,0.12);tone(880,0.14,'square',0.12,0.1);tone(1320,0.2,'square',0.1,0.2);};
const sndBad=()=>{tone(200,0.25,'sawtooth');tone(150,0.3,'sawtooth',0.1,0.15);};
const sndTap=()=>tone(520,0.06,'triangle',0.08);
const sndWin=()=>[523,659,784,1047,1319].forEach((f,i)=>tone(f,0.25,'square',0.12,i*0.12));
const cache={};
function play(src,cb){
  if(!src){cb&&cb();return;}
  if(src.startsWith('tts:')){try{if(!S.sound)throw 0;const [,lang,txt]=src.split(':');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(txt);u.lang=lang;u.rate=0.8;u.onend=()=>cb&&cb();speechSynthesis.speak(u);}catch(e){cb&&cb();}return;}
  try{
    if(curAudio){curAudio.pause();curAudio.onended=null;}
    const a=cache[src]||(cache[src]=new Audio(src));
    a.currentTime=0;curAudio=a;
    a.onended=()=>{cb&&cb();};
    a.play().catch(()=>{cb&&cb();});
  }catch(e){cb&&cb();}
}
function playSeq(list,cb){let i=0;(function n(){if(i>=list.length){cb&&cb();return;}play(list[i++],()=>setTimeout(n,120));})();}
function preload(items){items.forEach(it=>{[it.audio].concat(it.extraAudio||[]).forEach(s=>{if(s&&!cache[s]){cache[s]=new Audio(s);cache[s].preload='auto';}});});}

/* 界面 */
const screens=['home','learn','quiz','result'];
function show(id){screens.forEach(s=>$(s).hidden=(s!==id));window.scrollTo(0,0);}
function starStr(n){let s='';for(let i=1;i<=3;i++)s+=i<=n?'<span>★</span>':'<span class="off">★</span>';return s;}
function renderEnergy(){ensureDaily();const n=Math.min(S.daily.n,DAILY_GOAL);$('energyFill').style.width=(n/DAILY_GOAL*100)+'%';$('energyText').textContent=n+'/'+DAILY_GOAL;}
function renderHome(){
  renderEnergy();
  const box=$('levels');box.innerHTML='';
  let nextMarked=false,done=0;
  cfg.stages.forEach((st,si)=>{
    const h=document.createElement('div');h.className='stagehead';h.innerHTML=`<b>${st.name}</b><span>${st.desc||''}</span>`;box.appendChild(h);
    const g=document.createElement('div');g.className='grid';
    st.levels.forEach((lv,li)=>{
      const idx=LEVELS.findIndex(l=>l.id===st.id+'-'+li);const L=LEVELS[idx];
      const stars=S.stars[L.id]||0,un=isUnlocked(idx);if(stars)done++;
      const b=document.createElement('button');b.className='lcard'+(un?'':' locked')+(stars?' done':'');
      if(un&&!stars&&!nextMarked){b.classList.add('next');nextMarked=true;}
      b.innerHTML=`<div class="icon">${cfg.levelIcon(L,stars>0,un)}</div><div class="nm">${L.name}</div><div class="st">${stars?starStr(stars):(un?cfg.text.pending:'未解锁')}</div>`;
      b.disabled=!un;b.addEventListener('click',()=>{sndTap();openLearn(idx);});
      g.appendChild(b);
    });
    box.appendChild(g);
  });
  const w=wrongList().length;
  $('repairCount').hidden=w===0;$('repairCount').textContent=w;$('repairBtn').disabled=w===0;
  $('homeStat').textContent=`已通过 ${done}/${LEVELS.length} 关 · 共 ${Object.values(S.stars).reduce((a,b)=>a+b,0)} 颗星`+(w?` · ${cfg.text.repair}里有 ${w} 个等着你`:'');
  $('soundBtn').textContent='声音：'+(S.sound?'开':'关');
}

/* 学一学 */
let curLevel=0;
function openLearn(idx){
  curLevel=idx;const L=LEVELS[idx];preload(L.items);
  $('ltitle').innerHTML=`${L.name}<small>${L.stage.name}</small>`;
  $('learnHint').textContent=cfg.text.learnHint;
  const kl=$('klist');kl.innerHTML='';
  L.items.forEach(it=>{
    const b=document.createElement('button');b.className='krow';b.innerHTML=cfg.renderLearnRow(it);
    b.addEventListener('click',()=>{b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');cfg.playLearn?cfg.playLearn(it,play,playSeq):play(it.audio);});
    kl.appendChild(b);
  });
  show('learn');
}

/* 答题 */
let Q={};
function startQuiz(mode){
  Q={mode,queue:[],lit:0,wrongs:0,answered:0,busy:false,cur:null,askedWrong:{},total:0};
  if(mode==='level'){Q.queue=shuffle(LEVELS[curLevel].items.slice());}
  else{Q.queue=shuffle(wrongList()).slice(0,10).map(k=>ALL[k]);}
  Q.total=Q.queue.length;preload(Q.queue);
  $('feedback').innerHTML='';$('feedback').className='fb';
  renderProg();show('quiz');next();
}
function renderProg(){const p=$('prog');p.innerHTML='';for(let i=0;i<Q.total;i++){const s=document.createElement('i');if(i<(Q.mode==='level'?Q.lit:Q.answered))s.className='on';p.appendChild(s);}}
function choicesFor(it){
  const L=it.level;const pool=L.items.filter(x=>x.id!==it.id);
  let others=shuffle(pool.slice()).slice(0,3);
  if(others.length<3){const more=shuffle(LEVELS.filter(l=>l.stage===L.stage).flatMap(l=>l.items).filter(x=>x.id!==it.id&&!others.includes(x)&&!(cfg.sameChoice&&cfg.sameChoice(x,it))));while(others.length<3&&more.length)others.push(more.shift());}
  return shuffle([it,...others]);
}
function next(){
  if(!Q.queue.length){finish();return;}
  Q.cur=Q.queue.shift();Q.busy=false;const it=Q.cur;
  $('qprompt').innerHTML=cfg.renderPrompt(it);
  $('feedback').innerHTML='';$('feedback').className='fb';
  const c=$('choices');c.innerHTML='';
  choicesFor(it).forEach(x=>{const b=document.createElement('button');b.className='ch';b.innerHTML=cfg.renderChoice(x);b.dataset.id=x.id;b.addEventListener('click',()=>answer(x,b));c.appendChild(b);});
  $('replayBtn').onclick=()=>{sndTap();play(it.audio);};
  setTimeout(()=>play(it.audio),250);
}
function answer(x,btn){
  if(Q.busy)return;Q.busy=true;const it=Q.cur,ok=x.id===it.id;
  document.querySelectorAll('.ch').forEach(b=>{b.disabled=true;if(b.dataset.id===it.id)b.classList.add('ok');else if(b!==btn)b.classList.add('dim');});
  ensureDaily();
  if(ok){
    sndOk();$('feedback').innerHTML=cfg.renderReveal(it);$('feedback').className='fb ok';
    S.daily.n++;if(Q.mode==='level')Q.lit++;else{Q.answered++;}
    if(!Q.askedWrong[it.id]&&S.wrong[it.id])S.wrong[it.id]=Math.max(0,S.wrong[it.id]-1);
    save();renderProg();renderEnergy();
    setTimeout(()=>playSeq(cfg.revealAudio?cfg.revealAudio(it):[it.audio],()=>setTimeout(next,500)),350);
  }else{
    btn.classList.add('bad');sndBad();
    $('feedback').innerHTML=cfg.renderReveal(it)+`<small>${cfg.text.wrongHint}</small>`;$('feedback').className='fb bad';
    Q.wrongs++;Q.askedWrong[it.id]=true;S.wrong[it.id]=Math.min(3,(S.wrong[it.id]||0)+1);
    if(Q.mode==='level')Q.queue.splice(Math.min(2,Q.queue.length),0,it);else{Q.answered++;Q.queue.push(it);}
    save();renderProg();
    setTimeout(()=>play(it.audio,()=>setTimeout(next,900)),500);
  }
}
function finish(){
  const rw=$('rwrap');rw.querySelectorAll('.conf').forEach(e=>e.remove());
  $('nextBtn').hidden=true;$('rchips').innerHTML='';
  const stars=Q.wrongs===0?3:Q.wrongs<=2?2:1;
  if(Q.mode==='level'){
    const L=LEVELS[curLevel];S.stars[L.id]=Math.max(S.stars[L.id]||0,stars);save();
    $('rbig').innerHTML=cfg.levelIcon(L,true,true);
    $('rtitle').textContent=`${L.name} ${cfg.text.done}`;$('rstars').innerHTML=starStr(stars);
    $('rmsg').textContent=Q.wrongs===0?'一个都没错，太厉害了！':`错了 ${Q.wrongs} 次，再练一遍就能拿三颗星。`;
    if(curLevel<LEVELS.length-1)$('nextBtn').hidden=false;
    sndWin();confetti();
  }else{
    const left=wrongList().length;
    $('rbig').innerHTML=cfg.repairIcon;$('rtitle').textContent=cfg.text.repairDone;$('rstars').innerHTML=starStr(stars);
    $('rmsg').textContent=left?cfg.text.repairLeft.replace('{n}',left):cfg.text.repairEmpty;sndWin();
  }
  Object.keys(Q.askedWrong).forEach(k=>{const c=document.createElement('button');c.className='chip';c.innerHTML=cfg.renderChip(ALL[k]);c.addEventListener('click',()=>play(ALL[k].audio));$('rchips').appendChild(c);});
  show('result');renderEnergy();
}
function confetti(){const rw=$('rwrap');const cols=[cfg.accent,'#ffd23f','#ffffff','#3ddc84'];for(let i=0;i<40;i++){const e=document.createElement('i');e.className='conf';e.style.left=Math.random()*100+'%';e.style.background=cols[i%cols.length];e.style.animationDuration=(1.6+Math.random()*1.4)+'s';e.style.animationDelay=(Math.random()*.6)+'s';rw.appendChild(e);}}

/* 事件 */
document.querySelectorAll('.backBtn').forEach(b=>b.addEventListener('click',()=>{sndTap();if(curAudio)curAudio.pause();renderHome();show('home');}));
$('startBtn').addEventListener('click',()=>{sndTap();startQuiz('level');});
$('repairBtn').addEventListener('click',()=>{sndTap();startQuiz('repair');});
$('againBtn').addEventListener('click',()=>{sndTap();if(Q.mode==='level')openLearn(curLevel);else startQuiz('repair');});
$('nextBtn').addEventListener('click',()=>{sndTap();openLearn(curLevel+1);});
$('soundBtn').addEventListener('click',()=>{S.sound=!S.sound;save();$('soundBtn').textContent='声音：'+(S.sound?'开':'关');if(S.sound)sndTap();});
$('resetBtn').addEventListener('click',()=>{if(confirm('确定清空这个游戏的全部进度吗？')){S={stars:{},wrong:{},daily:{date:'',n:0},sound:S.sound};save();renderHome();}});
load();ensureDaily();renderHome();show('home');
};
