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
    // TODO: implement initState
    super.initState();

    Future.delayed(Duration.zero, () {
      setState((){
        DishPreview dishPreview = ModalRoute.of(context)!.settings.arguments as DishPreview;

      });
    });
  }

  Future<void> loadDishDetail(DishPreview dishPreview) async
  {
    try{
      var url = Uri.parse(AppStorage.serverUrl + 'api/dishs_selection_search/');
      var response = await http.get(url);

      if(response.statusCode == 200){
        setState((){
          dishDetail = DishDetail.fromJson(response.body);
        });
      }
      else{

      }
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
