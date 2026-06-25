// Aura API client library

const BASE_URL = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = getHeaders();
  
  const config = {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      // Auto logout on unauthorized
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Trigger page refresh to update header/nav
        window.dispatchEvent(new Event('auth-changed'));
      }
      throw new Error(data.error || 'Something went wrong.');
    }

    return data;
  } catch (error) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Auth
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request('/auth/me'),
  updateProfile: (profileData) => request('/auth/me', { method: 'PUT', body: JSON.stringify(profileData) }),

  // Posts
  getPosts: (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.search) query.append('search', filters.search);
    if (filters.tag) query.append('tag', filters.tag);
    if (filters.authorId) query.append('authorId', filters.authorId);
    if (filters.status) query.append('status', filters.status);
    
    const queryString = query.toString();
    return request(`/posts${queryString ? `?${queryString}` : ''}`);
  },
  getPost: (idOrSlug) => request(`/posts/${idOrSlug}`),
  createPost: (postData) => request('/posts', { method: 'POST', body: JSON.stringify(postData) }),
  updatePost: (id, postData) => request(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(postData) }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),

  // Comments & Likes
  getComments: (postId) => request(`/posts/${postId}/comments`),
  addComment: (postId, content) => request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  deleteComment: (commentId) => request(`/comments/${commentId}`, { method: 'DELETE' }),
  toggleLike: (postId) => request(`/posts/${postId}/like`, { method: 'POST' }),
};
