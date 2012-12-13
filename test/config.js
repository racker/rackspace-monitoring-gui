var requirejs = require('requirejs');
var jsdom = require('jsdom');
var jasmine = require('jasmine-node');

requirejs.config({
  nodeRequire: require,
  baseUrl: __dirname + '/../static/js/',
  
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

// hackity hack hack McHackerson
var initialize = function () {
  global.document = jsdom.jsdom("<html><body><div id='test'></div></body></html>", jsdom.level(1, "core"));
  global.window = jsdom.jsdom().createWindow();
};

module.exports = {requirejs: requirejs, initialize: initialize};
