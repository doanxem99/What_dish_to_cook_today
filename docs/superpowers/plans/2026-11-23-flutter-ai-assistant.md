# Flutter AI Assistant Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the existing Vue AI assistant (`ask_panel.vue`, `ai.js`, `ask_format.js`, and the profile AI section) to the Flutter web client (`flutter_web_dev`) with full functional parity and zero server changes.

**Architecture:** `flutter_web_dev` adds an `AiApi` client over `ApiClient` (using `ApiClient.send` with `http.Request` for incremental SSE reading and cancellation via a subscription/abort handle), typed AI models and pure formatting helpers in `lib/ai/`, an `AskSheet` drawer/modal launched from `NavBar` and gated by a one-time `/api/ai/status` availability probe on `AppState`, and an AI & Cooking History section on `ProfileScreen`. Dish detail passes its active catalog `dish_id` to `AppState` so `walkthrough` mode has the same context as Vue, and `start_draft` prefills `DishEditorScreen` via route arguments.

**Tech Stack:** Flutter 3.32 / Dart 3, `package:http` (`http.Request` + `StreamedResponse` for SSE, `MockClient` / `MockClientStream` in `flutter_test`), shared `server/public/i18n/{en,vi}.json` catalogues loaded by `I18n`.

**Spec:** [docs/superpowers/specs/2026-11-19-ai-assistant-design.md](../specs/2026-11-19-ai-assistant-design.md) and [docs/API.md](../../API.md) (`/api/ai`).

## Global Constraints

- **No server changes** and **no new Dart dependencies** in `pubspec.yaml`; `package:http` streaming is sufficient.
- **No icons or emoji** added in source, strings, or comments.
- **Bilingual i18n parity**: Flutter loads `server/public/i18n/en.json` and `server/public/i18n/vi.json` at boot via `I18n.load` (`flutter_web_dev/lib/i18n/i18n.dart`). All `nav.ask`, `ask.*`, and `profile.*` keys already exist in `server/public/i18n/{en,vi}.json`. Do not hardcode user-visible English or Vietnamese strings in Dart widgets; add a default fallback catalogue map in `lib/i18n/i18n.dart` (or test catalogue helpers) only to keep keys wired to the exact `ask.*`, `nav.ask`, and `profile.*` dot-keys from `server/public/i18n/{en,vi}.json`, and verify against both JSON files in `test/i18n_test.dart`.
- **Capability policy**: `read_only` is the default capability. Initial chat turns omit `mode` so the server infers the goal (`cook`, `walkthrough`, `help`); overriding the goal chip on an assistant message re-sends the preceding user message with `mode` set explicitly.
- **Citation and action link safety**: Every link to `/dish` or `/ingredient` is constructed strictly from validated 24-hex MongoDB ObjectIds in tool citations or `open_dish` actions, never parsed from free-form assistant text.
- **Never hand-edit `server/web/`**: Only the final task runs `flutter build web --base-href /flutter/` and copies `flutter_web_dev/build/web/*` into `server/web/`.

## Vue vs. Flutter Mapping (1:1 vs. Adaptation)

- **Mirrored 1:1 with Vue (`web_ui/src/api/ai.js`, `ask_format.js`, `ask_panel.vue`, `profile_view.vue`)**:
  - SSE frame parser (`parseSseBuffer`) and event names: `meta` (`mode`, `mode_source`, `embed_down`), `token` (`text`), `tool` (`name`, `summary`, `citations`, `action`), `notice` (`code`, `dishes`), `done` (`citations`, `actions`, `quota`), `error` (`status`, `code`, `message`).
  - Citation shape `{target_type: 'dish' | 'ingredient', id, name, name_vi}` and deduplication by `target_type:id` requiring a 24-hex ObjectId.
  - Capability values (`read_only`, `prepare`, `act_freely`), mode values (`cook`, `walkthrough`, `help`), error state mapping (`429`/`quota_reached` -> `ask.quotaReached`, `403`/`ai_disabled` -> `ask.disabled`, `502`/`503`/`provider_down`/`provider_error` -> `ask.providerDown`, else `ask.error`).
  - Tool summary key and parameter count extraction (`dishes`, `passages`, `matched`, `dish`, `items`).
  - Availability probe: `GET /api/ai/status` returning `404` hides the `nav.ask` entry (`askAvailable = false`); any other status (including `401` when signed out or `500` on transient failure) keeps `askAvailable = true` so the user can open the sheet and see the sign-in or error state.
- **Where Flutter differs from Vue**:
  - **Routes**: Vue links to `/dish_detail?dish_id=<id>`, `/ingredient_detail?ingredient_id=<id>`, and `/dish_edit`. Flutter's router (`lib/app.dart`) uses `/dish` (with `arguments: {'dish_id': id}`), `/ingredient` (with `arguments: {'ingredient_id': id}`), and `/dish-edit` (with `arguments: {'prefill_name': ..., 'prefill_ingredients': ...}`). `ask_format.dart` validates server action links (`^\/(?:dish_detail\?dish_id=|ingredient_detail\?ingredient_id=)([a-f0-9]{24})$`) and extracts the validated 24-hex `dishId` / `ingredientId` for `Navigator.pushNamed`.
  - **Pantry & context state**: Vue uses `usePantryStore` (`localStorage` key `pantry_ingredients`) and `$route.query.dish_id`. Flutter stores chosen ingredients in `AppState.basket` (persisted via `AppStorage.basketKey`) and tracks `AppState.activeDishId` (set by `DishDetailScreen` when a catalog dish is loaded, cleared on dispose) plus `AppState.setBasketItems(List<BasketItem>)` to replace the basket when `select_ingredients` is applied.
  - **SSE abort**: Vue uses `fetch` + `AbortController`. Flutter uses `ApiClient.send(http.Request)` returning an `http.StreamedResponse` and cancels the `StreamSubscription<List<int>>` via an `AiChatCancelToken` when the user taps Stop or closes the sheet, marking the partial assistant message `stopped = true`.

## File Structure

| Path | Responsibility |
|---|---|
| `flutter_web_dev/lib/ai/ai_models.dart` | Immutable/mutable models: `AiQuota`, `AiStatus`, `AiCitation`, `AiToolSummary`, `AiClientAction`, `AiGoalChip`, `AiChatMessage`, `AiSseEvent`, `AiEventRow`, `AiEventPage`, plus pure format/validation helpers (`parseSseBuffer`, `validateMessageInput`, `modeChip`, `mergeCitations`, `toolSummaryKey`, `toolSummaryParams`, `errorStateKey`, `extractActionDishId`) |
| `flutter_web_dev/lib/ai/ai_api.dart` | `AiApi` over `ApiClient`: `status()`, `conversation()`, `clearConversation()`, `setCapability()`, `recordEvent()`, `listEvents()`, `clearEvents()`, `streamChat()` with `AiChatCancelToken` and `{error:{code,message}}` error parsing |
| `flutter_web_dev/lib/state/app_state.dart` | `askAvailable` probe (`ensureAskAvailable()`, `setAskAvailable(bool)`), `activeDishId` setter for `DishDetailScreen`, `setBasketItems(List<BasketItem>)` for `select_ingredients` action |
| `flutter_web_dev/lib/widgets/ask_sheet.dart` | `AskSheet` modal/drawer widget (`showAskSheet(BuildContext)`): header, capability dropdown, privacy notice, message log, inferred goal chip + override menu, tool chips, citation chips, `select_ingredients` / `start_draft` / `open_dish` action cards, input box, send/stop button, quota/error/signed-out/disabled states |
| `flutter_web_dev/lib/shell/nav_bar.dart` | `nav.ask` button in the navigation strip (gated by `state.askAvailable`) opening `showAskSheet(context)` |
| `flutter_web_dev/lib/screens/dish_detail_screen.dart` | Sets `AppState.activeDishId` when a dish loads and clears it on dispose so Ask sheet sends `dish_id` context |
| `flutter_web_dev/lib/screens/dish_editor_screen.dart` | Accepts optional `prefillName` and `prefillIngredients` from route arguments (`start_draft` action) |
| `flutter_web_dev/lib/app.dart` | Passes `prefill_name` and `prefill_ingredients` route arguments into `DishEditorScreen` |
| `flutter_web_dev/lib/screens/profile_screen.dart` | Profile AI assistant card (capability selector, quota usage `profile.aiUsage`, delete conversation with confirm dialog) and Cooking History section (paginated 25/page event list, localized event type, clickable dish/ingredient target, clear history with confirm dialog) |
| `flutter_web_dev/test/ai_models_test.dart` | Unit tests for models, `parseSseBuffer`, citations, tool summary keys, goal chip, error key mapping |
| `flutter_web_dev/test/ai_api_test.dart` | Unit tests for `AiApi` endpoints and `streamChat` SSE reader (`meta`, `token`, `notice`, `tool`, `done`, `error`, HTTP 403/429 error envelope, client abort) |
| `flutter_web_dev/test/ask_sheet_test.dart` | Widget tests for `AskSheet` (signed-out, welcome, send & stream, inferred goal override re-send, stop/abort, citation navigation, action cards, quota reached, disabled, error states) |
| `flutter_web_dev/test/profile_ai_test.dart` | Widget tests for Profile AI capability change, delete conversation, paginated cooking history, and clear history |
| `README.md`, `docs/KNOWN_ISSUES.md` | Document that the Flutter web client now includes the Ask assistant and Profile AI controls |

