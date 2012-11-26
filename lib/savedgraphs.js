/*
 *  Copyright 2011 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var mongoose = require('mongoose');
var _ = require('underscore');
var log = require('logmagic').local('raxmongui.savedgraphs');


function SavedGraphs(settings) {
  this.settings = settings;

  // initialize db connection and schema
  this.db = mongoose.createConnection(settings.db.host, settings.db.db);
  this.graphSchema = new mongoose.Schema({
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
  this.SavedGraph = this.db.model('SavedGraph', this.graphSchema);
}

/*
 * log and parse an error response from mongo into something suitable to return to a client
 */
SavedGraphs.prototype.handleError = function (req, res, err) {

    log.error('Error', {username: req.session.username,
                        tenantId: req.session.tenantId,
                        url: req.url,
                        ip: req.ip,
                        error: err});

    var response = {};
    response['code'] = 500;
    response['name'] = err.name;
    response['message'] = 'Unknown Error';
    response.errors = [];

    console.log(err.type);

    if (response.name === 'ValidationError') {
        response.code = 400;
        response.message = err.toString();
    } else if (response.name === "") {

    } else if (response.name === "") {

    }

    return res.send(response.code, response);
};

SavedGraphs.prototype.getAll = function(req, res) {
    this.SavedGraph.find({ tenantId: req.session.tenantId }, function (err, graphs) {
        if (err) {
            this.handleError(req, res, err);
        }
        log.info('GET', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip, count: graphs.length});
        res.send(graphs);
    }.bind(this));
};

SavedGraphs.prototype.get = function(req, res) {
    var id = req.params.id;

    this.SavedGraph.findOne({ tenantId: req.session.tenantId, _id: id }, function (err, graph) {
        log.info('GET', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip, id: id, found: !!graph, error: err});
        if (err || !graph) {
          res.send(404);
        } else {
          res.send(graph);
        }
    }.bind(this));
};

SavedGraphs.prototype.post = function(req, res) {
    var graph;
    var data = req.body;
    data['tenantId'] = req.session.tenantId;
    graph = new this.SavedGraph(data);
    graph.save(function (err, g) {
        if (err) {
            this.handleError(req, res, err);
        } else {
            log.info('POST', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip});
            res.send(g);
        }
    }.bind(this));
};

SavedGraphs.prototype.put = function(req, res) {
    log.info('PUT', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip});
    res.send(204);
};

SavedGraphs.prototype.del = function(req, res) {
    var id = req.params.id;

    this.SavedGraph.find({ tenantId: req.session.tenantId, _id: id}, function (err, graphs) {
        if (err) {
            this.handleError(req, res, err);
        } else {
            _.each(graphs, function (graph) {
                graph.remove(function (err) {
                   if (err) {
                        this.handleError(req, res, err);
                    } else {
                        log.info('DELETE', {username: req.session.username, tenantId: req.session.tenantId, ip: req.ip, id: id});
                        res.send(204);
                    }
                });
            });
        }
    }.bind(this));
};

module.exports = SavedGraphs;