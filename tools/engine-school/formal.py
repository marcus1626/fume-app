"""Shared, deterministic vocabulary mining and Draft 2020-12 generation.

The Fume field registries remain the authoring format. No network access here.
"""
from pathlib import Path
from collections import defaultdict
import copy
import hashlib
import json
import re
import unicodedata

import os
ROOT = Path(os.environ.get('ENGINE_SCHOOL_ROOT', Path(__file__).resolve().parents[2] / 'docs' / 'engine-school')).resolve()
DRAFT = 'https://json-schema.org/draft/2020-12/schema'
BASE = 'https://fume.school/schemas/json/'  # Identifier namespace, never fetched.
DATE = '2026-11-13'
TEXT = {'type': 'string', 'minLength': 1}
ID = {'type': 'string', 'pattern': '^[a-z0-9]+(?:-[a-z0-9]+)*$'}


def typed(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def load(path):
    def pairs(items):
        out = {}
        for k, v in items:
            if k in out:
                raise ValueError(f'Duplicate JSON key: {k}')
            out[k] = v
        return out
    return json.loads(Path(path).read_text(), object_pairs_hook=pairs,
                      parse_constant=lambda x: (_ for _ in ()).throw(ValueError(f'Non-finite JSON: {x}')))


def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n'


def format_checker():
    """Calendar-aware RFC3339 without jsonschema's optional network extras."""
    import datetime
    from jsonschema import FormatChecker
    checker = FormatChecker()

    @checker.checks('date-time', raises=(ValueError, TypeError))
    def datetime_ok(value):
        if not isinstance(value, str):
            return True
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})', value):
            return False
        datetime.datetime.fromisoformat(value.upper().replace('Z', '+00:00'))
        return True
    return checker


def read_data(root=ROOT):
    def folder(name):
        return {p.stem: load(p) for p in sorted((root / name).glob('*.json')) if p.stem != '_index'}
    return {'registries': folder('schemas'), 'skill_files': folder('skills'),
            'flows': folder('flows'), 'pensum': load(root / 'sources/pensum.json'),
            'registry_index': load(root / 'schemas/_index.json'),
            'flow_index': load(root / 'flows/_index.json')}


def walk(value, path=''):
    yield path, value
    if isinstance(value, dict):
        for k, v in value.items():
            yield from walk(v, path + '/' + k.replace('~', '~0').replace('/', '~1'))
    elif isinstance(value, list):
        for n, v in enumerate(value):
            yield from walk(v, path + '/' + str(n))


def slug(value):
    value = str(value).lower().replace('ø', 'o').replace('æ', 'ae').replace('å', 'a')
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub('[^a-z0-9]+', '-', value).strip('-')


# Concrete channels and predicate channel selectors have separate contracts.
FIELD_LISTS = {
    'kampanje.goal': 'campaign-goal', 'kampanje.funnel.stage': 'funnel-stage',
    'kampanje.funnel.mode': 'funnel-mode', 'kampanje.market': 'market',
    'kampanje.channels': 'channel', 'kampanje.countries': 'country',
    'kampanje.customer_status': 'customer-status', 'kampanje.sales_round.active': 'boolean',
    'kampanje.kpi.metric': 'metric', 'kampanje.budget.class': 'budget-class',
    'kanal-format.channel': 'channel', 'kanal-format.placement': 'placement',
    'kanal-format.format': 'format', 'kanal-format.asset_features': 'asset-feature',
    'kanal-format.specs.aspect_ratio': 'aspect-ratio', 'kanal-format.specs.mime': 'mime',
    'kanal-format.specs.rule_kind': 'rule-kind', 'kanal-format.availability': 'availability',
    'kanal-format.binding.creative_medium': 'creative-medium',
    'kanal-format.binding.ad_product': 'ad-product',
    'kanal-format.binding.delivery_behavior': 'delivery-behavior',
    'kanal-format.component': 'component', 'kategori.type': 'category-type',
    'kategori.purchase_frequency.class': 'purchase-frequency',
    'kategori.involvement.level': 'involvement', 'kategori.regulation.areas': 'regulation',
    'kategori.seasonality.pattern': 'seasonality', 'leser.schwartz.level': 'awareness-level',
    'leser.ceps[].cue_type': 'cep-cue', 'leser.jtbd.dimension': 'jtbd-dimension',
    'leser.roles.b2b': 'buying-role-b2b', 'leser.roles.b2c': 'buying-role-b2c',
    'leser.roles.expertise': 'buying-expertise', 'leser.roles.functions': 'buying-function',
    'leser.buying_situation': 'buying-situation', 'tilbud.type': 'offer-type',
    'merkevare-vs-kampanje.ethics': 'ethics',
    'merkevare-vs-kampanje.taste.gender_expression': 'gender-expression',
    'merkevare-vs-kampanje.taste.standing': 'taste-standing',
    'merkevare-vs-kampanje.taste.kind': 'taste-kind',
    'merkevare-vs-kampanje.override.approval': 'override-approval',
    'merkevare-vs-kampanje.override.old_value.value': 'gender-expression',
    'merkevare-vs-kampanje.override.new_value.value': 'gender-expression',
    'merkevare-vs-kampanje.override.brand_profile_mutated': 'boolean',
    'merkevare-vs-kampanje.taste.available': 'boolean',
    'merkevare-vs-kampanje.override.approved_by.actor_type': 'actor-type',
    'artefakt-felles.validering.status': 'validation-status',
    'artefakt-felles.validering.checks[].status': 'validation-status',
    'artefakt-felles.state': 'state', 'artefakt-felles.lang': 'language',
    'artefakt-felles.grunnlag.manifest[].opphav': 'origin',
    'artefakt-felles.modellspor[].role': 'model-role',
    'artefakt-felles.godkjenning[].decision': 'approval-decision',
}
FILTER_LISTS = {k: k.replace('_', '-').replace('.', '-') for k in
                ['channel', 'awareness_level', 'market', 'country', 'format', 'placement',
                 'funnel.stage', 'funnel.mode', 'aspect_ratio', 'regulation', 'legal_area',
                 'media_class', 'trigger']}
