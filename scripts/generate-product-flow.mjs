import { writeFileSync } from "node:fs";

const tab = "flow-product";
const ids = {
  modbus: "cfg-modbus-tcp",
  ui: "cfg-ui-base",
  theme: "cfg-ui-theme",
  monitorPage: "cfg-page-monitor",
  historyPage: "cfg-page-history",
  eventsPage: "cfg-page-events",
  engineeringPage: "cfg-page-engineering",
  monitorGroup: "cfg-group-monitor",
  historyGroup: "cfg-group-history",
  eventsGroup: "cfg-group-events",
  engineeringGroup: "cfg-group-engineering",
  normalize: "fn-normalize",
  cycleAggregate: "fn-cycle-aggregate",
  state: "fn-state",
  maxRequest: "fn-max-request",
  maxHttp: "http-max-send",
  influxWrite: "fn-influx-write",
  influxWriteHttp: "http-influx-write",
  historyUi: "ui-history",
  historyQuery: "fn-history-query",
  historyHttp: "http-history-query",
  historyParse: "fn-history-parse",
  eventWrite: "fn-event-write",
  eventsUi: "ui-events",
  eventsQuery: "fn-events-query",
  eventsHttp: "http-events-query",
  eventsParse: "fn-events-parse",
  engineeringUi: "ui-engineering",
  engineeringManager: "fn-engineering-manager",
  authUsersHttp: "http-auth-users",
  authUsersResponse: "fn-auth-users-response",
  influxTrack: "fn-influx-track",
  maxTrack: "fn-max-track",
  maxDelay: "delay-max-retry",
  maxReminder: "fn-max-reminder",
  pollCycle: "poll-cycle",
  pollBuilder: "poll-builder",
  pollDelay: "poll-delay",
  pollGetter: "poll-getter"
};

const monitoringTemplate = String.raw`<template>
  <main class="gm-shell">
    <header class="gm-header">
      <div>
        <p class="gm-eyebrow">{{ identity.siteName }} · {{ identity.locationName }}</p>
        <h1>Контроль давления</h1>
        <p class="gm-monitor-id">Установка {{ identity.monitorId }}</p>
      </div>
      <div class="gm-head-status" :class="'is-' + overall.status">
        <span class="gm-dot"></span>
        <div><small>Общее состояние</small><strong>{{ overall.label }}</strong></div>
      </div>
      <div v-if="valves.enabled" class="gm-valves" :class="'is-' + valves.status"><small>Клапаны</small><strong>{{ valveLabel }}</strong></div>
      <div class="gm-clock"><small>Текущее время</small><time>{{ state.clock || '—' }}</time></div>
    </header>
    <section class="gm-grid" :class="'count-' + gases.length">
      <article v-for="gas in gases" :key="gas.key" class="gm-card" :class="'is-' + gas.status">
        <div class="gm-card-head">
          <div><p>{{ gas.code }}</p><h2>{{ gas.name }}</h2></div>
          <span class="gm-badge">{{ label(gas.status) }}</span>
        </div>
        <div class="gm-value"><strong>{{ display(gas) }}</strong><span>бар</span></div>
        <div class="gm-track">
          <span v-for="zone in zones(gas)" :key="zone.name" class="zone" :class="zone.name" :style="{width: zone.width + '%'}"></span>
          <i v-if="gas.value !== null" :style="{left: marker(gas) + '%'}"></i>
        </div>
        <div class="gm-scale"><span v-for="point in scale(gas)" :key="point">{{ fmt(point) }}</span></div>
        <footer><span>Норма: {{ fmt(gas.limits?.okLow) }}–{{ fmt(gas.limits?.okHigh) }} бар</span><span>{{ updated(gas) }}</span></footer>
      </article>
    </section>
    <footer class="gm-footer">
      <span><i class="legend ok"></i>Норма</span><span><i class="legend warn"></i>Предупреждение</span>
      <span><i class="legend alarm"></i>Авария</span><span><i class="legend nodata"></i>Нет данных</span>
      <nav><a href="/dashboard/history">История</a><a href="/dashboard/events">События</a><a href="/dashboard/engineering">Сервис</a></nav>
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
        {key:"air",code:"AIR",name:"Сжатый воздух",value:null,status:"nodata",updatedAt:null},
        {key:"vacuum",code:"VAC",name:"Вакуум",value:null,status:"nodata",updatedAt:null}
      ]
      return this.state.gases?.length ? this.state.gases : fallback
    },
    overall() {
      const status = this.state.overall || "nodata"
      return { status, label: this.label(status) }
    },
    identity() {
      return this.state.identity || {monitorId:"—",siteName:"Объект не задан",locationName:"Расположение не задано"}
    },
    valves() { return this.state.valves || {enabled:false,status:"disabled"} },
    valveLabel() {
      return ({normal:"ШТАТНЫЙ РЕЖИМ",emergency:"АВАРИЙНЫЙ РЕЖИМ",mismatch:"НЕСООТВЕТСТВИЕ",nodata:"НЕТ ДАННЫХ"})[this.valves.status] || "НЕТ ДАННЫХ"
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
    fmt(value) { return Number.isFinite(Number(value)) ? Number(value).toFixed(1).replace(".", ",") : "—" },
    marker(gas) { return Math.max(0, Math.min(100, Number(gas.value) / Number(gas.limits?.displayMax || 8) * 100)) },
    scale(gas) { const l=gas.limits||{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:8}; return [0,l.warnLow,l.okLow,l.okHigh,l.warnHigh,l.displayMax] },
    zones(gas) {
      const l=gas.limits||{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:8}; const max=l.displayMax||8
      const values=[l.warnLow,l.okLow-l.warnLow,l.okHigh-l.okLow,l.warnHigh-l.okHigh,max-l.warnHigh]
      return ["alarm-low","warn-low","ok","warn-high","alarm-high"].map((name,i)=>({name,width:Math.max(0,values[i])/max*100}))
    },
    updated(gas) { return gas.updatedAt ? "Обновлено " + new Date(gas.updatedAt).toLocaleTimeString("ru-RU") : "Ожидание данных" }
  }
}
</script>

<style>
@media(min-width:901px){html:has(.gm-page),body:has(.gm-page){overflow:hidden!important}}
.nrdb-ui-page.gm-page,.nrdb-ui-group.gm-group,.nrdb-ui-group.gm-group>.v-card{height:100dvh!important;min-height:100dvh!important}
.nrdb-ui-group.gm-group>.v-card{border:0!important;border-radius:0!important;background:#071521!important}
.nrdb-ui-group.gm-group>.v-card>.v-card-text{height:100%!important;padding:0!important}
.nrdb-ui-group.gm-group .nrdb-layout-group--grid{height:100%!important;grid-template-rows:minmax(0,1fr)!important}
.nrdb-ui-group.gm-group .gm-widget{height:100%!important;grid-row:1!important;grid-template-rows:minmax(0,1fr)!important;overflow:hidden!important}
.gm-shell{height:100dvh;min-height:560px;box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;padding:24px;color:#eef6ff;background:radial-gradient(circle at 15% 0,#173b59 0,transparent 34%),#071521;font-family:Inter,Segoe UI,sans-serif}
.gm-shell *{box-sizing:border-box}
.gm-header{display:grid;grid-template-columns:1fr auto auto auto;gap:16px;align-items:center;margin-bottom:18px}
.gm-eyebrow{margin:0 0 7px;color:#7fa8c5;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.gm-header h1{margin:0;font-size:clamp(24px,3vw,40px);line-height:1.05}.gm-monitor-id{margin:5px 0 0;color:#8fa9bb;font-size:12px}
.gm-head-status,.gm-valves,.gm-clock{min-height:66px;padding:10px 15px;border:1px solid #31516a;border-radius:14px;background:#102638}.gm-head-status{display:flex;align-items:center;gap:12px}.gm-valves,.gm-clock{display:grid;align-content:center}.gm-clock time{font-size:18px;font-variant-numeric:tabular-nums;white-space:nowrap}.gm-head-status small,.gm-head-status strong,.gm-valves small,.gm-valves strong,.gm-clock small,.gm-clock time{display:block}.gm-head-status small,.gm-valves small,.gm-clock small{color:#94afc2;font-size:10px;text-transform:uppercase}.gm-head-status strong,.gm-valves strong{font-size:16px}.gm-valves.is-normal{border-color:#237b59}.gm-valves.is-emergency,.gm-valves.is-mismatch{border-color:#a83e4a;color:#ff8995}.gm-dot{width:14px;height:14px;border-radius:50%;background:#7c8b96;box-shadow:0 0 16px currentColor}
.gm-grid{display:grid;gap:14px;min-height:0}.gm-grid.count-3{grid-template-columns:repeat(3,minmax(0,1fr))}.gm-grid.count-4{grid-template-columns:repeat(2,minmax(0,1fr))}.gm-grid.count-5{grid-template-columns:repeat(6,minmax(0,1fr))}.gm-grid.count-5 .gm-card{grid-column:span 2}.gm-grid.count-5 .gm-card:nth-child(4){grid-column:2/span 2}.gm-card{position:relative;display:flex;min-height:0;flex-direction:column;padding:16px;border:1px solid #29465c;border-top:5px solid #71808b;border-radius:18px;background:linear-gradient(145deg,#102738,#0b1d2b);box-shadow:0 16px 38px #0005}.gm-card.is-ok{border-top-color:#25c77c}.gm-card.is-warn{border-top-color:#f6b73c}.gm-card.is-alarm{border-top-color:#ff5364;animation:gm-alarm-pulse 2.4s ease-in-out infinite}.gm-card-head{display:flex;justify-content:space-between;gap:10px}.gm-card-head p{margin:0;color:#64b9ea;font-size:20px;font-weight:900;line-height:1.1;letter-spacing:.04em}.gm-card h2{min-height:30px;margin:4px 0 0;font-size:21px}.gm-badge{min-width:110px;height:max-content;padding:9px 11px;border-radius:10px;background:#263b4a;color:#cbd8e2;font-size:12px;font-weight:900;letter-spacing:.06em;text-align:center}.is-ok .gm-badge{background:#143e30;color:#5de3a4}.is-warn .gm-badge{background:#4a3613;color:#ffd36b}.is-alarm .gm-badge{background:#4c2028;color:#ff8995}
@keyframes gm-alarm-pulse{0%,100%{box-shadow:0 0 0 1px #ff536426,0 0 14px #ff53641f,0 16px 38px #0005}50%{box-shadow:0 0 0 4px #ff536438,0 0 32px #ff53643d,0 16px 38px #0005}}
@media(prefers-reduced-motion:reduce){.gm-card.is-alarm{animation:none;box-shadow:0 0 0 3px #ff536433,0 0 24px #ff536433,0 16px 38px #0005}}
.gm-value{display:flex;flex:1;min-height:70px;align-items:center;justify-content:center;gap:10px;margin:8px 0}.gm-value strong{color:#eef6ff;font-size:clamp(58px,7vw,112px);line-height:.9;font-variant-numeric:tabular-nums;transition:color .2s ease}.gm-card.is-ok .gm-value strong{color:#5de3a4}.gm-card.is-warn .gm-value strong{color:#ffd36b}.gm-card.is-alarm .gm-value strong{color:#ff7080}.gm-value span{align-self:center;color:#94afc2;font-size:20px}
.gm-track{position:relative;display:flex;height:14px;overflow:visible;border-radius:8px}.gm-track .zone{height:100%}.alarm-low,.alarm-high{background:#c83c4b}.warn-low,.warn-high{background:#d99b27}.gm-track .ok{background:#1b9e62}.gm-track i{position:absolute;top:-7px;width:4px;height:28px;transform:translateX(-2px);border-radius:3px;background:#fff;box-shadow:0 0 10px #fff}.gm-scale{display:flex;justify-content:space-between;margin-top:8px;color:#819bad;font-size:11px}.gm-card footer{display:flex;justify-content:space-between;gap:10px;margin-top:12px;color:#8fa9bb;font-size:11px}
.gm-footer{display:flex;align-items:center;gap:20px;margin-top:8px;padding:12px 4px 0;color:#a5bac9;font-size:12px}.gm-footer span{display:flex;align-items:center;gap:6px}.legend{width:9px;height:9px;border-radius:50%}.legend.ok{background:#25c77c}.legend.warn{background:#f6b73c}.legend.alarm{background:#ff5364}.legend.nodata{background:#71808b}.gm-footer nav{display:flex;gap:14px;margin-left:auto}.gm-footer a{color:#72c7f5;font-weight:700;text-decoration:none}
@media(min-width:1600px){.gm-grid.count-4{grid-template-columns:repeat(4,minmax(0,1fr))}.gm-grid.count-5{grid-template-columns:repeat(5,minmax(0,1fr))}.gm-grid.count-5 .gm-card,.gm-grid.count-5 .gm-card:nth-child(4){grid-column:auto}.gm-card{padding:20px}}
@media(max-height:800px) and (min-width:901px){.gm-shell{padding:14px 18px}.gm-header{margin-bottom:12px}.gm-eyebrow{margin-bottom:3px}.gm-head-status,.gm-valves,.gm-clock{min-height:58px;padding:8px 12px}.gm-footer{padding-top:6px}.gm-card h2{font-size:19px}.gm-value strong{font-size:clamp(48px,6vw,78px)}}
@media(max-width:900px){.nrdb-ui-page.gm-page,.nrdb-ui-group.gm-group,.nrdb-ui-group.gm-group>.v-card{height:auto!important;min-height:100dvh!important}.gm-shell{height:auto;min-height:100dvh;overflow:visible}.gm-header{grid-template-columns:1fr auto}.gm-clock,.gm-valves{display:none}.gm-grid,.gm-grid.count-3,.gm-grid.count-4,.gm-grid.count-5{grid-template-columns:1fr}.gm-grid.count-5 .gm-card,.gm-grid.count-5 .gm-card:nth-child(4){grid-column:auto}.gm-card h2{min-height:0}.gm-footer{flex-wrap:wrap}.gm-footer a{width:100%;margin:0}}@media(max-width:560px){.gm-shell{padding:14px}.gm-header{grid-template-columns:1fr}.gm-head-status{width:max-content}.gm-card footer{flex-direction:column}.gm-footer{gap:10px}}
</style>`;

