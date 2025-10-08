<script>
  import name_edit from './name_edit.vue'
  import short_detail_edit from './short_detail_edit.vue'
  import text_block_edit from './text_block_edit.vue'
  import image_block_edit from './image_block_edit.vue'
  import ingredients_edit from './ingredients_edit.vue'

  import enums from '../../assets/js/enums.js'

  export default {
    components: {
      name_edit,
      short_detail_edit,
      text_block_edit,
      image_block_edit,
      ingredients_edit
    },
    data() {
      return {
        enums,
      }
    },
    props: {
      editType: {
        type: Number,
        required: true
      },
      dataEditing: {
        type: Object,
        required: true
      },
      onEdited: {
        type: Function,
        required: true
      },
      onClose: {
        type: Function,
        required: true
      }
    }
  }
</script>
  
<template>
  <name_edit v-if="editType == enums.EditType.Name" 
    :dataEditing = "dataEditing" :onEdited = "onEdited" :onClose = "onClose" />
  <short_detail_edit v-else-if="editType == enums.EditType.Type" 
    :dataEditing = "dataEditing" :onEdited = "onEdited" :onClose = "onClose" />
  <short_detail_edit v-else-if="editType == enums.EditType.ShortDetail" 
    :dataEditing = "dataEditing" :onEdited = "onEdited" :onClose = "onClose" />
  <ingredients_edit v-else-if="editType == enums.EditType.IngredientUsing" 
    :dataEditing = "dataEditing" :onEdited = "onEdited" :onClose = "onClose" />
  <div v-else-if="editType == enums.EditType.Block">
    <text_block_edit  v-if="dataEditing.type == 'text'" 
        :dataEditing = "dataEditing" :onEdited = "onEdited" :onClose = "onClose" />
    <image_block_edit  v-else-if="dataEditing.type == 'image'" 
        :dataEditing = "dataEditing" :onEdited = "onEdited" :onClose = "onClose" />
  </div>
</template>