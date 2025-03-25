<script setup>
    const props = defineProps({
        isOpen : {
            type : Boolean,
            required : true,
            default : false
        },
        onSelected : {
            type : Function,
            required: true
        },
        onCancel : {
            type : Function,
            required: true
        }
    })
</script>
  
<template>
    <div v-if="isOpen == true" class="box_gallery_picker dialog">
        <div>
            <div class="upload_button view_space">
              <div class="upload_file">
                <label for="file_select">
                  <img const src="../assets/icons/upload.png" />
                  <p class="small_font_size">Upload picture</p>
                </label>
                <input ref="file_upload" id="file_select" type="file" accept="image/png, image/gif, image/jpeg" v-on:change="uploadFile">
              </div>
            </div>
            <div class="view_space" style="text-align: center;">
                <p class="small_font_size splitter_info">Gallery</p>
            </div>
            <div class="gallery_contain view_space">
              <div class="gallery_item" v-for="(item, index) in galleryItems">
                <div>
                  <div class="gallery_item_image" 
                    :style="{'background-image': 'url(' + serverData.serverUrl + item.path + ')'}"
                    v-on:click="selectData(item)"></div>
                </div>
              </div>
            </div>
            <div class="view_space" style="text-align: center;">
              <input class="action_button small_font_size" type="button" value="Cancel" v-on:click="cancelSelection"/>
            </div>
        </div>
    </div>
</template>
  
<script>
  import serverData from '../assets/js/server_info.js'
  import axios from 'axios';

    export default{
      data() {
        return {
            galleryItems : []
        }
      },
      methods : {
        selectData : function(_item){
          this.props.onSelected(_item.path);
        },
        cancelSelection : function(){
            this.props.onCancel();
        },
        uploadFile : function(){
          let images = this.$refs.file_upload.files[0];
          
          uploadFileToServer(images, (_status) => {
            //Unset file in file_upload
            this.$refs.file_upload.value = null;
            this.$refs.file_upload.files = null;
            //If success, reload box selection
            if(_status.isSuccess){
              searchGallery((_data)=>{
                this.galleryItems = _data;
              });
            }
          });
        }
      },
      mounted : function(){
        searchGallery((_data)=>{
          this.galleryItems = _data;
        });
      }
    }
    
  //*Server API
  const uploadFileToServer = function(_images, _callBack){
    const formData = new FormData();
    formData.append('file', _images);
    const headers = { 'Content-Type': 'multipart/form-data' };
    axios.post(serverData.serverUrl + 'api/gallery_upload/image', formData, { headers }).then((res) => {
      _callBack(res.data);
    });
  }
  const searchGallery = function(_callBack){
    axios.get(serverData.serverUrl + 'api/gallery_search/image').then(response => {
      if(response.status == 200){
        _callBack(response.data);
      }
    });
  }
</script>
  
<style>
  .box_gallery_picker{
    z-index: 3!important;
  }

  .upload_button{
    
  }
  .upload_button img{
    display: inline-block;
    width: 70px;height: 70px;
    cursor: pointer;
  }

  .gallery_contain{
    padding: 10px;
    min-height: 200px;
    text-align: left;
  }
  
  .gallery_item{
      position: relative;
      display: inline-block;
      width: 20%;
      padding: 5px;
  }
  .gallery_item>div {
      position: relative;
      width: 100%;
      padding-bottom: 100%;
  }
  .gallery_item_image {
      position: absolute;
      width: 100%;
      height: 100%;
      background-repeat: no-repeat;
      background-position: center;
      background-size: cover;
      border: solid black;
      border-radius: 10px;
      cursor: pointer;
  }
</style>