define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views',
  'views/alarms',
  'jquerydebounce'
], function($, Backbone, _, App, Models, Views, AlarmViews) {

    var CheckView = Views.ListElementView.extend({

        template: _.template("<td><a class='details clickable'><%= label %></a></td><td><%= id %></td><td><i class='icon-remove delete clickable'></i></td>"),

        detailsHandler: function () {
            window.location.hash = 'entities/' + this.model.get('entity_id') + '/checks/' + this.model.id;
        },

        deleteHandler: function () {
            this.model.destroy({wait: true});
            this._modal.hide();
        }
    });

    var CheckListView = Views.ListView.extend({

        name: 'check',
        plural: 'checks',
        elementView: CheckView,

        handleNew: function (newCheck) {

            function saveSuccess(check) {
                check.fetch({
                    success: function(c) {
                        this._modal.hide();
                        this.collection.add(c);
                        window.location.hash = 'entities/' + c.get('entity_id') + '/checks/' + c.id;
                    }.bind(this), error: function(e) {
                        this.error('Error fetching ' + this.name);
                        this._modal.hide();
                    }.bind(this)
                });
            }

            function saveError(check, response) {
                try {
                    r = JSON.parse(response.responseText);
                } catch (e) {
                    r = {'name': 'UnknownError', 'message': 'UnknownError: An unknown error occured.'};
                }
                this.error(r);
                this._modal.hide();
            }
            c = new Models.Check(newCheck);
            c.set('entity_id', this.collection.entity.id);
            c.save({}, {success: saveSuccess.bind(this), error: saveError.bind(this)});
        },

        _makeModal: function () {
            var modal = new NewCheckModal({checkTypesCollection: App.getInstance().account.check_types,
                                           monitoringZonesCollection: App.getInstance().account.monitoring_zones,
                                           collection: this.collection,
                                           onConfirm: this.handleNew.bind(this),
                                           header: '<h4>Create New ' + this.name+'</h4>'});
            return modal;

        }

    });

    var MonitoringZonesSelect = Backbone.View.extend({

        viewTemplate: _.template(
            "<% _.each(monitoring_zones, function(mz) { %>" +
                "<label class='checkbox'>" +
                    "<input type='checkbox' class='monitoring_zones_select' disabled='disabled' name='<%= mz.id %>'>" +
                    "<%= mz.label %> (<%= mz.id %>)" +
                "</label>" +
            "<% }); %>"
        ),

        editTemplate: _.template(
            "<% _.each(monitoring_zones, function(mz) { %>" +
                "<label class='checkbox'>" +
                    "<input type='checkbox' class='monitoring_zones_select' name='<%= mz.id %>'>" +
                    "<%= mz.label %> (<%= mz.id %>)" +
                "</label>" +
            "<% }); %>"
        ),

        initialize: function(opts) {

            this.check = opts.check;

            this.collection.fetch({
                success: this.render.bind(this, false),
                error: function () {
                    this.$el.empty();
                    this.$el.append('fetching monitoring zones failed');
                }
            });
        },

        render: function (edit) {
            this.$el.empty();

            if (edit) {
                this.$el.html(this.editTemplate({monitoring_zones: this.collection.toJSON()}));
            } else {
                this.$el.html(this.viewTemplate({monitoring_zones: this.collection.toJSON()}));
            }

            if (this.check) {
                _.each(this.$el.find('input'), function (mz) {
                    if (_.indexOf(this.check.get('monitoring_zones_poll'), $(mz).attr('name')) !== -1) {
                        $(mz).attr('checked', 'checked');
                    }
                }.bind(this));
            }

            return this.$el;
        },

        getValues: function () {
            var vals = [];
            _.each(this.$el.find('input:checked'), function(mz_el) {
                vals.push(mz_el.name);
            });
            return vals;
        }
    });

    var TargetSelect = Backbone.View.extend({

        viewTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><%= value %>&nbsp;</dd>"
        ),

        editTemplate: _.template(
            "<% _.each(ip_addresses, function(ip_address, label) { %>" +
                "<option name='<%= label %>' value='<%= label %>'><%= label %> (<%= ip_address %>)</option>" +
            "<% }); %>"
        ),


        initialize: function(opts) {

            this.entity = opts.entity;
            this.check = opts.check;

            this._display = $('<dl>').addClass('dl-horizontal');

            this._edit = $('<div>');
            this._edit.hide();
            this._targetType = $('<select>').append('<option value="ip">ip</option><option value="hostname">hostname</option>');
            this._hostname = $('<input type="text" placeholder="Target Hostname" />').hide();
            this._ipAddresses = $('<select>');

            this._edit.append(this._targetType, this._ipAddresses, this._hostname);

            this._targetType.change(function (event) {
                if (event.target.value == 'ip') {
                    this._ipAddresses.show();
                    this._hostname.hide();
                } else {
                    this._hostname.show();
                    this._ipAddresses.hide();
                }
            }.bind(this));

            this.entity.fetch();

            this.$el.append(this._display, this._edit);

        },

        render: function (edit) {

            var selected;
            var target = {};

            if (edit) {
                this._display.hide();
                this._edit.show();
                this._ipAddresses.empty();
                this._ipAddresses.html(this.editTemplate(this.entity.toJSON()));

                if (this.check) {

                    /* we have to pre-set the target selector with existing values */
                    if (this.check.get('target_alias')) {
                        this._ipAddresses.find('option[value=' + this.check.get('target_alias') +']').attr('selected', 'selected');
                    } else {
                        this._targetType.find('option[value=hostname]').attr('selected', 'selected').change();
                        this._hostname.attr('value', this.check.get('target_hostname'));
                    }
                }
            } else {
                this._display.show();
                this._edit.hide();
                if (this.check.get('target_hostname')) {
                    target.key = 'target_hostname';
                    target.value = this.check.get('target_hostname');
                } else {
                    target.key = 'target_alias';
                    target.value = this.check.get('target_alias') + ' (' + this.entity.get('ip_addresses')[this.check.get('target_alias')] + ')';
                }
                this._display.empty();
                this._display.append(this.viewTemplate(target));
            }

            return this.$el;
        },

        getValues: function () {
            var val = {type: null, value: null};

            var target_type = this._targetType.val();
            if (target_type === 'ip') {
                val.type = 'target_alias';
                val.value = this._ipAddresses.val();
            } else {
                val.type = 'target_hostname';
                val.value = this._hostname.val();
            }

            return val;
        }

    });

    var CheckDetails = Backbone.View.extend({

        booleanFields: ['starttls', 'follow_redirects', 'ssl'],

        viewTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><%= value %>&nbsp;</dd>"
        ),

        viewBooleanTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><input name='<%= key %>' type='checkbox' <%= value %> disabled='disabled'</dd>"
        ),

        editTextTemplate: _.template(
            "<dt><label><strong><%= key %></strong><%= optional %></label></dt>" +
            "<dd><input type='text' name='<%= key %>' value='<%= value %>' placeholder='<%= description %>' /></dd>"
        ),

        editBooleanTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><input name='<%= key %>' type='checkbox' <%= value %>></dd>"
        ),

        initialize: function(opts) {

            this.check = opts.check;

        },

        render: function (edit, type) {

            this.$el.empty();
            var t, v, val;

            _.each(type.get('fields'), function (field) {

                val = null;

                if (edit) {
                    t = this.editTextTemplate;
                    if (_.indexOf(this.booleanFields, field.name) > -1) {
                        t = this.editBooleanTemplate;
                    }
                } else {
                    t = this.viewTemplate;
                    if (_.indexOf(this.booleanFields, field.name) > -1) {
                        t = this.viewBooleanTemplate;
                    }
                }

                /* Need to display the actual value if we are editing a real check */
                if (this.check) {
                    if (_.indexOf(this.booleanFields, field.name) !== -1) {
                        val = this.check.get('details')[field.name] ? 'checked' : '';
                    } else {
                        val = this.check.get('details')[field.name];
                    }
                }

                v = {key: field.name, value: val || '', description: field.description, optional: field.optional ? '(optional)' : ''};


                this.$el.append(t(v));

            }.bind(this));
        },

        getValues: function () {
            var details = {};
            _.each(this.$el.find('input'), function (el) {
                var val;
                var key = el.name;
                if (el.type === 'checkbox') {
                    details[key] = el.checked;
                } else {
                    if (el.value) {
                        details[key] = el.value;
                    }
                }
            });
            return details;
        }
    });

    var NewCheckForm = Backbone.View.extend({

        selectTypeTemplate: _.template(
            "<option></option>" +
            "<% _.each(check_types, function(type) { %>" +
                "<option><%= type.id %></option>" +
            "<% }); %>"
        ),

        initialize: function(opts) {
            this.checkTypesCollection = opts.checkTypesCollection;
            this.monitoringZonesCollection = opts.monitoringZonesCollection;

            // Common Check Attributes
            this._checkLabel = $('<input type="text" placeholder="Check Label" />');
            this.$el.append('<label><strong>label</strong></label>');
            this.$el.append(this._checkLabel);

            this._checkTypes = $('<select>');
            this._checkTypes.change(this._handleTypeSelection.bind(this));
            this.$el.append('<label><strong>check_type</strong></label>');
            this.$el.append(this._checkTypes);

            this.$el.append('<hr/>');

            this._form = $('<div>');
            this.$el.append(this._form);

            // Monitoring Zones
            this._monitoringZones = $('<div>');
            this._monitoringZones.append('<label><strong>monitoring_zones</strong></label>');
            this._monitoringZonesForm = $('<div>');
            this._monitoringZonesView = new MonitoringZonesSelect({el: this._monitoringZonesForm, collection: this.monitoringZonesCollection});
            this._monitoringZones.append(this._monitoringZonesForm);

            //Check Target
            this._target = $('<div>');
            this._target.append('<label><strong>check_target</strong></label>');
            this._targetForm = $('<div>');
            this._targetView = new TargetSelect({el: this._targetForm, entity: this.collection.entity});
            this._target.append(this._targetForm);

            //Check Details
            this._details = $('<div>');
            this._details.append('<label><strong>details</strong></label>');
            this._detailsForm = $('<div>');
            this._detailsView = new CheckDetails({el: this._detailsForm, collection: this.checkTypesCollection});
            this._details.append(this._detailsForm);

            // Fetch relevant dropdown data
            this.checkTypesCollection.fetch({success: this._populateCheckTypes.bind(this), error: function() {
                    this.$el.append("Check Types Fetch Failed");
                }
            });

        },

        /* Parse form and return a JSON object suitable for creating a new check */
        getValues: function () {

            var new_check = {};

            // Common data
            new_check.type = this._checkType.id;
            new_check.label = this._checkLabel.val();

            // Remote check data
            if (this._checkType.get('type') === 'remote') {
                var target = this._targetView.getValues();
                new_check[target.type] = target.value;
                new_check.monitoring_zones_poll = this._monitoringZonesView.getValues();
            }

            new_check.details = this._detailsView.getValues();

            return new_check;

        },

        _populateCheckTypes: function (collection) {
            this._checkTypes.empty();
            this._checkTypes.html(this.selectTypeTemplate({check_types: this.checkTypesCollection.toJSON()}));
        },

        _makeForm: function(type) {
            var form = $('<form>');

            /* render each subform into their own elements */
            this._targetView.render(true);
            this._monitoringZonesView.render(true);
            this._detailsView.render(true, this._checkType);

            /* construct form */
            if (type.get('type') === 'remote') {
                form.append(this._target);
                form.append('<hr/>');
                form.append(this._monitoringZones);
                form.append('<hr/>');
            }
            form.append(this._details);
            return form;
        },

        _handleTypeSelection: function(event) {
            this._checkType = this.checkTypesCollection.get(event.target.value);

            /* construct subforms */
            this._form.empty();
            this._form.append(this._makeForm(this._checkType));
        },

        render: function() {
            this._populateCheckTypes(this.checkTypesCollection);
            return this.$el;
        }
    });

    var NewCheckModal = Views.Modal.extend({
        _makeBody: function () {
            var body = $('<div>').addClass('modal-body');

            this._newCheckForm = new NewCheckForm({checkTypesCollection: this.checkTypesCollection,
                                               monitoringZonesCollection: this.monitoringZonesCollection,
                                               collection: this.collection});

            body.append(this._newCheckForm.render());
            return body;
        },

        _onConfirm: function () {
            this.onConfirm(this._newCheckForm.getValues());
        }
    });

    var CheckDetailsView = Views.DetailsView.extend({

        _makeBody: function() {
            var body = $('<div>');
            this._check = $('<dl>').addClass('dl-horizontal');
            body.append(this._check);

            body.append($('<h3>').append('details'));
            this._details = $('<dl>').addClass('dl-horizontal');
            body.append(this._details);

            if (this.model.get('type').indexOf("remote.") === 0) {
                body.append($('<h3>').append('target'));
                this._target = $('<div>');
                body.append(this._target);
                this._targetView = new TargetSelect({el: this._target, check: this.model, entity: this.model.getEntity()});

                body.append($('<h3>').append('monitoring_zones'));
                this._monitoringZones = $('<div>');
                body.append(this._monitoringZones);
                this._monitoringZonesView = new MonitoringZonesSelect({el: this._monitoringZones, collection: App.getInstance().account.monitoring_zones, check: this.model});
            }

            body.append($('<h3>').append('metadata'));
            this._metadata = $('<dl>').addClass('dl-horizontal');
            body.append(this._metadata);

            this._alarms = $('<div>');
            body.append(this._alarms);

            this._checkView = new Views.KeyValueView({
                el: this._check,
                model: this.model,
                editKeys: false,
                editableKeys: ['label', 'timeout', 'period'],
                ignoredKeys: ['metadata', 'details',
                              'monitoring_zones_poll',
                              'entity_id', 'target_hostname',
                              'target_alias', 'target_resolver'],
                formatters: {created_at: function (val) {return (new Date(val));},
                             updated_at: function (val) {return (new Date(val));}}
            });

            this._detailsView = new CheckDetails({
                el: this._details,
                check: this.model
            });

            App.getInstance().account.check_types.fetch({
                success: function (collection) {
                    this._checkType = collection.get(this.model.get('type'));
                    this._detailsView.render(this.editState, this._checkType);
                }.bind(this),
                error: function () {
                    this._details.append('failed to fetch check types');
                }
            });

            this._metadataView = new Views.KeyValueView({
                el: this._metadata,
                modelKey: 'metadata',
                model: this.model,
                editKeys: true
            });

            this._alarmsView = new AlarmViews.AlarmListView({el: this._alarms, collection: this.model.getEntity().alarms, check: this.model});

            return body;
        },

        handleSave: function () {

            var _success = function (model) {
                this.editState = false;
                this.model.fetch();
            };

            var _error = function (model, xhr) {
                var error = {message: 'Unknown Error', details: 'Try again later'};
                try {
                    var r = JSON.parse(xhr.responseText);
                    error.message = r.message;
                    error.details = r.details;
                } catch (e) {}

                this.displayError(error);
                this.model.fetch();
            };

            var new_check = this._checkView.getValues();

            if (this.model.get('type').indexOf("remote.") === 0) {
                var target = this._targetView.getValues();
                new_check[target.type] = target.value;
                new_check.monitoring_zones_poll = this._monitoringZonesView.getValues();
            }
            new_check.metadata = this._metadataView.getValues();
            new_check.monitoring_zones_poll = this._monitoringZonesView.getValues();
            new_check.details = this._detailsView.getValues();

            this.model.save(new_check, {success: _success.bind(this), error: _error.bind(this)});

        },

        render: function () {
            this.model.getEntity().alarms.fetch();

            if (this._checkType) {
                this._detailsView.render(this.editState, this._checkType);
            }
            this._checkView.render(this.editState);
            this._metadataView.render(this.editState);

            if (this._monitoringZonesView) {
                this._monitoringZonesView.render(this.editState);
            }
            if (this._targetView) {
                this._targetView.render(this.editState);
            }

            if(this.editState) {
                this._editButton.hide();
                this._saveButton.show();
                this._cancelButton.show();
            } else {
                this._saveButton.hide();
                this._cancelButton.hide();
                this._editButton.show();
            }

        }
    });


    var renderCheckDetails = function (eid, cid) {
  
        var entity = App.getInstance().account.entities.get(eid);
        if (!entity) {
            window.location.hash = 'entities';
            return;
        }

        function _fetchSuccess (collection) {
            var check = collection.get(cid);
            if (!check) {
                window.location.hash = 'entities/' + entity.id;
                return;
            }
            var checkDetailsView = new CheckDetailsView({el: $("#check-details-view-content"), model: check});
            Views.renderView('check-details', [entity, check]);
            checkDetailsView.render();
        }

        function _fetchError (collection) {
            window.location.hash = 'entities';
        }

        entity.checks.fetch({success: _fetchSuccess, error: _fetchError});
    };

    return {CheckListView: CheckListView,
            renderCheckDetails: renderCheckDetails};
});