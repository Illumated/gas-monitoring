import { writeFileSync } from "node:fs";

const tab = "flow-product";
const ids = {
  modbus: "cfg-modbus-tcp",
  ui: "cfg-ui-base",
  theme: "cfg-ui-theme",
  monitorPage: "cfg-page-monitor",
  historyPage: "cfg-page-history",
  monitorGroup: "cfg-group-monitor",
  historyGroup: "cfg-group-history",
  normalize: "fn-normalize",
  state: "fn-state",
  influxWrite: "fn-influx-write",
  influxWriteHttp: "http-influx-write",
  historyUi: "ui-history",
  historyQuery: "fn-history-query",
  historyHttp: "http-history-query",
  historyParse: "fn-history-parse"
};

const monitoringTemplate = String.raw`<template>
  <main class="gm-shell">
    <header class="gm-header">
      <div>
        <p class="gm-eyebrow">RINIR · централизованное газоснабжение</p>
        <h1>Контроль давления медицинских газов</h1>
      </div>
      <div class="gm-head-status" :class="'is-' + overall.status">
        <span class="gm-dot"></span>
        <div><small>Общее состояние</small><strong>{{ overall.label }}</strong></div>
      </div>
      <time>{{ state.clock || '—' }}</time>
    </header>
    <section class="gm-grid">
      <article v-for="gas in gases" :key="gas.key" class="gm-card" :class="'is-' + gas.status">
        <div class="gm-card-head">
          <div><p>{{ gas.code }}</p><h2>{{ gas.name }}</h2></div>
          <span class="gm-badge">{{ label(gas.status) }}</span>
        </div>
        <div class="gm-value"><strong>{{ display(gas) }}</strong><span>бар</span></div>
        <div class="gm-track">
          <span class="zone alarm-low"></span><span class="zone warn-low"></span>
          <span class="zone ok"></span><span class="zone warn-high"></span>
          <span class="zone alarm-high"></span>
          <i v-if="gas.value !== null" :style="{left: marker(gas.value) + '%'}"></i>
        </div>
        <div class="gm-scale"><span>0</span><span>3,5</span><span>4,0</span><span>6,0</span><span>6,5</span><span>8</span></div>
        <footer><span>Норма: 4,0–6,0 бар</span><span>{{ updated(gas) }}</span></footer>
      </article>
    </section>
    <footer class="gm-footer">
      <span><i class="legend ok"></i>Норма</span><span><i class="legend warn"></i>Предупреждение</span>
      <span><i class="legend alarm"></i>Авария</span><span><i class="legend nodata"></i>Нет данных</span>
      <a href="/dashboard/history">Открыть историю →</a>
    </footer>
  </main>
</template>

<script>
export default {
  data() {
    return { state: { clock: "", overall: "nodata", gases: [] } }
  },
  computed: {
    gases() {
      const fallback = [
        {key:"oxygen",code:"O₂",name:"Кислород",value:null,status:"nodata",updatedAt:null},
        {key:"air",code:"AIR",name:"Медицинский воздух",value:null,status:"nodata",updatedAt:null},
        {key:"n2o",code:"N₂O",name:"Закись азота",value:null,status:"nodata",updatedAt:null}
      ]
      return this.state.gases?.length ? this.state.gases : fallback
    },
    overall() {
      const status = this.state.overall || "nodata"
      return { status, label: this.label(status) }
    }
  },
  watch: {
    msg: { deep: true, immediate: true, handler(value) {
      if (value?.payload?.gases) this.state = value.payload
    }}
  },
  methods: {
    label(status) { return ({ok:"НОРМА",warn:"ВНИМАНИЕ",alarm:"АВАРИЯ",nodata:"НЕТ ДАННЫХ"})[status] || "НЕТ ДАННЫХ" },
    display(gas) { return Number.isFinite(gas.value) ? gas.value.toFixed(1).replace(".", ",") : "—" },
    marker(value) { return Math.max(0, Math.min(100, Number(value) / 8 * 100)) },
    updated(gas) { return gas.updatedAt ? "Обновлено " + new Date(gas.updatedAt).toLocaleTimeString("ru-RU") : "Ожидание данных" }
  }
}
</script>

<style>
.gm-shell{min-height:calc(100vh - 48px);padding:24px;color:#eef6ff;background:radial-gradient(circle at 15% 0,#173b59 0,transparent 34%),#071521;font-family:Inter,Segoe UI,sans-serif}
.gm-header{display:grid;grid-template-columns:1fr auto auto;gap:28px;align-items:center;margin-bottom:24px}
.gm-eyebrow{margin:0 0 7px;color:#7fa8c5;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.gm-header h1{margin:0;font-size:clamp(24px,3vw,40px);line-height:1.05}
.gm-header time{font-size:24px;font-variant-numeric:tabular-nums}.gm-head-status{display:flex;align-items:center;gap:12px;padding:12px 18px;border:1px solid #31516a;border-radius:14px;background:#102638}.gm-head-status small,.gm-head-status strong{display:block}.gm-head-status small{color:#94afc2;font-size:11px;text-transform:uppercase}.gm-head-status strong{font-size:18px}.gm-dot{width:14px;height:14px;border-radius:50%;background:#7c8b96;box-shadow:0 0 16px currentColor}
.gm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.gm-card{position:relative;padding:22px;border:1px solid #29465c;border-top:5px solid #71808b;border-radius:18px;background:linear-gradient(145deg,#102738,#0b1d2b);box-shadow:0 16px 38px #0005}.gm-card.is-ok{border-top-color:#25c77c}.gm-card.is-warn{border-top-color:#f6b73c}.gm-card.is-alarm{border-top-color:#ff5364}.gm-card-head{display:flex;justify-content:space-between;gap:12px}.gm-card-head p{margin:0;color:#64b9ea;font-size:15px;font-weight:800}.gm-card h2{min-height:54px;margin:5px 0 0;font-size:23px}.gm-badge{height:max-content;padding:7px 10px;border-radius:8px;background:#263b4a;color:#cbd8e2;font-size:11px;font-weight:900;letter-spacing:.08em}.is-ok .gm-badge{background:#143e30;color:#5de3a4}.is-warn .gm-badge{background:#4a3613;color:#ffd36b}.is-alarm .gm-badge{background:#4c2028;color:#ff8995}
.gm-value{display:flex;align-items:baseline;justify-content:center;gap:10px;margin:25px 0 18px}.gm-value strong{font-size:clamp(52px,6vw,86px);line-height:.9;font-variant-numeric:tabular-nums}.gm-value span{color:#94afc2;font-size:20px}
.gm-track{position:relative;display:flex;height:14px;overflow:visible;border-radius:8px}.gm-track .zone{height:100%}.alarm-low,.alarm-high{width:21.875%;background:#c83c4b}.warn-low,.warn-high{width:6.25%;background:#d99b27}.gm-track .ok{width:25%;background:#1b9e62}.gm-track i{position:absolute;top:-7px;width:4px;height:28px;transform:translateX(-2px);border-radius:3px;background:#fff;box-shadow:0 0 10px #fff}.gm-scale{display:flex;justify-content:space-between;margin-top:8px;color:#819bad;font-size:11px}.gm-card footer{display:flex;justify-content:space-between;gap:12px;margin-top:28px;color:#8fa9bb;font-size:12px}
.gm-footer{display:flex;align-items:center;gap:20px;margin-top:20px;padding:12px 4px;color:#a5bac9;font-size:12px}.gm-footer span{display:flex;align-items:center;gap:6px}.legend{width:9px;height:9px;border-radius:50%}.legend.ok{background:#25c77c}.legend.warn{background:#f6b73c}.legend.alarm{background:#ff5364}.legend.nodata{background:#71808b}.gm-footer a{margin-left:auto;color:#72c7f5;font-weight:700;text-decoration:none}
@media(max-width:900px){.gm-header{grid-template-columns:1fr auto}.gm-header time{display:none}.gm-grid{grid-template-columns:1fr}.gm-card h2{min-height:0}.gm-footer{flex-wrap:wrap}.gm-footer a{width:100%;margin:0}}@media(max-width:560px){.gm-shell{padding:14px}.gm-header{grid-template-columns:1fr}.gm-head-status{width:max-content}.gm-card footer{flex-direction:column}.gm-footer{gap:10px}}
</style>`;

