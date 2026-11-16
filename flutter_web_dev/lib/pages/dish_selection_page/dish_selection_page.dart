import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:what_dish_to_cook_today/classes/data/dish_preview.dart';
import 'package:what_dish_to_cook_today/classes/data/ingredient_preview.dart';
import 'package:what_dish_to_cook_today/layouts/ingredient_layout.dart';
import 'package:what_dish_to_cook_today/pages/template_page.dart';
import 'package:what_dish_to_cook_today/storages/app_storage.dart';

class DishSelectionPage extends StatefulWidget {
  const DishSelectionPage({Key? key}) : super(key: key);

  @override
  State<DishSelectionPage> createState() => _DishSelectionPageState();
}

class _DishSelectionPageState extends State<DishSelectionPage> {
  List<IngredientPreview> _ingredientsAvailable = [];
  List<DishPreview> _dishsPreview = [];

  @override
  void initState() {
    // TODO: implement initState
    super.initState();

    Future.delayed(Duration.zero, () {
      setState((){
        _ingredientsAvailable = ModalRoute.of(context)!.settings.arguments as List<IngredientPreview>;
      });
      searchDishs();
    });
  }

  Future<void> searchDishs() async
  {
    try{
      //Only ask for dishes that use the ingredients the user picked
      String ingredientIds = _ingredientsAvailable.map((ingredient) => ingredient.id).join('-');
      var url = Uri.parse(AppStorage.serverUrl + 'api/dish/selection/ingredients/' + ingredientIds);
      var response = await http.get(url);

      if(response.statusCode == 200){
        setState((){
          _dishsPreview = DishPreview.listFromJson(response.body);
        });
      }
      else{

      }
    }
    catch(e){

    }
  }

  Widget setupDishsPreview(DishPreview _dishPreview){
    return GestureDetector(
      onTap: (){
        Navigator.pushNamed(context, '/dish_detail', arguments: _dishPreview);
      },
      child: Stack(
        children: [
          Positioned.fill(
              child: Image.network(
                AppStorage.serverUrl + _dishPreview.imageSrc.replaceAll('\\', '/'),
                fit: BoxFit.cover,
                alignment: Alignment.center,
              ),
          ),
          Positioned.fill(
              child: Container(color: Color.fromARGB(60, 0, 0, 255),)
          ),
          Positioned.fill(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Container(
                  height: 100,
                  color: Color.fromARGB(160, 0, 0, 0),
                  padding: EdgeInsets.all(10),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(_dishPreview.name, style: TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold),),
                      SizedBox(height: 10,),
                      Text(_dishPreview.sortDetail, style: TextStyle(fontSize: 14, color : Colors.white),),
                    ],
                  ),
                ),
              ),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return TemplatePage(
        content: Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15.0),
          ),
          child: Padding(
            padding: EdgeInsets.all(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text("Dish selection", style: TextStyle(fontSize: 38, fontWeight: FontWeight.bold),),
                const SizedBox(height: 10,),
                const Text("The dishes are selected from the ingredients available in your home", style: TextStyle(fontSize: 14),),
                const SizedBox(height: 15,),
                IngredientLayout.setupIngredientsPreview(_ingredientsAvailable, null),
                const Divider(
                  height: 40,
                  thickness: 1,
                  indent: 10,
                  endIndent: 10,
                  color: Colors.black12,
                ),
                GridView.count(
                  shrinkWrap: true,
                  crossAxisSpacing: 20,
                  mainAxisSpacing: 20,
                  crossAxisCount: 4,
                  children: List<Widget>.generate(_dishsPreview.length, (index){
                    return setupDishsPreview(_dishsPreview[index]);
                  }),
                )
              ],
            ),
          ),
        )
    );
  }
}
