"""Build extensions around the unmodified upstream document (Python stdlib only)."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import ast
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent


def catalog(root=ROOT):
    pairs = []
    for line in (root / 'extension/translations.txt').read_text(encoding='utf-8').splitlines():
        if line and not line.startswith('#'):
            ko, en = line.split('|', 1)
            pairs.append((ko, en))
    return dict(pairs)


class DisplayText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = False
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip = True

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = False

    def handle_data(self, data):
        value = ' '.join(data.split())
        if not self.skip and re.search('[가-힣]', value):
            self.text.append(value)


def build(root=ROOT):
    root = Path(root).resolve()
    source = (root / 'index.html').read_text(encoding='utf-8')
    anchors = ['<div class="wrap">', '<header>', 'id="mine"', 'id="enemy"',
               'function calc(', 'function render(){', 'function renderSpeed(){',
               'function populateSpeedBuffs(){', '<script>', '</body>']
    for anchor in anchors:
        if source.count(anchor) != 1:
            raise ValueError(f'Upstream integration changed; expected one {anchor!r}')
    translations = catalog(root)
    parser = DisplayText()
    parser.feed(source)
    script = source.split('<script>', 1)[1].split('</script>', 1)[0]
    for literal in re.findall(r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*' ''', script, re.X):
        try:
            value = ast.literal_eval(literal)
        except (ValueError, SyntaxError):
            continue
        if isinstance(value, str) and re.search('[가-힣]', value):
            dynamic = DisplayText()
            dynamic.feed(value)
            parser.text.extend(dynamic.text)
    # Exact strings or fully covered fragments are acceptable. Never guess new translations.
    missing = []
    for value in dict.fromkeys(parser.text):
        remaining = value
        for ko in sorted(translations, key=len, reverse=True):
            remaining = remaining.replace(ko, '')
        if re.search('[가-힣]', remaining):
            missing.append(value)
    if missing:
        raise ValueError('Untranslated upstream display strings:\n' + '\n'.join(missing))
    # Preserve option values before translating visible text. Their Korean keys drive speed tables.
    source = re.sub(r'<option>([^<]+)</option>', lambda m: f'<option value="{m[1]}">{m[1]}</option>', source)
    # Fork comments must not post into the author's live Apps Script account.
    source, n = re.subn(r'const COMMENT_API="[^"]*";', 'const COMMENT_API="";', source)
    if n != 1:
        raise ValueError('Upstream comment integration changed')
    source = source.replace('<div class="wrap">', '<div class="wrap">\n<!--STATS_SHELL-->')
    source = source.replace('<!--STATS_SHELL-->', (root / 'extension/shell.html').read_text(encoding='utf-8'))
    # Hide the original damage UI as a unit, leaving the speed reference and attribution shared.
    source = source.replace('<div class="toolbar">', '<div id="bongbong-mode">\n<div class="toolbar">', 1)
    source = source.replace('<div class="panel speed-panel">', '</div>\n<div id="notmeter-mode" hidden></div>\n<div class="panel speed-panel">', 1)
    source = source.replace('<div class="notes">', '<div class="notes bongbong-notes">', 1)
    source = source.replace('<div class="notes sources">', '<div class="notes sources bongbong-notes">', 1)
    source = source.replace('</head>', '<link rel="stylesheet" href="./extension.css">\n</head>')
    source = source.replace('</body>', '<script src="./translations.js"></script>\n<script src="./models.js"></script>\n<script src="./app.js"></script>\n</body>')
    # Keep comments disabled; only local stat storage is added by the extension.
    source = source.replace('<div class="panel" style="margin-top:22px">', '<div class="panel upstream-comments" style="margin-top:22px">')
    output = root / 'dist'
    output.mkdir(exist_ok=True)
    (output / 'index.html').write_text(source, encoding='utf-8')
    js = 'globalThis.StatsTranslations=' + json.dumps(translations, ensure_ascii=False) + ';\n'
    (output / 'translations.js').write_text(js, encoding='utf-8')
    for name in ('models.js', 'app.js', 'extension.css'):
        shutil.copyfile(root / 'extension' / name, output / name)
    # Bundle isolated skill modules into the existing runtime asset contract.
    for target, extra in (('models.js', 'skill-model.js'), ('app.js', 'skill-ui.js')):
        with (output / target).open('a', encoding='utf-8') as stream:
            stream.write('\n' + (root / 'extension' / extra).read_text(encoding='utf-8'))
    (output / 'build-info.json').write_text(json.dumps({
        'upstream_sha256': hashlib.sha256((root / 'index.html').read_bytes()).hexdigest(),
        'notmeter_reference': '20261013-hard-hit',
        'skill_reference': 'Overhead Slam 11170000 Lv18; global client 2.0.7.0 / 25926599; 2026-10-16',
        'source': 'https://github.com/y3nly/aion2ssow',
    }, indent=2) + '\n', encoding='utf-8')
    print(f'Built {output}; {len(translations)} translation entries')
    return output


if __name__ == '__main__':
    build()
