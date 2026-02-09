/**
 * AI Chat Endpoint - Backend Proxy for OpenAI
 * 
 * This endpoint:
 * - Enforces strict access control (Premium + Promotion settings)
 * - Never exposes API keys
 * - Implements rate limiting
 * - Uses system prompt for renewable energy focus
 * - Handles promotion expiry automatically
 */

const express = require('express');
const router = express.Router();
const { default: OpenAI } = require('openai');

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
 * Middleware to authenticate using token
 */
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Check superadmins first
    if (storage) {
      const admins = storage.loadAdmins();
      for (const admin of admins) {
        if (admin.token === token) {
          req.user = {
            email: admin.email || admin.idNumber,
            name: admin.name || 'Super Admin',
            role: 'superadmin',
            idNumber: admin.idNumber
          };
          return next();
        }
      }
    }
    
    // Check regular users
    if (storage) {
      const users = storage.loadUsers();
      for (const [email, user] of Object.entries(users)) {
        if (user.token === token) {
          req.user = {
            email,
            name: user.name || email,
            role: user.role || 'user'
          };
          return next();
        }
      }
    }
    
    return res.status(401).json({ error: 'Invalid token' });
  } catch (err) {
    console.error('Token authentication error:', err.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Rate limiter - track requests per user per minute
const userRateLimits = new Map(); // email -> { count: int, resetTime: timestamp }

/**
 * SYSTEM PROMPT (Critical - Hard-coded)
 */
const SYSTEM_PROMPT = `You are Aubie RET AI Assistant.

You are an expert in renewable energy technologies, including:
Solar, Wind, Hydro, Biomass, and Geothermal energy.

You assist learners on the Renewable Energy Hub platform.

Rules:
- Answer only renewable energy–related questions
- Explain concepts clearly and simply
- Be concise but accurate
- If a question is outside renewable energy, politely redirect
- Do not mention OpenAI, API keys, or system internals
- Do not speculate or hallucinate`;

/**
 * Check if user has been rate-limited
 */
function checkRateLimit(email) {
  const limit = userRateLimits.get(email);
  const now = Date.now();
  
  if (!limit) {
    userRateLimits.set(email, { count: 1, resetTime: now + 60000 });
    return { allowed: true };
  }
  
  if (now > limit.resetTime) {
    // Reset window
    userRateLimits.set(email, { count: 1, resetTime: now + 60000 });
    return { allowed: true };
  }
  
  if (limit.count >= 10) {
    return { allowed: false, remaining: 0 };
  }
  
  limit.count++;
  return { allowed: true, remaining: 10 - limit.count };
}

/**
 * Check if AI access is available for user
 */
async function checkAiAccess(user, db) {
  try {
    // Get platform settings
    const settings = await db.models.PlatformSettings.findOne({});
    
    // If AI feature is disabled, deny access
    if (!settings || !settings.enableAiAssistant === false) {
      return { hasAccess: false, reason: 'AI feature is disabled' };
    }
    
    // Get user record to check subscription status
    const userRecord = await db.models.User.findOne({ email: user.email });
    
    const aiAccessMode = (settings && settings.aiAccessMode) || 'Premium Only';
    const now = new Date();
    
    // Check if promotion is active
    let promotionActive = false;
    if (settings && settings.aiPromotionStartedAt) {
      const promotionStart = new Date(settings.aiPromotionStartedAt);
      let promotionEnd = new Date(promotionStart);
      
      // Calculate duration
      if (settings.aiPromotionDurationUnit === 'hours') {
        promotionEnd.setHours(promotionEnd.getHours() + (settings.aiPromotionDurationValue || 24));
      } else if (settings.aiPromotionDurationUnit === 'days') {
        promotionEnd.setDate(promotionEnd.getDate() + (settings.aiPromotionDurationValue || 7));
      }
      
      promotionActive = now < promotionEnd;
    }
    
    // If promotion has expired, switch access mode to Premium Only
    if (!promotionActive && aiAccessMode !== 'Premium Only' && settings) {
      await db.models.PlatformSettings.updateOne(
        { _id: settings._id },
        { aiAccessMode: 'Premium Only' }
      );
    }
    
    // Check access based on mode
    if (aiAccessMode === 'Premium Only') {
      const isPremium = userRecord && userRecord.subscription_status === 'active';
      if (!isPremium) {
        return { hasAccess: false, reason: 'Premium subscription required' };
      }
    } else if (aiAccessMode === 'Promotion Only') {
      if (!promotionActive) {
        return { hasAccess: false, reason: 'Promotion period has ended' };
      }
    } else if (aiAccessMode === 'Everyone') {
      // No additional checks needed
    }
    
    return { hasAccess: true };
  } catch (err) {
    console.error('Error checking AI access:', err.message);
    return { hasAccess: false, reason: 'Could not verify access' };
  }
}

/**
 * POST /api/ai/chat
 * Send message to OpenAI with access control
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    // User is authenticated at this point
    const user = req.user;
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    
    // Extract message and conversation
    const { message, conversation } = req.body;
    
    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message is too long (max 1000 characters)' });
    }
    
    // Check rate limit
    const rateLimitCheck = checkRateLimit(user.email);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ error: 'Too many requests, slow down' });
    }
    
    // Check AI access
    const accessCheck = await checkAiAccess(user, db);
    if (!accessCheck.hasAccess) {
      return res.status(403).json({ error: 'AI access not available' });
    }
    
    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'AI is temporarily unavailable' });
    }
    
    const openai = new OpenAI({ apiKey });
    
    // Build conversation with last 5 messages
    const conversationHistory = [];
    
    // Add system prompt
    conversationHistory.push({
      role: 'system',
      content: SYSTEM_PROMPT
    });
    
    // Add conversation history (last 5 messages)
    if (conversation && Array.isArray(conversation)) {
      const recentMessages = conversation.slice(-5);
      conversationHistory.push(...recentMessages);
    }
    
    // Add current user message
    conversationHistory.push({
      role: 'user',
      content: message
    });
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversationHistory,
      temperature: 0.3,
      max_tokens: 300,
      timeout: 30000
    });
    
    const assistantMessage = response.choices[0]?.message?.content || '';
    
    if (!assistantMessage) {
      return res.status(500).json({ error: 'Failed to generate response' });
    }
    
    // Return response
    res.json({
      success: true,
      reply: assistantMessage,
      remaining: rateLimitCheck.remaining
    });
    
  } catch (err) {
    console.error('AI chat error:', err.message);
    
    // Handle specific errors
    if (err.code === 'RATE_LIMIT_EXCEEDED') {
      return res.status(429).json({ error: 'AI service rate limited, please try again later' });
    }
    
    if (err.code === 'CONTEXT_LENGTH_EXCEEDED') {
      return res.status(400).json({ error: 'Conversation is too long, please start a new chat' });
    }
    
    if (err.status === 401) {
      return res.status(500).json({ error: 'AI authentication failed' });
    }
    
    if (err.code === 'ERR_HTTP_REQUEST_TIMEOUT') {
      return res.status(504).json({ error: 'AI service timed out, please try again' });
    }
    
    res.status(500).json({ error: 'AI is temporarily unavailable' });
  }
});

module.exports = { router, setDatabase, setStorage };
