// Reverse Encoder Speed in GLOBAL > CONTROL > MECH SETTINGS.
// Bit 6 of the existing mechanical-settings byte is unused by the panel resolution
// command (which masks with 3), and is retained by global SysEx/save/load. No new RAM.
import { Asm } from './cf_asm.js';
import { be32, concat, equal, h, u32 } from './bytes.js';
import { findSig, reader, type CodeImage } from './sig.js';
import { decodeLinear } from './isa.js';

export const REVERSE_ENCODER_BIT = 64;
export interface EncoderSettings {
  slot: number; settings: number; page: number; modal: number;
  up: number; down: number;
  draw: number; edit: number; speed: number; panel: number;
  text: number; rect: number; surface: number; font: number;
  stockSpeed?: boolean;
  arrowDone?: number;
}
const one = (images: CodeImage[], sig: string) => {
  const hits = findSig(images, sig);
  if (hits.length !== 1) throw new Error(`Reverse Encoder Speed: expected one signature, found ${hits.length}: ${sig}`);
  return hits[0];
};
/** Discover all hooks and the native settings ABI. An unfamiliar base is refused. */
export function findEncoderSettings(images: CodeImage[]): EncoderSettings {
  const edit = one(images, '@edit 2f03 2f02 226f000c 4a89 675e 1439 <slot> 49c2 2202 e589 2002 ed88 9081 9082 2200 e589 9280 d282 41f9 <settings> 10301801 49c0 2600 d689 6a04 4283 6008 7001 b083 6c02 7601 2202 e589 2002 ed88 9081 9082 2200 e589 9280 d282 41f9 <settings2> 11831801 4eb9 <panel> 4eba .... 241f 261f 4e75');
  const draw = one(images, '@draw 2f0a 4879 ........ 4878ffff 4878001e 48780006 4879 <surface> 4879 <font> 45f9 <text> 4e92 4879 <title> 4878ffff 4878001e 4878001d 4879 <surface2> 4879 <font2> 4e92 4fef0030 4eba .... 245f 4e75');
  const paint = one(images, '2f02 42a7 48780023 48780069 4878001d 4878005f 4879 <surface> 4eb9 <rect> 1439 <slot>');
  const fast = findSig(images, '47ea06b8 @speed 4c130800 747f d190');
  const stockSpeed = fast.length === 0;
  const speed = stockSpeed ? one(images,'2601 e58b 2043 d1f9 ........ @speed 242806b8 4c020800 d1a80690')
    : one(images, '47ea06b8 @speed 4c130800 747f d190');
  // Ordinary physical presses use 7, then page setup copies this byte into the
  // active multiplier. X.14 also has a separate 4x path; that is not this speed.
  const pressed=one(images,'41f9 <scales> 7407 118298b0 2803 e78c');
  one(images,`41f9 ${h(pressed.caps.scales.value).slice(2).padStart(8,'0')} 7201 118108b0`);
  // LEVEL has its own switch handler and the ninth entry of the same table.
  const levelScale=h(pressed.caps.scales.value+8).slice(2).padStart(8,'0');
  one(images,`7401 13c2 ${levelScale} 6008 7607 13c3 ${levelScale}`);
  const arrow = (mask:string) => one(images, `206f0004 4280 10280008 7264 b280 647a 7278 b280 6722 2039 <keys> 4a80 660e 7067 23c0 ........ 2039 <keys2> 72${mask} 8280 23c1 <keys3> @nav 2039 <modal> 4a80 662e 2039 <page> 4a80 6670`);
  const up=stockSpeed?one(images,'2039 <keys> 7804 8084 23c0 <keys2> @nav 2039 <modal> 676e'):arrow('04');
  const down=stockSpeed?one(images,'2039 <keys> 7608 8083 23c0 <keys2> @nav 2039 <modal> 676e'):arrow('08');
  const c = (hit: typeof edit, name: string) => hit.caps[name].value;
  const read = reader(images);
  let page:number, arrowDone:number|undefined;
  if(stockSpeed) {
    const pageLoad=read(up.caps.nav.at+118,10), other=read(down.caps.nav.at+118,10);
    if(!pageLoad||!other||!equal(pageLoad,other)||pageLoad[0]!==0x20||pageLoad[1]!==0x39||u32(pageLoad,6)!==0x670004ea) throw new Error('Unfamiliar stock arrow dispatcher');
    page=u32(pageLoad,2);
    arrowDone=one(images,'2039 ........ 6708 5380 23c0 ........ 4cd71cfc 4fef0024 4e75').at;
  } else {
    page=c(up,'page');
    if(page!==c(down,'page')) throw new Error('Inconsistent arrow pages');
  }
  const title = new TextEncoder().encode('KNOB RESOLUTION:\0');
  if (!equal(read(c(draw, 'title'), title.length)!, title) || c(edit,'settings') !== c(edit,'settings2') ||
      c(draw,'surface') !== c(paint,'surface') || c(edit,'slot') !== c(paint,'slot')) throw new Error('Reverse Encoder Speed: inconsistent mechanical settings');
  // Verify that bit 6 never reaches the panel MCU's resolution command.
  one(images, `41f9 ${h(c(edit,'settings')).slice(2).padStart(8,'0')} 10301801 7403 c082 7202 b280 6718 b480 671a`);
  // Global import and export retain the byte, including bit 6, with the 7-bit mask.
  one(images, `41f9 ${h(c(edit,'settings')).slice(2).padStart(8,'0')} 14304801 45f9 ........ 707f c082 1380a800`);
  if(c(up,'modal')!==c(down,'modal')) throw new Error('Inconsistent arrow handlers');
  return { slot:c(edit,'slot'), settings:c(edit,'settings')+1, page, arrowDone, modal:c(up,'modal'),
    up:up.caps.nav.at, down:down.caps.nav.at,
    edit:edit.at, draw:draw.at, speed:speed.caps.speed.at, stockSpeed, panel:c(edit,'panel'),
    text:c(draw,'text'), rect:c(paint,'rect'), surface:c(draw,'surface'), font:c(draw,'font') };
}

