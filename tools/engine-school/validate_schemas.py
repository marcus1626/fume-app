#!/usr/bin/env python3
"""Validate registries, bindings, provenance and normalized skill predicates.

This checks definitions and reference integrity; it does not pretend to execute
the proposed marketing flows or replace human/semantic/legal judgments.
"""
import argparse
from pathlib import Path
from collections import Counter
import sys
sys.dont_write_bytecode = True

import copy
import hashlib
import json
import re
import sys
from schema_filter import evaluate, effective_override, flatten, typed, canonical_sha256, override_material, override_payload

import os
ROOT = Path(os.environ.get('ENGINE_SCHOOL_ROOT', Path(__file__).resolve().parents[2] / 'docs' / 'engine-school')).resolve()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--report', type=Path, help='Write a JSON report only to this explicit path.')
args = parser.parse_args()
errors=[]
checks=Counter()

def check(condition, message, category):
    checks[category]+=1
    if not condition: errors.append(message)

def no_duplicates(pairs):
    out={}
    for k,v in pairs:
        if k in out: raise ValueError('Duplicate JSON key: '+k)
        out[k]=v
    return out

def load(path):
    return json.loads((ROOT/path).read_text(),object_pairs_hook=no_duplicates,
                      parse_constant=lambda x:(_ for _ in ()).throw(ValueError('Non-finite JSON: '+x)))

for folder in ['schemas','skills','flows','sources']:
    for p in (ROOT/folder).glob('*.json'):
        try:load(p.relative_to(ROOT));checks['strict_json']+=1
        except (ValueError,TypeError) as e:errors.append(str(p)+': '+str(e))
if errors:
    print('\n'.join(errors));sys.exit(1)

index=load('schemas/_index.json')
flow_index=load('flows/_index.json')
registries={p.stem:load(p.relative_to(ROOT)) for p in sorted((ROOT/'schemas').glob('*.json')) if p.stem!='_index'}
flows={p.stem:load(p.relative_to(ROOT)) for p in sorted((ROOT/'flows').glob('*.json')) if p.stem!='_index'}
skill_list=[s for p in sorted((ROOT/'skills').glob('*.json')) for s in load(p.relative_to(ROOT))]
skills={s['id']:s for s in skill_list}
ids=set(flows)|set(skills)
pensum=load('sources/pensum.json')
source_pairs={(s['source'],s['url']) for s in pensum}
check(len(skill_list)==len(skills),'Duplicate skill ID','ids')
all_fields=[f for r in registries.values() for f in r['fields']]
fields={f['id']:f for f in all_fields}
check(len(fields)==len(all_fields),'Duplicate field ID','ids')
check(set(x['id'] for x in index['schemas'])==set(registries),'Index must cover every registry exactly once','index')
required=set(index['registry_contract']['field_required'])

def source_ok(src):
    if src=='Fume':return True
    if isinstance(src,list):return bool(src) and all(source_ok(s) for s in src)
    return isinstance(src,dict) and (src.get('source'),src.get('url')) in source_pairs and bool(src.get('locator'))

def type_ok(value, typ):
    if typ=='integer|string':return type(value) in [int,str]
    return {'string':type(value) is str,'integer':type(value) is int,'number':type(value) in [int,float],
            'boolean':type(value) is bool,'array':True,'object':type(value) is dict}.get(typ,False)

