/// <reference types="@testing-library/jest-dom" />

// Makes jest-dom's matchers (toBeInTheDocument, toHaveAttribute, …) visible to
// `astro check`, which typechecks the test files.
//
// A reference here rather than `compilerOptions.types` in tsconfig: setting
// that array switches off automatic inclusion of every other ambient type
// package, so it has to be kept exhaustive by hand. This costs nothing and
// constrains nothing.
