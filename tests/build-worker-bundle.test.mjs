import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Regression guard: scripts/build.mjs inlines multiuser-decision.mjs,
// multiuser-horizon.mjs, multiuser-decision-server.mjs, model-fallback.mjs,
// independent-providers.mjs, phase-one.mjs, phase-one-server.mjs,
// own-model.mjs and own-model-server.mjs into a single flat file
// (worker/index.js, used by `npm run dev`'s local preview) by stripping
// each file's self-referential (relative) import line. Nothing in `npm
// test`/`npm run build:vercel`/`npm run check:browser` ever actually
// executes that generated file as a module, so a stripping regex that
// silently fails to match (e.g. because it's anchored to the start of
// the file with `^`, but the source file starts with a comment block)
// produces a SyntaxError that only surfaces when a contributor runs
// `npm run dev` - as happened in practice (duplicate `publicDecision`
// declaration from an unstripped import, later `multiGwDecision` the
// same way, plus a separately-escaped regex literal that lost its
// backslashes when written through a JS string literal, plus - when the
// dispatcher's route coverage was later widened to match api/index.js -
// three top-level identifier collisions between files that had never
// been inlined together before: `number` (independent-providers.mjs vs
// multiuser-decision-server.mjs), `ROOT` (phase-one-server.mjs vs
// multiuser-decision-server.mjs) and `json` (phase-one-server.mjs vs
// own-model-server.mjs)).
//
// A single legitimate top-level `import {createHash} from 'node:crypto';`
// is intentionally present (a Node builtin, not a local file to inline),
// so this guard only flags *relative* leftover imports, not builtin ones.
const root=fileURLToPath(new URL('..',import.meta.url));

test('npm run build produces a syntactically valid worker/index.js with no leftover self-import lines',()=>{
 execFileSync('node',['scripts/build.mjs'],{cwd:root,stdio:'pipe'});
 const workerPath=path.join(root,'worker','index.js');
 // node --check exits non-zero and throws on any SyntaxError - this is
 // the exact check `npm run dev` effectively depends on at import time.
 execFileSync('node',['--check',workerPath],{stdio:'pipe'});
 const bundle=readFileSync(workerPath,'utf8');
 assert.doesNotMatch(bundle,/^import .*from ['"]\.\.?\//m,'generated worker/index.js must not contain any leftover relative ES import - every local dependency is inlined (a bare node: builtin import is fine)');
 // Every inlined module's top-level functions must be defined exactly
 // once each, never duplicated by a partially-failed strip or masked by
 // a same-named identifier from a different inlined file.
 for(const name of ['publicDecision','selectPublicXI','multiGwDecision','validateGlobalModel','publicDecisionResponse','providerResponse','providerStore','archiveResponse','blobArchive','ownModelResponse','officialBundle']){
  const count=(bundle.match(new RegExp('function '+name+'\\(','g'))||[]).length;
  assert.equal(count,1,name+' must be defined exactly once in the inlined bundle, found '+count);
 }
});

test('the generated local-dev route dispatcher wires up every API handler api/index.js (Vercel) also wires up',()=>{
 const workerPath=path.join(root,'worker','index.js');
 const bundle=readFileSync(workerPath,'utf8');
 // Regression: the dispatcher used to special-case only /api/decision,
 // leaving ownModelResponse/archiveResponse/providerResponse (and hence
 // /api/own-model, /api/forecast-archive, /api/model/*, /api/insights/*)
 // unreachable in the local-dev bundle even though production (api/index.js,
 // which does real ES module imports and was never affected) served them.
 assert.match(bundle,/publicDecisionResponse\(request\)/,'dispatcher must call publicDecisionResponse');
 assert.match(bundle,/ownModelResponse\(request\)/,'dispatcher must call ownModelResponse');
 assert.match(bundle,/providerResponse\(request,/,'dispatcher must call providerResponse');
 assert.match(bundle,/archiveResponse\(request\)/,'dispatcher must call archiveResponse');
 // The forecast-archive route match is still a hand-written regex literal
 // built through a JS string literal in build.mjs, so it's still exposed
 // to the backslash-collapsing regression that previously broke /api/decision.
 assert.match(bundle,/\/\^\\\/api\\\/forecast-archive\\\/\?\$\//,'the forecast-archive route regex literal must be /^\\/api\\/forecast-archive\\/?$/, not an unescaped literal that breaks at the first slash');
});
