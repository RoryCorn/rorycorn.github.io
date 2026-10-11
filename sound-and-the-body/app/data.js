/* =====================================================================
   FREQUENCY ATLAS — DATA
   Every region carries two frequency "systems":
     science     -> measured EEG bands (Hz) + audible reference tones
     traditional -> Solfeggio / chakra / note tones (belief-based)
   `freq` is the tone (Hz) actually played by the oscillator.
   ===================================================================== */

/* ---- Brainwave bands (real neuroscience) ---- */
const WAVE_BANDS = [
  { key:"delta", name:"Delta", range:"0.5 – 4 Hz",  play:2,  color:"#4d6bff",
    state:"Deep dreamless sleep, healing",
    role:"The slowest, highest-amplitude rhythm. Dominant in stage 3–4 deep sleep and tied to restorative processes and immune function.",
    note:"Played here at 2 Hz — below hearing, so you hear a pulsing rather than a pitch." },
  { key:"theta", name:"Theta", range:"4 – 8 Hz",    play:6,  color:"#7c5cff",
    state:"Drowsiness, meditation, memory",
    role:"Appears at the edge of sleep, in deep meditation, and during memory encoding in the hippocampus.",
    note:"6 Hz — still sub-audible; felt as a flutter." },
  { key:"alpha", name:"Alpha", range:"8 – 12 Hz",   play:10, color:"#28d3c7",
    state:"Relaxed, calm, eyes closed",
    role:"The 'idle' rhythm of a relaxed, wakeful brain — strongest over the occipital lobe when the eyes close.",
    note:"10 Hz — a low pulse." },
  { key:"beta",  name:"Beta",  range:"12 – 30 Hz",  play:20, color:"#f5a623",
    state:"Alert, focused, thinking",
    role:"Fast, low-amplitude activity of active concentration, problem-solving and normal waking cognition.",
    note:"20 Hz — the lowest tone most people can just hear." },
  { key:"gamma", name:"Gamma", range:"30 – 100 Hz", play:40, color:"#ff5c8a",
    state:"Peak focus, binding, insight",
    role:"The fastest band, linked to high-level information processing and the 'binding' of perception into a unified experience.",
    note:"40 Hz — an audible low hum; the '40 Hz' band studied in memory research." }
];

/* ---- BRAIN regions ----
   x,y are percentages on the SVG viewBox (0..100). ---- */
