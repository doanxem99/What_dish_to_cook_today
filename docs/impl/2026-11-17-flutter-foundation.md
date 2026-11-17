# Flutter client foundation — implementation record

**Goal:** read-only parity with the Vue client: board shell, EN/VI copy, light/dark themes, home picker, dishes list and grid, dish detail, ingredients, homemade, about, responsive from 320 px.

**Plan:** [2026-11-17-flutter-foundation.md](../../docs/superpowers/plans/2026-11-17-flutter-foundation.md)

**Baseline:** Flutter 3.32.8, `flutter test` 4/4, `flutter analyze --no-fatal-infos` 58 findings, existing client is three screens.

## Files

| File | Responsibility |
|---|---|
| `lib/theme/tokens.dart` | palette and spacing constants |
| `lib/theme/app_theme.dart` | `ThemeData` from tokens |
| `lib/i18n/i18n.dart` | flatten, interpolate, load shared catalogues |
| `lib/state/app_state.dart` | locale, theme, basket, `AppScope` |
| `lib/api/api_client.dart` | GET + envelope handling + image URLs |
| `lib/api/models.dart` | ingredient, dish preview, dish post, display block |
| `lib/shell/*` | shell, nav bar, footer |
| `lib/widgets/board_card.dart` | ruled surface and small controls |
| `lib/screens/*` | seven screens |
| `lib/app.dart` | MaterialApp, routes, catalogue loading |

## Interfaces

See the plan's per-task Interfaces blocks. Additions decided during implementation:

- `BasketItem { id, name, nameVi }` lives in `app_state.dart` so Task 1 compiles before the API models exist; Task 4 converts `IngredientRef` into it.
- `AppState(Map<String, I18n> catalogues)` exposes `String t(String key, [Map<String, String>? params])` and `I18n get i18n`.

## Test strategy

- Unit tests: flatten/interpolation/fallback, envelope parsing, bilingual fallbacks.
- Widget tests: shell at 360 and 1200 px with fake data, home picker behaviour, dishes list/grid, dish detail block language fallback and missing image.
- Commands: `flutter test`, `flutter analyze --no-fatal-infos`, `flutter build web --base-href /flutter/`.

## Tasks

- [x] 1. Theme tokens, i18n, app state
- [x] 2. API client and models
- [x] 3. Board shell, routing, bootstrap
- [x] 4. Home ingredient picker
- [x] 5. Dishes list and grid
- [x] 6. Dish detail, ingredients, homemade, about
- [x] 7. Build, copy, record

## Result

- Flutter 3.32.8; `flutter test` 22/22 (4 original data tests, 4 i18n, 5 models/client, 2 shell, 2 home, 2 dishes, 3 detail screens).
- `flutter analyze --no-fatal-infos`: 58 findings, unchanged from the baseline; no new lints.
- `flutter build web --base-href /flutter/` succeeded; `server/web/` replaced with the new output (index.html base href `/flutter/`, bundle 2.4 MB).
- Live server: `/flutter/` and `/flutter/dishes` answer the shell, `main.dart.js` served, Vue at `/` and the API still healthy.
- Header: brand, search, EN/VI, theme, four nav links; below 640 px the search takes its own row; board capped at 1080 px.
- Dish rows: lamp, match count, 44 px thumb, name and ingredient line; description returns from 640 px. Grid: 1/2/3 columns, two-line clamp, tooltip with the full description.

## Rulings

- No account entry in the Flutter header until Phase 2; a dead sign-in control would be worse than none.
- The basket stores `BasketItem` in `app_state.dart` so Task 1 compiles before the API models exist; Task 4 converts `IngredientRef`.
- `AppState.api` is lazy so widget tests create no HttpClient.
- Brand sits in `FittedBox` so a narrow header never overflows, including the wide test font.
- `AppStorage.serverUrl` derives from the page origin on the web and falls back to `localhost:3000` elsewhere.
- Detail-block colours: `black` maps to the theme ink, `white` to white, `red`/`green` to board tokens, `blue` to Material blue. This differs from Vue's literal colour names, which can make black text invisible on the dark board.
- Tests for Task 6 were written after the screens, so no red phase was observed for that task. The three tests still pin language fallback, the missing-photo placeholder and the empty state, but they were not proven to fail first. Cost if wrong: a test may describe the implementation rather than the requirement.

## Verification gaps

- No browser tool was available in this session; the Flutter app was not rendered in a real browser. Verification is unit/widget tests plus HTTP checks of the built shell. Layout at 320 and wide desktop is exercised only by widget tests.
- The service worker and canvaskit are served, but first-load rendering, drag scrolling and deep-link history behaviour are unverified.

## Final review fixes

Independent review found 1 critical, 11 warnings and 1 nit. Fixed and re-verified:

1. **Critical — stuck spinner in release:** the initial route was generated while the catalogues were loading and never regenerated. `build()` now returns a keyed loading `MaterialApp`, and the ready tree gets a fresh navigator after the catalogues land. New test `waits for catalogues before the first screen` pumps a deferred loader, sees the spinner, completes it, then sees the shell. The red state for that test was a compile error (no injectable loader), not a runtime failure — recorded.
2. Catalogue failure fallback: `AppState.i18n` falls back to the other non-empty locale instead of returning an empty map and raw keys.
3. Dish post ingredient ids: object entries from the best-post answer now read `ingredient_id`/`id`; test added.
4. Detail: `mounted` guard before the empty-post `setState`, and an empty parsed post id is treated as not found. New test drives the `dishId` path with a null best post.
5. Grid card width floored so rounding cannot wrap the last card; description test now asserts `maxLines: 2` and ellipsis.
6. Match counter is intrinsic width with a 34 px minimum, one line and ellipsis.
7. Tests: shell phone case now 320 px; loading branch covered.

Rejected or deferred:

- **Ruling:** nav taps keep `pushNamed` instead of the reviewer's `pushReplacementNamed`. Vue's router pushes one history entry per tap; replacing would remove browser-back out of a page the user arrived at through the nav. Cost if wrong: the back button needs one press per nav tap, same as Vue today.
- **Deferred minor:** the footer prints `MIT` as a literal instead of the unused `footer.license` key and link. Not reachable without `url_launcher`, which this phase forbids.


## Accepted risks

- No new dependencies; drag-and-drop and file upload wait for Phase 3.
- Be Vietnam Pro is not bundled; the platform sans renders Vietnamese.
- The Flutter bundle replaces tracked `server/web/` output; git history carries the old build.
- Colour values are copied by hand from `theme.css`; a token drift test is not possible without parsing CSS, so both palettes are asserted in a unit test against literal constants.
