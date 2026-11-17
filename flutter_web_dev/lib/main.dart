import 'package:flutter/material.dart';
import 'package:url_strategy/url_strategy.dart';

import 'app.dart';

void main() {
  //Path URLs keep /flutter/dishes readable and deep-linkable.
  setPathUrlStrategy();
  runApp(const BoardApp());
}
