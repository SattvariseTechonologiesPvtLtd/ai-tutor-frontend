import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C, LOGO_PATH } from '../shared';

/* ───────────────────────────────────────────────────────────────
   COLLECTIONS — mirrors the Z-Anatomy "Models-of-human-anatomy"
   outliner structure (Blender scene collections).
   `keys` are lower-cased substrings matched against the names of
   the top-level objects/groups found inside entire_model.glb, so
   visibility toggling works even if Z-Anatomy renames things
   slightly between releases.
─────────────────────────────────────────────────────────────── */
const COLLECTIONS = [
  { id: 'skeletal',     label: 'Skeletal system',              keys: ['skelet', 'bone'], color: '#e9e2cf' },
  { id: 'muscins',      label: 'Muscular insertions',          keys: ['insertion'], color: '#9c3b3b' },
  { id: 'joints',       label: 'Joints',                        keys: ['joint'], color: '#d8c9a3' },
  { id: 'muscular',     label: 'Muscular system',               keys: ['muscul', 'muscle'], color: '#a83333' },
  { id: 'cardio',       label: 'Cardiovascular system',         keys: ['cardio', 'vascul', 'heart', 'artery', 'vein'], color: '#b03333' },
  { id: 'lymphoid',     label: 'Lymphoid organs',               keys: ['lymph'], color: '#c8cf66' },
  { id: 'nervous',      label: 'Nervous system & Sense organs', keys: ['nerv', 'sense', 'brain', 'neuro'], color: '#e8c93f' },
  { id: 'visceral',     label: 'Visceral systems',              keys: ['viscer', 'organ'], color: '#8a4d6b' },
  { id: 'regions',      label: 'Regions of human body',         keys: ['region'], color: null },
  { id: 'reflines',     label: 'Reference lines, planes, movements', keys: ['reference', 'plane', 'movement', 'axis'], color: '#3fa9e8' },
  { id: 'crosssection', label: 'Cross section planes',          keys: ['cross section', 'cross_section', 'crosssection'], color: '#3fa9e8' },
];

// Configure VITE_MODEL_URL in your .env (e.g. an S3/CloudFront URL) to load
// the model remotely. Falls back to /public/models/entire_model.glb if unset.
const MODEL_URL = import.meta.env.VITE_MODEL_URL || '/models/entire_model.glb';

// Blender-only viewport helpers (nav labels, gizmos, text signage) that ship inside
// the source .blend but were never meant to render in an app. We hide these by
// default and exclude them from the auto-fit bounding box.
const HELPER_KEYWORDS = ['navigation', 'how to', 'howto', 'gizmo', 'label', 'sign', 'helper', 'empty', 'camera', 'guide_text', 'text', 'title', 'caption', 'heading'];

function isHelperObject(obj) {
  const name = (obj.name || '').toLowerCase();
  return HELPER_KEYWORDS.some(k => name.includes(k));
}

