"""Reference .are SDK v0.1 for Python 3.9+ (standard library only).

Produces the same hashes as sdk/js/are.js, so files made in one language verify in the other.
Encryption is not included here yet; use the JavaScript SDK for encrypt/decrypt.
Licensed under the Apache License 2.0.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

ARE_VERSION = "0.1.0"
LAYERS = ["header", "spatial", "graph", "mind_sense", "timeline", "ledger"]
SEALED_LAYERS = ["header", "spatial", "graph", "mind_sense", "ledger"]
PRIVACY_MODES = ["LOCAL_PRIVATE", "ENCRYPTED_SHARED", "PUBLIC_ONCHAIN"]
SORT_PLANS = ["KEEP", "SELL", "DONATE", "REPAIR", "RECYCLE"]
RELATION_TYPES = ["made_of", "instance_of", "part_of", "near", "replaces", "same_as"]
DID_RE = re.compile(r"^did:are:[a-zA-Z0-9._:-]+$")
HASH_RE = re.compile(r"^sha256:[0-9a-f]{64}$")


# ---------- canonical JSON (RFC 8785 / JCS) ----------
def _number(x: Any) -> str:
    """Format a number exactly like ECMAScript's Number.prototype.toString (as JCS requires)."""
    if isinstance(x, int) and abs(x) < 10**21:
        return str(x)
    x = float(x)
    if not math.isfinite(x):
        raise ValueError("Non-finite numbers are not allowed in .are")
    if x == 0:
        return "0"
    sign = "-" if x < 0 else ""
    sign_bit, digits_t, exp = Decimal(repr(abs(x))).normalize().as_tuple()
    digits = "".join(map(str, digits_t))
    k = len(digits)
    n = exp + k  # position of the decimal point
    if k <= n <= 21:
        out = digits + "0" * (n - k)
    elif 0 < n <= 21:
        out = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        out = "0." + "0" * (-n) + digits
    else:
        e = n - 1
        mant = digits if k == 1 else digits[0] + "." + digits[1:]
        out = mant + "e" + ("+" if e >= 0 else "-") + str(abs(e))
    return sign + out


def _string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def canonicalize(value: Any) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, (int, float)):
        return _number(value)
    if isinstance(value, str):
        return _string(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonicalize(v) for v in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys(), key=lambda k: k.encode("utf-16-be"))  # JCS sorts by UTF-16 code units
        return "{" + ",".join(_string(k) + ":" + canonicalize(value[k]) for k in keys) + "}"
    raise TypeError("Unsupported value type: %s" % type(value).__name__)


