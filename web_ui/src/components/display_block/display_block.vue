<script setup>
  import text_block from './text_block.vue'
  import image_block from './image_block.vue'

  const props = defineProps({
    datas: {
      type: Array,
      required: true
    },
    isEditable : {
      type : Boolean,
      default : false
    },
    onMoveUp : {
      type : Function,
      default : null
    },
    onMoveDown : {
      type : Function,
      default : null
    },
    onEdit : {
      type : Function,
      default : null
    },
    onAdd : {
      type : Function,
      default : null
    },
    onRemove : {
      type : Function,
      default : null
    }
  })
</script>

<template>
    <div :class="isEditable ? 'view_space editable_item' : 'view_space'" v-for="(item, index) in datas">
      <text_block v-if="item.type == 'text'" :textData="item" />
      <image_block v-else-if="item.type == 'image'" :imageData="item" />
      <div v-if="isEditable" class="editable_group">
        <img v-if="onMoveUp != null" class="editable_item_button" const src="../../assets/icons/up_arrow_square.png" v-on:click="onMoveUp(item, index)"/>
        <img v-if="onMoveDown != null" class="editable_item_button" const src="../../assets/icons/down_arrow_square.png" v-on:click="onMoveDown(item, index)"/>
        <img v-if="onEdit != null" class="editable_item_button" const src="../../assets/icons/edit_square.png" v-on:click="onEdit(item, index)"/>
        <img v-if="onAdd != null" class="editable_item_button" const src="../../assets/icons/plus_square.png" v-on:click="onAdd(item, index)"/>
        <img v-if="onRemove != null" class="editable_item_button" const src="../../assets/icons/minus_square.png" v-on:click="onRemove(item, index)"/>
      </div>
    </div>
</template>

<script>

</script>
