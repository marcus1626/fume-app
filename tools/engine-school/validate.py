#!/usr/bin/env python3
"""Validate definitions, closed vocabularies, references and optional real artifacts.

Usage: python tools/engine-school/validate.py [--artifact path.json ...]
No remote schema fetching; all $ref targets must be registered local resources.
"""
import sys
sys.dont_write_bytecode = True

import argparse
import os
from collections import Counter
import json
from pathlib import Path
import subprocess
import sys

try:
    from jsonschema import Draft202012Validator, FormatChecker
    from referencing import Registry, Resource
except ImportError:
    raise SystemExit('Install dependencies: python -m pip install -r tools/engine-school/requirements.txt')

from formal import ROOT, BASE, DRAFT, load, dump, typed, walk, read_data, generate, field_list, format_checker


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', action='append', type=Path, default=[], help='Validate a payload using its schema_id.')
    parser.add_argument('--report', type=Path, help='Write machine-readable validation counts.')
    args = parser.parse_args()
    errors = []
    counts = Counter()

    def check(ok, message, category='cross_references'):
        counts[category] += 1
        if not ok:
            errors.append(message)

    try:
        data = read_data()
        schema_root = ROOT / 'schemas/json'
        schema_paths = sorted(schema_root.rglob('*.json'))
        schemas = {p.relative_to(schema_root).as_posix(): load(p) for p in schema_paths}
        lists = {p.stem: load(p) for p in sorted((ROOT / 'schemas/lists').glob('*.json'))}
        counts['strict_json_files'] = 2 + len(data['registries']) + len(data['flows']) + len(data['skill_files']) + 1 + len(schemas) + len(lists)
        for name, schema in schemas.items():
            check(schema.get('$schema') == DRAFT, f'{name}: wrong JSON Schema draft', 'meta_schema_checks')
            Draft202012Validator.check_schema(schema)
            counts['json_schemas'] += 1
        schema_ids = [s['$id'] for s in schemas.values()]
        check(len(schema_ids) == len(set(schema_ids)), 'Duplicate JSON Schema $id')
        resources = Registry().with_resources((s['$id'], Resource.from_contents(s)) for s in schemas.values())
        checker = format_checker()

        def validate(doc, sid, label, category):
            schema = schemas.get(sid + '.schema.json')
            if schema is None:
                errors.append(f'{label}: missing JSON Schema {sid}')
                return
            validator = Draft202012Validator(schema, registry=resources, format_checker=checker)
            found = sorted(validator.iter_errors(doc), key=lambda e: str(list(e.absolute_path)))
            for error in found:
                pointer = '/' + '/'.join(map(str, error.absolute_path))
                errors.append(f'{label}{pointer}: {error.message}')
            counts[category] += 1

        # Every inline enum must be a typed subset of its named list, never a
        # handwritten lookalike. Regeneration checks the exact concrete subset.
        list_ids = {k: {typed(v['id']) for v in row['values']} for k, row in lists.items()}
        for name, schema in schemas.items():
            for ptr, node in walk(schema):
                if not isinstance(node, dict):
                    continue
                if '$ref' in node:
                    check(resources.resolver(schema['$id']).lookup(node['$ref']) is not None,
                          f'{name}{ptr}: unresolved $ref')
                if 'x-list' in node:
                    lname = Path(node['x-list']).stem
                    check(lname in lists and bool(node.get('enum')) and all(typed(v) in list_ids[lname] for v in node.get('enum', [])),
                          f'{name}{ptr}: enum/list mismatch', 'list_references')
        for name, doc in lists.items():
            validate(doc, 'list', f'schemas/lists/{name}.json', 'lists')
            check(name == doc['id'], f'{name}: list ID/filename mismatch')
            check(len(doc['values']) == len(list_ids[name]), f'{name}: duplicate value ID')
            for val in doc['values']:
                if name in ['channel', 'placement', 'format']:
                    check(bool(val.get('source')) and all('verified' in x and 'read_on' in x and 'url' in x for x in val['source']),
                          f'{name}/{val["id"]}: missing platform verification metadata', 'list_references')
        skills = {}
        for filename, rows in data['skill_files'].items():
            check(isinstance(rows, list), filename + ': skill file must be array')
            for n, skill in enumerate(rows):
                validate(skill, 'skill', f'skills/{filename}.json/{n}', 'skills')
                check(skill['id'] not in skills, 'Duplicate skill: ' + skill['id'])
                skills[skill['id']] = skill
        flows = data['flows']
        ids = set(skills) | set(flows)
        check(not (set(skills) & set(flows)), 'Skill and flow IDs must not collide')
        for sid, skill in skills.items():
            for target in skill['conflicts_with']:
                check(target in skills and target != sid, f'{sid}: invalid conflict {target}')
                if target in skills:
                    check(sid in skills[target]['conflicts_with'], f'{sid}/{target}: asymmetric conflict')
        for name, flow in flows.items():
            validate(flow, 'flow', f'flows/{name}.json', 'flows')
            check(flow['id'] == name, f'{name}: flow ID/filename mismatch')
            for target in flow['skills_used']:
                check(target in skills, f'{name}: unknown skills_used {target}')
        for n, entry in enumerate(data['pensum']):
            validate(entry, 'pensum-entry', f'sources/pensum.json/{n}', 'pensum_entries')
        regs = data['registries']
        fields = {f['id']: f for r in regs.values() for f in r['fields']}
        for name, reg in regs.items():
            validate(reg, 'field-registry', f'schemas/{name}.json', 'registries')
            check(name == reg['id'], f'{name}: registry ID/filename mismatch')
            for target in reg['read_by']:
                check(target in ids, f'{name}: invalid read_by {target}')
            for target in reg['imports']:
                check(target in regs, f'{name}: invalid import {target}')
            for f in reg['fields']:
                for target in f['read_by']:
                    check(target in ids, f'{f["id"]}: invalid read_by {target}')
                for target in f['lever']['flows']:
                    check(target in flows, f'{f["id"]}: invalid lever flow {target}')
                if f['values']:
                    lname = field_list(f)
                    for value in f['values']:
                        check(typed(value['value']) in list_ids.get(lname, set()),
                              f'{f["id"]}: unknown {lname} value {value["value"]!r}', 'list_references')
                for term in f['applies_when']['all']:
                    check(term['field'] in fields, f'{f["id"]}: unknown condition field {term["field"]}')
                    target = fields.get(term['field'])
                    if target and target['values'] and term['op'] != 'present':
                        allowed = {typed(v['value']) for v in target['values']}
                        vals = term['value'] if term['op'] == 'in' else [term['value']]
                        check(all(typed(v) in allowed for v in vals), f'{f["id"]}: condition outside closed list', 'list_references')
        validate(data['registry_index'], 'registry-index', 'schemas/_index.json', 'indexes')
        validate(data['flow_index'], 'flow-index', 'flows/_index.json', 'indexes')

        # Deterministic comparison catches missing mined values, stale generated
        # enums, omitted artifact schemas and accidentally weakened schemas.
        expected_lists, expected_schemas, inventory = generate(data)
        check(set(lists) == set(expected_lists), 'List coverage differs from mined variables', 'generated_files')
        check(set(schemas) == {k + '.schema.json' for k in expected_schemas}, 'JSON Schema coverage differs', 'generated_files')
        for k, v in expected_lists.items():
            check(lists.get(k) == v, f'List drift: {k}; run tools/build_formal.py', 'generated_files')
        for k, v in expected_schemas.items():
            check(schemas.get(k + '.schema.json') == v, f'JSON Schema drift: {k}; run tools/build_formal.py', 'generated_files')
        for occurrence in inventory['occurrences']:
            check(typed(occurrence['value']) in list_ids.get(occurrence['list'], set()),
                  f'{occurrence["file"]}{occurrence["pointer"]}: unlisted value', 'mined_occurrences')
        for path, binding in data['registry_index']['artifact_bindings'].items():
            sid = Path(binding['schema']).stem
            check(sid + '.schema.json' in schemas, path + ': missing formal artifact schema', 'artifact_bindings')
        for path in args.artifact:
            doc = load(path)
            sid = doc.get('schema_id') if isinstance(doc, dict) else None
            check(sid in regs and 'artifact_path' in regs.get(sid, {}), str(path) + ': unknown artifact schema_id')
            if sid in regs:
                validate(doc, sid, str(path), 'artifact_instances')
        # Retain established semantic/index/filter/override integrity checks.
        # This does not call the builder and cannot repair invalid input silently.
        legacy = subprocess.run([sys.executable, str(Path(__file__).resolve().with_name('validate_schemas.py') if Path(__file__).with_name('validate_schemas.py').exists() else Path(__file__).resolve().parents[1] / 'scripts/validate_schemas.py')], cwd=ROOT,
                                capture_output=True, text=True, env={**os.environ, 'ENGINE_SCHOOL_ROOT': str(ROOT), 'PYTHONDONTWRITEBYTECODE': '1'})
        check(legacy.returncode == 0, 'Registry integrity validator failed:\n' + legacy.stdout + legacy.stderr, 'registry_integrity_runs')
        if legacy.returncode == 0:
            report = json.loads(legacy.stdout)
            counts['registry_integrity_checks'] = sum(report.get('checks', {}).values())
        independent = subprocess.run([sys.executable, str(Path(__file__).resolve().with_name('check_round3.py'))], cwd=ROOT,
                                     capture_output=True, text=True, env={**os.environ, 'ENGINE_SCHOOL_ROOT': str(ROOT), 'PYTHONDONTWRITEBYTECODE': '1'})
        check(independent.returncode == 0, 'Independent membership audit failed:\n' + independent.stdout + independent.stderr,
              'independent_coverage_runs')
        if independent.returncode == 0:
            audit = json.loads(independent.stdout)
            counts['independent_coverage_checks'] = sum(audit['counts'].values())
        counts['fields'] = len(fields)
        counts['artifact_schemas'] = len(data['registry_index']['artifact_bindings'])
    except Exception as error:
        errors.append(f'{type(error).__name__}: {error}')
    report = {'result': 'FAIL' if errors else 'PASS', 'counts': dict(sorted(counts.items())), 'errors': errors}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(dump(report))
    print(dump(report), end='')
    return int(bool(errors))


if __name__ == '__main__':
    raise SystemExit(main())
