import bcrypt from 'bcryptjs';
import db, { initDb } from './db.js';

async function seed() {
  console.log('[Seed] Starting database seeding...');
  
  // Ensure tables exist
  initDb();

  try {
    // Check if user already exists
    const userCheck = db.prepare("SELECT id FROM users WHERE username = 'editor'").get();
    if (userCheck) {
      console.log('[Seed] Database is already seeded or admin user exists. Skipping.');
      return;
    }

    // Create default user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('aura123', salt);

    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, bio, avatar_url)
      VALUES (?, ?, ?, ?, ?)
    `);

    const userResult = insertUser.run(
      'editor',
      passwordHash,
      'Aura Editorial',
      'Chief editor and technology curator at Aura Publishing.',
      'https://api.dicebear.com/7.x/bottts/svg?seed=editor'
    );
    const authorId = userResult.lastInsertRowid;
    console.log('[Seed] Admin user created with ID:', authorId);

    // Create Sample Post 1
    const insertPost = db.prepare(`
      INSERT INTO posts (author_id, title, slug, content, summary, cover_gradient, tags, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const p1Content = `# Welcome to Aura

We are absolutely thrilled to welcome you to **Aura**, a premium blogging platform built with clean design and modern engineering details.

Aura was designed from the ground up to offer writers and readers a seamless, glassmorphic reading experience.

## Key Features

- **Markdown Editing**: Write naturally using clean, readable markdown tags.
- **Interactive Community**: Engage with creators through live comments and post likes.
- **Responsive Design**: Enjoy reading on desktop, tablet, or mobile.
- **Flexible Customization**: Toggle between dark and light themes, and personalize your profiles.

> "The art of writing is the art of discovering what you believe." — Gustave Flaubert

Thank you for joining our community of thinkers, creators, and developers!`;

    insertPost.run(
      authorId,
      'Welcome to Aura',
      'welcome-to-aura',
      p1Content,
      'Discover Aura, a premium blogging platform built with a glassmorphic aesthetic and zero-dependency database integration.',
      'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', // Cosmic
      'meta,announcement,welcome',
      'published'
    );

    // Create Sample Post 2
    const p2Content = `# The Future of Web Development

Web development is changing faster than ever. As we look ahead, several key paradigms are shifting.

## 1. Native Platform Features
Features that previously required heavy external npm dependencies (like SQLite drivers, test runners, and file watchers) are now being built directly into runtimes like Node.js and Bun. This is reducing build complexity significantly.

## 2. Server-Driven SPAs
Developers are finding the sweet spot between complex frameworks and lightweight Single Page Applications (SPAs). Serving a vanilla JS shell from a robust, secure API server is regaining massive popularity for clean, lightning-fast sites.

## 3. Modern Design Systems
Users are demanding cleaner, faster interfaces. Glassmorphism, smooth micro-transitions, and custom CSS variables are replacing heavy component libraries, giving websites a premium, lightweight, and responsive feel.

*What are your thoughts on the future of web dev? Share them in the comments below!*`;

    const p2Result = insertPost.run(
      authorId,
      'The Future of Web Development',
      'future-of-web-dev',
      p2Content,
      'Exploring native runtime features, lightweight SPA architecture, and modern CSS variables forming the future of web development.',
      'linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)', // Sunset
      'tech,coding,webdev',
      'published'
    );
    const post2Id = p2Result.lastInsertRowid;

    // Add a comment to Post 2
    const insertComment = db.prepare(`
      INSERT INTO comments (post_id, author_id, content)
      VALUES (?, ?, ?)
    `);
    insertComment.run(
      post2Id,
      authorId,
      `This is a fantastic summary! I am particularly excited about native Node SQLite features. It makes local setups so much faster.`
    );

    console.log('[Seed] Sample posts and comments seeded successfully.');
  } catch (error) {
    console.error('[Seed] Seeding error:', error);
  }
}

seed();
