define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views',
  'templates/entities',
  'jquerydebounce'
], function($, Backbone, _, App, Models, Views, Templates) {

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
        _pre_save_cache: {},

        _ip_addresses_view: null,
        _metadata_view: null,

        initialize: function () {
            
            // div for inserting errors
            this._errors = $('<div>');

            // header (title and control buttons)
            this._header = this._makeHeader();
            this._body = $('<div>');

            // body
            this._body.append($('<h3>').append('details'));
            this._details = $('<dl>').addClass('dl-horizontal');
            this._body.append(this._details);

            this._body.append($('<h3>').append('ip_addresses'));
            this._ipAddresses = $('<dl>').addClass('dl-horizontal');
            this._body.append(this._ipAddresses);

            this._body.append($('<h3>').append('metadata'));
            this._metadata = $('<dl>').addClass('dl-horizontal');
            this._body.append(this._metadata);

            this._detailsView = new Views.KeyValueView({
                el: this._details,
                model: this.model,
                editKeys: false,
                editableKeys: ['label', 'agent_id'],
                ignoredKeys: ['ip_addresses', 'metadata'],
                formatters: {created_at: function (val) {return (new Date(val));},
                             updated_at: function (val) {return (new Date(val));}}
            });

            this._ipAddressesView = new Views.KeyValueView({
                el: this._ipAddresses,
                modelKey: 'ip_addresses',
                model: this.model,
                editKeys: true
            });

            this._metadataView = new Views.KeyValueView({
                el: this._metadata,
                modelKey: 'metadata',
                model: this.model,
                editKeys: true
            });

            $(this.el).append(this._errors);
            $(this.el).append(this._header);
            $(this.el).append(this._body);
            this.model.on('change', this.render.bind(this));
        },

        _makeHeader: function () {
            var saveButton, editButton, cancelButton, header;
           
            editButton = $('<i>')
                .addClass('icon-pencil clickable')
                .tooltip({placement: 'right', title: 'edit'});
            editButton.on('click', this.handleEdit.bind(this));

            saveButton = $('<i>')
                .addClass('icon-ok clickable')
                .tooltip({placement: 'right', title: 'save changes'});
            saveButton.on('click', this.handleSave.bind(this));

            cancelButton = $('<i>')
                .addClass('icon-remove clickable')
                .tooltip({placement: 'right', title: 'cancel'});
            cancelButton.on('click', this.handleCancel.bind(this));

            header = $('<div>')
                        .addClass('row-fluid')
                        .append(
                            $('<div>').addClass('span12')
                                .append($('<h2>').addClass('pull-left').append(this.getTitle()))
                                .append(editButton)
                                .append(saveButton)
                                .append(cancelButton));
            return header;
        },

        getTitle: function () {
            return this.model.get('label');
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
            this.render();
        },

        handleEdit: function () {
            this.render(true);
        },

        render: function (edit) {
            this._detailsView.render(edit);
            this._ipAddressesView.render(edit);
            this._metadataView.render(edit);
           //this.model.checks.fetch({"success": this.renderCheckListSuccess, "error": this.renderCheckListFail});
        }

    });

    var EntityView = Views.ListElementView.extend({

        template: Templates.row_entitytemplate,

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
        $('#entities').empty();

        var model = App.getInstance().account.entities.get(id);
        if (!model) {
            window.location.hash = 'entities';
            return;
        }

        var entityDetailsView = new EntityDetailsView({el: $("#entities"), "model": model});
        entityDetailsView.render();
    };

    var renderEntitiesList = function () {
        $('#entities').empty();

        if (!entitiesView) {
            entitiesView = new EntityListView({el: $("#entities"), collection: App.getInstance().account.entities});
        }
        entitiesView.render();
    };

    return {'renderEntityDetails': renderEntityDetails,
            'renderEntitiesList': renderEntitiesList};

});