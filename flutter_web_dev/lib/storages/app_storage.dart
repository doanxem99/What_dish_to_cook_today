import 'package:flutter/foundation.dart';

import 'local_store_stub.dart' if (dart.library.js_interop) 'local_store_web.dart';

class AppStorage
{
  ///On the web the API is served from the same origin as the client; tests and
  ///desktop runs fall back to the local server.
  static String get serverUrl
  {
    if (kIsWeb && Uri.base.scheme.startsWith('http'))
    {
      return '${Uri.base.origin}/';
    }
    return "http://localhost:3000/";
  }

  static const String basketKey = 'basket';

  static String? read(String key) => readKey(key);

  static void write(String key, String value) => writeKey(key, value);
}