const historyTemplate = String.raw`<template>
<main class="gh-shell"><header><div><p>{{identityLine}} · архив измерений</p><h1>История давления</h1></div><nav><a href="/dashboard/monitoring">Мониторинг</a><a href="/dashboard/events">События</a></nav></header>
<section class="gh-controls"><label>Газ<select v-model="gas"><option value="oxygen">Кислород</option><option value="air">Сжатый воздух</option><option value="vacuum">Вакуум</option><option value="n2o">Закись азота</option><option value="co2">Углекислый газ</option></select></label><div class="gh-ranges"><button v-for="item in ranges" :key="item.value" :class="{active:range===item.value}" @click="selectRange(item.value)">{{item.label}}</button></div><label>С<input type="datetime-local" v-model="start"></label><label>По<input type="datetime-local" v-model="stop"></label><button class="apply" @click="request">Применить</button></section>
<section class="gh-panel"><div class="gh-summary"><div><small>Газ</small><strong>{{gasName}}</strong></div><div><small>Точек</small><strong>{{points.length}}</strong></div><div><small>Последнее</small><strong>{{lastValue}}</strong></div><div><small>Статус</small><strong :class="'text-'+status">{{statusLabel}}</strong></div></div>
<div v-if="loading" class="gh-empty">Загрузка…</div><div v-else-if="error" class="gh-empty error">{{error}}</div><div v-else-if="!points.length" class="gh-empty">За выбранный период данных нет</div>
<div v-else class="gh-chart"><div class="axis-label top">{{fmt(limits.displayMax)}} бар</div><div class="axis-label bottom">0 бар</div><svg viewBox="0 0 1000 360" preserveAspectRatio="none" aria-label="График давления"><line v-for="y in [0,90,180,270,360]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" class="grid"/><rect x="0" :y="zoneY" width="1000" :height="zoneHeight" class="normal-zone"/><polyline v-for="(segment,i) in segments" :key="i" :points="segment" class="line"/><circle v-for="(p,i) in chartPoints" :key="i" :cx="p.x" :cy="p.y" r="3.5" class="point"><title>{{tooltip(p.source)}}</title></circle></svg><div class="gh-time"><span>{{firstTime}}</span><span>{{lastTime}}</span></div><p class="gh-note">Разрывы линии означают отсутствие сохранённых измерений. Тревоги смотрите в журнале событий.</p></div></section></main>
</template><script>
export default{data(){return{gas:"oxygen",range:"24h",start:"",stop:"",loading:false,error:"",points:[],identity:{},windowMs:300000,limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:10},ranges:[{value:"1h",label:"1 час"},{value:"24h",label:"24 часа"},{value:"7d",label:"7 дней"},{value:"30d",label:"30 дней"}]}},computed:{identityLine(){return [this.identity.siteName,this.identity.locationName,this.identity.monitorId].filter(Boolean).join(" · ")||"Установка не задана"},gasName(){return({oxygen:"Кислород",air:"Сжатый воздух",vacuum:"Вакуум",n2o:"Закись азота",co2:"Углекислый газ"})[this.gas]},chartPoints(){if(!this.points.length)return[];const first=Date.parse(this.points[0].time),last=Date.parse(this.points.at(-1).time),span=Math.max(1,last-first),max=Number(this.limits.displayMax)||10;return this.points.map(p=>({x:(Date.parse(p.time)-first)/span*1000,y:360-Math.max(0,Math.min(max,p.value))/max*360,source:p}))},segments(){const result=[];let current=[];this.chartPoints.forEach((p,i)=>{if(i&&Date.parse(p.source.time)-Date.parse(this.chartPoints[i-1].source.time)>this.windowMs*2.5){if(current.length)result.push(current.join(" "));current=[]}current.push(p.x.toFixed(1)+","+p.y.toFixed(1))});if(current.length)result.push(current.join(" "));return result},zoneY(){return 360-(this.limits.okHigh/this.limits.displayMax*360)},zoneHeight(){return (this.limits.okHigh-this.limits.okLow)/this.limits.displayMax*360},last(){return this.points.at(-1)},lastValue(){return this.last?this.fmt(this.last.value)+" бар":"—"},status(){return this.last?.status||"nodata"},statusLabel(){return({ok:"НОРМА",warn:"ВНИМАНИЕ",alarm:"АВАРИЯ",nodata:"НЕТ ДАННЫХ"})[this.status]},firstTime(){return this.points.length?new Date(this.points[0].time).toLocaleString("ru-RU"):""},lastTime(){return this.last?new Date(this.last.time).toLocaleString("ru-RU"):""}},watch:{msg:{deep:true,handler(value){const p=value?.payload;if(p?.kind!=="history")return;this.loading=false;this.error=p.error||"";this.points=p.points||[];this.identity=p.identity||{};this.windowMs=p.windowMs||300000;if(p.limits)this.limits=p.limits;if(p.gas)this.gas=p.gas}}},mounted(){this.request()},methods:{fmt(v){return Number(v).toFixed(1).replace(".",",")},selectRange(v){this.range=v;this.start="";this.stop="";this.request()},request(){if((this.start&&!this.stop)||(!this.start&&this.stop)){this.error="Укажите обе границы периода";return}this.loading=true;this.error="";this.send({payload:{action:"query",gas:this.gas,range:this.range,start:this.start,stop:this.stop}})},tooltip(p){return new Date(p.time).toLocaleString("ru-RU")+" · "+this.fmt(p.value)+" бар"}}}
</script><style>
.nrdb-ui-group.gh-group .nrdb-layout-group--grid{min-height:calc(100dvh - 48px)!important;grid-template-rows:minmax(0,1fr)!important}.nrdb-ui-group.gh-group .gh-widget{height:100%!important;grid-row:1!important;grid-template-rows:minmax(0,1fr)!important;overflow:auto!important}.gh-shell{min-height:calc(100dvh - 48px);box-sizing:border-box;padding:20px 24px;color:#ecf5fc;background:#071521;font-family:Inter,Segoe UI,sans-serif}.gh-shell *{box-sizing:border-box}.gh-shell header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.gh-shell header p{margin:0 0 4px;color:#7fa8c5;font-size:13px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.gh-shell h1{margin:0;font-size:32px}.gh-shell nav{display:flex;gap:16px}.gh-shell header a{color:#72c7f5;font-weight:700;text-decoration:none}.gh-controls{display:grid;grid-template-columns:1.3fr 2fr 1.2fr 1.2fr auto;gap:12px;align-items:end;padding:12px 16px;border:1px solid #29465c;border-radius:16px;background:#102738}.gh-controls label{display:grid;gap:4px;color:#93acbd;font-size:12px}.gh-controls select,.gh-controls input{height:38px;padding:0 11px;border:1px solid #34556d;border-radius:8px;color:#eaf4fb;background:#0a1c29}.gh-ranges{display:flex;gap:6px}.gh-ranges button,.apply{height:38px;padding:0 13px;border:1px solid #34556d;border-radius:8px;color:#c9d9e5;background:#132f42;cursor:pointer}.gh-ranges button.active,.apply{border-color:#159ee0;color:#fff;background:#0878ad}.gh-panel{margin-top:12px;padding:14px 18px;border:1px solid #29465c;border-radius:16px;background:#0d2232}.gh-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}.gh-summary div{padding:9px 12px;border-radius:10px;background:#132c3e}.gh-summary small,.gh-summary strong{display:block}.text-ok{color:#3ed592}.text-warn{color:#ffc85c}.text-alarm{color:#ff7080}.text-nodata{color:#92a2ae}.gh-chart{position:relative;height:min(400px,46dvh);padding:8px 20px 48px 42px}.gh-chart svg{width:100%;height:100%;overflow:visible}.grid{stroke:#254256;stroke-width:1}.normal-zone{fill:#1e9f6320}.line{fill:none;stroke:#4cc5ff;stroke-width:4;vector-effect:non-scaling-stroke}.point{fill:#eaf8ff;stroke:#179edc;stroke-width:2;vector-effect:non-scaling-stroke}.axis-label{position:absolute;left:0;color:#7894a7;font-size:11px}.axis-label.top{top:8px}.axis-label.bottom{bottom:44px}.gh-time{display:flex;justify-content:space-between;color:#7894a7;font-size:11px}.gh-note{margin:6px 0;color:#7894a7;font-size:11px}.gh-empty{display:grid;min-height:350px;place-items:center;color:#89a4b6}.gh-empty.error{color:#ff7b88}@media(max-width:1000px){.gh-controls{grid-template-columns:1fr 1fr}.gh-ranges{grid-column:1/-1}.gh-summary{grid-template-columns:1fr 1fr}}@media(max-width:600px){.gh-shell{padding:14px}.gh-controls{grid-template-columns:1fr}.gh-ranges{grid-column:auto;flex-wrap:wrap}.gh-summary{grid-template-columns:1fr}.gh-chart{height:320px}}
</style>`;

const eventsTemplate = String.raw`<template><main class="ge-shell"><header><div><p>{{identityLine}} · журнал</p><h1>События мониторинга</h1></div><nav><a href="/dashboard/monitoring">Мониторинг</a><a href="/dashboard/history">История</a></nav></header><section class="ge-controls"><label>Источник<select v-model="gas"><option value="all">Все</option><option value="oxygen">Кислород</option><option value="air">Сжатый воздух</option><option value="vacuum">Вакуум</option><option value="n2o">Закись азота</option><option value="co2">Углекислый газ</option><option value="valves">Клапаны</option><option value="system">Система</option></select></label><label>Период<select v-model="range"><option value="24h">24 часа</option><option value="7d">7 дней</option><option value="30d">30 дней</option></select></label><button @click="request">Обновить</button></section><section class="ge-panel"><div v-if="loading" class="empty">Загрузка…</div><div v-else-if="error" class="empty error">{{error}}</div><div v-else-if="!events.length" class="empty">Событий нет</div><table v-else><thead><tr><th>Время</th><th>Источник</th><th>Переход</th><th>Значение</th><th>Причина / оператор</th></tr></thead><tbody><tr v-for="(event,i) in events" :key="i" :class="'is-'+event.to"><td>{{time(event.time)}}</td><td>{{event.name}}</td><td>{{label(event.from)}} → {{label(event.to)}}</td><td>{{formatValue(event)}}</td><td>{{event.reason||event.operator||"—"}}</td></tr></tbody></table></section></main></template><script>
export default{data(){return{gas:"all",range:"24h",loading:false,error:"",events:[],identity:{}}},computed:{identityLine(){return [this.identity.siteName,this.identity.locationName,this.identity.monitorId].filter(Boolean).join(" · ")||"Установка не задана"}},watch:{msg:{deep:true,handler(v){const p=v?.payload;if(p?.kind!=="events")return;this.loading=false;this.error=p.error||"";this.events=p.events||[];this.identity=p.identity||{}}}},mounted(){this.request()},methods:{request(){this.loading=true;this.send({payload:{action:"query-events",gas:this.gas,range:this.range}})},time(v){return new Date(v).toLocaleString("ru-RU")},label(v){return({ok:"НОРМА",warn:"ВНИМАНИЕ",alarm:"АВАРИЯ",nodata:"НЕТ ДАННЫХ",startup:"ЗАПУСК",settings:"НАСТРОЙКИ",changed:"ИЗМЕНЕНЫ",normal:"ШТАТНЫЙ РЕЖИМ",emergency:"АВАРИЙНЫЙ РЕЖИМ",mismatch:"НЕСООТВЕТСТВИЕ"})[v]||v||"—"},formatValue(e){if(!e.hasValue)return"—";return e.gas==="valves"?(Number(e.value)===1?"1 — штатный":"0 — аварийный"):Number(e.value).toFixed(1).replace(".",",")+" бар"}}}
</script><style>.nrdb-ui-group.ge-group .nrdb-layout-group--grid{min-height:calc(100dvh - 48px)!important;grid-template-rows:minmax(0,1fr)!important}.nrdb-ui-group.ge-group .ge-widget{height:100%!important;overflow:auto!important}.ge-shell{min-height:calc(100dvh - 48px);box-sizing:border-box;padding:24px;color:#ecf5fc;background:#071521;font-family:Inter,Segoe UI,sans-serif}.ge-shell *{box-sizing:border-box}.ge-shell header{display:flex;justify-content:space-between;align-items:center}.ge-shell header p{margin:0;color:#7fa8c5}.ge-shell h1{margin:5px 0 18px}.ge-shell nav{display:flex;gap:16px}.ge-shell a{color:#72c7f5;text-decoration:none;font-weight:700}.ge-controls{display:flex;gap:12px;padding:14px;border:1px solid #29465c;border-radius:14px;background:#102738}.ge-controls label{display:grid;gap:5px;color:#93acbd;font-size:12px}.ge-controls select,.ge-controls button{height:40px;padding:0 12px;border:1px solid #34556d;border-radius:8px;color:#eaf4fb;background:#0a1c29}.ge-controls button{align-self:end;background:#0878ad}.ge-panel{margin-top:15px;overflow:auto;border:1px solid #29465c;border-radius:14px;background:#0d2232}.ge-panel table{width:100%;border-collapse:collapse}.ge-panel th,.ge-panel td{padding:12px;text-align:left;border-bottom:1px solid #213d50}.ge-panel th{color:#8fa9bb}.ge-panel tr.is-alarm{border-left:4px solid #ff5364}.ge-panel tr.is-warn{border-left:4px solid #f6b73c}.ge-panel tr.is-ok{border-left:4px solid #25c77c}.empty{display:grid;min-height:300px;place-items:center}.error{color:#ff7b88}@media(max-width:700px){.ge-shell{padding:14px}.ge-controls{flex-wrap:wrap}.ge-panel{font-size:12px}}</style>`;

