const path = require('path');
const database = require('../../config/database/connection');
const database_worker = require('./database_worker');
const { exec } = require('node:child_process');

const WorkerType = 
{
    DatabaseControl : 0,
    ImageStudioControl : 1
}
const startWorkers = function()
{
    console.log('Start all workers');
    //*Start all worker
    database_worker.startWorker();
}
const eventWorkerConnected = function(_ws, _req){
    console.log('Event worker connected');

    _ws.on('message', msg => {
        const workerMessage = JSON.parse(msg);
        if(workerMessage.workerType == WorkerType.DatabaseControl){
            database_worker.onMessage(_ws, workerMessage.messageCode, workerMessage.messageData);
        }
        else if(workerMessage.workerType == WorkerType.ImageStudioControl){
            
        }

        //ws.send(msg)
        console.log('client send message : ' + msg);
    });
  
    _ws.on('close', () => {
        database_worker.onClose(_ws);

        console.log('WebSocket was closed');
    });
}
const addRequestJob = async function(_workerType, _jobData)
{
    if(_workerType == WorkerType.DatabaseControl){
        database_worker.addRequestJob(_jobData);
    }
    else if(_workerType == WorkerType.ImageStudioControl){
        
    }
}
module.exports = {
    WorkerType,
    
    startWorkers,
    eventWorkerConnected,
    addRequestJob
};