# Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Vue screen usable from 320 px phones up to wide desktops without horizontal scroll, oversized headers, clipped rows or touch targets under 30 px.

**Architecture:** Mobile-first CSS in `theme.css` plus small template changes where a different structure is needed rather than a different width. The header becomes a CSS grid with named areas; list rows collapse their secondary text at the small breakpoint; the editor keeps its dense controls but raises touch targets on narrow screens. No new component, dependency or route.

**Tech Stack:** Vue 3 SFCs, Tailwind 4 utilities, unlayered CSS in `web_ui/src/assets/css/theme.css`, Vite build served by Express.

**Spec:** this plan implements the owner's request "make the application more responsive when the size is reduced", under the surface brief `.impeccable/surfaces/web-ui.md` (mode Operate: scanability, density, native expectations) and PRODUCT.md.

## Global Constraints

- Compact density stays: no control grows above 34 px tall; body text stays 14 px; `.board` stays 1080 px wide on desktop.
- Brand text `What dish to cook today?` is never translated and never truncated away.
- English and Vietnamese must both fit; Vietnamese strings are longer, so every flexible text container needs `min-width: 0` and truncation.
- Only Font Awesome icons already registered in `web_ui/src/plugins/fontAwesome.js`; no emoji, no new icon library.
- Never hand-edit `server/web/` or `server/web_ui/`; the build writes `server/web_ui`.
- Theme colours come from existing tokens; no new colour.
- Unlayered CSS in `theme.css` beats Tailwind utilities, so every width, padding or display decision in this plan goes into `theme.css`, not into a Tailwind class that a `theme.css` rule already sets.

## Baseline (measured today, red)

Temporary harness `server/public/_probe.html` (untracked, deleted in Task 7) renders each route in an iframe of a fixed width and reports geometry.

| Check | Now | Target |
|---|---|---|
| Header height at 320 px | 218 px | ≤ 136 px |
| Header height at 360 px | 146 px | ≤ 132 px |
| Header height at 768 px | 137 px | ≤ 92 px |
| Header height at 1024 px | 87 px | ≤ 90 px |
| Dishes list text column at 360 px | 157 px, description clipped | ≥ 180 px, description hidden below 640 |
| Header controls under 32 px tall | search 30, EN 30, VI 30, theme 30, links 28 | ≥ 30 px, inputs 34 px below 640 |
| Horizontal document scroll | none | none, at every width |

## Screen coverage matrix

Breakpoints: **XS** 320–399, **S** 400–639, **M** 640–1023, **L** 1024+.

| Screen | XS / S (stacked) | M (two columns where useful) | L (current desktop) |
|---|---|---|---|
| Header | brand + icon tools row; search full width; nav strip scrolls | brand + search + tools in one row; nav below | same, account shows name and Sign out |
| Home | picker card, then dish-of-day aside | same, cards full width | picker 2/3 + aside 1/3 |
| Dishes list | lamp, match, 44 px thumb, name + ingredients, description hidden | description returns | current compact row |
| Dishes grid | 1 column | 2 columns | 3 columns |
| Dish detail | title, vote row under title, cover, single column body then comments | same | body 2/3 + comments 1/3 |
| Dish/ingredient editor | one field per row, full-width dropzones, block toolbar wraps | 2-column field grid | narrow 768 px column, not full 1080 |
| Ingredients list | name over description, both truncated | description on its own line | current row |
| Ingredient detail | single column | single column | single column |
| Homemade | current single column, description wraps | same | same |
| About | full width, comfortable measure | 768 px column | 768 px column |
| Auth (sign in/up) | full width form | 512 px form | 512 px form |
| Profile | stacked lists | 2 columns | 2 columns |
| Footer | 1 column, safe-area bottom | 3 columns | 3 columns |

Landscape phone (e.g. 667×375) uses the M rules; vertical scrolling is expected. Large screens (1440+) keep the 1080 px board.

## File structure