const engineeringTemplate = String.raw`<template><main class="gs-shell"><header><div><p>{{identityLine}} · сервис</p><h1>Состояние и настройки</h1></div><a href="/dashboard/monitoring">← Мониторинг</a></header>
<section class="current-panel"><div class="gs-title"><div><h2>Токовые входы WB-MAI6</h2></div></div><div class="current-grid"><article v-for="input in ['IN1P','IN2P','IN3P','IN4P','IN5P']" :key="input" :class="currentClass(input)"><strong>{{input}}</strong><span>{{currentValue(input)}}</span><small>{{currentStatus(input)}}</small></article></div></section>
<section class="gs-health"><article v-for="item in healthCards" :key="item.name" :class="'is-'+item.status"><small>{{item.name}}</small><strong>{{item.value}}</strong><span>{{item.detail}}</span></article></section>
<section class="gs-panel access"><div class="gs-title"><div><h2>Доступ к настройкам</h2></div><span :class="unlocked?'open':'locked'">{{unlocked?(session.name||"РАЗБЛОКИРОВАНО"):"ТОЛЬКО ЧТЕНИЕ"}}</span></div>
<div v-if="!unlocked" class="access-grid"><div><h3>Исполнитель</h3><input type="password" v-model="code" placeholder="Персональный сервисный код" @keyup.enter="unlock"><button @click="unlock">Войти</button></div><div><h3>Администратор</h3><input type="password" v-model="adminCode" placeholder="Администраторский код" @keyup.enter="adminUnlock"><button @click="adminUnlock">Управление</button></div></div>
<div v-else class="session"><span>Сессия: <strong>{{session.name}}</strong></span><button class="secondary" @click="logout">Завершить</button></div></section>
<section class="gs-panel"><div class="gs-title"><div><h2>Объект и пороговые зоны</h2></div><span v-if="dirty" class="draft">НЕ СОХРАНЕНО</span></div>
<div class="object-settings"><label>ID установки из Debian hostname<input :value="identity.monitorId" disabled></label><label>Название больницы<input v-model="siteName" maxlength="120" :disabled="!unlocked" @input="markDirty"></label><label>Расположение<input v-model="locationName" maxlength="120" :disabled="!unlocked" @input="markDirty"></label></div>
<div class="sensor-title"><div><h3>Датчики и входы WB-MAI6</h3><p>Отметьте от 3 до 5 датчиков, которые должны опрашиваться и отображаться.</p></div><strong>{{gases.filter(gas=>gas.enabled).length}} активно</strong></div>
<div class="settings"><div v-for="gas in gases" :key="gas.key" class="gas" :class="{inactive:!gas.enabled}"><label class="sensor-toggle"><input type="checkbox" v-model="gas.enabled" :disabled="!unlocked" @change="markDirty"><span><strong>{{gas.code}} — {{gas.input}}</strong><small>{{gas.name}}</small></span></label><label>Красная → жёлтая<input type="number" step="0.1" v-model.number="gas.warnLow" :disabled="!unlocked||!gas.enabled" @input="markDirty"></label><label>Жёлтая → зелёная<input type="number" step="0.1" v-model.number="gas.okLow" :disabled="!unlocked||!gas.enabled" @input="markDirty"></label><label>Зелёная → жёлтая<input type="number" step="0.1" v-model.number="gas.okHigh" :disabled="!unlocked||!gas.enabled" @input="markDirty"></label><label>Жёлтая → красная<input type="number" step="0.1" v-model.number="gas.warnHigh" :disabled="!unlocked||!gas.enabled" @input="markDirty"></label></div></div>
<div class="config-grid">
<section class="config-card"><h3>Общие параметры</h3><div class="fields three"><label>Максимум шкалы, бар<input type="number" step="0.1" v-model.number="displayMax" :disabled="!unlocked" @input="markDirty"></label><label>Гистерезис, бар<input type="number" step="0.1" v-model.number="hysteresis" :disabled="!unlocked" @input="markDirty"></label><label>Период полного цикла опроса, мс<input type="number" min="1000" max="10000" step="500" v-model.number="pollIntervalMs" :disabled="!unlocked" @input="markDirty"></label></div><p class="field-hint">Рекомендуется 1000–3000 мс. Значения вне 1000–10000 мс не сохраняются.</p></section>
<section class="config-card"><h3>Modbus-оборудование</h3><div class="fields two"><label>Unit ID WB-MAI6<input type="number" min="1" max="247" step="1" v-model.number="valves.wbMai6UnitId" :disabled="!unlocked" @input="markDirty"></label><label>Unit ID WB-MR3LV/I<input type="number" min="1" max="247" step="1" v-model.number="valves.unitId" :disabled="!unlocked||!valves.enabled" @input="markDirty"></label></div><p class="hint">За одним шлюзом — не более одного модуля каждого типа.</p><div v-if="admin" class="commission-actions"><button @click="prepareHardware('mai6')">Подготовить WB-MAI6</button><button @click="prepareHardware('relay')">Подготовить WB-MR3LV/I</button></div><p v-if="admin" class="hint">Во время подготовки опрос временно остановится. Подключайте только один новый модуль выбранного типа.</p></section>
</div>
<section class="config-card valve-settings"><div class="card-heading"><div><h3>Аварийное управление клапанами</h3><p>Один общий сигнал внешней автоматике через WB-MR3LV/I</p></div><label class="check prominent"><input type="checkbox" v-model="valves.enabled" :disabled="!unlocked" @change="markDirty"> Оборудование установлено</label></div><div class="fields four"><label>Режим<select v-model="valves.controlMode" :disabled="!unlocked||!valves.enabled" @change="markDirty"><option value="monitor">Только контроль</option><option value="automatic">Автоматическое управление</option></select></label><label>Задержка срабатывания, с<input type="number" min="0" step="1" v-model.number="valves.activationDelaySeconds" :disabled="!unlocked||!valves.enabled" @input="markDirty"></label><label>Задержка возврата, с<input type="number" min="0" step="1" v-model.number="valves.recoveryDelaySeconds" :disabled="!unlocked||!valves.enabled" @input="markDirty"></label><label>Таймаут обратной связи, с<input type="number" min="1" step="1" v-model.number="valves.feedbackTimeoutSeconds" :disabled="!unlocked||!valves.enabled" @input="markDirty"></label></div><div class="valve-rules"><label class="check"><input type="checkbox" v-model="valves.triggerOnNoData" :disabled="!unlocked||!valves.enabled" @change="markDirty"> Срабатывать при потере данных</label><fieldset><legend>Какие аварии подают общий сигнал</legend><label class="check" v-for="gas in gases.filter(gas=>gas.enabled)" :key="gas.key"><input type="checkbox" :value="gas.key" v-model="valves.triggerGases" :disabled="!unlocked||!valves.enabled" @change="markDirty"> {{gas.code}} — {{gas.name}} — {{gas.input}}</label></fieldset></div></section>
<div class="save-bar"><div><small>Исполнитель</small><strong>{{session.name||'—'}}</strong></div><button @click="save" :disabled="!unlocked||!dirty">Проверить и сохранить</button></div><p class="message" :class="{error:!success}">{{message}}</p></section>
<section v-if="admin" class="gs-panel admin"><div class="gs-title"><div><h2>Администрирование доступа</h2><p>Коды и пароли после сохранения повторно не отображаются.</p></div></div>
<div class="admin-grid"><div><h3>Исполнители</h3><div class="create"><input v-model="newOperatorName" maxlength="120" placeholder="ФИО исполнителя"><input type="password" v-model="newOperatorCode" placeholder="Персональный код, минимум 8 символов"><button @click="addOperator">Добавить</button></div><ul><li v-for="item in operators" :key="item.id"><span class="admin-identity"><strong>{{item.name}}</strong><small>{{date(item.createdAt)}}</small></span><button class="danger" @click="deleteOperator(item)">Удалить</button></li></ul></div>
<div><h3>Удалённые пользователи</h3><div class="create"><input v-model="newRemoteUser" maxlength="32" placeholder="Логин"><input type="password" v-model="newRemotePassword" placeholder="Пароль, минимум 10 символов"><button @click="addRemoteUser">Добавить</button></div><ul><li v-for="item in remoteUsers" :key="item.username"><span class="admin-identity"><strong>{{item.username}}</strong><small>{{date(item.createdAt)}}</small></span><button class="danger" @click="deleteRemoteUser(item)">Удалить</button></li></ul></div></div></section>
</main></template><script>
export default{data(){return{health:{},identity:{},siteName:"",locationName:"",gases:[],channelCount:3,displayMax:10,hysteresis:.1,pollIntervalMs:1000,valves:{enabled:false,controlMode:"monitor",triggerGases:[],triggerOnNoData:false,activationDelaySeconds:0,recoveryDelaySeconds:5,feedbackTimeoutSeconds:5},unlocked:false,admin:false,session:{},operators:[],remoteUsers:[],code:"",adminCode:"",newOperatorName:"",newOperatorCode:"",newRemoteUser:"",newRemotePassword:"",dirty:false,message:"",success:true,timer:null}},computed:{identityLine(){return [this.identity.siteName,this.identity.locationName,this.identity.monitorId].filter(Boolean).join(" · ")||"Установка не задана"},activeGases(){return this.gases.slice(0,this.channelCount)},healthCards(){const h=this.health||{},g=h.gases||{};const age=k=>g[k]?.ageSeconds==null?"нет данных":g[k].ageSeconds+" с";const codes={oxygen:"O₂",air:"AIR",vacuum:"VAC",n2o:"N₂O",co2:"CO₂"};const cards=this.activeGases.map(x=>({name:codes[x.key]+" / Modbus",value:age(x.key),detail:"с последнего измерения",status:g[x.key]?.fresh?"ok":"bad"}));cards.push({name:"InfluxDB",value:h.influx?.status||"ожидание",detail:h.influx?.lastSuccessUtc||"нет успешной записи",status:h.influx?.status==="ok"?"ok":"bad"},{name:"MAX",value:h.max?.status||"отключён",detail:h.max?.lastSuccessUtc||"нет доставки",status:["ok","disabled"].includes(h.max?.status)?"ok":"bad"});return cards}},watch:{msg:{deep:true,handler(v){const p=v?.payload;if(p?.kind==="engineering-users"){this.success=p.success!==false;this.message=p.message||"";if(Array.isArray(p.users))this.remoteUsers=p.users;return}if(p?.kind!=="engineering")return;this.health=p.health||{};this.identity=p.identity||{};this.unlocked=!!p.unlocked;this.admin=!!p.admin;this.session=p.session||{};this.operators=p.operators||[];this.success=p.success!==false;this.message=p.message||"";if(p.settings&&(!this.dirty||p.saved)){this.siteName=p.settings.siteName||"";this.locationName=p.settings.locationName||"";this.gases=p.settings.gases.map(x=>({...x}));this.channelCount=p.settings.channelCount||3;this.displayMax=p.settings.displayMax;this.hysteresis=p.settings.hysteresis;this.pollIntervalMs=p.settings.pollIntervalMs||1000;this.valves={...this.valves,...p.settings.valves,triggerGases:[...(p.settings.valves?.triggerGases||[])]};if(p.saved)this.dirty=false}if(this.admin&&p.loadRemoteUsers)this.sendAction("engineering-users-load")}}},mounted(){this.load();this.timer=setInterval(()=>this.load(),5000)},unmounted(){clearInterval(this.timer)},methods:{current(input){const key={IN1P:"oxygen",IN2P:"air",IN3P:"vacuum",IN4P:"n2o",IN5P:"co2"}[input];const item=this.health?.gases?.[key];const currentMa=Number(item?.currentMa);const fresh=item?.fresh===true&&Number.isFinite(currentMa);return{currentMa,fresh}},currentClass(input){const item=this.current(input);return{"is-live":item.fresh,"is-low":item.fresh&&item.currentMa<3.5}},currentValue(input){const item=this.current(input);return item.fresh?item.currentMa.toFixed(3)+" mA":"—"},currentStatus(input){const item=this.current(input);if(!item.fresh)return"не опрашивается / нет данных";if(item.currentMa<3.5)return"обрыв / нет сигнала";if(item.currentMa<4)return"валидный ноль";return"сигнал в диапазоне"},sendAction(action,extra={}){this.send({payload:{action,...extra}})},load(){this.sendAction("engineering-load")},markDirty(){this.dirty=true},unlock(){this.sendAction("engineering-unlock",{code:this.code});this.code=""},adminUnlock(){this.sendAction("engineering-admin-unlock",{code:this.adminCode});this.adminCode=""},logout(){this.sendAction("engineering-logout")},save(){this.sendAction("engineering-save",{settings:{siteName:this.siteName,locationName:this.locationName,gases:this.gases,channelCount:this.channelCount,displayMax:this.displayMax,hysteresis:this.hysteresis,pollIntervalMs:this.pollIntervalMs,valves:this.valves}})},addOperator(){this.sendAction("engineering-operator-add",{name:this.newOperatorName,code:this.newOperatorCode});this.newOperatorCode="";this.newOperatorName=""},deleteOperator(item){if(confirm("Удалить исполнителя «"+item.name+"»?"))this.sendAction("engineering-operator-delete",{id:item.id})},addRemoteUser(){this.sendAction("engineering-user-add",{username:this.newRemoteUser,password:this.newRemotePassword});this.newRemotePassword="";this.newRemoteUser=""},prepareHardware(device){const label=device==="mai6"?"WB-MAI6":"WB-MR3LV/I";if(confirm("Остановить опрос и подготовить "+label+"?"))this.sendAction("engineering-prepare-hardware",{device})},deleteRemoteUser(item){if(confirm("Удалить удалённого пользователя «"+item.username+"»?"))this.sendAction("engineering-user-delete",{username:item.username})},date(v){return v?new Date(v).toLocaleString("ru-RU"):"—"}}}
</script><style>.nrdb-ui-group.gs-group .nrdb-layout-group--grid{min-height:calc(100dvh - 48px)!important;grid-template-rows:minmax(0,1fr)!important}.nrdb-ui-group.gs-group .gs-widget{height:100%!important;overflow:auto!important}.gs-shell{min-height:calc(100dvh - 48px);box-sizing:border-box;padding:22px;color:#ecf5fc;background:#071521;font-family:Inter,Segoe UI,sans-serif}.gs-shell *{box-sizing:border-box}.gs-shell header{display:flex;justify-content:space-between}.gs-shell header p{margin:0;color:#7fa8c5}.gs-shell h1{margin:5px 0 16px}.gs-shell a{color:#72c7f5;text-decoration:none;font-weight:700}.gs-health{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.gs-health article{padding:13px;border:1px solid #29465c;border-top:4px solid #ff5364;border-radius:12px;background:#102738}.gs-health article.is-ok{border-top-color:#25c77c}.gs-health small,.gs-health strong,.gs-health span{display:block}.gs-health strong{margin:7px 0;font-size:18px}.gs-health span{color:#8fa9bb;font-size:11px}.gs-panel{margin-top:14px;padding:16px;border:1px solid #29465c;border-radius:14px;background:#0d2232}.gs-title{display:flex;justify-content:space-between}.gs-title h2,.gs-title p{margin:0 0 5px}.gs-title span{height:max-content;padding:7px 10px;border-radius:7px;font-size:11px;font-weight:800}.locked{background:#48242a;color:#ff8995}.open{background:#143e30;color:#5de3a4}.draft{background:#4a3613;color:#ffd36b}.access-grid,.admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}.access-grid>div,.admin-grid>div{padding:12px;border-radius:10px;background:#132c3e}.access-grid h3,.admin-grid h3{margin:0 0 9px}.access-grid input,.create input{width:calc(100% - 110px);margin-right:8px}.session{display:flex;align-items:center;justify-content:space-between;margin-top:12px}.global{display:flex;gap:10px;margin:12px 0}.object-settings{display:grid;grid-template-columns:1fr 1.4fr 1.4fr;gap:10px;margin:12px 0}.object-settings label,.gas label,.global label{display:grid;gap:4px;margin:6px 0;color:#91aaba;font-size:11px}.object-settings input,.gas input,.global input,.access-grid input,.create input{height:36px;padding:0 9px;border:1px solid #34556d;border-radius:7px;color:#eef6ff;background:#091a27}.object-settings input:disabled,.global input:disabled{color:#9db2c1;background:#0a1a25}.settings{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.gas{padding:12px;border-radius:10px;background:#132c3e}.gas h3{margin:0 0 8px}.global{align-items:end}.global label{flex:1}.gs-panel button{height:36px;padding:0 12px;border:0;border-radius:7px;color:#fff;background:#0878ad}.gs-panel button:disabled{opacity:.4}.gs-panel button.secondary{background:#334b5c}.gs-panel button.danger{background:#7b2933}.create{display:flex}.admin ul{margin:12px 0 0;padding:0;list-style:none}.admin li{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 0;border-top:1px solid #29465c}.admin-identity{display:flex;min-width:0;align-items:baseline;gap:12px}.admin-identity small{color:#829aac;white-space:nowrap}.message{min-height:18px;color:#5de3a4}.message.error{color:#ff8995}@media(max-width:1000px){.gs-health{grid-template-columns:repeat(2,1fr)}.object-settings,.settings,.access-grid,.admin-grid{grid-template-columns:1fr}.global{flex-wrap:wrap}}@media(max-width:600px){.gs-shell{padding:14px}.gs-health{grid-template-columns:1fr}.create{display:grid;gap:8px}.create input{width:100%;margin:0}.admin-identity{align-items:flex-start;flex-direction:column;gap:3px}}</style>`;

