//Base address of the Express API. Set VITE_SERVER_URL at build time for a real deployment.
//In a production build the app is served by the same server, so relative paths are correct.
const serverUrl = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3000/' : '/');

export default {
    serverUrl : serverUrl.endsWith('/') ? serverUrl : serverUrl + '/',
    getFullPath : function(_relativePath){
        //Because when load background-image by url, it need '/' instead of '\\'.
        //Otherwise, the url will error
        return _relativePath? this.serverUrl + _relativePath.replace(/\\/g, '/') : "";
    },
    //Missing photos fall back to the shipped placeholder rather than a broken icon.
    getImage : function(_relativePath, _kind){
        if (_relativePath) {
            return this.getFullPath(_relativePath);
        }
        return this.serverUrl + 'pictures/defaults/' + (_kind === 'ingredient' ? 'ingredient' : 'dish') + '.png';
    },
}
