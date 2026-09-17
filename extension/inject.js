(function () {
  function getMonacoCodeAndLanguage() {
    try {
      const models = window.monaco?.editor?.getModels?.() || [];
      const activeModel = models.find((model) => {
        try {
          return typeof model.getValue === "function" && model.getValue().trim().length > 0;
        } catch {
          return false;
        }
      }) || models[0];

      if (activeModel) {
        return {
          code: activeModel.getValue() || "",
          language: activeModel.getLanguageId() || ""
        };
      }
    } catch (e) {
      // Quiet fail if Monaco isn't initialized yet
    }
    return null;
  }

  let lastCode = "";
  let lastLang = "";

  function checkAndNotify(force = false) {
    const editorState = getMonacoCodeAndLanguage();
    if (editorState) {
      if (force || editorState.code !== lastCode || editorState.language !== lastLang) {
        lastCode = editorState.code;
        lastLang = editorState.language;

        // Broadcast to ISOLATED world content script via CustomEvent
        window.dispatchEvent(new CustomEvent("hintflow:code-changed", {
          detail: {
            code: lastCode,
            language: lastLang
          }
        }));
      }
    }
  }

  // Poll Monaco every second to check for changes
  const intervalId = setInterval(() => {
    checkAndNotify();
  }, 1000);

  // Listen for immediate request from isolated content script
  window.addEventListener("hintflow:request-code", () => {
    checkAndNotify(true);
  });

  // -------------------------------------------------------------
  // LeetCode Network Interception for Live Submissions
  // Accurately catches live judgment check results and ignores
  // historical submission views (which never hit the /check/ endpoint).
  // -------------------------------------------------------------

  function handleCheckResponse(data) {
    if (!data || typeof data !== "object") return;

    if (data.state === "SUCCESS") {
      const isAccepted = data.status_msg === "Accepted" || data.status_code === 10;
      if (isAccepted) {
        window.dispatchEvent(new CustomEvent("hintflow:submission-accepted", {
          detail: {
            submissionId: String(data.submission_id || Date.now()),
            runtime: data.status_runtime || (data.runtime ? `${data.runtime} ms` : ""),
            runtimeBeats: (data.runtime_percentile !== undefined && data.runtime_percentile !== null)
              ? `${Number(data.runtime_percentile).toFixed(1)}%`
              : "",
            memory: data.status_memory || (data.memory ? `${data.memory}` : ""),
            memoryBeats: (data.memory_percentile !== undefined && data.memory_percentile !== null)
              ? `${Number(data.memory_percentile).toFixed(1)}%`
              : "",
            language: data.lang || "",
            questionId: data.question_id || ""
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("hintflow:submission-rejected", {
          detail: {
            submissionId: String(data.submission_id || ""),
            statusMsg: data.status_msg || "Not Accepted"
          }
        }));
      }
    }
  }

  // Intercept window.fetch
  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      let url = "";
      try {
        if (typeof args[0] === "string") url = args[0];
        else if (args[0] && typeof args[0].url === "string") url = args[0].url;
      } catch (e) {}

      // Track submit action
      try {
        const isSubmitUrl = url.includes("/submit/") || url.endsWith("/submit");
        const bodyStr = typeof args[1]?.body === "string" ? args[1].body : "";
        const isGraphQLSubmit = bodyStr.includes("submitCode") || bodyStr.includes("SubmitCode");
        if (isSubmitUrl || isGraphQLSubmit) {
          window.dispatchEvent(new CustomEvent("hintflow:submit-started", {
            detail: { url, timestamp: Date.now() }
          }));
        }
      } catch (e) {}

      const response = await originalFetch.apply(this, args);

      // Intercept live check poll response
      try {
        if (url.includes("/submissions/detail/") && url.includes("/check/")) {
          const clone = response.clone();
          clone.json().then((data) => {
            handleCheckResponse(data);
          }).catch(() => {});
        }
      } catch (e) {}

      return response;
    };
  }

  // Intercept XMLHttpRequest
  if (typeof window.XMLHttpRequest === "function") {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._hfUrl = typeof url === "string" ? url : "";
      this._hfMethod = method;
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const url = this._hfUrl || "";
      if (url.includes("/submit/") || (typeof body === "string" && body.includes("submitCode"))) {
        window.dispatchEvent(new CustomEvent("hintflow:submit-started", {
          detail: { url, timestamp: Date.now() }
        }));
      }

      this.addEventListener("load", function () {
        if (url.includes("/submissions/detail/") && url.includes("/check/")) {
          try {
            const data = JSON.parse(this.responseText);
            handleCheckResponse(data);
          } catch (e) {}
        }
      });

      return originalSend.call(this, body);
    };
  }
})();