FILTER_LISTS['channel'] = 'channel-filter'
LABELS = {
    'creative-medium': 'Kreativt medium', 'ad-product': 'Annonseprodukt', 'delivery-behavior': 'Leveringsatferd',
    'channel-filter': 'Kanalvelger i ferdighetsfilter', 'channel': 'Kanal', 'placement': 'Plassering', 'format': 'Format', 'country': 'Landkode',
    'country-group': 'Landgruppe', 'awareness-level': 'Kunnskapsnivå', 'market': 'Marked',
    'buying-role-b2b': 'Kjøpsrolle i virksomhet', 'buying-role-b2c': 'Kjøpsrolle privat',
    'funnel-stage': 'Trakttrinn', 'funnel-mode': 'Traktmodus', 'check-type': 'Kontrolltype',
    'tier': 'Kildeklasse', 'subject': 'Fag', 'checkpoint': 'Sjekkpunkt',
    'claim-type': 'Påstandstype', 'state': 'Status for definisjon', 'who': 'Utførende rolle',
    'filled-by': 'Utfylt av', 'scope': 'Omfang', 'line-style': 'Linjestil',
    'validation-status': 'Valideringsstatus', 'field-type': 'Felttype',
    'condition-operator': 'Vilkårsoperator', 'language': 'Språk', 'registry-kind': 'Registertype',
    'actor-type': 'Aktørtype', 'approval-decision': 'Godkjenningsvedtak', 'aspect-ratio': 'Sideforhold',
    'asset-feature': 'Tilleggsressurs', 'availability': 'Tilgjengelighet', 'boolean': 'Ja eller nei',
    'budget-class': 'Budsjettklasse', 'buying-expertise': 'Kjøpsekspertise',
    'buying-function': 'Kjøpsfunksjon', 'buying-situation': 'Kjøpssituasjon',
    'campaign-goal': 'Kampanjemål', 'category-type': 'Kategoritype', 'cep-cue': 'Signal i kjøpssituasjon',
    'component': 'Komponent', 'customer-status': 'Kundestatus', 'east-principle': 'EAST-prinsipp',
    'ethics': 'Etikkregel', 'gender-expression': 'Kjønnsuttrykk', 'hypothesis-status': 'Hypotesestatus',
    'involvement': 'Involvering', 'jtbd-dimension': 'Jobbdimensjon', 'legal-area': 'Regelområde',
    'media-class': 'Medieklasse', 'media-plan-mode': 'Medieplanmodus', 'metric': 'Måltall',
    'mime': 'MIME-type', 'model-role': 'Modellrolle', 'offer-type': 'Tilbudstype', 'origin': 'Opphav',
    'override-approval': 'Vedtak om kampanjeavvik', 'placement-kind': 'Type plasseringsflate',
    'placement-selection': 'Vilkår for plasseringsvalg', 'purchase-frequency': 'Kjøpshyppighet',
    'regulation': 'Reguleringsområde', 'request-size': 'Forespørselens størrelse',
    'rule-kind': 'Kravtype', 'seasonality': 'Sesongmønster', 'taste-kind': 'Bildetype for smak',
    'taste-standing': 'Merkevanemønster', 'trigger': 'Regelutløser',
}
VALUE_LABELS = {
    'rett-pa-sak': 'Rett på sak', 'gjenkjennelig-hverdag': 'Gjenkjennelig hverdag',
    'sporsmal': 'Spørsmål', 'kontrast': 'Kontrast', 'konkret-bevis': 'Konkret bevis',
    'torr-humor': 'Tørr humor', 'hosting': 'Høsting', 'noytralt': 'Nøytralt',
    'hoy': 'Høy', 'ukjent': 'Ukjent', 'B2B': 'Virksomhetsmarked', 'B2C': 'Privatmarked',
    'nb': 'Norsk bokmål', 'PROPOSED': 'Foreslått', 'EU': 'EU', 'EEA': 'EØS',
    'CAP': 'Britisk CAP-regelverk', 'meta': 'Meta', 'youtube': 'YouTube',
    'tiktok': 'TikTok', 'linkedin': 'LinkedIn', 'e-post': 'E-post', 'sms': 'SMS',
    'product_alone': 'Produkt uten personer', 'people': 'Personer', 'whole': 'Helhet',
    'always': 'Alltid', 'usually': 'Vanligvis', 'by_campaign': 'Etter kampanje',
    'free': 'Fritt', 'unknown': 'Ukjent', 'field_registry': 'Feltregister',
}
STYLE_ALIASES = {v: k for k, v in VALUE_LABELS.items() if k in
                 ['rett-pa-sak', 'gjenkjennelig-hverdag', 'sporsmal', 'kontrast', 'konkret-bevis', 'torr-humor']}


def field_list(field):
    if field.get('ref'):
        return FIELD_LISTS.get(field['ref'].replace('#', '.'))
    fid = field['id']
    if fid in FIELD_LISTS:
        return FIELD_LISTS[fid]
    if fid.startswith('skill-filter.'):
        return FILTER_LISTS[field['path']]
    for ending, name in [('foresporsel.size', 'request-size'), ('medieplan.modus', 'media-plan-mode'),
                         ('linjer[].stil', 'line-style'), ('tiltak[].grep', 'east-principle'),
                         ('tolkning.hypotesestatus', 'hypothesis-status')]:
        if fid.endswith(ending):
            return name
    raise ValueError('Unclassified closed variable: ' + fid)


def source(name, url, locator, verified=True, note='Innhold lest; ingen garanti for kontotilgang.'):
    return {'source': name, 'url': url, 'locator': locator, 'read_on': DATE,
            'verified': verified, 'verification_note': note}


