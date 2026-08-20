import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const REFRESH_SECONDS = 60;

const UsageIndicator = GObject.registerClass(class UsageIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, extension.metadata.name, false);

        this._extension = extension;
        this._provider = 'codex';
        this._usage = {};
        this._destroyed = false;
        this._process = null;

        const box = new St.BoxLayout({style_class: 'ai-usage-panel'});
        this._providerLabel = new St.Label({
            text: 'CX',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'ai-usage-provider ai-usage-codex',
        });
        this._percentLabel = new St.Label({
            text: '—',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'ai-usage-percent',
        });
        this._meter = new St.Widget({
            style_class: 'ai-usage-meter',
            y_align: Clutter.ActorAlign.CENTER,
            clip_to_allocation: true,
        });
        this._fill = new St.Widget({
            style_class: 'ai-usage-fill ai-usage-fill-codex',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            clip_to_allocation: true,
        });
        this._wave = new St.Widget({style_class: 'ai-usage-wave'});
        this._fill.add_child(this._wave);
        this._meter.add_child(this._fill);
        box.add_child(this._providerLabel);
        box.add_child(this._percentLabel);
        box.add_child(this._meter);
        this.add_child(box);

        this._codexItem = new PopupMenu.PopupMenuItem('Codex');
        this._codexItem.connect('activate', () => this._selectProvider('codex'));
        this.menu.addMenuItem(this._codexItem);

        this._claudeItem = new PopupMenu.PopupMenuItem('Claude');
        this._claudeItem.connect('activate', () => this._selectProvider('claude'));
        this.menu.addMenuItem(this._claudeItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Refresh', () => this.refresh());

        this._updateMenu();
        this._animateWave(true);
        this.refresh();
        this._refreshId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            REFRESH_SECONDS,
            () => {
                this.refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _selectProvider(provider) {
        this._provider = provider;
        this._render();
        this._updateMenu();
    }

    _updateMenu() {
        this._codexItem.setOrnament(
            this._provider === 'codex' ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE
        );
        this._claudeItem.setOrnament(
            this._provider === 'claude' ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE
        );
    }

    _animateWave(forward) {
        if (this._destroyed)
            return;

        this._wave.ease({
            translation_x: forward ? 8 : -8,
            duration: 900,
            mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
            onComplete: () => this._animateWave(!forward),
        });
    }

    refresh() {
        if (this._process)
            return;

        const collector = this._extension.dir
            .get_child('scripts')
            .get_child('ai_usage.py')
            .get_path();

        try {
            this._process = Gio.Subprocess.new(
                ['python3', collector],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            this._process.communicate_utf8_async(null, null, (process, result) => {
                try {
                    const [, stdout] = process.communicate_utf8_finish(result);
                    this._usage = JSON.parse(stdout);
                } catch (error) {
                    console.warn(`[AI Usage] Collector failed: ${error.message}`);
                } finally {
                    this._process = null;
                    if (!this._destroyed)
                        this._render();
                }
            });
        } catch (error) {
            this._process = null;
            console.warn(`[AI Usage] Could not start collector: ${error.message}`);
            this._render();
        }
    }

    _render() {
        const current = this._usage[this._provider] ?? {};
        const percent = current.available
            ? Math.max(0, Math.min(100, Number(current.percent) || 0))
            : 0;
        const isCodex = this._provider === 'codex';

        this._providerLabel.text = isCodex ? 'CX' : 'CL';
        this._providerLabel.set_style_class_name(
            `ai-usage-provider ${isCodex ? 'ai-usage-codex' : 'ai-usage-claude'}`
        );
        this._percentLabel.text = current.available ? `${Math.round(percent)}%` : '—';
        this._fill.set_style_class_name(
            `ai-usage-fill ${isCodex ? 'ai-usage-fill-codex' : 'ai-usage-fill-claude'}`
        );
        this._fill.set_width(Math.max(1, Math.round(36 * percent / 100)));
        this.accessible_name = current.available
            ? `${isCodex ? 'Codex' : 'Claude'} usage ${Math.round(percent)} percent`
            : `${isCodex ? 'Codex' : 'Claude'} usage unavailable`;
    }

    destroy() {
        this._destroyed = true;
        if (this._refreshId) {
            GLib.source_remove(this._refreshId);
            this._refreshId = 0;
        }
        if (this._process)
            this._process.force_exit();
        this._wave.remove_all_transitions();
        super.destroy();
    }
});

export default class AiUsageExtension extends Extension {
    enable() {
        this._indicator = new UsageIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
