define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'views/views',
  'dc',
  'jqueryresize',
  'bootstrap'
], function($, Backbone, _, App, Views, dc) {

    metricMap = {};
    var palette = d3.scale.category10();
    var graph, hoverDetail, axes;

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

    _.each(dates, function(p) {
        $target = $("#daterangeselect > ul");

        $target.append(
            $('<li>').append(
                $('<a>').click(function() {setPeriod(p.offset);})
                .append(p.text)
            )

        );
    });

    var period = dates["day"].offset;

    function setPeriod(p) {
        period = p;
        _renderGraph();
    }

    function getPeriod() {
        return period;
    }

    /*
     * returns a Date() object
     * offset - a key in the 'dates' object or 'now'
     */
    function getDate(offset) {

        var now = new Date();

        if (!offset) {
            return now;
        } else {
            var now_ms = now.getTime();
            return new Date(now_ms - offset);
        }
    }

    function getDomain() {
        return [getDate(getPeriod()), getDate()];
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
            toggleMetric(this.model);
            if(inMetrics(this.model)) {
                $(this.el).addClass('success');
            } else {
                $(this.el).removeClass('success');
            }
        },

        render: function () {
            $(this.el).addClass('clickable');
            if(inMetrics(this.model)) {
                $(this.el).addClass('success');
            }
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

    function _getMetricKey(metric) {
        return [metric.get('entity_id'), metric.get('check_id'), metric.get('name')].join();
    }

    function inMetrics(metric) {
        return _getMetricKey(metric) in metricMap;
    }

    function addMetric (metric) {
        metricMap[_getMetricKey(metric)] = metric;
        _renderGraph();
    }

    function delMetric(metric) {
        delete metricMap[_getMetricKey(metric)];
        _renderGraph();
    }

    function getMetrics() {
        var metrics = [];
        for(var key in metricMap) {
            metrics.push(metricMap[key]);
        }
        return metrics;
    }

    function toggleMetric(metric) {
        if(inMetrics(metric)) {
            delMetric(metric);
        } else {
            addMetric(metric);
        }
        _renderGraph();
    }

    function _getRecentData(metric, options) {
        return metric.getRecentData(getPeriod(), 100, options);
    }

    /* Fetch */
    function _getChart(metric, parentChart) {
        return _getRecentData(metric).then(function(response) {
            var data = crossfilter(response);

            /* Create a timestamp dimension for this data */
            var dataByTimestamp = data.dimension(function(d){
                return d.timestamp;
            });

            /* For each timestamp, the "group" is the average */
            var dataByTimestampGroup = dataByTimestamp.group().reduceSum(function(d) {
                return d.average;
            });

            var min = Math.min.apply(null, _.map(dataByTimestampGroup.all(), function(d){return d.value;}));

            var max = Math.max.apply(null, _.map(dataByTimestampGroup.all(), function(d){return d.value;}));

            return [dc.lineChart(parentChart).dimension(dataByTimestamp).group(dataByTimestampGroup), min, max]; //.y(d3.scale.linear().domain([min, max]));
        });
    }

    /* Return a list of charts, one for each metric, that are suitable to constuct a compound chart for graphing */
    function _getCharts(parentChart) {
        return _.map(getMetrics(), function(m){
            return _getChart(m, parentChart);
        });
    }

    function _renderGraph () {
        /* Get a list of deferreds, one for each chart to be generated, based upon asynchronous
           HTTP requests to the monitoring API. When all deferreds are done, then construct the
           composite chart and render it. */

        var chart = dc.compositeChart("#chart");

        var fake = crossfilter([{x:0, y:1}]);

        var fakeDimension = fake.dimension(function(d){
            return d.x;
        });

        var fakeGroup = fakeDimension.group().reduceSum(function(d){
            return d.y;
        });

        $.when.apply(this, _getCharts(chart)).done(function(){

            var charts = _.map(arguments, function(d){return d[0];});

            // Perform some math to find the min for the y axis
            var mins = _.map(arguments, function(d){return d[1];});
            mins.push(0);
            var min = Math.min.apply(null, mins);

            // Perform some math to find the max for the y axis
            var maxs = _.map(arguments, function(d){return d[2];});
            maxs.push(0);
            var max = Math.max.apply(null, maxs);


            chart.width($('#chart').width())
            .height(400)
            .transitionDuration(500)
            .margins({top: 10, right: 10, bottom: 30, left: 40})
            .dimension(fakeDimension)
            .group(fakeGroup)
            .yAxisPadding(100)
            .xAxisPadding(500)
            .x(d3.time.scale().domain(getDomain()))
            .y(d3.scale.linear().domain([min, max*1.25]))
            .renderHorizontalGridLines(true)
            .renderVerticalGridLines(true)
            .compose(charts) // Use magic arguments "array" containind all of the constructed charts
            .brushOn(false);

            dc.renderAll();
        });

    }

    function renderGraph () {

        Views.renderView('grapher');

        _populateEntityTable();

        _renderGraph();
        $("#chart").resize(_renderGraph);

    }



    return {'renderGraph': renderGraph, 'addMetric': addMetric, 'delMetric': delMetric, 'getMetrics': getMetrics, 'setPeriod': setPeriod, 'getPeriod': getPeriod};

});
