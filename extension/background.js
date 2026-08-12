/**
 * HintFlow Background Service Worker
 * Handles OAuth authentication with Google and Sheets API integration.
 */

const SPREADSHEET_TITLE = "HintFlow — LeetCode Tracker";
const SHEET_HEADERS = ["Date", "Problem", "Difficulty", "Time Taken (min)", "Note"];
const STORAGE_KEYS = {
  SPREADSHEET_ID: "hintflow_spreadsheet_id",
  SAVED_COUNT: "hintflow_saved_count",
};

/**
 * Get cached or interactive OAuth token from chrome.identity
 */
async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError || new Error("Failed to acquire OAuth token."));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Remove cached auth token on 401 error
 */
async function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      resolve();
    });
  });
}

/**
 * Execute an authenticated Google API request with automatic 401 retry handling
 */
async function fetchWithAuth(url, options = {}) {
  let token = await getAuthToken(false).catch(() => getAuthToken(true));

  const makeRequest = async (authToken) => {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    };
    return fetch(url, { ...options, headers });
  };

  let response = await makeRequest(token);

  // If 401 Unauthorized, clear cached token and retry once
  if (response.status === 401) {
    console.warn("[HintFlow] Auth token expired (401). Retrying with fresh token...");
    await removeCachedToken(token);
    token = await getAuthToken(true);
    response = await makeRequest(token);
  }

  return response;
}

/**
 * Get existing spreadsheetId from storage, or auto-create a new Google Sheet
 */
async function getOrCreateSpreadsheet() {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.SPREADSHEET_ID]);
  if (stored[STORAGE_KEYS.SPREADSHEET_ID]) {
    return stored[STORAGE_KEYS.SPREADSHEET_ID];
  }

  console.log("[HintFlow] Auto-creating new Google Sheet...");

  // 1. Create spreadsheet
  const createRes = await fetchWithAuth("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        title: SPREADSHEET_TITLE,
      },
      sheets: [
        {
          properties: {
            title: "LeetCode Tracker",
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Sheet: ${createRes.status} ${errText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;

  // 2. Set header row
  const headerRes = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:E1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [SHEET_HEADERS],
      }),
    }
  );

  if (!headerRes.ok) {
    console.warn("[HintFlow] Warning: Failed to write headers to new sheet.", await headerRes.text());
  }

  // 3. Save spreadsheetId to chrome.storage.local
  await chrome.storage.local.set({ [STORAGE_KEYS.SPREADSHEET_ID]: spreadsheetId });
  return spreadsheetId;
}

/**
 * Append problem row to the Google Sheet
 */
async function appendProblemRow(data) {
  const { date, problem, difficulty, timeTaken, note } = data;
  const spreadsheetId = await getOrCreateSpreadsheet();

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`;
  const appendRes = await fetchWithAuth(appendUrl, {
    method: "POST",
    body: JSON.stringify({
      values: [[date, problem, difficulty, timeTaken, note || ""]],
    }),
  });

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    throw new Error(`Failed to append row to Google Sheet: ${appendRes.status} ${errText}`);
  }

  // Update saved count in local storage
  const stored = await chrome.storage.local.get([STORAGE_KEYS.SAVED_COUNT]);
  const newCount = (stored[STORAGE_KEYS.SAVED_COUNT] || 0) + 1;
  await chrome.storage.local.set({ [STORAGE_KEYS.SAVED_COUNT]: newCount });

  return {
    success: true,
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    savedCount: newCount,
  };
}

// Handle incoming messages from content scripts and popup UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SAVE_TO_SHEET") {
    appendProblemRow(message.payload)
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.error("[HintFlow] Error saving to Google Sheet:", err);
        sendResponse({ success: false, error: err.message || "Failed to save to Google Sheet." });
      });
    return true; // Async response
  }

  if (message.action === "GET_SHEET_INFO") {
    chrome.storage.local.get([STORAGE_KEYS.SPREADSHEET_ID, STORAGE_KEYS.SAVED_COUNT]).then((stored) => {
      const spreadsheetId = stored[STORAGE_KEYS.SPREADSHEET_ID] || null;
      sendResponse({
        spreadsheetId,
        savedCount: stored[STORAGE_KEYS.SAVED_COUNT] || 0,
        spreadsheetUrl: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null,
      });
    });
    return true;
  }

  if (message.action === "AUTHENTICATE") {
    getAuthToken(true)
      .then((token) => sendResponse({ success: true, token }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

console.log("[HintFlow] Background service worker initialized with Google Sheets integration.");