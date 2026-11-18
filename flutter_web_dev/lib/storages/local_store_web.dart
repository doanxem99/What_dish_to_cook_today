// ignore: deprecated_member_use, avoid_web_libraries_in_flutter
import 'dart:html' as html;

///The web client keeps the ingredient basket across reloads.
String? readKey(String key) => html.window.localStorage[key];

void writeKey(String key, String value) => html.window.localStorage[key] = value;
