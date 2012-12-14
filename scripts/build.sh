#!/bin/bash
set -x verbose #echo on
node ./node_modules/requirejs/bin/r.js -o ./static/js/build.js
cd ./static_build
rm -rf js/extern/backbone/ js/extern/bootstrap/ js/extern/crossfilter/ js/extern/d3 js/extern/dc js/extern/jquery js/extern/underscore
rm -rf js/app.js js/build.js js/models js/router.js js/views
rm css/bootstrap-responsive.css css/bootstrap.css css/dc.css css/jquery-ui.css 
rm build.txt
