(function (globalScope) {
  let utils;
  if (typeof require !== "undefined") {
    utils = require("./utils.js");
  } else {
    utils = globalScope.HintFlowParser.utils;
  }

  class LanguageParser {
    constructor(doc, win, parent) {
      this.document = doc;
      this.window = win;
      this.parent = parent;
    }

    getLanguage() {
      const models = this.window.monaco?.editor?.getModels?.() || [];
      const activeModel = models.find((model) => {
        try {
          return typeof model.getValue === "function" && model.getValue().trim().length > 0;
        } catch {
          return false;
        }
      }) || models[0];

      if (activeModel && typeof activeModel.getLanguageId === "function") {
        return activeModel.getLanguageId() || "";
      }

      const editorLanguage = this.findLanguageFromDom();

      return editorLanguage || "";
    }

    findLanguageFromDom() {
      const candidates = this.parent.descriptionParser.queryTextNodes([
        /language\s*[:\-]?\s*(javascript|typescript|python3?|java|cpp|c\+\+|c#|go|rust|kotlin|swift|ruby|php|scala|dart|sql|mysql|mssql|bash|shell)/i,
        /^(javascript|typescript|python3?|java|cpp|c\+\+|c#|go|rust|kotlin|swift|ruby|php|scala|dart|sql|mysql|mssql|bash|shell)$/i,
      ]);

      for (const candidate of candidates) {
        const match = candidate.match(/(javascript|typescript|python3?|java|cpp|c\+\+|c#|go|rust|kotlin|swift|ruby|php|scala|dart|sql|mysql|mssql|bash|shell)/i);

        if (match) {
          return utils.normalizeLanguage(match[1]);
        }
      }

      return "";
    }
  }

  globalScope.HintFlowParser = globalScope.HintFlowParser || {};
  globalScope.HintFlowParser.LanguageParser = LanguageParser;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = LanguageParser;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
