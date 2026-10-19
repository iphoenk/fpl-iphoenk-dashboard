import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('public/index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const path='public/.syntax-check.mjs';
try{writeFileSync(path,scripts.join('\n'));const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stderr);process.exitCode=1;}else console.log('Browser scripts parsed successfully.');}finally{try{unlinkSync(path);}catch{}}
