#!/bin/bash
# Install one immutable, signed release. No account settings are read or removed.
# Compatible with the system Bash 3.2 shipped by macOS.
set -e -o pipefail

VERSION='0.2.0-beta.11'
APP_ID='app.funagent.positionscope'
ARM64_ZIP_SHA256='cf61b39aeb6f30519ce5d9ccd637c4dd0e8b63dffda34c5249bcdff61a744a75'
X64_ZIP_SHA256='90baa3d9b6cfd2be56cb56443a4f54f1dacfec2083b97ebff49b534c798e85bc'

verify_only=0
direct_download=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verify-only) verify_only=1 ;;
    --direct) direct_download=1 ;;
    *) echo 'Usage: bash install-verified-mac.sh [--verify-only] [--direct]' >&2; exit 2 ;;
  esac
  shift
done
if [ "$(/usr/bin/uname -s)" != Darwin ]; then
  echo 'This installer must run on your Mac; no files were changed.' >&2
  exit 2
fi
if [ "$(/usr/bin/id -u)" -eq 0 ]; then
  echo 'Run as your normal Mac user, without sudo. Only a protected app move may request sudo.' >&2
  exit 2
fi
os_version=$(/usr/bin/sw_vers -productVersion)
if [ "${os_version%%.*}" -lt 13 ]; then
  echo 'PositionScope beta.11 requires macOS 13.0 or newer; no files were changed.' >&2
  exit 2
fi
if [ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || true)" = 1 ]; then
  architecture=arm64; expected_hash=$ARM64_ZIP_SHA256
else
  architecture=x64; expected_hash=$X64_ZIP_SHA256
fi

