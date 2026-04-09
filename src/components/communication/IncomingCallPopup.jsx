import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './IncomingCallPopup.css';

/**
 * Professional top popup for incoming calls
 * Appears at TOP CENTER with smooth animation
 * Shows caller info with Accept/Reject buttons
 */
export function IncomingCallPopup({
  isVisible = false,
  call = null,
  onAccept,
  onReject,
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [ringtone, setRingtone] = useState(null);

  // Initialize ringtone audio
  useEffect(() => {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='
    );
    audio.loop = true;
    setRingtone(audio);
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Play ringtone when call arrives
  useEffect(() => {
    if (isVisible && ringtone) {
      ringtone.play().catch(() => {
        console.log('Auto-play blocked. User interaction required for audio.');
      });
      setIsAnimating(true);
    } else if (ringtone) {
      ringtone.pause();
      ringtone.currentTime = 0;
    }
    return () => {
      if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
      }
    };
  }, [isVisible, ringtone]);

  if (!isVisible || !call) return null;

  const isVideoCall = call.type === 'video';
  const callerName = call.initiatorName || 'Unknown Caller';
  const callType = isVideoCall ? 'Video Call' : 'Audio Call';

  return (
    <div className={`incoming-call-popup ${isAnimating ? 'visible' : ''}`}>
      {/* Background blur overlay */}
      <div className="call-popup-overlay" />

      {/* Popup container */}
      <div className="call-popup-container">
        {/* Caller info section */}
        <div className="call-popup-info">
          {/* Caller avatar */}
          <div className="call-popup-avatar">
            <div className="avatar-badge">
              {(callerName[0] || 'U').toUpperCase()}
            </div>
            {isVideoCall && (
              <div className="video-indicator">
                <Video className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Caller details */}
          <div className="call-popup-details">
            <h3 className="caller-name">{callerName}</h3>
            <p className="call-type-label">
              {isVideoCall ? '📹' : '📞'} {callType}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="call-popup-actions">
          <Button
            onClick={() => {
              onReject?.();
              setIsAnimating(false);
              if (ringtone) {
                ringtone.pause();
                ringtone.currentTime = 0;
              }
            }}
            className="btn-reject"
            title="Reject call"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="btn-text">Reject</span>
          </Button>

          <Button
            onClick={() => {
              onAccept?.();
              setIsAnimating(false);
              if (ringtone) {
                ringtone.pause();
                ringtone.currentTime = 0;
              }
            }}
            className="btn-accept"
            title="Accept call"
          >
            <Phone className="h-5 w-5" />
            <span className="btn-text">Accept</span>
          </Button>
        </div>

        {/* Pulsing animation */}
        <div className="call-pulse" />
      </div>
    </div>
  );
}

export default IncomingCallPopup;