- Modify `web_ui/index.html` — viewport meta gains `viewport-fit=cover`.
- Modify `web_ui/src/assets/css/theme.css` — one responsive section at the end: header grid, mobile touch sizes, row tweaks, narrow board classes, safe areas.
- Modify `web_ui/src/components/navbar.vue` — four grid children, icon account entry, no duplicated markup.
- Modify `web_ui/src/views/dishes_view.vue` — row markup that can drop its description.
- Modify `web_ui/src/views/dish_detail_view.vue` — vote block below the title on narrow screens.
- Modify `web_ui/src/views/ingredients_view.vue` — stacked name/description.
- Modify `web_ui/src/views/about_view.vue`, `dish_edit_view.vue`, `ingredient_edit_view.vue`, `signin_view.vue`, `signup_view.vue`, `home_view.vue` — replace dead `max-w-*` utilities with the new board classes.
- Modify `docs/impl/2026-11-17-vue-ui.md` — record the responsive pass.

## Review Focus

- Long Vietnamese names and descriptions with diacritics: they must truncate, never push the row wider or hide the lamp.
- 320 px viewport: the header must still show the brand, both language buttons, theme and account icon.
- Landscape phone 667×375: the header must not consume more than ~130 px of the 375 px height.
- Keyboard-only use of the scrollable mobile nav: focusing the last link must scroll it into view.

---

### Task 1: Shell, safe areas and board widths

**Files:**
- Modify: `web_ui/index.html:6`
- Modify: `web_ui/src/assets/css/theme.css` (append responsive section)
- Modify: `web_ui/src/views/about_view.vue:12`, `web_ui/src/views/dish_edit_view.vue:191`, `web_ui/src/views/ingredient_edit_view.vue:136`, `web_ui/src/views/signin_view.vue:34`, `web_ui/src/views/signup_view.vue:41`, `web_ui/src/views/home_view.vue:117`

**Interfaces:**
- Produces: `.board-narrow` (max-width 768 px), `.board-form` (max-width 512 px), `.measure` (max-width 62 ch) for later tasks and existing views.

- [ ] **Step 1: Add the temporary probe harness**

Create `server/public/_probe.html` (untracked; deleted in Task 7). It loads `http://localhost:3000<path>` in an iframe whose width comes from `?w=`, waits 1200 ms, and writes JSON into `#out` with `headerH`, `scrollW`, `overflow` (elements whose right edge exceeds the width), `rows` (rects of header children), `clipped` (leaf text with `scrollWidth > clientWidth`), `small` (interactive elements under 32 px tall) and `grid` (computed `grid-template-columns`). Read it through `browser.evaluate` on the parent page.

- [ ] **Step 2: Measure the baseline**

Run the probe for `/`, `/dishes`, `/dish_detail?dish_id=<any seeded id>`, `/ingredients`, `/dish_edit`, `/profile`, `/about`, `/signin` at widths 320, 360, 390, 640, 768, 1024, 1440.
Expected: values in the Baseline table, header 218 at 320.

- [ ] **Step 3: Change the viewport meta**

`web_ui/index.html:6` becomes:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 4: Add board width classes and safe areas to `theme.css`**

Append:
```css
/*Width variants: Tailwind max-w-* utilities lose to the unlayered .board rule above*/
.board-narrow { max-width: 768px; }
.board-form { max-width: 512px; }
.measure { max-width: 62ch; }

main { padding-bottom: var(--space-2); }

.site-footer .footer-bottom-row {
    padding-bottom: max(14px, env(safe-area-inset-bottom));
}
```

- [ ] **Step 5: Replace the dead width utilities in the views**

`about_view.vue:12` → `class="board board-narrow py-6"`; `dish_edit_view.vue:191` and `ingredient_edit_view.vue:136` → `class="board board-narrow py-6"`; `signin_view.vue:34` and `signup_view.vue:41` → `class="board board-form py-10"`; `home_view.vue:117` → `class="board-sub measure"`.

- [ ] **Step 6: Build and measure**

