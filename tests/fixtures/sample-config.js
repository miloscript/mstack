export default {
  name: "test-project",
  outputDir: ".mstack/",
  model: "claude-sonnet-4-6",
  orchestration: "code",

  phases: {
    analysis: {
      enabled: true,
      skill: "analysis",
      input: null,
      pre: [],
      post: ["human"],
    },
    plan: {
      enabled: true,
      skill: "plan",
      input: "analysis.md",
      pre: [],
      post: [],
    },
    implementation: {
      enabled: true,
      skill: "implementation",
      input: "plan.md",
      pre: [],
      post: [],
    },
    review: {
      enabled: false,
      skill: "review",
      input: {
        plan: "plan.md",
        implementation: "implementation.md",
      },
      pre: [],
      post: [],
    },
  },

  maxRetries: 1,

  tdd: {
    enabled: false,
  },
};
