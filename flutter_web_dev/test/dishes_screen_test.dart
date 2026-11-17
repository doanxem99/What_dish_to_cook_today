//List and grid read the same selection answer; the phone row stays compact.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/app.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';

const _catalogue = {
  'dishes.title': 'Dishes',
  'dishes.board': 'Your board',
  'dishes.subtitle': 'Everything in the shared catalog.',
  'dishes.noMatches': 'No matches for {q}',
  'dishes.emptyCatalog': 'The catalog is empty.',
  'dishes.view': 'View',
  'dishes.listView': 'List view',
  'dishes.gridView': 'Grid view',
  'common.loading': 'Loading',
  'common.errorTitle': 'Something broke',
  'common.errorBody': 'Try again.',
  'common.retry': 'Retry',
  'common.emptyTitle': 'Nothing yet',
  'home.pickerTitle': 'Your ingredients',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.searchPlaceholder': 'Search',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
};

ApiClient _api() {
  return ApiClient('http://test', client: MockClient((request) async {
    if (request.url.path.startsWith('/api/dish/selection')) {
      return http.Response(
          json.encode({
            'isSuccess': true,
            'data': [
              {
                'id': 'd1',
                'name': 'Beef noodle soup',
                'name_vi': 'Phở bò',
                'short_detail': 'Long-simmered broth with aromatics and herbs.',
                'profile_image': null,
                'match_count': 2,
                'total_ingredients': 2,
                'ingredients_detail': [
                  {'id': 'i1', 'name': 'Beef', 'name_vi': 'Thịt bò'},
                  {'id': 'i2', 'name': 'Ginger', 'name_vi': 'Gừng'}
                ]
              },
              {
                'id': 'd2',
                'name': 'Fish soup',
                'name_vi': 'Canh cá',
                'short_detail': 'Sour soup.',
                'profile_image': null,
                'match_count': 0,
                'total_ingredients': 3,
                'ingredients_detail': [
                  {'id': 'i3', 'name': 'Fish', 'name_vi': 'Cá'}
                ]
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'});
    }
    return http.Response('{"isSuccess":true,"data":[]}', 200,
        headers: {'content-type': 'application/json; charset=utf-8'});
  }));
}

Widget _app() {
  return BoardApp(
    catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})},
    api: _api(),
  );
}

void main() {
  testWidgets('phone list rows stay compact and keep ingredients', (tester) async {
    tester.view.physicalSize = const Size(360, 900);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Dishes').first);
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('row-d1')), findsOneWidget);
    expect(find.text('Beef · Ginger'), findsOneWidget);
    expect(find.text('Long-simmered broth with aromatics and herbs.'), findsNothing);
  });

  testWidgets('grid view shows cards with the description clamped', (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Dishes').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Grid view'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('card-d1')), findsOneWidget);
    expect(find.text('Long-simmered broth with aromatics and herbs.'), findsOneWidget);
    final description = tester.widget<Text>(find.text('Long-simmered broth with aromatics and herbs.'));
    expect(description.maxLines, 2);
    expect(description.overflow, TextOverflow.ellipsis);
  });
}
