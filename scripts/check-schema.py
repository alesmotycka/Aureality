"""Validate every examples/*.are file against spec/schema.are.json. Needs: pip install jsonschema"""
import glob, json, sys
import jsonschema

schema = json.load(open("spec/schema.are.json", encoding="utf-8"))
jsonschema.Draft202012Validator.check_schema(schema)
validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
failed = 0
for path in sorted(glob.glob("examples/*.are")):
    errors = list(validator.iter_errors(json.load(open(path, encoding="utf-8"))))
    print(("FAIL " if errors else "ok   ") + path)
    for e in errors:
        print("     ", list(e.path), e.message)
    failed += bool(errors)
sys.exit(1 if failed else 0)
