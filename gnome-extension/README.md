# GNOME top-bar variant

A GNOME Shell version of the widget for desktops that run GNOME (X11 or Wayland)
instead of a Quickshell bar. It reuses the same `scripts/ai_usage.py` collector
and renders a single provider as a horizontal fill bar with the percentage inside.

- Shows one provider at a time (Codex or Claude).
- **Click the bar to switch** providers; the choice is remembered across restarts
  (stored in `$XDG_CACHE_HOME/ai-usage-provider`).
- Fill grows with usage and is color-coded: green < 70%, orange < 90%, red ≥ 90%.
- Polls once per minute via the collector, run asynchronously so it never blocks
  the shell.

Tested on GNOME Shell 46.

## Install

```sh
./gnome-extension/install.sh
```

Then reload GNOME Shell:

- **X11:** press `Alt`+`F2`, type `r`, press Enter.
- **Wayland:** log out and back in.

Enable it if it is not already:

```sh
gnome-extensions enable ai-usage@justrhey
```

## Tuning the bar

Edit `ai-usage@justrhey/extension.js`:

- `BAR_WIDTH` / `BAR_HEIGHT` — the pill size (default `84` × `22`).
- the label `font-size` (default `11px`).
- `levelColor()` — the green/orange/red thresholds and colors.

Reload the shell after editing (GNOME caches extension code, so `disable`/`enable`
alone will not pick up source changes).

## Uninstall

```sh
gnome-extensions disable ai-usage@justrhey
rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/ai-usage@justrhey"
```
