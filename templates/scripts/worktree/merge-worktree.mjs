#!/usr/bin/env node

/**
 * Merge a worktree branch into the current branch while preserving worktree-specific files
 * Usage: npm run worktree:merge <branch-name> -- [--update] [--force] [--no-push]
 * Note: The -- separator is required to pass flags through npm to the script
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

// Color codes for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Files that should NEVER be merged from worktrees
const WORKTREE_SPECIFIC_FILES = [
    '.env.worktree',
    '.worktree-info.json',
    'docker-compose.worktree.yml',
    'WORKTREE_CONTEXT.md',
    'test/.env.worktree',
    'test/docker-compose.worktree.yml',
    'test/.worktree-info.json',
    '.trees/',
    'localstack-data-*',
    '**/localstack-data-*'
];

// Files that should preserve main branch values
const PRESERVE_MAIN_FILES = [
    'test/.env',
    'test/package.json',
    '.gitignore'
];

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function execCommand(command, options = {}) {
    try {
        return execSync(command, { encoding: 'utf8', ...options }).trim();
    } catch (error) {
        if (!options.ignoreError) {
            throw error;
        }
        return null;
    }
}

function getCurrentBranch() {
    return execCommand('git rev-parse --abbrev-ref HEAD');
}

function getModifiedFiles(sourceBranch, targetBranch) {
    const diff = execCommand(`git diff --name-only ${targetBranch}...${sourceBranch}`);
    return diff ? diff.split('\n').filter(f => f) : [];
}

function isWorktreeSpecificFile(file) {
    return WORKTREE_SPECIFIC_FILES.some(pattern => {
        // Handle glob patterns
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(file);
        }
        // Handle directory patterns
        if (pattern.endsWith('/')) {
            return file.startsWith(pattern);
        }
        // Exact match
        return file === pattern;
    });
}

function shouldPreserveMainVersion(file) {
    return PRESERVE_MAIN_FILES.includes(file);
}

function detectExpectedParentBranch(branchName) {
    // Try reading from .worktree-info.json first
    const infoPath = join(rootDir, '.trees', branchName, 'test', '.worktree-info.json');

    if (existsSync(infoPath)) {
        try {
            const info = JSON.parse(readFileSync(infoPath, 'utf8'));
            if (info.parentBranch) {
                return info.parentBranch;
            }
        } catch (error) {
            // Continue to fallback methods
        }
    }

    // Fallback: Try reading from CLAUDE_INSTRUCTIONS.md
    const claudePath = join(rootDir, '.trees', branchName, 'CLAUDE_INSTRUCTIONS.md');
    if (existsSync(claudePath)) {
        try {
            const content = readFileSync(claudePath, 'utf8');
            const match = content.match(/\*\*Parent Branch\*\*:\s*`?(\S+?)`?(?:\s|$)/);
            if (match && match[1]) {
                return match[1];
            }
        } catch (error) {
            // Continue to next fallback
        }
    }

    return null;
}

function isRootBranch(branchName) {
    return ['main', 'master', 'staging', 'prod'].includes(branchName);
}

// Get branch name and options from arguments
const branchName = process.argv[2];
const updateFlag = process.argv.includes('--update');
const forceFlag = process.argv.includes('--force');
const noPushFlag = process.argv.includes('--no-push');

if (!branchName) {
    console.error(colorize('❌ Error: Please provide a branch name', 'red'));
    console.error('Usage: npm run worktree:merge <branch-name> -- [--update] [--force] [--no-push]');
    console.error('Note: The -- separator is required to pass flags through npm');
    console.error('');
    console.error('Flags:');
    console.error('  --update   Automatically rebase the branch before merging');
    console.error('  --force    Merge even if branch is outdated');
    console.error('  --no-push  Skip automatic push to origin after merge');
    console.error('');
    console.error('Examples:');
    console.error('  npm run worktree:merge feature-auth -- --update');
    console.error('  npm run worktree:merge feature-auth -- --no-push');
    process.exit(1);
}

