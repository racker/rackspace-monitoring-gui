var https = require('https');
var http = require('http');
var parse = require('url').parse;

var request = function(url, method, body, headers, callback) {

    var parsed, key, req, response;

    parsed = parse(url);
    parsed.method = method;

    if (body) {
        parsed.headers = {'content-length': body.length};
    }

    if (headers) {
      for (key in headers) {
        parsed.headers[key] = headers[key];
      }
    }

    if (parsed.protocol == 'https:') {
        module = https;
    }
    else {
        module = http;
    }

    req = module.request(parsed, function(res) {

      response = '';
      res.setEncoding('utf8');

      res.on('data', function (chunk) {
        response += chunk;
      });

      res.on('end', function () {
        callback(null, {'code': this.statusCode,
                        'body': response});
      });
    });

    if (body) {
        req.write(body);
    }
    req.end();

    req.on('error', function(err) {
        callback(err, null);
    });

};

module.exports = {request: request};
