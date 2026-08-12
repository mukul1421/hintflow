(function () {
  const ParserClass = window.HintFlowParser?.LeetCodeParser || window.LeetCodeParser;
  const SidebarClass = window.HintFlowSidebar;
  const rootId = "hintflow-root";

  let parser = null;
  let sidebar = null;
  let routeObserverStarted = false;

  // Track solve start times keyed by problem slug
  const solveStartTimes = {};
  let currentProblemSlug = null;
  let lastDetectedSubmissionKey = null;

  const isProblemRoute = () =>
    /^\/problems\/[^/]+/i.test(window.location.pathname);

  const getSlugFromPath = () => {
    const match = window.location.pathname.match(/^\/problems\/([^/]+)/i);
    return match ? match[1] : null;
  };

  const getParser = () => {
    if (!ParserClass) return null;
    if (!parser) {
      parser = new ParserClass();
      window.parser = parser;
    }
    return parser;
  };

  const removeSidebar = () => {
    document.getElementById(rootId)?.remove();
    sidebar = null;
    document.body.classList.remove('hintflow-sidebar-open');
  };

  const renderSidebar = () => {
    const activeParser = getParser();
    if (!activeParser || !isProblemRoute()) {
      removeSidebar();
      return;
    }

    const problemInfo = activeParser.getProblemInfo();
    if (!problemInfo.slug && !problemInfo.title) {
      // DOM might not be fully loaded. Let's wait and retry.
      setTimeout(renderSidebar, 1000);
      return;
    }

    let rootEl = document.getElementById(rootId);
    if (!rootEl) {
      rootEl = document.createElement("div");
      rootEl.id = rootId;
      document.body.appendChild(rootEl);

      if (SidebarClass) {
        sidebar = new SidebarClass(rootEl, activeParser);
        console.log("[HintFlow] Sidebar initialized.");
      } else {
        console.error("[HintFlow] HintFlowSidebar class not found.");
      }
    }
  };

  // --- "Save to HintFlow" Google Sheet Feature Logic ---

  const injectSaveCard = (targetContainer, problemData) => {
    // Avoid injecting duplicate cards into the same panel
    if (targetContainer.querySelector(".hintflow-save-card")) return;

    const cardEl = document.createElement("div");
    cardEl.className = "hintflow-save-card";
    cardEl.id = "hintflow-save-card";

    const { title, difficulty, timeTakenMin } = problemData;

    cardEl.innerHTML = `
      <div class="hintflow-save-header">
        <div class="hintflow-save-title">
          <span>📊 Save to HintFlow Sheet</span>
        </div>
        <span class="hintflow-save-badge">${difficulty || "Medium"}</span>
      </div>
      <div class="hintflow-save-field">
        <label>Time Taken (minutes)</label>
        <input type="number" id="hintflow-time-input" class="hintflow-save-input" value="${timeTakenMin}" min="1" />
      </div>
      <div class="hintflow-save-field">
        <label>Short Note (optional)</label>
        <textarea id="hintflow-note-input" class="hintflow-save-textarea" placeholder="Key approach, complexity, hints used..."></textarea>
      </div>
      <div class="hintflow-save-actions">
        <button id="hintflow-save-btn" class="hintflow-btn-primary">
          Save to Sheet
        </button>
      </div>
      <div id="hintflow-status-msg" class="hintflow-status-msg"></div>
    `;

    targetContainer.appendChild(cardEl);

    const saveBtn = cardEl.querySelector("#hintflow-save-btn");
    const timeInput = cardEl.querySelector("#hintflow-time-input");
    const noteInput = cardEl.querySelector("#hintflow-note-input");
    const statusMsg = cardEl.querySelector("#hintflow-status-msg");

    saveBtn.addEventListener("click", () => {
      // 1. Double-save protection: lock button immediately
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      statusMsg.innerHTML = "";

      const today = new Date().toISOString().split("T")[0];
      const payload = {
        date: today,
        problem: title || currentProblemSlug,
        difficulty: difficulty || "Medium",
        timeTaken: Number(timeInput.value) || timeTakenMin,
        note: noteInput.value.trim(),
      };

      // Send to background service worker (ISOLATED world extension API call)
      chrome.runtime.sendMessage({ action: "SAVE_TO_SHEET", payload }, (response) => {
        if (chrome.runtime.lastError) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Retry Save";
          statusMsg.innerHTML = `<span class="hintflow-status-error">Error: ${chrome.runtime.lastError.message}</span>`;
          return;
        }

        if (response && response.success) {
          saveBtn.textContent = "Saved ✓";
          saveBtn.disabled = true;
          statusMsg.innerHTML = `<span class="hintflow-status-success">Saved to Google Sheet! <a href="${response.spreadsheetUrl}" target="_blank" style="color: #34d399; text-decoration: underline;">View Sheet ↗</a></span>`;
        } else {
          saveBtn.disabled = false;
          saveBtn.textContent = "Retry Save";
          statusMsg.innerHTML = `<span class="hintflow-status-error">Error: ${response?.error || "Failed to save."}</span>`;
        }
      });
    });
  };

  const checkAcceptedResult = () => {
    if (!isProblemRoute()) return;

    // Look for submission result elements on LeetCode SPA
    const acceptedElements = [
      ...document.querySelectorAll('[data-e2e-locator="submission-result"]'),
      ...document.querySelectorAll('.text-sd-success-500'),
      ...document.querySelectorAll('.text-green-s'),
      ...document.querySelectorAll('.text-success'),
      ...document.querySelectorAll('span, div')
    ].filter((el) => {
      const text = el.innerText || el.textContent || "";
      return text.trim() === "Accepted" && el.children.length === 0;
    });

    if (acceptedElements.length === 0) return;

    const acceptedNode = acceptedElements[0];
    const parentContainer = acceptedNode.closest('[data-e2e-locator="submission-result"]') ||
      acceptedNode.closest('.flex.flex-col') ||
      acceptedNode.parentElement;

    if (!parentContainer) return;

    // Deduplication check: generate key for this specific submission view
    const slug = getSlugFromPath();
    const submissionKey = `${slug}_${acceptedNode.innerText}_${parentContainer.childElementCount}`;

    if (lastDetectedSubmissionKey === submissionKey) return;
    lastDetectedSubmissionKey = submissionKey;

    const activeParser = getParser();
    const problemInfo = activeParser ? activeParser.getProblemInfo() : { title: slug };
    const difficulty = activeParser ? activeParser.getDifficulty() : "Medium";

    const startTime = solveStartTimes[slug] || Date.now();
    const timeTakenMin = Math.max(1, Math.round((Date.now() - startTime) / 60000));

    injectSaveCard(parentContainer, {
      title: problemInfo.title || slug,
      difficulty,
      timeTakenMin,
    });
  };

  const syncToRoute = () => {
    if (!isProblemRoute()) {
      removeSidebar();
      currentProblemSlug = null;
      lastDetectedSubmissionKey = null;
      return;
    }

    const slug = getSlugFromPath();
    if (slug && slug !== currentProblemSlug) {
      currentProblemSlug = slug;
      lastDetectedSubmissionKey = null;
      if (!solveStartTimes[slug]) {
        solveStartTimes[slug] = Date.now();
      }
    }

    renderSidebar();
  };

  const watchRouteChanges = () => {
    if (routeObserverStarted) return;
    routeObserverStarted = true;

    const notifyRouteChange = () => {
      window.dispatchEvent(new Event("hintflow:routechange"));
    };

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      const result = originalPushState.apply(this, arguments);
      notifyRouteChange();
      return result;
    };

    history.replaceState = function () {
      const result = originalReplaceState.apply(this, arguments);
      notifyRouteChange();
      return result;
    };

    window.addEventListener("popstate", notifyRouteChange);
    window.addEventListener("hintflow:routechange", syncToRoute);

    // Watch SPA DOM mutations for route sync & Accepted status detection
    const observer = new MutationObserver(() => {
      if (isProblemRoute()) {
        if (!document.getElementById(rootId)) {
          syncToRoute();
        }
        checkAcceptedResult();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const start = () => {
    if (!ParserClass) {
      console.warn("[HintFlow] Parser is unavailable.");
      return;
    }

    watchRouteChanges();
    syncToRoute();

    if (!document.body) {
      window.addEventListener("DOMContentLoaded", syncToRoute, {
        once: true,
      });
    }
  };

  // Wait a small delay to make sure parser and sidebar scripts are fully loaded
  setTimeout(start, 250);
})();