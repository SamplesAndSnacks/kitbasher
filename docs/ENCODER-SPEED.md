# Swap Speeds

Browser builds automatically add a **Swap Speeds** mode on supported firmware
to **GLOBAL → CONTROL → MECH SETTINGS**, alongside knob resolution.

- **OFF:** turn normally for the existing fine speed; press and turn for 7× speed.
- **ON:** turn normally for 7× speed; press and turn for the existing fine speed.
- **UP/DOWN** selects Knob Resolution or Swap Speeds.
- **LEFT/RIGHT** changes the selected setting (24/32 or OFF/ON).

Both settings use a single line, with values aligned on the right. The selected
value is highlighted; the page has no navigation footer.

The mode is saved separately in each global slot. Old global settings start
with it off. Changing this mode does not alter encoder direction, parameter
ranges, kit data, or press-to-lock events. It applies to the eight data-entry
encoders and LEVEL; sound selection keeps its existing behavior.

The public builder includes this setting only when all of its instruction
signatures match. X.14 and prepared stock 1.63 are supported. X.20 is not yet
supported. The CLI uses `--encoder-settings`; `--no-encoder-settings` overrides
a restored project's choice. Browser projects record that the setting is included;
older projects also receive it when restored in the browser. The instrument's
global slot holds the actual ON/OFF value.

## Private images

The same engine module can add the menu to a private image already built with
Kitbasher. Compile the engine first (`npm run typecheck`), then run:

```text
node ci/add_encoder_settings.mjs STOCK-X14.bin BUILT-PRIVATE.bin NEW-OUTPUT-DIRECTORY
```

The output directory must be new. This produces `candidate.bin`,
`Reverse-Encoder-Speed.syx`, and a hash/patch receipt in `report.json`.
It preserves every existing sound, sample, boot-copy source and boot-patch
entry. The private loader's startup successor is retained. If the existing
patch table is at the end of the OS, it extends that table; otherwise it
appends a replacement table. Builds without enough OS flash or with conflicting
encoder hooks are refused. It does not replace a locked release or send MIDI.

## Implementation and checks

`engine/src/encoder_speed.ts` discovers the mechanical-settings renderer,
setter, global slot and storage, and the native speed multiplication. Bit 6
of the existing mechanical-settings byte holds the mode; the resolution
command masks with 3, and the global export retains all seven data bits.
A transient row cursor reuses four bytes of the replaced renderer body and
resets on page entry. Arrow hooks run after native press/repeat bookkeeping;
other pages and key releases retain their original handlers.
There is no new persistent structure or RAM allocation. Generated code runs
from the runtime flash alias, reached only by the UI and encoder handler.

The routine reverses multipliers 1 and 7 at turn time, leaving physical press
events and other multipliers alone. The encoder index includes LEVEL and excludes
sound selection. Separate adapters cover the X.14 and stock 1.63 register ABIs.
Hook writes are checked for conflicts and read back; the generated code is
decoded as MCF5206e ISA_A before use. Public builds also run the whole-image
ISA and boot gates.

`engine/test/encoder_speed.test.ts` executes the emitted instructions with
dirty registers across all global slots, encoder indices, directions and both
modes; checks the settings editor, display strings and project round-trip.
Hardware validation is still required; emulator checks do not constitute a
hardware result.

## Press-speed regression

The first candidate incorrectly treated the native pressed speed as 4x. The
physical encoder handler actually stores 7 in its speed table on press and 1
on release, then page setup copies that value into the active multiplier.
That left pressed turns at 7x while only unpressed turns changed to 4x.
The corrected hook swaps 1 and 7. Qualification now checks both native
press/release assignments, and other multipliers (including 4) stay unchanged.
Regression validation must send physical encoder switch row packets before
turn packets, then measure parameter changes; supplying a multiplier directly
to the instruction test alone does not establish press-and-turn behavior.
