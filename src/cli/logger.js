import fs from 'node:fs';
import pc from 'picocolors';

let pkgVersion = '0.2.10';
try {
  const pkgUrl = new URL('../../package.json', import.meta.url);
  const pkg = JSON.parse(fs.readFileSync(pkgUrl, 'utf-8'));
  if (pkg.version) pkgVersion = pkg.version;
} catch {}

export class Logger {
  constructor(options = {}) {
    this.quiet = options.quiet || false;
    this.verbose = options.verbose || false;
  }

  banner(version = pkgVersion) {
    if (this.quiet) return;
    console.log(
      pc.cyan(pc.bold('\n  ▲ Docboot ')) +
      pc.dim(`v${version}`) +
      pc.dim(' — Ultra-fast Markdown documentation\n')
    );
  }

  log(msg = '') {
    if (this.quiet) return;
    console.log(msg);
  }

  info(msg) {
    if (this.quiet) return;
    console.log(pc.blue('  ℹ ') + msg);
  }

  success(msg) {
    if (this.quiet) return;
    console.log(pc.green('  ✔ ') + msg);
  }

  warn(msg) {
    console.log(pc.yellow('  ⚠ ') + pc.yellow(msg));
  }

  error(msg, err = null) {
    console.error(pc.red(pc.bold('  ✖ ')) + pc.red(msg));
    if (err && this.verbose) {
      console.error(pc.dim(err.stack || err));
    }
  }

  dim(msg) {
    if (this.quiet) return;
    console.log(pc.dim(`    ${msg}`));
  }

  change(file, route, elapsedMs) {
    if (this.quiet) return;
    const timeStr = elapsedMs !== undefined ? pc.dim(` (${elapsedMs}ms)`) : '';
    console.log(
      pc.cyan('  ↻ ') +
      pc.dim('changed: ') + pc.bold(file) +
      pc.dim(' → ') + pc.green(route) +
      timeStr
    );
  }

  ready(url, pageCount, watchDir, elapsedMs) {
    if (this.quiet) return;
    console.log(
      pc.green('  ➜ ') +
      pc.bold('Local:   ') + pc.cyan(pc.underline(url))
    );
    console.log(
      pc.dim('    Pages:   ') + pc.bold(pageCount) +
      pc.dim(` (built in ${elapsedMs}ms)`)
    );
    console.log(
      pc.dim('    Watching:') + ` ${watchDir}\n`
    );
  }

  buildDone(outDir, pageCount, elapsedMs) {
    if (this.quiet) return;
    console.log(
      pc.green('  ✔ ') +
      pc.bold('Built ') + pc.green(`${pageCount} pages`) +
      pc.dim(` to `) + pc.cyan(outDir) +
      pc.dim(` in ${elapsedMs}ms\n`)
    );
  }
}
