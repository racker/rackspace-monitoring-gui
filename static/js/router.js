/* Default Router */
define([
  'jquery',
  'backbone',
  'underscore'
], function($, Backbone, _) {

  var initialize, router, start;

  initialize = function () {

      /* Hides/Shows Relevant Stuff depending on the view */
      var _renderView = function (view) {
          /* Switch nav link */
          $('[id$=view-link]').removeClass('active');
          $('#' + view + '-view-link').addClass('active');
  
          /* Hide/Show relevant divs */
          $('[id$=view-content]').addClass('hide');
          $('#' + view + '-view-content').removeClass('hide');
      };

      /* init Backbone router */
      var Router = Backbone.Router.extend({
          
          routes: {
              "browser": "browserRoute",
              "grapher": "grapherRoute",
              "account": "accountRoute",
              '*path':  'defaultRoute'
          },
      
          browserRoute: function (id) {
              _renderView('browser');
              console.log('browser route');
          },
      
          grapherRoute: function (id) {
              _renderView('grapher');
              console.log('grapher route');
          },
      
          accountRoute: function () {
              _renderView('account');
              console.log('account route');
          },
      
          defaultRoute: function(path) {
              window.location.hash = 'browser';
          }
      });

      router = new Router();
  };

  /* Starts Router */
  start = function () {
      initialize();
      Backbone.history.start();
  };
  return {'start': start, 'router': router};

});
