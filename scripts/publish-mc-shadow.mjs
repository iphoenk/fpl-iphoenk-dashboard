import {open} from 'node:fs/promises';
import {publishMcShadowRecord} from '../mc-shadow-server.mjs';
const path=process.argv[2];
try{
 if(!path||process.argv.length!==3)throw Error('Usage');
 const file=await open(path,'r');let text;
 try{if((await file.stat()).size>2000000)throw Error('Too large');text=await file.readFile('utf8');}
 finally{await file.close();}
 if(Buffer.byteLength(text)>2000000)throw Error('Too large');
 console.log(JSON.stringify(await publishMcShadowRecord(JSON.parse(text))));
}catch{console.error('MC shadow publication failed. No production recommendation was changed.');process.exitCode=1;}
