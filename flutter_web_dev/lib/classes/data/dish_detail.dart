import 'dart:convert';

import 'package:what_dish_to_cook_today/classes/data/dish_preview.dart';
import 'package:what_dish_to_cook_today/classes/data/ingredient_preview.dart';
import 'package:what_dish_to_cook_today/classes/display/display_block.dart';

class DishDetail extends DishPreview{
  List<IngredientPreview> ingredientsUsing;
  List<DisplayBlock> displayBlocks;

  DishDetail(String id, String name, String sortDetail, String imageSrc,
      this.ingredientsUsing, this.displayBlocks)
      : super(id, name, sortDetail, imageSrc);

  //Build from the /api/dish/profile/get_dish_post answer
  static DishDetail? fromPostJsonDecode(dynamic jsonData, String dishName){
    try{
      dynamic payload = jsonData is String ? json.decode(jsonData) : jsonData;
      dynamic data = payload is Map && payload.containsKey('data') ? payload['data'] : payload;
      if(data == null){
        return null;
      }

      return DishDetail(
          data['dish_id']?.toString() ?? '',
          data['name']?.toString() ?? dishName,
          data['short_detail']?.toString() ?? '',
          data['profile_image']?.toString() ?? '',
          [],
          DisplayBlockGenerator.listFromJsonDecode(data['display_blocks'] ?? []));
    }
    catch(e){
      return null;
    }
  }
}
