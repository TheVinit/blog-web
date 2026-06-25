import express from 'express';
import db from '../db.js';
import { authenticateToken, optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate unique slug
function generateUniqueSlug(title) {
  let base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  
  if (!base) base = 'post';

  let slug = base;
  let counter = 1;
  const checkStmt = db.prepare('SELECT id FROM posts WHERE slug = ?');

  while (checkStmt.get(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}

// GET ALL POSTS (With filtering, searching, likes/comments counters)
router.get('/', optionalAuthenticate, (req, res) => {
  const { search, tag, authorId, status } = req.query;
  const currentUserId = req.user ? req.user.id : 0;

  try {
    let sql = `
      SELECT 
        p.id, p.title, p.slug, p.content, p.summary, p.cover_gradient as coverGradient, 
        p.tags, p.status, p.created_at as createdAt, p.updated_at as updatedAt,
        p.author_id as authorId, u.username as authorUsername, 
        u.display_name as authorDisplayName, u.avatar_url as authorAvatarUrl,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as commentCount,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likeCount,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as userHasLiked
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE 1=1
    `;

    const params = [currentUserId];

    // Filter by visibility: users can see all published posts, but only their own drafts
    sql += ` AND (p.status = 'published' OR p.author_id = ?) `;
    params.push(currentUserId);

    // Apply specific status filter (e.g. dashboard listing drafts)
    if (status) {
      sql += ` AND p.status = ? `;
      params.push(status);
    }

    // Filter by specific author
    if (authorId) {
      sql += ` AND p.author_id = ? `;
      params.push(Number(authorId));
    }

    // Filter by search query (title, content, tags)
    if (search) {
      sql += ` AND (p.title LIKE ? OR p.content LIKE ? OR p.tags LIKE ?) `;
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    // Filter by tag
    if (tag) {
      sql += ` AND (',' || p.tags || ',') LIKE ? `;
      params.push(`%,${tag},%`);
    }

    // Order by newest posts first
    sql += ` ORDER BY p.created_at DESC `;

    const selectStmt = db.prepare(sql);
    const posts = selectStmt.all(...params);

    // Format tags from comma-separated string to array
    const formattedPosts = posts.map(post => {
      const tagsArr = post.tags ? post.tags.split(',').filter(Boolean) : [];
      return {
        ...post,
        tags: tagsArr,
        userHasLiked: Boolean(post.userHasLiked),
        summary: post.summary || (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content)
      };
    });

    return res.json(formattedPosts);
  } catch (error) {
    console.error('Fetch posts error:', error);
    return res.status(500).json({ error: 'Internal server error fetching posts.' });
  }
});

// GET POST BY ID OR SLUG
router.get('/:idOrSlug', optionalAuthenticate, (req, res) => {
  const { idOrSlug } = req.params;
  const currentUserId = req.user ? req.user.id : 0;

  try {
    const isId = /^\d+$/.test(idOrSlug);
    let sql = `
      SELECT 
        p.id, p.title, p.slug, p.content, p.summary, p.cover_gradient as coverGradient, 
        p.tags, p.status, p.created_at as createdAt, p.updated_at as updatedAt,
        p.author_id as authorId, u.username as authorUsername, 
        u.display_name as authorDisplayName, u.avatar_url as authorAvatarUrl,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as commentCount,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likeCount,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as userHasLiked
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE (p.id = ? OR p.slug = ?)
    `;

    const selectStmt = db.prepare(sql);
    const post = selectStmt.get(currentUserId, isId ? Number(idOrSlug) : -1, idOrSlug);

    if (!post) {
      return res.status(404).json({ error: 'Blog post not found.' });
    }

    // Access check for drafts
    if (post.status === 'draft' && post.authorId !== currentUserId) {
      return res.status(403).json({ error: 'You do not have permission to view this draft.' });
    }

    const tagsArr = post.tags ? post.tags.split(',').filter(Boolean) : [];

    return res.json({
      ...post,
      tags: tagsArr,
      userHasLiked: Boolean(post.userHasLiked),
      summary: post.summary || (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content)
    });
  } catch (error) {
    console.error('Fetch post detail error:', error);
    return res.status(500).json({ error: 'Internal server error fetching post detail.' });
  }
});

// CREATE NEW POST
router.post('/', authenticateToken, (req, res) => {
  const { title, content, summary, coverGradient, tags, status } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  try {
    const slug = generateUniqueSlug(title);
    
    // Normalize tags to comma separated string (e.g. "tech,coding,javascript")
    let normalizedTags = '';
    if (Array.isArray(tags)) {
      normalizedTags = tags.map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
    } else if (typeof tags === 'string') {
      normalizedTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
    }

    const insertStmt = db.prepare(`
      INSERT INTO posts (author_id, title, slug, content, summary, cover_gradient, tags, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      req.user.id,
      title.trim(),
      slug,
      content,
      summary ? summary.trim() : null,
      coverGradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      normalizedTags,
      status || 'published'
    );

    return res.status(201).json({
      message: 'Post created successfully!',
      post: {
        id: result.lastInsertRowid,
        title: title.trim(),
        slug,
        status: status || 'published'
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    return res.status(500).json({ error: 'Internal server error creating post.' });
  }
});

// UPDATE POST
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, content, summary, coverGradient, tags, status } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  try {
    const checkStmt = db.prepare('SELECT author_id, slug FROM posts WHERE id = ?');
    const post = checkStmt.get(Number(id));

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Authorization check
    if (post.author_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to edit this post.' });
    }

    // Normalize tags
    let normalizedTags = '';
    if (Array.isArray(tags)) {
      normalizedTags = tags.map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
    } else if (typeof tags === 'string') {
      normalizedTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
    }

    const updateStmt = db.prepare(`
      UPDATE posts
      SET title = ?, content = ?, summary = ?, cover_gradient = ?, tags = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(
      title.trim(),
      content,
      summary ? summary.trim() : null,
      coverGradient,
      normalizedTags,
      status || 'published',
      Number(id)
    );

    return res.json({
      message: 'Post updated successfully!',
      post: {
        id: Number(id),
        title: title.trim(),
        slug: post.slug
      }
    });
  } catch (error) {
    console.error('Update post error:', error);
    return res.status(500).json({ error: 'Internal server error updating post.' });
  }
});

// DELETE POST
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const checkStmt = db.prepare('SELECT author_id FROM posts WHERE id = ?');
    const post = checkStmt.get(Number(id));

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.author_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this post.' });
    }

    const deleteStmt = db.prepare('DELETE FROM posts WHERE id = ?');
    deleteStmt.run(Number(id));

    return res.json({ message: 'Post deleted successfully.' });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({ error: 'Internal server error deleting post.' });
  }
});

export default router;
