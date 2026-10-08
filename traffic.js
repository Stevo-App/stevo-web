// Homepage only. No IP addresses, names, URLs, or fingerprinting are collected.
(function () {
  if (!['stevoapp.com','www.stevoapp.com'].includes(location.hostname) || location.pathname !== '/') return;
  function cookie(name) { return document.cookie.split(';').map(function(x){return x.trim();}).find(function(x){return x.indexOf(name+'=')===0;})?.split('=')[1]; }
  if (cookie('stevo_traffic_off') === '1' || navigator.webdriver) return;
  try {
    var visitor = cookie('stevo_traffic_vid');
    if (!/^[0-9a-f-]{36}$/i.test(visitor || '')) {
      visitor = crypto.randomUUID();
      document.cookie = 'stevo_traffic_vid='+visitor+'; Domain=stevoapp.com; Path=/; Max-Age=7776000; Secure; SameSite=Lax';
    }
    // Refuse to count without persistent identity rather than inventing unique people.
    if (cookie('stevo_traffic_vid') !== visitor) return;
    var now = Date.now(), saved = JSON.parse(localStorage.getItem('stevo_traffic_session') || 'null');
    var session = saved && now-saved.at < 1800000 ? saved.id : crypto.randomUUID();
    localStorage.setItem('stevo_traffic_session',JSON.stringify({id:session,at:now}));
    var data = JSON.stringify({event:crypto.randomUUID(),visitor:visitor,session:session,path:'/'});
    fetch('/api/traffic',{method:'POST',body:data,headers:{'content-type':'application/json'},keepalive:true}).catch(function(){});
  } catch (_) {} // Browsers that block storage are not included.
})();
