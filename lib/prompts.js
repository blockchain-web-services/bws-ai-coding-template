/**
 * Interactive Prompts
 * Collects user input for installation configuration
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { detectProjectName, detectRepositoryName } from './validators.js';

/**
 * Ask user for project information
 * @param {string} projectRoot - Path to project root
 * @returns {Promise<Object>} Configuration object
 */
export async function askProjectInfo(projectRoot) {
    // Auto-detect project name from package.json
    const defaultName = await detectProjectName(projectRoot);

    // Auto-detect repository name from git remote
    const detectedRepoName = await detectRepositoryName(projectRoot);

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: defaultName || 'my-project',
            validate: (input) => {
                if (!input || input.trim().length === 0) {
                    return 'Project name is required';
                }
                return true;
            }
        },
        {
            type: 'input',
            name: 'githubUsername',
            message: 'GitHub username or organization:',
            validate: (input) => {
                if (!input || input.trim().length === 0) {
                    return 'GitHub username is required';
                }
                return true;
            }
        },
        {
            type: 'confirm',
            name: 'useAWS',
            message: 'Does your project use AWS deployments?',
            default: false
        }
    ]);

    return {
        projectName: answers.projectName.trim(),
        githubUsername: answers.githubUsername.trim(),
        useAWS: answers.useAWS,
        repositoryName: detectedRepoName || answers.projectName.trim()
    };
}

/**
 * Display installation summary and ask for confirmation
 * @param {Object} config - Configuration from askProjectInfo
 * @param {Array} conflicts - Array of conflicts from validation
 * @returns {Promise<boolean>} True if user confirms
 */
export async function confirmInstallation(config, conflicts = []) {
    console.log(chalk.cyan('\n' + '='.repeat(50)));
    console.log(chalk.cyan.bold('  Installation Summary'));
    console.log(chalk.cyan('='.repeat(50)));

    console.log(chalk.white('\nProject Configuration:'));
    console.log(chalk.gray('  Project:'), chalk.white(config.projectName));
    console.log(chalk.gray('  Repository:'), chalk.white(config.repositoryName || config.projectName));
    console.log(chalk.gray('  GitHub:'), chalk.white(config.githubUsername));
    console.log(chalk.gray('  AWS Support:'), chalk.white(config.useAWS ? 'Yes' : 'No'));

    console.log(chalk.white('\nFiles to Install:'));
    console.log(chalk.green('  ✓'), 'scripts/worktree/', chalk.gray('- Worktree management scripts'));
    console.log(chalk.green('  ✓'), 'docs/worktrees/', chalk.gray('- Documentation files'));

    if (config.useAWS) {
        console.log(chalk.green('  ✓'), '.deploy/', chalk.gray('- CloudFormation templates'));
        console.log(chalk.green('  ✓'), 'test/', chalk.gray('- Testing infrastructure'));
        console.log(chalk.green('  ✓'), 'devops.yml', chalk.gray('- CI/CD pipeline'));
    }

    console.log(chalk.white('\nChanges to Existing Files:'));
    console.log(chalk.yellow('  →'), 'package.json', chalk.gray('- Add worktree npm scripts'));
    console.log(chalk.yellow('  →'), '.gitignore', chalk.gray('- Add worktree patterns'));

    // Display warnings if any
    const warnings = conflicts.filter(c => c.severity === 'warning');
    if (warnings.length > 0) {
        console.log(chalk.yellow('\n⚠ Warnings:'));
        for (const warning of warnings) {
            console.log(chalk.yellow('  • ' + warning.path), chalk.gray(warning.message));
        }
    }

    console.log(chalk.cyan('\n' + '='.repeat(50) + '\n'));

    const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: 'Proceed with installation?',
        default: true
    }]);

    return confirmed;
}

export default {
    askProjectInfo,
    confirmInstallation
};
