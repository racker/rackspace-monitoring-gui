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

    var entitiesView = function (app) {
       Entities.renderList(app);
       _renderView('entities');
    };

    var entityDetailsView = function (app, id) {
        Entities.renderDetails(app, id);
        _renderView('entity-details');
    };

    var checkDetailsView = function (app, id, cid) {
        Entities.renderCheckDetails(app, id, cid);
        _renderView('check-details');
    };

    var grapherView = function (app) {
        _renderView('grapher');
    };

    var accountView = function (app) {
        _renderView('account');
    };

    return {'entitiesView': entitiesView, 'entityDetailsView': entityDetailsView, 'checkDetailsView': checkDetailsView, 'grapherView': grapherView, 'accountView': accountView, 'loadingView': loadingView, 'errorView': errorView};

});
