import { defineStore } from "pinia";
import authAction from "../js/auth_server_action.js";
import { needsHydration } from "../../components/admin/admin_guard.js";
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

//The sign-in answer carries roles and the password flag beside the user, so both are folded into it.
const accountFrom = function(response) {
    const account = response.data.user || {};
    return {
        ...account,
        id: account.id ? String(account.id) : '',
        roles: Array.isArray(response.data.roles) ? response.data.roles : [],
        mustChange: response.data.must_change_password === true,
    };
}

export const useAuthStore = defineStore("auth", {
    namespace: true,
    state: () => ({
        ...initialState,
    }),
    getters: {
        isAdmin: (state) => Boolean(state.user && Array.isArray(state.user.roles) && state.user.roles.includes('admin')),
        mustChange: (state) => Boolean(state.user && state.user.mustChange),
    },
    actions: {
        async signIn(user) {
            this.errorMessage = null;
            try {
                const response = await authAction.signin(user);
                this.user = accountFrom(response);
                this.isLogin = true;
                this.errorMessage = null;
                Cookie.set('user', JSON.stringify(this.user));
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
        //An account stored before roles and the password flag existed gets one server read on boot.
        async hydrate() {
            if (!needsHydration(this.user)) {
                return;
            }
            try {
                const response = await authAction.me();
                const data = response.data || {};
                const account = data.user || {};
                this.user = {
                    ...this.user,
                    id: account.id ? String(account.id) : this.user.id,
                    roles: Array.isArray(account.roles) ? account.roles : [],
                    mustChange: data.must_change_password === true,
                };
                Cookie.set('user', JSON.stringify(this.user));
            } catch (error) {
                //Keep the stored session; the guard still blocks the admin area without the role.
            }
        },
        //The server cleared the flag; keep the local session in step so the guard stops redirecting
        passwordChanged() {
            if (this.user) {
                this.user = { ...this.user, mustChange: false };
                Cookie.set('user', JSON.stringify(this.user));
            }
        },
        //A 403 from an admin endpoint means the role is gone but the session is alive: keep the
        //account and drop only the admin role, so the layout renders the forbidden panel.
        roleLost() {
            if (this.user) {
                this.user = {
                    ...this.user,
                    roles: (Array.isArray(this.user.roles) ? this.user.roles : [])
                        .filter(role => role !== 'admin'),
                };
                Cookie.set('user', JSON.stringify(this.user));
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
