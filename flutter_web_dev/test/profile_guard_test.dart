//A guest landing on /profile must be sent to sign-in, not shown a blank page.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/app.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/screens/profile_screen.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';

const _catalogue = {
  'profile.title': 'Profile',
  'home.title': 'What can I cook today?',
  'home.subtitle': 'Start with what you have.',
  'home.pickerTitle': 'Your ingredients',
  'home.find': 'Find dishes',
  'home.dishOfDay': 'Dish of the day',
  'home.howTitle': 'How it works',
  'home.how1': 'Pick',
  'home.how2': 'Compare',
  'home.how3': 'Cook',
  'profile.noPosts': 'Nothing yet.',
  'profile.myDishes': 'My dishes',
  'profile.myIngredients': 'My ingredients',
  'profile.best': 'Best',
  'nav.signIn': 'Sign in',
  'nav.signOut': 'Sign out',
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

ApiClient _guestApi() {
  return ApiClient('http://test', client: MockClient((request) async {
    return http.Response(json.encode({'message': 'Unauthorized'}), 401,
        headers: {'content-type': 'application/json; charset=utf-8'});
  }));
}

ApiClient _memberApi() {
  return ApiClient('http://test', client: MockClient((request) async {
    if (request.url.path == '/api/auth/me') {
      return _ok({
        'user': {'id': 'u1', 'username': 'a-very-long-cook-name-for-header-checking'}
      });
    }
    return _ok({'isSuccess': true, 'data': []});
  }));
}

void main() {
  testWidgets('guest on /profile is redirected to sign in', (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    final state = AppState(
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})},
      api: _guestApi(),
    );

    await tester.pumpWidget(AppScope(
      state: state,
      child: MaterialApp(
        theme: boardTheme(BoardTokens.dark),
        routes: {
          '/signin': (_) => const Scaffold(body: Text('signin-route')),
        },
        home: const ProfileScreen(),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('signin-route'), findsOneWidget);
  });

  testWidgets('signed-in header shows the name on desktop and only an icon on phones', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1200, 900);
    await tester.pumpWidget(BoardApp(
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})},
      api: _memberApi(),
    ));
    await tester.pumpAndSettle();

    expect(find.text('a-very-long-cook-name-for-header-checking'), findsOneWidget);

    tester.view.physicalSize = const Size(320, 700);
    await tester.pumpAndSettle();

    expect(find.text('a-very-long-cook-name-for-header-checking'), findsNothing);
    expect(find.byIcon(Icons.person_outline), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('header sign-out on the profile returns home', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1200, 900);
    await tester.pumpWidget(BoardApp(
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})},
      api: _memberApi(),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('account-entry')));
    await tester.pumpAndSettle();
    expect(find.text('a-very-long-cook-name-for-header-checking'), findsWidgets);

    await tester.tap(find.text('Sign out').first);
    await tester.pumpAndSettle();

    expect(find.text('What can I cook today?'), findsOneWidget);
    expect(find.text('signin-route'), findsNothing);
  });
}