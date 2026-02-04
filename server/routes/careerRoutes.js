/**
 * Career Routes
 * Handles admin career management and public career exploration
 */

const express = require('express');
const router = express.Router();
let db = null;
let storage = null;

/**
 * Initialize database and storage connection
 */
function setDatabase(database) {
  db = database;
}

function setStorage(storageModule) {
  storage = storageModule;
}

/**
 * Middleware to authenticate admin using token from storage
 */
function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  // Check superadmins first
  try {
    const admins = storage.loadAdmins();
    for (const admin of admins) {
      if (admin.token === token) {
        req.userEmail = admin.email || admin.idNumber;
        req.isAdmin = true;
        return next();
      }
    }
  } catch (err) {
    console.warn('Error checking admins:', err.message);
  }

  // Check regular users
  try {
    const users = storage.loadUsers();
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        if (user.role === 'admin' || user.role === 'instructor') {
          req.userEmail = email;
          req.isAdmin = true;
          return next();
        }
      }
    }
  } catch (err) {
    console.warn('Error checking users:', err.message);
  }

  res.status(401).json({ error: 'Invalid token' });
}

/**
 * Middleware to authenticate user (optional - for public access)
 */
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const admins = storage.loadAdmins();
      for (const admin of admins) {
        if (admin.token === token) {
          req.userEmail = admin.email || admin.idNumber;
          req.isAdmin = true;
          return next();
        }
      }

      const users = storage.loadUsers();
      for (const [email, user] of Object.entries(users)) {
        if (user.token === token) {
          req.userEmail = email;
          req.isAdmin = (user.role === 'admin' || user.role === 'instructor');
          return next();
        }
      }
    } catch (err) {
      // Continue without user info
    }
  }
  next();
}

/**
 * POST /api/careers
 * Create new career (admin only)
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    if (!db || !db.models || !db.models.Career) {
      return res.status(500).json({ error: 'Career model not available' });
    }

    const Career = db.models.Career;
    const {
      title,
      shortDescription,
      fullDescription,
      careerPath,
      relatedCourses,
      skillsRequired,
      educationLevel,
      industryRoles,
      salaryRange,
      coverImage,
      status
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const career = new Career({
      title,
      shortDescription: shortDescription || '',
      fullDescription: fullDescription || '',
      careerPath: careerPath || [],
      relatedCourses: relatedCourses || [],
      skillsRequired: skillsRequired || [],
      educationLevel: educationLevel || '',
      industryRoles: industryRoles || [],
      salaryRange: salaryRange || '',
      coverImage: coverImage || '',
      status: status || 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await career.save();
    console.log('✅ Career created:', title);
    
    res.json({
      message: 'Career created successfully',
      career: {
        id: career._id.toString(),
        title: career.title,
        shortDescription: career.shortDescription,
        fullDescription: career.fullDescription,
        careerPath: career.careerPath,
        relatedCourses: career.relatedCourses,
        skillsRequired: career.skillsRequired,
        educationLevel: career.educationLevel,
        industryRoles: career.industryRoles,
        salaryRange: career.salaryRange,
        coverImage: career.coverImage,
        status: career.status,
        createdAt: career.createdAt,
        updatedAt: career.updatedAt
      }
    });
  } catch (err) {
    console.error('❌ Error creating career:', err);
    res.status(500).json({ error: 'Failed to create career' });
  }
});

/**
 * GET /api/careers
 * Get all careers (with status filter for admins)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (!db || !db.models || !db.models.Career) {
      return res.status(500).json({ error: 'Career model not available' });
    }

    const Career = db.models.Career;
    const { status: statusFilter } = req.query;

    let query = {};
    
    // Non-admins only see published careers
    if (!req.isAdmin) {
      query.status = 'published';
    } else if (statusFilter) {
      // Admins can filter by status
      query.status = statusFilter;
    }

    const careers = await Career.find(query).sort({ updatedAt: -1 });
    
    const careerData = careers.map(c => ({
      id: c._id.toString(),
      title: c.title,
      shortDescription: c.shortDescription,
      fullDescription: c.fullDescription,
      careerPath: c.careerPath,
      relatedCourses: c.relatedCourses,
      skillsRequired: c.skillsRequired,
      educationLevel: c.educationLevel,
      industryRoles: c.industryRoles,
      salaryRange: c.salaryRange,
      coverImage: c.coverImage,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    res.json({ careers: careerData });
  } catch (err) {
    console.error('❌ Error fetching careers:', err);
    res.status(500).json({ error: 'Failed to fetch careers' });
  }
});

/**
 * GET /api/careers/:careerIdOrTitle
 * Get single career by ID or title (published only for public)
 */
router.get('/:careerIdOrTitle', async (req, res) => {
  try {
    if (!db || !db.models || !db.models.Career) {
      return res.status(500).json({ error: 'Career model not available' });
    }

    const Career = db.models.Career;
    const { careerIdOrTitle } = req.params;

    let career;
    
    // Try ID first
    try {
      const mongoose = require('mongoose');
      career = await Career.findById(new mongoose.Types.ObjectId(careerIdOrTitle));
    } catch (e) {
      // Try title if ID fails
      career = await Career.findOne({ title: careerIdOrTitle });
    }

    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }

    // Check if published (unless authenticated as admin)
    if (career.status !== 'published' && !req.headers.authorization) {
      return res.status(404).json({ error: 'Career not found' });
    }

    res.json({
      career: {
        id: career._id.toString(),
        title: career.title,
        shortDescription: career.shortDescription,
        fullDescription: career.fullDescription,
        careerPath: career.careerPath,
        relatedCourses: career.relatedCourses,
        skillsRequired: career.skillsRequired,
        educationLevel: career.educationLevel,
        industryRoles: career.industryRoles,
        salaryRange: career.salaryRange,
        coverImage: career.coverImage,
        status: career.status,
        createdAt: career.createdAt,
        updatedAt: career.updatedAt
      }
    });
  } catch (err) {
    console.error('❌ Error fetching career:', err);
    res.status(500).json({ error: 'Failed to fetch career' });
  }
});

