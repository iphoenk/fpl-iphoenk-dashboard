import {handle} from '../server.mjs';
import {archiveResponse} from '../phase-one-server.mjs';
export default {
 async fetch(request){
  const url=new URL(request.url);
  if(/^\/api\/forecast-archive\/?$/.test(url.pathname))return archiveResponse(request);
  if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/model/')&&!url.pathname.startsWith('/api/insights/')&&!url.pathname.endsWith('/'))url.pathname+='/';
  const response=await handle(new Request(url,request),{},null,'');
  if(response.ok){response.headers.set('Cache-Control','public, max-age=30');response.headers.set('Vercel-CDN-Cache-Control','public, s-maxage=180');}
  return response;
 }
};