Run `cd web_ui; npm run build`.
Probe `/signin` at 1440: form column ≤ 512 px. Probe `/dish_edit` at 1440: section ≤ 768 px. Probe `/about` at 360: no horizontal overflow.
Expected: PASS, and no route gains horizontal scroll.

- [ ] **Step 7: Commit**

```bash
git add web_ui/index.html web_ui/src/assets/css/theme.css web_ui/src/views server/web_ui
git commit -m "fix(web): working board width variants, safe-area padding and viewport-fit"
```

---

### Task 2: Header grid

**Files:**
- Modify: `web_ui/src/components/navbar.vue:34-101`
- Modify: `web_ui/src/assets/css/theme.css` (replace the `.site-header` block at lines 415-458, keep the search rules)

**Interfaces:**
- Produces: `.header-bar` grid, `.header-search`, `.header-tools`, `.header-nav`, `.account-link`, `.account-name`, `.account-signout`.
- Consumes: `.board`, `.btn`, `.icon-only`, `.search-wrap` from `theme.css`; `faCircleUser` already registered.

- [ ] **Step 1: Restructure the navbar markup**

`navbar.vue` becomes four children of `.board.header-bar`:

```html
<header class="site-header border-b" style="border-color: var(--board-line)">
  <div class="board header-bar">
    <router-link to="/" class="board-title brand">What dish to cook today?</router-link>

    <form class="header-search" role="search" @submit.prevent="submitSearch">
      <!-- existing label + .search-wrap + .search-input + .search-go, unchanged -->
    </form>

    <div class="header-tools">
      <!-- existing EN and VI buttons, unchanged -->
      <!-- existing theme switch button, unchanged -->
      <template v-if="auth.isLogin">
        <router-link to="/profile" class="btn btn-quiet account-link">
          <font-awesome-icon :icon="['fas', 'circle-user']" />
          <span class="account-name">{{ auth.user?.username || t('nav.profile') }}</span>
        </router-link>
        <button class="btn btn-quiet account-signout" type="button" @click="signOut">{{ t('nav.signOut') }}</button>
      </template>
      <template v-else>
        <router-link to="/signin" class="btn btn-quiet account-link">
          <font-awesome-icon :icon="['fas', 'circle-user']" />
          <span class="account-name">{{ t('nav.signIn') }}</span>
        </router-link>
        <router-link to="/signup" class="btn btn-quiet account-signout">{{ t('nav.signUp') }}</router-link>
      </template>
    </div>

    <nav class="header-nav" aria-label="Main">
      <!-- four existing router-links, unchanged -->
    </nav>
  </div>
</header>
```

Remove the old `.board.py-3.flex.flex-col` wrapper, the inner `flex flex-wrap` row and the inline `style="font-size: 16px"` on the brand (size now lives in CSS).

- [ ] **Step 2: Write the header CSS**

Replace the existing `.site-header` rules (lines 415-458) with:

