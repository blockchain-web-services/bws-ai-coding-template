/**
 * Template Variable Processor
 * Replaces template placeholders with actual values
 */

import { readFile, writeFile } from 'fs/promises';

/**
 * Replace template variables in content
 * @param {string} content - The content to process
 * @param {Object} replacements - Key-value pairs for replacement
 * @returns {string} Processed content
 */
export function replaceVariables(content, replacements) {
    let result = content;

    for (const [key, value] of Object.entries(replacements)) {
        const placeholder = `{{${key}}}`;
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        result = result.replace(regex, value);
    }

    return result;
}

/**
 * Process a template file with variable replacement
 * @param {string} sourcePath - Path to source template file
 * @param {string} destPath - Path to destination file
 * @param {Object} replacements - Key-value pairs for replacement
 * @returns {Promise<void>}
 */
export async function processTemplateFile(sourcePath, destPath, replacements) {
    let content = await readFile(sourcePath, 'utf8');
    content = replaceVariables(content, replacements);
    await writeFile(destPath, content, 'utf8');
}

/**
 * Build replacements object from user configuration
 * @param {Object} config - User configuration from prompts
 * @param {string} rootBranch - Detected root branch (main/master/staging/prod)
 * @returns {Object} Replacements object
 */
export function buildReplacements(config, rootBranch = 'staging') {
    return {
        PROJECT_NAME: config.projectName,
        REPOSITORY_NAME: config.repositoryName || config.projectName,
        GITHUB_USERNAME: config.githubUsername,
        REPOSITORY_OWNER: config.githubUsername,
        ROOT_BRANCH: rootBranch,
        PARENT_BRANCH: rootBranch  // Alias for documentation clarity
    };
}

export default {
    replaceVariables,
    processTemplateFile,
    buildReplacements
};