for sid,r in registries.items():
    check(sid==r['id'] and r['state']=='PROPOSED' and r['lang']=='nb',sid+': ID/state/lang','registry')
    row=next(x for x in index['schemas'] if x['id']==sid)
    check(row['field_count']==len(r['fields']) and row['imports']==r['imports'] and row['read_by']==r['read_by'],sid+': stale index summary','index')
    check(all(i in registries for i in r['imports']),sid+': missing import','imports')
    check(set(r['read_by'])<=ids,sid+': nonexistent reader','read_by')
    paths={f['path']:f for f in r['fields']}
    check(len(paths)==len(r['fields']),sid+': duplicate payload path','registry')
    for f in r['fields']:
        label=f['id']
        check(required<=set(f),label+': missing mandatory field metadata','fields')
        check(f['id']==sid+'.'+f['path'],label+': field ID/path mismatch','fields')
        check(f['type'] in index['registry_contract']['type'],label+': invalid type','fields')
        check(f['filled_by'] in index['registry_contract']['filled_by'],label+': invalid filled_by','fields')
        check(f['scope'] in index['registry_contract']['scope'] and type(f['required']) is bool,label+': invalid scope/required','fields')
        check(all(isinstance(f[k],str) and bool(f[k]) for k in ['id','group','label_nb','definition']),label+': empty field prose','fields')
        check(source_ok(f['source']),label+': source must resolve to pensum with locator, or Fume','provenance')
        check(isinstance(f['read_by'],list) and bool(f['read_by']) and set(f['read_by'])<=ids,label+': missing/nonexistent reader','read_by')
        check(set(f['lever']['flows'])<=set(flows) and bool(f['lever']['choices']),label+': bad lever','fields')
        check(f['values'] or f.get('open_reason'),label+': open vocabulary lacks justification','enums')
        values=[typed(v['value']) for v in f['values']]
        check(len(values)==len(set(values)),label+': duplicate closed value','enums')
        for v in f['values']:
            check(isinstance(v.get('definition'),str) and bool(v['definition']),label+': missing value definition','enums')
            check(type_ok(v['value'],f['type']),label+': closed value has wrong type','enums')
        check(isinstance(f['applies_when'],dict) and set(f['applies_when'])=={'all'},label+': invalid field condition grammar','conditions')
        for term in f['applies_when']['all']:
            check(term['field'] in fields and term['op'] in ['eq','in','contains','present'],label+': condition references unknown field/operator','conditions')
            target=fields.get(term['field'],{})
            if target.get('values') and term['op']!='present':
                candidates=term['value'] if term['op']=='in' else [term['value']]
                check(all(typed(v) in {typed(x['value']) for x in target['values']} for v in candidates),label+': condition value outside target vocabulary','conditions')
        if 'ref' in f:
            parent,path=f['ref'].split('#');base=next((x for x in registries.get(parent,{}).get('fields',[]) if x['path']==path),None)
            check(base is not None,label+': unresolved field ref','imports')
            if base:check(f['values']==base['values'] and f['type']==base['type'],label+': ref values/type drift','imports')
        # A scalar cannot also be the parent of an object (e.g. involvement and involvement.evidence).
        for parent,base in paths.items():
            if f['path'].startswith(parent+'.'):
                check(base['type']=='object',label+': scalar/array parent must use object or [] element path: '+parent,'payload_paths')
            if f['path'].startswith(parent+'[].'):
                check(base['type']=='array',label+': [] parent is not array: '+parent,'payload_paths')

# Import graph must be acyclic.
def visit(sid,chain):
    check(sid not in chain,'Cyclic imports: '+' -> '.join(chain+[sid]),'imports')
    if sid in chain:return
    for child in registries[sid]['imports']:visit(child,chain+[sid])
for sid in registries:visit(sid,[])

bindings=index['artifact_bindings']; produced={}
def binding(path,schema,where):
    check(path in bindings,where+': artifact missing registry: '+path,'artifacts')
    if path in bindings:check(bindings[path]['schema']==schema,where+': wrong schema for '+path,'artifacts')
    check((ROOT/schema).is_file(),where+': missing schema file '+schema,'artifacts')
    sid=Path(schema).stem
    if sid in registries:check(registries[sid].get('artifact_path')==path,where+': schema path contract differs','artifacts')