META = source('Meta Business Help Center', 'https://www.facebook.com/business/help/279271845888065',
              'Måltabeller; Text, Image, Video, Carousel, Collection; Flexible', note='web.open ga innlogging; Firecrawl maxAge=0 HTTP 200, faktiske tabeller lest.')
META_PLACEMENTS = source('Meta Business Help Center', 'https://www.facebook.com/business/help/407108559393196',
    'Feeds; Stories, Status and Reels; In-stream; Search; Apps and sites',
    note='web.open omdirigerte til blokkert innlogging. Firecrawl fersk henting HTTP 200; plasseringer og Friends-underflate lest 2026-11-13. Konto, mål og marked må kontrolleres.')
GOOGLE = source('Google Ads Help', 'https://support.google.com/google-ads/answer/1722124', 'Ad formats available in a Google Ads account')
YT = source('Google Ads Help', 'https://support.google.com/google-ads/answer/2375464?hl=en', 'Format comparison; Where it serves')
DG = source('Google Ads Help', 'https://support.google.com/google-ads/answer/17141078?hl=en', 'Ad format eligibility', False,
            'web.open utilgjengelig i denne runden. Tidligere kontroll finnes i review/schema-source-checks.json; ikke nyverifisert.')
TT = source('TikTok Business Help Centre', 'https://ads.tiktok.com/help/article/tiktok-placement?lang=en', 'For You Feed; Search Feed; Search Results Page')
TTS = source('TikTok Business Help Centre', 'https://ads.tiktok.com/resources/help/article/tiktok-auction-in-feed-ads?lang=en', 'Spark Ads (Pull); Non-Spark Ads')
LI = source('LinkedIn Ads Guide', 'https://business.linkedin.com/advertise/ads/ads-guide', 'Sponsored Content; Sponsored Messaging; Dynamic Ads; Text Ads')
LIHELP = source('LinkedIn Help', 'https://www.linkedin.com/help/lms/answer/a422880', 'Ad Objective / Goal / Ad Formats')
PLATFORM_SOURCES = [META, META_PLACEMENTS, GOOGLE, YT, DG, TT, TTS, LI, LIHELP]


def platform_evidence(list_id, value):
    if value in ['alle', 'annen', 'annet-sosialt', 'egen-flate', 'e-post', 'sms', 'nettside', 'brev', 'telefon', 'produktsok', 'markedsplass', 'sosiale-medier', 'google-ads']:
        return source('Fume', 'BRIEF.md', 'Step 2 / Step 3; interne distribusjons- og filterklasser', False,
                      'Fume-arbeidsverdi; ikke et offisielt plattformvalg.')
    if list_id == 'placement' and value.startswith(('fb-', 'ig-', 'threads-', 'messenger-', 'whatsapp-', 'audience-network-')):
        return META_PLACEMENTS
    if value == 'meta' or value.startswith(('fb-', 'ig-', 'threads-', 'messenger-', 'whatsapp-', 'audience-network-')) or value in ['karusell', 'samling', 'fleksibel']:
        return META
    if value.startswith('dg-') or value == 'google-demand-gen':
        return DG
    if value.startswith('tt-') or value == 'tiktok':
        return TTS if list_id == 'format' else TT
    if value.startswith('li-') or value == 'linkedin':
        if value == 'li-audience-network':
            return source('LinkedIn', 'https://business.linkedin.com/advertise/ads/best-practices/create-your-first-campaign',
                          'Choose where your ads appear', False, 'Tidligere kontroll; ikke åpnet på nytt i denne runden.')
        return LI
    if value.startswith('yt-') or value in ['youtube', 'google-video-partners']:
        return YT
    return GOOGLE


