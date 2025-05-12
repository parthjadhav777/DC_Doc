const cluster = require('cluster');
const os = require('os');

const setupPrimaryCluster = () => {
  const numCPUs = Math.min(os.cpus().length, 4);
  console.log(`Setting up ${numCPUs} worker processes`);

  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork({ WORKER_ID: i, PORT: 8000 + i });
    worker.on('exit', (code, signal) => {
      console.log(`Worker ${worker.process.pid} died. Respawning...`);
      cluster.fork({ WORKER_ID: i, PORT: 8000 + i });
    });
  }

  cluster.setupPrimary({
    serialization: 'advanced',
  });
};

module.exports = { setupPrimaryCluster };
