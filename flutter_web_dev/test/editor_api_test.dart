//Editors talk to the gallery upload and translate routes.
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/editor/editor_api.dart';

ApiClient _api(void Function(http.BaseRequest request, String body) onRequest, {Object? uploadBody}) {
  return ApiClient('http://test', client: MockClient((request) async {
    if (request.url.path == '/api/gallery_upload/temporary') {
      onRequest(request, request.body);
      return http.Response(
          json.encode(uploadBody ?? {'isSuccess': true, 'path': 'public/gallery/temporary/a.png'}), 200,
          headers: {'content-type': 'application/json; charset=utf-8'});
    }
    onRequest(request, request.body);
    return http.Response(json.encode({'text': 'Gà gừng'}), 200,
        headers: {'content-type': 'application/json; charset=utf-8'});
  }));
}

void main() {
  test('upload posts the file as multipart and returns the stored path', () async {
    late http.BaseRequest seen;
    late String body;
    final api = EditorApi(_api((request, requestBody) {
      seen = request;
      body = requestBody;
    }));

    final path = await api.upload(Uint8List.fromList([1, 2, 3]), 'cover.png');

    expect(seen.method, 'POST');
    expect(seen.url.path, '/api/gallery_upload/temporary');
    expect(seen.headers['content-type'], contains('multipart/form-data'));
    expect(body, contains('cover.png'));
    expect(path, 'public/gallery/temporary/a.png');
  });

  test('upload rejects a non-image and an oversized file before the request', () async {
    var calls = 0;
    final api = EditorApi(_api((request, body) => calls += 1));

    expect(() => api.upload(Uint8List.fromList([1]), 'notes.txt'), throwsA(isA<EditorException>()));
    expect(() => api.upload(Uint8List.fromList(List.filled(6 * 1024 * 1024, 1)), 'big.png'),
        throwsA(isA<EditorException>()));
    expect(calls, 0);
  });

  test('translate sends both language codes and returns the text', () async {
    late http.BaseRequest seen;
    late String body;
    final api = EditorApi(_api((request, requestBody) {
      seen = request;
      body = requestBody;
    }));

    final text = await api.translate('Ginger chicken', 'en', 'vi');

    expect(seen.url.path, '/api/translate');
    expect(json.decode(body), {'text': 'Ginger chicken', 'source': 'en', 'target': 'vi'});
    expect(text, 'Gà gừng');
  });
}
