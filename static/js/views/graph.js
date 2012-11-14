define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'views/views',
  'models/models',
  'dc',
  'jqueryresize',
  'bootstrap'
], function($, Backbone, _, App, Views, Models, dc) {

    var metricMap = {};
    var dataMap = {};
    var title = "";

    var chart;

    var palette = d3.scale.category10();
    var savedGraphListView;

    var activeGraph;


    var el = $('#chart');

    var hour = 60*60*1000;

    var dates = {
        "hour": {text: "Last hour", offset: hour, dateformat: "%l:%M"},
        "6hour": {text: "Last 3 hours", offset: 3*hour, dateformat: "%l:%M"},
        "day": {text: "Last day", offset: 24*hour, dateformat: "%l:%M"},
        "3day": {text: "Last 3 days", offset: 3*24*hour, dateformat: "%l:%M"},
        "week": {text: "Last week", offset: 7*24*hour},
        "2week": {text: "Last 2 weeks", offset: 2*7*24*hour},
        "month": {text: "Last month", offset: 30*24*hour},
        "3month": {text: "Last 3 months", offset: 91*24*hour},
        "6month": {text: "Last 6 months", offset: 182*24*hour},
        "year": {text: "Last year", offset: 365*24*hour}

    };

    _.each(dates, function(p) {
        $target = $("#daterangeselect > ul");

        $target.append(
            $('<li>').append(
                $('<a>').click(function() {
                    setPeriod(p.offset, true);
                    $("#daterangeselect button").html(p.text + ' <span class="caret"></span');
                })
                .append(p.text)
            )

        );
    });

    var period = dates["day"].offset;

    function setPeriod(p, render) {
        period = p;
        if(render){
            _renderGraph(true);
        }
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
            toggleMetric(this.model, true);
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

    var SavedGraphView = Backbone.View.extend({
        tagName: 'tr',
        className: 'saved-graph-row',
        template: _.template("<td><a class='select'><%= name %></a></td><td><a class='delete'>delete</a></td>"),

        events: {'click .select': 'clickHandler',
                 'click .delete': 'deleteHandler'},

        deleteHandler: function () {
            this.model.destroy({'wait': true});
        },

        clickHandler: function () {
            $('.' + this.className).removeClass('success');
            $(this.el).addClass('success');
            window.location.hash = 'grapher/' + this.model.id;
        },

        render: function () {
            $(this.el).addClass('clickable');
            $(this.el).html(this.template(this.model.toJSON()));
        }
    });

    var SavedGraphListView = Backbone.View.extend({
        events: {},

        initialize: function() {
            this.collection.on('add', this.render.bind(this));
            this.collection.on('remove', this.render.bind(this));
            this.rendered = false;
        },

        render: function()
        {
            $(this.el).empty();
            this.collection.each(function (graph) {
                this.add(graph);
            }.bind(this));
            this.rendered = true;
            return this;
        },

        add: function(m)
        {
            var e = new SavedGraphView({
                model: m
            });
            e.render();
            $(this.el).append(e.el);
        }
    });

    var SavedGraphButton = Backbone.View.extend ({

        el: $('#save-graph-button'),
        events: {'click': 'clickHandler'},

        clickHandler: function () {
            var dummyGraph = {
                name: 'testGraph-'+getDate().getTime(),
                period: getPeriod(),
                series: dumpMetrics()
            };
            App.getInstance().account.graphs.create(dummyGraph, {'wait': true});
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

    function _populateSavedGraphsTable() {

        var app = App.getInstance();
        var savedGraphButton;

        var graph_fetch_success = function (collection, response) {

            if (!savedGraphListView) {
                savedGraphListView = new SavedGraphListView({'el': $('#saved-graph-table'), 'collection': collection});
            }
            if (!savedGraphListView.rendered) {
                savedGraphListView.render();
            }
        };

        var graph_fetch_failure = function (collection, response) {
            $('#saved-graph-table').html('<tr><td>Failed to fetch graphs</td></tr>');

        };

        savedGraphButton = new SavedGraphButton();
        savedGraphButton.render();

        app.account.graphs.fetch({"success": graph_fetch_success, "error": graph_fetch_failure});

    }

    function dumpMetrics() {
        series = [];
        for(var key in metricMap) {
            m = metricMap[key];
            series.push({entityId: m.get('entity_id'), checkId: m.get('check_id'), metricName: m.get('name')});
        }
        return series;
    }

    function inMetrics(metric) {
        return _getMetricKey(metric) in metricMap;
    }

    function addMetric (metric, render) {
        metricMap[_getMetricKey(metric)] = metric;
        if(render){
            _renderGraph(true);
        }
    }

    function delMetric(metric, render) {
        delete metricMap[_getMetricKey(metric)];
        if(render){
            _renderGraph(true);
        }
    }

    function getMetrics() {
        var metrics = [];
        for(var key in metricMap) {
            metrics.push(metricMap[key]);
        }
        return metrics;
    }

    function resetMetrics(render) {
        for(var key in metricMap) {
            delete metricMap[key];
        }
        if(render){
            _renderGraph(true);
        }
    }

    function toggleMetric(metric, render) {
        if(inMetrics(metric)) {
            delMetric(metric);
        } else {
            addMetric(metric);
        }
        if(render){
            _renderGraph(true);
        }
    }

    function _getData(metric, now, options) {
        return metric.getData(now - getPeriod(), now, 500, options);
    }

    /* Fetch */
    function _getChart(metric, parentChart, now) {
        return _getData(metric, now).then(function(response) {
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

            return [dc.lineChart(parentChart).dimension(dataByTimestamp).group(dataByTimestampGroup).title(function(d) {return "Value: " + d.value; }).renderTitle(true), min, max];
        });
    }

    /* Return a list of charts, one for each metric, that are suitable to constuct a compound chart for graphing */
    function _getCharts(parentChart) {
        var now = getDate().getTime();
        return _.map(getMetrics(), function(m){
            return _getChart(m, parentChart, now);
        });
    }

    function _renderGraph (fetch_data) {
        /* Get a list of deferreds, one for each chart to be generated, based upon asynchronous
           HTTP requests to the monitoring API. When all deferreds are done, then construct the
           composite chart and render it. */



        if(!fetch_data) {
            chart.width($('#chart-container').width());
            dc.renderAll();
            return;
        }

        $('#chart').fadeTo(100, 0.5);
        $('#chart-loading').show();

        // Create new chart
        chart = dc.compositeChart("#chart");

        var fake = crossfilter([{x:0, y:1}]);

        var fakeDimension = fake.dimension(function(d){
            return d.x;
        });

        var fakeGroup = fakeDimension.group().reduceSum(function(d){
            return d.y;
        });

        return $.when.apply(this, _getCharts(chart)).done(function(){

            var charts = _.map(arguments, function(d){return d[0];});

            // Perform some math to find the min for the y axis
            var mins = _.map(arguments, function(d){return d[1];});
            mins.push(0);
            var min = Math.min.apply(null, mins);

            // Perform some math to find the max for the y axis
            var maxs = _.map(arguments, function(d){return d[2];});
            maxs.push(0);
            var max = Math.max.apply(null, maxs);


            chart.width($('#chart-container').width())
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

            $('#chart-loading').hide();
            $('#chart').fadeTo(100, 1)
            $('#chart-title').html(title);
        });

    }

    function resetGraph() {
        resetMetrics(false);
        setPeriod(dates['day'].offset, true);
    }

    function renderGraph (id) {

        Views.renderView('grapher');

        _populateEntityTable();
        _populateSavedGraphsTable();

        // Load a saved graph if it exists
        metricMap = {};
        if(id) {
            new Models.SavedGraph({"_id": id}).fetch({success: function(g) {
                activeGraph = g;
                title = activeGraph.get('name');
                _.each(activeGraph.get('series'), function(s){
                    m = new Models.Metric({entity_id: s.entityId, check_id: s.checkId, name: s.metricName});
                    addMetric(m);
                });
                setPeriod(g.get('period'), false);
                _renderGraph(true);
            }});
        } else {
            title = "Unsaved Graph";
            setPeriod(dates['day'].offset, false);
            _renderGraph(true);

        }
        $("#chart-container").resize(function(){_renderGraph(false);});


    }

    return {'renderGraph': renderGraph, 'addMetric': addMetric, 'delMetric': delMetric, 'getMetrics': getMetrics, 'setPeriod': setPeriod, 'getPeriod': getPeriod};

});