const BRAIN = {
  viewBox:"0 0 100 56",
  regions:[
    { id:"prefrontal", label:"Prefrontal Cortex", x:29, y:20, band:"beta",
      role:"Executive control: planning, decision-making, personality and impulse regulation.",
      science:{ freq:20, tag:"Beta 12–30 Hz", note:"Engaged during focused thought." },
      traditional:{ freq:963, tag:"Solfeggio 963 Hz", note:"Called the 'crown' tone; associated in tradition with higher awareness." } },

    { id:"frontal", label:"Frontal Lobe", x:33, y:13.5, band:"beta",
      role:"Voluntary movement, speech production (Broca's area), reasoning and working memory.",
      science:{ freq:18, tag:"Beta ~18 Hz", note:"Active during deliberate reasoning." },
      traditional:{ freq:852, tag:"Solfeggio 852 Hz", note:"Traditionally linked to intuition and 'returning to spirit'." } },

    { id:"parietal", label:"Parietal Lobe", x:53, y:7, band:"alpha",
      role:"Integrates touch, temperature, spatial awareness and body position (the sense of where you are).",
      science:{ freq:10, tag:"Alpha 8–12 Hz", note:"Sensory idling rhythm." },
      traditional:{ freq:741, tag:"Solfeggio 741 Hz", note:"Said to aid 'expression and solutions'." } },

    { id:"occipital", label:"Occipital Lobe", x:71, y:19, band:"alpha",
      role:"The visual cortex — processes everything you see: shape, color, motion.",
      science:{ freq:10, tag:"Alpha (occipital)", note:"Alpha waves surge here when the eyes close." },
      traditional:{ freq:639, tag:"Solfeggio 639 Hz", note:"Associated with connection and relationships." } },

    { id:"temporal", label:"Temporal Lobe", x:66, y:32, band:"theta",
      role:"Hearing, language comprehension (Wernicke's area), and memory formation.",
      science:{ freq:6, tag:"Theta 4–8 Hz", note:"Prominent during memory encoding." },
      traditional:{ freq:528, tag:"Solfeggio 528 Hz", note:"The famous 'transformation / DNA repair' tone (unverified)." } },

    { id:"hippocampus", label:"Hippocampus", x:60, y:27.5, band:"theta",
      role:"Converts short-term experience into long-term memory and supports spatial navigation.",
      science:{ freq:6, tag:"Theta rhythm", note:"Theta oscillation here is central to learning." },
      traditional:{ freq:528, tag:"Solfeggio 528 Hz", note:"Belief-based 'repair' tone." } },

    { id:"amygdala", label:"Amygdala", x:54, y:30, band:"theta",
      role:"The brain's threat detector — drives fear, emotional salience and fight-or-flight.",
      science:{ freq:5, tag:"Theta / limbic", note:"Emotional processing rides on slow rhythms." },
      traditional:{ freq:396, tag:"Solfeggio 396 Hz", note:"Traditionally 'liberating from fear and guilt'." } },

    { id:"thalamus", label:"Thalamus", x:49, y:22.5, band:"alpha",
      role:"The central relay station: nearly all sensory signals pass through here before reaching the cortex.",
      science:{ freq:10, tag:"Alpha pacemaker", note:"Helps generate cortical alpha rhythm." },
      traditional:{ freq:432, tag:"432 Hz tuning", note:"An alternative concert pitch some call more 'natural'." } },

    { id:"pineal", label:"Pineal Gland", x:56, y:23.5, band:"delta",
      role:"Secretes melatonin and regulates the sleep–wake cycle in response to light.",
      science:{ freq:3, tag:"Delta 0.5–4 Hz", note:"Melatonin peaks during delta-rich deep sleep." },
      traditional:{ freq:963, tag:"Solfeggio 963 Hz", note:"Mystically dubbed the 'third eye' activation tone." } },

    { id:"cerebellum", label:"Cerebellum", x:61, y:35, band:"gamma",
      role:"Coordination, balance, timing and the smoothing of movement and posture.",
      science:{ freq:40, tag:"Gamma ~40 Hz", note:"Fine motor timing involves fast oscillations." },
      traditional:{ freq:174, tag:"Solfeggio 174 Hz", note:"Lowest Solfeggio tone; tradition ties it to physical grounding." } },

    { id:"brainstem", label:"Brainstem", x:50, y:44, band:"delta",
      role:"Controls the automatic essentials — breathing, heartbeat, blood pressure and arousal.",
      science:{ freq:2, tag:"Delta / autonomic", note:"Governs the slow background of life support." },
      traditional:{ freq:285, tag:"Solfeggio 285 Hz", note:"Said to influence tissue and 'field' repair." } },

    { id:"motor", label:"Motor Cortex", x:44, y:6.5, band:"beta",
      role:"A strip along the top of the frontal lobe that sends commands to voluntary muscles; the body maps onto it as the 'motor homunculus'.",
      science:{ freq:19, tag:"Beta ~19 Hz", note:"Fires as you plan and execute movement." },
      traditional:{ freq:741, tag:"Solfeggio 741 Hz", note:"Traditionally tied to action and expression." } },

    { id:"broca", label:"Broca's Area", x:33, y:25, band:"beta",
      role:"Usually in the left frontal lobe; produces fluent, grammatical speech. Damage here makes language halting and effortful.",
      science:{ freq:18, tag:"Beta ~18 Hz", note:"Active while forming words and sentences." },
      traditional:{ freq:741, tag:"Solfeggio 741 Hz", note:"Associated with self-expression." } },

    { id:"wernicke", label:"Wernicke's Area", x:66, y:25, band:"theta",
      role:"In the temporal lobe; comprehends language. Damage produces fluent but meaningless speech.",
      science:{ freq:6, tag:"Theta ~6 Hz", note:"Engaged in understanding words and meaning." },
      traditional:{ freq:639, tag:"Solfeggio 639 Hz", note:"Tied to communication and connection." } },

    { id:"hypothalamus", label:"Hypothalamus", x:42, y:27.5, band:"delta",
      role:"Tiny control hub for hunger, thirst, temperature and hormones — the bridge between the nervous and endocrine systems.",
      science:{ freq:3, tag:"Delta / autonomic", note:"Runs slow homeostatic rhythms." },
      traditional:{ freq:432, tag:"432 Hz tuning", note:"An alternative 'natural' tuning." } },

    { id:"pituitary", label:"Pituitary Gland", x:37, y:32.5, band:"delta",
      role:"The 'master gland' hanging below the hypothalamus; releases hormones that control growth, metabolism and other glands.",
      science:{ freq:3, tag:"Delta 0.5–4 Hz", note:"Endocrine cycles run on very slow rhythms." },
      traditional:{ freq:852, tag:"Solfeggio 852 Hz", note:"Esoterically tied to the 'third eye'." } },

    { id:"pons", label:"Pons", x:47, y:34, band:"delta",
      role:"Part of the brainstem that relays signals between cortex and cerebellum and helps regulate sleep and breathing.",
      science:{ freq:2, tag:"Delta / autonomic", note:"Involved in sleep and respiration." },
      traditional:{ freq:174, tag:"Solfeggio 174 Hz", note:"Low grounding tone." } }
  ]
};

