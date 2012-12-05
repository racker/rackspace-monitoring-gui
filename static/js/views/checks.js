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
            var modal = new NewCheckModal({collection: App.getInstance().account.check_types,
                                           onConfirm: this.handleNew.bind(this),
                                           header: '<h4>Create New ' + this.name+'</h4>'});
            return modal;

        }

    });

    var MagicFormView = Backbone.View.extend({

        selectTypeTemplate: _.template(
            "<option></option>" +
            "<% _.each(check_types, function(type) { %>" +
                "<option><%= type.id %></option>" +
            "<% }); %>"
        ),

        editTextTemplate: _.template(
            "<label class='key'><%= key %></strong></label>" +
            "<input class='value', type='text' name='<%= value %>', placeholder='<%= value %>' />"
        ),

        editBooleanTemplate: _.template(
            "<dt><strong class='key'><%= key %></strong></dt>" +
            "<dd><input class='value', type='text' name='<%= value %>', value='<%= value %>'></dd>"
        ),

        initialize: function(opts) {
            this._select = $('<select>');
            this.$el.append(this._select);

            this._form = $('<div>');
            this.$el.append(this._form);

            this.collection.fetch({success: this.render.bind(this), error: function() {
                    this.$el.append("We broke!");
                }
            });

            this._select.change(this._handleTypeSelection.bind(this));

        },

        _makeForm: function(type) {
            var form = $('<form>');
            _.each(type.get('fields'), function (field) {
                form.append(this.editTextTemplate({key: field.name, value: field.description}));
            }.bind(this));

            return form;
        },

        _handleTypeSelection: function(event) {
            var checkType = this.collection.get(event.target.value);
            this._form.empty();
            this._form.append(this._makeForm(checkType));
        },

        render: function() {
            this._select.empty();
            this._select.html(this.selectTypeTemplate({check_types: this.collection.toJSON()}));
            return this.$el;
        }
    });

    var NewCheckModal = Views.Modal.extend({
        _makeBody: function () {
            var body, magicFormView;
            body = $('<div>').addClass('modal-body');

            magicFormView = new MagicFormView({collection: this.collection});

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