def mine(data):
    """Return lists plus every structured occurrence (JSON pointer) and field binding."""
    values = defaultdict(dict)
    all_fields = {f['id']: f for r in data['registries'].values() for f in r['fields']}
    occurrences = []
    field_bindings = {}
    provenance = defaultdict(list)

    def add(name, value, definition, file, pointer, src=None):
        key = typed(value)
        if key not in values[name]:
            label = VALUE_LABELS.get(value) if isinstance(value, str) else None
            if name == 'country' and value != 'alle':
                label = 'Landkode ' + value  # No fabricated Norwegian country translations.
            if type(value) is bool:
                label = 'Ja' if value else 'Nei'
            if name == 'checkpoint':
                label = definition
            if name == 'awareness-level' and type(value) is int:
                label = f'Nivå {value}'
            values[name][key] = {'id': value, 'label_nb': label or str(value).replace('-', ' ').capitalize(),
                                 'definition': definition}
        if name in ['channel', 'channel-filter', 'placement', 'format']:
            values[name][key]['source'] = [platform_evidence(name, str(value))]
        occurrences.append({'file': file, 'pointer': pointer, 'list': name, 'value': value})
        if src and src not in provenance[name]:
            provenance[name].append(src)

    for sid, reg in data['registries'].items():
        for n, f in enumerate(reg['fields']):
            if not f['values']:
                continue
            name = field_list(f)
            field_bindings[f['id']] = name
            for m, row in enumerate(f['values']):
                add(name, row['value'], row['definition'], f'schemas/{sid}.json',
                    f'/fields/{n}/values/{m}/value', f['source'])

    meta_names = {'check': 'check-type', 'who': 'who', 'filled_by': 'filled-by',
                  'scope': 'scope', 'subject': 'subject', 'tier': 'tier', 'state': 'state',
                  'lang': 'language', 'kind': 'registry-kind',
                  'selection_kind': 'placement-kind', 'selectable': 'placement-selection'}
    meta_defs = {'subject': 'Fag i Fume-skolen: {}.', 'tier': 'Kildeklasse: {}.',
                 'check': 'Kombinasjon av kontrollroller: {}.', 'who': 'Utførende rolle eller valideringskombinasjon: {}.',
                 'filled_by': 'Ansvarlig for utfylling: {}.', 'scope': 'Feltets levetid og omfang: {}.',
                 'state': 'Foreslått definisjon; ikke en implementeringsbeslutning.',
                 'lang': 'Språkkode for norsk bokmål.', 'kind': 'Fume-feltregister.',
                 'selection_kind': 'Plassering eller dokumentert underflate: {}.',
                 'selectable': 'Vilkår for selvstendig valg i annonseverktøyet: {}.'}
    files = {**{f'skills/{k}.json': v for k, v in data['skill_files'].items()},
             **{f'flows/{k}.json': v for k, v in data['flows'].items()},
             **{f'schemas/{k}.json': v for k, v in data['registries'].items()},
             'sources/pensum.json': data['pensum']}
    for file, doc in files.items():
        for pointer, obj in walk(doc):
            if not isinstance(obj, dict):
                continue
            for key, name in meta_names.items():
                val = obj.get(key)
                # Metadata only, not arbitrary examples, rule prose or payload kind.
                if isinstance(val, str) and key in obj:
                    if key == 'kind' and val != 'field_registry':
                        continue
                    add(name, val, meta_defs[key].format(val), file, pointer + '/' + key)
            if 'field' in obj and 'op' in obj and obj['field'] in all_fields and obj['op'] != 'present':
                target = all_fields[obj['field']]
                if target['values']:
                    for i, val in enumerate(obj['value'] if obj['op'] == 'in' else [obj['value']]):
                        add(field_list(target), val, 'Operand i registrert feltvilkår.', file,
                            pointer + '/value' + ('/' + str(i) if obj['op'] == 'in' else ''))
            if 'parent' in obj and 'selection_kind' in obj:
                add('placement', obj['parent'], 'Overordnet leveringsflate.', file, pointer + '/parent')
            if all(k in obj for k in ['format', 'ad_product', 'creative_medium', 'delivery_behavior']):
                for key, name in [('format','format'), ('ad_product','ad-product'), ('creative_medium','creative-medium'), ('delivery_behavior','delivery-behavior')]:
                    for i, val in enumerate(obj[key] if isinstance(obj[key], list) else [obj[key]]):
                        add(name, val, 'Attributt i formatets prioriteringskontrakt.', file,
                            pointer + '/' + key + ('/' + str(i) if isinstance(obj[key], list) else ''))
            if 'constraint' in obj and 'availability' in obj:
                for key in ['channel', 'placement', 'format', 'rule_kind', 'availability']:
                    if key in obj:
                        add({'rule_kind':'rule-kind'}.get(key, key), obj[key], 'Strukturert eksempelverdi.', file, pointer + '/' + key)
            if 'value' in obj and 'channel' in obj:
                for n, val in enumerate(obj['channel'] if isinstance(obj['channel'], list) else [obj['channel']]):
                    add('channel', val, f'Distribusjonsrute for plasseringen: {val}.', file,
                        pointer + '/channel' + ('/' + str(n) if isinstance(obj['channel'], list) else ''))
            if isinstance(obj.get('checkpoints'), list):
                for n, cp in enumerate(obj['checkpoints']):
                    if type(cp) is int:
                        label = next((x['name'] for x in data['flow_index']['checkpoints'] if x['n'] == cp), str(cp))
                        add('checkpoint', cp, label, file, pointer + '/checkpoints/' + str(n))
        if file.startswith('skills/'):
            for n, skill in enumerate(doc):
                for key, val in skill['applies_when'].items():
                    pairs = [('funnel.' + k, v, '/funnel/' + k) for k, v in val.items()] if key == 'funnel' else [(key, val, '/' + key)]
                    for dim, item, suffix in pairs:
                        for m, value in enumerate(item if isinstance(item, list) else [item]):
                            add(FILTER_LISTS[dim], value, f'Filterverdi for {dim}: {value}.', file,
                                f'/{n}/applies_when' + suffix + ('/' + str(m) if isinstance(item, list) else ''))
    for key, vals in data['registry_index']['registry_contract'].items():
        if key in ['type', 'filled_by', 'scope']:
            name = {'type': 'field-type', 'filled_by': 'filled-by', 'scope': 'scope'}[key]
            for n, val in enumerate(vals):
                add(name, val, f'Tillatt {key} i feltregister: {val}.', 'schemas/_index.json', f'/registry_contract/{key}/{n}')
    for sid, reg in data['registries'].items():
        for n, f in enumerate(reg['fields']):
            for m, term in enumerate(f['applies_when']['all']):
                add('condition-operator', term['op'], {'eq': 'Lik én verdi.', 'in': 'Lik en av flere verdier.',
                    'contains': 'Listen inneholder verdien.', 'present': 'Feltet finnes når value er true; ellers mangler det.'}[term['op']],
                    f'schemas/{sid}.json', f'/fields/{n}/applies_when/all/{m}/op')
    # Explicitly requested grouping, separate from ISO country codes and CAP rules.
    for val, label, definition in [('EU', 'EU', 'Overlappende medlemsgruppe, ikke eksklusivt landvalg. EU-land er også i EØS; medlemskap gir ikke automatisk lokal rettsanvendelse.'),
                                   ('EEA', 'EØS', 'Overlappende medlemsgruppe: EU-land samt Norge, Island og Liechtenstein; innlemmelse og nasjonal gjennomføring må kontrolleres.')]:
        add('country-group', val, definition, 'BRIEF.md', '',
            source('EFTA', 'https://www.efta.int/about-efta/legal-documents/eea-legal-texts', 'The EEA Agreement; EEA Status of EU legal acts'))
        values['country-group'][typed(val)]['label_nb'] = label
    # Claims were prose/open records, not a legal permission taxonomy. Mine mention evidence.
    claims = {
        'helse': ('Helse', r'helsepåstand|health claim', 'Påstand om sammenheng mellom produkt og helse.'),
        'ernaering': ('Ernæring', r'ernæringspåstand|sukkerfri', 'Påstand om næringsinnhold eller ernæringsmessig egenskap.'),
        'miljo': ('Miljø', r'miljøpåstand|milj.p.stand|environmental', 'Påstand om miljøegenskap, miljøvirkning eller bærekraft.'),
        'pris': ('Pris', r'førpris|prisnedsettelse|prispåstand', 'Påstand om pris, prisfordel eller tilbudsvilkår.'),
        'sammenligning': ('Sammenligning', r'sammenlignende|sammenligning', 'Sammenligner produkt, ytelse eller vilkår med et alternativ.'),
        'effekt': ('Effekt', r'effektpåstand|resultatpåstand', 'Påstand om virkning eller oppnådd resultat.'),
        'superlativ': ('Superlativ', r'superlativ|best i test', 'Påstand om overlegenhet eller rangering.'),
        'knapphet': ('Knapphet', r'knapphet|tidsfrist', 'Påstand om begrenset tilgang, antall eller tid.'),
    }
    claim_evidence = []
    for val, (label, pattern, definition) in claims.items():
        hits = [(file, ptr) for file, doc in files.items() for ptr, v in walk(doc)
                if isinstance(v, str) and re.search(pattern, v, re.I)]
        if not hits:
            raise ValueError('Claim category has no mined mention: ' + val)
        add('claim-type', val, definition, hits[0][0], hits[0][1], 'Fume')
        values['claim-type'][typed(val)]['label_nb'] = label
        claim_evidence.append({'id': val, 'evidence': [{'file': f, 'pointer': p} for f, p in hits]})
    lists = {}
    for name, rows in sorted(values.items()):
        src = PLATFORM_SOURCES if name in ['channel', 'channel-filter', 'placement', 'format'] else [
            source('Fume', 'schemas/_index.json', 'registry_contract; schemas; feltets opprinnelige source', True,
                   'Maskinelt uttrekk av lukkede feltverdier og strukturerte metadata; ingen ny ekstern fagpåstand.')]
        if name == 'country':
            src = [source('UN Statistics Division / ISO', 'https://unstats.un.org/unsd/methodology/m49/overview/',
                          'ISO-alpha2 Code; eksisterende scripts/country_codes.json', False,
                          'Eksisterende snapshot med 249 koder beholdt; ikke hentet på nytt. Alle er brukt i registrenes lukkede verdier.')]
        if name == 'country-group':
            src = provenance[name]
        if name == 'claim-type':
            src = [source('Fume', 'skills/Lov.json', 'Påstandstyper utledet fra faktiske regeltekster', True,
                          'Fume-klassifisering fra teksttreff; ikke uttømmende juridisk klassifisering eller godkjenning.')]
        lists[name] = {'id': name, 'label_nb': LABELS.get(name, name.replace('-', ' ').capitalize()),
                       'source': src, 'values': list(rows.values())}
    return lists, {'field_lists': field_bindings, 'occurrences': occurrences, 'claim_evidence': claim_evidence,
                   'provenance': dict(provenance)}


