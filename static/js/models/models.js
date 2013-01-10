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

        function handlePage(data, textStatus) {
            l = l.concat(data.values);

            /* FIXME */
            if(data.metadata.next_marker == null ) {
                d.resolve(l);
            } else {
                $.getJSON(constructURL(base_url, query_params.concat(['marker=' + data.metadata.next_marker])), handlePage).error(function() {d.reject();});
            }
        }

        $.getJSON(constructURL(base_url, query_params), handlePage).error(function() {d.reject();});
        return d.promise();

    }

    var SavedGraph = Backbone.Model.extend({
        idAttribute: "_id",
        urlRoot: '/saved_graphs/',

        parse: function(response) {
            delete response.__v;
            return response;
        },

        hasMetric: function (metric) {
            return !!_.find(this.get('series'), function (series) {
                return (
                    (series.entityId === metric.get('entity_id')) &&
                    (series.checkId === metric.get('check_id')) &&
                    (series.metricName === metric.get('name'))
                    );
            });

        },

        addMetric: function (metric) {
            var series = {};
            series.entityId = metric.getEntity().id;
            series.checkId = metric.getCheck().id;
            series.metricName = metric.get('name');

            console.log(series);

            if (!this.hasMetric(metric)) {
                this.get('series').push(series);
                if (!this.isNew()) {
                    this.save({wait: true});
                }
            }
        },

        removeSeries: function (series) {
            var new_series =  _.reject(this.get('series'), function (s) {
                return ((series.entityId === s.entityId) &&
                        (series.checkId === s.checkId) &&
                        (series.metricName === s.metricName));
            });
            this.set({series: new_series});
            if (!this.isNew()) {
                this.save({wait: true});
            }
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
            this.check_types = nestCollection(this, 'check_types', new CheckTypeCollection([]));
            this.monitoring_zones = nestCollection(this, 'monitoring_zones', new MonitoringZoneCollection ([]));
            this.notification_types = nestCollection(this, 'notification_types', new NotificationTypeCollection ([]));
            this.notifications = nestCollection(this, 'notifications', new NotificationCollection ([]));
            this.notification_plans = nestCollection(this, 'notification_plans', new NotificationPlanCollection ([]));
        }
    });

    /* ENTITIES */
    var Entity = Backbone.Model.extend({
        urlRoot: BASE_URL + '/entities/',

        /* HAAAAAAAAAAACK */
        sync: function(method, model, options) {

            function doSuccess(resp, status, xhr) {
                var id = xhr.getResponseHeader('Location').split('/').pop();

                resp = {id: id};
                xhr.responseText = JSON.stringify(resp);

                options['success'](resp, status, xhr);
            }

            function doError(model, response) {
                options['error'](model, response);
            }

            if(method === 'create') {
                var newOptions = _.reject(options, function(key) {
                    return key === 'success' || key === 'error';
                });
                newOptions['success'] = doSuccess;
                newOptions['error'] = doError;
                var response = Backbone.sync(method, model, newOptions);

            } else {
                return Backbone.sync(method, model, options);
            }

        },

        parse: function(response) {
            /* Updates (HTTP PUT) return 204 (no content), so we have to be a little defensive here */
            if(response) {
                this.account = response.account;
                delete response.account;
            }
            return response;
        },

        initialize: function() {
            this.checks = nestCollection(this, 'checks', new EntityCheckCollectionFactory(this));
            this.alarms = nestCollection(this, 'alarms', new EntityAlarmCollectionFactory(this));
        },
        getAccount: function() {
            return getAccount();
        },
        getLink: function () {
            return '#entities/' + this.id;
        },
        getHostInfo: function() {
            return new HostInfo({agent_id: this.get('agent_id')});
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

    var AlarmTest = Backbone.Model.extend({});
    function AlarmTestCollectionFactory(entity_id, alarm) {
        var C = Backbone.Collection.extend({
            entity_id: entity_id,
            alarm: alarm,
            model: AlarmTest,
            url: function() {
                return BASE_URL + '/entities/' + this.entity_id + '/test-alarm';
            }
        });
        return new C();
    }

    /* ALARMS */
    var Alarm = Backbone.Model.extend({
        initialize: function() {
            this.test = nestCollection(this, 'test', new AlarmTestCollectionFactory(this.get('entity_id'), this));
        },
        urlRoot: function() {
            return BASE_URL + '/entities/' + this.get('entity_id') + '/alarms/';
        },
        save: function(attributes, options) {
            attributes = typeof attributes !== 'undefined' ? attributes : {};

            cleaned_attr = _.clone(attributes);
            delete cleaned_attr.entity_id;

            Backbone.Model.prototype.save.call(this, cleaned_attr, options);
        },
        getLink: function () {
            return '#entities/' + this.get('entity_id') + '/alarms/' + this.id;
        },
        getCheck: function () {
            var e = App.getInstance().account.entities.get(this.get('entity_id'));
            if (e) {
                return e.checks.get(this.get('check_id'));
            } else {
                return null;
            }
        },
        sync: function(method, model, options) {

            function doSuccess(resp, status, xhr) {
                var id = xhr.getResponseHeader('Location').split('/').pop();

                resp = {id: id};
                xhr.responseText = JSON.stringify(resp);

                options['success'](resp, status, xhr);
            }

            function doError(model, response) {
                options['error'](model, response);
            }

            if(method === 'create') {
                var newOptions = _.reject(options, function(key) {
                    return key === 'success' || key === 'error';
                });
                newOptions['success'] = doSuccess;
                newOptions['error'] = doError;
                var response = Backbone.sync(method, model, newOptions);

            } else {
                return Backbone.sync(method, model, options);
            }
        },
        test: function(opts, callback) {
            callback(null, {});
        }
    });

    function EntityAlarmCollectionFactory(entity) {
        var C = Backbone.Collection.extend({
            entity: entity,
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
    var CheckTest = Backbone.Model.extend({});
    function CheckTestCollectionFactory(entity_id, check) {
        var C = Backbone.Collection.extend({
            entity_id: entity_id,
            check: check,
            model: CheckTest,
            url: function() {
                if (this.check.id) {
                    return BASE_URL + '/entities/' + this.entity_id + '/checks/' + this.check.id + '/test';
                } else {
                    return BASE_URL + '/entities/' + this.entity_id + '/test-check?debug=' + this.debug ? 'true' : 'false';
                }
            }
        });
        return new C();
    }

    /* CHECKS */
    var Check = Backbone.Model.extend({
        sync: function(method, model, options) {

            function doSuccess(resp, status, xhr) {
                var id = xhr.getResponseHeader('Location').split('/').pop();

                resp = {id: id};
                xhr.responseText = JSON.stringify(resp);

                options['success'](resp, status, xhr);
            }

            function doError(model, response) {
                options['error'](model, response);
            }

            if(method === 'create') {
                var newOptions = _.reject(options, function(key) {
                    return key === 'success' || key === 'error';
                });
                newOptions['success'] = doSuccess;
                newOptions['error'] = doError;
                var response = Backbone.sync(method, model, newOptions);

            } else {
                return Backbone.sync(method, model, options);
            }

        },
        urlRoot: function() {
            return BASE_URL + '/entities/' + this.get('entity_id') + '/checks/';
        },
        initialize: function() {
            this.metrics = nestCollection(this, 'metrics', new CheckMetricCollectionFactory(this));
            this.test = nestCollection(this, 'test', new CheckTestCollectionFactory(this.get('entity_id'), this));
        },
        save: function(attributes, options) {
            attributes = typeof attributes !== 'undefined' ? attributes : {};

            cleaned_attr = _.clone(attributes);
            delete cleaned_attr.entity_id;

            Backbone.Model.prototype.save.call(this, cleaned_attr, options);
        },
        getEntity: function() {
            return App.getInstance().account.entities.get(this.get('entity_id'));
        },
        getLink: function () {
            return '#entities/' + this.get('entity_id') + '/checks/' + this.id;
        },
        test: function (opts, callback) {
            callback(null, {});
        }
    });

    function EntityCheckCollectionFactory(entity) {
        var C = Backbone.Collection.extend({
            entity: entity,
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
        getEntity: function(callback){
            return App.getInstance().account.entities.get(this.get('entity_id'));
        },
        getCheck: function(callback){
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

    var CheckType = Backbone.Model.extend({
        urlRoot: function() {
            return BASE_URL + '/check_types/' + this.id;
        }
    });

    var CheckTypeCollection = Backbone.Collection.extend({
        model: CheckType,
        url: function() {
            return BASE_URL + '/check_types';
        },
        sync: function(method, model, options) {
            return depaginatedRequest(this.url()).then(options.success, options.error);
        }
    });

    var MonitoringZone = Backbone.Model.extend({
        urlRoot: function() {
            return BASE_URL + '/monitoring_zones/' + this.id;
        }
    });

    var MonitoringZoneCollection = Backbone.Collection.extend({
        model: MonitoringZone,
        url: function() {
            return BASE_URL + '/monitoring_zones';
        },
        sync: function(method, model, options) {
            return depaginatedRequest(this.url()).then(options.success, options.error);
        }
    });

    var NotificationType = Backbone.Model.extend({
        urlRoot: function() {
            return BASE_URL + '/notification_types';
        }
    });

    var NotificationTypeCollection = Backbone.Collection.extend({
        model: NotificationType,
        url: function() {
            return BASE_URL + '/notification_types';
        },
        sync: function(method, model, options) {
            return depaginatedRequest(this.url()).then(options.success, options.error);
        }
    });

    var Notification = Backbone.Model.extend({
        urlRoot: function() {
            return BASE_URL + '/notifications';
        },
        sync: function(method, model, options) {

            function doSuccess(resp, status, xhr) {
                var id = xhr.getResponseHeader('Location').split('/').pop();

                resp = {id: id};
                xhr.responseText = JSON.stringify(resp);

                options['success'](resp, status, xhr);
            }

            function doError(model, response) {
                options['error'](model, response);
            }

            if(method === 'create') {
                var newOptions = _.reject(options, function(key) {
                    return key === 'success' || key === 'error';
                });
                newOptions['success'] = doSuccess;
                newOptions['error'] = doError;
                var response = Backbone.sync(method, model, newOptions);

            } else {
                return Backbone.sync(method, model, options);
            }

        }
    });

    var NotificationCollection = Backbone.Collection.extend({
        model: Notification,
        url: function() {
            return BASE_URL + '/notifications';
        },
        sync: function(method, model, options) {
            return depaginatedRequest(this.url()).then(options.success, options.error);
        }
    });

    var NotificationPlan = Backbone.Model.extend({
        urlRoot: function() {
            return BASE_URL + '/notification_plans';
        },
        sync: function(method, model, options) {

            function doSuccess(resp, status, xhr) {
                var id = xhr.getResponseHeader('Location').split('/').pop();

                resp = {id: id};
                xhr.responseText = JSON.stringify(resp);

                options['success'](resp, status, xhr);
            }

            function doError(model, response) {
                options['error'](model, response);
            }

            if(method === 'create') {
                var newOptions = _.reject(options, function(key) {
                    return key === 'success' || key === 'error';
                });
                newOptions['success'] = doSuccess;
                newOptions['error'] = doError;
                var response = Backbone.sync(method, model, newOptions);

            } else {
                return Backbone.sync(method, model, options);
            }
        },
        getOk: function () {
            return App.getInstance().account.notifications.reject(function (notification) {
                return (!_.contains(this.get('ok_state'), notification.id));
            }.bind(this));
        },
        getWarning: function () {
            return App.getInstance().account.notifications.reject(function (notification) {
                return (!_.contains(this.get('warning_state'), notification.id));
            }.bind(this));
        },
        getCritical: function () {
            return App.getInstance().account.notifications.reject(function (notification) {
                return (!_.contains(this.get('critical_state'), notification.id));
            }.bind(this));
        }
    });

    var NotificationPlanCollection = Backbone.Collection.extend({
        model: NotificationPlan,
        url: function() {
            return BASE_URL + '/notification_plans';
        },
        sync: function(method, model, options) {
            return depaginatedRequest(this.url()).then(options.success, options.error);
        }
    });

    var HostInfo = Backbone.Model.extend({
        url: function() {
            return BASE_URL + '/views/agent_host_info?agentId=' + this.get('agent_id') + '&include=cpus&include=filesystems&include=memory';
        },
        initialize: function() {
            this.cpu_total = undefined;
            this.cpu_idle = undefined;

            this.last_cpu_total = undefined;
            this.last_cpu_idle = undefined;
        },

        sync: function(method, model, options) {
            cpu_record = function(model) {
                this.last_cpu_total = this.cpu_total;
                this.last_cpu_idle = this.cpu_idle;

                var info = model[0];
                var totals = _.pluck(info.host_info.cpus.info, 'total');
                this.cpu_total = _.reduce(totals, function(memo, num){return memo + num;}, 0);

                var idles = _.pluck(info.host_info.cpus.info, 'idle');
                this.cpu_idle = _.reduce(idles, function(memo, num){return memo + num;}, 0);

                options.success(model);
            }.bind(this);
            return depaginatedRequest(this.url()).then(cpu_record, options.error);
        },

        getCpuPercent: function() {
            return ((this.cpu_total-this.last_cpu_total) - (this.cpu_idle-this.last_cpu_idle))/(this.cpu_total-this.last_cpu_total) * 100;
        },


        getDiskPercent: function() {
            return this.getDiskUsed() / this.getDiskTotal() * 100;
        },
        getDiskTotal: function() {
            var info = this.get(0);
            var root_fs = _.find(info.host_info.filesystems.info, function(fs) {return fs.dir_name == '/';});
            return root_fs.total * 1024;
        },
        getDiskUsed: function() {
            var info = this.get(0);
            var root_fs = _.find(info.host_info.filesystems.info, function(fs) {return fs.dir_name == '/';});
            return root_fs.used * 1024;
        },

        getRamPercent: function() {
            return this.getRamUsed()/this.getRamTotal() * 100;
        },
        getRamTotal: function() {
            return this.get(0).host_info.memory.info.total;
        },
        getRamUsed: function() {
            return this.get(0).host_info.memory.info.actual_used;

        }
    });

    return {Account: Account,
            Entity: Entity,
            Check: Check,
            Metric: Metric,
            SavedGraph: SavedGraph,
            Alarm: Alarm,
            HostInfo: HostInfo};
});
