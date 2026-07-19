/**
 * Auth — Clerk Authentication Module
 */
window.Auth = (() => {
  let clerkInstance = null;
  let currentUser = null;

  async function init() {
    try {
      // Fetch public configuration from backend
      const res = await fetch('/api/config');
      const config = await res.json();
      const publishableKey = config.clerkPublishableKey;

      if (!publishableKey) {
        console.error('Clerk Publishable Key is missing from environment variables.');
        handleAuthChange({ user: null });
        return;
      }

      // Dynamically load Clerk JS
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-clerk-publishable-key', publishableKey);
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Clerk script'));
        document.head.appendChild(script);
      });

      clerkInstance = window.Clerk;
      await clerkInstance.load();

      // Listen for auth state changes
      clerkInstance.addListener(handleAuthChange);

      // Initial state
      if (clerkInstance.user) {
        handleAuthChange({ user: clerkInstance.user });
      } else {
        handleAuthChange({ user: null });
      }
    } catch (err) {
      console.error('Clerk init failed:', err);
      // Graceful degradation: show as guest
      handleAuthChange({ user: null });
    }
  }

  function handleAuthChange(payload) {
    currentUser = payload.user || null;

    const userArea = document.getElementById('user-area');
    const guestArea = document.getElementById('guest-area');
    const userName = document.getElementById('user-name');

    if (currentUser) {
      // Logged in
      userArea.style.display = 'flex';
      guestArea.style.display = 'none';
      userName.textContent = currentUser.firstName || currentUser.username || currentUser.emailAddresses?.[0]?.emailAddress || '用户';

      // Notify app
      window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser } }));
    } else {
      // Guest
      userArea.style.display = 'none';
      guestArea.style.display = 'block';

      // Notify app
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  async function login() {
    if (!clerkInstance) return;
    try {
      await clerkInstance.openSignIn({});
    } catch (err) {
      console.error('Login failed:', err);
    }
  }

  async function logout() {
    if (!clerkInstance) return;
    try {
      await clerkInstance.signOut();
      Store.clearAll();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }

  async function getToken() {
    if (!clerkInstance || !clerkInstance.session) return null;
    try {
      const token = await clerkInstance.session.getToken();
      return token;
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  function getUser() {
    return currentUser;
  }

  return { init, login, logout, getToken, isLoggedIn, getUser };
})();
