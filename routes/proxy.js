var URL_PREFIX = '/proxy'

app.all(/^\/proxy(.*)/, api.proxy_request);

app.get(URL_PREFIX + '/entities/:entityid/:checkid')