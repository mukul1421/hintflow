(function () {
  const ParserClass = window.HintFlowParser?.LeetCodeParser || window.LeetCodeParser;
  const SidebarClass = window.HintFlowSidebar;
  const rootId = "hintflow-root";

  let parser = null;
  let sidebar = null;
  let routeObserverStarted = false;

  const isProblemRoute = () =>
    /^\/problems\/[^/]+/i.test(window.location.pathname);

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

  const syncToRoute = () => {
    if (!isProblemRoute()) {
      removeSidebar();
      return;
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
    
    // Watch SPA DOM mutations because LeetCode transitions can occur without full reloads
    const observer = new MutationObserver(() => {
      if (isProblemRoute() && !document.getElementById(rootId)) {
        syncToRoute();
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