import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { splitSlides, extractSpeakerNotes, extractSplitColumns, compilePresentation } from '../src/presentation/compiler.js';
import { renderPresentation } from '../src/presentation/renderer.js';
import { buildPresentationStatic } from '../src/presentation/builder.js';
import { parseArgs } from '../src/cli/args.js';
import { parseMarkdown } from '../src/markdown/parser.js';

test('Presentation: splitSlides via horizontal rules (---)', () => {
  const md = `
# Slide 1 Title
Intro text

---

## Slide 2 Title
- Bullet 1
- Bullet 2

---

## Slide 3 Code
\`\`\`javascript
const a = 1;
\`\`\`
`.trim();

  const slides = splitSlides(md);
  assert.strictEqual(slides.length, 3);
  assert.ok(slides[0].rawContent.includes('Slide 1 Title'));
  assert.ok(slides[1].rawContent.includes('Slide 2 Title'));
  assert.ok(slides[2].rawContent.includes('Slide 3 Code'));
});

test('Presentation: splitSlides handles vertical sub-slides via (--) and :::vslide', () => {
  const md = `
# Topic 1 Main
Horizontal slide 1

--

## Topic 1 Sub-slide A
Vertical sub-slide 1.2

--

## Topic 1 Sub-slide B
Vertical sub-slide 1.3

---

# Topic 2 Main
Horizontal slide 2

:::vslide
## Topic 2 Sub-slide A
Vertical sub-slide 2.2
:::
`.trim();

  const slides = splitSlides(md);
  assert.strictEqual(slides.length, 5);

  // Topic 1
  assert.strictEqual(slides[0].hIndex, 1);
  assert.strictEqual(slides[0].vIndex, 1);
  assert.strictEqual(slides[0].vCount, 3);
  assert.strictEqual(slides[0].rawContent.includes('Topic 1 Main'), true);

  assert.strictEqual(slides[1].hIndex, 1);
  assert.strictEqual(slides[1].vIndex, 2);
  assert.strictEqual(slides[1].vCount, 3);
  assert.strictEqual(slides[1].rawContent.includes('Topic 1 Sub-slide A'), true);

  assert.strictEqual(slides[2].hIndex, 1);
  assert.strictEqual(slides[2].vIndex, 3);
  assert.strictEqual(slides[2].vCount, 3);

  // Topic 2
  assert.strictEqual(slides[3].hIndex, 2);
  assert.strictEqual(slides[3].vIndex, 1);
  assert.strictEqual(slides[3].vCount, 2);
  assert.strictEqual(slides[3].rawContent.includes('Topic 2 Main'), true);

  assert.strictEqual(slides[4].hIndex, 2);
  assert.strictEqual(slides[4].vIndex, 2);
  assert.strictEqual(slides[4].vCount, 2);
  assert.strictEqual(slides[4].rawContent.includes('Topic 2 Sub-slide A'), true);
});

test('Presentation: splitSlides ignores horizontal rules inside code blocks', () => {
  const md = `
# Slide 1

\`\`\`markdown
---
not a slide break
---
\`\`\`

---

# Slide 2
Done
`.trim();

  const slides = splitSlides(md);
  assert.strictEqual(slides.length, 2);
  assert.ok(slides[0].rawContent.includes('not a slide break'));
  assert.ok(slides[1].rawContent.includes('Slide 2'));
});

test('Presentation: splitSlides via explicit :::slide directives', () => {
  const md = `
:::slide layout="center" background="./bg.jpg"
# Cover Slide
Welcome to Docboot Presentation
:::

:::slide layout="split"
::left
Left Content
::right
Right Content
:::
`.trim();

  const slides = splitSlides(md);
  assert.strictEqual(slides.length, 2);
  assert.strictEqual(slides[0].args.layout, 'center');
  assert.strictEqual(slides[0].args.background, './bg.jpg');
  assert.ok(slides[0].rawContent.includes('Cover Slide'));
  assert.strictEqual(slides[1].args.layout, 'split');
});

test('Presentation: splitSlides automatic heading splitting fallback', () => {
  const md = `
# First Title
Some intro description.

## Second Section
Details on second section.

## Third Section
Details on third section.
`.trim();

  const slides = splitSlides(md);
  assert.strictEqual(slides.length, 3);
  assert.ok(slides[0].rawContent.includes('First Title'));
  assert.ok(slides[1].rawContent.includes('Second Section'));
  assert.ok(slides[2].rawContent.includes('Third Section'));
});

test('Presentation: extractSpeakerNotes extracts :::notes and removes them from slide', () => {
  const md = `
# Architecture

Here is the visible content.

:::notes
Mention that build happens statically.
Do not forget the benchmark chart.
:::
`.trim();

  const { cleanContent, notes } = extractSpeakerNotes(md);
  assert.ok(!cleanContent.includes(':::notes'));
  assert.ok(!cleanContent.includes('Mention that build happens statically'));
  assert.ok(cleanContent.includes('Here is the visible content.'));
  assert.ok(notes.includes('Mention that build happens statically'));
  assert.ok(notes.includes('Do not forget the benchmark chart'));
});

