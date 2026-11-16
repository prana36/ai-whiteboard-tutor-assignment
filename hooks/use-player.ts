"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { estimateDuration, locateTime, timeline, type Lesson } from "@/lib/lesson";
import { apiHeaders } from "@/lib/client";

type Track = { url: string; duration: number };

export function usePlayer(lesson: Lesson | null) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [preparedCount, setPreparedCount] = useState(0);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [browserVoice, setBrowserVoice] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const positionRef = useRef(0);
  const resources = useRef<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const durations = useMemo(
    () =>
      lesson?.scenes.map(
        (scene, i) => tracks[i]?.duration || estimateDuration(scene.narration),
      ) || [1],
    [lesson, tracks],
  );
  const { starts, total } = useMemo(() => timeline(durations), [durations]);
  const { index, offset, progress } = locateTime(position, durations);
  const scene = lesson?.scenes[index];

  useEffect(() => {
    setSpeechSupported("speechSynthesis" in window);
  }, []);

  useEffect(() => {
    setPlaying(false);
    setPosition(0);
    positionRef.current = 0;
    setTracks([]);
    setError("");
    setPreparing(false);
    setPreparedCount(0);
    setBrowserVoice(lesson?.source === "sample");
    return () => {
      controller.current?.abort();
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      resources.current.forEach(URL.revokeObjectURL);
      resources.current = [];
    };
  }, [lesson]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const seek = useCallback(
    (time: number) => {
      const next = Math.max(0, Math.min(time, total));
      positionRef.current = next;
      setPosition(next);
      setRevision((n) => n + 1);
      if (next >= total) setPlaying(false);
    },
    [total],
  );

  // Real narration is the clock: the board's state is derived from HTMLAudioElement.currentTime.
  useEffect(() => {
    if (!lesson || !playing || !scene || !tracks[index] || browserVoice) return;
    const audio = new Audio(tracks[index].url);
    audioRef.current = audio;
    audio.playbackRate = rate;
    audio.muted = muted;
    audio.currentTime = Math.min(positionRef.current - starts[index], durations[index] - 0.01);
    audio.ontimeupdate = () => setPosition(starts[index] + audio.currentTime);
    audio.onended = () => {
      const end = starts[index] + durations[index];
      setPosition(end);
      if (index === lesson.scenes.length - 1) setPlaying(false);
    };
    audio.onerror = () => {
      setPlaying(false);
      setError("Audio playback failed. Try again or choose browser voice.");
    };
    void audio.play().catch(() => {
      setPlaying(false);
      setError("Your browser paused audio. Press Play to continue.");
    });
    return () => {
      audio.pause();
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
    };
  }, [lesson, playing, index, tracks, browserVoice, revision, starts, durations]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      audioRef.current.muted = muted;
    }
  }, [rate, muted]);

  // Sample/fallback mode uses actual speech boundary events. Seeking restarts at a nearby word.
  useEffect(() => {
    if (!lesson || !playing || !browserVoice || !scene) return;
    if (!("speechSynthesis" in window)) {
      setPlaying(false);
      setError(
        "This browser doesn't support browser voice. Use AI voice or a browser with text-to-speech support.",
      );
      return;
    }
    const full = scene.narration;
    const fraction = Math.max(
      0,
      Math.min(0.999, (positionRef.current - starts[index]) / durations[index]),
    );
    const targetChar = Math.floor(fraction * full.length);
    const startChar = targetChar > 0 ? full.lastIndexOf(" ", targetChar - 1) + 1 : 0;
    const utterance = new SpeechSynthesisUtterance(full.slice(startChar));
    utterance.lang = "en-US";
    utterance.rate = rate * 0.95;
    utterance.volume = muted ? 0 : 1;
    const voice = speechSynthesis
      .getVoices()
      .find(
        (voice) => voice.lang.startsWith("en") && /natural|samantha|google|jenny/i.test(voice.name),
      );
    if (voice) utterance.voice = voice;
    utterance.onboundary = (event) => {
      setPosition(starts[index] + ((startChar + event.charIndex) / full.length) * durations[index]);
    };
    utterance.onend = () => {
      setPosition(starts[index] + durations[index]);
      if (index === lesson.scenes.length - 1) setPlaying(false);
    };
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setPlaying(false);
        setError("Browser voice is unavailable. Try another browser or use AI voice.");
      }
    };
    speechSynthesis.speak(utterance);
    return () => {
      utterance.onend = null;
      utterance.onerror = null;
      utterance.onboundary = null;
      speechSynthesis.cancel();
    };
  }, [lesson, playing, browserVoice, index, revision, rate, muted, starts, durations, scene]);

  async function prepare() {
    if (!lesson || preparing) return;
    const activeLesson = lesson;
    const abort = new AbortController();
    controller.current = abort;
    setPreparing(true);
    setPreparedCount(0);
    setError("");
    const result: Track[] = new Array(activeLesson.scenes.length);
    const created: string[] = [];
    let cursor = 0;
    try {
      async function worker() {
        while (cursor < activeLesson.scenes.length) {
          const i = cursor++;
          const response = await fetch("/api/speech", {
            method: "POST",
            headers: apiHeaders(),
            body: JSON.stringify({ text: activeLesson.scenes[i].narration }),
            signal: abort.signal,
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Couldn't generate narration.");
          }
          const blob = await response.blob();
          if (abort.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          const duration = await new Promise<number>((resolve, reject) => {
            const audio = new Audio();
            const timeout = setTimeout(() => {
              cleanup();
              reject(new Error("Audio took too long to load. Please try again."));
            }, 15_000);
            const cleanup = () => {
              clearTimeout(timeout);
              audio.onloadedmetadata = null;
              audio.onerror = null;
              audio.removeAttribute("src");
              audio.load();
            };
            audio.onloadedmetadata = () => {
              const duration = audio.duration;
              cleanup();
              Number.isFinite(duration) && duration > 0
                ? resolve(duration)
                : reject(new Error("Invalid narration audio."));
            };
            audio.onerror = () => {
              cleanup();
              reject(new Error("Your browser couldn't load the narration."));
            };
            audio.preload = "metadata";
            audio.src = url;
          });
          if (abort.signal.aborted) return;
          result[i] = { url, duration };
          setPreparedCount((n) => n + 1);
        }
      }
      await Promise.all([worker(), worker()]);
      if (!abort.signal.aborted) {
        resources.current.push(...created);
        setTracks(result);
        setPosition(0);
        positionRef.current = 0;
        // A second explicit Play click preserves browser autoplay policies after async generation.
      }
    } catch (error) {
      const canceled = abort.signal.aborted;
      abort.abort();
      created.forEach(URL.revokeObjectURL);
      if (!canceled)
        setError(error instanceof Error ? error.message : "Couldn't prepare narration.");
    } finally {
      if (controller.current === abort) setPreparing(false);
    }
  }

  function toggle() {
    setError("");
    if (playing) {
      setPlaying(false);
      return;
    }
    if (!browserVoice && !tracks.length) {
      void prepare();
      return;
    }
    if (position >= total - 0.05) seek(0);
    setPlaying(true);
  }

  function useBrowserVoice(value: boolean) {
    setPlaying(false);
    setBrowserVoice(value);
    seek(0);
    setError("");
  }

  return {
    playing,
    position,
    rate,
    setRate,
    muted,
    setMuted,
    durations,
    starts,
    total,
    index,
    offset,
    progress,
    scene,
    preparing,
    preparedCount,
    error,
    toggle,
    seek,
    pause: () => setPlaying(false),
    restart: () => {
      seek(0);
      setPlaying(false);
    },
    browserVoice,
    useBrowserVoice,
    speechSupported,
    audioReady: tracks.length > 0,
    prepare,
  };
}
