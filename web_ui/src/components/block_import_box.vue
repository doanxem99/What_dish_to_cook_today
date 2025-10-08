<script>
    import serverData from '../assets/js/server_info.js'
    import templateServerAction from '../assets/js/template_server_action.js'
    
    export default{
      props: {
        onImportBlock : {
            type : Function,
            required: true,
        }
      },
      data() {
        return {
            serverData,
            importSlideData : [
                {"type" : "import_title", "info" : "Add title", "image" : "public/pictures/icons/import_text_block.png"},
                {"type" : "import_info", "info" : "Add info", "image" : "public/pictures/icons/import_text_block.png"},
                {"type" : "import_image", "info" : "Add image", "image" : "public/pictures/icons/import_image_block.png"},
            ],
            indexSelected : 0
        }
      },
      methods : {
        addBlock : function(){
            let importData = this.importSlideData[this.indexSelected];
            if(importData.type == "import_title"){
                this.onImportBlock({"type":"text","text":"Title","font_size":22,"text_align":"left","color":"black"});
            }
            else if(importData.type == "import_info"){
                this.onImportBlock({"type":"text","text":"Info","font_size":14,"text_align":"left","color":"black"});
            }
            else if(importData.type == "import_image"){
              templateServerAction.getImageBlockTemplate((_data) => {
                this.onImportBlock(_data);
              });
            }
        },
        setIndexSelected : function(_index){
            this.indexSelected = _index;
        }
      },
      mounted : function(){
        
      }
    }
</script>
  
<template>
    <div class="box_import view_space">
        <div class="box_import_slide view_space">
            <div class="box_import_slide_box">
                <div class="box_import_slide_item" v-for="(item, index) in importSlideData">
                    <img v-if="indexSelected == index" class="box_import_pointer" src="../assets/icons/down_arrow.png"  draggable="false"/>
                    <img class="box_import_slide_image" v-bind:src="serverData.serverUrl + item.image" v-on:click="setIndexSelected(index)" draggable="false"/>
                    <p class="small_font_size">{{item.info}}</p>
                </div>
            </div>
        </div>
        <div class="view_space">
            <input class="action_button small_font_size" type="button" value="Add" v-on:click="addBlock"/>
        </div>
    </div>
</template>
  
<style>
  .box_import{
    /*border: solid 1px black;*/
    padding: 0 20px;
  }
  .box_import_slide{
    position: relative;
    text-align: center;
  }
  .box_import_slide_box{
    display: inline-block;
    height: 100%;
  }
  .box_import_slide_item{
    vertical-align: bottom;
    position: relative;
    display: inline-block;
    padding: 0px 20px;
  }
  .box_import_slide_image{
    display:block;
    height: 100px;
    width: 100px;
    cursor: pointer;
  }

  .box_import_pointer{
    display: inline-block;
    width: 15px;
    height: 15px;
  }
  
</style>