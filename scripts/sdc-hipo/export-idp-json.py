"""Export the IDP content in idp_actions.py to JSON for Caliber.

Caliber's SDC IDP report (src/lib/reports/sdc-hipo/) reads
src/lib/reports/sdc-hipo/idp-content.json. Run this after every change to
idp_actions.py (Ali's reviewed sheet) and commit the regenerated JSON:

    cd scripts/sdc-hipo && python3 export-idp-json.py
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import idp_actions as a  # noqa: E402

OUT = os.path.join(HERE, "..", "..", "src", "lib", "reports", "sdc-hipo", "idp-content.json")


def main():
    actions = {
        code: {lvl: {"job": v[0], "coaching": v[1], "learning": v[2]} for lvl, v in levels.items()}
        for code, levels in a.ACTIONS.items()
    }
    plan = {
        code: {
            lvl: {"smart": v[0], "day30": v[1], "day60": v[2], "day90": v[3], "evidence": v[4]}
            for lvl, v in levels.items()
        }
        for code, levels in a.PLAN.items()
    }
    data = {
        "_source": "scripts/sdc-hipo/idp_actions.py (regenerate with export-idp-json.py; do not edit by hand)",
        "actions": actions,
        "plan": plan,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    n_actions = sum(len(v) for v in actions.values())
    n_plan = sum(len(v) for v in plan.values())
    print(f"wrote {os.path.normpath(OUT)}: {n_actions} action rows, {n_plan} plan rows")


if __name__ == "__main__":
    main()
