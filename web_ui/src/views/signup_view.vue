<script>
import { faFacebook, faGithub, faGoogle } from '@fortawesome/free-brands-svg-icons'
import { Form, Field, ErrorMessage } from 'vee-validate'
import { RouterLink } from 'vue-router'
import { mapState } from 'pinia'
import { useAuthStore } from '../assets/store/auth_store'
import * as yup from 'yup'

export default {
    components: {
        Form,
        Field,
        ErrorMessage,
    },
    data() {
        return {
            username: '',
            password: '',
            faFacebook,
            faGoogle,
            faGithub
        }
    },
    computed: {
        ...mapState(useAuthStore, ['errorMessage', 'isLogin', 'jumpPage']),
        schema() {
            return yup.object().shape({
                    username: yup.string().required('Username cannot be empty'),
                    email: yup.string().email('Email must be valid').required('Email cannot be empty'),
                    password: yup
                        .string()
                        .min(8, 'Passwords must be at least 8')
                        .required('Password cannot be empty'),
                    confirmpassword: yup
                        .string()
                        .required('ConfirmPassword cannot be empty')
                        .oneOf([yup.ref('password'), null], 'Passwords must match'),
                    })
        }
    },
    methods: {
        async handleSubmit(_data) {
            if (await useAuthStore().signUp(_data)) {
                this.$router.push({ path: '/signin' });
            }
        }
    },
    created() {
        if (this.isLogin) {
            this.$router.push({ path: this.jumpPage || '/' });
            useAuthStore().jumpPage = null;
        }
    }
}

</script>

<template>
    <main>
        <div class=" w-full h-screen flex flex-wrap">
            <div class="w-full h-2/3 relative mt-40 content-center max-sm:mt-60">
                <div class="m-auto p-4 flex flex-col w-1/3 text-center justify-center gap-4 shadow-2xl shadow-blue-400 rounded-2xl">
                    <p class=" text-3xl font-bold">Sign Up</p>
                    <div class="p-1 rounded text-base text-red-400 bg-red-300 w-4/5 m-auto" v-if="errorMessage">
                        {{ errorMessage }}
                    </div>
                    <Form @submit="handleSubmit" :validation-schema="schema" name="signin">
                        <Field 
                        name="username"
                        type="text"
                        placeholder="Username"
                        class="rounded-3xl border w-4/5 indent-3 h-8 text-base"
                        />
                        <span class="flex w-full h-4 justify-center items-center">
                            <div class="w-4/5 flex">
                                <ErrorMessage name="username" class="error-text" />
                            </div>
                        </span>

                        <Field 
                        name="email"
                        type="text"
                        placeholder="Email"
                        class="rounded-3xl border w-4/5 indent-3 h-8 text-base"
                        />
                        <span class="flex w-full h-4 justify-center items-center">
                            <div class="w-4/5 flex">
                                <ErrorMessage name="email" class="error-text" />
                            </div>
                        </span>
                    
                        <Field 
                        name="password"
                        type="password"
                        placeholder="Password"
                        class="rounded-3xl border w-4/5 indent-3 h-8 text-base"
                        />
                        <span class="flex w-full h-4 justify-center items-center">
                            <div class="w-4/5 flex">
                                <ErrorMessage name="password" class="error-text" />
                            </div>
                        </span>

                        <Field 
                        name="confirmpassword"
                        type="password"
                        placeholder="Confirm Password"
                        class="rounded-3xl border w-4/5 indent-3 h-8 text-base"
                        />
                        <span class="flex w-full h-4 justify-center items-center">
                            <div class="w-4/5 flex">
                                <ErrorMessage name="confirmpassword" class="error-text" />
                            </div>
                        </span>

                        <button type="submit" class="form-btn w-4/5 text-base">
                            Submit
                        </button>
                    </Form>
                    <div class="w-full flex flex-row justify-end ">
                        <RouterLink to="/signin" class="flex link_hover text-blue-400 text-sm">Already has an account?</RouterLink>
                    </div>
                    <div class="item_devide">
                        Sign in with
                    </div>
                    <div class="w-full flex flex-row gap-4 justify-center max-md:flex-col max-md:items-center">
                        <div class="w-30 h-7 border rounded flex-row flex justify-center items-center gap-1.5">
                            <font-awesome-icon size="l" :icon="faGoogle" />
                            <p>Google</p>
                        </div>
                        <div class="w-30 h-7 border rounded flex-row flex justify-center items-center gap-1.5">
                            <font-awesome-icon size="l" :icon="faFacebook" />
                            <p>Facebook</p>
                        </div>
                        <div class="w-30 h-7 border rounded flex-row flex justify-center items-center gap-1.5">
                            <font-awesome-icon size="l" :icon="faGithub" />
                            <p>Github</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>
</template>