#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from wsgiref.util import setup_testing_defaults

from src.interfaces.web.app import application


def request(path: str) -> None:
    env = {}
    setup_testing_defaults(env)
    env["PATH_INFO"] = path
    env["QUERY_STRING"] = "categoria=mercearia&periodo=30"
    state = {}

    def start_response(status, headers):
        state["status"] = status

    body = b"".join(application(env, start_response)).decode("utf-8")
    assert state["status"] == "200 OK", f"{path}: {state['status']}"
    assert body, f"{path}: resposta vazia"


for route in ["/", "/comparacao", "/produtos/1"]:
    request(route)

print("OK: mvp flow passed")
PY
