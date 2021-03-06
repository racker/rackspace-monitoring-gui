var config = {

  authUrlUS: 'https://identity.api.rackspacecloud.com/v2.0',
  authUrlUK: 'https://lon.identity.api.rackspacecloud.com/v2.0',


  static_path: 'static_build', // use 'static' for development

  // listen port (overidden by command-line)
  listen_port: 3000,

  // database config
  db: {
    db: 'raxmon-gui',
    host: 'localhost'
    //port: 27017,  // optional, default: 27017
    //username: 'admin', // optional
    //password: 'secret', // optional
    //collection: 'mySessions' // optional, default: sessions
  },

  // session secret - change this
  secret: 'ziifos7moiwe1eeghee4sha3uut3doh6eW9zaiquahshooTeh7',

  use_google_analytics: false,
  google_analytics_id: 'UA-XXXXXXX-X'
};

module.exports = config;
