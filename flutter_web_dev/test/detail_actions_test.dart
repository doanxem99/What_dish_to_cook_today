//Comment and vote controls appear only for a signed-in cook.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/screens/dish_detail_screen.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';

const _catalogue = {
  'dish.ingredients': 'Ingredients',
  'dish.commentsTitle': 'Comments',
  'dish.commentPlaceholder': 'Write a comment',
  'dish.commentSubmit': 'Post comment',
  'dish.commentEmpty': 'No comments yet.',
  'dish.commentSignIn': 'Sign in to comment.',
  'dish.commentDeleteConfirm': 'Delete this comment?',
  'dish.vote': 'Vote',
  'dish.voted': 'Voted',
  'dish.notFound': 'Dish not found',
  'common.loading': 'Loading',
  'common.errorBody': 'Something went wrong.',
  'common.retry': 'Retry',
  'common.emptyTitle': 'Nothing yet',
  'common.delete': 'Delete',
  'nav.signIn': 'Sign in',
  'nav.signUp': 'Sign up',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.searchPlaceholder': 'Search',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
};

http.Response _ok(Object body) {
  return http.Response(json.encode(body), 200,
      headers: {'content-type': 'application/json; charset=utf-8'});
}

ApiClient _api({List<String>? calls, bool signedIn = false, bool withComment = false, bool failComment = false}) {
  var comments = <Map<String, dynamic>>[
    if (withComment) {'id': 'c1', 'username': 'demo', 'body': 'Lovely broth', 'is_mine': true}
  ];
  var votes = 5;
  var voted = false;
  return ApiClient('http://test', client: MockClient((request) async {
    calls?.add('${request.method} ${request.url.path}');
    final path = request.url.path;
    if (path == '/api/auth/me') {
      return signedIn
          ? _ok({'user': {'id': 'u1', 'username': 'demo'}})
          : http.Response(json.encode({'message': 'Unauthorized'}), 401,
              headers: {'content-type': 'application/json; charset=utf-8'});
    }
    if (path.startsWith('/api/dish/profile/get_dish_post/')) {
      return _ok({
        'status': 0,
        'data': {
          '_id': 'p1',
          'dish_id': 'd1',
          'name': 'Beef noodle soup',
          'short_detail': 'Broth',
          'profile_image': '',
          'points': 5,
          'ingredients': [],
          'display_blocks': []
        }
      });
    }
    if (path.startsWith('/api/dish/profile/comments/')) {
      return _ok({'isSuccess': true, 'data': comments});
    }
    if (path.startsWith('/api/dish/profile/comment/')) {
      if (request.method == 'DELETE') {
        comments = [];
        return _ok({'status': 0});
      }
      if (failComment) {
        return http.Response(json.encode({'message': 'boom'}), 500,
            headers: {'content-type': 'application/json; charset=utf-8'});
      }
      comments = [
        {'id': 'c1', 'username': 'demo', 'body': 'Lovely broth', 'is_mine': true}
      ];
      return _ok({
        'status': 0,
        'data': {'id': 'c1', 'username': 'demo', 'body': 'Lovely broth', 'is_mine': true}
      });
    }
    if (path.startsWith('/api/dish/profile/vote/')) {
      voted = !voted;
      votes += voted ? 1 : -1;
      return _ok({
        'status': 0,
        'data': {'voted': voted, 'points': votes}
      });
    }
    return _ok({'isSuccess': true, 'data': []});
  }));
}

Future<void> _pump(WidgetTester tester, AppState state) async {
  await tester.pumpWidget(AppScope(
    state: state,
    child: MaterialApp(
      theme: boardTheme(BoardTokens.dark),
      initialRoute: '/dish',
      onGenerateRoute: (settings) => MaterialPageRoute(
        builder: (_) => settings.name == '/signin'
            ? const Scaffold(body: Text('signin-route'))
            : const DishDetailScreen(postId: 'p1'),
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

AppState _state(ApiClient api) {
  return AppState(
    catalogues: {'en': I18n(_catalogue), 'vi': I18n(const {})},
    api: api,
  );
}

void main() {
  testWidgets('guests see the sign-in prompt and no compose box', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    final state = _state(_api());
    await state.refreshAccount();
    await _pump(tester, state);

    expect(find.text('Sign in to comment.'), findsOneWidget);
    expect(find.byKey(const ValueKey('comment-body')), findsNothing);
    expect(find.byKey(const ValueKey('vote-button')), findsOneWidget);
  });

  testWidgets('a signed-in comment is posted and the list reloads', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    final state = _state(_api(calls: calls, signedIn: true));
    await state.refreshAccount();
    await _pump(tester, state);

    await tester.ensureVisible(find.byKey(const ValueKey('comment-body')));
    await tester.enterText(find.byKey(const ValueKey('comment-body')), 'Lovely broth');
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('comment-submit')));
    await tester.tap(find.byKey(const ValueKey('comment-submit')));
    await tester.pumpAndSettle();

    expect(calls, contains('POST /api/dish/profile/comment/p1'));
    expect(find.text('Lovely broth'), findsOneWidget);
  });

  testWidgets('a vote toggles and shows the new count', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    final state = _state(_api(calls: calls, signedIn: true));
    await state.refreshAccount();
    await _pump(tester, state);

    expect(find.text('5'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('vote-button')));
    await tester.pumpAndSettle();

    expect(calls, contains('POST /api/dish/profile/vote/p1'));
    expect(find.text('6'), findsOneWidget);
    expect(find.text('Voted'), findsOneWidget);
  });
  testWidgets('an own comment can be deleted after confirming', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    final calls = <String>[];
    final state = _state(_api(calls: calls, signedIn: true, withComment: true));
    await state.refreshAccount();
    await _pump(tester, state);

    expect(find.text('Lovely broth'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const ValueKey('comment-delete-c1')));
    await tester.tap(find.byKey(const ValueKey('comment-delete-c1')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete').last);
    await tester.pumpAndSettle();

    expect(calls, contains('DELETE /api/dish/profile/comment/c1'));
    expect(find.text('Lovely broth'), findsNothing);
  });

  testWidgets('a second vote toggles the vote off', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    final state = _state(_api(signedIn: true));
    await state.refreshAccount();
    await _pump(tester, state);

    await tester.tap(find.byKey(const ValueKey('vote-button')));
    await tester.pumpAndSettle();
    expect(find.text('Voted'), findsOneWidget);
    expect(find.text('6'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('vote-button')));
    await tester.pumpAndSettle();
    expect(find.text('Vote'), findsWidgets);
    expect(find.text('5'), findsOneWidget);
  });

  testWidgets('a guest vote sends the guest to sign-in', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    final state = _state(_api());
    await state.refreshAccount();
    await _pump(tester, state);

    await tester.tap(find.byKey(const ValueKey('vote-button')));
    await tester.pumpAndSettle();

    expect(find.text('signin-route'), findsOneWidget);
  });

  testWidgets('a rejected comment shows the error text and keeps the draft', (tester) async {
    tester.view.physicalSize = const Size(1200, 1000);
    tester.view.devicePixelRatio = 1;
    final state = _state(_api(signedIn: true, failComment: true));
    await state.refreshAccount();
    await _pump(tester, state);

    await tester.ensureVisible(find.byKey(const ValueKey('comment-body')));
    await tester.enterText(find.byKey(const ValueKey('comment-body')), 'Lovely broth');
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('comment-submit')));
    await tester.tap(find.byKey(const ValueKey('comment-submit')));
    await tester.pumpAndSettle();

    expect(find.text('Something went wrong.'), findsOneWidget);
  });
}