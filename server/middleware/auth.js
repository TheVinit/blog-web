import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'aura_blog_secret_key_2026_premium_jwt_auth_token_987654';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  // Backup: Check cookies if header is missing
  if (!token && req.headers.cookie) {
    const cookieToken = req.headers.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
    if (cookieToken) token = cookieToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired or invalid. Please sign in again.' });
    }
    req.user = user;
    next();
  });
}

// Optional authentication middleware to populate req.user if token is present
export function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  if (!token && req.headers.cookie) {
    const cookieToken = req.headers.cookie
      .split('; ')
      .find(row => row.startsWith('token='))
      ?.split('=')[1];
    if (cookieToken) token = cookieToken;
  }

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    }
    next();
  });
}
