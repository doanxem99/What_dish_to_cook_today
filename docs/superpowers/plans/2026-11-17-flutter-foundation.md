# Flutter Client Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-screen Flutter skeleton with the read-only half of the Vue client: board shell, EN/VI copy, light/dark themes, home ingredient picker, dishes list and grid, dish detail, ingredients, homemade and about, responsive from 320 px up.

**Architecture:** Plain Flutter widgets and `ChangeNotifier` state, no new package beyond the existing `http`/`collection`. One `AppState` holds locale, theme and the ingredient basket; the shared `/public/i18n/{en,vi}.json` files drive copy in both clients. Screens are separate files under `lib/screens/`, API models and calls under `lib/api/`, tokens under `lib/theme/`.

**Tech Stack:** Flutter 3.32.8 / Dart 3.8, `package:http` 0.13.5, Material widgets, browser path URL strategy, Express API on port 3000.

**Spec:** `.impeccable/surfaces/web-ui.md` and `PRODUCT.md`; visual source `web_ui/src/assets/css/theme.css`; API shapes `docs/API.md`. This plan is Phase 1 of four; auth/comments/votes are Phase 2, editors Phase 3, parity polish and release Phase 4.

## Global Constraints

- Copy comes from `server/public/i18n/en.json` and `vi.json` at runtime; no Dart string literals for user-visible text except the brand `What dish to cook today?`.
- Palette and spacing copy `theme.css` exactly: dark background `#14171c`, raised `#1b2027`, line `#3a434f`, strong line `#5b6470`, ink `#f2f0ea`, dim `#a7b0bb`, red `#a85634`, danger `#e0785a`, amber `#d99a4e`, green `#6fae86`; light background `#f6f4ef`, raised `#ffffff`, line `#c3bcae`, strong `#8a8578`, ink `#1d2127`, dim `#5b6470`, red `#96482b`, danger `#8f2f18`, amber `#8a5a12`, green `#2f6b45`. Radius 6, spacing 4/8/12/16/24/32.
- Breakpoints: base below 640, medium 640–1023, large 1024+. Board max width 1080.
- Images are `serverUrl + relativePath` where the path starts `public/`; use forward slashes.
- No new dependencies in this phase. No `provider`, `go_router`, `file_picker` yet.
- `flutter analyze --no-fatal-infos` must stay at or below the current 58 findings; new files add none.
- Build output goes to `server/web/` with `--base-href /flutter/`; never hand-edit that directory.
- Existing tests in `test/widget_test.dart` must keep passing; extend that file rather than replacing it.

## File structure

| Path | Responsibility |
|---|---|
| `lib/theme/tokens.dart` | colour and spacing constants for both themes |
| `lib/theme/app_theme.dart` | `ThemeData` built from tokens |
| `lib/i18n/i18n.dart` | load both catalogues, flatten dot keys, interpolate, `t()` |
| `lib/state/app_state.dart` | `ChangeNotifier` with locale, theme mode, basket; `AppScope` inherited notifier |
| `lib/api/api_client.dart` | GET helper, server URL, JSON envelope handling |
| `lib/api/models.dart` | ingredient, dish preview, dish detail, display block models |
| `lib/shell/app_shell.dart` | scaffold, header, nav, footer, page body slot |
| `lib/shell/nav_bar.dart` | brand, search, language, theme, links |
| `lib/shell/app_footer.dart` | footer columns and bottom row |
| `lib/screens/home_screen.dart` | ingredient picker, chosen chips, best dish, CTA |
| `lib/screens/dishes_screen.dart` | list and grid views over the selection API |
| `lib/screens/dish_detail_screen.dart` | cover, extra images, blocks, ingredients, comment list |
| `lib/screens/ingredients_screen.dart` | grouped list with search |
| `lib/screens/ingredient_detail_screen.dart` | ingredient post blocks and image |
| `lib/screens/homemade_screen.dart` | homemade dish rows |
| `lib/screens/about_screen.dart` | about copy |
| `lib/widgets/board_card.dart` | ruled surface, chips, lamps, buttons |
| `lib/app.dart` | `MaterialApp`, routes, `onGenerateRoute`, URL strategy |
| `test/i18n_test.dart` | flatten, fallback, interpolation |
| `test/shell_test.dart` | header at 360 and 1024 with fake state |
| `test/api_models_test.dart` | envelope and bilingual parsing |

## Review Focus

