"""Write the API data contract (OpenAPI JSON) used by the UI.

Run from the project root after changing BackEnd/APIs/schemas.py or main.py:

    python -m FrontEnd.tools.export_contract

tests/test_api_contract.py fails while FrontEnd/contract/openapi.json is stale.
"""

import json
from pathlib import Path

CONTRACT_PATH = Path(__file__).resolve().parents[1] / "contract" / "openapi.json"


def render_contract() -> str:
    from BackEnd.APIs.main import app

    return json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    CONTRACT_PATH.write_text(render_contract(), encoding="utf-8")
    print(f"Wrote {CONTRACT_PATH}")
