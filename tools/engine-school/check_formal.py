#!/usr/bin/env python3
"""Positive artifact fixtures and isolated negative acceptance checks.

All fixtures are synthetic structure tests, never customer data or approvals.
"""
import sys
sys.dont_write_bytecode = True

import argparse
import os
import copy
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from formal import ROOT, load, dump, read_data, generate, format_checker


def sample(schema):
    if 'const' in schema:
        return schema['const']
    if 'enum' in schema:
        return schema['enum'][0]
    if 'anyOf' in schema:
        return sample(schema['anyOf'][0])
    typ = schema.get('type', 'object')
    if isinstance(typ, list):
        typ = typ[0]
    if typ == 'object':
        return {k: sample(schema.get('properties', {}).get(k, {})) for k in schema.get('required', [])}
    if typ == 'array':
        return [sample(schema.get('items', {})) for _ in range(schema.get('minItems', 0))]
    if typ in ['number', 'integer']:
        return schema.get('minimum', 1)
    if typ == 'boolean':
        return False
    if typ == 'null':
        return None
    if schema.get('format') == 'date':
        return '2026-11-13'
    if schema.get('format') == 'date-time':
        return '2026-11-13T12:00:00+01:00'
    if schema.get('pattern') == '^[a-fA-F0-9]{64}$':
        return '0' * 64
    return 'syntetisk'


