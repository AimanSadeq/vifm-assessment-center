"""Check Ali's completed scenario workbook and turn it into SQL for Caliber (internal, VIFM).

Usage:
  python3 load-scenarios.py WORKBOOK.xlsx                      # check only: prints a report, writes nothing
  python3 load-scenarios.py WORKBOOK.xlsx --bundle UUID        # check, then write out/sdc-scenarios.sql
        [--status Approved]        rows to load (default Approved; pass "Ready for review" for a pilot load,
                                   repeat the flag to accept several statuses)
        [--json out/x.json]        also write the loaded rows as JSON (used by the offline tests)

Reads the 'Scenarios' sheet of SDC_HiPo_Scenario_Template_v1.xlsx as completed by Ali (row 5 down;
columns as built by build-template.py) and checks every row against v3.json:
  errors   (row not loaded): missing situation or response, a level used other than once,
           an indicator ID that is unknown, of another competency, or of another level.
  warnings (row loaded):     situation outside 50 to 100 words, responses more than 10 words apart.
The SQL has three statements, run one at a time: competencies (upsert), scenarios (upsert on
bundle + Scenario ID), and retiring loaded scenarios that are no longer in the workbook (active =
false; candidates who already started keep their order). Response keys are opaque, so the
browser never sees which letter Ali wrote first.
"""
import argparse, hashlib, json, os, re, sys
from openpyxl import load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
v3 = json.load(open(os.path.join(HERE, "v3.json")))

CODE = {"Innovation": "IN", "Results Oriented": "RO", "Effective Collaboration and Communication": "ECC",
        "Professionalism and Integrity": "PI", "Accountability & Ownership": "AO", "Strategic Mindset": "SM",
        "Drives Sustainable Performance": "DSP", "Makes Effective Decisions and Plans": "EDP",
        "Inspires & Motivates": "IM", "Leads by Example": "LBE"}
LEVELS = ["Advanced", "Proficient", "Basic", "Counter-evidence"]
LEVEL_NUM = {"Not required": 0, "Basic": 1, "Proficient": 2, "Advanced": 3}
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

IND = {i["id"]: i for i in v3["indicators"]}
comps = []
for i in v3["indicators"]:
    if (i["category"], i["competency"]) not in comps:
        comps.append((i["category"], i["competency"]))


def competency_rows():
    gh = v3["grade_header"]
    out = []
    for n, (cat, comp) in enumerate(comps, 1):
        col = gh.index(comp)
        req = {g[0]: LEVEL_NUM[g[col]] for g in v3["grades"]}
        if "5" in req:
            req["4"] = req["5"]  # Grade 4 uses Grade 5 levels (Suzanne Salim, 6 Oct 2026)
        definition = next(i["definition"] for i in v3["indicators"] if i["competency"] == comp)
        out.append({"code": CODE[comp], "name": comp, "category": cat, "definition": definition,
                    "required_levels": dict(sorted(req.items(), key=lambda kv: int(kv[0]))), "sort_order": n})
    return out


def words(t):
    return len(t.split())


def clean(v):
    return re.sub(r"[ \t]+", " ", str(v).strip()) if v is not None else ""


def read_rows(path, statuses):
    wb = load_workbook(path, data_only=True)
    if "Scenarios" not in wb.sheetnames:
        sys.exit("No 'Scenarios' sheet in this workbook.")
    ws = wb["Scenarios"]
    comp_order = {comp: n for n, (_, comp) in enumerate(comps)}
    lvl_order = {"Basic": 0, "Proficient": 1, "Advanced": 2}
    loaded, report = [], []
    for r in range(5, ws.max_row + 1):
        ref = clean(ws.cell(r, 1).value)
        if not ref:
            continue
        comp, lvl, situation = clean(ws.cell(r, 3).value), clean(ws.cell(r, 4).value), clean(ws.cell(r, 6).value)
        status = clean(ws.cell(r, 22).value) or "Draft"
        errors, warnings = [], []
        if status not in statuses:
            report.append((ref, "skipped", [f"status is '{status}'"]))
            continue
        if comp not in CODE:
            errors.append(f"unknown competency '{comp}'")
        if lvl not in lvl_order:
            errors.append(f"unknown scenario level '{lvl}'")
        if not situation:
            errors.append("situation is empty")
        elif not 50 <= words(situation) <= 100:
            warnings.append(f"situation is {words(situation)} words (50 to 100 asked)")
        opts = []
        for k, letter in enumerate("ABCD"):
            c = 7 + 3 * k
            text, level, ind = clean(ws.cell(r, c).value), clean(ws.cell(r, c + 1).value), clean(ws.cell(r, c + 2).value).upper()
            if not text:
                errors.append(f"response {letter} is empty")
            if level not in LEVELS:
                errors.append(f"response {letter} level '{level}' is not one of {', '.join(LEVELS)}")
            if not ind:
                errors.append(f"response {letter} has no indicator ID")
            elif ind not in IND:
                errors.append(f"response {letter} indicator '{ind}' is not in v3")
            else:
                if IND[ind]["competency"] != comp:
                    errors.append(f"response {letter} indicator {ind} belongs to {IND[ind]['competency']}")
                if IND[ind]["option_level"] != level:
                    errors.append(f"response {letter} indicator {ind} is {IND[ind]['option_level']}, not {level}")
            opts.append({"letter": letter, "text": text, "level": level, "indicator_id": ind or None})
        used = [o["level"] for o in opts]
        if sorted(used) != sorted(LEVELS):
            errors.append("each level must be used exactly once (Advanced, Proficient, Basic, Counter-evidence)")
        lens = [words(o["text"]) for o in opts if o["text"]]
        if len(lens) == 4 and max(lens) - min(lens) > 10:
            warnings.append(f"responses range from {min(lens)} to {max(lens)} words (keep within about 10)")
        if errors:
            report.append((ref, "error", errors + warnings))
            continue
        report.append((ref, "ok" if not warnings else "warning", warnings))
        loaded.append({"ref": ref, "competency_code": CODE[comp], "target_level": lvl, "situation": situation,
                       "options": opts, "_sort": (comp_order[comp], lvl_order[lvl], r)})
    refs = [x["ref"] for x in loaded]
    dup = sorted({x for x in refs if refs.count(x) > 1})
    if dup:
        sys.exit(f"Scenario IDs used more than once: {', '.join(dup)}")
    loaded.sort(key=lambda x: x["_sort"])
    for n, x in enumerate(loaded, 1):
        x["sort_order"] = n
        del x["_sort"]
    return loaded, report


