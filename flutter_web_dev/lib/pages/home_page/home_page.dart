import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:what_dish_to_cook_today/classes/data/ingredient_preview.dart';
import 'package:what_dish_to_cook_today/layouts/ingredient_layout.dart';
import 'package:what_dish_to_cook_today/pages/template_page.dart';
import 'package:what_dish_to_cook_today/storages/app_storage.dart';
import 'package:collection/collection.dart';

class HomePage extends StatefulWidget {
  const HomePage({Key? key}) : super(key: key);

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  Map<String, List<IngredientPreview>> _ingredientsAvalable = {};
  String _keywordSearch = "";
  List<IngredientPreview> _ingredientsSearch = [];
  @override
  void initState() {
    // TODO: implement initState
    super.initState();

    //Search with key keyword is empty
    searchIngredients();
  }

  void moveToDishSelectionPage(){
    if(_ingredientsAvalable.length > 0){
      List<IngredientPreview> ingredientsUsing = [];
      _ingredientsAvalable.forEach((key, itemList) {
        ingredientsUsing.addAll(itemList);
      });

      Navigator.pushNamed(context, '/dish_selection', arguments: ingredientsUsing);
    }
    else{
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text("Please select at lease 1 ingredient")));
    }
  }

  void addIngredientsAvalable(IngredientPreview ingredientSearch)
  {
    setState(() {
      bool isExist = false;
      _ingredientsAvalable.forEach((key, ingredientList) {
        if(key == ingredientSearch.type){
          if (ingredientList.firstWhereIndexedOrNull((index, ingredient) => ingredient.name == ingredientSearch.name) == null)
          {
            ingredientList.add(ingredientSearch);
          }
          isExist = true;
        }
      });

      if(!isExist){
        _ingredientsAvalable[ingredientSearch.type] = [ingredientSearch];
      }
    });
  }

  void removeIngredientsAvalable(IngredientPreview ingredientSearch)
  {
    setState(() {
      //Get itemList by type
      List<IngredientPreview>? itemList = _ingredientsAvalable[ingredientSearch.type];
      //Remove item out of itemList
      itemList!.remove(ingredientSearch);
      //If itemList is empty -> We remove this group
      if(itemList.length == 0){
        _ingredientsAvalable.removeWhere((key, value) => key == ingredientSearch.type);
      }
    });
  }

  Future<void> searchIngredients() async
  {
    try{
      var url = Uri.parse(AppStorage.serverUrl + 'api/ingredients_search/' + _keywordSearch);
      var response = await http.get(url);
      if(response.statusCode == 200){
        setState((){
          _ingredientsSearch = IngredientPreview.listFromJson(response.body);
        });
      }
      else{

      }
    }
    catch(e){

    }
  }

  Widget setupIngredientsSearching(){
    return ConstrainedBox(
      constraints: const BoxConstraints(
        minHeight: 100,
      ),
      child: Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15.0),
          ),
          child: Padding(
            padding: EdgeInsets.all(10),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                IngredientLayout.setupIngredientsPreview(_ingredientsSearch, (ingredient){
                  addIngredientsAvalable(ingredient);
                }),
                const Divider(
                  height: 20,
                  thickness: 1,
                  indent: 10,
                  endIndent: 10,
                  color: Colors.black12,
                ),
                Text('Results for : "${_keywordSearch}"', textAlign: TextAlign.center,)
              ],
            ),
          )
      ),
    );
  }

  Widget setupCookingIngredientsAvailable(){
    List<Widget> items = [];
    _ingredientsAvalable.forEach((key, itemList) {
      items.add(Text("- ${key} -", style: TextStyle(fontSize: 16),));
      items.add(SizedBox(height: 5,));
      items.add(IngredientLayout.setupIngredientsPreview(itemList, (ingredient){
        removeIngredientsAvalable(ingredient);
      }));
      items.add(SizedBox(height: 10,));
    });
    
    return Padding(
      padding: EdgeInsets.all(10),
      child: Column(
        children: items,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return TemplatePage(
        content: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            //const SizedBox(height: 100),
            Text("Choose delicious dishes for the family today !", style: TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            Text("Please enter the food and cooking ingredients you have available. The system will automatically find the dish from your available ingredients.",
                style: TextStyle(color: Colors.white, fontSize: 14)),
            const SizedBox(height: 40),
            TextFormField(
              restorationId: 'Search',
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(30)),
                    borderSide: BorderSide(color: Colors.blue)),
                contentPadding: EdgeInsets.all(15),
                fillColor: Colors.white,
                filled: true,
                //icon: Icon(Icons.person, color : Colors.white),
                hintText: 'Enter cooking ingredients . . .',
              ),

              onChanged: (value){
                _keywordSearch = value;
                searchIngredients();
              },
            ),
            setupIngredientsSearching(),
            const SizedBox(height: 10),
            Card(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15.0),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15.0),
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minHeight: 150,
                        ),
                        child: setupCookingIngredientsAvailable(),
                      ),
                    ),
                    TextButton(onPressed: (){
                      moveToDishSelectionPage();
                    }, child: const Text("Search!"))
                  ],
                )
            )
          ],
        ),
    );
  }
}
