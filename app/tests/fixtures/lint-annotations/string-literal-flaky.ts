// @ts-nocheck
// Fixture: @flaky and test.skip appear only in comments — never as AST call expressions.
// The AST-based linter must NOT trigger on any of the patterns below.

// @flaky is mentioned here in a comment, not used as a tag array
// test.skip would be useful here but is never called
// test.todo is also mentioned but not invoked