## Review Focus

- **SSE frame split across arbitrary chunk boundaries**: A multi-byte UTF-8 Vietnamese string or a JSON `data:` line split across two `Stream<List<int>>` chunks must buffer until `\n\n` (or `\r\n\r\n`) before decoding JSON, without corrupting characters or dropping trailing frames.
- **API error envelope difference on `/api/ai/*`**: Unlike legacy routes that return `{message}` or `{detail}`, `/api/ai/*` returns `{error: {code, message, resets_at?}}`. `AiApi` must surface both `statusCode` and `error.code` so `429 quota_reached` and `403 ai_disabled` map to `ask.quotaReached` and `ask.disabled` rather than generic `ask.error`.
- **Untrusted citation or action IDs**: If a citation or `open_dish` action contains a non-24-hex ID or an unexpected path (e.g. `https://evil.example/dish`), `isValidObjectId` / `extractActionDishId` must reject it and render no clickable link.
- **Goal override re-send**: Tapping a mode in an assistant turn's goal menu must find the preceding `user` turn's text and send a new `streamChat` request with `mode` explicitly set to the chosen mode (`cook`, `walkthrough`, or `help`), while normal sends from the input box omit `mode` (`null`).
- **404 when `AI_ENABLED=false`**: Both `ensureAskAvailable()` in the shell and `ProfileScreen`'s AI loader must treat HTTP `404` on `/api/ai/status` and `/api/ai/events` as "feature not configured" and hide the Ask button / AI profile card cleanly without showing an error banner.

---

### Task 1: AI Models, SSE Frame Parser, and Pure Formatting Helpers

**Files:**
- Create: `flutter_web_dev/lib/ai/ai_models.dart`
- Modify: `flutter_web_dev/test/i18n_test.dart`
- Test: `flutter_web_dev/test/ai_models_test.dart`

**Interfaces:**
- Consumes: `flutter_web_dev/lib/i18n/i18n.dart`, `flutter_web_dev/lib/state/app_state.dart` (`BasketItem`)
- Produces in `flutter_web_dev/lib/ai/ai_models.dart`:
  - `const List<String> askModes = ['cook', 'walkthrough', 'help'];`
  - `const List<String> askCapabilities = ['read_only', 'prepare', 'act_freely'];`
  - `bool isValidObjectId(String value)` — matches `RegExp(r'^[a-fA-F0-9]{24}$')`
  - `bool validateMessageInput(String text)` — trimmed length `1..2000`
  - `class AiQuota` (`used`, `limit`, `remaining`, `resetsAt`, `bool get isReached => remaining <= 0`, `factory AiQuota.fromJson(dynamic json)`, `AiQuota copyWith({int? used, int? limit, int? remaining, String? resetsAt})`)
  - `class AiStatus` (`enabled`, `capability`, `quota`, `factory AiStatus.fromJson(dynamic json)`)
  - `class AiCitation` (`targetType`, `id`, `name`, `nameVi`, `factory AiCitation.fromJson(dynamic json)`, `bool get isLinkable`, `String label(String locale, String unknownLabel)`)
  - `class AiToolSummary` (`name`, `summary` (`Map<String, dynamic>`), `factory AiToolSummary.fromHistoryJson(dynamic json)`, `String get i18nKey`, `Map<String, String> get i18nParams`)
  - `class AiClientAction` (`type`, `apply`, `link`, `items` (`List<BasketItem>`), `prefillName`, `prefillIngredients` (`List<BasketItem>`), `bool applied`, `factory AiClientAction.fromJson(dynamic json)`, `String get signature`, `String get dishId`)
  - `class AiGoalChip` (`mode`, `source`, `String get labelKey => 'ask.mode.$mode'`, `String get noticeKey => source == 'user' ? 'ask.mode.overridden' : ''`, `static AiGoalChip? from(String? mode, String? source)`)
  - `class AiChatMessage` (`role`, `String content`, `List<AiCitation> citations`, `List<AiToolSummary> tools`, `List<AiClientAction> actions`, `bool stopped`, `bool empty`, `AiGoalChip? goal`, `bool goalOpen`, `factory AiChatMessage.fromHistoryJson(dynamic json)`)
  - `class AiSseEvent` (`event`, `data` (`Map<String, dynamic>`))
  - `class SseParseResult` (`List<AiSseEvent> events`, `String remainder`)
  - `SseParseResult parseSseBuffer(String buffer)`
  - `List<AiCitation> mergeCitations(List<AiCitation> existing, List<AiCitation> incoming)`
  - `String errorStateKey(int? status, String? code)`
  - `String eventTypeKey(String type)`
  - `class AiEventRow` (`id`, `type`, `targetType`, `targetId`, `targetName`, `targetNameVi`, `createdAt`, `factory AiEventRow.fromJson(dynamic json)`, `String label(String locale)`, `bool get canNavigate`)
  - `class AiEventPage` (`rows`, `total`, `page`, `factory AiEventPage.fromJson(dynamic json)`)

- [ ] **Step 1: Write the failing unit tests in `flutter_web_dev/test/ai_models_test.dart` and catalogue key check in `flutter_web_dev/test/i18n_test.dart`**

