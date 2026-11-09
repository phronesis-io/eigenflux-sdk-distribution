# Administrator-only main merges

These JSON files are reviewed target configurations, not an activation mechanism.
`admin-only.json` restricts updates to the default branch. Repository administrators
(role ID 5) may bypass that update restriction only through pull requests.
`pr-and-ci.json` separately requires a PR and successful GitHub Actions checks,
blocks deletion/force pushes, and has no bypass actors. Administrators must also
satisfy that second ruleset. Passing review or CI grants no merge permission.

An administrator can apply each file with GitHub's repository ruleset API, then
read back both rulesets and the effective rules for main. Apply only after checking
existing repository and organization rules; do not blindly create duplicates.
Files alone do not prove enforcement. Some private-repository plans do not support
rulesets; keep that limitation explicit until supported, without changing visibility
or purchasing a plan as a workaround. Never relax main protection to merge a PR.
