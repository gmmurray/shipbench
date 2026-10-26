---
'@shipbench/core': minor
---

`GitHubAdapter`, `GitHubApiError`, `normalizeGithubUrl`, `normalizeGithubRemoteUrl`, and `parseGithubUrl` are no longer exported. Their only consumer was ShipBench Harbor, which was retired. `FsAdapter` is now the only built-in adapter, and `parseGithubRemoteUrl` stays.

**Breaking:** code that imports any of the removed names fails to build. To read a board from GitHub, implement `ReadableStorageAdapter` over the GitHub Contents API in your host. To normalize a remote URL, build `https://github.com/${owner}/${repo}` from the result of `parseGithubRemoteUrl`.