/* ---- BODY points (chakra + organ map) ---- */
const BODY = {
  viewBox:"0 0 100 150",
  regions:[
    { id:"crown", label:"Crown / Brain", x:50, y:5, band:"gamma",
      role:"Head and central nervous system — awareness, cognition and the top of the energy system in tradition.",
      science:{ freq:40, tag:"Gamma 40 Hz", note:"Fast cortical rhythm of peak attention." },
      traditional:{ freq:963, tag:"963 Hz · Crown chakra", note:"Note B; 'Sahasrara', linked to consciousness." } },

    { id:"thirdeye", label:"Third Eye / Forehead", x:50, y:10, band:"alpha",
      role:"Forehead, eyes and pituitary region — perception and focus.",
      science:{ freq:10, tag:"Alpha 10 Hz", note:"Relaxed visual attention." },
      traditional:{ freq:852, tag:"852 Hz · Third-eye chakra", note:"Note A; 'Ajna', intuition." } },

    { id:"throat", label:"Throat", x:50, y:19, band:"beta",
      role:"Larynx, thyroid and voice — communication and expression.",
      science:{ freq:16, tag:"Beta 16 Hz", note:"Active during speech and articulation." },
      traditional:{ freq:741, tag:"741 Hz · Throat chakra", note:"Note G; 'Vishuddha', self-expression." } },

    { id:"heart", label:"Heart &amp; Lungs", x:50, y:33, band:"alpha",
      role:"Cardiovascular and respiratory core — circulation, breath, and emotional 'center' in tradition.",
      science:{ freq:1.2, tag:"~1.2 Hz heart rhythm", note:"~72 bpm resting heartbeat = ~1.2 Hz." },
      traditional:{ freq:639, tag:"639 Hz · Heart chakra", note:"Note F; 'Anahata', love and connection." } },

    { id:"solar", label:"Solar Plexus", x:50, y:48, band:"beta",
      role:"Stomach, liver, pancreas — digestion and, traditionally, willpower and confidence.",
      science:{ freq:14, tag:"Beta 14 Hz", note:"Alert, active-state band." },
      traditional:{ freq:528, tag:"528 Hz · Solar-plexus chakra", note:"Note E; 'Manipura', personal power." } },

    { id:"sacral", label:"Sacral / Lower Abdomen", x:50, y:60, band:"theta",
      role:"Reproductive and lower-digestive organs — creativity and emotion in tradition.",
      science:{ freq:7, tag:"Theta 7 Hz", note:"Calm, inward, creative flow states." },
      traditional:{ freq:417, tag:"417 Hz · Sacral chakra", note:"Note D; 'Svadhisthana', change and creativity." } },

    { id:"root", label:"Root / Base", x:50, y:70, band:"delta",
      role:"Base of the spine, legs and adrenals — grounding, stability and survival.",
      science:{ freq:3, tag:"Delta 3 Hz", note:"Slow, stabilizing, deep-rest rhythm." },
      traditional:{ freq:396, tag:"396 Hz · Root chakra", note:"Note C; 'Muladhara', safety and grounding." } },

    { id:"hands", label:"Hands &amp; Arms", x:13, y:78, band:"beta",
      role:"Peripheral motor control and touch — fine manipulation and sensation.",
      science:{ freq:22, tag:"Beta 22 Hz", note:"Motor cortex activity during movement." },
      traditional:{ freq:174, tag:"174 Hz", note:"Tradition ties low tones to physical grounding & pain relief." } },

    { id:"legs", label:"Legs &amp; Thighs", x:43, y:93, band:"delta",
      role:"Large muscle groups for locomotion and posture; the powerhouse of standing and walking.",
      science:{ freq:2.5, tag:"Delta 2.5 Hz", note:"Slow rhythms of rest and recovery." },
      traditional:{ freq:285, tag:"285 Hz", note:"Traditionally linked to tissue restoration." } },

    { id:"eyes", label:"Eyes", x:47, y:12, band:"alpha",
      role:"Capture light and send visual data to the brain along the optic nerve.",
      science:{ freq:10, tag:"Alpha 10 Hz", note:"Alpha waves rise the moment the eyes close." },
      traditional:{ freq:852, tag:"852 Hz", note:"Linked in tradition to inner sight." } },

    { id:"wrist", label:"Wrist", x:16, y:70, band:"beta",
      role:"A hinge of eight small carpal bones; a classic pulse-check and acupressure point.",
      science:{ freq:22, tag:"Beta 22 Hz", note:"Motor-cortex activity during hand movement." },
      traditional:{ freq:174, tag:"174 Hz", note:"Traditionally soothing to joints." } },

    { id:"ankle", label:"Ankle", x:42, y:135, band:"delta",
      role:"The joint linking leg and foot, bearing the body's full load with every step.",
      science:{ freq:3, tag:"Delta 3 Hz", note:"Slow recovery-state rhythm." },
      traditional:{ freq:285, tag:"285 Hz", note:"Said to aid tissue and joints." } },

    { id:"feet", label:"Feet", x:44, y:142, band:"delta",
      role:"Foundation of posture and movement; in reflexology, mapped to the whole body.",
      science:{ freq:2.5, tag:"Delta 2.5 Hz", note:"Grounding, restorative rhythm." },
      traditional:{ freq:396, tag:"396 Hz", note:"Root-chakra grounding tone." } }
  ]
};

/* ---- CELL: zoom into a single cell ----
   `real` = the true physical frequency (often far above hearing);
   `freq` = an audible stand-in that is actually played. ---- */
