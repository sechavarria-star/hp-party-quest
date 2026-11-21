(() => {
  'use strict';

  const config = window.HPQ_CONFIG || {};
  const storageKey = 'hpq.sessionToken.v1';
  const state = { sessionToken: localStorage.getItem(storageKey) || '', participant: null, candidate: null };
  const candidateToken = new URLSearchParams(location.search).get('candidate') || '';
  const views = [...document.querySelectorAll('.view')];
  const $ = (id) => document.getElementById(id);

  document.title = config.EVENT_NAME || "HP Kick Off '27 Quest";
  $('hero-tagline').textContent = config.EVENT_TAGLINE || 'Conectate. Explorá. Votá.';

  function show(id) {
    views.forEach((node) => { node.hidden = node.id !== id; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) button.dataset.original = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? label : (button.dataset.original || button.textContent);
  }

  function safeMessage(error) {
    return error && error.message ? error.message : 'Ocurrió un error inesperado.';
  }

  function apiReady() {
    const url = String(config.API_URL || '');
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url) && !/REEMPLAZAR|DEPLOYMENT_ID/i.test(url);
  }

  async function api(action, payload = {}) {
    if (!apiReady()) throw new Error('Falta configurar API_URL en frontend/config.js.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS || 15000);
    const body = new URLSearchParams({ action, payload: JSON.stringify(payload) });
    try {
      const response = await fetch(config.API_URL, { method: 'POST', body, redirect: 'follow', signal: controller.signal });
      if (!response.ok) throw new Error(`El backend respondió ${response.status}.`);
      const result = await response.json();
      if (!result.ok) {
        const error = new Error(result.message || 'La operación fue rechazada.');
        error.code = result.code || 'API_ERROR';
        throw error;
      }
      return result.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('La respuesta tardó demasiado. Revisá la conexión e intentá otra vez.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function frontendBaseUrl() {
    if (config.FRONTEND_URL) return config.FRONTEND_URL.replace(/[?#].*$/, '').replace(/\/?$/, '/');
    return new URL('./', location.href).href;
  }

  function candidateUrl(qrToken) {
    const url = new URL(frontendBaseUrl());
    url.searchParams.set('candidate', qrToken);
    return url.href;
  }

  function saveSession(token) {
    state.sessionToken = token;
    localStorage.setItem(storageKey, token);
  }

  function clearSession() {
    state.sessionToken = '';
    state.participant = null;
    localStorage.removeItem(storageKey);
  }

  function initials(name) {
    return String(name || 'HP').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function renderPass(participant) {
    state.participant = participant;
    $('pass-name').textContent = participant.displayName;
    $('pass-id').textContent = participant.participantId;
    const holder = $('qr-code');
    holder.innerHTML = '';
    window.HPQ_QR.draw(holder, candidateUrl(participant.qrToken), { size: 200, margin: 4 });
    show('view-pass');
  }

  async function restoreSession() {
    if (!state.sessionToken) return false;
    try {
      const data = await api('session', { sessionToken: state.sessionToken });
      state.participant = data.participant;
      return true;
    } catch (error) {
      // A temporary network failure must never discard the only identity proof.
      throw error;
    }
  }

  async function loadCandidate() {
    try {
      const data = await api('candidate', { qrToken: candidateToken });
      state.candidate = data;
      $('candidate-name').textContent = data.candidate.displayName;
      $('candidate-initials').textContent = initials(data.candidate.displayName);
      $('challenge-name').textContent = data.challenge.name;
      $('challenge-description').textContent = data.challenge.description || '';
      $('identity-note').textContent = state.participant
        ? `Vas a votar como ${state.participant.displayName}. Tenés un voto para esta consigna.`
        : 'Primero registrate para poder confirmar el voto.';
      $('vote-button').textContent = state.participant ? 'Confirmar mi voto' : 'Registrarme para votar';
      show('view-candidate');
    } catch (error) {
      fatal('QR no válido', safeMessage(error));
    }
  }

  async function boot() {
    show('view-loading');
    if (!apiReady()) {
      fatal('Configuración pendiente', 'Completá API_URL en frontend/config.js después de publicar el backend de Apps Script.');
      return;
    }
    try {
      await restoreSession();
    } catch (error) {
      fatal('No pudimos recuperar tu acceso', safeMessage(error));
      return;
    }
    if (candidateToken) return loadCandidate();
    if (state.participant) return renderPass(state.participant);
    show('view-register');
  }

  function fatal(title, message) {
    $('fatal-title').textContent = title;
    $('fatal-message').textContent = message;
    show('view-error');
  }

  $('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const errorNode = $('register-error');
    errorNode.hidden = true;
    const payload = {
      firstName: $('first-name').value.trim(),
      lastName: $('last-name').value.trim(),
      email: $('email').value.trim(),
      termsAccepted: $('terms').checked,
      registrationSource: 'GITHUB_PAGES',
      frontendBaseUrl: frontendBaseUrl()
    };
    if (!payload.firstName || !payload.lastName || !payload.email || !payload.termsAccepted) {
      errorNode.textContent = 'Completá todos los campos y aceptá el consentimiento.';
      errorNode.hidden = false;
      return;
    }
    setBusy(button, true, 'Creando tu identidad…');
    try {
      const data = await api('register', payload);
      saveSession(data.sessionToken);
      state.participant = data.participant;
      if (candidateToken) await loadCandidate(); else renderPass(data.participant);
    } catch (error) {
      errorNode.textContent = safeMessage(error);
      errorNode.hidden = false;
    } finally {
      setBusy(button, false);
    }
  });

  $('vote-button').addEventListener('click', async () => {
    if (!state.participant) { show('view-register'); return; }
    const button = $('vote-button');
    $('vote-error').hidden = true;
    setBusy(button, true, 'Guardando voto…');
    try {
      const data = await api('vote', {
        sessionToken: state.sessionToken,
        candidateQrToken: candidateToken,
        challengeId: state.candidate.challenge.challengeId
      });
      $('voted-copy').textContent = `Tu voto para ${data.candidateDisplayName} quedó registrado.`;
      show('view-voted');
    } catch (error) {
      $('vote-error').textContent = safeMessage(error);
      $('vote-error').hidden = false;
    } finally {
      setBusy(button, false);
    }
  });

  $('show-my-pass').addEventListener('click', () => state.participant ? renderPass(state.participant) : show('view-register'));
  $('voted-pass').addEventListener('click', () => renderPass(state.participant));
  $('refresh-pass').addEventListener('click', boot);
  $('retry-button').addEventListener('click', boot);

  $('download-pass').addEventListener('click', () => {
    if (!state.participant) return;
    const source = $('qr-code').querySelector('canvas');
    if (!source) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, '#102a4c'); gradient.addColorStop(1, '#081b33');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = '#f04b47'; ctx.fillRect(0, 0, 22, 1350);
    const logo = document.querySelector('img.brand-mark');
    const logoReady = logo && logo.complete && logo.naturalWidth > 0;
    if (logoReady) ctx.drawImage(logo, 90, 57, 72, 72);
    ctx.fillStyle = '#36c5f0'; ctx.font = '700 34px Segoe UI, Arial'; ctx.fillText("HP KICK OFF '27 QUEST", logoReady ? 185 : 90, 110);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 68px Segoe UI, Arial'; ctx.fillText('PLAYER PASS', 90, 190);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(220, 275, 640, 640); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 260, 315, 560, 560);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '700 54px Segoe UI, Arial'; ctx.fillText(state.participant.displayName, 540, 1035);
    ctx.fillStyle = '#36c5f0'; ctx.font = '700 32px Consolas, monospace'; ctx.fillText(state.participant.participantId, 540, 1095);
    ctx.fillStyle = '#bdd0e2'; ctx.font = '28px Segoe UI, Arial'; ctx.fillText('Mostrá este QR durante los challenges', 540, 1190);
    const link = document.createElement('a');
    link.download = `HP-Kick-Off-27-Quest-${state.participant.participantId}.png`;
    link.href = canvas.toDataURL('image/png'); link.click();
  });

  boot();
})();
