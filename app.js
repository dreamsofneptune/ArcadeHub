// ==========================================
// 1. CONFIGURACIÓN GLOBAL DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://idtcuknleogumhoxyvbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_P9zbUZ1haG4gTOCVzECXYg_rToJc5y8';

// Cliente global accesible en todo el archivo y por el iframe
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

if (!supabase) {
  console.error('No se pudo cargar la librería de Supabase. Revisa el script CDN en tu index.html');
}

// ==========================================
// 2. SISTEMA DE PUNTUACIONES
// ==========================================

// Cargar puntuaciones en la interfaz
async function cargarPuntuacionesUI() {
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const user = session.user;

  const { data: scores, error } = await supabase
    .from('scores')
    .select('game_slug, high_score')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error al cargar puntuaciones:', error);
    return;
  }

  if (scores) {
    scores.forEach(item => {
      const el = document.getElementById(`score-${item.game_slug}`);
      if (el) {
        el.innerText = `${item.high_score} pts`;
      }
    });
  }
}

// Guardar o actualizar récord (Godot llamará a esta función)
window.guardarPuntaje = async function(gameSlug, puntos) {
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('No hay usuario logueado. No se guarda la puntuación.');
    return;
  }

  const user = session.user;

  // Consultar si ya existe un récord
  const { data: registro } = await supabase
    .from('scores')
    .select('high_score')
    .eq('user_id', user.id)
    .eq('game_slug', gameSlug)
    .maybeSingle();

  if (!registro || puntos > registro.high_score) {
    const { error } = await supabase
      .from('scores')
      .upsert({
        user_id: user.id,
        game_slug: gameSlug,
        high_score: puntos
      });

    if (error) {
      console.error('Error al guardar récord en Supabase:', error);
    } else {
      console.log(`¡Nuevo récord guardado para ${gameSlug}: ${puntos} pts!`);
      cargarPuntuacionesUI();
    }
  }
};

// ==========================================
// 3. LÓGICA DE INTERFAZ Y NAVEGACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Elementos de la interfaz
  const loginScreen = document.getElementById('login-screen');
  const catalogScreen = document.getElementById('catalog-screen');
  const loginBox = document.getElementById('login-box');
  const registerBox = document.getElementById('register-box');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const regError = document.getElementById('reg-error');

  const userDisplay = document.getElementById('user-display');
  const logoutBtn = document.getElementById('logout-btn');

  // Alternar entre Login y Registro
  document.getElementById('to-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginBox.classList.add('hidden');
    registerBox.classList.remove('hidden');
    loginError.classList.add('hidden');
  });

  document.getElementById('to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    registerBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
    regError.classList.add('hidden');
  });

  // Verificar sesión activa al iniciar
  async function checkSession() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showCatalog(session.user.email);
      cargarPuntuacionesUI();
    }
  }
  checkSession();

  // Registro en Supabase
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      regError.textContent = error.message;
      regError.classList.remove('hidden');
    } else {
      regError.classList.add('hidden');
      registerForm.reset();
      if (data.user && data.session) {
        showCatalog(data.user.email);
        cargarPuntuacionesUI();
      } else {
        alert('Registro completado. Si tienes activada la confirmación por correo, verifica tu bandeja antes de iniciar sesión.');
      }
    }
  });

  // Login en Supabase
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      loginError.textContent = 'Correo o contraseña incorrectos';
      loginError.classList.remove('hidden');
    } else {
      loginError.classList.add('hidden');
      loginForm.reset();
      showCatalog(data.user.email);
      cargarPuntuacionesUI();
    }
  });

  // Cerrar sesión
  logoutBtn?.addEventListener('click', async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    showLogin();
  });

  // Funciones de navegación
  function showCatalog(email) {
    if (userDisplay) userDisplay.textContent = email;
    loginScreen.classList.add('hidden');
    catalogScreen.classList.remove('hidden');
  }

  function showLogin() {
    catalogScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    registerBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
  }
});

// ==========================================
// 4. CONTROL DEL POPUP DEL JUEGO (IFRAME)
// ==========================================
function openGame(gameUrl) {
  const modal = document.getElementById('game-modal');
  const iframe = document.getElementById('game-iframe');
  
  iframe.src = gameUrl;
  modal.classList.remove('hidden');
}

function closeGame() {
  const modal = document.getElementById('game-modal');
  const iframe = document.getElementById('game-iframe');
  
  iframe.src = ''; 
  modal.classList.add('hidden');
}