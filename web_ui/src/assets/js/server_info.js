import axios from 'axios';

export default {
    serverUrl : 'http://localhost:3000/',
    getFullPath : function(_relativePath){
        //Because when load background-image by url, it need '/' instead of '\\'.
        //Otherwise, the url will error
        return _relativePath? this.serverUrl + _relativePath.replace(/\\/g, '/') : "";
    },
}