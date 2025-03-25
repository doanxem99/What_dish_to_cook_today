<script setup>
    import preview_item from '../components/preview/preview_item.vue'
    const props = defineProps({
        onChangeBackgroundImage : {
            type : Function,
            required : true,
        },
        preview_data : {
            required : true,
        },
    })
</script>

<template>
<div class="sample_preview_box view_space">
    <div class="view_space" v-if="preview_data != null">
        <div class="sample_preview_item_layout sample_preview_medium_item">
            <div>
                <div>
                    <preview_item :previewData = "preview_data" />
                </div>
            </div>
        </div>
        <div class="sample_preview_item_layout sample_preview_big_item">
            <div>
                <div>
                    <preview_item :previewData = "preview_data" />
                </div>
            </div>
        </div>
        <div class="sample_preview_item_layout sample_preview_small_item">
            <div>
                <div>
                    <preview_item :previewData = "preview_data" />
                </div>
            </div>
        </div>
    </div>
    <div class="view_space" style="text-align: center;">
        <input class="small_font_size action_button" type="button" value="Change image background" v-on:click="openImageBackgroundUpload" />
        <input ref="image_upload" class="hidden_inputfield" type="file" accept="image/png, image/gif, image/jpeg"
         v-on:change="changeImageBackground">
    </div>
    </div>
</template>

<script>
    import galleryServerAction from '../assets/js/gallery_server_action.js'

    export default{
        data() {
            return {
                
            }
        },
        methods : {
            
            openImageBackgroundUpload : function(){
                this.$refs.image_upload.click();
            },
            changeImageBackground : function(){
                let image = this.$refs.image_upload.files[0];
                
                galleryServerAction.uploadTempraryFile(image, (_status) => {
                    //Unset file in file_upload
                    this.$refs.image_upload.value = null;
                    this.$refs.image_upload.files = null;
                    //If success, we change image
                    if(_status.isSuccess){
                        this.props.onChangeBackgroundImage(_status.path);
                    }
                });
            },
        },
        mounted : function(){
            
        }
    }
</script>

<style>
    .sample_preview_box{
        padding: 0 20px;
    }
    .sample_preview_item_layout {
        display: inline-block;
        width: 100%;
    }
    .sample_preview_item_layout>div {
        position: relative;
        width: 100%;
        padding-bottom: 100%;
        text-align: left;
    }
    .sample_preview_item_layout>div>div {
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        bottom: 10px;
    }
    .sample_preview_small_item{
        max-width: 27%;
    }
    .sample_preview_medium_item{
        max-width: 33%;
    }
    .sample_preview_big_item{
        max-width: 40%;
    }
</style>