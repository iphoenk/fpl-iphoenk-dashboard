import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../decision-first.css',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build-vercel.mjs',import.meta.url),'utf8');
const latest=css.slice(css.lastIndexOf('/* Mobile readability recovery (2026-10-21).'));
test('mobile recovery is the final cascade block, scoped to under 768px',()=>{
 assert.ok(latest.startsWith('/* Mobile readability recovery'));
 assert.match(latest,/@media \(max-width:767px\)/);
 assert.match(latest,/body\.has-team\[data-view=dashboard\]/);
 assert.match(build,/readFileSync\('decision-first\.css','utf8'\)/);
});
test('KPI selector beats original four-column dashboard grid on iPhone',()=>{
 assert.match(css,/body\.has-team\[data-view=dashboard\] #dashboardLayout \.team-hero \.hero-stats/);
 assert.match(latest,/#dashboardLayout > \.team-hero #dashboardHeroStats\.hero-stats\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/s);
 assert.match(latest,/#dashboardHeroStats \.hero-stat strong\s*\{[^}]*white-space:normal!important/s);
 assert.match(latest,/#dashboardHeroStats \.hero-stat strong\s*\{[^}]*word-break:normal!important/s);
 assert.doesNotMatch(latest,/word-break:break-all/);
});
test('mobile market value and bank are two concise equal columns with readable amounts',()=>{
 assert.match(latest,/\.hero-team-value\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/s);
 assert.match(latest,/\.hero-team-value strong\s*\{[^}]*font-size:18px!important/s);
 assert.match(latest,/\.hero-team-value small\s*\{\s*display:none!important/s);
});
test('hero is neutral rather than saturated purple, with an accessible team name',()=>{
 assert.match(latest,/#dashboardLayout > \.team-hero\s*\{[^}]*background:var\(--panel\)!important/s);
 assert.match(latest,/#dashboardTeamName\s*\{[^}]*font-size:22px!important/s);
 assert.match(latest,/\.hero-playing\s*\{\s*display:none!important/s);
});
test('official logo remains sourced unchanged and mobile header fits narrow screens',()=>{
 assert.match(build,/readFileSync\('assets\/fpl-iphoenk-logo\.png'\)/);
 assert.match(latest,/\.approved-brand img\s*\{[^}]*width:clamp\(136px,39vw,169px\)!important/s);
 assert.match(latest,/\.approved-header-inner\s*\{[^}]*min-height:66px!important/s);
});
test('decision pitch, league and plan remain reachable on mobile',()=>{
 assert.match(latest,/\.decision-primary\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)!important/s);
 assert.match(latest,/\.decision-pitch \.pitch\s*\{[^}]*min-height:300px!important/s);
 const app=readFileSync(new URL('../decision-first.js',import.meta.url),'utf8');
 assert.match(app,/pitchCard\(\)\+leagueCard\(\)/);
 assert.match(app,/planCard\(\)/);
 assert.match(app,/decisionLeagueSelect/);
});
