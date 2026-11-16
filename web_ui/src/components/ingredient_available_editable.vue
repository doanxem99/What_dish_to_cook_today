<script>
  import ingredient_input from './ingredient_input.vue'
  import ingredient_object_available from './ingredient_object_available.vue'

  import ingredientServerAction from '../assets/js/ingredient_server_action.js'
  
  export default{
    components : {
        ingredient_input,
        ingredient_object_available,
    },
    props : {
        ingredientsId: {
          type: Array,
          required: true
        },
        onChanged : {
            type : Function,
            required : true,
        },
    },
    data(){
        return {
            ingredientsAvailable : [],
        }
    },
    methods : {
      onAddIngredient : function(_item){
        if(!this.ingredientsAvailable.find(element => element.id == _item.id)){
            this.ingredientsAvailable.push(_item);
            this.onChanged(this.ingredientsAvailable);
        }
      },
      onRemoveIngredient : function(_item){
        let index = this.ingredientsAvailable.indexOf(_item);
        if (index !== -1) {
          this.ingredientsAvailable.splice(index, 1);
          this.onChanged(this.ingredientsAvailable);
        }
      },
    },
    mounted : function(){
      //Search short detail ingredient
      if(this.ingredientsId != null && this.ingredientsId.length > 0){
        for (let i = 0; i < this.ingredientsId.length; i++) {
          const itemId = this.ingredientsId[i];
          ingredientServerAction.searchIngredientById(itemId, (_ingredients) => {
              //Each call answers with one ingredient, so add it to the list
              _ingredients.forEach(ingredient => {
                if(!this.ingredientsAvailable.find(element => element.id == ingredient.id)){
                  this.ingredientsAvailable.push(ingredient);
                }
              });
          });
        }
      }
    }
  }
</script>

<template>
    <ingredient_object_available :ingredientObjects = "ingredientsAvailable" :onSelect = "onRemoveIngredient" />
    <ingredient_input :onSelected = "onAddIngredient"/>
</template>
