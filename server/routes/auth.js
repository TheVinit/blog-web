import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'aura_blog_secret_key_2026_premium_jwt_auth_token_987654';

// REGISTER user
router.post('/register', async (req, res) => {
  const { username, password, displayName, bio, avatarUrl } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const trimmedUsername = username.trim().toLowerCase();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // Check if user exists
    const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?');
    const existing = checkStmt.get(trimmedUsername);

    if (existing) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user
    const insertStmt = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, bio, avatar_url)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      trimmedUsername,
      passwordHash,
      displayName ? displayName.trim() : trimmedUsername,
      bio ? bio.trim() : 'Blogger at Aura',
      avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmedUsername)}`
    );

    const newUserId = result.lastInsertRowid;

    // Generate JWT
    const token = jwt.sign({ id: newUserId, username: trimmedUsername }, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: false, // Accessible by JS for simplicity in local setups
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.status(210).json({
      message: 'Registration successful!',
      token,
      user: {
        id: newUserId,
        username: trimmedUsername,
        displayName: displayName || trimmedUsername,
        bio: bio || 'Blogger at Aura',
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmedUsername)}`
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// LOGIN user
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const trimmedUsername = username.trim().toLowerCase();

  try {
    const userStmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = userStmt.get(trimmedUsername);

    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        bio: user.bio,
        avatarUrl: user.avatar_url
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// GET CURRENT USER PROFILE
router.get('/me', authenticateToken, (req, res) => {
  try {
    const userStmt = db.prepare('SELECT id, username, display_name as displayName, bio, avatar_url as avatarUrl, created_at as createdAt FROM users WHERE id = ?');
    const user = userStmt.get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Fetch profile error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// UPDATE USER PROFILE
router.put('/me', authenticateToken, (req, res) => {
  const { displayName, bio, avatarUrl } = req.body;

  try {
    const updateStmt = db.prepare(`
      UPDATE users
      SET display_name = ?, bio = ?, avatar_url = ?
      WHERE id = ?
    `);

    updateStmt.run(
      displayName ? displayName.trim() : req.user.username,
      bio ? bio.trim() : '',
      avatarUrl || '',
      req.user.id
    );

    return res.json({
      message: 'Profile updated successfully!',
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: displayName || req.user.username,
        bio: bio || '',
        avatarUrl: avatarUrl || ''
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error updating profile.' });
  }
});

export default router;
