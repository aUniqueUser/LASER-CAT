var extensionClient = this["browser"] ? browser : chrome;

extensionClient.browserAction.onClicked.addListener(function() {
  extensionClient.tabs.executeScript(null, {"code" : "laserCatamu.toggle();"});
});
