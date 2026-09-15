# Agent Context Manager (agctx)

**A profile-based context manager for AI coding agents.**

<!-- agctx-doc-sources: src/commands/registry.ts, src/project/plan.ts, src/i18n/messages-en.ts, package.json, docs/discussion/architecture/README.md, docs/discussion/architecture/topics -->
<!-- agctx-doc-sources-sha256: 1867af103c7951e94407053414cd89519ec17221eaec7462231cafbee21ea08e -->

[![CI](https://img.shields.io/github/actions/workflow/status/IsthisLee/agent-context-manager/ci.yml?branch=main&label=CI&logo=github)](https://github.com/IsthisLee/agent-context-manager/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/IsthisLee/agent-context-manager/codeql.yml?branch=main&label=CodeQL&logo=github)](https://github.com/IsthisLee/agent-context-manager/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/IsthisLee/agent-context-manager/badge)](https://securityscorecards.dev/viewer/?uri=github.com/IsthisLee/agent-context-manager)
[![npm](https://img.shields.io/npm/v/agent-context-manager?logo=npm&color=cb3837)](https://www.npmjs.com/package/agent-context-manager)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![last commit](https://img.shields.io/github/last-commit/IsthisLee/agent-context-manager)](https://github.com/IsthisLee/agent-context-manager/commits/main)
[![Supported agents](https://img.shields.io/badge/agents-Codex%20%C2%B7%20Claude%20Code%20%C2%B7%20Antigravity-6f42c1)](https://github.com/IsthisLee/agent-context-manager#supported-agents)

[한국어](README.md) · **English**

[The problem it solves](#the-problem-it-solves) · [Core goals](#core-goals) · [Use cases](#use-cases) · [Getting Started](#getting-started) · [Core features](#core-features) · [Supported agents](#supported-agents) · [Not supported](#not-supported) · [Architecture direction](#-architecture-direction-and-progress) · [Documentation](#documentation) · [Open-source participation](#open-source-participation)

## Different developers, different teams, different AI agents — one shared context.

> agctx creates and configures agent context as Profiles for individuals and organizations, manages them locally or through Git, and safely applies and synchronizes them across projects and multiple AI agents.
>
> Where agctx is headed: rules, skills, MCP, and subagents managed as Profiles — pick one per repository, and every agent follows the same setup and stays in sync.

> (⚙️ Today a Profile manages rules (`AGENTS.md`, `CLAUDE.md`, `.agents/rules`); the scope is expanding to skills, MCP, and subagents.)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/IsthisLee/agent-context-manager/main/docs/assets/agctx-overview.en.dark.png">
    <img src="https://raw.githubusercontent.com/IsthisLee/agent-context-manager/main/docs/assets/agctx-overview.en.png" alt="agctx structure: Personal, Company, and Team Profiles are applied and synced to many projects, and Codex, Claude Code, and Antigravity read the AGENTS.md, CLAUDE.md, and other files generated in each project. Team and organization Profiles are cloned, pulled, and pushed through a Git remote." width="880">
  </picture>
</p>

One flow — `profile create` → `profile setup` → `profile apply`/`profile sync`: build a **Profile** (the single source of truth for shared context), apply it to your **project files**, and **multiple AI agents** work to the same standard.

## The problem it solves

**Your working principles for TDD, verification, security, and documentation are already defined in CLAUDE.md. So why set the same thing up again every time you add a project or an AI tool?**

agctx manages those standards as a Profile and, when you apply it to a project, generates the files that compatible agents read, in a single pass. Change the standard in the Profile and sync it, so you never touch each project by hand again; each project's own domain rules and settings stay intact.

The same problem shows up beyond rules, in the skills, MCP server settings, and subagent definitions a team shares. agctx manages rules today and is extending the same Profile to cover them.

> Team and organization Profiles are shared through a Git remote. Members receive them with `profile clone` and `pull`, and CI runs `agctx check` to confirm that a repository reflects the latest Profile version. The steps are in the [Sharing with a team through Git (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/team-sharing.md) (Korean).

## Core goals

> Multiple agents and developers work and collaborate against the same shared context.
>
> Create and manage per-purpose Profiles (shared context stores such as Personal, Company, Team, and Workspace) and choose which to apply per project.

Reduce the working styles, rules, and verification standards that otherwise vary by developer and agent, keeping a consistent collaboration standard.

A Profile's shared context is managed as a single source of truth, while each project adds its own domain rules separately in its own `AGENTS.md`.

Individual developers can also split and reuse per-project `Personal` Profiles and keep the same context even when the AI tools they use change. This reduces repeated setup and rule drift between projects, making both maintenance and development easier.

> [!NOTE]
> agctx distributes a Profile's shared context to projects and multiple agents. It does not analyze a codebase to write project guidance automatically. [See why](#not-supported)

## Use cases

### Individual development

- **Use it this way:** Create Personal Profiles for different project types, configure their guidance through `profile setup`, and apply one to each project with `profile apply`.
- **Benefit:** Reuse the same development standard when switching AI tools or starting a new project.

### Team collaboration

- **Use it this way:** Share a team Profile in a Git repository; members run `profile clone` or `pull`, then apply it to their projects. Add `--pin` to stay on a reviewed commit.
- **Benefit:** Review and distribute shared-context updates through one history while reducing per-person configuration drift.

### Organization standards

- **Use it this way:** Manage organization-wide standards in a Git-backed Profile; teams and projects add their own domain rules in the project `AGENTS.md`.
- **Benefit:** Keep organization standards and project-specific requirements managed independently, without mixing them. CI runs `agctx check --refresh` to confirm each repository reflects the latest standard.

## Getting Started

> The full usage — from installation to synchronization — is documented step by step in the [quick start (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/getting-started/quick-start.md).

> Runtime: Node.js 22 LTS or newer

```bash
npm install -g agent-context-manager

agctx profile create company --scope company
agctx profile setup company --tdd recommended --security strict
agctx profile apply company /path/to/project
```

Applying creates the per-agent guidance files and the managed-area records in one pass. Below is the real output of the last command.

```text
$ agctx profile apply company /path/to/project
Plan: 8 file(s) to change.
  create    AGENTS.md
  create    CLAUDE.md
  create    .agents/rules/agctx.md
  create    .agctx/base/AGENTS.md.base
  create    .agctx/base/CLAUDE.md.base
  create    .agctx/base/.agents/rules/agctx.md.base
  create    .agctx/.gitignore
  create    agctx.project.json
Applied profile company to /path/to/project
```

> [!Tip]
> Type `agctx` in your terminal to use every feature through the TUI.
>
> Passing options directly is useful for automation or repeated runs.

Personal Profiles are stored under `~/.agctx/profiles/<name>`. A project's domain rules are added separately in the project's `AGENTS.md` after a Profile is applied.

agctx provides commands to create, set up, apply, synchronize, and share Profiles through Git, to check repositories, to check that agents receive the guidance, and to sync and open pull requests across many repositories. For detailed contracts and implementation records, see the [current architecture](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/contributing/architecture.md) and the [implementation plans](https://github.com/IsthisLee/agent-context-manager/tree/main/docs/discussion/architecture/).

### Hand it to an agent

Install the agent skills and you can hand agctx to an agent in plain language, such as "check that this repository's context is up to date". The skills make the agent show `--dry-run` output and ask for approval before any write command. The `agctx-author` skill for publishing Profiles and opening PRs is used only when you call it by name.

```bash
DISABLE_TELEMETRY=1 npx skills add IsthisLee/agent-context-manager --skill '*' -a claude-code -a codex -a antigravity
```

The skills CLI sends anonymous usage data; with `DISABLE_TELEMETRY=1` as above it sends none. Details are in the [Handing agctx to an agent (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/agent-skills.md).

### Scope of verification

Repository developers run `pnpm run check` to verify agctx's own types, documentation contracts, and CLI evaluations. It does not run the target project's tests or vouch for an agent's code quality. The target project's real verification is run by the agent using that project's own commands; a Profile only records the guidance that requires such verification.

## Core features

- `agctx profile create [<name>] [--scope <scope>]` — create a Profile for the `personal`, `company`, `team`, or `workspace` purpose; omit the name for TUI input.
- `agctx profile list [--scope <scope>]` — list, select, and manage Profiles by scope; in the TUI you choose the scope first.
- `agctx profile setup [<name>]` — after selecting a Profile by scope, configure harness behavior, TDD, change review, verification, documentation, and security guidance; omit everything for the full TUI.
- `agctx profile remove [<name>]` — delete the selected Profile after confirmation; files already applied to projects are kept.
- `agctx profile apply <name> <project> [--pin]` — apply the selected Profile to a project and record the Profile version; `--pin` keeps the project on that commit.
- `agctx profile sync <project>` — reapply only the managed areas from the Profile recorded for the project.
- `agctx profile resolve <project>` — move edits made inside a managed area outside it and regenerate the area; when the last applied version is unknown, `--discard` backs up and regenerates, and `--edit` opens a VS Code three-way merge.
- Generate and synchronize per-agent guidance files.
- `agctx profile clone|status|pull|push|connect` — share Profiles through a standard Git remote; project files are never touched, and incoming Profile content with hidden characters is refused.
- `agctx check [--refresh] <project>` — report managed-area conflicts, hidden characters, and a project behind its Profile through exit codes, without changing files (for CI).
- `agctx repos list|status|sync|pr` — check and sync every repository that uses a Profile at once, and update pinned repositories through one pull request each; a scheduled bot runs `repos pr --targets <file> --yes`.
- `agctx explain [<path>]` — show which instruction files Codex, Claude Code, and Antigravity read when started in a folder, and why; exits with 4 when a file reaches no agent.
- `agctx verify [--probe] [<path>]` — check from agent session logs that the instruction files actually arrived; `--probe` runs each agent once in a scratch copy after approval.
- Agent skills `agctx` and `agctx-author` — tell an agent the commands and approval rules when you hand agctx over in plain language.
- Monorepos and APM — create a `CLAUDE.md` link next to every nested `AGENTS.md` so Claude Code reads it, work alongside Microsoft APM's `managed_section` block, and stop instead of writing into files APM regenerates in its default mode.
- Every command — a `--json` result document, exit codes that separate behind, conflict, and hidden characters, `--yes` confirmation outside a terminal, and `agctx <command> --help`.
- `agctx config lang <ko|en>` — set the display and generation language; the default is English, can also be set with `--lang` / `AGCTX_LANG`, and is chosen once on the first interactive run and saved.

## Supported agents

Applying a Profile to a project generates and syncs the per-agent guidance files below. `AGENTS.md` is the shared standard that many agents read together.

| Agent | Generated file |
| --- | --- |
| Codex, etc. (AGENTS.md standard) | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Antigravity | `.agents/rules/agctx.md` |

Applying also records the managed areas as last written under `.agctx/base/`. Commit it, because it is the reference for resolving managed-area conflicts.

Whether an agent actually reads a file depends on the folder it starts in. Codex reads a subfolder `AGENTS.md` only when started in that folder, and Claude Code does not read an `AGENTS.md` that no `CLAUDE.md` imports. In a monorepo, agctx creates a `CLAUDE.md` link that imports `@AGENTS.md` next to every nested `AGENTS.md` and leaves any `CLAUDE.md` a person wrote alone. Check each folder with `agctx explain <folder>`.

## Not supported

**agctx does not analyze a codebase to write project guidance automatically.** agctx distributes a Profile's shared context to projects and to multiple agents. Project-specific guidance belongs to the project, and agctx does not write it on the project's behalf.

| Reason | Evidence |
| --- | --- |
| Each agent already provides it. | `/init` in Claude Code and Codex analyzes the codebase and drafts guidance. |
| Official guidance advises against that content. | Anthropic recommends leaving out anything the agent can figure out by reading code and file-by-file descriptions. Guidance should hold commands, conventions, decisions, and gotchas the agent cannot guess. It also warns that when guidance grows too long, important rules get lost and ignored. |
| The benefit is unproven. | In a study, agents followed the instructions in context files, yet task success rates did not generally improve and inference cost rose by over 20% on average. Repository overviews were not helpful. |
| It is outside agctx's scope. | Deep analysis needs model calls. agctx does not handle model calls or agent runtimes. |

Refine a `/init` draft by hand, then place it in the project extension area of `AGENTS.md`, because `AGENTS.md` is the standard that many agents read in common. If you keep it in `CLAUDE.md`, place it outside the agctx managed block. Editing inside a managed area makes the next `profile sync` stop with a conflict, and `profile resolve` then moves those edits outside the managed area. The decision and its sources are in [ADR 0006](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/adr/0006-no-codebase-analysis-guidance.md) and the [references](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/references.md).

## 🧭 Architecture direction and progress

agctx's implementation is managed in stages around where the shared context lives and who changes what. Each topic's goal, priority, contracts to settle before implementation, and implementation record live in a discussion document, and the [architecture discussion index](https://github.com/IsthisLee/agent-context-manager/tree/main/docs/discussion/architecture/) is the canonical list of topics and their status. The commands you can use today are listed under [Core features](#core-features).

- **Implemented:** Profile model and store, setup and guidance options, guidance level semantics, project application, agent artifact synchronization, agent rule discovery, Git-based Profile management
- **In progress:** use through natural-language requests (skills, `--json`, `explain`, and `verify` work; evaluating agent scenarios against the published package remains), safe synchronization of managed artifacts (managed-area hashes, dry-run, and conflict recovery work; recording per-file ownership and a policy for files without markers remain)
- **Proposed:** Profile configuration surface expansion (MCP, skills, subagents), scope expansion and guidance composition, evidence criteria and length budget for default guidance, automated documentation accuracy review. These are not current behavior yet.

## Documentation

- [Documentation index](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md): usage flow and full table of contents (Korean)
- [Quick start](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/getting-started/quick-start.md)
- [Guides by situation](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md#목적별-가이드)
- [CLI Reference](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/reference/cli.md)
- [Product direction](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/contributing/product-direction.md)
- [Contributor docs](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md#기여자-문서)
- [Architecture implementation plans](https://github.com/IsthisLee/agent-context-manager/tree/main/docs/discussion/architecture/)
- [External references](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/references.md)

## Open-source participation

- [Contributing guide](https://github.com/IsthisLee/agent-context-manager/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/IsthisLee/agent-context-manager/blob/main/SECURITY.md)
- [Code of conduct](https://github.com/IsthisLee/agent-context-manager/blob/main/CODE_OF_CONDUCT.md)
- [Report an issue](https://github.com/IsthisLee/agent-context-manager/issues)

---

[Apache License 2.0](LICENSE) · Built with Codex, Claude Code, and Antigravity.
