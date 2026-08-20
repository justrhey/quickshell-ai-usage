#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
config_home=${XDG_CONFIG_HOME:-"$HOME/.config"}
target=${1:-"$config_home/quickshell/ii"}

if ! command -v python3 >/dev/null; then
    printf 'python3 is required.\n' >&2
    exit 1
fi

if ! command -v quickshell >/dev/null; then
    printf 'Warning: quickshell was not found. Install it before loading the widget.\n' >&2
fi

install -Dm755 "$script_dir/scripts/ai_usage.py" "$target/scripts/ai_usage.py"
install -Dm644 "$script_dir/qml/AiUsageVertical.qml" "$target/modules/ii/verticalBar/AiUsageVertical.qml"

printf 'Installed into %s\n' "$target"
printf 'Add AiUsageVertical {} to modules/ii/verticalBar/VerticalBarContent.qml, then restart Quickshell.\n'
