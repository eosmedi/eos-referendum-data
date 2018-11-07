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

var config = require('./config');
var compression = require('compression');


app.get('/getProposes', function(req, res, next){
    res.json(referendumStater.proposers.find());
});

app.get('/getVoters', function(req, res, next){
    var query = req.query || {};

    if(query.vote){
        query.vote = parseInt(query.vote);
    }
    res.json(referendumStater.voters.find(query));
});


app.use(compression());
server.listen(8080);