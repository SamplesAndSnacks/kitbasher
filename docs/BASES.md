# Supported bases

A *base* is the Machinedrum OS you start from. Kitbasher patches OS builds
derived from Elektron's OS 1.63 for the SPS-1UW, and adds models without
removing any stock machine.

| Base | Profile | How it is patched |
|---|---|---|
| OS 1.63 (stock) | `bases/stock-163.json` | Prepared once with a boot hook, then patched as the prepared base |
| OS 1.63, prepared | `bases/stock-163-prepared.json` | Patched directly |
| OS X.14 | `bases/x14.json` | Patched directly, chaining onto X.14's own add-on |
| Beta firmware (md-26A09-132401) | `bases/beta-26a09.json` | Patched directly, chaining onto its add-on; nothing after the DSP1 slot moves |
| MDX X.20 B (public beta) | `bases/x20.json` | Currently not supported; patching temporarily disabled |

X.13 is no longer supported: an OS tagged `X13 ` is refused before anything else.
Em's DEV builds, including md-26912-190450 and md-26A01-183521, are also retired:
every `DEV ` tag is refused before discovery, with a request to load
`md-26A09-132401-beta.syx`. Removing their profiles alone would let them fall
back to unprofiled discovery; the tag refusal prevents that.

Each profile records how far that base has been tested. X.14 images have been
tested on hardware (Machinedrum with UW), including the unmute-latency fix and
MIDI chromatic note input. Prepared 1.63 has passed engine and emulator checks.
The beta's evidence is recorded [below](#beta-26a09); it does not inherit the
retired DEV releases' qualification. The page and build report show the level
for the base you load.

## How a base is recognised

Each profile identifies its base by the OS tag and the SHA-256 of the ColdFire,
DSP1 and DSP2 slots (and of the add-on, where there is one). The engine then
*discovers* every patch site from signatures in `bases/lineage-163.json`, which
describe what all 1.63-derived builds share. Addresses cached in a profile are
compared with what discovery finds; discovery always wins.

An OS 1.63-derived build without a profile is still discovered and, when every
required site is found, patched. Features that need a profile's qualification are
refused on it, with the reason in the build report.

A base that changes the boot block or the bootstrap-rewrite routine is refused:
those are what let you recover by sending your original OS again.

## Model runtimes

Assembly models talk to the base through the `md-voice/1` interface: the DSP2
program, the ColdFire SRAM routines and the base's add-on code. Rather than trust
a version name, the engine fingerprints those three parts and looks the
combination up in `modelRuntimes` in `bases/lineage-163.json`. All three must
match one tested combination. A build that uses assembly models on a base with no
matching entry is refused with the part that differs.

Because the check is on the parts that matter, a base without a profile can still
take assembly models when its runtime matches a tested one. Its own qualification
stays *discovered*; only the model interface is reused. Every other feature is
still discovered and checked on the file you load, and the report binds the
result to that exact input.

To add a runtime, run `node engine/dist/src/cli.js --discover my-os.syx --report
report.json`, review the parts that changed, and test models on it before adding
its fingerprints. A copied hash is not a test.

## Stock OS 1.63

Stock 1.63 has no boot hook for the patch to chain onto. Kitbasher prepares it
once: it redirects the reset jump to a small hook right after the OS container
and repacks the ColdFire slot at its original length. Everything else stays
byte-identical to 1.63. The browser does this automatically when you load a
stock 1.63 file. On the command line:

```text
node engine/dist/src/cli.js --prepare-163 --in os163.syx --out os163-prepared.syx
```

## Features per base

Discovery checks each feature on the base you load: dynamic knob labels, DSP1
drive curves, menu descriptors in flash, control-all for added machines,
overload recovery, the CPU indicator, MIDI chromatic note input, pitch note names and the unmute-latency fix. A feature whose sites are not found is
switched off and reported, never guessed. To see what a base supports:

```text
node engine/dist/src/cli.js --discover my-os.syx
```

Some options also need the profile to record them as working on that base
(`options` in the profile: qualified with the evidence, or refused with the
reason):

