# Repository rules

Rules the owner has set for every session, every agent, every handoff in this repository.
Session-level agent guidance lives in [AGENTS.md](AGENTS.md); this file holds the owner's
standing instructions. Read it before acting.

## 1. Anything the owner must read is a clickable link

Every document, plan, spec, report, changelog, screenshot or file you hand over must be
presented as a clickable link, never as a bare path in code formatting.

- Write relative Markdown links from the repository root, with forward slashes:
  `[RULES.md](RULES.md)`, `[docs/API.md](docs/API.md)`.
- Prefer one link the owner can click and read over a description of where the file is.
- Name the link by the file's path or its title, then say in one line what it contains.
- This applies to every reply that produces or points at a document, including handoffs to
  the next session.

Example:

> Plan saved: [docs/superpowers/plans/2026-11-17-backend-hosting.md](docs/superpowers/plans/2026-11-17-backend-hosting.md) — nine tasks.

Why: the owner reads the conversation, not the filesystem. A path in backticks cannot be
clicked, so the document stays unread.
