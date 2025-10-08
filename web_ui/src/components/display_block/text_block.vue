<script>
  export default {
    props: {
      textData: {
        type: Object,
        required: true
      }
    }
  }
</script>

<template>
    <div class="view_space">
      <p :style="{ fontSize: textData.font_size + 'px', fontWeight : textData.font_weight, textAlign : textData.text_align, color : textData.color }">
        {{textData.text}}
      </p>
    </div>
</template>