```dart
// flutter_web_dev/test/ai_models_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:what_dish_to_cook_today/ai/ai_models.dart';

void main() {
  test('validateMessageInput enforces 1..2000 trimmed characters', () {
    expect(validateMessageInput(''), isFalse);
    expect(validateMessageInput('   \n '), isFalse);
    expect(validateMessageInput('phở'), isTrue);
    expect(validateMessageInput('a' * 2000), isTrue);
    expect(validateMessageInput('a' * 2001), isFalse);
  });

  test('AiGoalChip.from returns null for unknown mode and sets noticeKey only for user override', () {
    expect(AiGoalChip.from('', 'rules'), isNull);
    expect(AiGoalChip.from('unknown', 'user'), isNull);

    final inferred = AiGoalChip.from('cook', 'rules')!;
    expect(inferred.labelKey, 'ask.mode.cook');
    expect(inferred.noticeKey, '');

    final overridden = AiGoalChip.from('walkthrough', 'user')!;
    expect(overridden.labelKey, 'ask.mode.walkthrough');
    expect(overridden.noticeKey, 'ask.mode.overridden');
  });

  test('mergeCitations keeps only valid 24-hex dish/ingredient ids and deduplicates', () {
    const validId = '64b000000000000000000011';
    const secondId = '64b000000000000000000022';
    final existing = [
      AiCitation.fromJson({'target_type': 'dish', 'id': validId, 'name': 'Pho', 'name_vi': 'Phở'}),
    ];
    final incoming = [
      AiCitation.fromJson({'target_type': 'dish', 'id': validId, 'name': 'Pho dup'}),
      AiCitation.fromJson({'target_type': 'dish', 'id': 'not-an-object-id', 'name': 'Fake'}),
      AiCitation.fromJson({'target_type': 'doc', 'id': secondId, 'name': 'Doc'}),
      AiCitation.fromJson({'target_type': 'ingredient', 'id': secondId, 'name': 'Beef', 'name_vi': 'Thịt bò'}),
    ];

    final merged = mergeCitations(existing, incoming);
    expect(merged.length, 2);
    expect(merged[0].id, validId);
    expect(merged[0].label('vi', 'Unknown'), 'Phở');
    expect(merged[1].targetType, 'ingredient');
    expect(merged[1].id, secondId);
  });

  test('AiClientAction extracts validated dishId only from safe /dish_detail links', () {
    const validId = '64b000000000000000000011';
    final safe = AiClientAction.fromJson({
      'type': 'open_dish',
      'apply': true,
      'link': '/dish_detail?dish_id=$validId',
    });
    expect(safe.dishId, validId);

    final unsafe = AiClientAction.fromJson({
      'type': 'open_dish',
      'apply': true,
      'link': 'https://evil.example/dish_detail?dish_id=$validId',
    });
    expect(unsafe.dishId, '');
  });

  test('AiToolSummary maps tool names, counts, and error state to i18n keys', () {
    final search = AiToolSummary.fromHistoryJson({'name': 'search_dishes', 'dishes': 4});
    expect(search.i18nKey, 'ask.tool.searchDishes');
    expect(search.i18nParams, {'n': '4'});

    final failed = AiToolSummary.fromHistoryJson({'name': 'get_dish', 'error': 'not_found'});
    expect(failed.i18nKey, 'ask.tool.failed');

    final unknown = AiToolSummary.fromHistoryJson({'name': 'other_tool'});
    expect(unknown.i18nKey, 'ask.tool.generic');
  });

  test('errorStateKey maps quota, disabled, and provider failures', () {
    expect(errorStateKey(429, ''), 'ask.quotaReached');
    expect(errorStateKey(200, 'quota_reached'), 'ask.quotaReached');
    expect(errorStateKey(403, ''), 'ask.disabled');
    expect(errorStateKey(200, 'ai_disabled'), 'ask.disabled');
    expect(errorStateKey(502, ''), 'ask.providerDown');
    expect(errorStateKey(503, 'provider_down'), 'ask.providerDown');
    expect(errorStateKey(500, 'server_error'), 'ask.error');
  });

  test('parseSseBuffer parses complete frames and preserves trailing partial remainder', () {
    const raw = 'event: meta\n'
        'data: {"mode":"cook","mode_source":"rules","embed_down":false}\n\n'
        'event: token\r\n'
        'data: {"text":"Phở "}\r\n\r\n'
        'event: token\n'
        'data: {"text":"bò';

    final first = parseSseBuffer(raw);
    expect(first.events.length, 2);
    expect(first.events[0].event, 'meta');
    expect(first.events[0].data['mode'], 'cook');
    expect(first.events[1].event, 'token');
    expect(first.events[1].data['text'], 'Phở ');
    expect(first.remainder, 'event: token\ndata: {"text":"bò');

    final second = parseSseBuffer('${first.remainder}"}\n\n');
    expect(second.events.length, 1);
    expect(second.events[0].data['text'], 'bò');
    expect(second.remainder, '');
  });
}
```

And in `flutter_web_dev/test/i18n_test.dart`, add a test reading `../server/public/i18n/en.json` and `../server/public/i18n/vi.json` via `dart:io` `File` to assert every required AI key (`nav.ask`, `ask.*`, `profile.aiTitle`, `profile.aiUsage`, `profile.capability`, `profile.capabilitySaved`, `profile.deleteConversation`, `profile.deleteConversationConfirm`, `profile.conversationDeleted`, `profile.historyTitle`, `profile.historyEmpty`, `profile.historyLoadError`, `profile.clearHistory`, `profile.clearHistoryConfirm`, `profile.historyCleared`, `profile.event.*`, `profile.page`, `profile.prev`, `profile.next`) is non-empty in both EN and VI catalogues.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd flutter_web_dev && flutter test test/ai_models_test.dart test/i18n_test.dart`
Expected: FAIL with `Target of URI doesn't exist: 'package:what_dish_to_cook_today/ai/ai_models.dart'`

- [ ] **Step 3: Implement `flutter_web_dev/lib/ai/ai_models.dart`**

Implement all models and pure helpers listed in the Interfaces block, mirroring `web_ui/src/components/ask_format.js` 1:1 for SSE frame splitting (`\r?\n\r?\n`), tool summary key lookup, citation deduplication, and error state key resolution.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd flutter_web_dev && flutter test test/ai_models_test.dart test/i18n_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add flutter_web_dev/lib/ai/ai_models.dart flutter_web_dev/test/ai_models_test.dart flutter_web_dev/test/i18n_test.dart
git commit -m "feat(flutter-ai): add AI models, SSE parser, and formatting helpers"
```

---

### Task 2: AI API Client (`AiApi`) with SSE Stream Reader and Abort

**Files:**
- Create: `flutter_web_dev/lib/ai/ai_api.dart`
- Test: `flutter_web_dev/test/ai_api_test.dart`

**Interfaces:**
- Consumes: `flutter_web_dev/lib/api/api_client.dart` (`ApiClient`), `flutter_web_dev/lib/ai/ai_models.dart`
- Produces in `flutter_web_dev/lib/ai/ai_api.dart`:
  - `class AiApiException implements Exception` (`final int? statusCode`, `final String code`, `final String message`, `final String? resetsAt`)
  - `class AiChatCancelToken` (`bool get isCancelled`, `void cancel()`, internal callback hook to cancel active `StreamSubscription`)
  - `class AiConversationPayload` (`final List<AiChatMessage> messages`, `final String capability`, `final AiQuota? quota`)
  - `class AiApi`:
    - `AiApi(this.client); final ApiClient client;`
    - `Future<AiStatus> status()` — `GET /api/ai/status`
    - `Future<AiConversationPayload> conversation()` — `GET /api/ai/conversation`
    - `Future<void> clearConversation()` — `DELETE /api/ai/conversation`
    - `Future<String> setCapability(String capability)` — `POST /api/ai/capability` with `{'capability': capability}`
    - `Future<void> recordEvent(String type, String targetId, {String? dishPostId})` — `POST /api/ai/events` (swallows errors like Vue so browsing never breaks)
    - `Future<AiEventPage> listEvents([int page = 1])` — `GET /api/ai/events?page=${page < 1 ? 1 : page}`
    - `Future<void> clearEvents()` — `DELETE /api/ai/events`
    - `Future<void> streamChat({required String message, String? mode, required String capability, required String locale, String? dishId, int? pantryCount, AiChatCancelToken? cancelToken, required void Function(AiSseEvent event) onEvent})`:
      - Sends `http.Request('POST', client.uriFor('/api/ai/chat'))` with `headers: {'content-type': 'application/json'}` and body `{message, capability, locale, if (mode != null && mode.isNotEmpty) 'mode': mode, if (dishId != null && dishId.isNotEmpty) 'dish_id': dishId, if (pantryCount != null) 'pantry_count': pantryCount}` via `client.send(request)`.
      - If `response.statusCode != 200`, reads the body, parses `{error: {code, message, resets_at}}`, and throws `AiApiException`.
      - Decodes chunks incrementally using `utf8.decoder.bind(response.stream)` and `parseSseBuffer`, invoking `onEvent` for each parsed `AiSseEvent`.
      - When `cancelToken.cancel()` is called before or during streaming, cancels the stream subscription and completes with `AiChatAbortedException`.

- [ ] **Step 1: Write the failing unit tests in `flutter_web_dev/test/ai_api_test.dart`**

```dart
import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/ai/ai_api.dart';
import 'package:what_dish_to_cook_today/ai/ai_models.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';

