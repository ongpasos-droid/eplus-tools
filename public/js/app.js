/* ═══════════════════════════════════════════════════════════════
   App — SPA Router + Global State
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  let currentUser = null;
  let currentRoute = 'dashboard';

  async function init() {
    const restored = await Auth.tryRestore();
    if (!restored) showAuth();

    window.addEventListener('auth:logout', () => onLogout());
    window.addEventListener('hashchange', () => {
      const hash = location.hash.slice(1) || 'dashboard';
      if (currentUser) navigate(hash, false);
    });
  }

  function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    showAuthTab('login');

    // Show Google fallback if SDK didn't load
    setTimeout(() => {
      const gBtn = document.querySelector('.g_id_signin');
      if (!gBtn || gBtn.children.length === 0) {
        const fb = document.getElementById('google-fallback-btn');
        if (fb) fb.classList.remove('hidden');
      }
    }, 2000);
  }

  function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    updateUserUI();
    const hash = location.hash.slice(1) || 'dashboard';
    navigate(hash, false);
  }

  function onAuth(user) {
    currentUser = user;
    showApp();
    Toast.show('Welcome, ' + user.name + '!', 'ok');
  }

  function onLogout() {
    currentUser = null;
    showAuth();
  }

  function updateUserUI() {
    if (!currentUser) return;
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-email').textContent = currentUser.email;
    const initials = currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('user-avatar').textContent = initials;
  }

  function showAuthTab(tab) {
    const loginForm = document.getElementById('form-login');
    const regForm   = document.getElementById('form-register');
    const tabLogin  = document.getElementById('tab-login');
    const tabReg    = document.getElementById('tab-register');

    if (tab === 'login') {
      loginForm.classList.remove('hidden');
      regForm.classList.add('hidden');
      tabLogin.classList.add('text-primary', 'border-secondary-fixed');
      tabLogin.classList.remove('text-on-surface-variant', 'border-transparent');
      tabReg.classList.remove('text-primary', 'border-secondary-fixed');
      tabReg.classList.add('text-on-surface-variant', 'border-transparent');
    } else {
      regForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      tabReg.classList.add('text-primary', 'border-secondary-fixed');
      tabReg.classList.remove('text-on-surface-variant', 'border-transparent');
      tabLogin.classList.remove('text-primary', 'border-secondary-fixed');
      tabLogin.classList.add('text-on-surface-variant', 'border-transparent');
    }
  }

  function navigate(route, pushHash = true) {
    currentRoute = route;
    if (pushHash) location.hash = route;

    document.querySelectorAll('#content-area .panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + route);
    if (panel) panel.classList.add('active');
    else {
      const dash = document.getElementById('panel-dashboard');
      if (dash) dash.classList.add('active');
    }

    document.querySelectorAll('.nav-link').forEach(link => {
      link.dataset.route === route ? link.classList.add('active') : link.classList.remove('active');
    });

    const titles = {
      dashboard: 'Dashboard', intake: 'Intake', calculator: 'Calculator',
      planner: 'Planner', developer: 'Developer', evaluator: 'Evaluator', partners: 'Partners'
    };
    document.getElementById('topbar-title').textContent = titles[route] || 'E+ Tools';
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }

  return { init, onAuth, onLogout, showAuthTab, navigate, toggleSidebar };
})();

/* ═══ Toast ════════════════════════════════════════════════════ */
const Toast = (() => {
  let timer = null;
  function show(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'show ' + (type || 'ok');
    clearTimeout(timer);
    timer = setTimeout(() => { el.className = '' }, 4000);
  }
  return { show };
})();

/* ═══ Boot ═════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => App.init());
