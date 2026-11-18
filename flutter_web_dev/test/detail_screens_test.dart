//Detail and list screens must survive missing photos and one-language blocks.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';
import 'package:what_dish_to_cook_today/screens/dish_detail_screen.dart';
import 'package:what_dish_to_cook_today/screens/homemade_screen.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';
import 'package:what_dish_to_cook_today/theme/app_theme.dart';
import 'package:what_dish_to_cook_today/theme/tokens.dart';

const _catalogue = {
  'dish.ingredients': 'Ingredients',
  'dish.commentsTitle': 'Comments',
  'dish.notFound': 'Dish not found',
  'common.loading': 'Loading',
  'common.errorBody': 'Something went wrong.',
  'common.retry': 'Retry',
  'common.emptyTitle': 'Nothing yet',
  'homemade.title': 'Homemade',
  'homemade.subtitle': 'Dishes people cooked at home.',
  'homemade.empty': 'Nothing homemade yet.',
  'nav.dishes': 'Dishes',
  'nav.homemade': 'Homemade',
  'nav.ingredients': 'Ingredients',
  'nav.about': 'About',
  'nav.searchPlaceholder': 'Search',
  'footer.browse': 'Browse',
  'footer.rights': '{year}',
};

ApiClient _api({bool emptyHomemade = false}) {
  return ApiClient('http://test', client: MockClient((request) async {
    final path = request.url.path;
    http.Response ok(Object body) => http.Response(json.encode(body), 200,
        headers: {'content-type': 'application/json; charset=utf-8'});

    if (path.startsWith('/api/dish/profile/get_dish/')) {
      return ok({
        'status': 0,
        'data': {'best_post_id': null, 'name': 'Stale dish'}
      });
    }
    if (path.startsWith('/api/dish/profile/get_dish_post/')) {
      return ok({
        'status': 0,
        'data': {
          '_id': 'p1',
          'dish_id': 'd1',
          'name': 'Beef noodle soup',
          'short_detail': 'Broth',
          'profile_image': '',
          'ingredients': [],
          'display_blocks': [
            {'type': 'text', 'text': 'Simmer the bones', 'text_vi': 'Nấu xương', 'font_size': 16}
          ]
        }
      });
    }
    if (path.startsWith('/api/dish/profile/comments/')) {
      return ok({'isSuccess': true, 'data': []});
    }
    if (path.startsWith('/api/dish/selection/homemade')) {
      return ok({
        'isSuccess': true,
        'data': emptyHomemade
            ? []
            : [
                {'id': 'd2', 'name': 'Fish soup', 'name_vi': 'Canh cá', 'short_detail': '', 'profile_image': ''}
              ]
      });
    }
    return ok({'isSuccess': true, 'data': []});
  }));
}

Widget _wrap(AppState state, Widget home) {
  return AppScope(
    state: state,
    child: MaterialApp(
      theme: boardTheme(BoardTokens.of(state.isLight)),
      home: home,
    ),
  );
}

AppState _state(ApiClient api) {
  return AppState(
    catalogues: {'en': I18n(_catalogue), 'vi': I18n(_catalogue)},
    locale: 'vi',
    api: api,
  );
}

void main() {
  testWidgets('dish detail uses the Vietnamese block when English is filled too', (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_wrap(_state(_api()), const DishDetailScreen(postId: 'p1')));
    await tester.pumpAndSettle();

    expect(find.text('Nấu xương'), findsOneWidget);
    expect(find.text('Simmer the bones'), findsNothing);
  });

  testWidgets('dish id without a best post shows not found', (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_wrap(_state(_api()), const DishDetailScreen(dishId: 'd-stale')));
    await tester.pumpAndSettle();

    expect(find.text('Dish not found'), findsOneWidget);
  });

  testWidgets('homemade row without a photo shows the placeholder', (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_wrap(_state(_api()), const HomemadeScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Canh cá'), findsOneWidget);
    expect(find.byWidgetPredicate((widget) => widget is Image && widget.image is AssetImage && (widget.image as AssetImage).assetName.contains('defaults')), findsWidgets);
  });

  testWidgets('empty homemade answer shows its own copy', (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(_wrap(_state(_api(emptyHomemade: true)), const HomemadeScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Nothing homemade yet.'), findsOneWidget);
  });
}
