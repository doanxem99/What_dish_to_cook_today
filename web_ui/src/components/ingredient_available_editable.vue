<script setup>
  import ingredient_input from './ingredient_input.vue'
  import ingredient_object_available from './ingredient_object_available.vue'

  const props = defineProps({
    //Seperate ids by '-'
    ingredientsId: {
      type: String,
      required: true
    },
    onChanged : {
        type : Function,
        required : true,
    },
  })
</script>

<template>
    <ingredient_object_available :ingredientObjects = "ingredientsAvailable" :onSelect = "onRemoveIngredient" />
    <ingredient_input :onSelected = "onAddIngredient"/>
</template>

<script>
  import ingredientServerAction from '../assets/js/ingredient_server_action.js'
  
  export default{
    data(){
        return {
            ingredientsAvailable : [],
        }
    },
    methods : {
      onAddIngredient : function(_item){
        if(!this.ingredientsAvailable.find(element => element.id == _item.id)){
            this.ingredientsAvailable.push(_item);
            //Invoke onChanged
            this.props.onChanged(this.ingredientsAvailable);
        }
      },
      onRemoveIngredient : function(_item){
        let index = this.ingredientsAvailable.indexOf(_item);
        if (index !== -1) {
          this.ingredientsAvailable.splice(index, 1);
          //Invoke onChanged
          this.props.onChanged(this.ingredientsAvailable);
        }
      },
    },
    mounted : function(){
      //Search short detail ingredient
      if(this.props.ingredientsId != null && this.props.ingredientsId.length > 0){
        ingredientServerAction.searchIngredientById(this.props.ingredientsId, (_ingredients) => {
            this.ingredientsAvailable = _ingredients;
        });
      }
    }
  }
</script>
