# Claude Code Configuration

This directory contains Claude Code skills and configuration for your project.

## What are Skills?

Skills are specialized knowledge files that help Claude Code understand your project's workflows, deployment processes, and operational procedures. They're written in Markdown and automatically loaded when Claude Code works in your project.

## Available Skills

### `skills/devops.md`

Deployment operations skill providing:
- **Project Discovery**: Automatically find GitHub Actions workflows and CloudFormation templates
- **Git Workflows**: Proper rebase-before-commit procedures for worktrees
- **AWS CloudFormation**: Deploy, monitor, and troubleshoot infrastructure stacks
- **GitHub Actions**: Monitor workflow executions and check deployment logs
- **AWS CodePipeline**: Check pipeline status and stage-specific logs
- **Safety Rules**: Never force-push, always check logs, validate templates

The DevOps skill follows a discovery-first approach: find what exists in your project, then provide context-specific deployment guidance.

## How Skills Work

Claude Code automatically:
1. Reads skill files from `.claude/skills/` when working in your project
2. Uses the guidance to follow correct workflows and procedures
3. References actual project files, commands, and configurations
4. Enforces safety rules and best practices

You don't need to manually invoke skills - they're contextually applied based on what you're working on.

## Customizing Skills

Skills use template variables that are replaced during installation:

- `{{PROJECT_NAME}}` - Your project name
- `{{GITHUB_USERNAME}}` - GitHub organization or username
- `{{REPOSITORY_NAME}}` - Repository name
- `{{BRANCH_NAME}}` - Current branch (dynamic)
- `{{PARENT_BRANCH}}` - Parent branch for worktree (dynamic)

## Adding Custom Skills

You can add your own skills to the `.claude/skills/` directory:

1. Create a new `.md` file (e.g., `testing.md`, `monitoring.md`)
2. Write Markdown content with guidance, commands, examples
3. Use code blocks for commands and scripts
4. Reference actual project files and paths
5. Include safety rules and best practices

**Example skill structure:**
```markdown
# Skill Name

Brief description of what this skill provides.

## When to Use This Skill

Explain when this skill applies.

## Commands

\```bash
# Actual commands with explanations
command --flag value
\```

## Best Practices

- Practice 1
- Practice 2

## Related Documentation

- Link to relevant docs
```

## Skills vs Commands

- **Skills** (`.claude/skills/*.md`): Background knowledge that Claude Code uses automatically
- **Commands** (`.claude/commands/*.md`): Explicit slash commands you invoke manually (e.g., `/deploy`)

Skills provide ongoing context, while commands are task-specific prompts.

## Directory Structure

```
.claude/
├── skills/              # Skill files (auto-loaded)
│   ├── devops.md       # Deployment operations
│   └── custom.md       # Your custom skills
├── commands/            # Slash commands (manually invoked)
│   └── deploy.md       # /deploy command
└── README.md           # This file
```

## Best Practices

1. **Keep skills focused**: One skill per domain (devops, testing, etc.)
2. **Use concrete examples**: Actual commands, not generic descriptions
3. **Reference project files**: Link to real paths and configurations
4. **Include safety rules**: Clear dos and don'ts
5. **Update regularly**: Keep skills in sync with your project

## Learning More

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Worktree Workflow Guide](../docs/worktrees/WORKTREES.md)
- [Git Workflow Best Practices](../docs/worktrees/GIT_WORKFLOW.md)

---

**Note**: The `.claude/` directory is typically gitignored or project-specific. Skills are copied to each worktree so Claude Code has context regardless of where you're working.
