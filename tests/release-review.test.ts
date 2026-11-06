import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {bindReleaseWorkspace} from '../src/releases/ui';

test('review checkbox preserves prepared details; editing a field invalidates them',()=>{
  const {document,window}=parseHTML(`<html><body>
    <input id="rel-name" value="agent.manager.eth"/>
    <div id="rel-pending"><pre>Reviewed deployment details</pre>
      <label><input id="rel-review" type="checkbox"/>I reviewed this deployment</label>
      <button id="rel-send">Sign reviewed request</button>
    </div>
  </body></html>`);
  const previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'document',{configurable:true,value:document});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem(){},getItem(){return null;}}});
  try{
    let renders=0;
    bindReleaseWorkspace({config:{owner:'0x1111111111111111111111111111111111111111',subject:'0x2222222222222222222222222222222222222222',rpc:'https://example.invalid',targets:[]},busy:false,render:()=>{renders++;},task:async()=>{},send:async()=>{throw new Error('Unexpected wallet action');},deploy:async()=>{throw new Error('Unexpected deployment');},sign:async()=>{throw new Error('Unexpected signature');}});
    const checkbox=document.getElementById('rel-review') as unknown as HTMLInputElement;
    checkbox.checked=true;
    checkbox.dispatchEvent(new window.Event('change',{bubbles:true}));
    assert.equal(renders,1,'Checkbox review updates the UI');
    assert.ok(document.getElementById('rel-pending'),'Bubbled checkbox change must not remove prepared details');
    assert.ok(document.getElementById('rel-send'),'Signing control remains available');
    const name=document.getElementById('rel-name') as unknown as HTMLInputElement;
    name.value='different.manager.eth';
    name.dispatchEvent(new window.Event('change',{bubbles:true}));
    assert.equal(document.getElementById('rel-pending'),null,'Editing configuration requires a fresh review');
  }finally{
    if(previousDocument)Object.defineProperty(globalThis,'document',previousDocument);else Reflect.deleteProperty(globalThis,'document');
    if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else Reflect.deleteProperty(globalThis,'localStorage');
  }
});
