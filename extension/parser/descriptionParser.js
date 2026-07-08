(function (globalScope) {
  let utils;
  if (typeof require !== "undefined") {
    utils = require("./utils.js");
  } else {
    utils = globalScope.HintFlowParser.utils;
  }

  class DescriptionParser {
    constructor(doc, win, parent) {
      this.document = doc;
      this.window = win;
      this.parent = parent;
    }

    getDescription() {
      const sections = this.getStatementSections();

      return utils.cleanSectionText(
        sections.description.length ? sections.description : sections.preamble
      );
    }

    getExamples() {
      return this.getStatementSections().examples.map((exampleSection) =>
        this.parseExampleSection(exampleSection)
      );
    }

    getConstraints() {
      const sections = this.getStatementSections();

      return utils.cleanSectionText(sections.constraints);
    }

    getProblemText() {
      const root = this.findBestProblemRoot();

      return utils.normalizeWhitespace(root?.innerText || root?.textContent || "");
    }

    getStatementSections() {
      const text = this.getProblemText();
      const lines = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (!lines.length) {
        return {
          description: [],
          examples: [],
          constraints: [],
          preamble: [],
        };
      }

      const sections = [];
      let currentSection = {
        type: "preamble",
        heading: "",
        lines: [],
      };

      for (const line of lines) {
        if (utils.isExampleHeading(line)) {
          if (currentSection.lines.length || currentSection.heading) {
            sections.push(currentSection);
          }

          currentSection = {
            type: "example",
            heading: line,
            lines: [],
          };
          continue;
        }

        if (utils.isConstraintsHeading(line)) {
          if (currentSection.lines.length || currentSection.heading) {
            sections.push(currentSection);
          }

          currentSection = {
            type: "constraints",
            heading: line,
            lines: [],
          };
          continue;
        }

        currentSection.lines.push(line);
      }

      if (currentSection.lines.length || currentSection.heading) {
        sections.push(currentSection);
      }

      if (!sections.length) {
        return {
          description: lines,
          examples: [],
          constraints: [],
          preamble: [],
        };
      }

      const description = [];
      const examples = [];
      const constraints = [];
      const preamble = [];
      let hasSeenExample = false;
      let hasSeenConstraint = false;

      for (const section of sections) {
        if (section.type === "example") {
          hasSeenExample = true;
          examples.push(section);
          continue;
        }

        if (section.type === "constraints") {
          hasSeenConstraint = true;
          constraints.push(...section.lines);
          continue;
        }

        if (!hasSeenExample && !hasSeenConstraint) {
          description.push(...section.lines);
        } else {
          preamble.push(...section.lines);
        }
      }

      return {
        description,
        examples,
        constraints,
        preamble,
      };
    }

    parseExampleSection(exampleSection) {
      const raw = utils.cleanSectionText([exampleSection.heading, ...exampleSection.lines]);
      const input = this.extractFieldValue(raw, "Input");
      const output = this.extractFieldValue(raw, "Output");
      const explanation = this.extractFieldValue(raw, "Explanation");

      return {
        heading: exampleSection.heading,
        raw,
        input,
        output,
        explanation,
      };
    }

    extractFieldValue(text, fieldName) {
      const match = this.matchFieldBlock(text, fieldName);

      if (!match) {
        return "";
      }

      return utils.cleanSectionText(match);
    }

    matchFieldBlock(text, fieldName) {
      const lines = String(text || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const fieldIndex = lines.findIndex((line) => new RegExp(`^${fieldName}\\s*:\\s*`, "i").test(line));

      if (fieldIndex === -1) {
        return "";
      }

      const collected = [];
      const nextFieldPattern = /^(Input|Output|Explanation|Constraints?)\s*:/i;

      for (let index = fieldIndex; index < lines.length; index += 1) {
        const line = lines[index];

        if (index > fieldIndex && nextFieldPattern.test(line)) {
          break;
        }

        collected.push(line.replace(new RegExp(`^${fieldName}\\s*:\\s*`, "i"), ""));
      }

      return collected.join("\n").trim();
    }

    findBestProblemRoot() {
      const candidateSelectors = [
        "main",
        "article",
        "section",
        '[role="main"]',
        '[data-track-load="description_content"]',
        '[data-testid*="description"]',
      ];
      const candidates = [
        this.document.body,
        ...candidateSelectors.flatMap((selector) => [...this.document.querySelectorAll(selector)]),
      ].filter(Boolean);

      if (!candidates.length) {
        return this.document.body;
      }

      let bestCandidate = candidates[0];
      let bestScore = -1;

      for (const candidate of candidates) {
        const score = this.scoreProblemRoot(candidate);

        if (score > bestScore) {
          bestCandidate = candidate;
          bestScore = score;
        }
      }

      return bestCandidate || this.document.body;
    }

    scoreProblemRoot(element) {
      const text = utils.normalizeWhitespace(element?.innerText || element?.textContent || "");

      if (!text) {
        return -1;
      }

      let score = Math.min(text.length, 4000);

      if (/example/i.test(text)) {
        score += 2000;
      }

      if (/constraints/i.test(text)) {
        score += 2000;
      }

      if (/input\s*:/i.test(text)) {
        score += 500;
      }

      if (/output\s*:/i.test(text)) {
        score += 500;
      }

      if (/explanation\s*:/i.test(text)) {
        score += 500;
      }

      if (/constraints?/i.test(text)) {
        score += 800;
      }

      if (/you are given|given an array|given a string|solve the problem/i.test(text)) {
        score += 400;
      }

      if (/difficulty/i.test(text)) {
        score += 300;
      }

      return score;
    }

    findTextByPattern(pattern) {
      const nodes = this.queryTextNodes([pattern]);

      if (!nodes.length) {
        return "";
      }

      return nodes[0].match(pattern)?.[0] || "";
    }

    queryTextNodes(patterns) {
      const root = this.document.body || this.document.documentElement;

      if (!root || typeof this.document.createTreeWalker !== "function") {
        return [];
      }

      const walker = this.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const matches = [];

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const value = utils.cleanSectionText(node?.textContent || "");

        if (!value) {
          continue;
        }

        for (const pattern of patterns) {
          const match = value.match(pattern);

          if (match) {
            matches.push(value);
            break;
          }
        }
      }

      return matches;
    }
  }

  globalScope.HintFlowParser = globalScope.HintFlowParser || {};
  globalScope.HintFlowParser.DescriptionParser = DescriptionParser;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = DescriptionParser;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
