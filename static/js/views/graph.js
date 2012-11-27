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

    var savedGraphListView;
    var plotView;

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

    var SavedGraphPlotView = Backbone.View.extend({

        metrics: {},
        data: {},
        period: 0,

        events: {"resize": "_resizeHandler"},

        _resizeHandler: function () {
            this.render(true);
        },

        initialize: function() {
            this.$loading_el = $('<img>')
                                    .addClass('chart-spinner')
                                    .attr('src', '/images/loading_spinner.gif');
            this.$el.append(this.$loading_el);

            this.$title_el = $('<h4>').addClass('chart-title');
            this.$el.append(this.$title_el);

            this.$period_el = $('<div>')
                                    .addClass('btn-group pull-right')
                                    .append(
                                        $('<button>')
                                            .addClass('btn dropdown-toggle')
                                            .attr('data-toggle', 'dropdown')
                                            .append(
                                                "Last day",
                                                $('<span>')
                                                    .addClass('caret')
                                            ),
                                        $('<ul>')
                                            .addClass('dropdown-menu'));
            this.$el.append(this.$period_el);

            this.chart_id = "chart-" + (this.model.id || this.model.cid);
            this.$chart_el = $('<div>').attr('id', this.chart_id);
            this.$el.append(this.$chart_el);

            this.chart = this._constructChart();

            var hour = 60*60*1000;

            this.dates = {
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
            },

            _.each(this.dates, function(p) {
                    var $target = this.$period_el.children("ul");

                    $target.append(
                        $('<li>').append(
                            $('<a>').click(function() {
                                this.setPeriod(p.offset, false);
                                this.$period_el.children('button').html(p.text + ' <span class="caret"></span');
                            }.bind(this))
                            .append(p.text)
                        )

                    );
                }, this);
            this.setPeriod(this.dates['day'].offset, true);
        },

        bind: function(savedgraph) {
            this.model.off('change', this.render);
            this.model.on('change', this.render);
        },

        setPeriod: function(p, no_refresh) {
            this.period = p;
            this.render(no_refresh);
        },

        getPeriod: function() {
            return this.period;
        },

        /*
         * returns a Date() object
         * offset - a key in the 'dates' object or 'now'
         */
        _getDate: function(offset) {

            var now = new Date();

            if (!offset) {
                return now;
            } else {
                var now_ms = now.getTime();
                return new Date(now_ms - offset);
            }
        },

        _getDomain: function() {
            return [this._getDate(this.getPeriod()), this._getDate()];
        },

        _constructChart: function() {
            var fake = crossfilter([{x:0, y:1}]);

            var fakeDimension = fake.dimension(function(d){
                return d.x;
            });

            var fakeGroup = fakeDimension.group().reduceSum(function(d){
                return d.y;
            });

            var chart = dc.compositeChart("#" + this.chart_id, this.chart_id);
            chart.width($(this.el).width())
                .height(400)
                .transitionDuration(500)
                .margins({top: 10, right: 10, bottom: 30, left: 40})
                .dimension(fakeDimension)
                .group(fakeGroup)
                .yAxisPadding(100)
                .xAxisPadding(500)
                .x(d3.time.scale().domain(this._getDomain()))
                .renderHorizontalGridLines(true)
                .renderVerticalGridLines(true)
                .brushOn(false);

            return chart;
        },

        _getMetricKey: function(metric) {
            return [metric.get('entity_id'), metric.get('check_id'), metric.get('name')].join();
        },

        _getMetrics: function() {
            return _.map(this.model.get('series'), function(s) {
                return new Models.Metric({entity_id: s.entityId, check_id: s.checkId, name: s.metricName});
            });
        },

        /* Asynchronously fetch the data for a metric.  Returns a deferred that will
           be resolved with the fetched data */
        _getMetricData: function(metric, now) {
            return metric.getData(now - this.getPeriod(), now, 500);
        },

        /* Refresh the data for the given metric, storing it into this.data.
           Returns a deferred that fires when this task has been completed. */
        _refreshMetricData: function(metric, now) {
            return _getData(metric, now).then(function(d){
                this.data[_getMetricKey(metric)] = d;
            });
        },

        /* Refresh the data for all metrics, storing them in this.data.
           Returns a deferred that fires when all metric data has been refreshed */
        _refreshAllData: function(options) {
            now = (new Datetime()).getTime();

            var refreshFuncs = _.map(this._getMetrics(), function(m) {
                return _refreshMetricData(m, now);
            });

            return $.when.apply(this, refreshFuncs).done();
        },

        /* Fetch */
        _getChart: function(metric, parentChart, now) {
            return this._getMetricData(metric, now).then(function(response) {
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
        },

        /* Return a list of charts, one for each metric, that are suitable to constuct a compound chart for graphing */
        _getCharts: function(parentChart) {
            var now = this._getDate().getTime();
            return _.map(this._getMetrics(), function(m){
                return this._getChart.bind(this)(m, parentChart, now);
            }, this);
        },

        /* Get a list of deferreds, one for each chart to be generated, based upon asynchronous
           HTTP requests to the monitoring API. When all deferreds are done, then construct the
           composite chart and render it. */
        render: function(no_refresh) {

            if(no_refresh) {
                this.chart.width($(this.el).width());
                dc.renderAll(this.chart_id);
                return;
            }

            this.$chart_el.fadeTo(300, 0.1);
            this.$loading_el.show();

            return $.when.apply(this, this._getCharts(this.chart)).done(function(){

                var charts = _.map(arguments, function(d){return d[0];});

                // Perform some math to find the min for the y axis
                var mins = _.map(arguments, function(d){return d[1];});
                mins.push(0);
                var min = Math.min.apply(null, mins);

                // Perform some math to find the max for the y axis
                var maxs = _.map(arguments, function(d){return d[2];});
                maxs.push(0);
                var max = Math.max.apply(null, maxs);


                this.chart.x(d3.time.scale().domain(this._getDomain()))
                        .y(d3.scale.linear().domain([min, max*1.25]))
                        .compose(charts); // Use magic arguments "array" containind all of the constructed charts

                dc.renderAll(this.chart_id);

                this.$loading_el.hide();
                this.$chart_el.fadeTo(100, 1);
                this.$title_el.html(this.model.get('name') || 'Unsaved Graph');
            }.bind(this));
        },

        /*
         * TODO: This will leak memory - dc doesn't provide a reasonable way to remove a graph from it's internal
         * registry
         */
        destroy: function () {
            this.undelegateEvents();
            this.$el.empty();
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

    var SaveGraphButton = Backbone.View.extend ({

        el: $('#save-graph-button'),
        events: {'click': 'clickHandler'},

        saveSuccess: function (collection, graph) {
            $('#save-graph-modal').modal('hide');
        },

        saveError: function (graph, response) {

            try {
                r = JSON.parse(response.responseText);
            } catch (e) {
                r = {'name': 'UnknownError', 'message': 'UnknownError: An unknown error occured.'};
            }

            $('#graph-name-input-error').empty();
            $('#graph-name-input-control-group').addClass('error');
            $('#graph-name-input-error').html(r.message);
        },

        clickHandler: function () {
            var name = $('#graph-name-input').val();
            var graph = {
                name: name,
                period: getPeriod(),
                series: dumpMetrics()
            };
            App.getInstance().account.graphs.create(graph, {success: this.saveSuccess.bind(this),
                                                            error: this.saveError.bind(this),
                                                            'wait': true});
        }

    });

    var ShowSaveGraphModalButton = Backbone.View.extend ({

        el: $('#show-save-graph-modal-button'),
        events: {'click': 'clickHandler'},

        clickHandler: function () {
            $('#save-graph-modal').modal('show');
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
        var saveGraphButton, showSaveGraphModalButton;

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

        saveGraphButton = new SaveGraphButton();
        showSaveGraphModalButton = new ShowSaveGraphModalButton();

        app.account.graphs.fetch({"success": graph_fetch_success, "error": graph_fetch_failure});

    }

    function renderGraph (id) {

        Views.renderView('grapher');

        _populateEntityTable();
        _populateSavedGraphsTable();

        function _render(g) {
            dc.deregisterAllCharts();

            if (plotView) {
                plotView.destroy();
            }
            plotView = new SavedGraphPlotView({el: "#chart-container", model: g});
            plotView.render();
        }

        function _fetch_success(g) {
            _render(g);
        }

        function _fetch_error() {
            window.location.hash = "#grapher";
            $("#chart-container").empty();
        }

        // Load a saved graph if it exists
        if(id) {
            new Models.SavedGraph({"_id": id}).fetch({success: _fetch_success, error: _fetch_error});
        } else {
            var g = new Models.SavedGraph();
            _render(g);
        }


    }

    return {'renderGraph': renderGraph};

});
