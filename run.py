#!/usr/bin/env python

import os, math, requests
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
        func = lambda t: math.sin(float(t)/60/10)
    elif metric_name == 'cos':
        func = lambda t: math.cos(float(t)/60/10)
    elif metric_name == 'a':
        func = lambda t: math.sin(float(t)/60/5)
    elif metric_name == 'b':
        func = lambda t: math.cos(float(t)/60/5) + 1
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

@bottle.get('/entities/:entity_id/checks/:check_id/metrics/:metric_name')
def plot_metric(session, entity_id=None, check_id=None, metric_name=None):
    def _from_dict(d):
        return {'x': d['timestamp'], 'y': d['average']['data']}

    from_time = int(bottle.request.query['from']) if 'from' in bottle.request.query else 0
    to_time = int(bottle.request.query['to']) if 'to' in bottle.request.query else 0

    URL_TEMPLATE = 'http://localhost:8080/mock/entities/{entity_id}/checks/{check_id}/metrics/{metric_name}'
    url = URL_TEMPLATE.format(entity_id=entity_id, check_id=check_id, metric_name=metric_name)
    payload = {'from': from_time, 'to': to_time}

    if 'resolution' in bottle.request.query:
        resolution = bottle.request.query['resolution']
        payload['resolution'] = resolution
        r = requests.get(url, params=payload)
        data_dict = r.json

    elif 'points' in bottle.request.query:
        points = int(bottle.request.query['points'])
        payload['points'] = points
        r = requests.get(url, params=payload)
        data_dict = r.json

    data = [_from_dict(e) for e in data_dict]

    errors = []
    return bottle.template('plot', debug=settings.DEBUG, errors=errors, session=session,
                           entity_id=entity_id, check_id=check_id, metric_name=metric_name,
                           from_time=from_time, to_time=to_time, data=json.dumps(data))

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
    password = bottle.request.forms.get('password')

    print username, password

    errors = []
    if username and password:
        # TODO: actually login
        session['username'] = username
        session['auth_token'] = 'aaa-bbb-ccc'
        session['url'] = 'https://blah.com'
        session.save()
        bottle.response.status = 303
        bottle.response.set_header('Location', '/')
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
