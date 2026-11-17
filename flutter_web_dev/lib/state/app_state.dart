import 'package:flutter/widgets.dart';

import '../api/api_client.dart';
import '../i18n/i18n.dart';
import '../storages/app_storage.dart';

///A chosen ingredient; the API model converts into this so the state layer
///does not depend on the network models.
class BasketItem {
  const BasketItem({required this.id, required this.name, this.nameVi = ''});

  final String id;
  final String name;
  final String nameVi;

  String label(String locale) => I18n.label(nameVi, name, locale);
}

class AppState extends ChangeNotifier {
  AppState({
    Map<String, I18n>? catalogues,
    String locale = 'en',
    bool isLight = false,
    ApiClient? api,
  })  : catalogues = catalogues ?? <String, I18n>{},
        _api = api,
        _locale = locale,
        _isLight = isLight;

  final Map<String, I18n> catalogues;
  ApiClient? _api;

  ApiClient get api => _api ??= ApiClient(AppStorage.serverUrl);
  final List<BasketItem> _basket = <BasketItem>[];

  String _locale;
  bool _isLight;
  String _view = 'list';

  String get locale => _locale;
  bool get isLight => _isLight;
  String get view => _view;

  void setView(String value) {
    if (value == _view) {
      return;
    }
    _view = value;
    notifyListeners();
  }
  List<BasketItem> get basket => List.unmodifiable(_basket);

  I18n get i18n => catalogues[_locale] ?? catalogues['en'] ?? I18n(const {});

  String t(String key, [Map<String, String>? params]) => i18n.t(key, params);

  void setLocale(String value) {
    if (value == _locale) {
      return;
    }
    _locale = value;
    notifyListeners();
  }

  void applyCatalogues(Map<String, I18n> loaded) {
    catalogues.addAll(loaded);
    notifyListeners();
  }

  void toggleTheme() {
    _isLight = !_isLight;
    notifyListeners();
  }

  bool isChosen(String id) => _basket.any((item) => item.id == id);

  void toggleIngredient(BasketItem item) {
    final index = _basket.indexWhere((entry) => entry.id == item.id);
    if (index >= 0) {
      _basket.removeAt(index);
    } else {
      _basket.add(item);
    }
    notifyListeners();
  }

  void removeIngredient(String id) {
    _basket.removeWhere((entry) => entry.id == id);
    notifyListeners();
  }

  void clearBasket() {
    _basket.clear();
    notifyListeners();
  }
}

///Hands the single state object to every screen without a package.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope is missing above this widget');
    return scope!.notifier!;
  }
}
