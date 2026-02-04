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
      return res.status(403).json({ error: 'Invalid token' });
    }

    next();
  }

  // Helper to get user email from token
  function getUserEmailFromToken(token) {
    try {
      // This assumes you have a way to validate tokens
      // You'll need to implement this based on your auth system
      // For now, return a placeholder - adjust based on your storage
      const allUsers = loadAllUsers();
      for (const [email, user] of Object.entries(allUsers)) {
        if (user && user.token === token) {
          return email;
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function loadAllUsers() {
    try {
      const storage = require('../storage');
      return storage.loadUsers();
    } catch (err) {
      return {};
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

      // Validate content type
      if (!['module', 'course'].includes(contentType)) {
        return res.status(400).json({ error: 'Invalid content type' });
      }

      // Query database for highlights
      const Highlight = db.models.Highlight;
      if (!Highlight) {
        return res.status(500).json({ error: 'Highlight model not available' });
      }

      const highlights = await Highlight.find({
        contentId,
        contentType,
        userEmail
      }).sort({ createdAt: -1 });

      res.json({ highlights: highlights || [] });
    } catch (err) {
      console.error('Error fetching highlights:', err);
      res.status(500).json({ error: 'Failed to fetch highlights' });
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

      // Validate required fields
      if (!contentId || !contentType || !text || color === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate offsets
      if (typeof startOffset !== 'number' || typeof endOffset !== 'number') {
        return res.status(400).json({ error: 'Invalid offset values' });
      }

      const Highlight = db.models.Highlight;
      if (!Highlight) {
        return res.status(500).json({ error: 'Highlight model not available' });
      }

      // Create new highlight
      const highlight = new Highlight({
        id: crypto.randomBytes(16).toString('hex'),
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

      await highlight.save();

      res.status(201).json({
        message: 'Highlight created',
        highlight: {
          id: highlight.id,
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
      console.error('Error creating highlight:', err);
      res.status(500).json({ error: 'Failed to create highlight' });
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
        id: highlightId,
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
        id: highlightId,
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

  return router;
}

module.exports = createHighlightRoutes;