const CELL = {
  viewBox:"0 0 100 56",
  regions:[
    { id:"membrane", label:"Cell Membrane", x:29, y:20, band:null,
      role:"The lipid bilayer wrapping the cell, deciding what passes in and out.",
      science:{ freq:200, tag:"bio-impedance", real:"~10³–10⁶ Hz", note:"Membranes respond to kHz–MHz electric fields (the basis of bio-impedance sensing)." },
      traditional:{ freq:285, tag:"Solfeggio 285 Hz", note:"Claimed to support tissue repair — unproven." } },
    { id:"cytoplasm", label:"Cytoplasm", x:68, y:35, band:null,
      role:"The gel-like fluid filling the cell, where most metabolic reactions happen.",
      science:{ freq:150, tag:"molecular motion", real:"~10¹²–10¹³ Hz", note:"Thermal molecular motion sits in the terahertz range — far above hearing." },
      traditional:{ freq:417, tag:"Solfeggio 417 Hz", note:"Associated with 'change' — unproven." } },
    { id:"nucleus", label:"Nucleus", x:49, y:26, band:null,
      role:"The control center holding the cell's DNA and directing growth and division.",
      science:{ freq:180, tag:"structural resonance", real:"kHz–GHz (studied)", note:"Organelle mechanical resonances span a wide range; a symbolic tone is used." },
      traditional:{ freq:963, tag:"963 Hz", note:"Esoteric 'higher' tone — unproven." } },
    { id:"nucleolus", label:"Nucleolus", x:52, y:22, band:null,
      role:"A dense knot inside the nucleus that manufactures ribosomes.",
      science:{ freq:240, tag:"—", real:"not defined", note:"No characteristic resonance; a symbolic tone is used." },
      traditional:{ freq:528, tag:"528 Hz", note:"Marketed 'transformation' tone — unproven." } },
    { id:"dna", label:"DNA / Chromatin", x:46, y:31, band:null,
      role:"The double-helix molecule encoding all genetic instructions, coiled into chromatin.",
      science:{ freq:264, tag:"THz phonon modes", real:"~0.5–2 THz", note:"DNA has measured vibrational (phonon) modes in the terahertz band — far above hearing." },
      traditional:{ freq:528, tag:"528 Hz 'DNA repair'", note:"Popularly called the DNA-repair frequency — NOT scientifically supported." } },
    { id:"mitochondria", label:"Mitochondria", x:63, y:16, band:null,
      role:"The 'powerhouses' that make ATP, the cell's chemical energy currency.",
      science:{ freq:350, tag:"ATP synthase spin", real:"~100–700 Hz", note:"ATP synthase literally rotates ~100–700 times per second — a real, near-audible biological rhythm." },
      traditional:{ freq:432, tag:"432 Hz", note:"Alternative 'natural' tuning." } },
    { id:"ribosome", label:"Ribosomes", x:38, y:39, band:null,
      role:"Tiny machines that read RNA and assemble amino acids into proteins.",
      science:{ freq:120, tag:"assembly rate", real:"~10 amino acids/s", note:"Ribosomes add roughly 10 amino acids per second — a slow rhythmic process." },
      traditional:{ freq:396, tag:"396 Hz", note:"Grounding tone — unproven." } }
  ]
};

/* ---- ATOM: zoom into an atom & its particles ---- */
const ATOM = {
  viewBox:"0 0 100 56",
  regions:[
    { id:"nucleus", label:"Nucleus", x:50, y:37, band:null,
      role:"The dense core of protons and neutrons that carries almost all the atom's mass.",
      science:{ freq:300, tag:"nuclear gamma", real:"~10¹⁹–10²⁰ Hz", note:"Nuclear energy transitions emit gamma rays — astronomically above hearing." },
      traditional:{ freq:963, tag:"963 Hz", note:"No genuine tradition at this scale; shown only for comparison." } },
    { id:"proton", label:"Proton", x:52, y:17, band:null,
      role:"A positively charged particle in the nucleus; the proton count defines the element.",
      science:{ freq:256, tag:"NMR resonance", real:"42.58 MHz / tesla", note:"Protons resonate at 42.58 MHz per tesla — the real basis of MRI." },
      traditional:{ freq:528, tag:"528 Hz", note:"Speculative only." } },
    { id:"neutron", label:"Neutron", x:44, y:27, band:null,
      role:"A neutral particle that adds mass to the nucleus and helps hold it together.",
      science:{ freq:220, tag:"NMR resonance", real:"29.16 MHz / tesla", note:"The neutron's magnetic moment resonates near 29 MHz per tesla." },
      traditional:{ freq:417, tag:"417 Hz", note:"Speculative only." } },
    { id:"electron", label:"Electron", x:43, y:6, band:null,
      role:"A light, negatively charged particle occupying probability clouds around the nucleus.",
      science:{ freq:280, tag:"atomic transition", real:"~10¹⁵ Hz (visible light)", note:"Electron energy jumps emit visible/UV light near 10¹⁵ Hz." },
      traditional:{ freq:852, tag:"852 Hz", note:"Speculative only." } },
    { id:"shell", label:"Electron Shell", x:78, y:29, band:null,
      role:"The quantized orbital 'levels' electrons are allowed to occupy around the nucleus.",
      science:{ freq:200, tag:"orbital spacing", real:"~10¹⁴–10¹⁵ Hz", note:"Energy-level spacings correspond to infrared–UV light." },
      traditional:{ freq:639, tag:"639 Hz", note:"Speculative only." } },
    { id:"atomwhole", label:"Whole Atom", x:22, y:18, band:null,
      role:"The complete atom — nucleus plus electron cloud — the smallest unit of an element.",
      science:{ freq:220, tag:"cesium clock", real:"9,192,631,770 Hz", note:"A cesium atom's hyperfine transition (9.19 GHz) defines the length of one second." },
      traditional:{ freq:432, tag:"432 Hz", note:"Speculative only." } }
  ]
};

