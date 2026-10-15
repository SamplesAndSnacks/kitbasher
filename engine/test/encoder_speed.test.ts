import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encoderSettingsCode, encoderSettingsPatches, findEncoderSettings, type EncoderSettings } from '../src/encoder_speed.js';
import { Cpu } from './cf_interp.js';
import { encodeProject, decodeProject } from '../src/project.js';

const S:EncoderSettings={slot:0x700000,settings:0x701003,page:0x702000,modal:0x702004,up:0x210300,down:0x210400,draw:0x210000,edit:0x210100,speed:0x210200,panel:0x220000,text:0x220100,rect:0x220200,surface:0x710000,font:0x240000};
const code=encoderSettingsCode(S,0x100e0000);
test('projects round-trip the option and reject invalid values',async()=>{
  const p={os:{base:'x14',name:'X.14',tag:'X14 ',coldfire_sha256:'a',dsp2_sha256:'b',dsp1_sha256:'c'},swaps:new Map(),sources:new Map(),noTrim:new Set<number>(),trim:{mode:'auto' as const,db:-30,cap:.55},models:['VADBD'],layout:null};
  const off=await encodeProject(p);assert.equal(off.encoder_settings,undefined);
  const on=await encodeProject({...p,encoderSettings:true});assert.equal(on.encoder_settings,true);
  assert.equal((await decodeProject(JSON.stringify(on))).encoderSettings,true);
  for(const bad of [false,1,'on'])await assert.rejects(decodeProject(JSON.stringify({...on,encoder_settings:bad})),/encoder_settings must be true/);
});
function cpu() {
  const c=new Cpu(); c.load(0x100e0000,code.bytes);
  c.stubs.set(S.panel,()=>{});c.stubs.set(S.rect,()=>{});c.stubs.set(S.text,()=>{});
  return c;
}
test('emitted speed code swaps 1x/7x for every data encoder and LEVEL, direction and global slot, preserving other registers',()=>{
  const c=cpu();
  for(let slot=0;slot<8;slot++)for(const reverse of [false,true])for(let knob=0;knob<10;knob++)for(const scale of [1,7,4,2])for(const delta of [-127,-4,-1,0,1,4,127]){
    c.w8(S.slot,slot);for(let j=0;j<8;j++)c.w8(S.settings+178*j,(j===slot?reverse:!reverse)?65:1);
    c.d.set([delta,0x12345678,0x11223344,knob,44,55,66,77]);
    c.a.set([0x111000,0x222000,0x333000,0x703000,0x555000,0x666000,0x777000,0xf00000]);c.w32(c.a[3],scale);
    const d=[...c.d],a=[...c.a];c.call(code.labels.speed);
    const factor=reverse&&knob<9&&(scale===1||scale===7)?8-scale:scale;
    assert.equal(c.d[0],delta*factor);assert.equal(c.d[2],127);
    assert.deepEqual([...c.d].filter((_,i)=>i!==0&&i!==2),d.filter((_,i)=>i!==0&&i!==2));assert.deepEqual([...c.a],a);
    assert.equal(c.z,false);assert.equal(c.n,false);
  }
});
test('LFO setup keeps native speeds and leaving restores the saved mode on both firmware ABIs',()=>{
  const c=cpu();
  for(const stock of [false,true])for(let slot=0;slot<8;slot++)for(const reverse of [false,true])for(let knob=0;knob<10;knob++)for(const scale of [1,7,4,2])for(const delta of [-1,1]){
    c.w8(S.slot,slot);c.w8(S.settings+178*slot,reverse?65:1);
    // Page 0 includes normal SYNTHESIS/EFFECTS/ROUTING; 30 is dedicated LFO.
    // Enter and leave without changing the global setting, then check neighbors.
    for(const page of [0,30,0,29,31,54]){
      c.w32(S.page,page);
      c.d.set([delta,stock?knob:0x12345678,0x11223344,stock?4*knob:knob,44,55,66,77]);
      c.a.set([0x720000,0x222000,0x333000,0x703000,0x555000,0x666000,0x777000,0xf00000]);
      c.w32(stock?c.a[0]+1720:c.a[3],scale);
      const d=[...c.d],a=[...c.a];c.call(code.labels[stock?'stock_speed':'speed']);
      const factor=page!==30&&reverse&&knob<9&&(scale===1||scale===7)?8-scale:scale;
      assert.equal(c.d[0],delta*factor,JSON.stringify({stock,slot,reverse,knob,scale,delta,page}));
      assert.equal(c.d[2],stock?scale:127);
      assert.deepEqual([...c.d].filter((_,i)=>i!==0&&i!==2),d.filter((_,i)=>i!==0&&i!==2));
      assert.deepEqual([...c.a],a);assert.equal(c.r8(S.settings+178*slot),reverse?65:1);
      assert.equal(c.r32(S.page),page);
    }
  }
});

