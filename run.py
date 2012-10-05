#!/usr/bin/env python

import os
import requests
from lib import bottle
from lib.plugins import SessionPlugin, RequireSession

try:
    import simplejson as json
except ImportError:
    import json

import settings

bottle.TEMPLATE_PATH = [os.path.dirname(os.path.realpath(__file__)) + '/views']
STATIC_DIR = os.path.dirname(os.path.realpath(__file__)) + '/static'

require_session = RequireSession()
session = SessionPlugin(cookie_name=settings.COOKIE_NAME, cookie_secret=settings.COOKIE_SECRET)
bottle.install(session)
bottle.install(require_session)


@bottle.route('/')
def index(sesssion):
    return bottle.template('index', debug=settings.DEBUG, session=session)


@bottle.get('/entities/:entity_id/checks/:check_id/metrics/:metric_name', skip=require_session)
@bottle.get('/proxy/entities/:entity_id/checks/:check_id/metrics/:metric_name', skip=require_session)
def rollups_data(session, entity_id=None, check_id=None, metric_name=None):
    from_time = 1000 * long(bottle.request.query['from']) if 'from' in bottle.request.query else 0
    to_time = 1000 * long(bottle.request.query['to']) if 'to' in bottle.request.query else 0
    get_by_points = True
    points = 0
    resolution = ''
    data = []

    if 'resolution' in bottle.request.query:
        get_by_points = False
        resolution = bottle.request.query['resolution']
    elif 'points' in bottle.request.query:
        points = long(bottle.request.query['points'])

    bottle.response.content_type = "application/json"
    base_url = '/entities/' + entity_id + '/checks/' + check_id + '/metrics/' + metric_name
    url = ''
    if get_by_points:
        url = base_url + '?from=' + str(from_time) + '&to=' + str(to_time) + '&points=' + str(points)
    else:
        url = base_url + '?from=' + str(from_time) + '&to=' + str(to_time) + '&resolution=' + str(resolution)

    r = _auth_request(session, requests.get, url)
    data.extend(r.json['values'])
    next_marker = r.json['metadata'].get('next_marker', None)

    while(next_marker):
        r = _auth_request(session, requests.get, url)
        data.extend(r.json['values'])
        next_marker = r.json['metadata'].get('next_marker', None)

    print json.dumps(data)
    return json.dumps(data)


#@bottle.get('/entities/:entity_id/checks/:check_id/metrics/:metric_name')
@bottle.get('/plot')
def plot_metrics(session, entity_id=None, check_id=None, metric_name=None):
    errors = []
    return bottle.template('plot', debug=settings.DEBUG, errors=errors, session=session)


def _auth_request(session, request_func, path, *args, **kwargs):
    headers = kwargs.pop('headers', dict())
    headers['X-Auth-Token'] = session['auth_token']
    print path
    print session['monitoring_url']
    return request_func(session['monitoring_url'] + path, *args, headers=headers, **kwargs)


@bottle.get('/entities')
def get_entities(session):
    entities = [];

    r = _auth_request(session, requests.get, '/entities')
    entities.extend(r.json['values'])
    next_marker = r.json['metadata'].get('next_marker', None)

    while(next_marker):
        print next_marker
        r = _auth_request(session, requests.get, '/entities?marker=' + next_marker)
        entities.extend(r.json['values'])
        next_marker = r.json['metadata'].get('next_marker', None)

    return json.dumps(entities)

#    return bottle.template('entities', debug=settings.DEBUG, errors=errors, session=session, entities=r.json['values'])


@bottle.get('/entities/:entity_id')
def get_entity(session, entity_id=None):
    r_entity = _auth_request(session, requests.get, '/entities/' + entity_id)
    r_checks = _auth_request(session, requests.get, '/entities/' + entity_id + '/checks')

    if 'json' in bottle.request.query and bottle.request.query['json'] == 'true':
        return json.dumps(r_checks.json['values'])

    errors = []
    return bottle.template('entity', debug=settings.DEBUG, errors=errors, session=session, entity=r_entity.json, checks=r_checks.json['values'])


