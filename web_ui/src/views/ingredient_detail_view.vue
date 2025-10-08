<script>
  import display_block from '../components/display_block/display_block.vue'

  import ingredientServerAction from '../assets/js/ingredient_server_action.js'
  import profileEnum from '../assets/js/profile_enum.js'

  export default{
    components : {
      display_block
    },
    data() {
      return {
        ingredientDetail : null,
      }
    },
    methods : {
      moveToEditPage : function(){
        //We move to ingredient_edit
        this.$router.push({ path: '/ingredient_edit', query: { ingredient_id: this.$route.query.ingredient_id }});
      }
    },
    mounted : function(){
      let ingredientId = this.$route.query.ingredient_id;
      //Search ingredients from server
      ingredientServerAction.getIngredientProfile(ingredientId, (_response) => {
        if(_response.status == profileEnum.ProfileStatus_Detail.Success){
          //Save data
          this.ingredientDetail = {
            "id" : _response.data._id,
            "name" : _response.data.name,
            "best_post" : null
          }
          //Load best ingredient post id
          let bestPostId = _response.data.best_post_id;
          ingredientServerAction.getIngredientPostProfile(bestPostId, (_response) => {
            if(_response.status == profileEnum.ProfileStatus_PostDetail.Success){
              //Save data
              this.ingredientDetail.best_post = {
                "id" : _response.data._id,
                "user_id" : _response.data.user_id,
                "is_best_post" : _response.data.is_best_post,
                "date_time" : (new Date(_response.data.date_time)).toDateString(),
                "points" : _response.data.points,
                "type" : _response.data.type,
                "short_detail" : _response.data.short_detail,
                "profile_image" : _response.data.profile_image,
                "display_blocks" : _response.data.display_blocks
              }
              //Load user name
              
            }
            else{
              console.log("Best ingredient post detail error : " + _response.detail);
            }
          });
        }
        else{
          console.log("Ingredient detail error : " + _response.detail);
        }
        //this.ingredientDetail = _data;
      });
    }
  }
</script>

<template>
  <main>
    <div class="screen_view">
      <div>
        <!-- <div class="header_space"></div> -->
        <div class="menu_title view_space" v-if="ingredientDetail != null && ingredientDetail.best_post != null">
            <span>
                <span style="vertical-align: top" class="small_font_size">
                    Author : 
                </span>
                <span class="small_font_size link_hover">
                  {{ingredientDetail.best_post.user_id}}
                </span>
                <span style="vertical-align: top" class="small_font_size">
                    |
                </span>
                <span style="vertical-align: top" class="small_font_size">
                    Date : {{ingredientDetail.best_post.date_time}}
                </span>
                <span style="vertical-align: top">
                  <img class="editable_item_button" const src="../assets/icons/edit_square.png" v-on:click="moveToEditPage" />
                </span>
            </span>
        </div>

        <div class="view_space" style="text-align: center;" v-if="ingredientDetail">
          <p class="large_font_size view_space">{{ingredientDetail.name}}</p>
          <div v-if="ingredientDetail.best_post">
            <p style = "font-weight: bold;" class="medium_font_size view_space">{{ingredientDetail.best_post.type}}</p>
            <p class="medium_font_size view_space">{{ingredientDetail.best_post.short_detail}}</p>
            <display_block :datas = "ingredientDetail.best_post.display_blocks" />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>