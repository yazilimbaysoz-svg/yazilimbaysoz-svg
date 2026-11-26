(function(){
  const hero = document.getElementById('anasayfa');
  const mc = document.createElement('canvas');
  mc.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0.28;z-index:1;';
  hero.insertBefore(mc, hero.firstChild);
  const ctx = mc.getContext('2d');
  const chars = '01NAZTECH{}[]<>/;=+-*#&$@01100101ENERGYSOFTWARE'.split('');
  let w, h, cols, drops;
  function setup() {
    w = mc.width = hero.offsetWidth;
    h = mc.height = hero.offsetHeight;
    cols = Math.floor(w / 18);
    drops = Array(cols).fill(1);
  }
  function render() {
    ctx.fillStyle = 'rgba(11, 12, 14, 0.08)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '14px monospace';
    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillStyle = Math.random() > 0.85 ? '#fff6d6' : '#d4af37';
      ctx.fillText(text, i * 18, drops[i] * 18);
      if (drops[i] * 18 > h && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    requestAnimationFrame(render);
  }
  window.addEventListener('resize', setup);
  setup();
  render();
})();
