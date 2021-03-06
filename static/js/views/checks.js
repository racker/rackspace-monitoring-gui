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
            Backbone.history.navigate('entities/' + this.model.get('entity_id') + '/checks/' + this.model.id, true);
        },

        deleteHandler: function () {
            this.model.destroy({wait: true});
            this._modal.hide();
        }
    }, {
        columnHeadings: ['Label', 'ID', 'Delete']
    });

    var CheckListView = Views.ListView.extend({

        name: 'Check',
        plural: 'Checks',
        elementView: CheckView,

        handleNew: function (newCheck) {

            function saveSuccess(check) {
                check.fetch({
                    success: function(c) {
                        this._modal.hide();
                        this.collection.add(c);
                        Backbone.history.navigate('entities/' + c.get('entity_id') + '/checks/' + c.id, true);
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

    var CheckDetails = Views.FormDetailsView.extend({
        booleanFields: ['starttls', 'follow_redirects', 'ssl'],
        listStringFields: ['args']
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
        _initialize: function (opts) {
            this.checkTypesCollection = this.checkTypesCollection || opts.checkTypesCollection;
            this.monitoringZonesCollection = this.monitoringZonesCollection || opts.monitoringZonesCollection;
        },

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

    var CheckTestView = Backbone.View.extend({

        keyValueTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><%= value %>&nbsp;</dd>"
        ),


        initialize: function (opts) {
            this.$el.empty();

            // Controls
            this._controlsContainer = $('<div>');
            this._testButton = $('<button>').addClass('btn btn-primary').html('Test Check');
            this._testButton.click(this.doTest.bind(this));
            this._controlsContainer.append(this._testButton);

            this._resultsContainer = $('<div>').addClass('accordion');
            this._showDetailsLink = $('<button>').addClass('btn btn-mini').html('Show Details');

            this._resultsBody = $('<div>');

            this._controls = $('<span>')
                .append(this._controlsContainer, this._resultsContainer);

            // Details
            this.$el.append(this._controls, this._resultsBody);
        },

        _makeResultsView: function (res) {
            var resultsView = new Views.KeyValueView({
                model: res,
                editKeys: false,
                ignoredKeys: ['metrics'],
                formatters: {
                    timestamp: function (val) {return (new Date(val));}
                }
            });

            return resultsView.render();
        },

        _makeMetricsView: function (res) {
            var t = _.template(
                "<dt><strong><%= key %></strong></dt>" +
                "<dd><%= value.data %> (type: <%= value.type %>)&nbsp;</dd>"
            );

            var resultsView = new Views.KeyValueView({
                model: res,
                modelKey: 'metrics',
                keyValueTemplate: t,
                editKeys: false,
                ignoredKeys: ['metrics'],
                formatters: {
                    timestamp: function (val) {return (new Date(val));}
                }
            });

            return resultsView.render();
        },

        _makeErrorView: function (res) {
            var resultsView = new Views.KeyValueView({
                json: res
            });
            return resultsView.render();
        },

        doTest: function () {

            function _success (collection) {
                this._resultsContainer.empty();
                this._resultsContainer.append(this._resultLabelOK);
                this._testButton.removeAttr('disabled');

                collection.each(function (res) {
                    var _testData = $('<div>').addClass('accordion-inner');
                    _testData.append('<dt><h4>details</h4></dt>');
                    _testData.append(this._makeResultsView(res));
                    _testData.append('<dt><h4>metrics</h4></dt>');
                    _testData.append(this._makeMetricsView(res));

                    var _body = $('<div>').addClass('accordion-body collapse');
                    _body.append(_testData);

                    var _label = $('<span>').addClass('label');
                    _label.addClass(res.get('available') ? 'label-success' : 'label-warning');

                    var resultString = res.get('monitoring_zone_id') ? 'monitoring zone: ' + res.get('monitoring_zone_id') + ' ' : '';
                    resultString += 'available: ' + res.get('available') + ' status: ' + res.get('status');
                    _label.html(resultString);
                    var _header = $('<a>').addClass('accordion-toggle').click(function () {_body.collapse('toggle');});
                    _header.append(_label);

                    var _group = $('<div>').addClass('accordion-group').append(
                        $('<div>').addClass('accordion-heading').append(_header),
                        _body
                    );

                    this._resultsBody.append(_group);
                }.bind(this));
            }

            function _error (collection, xhr) {
                this._resultsContainer.empty();
                this._testButton.removeAttr('disabled');

                var response = JSON.parse(xhr.responseText);

                var _testData = $('<div>').addClass('accordion-inner');
                _testData.append('<dt><h4>details</h4></dt>');
                _testData.append(this._makeErrorView(response));

                var _body = $('<div>').addClass('accordion-body collapse');
                _body.append(_testData);

                var _label = $('<span>').addClass('label label-important');
                _label.html('type: ' + response.type + ' message: ' + response.message);
                var _header = $('<a>').addClass('accordion-toggle').click(function () {_body.collapse('toggle');});
                _header.append(_label);

                var _group = $('<div>').addClass('accordion-group').append(
                    $('<div>').addClass('accordion-heading').append(_header),
                    _body
                );

                this._resultsBody.append(_group);
            }

            this._resultsBody.empty();
            this._resultsContainer.empty();
            this._testButton.attr('disabled', 'disabled');
            this._resultsContainer.append(Views.spinner());
            this.collection.fetch({type: 'POST', success: _success.bind(this), error: _error.bind(this)});

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

            this._test = $('<div>');
            body.append(this._test);

            this._alarms = $('<div>');
            body.append(this._alarms);

            this._checkView = new Views.KeyValueView({
                el: this._check,
                model: this.model,
                editKeys: false,
                editableKeys: ['timeout', 'period'],
                ignoredKeys: ['label', 'metadata', 'details',
                              'monitoring_zones_poll',
                              'entity_id', 'target_hostname',
                              'target_alias', 'target_resolver'],
                formatters: {created_at: function (val) {return (new Date(val));},
                             updated_at: function (val) {return (new Date(val));}}
            });

            this._detailsView = new CheckDetails({
                el: this._details,
                model: this.model
            });

            App.getInstance().account.check_types.fetch({
                success: function (collection) {
                    this._checkType = collection.get(this.model.get('type'));
                    this._detailsView.render(this.inEditState(), this._checkType);
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

            this._testView = new CheckTestView({el: this._test, collection: this.model.test});

            this._alarmsView = new AlarmViews.AlarmListView({el: this._alarms, collection: this.model.getEntity().alarms, check: this.model});

            return body;
        },

        getFormContents: function () {
            var newCheck = this._checkView.getValues();

            if (this.model.get('type').indexOf("remote.") === 0) {
                var target = this._targetView.getValues();
                newCheck[target.type] = target.value;
                newCheck.monitoring_zones_poll = this._monitoringZonesView.getValues();
            }
            newCheck.metadata = this._metadataView.getValues();
            newCheck.details = this._detailsView.getValues();

            return newCheck;
        },

        render: function () {
            this.model.getEntity().alarms.fetch();

            if (this._checkType) {
                this._detailsView.render(this.inEditState(), this._checkType);
            }
            this._checkView.render(this.inEditState());
            this._metadataView.render(this.inEditState());

            if (this._monitoringZonesView) {
                this._monitoringZonesView.render(this.inEditState());
            }
            if (this._targetView) {
                this._targetView.render(this.inEditState());
            }
        }
    });


    var renderCheckDetails = function (eid, cid) {

        var entity = App.getInstance().account.entities.get(eid);
        if (!entity) {
            Backbone.history.navigate('entities', true);
            return;
        }

        function _fetchSuccess (collection) {
            var check = collection.get(cid);
            if (!check) {
                Backbone.history.navigate('entities/' + entity.id, true);
                return;
            }
            var checkDetailsView = new CheckDetailsView({el: $("#check-details-view-content"), model: check});
            Views.renderView('check-details', [entity, check]);
            checkDetailsView.render();
        }

        function _fetchError (collection) {
            Backbone.history.navigate('entities', true);
        }

        entity.checks.fetch({success: _fetchSuccess, error: _fetchError});
    };

    return {CheckListView: CheckListView,
            renderCheckDetails: renderCheckDetails};
});
