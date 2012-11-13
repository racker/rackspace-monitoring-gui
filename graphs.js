var mongoose = require('mongoose');
var settings = require('./settings');
var _ = require('underscore');

var db = mongoose.createConnection(settings.db.host, settings.db.db);

var graphSchema = new mongoose.Schema({
    tenantId: Number,
    name: String,
    period: Number,
    series: [{
        entityId: String,
        checkId: String,
        metricName: String
    }]
});
var SavedGraph = db.model('SavedGraph', graphSchema);

var getAll = function(req, res) {

    if (req.session.tenantId) {
        SavedGraph.find({ tenantId: req.session.tenantId }, function (err, graphs) {
            if (err) {
                console.log('SAVEDGRAPHS - ERROR - GET failed! DB error fetching graphs');
                console.log(err);
                res.status(500).send('{"code": 500, "error": "could not get graphs"}');
            }
            console.log('SAVEDGRAPHS - GET - Found '+graphs.length+' graphs for tenantId '+req.session.tenantId);
            res.send(JSON.stringify(graphs));
        });
    } else {
        console.log('SAVEDGRAPHS - ERROR - GET failed! no tenantId');
        res.status(500).send('{"code": 500, "error": "could not get graphs"}');
    }
};

var post = function(req, res) {
    var data = req.body;
    data['tenantId'] = req.session.tenantId;
    graph = new SavedGraph(data);
    graph.save(function (err, g) {
        if (err) {
            console.log('SAVEDGRAPHS - ERROR - POST failed! DB error saving graph');
            res.status(500).send('{"code": 500, "error": "could not save graph"}');
        } else {
            console.log('Saved Graph for tenantId ' + req.session.tenantId);
            res.send(JSON.stringify(g));
        }
    });
};

var get = function(req, res) {
    var id = req.params.id;

    if (req.session.tenantId) {
        SavedGraph.findOne({ tenantId: req.session.tenantId, _id: id }, function (err, graph) {
            if (err) {
                console.log('SAVEDGRAPHS - ERROR - GET failed! DB error fetching graphs');
                console.log(err);
                res.status(500).send('{"code": 500, "error": "could not get graphs"}');
            }
            console.log('SAVEDGRAPHS - GET - Found '+graph.length+' graphs for tenantId '+req.session.tenantId);
            res.send(JSON.stringify(graph));
        });
    } else {
        console.log('SAVEDGRAPHS - ERROR - GET failed! no tenantId');
        res.status(500).send('{"code": 500, "error": "could not get graphs"}');
    }
};


var put = function(req, res) {
    console.log('PUT from ' + req.session.tenantId);
};

var del = function(req, res) {
    var id = req.params.id;

    if (!id) {
        console.log('SAVEDGRAPHS - ERROR - DELETE failed! No document id');
        res.status(500).send('{"code": 500, "error": "could not delete graph"}');
    } else {
        if (req.session.tenantId) {
            SavedGraph.find({ tenantId: req.session.tenantId, _id: id}, function (err, graphs) {
                if (err) {
                    console.log('SAVEDGRAPHS - ERROR - DELETE failed! DB error fetching graphs');
                    console.log(err);
                    res.status(500).send('{"code": 500, "error": "could not delete graphs"}');
                } else {
                    if (graphs.length !== 1) {
                        console.log('SAVEDGRAPHS - Delete skipped - found ' + graphs.length + ' graphs');
                    }
                    _.each(graphs, function (graph) {
                        graph.remove(function (err) {
                           if (err) {
                                console.log('SAVEDGRAPHS - ERROR - DELETE failed! DB error deleting graphs');
                                console.log(err);
                                res.status(500).send('{"code": 500, "error": "could not delete graphs"}');
                            } else {
                                console.log('SAVEDGRAPHS - Deleted Graph ' + id + ' for tenantId ' + req.session.tenantId);
                                res.send('{"code": 200, "message": "ok"}');
                            }
                        });
                    });
                }
            });
        }
        else {
            console.log('SAVEDGRAPHS - ERROR - SavedGraph DELETE failed! no tenantId');
            res.status(500).send('{"code": 500, "error": "could not delete graph"}');
        }
    }
};

module.exports = {getAll: getAll, get: get, post:post, put:put, del:del};