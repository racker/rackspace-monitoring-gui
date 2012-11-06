define([], function(){

  var app, router;

  var initialize = function (obj) {
    if (!app) {
      app = obj;
    }
  };

  var getInstance = function () {
    return app;
  };

  return {'initialize': initialize, 'getInstance': getInstance};
});
