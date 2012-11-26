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

var _ = require('underscore');
var querystring = require('querystring');
var log = require('logmagic').local('raxmongui.proxy');

var request = require('rackspace-shared-utils/lib/request').request;

function Proxy(settings) {
  this.settings = settings;
}

Proxy.prototype.request = function(req, res) {
    var opts = {expected_status_codes: [/\d\d\d/],
                headers: {'X-Auth-Token': req.session.token,
                          'Accept': 'application/json',
                          'Content-Type': 'application/json'}};

    var url = req.session.url + req.params[0];
    var method = req.route.method.toUpperCase();
    var body = JSON.stringify(req.body);
    var startTime = (new Date()).getTime();

    // add query params if necessary
    if (!_.isEmpty(req.query)) {
        url += '?' + querystring.stringify(req.query);
    }

    // make request
    request(url, method, body, opts, function(err, result) {
        if (err) {
            log.error('Error', {url: url, time: ((new Date()).getTime() - startTime)+'ms', username: req.session.username, tenantId: req.session.tenantId, ip: req.ip, error: err, result: result});
            res.send(500, 'Proxy Request Error');
        } else {
            log.info('Request', {url: url, code: result.statusCode, time: ((new Date()).getTime() - startTime)+'ms', username: req.session.username, tenantId: req.session.tenantId, ip: req.ip});
            res.set(result.headers).send(result.statusCode, result.body);
        }
    });
};

module.exports = Proxy;
