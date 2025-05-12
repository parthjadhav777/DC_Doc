const cluster = require('cluster');
const clusterSetup = require('./clusterSetup');

if (cluster.isPrimary) {
  clusterSetup.setupPrimaryCluster();
} else {
  require('./websocket'); // Initialize WebSocket server for workers
}
