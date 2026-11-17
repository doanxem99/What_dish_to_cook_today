import 'dart:convert';

import 'package:http/http.dart' as http;

///Copy lives in the server's shared catalogues, so both clients read one file.
class I18n {
  I18n(this.messages);

  final Map<String, String> messages;

  String t(String key, [Map<String, String>? params]) {
    var value = messages[key] ?? key;
    if (params != null) {
      params.forEach((name, replacement) {
        value = value.replaceAll('{$name}', replacement);
      });
    }
    return value;
  }

  static Map<String, String> flatten(Map<String, dynamic> json, [String prefix = '']) {
    final flat = <String, String>{};
    json.forEach((key, value) {
      final path = prefix.isEmpty ? key : '$prefix.$key';
      if (value is Map<String, dynamic>) {
        flat.addAll(flatten(value, path));
      } else if (value != null) {
        flat[path] = value.toString();
      }
    });
    return flat;
  }

  ///Vietnamese wins when it has text; otherwise English is the fallback.
  static String label(String vi, String en, String locale) {
    return locale == 'vi' && vi.isNotEmpty ? vi : en;
  }

  static Future<I18n> load(String serverUrl, String locale) async {
    final base = serverUrl.endsWith('/') ? serverUrl : '$serverUrl/';
    final response = await http.get(Uri.parse('${base}public/i18n/$locale.json'));
    if (response.statusCode != 200) {
      throw Exception('Catalogue $locale answered ${response.statusCode}');
    }
    final decoded = json.decode(utf8.decode(response.bodyBytes));
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Catalogue $locale is not an object');
    }
    return I18n(flatten(decoded));
  }
}
