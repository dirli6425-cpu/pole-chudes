
const initial=[{q:'Как называется прибор для измерения температуры?',a:'ТЕРМОМЕТР'},{q:'Как называется строительный материал, получаемый обжигом глины?',a:'КИРПИЧ'},{q:'Как называется химическая посуда для проведения опытов?',a:'КОЛБА'},{q:'Как называется инструмент для проверки горизонтальности поверхности?',a:'УРОВЕНЬ'},{q:'Как называется вещество, ускоряющее химическую реакцию?',a:'КАТАЛИЗАТОР'}];const $=id=>document.getElementById(id),alphabet=[...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];let rounds=initial, index=0, guessed=new Set(), editing=[];
const defaultGroups=['102','103','104'];let groups=defaultGroups.slice(),editingGroups=[];


function renderGroups(){const el=$('heroGroups');el.replaceChildren();groups.forEach(g=>{const card=document.createElement('div');card.className='group-card';card.textContent=/^\d+$/.test(g)?g+' группа':g;el.append(card)})}
function renderGroupInputs(){const el=$('groupInputs');el.replaceChildren();editingGroups.forEach((g,i)=>{const wrap=document.createElement('div');const label=document.createElement('label');label.textContent='Группа '+(i+1);const input=document.createElement('input');input.value=g;input.maxLength=40;input.placeholder='Например, 102';input.oninput=()=>editingGroups[i]=input.value;wrap.append(label,input);el.append(wrap)})}

