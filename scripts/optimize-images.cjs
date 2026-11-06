// Encoding and size optimization only; the generated compositions are preserved.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(require.resolve('sharp', {paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()]}));
const root=path.resolve(__dirname,'..');
(async()=>{
  const folder=path.join(root,'dist/assets/exercises'), files=fs.readdirSync(folder).filter(f=>f.endsWith('.png'));
  let bytes=0;
  for(const file of files){const output=path.join(folder,file.replace(/\.png$/,'.webp'));await sharp(path.join(folder,file)).resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:5}).toFile(output);bytes+=fs.statSync(output).size;}
  await sharp(path.join(root,'dist/assets/icon.svg')).resize(192,192).png().toFile(path.join(root,'dist/assets/icon-192.png'));
  await sharp(path.join(root,'dist/assets/icon.svg')).resize(512,512).png().toFile(path.join(root,'dist/assets/icon-512.png'));
  console.log(JSON.stringify({images:files.length,webp_bytes:bytes}));
})();
