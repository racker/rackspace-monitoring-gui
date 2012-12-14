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

var express = require('express');
var MongoStore = require('connect-mongo')(express);

// handlers
var SavedGraphs = require('./savedgraphs');
var Auth = require('./auth');
var Proxy = require('./proxy');


var log = require('logmagic').local('raxmongui.app');

function App(settings) {
  this.settings = settings;

  this.auth = new Auth(this.settings);
  this.proxy = new Proxy(this.settings);
  this.savedGraphs = new SavedGraphs(this.settings);

  this.app = express();
  this.app.configure(function(){
  
    this.app.use(express.static(__dirname + "/../" + this.settings.static_path));
    
    this.app.use(express.bodyParser());
    this.app.use(express.cookieParser());
    
    // sesh and routing
    this.app.use(express.session({
      key: 'raxmon-gui',
      secret: settings.secret,
      store: new MongoStore(settings.db)
    }));
    
    // set some vars available in every view
    this.app.locals = {
      title: "Rackspace Monitoring",
      errors: []
    };
    
    // dumb session middleware
    this.app.use(function(req, res, next){
      res.locals.session = req.session;
      if (!req.session.hasOwnProperty('token')) {
        // render login view
        if (req.url === '/login') {
          next();
        // redirect to login
        } else if (req.url === '/' || req.url === '/logout') {
          res.redirect('/login');
        // all other routes are XHR, 403 them
        } else {
          res.send(403);
        }
      } else {
        next();
      }
    });
    
    // views
    this.app.set("views", __dirname + "/views");
    this.app.set('view engine', 'jade');
    this.app.set('view options', { layout: false,
                              pretty: true });
  }.bind(this));

  // Index
  this.app.get('/', function(req, res){
      res.render('index.jade');
  }.bind(this));
  
  // Auth
  this.app.post('/login', function(req, res) {
      this.auth.authenticate(req, res);
  }.bind(this));
  
  this.app.get('/login', function(req, res) {
      res.render('login.jade');
  }.bind(this));
  
  this.app.get('/logout', function(req, res) {
    req.session.destroy();
    res.redirect('/login');
  }.bind(this));
  
  // Saved Graphs
  this.app.get('/saved_graphs', this.savedGraphs.getAll.bind(this.savedGraphs));
  this.app.post('/saved_graphs', this.savedGraphs.post.bind(this.savedGraphs));
  this.app.get('/saved_graphs/:id', this.savedGraphs.get.bind(this.savedGraphs));
  this.app.del('/saved_graphs/:id', this.savedGraphs.del.bind(this.savedGraphs));
  this.app.put('/saved_graphs/:id', this.savedGraphs.put.bind(this.savedGraphs));
  
  // Proxy
  this.app.all(/^\/proxy(.*)/, this.proxy.request.bind(this.proxy));
}

App.prototype.start = function () {
  this.app.listen(this.settings.listen_port);
  log.info('listening on port ' + this.settings.listen_port);
};

module.exports = App;
