import {handle} from '../server.mjs';
export default {
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/model/')&&!url.pathname.startsWith('/api/insights/')&&!url.pathname.endsWith('/'))url.pathname+='/';
  const normalized=new Request(url,request);
  const response=await handle(normalized,{},null,'');
  if(response.ok){
   response.headers.set('Cache-Control','public, max-age=30');
   response.headers.set('Vercel-CDN-Cache-Control','public, s-maxage=180');
  }
  return response;
 }
};
