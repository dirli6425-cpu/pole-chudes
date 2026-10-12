
const initial=[{"q":"Назовите основу многих масляных и алкидных красок — природный компонент, получаемый из семян льна.","a":"ОЛИФА"},{"q":"Этот строительный материал представляет собой искусственное вяжущее вещество на основе различных минеральных компонентов. Назовите его.","a":"ЦЕМЕНТ"},{"q":"Назовите торговое название хладагентов, используемых в кондиционерах. Это фторсодержащие углеводороды (хладоны).","a":"ФРЕОНЫ"},{"q":"[ВРЕМЕННЫЙ ВОПРОС — учитель заменит] Как называется белое минеральное вещество, применяемое для строительных растворов и побелки?","a":"ИЗВЕСТЬ"},{"q":"Как называется вода, образующаяся при охлаждении пара или воздуха и часто вызывающая коррозию вентиляционных воздуховодов?","a":"КОНДЕНСАТ"}];const $=id=>document.getElementById(id),alphabet=[...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];let rounds=initial, index=0, guessed=new Set(), editing=[];
const defaultGroups=['208','207','125'];let groups=defaultGroups.slice(),editingGroups=[];


function renderGroups(){const el=$('heroGroups');el.replaceChildren();groups.forEach(g=>{const card=document.createElement('div');card.className='group-card';card.textContent=/^\d+$/.test(g)?g+' группа':g;el.append(card)})}
function renderGroupInputs(){const el=$('groupInputs');el.replaceChildren();editingGroups.forEach((g,i)=>{const wrap=document.createElement('div');const label=document.createElement('label');label.textContent='Группа '+(i+1);const input=document.createElement('input');input.value=g;input.maxLength=40;input.placeholder='Например, 102';input.oninput=()=>editingGroups[i]=input.value;wrap.append(label,input);el.append(wrap)})}

