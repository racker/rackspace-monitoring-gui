define([
  'jquery',
  'backbone',
  'underscore',
  'models/models',
  'bootstrap'
], function($, Backbone, _, Models) {

    var grapherView;

    var metricGraphCollection;

    // /* This should be bound to a model, so updates should rerender correctly */
    // var EntityView = Backbone.View.extend({
    //     tagName: 'li',
    //     template: _.template("<li><%= label %></li>"),
    //     events: {},

    //     render: function() {
    //       $(this.el).html(this.template(this.model.toJSON()));
    //       return this;
    //     }
    // });

    var GrapherMetricCollection = Backbone.Collection.extend({
        model: Models.Metric
    });

    /* TODO - Ideally this is bound to the collection so updates happen automatically */
    var GrapherView = Backbone.View.extend({
        el: $('#graphersvg'),
        events: {},

        initialize: function()
        {
            // this._cache = {};
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
        if (!grapherView) {
            grapherView = new GrapherView();
        }
        grapherView.render();
        app.account.entities.each(function (e) {
            entitiesView.add(e);
        });
    };

    var addMetric = function(metric) {

    };

    var removeMetric = function(metric) {

    };

    var setTimeScale = function(start_time, end_time) {


    };

    return {'render': render};

});
