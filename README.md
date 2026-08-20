# Quickshell AI Usage

A compact vertical Quickshell widget that displays Codex or Claude usage. Click it to switch providers. It was extracted from an `illogical-impulse` sidebar and keeps that shell's `Appearance` and `StyledText` integration.

## Compatibility

- Arch Linux: supported; install Quickshell with `sudo pacman -S quickshell`.
- Ubuntu: supported; install Quickshell from the official DankLinux PPA, then install this widget.
- Python 3.9+; no third-party Python packages.
- Quickshell 0.3.x and an `illogical-impulse`-style config at `$XDG_CONFIG_HOME/quickshell/ii`.

The collector is distribution-independent. It reads Codex rate-limit events from `~/.codex/sessions` and Claude OAuth usage using `~/.claude/.credentials.json`. It never prints access tokens.

## Install

```sh
git clone https://github.com/justrhey/quickshell-ai-usage.git
cd quickshell-ai-usage
./install.sh
```

For a nonstandard config directory, pass it explicitly:

```sh
./install.sh /path/to/quickshell/config
```

Add the component inside the `ColumnLayout` in `modules/ii/verticalBar/VerticalBarContent.qml`:

```qml
AiUsageVertical {
    Layout.alignment: Qt.AlignHCenter
    Layout.fillWidth: true
    Layout.fillHeight: true
    Layout.topMargin: 8
    Layout.bottomMargin: 8
}
```

If the config is not at the default `ii` path, set `collectorPath` on the component to the installed script's absolute path.

## Ubuntu setup

```sh
sudo add-apt-repository ppa:avengemedia/danklinux
sudo apt update
sudo apt install quickshell python3
```

## Arch setup

```sh
sudo pacman -S quickshell python
```

## Test the collector

```sh
python3 scripts/ai_usage.py
python3 -m unittest discover -s tests -v
```

An unavailable account is reported as `{\"available\": false}`; that is normal when its CLI is not installed or logged in.

## Current limitations

- The QML component uses `Appearance` and `StyledText` from `illogical-impulse`; it is not yet a generic standalone shell.
- Claude usage relies on an undocumented OAuth endpoint used by Claude CLI and may change upstream.
- Usage is polled once per minute. Claude data is cached while Claude is inactive.
