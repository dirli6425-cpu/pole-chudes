// Million Studio V9 / MTA site3 adapter for the existing games-local.service.
// Keeps the original worker, database bridge and site2 routes intact.
import http from 'node:http';
import { webcrypto, randomBytes } from 'node:crypto';
import { readFileSync, accessSync, existsSync } from 'node:fs';
import { readFile, stat, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, extname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.mjs';
import worker from './worker.mjs';
import millionWorker from './million-worker.mjs';

globalThis.crypto ??= webcrypto;
const dbPath = process.env.DB_PATH || '/var/lib/games-local/games.sqlite';
accessSync(dbPath);
const DB = openDatabase(dbPath);
for (const name of ['game_config', 'million_config', 'million_store']) {
  await DB.prepare(`SELECT COUNT(*) AS n FROM ${name}`).first();
}
const ADMIN_KEY = readFileSync(process.env.ADMIN_KEY_FILE || '/var/lib/games-local/admin.key', 'utf8').trim();
if (ADMIN_KEY.length < 8) throw new Error('Admin password must contain at least 8 characters');
// A second site3-only password can be stored outside the repository.
// Nothing is changed in the original site2 worker or its password.
const extraKeyFile = process.env.ADMIN_EXTRA_KEY_FILE || '/var/lib/games-local/admin-extra.key';
const EXTRA_ADMIN_KEY = existsSync(extraKeyFile) ? readFileSync(extraKeyFile, 'utf8').trim() : '';
const ADMIN_KEYS = [...new Set([ADMIN_KEY, EXTRA_ADMIN_KEY].filter(Boolean))];
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const publicResolved = resolve(publicRoot);
const audioDir = process.env.MILLION_AUDIO_DIR || '/var/lib/games-local/million-audio';
const CUES = new Set(['intro','bed','start','round','select','lock','correct','wrong','fifty','audience','next','finish','click','hover']);
const AUDIO_EXT = new Map(Object.entries({
  '.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.m4a':'audio/mp4',
  '.flac':'audio/flac','.aac':'audio/aac','.opus':'audio/ogg','.webm':'audio/webm'
}));
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp',
  '.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2', ...Object.fromEntries(AUDIO_EXT) };
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff'
}});
const error = (status, message) => json({error:message},status);

