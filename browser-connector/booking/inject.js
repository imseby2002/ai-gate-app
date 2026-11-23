// 在「頁面環境」攔截後台自己打的 fetch / XMLHttpRequest 回應（只讀 JSON），
// 透過 window.postMessage 轉給 content script。純讀取，不改動任何請求、不送表單。
(function () {
  const TAG = 'aigate-capture';
  function post(url, body) {
    try { window.postMessage({ __aigate: TAG, url: String(url || ''), body }, '*'); } catch (e) {}
  }
  const isJsonCt = ct => !!ct && /json/i.test(ct);

  // fetch
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      return origFetch.apply(this, args).then(res => {
        try {
          const ct = res.headers && res.headers.get && res.headers.get('content-type');
          if (isJsonCt(ct)) {
            const url = (res && res.url) || (args[0] && args[0].url) || args[0];
            res.clone().json().then(b => post(url, b)).catch(() => {});
          }
        } catch (e) {}
        return res;
      });
    };
  }

  // XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__aigate_url = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        const ct = this.getResponseHeader && this.getResponseHeader('content-type');
        if (isJsonCt(ct) && typeof this.responseText === 'string' && this.responseText.length < 2_000_000) {
          post(this.__aigate_url, JSON.parse(this.responseText));
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };
})();
