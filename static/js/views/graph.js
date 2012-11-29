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

    var plotView;
    var graphId;
    var _unsavedGraph;

    function _getGraphById(id) {
        var g = App.getInstance().account.graphs.get(id);
        if(!g) {
            if (!_unsavedGraph) {
                _unsavedGraph = new Models.SavedGraph({name: "Untitled Graph", series:[]});
            }
            g = _unsavedGraph;
        }
        return g;
    }

    function _getCurrentGraph() {
        return _getGraphById(graphId);
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
            _getCurrentGraph().addMetric(this.model);
            _renderGraph(_getCurrentGraph());
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

    var SavedGraphPlotView = Backbone.View.extend({

        metrics: {},
        data: {},
        period: 0,

        events: {"resize": "_resizeHandler"},

        _resizeHandler: function () {
            this.render(null, true);
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

            this.model.on('change', this.render.bind(this));
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
        render: function(e, no_refresh) {

            if(no_refresh) {
                this.chart.width($(this.el).width());
                dc.renderAll(this.chart_id);
                return;
            }

            this.$chart_el.fadeTo(1, 0.1);
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
                this.$title_el.html(this.model.get('name'));
            }.bind(this));
        },

        /*
         * TODO: This will leak memory - dc doesn't provide a reasonable way to remove a graph from it's internal
         * registry
         */
        destroy: function () {
            this.$el.empty();
        }
    });

    var SavedGraphView = Backbone.View.extend({
        tagName: 'tr',
        className: 'saved-graph-row',
        template: _.template("<td><a class='select'><%= name %></a></td><td><a class='delete'>delete</a></td>"),

        events: {'click .select': 'clickHandler',
                 'click .delete': 'deleteHandler'},

        initialize: function() {
            this.model.on('change', this.render.bind(this));
        },

        deleteHandler: function () {
            this.model.destroy();
            if (_getCurrentGraph().id === this.model.id) {
                window.location.hash = 'grapher';
            }
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
        },

        render: function()
        {
            console.log('render');
            $(this.el).empty();
            this.collection.each(function (graph) {
                this.add(graph);
            }.bind(this));
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

        saveSuccess: function () {
            $('#save-graph-modal').modal('hide', function() {this.$el.removeAttr('disabled');});
            window.location.hash = 'grapher/' + _getCurrentGraph().id;
        },

        saveError: function (graph, response) {
            this.$el.removeAttr('disabled');
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
            this.$el.attr('disabled', 'disabled');
            var name = $('#graph-name-input').val();

            g = _getCurrentGraph();
            g.set('name', name);
            g.set('period', plotView.getPeriod());
            g.save({}, {success: this.saveSuccess.bind(this), error: this.saveError});
            g.change();
            App.getInstance().account.graphs.add(g);
        }

    });

    var ShowSaveGraphModalButton = Backbone.View.extend ({

        el: $('#show-save-graph-modal-button'),
        events: {'click': 'clickHandler'},

        clickHandler: function () {
            $('#save-graph-modal').modal('show');
        }

    });

    var SelectedMetricView = Backbone.View.extend({
        tagName: 'span',
        template: _.template("<%= entityId %>,<%= checkId %>,<%= metricName %>&nbsp;<i class='icon-remove delete clickable'></i>"),

        events: {'click .delete': 'deleteHandler'},

        initialize: function () {
            this.series = this.options.series;
        },

        deleteHandler: function () {
            _getCurrentGraph().removeSeries(this.series);
            _getCurrentGraph().save();
            _renderGraph(_getCurrentGraph());
        },

        render: function () {
            $(this.el).addClass('selected-metric');
            $(this.el).addClass('badge');
            $(this.el).html(this.template(this.series));
        }
    });

    var SelectedMetricsView = Backbone.View.extend({

        _seriesCount: 0,

        render: function()
        {
            this._seriesCount = 0;
            $(this.el).empty();
            _.each(_getCurrentGraph().get('series'), function (s) {
                this.add(s);
            }.bind(this));
            return this;
        },

        add: function(s)
        {
            var e = new SelectedMetricView({
                series: s,
                className: '_' + this._seriesCount
            });
            this._seriesCount++;
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

    function _getMetricKey(metric) {
        return [metric.get('entity_id'), metric.get('check_id'), metric.get('name')].join();
    }

    function _populateSavedGraphsTable(c) {

        var savedGraphListView, saveGraphButton, showSaveGraphModalButton;

        if (!savedGraphListView) {
            savedGraphListView = new SavedGraphListView({'el': $('#saved-graph-table'), 'collection': c});
        }
        savedGraphListView.render();

        saveGraphButton = new SaveGraphButton();
        showSaveGraphModalButton = new ShowSaveGraphModalButton();

    }

    function _renderGraph() {

        dc.deregisterAllCharts();

        if (plotView) {
            plotView.destroy();
        }
        plotView = new SavedGraphPlotView({el: "#chart-container", model: _getCurrentGraph()});
        plotView.render();

        _populateSelectedMetrics();

    }

    function renderGraph (id) {
        graphId = id;

        Views.renderView('grapher');

        _populateEntityTable();

        function _fetch_success(c) {
            var g = _getCurrentGraph();
            if(g.isNew()) {
                window.location.hash = "grapher";
            }
            _populateSavedGraphsTable(c);
            _renderGraph();
        }

        function _fetch_error() {
            window.location.hash = "#grapher";
            $("#chart-container").empty();
            $('#saved-graph-table').html('<tr><td>Failed to fetch graphs</td></tr>');

        }

        // Load a saved graph if it exists

        App.getInstance().account.graphs.fetch({success: _fetch_success, error: _fetch_error});
    }

    return {'renderGraph': renderGraph};

});
