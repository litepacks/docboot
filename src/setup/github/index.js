import pc from 'picocolors';
import { detectGitHubEnvironment } from './detect.js';
import { generateWorkflowYaml, checkWorkflowSafety, writeWorkflowFile, WORKFLOW_PATH } from './workflow.js';
import { validateGitHubSetup } from './validate.js';

/**
 * Runs the GitHub Pages setup command.
 * @param {object} params
 * @param {string} params.rootDir
 * @param {object} params.config
 * @param {boolean} params.dryRun
 * @param {boolean} params.force
 * @param {object} params.logger
 */
export async function setupGitHubPages({
  rootDir = process.cwd(),
  config = {},
  dryRun = false,
  force = false,
  logger = console
}) {
  const env = detectGitHubEnvironment(rootDir, config);

  if (!env.isGitHub && !env.owner) {
    logger.log(pc.yellow('✗ GitHub repository could not be detected.'));
    logger.log(pc.dim('  Ensure your repository has a GitHub origin remote or set "repo" in docboot.config.js.\n'));
  }

  const validation = validateGitHubSetup(rootDir, config, env);
  if (!validation.valid) {
    logger.log(pc.red('✗ Setup validation failed:'));
    for (const err of validation.errors) {
      logger.log(pc.red(`  • ${err}`));
    }
    return { success: false, env };
  }

  for (const warn of validation.warnings) {
    logger.log(pc.yellow(`⚠ ${warn}`));
  }

  const yamlContent = generateWorkflowYaml(env);

  if (dryRun) {
    logger.log('');
    logger.log(pc.bold('GitHub Pages setup (dry run)'));
    logger.log('');
    logger.log(`Repository       ${pc.cyan(env.owner ? `${env.owner}/${env.repository}` : '(not detected)')}`);
    logger.log(`Branch           ${pc.cyan(env.branch)}`);
    logger.log(`Package manager  ${pc.cyan(env.packageManager)}`);
    logger.log(`Node             ${pc.cyan(env.nodeVersion)}`);
    logger.log(`Output           ${pc.cyan(env.outputDir + '/')}`);
    logger.log(`Base             ${pc.cyan(env.basePath)}`);
    logger.log('');
    logger.log('Would create:');
    logger.log(`  ${pc.green(WORKFLOW_PATH)}`);
    logger.log('');
    logger.log(pc.dim('No files changed.\n'));
    return { success: true, env, dryRun: true };
  }

  const safety = checkWorkflowSafety(rootDir, force);
  if (!safety.canWrite) {
    logger.log(pc.yellow(`\n${safety.reason}\n`));
    return { success: false, env, reason: safety.reason };
  }

  writeWorkflowFile(rootDir, yamlContent);

  logger.log('');
  logger.log(pc.bold(pc.green('✔ GitHub Pages ready')));
  logger.log('');
  logger.log(`Repository\n  ${pc.cyan(env.owner ? `${env.owner}/${env.repository}` : '(not detected)')}\n`);
  logger.log(`Workflow\n  ${pc.cyan(WORKFLOW_PATH)}\n`);
  logger.log(`Branch\n  ${pc.cyan(env.branch)}\n`);
  logger.log(`Output\n  ${pc.cyan(env.outputDir + '/')}\n`);
  logger.log(`Base\n  ${pc.cyan(env.basePath)}\n`);
  logger.log(pc.bold('Next steps:'));
  logger.log(pc.dim('  git add .github/workflows/docs.yml'));
  logger.log(pc.dim('  git commit -m "add docs workflow"'));
  logger.log(pc.dim('  git push\n'));

  return { success: true, env, workflowPath: WORKFLOW_PATH };
}
