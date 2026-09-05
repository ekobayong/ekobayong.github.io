const base='http://127.0.0.1:9333';
const j=async(p,opt)=>{const r=await fetch(base+p,opt);return r.json();};
const list=await j('/json/list');
console.log('targets:', list.map(t=>({type:t.type,url:t.url.slice(0,80),ws:!!t.webSocketDebuggerUrl})));
