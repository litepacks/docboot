import fs from 'node:fs';
import path from 'node:path';
import openBrowser from 'open';
import pc from 'picocolors';
import { loadConfig } from '../config/index.js';
import { Logger } from './logger.js';
import { SiteBuilder } from '../compiler/builder.js';
import { DevServer } from '../server/dev-server.js';
import { StaticServer } from '../server/static-server.js';
import { FileWatcher } from '../watcher/index.js';
import { Doctor } from '../doctor/index.js';
import { StatsCollector } from '../stats/index.js';
import { AssetGenerator } from '../assets/generator.js';
import { CacheManager } from '../cache/index.js';

export async function runCommand(flags) {
  const logger = new Logger({
    quiet: flags.quiet,
    verbose: flags.verbose
  });

  if (flags.command === 'help') {
    showHelp();
    return;
  }

  if (flags.command === 'version') {
    console.log('docboot v0.1.0');
    return;
  }

  const rootDir = process.cwd();
  const config = await loadConfig(rootDir, {
    dir: flags.dir,
    port: flags.port,
    clean: flags.clean,
    noCache: flags.noCache
  });

  if (flags.command === 'init') {
    logger.banner('0.1.0');
    const { initProject } = await import('./init.js');
    await initProject({
      rootDir,
      targetDir: flags.dir,
      configOnly: flags.subcommand === 'config',
      force: flags.force,
      logger
    });
    return;
  }

  if (flags.command === 'clean') {
    logger.banner('0.1.0');
    const cache = new CacheManager(config.cacheDir);
    cache.clear();

    const docupDir = path.resolve(rootDir, '.docup');
    if (fs.existsSync(docupDir)) {
      try { fs.rmSync(docupDir, { recursive: true, force: true }); } catch (e) {}
    }

    logger.success(`Cleaned build cache directory: ${pc.cyan(path.relative(rootDir, config.cacheDir) || config.cacheDir)}`);
    return;
  }

  if (flags.command === 'setup') {
    logger.banner('0.1.0');
    const { setupGitHubPages } = await import('../setup/github/index.js');
    await setupGitHubPages({
      rootDir,
      config,
      dryRun: flags.dryRun,
      force: flags.force,
      logger
    });
    return;
  }

  if (flags.command === 'doctor') {
    logger.banner('0.1.0');
    const doctor = new Doctor(config, logger);
    const result = await doctor.diagnose({ github: flags.github, a11y: flags.a11y });

    console.log(pc.bold('  DOCUMENTATION HEALTH CHECK\n'));

    for (const pass of result.passes) {
      console.log(pc.green('  ✔ ') + pc.dim(pass));
    }

    if (result.warnings.length > 0) {
      console.log('');
      for (const w of result.warnings) {
        console.log(pc.yellow('  ⚠ ') + pc.yellow(`[${w.type}] `) + w.message);
      }
    }

    if (result.errors.length > 0) {
      console.log('');
      for (const e of result.errors) {
        console.log(pc.red('  ✖ ') + pc.red(pc.bold(`[${e.type}] `)) + e.message);
        if (e.action) {
          console.log(pc.dim(`    → Suggestion: ${e.action}`));
        }
      }
      console.log(pc.red(`\n  ✖ Health check completed with ${result.errors.length} error(s).\n`));
      process.exit(1);
    } else {
      console.log(pc.green(`\n  ✔ All health checks passed successfully with zero broken links!\n`));
    }
    return;
  }

  if (flags.command === 'stats') {
    logger.banner('0.1.0');
    const statsCollector = new StatsCollector(config, logger);
    const stats = await statsCollector.collect();

    console.log(pc.bold('  DOCUMENTATION METRICS\n'));
    console.log(`  ${pc.dim('Pages           ')} ${pc.bold(stats.pageCount)}`);
    console.log(`  ${pc.dim('Words           ')} ${pc.bold(stats.totalWords.toLocaleString())}`);
    console.log(`  ${pc.dim('Headings        ')} ${pc.bold(stats.totalHeadings)}`);
    console.log(`  ${pc.dim('Code blocks     ')} ${pc.bold(stats.totalCodeBlocks)}`);
    console.log(`  ${pc.dim('Internal links  ')} ${pc.bold(stats.totalInternalLinks)}`);
    console.log(`  ${pc.dim('Images          ')} ${pc.bold(stats.totalImages)}`);
    console.log('');
    console.log(`  ${pc.dim('Build time      ')} ${pc.green(stats.buildElapsedMs + 'ms')}`);
    console.log(`  ${pc.dim('CSS bundle      ')} ${pc.cyan(stats.cssSizeKb + ' KB')}`);
    console.log(`  ${pc.dim('JS runtime      ')} ${pc.cyan(stats.jsSizeKb + ' KB')}`);
    console.log(`  ${pc.dim('Search index    ')} ${pc.cyan(stats.searchIndexSizeKb + ' KB')}`);

    if (stats.cache) {
      console.log('');
      console.log(pc.bold('  BUILD CACHE METRICS\n'));
      console.log(`  ${pc.dim('Cached pages    ')} ${pc.bold(stats.cache.pages)}`);
      console.log(`  ${pc.dim('Cache hits      ')} ${pc.green(stats.cache.hits)}`);
      console.log(`  ${pc.dim('Cache misses    ')} ${pc.yellow(stats.cache.misses)}`);
      console.log(`  ${pc.dim('Hit rate        ')} ${pc.cyan(stats.cache.hitRate + '%')}`);
      console.log(`  ${pc.dim('Cache size      ')} ${pc.dim(stats.cache.sizeKb + ' KB')}`);
    }
    console.log('');
    return;
  }

  if (flags.command === 'generate') {
    logger.banner('0.1.0');
    const generator = new AssetGenerator(config, logger);
    const type = flags.subcommand || 'assets';
    const files = await generator.generate(type);
    logger.success(`Generated production assets:`);
    for (const f of files) {
      console.log(pc.dim('    + ') + pc.cyan(f));
    }
    console.log('');
    return;
  }

  if (flags.command === 'build') {
    logger.banner('0.1.0');
    const builder = new SiteBuilder(config, logger, { noCache: flags.noCache });
    const result = await builder.build({ isDev: false, clean: flags.clean });
    logger.buildDone(path.relative(rootDir, config.outDir) || config.outDir, result.pageCount, result.elapsedMs);

    if (flags.pwa || config.pwa) {
      const generator = new AssetGenerator(config, logger);
      await generator.generate('pwa');
      logger.info('Generated PWA manifest and assets.');
    }

    if (flags.open) {
      const server = new StaticServer(config.outDir);
      const { port, url } = await server.start(config.port, config.host);
      logger.info(`Previewing build at ${pc.cyan(url)}`);
      await openBrowser(url).catch(() => {});
    }
    return;
  }

  if (flags.command === 'serve') {
    logger.banner('0.1.0');
    const server = new StaticServer(config.outDir);
    const { port, url } = await server.start(config.port, config.host);
    logger.info(`Serving static site at ${pc.cyan(url)} (from ${path.relative(rootDir, config.outDir)})`);
    
    if (flags.open) {
      await openBrowser(url).catch(() => {});
    }
    return;
  }

  // Default: 'dev' command
  logger.banner('0.1.0');
  const builder = new SiteBuilder(config, logger, { noCache: flags.noCache });
  const result = await builder.build({ isDev: true, clean: flags.clean });

  const devServer = new DevServer(config);
  const { port, url } = await devServer.start(config.port, config.host);

  const watchDirRel = path.relative(rootDir, config.docsDir) || './';
  logger.ready(url, result.pageCount, watchDirRel, result.elapsedMs);

  const watcher = new FileWatcher({ config, builder, devServer, logger });
  watcher.start();

  if (flags.open) {
    await openBrowser(url).catch(() => {});
  }
}

