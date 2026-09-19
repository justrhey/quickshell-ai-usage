import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const COLLECTOR = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'ai_usage.py']);
const STATE_FILE = GLib.build_filenamev([GLib.get_user_cache_dir(), 'ai-usage-provider']);
const INTERVAL_SECONDS = 60;
const BAR_WIDTH = 84;
const BAR_HEIGHT = 22;

const PROVIDER_ORDER = ['codex', 'claude', 'opencode'];
const PROVIDERS = {
    codex: {name: 'Codex', icon: 'codex-symbolic.svg'},
    claude: {name: 'Claude', icon: 'claude-symbolic.svg'},
    opencode: {name: 'OpenCode', icon: 'opencode-symbolic.svg'},
};

function roundRect(cr, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    cr.newSubPath();
    cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    cr.closePath();
}

// green -> orange -> red as usage climbs
function levelColor(frac) {
    if (frac < 0.7)
        return [0.30, 0.69, 0.31];
    if (frac < 0.9)
        return [1.00, 0.58, 0.00];
    return [0.90, 0.27, 0.22];
}

const AiUsageIndicator = GObject.registerClass(
class AiUsageIndicator extends PanelMenu.Button {
    _init(extensionPath) {
        super._init(0.0, 'AI Usage', false);

        this._provider = this._loadProvider();
        this._data = {};
        this._frac = 0;
        this._color = levelColor(0);
        this._icons = {};
        for (const [key, provider] of Object.entries(PROVIDERS)) {
            const file = Gio.File.new_for_path(GLib.build_filenamev([
                extensionPath, 'icons', provider.icon,
            ]));
            this._icons[key] = new Gio.FileIcon({file});
        }

        this._area = new St.DrawingArea({
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._area.connect('repaint', this._onRepaint.bind(this));

        this._icon = new St.Icon({
            gicon: this._icons[this._provider],
            icon_size: 13,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'color: white;',
        });

        this._label = new St.Label({
            text: '…',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: 11px; font-weight: bold; color: white;',
        });

        const overlay = new St.BoxLayout({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 4px;',
        });
        overlay.add_child(this._icon);
        overlay.add_child(this._label);

        const box = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin: 0 4px;',
        });
        box.add_child(this._area);
        box.add_child(overlay);
        this.add_child(box);

        this.connect('notify::hover', this._onHover.bind(this));
        this.connect('destroy', () => {
            if (this._tooltip) {
                this._tooltip.destroy();
                this._tooltip = null;
            }
        });
    }

    // Click toggles provider instead of opening a menu.
    vfunc_event(event) {
        if (event.type() === Clutter.EventType.BUTTON_PRESS ||
            event.type() === Clutter.EventType.TOUCH_BEGIN) {
            this._provider = this._nextProvider();
            this._saveProvider(this._provider);
            this._render();       // instant switch using cached data
            this.refresh();       // and pull fresh numbers
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _nextProvider() {
        return PROVIDER_ORDER[(PROVIDER_ORDER.indexOf(this._provider) + 1) % PROVIDER_ORDER.length];
    }

    _loadProvider() {
        try {
            const [ok, bytes] = GLib.file_get_contents(STATE_FILE);
            if (ok) {
                const v = new TextDecoder().decode(bytes).trim();
                if (v in PROVIDERS)
                    return v;
            }
        } catch (e) {}
        return 'codex';
    }

    _saveProvider(v) {
        try {
            GLib.file_set_contents(STATE_FILE, v);
        } catch (e) {}
    }

    _ensureTooltip() {
        if (this._tooltip)
            return;
        this._tooltip = new St.Label({style_class: 'dash-label'});
        this._tooltip.hide();
        Main.layoutManager.addChrome(this._tooltip);
    }

    // Hover shows a tooltip with each limit's usage and when it comes back.
    _onHover() {
        this._ensureTooltip();
        if (!this.hover) {
            this._tooltip.hide();
            return;
        }
        this._updateTooltip();
        this._tooltip.show();

        const natWidth = this._tooltip.get_preferred_width(-1)[1];
        const [x, y] = this.get_transformed_position();
        const monitor = Main.layoutManager.primaryMonitor;
        let tx = Math.round(x + this.width / 2 - natWidth / 2);
        tx = Math.max(monitor.x + 4, Math.min(tx, monitor.x + monitor.width - natWidth - 4));
        this._tooltip.set_position(tx, Math.round(y + this.height + 4));
    }

    _updateTooltip() {
        if (!this._tooltip)
            return;
        const lines = [];
        for (const key of PROVIDER_ORDER) {
            const u = this._data ? this._data[key] : null;
            const name = PROVIDERS[key].name;
            const marker = key === this._provider ? '● ' : '   ';
            if (u && u.available) {
                const pct = Math.round(u.percent);
                const win = u.window ? ` (${u.window})` : '';
                let line = `${marker}${name}: ${pct}%${win}`;
                if (pct >= 100)
                    line += ' — limit reached';
                if (u.reset)
                    line += `, ${u.reset}`;
                lines.push(line);
            } else {
                lines.push(`${marker}${name}: n/a`);
            }
        }
        this._tooltip.text = lines.join('\n');
    }

    refresh() {
        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['python3', COLLECTOR],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
        } catch (e) {
            return;
        }
        proc.communicate_utf8_async(null, this._cancellable, (p, res) => {
            let stdout;
            try {
                [, stdout] = p.communicate_utf8_finish(res);
            } catch (e) {
                return;
            }
            try {
                this._data = JSON.parse(stdout);
            } catch (e) {
                return;
            }
            this._render();
        });
    }

    _render() {
        if (!this._label)
            return;
        const provider = PROVIDERS[this._provider];
        const u = this._data ? this._data[this._provider] : null;
        this._icon.gicon = this._icons[this._provider];
        if (u && u.available) {
            const pct = Math.round(u.percent);
            this._frac = Math.max(0, Math.min(1, u.percent / 100));
            this._color = levelColor(this._frac);
            this._label.text = pct >= 100 ? 'FULL' : `${pct}%`;
        } else {
            this._frac = 0;
            this._color = levelColor(0);
            this._label.text = '—';
        }
        this.accessible_name = u && u.available
            ? `${provider.name} usage ${Math.round(u.percent)} percent`
            : `${provider.name} usage unavailable`;
        this._area.queue_repaint();
        if (this._tooltip && this._tooltip.visible)
            this._updateTooltip();
    }

    _onRepaint(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        const r = h / 2;

        // track
        roundRect(cr, 0, 0, w, h, r);
        cr.setSourceRGBA(1, 1, 1, 0.14);
        cr.fill();

        // fill
        if (this._frac > 0) {
            roundRect(cr, 0, 0, w, h, r);
            cr.clip();
            const [cr_, cg, cb] = this._color;
            cr.setSourceRGBA(cr_, cg, cb, 0.9);
            cr.rectangle(0, 0, w * this._frac, h);
            cr.fill();
            cr.resetClip();
        }

        cr.$dispose();
    }
});

export default class AiUsageExtension extends Extension {
    enable() {
        this._indicator = new AiUsageIndicator(this.path);
        this._indicator._cancellable = new Gio.Cancellable();
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._indicator.refresh();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, INTERVAL_SECONDS, () => {
            this._indicator.refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        if (this._indicator) {
            this._indicator._cancellable?.cancel();
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
