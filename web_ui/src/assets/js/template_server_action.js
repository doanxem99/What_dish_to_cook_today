import axios from 'axios';
import serverInfo from './server_info.js'

export default {
    getImageBlockTemplate : function(_callBack){
        axios.get(serverInfo.serverUrl + 'api/template/image_block').then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    getIngredientTemplate : function(_callBack){
        axios.get(serverInfo.serverUrl + 'api/template/ingredient').then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    getDishTemplate : function(_callBack){
        axios.get(serverInfo.serverUrl + 'api/template/dish').then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
}