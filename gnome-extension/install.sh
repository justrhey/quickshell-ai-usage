#!/usr/bin/env bash
# Install the GNOME Shell top-bar variant of the AI usage widget.
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd -- "$script_dir/.." && pwd)
uuid="ai-usage@justrhey"
ext_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid"
bin_dir="$HOME/.local/bin"

if ! command -v python3 >/dev/null; then
    printf 'python3 is required.\n' >&2
    exit 1
fi

install -Dm755 "$repo_dir/scripts/ai_usage.py" "$bin_dir/ai_usage.py"
install -Dm644 "$script_dir/$uuid/metadata.json" "$ext_dir/metadata.json"
install -Dm644 "$script_dir/$uuid/extension.js" "$ext_dir/extension.js"

printf 'Installed collector to %s\n' "$bin_dir/ai_usage.py"
printf 'Installed extension to %s\n' "$ext_dir"

if command -v gnome-extensions >/dev/null; then
    gnome-extensions enable "$uuid" 2>/dev/null || true
fi

printf 'Now reload GNOME Shell: X11 = Alt+F2 then "r"; Wayland = log out and back in.\n'
printf 'Then enable it: gnome-extensions enable %s\n' "$uuid"
