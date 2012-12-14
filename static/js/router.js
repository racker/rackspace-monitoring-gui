/* Default Router */
define([
  'jquery',
  'backbone',
  'underscore',
  'views/views',
  'views/entities',
  'views/checks',
  'views/alarms',
  'views/graph',
  'views/notifications'
], function($, Backbone, _, Views, EntityViews, CheckViews, AlarmViews, Graph, NotificationViews) {

  var router;
  var started = false;

  var _addRouteHandlers = function () {
    router.on('route:notificationsRoute', function () {NotificationViews.renderNotificationsList();});
    router.on('route:notificationPlanDetailsRoute', function (id) {NotificationViews.renderNotificationPlanDetails(id);});
    router.on('route:entitiesRoute', function () {EntityViews.renderEntitiesList();});
    router.on('route:entityDetailsRoute', function (id) {EntityViews.renderEntityDetails(id);});
    router.on('route:checkDetailsRoute', function (id, cid) {CheckViews.renderCheckDetails(id, cid);});
    router.on('route:alarmDetailsRoute', function (id, aid) {AlarmViews.renderAlarmDetails(id, aid);});
    router.on('route:grapherRoute', function (id) {Graph.renderGraph(id);});
    router.on('route:accountRoute', function () {Views.renderAccount();});
  };

  /* Backbone router - change this to add/remove routes */
  var initialize = function () {

    if (!router) {
      var Router = Backbone.Router.extend({
          
          routes: {
              "notifications": "notificationsRoute",
              "notification_plans/:id": "notificationPlanDetailsRoute",
              "entities": "entitiesRoute",
              "entities/:id": "entityDetailsRoute",
              "entities/:id/checks/:cid": "checkDetailsRoute",
              "entities/:id/alarms/:aid": "alarmDetailsRoute",
              "grapher/:id": "grapherRoute",
              "grapher": "grapherRoute",
              "account": "accountRoute",
              '*path':  'defaultRoute'
          },

          defaultRoute: function(path) {
              window.location.hash = 'entities';
          }
      });

      router = new Router();
      _addRouteHandlers();
    }

    return router;
  };

  /* Starts Router (if needed) */
  start = function () {
      if (!started) {
        router = initialize();
        Backbone.history.start();
        started = true;
      }
      return router;
  };

  return {'start': start};

});