console.log(colorize(`\n🔀 Merging worktree branch: ${branchName}`, 'cyan'));
console.log(colorize('='.repeat(50), 'cyan'));

(async () => {
try {
    // Check if branch exists
    const branchExists = execCommand(`git show-ref --verify refs/heads/${branchName}`, { ignoreError: true });
    if (!branchExists) {
        console.error(colorize(`❌ Error: Branch '${branchName}' does not exist`, 'red'));
        process.exit(1);
    }

    const currentBranch = getCurrentBranch();
    console.log(colorize(`📍 Current branch: ${currentBranch}`, 'blue'));
    console.log(colorize(`📦 Source branch: ${branchName}`, 'blue'));

    // Validate parent branch
    const expectedParent = detectExpectedParentBranch(branchName);

    if (expectedParent) {
        console.log(colorize(`🎯 Expected parent branch: ${expectedParent}`, 'blue'));

        if (currentBranch !== expectedParent) {
            console.error(colorize(`\n❌ Error: Branch mismatch detected!`, 'red'));
            console.error(colorize(`   Worktree '${branchName}' was created from '${expectedParent}'`, 'yellow'));
            console.error(colorize(`   But you're currently on '${currentBranch}'`, 'yellow'));
            console.error(colorize(`\n💡 To fix this, checkout the correct branch first:`, 'cyan'));
            console.error(`   git checkout ${expectedParent}`);
            console.error(`   npm run worktree:merge ${branchName}`);
            process.exit(1);
        }

        console.log(colorize('✅ Parent branch validated', 'green'));
    } else {
        // Could not detect parent branch - show warning based on current branch
        if (!isRootBranch(currentBranch)) {
            console.log(colorize(`\n⚠️  Warning: Could not detect parent branch for '${branchName}'`, 'yellow'));
            console.log(colorize(`   Currently on '${currentBranch}' which is not a common root branch`, 'yellow'));
            console.log(colorize(`   Common root branches: main, master, staging, prod`, 'cyan'));
            console.log(colorize(`\n   Press Ctrl+C to cancel, or press Enter to continue...`, 'yellow'));

            // Simple pause for user to read and decide
            const readline = await import('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            await new Promise(resolve => {
                rl.question('', () => {
                    rl.close();
                    resolve();
                });
            });
        } else {
            console.log(colorize(`⚠️  Parent branch not detected, but merging to '${currentBranch}'`, 'yellow'));
        }
    }

    // Check for uncommitted changes
    const status = execCommand('git status --porcelain');
    if (status) {
        console.error(colorize('\n❌ Error: You have uncommitted changes', 'red'));
        console.error('Please commit or stash your changes before merging');
        process.exit(1);
    }

    // Check if branch is up to date with current branch
    console.log(colorize('\n🔍 Checking branch status...', 'yellow'));

    // Note: We only work with local branches, no remote fetch needed
    // User manually pushes to remote when ready

    // Check how many commits behind the worktree branch is
    const commitsBehind = execCommand(`git rev-list --count ${branchName}..${currentBranch}`);
    const commitsAhead = execCommand(`git rev-list --count ${currentBranch}..${branchName}`);

    if (commitsBehind !== '0') {
        console.log(colorize(`\n⚠️  Branch '${branchName}' is ${commitsBehind} commits behind '${currentBranch}'`, 'yellow'));

        if (updateFlag) {
            console.log(colorize(`\n🔄 Updating branch '${branchName}' with latest from '${currentBranch}'...`, 'cyan'));

            // Calculate worktree path
            const worktreePath = join(rootDir, '.trees', branchName);
            let stashCreated = false;

            // Verify worktree directory exists
            if (!existsSync(worktreePath)) {
                console.error(colorize(`\n❌ Error: Worktree directory not found: ${worktreePath}`, 'red'));
                console.error(colorize('   The branch may not be in a worktree, or the worktree was removed.', 'yellow'));
                console.error(colorize('   You may need to:', 'yellow'));
                console.error(colorize('   1. git worktree prune (if worktree was manually deleted)', 'yellow'));
                console.error(colorize('   2. Or rebase manually without --update flag', 'yellow'));
                process.exit(1);
            }

            try {
                // Check if worktree branch has uncommitted changes
                // Use git -C to operate in the worktree directory where the branch is checked out
                const worktreeStatus = execCommand(`git -C "${worktreePath}" status --porcelain`);

                if (worktreeStatus) {
                    console.log(colorize('  ℹ️  Uncommitted changes detected - auto-stashing...', 'yellow'));
                    execCommand(`git -C "${worktreePath}" stash push -m "Auto-stash for worktree merge"`);
                    stashCreated = true;
                    console.log(colorize('  ✓ Changes stashed', 'gray'));
                }

                // Check if rebase is actually needed (branch might already be ancestor)
                const needsRebase = execCommand(`git merge-base --is-ancestor ${branchName} ${currentBranch}`, { ignoreError: true });

                if (needsRebase === null) {
                    // Branch is already an ancestor - no rebase needed
                    console.log(colorize('  ✓ Branch is already up-to-date with parent (no rebase needed)', 'gray'));
                } else {
                    // Rebase onto current branch (execute in worktree context)
                    console.log(colorize('  → Rebasing onto parent branch...', 'gray'));
                    const rebaseResult = execCommand(`git -C "${worktreePath}" rebase ${currentBranch}`, { ignoreError: true });

                    if (rebaseResult === null) {
                        console.error(colorize('\n❌ Rebase failed. Please resolve conflicts manually:', 'red'));
                        console.error(colorize(`  1. cd ${worktreePath}`, 'yellow'));
                        console.error(colorize('  2. Fix conflicts in the files', 'yellow'));
                        console.error(colorize('  3. git add <resolved-files>', 'yellow'));
                        console.error(colorize('  4. git rebase --continue', 'yellow'));
                        console.error(colorize('  5. cd back to root and re-run the merge command', 'yellow'));
                        execCommand(`git -C "${worktreePath}" rebase --abort`, { ignoreError: true });
                        if (stashCreated) {
                            execCommand(`git -C "${worktreePath}" stash pop`, { ignoreError: true });
                        }
                        process.exit(1);
                    }
                }

                // Pop stash if we created one
                if (stashCreated) {
                    console.log(colorize('  → Restoring stashed changes...', 'gray'));
                    const stashPopResult = execCommand(`git -C "${worktreePath}" stash pop`, { ignoreError: true });

                    if (stashPopResult === null) {
                        console.error(colorize('\n⚠️  Warning: Stash pop had conflicts', 'yellow'));
                        console.error(colorize('  Your changes are still in the stash.', 'yellow'));
                        console.error(colorize(`  To resolve: cd ${worktreePath} && git stash drop`, 'yellow'));
                    } else {
                        console.log(colorize('  ✓ Changes restored', 'gray'));
                    }
                }

                console.log(colorize('✅ Branch updated successfully', 'green'));
            } catch (error) {
                console.error(colorize('\n❌ Failed to update branch: ' + error.message, 'red'));
                if (stashCreated) {
                    console.log(colorize(`  ℹ️  Your changes are in the stash. To restore: cd ${worktreePath} && git stash pop`, 'yellow'));
                }
                process.exit(1);
            }
        } else if (!forceFlag) {
            console.log(colorize('\nOptions:', 'cyan'));
            console.log('  1. Run with --update flag to automatically rebase the branch');
            console.log('  2. Run with --force flag to merge anyway');
            console.log('  3. Manually update the branch:');
            console.log(`     git checkout ${branchName}`);
            console.log(`     git rebase ${currentBranch}`);
            console.log(`     git checkout ${currentBranch}`);
            console.log('     Then run the merge command again');
            process.exit(1);
        } else {
            console.log(colorize('⚠️  Proceeding with merge despite outdated branch (--force flag used)', 'yellow'));
        }
    } else if (commitsAhead !== '0') {
        console.log(colorize(`✅ Branch '${branchName}' is ${commitsAhead} commits ahead of '${currentBranch}'`, 'green'));
    } else {
        console.log(colorize(`✅ Branch '${branchName}' is up to date with '${currentBranch}'`, 'green'));
    }

    // Get list of files that will be affected
    console.log(colorize('\n📝 Analyzing changes...', 'yellow'));
    const modifiedFiles = getModifiedFiles(branchName, currentBranch);

    if (modifiedFiles.length === 0) {
        console.log(colorize('✅ No changes to merge', 'green'));
        process.exit(0);
    }

    // Categorize files
    const filesToMerge = [];
    const filesToSkip = [];
    const filesToPreserve = [];

    modifiedFiles.forEach(file => {
        if (isWorktreeSpecificFile(file)) {
            filesToSkip.push(file);
        } else if (shouldPreserveMainVersion(file)) {
            filesToPreserve.push(file);
        } else {
            filesToMerge.push(file);
        }
    });

    // Display categorized files
    if (filesToSkip.length > 0) {
        console.log(colorize('\n⏭️  Files to skip (worktree-specific):', 'yellow'));
        filesToSkip.forEach(file => console.log(`   - ${file}`));
    }

    if (filesToPreserve.length > 0) {
        console.log(colorize('\n🔒 Files to preserve (keep main branch version):', 'yellow'));
        filesToPreserve.forEach(file => console.log(`   - ${file}`));
    }

    if (filesToMerge.length > 0) {
        console.log(colorize('\n✅ Files to merge:', 'green'));
        filesToMerge.forEach(file => console.log(`   + ${file}`));
    }

    // Perform the merge
    console.log(colorize('\n🚀 Starting merge...', 'cyan'));

    // Save current state of files to preserve
    const preservedContent = {};
    filesToPreserve.forEach(file => {
        const filePath = join(rootDir, file);
        if (existsSync(filePath)) {
            preservedContent[file] = readFileSync(filePath, 'utf8');
        }
    });

    // Start merge with no-commit to handle conflicts
    console.log('Initiating git merge...');
    const mergeResult = execCommand(`git merge ${branchName} --no-commit --no-ff`, { ignoreError: true });

    // Check merge status
    const mergeStatus = execCommand('git status --porcelain');
    const hasConflicts = mergeStatus && mergeStatus.includes('UU ');

    if (hasConflicts) {
        console.log(colorize('\n⚠️  Merge conflicts detected', 'yellow'));

        // Auto-resolve conflicts for preserved files
        filesToPreserve.forEach(file => {
            if (mergeStatus.includes(`UU ${file}`)) {
                console.log(`   Resolving conflict for ${file} (keeping main branch version)...`);
                const filePath = join(rootDir, file);
                if (preservedContent[file]) {
                    writeFileSync(filePath, preservedContent[file]);
                    execCommand(`git add ${file}`);
                }
            }
        });

        // Reset worktree-specific files if they were added
        filesToSkip.forEach(file => {
            if (mergeStatus.includes(file)) {
                console.log(`   Removing worktree-specific file: ${file}`);
                execCommand(`git reset HEAD ${file}`, { ignoreError: true });
                execCommand(`git checkout HEAD -- ${file}`, { ignoreError: true });
            }
        });

        // Check if there are remaining conflicts
        const remainingStatus = execCommand('git status --porcelain');
        const remainingConflicts = remainingStatus && remainingStatus.includes('UU ');

        if (remainingConflicts) {
            console.log(colorize('\n❌ Manual conflict resolution required for:', 'red'));
            const conflictFiles = remainingStatus.split('\n')
                .filter(line => line.startsWith('UU '))
                .map(line => line.substring(3));
            conflictFiles.forEach(file => console.log(`   - ${file}`));
            console.log(colorize('\nResolve conflicts manually, then run:', 'yellow'));
            console.log('   git add <resolved-files>');
            console.log('   git commit');
            process.exit(1);
        }
    } else {
        // No conflicts, but still need to handle files

        // Restore preserved files
        filesToPreserve.forEach(file => {
            if (preservedContent[file]) {
                console.log(`   Restoring main branch version: ${file}`);
                const filePath = join(rootDir, file);
                writeFileSync(filePath, preservedContent[file]);
                execCommand(`git add ${file}`);
            }
        });

        // Remove worktree-specific files if they were added
        filesToSkip.forEach(file => {
            const filePath = join(rootDir, file);
            if (existsSync(filePath)) {
                console.log(`   Removing worktree-specific file: ${file}`);
                execCommand(`git reset HEAD ${file}`, { ignoreError: true });
                execCommand(`git checkout HEAD -- ${file}`, { ignoreError: true });
            }
        });
    }

    // Check if there are changes to commit
    const finalStatus = execCommand('git status --porcelain');
    if (!finalStatus) {
        console.log(colorize('\n✅ No changes to commit (all changes were worktree-specific)', 'green'));
        execCommand('git merge --abort', { ignoreError: true });
    } else {
        // Get the list of files that will be committed BEFORE committing
        const stagedFiles = execCommand('git diff --cached --name-only').split('\n').filter(f => f);

        // Commit the merge
        const commitMessage = `Merge branch '${branchName}' into ${currentBranch}\n\nExcluded worktree-specific files from merge`;
        execCommand(`git commit -m "${commitMessage}"`);

        console.log(colorize('\n✅ Merge completed successfully!', 'green'));

        // Show summary
        console.log(colorize('\n📊 Merge Summary:', 'cyan'));
        console.log(colorize('='.repeat(50), 'cyan'));

        console.log(`Files merged: ${colorize(stagedFiles.length.toString(), 'bright')}`);
        if (filesToSkip.length > 0) {
            console.log(`Files skipped (worktree-specific): ${colorize(filesToSkip.length.toString(), 'yellow')}`);
        }
        if (filesToPreserve.length > 0) {
            console.log(`Files preserved (main branch version): ${colorize(filesToPreserve.length.toString(), 'yellow')}`);
        }

        if (stagedFiles.length > 0) {
            console.log(colorize('\n📋 Merged files:', 'green'));
            stagedFiles.forEach(file => console.log(`   ✓ ${file}`));
        }

        // Show the merge commit
        const commitHash = execCommand('git rev-parse HEAD').substring(0, 7);
        console.log(colorize(`\n📍 Merge commit: ${commitHash}`, 'blue'));

        // Push to origin unless --no-push flag is set
        if (!noPushFlag) {
            console.log(colorize('\n📤 Pushing to origin...', 'cyan'));

            try {
                // Check if remote branch exists
                const remoteBranch = execCommand(`git rev-parse --verify origin/${currentBranch}`, { ignoreError: true });

                if (remoteBranch) {
                    // Push to existing remote branch
                    execCommand(`git push origin ${currentBranch}`);
                    console.log(colorize('✅ Successfully pushed to origin', 'green'));
                } else {
                    // Remote branch doesn't exist, push and set upstream
                    console.log(colorize(`⚠️  Remote branch 'origin/${currentBranch}' doesn't exist`, 'yellow'));
                    console.log('Setting upstream and pushing...');
                    execCommand(`git push -u origin ${currentBranch}`);
                    console.log(colorize('✅ Successfully pushed and set upstream', 'green'));
                }
            } catch (pushError) {
                console.error(colorize('\n⚠️  Warning: Failed to push to origin', 'yellow'));
                console.error(colorize(pushError.message, 'yellow'));
                console.log(colorize('\nMerge completed locally. You can manually push later with:', 'cyan'));
                console.log(colorize(`  git push origin ${currentBranch}`, 'bright'));
            }
        } else {
            console.log(colorize('\n⏭️  Skipping push to origin (--no-push flag used)', 'yellow'));
            console.log(colorize('Remember to push manually when ready:', 'cyan'));
            console.log(colorize(`  git push origin ${currentBranch}`, 'bright'));
        }
    }

} catch (error) {
    console.error(colorize('\n❌ Error during merge:', 'red'));
    console.error(error.message);

    // Try to abort merge if in progress
    execCommand('git merge --abort', { ignoreError: true });

    process.exit(1);
}
})();
