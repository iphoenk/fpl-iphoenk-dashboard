import http from 'node:http';
import worker from '../worker/index.js';
const port=Number(process.env.FPL_PREVIEW_PORT||4173);
http.createServer(async(req,res)=>{try{const r=await worker.fetch(new Request('http://localhost:'+port+req.url,{method:req.method}),{}, {waitUntil:p=>p.catch(()=>{})});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.writeHead(500);res.end(e.message);}}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
