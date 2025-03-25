const path = require('path');
const database = require('../../config/database/connection');
const { exec } = require('node:child_process');

let workerRegistered = null;
let isCheckingStatusRequest = false;
let timeTickerRequestStatus = null;

const WorkerStatus =
{
    Idle : 0,
    Working : 1
}
const WorkerMessageCode =
{
    Register : 0,
    StatusRespone : 1
}
const ServerMessageCode =
{
    StatusRequest : 0
}
const resetTimeRequestWorkerStatus = function()
{
    clearInterval(timeTickerRequestStatus);
    //After 5 minutes, if worker not send status, we watch this worker is close
    timeTickerRequestStatus = setInterval(function () {
        isCheckingStatusRequest = false;
        workerRegistered = null;
        requestWorkerStatus();
    }, 5 * 60 * 1000);
}
const requestWorkerStatus = function(){
    if(!isCheckingStatusRequest){
        //Set is checking request
        isCheckingStatusRequest = true;

        //Send request status
        if(workerRegistered != null){
            //Send request status to worker
            workerRegistered.send(JSON.stringify({
                "messageCode" : ServerMessageCode.StatusRequest
            }));
        }
        else{
            //Open db_control
            exec('"' + path.join(__dirname, '../../../database_control_center/database_control_center/bin/Debug/net6.0-windows/database_control_center.exe') + '"');
        }
        
        //Reset time to recheck worker status
        resetTimeRequestWorkerStatus();
    }
}
const addRequestJob = async function(_jobData)
{
    //(*) For time to update, we have 2 option
    //-We update all every day at 12 AM -> OK
    //-Or we can update every time date for update change -> No, too many request

    //*So, when have request, we add in database
    let data = {
        'data' : _jobData,
        'time_request' : new Date().toISOString(),
    };
    const doc = await database.collections.DatabaseWorkerJob.create(data);

    //Request worker status for sending job
    requestWorkerStatus();
}
const startWorker = function(){
    isCheckingStatusRequest = false;
    //Request worker status for sending job
    requestWorkerStatus();
}
const onMessage = async function(_workerWebSocket, _messageCode, _messageData){
    if(_messageCode == WorkerMessageCode.Register){
        //Save worker
        workerRegistered = _workerWebSocket;

        //Save status finish checking status
        isCheckingStatusRequest = false;

        //Request worker status
        requestWorkerStatus();
    }
    else if(_messageCode == WorkerMessageCode.StatusRespone){
        //Save worker
        workerRegistered = _workerWebSocket;

        //Save status finish checking status
        isCheckingStatusRequest = false;

        //Reset time request worker status
        resetTimeRequestWorkerStatus();
    }
}
const onClose = function(_workerWebSocket){
    //Unset if workerRegistered == _workerWebSocket
    if(workerRegistered == _workerWebSocket){
        workerRegistered = null;
    }
}
module.exports = {
    WorkerStatus,
    WorkerMessageCode,
    ServerMessageCode,

    startWorker,
    addRequestJob,
    onMessage,
    onClose
};