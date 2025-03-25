<script setup>
  import preview_item from './preview_item.vue'

  const props = defineProps({
    title : {
      type : String,
      required: true
    },
    datas: {
      type: Array,
      required: true
    },
    onClick : {
      type : Function,
      required: true
    }
  })
</script>

<template>
  <div class="item_preview_contain">
    <div class="item_divide medium_font_size">
      {{title}}
    </div>
    <div class="item_preview" v-for="(item, index) in datas">
      <div>
        <preview_item :previewData = "item" v-on:click="onClick(item.id)" />
      </div>
    </div>
  </div>
</template>

<script>
  export default{
    methods : {
      
    },
  }
</script>

<style>
.item_preview_contain{
    display: block;
}
.item_divide{
    padding: 40px 0;
    text-align: center;
}
.item_divide::before{
    content: '';
    display: inline-block;
    background-color: rgba(0, 0, 0, 0.8);
    height: 1px;
    width: 30%;
    margin-right: 10px!important;
    vertical-align: middle;
}
.item_divide::after{
    content: '';
    display: inline-block;
    background-color: rgba(0, 0, 0, 0.8);
    height: 1px;
    width: 30%;
    margin-left: 10px!important;
    vertical-align: middle;
}
.item_preview{
    display: inline-block;
    width: 25%;
    padding: 10px;
}
.item_preview>div {
    position: relative;
    width: 100%;
    padding-bottom: 100%;
}
</style>