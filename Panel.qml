import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "io.github.davidfeder.pulsewatch"
  manageIpc: false
  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root
  readonly property string fetchScript: Qt.resolvedUrl("bin/fetch.js")
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property var coins: Model.coinsFromSettings(settings)
  readonly property string activeWindow: Model.normalizeWindow(setting("window", Model.DEFAULT_WINDOW))
  readonly property string primaryId: Model.normalizePrimary(settings, coins)
  readonly property bool tickerOn: Model.tickerEnabled(settings)
  property var rows: Model.placeholderCoins(Model.coinsFromSettings(settings))
  property string lastPayload: ""
  property string errorText: ""
  property var updatedAt: null
  property var lastFetchAt: null
  property bool adding: false
  property int cursor: -1
  property var searchResults: []
  property string searchError: ""
  property string searchIssued: ""
  property bool refreshQueued: false
  readonly property bool loading: priceProc.running
  readonly property bool hasPrices: updatedAt !== null
  onCoinsChanged: { root.cursor = Math.min(root.cursor, root.coins.length - 1); root.render(); root.refresh(true) }
  onActiveWindowChanged: root.render()
  onAddingChanged: { if (root.adding) { root.searchResults = Model.catalogSearch(searchField.text, root.coins); searchField.forceActiveFocus() } else root.clearSearch() }
  Component.onCompleted: root.refresh(true)
  function open() { root.controller.show(); root.refresh(false) }
  function close() { root.adding = false; root.cursor = -1; root.controller.hide() }
  function toggle() { if (root.opened) root.close(); else root.open() }
  function switchPanel(direction) { if (root.bar && typeof root.bar.switchPanelFrom === "function") return root.bar.switchPanelFrom(root.barIdentity, direction); return false }
  function persistSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]
    root.settings = entry
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function") root.bar.shell.updateEntryInline(root.moduleName, entry)
  }
  function cyclePrimary() { root.persistSettings({ primary: Model.nextPrimary(root.coins, root.primaryId) }) }
  function toggleTicker() { root.persistSettings({ ticker: !root.tickerOn }) }
  function render() {
    if (root.coins.length === 0) { root.rows = []; root.errorText = ""; return }
    if (root.lastPayload === "") { root.rows = Model.placeholderCoins(root.coins); return }
    var result = Model.parseMarkets(root.lastPayload, root.coins, root.activeWindow)
    if (!result.ok && result.coins.length === 0) { root.errorText = result.error; return }
    root.rows = result.coins.length ? result.coins : Model.placeholderCoins(root.coins)
    root.errorText = result.ok ? "" : result.error
  }
  function refresh(force) {
    if (priceProc.running) {
      if (force) root.refreshQueued = true
      return
    }
    if (root.coins.length === 0) return
    var now = Date.now()
    if (!force && !Model.shouldFetch(root.lastFetchAt, now, Model.MIN_FETCH_INTERVAL_MS)) return
    root.refreshQueued = false
    root.lastFetchAt = now
    priceProc.command = Model.fetchCommand(root.fetchScript, root.coins)
    priceProc.running = true
  }
  function setWindow(key) { var next = Model.normalizeWindow(key); if (next !== root.activeWindow) root.persistSettings({ window: next }) }
  function stepWindow(delta) {
    var keys = []; for (var i = 0; i < Model.WINDOWS.length; i++) keys.push(Model.WINDOWS[i].key)
    var index = keys.indexOf(root.activeWindow) + delta
    if (index < 0 || index >= keys.length) return
    root.setWindow(keys[index])
  }
  function moveCursor(dx, dy) {
    if (dx !== 0) { root.stepWindow(dx); return }
    if (root.coins.length === 0) return
    var next = root.cursor + dy
    if (next < 0) next = 0
    if (next > root.coins.length - 1) next = root.coins.length - 1
    root.cursor = next
  }
  function removeCursorCoin() { if (root.cursor < 0 || root.cursor >= root.coins.length) return; root.persistSettings({ coins: Model.removeCoin(root.coins, root.coins[root.cursor].id) }) }
  function clearSearch() {
    searchField.text = ""
    root.searchResults = []
    root.searchError = ""
    root.searchIssued = ""
    searchDebounce.stop()
    if (searchProc.running) searchProc.running = false
  }
  function runSearch() {
    var query = searchField.text
    root.searchResults = Model.catalogSearch(query, root.coins)
    root.searchError = ""
    var command = Model.searchCommand(root.fetchScript, query)
    if (command.length === 0) {
      root.searchIssued = ""
      if (searchProc.running) searchProc.running = false
      return
    }
    if (searchProc.running) searchProc.running = false
    root.searchIssued = query
    searchProc.command = Model.searchCommand(root.fetchScript, query)
    searchProc.running = true
  }
  function addResult(result) { if (!result) return; root.persistSettings({ coins: Model.addCoin(root.coins, result) }); root.clearSearch(); root.adding = false }
  function removeCoinId(id) { root.persistSettings({ coins: Model.removeCoin(root.coins, id) }) }
  function pinPrimary(id) { root.persistSettings({ primary: id }) }
  function trendColor(change) { var direction = Model.trend(change); if (direction === "up") return Color.accent; if (direction === "down") return Color.urgent; return Color.muted }
  Process {
    id: priceProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var raw = String(text || "")
        var result = Model.parseMarkets(raw, root.coins, root.activeWindow)
        if (!result.ok && result.coins.length === 0) { root.errorText = result.error; return }
        root.lastPayload = raw
        root.rows = result.coins.length ? result.coins : Model.placeholderCoins(root.coins)
        root.errorText = result.ok ? "" : result.error
        if (result.ok) root.updatedAt = new Date()
      }
    }
    onExited: function(exitCode) {
      var failure = Model.errorForExit(exitCode)
      if (failure !== "") root.errorText = failure
      if (root.refreshQueued) {
        root.refreshQueued = false
        Qt.callLater(function() { root.refresh(true) })
      }
    }
  }
  Process {
    id: searchProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var query = root.searchIssued
        if (query === "" || searchField.text !== query) return
        var result = Model.parseSearch(String(text || ""), root.coins, query)
        root.searchResults = result.results
        root.searchError = result.ok ? "" : result.error
      }
    }
    onExited: function(exitCode) {
      if (searchField.text !== root.searchIssued) return
      var failure = Model.errorForExit(exitCode)
      if (failure !== "" && root.searchResults.length === 0) root.searchError = failure
    }
  }
  Timer { id: searchDebounce; interval: 400; onTriggered: root.runSearch() }
  Timer { interval: 60000; repeat: true; running: true; onTriggered: root.refresh(false) }
  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: root.adding ? searchField : keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(360))
    contentHeight: panel.fittedContentHeight(priceColumn.implicitHeight, Style.space(640))
    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: root.adding
      onMoveRequested: function(dx, dy) { root.moveCursor(dx, dy) }
      onReturnRequested: root.adding = true
      onDeleteRequested: root.removeCursorCoin()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(key) {
        if (key === "r") root.refresh(true)
        if (key === "t") root.toggleTicker()
        if (key === "p" && root.cursor >= 0 && root.cursor < root.coins.length) root.pinPrimary(root.coins[root.cursor].id)
      }
      Flickable {
        id: priceScroll
        anchors.fill: parent
        contentWidth: width
        contentHeight: priceColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height
        Column {
          id: priceColumn
          width: priceScroll.width
          spacing: Style.spacing.lg
          Column {
            width: parent.width
            spacing: Style.spacing.xxs
            Text { text: "Pulse Watch"; color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: Style.font.title; font.bold: true }
            Text { text: root.tickerOn ? "All coins on the bar · hover to pause · T to toggle" : "RH coins on PulseChain · right-click bar to cycle"; color: Color.muted; font.family: root.contentFontFamily; font.pixelSize: Style.font.caption }
          }
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
                  Text { id: chipLabel; anchors.centerIn: parent; text: modelData.label; color: parent.selected ? root.contentForeground : Color.muted; font.family: root.contentFontFamily; font.pixelSize: Style.font.bodySmall; font.bold: parent.selected }
                  MouseArea { id: chipMouse; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.setWindow(modelData.key) }
                }
              }
            }
            Row {
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.spacing.md
              Rectangle {
                implicitWidth: tickerChipLabel.implicitWidth + Style.space(16)
                implicitHeight: tickerChipLabel.implicitHeight + Style.space(8)
                radius: Style.cornerRadius
                color: root.tickerOn ? Style.selectedFill : (tickerChipMouse.containsMouse ? Style.hoverFill : "transparent")
                Text { id: tickerChipLabel; anchors.centerIn: parent; text: "ticker"; color: root.tickerOn || tickerChipMouse.containsMouse ? root.contentForeground : Color.muted; font.family: root.contentFontFamily; font.pixelSize: Style.font.bodySmall; font.bold: root.tickerOn }
                MouseArea { id: tickerChipMouse; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.toggleTicker() }
              }
              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: root.adding ? "cancel" : "add coin"
                color: addMouse.containsMouse || root.adding ? root.contentForeground : Color.muted
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
                MouseArea { id: addMouse; anchors.fill: parent; anchors.margins: -Style.space(6); hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.adding = !root.adding }
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
              readonly property bool isPrimary: modelData.id === root.primaryId
              width: priceColumn.width
              implicitHeight: rowContent.implicitHeight + Style.space(8)
              radius: Style.cornerRadius
              color: root.cursor === coinRow.index ? Style.selectedFill : (rowMouse.containsMouse ? Style.hoverFill : "transparent")
              MouseArea { id: rowMouse; anchors.fill: parent; hoverEnabled: true; acceptedButtons: Qt.LeftButton | Qt.RightButton; onClicked: function(mouse) { root.cursor = coinRow.index; if (mouse.button === Qt.RightButton) root.pinPrimary(modelData.id) } }
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
                  Row {
                    spacing: Style.spacing.sm
                    Text { text: modelData.symbol; textFormat: Text.PlainText; color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: Style.font.title; font.bold: true }
                    Text { visible: coinRow.isPrimary; anchors.verticalCenter: parent.verticalCenter; text: "bar"; color: Color.accent; font.family: root.contentFontFamily; font.pixelSize: Style.font.caption }
                  }
                  Text { width: parent.width; elide: Text.ElideRight; text: modelData.name; textFormat: Text.PlainText; color: Color.muted; font.family: root.contentFontFamily; font.pixelSize: Style.font.caption }
                  Text { width: parent.width; elide: Text.ElideRight; text: modelData.originLabel || ""; textFormat: Text.PlainText; color: Color.muted; font.family: root.contentFontFamily; font.pixelSize: Style.font.caption; opacity: 0.8 }
                }
                Column {
                  id: priceBlock
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.spacing.xxs
                  Text { anchors.right: parent.right; text: Model.formatPrice(modelData.price); color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: Style.font.heading }
                  Text { anchors.right: parent.right; text: Model.formatChange(modelData.change) + " · " + Model.windowLabel(root.activeWindow); color: root.trendColor(modelData.change); font.family: root.contentFontFamily; font.pixelSize: Style.font.bodySmall }
                }
                Item {
                  id: removeSlot
                  anchors.verticalCenter: parent.verticalCenter
                  width: Style.space(18)
                  height: removeGlyph.implicitHeight
                  Text { id: removeGlyph; anchors.centerIn: parent; text: "✕"; opacity: coinRow.active ? 1 : 0; color: removeMouse.containsMouse ? Color.urgent : Color.muted; font.family: root.contentFontFamily; font.pixelSize: Style.font.bodySmall }
                  MouseArea { id: removeMouse; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.removeCoinId(modelData.id) }
                }
              }
            }
          }
          Text { width: priceColumn.width; visible: root.coins.length === 0; horizontalAlignment: Text.AlignHCenter; text: "No coins — press Return to add HEX, PLS, PLSX…"; color: Color.muted; font.family: root.contentFontFamily; font.pixelSize: Style.font.bodySmall }
          PanelSeparator {}
          Column {
            width: priceColumn.width
            visible: root.adding
            spacing: Style.spacing.md
            TextField {
              id: searchField
              width: parent.width
              placeholderText: "HEX, PLS, PulseChain token…"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
              onTextChanged: if (root.adding) { root.searchResults = Model.catalogSearch(text, root.coins); searchDebounce.restart() }
              Keys.onPressed: function(event) {
                if (event.key === Qt.Key_Escape) { root.adding = false; event.accepted = true }
                else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) { if (root.searchResults.length > 0) root.addResult(root.searchResults[0]); event.accepted = true }
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
                Text { id: resultLabel; anchors.left: parent.left; anchors.leftMargin: Style.space(6); anchors.right: resultSymbol.left; anchors.rightMargin: Style.spacing.controlGap; anchors.verticalCenter: parent.verticalCenter; elide: Text.ElideRight; text: modelData.name; textFormat: Text.PlainText; color: root.contentForeground; font.family: root.contentFontFamily; font.pixelSize: Style.font.bodySmall }
                Text { id: resultSymbol; anchors.right: parent.right; anchors.rightMargin: Style.space(6); anchors.verticalCenter: parent.verticalCenter; text: modelData.symbol; textFormat: Text.PlainText; color: Color.muted; font.family: root.contentFontFamily; font.pixelSize: Style.font.caption }
                MouseArea { id: resultMouse; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: root.addResult(modelData) }
              }
            }
            Text { width: parent.width; visible: root.searchError !== ""; text: root.searchError; color: Color.urgent; font.family: root.contentFontFamily; font.pixelSize: Style.font.caption }
          }
          Text {
            width: priceColumn.width
            horizontalAlignment: Text.AlignHCenter
            color: root.errorText !== "" ? Color.urgent : Color.muted
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            text: {
              if (root.loading && !root.hasPrices) return "Loading PulseX…"
              if (root.errorText !== "" && root.hasPrices) return root.errorText + " · showing " + Model.formatUpdatedAt(root.updatedAt)
              if (root.errorText !== "") return root.errorText
              return "PulseX · DexScreener · " + Model.formatUpdatedAt(root.updatedAt)
            }
          }
        }
      }
    }
  }
}
