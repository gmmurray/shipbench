---
title: ShipBench Harbor
description: Use ShipBench Harbor to develop ideas and observe pushed project boards across public GitHub repositories.
group: Guides
order: 2
updated: 2026-08-05
---

ShipBench Harbor is the hosted web client for ShipBench. It gives solo developers one place to develop ideas before code exists and observe pushed task boards after those ideas become Git-backed projects.

Harbor lives at `harbor.shipbench.dev`. The ShipBench project system remains independent: you can use the ShipBench CLI, local board, Markdown files, and agents without a Harbor account.

## What Harbor stores

Harbor stores its own idea and project-index data in its database:

- ideas and their descriptions, tags, tech-stack notes, and relationships;
- your custom idea statuses and ordering;
- project names, optional source-idea links, and connected GitHub URLs.

ShipBench Harbor never stores ShipBench tasks. Tasks remain Markdown files in each repository's `.shipbench/tasks/` directory.

## Stage ideas before a repository exists

Ideas are pre-project scratch space. Use them to capture a possible product, explore its shape, record a technology choice, or connect related thoughts without creating a repository first.

You can:

- create and edit Markdown descriptions;
- assign custom statuses;
- add tags and tech-stack notes;
- connect related ideas;
- search, filter, and sort the idea list.

Idea statuses belong to your account. Start with the defaults, rename them, reorder them, or create a pipeline that matches how you think.

## Promote an idea to a project

Promotion marks an idea as ready to become a ShipBench project. It does **not** create a GitHub repository or write project files.

When you choose **Promote to Project**, Harbor:

1. creates a Harbor project record named from the idea;
2. links that project back to its source idea;
3. optionally moves the idea to another idea status;
4. opens the new project's connection screen.

The source idea remains available and editable. Harbor does not delete or hide it after promotion.

The new project can remain unconnected while you prepare its repository. Once you are ready, connect an existing public GitHub repository.

## Connect a repository

Harbor presents a signed command for the project. Run the appropriate form from the Git worktree root:

```bash no-copy
# The repository does not use ShipBench yet.
shipbench init --harbor "<signed-connect-url>"

# The repository already contains a valid ShipBench project.
shipbench connect --harbor "<signed-connect-url>"
```

The signed URL associates the normalized GitHub `origin` with the Harbor project. `init --harbor` creates local ShipBench files only when the project is absent. `connect --harbor` never modifies project files.

If the CLI is unavailable, Harbor also accepts manual public GitHub URL entry. A connected repository without `.shipbench/config.json` shows setup instructions instead of attempting to write to GitHub.

Commit and push `.shipbench/` after initialization. Harbor reads the repository, so its view is only as current as the last push.

## Observe project boards

Connected project pages render the ShipBench Board UI in read-only remote mode. The projects view lets you move across repositories without opening each local checkout.

Harbor can display:

- configured columns and priorities;
- live tasks and task details;
- dependencies, tags, warnings, and Updates;
- the repository README as project context;
- whether a project still needs a repository connection.

Use the ShipBench CLI, local board, editor, or coding agents to change tasks. Push those commits to update Harbor's remote view.

## Authentication and permissions

Harbor uses GitHub sign-in through Clerk. The current service supports public repositories only and stays within GitHub's low-privilege default identity scopes. It does not request broad private-repository access or write permission to repository contents.

The authenticated GitHub token raises the API rate limit for public reads. Harbor uses it to read project configuration, tasks, layout, and README content through the GitHub API.

Private-repository support and live board editing require a separate permission and connection design; they are not part of the current Harbor surface.

## Data ownership at a glance

| Data | Owner | Writable in Harbor? |
| --- | --- | --- |
| Ideas and idea statuses | Harbor | Yes |
| Project-to-repository connection | Harbor | Yes |
| ShipBench configuration | Git repository | No |
| Task Markdown and Updates | Git repository | No |
| Manual task order | Git repository | No |

This boundary keeps active project work portable. Harbor provides the workbench and portfolio view; Git remains the source of truth for ShipBench projects.
