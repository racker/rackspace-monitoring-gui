define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views'
], function($, Backbone, _, App, Models, Views) {

    var entitiesView;

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
        _pre_save_cache: {},
        template: _.template(
            "<dt><strong>label</strong></dt><dd><%= label %></dd>" +
            "<dt><strong>agent id</strong></dt><dd><%= agent_id %></dd>" +
            "<dt><strong>created at</strong></dt><dd><% print(new Date(created_at)); %></dd>" +
            "<dt><strong>managed</strong></dt><dd><%= managed %></dd>" +
            "<dt><strong>uri</strong></dt><dd><%= uri %></dd>"
        ),
        form_template: _.template(
            "<dt><strong>label</strong></dt><dd><input type='text' name='label', value='<%= label %>'></dd>" +
            "<dt><strong>agent id</strong></dt><dd><input type='text' name='agent_id', value='<%= agent_id %>'></dd>" +
            "<dt><strong>created at</strong></dt><dd><% print(new Date(created_at)); %></dd>" +
            "<dt><strong>managed</strong></dt><dd><%= managed %></dd>" +
            "<dt><strong>uri</strong></dt><dd><%= uri %></dd>"
        ),
        iptemplate: _.template(
            "<% _.each(ip_addresses, function(value, key) { %>" +
                "<dt><strong><%= key %></strong></dt>" +
                "<dd><%= value %></dd>" +
            "<% }); %>"
        ),
        metadatatemplate: _.template(
            "<% _.each(metadata, function(value, key) { %>" +
                "<dt><strong><%= key %></strong></dt>" +
                "<dd><%= value %></dd>" +
            "<% }); %>"
        ),
        errortemplate: _.template(
            "<div class='alert alert-error'>" +
                "<button type='button' class='close' data-dismiss='alert'>×</button>" +
                "<h4><%= message %></h4>" +
                "<%= details %>" +
            "</div>"
        ),

        initialize: function () {
            $('#edit-entity-button').on('click', this.handleEdit.bind(this));
            $('#save-entity-button').on('click', this.handleSave.bind(this));
            $('#cancel-entity-button').on('click', this.handleCancel.bind(this));
            this.model.on('change', this.render.bind(this));
        },

        handleSave: function () {

            // MaaS doesn't return model content on error, so we need to keep track of stuff
            // we tried to change and put it back if the save fails.
            var changed = {};
            var _cache = {};

            var _success = function (model) {
                model.change();
                this.render();
                this.handleCancel();
            };

            var _error = function (model, xhr) {
                
                var error = {message: 'Unknown Error', details: 'Try again later'};
                try {
                    var r = JSON.parse(xhr.responseText);
                    error.message = r.message;
                    error.details = r.details;
                } catch (e) {}

                $('#entityalert').html(this.errortemplate(error));

                this.model.set(_cache);
                this.render(true);
            };

            _.each($(this.el).find('input'), function (input) {
                var original_value = this.model.get(input.name);
                var new_value = input.value;

                if (original_value !== new_value) {
                    _cache[input.name] = original_value;
                    changed[input.name] = new_value;
                }
            }.bind(this));

            if (!_.isEmpty(changed)) {
                this.model.save(changed, {success: _success.bind(this), error: _error.bind(this)});
            } else {
                this.handleCancel();
            }
        },

        handleCancel: function () {
            $(this.el).html(this.template(this.model.toJSON()));
            $('#edit-entity-button').show();
            $('#save-entity-button').hide();
            $('#cancel-entity-button').hide();

        },

        handleEdit: function () {
            $(this.el).html(this.form_template(this.model.toJSON()));
            $('#edit-entity-button').hide();
            $('#save-entity-button').show();
            $('#cancel-entity-button').show();
        },

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

        render: function (use_form) {
            var template = use_form ? this.form_template : this.template;


            // render entity details
            var m = this.model.toJSON();
            $(this.el).html(template(m));
            $('#entity-ip-addresses').html(this.iptemplate(m));
            $('#entity-metadata').html(this.metadatatemplate(m));

            // render check list
            var cl = $("#entity-checks-list");
            cl.html("<tr><td>LOADING CHECKS</td></tr>");
            this.model.checks.fetch({"success": this.renderCheckListSuccess, "error": this.renderCheckListFail});
        }
    });

    /* This should be bound to a model, so updates should rerender correctly */
    var EntityView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template("<td><%= label %></a></td><td><%= id %></td>"),
        events: {"click": "clickHandler"},

        clickHandler: function () {
            window.location.hash = 'entities/' + this.model.id;
        },

        render: function() {
            $(this.el).addClass('clickable');
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        }
    });

    /* TODO - Ideally this is bound to the collection so updates happen automatically */
    var EntitiesView = Backbone.View.extend({
        el: $('#entity-list'),
        events: {},
    
        render: function()
        {
            $(this.el).empty();
            this.collection.each(function (m) {
                this.add(m);
            }.bind(this));
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

    var renderEntityDetails = function (id) {
        Views.renderView('entity-details');

        var model = App.getInstance().account.entities.get(id);
        if (!model) {
            window.location.hash = 'entities';
            return;
        }

        entityDetailsView = new EntityDetailsView({"model": model});
        entityDetailsView.render();
    };

    var renderEntitiesList = function () {
        Views.renderView('entities');

        if (!entitiesView) {
            entitiesView = new EntitiesView({collection: App.getInstance().account.entities});
        }
        entitiesView.render();
    };

    return {'renderEntityDetails': renderEntityDetails,
            'renderEntitiesList': renderEntitiesList};

});