const pollBuilderCode = `if(Number(flow.get("hardwareCommissioning"))>Date.now())return null;const settings=flow.get("runtimeSettings")||{};const configuredInterval=Number(settings.pollIntervalMs);const fallbackInterval=Number(env.get("MODBUS_POLL_INTERVAL_MS"))||1000;const pollIntervalMs=Number.isInteger(configuredInterval)&&configuredInterval>=1000&&configuredInterval<=10000?configuredInterval:fallbackInterval;const now=Date.now();const lastPollAt=Number(context.get("lastPollAt"))||0;if(now-lastPollAt<pollIntervalMs)return null;context.set("lastPollAt",now);const configured=Number(settings.valves?.wbMai6UnitId);const fallback=Number(env.get("MODBUS_UNIT_ID"))||65;const unitid=Number.isInteger(configured)&&configured>=1&&configured<=247?configured:fallback;const enabled=new Set(Array.isArray(settings.gases)&&settings.gases.some(gas=>typeof gas.enabled==="boolean")?settings.gases.filter(gas=>gas.enabled).map(gas=>gas.key):["oxygen","air","vacuum"]);const requests=[
  ["oxygen",5376,2],["air",9472,2],["vacuum",13568,2],["n2o",17664,2],["co2",21760,2],["valvefeedback",25860,1]
].filter(([name])=>name==="valvefeedback"||enabled.has(name));return [requests.map(([name,address,quantity])=>({topic:name,modbusRequest:{name},payload:{fc:4,unitid,address,quantity}}))];`;

const engineeringLayoutStyles = `
.current-panel{margin-top:14px;padding:16px;border:1px solid #29465c;border-radius:14px;background:#0d2232}.current-panel+.gs-health{margin-top:16px}.current-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:12px}.current-grid article{display:grid;gap:5px;padding:12px;border:1px solid #45515a;border-radius:10px;background:#152631}.current-grid article.is-live{border-color:#25c77c}.current-grid article.is-low{border-color:#ff5364}.current-grid strong{font-size:13px;color:#9ab1c1}.current-grid span{font-size:22px;font-weight:800;color:#eef6ff}.current-grid small{color:#86a2b5}@media(max-width:800px){.current-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.fields.three{grid-template-columns:repeat(3,minmax(0,1fr))}.field-hint{margin:8px 0 0;color:#f6c86b;font-size:12px;line-height:1.35}@media(max-width:1000px){.fields.three{grid-template-columns:1fr}}
.config-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.config-card{margin-top:12px;padding:16px;border:1px solid #29465c;border-radius:12px;background:#132c3e}.config-grid .config-card{margin-top:0}.config-card h3{margin:0 0 12px}.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.card-heading p,.hint{margin:3px 0 0;color:#86a2b5;font-size:12px}.fields{display:grid;gap:12px}.fields.two{grid-template-columns:repeat(2,minmax(0,1fr))}.fields.four{grid-template-columns:repeat(4,minmax(0,1fr))}.fields label{display:grid;gap:6px;color:#9ab1c1;font-size:12px}.fields input,.fields select{width:100%;height:40px;padding:0 11px;border:1px solid #34556d;border-radius:8px;color:#eef6ff;background:#091a27}.fields input:disabled,.fields select:disabled{color:#738998;background:#0a1a25}.check{display:flex!important;align-items:center;gap:8px;color:#d9e7f0;font-size:13px}.check input{width:17px;height:17px;accent-color:#159ee0}.check.prominent{padding:10px 12px;border-radius:9px;background:#0c2130}.valve-rules{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;margin-top:16px}.valve-rules fieldset{display:flex;flex-wrap:wrap;gap:12px;margin:0;padding:11px 14px;border:1px solid #34556d;border-radius:9px}.valve-rules legend{padding:0 7px;color:#9ab1c1;font-size:12px}.save-bar{display:flex;align-items:center;justify-content:flex-end;gap:18px;margin-top:14px;padding-top:12px;border-top:1px solid #29465c}.save-bar div{display:grid;min-width:180px}.save-bar small{color:#86a2b5}.save-bar button{min-width:220px}@media(max-width:1000px){.config-grid{grid-template-columns:1fr}.fields.four{grid-template-columns:repeat(2,1fr)}.valve-rules{grid-template-columns:1fr}}@media(max-width:600px){.fields.two,.fields.four{grid-template-columns:1fr}.card-heading,.save-bar{align-items:stretch;flex-direction:column}.save-bar button{width:100%}}
.sensor-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:16px 0 10px}.sensor-title h3,.sensor-title p{margin:0}.sensor-title p{margin-top:4px;color:#86a2b5;font-size:12px}.sensor-title>strong{padding:7px 10px;border-radius:8px;color:#5de3a4;background:#143e30;white-space:nowrap}.sensor-toggle{display:flex!important;align-items:center;gap:10px;margin:0 0 10px!important;padding-bottom:10px;border-bottom:1px solid #29465c}.sensor-toggle input{width:19px;height:19px;accent-color:#159ee0}.sensor-toggle span,.sensor-toggle strong,.sensor-toggle small{display:block}.sensor-toggle strong{color:#ecf5fc;font-size:15px}.sensor-toggle small{margin-top:2px;color:#8fa9bb}.gas.inactive{opacity:.58}.gas.inactive .sensor-toggle{opacity:1}@media(max-width:600px){.sensor-title{align-items:flex-start;flex-direction:column}}
`;

const normalizeCode = `const channels = {
  oxygen: { code: "O₂", name: "Кислород", prefix: "OXYGEN" },
  air: { code: "AIR", name: "Сжатый воздух", prefix: "AIR" },
  vacuum: { code: "VAC", name: "Вакуум", prefix: "VACUUM" },
  n2o: { code: "N₂O", name: "Закись азота", prefix: "N2O" },
  co2: { code: "CO₂", name: "Углекислый газ", prefix: "CO2" }
};
msg.topic = msg.modbusRequest?.name || msg.topic;
if (msg.topic === "valvefeedback") {
  const source = Array.isArray(msg.payload?.data) ? msg.payload.data : (Array.isArray(msg.payload) ? msg.payload : []);
  if (!source.length) return [null,null];
  const raw = Number(source[0]);
  flow.set("valveFeedback", {value:raw === 1 ? 1 : raw === 0 ? 0 : null,raw:Number.isFinite(raw)?raw:null,updatedAt:Date.now()});
  return [{payload:{kind:"valve-feedback-tick"}},null];
}
const gas = channels[msg.topic];
if (!gas) return null;
const number = (name, fallback) => {
  const rawValue = env.get(name);
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
};
const runtimeSettings = flow.get("runtimeSettings") || {};
const channelSettings = runtimeSettings.gases?.find(item => item.key === msg.topic) || {};
const limits = {
  warnLow:Number.isFinite(channelSettings.warnLow) ? channelSettings.warnLow : number(gas.prefix + "_WARN_LOW_BAR",3.5),
  okLow:Number.isFinite(channelSettings.okLow) ? channelSettings.okLow : number(gas.prefix + "_OK_LOW_BAR",4),
  okHigh:Number.isFinite(channelSettings.okHigh) ? channelSettings.okHigh : number(gas.prefix + "_OK_HIGH_BAR",6),
  warnHigh:Number.isFinite(channelSettings.warnHigh) ? channelSettings.warnHigh : number(gas.prefix + "_WARN_HIGH_BAR",6.5),
  displayMax:Number.isFinite(runtimeSettings.displayMax) ? runtimeSettings.displayMax : number("GAS_DISPLAY_MAX_BAR",10)
};
if (!(limits.warnLow <= limits.okLow && limits.okLow < limits.okHigh && limits.okHigh <= limits.warnHigh && limits.warnHigh < limits.displayMax)) {
  node.error("Invalid threshold order for " + msg.topic);
  return null;
}
const classification = context.get("classificationStatus") || {};
const source = Array.isArray(msg.payload?.data) ? msg.payload.data : (Array.isArray(msg.payload) ? msg.payload : []);
const highWord = Number(source[0]);
const lowWord = Number(source[1]);
let nanoamps = Number.NaN;
if (Number.isInteger(highWord) && Number.isInteger(lowWord)) {
  nanoamps = (highWord & 0xffff) * 65536 + (lowWord & 0xffff);
  if (nanoamps >= 0x80000000) nanoamps -= 0x100000000;
}
const currentMa = nanoamps / 1000000;
const input = {oxygen:"IN1P",air:"IN2P",vacuum:"IN3P",n2o:"IN4P",co2:"IN5P"}[msg.topic];
const measuredAt = Date.now();
if (!Number.isFinite(currentMa) || nanoamps === 2147483647 || nanoamps === -2147483648 || currentMa < 3.5) {
  classification[msg.topic] = "nodata";
  context.set("classificationStatus", classification);
  const payload={key:msg.topic,code:gas.code,name:gas.name,input,currentMa:Number.isFinite(currentMa)?Math.round(currentMa*1000000)/1000000:null,value:null,raw:null,status:"nodata",reason:Number.isFinite(currentMa)&&currentMa<3.5?"loop-current-low":"invalid",limits,updatedAt:measuredAt};
  return [{...msg,payload},null,{payload:{input,currentMa:Number.isFinite(currentMa)?currentMa:null,pressureBar:null,status:"nodata",reason:payload.reason,updatedAt:payload.updatedAt}}];
}
const value = Math.round(Math.max(0, (currentMa - 4) * 0.625) * 10) / 10;
const raw = Math.round(value * 10);
let status = value >= limits.okLow && value <= limits.okHigh ? "ok" : (value >= limits.warnLow && value <= limits.warnHigh ? "warn" : "alarm");
const previousStatus = classification[msg.topic];
const hysteresis = Math.max(0, Number.isFinite(runtimeSettings.hysteresis) ? runtimeSettings.hysteresis : number("GAS_HYSTERESIS_BAR",0.1));
if (previousStatus === "alarm" && status !== "alarm") {
  status = value >= limits.warnLow + hysteresis && value <= limits.warnHigh - hysteresis ? "warn" : "alarm";
} else if (previousStatus === "warn" && status === "ok") {
  status = value >= limits.okLow + hysteresis && value <= limits.okHigh - hysteresis ? "ok" : "warn";
}
classification[msg.topic] = status;
context.set("classificationStatus", classification);
const payload = {key:msg.topic,code:gas.code,name:gas.name,input,currentMa,value,raw,status,reason:null,limits,updatedAt:measuredAt};
return [{...msg,payload},{payload},{payload:{input,currentMa,pressureBar:value,status,reason:null,updatedAt:payload.updatedAt}}];`;

const cycleAggregateCode = `if(!msg.payload?.key)return null;const settings=flow.get("runtimeSettings")||{};const configured=Array.isArray(settings.gases)?settings.gases:[];const expectedKeys=configured.some(gas=>typeof gas.enabled==="boolean")?configured.filter(gas=>gas.enabled).map(gas=>gas.key):["oxygen","air","vacuum"];const samples=context.get("samples")||{};samples[msg.payload.key]=msg.payload;context.set("samples",samples);if(!expectedKeys.every(key=>samples[key]))return null;const measuredAt=Date.now();const complete=expectedKeys.map(key=>({...samples[key],updatedAt:measuredAt}));context.set("samples",{});return [{payload:complete,measuredAt},complete.map(sample=>({payload:sample,measuredAt}))];`;

