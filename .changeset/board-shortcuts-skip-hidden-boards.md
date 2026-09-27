---
"@shipbench/board": patch
"shipbench": patch
---

A page that mounts several boards and hides the inactive ones, with the `hidden` attribute or `display: none`, now sends the board's keyboard shortcuts only to the visible board. Before, Escape closed open tasks on every board, and a hidden board with a task open could take `j`/`k` and the arrow keys, which blocked page scrolling and the visible board's own navigation.

Escape pressed in a text field no longer closes the open task or the archive view. A description or Task Update you're writing stays open with your text. Escape in the search box still clears it first and then closes the task.
