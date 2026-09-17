/**
 * HintFlow Background Service Worker
 * Handles OAuth authentication with Google and Sheets API integration.
 */

const SPREADSHEET_TITLE = "HintFlow — LeetCode Tracker";
const SHEET_HEADERS = ["Date", "Problem", "Difficulty", "Language", "Time Taken (min)", "Note"];
const STORAGE_KEYS = {
  SPREADSHEET_ID: "hintflow_spreadsheet_id",
  SAVED_COUNT: "hintflow_saved_count",
  SHEETS_LIST: "hintflow_sheets_list",
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
 * Helper to convert Hex color code to RGB color object for Sheets API (values 0 to 1)
 */
function hexToRgbColor(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return { red: r, green: g, blue: b };
}

/**
 * Get sheet ID from the spreadsheet (backwards compatible for existing sheets)
 */
async function getSheetId(spreadsheetId) {
  const stored = await chrome.storage.local.get(["hintflow_sheet_id"]);
  if (stored.hintflow_sheet_id !== undefined) {
    return stored.hintflow_sheet_id;
  }
  console.log("[HintFlow] Fetching sheet metadata for ID recovery...");
  const res = await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
  if (!res.ok) {
    throw new Error(`Failed to get sheet metadata: ${res.status}`);
  }
  const data = await res.json();
  const sheetId = data.sheets?.[0]?.properties?.sheetId || 0;
  await chrome.storage.local.set({ hintflow_sheet_id: sheetId });
  return sheetId;
}

/**
 * Construct batchUpdate requests to style headers, size columns, format cells, and create color badges
 */
function formatRowRequest(sheetId, rowIndex, difficulty) {
  let diffBg = "#F3F4F6";
  let diffFg = "#374151";
  const normalizedDiff = (difficulty || "Medium").toLowerCase().trim();
  if (normalizedDiff === "easy") {
    diffBg = "#DEF7EC"; // Soft Green
    diffFg = "#03543F"; // Dark Green
  } else if (normalizedDiff === "medium") {
    diffBg = "#FEF3C7"; // Soft Orange
    diffFg = "#92400E"; // Dark Orange
  } else if (normalizedDiff === "hard") {
    diffBg = "#FDE8E8"; // Soft Red
    diffFg = "#9B1C1C"; // Dark Red
  }

  return [
    // 1. Header Row Formatting (bold, white text, Slate background)
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 6
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgbColor("#1E293B"),
            textFormat: {
              foregroundColor: hexToRgbColor("#FFFFFF"),
              fontSize: 11,
              bold: true,
              fontFamily: "Arial"
            },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
      }
    },
    // 2. Set Column Widths (A: Date, B: Problem, C: Difficulty, D: Language, E: Time Taken, F: Note)
    {
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 110 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 260 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 110 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 },
        properties: { pixelSize: 100 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 },
        properties: { pixelSize: 140 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 },
        properties: { pixelSize: 350 },
        fields: "pixelSize"
      }
    },
    // 3. Base cell format for data row (font Arial 10, vertical align middle)
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 6
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              foregroundColor: hexToRgbColor("#1F2937"),
              fontSize: 10,
              fontFamily: "Arial"
            },
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(textFormat,verticalAlignment)"
      }
    },
    // 4. Center Date
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment)"
      }
    },
    // 5. Bold and Left-align Problem Title
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: 1,
          endColumnIndex: 2
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true,
              foregroundColor: hexToRgbColor("#111827")
            },
            horizontalAlignment: "LEFT"
          }
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment)"
      }
    },
    // 6. Style Difficulty as a beautiful badge
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: 2,
          endColumnIndex: 3
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgbColor(diffBg),
            textFormat: {
              bold: true,
              foregroundColor: hexToRgbColor(diffFg),
              fontSize: 10
            },
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
      }
    },
    // 7. Center Language
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: 3,
          endColumnIndex: 4
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment)"
      }
    },
    // 8. Center Time Taken
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: 4,
          endColumnIndex: 5
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment)"
      }
    },
    // 9. Wrap Note
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: 5,
          endColumnIndex: 6
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "LEFT",
            wrapStrategy: "WRAP"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment,wrapStrategy)"
      }
    }
  ];
}

/**
 * Check if the spreadsheet is active and not trashed in Google Drive
 */
