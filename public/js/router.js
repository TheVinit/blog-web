// Aura Hash-based SPA Client Router

class Router {
  constructor() {
    this.routes = [];
    
    // Resolve route when hash changes
    window.addEventListener('hashchange', () => this.resolve());
    
    // Resolve route on initial page load
    window.addEventListener('load', () => this.resolve());
  }

  // Register route path template and handler
  add(path, handler) {
    // Translate e.g., '/post/:id' to regex: ^#/post/([^/]+)$
    const regexSource = path
      .replace(/\//g, '\\/')
      .replace(/:[a-zA-Z0-9_]+/g, '([^\\/]+)');
    
    this.routes.push({
      regex: new RegExp(`^#${regexSource}$`),
      handler
    });
  }

  // Find matching route and run handler
  resolve() {
    const hash = window.location.hash || '#/';
    
    for (const route of this.routes) {
      const match = hash.match(route.regex);
      if (match) {
        const params = match.slice(1);
        // Invoke routing handler callback
        route.handler(...params);
        return;
      }
    }

    // Default route redirection on missing match
    window.location.hash = '#/';
  }

  // Force navigate programmatically
  navigate(path) {
    window.location.hash = path;
  }
}

export const router = new Router();
