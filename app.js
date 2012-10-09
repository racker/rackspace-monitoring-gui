var express = require('express');
var app = express();

var MongoStore = require('connect-mongo')(express);

var settings = require('./settings');
var api = require('./api');


app.configure(function(){
  app.use(express.static(__dirname + "/static"));

  app.use(express.bodyParser());
  app.use(express.cookieParser());

  // sesh and routing
  app.use(express.session({
    key: 'raxmon-gui',
    secret: settings.secret,
    store: new MongoStore(settings.db)
  }));

  // set some vars available in every view
  app.locals = {
    title: "Rackspace Monitoring",
    errors: []
  };

  // session middleware
  app.use(function(req, res, next){

    //check for session and redirect if so
    if (!req.session.hasOwnProperty('authToken')) {
      if (req.url != '/login') {
        res.redirect('/login');
      }
    }

    // made session available in the response (I know.. I know..)
    res.locals.session = req.session;
    next();
  });

  //app.use(app.router);

  // views
  app.set("views", __dirname + "/views");
  app.set('view engine', 'jade');
  app.set('view options', { layout: false,
                            pretty: true });

});

// INDEX
app.get('/', function(req, res){
    res.render('index.jade');
});

app.get('/plot', function(req, res){
    res.render('plot.jade');
});

//LOGIN
app.post('/login', function(req, res) {

  var save_session, opts;

  save_session = (req.body.remember_me == "on");

  opts = {
    url: settings.authUrl,
    username: req.body.username,
    password: req.body.password
  };

  if (!opts.url) {
    res.render('login.jade', {errors: ['This site is misconfigured - "authUrl" not found in settings.js']});
    return;
  }

  if (!opts.username || !opts.password) {
    res.render('login.jade', {errors: ['A Username and Password are Required.']});
    return;
  }

  api.authenticate(opts, function(err, results) {

    if (err) {
      res.render('login.jade', {errors: [err]});
    }
    else {
      req.session.username = opts.username;
      req.session.authToken = results.authToken;
      req.session.url = results.url;
      req.session.tenantId = results.tenantId;

      if (save_session) {
        // expire the session 1 hour before the token expires
        req.session.cookie.expires = results.expiresIn - 3600000;
      }
      else {
        // expire the session on broswer close
        req.session.cookie.expires = false;
      }
      res.redirect('/');
    }
  });
});

app.get('/login', function(req, res) {
    var context = {errors: []};
    res.render('login.jade', context);
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

app.all(/^\/proxy(.*)/, api.proxy_request);

app.listen(3000);
