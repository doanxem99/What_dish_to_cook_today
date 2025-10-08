<script>
    import serverInfo from '../../assets/js/server_info.js'
    
    export default{
    props: {
        previewData: {
          type: Object,
          required: true
        }
      },
      methods : {
        getFullPath : function (path){
          return serverInfo.getFullPath(path);
        },
      },
    }
  </script>
  
  <template>
    <div class="preview_item">
      <div class="preview_item_image rounded-3xl" :style="{'background-image': 'url(' + getFullPath(previewData.profile_image) + ')'}"></div>
      <div class="preview_item_info rounded-3xl">
        <p class="preview_item_more small_font_size">More</p>
        <div class="preview_item_detail">
          <p class="medium_font_size">{{previewData.name}}</p>
          <p class="small_font_size">{{previewData.short_detail}}</p>
        </div>
      </div>
    </div>
  </template>
  
  <style>
    .preview_item{
        position: absolute;
        width: 100%;
        height: 100%;
        overflow:hidden;
        cursor: pointer;
    }
    .preview_item:hover .preview_itemimage{
        scale: 1.1;
    }
    .preview_item:hover .preview_item_info
    {
        opacity: 1;
    }
    .preview_item:hover .preview_item_more
    {
        opacity: 1;
    }
    .preview_item_image{
        position: absolute;
        width: 100%;
        height: 100%;
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;
        transition: all ease-in-out 0.3s;
    }
    .preview_item_info{
        background-color: rgba(0, 0, 0, 0.80);
        position: absolute;
        left: 0;right: 0;bottom: 0;
        height: 45%;
        padding: 10px;
        opacity: 0.7;
        transition: all ease-in-out 0.3s;
    }
    .preview_item_more{
        position: absolute;
        left: 0;right: 0;top: -25px;
        margin: auto;
        width: 50px;
        height: 50px;
        text-align: center;
        line-height: 50px;
        border-radius: 100px;
        display: inline-block;
        color: white;
        background-color: rgba(0, 0, 0, 0.80);
        opacity: 0;
        transition: all ease-in-out 0.3s;
    }
    .preview_item_detail p{
        color: white;
        padding-bottom: 5px;
    }
</style>