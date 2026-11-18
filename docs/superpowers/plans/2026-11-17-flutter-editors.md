# Flutter Client Phase 3 — Editors Implementation Plan

> Execute in the main session, then dispatch one fresh reviewer per task before the next starts.

**Goal:** Match the Vue editors in Flutter: dish and ingredient create/edit, cover and extra image uploads, drag-and-drop, the text/image block editor with formatting, and the optional EN→VI translation toggle.

**Architecture:** Editors are two screens under `lib/screens/`, sharing `EditorImageField` (pick/drop/upload), `BlocksEditor` (list of text or image blocks with formatting and reordering) and `TranslationToggle` in `lib/editor/`. Uploads go through `http.MultipartRequest` on the credentialed client to `/api/gallery_upload/temporary`; the server moves files when the post is saved. Editing is gated on a session exactly like the Vue routes.

**Tech Stack:** Flutter 3.32.8, `file_picker` (web), `desktop_drop` (drag-and-drop), `package:http` multipart, existing API routes.

**Spec:** Phase 3 of [the Flutter foundation plan](2026-11-17-flutter-foundation.md). API shapes: `docs/API.md` (uploads, translate) and `server/routes/api/dish_profile.js`.

## Global Constraints

- Two new dependencies only: `file_picker`, `desktop_drop`. No state-management or rich-text package.
- Copy from the shared catalogues; no user-visible literals beyond the brand.
- Editor routes require a session; guests are sent to `/signin` with a `next` route.
- Images accept PNG/JPEG only, 5 MB limit, as the server enforces.
- Blocks keep the same JSON shape Vue writes: `type`, `text`, `text_vi`, `src`, `font_size`, `color`, `font_weight`, `font_style`, `text_align`.
- Existing 49 tests stay green; analyzer stays at 58.
- Never edit `server/web/` by hand; rebuild and copy.

## File structure

| Path | Responsibility |
|---|---|
| `lib/editor/editor_image_field.dart` | pick or drop an image, upload, show preview/remove |
| `lib/editor/blocks_editor.dart` | text and image blocks, formatting toolbar, reorder, delete |
| `lib/editor/translation_toggle.dart` | switch plus field translation through `/api/translate` |
| `lib/editor/editor_api.dart` | multipart upload helper, translate helper, save calls |
| `lib/screens/dish_editor_screen.dart` | dish create/edit form |
| `lib/screens/ingredient_editor_screen.dart` | ingredient create/edit form |
| `lib/shell/nav_bar.dart` | New dish entry for signed-in users |
| `lib/app.dart` | `/dish-edit`, `/ingredient-edit` routes |
| `test/editor_api_test.dart` | multipart shape, translation, failure copy |
| `test/blocks_editor_test.dart` | add, move, delete, formatting, EN/VI fallback |
| `test/dish_editor_test.dart` | validation, create payload, guest guard |

## Tasks

### Task 1: Dependencies, upload helper, translate helper

- [ ] Add `file_picker` and `desktop_drop`; `flutter pub get`.
- [ ] Failing tests: multipart request targets `/api/gallery_upload/temporary`, carries `file`, returns `path`; non-200 answers surface `common.errorBody`; translate posts `text/source/target` and returns `text`.
- [ ] Implement `EditorApi.upload(file bytes, filename)` and `translate(text, source, target)` with the existing `ApiClient` credentials; reject files over 5 MB and non-PNG/JPEG before the request.
- [ ] Test green, analyze 58, commit, reviewer.

### Task 2: Shared image field and block editor

- [ ] Failing tests: text block add/edit/remove/reorder; image block from upload; formatting changes bold/italic/size/colour/align; VI field falls back to EN.
- [ ] Implement `EditorImageField` (click to pick, drag to drop, preview, remove) and `BlocksEditor` with the Vue toolbar layout.
- [ ] Test green, analyze, commit, reviewer.

### Task 3: Dish editor screen and route

- [ ] Failing tests: guest is redirected; empty both-language name blocks save; create posts the documented payload; edit loads an existing post; cover and extra images upload.
- [ ] Implement `DishEditorScreen` over `/api/dish/profile/create_dish`, `create_dish_post`, `get_dish`, `get_dish_post`; ingredient picker over the selection endpoint; publish/cancel.
- [ ] Add the header New dish entry for signed-in users and the `/dish-edit` route.
- [ ] Test green, analyze, commit, reviewer.

### Task 4: Ingredient editor screen and route

- [ ] Failing tests: create payload; type select; image upload; edit loads.
- [ ] Implement `IngredientEditorScreen` over `/api/ingredient/profile/create_ingredient` and `create_ingredient_post`; route `/ingredient-edit`.
- [ ] Test green, analyze, commit, reviewer.

### Task 5: Translation toggle across fields and blocks

- [ ] Failing tests: toggle off makes no request; toggle on translates the English name into the empty VI field; an existing VI value is never overwritten; blocks translate on blur.
- [ ] Implement `TranslationToggle` and wire fields + blocks.
- [ ] Test green, analyze, commit, reviewer.

### Task 6: Build, copy, record

- [ ] `flutter test`, `flutter analyze --no-fatal-infos`, `flutter build web --base-href /flutter/`.
- [ ] Copy to `server/web/`; check `/flutter/dish-edit` and `/flutter/ingredient-edit` answer 200; update the implementation record and `KNOWN_ISSUES.md`.
- [ ] Commit, whole-branch reviewer.

## Review Focus

- Upload limits: 5 MB and PNG/JPEG rejected client-side before a wasted request; the server still enforces.
- Lost edits: navigating away with unsaved text; double-submit while saving.
- Translation: never overwrite typed Vietnamese; failures leave the field usable.
- Blocks: reorder at the ends, deleting the only block, empty text blocks.
- Session expiry mid-edit: 401 keeps the form text and sends the user to sign-in with a return route.
- Phone width: toolbar wrapping, drop zones, long ingredient lists.