export default function CadavierPage({ onNavigate, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [visibility, setVisibility] = useState(() =>
    Object.fromEntries(COLLECTIONS.map(c => [c.id, !['reflines', 'crosssection'].includes(c.id)]))
  );
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [bgLight, setBgLight] = useState(false);
  const [showHelpers, setShowHelpers] = useState(false);

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const modelRootRef = useRef(null);
  const groupMapRef = useRef({}); // collectionId -> THREE.Object3D[]
  const helperObjectsRef = useRef([]);
  const frameRef = useRef(null);
  const fileInputRef = useRef(null);

  /* ─── three.js bootstrap ─────────────────────────────────── */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgLight ? 0xeef1f5 : 0x0a0a0f);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.01, 100);
    camera.position.set(0, 1.5, 3.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // smooth highlight rolloff so colors don't clip to white
    renderer.toneMappingExposure = 0.85;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.45);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.15);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 20;
    controlsRef.current = controls;

    const grid = new THREE.GridHelper(6, 24, 0x334155, 0x1a1f2e);
    grid.position.y = -0.01;
    scene.add(grid);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.autoRotate = autoRotateRef.current;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameRef.current);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(bgLight ? 0xeef1f5 : 0x0a0a0f);
    }
  }, [bgLight]);

  /* ─── load model (from URL or from a File picked by the user) ─ */
  const loadFromSource = useCallback((source) => {
    setLoading(true);
    setLoadProgress(0);
    setLoadError(null);

    const loader = new GLTFLoader();

    const onDone = (gltf) => {
      const scene = sceneRef.current;
      if (!scene) return;

      if (modelRootRef.current) {
        scene.remove(modelRootRef.current);
        modelRootRef.current = null;
      }

      const root = gltf.scene;
      helperObjectsRef.current = [];

      // Diagnostic: log distinct top-level object names once, so we can see what the
      // giant label/text objects are actually called and target them precisely.
      if (import.meta.env.DEV) {
        const names = new Set();
        root.traverse(obj => { if (obj.name) names.add(obj.name); });
        console.log(`Cadavier: ${names.size} named objects in scene. Sample:`, [...names].slice(0, 80));
      }

      root.traverse(obj => {
        if (isHelperObject(obj)) {
          obj.visible = false; // hide Blender nav text / gizmos by default
          helperObjectsRef.current.push(obj);
          return;
        }
        if (obj.isMesh) {
          obj.castShadow = false;
          obj.receiveShadow = false;
          obj.frustumCulled = false; // avoid thin label/plane meshes popping out at certain angles

          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(mat => {
            if (!mat) return;
            mat.wireframe = wireframe;
            mat.side = THREE.DoubleSide; // label planes & thin organ sheets are often single-sided by default

            // Make sure any baked textures decode as sRGB, otherwise colors look flat/grey
            ['map', 'emissiveMap'].forEach(slot => {
              if (mat[slot]) mat[slot].colorSpace = THREE.SRGBColorSpace;
            });

            // Transparent label/overlay materials need depthWrite off to avoid z-fighting flicker
            if (mat.transparent) {
              mat.depthWrite = false;
              mat.alphaTest = mat.alphaTest || 0.05;
            }

            // Guard against blown-out white specular hotspots from low roughness exports
            if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
              if (mat.roughness < 0.4) mat.roughness = 0.6;
              if (mat.metalness > 0.3) mat.metalness = 0.1;
            }
          });
        }
      });

      // Build the collection -> object map by matching names against COLLECTIONS keys.
      // Do this BEFORE centering/scaling, so we can use ONLY matched anatomy objects
      // (never stray unmatched label/text meshes) as the source of truth for framing.
      const map = Object.fromEntries(COLLECTIONS.map(c => [c.id, []]));
      const unmatched = [];
      root.traverse(obj => {
        if (obj === root) return;
        const name = (obj.name || '').toLowerCase();
        if (!name) return;
        let matched = false;
        for (const col of COLLECTIONS) {
          if (col.keys.some(k => name.includes(k))) {
            map[col.id].push(obj);
            matched = true;
            break;
          }
        }
        if (!matched && obj.isMesh) unmatched.push(obj);
      });
      groupMapRef.current = map;
      if (unmatched.length) {
        console.info(`Cadavier: ${unmatched.length} mesh(es) didn't match a known collection name — toggles for those won't apply.`);
      }

      // Tint flat color per system — the source GLB's materials don't carry real
      // per-system color (likely an outliner "object color" tag that never made it
      // into the glTF export), so we fake it on the front end as a workaround.
      const VEIN_COLOR = new THREE.Color('#3066b0');
      for (const col of COLLECTIONS) {
        if (!col.color) continue;
        const baseColor = new THREE.Color(col.color);
        (map[col.id] || []).forEach(obj => {
          const isVein = (obj.name || '').toLowerCase().includes('ven');
          const tint = (col.id === 'cardio' && isVein) ? VEIN_COLOR : baseColor;
          obj.traverse(node => {
            if (!node.isMesh || !node.material) return;
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(mat => { if (mat && mat.color) mat.color.copy(tint); });
          });
        });
      }

      // Re-center & scale using ONLY matched anatomy meshes (skeletal, muscular, etc.) —
      // excluding reference-lines/cross-section (often huge flat planes) and anything
      // unmatched (stray label text), so framing can't be skewed by leftover signage.
      const FRAMING_COLLECTIONS = COLLECTIONS.filter(c => c.id !== 'reflines' && c.id !== 'crosssection').map(c => c.id);
      const box = new THREE.Box3();
      let hasBox = false;
      FRAMING_COLLECTIONS.forEach(id => {
        (map[id] || []).forEach(obj => {
          if (obj.isMesh || obj.children?.length) {
            box.expandByObject(obj);
            hasBox = true;
          }
        });
      });
      if (!hasBox) root.traverse(obj => { if (obj.isMesh && obj.visible) { box.expandByObject(obj); hasBox = true; } });
      if (!hasBox) box.setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 1.7 / maxDim;
      root.scale.setScalar(scale);
      root.position.sub(center.multiplyScalar(scale));

      scene.add(root);
      modelRootRef.current = root;

      // apply current visibility state
      applyVisibility(visibilityRef.current);

      if (cameraRef.current && controlsRef.current) {
        // Root is already recentered so the matched-anatomy bounding box sits at the
        // world origin — so framing is just "look at the origin, back up enough to fit
        // the full height in view." No magic offsets needed.
        const fittedHeight = size.y * scale;
        const fov = cameraRef.current.fov * (Math.PI / 180);
        const distance = (fittedHeight / 2 / Math.tan(fov / 2)) * 1.25; // small margin so the body isn't edge-to-edge
        cameraRef.current.position.set(0, 0, distance);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
        homeCameraRef.current = {
          position: cameraRef.current.position.clone(),
          target: controlsRef.current.target.clone(),
        };
      }

      setLoading(false);
    };

    const onProgress = (e) => {
      if (e.lengthComputable) setLoadProgress(Math.round((e.loaded / e.total) * 100));
    };

    const onError = (err) => {
      console.error(err);
      setLoadError(typeof source === 'string'
        ? `Couldn't find the model at ${source}. Place entire_model.glb in /public/models/, or use "Load file…" to pick it from disk.`
        : 'Failed to parse the selected .glb file.');
      setLoading(false);
    };

    if (typeof source === 'string') {
      loader.load(source, onDone, onProgress, onError);
    } else {
      // source is an ArrayBuffer from a local File
      loader.parse(source, '', onDone, onError);
    }
  }, [wireframe]);

  useEffect(() => {
    loadFromSource(MODEL_URL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFromSource(reader.result);
    reader.readAsArrayBuffer(file);
  };

  /* ─── visibility toggling ─────────────────────────────────── */
  const visibilityRef = useRef(visibility);
  useEffect(() => { visibilityRef.current = visibility; }, [visibility]);

  function applyVisibility(visState) {
    const map = groupMapRef.current;
    for (const col of COLLECTIONS) {
      const objs = map[col.id] || [];
      const show = visState[col.id];
      objs.forEach(o => { o.visible = show; });
    }
  }

  const toggleCollection = (id) => {
    setVisibility(prev => {
      const next = { ...prev, [id]: !prev[id] };
      applyVisibility(next);
      return next;
    });
  };

  const showAll = () => {
    const next = Object.fromEntries(COLLECTIONS.map(c => [c.id, true]));
    setVisibility(next);
    applyVisibility(next);
  };
  const hideAll = () => {
    const next = Object.fromEntries(COLLECTIONS.map(c => [c.id, false]));
    setVisibility(next);
    applyVisibility(next);
  };

  useEffect(() => {
    if (!modelRootRef.current) return;
    modelRootRef.current.traverse(obj => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(mat => { if (mat) mat.wireframe = wireframe; });
      }
    });
  }, [wireframe]);

  useEffect(() => {
    helperObjectsRef.current.forEach(o => { o.visible = showHelpers; });
  }, [showHelpers]);

  const homeCameraRef = useRef(null); // { position: Vector3, target: Vector3 } computed on load

  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const home = homeCameraRef.current;
    if (home) {
      cameraRef.current.position.copy(home.position);
      controlsRef.current.target.copy(home.target);
    } else {
      cameraRef.current.position.set(0, 1.4, 2.6);
      controlsRef.current.target.set(0, 0.6, 0);
    }
    controlsRef.current.update();
  };

  const takeScreenshot = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cadavier-capture.png';
    a.click();
  };

  /* ─── UI ───────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: C.bg, overflow: 'hidden' }}>

      {/* SIDEBAR — outliner */}
      <div style={{ width: sidebarOpen ? '300px' : '0', minWidth: sidebarOpen ? '300px' : '0', overflow: 'hidden', background: C.surface, borderRight: sidebarOpen ? `1px solid ${C.border}` : 'none', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${C.border}`, flexShrink: 0 }}>
            <img src={LOGO_PATH} alt="DEFTXR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '14px', color: C.white }}>DEFTXR</div>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.08em' }}>CADAVIER</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}>SCENE COLLECTION</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={showAll} title="Show all" style={iconBtnStyle}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button onClick={hideAll} title="Hide all" style={iconBtnStyle}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/></svg>
              </button>
            </div>
          </div>

          {COLLECTIONS.map(col => {
            const visible = visibility[col.id];
            const count = (groupMapRef.current[col.id] || []).length;
            return (
              <button key={col.id} onClick={() => toggleCollection(col.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '9px', color: visible ? C.textPrim : C.textMuted, cursor: 'pointer', fontSize: '12.5px', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHov; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: visible ? 1 : 0.4 }}>
                  {visible
                    ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    : <><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/></>}
                </svg>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.label}</span>
                {count > 0 && <span style={{ fontSize: '10.5px', color: C.textMuted }}>{count}</span>}
              </button>
            );
          })}

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '10px', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>VIEW</div>
            <ToggleRow label="Wireframe" value={wireframe} onChange={setWireframe} />
            <ToggleRow label="Auto-rotate" value={autoRotate} onChange={setAutoRotate} />
            <ToggleRow label="Light background" value={bgLight} onChange={setBgLight} />
            <ToggleRow label="Show Blender nav labels" value={showHelpers} onChange={setShowHelpers} />
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '10px', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', color: C.textMuted, letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif', marginBottom: '2px' }}>MODEL</div>
            <button onClick={() => fileInputRef.current?.click()} style={actionBtnStyle}>Load .glb file…</button>
            <input ref={fileInputRef} type="file" accept=".glb,.gltf" onChange={handleFilePick} style={{ display: 'none' }} />
            <button onClick={resetCamera} style={actionBtnStyle}>Reset camera</button>
            <button onClick={takeScreenshot} style={actionBtnStyle}>Take a picture</button>
          </div>
        </div>

        <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => { setSidebarOpen(false); onNavigate && onNavigate('chat'); }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s', textAlign: 'left', width: '100%', marginBottom: '8px' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHov; e.currentTarget.style.color = C.textPrim; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSec; }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Chat</span>
          </button>
          <button onClick={onLogout}
            style={{ width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.error; e.currentTarget.style.color = C.error; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSec; }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: '60px', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(o => !o)}
            style={{ width: '36px', height: '36px', borderRadius: '8px', background: sidebarOpen ? C.surfaceHov : 'transparent', border: `1px solid ${sidebarOpen ? C.borderLit : 'transparent'}`, cursor: 'pointer', color: C.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', marginRight: '12px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: '15px', color: C.white }}>CADAVIER</div>
          {loadError && <div style={{ marginLeft: '16px', fontSize: '12px', color: C.error }}>{loadError}</div>}
        </div>

        <div ref={mountRef} style={{ flex: 1, position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', background: C.bg, zIndex: 2 }}>
              <div style={{ width: '34px', height: '34px', border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
              <div style={{ fontSize: '13px', color: C.textMuted, fontFamily: 'DM Sans, sans-serif' }}>
                {loadProgress > 0 ? `Loading model… ${loadProgress}%` : 'Loading model…'}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '9px', cursor: 'pointer', width: '100%', marginBottom: '6px' }}
      onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHov; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ fontSize: '12.5px', color: C.textSec, fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
      <span style={{ width: '32px', height: '18px', borderRadius: '10px', background: value ? C.accent : C.border, position: 'relative', transition: 'background 0.2s' }}>
        <span style={{ position: 'absolute', top: '2px', left: value ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: C.white, transition: 'left 0.2s' }} />
      </span>
    </button>
  );
}

const iconBtnStyle = {
  width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textMuted, cursor: 'pointer',
};

const actionBtnStyle = {
  padding: '9px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '9px',
  color: C.textSec, cursor: 'pointer', fontSize: '12.5px', fontFamily: 'DM Sans, sans-serif', textAlign: 'left', width: '100%',
};