def with_keys(bundle, items):
    out = []
    for it in items:
        opts = [{"key": hashlib.sha256(f"{bundle}|{it['ref']}|{o['letter']}".encode()).hexdigest()[:10],
                 "text": o["text"], "level": o["level"], "indicator_id": o["indicator_id"]} for o in it["options"]]
        out.append({**it, "options": opts})
    return out


def q(v):
    """SQL literal (standard_conforming_strings on)."""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def jq(v):
    return q(json.dumps(v, ensure_ascii=False)) + "::jsonb"


def sql(bundle, comp_rows, items):
    b = q(bundle) + "::uuid"
    s1 = ("INSERT INTO bundle_competencies (bespoke_service_id, code, name, category, definition, required_levels, sort_order) VALUES\n"
          + ",\n".join(f"  ({b}, {q(c['code'])}, {q(c['name'])}, {q(c['category'])}, {q(c['definition'])}, {jq(c['required_levels'])}, {c['sort_order']})" for c in comp_rows)
          + "\nON CONFLICT (bespoke_service_id, code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, "
            "definition = EXCLUDED.definition, required_levels = EXCLUDED.required_levels, sort_order = EXCLUDED.sort_order;")
    s2 = ("INSERT INTO bundle_sjt_items (bespoke_service_id, ref, competency_code, target_level, situation, options, sort_order, active) VALUES\n"
          + ",\n".join(f"  ({b}, {q(i['ref'])}, {q(i['competency_code'])}, {q(i['target_level'])}, {q(i['situation'])}, {jq(i['options'])}, {i['sort_order']}, true)" for i in items)
          + "\nON CONFLICT (bespoke_service_id, ref) DO UPDATE SET competency_code = EXCLUDED.competency_code, target_level = EXCLUDED.target_level, "
            "situation = EXCLUDED.situation, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order, active = true;")
    s3 = (f"UPDATE bundle_sjt_items SET active = false WHERE bespoke_service_id = {b} AND active "
          f"AND ref NOT IN ({', '.join(q(i['ref']) for i in items)});")
    return [s1, s2, s3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("--bundle")
    ap.add_argument("--status", action="append")
    ap.add_argument("--json")
    ap.add_argument("--out", default=os.path.join(HERE, "out", "sdc-scenarios.sql"))
    a = ap.parse_args()
    statuses = set(a.status or ["Approved"])
    items, report = read_rows(a.workbook, statuses)

    print(f"Statuses loaded: {', '.join(sorted(statuses))}")
    for ref, kind, notes in report:
        print(f"  {kind.upper():8} {ref}" + ("".join(f"\n           - {n}" for n in notes)))
    per = {}
    for it in items:
        per[it["competency_code"]] = per.get(it["competency_code"], 0) + 1
    print(f"\n{len(items)} scenario(s) ready to load: " + (", ".join(f"{k} {v}" for k, v in per.items()) or "none"))
    short = [CODE[c] for _, c in comps if per.get(CODE[c], 0) < 3]
    if short:
        print(f"Fewer than 3 scenarios for: {', '.join(short)}")
    errors = sum(1 for _, k, _ in report if k == "error")
    if errors:
        print(f"{errors} row(s) have errors and were left out.")

    if not a.bundle:
        print("\nCheck only (pass --bundle UUID to write SQL).")
        return
    if not UUID_RE.match(a.bundle):
        sys.exit("--bundle must be the bundle's UUID.")
    if not items:
        sys.exit("Nothing to load.")
    keyed = with_keys(a.bundle, items)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w") as f:
        f.write("-- SDC HiPo scenarios for bundle " + a.bundle + ". Run each statement on its own.\n\n")
        f.write("\n\n-- next statement\n\n".join(sql(a.bundle, competency_rows(), keyed)) + "\n")
    print(f"\nWrote {a.out}")
    if a.json:
        os.makedirs(os.path.dirname(os.path.abspath(a.json)), exist_ok=True)
        json.dump({"competencies": competency_rows(), "items": keyed}, open(a.json, "w"), ensure_ascii=False, indent=1)
        print(f"Wrote {a.json}")


if __name__ == "__main__":
    main()
