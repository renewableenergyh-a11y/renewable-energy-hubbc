const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

let db;
let storage;

// Configure multer for temporary file storage
const upload = multer({ dest: 'tmp/' });

// Setup database and storage
function setDatabase(database) {
  db = database;
}

function setStorage(storageModule) {
  storage = storageModule;
}

// Middleware to authenticate admin (superadmin or admin)
function authenticateSuperAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const admins = storage.loadAdmins();
    const user = Object.values(admins).find(u => u.token === token);
    
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Only Admins can access media management' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET all media (only from media panel)
router.get('/', async (req, res) => {
  try {
    const Media = db.models.Media;
    // Only return videos uploaded through the Media Management panel
    const media = await Media.find({ source: 'media-panel' }).sort({ createdAt: -1 });
    res.json({ media });
  } catch (err) {
    console.error('Error fetching media:', err);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// POST upload media
router.post('/upload', authenticateSuperAdmin, upload.single('file'), async (req, res) => {
  try {
    const { title, description, category, thumbnail } = req.body;

    if (!title || !category || !req.file) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upload to Cloudinary
    const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'video',
      folder: 'ret-hub/media',
      public_id: `${Date.now()}-${title.replace(/\s+/g, '-').toLowerCase()}`,
      eager: [
        { width: 300, height: 300, crop: 'pad', audio_codec: 'none' }
      ]
    });

    // Remove temp file
    fs.unlinkSync(req.file.path);

    // Save to database
    const Media = db.models.Media;
    const media = new Media({
      title,
      description: description || '',
      category,
      cloudinaryUrl: cloudinaryResult.secure_url,
      cloudinaryId: cloudinaryResult.public_id,
      thumbnail: thumbnail || '',
      uploadedBy: req.user.email,
      source: 'media-panel',
      createdAt: new Date()
    });

    await media.save();

    res.json({ 
      success: true, 
      media,
      message: 'Video uploaded successfully' 
    });
  } catch (err) {
    console.error('Upload error:', err);
    
    // Clean up temp file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// DELETE media
router.delete('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const Media = db.models.Media;
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Delete from Cloudinary
    if (media.cloudinaryId) {
      await cloudinary.uploader.destroy(media.cloudinaryId, { resource_type: 'video' });
    }

    // Delete from database
    await Media.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

module.exports = {
  router,
  setDatabase,
  setStorage
};
