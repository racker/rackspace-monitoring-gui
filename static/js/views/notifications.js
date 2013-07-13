define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views',
  'jquerydebounce'
], function($, Backbone, _, App, Models, Views) {

    var NewNotificationModal = Views.Modal.extend({

        notificationTypeTemplate: _.template(
            "<option></option>" +
            "<% _.each(notification_types, function(type) { %>" +
                "<option><%= type.id %></option>" +
            "<% }); %>"
        ),

        _initialize: function (opts) {
            this.notificationTypesCollection = opts.notificationTypesCollection;

            this._notificationLabel = $('<input type="text" placeholder="Notification Label" />');

            /* selector for the different notification types */
            this._notificationTypes = $('<select>');
            this._notificationTypes.change(this._handleTypeSelection.bind(this));

            this._form = $('<div>');

            this.notificationTypesCollection.fetch({success: this._populateNotificationTypes.bind(this), error: function () {
                this._notificationForm.append('error fetching notification types');
            }});
        },

        _handleTypeSelection: function(event) {
            this._notificationType = this.notificationTypesCollection.get(event.target.value);

            /* construct subforms */
            this._form.empty();
            this._detailsView = new Views.FormDetailsView();
            this._form.append(this._detailsView.render(true, this._notificationType));
        },

        _populateNotificationTypes: function () {
            this._notificationTypes.empty();
            this._notificationTypes.html(this.notificationTypeTemplate({notification_types: this.notificationTypesCollection.toJSON()}));
        },

        _makeBody: function () {
            var body = $('<div>').addClass('modal-body');

            body.append('<label><strong>label</strong></label>');
            body.append(this._notificationLabel);
            body.append('<label><strong>notification_type</strong></label>');
            body.append(this._notificationTypes);
            body.append(this._form);

            return body;
        },

        _onConfirm: function () {

            var newNotification = {};
            newNotification.label = this._notificationLabel.val();
            newNotification.type = this._notificationType.id;
            newNotification.details = this._detailsView.getValues();
            this.onConfirm(newNotification);
        }
    });

    var NotificationPlanView = Views.ListElementView.extend({

        template: _.template("<td><a class='details clickable'><%= label %></a></td><td><%= id %></td><td><i class='icon-remove delete clickable'></i></td>"),

        detailsHandler: function () {
            Backbone.history.navigate('notification_plans/' + this.model.id, true);
        },

        deleteHandler: function () {
            this.model.destroy({wait: true});
            this._modal.hide();
        }
    });

    var NotificationView = Views.ListElementView.extend({

        template: _.template("<td><%= label %></td><td><%= id %></td><td><%= type %></td><td><%= details %></td><td><i class='icon-remove delete clickable'></i></td>"),

        deleteHandler: function () {
            this.model.destroy({wait: true});
            this._modal.hide();
        },

        render: function() {
            var n = {};
            n.label = this.model.get('label');
            n.id = this.model.id;
            n.type = this.model.get('type');
            n.details = _.values(this.model.get('details')).join(' ');
            $(this.el).html(this.template(n));
            return this;
        }
    });

    var NotificationPlanListView = Views.ListView.extend({

        name: 'Notification Plan',
        plural: 'Notification Plans',
        elementView: NotificationPlanView,

        handleNew: function (label) {

            function saveSuccess(plan) {
                plan.fetch({
                    success: function(np) {
                        this._modal.hide();
                        Backbone.history.navigate('notification_plans/' + np.id, true);
                    }.bind(this), error: function(e, xhr) {
                        this._modal.hide();
                    }.bind(this)
                });
            }

            function saveError(plan, response) {
                try {
                    r = JSON.parse(response.responseText);
                } catch (e) {
                    r = {'name': 'UnknownError', 'message': 'UnknownError: An unknown error occured.'};
                }
                this.error(r);
                this._modal.hide();
            }

            this.collection.create({label: label}, {success: saveSuccess.bind(this), error: saveError.bind(this), wait:true});
        }

    });

    var NotificationListView = Views.ListView.extend({

        name: 'Notification',
        plural: 'Notifications',
        elementView: NotificationView,

        handleNew: function (newNotification) {

            function saveError (model, response) {
                try {
                    r = JSON.parse(response.responseText);
                } catch (e) {
                    r = {'name': 'UnknownError', 'message': 'UnknownError: An unknown error occured.'};
                }
                this.error(r);
                this._modal.hide();
            }

            this.collection.create(newNotification, {success: function () { this._modal.hide(); }.bind(this),
                                                     error: saveError.bind(this),
                                                     wait: true});
        },

        _makeModal: function () {
            var modal = new NewNotificationModal({notificationTypesCollection: App.getInstance().account.notification_types,
                                                  onConfirm: this.handleNew.bind(this),
                                                  header: '<h4>Create New ' + this.name+'</h4>'});
            return modal;
        }

    });

    var NotificationSelectView = Backbone.View.extend({

        template: _.template("<tr><td><%= label %></td><td><%= id %></td><td><%= type %></td><td><%= details %></td></td></tr>"),
        edit_template: _.template("<tr><td><%= label %></td><td><%= id %></td><td><%= type %></td><td><%= details %></td><td><a class='clickable remove' id='<%= id %>'>remove</a></td></tr>"),
        select_template: _.template(
            "<option></option>" +
            "<% _.each(notifications, function(notification) { %>" +
                "<option value='<%= notification.id %>'><%= notification.label %> (<%= notification.id %>) <%= notification.type %>:<% print(_.values(notification.details).join(' ')); %></option>" +
            "<% }); %>"
        ),

        initialize: function (opts) {

            this._notifications = opts.filter(); // keeps track of currently 'selected' notification ids

            this._header = $('<div>')
                .addClass('row list-header')
                .append($('<h2>')
                    .addClass('pull-left')
                    .append(this.plural)
                );

            /* dropdown for adding notification plans */
            this._newNotificationDropdown = $('<span>');
            this._newNotificationDropdown.hide();
            this._newNotificationDropdown.append('<strong>add notification</strong> ');
            this._newNotification = $('<select>');
            this._newNotificationDropdown.append(this._newNotification);
            this._newNotification.append(this.select_template({notifications: App.getInstance().account.notifications.toJSON()}));
            this._newNotification.change(function (event) {
                this.add(event.target.value);
            }.bind(this));

            this._body = $('<table>').addClass('table table-striped table-hover');

            this.$el.append(this._header);
            this.$el.append(this._newNotificationDropdown);
            this.$el.append(this._body);
        },

        add: function (notificationId) {

            if (_.contains(this._notifications, App.getInstance().account.notifications.get(notificationId))) {
                return;
            }

            n = App.getInstance().account.notifications.get(notificationId);
            if (n) {
                this._notifications.push(n);
                this.render(true);
            }
        },

        remove: function (event) {
            this._notifications = _.without(this._notifications, App.getInstance().account.notifications.get(event.target.id));
            this.render(true);
        },

        render: function (edit) {

            this._body.empty();
            var template = edit ? this.edit_template : this.template;

            if (edit) {
                this._newNotificationDropdown.show();
            } else {
                this._newNotificationDropdown.hide();
            }

            _.each(this._notifications, function (notification) {
                var n = notification.toJSON();
                n.details = _.values(n.details).join(' ');

                var e = template(n);
                this._body.append(template(n));
            }.bind(this));

            if (edit) {
                this._body.find('.remove').on('click', this.remove.bind(this));
            }
        },

        getValues: function () {
            return _.map(this._notifications, function (n) {
                return n.id;
            });
        }
    });

    var NotificationPlanDetailsView = Views.DetailsView.extend({

        _makeBody: function() {
            var body = $('<div>');
            this._notificationPlan = $('<dl>').addClass('dl-horizontal');
            body.append(this._notificationPlan);

            this._notificationPlanView = new Views.KeyValueView({
                el: this._notificationPlan,
                model: this.model,
                editKeys: false,
                editableKeys: ['label'],
                ignoredKeys: ['critical_state', 'ok_state', 'warning_state'],
                formatters: {created_at: function (val) {return (new Date(val));},
                             updated_at: function (val) {return (new Date(val));}}
            });

            body.append($('<h3>').append('ok_state'));
            this._okState = $('<div>').addClass('row').addClass('span12');
            body.append(this._okState);
            this._okStateView = new NotificationSelectView({el: this._okState, filter: this.model.getOk.bind(this.model)});

            body.append($('<h3>').append('warning_state'));
            this._warningState = $('<div>').addClass('row').addClass('span12');
            body.append(this._warningState);
            this._warningStateView = new NotificationSelectView({el: this._warningState, filter: this.model.getWarning.bind(this.model)});

            body.append($('<h3>').append('critical_state'));
            this._criticalState = $('<div>').addClass('row').addClass('span12');
            body.append(this._criticalState);
            this._criticalStateView = new NotificationSelectView({el: this._criticalState, filter: this.model.getCritical.bind(this.model)});


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

            var p = this._notificationPlanView.getValues();
            p.ok_state = this._okStateView.getValues();
            p.warning_state = this._warningStateView.getValues();
            p.critical_state = this._criticalStateView.getValues();

            this.model.save(p, {success: _success.bind(this), error: _error.bind(this)});

        },

        render: function () {

            this._notificationPlanView.render(this.editState);
            this._okStateView.render(this.editState);
            this._warningStateView.render(this.editState);
            this._criticalStateView.render(this.editState);


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

    var NotificationPlanSelect = Backbone.View.extend({

        viewTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><%= value %>&nbsp;</dd>"
        ),

        editTemplate: _.template(
            "<select>" +
                "<% _.each(notification_plans, function(np) { %>" +
                    "<option value='<%= np.id %>'><%= np.label %> (<%= np.id %>)</option>" +
                "<% }); %>" +
            "</select>"
        ),


        initialize: function(opts) {

            this.alarm = opts.alarm;
            this.notificationPlanCollection = opts.notificationPlanCollection;

            this._display = $('<dl>').addClass('dl-horizontal');

            this._edit = $('<dl>').addClass('dl-horizontal');
            this._edit.append("<dt><strong>notification_plan</strong></dt>");
            this._edit.hide();
            this._planSelect = $('<select>');

            this._edit.append($('<dd>').append(this._planSelect));

            this.$el.append(this._display, this._edit);

            this.notificationPlanCollection.fetch({success: this._populate.bind(this), error: function () {this.$el.html('error fetching notification plans');}});

            if (this.alarm) {
                this.alarm.on('change', this._populate.bind(this));
            }
        },

        _populate: function () {

            this._planSelect.html(this.editTemplate({notification_plans: this.notificationPlanCollection.toJSON()}));
            if (this.alarm) {
                /* we have to pre-set the target selector with existing values */
                this._planSelect.find('option[value=' + this.alarm.get('notification_plan_id') +']').attr('selected', 'selected');

                var val;
                var p = this.notificationPlanCollection.get(this.alarm.get('notification_plan_id'));
                if (p) {
                    val = p.get('label') + ' (' + p.id + ')';
                } else {
                    val = this.alarm.get('notification_plan_id');
                }
                this._display.empty();
                this._display.append(this.viewTemplate({key: 'notification_plan', value: val}));
            }
        },

        render: function (edit) {

            if (edit) {
                this._display.hide();
                this._edit.show();
            } else {
                this._display.show();
                this._edit.hide();
            }

            return this.$el;
        },

        getValues: function () {
            return this._planSelect.val();
        }

    });

    var renderNotificationsList = function () {
        var notifications = $('<div>');
        var notificationPlans = $('<div>');
        $('#notifications-list-view-content').empty();
        $('#notifications-list-view-content').append(notifications, notificationPlans);

        function _fetchNotificationsSuccess(collection) {
            var notificationView = new NotificationListView({el: $(notifications), collection: collection});
            notificationView.render();
        }

        function _fetchNotificationPlansSuccess(collection) {
            var notificationPlanView = new NotificationPlanListView({el: $(notificationPlans), collection: collection});
            notificationPlanView.render();
        }

        function _fetchNotificationsError() {
            notifications.append('failed fetching notifications');
        }

        function _fetchNotificationPlansError() {
            notificationPlans.append('failed fetching notification plans');
        }

        App.getInstance().account.notifications.fetch({success: _fetchNotificationsSuccess, error: _fetchNotificationsError});
        App.getInstance().account.notification_plans.fetch({success: _fetchNotificationPlansSuccess, error: _fetchNotificationPlansError});

        Views.renderView('notifications-list');

    };

    /* TODO: async */
    var renderNotificationPlanDetails = function (pid) {

        function _fetchError (collection) {
            Backbone.history.navigate('notifications', true);
        }

        function _fetchSuccess (collection) {
            var plan = collection.get(pid);
            if (!plan) {
                Backbone.history.navigate('notifications', true);
                return;
            }

            App.getInstance().account.notifications.fetch({
                success: function() {
                    var notificationPlanDetailsView = new NotificationPlanDetailsView({el: $("#notification-plan-details-view-content"), model: plan});
                    Views.renderView('notification-plan-details');
                    notificationPlanDetailsView.render();
                },
                error: _fetchError
            });
        }

        App.getInstance().account.notification_plans.fetch({success: _fetchSuccess, error: _fetchError});
    };

    return {NotificationPlanSelect: NotificationPlanSelect, renderNotificationsList: renderNotificationsList, renderNotificationPlanDetails: renderNotificationPlanDetails};
});
