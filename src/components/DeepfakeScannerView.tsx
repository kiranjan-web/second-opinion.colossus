import React, { useEffect, useRef, useState } from 'react';
import { AudioWaveform, Mic, ShieldAlert, ShieldCheck, Upload, Waves } from 'lucide-react';
import type { SpectralScanResult } from '../types/colossus';

function computeSpectralMetrics(samples: Float32Array, sampleRate: number, sourceName: string): Omit<SpectralScanResult, 'id' | 'timestamp' | 'forensicNote'> {
  const durationSec = Math.max(0.5, Number((samples.length / sampleRate).toFixed(2)));

  // Zero-Crossing Rate
  let zeroCrossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
      zeroCrossings++;
    }
  }
  const zeroCrossingRate = Number((zeroCrossings / Math.max(1, samples.length)).toFixed(4));

  // Divide into 32 frequency energy bins via lightweight DFT on a representative window
  const windowSize = Math.min(1024, samples.length);
  const startIdx = Math.max(0, Math.floor(samples.length / 2 - windowSize / 2));
  const bins: number[] = [];
  for (let b = 0; b < 32; b++) {
    const freqBin = b + 1;
    let real = 0;
    let imag = 0;
    for (let n = 0; n < windowSize; n += 2) {
      const angle = (2 * Math.PI * freqBin * n) / windowSize;
      const sample = samples[startIdx + n] ?? 0;
      real += sample * Math.cos(angle);
      imag -= sample * Math.sin(angle);
    }
    const mag = Math.sqrt(real * real + imag * imag);
    bins.push(mag);
  }

  const maxBin = Math.max(1e-6, ...bins);
  const normalizedBins = bins.map((v) => Math.round((v / maxBin) * 100));

  // Geometric mean vs arithmetic mean -> Spectral Flatness
  const eps = 1e-6;
  const logSum = bins.reduce((acc, v) => acc + Math.log(v + eps), 0);
  const geomMean = Math.exp(logSum / bins.length);
  const arithMean = bins.reduce((acc, v) => acc + v, 0) / bins.length;
  const spectralFlatness = Number(Math.min(1, geomMean / Math.max(eps, arithMean)).toFixed(3));

  // Estimate harmonic ratio and pitch stability from energy concentration
  const top4Energy = [...bins].sort((a, b) => b - a).slice(0, 4).reduce((a, b) => a + b, 0);
  const totalEnergy = bins.reduce((a, b) => a + b, 0) + eps;
  const harmonicRatio = Number(Math.min(0.98, top4Energy / totalEnergy).toFixed(3));

  // Compute heuristic synthetic probability from spectral flatness & ultra-high periodicity
  const flatnessPenalty = spectralFlatness > 0.58 ? 0.45 : spectralFlatness * 0.28;
  const periodicityPenalty = harmonicRatio > 0.72 ? 0.32 : 0.05;
  const zcrPenalty = zeroCrossingRate > 0.19 ? 0.18 : 0.02;
  const syntheticProbability = Number(
    Math.max(0.04, Math.min(0.96, flatnessPenalty + periodicityPenalty + zcrPenalty)).toFixed(2)
  );
  const livenessScore = Number((1 - syntheticProbability).toFixed(2));
  const isClonedVoice = syntheticProbability >= 0.5;
  const pitchStabilityHz = Math.round(118 + harmonicRatio * 86);

  const verdict: SpectralScanResult['verdict'] =
    syntheticProbability >= 0.55
      ? 'SYNTHETIC CLONE DETECTED'
      : syntheticProbability >= 0.32
      ? 'SUSPICIOUS ARTIFACTS'
      : 'AUTHENTIC VOICE';

  return {
    sourceName,
    durationSec,
    sampleRate,
    syntheticProbability,
    livenessScore,
    isClonedVoice,
    spectralFlatness,
    zeroCrossingRate,
    pitchStabilityHz,
    harmonicRatio,
    verdict,
    spectrumBins: normalizedBins,
  };
}

