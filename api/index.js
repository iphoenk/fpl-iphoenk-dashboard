import {handle} from '../server.mjs';
import {publicDecisionResponse} from '../multiuser-decision-server.mjs';
import {archiveResponse} from '../phase-one-server.mjs';
import {providerResponse} from '../independent-providers.mjs';
import {ownModelResponse} from '../own-model-server.mjs';
import {checkRateLimit,rateLimitResponse,rateLimitRule} from '../rate-limit.mjs';
export default {
 async fetch(request){
  const url=new URL(request.url);
  // GET and HEAD: server.mjs serves HEAD for the fan-out endpoints at full upstream cost.
  const rule=['GET','HEAD'].includes(request.method)?rateLimitRule(url.pathname):null;
  if(rule){
   const {limited,retryAfter}=checkRateLimit(rule.name,request,{limit:rule.limit});
   if(limited)return rateLimitResponse(retryAfter);
  }
  const decision=await publicDecisionResponse(request);if(decision)return decision;
  const own=await ownModelResponse(request);if(own)return own;
  if(/^\/api\/forecast-archive\/?$/.test(url.pathname))return archiveResponse(request);
  const provider=await providerResponse(request,{upstream:req=>handle(req,{},null,'')});if(provider)return provider;
  if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/model/')&&!url.pathname.startsWith('/api/insights/')&&!url.pathname.endsWith('/'))url.pathname+='/';
  const response=await handle(new Request(url,request),{},null,'');
  if(response.ok){const personalEntry=/^\/api\/entry\/[1-9]\d{0,9}(?:\/|$)/.test(url.pathname);if(!url.pathname.startsWith('/api/')||personalEntry){response.headers.set('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');response.headers.set('Vercel-CDN-Cache-Control','no-store');response.headers.set('Pragma','no-cache');}else{response.headers.set('Cache-Control','public, max-age=30');response.headers.set('Vercel-CDN-Cache-Control','public, s-maxage=180');}}
  return response;
 }
};
