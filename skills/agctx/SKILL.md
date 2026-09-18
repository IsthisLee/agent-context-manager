---
name: agctx
description: Read and diagnose the agent guidance that agctx (Agent Context Manager) manages. Use when Codex, Claude Code, or Antigravity seems to ignore AGENTS.md, CLAUDE.md, or .agents/rules in a repository, when asked which rules apply to a folder, whether a repository is on the latest shared rules, which repositories are behind, what a profile holds, or where a profile stands against its Git remote. To change a profile or roll one out, use the agctx-author skill instead.
---

# agctx

agctx keeps one profile of agent guidance per repository in sync and checks that Codex, Claude Code, and Antigravity receive it. Run it as `agctx`. When it is not installed, run `npx agent-context-manager` with the same arguments.

## Pick the command

Every command here only reads. Nothing in this skill writes a file or contacts a remote except the fetch that `--refresh` performs.

- "Why does the agent ignore the rules in this folder?" Run `agctx explain <folder> --json` to see which files each agent reads when started there, then `agctx verify <folder> --json` to check the agents' session logs.
- "Is this repository on the latest team rules?" Run `agctx check --refresh --json`.
- "Which of my repositories are behind?" Run `agctx repos status --json`.
- "Which profiles do I have?" Run `agctx profile list --json`.
- "What does this profile actually tell the agents?" Run `agctx profile view <profile>`.
- "Is my copy of the team profile up to date?" Run `agctx profile status <profile> --refresh --json`.

To change a profile, apply one to a repository, or open pull requests, tell the user to ask for the **agctx-author** skill by name. This skill does not run those commands.

## Safety rules

- Every command in this skill only reads, so none of them needs approval.
- Do not run a command this skill does not list. Writing commands live in the **agctx-author** skill, which the user invokes by name.
- `agctx verify --probe` runs agent CLIs and can use the user's plan or API credits. Ask before running it.
- Read `--json` output and exit codes instead of parsing text: 0 ok, 1 behind, 2 managed area conflict, 3 hidden characters, 4 an instruction file does not reach an agent, 64 usage error, 69 an external tool or the network is unavailable.
- Do not edit agctx managed areas: the block between `<!-- agctx:managed:start -->` and `<!-- agctx:managed:end -->`, and the profile part of `AGENTS.md` above the project rule extensions section. Put project rules in the extension section. If a managed area was edited, `check` reports exit code 2. Say so and tell the user that resolving it needs the **agctx-author** skill; do not resolve it from here.

## Commands

<!-- agctx:commands:start -->
- `agctx profile list [--scope <scope>]`: List profiles by scope and manage one.
- `agctx profile view <name>`: Print a profile's scope and AGENTS.md.
- `agctx profile status [--refresh] [<name>]`: Show a profile's remote, branch, commit, local edits, and position against the remote. --refresh fetches first.
- `agctx check [--refresh] [<project>]`: Check that a project matches its recorded profile version: 0 matches, 1 behind, 2 managed area edited, 3 hidden characters. --refresh compares with the source repository.
- `agctx explain [--agent <codex|claude|antigravity|all>] [<path>]`: Show which instruction files Codex, Claude Code, and Antigravity read when started in a folder, and exit with 4 when a file never reaches an agent.
- `agctx verify [--agent <codex|claude|antigravity|all>] [--probe] [--yes] [<path>]`: Check that Codex, Claude Code, and Antigravity actually received the project instruction files explain expects, from their session logs or with --probe, and exit with 4 when a file did not arrive.
- `agctx repos status [--profile <name>] [--refresh]`: Check every listed repository and report ok, behind, conflict, or hidden characters. --refresh also asks each source repository for its newest commit.
<!-- agctx:commands:end -->

Run `agctx <command> --help` for the options and exit codes of one command.
