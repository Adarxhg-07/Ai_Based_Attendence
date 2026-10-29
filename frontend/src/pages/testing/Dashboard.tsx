import { useState, useEffect, useRef } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  Upload, Download, Users, BarChart3, Image, FlaskConical,
  AlertCircle, X, ChevronDown, ChevronUp, Video, VideoOff,
  Camera, Zap, ZapOff, Play, Square,
} from 'lucide-react';
import clsx from 'clsx';
import { playCountdownBeeps, primeAudio } from '../../lib/audio';

const AI_SERVICE_URL = (import.meta as any).env?.VITE_AI_SERVICE_URL || 'http://localhost:8000';
// Tester dashboard: beep for this many seconds before snapshot
const TESTER_BEEP_SECONDS = 2;

interface RecognizedStudent {
  studentId: string;
  registrationNumber: string;
  name: string;
  confidence: number;
  distance: number;
  matchMethod?: string;
  faceLocation: { x1: number; y1: number; x2: number; y2: number };
}

interface RecognitionResult {
  facesDetected: number;
  facesRecognized: number;
  recognizedStudents: RecognizedStudent[];
  unknownFaces: Array<{ faceLocation: any; confidence: number }>;
  annotatedImageBase64?: string;
  processingTimeMs: number;
  metrics?: any;
}

interface ImageResult {
  filename: string;
  result: RecognitionResult;
}

interface RegisteredStudent {
  studentId: string;
  name: string;
  registrationNumber: string;
  encodingCount: number;
}

type Tab = 'recognize' | 'camera' | 'students';