/**
 * PUT /api/careers/:careerIdOrTitle
 * Update career (admin only)
 */
router.put('/:careerIdOrTitle', authenticateAdmin, async (req, res) => {
  try {
    if (!db || !db.models || !db.models.Career) {
      return res.status(500).json({ error: 'Career model not available' });
    }

    const Career = db.models.Career;
    const { careerIdOrTitle } = req.params;
    const updates = req.body;
    updates.updatedAt = new Date();

    let career;
    
    // Try ID first
    try {
      const mongoose = require('mongoose');
      career = await Career.findByIdAndUpdate(
        new mongoose.Types.ObjectId(careerIdOrTitle),
        updates,
        { new: true }
      );
    } catch (e) {
      // Try title if ID fails
      career = await Career.findOneAndUpdate(
        { title: careerIdOrTitle },
        updates,
        { new: true }
      );
    }

    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }

    console.log('✅ Career updated:', career.title);

    res.json({
      message: 'Career updated successfully',
      career: {
        id: career._id.toString(),
        title: career.title,
        shortDescription: career.shortDescription,
        fullDescription: career.fullDescription,
        careerPath: career.careerPath,
        relatedCourses: career.relatedCourses,
        skillsRequired: career.skillsRequired,
        educationLevel: career.educationLevel,
        industryRoles: career.industryRoles,
        salaryRange: career.salaryRange,
        coverImage: career.coverImage,
        status: career.status,
        createdAt: career.createdAt,
        updatedAt: career.updatedAt
      }
    });
  } catch (err) {
    console.error('❌ Error updating career:', err);
    res.status(500).json({ error: 'Failed to update career' });
  }
});

/**
 * DELETE /api/careers/:careerIdOrTitle
 * Delete career (admin only)
 */
router.delete('/:careerIdOrTitle', authenticateAdmin, async (req, res) => {
  try {
    if (!db || !db.models || !db.models.Career) {
      return res.status(500).json({ error: 'Career model not available' });
    }

    const Career = db.models.Career;
    const { careerIdOrTitle } = req.params;

    let career;
    
    // Try ID first
    try {
      const mongoose = require('mongoose');
      career = await Career.findByIdAndDelete(new mongoose.Types.ObjectId(careerIdOrTitle));
    } catch (e) {
      // Try title if ID fails
      career = await Career.findOneAndDelete({ title: careerIdOrTitle });
    }

    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }

    console.log('✅ Career deleted:', career.title);

    res.json({ message: 'Career deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting career:', err);
    res.status(500).json({ error: 'Failed to delete career' });
  }
});

/**
 * POST /api/careers/:careerIdOrTitle/publish
 * Publish career (admin only)
 */
router.post('/:careerIdOrTitle/publish', authenticateAdmin, async (req, res) => {
  try {
    if (!db || !db.models || !db.models.Career) {
      return res.status(500).json({ error: 'Career model not available' });
    }

    const Career = db.models.Career;
    const { careerIdOrTitle } = req.params;

    let career;
    
    try {
      const mongoose = require('mongoose');
      career = await Career.findByIdAndUpdate(
        new mongoose.Types.ObjectId(careerIdOrTitle),
        { status: 'published', updatedAt: new Date() },
        { new: true }
      );
    } catch (e) {
      career = await Career.findOneAndUpdate(
        { title: careerIdOrTitle },
        { status: 'published', updatedAt: new Date() },
        { new: true }
      );
    }

    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }

    console.log('✅ Career published:', career.title);

    res.json({
      message: 'Career published successfully',
      career: {
        id: career._id.toString(),
        title: career.title,
        status: career.status
      }
    });
  } catch (err) {
    console.error('❌ Error publishing career:', err);
    res.status(500).json({ error: 'Failed to publish career' });
  }
});

/**
 * POST /api/careers/:careerIdOrTitle/unpublish
 * Unpublish career (admin only)
 */
router.post('/:careerIdOrTitle/unpublish', authenticateAdmin, async (req, res) => {
  try {
    if (!db || !db.models || !db.models.Career) {
      return res.status(500).json({ error: 'Career model not available' });
    }

    const Career = db.models.Career;
    const { careerIdOrTitle } = req.params;

    let career;
    
    try {
      const mongoose = require('mongoose');
      career = await Career.findByIdAndUpdate(
        new mongoose.Types.ObjectId(careerIdOrTitle),
        { status: 'draft', updatedAt: new Date() },
        { new: true }
      );
    } catch (e) {
      career = await Career.findOneAndUpdate(
        { title: careerIdOrTitle },
        { status: 'draft', updatedAt: new Date() },
        { new: true }
      );
    }

    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }

    console.log('✅ Career unpublished:', career.title);

    res.json({
      message: 'Career unpublished successfully',
      career: {
        id: career._id.toString(),
        title: career.title,
        status: career.status
      }
    });
  } catch (err) {
    console.error('❌ Error unpublishing career:', err);
    res.status(500).json({ error: 'Failed to unpublish career' });
  }
});

module.exports = { router, setDatabase, setStorage };
