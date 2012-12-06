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
            this.model.destroy();
            this._modal.hide();
        }
    });

    var CheckListView = Views.ListView.extend({

        name: 'check',
        plural: 'checks',
        elementView: CheckView,

        handleNew: function (label) {

            function saveSuccess(check) {
                entity.fetch({
                    success: function(c) {
                        this._modal.hide();
                        this.collection.add(c);
                        window.location.hash = 'entities/' + c.entity_id + '/checks/' + c.id;
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
                this.error(r.message);
                this._modal.hide();
            }
            c = new Models.Check({label: label});
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
                "<option><%= label %> (<%= ip_address %>)</option>" +
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
                    "<input type='checkbox' name='<%= mz.id %>'>" +
                    "<%= mz.label %> (<%= mz.id %>)" +
                "</label>" +
            "<% }); %>"
        ),

        editTextTemplate: _.template(
            "<label class='key'>" +
                "<strong><%= key %> </strong><%= optional %>" +
            "</label>" +
            "<input class='value', type='text' name='<%= value %>', placeholder='<%= value %>' />"
        ),

        editBooleanTemplate: _.template(
            "<label class='checkbox'>" +
                "<input type='checkbox' value=''>" +
                "<strong><%= key %></strong>" +
            "</label>"
        ),

        initialize: function(opts) {
            this.checkTypesCollection = opts.checkTypesCollection;
            this.monitoringZonesCollection = opts.monitoringZonesCollection;

            this._checkTypes = $('<select>');
            this.$el.append('<label><strong>check_type</strong></label>');
            this.$el.append(this._checkTypes);

            this.$el.append('<hr/>');

            this._form = $('<div>');
            this.$el.append(this._form);

            // Monitoring Zones
            this._monitoringZones = $('<div>');

            //IP
            this._ipAddresses = $('<select>');
            this._ipAddressesForm = $('<div>');
            this._ipAddressesForm.append('<label><strong>ip_address</strong></label>');
            this._ipAddressesForm.append(this._ipAddresses);

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

            this._checkTypes.change(this._handleTypeSelection.bind(this));

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

            if (type.get('type') === 'remote') {
                this._form.append(this._monitoringZones);
                this._form.append('<hr/>');
                this._form.append(this._ipAddresses);
                this._form.append('<hr/>');
            }

            _.each(type.get('fields'), function (field) {
                var t = this.editTextTemplate;
                if (_.indexOf(this.booleanFields, field.name) > -1) {
                    t = this.editBooleanTemplate;
                }
                form.append(t({key: field.name, value: field.description, optional: field.optional ? '(optional)' : ''}));
            }.bind(this));

            return form;
        },

        _handleTypeSelection: function(event) {
            var checkType = this.checkTypesCollection.get(event.target.value);
            this._form.empty();
            this._form.append(this._makeForm(checkType));
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

            magicFormView = new MagicFormView({checkTypesCollection: this.checkTypesCollection,
                                               monitoringZonesCollection: this.monitoringZonesCollection,
                                               collection: this.collection});

            body.append(magicFormView.render());


            // if (this.body) {
            //     body.append(_.isFunction(this.body) ? this.body() : this.body || "");
            // }
            // if (this.input) {
            //     input = $('<input>').attr('type', 'text')
            //                 .attr('placeholder', _.isFunction(this.label) ? this.label() : this.label || "");
            //     body.append(input);
            // }
            return body;
        }
    });


    var renderCheckDetails = function (id) {
        $('#entities').empty();

        var model = App.getInstance().account.entities.get(id);
        if (!model) {
            window.location.hash = 'entities';
            return;
        }

        var entityDetailsView = new EntityDetailsView({el: $("#entities"), "model": model});
        entityDetailsView.render();
    };

    return {CheckListView: CheckListView,
            renderCheckDetails: renderCheckDetails};
});