var BASE_URL = 'http://localhost:8080/proxy'

var Account = Backbone.Model.extend({
    url: BASE_URL + '/account',
    initialize: function() {
        this.entities = new EntityCollection([], {account: this});
    }
});

/* ENTITIES */

var Entity = Backbone.Model.extend({
    urlRoot: BASE_URL + '/entities',
    parse: function(response) {
        this.account = response.account;
        delete response.account;
        return response;
    },
    initialize: function() {
        this.checks = new CheckCollection([], {entity: this});
    }
});

var EntityCollection = Backbone.Collection.extend({
    model: Entity,
    initialize: function(models, options) {
        this.account = options.account;
    },
    url: function() {
        return BASE_URL + '/entities';
    },
    parse: function(response) {
        _.each(response.values, function(entity) {
            entity.account = this.account;
        }, this);

        return response.values;
    }
});

/* CHECKS */

var Check = Backbone.Model.extend({
    urlRoot: function() {
        return this.entity.url() + '/checks/';
    },
    parse: function(response) {
        this.entity = response.entity;
        delete response.entity;
        return response;
    },
    initialize: function() {
        this.metrics = new MetricCollection([], {check: this});
    }
});

var CheckCollection = Backbone.Collection.extend({
    model: Check,
    initialize: function(models, options) {
       this.entity = options.entity;
    },
    url: function() {
        return this.entity.url() + '/checks';
    },
    parse: function(response) {
        _.each(response.values, function(check) {
            check.entity = this.entity;
        }, this);

        return response.values;
    }
});

/* METRICS */

var Metric = Backbone.Model.extend({
    urlRoot: function() {
        return this.check.url() + '/metrics/';
    },
    idAttribute: 'metricName',
    parse: function(response) {
        this.check = response.check;
        delete response.check;
        return response;
    },
    getData: function() {

    }
});

var MetricCollection = Backbone.Collection.extend({
    model: Metric,
    initialize: function(models, options) {
        this.check = options.check;
    },
    url: function() {
        return this.check.url() + '/metrics';
    },
    parse: function(response) {
        _.each(response, function(metric) {
            metric.check = this.check;
        }, this);

        return response;
    }
});