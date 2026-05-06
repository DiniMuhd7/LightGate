/**
 * Expo config plugin — Android autofill support
 *
 * Does two things:
 *  1. Explicitly marks MainActivity with android:supportsAutofill="true" so the
 *     Android autofill framework (Google Password Manager, Samsung Pass, Bitwarden,
 *     1Password, etc.) can offer to save and fill credentials in the WebView.
 *
 *  2. Sets android:allowBackup="true" on <application> so Android backs up the
 *     app's credential store and syncs it across the user's devices.
 *
 * Neither change requires additional permissions.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidAutofill(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest?.application?.[0];
    if (!app) return config;

    // ── 1. android:allowBackup on <application> ──────────────────────────
    app.$ = app.$ || {};
    app.$['android:allowBackup'] = 'true';

    // ── 2. android:supportsAutofill on MainActivity ───────────────────────
    const activities = app.activity || [];
    for (const activity of activities) {
      const name = activity?.$?.['android:name'] || '';
      if (name === '.MainActivity' || name.endsWith('.MainActivity')) {
        activity.$ = activity.$ || {};
        activity.$['android:supportsAutofill'] = 'true';
        break;
      }
    }

    return config;
  });
};
