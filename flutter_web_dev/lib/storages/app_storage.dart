import 'package:flutter/foundation.dart';

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
}
