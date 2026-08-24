import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "io.github.victorrangel10.crypto-watch"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family

  readonly property var coins: Model.coinsFromSettings(settings)
  readonly property string activeWindow: Model.normalizeWindow(setting("window", Model.DEFAULT_WINDOW))

  property var rows: Model.placeholderCoins(Model.coinsFromSettings(settings))
  property string lastPayload: ""
  property string errorText: ""
  property var updatedAt: null
  property var lastFetchAt: null

  property bool adding: false
  property int cursor: -1
  property var searchResults: []
  property string searchError: ""

  readonly property bool loading: priceProc.running
  readonly property bool hasPrices: updatedAt !== null

  onCoinsChanged: {
    root.cursor = Math.min(root.cursor, root.coins.length - 1)
    root.render()
    root.refresh(true)
  }

  onActiveWindowChanged: root.render()

  onAddingChanged: {
    if (root.adding) searchField.forceActiveFocus()
    else root.clearSearch()
  }

  function open() {
    root.controller.show()
    root.refresh(false)
  }

  function close() {
    root.adding = false
    root.cursor = -1
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function persistSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]

    root.settings = entry
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function render() {
    if (root.coins.length === 0) {
      root.rows = []
      root.errorText = ""
      return
    }
    if (root.lastPayload === "") {
      root.rows = Model.placeholderCoins(root.coins)
      return
    }
    var result = Model.parseMarkets(root.lastPayload, root.coins, root.activeWindow)
    if (!result.ok) {
      root.errorText = result.error
      return
    }
    root.rows = result.coins
    root.errorText = ""
  }

  function refresh(force) {
    if (priceProc.running) return
    var url = Model.priceUrl(root.coins)
    if (url === "") return
    var now = Date.now()
    if (!force && !Model.shouldFetch(root.lastFetchAt, now, Model.MIN_FETCH_INTERVAL_MS)) return
    root.lastFetchAt = now
    priceProc.command = ["curl", "-fsS", "--max-time", "10", url]
    priceProc.running = true
  }

  function setWindow(key) {
    var next = Model.normalizeWindow(key)
    if (next !== root.activeWindow) root.persistSettings({ window: next })
  }

  function stepWindow(delta) {
    var keys = []
    for (var i = 0; i < Model.WINDOWS.length; i++) keys.push(Model.WINDOWS[i].key)
    var index = keys.indexOf(root.activeWindow) + delta
    if (index < 0 || index >= keys.length) return
    root.setWindow(keys[index])
  }

  function moveCursor(dx, dy) {
    if (dx !== 0) {
      root.stepWindow(dx)
      return
    }
    if (root.coins.length === 0) return
    var next = root.cursor + dy
    if (next < 0) next = 0
    if (next > root.coins.length - 1) next = root.coins.length - 1
    root.cursor = next
  }

  function removeCursorCoin() {
    if (root.cursor < 0 || root.cursor >= root.coins.length) return
    root.persistSettings({ coins: Model.removeCoin(root.coins, root.coins[root.cursor].id) })
  }

  function clearSearch() {
    searchField.text = ""
    root.searchResults = []
    root.searchError = ""
    searchDebounce.stop()
  }

  function runSearch() {
    var url = Model.searchUrl(searchField.text)
    if (url === "") {
      root.searchResults = []
      root.searchError = ""
      return
    }
    if (searchProc.running) return
    searchProc.command = ["curl", "-fsS", "--max-time", "10", url]
    searchProc.running = true
  }

  function addResult(result) {
    if (!result) return
    root.persistSettings({ coins: Model.addCoin(root.coins, result) })
    root.clearSearch()
  }

  function removeCoinId(id) {
    root.persistSettings({ coins: Model.removeCoin(root.coins, id) })
  }

  function trendColor(change) {
    var direction = Model.trend(change)
    if (direction === "up") return Color.accent
    if (direction === "down") return Color.urgent
    return Color.muted
  }

  Process {
    id: priceProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var raw = String(text || "")
        var result = Model.parseMarkets(raw, root.coins, root.activeWindow)
        if (!result.ok) {
          root.errorText = result.error
          return
        }
        root.lastPayload = raw
        root.rows = result.coins
        root.errorText = ""
        root.updatedAt = new Date()
      }
    }
    onExited: function(exitCode) {
      var failure = Model.errorForExit(exitCode)
      if (failure !== "") root.errorText = failure
    }
  }

  Process {
    id: searchProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var result = Model.parseSearch(String(text || ""), root.coins)
        root.searchResults = result.results
        root.searchError = result.ok ? "" : result.error
      }
    }
    onExited: function(exitCode) {
      var failure = Model.errorForExit(exitCode)
      if (failure !== "") {
        root.searchResults = []
        root.searchError = failure
      }
    }
  }

  Timer {
    id: searchDebounce
    interval: 400
    onTriggered: root.runSearch()
  }

  Timer {
    interval: 5000
    repeat: true
    running: root.opened
    onTriggered: root.refresh(false)
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: root.adding ? searchField : keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(330))
    contentHeight: panel.fittedContentHeight(priceColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: root.adding
      onMoveRequested: function(dx, dy) { root.moveCursor(dx, dy) }
      onReturnRequested: root.adding = true
      onDeleteRequested: root.removeCursorCoin()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(key) { if (key === "r") root.refresh(true) }

      Column {
        id: priceColumn
        width: parent.width
        spacing: Style.spacing.lg

        Item {
          width: parent.width
          height: windowChips.implicitHeight

          Row {
            id: windowChips
            anchors.left: parent.left
            spacing: Style.spacing.sm

            Repeater {
              model: Model.WINDOWS

              Rectangle {
                required property var modelData
                readonly property bool selected: modelData.key === root.activeWindow
                implicitWidth: chipLabel.implicitWidth + Style.space(16)
                implicitHeight: chipLabel.implicitHeight + Style.space(8)
                radius: Style.cornerRadius
                color: selected ? Style.selectedFill : (chipMouse.containsMouse ? Style.hoverFill : "transparent")

                Text {
                  id: chipLabel
                  anchors.centerIn: parent
                  text: modelData.label
                  color: parent.selected ? root.contentForeground : Color.muted
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  font.bold: parent.selected
                }

                MouseArea {
                  id: chipMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.setWindow(modelData.key)
                }
              }
            }
          }

          Text {
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: root.adding ? "cancel" : "add coin"
            color: addMouse.containsMouse || root.adding ? root.contentForeground : Color.muted
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption

            MouseArea {
              id: addMouse
              anchors.fill: parent
              anchors.margins: -Style.space(6)
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: root.adding = !root.adding
            }
          }
        }

        Repeater {
          model: root.rows

          Rectangle {
            id: coinRow
            required property var modelData
            required property int index
            readonly property bool active: rowMouse.containsMouse || root.cursor === coinRow.index
            width: priceColumn.width
            implicitHeight: rowContent.implicitHeight + Style.space(8)
            radius: Style.cornerRadius
            color: root.cursor === coinRow.index ? Style.selectedFill : (rowMouse.containsMouse ? Style.hoverFill : "transparent")

            MouseArea {
              id: rowMouse
              anchors.fill: parent
              hoverEnabled: true
              onClicked: root.cursor = coinRow.index
            }

            Row {
              id: rowContent
              anchors.left: parent.left
              anchors.leftMargin: Style.space(6)
              anchors.right: parent.right
              anchors.rightMargin: Style.space(6)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.spacing.controlGap

              Column {
                width: rowContent.width - priceBlock.implicitWidth - removeSlot.width - Style.spacing.controlGap * 2
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.spacing.xxs

                Text {
                  text: modelData.symbol
                  textFormat: Text.PlainText
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.title
                  font.bold: true
                }

                Text {
                  width: parent.width
                  elide: Text.ElideRight
                  text: modelData.name
                  textFormat: Text.PlainText
                  color: Color.muted
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                }
              }

              Column {
                id: priceBlock
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.spacing.xxs

                Text {
                  anchors.right: parent.right
                  text: Model.formatPrice(modelData.price)
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.heading
                }

                Text {
                  anchors.right: parent.right
                  text: Model.formatChange(modelData.change) + " · " + Model.windowLabel(root.activeWindow)
                  color: root.trendColor(modelData.change)
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                }
              }

              Item {
                id: removeSlot
                anchors.verticalCenter: parent.verticalCenter
                width: Style.space(18)
                height: removeGlyph.implicitHeight

                Text {
                  id: removeGlyph
                  anchors.centerIn: parent
                  text: "✕"
                  opacity: coinRow.active ? 1 : 0
                  color: removeMouse.containsMouse ? Color.urgent : Color.muted
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                }

                MouseArea {
                  id: removeMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.removeCoinId(modelData.id)
                }
              }
            }
          }
        }

        Text {
          width: priceColumn.width
          visible: root.coins.length === 0
          horizontalAlignment: Text.AlignHCenter
          text: "No coins — press Return to add one"
          color: Color.muted
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.bodySmall
        }

        PanelSeparator {}

        Column {
          width: priceColumn.width
          visible: root.adding
          spacing: Style.spacing.md

          TextField {
            id: searchField
            width: parent.width
            placeholderText: "Name or symbol, then Enter"
            foreground: root.contentForeground
            font.family: root.contentFontFamily

            onTextChanged: if (root.adding) searchDebounce.restart()

            Keys.onPressed: function(event) {
              if (event.key === Qt.Key_Escape) {
                root.adding = false
                event.accepted = true
              } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                if (root.searchResults.length > 0) root.addResult(root.searchResults[0])
                event.accepted = true
              }
            }
          }

          Repeater {
            model: root.searchResults

            Rectangle {
              required property var modelData
              width: priceColumn.width
              implicitHeight: resultLabel.implicitHeight + Style.space(10)
              radius: Style.cornerRadius
              color: resultMouse.containsMouse ? Style.hoverFill : "transparent"

              Text {
                id: resultLabel
                anchors.left: parent.left
                anchors.leftMargin: Style.space(6)
                anchors.right: resultSymbol.left
                anchors.rightMargin: Style.spacing.controlGap
                anchors.verticalCenter: parent.verticalCenter
                elide: Text.ElideRight
                text: modelData.name
                textFormat: Text.PlainText
                color: root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
              }

              Text {
                id: resultSymbol
                anchors.right: parent.right
                anchors.rightMargin: Style.space(6)
                anchors.verticalCenter: parent.verticalCenter
                text: modelData.symbol
                textFormat: Text.PlainText
                color: Color.muted
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
              }

              MouseArea {
                id: resultMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.addResult(modelData)
              }
            }
          }

          Text {
            width: parent.width
            visible: root.searchError !== ""
            text: root.searchError
            color: Color.urgent
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
          }
        }

        Text {
          width: priceColumn.width
          horizontalAlignment: Text.AlignHCenter
          color: root.errorText !== "" ? Color.urgent : Color.muted
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          text: {
            if (root.loading && !root.hasPrices) return "Loading…"
            if (root.errorText !== "" && root.hasPrices)
              return root.errorText + " · showing " + Model.formatUpdatedAt(root.updatedAt)
            if (root.errorText !== "") return root.errorText
            return "CoinGecko · " + Model.formatUpdatedAt(root.updatedAt)
          }
        }
      }
    }
  }
}
