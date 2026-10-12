const initial={groups:['102','103','104'],rounds:[{q:'Как называется прибор для измерения температуры?',a:'ТЕРМОМЕТР'},{q:'Как называется строительный материал, получаемый обжигом глины?',a:'КИРПИЧ'},{q:'Как называется химическая посуда для проведения опытов?',a:'КОЛБА'},{q:'Как называется инструмент для проверки горизонтальности поверхности?',a:'УРОВЕНЬ'},{q:'Как называется вещество, ускоряющее химическую реакцию?',a:'КАТАЛИЗАТОР'}]};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const COOKIE='pc_admin';
const MAX_AGE=90*24*60*60;
const enc=new TextEncoder();
const b64=u=>btoa(String.fromCharCode(...u)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const from64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function mac(secret,payload){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(payload))))}
function equal(a,b){let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0}
async function authorized(request,env){if(!env.ADMIN_KEY)return false;try{const cookie=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));if(!cookie)return false;const token=cookie.slice(COOKIE.length+1);const [payload,sig]=token.split('.');if(!payload||!sig||!equal(sig,await mac(env.ADMIN_KEY,payload)))return false;const data=JSON.parse(new TextDecoder().decode(from64(payload)));return data.exp>Date.now()&&data.exp<=Date.now()+MAX_AGE*1000}catch{return false}}
const cookieOpts='; Path=/; HttpOnly; Secure; SameSite=Strict';
export default {async fetch(request,env){const url=new URL(request.url);
if(url.pathname==='/api/auth'){
 if(request.method==='GET')return json({authenticated:await authorized(request,env)});
 if(request.method==='DELETE')return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json','set-cookie':COOKIE+'=; Max-Age=0'+cookieOpts,'cache-control':'no-store'}});
 if(request.method==='POST'){
  if(!env.ADMIN_KEY)return json({error:'Сначала установите ADMIN_KEY в Cloudflare'},503);
  if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Запрос слишком большой'},413);
  let data;try{data=await request.json()}catch{return json({error:'Некорректный запрос'},400)}
  if(!equal(String(data.password||''),env.ADMIN_KEY))return json({error:'Неверный пароль'},401);
  try {
   const payload=b64(enc.encode(JSON.stringify({exp:Date.now()+MAX_AGE*1000})));
   const token=payload+'.'+await mac(env.ADMIN_KEY,payload);
   const response=json({ok:true});
   response.headers.set('Set-Cookie',COOKIE+'='+token+'; Max-Age='+MAX_AGE+cookieOpts);
   return response;
  } catch (error) {
   console.error('Admin session creation failed:',error);
   return json({error:'Ошибка создания сеанса администратора',code:'SESSION_CREATE_FAILED',detail:String(error?.name||'UnknownError')},500);
  }
 }
 return json({error:'Метод не поддерживается'},405);
}
if(url.pathname==='/pole-chudes')return Response.redirect(url.origin+'/pole-chudes/',302);
if(url.pathname==='/million')return Response.redirect(url.origin+'/million/',302);
if(url.pathname==='/api/million'){
 if(!env.DB)return json({error:'D1 не подключена'},503);
 try{
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT payload FROM million_config WHERE id=1').first();
   return json(row?JSON.parse(row.payload):{title:'Миллион для группы',questions:[
    {q:'Какой газ необходим человеку для дыхания?',options:['Азот','Кислород','Гелий','Водород'],correct:1},
    {q:'Сколько градусов в прямом угле?',options:['45','60','90','180'],correct:2},
    {q:'Какая планета ближе всего к Солнцу?',options:['Венера','Земля','Меркурий','Марс'],correct:2}
   ]});
  }
  if(request.method==='PUT'){
   if(!await authorized(request,env))return json({error:'Требуется вход администратора'},401);
   const raw=await request.text();if(raw.length>100000)return json({error:'Слишком большой запрос'},413);
   const data=JSON.parse(raw);
   if(typeof data.title!=='string'||!data.title.trim()||data.title.length>100||!Array.isArray(data.questions)||data.questions.length<1||data.questions.length>50||!data.questions.every(q=>typeof q.q==='string'&&q.q.trim()&&q.q.length<=500&&Array.isArray(q.options)&&q.options.length===4&&q.options.every(a=>typeof a==='string'&&a.trim()&&a.length<=200)&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4))return json({error:'Проверьте вопросы и варианты ответов'},400);
   await env.DB.prepare('INSERT INTO million_config (id,payload,updated_at) VALUES (1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP').bind(JSON.stringify({title:data.title.trim(),questions:data.questions})).run();return json({ok:true});
  }
  return json({error:'Метод не поддерживается'},405);
 }catch(e){console.error('Million API error',e);return json({error:'Ошибка API игры «Миллион»; проверьте миграцию 0002',code:'MILLION_DB_ERROR'},500)}
}
if(url.pathname!=='/api/config')return env.ASSETS.fetch(request);
if(!env.DB)return json({error:'D1 не подключена'},503);
try{if(request.method==='GET'){const record=await env.DB.prepare('SELECT payload FROM game_config WHERE id=1').first();return json(record?JSON.parse(record.payload):initial)}
if(request.method==='PUT'){
 if(!await authorized(request,env))return json({error:'Требуется вход администратора',code:'AUTH_REQUIRED'},401);
 if(Number(request.headers.get('content-length')||0)>50000)return json({error:'Слишком большой запрос'},413);
 const raw=await request.text();if(raw.length>50000)return json({error:'Слишком большой запрос'},413);
 const data=JSON.parse(raw);const clean=s=>s.toUpperCase().replace(/[^А-ЯЁ ]/g,'').trim().replace(/\s+/g,' ');
 if(!Array.isArray(data.groups)||data.groups.length!==3||!data.groups.every(g=>typeof g==='string'&&g.trim()&&g.length<=40)||!Array.isArray(data.rounds)||data.rounds.length<1||data.rounds.length>100||!data.rounds.every(r=>typeof r.q==='string'&&r.q.trim()&&r.q.length<=500&&typeof r.a==='string'&&clean(r.a)&&r.a.length<=80))return json({error:'Некорректные группы или вопросы'},400);
 const value=JSON.stringify({groups:data.groups.map(x=>x.trim()),rounds:data.rounds.map(r=>({q:r.q.trim(),a:clean(r.a)}))});
 await env.DB.prepare('INSERT INTO game_config (id,payload,updated_at) VALUES (1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=CURRENT_TIMESTAMP').bind(value).run();return json({ok:true});}
return json({error:'Метод не поддерживается'},405);
}catch(e){console.error(e);return json({error:'Ошибка сервера или базы данных'},500)}}};
