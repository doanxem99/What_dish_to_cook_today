import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/screens/dish_editor_screen.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';

const _catalogue = {
  'edit.createTitle': 'Add a dish',
  'edit.titleEditDish': 'Edit dish',
  'edit.autoTranslate': 'Translate automatically',
  'edit.nameEn': 'Name (English)',
  'edit.nameVi': 'Name (Vietnamese)',
  'edit.shortEn': 'Short (English)',
  'edit.shortVi': 'Short (Vietnamese)',
  'edit.ingredients': 'Ingredients',
  'edit.image': 'Cover',
  'edit.extraImages': 'More images',
  'edit.blocks': 'Detail blocks',
  'edit.dropCover': 'Choose an image',
  'edit.addText': 'Add text block',
  'edit.addImage': 'Add image block',
  'edit.createAction': 'Create',
  'edit.save': 'Save',
  'edit.newDish': 'New dish',
  'edit.translateFailed': 'Translation unavailable',
  'home.pickerPlaceholder': 'Search ingredients',
  'auth.invalid': 'Check the fields and try again.',
  'common.loading': 'Loading',
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

ApiClient _api({bool guest = false, List<String>? calls}) {
  return ApiClient('http://test', client: MockClient((request) async {
    calls?.add('${request.method} ${request.url.path}');
    final path = request.url.path;
    if (path == '/api/auth/me') {
      return guest
          ? http.Response(json.encode({'message': 'Unauthorized'}), 401,
              headers: {'content-type': 'application/json; charset=utf-8'})
          : _ok({
              'user': {'id': 'u1', 'username': 'demo'}
            });
    }
    if (path == '/api/ingredient/selection/') {
      return _ok({'isSuccess': true, 'data': []});
    }
    if (path == '/api/dish/profile/create_dish') {
      return _ok({'status': 0, 'dish_id': 'd-new'});
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
      initialRoute: '/dish-edit',
      onGenerateRoute: (settings) => MaterialPageRoute(
        builder: (_) {
          if (settings.name == '/dish-edit') {
            return const DishEditorScreen();
          }
          return Scaffold(body: Text('${settings.name}-route'));
        },
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a guest is sent to sign-in with a return route', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    await _pump(tester, _api(guest: true));

    expect(find.text('/signin-route'), findsOneWidget);
  });

  testWidgets('a dish with no name in either language cannot be saved', (tester) async {
    tester.view.physicalSize = const Size(1200, 1200);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    await _pump(tester, _api(calls: calls));

    await tester.ensureVisible(find.byKey(const ValueKey('dish-save')));
    await tester.tap(find.byKey(const ValueKey('dish-save')));
    await tester.pumpAndSettle();

    expect(find.text('Check the fields and try again.'), findsOneWidget);
    expect(calls.where((call) => call.contains('create_dish')), isEmpty);
  });

  testWidgets('creating posts the documented payload and opens the dish', (tester) async {
    tester.view.physicalSize = const Size(1200, 1400);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    await _pump(tester, _api(calls: calls));

    await tester.enterText(find.byType(TextField).at(1), 'Ginger chicken');
    await tester.enterText(find.byType(TextField).at(2), 'Gà gừng');
    await tester.ensureVisible(find.byKey(const ValueKey('dish-save')));
    await tester.tap(find.byKey(const ValueKey('dish-save')));
    await tester.pumpAndSettle();

    expect(calls, contains('POST /api/dish/profile/create_dish'));
    expect(find.text('/dish-route'), findsOneWidget);
  });
}
