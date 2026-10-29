# Agent instructions

The current task is described in `HANDOFF.md`. Read it first and follow its constraints, especially the one against spending money on Azure.

- Python is standard-library only for `log_status.py`. Do not add dependencies there.
- Never commit secrets. The GitHub token belongs in Azure Function app settings only.
- Ask Siddharth before you create, change or delete any Azure resource, or any GitHub token or setting.
- The task needs network access to Azure and GitHub (`az`, `gh`, `func`). Codex's sandbox blocks network by default. If a command fails for that reason, ask him to approve it, or give him the exact command to run in his own terminal, where `az` and `gh` are signed in.
