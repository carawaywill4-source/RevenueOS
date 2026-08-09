import { BRAND } from "@/lib/brand";

function measurementId(): string | undefined {
  const site = BRAND.siteId.toUpperCase();
  return (
    process.env[`GA4_MEASUREMENT_ID_${site}`] ||
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ||
    process.env.GA4_MEASUREMENT_ID ||
    undefined
  );
}

function gscToken(): string | undefined {
  const site = BRAND.siteId.toUpperCase();
  return (
    process.env[`GSC_VERIFICATION_${site}`] ||
    process.env.GSC_VERIFICATION ||
    process.env.GOOGLE_SITE_VERIFICATION ||
    undefined
  );
}

export function BeaconScript() {
  const ga4 = measurementId();
  const gsc = gscToken();
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

    var exitShown = false;
    try { if (sessionStorage.getItem('revos_exit')) exitShown = true; } catch (_) {}
    document.addEventListener('mouseout', function(e){
      if (exitShown || !e || e.clientY > 0) return;
      exitShown = true;
      try { sessionStorage.setItem('revos_exit', '1'); } catch (_) {}
      var modal = document.createElement('div');
      modal.setAttribute('data-revos-exit','1');
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
      modal.innerHTML = '<form style="background:#fff;color:#111;max-width:360px;width:100%;padding:20px;border-radius:8px;font:14px/1.4 system-ui,sans-serif"><strong style="display:block;margin-bottom:6px">Before you go</strong><p style="margin:0 0 12px">Get one email when the next feature ships.</p><input name="email" type="email" required placeholder="you@company.com" style="width:100%;padding:8px;margin-bottom:10px;box-sizing:border-box"/><button type="submit" style="width:100%;padding:8px;background:#111;color:#fff;border:0;border-radius:6px;cursor:pointer">Notify me</button><button type="button" data-close style="width:100%;margin-top:8px;padding:6px;background:transparent;border:0;color:#666;cursor:pointer">No thanks</button></form>';
      document.body.appendChild(modal);
      modal.querySelector('[data-close]').addEventListener('click', function(){ modal.remove(); });
      modal.querySelector('form').addEventListener('submit', function(ev){
        ev.preventDefault();
        var email = (modal.querySelector('input[name=email]')||{}).value;
        if (!email) return;
        fetch('/api/exit-intent-capture', {
          method:'POST',
          headers:{'content-type':'application/json'},
          body: JSON.stringify({ email: email, siteId: 'bidbinder', source: 'exit_intent', url: location.href, referrer: document.referrer||'', ts: new Date().toISOString() })
        }).finally(function(){ modal.remove(); });
      });
    });
  } catch (e) {}
})();
`;

  return (
    <>
      {gsc ? <meta name="google-site-verification" content={gsc} /> : null}
      {ga4 ? (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', ${JSON.stringify(ga4)});`,
            }}
          />
        </>
      ) : null}
      <script dangerouslySetInnerHTML={{ __html: src }} />
    </>
  );
}
