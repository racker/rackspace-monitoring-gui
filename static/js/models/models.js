define([
  'jquery',
  'backbone',
  'underscore',
  'app'
], function($, Backbone, _, App) {

    var BASE_URL = '/proxy';

    // From https://gist.github.com/1610397
    function nestCollection(model, attributeName, nestedCollection) {
        //setup nested references
        for (var i = 0; i < nestedCollection.length; i++) {
          model.attributes[attributeName][i] = nestedCollection.at(i).attributes;
        }
        //create empty arrays if none

        nestedCollection.bind('add', function (initiative) {
          if (!model.get(attributeName)) {
            model.attributes[attributeName] = [];
          }
          model.get(attributeName).push(initiative.attributes);
        });

        nestedCollection.bind('remove', function (initiative) {
          var updateObj = {};
          updateObj[attributeName] = _.without(model.get(attributeName), initiative.attributes);
          model.set(updateObj);
        });
        return nestedCollection;
    }

    // Depaginate results from url
    function depaginatedRequest(url) {
        var d = $.Deferred();
        var l = [];

        // "http://example.com/page?foo=bar&baz=bat" --> ["http://example.com/page", "foo=bar&baz=bat"]
        var parsed_url = url.split('?', 2);

        // "http://example.com/page"
        var base_url = parsed_url[0] || '';

        // ["foo=bar", "baz=bat"]
        var query_params = (parsed_url[1] || '').split('&');

        function constructURL(base, params) {
            return [base, params.join('&')].join('?');
        }

        function handlePage(data) {
            l = l.concat(data.values);

            /* FIXME */
            if(data.metadata.next_marker == null ) {
                d.resolve(l);
            } else {
                $.getJSON(constructURL(base_url, query_params.concat(['marker=' + data.metadata.next_marker])), handlePage);
            }
        }

        $.getJSON(constructURL(base_url, query_params), handlePage);
        return d.promise();
    }

    var SavedGraph = Backbone.Model.extend({
        idAttribute: "_id",
        urlRoot: '/saved_graphs/',

        parse: function(response) {
            delete response.__v;
            return response;
        },

        hasMetric: function (checkId, metricName) {
            return !!_.find(this.get('series'), function (series) {
                return (
                    (series.checkId === checkId) &&
                    (series.metricName === metricName)
                    );
            });
        },

        hasCheck: function (checkId) {
            return !!_.find(this.get('series'), function (series) {
                return (
                    series.checkId === checkId
                    );
            });
        },

        hasEnitiy: function (entityId) {
            return !!_.find(this.get('series'), function (series) {
                return (
                    series.entityId === entityId
                    );
            });
        }
    });

    var AccountSavedGraphCollection = Backbone.Collection.extend({
        model: SavedGraph,
        url: function() {
            return '/saved_graphs';
        }
    });

    var Account = Backbone.Model.extend({
        url: function() {
            return BASE_URL + '/account';
        },
        initialize: function() {
            this.graphs = new AccountSavedGraphCollection([]);
            this.entities = nestCollection(this, 'entities', new AccountEntityCollection([], {account: this}));
        }
    });

    /* ENTITIES */
    var Entity = Backbone.Model.extend({
        url: function() {
            return BASE_URL + '/entities/' + this.id;
        },
        parse: function(response) {
            this.account = response.account;
            delete response.account;
            return response;
        },
        initialize: function() {
            this.checks = nestCollection(this, 'checks', new EntityCheckCollectionFactory(this));
            this.alarms = nestCollection(this, 'alarms', new EntityAlarmCollectionFactory(this));
        },
        getAccount: function() {
            return getAccount();
        }
    });

    var AccountEntityCollection = Backbone.Collection.extend({
        model: Entity,
        initialize: function(models, options) {
            this.account = options.account;
        },
        url: function() {
            return BASE_URL + '/entities';
        },
        parse: function(response) {
            _.each(response, function(entity) {
                entity.account = this.account;
            }, this);

            return response;
        },
        sync: function(method, model, options) {
            return depaginatedRequest(this.url()).then(options.success, options.error);
        }
    });

    /* ALARMS */
    var Alarm = Backbone.Model.extend({
        urlRoot: function() {
            return BASE_URL + '/entities/' + this.get('entity_id') + '/alarms/' + this.get('id');
        },
        save: function(attributes, options) {
            attributes = typeof attributes !== 'undefined' ? attributes : {};

            cleaned_attr = _.clone(attributes);
            delete cleaned_attr.entity_id;

            Backbone.Model.prototype.save.call(this, cleaned_attr, options);
        }
    });

    function EntityAlarmCollectionFactory(entity) {
        var C = Backbone.Collection.extend({
            model: Alarm,
            url: function() {
                return BASE_URL + '/entities/' + entity.get('id') + '/alarms/';
            },

            parse: function(response) {
                _.each(response, function(alarm) {
                    alarm.entity_id = entity.get('id');
                }, this);
                return response;
            },

            filterByCheck: function(check) {

                var alarms = this.reject(function (alarm) {
                    return (alarm.get('check_id') !== check.get('id'));
                });

                return alarms;
            },

            sync: function(method, model, options) {
                return depaginatedRequest(this.url()).then(options.success, options.error);
            }
        });
        return new C();
    }

    /* CHECKS */

    var Check = Backbone.Model.extend({
        urlRoot: function() {
            return BASE_URL + '/entities/' + this.get('entity_id') + '/checks/';
        },
        initialize: function() {
            this.metrics = nestCollection(this, 'metrics', new CheckMetricCollectionFactory(this));
        },
        save: function(attributes, options) {
            attributes = typeof attributes !== 'undefined' ? attributes : {};

            cleaned_attr = _.clone(attributes);
            delete cleaned_attr.entity_id;

            Backbone.Model.prototype.save.call(this, cleaned_attr, options);
        },
        getEntity: function() {
            return App.getInstance().account.entities.get(this.get('entity_id'));
        }
    });

    function EntityCheckCollectionFactory(entity) {
        var C = Backbone.Collection.extend({
            model: Check,
            url: function() {
                return BASE_URL + '/entities/' + entity.id + '/checks';
            },
            parse: function(response) {
                _.each(response, function(check) {
                    check.entity_id = entity.id;
                }, this);

                return response;
            },
            sync: function(method, model, options) {
                return depaginatedRequest(this.url()).then(options.success, options.error);
            }
        });
        return new C();
    }

    /* METRICS */

    var Metric = Backbone.Model.extend({
        urlRoot: function() {
            return BASE_URL + '/entities/' + this.get('entity_id') + '/checks/' + this.get('check_id') + '/metrics/' + this.get('name');
        },
        save: function(attributes, options) {
            attributes = typeof attributes !== 'undefined' ? attributes : {};

            cleaned_attr = _.clone(attributes);
            delete cleaned_attr.entity_id;
            delete cleaned_attr.check_id;

            Backbone.Model.prototype.save.call(this, cleaned_attr, options);
        },
        getEntity: function(){
            getAccount().entities.fetch();
            return App.getInstance().account.entities.get(this.get('entity_id'));
        },
        getCheck: function(){
            this.getEntity().checks.fetch();
            return this.getEntity().checks.get(this.get('check_id'));
        },
        getData: function(start_time, end_time, points, options) {
            /* Returns data for this metric between start_time and end_time, either in raw or rolled-up form.

                Parameters:
                    start_time: Date object, or number of ms since UNIX epoch (see Date.getTime())
                    end_time: Date object, or number of ms since UNIX epoch (see Date.getTime())
                    points: Approximate number of points to be returned
                    options.success: Success callback
                    options.error: Error callback
            */
            if(start_time.getTime) {
                start_time = start_time.getTime();
            }
            if(end_time.getTime) {
                end_time = end_time.getTime();
            }

            function formatData(list) {
                _.each(list, function(d) {
                    d.timestamp = new Date(d.timestamp);
                }, this);
                return list;
            }

            var req = depaginatedRequest(this.url() + '/plot?from=' + start_time + '&to=' + end_time + '&points=' + points).done(formatData);

            if(options !== undefined) {
                return req.then(options.success, options.error);
            } else {
                return req;
            }
        },
        getRecentData: function(period, points, options) {
            /* Returns most recent data of a length specified by period

                Parameters:
                    period: Length of data period in ms
                    points: Approximate number of points to be returned
                    options.success: Success callback
                    options.error: Error callback
            */
            var end_time = (new Date()).getTime();

            var start_time = end_time - period;

            return this.getData(start_time, end_time, points, options);
        }
    });


    function CheckMetricCollectionFactory(check) {
        var C = Backbone.Collection.extend({
            model: Metric,
            url: function() {
                return BASE_URL + '/entities/' + check.get('entity_id') + '/checks/' + check.id + '/metrics';
            },
            parse: function(response) {
                _.each(response, function(metric) {
                    metric.entity_id = check.get('entity_id');
                    metric.check_id = check.id;
                }, this);
                return response;
            },
            sync: function(method, model, options) {
                return depaginatedRequest(this.url()).then(options.success, options.error);
            }
        });
        return new C();
    }

    return {'Account': Account,
            'Entity': Entity,
            'Check': Check,
            'Metric': Metric,
            'SavedGraph': SavedGraph};
});
