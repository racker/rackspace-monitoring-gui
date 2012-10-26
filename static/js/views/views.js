define([
  'jquery',
  'backbone',
  'underscore',
  'views/entities'
], function($, Backbone, _, Entities) {

    /* Hides/Shows Relevant Stuff depending on the view */
    var _renderView = function (view) {
        /* Switch nav link */
        $('[id$=view-link]').removeClass('active');
        $('#' + view + '-view-link').addClass('active');
        /* Hide/Show relevant divs */
        $('[id$=view-content]').addClass('hide');
        $('#' + view + '-view-content').removeClass('hide');
    };

    /* Route Handlers */
    var errorView = function () {
        _renderView('error');
    };

    var loadingView = function () {
        _renderView('loading');
    };

    var browserView = function (app) {
       Entities.render(app);
       _renderView('browser');
    };

    var grapherView = function (app) {
        _renderView('grapher');
    };

    var accountView = function (app) {
        _renderView('account');
    };

    return {'browserView': browserView, 'grapherView': grapherView, 'accountView': accountView, 'loadingView': loadingView, 'errorView': errorView};

});
