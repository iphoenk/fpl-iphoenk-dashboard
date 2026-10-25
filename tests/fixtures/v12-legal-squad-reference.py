from __future__ import annotations
from typing import Any, Mapping, Sequence
from collections import Counter
import json,sys
from pathlib import Path
SQUAD_RULES=json.loads((Path(__file__).parents[2]/"vendor/v12/fpl_2026_27.json").read_text())["squad"]
POSITIONS=("GK","DEF","MID","FWD")
class PackageSearchError(ValueError): pass

def _int(value: Any, *, label: str, allow_zero: bool = True) -> int:
    try:
        out = int(value)
    except (TypeError, ValueError) as exc:
        raise PackageSearchError(f"{label} must be integer") from exc
    if out < 0 or (not allow_zero and out <= 0):
        raise PackageSearchError(f"{label} out of range")
    return out


def _position(value: Any) -> str:
    out = str(value or "").upper()
    if out not in POSITIONS:
        raise PackageSearchError(f"unsupported position: {out!r}")
    return out


def _element(row: Mapping[str, Any]) -> int:
    return _int(row.get("element"), label="element", allow_zero=False)


def _team_id(row: Mapping[str, Any]) -> int:
    return _int(row.get("team_id"), label="team_id", allow_zero=False)


def legal_squad(rows: Sequence[Mapping[str, Any]]) -> tuple[bool, str]:
    expected_size = int(SQUAD_RULES.get("squad_size") or 15)
    expected_positions = {
        str(position): int(count)
        for position, count in (SQUAD_RULES.get("position_counts") or {}).items()
    }
    max_club = int(SQUAD_RULES.get("max_players_per_club") or 3)
    if len(rows) != expected_size:
        return False, "SQUAD_SIZE"
    ids = [_element(row) for row in rows]
    if len(ids) != len(set(ids)):
        return False, "DUPLICATE_PLAYER"
    counts = Counter(_position(row.get("position")) for row in rows)
    if dict(counts) != expected_positions:
        return False, "POSITION_COMPOSITION"
    clubs = Counter(_team_id(row) for row in rows)
    if clubs and max(clubs.values()) > max_club:
        return False, "MAX_THREE_PER_CLUB"
    return True, "PASS"



if __name__ == "__main__":
 print(json.dumps([legal_squad(rows) for rows in json.load(sys.stdin)]))
