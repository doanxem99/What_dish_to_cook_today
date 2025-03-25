import axios from 'axios';
import serverInfo from './server_info.js'

export default {
    uploadTempraryFile : function(_file, _callBack){
        const formData = new FormData();
        formData.append('file', _file);
        const headers = { 'Content-Type': 'multipart/form-data' };
        axios.post(serverInfo.serverUrl + 'api/gallery_upload/temporary', formData, { headers }).then((res) => {
            _callBack(res.data);
        });
    }
}