```css
.site-header .btn {
    padding: 0 10px;
    height: 30px;
    font-size: 13px;
    line-height: 1;
}

.site-header .icon-only { width: 30px; padding: 0; }

.site-header .brand {
    grid-area: brand;
    white-space: nowrap;
    font-size: 13px;
}

.header-bar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
        "brand tools"
        "search search"
        "nav nav";
    align-items: center;
    column-gap: 8px;
    row-gap: 6px;
    padding-top: max(8px, env(safe-area-inset-top));
    padding-bottom: 8px;
}

.header-search {
    grid-area: search;
    width: 100%;
    min-width: 0;
    max-width: none;
}

.header-tools {
    grid-area: tools;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
}

.header-nav {
    grid-area: nav;
    display: flex;
    align-items: center;
    gap: 16px;
    overflow-x: auto;
    scrollbar-width: none;
}

.header-nav::-webkit-scrollbar { display: none; }

.header-nav a {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    white-space: nowrap;
}

.account-name, .account-signout { display: none; }

@media (max-width: 399px) {
    .site-header .board { padding-left: 12px; padding-right: 12px; }
    .site-header .brand { font-size: 12px; }
    .site-header .btn { padding: 0 6px; }
    .site-header .icon-only,
    .site-header .account-link { width: 30px; }
}

.site-header .search-input {
    height: 34px;
    min-height: 34px;
    padding: 4px 34px 4px 10px;
}

.site-header .btn,
.site-header .account-link { height: 34px; min-height: 34px; }

.site-header .icon-only,
.site-header .account-link { width: 34px; padding: 0; justify-content: center; }

.site-header .search-go { height: 30px; }

.site-header nav a.router-link-active {
    border-bottom: 2px solid var(--board-amber);
    padding-bottom: 2px;
}

@media (min-width: 640px) {
    .header-bar {
        grid-template-columns: auto minmax(160px, 1fr) auto;
        grid-template-areas:
            "brand search tools"
            "nav nav nav";
        column-gap: 16px;
        padding-top: 10px;
        padding-bottom: 10px;
    }
    .site-header .brand { font-size: 16px; }
    .header-search { max-width: 360px; justify-self: start; }
    .site-header .search-input { height: 30px; min-height: 30px; }
    .site-header .btn,
    .site-header .account-link,
    .site-header .icon-only { height: 30px; min-height: 30px; }
    .site-header .account-link { width: 30px; padding: 0; }
}

@media (min-width: 1024px) {
    .site-header .account-link { width: auto; padding: 0 10px; }
    .account-name, .account-signout { display: inline; }
}
```

`account-name` stays in the DOM at every width so the icon link keeps an accessible name; only its box is removed by `display: none` on mobile, so add `:aria-label` to the account link bound to the same text.

- [ ] **Step 3: Add the accessible name**

On the account link: `:aria-label="auth.isLogin ? (auth.user?.username || t('nav.profile')) : t('nav.signIn')"`.

- [ ] **Step 4: Measure the header**

Probe `/dishes` at 320, 360, 390, 640, 768, 1024, 1440.
Expected: header ≤ 136 px at 320, ≤ 132 at 360/390, ≤ 92 at 640, ≤ 90 at 1024 and 1440; `scrollW == width` on every run; every header control ≥ 30 px tall and the search field 34 px below 640.

- [ ] **Step 5: Check the scrollable nav moves under focus**

Probe script: focus the last `.header-nav a`, wait a frame, read `nav.scrollLeft` and the link rect.
Expected: the link's rect stays inside the nav's rect (browser scrolls it into view), no page scroll.

- [ ] **Step 6: Commit**

```bash
git add web_ui/src/components/navbar.vue web_ui/src/assets/css/theme.css server/web_ui
git commit -m "feat(web): responsive header grid with icon account entry"
```

---

### Task 3: Dishes list rows

**Files:**
- Modify: `web_ui/src/views/dishes_view.vue:117-165`
- Modify: `web_ui/src/assets/css/theme.css` (mobile row rules)

**Interfaces:**
- Consumes: `.header-bar` not used here; `.match-number`, `.icon-btn`, `.ruled`, `.row-line` from `theme.css`.
- Produces: `.row-match` class (16 px match count below 640).

- [ ] **Step 1: Change the list row markup**

List branch becomes:

```html
<li v-for="row in rows" :key="row.id" class="row-line">
  <router-link class="flex items-center gap-2 sm:gap-3 p-2" :to="{ path: '/dish_detail', query: { dish_id: row.id } }">
    <span class="lamp" :class="lampClass(row)" aria-hidden="true"></span>
    <span v-if="row.total_ingredients" class="match-number row-match">
      {{ row.match_count }}<span class="text-sm" style="color: var(--board-dim)">/{{ row.total_ingredients }}</span>
    </span>
    <img v-if="row.profile_image" class="w-11 h-11 sm:w-12 sm:h-12 shrink-0 object-cover rounded" :src="image(row.profile_image)" alt="" />
    <span class="flex-1 min-w-0">
      <span class="block font-bold truncate">{{ localName(row) }}</span>
      <span class="hidden sm:block text-xs truncate" style="color: var(--board-dim)">
        {{ locale === 'vi' && row.short_detail_vi ? row.short_detail_vi : row.short_detail }}
      </span>
      <span v-if="ingredientLine(row)" class="block text-xs truncate" style="color: var(--board-dim)">
        {{ ingredientLine(row) }}
      </span>
    </span>
  </router-link>
</li>
```

