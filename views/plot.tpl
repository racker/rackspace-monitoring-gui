%def styles():
    <style>

    #chart {
            height: 400px;
    }


    </style>
%end

%def scripts():
    <script src="/static/nvd3/lib/d3.v2.js"></script>
    <script src="/static/nvd3/nv.d3.js"></script>
%end

%def links():
    <link href="../static/nvd3/src/nv.d3.css" rel="stylesheet" type="text/css">

    <style>
        .nvd3 .nv-groups path.nv-line {
            stroke-width: 1.5px;
        }
        .nv-legendWrap {
            display: none;
        }
    </style>
%end

%rebase base title='Plot', debug=debug, session=session, scripts=scripts, links=links, styles=styles

<div class="row">
    <div class="span3">
        <h2 class="nav-header">Entities</h2>
        <div class="accordion" id="entitylist">
        </div>

    </div>
    <div class="span9" id="chart">
        <div class="btn-group" id="daterangeselect" class="pull-right">
            <a class="btn dropdown-toggle" data-toggle="dropdown" href="#">Time Scale<span class="caret"></span></a>
            <ul class="dropdown-menu"></ul>
        </div>

        <svg></svg>

        <table class="table" id="metrictable">
            <tr><th>Entity Name</th><th>Check Name</th><th>Metric Name</th></tr>
        </table>
    </div>
</div>


<script>

function timestamp() {
    return Math.round((new Date()).getTime() / 1000);
}

SERIES = {};

FROM = 0;
TO = 30000;
POINTS = 400;

COLORS = d3.scale.category10().range();

ENTITIES = {};
CHECKS = {};

function nextColor() {
    var used = [];
    for(n in SERIES) {
        used.push(SERIES[n].color);
    }

    for(n in COLORS){
        if(used.indexOf(COLORS[n]) < 0) {
            return COLORS[n];
        }
    }
}

function Series(entity_id, check_id, metric_name) {
    this.values = [];
    this.color = undefined;
    this.entity_id = entity_id;
    this.check_id = check_id;
    this.metric_name = metric_name;
    this.name = "foo";
}

function toKey(series) {
    return [series.entity_id, series.check_id, series.metric_name].join();
}

function fromKey(str) {
    var list = str.split(',');
    return {'entity_id': list[0], 'check_id': list[1], 'metric_name': list[2]}
}

function getMetricUrl(series) {

    return "/mock/entities/" + series.entity_id +
        "/checks/" + series.check_id +
        "/metrics/" + series.metric_name +
        "?from=" + FROM + "&to=" + TO + "&points=" + POINTS;
}

function toValues(data, name) {
    var values = [];
    for(n in data) {
        values.push({x: data[n]['timestamp'], y: data[n]['average']['data']});
    }
    return values;
}

function getDatumList(dict) {
    var list = [];
    for( n in SERIES ){
        var s = SERIES[n];
        list.push( {values: s.values,
                    color: s.color,
                    key: s.name});
    }
    return list;
}

function updateChart() {
    d3.select('#chart svg')
        .datum(getDatumList())
        .call(chart.update);

    var $target = $("#metrictable");

    $target.find("tr:gt(0)").remove();

    for(var n in SERIES) {
        var s = SERIES[n];

        $target.append($('<tr>')
            .append($('<td>').append(s.entity_label),
                    $('<td>').append(s.check_label),
                    $('<span>').attr('class', 'label')
                                .attr('style', 'background-color:' + s.color).append(s.metric_name + ' ')
                                    .append(
                                        $('<a>').attr('href', '#').attr('onclick','removeSeries(SERIES["' + n + '"], true)' )
                                        .append(
                                            $('<span>').attr('class', 'icon-remove')
                                        )
                                    )
            )
        );
    }
}

function loadSeriesData(s, update) {
    return jQuery.getJSON(getMetricUrl(s), function(response) {
        s.values = toValues(response);
        s.name = s.metric_name;
        if(update) updateChart();
    });
}

function addSeries(s, update) {
    var key = toKey(s);
    SERIES[key] = s;
    s.color = nextColor();
    return loadSeriesData(s, update);
}

function removeSeries(s, update) {
    var key = toKey(s);
    delete SERIES[key];
    if(update) updateChart();
}

function toggleSeries(s, update){
    var key = toKey(s);

    if(key in SERIES){
        removeSeries(SERIES[key], update);
    } else {
        addSeries(s, update);
    }
}

function resetSeries(update) {
    for( key in SERIES ) {
        var s = SERIES(key);
        removeSeries(s, false);
    }
    if(update) updateChart();
}

function reloadData(update) {
    var deferreds = [];
    for(key in SERIES) {
        var s = SERIES[key];
        deferreds.push(loadSeriesData(s), false);
    }
    if (update) {
        $.when.apply($, deferreds).done(updateChart);
    }
}

HOUR = 60*60;
DATERANGES = {
    "hour": {text: "Last hour", offset: HOUR},
    "6hour": {text: "Last 3 hours", offset: 3*HOUR},
    "day": {text: "Last day", offset: 24*HOUR},
    "week": {text: "Last week", offset: 7*24*HOUR},
    "month": {text: "Last month", offset: 30*24*HOUR},
    "6month": {text: "Last 6 months", offset: 182*24*HOUR},
    "year": {text: "Last year", offset: 365*24*HOUR}
};

