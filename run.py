#!/usr/bin/env python

import os, math
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
def index(session):
    return bottle.template('index', debug=settings.DEBUG, session=session)

@bottle.get('/checks/:check_id/metrics')
def index(session, check_id=None):
    start_time = int(bottle.request.query.start_time)
    end_time = int(bottle.request.query.end_time)
    resolution = int(bottle.request.query.resolution)

    data = [(t, math.sin(1000*t)) for t in range(start_time, end_time, 1000/resolution)]

    return json.dumps(data)

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


bottle.run(host='localhost', port=8080, debug=settings.DEBUG)
