<script>
  import preview_group from '../components/preview/preview_group.vue'
  import ingredient_profile_generate from '../components/ingredient_profile_generate.vue'

  import ingredientServerAction from '../assets/js/ingredient_server_action.js'
  import { useAuthStore } from '../assets/store/auth_store.js'

  export default{
    components : {
      preview_group,
      ingredient_profile_generate
    },
    data() {
      return {
        foodPreview : [],
        spicePreview : [],
        fruitPreview : [],
        isGenerateIngredient : false
      }
    },
    methods : {
      refeshPage : function(){
        this.$router.go(0);
      },
      moveToIngredientDetail : function(_id){
        this.$router.push({ path: '/ingredient_detail', query: { ingredient_id: _id }})
      },
      openIngredientGenerateBox : function(){
        this.isGenerateIngredient = true;
        if (!useAuthStore().isLogin) { 
          useAuthStore().errorMessage = "You must login to create new dish profile.";
          useAuthStore().jumpPage = '/ingredients'
          this.$router.push({ path: '/signin' });
        }
      },
      closeIngredientGenerateBox : function(){
        this.isGenerateIngredient = false;
      },
    },
    mounted : function(){
      //Search ingredients from server
      ingredientServerAction.searchIngredientSelection((_response) => {
        if(_response.isSuccess){
          this.foodPreview = _response.data.filter(item => item.type == "Food");
          this.spicePreview = _response.data.filter(item => item.type == "Spice");
          this.fruitPreview = _response.data.filter(item => item.type == "Fruit");
        } else{
          console.error("Error: " + _response.message);
        }
      });
    }
  }
  
</script>

<template>
  <main>
    <div class="screen_view">
      <div>
        <div class="menu_title view_space">
          <span>
            <span class="small_font_size">
              Group :
            </span>
            <select id="cars" class="small_font_size">
              <option value="type" class="small_font_size">Type</option>
              <option value="nation" class="small_font_size">Nation</option>
            </select>
          </span>
          <span>
            <span class="small_font_size">
              Sort :
            </span>
            <select id="cars" class="small_font_size">
              <option value="popularity" class="small_font_size">Popularity</option>
              <option value="favorite" class="small_font_size">Favorite</option>
              <option value="persional" class="small_font_size">Persional</option>
            </select>
          </span>
        </div>
        <preview_group title="Foods" :datas = "foodPreview" :onClick = "moveToIngredientDetail" />
        <preview_group title="Spice" :datas = "spicePreview" :onClick = "moveToIngredientDetail" />
        <preview_group title="Fruit" :datas = "fruitPreview" :onClick = "moveToIngredientDetail" />
      </div>
    </div>
  </main>
  <div class="floating_button" v-on:click="openIngredientGenerateBox">
    <img const src="../assets/icons/plus.png" />
  </div>
  <ingredient_profile_generate v-if="isGenerateIngredient" :onRefesh = "refeshPage" :onCancel = "closeIngredientGenerateBox" />
</template>