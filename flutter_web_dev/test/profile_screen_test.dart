import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/screens/profile_screen.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';
import 'package:what_dish_to_cook_today/widgets/board_card.dart';

const _catalogue = {
  'profile.title': 'Profile',
  'profile.joined': 'Joined {date}',
  'profile.myDishes': 'My dishes',
  'profile.myIngredients': 'My ingredients',
  'profile.noPosts': 'You have not written anything yet.',
  'profile.best': 'Best',
  'nav.signOut': 'Sign out',
  'nav.signIn': 'Sign in',
  'nav.signUp': 'Sign up',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.searchPlaceholder': 'Search',
  'common.loading': 'Loading',
  'common.errorBody': 'Something went wrong.',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
};

http.Response _ok(Object body) {
  return http.Response(json.encode(body), 200,
      headers: {'content-type': 'application/json; charset=utf-8'});
}

ApiClient _api() {
  return ApiClient('http://test', client: MockClient((request) async {
    final path = request.url.path;
    if (path == '/api/auth/me') {
      return _ok({
        'user': {'id': 'u1', 'username': 'demo', 'email': 'demo@example.com', 'created_at': '2024-05-01T00:00:00.000Z'}
      });
    }
    if (path == '/api/dish/profile/mine') {
      return _ok({
        'isSuccess': true,
        'data': [
          {'id': 'd1', 'name': 'Beef noodle soup', 'name_vi': 'Phở bò', 'is_best_post': true}
        ]
      });
    }
    if (path == '/api/ingredient/profile/mine') {
      return _ok({
        'isSuccess': true,
        'data': [
          {'id': 'i1', 'name': 'Ginger', 'name_vi': 'Gừng', 'is_best_post': false}
        ]
      });
    }
    return _ok({'isSuccess': true, 'data': []});
  }));
}

void main() {
  testWidgets('profile lists the account, dishes and ingredients, then signs out', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    final state = AppState(
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})},
      api: _api(),
    );
    await state.refreshAccount();

    await tester.pumpWidget(AppScope(
      state: state,
      child: MaterialApp(
        theme: boardTheme(BoardTokens.dark),
        initialRoute: '/profile',
        onGenerateRoute: (settings) => MaterialPageRoute(
          builder: (_) {
            if (settings.name == '/') {
              return const Scaffold(body: Text('home-route'));
            }
            if (settings.name == '/profile') {
              return const ProfileScreen();
            }
            return const Scaffold(body: Text('signin-route'));
          },
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('demo'), findsWidgets);
    expect(find.textContaining('2024'), findsOneWidget);
    expect(find.text('Beef noodle soup'), findsOneWidget);
    expect(find.text('Best'), findsOneWidget);
    expect(find.text('Ginger'), findsOneWidget);

    await tester.tap(find.widgetWithText(BoardButton, 'Sign out'));
    await tester.pumpAndSettle();

    expect(find.text('home-route'), findsOneWidget);
  });
}
