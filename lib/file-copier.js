/**
 * File Copying Utilities
 * Handles copying template files with variable replacement
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { processTemplateFile, replaceVariables } from './template-processor.js';

/**
 * Copy template directory to destination with variable replacement
 * @param {string} sourceDir - Source template directory
 * @param {string} destDir - Destination directory
 * @param {Object} replacements - Variables to replace
 * @param {Array<string>} skipPatterns - Patterns to skip
 * @param {boolean} forceUpdate - Always overwrite existing files
 * @returns {Promise<{copied: number, skipped: number, updated: number}>}
 */
export async function copyTemplateFiles(sourceDir, destDir, replacements, skipPatterns = [], forceUpdate = false) {
    const stats = { copied: 0, skipped: 0, updated: 0 };

    // Ensure destination exists
    await fs.ensureDir(destDir);

    // Get all files in source directory
    const files = await glob('**/*', {
        cwd: sourceDir,
        nodir: true,
        dot: true
    });

    for (const file of files) {
        // Skip patterns
        if (skipPatterns.some(pattern => file.includes(pattern))) {
            continue;
        }

        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(destDir, file);

        // Ensure parent directory exists
        await fs.ensureDir(path.dirname(destPath));

        // Check if file already exists
        const fileExists = await fs.pathExists(destPath);

        if (fileExists && !forceUpdate) {
            console.log(chalk.yellow('  ⚠ Skipped:'), file, chalk.gray('(already exists)'));
            stats.skipped++;
            continue;
        }

        // Determine if file needs variable replacement
        const needsReplacement = isTextFile(file);

        if (needsReplacement) {
            // Process text files with template processor
            await processTemplateFile(sourcePath, destPath, replacements);
        } else {
            // Copy binary files directly
            await fs.copy(sourcePath, destPath);
        }

        if (fileExists) {
            console.log(chalk.blue('  ↻ Updated:'), file);
            stats.updated++;
        } else {
            console.log(chalk.green('  ✓ Copied:'), file);
            stats.copied++;
        }
    }

    return stats;
}

/**
 * Check if file should be processed as text (for variable replacement)
 * @param {string} filename - File name or path
 * @returns {boolean}
 */
function isTextFile(filename) {
    const textExtensions = [
        '.js', '.mjs', '.cjs', '.ts', '.tsx',
        '.json', '.yml', '.yaml',
        '.md', '.txt',
        '.sh', '.bash',
        '.html', '.css', '.scss',
        '.gitignore', '.env', '.example'
    ];

    return textExtensions.some(ext => filename.endsWith(ext));
}

/**
 * Get worktree management scripts to add to package.json
 * @returns {Object} Scripts object
 */
export function getWorktreeScripts() {
    return {
        'worktree:create': 'node scripts/worktree/create-worktree.mjs',
        'worktree:list': 'node scripts/worktree/list-worktrees.mjs',
        'worktree:merge': 'node scripts/worktree/merge-worktree.mjs',
        'worktree:remove': 'node scripts/worktree/remove-worktree.mjs'
    };
}

/**
 * Update package.json with worktree scripts
 * @param {string} projectRoot - Path to project root
 * @param {Object} scripts - Scripts to add
 * @returns {Promise<void>}
 */
export async function updatePackageJson(projectRoot, scripts) {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = await fs.readJson(pkgPath);

    // Initialize scripts object if it doesn't exist
    if (!pkg.scripts) {
        pkg.scripts = {};
    }

    // Track what was added, updated, or skipped
    const added = [];
    const updated = [];
    const unchanged = [];

    // Merge scripts, updating if value changed
    for (const [key, value] of Object.entries(scripts)) {
        if (pkg.scripts[key]) {
            if (pkg.scripts[key] !== value) {
                pkg.scripts[key] = value;
                updated.push(key);
            } else {
                unchanged.push(key);
            }
        } else {
            pkg.scripts[key] = value;
            added.push(key);
        }
    }

    // Write back with 2-space formatting
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });

    // Report changes
    if (added.length > 0) {
        console.log(chalk.green('  ✓ Added scripts:'), added.join(', '));
    }
    if (updated.length > 0) {
        console.log(chalk.blue('  ↻ Updated scripts:'), updated.join(', '));
    }
    if (unchanged.length > 0) {
        console.log(chalk.gray('  • Unchanged scripts:'), unchanged.join(', '));
    }
}