@bottle.get('/entities/:entity_id/checks')
def get_checks(session, entity_id=None):
    checks = []

    r = _auth_request(session, requests.get, '/entities/' + entity_id + '/checks')
    checks.extend(r.json['values'])
    next_marker = r.json['metadata'].get('next_marker', None)

    while(next_marker):
        r = _auth_request(session, requests.get, '/entities/' + entity_id + '/checks?marker=' + next_marker)
        checks.extend(r.json['values'])
        next_marker = r.json['metadata'].get('next_marker', None)

    return json.dumps(checks)


@bottle.get('/entities/:entity_id/checks/:check_id')
def get_check(session, entity_id=None, check_id=None):
    return ""


@bottle.get('/proxy/entities/:entity_id/checks/:check_id/metrics')
@bottle.get('/entities/:entity_id/checks/:check_id/metrics')
def get_metrics(session, entity_id=None, check_id=None):
    metrics = []
    url = '/entities/' + entity_id + '/checks/' + check_id + '/metrics'
    r = _auth_request(session, requests.get, url)
    metrics.extend(r.json['values'])
    next_marker = r.json['metadata'].get('next_marker', None)

    while(next_marker):
        r = _auth_request(session, requests.get, url + '?marker=' + next_marker)
        metrics.extend(r.json['values'])
        next_marker = r.json['metadata'].get('next_marker', None)

    return json.dumps(metrics)


@bottle.get('/entities/:entity_id/checks/:check_id/metrics/metric_name')
def get_metric(session, entity_id=None, check_id=None):
    return ""


@bottle.get('/login', skip=require_session)
def login(session):
    if session.is_valid():
        bottle.response.status = 303
        bottle.response.set_header('Location', '/')
        return bottle.response
    errors = []
    return bottle.template('login', debug=settings.DEBUG, errors=errors, session=session)


@bottle.post('/login', skip=require_session)
def login(session):
    username = bottle.request.forms.get('username')
    api_key = bottle.request.forms.get('api_key')

    #print username, api_key

    def _auth_body(username, api_key):
        return json.dumps({"credentials": {"username":username, "key":api_key }})

    errors = []
    if username and api_key:
        r = requests.post('https://auth.api.rackspacecloud.com/v1.1/auth',
                          headers={'Content-type': 'application/json'},
                          data=_auth_body(username, api_key))

        session['username'] = username
        session['api_key'] = api_key
        session['auth_token'] = r.json['auth']['token']['id']
        session['auth_token_expires'] = r.json['auth']['token']['expires']
        session['monitoring_url'] = r.json['auth']['serviceCatalog']['cloudMonitoring'][0]['publicURL']

        session.save()

        bottle.response.status = 303
        bottle.response.set_header('Location', '/plot')
        return bottle.response
    else:
        errors.append('Invalid username or password.')
    return bottle.template('login', debug=settings.DEBUG, errors=errors, session=session)


@bottle.route('/logout', skip=require_session)
def logout(session):
    session.logout()
    bottle.response.status = 303
    bottle.response.set_header('Location', '/')
    return bottle.response


@bottle.route('/static/<path:path>', skip=True)
def staticsrv(path):
    return bottle.static_file(path, root=STATIC_DIR)


@bottle.get("/proxy/<path:path>")
def proxy(session, path=None):

    r = _auth_request(session, requests.get, "/" + path, data=bottle.request.body.read(), params=bottle.request.params)

    return json.dumps(r.json) or ""


@bottle.post("/proxy/<path:path>")
def proxy(session, path=None):
    r = _auth_request(session, requests.post, "/" + path, data=bottle.request.body.read())

    try:
        body = r.data
    except AttributeError:
        body = ""

    return bottle.Response(body=body, status=r.status_code, **r.headers)


@bottle.delete("/proxy/<path:path>")
def proxy(session, path=None):
    r = _auth_request(session, requests.delete, "/" + path, data=bottle.request.body.read())

    try:
        body = r.data
    except AttributeError:
        body = ""

    return bottle.Response(body=body, status=r.status_code, **r.headers)


@bottle.put("/proxy/<path:path>")
def proxy(session, path=None):
    r = _auth_request(session, requests.put, "/" + path, data=bottle.request.body.read())

    try:
        body = r.data
    except AttributeError:
        body = ""

    return bottle.Response(body=body, status=r.status_code, **r.headers)

from lib.bottle import PasteServer

bottle.run(host='localhost', port=8080, debug=settings.DEBUG, server=PasteServer)
