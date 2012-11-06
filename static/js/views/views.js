define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models'
], function($, Backbone, _, App, Models) {

    var entitiesView, entityDetailsView, checkDetailsView, alarmDetailsView;

    /* Hides/Shows Relevant Stuff depending on the view */
    var _renderView = function (view) {
        /* Switch nav link */
        $('[id$=view-link]').removeClass('active');
        $('#' + view + '-view-link').addClass('active');
        /* Hide/Show relevant divs */
        $('[id$=view-content]').addClass('hide');
        $('#' + view + '-view-content').removeClass('hide');
    };

    var AlarmView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template("<tr><td><a href='#entities/<%= entity_id %>/alarms/<%= id %>'> <%= id %> </a> </td></tr>"),

        events: {},

        render: function () {
            $(this.el).html(this.template(this.model.toJSON()));
        }

    });

    var AlarmListView = Backbone.View.extend({
        el: $('#check-alarms-list'),
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
            var e = new AlarmView({
                model: m
            });
            this._cache[m.get('id')] = e;
            e.render();
            $(this.el).append(e.el);
        }
    });

    var AlarmDetailsView = Backbone.View.extend({
        el: $('#alarm-details'),
        tagName: 'div',
        template: _.template($("#alarm-details-template").html()),

        render: function () {
            // render entity details
            $(this.el).html(this.template(this.model.toJSON()));
            _renderView('alarm-details');

        }
    });

    var CheckDetailsView = Backbone.View.extend({
        el: $('#check-details'),
        tagName: 'div',
        template: _.template($("#check-details-template").html()),

        renderAlarmListSuccess: function (alarms, response) {
            var alv = new AlarmListView();
            alv.render();
            _.each(alarms.filterByCheck(this.model), function (alarm) {
                alv.add(alarm);
            });
        },

        renderAlarmListFail: function () {
            var cl = $("#check-alarms-list");
            cl.html("<tr><td>Failed Loading Alarms</td></tr>");
        },

        render: function () {
            // render entity details
            $(this.el).html(this.template(this.model.toJSON()));
            _renderView('check-details');

            // render check list
            var cl = $("#check-alarms-list");
            cl.html("<tr><td>LOADING ALARMS</td></tr>");
            this.model.getEntity().alarms.fetch({"success": this.renderAlarmListSuccess.bind(this), "error": this.renderAlarmListFail});
        }
    });

    var CheckView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template("<td><a href='#/entities/<%= entity_id %>/checks/<%= id %>'><%= label %></a></td><td><%= id %></td>"),

        events: {},

        render: function () {
            $(this.el).html(this.template(this.model.toJSON()));
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
            _renderView('entity-details');

            // render check list
            var cl = $("#entity-checks-list");
            cl.html("<tr><td>LOADING CHECKS</td></tr>");
            this.model.checks.fetch({"success": this.renderCheckListSuccess, "error": this.renderCheckListFail});
        }
    });

    /* This should be bound to a model, so updates should rerender correctly */
    var EntityView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template("<td><a href='#entities/<%= id %>'><%= label %></a></td><td><%= id %></td>"),
        events: {},

        render: function() {
          $(this.el).html(this.template(this.model.toJSON()));
          return this;
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
            _renderView('entities');
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


    /* ROUTE HANDLERS */
    var renderCheckDetails = function (id, cid) {

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
        var entity = App.getInstance().account.entities.get(id);
        if (!entity) {
            window.location.hash = 'entities';
            return;
        }

        entity.checks.fetch({"success": success, "error": error});
    };

    var renderAlarmDetails = function (id, aid) {

        var success = function (collection, response) {
            var alarm = collection.get(aid);
            if (!alarm) {
                window.location.hash = 'entities/' + id;
            }

            alarmDetailsView = new AlarmDetailsView({"model": alarm});
            alarmDetailsView.render();
        };

        var error = function (collection, response) {
            window.location.hash = 'entities';

        };

        var entity = App.getInstance().account.entities.get(id);
        if (!entity) {
            window.location.hash = 'entities';
            return;
        }

        entity.alarms.fetch({"success": success, "error": error});
    };

    var renderEntityDetails = function (id) {
        var model = App.getInstance().account.entities.get(id);
        if (!model) {
            window.location.hash = 'entities';
            return;
        }

        entityDetailsView = new EntityDetailsView({"model": model});
        entityDetailsView.render();
    };

    var renderEntitiesList = function () {
        if (!entitiesView) {
            entitiesView = new EntitiesView();
        }
        entitiesView.render();
        App.getInstance().account.entities.each(function (e) {
            entitiesView.add(e);
        });
    };

    var renderGraph = function () {
        _renderView('grapher');
    };

    var renderAccount = function () {
        _renderView('account');
    };

    var renderLoading = function () {
        _renderView('loading');
    };

    var renderError = function () {
        _renderView('error');
    };

    return {'renderEntityDetails': renderEntityDetails,
            'renderCheckDetails': renderCheckDetails,
            'renderEntitiesList': renderEntitiesList,
            'renderAlarmDetails': renderAlarmDetails,
            'renderGraph': renderGraph,
            'renderAccount': renderAccount,
            'renderLoading': renderLoading,
            'renderError': renderError};

});
