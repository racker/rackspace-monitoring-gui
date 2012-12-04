define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views',
  'jquerydebounce'
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

    var EntityMetadataDetailsView = Backbone.View.extend({
        tagName: "dl",
        className: "dl-horizontal",
        metadatatemplate: _.template(
            "<% _.each(metadata, function(value, key) { %>" +
                "<dt><strong><%= key %></strong></dt>" +
                "<dd><%= value %></dd>" +
            "<% }); %>"
        ),
        form_metadatatemplate: _.template(
            "<% _.each(metadata, function(value, key) { %>" +
                "<dt><input class='metadata_label', type='text' name='<%= key %>', value='<%= key %>'></dt>" +
                "<dd><input class='metadata_value', type='text' name='<%= value %>', value='<%= value %>'></dd>" +
            "<% }); %>"
        ),
        new_template: _.template(
            "<dt><input class='metadata_label', type='text', placeholder='key'></dt>" +
            "<dd><input class='metadata_value', type='text', placeholder='value'></dd>"
        ),

        handleNew: function (e) {
            if (e) {
                $(e.target.parentElement.parentElement).off('click');
            }
            var newmetadata = $('<div>').append(this.new_template()).on('click', function (e) {
                this.handleNew(e);
            }.bind(this));
            this.$el.append(newmetadata);

        },

        getValues: function () {
            var labels = $(this.el).find('.metadata_label');
            var values = $(this.el).find('.metadata_value');

            var r = _.reduce(labels, function(memo, label, index, labels) {

                var l = label.value;
                var v = values[index] ? values[index].value : null;

                if (l && v) {
                    memo[l] = v;
                }
                return memo;
            }, {});

            return r;
        },

        render: function (edit) {
            
            this.$el.empty();
            var metadatatemplate = edit ? this.form_metadatatemplate: this.metadatatemplate;
            this.$el.append(metadatatemplate(this.model.toJSON()));

            if (edit) {
                this.handleNew();
            }

            return this.$el;
        }
    });


    var EntityIPDetailsView = Backbone.View.extend({
        tagName: "dl",
        className: "dl-horizontal",
        iptemplate: _.template(
            "<% _.each(ip_addresses, function(value, key) { %>" +
                "<dt><strong><%= key %></strong></dt>" +
                "<dd><%= value %></dd>" +
            "<% }); %>"
        ),
        form_iptemplate: _.template(
            "<% _.each(ip_addresses, function(value, key) { %>" +
                "<dt><input class='ip_label', type='text' name='<%= key %>', value='<%= key %>'></dt>" +
                "<dd><input class='ip_value', type='text' name='<%= value %>', value='<%= value %>'></dd>" +
            "<% }); %>"
        ),
        new_template: _.template(
            "<dt><input class='ip_label', type='text', placeholder='ip_label'></dt>" +
            "<dd><input class='ip_value', type='text', placeholder='0.0.0.0'></dd>"
        ),

        handleNew: function (e) {
            if (e) {
                $(e.target.parentElement.parentElement).off('click');
            }
            var newip = $('<div>').append(this.new_template()).on('click', function (e) {
                this.handleNew(e);
            }.bind(this));
            this.$el.append(newip);

        },

        getValues: function () {
            var labels = $(this.el).find('.ip_label');
            var values = $(this.el).find('.ip_value');

            var r = _.reduce(labels, function(memo, label, index, labels) {

                var l = label.value;
                var v = values[index] ? values[index].value : null;

                if (l && v) {
                    memo[l] = v;
                }
                return memo;
            }, {});

            return r;
        },

        render: function (edit) {
            
            this.$el.empty();
            var iptemplate = edit ? this.form_iptemplate: this.iptemplate;
            this.$el.append(iptemplate(this.model.toJSON()));

            if (edit) {
                this.handleNew();
            }

            return this.$el;
        }
    });

    var EntityDetailsView = Backbone.View.extend({
        el: $('#entity-details'),
        _pre_save_cache: {},

        _ip_addresses_view: null,
        _metadata_view: null,

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
        errortemplate: _.template(
            "<div class='alert alert-error'>" +
                "<button type='button' class='close' data-dismiss='alert'>×</button>" +
                "<h4><%= message %></h4>" +
                "<%= details %>" +
            "</div>"
        ),

        initialize: function () {
            $('#edit-entity-button').off('click');
            $('#save-entity-button').off('click');
            $('#cancel-entity-button').off('click');

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

            var ips = this._ip_addresses_view.getValues();
            if (!_.isEqual(ips, this.model.get('ip_addresses'))) {
                _cache['ip_addresses'] = this.model.get('ip_addresses');
                changed['ip_addresses'] = ips;
            }

            var metadata = this._metadata_view.getValues();
            if (!_.isEqual(metadata, this.model.get('metadata'))) {
                _cache['metadata'] = this.model.get('metadata');
                changed['metadata'] = metadata;
            }

            if (!_.isEmpty(changed)) {
                this.model.save(changed, {success: _success.bind(this), error: _error.bind(this)});
            } else {
                this.handleCancel();
            }
        },

        handleCancel: function () {
            this.render(false);
            $('#edit-entity-button').show();
            $('#save-entity-button').hide();
            $('#cancel-entity-button').hide();

        },

        handleEdit: function () {
            this.render(true);
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

        render: function (edit) {
            var template = edit ? this.form_template : this.template;

            // render entity details
            var m = this.model.toJSON();
            $(this.el).html(template(m));

            // render IP addresses
            if(!this._ip_addresses_view) {
                this._ip_addresses_view = new EntityIPDetailsView({model: this.model});
            }
            $('#entity-ipaddresses').empty();
            $('#entity-ipaddresses').append(this._ip_addresses_view.render(edit));

            // render metadata
            if(!this._metadata_view) {
                this._metadata_view = new EntityMetadataDetailsView({model: this.model});
            }
            $('#entity-metadata').empty();
            $('#entity-metadata').append(this._metadata_view.render(edit));

            // render check list
            var cl = $("#entity-checks-list");
            cl.html("<tr><td>LOADING CHECKS</td></tr>");
            this.model.checks.fetch({"success": this.renderCheckListSuccess, "error": this.renderCheckListFail});
        }

    });

    var EntityView = Views.ListElementView.extend({
        template: _.template("<td><a class='details clickable'><%= label %></a></td><td><%= id %></td><td><i class='icon-remove delete clickable'></i></td>"),

        detailsHandler: function () {
            window.location.hash = 'entities/' + this.model.id;
        },

        deleteHandler: function () {
            this.model.destroy();
            this._modal.hide();
        }
    });

    var EntityListView = Views.ListView.extend({

        name: 'entity',
        plural: 'entities',
        elementView: EntityView,

        handleNew: function (label) {

            function saveSuccess(entity) {
                entity.fetch({
                    success: function(e) {
                        this._modal.hide();
                        App.getInstance().account.entities.add(e);
                        window.location.hash = 'entities/' + e.id;
                    }.bind(this), error: function(e) {
                        this.error('Error fetching ' + this.name);
                        this._modal.hide();
                    }.bind(this)
                });
            }

            function saveError(graph, response) {
                try {
                    r = JSON.parse(response.responseText);
                } catch (e) {
                    r = {'name': 'UnknownError', 'message': 'UnknownError: An unknown error occured.'};
                }
                this.error(r.message);
                this._modal.hide();
            }
            e = new Models.Entity({label: label});
            e.save({}, {success: saveSuccess.bind(this), error: saveError.bind(this)});
        }

    });

    var renderEntityDetails = function (id) {
        Views.renderView('entity-details');

        $('entities').empty();

        var model = App.getInstance().account.entities.get(id);
        if (!model) {
            window.location.hash = 'entities';
            return;
        }

        var entityDetailsView = new EntityDetailsView({"model": model});
        entityDetailsView.render();
    };

    var renderEntitiesList = function () {
        $('entities').empty();
        Views.renderView('entity-details');

        if (!entitiesView) {
            entitiesView = new EntityListView({el: $('#entities'), collection: App.getInstance().account.entities});
        }
        entitiesView.render();
    };

    return {'renderEntityDetails': renderEntityDetails,
            'renderEntitiesList': renderEntitiesList};

});