async function checkSpreadsheetActive(spreadsheetId) {
  try {
    const res = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=trashed`);
    if (res.ok) {
      const metadata = await res.json();
      return metadata.trashed === false;
    }
  } catch (err) {
    console.error("[HintFlow] Error checking spreadsheet active state:", err);
  }
  return false;
}

/**
 * Get stored list of spreadsheets created by user
 */
async function getStoredSheetsList() {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.SHEETS_LIST, STORAGE_KEYS.SPREADSHEET_ID]);
  let list = stored[STORAGE_KEYS.SHEETS_LIST] || [];
  const activeId = stored[STORAGE_KEYS.SPREADSHEET_ID] || null;

  // Auto-heal/migrate: if list is empty but activeId exists, record it
  if (list.length === 0 && activeId) {
    list = [{
      id: activeId,
      name: SPREADSHEET_TITLE,
      url: `https://docs.google.com/spreadsheets/d/${activeId}`,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    }];
    await chrome.storage.local.set({ [STORAGE_KEYS.SHEETS_LIST]: list });
  }

  return { list, activeId };
}

/**
 * Record or update a spreadsheet in user's saved sheets list
 */
async function recordSheetInList(spreadsheetId, sheetName) {
  const { list } = await getStoredSheetsList();
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  const now = new Date().toISOString();
  const existingIdx = list.findIndex((s) => s.id === spreadsheetId);

  if (existingIdx >= 0) {
    if (sheetName) list[existingIdx].name = sheetName;
    list[existingIdx].lastUsedAt = now;
  } else {
    list.unshift({
      id: spreadsheetId,
      name: sheetName || SPREADSHEET_TITLE,
      url: url,
      createdAt: now,
      lastUsedAt: now
    });
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.SHEETS_LIST]: list,
    [STORAGE_KEYS.SPREADSHEET_ID]: spreadsheetId
  });
}

/**
 * Create a new spreadsheet with a custom title and initialize formatted headers
 */