/* ---- ORGANS: major organs, each with its natural physiological rhythm ---- */
const ORGANS = {
  viewBox:"0 0 100 150",
  regions:[
    { id:"brain", label:"Brain", x:50, y:6, band:null,
      role:"The body's control center; runs on measurable electrical rhythms (EEG bands).",
      science:{ freq:10, tag:"Alpha ~10 Hz", note:"Dominant relaxed-wakefulness rhythm." },
      traditional:{ freq:963, tag:"963 Hz", note:"'Crown' tone — unproven." } },
    { id:"thyroid", label:"Thyroid", x:50, y:20, band:null,
      role:"Neck gland that sets metabolic rate via thyroid hormones.",
      science:{ freq:240, tag:"hormonal cycles", real:"cycles over hours", note:"Governed by slow hormonal rhythms, not a fixed frequency; symbolic tone." },
      traditional:{ freq:741, tag:"741 Hz", note:"Throat-region tone — unproven." } },
    { id:"lungs", label:"Lungs", x:39, y:32, band:null,
      role:"Exchange oxygen and carbon dioxide with every breath.",
      science:{ freq:200, tag:"respiration", real:"~0.2–0.3 Hz", note:"Resting breathing is ~12–16 breaths/min (0.2–0.27 Hz); symbolic audible tone." },
      traditional:{ freq:528, tag:"528 Hz", note:"Chest-region tone — unproven." } },
    { id:"heart", label:"Heart", x:51, y:35, band:null,
      role:"Four-chambered pump driving circulation through the whole body.",
      science:{ freq:1.2, tag:"~72 bpm", note:"A resting heartbeat of ~72/min is about 1.2 Hz — played as a pulse." },
      traditional:{ freq:639, tag:"639 Hz", note:"Heart-region tone — unproven." } },
    { id:"liver", label:"Liver", x:43, y:46, band:null,
      role:"The body's chemical plant: filters blood, stores energy, makes bile.",
      science:{ freq:210, tag:"metabolic", real:"no set rhythm", note:"Continuous metabolic organ with no characteristic frequency; symbolic tone." },
      traditional:{ freq:528, tag:"528 Hz", note:"Unproven organ tone." } },
    { id:"stomach", label:"Stomach", x:54, y:50, band:null,
      role:"Muscular sac that mixes and acid-digests food.",
      science:{ freq:180, tag:"gastric slow wave", real:"~0.05 Hz (3/min)", note:"A gastric pacemaker fires ~3 slow waves per minute (0.05 Hz); symbolic audible tone." },
      traditional:{ freq:528, tag:"528 Hz", note:"Unproven organ tone." } },
    { id:"spleen", label:"Spleen", x:59, y:46, band:null,
      role:"Filters blood and supports the immune system.",
      science:{ freq:190, tag:"—", real:"no set rhythm", note:"No characteristic frequency; symbolic tone." },
      traditional:{ freq:417, tag:"417 Hz", note:"Unproven organ tone." } },
    { id:"pancreas", label:"Pancreas", x:50, y:52, band:null,
      role:"Makes digestive enzymes and the blood-sugar hormones insulin and glucagon.",
      science:{ freq:200, tag:"insulin pulses", real:"~1 pulse / 5–10 min", note:"Insulin is released in slow pulses every few minutes; symbolic audible tone." },
      traditional:{ freq:528, tag:"528 Hz", note:"Unproven organ tone." } },
    { id:"kidneys", label:"Kidneys", x:42, y:56, band:null,
      role:"Filter waste from blood, balance fluids, and regulate blood pressure.",
      science:{ freq:220, tag:"vasomotion", real:"~0.1 Hz", note:"Kidney blood vessels show ~0.1 Hz vasomotion oscillations; symbolic audible tone." },
      traditional:{ freq:396, tag:"396 Hz", note:"Unproven organ tone." } },
    { id:"largeintestine", label:"Large Intestine", x:45, y:64, band:null,
      role:"Absorbs water and forms waste; home to the gut microbiome.",
      science:{ freq:140, tag:"colonic slow wave", real:"~0.03 Hz", note:"Colonic slow waves are very slow (~2/min); symbolic audible tone." },
      traditional:{ freq:396, tag:"396 Hz", note:"Unproven organ tone." } },
    { id:"smallintestine", label:"Small Intestine", x:52, y:60, band:null,
      role:"Where most nutrients are absorbed into the bloodstream.",
      science:{ freq:160, tag:"segmentation", real:"~0.18 Hz (11/min)", note:"Duodenal slow waves cycle ~11/min (0.18 Hz); symbolic audible tone." },
      traditional:{ freq:417, tag:"417 Hz", note:"Unproven organ tone." } },
    { id:"bladder", label:"Bladder", x:50, y:71, band:null,
      role:"Stores urine until release; a stretchable muscular reservoir.",
      science:{ freq:150, tag:"filling cycle", real:"fills over hours", note:"Fills slowly then empties; no fixed frequency; symbolic tone." },
      traditional:{ freq:396, tag:"396 Hz", note:"Unproven organ tone." } },
    { id:"lymph", label:"Lymph Nodes", x:44, y:75, band:null,
      role:"Filter lymph and stage the immune response — where white blood cells meet what the body has caught. Clustered densely in the groin, armpits and neck.",
      science:{ freq:180, tag:"lymphangion pulse", real:"~0.1–0.5 Hz", note:"Lymph vessels squeeze themselves, roughly 6–30 times a minute, to push lymph along. Far below hearing, so this tone is symbolic." },
      traditional:{ freq:741, tag:"741 Hz", note:"Claimed for cleansing. Unproven." } },
    { id:"skin", label:"Skin", x:66, y:48, band:null,
      role:"The body's largest organ: barrier, thermostat, and the sensory surface that reads touch, pressure and vibration.",
      science:{ freq:250, tag:"Pacinian peak", real:"~200–300 Hz", note:"Unusually direct: Pacinian corpuscles deep in the skin are most sensitive to vibration near 250 Hz, so this tone is close to what skin is physically tuned to feel. Meissner corpuscles handle flutter nearer 10–50 Hz." },
      traditional:{ freq:285, tag:"285 Hz", note:"Claimed for tissue repair. Unproven." } }
  ]
};