const stateCode = `const initial = {
  oxygen:{key:"oxygen",code:"O₂",name:"Кислород",value:null,raw:null,status:"nodata",limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:10},updatedAt:null},
  air:{key:"air",code:"AIR",name:"Сжатый воздух",value:null,raw:null,status:"nodata",limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:10},updatedAt:null},
  vacuum:{key:"vacuum",code:"VAC",name:"Вакуум",value:null,raw:null,status:"nodata",limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:10},updatedAt:null},
  n2o:{key:"n2o",code:"N₂O",name:"Закись азота",value:null,raw:null,status:"nodata",limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:10},updatedAt:null},
  co2:{key:"co2",code:"CO₂",name:"Углекислый газ",value:null,raw:null,status:"nodata",limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:10},updatedAt:null}
};
const persisted = context.get("gasState") || {};
const state = Object.fromEntries(Object.entries(initial).map(([key,value])=>[key,{...value,...persisted[key]}]));
const samples=Array.isArray(msg.payload)?msg.payload:[msg.payload];
for(const sample of samples){if(sample?.key&&state[sample.key]){const previous=state[sample.key];state[sample.key]=sample.status==="nodata"&&sample.value===null?{...sample,lastValue:Number.isFinite(previous.value)?previous.value:previous.lastValue}:sample}}
const runtimeSettings = flow.get("runtimeSettings") || {};
const configuredPollMs = Number(runtimeSettings.pollIntervalMs);
const pollMs = Number.isInteger(configuredPollMs) && configuredPollMs >= 1000 && configuredPollMs <= 10000 ? configuredPollMs : Math.max(1000, Number(env.get("MODBUS_POLL_INTERVAL_MS")) || 1000);
const staleMs = Math.max(pollMs * 3, Number(env.get("GAS_STALE_TIMEOUT_MS")) || 3000);
for (const key of Object.keys(state)) {
  if (state[key].updatedAt && Date.now() - state[key].updatedAt > staleMs) {
    state[key] = {...state[key],lastValue:Number.isFinite(state[key].value)?state[key].value:state[key].lastValue,value:null,status:"nodata",reason:"stale"};
  }
}
context.set("gasState", state);
flow.set("gasState", state);
const health = flow.get("systemHealth") || {};
health.gases = Object.fromEntries(Object.entries(state).map(([key,gas]) => [key,{updatedAt:gas.updatedAt,status:gas.status}]));
health.currents=health.currents||{};for(const sample of samples){if(sample?.input)health.currents[sample.input]={currentMa:Number.isFinite(sample.currentMa)?sample.currentMa:null,updatedAt:sample.updatedAt}}
flow.set("systemHealth", health);
const order = {ok:0,warn:1,nodata:2,alarm:3};
const configured=runtimeSettings;
const configuredGases=Array.isArray(configured.gases)?configured.gases:[];
const gasKeys=configuredGases.some(gas=>typeof gas.enabled==="boolean")?configuredGases.filter(gas=>gas.enabled).map(gas=>gas.key):["oxygen","air","vacuum","n2o","co2"].slice(0,Math.max(3,Math.min(5,Number(configured.channelCount)||3)));
const gases = gasKeys.map(key => state[key]);
const overall = gases.reduce((result, gas) => order[gas.status] > order[result] ? gas.status : result, "ok");
const reported = context.get("reportedStatus") || {};
const statusSince = context.get("statusSince") || {};
const bootAt = context.get("bootAt") || Date.now();
const events = [];
for (const gas of gases) {
  if (!gas.updatedAt || reported[gas.key] === gas.status) continue;
  if (gas.status === "nodata" && Date.now() - bootAt < staleMs) continue;
  const from = reported[gas.key];
  const changedAt = Date.now();
  reported[gas.key] = gas.status;
  const durationMs = statusSince[gas.key] ? changedAt - statusSince[gas.key] : null;
  statusSince[gas.key] = changedAt;
  if (from === undefined && gas.status === "ok") continue;
  events.push({payload:{kind:"gas-state-change",key:gas.key,name:gas.name,value:gas.value,lastValue:gas.lastValue,from:from || "startup",to:gas.status,reason:gas.reason,durationMs,updatedAt:changedAt}});
}
context.set("reportedStatus", reported);
context.set("statusSince", statusSince);
const configuredIdentity=configured;
const identity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(configuredIdentity.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(configuredIdentity.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};
const valveSettings=configured.valves||{};const valveEnabled=!!valveSettings.enabled;const automatic=valveEnabled&&valveSettings.controlMode==="automatic";const feedback=flow.get("valveFeedback")||{};const feedbackTimeout=Math.max(1,Number(valveSettings.feedbackTimeoutSeconds)||5)*1000;const feedbackFresh=Number(feedback.updatedAt)>0&&Date.now()-Number(feedback.updatedAt)<=feedbackTimeout;const triggerKeys=Array.isArray(valveSettings.triggerGases)&&valveSettings.triggerGases.length?valveSettings.triggerGases:gasKeys;const alarmActive=triggerKeys.some(key=>gasKeys.includes(key)&&state[key]?.status==="alarm")||(!!valveSettings.triggerOnNoData&&triggerKeys.some(key=>gasKeys.includes(key)&&state[key]?.status==="nodata"));let desired=!!context.get("valveDesired");let pendingSince=Number(context.get("valvePendingSince"))||0;const activationMs=Math.max(0,Number(valveSettings.activationDelaySeconds)||0)*1000;const recoveryMs=Math.max(0,Number(valveSettings.recoveryDelaySeconds)||0)*1000;if(automatic){if(alarmActive&&!desired){if(!pendingSince){pendingSince=Date.now();context.set("valvePendingSince",pendingSince)}if(Date.now()-pendingSince>=activationMs){desired=true;context.set("valveDesired",true);context.set("valvePendingSince",0)}}else if(!alarmActive&&desired){if(!pendingSince){pendingSince=Date.now();context.set("valvePendingSince",pendingSince)}if(Date.now()-pendingSince>=recoveryMs){desired=false;context.set("valveDesired",false);context.set("valvePendingSince",0)}}else if((alarmActive&&desired)||(!alarmActive&&!desired)){context.set("valvePendingSince",0)}}else{desired=false;context.set("valveDesired",false);context.set("valvePendingSince",0)}let valveStatus="disabled";if(valveEnabled&&!feedbackFresh)valveStatus="nodata";else if(valveEnabled&&!automatic)valveStatus=feedback.value===1?"normal":"emergency";else if(automatic){const expected=desired?0:1;valveStatus=feedback.value===expected?(desired?"emergency":"normal"):"mismatch"}const previousValveStatus=context.get("reportedValveStatus");if(valveEnabled&&previousValveStatus!==valveStatus){context.set("reportedValveStatus",valveStatus);if(previousValveStatus!==undefined)events.push({payload:{kind:"valve-state-change",key:"valves",name:"Клапаны",from:previousValveStatus,to:valveStatus,value:feedback.value,command:desired,updatedAt:Date.now()}})}const lastCommand=context.get("valveCommanded");let relay=null;if(automatic&&lastCommand!==desired){context.set("valveCommanded",desired);const activeValue=valveSettings.activeValue===0?0:1;const coilValue=desired?activeValue:1-activeValue;relay={payload:{value:coilValue,fc:5,unitid:Number(valveSettings.unitId)||66,address:Number(valveSettings.coilAddress)||0,quantity:1},valveCommand:desired}}msg.payload = {clock:new Date().toLocaleString("ru-RU",{timeZone:env.get("TZ")||"Europe/Moscow"}),identity,overall,gases,valves:{enabled:valveEnabled,controlMode:valveSettings.controlMode||"monitor",status:valveStatus,command:automatic?desired:null,feedback:feedbackFresh?feedback.value:null}};
return [msg,events,relay];`;

const influxWriteCode = `const p = msg.payload;
if (!p || !Number.isFinite(p.value)) return null;
const esc = value => String(value).replace(/([ ,=])/g, "\\\\$1");
const url = env.get("INFLUXDB_URL");
const org = env.get("INFLUXDB_ORG");
const bucket = env.get("INFLUXDB_BUCKET");
const token = env.get("INFLUXDB_TOKEN");
const monitorId=env.get("MONITOR_ID");
const configuredIdentity=flow.get("runtimeSettings")||{};
const siteName=configuredIdentity.siteName||"ОБЪЕКТ НЕ НАСТРОЕН";
const locationName=configuredIdentity.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО";
msg.method = "POST";
msg.url = url + "/api/v2/write?org=" + encodeURIComponent(org) + "&bucket=" + encodeURIComponent(bucket) + "&precision=ms";
msg.headers = {"Authorization":"Token " + token,"Content-Type":"text/plain; charset=utf-8"};
msg.payload = "gas_pressure,monitor_id="+esc(monitorId)+",site="+esc(siteName)+",location="+esc(locationName)+",gas=" + esc(p.key) + ",gas_name=" + esc(p.name) + ",status=" + esc(p.status) + " pressure_bar=" + p.value + ",raw=" + p.raw + "i,status_code=" + ({ok:0,warn:1,alarm:2}[p.status] ?? 3) + "i " + p.updatedAt;
msg.influxOperation="measurement";
return msg;`;

const historyQueryCode = `const input = msg.payload || {};
if (input.action !== "query") return null;
const gases = new Set(["oxygen","air","vacuum","n2o","co2"]);
const ranges = { "1h": {start:"-1h",window:"1m",windowMs:60000}, "24h": {start:"-24h",window:"5m",windowMs:300000}, "7d": {start:"-7d",window:"30m",windowMs:1800000}, "30d": {start:"-30d",window:"2h",windowMs:7200000} };
if (!gases.has(input.gas)) return {payload:{kind:"history",gas:input.gas,points:[],error:"Неизвестный газ"}};
let start;
let stop = "";
let window = ranges[input.range]?.window || "5m";
let windowMs = ranges[input.range]?.windowMs || 300000;
if (input.start && input.stop) {
  const from = new Date(input.start);
  const to = new Date(input.stop);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) return {payload:{kind:"history",gas:input.gas,points:[],error:"Некорректный период"}};
  start = from.toISOString();
  stop = to.toISOString();
  const hours = (to - from) / 3600000;
  window = hours <= 2 ? "1m" : hours <= 48 ? "5m" : hours <= 240 ? "30m" : "2h";
  windowMs = hours <= 2 ? 60000 : hours <= 48 ? 300000 : hours <= 240 ? 1800000 : 7200000;
} else {
  start = ranges[input.range]?.start || "-24h";
}
const range = start.startsWith("-") ? "range(start: " + start + ")" : "range(start: time(v: " + JSON.stringify(start) + "), stop: time(v: " + JSON.stringify(stop) + "))";
const bucket = env.get("INFLUXDB_BUCKET");
const query = 'from(bucket: ' + JSON.stringify(bucket) + ') |> ' + range + ' |> filter(fn: (r) => r._measurement == "gas_pressure" and r._field == "pressure_bar" and r.gas == ' + JSON.stringify(input.gas) + ') |> group(columns: ["gas"]) |> aggregateWindow(every: ' + window + ', fn: mean, createEmpty: false) |> keep(columns: ["_time","_value"]) |> yield(name: "mean")';
msg.historyGas = input.gas;
msg.historyWindowMs = windowMs;
const prefixes={oxygen:"OXYGEN",air:"AIR",vacuum:"VACUUM",n2o:"N2O",co2:"CO2"};
const prefix=prefixes[input.gas];
const number=(name,fallback)=>{const raw=env.get(name);const value=Number(raw);return raw!==undefined&&raw!==null&&String(raw).trim()!==""&&Number.isFinite(value)?value:fallback};
const configured=(flow.get("runtimeSettings")||{});
msg.historyIdentity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(configured.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(configured.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};
const channel=configured.gases?.find(item=>item.key===input.gas)||{};
msg.historyLimits={warnLow:Number.isFinite(channel.warnLow)?channel.warnLow:number(prefix+"_WARN_LOW_BAR",3.5),okLow:Number.isFinite(channel.okLow)?channel.okLow:number(prefix+"_OK_LOW_BAR",4),okHigh:Number.isFinite(channel.okHigh)?channel.okHigh:number(prefix+"_OK_HIGH_BAR",6),warnHigh:Number.isFinite(channel.warnHigh)?channel.warnHigh:number(prefix+"_WARN_HIGH_BAR",6.5),displayMax:Number.isFinite(configured.displayMax)?configured.displayMax:number("GAS_DISPLAY_MAX_BAR",10)};
msg.method = "POST";
msg.url = env.get("INFLUXDB_URL") + "/api/v2/query?org=" + encodeURIComponent(env.get("INFLUXDB_ORG"));
msg.headers = {"Authorization":"Token " + env.get("INFLUXDB_TOKEN"),"Content-Type":"application/json","Accept":"text/csv"};
msg.payload = {query,type:"flux",dialect:{header:true,delimiter:",",annotations:[],commentPrefix:"#",dateTimeFormat:"RFC3339"}};
return msg;`;

const historyParseCode = `const gas = msg.historyGas;
if (Number(msg.statusCode) >= 400) return {payload:{kind:"history",gas,points:[],identity:msg.historyIdentity,error:"InfluxDB вернул HTTP " + msg.statusCode}};
const lines = String(msg.payload || "").trim().split(/\\r?\\n/).filter(Boolean);
if (lines.length < 2) return {payload:{kind:"history",gas,points:[],identity:msg.historyIdentity,error:""}};
const headers = lines[0].split(",");
const timeIndex = headers.indexOf("_time");
const valueIndex = headers.indexOf("_value");
const points = lines.slice(1).map(line => {
  const cols = line.split(",");
  const value = Number(cols[valueIndex]);
  const {okLow,okHigh,warnLow,warnHigh}=msg.historyLimits;
  const status = value >= okLow && value <= okHigh ? "ok" : (value >= warnLow && value <= warnHigh ? "warn" : "alarm");
  return {time:cols[timeIndex],value,status};
}).filter(point => point.time && Number.isFinite(point.value));
return {payload:{kind:"history",gas,points,error:"",identity:msg.historyIdentity,limits:msg.historyLimits,windowMs:msg.historyWindowMs}};`;

