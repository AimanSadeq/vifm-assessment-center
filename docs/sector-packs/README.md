# Sector Packs

The Caliber competency framework is **sector-agnostic**. The domains, clusters,
38 competencies, definitions, peer-reviewed grounding, CBI questions, and
self-report scales (Likert + forced-choice) are **universal** and work for any
industry.

The only layer that benefits from industry context is the **SJT (situational
judgement) scenarios** — situational items read more realistically when set in
the candidate's world.

## How it's structured

| Layer | Where | Sector-specific? |
|---|---|---|
| Framework (4/8/38 + definitions) | `competency-framework-v2-design.md` | No — universal |
| Research grounding + citations | `competency-framework-research-grounding.md` | No — universal |
| CBI questions | `competency-items-cluster1.md`, `competency-items-clusters2-8.md` | No — universal |
| Self-report (Likert + forced-choice) | `competency-self-report-*.md` | No — universal |
| **SJT — sector-neutral base** | `competency-items-cluster1.md`, `competency-items-clusters2-8.md` | **Base (generic workplace)** |
| **SJT — sector packs** | `sector-packs/<sector>-sjt.md` | **Yes** |

So: a client in any industry uses the universal core + the **neutral SJT base**.
A finance/banking client can swap in (or add) the **finance pack** SJTs for higher
fidelity.

## Available packs

- `finance-banking-sjt.md` — finance & banking SJT variants for all 38
  competencies (GCC banking context).

## Building a new sector pack

For each competency, write **one SJT** that:
1. Targets the **same competency** and preserves the **same MOST/LEAST key logic**
   as the neutral base item (so scoring stays comparable).
2. Sets the scenario in the target sector's realistic work context.
3. Avoids requiring sector-specific technical *knowledge* — it should test the
   **competency**, not industry trivia (unless the pack is deliberately a
   technical/knowledge add-on).
4. Gets its key confirmed by sector SMEs + pilot item stats before high-stakes
   use, exactly like the base items.

Keep the competency IDs/names identical to the universal framework so packs are
interchangeable.
