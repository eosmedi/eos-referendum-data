


const ActionReadStream = require('./ActionReadStream');
const config = require('../config');
const Stream = require('stream');
const moment = require('moment');

var account = 'eosforumrcpp';


class ReferendumState {
    constructor(lokijs){
        this.lokijs = lokijs;
        this.proposers = null;
        this.voters = null;
        (async () => {
            console.log('lokijs', lokijs);
            this.proposers = await lokijs.getCollection('proposers');
            this.voters = await lokijs.getCollection('voters');
            this.init();
        })();
    }

    init(){

        this.read =  new ActionReadStream({
            httpEndPoint: 'https://api.eoseco.com',
            account: 'eosforumrcpp',
            checkPointFile: config.database.vote_check_point_file,
            file: config.database.voter_log
        });

        this.write = Stream.Writable({
            objectMode: true,
            write: (action, _, next) => {
                console.log(action);
                this._onAction(action, _, next);
            }
        })
        
        this.read.pipe(this.write);
        this.read.on('end', () => {
            console.log('reader end');
        });
    }

    _onAction(action, _, next){
        console.log(action);
        (async () => {
            var actionName = action.name;
            if(actionName == 'propose'){
                await this.propose(action);
            }

            if(actionName == 'vote' || actionName == 'unvote'){
                await this.vote(action);
            }

            process.nextTick(next);
        })();
    }

    async propose(action){  
        var proposalData = action.data;
        var existProposal = this.proposers.findOne({
            proposal_name: proposalData.proposal_name
        });
        
        proposalData.created_at = moment.utc(action.timestamp).unix();
        proposalData.expires_at = moment.utc(proposalData.expires_at).unix();

        if(existProposal) {
            proposalData = Object.assign(existProposal, proposalData);
            // this.proposers.update(proposalData)
        }else{
            this.proposers.insert(proposalData);
        }
     
        console.log('propose', action);
    }

    async vote(action){
        var voteData = action.data;
        var actionName = action.name;
        var inUnVote = actionName == 'unvote';

        var existsVoter = this.voters.findOne({
            voter: voteData.voter,
            proposal_name: voteData.proposal_name
        });

        var voteProposal = this.proposers.findOne({
            proposal_name: voteData.proposal_name
        });

        if(!existsVoter){
            console.log('first vote')
        }

        if(voteProposal){
            voteProposal.agree = voteProposal.agree || 0;
            voteProposal.against = voteProposal.against || 0;
            voteProposal.total = voteProposal.total || 0;

            if(existsVoter && voteData.vote == existsVoter.vote){
                // console.log('exist', voteData, existsVoter);
            }else{
                if(voteData.vote){
                    voteProposal.against--;
                }else{
                    voteProposal.agree++;
                }
            }

            if(!existsVoter){
                voteProposal.total++;
                console.log(voteProposal.total);
            }
           
            // console.log('voteProposal', voteProposal);
            this.proposers.update(voteProposal);
        }


        if(existsVoter){
            voteData.vote_count = voteData.vote_count || 1;
            voteData.vote_count++;
        }

        if(existsVoter) this.voters.remove(existsVoter.$loki);
        this.voters.insert(voteData);

    }

}


module.exports  = ReferendumState;