def obj(properties, required=None, additional=False):
    return {'type': 'object', 'properties': properties,
            'required': list(properties) if required is None else required, 'additionalProperties': additional}


def arr(items, minimum=0, unique=False):
    out = {'type': 'array', 'items': items, 'minItems': minimum}
    if unique:
        out['uniqueItems'] = True
    return out


def enum_schema(lists, name, allowed=None):
    ids = [v['id'] for v in lists[name]['values']]
    if allowed is not None:
        keys = {typed(v) for v in allowed}
        ids = [v for v in ids if typed(v) in keys]
        if {typed(v) for v in ids} != keys:
            raise ValueError(f'{name}: values missing from list')
    return {'enum': ids, 'x-list': '../lists/' + name + '.json'}


def inferred(samples):
    """Typed metadata extensions, NOT inferred artifact payload or enum constraints.

    Used for explanatory authoring-contract extensions and index records only.
    Known keys are closed; cross references are checked separately by validate.py.
    """
    groups = defaultdict(list)
    for x in samples:
        groups[type(x).__name__].append(x)
    if len(groups) > 1:
        return {'anyOf': [inferred(v) for _, v in sorted(groups.items())]}
    kind, rows = next(iter(groups.items()))
    if kind == 'dict':
        keys = sorted(set().union(*(v.keys() for v in rows)))
        props = {k: inferred([v[k] for v in rows if k in v]) for k in keys}
        return obj(props, sorted(set.intersection(*(set(v) for v in rows))))
    if kind == 'list':
        flat = [x for v in rows for x in v]
        return arr(inferred(flat) if flat else {})
    return {'type': {'str': 'string', 'int': 'integer', 'float': 'number', 'bool': 'boolean', 'NoneType': 'null'}[kind]}


