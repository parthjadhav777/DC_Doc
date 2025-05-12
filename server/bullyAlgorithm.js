// index.js
const Worker = require("./worker"); // Assuming the previous code is in worker.js

const PORTS = [8000, 8001, 8002, 8003]; // You can modify these ports as needed

function startWorker(port, allPorts) {
	const worker = new Worker(port, allPorts);
	worker.startHeartbeatCheck();
	return worker;
}

// Start all workers
const workers = PORTS.map((port) => startWorker(port, PORTS));

// Handle graceful shutdown
process.on("SIGINT", async () => {
	console.log("\nShutting down workers...");
	setTimeout(() => {
		process.exit(0);
	}, 1000);
});

console.log(`
Worker System Started
--------------------
Available endpoints for each worker (replace PORT with ${PORTS.join(", ")}):
- GET  http://localhost:PORT/status           - Check worker status
- POST http://localhost:PORT/start-election   - Manually trigger election
`);
