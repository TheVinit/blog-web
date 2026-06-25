// Aura Global State & Toast Notification Store

class Store {
  constructor() {
    this.state = {
      user: JSON.parse(localStorage.getItem('user')) || null,
      token: localStorage.getItem('token') || null,
      theme: localStorage.getItem('theme') || 'dark',
    };
  }

  // Authentication Management
  setUser(user, token) {
    this.state.user = user;
    this.state.token = token;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    window.dispatchEvent(new Event('auth-changed'));
  }

  clearUser() {
    this.state.user = null;
    this.state.token = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('auth-changed'));
  }

  isAuthenticated() {
    return !!this.state.token;
  }

  getUser() {
    return this.state.user;
  }

  // Theme Management
  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update theme toggle icon
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  }

  toggleTheme() {
    const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  // Beautiful Toast Notifications
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'warning';

    toast.innerHTML = `
      <span class="material-symbols-rounded">${icon}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger reflow to initiate transition
    toast.offsetHeight;
    toast.classList.add('show');

    // Remove toast after duration
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    }, 3000);
  }
}

export const store = new Store();
