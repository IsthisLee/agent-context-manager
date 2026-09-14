# Agentic — Profile-based AI Agent development guidance

<!-- agentic-doc-sources: bin/agentic.mjs, bin/conflicts.mjs, bin/project-plan.mjs, package.json, docs/discussion/architecture/README.md, docs/discussion/architecture/topics -->
<!-- agentic-doc-sources-sha256: 8d5eba5fb6ab21380bfc4065f38da64a53be106af4af58f0cdda2b031f33cc2a -->

[![CI](https://img.shields.io/github/actions/workflow/status/IsthisLee/agentic/ci.yml?branch=main&label=CI&logo=github)](https://github.com/IsthisLee/agentic/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/IsthisLee/agentic/codeql.yml?branch=main&label=CodeQL&logo=github)](https://github.com/IsthisLee/agentic/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/IsthisLee/agentic/badge)](https://securityscorecards.dev/viewer/?uri=github.com/IsthisLee/agentic)
[![npm](https://img.shields.io/npm/v/@isthis/agentic?logo=npm&color=cb3837)](https://www.npmjs.com/package/@isthis/agentic)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![last commit](https://img.shields.io/github/last-commit/IsthisLee/agentic)](https://github.com/IsthisLee/agentic/commits/main)
[![Supported agents](https://img.shields.io/badge/agents-Codex%20%C2%B7%20Claude%20Code%20%C2%B7%20Antigravity%20%C2%B7%20Cursor%20%C2%B7%20Copilot-6f42c1)](https://github.com/IsthisLee/agentic#supported-agents)

[한국어](README.md) · **English**

[The problem it solves](#the-problem-it-solves) · [Core goals](#core-goals) · [Use cases](#use-cases) · [Getting Started](#getting-started) · [Core features](#core-features) · [Supported agents](#supported-agents) · [Not supported](#not-supported) · [Architecture direction](#-architecture-direction-and-progress) · [Documentation](#documentation) · [Open-source participation](#open-source-participation)

## Different developers, different teams, different AI agents — one set of development guidance.

> Agentic creates and configures shared agentic-development guidance as Profiles for individuals and organizations, manages them locally or through Git, and safely applies and synchronizes them across projects and multiple AI agents.

> (⚙️ I am expanding the scope from guidance to the agent environment. (ex. Skills, Hooks, etc) Git support is also in progress.)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/IsthisLee/agentic/main/docs/assets/agentic-overview.en.dark.png">
    <img src="https://raw.githubusercontent.com/IsthisLee/agentic/main/docs/assets/agentic-overview.en.png" alt="Agentic structure: Personal, Company, and Team Profiles are applied and synced to many projects, and Codex, Claude Code, Antigravity, Cursor, and Copilot read the AGENTS.md, CLAUDE.md, and other files generated in each project. Sharing Profiles through a Git repository is planned." width="880">
  </picture>
</p>

One flow — `profile create` → `profile setup` → `profile apply`/`profile sync`: build a **Profile** (the single source of truth for shared guidance), apply it to your **project files**, and **multiple AI agents** work to the same standard.

## The problem it solves

**Your working principles for TDD, verification, security, and documentation are already defined in CLAUDE.md. So why set the same thing up again every time you add a project or an AI tool?**

Agentic manages those standards as a Profile and, when you apply it to a project, generates the files that compatible agents read, in a single pass. Change the standard in the Profile and sync it, so you never touch each project by hand again; each project's own domain rules and settings stay intact.

> Git-based sharing and updating of Profiles across a team is planned. The current release provides local Profile management, application, and synchronization. See the [follow-up architecture topic](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/profile-model.md) for the plan.

## Core goals

> Multiple agents and developers work and collaborate against the same shared guidance.
>
> Create and manage per-purpose Profiles (shared guidance stores such as Personal, Company, Team, and Workspace) and choose which to apply per project.

Reduce the working styles, guidance, and verification standards that otherwise vary by developer and agent, keeping a consistent collaboration standard.

A Profile's shared guidance is managed as a single source of truth, while each project adds its own domain rules separately in its own `AGENTS.md`.

Individual developers can also split and reuse per-project `Personal` Profiles and keep the same guidance even when the AI tools they use change. This reduces repeated setup and rule drift between projects, making both maintenance and development easier.

> [!NOTE]
> Agentic distributes a Profile's shared guidance to projects and multiple agents. It does not analyze a codebase to write project guidance automatically. [See why](#not-supported)

## Use cases

> The Git-based flows below apply after remote Profile management is implemented. The current release provides local Profile management, application, and synchronization only.

### Individual development

- **Use it this way:** Create Personal Profiles for different project types, configure their guidance through `profile setup`, and apply one to each project with `profile apply`.
- **Benefit:** Reuse the same development standard when switching AI tools or starting a new project.

### Team collaboration

- **Use it this way:** Share a team Profile in a Git repository; members clone or pull it, then apply it to their projects.
- **Benefit:** Review and distribute shared-guidance updates through one history while reducing per-person configuration drift.

### Organization standards

- **Use it this way:** Manage organization-wide standards in a Git-backed Profile; teams and projects add their own domain guidance in the project `AGENTS.md`.
- **Benefit:** Keep organization standards and project-specific requirements managed independently, without mixing them.

## Getting Started

> The full usage — from installation to synchronization — is documented step by step in the [usage guide](https://github.com/IsthisLee/agentic/blob/main/docs/usage-guide.md).

> Runtime: Node.js 24 LTS or newer

```bash
npm install --global @isthis/agentic
```

```bash
npm install -g @isthis/agentic
agentic profile create company --scope company
agentic profile setup company --tdd recommended --security strict
agentic profile apply company /path/to/project
```

The commands above follow this flow.

<p align="center">
  <img src="https://raw.githubusercontent.com/IsthisLee/agentic/main/docs/assets/agentic.gif" alt="Agentic flow: profile create → setup → apply·sync builds a Profile, applies it to project files, and multiple AI agents work to the same standard" width="800">
</p>

> [!Tip]
> Type `agt` or `agentic` in your terminal to use every feature through the TUI.
>
> Passing options directly is useful for automation or repeated runs.

Personal Profiles are stored under `~/.agentic/profiles/<name>`. A project's domain rules are added separately in the project's `AGENTS.md` after a Profile is applied.

Agentic provides commands to create, set up, apply, and synchronize Profiles. For detailed contracts and implementation records, see the [current architecture](https://github.com/IsthisLee/agentic/tree/main/docs/architecture/) and the [implementation plans](https://github.com/IsthisLee/agentic/tree/main/docs/discussion/architecture/).

### Scope of verification

Repository developers run `pnpm run check` to verify Agentic's own syntax, documentation contracts, and CLI evaluations. It does not run the target project's tests or vouch for an agent's code quality. The target project's real verification is run by the agent using that project's own commands; a Profile only records the guidance that requires such verification.

## Core features

- `agentic profile create [<name>] [--scope <scope>]` — create a Profile for the `personal`, `company`, `team`, or `workspace` purpose; omit the name for TUI input.
- `agentic profile list [--scope <scope>]` — list, select, and manage Profiles by scope; in the TUI you choose the scope first.
- `agentic profile setup [<name>]` — after selecting a Profile by scope, configure harness behavior, TDD, change review, verification, documentation, and security guidance; omit everything for the full TUI.
- `agentic profile remove [<name>]` — delete the selected Profile after confirmation; files already applied to projects are kept.
- `agentic profile apply <name> <project>` — apply the selected Profile to a project.
- `agentic profile resolve <project>` — move edits made inside a managed area outside it and regenerate the area; when the last applied version is unknown, `--discard` backs up and regenerates, and `--edit` opens a VS Code three-way merge.
- Generate and synchronize per-agent guidance files.
- `agentic config lang <ko|en>` — set the display and generation language; the default is Korean, can also be set with `--lang` / `AGENTIC_LANG`, and is chosen once on the first interactive run and saved.

## Supported agents

Applying a Profile to a project generates and syncs the per-agent guidance files below. `AGENTS.md` is the shared standard that many agents read together.

| Agent | Generated file |
| --- | --- |
| Codex, etc. (AGENTS.md standard) | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Antigravity | `.agents/rules/agentic.md` |
| Cursor | `.cursor/rules/agentic.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` |

Applying also records the managed areas as last written under `.agentic/base/`. Commit it, because it is the reference for resolving managed-area conflicts.

## Not supported

**Agentic does not analyze a codebase to write project guidance automatically.** Agentic distributes a Profile's shared guidance to projects and to multiple agents. Project-specific guidance belongs to the project, and Agentic does not write it on the project's behalf.

| Reason | Evidence |
| --- | --- |
| Each agent already provides it. | `/init` in Claude Code and Codex analyzes the codebase and drafts guidance. |
| Official guidance advises against that content. | Anthropic recommends leaving out anything the agent can figure out by reading code and file-by-file descriptions. Guidance should hold commands, conventions, decisions, and gotchas the agent cannot guess. It also warns that when guidance grows too long, important rules get lost and ignored. |
| The benefit is unproven. | In a study, agents followed the instructions in context files, yet task success rates did not generally improve and inference cost rose by over 20% on average. Repository overviews were not helpful. |
| It is outside Agentic's scope. | Deep analysis needs model calls. Agentic does not handle model calls or agent runtimes. |

Refine a `/init` draft by hand, then place it in the project extension area of `AGENTS.md`, because `AGENTS.md` is the standard that many agents read in common. If you keep it in `CLAUDE.md`, place it outside the Agentic managed block. Editing inside a managed area makes the next `profile sync` stop with a conflict, and `profile resolve` then moves those edits outside the managed area. The decision and its sources are in [ADR 0006](https://github.com/IsthisLee/agentic/blob/main/docs/adr/0006-no-codebase-analysis-guidance.md) and the [references](https://github.com/IsthisLee/agentic/blob/main/docs/references.md).

## 🧭 Architecture direction and progress

Agentic's implementation is managed in stages around the questions of where the shared guidance lives and who changes what. The table below condenses each discussion document's proposal summary from a user's perspective. `Proposed` items are follow-up work not yet guaranteed as current behavior.

| Topic | Target and goal | Priority · Status | Next work |
| --- | --- | --- | --- |
| [Profile model and store](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/profile-model.md) | A per-Personal/Company/Team/Workspace shared-guidance store for users and organizations | Critical · Implemented | Review the organization-sharing contract |
| [setup and guidance options](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/setup-and-guidance.md) | Users and the CLI selectively configure a Profile's TDD, change review, verification, documentation, and security guidance | High · Implemented | Advance presets and configuration diffs |
| [Project application](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/project-application.md) | Apply the chosen Profile to a project while keeping domain guidance separate | Critical · Implemented | Finalize conflict and recovery handling |
| [Agent artifact synchronization](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/agent-sync.md) | Generate and sync only the managed blocks from a Profile into per-agent guidance files | High · Implemented | Advance manifest and drift handling |
| [Use through natural-language requests](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/agent-mediated-usage.md) | Responsibilities of users, AI agents, TUI, and CLI, and safe automation boundaries | High · Proposed | Non-interactive CLI, JSON, and exit codes |
| [Safe synchronization of managed artifacts](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/managed-artifact-safety.md) | Update managed files partially and guarantee user edits, conflicts, and recovery | Critical · Implementing | Conflict visualization and recovery |
| [Scope expansion and guidance composition](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/scope-composition.md) | User-definable, shareable guidance layers and multi-layer inheritance and merging for a project | Medium · Proposed | Prototype the minimal composition after validation |

### Proposal summaries

Each document manages not only the code feature but also the target layer, the reason for introduction, priority, preceding/following/related work, and the contracts to decide before implementation. Below is a map that condenses that information by area; the detailed current status and implementation records are in each document.

#### 1. Profiles and shared-guidance configuration

| Topic | Purpose · target layer | Priority · Status | What to decide and relationships |
| --- | --- | --- | --- |
| [Profile model and store](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/profile-model.md) | Separate and reuse shared guidance per Personal/Company/Team/Workspace · users and organizations ↔ CLI ↔ Profile | Critical · Implemented | Path, name, scope, default selection; precedes every follow-up feature |
| [setup and guidance options](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/setup-and-guidance.md) | Select only the needed harness, TDD, change review, verification, documentation, and security guidance · user ↔ CLI ↔ Profile `AGENTS.md` | High · Implemented | Presets, defaults, re-runs, interactive/non-interactive; after the profile model, before project application |
| [Scope expansion and guidance composition](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/scope-composition.md) | Raise scope into shareable, reusable guidance layers with multi-layer inheritance and merging · users and organizations ↔ CLI ↔ Profile/scope ↔ project | Medium · Proposed | Merge and conflict rules, scope-sharing format; start after the validation gate |

#### 2. Project application and agent delivery

| Topic | Purpose · target layer | Priority · Status | What to decide and relationships |
| --- | --- | --- | --- |
| [Project application](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/project-application.md) | Use shared guidance and project domain guidance together while keeping them separate · user ↔ CLI ↔ Profile ↔ project | Critical · Implemented | Target, merge, approval, application record; after setup, before synchronization |
| [Agent artifact synchronization](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/agent-sync.md) | Deliver the same shared standard to each agent's file format · Profile ↔ CLI ↔ project artifacts | High · Implemented | Adapters, pointers, file ownership, drift; after project application |
| [Safe synchronization of managed artifacts](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/managed-artifact-safety.md) | Protect user content and manual changes during re-application and updates · CLI/TUI ↔ Profile ↔ project files | Critical · Implementing | Managed blocks, hash, dry-run, conflict, backup, recovery; follow-up on the safety of application and synchronization |

#### 3. User and agent automation boundaries

| Topic | Purpose · target layer | Priority · Status | What to decide and relationships |
| --- | --- | --- | --- |
| [Use through natural-language requests](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/agent-mediated-usage.md) | Keep AI agents from changing the wrong target on an ambiguous request · user ↔ AI agent ↔ CLI/TUI ↔ project | High · Proposed | Explicit target, machine-readable result, approval, exit codes; follow-up on top of the current CLI/TUI |

The current sequence is profile creation → guidance setup → project application → agent artifact synchronization. Each proposal's status, its preceding/following/related proposals, follow-up work, recommended next steps, and the decisions to make are in the [architecture discussion index](https://github.com/IsthisLee/agentic/tree/main/docs/discussion/architecture/).

## Documentation

- [Product direction](https://github.com/IsthisLee/agentic/blob/main/docs/product-direction.md)
- [Implementation principles](https://github.com/IsthisLee/agentic/blob/main/docs/implementation-principles.md)
- [User workflow](https://github.com/IsthisLee/agentic/blob/main/docs/workflow.md)
- [CLI Reference](https://github.com/IsthisLee/agentic/blob/main/docs/cli-reference.md)
- [Repository operations](https://github.com/IsthisLee/agentic/blob/main/docs/repository-operations.md)
- [Architecture implementation plans](https://github.com/IsthisLee/agentic/tree/main/docs/discussion/architecture/)
- [External references](https://github.com/IsthisLee/agentic/blob/main/docs/references.md)

## Open-source participation

- [Contributing guide](https://github.com/IsthisLee/agentic/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/IsthisLee/agentic/blob/main/SECURITY.md)
- [Code of conduct](https://github.com/IsthisLee/agentic/blob/main/CODE_OF_CONDUCT.md)
- [Report an issue](https://github.com/IsthisLee/agentic/issues)

---

[Apache License 2.0](LICENSE) · Built with Codex, Claude Code, and Antigravity.
