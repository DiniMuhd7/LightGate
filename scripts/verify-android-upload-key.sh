#!/usr/bin/env bash
set -euo pipefail

EXPECTED_SHA1="06:C3:63:B2:B6:43:F7:2F:69:35:F4:DF:3F:48:FC:7B:41:2B:36:2C"
KEYSTORE_PATH="${1:-android/keystores/lifegate-upload-key.jks}"
KEY_ALIAS="${2:-${ANDROID_KEY_ALIAS:-}}"

if [[ ! -f "$KEYSTORE_PATH" ]]; then
  echo "Keystore not found: $KEYSTORE_PATH" >&2
  exit 1
fi

if [[ -z "$KEY_ALIAS" ]]; then
  echo "Usage: $0 <keystore-path> <key-alias>" >&2
  echo "Or set ANDROID_KEY_ALIAS and pass only the keystore path." >&2
  exit 1
fi

actual_sha1=$(keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" 2>/dev/null \
  | awk -F': ' '/SHA1:/ {print $2; exit}')

if [[ -z "$actual_sha1" ]]; then
  echo "Could not read SHA1 fingerprint for alias '$KEY_ALIAS'." >&2
  exit 1
fi

if [[ "$actual_sha1" != "$EXPECTED_SHA1" ]]; then
  echo "Wrong upload key certificate SHA1." >&2
  echo "Expected: $EXPECTED_SHA1" >&2
  echo "Actual:   $actual_sha1" >&2
  exit 1
fi

echo "Upload key certificate SHA1 matches: $actual_sha1"