export default function TestingDashboard() {
  const [tab, setTab] = useState<Tab>('recognize');
  const [results, setResults] = useState<ImageResult[]>([]);
  const [students, setStudents] = useState<RegisteredStudent[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data } = await api.get('/testing/students');
      setStudents(data.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');
    setResults([]);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }

      const { data } = await api.post('/testing/recognize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      setResults(data.data || []);
      if (data.data?.length > 0) setExpandedIdx(0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadExcel = async (imageResult: ImageResult) => {
    try {
      // Build student list: recognized = PRESENT, get all registered for ABSENT
      const allStudents = students.length > 0 ? students : (await api.get('/testing/students')).data.data || [];
      const presentIds = new Set(imageResult.result.recognizedStudents.map((s) => s.studentId));

      const excelStudents = allStudents.map((s: RegisteredStudent) => {
        const recognized = imageResult.result.recognizedStudents.find((r) => r.studentId === s.studentId);
        return {
          registrationNumber: s.registrationNumber,
          name: s.name,
          status: presentIds.has(s.studentId) ? 'PRESENT' : 'ABSENT',
          confidence: recognized?.confidence,
          distance: recognized?.distance,
          matchMethod: recognized?.matchMethod,
        };
      });

      const res = await api.post('/testing/download-excel', {
        students: excelStudents,
        title: `Test Recognition - ${imageResult.filename}`,
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = res.headers['content-disposition'];
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'test_attendance.xlsx';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Testing Dashboard"
        description="Test AI model recognition on any image"
        action={
          <div className="flex items-center gap-2 text-xs text-white/30">
            <FlaskConical size={14} /> Developer Tools
          </div>
        }
      />

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-600/30 text-red-300 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] w-fit">
        <button
          onClick={() => setTab('recognize')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            tab === 'recognize'
              ? 'bg-maroon-700/30 text-maroon-300 border border-maroon-600/25'
              : 'text-white/50 hover:text-white/80'
          )}
        >
          <Image size={16} /> Test Recognition
        </button>
        <button
          onClick={() => setTab('camera')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            tab === 'camera'
              ? 'bg-maroon-700/30 text-maroon-300 border border-maroon-600/25'
              : 'text-white/50 hover:text-white/80'
          )}
        >
          <Video size={16} /> Live Camera
        </button>
        <button
          onClick={() => setTab('students')}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            tab === 'students'
              ? 'bg-maroon-700/30 text-maroon-300 border border-maroon-600/25'
              : 'text-white/50 hover:text-white/80'
          )}
        >
          <Users size={16} /> Registered Students
        </button>
      </div>

      {/* ── Test Recognition Tab ── */}
      {tab === 'recognize' && (
        <div>
          {/* Upload area */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
              uploading
                ? 'border-maroon-600/30 bg-maroon-900/10'
                : 'border-white/10 hover:border-maroon-600/40 hover:bg-white/[0.02]'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-maroon-700/30 border-t-maroon-600 rounded-full animate-spin" />
                <p className="text-white/60 text-sm">Processing images...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload size={36} className="text-white/30" />
                <p className="text-white/70 font-medium">Drop class photos here or click to upload</p>
                <p className="text-white/30 text-xs">Supports single or bulk upload (up to 20 images)</p>
              </div>
            )}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
                <BarChart3 size={16} /> Results ({results.length} image{results.length > 1 ? 's' : ''})
              </h3>

              {results.map((imgResult, idx) => (
                <ResultCard
                  key={idx}
                  imageResult={imgResult}
                  expanded={expandedIdx === idx}
                  onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  onDownload={() => handleDownloadExcel(imgResult)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Live Camera Tab ── */}
      {tab === 'camera' && <CameraPanel onError={setError} />}

      {/* ── Registered Students Tab ── */}
      {tab === 'students' && (
        <div className="glass rounded-2xl overflow-hidden">
          {loadingStudents ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-maroon-700/30 border-t-maroon-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-sm text-white/60">
                  {students.length} students registered in model
                </span>
                <button onClick={loadStudents} className="text-xs text-maroon-400 hover:text-maroon-300">
                  Refresh
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-white/40 text-xs uppercase">
                    <th className="text-left px-5 py-3">#</th>
                    <th className="text-left px-5 py-3">Registration No.</th>
                    <th className="text-left px-5 py-3">Name</th>
                    <th className="text-center px-5 py-3">Encodings</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.studentId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-5 py-2.5 text-white/40">{i + 1}</td>
                      <td className="px-5 py-2.5 text-white/70 font-mono text-xs">{s.registrationNumber}</td>
                      <td className="px-5 py-2.5 text-white/90">{s.name}</td>
                      <td className="px-5 py-2.5 text-center text-white/50">{s.encodingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Result Card Component ── */
function ResultCard({
  imageResult,
  expanded,
  onToggle,
  onDownload,
}: {
  imageResult: ImageResult;
  expanded: boolean;
  onToggle: () => void;
  onDownload: () => void;
}) {
  const { result, filename } = imageResult;
  const metrics = result.metrics;
  const rate = result.facesDetected > 0
    ? ((result.facesRecognized / result.facesDetected) * 100).toFixed(1)
    : '0';

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/90 font-medium">{filename}</span>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-400">{result.facesRecognized} recognized</span>
            <span className="text-white/30">|</span>
            <span className="text-white/50">{result.facesDetected} detected</span>
            <span className="text-white/30">|</span>
            <span className="text-blue-400">{rate}%</span>
            <span className="text-white/30">|</span>
            <span className="text-white/40">{result.processingTimeMs}ms</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-colors"
          >
            <Download size={13} /> Excel
          </button>
          {expanded ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
            <MetricCard label="Faces Detected" value={result.facesDetected} />
            <MetricCard label="Faces Recognized" value={result.facesRecognized} color="green" />
            <MetricCard label="Recognition Rate" value={`${rate}%`} color="blue" />
            <MetricCard label="Processing Time" value={`${result.processingTimeMs}ms`} />
            {metrics && (
              <>
                <MetricCard label="Avg Confidence" value={metrics.avgConfidence ? `${metrics.avgConfidence.toFixed(1)}%` : '-'} color="purple" />
                <MetricCard label="Avg Distance" value={metrics.avgDistance?.toFixed(4) || '-'} />
                <MetricCard label="Threshold" value={metrics.threshold} />
                <MetricCard label="Unknown Faces" value={result.unknownFaces.length} color={result.unknownFaces.length > 0 ? 'red' : undefined} />
              </>
            )}
          </div>

          {/* Annotated Image */}
          {result.annotatedImageBase64 && (
            <div className="px-5 pb-4">
              <p className="text-xs text-white/40 mb-2">Annotated Image</p>
              <img
                src={`data:image/jpeg;base64,${result.annotatedImageBase64}`}
                alt="Annotated"
                className="rounded-xl border border-white/[0.06] max-h-[500px] object-contain w-full bg-black/30"
              />
            </div>
          )}

          {/* Per-student table */}
          {result.recognizedStudents.length > 0 && (
            <div className="px-5 pb-5">
              <p className="text-xs text-white/40 mb-2">Recognized Students ({result.recognizedStudents.length})</p>
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/[0.03] text-white/40 uppercase">
                      <th className="text-left px-3 py-2">Reg No.</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-center px-3 py-2">Distance</th>
                      <th className="text-center px-3 py-2">Confidence</th>
                      <th className="text-center px-3 py-2">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.recognizedStudents]
                      .sort((a, b) => a.distance - b.distance)
                      .map((s, i) => (
                        <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-white/60 font-mono">{s.registrationNumber}</td>
                          <td className="px-3 py-2 text-white/90">{s.name}</td>
                          <td className="px-3 py-2 text-center text-white/50">{s.distance.toFixed(4)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={clsx(
                              'font-medium',
                              s.confidence >= 70 ? 'text-green-400' :
                                s.confidence >= 50 ? 'text-blue-400' :
                                  s.confidence >= 30 ? 'text-amber-400' : 'text-red-400'
                            )}>
                              {s.confidence.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 text-[10px]">
                              {s.matchMethod || 'distance'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Live Camera Panel ── */
function CameraPanel({ onError }: { onError: (s: string) => void }) {
  const [health, setHealth] = useState<any>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [liveDetectionOn, setLiveDetectionOn] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [flashBusy, setFlashBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [streamNonce, setStreamNonce] = useState(Date.now());
  const [streamEnabled, setStreamEnabled] = useState(true);

  useEffect(() => {
    loadHealth();
    // Auto-retry health every 10s while it's still null/unavailable so a
    // transient failure (AI service restart, etc.) self-recovers without
    // requiring the user to click Refresh.
    const retry = window.setInterval(() => {
      setHealth((cur: any) => {
        if (!cur || !cur.available) loadHealth();
        return cur;
      });
    }, 10000);

    return () => {
      window.clearInterval(retry);
      // Best-effort cleanup on unmount
      api.post('/testing/camera/flash/off').catch(() => {});
      api.post('/testing/camera/live-detection/stop').catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHealth = async () => {
    try {
      const { data } = await api.get('/testing/camera/health');
      setHealth(data.data);
    } catch (err) {
      // Don't toast on auto-retries — only the explicit Refresh button surfaces it
      // (user clicking Refresh wires straight to loadHealth which catches errors below)
    }
  };

  const refreshHealth = async () => {
    try {
      const { data } = await api.get('/testing/camera/health');
      setHealth(data.data);
    } catch (err) {
      onError(getErrorMessage(err));
    }
  };

  const toggleFlash = async () => {
    if (flashBusy) return;
    setFlashBusy(true);
    try {
      const url = flashOn ? '/testing/camera/flash/off' : '/testing/camera/flash/on';
      await api.post(url);
      setFlashOn(!flashOn);
      // The stream serves boosted frames only on subsequent reads; force the
      // browser to reconnect so the user sees the change immediately.
      setStreamNonce(Date.now());
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setFlashBusy(false);
    }
  };

  const toggleLiveDetection = async () => {
    if (liveBusy) return;
    setLiveBusy(true);
    try {
      const url = liveDetectionOn
        ? '/testing/camera/live-detection/stop'
        : '/testing/camera/live-detection/start';
      await api.post(url);
      setLiveDetectionOn(!liveDetectionOn);
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setLiveBusy(false);
    }
  };

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    setResult(null);
    // Unlock Web Audio on click (required by most browsers)
    primeAudio();

    // Beep countdown for TESTER_BEEP_SECONDS, then snapshot
    playCountdownBeeps(TESTER_BEEP_SECONDS, { spacingMs: 1000 });
    setCountdown(TESTER_BEEP_SECONDS);
    let remaining = TESTER_BEEP_SECONDS;
    const ticker = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining > 0 ? remaining : 0);
      if (remaining <= 0) window.clearInterval(ticker);
    }, 1000);

    // Wait for the full countdown to elapse, then capture
    await new Promise((r) => setTimeout(r, TESTER_BEEP_SECONDS * 1000));

    try {
      const { data } = await api.post('/testing/camera/recognize', {}, { timeout: 60000 });
      setResult(data.data);
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      window.clearInterval(ticker);
      setCountdown(0);
      setCapturing(false);
    }
  };

  const streamUrl = `${AI_SERVICE_URL}/api/v1/camera/stream?overlay=${liveDetectionOn ? 1 : 0}&n=${streamNonce}`;
  const rate = result && result.facesDetected > 0
    ? ((result.facesRecognized / result.facesDetected) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="glass rounded-xl px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-2.5 h-2.5 rounded-full',
            health?.available ? 'bg-green-500 animate-pulse' : 'bg-red-500',
          )} />
          <div>
            <p className="text-sm font-medium text-white/90">
              {health?.available ? 'Camera connected' : 'Camera unavailable'}
            </p>
            {health?.available && (
              <p className="text-[11px] text-white/40">
                {health.width}×{health.height} • IMOU • 192.168.1.75
              </p>
            )}
          </div>
        </div>
        <button
          onClick={refreshHealth}
          className="text-xs text-maroon-400 hover:text-maroon-300"
        >
          Refresh
        </button>
      </div>

      {/* Main camera card */}
      <div className="glass-md rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Video size={16} className={streamEnabled ? 'text-maroon-400' : 'text-white/30'} />
            <span className="text-sm font-semibold text-white/80">Classroom Camera</span>
            {liveDetectionOn && (
              <span className="flex items-center gap-1.5 ml-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400 uppercase font-semibold tracking-wide">
                  LIVE DETECTION
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleFlash}
              disabled={flashBusy || !health?.available}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40',
                flashOn
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
                  : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08] border border-white/10',
              )}
            >
              {flashOn ? <Zap size={13} /> : <ZapOff size={13} />}
              {flashOn ? 'Flash ON' : 'Flash OFF'}
            </button>
            <button
              onClick={toggleLiveDetection}
              disabled={liveBusy || !health?.available}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40',
                liveDetectionOn
                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30'
                  : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08] border border-white/10',
              )}
            >
              {liveDetectionOn ? <Square size={13} /> : <Play size={13} />}
              {liveDetectionOn ? 'Stop Detection' : 'Start Live Detection'}
            </button>
            <button
              onClick={() => {
                setStreamEnabled((s) => !s);
                if (!streamEnabled) setStreamNonce(Date.now());
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-white/70 hover:bg-white/[0.08] border border-white/10"
            >
              {streamEnabled ? <VideoOff size={13} /> : <Video size={13} />}
              {streamEnabled ? 'Pause Feed' : 'Resume Feed'}
            </button>
            <button
              onClick={handleCapture}
              disabled={capturing || !health?.available}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-500 hover:to-maroon-600 text-white disabled:opacity-40"
            >
              <Camera size={13} />
              {countdown > 0
                ? `Capturing in ${countdown}...`
                : capturing
                  ? 'Processing...'
                  : 'Capture & Recognize'}
            </button>
          </div>
        </div>

        {/* Video feed */}
        <div className="bg-black/50 relative aspect-video flex items-center justify-center">
          {streamEnabled && health?.available ? (
            <img
              key={streamNonce}
              src={streamUrl}
              alt="Classroom camera live feed"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/30">
              <VideoOff size={32} />
              <p className="text-xs">
                {health?.available ? 'Feed paused' : 'Camera unavailable'}
              </p>
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-black/20 border-t border-white/[0.06] flex items-center gap-4 text-[11px] text-white/40">
          <span>
            Flash: <span className={flashOn ? 'text-amber-300' : 'text-white/60'}>{flashOn ? 'ON (virtual / CLAHE)' : 'OFF'}</span>
          </span>
          <span>
            Live detection: <span className={liveDetectionOn ? 'text-red-300' : 'text-white/60'}>{liveDetectionOn ? 'running @ ~1 Hz' : 'off'}</span>
          </span>
          <span className="ml-auto">Stream: overlay={liveDetectionOn ? 1 : 0}</span>
        </div>
      </div>

      {/* Recognition result from most recent capture */}
      {result && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/90 font-medium">Snapshot Result</span>
              <span className="text-xs text-green-400">{result.facesRecognized} recognized</span>
              <span className="text-xs text-white/50">{result.facesDetected} detected</span>
              <span className="text-xs text-blue-400">{rate}%</span>
              <span className="text-xs text-white/40">{result.processingTimeMs}ms</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
            <MetricCard label="Faces Detected" value={result.facesDetected} />
            <MetricCard label="Faces Recognized" value={result.facesRecognized} color="green" />
            <MetricCard label="Recognition Rate" value={`${rate}%`} color="blue" />
            <MetricCard label="Processing Time" value={`${result.processingTimeMs}ms`} />
            {result.metrics && (
              <>
                <MetricCard
                  label="Avg Confidence"
                  value={result.metrics.avgConfidence ? `${result.metrics.avgConfidence.toFixed(1)}%` : '-'}
                  color="purple"
                />
                <MetricCard
                  label="Avg Distance"
                  value={result.metrics.avgDistance?.toFixed(4) || '-'}
                />
                <MetricCard label="Threshold" value={result.metrics.threshold} />
                <MetricCard
                  label="Unknown Faces"
                  value={result.unknownFaces.length}
                  color={result.unknownFaces.length > 0 ? 'red' : undefined}
                />
              </>
            )}
          </div>

          {result.annotatedImageBase64 && (
            <div className="px-5 pb-4">
              <p className="text-xs text-white/40 mb-2">Annotated Snapshot</p>
              <img
                src={`data:image/jpeg;base64,${result.annotatedImageBase64}`}
                alt="Annotated snapshot"
                className="rounded-xl border border-white/[0.06] max-h-[500px] object-contain w-full bg-black/30"
              />
            </div>
          )}

          {result.recognizedStudents.length > 0 && (
            <div className="px-5 pb-5">
              <p className="text-xs text-white/40 mb-2">
                Recognized Students ({result.recognizedStudents.length})
              </p>
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/[0.03] text-white/40 uppercase">
                      <th className="text-left px-3 py-2">Reg No.</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-center px-3 py-2">Distance</th>
                      <th className="text-center px-3 py-2">Confidence</th>
                      <th className="text-center px-3 py-2">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.recognizedStudents]
                      .sort((a, b) => a.distance - b.distance)
                      .map((s, i) => (
                        <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-white/60 font-mono">{s.registrationNumber}</td>
                          <td className="px-3 py-2 text-white/90">{s.name}</td>
                          <td className="px-3 py-2 text-center text-white/50">{s.distance.toFixed(4)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={clsx(
                              'font-medium',
                              s.confidence >= 70 ? 'text-green-400' :
                                s.confidence >= 50 ? 'text-blue-400' :
                                  s.confidence >= 30 ? 'text-amber-400' : 'text-red-400',
                            )}>
                              {s.confidence.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 text-[10px]">
                              {s.matchMethod || 'distance'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorClass = color === 'green' ? 'text-green-400' :
    color === 'blue' ? 'text-blue-400' :
      color === 'red' ? 'text-red-400' :
        color === 'purple' ? 'text-purple-400' : 'text-white/80';
  return (
    <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.04]">
      <p className="text-[10px] uppercase text-white/30 mb-1">{label}</p>
      <p className={clsx('text-lg font-bold', colorClass)}>{value}</p>
    </div>
  );
}
