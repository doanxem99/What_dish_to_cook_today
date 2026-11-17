import 'dart:async';
//The shell must fit a 320 px phone and a desktop without overflowing.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/app.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';

ApiClient quietApi() {
  return ApiClient('http://test', client: MockClient((request) async {
    return http.Response('{"isSuccess":true,"data":[]}', 200,
        headers: {'content-type': 'application/json; charset=utf-8'});
  }));
}

Widget buildApp() {
  return BoardApp(api: quietApi(), catalogues: {
    'en': I18n(const {
      'nav.dishes': 'Dishes',
      'nav.homemade': 'Homemade',
      'nav.ingredients': 'Ingredients',
      'nav.about': 'About',
      'nav.searchPlaceholder': 'Search dishes',
      'common.search': 'Search',
      'theme.label': 'Theme',
      'footer.browse': 'Browse',
      'footer.rights': '© {year}',
    }),
    'vi': I18n(const {}),
  });
}

void main() {
  testWidgets('phone width shows brand and all four links', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(buildApp());
    await tester.pump();

    expect(find.text('What dish to cook today?'), findsWidgets);
    expect(find.text('Dishes'), findsWidgets);
    expect(find.text('Homemade'), findsWidgets);
    expect(find.text('Ingredients'), findsWidgets);
    expect(find.text('About'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('desktop width keeps the same links and the search field', (tester) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(buildApp());
    await tester.pump();

    expect(find.text('What dish to cook today?'), findsWidgets);
    expect(find.text('Dishes'), findsWidgets);
    expect(find.text('Home'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('waits for catalogues before the first screen', (tester) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;
    final completer = Completer<Map<String, I18n>>();
    await tester.pumpWidget(BoardApp(catalogueLoader: () => completer.future));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    completer.complete({
      'en': I18n(const {'nav.dishes': 'Dishes'}),
      'vi': I18n(const {}),
    });
    await tester.pumpAndSettle();

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Dishes'), findsWidgets);
  });
}