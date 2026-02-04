/**
 * Highlight Routes
 * API endpoints for managing text highlights in modules and courses
 */

const express = require('express');
const crypto = require('crypto');

function createHighlightRoutes(db) {
  const router = express.Router();

  // Middleware to authenticate token
  function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Store token for later use
    req.token = token;
    req.userEmail = getUserEmailFromToken(token);

    if (!req.userEmail) {
      console.warn('❌ Invalid token for highlights:', token.substring(0, 10) + '...');
      return res.status(403).json({ error: 'Invalid token' });
    }

    console.log('✅ Highlight user authenticated:', req.userEmail);
    next();
  }

  // Helper to get user email from token
  function getUserEmailFromToken(token) {
    try {
      const storage = require('../storage');
      
      // Check regular users
      const allUsers = storage.loadUsers();
      for (const [email, user] of Object.entries(allUsers)) {
        if (user && user.token === token) {
          return email;
        }
      }

      // Check admins
      try {
        const admins = storage.loadAdmins();
        for (const admin of admins) {
          if (admin.token === token) {
            return admin.email || admin.idNumber;
          }
        }
      } catch (e) {
        // Admins might not exist
      }

      return null;
    } catch (err) {
      console.error('❌ Error getting user email from token:', err.message);
      return null;
    }
  }

  /**
   * GET /api/highlights/:contentType/:contentId
   * Fetch highlights for a specific content
   */
  router.get('/:contentType/:contentId', authenticateToken, async (req, res) => {
    try {
      const { contentType, contentId } = req.params;
      const userEmail = req.userEmail;

      console.log('🔍 GET /api/highlights - User:', userEmail);
      console.log('   Content:', contentType, contentId);

      // Validate content type
      if (!['module', 'course'].includes(contentType)) {
        return res.status(400).json({ error: 'Invalid content type' });
      }

      // Get the Highlight model - ensure db is initialized
      if (!db || !db.models) {
        console.error('❌ Database not initialized properly');
        return res.status(500).json({ error: 'Database service not available' });
      }

      let Highlight = db.models.Highlight;
      
      // Fallback: ensure Highlight model exists
      if (!Highlight) {
        console.warn('⚠️ Highlight model not found, attempting to create...');
        try {
          const mongoose = require('mongoose');
          const Schema = mongoose.Schema;
          const AnySchema = new Schema({}, { strict: false });
          Highlight = mongoose.models.Highlight || mongoose.model('Highlight', AnySchema, 'highlights');
          db.models.Highlight = Highlight;
          console.log('✅ Highlight model created dynamically');
        } catch (modelErr) {
          console.error('❌ Failed to create Highlight model:', modelErr.message);
          return res.status(500).json({ error: 'Highlight model initialization failed' });
        }
      }

      const highlights = await Highlight.find({
        contentId,
        contentType,
        userEmail
      }).sort({ createdAt: -1 });

      console.log('✅ Found', highlights.length, 'highlights');
      // Map MongoDB _id to id in response
      const highlightData = highlights.map(h => ({
        id: h._id.toString(),
        contentId: h.contentId,
        contentType: h.contentType,
        text: h.text,
        startOffset: h.startOffset,
        endOffset: h.endOffset,
        color: h.color,
        createdAt: h.createdAt
      }));
      res.json({ highlights: highlightData || [] });
    } catch (err) {
      console.error('❌ Error fetching highlights:', err.message);
      console.error('   Code:', err.code);
      console.error('   Name:', err.name);
      console.error('   Stack:', err.stack);
      res.status(500).json({ error: 'Failed to fetch highlights', details: err.message });
    }
  });

  /**
   * POST /api/highlights
   * Create a new highlight
   */
  router.post('/', authenticateToken, async (req, res) => {
    try {
      const { contentId, contentType, text, startOffset, endOffset, color, parentSelector, tempId } = req.body;
      const userEmail = req.userEmail;

      console.log('📝 POST /api/highlights - User:', userEmail);
      console.log('   Content:', contentType, contentId);
      console.log('   Text:', text?.substring(0, 50) + '...');

      // Validate required fields
      if (!contentId || !contentType || !text || color === undefined) {
        console.warn('⚠️ Missing required fields:', { contentId, contentType, text: !!text, color });
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate offsets
      if (typeof startOffset !== 'number' || typeof endOffset !== 'number') {
        console.warn('⚠️ Invalid offset values:', { startOffset, endOffset });
        return res.status(400).json({ error: 'Invalid offset values' });
      }

      // Get the Highlight model - ensure db is initialized
      if (!db || !db.models) {
        console.error('❌ Database not initialized properly');
        return res.status(500).json({ error: 'Database service not available' });
      }

      let Highlight = db.models.Highlight;
      
      // Fallback: ensure Highlight model exists
      if (!Highlight) {
        console.warn('⚠️ Highlight model not found, attempting to create...');
        try {
          const mongoose = require('mongoose');
          const Schema = mongoose.Schema;
          const AnySchema = new Schema({}, { strict: false });
          Highlight = mongoose.models.Highlight || mongoose.model('Highlight', AnySchema, 'highlights');
          db.models.Highlight = Highlight;
          console.log('✅ Highlight model created dynamically');
        } catch (modelErr) {
          console.error('❌ Failed to create Highlight model:', modelErr.message);
          return res.status(500).json({ error: 'Highlight model initialization failed' });
        }
      }

      // Create new highlight
      const highlight = new Highlight({
        contentId,
        contentType,
        text,
        startOffset,
        endOffset,
        color,
        parentSelector,
        userEmail,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log('💾 Saving highlight. User:', userEmail);
      await highlight.save();
      console.log('✅ Highlight saved successfully, MongoDB _id:', highlight._id);

      res.status(201).json({
        message: 'Highlight created',
        highlight: {
          id: highlight._id.toString(),  // Return MongoDB _id as id
          contentId: highlight.contentId,
          contentType: highlight.contentType,
          text: highlight.text,
          startOffset: highlight.startOffset,
          endOffset: highlight.endOffset,
          color: highlight.color,
          createdAt: highlight.createdAt
        }
      });
    } catch (err) {
      console.error('❌ Error creating highlight:', err.message);
      console.error('   Code:', err.code);
      console.error('   Name:', err.name);
      console.error('   Stack:', err.stack);
      res.status(500).json({ error: 'Failed to create highlight', details: err.message });
    }
  });

  /**
   * PUT /api/highlights/:highlightId
   * Update highlight color
   */
  router.put('/:highlightId', authenticateToken, async (req, res) => {
    try {
      const { highlightId } = req.params;
      const { color } = req.body;
      const userEmail = req.userEmail;

      if (!color) {
        return res.status(400).json({ error: 'Color is required' });
      }

      const Highlight = db.models.Highlight;
      if (!Highlight) {
        return res.status(500).json({ error: 'Highlight model not available' });
      }

      // Find and update highlight (ensure user owns it)
      const highlight = await Highlight.findOne({
        _id: highlightId,
        userEmail
      });

      if (!highlight) {
        return res.status(404).json({ error: 'Highlight not found' });
      }

      highlight.color = color;
      highlight.updatedAt = new Date();
      await highlight.save();

      res.json({ message: 'Highlight updated', highlight });
    } catch (err) {
      console.error('Error updating highlight:', err);
      res.status(500).json({ error: 'Failed to update highlight' });
    }
  });

  /**
   * DELETE /api/highlights/:highlightId
   * Delete a highlight
   */
  router.delete('/:highlightId', authenticateToken, async (req, res) => {
    try {
      const { highlightId } = req.params;
      const userEmail = req.userEmail;

      const Highlight = db.models.Highlight;
      if (!Highlight) {
        return res.status(500).json({ error: 'Highlight model not available' });
      }

      // Delete highlight (ensure user owns it)
      const result = await Highlight.deleteOne({
        _id: highlightId,
        userEmail
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Highlight not found' });
      }

      res.json({ message: 'Highlight deleted' });
    } catch (err) {
      console.error('Error deleting highlight:', err);
      res.status(500).json({ error: 'Failed to delete highlight' });
    }
  });

  /**
   * DIAGNOSTIC: Test token validation (no auth required)
   * POST /api/highlights/debug/test-token
   */
  router.post('/debug/test-token', (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      console.log('🔍 Token test request');
      console.log('   Authorization header:', authHeader ? authHeader.substring(0, 20) + '...' : 'MISSING');
      console.log('   Token:', token ? token.substring(0, 20) + '...' : 'NOT EXTRACTED');
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'No token provided',
          authHeader: authHeader ? 'Present' : 'Missing'
        });
      }

      // Try to find the user
      const storage = require('../storage');
      const users = storage.loadUsers();
      let found = false;
      let matchEmail = null;

      for (const [email, user] of Object.entries(users)) {
        if (user && user.token === token) {
          found = true;
          matchEmail = email;
          break;
        }
      }

      if (found) {
        return res.json({ 
          success: true, 
          message: 'Token is valid',
          email: matchEmail,
          tokenLength: token.length
        });
      } else {
        return res.status(403).json({ 
          success: false, 
          error: 'Token not found in users',
          tokenLength: token.length,
          totalUsers: Object.keys(users).length
        });
      }
    } catch (err) {
      console.error('❌ Token test error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = createHighlightRoutes;