const maxRequestCode = `if (String(env.get("MAX_NOTIFICATIONS_ENABLED")).toLowerCase() !== "true") return null;
const event = msg.payload;
if (!["gas-state-change","gas-reminder","valve-state-change"].includes(event?.kind)) return null;
const token = env.get("MAX_BOT_TOKEN");
const chatId = env.get("MAX_CHAT_ID");
if (!token || !chatId) {
  node.error("MAX notifications enabled, but MAX_BOT_TOKEN or MAX_CHAT_ID is empty");
  return null;
}
const labels={ok:"НОРМА",warn:"ВНИМАНИЕ",alarm:"АВАРИЯ",nodata:"НЕТ ДАННЫХ",startup:"ЗАПУСК",normal:"ШТАТНЫЙ РЕЖИМ",emergency:"АВАРИЙНЫЙ РЕЖИМ",mismatch:"НЕСООТВЕТСТВИЕ",disabled:"ОТКЛЮЧЕНО"};
const configuredIdentity=flow.get("runtimeSettings")||{};
const identity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(configuredIdentity.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(configuredIdentity.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};
const formatValue=value=>Number(value).toFixed(1).replace(".",",")+" бар";
const isRecovery=event.to==="ok"&&event.from!=="ok";
const title=event.kind==="gas-reminder"?"⚠️ НАПОМИНАНИЕ":event.kind==="valve-state-change"?(event.to==="normal"?"✅ КЛАПАНЫ: ШТАТНЫЙ РЕЖИМ":event.to==="emergency"?"🔴 КЛАПАНЫ: АВАРИЙНЫЙ РЕЖИМ":event.to==="mismatch"?"🔴 КЛАПАНЫ: НЕСООТВЕТСТВИЕ КОМАНДЫ":"⚫ КЛАПАНЫ: НЕТ ДАННЫХ"):isRecovery?"✅ ВОССТАНОВЛЕНО":event.to==="alarm"?"🔴 АВАРИЯ":event.to==="warn"?"🟡 ВНИМАНИЕ":event.to==="nodata"?"⚫ НЕТ ДАННЫХ":"ℹ️ СОСТОЯНИЕ";
const lines=[title+" — "+event.name,"","Объект: "+identity.siteName,"Расположение: "+identity.locationName,"Установка: "+identity.monitorId,""];
if(event.kind==="valve-state-change")lines.push("Обратная связь: "+(event.value===1?"1 — штатный режим":event.value===0?"0 — аварийный режим":"нет достоверного сигнала"));
else if(Number.isFinite(event.value))lines.push("Давление: "+formatValue(event.value));
else if(Number.isFinite(event.lastValue))lines.push("Последнее значение: "+formatValue(event.lastValue));
else lines.push("Давление: значение отсутствует");
lines.push("Переход: "+labels[event.from]+" → "+labels[event.to]);
if(event.to==="nodata"){const reason=event.reason==="stale"?"нет достоверных данных более "+(Number(env.get("GAS_STALE_TIMEOUT_MS"))||6000)/1000+" секунд":event.reason==="invalid"?"получено недостоверное значение":event.reason||"нет достоверного измерения";lines.push("Причина: "+reason)}
if(isRecovery&&Number.isFinite(event.durationMs)){const seconds=Math.round(event.durationMs/1000);lines.push("Длительность нарушения: "+(seconds>=60?Math.floor(seconds/60)+" мин "+seconds%60+" сек":seconds+" сек"))}
lines.push("Время: "+new Date(event.updatedAt||Date.now()).toLocaleString("ru-RU",{timeZone:env.get("TZ")||"Europe/Moscow"}));
msg.method="POST";
msg.url=(env.get("MAX_API_URL")||"https://platform-api2.max.ru")+"/messages?chat_id="+encodeURIComponent(chatId);
msg.headers={"Authorization":token,"Content-Type":"application/json"};
msg.payload={text:lines.join("\\n"),notify:true};
msg.maxRequestBody=msg.payload;
msg.maxEvent=event;
msg.maxAttempt=1;
return msg;`;

const eventWriteCode = `const event=msg.payload;
if(!["gas-state-change","valve-state-change","settings-change"].includes(event?.kind))return null;
const escTag=value=>String(value??"").replace(/([ ,=])/g,"\\\\$1");
const escField=value=>String(value??"").replace(/\\\\/g,"\\\\\\\\").replace(/"/g,'\\\\"');
const gas=event.kind==="settings-change"?"system":event.key;
const name=event.kind==="settings-change"?"Настройки":event.name;
const from=event.kind==="settings-change"?"settings":event.from;
const to=event.kind==="settings-change"?"changed":event.to;
const hasValue=Number.isFinite(event.value);
const configuredIdentity=flow.get("runtimeSettings")||{};
const tags=",monitor_id="+escTag(env.get("MONITOR_ID"))+",site="+escTag(configuredIdentity.siteName||"ОБЪЕКТ НЕ НАСТРОЕН")+",location="+escTag(configuredIdentity.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО")+",gas="+escTag(gas)+",name="+escTag(name)+",from="+escTag(from)+",to="+escTag(to)+",reason="+escTag(event.reason||"none")+",operator="+escTag(event.operator||"system")+",has_value="+hasValue;
const fields="value="+(hasValue?event.value:-1)+",duration_ms="+(Number.isFinite(event.durationMs)?Math.round(event.durationMs):0)+'i,details="'+escField(event.details||"")+'"';
msg.method="POST";
msg.url=env.get("INFLUXDB_URL")+"/api/v2/write?org="+encodeURIComponent(env.get("INFLUXDB_ORG"))+"&bucket="+encodeURIComponent(env.get("INFLUXDB_BUCKET"))+"&precision=ms";
msg.headers={"Authorization":"Token "+env.get("INFLUXDB_TOKEN"),"Content-Type":"text/plain; charset=utf-8"};
msg.payload="gas_event"+tags+" "+fields+" "+(event.updatedAt||Date.now());
msg.influxOperation="event";
return msg;`;

const eventsQueryCode = `const input=msg.payload||{};
if(input.action!=="query-events")return null;
const starts={ "24h":"-24h","7d":"-7d","30d":"-30d" };
const gases=new Set(["all","oxygen","air","vacuum","n2o","co2","valves","system"]);
if(!gases.has(input.gas))return {payload:{kind:"events",events:[],error:"Неизвестный источник"}};
const gasFilter=input.gas==="all"?"":' and r.gas == '+JSON.stringify(input.gas);
const query='from(bucket: '+JSON.stringify(env.get("INFLUXDB_BUCKET"))+') |> range(start: '+(starts[input.range]||"-24h")+') |> filter(fn:(r)=>r._measurement == "gas_event" and r._field == "value"'+gasFilter+') |> group() |> sort(columns:["_time"],desc:true) |> limit(n:500) |> keep(columns:["_time","_value","gas","name","from","to","reason","operator","has_value","duration_ms"])';
const configuredIdentity=flow.get("runtimeSettings")||{};msg.eventsIdentity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(configuredIdentity.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(configuredIdentity.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};msg.method="POST";msg.url=env.get("INFLUXDB_URL")+"/api/v2/query?org="+encodeURIComponent(env.get("INFLUXDB_ORG"));msg.headers={"Authorization":"Token "+env.get("INFLUXDB_TOKEN"),"Content-Type":"application/json","Accept":"text/csv"};msg.payload={query,type:"flux",dialect:{header:true,delimiter:",",annotations:[],commentPrefix:"#",dateTimeFormat:"RFC3339"}};return msg;`;

const eventsParseCode = `if(Number(msg.statusCode)>=400)return {payload:{kind:"events",events:[],identity:msg.eventsIdentity,error:"InfluxDB вернул HTTP "+msg.statusCode}};
const lines=String(msg.payload||"").trim().split(/\\r?\\n/).filter(Boolean);if(lines.length<2)return {payload:{kind:"events",events:[],identity:msg.eventsIdentity,error:""}};
const headers=lines[0].split(",");const index=name=>headers.indexOf(name);const events=lines.slice(1).filter(line=>!line.startsWith("_time,")).map(line=>{const c=line.split(",");return{time:c[index("_time")],value:Number(c[index("_value")]),gas:c[index("gas")],name:c[index("name")],from:c[index("from")],to:c[index("to")],reason:c[index("reason")]==="none"?"":c[index("reason")],operator:c[index("operator")]==="system"?"":c[index("operator")],hasValue:c[index("has_value")]==="true",durationMs:Number(c[index("duration_ms")])}}).filter(event=>event.time);return {payload:{kind:"events",events,identity:msg.eventsIdentity,error:""}};`;

