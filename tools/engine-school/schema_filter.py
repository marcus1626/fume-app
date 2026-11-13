#!/usr/bin/env python3
"""Evaluate one concrete creative/part context against a normalized skill filter.

No inference from funnel to awareness, from country to law, or across creatives.
The caller supplies verified facts. This helper does not grant legal approval.
"""
import json
from pathlib import Path

import os
ROOT = Path(os.environ.get('ENGINE_SCHOOL_ROOT', Path(__file__).resolve().parents[2] / 'docs' / 'engine-school')).resolve()
WILDCARDS = {'alle', 'begge'}
FORMAT_PARENTS = {
    'yt-skippable': 'video', 'yt-non-skippable': 'video', 'yt-in-feed': 'video',
    'yt-bumper': 'video', 'yt-masthead': 'video', 'yt-shorts': 'video',
    'tt-spark': 'video', 'tt-non-spark': 'video',
}
CHANNEL_PARENTS = {
    'youtube': ['sosiale-medier'],
    'google-demand-gen': ['google-ads'], 'google-ads-other':['google-ads'], 'annet-sosialt':['sosiale-medier'],
    'meta': ['sosiale-medier'], 'tiktok': ['sosiale-medier'], 'linkedin': ['sosiale-medier'],
}

def flatten(value, prefix=''):
    out = {}
    for key, item in value.items():
        path = prefix+'.'+key if prefix else key
        if isinstance(item, dict): out.update(flatten(item, path))
        else: out[path] = item
    return out

def array(value):
    return value if isinstance(value, list) else [value]

def typed(value):
    # bool and int must not compare as equal in a closed vocabulary.
    return (type(value).__name__, json.dumps(value, ensure_ascii=False, sort_keys=True))

def vocabularies():
    registry = json.loads((ROOT/'schemas/skill-filter.json').read_text())
    return {f['path']: {typed(v['value']) for v in f['values']} for f in registry['fields']}

def expand(key, values):
    out = list(values)
    for value in values:
        if key == 'format' and value in FORMAT_PARENTS: out.append(FORMAT_PARENTS[value])
        if key == 'channel': out.extend(CHANNEL_PARENTS.get(value, []))
    return out

def evaluate(predicate, context):
    """Return bestått/avvist/uavklart and a trace for every explicit dimension.

    Context lists are alternatives within ONE creative/part. Multiple creatives
    must be evaluated separately; the caller must never concatenate their axes.
    An explicit empty trigger/legal_area list confirms none applies. An absent
    dimension means unknown. Structural illegal values block all selection.
    """
    vocab = vocabularies()
    pred, ctx = flatten(predicate), flatten(context)
    errors, trace = [], {}
    for key, value in ctx.items():
        if key not in vocab:
            errors.append('Ukjent kontekstfelt: '+key); continue
        for item in array(value):
            if typed(item) not in vocab[key] or (isinstance(item, str) and item in WILDCARDS):
                errors.append(f'Ugyldig konkret verdi: {key}={item!r}')
        if key == 'channel' and any(x in ['google-ads','sosiale-medier','film','skjema'] for x in array(value)):
            errors.append('Filterfamilie eller format er ikke konkret kanal')
        if key in ['channel','placement','format','aspect_ratio','country'] and len(array(value))!=1:
            errors.append('Én konkret kombinasjon krever én verdi i '+key)
    if ctx.get('channel')=='google-demand-gen' and 'placement' not in ctx:
        errors.append('Demand Gen krever konkret plassering')
    if 'placement' in ctx:
        placement=next((v for f in json.loads((ROOT/'schemas/kanal-format.json').read_text())['fields'] if f['path']=='placement' for v in f['values'] if v['value']==ctx['placement']),None)
        placement_channels = placement.get('channel', []) if placement else []
        if isinstance(placement_channels, str):
            placement_channels = [placement_channels]
        if not placement or ctx.get('channel') not in placement_channels:
            errors.append('Plassering og kanal samsvarer ikke')
    for key, value in pred.items():
        wanted = array(value)
        if key not in vocab or not wanted or any(typed(x) not in vocab[key] for x in wanted):
            errors.append('Ugyldig predikat: '+key); trace[key]='uavklart'; continue
        if any(isinstance(x,str) and x in WILDCARDS for x in wanted):
            if len(wanted) != 1: errors.append('Joker blandet med konkrete verdier: '+key)
            trace[key]='bestått'; continue
        if key not in ctx:
            trace[key]='uavklart'; continue
        if key=='channel' and 'google-ads' in wanted and ctx.get('channel')=='youtube' and 'media_class' not in ctx:
            trace[key]='uavklart';continue
        actual = expand(key,array(ctx[key]))
        if key=='channel':
            if ctx.get('channel')=='youtube' and ctx.get('media_class')=='betalt':actual.append('google-ads')
            if ctx.get('channel')=='google-demand-gen' and str(ctx.get('placement','')).startswith('dg-youtube-'):actual.extend(['youtube','sosiale-medier'])
        trace[key] = 'bestått' if {typed(x) for x in wanted} & {typed(x) for x in actual} else 'avvist'
    status = 'uavklart' if errors or 'uavklart' in trace.values() else 'avvist' if 'avvist' in trace.values() else 'bestått'
    return {'status':status, 'dimensions':trace, 'errors':errors}

