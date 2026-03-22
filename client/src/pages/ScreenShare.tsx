import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.tsx';
import Navigation from '../components/Navigation.tsx';
import './ScreenShare.css';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
  // Add TURN server in production
];

export default function ScreenShare() {
  const { user } = useAuth();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('idle');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const ROOM_ID = 'screen-share-room';

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Initialize socket
    const token = document.cookie.split('token=')[1]?.split(';')[0];
    if (!token) return;

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Socket connected for screen share');
      socket.emit('join_room', ROOM_ID);
    });

    socket.on('user_joined', async ({ userId }) => {
      if (userId === user?.id) return;
      console.log('User joined:', userId);
      // If we're the streamer, create offer
      if (isStreaming) {
        createOffer();
      }
    });

    socket.on('webrtc_offer', async ({ offer, from }) => {
      console.log('Received offer from:', from);
      if (from === user?.id) return;
      
      await handleOffer(offer);
    });

    socket.on('webrtc_answer', async ({ answer }) => {
      console.log('Received answer');
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer);
      }
    });

    socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      console.log('Received ICE candidate');
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(candidate);
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socket.on('screen_share_stopped', ({ userId }) => {
      console.log('Screen share stopped by:', userId);
      if (userId !== user?.id) {
        setIsWatching(false);
        setIsStreaming(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        closePeerConnection();
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      closePeerConnection();
    };
  }, [user, isStreaming]);

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc_ice_candidate', {
          roomId: ROOM_ID,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsWatching(true);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        // Try to restart
        if (isStreaming) {
          console.log('Attempting ICE restart...');
          pc.restartIce();
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const createOffer = async () => {
    if (!socketRef.current) return;
    
    const pc = createPeerConnection();
    
    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    socketRef.current.emit('webrtc_offer', {
      roomId: ROOM_ID,
      offer
    });
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!socketRef.current) return;

    const pc = createPeerConnection();
    await pc.setRemoteDescription(offer);

    // Add local tracks for two-way audio
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit('webrtc_answer', {
      roomId: ROOM_ID,
      answer
    });
  };

  const startScreenShare = async () => {
    setError(null);
    setStatus('starting');

    try {
      // Request screen capture with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true // Include system audio (works on Android)
      });

      // Check if audio track exists
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('No audio track captured - system audio not available');
        if (isIOS) {
          setError('На iOS передача системного звука недоступна. Трансляция начнётся без звука.');
        }
      }

      localStreamRef.current = stream;

      // Handle stream ending
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Show local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      setStatus('streaming');

      // If there's already someone in the room, create offer
      // The socket will handle this via user_joined event

    } catch (err: any) {
      console.error('Screen share error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Вы отменили запрос на трансляцию');
      } else {
        setError('Не удалось начать трансляцию: ' + err.message);
      }
      setStatus('idle');
    }
  };

  const stopScreenShare = () => {
    closePeerConnection();
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (socketRef.current) {
      socketRef.current.emit('stop_screen_share', ROOM_ID);
    }

    setIsStreaming(false);
    setIsWatching(false);
    setStatus('idle');
  };

  return (
    <div className="screen-share-page">
      <header className="screen-share-header">
        <h1>Трансляция экрана</h1>
      </header>

      <div className="screen-share-content">
        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        <div className="video-container">
          {/* Remote video (what partner sees) */}
          {isWatching && (
            <div className="remote-video-wrapper">
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline
                className="remote-video"
              />
              <div className="video-label">Экран партнёра</div>
            </div>
          )}

          {/* Local video (what we share) */}
          {isStreaming && (
            <div className="local-video-wrapper">
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline
                className="local-video"
              />
              <div className="video-label">Ваша трансляция</div>
            </div>
          )}

          {!isStreaming && !isWatching && (
            <div className="idle-state">
              <div className="idle-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <p>Нажмите кнопку ниже, чтобы начать трансляцию</p>
              {isIOS && (
                <p className="ios-warning">
                  ⚠️ На iOS передача системного звука недоступна
                </p>
              )}
            </div>
          )}
        </div>

        <div className="controls">
          {isStreaming ? (
            <button 
              className="btn btn-primary stop-btn"
              onClick={stopScreenShare}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              Остановить трансляцию
            </button>
          ) : (
            <button 
              className="btn btn-primary start-btn"
              onClick={startScreenShare}
              disabled={status === 'starting'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              {status === 'starting' ? 'Подключение...' : 'Начать трансляцию'}
            </button>
          )}
        </div>

        <div className="status-info">
          <span className={`status-badge ${isStreaming ? 'streaming' : ''} ${isWatching ? 'watching' : ''}`}>
            {isStreaming ? 'Транслирую' : isWatching ? 'Смотрю' : 'Готов'}
          </span>
        </div>
      </div>

      <Navigation />
    </div>
  );
}
