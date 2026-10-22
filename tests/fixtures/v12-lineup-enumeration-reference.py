# Verbatim pure enumeration functions from pinned canonical V12. No private imports.
from functools import lru_cache
import itertools,json,sys
from typing import Any,Mapping,Sequence
from pathlib import Path
LINEUP_RULES=json.loads(Path('vendor/v12/fpl_2026_27.json').read_text())['lineup']
POSITIONS=('GK','DEF','MID','FWD')
LEGAL_FORMATIONS=frozenset(LINEUP_RULES['legal_formations'])
_P17_EXECUTION_STATS={'legal_xi_template_hits':0,'legal_xi_template_misses':0}
class LineupOptimizerError(ValueError): pass
def _formation_from_counts(counts: Mapping[str, int]) -> str | None:
    if int(counts.get("GK", 0)) != 1:
        return None
    formation = f"{int(counts.get('DEF', 0))}-{int(counts.get('MID', 0))}-{int(counts.get('FWD', 0))}"
    return formation if formation in LEGAL_FORMATIONS else None

@lru_cache(maxsize=4096)
def _legal_xi_templates(
    position_signature: tuple[str, ...],
) -> tuple[tuple[int, ...], ...]:
    """Return exact legal XI index masks for one immutable position layout.

    FPL squad structure is highly repetitive across transfer routes.  The
    legality surface depends only on the 15 position slots, never player
    identity or projection values, so recomputing the same combinations for
    every route is pure execution waste.
    """
    if len(position_signature) != 15:
        raise LineupOptimizerError("P1.7 requires OUR15 exactly")
    if any(position not in POSITIONS for position in position_signature):
        raise LineupOptimizerError("P1.7 position signature is invalid")
    required_size = int(LINEUP_RULES.get("starting_xi_size") or 11)
    required_gk = int(LINEUP_RULES.get("starting_goalkeepers") or 1)
    legal: list[tuple[int, ...]] = []
    for combo in itertools.combinations(
        range(len(position_signature)),
        required_size,
    ):
        selected = tuple(position_signature[index] for index in combo)
        if selected.count("GK") != required_gk:
            continue
        counts = {
            position: selected.count(position)
            for position in POSITIONS
        }
        if _formation_from_counts(counts):
            legal.append(tuple(combo))
    return tuple(legal)

def enumerate_legal_xi(
    players: Sequence[Mapping[str, Any]],
) -> list[tuple[int, ...]]:
    rows = [dict(row) for row in players]
    if len(rows) != 15:
        raise LineupOptimizerError("P1.7 requires OUR15 exactly")
    signature = tuple(
        str(row.get("position") or "")
        for row in rows
    )
    before = _legal_xi_templates.cache_info()
    result = list(_legal_xi_templates(signature))
    after = _legal_xi_templates.cache_info()
    _P17_EXECUTION_STATS["legal_xi_template_hits"] += max(
        0, after.hits - before.hits
    )
    _P17_EXECUTION_STATS["legal_xi_template_misses"] += max(
        0, after.misses - before.misses
    )
    return result
print(json.dumps([enumerate_legal_xi(rows) for rows in json.load(sys.stdin)]))
