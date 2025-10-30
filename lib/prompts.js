/**
 * Interactive Prompts
 *
 * TODO: Implement interactive questions using inquirer:
 * - Project name (auto-detect from package.json)
 * - GitHub username/organization
 * - Use AWS deployments? (Y/n)
 * - Confirmation before copying files
 */

import inquirer from 'inquirer';

export async function askProjectInfo() {
    // TODO: Implement prompts
    return {
        projectName: 'my-project',
        githubUsername: 'username',
        useAWS: false
    };
}
