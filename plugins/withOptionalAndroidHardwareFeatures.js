const { withAndroidManifest } = require('@expo/config-plugins');

const OPTIONAL_HARDWARE_FEATURES = [
  'android.hardware.camera',
  'android.hardware.camera.any',
  'android.hardware.camera.autofocus',
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.location.network',
  'android.hardware.microphone',
];

function upsertOptionalFeature(manifest, featureName) {
  const usesFeature = manifest['uses-feature'] || [];
  const existingFeature = usesFeature.find(
    (feature) => feature.$ && feature.$['android:name'] === featureName
  );

  if (existingFeature) {
    existingFeature.$['android:required'] = 'false';
  } else {
    usesFeature.push({
      $: {
        'android:name': featureName,
        'android:required': 'false',
      },
    });
  }

  manifest['uses-feature'] = usesFeature;
}

const withOptionalAndroidHardwareFeatures = (config) =>
  withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;

    OPTIONAL_HARDWARE_FEATURES.forEach((featureName) => {
      upsertOptionalFeature(manifest, featureName);
    });

    return configWithManifest;
  });

module.exports = withOptionalAndroidHardwareFeatures;
