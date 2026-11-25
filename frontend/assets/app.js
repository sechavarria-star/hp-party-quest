(() => {
  'use strict';

  const config = window.HPQ_CONFIG || {};
  const storageKey = 'hpq.sessionToken.v1';
  const state = { sessionToken: localStorage.getItem(storageKey) || '', participant: null, candidate: null };
  const passExport = { file: null, url: '', generation: 0 };
  const candidateToken = new URLSearchParams(location.search).get('candidate') || '';
  const views = [...document.querySelectorAll('.view')];
  const $ = (id) => document.getElementById(id);
  const selfieState = { register: { data: '', processing: false, generation: 0 }, pass: { data: '', processing: false, generation: 0 } };

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

  async function prepareSelfie(file) {
    if (!file || !file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) throw new Error('Elegí una foto de hasta 20 MB.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('No pudimos abrir esa foto. Probá con JPG o PNG.')); image.src = url; });
      for (const size of [480, 360, 240]) {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        for (const quality of [0.84, 0.7, 0.55]) {
          const data = canvas.toDataURL('image/jpeg', quality);
          if (data.length <= 160000) return data;
        }
      }
      throw new Error('La foto es demasiado grande. Volvé a tomarla.');
    } finally { URL.revokeObjectURL(url); }
  }

  function wireSelfiePicker(prefix) {
    const state = selfieState[prefix];
    const preview = $(prefix + '-selfie-preview');
    const error = $(prefix + '-selfie-error');
    const input = $(prefix + '-selfie-file');
    function clear() {
      state.generation += 1; state.data = ''; state.processing = false;
      preview.hidden = true; preview.removeAttribute('src'); input.value = '';
      $(prefix + '-selfie-remove').hidden = true;
      $(prefix + '-selfie-consent-row').hidden = true;
      $(prefix + '-selfie-consent').checked = false;
      error.hidden = true;
    }
    $(prefix + '-selfie-remove').addEventListener('click', clear);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      clear();
      if (!file) return;
      const generation = state.generation;
      state.processing = true;
      try {
        const data = await prepareSelfie(file);
        if (generation !== state.generation) return;
        state.data = data; preview.src = data; preview.hidden = false;
        $(prefix + '-selfie-remove').hidden = false;
        $(prefix + '-selfie-consent-row').hidden = false;
      } catch (e) {
        if (generation !== state.generation) return;
        error.textContent = safeMessage(e); error.hidden = false;
      } finally { if (generation === state.generation) state.processing = false; }
    });
  }
  wireSelfiePicker('register');
  wireSelfiePicker('pass');

  function renderPass(participant) {
    state.participant = participant;
    $('pass-name').textContent = participant.displayName;
    $('pass-id').textContent = participant.participantId;
    const incomplete = !participant.hasSelfie;
    $('pass-title').textContent = incomplete ? 'Completá tu selfie para participar' : '¡Ya estás participando!';
    $('pass-selfie-status').textContent = incomplete ? 'La selfie es obligatoria para votar y recibir votos. Agregala acá para habilitar tu pase.' : 'Tu selfie está guardada. Podés reemplazarla cuando quieras.';
    $('pass-selfie-section').open = incomplete;
    $('party-pass').hidden = incomplete;
    $('download-pass').hidden = incomplete;
    const holder = $('qr-code');
    holder.innerHTML = '';
    if (!incomplete) window.HPQ_QR.draw(holder, candidateUrl(participant.qrToken), { size: 200, margin: 4 });
    show('view-pass');
    preparePassImage(participant, incomplete);
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
      const data = await api('candidate', { qrToken: candidateToken, sessionToken: state.sessionToken });
      state.candidate = data;
      $('candidate-name').textContent = data.candidate.displayName;
      $('candidate-initials').textContent = initials(data.candidate.displayName);
      $('candidate-prompt').textContent = state.participant
        ? `${state.participant.firstName || state.participant.displayName}, estás por votar a`
        : 'Estás por votar a';
      const photo = $('candidate-photo');
      const hasPhoto = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(data.selfieDataUrl || '');
      photo.hidden = !hasPhoto;
      $('candidate-initials').hidden = hasPhoto;
      if (hasPhoto) { photo.src = data.selfieDataUrl; photo.alt = 'Foto de ' + data.candidate.displayName; }
      else photo.removeAttribute('src');
      $('challenge-name').textContent = data.challenge.name;
      $('challenge-description').textContent = data.challenge.description || '';
      $('identity-note').textContent = state.participant
        ? `Vas a votar como ${state.participant.displayName}. Tenés un voto para esta consigna.`
        : 'Primero registrate para ver la foto y confirmar el voto.';
      $('vote-button').textContent = state.participant ? 'Confirmar mi voto' : 'Registrarme para votar';
      $('vote-button').disabled = Boolean(state.participant && !data.candidate.hasSelfie);
      if (state.participant && !data.candidate.hasSelfie) $('identity-note').textContent = 'Esta persona todavía debe agregar su selfie para recibir votos.';
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
    const entryUrl = new URL(location.href);
    if (entryUrl.searchParams.get('volver') === '1') {
      entryUrl.searchParams.delete('volver');
      history.replaceState(null, '', entryUrl.pathname + entryUrl.search + entryUrl.hash);
      openRecovery();
      return;
    }
    try {
      await restoreSession();
    } catch (error) {
      fatal('No pudimos recuperar tu acceso', safeMessage(error));
      $('session-reset-options').hidden = error.code !== 'INVALID_SESSION';
      return;
    }
    if (state.participant && !state.participant.hasSelfie) return renderPass(state.participant);
    if (candidateToken) return loadCandidate();
    if (state.participant) return renderPass(state.participant);
    show('view-register');
  }

  function fatal(title, message) {
    $('session-reset-options').hidden = true;
    $('fatal-title').textContent = title;
    $('fatal-message').textContent = message;
    show('view-error');
  }

  function openRecovery() {
    $('recovery-email').value = '';
    $('recover-error').hidden = true;
    show('view-recover');
  }
  $('open-recovery-register').addEventListener('click', openRecovery);
  $('open-recovery-error').addEventListener('click', openRecovery);
  $('recovery-back').addEventListener('click', boot);
  $('recovery-email-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('recover-access');
    $('recover-error').hidden = true;
    setBusy(button, true, 'Abriendo tu pase…');
    try {
      const data = await api('recover', { email: $('recovery-email').value.trim() });
      saveSession(data.sessionToken);
      state.participant = data.participant;
      if (candidateToken && data.participant.hasSelfie) await loadCandidate(); else renderPass(data.participant);
    } catch (error) { $('recover-error').textContent = safeMessage(error); $('recover-error').hidden = false; }
    finally { setBusy(button, false); }
  });

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
    if (selfieState.register.processing) {
      errorNode.textContent = 'Esperá un momento mientras preparamos tu foto.'; errorNode.hidden = false; return;
    }
    payload.selfieDataUrl = selfieState.register.data;
    payload.selfieConsent = $('register-selfie-consent').checked;
    if (!payload.selfieDataUrl) {
      errorNode.textContent = 'La selfie es obligatoria. Tomá o cargá tu foto para continuar.'; errorNode.hidden = false; return;
    }
    if (payload.selfieDataUrl && !payload.selfieConsent) {
      errorNode.textContent = 'Aceptá guardar y mostrar tu selfie para continuar.'; errorNode.hidden = false; return;
    }
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

  $('save-selfie').addEventListener('click', async () => {
    const error = $('pass-selfie-error');
    error.hidden = true;
    if (selfieState.pass.processing || !selfieState.pass.data || !$('pass-selfie-consent').checked) {
      error.textContent = 'Elegí una selfie y aceptá guardarla y mostrarla antes de continuar.'; error.hidden = false; return;
    }
    const button = $('save-selfie');
    setBusy(button, true, 'Guardando selfie…');
    try {
      const data = await api('saveSelfie', { sessionToken: state.sessionToken, selfieDataUrl: selfieState.pass.data, selfieConsent: true });
      state.participant = data.participant;
      $('pass-selfie-status').textContent = 'Tu selfie está guardada.';
      if (candidateToken) await loadCandidate(); else renderPass(data.participant);
    } catch (e) { error.textContent = safeMessage(e); error.hidden = false; }
    finally { setBusy(button, false); }
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
  $('restart-registration').addEventListener('click', () => {
    // Discard only after the server rejected this credential and the user chose to.
    if ($('session-reset-options').hidden) return;
    clearSession();
    $('session-reset-options').hidden = true;
    $('register-error').hidden = true;
    show('view-register');
  });

  function buildPassCanvas(participant) {
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
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '700 54px Segoe UI, Arial'; ctx.fillText(participant.displayName, 540, 1035, 940);
    ctx.fillStyle = '#36c5f0'; ctx.font = '700 32px Consolas, monospace'; ctx.fillText(participant.participantId, 540, 1095);
    ctx.fillStyle = '#bdd0e2'; ctx.font = '28px Segoe UI, Arial'; ctx.fillText('Mostrá este QR durante los challenges', 540, 1190);
    return canvas;
  }
  async function preparePassImage(participant, incomplete) {
    const generation = ++passExport.generation;
    passExport.file = null;
    if (passExport.url) URL.revokeObjectURL(passExport.url);
    passExport.url = '';
    $('pass-image-options').hidden = true;
    $('pass-image-preview').removeAttribute('src');
    const button = $('download-pass');
    button.disabled = true; button.textContent = 'Preparando imagen…';
    if (incomplete) return;
    try {
      const logo = document.querySelector('img.brand-mark');
      if (logo && !logo.complete) await logo.decode().catch(() => {});
      if (generation !== passExport.generation) return;
      const canvas = buildPassCanvas(participant);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo preparar la imagen.')), 'image/png'));
      if (generation !== passExport.generation) return;
      passExport.file = new File([blob], 'HP-Kick-Off-27-Quest-' + participant.participantId + '.png', { type: 'image/png' });
      passExport.url = URL.createObjectURL(passExport.file);
      $('pass-image-preview').src = passExport.url;
      button.textContent = 'Guardar mi QR como foto'; button.disabled = false;
    } catch (error) {
      if (generation !== passExport.generation) return;
      button.textContent = 'Reintentar preparar imagen'; button.disabled = false;
      $('pass-image-status').textContent = safeMessage(error);
      $('pass-image-options').hidden = false;
    }
  }
  function showPassImageOptions() {
    $('pass-image-options').hidden = false;
    $('pass-image-status').textContent = 'En iPhone, mantené presionada la imagen y elegí Guardar en Fotos. En Android, elegí Descargar imagen o Guardar imagen. Si queda en Descargas, podés abrirla y moverla a Galería.';
  }
  $('download-pass').addEventListener('click', async () => {
    if (!state.participant || !state.participant.hasSelfie) return;
    if (!passExport.file) { preparePassImage(state.participant, false); return; }
    const button = $('download-pass');
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [passExport.file] })) {
        // Prepare the file before the click to preserve native share activation.
        button.disabled = true;
        await navigator.share({ files: [passExport.file], title: "Mi pase HP Kick Off '27" });
        showPassImageOptions();
        $('pass-image-status').textContent = 'Si elegiste guardar la imagen, revisá Fotos, Galería o Descargas. También podés guardar la imagen que aparece acá.';
      } else showPassImageOptions();
    } catch (error) {
      if (error.name !== 'AbortError') showPassImageOptions();
    } finally { button.disabled = false; }
  });
  $('download-pass-png').addEventListener('click', () => {
    if (!passExport.file || !passExport.url || !state.participant?.hasSelfie) return;
    const link = document.createElement('a');
    link.download = passExport.file.name; link.href = passExport.url;
    document.body.appendChild(link); link.click(); link.remove();
  });
  boot();
})();