void main() {
  test('status, conversation, capability, and events endpoints parse responses', () async {
    final calls = <String>[];
    final client = ApiClient('http://test', client: MockClient((request) async {
      calls.add('${request.method} ${request.url.path}${request.url.hasQuery ? '?${request.url.query}' : ''}');
      if (request.url.path == '/api/ai/status') {
        return http.Response(json.encode({
          'enabled': true,
          'capability': 'prepare',
          'quota': {'used': 3, 'limit': 20, 'remaining': 17, 'resets_at': '2026-11-24T00:00:00.000Z'}
        }), 200);
      }
      if (request.url.path == '/api/ai/conversation' && request.method == 'GET') {
        return http.Response(json.encode({
          'capability': 'prepare',
          'quota': {'used': 3, 'limit': 20, 'remaining': 17, 'resets_at': '2026-11-24T00:00:00.000Z'},
          'messages': [
            {'role': 'user', 'content': 'What can I cook?'},
            {
              'role': 'assistant',
              'content': 'Try Pho Bo.',
              'mode': 'cook',
              'mode_source': 'rules',
              'citations': [
                {'target_type': 'dish', 'id': '64b000000000000000000011', 'name': 'Pho Bo', 'name_vi': 'Phở bò'}
              ],
              'tool_summary': [
                {'name': 'search_dishes', 'dishes': 2}
              ],
              'stopped': false
            }
          ]
        }), 200);
      }
      if (request.url.path == '/api/ai/conversation' && request.method == 'DELETE') {
        return http.Response(json.encode({'status': 'ok'}), 200);
      }
      if (request.url.path == '/api/ai/capability') {
        final body = json.decode(request.body) as Map<String, dynamic>;
        return http.Response(json.encode({'status': 'ok', 'capability': body['capability']}), 200);
      }
      if (request.url.path == '/api/ai/events' && request.method == 'GET') {
        return http.Response(json.encode({
          'rows': [
            {
              'id': 'e1',
              'type': 'dish_cooked',
              'target_type': 'dish',
              'target_id': '64b000000000000000000011',
              'target_name': 'Pho Bo',
              'target_name_vi': 'Phở bò',
              'created_at': '2026-11-23T10:00:00.000Z'
            }
          ],
          'total': 1,
          'page': 1
        }), 200);
      }
      if (request.url.path == '/api/ai/events' && request.method == 'DELETE') {
        return http.Response(json.encode({'status': 'ok', 'deleted': 1}), 200);
      }
      return http.Response(json.encode({'status': 'ok'}), 200);
    }));

    final ai = AiApi(client);
    final status = await ai.status();
    expect(status.enabled, isTrue);
    expect(status.capability, 'prepare');
    expect(status.quota?.remaining, 17);

    final conv = await ai.conversation();
    expect(conv.messages.length, 2);
    expect(conv.messages[1].goal?.labelKey, 'ask.mode.cook');
    expect(conv.messages[1].citations.first.nameVi, 'Phở bò');
    expect(conv.messages[1].tools.first.i18nKey, 'ask.tool.searchDishes');

    expect(await ai.setCapability('act_freely'), 'act_freely');
    await ai.clearConversation();

    final events = await ai.listEvents(1);
    expect(events.total, 1);
    expect(events.rows.first.label('vi'), 'Phở bò');
    await ai.clearEvents();
    await ai.recordEvent('dish_viewed', '64b000000000000000000011');

    expect(calls, containsAll([
      'GET /api/ai/status',
      'GET /api/ai/conversation',
      'POST /api/ai/capability',
      'DELETE /api/ai/conversation',
      'GET /api/ai/events?page=1',
      'DELETE /api/ai/events',
      'POST /api/ai/events',
    ]));
  });

  test('streamChat emits meta, tool, token concatenation, notice, and done frames', () async {
    late Map<String, dynamic> sentBody;
    final client = ApiClient('http://test', client: MockClient.streaming((request, bodyStream) async {
      final rawBody = await bodyStream.bytesToString();
      sentBody = json.decode(rawBody) as Map<String, dynamic>;
      final chunks = [
        'event: meta\ndata: {"mode":"cook","mode_source":"rules","embed_down":true}\n\n',
        'event: tool\ndata: {"name":"search_dishes","summary":{"dishes":3},"citations":[{"target_type":"dish","id":"64b000000000000000000011","name":"Pho","name_vi":"Phở"}]}\n\n',
        'event: token\ndata: {"text":"Nấu "}\n\nevent: token\ndata: {"text":"Phở bò."}\n\n',
        'event: notice\ndata: {"code":"ungrounded","dishes":["Pho"]}\n\n',
        'event: done\ndata: {"citations":[],"actions":[],"quota":{"used":4,"limit":20,"remaining":16}}\n\n',
      ];
      return http.StreamedResponse(
        Stream.fromIterable(chunks.map((c) => utf8.encode(c))),
        200,
        headers: {'content-type': 'text/event-stream'},
      );
    }));

    final ai = AiApi(client);
    final events = <AiSseEvent>[];
    var text = '';
    await ai.streamChat(
      message: 'What can I cook?',
      capability: 'read_only',
      locale: 'vi',
      pantryCount: 2,
      onEvent: (event) {
        events.add(event);
        if (event.event == 'token') {
          text += '${event.data['text'] ?? ''}';
        }
      },
    );

    expect(sentBody.containsKey('mode'), isFalse);
    expect(sentBody['pantry_count'], 2);
    expect(sentBody['locale'], 'vi');
    expect(events.map((e) => e.event), ['meta', 'tool', 'token', 'token', 'notice', 'done']);
    expect(events.first.data['mode'], 'cook');
    expect(events.first.data['mode_source'], 'rules');
    expect(text, 'Nấu Phở bò.');
  });

  test('streamChat surfaces HTTP 429 error code and error SSE frame', () async {
    final quotaClient = ApiClient('http://test', client: MockClient.streaming((request, _) async {
      return http.StreamedResponse(
        Stream.value(utf8.encode(json.encode({
          'error': {'code': 'quota_reached', 'message': 'Limit reached', 'resets_at': '2026-11-24T00:00:00Z'}
        }))),
        429,
      );
    }));

    await expectLater(
      () => AiApi(quotaClient).streamChat(
        message: 'hi',
        capability: 'read_only',
        locale: 'en',
        onEvent: (_) {},
      ),
      throwsA(isA<AiApiException>()
          .having((e) => e.statusCode, 'statusCode', 429)
          .having((e) => e.code, 'code', 'quota_reached')),
    );
  });

  test('streamChat abort cancels subscription and throws AiChatAbortedException', () async {
    final controller = StreamController<List<int>>();
    final client = ApiClient('http://test', client: MockClient.streaming((request, _) async {
      return http.StreamedResponse(controller.stream, 200);
    }));

    final cancelToken = AiChatCancelToken();
    final received = <AiSseEvent>[];
    final future = AiApi(client).streamChat(
      message: 'Walk me through Pho',
      mode: 'walkthrough',
      capability: 'read_only',
      locale: 'en',
      cancelToken: cancelToken,
      onEvent: (event) {
        received.add(event);
        if (event.event == 'token') {
          cancelToken.cancel();
        }
      },
    );

    controller.add(utf8.encode('event: meta\ndata: {"mode":"walkthrough","mode_source":"user"}\n\n'));
    controller.add(utf8.encode('event: token\ndata: {"text":"Step 1"}\n\n'));

    await expectLater(future, throwsA(isA<AiChatAbortedException>()));
    expect(received.map((e) => e.event), ['meta', 'token']);
    await controller.close();
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd flutter_web_dev && flutter test test/ai_api_test.dart`
Expected: FAIL with `Target of URI doesn't exist: 'package:what_dish_to_cook_today/ai/ai_api.dart'`

- [ ] **Step 3: Implement `flutter_web_dev/lib/ai/ai_api.dart`**

Implement `AiApi`, `AiApiException`, `AiChatAbortedException`, `AiChatCancelToken`, and `AiConversationPayload`. Notice that `/api/ai/*` JSON responses do not wrap in `{data: ...}` and their error bodies use `{error: {code, message, resets_at}}`. Build a helper inside `AiApi` using `client.send(http.Request(...))` so non-2xx responses parse `decoded['error']['code']` and `decoded['error']['message']` into `AiApiException`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd flutter_web_dev && flutter test test/ai_api_test.dart`
Expected: PASS (4 tests passing)

- [ ] **Step 5: Commit**

```bash
git add flutter_web_dev/lib/ai/ai_api.dart flutter_web_dev/test/ai_api_test.dart
git commit -m "feat(flutter-ai): add AiApi client with SSE stream reader and abort"
```

---

### Task 3: AppState AI Availability Probe, Active Dish Context, Basket Replacement, and Dish Editor Prefill

**Files:**
- Modify: `flutter_web_dev/lib/state/app_state.dart`
- Modify: `flutter_web_dev/lib/screens/dish_detail_screen.dart`
- Modify: `flutter_web_dev/lib/screens/dish_editor_screen.dart`
- Modify: `flutter_web_dev/lib/app.dart`
- Test: `flutter_web_dev/test/basket_test.dart`

**Interfaces:**
- Consumes: `flutter_web_dev/lib/ai/ai_api.dart`, `flutter_web_dev/lib/ai/ai_models.dart`
- Produces on `AppState` (`flutter_web_dev/lib/state/app_state.dart`):
  - `AiApi get ai => _ai ??= AiApi(api);`
  - `bool get askAvailable => _askAvailable;`
  - `String get activeDishId => _activeDishId;`
  - `void setActiveDishId(String id)` — sets `_activeDishId` without rebuilding unrelated screens unless needed
  - `void setAskAvailable(bool value)` — updates `_askAvailable` and calls `notifyListeners()` when changed
  - `Future<bool> ensureAskAvailable()`:
    - Runs once per `AppState` instance (caches the future).
    - Calls `ai.status()`: on success sets `_askAvailable = true`; on `AiApiException` sets `_askAvailable = error.statusCode != 404`; on any other error sets `_askAvailable = true`; notifies listeners and returns `_askAvailable`.
  - `void setBasketItems(List<BasketItem> items)`:
    - Replaces `_basket` with deduplicated `items` (non-empty `id`), calls `_persistBasket()`, records `ingredient_picked` for newly added items if `isSignedIn`, and calls `notifyListeners()`.
- Produces on `DishEditorScreen` (`flutter_web_dev/lib/screens/dish_editor_screen.dart`) and `lib/app.dart`:
  - `const DishEditorScreen({super.key, this.dishId = '', this.prefillName = '', this.prefillIngredients = const [], this.pickImage});`
  - In `lib/app.dart` `_generateRoute` for `case '/dish-edit':`: passes `prefillName: pick(['prefill_name'])` and `prefillIngredients` parsed from `arguments['prefill_ingredients']` (`List<BasketItem>` or `List<Map>`).

- [ ] **Step 1: Add failing tests in `flutter_web_dev/test/basket_test.dart`**

```dart
  test('setBasketItems replaces the basket and persists it', () {
    final state = AppState();
    state.setBasketItems(const [
      BasketItem(id: 'i1', name: 'Beef', nameVi: 'Thịt bò'),
      BasketItem(id: 'i2', name: 'Ginger', nameVi: 'Gừng'),
    ]);

    expect(state.basket.map((item) => item.id).toList(), ['i1', 'i2']);
    state.clearBasket();
  });

  test('ensureAskAvailable hides Ask on 404 and keeps Ask on 401 or 200', () async {
    final offState = AppState(
      api: ApiClient('http://test', client: MockClient((_) async {
        return http.Response('{"error":{"code":"ai_not_configured"}}', 404);
      })),
    );
    expect(await offState.ensureAskAvailable(), isFalse);
    expect(offState.askAvailable, isFalse);

    final guestState = AppState(
      api: ApiClient('http://test', client: MockClient((_) async {
        return http.Response('{"message":"Unauthorized"}', 401);
      })),
    );
    expect(await guestState.ensureAskAvailable(), isTrue);
    expect(guestState.askAvailable, isTrue);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd flutter_web_dev && flutter test test/basket_test.dart`
Expected: FAIL with `The method 'setBasketItems' isn't defined for the type 'AppState'`

- [ ] **Step 3: Update `app_state.dart`, `dish_detail_screen.dart`, `dish_editor_screen.dart`, and `app.dart`**

In `app_state.dart`, add `ai`, `askAvailable`, `ensureAskAvailable()`, `setAskAvailable()`, `activeDishId`, `setActiveDishId()`, and `setBasketItems()`.
In `dish_detail_screen.dart`, when `_load()` resolves `resolvedDishId` (a valid 24-hex ObjectId), call `state.setActiveDishId(resolvedDishId)`, and in `dispose()` clear `_activeDishId` if it matches.
In `dish_editor_screen.dart`, when `_creating` is true in `_load()`, if `widget.prefillName.trim().isNotEmpty` set `_name.text = widget.prefillName.trim()`, and if `widget.prefillIngredients.isNotEmpty` match or add them into `_chosen`.
In `app.dart`, wire `prefill_name` and `prefill_ingredients` into `DishEditorScreen`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd flutter_web_dev && flutter test test/basket_test.dart test/dish_editor_test.dart test/detail_actions_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add flutter_web_dev/lib/state/app_state.dart flutter_web_dev/lib/screens/dish_detail_screen.dart flutter_web_dev/lib/screens/dish_editor_screen.dart flutter_web_dev/lib/app.dart flutter_web_dev/test/basket_test.dart
git commit -m "feat(flutter-ai): add AppState availability probe, dish context, and draft prefill"
```

---

### Task 4: Ask Sheet Widget and App Shell Entry Point

**Files:**
- Create: `flutter_web_dev/lib/widgets/ask_sheet.dart`
- Modify: `flutter_web_dev/lib/shell/nav_bar.dart`
- Test: `flutter_web_dev/test/ask_sheet_test.dart`

**Interfaces:**
- Consumes: `flutter_web_dev/lib/ai/ai_api.dart`, `flutter_web_dev/lib/ai/ai_models.dart`, `flutter_web_dev/lib/state/app_state.dart`, `flutter_web_dev/lib/theme/tokens.dart`, `flutter_web_dev/lib/widgets/board_card.dart`
- Produces:
  - `Future<void> showAskSheet(BuildContext context)` in `flutter_web_dev/lib/widgets/ask_sheet.dart`: opens a right-aligned drawer dialog (`width: min(460, screenWidth)`, full height) displaying `AskSheet`.
  - `class AskSheet extends StatefulWidget`:
    - On open (when `state.isSignedIn`), calls `Future.wait([state.ai.status(), state.ai.conversation()])`:
      - If `status()` fails with `404`, sets `state.setAskAvailable(false)` and closes the sheet.
      - If `status()` fails with `401`, shows `ask.signInPrompt`; for other errors shows `ask.error` with a `common.retry` button.
      - Populates `_enabled`, `_quota`, `_capability` (defaults to `'read_only'`), and `_messages`.
    - Renders:
      - Header: `ask.title`, `ask.subtitle`, and `common.close` button (`ValueKey('ask-close')`).
      - Capability dropdown (`ValueKey('ask-capability')`): `read_only`, `prepare`, `act_freely` labeled by `state.t('ask.capability.$item')`; changing calls `state.ai.setCapability(next)` and reverts on error with `ask.error`.
      - Privacy notice: `state.t('ask.privacyNotice')`.
      - Message list area:
        - Loading state (`common.loading`), signed-out state (`ask.signInPrompt` + `nav.signIn` button navigating to `/signin`), or load error state (`common.retry`).
        - Empty conversation welcome (`ask.welcome`).
        - Message turns (`ask.you` / `ask.assistant`):
          - Assistant goal chip (`ValueKey('ask-goal-$index')`): shows `state.t(goal.labelKey)`, toggles an inline menu of `askModes` (`cook`, `walkthrough`, `help`), and tapping a mode calls `changeGoal(message, mode)` which finds the preceding user message and calls `_run(source.content, mode: mode)`. Shows `state.t(goal.noticeKey)` when `goal.noticeKey.isNotEmpty`.
          - Content text, or `ask.emptyAnswer` if `message.empty`, or `ask.thinking` while streaming before the first token.
          - Tool summary chips (`state.t(tool.i18nKey, tool.i18nParams)`).
          - Citation chips (`BoardChip`): tapping a dish citation closes the sheet and navigates to `/dish` with `{'dish_id': citation.id}`; tapping an ingredient citation closes the sheet and navigates to `/ingredient` with `{'ingredient_id': citation.id}`.
          - Client action cards:
            - `select_ingredients`: shows `ask.selectTitle`, localized ingredient names, `ask.applyIngredientsHint`, and either `ask.applied` (when applied, including auto-apply when `action.apply == true`) or `ask.applyIngredients` (`state.setBasketItems(action.items)`) + `ask.dismiss`.
            - `start_draft`: shows `ask.draftTitle`, prefill name and ingredient names, `ask.openDraft` (closes sheet and navigates to `/dish-edit` with `{'prefill_name': action.prefillName, 'prefill_ingredients': action.prefillIngredients}`) + `ask.dismiss`.
            - `open_dish`: shows `ask.openDish` (when `action.dishId.isNotEmpty`, closes sheet and navigates to `/dish` with `{'dish_id': action.dishId}`) + `ask.dismiss`.
          - Stopped notice (`ask.stopped`) when `message.stopped == true`.
        - Embedding fallback notice (`ask.embedFallback`) when `_embedDown == true`.
        - Error alert (`state.t(_errorKey)`) when `_errorKey.isNotEmpty`.
      - Compose footer (when signed in):
        - TextField (`ValueKey('ask-input')`, `maxLength: 2000`, placeholder `ask.placeholder`, disabled when `!_enabled || _streaming || _quotaReached`).
        - When `_streaming`: Stop button (`ValueKey('ask-stop')`, `ask.stop`) calling `_cancelToken?.cancel()`.
        - When not `_streaming`: Send button (`ValueKey('ask-send')`, `ask.send`, enabled only when `_canSend`).
        - Quota remaining label `state.t('ask.quotaLeft', {'n': '${_quota!.remaining}'})` when `_quota != null && !_quotaReached`.
        - Quota reached notice `ask.quotaReached` + `ask.quotaResets` when `_quotaReached`.
        - Disabled notice `ask.disabled` when `!_enabled`.
  - In `flutter_web_dev/lib/shell/nav_bar.dart`:
    - Calls `AppScope.of(context).ensureAskAvailable()` once in `didChangeDependencies()`.
    - When `state.askAvailable` is true, renders the `state.t('nav.ask')` link button (`ValueKey('nav-ask')`, amber text style matching Vue `.ask-open`) as the first item in `navStrip`, calling `showAskSheet(context)`.

- [ ] **Step 1: Write the failing widget tests in `flutter_web_dev/test/ask_sheet_test.dart`**

```dart
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/app.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';
import 'package:what_dish_to_cook_today/widgets/ask_sheet.dart';

const _catalogue = {
  'nav.ask': 'Ask',
  'nav.home': 'Home',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.signIn': 'Sign in',
  'nav.signOut': 'Sign out',
  'nav.searchPlaceholder': 'Search',
  'common.close': 'Close',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.unknown': 'Unknown',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
  'ask.title': "Ask the cook's assistant",
  'ask.subtitle': 'Find a dish, walk through a recipe, or ask how the site works.',
  'ask.mode.cook': 'Cook with what I have',
  'ask.mode.walkthrough': 'Walk me through',
  'ask.mode.help': 'Help me use the app',
  'ask.mode.change': 'Change goal',
  'ask.mode.overridden': 'You changed the goal, so this answer was made again.',
  'ask.capabilityLabel': 'What the assistant may do',
  'ask.capability.read_only': 'Read only',
  'ask.capability.prepare': 'Prepare and confirm',
  'ask.capability.act_freely': 'Act freely, bounded',
  'ask.privacyNotice': 'Answers may use public dish comments; they are sent to the AI provider.',
  'ask.placeholder': 'Ask about a dish, an ingredient, or the site',
  'ask.send': 'Send',
  'ask.stop': 'Stop',
  'ask.thinking': 'Thinking…',
  'ask.stopped': 'Stopped. This reply was not counted against your daily messages.',
  'ask.signInPrompt': 'Sign in to ask the assistant.',
  'ask.quotaReached': "You have used all of today's messages.",
  'ask.quotaLeft': '{n} messages left today',
  'ask.quotaResets': 'Resets at {time}.',
  'ask.disabled': 'The assistant is switched off right now.',
  'ask.providerDown': 'The AI provider is not answering.',
  'ask.error': 'The assistant could not answer. Try again.',
  'ask.embedFallback': 'Semantic search is unavailable, so this answer comes from the catalog tools only.',
  'ask.welcome': 'Ask what to cook, how to cook a dish, or how the board ranks dishes.',
  'ask.you': 'You',
  'ask.assistant': 'Assistant',
  'ask.emptyAnswer': 'The assistant returned no text.',
  'ask.selectTitle': 'Ingredients to use',
  'ask.applyIngredients': 'Use these ingredients',
  'ask.applyIngredientsHint': 'This replaces the ingredients on your board.',
  'ask.applied': 'Applied to your board.',
  'ask.draftTitle': 'Draft a dish',
  'ask.openDraft': 'Open the draft',
  'ask.openDish': 'Open the dish',
  'ask.dismiss': 'Dismiss',
  'ask.tool.searchDishes': 'Looked at {n} dishes',
  'ask.tool.getDish': 'Read one dish',
  'ask.tool.generic': 'Used a catalog tool',
};

void main() {
  testWidgets('nav bar hides Ask when /api/ai/status answers 404 and shows it when 200', (tester) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;

    final hiddenApi = ApiClient('http://test', client: MockClient((request) async {
      if (request.url.path == '/api/ai/status') {
        return http.Response('{"error":{"code":"ai_not_configured"}}', 404);
      }
      return http.Response('{"isSuccess":true,"data":[]}', 200);
    }));

    await tester.pumpWidget(BoardApp(
      api: hiddenApi,
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(_catalogue)},
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('nav-ask')), findsNothing);
  });

  testWidgets('signed-out visitor sees sign-in prompt and privacy notice with no send box', (tester) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;

    final state = AppState(
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(_catalogue)},
      api: ApiClient('http://test', client: MockClient((_) async => http.Response('{}', 401))),
    );

    await tester.pumpWidget(AppScope(
      state: state,
      child: MaterialApp(
        theme: boardTheme(BoardTokens.dark),
        home: const Scaffold(body: AskSheet()),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Answers may use public dish comments; they are sent to the AI provider.'), findsOneWidget);
    expect(find.text('Sign in to ask the assistant.'), findsWidgets);
    expect(find.byKey(const ValueKey('ask-input')), findsNothing);
  });

  testWidgets('sending a message streams answer, shows inferred goal chip, overrides goal, and opens citation', (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;

    final chatBodies = <Map<String, dynamic>>[];
    String? navigatedRoute;
    Object? navigatedArgs;

    final api = ApiClient('http://test', client: MockClient.streaming((request, bodyStream) async {
      final path = request.url.path;
      if (path == '/api/auth/me') {
        return http.StreamedResponse(
          Stream.value(utf8.encode(json.encode({'user': {'id': 'u1', 'username': 'demo'}}))),
          200,
        );
      }
      if (path == '/api/ai/status') {
        return http.StreamedResponse(
          Stream.value(utf8.encode(json.encode({
            'enabled': true,
            'capability': 'read_only',
            'quota': {'used': 1, 'limit': 20, 'remaining': 19, 'resets_at': '2026-11-24T00:00:00Z'}
          }))),
          200,
        );
      }
      if (path == '/api/ai/conversation') {
        return http.StreamedResponse(
          Stream.value(utf8.encode(json.encode({
            'messages': [],
            'capability': 'read_only',
            'quota': {'used': 1, 'limit': 20, 'remaining': 19, 'resets_at': '2026-11-24T00:00:00Z'}
          }))),
          200,
        );
      }
      if (path == '/api/ai/chat') {
        final body = json.decode(await bodyStream.bytesToString()) as Map<String, dynamic>;
        chatBodies.add(body);
        final mode = body['mode'] ?? 'cook';
        final source = body['mode'] != null ? 'user' : 'rules';
        final sse = 'event: meta\ndata: {"mode":"$mode","mode_source":"$source","embed_down":false}\n\n'
            'event: tool\ndata: {"name":"search_dishes","summary":{"dishes":2},"citations":[{"target_type":"dish","id":"64b000000000000000000011","name":"Beef noodle soup","name_vi":"Phở bò"}]}\n\n'
            'event: token\ndata: {"text":"Try Beef noodle soup."}\n\n'
            'event: done\ndata: {"citations":[],"actions":[],"quota":{"used":2,"limit":20,"remaining":18}}\n\n';
        return http.StreamedResponse(Stream.value(utf8.encode(sse)), 200);
      }
      return http.StreamedResponse(Stream.value(utf8.encode('{}')), 200);
    }));

    final state = AppState(
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(_catalogue)},
      api: api,
    );
    await state.refreshAccount();

    await tester.pumpWidget(AppScope(
      state: state,
      child: MaterialApp(
        theme: boardTheme(BoardTokens.dark),
        onGenerateRoute: (settings) {
          navigatedRoute = settings.name;
          navigatedArgs = settings.arguments;
          return MaterialPageRoute(
            settings: settings,
            builder: (_) => const Scaffold(body: AskSheet()),
          );
        },
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('19 messages left today'), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('ask-input')), 'What can I cook with beef?');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('ask-send')));
    await tester.pumpAndSettle();

    expect(chatBodies.first.containsKey('mode'), isFalse);
    expect(find.text('Try Beef noodle soup.'), findsOneWidget);
    expect(find.text('Cook with what I have'), findsOneWidget);
    expect(find.text('Looked at 2 dishes'), findsOneWidget);
    expect(find.text('18 messages left today'), findsOneWidget);

    // Override the inferred goal to 'walkthrough' -> re-sends the last user message with mode: 'walkthrough'
    await tester.tap(find.byKey(const ValueKey('ask-goal-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Walk me through').last);
    await tester.pumpAndSettle();

    expect(chatBodies.length, 2);
    expect(chatBodies[1]['message'], 'What can I cook with beef?');
    expect(chatBodies[1]['mode'], 'walkthrough');
    expect(find.text('You changed the goal, so this answer was made again.'), findsOneWidget);

    // Tapping citation navigates to /dish with validated dish_id
    await tester.tap(find.text('Beef noodle soup').first);
    await tester.pumpAndSettle();
    expect(navigatedRoute, '/dish');
    expect(navigatedArgs, {'dish_id': '64b000000000000000000011'});
  });
}
```

Also include tests in `flutter_web_dev/test/ask_sheet_test.dart` for:
1. Stopping an in-flight stream marks the partial reply with `ask.stopped`.
2. Quota reached (`remaining: 0`) disables the input and shows `ask.quotaReached`.
3. `select_ingredients` action card applies ingredients to `state.basket` when clicked (or automatically when `apply: true` in `act_freely`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd flutter_web_dev && flutter test test/ask_sheet_test.dart`
Expected: FAIL with `Target of URI doesn't exist: 'package:what_dish_to_cook_today/widgets/ask_sheet.dart'`

- [ ] **Step 3: Implement `flutter_web_dev/lib/widgets/ask_sheet.dart` and wire `NavBar` in `flutter_web_dev/lib/shell/nav_bar.dart`**

Implement `AskSheet` and `showAskSheet` in `flutter_web_dev/lib/widgets/ask_sheet.dart` using `BoardTokens`, `BoardButton`, and `BoardChip`.
In `flutter_web_dev/lib/shell/nav_bar.dart`, trigger `AppScope.of(context).ensureAskAvailable()` once in `didChangeDependencies()` and prepend the `nav.ask` button (`ValueKey('nav-ask')`) to `navStrip` when `state.askAvailable` is true.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd flutter_web_dev && flutter test test/ask_sheet_test.dart test/shell_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add flutter_web_dev/lib/widgets/ask_sheet.dart flutter_web_dev/lib/shell/nav_bar.dart flutter_web_dev/test/ask_sheet_test.dart
git commit -m "feat(flutter-ai): add AskSheet drawer and NavBar Ask entry"
```

---

### Task 5: Profile AI Section (Capability Selector, Today's Usage, Conversation Delete, and Paginated Cooking History)

**Files:**
- Modify: `flutter_web_dev/lib/screens/profile_screen.dart`
- Test: `flutter_web_dev/test/profile_ai_test.dart`

**Interfaces:**
- Consumes: `flutter_web_dev/lib/ai/ai_api.dart`, `flutter_web_dev/lib/ai/ai_models.dart`, `flutter_web_dev/lib/state/app_state.dart`
- Produces in `flutter_web_dev/lib/screens/profile_screen.dart`:
  - Alongside `_loadMine(state)`, calls `_loadAi(state)` which runs `state.ai.status()` and `state.ai.listEvents(1)` concurrently:
    - If both reject with `404` (`ai_not_configured`), hides the AI card completely so existing non-AI profile behavior is untouched.
    - When `status()` succeeds, stores `AiStatus _aiStatus` and `_aiCapabilitySaved`.
    - When `listEvents(1)` succeeds, stores `_events`, `_eventTotal`, `_eventPage`, and `_historyLoaded = true`.
  - Renders a `BoardCard` above the My Dishes / My Ingredients lists when `_aiStatus != null || _historyLoaded`:
    - Header row: `state.t('profile.aiTitle').toUpperCase()` and quota usage `state.t('profile.aiUsage', {'used': '${quota.used}', 'limit': '${quota.limit}'})`.
    - Capability selector (`ValueKey('profile-ai-capability')`) with options `read_only`, `prepare`, `act_freely`; on change calls `state.ai.setCapability(next)`, shows `state.t('profile.capabilitySaved')` on success, or reverts and shows `state.t('common.errorBody')` on failure.
    - Delete conversation button (`ValueKey('profile-delete-conversation')`, `state.t('profile.deleteConversation')`): opens a confirm `AlertDialog` with `state.t('profile.deleteConversationConfirm')` (`common.cancel` / `common.delete`), calls `state.ai.clearConversation()`, and shows `state.t('profile.conversationDeleted')`.
    - Disabled notice `state.t('ask.disabled')` when `_aiStatus?.enabled == false`.
    - Cooking history subsection (`state.t('profile.historyTitle').toUpperCase()`):
      - Clear history button (`ValueKey('profile-clear-history')`, `state.t('profile.clearHistory')`) when `_events.isNotEmpty`: opens confirm `AlertDialog` with `state.t('profile.clearHistoryConfirm')`, calls `state.ai.clearEvents()`, resets `_events = []`, `_eventTotal = 0`, `_eventPage = 1`, and shows `state.t('profile.historyCleared')`.
      - Empty state `state.t('profile.historyEmpty')` or error state `state.t('profile.historyLoadError')`.
      - Event rows: formatted date (`_joined(row.createdAt, state.locale)`), localized event type (`state.t(eventTypeKey(row.type))`), and target name (`row.label(state.locale)`). If `row.canNavigate` is true, tapping the target name navigates to `/dish` (`{'dish_id': row.targetId}`) or `/ingredient` (`{'ingredient_id': row.targetId}`).
      - Pagination bar when `historyPages > 1` (`ceil(_eventTotal / 25)`): `profile.prev` button (`ValueKey('profile-history-prev')`), `state.t('profile.page', {'page': '$_eventPage', 'pages': '$historyPages'})`, `profile.next` button (`ValueKey('profile-history-next')`).

- [ ] **Step 1: Write the failing widget tests in `flutter_web_dev/test/profile_ai_test.dart`**

```dart
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/screens/profile_screen.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';

const _catalogue = {
  'profile.title': 'Profile',
  'profile.changeCover': 'Change cover',
  'profile.joined': 'Joined {date}',
  'profile.myDishes': 'My dishes',
  'profile.myIngredients': 'My ingredients',
  'profile.noPosts': 'You have not written anything yet.',
  'profile.best': 'Best',
  'profile.aiTitle': 'AI assistant',
  'profile.aiUsage': 'Today: {used} of {limit} messages',
  'profile.capability': 'Assistant capability',
  'profile.capabilitySaved': 'Capability saved.',
  'profile.deleteConversation': 'Delete conversation',
  'profile.deleteConversationConfirm': 'Delete the stored assistant conversation?',
  'profile.conversationDeleted': 'Conversation deleted.',
  'profile.historyTitle': 'Cooking history',
  'profile.historyEmpty': 'No cooking history yet.',
  'profile.historyLoadError': 'The history could not be loaded.',
  'profile.clearHistory': 'Clear my history',
  'profile.clearHistoryConfirm': 'Clear your whole cooking history? This cannot be undone.',
  'profile.historyCleared': 'History cleared.',
  'profile.event.dish_viewed': 'Viewed a dish',
  'profile.event.dish_cooked': 'Cooked a dish',
  'profile.event.ingredient_picked': 'Picked an ingredient',
  'profile.event.chat_message': 'Asked the assistant',
  'profile.event.other': 'Other activity',
  'profile.page': 'Page {page} of {pages}',
  'profile.prev': 'Previous',
  'profile.next': 'Next',
  'ask.capability.read_only': 'Read only',
  'ask.capability.prepare': 'Prepare and confirm',
  'ask.capability.act_freely': 'Act freely, bounded',
  'ask.disabled': 'The assistant is switched off right now.',
  'nav.signOut': 'Sign out',
  'nav.signIn': 'Sign in',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.searchPlaceholder': 'Search',
  'common.loading': 'Loading',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.errorBody': 'Something went wrong.',
  'common.retry': 'Retry',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
};

http.Response _ok(Object body) => http.Response(
      json.encode(body),
      200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

void main() {
  testWidgets('profile shows AI usage, saves capability, paginates history, deletes conversation, and clears history', (tester) async {
    tester.view.physicalSize = const Size(1200, 1200);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    String? postedCapability;

    final api = ApiClient('http://test', client: MockClient((request) async {
      final pathWithQuery = '${request.url.path}${request.url.hasQuery ? '?${request.url.query}' : ''}';
      calls.add('${request.method} $pathWithQuery');
      if (request.url.path == '/api/auth/me') {
        return _ok({'user': {'id': 'u1', 'username': 'demo', 'created_at': '2024-05-01T00:00:00.000Z'}});
      }
      if (request.url.path == '/api/ai/status') {
        return _ok({
          'enabled': true,
          'capability': 'read_only',
          'quota': {'used': 4, 'limit': 20, 'remaining': 16, 'resets_at': '2026-11-24T00:00:00Z'}
        });
      }
      if (request.url.path == '/api/ai/capability') {
        postedCapability = (json.decode(request.body) as Map)['capability'] as String?;
        return _ok({'status': 'ok', 'capability': postedCapability});
      }
      if (request.url.path == '/api/ai/conversation' && request.method == 'DELETE') {
        return _ok({'status': 'ok'});
      }
      if (request.url.path == '/api/ai/events' && request.method == 'GET') {
        final page = int.tryParse(request.url.queryParameters['page'] ?? '1') ?? 1;
        return _ok({
          'rows': [
            {
              'id': 'e$page',
              'type': page == 1 ? 'dish_cooked' : 'ingredient_picked',
              'target_type': page == 1 ? 'dish' : 'ingredient',
              'target_id': '64b00000000000000000001$page',
              'target_name': page == 1 ? 'Beef noodle soup' : 'Ginger',
              'target_name_vi': page == 1 ? 'Phở bò' : 'Gừng',
              'created_at': '2026-11-23T10:00:00.000Z',
            }
          ],
          'total': 30,
          'page': page,
        });
      }
      if (request.url.path == '/api/ai/events' && request.method == 'DELETE') {
        return _ok({'status': 'ok', 'deleted': 30});
      }
      return _ok({'isSuccess': true, 'data': []});
    }));

    final state = AppState(
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(_catalogue)},
      api: api,
    );
    await state.refreshAccount();

    await tester.pumpWidget(AppScope(
      state: state,
      child: MaterialApp(
        theme: boardTheme(BoardTokens.dark),
        home: const ProfileScreen(),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Today: 4 of 20 messages'), findsOneWidget);
    expect(find.text('Cooked a dish'), findsOneWidget);
    expect(find.text('Beef noodle soup'), findsOneWidget);
    expect(find.text('Page 1 of 2'), findsOneWidget);

    // Change capability to prepare
    await tester.tap(find.byKey(const ValueKey('profile-ai-capability')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Prepare and confirm').last);
    await tester.pumpAndSettle();
    expect(postedCapability, 'prepare');
    expect(find.text('Capability saved.'), findsOneWidget);

    // Paginate to page 2
    await tester.tap(find.byKey(const ValueKey('profile-history-next')));
    await tester.pumpAndSettle();
    expect(find.text('Page 2 of 2'), findsOneWidget);
    expect(find.text('Picked an ingredient'), findsOneWidget);
    expect(find.text('Ginger'), findsOneWidget);

    // Delete conversation with confirmation
    await tester.tap(find.byKey(const ValueKey('profile-delete-conversation')));
    await tester.pumpAndSettle();
    expect(find.text('Delete the stored assistant conversation?'), findsOneWidget);
    await tester.tap(find.text('Delete').last);
    await tester.pumpAndSettle();
    expect(calls, contains('DELETE /api/ai/conversation'));
    expect(find.text('Conversation deleted.'), findsOneWidget);

    // Clear history with confirmation
    await tester.tap(find.byKey(const ValueKey('profile-clear-history')));
    await tester.pumpAndSettle();
    expect(find.text('Clear your whole cooking history? This cannot be undone.'), findsOneWidget);
    await tester.tap(find.text('Delete').last);
    await tester.pumpAndSettle();
    expect(calls, contains('DELETE /api/ai/events'));
    expect(find.text('History cleared.'), findsOneWidget);
    expect(find.text('No cooking history yet.'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd flutter_web_dev && flutter test test/profile_ai_test.dart`
Expected: FAIL with `Expected: exactly one matching candidate` for `'Today: 4 of 20 messages'`

- [ ] **Step 3: Implement the AI and Cooking History section in `flutter_web_dev/lib/screens/profile_screen.dart`**

Update `ProfileScreen` in `flutter_web_dev/lib/screens/profile_screen.dart` to load `/api/ai/status` and `/api/ai/events?page=1` in `_loadAi(state)` (called during `_loadMine(state)` without failing `_failed` when `/api/ai/*` returns 404 or a default test mock returns `{isSuccess: true, data: []}`). Render the AI assistant card with the capability dropdown, usage line, delete conversation button, and paginated cooking history list with clear history button.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd flutter_web_dev && flutter test test/profile_ai_test.dart test/profile_screen_test.dart test/profile_guard_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add flutter_web_dev/lib/screens/profile_screen.dart flutter_web_dev/test/profile_ai_test.dart
git commit -m "feat(flutter-ai): add AI controls and cooking history to ProfileScreen"
```

---

### Task 6: Documentation Update, Web Build, Copy to `server/web/`, and Full Verification

**Files:**
- Modify: `README.md:236-251`
- Modify: `docs/KNOWN_ISSUES.md:83-88`
- Build output: `server/web/` (generated from `flutter build web --base-href /flutter/`)

**Interfaces:**
- Consumes: Tasks 1–5
- Produces:
  - Updated Flutter section in `README.md` stating that both Vue and Flutter clients include the Ask assistant, capability/quota controls, cooking history on the profile, and event recording.
  - Updated item 25 in `docs/KNOWN_ISSUES.md` recording that the Flutter client now has full AI assistant parity with Vue.
  - Fresh `server/web/` build copied from `flutter_web_dev/build/web/*`.

- [ ] **Step 1: Update `README.md` and `docs/KNOWN_ISSUES.md`**

In `README.md` under `## Run the Flutter client`, replace the paragraph saying the assistant is Vue-only with:
```markdown
Both the Vue and Flutter clients include the Ask assistant, capability and quota controls, cooking
history on the profile, and event recording (`dish_viewed`, `dish_cooked`, `ingredient_picked`).
```

In `docs/KNOWN_ISSUES.md`, update item 25 under `## AI assistant`:
```markdown
25. **Flutter assistant parity is complete.** The Flutter client now hosts the Ask sheet (inferred
    goal chip with override re-send, SSE streaming with abort, tool and citation links, and confirm
    cards), the profile AI capability/quota controls and paginated cooking history, and the event
    recorder (`dish_viewed`, `dish_cooked`, `ingredient_picked`).
```

- [ ] **Step 2: Run Flutter tests and analyzer**

Run:
```bash
cd flutter_web_dev
flutter test
flutter analyze --no-fatal-infos
```
Expected:
- `flutter test`: all tests pass (baseline 77 + new unit and widget tests >= 92 passing, 0 failing).
- `flutter analyze --no-fatal-infos`: 0 errors, 0 warnings.

- [ ] **Step 3: Build Flutter web with `/flutter/` base href and copy `build/web/*` into `server/web/`**

Run:
```powershell
cd flutter_web_dev
flutter build web --base-href /flutter/
Copy-Item -Path build/web/* -Destination ../server/web/ -Recurse -Force
```
Expected: `server/web/index.html` contains `<base href="/flutter/">` and `server/web/main.dart.js` is updated.

- [ ] **Step 4: Run server test suite to confirm 221/221 pass**

Run:
```bash
cd server
npm test
```
Expected: 221 tests passing, 0 failing (including `flutter_host.routes.test.js` serving `/flutter/`).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/KNOWN_ISSUES.md server/web
git commit -m "build(flutter): rebuild server/web with AI assistant and update docs"
```

## Verification Commands and Expected Counts

```bash
# 1. Flutter unit and widget test suite (baseline: 77; after plan: >= 92 passing, 0 failing)
cd flutter_web_dev && flutter test

# 2. Flutter static analyzer (0 errors, 0 fatal infos)
cd flutter_web_dev && flutter analyze --no-fatal-infos

# 3. Flutter web production build and deployment into server/web/
cd flutter_web_dev && flutter build web --base-href /flutter/
# PowerShell copy:
Copy-Item -Path flutter_web_dev/build/web/* -Destination server/web/ -Recurse -Force

# 4. Server test suite (expected: 221 passing, 0 failing; no server code modified)
cd server && npm test
```