const historyTemplate = String.raw`<template>
  <main class="gh-shell">
    <header><div><p>RINIR · архив измерений</p><h1>История давления</h1></div><a href="/dashboard/monitoring">← Мониторинг</a></header>
    <section class="gh-controls">
      <label>Газ<select v-model="gas"><option value="oxygen">Кислород</option><option value="air">Медицинский воздух</option><option value="n2o">Закись азота</option></select></label>
      <div class="gh-ranges"><button v-for="item in ranges" :key="item.value" :class="{active:range===item.value}" @click="selectRange(item.value)">{{ item.label }}</button></div>
      <label>С<input type="datetime-local" v-model="start"></label><label>По<input type="datetime-local" v-model="stop"></label>
      <button class="apply" @click="request">Применить</button>
    </section>
    <section class="gh-panel">
      <div class="gh-summary"><div><small>Выбранный газ</small><strong>{{ gasName }}</strong></div><div><small>Точек</small><strong>{{ points.length }}</strong></div><div><small>Последнее значение</small><strong>{{ lastValue }}</strong></div><div><small>Статус</small><strong :class="'text-'+status">{{ statusLabel }}</strong></div></div>
      <div v-if="loading" class="gh-empty">Загрузка данных…</div><div v-else-if="error" class="gh-empty error">{{ error }}</div><div v-else-if="!points.length" class="gh-empty">За выбранный период данных нет</div>
      <div v-else class="gh-chart">
        <div class="axis-label top">8 бар</div><div class="axis-label bottom">0 бар</div>
        <svg viewBox="0 0 1000 360" preserveAspectRatio="none" aria-label="График давления">
          <line v-for="y in [0,90,180,270,360]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" class="grid"/>
          <rect x="0" y="90" width="1000" height="90" class="normal-zone"/>
          <polyline :points="polyline" class="line"/>
          <circle v-for="(p,i) in chartPoints" :key="i" :cx="p.x" :cy="p.y" r="3.5" class="point"><title>{{ tooltip(p.source) }}</title></circle>
        </svg>
        <div class="gh-time"><span>{{ firstTime }}</span><span>{{ lastTime }}</span></div>
      </div>
    </section>
  </main>
</template>
<script>
export default {
  data(){return{gas:"oxygen",range:"24h",start:"",stop:"",loading:false,error:"",points:[],ranges:[{value:"1h",label:"1 час"},{value:"24h",label:"24 часа"},{value:"7d",label:"7 дней"},{value:"30d",label:"30 дней"}]}},
  computed:{
    gasName(){return({oxygen:"Кислород",air:"Медицинский воздух",n2o:"Закись азота"})[this.gas]},
    chartPoints(){const n=Math.max(1,this.points.length-1);return this.points.map((p,i)=>({x:i/n*1000,y:360-Math.max(0,Math.min(8,p.value))/8*360,source:p}))},
    polyline(){return this.chartPoints.map(p=>p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")},
    last(){return this.points.at(-1)},lastValue(){return this.last?this.last.value.toFixed(1).replace(".",",")+" бар":"—"},
    status(){return this.last?.status||"nodata"},statusLabel(){return({ok:"НОРМА",warn:"ВНИМАНИЕ",alarm:"АВАРИЯ",nodata:"НЕТ ДАННЫХ"})[this.status]},
    firstTime(){return this.points.length?new Date(this.points[0].time).toLocaleString("ru-RU"):""},lastTime(){return this.last?new Date(this.last.time).toLocaleString("ru-RU"):""}
  },
  watch:{msg:{deep:true,handler(value){const p=value?.payload;if(p?.kind!=="history")return;this.loading=false;this.error=p.error||"";this.points=p.points||[];if(p.gas)this.gas=p.gas}}},
  mounted(){this.request()},
  methods:{
    selectRange(value){this.range=value;this.start="";this.stop="";this.request()},
    request(){if((this.start&&!this.stop)||(!this.start&&this.stop)){this.error="Укажите обе границы периода";return}this.loading=true;this.error="";this.send({payload:{action:"query",gas:this.gas,range:this.range,start:this.start,stop:this.stop}})},
    tooltip(p){return new Date(p.time).toLocaleString("ru-RU")+" · "+p.value.toFixed(1)+" бар"}
  }
}
</script>
<style>
.gh-shell{min-height:calc(100vh - 48px);padding:24px;color:#ecf5fc;background:#071521;font-family:Inter,Segoe UI,sans-serif}.gh-shell header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.gh-shell header p{margin:0 0 6px;color:#7fa8c5;font-size:13px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.gh-shell h1{margin:0;font-size:36px}.gh-shell header a{color:#72c7f5;font-weight:700;text-decoration:none}.gh-controls{display:grid;grid-template-columns:1.3fr 2fr 1.2fr 1.2fr auto;gap:12px;align-items:end;padding:16px;border:1px solid #29465c;border-radius:16px;background:#102738}.gh-controls label{display:grid;gap:6px;color:#93acbd;font-size:12px}.gh-controls select,.gh-controls input{height:42px;padding:0 11px;border:1px solid #34556d;border-radius:8px;color:#eaf4fb;background:#0a1c29}.gh-ranges{display:flex;gap:6px}.gh-ranges button,.apply{height:42px;padding:0 13px;border:1px solid #34556d;border-radius:8px;color:#c9d9e5;background:#132f42;cursor:pointer}.gh-ranges button.active,.apply{border-color:#159ee0;color:#fff;background:#0878ad}.gh-panel{margin-top:16px;padding:18px;border:1px solid #29465c;border-radius:16px;background:#0d2232}.gh-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}.gh-summary div{padding:12px;border-radius:10px;background:#132c3e}.gh-summary small,.gh-summary strong{display:block}.gh-summary small{margin-bottom:5px;color:#819cad}.gh-summary strong{font-size:18px}.text-ok{color:#3ed592}.text-warn{color:#ffc85c}.text-alarm{color:#ff7080}.text-nodata{color:#92a2ae}.gh-chart{position:relative;height:430px;padding:10px 20px 34px 42px}.gh-chart svg{width:100%;height:100%;overflow:visible}.grid{stroke:#254256;stroke-width:1}.normal-zone{fill:#1e9f6320}.line{fill:none;stroke:#4cc5ff;stroke-width:4;vector-effect:non-scaling-stroke}.point{fill:#eaf8ff;stroke:#179edc;stroke-width:2;vector-effect:non-scaling-stroke}.axis-label{position:absolute;left:0;color:#7894a7;font-size:11px}.axis-label.top{top:8px}.axis-label.bottom{bottom:32px}.gh-time{display:flex;justify-content:space-between;color:#7894a7;font-size:11px}.gh-empty{display:grid;min-height:350px;place-items:center;color:#89a4b6}.gh-empty.error{color:#ff7b88}
@media(max-width:1000px){.gh-controls{grid-template-columns:1fr 1fr}.gh-ranges{grid-column:1/-1}.gh-summary{grid-template-columns:1fr 1fr}}@media(max-width:600px){.gh-shell{padding:14px}.gh-shell header{align-items:flex-start}.gh-shell h1{font-size:28px}.gh-controls{grid-template-columns:1fr}.gh-ranges{grid-column:auto;flex-wrap:wrap}.gh-summary{grid-template-columns:1fr}.gh-chart{height:320px}}
</style>`;

