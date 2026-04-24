// ─── usePanicHold.ts ─────────────────────────────────────────────────────────
// Maneja el long-press del botón SOS: countdown de 5s, pulso animado, vibración.

import { useState, useRef, useCallback } from 'react';
import { Vibration, Alert } from 'react-native';
import {
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import { PANIC_HOLD_MS } from '../lib/constants';

interface UsePanicHoldParams {
  isTracking: boolean;
  onTrigger:  () => Promise<void>;
}

export function usePanicHold({ isTracking, onTrigger }: UsePanicHoldParams) {
  const [panicHolding,   setPanicHolding]   = useState(false);
  const [panicCountdown, setPanicCountdown] = useState(5);
  const panicTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panicIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panicPulse       = useSharedValue(1);

  const panicStyle = useAnimatedStyle(() => ({
    transform: [{ scale: panicPulse.value }],
  }));

  const cancelPanicHold = useCallback(() => {
    if (panicTimerRef.current)    { clearTimeout(panicTimerRef.current);     panicTimerRef.current    = null; }
    if (panicIntervalRef.current) { clearInterval(panicIntervalRef.current); panicIntervalRef.current = null; }
    panicPulse.value = withTiming(1, { duration: 200 });
    setPanicHolding(false);
    setPanicCountdown(5);
  }, [panicPulse]);

  const handlePanicPressIn = useCallback(() => {
    if (!isTracking) return;
    setPanicHolding(true);
    setPanicCountdown(5);
    Vibration.vibrate(40);

    const pulse = () => {
      panicPulse.value = withTiming(1.18, { duration: 250 }, (done) => {
        if (done) panicPulse.value = withTiming(1.0, { duration: 250 }, (d) => { if (d) pulse(); });
      });
    };
    pulse();

    let count = 5;
    panicIntervalRef.current = setInterval(() => {
      count -= 1;
      setPanicCountdown(count);
      Vibration.vibrate(30);
    }, 1000);

    panicTimerRef.current = setTimeout(() => {
      cancelPanicHold();
      void onTrigger();
    }, PANIC_HOLD_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, onTrigger]);

  const handlePanicPressOut = useCallback(() => cancelPanicHold(), [cancelPanicHold]);

  return {
    panicHolding,
    panicCountdown,
    panicStyle,
    handlePanicPressIn,
    handlePanicPressOut,
  };
}
