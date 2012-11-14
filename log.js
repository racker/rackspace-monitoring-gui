var winston = require('winston');
var settings = require('./settings');

var access = new (winston.Logger)({
	transports: [
    new winston.transports.File({ filename: settings.log.access, json: false})
	],
	exitOnError: false
});

var application = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ json: false, timestamp: true}),
    new winston.transports.File({ filename: settings.log.application, json: false})
],
  exceptionHandlers: [
    new (winston.transports.Console)({ json: false, timestamp: true, prettyPrint: true }),
    new winston.transports.File({ filename: settings.log.application, json: false, prettyPrint: true })
  ],
  exitOnError: false
});

module.exports = {access: access, application: application};