const normalizeCode = `const channels = {
  oxygen: { code: "O₂", name: "Кислород" },
  air: { code: "AIR", name: "Медицинский воздух" },
  n2o: { code: "N₂O", name: "Закись азота" }
};
const gas = channels[msg.topic];
if (!gas) return null;
const source = Array.isArray(msg.payload?.data) ? msg.payload.data : (Array.isArray(msg.payload) ? msg.payload : []);
const raw = Number(source[0]);
const staleMs = Math.max(5000, Number(env.get("GAS_STALE_TIMEOUT_MS")) || 20000);
node.staleTimers ||= new Map();
const previous = node.staleTimers.get(msg.topic);
if (previous) clearTimeout(previous);
const staleTimer = setTimeout(() => node.send([{payload:{key:msg.topic,...gas,value:null,raw:null,status:"nodata",reason:"stale",updatedAt:Date.now()}},null]), staleMs);
node.staleTimers.set(msg.topic, staleTimer);
if (!Number.isFinite(raw) || raw === 32767 || raw === -32768) {
  return [{payload:{key:msg.topic,...gas,value:null,raw:null,status:"nodata",reason:"invalid",updatedAt:Date.now()}},null];
}
const value = Math.round(raw) / 10;
const status = value >= 4 && value <= 6 ? "ok" : (value >= 3.5 && value <= 6.5 ? "warn" : "alarm");
const payload = {key:msg.topic,...gas,value,raw,status,reason:null,updatedAt:Date.now()};
return [{payload},{payload}];`;