- Vietnamese long labels in the header at 320 px: brand plus language, theme and account must fit or scroll without horizontal page overflow.
- Empty API answers and offline server: every screen shows a copy string from the catalogue, never a blank body or a crash.
- Missing dish photos (one seed dish has none) and broken image URLs: placeholder shows, layout does not collapse.
- Display blocks with only one language filled: fallback to the other language instead of empty text.
- Deep links under `/flutter/dishes`, `/flutter/dish/detail?id=...`: the server already rewrites them; the router must resolve them on first load.

---

### Task 1: Theme tokens, i18n and app state

**Files:**
- Create: `lib/theme/tokens.dart`, `lib/theme/app_theme.dart`, `lib/i18n/i18n.dart`, `lib/state/app_state.dart`
- Test: `test/i18n_test.dart`

**Interfaces:**
- `class BoardTokens { const BoardTokens({required this.bg, ...}); }` and `BoardTokens dark()`, `BoardTokens light()`.
- `class I18n { I18n(this.messages); final Map<String, String> messages; String t(String key, [Map<String, String>? params]); static Map<String, String> flatten(Map<String, dynamic> json, [String prefix = '']); }`
- `Future<I18n> loadI18n(String serverUrl, String locale)`.
- `class AppState extends ChangeNotifier` with `String locale`, `bool isLight`, `List<IngredientRef> basket`, `void setLocale(String)`, `void toggleTheme()`, `void toggleIngredient(IngredientRef)`, `void clearBasket()`.
- `class AppScope extends InheritedNotifier<AppState> { static AppState of(BuildContext); }`

- [ ] **Step 1: Write the failing i18n tests**

`test/i18n_test.dart`:
```dart
test('flattens nested catalogues to dot keys', () {
  final map = I18n.flatten({'dishes': {'title': 'Dishes'}, 'common': {'appName': 'What dish to cook today?'}});
  expect(map['dishes.title'], 'Dishes');
});

test('interpolates named parameters and keeps unknown ones', () {
  final i18n = I18n({'home.ready': '{n} ingredients ready'});
  expect(i18n.t('home.ready', {'n': '3'}), '3 ingredients ready');
});

test('returns the key when a translation is missing', () {
  expect(I18n({}).t('nav.about'), 'nav.about');
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `cd flutter_web_dev; flutter test test/i18n_test.dart`
Expected: compile error, `I18n` is not defined.

- [ ] **Step 3: Implement tokens, theme, i18n and state**

- `BoardTokens` carries `bg, raised, line, lineStrong, ink, dim, red, danger, amber, green`, plus `radius = 6` and spacing constants `s1..s6`.
- `appTheme(BoardTokens tokens)` returns `ThemeData` with `scaffoldBackgroundColor: tokens.bg`, `fontFamily` unset (system default covers Vietnamese), `dividerColor: tokens.line`, `textTheme` body 14 px, `splashFactory: NoSplash.splashFactory`.
- `I18n.flatten` walks maps recursively, joins with `.`, stringifies leaves; `t` replaces `{name}` for each param and returns the key on a miss.
- `loadI18n` GETs `serverUrl + 'public/i18n/' + locale + '.json'`, decodes, flattens.
- `AppState` defaults `locale = 'en'`, `isLight = false`, empty basket; every mutator calls `notifyListeners()`; `setLocale` reloads nothing (catalogues are loaded together in Task 3).

- [ ] **Step 4: Run the tests and verify they pass**

Run: `cd flutter_web_dev; flutter test test/i18n_test.dart`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add flutter_web_dev/lib/theme flutter_web_dev/lib/i18n flutter_web_dev/lib/state flutter_web_dev/test/i18n_test.dart
git commit -m "feat(flutter): theme tokens, shared-catalogue i18n and app state"
```

---

### Task 2: API client and models

**Files:**
- Create: `lib/api/api_client.dart`, `lib/api/models.dart`
- Test: `test/api_models_test.dart`

**Interfaces:**
- `class ApiClient { ApiClient(this.baseUrl); final String baseUrl; Future<dynamic> getJson(String path); String imageUrl(String path); }` where `getJson` strips the trailing slash on the base URL, decodes the body, and returns `data` when the envelope has one.
- `class IngredientRef { final String id; final String name; final String nameVi; final String type; final String image; String label(String locale); }`
- `class DishPreview { final String id; final String name; final String nameVi; final String shortDetail; final String shortDetailVi; final String image; final int matchCount; final int totalIngredients; final List<String> ingredientNames; String label(String locale); String detail(String locale); }`
- `class DishPost { final String id; final String name; final String nameVi; final String shortDetail; final String shortDetailVi; final String image; final List<String> extraImages; final List<DisplayBlock> blocks; }`
- `class DisplayBlock { final String type; final String text; final String textVi; final String src; final double fontSize; final String color; final String fontWeight; final String fontStyle; final String textAlign; String label(String locale); }`
- Parsers return empty lists on unexpected JSON, never throw.

