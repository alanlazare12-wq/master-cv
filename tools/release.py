#!/usr/bin/env python3
"""Bump Hoja Personal release identity from one command.
Usage: python tools/release.py 45
"""
from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2 or not sys.argv[1].isdigit():
    raise SystemExit('Uso: python tools/release.py <major>')
major=int(sys.argv[1]); version=f'{major}.0.0-personal'

def sub(path, pattern, repl):
    p=ROOT/path;s=p.read_text(encoding='utf8');n=re.sub(pattern,repl,s);p.write_text(n,encoding='utf8')

sub(Path('src/version.js'),r"APP_MAJOR=\d+",f'APP_MAJOR={major}')
sub(Path('src/version.js'),r"APP_VERSION='[^']+'",f"APP_VERSION='{version}'")
sub(Path('src/version.js'),r"APP_LABEL='Hoja Personal CV Studio v\d+'",f"APP_LABEL='Hoja Personal CV Studio v{major}'")
sub(Path('package.json'),r'"version":\s*"[^"]+"',f'"version": "{version}"')
sub(Path('server.py'),r"VERSION='[^']+'",f"VERSION='{version}'")
sub(Path('server.py'),r"server_version='HojaPersonal/\d+'",f"server_version='HojaPersonal/{major}'")
sub(Path('run.bat'),r'CV Studio v\d+',f'CV Studio v{major}')
sub(Path('manifest.webmanifest'),r'CV Studio v\d+',f'CV Studio v{major}')
sub(Path('index.html'),r'CV Studio v\d+',f'CV Studio v{major}')
for p in [ROOT/'index.html',ROOT/'sw.js',*sorted((ROOT/'src').glob('*.js'))]:
    s=p.read_text(encoding='utf8');s=re.sub(r'\?v=\d+',f'?v={major}',s);s=re.sub(r"hoja-personal-v\d+",f'hoja-personal-v{major}',s) if p.name=='sw.js' else s;p.write_text(s,encoding='utf8')
print(f'Release identity actualizada a v{major} / {version}')