const stateCode = `const initial = {
  oxygen:{key:"oxygen",code:"O₂",name:"Кислород",value:null,raw:null,status:"nodata",updatedAt:null},
  air:{key:"air",code:"AIR",name:"Медицинский воздух",value:null,raw:null,status:"nodata",updatedAt:null},
  n2o:{key:"n2o",code:"N₂O",name:"Закись азота",value:null,raw:null,status:"nodata",updatedAt:null}
};
const state = context.get("gasState") || initial;
if (msg.payload?.key && state[msg.payload.key]) state[msg.payload.key] = msg.payload;
const staleMs = Math.max(5000, Number(env.get("GAS_STALE_TIMEOUT_MS")) || 20000);
for (const key of Object.keys(state)) {
  if (state[key].updatedAt && Date.now() - state[key].updatedAt > staleMs) {
    state[key] = {...state[key],value:null,status:"nodata",reason:"stale"};
  }
}
context.set("gasState", state);
const order = {ok:0,warn:1,nodata:2,alarm:3};
const gases = ["oxygen","air","n2o"].map(key => state[key]);
const overall = gases.reduce((result, gas) => order[gas.status] > order[result] ? gas.status : result, "ok");
msg.payload = {clock:new Date().toLocaleString("ru-RU",{timeZone:env.get("TZ")||"Europe/Moscow"}),overall,gases};
return msg;`;