for fid,f in flows.items():
    binding(f['input'],f['input_schema'],fid+' input')
    binding(f['output_artifact'],f['output_artifact_schema'],fid+' output')
    check(set(f['skills_used'])<=set(skills),fid+': nonexistent skill','ids')
    for ref in f['schema_reads']:check(Path(ref).stem in registries,fid+': unknown schema_reads','imports')
    previous=f['input']
    for s in f['steps']:
        binding(s['input'],s['input_schema'],fid+' step input')
        binding(s['output'],s['output_schema'],fid+' step output')
        check(s['input']==previous,fid+': disconnected step '+str(s['n']),'artifacts')
        check(s['output'] not in produced,'Multiple producers for '+s['output'],'artifacts')
        produced[s['output']]=(fid,s['n']);previous=s['output']
        r=registries[Path(s['output_schema']).stem]
        check(r['producer']=={'flow':fid,'step':s['n'],'who':s['who']},fid+': registry producer drift','artifacts')
        check(r['validation_profile']['step_validation']==f'flows/{fid}.json#/steps/{s["n"]-1}/validation',fid+': validation profile pointer','pointers')
        for field in r['fields']:
            for suffix,start in r['validation_profile']['required_from_steps'].items():
                if field['path']=='innhold.'+r['artifact_family']+'.'+suffix:
                    check(field['required']==(s['n']>=start),field['id']+': incorrect stage requiredness','artifacts')
    check(previous==f['output_artifact'],fid+': final output does not match last step','artifacts')
    if 'kampanjekort' in f.get('input_fields',{}):
        binding(f['input_fields']['kampanjekort']['path'],f['input_fields']['kampanjekort']['schema'],fid+' card reference')

entry=flow_index['entry_artifact']
binding(entry['path'],entry['schema'],'entry')
check(set(bindings)==set(produced)|{entry['path']},'Orphan or unregistered artifact','artifacts')
check(len([r for r in registries.values() if 'artifact_path' in r])==len(bindings),'Must have one registry per exact artifact','artifacts')
for row in flow_index['flows']:
    f=flows[row['id']]
    for k in ['input','input_schema','output_artifact','output_artifact_schema','schema_reads']:
        check(row[k]==f[k],row['id']+': flow index mismatch '+k,'index')
    for short,actual in zip(row['steps'],f['steps']):
        check(short['reads']==actual['input'] and short['writes']==actual['output'] and short['reads_schema']==actual['input_schema'] and short['writes_schema']==actual['output_schema'],row['id']+': step index mismatch','index')
for route in flow_index['optional_routes']:
    for k in ['input_binding','next_input_binding']:
        if route[k]:binding(route[k],route[k+'_schema'],'optional '+route['id'])
        else:check(route[k+'_schema'] is None,'Null route has non-null schema','artifacts')
binding(flow_index['final_artifact'],flow_index['final_artifact_schema'],'final')

# Every JSON pointer in the flow index and artifact profiles must resolve.
def walk(v):
    if isinstance(v,dict):
        for child in v.values():yield from walk(child)
    elif isinstance(v,list):
        for child in v:yield from walk(child)
    elif isinstance(v,str):yield v
for text in list(walk(flow_index))+[r.get('validation_profile',{}).get('step_validation','') for r in registries.values()]:
    if re.fullmatch(r'flows/[^#]+\.json#/[\w/~-]+',text):
        file,ptr=text.split('#');node=load(file)
        try:
            for part in ptr[1:].split('/'):
                part=part.replace('~1','/').replace('~0','~');node=node[int(part)] if isinstance(node,list) else node[part]
            checks['pointers']+=1
        except (KeyError,IndexError,ValueError):errors.append('Unresolved JSON pointer '+text)

