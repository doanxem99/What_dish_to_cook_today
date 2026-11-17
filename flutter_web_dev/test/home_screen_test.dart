//The picker is the product's front door: choose ingredients, then find dishes.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/app.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';

const _catalogue = {
  'home.pickerTitle': 'Your ingredients',
  'home.find': 'Find dishes',
  'home.needOne': 'Pick at least one ingredient',
  'home.ready': '{n} ingredient ready',
  'home.clear': 'Clear',
  'home.pickerPlaceholder': 'Search ingredients',
  'home.chosenEmpty': 'Nothing chosen yet',
  'home.dishOfDay': 'Dish of the day',
  'home.howTitle': 'How it works',
  'home.title': 'What can I cook today?',
  'home.subtitle': 'Start with what you have.',
  'ingredients.food': 'Food',
  'ingredients.spice': 'Spice',
  'ingredients.fruit': 'Fruit',
  'ingredients.other': 'Other',
  'common.loading': 'Loading',
  'common.emptyTitle': 'Nothing here yet',
  'common.errorBody': 'Something went wrong.',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.searchPlaceholder': 'Search',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
};

ApiClient _client() {
  return ApiClient('http://test', client: MockClient((request) async {
    final path = request.url.path;
    if (path.startsWith('/api/ingredient/search/keyword/')) {
      return http.Response(json.encode([
        {'id': 'i2', 'name': 'Ginger', 'name_vi': 'Gừng', 'type': 'Spice'}
      ]), 200, headers: {'content-type': 'application/json; charset=utf-8'});
    }
    if (path.startsWith('/api/ingredient/selection')) {
      return http.Response(json.encode({
        'isSuccess': true,
        'data': [
          {'id': 'i1', 'name': 'Fish', 'name_vi': 'Cá', 'type': 'Food'},
          {'id': 'i3', 'name': 'Lime', 'name_vi': 'Chanh', 'type': 'Fruit'}
        ]
      }), 200, headers: {'content-type': 'application/json; charset=utf-8'});
    }
    if (path.startsWith('/api/dish/profile/get_best_dish_post')) {
      return http.Response(json.encode({'status': 1, 'data': null}), 200, headers: {'content-type': 'application/json; charset=utf-8'});
    }
    return http.Response('{}', 200, headers: {'content-type': 'application/json; charset=utf-8'});
  }));
}

Widget _app() {
  return BoardApp(
    catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})},
    api: _client(),
  );
}

void main() {
  testWidgets('CTA without a basket asks for one ingredient', (tester) async {
    tester.view.physicalSize = const Size(360, 720);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Find dishes'));
    await tester.tap(find.text('Find dishes'));
    await tester.pump();

    expect(find.text('Pick at least one ingredient'), findsOneWidget);
  });

  testWidgets('tapping an ingredient fills the basket and the ready count', (tester) async {
    tester.view.physicalSize = const Size(360, 720);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('+ Fish'), findsOneWidget);
    await tester.tap(find.text('+ Fish'));
    await tester.pump();

    expect(find.text('1 INGREDIENT READY'), findsOneWidget);
  });
}
