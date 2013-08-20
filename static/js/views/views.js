define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'jquerydebounce'
], function($, Backbone, _, App, Models) {

    var DETAIL_VIEW_STATE = {
        VIEW: 'VIEW',
        SAVE: 'SAVE',
        EDIT: 'EDIT'
    };

    /**
     * Generic Key Value Object View
     * @extends Backbone.View
     *
     * @param {object} opts Options Object
     * @param {Backbone.Model} opts.model Backbone model instance
     * @param {String} opts.modelKey render this.model.get(modelKey) instead
     * @param {Array[String]} opts.editableKeys list of keys that are editable
     * @param {Boolean} opts.editKeys Allow editing of keys AND values
     * @param {Object} opts.formatters Map of object attributes to functions
     */
    var KeyValueView = Backbone.View.extend({
        tagName: 'dl',
        className: 'dl-horizontal',
        keyValueTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><%= value %>&nbsp;</dd>"
        ),

        editKeyValueTemplate: _.template(
            "<dt><input class='key', type='text' name='<%= key %>', value='<%= key %>'></dt>" +
            "<dd><input class='value', type='text' name='<%= value %>', value='<%= value %>' /></dd>"
        ),

        editValueTemplate: _.template(
            "<dt><strong class='key'><%= key %></strong></dt>" +
            "<dd><input class='value', type='text' name='<%= value %>', value='<%= value %>' /></dd>"
        ),

        newKeyValueTemplate: _.template(
            "<dt><input class='key', type='text'></dt>" +
            "<dd><input class='value', type='text' /></dd>"
        ),

        initialize: function (opts) {
            this.$el.empty();

            // allow custom template
            this.keyValueTemplate = opts.keyValueTemplate || this.keyValueTemplate;

            this.json = opts.json || false;
            this.modelKey = this.modelKey || opts.modelKey;
            this.editableKeys = this.editableKeys || opts.editableKeys || [];
            this.editKeys = this.editKeys || opts.editKeys || false;
            this.ignoredKeys = this.ignoredKeys || opts.ignoredKeys || [];
            this.formatters = this.formatters || opts.formatters || {};
        },

        handleNew: function (e) {
            if (e) {
                $(e.target.parentElement.parentElement).off('click');
            }
            var newrow = $('<div>').append(this.newKeyValueTemplate()).on('click', function (e) {
                this.handleNew(e);
            }.bind(this));
            this.$el.append(newrow);
        },

        resetState: function() {
            this.render(false);
        },

        getValues: function () {
            var labels = $(this.el).find('.key');
            var values = $(this.el).find('input.value');

            var r = _.reduce(labels, function(memo, label, index, labels) {

                var l = label.value || label.innerText;
                var v = values[index] ? values[index].value : null;

                if (l && v) {
                    memo[l] = v;
                }
                return memo;
            }, {});

            return r;
        },

        getChanged: function() {
            var values = this.getValues();

            var changedKeys = _.reject(_.keys(values), function (key) {
                return (this.model.get(key) == values[key]);
            }.bind(this));

            return _.pick(values, changedKeys);
        },

        _format: function (value, key) {
            if (_.contains(_.keys(this.formatters), key)) {
                value = this.formatters[key](value);
            }
            if(!value) {
                value = '';
            }
            return value;
        },

        render: function (edit) {

            var m = this.json;
            if (!m) {
                m = this.modelKey ? this.model.get(this.modelKey) : this.model.toJSON();
            }

            this.$el.empty();
            _.each(m, function (value, key) {
                var row;

                // This should not be rendered.
                if (_.contains(this.ignoredKeys, key)) {
                    return;
                }

                if(edit) {

                    // We want to edit keys and values, but don't specify specific keys.
                    // (ip_addresses, metadata, etc)
                    if (this.editKeys && _.isEmpty(this.editableKeys)) {
                        row = this.editKeyValueTemplate({key:key, value:this._format(value, key)});
                    }
                    // We do not want to edit keys, just the values
                    // (label, agent_id, etc)
                    else if (_.contains(this.editableKeys, key)) {
                        row = this.editValueTemplate({key:key, value:this._format(value, key)});
                    }
                    // This is rendered, but uneditable
                    // (created_at, uri, etc)
                    else {
                        row = this.keyValueTemplate({key: key, value: this._format(value, key)});
                    }
                } else {
                    row = this.keyValueTemplate({key:key, value:this._format(value, key)});
                }
                this.$el.append(row);
            }.bind(this));

            if (edit && this.editKeys) {
                this.handleNew();
            }

            return this.$el;
        }
    });


    /**
     * Editable Heading View
     * @extends Backbone.View
     *
     * @param {object} opts Options Object
     * @param {Backbone.Model} opts.model Backbone model instance
     */
    var EditableHeadingView = Backbone.View.extend({
        tagName: 'h2',
        className: 'dl-horizontal',
        keyValueTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><%= value %>&nbsp;</dd>"
        ),

        editKeyValueTemplate: _.template(
            "<dt><input class='key', type='text' name='<%= key %>', value='<%= key %>'></dt>" +
            "<dd><input class='value', type='text' name='<%= value %>', value='<%= value %>' /></dd>"
        ),

        editValueTemplate: _.template(
            "<dt><strong class='key'><%= key %></strong></dt>" +
            "<dd><input class='value', type='text' name='<%= value %>', value='<%= value %>' /></dd>"
        ),

        newKeyValueTemplate: _.template(
            "<dt><input class='key', type='text'></dt>" +
            "<dd><input class='value', type='text' /></dd>"
        ),

        initialize: function (opts) {
            this.$el.empty();

            // allow custom template
            this.keyValueTemplate = opts.keyValueTemplate || this.keyValueTemplate;

            this.json = opts.json || false;
            this.modelKey = this.modelKey || opts.modelKey;
            this.editableKeys = this.editableKeys || opts.editableKeys || [];
            this.editKeys = this.editKeys || opts.editKeys || false;
            this.ignoredKeys = this.ignoredKeys || opts.ignoredKeys || [];
            this.formatters = this.formatters || opts.formatters || {};
        },

        handleNew: function (e) {
            if (e) {
                $(e.target.parentElement.parentElement).off('click');
            }
            var newrow = $('<div>').append(this.newKeyValueTemplate()).on('click', function (e) {
                this.handleNew(e);
            }.bind(this));
            this.$el.append(newrow);
        },

        resetState: function() {
            this.render(false);
        },

        getValues: function () {
            var labels = $(this.el).find('.key');
            var values = $(this.el).find('input.value');

            var r = _.reduce(labels, function(memo, label, index, labels) {

                var l = label.value || label.innerText;
                var v = values[index] ? values[index].value : null;

                if (l && v) {
                    memo[l] = v;
                }
                return memo;
            }, {});

            return r;
        },

        getChanged: function() {
            var values = this.getValues();

            var changedKeys = _.reject(_.keys(values), function (key) {
                return (this.model.get(key) == values[key]);
            }.bind(this));

            return _.pick(values, changedKeys);
        },

        _format: function (value, key) {
            if (_.contains(_.keys(this.formatters), key)) {
                value = this.formatters[key](value);
            }
            if(!value) {
                value = '';
            }
            return value;
        },

        render: function (edit) {

            var m = this.json;
            if (!m) {
                m = this.modelKey ? this.model.get(this.modelKey) : this.model.toJSON();
            }

            this.$el.empty();
            _.each(m, function (value, key) {
                var row;

                // This should not be rendered.
                if (_.contains(this.ignoredKeys, key)) {
                    return;
                }

                if(edit) {

                    // We want to edit keys and values, but don't specify specific keys.
                    // (ip_addresses, metadata, etc)
                    if (this.editKeys && _.isEmpty(this.editableKeys)) {
                        row = this.editKeyValueTemplate({key:key, value:this._format(value, key)});
                    }
                    // We do not want to edit keys, just the values
                    // (label, agent_id, etc)
                    else if (_.contains(this.editableKeys, key)) {
                        row = this.editValueTemplate({key:key, value:this._format(value, key)});
                    }
                    // This is rendered, but uneditable
                    // (created_at, uri, etc)
                    else {
                        row = this.keyValueTemplate({key: key, value: this._format(value, key)});
                    }
                } else {
                    row = this.keyValueTemplate({key:key, value:this._format(value, key)});
                }
                this.$el.append(row);
            }.bind(this));

            if (edit && this.editKeys) {
                this.handleNew();
            }

            return this.$el;
        }
    });

    /**
     * Generic List Element View
     * Suitable for use with ListView
     * @extends Backbone.View
     *
     * @param {object} opts Options Object
     * @param {Backbone.Model} opts.collection Backbone model instance
     */
    var ListElementView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template(""),
        events: {"click .details": "detailsHandler",
                 "click .delete": "_deleteHandler"},

        initialize: function () {
            this.$el.empty();
        },

        detailsHandler: function () {
            // Called when link to details page is clicked, navigate elsewhere
        },

         deleteHandler: function () {
            // Called when delete is confirmed, use this.model
         },

        _cancelHandler: function () {
            this._modal.hide();
        },

        _deleteHandler: function () {
            if (this._modal) {
                this._modal.remove();
            }
            this._modal = new Modal({onConfirm: this.deleteHandler.bind(this),
                                   onCancel: this._cancelHandler.bind(this),
                                   header: '<h4>Confirm Deletion of ' + this.model.get('label')+'</h4>',
                                   input: false});
            $('body').append(this._modal);
            this._modal.show();
         },

        render: function() {
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        }
    });

    /**
     * Generic List View
     * @extends Backbone.View
     *
     * @param {object} opts Options Object
     * @param {Backbone.Collection} opts.collection Backbone collection instance
     * @param {Bacbone.View} opts.elementView Backbone View class for rendering collection elements
     * @param {jQuery object} opts.el Parent Element Selector
     */
    var ListView = Backbone.View.extend({

        // Overloaded handler for the new item link.
        handleNew: function(label) { },

        initialize: function(opts) {

            this._initialize(opts);

            this.$el.empty();

            opts = opts || {};
            this.name = this.name || opts.name;
            this.plural = this.plural || opts.plural;
            this.elementView = this.elementView || opts.elementView;

            this._alerts = $('<div>');
            this._header = this._makeHeader();
            this._body = this._makeBody();

            $(this.el).append(this._alerts);
            $(this.el).append(this._header);
            $(this.el).append(this._body);

            // events
            this.collection.on('sync', this.render.bind(this));
            this.collection.on('change', this.render.bind(this));
            this.collection.on('add', this.render.bind(this));
            this.collection.on('remove', this.render.bind(this));
            this.collection.on('reset', this.render.bind(this));

            this.render();
        },

        _initialize: function (opts) {

        },

        _makeModal: function () {

            return new Modal({onConfirm: this.handleNew.bind(this),
                                         header: '<h4>Create New ' + this.name+'</h4>',
                                         label: 'Label',
                                         input: true});

        },

        _showModal: function () {
            if (this._modal) {
                this._modal.remove();
            }
            this._modal = this._makeModal();
            this.$el.append(this._modal);
            this._modal.show();
        },

        // Creates Top Row - <h1> and a link to create a new object
        _makeHeader: function () {
            var createNewLink = $('<button>')
                .append('Create ' + this.name)
                .addClass('clickable rs-btn rs-btn-primary')
                .tooltip({placement: 'right', title: 'create new'});
            createNewLink.on('click', this._showModal.bind(this));

            var header = $('<div>')
                .addClass('list-header')
                .append($('<h2>')
                   .addClass('rs-page-title')
                   .append(this.plural)
                )
                .append(createNewLink);
            return header;

        },

        error: function (e) {
            var error = $('<div>').addClass('alert alert-error');
            error.append($('<button>')
                            .addClass('close')
                            .attr('data-dismiss', 'alert')
                            .append('x'));
            error.append($('<strong>').append(e.name + ": " + e.message));
            error.append($('<p>').append(e.details));
            this._alerts.append(error);
        },

        // Creates List Body - <table>
        _makeBody: function () {
            var body = $('<div>');
            body.append($('<table>').addClass('table table-condensed monitoring-item-table'));

            return body;
        },

        _filteredCollection: function () {
            return this.collection;
        },

        render: function()
        {
            var c, table, headerRow;
            c = this._filteredCollection();

            table = $(this.el).find('table');
            table.empty();

            if (this.elementView.columnHeadings) {
                headerRow = $('<tr>');
                this.elementView.columnHeadings.forEach(function(heading) {
                    headerRow.append($('<th>').text(heading));
                });
                table.append(headerRow);
            }

            if (c.each) {
                c.each(function (m) { this.add(m); }.bind(this));
            } else {
                _.each(c, function (m) { this.add(m); }.bind(this));
            }
            return this;
        },

        add: function (m) {
            if (this.elementView) {
                var e = new this.elementView({
                    model: m
                });
                e.render();
                $(this.el).find('table').append(e.el);
            }
        }
    });


    /**
     * Generic Details View
     * @extends Backbone.View
     *
     * @param {object} opts Options Object
     * @param {Backbone.Collection} opts.collection Backbone collection instance
     * @param {Bacbone.View} opts.elementView Backbone View class for rendering collection elements
     * @param {jQuery object} opts.el Parent Element Selector
     */
    var DetailsView = Backbone.View.extend({

        /* Are we in the edit state? */
        viewState: DETAIL_VIEW_STATE.VIEW,

        initialize: function () {

            this.$el.empty();

            // div for inserting errors
            this._alerts = $('<div>');

            this._header = this._makeHeader();
            this._body = this._makeBody();

            $(this.el).append(this._alerts);
            $(this.el).append(this._header);
            $(this.el).append(this._body);
            this.model.on('change', this.render.bind(this));
        },

        _makeTitle: function() {
            if (this.viewState === DETAIL_VIEW_STATE.EDIT) {
                return $('<input class="value monitoring-item-title" type="text">').attr('value', this.getTitle());
            } else {
                return $('<h2 class="monitoring-item-title">').append(this.getTitle());
            }
        },

        _makeHeader: function () {
            this._editButton = $('<button class="rs-btn rs-btn-action"><span class="rs-cog" /> Edit</button>');

            this._editButton.on('click', $.throttle(250, this._handleEdit.bind(this)));

            this._saveButton = $('<button class="rs-btn rs-btn-primary">Save</button>').hide();
            this._saveButton.on('click', $.throttle(250, this._handleSave.bind(this)));

            this._cancelButton = $('<button class="rs-btn rs-btn-link">Cancel</button>').hide();
            this._cancelButton.on('click', $.throttle(250, this._handleCancel.bind(this)));

            this._titleBox = $('<div class="span-8">').append(this._makeTitle());

            return $('<div class="rs-row">')
                        .append(this._titleBox)
                        .append($('<div class="rs-btn-group pull-right">')
                                .append(this._editButton).append(this._saveButton).append(this._cancelButton))
                        .append('<div class="clearfix">')
                        .append('<hr/>');
        },

        _makeBody: function() {
            return $('<div>');
        },

        _refreshTitleBox: function() {
            this._titleBox.empty();
            this._titleBox.append(this._makeTitle());
        },

        getTitle: function () {
            return this.model.get('label');
        },

        inEditState: function() {
            return this.viewState === DETAIL_VIEW_STATE.EDIT;
        },

        setViewState: function(state) {
          this.viewState = state;
          this._titleBox.empty().append(this._makeTitle());
          if (this.viewState === DETAIL_VIEW_STATE.VIEW) {
              this._saveButton.hide();
              this._cancelButton.hide();
              this._editButton.show();
          } else if (this.viewState === DETAIL_VIEW_STATE.EDIT) {
              this._editButton.hide();
              this._saveButton.show().removeAttr('disabled').text('Save');
              this._cancelButton.show().removeAttr('disabled');
          } else {
              this._editButton.hide();
              this._saveButton.show().removeAttr('disabled').text('Saving...');
              this._cancelButton.show().removeAttr('disabled');
          }
          this.render();
        },

        getFormContents: function() {},

        _handleSave: function () {
            var _success = function (model) {
                this.setViewState(DETAIL_VIEW_STATE.VIEW);
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
                this.setViewState(DETAIL_VIEW_STATE.VIEW);
                this.model.fetch();
            };

            var update = this.getFormContents();
            update.label = this._titleBox.find('input').val();

            this.model.save(update, {success: _success.bind(this), error: _error.bind(this)});
            this.setViewState(DETAIL_VIEW_STATE.SAVING);
        },

        _handleCancel: function () {
            this.setViewState(DETAIL_VIEW_STATE.VIEW);
        },

        _handleEdit: function () {
            this.setViewState(DETAIL_VIEW_STATE.EDIT);
        },


        _displayMessage: function(message, type) {
            var alert = $('<div>').addClass('alert alert-' + type);
            alert.append($('<button>')
                            .addClass('close')
                            .attr('data-dismiss', 'alert')
                            .append('x'));
            alert.append($('<strong>').append(message.message));
            if (message.details) {
                alert.append($('<p>').append(message.details));
            }
            this._alerts.append(alert);
            setTimeout(function() {
              alert.slideUp('300');
            }, 3000);
        },

        displayError: function (message) {
            this._displayMessage(message, 'error');
        },

        displaySuccess: function(message) {
            this._displayMessage(message, 'success');
        },

        render: function () {}
    });


    /**
     * Generic Modal View
     * @extends Backbone.View
     *
     * @param {object} opts Options Object
     * @param {string or function} opts.header String or Function that returns header text
     * @param {string or function} opts.body String or Function that returns body text
     * @param {function} opts.onConfirm Function callback for modal 'confirm' button
     * @param {jQuery object} opts.el Parent Element Selector
     */
    var Modal = Backbone.View.extend({

        initialize: function (opts) {

            this._initialize(opts);

            this.$el.empty();

            // opts
            this.onConfirm = opts.onConfirm;
            this.onCancel = opts.onCancel;
            this.header = opts.header;
            this.input = opts.input;
            this.label = opts.label;
            this.body = opts.body;

            // main element
            $(this.el).addClass('modal hide fade');
            $(this.el).append(this._makeHeader())
                      .append(this._makeBody())
                      .append(this._makeFooter());

            if (_.isFunction(this.onCancel)) {
                $(this.el).on('hidden', this.onCancel.bind(this));
            }
        },

        _initialize: function (opts) {},

        _makeHeader: function () {

            var dismiss = $('<button>')
                                .addClass('close')
                                .attr('type', 'button')
                                .attr('data-dismiss', 'modal')
                                .attr('aria-hidden', 'true')
                                .html('x');
            var header = $('<div>')
                            .addClass('modal-header')
                            .append(dismiss)
                            .append(_.isFunction(this.header) ? this.header() : this.header || "");
            return header;

        },

        _onConfirm: function () {
            var val;
            var e = $(this.el).find('input');
            if (e.length > 0) {
                val = e[0].value;
            }
            if (_.isFunction(this.onConfirm)) {
                this.onConfirm(val);
            }
        },

        _makeFooter: function () {
            var dismissButton = $('<button>')
                                    .addClass('btn')
                                    .html('Cancel')
                                    .click(function (e) {this.hide();}.bind(this));
            var confirmButton = $('<button>')
                                    .addClass('btn btn-primary')
                                    .html('Confirm');

            var footer = $('<div>')
                            .addClass('modal-footer')
                            .append(dismissButton)
                            .append(confirmButton);

            if (_.isFunction(this.onConfirm)) {
                confirmButton.on('click', $.throttle(500, this._onConfirm.bind(this)));
            }
            return footer;
        },

        _makeBody: function () {
            var input, body;
            body = $('<div>').addClass('modal-body');
            if (this.body) {
                body.append(_.isFunction(this.body) ? this.body() : this.body || "");
            }
            if (this.input) {
                input = $('<input>').attr('type', 'text')
                            .attr('placeholder', _.isFunction(this.label) ? this.label() : this.label || "");
                body.append(input);
            }
            return body;
        },

        show: function () {
            $(this.el).modal('show');
        },

        hide: function () {
            $(this.el).modal('hide');
        }
    });

    /**
     * Generic Details View
     * @extends Backbone.View
     *
     * Key/Value object view/editor that can optionally take an instance of the abstract model to provide defaults
     */
    var FormDetailsView = Backbone.View.extend({

        booleanFields: [],
        listStringFields: [],

        viewTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><%= value %>&nbsp;</dd>"
        ),

        viewBooleanTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><input name='<%= key %>' type='checkbox' <%= value %> disabled='disabled'</dd>"
        ),

        editTextTemplate: _.template(
            "<dt><label><strong><%= key %></strong><%= optional %></label></dt>" +
            "<dd><input type='text' name='<%= key %>' value='<%= value %>' placeholder='<%= description %>' /></dd>"
        ),

        editBooleanTemplate: _.template(
            "<dt><strong><%= key %></strong></dt>" +
            "<dd><input name='<%= key %>' type='checkbox' <%= value %>></dd>"
        ),

        render: function (edit, type) {

            this.$el.empty();
            var t, v, val;

            _.each(type.get('fields'), function (field) {

                val = null;

                if (edit) {
                    t = this.editTextTemplate;
                    if (_.indexOf(this.booleanFields, field.name) > -1) {
                        t = this.editBooleanTemplate;
                    }
                } else {
                    t = this.viewTemplate;
                    if (_.indexOf(this.booleanFields, field.name) > -1) {
                        t = this.viewBooleanTemplate;
                    }
                }

                /* Need to display the actual value if we are editing a real check */
                if (this.model) {
                    if (_.indexOf(this.booleanFields, field.name) !== -1) {
                        val = this.model.get('details')[field.name] ? 'checked' : '';
                    } else {
                        val = this.model.get('details')[field.name];
                    }
                }

                if(_.indexOf(this.listStringFields, field.name) !== -1) {
                    val = val || [];
                    val = val.join(' ');
                }

                v = {key: field.name, value: val || '', description: field.description, optional: field.optional ? '(optional)' : ''};

                this.$el.append(t(v));

            }.bind(this));

            return this.$el;
        },

        getValue: function(el) {
            var key = el.name;
            if (el.type === 'checkbox') {
                return el.checked;
            } else if (el.value) {
                if(_.indexOf(this.listStringFields, key) !== -1)
                    return el.value.split(' ');
                else
                    return el.value;

            }
        },

        getValues: function () {
            var details = {};
            _.each(this.$el.find('input'), function (el) {
                var key = el.name;
                details[key] = this.getValue(el);
            }.bind(this));
            return details;
        }
    });

    var spinner = function () {
        return $('<img>').attr('src', '/images/loading_spinner.gif');
    };

    /* Hides/Shows Relevant Stuff depending on the view */
    var renderView = function (view, models) {

        /* Switch nav link */
        $('[id$=view-link]').removeClass('active');
        $('#' + view + '-view-link').addClass('active');
        /* Hide/Show relevant divs */
        $('[id$=view-content]').addClass('hide');
        $('#' + view + '-view-content').removeClass('hide');

        /* Hide/Show Breadcrumbs */
        var crumb;
        var bc = $('#breadcrumb');

        if (models) {
            bc.empty();
            _.each(models, function (model, index) {
                crumb = $('<li>');
                if (index === (models.length - 1)) {
                    crumb.html(model.get('label') + ' (' + model.id + ')');
                    crumb.addClass('active');
                } else {
                   crumb.append($('<a>').attr('href', model.getLink()).html(model.get('label') + ' (' + model.id + ')'));
                   crumb.append($('<span>').addClass('divider').html('/'));
                }
                bc.append(crumb);
            });
            bc.show();
        } else {
            bc.hide();
        }
    };

    var renderAccount = function () {
        renderView('account');
    };

    var renderLoading = function () {
        renderView('loading');
    };

    var renderError = function () {
        renderView('error');
    };

    return {Modal: Modal,
            ListView: ListView,
            ListElementView: ListElementView,
            KeyValueView: KeyValueView,
            DetailsView: DetailsView,
            FormDetailsView: FormDetailsView,

            spinner: spinner,
            renderView: renderView,
            'renderAccount': renderAccount,
            'renderLoading': renderLoading,
            'renderError': renderError,
            DETAIL_VIEW_STATE: DETAIL_VIEW_STATE
    };

});
