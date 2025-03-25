const fs = require('fs-extra');
const path = require('path');
const appDebug = require('../../config/debug/app_debug');

const getFileExtentionSync = function(_fileName)
{
    let datas = _fileName.split('.');
    return datas[datas.length - 1].toLowerCase();
}

const createFoldersByFolderNames_Loop = function(_index, _parentPath, _folders, _callBack)
{
    if(_index >= _folders.length){
        _callBack(_parentPath);
        return;
    }

    folderPath = path.join(_parentPath, _folders[_index]);
    fs.access(folderPath, fs.constants.F_OK, async (err) => {
        //If file not exist, we create new
        if(err){
            const createDir = await fs.mkdir(folderPath);
        }
        //Create new sub forder
        createFoldersByFolderNames_Loop(_index + 1, folderPath, _folders, _callBack)
    });
}

const createFoldersByPath = function(_rootPath, _relativeFolderPath, _callBack)
{
    _relativeFolderPath = _relativeFolderPath.replace(/\\/g, '/');
    let folders = _relativeFolderPath.split('/');
    createFoldersByFolderNames_Loop(0, _rootPath, folders, (_folderPath) => {
        _callBack(_folderPath);
    });
}

const findFindNameNotExist_Loop = function(_index, _parentPath, _fileExtension, _callBack){
    let fileName = _index + "." + _fileExtension;
    fs.access(path.join(_parentPath, fileName), fs.constants.F_OK, async (err) => {
        if(err){
            _callBack(fileName);
        }
        else{
            findFindNameNotExist_Loop(_index + 1, _parentPath, _fileExtension, _callBack);
        }
    });
}

const findFilePathToUpload = function(_rootPath, _relativeFolderPath, _fileExtension, _callback)
{
    //(*)We will group all file in 1 hour to a folder
    //First, we create folder contain
    let datetime = new Date();
    let folderName = datetime.getFullYear().toString() + "_" + (datetime.getMonth() + 1).toString()  +
        "_" + datetime.getDate()  + "_" + datetime.getHours();
    createFoldersByPath(_rootPath, path.join(_relativeFolderPath,folderName), (_folderPath)=>{
        //Then, we check to find name
        findFindNameNotExist_Loop(0, _folderPath, _fileExtension, (_fileName) => {
            let relativePath = path.join(_relativeFolderPath, folderName, _fileName);
            let absolutePath = path.join(_rootPath, relativePath);
            _callback({'relativePath' : relativePath, 'absolutePath' : absolutePath});
        });
    });
}

const moveFileToFolder = function(_rootPath, _relativeFolderPath, _filePath, _callBack)
{
    let extension = getFileExtentionSync(_filePath);
    findFilePathToUpload(_rootPath, _relativeFolderPath, extension, async (_pathToUpload) => {
        await fs.rename(_filePath, _pathToUpload.absolutePath);
        _callBack(_pathToUpload.relativePath);
    });
}

const moveFilesToFolder_Loop = function(_index, _rootPath, _relativeFolderPath, _filesPath, _pathsReturn, _callBack){
    if(_index >= _filesPath.length){
        _callBack(_pathsReturn);
        return;
    }

    let filePath = _filesPath[_index];
    let extension = getFileExtentionSync(filePath);
    findFilePathToUpload(_rootPath, _relativeFolderPath, extension, async (_pathToUpload)=>{
        await fs.rename(filePath, _pathToUpload.absolutePath);
        _pathsReturn.push(_pathToUpload.relativePath);
        moveFilesToFolder_Loop(_index + 1, _rootPath, _relativeFolderPath, _filesPath, _pathsReturn, _callBack);
    });
}

const moveFilesToFolder = function(_rootPath, _relativeFolderPath, _filesPath, _callBack)
{
    //Loop throught all file to move
    moveFilesToFolder_Loop(0, _rootPath, _relativeFolderPath, _filesPath, [], (_pathsReturn)=>{
        _callBack(_pathsReturn);
    });
}

const findFilePathsAndMove = function(_data, _rootPath, _relativeFolderSource, _relativeFolderDestination, _callBack)
{
    //Loop throught all value in json to find files start with _relativeFolderSource and move to _relativeFolderDestination
    //Check type _data for action
    if(typeof(_data) === 'string' || _data instanceof String){
        //If thís part start by _relativeFolderSource, we move all path to _relativeFolderDestination
        if(_data.startsWith(_relativeFolderSource)){
            moveFileToFolder(_rootPath, _relativeFolderDestination, _data, (_newPath) => {
                _callBack(_newPath);
            });
        }
        else{
            _callBack(_data);
        }
    }
    else if(Array.isArray(_data)){
        let numberItem = _data.length;
        let loopWaiting = numberItem;
        if(loopWaiting > 0){
            for (let i = 0; i < numberItem;i++) {
                findFilePathsAndMove(_data[i], _rootPath, _relativeFolderSource, _relativeFolderDestination,
                    (_newData) => {
                        _data[i] = _newData;
    
                        //Minus loopWaiting(Call back when finish)
                        loopWaiting--;
                        if(loopWaiting == 0){
                            _callBack(_data);
                        }
                    });
            }
        }
        else{
            _callBack(_data);
        }
    }
    else if(_data instanceof Object){
        //Get all keys and find all
        let keys = Object.keys(_data);
        let loopWaiting = keys.length;
        if(loopWaiting > 0){
            for (let key of keys) {
                findFilePathsAndMove(_data[key], _rootPath, _relativeFolderSource, _relativeFolderDestination,
                    (_newData) => {
                        _data[key] = _newData;
    
                        //Minus loopWaiting(Call back when finish)
                        loopWaiting--;
                        if(loopWaiting == 0){
                            _callBack(_data);
                        }
                    });
            }
        }
        else{
            _callBack(_data);
        }
    }
    else{
        _callBack(_data);
    }
}

const findFilePathsInJsonStringSync = function(_data, _relativeFolderPath){
    //Use regex to find
    //var regex = new RegExp("('|\")" + _relativeFolderPath + ".+('|\")");
    //var regex = new RegExp("('|\")public(/|\\\)gallery(/|\\)temporary(/|\\).+('|\")");
    //let regex = /('|")public(\/|\\|\\\\)gallery(\/|\\|\\\\)temporary[^'|"]+('|")/g;
    let subFolderPaths = _relativeFolderPath.split(/[\/\\]+/);
    let regex = new RegExp("(?<='|\")"+subFolderPaths.join("[\\\\/]+")+"[^'|\"]+(?='|\")", 'g');
    let result = _data.match(regex);

    //Remove duplicate path
    let filePaths = result != null ? Array.from(new Set(result)) : [];

    return filePaths;
}

module.exports = {
    getFileExtentionSync,
    createFoldersByPath,
    findFilePathToUpload,

    moveFileToFolder,
    moveFilesToFolder,

    findFilePathsAndMove,

    findFilePathsInJsonStringSync,
    
};