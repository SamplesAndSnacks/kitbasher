"""Check LFO page entry/exit with native panel events; never opens external MIDI.

Uses the lab's mdEncoderPress probe (tools/encoder_speed_check.py), a stock
1.63 ROM and its factory cache. All inputs are explicit; evidence goes to a new
directory. RAM addresses below are shared by supported X.14 and stock 1.63.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for name in ['rom', 'out', 'probe', 'stock', 'factory-cache', 'dll-dir']:
        ap.add_argument('--' + name, type=Path, required=True)
    args = ap.parse_args()
    rom, out = args.rom.resolve(), args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    commands = [f'rom {rom}', 'boot 25', 'assign 0 16', 'run 1', 'tap ser', 'tap ser']
    expected = {}

    def read(name, address, size, value):
        commands.append(f'mem {name} {address:x} {size}')
        expected[name] = value

    for reverse in [0, 1]:
        # LFO speed is track parameter 21, MIDI CC 37, encoder F on both pages.
        commands.extend([f'poke 71216d {reverse*64:02x}', 'midi b0 25 1e', 'run .2'])
        commands.extend(['tap ser'] * 3)  # Refresh native encoder accumulators.
        for phase in ['routing-before', 'lfo', 'routing-after']:
            if phase == 'lfo':
                commands.append('chord ser')
            elif phase == 'routing-after':
                commands.append('tap exit')
            prefix = f'{reverse}-{phase}'
            read(prefix + '-page', 0x281a46, 4, 30 if phase == 'lfo' else 0)
            for held in [0, 1]:
                if held:
                    commands.extend(['press enc5', 'run .1'])
                factor = 7 if held != (reverse if phase != 'lfo' else 0) else 1
                for direction in [1, -1]:
                    name = f'{prefix}-{held}-{direction}'
                    # Each +/- pair returns to 30, avoiding range clamping.
                    commands.append(f'enc 5 {direction} 1')
                    read(name, 0x70002f, 1, 30 + factor if direction == 1 else 30)
                if held:
                    commands.extend(['release enc5', 'run .1'])
            read(prefix + '-setting', 0x71216d, 1, reverse*64)
    script = out / 'probe.txt'
    script.write_text('\n'.join(commands) + '\n', encoding='utf-8')
    home = out / 'home'
    (home / 'nvram').mkdir(parents=True)
    shutil.copy2(args.factory_cache, home / 'nvram')
    env = os.environ | dict(GEARMULATOR_MD_HOME=str(home),
                            GEARMULATOR_MD_DEV_ROM=str(rom),
                            GEARMULATOR_MD_STOCK_ROM=str(args.stock.resolve()))
    env['PATH'] = str(args.dll_dir.resolve()) + os.pathsep + env['PATH']
    with (out / 'probe.log').open('w', encoding='utf-8') as log:
        result = subprocess.run([str(args.probe.resolve()), str(script)], cwd=out,
                                env=env, stdout=log, stderr=subprocess.STDOUT,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), timeout=300)
    log = (out / 'probe.log').read_text(encoding='utf-8')
    actual = {name: int(value.replace(' ', ''), 16) for name, value in
              re.findall(r'mem (\S+) 0x[0-9a-f]+: ((?:[0-9a-f]{2} )+)@', log)}
    failures = {name: dict(expected=value, actual=actual.get(name))
                for name, value in expected.items() if actual.get(name) != value}
    report = dict(rom_sha256=hashlib.sha256(rom.read_bytes()).hexdigest(),
                  probe_sha256=hashlib.sha256(args.probe.read_bytes()).hexdigest(),
                  exit=result.returncode, cases=len(expected), failures=failures, hardware=False)
    (out / 'validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)
    if result.returncode or failures:
        raise SystemExit('LFO encoder regression failed')


if __name__ == '__main__':
    main()
