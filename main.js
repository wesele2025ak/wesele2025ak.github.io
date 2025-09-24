// === Turnstile (explicit render + poprawne execute) ===
const SITE_KEY = '0x4AAAAAAB23OR0zpvaIh2Vj';
let widgetId = null;
let captchaInFlight = null;

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
          // renderujemy raz – na istniejącym kontenerze #cf
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
  if (captchaInFlight) return captchaInFlight; // jedna weryfikacja naraz

  const container = document.getElementById('cf');

  captchaInFlight = new Promise((resolve, reject) => {
    captchaInFlight._resolve = resolve;
    try {
      // Zawsze reset – nowy token:
      window.turnstile.reset(widgetId);
      // 🔧 KLUCZOWA ZMIANA: podajemy 2 parametry: kontener + opcje (z sitekey)
      window.turnstile.execute(container, {
        sitekey: SITE_KEY,
        action: 'upload' // opcjonalnie: nazwa akcji
      });
    } catch (e) {
      captchaInFlight = null;
      reject(e);
    }
  }).finally(() => { captchaInFlight = null; });

  return captchaInFlight;
}
