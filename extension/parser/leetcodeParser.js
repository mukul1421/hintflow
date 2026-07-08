(function (globalScope) {
  let utils, ProblemParser, DescriptionParser, EditorParser, LanguageParser;

  if (typeof require !== "undefined") {
    utils = require("./utils.js");
    ProblemParser = require("./problemParser.js");
    DescriptionParser = require("./descriptionParser.js");
    EditorParser = require("./editorParser.js");
    LanguageParser = require("./languageParser.js");
  } else {
    utils = globalScope.HintFlowParser.utils;
    ProblemParser = globalScope.HintFlowParser.ProblemParser;
    DescriptionParser = globalScope.HintFlowParser.DescriptionParser;
    EditorParser = globalScope.HintFlowParser.EditorParser;
    LanguageParser = globalScope.HintFlowParser.LanguageParser;
  }

  class LeetCodeParser {
    constructor(doc = globalScope.document, win = globalScope) {
      this.document = doc;
      this.window = win;
      this.utils = utils;
      this.problemParser = new ProblemParser(doc, win, this);
      this.descriptionParser = new DescriptionParser(doc, win, this);
      this.editorParser = new EditorParser(doc, win, this);
      this.languageParser = new LanguageParser(doc, win, this);
    }

    getProblemInfo() {
      return this.problemParser.getProblemInfo();
    }

    getDifficulty() {
      return this.problemParser.getDifficulty();
    }

    getDescription() {
      return this.descriptionParser.getDescription();
    }

    getExamples() {
      return this.descriptionParser.getExamples();
    }

    getConstraints() {
      return this.descriptionParser.getConstraints();
    }

    getLanguage() {
      return this.languageParser.getLanguage();
    }

    getUserCode() {
      return this.editorParser.getUserCode();
    }

    isLikelyLeetCodeUrl() {
      return this.utils.isLikelyLeetCodeUrl(this.window.location?.href || "");
    }
  }

  globalScope.HintFlowParser = globalScope.HintFlowParser || {};
  globalScope.HintFlowParser.LeetCodeParser = LeetCodeParser;
  globalScope.LeetCodeParser = LeetCodeParser;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      LeetCodeParser,
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);