Ingredient line stays single-line and truncated; the full ingredient list is on the detail page.

- [ ] **Step 2: Add the mobile row rules to `theme.css`**

```css
@media (max-width: 639px) {
    .row-match { font-size: 16px; min-width: 34px; }
    .icon-btn { width: 30px; height: 30px; }
    .chip { min-height: 30px; padding: 4px 10px; }
}
```

- [ ] **Step 3: Measure**

Probe `/dishes` at 360 with pantry items chosen (or any seeded selection): text column ≥ 180 px, description `display: none`, document `scrollW == 360`, row height ≤ 68 px. Probe at 768: description visible again, text column unchanged from today (≥ 500 px).

- [ ] **Step 4: Check the long-name case**

In the probe, inject a 48-character Vietnamese name into the first row's name span, then read `row.scrollWidth`, `row.clientWidth` and the document `scrollW`.
Expected: `row.scrollWidth == row.clientWidth` (truncated, not overflowing) and document scroll unchanged.

- [ ] **Step 5: Commit**

```bash
git add web_ui/src/views/dishes_view.vue web_ui/src/assets/css/theme.css server/web_ui
git commit -m "feat(web): compact mobile dish rows and 30px mobile controls"
```

---

### Task 4: Dish detail header and vote block

**Files:**
- Modify: `web_ui/src/views/dish_detail_view.vue:170-199`

**Interfaces:**
- Consumes: `.match-number`, `.eyebrow`, `.btn`, `.link`.

- [ ] **Step 1: Reflow the header**

Replace the `flex flex-wrap items-start justify-between gap-4` wrapper with `grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-4`, add `min-w-0` to the title column, and wrap the vote column as:

```html
<div class="min-w-0 sm:text-right">
  <div class="flex items-center gap-2 sm:block">
    <p class="match-number">{{ votePoints }}</p>
    <p class="eyebrow">{{ t('dish.vote') }}</p>
    <button
      class="btn ml-auto sm:ml-0 sm:mt-2"
      :class="{ 'btn-primary': voted }"
      type="button"
      :disabled="!auth.isLogin"
      @click="toggleVote"
    >{{ voted ? t('dish.voted') : t('dish.vote') }}</button>
  </div>
  <!-- existing error, sign-in and edit links, unchanged -->
</div>
```

Add `overflow-wrap: anywhere` to the dish title in `theme.css` so a long single-word name cannot overflow.

- [ ] **Step 2: Measure**

Probe `/dish_detail?dish_id=<id>` at 320 and 360: the vote group starts at the same left edge as the title (x ≈ 16 px), the vote button is at the right edge, no horizontal scroll. Probe at 1024: the vote group is still right-aligned as today.

- [ ] **Step 3: Commit**

```bash
git add web_ui/src/views/dish_detail_view.vue web_ui/src/assets/css/theme.css server/web_ui
git commit -m "feat(web): stack the dish vote block under the title on phones"
```

---

### Task 5: Ingredient rows and editor controls

**Files:**
- Modify: `web_ui/src/views/ingredients_view.vue:88-99`
- Modify: `web_ui/src/components/blocks_editor.vue` (no structural change expected; verify toolbar wraps)

**Interfaces:**
- Consumes: `.icon-btn` now 30×30 below 640; `.input` 34 px below 640.

- [ ] **Step 1: Stack the ingredient row text**

```html
<router-link class="flex items-center gap-3 sm:gap-4 p-2" :to="{ path: '/ingredient_detail', query: { ingredient_id: item.id } }">
  <img v-if="item.profile_image" class="w-11 h-11 sm:w-12 sm:h-12 shrink-0 object-cover rounded" :src="image(item.profile_image)" alt="" />
  <span class="flex-1 min-w-0">
    <span class="block font-bold truncate">{{ localName(item) }}</span>
    <span class="block text-xs sm:text-sm truncate" style="color: var(--board-dim)">
      {{ locale === 'vi' && item.short_detail_vi ? item.short_detail_vi : item.short_detail }}
    </span>
  </span>
</router-link>
```

