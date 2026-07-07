const { LeetCodeParser } = require("./leetcodeParser.js");

function createMockDocument(bodyText, extra = {}) {
  return {
    body: bodyText ? { innerText: bodyText, textContent: bodyText } : null,
    documentElement: { innerText: bodyText || "", textContent: bodyText || "" },
    querySelector: extra.querySelector || (() => null),
    querySelectorAll: extra.querySelectorAll || (() => []),
    createTreeWalker: extra.createTreeWalker || ((root) => ({
      currentNode: null,
      nextNode() {
        return false;
      },
    })),
  };
}

function createParser(url, bodyText, extra = {}) {
  return new LeetCodeParser(
    createMockDocument(bodyText, extra),
    {
      location: { href: url },
      monaco: extra.monaco || { editor: { getModels: () => [] } },
    }
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const basicParser = createParser(
  "https://leetcode.com/problems/two-sum/description/",
  "Given an array of integers.\nExample 1:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9\nConstraints:\n2 <= nums.length <= 10^4"
);

const problemInfo = basicParser.getProblemInfo();
assert(problemInfo.slug === "two-sum", `expected slug two-sum, got ${problemInfo.slug}`);
assert(problemInfo.title === "Two Sum", `expected title Two Sum, got ${problemInfo.title}`);
assert(basicParser.getDescription().includes("Given an array of integers."), "description extraction failed");
assert(basicParser.getExamples()[0].input === "nums = [2,7,11,15], target = 9", "example input extraction failed");
assert(basicParser.getConstraints().includes("2 <= nums.length <= 10^4"), "constraints extraction failed");

const fallbackParser = createParser(
  "https://leetcode.com/problems/two-sum/",
  "Two Sum\nEasy",
  {
    querySelector: (selector) => {
      if (selector === 'meta[property="og:title"]') {
        return { getAttribute: () => "Two Sum - LeetCode" };
      }

      return null;
    },
  }
);

assert(fallbackParser.getProblemInfo().title === "Two Sum", "title fallback failed");

console.log("leetcodeParser.test.js passed");