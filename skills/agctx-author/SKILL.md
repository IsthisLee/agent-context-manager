---
name: agctx-author
description: Change a shared agctx profile and roll it out. Edit profile guidance, commit and push it to the team's profile repository, and open pull requests in the repositories that use it. Use only when the user explicitly asks to publish or roll out a profile change.
disable-model-invocation: true
---

# agctx-author

This skill changes what many repositories and teammates receive, so every push and every pull request needs the user's approval in this conversation. Run agctx as `agctx`, or as `npx agent-context-manager` when it is not installed.

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
- `agctx profile view <name>`: Print a profile's scope and AGENTS.md.
- `agctx profile setup [--workflow <on|off>] [--context <on|off>] [--tdd <on|off>] [--review <on|off>] [--verification <on|off>] [--instructions <on|off>] [--docs <on|off>] [--security <on|off>] [--untrusted <on|off>] [--language <on|off>] [<name>]`: Choose the guidance levels written into a profile.
- `agctx profile status [--refresh] [<name>]`: Show a profile's remote, branch, commit, local edits, and position against the remote. --refresh fetches first.
- `agctx profile pull [--dry-run] <name>`: Fast-forward a profile to its remote. Repository files do not change.
- `agctx profile push [--dry-run] [--yes] <name>`: Push commits you already made to the profile's remote.
- `agctx check [--refresh] [<project>]`: Check that a project matches its recorded profile version: 0 matches, 1 behind, 2 managed area edited, 3 hidden characters. --refresh compares with the source repository.
- `agctx repos status [--profile <name>] [--refresh]`: Check every listed repository and report ok, behind, conflict, or hidden characters. --refresh also asks each source repository for its newest commit.
- `agctx repos sync [--profile <name>] [--dry-run] [--yes]`: Sync every listed repository that is not pinned, after showing what would change. Repositories with uncommitted changes to managed files are skipped.
- `agctx repos pr [--profile <name>] [--targets <file>] [--base <branch>] [--draft] [--message <text>] [--dry-run] [--yes]`: For each repository whose profile moved, commit the update on a new branch in a temporary worktree, push it, and open a pull request with gh. --targets reads paths or clone URLs from a file.
<!-- agctx:commands:end -->

Run `agctx <command> --help` for the options and exit codes of one command.