def _tagged(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------- hashing ----------
def _sealed_view(entity: Dict[str, Any], layer: str) -> Any:
    value = entity.get(layer)
    if isinstance(value, dict) and isinstance(value.get("$redacted"), str):
        return value
    if layer == "header":
        return {k: v for k, v in (value or {}).items() if k != "merkle_root"}
    if layer == "ledger":
        return {k: v for k, v in (value or {}).items() if k != "blockchain_anchor"}
    return value if value is not None else {}


def layer_hash(entity: Dict[str, Any], layer: str) -> str:
    view = _sealed_view(entity, layer)
    if isinstance(view, dict) and isinstance(view.get("$redacted"), str):
        return view["$redacted"]
    return _tagged("are-leaf:" + layer + ":" + canonicalize(view))


def layer_hashes(entity: Dict[str, Any]) -> Dict[str, str]:
    return {layer: layer_hash(entity, layer) for layer in SEALED_LAYERS}


def merkle_root(entity: Dict[str, Any]) -> str:
    level = list(layer_hashes(entity).values())
    while len(level) > 1:
        level = [
            _tagged("are-node:" + level[i] + level[i + 1]) if i + 1 < len(level) else level[i]
            for i in range(0, len(level), 2)
        ]
    return level[0]


def seal(entity: Dict[str, Any]) -> Dict[str, Any]:
    entity["header"]["merkle_root"] = merkle_root(entity)
    return entity


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# ---------- building entities ----------
def create_entity(did: str, name: str, scale_exponent: float, privacy_mode: str = "LOCAL_PRIVATE",
                  parent_did: Optional[str] = None, created_at: Optional[str] = None) -> Dict[str, Any]:
    if not DID_RE.match(did or ""):
        raise ValueError("did must look like did:are:<namespace>:<id>")
    if privacy_mode not in PRIVACY_MODES:
        raise ValueError("Unknown privacy_mode " + privacy_mode)
    return {
        "header": {"did": did, "name": name, "version": ARE_VERSION, "scale_exponent": scale_exponent,
                   "privacy_mode": privacy_mode, "merkle_root": "", "created_at": created_at or _now()},
        "spatial": {"coordinates": {"reference_frame": parent_did or "root", "position": [0, 0, 0],
                                    "rotation_quaternion": [0, 0, 0, 1]},
                    "physical_properties": {}, "geometry_refs": []},
        "graph": {"parent_did": parent_did, "children_dids": [], "relations": []},
        "mind_sense": {"ontology_tags": [], "summary": "", "human_notes": []},
        "timeline": {"head_commit": "", "history": []},
        "ledger": {"encryption_scheme": "NONE" if privacy_mode == "PUBLIC_ONCHAIN" else "AES-256-GCM",
                   "storage_cid": None, "blockchain_anchor": None},
    }


def nest(parent: Dict[str, Any], child: Dict[str, Any]) -> None:
    did = parent["header"]["did"]
    child["graph"]["parent_did"] = did
    child["spatial"].setdefault("coordinates", {})["reference_frame"] = did
    if child["header"]["did"] not in parent["graph"]["children_dids"]:
        parent["graph"]["children_dids"].append(child["header"]["did"])


def relate(entity: Dict[str, Any], type_: str, target_did: str) -> None:
    if type_ not in RELATION_TYPES:
        raise ValueError("Unknown relation type " + type_)
    if not DID_RE.match(target_did):
        raise ValueError("Bad target did " + target_did)
    rel = entity["graph"].setdefault("relations", [])
    if not any(r["type"] == type_ and r["target_did"] == target_did for r in rel):
        rel.append({"type": type_, "target_did": target_did})


def add_note(entity: Dict[str, Any], text: str = "", audio_uri: Optional[str] = None,
             author: Optional[str] = None, created_at: Optional[str] = None) -> Dict[str, Any]:
    note: Dict[str, Any] = {"text": text, "created_at": created_at or _now()}
    if audio_uri:
        note["audio_uri"] = audio_uri
    if author:
        note["author"] = author
    entity["mind_sense"]["human_notes"].append(note)
    return note


# ---------- timeline ----------
def commit(entity: Dict[str, Any], event: str, timestamp: Optional[str] = None, note: Optional[str] = None) -> str:
    seal(entity)
    body: Dict[str, Any] = {"event": event, "parent": entity["timeline"].get("head_commit") or None,
                            "root": entity["header"]["merkle_root"], "timestamp": timestamp or _now()}
    if note:
        body["note"] = note
    cid = _tagged("are-commit:" + canonicalize(body))
    entity["timeline"]["history"].append({"id": cid, **body})
    entity["timeline"]["head_commit"] = cid
    return cid


def transfer(entity: Dict[str, Any], to: str, price: Optional[Dict[str, Any]] = None,
             timestamp: Optional[str] = None, note: Optional[str] = None) -> str:
    if not to:
        raise ValueError("transfer needs a new owner (to)")
    entity["ledger"]["owner"] = to
    if price:
        entity["ledger"]["sale_price"] = price
    entity["ledger"].pop("asking_price", None)
    if entity["mind_sense"].get("sort_plan") == "SELL":
        del entity["mind_sense"]["sort_plan"]
    return commit(entity, "transferred", timestamp=timestamp, note=note)


# ---------- sharing ----------
def disclose(entity: Dict[str, Any], keep: List[str] = ()) -> Dict[str, Any]:
    out = copy.deepcopy(entity)
    for layer in SEALED_LAYERS:
        if layer == "header" or layer in keep:
            continue
        out[layer] = {"$redacted": layer_hash(entity, layer)}
    if "timeline" not in keep:
        out["timeline"] = {"head_commit": entity["timeline"]["head_commit"], "history": []}
    return out


# ---------- checking ----------
def validate(entity: Dict[str, Any]) -> List[str]:
    """Short structural check. Returns a list of problems (empty = valid). The JSON Schema is the full check."""
    errors: List[str] = []
    for layer in LAYERS:
        if not isinstance(entity.get(layer), dict):
            errors.append("missing layer: " + layer)
    if errors:
        return errors
    h = entity["header"]
    if not DID_RE.match(h.get("did") or ""):
        errors.append("header.did must match did:are:…")
    if not h.get("name"):
        errors.append("header.name is required")
    se = h.get("scale_exponent")
    if not isinstance(se, (int, float)) or not -35 <= se <= 27:
        errors.append("header.scale_exponent must be a number between -35 and 27")
    if h.get("privacy_mode") not in PRIVACY_MODES:
        errors.append("header.privacy_mode must be one of " + ", ".join(PRIVACY_MODES))
    root = h.get("merkle_root")
    if not (root == "" or (isinstance(root, str) and HASH_RE.match(root))):
        errors.append("header.merkle_root must be sha256:<64 hex> or empty")
    m = entity["mind_sense"]
    if "$redacted" not in m and m.get("sort_plan") not in (None, *SORT_PLANS):
        errors.append("mind_sense.sort_plan must be one of " + ", ".join(SORT_PLANS))
    if not isinstance(entity["timeline"].get("history"), list):
        errors.append("timeline.history must be a list")
    return errors


def verify(entity: Dict[str, Any]) -> List[str]:
    """Structure + merkle root + commit chain. Returns a list of problems (empty = verified)."""
    errors = validate(entity)
    if errors:
        return errors
    root = merkle_root(entity)
    if entity["header"]["merkle_root"] and entity["header"]["merkle_root"] != root:
        errors.append("merkle_root mismatch: file says %s, content hashes to %s" % (entity["header"]["merkle_root"], root))
    prev = None
    for c in entity["timeline"]["history"]:
        body = {k: v for k, v in c.items() if k != "id"}
        if body.get("parent") != prev:
            errors.append("commit %s does not follow %s" % (c.get("id"), prev))
        if _tagged("are-commit:" + canonicalize(body)) != c.get("id"):
            errors.append("commit %s was altered" % c.get("id"))
        prev = c.get("id")
    if entity["timeline"]["history"] and entity["timeline"]["head_commit"] != prev:
        errors.append("head_commit is not the last commit")
    return errors


def load(path: str) -> Dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(entity: Dict[str, Any], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entity, f, indent=2, ensure_ascii=False)
        f.write("\n")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("usage: python are_sdk.py <file.are>…  (verifies each file)")
        sys.exit(1)
    bad = 0
    for path in sys.argv[1:]:
        problems = verify(load(path))
        print(("✗ " if problems else "✓ ") + path + ("" if problems else "  " + load(path)["header"]["merkle_root"]))
        for p in problems:
            print("    " + p)
        bad += bool(problems)
    sys.exit(1 if bad else 0)
