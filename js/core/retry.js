// js/core/retry.js
;(function(){
  function rememberLevel(name){
    try {
      const file = name || (location.pathname.split('/').pop() || 'index.html');
      sessionStorage.setItem('lastLevel', file);
    } catch(_){}
  }

  function getLastLevel(fallback){
    try {
      const last = sessionStorage.getItem('lastLevel');
      if (last && /\.html$/i.test(last)) return last;
    } catch(_){}
    return fallback || 'index.html';
  }

  function wireRetry(selector = '#retryBtn', fallback){
    const btn = document.querySelector(selector);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const target = getLastLevel(fallback);
      location.href = './' + target; // 相對路徑較穩
    });
  }

  window.Retry = { rememberLevel, getLastLevel, wireRetry };
})();
