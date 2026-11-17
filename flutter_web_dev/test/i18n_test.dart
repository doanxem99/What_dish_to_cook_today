//The shared catalogues are nested JSON; the client asks for dot keys.
import 'package:flutter_test/flutter_test.dart';
import 'package:what_dish_to_cook_today/i18n/i18n.dart';

void main() {
  test('flattens nested catalogues to dot keys', () {
    final map = I18n.flatten({
      'dishes': {'title': 'Dishes'},
      'common': {'appName': 'What dish to cook today?'}
    });

    expect(map['dishes.title'], 'Dishes');
    expect(map['common.appName'], 'What dish to cook today?');
  });

  test('interpolates named parameters', () {
    final i18n = I18n({'home.ready': '{n} ingredients ready'});

    expect(i18n.t('home.ready', {'n': '3'}), '3 ingredients ready');
  });

  test('returns the key when a translation is missing', () {
    expect(I18n({}).t('nav.about'), 'nav.about');
  });

  test('reads both language fields with a fallback', () {
    expect(I18n.label('Phở bò', 'Beef noodle soup', 'vi'), 'Phở bò');
    expect(I18n.label('', 'Beef noodle soup', 'vi'), 'Beef noodle soup');
  });
}
