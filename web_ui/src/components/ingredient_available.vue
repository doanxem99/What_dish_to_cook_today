<script setup>
  const props = defineProps({
    //Seperate ids by '-'
    ingredientsId: {
      type: String,
      required: true
    }
  })
</script>

<template>
    <div class="view_space" style="text-align: center;">
      <button class="ingredient_button ingredient_button_disable small_font_size" type="button" v-for="(item, index) in ingredientsAvailable">{{item.name}}</button>
    </div>
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
      moveToDishDetail : function(_id){
        this.$router.push({ path: '/dish_detail', query: { dish_id: _id }})
      },
    },
    mounted : function(){
      //Search short detail ingredient
      ingredientServerAction.searchIngredientById(this.props.ingredientsId, (_ingredients) => {
        this.ingredientsAvailable = _ingredients;
      });
    }
  }
</script>
