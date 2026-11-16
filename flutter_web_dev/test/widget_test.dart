// Checks that the data classes read the shapes the Express API really sends.
// See server/routes/api/ingredient_search.js and dish_selection.js.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:what_dish_to_cook_today/classes/data/dish_preview.dart';
import 'package:what_dish_to_cook_today/classes/data/ingredient_preview.dart';
import 'package:what_dish_to_cook_today/classes/display/display_text.dart';
import 'package:what_dish_to_cook_today/classes/data/dish_detail.dart';

void main() {
  test('ingredient preview reads the search answer', () {
    final list = IngredientPreview.listFromJson(
        '[{"id":"631d4b212edd11cdfc9ee52f","name":"Egg"}]');

    expect(list.length, 1);
    expect(list.first.id, '631d4b212edd11cdfc9ee52f');
    expect(list.first.name, 'Egg');
    expect(list.first.type, 'Other');
  });

  test('dish preview reads the selection answer', () {
    final list = DishPreview.listFromJson(
        '{"isSuccess":true,"data":[{"id":"6338","name":"Soup","short_detail":"Warm","profile_image":"public/gallery/dishs/1/1/0.png"}]}');

    expect(list.length, 1);
    expect(list.first.name, 'Soup');
    expect(list.first.imageSrc, 'public/gallery/dishs/1/1/0.png');
  });

  test('dish detail reads a post answer', () {
    final detail = DishDetail.fromPostJsonDecode(
        '{"status":0,"data":{"dish_id":"6338","name":"Soup","short_detail":"Warm",'
        '"profile_image":"public/a.png","ingredients":["1"],'
        '"display_blocks":[{"type":"text","text":"Hot","font_size":16,"color":"black"}]}}',
        'Soup');

    expect(detail, isNotNull);
    expect(detail!.displayBlocks.length, 1);
  });

  test('text color names become Colors', () {
    expect(parseColor('white'), const Color(0xFFFFFFFF));
    expect(parseColor('unknown'), const Color(0xFF000000));
  });
}
