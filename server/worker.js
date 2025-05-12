const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

class Worker {
	constructor(port, workerPorts) {
		this.port = port;
		this.workerId = workerPorts.indexOf(port);
		this.workerPorts = workerPorts;
		this.currentLeaderId = null;
		this.electionInProgress = false;
		this.isLeader = false;
		this.lastHeartbeat = Date.now();
		this.app = express();
		this.setupServer();
	}

	setupServer() {
		this.app.use(bodyParser.json());

		// Handle election messages
		this.app.post("/election", async (req, res) => {
			const message = req.body;
			console.log(
				`[ELECTION]\t\tWorker ${this.workerId} (${this.port}): Received ELECTION from Worker on port ${message.senderPort}`
			);

			if (message.senderPort < this.port) {
				console.log(
					`[ACK]\t\t\tWorker ${this.workerId} (${this.port}): Sending OK to Worker on port ${message.senderPort}`
				);
				res.json({ status: "OK" });

				// Start our own election since we're higher priority
				if (!this.electionInProgress) {
					setTimeout(() => this.startElection(), 100);
				}
			} else {
				res.status(404).json({ status: "IGNORED" });
			}
		});

		// Handle leader announcements
		this.app.post("/leader", (req, res) => {
			const { leaderId, leaderPort } = req.body;
			this.handleLeaderMessage({ leaderId, leaderPort });
			res.json({ status: "OK" });
		});

		// Handle heartbeat
		this.app.post("/heartbeat", (req, res) => {
			this.lastHeartbeat = Date.now();
			res.json({ status: "OK" });
		});

		// Status endpoint
		this.app.get("/status", (req, res) => {
			res.json({
				workerId: this.workerId,
				port: this.port,
				isLeader: this.isLeader,
				currentLeaderId: this.currentLeaderId,
				electionInProgress: this.electionInProgress,
			});
		});

		// Start election endpoint
		this.app.post("/start-election", (req, res) => {
			if (!this.electionInProgress) {
				this.startElection();
				res.json({ status: "Election started" });
			} else {
				res.json({ status: "Election already in progress" });
			}
		});

		this.app.listen(this.port, () => {
			console.log(
				`[STARTUP]\t\tWorker ${this.workerId} listening on port ${this.port}`
			);
		});
	}

	async startElection() {
		if (this.electionInProgress) {
			console.log(
				`[ELECTION]\t\tWorker ${this.workerId} (${this.port}): Election already in progress.`
			);
			return;
		}

		console.log(
			`[ELECTION]\t\tWorker ${this.workerId} (${this.port}): Starting election.`
		);
		this.electionInProgress = true;

		const higherPriorityPorts = this.workerPorts.filter(
			(port) => port > this.port
		);

		if (higherPriorityPorts.length === 0) {
			console.log(
				`[ELECTION]\t\tWorker ${this.workerId} (${this.port}): No higher-priority workers, declaring self as leader.`
			);
			this.declareLeader();
			return;
		}

		let receivedResponses = 0;
		const electionTimeout = setTimeout(() => {
			if (receivedResponses === 0) {
				console.log(
					`[ELECTION]\t\tWorker ${this.workerId} (${this.port}): No responses from higher-priority workers, declaring self as leader.`
				);
				this.declareLeader();
			} else {
				console.log(
					`[ELECTION]\t\tWorker ${this.workerId} (${this.port}): Election aborted due to responses from higher-priority workers.`
				);
				this.electionInProgress = false;
			}
		}, 2000);

		// Send election messages to higher priority workers
		for (const port of higherPriorityPorts) {
			try {
				const response = await this.sendElectionMessage(port);
				if (response.status === "OK") {
					receivedResponses++;
				}
			} catch (error) {
				console.log(
					`[ERROR]\t\t\tWorker ${this.workerId} (${this.port}): Failed to contact worker on port ${port}`
				);
			}
		}
	}

	async sendElectionMessage(targetPort) {
		try {
			console.log(
				`[ELECTION]\t\tWorker ${this.workerId} (${this.port}): Sending ELECTION to Worker on port ${targetPort}`
			);
			const response = await axios.post(
				`http://localhost:${targetPort}/election`,
				{
					type: "ELECTION",
					senderPort: this.port,
					senderId: this.workerId,
				}
			);
			return response.data;
		} catch (error) {
			throw error;
		}
	}

	async declareLeader() {
		if (this.currentLeaderId === this.workerId) return;

		this.isLeader = true;
		this.currentLeaderId = this.workerId;
		this.electionInProgress = false;

		console.log(
			`[LEADER]\t\tWorker ${this.workerId} (${this.port}): I am the new leader.`
		);

		// Announce leadership to all other workers
		for (const port of this.workerPorts) {
			if (port !== this.port) {
				try {
					await this.sendLeaderMessage(port);
				} catch (error) {
					console.log(
						`[ERROR]\t\t\tWorker ${this.workerId} (${this.port}): Failed to announce leadership to port ${port}`
					);
				}
			}
		}

		// Start sending heartbeats if leader
		if (this.isLeader) {
			this.startHeartbeat();
		}
	}

	async sendLeaderMessage(targetPort) {
		try {
			await axios.post(`http://localhost:${targetPort}/leader`, {
				type: "LEADER",
				leaderId: this.workerId,
				leaderPort: this.port,
			});
		} catch (error) {
			throw error;
		}
	}

	handleLeaderMessage(message) {
		this.currentLeaderId = message.leaderId;
		this.isLeader = message.leaderPort === this.port;
		this.electionInProgress = false;
		console.log(
			`[LEADER]\t\tWorker ${this.workerId} (${this.port}): Acknowledging Leader ${this.currentLeaderId} on port ${message.leaderPort}`
		);
	}

	startHeartbeat() {
		setInterval(async () => {
			if (!this.isLeader) return;

			for (const port of this.workerPorts) {
				if (port !== this.port) {
					try {
						await axios.post(`http://localhost:${port}/heartbeat`, {
							type: "HEARTBEAT",
							leaderId: this.workerId,
						});
					} catch (error) {
						console.log(
							`[ERROR]\t\t\tWorker ${this.workerId} (${this.port}): Failed to send heartbeat to port ${port}`
						);
					}
				}
			}
		}, 1000);
	}

	startHeartbeatCheck() {
		setInterval(() => {
			if (this.isLeader) return;

			const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
			if (timeSinceLastHeartbeat > 3000) {
				// 3 seconds timeout
				console.log(
					`[FAILURE]\t\tWorker ${this.workerId} (${this.port}): Leader heartbeat timeout. Starting election.`
				);
				this.startElection();
			}
		}, 1000);
	}
}

module.exports = Worker;
