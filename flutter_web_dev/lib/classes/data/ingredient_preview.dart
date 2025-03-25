import 'dart:convert';

class IngredientPreview
{
  String id;
  String name;
  String type;

  IngredientPreview(this.id, this.name, this.type);

  static List<IngredientPreview> listFromJson(String jsonData)
  {
    List<IngredientPreview> ingredientPreviews = [];
    for (var element in (json.decode(jsonData) as List<dynamic>))
    {
      ingredientPreviews.add(IngredientPreview(element['_id'], element['name'], element['type']));
    }

    return ingredientPreviews;
  }
}