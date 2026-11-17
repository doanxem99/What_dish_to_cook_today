import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/screens/signin_screen.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';

const _catalogue = {
  'auth.signInTitle': 'Sign in',
  'auth.username': 'Username',
  'auth.password': 'Password',
  'auth.submitSignIn': 'Sign in',
  'auth.invalid': 'Check the fields and try again.',
  'auth.needAccount': 'New here?',
  'nav.signUp': 'Sign up',
  'nav.signIn': 'Sign in',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.searchPlaceholder': 'Search',
  'common.loading': 'Loading',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
};

Widget _app(ApiClient api) {
  final state = AppState(
    catalogues: {'en': I18n(_catalogue), 'vi': I18n(_catalogue)},
    api: api,
  );
  return AppScope(
    state: state,
    child: MaterialApp(theme: boardTheme(BoardTokens.dark), home: const SignInScreen()),
  );
}

void main() {
  testWidgets('empty fields never reach the server', (tester) async {
    var calls = 0;
    final api = ApiClient('http://test', client: MockClient((request) async {
      calls += 1;
      return http.Response('{}', 200, headers: {'content-type': 'application/json; charset=utf-8'});
    }));
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;

    await tester.pumpWidget(_app(api));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('signin-submit')));
    await tester.pump();

    expect(find.text('Check the fields and try again.'), findsOneWidget);
    expect(calls, 0);
  });

  testWidgets('a rejected sign-in shows the server message', (tester) async {
    final api = ApiClient('http://test', client: MockClient((request) async {
      return http.Response(
          json.encode({'message': 'User/email or password is not correct!'}), 401,
          headers: {'content-type': 'application/json; charset=utf-8'});
    }));
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;

    await tester.pumpWidget(_app(api));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('signin-username')), 'demo');
    await tester.enterText(find.byKey(const ValueKey('signin-password')), 'wrong');
    await tester.tap(find.byKey(const ValueKey('signin-submit')));
    await tester.pumpAndSettle();

    expect(find.text('User/email or password is not correct!'), findsOneWidget);
  });

  testWidgets('a sign-in that started at /profile returns there', (tester) async {
    final api = ApiClient('http://test', client: MockClient((request) async {
      if (request.url.path == '/api/auth/me') {
        return http.Response(
            json.encode({
              'user': {'id': 'u1', 'username': 'demo'}
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'});
      }
      return http.Response(json.encode({'message': 'ok'}), 200,
          headers: {'content-type': 'application/json; charset=utf-8'});
    }));
    final state = AppState(
      catalogues: {'en': I18n(_catalogue), 'vi': I18n(_catalogue)},
      api: api,
    );
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;

    await tester.pumpWidget(AppScope(
      state: state,
      child: MaterialApp(
        theme: boardTheme(BoardTokens.dark),
        initialRoute: '/signin',
        onGenerateRoute: (settings) {
          if (settings.name == '/signin') {
            return MaterialPageRoute(
              settings: const RouteSettings(name: '/signin', arguments: {'next': '/profile'}),
              builder: (_) => const SignInScreen(),
            );
          }
          return MaterialPageRoute(
            builder: (_) => Scaffold(body: Text('${settings.name}-route')),
          );
        },
      ),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('signin-username')), 'demo');
    await tester.enterText(find.byKey(const ValueKey('signin-password')), 'pw');
    await tester.tap(find.byKey(const ValueKey('signin-submit')));
    await tester.pumpAndSettle();

    expect(find.text('/profile-route'), findsOneWidget);
  });
}