/* ---- NERVES: nervous system, incl. the vagus nerve ----
   Note: the vagus is genuinely stimulated at ~20–30 Hz in FDA-approved
   VNS therapy, so that frequency is real and playable. ---- */
const NERVES = {
  viewBox:"0 0 100 150",
  regions:[
    { id:"cns", label:"Brain / CNS", x:50, y:6, band:null,
      role:"The central nervous system — brain and spinal cord — the body's processing core.",
      science:{ freq:40, tag:"Gamma 40 Hz", note:"Fast cortical rhythm of active processing." },
      traditional:{ freq:963, tag:"963 Hz", note:"'Crown' tone — unproven." } },
    { id:"vagus", label:"Vagus Nerve", x:48, y:27, band:null,
      role:"The longest cranial nerve — the main 'rest-and-digest' (parasympathetic) pathway. It wanders from the brainstem to the heart, lungs and gut, slowing heart rate and driving digestion. High vagal tone tracks with calm and good heart-rate variability.",
      science:{ freq:25, tag:"clinical VNS 20–30 Hz", real:"20–30 Hz (VNS therapy)", note:"FDA-approved vagus-nerve stimulators pulse at ~20–30 Hz to treat epilepsy and depression — a real, measurable frequency." },
      traditional:{ freq:528, tag:"528 Hz", note:"Popularly linked to relaxation — unproven." } },
    { id:"spinalcord", label:"Spinal Cord", x:50, y:45, band:null,
      role:"The main signal cable relaying information between brain and body and driving reflexes.",
      science:{ freq:30, tag:"neural firing", real:"1–1000 Hz spikes", note:"Neurons fire action potentials from ~1 up to ~1000 times per second; symbolic tone." },
      traditional:{ freq:396, tag:"396 Hz", note:"Unproven." } },
    { id:"sympathetic", label:"Sympathetic Chain", x:47, y:54, band:null,
      role:"The 'fight-or-flight' nerve network that speeds the heart and readies the body for action.",
      science:{ freq:12, tag:"Mayer waves ~0.1 Hz", real:"~0.1 Hz rhythm", note:"Sympathetic activity shows a ~0.1 Hz blood-pressure rhythm (Mayer waves); played as an audible stand-in." },
      traditional:{ freq:417, tag:"417 Hz", note:"Unproven." } },
    { id:"optic", label:"Optic Nerve", x:47, y:11, band:null,
      role:"Carries visual information from the retina to the brain.",
      science:{ freq:40, tag:"visual spikes", real:"up to ~1000 Hz", note:"Retinal ganglion cells fire rapid spike trains; symbolic tone." },
      traditional:{ freq:852, tag:"852 Hz", note:"Unproven." } },
    { id:"cranial", label:"Cranial Nerves", x:53, y:15, band:null,
      role:"Twelve pairs of nerves serving the head and face — smell, sight, taste, movement and more.",
      science:{ freq:30, tag:"mixed firing", real:"1–500 Hz", note:"Carry varied sensory and motor signals; symbolic tone." },
      traditional:{ freq:741, tag:"741 Hz", note:"Unproven." } },
    { id:"median", label:"Median Nerve (arm)", x:20, y:68, band:null,
      role:"A major arm nerve controlling the hand; pinched at the wrist in carpal tunnel syndrome.",
      science:{ freq:22, tag:"motor firing", real:"~10–50 Hz bursts", note:"Fires in bursts as you move the hand; symbolic tone / pulse." },
      traditional:{ freq:174, tag:"174 Hz", note:"Unproven." } },
    { id:"sciatic", label:"Sciatic Nerve (leg)", x:55, y:90, band:null,
      role:"The body's largest and longest nerve, running from the lower back down each leg.",
      science:{ freq:20, tag:"motor firing", real:"conduction ~120 m/s", note:"Large fast-conducting nerve; firing rendered as an audible pulse." },
      traditional:{ freq:285, tag:"285 Hz", note:"Unproven." } },
    { id:"sacralplexus", label:"Sacral Plexus", x:50, y:71, band:null,
      role:"A network of nerves at the base of the spine serving the pelvis and legs.",
      science:{ freq:15, tag:"neural firing", real:"1–100 Hz", note:"Bundled nerve roots; symbolic pulse." },
      traditional:{ freq:396, tag:"396 Hz", note:"Unproven." } },
    { id:"enteric", label:"Enteric System (gut)", x:52, y:61, band:null,
      role:"The gut's own 'second brain' — ~500 million neurons coordinating digestion largely on their own.",
      science:{ freq:160, tag:"slow waves", real:"~0.05–0.2 Hz", note:"Drives the slow rhythmic contractions of the gut; symbolic audible tone." },
      traditional:{ freq:417, tag:"417 Hz", note:"Unproven." } }
  ]
};

/* ---- MUSCLES ----
   Skeletal muscle does have a genuine electrical rhythm: motor units fire in
   the 8–50 Hz range, which is what an EMG records. That range is the same
   everywhere in the body, so the honest difference between these regions is
   posture vs. power, not a different "frequency per body part".
   The audible tones below are symbolic stand-ins, as elsewhere in the atlas.
   Nothing here relaxes a muscle: a tone from a speaker does not reach tissue. ---- */
