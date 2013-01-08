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
              Backbone.history.navigate('entities', true);
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


        // Created by Kendall Buchanan, (https://github.com/kendagriff)
        // Modified by Paul English, (https://github.com/nrub)
        // MIT licence
        // Version 0.0.2
        var _loadUrl = Backbone.History.prototype.loadUrl;

        Backbone.History.prototype.loadUrl = function(fragmentOverride) {
          var matched = _loadUrl.apply(this, arguments),
              fragment = this.fragment = this.getFragment(fragmentOverride);

          if (!/^\//.test(fragment)) fragment = '/' + fragment;
          if (window._gaq !== undefined) window._gaq.push(['_trackPageview', fragment]);

          return matched;
        };

        Backbone.history.start();
        started = true;
      }
      return router;
  };

  return {'start': start};

});
