<script>
  import { faPlus } from '@fortawesome/free-solid-svg-icons'
  import preview_group from '../components/preview/preview_group.vue'
  import dish_profile_generate from '../components/dish_profile_generate.vue'

  import dishServerAction from '../assets/js/dish_server_action.js'
  import { useAuthStore } from '../assets/store/auth_store.js'
  
  export default{
    components : {
      preview_group,
      dish_profile_generate,
    },
    data() {
      return {
        dishsPreview : [],
        isGenerateDish : false,
        faPlus
      }
    },
    methods : {
      refeshPage : function(){
        this.$router.go(0);
      },
      moveToDishDetail : function(_id){
        this.$router.push({ path: '/dish_detail', query: { dish_id: _id }})
      },
      openDishGenerateBox : function(){
        // Only login user can create dish
        if(!useAuthStore().isLogin){
          useAuthStore().errorMessage = "You must login to create new dish profile.";
          useAuthStore().jumpPage = '/dishes';
          this.$router.push({ path: '/signin' });
          return;
        }
        this.isGenerateDish = true;
      },
      closeDishGenerateBox : function(){
        this.isGenerateDish = false;
      },
    },
    mounted : function(){
      //Search dishs from server
      dishServerAction.searchDishSelection("", (_response) => {
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
        <preview_group title="National dishes" :datas = dishsPreview :onClick = "moveToDishDetail" />
        <preview_group title="Foreign dishes" :datas = dishsPreview :onClick = "moveToDishDetail" />
      </div>
    </div>
  </main>
  <div class="floating_button" v-on:click="openDishGenerateBox">
    <div class="w-full h-full flex justify-center items-center">
      <font-awesome-icon bound size="2x" :icon="faPlus"/>
    </div>
  </div>
  <dish_profile_generate v-if="isGenerateDish" :onRefesh = "refeshPage" :onCancel = "closeDishGenerateBox" />
</template>