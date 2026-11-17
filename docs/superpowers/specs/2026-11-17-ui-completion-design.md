# UI completion and visual system — design

Status: revised after the builder check; awaiting approval. Plan follows approval.

## Intent

Bring the product to a finished state for both clients: a new visual system, every Vue screen, full Flutter parity, and the Express endpoints those screens need. English and Vietnamese are peers for interface copy and catalog content. AI recommendations and nutrition stay a later project.

Why now: half the product is unreachable or fake. Comments have no backend, votes do not exist, profile is a stub, search does nothing, the Flutter client has no auth or editors, and PRODUCT.md's bilingual requirement is unmet. Doing this before the visual system is replaced would mean building screens twice.

## Users and mode

- Home cooks on phone or desktop, deciding dinner with what they have, reading EN or VI.
- Editors curate the catalog; the grant flow stays undecided (see non-goals).
- Visitor mode: **Operate** on every screen. Success is a completed task. Ambition shows as precision, not decoration.

## Goals

1. A new visual system, chosen through an impeccable direction round, recorded in DESIGN.md at finish, applied to every screen in both clients.
2. Every Vue screen listed below exists, production-ready, with loading, empty, error, success and permission states.
3. Flutter reaches full parity: browse, auth, profile, editors, comments, votes.
4. English and Vietnamese ship together for interface copy and catalog content.
5. Missing Express endpoints added where a screen needs them.
6. Express serves both clients: Vue at `/`, Flutter at `/flutter`.
7. Accessibility floor: keyboard reachable, visible focus, labelled controls, adequate contrast, 48 dp targets in Flutter.

## Non-goals

- AI recommendations, nutrition values, calorie targets, profile health data. Later project.
- Editor-role enforcement or a grant flow. Create/edit stays available to any signed-in user; copy must not claim editor-only behaviour.
- Payments, notifications, real-time updates, moderation queue.
- Search ranking, pagination beyond the current limit, offline support.
- Deleting either client.

## Anti-goals

- Controls that look functional but do nothing.
- Fixture data presented as real users, reviews, or metrics.
- Two translation sources that drift between Vue and Flutter.
- Screens with only a happy path, so an empty database looks broken.
- Copy promising features the product does not have.
- A visual system carried by a stock component library skin.

## Constraints

- Vue 3, Vite 6, Tailwind 4, Pinia; Flutter 3.32; no new UI framework or component library in either client.
- One string catalog per language, served by Express at `public/i18n/en.json` and `public/i18n/vi.json`, fetched by both clients at runtime. No `vue-i18n`, no ARB pipeline, no duplicated asset copies.
- Language choice persists client-side (cookie), sets `<html lang>`, and survives reloads. Server stores no locale.
- No new backend dependency; Express 4 and Mongoose 6 stay.
- MongoDB only; the C# tools keep writing the same collections and must tolerate the new fields.
- Existing route paths keep working; new endpoints are additive.
- Visual direction is chosen before page code (`concept-seed --scope direction --mode operate`); DESIGN.md is written at finish from the built system.

## Chosen approaches

- **Strings:** one JSON catalog per language served by Express and read by both clients. Rejected: `vue-i18n` + Flutter ARB, which duplicates translations and drifts.
- **Visual work:** replacement world, not refinement. Current Tailwind look is evidence, not authority. Direction round picks the world; the surface brief records the direction contract.
- **Backend:** add what screens need (comments, votes, my-posts, homemade, `/auth/me`) plus bilingual catalog fields.
- **Scope:** UI, catalog content and data model in one program of work, delivered as three plans (see Phasing), because the bilingual content and full Flutter parity make a single plan too large to review.
- **Vietnamese:** authored in this pass; VI drafted by the implementer, reviewed by the owner before merge.

## Phasing (revised order)

The original instruction was Vue, then Flutter, then backend. Bilingual catalog content and full Flutter parity change that: both need schema and endpoints first, and Flutter auth needs the same cookie contract as Vue.

1. **Backend and hosting foundations.** Bilingual fields on dish/ingredient and posts, comments collection and routes, votes with one-per-user, my-posts, homemade filter, `/auth/me`, comments on dish posts only, seed updates, and Express serving Vue at `/` and Flutter at `/flutter`. Ships working software because the current clients keep working with additive changes.
2. **Vue UI.** Direction round and surface brief, then the design system, then every screen, bilingual UI and content editing, all states. Depends on plan 1.
3. **Flutter parity.** Same screens and states in Flutter on Material conventions, same catalog and contracts. Depends on plans 1 and 2 (for the copy and the endpoints).

