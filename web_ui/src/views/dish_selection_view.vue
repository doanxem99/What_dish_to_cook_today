<script>
  import ingredient_available from '../components/ingredient_available.vue'
  import preview_group from '../components/preview/preview_group.vue'

  import dishServerAction from '../assets/js/dish_server_action.js'

  export default{
    components : {
      ingredient_available,
      preview_group
    },
    data() {
      return {
        ingredients : null,
        dishsPreview : []
      }
    },
    methods : {
      moveToDishDetail : function(_id){
        this.$router.push({ path: '/dish_detail', query: { dish_id: _id }})
      },
    },
    mounted : function(){
      this.ingredients = this.$route.query.ingredients;
      //Search dishs from server
      dishServerAction.searchDishSelection(this.ingredients, (_response) => {
        if(_response.isSuccess){
          this.dishsPreview = _response.data;
        }
      });
    }
  }
</script>

<template>
  <main>
    <div class="screen_view">
      <div>
        <!-- <div class="header_space"></div> -->
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
        <ingredient_available v-if="ingredients" :ingredientsId = ingredients />
        <preview_group title="Dishes for your ingredients" :datas = dishsPreview :onClick = "moveToDishDetail" />
      </div>
    </div>
  </main>
</template>