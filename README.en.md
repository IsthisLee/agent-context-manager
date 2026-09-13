# Agentic

[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/en/about/previous-releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

[한국어](README.md) · **English**

> A package that creates and configures shared agentic-development guidance and then safely applies, syncs, and manages it across people, organizations, projects, and multiple AI agents.

## Core goals

- Multiple agents work against the same shared guidance.
- Different developers collaborate under the same agentic-development guidance.
- Create and manage per-purpose Cores (shared guidance stores) — Personal, Company, Team, Workspace — and apply the chosen one per project.

Cores keep the shared guidance as a single source of truth; each project adds its own domain rules in its own `AGENTS.md`. This reduces the drift in working style, guidance, and verification standards that otherwise varies by developer and agent.

The simplest start is a single command.

```bash
npm install --global @isthis/agentic
agt
```

The main TUI lets you manage, create, and configure Cores and open help. English is opt-in: choose it once on the first interactive run, or pass `--lang en` / `AGENTIC_LANG=en`, or run `agentic config lang en`. The default is Korean.

## Core features

- `agentic core create [<name>] [--scope <scope>]` — create a Core for `personal`, `company`, `team`, or `workspace`; omit the name for TUI input.
- `agentic core list [--scope <scope>]` — list, select, and manage Cores by scope.
- `agentic setup [--core <name>]` — after selecting a Core, configure harness, TDD, review, verification, documentation, and security guidance.
- `agentic core remove [<name>]` — delete the selected Core after confirmation; files already applied to projects are kept.
- `agentic init --core <name> <project>` — apply the selected Core to a project.
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
agentic core create company --scope company
agentic setup --core company --tdd recommended --security strict
agentic init --core company /path/to/project
```

Personal Cores are stored under `~/.agentic-cores/<name>`. A project's domain rules are added separately in the project's `AGENTS.md` after applying a Core.

### Scope of verification

Repository developers run `pnpm run check` to verify Agentic's own syntax, documentation contracts, and CLI evaluations. It does not run the target project's tests or vouch for an agent's code quality. The target project's real verification is run by the agent using that project's own commands; a Core only records the guidance that requires such verification.

## Documentation

- [Product direction](https://github.com/IsthisLee/agentic/blob/main/docs/product-direction.md)
- [User workflow](https://github.com/IsthisLee/agentic/blob/main/docs/workflow.md)
- [CLI Reference](https://github.com/IsthisLee/agentic/blob/main/docs/cli-reference.md)
- [Repository operations](https://github.com/IsthisLee/agentic/blob/main/docs/repository-operations.md)
- [Architecture discussion](https://github.com/IsthisLee/agentic/tree/main/docs/discussion/architecture/)

## License

[Apache License 2.0](LICENSE)
