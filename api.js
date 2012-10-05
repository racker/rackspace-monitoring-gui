/* Small CloudMonitoring API helper/proxy */
var request = require('./utils').request;

/* Get cloudMonitoring url from service catalog */
var _get_service_url = function(service_catalog) {

    for (var i in service_catalog) {
        var service = service_catalog[i];
        if (service['name'] == 'cloudMonitoring') {
            return service['endpoints'][0]['publicURL'];
        }
    }
};

/* Authenticate against Rackspace auth and return relevant information
 * http://docs.rackspace.com/auth/api/v2.0/auth-client-devguide/content/Overview-d1e65.html
 */
var authenticate = function(opts, callback) {

    var body, headers, response, authResult;

    body = {};
    if (opts.password) {
        body = {'auth': {'passwordCredentials': {'username': opts.username, 'password': opts.password}}};
    }
    else {
        body = {'auth': {'RAX-KSKEY:apiKeyCredentials': {'username': opts.username, 'apiKey': opts.apiKey}}};
    }
    body = JSON.stringify(body);

    headers = {'accept': 'application/json', 'content-type': 'application/json'};

    request(opts.url, 'POST', body, headers, function (err, result) {

        // errors making the request?
        if (err) {
            console.log('Request Error: ' + err);
            callback('There was an error with the authentication service.', null);
            return;
        }

        // unauthorized?
        if (result.code == 401) {
            callback('Invalid Username or Password.', null);
            return;
        }

        // any other unexpected status code?
        else if (result.code != 200) {
            console.log('Unknown Response: ' + result);
            callback('There was an error with the authentication service.', null);
            return;
        }

        // parse out relevant information from the service catalog
        else {
            try {
                response = JSON.parse(result['body']);
                authResult = {
                    authToken: response['access']['token']['id'],
                    expiresIn: Date.parse(response['access']['token']['expires']) - new Date().getTime(),
                    tenantId: response['access']['token']['tenant']['id'],
                    url: _get_service_url(response['access']['serviceCatalog'])
                };
                callback(null, authResult);
           }
           catch (e) {
                console.log('Something broke parsing an auth response');
                console.log('Exception: ' + e);
                callback('There was an error with the authentication service.' + result, null);
            }
        }
    });
};

module.exports = {authenticate: authenticate};
