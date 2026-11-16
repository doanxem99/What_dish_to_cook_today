const express = require('express');
const router = express.Router();
const fileAction = require('../../config/file/file_action');
const fs = require('fs-extra');
const path = require('path');
const { verifyToken } = require('./verifyToken');

const uploadTemporaryFile = function(fieldname, file, filename, _callBack)
{
    try{
        console.log("Uploading: " + filename.filename);

        //First, we check is file extention allow or not
        let extension = fileAction.getFileExtentionSync(filename.filename);
        if(extension == "png" || extension == "jpg" || extension == "jpeg")
        {
            //Then, we find path for new file
            fileAction.findFilePathToUpload(path.join(__dirname, '../../'), 'public/gallery/temporary/', extension, (_pathToUpload)=>{
                console.log("Save to path : " + _pathToUpload.absolutePath);
                //Then, we upload file
                const fstream = fs.createWriteStream(_pathToUpload.absolutePath);
                file.pipe(fstream);
                fstream.on('close', function () {
                    console.log("Upload Finished of " + filename.filename);
                    _callBack({'isSuccess' : true, 'path' : _pathToUpload.relativePath});
                });
                fstream.on('error', function (err) {
                    console.log("Error--->" + err);
                    _callBack({'isSuccess' : false, 'status' : err.toString()});
                });
            });
        }
        else{
            _callBack({'isSuccess' : false, 'status' : "Only png, jpg and jpeg are allowed"});
        }
    }
    catch(e){
        console.log("Error--->" + e);
        _callBack({'isSuccess' : false, 'status' : e.toString()});
    }
}

router.post('/temporary', verifyToken, function(req, res){
    let answered = false;
    let fileSeen = false;
    const answer = function(_data) {
        if (answered) return;
        answered = true;
        res.status(_data.isSuccess ? 200 : 400).send(_data);
    };

    req.pipe(req.busboy);
    req.busboy.on('file', function (fieldname, file, filename) {
        fileSeen = true;
        uploadTemporaryFile(fieldname, file, filename, answer);
    });
    req.busboy.on('error', function (err) {
        console.log("Error--->" + err);
        answer({'isSuccess' : false, 'status' : err.toString()});
    });
    req.busboy.on('finish', function () {
        if (!fileSeen) {
            answer({'isSuccess' : false, 'status' : "No file was uploaded"});
        }
    });
});

//export this router to use in our index.js
module.exports = router;
