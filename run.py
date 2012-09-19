#!/usr/bin/env python

import os, math, requests, random
from lib import bottle
from lib.plugins import SessionPlugin, RequireSession

try: import simplejson as json
except ImportError: import json

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

@bottle.get('/mock/entities/:entity_id/checks/:check_id/metrics/:metric_name', skip=require_session)
def mock_data(session, entity_id=None, check_id=None, metric_name=None):
    def _to_dict(timestamp, data):
        return {'timestamp': timestamp, 'numPoints': 10, 'average': {'type': 'l', 'data': data}}

    from_time = int(bottle.request.query['from']) if 'from' in bottle.request.query else 0
    to_time = int(bottle.request.query['to']) if 'to' in bottle.request.query else 0

    if metric_name == 'sin':
        func = lambda t: math.sin(float(t)/60/60)
    elif metric_name == 'cos':
        func = lambda t: math.cos(float(t)/60/60)
    elif metric_name == 'a':
        func = lambda t: math.sin(float(t)/60/30)
    elif metric_name == 'b':
        func = lambda t: math.cos(float(t)/60/30) + 1
    elif metric_name == 'rand':
        func = lambda t: random.random()
    elif metric_name == 'randsin':
        func = lambda t: math.cos(float(t)/60/30) + random.normalvariate(0, 1)/5 - 1
    else:
        func = lambda t: 0

    if 'resolution' in bottle.request.query:
        resolution = bottle.request.query['resolution']

        if resolution == 'MIN5':
            iter = range(from_time, to_time, 60*5)
        if resolution == 'MIN20':
            iter = range(from_time, to_time, 60*20)
        if resolution == 'MIN60':
            iter = range(from_time, to_time, 60*60)
        if resolution == 'MIN240':
            iter = range(from_time, to_time, 60*240)
        if resolution == 'MIN1440':
            iter = range(from_time, to_time, 60*1440)

        data = [_to_dict(t, func(t)) for t in iter]

    elif 'points' in bottle.request.query:
        points = int(bottle.request.query['points'])
        iter = range(from_time, to_time, (to_time-from_time)/points)
        data = [_to_dict(t, func(t)) for t in iter]
    else:
        data = []

    bottle.response.content_type = "application/json"

    return json.dumps(data)

#@bottle.get('/entities/:entity_id/checks/:check_id/metrics/:metric_name')
@bottle.get('/plot')
def plot_metrics(session, entity_id=None, check_id=None, metric_name=None):
    errors = []
    return bottle.template('plot', debug=settings.DEBUG, errors=errors, session=session)

def _auth_request(session, request_func, path, *args, **kwargs):
    headers = kwargs.pop('headers', dict())
    headers['X-Auth-Token'] = session['auth_token']
    return request_func(session['monitoring_url'] + path, *args, headers=headers, **kwargs)

@bottle.get('/entities')
def get_entities(session):
    r = _auth_request(session, requests.get, '/entities')

    if 'json' in bottle.request.query and bottle.request.query['json'] == 'true':
        return json.dumps(r.json['values'])

    errors = []
    return bottle.template('entities', debug=settings.DEBUG, errors=errors, session=session, entities=r.json['values'])

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
    return ""

@bottle.get('/entities/:entity_id/checks/:check_id')
def get_check(session, entity_id=None, check_id=None):
    return ""

@bottle.get('/entities/:entity_id/checks/:check_id/metrics')
def get_metrics(session, entity_id=None, check_id=None):
    return json.dumps( [{'metricName': 'sin'}, {'metricName': 'cos'}, {'metricName': 'a'}, {'metricName': 'randsin'} ] )

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

    print username, api_key

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
        bottle.response.set_header('Location', '/entities')
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


from lib.bottle import PasteServer

bottle.run(host='localhost', port=8080, debug=settings.DEBUG, server=PasteServer)
