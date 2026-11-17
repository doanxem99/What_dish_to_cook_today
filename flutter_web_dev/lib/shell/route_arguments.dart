import 'package:flutter/widgets.dart';

///Reads the `next` argument a guard passed to sign-in and keeps it local.
String nextRoute(BuildContext context) {
  final arguments = ModalRoute.of(context)?.settings.arguments;
  if (arguments is Map) {
    final next = arguments['next'];
    if (next is String && next.startsWith('/') && next != '/signin' && next != '/signup') {
      return next;
    }
  }
  return '/';
}