| Option | Prepared 1.63 | X.14 | Beta 26A09 |
|---|---|---|---|
| Unmute-latency fix (`--unmute-fix`) | yes | yes | no: the beta replaces the sequencer |
| MIDI chromatic note input (`--midi-chroma`) | yes | yes | no: the beta uses its own MIDI queue |
| Pitch note names (`--pitch-labels`) | yes | yes | no: the beta uses its own TONAL labels |
| Reordered DSP2 host sender (`--host-reorder`) | no: silences output in the emulator | no: not qualified | no: not qualified |

A parity check (`engine/test/parity.test.ts`) runs with the tests: every profile
must qualify each of these options or refuse it with a reason, and the list of
refusals above is fixed there, so a new gap is a deliberate change. Every other
feature discovery reports must be on a list of features found on every base;
with your OS files (`firmwareDir`) the check also resolves each profiled base and
fails when a feature is missing on one base but not exempted. A refused option
shows the profile's reason first, then discovery's when it did not find it either.

## Unmute latency

On every 1.63-derived OS the sequencer builds each step's notes one step ahead
and leaves a muted track out of them, so a track unmuted less than about one
step before its next trig stays silent for that trig. Builds fix this by
default (`engine/src/unmute.ts`): muted tracks are queued too, and the mute is
tested when each queue is played instead. The rule is that a trig plays when its
track is unmuted on the tick that plays it: the step's tick, or for a swung trig
the swing tick (the same tick at 50% swing, up to 0.6 of a step later at 80%).
An unmute that lands before that tick plays the trig on time;
one that lands after it does not, as on a base without the fix. Muting is
unchanged, and so are MIDI machines, which keep the base's behaviour.

Five instructions of the OS's sequencer call 360 bytes of code (and 44 of data)
placed after the knob labels in their RAM range, or alone in that range when no
selected machine has labels. Discovery finds the sequencer by signature, and the
base's profile must record the fix as run on it: OS 1.63 (prepared) and X.14
have it, X.14 on hardware (plain, p-locked and swung unmutes). The DEV builds enter their own code from the sequencer's tick handler
and buffer toggle, so discovery does not find it there. Browser builds include
the fix automatically where supported. The CLI's `--no-unmute-fix` disables it; the image is then
the one a build without the fix makes.

## X.14

X.14 has its own profile and runtime entry. Two details matter to the patcher:

- X.14's add-on calls the DSP1 sender directly. Discovery finds that call as well
  as the OS's own, so DSP1 drive curves reach every track.
- X.14 uploads the DSP2 voice-retirement code twice. Clean recovery
  patches every copy, and refuses the build if any copy differs from the stock
  instructions it expects.
- [MIDI chromatic note input](MIDI-CHROMATIC.md) (`--midi-chroma`) hooks X.14's
  real-time MIDI path in its add-on. On OS 1.63 it hooks the MIDI task instead,
  with the same behaviour; DEV reads MIDI through its own queue, which it does
  not patch.

## Beta 26A09

The supported file is `md-26A09-132401-beta.syx`, tagged `BETA`, with SHA-256
`31be0d9b6ae9e6a49734909328f3dd2cb42e253c2d95e103d7489fc31a9bc6bd`.
The profile's hashes and cached patch sites come from this file; the runtime
fingerprint covers its DSP2, SRAM and all executable extension segments.

- The add-on unpacks 21 scatter pieces. The base ends at flash `0xfeb9c`,
  leaving 5,220 bytes; larger selections still have to pass the storage check.
- The base uploads 4,096 DSP2 words into `P:0x13b600..0x13c5ff` at boot.
  Discovery reserves that entire span, so added models start after `0x13c5ff`
  when placed in that region. The old DEV free-space boundary is not reused.
- DSP1's drive window starts at `P:0xa3f`; its own upload remains intact.
- The kit editor still draws a newly selected category using the previous
  category's cached length. The patch matches the beta's drawer and list-counter
  signatures and refreshes the count before drawing.

Validation on 2026-10-13 uses the bundled catalog and the exact input above:
the full-catalog UW emulator image has SHA-256
`155d0224d9517756254d770e8508606a8d34a318ce9eb7cef2efafc794edf4e6`.
It was built with the CLI's defaults and `--uw --catalog catalog`, using the
beta's OS container in a stock 1.63 flash image for the emulator. The final
profile produces exactly the same bytes as the tested candidate.

- All engine build gates pass, including readback, ISA checks, DSP placement,
  unchanged add-on/scatter contents and the discovered patch sites.
