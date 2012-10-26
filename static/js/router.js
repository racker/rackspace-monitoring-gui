/* Default Router */
define([
  'jquery',
  'backbone',
  'underscore'
], function($, Backbone, _) {

  var router;
  var started = false;

  /* Backbone router - change this to add/remove routes */
  var getRouter = function () {

    if (!router) {
      var Router = Backbone.Router.extend({
          
          routes: {
              "browser": "browserRoute",
              "grapher": "grapherRoute",
              "account": "accountRoute",
              '*path':  'defaultRoute'
          },

          defaultRoute: function(path) {
              window.location.hash = 'browser';
          }
      });
      router = new Router();
    }

    return router;
  };

  /* Starts Router (if needed) */
  start = function () {
      if (!started) {
        router = getRouter();
        Backbone.history.start();
        started = true;
      }
      return router;
  };

  registerHandler = function (route, f) {
    router.on('route:'+route, f);
  };

  return {'start': start, 'router': getRouter(), 'registerHandler': registerHandler};

});
