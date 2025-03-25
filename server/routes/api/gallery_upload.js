const express = require('express');
const router = express.Router();
const database = require('../../config/database/connection');
const fileAction = require('../../config/file/file_action');
const fs = require('fs-extra');
const path = require('path');

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
                fstream = fs.createWriteStream(_pathToUpload.absolutePath);
                file.pipe(fstream);
                fstream.on('close', async function () {
                    console.log("Upload Finished of " + filename.filename);

                    _callBack({'isSuccess' : true, 'path' : _pathToUpload.relativePath});

                    /*//Store info in DB
                    let data = {'path' : _pathToUpload.relativePath, 'type' : 'image'};
                    await database.collections.Gallery.create(data, function(err,resDb){
                        if(!err){
                            _callBack({'isSuccess' : true, 'path' : _pathToUpload.relativePath});
                        }
                        else{
                            _callBack({'isSuccess' : false});
                        }
                    });*/
                });
            });
        }
        else{
            _callBack({'isSuccess' : false, 'status' : e});
        }
    }
    catch(e){
        console.log("Error--->" + e);
        _callBack({'isSuccess' : false, 'status' : e});
    }
}

router.post('/temporary', function(req, res){
    let fstream;
    req.pipe(req.busboy);
    req.busboy.on('file', function (fieldname, file, filename) {
        uploadTemporaryFile(fieldname, file, filename, (_dataReturn) => {
            res.statusCode = 200;
            res.send(_dataReturn);
        });
    });
});

//export this router to use in our index.js
module.exports = router;