var currentBuildInfo = null;

function checkForUpdates() {
  $.getJSON("build-info.json?_=" + Date.now(), function (data) {
    if (currentBuildInfo.sha !== data.sha) {
      // SHA has changed, new deployment detected
      console.log("New build detected:", data);
      console.log("Reloading page...");
      location.reload(true);
    }
  }).fail(function(jqXHR) {
      console.log("Could not check for updates:", jqXHR.status, jqXHR.statusText);
  });
}

$(function () {
  // Do initial check
  $.getJSON("build-info.json?_=" + Date.now())
    .done(function(data) {
      currentBuildInfo = data;
      console.log("Current build:", currentBuildInfo);
      // Only start the update timer if build-info.json exists
      setInterval(checkForUpdates, 600 * 1000);
    })
    .fail(function(jqXHR) {
      console.log("build-info.json not found (probably running locally). Update checking disabled.");
    });
});
