const express = require('express');
const http = require('http');
const path = require('path');
const setupWebSocket = require('./websocket');
const { Document } = require('./database');

const app = express();
const server = http.createServer(app);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// API endpoints for document operations
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await Document.find({}, {
      documentId: 1,
      title: 1,
      updatedAt: 1,
      version: 1
    }).sort({ updatedAt: -1 });
    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/documents/:documentId', async (req, res) => {
  try {
    const document = await Document.findOne({ documentId: req.params.documentId });
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({ success: true, document });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/documents/:documentId/versions', async (req, res) => {
  try {
    const document = await Document.findOne({ documentId: req.params.documentId });
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({ success: true, versions: document.history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Set up WebSocket server
setupWebSocket(server);

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
