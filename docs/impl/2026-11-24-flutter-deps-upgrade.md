# Flutter dependency majors — implementation

Implements Stage C of [docs/superpowers/plans/2026-11-24-major-upgrades.md](../superpowers/plans/2026-11-24-major-upgrades.md).

## Goal

Move `flutter_web_dev` to `http 1.x` and `url_strategy 0.3.x` without changing behavior, adopt `cupertino_icons 2.x` on the Flutter 3.50 toolchain, then rebuild `server/web`.

## Files

| File | Responsibility |
|---|---|
| `flutter_web_dev/pubspec.yaml` | Constraint bump only; no new packages |
| `flutter_web_dev/pubspec.lock` | Resolved by `flutter pub upgrade` |
| `server/web/` | Generated Flutter build, refreshed from `flutter_web_dev/build/web/` |
| `docs/impl/2026-11-24-flutter-deps-upgrade.md` | This record |

## Interfaces

No Dart source interface changes. Transport stays `FetchClient` from `fetch_client`, which now resolves to `1.2.1` and requires `http ^1.5.0`, so `ApiClient.send` keeps returning a streaming `http.StreamedResponse` and `AiApi.streamChat` keeps parsing SSE incrementally.

## Toolchain blocker

`cupertino_icons 2.0.0` declares `environment: sdk: ^3.12.0`. The project ran Flutter 3.32.8 / Dart 3.8.1, and `.github/workflows/ci.yml` pinned `flutter-version: 3.32.8`. Resolution failed:

```
Because what_dish_to_cook_today depends on cupertino_icons >=1.0.9 which requires SDK version >=3.9.0 <4.0.0, version solving failed.
```

Decision taken: ship `http 1.6` and `url_strategy 0.3` now; the toolchain has since moved to Flutter 3.50.1 / Dart 3.14.0, which resolves `cupertino_icons 2.x`.

## Tasks

- [x] Bump `http` to `^1.6.0` and `url_strategy` to `^0.3.0`; resolve the lockfile.
- [x] `flutter test` proves 92 tests, including `test/ai_api_test.dart` streaming cases.
- [x] `flutter analyze --no-fatal-infos` reports no error or warning.
- [x] `flutter build web --base-href /flutter/` succeeds and is copied into `server/web/`.

## Result (2026-11-24)

| Item | Value |
|---|---|
| `http` | `0.13.5` → `1.6.0` |
| `url_strategy` | `0.2.0` → `0.3.0` (pub marks it discontinued) |
| `cupertino_icons` | `1.0.5` → `2.0.0` (Flutter 3.50.1) |
| `fetch_client` | `1.0.2` → `1.2.1` (transitive) |
| `fetch_api` | `1.0.3` → `2.3.2` (transitive) |
| `flutter test` | `+92: All tests passed!` on Flutter 3.50.1 |
| `flutter analyze --no-fatal-infos` | 74 infos, 0 errors, 0 warnings; most are the new 3.47 `material.dart` deprecation |
| `flutter build web --base-href /flutter/` | `√ Built build\web`, 34.3s; `index.html` template warnings unchanged |
| `server/web` | Refreshed from `build/web`; `<base href="/flutter/">` unchanged |

## Verification

```bash
cd flutter_web_dev
flutter test                        # +92: All tests passed!
flutter analyze --no-fatal-infos    # 30 issues found, all info
flutter build web --base-href /flutter/
git checkout -- windows/flutter     # dropped generated plugin noise
```

## Accepted risks

- `http 1.x` breaks 0.x users in the abstract, but this client only uses `Request`, `send`, `StreamedResponse.stream` and `MockClient`, all present in 1.x.
- `url_strategy 0.3` is discontinued on pub; it is used only through `setPathUrlStrategy()` in `lib/main.dart`, so it stays until the router work replaces it.
- `cupertino_icons 1.0.8` ships a different icon font asset, so `server/web/assets/packages/cupertino_icons/assets/CupertinoIcons.ttf` changed.
