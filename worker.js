const initial={groups:['102','103','104'],rounds:[{q:'Как называется прибор для измерения температуры?',a:'ТЕРМОМЕТР'},{q:'Как называется строительный материал, получаемый обжигом глины?',a:'КИРПИЧ'},{q:'Как называется химическая посуда для проведения опытов?',a:'КОЛБА'},{q:'Как называется инструмент для проверки горизонтальности поверхности?',a:'УРОВЕНЬ'},{q:'Как называется вещество, ускоряющее химическую реакцию?',a:'КАТАЛИЗАТОР'}]};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname!=='/api/config')return env.ASSETS.fetch(request);if(!env.DB)return json({error:'D1 не подключена'},503);
try{if(request.method==='GET'){const record=await env.DB.prepare('SELECT payload FROM game_config WHERE id=1').first();return json(record?JSON.parse(record.payload):initial)}
if(request.method==='PUT'){
const key=request.headers.get('x-admin-key')||'';
if(!env.ADMIN_KEY)return json({error:'Секрет ADMIN_KEY не настроен на Cloudflare'},503);
const a=new TextEncoder().encode(key),b=new TextEncoder().encode(env.ADMIN_KEY);
let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);
if(diff!==0)return json({error:'Неверный пароль администратора'},401);
if(Number(request.headers.get('content-length')||0)>50000)return json({error:'Слишком большой запрос'},413);
const raw=await request.text();if(raw.length>50000)return json({error:'Слишком большой запрос'},413);
const data=JSON.parse(raw);const clean=s=>s.toUpperCase().replace(/[^А-ЯЁ ]/g,'').trim().replace(/\s+/g,' ');
if(!Array.isArray(data.groups)||data.groups.length!==3||!data.groups.every(g=>typeof g==='string'&&g.trim()&&g.length<=40)||!Array.isArray(data.rounds)||data.rounds.length<1||data.rounds.length>100||!data.rounds.every(r=>typeof r.q==='string'&&r.q.trim()&&r.q.length<=500&&typeof r.a==='string'&&clean(r.a)&&r.a.length<=80))return json({error:'Некорректные группы или вопросы'},400);
const value=JSON.stringify({groups:data.groups.map(x=>x.trim()),rounds:data.rounds.map(r=>({q:r.q.trim(),a:clean(r.a)}))});
await env.DB.prepare('INSERT INTO game_config (id,payload,updated_at) VALUES (1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=CURRENT_TIMESTAMP').bind(value).run();return json({ok:true});}
return json({error:'Метод не поддерживается'},405);
}catch(e){console.error(e);return json({error:'Ошибка сервера или базы данных'},500)}}};