- [ ] **Step 2: Raise text controls on phones**

Append to the same mobile block in `theme.css`:

```css
@media (max-width: 639px) {
    .input, .textarea { min-height: 34px; }
    .btn { min-height: 32px; }
}
```

- [ ] **Step 3: Measure**

Probe `/ingredients` at 320 and 360: name column ≥ 230 px, description on its own line, no clipped text, no horizontal scroll. Probe `/dish_edit` at 360: every block-toolbar `.icon-btn` is 30×30, the toolbar wraps to ≤ 3 lines, the two dropzones are full width, and the save/cancel buttons stay on one row.

- [ ] **Step 4: Commit**

```bash
git add web_ui/src/views/ingredients_view.vue web_ui/src/assets/css/theme.css server/web_ui
git commit -m "feat(web): stacked ingredient rows and larger touch controls on phones"
```

---

### Task 6: Home, profile, homemade and footer smoke pass

**Files:**
- Modify only if a measurement fails: `web_ui/src/views/home_view.vue`, `profile_view.vue`, `homemade_dishes_view.vue`, `footer.vue`, `theme.css`.

- [ ] **Step 1: Measure every remaining route**

Probe `/`, `/homemade`, `/profile`, `/about`, `/signin`, `/signup` at 320, 360, 390, 640, 768, 1024.
Expected: `scrollW == width` on all; home picker card above the aside below 1024; footer single column below 640; chips ≥ 30 px tall; no clipped leaf text outside `.sr-only`; sign-in form ≤ 512 px wide at 1024.

- [ ] **Step 2: Landscape check**

Probe `/dishes` and `/dish_detail` at 667×375 and 844×390 (width only affects the probe; read `headerH` and the first content rect).
Expected: header ≤ 132 px, first content visible without scrolling horizontally, header consumes < 35% of 375 px height.

- [ ] **Step 3: Fix only what failed**

Adjust the matching rule in `theme.css`; do not add new components. Re-run Step 1.

- [ ] **Step 4: Commit if anything changed**

```bash
git add web_ui/src server/web_ui
git commit -m "fix(web): responsive follow-ups from the route sweep"
```

---

### Task 7: Verification, record and cleanup

**Files:**
- Delete: `server/public/_probe.html`
- Modify: `docs/impl/2026-11-17-vue-ui.md`

- [ ] **Step 1: Full automated check**

Run:
```bash
cd web_ui; npm run build; npx vitest run
cd ../server; npm test
```
Expected: build prints `✓ built in …`, vitest 8 passed, server `# pass 34` and `# fail 0`.

- [ ] **Step 2: Final geometry sweep**

Probe all 9 routes at 320, 360, 390, 640, 768, 1024, 1440 one last time.
Expected: every row of the Baseline table met; zero horizontal overflow; zero header controls under 30 px.

- [ ] **Step 3: Visual confirmation**

Capture `/`, `/dishes`, `/dish_detail` and `/dish_edit` at 360 px and at 1440 px (light theme). Check spacing, active amber underline, no overlap, no cut-off text. If screenshots are unavailable because the window is hidden, record that and rely on the geometry probe.

- [ ] **Step 4: Record the pass**

Append to `docs/impl/2026-11-17-vue-ui.md`: the breakpoints used, the measured header heights before/after, the row changes, and the deliberate mobile account behaviour (icon links to profile; Sign out lives on the profile page; Sign up lives on the sign-in page).

- [ ] **Step 5: Remove the probe and commit**

```bash
rm server/public/_probe.html
git add docs/impl/2026-11-17-vue-ui.md server/web_ui
git commit -m "docs: record the responsive pass"
```

- [ ] **Step 6: Report**

Summarise measured numbers per breakpoint and any screen left with a known limitation.
