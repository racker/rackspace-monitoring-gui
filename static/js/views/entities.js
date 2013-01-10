define([
  'jquery',
  'backbone',
  'underscore',
  'app',
  'models/models',
  'views/views',
  'views/checks',
  'jquerydebounce'
], function($, Backbone, _, App, Models, Views, CheckViews) {

    var EntityDetailsView = Views.DetailsView.extend({

        _makeBody: function() {
            var body = $('<div>');
            body.append($('<h3>').append('details'));
            this._details = $('<dl>').addClass('dl-horizontal');
            body.append(this._details);

            body.append($('<h3>').append('host info'));
            this._hostinfo = $('<div>');
            body.append(this._hostinfo);

            body.append($('<h3>').append('ip_addresses'));
            this._ipAddresses = $('<dl>').addClass('dl-horizontal');
            body.append(this._ipAddresses);

            body.append($('<h3>').append('metadata'));
            this._metadata = $('<dl>').addClass('dl-horizontal');
            body.append(this._metadata);

            this._checks = $('<div>');
            body.append(this._checks);


            this._hostinfoView = new HostInfoView({
                el: this._hostinfo,
                model: this.model.getHostInfo()
            });
            this._detailsView = new Views.KeyValueView({
                el: this._details,
                model: this.model,
                editKeys: false,
                editableKeys: ['label', 'agent_id'],
                ignoredKeys: ['ip_addresses', 'metadata', 'checks'],
                formatters: {created_at: function (val) {return (new Date(val));},
                             updated_at: function (val) {return (new Date(val));}}
            });

            this._ipAddressesView = new Views.KeyValueView({
                el: this._ipAddresses,
                modelKey: 'ip_addresses',
                model: this.model,
                editKeys: true
            });

            this._metadataView = new Views.KeyValueView({
                el: this._metadata,
                modelKey: 'metadata',
                model: this.model,
                editKeys: true
            });

            this._checksView = new CheckViews.CheckListView({el: this._checks, collection: this.model.checks});

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

            var newEntity = this._detailsView.getChanged();

            newEntity.ip_addresses = this._ipAddressesView.getValues();
            newEntity.metadata = this._metadataView.getValues();

            this.model.save(newEntity, {success: _success.bind(this), error: _error.bind(this)});
        },

        render: function () {

            this._detailsView.render(this.editState);

            clearInterval(App._hostinfo_interval);
            this._hostinfoView.render();
            App._hostinfo_interval = setInterval(this._hostinfoView.render.bind(this._hostinfoView), 5000);

            this._ipAddressesView.render(this.editState);
            this._metadataView.render(this.editState);

            this.model.checks.fetch();

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

    var EntityView = Views.ListElementView.extend({

        template: _.template("<td><a class='details clickable'><%= label %></a></td><td><%= id %></td><td><i class='icon-remove delete clickable'></i></td>"),

        detailsHandler: function () {
            Backbone.history.navigate('entities/' + this.model.id, true);
        },

        deleteHandler: function () {

            /* TODO: display errors */
            this.model.destroy({wait: true});
            this._modal.hide();
        }
    });

    var EntityListView = Views.ListView.extend({

        name: 'entity',
        plural: 'entities',
        elementView: EntityView,

        handleNew: function (label) {

            function saveSuccess(entity) {
                entity.fetch({
                    success: function(e) {
                        this._modal.hide();
                        App.getInstance().account.entities.add(e);
                        Backbone.history.navigate('entities/' + e.id, true);
                    }.bind(this), error: function(e) {
                        this.error('Error fetching ' + this.name);
                        this._modal.hide();
                    }.bind(this)
                });
            }

            function saveError(entity, response) {
                try {
                    r = JSON.parse(response.responseText);
                } catch (e) {
                    r = {'name': 'UnknownError', 'message': 'UnknownError: An unknown error occured.'};
                }
                this.error(r);
                this._modal.hide();
            }
            e = new Models.Entity({label: label});
            e.save({}, {success: saveSuccess.bind(this), error: saveError.bind(this)});
        }

    });

    var HostInfoView = Backbone.View.extend({
        initialize: function() {
            this.$el.empty();

            this._list = $('<dl>').addClass('hostinfo dl-horizontal');
            this.$el.append(this._list);

            this._ram_bar = $('<div>').addClass('progress');
            this._ram_text = $('<span>');
            this._list.append(
                    $('<dt>').append('Memory'),
                    $('<dd>').append(this._ram_bar, this._ram_text));

            this._disk_bar = $('<div>').addClass('progress');
            this._disk_text = $('<span>');
            this._list.append(
                    $('<dt>').append('Disk'),
                    $('<dd>').append(this._disk_bar, this._disk_text));

            this._cpu_bar = $('<div>').addClass('progress');
            this._cpu_text = $('<span>');
            this._list.append(
                    $('<dt>').append('CPU'),
                    $('<dd>').append(this._cpu_bar, this._cpu_text));
        },
        render: function() {
            function draw_success() {
                this._ram_bar.empty();
                this._disk_bar.empty();
                this._cpu_bar.empty();

                this._ram_text.empty();
                this._disk_text.empty();
                this._cpu_text.empty();

                this._ram_bar.append($('<div>').addClass('bar').attr('style', 'width: ' + this.model.getRamPercent() + '%'));
                this._disk_bar.append($('<div>').addClass('bar').attr('style', 'width: ' + this.model.getDiskPercent() + '%'));
                this._cpu_bar.append($('<div>').addClass('bar').attr('style', 'width: ' + this.model.getCpuPercent() + '%'));

                this._ram_text.append(this.humanizeBytes(this.model.getRamUsed()) + ' of ' + this.humanizeBytes(this.model.getRamTotal()));
                this._disk_text.append(this.humanizeBytes(this.model.getDiskUsed()) + ' of ' + this.humanizeBytes(this.model.getDiskTotal()));
                var cpu_percent = Math.floor(this.model.getCpuPercent()*100)/100;
                if( isNaN(cpu_percent)) {
                    this._cpu_text.append("(pending)");
                } else {
                    this._cpu_text.append( cpu_percent + '%');
                }
            }

            function draw_failure() {
                this._ram_bar.empty();
                this._disk_bar.empty();
                this._cpu_bar.empty();

                this._ram_text.empty();
                this._disk_text.empty();
                this._cpu_text.empty();

                this._ram_text.append("(agent not connected)");
                this._disk_text.append("(agent not connected)");
                this._cpu_text.append("(agent not connected)");
            }

            this.model.fetch({
                success: draw_success.bind(this),
                error: draw_failure.bind(this)
            });
        },
        humanizeBytes: function(bytes) {
            //From http://stackoverflow.com/questions/4498866/actual-numbers-to-the-human-readable-values
            var s = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'];
            var e = Math.floor(Math.log(bytes) / Math.log(1024));
            return (bytes / Math.pow(1024, Math.floor(e))).toFixed(2) + " " + s[e];
        }
    });

    var renderEntityDetails = function (id) {

        var model = App.getInstance().account.entities.get(id);
        if (!model) {
            Backbone.history.navigate('entities', true);
            return;
        }

        Views.renderView('entity-details', [model]);

        var entityDetailsView = new EntityDetailsView({el: $("#entity-details-view-content"), model: model});
        entityDetailsView.render();
    };

    var renderEntitiesList = function () {
        Views.renderView('entities');

        var entitiesView = new EntityListView({el: $("#entities-view-content"), collection: App.getInstance().account.entities});
        entitiesView.render();
    };

    return {'renderEntityDetails': renderEntityDetails,
            'renderEntitiesList': renderEntitiesList};

});