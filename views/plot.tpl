%rebase base title='Index', debug=debug, session=session, data=data
<h1>Plot: Entity: {{entity_id}}, Check: {{check_id}}, Metric: {{metric_name}}<h1>

<div id="chart_container">
        <div id="y_axis"></div>
        <div id="chart"></div>
</div>

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

<script>

var data = {{!data}};

var graph = new Rickshaw.Graph( {
        element: document.querySelector("#chart"),
        width: 580,
        height: 250,
        min: 'auto',
        renderer: 'line',
        interpolation: 'linear',
        series: [ {
                color: 'steelblue',
                data: data
        } ]
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
