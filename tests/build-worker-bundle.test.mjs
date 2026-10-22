import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Regression guard: scripts/build.mjs inlines multiuser-decision.mjs,
// multiuser-horizon.mjs and multiuser-decision-server.mjs into a single
// flat file (worker/index.js, used by `npm run dev`'s local preview) by
// stripping each file's self-referential import line. Nothing in `npm
// test`/`npm run build:vercel`/`npm run check:browser` ever actually
// executes that generated file as a module, so a stripping regex that
// silently fails to match (e.g. because it's anchored to the start of
// the file with `^`, but the source file starts with a comment block)
// produces a SyntaxError that only surfaces when a contributor runs
// `npm run dev` - as happened in practice (duplicate `publicDecision`
// declaration from an unstripped import, later `multiGwDecision` the
// same way, plus a separately-escaped regex literal that lost its
// backslashes when written through a JS string literal).
const root=fileURLToPath(new URL('..',import.meta.url));

test('npm run build produces a syntactically valid worker/index.js with no leftover self-import lines',()=>{
 execFileSync('node',['scripts/build.mjs'],{cwd:root,stdio:'pipe'});
 const workerPath=path.join(root,'worker','index.js');
 // node --check exits non-zero and throws on any SyntaxError - this is
 // the exact check `npm run dev` effectively depends on at import time.
 execFileSync('node',['--check',workerPath],{stdio:'pipe'});
 const bundle=readFileSync(workerPath,'utf8');
 assert.doesNotMatch(bundle,/^import /m,'generated worker/index.js must not contain any leftover ES import statement - every dependency is inlined');
 // The decision-engine functions must be defined exactly once each,
 // never duplicated by a partially-failed strip.
 for(const name of ['publicDecision','selectPublicXI','multiGwDecision','validateGlobalModel']){
  const count=(bundle.match(new RegExp('function '+name+'\\(','g'))||[]).length;
  assert.equal(count,1,name+' must be defined exactly once in the inlined bundle, found '+count);
 }
});

test('the generated /api/decision route regex keeps its escaped slashes (string-literal escaping regression)',()=>{
 const workerPath=path.join(root,'worker','index.js');
 const bundle=readFileSync(workerPath,'utf8');
 assert.match(bundle,/\/\^\\\/api\\\/decision\\\/\?\$\//,'the route-matching regex literal must be /^\\/api\\/decision\\/?$/, not an unescaped literal that breaks at the first slash');
});
