---
title: Reject cross-origin and rebound requests to the CLI board server
status: review
priority: high
tags:
  - cli
  - security
created: '2026-09-23T19:18:26.495Z'
updated: '2026-09-26T21:01:20.384Z'
---

`shipbench board` serves a local API that writes into the user's repo, and it
trusts every request that reaches it. [boardServer.ts](../../apps/cli/src/boardServer.ts)
binds `127.0.0.1`, which keeps other machines out, but a web page open in the
same browser is not another machine. Nothing in `createBoardRequestHandler`
looks at `Host` or `Origin`, and `readJson` parses the body whatever its
`content-type` says.

Filed from a review of how an outside host would embed `@shipbench/board` and
mirror the CLI board server. The claims below were re-checked against source
before filing.

## The two attacks

**Cross-site writes.** A page can send
`fetch('http://127.0.0.1:4321/api/tasks', { method: 'POST', mode: 'no-cors', body: '{"title":"x"}' })`.
With no explicit content type the body goes as `text/plain`, which makes it a
CORS "simple" request, so the browser sends it with no preflight. `readJson`
parses it and `createTask` writes the file. The attacker can't read the
response, but the write has already happened. Finding the port is cheap: the
default is `4321`, and `listenOnAvailablePort` tries only the next nine.

The exposure is exactly the POST routes: create, `reorder`, add comment,
`archive`, and `unarchive`. `unarchive` doesn't even need a body, and because
core doesn't confine slugs, it reaches beyond the board: a bodiless `no-cors`
POST to `/api/tasks/..%2F..%2F..%2FREADME/unarchive` moves the user's README
out of their repo. That hole is tracked separately in
[confine-task-slugs-to-the-tasks-directory-in-core](confine-task-slugs-to-the-tasks-directory-in-core.md),
and each fix stands on its own. PATCH (edit
task, edit comment) and DELETE (delete task, delete comment) are not simple
methods, so a cross-origin page already can't send them: the browser
preflights them and the server never answers with CORS headers. That
protection comes from the browser, though, not from the server. The server
check should still cover every state-changing method.

**DNS rebinding.** An attacker hostname that re-resolves to `127.0.0.1` makes
the page same-origin with the board as far as the browser is concerned. It can
then read `/api/config`, `/api/tasks`, `/api/tasks/archived`, and the
`/api/events` stream, and it can also send every write, PATCH and DELETE
included. The one thing that gives it away is the `Host` header, which carries
the attacker's hostname. Nothing checks it today.

## Direction

The implementer chooses the exact mix, but it has to defeat both attacks.

- **Check `Host` on every request**: API, SSE, and static files. Allow only
  `127.0.0.1:<port>` and `localhost:<port>` for the port that was actually
  bound. `listenOnAvailablePort` can bind a port other than the preferred one,
  and `port: 0` binds a random one, so the check needs the real port.
  `createBoardRequestHandler` runs before the listen call, so it doesn't know
  the port yet. Either pass the port in after the listen, or read
  `req.socket.localPort`. The server binds IPv4 only, so `[::1]` needn't be
  allowed.
- **On state-changing requests, reject a foreign `Origin`.** Browsers send
  `Origin` on every cross-origin POST, and on same-origin POST too, so the
  standalone board's own requests carry `http://127.0.0.1:<port>`. Reject any
  `Origin` outside the same allowlist, including the literal `null` that
  sandboxed iframes and `file:` pages send. When `Origin` is absent the
  request isn't from a browser, so allow it. That keeps curl and the Node
  test harness working. `Sec-Fetch-Site` is an acceptable complement.
- A "writes must be `application/json`" rule would also force a preflight.
  **Watch out:** the standalone board's own `BoardAPI`
  ([standalone.tsx](../../packages/board/src/standalone.tsx)) sends
  `unarchiveTask` as a bodiless POST with no `content-type`, and
  `deleteTask`/`deleteComment` as bodiless DELETEs. A blanket JSON rule breaks
  unarchive unless the client changes in the same PR. The `Origin` check has no
  such dependency, so prefer it. If you do add a content-type or custom-header
  requirement on top, update the client alongside the server.

Reject with 403 and a JSON `{ error }`, like the rest of the handler.

## Testing notes

`createBoardRequestHandler` is exported, so the rejections can be tested at the
handler level. The existing tests in
[boardServer.test.ts](../../apps/cli/src/boardServer.test.ts) go through
`startBoardServer` and the global `fetch`. undici treats `Host` as a forbidden
header, so it can't send a foreign one. Use `node:http` `request` with an
explicit `Host` header, or call `handle()` with a constructed request. If the
port comes from `req.socket.localPort`, the constructed request needs a
socket. The existing tests fetch `server.url` (`127.0.0.1`), so they should
keep passing unchanged. Verify that they do.

## Docs and release

[cli-reference.md](../../apps/site/src/content/docs/cli-reference.md#L547)
says only that the server binds `127.0.0.1`. Add a sentence saying that it
also refuses requests from other origins and hostnames. This is a CLI change
in the fixed release group, so it needs a changeset.

## Acceptance

- A cross-origin `text/plain` POST to each mutating route is rejected and
  writes nothing. Test at least create and bodiless unarchive.
- A request with a foreign `Host` is rejected on an API route, on
  `/api/events`, and on a static file.
- A POST whose `Origin` is foreign, or the literal `null`, is rejected.
- Requests addressed to `localhost:<port>` and `127.0.0.1:<port>` are allowed,
  and so is a request with no `Origin`.
- Every board action still works from the standalone board: create, edit,
  move/reorder, add/edit/delete comment, archive, unarchive, and delete task.
