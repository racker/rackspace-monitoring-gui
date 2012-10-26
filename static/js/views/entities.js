define([
  'jquery',
  'backbone',
  'underscore',
  'models/models'
], function($, Backbone, _, Models) {

    var entitiesView;

    /* This should be bound to a model, so updates should rerender correctly */
    var EntityView = Backbone.View.extend({
        tagName: 'li',
        template: _.template("<li><%= label %></li>"),
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

    var render = function (app) {
        if (!entitiesView) {
            entitiesView = new EntitiesView();
        }
        entitiesView.render();
        app.account.entities.each(function (e) {
            entitiesView.add(e);
        });
    };

    return {'render': render};

});
