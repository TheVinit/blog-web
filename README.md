# Aura | Premium Blogging Platform

Aura is a state-of-the-art, full-stack blogging platform crafted with a premium glassmorphic aesthetic, zero-dependency SQLite integration, and robust user authentication. It features a modern, single-page application (SPA) client router, markdown editing support, tag filtering, responsive design, and an interactive commenting and liking system.

---

## ✨ Features

- **Glassmorphic UI**: Beautifully designed user interface featuring blur effects, clean gradients, responsive layouts, and modern typography using *Plus Jakarta Sans* and *Inter*.
- **Full-stack SPA Architecture**: Smooth, custom hash-based SPA client router for instant page transitions.
- **Zero-Dependency Database Layer**: SQLite database integration using raw query preparation for optimal speed and portability.
- **Robust Authentication**: Token-based authentication using JSON Web Tokens (JWT) stored securely. Includes custom middleware for endpoint protection.
- **Interactive Community Features**:
  - Write and preview posts using Markdown.
  - Interactive liking system with instant visual state updates.
  - Multi-user comments section on every post.
- **Theme Customization**: Toggle between dark and light themes dynamically.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, modern Vanilla Javascript (ES6+), custom state store and SPA routing.
- **Backend**: Node.js, Express.js.
- **Database**: SQLite (managed via SQLite3/Better-SQLite3 or similar database client).
- **Security**: JWT (`jsonwebtoken`), password hashing via `bcryptjs`.
- **Styling**: Vanilla CSS, Google Fonts, and Material Symbols.

---

## 📂 Project Structure

```text
├── public/                  # Frontend static files
│   ├── css/
│   │   └── style.css        # Premium styling system
│   ├── js/
│   │   ├── api.js           # API communication layer
│   │   ├── app.js           # Main app layout, render feeds & event handlers
│   │   ├── router.js        # Hash-based SPA client-side router
│   │   └── store.js         # Centralized state management
│   └── index.html           # SPA entry point
├── server/                  # Backend Node.js service
│   ├── middleware/
│   │   └── auth.js          # Authentication middleware
│   ├── routes/
│   │   ├── auth.js          # Authentication API routes (login, register)
│   │   ├── comments.js      # Post comments API routes
│   │   └── posts.js         # Posts management & likes API routes
│   ├── db.js                # SQLite database setup & connection
│   ├── index.js             # Express server configuration
│   └── seed.js              # Database seed script for initial testing
├── .env                     # Environment variables configuration
├── package.json             # NPM package scripts & dependencies
└── database.sqlite          # SQLite database storage (auto-generated)
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm (Node Package Manager)

### Installation

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env` (a template is provided or will be created automatically):
   ```env
   PORT=3000
   JWT_SECRET=your_secure_random_jwt_secret_key_here
   ```

3. Seed the database (optional, will create the initial sample post and admin user):
   ```bash
   npm run seed
   ```
   *(Note: The server will automatically run the seed script if the database is empty).*

### Running the Application

Start the Express development server:
```bash
npm run dev
```

The application will be running at [http://localhost:3000](http://localhost:3000).

---

## 🔑 Default Credentials

A default editor account is seeded automatically:
- **Username**: `editor`
- **Password**: `aura123`

Use these credentials to log in, create new posts, edit, and interact with the platform.

---

## 📡 API Endpoints Reference

### Authentication
- `POST /api/auth/register` - Create a new user account.
- `POST /api/auth/login` - Authenticate a user and set access token.
- `POST /api/auth/logout` - Clear user session/cookie.
- `GET /api/auth/me` - Get currently authenticated user details.

### Posts
- `GET /api/posts` - Fetch list of all published posts (supports tags & searching).
- `GET /api/posts/:slug` - Fetch details of a single post by slug.
- `POST /api/posts` - Create a new post *(requires authentication)*.
- `PUT /api/posts/:id` - Edit an existing post *(requires authentication, author only)*.
- `DELETE /api/posts/:id` - Delete a post *(requires authentication, author only)*.
- `POST /api/posts/:id/like` - Like or unlike a post *(requires authentication)*.

### Comments
- `GET /api/posts/:id/comments` - Retrieve comments for a post.
- `POST /api/posts/:id/comments` - Add a comment to a post *(requires authentication)*.
- `DELETE /api/comments/:id` - Delete a comment *(requires authentication, comment author only)*.
