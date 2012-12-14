define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'views/views',
  'views/graph',
  'models/models',
  'dc',
  'jqueryresize',
  'bootstrap'
], function($, Backbone, _, App, Views, Graph, Models, dc) {

    var TitleView = Backbone.View.extend({
        render: function() {
            this.$el.empty();
            this.$el.append(this.model.get('name'));
        }
    });

    var second = 1000;

    var hour = 60*60*1000;

    var PeriodSelectorView = Backbone.View.extend({

        units: [[second, "second"],
                [60*second, "minute"],
                [hour, "hour"],
                [24*hour, "day"],
                [7*24*hour, "week"],
                [30*24*hour, "month"],
                [365*24*hour, "year"]],

        defaults: [hour, 6*hour, 24*hour, 3*24*hour, 7*24*hour, 14*24*hour, 30*24*hour, 90*24*hour, 180*24*hour, 365*24*hour],

        periodLabel: function(period) {

            for(var n = this.units.length-1; n >= 0; n--) {
                var p = this.units[n][0];
                var s = this.units[n][1];

                var quot = period/p;
                if(~~quot == 1) {
                    return quot.toString() + ' ' + s;
                }
                if(~~quot > 1) {
                    return quot.toString() + ' ' + s + 's';
                }

            }
        },

        initialize: function(opts) {

        },

        setLabel: function(label) {
            this.$el.children('button').html(label + ' <span class="caret"></span');
        },

        render: function() {
            this.$el.empty();

            this.$el.append(
                            $('<button>')
                                .addClass('btn dropdown-toggle pull-right')
                                .attr('data-toggle', 'dropdown')
                                .append(
                                    "Last day",
                                    $('<span>')
                                        .addClass('caret')
                                ),
                            $('<ul>')
                                .addClass('dropdown-menu'));

            var $target = this.$el.children("ul");
            _.each(this.defaults, function(p) {
                    $target.append(
                        $('<li>').append(
                            $('<a>').click(function() {
                                this.model.set({period: p});
                                this.setLabel(this.periodLabel(p));
                            }.bind(this))
                            .append(this.periodLabel(p))
                        )

                    );
                }, this);
            this.setLabel(this.periodLabel(this.model.get('period')));
        }
    });

    /**
     * Plotter View
     * @extends Backbone.View
     */
    var PlotterView = Backbone.View.extend({

        events: {"resize": "_resizeHandler"},

        _resizeHandler: function () {
            this.render(null, true);
        },

        initialize: function() {

            this.chart_id = "chart-" + (this.model.id || this.model.cid);
            this.$el.attr('id', this.chart_id);

            this.chart = this._constructChart();

            this.model.on('change', this.render.bind(this, null, false));

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
            return [this._getDate(this.model.get('period')), this._getDate()];
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
                .margins({top: 10, right: 10, bottom: 30, left: 50})
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

        _getMetrics: function() {
            return _.map(this.model.get('series'), function(s) {
                return new Models.Metric({entity_id: s.entityId, check_id: s.checkId, name: s.metricName});
            });
        },

        /* Asynchronously fetch the data for a metric.  Returns a deferred that will
           be resolved with the fetched data */
        _getMetricData: function(metric, now) {
            return metric.getData(now - this.model.get('period'), now, 500);
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
        render: function(e, no_data_refresh) {

            if(no_data_refresh) {
                this.chart.width($(this.el).width());
                dc.renderAll(this.chart_id);
                return;
            }

            this.$el.fadeTo(1, 0.4);

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

                this.$el.fadeTo(100, 1);

            }.bind(this));
        }
    });

    /**
     * Legend Row View
     * @extends Backbone.View
     */
    var LegendRowView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template("<td><%= entityLabel %></td><td><%= checkLabel %></td><td><span class='label <%= cssClass %>'><%= metricName %>&nbsp;<i class='icon-remove delete clickable'></i></span></td>"),

        events: {'click .delete': 'deleteHandler'},

        initialize: function (opts) {
            this.cssClass = opts.cssClass;
            this.series = this.options.series;
            this.model = new Models.Metric({entity_id: this.series.entityId, check_id: this.series.checkId, name: this.series.metricName});

        },

        deleteHandler: function () {
            App.getInstance().currentGraph.removeSeries(this.series);
        },


        /* Hackety hack hack hack hack */
        render: function () {
            this.entity = App.getInstance().account.entities.get(this.model.get('entity_id'));
            this.entity.fetch({success: function() {
                this.entity.checks.fetch({success: function() {
                    this.check = this.entity.checks.get(this.model.get('check_id'));
                    this.check.fetch({success: function() {
                        this.$el.html(this.template({
                                            entityLabel: this.entity.get('label'),
                                            checkLabel: this.check.get('label'),
                                            metricName: this.model.get('name'),
                                            cssClass: this.cssClass}));
                    }.bind(this)});
                }.bind(this)});
            }.bind(this)});
        }
    });

    /**
     * Legend View
     * @extends Backbone.View
     */
    var LegendView = Backbone.View.extend({

        _seriesCount: 0,

        initialize: function() {
            this.model.on('change', this.render.bind(this));
        },

        render: function()
        {
            this._seriesCount = 0;
            this.$el.empty();

            this.$el.addClass('table table-striped table-hover');
            this.$el.append('<tr><th class="span4">Entity</th><th class="span4">Check</th><th class="span4">Metric</th></th>');
            _.each(this.model.get('series'), function (s) {
                this.add(s);
            }.bind(this));
            return this;
        },

        add: function(s)
        {
            var e = new LegendRowView({
                series: s,
                cssClass: '_' + this._seriesCount
            });
            this._seriesCount++;
            e.render();
            $(this.el).append(e.el);
        }

    });

    var SavedGraphView = Views.ListElementView.extend({

        tagName: 'li',
        template: _.template("<a class='details clickable'><%= name %></a>&nbsp;<i class='icon-remove delete clickable'></i> "),

        detailsHandler: function () {
            window.location.hash = 'grapher/' + this.model.id;
        },

        deleteHandler: function () {
            this.model.destroy();
            this._modal.hide();
        }
    });

    var SavedGraphListView = Views.ListView.extend({

        name: 'saved graph',
        plural: 'saved graphs',
        elementView: SavedGraphView,

        // Creates Top Row - <h2> and a link to create a new object
        _makeHeader: function () {
            var saveButton = $('<a>').addClass('btn btn-primary').append('Save Graph');
            saveButton.on('click', this._showModal.bind(this));

            var header = [$('<a>').addClass('btn dropdown-toggle').attr('data-toggle', 'dropdown').append('Saved Graphs', ' <span class="caret"></span>'), ' ', saveButton];
            return header;
        },

        _makeBody: function () {
            var body = $('<ul>').addClass('dropdown-menu');
            return body;
        },

        render: function()
        {
            $(this.el).find('ul').empty();
            this.collection.each(function (m) {
                this.add(m);
            }.bind(this));
            return this;
        },

        handleNew: function (label) {
            function saveSuccess(savedGraph) {
                savedGraph.fetch({
                    success: function(g) {
                        this._modal.hide();
                        App.getInstance().account.graphs.add(g);
                        window.location.hash = 'grapher/' + g.id;
                    }.bind(this), error: function(e) {
                        this.error('Error fetching ' + this.name);
                        this._modal.hide();
                    }.bind(this)
                });
            }

            function saveError(savedGraph, response) {
                try {
                    r = JSON.parse(response.responseText);
                } catch (e) {
                    r = {'name': 'UnknownError', 'message': 'UnknownError: An unknown error occured.'};
                }
                this.error(r.message);
                this._modal.hide();
            }
            App.getInstance().currentGraph.save({name: label}, {success: saveSuccess.bind(this), error: saveError.bind(this)});
        },

        add: function (m) {
            if (this.elementView) {
                var e = new this.elementView({
                    model: m
                });
                e.render();
                $(this.el).find('ul').append(e.el);
            }
        }

    });

    var GraphView = Backbone.View.extend({
        initialize: function() {

            this._header = $('<div>').addClass('row-fluid');

            this._savedGraphs = $('<div>').addClass('dropdown span4');
            this._header.append(this._savedGraphs);
            this.savedGraphListView = new SavedGraphListView({el: this._savedGraphs, collection: App.getInstance().account.graphs});
            this.savedGraphListView.render();

            this._title = $('<div>').addClass('span4').append($('<h4>'));
            this._header.append(this._title);
            this.titleView = new TitleView({el: this._title.find('h4'), model: this.model});
            this.titleView.render();


            this._periodSelector = $('<div>').addClass('span4 dropdown');
            this._header.append(this._periodSelector);
            this.periodSelectorView = new PeriodSelectorView({el: this._periodSelector, model: this.model});
            this.periodSelectorView.render();

            this.$el.append(this._header);


            this._plot = $('<div>').addClass('.span12');
            this.$el.append(this._plot);
            this.plotterView = new PlotterView({el: this._plot, model: this.model});
            this.plotterView.render();

            this._legend = $('<table>');
            this.$el.append($('<div>').addClass('.span12').append(this._legend));
            this.legendView = new LegendView({el: this._legend, model: this.model});
            this.legendView.render();

        },

        destroy: function () {
            this.$el.empty();
        }

    });

    return {'GraphView': GraphView};

});