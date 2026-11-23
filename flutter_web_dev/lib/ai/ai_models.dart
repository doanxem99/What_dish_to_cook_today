import 'dart:convert';

import '../state/app_state.dart' show BasketItem;

///Shared vocabulary for the assistant, mirroring the server contract in docs/API.md.

const List<String> askModes = ['cook', 'walkthrough', 'help'];
const List<String> askCapabilities = ['read_only', 'prepare', 'act_freely'];

final RegExp _objectId = RegExp(r'^[a-fA-F0-9]{24}$');

bool isValidObjectId(String value) => _objectId.hasMatch(value);

bool validateMessageInput(String text) {
  final trimmed = text.trim();
  return trimmed.isNotEmpty && trimmed.length <= 2000;
}

Map<String, dynamic> _map(dynamic json) =>
    json is Map<String, dynamic> ? json : const <String, dynamic>{};

String _text(dynamic value) => value == null ? '' : '$value';

class AiQuota {
  const AiQuota({this.used = 0, this.limit = 20, this.remaining = 20, this.resetsAt = ''});

  final int used;
  final int limit;
  final int remaining;
  final String resetsAt;

  bool get isReached => remaining <= 0;

  factory AiQuota.fromJson(dynamic json) {
    final map = _map(json);
    return AiQuota(
      used: (map['used'] as num?)?.toInt() ?? 0,
      limit: (map['limit'] as num?)?.toInt() ?? 20,
      remaining: (map['remaining'] as num?)?.toInt() ?? 20,
      resetsAt: _text(map['resets_at']),
    );
  }

  AiQuota copyWith({int? used, int? limit, int? remaining, String? resetsAt}) => AiQuota(
        used: used ?? this.used,
        limit: limit ?? this.limit,
        remaining: remaining ?? this.remaining,
        resetsAt: resetsAt ?? this.resetsAt,
      );
}

class AiStatus {
  const AiStatus({this.enabled = false, this.capability = 'read_only', this.quota = const AiQuota()});

  final bool enabled;
  final String capability;
  final AiQuota quota;

  factory AiStatus.fromJson(dynamic json) {
    final map = _map(json);
    return AiStatus(
      enabled: map['enabled'] == true,
      capability: _text(map['capability']).isEmpty ? 'read_only' : _text(map['capability']),
      quota: AiQuota.fromJson(map['quota']),
    );
  }
}

class AiCitation {
  const AiCitation({
    required this.targetType,
    required this.id,
    this.name = '',
    this.nameVi = '',
  });

  final String targetType;
  final String id;
  final String name;
  final String nameVi;

  factory AiCitation.fromJson(dynamic json) {
    final map = _map(json);
    return AiCitation(
      targetType: _text(map['target_type']),
      id: _text(map['id']),
      name: _text(map['name']),
      nameVi: _text(map['name_vi']),
    );
  }

  ///Only a catalog row may become a link; free-form model text never does.
  bool get isLinkable =>
      (targetType == 'dish' || targetType == 'ingredient') && isValidObjectId(id);

  String label(String locale, String unknownLabel) {
    if (locale == 'vi' && nameVi.isNotEmpty) return nameVi;
    return name.isNotEmpty ? name : unknownLabel;
  }
}

class AiToolSummary {
  const AiToolSummary({required this.name, this.summary = const <String, dynamic>{}});

  final String name;
  final Map<String, dynamic> summary;

  factory AiToolSummary.fromHistoryJson(dynamic json) {
    final map = _map(json);
    final summary = <String, dynamic>{};
    map.forEach((key, value) {
      if (key == 'name') return;
      if (value is Map) {
        summary.addAll(Map<String, dynamic>.from(value));
      } else {
        summary[key] = value;
      }
    });
    return AiToolSummary(name: _text(map['name']), summary: summary);
  }

  ///The tool label is a fixed catalogue key, never server prose.
  String get i18nKey {
    if (summary['error'] != null) return 'ask.tool.failed';
    if (name == 'search_dishes') return 'ask.tool.searchDishes';
    if (name == 'get_dish') return 'ask.tool.getDish';
    if (name == 'get_help') return 'ask.tool.getHelp';
    if (name == 'select_ingredients') return 'ask.tool.selectIngredients';
    if (name == 'open_dish') return 'ask.tool.openDish';
    if (name == 'start_draft') return 'ask.tool.startDraft';
    return 'ask.tool.generic';
  }

