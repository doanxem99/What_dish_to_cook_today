import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:what_dish_to_cook_today/classes/data/dish_preview.dart';
import 'package:what_dish_to_cook_today/classes/data/ingredient_preview.dart';
import 'package:what_dish_to_cook_today/classes/data/dish_detail.dart';
import 'package:what_dish_to_cook_today/layouts/ingredient_layout.dart';
import 'package:what_dish_to_cook_today/pages/template_page.dart';
import 'package:what_dish_to_cook_today/storages/app_storage.dart';

class DishDetailPage extends StatefulWidget {
  const DishDetailPage({Key? key}) : super(key: key);

  @override
  State<DishDetailPage> createState() => _DishDetailPageState();
}

class _DishDetailPageState extends State<DishDetailPage> {
  DishDetail? dishDetail = null;

  @override
  void initState() {
    super.initState();

    //Route arguments are only ready after the first frame
    Future.delayed(Duration.zero, () {
      final dishPreview = ModalRoute.of(context)!.settings.arguments as DishPreview;
      loadDishDetail(dishPreview);
    });
  }

  Future<void> loadDishDetail(DishPreview dishPreview) async
  {
    try{
      var dishResponse = await http.get(Uri.parse(AppStorage.serverUrl + 'api/dish/profile/get_dish/' + dishPreview.id));
      if(dishResponse.statusCode != 200){
        return;
      }
      dynamic dishData = json.decode(dishResponse.body)['data'];
      if(dishData == null){
        return;
      }

      String bestPostId = dishData['best_post_id']?.toString() ?? '';
      if(bestPostId.isEmpty){
        setState((){
          dishDetail = DishDetail(dishPreview.id, dishData['name']?.toString() ?? dishPreview.name,
              '', dishPreview.imageSrc, [], []);
        });
        return;
      }

      var postResponse = await http.get(Uri.parse(AppStorage.serverUrl + 'api/dish/profile/get_dish_post/' + bestPostId));
      if(postResponse.statusCode != 200){
        return;
      }
      DishDetail? detail = DishDetail.fromPostJsonDecode(postResponse.body,
          dishData['name']?.toString() ?? dishPreview.name);
      if(detail == null){
        return;
      }

      //The post only stores ingredient ids, so ask for their names
      dynamic postData = json.decode(postResponse.body)['data'];
      List<dynamic> ingredientIds = postData['ingredients'] ?? [];
      if(ingredientIds.isNotEmpty){
        var ingredientsResponse = await http.get(Uri.parse(
            AppStorage.serverUrl + 'api/ingredient/search/ids/' + ingredientIds.map((id) => id.toString()).join('-')));
        if(ingredientsResponse.statusCode == 200){
          detail.ingredientsUsing = IngredientPreview.listFromJson(ingredientsResponse.body);
        }
      }

      setState((){
        dishDetail = detail;
      });
    }
    catch(e){

    }
  }

  Widget setUpDishDetail(){
    if(dishDetail != null){
      return Column(
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(dishDetail!.name, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),),
          SizedBox(height: 10,),
          Text(dishDetail!.sortDetail, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),),
          SizedBox(height: 20,),
          IngredientLayout.setupIngredientsPreview(dishDetail!.ingredientsUsing, (p0) => null),
          SizedBox(height: 20,),
        ],
      );
    }
    else{
      return Container();
    }
  }

  @override
  Widget build(BuildContext context) {
    return TemplatePage(
        content: setUpDishDetail(),
    );
  }
}
