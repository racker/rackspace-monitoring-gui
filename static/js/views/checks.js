define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views',
  'jquerydebounce'
], function($, Backbone, _, App, Models, Views) {

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

    var MagicFormView = Backbone.View.extend({

        booleanFields: ['starttls', 'follow_redirects', 'ssl'],

        selectIpTemplate: _.template(
            "<% _.each(ip_addresses, function(ip_address, label) { %>" +
                "<option name='<%= label %>' value='<%= label %>'><%= label %> (<%= ip_address %>)</option>" +
            "<% }); %>"
        ),

        selectTypeTemplate: _.template(
            "<option></option>" +
            "<% _.each(check_types, function(type) { %>" +
                "<option><%= type.id %></option>" +
            "<% }); %>"
        ),

        monitoringZoneTemplate: _.template(
            "<label class='key'><strong>monitoring_zones</strong></label>" +
            "<% _.each(monitoring_zones, function(mz) { %>" +
                "<label class='checkbox'>" +
                    "<input type='checkbox' class='monitoring_zones_select' name='<%= mz.id %>'>" +
                    "<%= mz.label %> (<%= mz.id %>)" +
                "</label>" +
            "<% }); %>"
        ),

        editTextTemplate: _.template(
            "<label><strong><%= key %></strong><%= optional %></label>" +
            "<input type='text' name='<%= key %>' placeholder='<%= value %>' />"
        ),

        editBooleanTemplate: _.template(
            "<label class='checkbox'>" +
                "<input name='<%= key %>' type='checkbox' value=''>" +
                "<strong><%= key %></strong>" +
            "</label>"
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

            //Check Target
            this._targetForm = $('<div>');
            this._targetForm.append('<label><strong>check_target</strong></label>');
            this._targetType = $('<select>').append('<option>ip</option><option>hostname</option>');
            this._hostname = $('<input type="text" placeholder="Target Hostname" />').hide();
            this._ipAddresses = $('<select>');

            this._targetForm.append(this._targetType, this._ipAddresses, this._hostname);

            this._targetType.change(function (event) {
                if (event.target.value == 'ip') {
                    this._ipAddresses.show();
                    this._hostname.hide();
                } else {
                    this._hostname.show();
                    this._ipAddresses.hide();
                }
            }.bind(this));

            // Fetch relevant dropdown data
            this.checkTypesCollection.fetch({success: this._populateCheckTypes.bind(this), error: function() {
                    this.$el.append("Check Types Fetch Failed");
                }
            });

            this.monitoringZonesCollection.fetch({success: this._populateMonitoringZones.bind(this), error: function () {
                this.$el.append("Monitoring Zones Fetch Failed");
            }});

            this.collection.entity.fetch({success: this._populateIpAddresses.bind(this), error: function () {
                this.$el.append("Entity Fetch Failed");
            }});

        },

        /* Parse form and return a JSON object suitable for creating a new check */
        getValues: function () {

            var new_check = {};
            var details = {};

            // Common data
            new_check.type = this._checkType.id;
            new_check.label = this._checkLabel.val();

            // Remote check data
            if (this._checkType.get('type') === 'remote') {
                var target_type = this._targetType.val();
                if (target_type === 'ip') {
                    new_check.target_alias = this._ipAddresses.val();
                } else {
                    new_check.target_hostname = this._hostname.val();
                }
    
                new_check.monitoring_zones_poll = [];
                _.each(this._monitoringZones.find('input:checked'), function(mz_el) {
                    new_check.monitoring_zones_poll.push(mz_el.name);
                });
            }

            _.each(this._form.find('.details').find('input'), function (el) {
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
            new_check.details = details;

            // Specific check type data
            return new_check;

        },

        _populateMonitoringZones: function (collection) {
            this._monitoringZones.empty();
            this._monitoringZones.html(this.monitoringZoneTemplate({monitoring_zones: this.monitoringZonesCollection.toJSON()}));
        },

        _populateCheckTypes: function (collection) {
            this._checkTypes.empty();
            this._checkTypes.html(this.selectTypeTemplate({check_types: this.checkTypesCollection.toJSON()}));
        },

        _populateIpAddresses: function (collection) {
            this._ipAddresses.empty();
            this._ipAddresses.html(this.selectIpTemplate(this.collection.entity.toJSON()));
        },

        _makeForm: function(type) {
            var form = $('<form>');
            var details = $('<div>').addClass('details');

            if (type.get('type') === 'remote') {
                form.append(this._targetForm);
                form.append('<hr/>');
                form.append(this._monitoringZones);
                form.append('<hr/>');
            }

            _.each(type.get('fields'), function (field) {
                var t = this.editTextTemplate;
                if (_.indexOf(this.booleanFields, field.name) > -1) {
                    t = this.editBooleanTemplate;
                }
                details.append(t({key: field.name, value: field.description, optional: field.optional ? '(optional)' : ''}));
            }.bind(this));

            form.append(details);
            return form;
        },

        _handleTypeSelection: function(event) {
            this._checkType = this.checkTypesCollection.get(event.target.value);
            this._form.empty();
            this._form.append(this._makeForm(this._checkType));
        },

        render: function() {
            this._populateMonitoringZones(this.monitoringZonesCollection);
            this._populateCheckTypes(this.checkTypesCollection);
            this._populateIpAddresses(this.collection);
            return this.$el;
        }
    });

    var NewCheckModal = Views.Modal.extend({
        _makeBody: function () {
            var body, magicFormView;
            body = $('<div>').addClass('modal-body');

            this._magicFormView = new MagicFormView({checkTypesCollection: this.checkTypesCollection,
                                               monitoringZonesCollection: this.monitoringZonesCollection,
                                               collection: this.collection});

            body.append(this._magicFormView.render());
            return body;
        },

        _onConfirm: function () {
            this.onConfirm(this._magicFormView.getValues());
        }
    });

    var CheckDetailsView = Views.DetailsView.extend({

        _makeBody: function() {
            var body = $('<div>');
            body.append($('<h3>').append('details'));
            this._details = $('<dl>').addClass('dl-horizontal');
            body.append(this._details);

            this._alarms = $('<div>');
            body.append(this._alarms);

            this._detailsView = new Views.KeyValueView({
                el: this._details,
                model: this.model,
                editKeys: false,
                editableKeys: ['label'],
                ignoredKeys: ['ip_addresses', 'metadata', 'details', 'entity_id'],
                formatters: {created_at: function (val) {return (new Date(val));},
                             updated_at: function (val) {return (new Date(val));}}
            });

            return body;
        },

        handleSave: function () {

        },

        render: function () {
            this._detailsView.render(this.editState);
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