- [ ] **Step 1: Write failing model tests**

`test/api_models_test.dart` covers: envelope `{isSuccess, data}` and bare list; `name_vi` fallback when Vietnamese is empty; `match_count`/`total_ingredients`; display block language fallback; unknown block type skipped.

- [ ] **Step 2: Run and watch fail**

Run: `cd flutter_web_dev; flutter test test/api_models_test.dart`
Expected: compile error on missing classes.

- [ ] **Step 3: Implement the client and parsers**

Keep the existing `DishPreview.listFromJson` behaviour for the old test file. New classes live beside it; old classes stay until Task 3 wiring replaces their callers.

- [ ] **Step 4: Test green**

Run: `cd flutter_web_dev; flutter test`
Expected: old 4 tests plus the new ones pass.

- [ ] **Step 5: Commit**

```bash
git add flutter_web_dev/lib/api flutter_web_dev/test/api_models_test.dart
git commit -m "feat(flutter): API client and bilingual models"
```

---

### Task 3: Board shell, routing and bootstrap

**Files:**
- Create: `lib/app.dart`, `lib/shell/app_shell.dart`, `lib/shell/nav_bar.dart`, `lib/shell/app_footer.dart`, `lib/widgets/board_card.dart`
- Modify: `lib/main.dart`
- Test: `test/shell_test.dart`

**Interfaces:**
- `class BoardApp extends StatefulWidget` loads both catalogues, holds `AppState`, renders `MaterialApp` with `onGenerateRoute`.
- Routes: `/`, `/dishes`, `/dish`, `/ingredients`, `/ingredient`, `/homemade`, `/about`, with query parameters `q`, `id`, `dish_id`.
- `AppShell({required String active, required Widget child})` renders header, body, footer.
- `NavBar({required String active})` uses `AppScope.of(context)` for locale and theme.
- `BoardCard({required Widget child, EdgeInsets padding})` is the ruled surface.

- [ ] **Step 1: Write the failing shell test**

`test/shell_test.dart`: pump the board app with a fake `I18n` map at 360×640 and assert brand text, three nav links and no `RenderFlex overflowed` exception; pump at 1200×800 and assert the same links plus the account icon.
Replace `lib/main.dart` bootstrap only after this test exists.

- [ ] **Step 2: Run and watch fail**

Run: `cd flutter_web_dev; flutter test test/shell_test.dart`
Expected: fails because `BoardApp` does not exist or a `RenderFlex` overflow is reported.

- [ ] **Step 3: Implement the shell**

- Header grid mirrors the Vue order: brand, search, language EN/VI, theme toggle, account icon (static link to the future sign-in), then a scrollable nav row.
- Use `LayoutBuilder`; below 640 the search takes a full second row, at 640+ it sits beside the brand and tools.
- Keep the root `setPathUrlStrategy()` in `main.dart`; initial route `/` renders `HomeScreen` directly.
- All copy via `I18n.t`, including `aria` equivalents through `Semantics(label:)`.

- [ ] **Step 4: Test green at both widths**

Run: `cd flutter_web_dev; flutter test test/shell_test.dart`
Expected: 2 tests pass, no overflow exceptions.

- [ ] **Step 5: Commit**

```bash
git add flutter_web_dev/lib/app.dart flutter_web_dev/lib/shell flutter_web_dev/lib/widgets flutter_web_dev/lib/main.dart flutter_web_dev/test/shell_test.dart
git commit -m "feat(flutter): board shell with responsive header, nav and routes"
```

---

### Task 4: Home ingredient picker

**Files:**
- Create: `lib/screens/home_screen.dart`
- Modify: `lib/shell/app_shell.dart` (route wiring)

**Interfaces:**
- Uses `ApiClient.getJson('/api/ingredient/selection/')`, `/api/ingredient/search/keyword/{q}` and `/api/dish/profile/get_best_dish_post`.
- Basket lives in `AppState`.

- [ ] **Step 1: Write the failing widget test**

