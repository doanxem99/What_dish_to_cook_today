import axios from "axios";
import serverInfo from "./server_info.js";

export default {
    signin : function(_user) {
        return axios.post(serverInfo.serverUrl + 'api/auth/signin', _user, {
            withCredentials: true
        });
    },

    signup : function(_user) {
        return axios.post(serverInfo.serverUrl + 'api/auth/signup', _user);
    },

    me : function() {
        return axios.get(serverInfo.serverUrl + 'api/auth/me', {
            withCredentials: true
        });
    },

    signout : function() {
        return axios.post(serverInfo.serverUrl + 'api/auth/signout', {}, {
            withCredentials: true
        });
    },
};