export interface ProblemInfo {
  slug: string;
  title: string;
  url: string;
}

export interface ExampleInfo {
  heading: string;
  raw: string;
  input: string;
  output: string;
  explanation: string;
}

export interface StatementSections {
  description: string[];
  examples: Array<{
    type: "example";
    heading: string;
    lines: string[];
  }>;
  constraints: string[];
  preamble: string[];
}

export declare class LeetCodeParser {
  constructor(doc?: Document, win?: Window);

  getProblemInfo(): ProblemInfo;
  getDifficulty(): string;
  getDescription(): string;
  getExamples(): ExampleInfo[];
  getConstraints(): string;
  getLanguage(): string;
  getUserCode(): string;
}