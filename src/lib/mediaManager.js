/**
 * Media Permissions & WebRTC Manager
 * Production-grade media device management with proper permission handling
 */

class MediaManager {
  constructor() {
    this.localStream = null;
    this.audioConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    this.videoConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: this.audioConstraints.audio,
    };

    this.peers = new Map(); // callId -> RTCPeerConnection
  }

  /**
   * Request media permissions and get local stream
   */
  async getLocalStream(mediaType = 'audio-video') {
    try {
      console.log(`🎤 Requesting ${mediaType} permissions...`);

      let constraints;
      if (mediaType === 'audio') {
        constraints = this.audioConstraints;
      } else if (mediaType === 'video') {
        constraints = this.videoConstraints;
      } else {
        constraints = this.videoConstraints;
      }

      // Request permissions
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log(`✓ Media stream obtained (${mediaType})`);
      console.log(`  - Audio tracks: ${stream.getAudioTracks().length}`);
      console.log(`  - Video tracks: ${stream.getVideoTracks().length}`);

      this.localStream = stream;
      return stream;
    } catch (error) {
      return this.handleMediaError(error);
    }
  }

  /**
   * Handle media permission errors
   */
  handleMediaError(error) {
    const errorMessages = {
      NotAllowedError: 'Permission denied. Please enable camera/microphone in settings.',
      NotFoundError: 'No camera/microphone device found.',
      NotReadableError: 'Could not access media device. It may be in use by another app.',
      OverconstrainedError: 'Requested constraints could not be satisfied.',
      TypeError: 'No media devices available.',
    };

    const message = errorMessages[error.name] || error.message;
    console.error(`❌ Media Error (${error.name}): ${message}`);

    return {
      error: true,
      name: error.name,
      message,
      code: error.name,
    };
  }

  /**
   * Stop all media tracks
   */
  stopLocalStream() {
    if (!this.localStream) return;

    console.log('🛑 Stopping local media stream');

    this.localStream.getTracks().forEach((track) => {
      track.stop();
      console.log(`  ✓ Stopped ${track.kind} track`);
    });

    this.localStream = null;
  }

  /**
   * Toggle audio track
   */
  toggleAudio(enabled) {
    if (!this.localStream) {
      console.warn('⚠️ No local stream available');
      return false;
    }

    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = enabled;
    });

    console.log(`🎤 Audio ${enabled ? 'enabled' : 'muted'}`);
    return enabled;
  }

  /**
   * Toggle video track
   */
  toggleVideo(enabled) {
    if (!this.localStream) {
      console.warn('⚠️ No local stream available');
      return false;
    }

    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = enabled;
    });

    console.log(`📹 Video ${enabled ? 'enabled' : 'disabled'}`);
    return enabled;
  }

  /**
   * Get audio level (for animation/indicators)
   */
  getAudioLevel() {
    if (!this.localStream) return 0;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(this.localStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    microphone.connect(analyser);
    analyser.connect(processor);
    processor.connect(audioContext.destination);

    return analyser;
  }

  // ═══════════════════════════════════════════════════════════════
  // WebRTC Peer Connection
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create RTCPeerConnection
   */
  createPeerConnection(callId, iceServers = []) {
    console.log(`🔗 Creating peer connection for call: ${callId}`);

    const peerConnection = new RTCPeerConnection({
      iceServers: iceServers.length > 0 ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // ──────────────────────────────────────────────────────────────
    // Add local stream tracks
    // ──────────────────────────────────────────────────────────────

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream);
        console.log(`  ✓ Added ${track.kind} track`);
      });
    }

    // ──────────────────────────────────────────────────────────────
    // Connection Events
    // ──────────────────────────────────────────────────────────────

    peerConnection.onconnectionstatechange = () => {
      console.log(`🔌 Connection state: ${peerConnection.connectionState}`);
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`❄️ ICE connection state: ${peerConnection.iceConnectionState}`);
    };

    peerConnection.onsignalingstatechange = () => {
      console.log(`📡 Signaling state: ${peerConnection.signalingState}`);
    };

    peerConnection.ontrack = (event) => {
      console.log(`📥 Remote track received: ${event.track.kind}`);
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log(`❄️ ICE gathering state: ${peerConnection.iceGatheringState}`);
    };

    // Store connection
    this.peers.set(callId, peerConnection);

    return peerConnection;
  }

  /**
   * Create WebRTC offer
   */
  async createOffer(callId) {
    try {
      const peerConnection = this.peers.get(callId);
      if (!peerConnection) throw new Error(`Peer connection not found for call ${callId}`);

      console.log(`📤 Creating WebRTC offer for ${callId}`);

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);

      console.log(`✓ Offer created and local description set`);
      return offer;
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      throw error;
    }
  }

  /**
   * Create WebRTC answer
   */
  async createAnswer(callId) {
    try {
      const peerConnection = this.peers.get(callId);
      if (!peerConnection) throw new Error(`Peer connection not found for call ${callId}`);

      console.log(`📤 Creating WebRTC answer for ${callId}`);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      console.log(`✓ Answer created and local description set`);
      return answer;
    } catch (error) {
      console.error('❌ Error creating answer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming offer
   */
  async handleOffer(callId, offer) {
    try {
      const peerConnection = this.peers.get(callId);
      if (!peerConnection) throw new Error(`Peer connection not found for call ${callId}`);

      console.log(`📥 Handling remote offer for ${callId}`);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      console.log(`✓ Remote description set`);
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(callId, answer) {
    try {
      const peerConnection = this.peers.get(callId);
      if (!peerConnection) throw new Error(`Peer connection not found for call ${callId}`);

      console.log(`📥 Handling remote answer for ${callId}`);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

      console.log(`✓ Remote description set`);
    } catch (error) {
      console.error('❌ Error handling answer:', error);
      throw error;
    }
  }

  /**
   * Add ICE candidate
   */
  async addICECandidate(callId, candidate) {
    try {
      const peerConnection = this.peers.get(callId);
      if (!peerConnection) throw new Error(`Peer connection not found for call ${callId}`);

      if (candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`✓ ICE candidate added`);
      }
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }

  /**
   * Close peer connection
   */
  closePeerConnection(callId) {
    const peerConnection = this.peers.get(callId);
    if (!peerConnection) return;

    console.log(`🛑 Closing peer connection for ${callId}`);

    peerConnection.close();
    this.peers.delete(callId);
  }

  /**
   * Get connection stats
   */
  async getConnectionStats(callId) {
    const peerConnection = this.peers.get(callId);
    if (!peerConnection) return null;

    const stats = await peerConnection.getStats();
    const result = {
      audio: { sent: 0, received: 0, quality: 'unknown' },
      video: { sent: 0, received: 0, quality: 'unknown' },
      connection: { currentRoundTripTime: 0, availableOutgoingBitrate: 0 },
    };

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        if (report.mediaType === 'audio') {
          result.audio.received = report.bytesReceived;
        } else if (report.mediaType === 'video') {
          result.video.received = report.bytesReceived;
        }
      } else if (report.type === 'outbound-rtp') {
        if (report.mediaType === 'audio') {
          result.audio.sent = report.bytesSent;
        } else if (report.mediaType === 'video') {
          result.video.sent = report.bytesSent;
        }
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        result.connection.currentRoundTripTime = report.currentRoundTripTime;
        result.connection.availableOutgoingBitrate = report.availableOutgoingBitrate;
      }
    });

    return result;
  }

  /**
   * List available media devices
   */
  async enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const result = {
        audioInput: [],
        videoInput: [],
        audioOutput: [],
      };

      devices.forEach((device) => {
        if (device.kind === 'audioinput') {
          result.audioInput.push({ id: device.deviceId, label: device.label });
        } else if (device.kind === 'videoinput') {
          result.videoInput.push({ id: device.deviceId, label: device.label });
        } else if (device.kind === 'audiooutput') {
          result.audioOutput.push({ id: device.deviceId, label: device.label });
        }
      });

      console.log(`✓ Available devices: ${result.audioInput.length} audio, ${result.videoInput.length} video`);
      return result;
    } catch (error) {
      console.error('❌ Error enumerating devices:', error);
      return null;
    }
  }

  /**
   * Check if browser supports WebRTC
   */
  isWebRTCSupported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.RTCPeerConnection
    );
  }
}

// Export singleton
export const mediaManager = new MediaManager();
export default mediaManager;
