<script>
  import display_block from '../components/display_block/display_block.vue'
  import block_import_box from '../components/block_import_box.vue'
  import sample_preview_box from '../components/sample_preview_box.vue'
  import edit_box from '../components/edit_box/edit_box.vue'
  import ingredient_available_editable from '../components/ingredient_available_editable.vue'

  import enums from '../assets/js/enums.js'
  import profileEnum from '../assets/js/profile_enum.js'
  import dishServerAction from '../assets/js/dish_server_action.js'

  export default{
    components : {
      display_block,
      block_import_box,
      sample_preview_box,
      edit_box,
      ingredient_available_editable
    },
    data() {
      return {
        dishPostData : null,
        dishPreviewData : null,
        editType : enums.EditType.None,
        dataEditing : null,
        enums,
        ingredientsRequired: []
      }
    },
    methods : {
      editDishType : function(){
        this.editType = enums.EditType.Type;
        this.dataEditing = this.dishPostData.data.type;
      },
      editDishShortDetail : function(){
        this.editType = enums.EditType.ShortDetail;
        this.dataEditing = this.dishPostData.data.short_detail;
      },
      editDishBlock : function(_item, _index){
        this.editType = enums.EditType.Block;
        this.dataEditing = _item;
      },
      moveUpBlock : function(_item, _index){
        if(_index > 0){
          let val = this.dishPostData.data.display_blocks[_index];
          this.dishPostData.data.display_blocks[_index] = this.dishPostData.data.display_blocks[_index - 1];
          this.dishPostData.data.display_blocks[_index - 1] = val;
        }
      },
      moveDownBlock : function(_item, _index){
        if(_index < this.dishPostData.data.display_blocks.length - 1){
          let val = this.dishPostData.data.display_blocks[_index];
          this.dishPostData.data.display_blocks[_index] = this.dishPostData.data.display_blocks[_index + 1];
          this.dishPostData.data.display_blocks[_index + 1] = val;
        }
      },
      boxEdit_OnEdited : function(_value){
        if(this.editType == enums.EditType.Type){
          this.dishPostData.data.type = _value;
        }
        else if(this.editType == enums.EditType.ShortDetail){
          this.dishPostData.data.short_detail = _value;
          this.dishPreviewData.short_detail = _value;
        }
        else if(this.editType == enums.EditType.Block){
          if(this.dataEditing.type == 'text'){
            this.dataEditing.text = _value.text;
            this.dataEditing.font_size = _value.font_size;
            this.dataEditing.color = _value.color;
          }
          else if(this.dataEditing.type == 'image'){
            this.dataEditing.src = _value.src;
            this.dataEditing.text = _value.text;
            this.dataEditing.font_size = _value.font_size;
            this.dataEditing.color = _value.color;
          }
        }
      },
      boxEdit_OnClose : function(){
        this.editType = enums.EditType.None;
        this.dataEditing = null;
      },
      addBlock : function(_item, _index){
        let newItem = JSON.parse(JSON.stringify(_item));
        this.dishPostData.data.display_blocks.splice(_index + 1, 0, newItem);
      },
      removeBlock : function(_item, _index){
        this.dishPostData.data.display_blocks.splice(_index, 1);
      },
      importBlock : function(_data){
        this.dishPostData.data.display_blocks.push(_data);
      },
      onChangeBackgroundImage : function(_data){
        this.dishPostData.data.profile_image = _data;
        this.dishPreviewData.profile_image = _data;
      },
      onUpdateIngredients: function(_ingredients) {
        this.ingredientsRequired = _ingredients;
        this.dishPostData.data.ingredients_required = _ingredients.map(ing => ing.id);
      },
      onSave : function(){
        //First, we save data
        //Then, we move back to dish_detail
        dishServerAction.createDishPostProfile(this.dishPostData, (_response)=>{
            if(_response.status == profileEnum.ProfileStatus_PostCreate.CreatingSuccess ||
              _response.status == profileEnum.ProfileStatus_PostCreate.EditingSuccess){
                //We move to dish_detail
                this.$router.push({ path: '/dish_detail', query: { dish_id: this.$route.query.dish_id }});
            }
            else{
                console.log("Error : " + _response.detail);
                //this.status = _response.detail;
            }
        });
      },
      onCancel : function(){
        //We move to dish_detail
        this.$router.push({ path: '/dish_detail', query: { dish_id: this.$route.query.dish_id }});
      },
      changeIngredientsUsing : function(_ingredients){
          this.dishPostData.data.ingredients = [];
          _ingredients.forEach(item => {
              this.dishPostData.data.ingredients.push(item.id);
          });
      },
    },
    mounted : function(){
      let dishId = this.$route.query.dish_id;
      //Search dishes from server
      dishServerAction.getDishProfile(dishId, (_response) => {
        if(_response.status == profileEnum.ProfileStatus_Detail.Success){
          //Save data
          this.dishPostData = {
            "dish_id" : _response.data._id,
            "dish_name" : _response.data.name,
            "data" : null
          }
          //Load best dish post id
          let bestPostId = _response.data.best_post_id;
          dishServerAction.getDishPostProfile(bestPostId, (_response) => {
            if(_response.status == profileEnum.ProfileStatus_PostDetail.Success){
              //Save data
              this.dishPostData.data = {
                "id" : _response.data._id,
                "user_id" : _response.data.user_id,
                "is_best_post" : _response.data.is_best_post,
                "date_time" : (new Date(_response.data.date_time)).toDateString(),
                "points" : _response.data.points,
                "ingredients" : _response.data.ingredients || [],
                // "type" : _response.data.type,
                "short_detail" : _response.data.short_detail,
                "profile_image" : _response.data.profile_image,
                "display_blocks" : _response.data.display_blocks,
              }
              this.dishPreviewData = {
                "name" : this.dishPostData.dish_name,
                "short_detail" : _response.data.short_detail,
                "profile_image" : _response.data.profile_image
              }
              
              // Load ingredients required
              if (_response.data.ingredients_required && _response.data.ingredients_required.length > 0) {
                dishServerAction.getIngredientsById(_response.data.ingredients_required, (_ingredients) => {
                  this.ingredientsRequired = _ingredients;
                });
              }
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
  }
</script>

<template>
    <main>
        <div class="screen_view" v-if="dishPostData != null">
          <!-- <div class="header_space"></div> -->
          <div class="menu_title view_space" v-if="dishPostData.data != null">
              <span>
                  <span style="vertical-align: top" class="small_font_size">
                      Author : 
                  </span>
                  <span class="small_font_size link_hover">
                    {{dishPostData.data.user_id}}
                  </span>
                  <span style="vertical-align: top" class="small_font_size">
                      |
                  </span>
                  <span style="vertical-align: top" class="small_font_size">
                      Date : {{dishPostData.data.date_time}}
                  </span>
              </span>
          </div>
            
          <div class="view_space" style="text-align: center;">
            <div>
              <p class="large_font_size view_space">{{dishPostData.dish_name}}</p>
            </div>
            <div v-if="dishPostData.data">
              <div class="editable_item">
                <p style = "font-weight: bold;" class="medium_font_size view_space">{{dishPostData.data.type}}</p>
                <div class="editable_group">
                  <img class="editable_item_button" const src="../assets/icons/edit_square.png" v-on:click="editDishType()"/>
                </div>
              </div>
              <div class="editable_item">
                <p class="medium_font_size view_space">{{dishPostData.data.short_detail}}</p>
                <div class="editable_group">
                  <img class="editable_item_button" const src="../assets/icons/edit_square.png" v-on:click="editDishShortDetail()"/>
                </div>
              </div>
              
              <!-- Ingredients required section -->
              <div class="view_space">
                <p class="medium_font_size">Required Ingredients:</p>
                <ingredient_available_editable 
                  :ingredientsId="dishPostData.data.ingredients"
                  :onChanged="changeIngredientsUsing" 
                />
              </div>
              
              <display_block :datas="dishPostData.data.display_blocks" :isEditable="true" 
                :onMoveUp="moveUpBlock" :onMoveDown="moveDownBlock" :onEdit="editDishBlock" 
                :onAdd="addBlock" :onRemove="removeBlock"/>
            </div>
          </div>
          <div class="view_space">
            <div class="splitter"></div>
          </div>
          <block_import_box :onImportBlock="importBlock" />
          <div class="view_space" style="text-align: center;">
            <p class="small_font_size splitter_info">Preview item</p>
          </div>
          <sample_preview_box v-if="dishPreviewData" :onChangeBackgroundImage="onChangeBackgroundImage" :preview_data="dishPreviewData" />
          <div class="view_space" style="text-align: center;">
            <p class="small_font_size splitter_info">Finished</p>
          </div>
          <div class="view_space" style="text-align: center;">
            <input class="action_button small_font_size" type="button" value="Save" v-on:click="onSave"/>
          </div>
          <div class="view_space" style="text-align: center;">
            <input class="action_button small_font_size" type="button" value="Cancel" v-on:click="onCancel"/>
          </div>
        </div>
    </main>
    <edit_box v-if="editType != enums.EditType.None" :editType="editType" :dataEditing="dataEditing" 
      :onEdited="boxEdit_OnEdited" :onClose="boxEdit_OnClose"/>
</template>

<style>
  .main_info{
    display: block;
    width: 100%;
    text-align: center;
  }
  .detail_info{
    display: block;
    width: 100%;
  }
</style>