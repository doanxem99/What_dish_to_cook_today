import 'package:flutter/material.dart';
import 'package:what_dish_to_cook_today/classes/data/ingredient_preview.dart';

class IngredientLayout{

  static Widget setupIngredientsPreview(List<IngredientPreview> ingredientList, Function(IngredientPreview)? onClick){
    return Wrap(
      spacing: 5,
      alignment: WrapAlignment.center,
      children: List<Widget>.generate(ingredientList.length, (int index)
      {
        IngredientPreview ingredientPreview = ingredientList[index];
        return OutlinedButton(
          onPressed: onClick != null ? (){
            IngredientPreview ingredient = ingredientPreview;
            onClick(ingredient);
          } : null,
          style: ButtonStyle(
            shape: MaterialStateProperty.all(RoundedRectangleBorder(borderRadius: BorderRadius.circular(30.0))),
          ),
          child: Text(ingredientPreview.name),
        );
      }),
    );
  }

}