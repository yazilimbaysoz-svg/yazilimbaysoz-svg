(function(){
  if (!/^(localhost|127\.|192\.168\.|10\.|172\.)/.test(location.hostname)) return;
  let lastSig = null;
  setInterval(async () => {
    try {
      const r = await fetch("index.html?lr=" + Date.now(), { method: "HEAD", cache: "no-store" });
      const sig = r.headers.get("last-modified") + "|" + r.headers.get("content-length");
      if (lastSig && sig !== lastSig) location.reload();
      lastSig = sig;
    } catch(e) {}
  }, 900);
})();
