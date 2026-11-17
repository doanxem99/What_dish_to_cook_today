import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:what_dish_to_cook_today/api/api_client.dart';
import 'package:what_dish_to_cook_today/api/models.dart';

void main() {
  test('unwraps the data envelope and keeps bare lists', () async {
    final client = ApiClient('http://localhost:3000', client: MockClient((request) async {
      if (request.url.path.endsWith('/envelope')) {
        return http.Response('{"isSuccess":true,"data":[{"id":"1"}]}', 200);
      }
      return http.Response('[{"id":"2"}]', 200);
    }));

    expect((await client.getJson('/envelope') as List).length, 1);
    expect((await client.getJson('/bare') as List).length, 1);
  });

  test('ingredient falls back to English when Vietnamese is empty', () {
    final ingredient = IngredientRef.fromJson({
      'id': 'i1',
      'name': 'Fish',
      'name_vi': '',
      'type': 'Food',
      'profile_image': 'public/gallery/ingredients/1/1/0.png'
    });

    expect(ingredient.label('vi'), 'Fish');
    expect(ingredient.type, 'Food');
    expect(ingredient.image, 'public/gallery/ingredients/1/1/0.png');
  });

  test('dish preview reads match counts and ingredient names', () {
    final preview = DishPreview.fromJson({
      'id': 'd1',
      'name': 'Beef noodle soup',
      'name_vi': 'Phở bò',
      'short_detail': 'Broth',
      'short_detail_vi': 'Nước dùng',
      'profile_image': null,
      'match_count': 2,
      'total_ingredients': 7,
      'ingredients_detail': [
        {'id': 'i1', 'name': 'Beef', 'name_vi': 'Thịt bò'},
        {'id': 'i2', 'name': 'Ginger', 'name_vi': null}
      ]
    });

    expect(preview.label('vi'), 'Phở bò');
    expect(preview.detail('vi'), 'Nước dùng');
    expect(preview.matchCount, 2);
    expect(preview.totalIngredients, 7);
    expect(preview.ingredientLine('vi'), 'Thịt bò · Ginger');
  });

  test('display blocks fall back to the filled language and skip unknown types', () {
    final blocks = DisplayBlock.listFromJson([
      {
        'type': 'text',
        'text': 'Serve hot',
        'text_vi': '',
        'font_size': 18,
        'color': 'red',
        'font_weight': 'bold',
        'font_style': 'italic',
        'text_align': 'center'
      },
      {'type': 'video', 'src': 'x'}
    ]);

    expect(blocks.length, 1);
    expect(blocks.first.label('vi'), 'Serve hot');
    expect(blocks.first.fontSize, 18);
    expect(blocks.first.bold, isTrue);
    expect(blocks.first.align, 'center');
  });

  test('images join the server URL and normalise slashes', () {
    final client = ApiClient('http://localhost:3000/');

    expect(client.imageUrl('public/gallery/a.png'), 'http://localhost:3000/public/gallery/a.png');
    expect(client.imageUrl(''), '');
  });
}
