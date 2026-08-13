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
})();