test('Presentation: extractSplitColumns separates ::left and ::right content', () => {
  const md = `
## Why Docboot?

::left
- Zero config
- Instant start

::right
- Local search
- Presentation mode
`.trim();

  const { isSplit, left, right } = extractSplitColumns(md);
  assert.strictEqual(isSplit, true);
  assert.ok(left.includes('Zero config'));
  assert.ok(right.includes('Presentation mode'));
});

test('Presentation: compilePresentation creates normalized deck structure', () => {
  const md = `---
title: "Docboot Talk"
theme: "dark"
ratio: "16:9"
---

:::slide layout="center"
# Docboot
Next-gen documentation
:::

---

## Code Example

\`\`\`javascript
const docboot = true;
\`\`\`

:::notes
Explain ESM module format.
:::
`.trim();

  const deck = compilePresentation(md);
  assert.strictEqual(deck.title, 'Docboot Talk');
  assert.strictEqual(deck.theme, 'dark');
  assert.strictEqual(deck.ratio, '16:9');
  assert.strictEqual(deck.slideCount, 2);
  assert.strictEqual(deck.slides[0].layout, 'center');
  assert.ok(deck.slides[0].html.includes('<h1'));
  assert.strictEqual(deck.slides[1].notes, 'Explain ESM module format.');
  assert.ok(deck.slides[1].html.includes('docboot-codeblock'));
});

test('Presentation: renderPresentation generates full HTML with controls, presenter view and runtime', () => {
  const md = `
# Welcome
Docboot Presentation Mode
`.trim();

  const deck = compilePresentation(md);
  const html = renderPresentation(deck);

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('docboot-presentation-viewport'));
  assert.ok(html.includes('docboot-slide-stage'));
  assert.ok(html.includes('docboot-slide'));
  assert.ok(html.includes('docboot-presentation-controls'));
  assert.ok(html.includes('docboot-presenter-view'));
  assert.ok(html.includes('docboot-presenter-timer'));
  assert.ok(html.includes('docboot-btn-fullscreen'));
  assert.ok(html.includes('docboot-btn-presenter'));
});

test('Presentation: parseArgs handles present and present build commands', () => {
  const devArgs = parseArgs(['present', 'talk.md', '-o', '-p', '4000', '--presenter']);
  assert.strictEqual(devArgs.command, 'present');
  assert.strictEqual(devArgs.subcommand, 'dev');
  assert.strictEqual(devArgs.file, 'talk.md');
  assert.strictEqual(devArgs.open, true);
  assert.strictEqual(devArgs.port, 4000);
  assert.strictEqual(devArgs.presenter, true);

  const buildArgs = parseArgs(['present', 'build', 'slides.md']);
  assert.strictEqual(buildArgs.command, 'present');
  assert.strictEqual(buildArgs.subcommand, 'build');
  assert.strictEqual(buildArgs.file, 'slides.md');
});

test('Presentation: buildPresentationStatic builds static index.html bundle', async () => {
  const tmpFile = path.resolve(process.cwd(), 'tests/fixtures/sample-talk.md');
  const tmpOut = path.resolve(process.cwd(), 'tests/fixtures/dist-presentation-test');

  fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
  fs.writeFileSync(tmpFile, `---
title: "Static Build Talk"
---
:::slide layout="center"
# Hello Presentation
:::
---
## Slide 2
Content here.
`, 'utf-8');

  const result = await buildPresentationStatic(tmpFile, { out: tmpOut });
  assert.strictEqual(result.slideCount, 2);
  assert.strictEqual(result.title, 'Static Build Talk');
  assert.ok(fs.existsSync(path.join(tmpOut, 'index.html')));

  const builtHtml = fs.readFileSync(path.join(tmpOut, 'index.html'), 'utf-8');
  assert.ok(builtHtml.includes('Hello Presentation'));
  assert.ok(builtHtml.includes('Slide 2'));

  // Clean up fixture test directory
  try {
    fs.rmSync(tmpOut, { recursive: true, force: true });
    fs.rmSync(tmpFile, { force: true });
  } catch {}
});

test('Presentation: Docs compatibility — :::slide and :::notes render safely in documentation mode', () => {
  const docsMarkdown = `
# Regular Docs Page

:::slide layout="center"
## Section Inside Slide Directive
This content must remain visible in documentation.
:::

:::notes
This note must be omitted from docs output.
:::

Footer text.
`.trim();

  const parsed = parseMarkdown(docsMarkdown);
  assert.ok(parsed.html.includes('Section Inside Slide Directive'));
  assert.ok(parsed.html.includes('This content must remain visible in documentation'));
  assert.ok(!parsed.html.includes('This note must be omitted from docs output'));
});
