/* underscore doesn't play nice with require.js, so we need this shim for
 * underscore and those libraries that expect it to be declared in the global
 * scope
 */
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
  'app'
], function(App){
  App.startApp();
  return {};
});
