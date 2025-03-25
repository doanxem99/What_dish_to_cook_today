<script setup>
  const props = defineProps({
    imageData: {
        type : String,
        required: true
    }
  })
</script>

<template>
    <div class="view_space">
      <img :src = "serverData.serverUrl + imageData.src" style="width : 70%"/>
      <p v-if="imageData.text != ''" :style="{ fontSize: imageData.font_size + 'px', fontWeight : imageData.font_weight, textAlign : imageData.text_align }">{{imageData.text}}</p>
    </div>
</template>

<script>
import serverData from '../../assets/js/server_info.js'

</script>
