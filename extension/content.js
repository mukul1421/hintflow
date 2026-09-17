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
  let codeWasSubmitted = false;
  let submitTime = 0;

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

  const extractSubmissionStats = (container) => {
    const stats = {
      runtime: "",
      runtimeBeats: "",
      memory: "",
      memoryBeats: "",
    };

    if (!container) return stats;
    const text = container.innerText || container.textContent || "";

    // 1. Matches "Runtime 1 ms" or "Runtime: 1 ms"
    const rtMatch = text.match(/Runtime\s*:\s*([\d\.]+\s*ms)/i) || text.match(/Runtime\s+([\d\.]+\s*ms)/i);
    if (rtMatch) stats.runtime = rtMatch[1];

    // 2. Matches "Memory 43.5 MB" or "Memory: 43.5 MB"
    const memMatch = text.match(/Memory\s*:\s*([\d\.]+\s*(?:MB|KB))/i) || text.match(/Memory\s+([\d\.]+\s*(?:MB|KB))/i);
    if (memMatch) stats.memory = memMatch[1];

    // 3. Find beats percentages (Runtime beats is the 1st match, Memory beats is the 2nd)
    const beats = [...text.matchAll(/Beats\s*([\d\.]+%)/gi)];
    if (beats.length >= 1) stats.runtimeBeats = beats[0][1];
    if (beats.length >= 2) stats.memoryBeats = beats[1][1];

    return stats;
  };

  const handledSubmissions = new Set();

  const handleAcceptedSubmission = (detail = {}) => {
    if (!isProblemRoute()) return;

    // Immediately reset submit flags
    codeWasSubmitted = false;
    submitTime = 0;

    const subId = detail.submissionId ? String(detail.submissionId) : null;
    if (subId && handledSubmissions.has(subId)) {
      console.log("[HintFlow] Submission already processed:", subId);
      return;
    }
    if (subId) {
      handledSubmissions.add(subId);
    }

    const slug = getSlugFromPath();
    const activeParser = getParser();
    const problemInfo = activeParser ? activeParser.getProblemInfo() : { title: slug };
    const problemNumber = activeParser ? activeParser.getProblemNumber() : "";
    const title = problemInfo.title || slug;
    const fullTitle = problemNumber ? `${problemNumber}. ${title}` : title;

    const difficulty = activeParser ? activeParser.getDifficulty() : "Medium";
    const language = detail.language || (activeParser ? activeParser.getLanguage() : "");

    const startTime = solveStartTimes[slug] || Date.now();
    const timeTakenMin = Math.max(1, Math.round((Date.now() - startTime) / 60000));

    let defaultNote = "";
    if (detail.runtime || detail.memory) {
      const parts = [];
      if (detail.runtime) parts.push(`Runtime: ${detail.runtime} ${detail.runtimeBeats ? `(Beats ${detail.runtimeBeats})` : ''}`.trim());
      if (detail.memory) parts.push(`Memory: ${detail.memory} ${detail.memoryBeats ? `(Beats ${detail.memoryBeats})` : ''}`.trim());
      defaultNote = parts.join("\n");
    }

    console.log("[HintFlow] Opening Accepted Solution Modal for:", fullTitle);
    if (sidebar) {
      sidebar.openAcceptedModal({
        submissionId: subId,
        title: fullTitle,
        difficulty,
        timeTakenMin,
        slug,
        language,
        runtime: detail.runtime || "",
        runtimeBeats: detail.runtimeBeats || "",
        memory: detail.memory || "",
        memoryBeats: detail.memoryBeats || "",
        note: defaultNote
      });
    }
  };

  const checkAcceptedResult = () => {
    if (!isProblemRoute()) return;

    // Never check or trigger if viewing submissions history page
    if (window.location.pathname.includes("/submissions/")) return;

    // Check if a live submission was actually initiated within a 45-second window
    if (!codeWasSubmitted) return;
    if (Date.now() - submitTime > 45000) {
      codeWasSubmitted = false;
      submitTime = 0;
      return;
    }

    // Look for live submission result elements on LeetCode SPA
    const acceptedElements = [
      ...document.querySelectorAll('[data-e2e-locator="submission-result"]'),
      ...document.querySelectorAll('.text-sd-success-500'),
      ...document.querySelectorAll('.text-green-s'),
      ...document.querySelectorAll('.text-success')
    ].filter((el) => {
      const text = (el.innerText || el.textContent || "").trim();
      if (text !== "Accepted" || el.children.length > 0) return false;

      // Filter out past submissions list rows, navigation tabs, tables, or buttons
      const isTabOrList = el.closest('a') || el.closest('tr') || el.closest('button') || el.closest('[role="tab"]') || el.closest('table');
      if (isTabOrList) return false;

      return true;
    });

    if (acceptedElements.length === 0) return;

    const acceptedNode = acceptedElements[0];
    const parentContainer = acceptedNode.closest('[data-e2e-locator="submission-result"]') ||
      acceptedNode.closest('.flex.flex-col') ||
      acceptedNode.parentElement;

    if (!parentContainer) return;

    // Deduplication check
    const slug = getSlugFromPath();
    const submissionKey = `${slug}_dom_${acceptedNode.innerText}_${parentContainer.childElementCount}`;
    if (lastDetectedSubmissionKey === submissionKey) return;
    lastDetectedSubmissionKey = submissionKey;

    codeWasSubmitted = false;
    submitTime = 0;

    const stats = extractSubmissionStats(parentContainer);
    handleAcceptedSubmission({
      submissionId: `dom_${Date.now()}`,
      runtime: stats.runtime,
      runtimeBeats: stats.runtimeBeats,
      memory: stats.memory,
      memoryBeats: stats.memoryBeats
    });
  };

  const syncToRoute = () => {
    if (!isProblemRoute()) {
      removeSidebar();
      currentProblemSlug = null;
      lastDetectedSubmissionKey = null;
      codeWasSubmitted = false;
      submitTime = 0;
      return;
    }

    const slug = getSlugFromPath();
    if (slug && slug !== currentProblemSlug) {
      currentProblemSlug = slug;
      lastDetectedSubmissionKey = null;
      codeWasSubmitted = false;
      submitTime = 0;
      if (!solveStartTimes[slug]) {
        solveStartTimes[slug] = Date.now();
      }
    }

    renderSidebar();
  };

  const watchRouteChanges = () => {
    if (routeObserverStarted) return;
    routeObserverStarted = true;

    // Listen for live Accepted event dispatched by inject.js network interception
    window.addEventListener("hintflow:submission-accepted", (e) => {
      console.log("[HintFlow] Live submission-accepted network event detected:", e.detail);
      handleAcceptedSubmission(e.detail);
    });

    // Reset submit flags if submission failed or was rejected
    window.addEventListener("hintflow:submission-rejected", (e) => {
      console.log("[HintFlow] Submission was not accepted:", e.detail);
      codeWasSubmitted = false;
      submitTime = 0;
    });

    // Listen for submit started event from inject.js
    window.addEventListener("hintflow:submit-started", () => {
      console.log("[HintFlow] Live submit request initiated.");
      codeWasSubmitted = true;
      submitTime = Date.now();
    });

    // Click listener to watch for Submit clicks and reset on history clicks
    document.addEventListener("click", (e) => {
      // 1. Reset immediately if clicking any submission history link or anchor
      const anchor = e.target.closest("a");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        if (href.includes("/submissions/")) {
          console.log("[HintFlow] Clicked historical submission link. Resetting submit flags.");
          codeWasSubmitted = false;
          submitTime = 0;
          return;
        }
      }

      // 2. Reset if clicking any tab buttons (Submissions, Solutions, Editorial, Description)
      const tabEl = e.target.closest('[role="tab"]') || e.target.closest('button');
      if (tabEl) {
        const text = (tabEl.innerText || tabEl.textContent || "").trim();
        if (/submissions|solutions|editorial|description/i.test(text)) {
          codeWasSubmitted = false;
          submitTime = 0;
        }
      }

      // 3. Track Submit button click
      const button = e.target.closest("button");
      if (button) {
        const text = (button.innerText || button.textContent || "").trim();
        const locator = button.getAttribute("data-e2e-locator");
        if (text === "Submit" || locator === "console-submit-button") {
          console.log("[HintFlow] Submit button clicked. Tracking live submission...");
          codeWasSubmitted = true;
          submitTime = Date.now();
        }
      }
    });

    // Keyboard listener to watch for Ctrl/Cmd + Enter submissions
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        console.log("[HintFlow] Submission shortcut (Ctrl/Cmd + Enter) detected. Tracking live submission...");
        codeWasSubmitted = true;
        submitTime = Date.now();
      }
    });

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

    window.addEventListener("popstate", () => {
      codeWasSubmitted = false;
      submitTime = 0;
      notifyRouteChange();
    });
    window.addEventListener("hintflow:routechange", syncToRoute);

    // Watch SPA DOM mutations for route sync & fallback Accepted status detection
    const observer = new MutationObserver(() => {
      if (isProblemRoute()) {
        if (!document.getElementById(rootId)) {
          syncToRoute();
        }
        if (codeWasSubmitted) {
          checkAcceptedResult();
        }
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