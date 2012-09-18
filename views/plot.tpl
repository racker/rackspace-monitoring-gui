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
        <ul class="nav nav-list" id="entitylist">
            <li class="nav-header">Entities</li>
        </ul>
      </div>
    <div class="span9" id="chart">
        <div class="btn-group" id="daterangeselect" class="pull-right">
            <a class="btn dropdown-toggle" data-toggle="dropdown" href="#">Time Scale<span class="caret"></span></a>
            <ul class="dropdown-menu">
                <li><a href="#" onclick="setDateRange('hour', true)">Last hour</a></li>
                <li><a href="#" onclick="setDateRange('day', true)">Last day</a></li>
                <li><a href="#" onclick="setDateRange('week', true)">Last week</a></li>
                <li><a href="#" onclick="setDateRange('month', true)">Last month</a></li>
                <li><a href="#" onclick="setDateRange('6month', true)">Last 6 months</a></li>
                <li><a href="#" onclick="setDateRange('year', true)">Last year</a></li>
            </ul>
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
    list = [];
    for( n in SERIES ){
        s = SERIES[n];
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

    var target = $("#metrictable");

    target.find("tr:gt(0)").remove();

    for(n in SERIES) {
        s = SERIES[n];
        target.append($('<tr>')
            .append($('<td>').append(s.entity_label),
                    $('<td>').append(s.check_label),
                    $('<span>').attr('class', 'label')
                                .attr('style', 'background-color:' + s.color).append(s.metric_name + ' ')
                                    .append($('<a>').attr('href', '#')
                                        .append($('<span>').attr('class', 'icon-remove'))
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
    })
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
    var target = $(event.target);
    var metric_name = target.attr('id');
    var check_id = target.parent().parent().parent().children('a')[0].id;
    var check_label = target.parent().parent().parent().children('a')[0].text;

    var entity_id = target.parent().parent().parent().parent().parent().children('a')[0].id;
    var entity_label = target.parent().parent().parent().parent().parent().children('a')[0].text;

    var s = new Series(entity_id, check_id, metric_name);
    s.entity_label = entity_label;
    s.check_label = check_label;

    toggleSeries(s, true);
}

function checkClick(event) {
    var target = $(event.target);
    var check_id = target.attr('id');
    var entity_id = target.parent().closest('li').children('a')[0].id;

    if( target.parent().children('ul').children('li').length > 0) {
        target.parent().children('ul').children().remove();
        return;
    }

    target.parent().children('ul').append(
        $('<li>').addClass('nav-header').append("Metrics")
    );

    jQuery.getJSON("/entities/" + entity_id + "/checks/" + check_id + "/metrics?json=true", function(data) {
        $.each(data, function(index, entity){
            target.parent().children('ul').append(
                $('<li>').append(
                    $('<a>').attr('id', entity['metricName'])
                        .append(entity['metricName']),
                $('<ul>').addClass('nav nav-list')))
        })
        target.parent().children("ul").children("li").children("a").click(metricClick);
    })

}

function entityClick(event) {
    var target = $(event.target);
    var entity_id = target.attr('id');

    if( target.parent().children('ul').children('li').length > 0) {
        target.parent().children('ul').children().remove();
        return;
    }

    target.parent().children('ul').append(
        $('<li>').addClass('nav-header').append("Checks")
    );

    jQuery.getJSON("/entities/" + entity_id + "?json=true", function(data) {
        $.each(data, function(index, entity){
            target.parent().children('ul').append(
                $('<li>').append(
                    $('<a>').attr('id', entity['id'])
                        .append(entity['label']),
                $('<ul>').addClass('nav nav-list')))
        });
        $("#entitylist > li > ul > li > a").click(checkClick);
    })
}

// Load all entities
jQuery.getJSON("/entities?json=true", function(data) {
    $.each(data, function(index, entity){
        $('#entitylist').append(
            $('<li>').append(
                $('<a>').attr('id', entity['id'])
                    .append(entity['label']),
                $('<ul>').addClass('nav nav-list')))
    });
    $("#entitylist > li > a").click(entityClick);
});



var chart = nv.models.lineChart();

chart.xAxis
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


setDateRange('day');
$("#chart").resize(updateChart);


</script>