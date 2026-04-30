'use strict';

(function () {
  var DEFAULT_URL = 'https://lifegate.dshub.com.ng';

  function init() {
    var frame = document.getElementById('browser-frame');
    if (!frame) return;

    // Always point to the hardcoded URL on load
    if (!frame.src || frame.src === 'about:blank') {
      frame.src = DEFAULT_URL;
    }

    // Expose for potential programmatic use, but provide no UI entry point
    window.LightGate = {
      navigate: function (url) {
        frame.src = url || DEFAULT_URL;
      },
      reset: function () {
        frame.src = DEFAULT_URL;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
