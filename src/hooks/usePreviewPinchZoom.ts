import { type RefObject, useEffect, useRef } from "react";

type PreviewPinchZoomOptions = {
  min: number;
  max: number;
  zoom: number;
  setZoom: (next: number | ((current: number) => number)) => void;
  enabled?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function usePreviewPinchZoom<T extends HTMLElement>(
  stageRef: RefObject<T | null>,
  { min, max, zoom, setZoom, enabled = true }: PreviewPinchZoomOptions,
) {
  const zoomRef = useRef(zoom);
  const pinchDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (!enabled) return;
    const stage = stageRef.current;
    if (!stage) return;

    const updateZoom = (next: number) => {
      const rounded = Number(clamp(next, min, max).toFixed(2));
      zoomRef.current = rounded;
      setZoom(rounded);
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      updateZoom(zoomRef.current * Math.exp(-event.deltaY * 0.01));
    };

    const distanceBetweenTouches = (event: TouchEvent) => {
      const [first, second] = event.touches;
      return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) pinchDistanceRef.current = distanceBetweenTouches(event);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || pinchDistanceRef.current === null) return;
      event.preventDefault();
      const distance = distanceBetweenTouches(event);
      if (distance > 0) updateZoom(zoomRef.current * (distance / pinchDistanceRef.current));
      pinchDistanceRef.current = distance;
    };

    const resetPinch = () => {
      pinchDistanceRef.current = null;
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", resetPinch);
    stage.addEventListener("touchcancel", resetPinch);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", resetPinch);
      stage.removeEventListener("touchcancel", resetPinch);
    };
  }, [enabled, max, min, setZoom, stageRef]);
}