---
name: agctx
description: Diagnose and update the agent guidance that agctx (Agent Context Manager) manages. Use when Codex, Claude Code, or Antigravity seems to ignore AGENTS.md, CLAUDE.md, or .agents/rules in a repository, when asked which rules apply to a folder, or when asked to bring a repository up to date with a new version of its agctx profile.
---

# agctx

agctx keeps one profile of agent guidance per repository in sync and checks that Codex, Claude Code, and Antigravity receive it. Run it as `agctx`. When it is not installed, run `npx agent-context-manager` with the same arguments.

## Pick the command

- "Why does the agent ignore the rules in this folder?" Run `agctx explain <folder> --json` to see which files each agent reads when started there, then `agctx verify <folder> --json` to check the agents' session logs.
- "Is this repository on the latest team rules?" Run `agctx check --refresh --json`.
- "Apply the new version of the team rules here." Run `agctx profile pull <profile>`, then `agctx profile sync --dry-run`, show the plan, and run `agctx profile sync --yes` only after the user approves it.
- "Which of my repositories are behind?" Run `agctx repos status --json`.

## Safety rules

- Commands that only read (`explain`, `verify` without `--probe`, `check`, `profile status`, `repos status`, `repos list`) need no approval.
- Before a command that writes files or sends anything to a remote, run it with `--dry-run`, show the result to the user, and add `--yes` only after the user approves in this conversation. Never add `--yes` on your own.
- `agctx verify --probe` runs agent CLIs and can use the user's plan or API credits. Ask before running it.
- Read `--json` output and exit codes instead of parsing text: 0 ok, 1 behind, 2 managed area conflict, 3 hidden characters, 4 an instruction file does not reach an agent, 64 usage error, 69 an external tool or the network is unavailable.
- Do not edit agctx managed areas: the block between `<!-- agctx:managed:start -->` and `<!-- agctx:managed:end -->`, and the profile part of `AGENTS.md` above the project rule extensions section. Put project rules in the extension section. If a managed area was edited, run `agctx profile resolve --dry-run` and ask the user how to resolve it.

## Commands

<!-- agctx:commands:start -->
- `agctx profile create [--scope <scope>] [<name>]`: Create a profile with an initial AGENTS.md.
- `agctx profile list [--scope <scope>]`: List profiles by scope and manage one.
- `agctx profile view <name>`: Print a profile's scope and AGENTS.md.
- `agctx profile setup [--workflow <level>] [--tdd <level>] [--review <level>] [--verification <level>] [--instructions <level>] [--security <level>] [<name>]`: Choose the guidance levels written into a profile.
- `agctx profile apply [--dry-run] [--pin] [--yes] <name> [<project>]`: Apply a profile to a project: create the agent files and record the profile version. --pin keeps the project on the current commit until you apply again.
- `agctx profile sync [--dry-run] [--yes] [<project>]`: Re-apply the profile a project already uses. A pinned project stays on its recorded commit.
- `agctx profile resolve [--dry-run] [--discard] [--edit] [--yes] [<project>]`: Move edits made inside managed areas outside them and regenerate the areas.
- `agctx profile remove [--yes] [<name>]`: Delete a profile. Files already applied to projects stay.
- `agctx profile clone [--branch <branch>] <git-url>`: Clone a profile from a Git repository after checking its files and hidden characters.
- `agctx profile status [--refresh] [<name>]`: Show a profile's remote, branch, commit, local edits, and position against the remote. --refresh fetches first.
- `agctx profile pull [--dry-run] <name>`: Fast-forward a profile to its remote. Repository files do not change.
- `agctx profile push [--dry-run] [--yes] <name>`: Push commits you already made to the profile's remote.
- `agctx profile connect [--branch <branch>] <name> <git-url>`: Connect a profile that is already a Git repository to a remote. It does not commit or push.
- `agctx check [--refresh] [<project>]`: Check that a project matches its recorded profile version: 0 matches, 1 behind, 2 managed area edited, 3 hidden characters. --refresh compares with the source repository.
- `agctx explain [--agent <codex|claude|antigravity|all>] [<path>]`: Show which instruction files Codex, Claude Code, and Antigravity read when started in a folder, and exit with 4 when a file never reaches an agent.
- `agctx verify [--agent <codex|claude|antigravity|all>] [--probe] [--yes] [<path>]`: Check that Codex, Claude Code, and Antigravity actually received the project instruction files explain expects, from their session logs or with --probe, and exit with 4 when a file did not arrive.
- `agctx repos list [--profile <name>] [--prune]`: List the repositories this machine applied profiles to. --prune forgets folders that no longer exist.
- `agctx repos status [--profile <name>] [--refresh]`: Check every listed repository and report ok, behind, conflict, or hidden characters. --refresh also asks each source repository for its newest commit.
- `agctx repos sync [--profile <name>] [--dry-run] [--yes]`: Sync every listed repository that is not pinned, after showing what would change. Repositories with uncommitted changes to managed files are skipped.
- `agctx repos pr [--profile <name>] [--targets <file>] [--base <branch>] [--draft] [--message <text>] [--dry-run] [--yes]`: For each repository whose profile moved, commit the update on a new branch in a temporary worktree, push it, and open a pull request with gh. --targets reads paths or clone URLs from a file.
- `agctx config lang <en|ko>`: Save the display and generation language.
<!-- agctx:commands:end -->

Run `agctx <command> --help` for the options and exit codes of one command.
