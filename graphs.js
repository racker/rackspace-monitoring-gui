var mongoose = require('mongoose');
var settings = require('./settings');
var _ = require('underscore');

var log = require('./log').application;

var db = mongoose.createConnection(settings.db.host, settings.db.db);

var graphSchema = new mongoose.Schema({
    tenantId: {type: Number,
               required: true,
               min: 1},
    name: {type: String,
           required: true,
           match: (/\S+/i)}, // any non-whitespace string
    period: {type: Number,
             required: true,
             max: 60*60*1000*24*365, // 1 year
             min: 60*60*1000}, // 1 hour
    series: [{
        entityId: {type: String,
                   required: true,
                   match: (/en[\w]+/i)}, // entity hashid - enXXXXX
        checkId: {type: String,
                  required: true,
                  match: (/ch[\w]+/i)}, // check hashid -- chXXXXX
        metricName: {type: String,
                     required: true,
                     match: (/\S+/i)} // metric name - any non-whitespace string
    }]
});

var SavedGraph = db.model('SavedGraph', graphSchema);

/*
 * log and parse an error response from mongo into something suitable to return to a client
 */
var handleError = function (req, res, err) {

    log.error('SavedGraphs - Error', {username: req.session.username,
                                      tenantId: req.session.tenantId,
                                      url: req.url,
                                      ip: req.ip,
                                      error: err});

    var response = {};
    response['code'] = 500;
    response['name'] = err.name;
    response['message'] = 'Unknown Error';
    response.errors = [];

    if (response.name === 'ValidationError') {
        response.code = 400;
        response.message = err.toString();
    }

    return res.send(response.code, response);
};

var getAll = function(req, res) {
    SavedGraph.find({ tenantId: req.session.tenantId }, function (err, graphs) {
        if (err) {
            handleError(req, res, err);
        }
        log.info('SavedGraphs - GET', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip, count: graphs.length});
        res.send(graphs);
    });
};

var get = function(req, res) {
    var id = req.params.id;

    SavedGraph.findOne({ tenantId: req.session.tenantId, _id: id }, function (err, graph) {
        if (err) {
            handleError(req, res, err);
        }
        log.info('SavedGraphs - GET', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip, id: id});
        res.send(graph);
    });
};

var post = function(req, res) {
    var data = req.body;
    data['tenantId'] = req.session.tenantId;
    graph = new SavedGraph(data);
    graph.save(function (err, g) {
        if (err) {
            handleError(req, res, err);
        } else {
            log.info('SavedGraphs - POST', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip});
            res.send(g);
        }
    });
};

var put = function(req, res) {
    log.info('SavedGraphs - PUT', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip});
    res.send(204);
};

var del = function(req, res) {
    var id = req.params.id;

    SavedGraph.find({ tenantId: req.session.tenantId, _id: id}, function (err, graphs) {
        if (err) {
            handleError(req, res, err);
        } else {
            _.each(graphs, function (graph) {
                graph.remove(function (err) {
                   if (err) {
                        handleError(req, res, err);
                    } else {
                        log.info('SavedGraphs - DELETE', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip, id: id});
                        res.send(204);
                    }
                });
            });
        }
    });
};

module.exports = {getAll: getAll, get: get, post:post, put:put, del:del};