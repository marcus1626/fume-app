# Engine School validator

Copy this directory to `<repo>/tools/engine-school/`. Copy the Engine School
JSON and Markdown tree, preserving relative paths, to `<repo>/docs/engine-school/`.
Exclude `.runs`, `ref`, and `sources/fetched` from that copy.

Requires Python 3.10 or newer. Install all pinned runtime dependencies:

```sh
python -m pip install -r tools/engine-school/requirements.txt
python tools/engine-school/validate.py
python tools/engine-school/check_formal.py
python tools/engine-school/check_round3_negative.py
```

The default data root is `Path(__file__).resolve().parents[2] / 'docs' / 'engine-school'`.
Set `ENGINE_SCHOOL_ROOT` to validate a different data tree. Code and the bundled
ISO country snapshot are always resolved next to the entry point, independently
of the data root and working directory.

Validation prints JSON to stdout and exits 0 for PASS, 1 for FAIL. It never
writes reports, generated schemas, or bytecode caches. Add `--report <path>`
to explicitly write a JSON report (also supported by the individual checks).
Use `--artifact <path.json>` repeatedly to validate real artifact payloads.
All schema resolution is local; no network fetching occurs.

Schema generation is computed only in memory to detect drift. Generators are
not bundled or invoked. Negative tests mutate disposable temporary data copies
and leave the supplied docs tree unchanged. `check_formal.py` includes synthetic
artifact fixtures and CLI error injections; it does not rebuild registries.

TXT/PDF research archives are optional and excluded from this distribution.
Provenance checks require registered citation URLs and nonempty locators and
reject archive paths escaping the data root. They do not require archived source
files to be installed, or verify remote source content or real approvals.