async function createNewSpreadsheet(title) {
  const sheetTitle = (title || "").trim() || SPREADSHEET_TITLE;
  console.log(`[HintFlow] Creating new Google Sheet with title: "${sheetTitle}"...`);

  // 1. Create spreadsheet
  const createRes = await fetchWithAuth("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        title: sheetTitle,
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
  const sheetId = sheetData.sheets?.[0]?.properties?.sheetId || 0;

  // Save spreadsheetId and sheetId to chrome.storage.local
  await chrome.storage.local.set({
    [STORAGE_KEYS.SPREADSHEET_ID]: spreadsheetId,
    hintflow_sheet_id: sheetId
  });

  // 2. Set header row
  const headerRes = await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:F1?valueInputOption=USER_ENTERED`,
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

  // 3. Record in sheets list
  await recordSheetInList(spreadsheetId, sheetTitle);

  return spreadsheetId;
}

/**
 * Get existing spreadsheetId from storage, or auto-create a new Google Sheet
 */
async function getOrCreateSpreadsheet(customTitle) {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.SPREADSHEET_ID]);
  if (stored[STORAGE_KEYS.SPREADSHEET_ID]) {
    const spreadsheetId = stored[STORAGE_KEYS.SPREADSHEET_ID];
    const isActive = await checkSpreadsheetActive(spreadsheetId);
    if (isActive) {
      return spreadsheetId;
    }
    console.warn("[HintFlow] Cached Google Sheet is trashed or invalid. Re-creating sheet...");
    await chrome.storage.local.remove([STORAGE_KEYS.SPREADSHEET_ID, "hintflow_sheet_id"]);
  }

  return await createNewSpreadsheet(customTitle || SPREADSHEET_TITLE);
}

/**
 * Check if the first row matches SHEET_HEADERS. If not (e.g. existing spreadsheets), update it.
 */
async function ensureHeadersAreUpToDate(spreadsheetId) {
  try {
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:F1`;
    const res = await fetchWithAuth(headerUrl);
    if (res.ok) {
      const data = await res.json();
      const currentHeaders = data.values?.[0] || [];
      const needsUpdate = currentHeaders.length !== SHEET_HEADERS.length ||
        currentHeaders.some((val, idx) => val !== SHEET_HEADERS[idx]);

      if (needsUpdate) {
        console.log("[HintFlow] Sheet headers are missing or outdated. Self-healing/updating schema...");
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:F1?valueInputOption=USER_ENTERED`;
        await fetchWithAuth(updateUrl, {
          method: "PUT",
          body: JSON.stringify({ values: [SHEET_HEADERS] })
        });
      }
    }
  } catch (err) {
    console.error("[HintFlow] Failed to check/repair headers:", err);
  }
}

/**
 * Append problem row to the Google Sheet and format it professionally
 */
async function appendProblemRowInternal(data) {
  const { date, problem, difficulty, language, timeTaken, note, targetSpreadsheetId, createNewSheet, newSheetTitle } = data;

  let spreadsheetId = targetSpreadsheetId;

  if (createNewSheet || !spreadsheetId) {
    if (createNewSheet) {
      spreadsheetId = await createNewSpreadsheet(newSheetTitle);
    } else {
      spreadsheetId = await getOrCreateSpreadsheet();
    }
  }

  // Check if target spreadsheet is still active and valid in Drive
  const isActive = await checkSpreadsheetActive(spreadsheetId);
  if (!isActive) {
    console.warn("[HintFlow] Target sheet is inaccessible or trashed. Creating fresh sheet...");
    spreadsheetId = await createNewSpreadsheet(newSheetTitle || SPREADSHEET_TITLE);
  }

  // Auto-heal/align spreadsheet headers if they are outdated or missing
  await ensureHeadersAreUpToDate(spreadsheetId);

  const sheetId = await getSheetId(spreadsheetId);

  // 1. Append row
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`;
  const appendRes = await fetchWithAuth(appendUrl, {
    method: "POST",
    body: JSON.stringify({
      values: [[date, problem, difficulty, language || "", timeTaken, note || ""]],
    }),
  });

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    throw new Error(`Failed to append row to Google Sheet: ${appendRes.status} ${errText}`);
  }

  const appendData = await appendRes.json();

  // 2. Apply professional formatting to the appended row
  try {
    const updatedRange = appendData.updates?.updatedRange;
    if (updatedRange) {
      const match = updatedRange.match(/A(\d+):[A-Z]+(\d+)/);
      if (match) {
        const rowNumber = parseInt(match[1]);
        const rowIndex = rowNumber - 1; // 0-based
        console.log(`[HintFlow] Formatting newly appended row at index ${rowIndex}...`);

        const requests = formatRowRequest(sheetId, rowIndex, difficulty);
        const formatUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
        const formatRes = await fetchWithAuth(formatUrl, {
          method: "POST",
          body: JSON.stringify({ requests }),
        });

        if (!formatRes.ok) {
          console.warn("[HintFlow] Warning: Failed to apply formatting to row.", await formatRes.text());
        }
      }
    }
  } catch (formatErr) {
    console.error("[HintFlow] Error styling appended row:", formatErr);
  }

  // Update sheet in list as recently used
  await recordSheetInList(spreadsheetId);

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

async function appendProblemRow(data) {
  try {
    return await appendProblemRowInternal(data);
  } catch (err) {
    const errMsg = (err.message || "").toLowerCase();
    // If the spreadsheet was deleted/not found/denied, clear local cache and retry once to auto-create a new sheet
    if (errMsg.includes("404") || errMsg.includes("not found") || errMsg.includes("403") || errMsg.includes("notfound")) {
      console.warn("[HintFlow] Cached Google Sheet was deleted or is inaccessible. Clearing cache and re-creating...");
      await chrome.storage.local.remove([STORAGE_KEYS.SPREADSHEET_ID, "hintflow_sheet_id"]);
      return await appendProblemRowInternal(data);
    }
    throw err;
  }
}

// Handle incoming messages from content scripts and popup UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_SHEETS_LIST") {
    getStoredSheetsList()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ list: [], activeId: null, error: err.message }));
    return true; // Async response
  }

  if (message.action === "SAVE_TO_SHEET") {
    appendProblemRow(message.payload)
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.error("[HintFlow] Error saving to Google Sheet:", err);
        sendResponse({ success: false, error: err.message || "Failed to save to Google Sheet." });
      });
    return true; // Async response
  }

  if (message.action === "RESET_SPREADSHEET") {
    chrome.storage.local.remove([STORAGE_KEYS.SPREADSHEET_ID, "hintflow_sheet_id"]).then(() => {
      sendResponse({ success: true });
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