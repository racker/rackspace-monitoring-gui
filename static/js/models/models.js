define([
  'jquery',
  'backbone',
  'underscore'
], function($, Backbone, _) {

    var BASE_URL = '/proxy';
    var account = null;

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
    
        function handlePage(data) {
            l = l.concat(data.values);
    
            /* FIXME */
            if(data.metadata.next_marker == null ) {
                d.resolve(l);
            } else {
                $.getJSON(url + "?marker=" + data.metadata.next_marker, handlePage);
            }
        }
    
        $.getJSON(url, handlePage);
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
            this.checks = nestCollection(this, 'checks', EntityCheckCollectionFactory(this));
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
        entity: function(){
            ACCOUNT.entities.fetch();
            return ACCOUNT.entities.get(this.get('entity_id'));
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
        entity: function(){
            ACCOUNT.entities.fetch();
            return ACCOUNT.entities.get(this.get('entity_id'));
        },
        check: function(){
            this.entity().checks.fetch();
            return this.entity().checks.get(this.get('check_id'));
        },
        data: function() {
    
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