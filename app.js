var app = require('express')();
    cluster = require('cluster'),
    os = require("os"),
    fs = require("fs"),
    config = require('./config'),
    moment = require('moment'),
    ReferendumState = require('./lib/ReferendumState'),
    numCPUs = require('os').cpus().length;


var referendumStater = new ReferendumState(config.lokijs);

var server = require('http').createServer(app);

app.disable('x-powered-by');
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
  });

var config = require('./config');
var compression = require('compression');


app.get('/getProposes', function(req, res, next){
    var query = req.query || {};
    var sortBy = query.sort_by || 'created_at';
    var getAll = query.all;
    var proposersTable = referendumStater.proposers.chain();
    proposersTable = proposersTable.simplesort(sortBy, true);
    if(!getAll){
        var nowTime = moment().unix();
        proposersTable = proposersTable.where(function(obj) { 
            return obj.expires_at > nowTime;
        });
    }

    delete query.sort_by;
    delete query.all;
    
    res.json(proposersTable.find(query).data());
});

app.get('/getPropose/:propose', function(req, res, next){
    console.log(req.params.propose);
    var propose = req.params.propose;
    var query = req.query || {};
    query.proposal_name = propose;
    res.json(referendumStater.proposers.findOne(query));
});

app.get('/getVoters', function(req, res, next){
    var query = req.query || {};
    if(query.vote){
        query.vote = parseInt(query.vote);
    }
    res.json(referendumStater.voters.find(query));
});


app.use(compression());
server.listen(8083);