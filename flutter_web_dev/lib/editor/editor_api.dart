import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../api/api_client.dart';

///Upload and translation calls used by both editors.
class EditorApi {
  EditorApi(this.client);

  final ApiClient client;

  static const int maxBytes = 5 * 1024 * 1024;

  Future<String> upload(Uint8List bytes, String filename) async {
    final name = filename.toLowerCase();
    final allowed = name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
    if (!allowed || bytes.length > maxBytes) {
      throw EditorException(allowed ? 'too-large' : 'type');
    }

    final request = http.MultipartRequest('POST', client.uriFor('/api/gallery_upload/temporary'));
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final response = await client.send(request);
    final raw = await response.stream.toBytes();
    String body;
    try {
      body = utf8.decode(raw, allowMalformed: true);
    } catch (_) {
      body = '';
    }
    dynamic decoded;
    try {
      decoded = json.decode(body);
    } catch (_) {
      decoded = null;
    }
    final serverMessage = decoded is Map ? (decoded['status'] ?? decoded['message'])?.toString() : null;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EditorException('upload', statusCode: response.statusCode, serverMessage: serverMessage);
    }
    if (decoded is Map && decoded['isSuccess'] == false) {
      throw EditorException('upload', statusCode: response.statusCode, serverMessage: serverMessage);
    }
    final path = decoded is Map ? decoded['path'] : null;
    if (path is! String || path.isEmpty) {
      throw EditorException('upload', statusCode: response.statusCode, serverMessage: serverMessage);
    }
    return path;
  }

  Future<String> translate(String text, String source, String target) async {
    dynamic payload;
    try {
      payload = await client.postJson('/api/translate', {
        'text': text,
        'source': source,
        'target': target,
      });
    } on ApiException catch (error) {
      throw EditorException('translate', statusCode: error.statusCode, serverMessage: error.message);
    }
    final value = payload is Map ? payload['text'] : null;
    if (value is! String || value.isEmpty) {
      throw EditorException('translate');
    }
    return value;
  }
}

class EditorException implements Exception {
  EditorException(this.kind, {this.statusCode, this.serverMessage});

  final String kind;
  final int? statusCode;
  final String? serverMessage;

  bool get isUnauthorised => statusCode == 401;

  @override
  String toString() => kind;
}
