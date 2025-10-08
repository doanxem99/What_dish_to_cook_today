<script>


export default {
    data() {
        return {

        };
    }, 
    props: {
        data: {
            type: String,
        },

    },
};
</script>

<template>
    <p class=" text-3xl font-bold mb-3"> Comments </p>
    <div class="flex w-2/3 h-35 flex-col gap-2">
        <textarea
        name="comment_box"
        type="text"
        class="border rounded-2xl w-full h-30 p-3">
        </textarea>
        <div class="flex flex-row justify-end gap-3">
        <button class="btn">Cancel</button>
        <button class="btn bg-white text-black">Submit</button>
        </div>
    </div>
    
</template>