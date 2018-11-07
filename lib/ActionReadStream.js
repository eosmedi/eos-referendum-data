const EosApi = require('eosjs-api');
const getFileStreamer = require('./filestreamer');
const Stream = require('stream');
const fs = require('fs');

class ActionReadStream extends Stream.Readable {
    
    constructor(opts){
        super();
        this.opts = opts || {}; 
        this.account = opts.account || '';
        this.action = opts.action || '';
        this.currentBlock = opts.currentBlock || 1;
        this.actionHandler = opts.actionHandler || null;
        this.fileReadState = 0;
        this.STOPPED = false;
        this.timmer = null;
        Stream.Readable.call(this, {
            objectMode: true,
            highWaterMark: opts.highWaterMark || 1000
        });
        this.initClient();
    }

    initClient(){
        this.eosClient = EosApi({
            httpEndpoint: this.opts.httpEndPoint,
            logger: {
                // error: null,
                log: null
            }
        });
    }

    _fetchBlock(){
        if(this.STOPPED) return;
        this.eosClient.getBlock(this.currentBlock, (error, result) => {
            if(this.STOPPED) return;
            if(!error){
                this.currentBlock++;
                (async () => {
                    try{
                        await this._parseBlock(result, true);
                        fs.writeFileSync(this.opts.checkPointFile, this.currentBlock);
                    }catch(e){
                        console.log(e, JSON.stringify(result));
                        this.timmer = setTimeout(() => {
                            this._fetchBlock();
                        }, 10 * 1000);
                        return;
                    }
                })();
               
            }else{
                this.timmer = setTimeout(() => {
                    this._fetchBlock();
                }, 3 * 1000);
                return;
            }
            this._fetchBlock();
        })
    }

    async _parseBlock(block){

        for (let index = 0; index < block.transactions.length; index++) {
            const transaction = block.transactions[index];
            if(transaction.status != "hard_fail" && typeof transaction.trx != "string"){
                for (let actionIndex = 0; actionIndex < transaction.trx.transaction.actions.length; actionIndex++) {
                    const action = transaction.trx.transaction.actions[actionIndex];
                    await this._handleAction(action, block, transaction);
                }
            }
        }
    }

    async _handleAction(action, block, transaction){
        var accountName = action.account;
        var actionName = action.name;

        if(this.account && this.account != accountName){
            return;
        }

        if(this.action && this.action != actionName){
            return;
        }

        // modify data or 
        if(this.actionHandler){
            await this.actionHandler(action, block);
        }

        action.timestamp = block.timestamp;
        action.block_num = block.block_num;
        action.producer = block.producer;
        action.tr_id = transaction.trx.id;
        this.push(action);
        fs.appendFileSync(this.opts.file, JSON.stringify(action)+"\n");
    }

    _read(){

        if(this.timmer){
            return;
        }

        if(!fs.existsSync(this.opts.file)){
            console.log('file not exists')
            this.fileReadState = 3;
        }else{
            
        }

        if(fs.existsSync(this.opts.file) && this.fileReadState == 0){
            this.fileReadState = 1;
            console.log('read from localfile')
            var fileReadStream = getFileStreamer(this.opts.file);
            fileReadStream.pipe(Stream.Writable({
                objectMode: true,
                write: (line, _, next) => {
                    try{
                        line = JSON.parse(line);
                        this.currentBlock = line.block_num;
                        this.push(line);
                    }catch(e){ console.log(e); }
                    process.nextTick(next);
                }
            }));

            fileReadStream.on('end', () => {
                this.fileReadState = 3;
                this._read();
                console.log('file readEnd');
            })
        }

        if(this.fileReadState == 3){
            if(fs.existsSync(this.opts.checkPointFile)){
                var fileState = parseInt(fs.readFileSync(this.opts.checkPointFile,  'utf-8'));
                if(fileState > this.currentBlock)  this.currentBlock = fileState;
            }
            console.log('start fetch from', this.currentBlock, this.timmer);
            this.fileReadState = 4;
            this._fetchBlock();
        }
    }
}



module.exports = ActionReadStream;