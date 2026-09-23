---
title: updating shipbench init with new versions
status: backlog
priority: medium
created: '2026-09-21T17:09:42.734Z'
updated: '2026-09-21T17:12:28.220Z'
---

owner created. this may be a duplicate, but just needing to write it down so it doesnt get forgotten. right now, if we shipbench init in one repo, then ship a bunch of shipbench updates, that init'd AGENTS,README, etc may be out of date severely. we should investigate if there is any good way to improve this experience, especially from an industry wide perpsective, as i think while README has been around for a while and getting out of date that whole time for many projects across the industry, keeping an up to date AGENTS file is much more important. should also consider how projects actually use AGENTS, as i think several of my own projects basically separate what should go into .shipbench/AGENTS vs what goes the project AGENTS, and both could be wrong after a new shipbench version drops.