const engineeringManagerCode = `const crypto=global.get("crypto");if(!crypto)throw new Error("crypto is not configured in functionGlobalContext");
const defaults=()=>{const number=(name,fallback)=>{const raw=env.get(name);const value=Number(raw);return raw!==undefined&&raw!==null&&String(raw).trim()!==""&&Number.isFinite(value)?value:fallback};const gas=(key,code,name,input,prefix,enabled)=>({key,code,name,input,enabled,warnLow:number(prefix+"_WARN_LOW_BAR",3.5),okLow:number(prefix+"_OK_LOW_BAR",4),okHigh:number(prefix+"_OK_HIGH_BAR",6),warnHigh:number(prefix+"_WARN_HIGH_BAR",6.5)});return{siteName:"",locationName:"",gases:[gas("oxygen","O₂","Кислород","IN1P","OXYGEN",true),gas("air","AIR","Сжатый воздух","IN2P","AIR",true),gas("vacuum","VAC","Вакуум","IN3P","VACUUM",true),gas("n2o","N₂O","Закись азота","IN4P","N2O",false),gas("co2","CO₂","Углекислый газ","IN5P","CO2",false)],displayMax:number("GAS_DISPLAY_MAX_BAR",10),hysteresis:number("GAS_HYSTERESIS_BAR",.1),pollIntervalMs:number("MODBUS_POLL_INTERVAL_MS",1000),valves:{enabled:false,controlMode:"monitor",triggerGases:["oxygen","air","vacuum","n2o","co2"],triggerOnNoData:false,activationDelaySeconds:0,recoveryDelaySeconds:5,feedbackTimeoutSeconds:5,activeValue:1,wbMai6UnitId:number("MODBUS_UNIT_ID",65),unitId:number("VALVE_RELAY_UNIT_ID",66),coilAddress:0}}};
const client=msg._client?.socketId||msg.socketid||"unknown";const sessions=context.get("sessions")||{};const now=Date.now();if(sessions[client]&&Number(sessions[client].expiresAt)<=now)delete sessions[client];const session=sessions[client]||null;const unlocked=!!session;const admin=session?.type==="admin";const minutes=Math.min(60,Math.max(1,Number(env.get("SERVICE_UNLOCK_MINUTES"))||15));const secret=String(env.get("NODE_RED_CREDENTIAL_SECRET")||"");if(!secret)throw new Error("NODE_RED_CREDENTIAL_SECRET is required");const digest=value=>crypto.createHmac("sha256",secret).update(String(value)).digest("hex");const equalHex=(left,right)=>{const a=Buffer.from(String(left)),b=Buffer.from(String(right));return a.length===b.length&&crypto.timingSafeEqual(a,b)};const equal=(left,right)=>equalHex(digest(left),digest(right));
let operators=flow.get("serviceOperators")||[];const base=defaults();const stored=flow.get("runtimeSettings")||{};const storedByKey=Object.fromEntries((Array.isArray(stored.gases)?stored.gases:[]).map(g=>[g.key,g]));const legacyCount=Math.max(3,Math.min(5,Number(stored.channelCount)||3));const mergedGases=base.gases.map((g,index)=>({...g,...storedByKey[g.key],enabled:typeof storedByKey[g.key]?.enabled==="boolean"?storedByKey[g.key].enabled:index<legacyCount}));const storedTriggers=Array.isArray(stored.valves?.triggerGases)&&stored.valves.triggerGases.length?stored.valves.triggerGases:base.valves.triggerGases;const current={...base,...stored,siteName:String(stored.siteName||base.siteName).trim(),locationName:String(stored.locationName||base.locationName).trim(),gases:mergedGases,valves:{...base.valves,...stored.valves,triggerGases:storedTriggers}};const health=flow.get("systemHealth")||{};const staleMs=Math.max(Number(current.pollIntervalMs||2000)*3,Number(env.get("GAS_STALE_TIMEOUT_MS"))||6000);const gases=flow.get("gasState")||{};health.gases=Object.fromEntries(["oxygen","air","vacuum","n2o","co2"].map(key=>{const gas=gases[key]||{};const updatedAt=gas.updatedAt||null;return[key,{input:gas.input||null,currentMa:Number.isFinite(gas.currentMa)?gas.currentMa:null,updatedAt,ageSeconds:updatedAt?Math.round((now-updatedAt)/1000):null,fresh:!!updatedAt&&now-updatedAt<=staleMs,status:gas.status||"nodata"}]}));health.currents=Object.fromEntries(Object.values(health.gases).filter(gas=>gas.input).map(gas=>[gas.input,{currentMa:gas.currentMa,updatedAt:gas.updatedAt}]));health.max=health.max||{status:String(env.get("MAX_NOTIFICATIONS_ENABLED")).toLowerCase()==="true"?"waiting":"disabled"};
const activeSession=()=>{const value=sessions[client];return value&&Number(value.expiresAt)>Date.now()?value:null};const response=(extra={})=>{const latest=flow.get("runtimeSettings")||{};const latestByKey=Object.fromEntries((Array.isArray(latest.gases)?latest.gases:[]).map(g=>[g.key,g]));const gasesForUi=current.gases.map(g=>({...g,...latestByKey[g.key],enabled:typeof latestByKey[g.key]?.enabled==="boolean"?latestByKey[g.key].enabled:g.enabled})).sort((a,b)=>Number(b.enabled)-Number(a.enabled)||base.gases.findIndex(g=>g.key===a.key)-base.gases.findIndex(g=>g.key===b.key));const latestTriggers=Array.isArray(latest.valves?.triggerGases)&&latest.valves.triggerGases.length?latest.valves.triggerGases:current.valves.triggerGases;const settings={...current,...latest,channelCount:gasesForUi.filter(g=>g.enabled).length,gases:gasesForUi,valves:{...base.valves,...latest.valves,triggerGases:latestTriggers}};const live=activeSession();const identity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(settings.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(settings.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};return{_client:msg._client,payload:{kind:"engineering",identity,settings,health,unlocked:!!live,admin:live?.type==="admin",session:live?{type:live.type,name:live.name,expiresAt:live.expiresAt}:{},operators:live?.type==="admin"?operators.map(({id,name,createdAt})=>({id,name,createdAt})):[],...extra}}};
const audit=details=>({payload:{kind:"settings-change",operator:activeSession()?.name||"system",details,updatedAt:Date.now()}});const action=msg.payload?.action;
if(action==="engineering-load")return [response(),null,null];
if(action==="engineering-logout"){delete sessions[client];context.set("sessions",sessions);return[response({success:true,message:"Сервисная сессия завершена"}),null,null]}
if(action==="engineering-admin-unlock"){const configured=String(env.get("ADMIN_ACCESS_CODE")||env.get("SERVICE_ACCESS_CODE")||"");if(!configured)return[response({success:false,message:"ADMIN_ACCESS_CODE не настроен"}),null,null];if(!equal(msg.payload.code,configured))return[response({success:false,message:"Неверный администраторский код"}),null,null];sessions[client]={type:"admin",name:"Администратор",expiresAt:Date.now()+minutes*60000};context.set("sessions",sessions);return[response({success:true,message:"Режим администратора открыт на "+minutes+" мин",loadRemoteUsers:true}),null,null]}
if(action==="engineering-prepare-hardware"){if(!admin)return[response({success:false,message:"Требуется режим администратора"}),null,null,null];if(Number(flow.get("hardwareCommissioning"))>Date.now())return[response({success:false,message:"Подготовка оборудования уже выполняется"}),null,null,null];const device=msg.payload.device;if(!["mai6","relay"].includes(device))return[response({success:false,message:"Неизвестный тип оборудования"}),null,null,null];const mai6Unit=Number(current.valves.wbMai6UnitId)||65;const relayUnit=Number(current.valves.unitId)||66;flow.set("hardwareCommissioning",Date.now()+180000);msg.payload="--device "+device+" --confirm APPLY --mai6-unit "+mai6Unit+" --relay-unit "+relayUnit;return[response({success:true,message:"Подготовка оборудования запущена. Опрос временно остановлен"}),null,null,msg]}
if(action==="engineering-unlock"){const code=String(msg.payload.code||"");const found=operators.find(item=>equalHex(digest(code),item.codeHash));if(!found)return[response({success:false,message:operators.length?"Неверный персональный код":"Сначала администратор должен зарегистрировать исполнителя"}),null,null];sessions[client]={type:"operator",operatorId:found.id,name:found.name,expiresAt:Date.now()+minutes*60000};context.set("sessions",sessions);return[response({success:true,message:"Исполнитель определён: "+found.name}),null,null]}
if(action==="engineering-operator-add"){if(!admin)return[response({success:false,message:"Требуется режим администратора"}),null,null];const name=String(msg.payload.name||"").trim();const code=String(msg.payload.code||"");if(name.length<2||name.length>120||/[\\r\\n]/.test(name))return[response({success:false,message:"ФИО: от 2 до 120 символов одной строкой"}),null,null];if(code.length<8||code.length>64)return[response({success:false,message:"Персональный код: от 8 до 64 символов"}),null,null];if(operators.some(item=>item.name.toLowerCase()===name.toLowerCase()))return[response({success:false,message:"Исполнитель с таким именем уже зарегистрирован"}),null,null];const codeHash=digest(code);if(operators.some(item=>item.codeHash===codeHash))return[response({success:false,message:"Этот персональный код уже используется"}),null,null];operators.push({id:crypto.randomUUID(),name,codeHash,createdAt:new Date().toISOString()});flow.set("serviceOperators",operators);return[response({success:true,message:"Исполнитель добавлен: "+name}),audit("Добавлен исполнитель: "+name),null]}
if(action==="engineering-operator-delete"){if(!admin)return[response({success:false,message:"Требуется режим администратора"}),null,null];const target=operators.find(item=>item.id===String(msg.payload.id||""));if(!target)return[response({success:false,message:"Исполнитель не найден"}),null,null];operators=operators.filter(item=>item.id!==target.id);flow.set("serviceOperators",operators);for(const [key,value] of Object.entries(sessions))if(value.operatorId===target.id)delete sessions[key];context.set("sessions",sessions);return[response({success:true,message:"Исполнитель удалён: "+target.name}),audit("Удалён исполнитель: "+target.name),null]}
if(["engineering-users-load","engineering-user-add","engineering-user-delete"].includes(action)){if(!admin)return[response({success:false,message:"Требуется режим администратора"}),null,null];const token=String(env.get("AUTH_SERVICE_TOKEN")||"");const baseUrl=String(env.get("AUTH_SERVICE_URL")||"http://auth-service:8082").replace(/\\/$/,"");if(!token)return[response({success:false,message:"AUTH_SERVICE_TOKEN не настроен"}),null,null];msg.headers={"X-Auth-Admin-Token":token,"Content-Type":"application/json"};msg.authUiAction=action;if(action==="engineering-users-load"){msg.method="GET";msg.url=baseUrl+"/users";msg.payload=""}else if(action==="engineering-user-add"){msg.authTarget=String(msg.payload.username||"").trim().toLowerCase();msg.method="POST";msg.url=baseUrl+"/users";msg.payload={username:msg.payload.username,password:msg.payload.password}}else{msg.authTarget=String(msg.payload.username||"").trim().toLowerCase();msg.method="DELETE";msg.url=baseUrl+"/users/"+encodeURIComponent(String(msg.payload.username||""));msg.payload=""}return[null,null,msg]}
if(action!=="engineering-save")return null;if(!unlocked)return[response({success:false,message:"Сервисная сессия истекла"}),null,null];const operator=session.name;const candidate=msg.payload.settings;const siteName=String(candidate?.siteName||"").trim();const locationName=String(candidate?.locationName||"").trim();if(!siteName||!locationName||siteName.length>120||locationName.length>120||/[\\r\\n]/.test(siteName+locationName))return[response({success:false,message:"Укажите название больницы и расположение одной строкой"}),null,null];const keys=["oxygen","air","vacuum","n2o","co2"];if(!candidate||!Array.isArray(candidate.gases)||candidate.gases.length!==5||!Number.isFinite(candidate.displayMax)||candidate.displayMax<=0||!Number.isFinite(candidate.hysteresis)||candidate.hysteresis<0||candidate.hysteresis>1)return[response({success:false,message:"Некорректные общие параметры"}),null,null];const activeKeys=candidate.gases.filter(gas=>gas.enabled===true).map(gas=>gas.key);if(activeKeys.length<3||activeKeys.length>5||new Set(activeKeys).size!==activeKeys.length)return[response({success:false,message:"Выберите от 3 до 5 датчиков"}),null,null];for(const key of keys){const gas=candidate.gases.find(item=>item.key===key);if(!gas||![gas.warnLow,gas.okLow,gas.okHigh,gas.warnHigh].every(Number.isFinite)||!(0<=gas.warnLow&&gas.warnLow<=gas.okLow&&gas.okLow<gas.okHigh&&gas.okHigh<=gas.warnHigh&&gas.warnHigh<candidate.displayMax))return[response({success:false,message:"Нарушен порядок порогов "+key}),null,null]}const valves={...base.valves,...candidate.valves,enabled:!!candidate.valves?.enabled,triggerOnNoData:!!candidate.valves?.triggerOnNoData,triggerGases:(candidate.valves?.triggerGases||[]).filter(key=>activeKeys.includes(key))};if(!["monitor","automatic"].includes(valves.controlMode)||![valves.activationDelaySeconds,valves.recoveryDelaySeconds,valves.feedbackTimeoutSeconds].every(Number.isFinite)||valves.activationDelaySeconds<0||valves.recoveryDelaySeconds<0||valves.feedbackTimeoutSeconds<1)return[response({success:false,message:"Некорректные параметры управления клапанами"}),null,null];
const pollIntervalMs=Number(candidate.pollIntervalMs);if(!Number.isInteger(pollIntervalMs)||pollIntervalMs<1000||pollIntervalMs>10000)return[response({success:false,message:"Период опроса должен быть целым числом от 1000 до 10000 мс"}),null,null];const wbMai6UnitId=Number(valves.wbMai6UnitId);const relayUnitId=Number(valves.unitId);if(!Number.isInteger(wbMai6UnitId)||wbMai6UnitId<1||wbMai6UnitId>247||!Number.isInteger(relayUnitId)||relayUnitId<1||relayUnitId>247||valves.enabled&&wbMai6UnitId===relayUnitId)return[response({success:false,message:"Unit ID должны быть целыми числами 1…247 и различаться"}),null,null];valves.wbMai6UnitId=wbMai6UnitId;valves.unitId=relayUnitId;const saved={siteName,locationName,channelCount:activeKeys.length,gases:candidate.gases.map(gas=>({key:gas.key,code:gas.code,input:gas.input,name:gas.name,enabled:gas.enabled===true,warnLow:gas.warnLow,okLow:gas.okLow,okHigh:gas.okHigh,warnHigh:gas.warnHigh})),displayMax:candidate.displayMax,hysteresis:candidate.hysteresis,pollIntervalMs,valves,updatedAt:new Date().toISOString(),operator};flow.set("runtimeSettings",saved);return[response({success:true,message:"Настройки сохранены",saved:true}),audit(JSON.stringify(saved)),null];`;

const authUsersResponseCode = `const ok=Number(msg.statusCode)>=200&&Number(msg.statusCode)<300;const body=msg.payload&&typeof msg.payload==="object"?msg.payload:{};const action=msg.authUiAction;const messages={
"engineering-users-load":"Список удалённых пользователей обновлён",
"engineering-user-add":"Удалённый пользователь добавлен",
"engineering-user-delete":"Удалённый пользователь удалён"
};const ui={_client:msg._client,payload:{kind:"engineering-users",success:ok,message:ok?messages[action]||"Готово":String(body.error||"Auth service вернул HTTP "+msg.statusCode),users:Array.isArray(body.users)?body.users:undefined}};if(!ok||action==="engineering-users-load")return[ui,null];const operation=action==="engineering-user-add"?"Добавлен":"Удалён";const event={payload:{kind:"settings-change",operator:"Администратор",details:operation+" удалённый пользователь: "+msg.authTarget,updatedAt:Date.now()}};return[ui,event];`;

const commissionSuccessCode = `flow.set("hardwareCommissioning",false);return{_client:msg._client,payload:{kind:"engineering-users",success:true,message:"Оборудование подготовлено и проверено"}};`;
const commissionFailureCode = `flow.set("hardwareCommissioning",false);const text=String(msg.payload||"Ошибка подготовки оборудования").replace(/Basic\\s+[A-Za-z0-9+/=]+/g,"Basic [redacted]");node.error(text);return{_client:msg._client,payload:{kind:"engineering-users",success:false,message:"Подготовка оборудования не завершена. Проверьте подключение и повторите операцию"}};`;

const influxTrackCode = `const health=flow.get("systemHealth")||{};const ok=Number(msg.statusCode)>=200&&Number(msg.statusCode)<300;health.influx={status:ok?"ok":"error",lastSuccessUtc:ok?new Date().toISOString():health.influx?.lastSuccessUtc||null,lastError:ok?null:"HTTP "+msg.statusCode,operation:msg.influxOperation||"measurement"};flow.set("systemHealth",health);return null;`;

const maxReminderCode = `if(String(env.get("MAX_NOTIFICATIONS_ENABLED")).toLowerCase()!=="true")return null;const state=flow.get("gasState")||{};const interval=Math.max(1,Number(env.get("MAX_REMINDER_INTERVAL_MINUTES"))||30)*60000;const last=context.get("lastReminder")||{};const now=Date.now();const result=[];for(const gas of Object.values(state)){if(!gas.updatedAt||gas.status==="ok"||now-(last[gas.key]||0)<interval)continue;last[gas.key]=now;result.push({payload:{kind:"gas-reminder",key:gas.key,name:gas.name,value:gas.value,lastValue:gas.lastValue,from:gas.status,to:gas.status,reason:gas.reason,updatedAt:now}})}context.set("lastReminder",last);return result;`;

const maxTrackCode = `const ok=Number(msg.statusCode)>=200&&Number(msg.statusCode)<300;const health=flow.get("systemHealth")||{};if(ok){health.max={status:"ok",lastSuccessUtc:new Date().toISOString(),lastError:null,attempt:msg.maxAttempt};flow.set("systemHealth",health);return null}const limit=Math.max(0,Math.min(5,Number(env.get("MAX_RETRY_COUNT"))||2));if((msg.maxAttempt||1)<=limit){msg.maxAttempt=(msg.maxAttempt||1)+1;msg.payload=msg.maxRequestBody;return msg}health.max={status:"error",lastSuccessUtc:health.max?.lastSuccessUtc||null,lastError:"HTTP "+msg.statusCode,attempt:msg.maxAttempt};flow.set("systemHealth",health);node.error("MAX delivery failed after "+msg.maxAttempt+" attempts");return null;`;

