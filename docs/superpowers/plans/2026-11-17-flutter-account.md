# Flutter Client Phase 2 — Account Implementation Plan

> **For agentic workers:** Execute task by task in the main session, then dispatch a fresh reviewer per task before the next task starts. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add sign-in, sign-up, profile, comment posting and voting to the Flutter client so it matches the Vue account features.

**Architecture:** One `SessionController` inside `AppState` loads `/api/auth/me` on start, signs in and out through the existing http client, and exposes the current user to the header and screens. The client sends cookies with every request through a web-only `BrowserClient` (`withCredentials`) behind a conditional import, so VM tests keep using the plain client.

**Tech Stack:** Flutter 3.32.8, `package:http` 0.13.5 (`BrowserClient`), Express cookie auth (`token`, httpOnly, 24 h).

**Spec:** Phase 2 of [the Flutter foundation plan](2026-11-17-flutter-foundation.md); API shapes in `docs/API.md` and `server/routes/api/auth.js`, `server/routes/api/dish_profile.js`.

## Global Constraints

- Copy comes from the shared catalogues; no user-visible Dart literals except the brand and `MIT`.
- No new dependency; `BrowserClient` is part of `package:http`.
- Requests must carry the session cookie only on the web; VM tests must compile without `dart:html`.
- Only signed-in users see comment and vote controls; guests see the sign-in link.
- A failed `/auth/me` means guest, never an error screen.
- Existing 25 tests keep passing; `flutter analyze --no-fatal-infos` stays at 58.

## File structure

| Path | Responsibility |
|---|---|
| `lib/api/http_client_stub.dart` | VM/test client |
| `lib/api/http_client_web.dart` | `BrowserClient()..withCredentials = true` |
| `lib/api/api_client.dart` | POST and DELETE helpers, `postJson`, `deleteJson` |
| `lib/api/models.dart` | `Account` model |
| `lib/state/app_state.dart` | `account`, `loadingAccount`, `signIn`, `signUp`, `signOut`, `refreshAccount` |
| `lib/screens/signin_screen.dart` | credential form |
| `lib/screens/signup_screen.dart` | registration form |
| `lib/screens/profile_screen.dart` | account summary, my dishes, my ingredients, sign out |
| `lib/shell/nav_bar.dart` | account entry, sign-in/sign-out |
| `lib/screens/dish_detail_screen.dart` | comment compose/delete, vote button |
| `test/account_test.dart` | session state + sign-in widget test |
| `test/detail_actions_test.dart` | comment and vote controls |

## Tasks

### Task 1: Credentialed HTTP, account state, auth screens

- [ ] Write failing tests: sign-in POST body shape; failed sign-in keeps the guest state and shows the error copy; `/auth/me` populates `AppState.account`; sign-out clears it.
- [ ] Add conditional client, POST/DELETE helpers, `Account` model, `AppState` auth methods.
- [ ] Build `SignInScreen` and `SignUpScreen` with validation, busy state, API error text and a link between them.
- [ ] Routes `/signin`, `/signup`; header account entry: icon when guest (to `/signin`), username + Sign out from 1024 px, icon to `/profile` below.
- [ ] `flutter test` green, analyze 58, commit, reviewer pass.

### Task 2: Profile screen

- [ ] Failing test: profile shows username and joined date, lists my dishes, lists my ingredients, Sign out returns to home.
- [ ] Implement `ProfileScreen` over `/api/auth/me`, `/api/dish/profile/mine`, `/api/ingredient/profile/mine`; route `/profile`.
- [ ] Test green, analyze, commit, reviewer pass.

### Task 3: Comments and votes on dish detail

- [ ] Failing tests: guest sees the sign-in prompt and no compose box; signed-in user posts a comment and the list refreshes; vote toggles the count.
- [ ] Implement compose box (max 1000), delete own comment with confirmation, vote button with points; hide controls for guests.
- [ ] Test green, analyze, commit, reviewer pass.

### Task 4: Build, copy, record

- [ ] `flutter test`, `flutter analyze --no-fatal-infos`, `flutter build web --base-href /flutter/`.
- [ ] Replace `server/web/` with the build; check `/flutter/`, `/flutter/signin`, `/flutter/profile` answer 200.
- [ ] Update `docs/impl/2026-11-17-flutter-foundation.md` and `KNOWN_ISSUES.md`; commit; whole-branch reviewer pass.

## Review Focus

- Session cookie in production: `BrowserClient` must set `withCredentials`; a sign-in that "works" but loses the cookie on reload is the main failure.
- Guest state after an expired token: `/auth/me` failing must clear the account and not block browsing.
- Comment length and empty body: the server rejects both; the client must prevent the request.
- Vote double-tap: one request at a time; the button reflects the server's `voted`/`points`.
- Long username in the header at 1024 px and the profile list at 320 px.
