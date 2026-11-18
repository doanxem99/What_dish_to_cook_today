import 'dart:convert';

import 'package:flutter/widgets.dart';

import '../api/api_client.dart';
import '../api/models.dart';
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

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'name_vi': nameVi};

  factory BasketItem.fromJson(Map<String, dynamic> json) => BasketItem(
        id: '${json['id'] ?? ''}',
        name: '${json['name'] ?? ''}',
        nameVi: '${json['name_vi'] ?? ''}',
      );
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
        _isLight = isLight {
    _restoreBasket();
    final savedView = AppStorage.read('dishes-view');
    if (savedView == 'grid' || savedView == 'list') {
      _view = savedView!;
    }
  }

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

  I18n get i18n {
    final current = catalogues[_locale];
    if (current != null && current.messages.isNotEmpty) {
      return current;
    }
    final other = catalogues[_locale == 'vi' ? 'en' : 'vi'];
    if (other != null && other.messages.isNotEmpty) {
      return other;
    }
    return I18n(const {});
  }

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

  Account? _account;
  bool _loadingAccount = false;
  int _accountRequest = 0;

  Account? get account => _account;
  bool get isSignedIn => _account != null;
  bool get loadingAccount => _loadingAccount;

  ///A missing or expired cookie means guest; it must never block browsing.
  Future<void> refreshAccount() async {
    final request = ++_accountRequest;
    _loadingAccount = true;
    notifyListeners();
    Account? loaded;
    try {
      final payload = await api.getJson('/api/auth/me');
      final user = payload is Map ? payload['user'] : null;
      loaded = user is Map ? Account.fromJson(user) : null;
    } catch (_) {
      loaded = null;
    }
    //A slower request that started before a sign-in must not clear the session.
    if (request == _accountRequest) {
      _account = loaded;
    }
    _loadingAccount = false;
    notifyListeners();
  }

  Future<String?> signIn(String username, String password) async {
    try {
      await api.postJson('/api/auth/signin', {'username': username, 'password': password});
    } on ApiException {
      //Server messages are English only; the catalogue owns user-facing copy.
      return t('auth.failed');
    } catch (_) {
      return t('auth.failed');
    }
    await refreshAccount();
    return _account == null ? t('auth.failed') : null;
  }

  Future<String?> signUp(String username, String email, String password) async {
    try {
      await api.postJson('/api/auth/signup', {
        'username': username,
        'email': email,
        'password': password,
      });
    } on ApiException {
      //Server messages are English only; the catalogue owns user-facing copy.
      return t('auth.failed');
    } catch (_) {
      return t('auth.failed');
    }
    return signIn(username, password);
  }

  Future<void> signOut() async {
    try {
      await api.postJson('/api/auth/signout', const {});
    } catch (_) {
      //Even if the server is unreachable, drop the local session.
    }
    _accountRequest += 1;
    _account = null;
    notifyListeners();
  }

  bool isChosen(String id) => _basket.any((item) => item.id == id);

  void _restoreBasket() {
    final raw = AppStorage.read(AppStorage.basketKey);
    if (raw == null || raw.isEmpty) {
      return;
    }
    try {
      final rows = json.decode(raw);
      if (rows is List) {
        _basket.addAll(rows.whereType<Map>().map((row) => BasketItem.fromJson(Map<String, dynamic>.from(row))));
      }
    } catch (_) {
      //A corrupt basket is dropped rather than blocking the app.
    }
  }

  void _persistBasket() {
    AppStorage.write(AppStorage.basketKey, json.encode(_basket.map((item) => item.toJson()).toList()));
  }

  void toggleIngredient(BasketItem item) {
    final index = _basket.indexWhere((entry) => entry.id == item.id);
    if (index >= 0) {
      _basket.removeAt(index);
    } else {
      _basket.add(item);
    }
    _persistBasket();
    notifyListeners();
  }

  void removeIngredient(String id) {
    _basket.removeWhere((entry) => entry.id == id);
    _persistBasket();
    notifyListeners();
  }

  void clearBasket() {
    _basket.clear();
    _persistBasket();
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
