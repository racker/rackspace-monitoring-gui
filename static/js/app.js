define([
  'underscore',
  'router',
  'models/models',
  'views/views'
], function(_, Router, Models, Views){

  var app, router;
  var starting = false;
  var started = false;

  /* INIT */
  var _addRouteHandlers = function () {
    app.router.registerHandler('entitiesRoute', function () {Views.entitiesView(app);});
    app.router.registerHandler('entityDetailsRoute', function (id) {Views.entityDetailsView(app, id);});
    app.router.registerHandler('checkDetailsRoute', function (id, cid) {Views.checkDetailsView(app, id, cid);});
    app.router.registerHandler('grapherRoute', function () {Views.grapherView(app);});
    app.router.registerHandler('accountRoute', function () {Views.accountView(app);});
  };

  var _loadData = function (callback) {
    /* Initial Data Load */
    var success = function (model, response) {
      callback();
    };
    /* error callback */
    var error = function (model, response) {
      Views.errorView();
    };
    var account = new Models.Account();
    account.fetch({"success": function (model, response) {
      model.entities.fetch({"success": success, "error": error});
    }, "error": error});
    app.account = account;
  };

  var startApp = function () {

    if (!started && !starting) {
      starting = true;

      app = {};

      /* Show loading view */
      Views.loadingView();

      /* Routing */
      app.router = Router;
      _addRouteHandlers();

      /* Load Initial Data */
      _loadData(function () {
        app.router.start();
        started = true;
        starting = false;
      });
    }
  };

  return {'startApp': startApp};
});
