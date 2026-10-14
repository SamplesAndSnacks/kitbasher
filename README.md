# Kitbasher

Kitbasher adds new sound models to your Elektron Machinedrum's OS. Pick the
machines you want, and it builds an OS update that keeps every stock machine and
adds yours alongside them.

It works on stock OS 1.63, X.14 and beta md-26A09-132401, and runs entirely in
your browser at **[kitbasher.xyz](https://kitbasher.xyz)**. Your firmware never leaves your
computer: nothing is uploaded, and there is no server-side build.

X.20 is currently not supported. Patching is temporarily disabled.

Kitbasher is a community project. It is not affiliated with or endorsed by Elektron.
Kitbasher is not affiliated with MDX. Its modified X.14 and X.20 builds are not
official MDX releases and are not supported by the MDX creator.

Generated builds use Kitbasher's own **K.01** version, with the original OS
recorded separately. See [firmware versioning](docs/VERSIONING.md).

X.14 builds also add **GLOBAL → ROUTING → FX ORDER**: place DIST and SRR
before or after the filter for all tracks, saved per global slot.
See [FX order](docs/FX-ORDER.md).

## Using it

1. **Back up.** Keep the OS file you have installed now, and save your kits and
   patterns (GLOBAL › SYSEX SEND › ALL into a SysEx recorder). Sending that OS
   file again restores your machine.
2. **Load your OS and answer the UW question.** Open [kitbasher.xyz](https://kitbasher.xyz),
   drop in your OS file (`.syx` or `.bin`), and say whether your Machinedrum has
   the UW option: Yes or No. To check, open the machine menu of any track on
   your current firmware: if it has ROM and RAM categories, you have UW. Nothing
   goes ahead, and nothing is built, until you click Yes or No; the page does
   not remember the answer or take it from a restored file, and saves it with
   your layout.

   **Built with Kitbasher before?** Open *Restore an earlier layout* below the
   drop zone and drop the `.syx` you flashed (or your project or layout file),
   so your kits keep finding their machines (a Kitbasher `.syx` dropped as the OS
   file restores the same way; the page then asks for the stock OS):
   machine IDs are now given from the lowest free one (the same selection, OS,
   UW answer and menu layout always get the same IDs), and earlier builds used
   others. See [Machine IDs](docs/BASES.md#machine-ids).
3. **Choose machines.** Browse the model cards by category and select what you want.
   Click a machine's name for its screen preview and control descriptions.
   The memory meters and sample trimming controls are below the browser.
   Under **Options**, you can edit [E12 samples](docs/SAMPLES.md) or arrange the
   machine menu; both are optional.
4. **Build.** Click **Build firmware**. **Download firmware** lets you save
   to save the new `.syx`. **Save for next time → Save project** keeps your samples,
   machines and layout in a [project file](docs/PROJECT-FILE.md).
5. **Send it.** In Chrome, click **Send firmware**, allow MIDI access, and choose
   your MIDI output. Connect the interface's OUT to the Machinedrum's MIDI IN.
   Hold FUNCTION while powering on and choose [5 LT] MIDI UPGRADE, then click
   **I'm ready — send firmware**. Keep the tab open and computer awake until it
   finishes; wait for the Machinedrum to finish before restarting it.
   Alternatively, send the downloaded file from a SysEx tool with a 20 ms gap
   between messages. See [browser firmware sending](docs/FIRMWARE-MIDI.md).

On OS X.14 and OS 1.63, browser builds include **MIDI chromatic note
input** automatically: notes on MIDI channel 5 (base channel + 4) play the
selected track at pitch, record a pitch p-lock in live record, and p-lock every
held step in grid record. See [MIDI chromatic note input](docs/MIDI-CHROMATIC.md).

On OS X.14 and OS 1.63, browser builds also include **pitch note names**
automatically: the pitch knob of an added model shows the note it plays under
its dial (`C-3`, `C#3`, `C+3` for a quarter tone) instead of a number, as
Elektron's DEV firmware shows a TONAL track. See [Pitch note names](docs/PITCH-LABELS.md).

On OS X.14 and OS 1.63, the automatically included **unmute latency fix**
makes an unmuted track play its next trig instead of about two steps later. See
[Supported bases](docs/BASES.md#unmute-latency).

Some models use a sample in UW memory; the page lists those and offers the
sample files with instructions.

On X.14 and OS 1.63, browser builds automatically add **Swap Speeds** in
GLOBAL → CONTROL → MECH SETTINGS. Turn it ON to turn fast normally and press for fine
adjustment. See [Swap Speeds](docs/ENCODER-SPEED.md).

A Machinedrum without the UW option takes the same OS update. Answer No to the UW
question and the page leaves out what such a unit cannot use: models that play
UW samples (marked *needs UW*) and machine IDs of 128 and up (a machine that
a restored session puts there moves to a free ID below 128, and the page says
so). The machine menu then shows your categories where ROM and RAM
would be. See [Machinedrum without UW](docs/BASES.md#machinedrum-without-uw).

## Supported bases

| Base | Support |
|---|---|
| OS 1.63 (stock) | Prepared automatically with a small boot hook, then patched; tested in the emulator |
| OS X.14 | Patched directly; tested on hardware |
| Beta firmware (md-26A09-132401) | Patched directly; tested on hardware and in the emulator; see [beta validation](docs/BASES.md#beta-26a09) |
| MDX X.20 B (public beta) | Currently not supported; patching temporarily disabled |

Em's earlier DEV firmware is no longer supported. Load `md-26A09-132401-beta.syx` instead.

Details per base are in [docs/BASES.md](docs/BASES.md).

## Models

Sources for five model families live in [`examples/`](examples/): seven analog
drum and synth recreations, five community synth voices, a 30-program port of
Befaco's Noise Plethora, a Karplus–Strong string and a ladder filter effect. [docs/MODELS.md](docs/MODELS.md) describes them, with
their credits and licenses.

## Safety

**Use at your own risk.** Kitbasher is free software provided as is, without
warranty of any kind (see sections 15 and 16 of the [GPL v3](COPYING)).
Installing modified firmware can make your Machinedrum unusable. The authors and
contributors accept no liability for damage, data loss or repair costs, however
caused. If you are not comfortable recovering a Machinedrum from a failed update,
do not install a patched OS.

Flashing firmware always carries some risk. Kitbasher is designed not to touch
the boot menu, so a failed or unwanted update can normally be recovered by sending
your original OS file the same way. Keep that file safe before you start. Every
build is also checked before you can download it, including that nothing it adds touches
memory the Machinedrum has not set up yet during boot.

Every rule that keeps a patched build from crashing or freezing the
Machinedrum, and the hardware test to run before you share an image, is in
[docs/FIRMWARE-SAFETY.md](docs/FIRMWARE-SAFETY.md).

Saved kits refer to machines by ID. When you rebuild for existing kits, drop
your previous Kitbasher `.syx`, project or layout file under *Restore an earlier
layout* on the first step so every
machine keeps its ID ([Machine IDs](docs/BASES.md#machine-ids)).

## Development

You need Node 22+ and Python 3.11+.

```text
npm ci
npm run doctor
npm run check
npm run dev
```

`npm run dev` serves the page at `http://127.0.0.1:8767` and rebuilds it as you
edit. The command-line patcher shares the browser's engine:

```text
node engine/dist/src/cli.js --in my-os.syx --out patched.syx --uw --clean-recovery
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) to get set up, and
[the documentation index](docs/README.md) for how it all fits together. To
write your own model, start with the [scaffold example](examples/scaffold/README.md).

## License

Kitbasher is free software under the GNU General Public License, version 3 or
(at your option) any later version; see [COPYING](COPYING). The model sources in
`examples/` use the same license. Bundled third-party code is listed in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), and model licenses in
[docs/MODELS.md](docs/MODELS.md).