# Exact skill predicates, frozen non-predicate content and conflict links.
sf=registries['skill-filter']; vocab={f['path']:{typed(v['value']) for v in f['values']} for f in sf['fields']}
mapping=load('review/schema-value-mapping.json'); mapped={x['id']:x for x in mapping['skills']}
check(set(mapped)==set(skills),'Mapping missing skill IDs','mapping')
predicate_values=0
for sid,s in skills.items():
    check(mapped[sid]['after']==s['applies_when'],sid+': mapping differs from actual predicate','mapping')
    digest=hashlib.sha256(json.dumps({k:v for k,v in s.items() if k!='applies_when'},ensure_ascii=False,sort_keys=True).encode()).hexdigest()
    check(digest==mapped[sid]['unchanged_content_sha256'],sid+': non-predicate skill content changed','mapping')
    funnel_fixes=load('review/funnel-fixes-round3.json')['changes']
    expected_funnel=funnel_fixes.get(sid,{}).get('after',mapped[sid]['before']['funnel'])
    check(s['applies_when']['funnel']==expected_funnel,sid+': untracked funnel change','mapping')
    if sid in funnel_fixes:check(funnel_fixes[sid]['before']==mapped[sid]['before']['funnel'],sid+': original funnel drift','mapping')
    for dim,value in flatten(s['applies_when']).items():
        check(dim in vocab,sid+': unregistered applies_when dimension '+dim,'skill_values')
        for item in value if isinstance(value,list) else [value]:
            check(typed(item) in vocab.get(dim,set()),sid+': unregistered applies_when value '+repr(item),'skill_values');predicate_values+=1
        field=next((x for x in sf['fields'] if x['path']==dim),None)
        check(field is not None and sid in field['read_by'],sid+': reverse filter read_by missing','read_by')
    for conflict in s['conflicts_with']:
        check(conflict in skills and sid in skills.get(conflict,{}).get('conflicts_with',[]),sid+': missing/asymmetric conflict','ids')
    old=mapped[sid]['before'];expected={k:v for k,v in old.items() if k not in ['channel','country']}
    expected.update(mapping['channel_mapping'][old['channel']]);country=mapping['country_mapping'][old['country']]
    overlap='legal_area' in expected and 'legal_area' in country
    check(not overlap,sid+': migration would merge two AND legal conditions into OR','mapping')
    expected.update(country)
    expected['funnel']=expected_funnel
    check(expected==s['applies_when'],sid+': mapping changed predicate meaning','mapping')

country_field=next(f for f in sf['fields'] if f['path']=='country')
codes={v['value'] for v in country_field['values']}-{'alle'}
snapshot=json.loads(Path(__file__).with_name('country_codes.json').read_text())
check(codes=={x['code'] for x in snapshot['countries']} and len(codes)==249,'ISO country list incomplete','research')
check(all(re.fullmatch('[A-Z]{2}',x) for x in codes) and not {'EU','UK','XK'}&codes,'Non-ISO value stored as country','research')
check({'NO','DE','GB','TW','AQ'}<=codes,'Required ISO examples absent','research')

# Behavior tests use real migrated skills and deliberately hostile contexts.
def outcome(pred,ctx,want,label):check(evaluate(pred,ctx)['status']==want,label,'filter_behavior')
base={'channel':'e-post','awareness_level':1,'market':'B2B','country':['NO'],'funnel':{'stage':['topp'],'mode':'merkebygging'},'trigger':[],'legal_area':[],'regulation':['generell'],'media_class':'egen'}
outcome(skills['leseren-ukjent-problem']['applies_when'],base,'bestått','Unaware skill should match awareness 1')
outcome(skills['leseren-klar-for-kjoep']['applies_when'],base,'avvist','Funnel must not override wrong awareness')
for old_channel in ['Meta-karusell','TikTok-video med tale','Google Ads med prisbudskap','YouTube Shorts med persondemonstrasjon','e-post og SMS','annonser omfattet av CAP Code']:
    sid=next(x['id'] for x in mapping['skills'] if x['before']['channel']==old_channel)
    pred=skills[sid]['applies_when']; flat=flatten(pred)
    ctx={}
    for dim,vs in flat.items():
        values=vs if isinstance(vs,list) else [vs]
        if len(values)==1 and values[0] in ['alle','begge']:continue
        if '.' in dim:
            a,b=dim.split('.');ctx.setdefault(a,{})[b]=copy.deepcopy(vs)
        else:ctx[dim]=copy.deepcopy(values[0] if dim in ['channel','format','aspect_ratio','country'] else vs)
    if ctx.get('channel')=='google-ads':ctx['channel']='google-ads-other'
    if ctx.get('channel')=='google-demand-gen':ctx['placement']='dg-discover'
    outcome(pred,ctx,'bestått','Positive mapped predicate '+sid)
    extras=[d for d in flat if d not in ['channel','awareness_level','market','country','funnel.stage','funnel.mode']]
    if extras:
        dim='trigger' if 'trigger' in extras else extras[0]
        bad=copy.deepcopy(ctx);bad.pop(dim,None)
        outcome(pred,bad,'uavklart','Missing condition cannot silently exclude '+sid)
        bad[dim]={'format':'tekst','aspect_ratio':'1:1','media_class':'egen'}.get(dim,[])
        outcome(pred,bad,'avvist','Explicit negative trigger should exclude '+sid)
