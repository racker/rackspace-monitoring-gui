define([
  'jquery',
  'backbone',
  'underscore',
  'models/models'
], function($, Backbone, _, Models) {

    /* Hides/Shows Relevant Stuff depending on the view */
    var _renderView = function (view) {
        /* Switch nav link */
        $('[id$=view-link]').removeClass('active');
        $('#' + view + '-view-link').addClass('active');
        /* Hide/Show relevant divs */
        $('[id$=view-content]').addClass('hide');
        $('#' + view + '-view-content').removeClass('hide');
    };

    /* This should be bound to a model, so updates should rerender correctly */
    var EntityView = Backbone.View.extend({
        tagName: 'li',
        template: _.template("<li><%= label %> - <%= ip_addresses.public0_v4 %></li>"),
        events: {},

        render: function() {
          $(this.el).html(this.template(this.model.toJSON()));
          return this;
        }
    });

    /* TODO - Ideally this is bound to the collection so updates happen automatically */
    var EntitiesView = Backbone.View.extend({
        el: $('#entity-list'),
        events: {},
    
        initialize: function()
        {
            this._cache = {};
        },
    
        render: function()
        {
            _renderView('browser');
            $(this.el).empty();
            return this;
        },

        add: function(m)
        {
            var e = new EntityView({
                model: m
            });
            this._cache[m.get('id')] = e;
            e.render();
            $(this.el).append(e.el);
        }
    });

    var errorView = function () {
        _renderView('error');
    };

    var loadingView = function () {
        _renderView('loading');
    };

    /* Route Handlers */
    var browserView = function (app) {
        var entitiesView = new EntitiesView();
        entitiesView.render();
        app.account.entities.each(function (e) {
            entitiesView.add(e);
        });
    };

    var grapherView = function (app) {
        _renderView('grapher');
    };

    var accountView = function (app) {
        _renderView('account');
    };

    return {'browserView': browserView, 'grapherView': grapherView, 'accountView': accountView, 'loadingView': loadingView, 'errorView': errorView};

});
