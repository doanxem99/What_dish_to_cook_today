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

    signout : function() {
        return axios.post(serverInfo.serverUrl + 'api/auth/signout', {}, {
            withCredentials: true
        });
    },
};