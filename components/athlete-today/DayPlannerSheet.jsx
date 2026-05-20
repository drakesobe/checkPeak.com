// components/athlete-today/DayPlannerSheet.jsx
// Outlook-style day planner. Slides up over today.jsx.
//
// Changes from original:
// 1. SCROLL FIX - touchmove listener is now passive:true. We never call
//    preventDefault() so there's no reason for it to be non-passive.
//    Swipe-to-change-day now requires a predominantly horizontal gesture
//    (|dx|>60 AND |dy|<50) so vertical scrolling never accidentally flips days.
//    Sheet container gets explicit height:"100dvh" so flex overflow works on iOS.
// 2. PERSISTENCE - after every drag/resize, onNutritionTimesChange fires with
//    { breakfast, lunch, afternoon, dinner } → startMinutes so today.jsx can
//    update the RouteList time display without a server round-trip.
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Check, RefreshCw } from "lucide-react";
import { useAthleteToday }          from "@/hooks/athlete-today/useAthleteToday";
import { useWorkoutCompletion }      from "@/hooks/athlete-today/useWorkoutCompletion";
import { useAthleteNutritionToday } from "@/hooks/athlete-today/useAthleteNutritionToday";
import CompleteItemModal             from "@/components/athlete-today/CompleteItemModal";
import ClassScheduleModal            from "@/components/athlete-today/ClassScheduleModal";

const T = {
  bg:"#0D1117", bgBlock:"#13181F", bgElevated:"#161B22",
  border:"#21262D", borderMid:"#30363D",
  textPrimary:"#F0F6FC", textSecond:"#C9D1D9", textMuted:"#8B949E",
  textFaint:"#6B7280", textTiny:"#30363D",
  red:"#DA3633", redBg:"#1C0B0B", redText:"#FF7B72",
  blue:"#1F6FEB", blueBg:"#0D1526", blueText:"#79B8FF",
  green:"#238636", greenBg:"#0D1F12", greenText:"#3FB950",
};

const HOUR_HEIGHT=96, TOTAL_HEIGHT=HOUR_HEIGHT*24, SNAP_MINUTES=15;
const MIN_DURATION=15, MIN_BLOCK_PX=60;
const HOURS=Array.from({length:24},(_,i)=>i);

const BLOCK_TYPES={
  workout: {label:"Workout", border:"#DA3633",bg:"#1C0B0B",title:"#F0F6FC",meta:"#6B7280"},
  practice:{label:"Practice",border:"#238636",bg:"#0D1F12",title:"#F0F6FC",meta:"#6B7280"},
  class:   {label:"Class",   border:"#E3B341",bg:"#1C1609",title:"#F0F6FC",meta:"#6B7280"},
  training:{label:"Training",border:"#8957E5",bg:"#13091C",title:"#F0F6FC",meta:"#6B7280"},
  meal:    {label:"Meal",    border:"#F0883E",bg:"#1C1009",title:"#F0F6FC",meta:"#6B7280"},
  break:   {label:"Break",   border:"#8B949E",bg:"#13181F",title:"#C9D1D9",meta:"#6B7280"},
};

const MEAL_DEFAULTS={
  breakfast:{startMinutes:7*60,      durationMinutes:45},
  lunch:    {startMinutes:12*60,     durationMinutes:45},
  afternoon:{startMinutes:15*60,     durationMinutes:30},
  dinner:   {startMinutes:18*60+30,  durationMinutes:45},
};
const MEAL_LABELS={breakfast:"Breakfast",lunch:"Lunch",afternoon:"Afternoon",dinner:"Dinner"};

const minutesToY   = m => (m/60)*HOUR_HEIGHT;
const yToMinutes   = y => Math.round((y/HOUR_HEIGHT)*60/SNAP_MINUTES)*SNAP_MINUTES;
const clamp        = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const toISODate    = d => d.toISOString().split("T")[0];
const isTodayDate  = d => toISODate(d)===toISODate(new Date());
const getCurrentMin= () => { const n=new Date(); return n.getHours()*60+n.getMinutes(); };
const safeNum      = v => { const n=Number(String(v??"").trim()); return Number.isFinite(n)?n:null; };

function formatHour(h){ if(h===0)return"12 AM"; if(h===12)return"12 PM"; return h<12?`${h} AM`:`${h-12} PM`; }
function formatTime(m){ const h=Math.floor(m/60)%24,mn=m%60,ap=h>=12?"PM":"AM",dh=h===0?12:h>12?h-12:h; return `${dh}:${String(mn).padStart(2,"0")} ${ap}`; }
function parseTimeToMinutes(str){
  if(!str)return null;
  const s=String(str).trim(),isPM=/pm/i.test(s);
  const parts=s.replace(/[^0-9:]/g,"").split(":");
  let h=parseInt(parts[0],10);
  const m=parseInt(parts[1]||"0",10);
  if(isNaN(h))return null;
  if(isPM&&h<12)h+=12;
  if(!isPM&&h===12)h=0;
  return h*60+m;
}
function classMatchesDate(cls,dateStr){ const dow=new Date(`${dateStr}T12:00:00`).getDay(); if(!Array.isArray(cls.days)||!cls.days.includes(dow))return false; if(cls.startDate&&dateStr<cls.startDate)return false; if(cls.endDate&&dateStr>cls.endDate)return false; return true; }
function classesToDayEvents(schedules,dateStr){ return(schedules||[]).filter(cls=>classMatchesDate(cls,dateStr)).map(cls=>({id:`cls_${cls.id}_${dateStr}`,scheduleId:cls.id,source:"class_schedule",type:"class",title:cls.title,startMinutes:cls.startMinutes,durationMinutes:cls.durationMinutes,notes:cls.notes||""})); }
function dayPattern(days){ if(!Array.isArray(days)||!days.length)return null; const S={0:"Su",1:"M",2:"T",3:"W",4:"Th",5:"F",6:"Sa"}; return[...days].sort((a,b)=>(a===0?7:a)-(b===0?7:b)).map(d=>S[d]||"?").join("/"); }
function makeEmptyCompletion(){ return{breakfast:{mealDone:false,hydrationDone:false},lunch:{mealDone:false,hydrationDone:false},afternoon:{mealDone:false,hydrationDone:false},dinner:{mealDone:false,hydrationDone:false}}; }
function normalizeCompletion(raw){ const base=makeEmptyCompletion(); if(!raw||typeof raw!=="object"||Array.isArray(raw))return base; const out={...base}; for(const k of Object.keys(base)){const row=(raw[k]&&typeof raw[k]==="object")?raw[k]:{};out[k]={mealDone:Boolean(row.mealDone),hydrationDone:Boolean(row.hydrationDone)};} return out; }
function buildNutritionDefaults(mealBlocks){ return Object.entries(MEAL_DEFAULTS).map(([key,def])=>({id:`nutrition_${key}`,source:"nutrition",mealKey:key,title:mealBlocks?.[key]?.name||MEAL_LABELS[key]||key,type:"meal",...def})); }
const lsKey   =(tok,date)=>`cp_day:${tok}:${date}`;
const lsNutKey=(tok,date)=>`checkpeak:nutritionCompletion:${tok}:${date}`;
function lsGet(k){try{return typeof window!=="undefined"?localStorage.getItem(k):null;}catch{return null;}}
function lsSet(k,v){try{if(typeof window!=="undefined")localStorage.setItem(k,v);}catch{}}