const MUSCLES = {
  viewBox:"0 0 100 150",
  regions:[
    { id:"m-neck", label:"Neck &amp; Upper Trapezius", x:50, y:23, band:null,
      role:"Holds the head up all day — roughly 5 kg balanced on the spine. A common site of tension because these fibres almost never fully switch off.",
      science:{ freq:120, tag:"tonic firing", real:"~10–20 Hz sustained", note:"Postural muscle: low, steady motor-unit firing held for hours rather than short bursts." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } },
    { id:"m-shoulders", label:"Shoulders (Deltoids)", x:34, y:31, band:null,
      role:"Lift and rotate the arm through the widest range of any joint in the body.",
      science:{ freq:130, tag:"motor units", real:"~8–50 Hz", note:"Firing rate climbs with effort — more force is partly more motor units, partly faster firing." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } },
    { id:"m-chest", label:"Chest (Pectorals)", x:44, y:36, band:null,
      role:"Draws the arm across the body; the main pushing muscle.",
      science:{ freq:110, tag:"motor units", real:"~8–50 Hz", note:"Large fast-twitch population; recruited late and fires high when it does." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } },
    { id:"m-back", label:"Back (Erector Spinae &amp; Lats)", x:62, y:44, band:null,
      role:"The column of muscle either side of the spine that keeps you upright, plus the broad sheet that pulls the arm down and back.",
      science:{ freq:100, tag:"tonic firing", real:"~10–20 Hz sustained", note:"Like the neck, these are endurance fibres firing steadily all day rather than in bursts." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } },
    { id:"m-arms", label:"Arms (Biceps &amp; Triceps)", x:26, y:45, band:null,
      role:"Bend and straighten the elbow; among the most finely controlled muscles in the body.",
      science:{ freq:140, tag:"motor units", real:"~8–50 Hz", note:"Fine control comes from small motor units — few fibres each, so force can be graded precisely." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } },
    { id:"m-core", label:"Core (Abdominals)", x:50, y:52, band:null,
      role:"Wraps the trunk and stabilises the spine before almost every other movement begins.",
      science:{ freq:115, tag:"anticipatory firing", real:"~8–50 Hz", note:"Deep core fires a fraction of a second BEFORE you move a limb — bracing in advance." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } },
    { id:"m-glutes", label:"Glutes &amp; Hips", x:50, y:74, band:null,
      role:"The largest muscle in the body; drives standing, climbing and every step forward.",
      science:{ freq:95, tag:"motor units", real:"~8–50 Hz", note:"Very large motor units — a single nerve can command hundreds of fibres at once." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } },
    { id:"m-thighs", label:"Thighs (Quads &amp; Hamstrings)", x:42, y:95, band:null,
      role:"Extend and flex the knee; the engine of walking, running and standing up.",
      science:{ freq:90, tag:"motor units", real:"~8–50 Hz", note:"Mixed fibre types: slow fibres for standing, fast fibres for sprinting, recruited in that order." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } },
    { id:"m-calves", label:"Calves", x:42, y:118, band:null,
      role:"Push off at every step and pump blood back up the leg — the 'second heart'.",
      science:{ freq:105, tag:"tonic firing", real:"~10–20 Hz sustained", note:"Postural endurance muscle; also squeezes deep veins to help return blood to the heart." },
      traditional:{ freq:174, tag:"174 Hz", note:"Claimed for tension and pain. Unproven." } }
  ]
};

/* ---- Harmony: the tetractys (1,2,3,4) and the ratios it generates ----
   The one view that is not anatomy. Nothing here is a body part, so the
   `science` column carries what is physically true about ratio and the
   harmonic series, and `traditional` carries the modern "divine frequency"
   claims. Science tones are built from 256 Hz (2^8, chosen for arithmetic
   tidiness); traditional tones apply the SAME ratios to 432 Hz, the claimed
   "natural" tuning — so switching systems retunes the figure without
   changing a single interval. That is the lesson of the view. */
