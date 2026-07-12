/* SnapVidly extension — deep-link only (no API calls, no tracking, no downloading here).
   Detects a real video page on a supported site and shows a button that opens
   https://snapvidly.com/?grab=<url>, where the site extracts + offers downloads. */
(function () {
  'use strict';
  var SITE = 'https://snapvidly.com';

  // Per-host: is the CURRENT url a downloadable video page (not a feed/home)?
  var RULES = [
    { host: /(^|\.)youtube\.com$/, video: /[?&]v=|\/shorts\/|\/live\// },
    { host: /(^|\.)youtu\.be$/, video: /\/[\w-]{6,}/ },
    { host: /(^|\.)tiktok\.com$/, video: /\/video\/\d+|\/@[\w.-]+\/video\/|\/photo\// },
    { host: /(^|\.)(vm|vt)\.tiktok\.com$/, video: /./ },
    { host: /(^|\.)instagram\.com$/, video: /\/(reel|reels|p|tv)\// },
    { host: /(^|\.)facebook\.com$/, video: /\/watch|\/videos\/|\/reel\/|story_fbid|\/share\/(v|r)\// },
    { host: /(^|\.)fb\.watch$/, video: /./ },
    { host: /(^|\.)(twitter|x)\.com$/, video: /\/status\/\d+/ },
    { host: /(^|\.)reddit\.com$/, video: /\/comments\// },
    { host: /(^|\.)redd\.it$/, video: /./ },
    { host: /(^|\.)pinterest\.[\w.]+$/, video: /\/pin\// },
    { host: /(^|\.)pin\.it$/, video: /./ },
    { host: /(^|\.)vimeo\.com$/, video: /\/\d{5,}/ },
    { host: /(^|\.)twitch\.tv$/, video: /\/clip\/|\/videos\/|clips\.twitch\.tv/ },
    { host: /(^|\.)clips\.twitch\.tv$/, video: /./ },
    { host: /(^|\.)tumblr\.com$/, video: /\/post\/|\/\d{6,}/ },
    { host: /(^|\.)linkedin\.com$/, video: /\/posts\/|\/feed\/update\// },
  ];

  function isVideoPage() {
    var h = location.hostname;
    var path = location.pathname + location.search;
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].host.test(h)) return RULES[i].video.test(path);
    }
    return false;
  }

  // Strip tracking/share params so the extracted URL is clean, fast and private.
  var STRIP = [
    'si', 'feature', 'app', 'pp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
    'utm_content', 'fbclid', 'igshid', 'igsh', '_r', 'share_app_id', 'share_link_id',
    'sender_device', 'sender_web_id', 'is_from_webapp', 'web_id', 'ref', 'ref_src', 'ref_url',
  ];
  function cleanUrl(raw) {
    try {
      var u = new URL(raw);
      STRIP.forEach(function (k) {
        u.searchParams.delete(k);
      });
      return u.toString();
    } catch (e) {
      return raw;
    }
  }

  function grab() {
    window.open(SITE + '/?grab=' + encodeURIComponent(cleanUrl(location.href)), '_blank', 'noopener');
  }

  var btn = null;
  function makeBtn() {
    var b = document.createElement('button');
    b.id = 'snapvidly-btn';
    b.type = 'button';
    b.setAttribute('aria-label', 'Download this video with SnapVidly');
    b.textContent = '⬇ SnapVidly';
    b.addEventListener('click', grab);
    return b;
  }

  function sync() {
    if (isVideoPage()) {
      if (!btn) btn = makeBtn();
      if (!btn.isConnected && document.body) document.body.appendChild(btn);
    } else if (btn && btn.isConnected) {
      btn.remove();
    }
  }

  // Initial render.
  if (document.body) sync();
  else document.addEventListener('DOMContentLoaded', sync);

  // SPA navigation: these sites change the URL without a full reload.
  var last = location.href;
  setInterval(function () {
    if (location.href !== last) {
      last = location.href;
      sync();
    }
  }, 1000);
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    if (typeof orig === 'function') {
      history[m] = function () {
        var r = orig.apply(this, arguments);
        setTimeout(sync, 300);
        return r;
      };
    }
  });
  window.addEventListener('popstate', function () {
    setTimeout(sync, 300);
  });
})();
