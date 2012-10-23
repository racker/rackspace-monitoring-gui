/* setup common paths for require.js */
require.config({
  paths: {
    jquery: '/js/extern/jquery/jquery',
    underscore: '/js/extern/underscore/underscore',
    backbone: '/js/extern/backbone/backbone',
    boostrap: '/js/extern/bootstrap/bootstrap'
  },
  shim: {
      'jquery': {
          exports: '$'
      },
      'underscore': {
          exports: '_'
      },
      'backbone': {
          deps: ['underscore', 'jquery'],
          exports: 'Backbone'
      },
      'bootstrap': ['bootstrap']
  }
});

define([
  'router'
], function(Router){
  Router.start();
  return {};
});