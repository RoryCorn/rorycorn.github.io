/* =====================================================================
   FREQUENCY ATLAS — APP
   ===================================================================== */
(function(){
  "use strict";

  const state = { view:"brain", mode:"science", region:null, playingHz:null, dim:"2d" };

  const el = id => document.getElementById(id);
  const canvasInner = el("canvasInner");
  const hint = el("hint");
  const panelEmpty = el("panelEmpty");
  const panelContent = el("panelContent");

  /* ---------------- NATIVE / HAPTICS ----------------
     Uses the Capacitor Haptics plugin on iOS/Android when present,
     falls back to the Web Vibration API, and is a no-op otherwise. */
  const Cap = window.Capacitor || null;
  const CapPlugins = (Cap && Cap.Plugins) || {};
  function haptic(kind){
    try{
      const H = CapPlugins.Haptics;
      if(H){
        if(kind==="light" && H.impact) H.impact({ style:"LIGHT" });
        else if(kind==="medium" && H.impact) H.impact({ style:"MEDIUM" });
        else if(H.selectionChanged) H.selectionChanged();
        return;
      }
      if(navigator.vibrate) navigator.vibrate(kind==="medium"?18:8);
    }catch(e){}
  }

  /* ---------------- KEEP SCREEN AWAKE ----------------
     Prevents the display from auto-locking while a tone is playing, so a
     meditation session isn't cut short by the screen timing out (which
     backgrounds the app and stops the audio). Uses the native KeepAwake
     plugin when present (reliable on all iOS versions), falling back to the
     Web Screen Wake Lock API otherwise. Released as soon as playback stops. */
  const KeepScreen = (function(){
    let wantOn=false, wakeLock=null;
    const KA = CapPlugins.KeepAwake || null;
    async function acquire(){
      try{
        if(KA && KA.keepAwake){ await KA.keepAwake(); return; }
        if("wakeLock" in navigator){ wakeLock = await navigator.wakeLock.request("screen"); }
      }catch(e){}
    }
    async function release(){
      try{
        if(KA && KA.allowSleep){ await KA.allowSleep(); return; }
        if(wakeLock){ await wakeLock.release(); wakeLock=null; }
      }catch(e){}
    }
    // the Web wake lock is dropped when the tab is hidden; re-acquire on return if still wanted
    document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible" && wantOn) acquire(); });
    return { on(){ wantOn=true; acquire(); }, off(){ wantOn=false; release(); } };
  })();

  /* ---------------- AUDIO ENGINE ----------------
     Frequencies >= AUDIBLE_MIN play as a pure sine pitch.
     Lower frequencies (brainwave range) are inaudible as a pitch and
     most speakers can't reproduce them, so we render them as an
     ISOCHRONIC PULSE: an audible carrier tone switched on/off at the
     target rate, letting you actually hear the rhythm. */
  const AUDIBLE_MIN = 40;      // Hz — below this, use a pulse
  const CARRIER_HZ  = 220;     // audible carrier for the pulse
  const Audio = (function(){
    let ctx=null, parts=[], gain=null, analyser=null, raf=null, curHz=null, curMode=null;
    let vol=0.35;
    function ensure(){
      if(!ctx) ctx=new (window.AudioContext||window.webkitAudioContext)();
      if(ctx.state==="suspended") ctx.resume();
      return ctx;
    }
    function killParts(){ parts.forEach(n=>{ try{n.stop&&n.stop();}catch(e){} try{n.disconnect&&n.disconnect();}catch(e){} }); parts=[]; }
    function stop(){
      KeepScreen.off();
      if(gain&&ctx){ try{ gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(0,ctx.currentTime,0.03);}catch(e){} }
      const dying=parts; parts=[];
      setTimeout(()=>{ dying.forEach(n=>{ try{n.stop&&n.stop();}catch(e){} try{n.disconnect&&n.disconnect();}catch(e){} }); },150);
      gain=null; curHz=null; curMode=null;
      if(raf) cancelAnimationFrame(raf), raf=null;
      clearWave();
      onChange&&onChange(null);
    }
    function play(hz){
      ensure();
      if(curHz===hz){ stop(); return; }
      KeepScreen.on();
      killParts(); if(raf) cancelAnimationFrame(raf), raf=null;

      gain=ctx.createGain(); analyser=ctx.createAnalyser(); analyser.fftSize=2048;
      // explicit centre pan so output is identical on left & right speakers
      gain.connect(analyser);
      if(ctx.createStereoPanner){
        const pan=ctx.createStereoPanner(); pan.pan.value=0;
        analyser.connect(pan); pan.connect(ctx.destination); parts.push(pan);
      } else {
        analyser.connect(ctx.destination); // mono up-mixes equally to L/R
      }

      if(hz>=AUDIBLE_MIN){
        // pure audible pitch
        const osc=ctx.createOscillator(); osc.type="sine"; osc.frequency.value=hz;
        osc.connect(gain); osc.start(); parts.push(osc);
        gain.gain.value=0;
        gain.gain.setTargetAtTime(vol,ctx.currentTime,0.04);
        curMode="tone";
      } else {
        // isochronic pulse: carrier gated by an LFO at hz
        const carrier=ctx.createOscillator(); carrier.type="sine"; carrier.frequency.value=CARRIER_HZ;
        const lfo=ctx.createOscillator(); lfo.type="square"; lfo.frequency.value=hz;
        const depth=ctx.createGain(); depth.gain.value=vol*0.5;
        carrier.connect(gain);
        gain.gain.value=vol*0.5;          // midpoint
        lfo.connect(depth); depth.connect(gain.gain);   // swing 0..vol at hz
        carrier.start(); lfo.start();
        parts.push(carrier,lfo,depth);
        curMode="pulse";
      }
      curHz=hz;
      drawWave();
      onChange&&onChange(hz);
    }
    function setVol(v){
      vol=v;
      if(gain&&ctx&&curMode==="tone"){ try{ gain.gain.setTargetAtTime(v,ctx.currentTime,0.05);}catch(e){} }
      // pulse volume applies on next play (gain param is being modulated)
    }
    function modeFor(hz){ return hz>=AUDIBLE_MIN ? "tone" : "pulse"; }
    /* live oscilloscope */
    const cv=el("waveCanvas"); const cctx=cv?cv.getContext("2d"):null;
    function clearWave(){ if(!cctx)return; cctx.clearRect(0,0,cv.width,cv.height); drawFlat(); }
    function drawFlat(){ if(!cctx)return; cctx.strokeStyle="rgba(124,92,255,.35)"; cctx.lineWidth=1.5; cctx.beginPath(); cctx.moveTo(0,cv.height/2); cctx.lineTo(cv.width,cv.height/2); cctx.stroke(); }
    function drawWave(){
      if(!cctx||!analyser) return;
      const buf=new Uint8Array(analyser.fftSize);
      (function loop(){
        raf=requestAnimationFrame(loop);
        analyser.getByteTimeDomainData(buf);
        cctx.clearRect(0,0,cv.width,cv.height);
        const grad=cctx.createLinearGradient(0,0,cv.width,0);
        grad.addColorStop(0,"#28d3c7"); grad.addColorStop(1,"#7c5cff");
        cctx.lineWidth=2; cctx.strokeStyle=grad; cctx.beginPath();
        const slice=cv.width/buf.length;
        for(let i=0;i<buf.length;i++){
          const v=buf[i]/128; const y=v*cv.height/2;
          const x=i*slice;
          i===0?cctx.moveTo(x,y):cctx.lineTo(x,y);
        }
        cctx.stroke();
      })();
    }
    let onChange=null;
    return { play, stop, setVol, drawFlat, onChange:fn=>onChange=fn, isPlaying:()=>curHz, modeFor };
  })();

  function refreshPlayBtn(hz){
    state.playingHz=hz;
    if(hz!==null) maybeShowAudioHint();
    const btn=el("playBtn"), lbl=el("playLabel");
    if(!btn) return;
    const playingThis = hz!==null && state.showFreq!=null && Math.abs(hz-state.showFreq)<0.001;
    btn.classList.toggle("playing", playingThis);
    lbl.textContent = playingThis ? "Stop" : (Audio.modeFor(state.showFreq)==="pulse" ? "Play pulse" : "Play tone");
    btn.querySelector(".play-ico").textContent = playingThis ? "◼" : "▶";
  }
  Audio.onChange(refreshPlayBtn);

  /* ---------------- AUDIO HINT (once, on first play) ---------------- */
  const AUDIO_HINT_KEY = "satb_audio_hint_v1";
  let audioHintDone = false;
  try{ audioHintDone = localStorage.getItem(AUDIO_HINT_KEY)==="1"; }catch(e){}
  let audioHintTimer = null;
  function dismissAudioHint(){
    const t=el("audioToast"); if(!t||t.hidden) return;
    t.classList.add("leaving");
    setTimeout(()=>{ t.hidden=true; t.classList.remove("leaving"); }, 300);
  }
  function maybeShowAudioHint(){
    if(audioHintDone) return;
    audioHintDone = true;
    try{ localStorage.setItem(AUDIO_HINT_KEY, "1"); }catch(e){}
    const t=el("audioToast"); if(!t) return;
    t.hidden=false;
    clearTimeout(audioHintTimer);
    audioHintTimer = setTimeout(dismissAudioHint, 5000);
  }

  /* ---------------- HELPERS ---------------- */
  function currentFreq(region){ return region[state.mode]; }

  /* ---------------- RENDER: BRAIN (detailed sagittal section) ---------------- */
  function renderBrain(){
    const d=BRAIN;
    let svg=`<svg class="brain-svg" viewBox="${d.viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Sagittal brain cross-section — 3D render">`;
    svg+=`<image href="img/brain.jpg" xlink:href="img/brain.jpg" x="0" y="0" width="100" height="56" preserveAspectRatio="none"/>`;
    d.regions.forEach(r=>svg+=nodeSVG(r,2.2));
    svg+=`</svg>`;
    canvasInner.innerHTML=svg;
    wireNodes(d.regions);
  }

  /* ---------------- RENDER: BODY (detailed anatomical figure) ---------------- */
  function bodyDefs(){
    return `<defs><linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1c2246"/><stop offset="1" stop-color="#12173a"/>
      </linearGradient></defs>`;
  }
  // silhouette only — shared by body / organs / nerves views
  function bodySilhouette(){
    return `<path class="body-skin" d="M50,3
      C45,3 42,6 42,11 C42,14 43,16 44,18 C40,19 38,21 37,25
      C33,26 27,29 25,35 C23,41 21,49 19,56 C18,60 17,63 16,66
      C15,69 18,71 20,68 C22,63 24,57 26,52 C27,58 27,64 27,69
      C26,76 25,82 26,88 C27,92 29,93 31,92 C31,102 32,114 33,124
      C33,131 32,138 33,143 C33,147 38,147 39,143 C40,136 41,128 42,120
      C43,113 44,106 45,100 C47,101 53,101 55,100 C56,106 57,113 58,120
      C59,128 60,136 61,143 C62,147 67,147 67,143 C68,138 67,131 67,124
      C68,114 69,102 69,92 C71,93 73,92 74,88 C75,82 74,76 73,69
      C73,64 73,58 74,52 C76,57 78,63 80,68 C82,71 85,69 84,66
      C83,63 82,60 81,56 C79,49 77,41 75,35 C73,29 67,26 63,25
      C62,21 60,19 56,18 C57,16 58,14 58,11 C58,6 55,3 50,3 Z"/>
      <ellipse class="anat" cx="50" cy="11" rx="8" ry="9" fill="none"/>`;
  }
  // full organ set — shared by body and organs views
  function bodyOrgansArt(){
    let s="";
    s+=`<path class="organ organ-brain" d="M45,7 q-3,-2 -1,-4 q2,-2 4,-1 q3,-2 5,0 q3,0 3,3 q2,1 0,3 q-1,3 -4,2 q-4,2 -7,-1 q-2,-1 0,-2 Z"/>`;
    s+=`<path class="spine" d="M50,20 L50,90" />`;
    s+=`<g class="vertebrae"><path d="M47,26 h6 M47,32 h6 M47,38 h6 M47,44 h6 M47,52 h6 M47,60 h6 M47,68 h6 M47,76 h6 M47,84 h6"/></g>`;
    s+=`<path class="organ organ-resp" d="M48,20 h4 v6 h-4 Z"/>`;
    s+=`<path class="organ organ-thyroid" d="M46,24 q4,-2 8,0 q-2,3 -4,3 q-2,0 -4,-3 Z"/>`;
    s+=`<path class="organ organ-lung" d="M46,32 C40,33 37,40 37,48 C37,53 40,56 44,54 C46,49 47,42 47,36 C47,34 47,33 46,32 Z"/>`;
    s+=`<path class="organ organ-lung" d="M54,32 C60,33 63,40 63,48 C63,53 60,56 56,54 C54,49 53,42 53,36 C53,34 53,33 54,32 Z"/>`;
    s+=`<path class="organ organ-heart" d="M50,38 C48,35 43,36 44,41 C44,45 49,49 50,50 C51,49 56,45 56,41 C57,36 52,35 50,38 Z"/>`;
    s+=`<path class="diaphragm" d="M39,56 Q50,62 61,56" fill="none"/>`;
    s+=`<g class="ribs"><path d="M42,36 q8,3 16,0 M41,40 q9,4 18,0 M40,44 q10,4 20,0 M40,48 q10,4 20,0 M41,52 q9,3 18,0" fill="none"/></g>`;
    s+=`<path class="organ organ-liver" d="M40,58 C46,57 54,58 58,60 C57,64 52,66 46,65 C42,64 40,61 40,58 Z"/>`;
    s+=`<path class="organ organ-stomach" d="M54,60 C59,60 61,64 59,68 C57,71 53,70 52,66 C51,63 52,61 54,60 Z"/>`;
    s+=`<path class="organ organ-pancreas" d="M46,64 q6,1 11,3 q-1,2 -5,1 q-4,-1 -6,-4 Z"/>`;
    s+=`<path class="organ organ-spleen" d="M60,60 q4,1 4,5 q-1,3 -4,2 q-2,-3 0,-7 Z"/>`;
    s+=`<path class="organ organ-kidney" d="M41,62 c-2,0 -3,2 -2.5,4 c.5,2 2.5,2 3,0 c.4,-1.6 .2,-4 -.5,-4 Z"/>`;
    s+=`<path class="organ organ-kidney" d="M59,62 c2,0 3,2 2.5,4 c-.5,2 -2.5,2 -3,0 c-.4,-1.6 -.2,-4 .5,-4 Z"/>`;
    s+=`<path class="organ organ-gut" d="M42,70 C38,72 38,78 43,79 C48,80 50,75 47,73 C51,74 54,72 55,75
      C57,79 52,82 48,81 C43,80 40,84 45,86 C51,87 57,85 58,80 C59,75 56,71 51,71 C47,71 44,70 42,70 Z"/>`;
    s+=`<path class="organ organ-pelvis" d="M40,86 C44,90 47,92 50,92 C53,92 56,90 60,86
      C58,92 54,96 50,96 C46,96 42,92 40,86 Z" fill="none"/>`;
    s+=`<path class="organ organ-bladder" d="M47,88 q3,-2 6,0 q1,3 -3,4 q-4,-1 -3,-4 Z"/>`;
    return s;
  }
  function bodyMuscleArt(){
    let s="";
    s+=`<path class="muscle" d="M26,36 C23,42 21,49 20,55 M27,44 q-2,5 -3,10" fill="none"/>`;
    s+=`<ellipse class="muscle-belly" cx="24" cy="42" rx="3" ry="6"/>`;
    s+=`<g class="bones"><path d="M18,63 l0,4 M20,63 l0,4 M22,64 l0,3"/></g>`;
    s+=`<ellipse class="muscle-belly" cx="42" cy="110" rx="4" ry="9"/>`;
    s+=`<ellipse class="muscle-belly" cx="58" cy="110" rx="4" ry="9"/>`;
    s+=`<path class="muscle" d="M41,124 q-1,7 -1,14 M59,124 q1,7 1,14 M42,110 q0,-6 1,-10 M58,110 q0,-6 -1,-10" fill="none"/>`;
    s+=`<g class="bones"><path d="M42,98 l-1,42 M58,98 l1,42"/></g>`;
    return s;
  }
  function renderBody(){
    const d=BODY;
    let svg=`<svg class="body-svg" viewBox="${d.viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Anatomical figure — 3D render">`;
    svg+=`<image href="img/body.jpg" xlink:href="img/body.jpg" x="0" y="0" width="100" height="150" preserveAspectRatio="none"/>`;
    d.regions.forEach(r=>svg+=nodeSVG(r,2.6));
    svg+=`</svg>`;
    canvasInner.innerHTML=svg;
    wireNodes(d.regions);
  }

  /* ---------------- RENDER: ORGANS ---------------- */
  function renderOrgans(){
    const d=ORGANS;
    let svg=`<svg class="body-svg" viewBox="${d.viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Major organs — 3D render">`;
    svg+=`<image href="img/body.jpg" xlink:href="img/body.jpg" x="0" y="0" width="100" height="150" preserveAspectRatio="none"/>`;
    d.regions.forEach(r=>svg+=nodeSVG(r,2.3));
    svg+=`</svg>`;
    canvasInner.innerHTML=svg;
    wireNodes(d.regions);
  }

  /* ---------------- RENDER: NERVES ---------------- */
  function renderNerves(){
    const d=NERVES;
    let svg=`<svg class="body-svg nerve-svg" viewBox="${d.viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Nervous system — 3D render">`;
    svg+=`<image href="img/body.jpg" xlink:href="img/body.jpg" x="0" y="0" width="100" height="150" preserveAspectRatio="none"/>`;
    d.regions.forEach(r=>svg+=nodeSVG(r,2.3));
    svg+=`</svg>`;
    canvasInner.innerHTML=svg;
    wireNodes(d.regions);
  }

  /* ---------------- RENDER: MUSCLES ---------------- */
  function renderMuscles(){
    const d=MUSCLES;
    let svg=`<svg class="body-svg" viewBox="${d.viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Muscle groups — 3D render">`;
    svg+=`<image href="img/body.jpg" xlink:href="img/body.jpg" x="0" y="0" width="100" height="150" preserveAspectRatio="none"/>`;
    d.regions.forEach(r=>svg+=nodeSVG(r,2.3));
    svg+=`</svg>`;
    canvasInner.innerHTML=svg;
    wireNodes(d.regions);
  }

  /* ---------------- RENDER: HARMONY (the tetractys) ----------------
     The one map that is not anatomy, so it is drawn rather than photographed.
     The Monad sits at the centre and the rings carry its ratios outward — the
     One becoming many. The small figure top left is the tetractys itself,
     1+2+3+4, whose numbers generate exactly these four intervals. */
  function renderHarmony(){
    const d=HARMONY, C=50;
    const at=id=>d.regions.find(r=>r.id===id);
    let svg=`<svg class="harmony-svg" viewBox="${d.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The tetractys — the Monad and the ratios it generates">`;
    svg+=`<defs><radialGradient id="monadGlow"><stop offset="0%" stop-color="rgba(124,92,255,.5)"/><stop offset="100%" stop-color="rgba(124,92,255,0)"/></radialGradient></defs>`;
    [16,24,32].forEach(r=>{ svg+=`<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="rgba(124,92,255,.20)" stroke-width=".3"/>`; });
    ["octave","fifth","fourth"].forEach(id=>{ const n=at(id);
      svg+=`<line x1="${C}" y1="${C}" x2="${n.x}" y2="${n.y}" stroke="rgba(124,92,255,.16)" stroke-width=".25"/>`; });
    svg+=`<circle cx="${C}" cy="${C}" r="11" fill="url(#monadGlow)"/>`;
    for(let row=1;row<=4;row++){
      for(let i=0;i<row;i++){
        svg+=`<circle cx="${18-(row-1)*2.5+i*5}" cy="${8+(row-1)*5}" r="1.1" fill="rgba(255,255,255,.24)"/>`;
      }
    }
    svg+=`<text x="18" y="29.5" text-anchor="middle" font-size="2.5" fill="rgba(255,255,255,.42)">tetractys · 1 2 3 4</text>`;
    d.regions.forEach(r=>svg+=nodeSVG(r,2.3));
    svg+=`</svg>`;
    canvasInner.innerHTML=svg;
    wireNodes(d.regions);
  }

  function nodeSVG(r,rad){
    const f=currentFreq(r);
    return `<g class="node" data-id="${r.id}" tabindex="0" role="button" aria-label="${strip(r.label)}, ${f.freq} hertz">
        <circle class="halo" cx="${r.x}" cy="${r.y}" r="${rad*1.5}"/>
        <circle class="ping" cx="${r.x}" cy="${r.y}" r="${rad*1.05}"/>
        <circle class="dot" cx="${r.x}" cy="${r.y}" r="${rad*0.7}"/>
        <text class="lbl" x="${r.x}" y="${r.y - rad*1.9}" text-anchor="middle">${r.label}</text>
      </g>`;
  }
  function strip(s){ return s.replace(/&amp;/g,"&"); }

  function wireNodes(regions){
    canvasInner.querySelectorAll(".node").forEach(n=>{
      const id=n.getAttribute("data-id");
      const region=regions.find(r=>r.id===id);
      const act=()=>selectRegion(region,regions);
      n.addEventListener("click",act);
      n.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){e.preventDefault();act();} });
      n.addEventListener("mouseenter",()=>{ if(!state.region) previewHint(region); });
    });
    // re-highlight active
    if(state.region){ const a=canvasInner.querySelector(`.node[data-id="${state.region.id}"]`); if(a)a.classList.add("active"); }
  }
  function previewHint(r){ const f=currentFreq(r); hint.textContent=`${strip(r.label)} — ${f.real||f.freq+" Hz"}`; }

  /* ---------------- SELECT REGION ---------------- */
  function selectRegion(region,regions){
    state.region=region;
    haptic("light");
    canvasInner.querySelectorAll(".node").forEach(n=>n.classList.toggle("active",n.getAttribute("data-id")===region.id));
    const f=currentFreq(region);
    panelEmpty.hidden=true; panelContent.hidden=false;

    const BADGES = { brain:"Brain region", body:"Body region", organs:"Major organ", nerves:"Nerve", cell:"Cell structure", atom:"Atomic structure", harmony:"Ratio" };
    const hasReal = !!f.real;
    el("pcBadge").textContent = BADGES[state.view] || "Region";
    el("pcTitle").innerHTML = region.label;
    el("pcSub").textContent = state.mode==="science" ? "Showing measured / physical frequency" : "Showing traditional (belief-based) frequency";
    el("freqNum").textContent = hasReal ? f.real : f.freq;
    el("freqUnit").style.display = hasReal ? "none" : "";
    el("freqTag").textContent = f.tag;
    el("freqNote").textContent = hasReal ? "" : (f.note||"");
    el("pcRole").innerHTML = region.role;

    // effect text depends on mode
    if(state.mode==="science"){
      const band=WAVE_BANDS.find(b=>b.key===region.band);
      el("pcEffect").innerHTML = band
        ? `This region is associated with the <b>${band.name}</b> band (${band.range}) — ${band.state.toLowerCase()}. ${band.role}`
        : (hasReal ? `Real physical frequency: <b>${f.real}</b>. ${f.note}` : f.note);
    } else {
      el("pcEffect").innerHTML = `In sound-healing tradition this point is paired with <b>${f.tag}</b>. ${f.note} <em>These effects are not scientifically established.</em>`;
    }

    // ---- Sources (Guideline 1.4.1: health info must carry findable citations) ----
    renderSources(region);

    // alternate frequencies (the other mode + band tone)
    const alts=[];
    const other = state.mode==="science" ? region.traditional : region.science;
    if(other) alts.push({hz:other.freq, label:other.tag});
    const band=WAVE_BANDS.find(b=>b.key===region.band);
    if(band && band.play!==f.freq) alts.push({hz:band.play, label:`${band.name} pulse`});
    el("altSection").hidden = alts.length===0;
    el("altFreqs").innerHTML = alts.map(a=>`<button class="alt-pill" data-hz="${a.hz}"><span class="ap-hz">${a.hz} Hz</span> ${a.label}</button>`).join("");
    el("altFreqs").querySelectorAll(".alt-pill").forEach(p=>p.addEventListener("click",()=>Audio.play(parseFloat(p.dataset.hz))));

    // record which frequency the big button controls, and how it will sound
    state.showFreq = f.freq;
    const isPulse = Audio.modeFor(f.freq)==="pulse";
    el("playModeNote").innerHTML = hasReal
      ? `🔈 Shown at its real measured value (<b>${f.real}</b>). You're hearing an audible ${isPulse?"pulse":"tone"} representation at ${f.freq} Hz.`
      : isPulse
        ? `🔈 ${f.freq} Hz is below hearing range — played as an <b>isochronic pulse</b> (an audible ${CARRIER_HZ} Hz carrier pulsing ${f.freq}× per second) so you hear the rhythm.`
        : `🔈 Played as a pure ${f.freq} Hz sine tone.`;

    Audio.drawFlat();
    refreshPlayBtn(Audio.isPlaying());
    el("playBtn").onclick=()=>{ haptic("medium"); Audio.play(f.freq); };
    hint.textContent=`${strip(region.label)} selected — press play to hear ${f.freq} Hz`;
    panelContent.scrollTop=0;
    // On phones the panel sits below the diagram; bring the Play button into view on select
    if(matchMedia("(max-width:900px)").matches) el("playBtn").scrollIntoView({behavior:"smooth",block:"center"});
  }

  /* ---------------- RENDER: BRAINWAVES ---------------- */
  function renderWaves(){
    let html=`<div style="width:100%"><p class="waves-intro">The brain runs on rhythms of electrical activity, grouped by speed into five bands. Unlike Solfeggio tones, these are <b>directly measured with an EEG</b>. Click a card to hear a tone at that band's frequency (the slowest bands are felt as pulses rather than pitches).</p><div class="waves-grid">`;
    WAVE_BANDS.forEach(b=>{
      html+=`<div class="wave-card" data-hz="${b.play}" style="--wc:${b.color}">
        <h3 style="color:${b.color}">${b.name}</h3>
        <div class="wc-range">${b.range}</div>
        <svg class="wc-line" viewBox="0 0 120 44" preserveAspectRatio="none">${waveLine(b)}</svg>
        <div class="wc-state">${b.state}</div>
        <div class="wc-role">${b.role}</div>
        <div class="wc-play">▶ Play ${b.play} Hz tone</div>
      </div>`;
    });
    html+=`</div></div>`;
    canvasInner.innerHTML=html;
    canvasInner.querySelectorAll(".wave-card").forEach(c=>c.addEventListener("click",()=>Audio.play(parseFloat(c.dataset.hz))));
    // panel stays as empty guidance
    panelEmpty.hidden=false; panelContent.hidden=true;
    state.region=null;
    hint.textContent="Each card plays a representative tone for that brainwave band.";
  }
  function waveLine(b){
    // cycles proportional to band speed
    const cyc={delta:1,theta:2,alpha:4,beta:7,gamma:12}[b.key]||4;
    let path="M0,22"; const steps=120;
    for(let i=1;i<=steps;i++){ const x=i/steps*120; const y=22-14*Math.sin(i/steps*cyc*2*Math.PI); path+=` L${x.toFixed(1)},${y.toFixed(1)}`; }
    return `<path d="${path}" fill="none" stroke="${b.color}" stroke-width="2"/>`;
  }

  /* ---------------- RENDER: CELL ---------------- */
  function dnaSVG(cx,y0,y1){
    const amp=5, turns=2.2, steps=44; let a="",b="",rungs="";
    for(let i=0;i<=steps;i++){
      const t=i/steps, y=y0+(y1-y0)*t, ph=t*turns*2*Math.PI;
      const xa=cx+amp*Math.sin(ph), xb=cx-amp*Math.sin(ph);
      a+=(i?"L":"M")+xa.toFixed(1)+","+y.toFixed(1);
      b+=(i?"L":"M")+xb.toFixed(1)+","+y.toFixed(1);
      if(i%4===0) rungs+=`<line x1="${xa.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    }
    return `<g class="dna"><path d="${a}" fill="none"/><path d="${b}" fill="none"/><g class="rungs">${rungs}</g></g>`;
  }
  function renderCell(){
    const d=CELL;
    let svg=`<svg class="cell-svg" viewBox="${d.viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Cell cross-section — 3D render">`;
    svg+=`<image href="img/cell.jpg" xlink:href="img/cell.jpg" x="0" y="0" width="100" height="56" preserveAspectRatio="none"/>`;
    d.regions.forEach(r=>svg+=nodeSVG(r,2.4));
    svg+=`</svg>`;
    canvasInner.innerHTML=svg;
    wireNodes(d.regions);
  }

  /* ---------------- RENDER: ATOM ---------------- */
  function renderAtom(){
    const d=ATOM;
    let svg=`<svg class="atom-svg" viewBox="${d.viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Atom model — 3D render">`;
    svg+=`<image href="img/atom.jpg" xlink:href="img/atom.jpg" x="0" y="0" width="100" height="56" preserveAspectRatio="none"/>`;
    d.regions.forEach(r=>svg+=nodeSVG(r,2.4));
    svg+=`</svg>`;
    canvasInner.innerHTML=svg;
    wireNodes(d.regions);
  }

  /* ---------------- VIEW SWITCHING ---------------- */
  const RENDERERS = { brain:renderBrain, body:renderBody, organs:renderOrgans, muscles:renderMuscles, nerves:renderNerves, cell:renderCell, atom:renderAtom, harmony:renderHarmony, waves:renderWaves };
  const REGION_SETS = { brain:()=>BRAIN.regions, body:()=>BODY.regions, organs:()=>ORGANS.regions, muscles:()=>MUSCLES.regions, nerves:()=>NERVES.regions, cell:()=>CELL.regions, atom:()=>ATOM.regions, harmony:()=>HARMONY.regions };

  /* ---------------- 3D ATLAS ----------------
     The 3D markers carry class="node" + data-id, so wireNodes() and
     selectRegion() drive them exactly as they drive the 2D SVG nodes. */
  const dimToggle = el("dimToggle");
  let view3d = null;

  function dispose3D(){ if(view3d){ try{ view3d.dispose(); }catch(e){} view3d=null; } }
  function has3D(v){ return !!(window.Atlas3D && Atlas3D.supported() && Atlas3D.hasModel(v)); }
  function want3D(){ return state.dim==="3d" && has3D(state.view); }

  function saveDim(){ try{ localStorage.setItem("satb.dim", state.dim); }catch(e){} }
  function loadDim(){
    try{ const v=localStorage.getItem("satb.dim"); if(v) return v; }catch(e){}
    // first run: lead with 3D wherever the device can actually render it
    return (window.Atlas3D && Atlas3D.supported()) ? "3d" : "2d";
  }

  function syncDimToggle(){
    if(!dimToggle) return;
    const avail = has3D(state.view);
    dimToggle.hidden = !avail;
    dimToggle.querySelectorAll("button").forEach(b=>{
      const on = b.dataset.dim===state.dim;
      b.classList.toggle("on",on);
      b.setAttribute("aria-pressed",on);
    });
  }

  function render3D(){
    const regions = (REGION_SETS[state.view]||(()=>[]))();
    dispose3D();
    canvasInner.innerHTML="";
    const v = Atlas3D.create(canvasInner);
    view3d = v;
    v.load(state.view, regions).then(()=>{
      if(view3d!==v) return;              // view changed while loading
      wireNodes(regions);
    }).catch(err=>{
      console.warn("3D atlas unavailable, using 2D:",err);
      if(view3d!==v) return;
      dispose3D();
      state.dim="2d"; saveDim(); syncDimToggle();
      (RENDERERS[state.view]||renderBrain)();
    });
  }

  function renderCurrent(){
    syncDimToggle();
    if(want3D()){ render3D(); return; }
    dispose3D();
    (RENDERERS[state.view]||renderBrain)();
  }

  if(dimToggle){
    dimToggle.addEventListener("click",e=>{
      const b=e.target.closest("button[data-dim]");
      if(!b || b.dataset.dim===state.dim) return;
      state.dim=b.dataset.dim; saveDim();
      state.region=null;
      Audio.stop();
      panelEmpty.hidden=false; panelContent.hidden=true;
      haptic("light");
      renderCurrent();
    });
  }

  function setView(v){
    state.view=v;
    state.region=null;
    haptic("light");
    document.querySelectorAll(".tab").forEach(t=>{ const on=t.dataset.view===v; t.classList.toggle("active",on); t.setAttribute("aria-selected",on); });
    Audio.stop();
    renderCurrent();
    if(v!=="waves"){ panelEmpty.hidden=false; panelContent.hidden=true; }
  }
  function setMode(m){
    state.mode=m;
    document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("active",c.dataset.mode===m));
    const keepId = state.region && state.region.id;
    renderCurrent();
    if(keepId && REGION_SETS[state.view]){ // re-open with new mode
      const regions = REGION_SETS[state.view]();
      const fresh = regions.find(r=>r.id===keepId);
      if(fresh) selectRegion(fresh,regions);
    }
  }

  /* ---------------- WIRE UP ---------------- */
  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>setView(t.dataset.view)));
  document.querySelectorAll(".chip").forEach(c=>c.addEventListener("click",()=>{ haptic("light"); setMode(c.dataset.mode); }));
  el("stopAll").addEventListener("click",()=>Audio.stop());
  el("audioToastClose").addEventListener("click",dismissAudioHint);
  el("vol").addEventListener("input",e=>Audio.setVol(e.target.value/100));
  window.addEventListener("keydown",e=>{ if(e.key==="Escape"){ Audio.stop(); closeOverlays(); } });

  /* ---------------- DISCLAIMER GATE + ABOUT ---------------- */
  const DISCLAIMER_KEY = "satb_disclaimer_v1";
  function show(id){ el(id).hidden=false; }
  function hide(id){ el(id).hidden=true; }
  function closeOverlays(){ hide("about"); }

  function openAbout(){ haptic("light"); Audio.stop(); show("about"); }
  /* ---------------- SOURCES / CITATIONS ----------------
     Apple 1.4.1 requires that health information carry citations the user can
     find. The full citation text is rendered on screen, not just a link, so the
     citation still stands if a device cannot open the URL. */
  function srcLink(key){
    const s = SOURCES[key];
    if(!s) return "";
    return `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.cite}</a></li>`;
  }
  function renderSources(region){
    const lead = el("pcSrcLead"), list = el("pcSources");
    if(!lead || !list) return;
    if(state.mode === "traditional"){
      lead.innerHTML = "<b>No scientific source.</b> " + TRADITION_SOURCE_NOTE;
      list.innerHTML = "";
    } else {
      const keys = (VIEW_SOURCES[state.view] || []);
      if(keys.length === 0){
        lead.innerHTML = "The ratios shown here are arithmetic, not measurements — 2:1, 3:2, 4:3 are exact by definition. No physical source is required or claimed.";
        list.innerHTML = "";
      } else {
        lead.innerHTML = "The measured figures on this map are drawn from:";
        list.innerHTML = keys.map(srcLink).join("");
      }
    }
  }
  function openSources(){
    haptic("light");
    const all = el("allSources");
    if(all) all.innerHTML = Object.keys(SOURCES).map(srcLink).join("");
    const trad = el("allSourcesTradition");
    if(trad) trad.textContent = TRADITION_SOURCE_NOTE;
    show("sources");
  }
  if(el("unlockedOk")) el("unlockedOk").addEventListener("click", ()=>{ haptic("light"); hide("unlocked"); });
  el("sourcesBtn").addEventListener("click", openSources);
  el("sourcesClose").addEventListener("click", ()=>{ haptic("light"); hide("sources"); });
  el("sourcesOk").addEventListener("click", ()=>{ haptic("light"); hide("sources"); });
  el("srcMoreBtn").addEventListener("click", openSources);

  el("aboutBtn").addEventListener("click", openAbout);
  el("aboutClose").addEventListener("click", ()=>{ haptic("light"); hide("about"); });
  el("aboutOk").addEventListener("click", ()=>{ haptic("light"); hide("about"); });

  el("gateAccept").addEventListener("click", ()=>{
    haptic("medium");
    try{ localStorage.setItem(DISCLAIMER_KEY, "1"); }catch(e){}
    hide("gate");
    Entitlement.ensureTrialStarted();   // trial begins when they enter the app
    updateAccess();
  });
  el("gatePrivacy").addEventListener("click", ()=>{ haptic("light"); openAbout(); });

  // dismiss overlays by tapping the dark backdrop
  el("about").addEventListener("click", e=>{ if(e.target===el("about")) hide("about"); });

  /* ---------------- ENTITLEMENT: 7-day trial + one-time unlock ---------------- */
  const CFG = window.SATB_STORE_CONFIG || {};
  const TRIAL_DAYS = CFG.trialDays || 7;
  const DAY_MS = 86400000;
  const TRIAL_START_KEY = "satb_trial_start";
  const UNLOCKED_KEY = "satb_unlocked";
  const Entitlement = {
    ensureTrialStarted(){ try{ if(!localStorage.getItem(TRIAL_START_KEY)) localStorage.setItem(TRIAL_START_KEY, String(Date.now())); }catch(e){} },
    msLeft(){ try{ const s=parseInt(localStorage.getItem(TRIAL_START_KEY)||"0",10); if(!s) return TRIAL_DAYS*DAY_MS; return Math.max(0, s+TRIAL_DAYS*DAY_MS-Date.now()); }catch(e){ return TRIAL_DAYS*DAY_MS; } },
    daysLeft(){ return Math.max(0, Math.ceil(this.msLeft()/DAY_MS)); },
    isUnlocked(){ try{ return localStorage.getItem(UNLOCKED_KEY)==="1"; }catch(e){ return false; } },
    setUnlocked(){ try{ localStorage.setItem(UNLOCKED_KEY,"1"); }catch(e){} },
    hasAccess(){ return this.isUnlocked() || this.msLeft()>0; }
  };

  /* ---------------- STORE: RevenueCat purchases (drop-in) ---------------- */
  function platformKey(){
    const plat=(window.Capacitor&&window.Capacitor.getPlatform&&window.Capacitor.getPlatform())||"web";
    if(plat==="ios") return CFG.revenueCatAppleKey||"";
    if(plat==="android") return CFG.revenueCatGoogleKey||"";
    return "";
  }
  function entActive(info){ try{ const ci=(info&&(info.customerInfo||info))||{}; return !!(ci.entitlements&&ci.entitlements.active&&ci.entitlements.active[CFG.entitlementId||"full_unlock"]); }catch(e){ return false; } }
  const Store = {
    ready:false, P:null,
    getPlugin(){
      // no-bundler: use Capacitor's runtime registerPlugin(), fall back to Plugins map
      try{ if(window.Capacitor && typeof window.Capacitor.registerPlugin==="function") return window.Capacitor.registerPlugin("Purchases"); }catch(e){}
      return (window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Purchases)||null;
    },
    async init(){
      const key=platformKey();
      const P=this.getPlugin();
      if(!P||!key) return;                 // no plugin/keys -> trial-only mode
      try{ await P.configure({apiKey:key}); this.P=P; this.ready=true; await this.sync(); }catch(e){}
    },
    async sync(){ if(!this.ready) return; try{ if(entActive(await this.P.getCustomerInfo())) Entitlement.setUnlocked(); }catch(e){} },
    async buy(){
      if(!this.ready) return "unconfigured";
      try{
        const off=await this.P.getOfferings();
        const pkg=off&&off.current&&off.current.availablePackages&&off.current.availablePackages[0];
        if(!pkg) return "unavailable";
        const res=await this.P.purchasePackage({aPackage:pkg});
        if(entActive(res)){ Entitlement.setUnlocked(); return "ok"; }
        return "incomplete";
      }catch(e){ return (e&&e.userCancelled)?"cancelled":"error"; }
    },
    async restore(){ if(!this.ready) return "unconfigured"; try{ if(entActive(await this.P.restorePurchases())){ Entitlement.setUnlocked(); return "ok"; } return "none"; }catch(e){ return "error"; } }
  };

  /* ---------------- ACCESS / PAYWALL UI ---------------- */
  function updateAccess(){
    const pill=el("trialPill");
    if(Entitlement.isUnlocked()){ hide("paywall"); pill.hidden=false; pill.textContent="✓ Unlocked"; pill.className="trial-pill unlocked"; return; }
    const days=Entitlement.daysLeft();
    if(Entitlement.hasAccess()){
      hide("paywall"); pill.hidden=false;
      pill.textContent = days<=1 ? "Trial ends today" : ("Trial: "+days+" days left");
      pill.className = "trial-pill" + (days<=2?" ending":"");
    } else {
      pill.hidden=false; pill.textContent="Trial ended"; pill.className="trial-pill ending";
      showPaywall();
    }
  }
  function showPaywall(){ el("pwBuyLabel").textContent="Unlock — "+(CFG.priceLabel||"$1.99"); el("pwNote").textContent=""; show("paywall"); }
  function purchaseMsg(r){ return { unconfigured:"In-app purchases aren't set up in this build yet — see MONETIZATION.md.", unavailable:"This item isn't available right now.", cancelled:"Purchase cancelled.", none:"No previous purchase found for this account.", incomplete:"Purchase didn't complete.", error:"Something went wrong. Please try again." }[r] || "Please try again."; }
  el("trialPill").addEventListener("click", ()=>{ if(!Entitlement.isUnlocked()){ haptic("light"); showPaywall(); } });
  el("paywall").addEventListener("click", e=>{ if(e.target===el("paywall") && Entitlement.hasAccess()) hide("paywall"); });
  /* On the web there is no App Store, so the same unlock runs through
     Stripe (store-web.js). Native keeps RevenueCat. */
  const WEB = window.SATB_WEB_STORE && window.SATB_WEB_STORE.isWeb();

  el("pwBuy").addEventListener("click", async ()=>{
    haptic("medium");
    if(WEB){
      el("pwNote").textContent="Opening secure checkout…";
      try{ await window.SATB_WEB_STORE.buy(); }                 // navigates away
      catch(e){ el("pwNote").textContent = e.message || "Could not reach the checkout. Please try again."; }
      return;
    }
    el("pwNote").textContent="Contacting the store…";
    const r=await Store.buy();
    if(r==="ok"){ hide("paywall"); updateAccess(); } else el("pwNote").textContent=purchaseMsg(r);
  });

  el("pwRestore").addEventListener("click", async ()=>{
    haptic("light");
    if(WEB){                                   // reveal the paste-a-code row
      const row=el("pwCodeRow");
      row.hidden=!row.hidden;
      el("pwNote").textContent = row.hidden ? "" : "The code was emailed to you when you bought the atlas.";
      if(!row.hidden) el("pwCode").focus();
      return;
    }
    el("pwNote").textContent="Restoring…";
    const r=await Store.restore();
    if(r==="ok"){ hide("paywall"); updateAccess(); } else el("pwNote").textContent=purchaseMsg(r);
  });

  /* Redeem a code. The server decides - we only believe its answer. */
  async function redeemCode(){
    const code = (el("pwCode").value||"").trim();
    if(!code){ el("pwNote").textContent="Enter the code from your email."; return; }
    el("pwNote").textContent="Checking that code…";
    try{
      const d = await window.SATB_WEB_STORE.redeem(code);
      if(d && d.ok){
        Entitlement.setUnlocked();
        hide("paywall"); updateAccess();
        el("pwNote").textContent="";
      } else {
        el("pwNote").textContent = (d && d.error) || "That code was not recognised.";
      }
    }catch(e){ el("pwNote").textContent = e.message || "Could not check that code right now."; }
  }
  if(el("pwCodeGo")) el("pwCodeGo").addEventListener("click", ()=>{ haptic("light"); redeemCode(); });
  if(el("pwCode")) el("pwCode").addEventListener("keydown", e=>{ if(e.key==="Enter") redeemCode(); });

  /* Coming back from Stripe: ?paid=1&session_id=... The browser cannot
     unlock itself on the strength of that - the server re-asks Stripe. */
  (async function handleStripeReturn(){
    if(!WEB) return;
    const q = new URLSearchParams(location.search);
    const sid = q.get("session_id");
    if(!sid) return;
    try{
      const d = await window.SATB_WEB_STORE.confirm(sid);
      if(d && d.ok){
        Entitlement.setUnlocked();
        hide("paywall"); updateAccess();
        if(d.code) showPurchaseCode(d.code, d.emailed);
      }
    }catch(e){ /* leave them on the trial rather than guess */ }
    finally{
      // Keep the receipt out of the address bar so a refresh is harmless.
      try{ history.replaceState({}, "", location.pathname); }catch(e){}
    }
  })();

  /* Show the unlock code once, plainly, so it is not lost if the email
     is slow or goes to spam. */
  function showPurchaseCode(code, emailed){
    const box = el("unlockedBox");
    if(!box){ alert("Unlocked. Your code is " + code); return; }
    el("unlockedCode").textContent = code;
    el("unlockedNote").textContent = emailed
      ? "We also emailed this code to you. Keep it — it unlocks the atlas on any device."
      : "Keep this code — it unlocks the atlas on any device. (We could not send the email; this is your only copy.)";
    show("unlocked");
  }

  let accepted=false;
  try{ accepted = localStorage.getItem(DISCLAIMER_KEY)==="1"; }catch(e){}
  if(!accepted){ show("gate"); }
  else { Entitlement.ensureTrialStarted(); updateAccess(); }
  Store.init().then(()=>updateAccess());   // native: reconcile with store, then refresh

  /* ---------------- NATIVE SHELL SETUP ---------------- */
  (function initNative(){
    try{
      const P = CapPlugins;
      if(P.StatusBar){
        if(P.StatusBar.setStyle) P.StatusBar.setStyle({ style:"DARK" });
        if(P.StatusBar.setBackgroundColor) P.StatusBar.setBackgroundColor({ color:"#0b0e1a" });
      }
      if(P.SplashScreen && P.SplashScreen.hide) setTimeout(()=>P.SplashScreen.hide(), 250);
      // stop audio when the app is backgrounded
      if(P.App && P.App.addListener){
        P.App.addListener("appStateChange", st=>{ if(st && st.isActive===false) Audio.stop(); });
      }
    }catch(e){}
  })();

  /* ---------------- UPDATE AVAILABLE (App Store) ----------------
     Asks Apple's public iTunes lookup for the live App Store version
     (via JSONP so it works cross-origin inside the WKWebView). When a
     newer version has been published, shows a banner that opens this
     app's App Store page so the user can tap Update. Sends no user
     data and fails silently when offline. iOS only. */
  const UpdateCheck = (function(){
    const BUNDLE_ID = "com.rorycorn.soundandthebody";
    const APP_VERSION = "1.0.0"; // fallback for web preview; native uses App.getInfo()
    const DISMISS_KEY = "satb_update_dismissed";

    function toParts(v){ return String(v||"0").split(".").map(n=>parseInt(n,10)||0); }
    function isNewer(store,cur){
      const a=toParts(store), b=toParts(cur), n=Math.max(a.length,b.length);
      for(let i=0;i<n;i++){ const d=(a[i]||0)-(b[i]||0); if(d) return d>0; }
      return false;
    }
    async function currentVersion(){
      try{ if(CapPlugins.App && CapPlugins.App.getInfo){ const info=await CapPlugins.App.getInfo(); if(info && info.version) return info.version; } }catch(e){}
      return APP_VERSION;
    }
    function lookup(cb){
      const name="__satbUpd"+Date.now();
      const s=document.createElement("script");
      let done=false;
      const finish=data=>{ if(done) return; done=true; try{ delete window[name]; }catch(e){ window[name]=undefined; } if(s.parentNode) s.parentNode.removeChild(s); cb(data); };
      window[name]=finish;
      s.onerror=()=>finish(null);
      setTimeout(()=>finish(null), 6000);
      s.src="https://itunes.apple.com/lookup?bundleId="+encodeURIComponent(BUNDLE_ID)+"&callback="+name;
      document.head.appendChild(s);
    }
    function openStore(url){ try{ window.open(url,"_system"); }catch(e){ try{ location.href=url; }catch(e2){} } }
    function show(url,version){
      const b=el("updateBanner"); if(!b) return;
      b.hidden=false;
      el("updateBtn").onclick=()=>{ haptic("light"); if(url) openStore(url); };
      el("updateClose").onclick=()=>{ b.classList.add("leaving"); setTimeout(()=>{ b.hidden=true; b.classList.remove("leaving"); },250); try{ localStorage.setItem(DISMISS_KEY,version); }catch(e){} };
    }
    async function check(){
      const plat=(Cap && Cap.getPlatform && Cap.getPlatform())||"web";
      if(plat!=="ios") return; // only prompt inside the installed iOS app
      const cur=await currentVersion();
      lookup(data=>{
        const app=data && data.results && data.results[0];
        if(!app || !app.version) return;                 // not live yet / no result
        if(!isNewer(app.version,cur)) return;            // already up to date
        try{ if(localStorage.getItem(DISMISS_KEY)===app.version) return; }catch(e){} // dismissed this version
        const url=app.trackViewUrl || (app.trackId ? "https://apps.apple.com/app/id"+app.trackId : null);
        show(url, app.version);
      });
    }
    return { check:check, _show:show };
  })();

  // init
  state.dim = loadDim();
  setView("brain");
  UpdateCheck.check();
})();
