const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/collaborativeDocs';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const documentSchema = new mongoose.Schema({
  documentId: { type: String, required: true, unique: true },
  title: { type: String, default: 'Untitled Document' },
  content: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', documentSchema);

module.exports = { Document };
