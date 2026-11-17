import { defineStore } from "pinia";
import authAction from "../js/auth_server_action.js";
import Cookie from 'js-cookie'

const readUser = function(){
    try {
        return JSON.parse(Cookie.get('user'));
    } catch (error) {
        //A broken cookie must not stop the app from loading
        Cookie.remove('user');
        return null;
    }
}

const user = readUser();

const initialState = {
    user: user,
    isLogin: user != null,
    errorMessage: null,
    jumpPage: null,
};

const errorText = function(error) {
    return error?.response?.data?.message || error?.data?.message || error?.message;
}

export const useAuthStore = defineStore("auth", {
    namespace: true,
    state: () => ({
        ...initialState,
    }),
    actions: {
        async signIn(user) {
            this.errorMessage = null;
            try {
                const response = await authAction.signin(user);
                this.user = response.data.user;
                this.isLogin = true;
                this.errorMessage = null;
                Cookie.set('user', JSON.stringify(response.data.user));
                return true;
            } catch (error) {
                this.errorMessage = errorText(error);
                return false;
            }
        },
        async signUp(user) {
            this.errorMessage = null;
            try {
                await authAction.signup(user);
                this.errorMessage = null;
                return true;
            } catch (error) {
                this.errorMessage = errorText(error);
                return false;
            }
        },
        async signOut() {
            try {
                await authAction.signout()
            } catch (error) {
                //Clear local state even when the request fails
            } finally {
                this.user = null;
                this.isLogin = false;
                Cookie.remove('user');
            }
        },
    }
});