  Map<String, String> get i18nParams {
    for (final key in const ['dishes', 'passages', 'matched', 'dish', 'items', 'count']) {
      final value = summary[key];
      if (value is num) return <String, String>{'n': '${value.toInt()}'};
    }
    return const <String, String>{'n': '0'};
  }
}

class AiClientAction {
  const AiClientAction({
    required this.type,
    this.apply = false,
    this.link = '',
    this.items = const <BasketItem>[],
    this.prefillName = '',
    this.prefillIngredients = const <BasketItem>[],
    this.applied = false,
  });

  final String type;
  final bool apply;
  final String link;
  final List<BasketItem> items;
  final String prefillName;
  final List<BasketItem> prefillIngredients;
  final bool applied;

  factory AiClientAction.fromJson(dynamic json) {
    final map = _map(json);
    final rawItems = map['items'];
    final items = rawItems is List
        ? rawItems.whereType<Map>().map((row) => BasketItem.fromJson(Map<String, dynamic>.from(row))).toList()
        : <BasketItem>[];
    final rawIngredients = map['ingredients'];
    final ingredients = rawIngredients is List
        ? rawIngredients.whereType<Map>().map((row) => BasketItem.fromJson(Map<String, dynamic>.from(row))).toList()
        : <BasketItem>[];
    return AiClientAction(
      type: _text(map['type']),
      apply: map['apply'] == true,
      link: _text(map['link']),
      items: items,
      prefillName: _text(map['name']),
      prefillIngredients: ingredients,
      applied: false,
    );
  }

  String get signature => '$type:${link.isNotEmpty ? link : prefillName.isNotEmpty ? prefillName : items.length}';

  ///A dish id is trusted only from a relative, single-parameter link the server built.
  String get dishId {
    if (!link.startsWith('/dish_detail?dish_id=')) return '';
    final id = link.substring('/dish_detail?dish_id='.length);
    return isValidObjectId(id) ? id : '';
  }

  AiClientAction markApplied() => AiClientAction(
        type: type,
        apply: apply,
        link: link,
        items: items,
        prefillName: prefillName,
        prefillIngredients: prefillIngredients,
        applied: true,
      );
}

class AiGoalChip {
  const AiGoalChip({required this.mode, required this.source});

  final String mode;
  final String source;

  String get labelKey => 'ask.mode.$mode';
  String get noticeKey => source == 'user' ? 'ask.mode.overridden' : '';

  static AiGoalChip? from(String? mode, String? source) {
    if (mode == null || !askModes.contains(mode)) return null;
    return AiGoalChip(mode: mode, source: source ?? '');
  }
}

class AiChatMessage {
  AiChatMessage({
    required this.role,
    this.content = '',
    this.citations = const <AiCitation>[],
    this.tools = const <AiToolSummary>[],
    this.actions = const <AiClientAction>[],
    this.stopped = false,
    this.empty = false,
    this.goal,
    this.goalOpen = false,
  });

  final String role;
  String content;
  List<AiCitation> citations;
  List<AiToolSummary> tools;
  List<AiClientAction> actions;
  bool stopped;
  bool empty;
  AiGoalChip? goal;
  bool goalOpen;

  factory AiChatMessage.fromHistoryJson(dynamic json) {
    final map = _map(json);
    final citations = map['citations'];
    final tools = map['tool_summary'];
    return AiChatMessage(
      role: _text(map['role']).isEmpty ? 'assistant' : _text(map['role']),
      content: _text(map['content']),
      citations: citations is List ? citations.map(AiCitation.fromJson).toList() : const <AiCitation>[],
      tools: tools is List ? tools.map(AiToolSummary.fromHistoryJson).toList() : const <AiToolSummary>[],
      stopped: map['stopped'] == true,
      goal: AiGoalChip.from(_text(map['mode']), _text(map['mode_source'])),
    );
  }
}

class AiSseEvent {
  const AiSseEvent({required this.event, this.data = const <String, dynamic>{}});

