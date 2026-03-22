import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { io, Socket } from 'socket.io-client';
import Navigation from '../components/Navigation.tsx';
import './Chat.css';

interface Message {
  id: number;
  senderId: number;
  content: string | null;
  fileUrl: string | null;
  fileType: string;
  duration: number | null;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: number;
    nickname: string;
    avatarUrl: string | null;
  };
}

interface UserStatus {
  userId: number;
  status: 'online' | 'offline';
  lastSeen?: string;
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<UserStatus | null>(null);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    const token = document.cookie.split('token=')[1]?.split(';')[0];
    if (!token) return;

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('new_message', (message: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      
      // Mark as read if we're viewing
      if (message.senderId !== user.id) {
        socket.emit('mark_read', { messageIds: [message.id] });
      }
    });

    socket.on('message_read', ({ messageIds }) => {
      setMessages(prev => prev.map(m => 
        messageIds.includes(m.id) ? { ...m, isRead: true } : m
      ));
    });

    socket.on('user_status', (status: UserStatus) => {
      if (status.userId !== user.id) {
        setPartnerStatus(status);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const res = await fetch('/api/messages?limit=50&offset=0', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Load messages error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, []);

  // Load partner status
  useEffect(() => {
    const loadPartnerStatus = async () => {
      if (!user) return;
      const partnerId = user.id === 1 ? 2 : 1;
      
      try {
        const res = await fetch(`/api/user/last-seen/${partnerId}`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setPartnerStatus({
            userId: data.id,
            status: 'offline',
            lastSeen: data.lastSeenAt
          });
        }
      } catch (error) {
        console.error('Load partner status error:', error);
      }
    };

    loadPartnerStatus();
  }, [user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Неизвестно';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Онлайн';
    if (diffMins < 2) return 'Был(а) только что';
    if (diffMins < 5) return 'Был(а) только что';
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 1) return `Был(а) ${diffMins} мин. назад`;
    
    if (date.toDateString() === now.toDateString()) {
      return `Был(а) в ${date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Был(а) вчера в ${date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return `Был(а) ${date.toLocaleDateString('ru')} в ${date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const sendMessage = async (text: string | null, fileUrl?: string, fileType?: string, duration?: number) => {
    if (!socketRef.current || sending) return;
    
    setSending(true);
    try {
      socketRef.current.emit('send_message', {
        content: text,
        fileUrl: fileUrl || null,
        fileType: fileType || 'text',
        duration
      });
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size limits
    const maxSizes: Record<string, number> = {
      image: 20 * 1024 * 1024,
      video: 100 * 1024 * 1024,
      audio: 10 * 1024 * 1024,
      video_note: 30 * 1024 * 1024
    };
    
    if (file.size > (maxSizes[fileType] || 20 * 1024 * 1024)) {
      alert('Файл слишком большой');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        sendMessage(null, data.url, fileType);
      }
    } catch (error) {
      console.error('Upload error:', error);
    }

    e.target.value = '';
  };

  // Voice message recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await uploadAudio(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Start recording error:', error);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'voice.webm');
    formData.append('fileType', 'audio');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        sendMessage(null, data.url, 'audio');
      }
    } catch (error) {
      console.error('Upload audio error:', error);
    }
  };

  // Video note (кружочки) recording
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });
      videoStreamRef.current = stream;
      
      const videoPreview = document.getElementById('video-preview') as HTMLVideoElement;
      if (videoPreview) {
        videoPreview.srcObject = stream;
        videoPreview.play();
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunks, { type: 'video/webm' });
        await uploadVideoNote(blob);
        setShowVideoRecorder(false);
      };

      videoRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setShowVideoRecorder(true);
    } catch (error) {
      console.error('Start video recording error:', error);
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && showVideoRecorder) {
      videoRecorderRef.current.stop();
    }
  };

  const uploadVideoNote = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'video_note.webm');
    formData.append('fileType', 'video_note');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        sendMessage(null, data.url, 'video_note', 60);
      }
    } catch (error) {
      console.error('Upload video note error:', error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  const getPartnerName = () => {
    if (!user) return 'Собеседник';
    return user.id === 1 ? 'Она' : 'Он';
  };

  if (loading) {
    return <div className="loading-screen">Загрузка...</div>;
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">
            {getPartnerName().charAt(0)}
          </div>
          <div className="chat-header-text">
            <h2>{getPartnerName()}</h2>
            <span className={`status ${partnerStatus?.status === 'online' ? 'online' : ''}`}>
              {partnerStatus?.status === 'online' ? 'Онлайн' : formatLastSeen(partnerStatus?.lastSeen)}
            </span>
          </div>
        </div>
        <div className="chat-header-actions">
          <a href="/screen-share" className="btn-icon" title="Трансляция экрана">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </a>
        </div>
      </header>

      <div className="messages-container">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`message ${msg.senderId === user?.id ? 'outgoing' : 'incoming'}`}
          >
            <div className="message-content">
              {msg.fileType === 'text' && msg.content && (
                <p>{msg.content}</p>
              )}
              
              {msg.fileType === 'image' && msg.fileUrl && (
                <img 
                  src={msg.fileUrl} 
                  alt="Изображение" 
                  className="message-image"
                  loading="lazy"
                />
              )}
              
              {msg.fileType === 'video' && msg.fileUrl && (
                <video 
                  src={msg.fileUrl} 
                  controls 
                  className="message-video"
                />
              )}
              
              {msg.fileType === 'audio' && msg.fileUrl && (
                <audio 
                  src={msg.fileUrl} 
                  controls 
                  className="message-audio"
                />
              )}
              
              {msg.fileType === 'video_note' && msg.fileUrl && (
                <div className="video-note">
                  <video 
                    src={msg.fileUrl} 
                    controls 
                    className="video-note-player"
                  />
                </div>
              )}
              
              <div className="message-meta">
                <span className="message-time">{formatTime(msg.createdAt)}</span>
                {msg.senderId === user?.id && (
                  <span className={`message-status ${msg.isRead ? 'read' : ''}`}>
                    {msg.isRead ? '✓✓' : '✓'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <form onSubmit={handleSubmit} className="chat-input-form">
          <button 
            type="button" 
            className="btn-icon attach-btn"
            onClick={() => setShowMediaPanel(!showMediaPanel)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Сообщение"
            className="chat-input"
          />
          
          {inputText ? (
            <button type="submit" className="btn-icon send-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          ) : (
            <button 
              type="button" 
              className={`btn-icon voice-btn ${recording ? 'recording' : ''}`}
              onMouseDown={startVoiceRecording}
              onMouseUp={stopVoiceRecording}
              onMouseLeave={stopVoiceRecording}
              onTouchStart={startVoiceRecording}
              onTouchEnd={stopVoiceRecording}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}
        </form>
        
        {showMediaPanel && (
          <div className="media-panel">
            <button onClick={() => fileInputRef.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>Фото</span>
            </button>
            <button onClick={() => videoInputRef.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span>Видео</span>
            </button>
            <button onClick={startVideoRecording}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              <span>Кружочек</span>
            </button>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFileSelect(e, 'image')}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => handleFileSelect(e, 'video')}
        />
      </div>

      {showVideoRecorder && (
        <div className="video-recorder-overlay">
          <div className="video-recorder">
            <video id="video-preview" muted playsInline className="video-preview" />
            <div className="video-recorder-controls">
              <button onClick={stopVideoRecording} className="btn btn-primary">
                Завершить запись
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}