def definition_schemas(data, lists):
    E = lambda name, allowed=None: enum_schema(lists, name, allowed)
    source_ref = obj({'source': TEXT, 'url': TEXT, 'locator': TEXT, 'quote': {'type': 'string'},
                      'read_on': {'type': 'string', 'format': 'date'}, 'verified': {'type': 'boolean'},
                      'verification_note': TEXT}, ['source', 'url', 'locator'])
    list_source = copy.deepcopy(source_ref)
    list_source['required'] = list(list_source['properties'])
    list_source['required'].remove('quote')
    list_value = obj({'id': {'type': ['string', 'integer', 'boolean']}, 'label_nb': TEXT,
                      'definition': TEXT, 'source': arr(list_source, 1)}, ['id', 'label_nb', 'definition'])
    result = {'list': obj({'id': ID, 'label_nb': TEXT, 'source': arr(list_source, 1), 'values': arr(list_value, 1)})}
    choice = lambda name: {'anyOf': [E(name), arr(E(name), 1, True)]}
    applies = {k: choice(v) for k, v in FILTER_LISTS.items() if not k.startswith('funnel.')}
    applies['funnel'] = obj({'stage': choice('funnel-stage'), 'mode': choice('funnel-mode')})
    skill_props = {k: TEXT for k in ['name', 'principle', 'source_says', 'rule', 'example_bad', 'example_good']}
    skill_props.update({'id': ID, 'subject': E('subject'), 'sources': arr(source_ref, 1),
                        'house_rule': {'type': 'boolean'}, 'check': E('check-type'),
                        'applies_when': obj(applies, ['channel', 'awareness_level', 'market', 'country', 'funnel']),
                        'checkpoints': arr(E('checkpoint'), 1, True), 'tier': E('tier'),
                        'conflicts_with': arr(ID, unique=True), 'state': E('state'), 'lang': E('language'),
                        'read_on': {'type': 'string', 'format': 'date'}, 'verified': {'type': 'boolean'}})
    skill = obj(skill_props, [k for k in skill_props if k not in ['read_on', 'verified']])
    skill['allOf'] = [{'if': {'properties': {'tier': {'const': 'plattform'}}, 'required': ['tier']},
                       'then': {'required': ['read_on']}}]
    result['skill'] = skill
    result['pensum-entry'] = obj({**{k: TEXT for k in ['source', 'url', 'what_engine_takes', 'free_access', 'url_status']},
                                  'subject': E('subject'), 'tier': E('tier'), 'checkpoints': arr(E('checkpoint'), 1, True)})
    flows = list(data['flows'].values())
    flow = inferred(flows)
    # Hand-authored executable definition contracts, not snapshots of today's values.
    flow['required'] = ['id', 'name', 'purpose', 'sources', 'checkpoints', 'input', 'steps', 'output_artifact',
                        'validation', 'fail_route', 'skills_used', 'state', 'input_fields', 'input_schema',
                        'output_artifact_schema', 'schema_reads', 'field_reads']
    flow['properties'].update({'id': ID, 'name': TEXT, 'purpose': TEXT, 'sources': arr(source_ref, 1),
                               'checkpoints': arr(E('checkpoint'), 1, True), 'state': E('state'),
                               'skills_used': arr(ID, 1, True), 'schema_reads': arr(TEXT, 1, True),
                               'field_reads': {'type': 'object', 'minProperties': 1, 'additionalProperties': TEXT}})
    validation = obj({'who': E('who'), 'checks': arr(TEXT, 1), 'pass_condition': TEXT})
    step = obj({'n': {'type': 'integer', 'minimum': 1}, 'what': TEXT,
                'who': E('who', ['kode', 'modell', 'kritiker', 'menneske']), 'input': TEXT,
                'output': TEXT, 'validation': validation, 'input_schema': TEXT, 'output_schema': TEXT})
    flow['properties']['steps'] = arr(step, 1)
    flow['properties']['fail_route'] = obj({**{k: TEXT for k in ['on_failure', 'return_to', 'counting', 'after_limit', 'resume']},
                                           'max_failed_tries': {'const': 2}})
    result['flow'] = flow
    regs = list(data['registries'].values())
    registry = inferred(regs)
    registry['required'] = ['id', 'label_nb', 'version', 'state', 'lang', 'kind', 'definition', 'imports', 'read_by', 'fields']
    condition = obj({'field': TEXT, 'op': E('condition-operator'),
                     'value': {'type': ['string', 'number', 'boolean', 'array', 'object', 'null']}})
    fsource = {'anyOf': [{'const': 'Fume'}, source_ref, arr(source_ref, 1)]}
    field_props = {k: TEXT for k in ['id', 'path', 'group', 'label_nb', 'definition', 'open_reason', 'ref']}
    registry_value = obj({'value': {'type': ['string', 'integer', 'number', 'boolean', 'object']},
                          'definition': TEXT, 'channel': {'anyOf': [E('channel'), arr(E('channel'), 1, True)]},
                          'source': {'anyOf': [{'const': 'Fume'}, source_ref]},
                          'read_on': {'type': 'string', 'format': 'date'},
                          'selection_kind': E('placement-kind'), 'selectable': E('placement-selection'),
                          'included_surfaces': arr(TEXT, 1), 'parent': E('placement'), 'selection_note': TEXT},
                         ['value', 'definition'])
    field_props.update({'type': E('field-type'), 'values': arr(registry_value),
                        'filled_by': E('filled-by'), 'source': fsource,
                        'lever': obj({'flows': arr(ID, 1, True), 'choices': TEXT}),
                        'applies_when': obj({'all': arr(condition)}), 'scope': E('scope'),
                        'required': {'type': 'boolean'}, 'read_by': arr(ID, 1, True),
                        'constraints': inferred([f['constraints'] for r in regs for f in r['fields'] if 'constraints' in f])})
    field = obj(field_props, [k for k in field_props if k not in ['open_reason', 'ref', 'constraints']])
    field['allOf'] = [{'if': {'properties': {'values': {'maxItems': 0}}, 'required': ['values']},
                       'then': {'required': ['open_reason']}}]
    registry['properties'].update({'id': ID, 'version': {'type': 'integer', 'minimum': 1}, 'label_nb': TEXT,
                                   'definition': TEXT, 'state': E('state'), 'lang': E('language'),
                                   'kind': E('registry-kind'), 'fields': arr(field, 1),
                                   'read_by': arr(ID, 1, True), 'imports': arr(ID, unique=True)})
    result['field-registry'] = registry
    result['registry-index'] = inferred([data['registry_index']])
    result['flow-index'] = inferred([data['flow_index']])
    # Index maps are extensible keyed maps; validator checks target IDs and coverage.
    ri = result['registry-index']['properties']
    for key in ['artifact_bindings', 'flow_bindings', 'skill_bindings']:
        if isinstance(data['registry_index'][key], dict):
            ri[key] = {'type': 'object', 'additionalProperties': inferred(list(data['registry_index'][key].values()))}
    return result


def path_parts(path):
    return [part for segment in path.split('.') for part in ([segment[:-2], '[]'] if segment.endswith('[]') else [segment])]


