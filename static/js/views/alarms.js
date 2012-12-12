define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views',
  'jquerydebounce'
], function($, Backbone, _, App, Models, Views) {

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

    var AlarmListView = Views.ListView.extend({

        name: 'alarm',
        plural: 'alarms',
        elementView: AlarmView,

        _initialize: function (opts) {
            this.check = opts.check;
        },

        _filteredCollection: function () {
            return this.collection.filterByCheck(this.check);
        }


    });

    var AlarmDetailsView = Views.DetailsView.extend({

        _makeBody: function() {
            var body = $('<div>');
            this._alarm = $('<dl>').addClass('dl-horizontal');
            body.append(this._check);

            body.append($('<h3>').append('notification_plan'));
            this._notifications = $('<dl>').addClass('dl-horizontal');
            body.append(this._notifications);

            body.append($('<h3>').append('metadata'));
            this._metadata = $('<dl>').addClass('dl-horizontal');
            body.append(this._metadata);

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

            return body;
        },

        handleSave: function () { },

        render: function () {

            this._alarmView.render(this.editState);

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
            Views.renderView('alarm-details', [entity, alarm]);
            alarmDetailsView.render();
        }

        function _fetchError (collection) {
            window.location.hash = 'entities';
        }

        entity.alarms.fetch({success: _fetchSuccess, error: _fetchError});
    };

    return {AlarmListView: AlarmListView,
            renderAlarmDetails: renderAlarmDetails};
});