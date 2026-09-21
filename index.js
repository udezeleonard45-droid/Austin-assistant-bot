const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const yts = require('yt-search')
const axios = require('axios')

const BOT_NAME = "Austin Bot"
let isSleeping = false
let isAway = true
let silent = {}

async function startBot() {
const { state, saveCreds } = await useMultiFileAuthState('./session')
const sock = makeWASocket({
logger: pino({level:'silent'}),
auth: {creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'}))},
browser: ["Austin Bot","Chrome","1.0"]
})

if(!sock.authState.creds.registered){
let num = process.env.PHONE_NUMBER || ""
if(num){ setTimeout(async()=>{
let code = await sock.requestPairingCode(num)
console.log("PAIRING CODE:",code)
},3000)}
}

sock.ev.on('creds.update', saveCreds)

sock.ev.on('group-participants.update', async a=>{
if(a.action=='add'){
let txt = `Welcome @${a.participants[0].split('@')[0]} 👋\nI am ${BOT_NAME}. Type.help for commands.`
await sock.sendMessage(a.id,{text:txt, mentions:a.participants})
}
})

sock.ev.on('messages.upsert', async ({messages})=>{
try{
let m = messages[0]
if(!m.message || m.key.fromMe) return
let from = m.key.remoteJid
let isGroup = from.endsWith('@g.us')
let body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ""
let low = body.toLowerCase()

if(low==="sleep" || low==="austin sleep"){
isSleeping=true
return sock.sendMessage(from,{text:"Okay I'm quiet now 🤫. Say *Austin* to wake me."})
}
if(low.includes("austin") && isSleeping){
isSleeping=false
await sock.sendMessage(from,{text:`${BOT_NAME} back online. How can I help?`})
}
if(isSleeping) return

if(isGroup){
if(!low.includes("austin") &&!body.startsWith(".")) return
}

if(!isGroup && isAway &&!body.startsWith(".") &&!low.includes("austin")){
return sock.sendMessage(from,{text:"hi am Austin bot assistant\nhe is not currently available try again later"})
}

if(body.startsWith(".play")){
let q = body.replace(".play","").trim()
if(!q) return sock.sendMessage(from,{text:"Use:.play alan walker faded"})
let s = await yts(q)
let v = s.videos[0]
await sock.sendMessage(from,{text:`*${BOT_NAME}* 🎵 Downloading: ${v.title}`},{quoted:m})
let r = await axios.get(`https://api.davidcyriltech.my.id/youtube/mp3?url=${v.url}`)
await sock.sendMessage(from,{audio:{url:r.data.result.download_url}, mimetype:'audio/mpeg', fileName:`${v.title}.mp3`},{quoted:m})
}

if(body.startsWith(".video")){
let q = body.replace(".video","").trim()
let s = await yts(q)
let v = s.videos[0]
await sock.sendMessage(from,{text:`*${BOT_NAME}* 🎬 Downloading video: ${v.title}`},{quoted:m})
let r = await axios.get(`https://api.davidcyriltech.my.id/youtube/mp4?url=${v.url}`)
await sock.sendMessage(from,{video:{url:r.data.result.download_url}, caption:v.title},{quoted:m})
}

if(body.startsWith(".sticker") || low==="sticker"){
let quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage
if(quoted?.imageMessage || quoted?.videoMessage || m.message.imageMessage){
let buf = await sock.downloadMediaMessage(m.message.extendedTextMessage? {message:quoted, key:m.key} : m)
await sock.sendMessage(from,{sticker:buf},{quoted:m})
}else{
await sock.sendMessage(from,{text:"Reply to an image/video with.sticker"})
}
}

if(body.startsWith(".ai")){
let q = body.replace(".ai","").trim()
let r = await axios.get(`https://api.davidcyriltech.my.id/ai/chatbot?query=${encodeURIComponent(q)}`)
await sock.sendMessage(from,{text:r.data.result})
}

if(body.startsWith(".open")){
await sock.groupSettingUpdate(from,'not_announcement')
await sock.sendMessage(from,{text:"Group opened ✅"})
}
if(body.startsWith(".close")){
await sock.groupSettingUpdate(from,'announcement')
await sock.sendMessage(from,{text:"Group closed ✅"})
}

if(body.startsWith(".help")){
await sock.sendMessage(from,{text:`*${BOT_NAME} COMMANDS*\n\n.play song - download music\n.video song - download video\n.sticker - make sticker\n.ai question - chat like ChatGPT\n.open /.close - group control\n\nGroup rule: I only reply when you say *Austin*\nSay *sleep* to make me quiet\nSay *Austin* to wake me`})
}

if(low.includes("austin") &&!body.startsWith(".")){
let q = body.replace(/austin/gi,"").trim()
if(!q) q="Hello"
let r = await axios.get(`https://api.davidcyriltech.my.id/ai/chatbot?query=${encodeURIComponent(q)}`)
await sock.sendMessage(from,{text:r.data.result},{quoted:m})
}

}catch(e){console.log(e)}
})

sock.ev.on('connection.update', (u)=>{
if(u.connection==='close' && u.lastDisconnect?.error?.output?.statusCode!==401) startBot()
})
}
startBot(
  require('http').createServer((req,res)=>res.end("Austin Bot Live")).listen(process.env.PORT || 3000)
)
