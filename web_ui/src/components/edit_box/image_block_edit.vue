<script>
  import serverData from '../../assets/js/server_info.js'
  import axios from 'axios';

  export default{
    components : {
    },
    props : {
      dataEditing : {
        required: true,
      },
      onEdited : {
        type : Function,
        required: true,
      },
      onClose : {
        type : Function,
        required: true,
      }
    },
    data() {
      return {
          serverData,
          dataEdited : null,
      }
    },
    methods : {
      getDataEdited : function(){
        if(this.dataEdited == null){
          this.dataEdited = JSON.parse(JSON.stringify(this.dataEditing));
        }
        return this.dataEdited;
      },
      storeData : function(){
          //Get this.dataEdited(If not exist)
          this.getDataEdited();

          //Store data
          //this.dataEdited.src
          this.dataEdited.text = this.$refs.inputfield_image_block_text.value;
          this.dataEdited.font_size = this.$refs.inputfield_image_block_font_size.value;
          this.dataEdited.color = this.$refs.inputfield_image_block_font_color.value;
      },
      applyData : function(){
        //Store data
        this.storeData();
        //Trigger event edited
        this.onEdited(this.dataEdited);
        //Unset dataEdited
        this.dataEdited = null;
        //Close box edit
        this.onClose();
      },
      cancelData : function(){
        //Unset dataEdited
        this.dataEdited = null;
        //Close box edit
        this.onClose();
      },
      openImageUpload : function(){
        this.$refs.image_upload.click();
      },
      uploadImage : function(){
        let image = this.$refs.image_upload.files[0];
        
        uploadFileToServer(image, (_status) => {
          //Unset file in file_upload
          this.$refs.image_upload.value = null;
          this.$refs.image_upload.files = null;
          //If success, we change image
          if(_status.isSuccess){
            this.dataEdited.src = _status.path;
          }
        });
      },
    },
    mounted : function(){
      
    }
  }
  
  //*Server API
  const uploadFileToServer = function(_images, _callBack){
    const formData = new FormData();
    formData.append('file', _images);
    const headers = { 'Content-Type': 'multipart/form-data' };
    axios.post(serverData.serverUrl + 'api/gallery_upload/temporary', formData, { headers }).then((res) => {
      _callBack(res.data);
    });
  }
</script>
  
<template>
    <div class="box_edit dialog">
      <div>
        <div class="view_space">
            <div class="view_space">
                <div class="attribute_image">
                  <div v-on:click="openImageUpload">
                      <img v-bind:src = "serverData.serverUrl + getDataEdited().src" />
                      <div class="attribute_image_change">
                      <span class="small_font_size">Change</span>
                      </div>
                  </div>
                  <input ref="image_upload" class="hidden_inputfield" type="file" accept="image/png, image/gif, image/jpeg" v-on:change="uploadImage">
                </div>
            </div>
            <div class="view_space">
                <input ref="inputfield_image_block_text" class="action_inputfield" style="text-align: center;" 
                  v-bind:style="{fontSize : getDataEdited().font_size  + 'px', color : getDataEdited().color}"
                  type="text" v-bind:value="getDataEdited().text" />
            </div>
            <div class="attribute_contain view_space">
                <div class="attribute_group">
                  <span class="small_font_size attribute_text">Font size : </span>
                  <input ref="inputfield_image_block_font_size" class="attribute_input" type="text" v-bind:value = "getDataEdited().font_size" v-on:change="storeData"/>
                </div>
                <div class="attribute_group">
                  <span class="small_font_size attribute_text">Font color : </span>
                  <input ref="inputfield_image_block_font_color" class="attribute_input" type="color" v-bind:value = "getDataEdited().color" v-on:change="storeData"/>
                </div>
            </div>
        </div>

        <div class="view_space" style="text-align: center;">
          <p class="small_font_size splitter_info">Apply / Cancel</p>
        </div>
        <div class="view_space" style="text-align: center;">
          <input class="action_button small_font_size" type="button" value="Apply" v-on:click="applyData"/>
        </div>
        <div class="view_space" style="text-align: center;">
          <input class="action_button small_font_size" type="button" value="Cancel" v-on:click="cancelData"/>
        </div>
      </div>
    </div>
</template>
  
<style>
  .box_edit{
    z-index: 2!important;
  }
  .attribute_contain{
    text-align: left;
  }

  .attribute_group{
    display: inline-block;
    padding: 0 20px;
  }

  .attribute_text{
    display: inline;
    vertical-align: middle;
  }
  .attribute_input{
    display: inline;
    width: 50px;
    height: 30px;
    vertical-align: middle;
  }
  .attribute_image{
    text-align: center;
  }
  .attribute_image>div{
    position: relative;
    width: 70%;
    margin: auto;
    cursor: pointer;
  }
  .attribute_image img{
    width: 100%;
  }
  .attribute_image_change{
    position: absolute;
    top: 0;left: 0;right: 0;bottom: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    opacity: 0;
    transition: all ease-in-out 0.3s;
  }
  .attribute_image_change:hover
  {
      opacity: 1;
  }
  .attribute_image_change:hover >span
  {
      opacity: 1;
  }
  .attribute_image_change>span{
      position: absolute;
      top: 0;left: 0;right: 0;bottom: 0;
      margin: auto;
      width: 70px;
      height: 70px;
      text-align: center;
      line-height: 70px;
      border-radius: 100px;
      border: solid white;
      display: inline-block;
      color: white;
      opacity: 0;
      transition: all ease-in-out 0.3s;
  }
</style>