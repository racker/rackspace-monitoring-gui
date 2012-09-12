%def styles():
    <style>
    #chart_container {
            position: relative;
            font-family: Arial, Helvetica, sans-serif;
    }
    #chart {
            position: relative;
            left: 40px;
    }
    #y_axis {
            position: absolute;
            top: 0;
            bottom: 0;

            width: 40px;
    }
    </style>
%end

%def scripts():
    <script src="/static/rickshaw/vendor/d3.min.js"></script>
    <script src="/static/rickshaw/vendor/d3.layout.min.js"></script>
    <script src="/static/rickshaw/rickshaw.min.js"></script>
%end

%def links():
    <link type="text/css" rel="stylesheet" href="/static/rickshaw/rickshaw.min.css">
%end

%rebase base title='Index', debug=debug, session=session, scripts=scripts, links=links, styles=styles

<div id="chart_container">
        <div id="y_axis"></div>
        <div id="chart"></div>
</div>

<script>
var data_series = {{!data_series}};

series = [];

for(n in data_series) {
    series.push({color: 'steelblue', data: data_series[n]});
}

var graph = new Rickshaw.Graph( {
        element: document.querySelector("#chart"),
        width: 580,
        height: 250,
        min: 'auto',
        renderer: 'line',
        interpolation: 'linear',
        series: series
} );


var x_axis = new Rickshaw.Graph.Axis.Time( { graph: graph } );

var y_axis = new Rickshaw.Graph.Axis.Y( {
        graph: graph,
        orientation: 'left',
        tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
        element: document.getElementById('y_axis'),
} );

graph.render();

</script>