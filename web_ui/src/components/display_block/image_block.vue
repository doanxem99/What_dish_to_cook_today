<script>
import serverData from '../../assets/js/server_info.js'

export default {
  props: {
    imageData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      serverData: serverData
    }
  },
}
</script>

<template>
    <div class="view_space">
      <img :src = "serverData.serverUrl + imageData.src" style="width : 70%"/>
      <p v-if="imageData.text != ''" :style="{ fontSize: imageData.font_size + 'px', fontWeight : imageData.font_weight, textAlign : imageData.text_align }">{{imageData.text}}</p>
    </div>
</template>
