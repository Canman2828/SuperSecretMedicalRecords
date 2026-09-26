import { NO_RESULT_DISCLAIMER, type InteractionCheckResponse, type ProfileNode, type Relationship } from '@medifyrx/shared';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { NODE_CAPTION, STATUS_STYLE, TONE } from './status';
import { TreeScene, type ViewMode } from './treeScene';

export interface TreeViewerHandle {
  revealCenter: (ms: number) => void;
  revealAll: () => void;
  centerPillRect: () => { x: number; y: number; length: number; angleDeg: number } | null;
}

interface Props {
  data: InteractionCheckResponse | null;
  loading: boolean;
  /** Keep every node hidden until the intro hands off (revealCenter / revealAll). */
  startHidden: boolean;
}

const nodeName = (n: ProfileNode | undefined) => (!n ? '' : n.type === 'patient' ? 'You' : n.label);

export const TreeViewer = forwardRef<TreeViewerHandle, Props>(function TreeViewer({ data, loading, startHidden }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const engine = useRef<TreeScene | null>(null);

  const [mode, setMode] = useState<ViewMode>('3d');
  const [selected, setSelected] = useState<string[]>([]);
  const [arSupported, setArSupported] = useState(false);
  const [ar, setAr] = useState<'off' | 'searching' | 'placed'>('off');
  const [notice, setNotice] = useState<string | null>(null);

  const nodes = data?.nodes ?? [];
  const rels = data?.relationships ?? [];
  const byId = (id: string) => nodes.find((n) => n.id === id);

  useImperativeHandle(ref, () => ({
    revealCenter: (ms) => engine.current?.revealCenter(ms),
    revealAll: () => engine.current?.revealAll(),
    centerPillRect: () => engine.current?.centerPillRect() ?? null,
  }));

  // Node clicks come from the engine (mouse, touch, or an AR tap).
  const onNodeClick = useRef<(id: string | null) => void>(() => {});
  onNodeClick.current = (id) => {
    if (!id) return;
    if (id === 'patient') {
      setSelected([]);
      engine.current?.resetView();
      return;
    }
    setSelected((prev) => (prev.length === 1 && prev[0] === id ? [] : prev.length === 1 ? [prev[0], id] : [id]));
    engine.current?.focusNode(id);
  };

  useEffect(() => {
    let scene: TreeScene;
    try {
      scene = new TreeScene(box.current!, canvas.current!, { onNodeClick: (id) => onNodeClick.current(id), onARChange: setAr }, startHidden);
    } catch {
      setNotice('3D graphics aren’t available in this browser.');
      return;
    }
    engine.current = scene;
    void TreeScene.arSupported().then(setArSupported);
    return () => {
      scene.dispose();
      engine.current = null;
    };
    // The engine is created once; `startHidden` only matters at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engine.current?.setData(data);
    setSelected((s) => s.filter((id) => data?.nodes.some((n) => n.id === id)));
  }, [data]);

  useEffect(() => engine.current?.setSelected(selected), [selected]);

  // Camera view: the tree floats over the live camera feed.
  useEffect(() => {
    engine.current?.setMode(mode);
    if (mode !== 'camera') return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => {
        setNotice('We couldn’t open your camera. Check the camera permission for this site.');
        setMode('3d');
      });
    if (!navigator.mediaDevices) {
      setNotice('Camera view needs a secure (https) connection.');
      setMode('3d');
    }
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  // In AR, taps on the overlay's buttons shouldn't also count as taps in the 3D scene.
  useEffect(() => {
    const el = hud.current!;
    const stop = (e: Event) => {
      if ((e.target as HTMLElement).closest('button, a, .pair-card')) e.preventDefault();
    };
    el.addEventListener('beforexrselect', stop);
    return () => el.removeEventListener('beforexrselect', stop);
  }, []);

  const startAR = async () => {
    setNotice(null);
    try {
      await engine.current?.enterAR(hud.current!);
    } catch {
      setNotice('We couldn’t start AR on this device. Try Camera view instead.');
    }
  };

  const [a, b] = selected;
  const pairRel = b ? rels.find((r) => (r.sourceNodeId === a && r.targetNodeId === b) || (r.sourceNodeId === b && r.targetNodeId === a)) : undefined;
  const connections = a && !b ? rels.filter((r) => r.sourceNodeId === a || r.targetNodeId === a) : [];

  return (
    <div className={`tree3d${mode === 'camera' ? ' camera' : ''}${ar !== 'off' ? ' in-ar' : ''}`} ref={box}>
      <video ref={video} className="tree3d-video" autoPlay playsInline muted hidden={mode !== 'camera'} />
      <canvas ref={canvas} className="tree3d-canvas" aria-label="3D map of how your medicines, allergies and foods interact" />

      <div className="tree3d-hud" ref={hud}>
        <div className="tree3d-top">
          {ar === 'off' ? (
            <div className="seg" role="group" aria-label="View">
              <button aria-pressed={mode === '3d'} onClick={() => setMode('3d')}><Icon name="cube" size={15} />3D view</button>
              <button aria-pressed={mode === 'camera'} onClick={() => setMode('camera')}><Icon name="camera" size={15} />Camera view</button>
              {arSupported && (
                <button aria-pressed={false} onClick={startAR}><Icon name="vr" size={15} />Place on a table (AR)</button>
              )}
            </div>
          ) : (
            <button className="btn btn-neu" style={{ height: 40 }} onClick={() => engine.current?.exitAR()}><Icon name="x" />Exit AR</button>
          )}
          {ar === 'off' && (
            <button className="icon-btn" aria-label="Reset view" title="Reset view" onClick={() => { setSelected([]); engine.current?.resetView(); }}>
              <Icon name="scan" />
            </button>
          )}
        </div>

        {loading && <span className="tree3d-chip">Checking drug labels for foods to avoid…</span>}
        {notice && (
          <span className="tree3d-chip warn" role="status">
            {notice}
            <button className="text-btn" onClick={() => setNotice(null)}>OK</button>
          </span>
        )}
        {ar === 'searching' && <span className="tree3d-chip">Move your phone slowly over a table. Tap when the ring appears to place your tree.</span>}

        <div className="tree3d-bottom">
          {!b && (
            <div className="tree3d-hint neu-in">
              {!a ? (
                <span>
                  <b>Tap a node</b> to focus it, then <b>tap another</b> to see how the two connect. Drag to turn the tree{mode === '3d' ? ', scroll to zoom' : ''}.
                </span>
              ) : (
                <div className="sel-info">
                  <span><b>{nodeName(byId(a))}</b> selected · tap another node to compare.</span>
                  {connections.length > 0 && (
                    <span className="sel-links">
                      {connections.map((r) => {
                        const other = r.sourceNodeId === a ? r.targetNodeId : r.sourceNodeId;
                        const tone = TONE[STATUS_STYLE[r.status].tone];
                        return (
                          <button key={r.id} className="link-chip" style={{ background: tone.tint, color: tone.text }} onClick={() => onNodeClick.current(other)}>
                            {STATUS_STYLE[r.status].icon} {nodeName(byId(other))}
                          </button>
                        );
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {b && (
            <article className="pair-card card" role="dialog" aria-label={`${nodeName(byId(a))} and ${nodeName(byId(b))}`}>
              <div className="pair-head">
                <h3>{nodeName(byId(a))} <span className="plus">+</span> {nodeName(byId(b))}</h3>
                <button className="icon-btn close" aria-label="Close" onClick={() => setSelected([])}><Icon name="x" size={16} /></button>
              </div>
              {pairRel ? <PairDetails r={pairRel} /> : <NoLink a={byId(a)} b={byId(b)} />}
            </article>
          )}
        </div>
      </div>
    </div>
  );
});

function PairDetails({ r }: { r: Relationship }) {
  const s = STATUS_STYLE[r.status];
  const tone = TONE[s.tone];
  return (
    <>
      <span className="tone-badge" style={{ background: tone.tint, color: tone.text }}>{s.icon} {tone.label}</span>
      <p className="pair-title">{r.title}</p>
      <p>{r.explanation ?? 'See the source below.'}</p>
      {r.sourceText && <blockquote>{r.sourceText}</blockquote>}
      <p className="small muted">
        Source: {r.source.label ?? r.source.organization}
        {r.source.url && (
          <>
            {' · '}
            <a href={r.source.url} target="_blank" rel="noreferrer">View the label</a>
          </>
        )}
        {' · '}checked {new Date(r.checkedAt).toLocaleDateString()}
      </p>
      <p className="small pair-note">Talk with a pharmacist or healthcare professional if you have questions about this.</p>
    </>
  );
}

function NoLink({ a, b }: { a?: ProfileNode; b?: ProfileNode }) {
  const kind = (n?: ProfileNode) => (n ? NODE_CAPTION[n.type][n.related ? 1 : 0].toLowerCase() : '');
  return (
    <>
      <span className="tone-badge neutral">No link found</span>
      <p>
        We didn’t find a documented interaction between {kind(a)} <b>{nodeName(a)}</b> and {kind(b)} <b>{nodeName(b)}</b> in
        the sources we checked.
      </p>
      <p className="small muted">{NO_RESULT_DISCLAIMER}</p>
    </>
  );
}
