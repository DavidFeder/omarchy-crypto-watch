import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

BarWidget {
  id: root
  moduleName: "io.github.davidfeder.pulsewatch"

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false
  readonly property var rows: panelLoader.item ? panelLoader.item.rows : []
  readonly property var coins: Model.coinsFromSettings(settings)
  readonly property string primaryId: Model.normalizePrimary(settings, coins)
  readonly property bool tickerOn: Model.tickerEnabled(settings) && !vertical
  readonly property int tickerViewport: Model.tickerWidth(settings)
  readonly property var tickerParts: Model.tickerParts(rows)
  readonly property var primaryRow: {
    var list = root.rows
    var wanted = root.primaryId
    if (list && list.length) {
      for (var i = 0; i < list.length; i++) if (list[i].id === wanted) return list[i]
      return list[0]
    }
    return Model.coinById(root.coins, wanted)
  }
  readonly property string displayText: Model.barLabel(primaryRow, vertical)
  readonly property color trendColor: colorForTrend(Model.trend(primaryRow ? primaryRow.change : null))

  property real tapeShift: 0
  property real tapeCopyWidth: 0

  function colorForTrend(direction) {
    if (direction === "up") return Color.accent
    if (direction === "down") return Color.urgent
    return bar ? bar.barForeground : Color.foreground
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
  }

  function refresh() {
    if (panelLoader.item) panelLoader.item.refresh(true)
  }

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function togglePanel() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function cyclePrimary() {
    if (panelLoader.item && panelLoader.item.cyclePrimary) {
      panelLoader.item.cyclePrimary()
      return
    }
    var entry = { id: root.moduleName }
    for (var key in root.settings) if (key !== "id") entry[key] = root.settings[key]
    entry.primary = Model.nextPrimary(root.coins, root.primaryId)
    root.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function toggleTicker() {
    if (panelLoader.item && panelLoader.item.toggleTicker) {
      panelLoader.item.toggleTicker()
      return
    }
    var entry = { id: root.moduleName }
    for (var key in root.settings) if (key !== "id") entry[key] = root.settings[key]
    entry.ticker = !root.tickerOn
    root.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function measureTape() {
    if (tapeRepeater.count < 1) {
      root.tapeCopyWidth = 0
      return
    }
    var item = tapeRepeater.itemAt(0)
    root.tapeCopyWidth = item ? item.implicitWidth : 0
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()
  onTickerPartsChanged: {
    root.tapeShift = 0
    Qt.callLater(root.measureTape)
  }
  onTickerOnChanged: {
    root.tapeShift = 0
    Qt.callLater(root.measureTape)
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: "io.github.davidfeder.pulsewatch"

    function refresh(): void { root.broadcast("refresh") }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
    function cycle(): void { root.cyclePrimary() }
    function ticker(): void { root.toggleTicker() }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.tickerOn ? (Model.tickerText(root.rows) || "Pulse") : root.displayText
    labelVisible: false
    hasVisualContent: true
    tooltipText: root.opened ? "" : (root.tickerOn ? "Pulse ticker · all coins" : "PulseChain · click for panel")
    useActiveColor: false
    active: false
    fixedWidth: root.tickerOn ? root.tickerViewport : -1
    horizontalMargin: root.tickerOn ? 8 : 8.5

    onPressed: function(b) {
      if (b === Qt.MiddleButton) root.refresh()
      else if (b === Qt.RightButton) {
        if (root.tickerOn) root.toggleTicker()
        else root.cyclePrimary()
      } else root.togglePanel()
    }

    Text {
      visible: !root.tickerOn
      anchors.centerIn: parent
      text: root.displayText
      textFormat: Text.PlainText
      color: root.trendColor
      font.family: button.fontFamily
      font.pixelSize: button.fontSize
      renderType: Text.NativeRendering
    }

    Item {
      id: tapeClip
      visible: root.tickerOn
      anchors.fill: parent
      anchors.leftMargin: button.scaledHorizontalMargin
      anchors.rightMargin: button.scaledHorizontalMargin
      clip: true

      Row {
        id: tape
        x: -root.tapeShift
        height: parent.height
        spacing: 0

        Repeater {
          id: tapeRepeater
          model: 2

          Row {
            id: tapeCopy
            spacing: 0
            height: tapeClip.height

            Repeater {
              model: root.tickerParts

              Row {
                spacing: 0
                height: tapeClip.height

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  text: modelData.text
                  textFormat: Text.PlainText
                  color: root.colorForTrend(modelData.trend)
                  font.family: button.fontFamily
                  font.pixelSize: button.fontSize
                  renderType: Text.NativeRendering
                }

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  text: "   ·   "
                  textFormat: Text.PlainText
                  color: Color.muted
                  font.family: button.fontFamily
                  font.pixelSize: button.fontSize
                  renderType: Text.NativeRendering
                }
              }
            }

            Component.onCompleted: Qt.callLater(root.measureTape)
          }
        }
      }

      NumberAnimation {
        id: tapeAnim
        target: root
        property: "tapeShift"
        from: 0
        to: Math.max(1, root.tapeCopyWidth)
        duration: Math.max(6000, root.tapeCopyWidth * 28)
        loops: Animation.Infinite
        running: root.tickerOn && root.tapeCopyWidth > tapeClip.width + 8 && !root.opened && !button.tooltipHovered
        easing.type: Easing.Linear
      }
    }
  }
}