outcome({'channel':'tiktok','format':'video'},dict(base,channel='tiktok',format='tt-non-spark'),'bestått','Concrete TikTok video family')
outcome({'channel':'youtube','format':'yt-shorts'},dict(base,channel='youtube',format='video'),'avvist','Generic video must not expand to Shorts')
outcome({'country':'NO'},dict(base,country=['EU']),'uavklart','EU is not country')
outcome({'country':'GB'},dict(base,country=['UK']),'uavklart','UK is not ISO alpha-2')
outcome({'funnel':{'mode':'hosting'}},dict(base,funnel={'stage':['bunn'],'mode':'merkebygging'}),'avvist','Wrong mode')
outcome({'channel':'meta','format':'karusell'},dict(base,channel='meta',format='video'),'avvist','Wrong format')
outcome({'legal_area':'EU'},dict(base,legal_area=[]),'avvist','NO must not infer EU legal scope')
outcome({'trigger':'tale'},dict(base,trigger=['oppfunnet']),'uavklart','Invented trigger must block')
cross_pred={'channel':'meta','format':'video'}
for channel,fmt in [('meta','bilde'),('tiktok','video')]:
    outcome(cross_pred,dict(base,channel=channel,format=fmt),'avvist','No false match from separate creatives')
outcome(cross_pred,dict(base,channel=['meta','tiktok'],format=['bilde','video']),'uavklart','Merged creative axes must block')
for ex in flows['kampanjekort']['skill_filter']['examples']:
    for sid in ex['include']:outcome(skills[sid]['applies_when'],ex['input'],'bestått','Existing card example include '+sid)
    for sid in ex['exclude']:outcome(skills[sid]['applies_when'],ex['input'],'avvist','Existing card example exclude '+sid)

# Exact declaration-to-reader backlinks; imports do not establish field reads.
for fid,flow in flows.items():
    for field_id,reason in flow['field_reads'].items():
        check(field_id in fields and bool(reason),fid+': unknown/empty field read '+field_id,'field_consumption')
        if field_id in fields:check(fid in fields[field_id]['read_by'],fid+': missing backlink '+field_id,'field_consumption')
    check(any(x.startswith('Feltlesing:') for x in flow['steps'][0]['validation']['checks']),fid+': no field consumption gate','field_consumption')
for field in all_fields:
    if field['id'].split('.')[0] in ['kampanje','leser','kategori','tilbud','kanal-format','merkevare-vs-kampanje','artefakt-felles']:
        for fid in set(field['read_by'])&set(flows):check(field['id'] in flows[fid]['field_reads'],field['id']+': undeclared read_by '+fid,'field_consumption')

from urllib.parse import urlparse, parse_qs, unquote
def urlkey(url):
    parsed = urlparse(url)
    celex = next((v[0].upper() for k, v in parse_qs(parsed.query).items() if k.lower() == 'uri' and v[0].upper().startswith('CELEX:')), None)
    if parsed.netloc == 'eur-lex.europa.eu' and celex:
        return celex
    return unquote(url).rstrip('/')

