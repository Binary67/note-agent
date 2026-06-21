<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Validation

- Fast static validation, such as linting or type checking, is allowed by default.
- Do not run runtime tests, browser checks, or browser-use tooling by default. The user will run those manually.
- Run runtime tests or browser checks only when the user specifically asks for them.
`