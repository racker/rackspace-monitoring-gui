require.config({
  paths: {
    jquery: 'extern/jquery/jquery',
    jqueryresize: 'extern/jquery/jquery.ba-resize',
    jquerydebounce: 'extern/jquery/jquery.ba-throttle-debounce',
    underscore: 'extern/underscore/underscore',
    backbone: 'extern/backbone/backbone',
    bootstrap: 'extern/bootstrap/bootstrap',
    crossfilter: 'extern/d3/d3.v2',
    d3: 'extern/crossfilter/crossfilter',
    dc: 'extern/dc/dc'
  },
  shim: {
      'jquery': {
          exports: '$'
      },
      'jqueryresize': {
          deps: ['jquery']
      },
      'jquerydebounce': {
          deps: ['jquery']
      },
      'underscore': {
          exports: '_'
      },
      'backbone': {
          deps: ['underscore', 'jquery'],
          exports: 'Backbone'
      },
      'bootstrap': {
        deps: ['jquery']
      },
      'd3': {
        exports: 'd3'
      },
      'crossfilter': {
        exports: 'crossfilter'
      },
      'dc': {
        deps: ['jquery', 'd3', 'crossfilter'],
        exports: 'dc'
      }
  }
});

define([
  'underscore',
  'app',
  'router',
  'models/models',
  'views/views'
], function(_, App, Router, Models, Views){

  var account, router;

  var initialize = function (account, callback) {

    var error = function (model, response) {
      Views.renderError();
    };

    var entities_fetch_success = function (model, response) {
      callback();
    };

    var account_fetch_success = function (model, response) {
      model.entities.fetch({"success": entities_fetch_success, "error": error});
    };
    account.fetch({"success": account_fetch_success, "error": error});
  };

  /* Show loading view */
  Views.renderLoading();

  /* init */
  account = new Models.Account();
  initialize(account, function () {
    App.initialize({"account": account});
    Router.start();
  });

  return {};
});
