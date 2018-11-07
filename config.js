const fs = require('fs');
const lokijs = require('./lib/lokijs.js');

var BASE_DIR = __dirname+'/database/';

if(!fs.existsSync(BASE_DIR)){
    fs.mkdirSync(BASE_DIR);
}

// console.log(lokijs)
var config = {
    elasticsearch: '127.0.0.1:9200',
    httpEndPoint: 'http://127.0.0.1:28888',
    database: {
        voter_log: BASE_DIR+'vote.log',
        vote_check_point_file: BASE_DIR+'fetched',
        state: BASE_DIR+'state.json',
        transfer_log: BASE_DIR+'transfer_log',
        transfer_log_checkpoint: BASE_DIR+'transfer_log_fetchd',
        eos_log: BASE_DIR+'eos_log',
        eos_log_checkpoint: BASE_DIR+'eos_log_fetched'
    },
    lokijs: lokijs
};

console.log(lokijs);

lokijs.initDB(config.database.state, 10000000 * 1000);

module.exports = config;

