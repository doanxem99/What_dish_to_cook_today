<script>
  import ingredient_input from '../components/ingredient_input.vue'
  import ingredient_object_available from '../components/ingredient_object_available.vue'
  import dish_package from '../components/dish_package.vue'

  import dish_server_action from '../assets/js/dish_server_action.js'

  export default{
    components : {
      ingredient_input,
      ingredient_object_available,
      dish_package
    },
    data() {
      return {
        keySearch : '',
        error : '',
        ingredientsAvailable : [],
        dishBestPost: null,
      }
    },
    methods : {
      onAddIngredient : function(_item){
        if(!this.ingredientsAvailable.find(element => element.id == _item.id)){
            this.ingredientsAvailable.push(_item);
            //Invoke onChanged
            // this.onChanged(this.ingredientsAvailable);
        }
      },
      onRemoveIngredient : function(_item){
        let index = this.ingredientsAvailable.indexOf(_item);
        if (index !== -1) {
          this.ingredientsAvailable.splice(index, 1);
          //Invoke onChanged
          // this.onChanged(this.ingredientsAvailable);
        }
      },
      moveToDishSelection : function(){
        //this.$router.push('/dish_selection')
        if(this.ingredientsAvailable.length != 0){
          let ingredientIds = "";
          this.ingredientsAvailable.forEach(element => {
            if(ingredientIds != ""){
              ingredientIds += "-";
            }
            ingredientIds += element.id;
          });
          this.$router.push({ path: '/dish_selection', query: { ingredients: ingredientIds }})
        }
        else{
          this.error = "Please select ingredients available first!"
        }
      },
    },
    mounted : function() {
      dish_server_action.getBestDishPost((_response) => {
        this.dishBestPost = _response.data;
      });
    }
  }
</script>

<template>
  <main>
    <div class="screen_view screen_view_block view_center_vertical">
      <div>
        <div class="half_split">
          <div class="half_split_column">
            <p class="big_font_size view_space">Choose delicious dishes for the family today !</p>
            <p class="small_font_size view_space">Please enter the food and cooking ingredients you have available.</p>
            <ingredient_input :onSelected = "onAddIngredient"/>
          </div>
          <div class="half_split_column">
            <div style="height: 100px;"></div>
            <p class="big_font_size view_space">Ingredient available</p>
            <p class="small_font_size view_space">The system will automatically find the dish from your available ingredients.</p>
            <ingredient_object_available :ingredientObjects = "ingredientsAvailable" :onSelect = "onRemoveIngredient" />
            <p v-if="error != ''" class="small_font_size error">{{error}}</p>
            <button class="btn w-full h-10 small_font_size" type="button" v-on:click="moveToDishSelection()">Find dishes</button>
          </div>
        </div>
        <!-- Divided -->
        <div class="w-full h-1 flex justify-center items-center mt-5 mb-15">
          <div class="w-1/2 h-0.5 border-2">
          </div>
        </div>

        <dish_package v-if="dishBestPost" :dataDish = "dishBestPost" />

        <!-- <div class="screen_view screen_view_block view_center_vertical" style="background-color: gray;">
    
        </div> -->
      </div>
    </div>
    
    
  </main>
</template>