source_keys = {(x['source'], urlkey(x['url'])) for x in pensum}
source_urls = {urlkey(x['url']) for x in pensum}
# Existing citations use official subpages, consolidated versions and expanded
# source titles. Resolve these explicit aliases without changing their content.
source_aliases = {
    'https://digital.gov/guides/plain-language/writing': 'https://www.plainlanguage.gov/guidelines/',
    'https://digital.gov/guides/plain-language/design': 'https://www.plainlanguage.gov/guidelines/',
    'https://digital.gov/guides/plain-language/test': 'https://www.plainlanguage.gov/guidelines/',
    'https://support.google.com/google-ads/answer/14783551?hl=en': 'https://business.google.com/us/think/search-and-video/youtube-marketing-success-playbook/',
    'https://www.dandad.org/insights/awards/thisables-case-study-insights': 'https://www.dandad.org/disciplines/impact',
    'https://davetrott.co.uk/2026/11/sabotaging-ourselves-2/': 'https://davetrott.co.uk/',
    'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02005L0029-20260927': 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32005L0029',
    'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02006R1924-20141213': 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006R1924',
    'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02006R1924-20141213': 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006R1924',
}

for value in source_aliases.values():check(urlkey(value) in source_urls,'Unresolved source alias '+value,'provenance')
for obj in skill_list+list(flows.values()):
    check(bool(obj['sources']),obj['id']+': missing sources','provenance')
    for source in obj['sources']:
        check(all(isinstance(source.get(k),str) and source[k].strip() for k in ['source','url','locator']),obj['id']+': malformed citation','provenance')
        check(source['url'] in ['BRIEF.md','../BRIEF.md'] or urlkey(source['url']) in source_urls or source['url'] in source_aliases,obj['id']+': unresolved citation '+source['url'],'provenance')
        if 'quote' in source:check(len(source['quote'].split())<25,obj['id']+': excessive quote','provenance')
        # TXT/PDF archives are optional distribution assets. Citations still require
        # registered URLs and nonempty locators; reject escaping archive paths.
        for path in re.findall(r'sources/[A-Za-z0-9_./%À-ž-]+\.(?:txt|pdf)',source['locator']):
            check((ROOT/path).resolve().is_relative_to(ROOT),obj['id']+': unsafe local source path '+path,'provenance')
    cp=obj['checkpoints']
    check(isinstance(cp,list) and bool(cp) and len(set(cp))==len(cp) and all(type(x) is int and 1<=x<=10 for x in cp),obj['id']+': invalid checkpoints','skill_contract')
    check(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',obj['id']) is not None,obj['id']+': ID syntax','ids')
for row in pensum:
    check(set(row)=={'subject','source','url','what_engine_takes','free_access','tier','checkpoints','url_status'},row['source']+': source shape','provenance')
    check(row['url_status'].startswith(('ok','failed:')),row['source']+': source status','provenance')
for path in list((ROOT/'skills').glob('*.json'))+list((ROOT/'flows').glob('*.json')):
    for sid in re.findall(r'\b(?:trakt|strategi|leseren|copy|ide|plattform|lov)-[a-z0-9]+(?:-[a-z0-9]+)*',path.read_text()):
        check(sid in ids,str(path)+': unknown prose ID '+sid,'ids')
for fid,flow in flows.items():
    available={Path(path).stem for path in flow['schema_reads']}
    check({field_id.split('.')[0] for field_id in flow['field_reads']}<=available,fid+': field read outside imported domains','field_consumption')
    check(flow['fail_route']['max_failed_tries']==2 and 'menneske' in flow['fail_route']['after_limit'],fid+': retry gate','step_validation')
    check(all(k in flow['validation'] for k in ['artifact_contract','step_gate','model_separation','entry_gate','exit_gate']) and 'attest' in flow['validation']['model_separation'].lower(),fid+': model/step gates','step_validation')
    if fid!='kampanjekort':check(flow['input_fields']['kampanjekort']['path']==flows['kampanjekort']['output_artifact'],fid+': missing card reference','step_validation')
    for step in flow['steps']:
        check({'who','checks','pass_condition'}<=set(step['validation']) and bool(step['validation']['pass_condition']),fid+': incomplete step validation','step_validation')
        if step['who']=='kritiker':check('modell' in step['what'] and 'attest' in step['what'],fid+': unattested critic','step_validation')
rows={row['id']:row for row in flow_index['flows']}
def dependency_visit(fid,chain):
    check(fid not in chain,fid+': dependency cycle','flow_graph')
    if fid in chain:return
    for dep in rows[fid]['depends_on']:
        check(dep in rows,fid+': missing dependency '+dep,'flow_graph')
        if dep in rows:dependency_visit(dep,chain+[fid])
for fid in rows:dependency_visit(fid,[])
check(flow_index['flows'][0]['id']=='kampanjekort' and rows['kampanjekort']['depends_on']==[],'Card must be first','flow_graph')
check([row['order'] for row in flow_index['flows']]==list(range(1,len(flows)+1)),'Flow order','flow_graph')
for previous,next_row in zip(flow_index['flows'][:9],flow_index['flows'][1:10]):check(previous['output_artifact']==next_row['input'],'Disconnected core chain','flow_graph')

# Step validation bodies and retry/critic gates, not just their pointers.
for fid,flow in flows.items():
    check([s['n'] for s in flow['steps']]==list(range(1,len(flow['steps'])+1)),fid+': non-contiguous steps','step_validation')
    for step in flow['steps']:
        v=step['validation']
        check(isinstance(v,dict) and bool(v.get('checks')) and all(isinstance(x,str) and x.strip() for x in v['checks']),fid+': empty step validation','step_validation')
        check(bool(step.get('input')) and bool(step.get('output')),fid+': missing step artifact','step_validation')
    check(flow['state']=='PROPOSED',fid+': status drift','step_validation')
for sid,skill in skills.items():
    check(skill['subject'] in ['Copy','Idé','Leseren','Lov','Plattform','Strategi','Trakt'] and bool(skill['rule']) and set(skill['check'].split('+'))<={'kode','kritiker','menneske'},sid+': subject/check/rule','skill_contract')
    check(skill['state']=='PROPOSED' and skill['lang']=='nb',sid+': status/language','skill_contract')
    check(type(skill['house_rule']) is bool and bool(skill['source_says']),sid+': house_rule/source_says','skill_contract')
    check(sid not in skill['conflicts_with'] and len(set(skill['conflicts_with']))==len(skill['conflicts_with']),sid+': self/duplicate conflict','ids')
check(len({row['url'] for row in pensum})==len(pensum),'Duplicate source URL','provenance')

# Regressions for the three reported false negatives and channel precedence.
for sid,ctx in [
 ('plattform-samling-koblet-til-katalog',dict(base,channel='meta',format='samling')),
 ('ide-figur-med-handling',dict(base,channel='youtube',format='video',funnel={'stage':['bunn','salgsrunde'],'mode':'hosting'})),
 ('leseren-allerede-kunde',dict(base,channel='e-post'))]:
    outcome(skills[sid]['applies_when'],ctx,'bestått','Round 3 broad candidate '+sid)
for pred,ctx,want,label in [
 ({'channel':'youtube'},{'channel':'google-demand-gen','placement':'dg-youtube-shorts'},'bestått','Demand Gen YouTube surface'),
 ({'channel':'youtube'},{'channel':'google-demand-gen','placement':'dg-gmail'},'avvist','Gmail is not YouTube'),
 ({'channel':'google-ads'},{'channel':'youtube','media_class':'betalt'},'bestått','Paid YouTube is Google Ads'),
 ({'channel':'google-ads'},{'channel':'youtube','media_class':'egen'},'avvist','Organic YouTube is not Google Ads'),
 ({'channel':'google-ads'},{'channel':'youtube'},'uavklart','Unknown YouTube media class'),
 ({'channel':'google-ads'},{'channel':'google-ads'},'uavklart','Abstract family cannot be concrete'),
 ({'channel':'youtube'},{'channel':'google-demand-gen'},'uavklart','Demand Gen needs placement'),
 ({'channel':'meta'},{'channel':'meta','placement':'dg-gmail'},'uavklart','Wrong placement channel'),
 ({'trigger':'skjema'},{'channel':'nettside','trigger':['skjema']},'bestått','Form component across channels'),
]:outcome(pred,ctx,want,label)

b=registries['merkevare-vs-kampanje'];ex=copy.deepcopy(b['worked_example']);now='2026-11-13T16:00:00+01:00'
# A local test authenticator is deliberately outside the untrusted registry.
# Production must inject its human-signature and current-authority service.
import hmac
fixture_key=b'isolated-validator-fixture-key-not-a-production-credential'
def trusted_verifier(payload,signature,person,brand_id,at):
    return (person==b['worked_example']['override']['approved_by'] and brand_id=='eksempel-trening'
            and hmac.compare_digest(hmac.new(fixture_key,payload,'sha256').hexdigest(),signature))
def sign(example):example['override']['signature']=hmac.new(fixture_key,override_payload(example),'sha256').hexdigest()
check(not effective_override(ex,b,now),'Unsigned delivered example accepted','override_behavior')
check(not effective_override(ex,b,now,trusted_verifier),'Placeholder signature accepted','override_behavior')
ex['override']['approval']='godkjent'
sign(ex)
check(effective_override(ex,b,now,trusted_verifier),'Trusted signed fixture rejected','override_behavior')
mutations=[
 ('campaign_value','feminint'),('brand_value','feminint'),('brand_id','another-brand'),
 ('brand_version',2),('campaign_version',2),('campaign_id','another-campaign'),('del_id','another-part'),
 ('field_ref','merkevare-vs-kampanje.ethics'),
 ('override.reason',''),('override.reason','Endret begrunnelse'),('override.approval','foreslatt'),
 ('override.brand_profile_mutated',True),('override.expires_at','2026-11-13T15:30:00+01:00'),
 ('override.approved_at','2026-11-13T17:00:00+01:00'),('override.approved_at','2026-11-13T15:00:00'),
 ('override.approved_by.actor_type','modell'),('override.approved_by.role','intern'),
 ('override.approved_by.id','unknown'),('override.before_sha256','x'*64),('override.after_sha256','y'*64),
 ('override.new_value.value','feminint'),('override.old_value.version',2),('override.signature','0'*64),
 ('override.scope.del_id','elsewhere'),('override.decision_id','another-decision')]
for path,value in mutations:
    bad=copy.deepcopy(ex);node=bad
    parts=path.split('.')
    for part in parts[:-1]:node=node[part]
    node[parts[-1]]=value
    check(not effective_override(bad,b,now,trusted_verifier),'Manipulated override accepted '+path,'override_behavior')
# Recomputing public hashes and wrapper values cannot replace a human signature.
bad=copy.deepcopy(ex);bad['campaign_value']='feminint';bad['override']['new_value']['value']='feminint'
bad['override']['after_sha256']=canonical_sha256(override_material(bad,False))
check(not effective_override(bad,b,now,trusted_verifier),'Rehashed unsigned change accepted','override_behavior')
bad=copy.deepcopy(ex);bad['brand_id']='another-brand';bad['override']['before_sha256']=canonical_sha256(override_material(bad,True));bad['override']['after_sha256']=canonical_sha256(override_material(bad,False));sign(bad)
check(not effective_override(bad,b,now,trusted_verifier),'Signature without authority accepted','override_behavior')
check(not effective_override(ex,b,now,lambda *args:False),'Verifier rejection ignored','override_behavior')
check(not effective_override(ex,b,now,lambda *args:(_ for _ in ()).throw(RuntimeError('offline'))),'Unavailable verifier ignored','override_behavior')

report={'result':'PASS' if not errors else 'FAIL','schema_count':len(registries),'field_count':len(all_fields),
        'field_counts':{sid:len(r['fields']) for sid,r in registries.items()},'flow_count':len(flows),
        'artifact_count':len(bindings),'step_output_count':len(produced),'skill_count':len(skills),
        'skill_predicate_value_count':predicate_values,'source_count':len(pensum),'checks':dict(checks),'errors':errors,
        'limits':'Kontroll av registre, kontrakter, referanser, filteratferd og fiktivt overstyringseksempel. Ingen faktiske kunde-/annonseartefakter eller kjørende Engine er testet.'}
if args.report:
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['field_counts','limits']},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
