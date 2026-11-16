<script>
import preview_item from './preview/preview_item.vue';
import ingredient_object_available from './ingredient_object_available.vue';

export default {
    components: {
        preview_item,
        ingredient_object_available,
    },
    props: {
      dataDish: {
        type: Object,
        required: true,
      }  
    },
    methods: {
        moveToDishDetail: function() {
            this.$router.push({ path: '/dish_detail/', query: {dish_post_id: this.dataDish._id}})
        }
    },
}
</script>

<template>
    <div class="flex flex-row w-full h-80 gap-5">
        <div class=" flex-1/2 flex-col p-5 gap-0.5">
            <div class=" flex justify-center">
                <p class=" text-4xl text-orange-400 mb-5">
                    DISH OF THE DAY
                </p>
            </div>
            <div class="flex">
                <div class=" text-3xl link_hover" v-on:click="moveToDishDetail">
                    {{ dataDish.name }}
                </div>
            </div>
            <div class=" text-base flex gap-60 sm:flex-row max-sm:flex-col">
                <div>
                    <p> {{ dataDish.username }}</p>
                </div>
                <!-- Display time only date, not time -->
                <p class="flex underline"> Date: {{ new Date(dataDish.date_time).toLocaleDateString() }}</p>
            </div>
            <ingredient_object_available :ingredientObjects="dataDish.ingredients" />
            <p> Views: {{ dataDish.views }} </p>
            <p> Points: {{ dataDish.points }} </p>
            <p> Comments: {{ dataDish.comments }} </p>
        </div>
        <div class=" flex-1/2">
            <preview_item :previewData="dataDish" :onclick="moveToDishDetail"/>  
        </div>
    </div>
</template>