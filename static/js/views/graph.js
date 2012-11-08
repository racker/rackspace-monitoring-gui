define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'views/views',
  'rickshaw'
], function($, Backbone, _, App, Views, Rickshaw) {

    var seriesData, palette, graph, hoverDetail, axes;

    var hour = 60*60*1000;
    var dates = {
        "hour": {text: "Last hour", offset: hour, dateformat: "%l:%M"},
        "6hour": {text: "Last 3 hours", offset: 3*hour, dateformat: "%l:%M"},
        "day": {text: "Last day", offset: 24*hour, dateformat: "%l:%M"},
        "week": {text: "Last week", offset: 7*24*hour},
        "month": {text: "Last month", offset: 30*24*hour},
        "6month": {text: "Last 6 months", offset: 182*24*hour},
        "year": {text: "Last year", offset: 365*24*hour}

    };

    /*
     * returns a Date() object
     * offset - a key in the 'dates' object or 'now'
     */
    function getDate(offset) {

        var now = new Date();

        if (!offset) {
            return now;
        } else {
            var now_ms = Math.round(now.getTime());
            var offset_ms = dates[offset].offset;
            return new Date(now_ms - offset_ms);
        }
    }

    /*
     * returns a Date() object offset by the given period
     * period - a key in the 'dates' object
     */
    function getOffset(period) {
        var offset = new Date(now() - dates[period].offset);
        return offset;
    }

    function getSeries() {
        if (!seriesData) {
            seriesData = [];
        }
        return seriesData;
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
            $('.' + this.className).removeClass('success');
            $(this.el).addClass('success');
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
            $(this.el).addClass('success');
            addSeries(this.model);
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

    // Add a metric series to the current graph or make a new graph
    function addSeries (metric) {

        var get_data_success = function (data) {

            var d = {'color': palette.color(),
                     'data': [],
                     'name': metric.get('name')};
            var series = getSeries();
            _.each(data, function (point) {
                d.data.push({'x': point.timestamp.getTime(),
                             'y': point.average});
            });
            series.push(d);

            _renderGraph();

        };

        var get_data_error = function () {
            console.log('Failed to fetch metric data');
        };

        metric.getData(getDate('hour'), getDate(), 10, {'success': get_data_success, 'error': get_data_error});
    }

    function delSeries(metric) {


    }

    function getSeries() {


    }

    function setPeriod(period) {


    }

    function getPeriod() {


    }

    function _renderGraph () {

        var d = getSeries();
        if (!d) {
            return;
        }

        if (!graph) {
            graph = new Rickshaw.Graph( {
                element: $('#chart').get(0),
                renderer: 'line',
                width: 960,
                height: 500,
                series: d
            } );

            graph.render();

            hoverDetail = new Rickshaw.Graph.HoverDetail( {
                graph: graph
            } );

            axes = new Rickshaw.Graph.Axis.Time( {
                graph: graph
            } );

            axes.render();

        } else {
            graph.update();
        }
    }

    function renderGraph () {

        Views.renderView('grapher');

        if (!palette) {
            palette = new Rickshaw.Color.Palette();
        }

        _populateEntityTable();

    }

    return {'renderGraph': renderGraph, 'addSeries': addSeries, 'delSeries': delSeries, 'getSeries': getSeries, 'setPeriod': setPeriod, 'getPeriod': getPeriod};

});