/**
 * Load existing worktree configuration
 * @param {string} projectRoot - Path to project root
 * @returns {Promise<Object|null>} Configuration object or null if not found
 */
export async function loadWorktreeConfig(projectRoot) {
    const configPath = path.join(projectRoot, '.worktrees');

    try {
        if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            return config;
        }
    } catch (error) {
        console.log(chalk.yellow('  ⚠ Warning: Could not read .worktrees config:', error.message));
    }

    return null;
}

/**
 * Save worktree configuration
 * @param {string} projectRoot - Path to project root
 * @param {Object} config - User configuration
 * @param {string} version - Package version
 * @returns {Promise<void>}
 */
export async function saveWorktreeConfig(projectRoot, config, version) {
    const configPath = path.join(projectRoot, '.worktrees');

    const existingConfig = await loadWorktreeConfig(projectRoot);
    const now = new Date().toISOString();

    const worktreeConfig = {
        version,
        installed: true,
        installedAt: existingConfig?.installedAt || now,
        updatedAt: now,
        config: {
            projectName: config.projectName,
            githubUsername: config.githubUsername,
            repositoryName: config.repositoryName,
            useAWS: config.useAWS
        }
    };

    await fs.writeJson(configPath, worktreeConfig, { spaces: 2 });
    console.log(chalk.green('  ✓ Saved configuration to .worktrees'));
}

/**
 * Get gitignore patterns for worktree files
 * @returns {string} Gitignore content to append
 */
export function getWorktreePatterns() {
    return `
# Worktree-specific files (added by bws-ai-coding-template)
.env.worktree
.worktree-info.json
docker-compose.worktree.yml
CLAUDE_INSTRUCTIONS.md
.worktrees
test/.env.worktree
test/.worktree-info.json
test/docker-compose.worktree.yml
.trees/*/CLAUDE_INSTRUCTIONS.md
`;
}

/**
 * Update .gitignore with worktree patterns
 * @param {string} projectRoot - Path to project root
 * @param {string} patterns - Patterns to append
 * @returns {Promise<void>}
 */
export async function updateGitignore(projectRoot, patterns) {
    const gitignorePath = path.join(projectRoot, '.gitignore');

    let content = '';
    if (await fs.pathExists(gitignorePath)) {
        content = await fs.readFile(gitignorePath, 'utf8');
    }

    // Check if worktree section already exists
    if (content.includes('# Worktree-specific files')) {
        console.log(chalk.yellow('  ⚠ .gitignore already contains worktree patterns'));
        return;
    }

    // Ensure content ends with newline before appending
    if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n';
    }

    // Append worktree patterns
    content += patterns;

    await fs.writeFile(gitignorePath, content, 'utf8');
    console.log(chalk.green('  ✓ Updated .gitignore with worktree patterns'));
}

/**
 * Create CLAUDE_INSTRUCTIONS.md in root project
 * @param {string} projectRoot - Path to project root
 * @param {string} rootBranch - Current root branch name
 * @returns {Promise<void>}
 */
