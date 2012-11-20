var config = {

  authUrl: 'https://identity.api.rackspacecloud.com/v2.0',

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
  secret: 'ziifos7moiwe1eeghee4sha3uut3doh6eW9zaiquahshooTeh7'
};

module.exports = config;
