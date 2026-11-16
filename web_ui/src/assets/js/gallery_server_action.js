import axios from 'axios';
import serverInfo from './server_info.js'

export default {
    uploadTempraryFile : function(_file, _callBack){
        const formData = new FormData();
        formData.append('file', _file);
        //axios sets the multipart boundary itself; do not set Content-Type by hand
        axios.post(serverInfo.serverUrl + 'api/gallery_upload/temporary', formData, { withCredentials: true }).then((res) => {
            _callBack(res.data);
        });
    }
}