const influxWriteCode = `const p = msg.payload;
if (!p || !Number.isFinite(p.value)) return null;
const esc = value => String(value).replace(/([ ,=])/g, "\\\\$1");
const url = env.get("INFLUXDB_URL");
const org = env.get("INFLUXDB_ORG");
const bucket = env.get("INFLUXDB_BUCKET");
const token = env.get("INFLUXDB_TOKEN");
msg.method = "POST";
msg.url = url + "/api/v2/write?org=" + encodeURIComponent(org) + "&bucket=" + encodeURIComponent(bucket) + "&precision=ms";
msg.headers = {"Authorization":"Token " + token,"Content-Type":"text/plain; charset=utf-8"};
msg.payload = "gas_pressure,gas=" + esc(p.key) + ",gas_name=" + esc(p.name) + ",status=" + esc(p.status) + " pressure_bar=" + p.value + ",raw=" + p.raw + "i,status_code=" + ({ok:0,warn:1,alarm:2}[p.status] ?? 3) + "i " + p.updatedAt;
return msg;`;

const historyQueryCode = `const input = msg.payload || {};
if (input.action !== "query") return null;
const gases = new Set(["oxygen","air","n2o"]);
const ranges = { "1h": {start:"-1h",window:"1m"}, "24h": {start:"-24h",window:"5m"}, "7d": {start:"-7d",window:"30m"}, "30d": {start:"-30d",window:"2h"} };
if (!gases.has(input.gas)) return {payload:{kind:"history",gas:input.gas,points:[],error:"Неизвестный газ"}};
let start;
let stop = "";
let window = ranges[input.range]?.window || "5m";
if (input.start && input.stop) {
  const from = new Date(input.start);
  const to = new Date(input.stop);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) return {payload:{kind:"history",gas:input.gas,points:[],error:"Некорректный период"}};
  start = from.toISOString();
  stop = to.toISOString();
  const hours = (to - from) / 3600000;
  window = hours <= 2 ? "1m" : hours <= 48 ? "5m" : hours <= 240 ? "30m" : "2h";
} else {
  start = ranges[input.range]?.start || "-24h";
}
const range = start.startsWith("-") ? "range(start: " + start + ")" : "range(start: time(v: " + JSON.stringify(start) + "), stop: time(v: " + JSON.stringify(stop) + "))";
const bucket = env.get("INFLUXDB_BUCKET");
const query = 'from(bucket: ' + JSON.stringify(bucket) + ') |> ' + range + ' |> filter(fn: (r) => r._measurement == "gas_pressure" and r._field == "pressure_bar" and r.gas == ' + JSON.stringify(input.gas) + ') |> group(columns: ["gas"]) |> aggregateWindow(every: ' + window + ', fn: mean, createEmpty: false) |> keep(columns: ["_time","_value"]) |> yield(name: "mean")';
msg.historyGas = input.gas;
msg.method = "POST";
msg.url = env.get("INFLUXDB_URL") + "/api/v2/query?org=" + encodeURIComponent(env.get("INFLUXDB_ORG"));
msg.headers = {"Authorization":"Token " + env.get("INFLUXDB_TOKEN"),"Content-Type":"application/json","Accept":"text/csv"};
msg.payload = {query,type:"flux",dialect:{header:true,delimiter:",",annotations:[],commentPrefix:"#",dateTimeFormat:"RFC3339"}};
return msg;`;

