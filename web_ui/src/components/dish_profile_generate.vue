<script setup>
    import preview_item from './preview/preview_item.vue'
    import ingredient_available_editable from '../components/ingredient_available_editable.vue'

    const props = defineProps({
        onRefesh : {
            type : Function,
            required : true,
        },
        onCancel : {
            type : Function,
            required : true,
        },
    })
</script>
    
<template>
    <div class="box_edit dialog">
        <div>
            <div class="view_space">
                <p class="big_font_size">Add dish</p>
            </div>
            <div v-if="dishData != null">
                <div class="half_split_column">
                    <div class="view_space">
                        <input ref="name" class="action_inputfield big_font_size" style="text-align: center;" type="text"
                            v-bind:value="dishData.name" v-on:change="changeInfo" />
                    </div>
                    <div class="view_space">
                        <ingredient_available_editable :ingredientsId = "dishData.ingredients" :onChanged="changeIngredientsUsing"/>
                    </div>
                    <div class="view_space">
                        <input ref="shortDetail" class="action_inputfield medium_font_size" style="text-align: center;" type="text"
                            v-bind:value="dishData.short_detail" v-on:change="changeInfo" />
                    </div>
                    <div class="view_space">
                        <input class="small_font_size action_button" type="button" value="Change image" v-on:click="openImageUpload" />
                        <input ref="image_upload" class="hidden_inputfield" type="file" accept="image/png, image/gif, image/jpeg"
                         v-on:change="changeImage">
                    </div>
                </div>
                <div class="half_split_column">
                    <div class="sample_preview_item view_space">
                        <div>
                            <preview_item :previewData = "dishData" />
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
</template>

<script>
    import galleryServerAction from '../assets/js/gallery_server_action.js'
    import dishServerAction from '../assets/js/dish_server_action.js'
    import templateServerAction from '../assets/js/template_server_action.js'
    import profileEnum from '../assets/js/profile_enum.js'

    export default{
        data() {
            return {
                dishData : null,
                status : null
            }
        },
        methods : {
            createAndEditData : function(){
                //Save dish to server
                dishServerAction.createDishProfile(this.dishData, (_response)=>{
                    if(_response.status == profileEnum.ProfileStatus_Create.Success){
                        //We move to dish_edit
                        this.$router.push({ path: '/dish_edit', query: { dish_id: _response.dish_id }});
                    }
                    else{
                        console.log("Error : " + _response.detail);
                        this.status = _response.detail;
                    }
                });
            },
            createData : function(){
                //Save dish to server
                dishServerAction.createDishProfile(this.dishData, (_response)=>{
                    if(_response.status == profileEnum.ProfileStatus_Create.Success){
                        this.props.onRefesh();
                    }
                    else{
                        console.log("Error : " + _response.detail);
                        this.status = _response.detail;
                    }
                });
            },
            changeInfo : function(){
                this.dishData.name = this.$refs.name.value;
                this.dishData.short_detail = this.$refs.shortDetail.value;
            },
            openImageUpload : function(){
                this.$refs.image_upload.click();
            },
            changeIngredientsUsing : function(_ingredients){
                this.dishData.ingredients = [];
                _ingredients.forEach(item => {
                    this.dishData.ingredients.push(item.id);
                });
            },
            changeImage : function(){
                let image = this.$refs.image_upload.files[0];
                
                galleryServerAction.uploadTempraryFile(image, (_status) => {
                    //Unset file in file_upload
                    this.$refs.image_upload.value = null;
                    this.$refs.image_upload.files = null;
                    //If success, we change image
                    if(_status.isSuccess){
                        this.dishData.profile_image = _status.path;
                    }
                });
            },
        },
        mounted : function(){
            templateServerAction.getDishTemplate((_data) => {
                this.dishData = _data;
            });
        }
    }
</script>
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