Each plan ends with its own verification and can be reviewed on its own.

## Screens and required behaviour

| Screen | Content | States that must exist |
|---|---|---|
| Home | ingredient picker, chosen ingredients, dish of the day, short "how it works" | no ingredients chosen, no best dish, request error |
| Dishes | catalog list, working search (matches EN and VI names), no fake sort/group controls | loading, empty, error, no matches |
| Dish detail | name, author, date, ingredients, blocks, comments, vote control, edit entry for signed-in users, "your version" banner when the signed-in user has their own post | absent post, post without blocks, zero comments, comment submit error, vote error |
| Dish edit | name and name_vi, short detail and short_detail_vi, image, ingredients, blocks (text with VI variant), preview | signed out, save error, unsaved changes warning |
| Ingredients | list by type, working search (EN and VI) | loading, empty, error, no matches |
| Ingredient detail | type, description, blocks, edit entry. No comments, no votes. | as dish detail, without social states |
| Ingredient edit | as dish edit | as dish edit |
| Homemade dishes | dishes whose best post was authored by a user other than the seed admin | loading, empty, error |
| About | purpose, how selection works, language stance, data honesty statement | static |
| Profile | username, joined date, my dishes, my ingredients, sign out | signed out redirect, no posts yet, request error |
| Sign in / Sign up | existing forms in the new system, language switch | invalid input, wrong credentials, duplicate account, server error |
| Shell | navbar with working search and EN/VI switch, footer, account menu | signed in, signed out, mobile layout |

`/dish_selection` folds into Home; the path redirects to `/`.

Comments: list newest first with author name and own-comment flag, submit when signed in, delete own comment, body length limited. Votes: one per user per dish post, toggle, count visible. `dish_post.points` remains the stored counter so `get_best_dish_post` ordering and the C# points ranking keep working; the vote route updates it and the vote collection together.

## Backend additions

- `comment` collection `{dish_post_id, user_id, body, date_time}`; list, create, delete-own routes scoped to a dish post.
- `vote` collection with a unique `{user_id, dish_post_id}` index; toggle route; keeps `dish_post.points` in step.
- `GET /api/dish/profile/mine` and `GET /api/ingredient/profile/mine`: all of the user's posts, each flagged when it is the best post.
- `GET /api/dish/selection/homemade`: dish whose best post author is not the seed admin (constant username `moonshine@gmail.com`; no admin role exists).
- `GET /api/auth/me`: username, joined date, roles. Adds `user.created_at` at signup; legacy users return null and the profile omits the line.
- Bilingual fields: `name_vi`, `short_detail_vi` on `dish`, `ingredient`, `dish_post`, `ingredient_post`; `text_vi` accepted on text blocks. Optional: empty means fall back to English.
- Search matches both name fields.

## Settled calls

- Ingredients get no comments or votes.
- Dish detail shows the best post; if the signed-in user has their own post, a banner links to it and saving redirects there instead of leaving the edit invisible.
- Profile lists all of the user's posts with a best badge, not only winners.
- No automatic recomputation of a dish's best post on votes; votes change counts and ordering only.
- i18n files are served, not bundled, so both clients read the same bytes.

## Visual direction

The direction round is the first task of the Vue plan, before any screen code: seven grounded candidates from the cooks' world, a dealt direction, fused challengers, one hand for the owner to lock. The chosen world is recorded in a surface brief as a direction contract. DESIGN.md is produced at finish. No look is proposed here; proposing one would pre-empt the round.

## What is left to the builder

- The visual world, subject to the direction round and the owner's lock.
- Token names, spacing rhythm, type scale: DESIGN.md at finish.
- Component inventory inside the chosen form.
- Flutter port mechanics: same catalog and layouts adapted to Material conventions.
- Exact Vietnamese wording: implementer drafts, owner reviews.
- The definition of "homemade": recorded as best-post author differs from the seed admin; one filter changes if that proves wrong.

## Evidence

Seed catalog and seeded images only. No real users, reviews, or metrics exist and none may be invented. Comments, votes, and profile lists are empty on a fresh database; empty states are the honest default.