// Supports byte ranges needed by Firefox/Chromium for MP3 playback and seeking.
async function fileReply(file, request, contentType) {
  let st;
  try { st = await stat(file); if (!st.isFile()) return error(404,'Файл не найден'); }
  catch { return error(404,'Файл не найден'); }
  const size=st.size, headers={
    'content-type':contentType || MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'accept-ranges':'bytes','cache-control':'no-cache',
    'x-content-type-options':'nosniff'
  };
  let start=0,end=size-1,status=200;
  const range=request.headers.get('range') || '';
  if (range) {
    const m=/^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m || (!m[1]&&!m[2]) || size===0) {
      return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${size}`}});
    }
    if (m[1]) {start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}
    else { const suffix=Number(m[2]);start=Math.max(0,size-suffix);end=size-1; }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start<0 || start>end || start>=size)
      return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${size}`}});
    status=206;headers['content-range']=`bytes ${start}-${end}/${size}`;
  }
  headers['content-length']=String(status===206?end-start+1:size);
  if(request.method==='HEAD') return new Response(null,{status,headers});
  const buffer=await readFile(file);
  return new Response(status===206?buffer.subarray(start,end+1):buffer,{status,headers});
}
async function asset(request) {
  if (!['GET','HEAD'].includes(request.method)) return error(405,'Метод не поддерживается');
  let pathname;
  try { pathname=decodeURIComponent(new URL(request.url).pathname); }
  catch { return error(400,'Некорректный путь'); }
  if (pathname.includes('\0') || pathname.includes('\\')) return error(404,'Не найдено');
  let file=resolve(publicRoot,'.'+pathname);
  if (file!==publicResolved && !file.startsWith(publicResolved+'/')) return error(404,'Не найдено');
  try { if ((await stat(file)).isDirectory()) file=resolve(file,'index.html'); }
  catch { return error(404,'Не найдено'); }
  return fileReply(file,request);
}
const env={DB,ADMIN_KEY,ADMIN_KEYS,ASSETS:{fetch:asset}};
const getStore=async name => {
  const row=await DB.prepare('SELECT payload FROM million_store WHERE key = ?').bind(name).first();
  return row?JSON.parse(row.payload):null;
};
const setStore=async (name,value) => DB.prepare(
  'INSERT INTO million_store (key,payload,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP'
).bind(name,JSON.stringify(value)).run();
const authStatus=async request => {
  const r=await millionWorker.fetch(new Request('http://localhost/api/auth',{method:'GET',headers:{cookie:request.headers.get('cookie')||''}}),env);
  return r.ok && Boolean((await r.json()).authenticated);
};
async function receive(req,limit) {
  let size=0;const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>limit) {const err=new Error('Запрос слишком большой');err.httpStatus=413;throw err;}
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const checkedJson = (body) => {
  let data;
  try{data=JSON.parse(body.toString('utf8'));}catch{const e=new Error('Некорректный JSON');e.httpStatus=400;throw e;}
  if (!data || typeof data!=='object' || Array.isArray(data)) {const e=new Error('Нужен JSON-объект');e.httpStatus=400;throw e;}
  return data;
};
async function atomicWrite(target,buf) {
  await mkdir(audioDir,{recursive:true,mode:0o750});
  const tmp=join(audioDir,'.upload-'+randomBytes(12).toString('hex'));
  try{await writeFile(tmp,buf,{flag:'wx',mode:0o600});await rename(tmp,target);}
  finally{await unlink(tmp).catch(()=>{});}
}
async function site3ExtraApi(path,req,request) {
  if (path==='/api/studio' && req.method==='GET') return json({mode:'local',hosted:true,version:9});
  if (path==='/api/settings' || path==='/api/state') {
    const key=path==='/api/settings'?'settings':'state';
    if (req.method==='GET') return json(await getStore(key));
    if (req.method!=='PUT') return error(405,'Метод не поддерживается');
    if (!await authStatus(request)) return error(401,'Требуется вход администратора');
    const obj=checkedJson(await receive(req,180000));
    await setStore(key,obj);
    return json({ok:true});
  }
  if (path==='/api/audio') {
    if (req.method!=='GET') return error(405,'Метод не поддерживается');
    return json(await getStore('audio_manifest')||{});
  }
  if (path.startsWith('/api/audio/')) {
    const cue=path.slice('/api/audio/'.length);
    if (!CUES.has(cue)) return error(404,'Неизвестный звук');
    const manifest=await getStore('audio_manifest')||{};
    const item=manifest[cue];
    if (req.method==='GET' || req.method==='HEAD') {
      if (!item) return error(404,'Звук не найден');
      if (!/^([a-z]+)\.(mp3|ogg|wav|m4a|flac|aac|opus|webm)$/.test(item.file) || !item.file.startsWith(cue+'.'))
        return error(500,'Некорректный файл звука');
      return fileReply(join(audioDir,item.file),request,item.type);
    }
    if (!['PUT','DELETE'].includes(req.method)) return error(405,'Метод не поддерживается');
    if (!await authStatus(request)) return error(401,'Требуется вход администратора');
    if (req.method==='DELETE') {
      delete manifest[cue];
      await setStore('audio_manifest',manifest);
      if(item && /^[a-z]+\.(mp3|ogg|wav|m4a|flac|aac|opus|webm)$/.test(item.file))
        await unlink(join(audioDir,item.file)).catch(()=>{});
      return json({ok:true});
    }
    let name;
    try{name=decodeURIComponent(req.headers['x-audio-name']||'');}catch{return error(400,'Неверное имя звука');}
    name=basename(name.replaceAll('\\','/')).slice(0,200);
    const ext=extname(name).toLowerCase(),type=AUDIO_EXT.get(ext);
    if (!type) return error(400,'Допустимы MP3, WAV, OGG, M4A и другие аудиоформаты');
    const body=await receive(req,25*1024*1024);
    if (!body.length) return error(400,'Пустой звуковой файл');
    const filename=cue+ext;
    await atomicWrite(join(audioDir,filename),body);
    const record={name,file:filename,type,updated:Date.now()};
    manifest[cue]=record;
    await setStore('audio_manifest',manifest);
    if(item && item.file!==filename && /^[a-z]+\.(mp3|ogg|wav|m4a|flac|aac|opus|webm)$/.test(item.file))
      await unlink(join(audioDir,item.file)).catch(()=>{});
    return json(record);
  }
  return null;
}

