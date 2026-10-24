// Pure game rules. The score is always derived from revealed answers.
export const LETTERS = ['А','Б','В','Г'];
export const MONEY = ['100','200','300','500','1 000','2 000','4 000','8 000','16 000','32 000','64 000','125 000','250 000','500 000','1 000 000'];
export const ROUND_NAMES = ['Знатоки русского языка','Украинский язык — мелодия слова','Литературный калейдоскоп','Профессиональный эрудит'];
export const teamOf = (q,i) => Number.isInteger(q?.team) && q.team>=0 && q.team<2 ? q.team : i%2;
export const roundOf = q => Number.isInteger(q?.round) && q.round>=0 && q.round<4 ? q.round : 0;
export const clone = o => JSON.parse(JSON.stringify(o));
export function validateConfig(data){
  const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
  if(!data||!text(data.title,100)||!Array.isArray(data.questions)||data.questions.length<1||data.questions.length>200) throw Error('Нужно название и от 1 до 200 вопросов.');
  data.questions.forEach((q,i)=>{if(!q||!text(q.q,500)||!Array.isArray(q.options)||q.options.length!==4||!q.options.every(s=>text(s,200))||!Number.isInteger(q.correct)||q.correct<0||q.correct>3||('team'in q&&(!Number.isInteger(q.team)||q.team<0||q.team>1))||('round'in q&&(!Number.isInteger(q.round)||q.round<0||q.round>3)))throw Error(`Проверьте вопрос ${i+1}: текст, 4 варианта и правильный ответ.`)});
  return {title:data.title.trim(),roundNames:Array.isArray(data.roundNames)&&data.roundNames.length===4&&data.roundNames.every(s=>text(s,100))?data.roundNames.map(s=>s.trim()):[...ROUND_NAMES],questions:data.questions.map((q,i)=>({...q,q:q.q.trim(),options:q.options.map(s=>s.trim()),team:teamOf(q,i),round:roundOf(q)}))};
}
export function freshState(config){return {index:0,phase:'picking',selected:null,removed:[],history:config.questions.map(()=>null),used:[{fifty:false,audience:false},{fifty:false,audience:false}],started:false,completed:false};}
export function fingerprint(c){let h=2166136261;const s=JSON.stringify(c);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
export function restoreState(config,s){
  const out=freshState(config);if(!s||!Number.isInteger(s.index)||s.index<0||s.index>=config.questions.length)return out;
  out.index=s.index;out.started=!!s.started;out.completed=!!s.completed;
  if(Array.isArray(s.history))out.history=out.history.map((_,i)=>(s.history[i]===true||s.history[i]===false)&&i<=out.index?s.history[i]:null);
  out.used=[0,1].map(t=>({fifty:s.used?.[t]?.fifty===true,audience:s.used?.[t]?.audience===true}));
  out.removed=Array.isArray(s.removed)?[...new Set(s.removed.filter(n=>Number.isInteger(n)&&n>=0&&n<4&&n!==config.questions[out.index].correct))].slice(0,2):[];
  out.selected=Number.isInteger(s.selected)&&s.selected>=0&&s.selected<4&&!out.removed.includes(s.selected)?s.selected:null;
  out.phase=out.history[out.index]!==null?'revealed':(s.phase==='locked'&&out.selected!==null?'locked':'picking');
  if(out.completed&&!out.history.every(x=>typeof x==='boolean'))out.completed=false;
  return out;
}
export function scores(config,state){const result=[0,0];config.questions.forEach((q,i)=>{if(state.history[i]===true)result[teamOf(q,i)]++});return result}
export function roundStats(config,state,team,round){let total=0,correct=0;config.questions.forEach((q,i)=>{if(teamOf(q,i)===team&&roundOf(q)===round){total++;if(state.history[i]===true)correct++}});return {total,correct}}
export function ladderRows(config,state,team,round){const {total,correct}=roundStats(config,state,team,round);const n=Math.min(15,total),step=total?Math.ceil(correct*n/total):0;return Array.from({length:n},(_,i)=>({number:i+1,money:MONEY[n===1?14:Math.round(i*14/(n-1))],cleared:i<step,active:i===step-1,target:i===step})).reverse()}
export function choose(state,i){if(state.phase!=='picking'||state.completed||!Number.isInteger(i)||i<0||i>3||state.removed.includes(i))return false;state.selected=i;return true}
export function lock(state){if(state.phase!=='picking'||state.selected===null)return false;state.phase='locked';return true}
export function reveal(config,state){if(state.phase!=='locked')return null;const correct=state.selected===config.questions[state.index].correct;state.history[state.index]=correct;state.phase='revealed';return correct}
export function advance(config,state){if(state.phase!=='revealed')return false;if(state.index===config.questions.length-1){state.completed=true;return true}state.index++;state.phase='picking';state.selected=null;state.removed=[];return true}
export function fifty(config,state,rng=Math.random){const q=config.questions[state.index],t=teamOf(q,state.index);if(state.phase!=='picking'||state.used[t].fifty)return false;state.used[t].fifty=true;const wrong=[0,1,2,3].filter(i=>i!==q.correct);for(let i=wrong.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[wrong[i],wrong[j]]=[wrong[j],wrong[i]]}state.removed=wrong.slice(0,2);if(state.removed.includes(state.selected))state.selected=null;return true}
export function audience(config,state){const t=teamOf(config.questions[state.index],state.index);if(state.phase!=='picking'||state.used[t].audience)return false;state.used[t].audience=true;return true}
export const DEFAULT_SETTINGS={teamNames:['Команда 01','Команда 02'],musicVolume:28,effectsVolume:65,revealDelay:4,motion:true,contrast:false,muted:false};
export function cleanSettings(s={}){const v=clone(DEFAULT_SETTINGS);if(Array.isArray(s.teamNames)&&s.teamNames.length===2)v.teamNames=s.teamNames.map((n,i)=>typeof n==='string'&&n.trim()?n.trim().slice(0,40):v.teamNames[i]);for(const k of ['musicVolume','effectsVolume'])if(Number.isFinite(s[k]))v[k]=Math.min(100,Math.max(0,s[k]));if([0,2,4,7].includes(s.revealDelay))v.revealDelay=s.revealDelay;for(const k of ['motion','contrast','muted'])if(typeof s[k]==='boolean')v[k]=s[k];return v}
