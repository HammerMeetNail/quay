import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css = readFileSync(new URL('../../src/next/styles.css', import.meta.url), 'utf8');
const luminance = hex => {
  const values = hex.slice(1).match(/../g).map(v => parseInt(v,16)/255).map(v => v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return .2126*values[0]+.7152*values[1]+.0722*values[2];
};
const ratio=(a,b)=>{const [high,low]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(high+.05)/(low+.05);};
const blocks = [css.slice(css.indexOf('{')+1, css.indexOf('}')), css.split('.pf-v6-theme-dark .qn-app')[1].split('{')[1].split('}')[0]];
for (const [index, block] of blocks.entries()) {
  const tokens = Object.fromEntries([...block.matchAll(/(--qn-[\w-]+): (#[a-f0-9]{6});/g)].map(m=>[m[1],m[2]]));
  for (const role of ['text','muted','accent','public','private','favorite','danger']) test(`${index ? 'dark' : 'light'} ${role} palette pairs meet normal-text contrast`, () => {
    for(const surface of ['canvas','surface','raised','selected']) assert.ok(ratio(tokens[`--qn-${role}`],tokens[`--qn-${surface}`])>=4.5, `${role}/${surface}`);
  });
  test(`${index ? 'dark' : 'light'} primary action contrast`,()=>assert.ok(ratio(tokens['--qn-accent'],tokens['--qn-on-accent'])>=4.5));
  test(`${index ? 'dark' : 'light'} control boundary contrast`,()=>assert.ok(ratio(tokens['--qn-control-border'],tokens['--qn-surface'])>=3));
}
// Palette math alone is not a rendered-component or WCAG conformance check.
