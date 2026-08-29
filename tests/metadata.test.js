import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { GitMetadataResolver, formatDate } from '../src/metadata/git.js';
import { renderPageMetaFooter, renderGlobalFooter } from '../src/renderer/footer.js';

test('formatDate formats ISO dates to clean human readable dates', () => {
  assert.strictEqual(formatDate('2026-08-12T14:32:18Z'), '12 Aug 2026');
  assert.strictEqual(formatDate('2026-01-05T00:00:00Z'), '5 Jan 2026');
  assert.strictEqual(formatDate('invalid-date'), null);
  assert.strictEqual(formatDate(null), null);
});

test('GitMetadataResolver detects git repository and handles file provenance', () => {
  const resolver = new GitMetadataResolver(process.cwd());
  assert.strictEqual(typeof resolver.isGit, 'boolean');
  
  if (resolver.isGit) {
    const meta = resolver.resolveFile(path.resolve(process.cwd(), 'package.json'), 'package.json');
    assert.ok(meta);
    assert.strictEqual(typeof meta.updatedAt, 'string');
    assert.strictEqual(typeof meta.commit, 'string');
  }
});

test('GitMetadataResolver handles non-git gracefully', () => {
  const resolver = new GitMetadataResolver('/tmp/non-existent-dir-for-docboot-test');
  assert.strictEqual(resolver.isGit, false);
  const meta = resolver.resolveFile('/tmp/file.md', 'file.md');
  assert.deepStrictEqual(meta, {
    createdAt: null,
    updatedAt: null,
    commit: null,
    fullCommit: null
  });
});

test('renderPageMetaFooter renders created, updated and edit link with semantic time elements', () => {
  const page = {
    relativePath: 'docs/guide/state.md',
    editUrl: 'https://github.com/litepacks/docboot/edit/main/docs/guide/state.md',
    frontmatter: {},
    git: {
      createdAt: '2026-08-12T14:00:00Z',
      updatedAt: '2026-08-29T10:00:00Z',
      commit: 'a81fd3c'
    }
  };

  const config = {
    footer: {
      pageMeta: true,
      created: true,
      updated: true,
      editLink: true
    }
  };

  const html = renderPageMetaFooter({ page, config });
  assert.ok(html.includes('Created <time datetime="2026-08-12T14:00:00.000Z">12 Aug 2026</time>'));
  assert.ok(html.includes('Updated <time datetime="2026-08-29T10:00:00.000Z">29 Aug 2026</time>'));
  assert.ok(html.includes('https://github.com/litepacks/docboot/edit/main/docs/guide/state.md'));
  assert.ok(html.includes('Edit this page'));
});

test('renderPageMetaFooter respects frontmatter overrides', () => {
  const page = {
    relativePath: 'docs/guide/state.md',
    frontmatter: {
      created: '2026-01-01T00:00:00Z',
      updated: '2026-02-01T00:00:00Z'
    },
    git: {
      createdAt: '2026-08-12T14:00:00Z',
      updatedAt: '2026-08-29T10:00:00Z'
    }
  };

  const config = { footer: {} };
  const html = renderPageMetaFooter({ page, config });
  assert.ok(html.includes('Created <time datetime="2026-01-01T00:00:00.000Z">1 Jan 2026</time>'));
  assert.ok(html.includes('Updated <time datetime="2026-02-01T00:00:00.000Z">1 Feb 2026</time>'));
});

test('renderPageMetaFooter hides created if same as updated date', () => {
  const page = {
    relativePath: 'docs/guide/intro.md',
    frontmatter: {},
    git: {
      createdAt: '2026-08-29T10:00:00Z',
      updatedAt: '2026-08-29T10:00:00Z'
    }
  };

  const config = { footer: {} };
  const html = renderPageMetaFooter({ page, config });
  assert.ok(!html.includes('Created'));
  assert.ok(html.includes('Updated <time datetime="2026-08-29T10:00:00.000Z">29 Aug 2026</time>'));
});

test('renderGlobalFooter renders version, license, links, and branding', () => {
  const config = {
    repo: 'https://github.com/litepacks/docboot',
    footer: {
      version: true,
      commit: true,
      branding: true,
      links: [
        { label: 'GitHub', href: 'https://github.com/litepacks/docboot' },
        { label: 'npm', href: 'https://www.npmjs.com/package/docboot' }
      ]
    }
  };

  const html = renderGlobalFooter({
    config,
    license: 'MIT',
    commit: 'a81fd3c',
    buildDuration: 184
  });

  assert.ok(html.includes('Docboot v'));
  assert.ok(html.includes('MIT'));
  assert.ok(html.includes('a81fd3c'));
  assert.ok(html.includes('Built with'));
  assert.ok(html.includes('https://www.npmjs.com/package/docboot'));
});
