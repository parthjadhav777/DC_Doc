const { Document } = require('./database');

async function logReplication(documentId) {
  try {
    const doc = await Document.findOne({ documentId });
    if (doc) {
      console.log('--- Data Replication Log ---');
      console.log(`Document ID: ${doc.documentId}`);
      console.log(`Content: ${doc.content}`);
      console.log(`Last Updated: ${doc.updatedAt}`);
      console.log('Replication Status: Data successfully replicated to MongoDB.');
      console.log('--------------------------------');
    } else {
      console.log(`Replication Log: Document ${documentId} not found in MongoDB.`);
    }
  } catch (error) {
    console.error('Error logging replication:', error);
  }
}

async function saveDocument(documentId, content, title = '') {
  try {
    let doc = await Document.findOne({ documentId });
    
    if (!doc) {
      // Create new document with initial history
      doc = new Document({ 
        documentId, 
        content,
        title,
        version: 1,
        history: [{
          content,
          timestamp: Date.now(),
          version: 1
        }]
      });
    } else {
      // Update existing document
      const newVersion = (doc.version || 0) + 1;
      
      // Ensure history array exists
      if (!Array.isArray(doc.history)) {
        doc.history = [];
      }
      
      // Update document fields
      doc.content = content;
      doc.title = title || doc.title;
      doc.version = newVersion;
      doc.updatedAt = Date.now();
      
      // Add new version to history
      doc.history.push({
        content,
        timestamp: Date.now(),
        version: newVersion
      });
    }

    // Save the document
    await doc.save();
    console.log(`Document ${documentId} saved to MongoDB.`);
    await logReplication(documentId);
    return { success: true, document: doc };
  } catch (error) {
    console.error('Error saving document:', error);
    return { success: false, error: error.message };
  }
}

async function loadDocument(documentId, version = null) {
  try {
    const doc = await Document.findOne({ documentId });
    if (!doc) {
      return { success: false, error: 'Document not found' };
    }
    
    if (version && Array.isArray(doc.history)) {
      const versionDoc = doc.history.find(h => h.version === version);
      if (versionDoc) {
        return { 
          success: true, 
          content: versionDoc.content,
          version: versionDoc.version,
          timestamp: versionDoc.timestamp
        };
      }
    }
    
    return { 
      success: true, 
      content: doc.content,
      version: doc.version,
      timestamp: doc.updatedAt,
      title: doc.title
    };
  } catch (error) {
    console.error('Error loading document:', error);
    return { success: false, error: error.message };
  }
}

async function deleteDocument(documentId) {
  try {
    const result = await Document.deleteOne({ documentId });
    if (result.deletedCount === 0) {
      return { success: false, error: 'Document not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting document:', error);
    return { success: false, error: error.message };
  }
}

async function listDocuments() {
  try {
    const documents = await Document.find({}, {
      documentId: 1,
      title: 1,
      updatedAt: 1,
      version: 1
    }).sort({ updatedAt: -1 });
    return { success: true, documents };
  } catch (error) {
    console.error('Error listing documents:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { 
  logReplication, 
  saveDocument, 
  loadDocument, 
  deleteDocument,
  listDocuments 
};
