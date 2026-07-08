(function (globalScope) {
  const HintFlowParser = globalScope.HintFlowParser || {};
  globalScope.HintFlowParser = HintFlowParser;

  const utils = {
    cleanTitle(value) {
      return (value || "")
        .replace(/\s*[-|]\s*LeetCode.*$/i, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
    },

    cleanSlug(value) {
      return (value || "")
        .trim()
        .replace(/^\/+|\/+$/g, "")
        .toLowerCase();
    },

    slugifyTitle(value) {
      return (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    },

    formatSlugToTitle(slug) {
      return (slug || "")
        .split(/[-_]+/)
        .filter(Boolean)
        .map((word) => this.formatTitleWord(word))
        .join(" ")
        .trim();
    },

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
    },

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
    },

    normalizeDifficulty(value) {
      const normalized = (value || "").trim().toLowerCase();

      if (!normalized) {
        return "";
      }

      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    },

    normalizeWhitespace(value) {
      return String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    },

    isExampleHeading(line) {
      return /^(example(?:\s*\d+)?|examples)\s*:?[\s]*$/i.test(line);
    },

    isConstraintsHeading(line) {
      return /^constraints\s*:?[\s]*$/i.test(line);
    },

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
    },

    isLikelyLeetCodeUrl(url) {
      return /leetcode\.com\/problems\//i.test(url || "");
    }
  };

  HintFlowParser.utils = utils;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = utils;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