const flow = [
  {id:tab,type:"tab",label:"RINIR Gas Monitoring",disabled:false,info:"Product flow: WB-MAI6 via USR-DR134, InfluxDB v2 and FlowFuse Dashboard."},
  {id:ids.modbus,type:"modbus-client",name:"USR-DR134 / WB-MAI6",clienttype:"tcp",bufferCommands:true,stateLogEnabled:false,queueLogEnabled:false,failureLogEnabled:true,tcpHost:"${MODBUS_HOST}",tcpPort:"${MODBUS_PORT}",tcpType:"DEFAULT",serialPort:"/dev/ttyS0",serialType:"RTU-BUFFERD",serialBaudrate:"115200",serialDatabits:"8",serialStopbits:"2",serialParity:"none",serialConnectionDelay:"100",serialAsciiResponseStartDelimiter:"",unit_id:65,commandDelay:"${MODBUS_COMMAND_DELAY_MS}",clientTimeout:"3000",reconnectOnTimeout:true,reconnectTimeout:2000,parallelUnitIdsAllowed:false,showErrors:true,showWarnings:true,showLogs:false},
  {id:ids.ui,type:"ui-base",name:"RINIR Gas Monitoring",path:"/dashboard",appIcon:"",includeClientData:true,acceptsClientConfig:["ui-notification","ui-control"],showPathInSidebar:false,headerContent:"none",navigationStyle:"temporary",titleBarStyle:"hidden",showReconnectNotification:true,notificationDisplayTime:5,showDisconnectNotification:true,allowInstall:false},
  {id:ids.theme,type:"ui-theme",name:"RINIR Dark",colors:{surface:"#102738",primary:"#159ee0",bgPage:"#071521",groupBg:"#071521",groupOutline:"#071521"},sizes:{density:"compact",pagePadding:"0px",groupGap:"0px",groupBorderRadius:"0px",widgetGap:"0px"}},
  {id:ids.monitorPage,type:"ui-page",name:"Мониторинг",ui:ids.ui,path:"/monitoring",icon:"monitor_heart",layout:"grid",theme:ids.theme,breakpoints:[{name:"Default",px:"0",cols:"3"},{name:"Tablet",px:"576",cols:"6"},{name:"Desktop",px:"1024",cols:"12"}],order:1,className:"gm-page",visible:true,disabled:false},
  {id:ids.historyPage,type:"ui-page",name:"История",ui:ids.ui,path:"/history",icon:"query_stats",layout:"grid",theme:ids.theme,breakpoints:[{name:"Default",px:"0",cols:"3"},{name:"Tablet",px:"576",cols:"6"},{name:"Desktop",px:"1024",cols:"12"}],order:2,className:"gh-page",visible:true,disabled:false},
  {id:ids.eventsPage,type:"ui-page",name:"События",ui:ids.ui,path:"/events",icon:"event_note",layout:"grid",theme:ids.theme,breakpoints:[{name:"Default",px:"0",cols:"3"},{name:"Tablet",px:"576",cols:"6"},{name:"Desktop",px:"1024",cols:"12"}],order:3,className:"ge-page",visible:true,disabled:false},
  {id:ids.engineeringPage,type:"ui-page",name:"Сервис",ui:ids.ui,path:"/engineering",icon:"settings",layout:"grid",theme:ids.theme,breakpoints:[{name:"Default",px:"0",cols:"3"},{name:"Tablet",px:"576",cols:"6"},{name:"Desktop",px:"1024",cols:"12"}],order:4,className:"gs-page",visible:true,disabled:false},
  {id:ids.monitorGroup,type:"ui-group",name:"Мониторинг",page:ids.monitorPage,width:"12",height:"1",order:1,showTitle:false,className:"gm-group",visible:"true",disabled:"false",groupType:"default"},
  {id:ids.historyGroup,type:"ui-group",name:"История",page:ids.historyPage,width:"12",height:"1",order:1,showTitle:false,className:"gh-group",visible:"true",disabled:"false",groupType:"default"},
  {id:ids.eventsGroup,type:"ui-group",name:"События",page:ids.eventsPage,width:"12",height:"1",order:1,showTitle:false,className:"ge-group",visible:"true",disabled:"false",groupType:"default"},
  {id:ids.engineeringGroup,type:"ui-group",name:"Сервис",page:ids.engineeringPage,width:"12",height:"1",order:1,showTitle:false,className:"gs-group",visible:"true",disabled:"false",groupType:"default"},
  {id:"ui-monitor",type:"ui-template",z:tab,group:ids.monitorGroup,name:"HMI: monitoring",order:1,width:12,height:10,format:monitoringTemplate,templateScope:"local",storeOutMessages:true,fwdInMessages:false,resendOnRefresh:true,className:"gm-widget",x:1040,y:180,wires:[[]]},
  {id:ids.historyUi,type:"ui-template",z:tab,group:ids.historyGroup,name:"HMI: history",order:1,width:12,height:10,format:historyTemplate,templateScope:"local",storeOutMessages:true,fwdInMessages:false,resendOnRefresh:true,className:"gh-widget",x:220,y:700,wires:[[ids.historyQuery]]},
  {id:ids.eventsUi,type:"ui-template",z:tab,group:ids.eventsGroup,name:"HMI: events",order:1,width:12,height:10,format:eventsTemplate,templateScope:"local",storeOutMessages:true,fwdInMessages:false,resendOnRefresh:true,className:"ge-widget",x:220,y:780,wires:[[ids.eventsQuery]]},
  {id:ids.engineeringUi,type:"ui-template",z:tab,group:ids.engineeringGroup,name:"HMI: engineering",order:1,width:12,height:10,format:engineeringTemplate,templateScope:"local",storeOutMessages:true,fwdInMessages:false,resendOnRefresh:true,className:"gs-widget",x:220,y:860,wires:[[ids.engineeringManager]]},
  {id:"ui-engineering-layout-styles",type:"ui-template",z:tab,ui:ids.ui,name:"Engineering layout styles",format:engineeringLayoutStyles,templateScope:"site:style",storeOutMessages:true,fwdInMessages:false,resendOnRefresh:true,className:"",x:220,y:920,wires:[[]]},
  {id:ids.pollCycle,type:"inject",z:tab,name:"Gas polling scheduler",props:[{p:"payload"}],repeat:"0.5",crontab:"",once:true,onceDelay:1,topic:"",payload:"",payloadType:"date",x:150,y:180,wires:[[ids.pollBuilder]]},
  {id:ids.pollBuilder,type:"function",z:tab,name:"Build polling requests from settings",func:pollBuilderCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:390,y:180,wires:[[ids.pollDelay]]},
  {id:ids.pollDelay,type:"delay",z:tab,name:"Serialize Modbus requests",pauseType:"rate",timeout:"5",timeoutUnits:"seconds",rate:"1",nbRateUnits:"0.1",rateUnits:"second",randomFirst:"1",randomLast:"5",randomUnits:"seconds",drop:false,allowrate:false,outputs:1,x:650,y:180,wires:[[ids.pollGetter]]},
  {id:ids.pollGetter,type:"modbus-flex-getter",z:tab,name:"Read WB-MAI6 input",showStatusActivities:true,showErrors:true,showWarnings:true,logIOActivities:false,server:ids.modbus,useIOFile:false,ioFile:"",useIOForPayload:false,emptyMsgOnFail:true,keepMsgProperties:true,delayOnStart:false,startDelayTime:"",x:880,y:180,wires:[[ids.normalize],[]]},
  {id:ids.normalize,type:"function",z:tab,name:"Validate, scale and classify",func:normalizeCode,outputs:3,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:470,y:180,wires:[[ids.cycleAggregate],[],["debug-wb-mai6-current"]]},
  {id:ids.cycleAggregate,type:"function",z:tab,name:"Publish complete polling cycle",func:cycleAggregateCode,outputs:2,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:720,y:180,wires:[[ids.state],[ids.influxWrite]]},
  {id:"debug-wb-mai6-current",type:"debug",z:tab,name:"WB-MAI6 live current",active:true,tosidebar:true,console:false,tostatus:false,complete:"payload",targetType:"msg",statusVal:"",statusType:"auto",x:770,y:230,wires:[]},
  {id:"clock",type:"inject",z:tab,name:"UI clock",props:[{p:"payload"}],repeat:"1",crontab:"",once:true,onceDelay:0.2,topic:"",payload:"",payloadType:"date",x:470,y:100,wires:[[ids.state]]},
  {id:ids.state,type:"function",z:tab,name:"Build HMI state and valve control",func:stateCode,outputs:3,timeout:0,noerr:0,initialize:'context.set("bootAt",Date.now());',finalize:"",libs:[],x:760,y:180,wires:[["ui-monitor"],[ids.eventWrite,ids.maxRequest],["write-valve-relay"]]},
  {id:"write-valve-relay",type:"modbus-flex-write",z:tab,name:"WB-MR3LV/I K1 held contact",showStatusActivities:true,showErrors:true,showWarnings:true,server:ids.modbus,emptyMsgOnFail:true,keepMsgProperties:true,delayOnStart:false,startDelayTime:"",x:1050,y:230,wires:[[],[]]},
  {id:ids.influxWrite,type:"function",z:tab,name:"Build InfluxDB v2 write",func:influxWriteCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:770,y:280,wires:[[ids.influxWriteHttp]]},
  {id:ids.eventWrite,type:"function",z:tab,name:"Build event journal write",func:eventWriteCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:780,y:320,wires:[[ids.influxWriteHttp]]},
  {id:ids.influxWriteHttp,type:"http request",z:tab,name:"InfluxDB write",method:"use",ret:"txt",paytoqs:"ignore",url:"",tls:"",persist:false,proxy:"",insecureHTTPParser:false,authType:"",senderr:true,headers:[],x:1040,y:280,wires:[[ids.influxTrack]]},
  {id:ids.influxTrack,type:"function",z:tab,name:"Track InfluxDB health",func:influxTrackCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:1250,y:280,wires:[[]]},
  {id:ids.maxRequest,type:"function",z:tab,name:"Build MAX state notification",func:maxRequestCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:780,y:360,wires:[[ids.maxHttp]]},
  {id:"max-reminder-cycle",type:"inject",z:tab,name:"MAX reminder cycle",props:[{p:"payload"}],repeat:"60",crontab:"",once:false,onceDelay:1,topic:"",payload:"",payloadType:"date",x:180,y:420,wires:[[ids.maxReminder]]},
  {id:ids.maxReminder,type:"function",z:tab,name:"Build MAX reminders",func:maxReminderCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:450,y:420,wires:[[ids.maxRequest]]},
  {id:ids.maxHttp,type:"http request",z:tab,name:"MAX send message",method:"use",ret:"obj",paytoqs:"ignore",url:"",tls:"",persist:false,proxy:"",insecureHTTPParser:false,authType:"",senderr:true,headers:[],x:1040,y:360,wires:[[ids.maxTrack]]},
  {id:ids.maxTrack,type:"function",z:tab,name:"Track and retry MAX",func:maxTrackCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:1240,y:360,wires:[[ids.maxDelay]]},
  {id:ids.maxDelay,type:"delay",z:tab,name:"MAX retry delay",pauseType:"delay",timeout:"5",timeoutUnits:"seconds",rate:"1",nbRateUnits:"1",rateUnits:"second",randomFirst:"1",randomLast:"5",randomUnits:"seconds",drop:false,allowrate:false,outputs:1,x:1240,y:410,wires:[[ids.maxHttp]]},
  {id:ids.historyQuery,type:"function",z:tab,name:"Build safe Flux query",func:historyQueryCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:490,y:700,wires:[[ids.historyHttp]]},
  {id:ids.historyHttp,type:"http request",z:tab,name:"InfluxDB query",method:"use",ret:"txt",paytoqs:"body",url:"",tls:"",persist:false,proxy:"",insecureHTTPParser:false,authType:"",senderr:true,headers:[],x:730,y:700,wires:[[ids.historyParse]]},
  {id:ids.historyParse,type:"function",z:tab,name:"Parse history response",func:historyParseCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:960,y:700,wires:[[ids.historyUi]]},
  {id:ids.eventsQuery,type:"function",z:tab,name:"Build event journal query",func:eventsQueryCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:490,y:780,wires:[[ids.eventsHttp]]},
  {id:ids.eventsHttp,type:"http request",z:tab,name:"InfluxDB events query",method:"use",ret:"txt",paytoqs:"body",url:"",tls:"",persist:false,proxy:"",insecureHTTPParser:false,authType:"",senderr:true,headers:[],x:730,y:780,wires:[[ids.eventsParse]]},
  {id:ids.eventsParse,type:"function",z:tab,name:"Parse event journal",func:eventsParseCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:960,y:780,wires:[[ids.eventsUi]]},
  {id:ids.engineeringManager,type:"function",z:tab,name:"Engineering access and settings",func:engineeringManagerCode,outputs:4,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:520,y:860,wires:[[ids.engineeringUi],[ids.eventWrite],[ids.authUsersHttp],["exec-hardware-commission"]]},
  {id:"exec-hardware-commission",type:"exec",z:tab,command:"node /usr/src/node-red/tools/service-commission.mjs",addpay:"payload",append:"",useSpawn:"false",timer:"",winHide:false,oldrc:false,name:"Prepare Modbus hardware",x:790,y:930,wires:[["fn-commission-success"],["fn-commission-failure"],[]]},
  {id:"fn-commission-success",type:"function",z:tab,name:"Hardware preparation succeeded",func:commissionSuccessCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:1070,y:920,wires:[[ids.engineeringUi]]},
  {id:"fn-commission-failure",type:"function",z:tab,name:"Hardware preparation failed",func:commissionFailureCode,outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:1070,y:960,wires:[[ids.engineeringUi]]},
  {id:ids.authUsersHttp,type:"http request",z:tab,name:"Remote users API",method:"use",ret:"obj",paytoqs:"body",url:"",tls:"",persist:false,proxy:"",insecureHTTPParser:false,authType:"",senderr:true,headers:[],x:780,y:860,wires:[[ids.authUsersResponse]]},
  {id:ids.authUsersResponse,type:"function",z:tab,name:"Remote users UI response",func:authUsersResponseCode,outputs:2,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:1030,y:860,wires:[[ids.engineeringUi],[ids.eventWrite]]},
  {id:"catch-runtime",type:"catch",z:tab,name:"Runtime errors",scope:[ids.pollGetter,"write-valve-relay",ids.influxWriteHttp,ids.historyHttp,ids.eventsHttp,ids.maxHttp,ids.authUsersHttp],uncaught:false,x:190,y:520,wires:[["fn-error-log"]]},
  {id:"fn-error-log",type:"function",z:tab,name:"Sanitize and log error",func:'const text=(msg.error?.message || "Runtime error").replace(/Token\\s+[^\\s]+/gi, "Token [redacted]");const health=flow.get("systemHealth")||{};health.lastError={message:text,at:new Date().toISOString(),source:msg.error?.source?.id||null};flow.set("systemHealth",health);node.error(text);return null;',outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:470,y:520,wires:[[]]}
];

writeFileSync(new URL("../flows/flows.json", import.meta.url), JSON.stringify(flow, null, 2) + "\n");
