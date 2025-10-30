/**
 * Pre-flight Validation Checks
 * Validates environment before installation
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Check if current directory is a Git repository
 * @param {string} projectRoot - Path to project root
 * @returns {Promise<boolean>} True if Git repository exists
 */
export async function validateGitRepository(projectRoot) {
    const gitDir = path.join(projectRoot, '.git');
    return await fs.pathExists(gitDir);
}

/**
 * Validate package.json exists and is valid JSON
 * @param {string} projectRoot - Path to project root
 * @returns {Promise<boolean>} True if package.json is valid
 */
export async function validatePackageJson(projectRoot) {
    const pkgPath = path.join(projectRoot, 'package.json');

    if (!await fs.pathExists(pkgPath)) {
        return false;
    }

    try {
        const pkg = await fs.readJson(pkgPath);
        // Basic validation - should have a name property
        return typeof pkg === 'object' && pkg !== null;
    } catch (error) {
        return false;
    }
}

/**
 * Check for file conflicts before installation
 * @param {string} projectRoot - Path to project root
 * @param {boolean} useAWS - Whether AWS features are enabled
 * @returns {Promise<{valid: boolean, conflicts: Array}>} Validation result
 */
export async function validateNoConflicts(projectRoot, useAWS) {
    const conflicts = [];

    // Check for .deploy folder if AWS is enabled
    if (useAWS) {
        const deployDir = path.join(projectRoot, '.deploy');
        if (await fs.pathExists(deployDir)) {
            conflicts.push({
                path: '.deploy/',
                message: 'AWS deployment folder already exists. Remove it or use --skip-aws flag.',
                severity: 'error'
            });
        }

        // Check for test or tests folder
        const testDir = path.join(projectRoot, 'test');
        const testsDir = path.join(projectRoot, 'tests');

        if (await fs.pathExists(testDir)) {
            conflicts.push({
                path: 'test/',
                message: 'Test folder already exists. Remove it or use --skip-test flag.',
                severity: 'error'
            });
        } else if (await fs.pathExists(testsDir)) {
            conflicts.push({
                path: 'tests/',
                message: 'Tests folder already exists. Remove it or use --skip-test flag.',
                severity: 'error'
            });
        }
    }

    // Check for scripts/worktree (warning only, not blocker)
    const worktreeDir = path.join(projectRoot, 'scripts', 'worktree');
    if (await fs.pathExists(worktreeDir)) {
        conflicts.push({
            path: 'scripts/worktree/',
            message: 'Worktree scripts already exist. They will be overwritten.',
            severity: 'warning'
        });
    }

    // Check for docs folder (warning only)
    const docsDir = path.join(projectRoot, 'docs');
    if (await fs.pathExists(docsDir)) {
        conflicts.push({
            path: 'docs/',
            message: 'Documentation folder already exists. Files will be added/merged.',
            severity: 'warning'
        });
    }

    // Valid if no errors (warnings are OK)
    const valid = conflicts.filter(c => c.severity === 'error').length === 0;

    return { valid, conflicts };
}

/**
 * Detect project name from package.json
 * @param {string} projectRoot - Path to project root
 * @returns {Promise<string|null>} Project name or null if not found
 */
export async function detectProjectName(projectRoot) {
    const pkgPath = path.join(projectRoot, 'package.json');

    try {
        const pkg = await fs.readJson(pkgPath);
        return pkg.name || null;
    } catch (error) {
        return null;
    }
}

/**
 * Check Node.js version compatibility
 * @returns {boolean} True if Node.js version is compatible
 */
export function validateNodeVersion() {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    return major >= 18;
}

export default {
    validateGitRepository,
    validatePackageJson,
    validateNoConflicts,
    detectProjectName,
    validateNodeVersion
};
