<script setup>
  const props = defineProps({
    onSelected : {
        type : Function,
        required : true,
    },
  })
</script>

<template>
    <div class="view_space">
        <input class="input_field" type = "text" v-model = "keySearch" v-on:keyup="onChangeKeySearch">
    </div>
    <div class="view_space">
      <button class="ingredient_button ingredient_button_disable small_font_size" type="button"
        v-for="(item, index) in ingredientsFound" v-on:click="onSelected(item)">{{item.name}}</button>
    </div>
</template>

<script>
  import ingredientServerAction from '../assets/js/ingredient_server_action.js'
  
  export default{
    data(){
        return {
            keySearch : '',
            ingredientsFound : [],
        }
    },
    methods : {
      onChangeKeySearch : function (){
        ingredientServerAction.searchIngredient(this.keySearch, (_data) =>{
          this.ingredientsFound = _data;
        });
      },
    },
    mounted : function(){
        this.onChangeKeySearch();
    }
  }
</script>
