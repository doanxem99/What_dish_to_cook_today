import 'package:flutter_test/flutter_test.dart';
import 'package:what_dish_to_cook_today/ai/ai_models.dart';

void main() {
  test('validateMessageInput enforces 1..2000 trimmed characters', () {
    expect(validateMessageInput(''), isFalse);
    expect(validateMessageInput('   \n '), isFalse);
    expect(validateMessageInput('pho?'), isTrue);
    expect(validateMessageInput('a' * 2000), isTrue);
    expect(validateMessageInput('a' * 2001), isFalse);
  });

  test('AiGoalChip returns null for unknown modes and marks user overrides', () {
    expect(AiGoalChip.from('', 'rules'), isNull);
    expect(AiGoalChip.from('unknown', 'user'), isNull);

    final inferred = AiGoalChip.from('cook', 'rules')!;
    expect(inferred.labelKey, 'ask.mode.cook');
    expect(inferred.noticeKey, '');

    final overridden = AiGoalChip.from('walkthrough', 'user')!;
    expect(overridden.labelKey, 'ask.mode.walkthrough');
    expect(overridden.noticeKey, 'ask.mode.overridden');
  });

  test('mergeCitations keeps only valid 24-hex dish/ingredient ids and dedupes', () {
    const validId = '64b000000000000000000011';
    const secondId = '64b000000000000000000022';
    final existing = [
      AiCitation.fromJson({'target_type': 'dish', 'id': validId, 'name': 'Pho', 'name_vi': 'Pho bo'}),
    ];
    final incoming = [
      AiCitation.fromJson({'target_type': 'dish', 'id': validId, 'name': 'Pho dup'}),
      AiCitation.fromJson({'target_type': 'dish', 'id': 'not-an-object-id', 'name': 'Fake'}),
      AiCitation.fromJson({'target_type': 'doc', 'id': secondId, 'name': 'Doc'}),
      AiCitation.fromJson({'target_type': 'ingredient', 'id': secondId, 'name': 'Beef', 'name_vi': 'Thit bo'}),
    ];

    final merged = mergeCitations(existing, incoming);
    expect(merged.length, 2);
    expect(merged[0].id, validId);
    expect(merged[0].label('vi', 'Unknown'), 'Pho bo');
    expect(merged[1].targetType, 'ingredient');
    expect(merged[1].id, secondId);
  });

  test('AiClientAction extracts a dishId only from a safe dish_detail link', () {
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
      'link': 'https://example.com/dish_detail?dish_id=$validId',
    });
    expect(unsafe.dishId, '');
  });

  test('parseSseBuffer returns complete frames and keeps the remainder', () {
    const raw = 'event: meta\n'
        'data: {"mode":"cook","mode_source":"rules","embed_down":false}\n\n'
        'event: token\n'
        'data: {"text":"Hello "}\n\n'
        'event: token\n'
        'data: {"text":"there"}';
    final first = parseSseBuffer(raw);
    expect(first.events.length, 2);
    expect(first.events.first.event, 'meta');
    expect(first.events.first.data['mode'], 'cook');
    expect(first.remainder.contains('there'), isTrue);

    final second = parseSseBuffer('${first.remainder}\n\n');
    expect(second.events.length, 1);
    expect(second.events.first.data['text'], 'there');
    expect(second.remainder.trim(), isEmpty);
  });

  test('errorStateKey separates quota, disabled, auth, provider and generic', () {
    expect(errorStateKey(429, 'quota_reached'), 'ask.quotaReached');
    expect(errorStateKey(403, 'ai_disabled'), 'ask.disabled');
    expect(errorStateKey(401, 'unauthorized'), 'ask.signInPrompt');
    expect(errorStateKey(503, 'provider_down'), 'ask.providerDown');
    expect(errorStateKey(500, 'server_error'), 'ask.error');
  });

  test('eventTypeKey maps the recorded event types', () {
    expect(eventTypeKey('dish_viewed'), 'profile.event.dish_viewed');
    expect(eventTypeKey('dish_cooked'), 'profile.event.dish_cooked');
    expect(eventTypeKey('ingredient_picked'), 'profile.event.ingredient_picked');
    expect(eventTypeKey('other'), 'profile.event.other');
  });

  test('AiEventRow exposes a navigable dish id only when the target is a dish', () {
    final row = AiEventRow.fromJson({
      'id': 'e1',
      'type': 'dish_cooked',
      'target_type': 'dish',
      'target_id': '64b000000000000000000011',
      'target_name': 'Pho',
      'created_at': '2026-11-23T10:00:00.000Z',
    });
    expect(row.canNavigate, isTrue);
    expect(row.label('en'), 'Pho');
  });
}
