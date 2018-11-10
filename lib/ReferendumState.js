const ActionReadStream = require('./ActionReadStream');
const config = require('../config');
const Stream = require('stream');
const moment = require('moment');
const EosJs = require("eosjs");

var account = 'eosforumrcpp';

async function ActionHandler(action){
    delete action.hex_data;
}



class ReferendumState {

    constructor(lokijs){
        this.lokijs = lokijs;
        this.proposers = null;
        this.voters = null;
        this.comments = null;
        (async () => {
            console.log('lokijs', lokijs);
            this.proposers = await lokijs.getCollection('proposers');
            this.voters = await lokijs.getCollection('voters');
            this.comments = await lokijs.getCollection('comments');
            
            this.init();
        })();
    }

    init(){

        this.read =  new ActionReadStream({
            httpEndPoint: config.httpEndPoint,
            account: 'eosforumrcpp',
            checkPointFile: config.database.vote_check_point_file,
            file: config.database.voter_log,
            actionHandler: ActionHandler
        });

        this.write = Stream.Writable({
            objectMode: true,
            write: (action, _, next) => {
                this._onAction(action, _, next);
            }
        })
        
        this.read.pipe(this.write);
        this.read.on('end', () => {
            console.log('reader end');
        });
    }

    _onAction(action, _, next){
        (async () => {
            try{
                var actionName = action.name;
                if(actionName == 'propose'){
                    await this.propose(action);
                }

                if(actionName == 'vote' || actionName == 'unvote'){
                    await this.vote(action);
                }

                if(actionName == 'post'){
                    await this.post(action);
                }
            }catch(e){
                console.log(e);
            }
            process.nextTick(next);
        })();
    }

    async propose(rawAction){  

        var action = Object.assign({}, rawAction);
        var proposalData = action.data;
        var existProposal = this.proposers.findOne({
            proposal_name: proposalData.proposal_name
        });
        
        try{
            proposalData.proposal_json = JSON.parse(proposalData.proposal_json);
        }catch(e){}

        proposalData.created_at = moment.utc(action.timestamp).unix();
        if(typeof proposalData.expires_at == "string") {
            proposalData.expires_at = moment.utc(proposalData.expires_at).unix();
        }

        proposalData.agree =  0;
        proposalData.against =  0;
        proposalData.total = 0;

        if(existProposal) {
            proposalData = Object.assign(existProposal, proposalData);
            this.proposers.update(proposalData)
        }else{
            this.proposers.insert(proposalData);
        }
     
    }

    async vote(action){
        var voteData = action.data;
        var actionName = action.name;
        var inUnVote = actionName == 'unvote';

        var accountKey = EosJs.modules.format.encodeName(voteData.voter, false);

        var voterStakeData = await this.read.eosClient.getTableRows({
            json: true, 
            code: "eosio", 
            scope: "eosio",
            table: "voters", 
            table_key: "", 
            lower_bound: accountKey,
            upper_bound: -1,
            limit: 1
        });

        // var delegateData = await this.read.eosClient.getTableRows({
        //     json: true, 
        //     code: "eosio", 
        //     scope: voteData.voter,
        //     table: "delband", 
        //     table_key: "",
        //     limit: -1
        // });
        // console.log(votersData, delegateData);

        if(voterStakeData.rows.length){
            var voterMeta = voterStakeData.rows[0];
            voteData.staked = voterMeta.staked;
            // voteData.last_staked = voteData.staked;
        }

        var existsVoter = this.voters.findOne({
            voter: voteData.voter,
            proposal_name: voteData.proposal_name
        });
        

        var voteProposal = this.proposers.findOne({
            proposal_name: voteData.proposal_name
        });

        voteData.last_vote_time = action.timestamp;
    
        if(!existsVoter){
            console.log('first vote')
        }else{
            console.log('second vote', voteData.vote, voteData, existsVoter.vote)
        }

        // has proposal
        if(voteProposal){
            voteProposal.agree = voteProposal.agree || 0;
            voteProposal.against = voteProposal.against || 0;
            voteProposal.total = voteProposal.total || 0;

            voteProposal.against_eos = voteProposal.against_eos || 0;
            voteProposal.total_eos = voteProposal.total_eos || 0;
            voteProposal.agree_eos = voteProposal.agree_eos || 0;

            if(inUnVote && existsVoter){
                if(existsVoter.vote){
                    voteProposal.agree_eos -= existsVoter.staked;
                    voteProposal.agree--;
                }else{
                    voteProposal.against_eos -= existsVoter.staked;
                    voteProposal.against--;
                }
                voteProposal.total_eos -= existsVoter.staked;
                voteProposal.total--;
                // this.voters.remove(existsVoter);
            }else{
                if(existsVoter){
                    if(voteData.vote != existsVoter.vote){
                        if(voteData.vote){
                            voteProposal.against_eos -= existsVoter.staked;
                            voteProposal.agree_eos += existsVoter.staked;
                            voteProposal.against--;
                            voteProposal.agree++;
                            console.log('new is aggree');
                        }else{
                            voteProposal.against_eos += existsVoter.staked;
                            voteProposal.agree_eos -= existsVoter.staked;
                            voteProposal.against++;
                            voteProposal.agree--;
                            console.log('new is against');
                        }
                    }else{
                        console.log('nothing change')
                    }
                }else{
                    
                    // for reduce
                    voteData.last_staked = voteData.staked;

                    if(voteData.vote){
                        voteProposal.agree_eos += voteData.staked;
                        voteProposal.agree++;
                    }else{

                        voteProposal.against_eos += voteData.staked;
                        voteProposal.against++;
                    }
                    voteProposal.total++;
                    voteProposal.total_eos += voteData.staked;
                }
            }

            this.proposers.update(voteProposal);
        }

        if(existsVoter){
            voteData.vote_count = voteData.vote_count || 1;
            voteData.vote_count++;
        }

        if(existsVoter) this.voters.remove(existsVoter);
        if(!inUnVote) this.voters.insert(voteData);

    }

    async post(action){

        var postData = action.data;
        var actionName = action.name;

        var propose_name = postData.reply_to_post_uuid;
        var proposer = postData.reply_to_poster;

        var existProposal = this.proposers.findOne({
            proposal_name: propose_name,
            proposer: proposer
        });

        if(existProposal){
            this.comments.insert({
                poster: postData.poster,
                post_uuid:  postData.post_uuid,
                content:  content,
                timestamp: moment.utc(action.timestamp).unix(),
                reply_to_poster: proposer,
                proposal_name: propose_name
            });
        }

    }
}


module.exports  = ReferendumState;