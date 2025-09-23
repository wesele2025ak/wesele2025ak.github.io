// main.js
let captchaInFlight = null; // współdzielona obietnica


window.onCaptcha = (token) => {
  if (captchaInFlight && captchaInFlight._resolve) {
    captchaInFlight._resolve(token);
  }
};


async function ensureCaptcha() {
  return new Promise(resolve => {
    const wait = () => {
      if (window.turnstile) {
        if (!widgetId) {
          widgetId = window.turnstile.render('#cf', {
            sitekey: SITE_KEY,
            size: 'invisible',
            callback: onCaptcha
          });
        }
        resolve();
      } else setTimeout(wait, 50);
    };
    wait();
  });
}


async function getCaptchaToken() {
  await ensureCaptcha();
  if (captchaInFlight) return captchaInFlight; // ponowne użycie trwającej weryfikacji


  captchaInFlight = new Promise((resolve, reject) => {
    captchaInFlight._resolve = resolve;
    try {
      window.turnstile.reset(widgetId); // ważne przed execute
      window.turnstile.execute(widgetId);
    } catch (e) {
      captchaInFlight = null;
      reject(e);
    }
  }).finally(() => { captchaInFlight = null; });


  return captchaInFlight;
}


async function uploadOne(item, captcha) {
  const payload = JSON.stringify({
    event: EVENT,
    token: SECRET_TOKEN,
    uuid: UUID,
    captcha,
    files: [{ name: item.name, mime: item.mime, dataBase64: item.dataBase64 }]
  });


  const body = new URLSearchParams({ payload }); // x-www-form-urlencoded, bez preflight


  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { throw new Error('Bad JSON from server'); }
  if (!json.ok) throw new Error(json.error || 'upload_failed');
  return json;
}