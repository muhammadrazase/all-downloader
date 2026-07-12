/* Toolbar icon → open SnapVidly with the active tab's URL.
   Uses only `activeTab` (granted on click), so no broad permissions.
   The `chrome.*` namespace also works in Firefox MV3. */
var STRIP = ['si', 'feature', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'igshid', 'igsh', 'share_app_id', 'is_from_webapp'];
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

chrome.action.onClicked.addListener(function (tab) {
  if (tab && tab.url && /^https?:/.test(tab.url)) {
    chrome.tabs.create({ url: 'https://snapvidly.com/?grab=' + encodeURIComponent(cleanUrl(tab.url)) });
  } else {
    chrome.tabs.create({ url: 'https://snapvidly.com/' });
  }
});
