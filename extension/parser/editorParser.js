(function (globalScope) {
  class EditorParser {
    constructor(doc, win, parent) {
      this.document = doc;
      this.window = win;
      this.parent = parent;
    }

    getUserCode() {
      const models = this.window.monaco?.editor?.getModels?.() || [];
      const activeModel = models.find((model) => {
        try {
          return typeof model.getValue === "function" && model.getValue().trim().length > 0;
        } catch {
          return false;
        }
      }) || models[0];

      if (activeModel && typeof activeModel.getValue === "function") {
        return activeModel.getValue();
      }

      const textArea = this.document.querySelector("textarea");

      if (textArea && typeof textArea.value === "string") {
        return textArea.value;
      }

      return "";
    }
  }

  globalScope.HintFlowParser = globalScope.HintFlowParser || {};
  globalScope.HintFlowParser.EditorParser = EditorParser;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = EditorParser;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
