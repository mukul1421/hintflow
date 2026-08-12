document.addEventListener("DOMContentLoaded", () => {
  const savedCountEl = document.getElementById("saved-count");
  const openSheetBtn = document.getElementById("open-sheet-btn");
  const authBtn = document.getElementById("auth-btn");
  const statusIndicator = document.getElementById("status-indicator");
  const statusText = document.getElementById("status-text");

  let currentSpreadsheetUrl = null;

  const loadInfo = () => {
    chrome.runtime.sendMessage({ action: "GET_SHEET_INFO" }, (response) => {
      if (chrome.runtime.lastError) {
        statusIndicator.className = "status-indicator error";
        statusText.textContent = "Extension background service disconnected.";
        return;
      }

      if (response) {
        savedCountEl.textContent = response.savedCount || 0;

        if (response.spreadsheetUrl) {
          currentSpreadsheetUrl = response.spreadsheetUrl;
          openSheetBtn.disabled = false;
          statusIndicator.className = "status-indicator online";
          statusText.textContent = "Google Sheet connected.";
        } else {
          openSheetBtn.disabled = true;
          statusIndicator.className = "status-indicator";
          statusText.textContent = "Sheet auto-created on first save.";
        }
      }
    });
  };

  openSheetBtn.addEventListener("click", () => {
    if (currentSpreadsheetUrl) {
      chrome.tabs.create({ url: currentSpreadsheetUrl });
    }
  });

  authBtn.addEventListener("click", () => {
    authBtn.disabled = true;
    authBtn.textContent = "Connecting...";
    chrome.runtime.sendMessage({ action: "AUTHENTICATE" }, (response) => {
      authBtn.disabled = false;
      authBtn.textContent = "🔑 Connect Google Account";

      if (response && response.success) {
        statusIndicator.className = "status-indicator online";
        statusText.textContent = "Google account authenticated.";
        loadInfo();
      } else {
        statusIndicator.className = "status-indicator error";
        statusText.textContent = response?.error || "Authentication failed.";
      }
    });
  });

  loadInfo();
});
