# Agent Context Manager (agctx)

<!-- agctx-doc-sources: README.md -->
<!-- agctx-doc-sources-sha256: 201aab85a35ad140ac3c19d7bf1648e77b73afa2632fc9beef25aaad212eec0a -->

[![CI](https://img.shields.io/github/actions/workflow/status/IsthisLee/agent-context-manager/ci.yml?branch=main&label=CI&logo=github)](https://github.com/IsthisLee/agent-context-manager/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/IsthisLee/agent-context-manager/codeql.yml?branch=main&label=CodeQL&logo=github)](https://github.com/IsthisLee/agent-context-manager/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/agent-context-manager?logo=npm&color=cb3837)](https://www.npmjs.com/package/agent-context-manager)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![Supported agents](https://img.shields.io/badge/agents-Codex%20%C2%B7%20Claude%20Code%20%C2%B7%20Antigravity-6f42c1)](https://github.com/IsthisLee/agent-context-manager#supported-agents)

[Core goals](#core-goals) · [Use cases](#use-cases) · [Guides by situation](#guides-by-situation) · [Getting Started](#getting-started) · [Core features](#core-features) · [Supported agents](#supported-agents) · [Not supported](#not-supported) · [Architecture direction](#architecture-direction-and-progress) · [Documentation](#documentation) · [Open-source participation](#open-source-participation)

Read in: **English** · [한국어](README.md)

<p align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/IsthisLee/agent-context-manager/main/docs/assets/agctx-overview.en.dark.png">
    <img src="https://raw.githubusercontent.com/IsthisLee/agent-context-manager/main/docs/assets/agctx-overview.en.png" alt="agctx structure: Personal, Company, and Team Profiles are applied and synced to many projects, and Codex, Claude Code, and Antigravity read the AGENTS.md, CLAUDE.md, and other files generated in each project. Team and organization Profiles are cloned, pulled, and pushed through a Git remote." width="880">
  </picture>

</p>

**Your working principles for TDD, security, documentation, skills, and MCP are already defined in CLAUDE.md. So why set the same thing up again every time you add a project or an AI tool?**

agctx manages those standards as a Profile. Applying the Profile to a project creates the instruction files that Codex, Claude Code, and Antigravity read, in one pass. After you change the standard in the Profile and sync, you do not edit each project's files again, and each project's own domain rules stay intact. It is one flow: `profile create` → `profile setup` → `profile apply`/`profile sync`.

- 👥 Personal, Team & Company Profiles
- 🧩 Rules, Skills, MCP, Subagents & Hooks in One Profile (beyond rules: planned)
- 📋 Choose Recommended Guidance: TDD, Verification, Security & More
- 🎯 Pick a Profile and Agents per Repository (agent selection: planned)
- 🔄 One-Step Sync
- 🛡️ Project-Specific Guidance Stays Intact
- 🌿 Git Sharing, CI Checks & Multi-Repo PRs

> ⚙️ Today a Profile manages rules (`AGENTS.md`, `CLAUDE.md`, `.agents/rules`). The same problem shows up in the skills, MCP server settings, subagent definitions, and hooks a team shares. The scope is expanding to cover those in one Profile too.

## Core goals

> agctx creates and configures agent context as Profiles for individuals and organizations, manages them locally or through Git, and safely applies and synchronizes them across projects and multiple AI agents.

Guidance lives in two places. What many projects follow goes in the Profile and is edited only there. What only one project needs is written directly in that project's `AGENTS.md`. When you sync, agctx regenerates only the part that came from the Profile and leaves what you wrote in the project untouched.

> [!NOTE]
> agctx distributes a Profile's shared context to projects and multiple agents. It does not analyze a codebase to write project guidance automatically. [See why](#not-supported)

## Use cases

| Who | How you use it | What you get |
| --- | --- | --- |
| An individual developer | Create `Personal` Profiles for different project types and apply one to each repository with `profile apply`. | Reuse the same development standard when you switch AI tools or start a new project. |
| A team | Share a team Profile in a Git repository; the person who applies it runs `profile clone` or `pull`, applies it to the team's repositories, and commits the result. Add `--pin` to stay on a reviewed commit. | Review and distribute shared-context updates through one history, so per-person configuration drift goes away. Roles and steps are in [Sharing with a team through Git (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/team-sharing.md#누가-무엇을-하나). |
| An organization | Manage organization-wide standards in a Git-backed Profile; teams and projects add only their domain rules to the project `AGENTS.md`. | Keep organization standards and project-specific requirements separate. CI runs `agctx check --refresh` to confirm each repository reflects the latest standard. |

Other teammates only pull the repository and do not need agctx. Their agents read the committed instruction files as they are.

## Guides by situation

Pick the guide that fits your situation. The same list is in the [documentation index (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/README.md#목적별-가이드).

| Situation                                                  | Guide                                                                                                                                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Using menus instead of commands                            | [Using the TUI (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/tui.md)                                                        |
| Handing agctx to an agent                                  | [Handing agctx to an agent (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/agent-skills.md)                                   |
| Several repositories of different kinds, several computers | [Splitting Profiles across different repositories (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/multi-repo-individual.md)   |
| Several clients                                            | [Keeping each client's rules separate (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/multi-client.md)                        |
| Sharing a team Profile                                     | [Sharing with a team through Git (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/team-sharing.md)                             |
| Monorepo                                                   | [Using agctx in a monorepo (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/monorepo.md)                                       |
| Pinning and the scheduled bot                              | [Choosing an update policy: pinning and the scheduled bot (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/update-policies.md) |
| CI and scripts                                             | [Using agctx in CI and automation (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/ci.md)                                      |
| With Microsoft APM                                         | [Using agctx with APM (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/apm-coexistence.md)                                     |

## Getting Started

<!-- agctx-doc-sources: package.json -->
<!-- agctx-doc-sources-sha256: 8acfdb81ac78095841f4ccb59e9abcabea0d230e82f08d9cbd5fb7c22c74c2f5 -->

> Runtime: Node.js 22 LTS or newer

```bash
npm install -g agent-context-manager

agctx profile create company --scope company
agctx profile setup company --tdd on --security on
agctx profile apply company /path/to/project
```

Applying creates the per-agent guidance files, plus record files that keep the applied Profile version and the last applied copy (`agctx.project.json`, `.agctx/base/`), in one pass. Below is the real output of the last command.

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
> Type `agctx` in your terminal to run every command from TUI menus without memorizing commands: create, configure, apply, sync, and share Profiles over Git, check a project, and work on many repositories at once.
>
> Passing options directly is useful for automation or repeated runs.

Profiles are stored in the `~/.agctx/profiles/<name>` folder on this machine. After applying, write a project's domain rules below the `Project rule extensions` section of the project `AGENTS.md`. The shared guidance above it is regenerated by agctx when you sync.

Step-by-step installation through the first apply is in the [quick start (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/getting-started/quick-start.md).

### Hand it to an agent (optional)

Up to here a person ran the commands. Install the agent skills and you can hand the rest to an agent in plain language, such as "check that this repository's context is up to date": the agent runs `agctx check` and explains the result. The skills make the agent show `--dry-run` output and ask for approval before any write command. The `agctx-author` skill for publishing Profiles and opening PRs is used only when you call it by name.

```bash
npx skills add IsthisLee/agent-context-manager -g -a claude-code -a codex -a antigravity
```

Details are in the [Handing agctx to an agent (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/agent-skills.md).

## Core features

<!-- agctx-doc-sources: src/commands/registry.ts, src/i18n/messages-en.ts -->
<!-- agctx-doc-sources-sha256: 3d946f3e4edae91d6ffa2e187e19fdbb289cfb45f259129e36350cb32ac0080f -->

- **Create and configure Profiles** — `profile create`, `list`, `setup`, `remove`. Scopes are `personal`, `company`, `team`, and `workspace`, and `setup` turns ten items `on` or `off`: workflow, context management, TDD, change review, verification, instruction files, documentation, security, untrusted input, and response language. The sentence each item writes, and its evidence, are in the [guidance catalog (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/reference/guidance-catalog.md).
- **Apply and sync** — `profile apply`, `sync`, `resolve`. Applying records the Profile version, and `--pin` keeps the project on that commit. When an edit inside a managed area causes a conflict, `resolve` moves that edit outside the managed area.
- **Share through Git** — `profile clone`, `status`, `pull`, `push`, `connect`. They use a standard Git remote, never touch project files, and stop when incoming Profile content carries hidden characters. Link a rules repository you already have with `profile link` in its folder, no commit needed, and share it by committing the `profile.json` it writes ([use an existing repository as a Profile](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/guides/team-sharing.md#기존-저장소를-프로필로-쓰기)).
- **Check a repository** — `check` changes no files and reports through exit codes whether anything was edited inside the profile-owned area, whether hidden characters exist, and whether the project is behind its recorded Profile version. `--refresh` also compares with the latest commit on the remote.
- **Many repositories** — `repos list`, `status`, `sync`, `pr` handle every repository that uses a Profile at once, and pinned repositories are updated through one pull request each. A scheduled bot runs `repos pr --targets <file> --yes`.
- **Confirm delivery** — `explain` shows which instruction files an agent reads when started in a folder, and why, and exits with 4 when any checked agent misses one. `verify` confirms from session logs that they actually arrived, and `--probe` runs each agent once in a scratch copy after approval.
- **Monorepos and APM** — a `CLAUDE.md` link file is created next to every nested `AGENTS.md` so Claude Code reads it, and agctx works alongside Microsoft APM's `managed_section` block. It stops instead of writing into files APM regenerates in its default mode.
- **Contracts shared by every command** — a `--json` result document, exit codes that separate behind, conflict, and hidden characters, and `agctx <command> --help`. Commands that change files cannot ask for confirmation outside a terminal, so they run only with `--yes`. The display and generation language is set with `config lang <ko|en>`.

Options, exit codes, and usage for each command are in the [CLI Reference](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/reference/cli.md).

### Scope of verification

Repository developers run `pnpm run check` to verify agctx's own types, documentation contracts, and CLI evaluations. It does not run the target project's tests or vouch for an agent's code quality. The target project's real verification is run by the agent using that project's own commands; a Profile only records the guidance that requires such verification.

## Supported agents

<!-- agctx-doc-sources: src/project/plan.ts -->
<!-- agctx-doc-sources-sha256: 3c6265720e35c65ee2a634d928f858a6d9bf87d6027f1f3a7e9fd1710d0bf5bf -->

Applying a Profile to a project generates and syncs the per-agent guidance files below. `AGENTS.md` is the shared standard that many agents read together.

| Agent                            | Generated file           |
| -------------------------------- | ------------------------ |
| Codex, etc. (AGENTS.md standard) | `AGENTS.md`              |
| Claude Code                      | `CLAUDE.md`              |
| Antigravity                      | `.agents/rules/agctx.md` |

Applying also records the managed areas as last written under `.agctx/base/`. Commit it, because it is the reference for resolving managed-area conflicts.

Whether an agent actually reads a file depends on the folder it starts in. Codex reads a subfolder `AGENTS.md` only when started in that folder. Claude Code reads `AGENTS.md` directly only when no `CLAUDE.md` file sits in the start folder or above it; when one does, it reads only the `AGENTS.md` that file imports. In a monorepo, agctx creates a `CLAUDE.md` link that imports `@AGENTS.md` next to every nested `AGENTS.md` and leaves any `CLAUDE.md` a person wrote alone. Check each folder with `agctx explain <folder>`.

## Not supported

**agctx does not analyze a codebase to write project guidance automatically.** agctx distributes a Profile's shared context to projects and to multiple agents. Project-specific guidance belongs to the project, and agctx does not write it on the project's behalf.

| Reason                                          | Evidence                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each agent already provides it.                 | `/init` in Claude Code and Codex analyzes the codebase and drafts guidance.                                                                                                                                                                                                                         |
| Official guidance advises against that content. | Anthropic recommends leaving out anything the agent can figure out by reading code and file-by-file descriptions. Guidance should hold commands, conventions, decisions, and gotchas the agent cannot guess. It also warns that when guidance grows too long, important rules get lost and ignored. |
| The benefit is unproven.                        | In a study, agents followed the instructions in context files, yet task success rates did not generally improve and inference cost rose by over 20% on average. Repository overviews were not helpful.                                                                                              |
| It is outside agctx's scope.                    | Deep analysis needs model calls. agctx does not handle model calls or agent runtimes.                                                                                                                                                                                                               |

> [!Tip]
> When you need a draft written for one repository, use each agent's `/init` or [microsoft/agentrc](https://github.com/microsoft/agentrc). agentrc measures a repository's AI readiness, generates instruction files tailored to that codebase, and can write `AGENTS.md` with `--output AGENTS.md`. The comparison and how to combine them are in the [references (Korean)](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/references.md#비교-대상).

Refine such a draft by hand, then place it in the project extension area of `AGENTS.md`, because `AGENTS.md` is the standard that many agents read in common. If you keep it in `CLAUDE.md`, place it outside the agctx managed block. Editing inside a managed area makes the next `profile sync` stop with a conflict, and `profile resolve` then moves those edits outside the managed area. The decision and its sources are in [ADR 0006](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/adr/0006-no-codebase-analysis-guidance.md) and the [references](https://github.com/IsthisLee/agent-context-manager/blob/main/docs/references.md#프로젝트-지침-자동-생성에-관한-근거).

## Architecture direction and progress

agctx's implementation is managed in stages around where the shared context lives and who changes what. Each topic's goal, priority, contracts to settle before implementation, and implementation record live in a discussion document, and the [architecture discussion index](https://github.com/IsthisLee/agent-context-manager/tree/main/docs/discussion/architecture/) lists the topics and their status. The commands you can use today are listed under [Core features](#core-features).

<!-- agctx:generated:discussion-status:start -->
- **Implemented:** Profile model and store, setup and guidance options, project application, agent artifact synchronization, turning guidance items on and off, agent rule discovery, Git-based Profile management, using an existing Git repository as a Profile source, linking an existing repository folder as a Profile
- **In progress:** use through natural-language requests, safe synchronization of managed artifacts, evidence criteria and length budget for default guidance
- **Proposed:** Profile configuration surface expansion, scope expansion and guidance composition, choosing agents and context types per repository, creating a Profile from an existing repository. These are not current behavior yet.
<!-- agctx:generated:discussion-status:end -->

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

This is a personal project, so there is no separate contribution process. If something blocks you or needs fixing, open an issue.

- [Report an issue](https://github.com/IsthisLee/agent-context-manager/issues)
- [Security policy](https://github.com/IsthisLee/agent-context-manager/blob/main/SECURITY.md) — report a vulnerability through the path described there, not in an issue
- [Development rules](https://github.com/IsthisLee/agent-context-manager/blob/main/AGENTS.md) — the rules this repository follows when changing code and documentation

---

[MIT License](LICENSE) · Built with Codex, Claude Code, and Antigravity.
