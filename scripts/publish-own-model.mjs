import {readFile} from 'node:fs/promises';
import {defaultPublisher} from '../own-model-server.mjs';
const path=process.argv[2];
if(!path){console.error('Usage: node --env-file=.env.local scripts/publish-own-model.mjs .model-data/prediction.json');process.exitCode=1;}else{
 try{const text=await readFile(path,'utf8');if(Buffer.byteLength(text)>5000000)throw Error('Artifact too large');console.log(JSON.stringify(await defaultPublisher(JSON.parse(text))));}
 catch(error){console.error('Own-model publication failed: '+error.message);process.exitCode=1;}
}
