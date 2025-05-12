import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Navbar,
  NavbarBrand,
  UncontrolledTooltip,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ListGroup,
  ListGroupItem,
  Form,
  FormGroup,
  Label,
  Input,
  Nav,
  NavItem
} from 'reactstrap';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { DefaultEditor } from 'react-simple-wysiwyg';
import Avatar from 'react-avatar';
import { FaFileAlt, FaPlus, FaTrash, FaUsers, FaHistory, FaSignInAlt, FaSignOutAlt } from 'react-icons/fa';

import './App.css';

const WS_URL = 'ws://127.0.0.1:8000';

function isUserEvent(message) {
  let evt = JSON.parse(message.data);
  return evt.type === 'userevent';
}

function App() {
  const [username, setUsername] = useState('');
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(WS_URL, {
    onOpen: () => {
      console.log('WebSocket connection established.');
    },
    share: true,
    filter: (message) => {
      if (!message || !message.data) return false;
      try {
        const data = JSON.parse(message.data);
        return data.type === 'userevent' || data.type === 'logout';
      } catch (e) {
        return false;
      }
    },
    retryOnError: true,
    shouldReconnect: () => true
  });

  useEffect(() => {
    if(username && readyState === ReadyState.OPEN) {
      sendJsonMessage({
        username,
        type: 'userevent'
      });
    }
  }, [username, sendJsonMessage, readyState]);

  useEffect(() => {
    if (lastJsonMessage) {
      const data = lastJsonMessage;
      if (data.type === 'logout' && data.success) {
        setUsername('');
      }
    }
  }, [lastJsonMessage]);

  // const handleLogout = () => {
  //   if (readyState === ReadyState.OPEN) {
  //     sendJsonMessage({
  //       type: 'userevent',
  //       username,
  //       action: 'logout'
  //     });
  //     // Immediately clear username to show login page
  //     setUsername('');
  //   }
  // };
  const handleLogout = () => {
    if (readyState === WebSocket.OPEN) {
      // Send logout message to WebSocket server
      sendJsonMessage({
        type: 'userevent',
        username: username,
        action: 'logout'
      });
  
      // Immediately clear username to show the login page in the current tab
      setUsername('');
  
      // Set a logout flag in localStorage to notify other tabs
      localStorage.setItem('logout', Date.now());
      
     // Delay to allow server-side logout processing
    }
  };
  

  return (
    <>
      <Navbar color="light" light>
        <NavbarBrand href="/">Real-time document editor</NavbarBrand>
        {username && (
          <Nav className="ms-auto">
            <NavItem>
              <div className="d-flex align-items-center">
                <Avatar 
                  name={username} 
                  size={32} 
                  round="20px"
                  className="me-2"
                />
                <span className="me-3">{username}</span>
                <Button 
                  color="danger" 
                  size="sm" 
                  onClick={handleLogout}
                  className="d-flex align-items-center"
                >
                  <FaSignOutAlt className="me-1" /> Logout
                </Button>
              </div>
            </NavItem>
          </Nav>
        )}
      </Navbar>
      <div className="container-fluid">
        {username ? <EditorSection username={username} /> 
            : <LoginSection onLogin={setUsername}/> }
      </div>
    </>
  );
}

function LoginSection({ onLogin }) {
  const [username, setUsername] = useState('');
  useWebSocket(WS_URL, {
    share: true,
    filter: () => false
  });
  function logInUser() {
    if(!username.trim()) {
      return;
    }
    onLogin && onLogin(username);
  }

  return (
    <div className="account">
      <div className="account__wrapper">
        <div className="account__card">
          <div className="account__profile">
            <FaFileAlt size={48} color="#4a90e2" />
            <p className="account__name">Welcome to DocShare</p>
            <p className="account__sub">Join to start collaborating</p>
          </div>
          <Form onSubmit={(e) => { e.preventDefault(); logInUser(); }}>
            <FormGroup>
              <Input
                name="username"
                placeholder="Enter your username"
                onChange={(e) => setUsername(e.target.value)}
                className="form-control"
              />
            </FormGroup>
            <Button
              type="submit"
              className="account__btn"
              disabled={!username.trim()}
            >
              <FaSignInAlt /> Join Session
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}

function History() {
  const { lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    filter: isUserEvent
  });
  const activities = lastJsonMessage?.data.userActivity || [];
  return (
    <ul>
      {activities.map((activity, index) => <li key={`activity-${index}`}>{activity}</li>)}
    </ul>
  );
}

