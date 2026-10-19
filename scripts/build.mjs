import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
const app=readFileSync('ui.js','utf8').replace('/*__EXTENSIONS__*/',['advanced.js','advanced-news.js','advanced-planning.js','advanced-league.js','advanced-player.js','dashboard-layout.js','refined-layout.js','approved-layout.js','scout-labs.js','ux-improvements.js','theme.js','dashboard-focus.js'].map(f=>readFileSync(f,'utf8')).join('\n')).replace('/*__APPROVED_LOGO__*/','data:image/png;base64,'+readFileSync('assets/fpl-iphoenk-logo.png').toString('base64'));
const html=readFileSync('ui.html','utf8').replace('/*__DOMAIN__*/',(readFileSync('domain.mjs','utf8')+'\n'+readFileSync('dashboard-signals.mjs','utf8')).replace(/export /g,'')).replace('/*__APP__*/',app).replace('/*__LIGHT_THEME__*/',readFileSync('light.css','utf8')+'\n'+readFileSync('dashboard.css','utf8')+'\n'+readFileSync('refined.css','utf8')+'\n'+readFileSync('approved-layout.css','utf8')+'\n'+readFileSync('theme.css','utf8')+'\n'+readFileSync('dashboard-focus.css','utf8'));
const server=readFileSync('server.mjs','utf8').replace(/export /g,'');
mkdirSync('worker',{recursive:true});writeFileSync('worker/index.js',server+'\nconst HTML='+JSON.stringify(html)+';\nexport default {fetch(request,env,ctx){return handle(request,env,ctx,HTML)}};\n');
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});cpSync('worker/index.js','dist/server/index.js');cpSync('.openai/hosting.json','dist/.openai/hosting.json');console.log('Built FPL - iphoenk Worker.');



