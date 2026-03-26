export default {
  name: "my-project",
  outputDir: ".mstack/",
  model: "claude-sonnet-4-6",
  orchestration: "code",

  phases: {
    analysis: {
      enabled: true,
      skill: "analysis",
      input: null,
      pre: [],
      post: [],
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
      enabled: true,
      skill: "review",
      input: {
        plan: "plan.md",
        implementation: "implementation.md",
      },
      pre: [],
      post: ["human"],
    },

    test: {
      enabled: true,
      skill: "test",
      input: "implementation.md",
      pre: [],
      post: [],
    },

    document: {
      enabled: false,
      skill: "document",
      input: "implementation.md",
      pre: [],
      post: [],
    },

    ship: {
      enabled: true,
      skill: "ship",
      input: "implementation.md",
      pre: ["human"],
      post: [],
    },
  },

  maxRetries: 2,

  tdd: {
    enabled: true,
  },
};