// ─── DRAG HOOK - passive touch, onDragEnd callback ────────────────────────────
function usePointerDrag({gridRef,events,setEvents,onDragEnd}){
  const dragRef=useRef(null), resizeRef=useRef(null);
  const [dragging,setDragging]=useState(null);
  const [resizing,setResizing]=useState(null);

  const getY=useCallback((clientY)=>{
    if(!gridRef.current)return 0;
    const r=gridRef.current.getBoundingClientRect();
    return clientY-r.top+gridRef.current.scrollTop;
  },[gridRef]);

  const startDrag=useCallback((e,id)=>{
    if(e.type==="mousedown")e.preventDefault();
    const ev=events.find(x=>x.id===id); if(!ev)return;
    const y=getY(e.clientY??e.touches?.[0]?.clientY??0);
    dragRef.current={id,offsetMinutes:yToMinutes(y)-ev.startMinutes};
    setDragging(id);
  },[events,getY]);

  const startResize=useCallback((e,id)=>{
    if(e.type==="mousedown")e.preventDefault();
    resizeRef.current={id}; setResizing(id);
  },[]);

  useEffect(()=>{
    const move=(e)=>{
      if(!dragRef.current&&!resizeRef.current)return;
      const clientY=e.clientY??e.touches?.[0]?.clientY??0;
      const y=getY(clientY);
      if(dragRef.current){
        const{id,offsetMinutes}=dragRef.current;
        const ev=events.find(x=>x.id===id); if(!ev)return;
        const newStart=clamp(Math.round((yToMinutes(y)-offsetMinutes)/SNAP_MINUTES)*SNAP_MINUTES,0,24*60-ev.durationMinutes);
        setEvents(prev=>prev.map(x=>x.id===id?{...x,startMinutes:newStart}:x));
      }
      if(resizeRef.current){
        const{id}=resizeRef.current;
        const ev=events.find(x=>x.id===id); if(!ev)return;
        const endMin=clamp(Math.round(yToMinutes(y)/SNAP_MINUTES)*SNAP_MINUTES,ev.startMinutes+MIN_DURATION,24*60);
        setEvents(prev=>prev.map(x=>x.id===id?{...x,durationMinutes:endMin-x.startMinutes}:x));
      }
    };
    const up=()=>{
      if(dragRef.current||resizeRef.current) onDragEnd?.();
      dragRef.current=null; resizeRef.current=null;
      setDragging(null); setResizing(null);
    };
    // passive:true - we never call preventDefault, so native scroll is unaffected
    window.addEventListener("mousemove",move,{passive:true});
    window.addEventListener("touchmove",move,{passive:true});
    window.addEventListener("mouseup",up);
    window.addEventListener("touchend",up);
    return()=>{
      window.removeEventListener("mousemove",move);
      window.removeEventListener("touchmove",move);
      window.removeEventListener("mouseup",up);
      window.removeEventListener("touchend",up);
    };
  },[events,getY,setEvents,onDragEnd]);

  return{dragging,resizing,startDrag,startResize};
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function ResizeHandle({color,onMouseDown,onTouchStart}){
  return(
    <div data-resize="true" onMouseDown={onMouseDown} onTouchStart={onTouchStart}
      style={{position:"absolute",bottom:0,left:0,right:0,height:16,cursor:"s-resize",background:"linear-gradient(to top,rgba(0,0,0,0.4),transparent)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:24,height:2,background:color,opacity:0.5,borderRadius:1}}/>
    </div>
  );
}
function SaveDot({status}){
  if(!status)return null;
  const color={saving:T.textFaint,saved:T.greenText,error:T.red}[status]||T.textFaint;
  return<div style={{width:6,height:6,borderRadius:"50%",background:color,transition:"background 0.3s",flexShrink:0}}/>;
}
function ProgressRing({done,total,size=34,stroke=3}){
  const r=(size-stroke)/2,circ=2*Math.PI*r,pct=total>0?Math.min(done/total,1):0,allDone=total>0&&done>=total;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={allDone?T.green:T.greenText} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.5s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {allDone?<span style={{fontSize:10,color:T.greenText,fontWeight:700}}>✓</span>:<span style={{fontSize:9,fontWeight:700,color:T.textPrimary}}>{done}</span>}
      </div>
    </div>
  );
}

// ─── BLOCKS ───────────────────────────────────────────────────────────────────
function NutritionBlock({event,mealData,nutritionCompletion,onDragStart,onResizeStart,onClick,isDragging,isResizing}){
  const comp=nutritionCompletion?.[event.mealKey]||{};
  const bothDone=comp.mealDone&&comp.hydrationDone;
  const active=isDragging||isResizing;
  const height=Math.max(minutesToY(event.durationMinutes),MIN_BLOCK_PX);
  const tall=height>=88;
  const targets=mealData?.targets||{};
  const cal=safeNum(targets.calories),prot=safeNum(targets.protein);
  const pd=(e)=>{if(e.target.dataset.resize)return;e.stopPropagation();onDragStart(e,event.id);};
  return(
    <div onMouseDown={pd} onTouchStart={pd} onClick={(e)=>{e.stopPropagation();if(!active)onClick(event);}}
      style={{position:"absolute",left:4,right:4,top:minutesToY(event.startMinutes),height,background:bothDone?"rgba(35,134,54,0.12)":T.blueBg,borderLeft:`3px solid ${bothDone?T.green:T.blue}`,padding:"9px 10px 18px",cursor:active?"grabbing":"grab",userSelect:"none",touchAction:"none",boxShadow:active?"0 12px 32px rgba(0,0,0,0.5)":"none",transform:active?"scale(1.015) translateZ(0)":"translateZ(0)",transition:active?"none":"transform 0.15s, border-color 0.2s, background 0.2s",zIndex:active?10:2,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"space-between"}}>
        <p style={{fontSize:13,fontWeight:600,color:bothDone?T.greenText:T.blueText,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{MEAL_LABELS[event.mealKey]||event.title}</p>
        <div style={{display:"flex",gap:4,flexShrink:0}}>
          <div style={{width:6,height:6,background:comp.mealDone?T.green:T.border,transition:"background 0.2s"}}/>
          <div style={{width:6,height:6,background:comp.hydrationDone?T.blue:T.border,transition:"background 0.2s"}}/>
        </div>
      </div>
      {tall&&cal!=null&&<p style={{fontSize:11,color:T.textFaint,margin:"3px 0 0"}}>{cal} kcal{prot!=null?` · ${prot}g protein`:""}</p>}
      <ResizeHandle color={bothDone?T.green:T.blue} onMouseDown={(e)=>{e.stopPropagation();onResizeStart(e,event.id);}} onTouchStart={(e)=>{e.stopPropagation();onResizeStart(e,event.id);}}/>
    </div>
  );
}

function EventBlock({event,onDragStart,onResizeStart,onClick,isDragging,isResizing}){
  const cfg=BLOCK_TYPES[event.type]||BLOCK_TYPES.workout;
  const height=Math.max(minutesToY(event.durationMinutes),MIN_BLOCK_PX);
  const tall=height>=88,active=isDragging||isResizing;
  const pd=(e)=>{if(e.target.dataset.resize)return;e.stopPropagation();onDragStart(e,event.id);};
  return(
    <div onMouseDown={pd} onTouchStart={pd} onClick={(e)=>{e.stopPropagation();if(!active)onClick(event);}}
      style={{position:"absolute",left:4,right:4,top:minutesToY(event.startMinutes),height,background:cfg.bg,borderLeft:`3px solid ${cfg.border}`,padding:"9px 10px 18px",cursor:active?"grabbing":"grab",userSelect:"none",touchAction:"none",boxShadow:active?"0 12px 32px rgba(0,0,0,0.5)":"none",transform:active?"scale(1.015) translateZ(0)":"translateZ(0)",transition:active?"none":"transform 0.15s",zIndex:active?10:2,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8,justifyContent:"space-between"}}>
        <p style={{fontSize:13,fontWeight:600,color:cfg.title,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{event.title}</p>
        {tall&&<span style={{fontSize:10,color:T.textFaint,flexShrink:0,marginTop:1}}>{formatTime(event.startMinutes)}</span>}
      </div>
      {tall&&<p style={{fontSize:11,color:cfg.meta,margin:"3px 0 0"}}>{formatTime(event.startMinutes)} - {formatTime(event.startMinutes+event.durationMinutes)}{event.notes?<span style={{color:T.textFaint}}> · {event.notes}</span>:null}</p>}
      <ResizeHandle color={cfg.border} onMouseDown={(e)=>{e.stopPropagation();onResizeStart(e,event.id);}} onTouchStart={(e)=>{e.stopPropagation();onResizeStart(e,event.id);}}/>
    </div>
  );
}

function ClassBlock({event,schedule,onClick}){
  const cfg=BLOCK_TYPES.class;
  const height=Math.max(minutesToY(event.durationMinutes),MIN_BLOCK_PX);
  const tall=height>=88;
  const pat=useMemo(()=>dayPattern(schedule?.days),[schedule?.days]);
  return(
    <div onClick={(e)=>{e.stopPropagation();onClick(event);}}
      style={{position:"absolute",left:4,right:4,top:minutesToY(event.startMinutes),height,background:cfg.bg,borderLeft:`3px solid ${cfg.border}`,padding:"9px 10px",cursor:"pointer",userSelect:"none",zIndex:2,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-between",transition:"opacity 0.15s"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8,justifyContent:"space-between"}}>
        <p style={{fontSize:13,fontWeight:600,color:cfg.title,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{event.title}</p>
        {pat&&<span style={{fontSize:9,fontWeight:700,color:cfg.border,background:"rgba(227,179,65,0.12)",padding:"2px 6px",flexShrink:0,letterSpacing:"0.05em",border:`0.5px solid rgba(227,179,65,0.3)`}}>{pat}</span>}
      </div>
      {tall&&<p style={{fontSize:11,color:cfg.meta,margin:0}}>{formatTime(event.startMinutes)} - {formatTime(event.startMinutes+event.durationMinutes)}{event.notes?<span style={{color:T.textFaint}}> · {event.notes}</span>:null}</p>}
    </div>
  );
}

function CoachWorkoutBlock({dailyWorkout,items,optimisticStatusById,onClick,scheduledTime}){
  const doneCount=items?.filter(i=>(optimisticStatusById?.[i.id]||i.Status)==="Completed").length||0;
  const totalCount=items?.length||0,allDone=totalCount>0&&doneCount>=totalCount;
  const height=Math.max(minutesToY(Math.min(Math.max(60,(items?.length||1)*20),120)),MIN_BLOCK_PX);
  const startMin = (scheduledTime ? parseTimeToMinutes(scheduledTime) : null) ?? 9*60;
  return(
    <div onClick={(e)=>{e.stopPropagation();onClick();}}
      style={{position:"absolute",left:4,right:4,top:minutesToY(startMin),height,background:allDone?"rgba(35,134,54,0.12)":T.redBg,borderLeft:`3px solid ${allDone?T.green:T.red}`,padding:"9px 10px",cursor:"pointer",userSelect:"none",zIndex:3,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-between",transition:"background 0.2s, border-color 0.2s"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8,justifyContent:"space-between"}}>
        <p style={{fontSize:13,fontWeight:600,color:allDone?T.greenText:T.textPrimary,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{dailyWorkout?.Title||"Coach Workout"}</p>
        <span style={{fontSize:11,fontWeight:700,color:allDone?T.greenText:T.redText,background:allDone?"rgba(35,134,54,0.2)":"rgba(218,54,51,0.15)",padding:"2px 8px",flexShrink:0}}>{totalCount>0?`${doneCount}/${totalCount}`:"Tap to log"}</span>
      </div>
      <p style={{fontSize:11,color:T.textFaint,margin:0}}>{formatTime(startMin)} - Tap to log exercises</p>
    </div>
  );
}

// ─── MACRO MODAL ─────────────────────────────────────────────────────────────
function MacroModal({mealKey,mealData,event,nutritionCompletion,onToggle,onClose}){
  const targets=mealData?.targets||{};
  const macros=[
    {k:"Cals",   v:safeNum(targets.calories),unit:"kcal"},
    {k:"Protein",v:safeNum(targets.protein), unit:"g"},
    {k:"Carbs",  v:safeNum(targets.carbs),   unit:"g"},
    {k:"Fat",    v:safeNum(targets.fat),     unit:"g"},
  ].filter(m=>m.v!=null);
  const hyd=safeNum(targets.hydrationOz);
  const comp=nutritionCompletion?.[mealKey]||{};
  useEffect(()=>{const fn=(e)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);},[onClose]);
  return(
    <div onClick={(e)=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.bgElevated,width:"100%",maxWidth:480,borderTop:`0.5px solid ${T.borderMid}`}}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0"}}><div style={{width:28,height:3,background:T.borderMid,borderRadius:1.5}}/></div>
        <div style={{padding:"14px 18px 12px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:T.blueText,letterSpacing:"0.14em",textTransform:"uppercase",margin:"0 0 3px"}}>Nutrition target</p>
            <p style={{fontSize:20,fontWeight:600,color:T.textPrimary,margin:0,letterSpacing:"-0.02em"}}>{mealData?.name||MEAL_LABELS[mealKey]||mealKey}</p>
            {event&&<p style={{fontSize:11,color:T.textFaint,margin:"2px 0 0"}}>{formatTime(event.startMinutes)} - {formatTime(event.startMinutes+event.durationMinutes)}</p>}
          </div>
          <button onClick={onClose} style={{background:T.bgBlock,border:`0.5px solid ${T.border}`,color:T.textMuted,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={13}/></button>
        </div>
        {macros.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:`repeat(${macros.length},1fr)`,borderBottom:`0.5px solid ${T.border}`}}>
            {macros.map(({k,v,unit},i)=>(
              <div key={k} style={{padding:"16px 0 14px",textAlign:"center",borderRight:i<macros.length-1?`0.5px solid ${T.border}`:"none"}}>
                <p style={{fontSize:9,fontWeight:700,color:T.textFaint,letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 6px"}}>{k}</p>
                <p style={{fontSize:22,fontWeight:700,color:T.textPrimary,margin:0,lineHeight:1,letterSpacing:"-0.02em"}}>{v}</p>
                <p style={{fontSize:9,color:T.textFaint,margin:"3px 0 0"}}>{unit}</p>
              </div>
            ))}
          </div>
        )}
        <div style={{padding:"14px 16px"}}>
          <p style={{fontSize:9,fontWeight:700,color:T.textFaint,letterSpacing:"0.14em",textTransform:"uppercase",margin:"0 0 10px"}}>Log completion</p>
          <div style={{display:"flex",gap:8}}>
            {[{field:"mealDone",label:"Meal done"},...(hyd!=null?[{field:"hydrationDone",label:`Water - ${hyd} oz`}]:[{field:"hydrationDone",label:"Hydration"}])].map(({field,label})=>{
              const done=comp[field];
              return(
                <button key={field} onClick={()=>onToggle(mealKey,field)} style={{flex:1,padding:"12px 10px",border:`0.5px solid ${done?T.green:T.border}`,background:done?"rgba(35,134,54,0.12)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{width:14,height:14,border:`1.5px solid ${done?T.greenText:T.textMuted}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done&&<Check size={9} color={T.greenText} strokeWidth={3}/>}</div>
                  <span style={{fontSize:12,fontWeight:600,color:done?T.greenText:T.textMuted}}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{height:"max(env(safe-area-inset-bottom),20px)"}}/>
      </div>
    </div>
  );
}

// ─── WORKOUT DETAIL MODAL ────────────────────────────────────────────────────
function WorkoutDetailModal({dailyWorkout,items,optimisticStatusById,onClose,onOpenItem}){
  const sorted=useMemo(()=>[...(items||[])].sort((a,b)=>(Number(a.Order)||0)-(Number(b.Order)||0)),[items]);
  useEffect(()=>{const fn=(e)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);},[onClose]);
  return(
    <div onClick={(e)=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.bgElevated,width:"100%",maxWidth:480,maxHeight:"88vh",borderTop:`0.5px solid ${T.borderMid}`,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0",flexShrink:0}}><div style={{width:28,height:3,background:T.borderMid,borderRadius:1.5}}/></div>
        <div style={{padding:"14px 18px 12px",borderBottom:`0.5px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:T.redText,letterSpacing:"0.14em",textTransform:"uppercase",margin:"0 0 3px"}}>Coach assigned</p>
            <p style={{fontSize:20,fontWeight:600,color:T.textPrimary,margin:0,letterSpacing:"-0.02em"}}>{dailyWorkout?.Title||"Today's Workout"}</p>
            <p style={{fontSize:11,color:T.textFaint,margin:"2px 0 0"}}>{sorted.length} exercise{sorted.length!==1?"s":""} - tap to log</p>
          </div>
          <button onClick={onClose} style={{background:T.bgBlock,border:`0.5px solid ${T.border}`,color:T.textMuted,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={13}/></button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {sorted.map((item,idx)=>{
            const done=(optimisticStatusById?.[item.id]||item.Status)==="Completed";
            return(
              <div key={item.id||idx} onClick={()=>onOpenItem?.(item)} style={{padding:"14px 18px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}>
                <div style={{width:18,height:18,border:`1.5px solid ${done?T.greenText:T.borderMid}`,background:done?"rgba(63,185,80,0.15)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done&&<Check size={10} color={T.greenText} strokeWidth={3}/>}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:14,fontWeight:600,color:done?T.textMuted:T.textPrimary,margin:"0 0 5px",letterSpacing:"-0.01em",textDecoration:done?"line-through":"none"}}>{item.ExerciseName||"Exercise"}</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px"}}>
                    {[item.Sets&&`${item.Sets} sets`,item.Reps&&`${item.Reps} reps`,item.Weight&&item.Weight,item.Rest&&`${item.Rest} rest`].filter(Boolean).map((s,i)=>(<span key={i} style={{fontSize:11,color:T.textFaint}}>{s}</span>))}
                  </div>
                  {item.Instructions&&<p style={{fontSize:11,color:T.textFaint,margin:"4px 0 0",lineHeight:1.5}}>{item.Instructions}</p>}
                </div>
                <ChevronRight size={14} color={T.textFaint} style={{flexShrink:0}}/>
              </div>
            );
          })}
          <div style={{height:"max(env(safe-area-inset-bottom),20px)"}}/>
        </div>
      </div>
    </div>
  );
}

// ─── EVENT MODAL ─────────────────────────────────────────────────────────────
function EventModal({event,defaultStartMinutes,onSave,onDelete,onClose,onOpenClassSchedule}){
  const [title,setTitle]=useState(event?.title||"");
  const [type,setType]=useState(event?.type||"workout");
  const [notes,setNotes]=useState(event?.notes||"");
  const inputRef=useRef(null);
  useEffect(()=>{const fn=(e)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);},[onClose]);
  useEffect(()=>{const isTouch=window.matchMedia("(hover:none) and (pointer:coarse)").matches;if(!isTouch&&inputRef.current&&type!=="class"){const t=setTimeout(()=>inputRef.current?.focus(),120);return()=>clearTimeout(t);}},[type]);
  const save=()=>{if(type==="class"){onClose();onOpenClassSchedule({startMinutes:defaultStartMinutes});return;}if(title.trim())onSave({title:title.trim(),type,notes});};
  const si={width:"100%",padding:"11px 12px",border:`0.5px solid ${T.border}`,background:T.bgBlock,fontSize:14,color:T.textPrimary,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
  return(
    <div onClick={(e)=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.bgElevated,width:"100%",maxWidth:480,borderTop:`0.5px solid ${T.borderMid}`}}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0"}}><div style={{width:28,height:3,background:T.borderMid,borderRadius:1.5}}/></div>
        <div style={{padding:"14px 18px 12px",borderBottom:`0.5px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <p style={{fontSize:20,fontWeight:600,color:T.textPrimary,margin:0,letterSpacing:"-0.02em"}}>{event?.id?"Edit block":"New block"}</p>
          <button onClick={onClose} style={{background:T.bgBlock,border:`0.5px solid ${T.border}`,color:T.textMuted,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13}/></button>
        </div>
        <div style={{padding:"16px 18px 0",display:"flex",flexDirection:"column",gap:16}}>
          {type!=="class"&&<div><label style={{fontSize:10,fontWeight:700,color:T.textFaint,letterSpacing:"0.12em",textTransform:"uppercase",display:"block",marginBottom:7}}>Title</label><input ref={inputRef} value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")save();}} placeholder="Morning lift, film room, recovery..." style={si}/></div>}
          <div>
            <label style={{fontSize:10,fontWeight:700,color:T.textFaint,letterSpacing:"0.12em",textTransform:"uppercase",display:"block",marginBottom:8}}>Type</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {Object.entries(BLOCK_TYPES).map(([key,cfg])=>(<button key={key} onClick={()=>setType(key)} style={{padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",border:`0.5px solid ${type===key?cfg.border:T.border}`,background:type===key?cfg.bg:"transparent",color:type===key?cfg.title:T.textMuted,transition:"all 0.1s"}}>{cfg.label}</button>))}
            </div>
          </div>
          {type==="class"&&(
            <div style={{background:T.bgBlock,border:`0.5px solid ${BLOCK_TYPES.class.border}`,padding:"16px"}}>
              <p style={{fontSize:13,fontWeight:600,color:T.textPrimary,margin:"0 0 6px",letterSpacing:"-0.01em"}}>Classes repeat weekly</p>
              <p style={{fontSize:12,color:T.textMuted,margin:"0 0 14px",lineHeight:1.6}}>Pick the days, time, and duration - it shows up automatically every week.</p>
              <button onClick={()=>{onClose();onOpenClassSchedule({startMinutes:defaultStartMinutes});}} style={{width:"100%",padding:"13px",border:"none",background:BLOCK_TYPES.class.border,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Set up class schedule →</button>
            </div>
          )}
          {type!=="class"&&(
            <>
              <div><label style={{fontSize:10,fontWeight:700,color:T.textFaint,letterSpacing:"0.12em",textTransform:"uppercase",display:"block",marginBottom:7}}>Notes</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any details..." rows={2} style={{...si,resize:"none",lineHeight:1.6}}/></div>
              <div style={{display:"flex",borderTop:`0.5px solid ${T.border}`,margin:"0 -18px"}}>
                {event?.id&&<button onClick={onDelete} style={{padding:"15px 18px",border:"none",borderRight:`0.5px solid ${T.border}`,background:"transparent",color:T.red,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Delete</button>}
                <button onClick={save} disabled={!title.trim()} style={{flex:1,padding:"15px",border:"none",background:title.trim()?T.red:T.bgBlock,color:title.trim()?"#fff":T.textFaint,fontSize:13,fontWeight:600,cursor:title.trim()?"pointer":"not-allowed",fontFamily:"inherit",transition:"background 0.12s"}}>{event?.id?"Save changes":"Add block"}</button>
              </div>
            </>
          )}
        </div>
        <div style={{height:"max(env(safe-area-inset-bottom),16px)"}}/>
      </div>
    </div>
  );
}

// ─── MAIN SHEET ───────────────────────────────────────────────────────────────
export default function DayPlannerSheet({
  isOpen, onClose,
  classSchedules, onUpsertClass, onRemoveClass,
  authReady, user, isAthlete, athleteToken, firstName,
  onNutritionTimesChange, // fires with { mealKey: startMinutes } after drag ends
}){
  const [currentDate,setCurrentDate]=useState(()=>new Date());
  const dateStr=toISODate(currentDate);
  const todayFlag=isTodayDate(currentDate);

  const gridRef=useRef(null);
  useEffect(()=>{
    if(isOpen&&gridRef.current&&todayFlag){
      const now=getCurrentMin();
      setTimeout(()=>{ gridRef.current?.scrollTo({top:Math.max(0,minutesToY(now)-window.innerHeight/3),behavior:"smooth"}); },350);
    }
  },[isOpen,todayFlag]);

  useEffect(()=>{ if(isOpen){document.body.style.overflow="hidden";}else{document.body.style.overflow="";} return()=>{document.body.style.overflow="";}; },[isOpen]);

  const goToDate=useCallback((offset)=>{ setCurrentDate(d=>{const n=new Date(d);n.setDate(n.getDate()+offset);return n;}); },[]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const workout=useAthleteToday({authReady,user,isAthlete});
  useEffect(()=>{ if(workout.setSelectedDate&&isOpen)workout.setSelectedDate(dateStr); },[dateStr,isOpen]); // eslint-disable-line
  const{dailyWorkout,dailyWorkouts,items:workoutItems,loading:workoutLoading,setErr}=workout;
  const{modalOpen,activeItem,selectedFile,coachNote,submittingId,optimisticStatusById,openModal,closeModal,setSelectedFile,setCoachNote,submitCompletion}=useWorkoutCompletion({selectedDate:dateStr,reload:workout.reload,setErr});
  const nutrition=useAthleteNutritionToday({authReady,user,isAthlete,selectedDate:dateStr});
  const{mealBlocks,loading:nutritionLoading}=nutrition;

  const nutKeyStr=useMemo(()=>{ const who=athleteToken||String(user?.Email||user?.email||"").trim().toLowerCase(); return who?lsNutKey(who,dateStr):""; },[athleteToken,user,dateStr]);
  const[nutritionCompletion,setNutritionCompletion]=useState(makeEmptyCompletion);
  const nutHydRef=useRef(false),nutSaveTimer=useRef(null);

  useEffect(()=>{
    if(!authReady||!user||!isAthlete||!dateStr||!isOpen)return;
    nutHydRef.current=true;
    if(nutKeyStr){const c=lsGet(nutKeyStr);setNutritionCompletion(c?normalizeCompletion(JSON.parse(c)):makeEmptyCompletion());}
    fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(dateStr)}`,{method:"GET",credentials:"include"})
      .then(r=>r.ok?r.json():null).then(data=>{if(!data?.ok||!data.hasRecord)return;const n=normalizeCompletion(data.completion);setNutritionCompletion(n);if(nutKeyStr)lsSet(nutKeyStr,JSON.stringify(n));}).catch(()=>{})
      .finally(()=>{setTimeout(()=>{nutHydRef.current=false;},0);});
  },[authReady,user,isAthlete,dateStr,isOpen]); // eslint-disable-line

  useEffect(()=>{
    if(!authReady||!user||!isAthlete||!nutKeyStr||nutHydRef.current)return;
    lsSet(nutKeyStr,JSON.stringify(nutritionCompletion));
    clearTimeout(nutSaveTimer.current);
    nutSaveTimer.current=setTimeout(()=>{ fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(dateStr)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({completion:nutritionCompletion})}).catch(()=>{}); },1000);
  },[nutritionCompletion]); // eslint-disable-line

  const handleNutritionToggle=useCallback((mealKey,field)=>{ setNutritionCompletion(prev=>({...prev,[mealKey]:{...prev[mealKey],[field]:!prev[mealKey][field]}})); },[]);

  // ── Planner events ────────────────────────────────────────────────────────
  const[events,setEvents]=useState([]);
  const[loadingEvents,setLoadingEvents]=useState(false);
  const[saveStatus,setSaveStatus]=useState(null);
  const hydratingRef=useRef(false),saveTimer=useRef(null);

  useEffect(()=>{
    if(!authReady||!user||!isAthlete||!athleteToken||!isOpen)return;
    hydratingRef.current=true; setLoadingEvents(true);
    const cached=lsGet(lsKey(athleteToken,dateStr));
    if(cached){try{setEvents(JSON.parse(cached));}catch{setEvents([]);}}else{setEvents([]);}
    fetch(`/api/athlete/day-planner/upsert?date=${encodeURIComponent(dateStr)}`,{method:"GET",credentials:"include"})
      .then(r=>r.ok?r.json():null).then(data=>{if(!data?.ok||!data.hasRecord)return;const n=Array.isArray(data.events)?data.events:[];setEvents(n);lsSet(lsKey(athleteToken,dateStr),JSON.stringify(n));}).catch(()=>{})
      .finally(()=>{hydratingRef.current=false;setLoadingEvents(false);});
  },[authReady,user,isAthlete,athleteToken,dateStr,isOpen]); // eslint-disable-line

  useEffect(()=>{ if(loadingEvents||nutritionLoading||!mealBlocks)return; setEvents(prev=>{if(prev.some(e=>e.source==="nutrition"))return prev;return[...prev,...buildNutritionDefaults(mealBlocks)];}); },[loadingEvents,nutritionLoading,mealBlocks]);

  useEffect(()=>{
  if(!isOpen || workoutLoading || loadingEvents)return;
  const list = Array.isArray(dailyWorkouts) && dailyWorkouts.length
    ? dailyWorkouts
    : (dailyWorkout ? [{ dailyWorkout, items: workoutItems }] : []);
  if(!list.length)return;
  setEvents(prev=>{
    const withoutOld = prev.filter(e=>e.source!=="coach_workout");
    const workoutBlocks = list.map(({ dailyWorkout: dw })=>{
      const scheduledMin = dw.ScheduledTime
        ? parseTimeToMinutes(dw.ScheduledTime)
        : null;
      return {
        id: `coach_workout_${dw.id}`,
        source: "coach_workout",
        dwId: dw.id,
        type: "workout",
        title: dw.Title || "Team Workout",
        startMinutes: scheduledMin ?? 5 * 60,
        durationMinutes: 90,
        selfSchedule: scheduledMin === null,
      };
    });
    return [...withoutOld, ...workoutBlocks];
  });
},[isOpen, workoutLoading, loadingEvents, dailyWorkout, dailyWorkouts, workoutItems]);

  const saveToAirtable=useCallback((evts)=>{
    if(!athleteToken||!dateStr)return;
    setSaveStatus("saving");
    fetch(`/api/athlete/day-planner/upsert?date=${encodeURIComponent(dateStr)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({events:evts})})
      .then(r=>r.ok?r.json():Promise.reject()).then(data=>{if(data?.ok){setSaveStatus("saved");lsSet(lsKey(athleteToken,dateStr),JSON.stringify(evts));setTimeout(()=>setSaveStatus(null),2500);}else setSaveStatus("error");}).catch(()=>setSaveStatus("error"));
  },[athleteToken,dateStr]);

  useEffect(()=>{
    if(hydratingRef.current||!authReady||!isAthlete||!athleteToken||!isOpen)return;
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>saveToAirtable(events),800);
    return()=>clearTimeout(saveTimer.current);
  },[events]); // eslint-disable-line

  // ── Drag end → propagate nutrition times to RouteList ─────────────────────
  const handleDragEnd=useCallback(()=>{
  // Propagate nutrition times
  if(onNutritionTimesChange){
    const times={};
    events.forEach(ev=>{if(ev.source==="nutrition"&&ev.mealKey)times[ev.mealKey]=ev.startMinutes;});
    if(Object.keys(times).length>0) onNutritionTimesChange(times);
  }
  // Save new scheduled time for dragged coach workouts
  events.forEach(ev=>{
    if(ev.source!=="coach_workout"||!ev.dwId)return;
    const h=Math.floor(ev.startMinutes/60), m=ev.startMinutes%60;
    const timeStr=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
    fetch("/api/org/workouts/update-full",{
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ id: ev.dwId, scheduledTime: timeStr }),
    }).catch(()=>{});
  });
},[events,onNutritionTimesChange]);

  // ── Now line ──────────────────────────────────────────────────────────────
  const[nowMinutes,setNowMinutes]=useState(null);
  useEffect(()=>{ setNowMinutes(getCurrentMin()); const t=setInterval(()=>setNowMinutes(getCurrentMin()),60000); return()=>clearInterval(t); },[]);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const{dragging,resizing,startDrag,startResize}=usePointerDrag({gridRef,events,setEvents,onDragEnd:handleDragEnd});

  // ── Modals ────────────────────────────────────────────────────────────────
  const[modal,setModal]=useState(null);
  const[macroModal,setMacroModal]=useState(null);
  const[workoutModal,setWorkoutModal]=useState(false);
  const[classModal,setClassModal]=useState(null);
  const[ghostMinutes,setGhostMinutes]=useState(null);
  const anySubModal=Boolean(modal||macroModal||workoutModal||modalOpen||classModal);

  const handleGridClick=useCallback((e)=>{
    if(dragging||resizing)return;
    const r=gridRef.current.getBoundingClientRect();
    const startMinutes=clamp(Math.round(yToMinutes(e.clientY-r.top+gridRef.current.scrollTop)/SNAP_MINUTES)*SNAP_MINUTES,0,24*60-60);
    setModal({event:{type:"workout",startMinutes,durationMinutes:60},mode:"create",defaultStartMinutes:startMinutes});
  },[dragging,resizing]);

  const handleModalSave=useCallback((data)=>{ if(modal.mode==="create")setEvents(prev=>[...prev,{id:`ev_${Date.now()}`,...modal.event,...data}]);else setEvents(prev=>prev.map(ev=>ev.id===modal.event.id?{...ev,...data}:ev)); setModal(null); },[modal]);
  const handleModalDelete=useCallback(()=>{ setEvents(prev=>prev.filter(ev=>ev.id!==modal.event.id)); setModal(null); },[modal]);

  const handleClassSave=useCallback((data)=>{
    const existingId=classModal?.schedule?.id||null;
    onUpsertClass(data,existingId); setClassModal(null);
    const currentDow=currentDate.getDay();
    if(Array.isArray(data.days)&&!data.days.includes(currentDow)){
      let offset=1;
      while(offset<=7){const c=new Date(currentDate);c.setDate(c.getDate()+offset);if(data.days.includes(c.getDay())){setCurrentDate(c);break;}offset++;}
    }
  },[classModal,onUpsertClass,currentDate]);

  const handleClassDelete=useCallback(()=>{ if(!classModal?.schedule?.id)return; onRemoveClass(classModal.schedule.id); setClassModal(null); },[classModal,onRemoveClass]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const workoutDone=useMemo(()=>workoutItems?.filter(i=>(optimisticStatusById?.[i.id]||i.Status)==="Completed").length||0,[workoutItems,optimisticStatusById]);
  const workoutTotal=workoutItems?.length||0;
  const nutritionDone=useMemo(()=>Object.values(nutritionCompletion).reduce((acc,m)=>acc+(m.mealDone?1:0)+(m.hydrationDone?1:0),0),[nutritionCompletion]);
  const nutritionTotal=8,totalDone=workoutDone+nutritionDone,totalItems=workoutTotal+nutritionTotal;
  const isLoading=workoutLoading||nutritionLoading||loadingEvents;

  const classEvents=useMemo(()=>classesToDayEvents(classSchedules,dateStr),[classSchedules,dateStr]);
  const nutritionEvents=events.filter(e=>e.source==="nutrition");
  const athleteEvents=events.filter(e=>e.source!=="nutrition");

  const canonicalItem=workoutItems?.find(i=>String(i?.id||"")===String(activeItem?.id||""));
  const evRaw=String(canonicalItem?.EvidenceRequired??activeItem?.EvidenceRequired??"").toLowerCase();
  const evidenceRequired=evRaw!==""&&evRaw!=="none"&&evRaw!=="false"&&evRaw!=="voluntary_activity_vara";

  // ── Swipe nav - horizontal only ───────────────────────────────────────────
  const swipeRef=useRef({x:null,y:null});
  const handleTouchStart=useCallback((e)=>{ swipeRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; },[]);
  const handleTouchEnd=useCallback((e)=>{
    if(swipeRef.current.x===null||dragging||resizing)return;
    const dx=e.changedTouches[0].clientX-swipeRef.current.x;
    const dy=Math.abs(e.changedTouches[0].clientY-swipeRef.current.y);
    if(Math.abs(dx)>60&&dy<50) goToDate(dx<0?1:-1); // only horizontal gestures change day
    swipeRef.current={x:null,y:null};
  },[dragging,resizing,goToDate]);

  // ── Render ────────────────────────────────────────────────────────────────
  return(
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:9990,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(2px)",pointerEvents:isOpen?"auto":"none",opacity:isOpen?1:0,transition:"opacity 0.3s ease"}}/>

      {/* Sheet - height:100dvh ensures flex overflow works correctly on iOS */}
      <div style={{
        position:"fixed",inset:0,zIndex:9991,
        background:T.bg,
        fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif",
        display:"flex",flexDirection:"column",
        height:"100dvh", // explicit height so flex children can compute overflow
        transform:isOpen?"translateY(0)":"translateY(100%)",
        transition:"transform 0.35s cubic-bezier(0.16,1,0.3,1)",
        willChange:"transform",
      }}>

        {/* ── Header ── */}
        <div style={{background:T.bg,borderBottom:`0.5px solid ${T.border}`,flexShrink:0,paddingTop:"max(env(safe-area-inset-top,0px), 60px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px 0"}}>
            <button onClick={onClose} style={{background:"none",border:`0.5px solid ${T.border}`,color:T.textMuted,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={13}/></button>
            <button onClick={()=>goToDate(-1)} style={{background:"none",border:`0.5px solid ${T.border}`,color:T.textMuted,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><ChevronLeft size={14}/></button>
            <div style={{flex:1,minWidth:0,textAlign:"center"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18,fontWeight:700,color:T.textPrimary,letterSpacing:"-0.02em",whiteSpace:"nowrap"}}>{todayFlag?"Today":currentDate.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
                {todayFlag&&<span style={{fontSize:9,fontWeight:800,background:T.red,color:"#fff",padding:"2px 6px",letterSpacing:"0.1em",textTransform:"uppercase"}}>LIVE</span>}
              </div>
              {todayFlag&&<div style={{fontSize:12,color:T.textFaint,marginTop:1}}>{firstName}</div>}
            </div>
            <button onClick={()=>goToDate(1)} style={{background:"none",border:`0.5px solid ${T.border}`,color:T.textMuted,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><ChevronRight size={14}/></button>
            {totalItems>0&&<ProgressRing done={totalDone} total={totalItems} size={36} stroke={3}/>}
            {isLoading?<RefreshCw size={13} color={T.textFaint} style={{animation:"spin 1s linear infinite",flexShrink:0}}/>:<SaveDot status={saveStatus}/>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px 10px"}}>
            {!todayFlag&&<button onClick={()=>setCurrentDate(new Date())} style={{fontSize:11,fontWeight:600,color:T.textFaint,background:T.bgElevated,border:`0.5px solid ${T.border}`,padding:"5px 12px",cursor:"pointer"}}>Jump to today</button>}
            <div style={{flex:1}}/>
            {workoutTotal>0&&<><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:6,height:6,background:T.red,flexShrink:0}}/><span style={{fontSize:13,fontWeight:700,color:workoutDone>=workoutTotal?T.greenText:T.textSecond}}>{workoutDone}/{workoutTotal}</span><span style={{fontSize:12,color:T.textFaint}}>workout</span></div><div style={{width:"0.5px",height:14,background:T.border}}/></>}
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:6,height:6,background:T.green,flexShrink:0}}/><span style={{fontSize:13,fontWeight:700,color:nutritionDone>=nutritionTotal?T.greenText:T.textSecond}}>{nutritionDone}/{nutritionTotal}</span><span style={{fontSize:12,color:T.textFaint}}>nutrition</span></div>
          </div>
        </div>

        {/* ── Scrollable timeline grid ── */}
        <div
          ref={gridRef}
          style={{
            flex:1,
            overflowY: anySubModal ? "hidden" : "auto",
            overflowX:"hidden",
            WebkitOverflowScrolling:"touch",
            position:"relative",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            style={{display:"flex",minHeight:TOTAL_HEIGHT,position:"relative"}}
            onClick={handleGridClick}
            onMouseMove={(e)=>{
              if(dragging||resizing||!gridRef.current)return;
              const r=gridRef.current.getBoundingClientRect();
              setGhostMinutes(Math.round(yToMinutes(e.clientY-r.top+gridRef.current.scrollTop)/SNAP_MINUTES)*SNAP_MINUTES);
            }}
            onMouseLeave={()=>setGhostMinutes(null)}
          >
            {/* Hour labels */}
            <div style={{width:44,flexShrink:0,position:"relative"}}>
              {HOURS.map(h=>h%2===0&&h>0?(
                <div key={h} style={{position:"absolute",top:minutesToY(h*60)-8,left:0,right:0,display:"flex",justifyContent:"flex-end",paddingRight:7}}>
                  <span style={{fontSize:10,fontWeight:500,letterSpacing:"-0.02em",color:todayFlag&&h===Math.floor((nowMinutes??0)/60)?T.red:T.textTiny}}>{formatHour(h)}</span>
                </div>
              ):null)}
            </div>

            {/* Events area */}
            <div style={{flex:1,position:"relative",marginRight:6}}>
              {HOURS.map(h=>(<div key={h} style={{position:"absolute",left:0,right:0,top:minutesToY(h*60),height:"0.5px",background:h===0?"transparent":h%2===0?"#1A2030":"#131820"}}/>))}
              {HOURS.map(h=>(<div key={`h${h}`} style={{position:"absolute",left:0,right:0,top:minutesToY(h*60+30),height:"0.5px",background:"#0F1318"}}/>))}

              {/* Ghost cursor */}
              {ghostMinutes!==null&&!dragging&&!resizing&&(
                <div style={{position:"absolute",left:0,right:0,top:minutesToY(ghostMinutes),pointerEvents:"none",zIndex:1,display:"flex",alignItems:"center"}}>
                  <div style={{flex:1,height:"0.5px",background:T.red,opacity:0.3}}/>
                  <span style={{fontSize:10,color:T.redText,background:T.redBg,padding:"2px 6px",marginLeft:6,border:`0.5px solid rgba(218,54,51,0.3)`}}>{formatTime(ghostMinutes)}</span>
                </div>
              )}

              {/* Now line */}
              {todayFlag&&nowMinutes!==null&&(
                <div style={{position:"absolute",left:-4,right:0,top:minutesToY(nowMinutes),pointerEvents:"none",zIndex:5,display:"flex",alignItems:"center"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:T.red,flexShrink:0,boxShadow:"0 0 0 2.5px rgba(218,54,51,0.25)"}}/>
                  <div style={{flex:1,height:1,background:T.red,opacity:0.65}}/>
                  <span style={{fontSize:10,fontWeight:700,color:T.redText,background:T.redBg,padding:"2px 6px",marginLeft:4,flexShrink:0,border:`0.5px solid rgba(218,54,51,0.3)`}}>{formatTime(nowMinutes)}</span>
                </div>
              )}

              {nutritionEvents.map(ev=>(<NutritionBlock key={ev.id} event={ev} mealData={mealBlocks?.[ev.mealKey]} nutritionCompletion={nutritionCompletion} onDragStart={startDrag} onResizeStart={startResize} onClick={(e)=>setMacroModal({event:e,mealKey:e.mealKey})} isDragging={dragging===ev.id} isResizing={resizing===ev.id}/>))}
              {classEvents.map(ev=>{ const sched=classSchedules.find(c=>c.id===ev.scheduleId); return<ClassBlock key={ev.id} event={ev} schedule={sched} onClick={()=>sched&&setClassModal({schedule:sched})}/>; })}
              {athleteEvents.map(ev=>(<EventBlock key={ev.id} event={ev} onDragStart={startDrag} onResizeStart={startResize} onClick={(e)=>{ if(e.source==="coach_workout"){setWorkoutModal(true);return;} setModal({event:e,mode:"edit",defaultStartMinutes:e.startMinutes}); }} isDragging={dragging===ev.id} isResizing={resizing===ev.id}/>))}

              {athleteEvents.length===0&&!dailyWorkout&&nutritionEvents.length===0&&classEvents.length===0&&!isLoading&&(
                <div style={{position:"absolute",top:minutesToY(8*60),left:"50%",transform:"translateX(-50%)",textAlign:"center",pointerEvents:"none",whiteSpace:"nowrap"}}>
                  <p style={{fontSize:15,fontWeight:500,color:T.bgElevated,margin:"0 0 4px"}}>Tap anywhere to add a block</p>
                  <p style={{fontSize:11,color:T.bgElevated}}>Or use the + button below</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FAB */}
        <button onClick={()=>setModal({event:{type:"workout",startMinutes:nowMinutes??9*60,durationMinutes:60},mode:"create",defaultStartMinutes:nowMinutes??9*60})}
          style={{position:"absolute",bottom:"max(24px,env(safe-area-inset-bottom,24px))",right:18,width:50,height:50,borderRadius:"50%",background:T.red,color:"#fff",border:"none",boxShadow:"0 4px 20px rgba(218,54,51,0.4)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:15}}
          aria-label="Add block"><Plus size={22}/></button>
      </div>

      {/* Sub-modals */}
      {isOpen&&modal&&<EventModal event={modal.event} defaultStartMinutes={modal.defaultStartMinutes} onSave={handleModalSave} onDelete={modal.mode==="edit"?handleModalDelete:undefined} onClose={()=>setModal(null)} onOpenClassSchedule={(opts)=>{setModal(null);setClassModal({schedule:null,defaultStartMinutes:opts.startMinutes});}}/>}
      {isOpen&&classModal!==null&&<ClassScheduleModal schedule={classModal.schedule||null} defaultStartMinutes={classModal.defaultStartMinutes} onSave={handleClassSave} onDelete={classModal.schedule?handleClassDelete:undefined} onClose={()=>setClassModal(null)}/>}
      {isOpen&&macroModal&&<MacroModal mealKey={macroModal.mealKey} mealData={mealBlocks?.[macroModal.mealKey]} event={macroModal.event} nutritionCompletion={nutritionCompletion} onToggle={handleNutritionToggle} onClose={()=>setMacroModal(null)}/>}
      {isOpen&&workoutModal&&<WorkoutDetailModal dailyWorkout={dailyWorkout} items={workoutItems} optimisticStatusById={optimisticStatusById} onClose={()=>setWorkoutModal(false)} onOpenItem={(item)=>{setWorkoutModal(false);openModal(item);}}/>}
      {isOpen&&modalOpen&&<CompleteItemModal open={modalOpen} item={activeItem} selectedFile={selectedFile} coachNote={coachNote} submitting={Boolean(submittingId&&activeItem?.id===submittingId)} onClose={closeModal} onPickFile={setSelectedFile} onChangeNote={setCoachNote} evidenceRequiredOverride={evidenceRequired} onSubmit={()=>{if(evidenceRequired&&!selectedFile)return;submitCompletion({workoutItemId:String(activeItem?.id||""),evidenceRequired:String(canonicalItem?.EvidenceRequired??activeItem?.EvidenceRequired??""),dailyWorkoutId:String(dailyWorkout?.id||dailyWorkout?.ID||dailyWorkout?.recordId||"")});}}/>}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}