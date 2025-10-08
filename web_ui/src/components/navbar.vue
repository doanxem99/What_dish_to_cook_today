<script>
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../assets/store/auth_store';
import { mapState } from 'pinia';
import { faUser } from '@fortawesome/free-solid-svg-icons';

export default {
    computed: {
        ...mapState(useAuthStore, ['isLogin', 'user'])
    },
    data() {
        return {
            faUser
        };
    }
}
</script>

<template>
    <nav class=" w-full flex items-center justify-center z-1 p-2 shadow-sm shadow-white ">
        <div class=" w-2/3 flex flex-row items-center justify-center gap-4">
            <div class="flex-none">
                <img src="../assets/icons/logo.ico" class="logo" alt="Logo" />
            </div>
            <input
                name="find_post"
                type="text"
                class="border rounded-2xl flex-grow px-6 cursor-pointer"
                placeholder="What would you like to cook today?"
            /> 
            <div v-if="!isLogin" class="flex items-center gap-3">
                    <RouterLink to="/signin" class="btn border bg-white text-black">Log in</RouterLink>
                    <RouterLink to="/signup" class="btn ">Sign up</RouterLink>
            </div>
            <div v-else class="flex items-center">
                <div class="btn flex flex-row justify-center item-center gap-2">
                    <div class=" rounded-full w-5 h-5 border justify-center items-center flex">
                        <font-awesome-icon size="l" :icon="faUser" />
                    </div>
                    <div class="w-40 overflow-clip">
                        {{ user.username }}
                    </div>
                </div>
            </div>
        </div>
    </nav>
</template>