# Agentic — AI agent guidance management

[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

[한국어](README.md) · **English**

## Different developers, different teams, different AI agents — one project development standard.
>
> Agentic creates and configures shared agentic-development guidance as Profiles for individuals and organizations, manages them locally or through Git, and safely applies and synchronizes them across projects and multiple AI agents.

<p align="center">
  <img src="https://raw.githubusercontent.com/IsthisLee/agentic/main/docs/assets/agentic-flow.png" alt="Agentic flow — user, AI agent, Profile, project files" width="840">
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/IsthisLee/agentic/main/docs/assets/agentic-flow.webm">▶ Animated flow (WebM)</a>
  ·
  <a href="https://github.com/IsthisLee/agentic/blob/main/docs/assets/agentic-flow.html">Interactive diagram</a>
</p>

One flow — `profile create` → `profile setup` → `profile apply`/`profile sync`: build a **Profile** (the single source of truth for shared guidance), apply it to your **project files**, and **multiple AI agents** work to the same standard.

## Profile goals

- Multiple agents work against the same shared guidance.
- Different developers collaborate under the same agentic-development guidance.
- Create and manage per-purpose Profiles (shared guidance stores) — Personal, Company, Team, Workspace — and apply the chosen one per project.

Profiles keep the shared guidance as a single source of truth; each project adds its own domain rules in its own `AGENTS.md`. This reduces the drift in working style, guidance, and verification standards that otherwise varies by developer and agent.

Individual developers can also reuse separate `Personal` Profiles per project and keep the same guidance when switching AI tools. This reduces repeated setup and guidance drift between projects, making both maintenance and development easier.

Profiles are currently managed locally. Sharing and updating organization Profiles through Git is tracked as a [follow-up architecture topic](https://github.com/IsthisLee/agentic/blob/main/docs/discussion/architecture/topics/profile-model.md), not advertised as a current capability.

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
- **Benefit:** Keep organization standards independent from project-specific requirements.

See [Quick start](#quick-start) for installation, the TUI entry point, and applying guidance to a project. English is opt-in: choose it once on the first interactive run, or pass `--lang en` / `AGENTIC_LANG=en`, or run `agentic config lang en`. The default is Korean.

## Profile features

- `agentic profile create [<name>] [--scope <scope>]` — create a Profile for `personal`, `company`, `team`, or `workspace`; omit the name for TUI input.
- `agentic profile list [--scope <scope>]` — list, select, and manage Profiles by scope.
- `agentic profile setup [<name>]` — after selecting a Profile, configure harness, TDD, review, verification, documentation, and security guidance.
- `agentic profile remove [<name>]` — delete the selected Profile after confirmation; files already applied to projects are kept.
- `agentic profile apply <name> <project>` — apply the selected Profile to a project.
- `agentic config lang <ko|en>` — set the display and generated-guidance language.
- Generate and sync per-agent guidance files.

## Language

The CLI and generated guidance support Korean (`ko`) and English (`en`); the default is `ko`. The locale is resolved as `--lang` → `AGENTIC_LANG` → a saved choice → (interactive: asked once on first run and saved; non-interactive: `ko`). A non-interactive run with nothing set behaves exactly as before. See [ADR 0002](https://github.com/IsthisLee/agentic/blob/main/docs/adr/0002-locale-i18n.md).

## Quick start

### Prerequisites

- Runtime: Node.js 24 LTS or newer
- End users: `npm install --global @isthis/agentic`
- Repository contributors: run `pnpm install` at the repo root, then the development commands

`agt` is a short alias for `agentic`.

```bash
npm install -g @isthis/agentic
agentic profile create company --scope company
agentic profile setup company --tdd recommended --security strict
agentic profile apply company /path/to/project
```

Personal Profiles are stored under `~/.agentic-profiles/<name>`. A project's domain rules are added separately in the project's `AGENTS.md` after applying a Profile.

### Scope of verification

Repository developers run `pnpm run check` to verify Agentic's own syntax, documentation contracts, and CLI evaluations. It does not run the target project's tests or vouch for an agent's code quality. The target project's real verification is run by the agent using that project's own commands; a Profile only records the guidance that requires such verification.

## Documentation

- [Product direction](https://github.com/IsthisLee/agentic/blob/main/docs/product-direction.md)
- [User workflow](https://github.com/IsthisLee/agentic/blob/main/docs/workflow.md)
- [CLI Reference](https://github.com/IsthisLee/agentic/blob/main/docs/cli-reference.md)
- [Repository operations](https://github.com/IsthisLee/agentic/blob/main/docs/repository-operations.md)
- [Architecture discussion](https://github.com/IsthisLee/agentic/tree/main/docs/discussion/architecture/)

---

[Apache License 2.0](LICENSE) · Built with Codex, Claude Code, and Antigravity.
