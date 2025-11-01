/**
 * Main CLI Logic
 * Orchestrates the installation flow
 */

import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    validateGitRepository,
    validatePackageJson,
    validateNoConflicts,
    validateNodeVersion,
    detectRootBranch
} from './validators.js';
import {
    askProjectInfo,
    confirmInstallation
} from './prompts.js';
import {
    installTemplateFiles,
    updatePackageJson,
    updateGitignore,
    getWorktreeScripts,
    getWorktreePatterns,
    loadWorktreeConfig,
    saveWorktreeConfig,
    createRootClaudeInstructions,
    updateClaudeMd,
    copyClaudeConfig
} from './file-copier.js';
import { buildReplacements } from './template-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(await import('fs').then(fs => fs.promises.readFile(packageJsonPath, 'utf8')));
const PACKAGE_VERSION = packageJson.version;

/**
 * Display welcome banner
 * @param {boolean} isUpdate - Whether this is an update or fresh install
 * @param {string} existingVersion - Version of existing installation (if update)
 */
function displayWelcome(isUpdate = false, existingVersion = null) {
    console.log(chalk.blue.bold('\n' + '='.repeat(60)));
    if (isUpdate) {
        console.log(chalk.blue.bold('  🔄 BWS AI Coding Template Update'));
        if (existingVersion && existingVersion !== PACKAGE_VERSION) {
            console.log(chalk.cyan(`  Upgrading from v${existingVersion} to v${PACKAGE_VERSION}`));
        }
    } else {
        console.log(chalk.blue.bold('  🚀 BWS AI Coding Template Installer'));
    }
    console.log(chalk.blue.bold('='.repeat(60)));
    console.log(chalk.white('\nAdds git worktree management and parallel testing to your project.'));
    console.log(chalk.gray(`Version: ${PACKAGE_VERSION}\n`));
}

/**
 * Display conflicts and errors
 * @param {Array} conflicts - Array of conflict objects
 */
function displayConflicts(conflicts) {
    const errors = conflicts.filter(c => c.severity === 'error');

    if (errors.length > 0) {
        console.log(chalk.red.bold('\n❌ Installation Blocked - Conflicts Detected:\n'));
        for (const error of errors) {
            console.log(chalk.red('  ✗'), error.path);
            console.log(chalk.gray('    ' + error.message));
        }
        console.log();
    }
}

/**
 * Display success message with next steps
 * @param {Object} config - User configuration
 * @param {Object} stats - Installation statistics
 */
