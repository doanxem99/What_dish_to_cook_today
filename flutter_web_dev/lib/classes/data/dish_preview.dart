import 'dart:convert';

class DishPreview
{
  String id;
  String name;
  String sortDetail;
  String imageSrc;

  DishPreview(this.id, this.name, this.sortDetail, this.imageSrc);

  static List<DishPreview> listFromJsonDecode(dynamic jsonData)
  {
    //The server answers either with a plain list or with {isSuccess, data}
    dynamic payload = jsonData is String ? json.decode(jsonData) : jsonData;
    dynamic elements = payload is Map ? payload['data'] : payload;

    List<DishPreview> dishPreviews = [];
    if (elements is! List) {
      return dishPreviews;
    }
    for (var element in elements)
    {
      dishPreviews.add(DishPreview(
          element['id']?.toString() ?? '',
          element['name']?.toString() ?? '',
          element['short_detail']?.toString() ?? '',
          element['profile_image']?.toString() ?? ''));
    }

    return dishPreviews;
  }

  static List<DishPreview> listFromJson(String jsonData)
  {
    return listFromJsonDecode(jsonData);
  }
}
