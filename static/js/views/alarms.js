define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views',
  'views/notifications',
  'jquerydebounce'
], function($, Backbone, _, App, Models, Views, NotificationViews) {

    var AlarmView = Views.ListElementView.extend({

        template: _.template("<td><a class='details clickable'><%= label %></a></td><td><%= id %></td><td><i class='icon-remove delete clickable'></i></td>"),

        detailsHandler: function () {
            Backbone.history.navigate('entities/' + this.model.get('entity_id') + '/alarms/' + this.model.id, true);
        },

        deleteHandler: function () {
            this.model.destroy({wait: true});
            this._modal.hide();
        }
    }, {
        columnHeadings: ['Label', 'ID', 'Delete']
    });

    var NewAlarmModal = Views.Modal.extend({

        _initialize: function (opts) {
            this.notificationPlanCollection = opts.notificationPlanCollection;
        },

        _makeBody: function () {
            var body = $('<div>').addClass('modal-body');

            this._label = $('<dl>').addClass('dl-horizontal');
            this._alarmLabel = $('<input type="text" placeholder="Alarm Label" />');
            this._label.append('<dt><strong>label</strong></dt>');
            this._label.append($('<dd>').append(this._alarmLabel));
            body.append(this._label);

            this._notificationPlanView = new NotificationViews.NotificationPlanSelect({notificationPlanCollection: this.notificationPlanCollection});
            body.append(this._notificationPlanView.render(true));
            return body;
        },

        _onConfirm: function () {
            var new_alarm = {label: this._alarmLabel.val()};
            new_alarm.notification_plan_id = this._notificationPlanView.getValues();
            this.onConfirm(new_alarm);
        }
    });


    var AlarmListView = Views.ListView.extend({

        name: 'Alarm',
        plural: 'Alarms',
        elementView: AlarmView,

        _initialize: function (opts) {
            this.check = opts.check;
        },

        _filteredCollection: function () {
            return this.collection.filterByCheck(this.check);
        },

        _makeModal: function () {
            var modal = new NewAlarmModal({notificationPlanCollection: App.getInstance().account.notification_plans,
                                           onConfirm: this.handleNew.bind(this),
                                           header: '<h4>Create New ' + this.name + '</h4>'});
            return modal;
        },

        handleNew: function (newAlarm) {

            function saveSuccess(alarm) {
                alarm.fetch({
                    success: function(a) {
                        this._modal.hide();
                        this.collection.add(a);
                        Backbone.history.navigate('entities/' + a.get('entity_id') + '/alarms/' + a.id, true);
                    }.bind(this), error: function(a) {
                        this.error('Error fetching ' + this.name);
                        this._modal.hide();
                    }.bind(this)
                });
            }

            function saveError(alarm, response) {
                try {
                    r = JSON.parse(response.responseText);
                } catch (e) {
                    r = {'name': 'UnknownError', 'message': 'UnknownError: An unknown error occured.'};
                }
                this.error(r);
                this._modal.hide();
            }

            newAlarm.check_id = this.check.id;
            a = new Models.Alarm(newAlarm);
            a.set('entity_id', this.collection.entity.id);
            a.save({}, {success: saveSuccess.bind(this), error: saveError.bind(this)});
        }
    });

    var AlarmCriteriaView = Backbone.View.extend({

        initialize: function (opts) {

            this.criteria = $('<textarea>').addClass('span6');
            this.criteria.attr('rows', 20);
            this.$el.append(this.criteria);

        },

        render: function (edit) {
            this.criteria.empty();
            if (edit) {
                this.criteria.removeAttr('disabled');
            } else {
                this.criteria.attr('disabled', 'disabled');
            }
            this.criteria.text(this.model.get('criteria'));
            return this.$el;
        },

        getValues: function () {
            return this.$el.find('textarea').val();
        }
    });

    var AlarmTestView = Backbone.View.extend({

        initialize: function (opts) {
            this.$el.empty();

            this.check = opts.check;
            this.alarm = opts.alarm;

            // Controls
            this._controlsContainer = $('<div>');
            this._testButton = $('<button>').addClass('btn btn-primary').html('Test Alarm');
            this._testButton.click(this.doTest.bind(this));

            this._checkDataButton = $('<button>').addClass('btn btn-mini').html('populate check data');
            this._checkDataButton.click(this.populateCheckData.bind(this));

            this._controlsContainer.append(this._checkDataButton);

            this._resultsContainer = $('<div>').addClass('accordion');
            this._showDetailsLink = $('<button>').addClass('btn btn-mini').html('Show Details');

            this._resultsBody = $('<div>');

            this._alarmResultsContainer = $('<div>');

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

        populateCheckData: function () {

            function _success (collection) {
                this._resultsContainer.empty();
                this._resultsContainer.append(this._resultLabelOK);
                this._checkDataButton.removeAttr('disabled');

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

                // append alarm test button and container for the results
                this.$el.append(this._testButton, this._alarmResultsContainer);
            }

            function _error (collection, xhr) {
                this._resultsContainer.empty();
                this._testButton.removeAttr('disabled');

                var response = {type: 'Unknown Error', message: 'An Unknown Error Occured'};
                try {
                    response = JSON.parse(xhr.responseText);
                } catch (e) {}

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
            this._checkDataButton.attr('disabled', 'disabled');
            this._resultsContainer.append(Views.spinner());
            this.check.test.fetch({type: 'POST',
                                   success: _success.bind(this),
                                   error: _error.bind(this)});

        },

        doTest: function () {

            function _success (collection) {
                this._alarmResultsContainer.empty();
                this._testButton.removeAttr('disabled');

                var response = this.collection.toJSON()[0];

                var _label = $('<span>').addClass('label');
                if (response.state === 'OK') {
                    _label.addClass('label-success');
                } else if (response.state === 'CRITICAL') {
                    _label.addClass('label-important');
                } else if (response.state === 'WARNING') {
                    _label.addClass('label-warning');
                }
                _label.html('state: ' + response.state + ' status: ' + response.status);
                this._alarmResultsContainer.append(_label);
            }

            function _error (collection, xhr) {
                this._alarmResultsContainer.empty();
                this._testButton.removeAttr('disabled');

                var response = JSON.parse(xhr.responseText);
                var _label = $('<span>').addClass('label label-important');
                _label.html('ERROR - type: ' + response.type + ' messsage: ' + response.message);
                this._alarmResultsContainer.append(label);
            }

            this._alarmResultsContainer.empty();
            this._testButton.attr('disabled', 'disabled');

            var data = {};
            data.criteria = this.alarm.get('criteria');
            data.check_data = this.check.test.toJSON();
            this.collection.fetch({success: _success.bind(this),
                                   error: _error.bind(this),
                                   data: JSON.stringify(data),
                                   type: 'POST',
                                   processData: false,
                                   contentType: 'application/json'});

        }

    });

    var AlarmDetailsView = Views.DetailsView.extend({

        _makeBody: function() {
            var body = $('<div>');
            this._alarm = $('<dl>').addClass('dl-horizontal');
            body.append(this._alarm);

            this._alarmView = new Views.KeyValueView({
                el: this._alarm,
                model: this.model,
                editKeys: false,
                editableKeys: ['label'],
                ignoredKeys: ['metadata', 'criteria',
                              'notification_plan_id'],
                formatters: {created_at: function (val) {return (new Date(val));},
                             updated_at: function (val) {return (new Date(val));}}
            });

            body.append($('<h3>').append('notification_plan'));
            this._notifications = $('<dl>').addClass('dl-horizontal');
            body.append(this._notifications);

            this._notificationsView = new NotificationViews.NotificationPlanSelect({el: this._notifications, alarm: this.model, notificationPlanCollection: App.getInstance().account.notification_plans });

            body.append($('<h3>').append('criteria (optional)'));
            this._criteria = $('<div>');
            body.append(this._criteria);

            this._criteriaView = new AlarmCriteriaView({el: this._criteria, model: this.model});

            body.append($('<h3>').append('metadata'));
            this._metadata = $('<dl>').addClass('dl-horizontal');
            body.append(this._metadata);

            body.append($('<h3>').append('test'));
            this._test = $('<div>');
            body.append(this._test);

            this._metadataView = new Views.KeyValueView({
                el: this._metadata,
                modelKey: 'metadata',
                model: this.model,
                editKeys: true
            });

            this._testView = new AlarmTestView({el: this._test, collection: this.model.test, alarm: this.model, check: this.model.getCheck()});

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

            var new_alarm = this._alarmView.getValues();
            new_alarm.metadata = this._metadataView.getValues();
            new_alarm.notification_plan_id = this._notificationsView.getValues();
            new_alarm.criteria = this._criteriaView.getValues();

            this.model.save(new_alarm, {success: _success.bind(this), error: _error.bind(this)});
        },

        render: function () {

            this._alarmView.render(this.editState);
            this._metadataView.render(this.editState);
            this._notificationsView.render(this.editState);
            this._criteriaView.render(this.editState);

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

    var _getCheck = function (entity, check_id, callback) {

        function _fetchSuccess (collection) {
            var check = collection.get(check_id);

            if (!check) {
                callback(true, null);
            } else {
                callback(null, check);
            }
        }

        function _fetchError (collection) {
            callback(true, null);
        }

        var check = entity.checks.get(check_id);
        if (!check) {
            entity.checks.fetch({success: _fetchSuccess.bind(this), error: _fetchError.bind(this)});
        } else {
            callback(null, check);
        }

    };

    var renderAlarmDetails = function (eid, aid) {

        var entity = App.getInstance().account.entities.get(eid);
        if (!entity) {
            Backbone.history.navigate('entities', true);
            return;
        }

        function _fetchSuccess (collection) {
            var alarm = collection.get(aid);
            if (!alarm) {
                Backbone.history.navigate('entities/' + entity.id, true);
                return;
            }
                
            _getCheck(entity, alarm.get('check_id'), function (err, check) {
                if (err) {
                    window.location.hash = 'entities/' + entity.id;
                } else {
                    var alarmDetailsView = new AlarmDetailsView({el: $("#alarm-details-view-content"), model: alarm});
                    alarmDetailsView.render();
                    Views.renderView('alarm-details', [entity, check, alarm]);
                }
            });
        }

        function _fetchError (collection) {
            Backbone.history.navigate('entities', true);
        }

        entity.alarms.fetch({success: _fetchSuccess, error: _fetchError});
    };

    return {AlarmListView: AlarmListView,
            renderAlarmDetails: renderAlarmDetails};
});
