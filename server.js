require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const app = express();
const SQLiteStore = SQLiteStoreFactory(session);
const PORT = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "hiyobon.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 full_name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('director','admin','cashier','kitchen','courier')),
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 category TEXT NOT NULL,
 price INTEGER NOT NULL CHECK(price >= 0),
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer TEXT NOT NULL,
 phone TEXT DEFAULT '',
 order_type TEXT NOT NULL,
 note TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Yangi',
 payment_method TEXT NOT NULL,
 payment_status TEXT NOT NULL DEFAULT 'unpaid',
 total INTEGER NOT NULL,
 created_by INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL,
 product_id INTEGER,
 product_name TEXT NOT NULL,
 price INTEGER NOT NULL,
 qty INTEGER NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);
`);
const countUsers = db.prepare("SELECT COUNT(*) n FROM users").get().n;
if (!countUsers) {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "ChangeThis-Immediately-123!";
  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO users(username,full_name,password_hash,role) VALUES(?,?,?,'director')")
    .run(username, "Direktor");
}
const countProducts = db.prepare("SELECT COUNT(*) n FROM products").get().n;
if (!countProducts) {
 const seed = [
  ["Lavash","Fast food",30000],["Shaurma","Fast food",28000],["Burger","Fast food",32000],
  ["Strip burger","Fast food",35000],["Fri","Fast food",15000],["Naggets","Fast food",22000],
  ["Margarita 25 sm","Pizza",45000],["Pepperoni 25 sm","Pizza",50000],
  ["Coca-Cola","Ichimlik",10000],["Fanta","Ichimlik",10000],["Suv","Ichimlik",5000],
  ["Choy","Bar",5000],["Kofe","Bar",12000]
 ];
 const ins=db.prepare("INSERT INTO products(name,category,price) VALUES(?,?,?)");
 const tx=db.transaction(rows=>rows.forEach(x=>ins.run(...x))); tx(seed);
}
app.use(express.json({limit:"1mb"}));
app.use(session({
 name:"hiyobon.sid",
 secret:process.env.SESSION_SECRET || "development-only-change-this-secret",
 resave:false, saveUninitialized:false,
 store:new SQLiteStore({db:"sessions.sqlite",dir:dataDir}),
 cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000}
}));
app.use(express.static(path.join(__dirname,"public")));

const roles = {
 director:["dashboard","orders","menu","staff","payments"],
 admin:["dashboard","orders","menu","staff","payments"],
 cashier:["dashboard","orders","payments"],
 kitchen:["kitchen"],
 courier:["courier"]
};
function auth(req,res,next){ if(!req.session.user) return res.status(401).json({error:"Tizimga kiring"}); next(); }
function allow(...allowed){return (req,res,next)=>{if(!req.session.user)return res.status(401).json({error:"Tizimga kiring"});if(!allowed.includes(req.session.user.role))return res.status(403).json({error:"Bu bo‘limga ruxsat yo‘q"});next();};}
function safeUser(u){return {id:u.id,username:u.username,full_name:u.full_name,role:u.role};}
app.post("/api/login",(req,res)=>{
 const {username,password}=req.body||{};
 const u=db.prepare("SELECT * FROM users WHERE username=? AND active=1").get(String(username||"").trim());
 if(!u||!bcrypt.compareSync(String(password||""),u.password_hash))return res.status(401).json({error:"Login yoki parol noto‘g‘ri"});
 req.session.user=safeUser(u);res.json({user:req.session.user,permissions:roles[u.role]});
});
app.post("/api/logout",auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null,permissions:req.session.user?roles[req.session.user.role]:[]}));

app.get("/api/products",auth,(req,res)=>res.json(db.prepare("SELECT * FROM products WHERE active=1 ORDER BY category,name").all()));
app.post("/api/products",allow("director","admin"),(req,res)=>{
 const {name,category,price}=req.body||{};
 if(!String(name||"").trim()||!String(category||"").trim()||!Number.isInteger(Number(price))||Number(price)<0)return res.status(400).json({error:"Mahsulot nomi, kategoriya va narxni to‘g‘ri kiriting"});
 const info=db.prepare("INSERT INTO products(name,category,price) VALUES(?,?,?)").run(name.trim(),category.trim(),Number(price));
 res.json(db.prepare("SELECT * FROM products WHERE id=?").get(info.lastInsertRowid));
});
app.put("/api/products/:id",allow("director","admin"),(req,res)=>{
 const {name,category,price,active}=req.body||{};
 db.prepare("UPDATE products SET name=?,category=?,price=?,active=? WHERE id=?")
 .run(String(name||"").trim(),String(category||"").trim(),Number(price),active===false?0:1,Number(req.params.id));
 res.json({ok:true});
});
app.delete("/api/products/:id",allow("director","admin"),(req,res)=>{
 db.prepare("UPDATE products SET active=0 WHERE id=?").run(Number(req.params.id));res.json({ok:true});
});

app.post("/api/orders",allow("director","admin","cashier"),(req,res)=>{
 const {customer,phone,order_type,note,payment_method,payment_status,items}=req.body||{};
 if(!Array.isArray(items)||!items.length)return res.status(400).json({error:"Buyurtmada mahsulot yo‘q"});
 const valid=[];
 for(const item of items){
  const p=db.prepare("SELECT id,name,price FROM products WHERE id=? AND active=1").get(Number(item.product_id));
  const qty=Number(item.qty);
  if(!p||!Number.isInteger(qty)||qty<1||qty>99)return res.status(400).json({error:"Mahsulot yoki miqdor noto‘g‘ri"});
  valid.push({...p,qty});
 }
 const total=valid.reduce((s,x)=>s+x.price*x.qty,0);
 const tx=db.transaction(()=>{
  const info=db.prepare(`INSERT INTO orders(customer,phone,order_type,note,payment_method,payment_status,total,created_by)
   VALUES(?,?,?,?,?,?,?,?)`).run(String(customer||"Noma’lum mijoz").slice(0,100),String(phone||"").slice(0,40),
   String(order_type||"Olib ketish"),String(note||"").slice(0,500),String(payment_method||"Naqd"),
   payment_status==="paid"?"paid":"unpaid",total,req.session.user.id);
  const ins=db.prepare("INSERT INTO order_items(order_id,product_id,product_name,price,qty) VALUES(?,?,?,?,?)");
  valid.forEach(x=>ins.run(info.lastInsertRowid,x.id,x.name,x.price,x.qty));
  return info.lastInsertRowid;
 });
 const id=tx();res.json(getOrder(id));
});
function getOrder(id){
 const o=db.prepare(`SELECT o.*,u.full_name creator FROM orders o LEFT JOIN users u ON u.id=o.created_by WHERE o.id=?`).get(id);
 if(!o)return null;o.items=db.prepare("SELECT product_name,price,qty FROM order_items WHERE order_id=?").all(id);return o;
}
app.get("/api/orders",allow("director","admin","cashier","kitchen","courier"),(req,res)=>{
 let rows=db.prepare("SELECT id FROM orders ORDER BY id DESC LIMIT 500").all().map(x=>getOrder(x.id));
 if(req.session.user.role==="kitchen")rows=rows.filter(o=>!["Yakunlandi","Bekor qilindi"].includes(o.status));
 if(req.session.user.role==="courier")rows=rows.filter(o=>o.order_type==="Yetkazib berish"&&!["Yakunlandi","Bekor qilindi"].includes(o.status));
 res.json(rows);
});
app.patch("/api/orders/:id/status",allow("director","admin","cashier","kitchen","courier"),(req,res)=>{
 const status=String(req.body.status||"");
 const allowed=["Yangi","Tasdiqlandi","Tayyorlanmoqda","Tayyor","Kuryerda","Yakunlandi","Bekor qilindi"];
 if(!allowed.includes(status))return res.status(400).json({error:"Holat noto‘g‘ri"});
 const role=req.session.user.role;
 if(role==="kitchen"&&!["Tayyorlanmoqda","Tayyor"].includes(status))return res.status(403).json({error:"Oshxona faqat tayyorlash holatini o‘zgartiradi"});
 if(role==="courier"&&!["Kuryerda","Yakunlandi"].includes(status))return res.status(403).json({error:"Kuryer faqat yetkazish holatini o‘zgartiradi"});
 db.prepare("UPDATE orders SET status=? WHERE id=?").run(status,Number(req.params.id));res.json(getOrder(Number(req.params.id)));
});
app.patch("/api/orders/:id/payment",allow("director","admin","cashier"),(req,res)=>{
 const v=req.body.payment_status==="paid"?"paid":"unpaid";
 db.prepare("UPDATE orders SET payment_status=? WHERE id=?").run(v,Number(req.params.id));res.json(getOrder(Number(req.params.id)));
});
app.get("/api/stats",allow("director","admin","cashier"),(req,res)=>{
 const day=db.prepare(`SELECT COUNT(*) orders,
 COALESCE(SUM(CASE WHEN payment_status='paid' THEN total ELSE 0 END),0) revenue,
 SUM(CASE WHEN payment_status='unpaid' THEN 1 ELSE 0 END) unpaid,
 SUM(CASE WHEN status='Tayyorlanmoqda' THEN 1 ELSE 0 END) preparing
 FROM orders WHERE date(created_at,'localtime')=date('now','localtime')`).get();
 res.json(day);
});
app.get("/api/staff",allow("director","admin"),(req,res)=>res.json(db.prepare("SELECT id,username,full_name,role,active,created_at FROM users ORDER BY id").all()));
app.post("/api/staff",allow("director","admin"),(req,res)=>{
 const {username,full_name,password,role}=req.body||{};
 if(!/^[a-zA-Z0-9_.-]{3,32}$/.test(String(username||""))||String(password||"").length<10||!String(full_name||"").trim()||!["admin","cashier","kitchen","courier"].includes(role))
 return res.status(400).json({error:"Login (3+ belgi), ism, rol va kamida 10 belgili parol kiriting"});
 try{
 const hash=bcrypt.hashSync(password,12);
 const info=db.prepare("INSERT INTO users(username,full_name,password_hash,role) VALUES(?,?,?,?)").run(username,full_name.trim(),hash,role);
 res.json({id:info.lastInsertRowid,username,full_name,role,active:1});
 }catch(e){res.status(409).json({error:"Bu login band bo‘lishi mumkin"});}
});
app.patch("/api/staff/:id",allow("director","admin"),(req,res)=>{
 const {active,password}=req.body||{};
 if(password && String(password).length<10)return res.status(400).json({error:"Yangi parol kamida 10 belgidan iborat bo‘lsin"});
 if(password)db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(password,12),Number(req.params.id));
 if(active!==undefined)db.prepare("UPDATE users SET active=? WHERE id=?").run(active?1:0,Number(req.params.id));
 res.json({ok:true});
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`HIYOBON CAFE server: http://localhost:${PORT}`));
