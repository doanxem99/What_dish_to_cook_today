# UI completion and visual system — design

Status: draft for approval. Plan follows approval.

## Intent

Finish the product's UI in this order: every Vue screen, then the same surfaces in Flutter, then the Express endpoints those screens need. Replace the template look with a real visual system instead of polishing it. AI recommendations and nutrition are explicitly a later project; nothing here prepares schema for them beyond keeping dish/ingredient data separate from profile data.

Why now: half the product is unreachable or fake today. Comments have no backend, votes do not exist, the profile page is a stub, search does nothing, and PRODUCT.md's bilingual requirement is unmet. A new visual system is cheaper before those screens exist than after.

## Users and mode

- Home cooks on phone or desktop, deciding dinner with what they have. Bilingual EN/VI.
- Editors curate the catalog; the grant flow stays undecided (see non-goals).
- Visitor mode: **Operate** on every screen. Success is a completed task, not persuasion. Ambition shows as precision, not decoration.

## Goals

1. Every screen listed below exists in Vue, production-ready.
2. English and Vietnamese ship together from one string catalog.
3. Each screen covers loading, empty, error, success, and permission states.
4. A new visual system, chosen through a direction round, recorded in DESIGN.md at finish; all screens built on it.
5. Flutter reaches parity with the Vue screens that exist; no Flutter-only features.
6. Missing Express endpoints added only where a screen needs them.
7. Accessibility floor: keyboard reachable, visible focus, labelled controls, contrast that survives both themes if a theme pair is chosen, 48 dp targets in Flutter.

## Non-goals

- AI recommendations, nutrition values, calorie targets, profile health data. Later project.
- Editor-role enforcement or a grant flow. `PRODUCT.md` still lists it as undecided; shipping half a role is worse than none. Create/edit stays available to any signed-in user, and copy must not claim editor-only behaviour.
- Payments, notifications, real-time updates, moderation queue.
- Search ranking, pagination beyond a limit, offline support.
- Converging the two clients or deleting Flutter.

## Anti-goals (a result that looks polished and is still wrong)

- Controls that look functional but do nothing (today's sort/group selects).
- Fixture data presented as real users, reviews, or metrics. Seed content only, labelled where it could be mistaken for real.
- Two translation sources that drift between Vue and Flutter.
- Screens shipped with only a happy path, so an empty database looks broken.
- Copy promising features the product does not have.
- A visual system carried by a stock component library skin; components are rebuilt in the chosen form's vocabulary.

## Constraints

- Vue 3, Vite 6, Tailwind 4, Pinia; no new UI framework, no new component library.
- One string catalog: JSON per language, read by Vue through a small `useI18n()` composable and by Flutter as an asset. No `vue-i18n`, no ARB pipeline. Copy avoids count-dependent plurals; a helper is added only if a real string needs it.
- No new backend dependency; Express 4 and Mongoose stay.
- Mongo only; the C# tools keep writing the same collections.
- Existing route paths stay working where a client already calls them; new endpoints are additive.
- Visual direction is chosen by impeccable's direction round (`concept-seed --scope direction --mode operate`) before page code starts. DESIGN.md is written at finish from the built system, not before.

## Chosen approaches

- **Strings:** shared JSON catalog, one file per language, both clients read it. Rejected: `vue-i18n` plus Flutter ARB, which duplicates translations and drifts.
- **Visual work:** replacement world, not refinement. The current Tailwind look is evidence of the subject, not authority. The direction round picks the world; the shape brief records the direction contract; DESIGN.md documents the result.
- **Backend:** UI plus the missing endpoints (comments, votes, my-posts, homemade filter). Rejected: UI-only, which leaves comments and votes dead, and UI-plus-editor-role, which ships a role nobody can administrate.
- **Sequence:** Vue first, then Flutter parity, then backend wiring where the Vue screens need it. Backend endpoints are planned with the Vue screen that consumes them, not all at the end, so each screen is verifiable when it lands.
- **Vietnamese:** both languages authored in this pass, VI drafted by the implementer and reviewed by the owner before merge.

## Screens and required behaviour

| Screen | Content | States that must exist |
|---|---|---|
| Home | ingredient picker, chosen ingredients, dish of the day, short "how it works" | no ingredients chosen, no best dish, request error |
| Dishes | list from the catalog, working search, no fake sort/group controls | loading, empty catalog, error, no matches |
| Dish detail | name, author, date, ingredients, blocks, comments, vote control, edit entry for signed-in users | absent post, post without blocks, zero comments, comment submit error, vote error |
| Dish edit | name, short detail, image, ingredients, blocks reorder/edit, preview | signed out, save error, unsaved changes warning |
| Ingredients | list by type, working search | loading, empty, error, no matches |
| Ingredient detail | type, description, blocks, edit entry | as dish detail |
| Ingredient edit | as dish edit | as dish edit |
| Homemade dishes | dishes contributed by users, empty when none | loading, empty, error |
| About | purpose, how selection works, language stance, data honesty statement | static; no states beyond render |
| Profile | username, joined date, my dishes, my ingredients, sign out | signed out redirect, no posts yet, request error |
| Sign in / Sign up | existing forms in the new system, language switch | invalid input, wrong credentials, duplicate account, server error |
| Shell | navbar with working search and EN/VI switch, footer, account menu | signed in, signed out, mobile layout |

Comments: list newest first, submit when signed in, delete own comment. Votes: one per user per dish, toggle, count visible. Both need endpoints.

## Backend additions

- `comment` collection: `{dish_post_id, user_id, body, date_time}` with list/create/delete routes scoped to a dish post.
- Vote: `{user_id, dish_post_id}` uniqueness; toggle route; `points` derived from votes, not incremented blindly.
- `GET /api/dish/profile/mine` and `GET /api/ingredient/profile/mine` for the profile page.
- `GET /api/dish/selection/homemade` (or an `origin=user` filter) for the homemade page. Definition: a dish whose best post was authored by a user other than the seed admin. Recorded as the definition; if it proves wrong, one filter changes.
- `GET /api/auth/me` returning username and joined date for the profile page (no new secret data).

## Visual direction

The round is the first task of the plan, before any screen code: seven grounded candidates derived from the cooks' world, a dealt direction, fused challengers, one hand for the owner to lock. The chosen world is recorded in a surface brief as a direction contract. DESIGN.md is produced at finish from what was built. No look is proposed in this document; proposing one here would pre-empt the round.

## What is left to the builder

- The visual world itself, subject to the direction round and the owner's lock.
- Token names, spacing rhythm, type scale: documented in DESIGN.md at finish.
- Component inventory inside the chosen form: builder's call, informed by the screens table.
- Flutter port mechanics: same catalog, same layouts adapted to Material conventions; builder's call.
- Exact Vietnamese wording: implementer drafts, owner reviews.

## Evidence

Seed catalog and seeded images only. No real users, reviews, or metrics exist and none may be invented. Comments, votes, and profile lists will be empty on a fresh database; empty states are the honest default, not a placeholder to hide.
