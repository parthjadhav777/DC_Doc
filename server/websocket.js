const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { saveDocument, loadDocument, deleteDocument, listDocuments } = require('./documentHandlers');
const { Document } = require('./database');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  const clients = new Map();
  const documents = new Map();
  const activeUsers = {};

  wss.on('connection', (ws) => {
    const clientId = uuidv4();
    clients.set(clientId, { ws, username: null });

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'userevent':
            handleUserEvent(data, ws, clientId);
            break;
          case 'contentchange':
            await handleContentChange(data);
            break;
          case 'createdocument':
            await handleCreateDocument(data);
            break;
          case 'loaddocument':
            await handleLoadDocument(data);
            break;
          case 'deletedocument':
            await handleDeleteDocument(data);
            break;
          case 'listdocuments':
            await handleListDocuments();
            break;
          case 'editorevent':
            handleEditorEvent(data);
            break;
          case 'cursorupdate':
            handleCursorUpdate(data);
            break;
          case 'selectionupdate':
            handleSelectionUpdate(data);
            break;
          case 'userstatus':
            handleUserStatus(data);
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendError(ws, error.message);
      }
    });

    ws.on('close', () => {
      const client = clients.get(clientId);
      if (client && client.username) {
        delete activeUsers[client.username];
        broadcastUserList();
      }
      clients.delete(clientId);
    });
  });

  // function handleUserEvent(data, ws, clientId) {
  //   const username = data.username;
  //   const action = data.action;
  //   const client = clients.get(clientId);

  //   if (action === 'logout') {
  //     delete activeUsers[username];
  //     if (client) {
  //       client.username = null;
  //     }
  //     const userList = {
  //       type: 'userevent',
  //       data: {
  //         users: Object.values(activeUsers),
  //         action: 'logout',
  //         username: username
  //       }
  //     };
  //     wss.clients.forEach(client => {
  //       if (client.readyState === WebSocket.OPEN) {
  //         client.send(JSON.stringify(userList));
  //       }
  //     });
  //     ws.send(JSON.stringify({
  //       type: 'logout',
  //       success: true
  //     }));
  //   } else {
  //     activeUsers[username] = {
  //       username: username,
  //       lastSeen: Date.now()
  //     };
  //     if (client) {
  //       client.username = username;
  //     }
  //     broadcastUserList();
  //   }
  // }
  function handleUserEvent(data, ws, clientId) {
    const username = data.username;
    const action = data.action;
    const client = clients.get(clientId);
  
    if (action === 'logout') {
      delete activeUsers[username];
      if (client) {
        client.username = null;
      }
  
      // Broadcast logout to all clients
      const userList = {
        type: 'userevent',
        data: {
          users: Object.values(activeUsers),
          action: 'logout',
          username: username
        }
      };
  
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(userList)); // Notify all clients about the logout
        }
      });
  
      // Send a response to the client that triggered the logout
      ws.send(JSON.stringify({
        type: 'logout',
        success: true
      }));
    } else {
      activeUsers[username] = {
        username: username,
        lastSeen: Date.now()
      };
      if (client) {
        client.username = username;
      }
      broadcastUserList(); // Broadcast active users
    }
  }
  
  
  async function handleContentChange(data) {
    const result = await saveDocument(data.documentId, data.content, data.title);
    if (result.success) {
      broadcastToAll({
        type: 'contentchange',
        documentId: data.documentId,
        content: data.content,
        title: data.title
      });
    } else {
      sendError(null, result.error);
    }
  }

  async function handleCreateDocument(data) {
    const documentId = uuidv4();
    const result = await saveDocument(documentId, data.content || '', data.title || 'Untitled Document');
    if (result.success) {
      broadcastToAll({
        type: 'contentchange',
        documentId,
        content: data.content || '',
        title: data.title || 'Untitled Document'
      });
      broadcastToAll({
        type: 'success',
        message: 'Document created successfully'
      });
    } else {
      sendError(null, result.error);
    }
  }

  async function handleLoadDocument(data) {
    const result = await loadDocument(data.documentId);
    if (result.success) {
      broadcastToAll({
        type: 'contentchange',
        documentId: data.documentId,
        content: result.content,
        title: result.title
      });
    } else {
      sendError(null, result.error);
    }
  }

  async function handleDeleteDocument(data) {
    const result = await deleteDocument(data.documentId);
    if (result.success) {
      broadcastToAll({
        type: 'documentdeleted',
        documentId: data.documentId
      });
      broadcastToAll({
        type: 'success',
        message: 'Document deleted successfully'
      });
    } else {
      sendError(null, result.error);
    }
  }

  async function handleListDocuments() {
    const result = await listDocuments();
    if (result.success) {
      broadcastToAll({
        type: 'listdocuments',
        documents: result.documents || []
      });
    } else {
      sendError(null, result.error);
    }
  }

  function handleEditorEvent(data) {
    broadcastToAll({
      type: 'editorevent',
      documentId: data.documentId,
      editor: data.editor
    });
  }

  function handleCursorUpdate(data) {
    broadcastToAll({
      type: 'cursorupdate',
      documentId: data.documentId,
      username: data.username,
      position: data.position
    });
  }

  function handleSelectionUpdate(data) {
    broadcastToAll({
      type: 'selectionupdate',
      documentId: data.documentId,
      username: data.username,
      start: data.start,
      end: data.end
    });
  }

  function handleUserStatus(data) {
    broadcastToAll({
      type: 'userstatus',
      username: data.username,
      status: data.status
    });
  }

  function broadcastUserList() {
    const userList = {
      type: 'userevent',
      data: {
        users: Object.values(activeUsers)
      }
    };
    
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(userList));
      }
    });
  }

  function broadcastToAll(message) {
    clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  function sendError(ws, message) {
    const errorMessage = {
      type: 'error',
      message
    };
    if (ws) {
      ws.send(JSON.stringify(errorMessage));
    } else {
      broadcastToAll(errorMessage);
    }
  }
}

module.exports = setupWebSocket;
