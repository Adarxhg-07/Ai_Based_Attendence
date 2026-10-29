import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Check, X, Send, Camera, ArrowLeft, AlertCircle, BarChart3, Download, Video, VideoOff, Play, Square } from 'lucide-react';
import clsx from 'clsx';
import { playCountdownBeeps, primeAudio } from '../../lib/audio';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

// AI service base URL for direct MJPEG stream access.
// Uses VITE_AI_SERVICE_URL env var if set, else falls back to the dev default.
const AI_SERVICE_URL = (import.meta as any).env?.VITE_AI_SERVICE_URL || 'http://localhost:8000';

export default function AttendanceSession() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Live camera state
  const [liveActive, setLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [showUploadFallback, setShowUploadFallback] = useState(false);
  const livePollRef = useRef<number | null>(null);

  // Laptop webcam state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  // Beep-countdown timer. Fires immediately + every intervalMs so the
  // 3-beep warning plays exactly `preSnapshotBeepMs` (default 3s) before
  // each snapshot. Backend delays its first snapshot by the same amount.
  const beepTimerRef = useRef<number | null>(null);
  const [beepCountdown, setBeepCountdown] = useState(0); // for visual "3.. 2.. 1.." pill

  useEffect(() => {
    startSession();
  }, [scheduleId]);

  const startSession = async () => {
    try {
      // First get class details
      const classRes = await api.get(`/teacher/classes/${scheduleId}`);
      setClassInfo(classRes.data.data);

      // Start or resume session
      try {
        const sessionRes = await api.post(`/teacher/classes/${scheduleId}/attendance/start`);
        setSession(sessionRes.data.data);
        // Fetch session details with records
        await fetchSessionDetails(sessionRes.data.data.id);
      } catch (err: any) {
        // Session might already exist (409)
        if (err.response?.status === 409) {
          const existingId = err.response.data?.error?.details?.existingSessionId;
          if (existingId) {
            await fetchSessionDetails(existingId);
          } else {
            setError('An attendance session already exists and is locked.');
          }
        } else {
          setError(getErrorMessage(err));
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    const { data } = await api.get(`/teacher/attendance/${sessionId}`);
    setSession(data.data);
    setRecords(data.data.attendanceRecords || []);
  };

  // ── Live Camera ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // On unmount, clear polling + any scheduled beep. Do NOT auto-stop
      // server-side capture; leave that to the explicit Stop button.
      if (livePollRef.current) {
        window.clearInterval(livePollRef.current);
        livePollRef.current = null;
      }
      if (beepTimerRef.current) {
        window.clearInterval(beepTimerRef.current);
        beepTimerRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const runBeepCountdown = (seconds: number) => {
    // Play one beep per second at T=0, T=1, T=2 (for a 3-second countdown)
    // and update the visual pill so the teacher sees the countdown too.
    setBeepCountdown(seconds);
    playCountdownBeeps(seconds, { spacingMs: 1000 });
    // Tick the visible number down
    let remaining = seconds;
    const ticker = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        setBeepCountdown(0);
        window.clearInterval(ticker);
      } else {
        setBeepCountdown(remaining);
      }
    }, 1000);
  };

  const pollLiveStatus = async () => {
    if (!session) return;
    try {
      const { data } = await api.get(`/teacher/attendance/${session.id}/live/status`);
      setLiveStatus(data.data);
      if (data.data.active !== liveActive) {
        setLiveActive(data.data.active);
      }
    } catch (err) {
      // Silent: polling failures shouldn't spam the user
    }
  };

  const handleStartLive = async () => {
    if (!session || liveLoading) return;
    setLiveLoading(true);
    setError('');
    // A user gesture is required to unlock Web Audio on most browsers —
    // prime the context now so subsequent beeps play.
    primeAudio();
    try {
      const { data } = await api.post(`/teacher/attendance/${session.id}/live/start`);
      setLiveActive(true);

      // Pull the authoritative interval + beep-lead from the backend response
      const intervalMs = (data.data?.intervalSec ?? 60) * 1000;
      const beepLeadMs = data.data?.preSnapshotBeepMs ?? 3000;
      const countdownSeconds = Math.max(1, Math.round(beepLeadMs / 1000));

      // Play the first countdown immediately (snapshot fires beepLeadMs later)
      runBeepCountdown(countdownSeconds);

      // Repeat the countdown every intervalMs so every subsequent snapshot
      // gets the same 3-second warning
      if (beepTimerRef.current) window.clearInterval(beepTimerRef.current);
      beepTimerRef.current = window.setInterval(() => {
        runBeepCountdown(countdownSeconds);
      }, intervalMs);

      // Start polling every 5s for running tally
      if (livePollRef.current) window.clearInterval(livePollRef.current);
      livePollRef.current = window.setInterval(pollLiveStatus, 5000);
      await pollLiveStatus();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLiveLoading(false);
    }
  };

  const handleStopLive = async () => {
    if (!session || liveLoading) return;
    setLiveLoading(true);
    try {
      const { data } = await api.post(`/teacher/attendance/${session.id}/live/stop`);
      setLiveActive(false);
      if (livePollRef.current) {
        window.clearInterval(livePollRef.current);
        livePollRef.current = null;
      }
      if (beepTimerRef.current) {
        window.clearInterval(beepTimerRef.current);
        beepTimerRef.current = null;
      }
      setBeepCountdown(0);
      // Show the tally result
      setAiResult({
        liveTally: data.data,
        aiServiceAvailable: true,
      });
      // Refresh records from server to pick up PRESENT/ABSENT updates
      await fetchSessionDetails(session.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLiveLoading(false);
    }
  };

  const processImageFile = async (file: File) => {
    if (!file || !session) return;

    setUploading(true);
    setAiResult(null);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const { data } = await api.post(
        `/teacher/attendance/${session.id}/process-image`,
        formData,
        { headers: { 'Content-Type': undefined } }
      );

      setAiResult(data.data);
      if (data.data.attendanceRecords) {
        setRecords(data.data.attendanceRecords);
      } else {
        // Refresh records if AI was unavailable
        await fetchSessionDetails(session.id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setWebcamActive(true);
    } catch (err: any) {
      setError('Could not access laptop webcam: ' + err.message);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
  };

  const captureWebcamSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
        processImageFile(file);
      }
    }, 'image/jpeg', 0.95);
  };

  const handleReopenSession = async () => {
    if (!scheduleId) return;
    setLoading(true);
    setError('');
    try {
      const sessionRes = await api.post(`/teacher/classes/${scheduleId}/attendance/start`);
      setSession(sessionRes.data.data);
      await fetchSessionDetails(sessionRes.data.data.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (studentId: string, status: AttendanceStatus) => {
    if (!session) return;
    try {
      await api.put(`/teacher/attendance/${session.id}/students/${studentId}`, { status });
      setRecords((prev) =>
        prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleSubmit = async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/teacher/attendance/${session.id}/submit`);
      navigate('/teacher', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!session) return;
    try {
      const res = await api.get(`/teacher/attendance/${session.id}/download-excel`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = res.headers['content-disposition'];
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'attendance.xlsx';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-maroon-700/30 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isLocked = session?.status === 'SUBMITTED' || session?.status === 'FINALIZED';
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const lateCount = records.filter((r) => r.status === 'LATE').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;

  return (
    <div>
      <PageHeader
        title={classInfo?.courseOffering?.course?.name || 'Attendance'}
        description={`${classInfo?.classroom?.name || ''} | ${classInfo?.startTime} - ${classInfo?.endTime}`}
        action={
          <button onClick={() => navigate('/teacher')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80">
            <ArrowLeft size={16} /> Back
          </button>
        }
      />

      {error && (
        <div className="mb-4 bg-maroon-900/30 border border-maroon-600/30 text-maroon-300 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} className="ml-auto text-maroon-300 hover:text-white"><X size={16} /></button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="glass p-3 text-center">
          <p className="text-white/95 text-2xl font-bold">{records.length}</p>
          <p className="text-white/40 text-xs">Total</p>
        </div>
        <div className="glass p-3 text-center border-green-500/20">
          <p className="text-green-400 text-2xl font-bold">{presentCount}</p>
          <p className="text-green-400/60 text-xs">Present</p>
        </div>
        <div className="glass p-3 text-center border-amber-500/20">
          <p className="text-amber-400 text-2xl font-bold">{lateCount}</p>
          <p className="text-amber-400/60 text-xs">Late</p>
        </div>
        <div className="glass p-3 text-center border-red-500/20">
          <p className="text-red-400 text-2xl font-bold">{absentCount}</p>
          <p className="text-red-400/60 text-xs">Absent</p>
        </div>
      </div>

      {/* Reopen banner if session was submitted */}
      {isLocked && (
        <div className="mb-6 p-4 glass-md rounded-xl border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/5">
          <div>
            <p className="text-sm font-semibold text-amber-300">Attendance Session Submitted (Locked)</p>
            <p className="text-xs text-white/50">Need to retake or take repeated attendance? Click below to re-open.</p>
          </div>
          <button
            onClick={handleReopenSession}
            className="btn-gradient px-4 py-2 rounded-lg text-xs font-semibold"
          >
            🔄 Re-open & Retake Attendance
          </button>
        </div>
      )}

      {/* Capture area: live camera + upload fallback */}
      {!isLocked && (
        <div className="mb-6 space-y-3">
          {/* Live camera block */}
          <div className="glass-md rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video size={16} className={(liveActive || webcamActive) ? 'text-red-400' : 'text-white/50'} />
                <span className="text-sm font-semibold text-white/80">
                  {webcamActive ? 'Laptop webcam active' : liveActive ? 'Class IP live feed' : 'Classroom Camera'}
                </span>
                {(liveActive || webcamActive) && (
                  <span className="flex items-center gap-1.5 ml-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-red-400 uppercase font-semibold tracking-wide">LIVE</span>
                  </span>
                )}
                {beepCountdown > 0 && (
                  <span className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                    <span className="text-xs font-bold text-amber-300 tabular-nums">
                      📸 Capturing in {beepCountdown}...
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Browser laptop webcam controls */}
                {!webcamActive ? (
                  <button
                    onClick={startWebcam}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                    title="Start laptop/desktop webcam"
                  >
                    <Video size={14} /> Open Laptop Webcam
                  </button>
                ) : (
                  <>
                    <button
                      onClick={captureWebcamSnapshot}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium disabled:opacity-50"
                    >
                      <Camera size={14} /> {uploading ? 'Processing...' : 'Capture Snapshot'}
                    </button>
                    <button
                      onClick={stopWebcam}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium"
                    >
                      <VideoOff size={14} /> Close
                    </button>
                  </>
                )}

                {/* RTSP / IP Camera controls */}
                {!liveActive ? (
                  <button
                    onClick={handleStartLive}
                    disabled={liveLoading || webcamActive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white text-xs font-medium disabled:opacity-50"
                  >
                    <Play size={14} /> {liveLoading ? 'Starting...' : 'IP Camera Feed'}
                  </button>
                ) : (
                  <button
                    onClick={handleStopLive}
                    disabled={liveLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-medium disabled:opacity-50"
                  >
                    <Square size={14} /> {liveLoading ? 'Stopping...' : 'Stop IP Feed'}
                  </button>
                )}
              </div>
            </div>

            {/* Video feed */}
            <div className="bg-black/50 relative aspect-video flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={clsx('w-full h-full object-contain', !webcamActive && 'hidden')}
              />
              {!webcamActive && (
                liveActive ? (
                  <img
                    src={`${AI_SERVICE_URL}/api/v1/camera/stream`}
                    alt="Classroom camera live feed"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-white/30 text-center px-4">
                    <VideoOff size={32} />
                    <p className="text-xs">Camera is off. Click "Open Laptop Webcam" to use your device or "Upload Classroom Group Photo" below.</p>
                  </div>
                )
              )}
            </div>

            {/* Live tally */}
            {liveActive && liveStatus && (
              <div className="px-4 py-3 border-t border-white/[0.06] bg-black/20">
                <div className="flex items-center justify-between gap-4 text-xs mb-2">
                  <div className="flex items-center gap-4">
                    <span className="text-white/60">
                      <span className="text-white/90 font-semibold">{liveStatus.totalSnapshots}</span> snapshots taken
                    </span>
                    <span className="text-white/40">
                      threshold: {(liveStatus.threshold * 100).toFixed(0)}% of snapshots
                    </span>
                  </div>
                  <span className="text-white/40">Next snapshot in ~{60 - Math.floor(((Date.now() - new Date(liveStatus.startedAt).getTime()) / 1000) % 60)}s</span>
                </div>
                {liveStatus.tally && liveStatus.tally.length > 0 && (
                  <div className="max-h-32 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/30">
                          <th className="text-left font-medium py-1">Student</th>
                          <th className="text-right font-medium py-1 w-24">Appearances</th>
                          <th className="text-right font-medium py-1 w-20">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveStatus.tally.slice(0, 10).map((t: any) => {
                          const rec = records.find((r) => r.studentId === t.studentId);
                          return (
                            <tr key={t.studentId} className="border-t border-white/[0.04]">
                              <td className="py-1 text-white/70">
                                {rec?.student ? `${rec.student.firstName} ${rec.student.lastName}` : t.studentId.slice(0, 8)}
                              </td>
                              <td className="py-1 text-right text-white/50 font-mono">
                                {t.count}/{liveStatus.totalSnapshots} ({(t.rate * 100).toFixed(0)}%)
                              </td>
                              <td className="py-1 text-right">
                                <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-medium', t.wouldBePresent ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400')}>
                                  {t.wouldBePresent ? 'PRESENT' : 'NOT YET'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Primary Group Photo Upload Dropzone */}
          <div className="glass-md p-4 rounded-xl border border-white/[0.08]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-maroon-400" />
                <span className="text-sm font-semibold text-white/90">Classroom Group Photo Attendance</span>
              </div>
              <span className="text-[11px] text-white/40">Batch facial detection & identification</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || liveActive}
              className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 py-5 px-4 glass border-2 border-dashed border-maroon-500/30 hover:border-maroon-500/60 hover:bg-maroon-700/10 rounded-xl transition-all disabled:opacity-50 group cursor-pointer"
            >
              {uploading ? (
                <>
                  <div className="w-6 h-6 border-2 border-maroon-700/30 border-t-maroon-500 rounded-full animate-spin" />
                  <span className="text-sm font-medium text-white/80">
                    Detecting faces & matching against enrolled cohort...
                  </span>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-full bg-maroon-600/20 text-maroon-400 group-hover:scale-110 transition-transform">
                    <Camera size={22} />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-medium text-white/90">
                      <span className="text-maroon-400 font-semibold">Click to upload class group photo</span> (or drag & drop)
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Wide-angle photo of students in lecture hall or lab. Automatically marks present.
                    </p>
                  </div>
                </>
              )}
            </button>
          </div>

          {aiResult && !aiResult.liveTally && (
            <div className="mt-2 text-sm text-white/70 glass bg-maroon-700/5 border-maroon-600/10 rounded-lg px-4 py-2">
              {aiResult.aiServiceAvailable
                ? `AI detected ${aiResult.facesDetected} faces, recognized ${aiResult.facesRecognized} students (${aiResult.processingTimeMs}ms)`
                : aiResult.message
              }
            </div>
          )}

          {aiResult?.liveTally && (
            <div className="mt-2 glass rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
                <Check size={14} className="text-green-400" />
                <span className="text-xs text-white/60 uppercase font-semibold">Live Capture Complete</span>
              </div>
              <div className="grid grid-cols-4 gap-px bg-white/[0.04]">
                <div className="bg-[#0a0a0f] px-4 py-3">
                  <p className="text-white/30 text-[10px] uppercase">Snapshots Taken</p>
                  <p className="text-lg font-bold text-white/90">{aiResult.liveTally.totalSnapshots}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-3">
                  <p className="text-white/30 text-[10px] uppercase">Threshold</p>
                  <p className="text-lg font-bold text-white/90">{(aiResult.liveTally.threshold * 100).toFixed(0)}%</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-3">
                  <p className="text-white/30 text-[10px] uppercase">Marked Present</p>
                  <p className="text-lg font-bold text-green-400">{aiResult.liveTally.markedPresent}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-3">
                  <p className="text-white/30 text-[10px] uppercase">Marked Absent</p>
                  <p className="text-lg font-bold text-red-400">{aiResult.liveTally.markedAbsent}</p>
                </div>
              </div>
            </div>
          )}

          {/* Accuracy Metrics Panel */}
          {aiResult?.metrics && (() => {
            const recognized = aiResult.recognizedStudents || [];
            const highConf = recognized.filter((s: any) => s.distance < 0.5).length;
            const medConf = recognized.filter((s: any) => s.distance >= 0.5 && s.distance < 0.7).length;
            const lowConf = recognized.filter((s: any) => s.distance >= 0.7).length;
            return (
            <div className="mt-3 glass rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
                <BarChart3 size={14} className="text-maroon-400" />
                <span className="text-xs text-white/40 uppercase font-semibold">Performance & Accuracy Metrics</span>
              </div>

              {/* Top-level stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04]">
                <div className="bg-[#0a0a0f] px-4 py-3">
                  <p className="text-white/30 text-[10px] uppercase font-medium">Recognition Rate</p>
                  <p className="text-lg font-bold text-maroon-400">{aiResult.metrics.recognitionRate}%</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-3">
                  <p className="text-white/30 text-[10px] uppercase font-medium">Threshold</p>
                  <p className="text-lg font-bold text-white/80">{aiResult.metrics.threshold}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-3">
                  <p className="text-white/30 text-[10px] uppercase font-medium">Avg Confidence</p>
                  <p className="text-lg font-bold text-green-400">{aiResult.metrics.avgConfidence != null ? `${aiResult.metrics.avgConfidence}%` : '—'}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-3">
                  <p className="text-white/30 text-[10px] uppercase font-medium">Processing Time</p>
                  <p className="text-lg font-bold text-white/80">{(aiResult.metrics.processingTimeMs / 1000).toFixed(1)}s</p>
                </div>
              </div>

              {/* Distance stats + Match quality tiers */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-white/[0.04]">
                <div className="bg-[#0a0a0f] px-4 py-2">
                  <p className="text-white/30 text-[10px] uppercase font-medium">Avg Distance</p>
                  <p className="text-sm font-semibold text-white/70">{aiResult.metrics.avgDistance ?? '—'}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-2">
                  <p className="text-white/30 text-[10px] uppercase font-medium">Min Distance</p>
                  <p className="text-sm font-semibold text-white/70">{aiResult.metrics.minDistance ?? '—'}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-2">
                  <p className="text-white/30 text-[10px] uppercase font-medium">Max Distance</p>
                  <p className="text-sm font-semibold text-white/70">{aiResult.metrics.maxDistance ?? '—'}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-2">
                  <p className="text-green-400/50 text-[10px] uppercase font-medium">High &lt;0.5</p>
                  <p className="text-sm font-semibold text-green-400">{highConf}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-2">
                  <p className="text-amber-400/50 text-[10px] uppercase font-medium">Medium 0.5-0.7</p>
                  <p className="text-sm font-semibold text-amber-400">{medConf}</p>
                </div>
                <div className="bg-[#0a0a0f] px-4 py-2">
                  <p className="text-red-400/50 text-[10px] uppercase font-medium">Low &gt;0.7</p>
                  <p className="text-sm font-semibold text-red-400">{lowConf}</p>
                </div>
              </div>

              {/* Per-student accuracy table */}
              {recognized.length > 0 && (
                <div className="border-t border-white/[0.04]">
                  <div className="px-4 py-2 border-b border-white/[0.04]">
                    <span className="text-[10px] text-white/30 uppercase font-semibold">Per-Student Breakdown</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.04] text-white/30">
                          <th className="px-4 py-1.5 text-left font-medium">Student</th>
                          <th className="px-3 py-1.5 text-right font-medium">Distance</th>
                          <th className="px-3 py-1.5 text-right font-medium">Confidence</th>
                          <th className="px-4 py-1.5 text-right font-medium">Accuracy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...recognized]
                          .sort((a: any, b: any) => a.distance - b.distance)
                          .map((s: any, i: number) => {
                            const accuracy = Math.max(0, Math.min(100, (1 - s.distance / 1.2) * 100));
                            const tierColor = s.distance < 0.5
                              ? 'text-green-400'
                              : s.distance < 0.7
                              ? 'text-amber-400'
                              : 'text-red-400';
                            return (
                              <tr key={i} className="border-b border-white/[0.03]">
                                <td className="px-4 py-1.5 text-white/70">
                                  <span className="text-white/40 mr-1.5">{s.registrationNumber}</span>
                                  {s.name}
                                </td>
                                <td className={clsx('px-3 py-1.5 text-right font-mono', tierColor)}>
                                  {s.distance.toFixed(4)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-white/60">
                                  {s.confidence.toFixed(1)}%
                                </td>
                                <td className="px-4 py-1.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                      <div
                                        className={clsx('h-full rounded-full', {
                                          'bg-green-500': accuracy >= 60,
                                          'bg-amber-500': accuracy >= 40 && accuracy < 60,
                                          'bg-red-500': accuracy < 40,
                                        })}
                                        style={{ width: `${accuracy}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-white/50 w-10 text-right">{accuracy.toFixed(0)}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="px-4 py-2 border-t border-white/[0.04] flex gap-4 text-[10px] text-white/30">
                <span>Enrolled: {aiResult.metrics.enrolledStudents}</span>
                <span>With Encodings: {aiResult.metrics.studentsWithEncodings}</span>
                <span>Image: {aiResult.metrics.imageWidth}x{aiResult.metrics.imageHeight}</span>
                <span>Unknown Faces: {aiResult.metrics.unknownFaces}</span>
              </div>
            </div>
            );
          })()}

          {/* Annotated image with face recognition results */}
          {aiResult?.annotatedImageBase64 && (
            <div className="mt-3 glass rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-white/40 uppercase font-semibold">Recognition Result</span>
                <span className="text-xs text-white/30">
                  {aiResult.facesRecognized}/{aiResult.facesDetected} matched
                </span>
              </div>
              <div className="p-2">
                <img
                  src={`data:image/jpeg;base64,${aiResult.annotatedImageBase64}`}
                  alt="Annotated class photo with face recognition"
                  className="w-full rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendance records table */}
      <div className="glass overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 text-left text-white/40 uppercase text-xs font-semibold">Reg #</th>
              <th className="px-4 py-3 text-left text-white/40 uppercase text-xs font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-white/40 uppercase text-xs font-semibold">Status</th>
              {!isLocked && <th className="px-4 py-3 text-left text-white/40 uppercase text-xs font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-white/[0.04]">
                <td className="px-4 py-3 text-sm text-white/50">{record.student?.registrationNumber}</td>
                <td className="px-4 py-3 text-sm text-white/90 font-medium">
                  {record.student?.firstName} {record.student?.lastName}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', {
                    'bg-green-500/20 text-green-400': record.status === 'PRESENT',
                    'bg-red-500/20 text-red-400': record.status === 'ABSENT',
                    'bg-amber-500/20 text-amber-400': record.status === 'LATE',
                    'bg-blue-500/20 text-blue-400': record.status === 'EXCUSED',
                  })}>
                    {record.status}
                  </span>
                </td>
                {!isLocked && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as AttendanceStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(record.studentId, status)}
                          className={clsx('px-2 py-1 text-xs rounded font-medium transition-colors', {
                            'bg-green-500 text-white': status === 'PRESENT' && record.status === status,
                            'bg-green-500/10 text-green-400 hover:bg-green-500/20': status === 'PRESENT' && record.status !== status,
                            'bg-red-500 text-white': status === 'ABSENT' && record.status === status,
                            'bg-red-500/10 text-red-400 hover:bg-red-500/20': status === 'ABSENT' && record.status !== status,
                            'bg-amber-500 text-black': status === 'LATE' && record.status === status,
                            'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20': status === 'LATE' && record.status !== status,
                            'bg-blue-500 text-white': status === 'EXCUSED' && record.status === status,
                            'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20': status === 'EXCUSED' && record.status !== status,
                          })}
                        >
                          {status.charAt(0)}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit & Download buttons */}
      {!isLocked && records.length > 0 && (
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Download size={16} />
            Download Attendance Sheet
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg disabled:opacity-50 font-medium text-sm transition-colors"
          >
            <Send size={16} />
            {submitting ? 'Submitting...' : 'Submit Attendance'}
          </button>
        </div>
      )}

      {isLocked && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="text-center text-sm glass bg-green-500/10 border-green-500/20 text-green-400 rounded-lg py-3 w-full">
            <Check size={16} className="inline mr-1" /> Attendance has been submitted and locked
          </div>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Download size={16} />
            Download Attendance Sheet
          </button>
        </div>
      )}
    </div>
  );
}
