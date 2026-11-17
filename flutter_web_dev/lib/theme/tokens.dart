import 'package:flutter/material.dart';

///Palette and spacing copied from web_ui/src/assets/css/theme.css.
class BoardTokens {
  const BoardTokens({
    required this.bg,
    required this.raised,
    required this.line,
    required this.lineStrong,
    required this.ink,
    required this.dim,
    required this.red,
    required this.danger,
    required this.amber,
    required this.green,
  });

  final Color bg;
  final Color raised;
  final Color line;
  final Color lineStrong;
  final Color ink;
  final Color dim;
  final Color red;
  final Color danger;
  final Color amber;
  final Color green;

  static const double radius = 6;
  static const double s1 = 4;
  static const double s2 = 8;
  static const double s3 = 12;
  static const double s4 = 16;
  static const double s5 = 24;
  static const double s6 = 32;
  static const double boardWidth = 1080;

  static const BoardTokens dark = BoardTokens(
    bg: Color(0xFF14171C),
    raised: Color(0xFF1B2027),
    line: Color(0xFF3A434F),
    lineStrong: Color(0xFF5B6470),
    ink: Color(0xFFF2F0EA),
    dim: Color(0xFFA7B0BB),
    red: Color(0xFFA85634),
    danger: Color(0xFFE0785A),
    amber: Color(0xFFD99A4E),
    green: Color(0xFF6FAE86),
  );

  static const BoardTokens light = BoardTokens(
    bg: Color(0xFFF6F4EF),
    raised: Color(0xFFFFFFFF),
    line: Color(0xFFC3BCAE),
    lineStrong: Color(0xFF8A8578),
    ink: Color(0xFF1D2127),
    dim: Color(0xFF5B6470),
    red: Color(0xFF96482B),
    danger: Color(0xFF8F2F18),
    amber: Color(0xFF8A5A12),
    green: Color(0xFF2F6B45),
  );

  static BoardTokens of(bool isLight) => isLight ? light : dark;
}
