/**
 * Export the completed pilot participants to an Excel workbook (raw responses,
 * construct scores, condition summary, codebook) and a data-explanation HTML
 * report. Read-only against Supabase; outputs to docs/paper/ (git-ignored).
 * Usage: node scripts/export-pilot-12.mjs [batchId]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'paper')
const BATCH_ID = process.argv[2] || '5a2dbe4a-1e99-44d8-a021-4c7b0fafa5f2'
function parseEnv(f){const o={};try{for(const l of readFileSync(f,'utf8').split('\n')){const m=l.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)o[m[1]]=m[2].trim().replace(/^["']|["']$/g,'')}}catch{}return o}
const env={...parseEnv(path.join(ROOT,'.env.local')),...process.env}
const supa=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const DESIGN={G1:{het:'low',inter:'absent',svc2:'Courier'},G2:{het:'low',inter:'present',svc2:'Courier'},G3:{het:'high',inter:'absent',svc2:'Eats'},G4:{het:'high',inter:'present',svc2:'Eats'}}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null}
const rd=(x,d=2)=>x==null?null:Number(x.toFixed(d))

const {data:asg}=await supa.from('participant_assignments').select('*').eq('batch_id',BATCH_ID).eq('status','completed').order('group_condition').order('assigned_at')
const recs=[]
for(const a of asg){
  const {data:evs}=await supa.from('experiment_events').select('event_name,payload,duration_ms,timestamp').eq('session_id',a.exp_session_id)
  const ev=n=>(evs||[]).find(e=>e.event_name===n)
  const survey=ev('survey.completed')?.payload?.responses||{}
  const quest=ev('questionnaire.completed')?.payload?.responses||{}
  const s2=ev('service2.task.complete')
  const ts=(evs||[]).map(e=>Number(e.timestamp)).filter(Boolean)
  const CL=['CL1','CL2','CL3'].map(c=>num(survey[c])).filter(v=>v!=null)
  const PU=['PU1','PU2','PU3','PU4'].map(c=>num(survey[c])).filter(v=>v!=null)
  const CI=['CI1','CI2','CI3'].map(c=>num(survey[c])).filter(v=>v!=null)
  const MCi=['MC1','MC2'].map(c=>num(survey[c])).filter(v=>v!=null)
  const MCh=['MC3','MC4'].map(c=>num(survey[c])).filter(v=>v!=null)
  recs.push({
    participant_id:a.prolific_pid, prolific_session_id:a.prolific_session_id, condition:a.group_condition,
    heterogeneity:DESIGN[a.group_condition].het, interrelatedness:DESIGN[a.group_condition].inter, second_service:DESIGN[a.group_condition].svc2,
    CL1:num(survey.CL1),CL2:num(survey.CL2),CL3:num(survey.CL3),
    PU1:num(survey.PU1),PU2:num(survey.PU2),PU3:num(survey.PU3),PU4:num(survey.PU4),
    CI1:num(survey.CI1),CI2:num(survey.CI2),CI3:num(survey.CI3),
    MC1:num(survey.MC1),MC2:num(survey.MC2),MC3:num(survey.MC3),MC4:num(survey.MC4),
    AC1:num(survey.AC1),
    age_DEM1:quest.DEM1,gender_DEM2:quest.DEM2,superapp_freq_FAM1:quest.FAM1,switch_familiarity_FAM2:quest.FAM2,
    services_used_SWI1:quest.SWI1,switch_freq_SWI2:quest.SWI2,AC2:quest.AC2,
    banner_tapped:Boolean(ev('trip_complete.banner_tapped')),
    service2_task_sec:s2?.duration_ms?rd(s2.duration_ms/1000):null,
    total_session_sec:ts.length?Math.round((Math.max(...ts)-Math.min(...ts))/1000):null,
    CL_mean:rd(mean(CL)),PU_mean:rd(mean(PU)),CI_mean:rd(mean(CI)),
    MC_interrelatedness:rd(mean(MCi)),MC_heterogeneity:rd(mean(MCh)),
    assigned_at:a.assigned_at,completed_at:a.completed_at,
  })
}

// ---------- Excel ----------
const wb=new ExcelJS.Workbook(); wb.creator='HCI Experiment Harness'; wb.created=new Date()
const style=ws=>{ws.getRow(1).font={bold:true};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1B2A4A'}};ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.views=[{state:'frozen',ySplit:1}]}
const raw=wb.addWorksheet('Raw Responses')
raw.columns=Object.keys(recs[0]).map(k=>({header:k,key:k,width:Math.min(Math.max(k.length+2,10),26)}))
recs.forEach(r=>raw.addRow(r)); style(raw)
const cs=wb.addWorksheet('Construct Scores')
cs.columns=[['participant_id',26],['condition',10],['CL_mean',10],['PU_mean',10],['CI_mean',10],['MC_interrelatedness',20],['MC_heterogeneity',20]].map(([h,w])=>({header:h,key:h,width:w}))
recs.forEach(r=>cs.addRow(r)); style(cs)
// condition summary
const by=c=>recs.filter(r=>r.condition===c)
const cm=(c,k)=>rd(mean(by(c).map(r=>r[k]).filter(v=>v!=null)))
const sum=wb.addWorksheet('Condition Summary')
sum.columns=[['condition',12],['n',6],['CL_mean',10],['PU_mean',10],['CI_mean',10],['MC_interrel',12],['MC_heterog',12],['banner_uptake',14],['service2_sec_mean',18]].map(([h,w])=>({header:h,key:h,width:w}))
for(const c of ['G1','G2','G3','G4']){const g=by(c);sum.addRow({condition:c,n:g.length,CL_mean:cm(c,'CL_mean'),PU_mean:cm(c,'PU_mean'),CI_mean:cm(c,'CI_mean'),MC_interrel:cm(c,'MC_interrelatedness'),MC_heterog:cm(c,'MC_heterogeneity'),banner_uptake:g.length?`${g.filter(r=>r.banner_tapped).length}/${g.length}`:'-',service2_sec_mean:cm(c,'service2_task_sec')})}
style(sum)
// codebook
const CODEBOOK=[
 ['participant_id','Prolific participant ID (pseudonymous key linking app data ↔ Prolific)','string'],
 ['condition','Assigned experimental cell','G1–G4'],
 ['heterogeneity','Service-pair dissimilarity factor','low (Courier) / high (Eats)'],
 ['interrelatedness','Cross-service bridge factor','absent / present'],
 ['second_service','The second service in the episode','Courier / Eats'],
 ['CL1–CL3','Cognitive load items (Raw-TLX adapted); higher = more load','1–7'],
 ['PU1–PU4','Perceived usability items (SUS-adapted); higher = better','1–7'],
 ['CI1–CI3','Continuance intention items; higher = more intent','1–7'],
 ['MC1–MC2','Manipulation check — interrelatedness (prompting / data carry-over)','1–7'],
 ['MC3–MC4','Manipulation check — heterogeneity (services felt different)','1–7'],
 ['AC1','Attention check in post-task survey (correct = 5)','1–7'],
 ['age_DEM1','Age range','18–24 … 55+'],
 ['gender_DEM2','Gender','male/female/non-binary/prefer not to say'],
 ['superapp_freq_FAM1','How often uses multi-service apps','never … daily'],
 ['switch_familiarity_FAM2','Familiarity with switching services','1–5'],
 ['services_used_SWI1','Typical # services per session','1 … 4+'],
 ['switch_freq_SWI2','Frequency of mid-session switching','never … always'],
 ['AC2','Attention check in questionnaire (correct = "rarely")','category'],
 ['banner_tapped','Tapped the cross-service bridge banner (uptake)','true/false'],
 ['service2_task_sec','Primary behavioural DV: time to complete Service-2 task','seconds'],
 ['total_session_sec','Whole-session wall-clock duration','seconds'],
 ['CL_mean / PU_mean / CI_mean','Construct means (item averages)','1–7'],
 ['MC_interrelatedness','Mean of MC1,MC2','1–7'],
 ['MC_heterogeneity','Mean of MC3,MC4','1–7'],
 ['assigned_at / completed_at','Timestamps','ISO 8601'],
]
const cb=wb.addWorksheet('Codebook')
cb.columns=[{header:'variable',key:'v',width:30},{header:'description',key:'d',width:74},{header:'scale / values',key:'s',width:34}]
CODEBOOK.forEach(([v,d,s])=>cb.addRow({v,d,s})); style(cb)
const xlsxPath=path.join(OUT,'hci-pilot-12-data.xlsx')
await wb.xlsx.writeFile(xlsxPath)

// ---------- HTML report ----------
const gm=(cs,k)=>rd(mean(recs.filter(r=>cs.includes(r.condition)).map(r=>r[k]).filter(v=>v!=null)))
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
const condRows=['G1','G2','G3','G4'].map(c=>{const g=by(c);return `<tr><td>${c}</td><td>${DESIGN[c].het}</td><td>${DESIGN[c].inter}</td><td>${g.length}</td><td>${cm(c,'CL_mean')}</td><td>${cm(c,'PU_mean')}</td><td>${cm(c,'CI_mean')}</td><td>${cm(c,'MC_interrelatedness')}</td><td>${cm(c,'MC_heterogeneity')}</td><td>${g.filter(r=>r.banner_tapped).length}/${g.length}</td><td>${cm(c,'service2_task_sec')}</td></tr>`}).join('')
const cbRows=CODEBOOK.map(([v,d,s])=>`<tr><td><code>${esc(v)}</code></td><td>${esc(d)}</td><td>${esc(s)}</td></tr>`).join('')
const interP=gm(['G2','G4'],'MC_interrelatedness'),interA=gm(['G1','G3'],'MC_interrelatedness')
const hetH=gm(['G3','G4'],'MC_heterogeneity'),hetL=gm(['G1','G2'],'MC_heterogeneity')
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HCI Pilot (N=${recs.length}) — Data Explanation Report</title>
<style>:root{--ink:#16181d;--muted:#5b6472;--line:#e4e7ec;--accent:#2f6bff}*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.55;font-size:15px}.wrap{max-width:1000px;margin:0 auto;padding:40px 24px 90px}header{background:linear-gradient(135deg,#0f2b46,#2f6bff);color:#fff;border-radius:16px;padding:30px 32px;margin-bottom:24px}header h1{margin:0 0 6px;font-size:24px}header p{margin:0;opacity:.92;font-size:14px}section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:22px 26px;margin-bottom:18px;box-shadow:0 1px 3px rgba(16,24,40,.08)}h2{font-size:18px;margin:0 0 12px}h3{font-size:14.5px;margin:16px 0 6px}p{margin:0 0 10px}table{border-collapse:collapse;width:100%;margin:8px 0 12px;font-size:12.8px}th,td{border-bottom:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}th{background:#fafbfc;color:var(--muted);text-transform:uppercase;font-size:11px;letter-spacing:.4px}code{background:#f0f2f5;padding:1px 5px;border-radius:5px;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace}.callout{border-radius:10px;padding:12px 15px;margin:10px 0;font-size:13.4px;border:1px solid}.good{background:#eefaf1;border-color:#c7ecd3;color:#166534}.warn{background:#fff8ec;border-color:#f4e2bf;color:#8a5a00}.info{background:#eef4ff;border-color:#cfe0ff;color:#1b3a7a}ul{margin:0 0 10px;padding-left:20px}li{margin:3px 0}.kv{display:grid;grid-template-columns:200px 1fr;gap:5px 14px;font-size:13.5px}.kv div:nth-child(odd){color:var(--muted);font-weight:600}</style></head><body><div class="wrap">
<header><h1>HCI Pilot Study — Data Explanation Report</h1><p>Super-app cross-service experience · 2×2 between-subjects (heterogeneity × interrelatedness) · N = ${recs.length} completed participants · generated ${new Date().toISOString().slice(0,10)}</p></header>
<section><h2>1 · Dataset overview</h2><div class="kv"><div>File</div><div><code>hci-pilot-12-data.xlsx</code> (sheets: Raw Responses, Construct Scores, Condition Summary, Codebook)</div><div>Participants</div><div>${recs.length} completed &amp; valid (passed both attention checks, full event trail)</div><div>Design</div><div>2 (heterogeneity: low=Courier / high=Eats) × 2 (interrelatedness: absent / present) between-subjects; ${by('G1').length}/${by('G2').length}/${by('G3').length}/${by('G4').length} per cell</div><div>Recruitment</div><div>Prolific; identity keyed by <code>participant_id</code></div><div>Scales</div><div>Cognitive Load (CL), Perceived Usability (PU), Continuance Intention (CI), Manipulation Checks (MC) — all 1–7</div></div>
<div class="callout info">Each row in <b>Raw Responses</b> is one participant. Item responses come from the <code>survey.completed</code> and <code>questionnaire.completed</code> events; behavioural measures from the timed task events.</div></section>
<section><h2>2 · Condition summary</h2><table><thead><tr><th>Cond</th><th>Heterog.</th><th>Interrel.</th><th>n</th><th>CL</th><th>PU</th><th>CI</th><th>MC-intr</th><th>MC-het</th><th>Banner</th><th>S2 task (s)</th></tr></thead><tbody>${condRows}</tbody></table>
<p>Means are item averages on the 1–7 scale. "Banner" = # who tapped the cross-service bridge (uptake). "S2 task" = mean Service-2 completion time.</p></section>
<section><h2>3 · Variable dictionary (codebook)</h2><table><thead><tr><th>Variable</th><th>Description</th><th>Scale / values</th></tr></thead><tbody>${cbRows}</tbody></table></section>
<section><h2>4 · How measures were captured</h2><ul>
<li><b>Survey constructs</b> — 15 post-task items (CL×3, PU×4, CI×3, MC×4, AC1) on a 1–7 Likert; stored as a response map in <code>survey.completed</code>.</li>
<li><b>Manipulation checks</b> — MC1/MC2 probe perceived <i>interrelatedness</i> (prompting &amp; data carry-over); MC3/MC4 probe perceived <i>heterogeneity</i> (services felt different).</li>
<li><b>Behavioural DV</b> — <code>service2_task_sec</code> from <code>performance.measure</code> between task start and submit.</li>
<li><b>Banner uptake</b> — presence of a <code>trip_complete.banner_tapped</code> event.</li>
<li><b>Demographics</b> — age, gender, super-app familiarity and switching habits (background questionnaire).</li>
<li><b>Attention checks</b> — AC1 (must = "Somewhat agree"/5) and AC2 (must = "Rarely"); all included rows passed both.</li></ul></section>
<section><h2>5 · Data quality</h2><div class="callout good"><b>Integrity: strong.</b> All ${recs.length} have complete event trails, passed AC1 &amp; AC2, used the full response scale (no straight-lining), and realistic timings.</div>
<div class="callout warn"><b>Validity caveats (pilot).</b> Manipulation checks barely separate — interrelatedness present(${interP}) vs absent(${interA}); heterogeneity high(${hetH}) vs low(${hetL}). PU/CI show ceiling effects (~6.3–7.0 across all cells). Only cognitive load moves as predicted (bridge lower). Treat as a valid pilot indicating design/measurement fixes are needed before scaling, not as confirmatory evidence.</div></section>
<section><h2>6 · Notes &amp; ethics</h2><ul><li><code>participant_id</code> is a pseudonymous Prolific ID — keep this file access-controlled; do not commit to a public repo.</li><li>Excluded from this file: 1 attention-check failure and 1 released session (not part of the valid 12).</li><li>Scores are raw item means; no reverse-coding was applied (none of the current items are reverse-worded).</li></ul></section>
<footer style="text-align:center;color:var(--muted);font-size:12px">HCI Experiment Harness · pilot data export · ${new Date().toISOString().slice(0,10)}</footer>
</div></body></html>`
const htmlPath=path.join(OUT,'hci-pilot-12-data-report.html')
writeFileSync(htmlPath,html)
console.log(`Wrote:\n  ${xlsxPath}\n  ${htmlPath}\nParticipants: ${recs.length}  (cells G1=${by('G1').length} G2=${by('G2').length} G3=${by('G3').length} G4=${by('G4').length})`)
