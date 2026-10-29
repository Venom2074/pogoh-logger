"""Use Azure as the clock for the existing POGOH GitHub Actions workflow."""

import json
import logging
import os
import urllib.error
import urllib.request

import azure.functions as func


WORKFLOW_URL = (
    "https://api.github.com/repos/Venom2074/pogoh-logger"
    "/actions/workflows/log.yml/dispatches"
)
app = func.FunctionApp()


def dispatch_workflow():
    """Send one dispatch; do not retry ambiguous failures and duplicate runs."""
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Set GITHUB_TOKEN in the Function App settings.")

    request = urllib.request.Request(
        WORKFLOW_URL,
        data=json.dumps({"ref": "main"}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "pogoh-logger-azure-timer",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status = response.status
    except urllib.error.HTTPError as error:
        # Never log request headers, the token, or an arbitrary response body.
        logging.error("GitHub workflow dispatch rejected: HTTP %s", error.code)
        raise RuntimeError(
            f"GitHub dispatch returned HTTP {error.code}; check token expiry, "
            "Actions write permission, and workflow availability."
        ) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RuntimeError(
            "GitHub dispatch network failure; check Actions before retrying."
        ) from None

    # The pinned API historically returns 204; newer versions also return 200.
    if status not in (200, 204):
        raise RuntimeError(f"Unexpected GitHub dispatch status: HTTP {status}")
    logging.info("GitHub workflow dispatch accepted: HTTP %s (log.yml, main)", status)
    return status


@app.timer_trigger(
    schedule="0 3-59/10 * * * *",
    arg_name="timer",
    run_on_startup=False,
    use_monitor=True,
)
def dispatch_logger(timer: func.TimerRequest) -> None:
    """Fire at :03, :13, :23, :33, :43 and :53 of each hour, UTC."""
    if timer.past_due:
        logging.warning("Timer is past due; dispatching one current snapshot.")
    dispatch_workflow()