export async function createRootClaudeInstructions(projectRoot, rootBranch) {
    const claudeInstructionsPath = path.join(projectRoot, 'CLAUDE_INSTRUCTIONS.md');

    // Check if already exists
    if (await fs.pathExists(claudeInstructionsPath)) {
        console.log(chalk.yellow('  ⚠ CLAUDE_INSTRUCTIONS.md already exists'));
        return;
    }

    const content = `# Claude Code Instructions - Root Branch

⚠️ **FORBIDDEN: Do NOT edit files directly in this directory**

**Current Branch**: \`${rootBranch}\` (root/main project branch)

## Important Rules

- **NEVER** make changes directly in this root branch directory
- **ALWAYS** create a worktree for any feature/fix work
- This directory is for reviewing code and merging completed work only

## Workflow

1. **Create worktree**: \`npm run worktree:create <branch-name>\`
2. **Work in worktree**: \`cd .trees/<branch-name>/\`
3. **All development happens in worktrees, not here**

## When Working in Root Directory

You should ONLY be in this directory to:
- Review merged code
- Create new worktrees
- Merge completed features from worktrees
- Push to origin

## See Also

- \`docs/worktrees/CLAUDE_INSTRUCTIONS.md\` - Complete workflow guide
- \`docs/worktrees/WORKTREES.md\` - Worktree documentation
- \`docs/worktrees/GIT_WORKFLOW.md\` - Git best practices

---

**Note**: This file is gitignored and won't be committed. It's for your local context.
`;

    await fs.writeFile(claudeInstructionsPath, content, 'utf8');
    console.log(chalk.green('  ✓ Created CLAUDE_INSTRUCTIONS.md'));
}

/**
 * Update or create CLAUDE.md with reference to CLAUDE_INSTRUCTIONS.md
 * @param {string} projectRoot - Path to project root
 * @returns {Promise<void>}
 */
export async function updateClaudeMd(projectRoot) {
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    const reference = '\n\n⚠️ **IMPORTANT**: Read `CLAUDE_INSTRUCTIONS.md` for context before making changes in this repository.\n';

    let content = '';
    let existed = false;

    if (await fs.pathExists(claudeMdPath)) {
        content = await fs.readFile(claudeMdPath, 'utf8');
        existed = true;

        // Check if reference already exists
        if (content.includes('CLAUDE_INSTRUCTIONS.md')) {
            console.log(chalk.yellow('  ⚠ CLAUDE.md already contains reference to CLAUDE_INSTRUCTIONS.md'));
            return;
        }
    }

    // Append or create with reference
    content += reference;

    await fs.writeFile(claudeMdPath, content, 'utf8');

    if (existed) {
        console.log(chalk.blue('  ↻ Updated CLAUDE.md with reference to CLAUDE_INSTRUCTIONS.md'));
    } else {
        console.log(chalk.green('  ✓ Created CLAUDE.md with reference to CLAUDE_INSTRUCTIONS.md'));
    }
}

/**
 * Copy entire template directory structure
 * @param {string} templateRoot - Root of template directory
 * @param {string} projectRoot - Target project root
 * @param {Object} config - User configuration
 * @param {Object} replacements - Variable replacements
 * @param {boolean} forceUpdate - Force update of all files
 * @returns {Promise<Object>} Copy statistics
 */
export async function installTemplateFiles(templateRoot, projectRoot, config, replacements, forceUpdate = false) {
    const stats = {
        scriptsWorktree: { copied: 0, skipped: 0, updated: 0 },
        docs: { copied: 0, skipped: 0, updated: 0 },
        deploy: { copied: 0, skipped: 0, updated: 0 },
        test: { copied: 0, skipped: 0, updated: 0 },
        devops: false
    };

    // Always update: scripts/worktree (these are tool-owned files)
    console.log(chalk.cyan('\nCopying scripts/worktree/...'));
    const worktreeSource = path.join(templateRoot, 'scripts', 'worktree');
    const worktreeDest = path.join(projectRoot, 'scripts', 'worktree');
    stats.scriptsWorktree = await copyTemplateFiles(worktreeSource, worktreeDest, replacements, [], true); // Always update

    // Always update: docs (documentation should be kept up to date)
    console.log(chalk.cyan('\nCopying docs/worktrees/...'));
    const docsSource = path.join(templateRoot, 'docs');
    const docsDest = path.join(projectRoot, 'docs', 'worktrees');
    if (await fs.pathExists(docsSource)) {
        stats.docs = await copyTemplateFiles(docsSource, docsDest, replacements, [], true); // Always update
    } else {
        console.log(chalk.yellow('  ⚠ docs/ folder not found in templates'));
    }

    // AWS-specific files
    if (config.useAWS) {
        // Copy .deploy (use forceUpdate flag from config)
        console.log(chalk.cyan('\nCopying .deploy/...'));
        const deploySource = path.join(templateRoot, '.deploy');
        const deployDest = path.join(projectRoot, '.deploy');
        stats.deploy = await copyTemplateFiles(deploySource, deployDest, replacements, [], forceUpdate);

        // Copy test (use forceUpdate flag from config)
        console.log(chalk.cyan('\nCopying test/...'));
        const testSource = path.join(templateRoot, 'test');
        const testDest = path.join(projectRoot, 'test');
        stats.test = await copyTemplateFiles(testSource, testDest, replacements, [], forceUpdate);

        // Copy devops.yml
        console.log(chalk.cyan('\nCopying devops.yml...'));
        const devopsSource = path.join(templateRoot, 'devops.yml');
        const devopsDest = path.join(projectRoot, 'devops.yml');
        if (await fs.pathExists(devopsSource)) {
            if (await fs.pathExists(devopsDest)) {
                console.log(chalk.yellow('  ⚠ Skipped: devops.yml (already exists)'));
            } else {
                await processTemplateFile(devopsSource, devopsDest, replacements);
                console.log(chalk.green('  ✓ Copied: devops.yml'));
                stats.devops = true;
            }
        }
    }

    return stats;
}

