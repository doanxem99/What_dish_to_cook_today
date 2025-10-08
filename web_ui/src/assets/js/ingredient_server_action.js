import axios from 'axios';
import serverInfo from './server_info.js'

export default {
    searchIngredient : function(_keySearch, _callBack){
        axios.get(serverInfo.serverUrl + 'api/ingredient/search/keyword/' + _keySearch).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    searchIngredientById : function(_ingredientIds, _callBack){
        axios.get(serverInfo.serverUrl + 'api/ingredient/search/ids/' + _ingredientIds).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    searchIngredientSelection : function(_callBack){
        axios.get(serverInfo.serverUrl + 'api/ingredient/selection/').then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    createIngredientProfile : function(_profile, _callBack){
        axios.post(serverInfo.serverUrl + 'api/ingredient/profile/create_ingredient', _profile, {
            withCredentials: true,
        }).then((res) => {
            _callBack(res.data);
        });
    },
    createIngredientPostProfile : function(_profile, _callBack){
        axios.post(serverInfo.serverUrl + 'api/ingredient/profile/create_ingredient_post', _profile, {
            withCredentials: true,
        }).then((res) => {
            _callBack(res.data);
        });
    },
    getIngredientProfile : function(_ingredientId, _callBack){
        axios.get(serverInfo.serverUrl + 'api/ingredient/profile/get_ingredient/' + _ingredientId).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    getIngredientPostProfile : function(_ingredientPostId, _callBack){
        axios.get(serverInfo.serverUrl + 'api/ingredient/profile/get_ingredient_post/' + _ingredientPostId).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    getIngredientPostsProfile : function(_ingredientPostIds, _callBack){
        axios.get(serverInfo.serverUrl + 'api/ingredient/profile/get_ingredient_posts/' + _ingredientPostIds).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    }
}