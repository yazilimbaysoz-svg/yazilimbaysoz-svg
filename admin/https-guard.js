(function() {
  const h = window.location.hostname;
  const isLocal = (h === 'localhost' || h === '127.0.0.1' || h === '' || h.startsWith('192.168.'));
  if (!isLocal && window.location.protocol === 'http:') {
    window.location.replace('https://' + window.location.host + window.location.pathname + window.location.search + window.location.hash);
  }
})();
