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
      await uploadOne(item, captcha);
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

async function uploadOne(item, captcha) {
  const payload = JSON.stringify({
    event: EVENT,
    token: SECRET_TOKEN,
    uuid: UUID,
    captcha,
    files: [{ name: item.name, mime: item.mime, dataBase64: item.dataBase64 }]
  });

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ payload })
  });

  const txt = await res.text();
  console.log('Server response:', txt);
  let json;
  try { json = JSON.parse(txt); }
  catch { throw new Error('Bad JSON from server: ' + txt); }

  if (!json.ok) throw new Error(json.error || 'upload_failed');
  return json;
}
