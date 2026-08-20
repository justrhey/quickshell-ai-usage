import qs.modules.common
import qs.modules.common.widgets
import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io

MouseArea {
    id: root
    property string provider: "codex"
    property var usage: ({})
    property string collectorPath: {
        const configHome = Quickshell.env("XDG_CONFIG_HOME") || (Quickshell.env("HOME") + "/.config");
        return configHome + "/quickshell/ii/scripts/ai_usage.py";
    }
    readonly property var currentUsage: usage?.[provider] || ({})
    readonly property real percent: currentUsage.available ? (currentUsage.percent || 0) : 0

    implicitWidth: 26
    hoverEnabled: true
    cursorShape: Qt.PointingHandCursor
    onClicked: provider = provider === "codex" ? "claude" : "codex"

    Process {
        id: collector
        command: ["python3", root.collectorPath]
        running: true
        stdout: StdioCollector {
            onStreamFinished: {
                try {
                    root.usage = JSON.parse(text);
                } catch (error) {
                    console.warn("AI usage collector returned invalid JSON:", error);
                }
            }
        }
    }

    Timer {
        interval: 60000
        running: true
        repeat: true
        onTriggered: {
            if (!collector.running)
                collector.running = true;
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.topMargin: 4
        anchors.bottomMargin: 4
        spacing: 3

        StyledText {
            Layout.alignment: Qt.AlignHCenter
            text: root.provider === "codex" ? "CX" : "CL"
            font.pixelSize: Appearance.font.pixelSize.smaller
            font.weight: Font.DemiBold
            color: root.provider === "codex" ? "#34C759" : Appearance.colors.colOnLayer0
        }

        StyledText {
            Layout.alignment: Qt.AlignHCenter
            text: root.currentUsage.available ? Math.round(root.percent) + "%" : "—"
            font.pixelSize: Appearance.font.pixelSize.smaller
            color: Appearance.colors.colOnLayer0
        }

        Item {
            id: bar
            Layout.alignment: Qt.AlignHCenter
            Layout.fillHeight: true
            Layout.preferredWidth: 12
            implicitWidth: 12
            property real fraction: Math.max(0, Math.min(1, root.percent / 100))

            Rectangle {
                id: liquid
                anchors.bottom: parent.bottom
                width: parent.width
                bottomLeftRadius: 4
                bottomRightRadius: 4
                topLeftRadius: bar.fraction >= 0.999 ? 4 : 0
                topRightRadius: bar.fraction >= 0.999 ? 4 : 0
                height: parent.height * bar.fraction
                color: root.provider === "codex" ? "#34C759" : "#FF9500"
                clip: true
                Behavior on height { NumberAnimation { duration: 400; easing.type: Easing.OutCubic } }

                Rectangle {
                    y: -2
                    width: liquid.width * 1.8
                    height: 5
                    radius: height / 2
                    color: Qt.lighter(liquid.color, 1.25)
                    opacity: 0.75
                    NumberAnimation on x {
                        from: -liquid.width * 0.8
                        to: 0
                        duration: 1400
                        loops: Animation.Infinite
                        easing.type: Easing.InOutSine
                    }
                }
            }

            Item {
                anchors { top: parent.top; left: parent.left; right: parent.right }
                height: parent.height * (1 - bar.fraction)
                clip: true
                Behavior on height { NumberAnimation { duration: 400; easing.type: Easing.OutCubic } }

                Canvas {
                    id: hatch
                    anchors.fill: parent
                    property color lineColor: Appearance.colors.colOnLayer1
                    onPaint: {
                        const context = getContext("2d");
                        context.reset();
                        context.strokeStyle = lineColor;
                        context.globalAlpha = 0.45;
                        context.lineWidth = 1.5;
                        const gap = 5;
                        for (let x = -height; x < width; x += gap) {
                            context.beginPath();
                            context.moveTo(x, height);
                            context.lineTo(x + height, 0);
                            context.stroke();
                        }
                    }
                    onWidthChanged: requestPaint()
                    onHeightChanged: requestPaint()
                    onLineColorChanged: requestPaint()
                }

                Rectangle {
                    anchors.fill: parent
                    color: "transparent"
                    topLeftRadius: 4
                    topRightRadius: 4
                    bottomLeftRadius: bar.fraction <= 0.001 ? 4 : 0
                    bottomRightRadius: bar.fraction <= 0.001 ? 4 : 0
                    border.width: 1
                    border.color: Appearance.colors.colOnLayer1
                    opacity: 0.5
                }
            }
        }
    }
}
