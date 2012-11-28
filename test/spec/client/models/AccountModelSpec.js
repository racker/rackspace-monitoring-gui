var requirejs = require('../../../config').requirejs;
var initialize = require('../../../config').initialize;

initialize();

var models = requirejs('models/models');
var $ = requirejs('jquery');

describe('models/models.js - account', function () {

    beforeEach(function() {
    });

    afterEach(function () {
      $('#test').empty();
    });

    it('should pass', function () {
        expect(1).toEqual(1);
    });
});
