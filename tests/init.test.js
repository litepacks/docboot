import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { initProject, generateStarterConfig, STARTER_CONFIG_FILENAME } from '../src/cli/init.js';

test('generateStarterConfig generates valid config content with git remote inference', () => {
  const content = generateStarterConfig({
    title: 'Acme Docs',
    description: 'Acme documentation',
    repoUrl: 'https://github.com/acme/project.git',
    docsDir: './docs',
    outDir: './dist',
    preset: 'ocean'
  });

  assert.match(content, /title:\s*"Acme Docs"/);
  assert.match(content, /preset:\s*"ocean"/);
  assert.match(content, /https:\/\/github\.com\/acme\/project\/edit\/main\/docs\/:path/);
});

test('initProject scaffolds docboot.config.js and starter docs files', async () => {
  const tmpDir = path.join(process.cwd(), 'scratch', 'test-init-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const mockLogger = { log: () => {} };

  // 1. Initial init
  const result = await initProject({
    rootDir: tmpDir,
    configOnly: false,
    force: false,
    logger: mockLogger
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(fs.existsSync(path.join(tmpDir, STARTER_CONFIG_FILENAME)), true);
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'docs', 'README.md')), true);
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'docs', '01-getting-started.md')), true);

  // 2. Re-init without force protects existing config
  fs.writeFileSync(path.join(tmpDir, STARTER_CONFIG_FILENAME), '// Custom config');
  const resultProtected = await initProject({
    rootDir: tmpDir,
    configOnly: true,
    force: false,
    logger: mockLogger
  });
  assert.strictEqual(resultProtected.createdFiles.includes(STARTER_CONFIG_FILENAME), false);
  assert.strictEqual(fs.readFileSync(path.join(tmpDir, STARTER_CONFIG_FILENAME), 'utf-8'), '// Custom config');

  // 3. Re-init with force overwrites
  const resultForce = await initProject({
    rootDir: tmpDir,
    configOnly: true,
    force: true,
    logger: mockLogger
  });
  assert.strictEqual(resultForce.createdFiles.includes(STARTER_CONFIG_FILENAME), true);
  assert.match(fs.readFileSync(path.join(tmpDir, STARTER_CONFIG_FILENAME), 'utf-8'), /export default/);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
