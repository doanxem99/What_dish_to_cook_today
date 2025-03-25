<script setup>
    const props = defineProps({
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
    })
  </script>
    
  <template>
      <div class="box_edit dialog">
        <div>
          <div class="view_space">
              <div class="view_space">
                <textarea ref="inputfield_name" class="action_textarea medium_font_size" 
                  style="text-align: center;" >{{dataEditing}}</textarea>
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
    
  <script>
    export default{
      data() {
        return {
            
        }
      },
      methods : {
        applyData : function(){
          //Trigger event edited
          this.props.onEdited(this.$refs.inputfield_name.value);
          //Close box edit
          this.props.onClose();
        },
        cancelData : function(){
          //Unset dataEdited
          this.dataEdited = null;
          //Close box edit
          this.props.onClose();
        },
      },
      mounted : function(){
        
      }
    }
  </script>
    
  <style>
    .box_edit{
      z-index: 2!important;
    }
  </style>