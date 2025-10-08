<script>
    import preview_item from './preview/preview_item.vue'
    import edit_box from '../components/edit_box/edit_box.vue'

    import galleryServerAction from '../assets/js/gallery_server_action.js'
    import ingredientServerAction from '../assets/js/ingredient_server_action.js'
    import templateServerAction from '../assets/js/template_server_action.js'
    import enums from '../assets/js/enums.js'
    import profileEnum from '../assets/js/profile_enum.js'

    export default{
        components : {
            preview_item,
            edit_box
        },
        props : {
            onRefesh : {
                type : Function,
                required : true,
            },
            onCancel : {
                type : Function,
                required : true,
            },
        },
        data() {
            return {
                ingredientData : null,
                enums,
                editType : enums.EditType.None,
                dataEditing : null,
                status : null
            }
        },
        methods : {
            editIngredientName : function(){
                this.editType = enums.EditType.Name;
                this.dataEditing = this.ingredientData.name;
            },
            editIngredientType : function(){
                this.editType = enums.EditType.Type;
                this.dataEditing = this.ingredientData.type;
            },
            editIngredientShortDetail : function(){
                this.editType = enums.EditType.ShortDetail;
                this.dataEditing = this.ingredientData.short_detail;
            },
            boxEdit_OnEdited : function(_value){
                if(this.editType == enums.EditType.Name){
                    this.ingredientData.name = _value;
                }
                else if(this.editType == enums.EditType.Type){
                    this.ingredientData.type = _value;
                }
                else if(this.editType == enums.EditType.ShortDetail){
                    this.ingredientData.short_detail = _value;
                }
            },
            boxEdit_OnClose : function(){
                this.editType = enums.EditType.None;
                this.dataEditing = null;
            },
            createAndEditData : function(){
                //Save ingredient to server
                ingredientServerAction.createIngredientProfile(this.ingredientData, (_response)=>{
                    if(_response.status == profileEnum.ProfileStatus_Create.Success){
                        //We move to ingredient_edit
                        this.$router.push({ path: '/ingredient_edit', query: { ingredient_id: _response.ingredient_id }});
                    }
                    else{
                        console.log("Error : " + _response.detail);
                        this.status = _response.detail;
                    }
                });
            },
            createData : function(){
                //Save ingredient to server
                ingredientServerAction.createIngredientProfile(this.ingredientData, (_response)=>{
                    if(_response.status == profileEnum.ProfileStatus_Create.Success){
                        this.onRefesh();
                    }
                    else{
                        console.log("Error : " + _response.detail);
                        this.status = _response.detail;
                    }
                });
            },
            changeInfo : function(){
                this.ingredientData.name = this.$refs.name.value;
                this.ingredientData.type = this.$refs.type.value;
                this.ingredientData.short_detail = this.$refs.shortDetail.value;
            },
            openImageUpload : function(){
                this.$refs.image_upload.click();
            },
            changeImage : function(){
                let image = this.$refs.image_upload.files[0];
                
                galleryServerAction.uploadTempraryFile(image, (_status) => {
                    //Unset file in file_upload
                    this.$refs.image_upload.value = null;
                    this.$refs.image_upload.files = null;
                    //If success, we change image
                    if(_status.isSuccess){
                        this.ingredientData.profile_image = _status.path;
                    }
                });
            },
        },
        mounted : function(){
            templateServerAction.getIngredientTemplate((_data) => {
                this.ingredientData = _data;
            });
        }
    }
</script>
    
<template>
    <div class="box_edit dialog">
        <div>
            <div class="view_space">
                <p class="big_font_size">Add ingredient</p>
            </div>
            <div v-if="ingredientData != null">
                <div class="half_split_column">
                    <div class="editable_item">
                        <p class="large_font_size view_space">{{ingredientData.name}}</p>
                        <div class="editable_group">
                        <img class="editable_item_button" const src="../assets/icons/edit_square.png" v-on:click="editIngredientName()"/>
                        </div>
                    </div>
                    <div class="editable_item">
                        <p style = "font-weight: bold;" class="medium_font_size view_space">{{ingredientData.type}}</p>
                        <div class="editable_group">
                        <img class="editable_item_button" const src="../assets/icons/edit_square.png" v-on:click="editIngredientType()"/>
                        </div>
                    </div>
                    <div class="editable_item">
                        <p class="medium_font_size view_space">{{ingredientData.short_detail}}</p>
                        <div class="editable_group">
                        <img class="editable_item_button" const src="../assets/icons/edit_square.png" v-on:click="editIngredientShortDetail()"/>
                        </div>
                    </div>
                    <display_block :datas = "ingredientData.display_blocks" :isEditable = "true" 
                        :onMoveUp = "moveUpBlock" :onMoveDown = "moveDownBlock" :onEdit = "editIngredientBlock" 
                        :onAdd = "addBlock" :onRemove = "removeBlock"/>
                    <div class="view_space">
                        <input class="small_font_size action_button" type="button" value="Change image" v-on:click="openImageUpload" />
                        <input ref="image_upload" class="hidden_inputfield" type="file" accept="image/png, image/gif, image/jpeg"
                         v-on:change="changeImage">
                    </div>
                </div>
                <div class="half_split_column">
                    <div class="sample_preview_item view_space">
                        <div>
                            <preview_item :previewData = "ingredientData" />
                        </div>
                    </div>
                </div>
            </div>
            <p v-if="status != null" class="small_font_size" style="color: red;">{{ status }}</p>
            <div class="view_space" style="text-align: center;">
              <p class="small_font_size splitter_info">Create / Cancel</p>
            </div>
            <div class="view_space" style="text-align: center;">
              <input class="action_button small_font_size" type="button" value="Create & edit detail" v-on:click="createAndEditData"/>
            </div>
            <div class="view_space" style="text-align: center;">
              <input class="action_button small_font_size" type="button" value="Create" v-on:click="createData"/>
            </div>
            <div class="view_space" style="text-align: center;">
              <input class="action_button small_font_size" type="button" value="Cancel" v-on:click="onCancel"/>
            </div>
        </div>
    </div>
    <edit_box v-if="editType != enums.EditType.None" :editType = "editType" :dataEditing = "dataEditing" 
      :onEdited = "boxEdit_OnEdited" :onClose = "boxEdit_OnClose"/>
</template>

<style>
    .box_edit{
        z-index: 2!important;
    }

    .sample_preview_item{
        display: inline-block;
        width: 100%;
        max-width: 350px;
    }
    .sample_preview_item>div {
        position: relative;
        width: 100%;
        padding-bottom: 100%;
        text-align: left;
    }
</style>