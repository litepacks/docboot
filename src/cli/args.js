import path from 'node:path';

/**
 * Parses command line arguments and flags.
 * Supports:
 *   docboot [dir]
 *   docboot dev [dir]
 *   docboot build [dir]
 *   docboot serve [dir]
 *   docboot doctor [dir]
 *   docboot stats [dir]
 *   docboot generate [assets|favicon|og|pwa] [dir]
 * 
 * Flags:
 *   -b, --build
 *   -s, --serve
 *   -o, --open
 *   -p, --port <port>
 *   -c, --clean
 *   -q, --quiet
 *   -v, --verbose
 *   -h, --help
 *   --version
 *   --pwa
 */
export function parseArgs(rawArgs = process.argv.slice(2)) {
  const flags = {
    command: null,
    subcommand: null,
    dir: null,
    build: false,
    serve: false,
    open: false,
    port: null,
    clean: false,
    quiet: false,
    verbose: false,
    help: false,
    version: false,
    pwa: false,
    noCache: false,
    cache: false,
    dryRun: false,
    force: false,
    github: false,
    a11y: false,
    stale: false,
    presenter: false,
    file: null,
    unknown: []
  };

  const positional = [];
  let i = 0;

  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version') {
      flags.version = true;
    } else if (arg === '--stale') {
      flags.stale = true;
    } else if (arg === '--build' || arg === '-b') {
      flags.build = true;
    } else if (arg === '--serve') {
      flags.serve = true;
    } else if (arg === '--open') {
      flags.open = true;
    } else if (arg === '--presenter') {
      flags.presenter = true;
    } else if (arg === '--clean') {
      flags.clean = true;
    } else if (arg === '--no-cache') {
      flags.noCache = true;
    } else if (arg === '--cache') {
      flags.cache = true;
    } else if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--force' || arg === '-f') {
      flags.force = true;
    } else if (arg === '--github') {
      flags.github = true;
    } else if (arg === '--a11y') {
      flags.a11y = true;
    } else if (arg === '--quiet') {
      flags.quiet = true;
    } else if (arg === '--verbose') {
      flags.verbose = true;
    } else if (arg === '--pwa') {
      flags.pwa = true;
    } else if (arg === '--port' || arg === '-p') {
      i++;
      if (i < rawArgs.length && !rawArgs[i].startsWith('-')) {
        flags.port = parseInt(rawArgs[i], 10);
      }
    } else if (arg.startsWith('--port=')) {
      flags.port = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
      // Short flag or combined short flags (e.g. -bo, -p 3000, -p3000)
      const chars = arg.slice(1);
      let skipChars = false;

      for (let j = 0; j < chars.length; j++) {
        const c = chars[j];
        if (c === 'b') flags.build = true;
        else if (c === 's') flags.serve = true;
        else if (c === 'o') flags.open = true;
        else if (c === 'c') flags.clean = true;
        else if (c === 'f') flags.force = true;
        else if (c === 'q') flags.quiet = true;
        else if (c === 'v') flags.verbose = true;
        else if (c === 'h') flags.help = true;
        else if (c === 'p') {
          const rest = chars.slice(j + 1);
          if (rest.length > 0) {
            flags.port = parseInt(rest, 10);
            skipChars = true;
            break;
          } else {
            i++;
            if (i < rawArgs.length && !rawArgs[i].startsWith('-')) {
              flags.port = parseInt(rawArgs[i], 10);
            }
            skipChars = true;
            break;
          }
        } else {
          flags.unknown.push(`-${c}`);
        }
      }
      if (skipChars) {
        // Handled rest of flag
      }
    } else {
      positional.push(arg);
    }
    i++;
  }

  // Determine command and target directory / file
  if (positional.length > 0) {
    const first = positional[0].toLowerCase();
    if (['dev', 'build', 'serve', 'doctor', 'stats', 'clean', 'help'].includes(first)) {
      flags.command = first;
      flags.dir = positional[1] || null;
    } else if (first === 'present') {
      flags.command = 'present';
      const second = positional[1]?.toLowerCase();
      if (second === 'build') {
        flags.subcommand = 'build';
        flags.file = positional[2] || 'talk.md';
      } else {
        flags.subcommand = 'dev';
        flags.file = positional[1] || 'talk.md';
      }
    } else if (first === 'generate') {
      flags.command = 'generate';
      const second = positional[1]?.toLowerCase();
      if (['assets', 'favicon', 'og', 'pwa'].includes(second)) {
        flags.subcommand = second;
        flags.dir = positional[2] || null;
      } else {
        flags.subcommand = 'assets';
        flags.dir = positional[1] || null;
      }
    } else if (first === 'setup') {
      flags.command = 'setup';
      const second = positional[1]?.toLowerCase();
      if (second) {
        flags.subcommand = second;
        flags.dir = positional[2] || null;
      } else {
        flags.subcommand = 'github';
        flags.dir = positional[1] || null;
      }
    } else if (first === 'init') {
      flags.command = 'init';
      const second = positional[1]?.toLowerCase();
      if (second === 'config') {
        flags.subcommand = 'config';
        flags.dir = positional[2] || null;
      } else {
        flags.dir = positional[1] || null;
      }
    } else {
      flags.dir = positional[0];
    }
  }

  // Handle flag overrides
  if (flags.help || flags.command === 'help') {
    flags.command = 'help';
  } else if (flags.version) {
    flags.command = 'version';
  } else if (flags.build) {
    flags.command = 'build';
  } else if (flags.serve) {
    flags.command = 'serve';
  } else if (!flags.command) {
    flags.command = 'dev'; // Default behavior: zero-config dev server
  }

  // Only resolve directory if explicitly provided by user
  if (flags.dir) {
    flags.dir = path.resolve(process.cwd(), flags.dir);
  }

  return flags;
}
