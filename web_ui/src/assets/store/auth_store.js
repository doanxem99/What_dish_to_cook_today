import { defineStore } from "pinia";
import authAction from "../js/auth_server_action.js";
import Cookie from 'js-cookie'

const user = Cookie.get('user');

const initialState = user
    ? { 
        user: JSON.parse(user),
        isLogin: true,
        errorMessage: null,
        jumpPage: null,
    }
    : {
        user: null,
        isLogin: false,
        errorMessage: null,
        jumpPage: null,
    };

export const useAuthStore = defineStore("auth", {
    namespace: true,
    state: () => ({
        ...initialState,
    }),
    actions: {
        signIn(user) {
            this.errorMessage = null;
            authAction.signin(user).then((response) => {
                this.user = response.data.user;
                this.isLogin = true;
                this.errorMessage = null;
                Cookie.set('user', JSON.stringify(response.data.user));
            }, (error) => {
                this.errorMessage = ( error?.response?.data?.message || 
                    error?.data?.message || error?.message);
                    return false;
            });
            return true;
        },
        signUp(user) {
            this.errorMessage = null;
            authAction.signup(user).then((response) => {
                this.errorMessage = null;
            }, (error) => {
                this.errorMessage = ( error?.response?.data?.message || 
                    error?.data?.message || error?.message);
            });
        },
        signOut() {
            this.user = null;
            this.isLogin = false;
            Cookie.remove('user');
        },
        updateUser(user) {
            this.errorMessage = null;
            const response = authAction.updateUser(user);
            if (response.status != 200) {
                this.errorMessage = ( error?.response?.data?.message || 
                    error?.data?.message || error?.message);
            }
        }
    }
});