(function (globalScope) {
  let utils;
  if (typeof require !== "undefined") {
    utils = require("./utils.js");
  } else {
    utils = globalScope.HintFlowParser.utils;
  }

  class ProblemParser {
    constructor(doc, win, parent) {
      this.document = doc;
      this.window = win;
      this.parent = parent;
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
      const problemText = this.parent.descriptionParser.getProblemText();
      const difficulty = this.extractDifficultyFromText(problemText);

      if (difficulty) {
        return difficulty;
      }

      return this.findDifficultyFromDom();
    }

    getLocationInfo() {
      const slug = this.extractSlugFromUrl() || this.extractSlugFromCanonical() || this.extractSlugFromDom();
      const title = this.extractTitleFromDom() || (slug ? utils.formatSlugToTitle(slug) : "");

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
          return utils.cleanSlug(match[1]);
        }
      } catch {
        return "";
      }

      return "";
    }

    extractSlugFromDom() {
      const titleFromDom = this.extractTitleFromDom();

      if (titleFromDom) {
        const inferredSlug = utils.slugifyTitle(titleFromDom);

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
        const title = utils.cleanTitle(candidate || "");

        if (title) {
          return title;
        }
      }

      return "";
    }

    extractDifficultyFromText(text) {
      const directMatch = (text || "").match(/Difficulty\s*[:\-]?\s*(Easy|Medium|Hard)/i);

      if (directMatch) {
        return utils.normalizeDifficulty(directMatch[1]);
      }

      const standaloneMatch = (text || "").match(/^(Easy|Medium|Hard)$/im);

      if (standaloneMatch) {
        return utils.normalizeDifficulty(standaloneMatch[1]);
      }

      return "";
    }

    findDifficultyFromDom() {
      // 1. Direct query of text difficulty classes
      const easyEl = this.document.querySelector('.text-difficulty-easy, .text-easy, .text-sd-easy-500, [class*="-easy"]');
      const medEl = this.document.querySelector('.text-difficulty-medium, .text-medium, .text-sd-medium-500, [class*="-medium"]');
      const hardEl = this.document.querySelector('.text-difficulty-hard, .text-hard, .text-sd-hard-500, [class*="-hard"]');
      
      if (easyEl && (easyEl.textContent || "").trim().toLowerCase() === "easy") return "Easy";
      if (medEl && (medEl.textContent || "").trim().toLowerCase() === "medium") return "Medium";
      if (hardEl && (hardEl.textContent || "").trim().toLowerCase() === "hard") return "Hard";

      // 2. Scan leaf divs or spans for exact text fallback
      const elements = this.document.querySelectorAll('div, span');
      for (const el of elements) {
        if (el.children.length === 0) {
          const text = (el.textContent || "").trim();
          if (text === "Easy") return "Easy";
          if (text === "Medium") return "Medium";
          if (text === "Hard") return "Hard";
        }
      }

      // 3. Fallback to description parser queryTextNodes
      const candidates = this.parent.descriptionParser.queryTextNodes([
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

    getProblemNumber() {
      const h1Text = this.document.querySelector("h1")?.textContent || "";
      const match = h1Text.match(/^(\d+)\./);
      return match ? match[1] : "";
    }
  }

  globalScope.HintFlowParser = globalScope.HintFlowParser || {};
  globalScope.HintFlowParser.ProblemParser = ProblemParser;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ProblemParser;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
