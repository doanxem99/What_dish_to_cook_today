const fs = require('fs');
const enumAction = require('../enum/enum_action.js');

let filePath = "./data/test.txt";

const DebugType = {
    Comment : 0,
    Warning : 1,
    Exception : 2
};
const init = function()
{
    let folderPath = __dirname + "/data";
    //filePath = folderPath + "/data_" + (new Date().toISOString().replace(/[-:.]/g, "_")) + ".txt";
    filePath = folderPath + "/data_debug.txt";
    if (!fs.existsSync(folderPath)){
        fs.mkdirSync(folderPath);
    }
    fs.writeFile(filePath, new Date().toISOString() + "\n", err => {
        if (err) {
          console.error(err);
        }
        // file written successfully
      });
}
const writeLine = function(_debugType, _data)
{
    let dataPrint = enumAction.getEnumName(DebugType, _debugType) + " : " + _data;

    //Log to console
    console.log(dataPrint);

    //Write to file
    fs.appendFile(filePath, dataPrint + "\n", err => {
        if (err) {
          console.error(err);
        }
        // file written successfully
      });
}

module.exports = {
    DebugType,
    
    init,
    writeLine,
};