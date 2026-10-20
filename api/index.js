import {handle} from '../server.mjs';
import {archiveResponse} from '../phase-one-server.mjs';
import {providerResponse} from '../independent-providers.mjs';
import {ownModelResponse} from '../own-model-server.mjs';
export default {
 async fetch(request){
  const url=new URL(request.url);
  const own=await ownModelResponse(request);if(own)return own;
  if(/^\/api\/forecast-archive\/?$/.test(url.pathname))return archiveResponse(request);
  const provider=await providerResponse(request,{upstream:req=>handle(req,{},null,'')});if(provider)return provider;
  if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/model/')&&!url.pathname.startsWith('/api/insights/')&&!url.pathname.endsWith('/'))url.pathname+='/';
  const response=await handle(new Request(url,request),{},null,'');
  if(response.ok){response.headers.set('Cache-Control','public, max-age=30');response.headers.set('Vercel-CDN-Cache-Control','public, s-maxage=180');}
  return response;
 }
};
