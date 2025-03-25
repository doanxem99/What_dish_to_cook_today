<script setup>
  import display_block from '../components/display_block/display_block.vue'
  import block_import_box from '../components/block_import_box.vue'
  import sample_preview_box from '../components/sample_preview_box.vue'
  import edit_box from '../components/edit_box/edit_box.vue'
</script>

<template>
    <main>
        <div class="screen_view" v-if="ingredientPostData != null">
          <div class="header_space"></div>
          <div class="menu_title view_space" v-if="ingredientPostData.data != null">
              <span>
                  <span style="vertical-align: top" class="small_font_size">
                      Author : 
                  </span>
                  <span class="small_font_size link_hover">
                    {{ingredientPostData.data.user_id}}
                  </span>
                  <span style="vertical-align: top" class="small_font_size">
                      |
                  </span>
                  <span style="vertical-align: top" class="small_font_size">
                      Date : {{ingredientPostData.data.date_time}}
                  </span>
              </span>
          </div>
            
          <div class="view_space" style="text-align: center;">
            <div>
              <p class="large_font_size view_space">{{ingredientPostData.ingredient_name}}</p>
            </div>
            <div v-if="ingredientPostData.data">
              <div class="editable_item">
                <p style = "font-weight: bold;" class="medium_font_size view_space">{{ingredientPostData.data.type}}</p>
                <div class="editable_group">
                  <img class="editable_item_button" const src="../assets/icons/edit_square.png" v-on:click="editIngredientType()"/>
                </div>
              </div>
              <div class="editable_item">
                <p class="medium_font_size view_space">{{ingredientPostData.data.short_detail}}</p>
                <div class="editable_group">
                  <img class="editable_item_button" const src="../assets/icons/edit_square.png" v-on:click="editIngredientShortDetail()"/>
                </div>
              </div>
              <display_block :datas = "ingredientPostData.data.display_blocks" :isEditable = "true" 
                :onMoveUp = "moveUpBlock" :onMoveDown = "moveDownBlock" :onEdit = "editIngredientBlock" 
                :onAdd = "addBlock" :onRemove = "removeBlock"/>
            </div>
          </div>
          <div class="view_space">
            <div class="splitter"></div>
          </div>
          <block_import_box :onImportBlock = "importBlock" />
          <div class="view_space" style="text-align: center;">
            <p class="small_font_size splitter_info">Preview item</p>
          </div>
          <sample_preview_box v-if="ingredientPreviewData" :onChangeBackgroundImage="onChangeBackgroundImage" :preview_data="ingredientPreviewData" />
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
    <edit_box v-if="editType != enums.EditType.None" :editType = "editType" :dataEditing = "dataEditing" 
      :onEdited = "boxEdit_OnEdited" :onClose = "boxEdit_OnClose"/>
</template>
  
<script>
  import enums from '../assets/js/enums.js'
  import profileEnum from '../assets/js/profile_enum.js'
  import ingredientServerAction from '../assets/js/ingredient_server_action.js'

  export default{
    data() {
      return {
        ingredientPostData : null,
        ingredientPreviewData : null,
        editType : enums.EditType.None,
        dataEditing : null,
      }
    },
    methods : {
      editIngredientType : function(){
        this.editType = enums.EditType.Type;
        this.dataEditing = this.ingredientPostData.data.type;
      },
      editIngredientShortDetail : function(){
        this.editType = enums.EditType.ShortDetail;
        this.dataEditing = this.ingredientPostData.data.short_detail;
      },
      editIngredientBlock : function(_item, _index){
        this.editType = enums.EditType.Block;
        this.dataEditing = _item;
      },
      moveUpBlock : function(_item, _index){
        if(_index > 0){
          let val = this.ingredientPostData.data.display_blocks[_index];
          this.ingredientPostData.data.display_blocks[_index] =  this.ingredientPostData.data.display_blocks[_index - 1];
          this.ingredientPostData.data.display_blocks[_index - 1] = val;
        }
      },
      moveDownBlock : function(_item, _index){
        if(_index < this.ingredientPostData.data.display_blocks.length - 1){
          let val = this.ingredientPostData.data.display_blocks[_index];
          this.ingredientPostData.data.display_blocks[_index] =  this.ingredientPostData.data.display_blocks[_index + 1];
          this.ingredientPostData.data.display_blocks[_index + 1] = val;
        }
      },
      boxEdit_OnEdited : function(_value){
        if(this.editType == enums.EditType.Type){
          this.ingredientPostData.data.type = _value;
        }
        else if(this.editType == enums.EditType.ShortDetail){
          this.ingredientPostData.data.short_detail = _value;
          this.ingredientPreviewData.short_detail = _value;
        }
        else if(this.editType == enums.EditType.Block){
          if(this.dataEditing.type == 'text'){
            this.dataEditing.text = _value.text;
            this.dataEditing.font_size = _value.font_size;
          }
          else if(this.dataEditing.type == 'image'){
            this.dataEditing.src = _value.src;
            this.dataEditing.text = _value.text;
            this.dataEditing.font_size = _value.font_size;
          }
        }
      },
      boxEdit_OnClose : function(){
        this.editType = enums.EditType.None;
        this.dataEditing = null;
      },
      addBlock : function(_item, _index){
        let newItem = JSON.parse(JSON.stringify(_item));
        this.ingredientPostData.data.display_blocks.splice(_index + 1, 0, newItem);
      },
      removeBlock : function(_item, _index){
        this.ingredientPostData.data.display_blocks.splice(_index, 1);
      },
      importBlock : function(_data){
        this.ingredientPostData.data.display_blocks.push(_data);
      },
      onChangeBackgroundImage : function(_data){
        this.ingredientPostData.data.profile_image = _data;
        this.ingredientPreviewData.profile_image = _data;
      },
      onSave : function(){
        //First, we save data
        //Then, we move back to ingredient_detail
        ingredientServerAction.createIngredientPostProfile(this.ingredientPostData, (_response)=>{
            if(_response.status == profileEnum.ProfileStatus_PostCreate.CreatingSuccess ||
              _response.status == profileEnum.ProfileStatus_PostCreate.EditingSuccess){
                //We move to ingredient_detail
                this.$router.push({ path: '/ingredient_detail', query: { ingredient_id: this.$route.query.ingredient_id }});
            }
            else{
                console.log("Error : " + _response.detail);
                //this.status = _response.detail;
            }
        });
      },
      onCancel : function(){
        //We move to ingredient_detail
        this.$router.push({ path: '/ingredient_detail', query: { ingredient_id: this.$route.query.ingredient_id }});
      }
    },
    mounted : function(){
      let ingredientId = this.$route.query.ingredient_id;
      //Search ingredients from server
      ingredientServerAction.getIngredientProfile(ingredientId, (_response) => {
        if(_response.status == profileEnum.ProfileStatus_Detail.Success){
          //Save data
          this.ingredientPostData = {
            "ingredient_id" : _response.data._id,
            "ingredient_name" : _response.data.name,
            "data" : null
          }
          //Load best ingredient post id
          let bestPostId = _response.data.best_post_id;
          ingredientServerAction.getIngredientPostProfile(bestPostId, (_response) => {
            if(_response.status == profileEnum.ProfileStatus_PostDetail.Success){
              //Save data
              this.ingredientPostData.data = {
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
              this.ingredientPreviewData = {
                "name" : this.ingredientPostData.ingredient_name,
                "short_detail" : _response.data.short_detail,
                "profile_image" : _response.data.profile_image
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
      });
    }
  }
</script>

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