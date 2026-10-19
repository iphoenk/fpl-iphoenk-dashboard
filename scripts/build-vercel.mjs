import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const app=readFileSync('ui.js','utf8').replace('/*__EXTENSIONS__*/',['advanced.js','advanced-news.js','advanced-planning.js','advanced-league.js','advanced-player.js','dashboard-layout.js','refined-layout.js','approved-layout.js','scout-labs.js','ux-improvements.js','theme.js','dashboard-focus.js','phase-one-ui.js','phase-two-ui.js'].map(f=>readFileSync(f,'utf8')).join('\n')).replace('/*__APPROVED_LOGO__*/','data:image/png;base64,'+readFileSync('assets/fpl-iphoenk-logo.png').toString('base64'));
const html=readFileSync('ui.html','utf8').replace('/*__DOMAIN__*/',(readFileSync('domain.mjs','utf8')+'\n'+readFileSync('dashboard-signals.mjs','utf8')+'\n'+readFileSync('phase-one.mjs','utf8')+'\n'+readFileSync('phase-two.mjs','utf8')).replace(/export /g,'')).replace('/*__APP__*/',app).replace('/*__LIGHT_THEME__*/',readFileSync('light.css','utf8')+'\n'+readFileSync('dashboard.css','utf8')+'\n'+readFileSync('refined.css','utf8')+'\n'+readFileSync('approved-layout.css','utf8')+'\n'+readFileSync('theme.css','utf8')+'\n'+readFileSync('dashboard-focus.css','utf8')+'\n'+readFileSync('phase-one.css','utf8')+'\n'+readFileSync('phase-two.css','utf8'));
mkdirSync('public',{recursive:true});
writeFileSync('public/index.html',html);
console.log('Built static dashboard for Vercel.');



