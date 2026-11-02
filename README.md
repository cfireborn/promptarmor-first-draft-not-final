# ClearPath Review

## Summary
A working prototype for getting financial marketing creative through compliance review with less back-and-forth.

## Description
I’m focusing on the moment a revised creative comes back to a reviewer: what changed, why it changed, and what still needs a decision. The queue and submission flow support that loop.

## Project Demo
Development captures will be recorded at each working milestone below.

## Live Demo
Deployment target: `cfireborn.github.io/promptarmor/`.

## Requirements
- A useful review queue, creative context, and actionable findings.
- A complete request-changes → revision → human approval workflow.
- Approval tied to a creative version and stated use, with a downloadable record.

## Technologies Used
React, TypeScript, and Vite. A static deployment keeps the demo easy to open and redeploy. Browser storage is sufficient to exercise the workflow without onboarding or a backend; it is not a production collaboration architecture.

## Setup Instructions
Setup commands will be verified as the implementation lands.

## Development Progress
Five working milestones, with actual GIF captures and commits, will be recorded here.

## Assumptions
- The compliance reviewer is the primary user; marketers need a small submission and revision surface.
- Missing context and revision rounds are meaningful parts of the bottleneck. This needs validation with a real team.
- An approval covers one creative version and its stated product, audience, channel, and placement.
- Automated checks assist a human reviewer. They do not approve content or establish legal compliance.
- The prototype uses fictional submissions, illustrative internal policies, and local browser persistence.

## Scoping and Tradeoffs
The initial scope is one complete review loop, including affiliate attribution. External partner accounts, live-site monitoring, and a comprehensive legal rules engine are outside this prototype.

## Design Choices
Decisions and measured verification will be added as the product takes shape.

## Notes
The apparent problem is a slow approval queue. The more useful problem may be uncertainty: what was reviewed, what changed, and who needs to act next. Making that explicit can remove status-chasing and improve the approval record at the same time.
