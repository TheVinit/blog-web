import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET COMMENTS FOR A POST
router.get('/posts/:postId/comments', (req, res) => {
  const { postId } = req.params;

  try {
    const commentsStmt = db.prepare(`
      SELECT 
        c.id, c.content, c.created_at as createdAt, c.post_id as postId,
        c.author_id as authorId, u.username as authorUsername, 
        u.display_name as authorDisplayName, u.avatar_url as authorAvatarUrl
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `);

    const comments = commentsStmt.all(Number(postId));
    return res.json(comments);
  } catch (error) {
    console.error('Fetch comments error:', error);
    return res.status(500).json({ error: 'Internal server error fetching comments.' });
  }
});

// POST A NEW COMMENT TO A POST
router.post('/posts/:postId/comments', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty.' });
  }

  try {
    // Check if post exists
    const postCheck = db.prepare('SELECT id FROM posts WHERE id = ?').get(Number(postId));
    if (!postCheck) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO comments (post_id, author_id, content)
      VALUES (?, ?, ?)
    `);

    const result = insertStmt.run(Number(postId), req.user.id, content.trim());
    const newCommentId = result.lastInsertRowid;

    // Return the created comment with user details
    const commentStmt = db.prepare(`
      SELECT 
        c.id, c.content, c.created_at as createdAt, c.post_id as postId,
        c.author_id as authorId, u.username as authorUsername, 
        u.display_name as authorDisplayName, u.avatar_url as authorAvatarUrl
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `);
    const comment = commentStmt.get(newCommentId);

    return res.status(201).json({
      message: 'Comment added successfully!',
      comment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({ error: 'Internal server error adding comment.' });
  }
});

// DELETE A COMMENT
router.delete('/comments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    // Get comment to check authorship
    const commentStmt = db.prepare(`
      SELECT c.author_id, c.post_id, p.author_id as postAuthorId 
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.id = ?
    `);
    const comment = commentStmt.get(Number(id));

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Comment author or Post author can delete comments
    if (comment.author_id !== req.user.id && comment.postAuthorId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment.' });
    }

    const deleteStmt = db.prepare('DELETE FROM comments WHERE id = ?');
    deleteStmt.run(Number(id));

    return res.json({ message: 'Comment deleted successfully.' });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ error: 'Internal server error deleting comment.' });
  }
});

// TOGGLE LIKE ON A POST
router.post('/posts/:postId/like', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
    // Check if post exists
    const postCheck = db.prepare('SELECT id FROM posts WHERE id = ?').get(Number(postId));
    if (!postCheck) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Check if user has liked
    const likeCheck = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(userId, Number(postId));

    let liked = false;
    if (likeCheck) {
      // Unlike
      db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(userId, Number(postId));
    } else {
      // Like
      db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(userId, Number(postId));
      liked = true;
    }

    // Get updated like count
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?');
    const { count } = countStmt.get(Number(postId));

    return res.json({
      liked,
      likeCount: count
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    return res.status(500).json({ error: 'Internal server error toggling like.' });
  }
});

export default router;