/**
 * Copy Claude Code configuration to project
 * @param {string} templateRoot - Template directory
 * @param {string} projectRoot - Target project root
 * @param {Object} replacements - Variable replacements
 * @returns {Promise<{copied: number, skipped: number, updated: number}>}
 */
export async function copyClaudeConfig(templateRoot, projectRoot, replacements) {
    const stats = { copied: 0, skipped: 0, updated: 0 };

    const claudeSource = path.join(templateRoot, '.claude');
    const claudeDest = path.join(projectRoot, '.claude');

    // Check if source .claude directory exists
    if (!await fs.pathExists(claudeSource)) {
        console.log(chalk.yellow('  ⚠ No .claude directory found in templates'));
        return stats;
    }

    // Copy .claude/skills/ directory
    const skillsSource = path.join(claudeSource, 'skills');
    const skillsDest = path.join(claudeDest, 'skills');

    if (await fs.pathExists(skillsSource)) {
        console.log(chalk.cyan('  Copying skills...'));
        const skillStats = await copyTemplateFiles(skillsSource, skillsDest, replacements, [], true);
        stats.copied += skillStats.copied;
        stats.skipped += skillStats.skipped;
        stats.updated += skillStats.updated;
    }

    // Copy .claude/commands/ directory
    const commandsSource = path.join(claudeSource, 'commands');
    const commandsDest = path.join(claudeDest, 'commands');

    if (await fs.pathExists(commandsSource)) {
        console.log(chalk.cyan('  Copying commands...'));
        const commandStats = await copyTemplateFiles(commandsSource, commandsDest, replacements, [], true);
        stats.copied += commandStats.copied;
        stats.skipped += commandStats.skipped;
        stats.updated += commandStats.updated;
    }

    // Copy .claude/README.md
    const readmeSource = path.join(claudeSource, 'README.md');
    const readmeDest = path.join(claudeDest, 'README.md');

    if (await fs.pathExists(readmeSource)) {
        const fileExists = await fs.pathExists(readmeDest);
        await processTemplateFile(readmeSource, readmeDest, replacements);

        if (fileExists) {
            console.log(chalk.blue('  ↻ Updated: .claude/README.md'));
            stats.updated++;
        } else {
            console.log(chalk.green('  ✓ Copied: .claude/README.md'));
            stats.copied++;
        }
    }

    return stats;
}

export default {
    copyTemplateFiles,
    updatePackageJson,
    updateGitignore,
    getWorktreeScripts,
    getWorktreePatterns,
    loadWorktreeConfig,
    saveWorktreeConfig,
    createRootClaudeInstructions,
    updateClaudeMd,
    installTemplateFiles,
    copyClaudeConfig
};
