"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

/**
 * LiveBarcodeScanner
 *
 * - NEVER uses OCR for barcodes (only real barcode decoders).
 * - Validates numeric codes with GTIN check digits when possible.
 * - Requires multi-frame consensus: same valid code must appear several times
 *   over a minimum time window before we accept it.
 *
 * Props:
 * - onDetected(code: string)           : callback when barcode is confidently detected
 * - readers = [...]                    : list of Quagga reader names
 * - enableBeep = true                  : play short beep on detection
 * - enableFlash = true                 : flash pulse overlay on detection
 * - keepScanning = false               : if true, scanner remains running after detection
 * - duplicateDelayMs = 3000            : debounce time for duplicate detections
 * - autoStart = false                  : start automatically on mount
 */

// --------- GTIN utilities (EAN-8, UPC-A, EAN-13, GTIN-14) ----------
const digitsOnly = (s) => String(s || "").replace(/\D/g, "");

function computeGtinCheckDigit(bodyDigits) {
  const digits = digitsOnly(bodyDigits);
  if (!digits.length) return null;

  // weight from rightmost: 3,1,3,1...
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 1; i >= 0; i--) {
    const n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return null;
    sum += n * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

function isValidGtin(fullDigits) {
  const d = digitsOnly(fullDigits);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const body = d.slice(0, -1);
  const check = Number(d.slice(-1));
  const expected = computeGtinCheckDigit(body);
  return expected !== null && check === expected;
}

/**
 * Normalize and validate.
 * - Strips non-digits
 * - Accepts GTIN lengths 8/12/13/14
 * - If 13 digits and starts with 0, try UPC-A (12) as well
 */
function normalizeAndValidate(rawValue) {
  const d = digitsOnly(rawValue);

  if (!d) return { ok: false, digits: "", reason: "empty" };

  // common quirk: some systems report UPC-A as 13 digits with leading 0
  if (d.length === 13 && d.startsWith("0")) {
    const maybeUpc = d.slice(1);
    if (isValidGtin(maybeUpc)) return { ok: true, digits: maybeUpc, type: "UPC-A" };
  }

  if ([8, 12, 13, 14].includes(d.length)) {
    if (isValidGtin(d)) return { ok: true, digits: d, type: "GTIN" };
    // checksum fail: don’t accept (prevents wrong products)
    return { ok: false, digits: d, reason: "checksum" };
  }

  // If it's not a standard GTIN length, treat as invalid for CheckPeak
  return { ok: false, digits: d, reason: "length" };
}

// --------- consensus logic ----------
function makeConsensusConfig() {
  return {
    minCount: 3,     // must appear at least this many times
    minSpanMs: 650,  // and over at least this long
    windowMs: 2500,  // keep detections within this sliding window
  };
}

export default function LiveBarcodeScanner({
  onDetected,
  readers = ["code_128_reader", "ean_reader", "ean_8_reader", "upc_reader"],
  enableBeep = true,
  enableFlash = true,
  keepScanning = false,
  duplicateDelayMs = 3000,
  autoStart = false,
}) {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const videoRef = useRef(null);

  const detectorLoopRef = useRef(null);
  const streamRef = useRef(null);

  const lastDetectedRef = useRef({ code: null, time: 0 });
  const recentDetectionsRef = useRef([]); // { code, ts }

  const barcodeDetectorRef = useRef(null);
  const quaggaRef = useRef(null);

  const [usingNative, setUsingNative] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Idle");

  const [flashPulse, setFlashPulse] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [facingMode, setFacingMode] = useState("environment");
  const [lastStableCode, setLastStableCode] = useState("");

  const fpsRef = useRef({ lastTs: 0, frames: 0, fps: 0 });

  const consensusCfg = useMemo(() => makeConsensusConfig(), []);

  /* -------------------------------------------------------------------------- */
  /*                    NEW: Zoom / Autofocus enhancements                       */
  /* -------------------------------------------------------------------------- */

  // Track zoom range / current
  const zoomCapsRef = useRef({ supported: false, min: 1, max: 1, current: 1 });
  const autoZoomRef = useRef({ enabled: true, lastBumpAt: 0 });

  const detectZoomCaps = useCallback(() => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      if (caps && typeof caps.zoom === "object") {
        zoomCapsRef.current = {
          supported: true,
          min: caps.zoom.min ?? 1,
          max: caps.zoom.max ?? 1,
          current: zoomCapsRef.current.current || (caps.zoom.min ?? 1),
        };
        return zoomCapsRef.current;
      }
    } catch {}
    zoomCapsRef.current = { supported: false, min: 1, max: 1, current: 1 };
    return zoomCapsRef.current;
  }, []);

  const applyZoom = useCallback(async (value) => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return false;
      const caps = detectZoomCaps();
      if (!caps.supported) return false;

      const next = Math.max(caps.min, Math.min(caps.max, value));
      await track.applyConstraints({ advanced: [{ zoom: next }] });
      zoomCapsRef.current.current = next;
      return true;
    } catch {
      return false;
    }
  }, [detectZoomCaps]);

  const applyCameraEnhancements = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return;

      // Autofocus/exposure hints (best-effort, ignored safely if unsupported)
      try {
        await track.applyConstraints?.({
          advanced: [
            { focusMode: "continuous" },
            { exposureMode: "continuous" },
            { whiteBalanceMode: "continuous" },
            // some Android builds support it, iOS ignores safely
            { focusDistance: 0 },
          ],
        });
      } catch {}

      // Initial digital zoom: keeps barcode large without forcing user far away
      detectZoomCaps();
      const z = zoomCapsRef.current;
      if (z.supported) {
        const initial = Math.min(z.max, Math.max(z.min, 1.6));
        await applyZoom(initial);
      }
    } catch {}
  }, [applyZoom, detectZoomCaps]);

  // Optional: if scanning stalls, gently bump zoom up (helps tiny barcodes)
  const maybeAutoZoomBump = useCallback(() => {
    const z = zoomCapsRef.current;
    if (!autoZoomRef.current.enabled || !z.supported) return;
    const now = Date.now();
    if (now - autoZoomRef.current.lastBumpAt < 900) return; // don't spam

    const next = Math.min(z.max, (z.current || 1) + 0.25);
    if (next > (z.current || 1) + 0.01) {
      autoZoomRef.current.lastBumpAt = now;
      applyZoom(next).catch(() => {});
    }
  }, [applyZoom]);

  /* -------------------------------------------------------------------------- */
  /*                             Feedback helpers                                */
  /* -------------------------------------------------------------------------- */

  const playBeep = useCallback(
    (freq = 900, duration = 120) => {
      if (!enableBeep) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
        osc.start(now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);

        setTimeout(() => {
          try {
            osc.stop();
            ctx.close();
          } catch {}
        }, duration + 30);
      } catch {
        // ignore audio failures
      }
    },
    [enableBeep]
  );

  const successFeedback = useCallback(() => {
    playBeep();
    try {
      if (navigator.vibrate) navigator.vibrate(120);
    } catch {}
    if (enableFlash) {
      setFlashPulse(true);
      setTimeout(() => setFlashPulse(false), 450);
    }
  }, [playBeep, enableFlash]);

  /* -------------------------------------------------------------------------- */
  /*                             Overlay helpers                                 */
  /* -------------------------------------------------------------------------- */

  const clearOverlay = useCallback(() => {
    try {
      const canvas = overlayRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch {}
  }, []);

  const drawBoxNative = useCallback((boxes = [], boundingBox = null, videoEl = null) => {
    try {
      const canvas = overlayRef.current;
      const ctx = canvas?.getContext("2d");
      const container = containerRef.current;
      if (!canvas || !ctx || !container || !videoEl) return;

      const rect = container.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,255,0,0.9)";
      ctx.fillStyle = "rgba(0,255,0,0.12)";

      const scaleX = canvas.width / (videoEl.videoWidth || 1);
      const scaleY = canvas.height / (videoEl.videoHeight || 1);

      if (Array.isArray(boxes) && boxes.length) {
        boxes.forEach((box) => {
          ctx.beginPath();
          box.forEach((p, i) => {
            const x = (p.x || 0) * scaleX;
            const y = (p.y || 0) * scaleY;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      } else if (boundingBox) {
        const x = (boundingBox.x || 0) * scaleX;
        const y = (boundingBox.y || 0) * scaleY;
        const w = (boundingBox.width || 0) * scaleX;
        const h = (boundingBox.height || 0) * scaleY;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
    } catch {}
  }, []);

  const trackFps = useCallback(() => {
    try {
      const now = performance.now();
      const s = fpsRef.current;
      if (!s.lastTs) s.lastTs = now;
      s.frames++;
      if (now - s.lastTs >= 1000) {
        s.fps = Math.round((s.frames * 1000) / (now - s.lastTs));
        s.frames = 0;
        s.lastTs = now;
      }
    } catch {}
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                               Torch helpers                                 */
  /* -------------------------------------------------------------------------- */

  const detectTorch = useCallback(async () => {
    try {
      const stream = streamRef.current;
      const track = stream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      setTorchAvailable(Boolean(caps && caps.torch));
    } catch {
      setTorchAvailable(false);
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return;
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((prev) => !prev);
    } catch (e) {
      console.warn("toggleTorch failed", e);
    }
  }, [torchOn]);

  /* -------------------------------------------------------------------------- */
  /*                     Dynamic import Quagga2 (mobile-safe)                    */
  /* -------------------------------------------------------------------------- */

  const getQuagga = useCallback(async () => {
    if (quaggaRef.current) return quaggaRef.current;

    try {
      const mod = await import("@ericblade/quagga2");
      quaggaRef.current = mod?.default || mod;
      return quaggaRef.current;
    } catch (e) {
      console.warn("Quagga2 import failed:", e);
      return null;
    }
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                      readers -> BarcodeDetector formats                      */
  /* -------------------------------------------------------------------------- */

  const readersToBarcodeDetectorFormats = useCallback((readerList = []) => {
    const out = new Set();
    const list = Array.isArray(readerList) ? readerList : [];
    const joined = list.map((r) => String(r || "").toLowerCase()).join(" ");

    if (joined.includes("upc")) {
      out.add("upc_a");
      out.add("upc_e");
    }
    if (joined.includes("ean_8") || joined.includes("ean8")) out.add("ean_8");
    if (joined.includes("ean")) out.add("ean_13");

    if (joined.includes("code_128")) out.add("code_128");
    if (joined.includes("code_39")) out.add("code_39");
    if (joined.includes("qr")) out.add("qr_code");
    if (joined.includes("data_matrix")) out.add("data_matrix");
    if (joined.includes("pdf_417") || joined.includes("pdf417")) out.add("pdf417");

    if (out.size === 0) {
      out.add("upc_a");
      out.add("upc_e");
      out.add("ean_13");
      out.add("ean_8");
    }
    return Array.from(out);
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                           Multi-frame consensus                              */
  /* -------------------------------------------------------------------------- */

  const considerCode = useCallback(
    (rawValue) => {
      const now = Date.now();
      const parsed = normalizeAndValidate(rawValue);
      if (!parsed.ok) return null;

      const digits = parsed.digits;

      recentDetectionsRef.current.push({ code: digits, ts: now });
      recentDetectionsRef.current = recentDetectionsRef.current.filter(
        (d) => now - d.ts < consensusCfg.windowMs
      );

      const occurrences = recentDetectionsRef.current.filter((d) => d.code === digits);

      if (
        occurrences.length >= consensusCfg.minCount &&
        occurrences[occurrences.length - 1].ts - occurrences[0].ts >= consensusCfg.minSpanMs
      ) {
        return digits;
      }
      return null;
    },
    [consensusCfg]
  );

  /* -------------------------------------------------------------------------- */
  /*                              Stop everything                                 */
  /* -------------------------------------------------------------------------- */

  const stop = useCallback(async () => {
    setStatusMsg("Stopping scanner...");

    // Cancel native loop
    try {
      if (detectorLoopRef.current) {
        cancelAnimationFrame(detectorLoopRef.current);
        detectorLoopRef.current = null;
      }
    } catch {}

    // Stop Quagga
    try {
      const Quagga = quaggaRef.current;
      if (Quagga) {
        try {
          Quagga.offDetected?.();
          Quagga.offProcessed?.();
        } catch {}
        try {
          Quagga.stop();
        } catch {}
      }
    } catch {}

    // Stop stream tracks
    try {
      const s = streamRef.current;
      if (s?.getTracks) {
        s.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
      }
      streamRef.current = null;
    } catch {}

    // Remove video element
    try {
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
        } catch {}
        try {
          v.srcObject = null;
        } catch {}
        const container = containerRef.current;
        if (container && v.parentElement === container) {
          try {
            container.removeChild(v);
          } catch {}
        }
      }
    } catch {}

    clearOverlay();
    setTorchOn(false);
    setTorchAvailable(false);
    setScannerStarted(false);
    setUsingNative(false);
    setStatusMsg("Scanner stopped");
  }, [clearOverlay]);

  /* -------------------------------------------------------------------------- */
  /*                        Native BarcodeDetector loop                            */
  /* -------------------------------------------------------------------------- */

  const startNativeLoop = useCallback(async () => {
    // Hard requirement: secure context on mobile
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setStatusMsg("Scanner unavailable: must use HTTPS on mobile");
      return false;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatusMsg("Scanner unavailable: getUserMedia not supported");
      return false;
    }

    if (!("BarcodeDetector" in window)) {
      setStatusMsg("Native BarcodeDetector not available");
      return false;
    }

    try {
      if (!barcodeDetectorRef.current) {
        const formats = readersToBarcodeDetectorFormats(readers);
        try {
          barcodeDetectorRef.current = new window.BarcodeDetector({ formats });
        } catch {
          barcodeDetectorRef.current = new window.BarcodeDetector();
        }
      }
    } catch (e) {
      console.warn("BarcodeDetector instantiation failed:", e);
      setStatusMsg("BarcodeDetector init failed");
      return false;
    }

    let videoEl = videoRef.current;
    if (!videoEl) {
      videoEl = document.createElement("video");
      videoEl.setAttribute("playsinline", "");
      videoEl.muted = true;
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
      videoEl.style.objectFit = "cover";
      videoRef.current = videoEl;
    }

    const container = containerRef.current;
    if (container && !container.contains(videoEl)) {
      container.innerHTML = "";
      container.appendChild(videoEl);
    }

    try {
      // camera constraints tuned for barcode scanning
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
          // hint focus behavior when supported (best-effort)
          focusMode: "continuous",
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      videoEl.srcObject = stream;

      // NEW: apply autofocus/zoom enhancements
      await applyCameraEnhancements();

      await videoEl.play().catch(() => {});
      setStatusMsg("Scanning (native)...");
      setUsingNative(true);
      detectTorch().catch(() => {});
    } catch (e) {
      console.warn("getUserMedia failed for native detector:", e);
      setStatusMsg("Camera access denied / unavailable");
      return false;
    }

    const loop = async () => {
      try {
        const detector = barcodeDetectorRef.current;
        const v = videoRef.current;

        if (!detector || !v || v.readyState < 2) {
          detectorLoopRef.current = requestAnimationFrame(loop);
          return;
        }

        try {
          const results = await detector.detect(v);
          trackFps();

          if (results?.length) {
            for (const r of results) {
              const rawValue = r.rawValue || (r.rawData ? String(r.rawData) : "");
              if (!rawValue) continue;

              const stable = considerCode(rawValue);
              if (!stable) {
                // NEW: if we’re not getting stable detections, gently bump zoom
                maybeAutoZoomBump();
                continue;
              }

              const now = Date.now();
              const last = lastDetectedRef.current;

              // debounce duplicates
              if (last.code === stable && now - last.time < duplicateDelayMs) continue;
              lastDetectedRef.current = { code: stable, time: now };

              clearOverlay();
              if (r.cornerPoints?.length) drawBoxNative([r.cornerPoints], null, v);
              else if (r.boundingBox) drawBoxNative([], r.boundingBox, v);

              successFeedback();
              setLastStableCode(stable);

              if (typeof onDetected === "function") {
                try {
                  onDetected(stable);
                } catch (e) {
                  console.warn("onDetected handler threw:", e);
                }
              }

              if (!keepScanning) {
                await stop();
                return;
              }
            }
          } else {
            // NEW: no results from detector → optional zoom bump
            maybeAutoZoomBump();
          }
        } catch (detErr) {
          console.warn("BarcodeDetector.detect() error:", detErr);
        }
      } catch (err) {
        console.error("Native detection loop failed:", err);
      } finally {
        detectorLoopRef.current = requestAnimationFrame(loop);
      }
    };

    detectorLoopRef.current = requestAnimationFrame(loop);
    return true;
  }, [
    readers,
    readersToBarcodeDetectorFormats,
    facingMode,
    considerCode,
    duplicateDelayMs,
    keepScanning,
    onDetected,
    stop,
    clearOverlay,
    drawBoxNative,
    successFeedback,
    detectTorch,
    trackFps,
    applyCameraEnhancements,
    maybeAutoZoomBump,
  ]);

  /* -------------------------------------------------------------------------- */
  /*                       Quagga fallback (dynamic import)                       */
  /* -------------------------------------------------------------------------- */

  const startQuagga = useCallback(async () => {
    // Hard requirement: secure context on mobile
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setStatusMsg("Scanner unavailable: must use HTTPS on mobile");
      return false;
    }

    const container = containerRef.current;
    if (!container) {
      setStatusMsg("No container for Quagga");
      return false;
    }

    const Quagga = await getQuagga();
    if (!Quagga) {
      setStatusMsg("Scanner unavailable (Quagga failed to load)");
      return false;
    }

    try {
      Quagga.offDetected?.();
      Quagga.offProcessed?.();
    } catch {}

    try {
      Quagga.stop();
    } catch {}

    const config = {
      inputStream: {
        type: "LiveStream",
        target: container,
        constraints: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        // Helps speed/accuracy by scanning the central region
        // Make this tighter if you want more focus on barcode only
        area: { top: "38%", right: "14%", left: "14%", bottom: "38%" },
      },
      locator: {
        patchSize: "medium",
        halfSample: true,
      },
      decoder: { readers },
      locate: true,
    };

    try {
      await new Promise((resolve, reject) => {
        Quagga.init(config, (err) => (err ? reject(err) : resolve()));
      });
      Quagga.start();
      setStatusMsg("Scanning (software)...");
      setUsingNative(false);
    } catch (err) {
      console.error("Quagga init/start failed:", err);
      setStatusMsg(`Quagga init failed: ${err?.message || "unknown"}`);
      return false;
    }

    // NEW: try to apply autofocus/zoom constraints if stream is accessible
    // Quagga owns the stream internally, so we can’t always reach the track.
    // We still attempt torch detection; zoom may not be possible here.
    setTimeout(() => detectTorch().catch(() => {}), 600);

    Quagga.onProcessed((result) => {
      try {
        const canvas = overlayRef.current;
        const ctx = canvas?.getContext("2d");
        const containerEl = containerRef.current;
        if (!canvas || !ctx || !containerEl) return;

        const rect = containerEl.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result?.box?.length) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,255,0,0.85)";
          ctx.beginPath();
          result.box.forEach((p, i) => {
            const x = (p.x / result.imgWidth) * canvas.width;
            const y = (p.y / result.imgHeight) * canvas.height;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.stroke();
        }
      } catch {}
    });

    Quagga.onDetected((data) => {
      try {
        const raw = data?.codeResult?.code;
        if (!raw) return;

        const stable = considerCode(raw);
        if (!stable) return;

        const now = Date.now();
        const last = lastDetectedRef.current;
        if (last.code === stable && now - last.time < duplicateDelayMs) return;
        lastDetectedRef.current = { code: stable, time: now };

        successFeedback();
        setLastStableCode(stable);

        if (typeof onDetected === "function") {
          try {
            onDetected(stable);
          } catch (e) {
            console.warn("onDetected handler threw:", e);
          }
        }

        if (!keepScanning) stop();
      } catch (e) {
        console.warn("Quagga onDetected handler error:", e);
      }
    });

    return true;
  }, [
    readers,
    facingMode,
    considerCode,
    duplicateDelayMs,
    keepScanning,
    onDetected,
    stop,
    successFeedback,
    detectTorch,
    getQuagga,
  ]);

  /* -------------------------------------------------------------------------- */
  /*                                  Start                                     */
  /* -------------------------------------------------------------------------- */

  const start = useCallback(async () => {
    if (scannerStarted) return;

    setStatusMsg("Starting scanner...");
    setScannerStarted(true);
    setLastStableCode("");
    recentDetectionsRef.current = [];
    lastDetectedRef.current = { code: null, time: 0 };

    let nativeStarted = false;

    if ("BarcodeDetector" in window && navigator.mediaDevices?.getUserMedia) {
      try {
        nativeStarted = await startNativeLoop();
      } catch (e) {
        console.warn("Native start failed:", e);
        nativeStarted = false;
      }
    }

    if (!nativeStarted) {
      try {
        const ok = await startQuagga();
        if (!ok) {
          setStatusMsg("Scanner unavailable");
          setScannerStarted(false);
        }
      } catch (e) {
        console.error("Quagga fallback failed:", e);
        setStatusMsg("Scanner failed");
        setScannerStarted(false);
      }
    }
  }, [scannerStarted, startNativeLoop, startQuagga]);

  const switchCamera = useCallback(async () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  // Restart on camera switch
  useEffect(() => {
    if (!scannerStarted) return;
    (async () => {
      await stop();
      await start();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => {
    if (autoStart) start();
    return () => {
      stop();
      try {
        quaggaRef.current?.offDetected?.();
        quaggaRef.current?.offProcessed?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-md mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800">Live Barcode Scanner</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 uppercase tracking-wide">
            Beta
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        {!scannerStarted ? (
          <button
            onClick={start}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm shadow hover:bg-blue-700"
          >
            Start Scanner
          </button>
        ) : (
          <button
            onClick={stop}
            className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm shadow hover:bg-red-600"
          >
            Stop Scanner
          </button>
        )}

        <button
          onClick={switchCamera}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
        >
          Switch Camera
        </button>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
          >
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}
      </div>

      {/* Video + overlay */}
      <div className="relative w-full max-w-md" style={{ paddingTop: "56%" }}>
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full bg-black rounded-lg overflow-hidden"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        />
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${
            flashPulse ? "opacity-60 bg-white/30" : "opacity-0"
          }`}
        />
        {/* Center viewfinder */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      {/* Status + last code */}
      <div className="flex flex-col items-center gap-1 text-xs text-gray-600">
        <div>
          {statusMsg}
          {fpsRef.current?.fps ? ` · ${fpsRef.current.fps} FPS` : ""}
          {usingNative ? " (native)" : scannerStarted ? " (software)" : ""}
        </div>

        {lastStableCode && (
          <div className="px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">
            Detected: <span className="font-mono">{lastStableCode}</span>
          </div>
        )}

        {!lastStableCode && scannerStarted && (
          <div className="text-[11px] text-gray-500">
            Tip: Hold ~6–10 inches away. Keep the barcode inside the box. Avoid glare; toggle torch if needed.
          </div>
        )}
      </div>
    </div>
  );
}