export function encoderSettingsCode(s: EncoderSettings, org: number) {
  const a = new Asm(org), i = (op:string,...args:string[]) => a.i(op,...args);
  const abs = (n:number) => `${h(n)}.l`;
  // The replaced renderer's body is dead RAM. Reclaim four bytes for a cursor,
  // initialized on every entry; no native global or saved setting is borrowed.
  const row=abs(s.draw+8);
  for(const [name,site,value] of [['up',s.up,0],['down',s.down,1]] as const) {
    a.label(name);
    // Enter after native press/repeat bookkeeping; releases keep their own path.
    i('move.l',abs(s.modal),'d0'); i('bne.b',name+'_native');
    i('move.l',abs(s.page),'d0'); i('cmpi.l','#54','d0'); i('bne.b',name+'_native');
    i('moveq',`#${value}`,'d0'); i('move.l','d0',row);
    if(s.arrowDone!==undefined) { i('bsr.w','redraw'); i('jmp',abs(s.arrowDone)); }
    else i('bra.w','redraw');
    a.label(name+'_native'); i('move.l',abs(s.modal),'d0'); i('jmp',abs(site+6));
  }
  // a0 = address of the mechanical-settings byte for the active global slot.
  a.label('setting');
  i('clr.l','d1'); i('move.b',abs(s.slot),'d1');
  i('move.l','d1','d2'); i('lsl.l','#2','d2');
  i('move.l','d1','d0'); i('lsl.l','#6','d0'); i('sub.l','d2','d0'); i('sub.l','d1','d0');
  i('move.l','d0','d2'); i('lsl.l','#2','d2'); i('sub.l','d0','d2'); i('add.l','d1','d2');
  i('lea',abs(s.settings),'a0'); i('adda.l','d2','a0'); i('rts');
  a.label('speed');
  // Replaces muls.l (a3),d0; moveq #127,d2. d3 is the encoder index.
  // Include the eight data-entry knobs and LEVEL; leave sound selection intact.
  i('lea','-16(a7)','a7'); i('movem.l','d1/a0-a1','(a7)'); i('move.l','d0','12(a7)');
  i('move.l','(a3)','a1'); i('cmpi.l','#9','d3'); i('bcc.b','multiply');
  // Native LFO setup (FUNCTION + SYNTHESIS/EFFECTS/ROUTING) keeps its speeds.
  // The regular ROUTING parameter page is page 0, so it still honors the mode.
  i('move.l',abs(s.page),'d1'); i('cmpi.l','#30','d1'); i('beq.b','multiply');
  i('bsr.w','setting'); i('move.b','(a0)','d1'); i('btst','#6','d1'); i('beq.b','multiply');
  i('move.l','a1','d1'); i('cmpi.l','#1','d1'); i('beq.b','reverse');
  i('cmpi.l','#7','d1'); i('bne.b','multiply');
  a.label('reverse'); i('moveq','#8','d2'); i('sub.l','d1','d2'); i('move.l','d2','a1');
  a.label('multiply'); i('move.l','12(a7)','d0'); i('move.l','a1','d2');
  a.bytes('multiply_instruction',[0x4c,0x02,0x08,0x00]); // muls.l d2,d0 (ISA_A)
  i('movem.l','(a7)','d1/a0-a1'); i('lea','16(a7)','a7'); i('moveq','#127','d2'); i('rts');
  a.label('stock_speed');
  i('lea','-8(a7)','a7'); i('movem.l','d3/a3','(a7)');
  i('move.l','d1','d3'); i('lea','1720(a0)','a3'); i('bsr.w','speed');
  i('movem.l','(a7)','d3/a3'); i('lea','8(a7)','a7'); i('move.l','1720(a0)','d2'); i('rts');
  a.label('edit');
  i('lea','-12(a7)','a7'); i('movem.l','d2-d3/a2','(a7)');
  i('move.l','16(a7)','d3'); i('tst.l','d3'); i('beq.b','edited');
  i('bsr.w','setting'); i('clr.l','d0'); i('move.b','(a0)','d0');
  i('tst.l',row); i('bne.b','edit_reverse');
  i('moveq','#-2','d1'); i('and.l','d1','d0'); i('tst.l','d3'); i('bmi.b','store');
  i('moveq','#1','d1'); i('or.l','d1','d0'); i('bra.b','store');
  a.label('edit_reverse'); i('move.l','#191','d1'); i('and.l','d1','d0');
  i('tst.l','d3'); i('bmi.b','store'); i('moveq','#64','d1'); i('or.l','d1','d0');
  a.label('store'); i('move.b','d0','(a0)'); i('jsr',abs(s.panel));
  a.label('edited'); i('bsr.w','redraw'); i('movem.l','(a7)','d2-d3/a2'); i('lea','12(a7)','a7'); i('rts');
  a.label('draw');
  i('clr.l',row);
  a.label('redraw');
  i('lea','-12(a7)','a7'); i('movem.l','d2-d3/a2','(a7)');
  // Clear just the content area, leaving the global dialog's border/title intact.
  i('clr.l','-(a7)'); i('pea','52.w'); i('pea','118.w'); i('pea','3.w'); i('pea','3.w');
  i('pea',abs(s.surface)); i('jsr',abs(s.rect)); i('lea','24(a7)','a7');
  i('bsr.w','setting'); i('clr.l','d3'); i('move.b','(a0)','d3');
  const text = (label:string,x:number,y:number) => {
    i('pea',`@${label}`); i('pea','65535.w'); i('pea',`${y}.w`); i('pea',`${x}.w`);
    i('pea',abs(s.surface)); i('pea',abs(s.font)); i('jsr',abs(s.text)); i('lea','24(a7)','a7');
  };
  text('resolution',13,34); i('btst','#0','d3'); i('bne.b','res32'); text('r24',99,34); i('bra.b','res_done');
  a.label('res32'); text('r32',99,34); a.label('res_done');
  text('reverse_label',13,22);
  // Native font advances four pixels: align ON and OFF to the resolution value.
  i('btst','#6','d3'); i('bne.b','on'); text('off',95,22); i('bra.b','on_done');
  a.label('on'); text('enabled',99,22); a.label('on_done');
  const highlight=(x0:number,y0:number,x1:number,y1:number)=>{
    i('pea','65535.w'); i('pea',`${y1}.w`); i('pea',`${x1}.w`); i('pea',`${y0}.w`); i('pea',`${x0}.w`);
    i('pea',abs(s.surface)); i('jsr',abs(s.rect)); i('lea','24(a7)','a7');
  };
  i('tst.l',row); i('bne.b','reverse_selected'); highlight(97,33,111,40); i('bra.b','selected');
  a.label('reverse_selected'); highlight(92,21,111,28); a.label('selected');
  i('movem.l','(a7)','d2-d3/a2'); i('lea','12(a7)','a7'); i('rts');
  a.label('code_end');
  for (const [name,value] of Object.entries({resolution:'KNOB RESOLUTION:',r24:'24',r32:'32',reverse_label:'SWAP SPEEDS:',off:'OFF',enabled:'ON'})) a.bytes(name,new TextEncoder().encode(value+'\0'));
  a.align(4);
  const code = a.assemble();
  const decoded = decodeLinear(code.bytes.subarray(0,code.labels.code_end-org),org);
  if (decoded.some(x=>!x.ok)) throw new Error('Reverse Encoder Speed: non-ISA_A code: '+decoded.filter(x=>!x.ok).map(x=>JSON.stringify(x)).join('; '));
  return code;
}

export function encoderSettingsPatches(images: CodeImage[], s:EncoderSettings, labels:Record<string,number>) {
  const read=reader(images), patches:[number,number][]=[], checks:[number,number][]=[], ranges:[number,number][]=[];
  for(const [at,name,opcode] of [[s.draw,'draw',0x4ef9],[s.edit,'edit',0x4ef9],[s.up,'up',0x4ef9],[s.down,'down',0x4ef9],[s.speed,s.stockSpeed?'stock_speed':'speed',0x4eb9]] as const) {
    const before=read(at,8); if(!before) throw new Error('Missing encoder hook');
    const next=concat([Uint8Array.of(opcode>>>8,opcode&255),be32(labels[name]),at===s.speed&&s.stockSpeed?Uint8Array.of(0x4e,0x71):before.subarray(6)]);
    for(let k=0;k<8;k+=4){patches.push([at+k,u32(next,k)]);checks.push([at+k,u32(before,k)]);}
    ranges.push([at,at+(at===s.speed&&s.stockSpeed?8:6)]);
  }
  return {patches,checks,ranges};
}
