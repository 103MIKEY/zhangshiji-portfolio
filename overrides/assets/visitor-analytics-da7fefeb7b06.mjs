const UUID = /^[a-f0-9-]{32,36}$/i;
export function pageFromHash(hash = '') {
  const clean = hash.split('?')[0];
  if (['', '#', '#top', '#about', '#works', '#strengths', '#contact'].includes(clean)) return '/';
  if (/^#\/companies(?:\/[a-z0-9-]{1,80}(?:\/software\/[a-z0-9-]{1,80})?)?$/.test(clean)) return clean.slice(1);
  return null;
}
// One instance outside React effects avoids StrictMode remounts double-counting views.
export function startAnalytics(win, endpoint) {
  const nav=win.navigator;
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl || win.location.pathname.startsWith('/delivery/admin/')) return () => {};
  let visitor, session, lastPage, lastSection, lastAt=0;
  const read=(storage,key)=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
  const write=(storage,key,value)=>{try{storage.setItem(key,JSON.stringify(value));}catch{ /* Memory-only identifiers are sufficient when storage is blocked. */ }};
  const local=()=>{try{return win.localStorage;}catch{return null;}};
  const tab=()=>{try{return win.sessionStorage;}catch{return null;}};
  const id=()=>win.crypto.randomUUID();
  const saved=read(local(),'zsj.analytics.visitor');
  visitor=saved && UUID.test(saved.id) && saved.expires>Date.now() ? saved.id : id();
  write(local(),'zsj.analytics.visitor',{id:visitor,expires:Date.now()+90*86400000});
  const referrer=()=>{try{return new URL(win.document.referrer).origin;}catch{return '';}};
  function emit(type,path) {
    const now=Date.now();
    const stored=read(tab(),'zsj.analytics.session');
    if (!session || now-session.at>1800000) session=stored && UUID.test(stored.id) && now-stored.at<1800000 ? stored : {id:id(),at:now,referrer:referrer()};
    session.at=now; write(tab(),'zsj.analytics.session',session);
    const payload={eventId:id(),visitorId:visitor,sessionId:session.id,type,path,referrer:session.referrer};
    // No cookies, retries, page URLs, query parameters or form content leave the browser.
    try { void win.fetch(endpoint,{method:'POST',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:win.AbortSignal.timeout(4000)}).catch(()=>{}); } catch { /* Statistics must never block the page. */ }
  }
  function visit() {
    if (win.document.visibilityState === 'hidden') return;
    const page=pageFromHash(win.location.hash);
    if (!page) {lastPage=null;lastSection=null;return;}
    if (page!==lastPage || Date.now()-lastAt>1800000) {emit('pageview',page);lastPage=page;lastAt=Date.now();}
    const section=page==='/' ? win.location.hash.slice(1).split('?')[0] : '';
    if (['top','about','works','strengths','contact'].includes(section) && section!==lastSection) emit('section',section);
    lastSection=section;
  }
  visit(); win.addEventListener('hashchange',visit); win.document.addEventListener('visibilitychange',visit);
  return ()=>{win.removeEventListener('hashchange',visit);win.document.removeEventListener('visibilitychange',visit);};
}

// Public Pages entry; standalone to preserve the deployed portfolio bundle.
try { startAnalytics(window, 'https://auth.mikeydusk.com/delivery/api/analytics/events'); } catch { /* Statistics must not affect the portfolio. */ }
