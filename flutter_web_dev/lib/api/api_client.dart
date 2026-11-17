import 'dart:convert';

import 'package:http/http.dart' as http;

///Thin GET layer: the Express API answers in mixed envelopes, so callers get
///the payload only.
class ApiClient {
  ApiClient(this.baseUrl, {http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  String get _base => baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;

  Future<dynamic> getJson(String path) async {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final response = await _client.get(Uri.parse('$_base$cleanPath'));
    if (response.statusCode != 200) {
      throw ApiException('GET $cleanPath answered ${response.statusCode}');
    }
    final decoded = json.decode(utf8.decode(response.bodyBytes));
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
