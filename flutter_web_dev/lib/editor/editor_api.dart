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
    final body = await response.stream.bytesToString();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw EditorException('upload');
    }
    dynamic decoded;
    try {
      decoded = json.decode(body);
    } catch (_) {
      decoded = null;
    }
    final path = decoded is Map ? decoded['path'] : null;
    if (path is! String || path.isEmpty) {
      throw EditorException('upload');
    }
    return path;
  }

  Future<String> translate(String text, String source, String target) async {
    final payload = await client.postJson('/api/translate', {
      'text': text,
      'source': source,
      'target': target,
    });
    final value = payload is Map ? payload['text'] : null;
    if (value is! String || value.isEmpty) {
      throw EditorException('translate');
    }
    return value;
  }
}

class EditorException implements Exception {
  EditorException(this.kind);

  final String kind;

  @override
  String toString() => kind;
}
