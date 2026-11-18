import 'package:flutter_test/flutter_test.dart';
import 'package:what_dish_to_cook_today/state/app_state.dart';

void main() {
  test('the basket survives a new state instance', () {
    final first = AppState();
    first.clearBasket();
    first.toggleIngredient(const BasketItem(id: 'i1', name: 'Fish', nameVi: 'Cá'));

    final restored = AppState();

    expect(restored.basket.map((item) => item.id), ['i1']);
    expect(restored.basket.first.label('vi'), 'Cá');
    restored.clearBasket();
  });
}
