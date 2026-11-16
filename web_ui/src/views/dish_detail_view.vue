<script>
  import ingredient_available from '../components/ingredient_available.vue'
  import display_block from '../components/display_block/display_block.vue'
  import comment_section from '../components/comment_section.vue'

  import dishServerAction from '../assets/js/dish_server_action.js'
  import profileEnum from '../assets/js/profile_enum.js'

  export default{
    components : {
      ingredient_available,
      display_block,
      comment_section,
    },
    data() {
      return {
        dishDetail : null,
        userComment : "",
      }
    },
    methods : {
      
    },
    mounted : function(){
      let dishId = this.$route.query.dish_id;
      let dishPostId = this.$route.query.dish_post_id;
      //Search dishs from server
      if (dishId) {
        dishServerAction.getDishProfile(dishId, (_response) => {
          if(_response.status == profileEnum.ProfileStatus_Detail.Success){
            //Save data
            this.dishDetail = {
              "id" : _response.data._id,
              "name" : _response.data.name,
              "best_post" : null
            }
            //Load best dish post id
            let bestPostId = _response.data.best_post_id;
            dishServerAction.getDishPostProfile(bestPostId, (_response) => {
              if(_response.status == profileEnum.ProfileStatus_PostDetail.Success){
                //Save data
                this.dishDetail.best_post = {
                  "id" : _response.data._id,
                  "name": _response.data.name,
                  "user_id" : _response.data.user_id,
                  "date_time" : (new Date(_response.data.date_time)).toDateString(),
                  "points" : _response.data.points,
                  "ingredients" : _response.data.ingredients,
                  "short_detail" : _response.data.short_detail,
                  "profile_image" : _response.data.profile_image,
                  "display_blocks" : _response.data.display_blocks
                }
                //Load user name
                
              }
              else{
                console.log("Best dish post detail error : " + _response.detail);
              }
            });
          }
          else{
            console.log("Dish detail error : " + _response.detail);
          }
        });
      } 
      // Go direct into dish detail
      else {
        dishServerAction.getDishPostProfile(dishPostId, (_response) => {
            if(_response.status == profileEnum.ProfileStatus_PostDetail.Success){
              //Save data
              this.dishDetail = {
                "best_post": {
                  "id" : _response.data._id,
                  "name": _response.data.name,
                  "user_id" : _response.data.user_id,
                  "date_time" : (new Date(_response.data.date_time)).toDateString(),
                  "points" : _response.data.points,
                  "ingredients" : _response.data.ingredients,
                  "short_detail" : _response.data.short_detail,
                  "profile_image" : _response.data.profile_image,
                  "display_blocks" : _response.data.display_blocks
                }
              }
              //Load user name
              
            }
            else{
              console.log("Best dish post detail error : " + _response.detail);
            }
        });
      }
    }
  }
</script>

<template>
  <main>
    <div class="screen_view">
      <div>
        <div class="view_space" style="text-align: center;" v-if="dishDetail">
          <div class="menu_title view_space" v-if="dishDetail.best_post">
            <span>
              <span class="small_font_size" style="vertical-align: top;">
                Author : 
              </span>
              <span class="small_font_size link_hover">
                {{dishDetail.best_post.user_id}}
              </span>
            </span>
            <span>
              <span class="small_font_size" style="vertical-align: top;">
                Date : 
              </span>
              <span class="small_font_size link_hover">
                {{dishDetail.best_post.date_time}}
              </span>
            </span>
          </div>
          <p class="large_font_size view_space" v-if="dishDetail.best_post">{{dishDetail.best_post.name || dishDetail.name}}</p>
          <div v-if="dishDetail.best_post">
            <ingredient_available :ingredientsId = "(dishDetail.best_post.ingredients || []).join('-')" />
            <p class="medium_font_size view_space">{{dishDetail.best_post.short_detail}}</p>
            <display_block :datas = "dishDetail.best_post.display_blocks || []" />
          </div>
        </div>

        <!-- Divided -->
        <div class="w-full h-1 flex justify-center items-center mt-5 mb-15">
          <div class="w-1/2 h-0.5 border-2">
          </div>
        </div>

        <comment_section :data = "userComment"/>
      </div>
    </div>
  </main>
</template>