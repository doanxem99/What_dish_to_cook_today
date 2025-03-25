<script setup>
  const props = defineProps({
    ingredientObjects: {
      type: Array,
      required: true
    },
    onSelect : {
        type : Function
    }
  })
</script>

<template>
    <div class="view_space">
      <button class="ingredient_button ingredient_button_disable small_font_size" type="button" 
        v-for="(item, index) in ingredientObjects" v-on:click="onSelect(item)">{{item.name}}</button>
    </div> 
</template>

<script>
  import ingredientServerAction from '../assets/js/ingredient_server_action.js'
  
  export default{
    data(){
        return {
            
        }
    },
    methods : {
        
    },
    mounted : function(){
        
    }
  }
</script>
