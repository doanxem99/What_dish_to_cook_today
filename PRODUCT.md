# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

- **Home cooks (primary).** Someone at home, often deciding dinner with limited time, who wants to cook with ingredients already on hand instead of shopping for a recipe. They use a phone or desktop browser and read English or Vietnamese.
- **Editors (curators).** A designated role that maintains the shared dish and ingredient catalogs: adding entries, correcting details, keeping templates and gallery images coherent. Regular users do not edit the catalog; they browse, select, comment, and vote.

## Product Purpose

Answer "what dish can I cook today?" from what the cook already has. The user records available ingredients, then sees dishes that can be made from them. Success is a cooked meal decided without browsing a whole recipe site. A shared, curated catalog keeps suggestions trustworthy, so the same ingredient means the same thing to every user.

## Positioning

Ingredient-first selection over a shared curated catalog, not a personal recipe scrapbook or a generic recipe feed. The picker asks what you have, and the answer set is bounded by the catalog the editor maintains. Two web clients, Vue and Flutter, run on one Express API, so the catalog and selection logic stay single-source.

## Operating Context

- Development spans several runtimes: Node.js/Express server (port 3000) serving API, static web build, and a worker websocket; MongoDB; a C# Windows `database_control_center` for database operation and maintenance.
- Two front ends share the API: `web_ui` (Vue 3, Vite, Tailwind, Pinia) and `flutter_web_dev` (Flutter web, built into `server/web`).
- Auth is a JWT stored in an httpOnly cookie named `token`, valid for 24 hours; dish/ingredient images are uploaded through a gallery flow served by the same server.
- Curation today is assumed to happen through the same web clients; the editor role is a product requirement, not yet a recorded implementation.

## Capabilities and Constraints

Confirmed requirements:

- Bilingual English and Vietnamese; language is a real audience need, not a later nice-to-have.
- Editor role curates the catalog; ordinary users browse, select, comment, and vote.

Current implementation, explicitly **not** a durable contract: the repository is a starting template and everything in it may change. Present today: session-cookie auth, dish and ingredient CRUD, ingredient-based dish selection, comments and votes, reusable text/image template blocks for detail pages, and gallery image upload.

Open decisions:

- How the editor role is granted and reviewed is undecided.
- Which client leads (Vue, Flutter, or converged) is undecided; the user confirmed both currently share the API rather than one superseding the other.
- Database split between MongoDB and MySQL is not settled product truth; future work may change it.

## Brand Commitments

- Name "What dish to cook today?" is confirmed and binding.
- Logo and visual identity are open; the existing icon assets are placeholders.
- Voice and tone are undecided.

## Evidence on Hand

- Seed/sample dishes and ingredients only. No real users, testimonials, reviews, press, benchmarks, or usage data exist, and future work must not fabricate them.
- No production screenshots or case studies.

## Product Principles

1. Start from what the cook has. Ingredient entry is the product's front door, not a filter buried in a recipe list.
2. One catalog, two clients. A dish or ingredient means the same thing in Vue and Flutter; duplication across clients is a bug.
3. Curation is a job. Editors keep the catalog good; users should never meet an entry nobody owns.
4. Speak the cook's language. English and Vietnamese are peers in UI copy and catalog content.
5. Treat the template as disposable. Nothing in the current code earns preservation by seniority; keep only what serves the loop above.