function setDateRange(range, update) {
    var ts = timestamp();
    TO = ts;
    FROM = ts-DATERANGES[range].offset;

    var drs = $("#daterangeselect > a");
    drs.text(DATERANGES[range].text + ' ').append($('<span>').attr('class', 'caret'));

    reloadData(update);
}

function metricClick(event) {
    var $target = $(event.target);

    var entity_id = $target.attr('data-entity-id');
    var entity_label = ENTITIES[entity_id]['label'];

    var check_id = $target.attr('data-check-id');
    var check_label = CHECKS[check_id]['label'];

    var metric_name = $target.attr('data-metric-name');

    var s = new Series(entity_id, check_id, metric_name);
    s.entity_label = entity_label;
    s.check_label = check_label;

    toggleSeries(s, true);
}


function metricAccord(entity_id, check_id, metric_name) {
    $e = $('<p>').append(
        $('<a>').attr('href', '#').attr('data-entity-id', entity_id).attr('data-check-id', check_id).attr('data-metric-name', metric_name).click(metricClick).append(
            metric_name
        )
    );
    return $e;
}


function checkClick(event) {
    var $target = $(event.target);
    var entity_id = $target.attr('data-entity-id');
    var check_id = $target.attr('data-check-id');

    $($target.attr("data-child")).children().remove()

    jQuery.getJSON("/entities/" + entity_id + "/checks/" + check_id + "/metrics?json=true", function(data) {
        $.each(data, function(index, metric){
            $($target.attr("data-child")).append(metricAccord(entity_id, check_id, metric['metricName']));
        });
    })
}

function entityDOM(entity_id, entity_name) {
    return $('<li>').append(
                $('<a>').attr('id', entity_id)
                    .append(entity_name),
                             $('<ul>').addClass('nav nav-list'));
}


function checkAccord(entity_id, check_id, check_name) {
    $e = $('<div>').addClass('accordion-group')
            .append(
                $('<div>').addClass("accordion-heading").append(
                    $('<a>').addClass("accordion-toggle").attr("data-toggle", "collapse").attr("data-parent", entity_id + "Checks").attr("data-child", "#" + check_id + "Metrics").attr("href", "#" + check_id + "Body").attr("data-entity-id", entity_id).attr("data-check-id", check_id).click(checkClick)
                        .append(check_name)
                ),
                $('<div>').attr("id", check_id + "Body").addClass("accordion-body collapse")
                    .append($('<div>').addClass("accordion-inner")
                        .append(
                            $('<h4>').addClass("nav-header").append("Metrics"),
                            $('<div>').addClass("accordian").attr("id", check_id + "Metrics")

                        )
                    )
            );
    return $e;
}

function entityClick(event) {
    var $target = $(event.target);
    var entity_id = $target.attr('data-entity-id');

    $($target.attr("data-child")).children().remove()

    jQuery.getJSON("/entities/" + entity_id + "?json=true", function(data) {
        $.each(data, function(index, check){
            $($target.attr("data-child")).append(checkAccord(entity_id, check['id'], check['label']));
            CHECKS[check['id']] = check;
        });
    })
}


function entityAccord(entity_id, entity_name) {
    $e = $('<div>').addClass('accordion-group')
            .append(
                $('<div>').addClass("accordion-heading").append(
                    $('<a>').addClass("accordion-toggle").attr("data-toggle", "collapse").attr("data-parent", "#accordion1").attr("data-child", "#" + entity_id + "Checks").attr("href", "#" + entity_id + "Body").attr("data-entity-id", entity_id).click(entityClick)
                        .append(entity_name)
                ),
                $('<div>').attr("id", entity_id + "Body").addClass("accordion-body collapse")
                    .append($('<div>').addClass("accordion-inner")
                        .append(
                            $('<h3>').addClass("nav-header").append("Checks"),
                            $('<div>').addClass("accordian").attr("id", entity_id + "Checks")

                        )
                    )
            );
    return $e;
}

// Load all entities
jQuery.getJSON("/entities?json=true", function(data) {
    $.each(data, function(index, entity){
        $("#entitylist").append(entityAccord(entity['id'], entity['label']));
        ENTITIES[entity['id']] = entity;
    });
});


var chart = nv.models.lineChart();

chart.xAxis
    .ticks(2)
    .scale(d3.time.scale)
    .showMaxMin(false)
    .axisLabel('Date')
    .tickFormat(function(d) {return d3.time.format('%X')(new Date(d*1000)) });

chart.yAxis
    .axisLabel('')
    .tickFormat(d3.format('.02f'));


nv.addGraph(function() {
  d3.select('#chart svg')
      .call(chart);
  return chart;
});

for(var r in DATERANGES) {
    $target = $("#daterangeselect > ul");

    $target.append(
        $('<li>').append(
            $('<a>').attr('href', '#').attr('onclick', 'setDateRange("' + r + '", true)')
            .append(DATERANGES[r].text)
        )

    );
}

setDateRange('day');
$("#chart").resize(updateChart);


</script>