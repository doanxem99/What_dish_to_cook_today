import axios from 'axios';
import serverInfo from './server_info.js'

export default {
    searchDish : function(_keySearch, _callBack){
        axios.get(serverInfo.serverUrl + 'api/dish/search/keyword/' + _keySearch).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    searchDishSelection : function(_ingredientIds, _callBack){
        axios.get(serverInfo.serverUrl + 'api/dish/selection/ingredients/' + _ingredientIds).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    createDishProfile : function(_profile, _callBack){
        axios.post(serverInfo.serverUrl + 'api/dish/profile/create_dish', _profile, {
            withCredentials: true,
        }).then((res) => {
            _callBack(res.data);
        });
    },
    createDishPostProfile : function(_profile, _callBack){
        axios.post(serverInfo.serverUrl + 'api/dish/profile/create_dish_post', _profile, {
            withCredentials: true,
        }).then((res) => {
            _callBack(res.data);
        });
    },
    getDishProfile : function(_dishId, _callBack){
        axios.get(serverInfo.serverUrl + 'api/dish/profile/get_dish/' + _dishId).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    getDishPostProfile : function(_dishPostId, _callBack){
        axios.get(serverInfo.serverUrl + 'api/dish/profile/get_dish_post/' + _dishPostId).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    getDishPostsProfile : function(_dishPostIds, _callBack){
        axios.get(serverInfo.serverUrl + 'api/dish/profile/get_dish_posts/' + _dishPostIds).then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
    getBestDishPost : function(_callBack){
        axios.get(serverInfo.serverUrl + 'api/dish/profile/get_best_dish_post').then(response => {
            if(response.status == 200){
                _callBack(response.data);
            }
        });
    },
}