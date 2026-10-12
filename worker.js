const ORIGIN='https://bigqq7.github.io';
const grades=['大一','大二','大三','大四','研一','研二','研三'];
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&origin!==ORIGIN)return reply({error:'请从同学星球网页访问。'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(new URL(request.url).pathname!='/api/profiles')return reply({error:'页面不存在'},404);
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!/^[a-f0-9]{64}$/.test(token))return reply({error:'请重新打开网页。'},401);
 const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 try{
 if(!env.DB)return reply({error:'后台尚未配置，请稍后再试。'},503);
 const previous=await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind(id).first();
 if(request.method==='GET'){
  if(!previous)return reply({mine:null,profiles:[]});
  const mine={...JSON.parse(previous.data),id};
  const rows=await env.DB.prepare('SELECT id,data FROM profiles ORDER BY updated DESC LIMIT 500').all();
  const profiles=rows.results.map(row=>{const{age,wechat,...data}=JSON.parse(row.data);return{...data,id:row.id,age:null,wechat:null}});
  return reply({mine,profiles});
 }
 if(request.method!=='POST')return reply({error:'请求方式不正确'},405);
 const raw=await request.text();if(raw.length>450000)return reply({error:'头像文件过大。'},413);
 const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))return reply({error:'资料格式不正确'},400);
 const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
 const list=(v,max)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,40)))].slice(0,max):[];
 const name=clean(input.name,24),wechat=clean(input.wechat,60),grade=clean(input.grade,30),goal=clean(input.goal,500),age=Number(input.age),interests=list(input.interests,12),goals=list(input.goals,8);
 if(!name||!wechat||!grades.includes(grade)||!Number.isInteger(age)||age<5||age>100||!interests.length||(!goals.length&&!goal))return reply({error:'请完整填写资料。'},400);
 let avatar=previous?JSON.parse(previous.data).avatar:'';
 if(input.avatarData){if(typeof input.avatarData!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.avatarData)||input.avatarData.length>400000)return reply({error:'头像格式不正确或图片过大。'},400);avatar=input.avatarData;}
 if(!previous){const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first();if(count.n>=500)return reply({error:'班级人数已满，请联系老师。'},409)}
 const data={name,age,wechat,grade,mbti:clean(input.mbti,16),zodiac:clean(input.zodiac,16),interests,goals,goal,avatar,showAge:false,showWechat:false};
 await env.DB.prepare('INSERT INTO profiles(id,data,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(id,JSON.stringify(data),Date.now()).run();
 return reply({ok:true});
 }catch{return reply({error:'暂时无法保存或读取资料，请稍后重试。'},503)}
}};
