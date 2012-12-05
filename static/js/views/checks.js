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