const HARMONY = {
  viewBox:"0 0 100 100",
  regions:[
    { id:"monad", label:"The Monad", x:50, y:50, band:null,
      role:"The One — the Pythagorean unit from which number proceeds, and so ratio, and so music. It is not a pitch but a relationship: a tone sounded against itself is unison, perfect identity, nothing to divide. Everything outward from here is the One becoming many.",
      science:{ freq:256, tag:"1 : 1 — unison", note:"There is no measured 'monad frequency' — the Monad is a philosophical unit, not a physical resonator, so no instrument can be pointed at it. What IS measurable is the ratio. Two tones at exactly 1:1 produce no beating; detune one by a single hertz and you hear one beat per second. That null is real and checkable. The 256 Hz used here is arbitrary — it is 2 to the 8th, picked for tidy arithmetic — and its arbitrariness is the point: the Monad is whatever tone you choose, heard against itself." },
      traditional:{ freq:963, tag:"the 'frequency of the gods'", note:"Called the 'frequency of the gods' and tied to the crown in the extended nine-tone Solfeggio set — an addition to a scheme that was itself invented in the 20th century and popularised from the 1970s on. 432 Hz is the other common claim to a 'divine' or 'universal' tuning. Neither appears in Pythagorean or Gnostic sources, and neither has evidence behind the healing claims. Unproven." } },

    { id:"octave", label:"Octave", x:50, y:34, band:null,
      role:"The first step away from the One that is still the One. Double the frequency and the note returns to itself an order higher — the same letter, a different level.",
      science:{ freq:512, tag:"2 : 1 — octave", note:"Not a convention but a consequence: the second harmonic of a vibrating string sits at exactly twice the fundamental, so the octave is already sounding inside a single plucked note before anyone names it. Octave equivalence is close to universal across musical cultures because the physics arrives first and the culture agrees afterwards." },
      traditional:{ freq:864, tag:"2 : 1 from A=432", note:"The same 2:1, taken from 432 Hz rather than 256 Hz. Esoteric writing reads the octave as 'as above, so below' — the identical thing repeating on a higher plane. The ratio is real; the cosmology attached to it is not evidence." } },

    { id:"fifth", label:"Perfect Fifth", x:72.7, y:60.6, band:null,
      role:"The first genuinely new interval — the simplest relationship that is not merely the same note again. Stack it twelve times and you very nearly return to where you started, which is the whole architecture of Western tuning.",
      science:{ freq:384, tag:"3 : 2 — fifth", note:"The third harmonic set against the second. After the octave it is the simplest possible ratio, and the most stable interval that actually goes somewhere. Pythagorean tuning is built by stacking it; so is the circle of fifths. It does not quite close — twelve fifths overshoot seven octaves by about a quarter of a semitone, the Pythagorean comma — and every tuning system since is a different compromise with that gap." },
      traditional:{ freq:648, tag:"3 : 2 from A=432", note:"The same 3:2, from 432 Hz. Kepler assigned intervals like this one to planetary orbits in Harmonices Mundi (1619) — the 'music of the spheres' as an actual claim about the solar system. The ratio holds; the astronomy did not." } },

    { id:"fourth", label:"Perfect Fourth", x:22.8, y:62.7, band:null,
      role:"What is left of the octave once the fifth is taken out of it. Simple by number, and yet the interval that music theory has argued about longest.",
      science:{ freq:341.33, tag:"4 : 3 — fourth", note:"The octave divided by the fifth: 2/1 ÷ 3/2 = 4/3. Simple enough by ratio to be consonant, and it completes the tetractys — 1, 2, 3, 4 generating unison, octave, fifth and fourth between them. Yet medieval theorists frequently classed the fourth as a dissonance when it stood above the bass, which is a useful correction to any tidy story: consonance is partly physics and partly what an ear has been trained to expect." },
      traditional:{ freq:576, tag:"4 : 3 from A=432", note:"The same 4:3, from 432 Hz. The tetractys was held sacred by the Pythagoreans — they are said to have sworn oaths on it — and that much is genuinely ancient. The assignment of specific healing frequencies to it is not." } }
  ]
};

/* =====================================================================
   SOURCES — citations for the measured figures shown in this atlas.
   Required by App Store Review Guideline 1.4.1: health information must
   carry citations the user can actually find. Every URL below was checked
   before it shipped. The full citation text is rendered on screen, so the
   citation stands even where a device cannot open the link.
   ===================================================================== */
const SOURCES = {
  eeg: {
    cite: "Normal EEG Waveforms. StatPearls, NCBI Bookshelf, U.S. National Library of Medicine.",
    url:  "https://www.ncbi.nlm.nih.gov/books/NBK539805/" },
  gamma40: {
    cite: "Iaccarino HF et al. Gamma frequency entrainment attenuates amyloid load and modifies microglia. Nature. 2016;540(7632):230-235.",
    url:  "https://pubmed.ncbi.nlm.nih.gov/27929004/" },
  sleep: {
    cite: "Healthy Sleep. MedlinePlus, U.S. National Library of Medicine.",
    url:  "https://medlineplus.gov/healthysleep.html" },
  vitals: {
    cite: "Vital Signs. MedlinePlus, U.S. National Library of Medicine.",
    url:  "https://medlineplus.gov/vitalsigns.html" },
  anatomy: {
    cite: "Anatomy. MedlinePlus, U.S. National Library of Medicine.",
    url:  "https://medlineplus.gov/anatomy.html" },
  si: {
    cite: "The International System of Units (SI Brochure) - definition of the second by the caesium-133 hyperfine transition, 9 192 631 770 Hz. Bureau International des Poids et Mesures.",
    url:  "https://www.bipm.org/en/publications/si-brochure" },
  nist: {
    cite: "Fundamental Physical Constants (proton gyromagnetic ratio, the basis of NMR and MRI). National Institute of Standards and Technology.",
    url:  "https://physics.nist.gov/cuu/Constants/" }
};

/* Which sources back the measured figures in each map. */
const VIEW_SOURCES = {
  brain:   ["eeg","gamma40","sleep","anatomy"],
  waves:   ["eeg","gamma40","sleep"],
  body:    ["anatomy","vitals"],
  organs:  ["anatomy","vitals"],
  muscles: ["anatomy"],
  nerves:  ["eeg","anatomy"],
  cell:    ["anatomy","nist"],
  atom:    ["si","nist"],
  harmony: []
};

/* Shown wherever a traditional/belief figure is displayed. There is no
   scientific source to cite for these, and saying so plainly IS the
   honest citation. */
const TRADITION_SOURCE_NOTE =
  "Solfeggio tones, chakra pitches and the \"528 Hz DNA repair\" tone have no scientific source to cite. " +
  "They are traditional and modern-esoteric attributions, not measurements, and no peer-reviewed evidence " +
  "supports the healing effects claimed for them. They are included here as culture, clearly separated from " +
  "the measured figures.";
