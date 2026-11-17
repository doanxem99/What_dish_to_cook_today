import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/screens/ingredient_editor_screen.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';

const _catalogue = {
  'edit.createIngredientTitle': 'Add an ingredient',
  'edit.titleEditIngredient': 'Edit ingredient',
  'edit.nameEn': 'Name (English)',
  'edit.nameVi': 'Name (Vietnamese)',
  'edit.type': 'Type',
  'edit.shortEn': 'Short (English)',
  'edit.shortVi': 'Short (Vietnamese)',
  'edit.image': 'Image',
  'edit.blocks': 'Detail blocks',
  'edit.dropCover': 'Choose an image',
  'edit.addText': 'Add text block',
  'edit.addImage': 'Add image block',
  'edit.createAction': 'Create',
  'ingredients.food': 'Food',
  'ingredients.spice': 'Spice',
  'ingredients.fruit': 'Fruit',
  'ingredients.other': 'Other',
  'auth.invalid': 'Check the fields and try again.',
  'common.loading': 'Loading',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.errorBody': 'Something went wrong.',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.signIn': 'Sign in',
  'nav.searchPlaceholder': 'Search',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
};

http.Response _ok(Object body) {
  return http.Response(json.encode(body), 200,
      headers: {'content-type': 'application/json; charset=utf-8'});
}

ApiClient _api({bool guest = false, List<String>? calls, List<Map<String, dynamic>>? bodies}) {
  return ApiClient('http://test', client: MockClient((request) async {
    calls?.add('${request.method} ${request.url.path}');
    if (request.url.path == '/api/auth/me') {
      return guest
          ? http.Response(json.encode({'message': 'Unauthorized'}), 401,
              headers: {'content-type': 'application/json; charset=utf-8'})
          : _ok({
              'user': {'id': 'u1', 'username': 'demo'}
            });
    }
    if (request.url.path == '/api/ingredient/profile/create_ingredient') {
      bodies?.add(json.decode(request.body) as Map<String, dynamic>);
      return _ok({'status': 0, 'ingredient_id': 'i-new'});
    }
    return _ok({'isSuccess': true, 'data': []});
  }));
}

Future<void> _pump(WidgetTester tester, ApiClient api) async {
  final state = AppState(
    catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})},
    api: api,
  );
  await tester.pumpWidget(AppScope(
    state: state,
    child: MaterialApp(
      theme: boardTheme(BoardTokens.dark),
      initialRoute: '/ingredient-edit',
      onGenerateRoute: (settings) => MaterialPageRoute(
        builder: (_) {
          if (settings.name == '/ingredient-edit') {
            return const IngredientEditorScreen();
          }
          return Scaffold(body: Text('${settings.name}-route'));
        },
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a guest is sent to sign-in', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    await _pump(tester, _api(guest: true));

    expect(find.text('/signin-route'), findsOneWidget);
  });

  testWidgets('creating posts name, type and blocks', (tester) async {
    tester.view.physicalSize = const Size(1200, 1400);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    final bodies = <Map<String, dynamic>>[];
    await _pump(tester, _api(calls: calls, bodies: bodies));

    await tester.enterText(find.byKey(const ValueKey('ing-name')), 'Ginger');
    await tester.enterText(find.byKey(const ValueKey('ing-name-vi')), 'Gừng');
    await tester.ensureVisible(find.byKey(const ValueKey('ingredient-save')));
    await tester.tap(find.byKey(const ValueKey('ingredient-save')));
    await tester.pumpAndSettle();

    expect(calls, contains('POST /api/ingredient/profile/create_ingredient'));
    expect(bodies, hasLength(1));
    expect(bodies.first['name'], 'Ginger');
    expect(bodies.first['name_vi'], 'Gừng');
    expect(bodies.first['type'], 'Other');
    expect(bodies.first['display_blocks'], isEmpty);
    expect(find.text('/ingredient-route'), findsOneWidget);
  });

  testWidgets('an empty name cannot be saved', (tester) async {
    tester.view.physicalSize = const Size(1200, 1200);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    final bodies = <Map<String, dynamic>>[];
    await _pump(tester, _api(calls: calls, bodies: bodies));

    await tester.ensureVisible(find.byKey(const ValueKey('ingredient-save')));
    await tester.tap(find.byKey(const ValueKey('ingredient-save')));
    await tester.pumpAndSettle();

    expect(find.text('Check the fields and try again.'), findsOneWidget);
    expect(calls.where((call) => call.contains('create_ingredient')), isEmpty);
  });
}