- Headless `mdLevelMeter` boots the full 25-machine UW build and plays all
  21 self-contained generators above -60 dBFS. WAVTB, WAVCH and WAVMR require
  their UW sample data; NFX4P requires input audio. Their sound is not qualified
  by this check.
- `mdIdProbe 6,13,40,74,76` passes assignment, first-hit audio, knob changes,
  kit dumps, kit save/load and a fresh boot for each ID (VADBD, FMS4O, OSCAC,
  VOXFR, PHYKS). Stock ROM/RAM IDs still assign and ROM01 still plays.
- `engine/test/beta_base.test.ts`, with `MD_FIRMWARE_DIR` pointing to a directory
  containing the original SysEx, checks fresh discovery against every cached
  site and builds both UW and non-UW selections. No firmware is committed.

Hardware validation on 2026-10-13: the owner built
`kitbasher-K.01-beta-26a09.syx` in the local Kitbasher instance, transferred it
through UM-ONE, and confirmed that it works well on the Machinedrum. The sent
SysEx SHA-256 is
`37b2ab8ad4939062589399e16a02276e80c35c85b2f64b35a488d6668ccba7fd`.
The base is therefore marked **hardware-proven**, with this owner-reported
successful flash and operation as its hardware evidence.

Detailed hardware coverage of added-model UW sample playback, external-input
effects, sustained overload/timing and visual category redraw was not recorded.
The menu-refresh hook is signature-checked and included in the emulated build.

## MDX X.20 B (public beta)

**X.20 is currently not supported.** Patching is temporarily disabled in the
browser, CLI and engine by the recipe's `refuse` field. The recipe and offline
implementation tests are retained for future re-enablement. The details below
describe that retained implementation.

X.20 B is jmamma's community OS and remains a public beta. Its loader streams a packed OS through the DSPs and
gets the ColdFire image back at boot, so nothing can be discovered in the file:
Kitbasher patches this one release with a fixed recipe, [`bases/x20.json`](../bases/x20.json),
and recognises the file by its SHA-256 (any other X.20 file is refused). The recipe
holds addresses, the bytes X.20 B has at each patch site, and hashes; no firmware bytes.

What a build changes (engine/src/x20.ts):

- **INTERNAL (E12) samples** are trimmed with the usual rule and re-encoded in
  X.20's E12B flash format; the DSP2 memory and flash they free hold the
  machines. **Sample swaps** from the Samples step go into the bank before it is
  trimmed and encoded, with the same rules as on the other bases
  ([E12 samples](SAMPLES.md#x20-b)). Once flashed, the patched OS refuses to
  rewrite the bank itself (its flash file system refuses to erase or write the
  E12B bank, and DSP2 writes into the bank are refused), because the machines'
  code lives in the space the trim frees: SDS into INTERNAL and the Sample
  Manager's INTERNAL actions fail with X.20's own error.
- **User machines (USR) keep working.** X.20 reserves machine IDs 194..209 for
  its 16 user-machine slots, and a built-in machine on 192 or 193 freezes the OS
  when assigned, and it treats 96..123 as MIDI/control machines (a model there
  plays nothing), so added machines never take 96..123 or anything above 191. The record table
  grows from 159 to 200 entries; X.20's user-machine install, remove and check
  routines reach that table and the menu through offsets from a base pointer, and
  the recipe patches them too (without that, every USR install fails with
  RECV FAIL). The +Drive machine banks keep their own erase.
- **DSP2 load.** The machines' code goes into DSP2 before DSP2's own loader runs:
  the build sends a short receiver through the bootstrap's `ELD` command, the
  code follows, and the receiver's wiper hands DSP2 back to its bootstrap. The
  dispatch words go after DSP2 starts, through the OS's own block write. Both read
  their packed chunks while X.20's loader still runs, so they read flash at its own
  address: the `0x10000000` alias the OS uses later is not mapped yet on hardware
  (reading through it froze every build on the first logo). The emulator is the
  other way round at that point, so the emulator-only upload variant reads through
  the alias; a gate checks which one each build uses. That variant also packs
  small chunks (40000 bytes): with larger ones the emulated OS sometimes missed
  DSP2's startup messages, which looked like a boot hang that came and went with
  the build's layout.
  Uploading all the code after DSP2 starts makes the OS miss DSP2's startup
  messages on hardware; `--dsp2-load upload` does it anyway, for the emulator
  only (whose DSP does not run code written through X memory). If the pre-boot
  load fails (a timeout, a checksum mismatch), the dispatch words are not written
  either, so the OS boots with its stock machines rather than jumping into
  missing code. **This path is untested on hardware for the public build**; it is
  checked offline against X.20 B's own DSP load map.
- **Menu categories.** Added machines are grouped on X.20's category pages
  under the same menu categories the other bases use (KIK, SNR, HAT, PRC, FM,
  SYN, WAV, VOX, PHY, FX, OTH): they take the user-machine path there, group by
  category and the page is titled with the category's code. Each category also
  puts its machines in one of X.20's own menu families (drums in TRX, FM in EFM,
  effects in NFX, the rest in GND). `--family-menus` builds without the category
  pages, with X.20's families as the layout's categories (as earlier builds did).
- **Unmute fix.** In MUTE mode a TRIG key acts on press (stock X.20 B toggles the
  mute on release) and the sequencer's mute word changes at once (stock waits for
  its next message drain), so an unmute just before a trig plays it. On by default;
  `--no-unmute-fix` leaves X.20's behaviour.
