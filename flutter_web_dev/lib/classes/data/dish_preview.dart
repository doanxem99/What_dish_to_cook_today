import 'dart:convert';

class DishPreview
{
  String id;
  String name;
  String sortDetail;
  String imageSrc;

  DishPreview(this.id, this.name, this.sortDetail, this.imageSrc);

  static List<DishPreview> listFromJson(String jsonData)
  {
    List<DishPreview> dishPreviews = [];
    for (var element in (json.decode(jsonData) as List<dynamic>))
    {
      dishPreviews.add(DishPreview(element['_id'], element['name'], element['short_detail'], element['image_src']));
    }

    return dishPreviews;
  }
}