// A tiny serialization queue preserves the behavior of the existing sqlite bridge.
let queue=Promise.resolve();
async function dispatch(req,res) {
  let response, prefix=null;
  try {
    const origin=process.env.PUBLIC_ORIGIN || 'https://dirli-server.tail41d437.ts.net';
    const url=new URL(req.url,origin);
    prefix=url.pathname==='/site2'||url.pathname.startsWith('/site2/')?'/site2':
      url.pathname==='/site3'||url.pathname.startsWith('/site3/')?'/site3':null;
    if (url.pathname==='/healthz') response=json({ok:true,mode:'copy',site3:'v9'});
    else if (!prefix) response=error(404,'Не найдено');
    else if (url.pathname===prefix) response=new Response(null,{status:302,headers:{location:prefix+'/'}});
    else {
      const rest=url.pathname.slice(prefix.length);
      const api=rest.startsWith('/api/');
      const headers=new Headers();
      for(const [key,value] of Object.entries(req.headers))
        if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
      const incoming=new Request(url,{method:req.method,headers});
      if(prefix==='/site3' && api)response=await site3ExtraApi(rest,req,incoming);
      if (!response) {
        if (api) url.pathname=rest;
        else if (rest==='/portal/')url.pathname='/';
        else if (prefix==='/site2' && (rest.startsWith('/audio/')||['/building.jpg','/laboratory.jpg'].includes(rest)))url.pathname=rest;
        // Crucial: /site3/audio/*.mp3 is specific to Million, NOT the shared Pole Chudes /audio folder.
        else url.pathname=(prefix==='/site2'?'/pole-chudes':'/million')+rest;
        const chunks=await receive(req,180000);
        const upstream=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:chunks}:{})});
        response=await (prefix==='/site3'?millionWorker:worker).fetch(upstream,env);
      }
    }
    const outgoing=new Headers(response.headers);
    if(prefix && outgoing.has('set-cookie')) {
      outgoing.set('set-cookie',outgoing.get('set-cookie').replace(/Path=\/([;]|$)/i,`Path=${prefix}/$1`));
    }
    for(const [key,value] of outgoing)res.setHeader(key,value);
    res.statusCode=response.status;
    res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  } catch(ex) {
    console.error('games-local:',ex);
    const status=ex.httpStatus||500;
    if(!res.headersSent){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');}
    res.end(JSON.stringify({error:status===500?'Ошибка сервера игр; проверьте journalctl':ex.message}));
  }
}
const server=http.createServer((req,res)=>{queue=queue.catch(e=>console.error(e)).then(()=>dispatch(req,res));});
server.listen(Number(process.env.PORT||8082),'127.0.0.1',()=>console.log('games-local: /site2 original, /site3 Million Studio V9 with SQLite'));
server.requestTimeout=120000;
server.headersTimeout=15000;
function shutdown(){server.close(()=>DB.close());setTimeout(()=>process.exit(0),5000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
