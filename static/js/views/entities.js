define([
  'jquery',
  'backbone',
  'underscore',
  'models/models'
], function($, Backbone, _, Models) {

    var entitiesView, entityDetailsView, checkDetailsView;

    var CheckDetailsView = Backbone.View.extend({
        el: $('#check-details'),
        tagName: 'div',
        template: _.template($("#check-details-template").html()),

        renderAlarmListSuccess: function (checks, response) {
            var clv = new CheckListView();
            clv.render();
            console.log(checks);
            checks.each(function (check) {
                clv.add(check);
            });
        },

        renderAlarmListFail: function (checks, response) {
            var cl = $("#check-alarms-list");
            cl.html("<tr><td>Failed Loading Alarms</td></tr>");
        },

        render: function () {
            // render entity details
            console.log(this.model.toJSON());
            $(this.el).html(this.template(this.model.toJSON()));

            // render check list
            var cl = $("#check-alarms-list");
            cl.html("<tr><td>LOADING ALARMS</td></tr>");
            // TODO: Implement me.
            //this.model.alarms.fetch({"success": this.renderAlarmListSuccess, "error": this.renderAlarmListFail});
        }
    });

    var CheckView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template("<tr><td><%= label %></td><td><%= id %></td></tr>"),

        events: {"click": "details"},

        render: function () {
            $(this.el).html(this.template(this.model.toJSON()));
        },

        details: function () {
            window.location.hash = "entities/"+this.model.get('entity_id')+"/checks/"+this.model.get('id');
        }
    });

    var CheckListView = Backbone.View.extend({
        el: $('#entity-checks-list'),
        events: {},
    
        initialize: function()
        {
            this._cache = {};
        },
    
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
            this._cache[m.get('id')] = e;
            e.render();
            $(this.el).append(e.el);
        }
    });


    var EntityDetailsView = Backbone.View.extend({
        el: $('#entity-details'),
        tagName: 'div',
        template: _.template($("#entity-details-template").html()),

        renderCheckListSuccess: function (checks, response) {
            var clv = new CheckListView();
            clv.render();
            checks.each(function (check) {
                console.log(check);
                clv.add(check);
            });
        },

        renderCheckListFail: function (checks, response) {
            var cl = $("#entity-checks-list");
            cl.html("<tr><td>Failed Loading Checks</td></tr>");
        },

        render: function () {
            // render entity details
            $(this.el).html(this.template(this.model.toJSON()));

            // render check list
            var cl = $("#entity-checks-list");
            cl.html("<tr><td>LOADING CHECKS</td></tr>");
            this.model.checks.fetch({"success": this.renderCheckListSuccess, "error": this.renderCheckListFail});
        }
    });

    /* This should be bound to a model, so updates should rerender correctly */
    var EntityView = Backbone.View.extend({
        tagName: 'li',
        template: _.template("<li><%= label %></li>"),
        events: {"click": "details"},

        render: function() {
          $(this.el).html(this.template(this.model.toJSON()));
          return this;
        },

        details: function () {
            window.location.hash = "entities/" + this.model.id;
        }
    });

    /* TODO - Ideally this is bound to the collection so updates happen automatically */
    var EntitiesView = Backbone.View.extend({
        el: $('#entity-list'),
        events: {},
    
        initialize: function()
        {
            this._cache = {};
        },
    
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
            this._cache[m.get('id')] = e;
            e.render();
            $(this.el).append(e.el);
        }
    });

    var renderCheckDetails = function (app, id, cid) {

        var success = function (collection, response) {
            var check = collection.get(cid);
            if (!check) {
                window.location.hash = 'entities/' + id;
            }

            checkDetailsView = new CheckDetailsView({"model": check});
            checkDetailsView.render();
        };

        var error = function (collection, response) {
            window.location.hash = 'entities';

        };
        var entity = app.account.entities.get(id);
        if (!entity) {
            window.location.hash = 'entities';
            return;
        }

        entity.checks.fetch({"success": success, "error": error});
    };

    var renderDetails = function (app, id) {
        var model = app.account.entities.get(id);
        if (!model) {
            window.location.hash = 'entities';
            return;
        }

        //TODO: We don't have to re-render if the model is the same
        entityDetailsView = new EntityDetailsView({"model": model});
        entityDetailsView.render();
    };

    var renderList = function (app) {
        if (!entitiesView) {
            entitiesView = new EntitiesView();
        }
        entitiesView.render();
        app.account.entities.each(function (e) {
            entitiesView.add(e);
        });
    };

    return {'renderDetails': renderDetails, 'renderCheckDetails': renderCheckDetails, 'renderList': renderList};

});
