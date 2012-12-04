define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'jquerydebounce'
], function($, Backbone, _, App, Models) {

    var checkDetailsView, alarmDetailsView;

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

        detailsHandler: function () {
            // Called when link to details page is clicked, navigate elsewhere
        },

         deleteHandler: function () {
            // Called when delete is confirmed, use this.model
         },

        _cancelHandler: function () {
            this._modal.remove();
        },

        _deleteHandler: function () {
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

            opts = opts || {};
            this.name = this.name || opts.name;
            this.plural = this.plural || opts.plural;
            this.elementView = this.elementView || opts.elementView;

            this._errors = $('<div>');
            this._modal = this._makeModal();
            this._header = this._makeHeader();
            this._body = this._makeBody();

            $(this.el).append(this._errors);
            $(this.el).append(this._modal);
            $(this.el).append(this._header);
            $(this.el).append(this._body);

            // events
            this.collection.on('change', this.render.bind(this));
            this.collection.on('add', this.render.bind(this));
            this.collection.on('remove', this.render.bind(this));

        },

        _makeModal: function () {
            var modal = new Modal({onConfirm: this.handleNew.bind(this),
                                         header: '<h4>Create New ' + this.name+'</h4>',
                                         label: 'Label',
                                         input: true});
            return modal;

        },

        // Creates Top Row - <h2> and a link to create a new object
        _makeHeader: function () {
            var createNewLink = $('<i>')
                .addClass('icon-plus clickable')
                .tooltip({placement: 'right', title: 'create new'});
            createNewLink.on('click', this._modal.show.bind(this._modal));

            var header = $('<div>')
                .addClass('row list-header')
                .append($('<h2>')
                    .addClass('pull-left')
                    .append(this.plural)
                    .append(createNewLink)
                );
            return header;

        },

        error: function (message) {
            var error = $('<div>').addClass('alert alert-error');
            error.append($('<button>')
                            .addClass('close')
                            .attr('data-dismiss', 'alert')
                            .append('x'));
            error.append($('<strong>').append('Error '));
            error.append(message);
            this._errors.append(error);
        },

        // Creates List Body - <table>
        _makeBody: function () {
            var body = $('<div>').addClass('row');
            body.append($('<table>').addClass('table table-striped table-hover'));
            return body;
        },

        render: function()
        {
            $(this.el).find('table').empty();
            this.collection.each(function (m) {
                this.add(m);
            }.bind(this));
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
                                    .attr('data-dismiss', 'modal')
                                    .attr('type', 'button')
                                    .addClass('close')
                                    .html('Cancel');
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

    /* Hides/Shows Relevant Stuff depending on the view */
    var _renderView = function (view) {
        /* Switch nav link */
        $('[id$=view-link]').removeClass('active');
        $('#' + view + '-view-link').addClass('active');
        /* Hide/Show relevant divs */
        $('[id$=view-content]').addClass('hide');
        $('#' + view + '-view-content').removeClass('hide');
    };

    var AlarmView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template(
            "<tr><td><a href='#entities/<%= entity_id %>/alarms/<%= id %>'> <%= id %> </a> </td></tr>"
        ),

        events: {},

        render: function () {
            $(this.el).html(this.template(this.model.toJSON()));
        }

    });

    var AlarmListView = Backbone.View.extend({
        el: $('#check-alarms-list'),
        events: {},
    
        initialize: function()
        {
            this._cache = {};
        },
    
        render: function()
        {
            $(this.el).empty();
            return this;
        },

        add: function(m)
        {
            var e = new AlarmView({
                model: m
            });
            this._cache[m.get('id')] = e;
            e.render();
            $(this.el).append(e.el);
        }
    });

    var AlarmDetailsView = Backbone.View.extend({
        el: $('#alarm-details'),
        tagName: 'div',
        template: _.template(
            "<tr><td><strong>id</strong></td><td><%= id %></td></tr>" +
            "<tr><td><strong>label</strong></td><td><%= label %></td></tr>" +
            "<tr><td><strong>criteria</strong></td><td><%= criteria %></td></tr>"
        ),

        render: function () {
            // render entity details
            $(this.el).html(this.template(this.model.toJSON()));
            _renderView('alarm-details');

        }
    });

    var CheckDetailsView = Backbone.View.extend({
        el: $('#check-details'),
        tagName: 'div',
        template: _.template(
            "<tr><td><strong>id</strong></td><td><%= id %></td></tr>" +
            "<tr><td><strong>label</strong></td><td><%= label %></td></tr>"
        ),

        renderAlarmListSuccess: function (alarms, response) {
            var alv = new AlarmListView();
            alv.render();
            _.each(alarms.filterByCheck(this.model), function (alarm) {
                alv.add(alarm);
            });
        },

        renderAlarmListFail: function () {
            var cl = $("#check-alarms-list");
            cl.html("<tr><td>Failed Loading Alarms</td></tr>");
        },

        render: function () {
            // render entity details
            $(this.el).html(this.template(this.model.toJSON()));
            _renderView('check-details');

            // render check list
            var cl = $("#check-alarms-list");
            cl.html("<tr><td>LOADING ALARMS</td></tr>");
            this.model.getEntity().alarms.fetch({"success": this.renderAlarmListSuccess.bind(this), "error": this.renderAlarmListFail});
        }
    });

    var CheckView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template("<td><a href='#/entities/<%= entity_id %>/checks/<%= id %>'><%= label %></a></td><td><%= id %></td>"),

        events: {},

        render: function () {
            $(this.el).html(this.template(this.model.toJSON()));
        }
    });

    var CheckListView = Backbone.View.extend({
        el: $('#entity-checks-list'),
        events: {},
    
        initialize: function()
        {
            this._cache = {};
        },
    
        render: function()
        {
            $(this.el).empty();
            return this;
        },

        add: function(m)
        {
            var e = new CheckView({
                model: m
            });
            this._cache[m.get('id')] = e;
            e.render();
            $(this.el).append(e.el);
        }
    });

    /* ROUTE HANDLERS */
    var renderCheckDetails = function (id, cid) {

        var success = function (collection, response) {
            var check = collection.get(cid);
            if (!check) {
                window.location.hash = 'entities/' + id;
            }

            checkDetailsView = new CheckDetailsView({"model": check});
            checkDetailsView.render();
        };

        var error = function (collection, response) {
            window.location.hash = 'entities';

        };
        var entity = App.getInstance().account.entities.get(id);
        if (!entity) {
            window.location.hash = 'entities';
            return;
        }

        entity.checks.fetch({"success": success, "error": error});
    };

    var renderAlarmDetails = function (id, aid) {

        var success = function (collection, response) {
            var alarm = collection.get(aid);
            if (!alarm) {
                window.location.hash = 'entities/' + id;
            }

            alarmDetailsView = new AlarmDetailsView({"model": alarm});
            alarmDetailsView.render();
        };

        var error = function (collection, response) {
            window.location.hash = 'entities';

        };

        var entity = App.getInstance().account.entities.get(id);
        if (!entity) {
            window.location.hash = 'entities';
            return;
        }

        entity.alarms.fetch({"success": success, "error": error});
    };

    var renderAccount = function () {
        _renderView('account');
    };

    var renderLoading = function () {
        _renderView('loading');
    };

    var renderError = function () {
        _renderView('error');
    };

    return {Modal: Modal, ListView: ListView, ListElementView: ListElementView,
            'renderCheckDetails': renderCheckDetails,
            'renderAlarmDetails': renderAlarmDetails,
            'renderAccount': renderAccount,
            'renderLoading': renderLoading,
            'renderError': renderError,
            'renderView': _renderView};

});