const historyParseCode = `const gas = msg.historyGas;
if (Number(msg.statusCode) >= 400) return {payload:{kind:"history",gas,points:[],error:"InfluxDB вернул HTTP " + msg.statusCode}};
const lines = String(msg.payload || "").trim().split(/\\r?\\n/).filter(Boolean);
if (lines.length < 2) return {payload:{kind:"history",gas,points:[],error:""}};
const headers = lines[0].split(",");
const timeIndex = headers.indexOf("_time");
const valueIndex = headers.indexOf("_value");
const points = lines.slice(1).map(line => {
  const cols = line.split(",");
  const value = Number(cols[valueIndex]);
  const status = value >= 4 && value <= 6 ? "ok" : (value >= 3.5 && value <= 6.5 ? "warn" : "alarm");
  return {time:cols[timeIndex],value,status};
}).filter(point => point.time && Number.isFinite(point.value));
return {payload:{kind:"history",gas,points,error:""}};`;

const simulatorCode = `if (String(env.get("SIMULATION_MODE")).toLowerCase() !== "true") return null;
const phase = (Date.now() / 60000) % (Math.PI * 2);
const values = {oxygen:50 + Math.sin(phase) * 4,air:52 + Math.sin(phase + 2) * 3,n2o:48 + Math.sin(phase + 4) * 5};
return Object.entries(values).map(([topic, raw]) => ({topic,payload:{data:[Math.round(raw)]}}));`;