function Users() {
  const { lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    filter: isUserEvent
  });
  
  const users = Object.values(lastJsonMessage?.data?.users || {});
  const action = lastJsonMessage?.data?.action;
  const logoutUsername = lastJsonMessage?.data?.username;

  return (
    <div className="users-list">
      {users.map(user => (
        <div key={user.username} className="user-item">
          <Avatar 
            name={user.username} 
            size={32} 
            round="20px"
            className="user-avatar"
          />
          <span className="user-name">{user.username}</span>
          <span className={`status-indicator ${user.status || 'online'}`}></span>
        </div>
      ))}
    </div>
  );
}

function EditorSection({ username }) {
  const [showDocumentList, setShowDocumentList] = useState(false);
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [documents, setDocuments] = useState([]);
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(WS_URL, {
    share: true,
    filter: (message) => {
      if (!message || !message.data) return false;
      try {
        const data = JSON.parse(message.data);
        return data.type === 'listdocuments';
      } catch (e) {
        console.error('Error in filter:', e);
        return false;
      }
    }
  });

  useEffect(() => {
    if (!lastJsonMessage) return;
    
    try {
      const data = lastJsonMessage;
      if (data.type === 'listdocuments') {
        console.log('Received documents:', data.documents);
        if (Array.isArray(data.documents)) {
          setDocuments(data.documents);
        } else {
          console.error('Received invalid documents format:', data.documents);
          setDocuments([]);
        }
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  }, [lastJsonMessage]);

  const toggleDocumentList = useCallback(() => {
    if (readyState === ReadyState.OPEN) {
      console.log('Requesting document list...');
      sendJsonMessage({
        type: 'listdocuments'
      });
      setShowDocumentList(prev => !prev);
    }
  }, [readyState, sendJsonMessage]);

  const handleLoadDocument = useCallback((documentId) => {
    if (readyState === ReadyState.OPEN) {
      console.log('Loading document:', documentId);
      sendJsonMessage({
        type: 'loaddocument',
        documentId: documentId
      });
      setShowDocumentList(false);
    }
  }, [readyState, sendJsonMessage]);

  const toggleCreateDocument = useCallback(() => {
    setShowCreateDocument(prev => !prev);
  }, []);

  const handleCreateDocument = useCallback((e) => {
    e.preventDefault();
    const title = e.target.documentTitle.value;
    const content = e.target.documentContent.value;

    if (readyState === ReadyState.OPEN) {
      console.log('Creating new document:', title);
      sendJsonMessage({
        type: 'createdocument',
        title: title,
        content: content
      });
      toggleCreateDocument();
      setTimeout(() => {
        sendJsonMessage({
          type: 'listdocuments'
        });
      }, 500);
    }
  }, [readyState, sendJsonMessage, toggleCreateDocument]);

  return (
    <div className="main-content">
      <div className="document-holder">
        <Document 
          username={username} 
          onShowDocuments={toggleDocumentList} 
          onCreateDocument={toggleCreateDocument}
        />
      </div>
      <div className="history-holder">
        <div className="history-header">
          <FaHistory size={20} color="#4a90e2" />
          <span>Activity History</span>
        </div>
        <History/>
      </div>

      {/* Document List Modal */}
      <Modal isOpen={showDocumentList} toggle={toggleDocumentList}>
        <ModalHeader toggle={toggleDocumentList}>
          <FaFileAlt /> Available Documents
        </ModalHeader>
        <ModalBody>
          <ListGroup>
            {documents && documents.length > 0 ? (
              documents.map((doc) => (
                <ListGroupItem 
                  key={doc.documentId} 
                  action 
                  onClick={() => handleLoadDocument(doc.documentId)}
                >
                  <div className="document-item">
                    <FaFileAlt size={20} color="#4a90e2" />
                    <div className="document-info">
                      <div className="document-title">{doc.title || 'Untitled Document'}</div>
                      <div className="document-date">
                        Last updated: {new Date(doc.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </ListGroupItem>
              ))
            ) : (
              <p>No documents found.</p>
            )}
          </ListGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggleDocumentList}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* Create Document Modal */}
      <Modal isOpen={showCreateDocument} toggle={toggleCreateDocument}>
        <ModalHeader toggle={toggleCreateDocument}>
          <FaPlus /> Create New Document
        </ModalHeader>
        <Form onSubmit={handleCreateDocument}>
          <ModalBody>
            <FormGroup>
              <Label for="documentTitle">Document Title</Label>
              <Input
                type="text"
                name="documentTitle"
                id="documentTitle"
                placeholder="Enter document title"
                required
              />
            </FormGroup>
            <FormGroup>
              <Label for="documentContent">Initial Content</Label>
              <Input
                type="textarea"
                name="documentContent"
                id="documentContent"
                placeholder="Enter initial document content"
                rows={5}
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" type="submit">
              <FaPlus /> Create Document
            </Button>
            <Button color="secondary" onClick={toggleCreateDocument}>
              Cancel
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
    </div>
  );
}

function Document({ username, onShowDocuments, onCreateDocument }) {
  const [content, setContent] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentEditor, setCurrentEditor] = useState(null);
  const [userCursors, setUserCursors] = useState({});
  const [userSelections, setUserSelections] = useState({});
  const [userStatus, setUserStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const editorRef = useRef(null);

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(WS_URL, {
    share: true,
    filter: (message) => {
      if (!message || !message.data) return false;
      try {
        const data = JSON.parse(message.data);
        return ['contentchange', 'error', 'success', 'documentdeleted', 'editorevent', 'cursorupdate', 'selectionupdate', 'userstatus', 'userevent'].includes(data.type);
      } catch (e) {
        console.error('Error in filter:', e);
        return false;
      }
    }
  });

  useEffect(() => {
    if (!lastJsonMessage) return;
    
    try {
      const data = lastJsonMessage;
      switch (data.type) {
        case 'contentchange':
          setContent(data.content || '');
          setDocumentId(data.documentId);
          setDocumentTitle(data.title || 'Untitled Document');
          setIsLoading(false);
          break;
        case 'editorevent':
          setCurrentEditor(data.editor);
          break;
        case 'cursorupdate':
          if (data.username !== username) {
            setUserCursors(prev => ({
              ...prev,
              [data.username]: {
                position: data.position,
                timestamp: Date.now()
              }
            }));
          }
          break;
        case 'selectionupdate':
          if (data.username !== username) {
            setUserSelections(prev => ({
              ...prev,
              [data.username]: {
                start: data.start,
                end: data.end,
                timestamp: Date.now()
              }
            }));
          }
          break;
        case 'userstatus':
          setUserStatus(prev => ({
            ...prev,
            [data.username]: {
              status: data.status,
              timestamp: Date.now()
            }
          }));
          break;
        // case 'userevent':
        //   // Handle user events including logout
        //   if (data.data?.action === 'logout') {
        //     const logoutUsername = data.data.username;
        //     // Remove the logged out user from all states
        //     setUserStatus(prev => {
        //       const newStatus = { ...prev };
        //       delete newStatus[logoutUsername];
        //       return newStatus;
        //     });
        //     setUserCursors(prev => {
        //       const newCursors = { ...prev };
        //       delete newCursors[logoutUsername];
        //       return newCursors;
        //     });
        //     setUserSelections(prev => {
        //       const newSelections = { ...prev };
        //       delete newSelections[logoutUsername];
        //       return newSelections;
        //     });
        //     if (currentEditor === logoutUsername) {
        //       setCurrentEditor(null);
        //     }
        //   }
          
        //   // Update user list
        //   const users = data.data?.users || [];
        //   const newUserStatus = {};
        //   users.forEach(user => {
        //     if (user.username !== username) {
        //       newUserStatus[user.username] = {
        //         status: 'online',
        //         timestamp: Date.now()
        //       };
        //     }
        //   });
        //   setUserStatus(newUserStatus);
        //   break;
        case 'userevent':
  const { action, username: logoutUsername, users = [] } = data.data || {};

  if (action === 'logout') {
    // Clear all related states for that user
    setUserStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[logoutUsername];
      return newStatus;
    });

    setUserCursors(prev => {
      const newCursors = { ...prev };
      delete newCursors[logoutUsername];
      return newCursors;
    });

    setUserSelections(prev => {
      const newSelections = { ...prev };
      delete newSelections[logoutUsername];
      return newSelections;
    });

    if (currentEditor === logoutUsername) {
      setCurrentEditor(null);
    }
  }

  // Always update the full user list
  const newUserStatus = {};
  users.forEach(user => {
    if (user.username !== username) {
      newUserStatus[user.username] = {
        status: 'online',
        timestamp: Date.now()
      };
    }
  });
  setUserStatus(newUserStatus);
  break;

        case 'error':
          setError(data.message);
          setIsLoading(false);
          setTimeout(() => setError(''), 5000);
          break;
        case 'success':
          setSuccess(data.message);
          setIsLoading(false);
          setTimeout(() => setSuccess(''), 5000);
          break;
        case 'documentdeleted':
          if (data.documentId === documentId) {
            setContent('');
            setDocumentId(null);
            setDocumentTitle('');
            setCurrentEditor(null);
            setUserCursors({});
            setUserSelections({});
          }
          break;
        default:
          console.log('Unhandled message type:', data.type);
          break;
      }
    } catch (e) {
      console.error('Error handling message:', e);
      setError('An error occurred while processing the message');
      setIsLoading(false);
    }
  }, [lastJsonMessage, documentId, username, currentEditor]);

  // Clean up old cursors and selections
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setUserCursors(prev => {
        const newCursors = { ...prev };
        Object.keys(newCursors).forEach(user => {
          if (now - newCursors[user].timestamp > 5000) {
            delete newCursors[user];
          }
        });
        return newCursors;
      });
      setUserSelections(prev => {
        const newSelections = { ...prev };
        Object.keys(newSelections).forEach(user => {
          if (now - newSelections[user].timestamp > 5000) {
            delete newSelections[user];
          }
        });
        return newSelections;
      });
    }, 1000);
    return () => clearInterval(cleanup);
  }, []);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    if (documentId && readyState === ReadyState.OPEN) {
      sendJsonMessage({
        type: 'contentchange',
        documentId,
        content: newContent,
        title: documentTitle
      });
      sendJsonMessage({
        type: 'editorevent',
        documentId,
        editor: username
      });
    }
  };

  const handleCursorMove = (e) => {
    if (documentId && readyState === ReadyState.OPEN) {
      const selection = window.getSelection();
      const position = selection.anchorOffset;
      
      sendJsonMessage({
        type: 'cursorupdate',
        documentId,
        username,
        position
      });

      // Update user status to typing
      sendJsonMessage({
        type: 'userstatus',
        username,
        status: 'typing'
      });

      // Reset typing status after 2 seconds of no activity
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => {
        sendJsonMessage({
          type: 'userstatus',
          username,
          status: 'idle'
        });
      }, 2000);
    }
  };

  const handleSelectionChange = (e) => {
    if (documentId && readyState === ReadyState.OPEN) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        sendJsonMessage({
          type: 'selectionupdate',
          documentId,
          username,
          start: range.startOffset,
          end: range.endOffset
        });
      }
    }
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setDocumentTitle(newTitle);
    if (documentId && readyState === ReadyState.OPEN) {
      sendJsonMessage({
        type: 'contentchange',
        documentId,
        content,
        title: newTitle
      });
    }
  };

  const handleDeleteDocument = () => {
    if (documentId && readyState === ReadyState.OPEN && window.confirm('Are you sure you want to delete this document?')) {
      sendJsonMessage({
        type: 'deletedocument',
        documentId
      });
      setContent('');
      setDocumentId(null);
      setDocumentTitle('');
    }
  };

  return (
    <div className="document-container">
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      
      <div className="document-header">
        <input
          type="text"
          value={documentTitle}
          onChange={handleTitleChange}
          placeholder="Document Title"
          className="document-title"
          disabled={isLoading}
        />
        <div className="document-actions">
          <Button onClick={onShowDocuments} color="secondary" disabled={isLoading}>
            <FaFileAlt /> Documents
          </Button>
          <Button onClick={onCreateDocument} color="primary" disabled={isLoading}>
            <FaPlus /> New Document
          </Button>
          {documentId && (
            <Button onClick={handleDeleteDocument} color="danger" disabled={isLoading}>
              <FaTrash /> Delete
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      )}

      {currentEditor && currentEditor !== username && (
        <div className="editor-indicator">
          <Avatar name={currentEditor} size={20} round="20px"/>
          <span>{currentEditor} is currently editing</span>
        </div>
      )}

      <div className="users-section">
        <div className="users-header">
          <FaUsers size={16} color="#4a90e2" />
          <span>Online Users</span>
        </div>
        <div className="users-list">
          {Object.entries(userStatus).map(([user, data]) => (
            <div key={user} className="user-item">
              <Avatar name={user} size={32} round="20px"/>
              <span className="user-name">{user}</span>
              <span className={`status-indicator ${data.status}`}></span>
            </div>
          ))}
        </div>
      </div>

      <div className="editor-container" ref={editorRef}>
        <DefaultEditor
          value={content}
          onChange={handleContentChange}
          onKeyUp={handleCursorMove}
          onMouseUp={handleCursorMove}
          onSelect={handleSelectionChange}
          className="document-editor"
        />
        {Object.entries(userCursors).map(([user, data]) => (
          <div
            key={user}
            className="user-cursor"
            style={{ left: `${data.position}px` }}
          >
            <Avatar name={user} size={16} round="20px"/>
            <div className="cursor-line"></div>
          </div>
        ))}
        {Object.entries(userSelections).map(([user, data]) => (
          <div
            key={user}
            className="user-selection"
            style={{
              left: `${data.start}px`,
              width: `${data.end - data.start}px`
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default App;