---
name: agctx-author
description: Create, change, and roll out an agctx profile. Make a new profile, choose the guidance it carries, apply it to a repository, connect it to Git and pull or push it, clean up a managed-area conflict, and open pull requests in the repositories that use it. Use only when the user explicitly asks for one of these.
disable-model-invocation: true
---

# agctx-author

This skill changes what many repositories and teammates receive, so every push and every pull request needs the user's approval in this conversation. Run agctx as `agctx`, or as `npx agent-context-manager` when it is not installed.

## Pick the command

Every command in this section writes files, changes the profile store, or contacts a remote. Run each one with `--dry-run` first where it takes one, show the result, and add `--yes` only after the user approves in this conversation.

- "Make me a context profile." Run `agctx profile create <name> --scope <scope>`, then ask the user which of the ten guidance items to turn on and run `agctx profile setup <name> --<item> on|off`. Do not choose the items yourself.
- "Use this profile in this repository." Run `agctx profile apply <profile> <project> --dry-run`, show the plan, then `--yes`. Add `--pin` when the user wants the repository to stay on the current profile commit.
- "Bring this repository up to the new rules." Run `agctx profile pull <profile>` when the profile is behind, then `agctx profile sync <project> --dry-run` and `--yes`.
- "Someone edited the managed area." Run `agctx profile resolve <project> --dry-run` and ask the user how to resolve it. `--discard` throws the edits away after a backup; `--edit` opens a merge.
- "Get the team profile onto this computer." Run `agctx profile clone <git-url>`. To put an existing local profile on a remote, run `agctx profile connect <profile> <git-url>`.
- "Publish my profile change." Follow the steps below: `agctx profile push <profile>`.
- "Roll the change out to every repository." Run `agctx repos list` to see what is registered, then `agctx repos sync --profile <profile>` for repositories that are not pinned and `agctx repos pr --profile <profile>` for the rest.

## Steps

1. Confirm the profile and the change with the user. Check its state with `agctx profile view <profile>` and `agctx profile status <profile> --refresh`. If the profile is behind its remote, run `agctx profile pull <profile>` first.
2. Change the guidance. Use `agctx profile setup <profile> --<item> <level>` for the built-in items, or edit `AGENTS.md` in the profile folder outside the `agctx:guidance` block.
3. Show `git -C <profile folder> diff` to the user. Commit with `git -C <profile folder> commit` only after the user approves the diff and the commit message. agctx never commits for you.
4. Run `agctx profile push <profile> --dry-run`, show the commits, and run `agctx profile push <profile> --yes` after the user approves.
5. Roll out. Run `agctx repos status --profile <profile>` to see which repositories are behind. For pinned repositories run `agctx repos pr --profile <profile> --dry-run`, show the branches, and run it with `--yes` after the user approves. For repositories that are not pinned, the user may prefer `agctx repos sync --profile <profile> --dry-run` and then `--yes`.

## Safety rules

- Never add `--yes` without the user's approval of the exact dry-run output shown just before.
- Do not force-push, rewrite the profile repository's history, or delete remote branches.
- If `profile push` stops because the profile is behind or has uncommitted changes, report it and ask; do not resolve it by resetting.
- `repos pr` works in temporary worktrees and does not change the user's working copies. Tell the user which repositories got a pull request and which only got a pushed branch.

## Commands

<!-- agctx:commands:start -->
- `agctx profile create [--scope <scope>] [<name>]`: Create a profile with an initial AGENTS.md.
- `agctx profile list [--scope <scope>]`: List profiles by scope and manage one.
- `agctx profile view <name>`: Print a profile's scope and AGENTS.md.
- `agctx profile setup [--workflow <on|off>] [--context <on|off>] [--tdd <on|off>] [--review <on|off>] [--verification <on|off>] [--instructions <on|off>] [--docs <on|off>] [--security <on|off>] [--untrusted <on|off>] [--language <on|off>] [<name>]`: Choose the guidance levels written into a profile.
- `agctx profile apply [--dry-run] [--pin] [--yes] <name> [<project>]`: Apply a profile to a project: create the agent files and record the profile version. --pin keeps the project on the current commit until you apply again.
- `agctx profile sync [--dry-run] [--yes] [<project>]`: Re-apply the profile a project already uses. A pinned project stays on its recorded commit.
- `agctx profile resolve [--dry-run] [--discard] [--edit] [--yes] [<project>]`: Move edits made inside managed areas outside them and regenerate the areas.
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
<!-- agctx:commands:end -->

Run `agctx <command> --help` for the options and exit codes of one command.