function displaySuccess(config, stats) {
    console.log(chalk.green.bold('\n' + '='.repeat(60)));
    console.log(chalk.green.bold('  ✅ Installation Complete!'));
    console.log(chalk.green.bold('='.repeat(60)));

    console.log(chalk.white('\n📊 Installation Summary:'));

    // Scripts
    const scriptsTotal = stats.scriptsWorktree.copied + stats.scriptsWorktree.updated;
    console.log(chalk.gray('  • Scripts:'),
        scriptsTotal > 0 ? `${scriptsTotal} files` : 'none',
        stats.scriptsWorktree.updated > 0 ? chalk.blue(`(${stats.scriptsWorktree.updated} updated)`) : ''
    );

    // Docs
    const docsTotal = stats.docs.copied + stats.docs.updated;
    console.log(chalk.gray('  • Docs:'),
        docsTotal > 0 ? `${docsTotal} files` : 'none',
        stats.docs.updated > 0 ? chalk.blue(`(${stats.docs.updated} updated)`) : ''
    );

    if (config.useAWS) {
        const deployTotal = stats.deploy.copied + stats.deploy.updated;
        const testTotal = stats.test.copied + stats.test.updated;

        console.log(chalk.gray('  • Deploy files:'),
            deployTotal > 0 ? `${deployTotal} files` : 'none',
            stats.deploy.updated > 0 ? chalk.blue(`(${stats.deploy.updated} updated)`) : ''
        );
        console.log(chalk.gray('  • Test files:'),
            testTotal > 0 ? `${testTotal} files` : 'none',
            stats.test.updated > 0 ? chalk.blue(`(${stats.test.updated} updated)`) : ''
        );
        console.log(chalk.gray('  • DevOps config:'), stats.devops ? 'Yes' : 'No');
    }

    console.log(chalk.white('\n📝 Next Steps:\n'));
    console.log(chalk.cyan('  1. Review documentation:'));
    console.log(chalk.gray('     cat docs/worktrees/WORKTREES.md\n'));

    console.log(chalk.cyan('  2. Create your first worktree:'));
    console.log(chalk.gray('     npm run worktree:create feature-name\n'));

    if (config.useAWS) {
        console.log(chalk.cyan('  3. Install test dependencies:'));
        console.log(chalk.gray('     cd test && npm install\n'));

        console.log(chalk.cyan('  4. Start LocalStack:'));
        console.log(chalk.gray('     npm run docker:up\n'));

        console.log(chalk.cyan('  5. Run tests:'));
        console.log(chalk.gray('     npm test\n'));
    }

    console.log(chalk.white('💡 Available Commands:\n'));
    console.log(chalk.gray('  npm run worktree:create <name>  - Create new worktree'));
    console.log(chalk.gray('  npm run worktree:list           - List all worktrees'));
    console.log(chalk.gray('  npm run worktree:merge <name>   - Merge worktree to current branch'));
    console.log(chalk.gray('  npm run worktree:remove <name>  - Remove a worktree'));

    console.log(chalk.white('\n📖 Documentation:\n'));
    console.log(chalk.gray('  docs/worktrees/WORKTREES.md           - Worktree workflow guide'));
    console.log(chalk.gray('  docs/worktrees/GIT_WORKFLOW.md        - Git best practices'));
    console.log(chalk.gray('  docs/worktrees/PARALLEL_TESTING.md    - Parallel testing setup'));
    console.log(chalk.gray('  docs/worktrees/TROUBLESHOOTING.md     - Common issues & solutions'));

    console.log(chalk.green.bold('\n' + '='.repeat(60) + '\n'));
}

/**
 * Main CLI entry point
 * @param {Object} options - CLI options
 * @returns {Promise<void>}
 */
