"""Python SDK tests: same hashes as JavaScript. Run from the repo root: python -m unittest discover -s test -p 'test_*.py'"""
import glob
import json
import os
import random
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "sdk", "python"))
import are_sdk as are  # noqa: E402

T = "2026-10-26T09:00:00.000Z"


def js_canonicalize(values):
    script = ("import('./sdk/js/are.js').then(a=>{let d='';process.stdin.on('data',c=>d+=c);"
              "process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d).map(a.canonicalize))))})")
    out = subprocess.run(["node", "-e", script], input=json.dumps(values), capture_output=True, text=True, cwd=ROOT, check=True)
    return json.loads(out.stdout)


class PythonSdk(unittest.TestCase):
    def test_every_file_verifies(self):
        files = glob.glob(os.path.join(ROOT, "examples", "*.are")) + glob.glob(os.path.join(ROOT, "templates", "*", "*.are"))
        self.assertGreater(len(files), 20)
        for path in files:
            self.assertEqual(are.verify(are.load(path)), [], path)

    def test_numbers_and_strings_match_javascript(self):
        rng = random.Random(42)
        values = [0, -0.0, 1, -1, 0.1, 1e21, 1e-7, 123e-20, 1.5e53, 8.8e26, 1.6735575e-27, 2 ** 53, 1e16, 14.0, 0.000001,
                  "ä ✓ 🌌", "quote \" backslash \\ tab \t nl \n", "\u0001\u001f\u007f", {"é": 1, "z": 2, "a": 3, "\U0001F600": 4, "｡": 5}]
        values += [rng.uniform(-1, 1) * 10 ** rng.randint(-30, 30) for _ in range(300)]
        self.assertEqual([are.canonicalize(v) for v in values], js_canonicalize(values))

    def test_python_builds_the_same_mug_as_javascript(self):
        desk = are.create_entity("did:are:local:desk-01", "Office desk", 0, created_at=T)
        mug = are.create_entity("did:are:local:mug-9942a", "Favourite studio coffee mug", -1, created_at=T)
        are.nest(desk, mug)
        mug["spatial"]["coordinates"]["position"] = [0.35, 0.74, 0.12]
        mug["spatial"]["physical_properties"] = {"mass_kg": 0.34, "dimensions_m": [0.09, 0.09, 0.11], "condition": {"grade": "good"}}
        mug["spatial"]["geometry_refs"] = [{"lod": 0, "format": "GAUSSIAN_SPLAT", "uri": "local://scans/mug-9942a.splat"}]
        are.relate(mug, "made_of", "did:are:public:material:porcelain")
        mug["mind_sense"] = {"ontology_tags": ["kitchenware", "daily-driver"], "summary": "White porcelain mug, 330 ml.",
                             "human_notes": [{"text": "Bought at a market in Prague.", "created_at": T}], "sort_plan": "KEEP",
                             "sensory_aura": {"attention_priority": 0.2, "ambient_profile": "deep_focus"}}
        are.commit(mug, "created", timestamp=T)
        reference = are.load(os.path.join(ROOT, "examples", "coffee_mug.are"))
        self.assertEqual(mug["header"]["merkle_root"], reference["header"]["merkle_root"])
        self.assertEqual(mug["timeline"]["head_commit"], reference["timeline"]["head_commit"])

    def test_tampering_and_sharing(self):
        e = are.create_entity("did:are:local:x", "X", 0, created_at=T)
        are.add_note(e, "private", created_at=T)
        are.commit(e, "created", timestamp=T)
        shared = are.disclose(e, ["ledger"])
        self.assertEqual(are.verify(shared), [])
        self.assertNotIn("private", json.dumps(shared))
        e["mind_sense"]["summary"] = "edited"
        self.assertTrue(are.verify(e))

    def test_transfer(self):
        e = are.create_entity("did:are:local:x", "X", 0, created_at=T)
        e["mind_sense"]["sort_plan"] = "SELL"
        are.commit(e, "created", timestamp=T)
        are.transfer(e, "did:are:person:buyer", timestamp=T)
        self.assertEqual([c["event"] for c in e["timeline"]["history"]], ["created", "transferred"])
        self.assertNotIn("sort_plan", e["mind_sense"])
        self.assertEqual(are.verify(e), [])


if __name__ == "__main__":
    unittest.main()
