(function (globalScope) {
  class LeetCodeParser {
    constructor(doc = globalScope.document, win = globalScope) {
      this.document = doc;
      this.window = win;
      this.cachedProblemInfo = null;
    }

    getProblemInfo() {
      const currentUrl = this.window.location?.href || "";

      if (this.cachedProblemInfo && this.cachedProblemInfo.url === currentUrl) {
        return this.cachedProblemInfo;
      }

      const locationInfo = this.getLocationInfo();

      this.cachedProblemInfo = {
        slug: locationInfo.slug,
        title: locationInfo.title,
        url: currentUrl,
      };

      return this.cachedProblemInfo;
    }

    getDifficulty() {
      const difficulty = this.extractDifficultyFromText(this.getProblemText());

      if (difficulty) {
        return difficulty;
      }

      return this.findDifficultyFromDom();
    }

    getDescription() {
      const sections = this.getStatementSections();

      return this.cleanSectionText(
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

      return this.cleanSectionText(sections.constraints);
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

    getLocationInfo() {
      const slug = this.extractSlugFromUrl() || this.extractSlugFromCanonical() || this.extractSlugFromDom();
      const title = this.extractTitleFromDom() || (slug ? this.formatSlugToTitle(slug) : "");

      return {
        slug,
        title,
      };
    }

    extractSlugFromUrl() {
      const currentUrl = this.window.location?.href || "";

      return this.extractSlugFromUrlLike(currentUrl);
    }

    extractSlugFromUrlLike(urlLike) {
      if (!urlLike) {
        return "";
      }

      try {
        const parsedUrl = new URL(urlLike, this.window.location?.href || undefined);
        const pathname = decodeURIComponent(parsedUrl.pathname || "");
        const match = pathname.match(/^\/problems\/([^/]+)(?:\/description)?\/?$/i);

        if (match) {
          return this.cleanSlug(match[1]);
        }
      } catch {
        return "";
      }

      return "";
    }

    extractSlugFromDom() {
      const titleFromDom = this.extractTitleFromDom();

      if (titleFromDom) {
        const inferredSlug = this.slugifyTitle(titleFromDom);

        if (inferredSlug) {
          return inferredSlug;
        }
      }

      const problemLink = [...this.document.querySelectorAll('a[href*="/problems/"]')]
        .find((link) => this.extractSlugFromUrlLike(link.getAttribute("href") || ""));

      if (problemLink) {
        return this.extractSlugFromUrlLike(problemLink.getAttribute("href") || "");
      }

      const canonicalSlug = this.extractSlugFromCanonical();

      if (canonicalSlug) {
        return canonicalSlug;
      }

      return "";
    }

    extractSlugFromCanonical() {
      const canonicalLink = this.document.querySelector('link[rel="canonical"]');
      const ogUrl = this.document.querySelector('meta[property="og:url"]');
      const metaUrl = canonicalLink?.getAttribute("href") || ogUrl?.getAttribute("content") || "";

      return this.extractSlugFromUrlLike(metaUrl);
    }

    extractTitleFromDom() {
      const candidates = [
        this.document.querySelector("h1")?.textContent,
        this.document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
        this.document.querySelector("title")?.textContent,
      ];

      for (const candidate of candidates) {
        const title = this.cleanTitle(candidate || "");

        if (title) {
          return title;
        }
      }

      return "";
    }

    cleanTitle(value) {
      return (value || "")
        .replace(/\s*[-|]\s*LeetCode.*$/i, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    cleanSlug(value) {
      return (value || "")
        .trim()
        .replace(/^\/+|\/+$/g, "")
        .toLowerCase();
    }

    slugifyTitle(value) {
      return (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    formatSlugToTitle(slug) {
      return (slug || "")
        .split(/[-_]+/)
        .filter(Boolean)
        .map((word) => this.formatTitleWord(word))
        .join(" ")
        .trim();
    }

    formatTitleWord(word) {
      if (/^\d+[a-z]+$/i.test(word)) {
        return word.replace(/^(\d+)([a-z]+)$/i, (_, digits, letters) => {
          return `${digits}${letters.charAt(0).toUpperCase()}${letters.slice(1).toLowerCase()}`;
        });
      }

      if (/^[ivxlcdm]+$/i.test(word) && word.length <= 4) {
        return word.toUpperCase();
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    getProblemText() {
      const root = this.findBestProblemRoot();

      return this.normalizeWhitespace(root?.innerText || root?.textContent || "");
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
        if (this.isExampleHeading(line)) {
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

        if (this.isConstraintsHeading(line)) {
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
      const raw = this.cleanSectionText([exampleSection.heading, ...exampleSection.lines]);
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

      return this.cleanSectionText(match);
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

    extractDifficultyFromText(text) {
      const directMatch = (text || "").match(/Difficulty\s*[:\-]?\s*(Easy|Medium|Hard)/i);

      if (directMatch) {
        return this.normalizeDifficulty(directMatch[1]);
      }

      const standaloneMatch = (text || "").match(/^(Easy|Medium|Hard)$/im);

      if (standaloneMatch) {
        return this.normalizeDifficulty(standaloneMatch[1]);
      }

      return "";
    }

    findDifficultyFromDom() {
      const candidates = this.queryTextNodes([
        /difficulty\s*[:\-]?\s*(easy|medium|hard)/i,
        /^(easy|medium|hard)$/i,
      ]);

      for (const candidate of candidates) {
        const difficulty = this.extractDifficultyFromText(candidate);

        if (difficulty) {
          return difficulty;
        }
      }

      return "";
    }

    findLanguageFromDom() {
      const candidates = this.queryTextNodes([
        /language\s*[:\-]?\s*(javascript|typescript|python3?|java|cpp|c\+\+|c#|go|rust|kotlin|swift|ruby|php|scala|dart|sql|mysql|mssql|bash|shell)/i,
        /^(javascript|typescript|python3?|java|cpp|c\+\+|c#|go|rust|kotlin|swift|ruby|php|scala|dart|sql|mysql|mssql|bash|shell)$/i,
      ]);

      for (const candidate of candidates) {
        const match = candidate.match(/(javascript|typescript|python3?|java|cpp|c\+\+|c#|go|rust|kotlin|swift|ruby|php|scala|dart|sql|mysql|mssql|bash|shell)/i);

        if (match) {
          return this.normalizeLanguage(match[1]);
        }
      }

      return "";
    }

    normalizeLanguage(value) {
      const normalized = String(value || "").trim().toLowerCase();

      if (normalized === "python3") {
        return "Python3";
      }

      if (normalized === "cpp") {
        return "C++";
      }

      if (normalized === "c++") {
        return "C++";
      }

      if (normalized === "c#") {
        return "C#";
      }

      if (!normalized) {
        return "";
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    normalizeDifficulty(value) {
      const normalized = (value || "").trim().toLowerCase();

      if (!normalized) {
        return "";
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
      const text = this.normalizeWhitespace(element?.innerText || element?.textContent || "");

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
        const value = this.cleanSectionText(node?.textContent || "");

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

    isExampleHeading(line) {
      return /^(example(?:\s*\d+)?|examples)\s*:?[\s]*$/i.test(line);
    }

    isConstraintsHeading(line) {
      return /^constraints\s*:?[\s]*$/i.test(line);
    }

    cleanSectionText(value) {
      return (Array.isArray(value) ? value : [value])
        .flatMap((item) => String(item || "").split(/\n+/))
        .map((line) => line.replace(/^\s*[-*•]\s+/, ""))
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .replace(/^Description\n/i, "")
        .replace(/^Example(?:\s*\d+)?\n/i, "")
        .replace(/^Constraints\n/i, "")
        .trim();
    }

    normalizeWhitespace(value) {
      return String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    isLikelyLeetCodeUrl() {
      return /leetcode\.com\/problems\//i.test(this.window.location?.href || "");
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