"""Offline tests: no token, GitHub dispatch, or Azure resources required."""

import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError


spec = importlib.util.spec_from_file_location(
    "function_app", Path(__file__).resolve().parents[1] / "function_app.py"
)
function_app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(function_app)
FUNCTIONS = function_app.app.get_functions()


class DispatchTests(unittest.TestCase):
    def test_request_and_success_responses(self):
        for status in (200, 204):
            with self.subTest(status=status):
                response = MagicMock()
                response.__enter__.return_value.status = status
                with patch.dict(os.environ, {"GITHUB_TOKEN": "test-secret"}), patch.object(
                    function_app.urllib.request, "urlopen", return_value=response
                ) as send:
                    self.assertEqual(function_app.dispatch_workflow(), status)
                request = send.call_args.args[0]
                self.assertEqual(request.full_url, function_app.WORKFLOW_URL)
                self.assertEqual(request.method, "POST")
                self.assertEqual(json.loads(request.data), {"ref": "main"})
                self.assertEqual(request.get_header("Authorization"), "Bearer test-secret")
                self.assertEqual(send.call_args.kwargs["timeout"], 30)
                send.assert_called_once()

    def test_missing_token_never_sends(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(
            function_app.urllib.request, "urlopen"
        ) as send:
            with self.assertRaisesRegex(RuntimeError, "GITHUB_TOKEN"):
                function_app.dispatch_workflow()
            send.assert_not_called()

    def test_errors_are_sanitized_and_not_retried(self):
        for error in (
            HTTPError(function_app.WORKFLOW_URL, 401, "test-secret", {}, None),
            HTTPError(function_app.WORKFLOW_URL, 403, "test-secret", {}, None),
            URLError("test-secret"),
            TimeoutError("test-secret"),
        ):
            with self.subTest(error=type(error).__name__), patch.dict(
                os.environ, {"GITHUB_TOKEN": "test-secret"}
            ), patch.object(function_app.urllib.request, "urlopen", side_effect=error) as send:
                with self.assertRaises(RuntimeError) as caught:
                    function_app.dispatch_workflow()
                self.assertNotIn("test-secret", str(caught.exception))
                send.assert_called_once()

    def test_unexpected_success_status_fails(self):
        response = MagicMock()
        response.__enter__.return_value.status = 202
        with patch.dict(os.environ, {"GITHUB_TOKEN": "test-secret"}), patch.object(
            function_app.urllib.request, "urlopen", return_value=response
        ):
            with self.assertRaisesRegex(RuntimeError, "202"):
                function_app.dispatch_workflow()

    def test_timer_binding(self):
        functions = FUNCTIONS
        self.assertEqual(len(functions), 1)
        binding = json.loads(functions[0].get_function_json())["bindings"][0]
        self.assertEqual(binding["type"], "timerTrigger")
        self.assertEqual(binding["schedule"], "0 3-59/10 * * * *")
        self.assertFalse(binding["runOnStartup"])
        self.assertTrue(binding["useMonitor"])

    def test_late_timer_dispatches_once(self):
        timer = MagicMock(past_due=True)
        # The decorator returns a FunctionBuilder; get the registered callable.
        callback = FUNCTIONS[0].get_user_function()
        with patch.object(function_app, "dispatch_workflow") as dispatch:
            callback(timer)
            dispatch.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