def canonical_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')


def canonical_sha256(value):
    import hashlib
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def override_material(example, before=False):
    """Exact immutable content hashed by the override contract."""
    keys = ['brand_id', 'field_ref'] if before else ['brand_id', 'field_ref', 'campaign_id', 'del_id']
    return {**{key: example[key] for key in keys},
            'value': example['brand_value' if before else 'campaign_value'],
            'version': example['brand_version' if before else 'campaign_version']}


def override_payload(example):
    keys = ['brand_id','field_ref','campaign_id','del_id','brand_value','campaign_value','brand_version','campaign_version']
    return canonical_bytes({**{key:example[key] for key in keys},
                            'override':{k:v for k,v in example['override'].items() if k!='signature'}})


def effective_override(example, registry, now, verifier=None):
    """Fail closed; caller must supply a trusted signature AND authority verifier.

    verifier(payload_bytes, signature, person, brand_id, now) must authenticate
    the human's signature and current brand authority from outside the artifact.
    No embedded approval flag, role string or self-supplied key is trusted.
    """
    from datetime import datetime
    try:
        if not callable(verifier): return False
        field_ref=example['field_ref']
        rule=next((r for r in registry['override_policy']['rules'] if field_ref in r.get('fields',[])),None)
        if not rule or rule['policy']!='menneskegodkjent': return False
        field=next(f for f in registry['fields'] if f['id']==field_ref)
        for key in ['brand_value','campaign_value']:
            if typed(example[key]) not in {typed(v['value']) for v in field['values']}: return False
        for key in ['brand_version','campaign_version']:
            if type(example[key]) is not int or example[key]<1:return False
        audit=example['override'];person=audit['approved_by'];scope=audit['scope']
        for value in [example[k] for k in ['brand_id','campaign_id','del_id']]+[audit['reason'],audit['decision_id'],audit['signature']]+[person[k] for k in ['id','name']]:
            if not isinstance(value,str) or not value.strip():return False
        if person['actor_type']!='menneske' or person['role']!='merkeansvarlig':return False
        if audit['field_ref']!=field_ref or audit['approval']!='godkjent' or audit['brand_profile_mutated'] is not False:return False
        if typed(audit['old_value'])!=typed({'value':example['brand_value'],'version':example['brand_version']}):return False
        if typed(audit['new_value'])!=typed({'value':example['campaign_value'],'version':example['campaign_version']}):return False
        if scope!={k:example[k] for k in ['campaign_id','del_id']}:return False
        if type(audit['version']) is not int or audit['version']!=example['campaign_version']:return False
        times=[datetime.fromisoformat(x) for x in [audit['approved_at'],now,audit['expires_at']]]
        if any(t.utcoffset() is None for t in times) or not times[0]<=times[1]<times[2]:return False
        if audit['before_sha256']!=canonical_sha256(override_material(example,True)):return False
        if audit['after_sha256']!=canonical_sha256(override_material(example,False)):return False
        return verifier(override_payload(example),audit['signature'],person,example['brand_id'],now) is True
    except Exception:
        # Unavailable trust service, malformed payload or signature errors block use.
        return False

if __name__ == '__main__':
    import sys
    data=json.load(sys.stdin)
    print(json.dumps(evaluate(data['predicate'],data['context']),ensure_ascii=False,indent=2))
