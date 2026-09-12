# Antigravity Rules for {{PROJECT_NAME}}

All behavioral guidelines, deterministic TDD principles, and verification commands in this repository adhere strictly to `AGENTS.md` in the project root as the Single Source of Truth (SSOT).

## Guidelines
1. At the start of a task, always read `AGENTS.md` in the project root for core behavioral contracts and verification commands.
2. Follow the Red-Green-Refactor TDD cycle: write failing tests before implementation.
3. After code modifications, always execute `{{VERIFY_COMMAND}}` and ensure machine evidence (exit code 0).
4. Manage all project-specific domain rules and architecture policies exclusively in `AGENTS.md`.
