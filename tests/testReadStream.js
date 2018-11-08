

const ActionReadStream = require('../lib/ActionReadStream');
const config = require('../config');
const Stream = require('stream');

async function ActionHandler(action){
    delete action.hex_data;
}

var readStream = new ActionReadStream({
    httpEndPoint: 'https://api.eoseco.com',
    account: 'eosio',
    action: 'newaccount',
    checkPointFile: config.database.transfer_log,
    file: config.database.transfer_log_checkpoint,
    actionHandler: ActionHandler,
});

readStream.pipe(Stream.Writable({
    objectMode: true,
    write: (line, _, next) => {
        console.log(line);
        process.nextTick(next);
    }
}));
readStream.on('end', function () {
  
})