- **Dynamic knob labels.** Machines whose packs give dynamic labels show the
  captions of their current MODE: the parameter page's record lookup goes through
  a routine that overlays them (caption data in E12B flash, read only by the UI
  task). `--no-dyn-labels` keeps the static labels.
- **Class-mask fix**, only when an added machine takes 88..95: X.20 classifies
  machines with mask and range tests that would read such an ID as an INP, MIDI
  or control machine; those 15 sites call routines that give X.20's own result for
  every other ID. The machine-title fix (no ROM number after the name of an added
  machine on 128..159 or 176..191) is in the recipe too, for when its usable IDs
  reach that range; today they do not.
- **Class handler fetch.** The parameter handler lookup goes through a routine:
  X.20's own table for its classes, the knob callback for added machines (an
  earlier build copied X.20's table into its own RAM at boot instead).

On the page an X.20 B file goes through the same steps as the other bases. Its
plan (`planX20`, the same selection, trim and DSP2 placement the build does,
without packing) drives the meters: DSP2 words at the chosen E12 trim, machine IDs
(the recipe's usable ones; below 128 without UW), the new-machine list, and the
machine records (at most X.20's stock cap of 159 for its own machines, plus one
per added machine, against the 200 the build allows). Firmware storage is the
E12B flash the trim frees, checked by a background build as on the other bases.
Auto trim finds the gentlest threshold whose placement fits.

The layout editor shows the menu categories (KIK, SNR, HAT, ...; with
`--family-menus`, X.20's families GND, TRX, EFM, NFX) as fixed categories: a
machine moves between them, but categories cannot be added, renamed or
reordered, and the order within a category is not set (the recipe sets each
machine's category only). A layout from an earlier X.20 build (families as
categories) gives each machine its sound category. IDs follow the layout where X.20 gives them out (a
usable ID, below 128 without UW, not taken); the others move to the lowest free
one and the page lists the move. Every build carries its layout as the same
md-layout/1 table the 1.63-lineage bases use, in E12B flash after the
new-machine list, so dropping a Kitbasher X.20 build restores its IDs and
families; layout files and projects (which name X.20 B by its file hashes) save
and load as on the other bases.

Not available on X.20 (shown turned off on the page, with the reason): MIDI
chromatic input and pitch note names. Reusing the
stock INP IDs 80..85 is not offered: the VALID hook decides per ID, so it cannot
hide the stock INP machine on an ID while one of ours takes it. DSP1 is not patched: X.20's DSP1
bootstrap runs a `PFLUSH` on an `ELD` with its instruction cache off, which is an
illegal instruction on real hardware, so any DSP1 change needs another route.

Gates, all hard failures: the file's hash; every ColdFire instruction the build
adds, in its own routines and at every OS and loader site, decodes as ISA_A
(MCF5206e: the emulators run 68k forms such as `btst #n,abs.l` and
`move.l #imm,d16(An)` that the CPU traps on); the DSP boot code holds no cache
instruction; boot-time chunk reads use flash's own address (the alias only in the
emulator-only upload variant). The file's hash pins the OS; the recipe's anchors
are checked offline against a decoded X.20 B image (`KB_X20_OS`, see [Testing](TESTING.md)).

## Machinedrum without UW

The same OS files run on a Machinedrum with and without the UW option. At boot
the OS reads which one it is on and, without UW, takes the ROM and RAM machine
categories out of the machine-select menu. The same boot step counts the
categories and records, for every machine, which category and place the
machine menu opens on.

- Stock 1.63 and the DEV builds drop the *last two* categories. With added
  categories after the base's own, that would hide two of them and show ROM and
  RAM, which play nothing without UW.
- X.14 moves the categories after ROM and RAM down over them, but only after
  recording where each machine is, so the menu would open on the wrong category
  for every added machine (and NFX).

Every build therefore adds a short routine that, on a unit without UW, removes
ROM and RAM from its menu table *before* the base counts the categories, and
turns the base's own step off. The menu then shows the base's categories
without ROM and RAM followed by yours, and opens on the right one. The
`uw-menu` check in the build report names the routine and the base's step it
replaced; a build for a Machinedrum without UW fails if the base's step is not
found.

Two things need a UW Machinedrum, so the page asks first: *Does your
Machinedrum have the UW option?* There are two answers, Yes and No, and one
line under them says how to check (a UW unit's machine menu has ROM and RAM).
Nothing is pre-selected, and the page does not leave the first step, check,
build or download until you click one in this visit: the answer is not
remembered in the browser, and a restored layout, project or `.syx` that
records one only shows a hint ("This layout was saved for a Machinedrum with
UW") without answering for you. The engine's `build` refuses to run without an
explicit `uw` (true or false); a layout's own `uw` does not count. The answer
is saved as `uw` in layout and project files and in the layout table of the OS
it builds. With a No:

- **No machine IDs of 128 and up.** Without UW the OS takes 128 off any machine
  ID of 128 or more, so a machine there would be selected as another, empty one.
  New IDs stay below 128; a machine a restored session puts at 128 or above
  (OSCPW was on 175 in earlier builds) moves to the lowest free ID below 128, and
  the page, the ID map and the build report show the move. The build fails,
  saying so, only if no ID below 128 is left. On the command line: `--no-uw`.
- **No models that play a UW sample** (marked *needs UW* on the page; WAVTB,
  WAVCH and WAVMR today). They cannot be selected; `--no-uw` leaves them out and
  names them.
- The ID map hatches 128 and up as unusable, and the menu preview shows your
  categories where ROM and RAM would be.

With a Yes nothing changes.

## Machine IDs

Saved kits find machines by ID. Kitbasher gives each selected model the lowest
free ID, in menu order: the same selection on the same OS, with the same UW
answer and the same menu layout, always gets the same IDs. A model's pack no
longer fixes its ID.

**This changed in October 2026.** Earlier builds put some models on fixed IDs
(OSCPW 175, WAVTB 124, OSC8B 126, VOXVO 127, WAVCH 6, FMSSW 10, FMS2O 11,
FMS3O 12, OSCSW 13, OSCCH 14, WAVMR 30) and the rest after them. To keep kits
made with an earlier build working, restore that build's IDs on the first
step, under *Restore an earlier layout* (a Kitbasher build dropped as the OS
file is read the same way; the page then asks for the stock OS it was built on):

- drop the **.syx you flashed** (or the .bin): Kitbasher reads the layout table
  every build carries, or, failing that, the machines it added, matched to the
  catalog by their names now or before the October 2026 rename (the page names
  any it does not know, and keeps their IDs free);
- or your **project file** or **layout file**.

Every machine the restored session names keeps its ID; models it does not name
take free IDs. Machines of the session that you do not select now keep their
IDs reserved, so a later build that selects them again finds them free; only
when no other ID is left is one given to a new model, and the build report says
so. A session made for another OS is applied to the one you load: machines keep
their IDs where that OS has them free, and the others move (each move is
listed). On the command line: `--restore <file>`. Exactly one of
`--uw` or `--no-uw` is required for every build; a restored session's UW answer
is reported but never used in its place.

## Adding a base

To request support for another OS build, open a
[base support request](../.github/ISSUE_TEMPLATE/base_support.yml). A new
profile needs the build's slot hashes and a clean discovery report. An image
built from it that boots and plays on hardware moves it to *tested on hardware*.
