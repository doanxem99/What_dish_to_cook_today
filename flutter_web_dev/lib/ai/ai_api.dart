import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../api/api_client.dart';
import 'ai_models.dart';

///Null means "not checked yet"; true/false is the answer from `/api/ai/status`.
final ValueNotifier<bool?> askAvailable = ValueNotifier<bool?>(null);

class AiApiException implements Exception {
  AiApiException(this.status, this.code, this.message);

  final int status;
  final String code;
  final String message;

  @override
  String toString() => 'AiApiException($status $code): $message';
}

class AiChatCancelToken {
  bool _cancelled = false;
  StreamSubscription<dynamic>? _subscription;
  void Function()? onCancel;

  bool get isCancelled => _cancelled;

  void cancel() {
    _cancelled = true;
    _subscription?.cancel();
    onCancel?.call();
  }

  void attach(StreamSubscription<dynamic> subscription) {
    _subscription = subscription;
    if (_cancelled) subscription.cancel();
  }
}

///One assistant endpoint set, mirroring docs/API.md. JSON errors carry
///`{error:{code,message}}`, not the public `{message}` envelope.
class AiApi {
  AiApi(this._api);

  final ApiClient _api;
  static const Map<String, String> _jsonHeaders = {'content-type': 'application/json'};

  Future<AiStatus> status() async {
    final body = await _json('GET', '/api/ai/status');
    return AiStatus.fromJson(body);
  }

  Future<List<AiChatMessage>> conversation() async {
    final body = await _json('GET', '/api/ai/conversation');
    final messages = body?['messages'];
    if (messages is! List) return const <AiChatMessage>[];
    return messages.map(AiChatMessage.fromHistoryJson).toList();
  }

  Future<void> clearConversation() async {
    await _json('DELETE', '/api/ai/conversation');
  }

  Future<String> setCapability(String capability) async {
    final body = await _json('POST', '/api/ai/capability', body: {'capability': capability});
    return '${body?['capability'] ?? capability}';
  }

  Future<AiEventPage> listEvents(int page) async {
    final body = await _json('GET', '/api/ai/events?page=$page');
    return AiEventPage.fromJson(body);
  }

  Future<int> clearEvents() async {
    final body = await _json('DELETE', '/api/ai/events');
    return (body?['deleted'] as num?)?.toInt() ?? 0;
  }

  Future<void> recordEvent(String type, String targetId) async {
    await _json('POST', '/api/ai/events', body: {'type': type, 'target_id': targetId});
  }

  ///Checks whether the assistant exists for this deployment. A 404 is a normal
  ///"not configured" answer, not an error.
  Future<bool> ensureAskAvailable() async {
    try {
      final current = await status();
      askAvailable.value = current.enabled;
      return current.enabled;
    } on AiApiException catch (error) {
      askAvailable.value = error.status == 404 ? false : askAvailable.value;
      return askAvailable.value ?? false;
    } catch (_) {
      return askAvailable.value ?? false;
    }
  }

  ///Streams one answer. Omit [mode] to let the server infer the goal; send it
  ///only when the cook changed the label.
  Future<void> streamChat({
    required String message,
    required String locale,
    required String capability,
    String? mode,
    String? dishId,
    int? pantryCount,
    AiChatCancelToken? cancel,
    required void Function(AiSseEvent event) onEvent,
  }) async {
    final payload = <String, dynamic>{
      'message': message,
      'locale': locale,
      'capability': capability,
      if (mode != null && mode.isNotEmpty) 'mode': mode,
      if (dishId != null && dishId.isNotEmpty) 'dish_id': dishId,
      if (pantryCount != null) 'pantry_count': pantryCount,
    };
    final request = http.Request('POST', _api.uriFor('/api/ai/chat'))
      ..headers.addAll(_jsonHeaders)
      ..body = json.encode(payload);

    final response = await _api.send(request);
    if (response.statusCode != 200) {
      final text = await response.stream.bytesToString();
      throw _errorFrom(response.statusCode, text);
    }

    final completer = Completer<void>();
    if (cancel?.isCancelled == true) {
      completer.complete();
      return completer.future;
    }
    var buffer = '';
    cancel?.onCancel = () {
      if (!completer.isCompleted) completer.complete();
    };
    late final StreamSubscription<String> subscription;
    subscription = response.stream.transform(utf8.decoder).listen(
      (chunk) {
        if (cancel?.isCancelled == true) return;
        buffer += chunk;
        final parsed = parseSseBuffer(buffer);
        buffer = parsed.remainder;
        for (final event in parsed.events) {
          if (cancel?.isCancelled == true) break;
          onEvent(event);
        }
      },
      onError: (Object error) {
        if (!completer.isCompleted) completer.completeError(error);
      },
      onDone: () {
        if (!completer.isCompleted) completer.complete();
      },
      cancelOnError: true,
    );
    cancel?.attach(subscription);
    return completer.future;
  }

  Future<Map<String, dynamic>?> _json(String method, String path, {Map<String, dynamic>? body}) async {
    final request = http.Request(method, _api.uriFor(path));
    if (body != null) {
      request.headers.addAll(_jsonHeaders);
      request.body = json.encode(body);
    }
    final response = await _api.send(request);
    final text = await response.stream.bytesToString();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _errorFrom(response.statusCode, text);
    }
    if (text.trim().isEmpty) return null;
    final decoded = json.decode(text);
    return decoded is Map<String, dynamic> ? decoded : null;
  }

  AiApiException _errorFrom(int status, String text) {
    String code = 'http_$status';
    String message = text;
    try {
      final decoded = json.decode(text);
      if (decoded is Map && decoded['error'] is Map) {
        final error = decoded['error'] as Map;
        code = '${error['code'] ?? code}';
        message = '${error['message'] ?? message}';
      }
    } catch (_) {
      //Keep the raw text; the UI only shows a catalogue key anyway.
    }
    return AiApiException(status, code, message);
  }
}
