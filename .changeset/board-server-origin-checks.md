---
"shipbench": patch
---

`shipbench board` now refuses requests that a web page could send on your behalf. The server binds `127.0.0.1`, which keeps other machines out, but it answered every request that reached it, including ones from other pages open in the same browser.

Two attacks were possible. A page on any site could send a `no-cors` POST with a `text/plain` body, which the browser sends without a preflight, and create, reorder, comment on, archive, or unarchive tasks. The attacker could not read the response, but the write had already happened. And a page on a hostname that re-resolves to `127.0.0.1` (DNS rebinding) became same-origin with the board, so it could read the whole board and send any write.

The server now answers with 403 when the `Host` header names anything other than `127.0.0.1` or `localhost` on the port it actually bound. This covers API routes, the event stream, and static files. It also returns 403 for a state-changing request whose `Origin` is not the board's own, including the literal `null` that sandboxed frames and `file:` pages send. Requests with no `Origin`, such as those from curl or scripts, are still accepted, and the standalone board's own requests are unchanged.
