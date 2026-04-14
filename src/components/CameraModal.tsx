import { useRef, useEffect, useState } from 'react';

interface CameraModalProps {
  onCapture: (imageBase64: string) => void;
  onClose: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const startCamera = async () => {
      // navigator.mediaDevices solo está disponible en contextos seguros (HTTPS o localhost).
      // En HTTP desde una IP de red local, la API no existe.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          'La cámara no está disponible. El acceso requiere HTTPS o localhost.\n\nPuedes usar la opción "Galería" para adjuntar fotos desde tu dispositivo, o instala la app como PWA para habilitar la cámara.'
        );
        return;
      }
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch (err) {
        setError('No se pudo acceder a la cámara. Asegúrate de haber dado permisos en la configuración del navegador.');
        console.error(err);
      }
    };
    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(base64);
    onClose();
  };

  if (error) {
    return (
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <p>{error}</p>
          <button onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <video ref={videoRef} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button onClick={capturePhoto} style={{ marginRight: '1rem' }}>📸 Capturar</button>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0,0,0,0.8)',
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalContentStyle: React.CSSProperties = {
  background: '#fff',
  padding: '1rem',
  borderRadius: '8px',
  maxWidth: '95%',
};

export default CameraModal;