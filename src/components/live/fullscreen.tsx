"use client";

import { ArrowsInIcon, ArrowsOutIcon } from "@phosphor-icons/react";
import { useEffect, useState, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}
const isFullscreen = () => document.fullscreenElement != null;

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

/**
 * Tam ekran düğmesi + `F` kısayolu. Tam ekranda imleç 3 sn hareketsiz kalınca gizlenir (TV'de ekranın
 * ortasında ok kalmasın); fare kıpırdayınca geri gelir.
 */
export function FullscreenToggle() {
  const active = useSyncExternalStore(subscribe, isFullscreen, () => false);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey && !(event.target instanceof HTMLInputElement)) toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!active) return;
    let timer = setTimeout(() => setIdle(true), 3_000);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3_000);
    };
    window.addEventListener("mousemove", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      setIdle(false);
    };
  }, [active]);

  useEffect(() => {
    document.documentElement.style.cursor = active && idle ? "none" : "";
  }, [active, idle]);

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      aria-label={active ? "Tam ekrandan çık (F)" : "Tam ekran (F)"}
      title={active ? "Tam ekrandan çık (F)" : "Tam ekran (F)"}
      className="grid size-9 cursor-pointer place-items-center rounded-sm border border-line-strong text-soft transition-colors hover:border-soft hover:text-fg"
    >
      {active ? <ArrowsInIcon size={18} /> : <ArrowsOutIcon size={18} />}
    </button>
  );
}
