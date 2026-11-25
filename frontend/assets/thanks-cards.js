(() => {
  'use strict';
  let zipLibrary;

  function imageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No pudimos preparar una de las fotos. Volvé a intentar.'));
      image.src = url;
    });
  }

  function wrapLines(ctx, text, maxWidth) {
    const lines = []; let line = '';
    for (const word of String(text).split(/\s+/)) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) { lines.push(line); line = ''; }
        for (const char of word) {
          if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = ''; }
          line += char;
        }
      } else if (line && ctx.measureText(line + ' ' + word).width > maxWidth) {
        lines.push(line); line = word;
      } else line = line ? line + ' ' + word : word;
    }
    if (line) lines.push(line);
    return lines;
  }

  async function renderCard(participant) {
    const logo = document.querySelector('img.brand-mark');
    if (!logo.complete) await logo.decode();
    if (!logo.naturalWidth) throw new Error('No se pudo cargar el logo. Actualizá la página.');
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    const background = ctx.createLinearGradient(0, 0, 1080, 1350);
    background.addColorStop(0, '#102a4c'); background.addColorStop(1, '#061427');
    ctx.fillStyle = background; ctx.fillRect(0, 0, 1080, 1350);
    // All decoration is drawn before the opaque content panel and its text.
    ctx.lineWidth = 70; ctx.strokeStyle = '#075a83';
    ctx.beginPath(); ctx.arc(1030, 10, 220, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 40; ctx.strokeStyle = '#713442';
    ctx.beginPath(); ctx.arc(-40, 1200, 120, 0, Math.PI * 2); ctx.stroke();
    ctx.drawImage(logo, 82, 43, 80, 80);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 37px "Segoe UI", Arial';
    ctx.fillText("Kick Off '27 Quest", 185, 94);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(70, 165, 940, 1115);
    ctx.fillStyle = '#0096d6'; ctx.fillRect(70, 165, 940, 10);
    ctx.textAlign = 'center'; ctx.fillStyle = '#0076a8'; ctx.font = '700 25px "Segoe UI", Arial';
    ctx.fillText("HP KICK OFF '27", 540, 228);
    ctx.fillStyle = '#081b33'; ctx.font = '800 64px "Segoe UI", Arial';
    ctx.fillText('Gracias por participar', 540, 315, 830);
    const photo = participant.selfieDataUrl;
    if (photo) {
      if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo)) throw new Error('Una foto no tiene un formato válido.');
      const image = await imageFromUrl(photo);
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 210, 365, 660, 660);
    } else {
      ctx.fillStyle = '#eaf1f7'; ctx.fillRect(210, 365, 660, 660);
      ctx.drawImage(logo, 440, 560, 200, 200);
      ctx.fillStyle = '#60728c'; ctx.font = '32px "Segoe UI", Arial';
      ctx.fillText('Selfie no disponible', 540, 825);
    }
    const name = participant.fullName || 'Nombre no disponible';
    let fontSize = 56; let lines;
    do {
      ctx.font = '700 ' + fontSize + 'px "Segoe UI", Arial';
      lines = wrapLines(ctx, name, 820);
      if (lines.length <= 3 || fontSize <= 24) break;
      fontSize -= 2;
    } while (fontSize >= 24);
    ctx.fillStyle = '#081b33';
    const lineHeight = fontSize * 1.22;
    const startY = 1150 - ((lines.length - 1) * lineHeight / 2);
    lines.forEach((line, i) => ctx.fillText(line, 540, startY + i * lineHeight));
    return canvas;
  }

  function png(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo generar una imagen.')), 'image/png'));
  }

  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!zipLibrary) zipLibrary = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/vendor/jszip-3.10.1.min.js';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => { zipLibrary = null; reject(new Error('No se pudo preparar la descarga. Volvé a intentar.')); };
      document.head.appendChild(script);
    });
    return zipLibrary;
  }

  function filename(participant, index) {
    const name = String(participant.fullName || 'Participante').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'Participante';
    const id = String(participant.participantId || index).replace(/[^a-zA-Z0-9-]/g, '');
    return String(index + 1).padStart(3, '0') + '-' + name + '-' + id + '.png';
  }

  async function archive(manifest, fetchBatch, onProgress) {
    const JSZip = await loadZip();
    const zip = new JSZip();
    let completed = 0; let missingPhotos = 0;
    for (let start = 0; start < manifest.length; start += 5) {
      const expected = manifest.slice(start, start + 5);
      const batch = await fetchBatch(expected.map(p => p.participantId));
      for (const participant of expected) {
        const item = batch.find(p => p.participantId === participant.participantId);
        if (!item) throw new Error('La lista de participantes cambió. Actualizala antes de descargar.');
        if (!item.selfieDataUrl) missingPhotos++;
        const canvas = await renderCard(item);
        zip.file(filename(item, completed), new Uint8Array(await (await png(canvas)).arrayBuffer()));
        canvas.width = 1; canvas.height = 1;
        completed++;
        onProgress(completed, manifest.length);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    return { blob, completed, missingPhotos };
  }

  window.HPQ_THANKS = Object.freeze({ renderCard, archive, filename });
})();
