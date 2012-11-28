var requirejs = require('../../../config').requirejs;
var initialize = require('../../../config').initialize;

initialize();

var views = requirejs('views/views');
var $ = requirejs('jquery');

describe('views/views.js - entities', function () {

    beforeEach(function() {
    });

    afterEach(function () {
      $('#test').empty();
    });

    it('should pass', function () {
        expect(1).toEqual(1);
    });
});
