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
            window.location.hash = 'entities/' + this.model.get('entity_id') + '/checks/' + this.model.id;
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

    var renderAlarmDetails = function (eid, aid) {
        Views.renderView('alarm-details');
    };

    return {AlarmListView: AlarmListView,
            renderAlarmDetails: renderAlarmDetails};
});