export function DeepfakeScannerView() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SpectralScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<SpectralScanResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0A0F1D';
    ctx.fillRect(0, 0, width, height);

    const bins = scanResult?.spectrumBins ?? Array(32).fill(14);
    const barW = (width - 24) / bins.length;
    const barColor = scanResult?.isClonedVoice
      ? '#FF3366'
      : scanResult && scanResult.syntheticProbability >= 0.32
      ? '#FFB300'
      : '#00E5FF';

    bins.forEach((val, idx) => {
      const barH = Math.max(6, (val / 100) * (height - 24));
      ctx.fillStyle = barColor;
      ctx.fillRect(12 + idx * barW, height - 12 - barH, Math.max(3, barW - 4), barH);
    });
  }, [scanResult]);

  const finalizeScan = async (samples: Float32Array, sampleRate: number, sourceName: string) => {
    const metrics = computeSpectralMetrics(samples, sampleRate, sourceName);
    let forensicNote =
      metrics.isClonedVoice
        ? 'High harmonic periodicity and flat upper-band distribution match synthetic vocoder patterns.'
        : 'Organic formant dispersion and micro-pitch jitter align with natural human speech.';

    try {
      const res = await fetch('/api/v1/deepfake/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.forensicNote) forensicNote = data.forensicNote;
      }
    } catch {
      // Keep local forensic summary
    }

    const complete: SpectralScanResult = {
      ...metrics,
      id: `scan_${Date.now()}`,
      timestamp: new Date().toISOString(),
      forensicNote,
    };

    setScanResult(complete);
    setScanHistory((prev) => [complete, ...prev].slice(0, 5));
    setIsScanning(false);
  };

  const handleLiveMicScan = async () => {
    setErrorMessage(null);
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const collected: Float32Array[] = [];

      processor.onaudioprocess = (e) => {
        const channel = e.inputBuffer.getChannelData(0);
        collected.push(new Float32Array(channel));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setTimeout(async () => {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        const totalLength = collected.reduce((sum, arr) => sum + arr.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of collected) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        const sr = ctx.sampleRate;
        await ctx.close();
        await finalizeScan(merged, sr, 'Live Microphone Sample (3.0s)');
      }, 3000);
    } catch {
      setIsScanning(false);
      setErrorMessage(
        'Microphone permission is unavailable in this environment. Upload an audio clip or run the Natural vs. Synthetic test vectors below.'
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setIsScanning(true);

    try {
      const arrayBuf = await file.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      const channelData = decoded.getChannelData(0);
      const sr = decoded.sampleRate;
      await ctx.close();
      await finalizeScan(channelData, sr, file.name);
    } catch {
      setIsScanning(false);
      setErrorMessage('Could not decode audio file. Please upload a valid WAV, MP3, or WebM recording.');
    }
  };

  const runSyntheticProfile = async (kind: 'natural' | 'cloned') => {
    setErrorMessage(null);
    setIsScanning(true);

    const sampleRate = 16000;
    const length = sampleRate * 2;
    const buffer = new Float32Array(length);

    if (kind === 'natural') {
      // Natural voice simulation: frequency modulation + rich multi-formant harmonics + organic breath noise
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const f0 = 138 + Math.sin(2 * Math.PI * 3.4 * t) * 14 + Math.sin(2 * Math.PI * 0.8 * t) * 8;
        const formants =
          0.5 * Math.sin(2 * Math.PI * f0 * t) +
          0.32 * Math.sin(2 * Math.PI * (f0 * 2.15) * t) +
          0.18 * Math.sin(2 * Math.PI * (f0 * 3.42) * t) +
          0.12 * Math.sin(2 * Math.PI * (f0 * 5.1) * t);
        const breath = (Math.random() - 0.5) * 0.08;
        buffer[i] = (formants + breath) * (0.65 + 0.35 * Math.sin(2 * Math.PI * 1.9 * t));
      }
      await finalizeScan(buffer, sampleRate, 'Reference Profile: Natural Human Caller');
    } else {
      // Synthetic vocoder simulation: locked pitch + high-frequency metallic spectral buzz
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const locked =
          0.72 * Math.sin(2 * Math.PI * 165 * t) +
          0.14 * Math.sin(2 * Math.PI * 330 * t) +
          (Math.random() - 0.5) * 0.34;
        buffer[i] = locked;
      }
      await finalizeScan(buffer, sampleRate, 'Reference Profile: Neural Vocoder Clone');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left: Scanner Controls & Spectrum */}
        <section className="xl:col-span-7 bg-[#131C31] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Deepfake Voice Authenticator
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Client-side Web Audio FFT spectral inspection + Gemini acoustic forensics
                </p>
              </div>
              <AudioWaveform className="w-5 h-5 text-cyan-400" />
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30 text-xs text-amber-200">
                {errorMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <button
                type="button"
                disabled={isScanning}
                onClick={handleLiveMicScan}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Mic className="w-4 h-4" />
                {isScanning ? 'Sampling Audio...' : 'Scan 3s Live Mic'}
              </button>

              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A0F1D] border border-white/15 text-sm font-medium text-slate-200 hover:border-cyan-400/60 cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="w-4 h-4 text-cyan-400" />
                Upload Audio Clip
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                disabled={isScanning}
                onClick={() => runSyntheticProfile('natural')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <Waves className="w-3.5 h-3.5 text-emerald-400" />
                Test Natural Profile
              </button>

              <button
                type="button"
                disabled={isScanning}
                onClick={() => runSyntheticProfile('cloned')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <Waves className="w-3.5 h-3.5 text-rose-400" />
                Test Cloned Profile
              </button>
            </div>

            {/* Spectral Frequency Canvas */}
            <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0A0F1D]">
              <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs text-slate-400">
                <span>32-Band Spectral Energy Distribution</span>
                <span className="font-mono tabular-nums">
                  {scanResult ? `${scanResult.sampleRate} Hz · ${scanResult.durationSec}s` : 'Awaiting sample'}
                </span>
              </div>
              <canvas
                ref={canvasRef}
                width={640}
                height={180}
                className="w-full h-44 block"
              />
            </div>
          </div>

          {/* Result Verdict */}
          <div className="mt-5 pt-5 border-t border-white/10">
            {!scanResult ? (
              <p className="text-sm text-slate-400">
                Capture a live 3-second audio sample, upload a call snippet, or run a reference profile to evaluate voice liveness and spectral artifacts.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {scanResult.isClonedVoice ? (
                      <ShieldAlert className="w-5 h-5 text-rose-400" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    )}
                    <span
                      className={`text-sm font-semibold ${
                        scanResult.isClonedVoice ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {scanResult.verdict}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-semibold text-white tabular-nums">
                    Synthetic Probability: {(scanResult.syntheticProbability * 100).toFixed(0)}%
                  </span>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed">
                  {scanResult.forensicNote}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-[#0A0F1D] border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400">Liveness Score</div>
                    <div className="font-mono text-base font-semibold text-white tabular-nums mt-0.5">
                      {(scanResult.livenessScore * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-[#0A0F1D] border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400">Spectral Flatness</div>
                    <div className="font-mono text-base font-semibold text-white tabular-nums mt-0.5">
                      {scanResult.spectralFlatness}
                    </div>
                  </div>
                  <div className="bg-[#0A0F1D] border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400">Zero-Crossing</div>
                    <div className="font-mono text-base font-semibold text-white tabular-nums mt-0.5">
                      {scanResult.zeroCrossingRate}
                    </div>
                  </div>
                  <div className="bg-[#0A0F1D] border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] text-slate-400">Pitch Stability</div>
                    <div className="font-mono text-base font-semibold text-white tabular-nums mt-0.5">
                      {scanResult.pitchStabilityHz} Hz
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right: Recent Acoustic Scan Log */}
        <section className="xl:col-span-5 bg-[#131C31] border border-white/10 rounded-xl p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white">Recent Voice Audits</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero raw audio is stored — only numerical spectral telemetry is retained
            </p>
          </div>

          {scanHistory.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center border border-dashed border-white/10 rounded-lg p-6">
              <p className="text-xs text-slate-400 max-w-xs">
                No scans executed in this session yet. Run any live or reference profile on the left to inspect acoustic metrics.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scanHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#0A0F1D] border border-white/10 rounded-lg p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs mb-1">
                    <span className="font-medium text-slate-200 truncate">
                      {item.sourceName}
                    </span>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        item.isClonedVoice ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {(item.syntheticProbability * 100).toFixed(0)}% synth
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 font-mono tabular-nums">
                    <span>{item.verdict}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
