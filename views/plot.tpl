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

%rebase base title='Index', debug=debug, session=session, scripts=scripts, links=links, styles=styles

<div class="row">
    <div class="span3">
        <ul class="nav nav-list" id="entitylist">
            <li class="nav-header">Entities</li>
            <!--<li><a href="#">Entity 1</a>
                <ul class="nav nav-list">
                    <li class="nav-header">Checks</li>
                    <li class="">
                        <a href="#">Check 1a</a>
                        <ul class="nav nav-list">
                            <li class="nav-header">Metrics</li>
                            <li class=""><a href="#">Metric 1ai</a></li>
                            <li><a href="#">Metric 1aii</a></li>
                        </ul>
                    </li>
                    <li><a href="#">Check 1b</a></li>
                </ul>
            </li>
            <li>
                <a href="#">Entity 2</a>
                <ul class="nav nav-list">
                    <li class="nav-header">Checks</li>
                    <li class=""><a href="#">Check 2a</a></li>
                    <li><a href="#">Check 2b</a></li>
                </ul>
            </li>
            <li>Foo</li>
        -->
        </ul>


      </div>
    <div class="span9" id="chart">
        <svg></svg>
    </div>
</div>


<script>

var chart = nv.models.lineChart();

var datum_dict = [];

chart.xAxis
    .axisLabel('Date')
    .tickFormat(function(d) {return d3.time.format('%X')(new Date(d*1000)) });

chart.yAxis
    .axisLabel('')
    .tickFormat(d3.format('.02f'));

nv.utils.windowResize(chart.update);

nv.addGraph(function() {
  d3.select('#chart svg')
      //.datum({})
      .call(chart);
  return chart;
});

function metricHash(entity_id, check_id, metric_name) {
    return $entity_id + $check_id + $metric_name;
}

function toDatumList(dict) {
    list = [];

    for( series in dict ){
        list.push(dict[series]);
    }
    return list;

}

function getMetricUrl(entity_id, check_id, metric_name) {
    return "/mock/entities/" + $entity_id + "/checks/" + $check_id + "/metrics/" + $metric_name + '{{!get_vars}}';
}

function toDatum(data, name) {
    datum = {key: name, values: []};

    for(n in data) {
        datum['values'].push({x: data[n]['timestamp'], y: data[n]['average']['data']});
    }
    return datum;
}

function metricClick(event) {
    $target = $(event.target);
    $metric_name = $target.attr('id');
    $check_id = $target.parent().parent().parent().children('a')[0].id;
    $entity_id = $target.parent().parent().parent().parent().parent().children('a')[0].id;
    $hash = metricHash($entity_id, $check_id, $metric_name)

    if( $hash in datum_dict ) {
        delete datum_dict[$hash];

        d3.select('#chart svg')
        .datum(toDatumList(datum_dict))
        .call(chart.update);
    } else {
        jQuery.getJSON(getMetricUrl($entity_id, $check_id, $metric_name), function(data) {

            datum_dict[$hash] = toDatum(data, $metric_name);

            d3.select('#chart svg')
            .datum(toDatumList(datum_dict))
            .call(chart.update);

        })
    }
}

function checkClick(event) {
    $target = $(event.target);
    $check_id = $target.attr('id');
    $entity_id = $target.parent().closest('li').children('a')[0].id;

    if( $target.parent().children('ul').children('li').length > 0) {
        $target.parent().children('ul').children().remove();
        return;
    }

    $target.parent().children('ul').append(
        $('<li>').addClass('nav-header').append("Metrics")
    );

    jQuery.getJSON("/entities/" + $entity_id + "/checks/" + $check_id + "/metrics?json=true", function(data) {
        $.each(data, function(index, entity){
            $target.parent().children('ul').append(
                $('<li>').append(
                    $('<a>').attr('id', entity['metricName'])
                        .append(entity['metricName']),
                $('<ul>').addClass('nav nav-list')))
        })
        $target.parent().children("ul").children("li").children("a").click(metricClick);
    })

}

function entityClick(event) {
    $target = $(event.target);
    $entity_id = $target.attr('id');

    if( $target.parent().children('ul').children('li').length > 0) {
        $target.parent().children('ul').children().remove();
        return;
    }

    $target.parent().children('ul').append(
        $('<li>').addClass('nav-header').append("Checks")
    );

    jQuery.getJSON("/entities/" + $entity_id + "?json=true", function(data) {
        $.each(data, function(index, entity){
            $target.parent().children('ul').append(
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

</script>