#!/usr/bin/env python3
"""Reject deliberately broken definitions in isolated temporary JSON copies."""
import sys
sys.dont_write_bytecode = True

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import os
ROOT = Path(os.environ.get('ENGINE_SCHOOL_ROOT', Path(__file__).resolve().parents[2] / 'docs' / 'engine-school')).resolve()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--report', type=Path)
args = parser.parse_args()
cases=[
 ('duplikat-JSON-nokkel','schemas/kategori.json','duplicate',None),
 ('ukjent-read_by','schemas/kategori.json',('fields',0,'read_by'),['finnes-ikke']),
 ('ukjent-kanal','skills/Plattform.json',(0,'applies_when','channel'),'finnes-ikke'),
 ('asymmetrisk-konflikt','skills/Copy.json','conflict',None),
 ('tom-stegvalidering','flows/kampanjekort.json',('steps',0,'validation','checks'),[]),
 ('manglende-artefaktbinding','schemas/_index.json','binding',None),
 ('udeklarert-feltlesing','flows/kampanjekort.json','read',None),
 ('tom-kildelocator','schemas/kategori.json','locator',None),
]
results=[]
with tempfile.TemporaryDirectory(prefix='fume-round3-') as folder:
    sandbox=Path(folder)
    for dirname in ['skills','flows','schemas','sources','review']:
        shutil.copytree(ROOT/dirname,sandbox/dirname)
    for label,relative,path,value in cases:
        target=sandbox/relative;original=target.read_text();data=json.loads(original)
        if path=='duplicate':target.write_text('{"id":"duplicate",'+original.lstrip()[1:])
        else:
            if path=='binding':data['artifact_bindings'].pop(next(iter(data['artifact_bindings'])))
            elif path=='conflict':
                entry=next(x for x in data if x['conflicts_with']);entry['conflicts_with']=[]
            elif path=='read':data['field_reads'].pop(next(iter(data['field_reads'])))
            elif path=='locator':
                field=next(f for f in data['fields'] if f['source']!='Fume')
                source=field['source'];source=source[0] if isinstance(source,list) else source
                source['locator']=''
            else:
                node=data
                for key in path[:-1]:node=node[key]
                node[path[-1]]=value
            target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        completed=subprocess.run([sys.executable,str(Path(__file__).resolve().with_name('validate_schemas.py'))],capture_output=True,text=True,env={**os.environ,'ENGINE_SCHOOL_ROOT':str(sandbox),'PYTHONDONTWRITEBYTECODE':'1'})
        diagnostic=completed.stdout+completed.stderr
        # A crash is not a successful negative validation.
        rejected=completed.returncode==1 and 'Traceback' not in diagnostic
        results.append({'case':label,'rejected':rejected,'exit_code':completed.returncode})
        target.write_text(original)
report={'state':'PROPOSED','lang':'nb','result':'PASS' if all(r['rejected'] for r in results) else 'FAIL','cases':results,
        'scope':'Isolerte definisjonsfeil; signatur-/myndighetsmanipulasjon testes separat av validate_schemas.py.'}
if args.report:
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
sys.exit(report['result']!='PASS')
