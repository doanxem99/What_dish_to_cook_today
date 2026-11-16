//Base address of the Express API. Set VITE_SERVER_URL at build time for a real deployment.
const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000/';

export default {
    serverUrl : serverUrl.endsWith('/') ? serverUrl : serverUrl + '/',
    getFullPath : function(_relativePath){
        //Because when load background-image by url, it need '/' instead of '\\'.
        //Otherwise, the url will error
        return _relativePath? this.serverUrl + _relativePath.replace(/\\/g, '/') : "";
    },
}