export async function runCLI(options = {}) {
    const {
        dryRun = false,
        skipAWS = false,
        skipTest = false,
        forceUpdate = false
    } = options;

    try {
        // Step 1: Determine project root (before welcome)
        const projectRoot = process.cwd();

        // Step 2: Load existing configuration
        const existingWorktreeConfig = await loadWorktreeConfig(projectRoot);
        const isUpdate = existingWorktreeConfig !== null;

        // Step 3: Display welcome
        displayWelcome(isUpdate, existingWorktreeConfig?.version);

        if (isUpdate) {
            console.log(chalk.cyan('📦 Existing installation detected!'));
            console.log(chalk.gray(`   Last updated: ${new Date(existingWorktreeConfig.updatedAt).toLocaleString()}\n`));
        }

        // Step 4: Validate Node.js version
        if (!validateNodeVersion()) {
            console.log(chalk.red('❌ Error: Node.js 18.0.0 or later is required'));
            console.log(chalk.gray('   Current version:'), process.version);
            console.log(chalk.gray('   Please upgrade Node.js: https://nodejs.org/\n'));
            process.exit(1);
        }

        // Step 5: Display project directory
        console.log(chalk.gray('Project directory:'), projectRoot, '\n');

        // Step 4: Validate Git repository
        console.log(chalk.cyan('Validating environment...'));
        if (!await validateGitRepository(projectRoot)) {
            console.log(chalk.red('❌ Error: Not a Git repository'));
            console.log(chalk.gray('   Run:'), 'git init', '\n');
            process.exit(1);
        }
        console.log(chalk.green('  ✓ Git repository found'));

        // Step 5: Validate package.json
        if (!await validatePackageJson(projectRoot)) {
            console.log(chalk.red('❌ Error: No valid package.json found'));
            console.log(chalk.gray('   Run:'), 'npm init', '\n');
            process.exit(1);
        }
        console.log(chalk.green('  ✓ package.json found'));

        // Step 6: Run interactive prompts
        console.log();
        const config = await askProjectInfo(projectRoot, existingWorktreeConfig?.config);

        // Apply CLI flags
        if (skipAWS) {
            config.useAWS = false;
        }

        // Step 7: Validate no conflicts
        console.log(chalk.cyan('\nChecking for conflicts...'));
        const { valid, conflicts } = await validateNoConflicts(projectRoot, config.useAWS);

        // Display all conflicts
        for (const conflict of conflicts) {
            if (conflict.severity === 'error') {
                console.log(chalk.red('  ✗'), conflict.path, chalk.gray('-'), conflict.message);
            } else {
                console.log(chalk.yellow('  ⚠'), conflict.path, chalk.gray('-'), conflict.message);
            }
        }

        if (!valid) {
            displayConflicts(conflicts);
            process.exit(1);
        }

        if (conflicts.length === 0) {
            console.log(chalk.green('  ✓ No conflicts detected'));
        }

        // Step 8: Display summary and get confirmation
        const confirmed = await confirmInstallation(config, conflicts);

        if (!confirmed) {
            console.log(chalk.yellow('\n⚠ Installation cancelled by user\n'));
            process.exit(0);
        }

        // Step 9: Dry run mode
        if (dryRun) {
            console.log(chalk.cyan('\n🔍 Dry run mode - no files will be copied'));
            console.log(chalk.gray('Run without --dry-run to perform actual installation\n'));
            process.exit(0);
        }

        // Step 10: Warning for force update
        if (forceUpdate) {
            console.log(chalk.yellow('\n⚠️  WARNING: --force flag enabled'));
            console.log(chalk.yellow('    This will overwrite ALL existing files, including AWS templates.'));
            console.log(chalk.yellow('    Your customizations may be lost!\n'));
        }

        // Step 10a: Detect root branch
        const rootBranch = await detectRootBranch(projectRoot);
        console.log(chalk.gray('Detected root branch:'), rootBranch);

        // Step 11: Copy template files
        console.log(chalk.cyan.bold('\n📦 Installing Template Files...'));

        // Determine template directory
        const templateRoot = path.join(__dirname, '..', 'templates');

        // Build replacements
        const replacements = buildReplacements(config);

        // Install template files
        const stats = await installTemplateFiles(templateRoot, projectRoot, config, replacements, forceUpdate);

        // Step 11: Update package.json
        console.log(chalk.cyan('\n📝 Updating package.json...'));
        const scripts = getWorktreeScripts();
        await updatePackageJson(projectRoot, scripts);

        // Step 12: Update .gitignore
        console.log(chalk.cyan('\n📝 Updating .gitignore...'));
        const patterns = getWorktreePatterns();
        await updateGitignore(projectRoot, patterns);

        // Step 13: Create CLAUDE.md and CLAUDE_INSTRUCTIONS.md
        console.log(chalk.cyan('\n📝 Setting up Claude Code integration...'));
        await createRootClaudeInstructions(projectRoot, rootBranch);
        await updateClaudeMd(projectRoot);

        // Step 13a: Copy Claude Code skills
        console.log(chalk.cyan('\n🎯 Setting up Claude Code skills...'));
        await copyClaudeConfig(templateRoot, projectRoot, replacements);
        console.log(chalk.green('  ✓ Installed DevOps skill'));

        // Step 14: Save configuration
        console.log(chalk.cyan('\n💾 Saving configuration...'));
        await saveWorktreeConfig(projectRoot, config, PACKAGE_VERSION);

        // Step 15: Display success message
        displaySuccess(config, stats);

    } catch (error) {
        console.log(chalk.red('\n❌ Fatal error:'), error.message);
        console.log(chalk.gray('\nStack trace:'));
        console.log(chalk.gray(error.stack));
        console.log();
        process.exit(1);
    }
}

export default { runCLI };
