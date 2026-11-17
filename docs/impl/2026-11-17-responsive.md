# Responsive layout — implementation record

**Goal:** every Vue screen works from 320 px phones to wide desktops without horizontal scroll, oversized headers, clipped rows or touch targets under 30 px.

**Plan:** [2026-11-17-responsive.md](../../docs/superpowers/plans/2026-11-17-responsive.md)

**Approach:** mobile-first CSS in `web_ui/src/assets/css/theme.css` (unlayered, so it beats Tailwind utilities), plus template changes only where the narrow layout needs a different structure. No new component, route or dependency.

## Files

| File | Responsibility |
|---|---|
| `web_ui/index.html` | viewport meta with `viewport-fit=cover` |
| `web_ui/src/assets/css/theme.css` | header grid, mobile touch sizes, row rules, board width variants, safe areas |
| `web_ui/src/components/navbar.vue` | four grid children; icon account entry below 1024 px |
| `web_ui/src/views/dishes_view.vue` | row markup that can drop its description |
| `web_ui/src/views/dish_detail_view.vue` | vote block below the title on narrow screens |
| `web_ui/src/views/ingredients_view.vue` | stacked name and description |
| `web_ui/src/views/about_view.vue`, `dish_edit_view.vue`, `ingredient_edit_view.vue`, `signin_view.vue`, `signup_view.vue`, `home_view.vue` | working width classes |

## Interfaces

- CSS classes: `.board-narrow` (max 768 px), `.board-form` (max 512 px), `.measure` (max 62 ch), `.header-bar`, `.header-search`, `.header-tools`, `.header-nav`, `.account-link`, `.account-name`, `.account-signout`, `.row-match`.
- No JavaScript interface changes. No new i18n keys.

## Test strategy

The project has no DOM test runner, so the check is a temporary harness: `server/public/_probe.html` renders each route in an iframe of a fixed width and reports geometry (header height, document scroll width, clipped text, small controls, grid columns, header child rects). It is the red/green signal for each task, deleted at the end.

Commands: `cd web_ui; npm run build; npx vitest run`, `cd server; npm test`.

## Tasks

- [x] 1. Shell, safe areas, board widths
- [x] 2. Header grid
- [x] 3. Dishes list rows
- [x] 4. Dish detail header and vote block
- [x] 5. Ingredient rows and editor controls
- [x] 6. Home, profile, homemade, footer sweep
- [x] 7. Verification, record, cleanup

## Result

Measured with the probe at every route; 63 route/width combinations, 0 failures.

| Width | Header before | Header after |
|---|---|---|
| 320 px | 218 px | 127 px |
| 360 px | 174 px | 127 px |
| 390 px | 174 px | 127 px |
| 640 px | 137 px | 87 px |
| 768 px | 137 px | 87 px |
| 1024 px | 87 px | 87 px |
| 1440 px | 87 px | 87 px |

- No horizontal scroll at any width, including a 48-character Vietnamese dish name injected into a row.
- Dishes row text column: 157 px → 198 px at 360 px; description removed below 640 px; row 61 px tall.
- Ingredient rows stack name over description, 295 px wide at 360 px.
- Editor at 360 px: inputs 35 px, block-toolbar icons 30×30, dropzones 328 px, toolbar one row.
- Dish detail: vote count, label and button share one row at 320/360 px, button flush right.
- Landscape 667×375 and 844×390: header 87 px, 23% of the viewport height.
- Wide screens: editors 768 px, auth forms 512 px, about 768 px.

Commands: `npm run build` green, `npx vitest run` 8/8, server `npm test` 34/34.

Screenshots could not be captured because the desktop window was not visible to the browser tool; the geometry probe replaced them. Recorded as a gap.

## Rulings

- Ledger workspace kept in `C:\Windows\Temp\opencode\responsive-ledger` instead of a git-ignored repo path, so the working tree stays clean.
- Nav gap 8 px and 12 px link text below 640 px: Vietnamese labels (`Món ăn`, `Món nhà làm`, `Nguyên liệu`, `Giới thiệu`) measure 322 px at 13 px/10 px gap, over the 296 px available at 320 px. At 12 px/8 px they fit, so the nav no longer scrolls in either language. Cost if wrong: nav type is 12 px on phones only.
- Brand link given `min-height: 30px`; its text is 13 px but the tap area meets the touch floor.
- The header nav keeps `aria-label="Main"` in English, matching the existing footer `aria-label="Browse"`; no new bilingual keys were opened for landmark labels.
- The inline "Sign up" sentence link stays 19 px tall; it sits inside prose where a larger box would break the line. Cost if wrong: a harder tap on one secondary link.
- View-switch icon buttons stay 26×24 from 640 px up; the 30×30 floor applies to touch widths only.
- Desktop keeps the 44 px match-count column (`.row-match` base rule); the phone override is 34 px.

## Final review fixes

Five findings from the independent review, all fixed and re-verified:

1. Vietnamese nav overflow at 320 px: re-measured in `vi`, nav now fits (322 px → under 296 px with 12 px text and 8 px gap); keyboard focus on the last link stays inside the nav.
2. Safe-area side insets: `.board` and the sub-400 header padding use `max(padding, env(safe-area-inset-left/right, 0px))` for landscape notch clearance.
3. Focus ring clipping in the scroll container: `outline-offset: -2px` on nav links.
4. Desktop match column: `.row-match { min-width: 44px }` restored at base, 34 px on phones.
5. Block translation race: after the awaited request the editor re-checks that the block still exists, the source is unchanged and the target is still empty. Proven RED→GREEN in the live editor: with the guard disabled, typed Vietnamese was overwritten by `Đánh chín đậu phộng cho đến khi có mùi thơm.`; with the guard in place the typed text survives, and the normal empty-target path still translates.


## Accepted risks and limits

- Below 1024 px the account entry is icon-only; Sign out lives on the profile page and Sign up on the sign-in page. No function is lost.
- Touch targets are 30–34 px, not the 44 px accessibility guideline, to honour the owner's compact-density requirement.
- At 320 px the brand drops to 12 px so brand plus four controls fit one line.
- Tailwind `max-w-*` utilities are ignored on `.board` sections because unlayered CSS wins; the new `.board-*` classes replace them.

## Header and grid refinements

- Sign in / Sign up in the header: the text container used display: inline, which drops the 30 px height and vertical centring once the flex parent blockifies it. Now inline-flex with centring; both entries measure 83x30 and 66x30 at 1024 px and up.
- Search field moved next to the language and theme buttons: desktop grid keeps the brand left with a 24 px margin, the search right-aligned against the tool group (16 px gap) and up to 360 px wide. Measured title gap 40 px at 640/768, 125 px at 1024, 196 px at 1440.
- Dishes grid: equal column widths (318 px at 1024 with a 1024 px window), equal card heights, description clamped to two lines with ellipsis and the full text in the native tooltip via 	itle. Long text check: client 32 px, scroll 48 px, clamp 2.
