import 'dart:convert';

import 'package:what_dish_to_cook_today/classes/data/dish_preview.dart';
import 'package:what_dish_to_cook_today/classes/data/ingredient_preview.dart';
import 'package:what_dish_to_cook_today/classes/display/display_block.dart';

class DishDetail extends DishPreview{
  List<IngredientPreview> ingredientsUsing;
  List<DisplayBlock> displayBlocks;

  DishDetail(super.id, super.name, super.sortDetail, super.urlImage, this.ingredientsUsing, this.displayBlocks);

  static DishDetail? fromJson(String jsonData){
    try{
      dynamic data = json.decode(jsonData);

      return DishDetail(data['id'], data['name'], data['short_detail'], data['image_src'],
          IngredientPreview.listFromJson(data['ingredients']),
          DisplayBlockGenerator.listFromJson(data['display_blocks']));
    }
    catch(e){
      return null;
    }
  }
}