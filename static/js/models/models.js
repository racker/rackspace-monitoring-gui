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

    var Account = Backbone.Model.extend({
        url: function() {
            return BASE_URL + '/account';
        },
        initialize: function() {
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
            return ACCOUNT.entities.get(this.get('entity_id'));
        },
        getCheck: function(){
            this.getEntity().checks.fetch();
            return this.getEntity().checks.get(this.get('check_id'));
        },
        getData: function(start_time, end_time, points, options) {
            return depaginatedRequest(this.url() + '?from=' + start_time + '&to=' + end_time + '&points=' + points).then(options.success, options.error);

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

    return {'Account': Account, 'Entity': Entity, 'Check': Check};
});
