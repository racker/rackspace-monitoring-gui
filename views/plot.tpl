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
%end

%rebase base title='Plot', debug=debug, session=session, scripts=scripts, links=links, styles=styles

<div class="row">
    <div class="span3">
        <ul class="nav nav-list" id="entitylist">
            <li class="nav-header">Entities</li>
        </ul>
      </div>
    <div class="span9" id="chart">
        <div class="btn-group">
            <a class="btn dropdown-toggle" data-toggle="dropdown" href="#">Time Scale<span class="caret"></span></a>
            <ul class="dropdown-menu">
                <li onclick="setDateRange('hour', true)">Last hour</li>
                <li onclick="setDateRange('day', true)">Last day</li>
                <li onclick="setDateRange('week', true)">Last week</li>
                <li onclick="setDateRange('month', true)">Last month</li>
                <li onclick="setDateRange('6month', true)">Last 6 months</li>
                <li onclick="setDateRange('year', true)">Last year</li>
            </ul>
        </div>

        <svg></svg>

        <table class="table" id="metrictable">
            <tr><th>Entity</th><th>Check</th><th>Metric</th></tr>
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
    this.color = nextColor();;
    this.entity_id = entity_id;
    this.check_id = check_id;
    this.metric_name = metric_name;
    this.name = "foo";
}

function toKey(entity_id, check_id, metric_name) {
    return [entity_id, check_id, metric_name].join();
}

function fromKey(str) {
    var list = str.split(',');
    return {'entity_id': list[0], 'check_id': list[1], 'metric_name': list[2]}
}

function getMetricUrl(key, from, to) {
    var metric = fromKey(key);

    return "/mock/entities/" + metric.entity_id +
        "/checks/" + metric.check_id +
        "/metrics/" + metric.metric_name +
        "?from=" + FROM + "&to=" + TO + "&points=200";
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
    for( s in SERIES ){
        list.push( {values: SERIES[s].values,
                    color: SERIES[s].color,
                    key: SERIES[s].name});
    }
    console.log(list);
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
            .append($('<td>').append(s.entity_id),
                    $('<td>').append(s.check_id),
                    $('<span>').attr('class', 'label')
                                .attr('style', 'background-color:' + s.color).append(s.metric_name)
            )
        );
    }
}

function addSeries(entity_id, check_id, metric_name, update) {
    var key = toKey(entity_id, check_id, metric_name);
    SERIES[key] = new Series(entity_id, check_id, metric_name);

    return jQuery.getJSON(getMetricUrl(key, FROM, TO), function(response) {
        SERIES[key].values = toValues(response);
        SERIES[key].name = metric_name;
        if(update) updateChart();
    })
}

function removeSeries(entity_id, check_id, metric_name, update) {
    var key = toKey(entity_id, check_id, metric_name);
    delete SERIES[key];
    if(update) updateChart();
}

function toggleSeries(entity_id, check_id, metric_name, update){
    var key = toKey(entity_id, check_id, metric_name);

    if(key in SERIES){
        removeSeries(entity_id, check_id, metric_name, update);
    } else {
        addSeries(entity_id, check_id, metric_name, update);
    }
}

function resetSeries(update) {
    for( key in SERIES ) {
        var s = SERIES(key);
        removeSeries(s.entity_id, s.check_id, s.metric_name, false);
    }
    if(update) updateChart();
}

function reloadData(update) {
    var deferreds = [];
    for(key in SERIES) {
        var s = SERIES[key];
        removeSeries(s.entity_id, s.check_id, s.metric_name, false);
        deferreds.push(addSeries(s.entity_id, s.check_id, s.metric_name, false))
    }
    if (update) {
        $.when.apply($, deferreds).done(updateChart);
    }
}

function setDateRange(range, update) {
    ts = timestamp();
    TO = ts;

    hour = 60*60
    if(range == "hour") {
        FROM = ts-hour;

    } else if(range=="day") {
        FROM = ts-24*hour;

    } else if(range=="week") {
        FROM = ts-24*7*hour;

    } else if(range=="month") {
        FROM = ts-24*30*hour;

    } else if(range=="6month") {
        FROM = ts-24*182*hour;

    } else if(range=="year") {
        FROM = ts-24*365*hour;

    }

    reloadData(update);
}

function metricClick(event) {
    var target = $(event.target);
    var metric_name = target.attr('id');
    var check_id = target.parent().parent().parent().children('a')[0].id;
    var entity_id = target.parent().parent().parent().parent().parent().children('a')[0].id;

    toggleSeries(entity_id, check_id, metric_name, true);
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


$("#chart").resize(updateChart);


</script>