def node_at(root, parts):
    node = root
    for part in parts:
        if part == '[]':
            node.setdefault('type', 'array')
            node = node.setdefault('items', {})
        else:
            node.setdefault('type', 'object')
            node = node.setdefault('properties', {}).setdefault(part, {})
    return node


def require_path(root, parts):
    node = root
    for part in parts:
        if part == '[]':
            node.setdefault('type', 'array')
            node = node.setdefault('items', {})
        else:
            node.setdefault('type', 'object')
            if part not in node.setdefault('required', []):
                node['required'].append(part)
            node = node.setdefault('properties', {}).setdefault(part, {})


def condition_at(parts, test):
    """Presence-aware nested condition; [] uses contains when evaluated above items."""
    if not parts:
        return test
    first, *tail = parts
    if first == '[]':
        return {'type': 'array', 'contains': condition_at(tail, test)}
    return {'type': 'object', 'required': [first], 'properties': {first: condition_at(tail, test)}}


def payload_schema(sid, data, lists):
    regs = data['registries']
    reg = regs[sid]
    fields = {f['id']: f for r in regs.values() for f in r['fields']}
    artifact = 'artifact_path' in reg
    root = {'type': 'object', 'properties': {}}
    located = []
    scope_paths = {sid: []}
    # Imported domains are snapshots, not flattened into the artifact root.
    if artifact:
        for imported in reg['imports']:
            scope_paths[imported] = [] if imported == 'artefakt-felles' else ['grunnlag', 'domener', imported]
        for imported, prefix in scope_paths.items():
            if imported != sid:
                for f in regs[imported]['fields']:
                    located.append((f, prefix + path_parts(f['path'])))
                if prefix:
                    require_path(root, prefix)
    located.extend((f, path_parts(f['path'])) for f in reg['fields'])
    # Register leaf type/enum and preserve deliberately open record content.
    for f, path in located:
        node = node_at(root, path)
        kind = f['type']
        node.update({'type': ['integer', 'string'] if kind == 'integer|string' else kind,
                     'description': f['definition'], 'x-field': f['id']})
        leaf = path[-1]
        if kind == 'string' and (leaf == 'id' or leaf.endswith('_id') or leaf in ['field_ref', 'ref']):
            node['minLength'] = 1
        if kind == 'string' and (leaf.lower() in ['sha-256', 'sha256'] or leaf.endswith('_sha256')):
            node['pattern'] = '^[a-fA-F0-9]{64}$'
        if kind == 'integer' and leaf in ['versjon', 'version', 'schema_version']:
            node['minimum'] = 1
        if kind == 'string' and leaf in ['timestamp', 'approved_at', 'expires_at']:
            node['format'] = 'date-time'
        if kind == 'object':
            node['additionalProperties'] = True  # Explicit open_reason on record parents.
        elif kind == 'array':
            node.setdefault('items', {})
        if f['values']:
            target = node['items'] if kind == 'array' else node
            target.update(enum_schema(lists, field_list(f), [v['value'] for v in f['values']]))
            if kind == 'array' and field_list(f) == 'funnel-stage' and 'alle' not in [v['value'] for v in f['values']]:
                main_stages = [v['value'] for v in f['values'] if v['value'] != 'salgsrunde']
                node.update({'minItems': 1, 'maxItems': 2, 'uniqueItems': True,
                             'contains': enum_schema(lists, 'funnel-stage', main_stages),
                             'minContains': 1, 'maxContains': 1})
        if f['path'] == 'innhold.kampanjekort.deler':
            node['minItems'] = 1
        for key in ['minimum', 'maximum', 'minLength', 'maxLength', 'pattern']:
            if key in f.get('constraints', {}):
                node[key] = f['constraints'][key]
        fmt = f.get('constraints', {}).get('format')
        if fmt in ['ISO-8601-date', 'RFC3339']:
            node['format'] = {'ISO-8601-date': 'date', 'RFC3339': 'date-time'}[fmt]

    runtime_conditions = []
    for f, path in located:
        if not f['required']:
            continue
        terms = f['applies_when']['all']
        if not terms:
            require_path(root, path)
            continue
        resolved = []
        unresolved = False
        for term in terms:
            target = fields[term['field']]
            target_sid = term['field'][:-(len(target['path']) + 1)]
            if target_sid not in scope_paths:
                unresolved = True
                break
            tpath = scope_paths[target_sid] + path_parts(target['path'])
            resolved.append((tpath, term))
        if unresolved:
            runtime_conditions.append({'field': f['id'], 'applies_when': f['applies_when']})
            continue
        # Per-item conditions must hold on the SAME item, never across two rows.
        context = path[:len(path) - 1]
        while context and context[-1] != '[]':
            context = context[:-1]
        if context and not all(p[:len(context)] == context for p, _ in resolved):
            context = []
        condition_node = node_at(root, context)
        tests = []
        for tpath, term in resolved:
            rel = tpath[len(context):]
            op, value = term['op'], term['value']
            test = {'eq': {'const': value}, 'in': {'enum': value} if isinstance(value, list) else {},
                    'contains': {'type': 'array', 'contains': {'const': value}}, 'present': {}}[op]
            test = condition_at(rel, test)
            if op == 'present' and value is False:
                test = {'not': test}
            tests.append(test)
        then = {}
        require_path(then, path[len(context):])
        # Even optional parent records have required children once present. Presence
        # on the containing array is tautological inside its existing item.
        condition_node.setdefault('allOf', []).append({'if': {'allOf': tests}, 'then': then})
    # Enforce the declared lossless legacy-selector mapping wherever the domain is imported.
    if 'kanal-format' in scope_paths:
        domain = node_at(root, scope_paths['kanal-format'])
        for row in regs['kanal-format']['format_contract']['rows']:
            props = {k: {'const': row[k]} if k == 'ad_product' else {'enum': row[k]}
                     for k in ['creative_medium', 'ad_product', 'delivery_behavior']}
            domain.setdefault('allOf', []).append({
                'if': {'required': ['format'], 'properties': {'format': {'const': row['format']}}},
                'then': {'required': ['binding'], 'properties': {'binding': obj(props, additional=True)}}})
    # Close structural wrappers, while registered open objects stay open.
    def close(node):
        if not isinstance(node, dict):
            return
        if node.get('type') == 'object' and 'properties' in node:
            node.setdefault('additionalProperties', False)
            for sub in node['properties'].values():
                close(sub)
        if 'items' in node:
            close(node['items'])
    close(root)
    # Imported common grunnlag is intentionally open, but domain names are closed.
    if artifact and 'domener' in root.get('properties', {}).get('grunnlag', {}).get('properties', {}):
        root['properties']['grunnlag']['properties']['domener']['additionalProperties'] = False
    if artifact:
        root['properties']['schema_id']['const'] = sid
        root['properties']['schema_version']['const'] = reg['version']
        profile = reg.get('validation_profile', {})
        for flag, path in [('critic_required', 'kritikk'), ('human_decision_required', 'godkjenning')]:
            if profile.get(flag):
                require_path(root, [path])
                root['properties'][path]['minItems'] = 1
        # These envelope properties are explicit in every flow's artifact_contract
        # and the common registry's hash_contract, but lack individual field rows.
        root['properties']['forrige_artefakt'] = obj({'sti': TEXT, 'versjon': {'type': 'integer', 'minimum': 1},
                                                    'SHA-256': {'type': 'string', 'pattern': '^[a-fA-F0-9]{64}$'}})
        root['properties']['signatur'] = {'type': 'object', 'minProperties': 1,
                                          '$comment': 'Betrodd signaturbevis; leverandørformat verifiseres av kjørelaget.'}
        if sid != 'oppdrag':
            require_path(root, ['forrige_artefakt'])
        root['x-envelope-source'] = 'flows/*/validation/artifact_contract; schemas/artefakt-felles.json#hash_contract'
    if runtime_conditions:
        root['x-runtime-conditions'] = runtime_conditions
    root['x-registry'] = '../' + sid + '.json'
    root['$comment'] = ('Generert fra feltregister. Åpne record-felt beholder open_reason. '
                        'Kildebelegg, signaturmyndighet og faglig validering krever flytens runtime-porter.')
    return root