const clean=s=>String(s).toUpperCase().replace(/[^А-ЯЁ ]/g,'').trim().replace(/\s+/g,' ');
const complete=()=>[...rounds[index].a].every(c=>c===' '||guessed.has(c));
const SFX={spin:'/audio/spin.mp3',correct:'/audio/correct.mp3',pass:'/audio/pass.mp3',plus:'/audio/plus.mp3',prizes:'/audio/prizes.mp3',empty:'/audio/empty.mp3',money:'/audio/money.mp3'};
const sectors=[
 {t:'300',kind:'points',points:300,color:'#294a89'},
 {t:'ЦВЕТЫ',kind:'flowers',color:'#8b2354'},
 {t:'500',kind:'points',points:500,color:'#126f75'},
 {t:'ПРИЗ',kind:'prize',color:'#9b6624'},
 {t:'250',kind:'points',points:250,color:'#374b80'},
 {t:'ПЛЮС',kind:'plus',color:'#ba9533'},
 {t:'400',kind:'points',points:400,color:'#326b85'},
 {t:'ХОД',kind:'pass',color:'#9b2c3a'},
 {t:'600',kind:'points',points:600,color:'#2f4475'},
 {t:'ШКАТ.',kind:'boxes',color:'#a56a30'},
 {t:'350',kind:'points',points:350,color:'#30656c'},
 {t:'ПЕЧЕНЬЕ',kind:'cookies',color:'#8d4c34'},
 {t:'700',kind:'points',points:700,color:'#254b86'},
 {t:'БАНКРОТ',kind:'bankrupt',color:'#171923'},
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
 const elt=(name,attrs={},text)=>{const el=document.createElementNS(ns,name);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;svg.append(el);return el};
 const n=sectors.length,angle=360/n,R=228;
 const xy=(a,r)=>[Math.cos(a*Math.PI/180)*r,Math.sin(a*Math.PI/180)*r];
 elt('circle',{r:249,fill:'#0e1522',stroke:'#d8a45e','stroke-width':5});elt('circle',{r:239,fill:'#614426',stroke:'#f8d48c','stroke-width':5});
 sectors.forEach((sec,i)=>{
  const a=-90+i*angle,b=a+angle,[x1,y1]=xy(a,R),[x2,y2]=xy(b,R);
  elt('path',{d:`M 0 0 L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`,fill:sec.color,stroke:'#e5bf77','stroke-width':2.1});
  const mid=a+angle/2,[mx,my]=xy(mid,167);
  const label=elt('text',{x:mx,y:my,'text-anchor':'middle','dominant-baseline':'middle',fill:'#fff8df','font-family':'Arial,sans-serif','font-weight':900,'font-size':sec.t.length>6?10:sec.t.length>4?11.5:15,transform:`rotate(${mid+90} ${mx} ${my})`,stroke:'#071323','stroke-width':2.8,'paint-order':'stroke'},sec.t);
  const [px,py]=xy(mid,217);elt('circle',{cx:px,cy:py,r:3.4,fill:'#ffe7ac',stroke:'#5a3514','stroke-width':1});
 });
 elt('circle',{r:46,fill:'#3b281d',stroke:'#f7d48a','stroke-width':7});
 elt('circle',{r:31,fill:'#17283b',stroke:'#eebd59','stroke-width':2});
 for(let k=0;k<40;k++){const[x,y]=xy(k*9,242);elt('circle',{cx:x,cy:y,r:2.9,fill:k%2?'#fff2c6':'#b8792c'})}
}
wheelSvg();
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
 const tray=$('giftShelf');tray.replaceChildren();const title=document.createElement('div');title.className='shelf-title';title.textContent='ПОДАРКИ УЧАСТНИКОВ';tray.append(title);
 groups.forEach((g,i)=>{const div=document.createElement('div');div.className='shelf-row';div.textContent=`${groupName(i)}: ${gifts[i].length?gifts[i].join(' · '):'пока нет'}`;tray.append(div)})
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
 const guide=complete()?'Слово открыто! Ведущий нажимает «Следующий тур».':stage==='ready'?`Ход ${groupName(player)}. Нажмите «Вращать барабан» или выберите другую группу.`:stage==='spinning'?'Барабан набирает обороты, затем плавно остановится на случайном секторе.':stage==='letter'?`Назовите букву. За каждое совпадение получите ${currentSector?.points||0} очков. При ошибке ход переходит дальше.`:stage==='plus'?'Сектор «Плюс»: выберите любую ещё закрытую букву — она откроется бесплатно.':stage==='box'?'Выберите одну из двух шкатулок. Только в одной спрятаны деньги.':stage==='gift'?'Ведущий вручает подарок и подтверждает продолжение.':'Следуйте подсказке ведущего.';
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
 const kind=sec.kind;setResult(sec.t,kind==='points'?`${sec.points} очков за каждую открытую букву`:kind==='double'?'Двойные очки за букву':kind==='boxes'?'Две шкатулки, одна с деньгами':kind==='flowers'?'Букет цветов участникам':kind==='cookies'?'Печенье участникам':kind==='prize'?'Сюрприз для участников':kind==='plus'?'Бесплатно откройте букву':kind==='pass'?'Ход переходит дальше':kind==='bankrupt'?'Очки текущей группы обнуляются':'',kind);
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
  modal('📦','ДВЕ ШКАТУЛКИ','В одной спрятаны 2 000 очков. Игрок выбирает одну, ведущий открывает её.',[
    {text:'📦 Шкатулка № 1',act:()=>openBox(0,correctBox)},{text:'📦 Шкатулка № 2',act:()=>openBox(1,correctBox)}]);
 }else{
  stage='gift';playTvSound('prizes');const labels={flowers:['💐','ЦВЕТЫ','Букет цветов для '+groupName(player)+'!'],cookies:['🍪','ПЕЧЕНЬЕ','Сладкий подарок для '+groupName(player)+'!'],prize:['🎁','ПРИЗ В СТУДИЮ','Ведущий вручает приз группе '+groups[player]+'.']};
  const [icon,title,desc]=labels[kind];
  modal(icon,title,desc,[{text:'🎁 Приз вручен — продолжить',act:()=>{gifts[player].push(icon+' '+(kind==='prize'?'Приз':kind==='flowers'?'Цветы':'Печенье'));clearModal();stage='ready';currentSector=null;message('🎁 Подарок вручён! Можно снова вращать барабан.','good');saveGameAndRender()} }]);
 }
 saveGameAndRender();
}
function openBox(chosen,correct){const winning=chosen===correct;clearModal();if(winning){scores[player]+=2000;gifts[player].push('💰 Шкатулка');playTvSound('money')}else{playTvSound('empty')}
 stage='gift';modal(winning?'💰':'📭',winning?'ШКАТУЛКА С ДЕНЬГАМИ!':'ПУСТАЯ ШКАТУЛКА',winning?'Поздравляем! +2 000 очков для '+groupName(player)+'.':'Увы, в этой шкатулке пусто. Продолжаем игру.',[
 {text:'Продолжить игру →',act:()=>{clearModal();stage='ready';currentSector=null;message(winning?'💰 Призовые очки начислены!':'📭 Шкатулка пустая, вращайте барабан.','good');saveGameAndRender()}}
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

function editRender(){const root=$('editList');root.replaceChildren();editing.forEach((r,i)=>{const box=document.createElement('div');box.className='edit';const h=document.createElement('h3');h.textContent='Тур '+(i+1);box.append(h);for(const [key,label] of [['q','Вопрос'],['a','Ответ (русскими буквами)']]){const l=document.createElement('label');l.textContent=label;const field=document.createElement(key==='q'?'textarea':'input');field.value=r[key];field.oninput=()=>editing[i][key]=field.value;box.append(l,field)}const del=document.createElement('button');del.className='danger';del.textContent='Удалить тур';del.onclick=()=>{if(editing.length===1){alert('Нужен хотя бы один тур');return}editing.splice(i,1);editRender()};box.append(del);root.append(box)})}$('settings').onclick=()=>{document.body.dataset.previousScreen=document.body.dataset.screen;editing=rounds.map(r=>({...r}));editingGroups=groups.slice();renderGroupInputs();editRender();show('editor')};$('cancel').onclick=()=>show(document.body.dataset.previousScreen||'intro');$('add').onclick=()=>{editing.push({q:'Новый вопрос',a:'ОТВЕТ'});editRender()};$('save').onclick=async()=>{const next=editing.map(r=>({q:r.q.trim(),a:clean(r.a)}));if(next.some(r=>!r.q||!r.a)){alert('Заполните вопросы и ответы русскими буквами');return}if(editingGroups.some(v=>!v.trim())){alert('Укажите названия всех трёх групп');return}
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