At 360×640, with a fake API returning two ingredients, tapping a chip adds it to the basket and shows `home.ready` copy; tapping the CTA without a basket shows `home.needOne`.

- [ ] **Step 2: Run and watch fail**

- [ ] **Step 3: Implement the screen**

Group by `type` with the same order Food, Spice, Fruit, Other; debounce search 250 ms; chips show `+`/`−`; the best-dish card links to the dish detail route.

- [ ] **Step 4: Test green and analyze**

`flutter test` and `flutter analyze --no-fatal-infos` (no new findings).

- [ ] **Step 5: Commit**

---

### Task 5: Dishes list and grid

**Files:**
- Create: `lib/screens/dishes_screen.dart`

**Interfaces:**
- Reads `/api/dish/selection/`, `/api/dish/selection/ingredients/{ids}`, `/api/dish/search/keyword/{q}`.
- Query `q` from the route; view mode remembered in `AppState` (`list` default).

- [ ] **Step 1: Failing test** — at 360 px the list row hides the description, shows the match count and ingredient line; the grid clamps description to two lines; switching view changes the layout.
- [ ] **Step 2: Run and watch fail.**
- [ ] **Step 3: Implement** list rows (lamp, match, 44 px thumb, name, ingredients) and grid (equal widths, two-line clamp, tooltip on long-press/hover).
- [ ] **Step 4: Test green** — `flutter test test/dishes_test.dart`.
- [ ] **Step 5: Commit.**

---

### Task 6: Dish detail, ingredients, homemade, about

**Files:**
- Create: `lib/screens/dish_detail_screen.dart`, `lib/screens/ingredients_screen.dart`, `lib/screens/ingredient_detail_screen.dart`, `lib/screens/homemade_screen.dart`, `lib/screens/about_screen.dart`.

**Interfaces:**
- Detail loads `/api/dish/profile/get_dish/{id}` then `/api/dish/profile/get_dish_post/{best_post_id}`; renders cover, extra images, blocks with size/colour/weight/style/align, ingredients, and read-only comments.
- Ingredient detail loads `/api/ingredient/profile/get_ingredient/{id}` and its post.
- All copy through `I18n`.

- [ ] **Step 1: Failing tests** — detail renders a text block in Vietnamese when only `text_vi` exists; a dish without a photo shows the placeholder; homemade empty answer shows `homemade.empty`.
- [ ] **Step 2: Run and watch fail.**
- [ ] **Step 3: Implement the four screens** and route wiring.
- [ ] **Step 4: Test green** — `flutter test`.
- [ ] **Step 5: Commit.**

---

### Task 7: Build, copy and record

**Files:**
- Modify: `server/web/` (generated build), `docs/impl/2026-11-17-flutter-foundation.md`, `docs/KNOWN_ISSUES.md`

- [ ] **Step 1: Full verification**

```bash
cd flutter_web_dev; flutter test; flutter analyze --no-fatal-infos
flutter build web --base-href /flutter/
```
Expected: tests pass, analyzer no new findings, build succeeds.

- [ ] **Step 2: Copy the build**

Remove the old contents of `server/web/` and copy `flutter_web_dev/build/web/*` in, keeping `server/web/` as generated output. Confirm `server/web/index.html` references `/flutter/` assets.

- [ ] **Step 3: Live check**

Load `http://localhost:3000/flutter/` and `http://localhost:3000/flutter/dishes` in the browser tool at 360 and 1200 px: no console errors, header layout matches Vue, dish rows render, and the direct deep link resolves.

- [ ] **Step 4: Record**

Write `docs/impl/2026-11-17-flutter-foundation.md` with what shipped, the API list, measured widths, and the deferred phases 2–4. Update `KNOWN_ISSUES.md` if the two clients differ in any user-visible way.

- [ ] **Step 5: Commit**

```bash
git add server/web flutter_web_dev docs
git commit -m "feat(flutter): read-only parity with the Vue client"
```

---

## Later phases (not in this plan)

- **Phase 2 — account:** sign-in, sign-up, cookie session via `BrowserClient()..withCredentials = true`, profile, comments, votes, my-posts.
- **Phase 3 — editors:** dish and ingredient editors, file upload, drag and drop (adds `file_picker`/`desktop_drop`), block editor, optional translation through `/api/translate`.
- **Phase 4 — parity polish:** theme and copy audit against Vue at every width, accessibility pass, image and font loading, release build and docs.
