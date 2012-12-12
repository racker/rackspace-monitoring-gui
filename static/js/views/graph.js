define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'views/views',
  'views/graphviews',
  'models/models',
  'dc',
  'jqueryresize',
  'bootstrap'
], function($, Backbone, _, App, Views, GraphViews, Models, dc) {

    var graphView;

    function getCurrentGraph() {
        if(!App.getInstance().currentGraph) {
            App.getInstance().currentGraph = new Models.SavedGraph({name: "Untitled Graph", series:[], period: 60*60*1000});
        }
        return App.getInstance().currentGraph;
    }

    var EntityView = Backbone.View.extend({
        tagName: 'tr',
        className: 'entity-row',
        template: _.template("<td><%= label %></td><td><%= id %></td>"),

        events: {'click': 'clickHandler'},

        clickHandler: function () {
            $('.' + this.className).removeClass('success');
            $(this.el).addClass('success');
            _populateCheckTable(this.model);
        },

        render: function() {
            $(this.el).addClass('clickable');
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        }
    });

    var CheckView = Backbone.View.extend({
        tagName: 'tr',
        className: 'check-row',
        template: _.template("<td><%= label %></td><td><%= id %></td>"),

        events: {'click': 'clickHandler'},

        clickHandler: function () {
            _populateMetricTable(this.model);
        },

        render: function () {
            $(this.el).addClass('clickable');
            $(this.el).html(this.template(this.model.toJSON()));
        }
    });

    var MetricView = Backbone.View.extend({
        tagName: 'tr',
        className: 'metric-row',
        template: _.template("<td><%= name %></td>"),

        events: {'click': 'clickHandler'},

        clickHandler: function () {
            getCurrentGraph().addMetric(this.model);
            _renderGraph(getCurrentGraph());
        },

        render: function () {
            $(this.el).addClass('clickable');
            $(this.el).html(this.template(this.model.toJSON()));
        }
    });

    var EntityListView = Backbone.View.extend({
        events: {},

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
            e.render();
            $(this.el).append(e.el);
        }
    });

    var CheckListView = Backbone.View.extend({
        events: {},

        render: function()
        {
            $(this.el).empty();
            return this;
        },

        add: function(m)
        {
            var e = new CheckView({
                model: m
            });
            e.render();
            $(this.el).append(e.el);
        }
    });

    var MetricListView = Backbone.View.extend({
        events: {},

        render: function()
        {
            $(this.el).empty();
            return this;
        },

        add: function(m)
        {
            var e = new MetricView({
                model: m
            });
            e.render();
            $(this.el).append(e.el);
        }
    });



    function _populateSelectedMetrics (graph) {

        var selectedMetricsView = new SelectedMetricsView({el: $('#selected-metrics')});
        selectedMetricsView.render();
    }

    function _populateMetricTable (check) {
        var app = App.getInstance();
        var metricListView;

        var metric_fetch_success = function (collection, response) {

            metricListView = new MetricListView({'el': $('#metric-table')});
            metricListView.render();
            collection.each(function (metric) {
                metricListView.add(metric);
            });

        };

        var metric_fetch_failure = function (collection, response) {
            $('#metric-table').html('<tr><td>Failed to fetch metrics</td></tr>');

        };

        $('#metric-table').html('<tr><td>loading metrics</td></tr>');
        check.metrics.fetch({"success": metric_fetch_success, "error": metric_fetch_failure});

    }

    function _populateCheckTable (entity) {
        var app = App.getInstance();
        var checkListView;

        var check_fetch_success = function (collection, response) {

            checkListView = new CheckListView({'el': $('#check-table')});
            checkListView.render();
            collection.each(function (check) {
                checkListView.add(check);
            });

        };

        var check_fetch_failure = function (collection, response) {
            $('#check-table').html('<tr><td>Failed to fetch checks</td></tr>');

        };

        $('#metric-table').empty();
        $('#check-table').html('<tr><td>loading checks</td></tr>');
        entity.checks.fetch({"success": check_fetch_success, "error": check_fetch_failure});

    }

    function _populateEntityTable () {

        var app = App.getInstance();
        var entityListView;


        entityListView = new EntityListView({'el': $('#entity-table')});
        entityListView.render();
        app.account.entities.each(function (entity) {
            entityListView.add(entity);
        });

    }

    function _renderGraph() {
        dc.deregisterAllCharts();


        // plotView = new GraphViews.PlotterView({el: "#chart-container", model: getCurrentGraph()});
        // plotView.render();

        // var savedGraphListView = new GraphViews.SavedGraphListView({el: $("#saved-graph-container"), collection: App.getInstance().account.graphs});
        // savedGraphListView.render();

        if (graphView) {
            graphView.destroy();
        }
        graphView = new GraphViews.GraphView({el: $("#graph-container"), model: getCurrentGraph()});

    }

    function renderGraph (id) {
        Views.renderView('grapher');

        _populateEntityTable();

        function _fetch_success(savedGraphs) {
            App.getInstance().currentGraph = savedGraphs.get(id);
            _renderGraph();
        }

        function _fetch_error() {
            window.location.hash = "#grapher";
            $("#chart-container").empty();

        }
        // Load a saved graph if it exists
        App.getInstance().account.graphs.fetch({success: _fetch_success, error: _fetch_error});
    }

    return {'renderGraph': renderGraph};

});
