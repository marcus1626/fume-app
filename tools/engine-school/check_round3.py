#!/usr/bin/env python3
"""Independent membership audit: reads delivered JSON, never imports the generator.

Prose, free-text locators and explicitly open records are outside closed-list
membership. Platform combinations still require account/objective/market evidence.
"""
import sys
sys.dont_write_bytecode = True

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from referencing import Registry, Resource

import os
ROOT = Path(os.environ.get('ENGINE_SCHOOL_ROOT', Path(__file__).resolve().parents[2] / 'docs' / 'engine-school')).resolve()


def load(path):
    return json.loads(path.read_text())


def walk(value, pointer=''):
    yield pointer, value
    if isinstance(value, dict):
        for key, item in value.items():
            yield from walk(item, pointer + '/' + key.replace('~', '~0').replace('/', '~1'))
    elif isinstance(value, list):
        for n, item in enumerate(value):
            yield from walk(item, pointer + '/' + str(n))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, help='Write a JSON report only to this explicit path.')
    args = parser.parse_args()
    typed = lambda v: (type(v).__name__, json.dumps(v, sort_keys=True))
    lists = {p.stem: load(p) for p in (ROOT / 'schemas/lists').glob('*.json')}
    members = {k: {typed(v['id']) for v in doc['values']} for k, doc in lists.items()}
    bindings = defaultdict(set)
    errors, counts = [], Counter()

    def check(name, value, label, category):
        counts[category] += 1
        if typed(value) not in members.get(name, set()):
            errors.append(f'{label}: {value!r} absent from {name}')

    schema_docs = [load(p) for p in (ROOT / 'schemas/json').rglob('*.json')]
    resources = Registry().with_resources((s['$id'], Resource.from_contents(s)) for s in schema_docs)

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

    for path in (ROOT / 'schemas/json').glob('*.json'):
        schema = load(path)
        for ptr, node in walk(expand(schema, resources.resolver(schema['$id']))):
            if not isinstance(node, dict):
                continue
            if 'x-list' in node:
                name = Path(node['x-list']).stem
                for value in node['enum']:
                    check(name, value, path.name + ptr, 'schema_enums')
            if 'x-field' in node:
                target = node if 'x-list' in node else node.get('items', {})
                if 'x-list' in target:
                    bindings[node['x-field']].add(Path(target['x-list']).stem)
    registries = [load(p) for p in (ROOT / 'schemas').glob('*.json') if p.name != '_index.json']
    fields = {f['id']: f for reg in registries for f in reg['fields']}
    for fid, f in fields.items():
        if f['values'] and not bindings[fid]:
            errors.append('Unbound closed field: ' + fid)
        for row in f['values']:
            for name in bindings[fid]:
                check(name, row['value'], fid, 'registry_values')
        for term in f['applies_when']['all']:
            check('condition-operator', term['op'], fid, 'condition_operators')
            target = fields.get(term['field'])
            if target is None:
                errors.append('Unknown condition field: ' + term['field'])
            elif term['op'] == 'present':
                counts['presence_operands'] += 1
                if type(term['value']) is not bool:
                    errors.append(fid + ': presence operand must be boolean')
            elif target['values']:
                vals = term['value'] if term['op'] == 'in' else [term['value']]
                for value in vals:
                    for name in bindings[target['id']]:
                        check(name, value, fid, 'condition_operands')
            else:
                counts['open_condition_operands'] += 1
    metadata = {'subject':'subject', 'tier':'tier', 'state':'state', 'lang':'language',
                'who':'who', 'filled_by':'filled-by', 'scope':'scope', 'check':'check-type',
                'selection_kind':'placement-kind', 'selectable':'placement-selection'}
    files = [p for folder in ['skills','flows','schemas','sources'] for p in (ROOT / folder).glob('*.json')]
    for path in files:
        doc = load(path)
        for ptr, node in walk(doc):
            if not isinstance(node, dict):
                continue
            for key, name in metadata.items():
                if key in node and isinstance(node[key], str) and not (path.name == '_index.json' and key == 'scope'):
                    check(name, node[key], str(path.relative_to(ROOT)) + ptr + '/' + key, 'metadata')
            if node.get('kind') == 'field_registry':
                check('registry-kind', node['kind'], path.name + ptr, 'metadata')
            if 'checkpoints' in node and isinstance(node['checkpoints'], list):
                for cp in node['checkpoints']:
                    check('checkpoint', cp['n'] if isinstance(cp, dict) else cp, path.name + ptr, 'checkpoints')
            if 'path' in node and 'values' in node and 'type' in node:
                check('field-type', node['type'], path.name + ptr, 'field_types')
            if 'value' in node and 'channel' in node:
                for v in node['channel'] if isinstance(node['channel'], list) else [node['channel']]:
                    check('channel', v, path.name + ptr, 'placement_channels')
            if 'parent' in node and 'selection_kind' in node:
                check('placement', node['parent'], path.name + ptr, 'placement_parents')
                if node['selectable'] != 'ikke-selvstendig':
                    errors.append(path.name + ptr + ': sub-surface cannot be independently selectable')
            if 'constraint' in node and 'availability' in node:
                for key in ['channel','placement','format','availability','rule_kind']:
                    if key in node:
                        check({'rule_kind':'rule-kind'}.get(key,key), node[key], path.name + ptr, 'structured_examples')
            if all(k in node for k in ['format','ad_product','creative_medium','delivery_behavior']):
                for key, name in [('format','format'),('ad_product','ad-product'),('creative_medium','creative-medium'),('delivery_behavior','delivery-behavior')]:
                    for v in node[key] if isinstance(node[key], list) else [node[key]]:
                        check(name, v, path.name + ptr, 'format_contract')
        if path.parent.name == 'skills':
            for skill in doc:
                for key, val in skill['applies_when'].items():
                    pairs = [('funnel.'+k,v) for k,v in val.items()] if key == 'funnel' else [(key,val)]
                    for dim, item in pairs:
                        for v in item if isinstance(item,list) else [item]:
                            for name in bindings['skill-filter.'+dim]:
                                check(name, v, skill['id'], 'skill_predicates')
    for value in ['alle','google-ads','sosiale-medier']:
        counts['channel_separation'] += 1
        if typed(value) in members['channel'] or typed(value) not in members['channel-filter']:
            errors.append('Channel separation failed: ' + value)
    report = {'result':'FAIL' if errors else 'PASS', 'counts':dict(counts), 'errors':errors,
              'limits':__doc__.strip()}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return bool(errors)


if __name__ == '__main__':
    raise SystemExit(main())
