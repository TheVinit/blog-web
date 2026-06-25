import { api } from './api.js';
import { store } from './store.js';
import { router } from './router.js';

// --- Markdown Rendering Helper ---
function renderMarkdown(md) {
  if (!md) return '';
  
  // Temporarily pull code blocks to avoid rendering rules inside them
  const codeBlocks = [];
  let text = md.replace(/```([\s\S]*?)```/g, (match, code) => {
    const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
    codeBlocks.push(code.trim());
    return placeholder;
  });

  // Split text into paragraphs/sections
  let blocks = text.split(/\n\s*\n/);
  
  let html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    
    // Headers
    if (block.startsWith('### ')) return `<h3>${block.substring(4)}</h3>`;
    if (block.startsWith('## ')) return `<h2>${block.substring(3)}</h2>`;
    if (block.startsWith('# ')) return `<h1>${block.substring(2)}</h1>`;
    
    // Blockquote
    if (block.startsWith('> ')) {
      return `<blockquote>${block.substring(2).replace(/\n>\s*/g, '<br>')}</blockquote>`;
    }
    
    // Unordered list
    if (block.startsWith('- ') || block.startsWith('* ')) {
      const lines = block.split(/\n[-*]\s+/);
      const items = lines.map(line => `<li>${line.replace(/^[-*]\s+/, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    
    // Standard paragraph formatting
    let content = block
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\`([^`]+)\`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    
    return `<p>${content}</p>`;
  }).join('\n');

  // Put code blocks back with syntax pre tags
  codeBlocks.forEach((code, index) => {
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(`__CODE_BLOCK_PLACEHOLDER_${index}__`, `<pre><code>${escapedCode}</code></pre>`);
  });

  return html;
}

// --- Date Formatter Helper ---
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

// --- Reading Time Calculator ---
function calculateReadingTime(text) {
  const wordsPerMinute = 200;
  const words = text ? text.trim().split(/\s+/).length : 0;
  return Math.ceil(words / wordsPerMinute) || 1;
}

// --- DOM Selectors ---
const appContainer = document.getElementById('app');
const themeToggle = document.getElementById('theme-toggle');
const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.getElementById('nav-links');

// --- Global UI Controllers ---
function updateNavbar() {
  const isAuth = store.isAuthenticated();
  const user = store.getUser();

  // Handle display of authentication specific classes
  document.querySelectorAll('.auth-only').forEach(el => {
    el.style.display = isAuth ? 'inline-flex' : 'none';
  });
  
  document.querySelectorAll('.guest-only').forEach(el => {
    el.style.display = isAuth ? 'none' : 'inline-flex';
  });

  // Handle dynamic auth buttons and profile avatars
  const authBtn = document.getElementById('auth-btn');
  if (authBtn) {
    if (isAuth && user) {
      authBtn.outerHTML = `
        <div class="nav-links-profile" id="auth-btn">
          <a href="#/profile" class="nav-avatar-link">
            <img src="${user.avatarUrl}" class="avatar" alt="Avatar">
          </a>
          <button id="logout-btn" class="icon-btn" title="Sign Out">
            <span class="material-symbols-rounded">logout</span>
          </button>
        </div>
      `;
      // Re-bind logout listener
      document.getElementById('logout-btn')?.addEventListener('click', () => {
        store.clearUser();
        store.showToast('Signed out successfully.', 'info');
        router.navigate('#/');
      });
    } else {
      authBtn.outerHTML = `
        <a href="#/auth" class="nav-btn guest-only" id="auth-btn">
          <span class="material-symbols-rounded">login</span> Sign In
        </a>
      `;
    }
  }

  // Update active route highlight
  const currentHash = window.location.hash || '#/';
  document.querySelectorAll('.nav-link').forEach(link => {
    const route = link.getAttribute('href');
    if (route === currentHash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Toggle mobile menu drawer
menuToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Close mobile drawer on route click
navLinks.addEventListener('click', (e) => {
  if (e.target.closest('a') || e.target.closest('button')) {
    navLinks.classList.remove('open');
  }
});

// Theme switcher
themeToggle.addEventListener('click', () => {
  store.toggleTheme();
});

// Auth state trigger listener
window.addEventListener('auth-changed', () => {
  updateNavbar();
});

// Initial startup theme
store.initTheme();
updateNavbar();


// ==========================================
// VIEW ROUTE RENDERING ENGINE
// ==========================================

// --- 1. POSTS FEED VIEW ---
router.add('/', async () => {
  appContainer.innerHTML = `<div class="global-loader"><div class="spinner"></div></div>`;
  
  try {
    const posts = await api.getPosts();
    
    // Extract unique tags for tag cloud
    const tagSet = new Set();
    posts.forEach(p => p.tags.forEach(t => tagSet.add(t)));
    const uniqueTags = Array.from(tagSet).slice(0, 10);

    renderFeed(posts, uniqueTags);
  } catch (error) {
    appContainer.innerHTML = `
      <div class="hero-section">
        <h2 class="hero-title"><span class="gradient-text">Connection Issue</span></h2>
        <p class="hero-subtitle">${error.message}</p>
        <button class="btn-primary" onclick="window.location.reload()" style="width: auto;">Retry</button>
      </div>
    `;
  }
});

function renderFeed(posts, tags, activeTag = '', searchQuery = '') {
  appContainer.innerHTML = `
    <!-- Hero Block -->
    <section class="hero-section">
      <h1 class="hero-title">Discover <span class="gradient-text">Creative Ideas</span></h1>
      <p class="hero-subtitle">Welcome to Aura, a premium blogging platform built with clean design and modern engineering details.</p>
      
      <!-- Filter and Search Bar -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <span class="material-symbols-rounded search-icon">search</span>
          <input type="text" id="feed-search" class="search-input" placeholder="Search posts, summaries, or tags..." value="${searchQuery}">
        </div>
        
        <div class="tags-carousel">
          <span class="tag-pill ${!activeTag ? 'active' : ''}" data-tag="">All Topics</span>
          ${tags.map(t => `<span class="tag-pill ${activeTag === t ? 'active' : ''}" data-tag="${t}">#${t}</span>`).join('')}
        </div>
      </div>
    </section>

    <!-- Blog Posts Cards Grid -->
    <div class="posts-grid" id="posts-grid-container">
      ${posts.length ? posts.map(post => renderPostCard(post)).join('') : `
        <div class="comments-placeholder" style="grid-column: 1 / -1;">
          <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 0.5rem;">find_in_page</span>
          <p>No blog posts found matching your search.</p>
        </div>
      `}
    </div>
  `;

  // Bind Likes toggling inside the feed
  document.querySelectorAll('.like-trigger').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!store.isAuthenticated()) {
        store.showToast('Please sign in to like posts.', 'info');
        router.navigate('#/auth');
        return;
      }

      const postId = btn.getAttribute('data-id');
      try {
        const res = await api.toggleLike(postId);
        const icon = btn.querySelector('.material-symbols-rounded');
        const countSpan = btn.querySelector('.like-count');

        if (res.liked) {
          icon.classList.add('liked-active');
        } else {
          icon.classList.remove('liked-active');
        }
        countSpan.textContent = res.likeCount;
        store.showToast(res.liked ? 'Post liked!' : 'Post unliked', 'success');
      } catch (err) {
        store.showToast(err.message, 'error');
      }
    });
  });

  // Bind search and filter events
  const searchInput = document.getElementById('feed-search');
  
  // Real-time search-as-you-type with debouncing helper
  let debounceTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      runSearchAndFilter(e.target.value, activeTag);
    }, 400);
  });

  document.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const selectedTag = pill.getAttribute('data-tag');
      runSearchAndFilter(searchInput.value, selectedTag);
    });
  });
}

async function runSearchAndFilter(search, tag) {
  const container = document.getElementById('posts-grid-container');
  if (container) {
    container.innerHTML = `<div class="global-loader" style="grid-column:1/-1; height: 100px;"><div class="spinner"></div></div>`;
  }
  try {
    const posts = await api.getPosts({ search, tag });
    
    // Re-render feed keeping state
    const allPosts = await api.getPosts();
    const tagSet = new Set();
    allPosts.forEach(p => p.tags.forEach(t => tagSet.add(t)));
    const uniqueTags = Array.from(tagSet).slice(0, 10);
    
    renderFeed(posts, uniqueTags, tag, search);
  } catch (error) {
    store.showToast(error.message, 'error');
  }
}

function renderPostCard(post) {
  const readingTime = calculateReadingTime(post.content);
  return `
    <article class="post-card" onclick="window.location.hash = '#/post/${post.slug || post.id}'">
      <div class="card-banner" style="background: ${post.coverGradient || 'var(--accent-gradient)'}">
        <div class="card-tags">
          ${post.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
        </div>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${formatDate(post.createdAt)}</span>
          <span>•</span>
          <span>${readingTime} min read</span>
        </div>
        <h3 class="card-title">${post.title}</h3>
        <p class="card-summary">${post.summary}</p>
        
        <div class="card-footer">
          <div class="card-author">
            <img src="${post.authorAvatarUrl}" class="avatar" alt="Avatar">
            <span class="author-name">${post.authorDisplayName}</span>
          </div>
          
          <div class="card-actions">
            <button class="card-action-item icon-btn like-trigger" data-id="${post.id}" title="Like post">
              <span class="material-symbols-rounded ${post.userHasLiked ? 'liked-active' : ''}">favorite</span>
              <span class="like-count">${post.likeCount}</span>
            </button>
            <div class="card-action-item">
              <span class="material-symbols-rounded">forum</span>
              <span>${post.commentCount}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}


// --- 2. POST DETAIL VIEW ---
router.add('/post/:idOrSlug', async (idOrSlug) => {
  appContainer.innerHTML = `<div class="global-loader"><div class="spinner"></div></div>`;
  
  try {
    const post = await api.getPost(idOrSlug);
    const comments = await api.getComments(post.id);
    const currentUser = store.getUser();
    
    renderPostDetail(post, comments, currentUser);
  } catch (error) {
    appContainer.innerHTML = `
      <div class="post-detail-container" style="text-align: center; padding: 5rem 0;">
        <span class="material-symbols-rounded" style="font-size: 4rem; color: var(--text-muted);">error</span>
        <h2>Post Not Found</h2>
        <p style="color: var(--text-secondary); margin: 1rem 0 2rem 0;">${error.message}</p>
        <a href="#/" class="btn-primary" style="display: inline-flex; width: auto; padding: 0.6rem 1.5rem;">Back to Feed</a>
      </div>
    `;
  }
});

function renderPostDetail(post, comments, currentUser) {
  const readingTime = calculateReadingTime(post.content);
  const isAuthor = currentUser && currentUser.id === post.authorId;
  const renderedBody = renderMarkdown(post.content);

  appContainer.innerHTML = `
    <div class="post-detail-container">
      <header class="post-header">
        <a href="#/" class="post-back-btn">
          <span class="material-symbols-rounded">arrow_back</span> Back to feed
        </a>
        
        <div class="post-meta-details">
          <div class="card-author">
            <img src="${post.authorAvatarUrl}" class="avatar" alt="Avatar">
            <span class="author-name" style="font-size: 1rem;">${post.authorDisplayName}</span>
          </div>
          <span style="color: var(--text-muted);">|</span>
          <span style="color: var(--text-muted); font-size: 0.9rem;">${formatDate(post.createdAt)}</span>
          <span style="color: var(--text-muted);">|</span>
          <span style="color: var(--text-muted); font-size: 0.9rem;">${readingTime} min read</span>
          ${post.status === 'draft' ? `<span class="card-tag" style="background: var(--text-muted)">DRAFT</span>` : ''}
        </div>

        <h1 class="post-detail-title">${post.title}</h1>
      </header>

      <!-- Banner Image/Gradient -->
      <div class="post-detail-banner" style="background: ${post.coverGradient || 'var(--accent-gradient)'}"></div>

      <!-- Main HTML Body -->
      <article class="post-content-body">
        ${renderedBody}
      </article>

      <!-- Post Interaction Action Controls -->
      <div class="post-detail-actions">
        <div class="action-buttons">
          <button class="action-btn ${post.userHasLiked ? 'liked' : ''}" id="detail-like-btn">
            <span class="material-symbols-rounded ${post.userHasLiked ? 'liked-active' : ''}">favorite</span>
            <span id="detail-like-count">${post.likeCount}</span> Likes
          </button>
          <div class="action-btn">
            <span class="material-symbols-rounded">forum</span>
            <span>${comments.length}</span> Comments
          </div>
        </div>

        ${isAuthor ? `
          <div class="edit-actions">
            <a href="#/edit/${post.id}" class="btn-secondary">
              <span class="material-symbols-rounded" style="font-size:1.15rem;">edit</span> Edit
            </a>
            <button class="btn-danger" id="detail-delete-btn">
              <span class="material-symbols-rounded" style="font-size:1.15rem;">delete</span> Delete
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Comments Thread -->
      <section class="comments-section">
        <h3 class="comments-title">Discussion</h3>
        
        <!-- Post Comment Form -->
        <div class="comment-form">
          ${currentUser ? `
            <div class="comment-input-wrapper">
              <textarea id="comment-textarea" class="comment-textarea" placeholder="Add to the discussion... (Markdown supported)"></textarea>
            </div>
            <div class="comment-submit-row">
              <button class="btn-primary" id="comment-submit-btn" style="width: auto; padding: 0.5rem 1.5rem;">
                Comment
              </button>
            </div>
          ` : `
            <div style="text-align: center; padding: 0.5rem 0;">
              <p style="color: var(--text-secondary); margin-bottom: 0.8rem;">You must be signed in to add comments.</p>
              <a href="#/auth" class="btn-primary" style="display:inline-flex; width: auto; padding: 0.5rem 1.5rem;">Sign In</a>
            </div>
          `}
        </div>

        <!-- Comments List -->
        <div class="comment-list" id="comment-list-container">
          ${comments.length ? comments.map(c => renderCommentItem(c, currentUser, post.authorId)).join('') : `
            <div class="comments-placeholder" id="comments-empty-state">
              <span class="material-symbols-rounded" style="font-size: 2.5rem; margin-bottom: 0.5rem;">chat_bubble</span>
              <p>No comments yet. Start the conversation!</p>
            </div>
          `}
        </div>
      </section>
    </div>
  `;

  // Bind Like Button Action
  const detailLikeBtn = document.getElementById('detail-like-btn');
  detailLikeBtn.addEventListener('click', async () => {
    if (!currentUser) {
      store.showToast('Please sign in to like posts.', 'info');
      router.navigate('#/auth');
      return;
    }

    try {
      const res = await api.toggleLike(post.id);
      const icon = detailLikeBtn.querySelector('.material-symbols-rounded');
      const textSpan = document.getElementById('detail-like-count');
      
      if (res.liked) {
        detailLikeBtn.classList.add('liked');
        icon.classList.add('liked-active');
      } else {
        detailLikeBtn.classList.remove('liked');
        icon.classList.remove('liked-active');
      }
      textSpan.textContent = res.likeCount;
      store.showToast(res.liked ? 'Liked post!' : 'Unliked post', 'success');
    } catch (err) {
      store.showToast(err.message, 'error');
    }
  });

  // Bind Post Delete Button (If Author)
  if (isAuthor) {
    document.getElementById('detail-delete-btn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this blog post? This action cannot be undone.')) {
        try {
          await api.deletePost(post.id);
          store.showToast('Post deleted successfully.', 'success');
          router.navigate('#/');
        } catch (err) {
          store.showToast(err.message, 'error');
        }
      }
    });
  }

  // Bind Comment Creation Submit
  if (currentUser) {
    const commentSubmitBtn = document.getElementById('comment-submit-btn');
    const commentTextarea = document.getElementById('comment-textarea');
    
    commentSubmitBtn.addEventListener('click', async () => {
      const content = commentTextarea.value;
      if (!content.trim()) {
        store.showToast('Comment cannot be empty.', 'error');
        return;
      }

      commentSubmitBtn.disabled = true;
      try {
        const res = await api.addComment(post.id, content);
        
        // Remove empty state if present
        const emptyState = document.getElementById('comments-empty-state');
        if (emptyState) emptyState.remove();

        // Prepend or Append new comment
        const listContainer = document.getElementById('comment-list-container');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderCommentItem(res.comment, currentUser, post.authorId);
        const newItem = tempDiv.firstElementChild;
        listContainer.appendChild(newItem);
        
        // Clear input & scroll to comment
        commentTextarea.value = '';
        newItem.scrollIntoView({ behavior: 'smooth' });
        
        // Bind the new delete button inside newly created comment
        bindCommentDeleteListeners(post.authorId);
        
        store.showToast('Comment added!', 'success');
      } catch (err) {
        store.showToast(err.message, 'error');
      } finally {
        commentSubmitBtn.disabled = false;
      }
    });
  }

  // Bind Delete Comments listeners
  bindCommentDeleteListeners(post.authorId);
}

function renderCommentItem(comment, currentUser, postAuthorId) {
  const isCommentOwner = currentUser && currentUser.id === comment.authorId;
  const isPostOwner = currentUser && currentUser.id === postAuthorId;
  const showDelete = isCommentOwner || isPostOwner;

  return `
    <div class="comment-item" id="comment-${comment.id}">
      <div class="comment-avatar">
        <img src="${comment.authorAvatarUrl}" class="avatar" alt="Avatar">
      </div>
      <div class="comment-content-box">
        <div class="comment-header">
          <div class="comment-author-info">
            <span class="comment-author-name">${comment.authorDisplayName}</span>
            <span class="comment-time">${formatDate(comment.createdAt)}</span>
          </div>
          ${showDelete ? `
            <button class="comment-delete-btn" data-comment-id="${comment.id}" title="Delete comment">
              <span class="material-symbols-rounded">delete</span>
            </button>
          ` : ''}
        </div>
        <div class="comment-body">${renderMarkdown(comment.content)}</div>
      </div>
    </div>
  `;
}

function bindCommentDeleteListeners(postAuthorId) {
  document.querySelectorAll('.comment-delete-btn').forEach(btn => {
    // Prevent double binding by replacing clone
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
      const commentId = newBtn.getAttribute('data-comment-id');
      if (confirm('Delete this comment?')) {
        try {
          await api.deleteComment(commentId);
          document.getElementById(`comment-${commentId}`).remove();
          store.showToast('Comment removed.', 'success');
        } catch (err) {
          store.showToast(err.message, 'error');
        }
      }
    });
  });
}


// --- 3. WRITE / EDIT POST VIEW ---
router.add('/write', () => handleEditorView());
router.add('/edit/:id', (id) => handleEditorView(id));

async function handleEditorView(postId = null) {
  if (!store.isAuthenticated()) {
    store.showToast('Please sign in to write blog posts.', 'info');
    router.navigate('#/auth');
    return;
  }

  appContainer.innerHTML = `<div class="global-loader"><div class="spinner"></div></div>`;
  
  let postData = {
    title: '',
    content: '',
    summary: '',
    coverGradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    tags: '',
    status: 'published'
  };

  if (postId) {
    try {
      const post = await api.getPost(postId);
      const currentUser = store.getUser();
      if (post.authorId !== currentUser.id) {
        store.showToast('You are not authorized to edit this post.', 'error');
        router.navigate('#/');
        return;
      }
      postData = {
        title: post.title,
        content: post.content,
        summary: post.summary || '',
        coverGradient: post.coverGradient,
        tags: post.tags.join(', '),
        status: post.status
      };
    } catch (error) {
      store.showToast(error.message, 'error');
      router.navigate('#/');
      return;
    }
  }

  renderEditor(postData, postId);
}

function renderEditor(post, postId = null) {
  const gradients = [
    { name: 'Cosmic', css: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' },
    { name: 'Sunset', css: 'linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)' },
    { name: 'Ocean', css: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' },
    { name: 'Emerald', css: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
    { name: 'Crimson', css: 'linear-gradient(135deg, #8a2387 0%, #e94057 50%, #f27121 100%)' }
  ];

  appContainer.innerHTML = `
    <div class="editor-container">
      <header style="margin-bottom: 2rem;">
        <a href="javascript:history.back()" class="post-back-btn">
          <span class="material-symbols-rounded">arrow_back</span> Cancel
        </a>
        <h1 class="auth-title" style="text-align: left; margin-top:0.5rem;">
          ${postId ? 'Edit Blog Post' : 'Create Blog Post'}
        </h1>
      </header>

      <form id="editor-form" class="editor-layout">
        <!-- Main Editor Card -->
        <div class="editor-card">
          <input type="text" id="editor-title" class="editor-title-input" placeholder="Title your story..." value="${post.title}" required>
          <textarea id="editor-content" class="editor-textarea" placeholder="Tell your story... (Markdown supports: # headers, **bold**, *italics*, \`code\`, blockquotes)" required>${post.content}</textarea>
        </div>

        <!-- Sidebar Settings -->
        <div class="sidebar-card">
          <div>
            <label class="form-label">Excerpt / Summary</label>
            <textarea id="editor-summary" class="form-input" style="min-height: 80px; resize: vertical;" placeholder="Short summary describing your post...">${post.summary}</textarea>
          </div>

          <div>
            <label class="form-label">Cover Card Style</label>
            <div class="gradient-selector">
              ${gradients.map(g => `
                <div class="gradient-option ${post.coverGradient === g.css ? 'selected' : ''}" 
                     style="background: ${g.css}" 
                     data-gradient="${g.css}" 
                     title="${g.name}">
                </div>
              `).join('')}
            </div>
            <input type="hidden" id="editor-gradient" value="${post.coverGradient}">
          </div>

          <div>
            <label class="form-label">Tags (comma-separated)</label>
            <input type="text" id="editor-tags" class="form-input" placeholder="e.g. tech, lifestyle, coding" value="${post.tags}">
          </div>

          <div>
            <label class="form-label">Visibility Status</label>
            <select id="editor-status" class="form-input">
              <option value="published" ${post.status === 'published' ? 'selected' : ''}>Published</option>
              <option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft / Private</option>
            </select>
          </div>

          <button type="submit" class="btn-primary" id="editor-save-btn">
            <span class="material-symbols-rounded">save</span> Save Post
          </button>
        </div>
      </form>
    </div>
  `;

  // Bind Gradient Card Selector
  document.querySelectorAll('.gradient-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.gradient-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('editor-gradient').value = opt.getAttribute('data-gradient');
    });
  });

  // Bind Form Submit Action
  const form = document.getElementById('editor-form');
  const saveBtn = document.getElementById('editor-save-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('editor-title').value;
    const content = document.getElementById('editor-content').value;
    const summary = document.getElementById('editor-summary').value;
    const coverGradient = document.getElementById('editor-gradient').value;
    const tags = document.getElementById('editor-tags').value;
    const status = document.getElementById('editor-status').value;

    if (!title.trim() || !content.trim()) {
      store.showToast('Please enter both a title and content body.', 'error');
      return;
    }

    saveBtn.disabled = true;
    
    const postPayload = {
      title,
      content,
      summary,
      coverGradient,
      tags,
      status
    };

    try {
      if (postId) {
        await api.updatePost(postId, postPayload);
        store.showToast('Post updated successfully!', 'success');
      } else {
        await api.createPost(postPayload);
        store.showToast('Story published successfully!', 'success');
      }
      router.navigate('#/profile');
    } catch (err) {
      store.showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}


// --- 4. PROFILE DASHBOARD VIEW ---
router.add('/profile', () => handleProfileView());

async function handleProfileView() {
  if (!store.isAuthenticated()) {
    store.showToast('Please sign in to view your dashboard.', 'info');
    router.navigate('#/auth');
    return;
  }

  appContainer.innerHTML = `<div class="global-loader"><div class="spinner"></div></div>`;

  try {
    const user = await api.getMe();
    const posts = await api.getPosts({ authorId: user.id });
    
    // Sort into published and drafts locally
    const published = posts.filter(p => p.status === 'published');
    const drafts = posts.filter(p => p.status === 'draft');

    renderProfileDashboard(user, published, drafts);
  } catch (error) {
    store.showToast(error.message, 'error');
    router.navigate('#/');
  }
}

function renderProfileDashboard(user, published, drafts, activeTab = 'published') {
  const currentPosts = activeTab === 'published' ? published : drafts;

  appContainer.innerHTML = `
    <!-- Profile Card -->
    <div class="profile-header-card">
      <img src="${user.avatarUrl}" class="profile-avatar-large" alt="Profile Avatar">
      <div class="profile-info">
        <h1 class="profile-display-name">${user.displayName}</h1>
        <p class="profile-username-tag">@${user.username}</p>
        <p class="profile-bio">${user.bio || 'This blogger has kept their profile brief.'}</p>
      </div>
      <button class="btn-secondary profile-edit-btn" id="profile-edit-trigger">
        <span class="material-symbols-rounded" style="font-size:1.15rem;">edit</span> Edit Profile
      </button>
    </div>

    <!-- Dashboard Tabs -->
    <div class="profile-tabs">
      <span class="profile-tab ${activeTab === 'published' ? 'active' : ''}" data-tab="published">Published Posts (${published.length})</span>
      <span class="profile-tab ${activeTab === 'drafts' ? 'active' : ''}" data-tab="drafts">Drafts (${drafts.length})</span>
    </div>

    <!-- Post Listings Grid -->
    <div class="posts-grid" id="profile-posts-grid">
      ${currentPosts.length ? currentPosts.map(post => renderPostCard(post)).join('') : `
        <div class="comments-placeholder" style="grid-column: 1 / -1; padding: 4rem;">
          <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 0.5rem;">edit_note</span>
          <p>No stories here yet.</p>
          ${activeTab === 'drafts' ? '' : '<a href="#/write" class="btn-primary" style="display:inline-flex; width:auto; margin-top:1rem;">Write a Story</a>'}
        </div>
      `}
    </div>

    <!-- Edit Profile Modal Overlay -->
    <div id="profile-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Edit Profile</h3>
          <button class="icon-btn" id="profile-modal-close"><span class="material-symbols-rounded">close</span></button>
        </div>
        
        <form id="profile-edit-form">
          <div class="form-group">
            <label class="form-label">Display Name</label>
            <input type="text" id="edit-display-name" class="form-input" value="${user.displayName}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Biography</label>
            <textarea id="edit-bio" class="form-input" style="min-height: 80px; resize:vertical;">${user.bio || ''}</textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Choose Avatar</label>
            <div class="avatar-selection-grid">
              ${[1, 2, 3, 4, 5].map(i => {
                const seedUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}_seed_${i}`;
                const isSelected = user.avatarUrl === seedUrl;
                return `<img src="${seedUrl}" class="avatar-option ${isSelected ? 'selected' : ''}" data-avatar-url="${seedUrl}" alt="Avatar ${i}">`;
              }).join('')}
            </div>
            <input type="text" id="edit-avatar-url" class="form-input" placeholder="Or enter custom image URL" value="${user.avatarUrl}">
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="profile-modal-cancel">Cancel</button>
            <button type="submit" class="btn-primary" id="profile-edit-save-btn" style="width: auto;">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Bind Dashboard Tab Toggles
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const selected = tab.getAttribute('data-tab');
      renderProfileDashboard(user, published, drafts, selected);
    });
  });

  // Bind Feed click likes within profile
  document.querySelectorAll('.like-trigger').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const postId = btn.getAttribute('data-id');
      try {
        const res = await api.toggleLike(postId);
        const icon = btn.querySelector('.material-symbols-rounded');
        const countSpan = btn.querySelector('.like-count');
        if (res.liked) icon.classList.add('liked-active');
        else icon.classList.remove('liked-active');
        countSpan.textContent = res.likeCount;
        
        // Refresh underlying posts lists silently
        const posts = await api.getPosts({ authorId: user.id });
        const pub = posts.filter(p => p.status === 'published');
        const drf = posts.filter(p => p.status === 'draft');
        user.avatarUrl = store.getUser().avatarUrl;
        
        // Just show success toast
        store.showToast(res.liked ? 'Liked post!' : 'Unliked post', 'success');
      } catch (err) {
        store.showToast(err.message, 'error');
      }
    });
  });

  // Modal Open/Close Event Hooks
  const modal = document.getElementById('profile-modal');
  const editTrigger = document.getElementById('profile-edit-trigger');
  const closeBtn = document.getElementById('profile-modal-close');
  const cancelBtn = document.getElementById('profile-modal-cancel');
  
  editTrigger.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  const closeModal = () => {
    modal.style.display = 'none';
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Avatar Option Clicks
  const avatarInput = document.getElementById('edit-avatar-url');
  document.querySelectorAll('.avatar-option').forEach(avatar => {
    avatar.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('selected'));
      avatar.classList.add('selected');
      avatarInput.value = avatar.getAttribute('data-avatar-url');
    });
  });

  // Save profile changes form submit handler
  const editForm = document.getElementById('profile-edit-form');
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const displayName = document.getElementById('edit-display-name').value;
    const bio = document.getElementById('edit-bio').value;
    const avatarUrl = avatarInput.value;

    const saveBtn = document.getElementById('profile-edit-save-btn');
    saveBtn.disabled = true;

    try {
      const res = await api.updateProfile({ displayName, bio, avatarUrl });
      
      // Update store details
      const currentStoredUser = store.getUser();
      store.setUser({
        ...currentStoredUser,
        displayName: res.user.displayName,
        bio: res.user.bio,
        avatarUrl: res.user.avatarUrl
      }, store.state.token);

      closeModal();
      store.showToast('Profile updated!', 'success');
      
      // Reload profile dashboard view
      handleProfileView();
    } catch (err) {
      store.showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}


// --- 5. AUTHENTICATION (SIGN IN & SIGN UP) VIEW ---
router.add('/auth', () => {
  if (store.isAuthenticated()) {
    router.navigate('#/profile');
    return;
  }
  renderAuthCard(true); // Default to login mode
});

function renderAuthCard(isLoginMode) {
  appContainer.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h2 class="auth-title">${isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
          <p class="auth-subtitle">${isLoginMode ? 'Sign in to write and join discussions' : 'Register to start publishing articles'}</p>
        </div>

        <form id="auth-form">
          <div class="form-group">
            <label class="form-label" for="auth-username">Username</label>
            <input type="text" id="auth-username" class="form-input" placeholder="e.g. creative_mind" required minlength="3">
          </div>

          <div class="form-group">
            <label class="form-label" for="auth-password">Password</label>
            <input type="password" id="auth-password" class="form-input" placeholder="••••••••" required minlength="6">
          </div>

          ${!isLoginMode ? `
            <div class="form-group">
              <label class="form-label" for="auth-display-name">Display Name (Optional)</label>
              <input type="text" id="auth-display-name" class="form-input" placeholder="e.g. Jane Doe">
            </div>
            
            <div class="form-group">
              <label class="form-label" for="auth-bio">Bio (Optional)</label>
              <textarea id="auth-bio" class="form-input" placeholder="Write a short line about yourself..."></textarea>
            </div>
          ` : ''}

          <button type="submit" class="btn-primary" id="auth-submit-btn" style="margin-top: 1rem;">
            <span>${isLoginMode ? 'Sign In' : 'Sign Up'}</span>
            <span class="material-symbols-rounded" style="font-size:1.2rem;">arrow_forward</span>
          </button>
        </form>

        <div class="auth-footer">
          <p>
            ${isLoginMode ? "Don't have an account?" : 'Already have an account?'} 
            <span class="auth-link" id="auth-toggle-link">${isLoginMode ? 'Create one' : 'Sign in'}</span>
          </p>
        </div>
      </div>
    </div>
  `;

  // Toggle Login/Register modes
  document.getElementById('auth-toggle-link').addEventListener('click', () => {
    renderAuthCard(!isLoginMode);
  });

  // Bind Auth Form Submission
  const authForm = document.getElementById('auth-form');
  const submitBtn = document.getElementById('auth-submit-btn');

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;

    submitBtn.disabled = true;

    try {
      let res;
      if (isLoginMode) {
        res = await api.login({ username, password });
        store.showToast('Welcome back to Aura!', 'success');
      } else {
        const displayName = document.getElementById('auth-display-name').value;
        const bio = document.getElementById('auth-bio').value;
        res = await api.register({ username, password, displayName, bio });
        store.showToast('Account registered successfully!', 'success');
      }

      // Update state
      store.setUser(res.user, res.token);
      
      // Redirect to feed
      router.navigate('#/');
    } catch (err) {
      store.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
