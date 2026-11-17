---
version: 1
slug: "web-ui"
primary_target: "web_ui"
related_targets: []
---

# Vue UI surface brief

Scope: every Vue screen of "What dish to cook today?", visitor mode Operate. Audience: home cooks deciding dinner from what they have, EN/VI. Job: rank dishes against the ingredients on hand, then let the cook open one. Proof: real catalog data only, empty states honest. Constraints: EN+VI catalog, no component library, standard web controls.

## Direction contract

THESIS: The catalog is a market board, not a feed: one dense ruled list where what you can cook now is ranked and visibly marked, refusing the card-grid default.

OWN-WORLD: Deep chalk green-black ground, chalk off-white type, price-red accent, market green and amber for availability; one bold condensed sans that carries Vietnamese diacritics (Be Vietnam Pro) with tabular numerals; hairline rules; each ingredient group owns one persistent colour.

STORY: The visitor reads dinner candidates ranked by what they already have, understands why each row ranks there, and opens one to cook; adding an ingredient visibly re-ranks the board.

FIRST VIEWPORT: Standard top bar (product name, search, EN/VI, account) above a deep chalk ground split into a sticky picker panel (ingredient chips, remove, primary "Find dishes") and the board: full-width ruled rows, each with a status lamp, a large tabular match number, the dish name in both languages as available, the deciding ingredients inline, time to cook, and a fixed-crop thumbnail.

FORM: position 1 of 7 on the grounded list (wet-market chalk price board); seed: e51e7a184643ffe1

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: exact type scale values and motion timing, decided during the build and recorded in DESIGN.md.
