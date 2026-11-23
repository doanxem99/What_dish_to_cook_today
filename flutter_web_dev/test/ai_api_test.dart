import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/ai/ai_api.dart';
import 'package:what_dish_to_cook_today/ai/ai_models.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';

const _dishId = '64b000000000000000000011';

ApiClient _client(MockClient mock) => ApiClient('http://test', client: mock);

void main() {
  test('status, conversation, capability and events follow the server contract', () async {
    final calls = <String>[];
    final mock = MockClient((request) async {
      calls.add('${request.method} ${request.url.path}${request.url.hasQuery ? '?${request.url.query}' : ''}');
      final path = request.url.path;
      if (path == '/api/ai/status') {
        return http.Response(json.encode({
          'enabled': true,
          'capability': 'prepare',
          'quota': {'used': 3, 'limit': 20, 'remaining': 17, 'resets_at': '2026-11-24T00:00:00.000Z'}
        }), 200);
      }
      if (path == '/api/ai/conversation') {
        if (request.method == 'DELETE') {
          return http.Response(json.encode({'status': 'ok'}), 200);
        }
        return http.Response(json.encode({
          'capability': 'prepare',
          'quota': {'used': 0, 'limit': 20, 'remaining': 20},
          'messages': [
            {'role': 'user', 'content': 'What can I cook?'},
            {
              'role': 'assistant',
              'content': 'Try pho.',
              'mode': 'cook',
              'mode_source': 'rules',
              'citations': [
                {'target_type': 'dish', 'id': _dishId, 'name': 'Pho', 'name_vi': 'Pho bo'}
              ],
              'tool_summary': [
                {'name': 'search_dishes', 'summary': {'count': 3}}
              ],
              'stopped': false
            }
          ]
        }), 200);
      }
      if (path == '/api/ai/capability') {
        final body = json.decode(request.body) as Map<String, dynamic>;
        return http.Response(json.encode({'status': 'ok', 'capability': body['capability']}), 200);
      }
      if (path == '/api/ai/events') {
        if (request.method == 'DELETE') {
          return http.Response(json.encode({'status': 'ok', 'deleted': 1}), 200);
        }
        if (request.method == 'POST') {
          return http.Response(json.encode({'status': 'ok'}), 200);
        }
        return http.Response(json.encode({
          'rows': [
            {
              'id': 'e1',
              'type': 'dish_cooked',
              'target_type': 'dish',
              'target_id': _dishId,
              'target_name': 'Pho',
              'target_name_vi': 'Pho bo',
              'created_at': '2026-11-23T10:00:00.000Z'
            }
          ],
          'total': 1,
          'page': 1
        }), 200);
      }
      return http.Response(json.encode({'status': 'ok'}), 200);
    });

    final ai = AiApi(_client(mock));
    final status = await ai.status();
    expect(status.enabled, isTrue);
    expect(status.capability, 'prepare');
    expect(status.quota.remaining, 17);

    final conversation = await ai.conversation();
    expect(conversation.length, 2);
    expect(conversation[1].goal!.labelKey, 'ask.mode.cook');
    expect(conversation[1].citations.first.nameVi, 'Pho bo');
    expect(conversation[1].tools.first.i18nKey, 'ask.tool.searchDishes');

    expect(await ai.setCapability('act_freely'), 'act_freely');
    await ai.clearConversation();

    final events = await ai.listEvents(1);
    expect(events.total, 1);
    expect(events.rows.first.label('vi'), 'Pho bo');
    expect(await ai.clearEvents(), 1);
    await ai.recordEvent('dish_viewed', _dishId);

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

  test('streamChat emits meta, tool, tokens, notice and done frames', () async {
    late Map<String, dynamic> sent;
    final mock = MockClient.streaming((request, bodyStream) async {
      sent = json.decode(await bodyStream.bytesToString()) as Map<String, dynamic>;
      final chunks = [
        'event: meta\ndata: {"mode":"cook","mode_source":"rules","embed_down":true}\n\n',
        'event: tool\ndata: {"name":"search_dishes","summary":{"count":3},"citations":[{"target_type":"dish","id":"$_dishId","name":"Pho"}]}\n\n',
        'event: token\ndata: {"te',
        'xt":"Try "}\n\n',
        'event: token\ndata: {"text":"pho."}\n\n',
        'event: notice\ndata: {"code":"ungrounded","dishes":["Pho"]}\n\n',
        'event: done\ndata: {"citations":[],"actions":[],"quota":{"used":4,"limit":20,"remaining":16}}\n\n'
      ];
      final body = http.ByteStream(Stream.fromIterable(chunks.map(utf8.encode)));
      return http.StreamedResponse(body, 200, headers: {'content-type': 'text/event-stream'});
    });

    final ai = AiApi(_client(mock));
    final events = <AiSseEvent>[];
    final answers = <String>[];
    await ai.streamChat(
      message: 'What can I cook with rice?',
      locale: 'en',
      capability: 'read_only',
      onEvent: (event) {
        events.add(event);
        if (event.event == 'token') answers.add('${event.data['text'] ?? ''}');
      }
    );

    expect(sent['message'], 'What can I cook with rice?');
    expect(sent.containsKey('mode'), isFalse);
    expect(events.map((event) => event.event).toList(),
        containsAllInOrder(['meta', 'tool', 'token', 'token', 'notice', 'done']));
    expect(answers.join(), 'Try pho.');
    expect(events.first.data['mode'], 'cook');
  });

  test('streamChat keeps Vietnamese text intact when a character is split across chunks', () async {
    final mock = MockClient.streaming((request, bodyStream) async {
      unawaited(bodyStream.drain<void>());
      final bytes = utf8.encode('event: token\ndata: {"text":"Phở"}\n\n');
      final cut = bytes.indexOf(0xE1) + 1; //Inside the multi-byte sequence.
      final stream = Stream<List<int>>.fromIterable([bytes.sublist(0, cut), bytes.sublist(cut)]);
      return http.StreamedResponse(stream, 200);
    });

    final ai = AiApi(_client(mock));
    final answers = <String>[];
    await ai.streamChat(
      message: 'xin chao',
      locale: 'vi',
      capability: 'read_only',
      onEvent: (event) {
        if (event.event == 'token') answers.add('${event.data['text'] ?? ''}');
      },
    );
    expect(answers.join(), 'Phở');
  });

  test('an error envelope becomes AiApiException with the real code', () async {
    final mock = MockClient((request) async {
      return http.Response(json.encode({
        'error': {'code': 'quota_reached', 'message': 'No messages left today'}
      }), 429);
    });

    final ai = AiApi(_client(mock));
    await expectLater(
      ai.status(),
      throwsA(isA<AiApiException>()
          .having((error) => error.status, 'status', 429)
          .having((error) => error.code, 'code', 'quota_reached')),
    );
  });

  test('cancel before headers arrive still completes the future', () async {
    final mock = MockClient.streaming((request, bodyStream) async {
      unawaited(bodyStream.drain<void>());
      return http.StreamedResponse(const Stream<List<int>>.empty(), 200);
    });
    final ai = AiApi(_client(mock));
    final token = AiChatCancelToken()..cancel();
    await ai.streamChat(
      message: 'hello',
      locale: 'en',
      capability: 'read_only',
      cancel: token,
      onEvent: (_) {},
    );
  });

  test('cancel stops further events', () async {
    final controller = StreamController<List<int>>();
    final mock = MockClient.streaming((request, bodyStream) async {
      unawaited(bodyStream.drain<void>());
      return http.StreamedResponse(controller.stream, 200);
    });

    final ai = AiApi(_client(mock));
    final token = AiChatCancelToken();
    var seen = 0;
    final streaming = ai.streamChat(
      message: 'hello',
      locale: 'en',
      capability: 'read_only',
      cancel: token,
      onEvent: (event) => seen += 1
    );

    controller.add(utf8.encode('event: token\ndata: {"text":"one"}\n\n'));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    token.cancel();
    controller.add(utf8.encode('event: token\ndata: {"text":"two"}\n\n'));
    await controller.close();
    await streaming;
    expect(seen, 1);
  });
}

