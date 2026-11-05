'use strict';
// Exact QR modules, no remote image service and no room/host credential in the QR.
const qrcode=require('qrcode-generator'),zlib=require('node:zlib');
const GUEST_URL='https://wedding-derby-live.onrender.com/entry.html';
const qr=qrcode(0,'M');qr.addData(GUEST_URL);qr.make();
function crc32(data){let c=0xffffffff;for(const byte of data){c^=byte;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
const cell=24,pad=4,n=qr.getModuleCount(),size=(n+pad*2)*cell,raw=Buffer.alloc((size+1)*size,255);
for(let y=0;y<size;y++){raw[y*(size+1)]=0;for(let x=0;x<size;x++){const row=Math.floor(y/cell)-pad,col=Math.floor(x/cell)-pad;raw[y*(size+1)+1+x]=row>=0&&row<n&&col>=0&&col<n&&qr.isDark(row,col)?0:255;}}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=0;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
module.exports={GUEST_URL,png,svg:qr.createSvgTag({cellSize:12,margin:48,scalable:true}),size};
