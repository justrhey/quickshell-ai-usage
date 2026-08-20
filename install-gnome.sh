#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
uuid=ai-usage@justrhey.github.io
extensions_home=${GNOME_EXTENSIONS_HOME:-"${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"}
target="$extensions_home/$uuid"

if ! command -v python3 >/dev/null; then
    printf 'python3 is required.\n' >&2
    exit 1
fi

install -Dm644 "$script_dir/gnome-extension/metadata.json" "$target/metadata.json"
install -Dm644 "$script_dir/gnome-extension/extension.js" "$target/extension.js"
install -Dm644 "$script_dir/gnome-extension/stylesheet.css" "$target/stylesheet.css"
install -Dm755 "$script_dir/scripts/ai_usage.py" "$target/scripts/ai_usage.py"

printf 'Installed GNOME extension into %s\n' "$target"
if command -v gnome-extensions >/dev/null; then
    if gnome-extensions enable "$uuid" 2>/dev/null; then
        printf 'Enabled %s\n' "$uuid"
    else
        printf 'Enable it after logging into GNOME: gnome-extensions enable %s\n' "$uuid"
    fi
else
    printf 'Log out and back in, then enable "AI Usage" with Extension Manager.\n'
fi
