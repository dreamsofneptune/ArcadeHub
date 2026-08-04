document.addEventListener('DOMContentLoaded', () => {
  // 1. CONFIGURACIÓN DE SUPABASE
  const SUPABASE_URL = 'https://idtcuknleogumhoxyvbx.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_P9zbUZ1haG4gTOCVzECXYg_rToJc5y8';
  
  // Usamos el cliente global expuesto por el script CDN
  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  if (!supabase) {
    console.error('No se pudo cargar la librería de Supabase. Revisa el script CDN en tu index.html');
    return;
  }

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

  // 2. VERIFICAR SESIÓN ACTIVA AL INICIAR
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showCatalog(session.user.email);
      cargarPuntuacionesUI();
    }
  }
  checkSession();

  // 3. REGISTRO EN SUPABASE
  registerForm.addEventListener('submit', async (e) => {
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
      } else {
        alert('Registro completado. Si tienes activada la confirmación por correo, verifica tu bandeja antes de iniciar sesión.');
      }
    }
  });

  // 4. LOGIN EN SUPABASE
  loginForm.addEventListener('submit', async (e) => {
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
    }
  });

  // 5. CERRAR SESIÓN
  logoutBtn?.addEventListener('click', async () => {
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

// Abrir el juego en el popup
function openGame(gameUrl) {
  const modal = document.getElementById('game-modal');
  const iframe = document.getElementById('game-iframe');
  
  iframe.src = gameUrl;
  modal.classList.remove('hidden');
}

// Cerrar el juego y detener la ejecución
function closeGame() {
  const modal = document.getElementById('game-modal');
  const iframe = document.getElementById('game-iframe');
  
  iframe.src = ''; // Limpia la URL para que el juego deje de sonar/ejecutarse de fondo
  modal.classList.add('hidden');
}

// ==========================================
// SISTEMA DE PUNTUACIONES (SUPABASE)
// ==========================================

// 1. Función para cargar y mostrar los récords en las tarjetas de los juegos
async function cargarPuntuacionesUI() {
  // Obtener el usuario autenticado actual
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Consultar todas las puntuaciones del usuario activo
  const { data: scores, error } = await supabase
    .from('scores')
    .select('game_slug, high_score')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error al cargar puntuaciones:', error);
    return;
  }

  // Actualizar el texto en cada tarjeta del catálogo
  if (scores) {
    scores.forEach(item => {
      const el = document.getElementById(`score-${item.game_slug}`);
      if (el) {
        el.innerText = `${item.high_score} pts`;
      }
    });
  }
}

// 2. Función global para guardar o actualizar el récord (Godot llamará a esta función)
window.guardarPuntaje = async function(gameSlug, puntos) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('No hay usuario logueado. No se guarda la puntuación.');
    return;
  }

  // Consultar si ya existe un récord previo para este juego
  const { data: registro } = await supabase
    .from('scores')
    .select('high_score')
    .eq('user_id', user.id)
    .eq('game_slug', gameSlug)
    .single();

  // Si no existe registro o el nuevo puntaje es superior, actualizamos en Supabase
  if (!registro || puntos > registro.high_score) {
    const { error } = await supabase
      .from('scores')
      .upsert({
        user_id: user.id,
        game_slug: gameSlug,
        high_score: puntos
      }, { onConflict: 'user_id,game_slug' });

    if (error) {
      console.error('Error al guardar récord en Supabase:', error);
    } else {
      console.log(`¡Nuevo récord guardado para ${gameSlug}: ${puntos} pts!`);
      // Refrescar la UI del catálogo
      cargarPuntuacionesUI();
    }
  }
};