  final String event;
  final Map<String, dynamic> data;
}

class SseParseResult {
  const SseParseResult({this.events = const <AiSseEvent>[], this.remainder = ''});

  final List<AiSseEvent> events;
  final String remainder;
}

///Frames arrive as `event:` + `data:` pairs separated by a blank line. A partial
///frame stays in the remainder until the newline that completes it.
SseParseResult parseSseBuffer(String buffer) {
  final events = <AiSseEvent>[];
  var rest = buffer;
  while (true) {
    final match = RegExp(r'\r?\n\r?\n').firstMatch(rest);
    if (match == null) break;
    final frame = rest.substring(0, match.start);
    rest = rest.substring(match.end);
    String? name;
    final dataLines = <String>[];
    for (final line in frame.split(RegExp(r'\r?\n'))) {
      if (line.startsWith('event:')) {
        name = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.add(line.substring(5).trimLeft());
      }
    }
    if (name == null && dataLines.isEmpty) continue;
    dynamic decoded;
    try {
      decoded = dataLines.isEmpty ? null : jsonDecode(dataLines.join('\n'));
    } catch (_) {
      continue;
    }
    events.add(AiSseEvent(event: name ?? 'message', data: _map(decoded)));
  }
  return SseParseResult(events: events, remainder: rest);
}

List<AiCitation> mergeCitations(List<AiCitation> existing, List<AiCitation> incoming) {
  final merged = <AiCitation>[];
  final seen = <String>{};
  for (final citation in [...existing, ...incoming]) {
    if (!citation.isLinkable) continue;
    final key = '${citation.targetType}:${citation.id}';
    if (seen.add(key)) merged.add(citation);
  }
  return merged;
}

String errorStateKey(int? status, String? code) {
  if (status == 429 || code == 'quota_reached') return 'ask.quotaReached';
  if (code == 'ai_disabled') return 'ask.disabled';
  if (status == 401 || code == 'unauthorized') return 'ask.signInPrompt';
  if (status == 503 || code == 'provider_down' || code == 'provider_error') return 'ask.providerDown';
  return 'ask.error';
}

String eventTypeKey(String type) {
  if (type == 'dish_viewed') return 'profile.event.dish_viewed';
  if (type == 'dish_cooked') return 'profile.event.dish_cooked';
  if (type == 'ingredient_picked') return 'profile.event.ingredient_picked';
  if (type == 'chat_message') return 'profile.event.chat_message';
  return 'profile.event.other';
}

class AiEventRow {
  const AiEventRow({
    required this.id,
    required this.type,
    this.targetType = '',
    this.targetId = '',
    this.targetName = '',
    this.targetNameVi = '',
    this.createdAt = '',
  });

  final String id;
  final String type;
  final String targetType;
  final String targetId;
  final String targetName;
  final String targetNameVi;
  final String createdAt;

  factory AiEventRow.fromJson(dynamic json) {
    final map = _map(json);
    return AiEventRow(
      id: _text(map['id']),
      type: _text(map['type']),
      targetType: _text(map['target_type']),
      targetId: _text(map['target_id']),
      targetName: _text(map['target_name']),
      targetNameVi: _text(map['target_name_vi']),
      createdAt: _text(map['created_at']),
    );
  }

  String label(String locale) {
    if (locale == 'vi' && targetNameVi.isNotEmpty) return targetNameVi;
    return targetName.isNotEmpty ? targetName : targetId;
  }

  bool get canNavigate =>
      (targetType == 'dish' || targetType == 'ingredient') && isValidObjectId(targetId);
}

class AiEventPage {
  const AiEventPage({this.rows = const <AiEventRow>[], this.total = 0, this.page = 1});

  final List<AiEventRow> rows;
  final int total;
  final int page;

  factory AiEventPage.fromJson(dynamic json) {
    final map = _map(json);
    final rows = map['rows'];
    return AiEventPage(
      rows: rows is List ? rows.map(AiEventRow.fromJson).toList() : const <AiEventRow>[],
      total: (map['total'] as num?)?.toInt() ?? 0,
      page: (map['page'] as num?)?.toInt() ?? 1,
    );
  }
}
