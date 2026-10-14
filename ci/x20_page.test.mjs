import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// web/src/app.ts on MDX X.20 B: the file goes through the same steps as the other bases (no separate
// one-click panel), with its own plan behind the meters, the layout editor and the build.
// This retained path is currently blocked by the shipped recipe. The engine side is tested in engine/test/x20_flow.test.ts.
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/src/app.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../web/src/layout-ui.ts', import.meta.url), 'utf8');
const slice = (from, to) => app.slice(app.indexOf(from), app.indexOf(to, app.indexOf(from) + 1));

test('X.20: no separate build panel; a recognised file continues into the normal steps through the UW gate', () => {
  assert.doesNotMatch(html, /x20-panel|x20-build|Build for X\.20/);
  assert.doesNotMatch(app, /onX20Build|x20Url/);
  const onFile = slice('async function onFile(', 'async function onPackFiles(');
  const branch = onFile.slice(onFile.indexOf('if (recipe) {'), onFile.indexOf('let parsed = readFirmware(bytes);'));
  assert.match(branch, /layoutEd\.setX20\(/);
  assert.match(branch, /try \{ samples\.setBank\(x20E12Bank\(R, bank0\)\); \}/);          // the Samples step works on X.20 too
  assert.match(branch, /refresh\(\);\n\s+if \(gate\(uwAnswer, true\)\.ok\) showStep\(3\);/);
  assert.match(branch, /MDX_DISCLAIMER/);
  // the steps and Next buttons accept an X.20 file as loaded, and still need the plan to fit
  assert.match(app, /const loaded = \(\): boolean => !!fw \|\| !!x20;/);
  assert.match(slice('function showStep(', 'function status('), /n > 1 && !loaded\(\)\) \|\| \(n > 3 && \(!planReady\(\)/);
});

test('X.20: the meters come from planX20 at the chosen trim and update with every refresh', () => {
  const refresh = slice('function refresh(', 'function refreshX20(');
  assert.match(refresh, /if \(x20 && x20R && x20Bank\) \{ refreshX20\(minAutoDb\); return; \}/);
  const r = slice('function refreshX20(', 'function syncTrim(');
  assert.match(r, /trimMode\(\) === 'auto' \? autoPlanX20\(excludes\(\), minAutoDb\) : planX20For\(excludes\(\)\)/);
  for (const m of ['m-dsp2', 'm-ids', 'm-list', 'm-records']) assert.match(r, new RegExp(`meter\\('${m}'`));
  assert.match(r, /Not computed: the recipe does not give X\.20's own record count/);
  assert.match(r, /layoutEd\.render\(p\)/);
  assert.match(r, /scheduleStorageCheck\(\)/);
  for (const m of ['m-ids', 'm-list', 'm-records']) assert.match(html, new RegExp(`<div class="meter" id="${m}" hidden>`));
  // auto trim: the gentlest threshold whose placement fits, as on the other bases
  assert.match(slice('function autoPlanX20(', '// Trimming can fix'), /findTrimThreshold\(db => planX20For\(exclude, \{ db, minSeconds: 0\.5, cap \}\)/);
  // firmware storage: the E12B flash the build uses
  assert.match(slice('function showStorage(', 'function showStorageProblem('), /meter\('m-packed', result\.report\.flash\.used, result\.report\.flash\.capacity/);
  assert.match(app, /e instanceof X20FlashError/);
});

test('X.20: the build takes the user\'s choices (UW answer, unticked machines, layout, trim) and shares the MDX notice with X.14', () => {
  const bw = slice('function buildWith(', 'function showStorage(');
  assert.match(bw, /buildX20\(input!, x20, data\.packs, data\.core!, \{ uw, exclude: excludes\(\), layout: layoutEd\.mapForPlan\(\),/);
  assert.match(bw, /trim: \{ db: trim\.db, minSeconds: trim\.minSeconds, cap: trim\.cap \}/);
  const dl = slice('function downloadX20(', 'function x20ReportView(');
  assert.doesNotMatch(dl, /Untested on hardware/);
  assert.match(app, /const modifiedMdx = !!x20 \|\| base\?\.id === 'x14'/);
  assert.match(app, /Kitbasher is not affiliated with MDX\./);
  assert.match(app, /not official MDX releases and are not supported by its creator/);
  assert.match(app, /\['qualification-note', 'mdx-disclaimer'\]/);
  assert.match(html, /id="mdx-disclaimer" class="note" hidden/);
  assert.match(dl, /needsUwAnswer\(\)/);
});

test('X.20: swapped samples reach the plan, the build and the Samples step\'s badges', () => {
  assert.match(slice('function x20Trimmed(', 'function planX20For('), /trimX20Bank\(x20R!, x20Bank!, \{ db: opt\.db, minSeconds: opt\.minSeconds, cap: opt\.cap \}, samples\.edits\(\)\)/);
  assert.match(slice('function buildWith(', 'function showStorage('), /samples: samples\.edits\(\) \}\)\.then\(\(r\): X20Built/);
  assert.match(app, /onChange: \(\) => \{ trims\.clear\(\); x20Trims\.clear\(\); refresh\(\); \}/);
  assert.match(app, /x20Plan && sameEdits\(x20Plan\.bank\.edits, samples\.edits\(\)\) \? \{ report: x20Plan\.bank\.report, end: x20Plan\.bank\.bankEnd \}/);
  assert.doesNotMatch(app, /sample swapping is not available on \$\{x20/);
});

test('X.20: retained firmware details explain unavailable features without build switches', () => {
  assert.doesNotMatch(html, /id="(?:build-options|unmute-fix|midi-chroma|pitch-labels|encoder-settings)"/);
  const off = slice('const X20_OFF =', ';\nconst X20_FIXED_WHY');
  for (const f of ['MIDI chromatic note input', 'pitch note names', 'INP IDs 80\\.\\.85'])
    assert.match(off, new RegExp(f));
  assert.doesNotMatch(off, /INTERNAL|E12/);                     // sample swapping is offered on X.20
  assert.doesNotMatch(off, /unmute/);                           // so is the unmute fix (the recipe's own, for X.20's mute keys)
  const onFile = slice('async function onFile(', 'async function onPackFiles(');
  assert.match(onFile, /'User machines \(USR\) keep working\. ' \+ X20_OFF/);
  assert.match(app, /features: \{ unmute: true \}/);
});

test('X.20: the layout editor shows its menu families as fixed categories, and a built X.20 file restores its layout', () => {
  assert.match(ui, /setX20\(f: FixedFamilies\): void/);
  assert.match(ui, /New category \(not available on \$\{fixed\.name\}\)/);
  assert.match(ui, /if \(this\.fixed\) return this\.fixedCard\(l, c, keys\);/);
  assert.match(slice('async function restoreFromOs(', 'function applyNoUw('), /findX20Layout\(bytes, data\.bases\.recipes\.map/);
  assert.match(app, /That's a Kitbasher build for \$\{was\.name\}: layout restored/);
  assert.match(app, /os: x20 \? osOfRecipe\(x20\) : osOf\(base!\)/);
});
