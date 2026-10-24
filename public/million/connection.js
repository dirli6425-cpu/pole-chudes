// HTTPS API connector: works from both /site3/ and a separate GitHub Pages origin.
// To change servers, edit the meta[name="million-api-base"] in index.html.
const declared=document.querySelector('meta[name="million-api-base"]')?.content?.trim();
export const apiBase=(declared||'https://dirli-server.tail41d437.ts.net/site3').replace(/\/+$/,'');
export const externalApi=new URL(apiBase).origin!==window.location.origin;
const tokenKey='million-v9-remote-token';
export const apiUrl=path=>apiBase+path;
export const saveBearerToken=token=>{if(externalApi&&typeof token==='string')sessionStorage.setItem(tokenKey,token)};
export const clearBearerToken=()=>{sessionStorage.removeItem(tokenKey)};
export async function apiFetch(path,options={}){
 const headers=new Headers(options.headers||{});
 if(externalApi){const token=sessionStorage.getItem(tokenKey);if(token)headers.set('Authorization','Bearer '+token);}
 return fetch(apiUrl(path),{
  cache:'no-store',credentials:externalApi?'omit':'same-origin',...options,
  headers,signal:options.signal||AbortSignal.timeout(4000)
 });
}
