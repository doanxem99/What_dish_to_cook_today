const getEnumName = function(_enum, _val){
    let keys = Object.keys(_enum);
    return keys[_val];
}

module.exports = {
    getEnumName
};