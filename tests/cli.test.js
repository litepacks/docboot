import test from 'node:test';
import assert from 'node:assert';
import { parseArgs } from '../src/cli/args.js';

test('parseArgs default values', () => {
  const flags = parseArgs([]);
  assert.strictEqual(flags.command, 'dev');
  assert.strictEqual(flags.build, false);
  assert.strictEqual(flags.serve, false);
  assert.strictEqual(flags.open, false);
  assert.strictEqual(flags.dryRun, false);
  assert.strictEqual(flags.force, false);
  assert.strictEqual(flags.github, false);
});

test('parseArgs commands', () => {
  assert.strictEqual(parseArgs(['build', './docs']).command, 'build');
  assert.strictEqual(parseArgs(['serve', './dist']).command, 'serve');
  assert.strictEqual(parseArgs(['dev', './docs']).command, 'dev');
  assert.strictEqual(parseArgs(['clean']).command, 'clean');
  assert.strictEqual(parseArgs(['stats', './docs']).command, 'stats');
  assert.strictEqual(parseArgs(['doctor', './docs']).command, 'doctor');
  assert.strictEqual(parseArgs(['--help']).command, 'help');
  assert.strictEqual(parseArgs(['-h']).command, 'help');
  assert.strictEqual(parseArgs(['--version']).command, 'version');
});

test('parseArgs init and setup commands', () => {
  const init1 = parseArgs(['init']);
  assert.strictEqual(init1.command, 'init');
  assert.strictEqual(init1.subcommand, null);

  const init2 = parseArgs(['init', 'config']);
  assert.strictEqual(init2.command, 'init');
  assert.strictEqual(init2.subcommand, 'config');

  const setup1 = parseArgs(['setup', 'github']);
  assert.strictEqual(setup1.command, 'setup');
  assert.strictEqual(setup1.subcommand, 'github');

  const setup2 = parseArgs(['setup', 'github', '--dry-run']);
  assert.strictEqual(setup2.command, 'setup');
  assert.strictEqual(setup2.subcommand, 'github');
  assert.strictEqual(setup2.dryRun, true);
});

test('parseArgs flags including --github, --force, --dry-run, --pwa', () => {
  const doc = parseArgs(['doctor', '--github']);
  assert.strictEqual(doc.command, 'doctor');
  assert.strictEqual(doc.github, true);

  const forceFlags = parseArgs(['setup', 'github', '--force']);
  assert.strictEqual(forceFlags.force, true);

  const shortForce = parseArgs(['build', '-f']);
  assert.strictEqual(shortForce.force, true);

  const pwaFlags = parseArgs(['build', '--pwa']);
  assert.strictEqual(pwaFlags.pwa, true);

  const noCacheFlags = parseArgs(['build', '--no-cache']);
  assert.strictEqual(noCacheFlags.noCache, true);
});

test('parseArgs short flags and combined flags', () => {
  const flags1 = parseArgs(['.', '-bo']);
  assert.strictEqual(flags1.build, true);
  assert.strictEqual(flags1.open, true);
  assert.strictEqual(flags1.command, 'build');

  const flags2 = parseArgs(['./docs', '-s', '-p', '4000']);
  assert.strictEqual(flags2.serve, true);
  assert.strictEqual(flags2.port, 4000);
  assert.strictEqual(flags2.command, 'serve');

  const flags3 = parseArgs(['-bc']);
  assert.strictEqual(flags3.build, true);
  assert.strictEqual(flags3.clean, true);

  const flags4 = parseArgs(['-bcf']);
  assert.strictEqual(flags4.build, true);
  assert.strictEqual(flags4.clean, true);
  assert.strictEqual(flags4.force, true);
});
