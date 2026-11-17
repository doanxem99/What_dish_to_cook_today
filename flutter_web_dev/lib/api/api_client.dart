import 'dart:convert';

import 'package:http/http.dart' as http;

import 'http_client_stub.dart' if (dart.library.js_interop) 'http_client_web.dart';

///Thin layer over the Express API: mixed envelopes in, payload out.
class ApiClient {
  ApiClient(this.baseUrl, {http.Client? client}) : _client = client ?? createHttpClient();

  final String baseUrl;
  final http.Client _client;

  String get _base => baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;

  Uri _uri(String path) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$_base$cleanPath');
  }

  Future<dynamic> getJson(String path) async {
    final response = await _client.get(_uri(path));
    return _payload(response, path);
  }

  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    final response = await _client.post(
      _uri(path),
      headers: {'content-type': 'application/json'},
      body: json.encode(body),
    );
    return _payload(response, path);
  }

  Future<dynamic> deleteJson(String path) async {
    final response = await _client.delete(_uri(path));
    return _payload(response, path);
  }

  dynamic _payload(http.Response response, String path) {
    dynamic decoded;
    try {
      decoded = json.decode(utf8.decode(response.bodyBytes));
    } catch (_) {
      decoded = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map ? (decoded['message'] ?? decoded['detail']) : null;
      throw ApiException(
        message == null || message.toString().isEmpty
            ? 'Request $path answered ${response.statusCode}'
            : message.toString(),
      );
    }
    if (decoded is Map<String, dynamic> && decoded.containsKey('data')) {
      return decoded['data'];
    }
    return decoded;
  }

  String imageUrl(String path) {
    if (path.isEmpty) {
      return '';
    }
    final normalised = path.replaceAll('\\', '/');
    final withSlash = normalised.startsWith('/') ? normalised.substring(1) : normalised;
    return '$_base/$withSlash';
  }
}

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}
