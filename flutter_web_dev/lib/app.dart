import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'i18n/i18n.dart';
import 'screens/about_screen.dart';
import 'screens/dish_detail_screen.dart';
import 'screens/dishes_screen.dart';
import 'screens/home_screen.dart';
import 'screens/homemade_screen.dart';
import 'screens/ingredient_detail_screen.dart';
import 'screens/ingredients_screen.dart';
import 'state/app_state.dart';
import 'storages/app_storage.dart';
import 'theme/app_theme.dart';
import 'theme/tokens.dart';

///Loads the shared catalogues once, then renders the board.
class BoardApp extends StatefulWidget {
  const BoardApp({super.key, this.catalogues, this.api, this.catalogueLoader});

  final Map<String, I18n>? catalogues;
  final ApiClient? api;
  final Future<Map<String, I18n>> Function()? catalogueLoader;

  @override
  State<BoardApp> createState() => _BoardAppState();
}

class _BoardAppState extends State<BoardApp> {
  late final AppState _state;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _state = AppState(catalogues: widget.catalogues, api: widget.api);
    if (widget.catalogues == null) {
      _loading = true;
      _loadCatalogues();
    }
  }

  Future<void> _loadCatalogues() async {
    final loaded = widget.catalogueLoader != null
        ? await widget.catalogueLoader!()
        : await _loadFromServer();
    if (!mounted) {
      return;
    }
    _state.applyCatalogues(loaded);
    setState(() => _loading = false);
  }

  Future<Map<String, I18n>> _loadFromServer() async {
    final loaded = <String, I18n>{};
    for (final locale in ['en', 'vi']) {
      try {
        loaded[locale] = await I18n.load(AppStorage.serverUrl, locale);
      } catch (_) {
        //A missing catalogue must not take the shell down; keys stay readable.
        loaded[locale] = I18n(const {});
      }
    }
    return loaded;
  }

  @override
  Widget build(BuildContext context) {
    final theme = boardTheme(BoardTokens.of(_state.isLight));
    return AppScope(
      state: _state,
      child: ListenableBuilder(
        listenable: _state,
        builder: (context, _) {
          if (_loading) {
            //A separate key gives the ready tree its own Navigator, so the
            //initial route is generated after the catalogues exist.
            return MaterialApp(
              key: const ValueKey('loading'),
              debugShowCheckedModeBanner: false,
              theme: theme,
              home: Scaffold(
                backgroundColor: BoardTokens.of(_state.isLight).bg,
                body: const Center(child: CircularProgressIndicator()),
              ),
            );
          }
          return MaterialApp(
            key: const ValueKey('ready'),
            title: 'What dish to cook today?',
            debugShowCheckedModeBanner: false,
            theme: theme,
            scrollBehavior: const _BoardScrollBehavior(),
            initialRoute: '/',
            onGenerateRoute: _generateRoute,
          );
        },
      ),
    );
  }

  Route<dynamic> _generateRoute(RouteSettings settings) {
    final uri = Uri.parse(settings.name ?? '/');
    final arguments = settings.arguments is Map
        ? Map<String, dynamic>.from(settings.arguments as Map)
        : <String, dynamic>{};

    String pick(List<String> names) {
      for (final name in names) {
        final fromUri = uri.queryParameters[name];
        if (fromUri != null && fromUri.isNotEmpty) {
          return fromUri;
        }
        final fromArguments = arguments[name];
        if (fromArguments != null && fromArguments.toString().isNotEmpty) {
          return fromArguments.toString();
        }
      }
      return '';
    }

    final query = pick(['q']);
    final id = pick(['id', 'dish_id', 'ingredient_id']);
    final postId = pick(['post_id', 'dish_post_id']);

    final Widget page;
    switch (uri.path) {
      case '/dishes':
        page = DishesScreen(query: query);
        break;
      case '/dish':
        page = DishDetailScreen(dishId: id, postId: postId);
        break;
      case '/ingredients':
        page = IngredientsScreen(query: query);
        break;
      case '/ingredient':
        page = IngredientDetailScreen(ingredientId: id);
        break;
      case '/homemade':
        page = const HomemadeScreen();
        break;
      case '/about':
        page = const AboutScreen();
        break;
      default:
        page = const HomeScreen();
    }

    return MaterialPageRoute(builder: (_) => page, settings: settings);
  }
}

///Mouse dragging also scrolls the board on desktop web.
class _BoardScrollBehavior extends MaterialScrollBehavior {
  const _BoardScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
      };
}
