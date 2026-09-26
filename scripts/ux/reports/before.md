# UX task flows — before

https://substrata.orangecat.ch · 2026-09-26T06:01:30.217Z

Steps = clicks, keystrokes into a field, choices, ticks, and screens of scrolling to reach
what you act on or read. Budgets are per task; a task passes only inside both.

| Task | Audience | Budget | 390 | 1440 |
| --- | --- | --- | --- | --- |
| **xray-top-risk** — Pastes 10 tickers and finds their biggest single-source risk. | Fund analyst | ≤3 steps, ≤8s | FAIL · 3 steps | FAIL · 2 steps |
| **xray-first-run** — Has no list to hand and wants to see what the X-ray does. | Fund analyst, first visit | ≤2 steps, ≤8s | pass · 2 steps · 6.7s | pass · 2 steps · 5.9s |
| **scenario-taiwan** — Asks what breaks if Taiwan is cut off, and sends the answer to a colleague. | Risk manager | ≤3 steps, ≤6s | FAIL · 2 steps | FAIL · 1 steps |
| **gallium-moves** — Sees what moved in gallium this month. | Commodity trader | ≤3 steps, ≤6s | pass · 3 steps · 5.8s | pass · 2 steps · 3.8s |
| **gallium-producers-csv** — Gets who produces gallium, as a CSV. | Commodity trader | ≤1 steps, ≤4s | pass · 0 steps · 1.5s | pass · 0 steps · 1.2s |
| **jobs-europe** — Finds process-engineer roles in Europe. | Job seeker | ≤3 steps, ≤8s | FAIL · 2 steps | FAIL · 1 steps |
| **exposure-sole-listed** — Lists the listed companies that are the only recorded maker of a bottleneck, as a CSV. | Fund analyst | ≤4 steps, ≤8s | pass · 3 steps · 3s | pass · 2 steps · 3.8s |
| **pipeline-new** — Sees what is new in the science pipeline for advanced packaging. | Researcher | ≤3 steps, ≤6s | FAIL · 3 steps · 8.3s | pass · 2 steps · 5.8s |
| **follow-signed-out** — Wants to follow a bottleneck (then two more) and see what is new on them. | Reader | ≤2 steps, ≤5s | FAIL · 0 steps | FAIL · 0 steps |
| **update-news** — On a bottleneck page, gets the latest news now. | Reader | ≤1 steps, ≤5s | pass · 0 steps · 2s | pass · 0 steps · 1.8s |

## Why a task failed

- xray-top-risk @390: locator.waitFor: Timeout 20000ms exceeded.
- xray-top-risk @1440: locator.waitFor: Timeout 20000ms exceeded.
- scenario-taiwan @390: No one-click way to share: the URL is printed as text.
- scenario-taiwan @1440: No one-click way to share: the URL is printed as text.
- jobs-europe @390: No Europe option: 2 European countries to pick one at a time.
- jobs-europe @1440: No Europe option: 2 European countries to pick one at a time.
- pipeline-new @390: over time
- follow-signed-out @390: Signed out there is no follow action at all: a dead end.
- follow-signed-out @1440: Signed out there is no follow action at all: a dead end.

## Success criteria

- **xray-top-risk**: The result names ONE biggest single-source risk (company, bottleneck, share of weight).
- **xray-first-run**: One click on an example produces a full result.
- **scenario-taiwan**: The count of bottlenecks hit is on screen and the link copies in one click.
- **gallium-moves**: A gallium series with its latest change is on screen.
- **gallium-producers-csv**: The top producer and the CSV link are both on the first screen.
- **jobs-europe**: Process-engineering roles filtered to Europe, at least one listed.
- **exposure-sole-listed**: The filtered table and its CSV link are on screen.
- **pipeline-new**: The collected items for advanced packaging are on screen.
- **follow-signed-out**: A follow action is on the bottleneck page, and signed out it says what to do.
- **update-news**: "Update news now" is reachable within one screen of scrolling.

## Dead ends (every empty or error state must offer the next action)

| State | 390 | 1440 |
| --- | --- | --- |
| `/exposure?q=zzqxv` | DEAD END | DEAD END |
| `/careers?q=zzqxv` | ok (Clear the filters, companies whose roles live on their own site) | ok (Clear the filters, companies whose roles live on their own site) |
| `/data/series?q=zzqxv` | ok (Clear the filters) | ok (Clear the filters) |
| `/xray` | no message found | no message found |
| `/resources/unobtainium` | DEAD END | DEAD END |

## Step logs

- xray-top-risk @390: type the holdings box → scroll ×1 to the X-ray button → click the X-ray button
- xray-top-risk @1440: type the holdings box → click the X-ray button
- xray-first-run @390: scroll ×1 to the example → click the example
- xray-first-run @1440: click the example → scroll ×1 to the result summary
- scenario-taiwan @390: click the Taiwan preset → scroll ×1 to bottlenecks hit
- scenario-taiwan @1440: click the Taiwan preset
- gallium-moves @390: type the search box → press Enter to search → scroll ×1 to the first gallium move
- gallium-moves @1440: type the search box → press Enter to search
- gallium-producers-csv @390: —
- gallium-producers-csv @1440: —
- jobs-europe @390: scroll ×1 to role family → choose role family
- jobs-europe @1440: choose role family
- exposure-sole-listed @390: tick Listed only → tick sole maker → scroll ×1 to the first row
- exposure-sole-listed @1440: tick Listed only → tick sole maker
- pipeline-new @390: scroll ×1 to advanced packaging → click advanced packaging → scroll ×1 to the collected items
- pipeline-new @1440: click advanced packaging → scroll ×1 to the collected items
- follow-signed-out @390: —
- follow-signed-out @1440: —
- update-news @390: —
- update-news @1440: —