export function showHelp() {
  console.log(`
  ${pc.cyan(pc.bold('Docboot'))} ${pc.dim('— Ultra-fast Markdown documentation CLI')}

  ${pc.bold('USAGE')}
    ${pc.green('$')} docboot [dir] [flags]
    ${pc.green('$')} docboot dev [dir] [flags]
    ${pc.green('$')} docboot build [dir] [flags]
    ${pc.green('$')} docboot serve [dir] [flags]
    ${pc.green('$')} docboot doctor [dir]
    ${pc.green('$')} docboot stats [dir]
    ${pc.green('$')} docboot clean [dir]
    ${pc.green('$')} docboot generate [assets|favicon|og|pwa]
    ${pc.green('$')} docboot setup [github]
    ${pc.green('$')} docboot init [config|dir]

  ${pc.bold('COMMANDS')}
    ${pc.cyan('dev')}        Start dev server with instant SSE reload (default)
    ${pc.cyan('build')}      Build static HTML, assets & search index to dist
    ${pc.cyan('serve')}      Preview static production build
    ${pc.cyan('doctor')}     Validate internal links, images, routes & frontmatter health
    ${pc.cyan('stats')}      Inspect documentation metrics, word counts & cache performance
    ${pc.cyan('clean')}      Delete build cache directory (.docboot / .docup)
    ${pc.cyan('generate')}   Generate production assets (favicon, Open Graph banner, PWA manifest)
    ${pc.cyan('setup')}      Configure CI integrations (GitHub Pages workflow)
    ${pc.cyan('init')}       Scaffold starter docboot.config.js and documentation files

  ${pc.bold('FLAGS')}
    ${pc.yellow('-b, --build')}       Build static site
    ${pc.yellow('-s, --serve')}       Serve built static files
    ${pc.yellow('-o, --open')}        Open site in default browser
    ${pc.yellow('-p, --port <port>')} Custom port (default: 3000)
    ${pc.yellow('-c, --clean')}       Clean cache / perform clean build
    ${pc.yellow('--no-cache')}        Bypass reading and writing build cache
    ${pc.yellow('--dry-run')}         Calculate and preview changes without modifying files
    ${pc.yellow('-f, --force')}       Overwrite existing files when allowed
    ${pc.yellow('--github')}          Include GitHub Pages health checks in doctor
    ${pc.yellow('-q, --quiet')}       Mute non-error console output
    ${pc.yellow('-v, --verbose')}     Enable verbose error logs
    ${pc.yellow('--pwa')}             Generate PWA manifest and offline support
    ${pc.yellow('-h, --help')}        Show this help message
    ${pc.yellow('--version')}         Show CLI version

  ${pc.bold('EXAMPLES')}
    ${pc.green('$')} docboot init
    ${pc.green('$')} docboot init config
    ${pc.green('$')} docboot .
    ${pc.green('$')} docboot ./docs -o
    ${pc.green('$')} docboot build --clean
    ${pc.green('$')} docboot doctor --github
    ${pc.green('$')} docboot setup github
    ${pc.green('$')} docboot stats
`);
}
