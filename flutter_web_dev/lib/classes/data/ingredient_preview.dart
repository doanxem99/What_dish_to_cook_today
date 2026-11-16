import 'dart:convert';

class IngredientPreview
{
  String id;
  String name;
  String type;

  IngredientPreview(this.id, this.name, this.type);

  static List<IngredientPreview> listFromJsonDecode(dynamic jsonData)
  {
    //The server answers either with a plain list or with {isSuccess, data}
    dynamic payload = jsonData is String ? json.decode(jsonData) : jsonData;
    dynamic elements = payload is Map ? payload['data'] : payload;

    List<IngredientPreview> ingredientPreviews = [];
    if (elements is! List) {
      return ingredientPreviews;
    }
    for (var element in elements)
    {
      ingredientPreviews.add(IngredientPreview(
          element['id']?.toString() ?? '',
          element['name']?.toString() ?? '',
          element['type']?.toString() ?? 'Other'));
    }

    return ingredientPreviews;
  }

  static List<IngredientPreview> listFromJson(String jsonData)
  {
    return listFromJsonDecode(jsonData);
  }
}
