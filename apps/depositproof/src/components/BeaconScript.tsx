export function BeaconScript() {
  const src = `
(function(){
  try {
    var send = function(kind, extra){
      try {
        fetch('/api/beacon', {
          method:'POST',
          keepalive:true,
          headers:{'content-type':'application/json'},
          body: JSON.stringify(Object.assign({
            kind: kind,
            url: location.href,
            path: location.pathname,
            referrer: document.referrer || undefined,
            slug: (location.pathname.match(/\\/topics\\/(.+)/)||[])[1]
          }, extra||{}))
        }).catch(function(){});
      } catch (e) {}
    };
    send('page_view');
    var scrolled = false;
    window.addEventListener('scroll', function(){
      if (!scrolled && (window.scrollY / (document.body.scrollHeight - window.innerHeight)) > 0.5) {
        scrolled = true;
        send('scroll_depth', { depth: 0.5 });
      }
    }, { passive: true });
    document.addEventListener('click', function(ev){
      var t = ev.target;
      var el = null;
      while (t && t !== document.body) {
        if (t.tagName === 'A' || t.tagName === 'BUTTON') { el = t; break; }
        t = t.parentElement;
      }
      if (!el) return;
      var text = (el.textContent||'').toLowerCase();
      var href = (el.getAttribute('href')||'').toLowerCase();
      if (text.indexOf('buy') >= 0 || text.indexOf('get ') >= 0 ||
          text.indexOf('pay') >= 0 || text.indexOf('checkout') >= 0 ||
          text.indexOf('download') >= 0 || text.indexOf('start') >= 0 ||
          href.indexOf('checkout') >= 0) {
        send('cta_click', { text: text.slice(0, 80), href: href.slice(0, 200) });
      }
    }, true);
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: src }} />;
}
