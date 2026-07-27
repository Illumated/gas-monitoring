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
  influxTrack: "fn-influx-track",
  maxTrack: "fn-max-track",
  maxDelay: "delay-max-retry",
  maxReminder: "fn-max-reminder",
  pollCycle: "poll-cycle",
  pollSequencer: "poll-sequencer"
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
      <div class="gm-clock"><small>Текущее время</small><time>{{ state.clock || '—' }}</time></div>
    </header>
    <section class="gm-grid">
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
        {key:"air",code:"AIR",name:"Медицинский воздух",value:null,status:"nodata",updatedAt:null},
        {key:"n2o",code:"N₂O",name:"Закись азота",value:null,status:"nodata",updatedAt:null}
      ]
      return this.state.gases?.length ? this.state.gases : fallback
    },
    overall() {
      const status = this.state.overall || "nodata"
      return { status, label: this.label(status) }
    },
    identity() {
      return this.state.identity || {monitorId:"—",siteName:"Объект не задан",locationName:"Расположение не задано"}
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
.gm-header{display:grid;grid-template-columns:1fr auto auto;gap:28px;align-items:center;margin-bottom:24px}
.gm-eyebrow{margin:0 0 7px;color:#7fa8c5;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.gm-header h1{margin:0;font-size:clamp(24px,3vw,40px);line-height:1.05}.gm-monitor-id{margin:5px 0 0;color:#8fa9bb;font-size:12px}
.gm-head-status,.gm-clock{min-height:70px;padding:12px 18px;border:1px solid #31516a;border-radius:14px;background:#102638}.gm-head-status{display:flex;align-items:center;gap:12px}.gm-clock{display:grid;align-content:center}.gm-clock time{font-size:20px;font-variant-numeric:tabular-nums;white-space:nowrap}.gm-head-status small,.gm-head-status strong,.gm-clock small,.gm-clock time{display:block}.gm-head-status small,.gm-clock small{color:#94afc2;font-size:11px;text-transform:uppercase}.gm-head-status strong{font-size:18px}.gm-dot{width:14px;height:14px;border-radius:50%;background:#7c8b96;box-shadow:0 0 16px currentColor}
.gm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;min-height:0}.gm-card{position:relative;display:flex;min-height:0;flex-direction:column;padding:22px;border:1px solid #29465c;border-top:5px solid #71808b;border-radius:18px;background:linear-gradient(145deg,#102738,#0b1d2b);box-shadow:0 16px 38px #0005}.gm-card.is-ok{border-top-color:#25c77c}.gm-card.is-warn{border-top-color:#f6b73c}.gm-card.is-alarm{border-top-color:#ff5364}.gm-card-head{display:flex;justify-content:space-between;gap:12px}.gm-card-head p{margin:0;color:#64b9ea;font-size:15px;font-weight:800}.gm-card h2{min-height:54px;margin:5px 0 0;font-size:23px}.gm-badge{min-width:112px;height:max-content;padding:10px 14px;border-radius:10px;background:#263b4a;color:#cbd8e2;font-size:13px;font-weight:900;letter-spacing:.08em;text-align:center}.is-ok .gm-badge{background:#143e30;color:#5de3a4}.is-warn .gm-badge{background:#4a3613;color:#ffd36b}.is-alarm .gm-badge{background:#4c2028;color:#ff8995}
.gm-value{display:flex;flex:1;min-height:110px;align-items:center;justify-content:center;gap:12px;margin:14px 0}.gm-value strong{color:#eef6ff;font-size:clamp(72px,8vw,124px);line-height:.9;font-variant-numeric:tabular-nums;transition:color .2s ease}.gm-card.is-ok .gm-value strong{color:#5de3a4}.gm-card.is-warn .gm-value strong{color:#ffd36b}.gm-card.is-alarm .gm-value strong{color:#ff7080}.gm-value span{align-self:center;color:#94afc2;font-size:22px}
.gm-track{position:relative;display:flex;height:14px;overflow:visible;border-radius:8px}.gm-track .zone{height:100%}.alarm-low,.alarm-high{background:#c83c4b}.warn-low,.warn-high{background:#d99b27}.gm-track .ok{background:#1b9e62}.gm-track i{position:absolute;top:-7px;width:4px;height:28px;transform:translateX(-2px);border-radius:3px;background:#fff;box-shadow:0 0 10px #fff}.gm-scale{display:flex;justify-content:space-between;margin-top:8px;color:#819bad;font-size:11px}.gm-card footer{display:flex;justify-content:space-between;gap:12px;margin-top:28px;color:#8fa9bb;font-size:12px}
.gm-footer{display:flex;align-items:center;gap:20px;margin-top:8px;padding:12px 4px 0;color:#a5bac9;font-size:12px}.gm-footer span{display:flex;align-items:center;gap:6px}.legend{width:9px;height:9px;border-radius:50%}.legend.ok{background:#25c77c}.legend.warn{background:#f6b73c}.legend.alarm{background:#ff5364}.legend.nodata{background:#71808b}.gm-footer nav{display:flex;gap:14px;margin-left:auto}.gm-footer a{color:#72c7f5;font-weight:700;text-decoration:none}
@media(max-width:900px){.nrdb-ui-page.gm-page,.nrdb-ui-group.gm-group,.nrdb-ui-group.gm-group>.v-card{height:auto!important;min-height:100dvh!important}.gm-shell{height:auto;min-height:100dvh;overflow:visible}.gm-header{grid-template-columns:1fr auto}.gm-clock{display:none}.gm-grid{grid-template-columns:1fr}.gm-card h2{min-height:0}.gm-footer{flex-wrap:wrap}.gm-footer a{width:100%;margin:0}}@media(max-width:560px){.gm-shell{padding:14px}.gm-header{grid-template-columns:1fr}.gm-head-status{width:max-content}.gm-card footer{flex-direction:column}.gm-footer{gap:10px}}
</style>`;

const historyTemplate = String.raw`<template>
<main class="gh-shell"><header><div><p>{{identityLine}} · архив измерений</p><h1>История давления</h1></div><nav><a href="/dashboard/monitoring">Мониторинг</a><a href="/dashboard/events">События</a></nav></header>
<section class="gh-controls"><label>Газ<select v-model="gas"><option value="oxygen">Кислород</option><option value="air">Медицинский воздух</option><option value="n2o">Закись азота</option></select></label><div class="gh-ranges"><button v-for="item in ranges" :key="item.value" :class="{active:range===item.value}" @click="selectRange(item.value)">{{item.label}}</button></div><label>С<input type="datetime-local" v-model="start"></label><label>По<input type="datetime-local" v-model="stop"></label><button class="apply" @click="request">Применить</button></section>
<section class="gh-panel"><div class="gh-summary"><div><small>Газ</small><strong>{{gasName}}</strong></div><div><small>Точек</small><strong>{{points.length}}</strong></div><div><small>Последнее</small><strong>{{lastValue}}</strong></div><div><small>Статус</small><strong :class="'text-'+status">{{statusLabel}}</strong></div></div>
<div v-if="loading" class="gh-empty">Загрузка…</div><div v-else-if="error" class="gh-empty error">{{error}}</div><div v-else-if="!points.length" class="gh-empty">За выбранный период данных нет</div>
<div v-else class="gh-chart"><div class="axis-label top">{{fmt(limits.displayMax)}} бар</div><div class="axis-label bottom">0 бар</div><svg viewBox="0 0 1000 360" preserveAspectRatio="none" aria-label="График давления"><line v-for="y in [0,90,180,270,360]" :key="y" x1="0" :y1="y" x2="1000" :y2="y" class="grid"/><rect x="0" :y="zoneY" width="1000" :height="zoneHeight" class="normal-zone"/><polyline v-for="(segment,i) in segments" :key="i" :points="segment" class="line"/><circle v-for="(p,i) in chartPoints" :key="i" :cx="p.x" :cy="p.y" r="3.5" class="point"><title>{{tooltip(p.source)}}</title></circle></svg><div class="gh-time"><span>{{firstTime}}</span><span>{{lastTime}}</span></div><p class="gh-note">Разрывы линии означают отсутствие сохранённых измерений. Тревоги смотрите в журнале событий.</p></div></section></main>
</template><script>
export default{data(){return{gas:"oxygen",range:"24h",start:"",stop:"",loading:false,error:"",points:[],identity:{},windowMs:300000,limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:8},ranges:[{value:"1h",label:"1 час"},{value:"24h",label:"24 часа"},{value:"7d",label:"7 дней"},{value:"30d",label:"30 дней"}]}},computed:{identityLine(){return [this.identity.siteName,this.identity.locationName,this.identity.monitorId].filter(Boolean).join(" · ")||"Установка не задана"},gasName(){return({oxygen:"Кислород",air:"Медицинский воздух",n2o:"Закись азота"})[this.gas]},chartPoints(){if(!this.points.length)return[];const first=Date.parse(this.points[0].time),last=Date.parse(this.points.at(-1).time),span=Math.max(1,last-first),max=Number(this.limits.displayMax)||8;return this.points.map(p=>({x:(Date.parse(p.time)-first)/span*1000,y:360-Math.max(0,Math.min(max,p.value))/max*360,source:p}))},segments(){const result=[];let current=[];this.chartPoints.forEach((p,i)=>{if(i&&Date.parse(p.source.time)-Date.parse(this.chartPoints[i-1].source.time)>this.windowMs*2.5){if(current.length)result.push(current.join(" "));current=[]}current.push(p.x.toFixed(1)+","+p.y.toFixed(1))});if(current.length)result.push(current.join(" "));return result},zoneY(){return 360-(this.limits.okHigh/this.limits.displayMax*360)},zoneHeight(){return (this.limits.okHigh-this.limits.okLow)/this.limits.displayMax*360},last(){return this.points.at(-1)},lastValue(){return this.last?this.fmt(this.last.value)+" бар":"—"},status(){return this.last?.status||"nodata"},statusLabel(){return({ok:"НОРМА",warn:"ВНИМАНИЕ",alarm:"АВАРИЯ",nodata:"НЕТ ДАННЫХ"})[this.status]},firstTime(){return this.points.length?new Date(this.points[0].time).toLocaleString("ru-RU"):""},lastTime(){return this.last?new Date(this.last.time).toLocaleString("ru-RU"):""}},watch:{msg:{deep:true,handler(value){const p=value?.payload;if(p?.kind!=="history")return;this.loading=false;this.error=p.error||"";this.points=p.points||[];this.identity=p.identity||{};this.windowMs=p.windowMs||300000;if(p.limits)this.limits=p.limits;if(p.gas)this.gas=p.gas}}},mounted(){this.request()},methods:{fmt(v){return Number(v).toFixed(1).replace(".",",")},selectRange(v){this.range=v;this.start="";this.stop="";this.request()},request(){if((this.start&&!this.stop)||(!this.start&&this.stop)){this.error="Укажите обе границы периода";return}this.loading=true;this.error="";this.send({payload:{action:"query",gas:this.gas,range:this.range,start:this.start,stop:this.stop}})},tooltip(p){return new Date(p.time).toLocaleString("ru-RU")+" · "+this.fmt(p.value)+" бар"}}}
</script><style>
.nrdb-ui-group.gh-group .nrdb-layout-group--grid{min-height:calc(100dvh - 48px)!important;grid-template-rows:minmax(0,1fr)!important}.nrdb-ui-group.gh-group .gh-widget{height:100%!important;grid-row:1!important;grid-template-rows:minmax(0,1fr)!important;overflow:auto!important}.gh-shell{min-height:calc(100dvh - 48px);box-sizing:border-box;padding:20px 24px;color:#ecf5fc;background:#071521;font-family:Inter,Segoe UI,sans-serif}.gh-shell *{box-sizing:border-box}.gh-shell header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.gh-shell header p{margin:0 0 4px;color:#7fa8c5;font-size:13px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.gh-shell h1{margin:0;font-size:32px}.gh-shell nav{display:flex;gap:16px}.gh-shell header a{color:#72c7f5;font-weight:700;text-decoration:none}.gh-controls{display:grid;grid-template-columns:1.3fr 2fr 1.2fr 1.2fr auto;gap:12px;align-items:end;padding:12px 16px;border:1px solid #29465c;border-radius:16px;background:#102738}.gh-controls label{display:grid;gap:4px;color:#93acbd;font-size:12px}.gh-controls select,.gh-controls input{height:38px;padding:0 11px;border:1px solid #34556d;border-radius:8px;color:#eaf4fb;background:#0a1c29}.gh-ranges{display:flex;gap:6px}.gh-ranges button,.apply{height:38px;padding:0 13px;border:1px solid #34556d;border-radius:8px;color:#c9d9e5;background:#132f42;cursor:pointer}.gh-ranges button.active,.apply{border-color:#159ee0;color:#fff;background:#0878ad}.gh-panel{margin-top:12px;padding:14px 18px;border:1px solid #29465c;border-radius:16px;background:#0d2232}.gh-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}.gh-summary div{padding:9px 12px;border-radius:10px;background:#132c3e}.gh-summary small,.gh-summary strong{display:block}.text-ok{color:#3ed592}.text-warn{color:#ffc85c}.text-alarm{color:#ff7080}.text-nodata{color:#92a2ae}.gh-chart{position:relative;height:min(400px,46dvh);padding:8px 20px 48px 42px}.gh-chart svg{width:100%;height:100%;overflow:visible}.grid{stroke:#254256;stroke-width:1}.normal-zone{fill:#1e9f6320}.line{fill:none;stroke:#4cc5ff;stroke-width:4;vector-effect:non-scaling-stroke}.point{fill:#eaf8ff;stroke:#179edc;stroke-width:2;vector-effect:non-scaling-stroke}.axis-label{position:absolute;left:0;color:#7894a7;font-size:11px}.axis-label.top{top:8px}.axis-label.bottom{bottom:44px}.gh-time{display:flex;justify-content:space-between;color:#7894a7;font-size:11px}.gh-note{margin:6px 0;color:#7894a7;font-size:11px}.gh-empty{display:grid;min-height:350px;place-items:center;color:#89a4b6}.gh-empty.error{color:#ff7b88}@media(max-width:1000px){.gh-controls{grid-template-columns:1fr 1fr}.gh-ranges{grid-column:1/-1}.gh-summary{grid-template-columns:1fr 1fr}}@media(max-width:600px){.gh-shell{padding:14px}.gh-controls{grid-template-columns:1fr}.gh-ranges{grid-column:auto;flex-wrap:wrap}.gh-summary{grid-template-columns:1fr}.gh-chart{height:320px}}
</style>`;

const eventsTemplate = String.raw`<template><main class="ge-shell"><header><div><p>{{identityLine}} · журнал</p><h1>События мониторинга</h1></div><nav><a href="/dashboard/monitoring">Мониторинг</a><a href="/dashboard/history">История</a></nav></header><section class="ge-controls"><label>Газ<select v-model="gas"><option value="all">Все</option><option value="oxygen">Кислород</option><option value="air">Медицинский воздух</option><option value="n2o">Закись азота</option><option value="system">Система</option></select></label><label>Период<select v-model="range"><option value="24h">24 часа</option><option value="7d">7 дней</option><option value="30d">30 дней</option></select></label><button @click="request">Обновить</button></section><section class="ge-panel"><div v-if="loading" class="empty">Загрузка…</div><div v-else-if="error" class="empty error">{{error}}</div><div v-else-if="!events.length" class="empty">Событий нет</div><table v-else><thead><tr><th>Время</th><th>Источник</th><th>Переход</th><th>Значение</th><th>Причина / оператор</th></tr></thead><tbody><tr v-for="(event,i) in events" :key="i" :class="'is-'+event.to"><td>{{time(event.time)}}</td><td>{{event.name}}</td><td>{{label(event.from)}} → {{label(event.to)}}</td><td>{{formatValue(event)}}</td><td>{{event.reason||event.operator||"—"}}</td></tr></tbody></table></section></main></template><script>
export default{data(){return{gas:"all",range:"24h",loading:false,error:"",events:[],identity:{}}},computed:{identityLine(){return [this.identity.siteName,this.identity.locationName,this.identity.monitorId].filter(Boolean).join(" · ")||"Установка не задана"}},watch:{msg:{deep:true,handler(v){const p=v?.payload;if(p?.kind!=="events")return;this.loading=false;this.error=p.error||"";this.events=p.events||[];this.identity=p.identity||{}}}},mounted(){this.request()},methods:{request(){this.loading=true;this.send({payload:{action:"query-events",gas:this.gas,range:this.range}})},time(v){return new Date(v).toLocaleString("ru-RU")},label(v){return({ok:"НОРМА",warn:"ВНИМАНИЕ",alarm:"АВАРИЯ",nodata:"НЕТ ДАННЫХ",startup:"ЗАПУСК",settings:"НАСТРОЙКИ",changed:"ИЗМЕНЕНЫ"})[v]||v||"—"},formatValue(e){return e.hasValue?Number(e.value).toFixed(1).replace(".",",")+" бар":"—"}}}
</script><style>.nrdb-ui-group.ge-group .nrdb-layout-group--grid{min-height:calc(100dvh - 48px)!important;grid-template-rows:minmax(0,1fr)!important}.nrdb-ui-group.ge-group .ge-widget{height:100%!important;overflow:auto!important}.ge-shell{min-height:calc(100dvh - 48px);box-sizing:border-box;padding:24px;color:#ecf5fc;background:#071521;font-family:Inter,Segoe UI,sans-serif}.ge-shell *{box-sizing:border-box}.ge-shell header{display:flex;justify-content:space-between;align-items:center}.ge-shell header p{margin:0;color:#7fa8c5}.ge-shell h1{margin:5px 0 18px}.ge-shell nav{display:flex;gap:16px}.ge-shell a{color:#72c7f5;text-decoration:none;font-weight:700}.ge-controls{display:flex;gap:12px;padding:14px;border:1px solid #29465c;border-radius:14px;background:#102738}.ge-controls label{display:grid;gap:5px;color:#93acbd;font-size:12px}.ge-controls select,.ge-controls button{height:40px;padding:0 12px;border:1px solid #34556d;border-radius:8px;color:#eaf4fb;background:#0a1c29}.ge-controls button{align-self:end;background:#0878ad}.ge-panel{margin-top:15px;overflow:auto;border:1px solid #29465c;border-radius:14px;background:#0d2232}.ge-panel table{width:100%;border-collapse:collapse}.ge-panel th,.ge-panel td{padding:12px;text-align:left;border-bottom:1px solid #213d50}.ge-panel th{color:#8fa9bb}.ge-panel tr.is-alarm{border-left:4px solid #ff5364}.ge-panel tr.is-warn{border-left:4px solid #f6b73c}.ge-panel tr.is-ok{border-left:4px solid #25c77c}.empty{display:grid;min-height:300px;place-items:center}.error{color:#ff7b88}@media(max-width:700px){.ge-shell{padding:14px}.ge-controls{flex-wrap:wrap}.ge-panel{font-size:12px}}</style>`;

const engineeringTemplate = String.raw`<template><main class="gs-shell"><header><div><p>{{identityLine}} · сервис</p><h1>Состояние и настройки</h1></div><a href="/dashboard/monitoring">← Мониторинг</a></header><section class="gs-health"><article v-for="item in healthCards" :key="item.name" :class="'is-'+item.status"><small>{{item.name}}</small><strong>{{item.value}}</strong><span>{{item.detail}}</span></article></section><section class="gs-panel"><div class="gs-title"><div><h2>Объект и пороговые зоны</h2><p>Изменения применяются сразу и сохраняются после перезапуска.</p></div><span :class="unlocked?'open':'locked'">{{unlocked?"РАЗБЛОКИРОВАНО":"ТОЛЬКО ЧТЕНИЕ"}}</span></div><div v-if="!unlocked" class="unlock"><input type="password" v-model="code" placeholder="Сервисный код"><button @click="unlock">Разблокировать</button></div><div class="object-settings"><label>ID установки из Debian hostname<input :value="identity.monitorId" disabled></label><label>Название больницы<input v-model="siteName" maxlength="120" :disabled="!unlocked"></label><label>Расположение<input v-model="locationName" maxlength="120" :disabled="!unlocked"></label></div><div class="settings"><div v-for="gas in gases" :key="gas.key" class="gas"><h3>{{gas.name}}</h3><label>Красная → жёлтая<input type="number" step="0.1" v-model.number="gas.warnLow" :disabled="!unlocked"></label><label>Жёлтая → зелёная<input type="number" step="0.1" v-model.number="gas.okLow" :disabled="!unlocked"></label><label>Зелёная → жёлтая<input type="number" step="0.1" v-model.number="gas.okHigh" :disabled="!unlocked"></label><label>Жёлтая → красная<input type="number" step="0.1" v-model.number="gas.warnHigh" :disabled="!unlocked"></label></div></div><div class="global"><label>Максимум шкалы<input type="number" step="0.1" v-model.number="displayMax" :disabled="!unlocked"></label><label>Гистерезис<input type="number" step="0.1" v-model.number="hysteresis" :disabled="!unlocked"></label><label>Исполнитель<input v-model="operator" :disabled="!unlocked"></label><button @click="save" :disabled="!unlocked">Проверить и сохранить</button></div><p class="message" :class="{error:!success}">{{message}}</p></section></main></template><script>
export default{data(){return{health:{},identity:{},siteName:"",locationName:"",gases:[],displayMax:8,hysteresis:.1,unlocked:false,code:"",operator:"",message:"",success:true,timer:null}},computed:{identityLine(){return [this.identity.siteName,this.identity.locationName,this.identity.monitorId].filter(Boolean).join(" · ")||"Установка не задана"},healthCards(){const h=this.health||{},g=h.gases||{};const age=k=>g[k]?.ageSeconds==null?"нет данных":g[k].ageSeconds+" с";return[{name:"O₂ / Modbus",value:age("oxygen"),detail:"с последнего измерения",status:g.oxygen?.fresh?"ok":"bad"},{name:"AIR / Modbus",value:age("air"),detail:"с последнего измерения",status:g.air?.fresh?"ok":"bad"},{name:"N₂O / Modbus",value:age("n2o"),detail:"с последнего измерения",status:g.n2o?.fresh?"ok":"bad"},{name:"InfluxDB",value:h.influx?.status||"ожидание",detail:h.influx?.lastSuccessUtc||"нет успешной записи",status:h.influx?.status==="ok"?"ok":"bad"},{name:"MAX",value:h.max?.status||"отключён",detail:h.max?.lastSuccessUtc||"нет доставки",status:["ok","disabled"].includes(h.max?.status)?"ok":"bad"}]}},watch:{msg:{deep:true,handler(v){const p=v?.payload;if(p?.kind!=="engineering")return;this.health=p.health||{};this.identity=p.identity||{};this.unlocked=!!p.unlocked;this.success=p.success!==false;this.message=p.message||"";if(p.settings){this.siteName=p.settings.siteName||"";this.locationName=p.settings.locationName||"";this.gases=p.settings.gases.map(x=>({...x}));this.displayMax=p.settings.displayMax;this.hysteresis=p.settings.hysteresis}}}},mounted(){this.load();this.timer=setInterval(()=>this.load(),5000)},unmounted(){clearInterval(this.timer)},methods:{sendAction(action,extra={}){this.send({payload:{action,...extra}})},load(){this.sendAction("engineering-load")},unlock(){this.sendAction("engineering-unlock",{code:this.code});this.code=""},save(){this.sendAction("engineering-save",{operator:this.operator,settings:{siteName:this.siteName,locationName:this.locationName,gases:this.gases,displayMax:this.displayMax,hysteresis:this.hysteresis}})}}}
</script><style>.nrdb-ui-group.gs-group .nrdb-layout-group--grid{min-height:calc(100dvh - 48px)!important;grid-template-rows:minmax(0,1fr)!important}.nrdb-ui-group.gs-group .gs-widget{height:100%!important;overflow:auto!important}.gs-shell{min-height:calc(100dvh - 48px);box-sizing:border-box;padding:22px;color:#ecf5fc;background:#071521;font-family:Inter,Segoe UI,sans-serif}.gs-shell *{box-sizing:border-box}.gs-shell header{display:flex;justify-content:space-between}.gs-shell header p{margin:0;color:#7fa8c5}.gs-shell h1{margin:5px 0 16px}.gs-shell a{color:#72c7f5;text-decoration:none;font-weight:700}.gs-health{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.gs-health article{padding:13px;border:1px solid #29465c;border-top:4px solid #ff5364;border-radius:12px;background:#102738}.gs-health article.is-ok{border-top-color:#25c77c}.gs-health small,.gs-health strong,.gs-health span{display:block}.gs-health strong{margin:7px 0;font-size:18px}.gs-health span{color:#8fa9bb;font-size:11px}.gs-panel{margin-top:14px;padding:16px;border:1px solid #29465c;border-radius:14px;background:#0d2232}.gs-title{display:flex;justify-content:space-between}.gs-title h2,.gs-title p{margin:0 0 5px}.gs-title span{height:max-content;padding:7px 10px;border-radius:7px;font-size:11px;font-weight:800}.locked{background:#48242a;color:#ff8995}.open{background:#143e30;color:#5de3a4}.unlock,.global{display:flex;gap:10px;margin:12px 0}.object-settings{display:grid;grid-template-columns:1fr 1.4fr 1.4fr;gap:10px;margin:12px 0}.object-settings label,.gas label,.global label{display:grid;gap:4px;margin:6px 0;color:#91aaba;font-size:11px}.object-settings input,.gas input,.global input,.unlock input{height:36px;padding:0 9px;border:1px solid #34556d;border-radius:7px;color:#eef6ff;background:#091a27}.object-settings input:disabled{color:#9db2c1;background:#0a1a25}.settings{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.gas{padding:12px;border-radius:10px;background:#132c3e}.gas h3{margin:0 0 8px}.global{align-items:end}.global label{flex:1}.gs-panel button{height:36px;padding:0 12px;border:0;border-radius:7px;color:#fff;background:#0878ad}.gs-panel button:disabled{opacity:.4}.message{min-height:18px;color:#5de3a4}.message.error{color:#ff8995}@media(max-width:1000px){.gs-health{grid-template-columns:repeat(2,1fr)}.object-settings,.settings{grid-template-columns:1fr}.global{flex-wrap:wrap}}@media(max-width:600px){.gs-shell{padding:14px}.gs-health{grid-template-columns:1fr}}</style>`;

const normalizeCode = `const channels = {
  oxygen: { code: "O₂", name: "Кислород", prefix: "OXYGEN" },
  air: { code: "AIR", name: "Медицинский воздух", prefix: "AIR" },
  n2o: { code: "N₂O", name: "Закись азота", prefix: "N2O" }
};
msg.topic = msg.modbusRequest?.name || msg.topic;
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
  displayMax:Number.isFinite(runtimeSettings.displayMax) ? runtimeSettings.displayMax : number("GAS_DISPLAY_MAX_BAR",8)
};
if (!(limits.warnLow <= limits.okLow && limits.okLow < limits.okHigh && limits.okHigh <= limits.warnHigh && limits.warnHigh < limits.displayMax)) {
  node.error("Invalid threshold order for " + msg.topic);
  return null;
}
const classification = context.get("classificationStatus") || {};
const source = Array.isArray(msg.payload?.data) ? msg.payload.data : (Array.isArray(msg.payload) ? msg.payload : []);
if (source.length === 0) return [null,null];
const raw = Number(source[0]);
if (!Number.isFinite(raw) || raw === 32767 || raw === -32768) {
  classification[msg.topic] = "nodata";
  context.set("classificationStatus", classification);
  const payload={key:msg.topic,code:gas.code,name:gas.name,value:null,raw:null,status:"nodata",reason:"invalid",limits,updatedAt:Date.now()};
  return [{payload},null];
}
const value = Math.round(raw) / 10;
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
const payload = {key:msg.topic,code:gas.code,name:gas.name,value,raw,status,reason:null,limits,updatedAt:Date.now()};
return [{payload},{payload}];`;

const stateCode = `const initial = {
  oxygen:{key:"oxygen",code:"O₂",name:"Кислород",value:null,raw:null,status:"nodata",limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:8},updatedAt:null},
  air:{key:"air",code:"AIR",name:"Медицинский воздух",value:null,raw:null,status:"nodata",limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:8},updatedAt:null},
  n2o:{key:"n2o",code:"N₂O",name:"Закись азота",value:null,raw:null,status:"nodata",limits:{warnLow:3.5,okLow:4,okHigh:6,warnHigh:6.5,displayMax:8},updatedAt:null}
};
const state = context.get("gasState") || initial;
if (msg.payload?.key && state[msg.payload.key]) {
  const previous = state[msg.payload.key];
  state[msg.payload.key] = msg.payload.status === "nodata" && msg.payload.value === null
    ? {...msg.payload,lastValue:Number.isFinite(previous.value)?previous.value:previous.lastValue}
    : msg.payload;
}
const pollMs = Math.max(500, Number(env.get("MODBUS_POLL_INTERVAL_MS")) || 1000);
const staleMs = Math.max(pollMs * 3, Number(env.get("GAS_STALE_TIMEOUT_MS")) || 4000);
for (const key of Object.keys(state)) {
  if (state[key].updatedAt && Date.now() - state[key].updatedAt > staleMs) {
    state[key] = {...state[key],lastValue:Number.isFinite(state[key].value)?state[key].value:state[key].lastValue,value:null,status:"nodata",reason:"stale"};
  }
}
context.set("gasState", state);
flow.set("gasState", state);
const health = flow.get("systemHealth") || {};
health.gases = Object.fromEntries(Object.entries(state).map(([key,gas]) => [key,{updatedAt:gas.updatedAt,status:gas.status}]));
flow.set("systemHealth", health);
const order = {ok:0,warn:1,nodata:2,alarm:3};
const gases = ["oxygen","air","n2o"].map(key => state[key]);
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
const configuredIdentity=flow.get("runtimeSettings")||{};
const identity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(configuredIdentity.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(configuredIdentity.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};
msg.payload = {clock:new Date().toLocaleString("ru-RU",{timeZone:env.get("TZ")||"Europe/Moscow"}),identity,overall,gases};
return [msg,events];`;

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
const gases = new Set(["oxygen","air","n2o"]);
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
const prefixes={oxygen:"OXYGEN",air:"AIR",n2o:"N2O"};
const prefix=prefixes[input.gas];
const number=(name,fallback)=>{const raw=env.get(name);const value=Number(raw);return raw!==undefined&&raw!==null&&String(raw).trim()!==""&&Number.isFinite(value)?value:fallback};
const configured=(flow.get("runtimeSettings")||{});
msg.historyIdentity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(configured.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(configured.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};
const channel=configured.gases?.find(item=>item.key===input.gas)||{};
msg.historyLimits={warnLow:Number.isFinite(channel.warnLow)?channel.warnLow:number(prefix+"_WARN_LOW_BAR",3.5),okLow:Number.isFinite(channel.okLow)?channel.okLow:number(prefix+"_OK_LOW_BAR",4),okHigh:Number.isFinite(channel.okHigh)?channel.okHigh:number(prefix+"_OK_HIGH_BAR",6),warnHigh:Number.isFinite(channel.warnHigh)?channel.warnHigh:number(prefix+"_WARN_HIGH_BAR",6.5),displayMax:Number.isFinite(configured.displayMax)?configured.displayMax:number("GAS_DISPLAY_MAX_BAR",8)};
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
if (!["gas-state-change","gas-reminder"].includes(event?.kind)) return null;
const token = env.get("MAX_BOT_TOKEN");
const chatId = env.get("MAX_CHAT_ID");
if (!token || !chatId) {
  node.error("MAX notifications enabled, but MAX_BOT_TOKEN or MAX_CHAT_ID is empty");
  return null;
}
const labels={ok:"НОРМА",warn:"ВНИМАНИЕ",alarm:"АВАРИЯ",nodata:"НЕТ ДАННЫХ",startup:"ЗАПУСК"};
const configuredIdentity=flow.get("runtimeSettings")||{};
const identity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(configuredIdentity.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(configuredIdentity.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};
const formatValue=value=>Number(value).toFixed(1).replace(".",",")+" бар";
const isRecovery=event.to==="ok"&&event.from!=="ok";
const title=event.kind==="gas-reminder"?"⚠️ НАПОМИНАНИЕ":isRecovery?"✅ ВОССТАНОВЛЕНО":event.to==="alarm"?"🔴 АВАРИЯ":event.to==="warn"?"🟡 ВНИМАНИЕ":event.to==="nodata"?"⚫ НЕТ ДАННЫХ":"ℹ️ СОСТОЯНИЕ";
const lines=[title+" — "+event.name,"","Объект: "+identity.siteName,"Расположение: "+identity.locationName,"Установка: "+identity.monitorId,""];
if(Number.isFinite(event.value))lines.push("Давление: "+formatValue(event.value));
else if(Number.isFinite(event.lastValue))lines.push("Последнее значение: "+formatValue(event.lastValue));
else lines.push("Давление: значение отсутствует");
lines.push("Переход: "+labels[event.from]+" → "+labels[event.to]);
if(event.to==="nodata"){const reason=event.reason==="stale"?"нет достоверных данных более "+(Number(env.get("GAS_STALE_TIMEOUT_MS"))||4000)/1000+" секунд":event.reason==="invalid"?"получено недостоверное значение":event.reason||"нет достоверного измерения";lines.push("Причина: "+reason)}
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
if(!["gas-state-change","settings-change"].includes(event?.kind))return null;
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
const gases=new Set(["all","oxygen","air","n2o","system"]);
if(!gases.has(input.gas))return {payload:{kind:"events",events:[],error:"Неизвестный источник"}};
const gasFilter=input.gas==="all"?"":' and r.gas == '+JSON.stringify(input.gas);
const query='from(bucket: '+JSON.stringify(env.get("INFLUXDB_BUCKET"))+') |> range(start: '+(starts[input.range]||"-24h")+') |> filter(fn:(r)=>r._measurement == "gas_event" and r._field == "value"'+gasFilter+') |> group() |> sort(columns:["_time"],desc:true) |> limit(n:500) |> keep(columns:["_time","_value","gas","name","from","to","reason","operator","has_value","duration_ms"])';
const configuredIdentity=flow.get("runtimeSettings")||{};msg.eventsIdentity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(configuredIdentity.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(configuredIdentity.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};msg.method="POST";msg.url=env.get("INFLUXDB_URL")+"/api/v2/query?org="+encodeURIComponent(env.get("INFLUXDB_ORG"));msg.headers={"Authorization":"Token "+env.get("INFLUXDB_TOKEN"),"Content-Type":"application/json","Accept":"text/csv"};msg.payload={query,type:"flux",dialect:{header:true,delimiter:",",annotations:[],commentPrefix:"#",dateTimeFormat:"RFC3339"}};return msg;`;

const eventsParseCode = `if(Number(msg.statusCode)>=400)return {payload:{kind:"events",events:[],identity:msg.eventsIdentity,error:"InfluxDB вернул HTTP "+msg.statusCode}};
const lines=String(msg.payload||"").trim().split(/\\r?\\n/).filter(Boolean);if(lines.length<2)return {payload:{kind:"events",events:[],identity:msg.eventsIdentity,error:""}};
const headers=lines[0].split(",");const index=name=>headers.indexOf(name);const events=lines.slice(1).filter(line=>!line.startsWith("_time,")).map(line=>{const c=line.split(",");return{time:c[index("_time")],value:Number(c[index("_value")]),gas:c[index("gas")],name:c[index("name")],from:c[index("from")],to:c[index("to")],reason:c[index("reason")]==="none"?"":c[index("reason")],operator:c[index("operator")]==="system"?"":c[index("operator")],hasValue:c[index("has_value")]==="true",durationMs:Number(c[index("duration_ms")])}}).filter(event=>event.time);return {payload:{kind:"events",events,identity:msg.eventsIdentity,error:""}};`;

const engineeringManagerCode = `const defaults=()=>{const number=(name,fallback)=>{const raw=env.get(name);const value=Number(raw);return raw!==undefined&&raw!==null&&String(raw).trim()!==""&&Number.isFinite(value)?value:fallback};return{siteName:"",locationName:"",gases:[{key:"oxygen",name:"Кислород",warnLow:number("OXYGEN_WARN_LOW_BAR",3.5),okLow:number("OXYGEN_OK_LOW_BAR",4),okHigh:number("OXYGEN_OK_HIGH_BAR",6),warnHigh:number("OXYGEN_WARN_HIGH_BAR",6.5)},{key:"air",name:"Медицинский воздух",warnLow:number("AIR_WARN_LOW_BAR",3.5),okLow:number("AIR_OK_LOW_BAR",4),okHigh:number("AIR_OK_HIGH_BAR",6),warnHigh:number("AIR_WARN_HIGH_BAR",6.5)},{key:"n2o",name:"Закись азота",warnLow:number("N2O_WARN_LOW_BAR",3.5),okLow:number("N2O_OK_LOW_BAR",4),okHigh:number("N2O_OK_HIGH_BAR",6),warnHigh:number("N2O_WARN_HIGH_BAR",6.5)}],displayMax:number("GAS_DISPLAY_MAX_BAR",8),hysteresis:number("GAS_HYSTERESIS_BAR",.1)}};
const client=msg._client?.socketId||msg.socketid||"unknown";const unlocks=context.get("unlocks")||{};const now=Date.now();const unlocked=Number(unlocks[client])>now;const base=defaults();const stored=flow.get("runtimeSettings")||{};const current={...base,...stored,siteName:String(stored.siteName||base.siteName).trim(),locationName:String(stored.locationName||base.locationName).trim(),gases:Array.isArray(stored.gases)?stored.gases:base.gases};const health=flow.get("systemHealth")||{};const staleMs=Math.max(1500,Number(env.get("GAS_STALE_TIMEOUT_MS"))||4000);const gases=flow.get("gasState")||{};health.gases=Object.fromEntries(["oxygen","air","n2o"].map(key=>{const updatedAt=gases[key]?.updatedAt||null;return[key,{ageSeconds:updatedAt?Math.round((now-updatedAt)/1000):null,fresh:!!updatedAt&&now-updatedAt<=staleMs,status:gases[key]?.status||"nodata"}]}));health.max=health.max||{status:String(env.get("MAX_NOTIFICATIONS_ENABLED")).toLowerCase()==="true"?"waiting":"disabled"};
const response=(extra={})=>{const settings=flow.get("runtimeSettings")||current;const identity={monitorId:String(env.get("MONITOR_ID")||"").trim(),siteName:String(settings.siteName||"ОБЪЕКТ НЕ НАСТРОЕН").trim(),locationName:String(settings.locationName||"РАСПОЛОЖЕНИЕ НЕ НАСТРОЕНО").trim()};return{payload:{kind:"engineering",identity,settings,health,unlocked:Number(unlocks[client])>Date.now(),...extra}}};
const action=msg.payload?.action;if(action==="engineering-load")return [response(),null];
if(action==="engineering-unlock"){const configured=String(env.get("SERVICE_ACCESS_CODE")||"");if(!configured)return[response({success:false,message:"SERVICE_ACCESS_CODE не настроен"}),null];if(String(msg.payload.code)!==configured)return[response({success:false,message:"Неверный сервисный код"}),null];const minutes=Math.min(60,Math.max(1,Number(env.get("SERVICE_UNLOCK_MINUTES"))||15));unlocks[client]=Date.now()+minutes*60000;context.set("unlocks",unlocks);return[response({success:true,message:"Настройки разблокированы на "+minutes+" мин"}),null]}
if(action!=="engineering-save")return null;if(!unlocked)return[response({success:false,message:"Сервисная сессия истекла"}),null];const operator=String(msg.payload.operator||"").trim();if(!operator)return[response({success:false,message:"Укажите исполнителя"}),null];const candidate=msg.payload.settings;const siteName=String(candidate?.siteName||"").trim();const locationName=String(candidate?.locationName||"").trim();if(!siteName||!locationName||siteName.length>120||locationName.length>120||/[\\r\\n]/.test(siteName+locationName))return[response({success:false,message:"Укажите название больницы и расположение одной строкой"}),null];const keys=["oxygen","air","n2o"];if(!candidate||!Array.isArray(candidate.gases)||candidate.gases.length!==3||!Number.isFinite(candidate.displayMax)||candidate.displayMax<=0||!Number.isFinite(candidate.hysteresis)||candidate.hysteresis<0||candidate.hysteresis>1)return[response({success:false,message:"Некорректные общие параметры"}),null];for(const key of keys){const gas=candidate.gases.find(item=>item.key===key);if(!gas||![gas.warnLow,gas.okLow,gas.okHigh,gas.warnHigh].every(Number.isFinite)||!(0<=gas.warnLow&&gas.warnLow<=gas.okLow&&gas.okLow<gas.okHigh&&gas.okHigh<=gas.warnHigh&&gas.warnHigh<candidate.displayMax))return[response({success:false,message:"Нарушен порядок порогов "+key}),null]}
const saved={siteName,locationName,gases:candidate.gases.map(gas=>({key:gas.key,name:gas.name,warnLow:gas.warnLow,okLow:gas.okLow,okHigh:gas.okHigh,warnHigh:gas.warnHigh})),displayMax:candidate.displayMax,hysteresis:candidate.hysteresis,updatedAt:new Date().toISOString(),operator};flow.set("runtimeSettings",saved);const event={payload:{kind:"settings-change",operator,details:JSON.stringify(saved),updatedAt:Date.now()}};return[response({success:true,message:"Настройки сохранены"}),event];`;

const influxTrackCode = `const health=flow.get("systemHealth")||{};const ok=Number(msg.statusCode)>=200&&Number(msg.statusCode)<300;health.influx={status:ok?"ok":"error",lastSuccessUtc:ok?new Date().toISOString():health.influx?.lastSuccessUtc||null,lastError:ok?null:"HTTP "+msg.statusCode,operation:msg.influxOperation||"measurement"};flow.set("systemHealth",health);return null;`;

const maxReminderCode = `if(String(env.get("MAX_NOTIFICATIONS_ENABLED")).toLowerCase()!=="true")return null;const state=flow.get("gasState")||{};const interval=Math.max(1,Number(env.get("MAX_REMINDER_INTERVAL_MINUTES"))||30)*60000;const last=context.get("lastReminder")||{};const now=Date.now();const result=[];for(const gas of Object.values(state)){if(!gas.updatedAt||gas.status==="ok"||now-(last[gas.key]||0)<interval)continue;last[gas.key]=now;result.push({payload:{kind:"gas-reminder",key:gas.key,name:gas.name,value:gas.value,lastValue:gas.lastValue,from:gas.status,to:gas.status,reason:gas.reason,updatedAt:now}})}context.set("lastReminder",last);return result;`;

const maxTrackCode = `const ok=Number(msg.statusCode)>=200&&Number(msg.statusCode)<300;const health=flow.get("systemHealth")||{};if(ok){health.max={status:"ok",lastSuccessUtc:new Date().toISOString(),lastError:null,attempt:msg.maxAttempt};flow.set("systemHealth",health);return null}const limit=Math.max(0,Math.min(5,Number(env.get("MAX_RETRY_COUNT"))||2));if((msg.maxAttempt||1)<=limit){msg.maxAttempt=(msg.maxAttempt||1)+1;msg.payload=msg.maxRequestBody;return msg}health.max={status:"error",lastSuccessUtc:health.max?.lastSuccessUtc||null,lastError:"HTTP "+msg.statusCode,attempt:msg.maxAttempt};flow.set("systemHealth",health);node.error("MAX delivery failed after "+msg.maxAttempt+" attempts");return null;`;

const flow = [
  {id:tab,type:"tab",label:"RINIR Gas Monitoring",disabled:false,info:"Product flow: WB-MAI6 via USR-DR134, InfluxDB v2 and FlowFuse Dashboard."},
  {id:ids.modbus,type:"modbus-client",name:"USR-DR134 / WB-MAI6",clienttype:"tcp",bufferCommands:true,stateLogEnabled:false,queueLogEnabled:false,failureLogEnabled:true,tcpHost:"${MODBUS_HOST}",tcpPort:"${MODBUS_PORT}",tcpType:"DEFAULT",serialPort:"/dev/ttyS0",serialType:"RTU-BUFFERD",serialBaudrate:"9600",serialDatabits:"8",serialStopbits:"1",serialParity:"none",serialConnectionDelay:"100",serialAsciiResponseStartDelimiter:"",unit_id:65,commandDelay:"${MODBUS_COMMAND_DELAY_MS}",clientTimeout:"3000",reconnectOnTimeout:true,reconnectTimeout:2000,parallelUnitIdsAllowed:false,showErrors:true,showWarnings:true,showLogs:false},
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
  {id:ids.pollCycle,type:"inject",z:tab,name:"Gas polling cycle",props:[{p:"payload"}],repeat:"1",crontab:"",once:true,onceDelay:1,topic:"",payload:"",payloadType:"date",x:170,y:180,wires:[[ids.pollSequencer]]},
  {id:ids.pollSequencer,type:"modbus-flex-sequencer",z:tab,name:"O₂ → AIR → N₂O",sequences:[{name:"oxygen",unitid:"65",fc:"FC4",address:"5380",quantity:"1"},{name:"air",unitid:"65",fc:"FC4",address:"9476",quantity:"1"},{name:"n2o",unitid:"65",fc:"FC4",address:"13572",quantity:"1"}],server:ids.modbus,showStatusActivities:true,showErrors:true,showWarnings:true,logIOActivities:false,useIOFile:false,ioFile:"",useIOForPayload:false,emptyMsgOnFail:true,keepMsgProperties:true,delayOnStart:false,startDelayTime:"",x:430,y:180,wires:[[ids.normalize],[]]},
  {id:ids.normalize,type:"function",z:tab,name:"Validate, scale and classify",func:normalizeCode,outputs:2,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:470,y:180,wires:[[ids.state],[ids.influxWrite]]},
  {id:"clock",type:"inject",z:tab,name:"UI clock",props:[{p:"payload"}],repeat:"1",crontab:"",once:true,onceDelay:0.2,topic:"",payload:"",payloadType:"date",x:470,y:100,wires:[[ids.state]]},
  {id:ids.state,type:"function",z:tab,name:"Build HMI state and transitions",func:stateCode,outputs:2,timeout:0,noerr:0,initialize:'context.set("bootAt",Date.now());',finalize:"",libs:[],x:760,y:180,wires:[["ui-monitor"],[ids.eventWrite,ids.maxRequest]]},
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
  {id:ids.engineeringManager,type:"function",z:tab,name:"Engineering access and settings",func:engineeringManagerCode,outputs:2,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:520,y:860,wires:[[ids.engineeringUi],[ids.eventWrite]]},
  {id:"catch-runtime",type:"catch",z:tab,name:"Runtime errors",scope:[ids.pollSequencer,ids.influxWriteHttp,ids.historyHttp,ids.eventsHttp,ids.maxHttp],uncaught:false,x:190,y:520,wires:[["fn-error-log"]]},
  {id:"fn-error-log",type:"function",z:tab,name:"Sanitize and log error",func:'const text=(msg.error?.message || "Runtime error").replace(/Token\\s+[^\\s]+/gi, "Token [redacted]");const health=flow.get("systemHealth")||{};health.lastError={message:text,at:new Date().toISOString(),source:msg.error?.source?.id||null};flow.set("systemHealth",health);node.error(text);return null;',outputs:1,timeout:0,noerr:0,initialize:"",finalize:"",libs:[],x:470,y:520,wires:[[]]}
];

writeFileSync(new URL("../flows/flows.json", import.meta.url), JSON.stringify(flow, null, 2) + "\n");