def fixture(schema):
    """Satisfy conditional presence from the schema; do not relax the contract."""
    doc = sample(schema)
    validator = Draft202012Validator(schema, format_checker=format_checker())
    for _ in range(20):
        errors = list(validator.iter_errors(doc))
        if not errors:
            return doc
        changed = False
        for e in errors:
            if e.validator != 'required':
                continue
            base = schema
            for key in e.absolute_path:
                base = base.get('items', {}) if isinstance(key, int) else base.get('properties', {}).get(key, {})
            for key in e.validator_value:
                if key not in e.instance:
                    e.instance[key] = sample(base.get('properties', {}).get(key, {}))
                    changed = True
        if not changed:
            raise AssertionError('Cannot construct valid structural fixture: ' + '; '.join(e.message for e in errors))
    raise AssertionError('Fixture did not converge')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    data = read_data()
    _, schemas, _ = generate(data)
    resources = Registry().with_resources((s['$id'], Resource.from_contents(s)) for s in schemas.values())
    # Fixture construction needs the leaf constraints; validation below still
    # exercises the delivered schemas and their Registry-resolved references.
    def expand(value, resolver):
        if isinstance(value, list):
            return [expand(v, resolver) for v in value]
        if not isinstance(value, dict):
            return value
        out = {}
        if '$ref' in value:
            resolved = resolver.lookup(value['$ref'])
            out.update(expand(resolved.contents, resolved.resolver))
        out.update({k: expand(v, resolver) for k, v in value.items() if k not in ['$ref', '$defs']})
        return out

    results = []
    fixtures = {}
    for sid, reg in data['registries'].items():
        if 'artifact_path' not in reg:
            continue
        doc = fixture(expand(schemas[sid], resources.resolver(schemas[sid]['$id'])))
        fixtures[sid] = doc
        results.append({'test': 'synthetic-artifact:' + sid, 'passed': True})

    def rejects(name, schema, doc):
        ok = not Draft202012Validator(schema, registry=resources, format_checker=format_checker()).is_valid(doc)
        results.append({'test': name, 'passed': ok})
        assert ok, name

    base = load(ROOT / 'schemas/lists/format.json')
    assert Draft202012Validator(schemas['list'], registry=resources, format_checker=format_checker()).is_valid(base)
    mutations = [
        ('missing-id', lambda d: d.pop('id')),
        ('invalid-id-pattern', lambda d: d.update(id='INVALID ID')),
        ('empty-value-definition', lambda d: d['values'][0].update(definition='')),
        ('impossible-date', lambda d: d['source'][0].update(read_on='2026-02-30')),
        ('extra-value-property', lambda d: d['values'][0].update(unexpected=True)),
    ]
    for name, mutate in mutations:
        doc = copy.deepcopy(base)
        mutate(doc)
        rejects('list-negative:' + name, schemas['list'], doc)

    sid = '01-brief-godkjent'
    for key in ['schema_id', 'schema_version', 'forrige_artefakt', 'kritikk', 'godkjenning']:
        doc = copy.deepcopy(fixtures[sid]); del doc[key]
        rejects('missing-envelope:' + key, schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['unexpected'] = True
    rejects('unknown-top-level-property', schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['schema_id'] = '01-briefutkast'
    rejects('wrong-artifact-identity', schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['kampanje']['channels'] = ['google-ads']
    rejects('filter-family-is-not-concrete-channel', schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['kampanje']['countries'] = ['EU']
    rejects('group-is-not-country-code', schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['kampanje']['countries'] = ['UK']
    rejects('unnormalized-country-alias', schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['kampanje']['timing']['start'] = '2026-02-30T12:00:00Z'
    rejects('invalid-calendar-date', schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['tilbud']['type'] = 'prisnedsettelse'
    doc['grunnlag']['domener']['tilbud'].pop('price', None)
    rejects('conditional-price-required', schemas[sid], doc)
    for stages in [[], ['salgsrunde'], ['topp', 'midt']]:
        doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['kampanje']['funnel']['stage'] = stages
        rejects('exactly-one-main-stage:' + str(stages), schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['SHA-256'] = 'not-a-hash'
    rejects('invalid-sha256', schemas[sid], doc)
    # Each model contribution needs a complete attest, including later rows.
    doc = copy.deepcopy(fixtures[sid]); doc['modellspor'] = [{'role': 'skriver', 'attest': {}}, {'role': 'kritiker', 'attest': {}}]
    rejects('empty-model-attest', schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['godkjenning'] = []
    rejects('empty-human-decision', schemas[sid], doc)
    sid = '09-kanalformat-godkjent'
    for fmt, product, behavior in [('video','generisk','brukerstartet'), ('yt-bumper','yt-bumper','ikke-hoppbar'),
                                    ('yt-non-skippable','yt-non-skippable','ikke-hoppbar')]:
        doc = copy.deepcopy(fixtures[sid])
        domain = doc['grunnlag']['domener']['kanal-format']
        domain['format'] = fmt
        domain['binding'].update(creative_medium='video', ad_product=product, delivery_behavior=behavior)
        domain['specs'].update(width_px=1920, height_px=1080, duration_s=6)
        assert Draft202012Validator(schemas[sid], registry=resources, format_checker=format_checker()).is_valid(doc), fmt
        results.append({'test': 'lossless-format:' + fmt, 'passed': True})
        for key, bad in [('creative_medium','bilde'), ('ad_product','yt-skippable'), ('delivery_behavior','hoppbar')]:
            if fmt == 'video' and key == 'delivery_behavior':
                continue  # Generic video does not imply one playback behavior.
            broken = copy.deepcopy(doc)
            broken['grunnlag']['domener']['kanal-format']['binding'][key] = bad
            rejects('inconsistent-format:' + fmt + ':' + key, schemas[sid], broken)
        broken = copy.deepcopy(doc)
        del broken['grunnlag']['domener']['kanal-format']['binding']['delivery_behavior']
        rejects('missing-format-axis:' + fmt, schemas[sid], broken)
    doc = copy.deepcopy(fixtures[sid])
    doc['grunnlag']['domener']['kanal-format']['channel'] = 'alle'
    rejects('wildcard-is-not-concrete-channel', schemas[sid], doc)
    sid = '02-leserkort-godkjent'
    doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['leser']['schwartz']['level'] = True
    rejects('boolean-is-not-awareness-integer', schemas[sid], doc)
    doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['leser']['roles'].pop('b2b', None)
    doc['grunnlag']['domener']['kampanje']['market'] = 'B2B'
    rejects('b2b-roles-conditional-across-imports', schemas[sid], doc)
    # Open evidence records remain extensible, as their registry says.
    doc = copy.deepcopy(fixtures[sid]); doc['grunnlag']['domener']['leser']['schwartz']['evidence']['ny_kildelocator'] = 'syntetisk'
    assert Draft202012Validator(schemas[sid], registry=resources).is_valid(doc)
    results.append({'test': 'registered-open-record-remains-open', 'passed': True})
    sys.path.insert(0, str(Path(__file__).resolve().parent if Path(__file__).with_name('schema_filter.py').exists() else Path(__file__).resolve().parents[1] / 'scripts'))
    from schema_filter import evaluate
    for channel, expected in [('e-post', 'bestått'), ('youtube', 'uavklart')]:
        verdict = evaluate({'channel': 'alle'}, {'channel': channel, 'placement': 'egen-flate'})
        ok = verdict['status'] == expected
        results.append({'test': 'generic-placement-channel:' + channel, 'passed': ok})
        assert ok, verdict

    with tempfile.TemporaryDirectory(prefix='fume-formal-') as folder:
        root = Path(folder)
        for name in ['schemas', 'skills', 'flows', 'sources', 'review']:
            shutil.copytree(ROOT / name, root / name, ignore=shutil.ignore_patterns('__pycache__'))

        def run():
            return subprocess.run([sys.executable, str(Path(__file__).resolve().with_name('validate.py'))], cwd=root, capture_output=True, text=True, env={**os.environ, 'ENGINE_SCHOOL_ROOT': str(root), 'PYTHONDONTWRITEBYTECODE': '1'})

        assert run().returncode == 0, 'Isolated baseline failed'
        mutations = [
            ('unknown-condition-operand', 'schemas/tilbud.json', lambda d: next(f for f in d['fields'] if f['applies_when']['all'])['applies_when']['all'][0].update(value='invented-offer')),
            ('unknown-metadata-who', 'flows/brief-en-setning.json', lambda d: d['steps'][0].update(who='invented-role')),
            ('unknown-read-by', 'schemas/kampanje.json', lambda d: d['read_by'].append('missing-reader')),
            ('unknown-skill-reference', 'flows/brief-en-setning.json', lambda d: d['skills_used'].append('missing-skill')),
            ('unknown-conflict-reference', 'skills/Copy.json', lambda d: d[0]['conflicts_with'].append('missing-skill')),
            ('unknown-list-value', 'skills/Copy.json', lambda d: d[0]['applies_when'].update(channel='invented-channel')),
            ('missing-source-locator', 'skills/Copy.json', lambda d: d[0]['sources'][0].pop('locator')),
            ('definition-extra-property', 'flows/brief-en-setning.json', lambda d: d.update(unexpected=True)),
            ('missing-list-member', 'schemas/lists/channel.json', lambda d: d['values'].pop(0)),
            ('weakened-artifact-schema', 'schemas/json/01-brief-godkjent.schema.json', lambda d: d.update(additionalProperties=True)),
            ('invalid-iso-date', 'skills/Plattform.json', lambda d: d[0].update(read_on='2026-02-30')),
        ]
        for name, file, mutate in mutations:
            path = root / file
            before = path.read_bytes()
            doc = load(path); mutate(doc); path.write_text(dump(doc))
            result = run()
            path.write_bytes(before)
            parsed = __import__('json').loads(result.stdout)
            ok = result.returncode != 0 and parsed['result'] == 'FAIL' and bool(parsed['errors'])
            results.append({'test': 'cli-rejects:' + name, 'passed': ok})
            assert ok, name + ': ' + result.stdout + result.stderr
        # Exercise optional artifact validation through the actual CLI as well.
        path = root / 'synthetic-artifact.json'; path.write_text(dump(fixtures['oppdrag']))
        result = subprocess.run([sys.executable, str(Path(__file__).resolve().with_name('validate.py')), '--artifact', str(path)], cwd=root, capture_output=True, text=True, env={**os.environ, 'ENGINE_SCHOOL_ROOT': str(root), 'PYTHONDONTWRITEBYTECODE': '1'})
        assert result.returncode == 0, result.stdout + result.stderr
        results.append({'test': 'cli-validates-synthetic-artifact', 'passed': True})
    report = {'result': 'PASS', 'synthetic_artifact_count': len(fixtures),
              'test_count': len(results), 'tests': results,
              'limits': 'Synthetic structural fixtures only; no actual approvals, signatures, customer data or flow execution.'}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(dump(report))
    print(f'PASS: {len(results)} checks, including {len(fixtures)} synthetic artifacts and {len(mutations)} CLI error injections.')


if __name__ == '__main__':
    main()
