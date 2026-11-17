import 'package:flutter/material.dart';

import 'tokens.dart';

///Board look: flat ruled surfaces, no elevation, dense type.
ThemeData boardTheme(BoardTokens tokens) {
  final base = ThemeData(brightness: tokens.bg.computeLuminance() < 0.5 ? Brightness.dark : Brightness.light);
  final textTheme = base.textTheme
      .apply(bodyColor: tokens.ink, displayColor: tokens.ink)
      .copyWith(
        bodyMedium: TextStyle(fontSize: 14, height: 1.45, color: tokens.ink),
        bodySmall: TextStyle(fontSize: 12, height: 1.4, color: tokens.dim),
        titleLarge: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: tokens.ink),
        titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: tokens.ink),
        labelSmall: TextStyle(fontSize: 11, letterSpacing: 0.8, color: tokens.dim),
      );

  return base.copyWith(
    scaffoldBackgroundColor: tokens.bg,
    canvasColor: tokens.bg,
    cardColor: tokens.raised,
    dividerColor: tokens.line,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    textTheme: textTheme,
    colorScheme: ColorScheme.fromSeed(
      seedColor: tokens.red,
      brightness: base.brightness,
    ).copyWith(
      primary: tokens.red,
      secondary: tokens.amber,
      surface: tokens.raised,
      onSurface: tokens.ink,
      outline: tokens.line,
      error: tokens.danger,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: tokens.bg,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      hintStyle: TextStyle(fontSize: 13, color: tokens.dim),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(BoardTokens.radius),
        borderSide: BorderSide(color: tokens.lineStrong),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(BoardTokens.radius),
        borderSide: BorderSide(color: tokens.amber, width: 2),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: tokens.ink,
        textStyle: const TextStyle(fontSize: 13),
      ),
    ),
  );
}