work=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/positionscope-install.XXXXXX")
report=$(/usr/bin/mktemp "${TMPDIR:-/tmp}/positionscope-report.XXXXXX")
stage_dir=''; backup_dir=''; install_root=''; destination=''
old_apps=(); moved_from=(); moved_to=()
new_installed=0; committed=0; replaced=0
record() { printf '%s\n' "$*" >> "$report"; }
fail() { echo "$*" >&2; exit 1; }
move_app() {
  if [ -w "$(/usr/bin/dirname "$1")" ] && [ -w "$(/usr/bin/dirname "$2")" ]; then
    /bin/mv "$1" "$2"
  else
    echo 'macOS needs your local administrator password to move the protected app.' >&2
    /usr/bin/sudo /bin/mv "$1" "$2"
  fi
}
finish() {
  status=$?
  trap - EXIT
  set +e
  if [ "$status" -ne 0 ]; then
    # Before commit, restore only apps this run moved. Never overwrite a conflict.
    if [ "$committed" -eq 0 ]; then
      if [ "$new_installed" -eq 1 ] && [ -d "$destination" ]; then
        move_app "$destination" "$backup_dir/failed-new-PositionScope.app"
      fi
      for ((i=${#moved_from[@]}-1; i>=0; i--)); do
        if [ ! -e "${moved_from[$i]}" ] && [ ! -L "${moved_from[$i]}" ]; then
          move_app "${moved_to[$i]}" "${moved_from[$i]}" || echo 'Restore the old app from the PositionScope-previous folder in Trash.' >&2
        else
          echo 'An app path is occupied; its previous copy remains in Trash.' >&2
        fi
      done
    fi
    record 'result=FAILED'
  fi
  if [ -n "$stage_dir" ]; then /bin/rm -rf "$stage_dir"; fi
  /bin/rm -rf "$work"
  echo
  /bin/cat "$report"
  printf '\nLocal report (no keys, positions or account identifiers): %s\n' "$report"
  exit "$status"
}
trap finish EXIT
record "version=$VERSION"
record "macos=$os_version"
record "architecture=$architecture"
record 'settings_read_or_deleted=NO'
record 'keychain_permission_dialog=UNVERIFIED'
record 'native_interactions=UNVERIFIED'
record 'real_accounts=NOT_TESTED'

echo "Downloading verified PositionScope $VERSION ($architecture)…"
asset="PositionScope-$VERSION-$architecture.zip"
curl_options=(--disable --fail --location --proto '=https' --tlsv1.2 --retry 2 --connect-timeout 15 --max-time 300)
if [ "$direct_download" -eq 1 ]; then
  # Applies only to this download; leave shell/system proxy configuration intact.
  curl_options+=(--noproxy '*')
  record 'download_route=DIRECT'
else
  record 'download_route=ENVIRONMENT'
fi
if /usr/bin/curl "${curl_options[@]}" \
    "https://github.com/hash-panda/positionscope/releases/download/v$VERSION/$asset" \
    --output "$work/package.zip"; then
  :
else
  download_status=$?
  if [ "$download_status" -eq 7 ] && [ "$direct_download" -eq 0 ]; then
    echo 'Connection failed. If your local proxy is stopped, restart it or rerun this script with --direct to try a direct download.' >&2
  fi
  exit "$download_status"
fi
actual_hash=$(/usr/bin/shasum -a 256 "$work/package.zip")
actual_hash=${actual_hash%% *}
[ "$actual_hash" = "$expected_hash" ] || fail 'Release checksum mismatch; the old app was not changed.'
record 'release_sha256=PASS'
/usr/bin/ditto -x -k "$work/package.zip" "$work/unpacked"

plist_value() { /usr/libexec/PlistBuddy -c "Print :$2" "$1/Contents/Info.plist" 2>/dev/null; }
verify_app() {
  [ -d "$1" ] && [ ! -L "$1" ] || fail 'The archive does not contain a normal application bundle.'
  [ "$(plist_value "$1" CFBundleIdentifier)" = "$APP_ID" ] || fail 'Unexpected application identity.'
  [ "$(plist_value "$1" CFBundleShortVersionString)" = "$VERSION" ] || fail 'Unexpected application version.'
  /usr/bin/codesign --verify --deep --strict "$1" || fail 'Application signature verification failed.'
  /usr/sbin/spctl --assess --type execute "$1" || fail 'Gatekeeper rejected this application; no bypass was attempted.'
}
source_app="$work/unpacked/PositionScope.app"
verify_app "$source_app"
record "bundle_id=$APP_ID"
record 'signature=PASS'
record 'gatekeeper=PASS'
if [ "$verify_only" -eq 1 ]; then
  record 'installation=NOT_RUN'
  record 'launch_process=NOT_RUN'
  record 'result=VERIFIED_PACKAGE_ONLY'
  exit 0
fi

# Inspect bundle metadata only. Do not inspect Application Support or Keychain.
for root in /Applications "$HOME/Applications"; do
  for app in "$root"/*.app; do
    [ -d "$app" ] && [ ! -L "$app" ] || continue
    bundle=$(plist_value "$app" CFBundleIdentifier || true)
    case "$bundle" in
      com.binance.menubar|app.funagent.positionscope) old_apps[${#old_apps[@]}]="$app" ;;
    esac
  done
done
if [ -w /Applications ]; then install_root=/Applications
else install_root="$HOME/Applications"; /bin/mkdir -p "$install_root"; fi
destination="$install_root/PositionScope.app"
if [ -e "$destination" ] || [ -L "$destination" ]; then
  found=0
  for app in "${old_apps[@]}"; do [ "$app" != "$destination" ] || found=1; done
  [ "$found" -eq 1 ] || fail 'An unrelated app occupies PositionScope.app; it was not changed.'
fi
stage_dir=$(/usr/bin/mktemp -d "$install_root/.positionscope-stage.XXXXXX")
/usr/bin/ditto "$source_app" "$stage_dir/PositionScope.app"
verify_app "$stage_dir/PositionScope.app"

app_pids() {
  executable=$(plist_value "$1" CFBundleExecutable || true)
  [ -n "$executable" ] || return 0
  /bin/ps -axww -o pid=,comm= | EXPECTED_POSITIONSCOPE_EXECUTABLE="$1/Contents/MacOS/$executable" /usr/bin/awk '
    { pid=$1; sub(/^[[:space:]]*[0-9]+[[:space:]]+/, "");
      if ($0 == ENVIRON["EXPECTED_POSITIONSCOPE_EXECUTABLE"]) print pid; }'
}
# Gracefully stop only main processes whose executable path matches a known app.
for app in "${old_apps[@]}"; do
  pids=$(app_pids "$app")
  for pid in $pids; do /bin/kill -TERM "$pid" 2>/dev/null || true; done
  for ((attempt=0; attempt<10; attempt++)); do
    [ -n "$(app_pids "$app")" ] || break
    /bin/sleep 1
  done
  [ -z "$(app_pids "$app")" ] || fail 'The old app is still running. Quit it from its menu, then run this installer again.'
done

/bin/mkdir -p "$HOME/.Trash"
backup_dir=$(/usr/bin/mktemp -d "$HOME/.Trash/PositionScope-previous.XXXXXX")
for app in "${old_apps[@]}"; do
  backup="$backup_dir/$replaced-$(/usr/bin/basename "$app")"
  move_app "$app" "$backup"
  moved_from[${#moved_from[@]}]="$app"; moved_to[${#moved_to[@]}]="$backup"
  replaced=$((replaced+1))
done
/bin/mv "$stage_dir/PositionScope.app" "$destination"
new_installed=1
verify_app "$destination"
committed=1
record "previous_apps_moved_to_trash=$replaced"
record 'installation=PASS'
echo 'The previous app copies are recoverable from the PositionScope-previous folder in Trash.'
echo 'Opening PositionScope. Handle any macOS permission prompt on this Mac.'
/usr/bin/open "$destination"
running=0
for ((attempt=0; attempt<15; attempt++)); do
  if [ -n "$(app_pids "$destination")" ]; then running=1; break; fi
  /bin/sleep 1
done
if [ "$running" -eq 1 ]; then
  # Observe briefly so an immediate startup crash does not count as success.
  /bin/sleep 3
  [ -n "$(app_pids "$destination")" ] || fail 'The application exited shortly after launch.'
  record 'launch_process=PASS'
else
  fail 'The app process was not observed. Check the local macOS prompt and menu bar; then reopen the installed app.'
fi
record 'result=INSTALLED_PROCESS_OBSERVED'
echo 'Installation and process checks passed. Menu-bar interaction, Keychain permission and real-account correctness still require local verification.'
