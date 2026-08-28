#!/usr/bin/env node

import { parseArgs } from '../src/cli/args.js';
import { runCommand } from '../src/cli/commands.js';

const flags = parseArgs(process.argv.slice(2));

runCommand(flags).catch((err) => {
  console.error('\n  ✖ Fatal Error:', err.message || err);
  if (flags.verbose) {
    console.error(err.stack);
  }
  process.exit(1);
});