test('native settings editor changes only the requested bit and slot; resolution and reverse are independent',()=>{
  const c=cpu();let panel=0;c.stubs.set(S.panel,()=>panel++);
  for(let slot=0;slot<8;slot++)for(const initial of [0,1,64,65])for(const row of [0,1])for(const delta of [-1,0,1]){
    c.w8(S.slot,slot);for(let j=0;j<8;j++)c.w8(S.settings+178*j,j===slot?initial:65);
    c.w32(S.draw+8,row);const before=panel;c.call(code.labels.edit,[delta]);
    const bit=row?64:1,expected=delta===0?initial:(initial&~bit)|(delta>0?bit:0);
    assert.equal(c.r8(S.settings+178*slot),expected);assert.equal(panel-before,delta===0?0:1);
    for(let j=0;j<8;j++)if(j!==slot)assert.equal(c.r8(S.settings+178*j),65);
  }
});
test('stock 1.63 speed hook uses the native encoder index and preserves its address and stride registers',()=>{
  const c=cpu();
  for(const reverse of [false,true])for(let knob=0;knob<10;knob++)for(const scale of [1,7,4])for(const delta of [-1,1]){
    c.w8(S.settings,reverse?64:0);c.d[0]=delta;c.d[1]=knob;c.d[3]=4*knob;
    c.a[0]=0x720000;c.a[3]=0x123456;c.w32(c.a[0]+1720,scale);
    c.call(code.labels.stock_speed);
    assert.equal(c.d[0],delta*(reverse&&knob<9&&(scale===1||scale===7)?8-scale:scale));
    assert.equal(c.d[1],knob);assert.equal(c.d[2],scale);assert.equal(c.d[3],4*knob);
    assert.equal(c.a[0],0x720000);assert.equal(c.a[3],0x123456);
  }
});
test('draw shows saved choices and resets the row without changing settings',()=>{
  for(const initial of [0,1,64,65]){
    const c=cpu(),strings:string[]=[];c.w8(S.settings,initial);
    c.stubs.set(S.text,c=>{let at=c.arg(5),s='';while(c.r8(at))s+=String.fromCharCode(c.r8(at++));strings.push(s);});
    c.call(code.labels.draw);assert(strings.includes(initial&1?'32':'24'));assert(strings.includes(initial&64?'ON':'OFF'));
    assert.deepEqual(strings,['KNOB RESOLUTION:',initial&1?'32':'24','SWAP SPEEDS:',initial&64?'ON':'OFF']);assert.equal(c.r32(S.draw+8),0);assert.equal(c.r8(S.settings),initial);
  }
});
test('hook writes preserve the following instruction and refuse unknown firmware',()=>{
  const bytes=new Uint8Array(0x500).fill(0x71),images=[{what:'synthetic',ram:0x210000,bytes}];
  const p=encoderSettingsPatches(images,S,code.labels);assert.equal(p.patches.length,10);
  for(let i=1;i<p.patches.length;i+=2)assert.equal(p.patches[i][1]&0xffff,0x7171);
  assert.throws(()=>findEncoderSettings(images),/expected one signature/);
});

test('arrows select rows only on the mechanics page, preserving native handlers elsewhere',()=>{
  for(const name of ['up','down'])for(const page of [0,10,53,54,55])for(const modal of [0,1,2]){
    const c=cpu();let native=0,draws=0;
    c.w32(S.page,page);c.w32(S.modal,modal);c.w32(S.draw+8,9);c.w8(S.settings,65);
    c.stubs.set((name==='up'?S.up:S.down)+6,c=>{native++;assert.equal(c.d[0],modal);assert.equal(c.z,modal===0);});
    c.stubs.set(S.rect,()=>draws++);
    const d=[...c.d].slice(2),a=[...c.a];c.call(code.labels[name]);
    const active=page===54&&modal===0;
    assert.equal(native,active?0:1);assert.equal(draws,active?2:0);
    assert.equal(c.r32(S.draw+8),active?(name==='up'?0:1):9);assert.equal(c.r8(S.settings),65);
    assert.deepEqual([...c.d].slice(2),d);assert.deepEqual([...c.a].slice(1),a.slice(1));
  }
});

test('stock arrows rejoin the event dispatcher epilogue with its stack intact',()=>{
  const stock=encoderSettingsCode({...S,arrowDone:0x230000},0x100e0000);
  for(const name of ['up','down']){
    const c=cpu();c.load(0x100e0000,stock.bytes);c.w32(S.page,54);let done=0;
    c.stubs.set(0x230000,c=>{done++;assert.equal(c.arg(0),0x1234);});
    c.call(stock.labels[name],[0x1234]);assert.equal(done,1);assert.equal(c.r32(S.draw+8),name==='up'?0:1);
  }
});
