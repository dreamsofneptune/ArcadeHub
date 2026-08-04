// ==========================================
// 1. CONFIGURACIÓN GLOBAL DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://idtcuknleogumhoxyvbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_P9zbUZ1haG4gTOCVzECXYg_rToJc5y8';

// Usamos supabaseClient para no chocar con la variable global del CDN
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

if (!supabaseClient) {
  console.error('No se pudo cargar la librería de Supabase. Revisa el script CDN en tu index.html');
}

// ==========================================
// 2. SISTEMA DE PUNTUACIONES
// ==========================================

// Cargar puntuaciones en la interfaz
async function cargarPuntuacionesUI() {
  if (!supabaseClient) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const user = session.user;

  const { data: scores, error } = await supabaseClient
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
  if (!supabaseClient) return;

  // Asegurarnos de tener el valor de puntos como número entero
  const nuevoPuntaje = parseInt(puntos, 10);
  if (isNaN(nuevoPuntaje)) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    console.warn('No hay usuario logueado. No se guarda la puntuación.');
    return;
  }

  const user = session.user;

  // 1. Obtener el récord actual guardado en Supabase
  const { data: registro, error: searchError } = await supabaseClient
    .from('scores')
    .select('high_score')
    .eq('user_id', user.id)
    .eq('game_slug', gameSlug)
    .order('high_score', { ascending: false })
    .limit(1);

  if (searchError) {
    console.error('Error al consultar récord previo:', searchError);
    return;
  }

  // Si existen registros previa, tomamos el más alto; si no, 0
  const recordActual = (registros && registros.length > 0) ? registros[0].high_score : 0;

  // 2. Solo actualizar/guardar si el nuevo puntaje supera el récord actual
  if (registros.length === 0 || nuevoPuntaje > recordActual) {
    const { error } = await supabaseClient
      .from('scores')
      .upsert({
        user_id: user.id,
        game_slug: gameSlug,
        high_score: nuevoPuntaje
      });

    if (error) {
      console.error('Error al guardar récord en Supabase:', error);
    } else {
      console.log(`¡Nuevo récord guardado para ${gameSlug}: ${nuevoPuntaje} pts (Anterior: ${recordActual})!`);
      cargarPuntuacionesUI();
    }
  } else {
    console.log(`Puntaje obtenido (${nuevoPuntaje} pts) no supera el récord actual (${recordActual} pts). No se guarda.`);
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
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
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

    const { data, error } = await supabaseClient.auth.signUp({
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

    const { data, error } = await supabaseClient.auth.signInWithPassword({
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
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
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
  
  // Ocultamos el cuadro visualmente de inmediato para que el usuario sienta la respuesta rápida
  modal.classList.add('hidden');

  // Le damos 500ms al proceso de red para completar el guardado antes de destruir la sesión del iframe
  setTimeout(() => {
    iframe.src = ''; 
  }, 500);
}