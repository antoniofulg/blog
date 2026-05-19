// @ts-nocheck
// Fixture: test.skip with a date well beyond 48h SLA — linter must exit 1.

// added: 2020-01-01
test.skip("this flaky test was skipped three years ago", () => {});