def generate(data):
    lists, inventory = mine(data)
    schemas = definition_schemas(data, lists)
    for sid in data['registries']:
        schemas[sid] = payload_schema(sid, data, lists)
    for sid, schema in schemas.items():
        schema.update({'$schema': DRAFT, '$id': BASE + sid + '.schema.json', 'title': sid})
    return lists, share_definitions(schemas, lists), inventory


def share_definitions(schemas, lists):
    """Factor exact subtrees only; never compose closed objects with allOf."""
    definitions = {name: {'enum': [v['id'] for v in row['values']],
                          'x-list': '../../lists/' + name + '.json', '$defs': {}}
                   for name, row in lists.items()}

    def enums(value, prefix='_defs/'):
        if isinstance(value, list):
            return [enums(v, prefix) for v in value]
        if not isinstance(value, dict):
            return value
        out = {k: enums(v, prefix) for k, v in value.items() if k not in ['enum', 'x-list']}
        if 'x-list' not in value:
            if 'enum' in value:
                out['enum'] = value['enum']
            return out
        name = Path(value['x-list']).stem
        resource = definitions[name]
        suffix = ''
        if value['enum'] != resource['enum']:
            key = 'subset-' + hashlib.sha256(typed(value['enum']).encode()).hexdigest()[:16]
            resource['$defs'][key] = {'enum': value['enum'], 'x-list': resource['x-list']}
            suffix = '#/$defs/' + key
        out['$ref'] = prefix + name + '.schema.json' + suffix
        return out

    schemas = {sid: enums(schema) for sid, schema in schemas.items()}
    # Count exact repeated schema nodes, including common envelope and imported
    # domain parts. Hash names remain stable when unrelated schemas are added.
    counts = defaultdict(int)
    for schema in schemas.values():
        for _, node in walk(schema):
            if isinstance(node, dict) and (isinstance(node.get('type'), (str, list)) or 'anyOf' in node or 'if' in node):
                key = typed(node)
                if len(key.encode()) >= 160:
                    counts[key] += 1
    shared = {}

    def factor(value, in_defs=False, root=False):
        if isinstance(value, list):
            return [factor(v, in_defs) for v in value]
        if not isinstance(value, dict):
            return value
        key = typed(value)
        if not root and counts.get(key, 0) > 1:
            name = 'part-' + hashlib.sha256(key.encode()).hexdigest()[:16]
            if name not in shared:
                shared[name] = factor(value, True, True)
            return {'$ref': ('' if in_defs else '_defs/') + 'artifact-parts.schema.json#/$defs/' + name}
        return {k: (v.removeprefix('_defs/') if in_defs and k == '$ref' else factor(v, in_defs))
                for k, v in value.items()}

    result = {sid: factor(schema, root=True) for sid, schema in schemas.items()}
    definitions['artifact-parts'] = {'$defs': shared}
    for name, schema in definitions.items():
        if not schema.get('$defs'):
            schema.pop('$defs', None)
        sid = '_defs/' + name
        result[sid] = {**schema, '$schema': DRAFT, '$id': BASE + sid + '.schema.json', 'title': name}
    return result


def inventory_summary(inventory):
    """Keep detailed mining in memory for validation, not in the review artifact."""
    counts = defaultdict(int)
    for row in inventory['occurrences']:
        counts[row['list']] += 1
    return {'field_lists': inventory['field_lists'],
            'occurrence_count': len(inventory['occurrences']),
            'occurrences_by_list': dict(sorted(counts.items())),
            'detail': 'Regenerate with tools.formal.mine(read_data()); every occurrence is checked by tools/validate.py.'}