const flow = [
  {id:tab,type:"tab",label:"RINIR Gas Monitoring",disabled:false,info:"Product flow: WB-MAI6 via USR-DR134, InfluxDB v2 and FlowFuse Dashboard."},
  {id:ids.modbus,type:"modbus-client",name:"USR-DR134 / WB-MAI6",clienttype:"tcp",bufferCommands:true,stateLogEnabled:false,queueLogEnabled:false,failureLogEnabled:true,tcpHost:"${MODBUS_HOST}",tcpPort:"${MODBUS_PORT}",tcpType:"DEFAULT",serialPort:"/dev/ttyS0",serialType:"RTU-BUFFERD",serialBaudrate:"9600",serialDatabits:"8",serialStopbits:"1",serialParity:"none",serialConnectionDelay:"100",serialAsciiResponseStartDelimiter:"",unit_id:65,commandDelay:"",clientTimeout:"3000",reconnectOnTimeout:true,reconnectTimeout:2000,parallelUnitIdsAllowed:false,showErrors:true,showWarnings:true,showLogs:false},
  {id:ids.ui,type:"ui-base",name:"RINIR Gas Monitoring",path:"/dashboard",appIcon:"",includeClientData:true,acceptsClientConfig:["ui-notification","ui-control"],showPathInSidebar:false,headerContent:"none",navigationStyle:"temporary",titleBarStyle:"hidden",showReconnectNotification:true,notificationDisplayTime:5,showDisconnectNotification:true,allowInstall:false},
  {id:ids.theme,type:"ui-theme",name:"RINIR Dark",colors:{surface:"#102738",primary:"#159ee0",bgPage:"#071521",groupBg:"#071521",groupOutline:"#071521"},sizes:{density:"compact",pagePadding:"0px",groupGap:"0px",groupBorderRadius:"0px",widgetGap:"0px"}},
  {id:ids.monitorPage,type:"ui-page",name:"Мониторинг",ui:ids.ui,path:"/monitoring",icon:"monitor_heart",layout:"grid",theme:ids.theme,breakpoints:[{name:"Default",px:"0",cols:"3"},{name:"Tablet",px:"576",cols:"6"},{name:"Desktop",px:"1024",cols:"12"}],order:1,className:"gm-page",visible:true,disabled:false},
  {id:ids.historyPage,type:"ui-page",name:"История",ui:ids.ui,path:"/history",icon:"query_stats",layout:"grid",theme:ids.theme,breakpoints:[{name:"Default",px:"0",cols:"3"},{name:"Tablet",px:"576",cols:"6"},{name:"Desktop",px:"1024",cols:"12"}],order:2,className:"gh-page",visible:true,disabled:false},
  {id:ids.monitorGroup,type:"ui-group",name:"Мониторинг",page:ids.monitorPage,width:"12",height:"1",order:1,showTitle:false,className:"gm-group",visible:"true",disabled:"false",groupType:"default"},
  {id:ids.historyGroup,type:"ui-group",name:"История",page:ids.historyPage,width:"12",height:"1",order:1,showTitle:false,className:"gh-group",visible:"true",disabled:"false",groupType:"default"},
  {id:"ui-monitor",type:"ui-template",z:tab,group:ids.monitorGroup,name:"HMI: monitoring",order:1,width:12,height:10,format:monitoringTemplate,templateScope:"local",storeOutMessages:true,fwdInMessages:false,resendOnRefresh:true,className:"gm-widget",x:1040,y:180,wires:[[]]},
  {id:ids.historyUi,type:"ui-template",z:tab,group:ids.historyGroup,name:"HMI: history",order:1,width:12,height:10,format:historyTemplate,templateScope:"local",storeOutMessages:true,fwdInMessages:false,resendOnRefresh:true,className:"gh-widget",x:220,y:700,wires:[[ids.historyQuery]]},
  {id:"read-oxygen",type:"modbus-read",z:tab,name:"O₂ · IR 5380",topic:"oxygen",showStatusActivities:true,logIOActivities:false,showErrors:true,showWarnings:true,unitid:"65",dataType:"InputRegister",adr:"5380",quantity:"1",rate:"${MODBUS_POLL_INTERVAL_MS}",rateUnit:"ms",delayOnStart:true,enableDeformedMessages:false,startDelayTime:"1000",server:ids.modbus,useIOFile:false,ioFile:"",useIOForPayload:false,emptyMsgOnFail:true,x:180,y:120,wires:[[ids.normalize],[]]},
  {id:"read-air",type:"modbus-read",z:tab,name:"AIR · IR 9476",topic:"air",showStatusActivities:true,logIOActivities:false,showErrors:true,showWarnings:true,unitid:"65",dataType:"InputRegister",adr:"9476",quantity:"1",rate:"${MODBUS_POLL_INTERVAL_MS}",rateUnit:"ms",delayOnStart:true,enableDeformedMessages:false,startDelayTime:"1500",server:ids.modbus,useIOFile:false,ioFile:"",useIOForPayload:false,emptyMsgOnFail:true,x:180,y:180,wires:[[ids.normalize],[]]},
  {id:"read-n2o",type:"modbus-read",z:tab,name:"N₂O · IR 13572",topic:"n2o",showStatusActivities:true,logIOActivities:false,showErrors:true,showWarnings:true,unitid:"65",dataType:"InputRegister",adr:"13572",quantity:"1",rate:"${MODBUS_POLL_INTERVAL_MS}",rateUnit:"ms",delayOnStart:true,enableDeformedMessages:false,startDelayTime:"2000",server:ids.modbus,useIOFile:false,ioFile:"",useIOForPayload:false,emptyMsgOnFail:true,x:180,y:240,wires:[[ids.normalize],[]]},
  {id:ids.normalize,type:"function",z:tab,name:"Validate, scale and classify",func:normalizeCode,outputs:2,timeout:0,noerr:0,initialize:"node.staleTimers = new Map();",finalize:"for (const timer of node.staleTimers?.values() || []) clearTimeout(timer);",libs:[],x:470,y:180,wires:[[ids.state],[ids.influxWrite]]},
  {id:"clock",type:"inject",z:tab,name:"UI clock",props:[{p:"payload"}],repeat:"1",crontab:"",once:true,onceDelay:0.2,topic:"",payload:"",payloadType:"date",x:470,y:100,wires:[[ids.state]]},
  {id:ids.state,type:"function",z:tab,name:"Build HMI state",func:stateCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:760,y:180,wires:[["ui-monitor"]]},
  {id:ids.influxWrite,type:"function",z:tab,name:"Build InfluxDB v2 write",func:influxWriteCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:770,y:280,wires:[[ids.influxWriteHttp]]},
  {id:ids.influxWriteHttp,type:"http request",z:tab,name:"InfluxDB write",method:"use",ret:"txt",paytoqs:"ignore",url:"",tls:"",persist:false,proxy:"",insecureHTTPParser:false,authType:"",senderr:true,headers:[],x:1040,y:280,wires:[[]]},
  {id:"sim-tick",type:"inject",z:tab,name:"Simulator tick (test only)",props:[{p:"payload"}],repeat:"5",crontab:"",once:true,onceDelay:1,topic:"",payload:"",payloadType:"date",x:190,y:360,wires:[["fn-simulator"]]},
  {id:"fn-simulator",type:"function",z:tab,name:"Development simulator",func:simulatorCode,outputs:3,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:470,y:360,wires:[[ids.normalize],[ids.normalize],[ids.normalize]]},
  {id:ids.historyQuery,type:"function",z:tab,name:"Build safe Flux query",func:historyQueryCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:490,y:700,wires:[[ids.historyHttp]]},
  {id:ids.historyHttp,type:"http request",z:tab,name:"InfluxDB query",method:"use",ret:"txt",paytoqs:"body",url:"",tls:"",persist:false,proxy:"",insecureHTTPParser:false,authType:"",senderr:true,headers:[],x:730,y:700,wires:[[ids.historyParse]]},
  {id:ids.historyParse,type:"function",z:tab,name:"Parse history response",func:historyParseCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:960,y:700,wires:[[ids.historyUi]]},
  {id:"catch-runtime",type:"catch",z:tab,name:"Runtime errors",scope:["read-oxygen","read-air","read-n2o",ids.influxWriteHttp,ids.historyHttp],uncaught:false,x:190,y:520,wires:[["fn-error-log"]]},
  {id:"fn-error-log",type:"function",z:tab,name:"Sanitize and log error",func:'node.error((msg.error?.message || "Runtime error").replace(/Token\\s+[^\\s]+/gi, "Token [redacted]"));\nreturn null;',outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:470,y:520,wires:[[]]}
];

writeFileSync(new URL("../flows/flows.json", import.meta.url), JSON.stringify(flow, null, 2) + "\n");
