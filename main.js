const qs = new URLSearchParams(location.search);
const EVENT = qs.get('event') || 'WESELE2025';
const SECRET_TOKEN = qs.get('token') || '2UJVIiEFeZGt1wpOB9aLVUhVjGwD8IF1vdtW4aI6Br6bJM1mO5JqiwR2ex4uBmsk';
const UPLOAD_URL = 'https://wesele-worker.wesele2025ak.workers.dev/';
const SITE_KEY = '0x4AAAAAAB23OR0zpvaIh2Vj';


function getUUID() { const k = 'photoDropUUID'; let v = localStorage.getItem(k); if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); } return v; }
const UUID = getUUID();


document.getElementById('eventInfo').textContent = `Wydarzenie: ${EVENT}`;


const input = document.getElementById('file');
const shootBtn = document.getElementById('shoot');
const sendBtn = document.getElementById('send');
const clearBtn = document.getElementById('clear');
const preview = document.getElementById('preview');
const prog = document.getElementById('prog');
const statusEl = document.getElementById('status');


let queue = [];
let _sending = false;

shootBtn.onclick = () => input.click();
input.onchange = async (e) => {
  const files = Array.from(e.target.files || []);
  for (const f of files) {
    const resized = await compressImageFile(f, 1920, 0.85);
    queue.push(resized);
    addThumb(resized.objectURL);
  }
};

clearBtn.onclick = () => { queue = []; preview.innerHTML = ''; prog.value = 0; status('Kolejka wyczyszczona'); };


sendBtn.onclick = async () => {
  if (_sending) return;
  if (!queue.length) return status('Brak zdjęć w kolejce');


  _sending = true; sendBtn.disabled = true;
  try {
    status('Weryfikacja...');
    const captcha = await getCaptchaToken();


    prog.classList.remove('hidden');
    let sent = 0;
    for (const item of queue) {
      await uploadOneViaForm(item, captcha);
      sent++;
      prog.value = Math.round(100 * sent / queue.length);
    }
    status('Wysłano ' + sent + ' zdjęć ✅');
    queue = []; preview.innerHTML = '';
  } catch (e) {
    console.error(e);
    status('Błąd wysyłki: ' + (e.message || e));
  } finally {
    _sending = false; sendBtn.disabled = false;
  }
};

function status(t) { statusEl.textContent = t; }
function addThumb(url) { const d = document.createElement('div'); d.className = 'thumb'; const img = document.createElement('img'); img.src = url; d.appendChild(img); preview.appendChild(d); }


async function compressImageFile(file, maxDim = 1920, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.round(width * scale), h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const objectURL = URL.createObjectURL(blob);
  return { name: file.name.replace(/\.[^.]+$/, '.jpg'), mime: 'image/jpeg', dataBase64: base64, objectURL };
}

let widgetId = null;
let captchaPromise = null;
let _resolveCaptcha = null;


function onCaptcha(token) {
  if (_resolveCaptcha) { _resolveCaptcha(token); _resolveCaptcha = null; captchaPromise = null; }
}


async function ensureCaptcha() {
  return new Promise(resolve => {
    const wait = () => {
      if (window.turnstile) {
        if (!widgetId) {
          widgetId = window.turnstile.render('#cf', { sitekey: SITE_KEY, size: 'invisible', callback: onCaptcha });
        }
        resolve();
      } else setTimeout(wait, 50);
    };
    wait();
  });
}

async function getCaptchaToken() {
  await ensureCaptcha();
  if (captchaPromise) return captchaPromise;


  const container = document.getElementById('cf');
  captchaPromise = new Promise((resolve, reject) => {
    _resolveCaptcha = resolve;
    try {
      window.turnstile.reset(widgetId);
      window.turnstile.execute(container, { sitekey: SITE_KEY, action: 'upload' });
    } catch (e) { _resolveCaptcha = null; captchaPromise = null; reject(e); }
  });
  return captchaPromise;
}

function ensureIframe() {
  let iframe = document.getElementById('upload_iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.name = 'upload_iframe';
    iframe.id = 'upload_iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }
  return iframe;
}

function uploadOneViaForm(item, captcha) {
  return new Promise((resolve, reject) => {
    const iframe = ensureIframe();


    const form = document.createElement('form');
    form.method = 'POST';
    form.action = UPLOAD_URL;
    form.target = 'upload_iframe';
    form.enctype = 'multipart/form-data';
    form.style.display = 'none';


    const payload = {
      event: EVENT,
      token: SECRET_TOKEN,
      uuid: UUID,
      captcha,
      files: [{ name: item.name, mime: item.mime, dataBase64: item.dataBase64 }]
    };


    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(payload);
    form.appendChild(input);


    document.body.appendChild(form);


    const onload = () => {
      iframe.removeEventListener('load', onload);
      form.remove();
      resolve();
    };
    iframe.addEventListener('load', onload, { once: true });


    try { form.submit(); }
    catch (e) {
      iframe.removeEventListener('load', onload);
      form.remove();
      reject(e);
    }
  });
}