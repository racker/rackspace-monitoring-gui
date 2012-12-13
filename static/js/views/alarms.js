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
            window.location.hash = 'entities/' + this.model.get('entity_id') + '/alarms/' + this.model.id;
        },

        deleteHandler: function () {
            this.model.destroy({wait: true});
            this._modal.hide();
        }
    });

    var NewAlarmModal = Views.Modal.extend({

        _initialize: function (opts) {
            this.notificationPlanCollection = opts.notificationPlanCollection;
        },

        _makeBody: function () {
            var body = $('<div>').addClass('modal-body');

            this._label = $('<dl>').addClass('dl-horizontal');
            this._alarmLabel = $('<input type="text" placeholder="Alarm Label" />');
            this._label.append('<dt><strong>notification_plan</strong></dt>');
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

        name: 'alarm',
        plural: 'alarms',
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
                        window.location.hash = 'entities/' + a.get('entity_id') + '/alarms/' + a.id;
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

            this._metadataView = new Views.KeyValueView({
                el: this._metadata,
                modelKey: 'metadata',
                model: this.model,
                editKeys: true
            });

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

    var renderAlarmDetails = function (eid, aid) {

        var entity = App.getInstance().account.entities.get(eid);
        if (!entity) {
            window.location.hash = 'entities';
            return;
        }

        function _fetchSuccess (collection) {
            var alarm = collection.get(aid);
            if (!alarm) {
                window.location.hash = 'entities/' + entity.id;
                return;
            }
                
            var alarmDetailsView = new AlarmDetailsView({el: $("#alarm-details-view-content"), model: alarm});
            alarmDetailsView.render();
            Views.renderView('alarm-details', [entity, alarm]);


            var check = entity.checks.get(alarm.get('check_id'));
            if (check) {
                Views.renderView('alarm-details', [entity, check, alarm]);
            }

        }

        function _fetchError (collection) {
            window.location.hash = 'entities';
        }

        entity.alarms.fetch({success: _fetchSuccess, error: _fetchError});
    };

    return {AlarmListView: AlarmListView,
            renderAlarmDetails: renderAlarmDetails};
});