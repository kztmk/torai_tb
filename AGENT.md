# Agent Guidelines

## Code Review Comment Handling

When responding to code review comments, do not apply every suggestion mechanically.
Evaluate whether the requested change is actually necessary and safe for this repository.

- If the comment is valid and the change is necessary, implement it.
- If the comment is valid but requires a large design change, explain the tradeoff and confirm before implementing.
- If the comment conflicts with existing behavior, prior review feedback, or product requirements, explain which side should take priority and why before changing code.
- If the comment is unnecessary, risky, or not applicable, do not change code; explain the reason clearly.
- For conflicting review comments, prefer the behavior that best matches the actual runtime requirements of this app.
- When a review comment identifies a bug pattern, check nearby and analogous code paths for the same pattern before finishing. Fix the broader class of issue when the same risk exists elsewhere, and mention the scope checked in the final response.
