// Selector de salón compartido por toda la app.
// Salones disponibles — para agregar/cambiar uno, solo edita esta lista.
(function (window) {
  const ROOMS = [
    { code: '202d', label: '202D' },
    { code: '205m', label: '205M' },
  ];

  function injectStyles() {
    if (document.getElementById('salonPickerStyles')) return;
    const style = document.createElement('style');
    style.id = 'salonPickerStyles';
    style.textContent = `
      #salonPickerOverlay{ position:fixed; inset:0; background:#0a1120; color:#eef2fb; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; font-family:'Space Grotesk',sans-serif; z-index:9999; padding:24px; text-align:center; }
      #salonPickerOverlay h2{ font-size:1.3rem; margin:0; }
      #salonPickerOverlay p{ color:#8090ac; font-size:.9rem; margin:0; max-width:360px; line-height:1.5; }
      #salonPickerOverlay .rooms{ display:flex; gap:16px; flex-wrap:wrap; justify-content:center; }
      #salonPickerOverlay button{ padding:22px 34px; border-radius:14px; border:1px solid rgba(148,180,230,.25); background:#101a2e; color:#eef2fb; font-family:'IBM Plex Mono',monospace; font-size:1.3rem; font-weight:700; cursor:pointer; min-width:140px; }
      #salonPickerOverlay button:hover{ border-color:#5eead4; color:#5eead4; }
    `;
    document.head.appendChild(style);
  }

  function showPicker(title, subtitle, onPick) {
    injectStyles();
    const overlay = document.createElement('div');
    overlay.id = 'salonPickerOverlay';
    overlay.innerHTML =
      '<h2>' + title + '</h2>' +
      '<p>' + subtitle + '</p>' +
      '<div class="rooms">' + ROOMS.map(r => '<button data-code="' + r.code + '">' + r.label + '</button>').join('') + '</div>';
    document.body.appendChild(overlay);
    overlay.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        overlay.remove();
        onPick(btn.getAttribute('data-code'));
      });
    });
  }

  window.IcesiSalon = {
    // Para pantallas de estudiante (avatar-form, index): recuerda la elección en este dispositivo,
    // así solo se pregunta una vez por celular.
    getOrPick(callback) {
      try {
        const urlSalon = new URLSearchParams(location.search).get('salon');
        if (urlSalon) {
          const code = urlSalon.toLowerCase();
          localStorage.setItem('icesiSalon', code);
          callback(code);
          return;
        }
        const saved = localStorage.getItem('icesiSalon');
        if (saved) { callback(saved.toLowerCase()); return; }
      } catch (e) {}
      showPicker('¿En qué salón estás?', 'Selecciona tu salón para continuar. Solo te lo preguntamos una vez.', (code) => {
        try { localStorage.setItem('icesiSalon', code); } catch (e) {}
        callback(code);
      });
    },
    // Para pantallas de proyector/resultados: siempre pregunta si la URL no trae ya un ?salon=.
    requireFromUrl(callback) {
      try {
        const urlSalon = new URLSearchParams(location.search).get('salon');
        if (urlSalon) { callback(urlSalon.toLowerCase()); return; }
      } catch (e) {}
      showPicker('¿Qué salón quieres ver?', 'Elige el salón para mostrar únicamente sus resultados.', (code) => {
        const url = new URL(location.href);
        url.searchParams.set('salon', code);
        location.href = url.toString();
      });
    },
  };
})(window);