const teacherPreset={"groups":["208","207","125"],"rounds":[{"q":"Назовите основу многих масляных и алкидных красок — природный компонент, получаемый из семян льна.","a":"ОЛИФА"},{"q":"Этот строительный материал представляет собой искусственное вяжущее вещество на основе различных минеральных компонентов. Назовите его.","a":"ЦЕМЕНТ"},{"q":"Назовите торговое название хладагентов, используемых в кондиционерах. Это фторсодержащие углеводороды (хладоны).","a":"ФРЕОНЫ"},{"q":"[ВРЕМЕННЫЙ ВОПРОС — учитель заменит] Как называется белое минеральное вещество, применяемое для строительных растворов и побелки?","a":"ИЗВЕСТЬ"},{"q":"Как называется вода, образующаяся при охлаждении пара или воздуха и часто вызывающая коррозию вентиляционных воздуховодов?","a":"КОНДЕНСАТ"}]};
const clean=s=>String(s).toUpperCase().replace(/[^А-ЯЁ ]/g,'').trim().replace(/\s+/g,' ');
const complete=()=>[...rounds[index].a].every(c=>c===' '||guessed.has(c));
const SFX={spin:'/audio/spin.mp3',correct:'/audio/correct.mp3',pass:'/audio/pass.mp3',plus:'/audio/plus.mp3',prizes:'/audio/prizes.mp3',empty:'/audio/empty.mp3',money:'/audio/money.mp3'};
const sectors=[
 {t:'300',kind:'points',points:300,color:'#294a89'},
 {t:'ПРИЗ',kind:'prize',color:'#8b2354'},
 {t:'500',kind:'points',points:500,color:'#126f75'},
 {t:'ПРИЗ',kind:'prize',color:'#9b6624'},
 {t:'250',kind:'points',points:250,color:'#374b80'},
 {t:'+',kind:'plus',color:'#ba9533'},
 {t:'400',kind:'points',points:400,color:'#326b85'},
 {t:'→',kind:'pass',color:'#9b2c3a'},
 {t:'600',kind:'points',points:600,color:'#2f4475'},
 {t:'ШК',kind:'boxes',color:'#a56a30'},
 {t:'350',kind:'points',points:350,color:'#30656c'},
 {t:'ПРИЗ',kind:'prize',color:'#8d4c34'},
 {t:'700',kind:'points',points:700,color:'#254b86'},
 {t:'Б',kind:'bankrupt',color:'#171923'},
 {t:'450',kind:'points',points:450,color:'#207076'},
 {t:'ПРИЗ',kind:'prize',color:'#a26d20'},
 {t:'200',kind:'points',points:200,color:'#33588c'},
 {t:'×2',kind:'double',color:'#8057a1'},
 {t:'800',kind:'points',points:800,color:'#2b6374'},
 {t:'100',kind:'points',points:100,color:'#874244'}
];
let player=0,scores=[0,0,0],gifts=[[],[],[]],stage='ready',currentSector=null,landingIndex=null,wheelRotation=0,spinTimer=0,wordOpenedByHost=false;
let sfxMuted=false,sfxCurrent=null,audioCtx=null,audioSource=null,audioBuffers={},audioPreparing=false;
function prepareSound(){
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)return;
 try{
  if(!audioCtx)audioCtx=new Context();
  audioCtx.resume().catch(()=>{});
  if(audioPreparing)return;
  audioPreparing=true;
  Object.entries(SFX).forEach(async([key,url])=>{
   try{const res=await fetch(url);if(!res.ok)throw Error(res.status);audioBuffers[key]=await audioCtx.decodeAudioData(await res.arrayBuffer())}
   catch(e){console.warn('Звук '+key+' будет проигрываться обычным плеером:',e)}
  });
 }catch(e){console.warn('Аудиоконтекст недоступен:',e)}
}
function stopTvSound(){
 if(audioSource){try{audioSource.stop()}catch(e){}audioSource=null}
 if(sfxCurrent){sfxCurrent.pause();sfxCurrent.currentTime=0;sfxCurrent=null}
}
function playTvSound(id){
 if(sfxMuted)return;
 stopTvSound();
 try{
  if(audioCtx&&audioCtx.state==='running'&&audioBuffers[id]){
   const source=audioCtx.createBufferSource(),gain=audioCtx.createGain();source.buffer=audioBuffers[id];gain.gain.value=.88;
   source.connect(gain).connect(audioCtx.destination);source.start();audioSource=source;
  }else{sfxCurrent=new Audio(SFX[id]);sfxCurrent.volume=.88;sfxCurrent.play().catch(e=>console.warn('Не удалось включить звук '+id,e))}
 }catch(e){console.warn('Звук недоступен:',e)}
}
function playLandingChime(){
 if(sfxMuted)return;
 stopTvSound();
 try{
  if(!audioCtx||audioCtx.state!=='running')return;
  const t=audioCtx.currentTime;
  [440,659.26].forEach((freq,i)=>{
   const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type='triangle';osc.frequency.value=freq;
   g.gain.setValueAtTime(.0001,t+i*.09);g.gain.exponentialRampToValueAtTime(.09,t+i*.09+.035);g.gain.exponentialRampToValueAtTime(.0001,t+i*.09+.32);
   osc.connect(g).connect(audioCtx.destination);osc.start(t+i*.09);osc.stop(t+i*.09+.34);
  });
 }catch(e){console.warn('Не удалось проиграть сигнал:',e)}
}
$('tvMute').onclick=()=>{sfxMuted=!sfxMuted;if(sfxMuted)stopTvSound();else{prepareSound();playTvSound('plus')}$('tvMute').textContent=sfxMuted?'🔇 ЗВУК ВЫКЛ':'🔊 ЗВУК ВКЛ'};
function randomIndex(limit){
 if(window.crypto&&crypto.getRandomValues){const buf=new Uint32Array(1);const max=0x100000000-(0x100000000%limit);do{crypto.getRandomValues(buf)}while(buf[0]>=max);return buf[0]%limit}
 return Math.floor(Math.random()*limit);
}
function wheelSvg(){
 const svg=$('wheelSvg'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();
 const xy=(a,r)=>[Math.cos(a*Math.PI/180)*r,Math.sin(a*Math.PI/180)*r];
 const add=(tag,attrs={},parent=svg)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e};
 const text=(t,attrs={},parent=svg)=>{const e=add('text',attrs,parent);e.textContent=t;return e};
 const defs=add('defs');defs.innerHTML=`
 <radialGradient id="rim" cx="27%" cy="20%" r="82%"><stop stop-color="#fffbd5"/><stop offset=".24" stop-color="#d7af5e"/><stop offset=".49" stop-color="#71431d"/><stop offset=".68" stop-color="#f3d38c"/><stop offset="1" stop-color="#45230f"/></radialGradient>
 <radialGradient id="centerWood" cx="36%" cy="30%" r="79%"><stop stop-color="#755137"/><stop offset=".52" stop-color="#38231b"/><stop offset="1" stop-color="#120c0e"/></radialGradient>
 <linearGradient id="segmentGloss" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#ffffff" stop-opacity=".32"/><stop offset=".35" stop-color="#ffffff" stop-opacity=".04"/><stop offset="1" stop-color="#02050e" stop-opacity=".22"/></linearGradient>
 <linearGradient id="basketWeave" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5c873"/><stop offset=".52" stop-color="#b77439"/><stop offset="1" stop-color="#613418"/></linearGradient>
 <radialGradient id="ceramic" cx="30%" cy="23%"><stop stop-color="#fffdf5"/><stop offset=".48" stop-color="#d7e1df"/><stop offset="1" stop-color="#5d96a1"/></radialGradient>
 <filter id="objShadow" x="-45%" y="-45%" width="190%" height="190%"><feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dx="3" dy="7" result="blur"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
 // A table-like, top-down drum with an actual raised brass rim.
 add('circle',{r:254,fill:'#20110b',stroke:'#100906','stroke-width':5});
 add('circle',{r:249,fill:'url(#rim)',stroke:'#ffe1a1','stroke-width':3});
 add('circle',{r:236,fill:'#27130f',stroke:'#3d2213','stroke-width':5});
 const aStep=360/sectors.length,R=227;
 sectors.forEach((sec,i)=>{
  const a=-90+i*aStep,b=a+aStep,[x1,y1]=xy(a,R),[x2,y2]=xy(b,R),mid=(a+b)/2;
  add('path',{d:`M 0 0 L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`,fill:sec.color,stroke:'#f1c77b','stroke-width':2.5});
  const [tx,ty]=xy(mid,193);
  text(sec.t,{x:tx,y:ty,'text-anchor':'middle','dominant-baseline':'middle','font-family':'Arial,sans-serif','font-weight':'900','font-size':sec.t.length>3?11:sec.t.length>2?15:19,fill:'#fff3ce',stroke:'#13101a','stroke-width':3,'paint-order':'stroke',transform:`rotate(${mid+90} ${tx} ${ty})`});
  const[rx,ry]=xy(mid,225);add('circle',{cx:rx,cy:ry,r:3.1,fill:'#fffbd4',stroke:'#693d19','stroke-width':1});
 });
 // Embossed circular trim and a dark inner surface for physical studio props.
 add('circle',{r:227,fill:'none',stroke:'url(#rim)','stroke-width':9});
 add('circle',{r:157,fill:'none',stroke:'#ffdb8b','stroke-width':2,opacity:'.7'});
 add('circle',{r:134,fill:'url(#centerWood)',stroke:'#e7ae68','stroke-width':5});
 add('circle',{r:127,fill:'none',stroke:'#fff1be','stroke-width':1.2,opacity:'.55'});
 for(let k=0;k<40;k++){const[x,y]=xy(k*9,242);add('circle',{cx:x,cy:y,r:4.4,fill:k%2?'#fff5cc':'#d9a24a',stroke:'#69411b','stroke-width':1.1})}
 // Vase with flowers, seen from above: vessel ellipse with stems, leaves and petals.
 function vase(parent,x,y,scale,tilt=0){
  const g=add('g',{transform:`translate(${x} ${y}) rotate(${tilt}) scale(${scale})`,filter:'url(#objShadow)'},parent);
  add('ellipse',{cy:9,rx:39,ry:27,fill:'#020812',opacity:'.35'},g);
  add('ellipse',{cy:2,rx:33,ry:26,fill:'url(#ceramic)',stroke:'#fff2c8','stroke-width':3},g);
  add('ellipse',{cy:0,rx:25,ry:20,fill:'#15394e',stroke:'#97dfe4','stroke-width':2},g);
  const flowers=[[-23,-13,'#fce8ff'],[-7,-21,'#f9a4d4'],[16,-18,'#fff0a1'],[25,4,'#e979c3'],[7,19,'#f3f6fb'],[-17,13,'#ffcd79'],[0,0,'#ffe8f3']];
  flowers.forEach(([cx,cy,color],i)=>{add('path',{d:`M 0 0 Q ${cx/2} ${cy/2-7} ${cx} ${cy}`,fill:'none',stroke:'#267545','stroke-width':2.3},g);
   add('ellipse',{cx:cx*.75,cy:cy*.65,rx:8,ry:3.5,transform:`rotate(${i*36} ${cx*.75} ${cy*.65})`,fill:'#36935d'},g);
   for(let p=0;p<5;p++){const ang=p*Math.PI*2/5;add('ellipse',{cx:cx+Math.cos(ang)*7,cy:cy+Math.sin(ang)*7,rx:5.5,ry:6.2,fill:color,stroke:'#985171','stroke-width':.7},g)}
   add('circle',{cx,cy,r:4.3,fill:'#f3a22f',stroke:'#a65a2b','stroke-width':.8},g);
  });
 }
 function hamper(parent,x,y,scale,tilt=0){
  const g=add('g',{transform:`translate(${x} ${y}) rotate(${tilt}) scale(${scale})`,filter:'url(#objShadow)'},parent);
  add('ellipse',{cx:3,cy:8,rx:46,ry:31,fill:'#000',opacity:'.34'},g);
  add('ellipse',{rx:44,ry:29,fill:'url(#basketWeave)',stroke:'#633614','stroke-width':3},g);
  add('ellipse',{rx:36,ry:22,fill:'#81502b',stroke:'#f3d28d','stroke-width':3},g);
  for(let i=-3;i<=3;i++){add('path',{d:`M ${i*10} -24 Q ${i*10+7} 0 ${i*10} 24`,fill:'none',stroke:'#edba67','stroke-width':1.5,opacity:'.65'},g)}
  const fruits=[[-24,-9,12,'#cc3429'],[-5,-12,11,'#f6cf44'],[16,-8,12,'#69a73f'],[27,9,10,'#e17132'],[4,10,10,'#df483c'],[-19,12,10,'#e9ba50']];
  fruits.forEach(([fx,fy,r,col])=>{add('circle',{cx:fx,cy:fy,r,fill:col,stroke:'#6c4020','stroke-width':1.6},g);add('ellipse',{cx:fx-3,cy:fy-4,rx:r*.33,ry:r*.18,fill:'#fff8d7',opacity:'.65'},g);add('ellipse',{cx:fx+2,cy:fy-r+2,rx:6,ry:3.4,fill:'#347d38',transform:`rotate(-35 ${fx+2} ${fy-r+2})`},g)});
  add('ellipse',{rx:44,ry:29,fill:'none',stroke:'#fff0bb','stroke-width':4.3},g);
  add('path',{d:'M -42 0 Q -34 -47 0 -49 Q 37 -44 43 0',fill:'none',stroke:'#b47536','stroke-width':7,'stroke-linecap':'round'},g);
  add('path',{d:'M -42 0 Q -34 -47 0 -49 Q 37 -44 43 0',fill:'none',stroke:'#ffe4a0','stroke-width':2.5,opacity:'.75'},g);
 }
 // Objects rest on the spinning drum, not in floating, non-spinning UI layers.
 const props=add('g',{'aria-label':'Вазы с цветами и корзинки с продуктами'});
 vase(props,-79,-75,.77,-12);
 hamper(props,83,-70,.72,17);
 vase(props,76,82,.70,32);
 hamper(props,-82,78,.70,-18);
 // Large, elevated bronze spindle in the center, drawn last as on real studio hardware.
 add('circle',{r:42,fill:'url(#rim)',stroke:'#fff2b1','stroke-width':5});
 add('circle',{r:29,fill:'#152a38',stroke:'#fff1ba','stroke-width':2.8});
 text('✦',{x:0,y:3,'text-anchor':'middle','dominant-baseline':'middle','font-size':38,fill:'#ffdf90'});
}
wheelSvg();
// The splash screen uses the very same generated studio wheel, not a CSS mockup.
const introWheelSvg=$('introWheelSvg');
if(introWheelSvg)introWheelSvg.innerHTML=$('wheelSvg').innerHTML;
function show(view){['intro','game','finish','editor'].forEach(id=>$(id).classList.toggle('hidden',id!==view));document.body.dataset.screen=view;if(view==='game')render();if(view!=='editor')saveProgress()}
function renderGroupsAndScore(){
 const board=$('playerBoard');board.replaceChildren();
 groups.forEach((g,i)=>{
  const b=document.createElement('button');b.type='button';b.className='player-card'+(i===player?' active':'');b.disabled=stage!=='ready'||complete();
  b.setAttribute('aria-pressed',String(i===player));
  const name=document.createElement('span');name.className='player-name';name.textContent=(/^\d+$/.test(g)?'ГРУППА ':'')+g;
  const score=document.createElement('strong');score.textContent=scores[i].toLocaleString('ru-RU');
  const suffix=document.createElement('small');suffix.textContent=i===player?'▶ СЕЙЧАС ИГРАЕТ':'НАЖМИТЕ, ЧТОБЫ ВЫБРАТЬ';
  b.append(name,score,suffix);b.onclick=()=>{if(stage!=='ready'||complete())return;player=i;message('Теперь играет '+groupName(player));render();saveProgress()};board.append(b)
 });
 const tray=$('giftShelf');if(tray)tray.hidden=true;
}
function groupName(i){const g=groups[i]||String(i+1);return /^\d+$/.test(g)?'группа '+g:g}
function message(s,type=''){const el=$('status');el.textContent=s;el.className='status '+type}
function render(){
 const r=rounds[index];if(!r)return;
 $('counter').textContent=`ТУР ${index+1} / ${rounds.length}`;$('roundCount').textContent=rounds.length;
 $('question').textContent=r.q;
 $('tiles').replaceChildren();for(const c of r.a){const d=document.createElement('div');d.className='tile'+(c===' '?' space':guessed.has(c)?' open':'');d.textContent=c===' '?'':guessed.has(c)?c:'';$('tiles').append(d)}
 $('letters').replaceChildren();for(const c of alphabet){const b=document.createElement('button');b.type='button';b.textContent=c;
 b.disabled=guessed.has(c)||complete()||(stage!=='letter'&&stage!=='plus');if(guessed.has(c))b.className=r.a.includes(c)?'correct':'wrong';b.onclick=()=>guess(c);$('letters').append(b)}
 $('next').classList.toggle('hidden',!complete());$('next').textContent=index===rounds.length-1?'Завершить игру 🏆':'Следующий тур →';
 $('spinButton').disabled=stage!=='ready'||complete();$('spinButton').textContent=stage==='spinning'?'⏳ БАРАБАН ВРАЩАЕТСЯ…':stage==='ready'?'🎡 ВРАЩАТЬ БАРАБАН':stage==='roundDone'?'🏆 ТУР ЗАВЕРШЁН':'⏳ СНАЧАЛА ВЫПОЛНИТЕ ЗАДАНИЕ';
 $('manualPass').disabled=stage==='spinning'||stage==='box'||stage==='gift'||complete();$('revealWord').disabled=stage==='spinning'||complete();
 const guide=complete()?'Слово открыто! Ведущий нажимает «Следующий тур».':stage==='ready'?`Ход ${groupName(player)}. Нажмите «Вращать барабан» или выберите другую группу.`:stage==='spinning'?'Барабан набирает обороты, затем плавно остановится на случайном секторе.':stage==='letter'?`Назовите букву. За каждое совпадение получите ${currentSector?.points||0} очков. При ошибке ход переходит дальше.`:stage==='plus'?'Сектор «Плюс»: выберите любую ещё закрытую букву — она откроется бесплатно.':stage==='box'?'Выберите одну из двух шкатулок. Подарок определяет ведущий.':stage==='gift'?'Ведущий вручает подарок и подтверждает продолжение.':'Следуйте подсказке ведущего.';
 $('guideText').textContent=guide;
 if(complete()){if(!$('status').textContent.includes('открыто'))message(`🏆 Слово отгадано! Победитель тура: ${groupName(player)}.`,'good')}
 renderGroupsAndScore();
}
function setResult(big,small,color){$('resultBig').textContent=big;$('resultSmall').textContent=small||'';$('sectorResult').dataset.kind=color||'plain'}
function clearModal(){$('sectorModal').classList.add('hidden');$('modalOptions').replaceChildren()}
function modal(icon,title,desc,actions){$('modalIcon').textContent=icon;$('modalTitle').textContent=title;$('modalText').textContent=desc;const opts=$('modalOptions');opts.replaceChildren();actions.forEach(({text,act})=>{const btn=document.createElement('button');btn.type='button';btn.textContent=text;btn.onclick=act;opts.append(btn)});$('sectorModal').classList.remove('hidden')}
function saveGameAndRender(){render();saveProgress()}
function nextPlayer(){player=(player+1)%groups.length;stage='ready';currentSector=null;saveGameAndRender()}
function spin(){
 if(stage!=='ready'||complete())return;
 clearModal();stage='spinning';const choice=randomIndex(sectors.length);landingIndex=choice;
 const step=360/sectors.length,target=(-(choice+.5)*step+360)%360,cur=((wheelRotation%360)+360)%360;
 const delta=((target-cur+360)%360)+360*(6+randomIndex(3));wheelRotation+=delta;
 $('wheelDisk').style.transition='transform 6.6s cubic-bezier(.10,.77,.07,1)';$('wheelDisk').style.transform=`rotate(${wheelRotation}deg)`;
 $('wheelPointer').classList.add('clicking');playTvSound('spin');setResult('ВРАЩЕНИЕ…','Барабан набирает обороты','spinning');message('🎡 Барабан вращается…');saveGameAndRender();
 clearTimeout(spinTimer);spinTimer=setTimeout(()=>{if(stage==='spinning')finishSpin(choice)},6650);
}
function finishSpin(i){$('wheelPointer').classList.remove('clicking');stopTvSound();const sec=sectors[i];currentSector={...sec};
 const kind=sec.kind;setResult(sec.t,kind==='points'?`${sec.points} очков за каждую открытую букву`:kind==='double'?'Двойные очки за букву':kind==='boxes'?'Две шкатулки — подарок определяет ведущий':kind==='prize'?'Сюрприз для участников':kind==='plus'?'Бесплатно откройте букву':kind==='pass'?'Ход переходит дальше':kind==='bankrupt'?'Очки текущей группы обнуляются':'',kind);
 if(kind==='points'||kind==='double'){
  if(kind==='double')currentSector.points=800;
  stage='letter';message(`🎯 ${groupName(player)} — назовите букву!`, 'good');if(kind==='double')playTvSound('plus');else playLandingChime();
 }else if(kind==='plus'){
  stage='plus';message('✚ Сектор «Плюс»! Выберите любую неоткрытую букву.','good');playTvSound('plus');
 }else if(kind==='pass'){
  playTvSound('pass');const prev=groupName(player);nextPlayer();message(`↪ ${prev} пропускает ход. Теперь играет ${groupName(player)}.`,'bad');return;
 }else if(kind==='bankrupt'){
  scores[player]=0;const prev=groupName(player);playTvSound('pass');nextPlayer();message(`💥 БАНКРОТ! Очки ${prev} обнулены. Ход переходит дальше.`,'bad');return;
 }else if(kind==='boxes'){
  stage='box';playTvSound('prizes');const correctBox=randomIndex(2);
  modal('📦','ДВЕ ШКАТУЛКИ','В одной шкатулке подарок организаторов, другая пустая. Игрок выбирает одну.',[
    {text:'📦 Шкатулка № 1',act:()=>openBox(0,correctBox)},{text:'📦 Шкатулка № 2',act:()=>openBox(1,correctBox)}]);
 }else{
  stage='gift';playTvSound('prizes');
  modal('🎁','ПРИЗ В СТУДИЮ!',`Для ${groupName(player)} ведущий выбирает и вручает подготовленный организаторами подарок. Сайт не назначает награду.`,[
    {text:'Подарок вручён — продолжить →',act:()=>{clearModal();stage='ready';currentSector=null;message('🎁 Ведущий вручил свой подарок. Можно вращать барабан.','good');saveGameAndRender()}}
  ]);
 }
 saveGameAndRender();
}
function openBox(chosen,correct){const winning=chosen===correct;clearModal();if(winning){playTvSound('money')}else{playTvSound('empty')}
 stage='gift';modal(winning?'💰':'📭',winning?'ШКАТУЛКА С ПОДАРКОМ!':'ПУСТАЯ ШКАТУЛКА',winning?'Поздравляем! Ведущий вручает подготовленный подарок для '+groupName(player)+'.':'Увы, в этой шкатулке пусто. Продолжаем игру.',[
 {text:'Продолжить игру →',act:()=>{clearModal();stage='ready';currentSector=null;message(winning?'🎁 Подарок вручён ведущим!':'📭 Шкатулка пустая, вращайте барабан.','good');saveGameAndRender()}}
 ]);saveGameAndRender()}
function guess(c){
 if((stage!=='letter'&&stage!=='plus')||guessed.has(c)||complete())return;
 const sec=currentSector,isPlus=stage==='plus',num=[...rounds[index].a].filter(v=>v===c).length;
 guessed.add(c);
 if(num){const points=isPlus?0:(sec?.points||0)*num;scores[player]+=points;playTvSound('correct');if(complete()){
  stage='roundDone';message(`🏆 ${groupName(player)} разгадала слово! ${points?'+ '+points.toLocaleString('ru-RU')+' очков.':''}`,'good');setResult('ПОБЕДА!','Слово полностью разгадано','win');
 }else{stage='ready';currentSector=null;message(isPlus?`✚ Буква ${c} открыта бесплатно! ${groupName(player)} крутит снова.`:`✓ ${c} — ${num} шт. +${points.toLocaleString('ru-RU')} очков! Крутите снова.`,'good')}
 }else if(isPlus){stage='ready';currentSector=null;playTvSound('empty');message(`✚ Буквы ${c} нет. Сектор «Плюс» не лишает хода.`,'bad')
 }else{playTvSound('pass');const previous=groupName(player);nextPlayer();message(`✕ Буквы ${c} нет. Ход от ${previous} перешёл к ${groupName(player)}.`,'bad');return}
 saveGameAndRender();
}
function reset(){if(stage==='spinning')return;guessed=new Set();stage='ready';currentSector=null;clearModal();message(`🎡 Тур начат! Ход ${groupName(player)}.`);setResult('ГОТОВЫ?','Вращайте барабан','plain');saveGameAndRender()}
function resetGameplayState(alsoIndex=true){clearTimeout(spinTimer);stopTvSound();clearModal();$('wheelPointer').classList.remove('clicking');
 if(alsoIndex)index=0;guessed=new Set();stage='ready';player=0;scores=[0,0,0];gifts=[[],[],[]];currentSector=null;wheelRotation=0;landingIndex=null;wordOpenedByHost=false;
 $('wheelDisk').style.transition='none';$('wheelDisk').style.transform='rotate(0deg)';setResult('ГОТОВЫ?','Начните с вращения барабана','plain');message('🎬 Всё готово. Начинаем!');saveGameAndRender()}
function resetAllGame(){resetGameplayState(true);saveProgress()}
$('spinButton').onclick=()=>{prepareSound();spin()};
$('start').onclick=()=>{if(!rounds.length)return;prepareSound();show('game')};
$('reset').onclick=()=>{if(!confirm('Повторить только текущий тур? Буквы закроются, но общий счёт и подарки сохранятся.'))return;reset()};
$('manualPass').onclick=()=>{if(stage==='spinning'||stage==='box'||stage==='gift'||complete())return;playTvSound('pass');const from=groupName(player);nextPlayer();message('↪ Ведущий передал ход: '+from+' → '+groupName(player),'bad')};
$('revealWord').onclick=()=>{if(stage==='spinning'||complete()||!confirm('Открыть всё слово вручную и завершить этот тур?'))return;
 for(const ch of rounds[index].a)if(ch!==' ')guessed.add(ch);
 stage='roundDone';currentSector=null;playTvSound('correct');setResult('СЛОВО ОТКРЫТО','Тур завершён ведущим','win');message('🎉 Слово открыто ведущим!','good');saveGameAndRender()};
$('next').onclick=()=>{if(!complete()||stage==='spinning')return;if(index===rounds.length-1){show('finish');return}index++;reset()};
$('restart').onclick=()=>{if(!confirm('Начать новую игру с нуля? Очки и подарки обнулятся, вопросы останутся.'))return;resetAllGame();show('game')};
$('fullReset').onclick=()=>{if(!confirm('Полностью сбросить ход игры, очки, подарки и перейти к первому туру? Вопросы, ответы и группы останутся.'))return;resetAllGame();show('intro');alert('Прогресс игры сброшен. Вопросы сохранены.')};
$('fullscreen').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};

function editRender(){const root=$('editList');root.replaceChildren();editing.forEach((r,i)=>{const box=document.createElement('div');box.className='edit';const h=document.createElement('h3');h.textContent='Тур '+(i+1);box.append(h);for(const [key,label] of [['q','Вопрос'],['a','Ответ (русскими буквами)']]){const l=document.createElement('label');l.textContent=label;const field=document.createElement(key==='q'?'textarea':'input');field.value=r[key];field.oninput=()=>editing[i][key]=field.value;box.append(l,field)}const del=document.createElement('button');del.className='danger';del.textContent='Удалить тур';del.onclick=()=>{if(editing.length===1){alert('Нужен хотя бы один тур');return}editing.splice(i,1);editRender()};box.append(del);root.append(box)})}$('settings').onclick=()=>{document.body.dataset.previousScreen=document.body.dataset.screen;editing=rounds.map(r=>({...r}));editingGroups=groups.slice();renderGroupInputs();editRender();show('editor')};$('loadTeacherQuestions').onclick=()=>{if(!confirm('Подставить 5 вопросов с фотографий и группы 208, 207, 125? Пока только в редакторе. Для записи в D1 отдельно нажмите «Сохранить».'))return;editing=teacherPreset.rounds.map(r=>({...r}));editingGroups=teacherPreset.groups.slice();renderGroupInputs();editRender();document.getElementById('presetNote').textContent='✓ Пять туров загружены в редактор. IV тур временный. Нажмите «Сохранить» для записи в D1.'};
$('cancel').onclick=()=>show(document.body.dataset.previousScreen||'intro');$('add').onclick=()=>{editing.push({q:'Новый вопрос',a:'ОТВЕТ'});editRender()};$('save').onclick=async()=>{const next=editing.map(r=>({q:r.q.trim(),a:clean(r.a)}));if(next.some(r=>!r.q||!r.a)){alert('Заполните вопросы и ответы русскими буквами');return}if(editingGroups.some(v=>!v.trim())){alert('Укажите названия всех трёх групп');return}
const newGroups=editingGroups.map(v=>v.trim().slice(0,40));
if(!await ensureAdmin())return;
const saveBtn=$('save');saveBtn.disabled=true;saveBtn.textContent='Сохраняем в базу…';
try{const response=await fetch('/api/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({groups:newGroups,rounds:next})});const result=await response.json();if(!response.ok){throw Error(result.error||'Ошибка записи')};groups=newGroups;rounds=next;renderGroups();resetAllGame();show('intro');alert('✓ Вопросы и группы сохранены в Cloudflare D1')}catch(e){alert('Не удалось сохранить в базу: '+e.message)}finally{saveBtn.disabled=false;saveBtn.textContent='💾 Сохранить'}};
async function ensureAdmin(){try{const state=await fetch('/api/auth',{cache:'no-store'});if(state.ok&&(await state.json()).authenticated)return true;const password=prompt('Первый вход: пароль администратора (на этом ноутбуке запомнится на 90 дней):');if(!password)return false;const response=await fetch('/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});const data=await response.json();if(!response.ok)throw Error(data.error||'Ошибка авторизации');return true}catch(e){alert('Не удалось войти: '+e.message);return false}}
$('logoutAdmin').onclick=async()=>{if(!confirm('Выйти из режима администратора на этом устройстве?'))return;await fetch('/api/auth',{method:'DELETE'});alert('Выход выполнен. При следующем сохранении потребуется пароль.')};

const progressKey='pole-chudes-tv-v3';
function currentGameData(){return {player,scores,gifts,stage,currentSector,wheelRotation}}
function restoreGameData(g){if(!g||typeof g!=='object')return;
 player=Number.isInteger(g.player)&&g.player>=0&&g.player<3?g.player:0;
 scores=Array.isArray(g.scores)&&g.scores.length===3?g.scores.map(n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,10000000):0):[0,0,0];
 gifts=Array.isArray(g.gifts)&&g.gifts.length===3?g.gifts.map(a=>Array.isArray(a)?a.filter(v=>typeof v==='string').slice(0,100).map(v=>v.slice(0,60)):[]):[[],[],[]];
 stage=['ready','letter','plus','roundDone'].includes(g.stage)?g.stage:'ready';
 currentSector=g.currentSector&&typeof g.currentSector==='object'&&Number.isInteger(g.currentSector.points)?{kind:'points',points:Math.max(0,Math.min(2000,g.currentSector.points))}:null;
 if(stage==='letter'&&!currentSector)stage='ready';
 if(stage==='roundDone'&&!complete())stage='ready';
 wheelRotation=Number.isFinite(g.wheelRotation)?Math.max(0,Math.min(g.wheelRotation,100000000)):0;
 $('wheelDisk').style.transition='none';$('wheelDisk').style.transform=`rotate(${wheelRotation}deg)`;
}
function saveProgress(){try{localStorage.setItem(progressKey,JSON.stringify({index,guessed:[...guessed],game:currentGameData(),screen:document.body.dataset.screen||'intro'}))}catch(e){console.warn('Автосохранение недоступно',e)}}
function restoreProgress(){try{
 let p=JSON.parse(localStorage.getItem(progressKey));
 if(!p){p=JSON.parse(localStorage.getItem('pole-chudes-progress-v2'))}
 if(!p)return;
 index=Math.max(0,Math.min(rounds.length-1,Number.isInteger(p.index)?p.index:0));
 guessed=new Set(Array.isArray(p.guessed)?p.guessed.filter(c=>alphabet.includes(c)):[]);
 restoreGameData(p.game);
 if(complete()){stage='roundDone';setResult('ПОБЕДА!','Слово уже раскрыто','win')}
 else if(stage==='letter')setResult(`${currentSector.points}`,'Назовите букву','points');
 else if(stage==='plus')setResult('ПЛЮС','Откройте букву бесплатно','plus');
}catch(e){console.warn('Не удалось восстановить ход игры',e)}}
function backupData(){return {format:'pole-chudes-backup',version:3,exportedAt:new Date().toISOString(),groups,rounds,progress:{index,guessed:[...guessed],game:currentGameData()}}}

$('exportBackup').onclick=()=>{const blob=new Blob([JSON.stringify(backupData(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pole-chudes-backup.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('importBackup').onclick=()=>$('backupFile').click();
$('backupFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw Error('Файл слишком большой');const b=JSON.parse(await file.text());if(b.format!=='pole-chudes-backup'||!Array.isArray(b.groups)||b.groups.length!==3||!b.groups.every(x=>typeof x==='string'&&x.trim())||!Array.isArray(b.rounds)||!b.rounds.length||b.rounds.length>100||!b.rounds.every(r=>typeof r.q==='string'&&r.q.trim()&&typeof r.a==='string'&&clean(r.a)))throw Error('Неверный формат резервной копии');if(!confirm('Заменить текущие вопросы, группы и ход игры данными из файла?'))return;groups=b.groups.map(x=>x.trim().slice(0,40));rounds=b.rounds.map(r=>({q:r.q.trim(),a:clean(r.a)}));index=Math.max(0,Math.min(rounds.length-1,Number.isInteger(b.progress?.index)?b.progress.index:0));guessed=new Set(Array.isArray(b.progress?.guessed)?b.progress.guessed.filter(c=>alphabet.includes(c)):[]);if(!await ensureAdmin())throw Error('Авторизация отменена');const resp=await fetch('/api/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({groups,rounds})});const result=await resp.json();if(!resp.ok)throw Error(result.error||'Ошибка D1');resetGameplayState(false);index=Math.max(0,Math.min(rounds.length-1,Number.isInteger(b.progress?.index)?b.progress.index:0));guessed=new Set(Array.isArray(b.progress?.guessed)?b.progress.guessed.filter(c=>alphabet.includes(c)):[]);if(b.progress?.game){restoreGameData(b.progress.game)}saveProgress();renderGroups();render();show('intro');alert('Настройки восстановлены в Cloudflare D1!')}catch(err){alert('Не удалось импортировать: '+err.message)}finally{e.target.value=''}};

async function loadFromDatabase(){try{const response=await fetch('/api/config',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Ошибка загрузки');if(!Array.isArray(data.groups)||!Array.isArray(data.rounds)||!data.rounds.length)throw Error('Некорректные данные');groups=data.groups;rounds=data.rounds;renderGroups();$('roundCount').textContent=rounds.length;restoreProgress();render();show('intro')}catch(e){document.getElementById('dbError').textContent='⚠ Нет подключения к базе D1: '+e.message+' — показываются демонстрационные вопросы.';renderGroups();$('roundCount').textContent=rounds.length;restoreProgress();render();show('intro')}}loadFromDatabase();
