<script>
  import ingredientServerAction from '../assets/js/ingredient_server_action.js'
  
  export default{
    props : {
        onSelected : {
            type : Function,
            required : true,
        },
    },
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

<template>
    <div class="view_space">
        <input class="input_field" type = "text" v-model = "keySearch" v-on:keyup="onChangeKeySearch">
    </div>
    <div class="view_space h-30 overflow-scroll">
      <button class="btn m-0.5" type="button"
        v-for="(item, index) in ingredientsFound" v-on:click="onSelected(item)">{{item.name}}</button>
    </div>
</template>
