import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';

/**
 * In-page camera for laptops and desktops (phones use the native camera through the file input).
 * The captured frame is handed straight to the text reader and never stored.
 */
export function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        video.current!.srcObject = s;
      })
      .catch(() => setError('We couldn’t open your camera. Check the browser’s camera permission, or upload a photo instead.'));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const capture = () => {
    const v = video.current!;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')!.drawImage(v, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(new File([blob], 'Camera photo.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.92);
  };

  return (
    <div className="cam-backdrop" role="dialog" aria-modal="true" aria-label="Take a photo">
      <div className="cam card">
        <div className="panel-head">
          <h3><Icon name="camera" size={20} />Take a photo</h3>
          <button className="icon-btn" aria-label="Close camera" onClick={onClose}><Icon name="x" /></button>
        </div>
        {error ? (
          <p className="cam-error">{error}</p>
        ) : (
          <div className="cam-view">
            <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} />
            {!ready && <span className="muted small">Starting camera…</span>}
          </div>
        )}
        <p className="muted small">Fill the frame with the text, hold steady, and make sure it’s well lit.</p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          {!error && (
            <button className="btn btn-jelly" onClick={capture} disabled={!ready}><Icon name="camera" />Capture</button>
          )}
          <button className="btn btn-neu" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
