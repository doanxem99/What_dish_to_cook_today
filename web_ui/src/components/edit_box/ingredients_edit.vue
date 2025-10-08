<script>
    import ingredient_input from '../ingredient_input.vue'
    import ingredient_object_available from '../ingredient_object_available.vue'

    export default{
      components : {
        ingredient_input,
        ingredient_object_available,
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
            ingredientsAvailable : [],
        }
      },
      methods : {
        applyData : function(){
            //Trigger event edited
            let ingredients = [];
            _ingredients.forEach(item => {
                ingredients.push(item.id);
            });
            this.onEdited(ingredients.join("-"));
            //Close box edit
            this.onClose();
        },
        cancelData : function(){
          //Unset dataEdited
          this.dataEdited = null;
          //Close box edit
          this.onClose();
        },
        onAddIngredient : function(_item){
            if(!this.ingredientsAvailable.find(element => element.id == _item.id)){
                this.ingredientsAvailable.push(_item);
                //Invoke onChanged
                this.onChanged(this.ingredientsAvailable);
            }
        },
        onRemoveIngredient : function(_item){
            let index = this.ingredientsAvailable.indexOf(_item);
            if (index !== -1) {
            this.ingredientsAvailable.splice(index, 1);
            //Invoke onChanged
            this.onChanged(this.ingredientsAvailable);
            }
        },
      },
      mounted : function(){
        //Search short detail ingredient
        if(this.dataEditing != null && this.dataEditing.length > 0){
            ingredientServerAction.searchIngredientById(this.dataEditing, (_ingredients) => {
                this.ingredientsAvailable = _ingredients;
            });
        }
      }
    }
  </script>
    
  <template>
      <div class="box_edit dialog">
        <div>
            <ingredient_object_available :ingredientObjects = "ingredientsAvailable" :onSelect = "onRemoveIngredient" />
            <ingredient_input :onSelected = "onAddIngredient"/>
  
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
  </style>