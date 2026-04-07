import { useState, useRef, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, Send, Zap, Play, Square, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useVehicles } from '../vehicles/use-vehicles';
import { useRoutes } from '../routes/use-routes';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';


const CDMX_PRESETS = [
  { label: 'Zócalo',     lat: 19.4326, lng: -99.1332 },
  { label: 'Reforma',    lat: 19.4284, lng: -99.1676 },
  { label: 'Polanco',    lat: 19.4330, lng: -99.1898 },
  { label: 'Aeropuerto', lat: 19.4361, lng: -99.0719 },
  { label: 'Coyoacán',   lat: 19.3500, lng: -99.1619 },
];

function computeBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function DevPingPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'manual' | 'sim' | 'desvio'>('manual');

  // ── Manual tab ──────────────────────────────────────────────────────────────
  const [vehicleId, setVehicleId] = useState('');
  const [lat, setLat] = useState('19.4326');
  const [lng, setLng] = useState('-99.1332');
  const [speed, setSpeed] = useState('45');
  const [heading, setHeading] = useState('90');
  const [manualStatus, setManualStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [manualError, setManualError] = useState('');

  // ── Sim tab ──────────────────────────────────────────────────────────────────
  const [simRouteId, setSimRouteId] = useState('');
  const [simVehicleId, setSimVehicleId] = useState('');
  const [simIntervalMs, setSimIntervalMs] = useState(600);
  const [simStep, setSimStep] = useState(0);
  const [simRunning, setSimRunning] = useState(false);
  const [simDone, setSimDone] = useState(false);
  const [simError, setSimError] = useState('');

  // ── Desvío tab ───────────────────────────────────────────────────────────────
  const [devRouteId, setDevRouteId] = useState('');
  const [devVehicleId, setDevVehicleId] = useState('');
  const [devOffsetM, setDevOffsetM] = useState(120);         // metros de desvío lateral
  const [devRunning, setDevRunning] = useState(false);
  const [devStep, setDevStep] = useState(0);
  const [devDone, setDevDone] = useState(false);
  const [devError, setDevError] = useState('');
  const devIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);

  const { data: vehicles = [] } = useVehicles();
  const { data: routes = [] } = useRoutes();

  const routesWithPoly = useMemo(
    () => routes.filter((r) => r.polyline_coords && r.polyline_coords.length >= 2),
    [routes],
  );

  // polyline_coords is stored as GeoJSON [lng, lat] — flip to {lat, lng}
  const simCoords = useMemo(() => {
    const route = routesWithPoly.find((r) => r.id === simRouteId);
    if (!route?.polyline_coords) return [];
    return route.polyline_coords.map(([lngVal, latVal]) => ({ lat: latVal, lng: lngVal }));
  }, [simRouteId, routesWithPoly]);

  const stopSim = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setSimRunning(false);
    setSimDone(false);
    setSimError('');
    stepRef.current = 0;
    setSimStep(0);
  }, []);

  /** Desplaza una coordenada N metros en dirección perpendicular a la ruta (offset lateral) */
  function lateralOffset(pt: { lat: number; lng: number }, bearing: number, meters: number) {
    const perpBearing = (bearing + 90) % 360; // 90° perpendicular a la dirección de marcha
    const R = 6_371_000;
    const d = meters / R;
    const lat1 = (pt.lat * Math.PI) / 180;
    const lng1 = (pt.lng * Math.PI) / 180;
    const brng = (perpBearing * Math.PI) / 180;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );
    return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
  }

  const stopDev = useCallback(() => {
    if (devIntervalRef.current) { clearInterval(devIntervalRef.current); devIntervalRef.current = null; }
    setDevRunning(false); setDevDone(false); setDevError(''); setDevStep(0);
  }, []);

  const devCoords = useMemo(() => {
    const route = routesWithPoly.find((r) => r.id === devRouteId);
    if (!route?.polyline_coords) return [];
    return route.polyline_coords.map(([lngVal, latVal]) => ({ lat: latVal, lng: lngVal }));
  }, [devRouteId, routesWithPoly]);

  const startDev = useCallback(async () => {
    if (devCoords.length < 2 || !devVehicleId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDevError('Sin sesión activa'); return; }

    const token = session.access_token;
    const total = devCoords.length;
    let step = 0;
    setDevStep(0); setDevDone(false); setDevRunning(true); setDevError('');

    const id = setInterval(() => {
      if (step >= total) {
        clearInterval(id); devIntervalRef.current = null;
        setDevRunning(false); setDevDone(true); return;
      }
      const pt = devCoords[step];
      const next = devCoords[Math.min(step + 1, total - 1)];
      const hdg = Math.round(computeBearing(pt, next));
      // Aplicar offset lateral para simular desviación fuera del corredor
      const offPt = lateralOffset(pt, hdg, devOffsetM);

      fetch(`${BACKEND_URL}/api/v1/tracking/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicleId: devVehicleId,
          routeId: devRouteId,
          coordinate: offPt,
          speedKmh: 35,
          headingDeg: hdg,
          recordedAt: new Date().toISOString(),
        }),
      }).catch((err: unknown) => { setDevError((err as Error).message); clearInterval(id); setDevRunning(false); });

      step++;
      setDevStep(step);
    }, 600);
    devIntervalRef.current = id;
  }, [devCoords, devVehicleId, devRouteId, devOffsetM]);

  const devPct = devCoords.length > 0 ? Math.round((devStep / devCoords.length) * 100) : 0;

  const startSim = useCallback(async () => {
    if (simCoords.length < 2 || !simVehicleId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSimError('Sin sesión activa'); return; }

    stepRef.current = 0;
    setSimStep(0);
    setSimDone(false);
    setSimRunning(true);
    setSimError('');

    const token = session.access_token;
    const total = simCoords.length;

    const id = setInterval(() => {
      const idx = stepRef.current;
      if (idx >= total) {
        clearInterval(id);
        intervalRef.current = null;
        setSimRunning(false);
        setSimDone(true);
        return;
      }
      const coord = simCoords[idx];
      const nextCoord = simCoords[Math.min(idx + 1, total - 1)];
      const hdg = Math.round(computeBearing(coord, nextCoord));

      fetch(`${BACKEND_URL}/api/v1/tracking/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicleId: simVehicleId,
          routeId: simRouteId,
          coordinate: coord,
          speedKmh: 40,
          headingDeg: hdg,
          recordedAt: new Date().toISOString(),
        }),
      }).catch((err: unknown) => {
        setSimError((err as Error).message);
        clearInterval(id);
        intervalRef.current = null;
        setSimRunning(false);
      });

      stepRef.current = idx + 1;
      setSimStep(idx + 1);
    }, simIntervalMs);
    intervalRef.current = id;
  }, [simCoords, simVehicleId, simRouteId, simIntervalMs]);

  const sendManualPing = async () => {
    if (!vehicleId) return;
    setManualStatus('sending');
    setManualError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');
      const res = await fetch(`${BACKEND_URL}/api/v1/tracking/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          vehicleId,
          coordinate: { lat: Number(lat), lng: Number(lng) },
          speedKmh: Number(speed),
          headingDeg: Number(heading),
          recordedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      setManualStatus('ok');
      setTimeout(() => setManualStatus('idle'), 2000);
    } catch (err) {
      setManualStatus('error');
      setManualError((err as Error).message);
    }
  };

  const simPct = simCoords.length > 0 ? Math.round((simStep / simCoords.length) * 100) : 0;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[460px]">
      <div className="rounded-2xl border border-amber-500/30 bg-card/95 shadow-2xl backdrop-blur-md overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            DEV · Simulador GPS
            {simRunning && <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
          </div>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        {open && (
          <div className="border-t border-amber-500/20">
            {/* Tabs */}
            <div className="flex border-b border-amber-500/20">
              {(['manual', 'sim', 'desvio'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${tab === t ? 'bg-amber-500/10 text-amber-400' : 'text-muted-foreground hover:text-amber-400'}`}>
                  {t === 'manual' ? 'Ping manual' : t === 'sim' ? 'Ruta normal' : '⚠ Desvío'}
                </button>
              ))}
            </div>


            {/* ── Manual tab ── */}
            {tab === 'manual' && (
              <div className="px-4 py-3 space-y-3">
                <div className="space-y-1">
                  <label htmlFor="dp-vehicle" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Vehículo</label>
                  <select id="dp-vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-amber-500/50 focus:outline-none">
                    <option value="">— Selecciona —</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.alias ?? v.plate} ({v.plate})</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CDMX_PRESETS.map((p) => (
                    <button key={p.label} type="button" onClick={() => { setLat(String(p.lat)); setLng(String(p.lng)); }}
                      className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] hover:border-amber-500/40 hover:text-amber-400 transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label htmlFor="dp-lat" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Lat</label>
                    <input id="dp-lat" type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)}
                      className="w-full rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs font-mono focus:border-amber-500/50 focus:outline-none" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label htmlFor="dp-lng" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Lng</label>
                    <input id="dp-lng" type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)}
                      className="w-full rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs font-mono focus:border-amber-500/50 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="dp-speed" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">km/h</label>
                    <input id="dp-speed" type="number" min="0" max="200" value={speed} onChange={(e) => setSpeed(e.target.value)}
                      className="w-full rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs font-mono focus:border-amber-500/50 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="dp-heading" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">°</label>
                    <input id="dp-heading" type="number" min="0" max="360" value={heading} onChange={(e) => setHeading(e.target.value)}
                      className="w-full rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs font-mono focus:border-amber-500/50 focus:outline-none" />
                  </div>
                  <div className="col-span-2 flex items-end">
                    <button type="button" onClick={sendManualPing} disabled={!vehicleId || manualStatus === 'sending'}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                        manualStatus === 'ok' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                        : manualStatus === 'error' ? 'bg-destructive/20 border border-destructive/40 text-destructive'
                        : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30'}`}>
                      <Send className="h-3 w-3" />
                      {manualStatus === 'sending' ? 'Enviando…' : manualStatus === 'ok' ? 'Enviado' : manualStatus === 'error' ? 'Error' : 'Enviar ping'}
                    </button>
                  </div>
                </div>
                {manualError && <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive font-mono break-all">{manualError}</p>}
              </div>
            )}

            {/* ── Sim tab ── */}
            {tab === 'sim' && (
              <div className="px-4 py-3 space-y-3">
                <div className="space-y-1">
                  <label htmlFor="sim-route" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ruta</label>
                  <select id="sim-route" value={simRouteId} onChange={(e) => { setSimRouteId(e.target.value); stopSim(); }}
                    disabled={simRunning}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-amber-500/50 focus:outline-none disabled:opacity-50">
                    <option value="">— Selecciona una ruta —</option>
                    {routesWithPoly.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.origin_name} → {r.dest_name})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="sim-vehicle" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Vehículo</label>
                  <select id="sim-vehicle" value={simVehicleId} onChange={(e) => { setSimVehicleId(e.target.value); stopSim(); }}
                    disabled={simRunning}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-amber-500/50 focus:outline-none disabled:opacity-50">
                    <option value="">— Selecciona —</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.alias ?? v.plate} ({v.plate})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Velocidad de simulación</p>
                  <div className="flex gap-1.5">
                    {[{ label: 'Lento', ms: 1200 }, { label: 'Normal', ms: 600 }, { label: 'Rápido', ms: 150 }].map((opt) => (
                      <button key={opt.label} type="button" disabled={simRunning}
                        onClick={() => setSimIntervalMs(opt.ms)}
                        className={`flex-1 rounded-lg border py-1 text-[10px] transition-colors disabled:opacity-50 ${simIntervalMs === opt.ms ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-border/50 text-muted-foreground hover:border-amber-500/30'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {simCoords.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Progreso</span>
                      <span>{simStep} / {simCoords.length} · {simPct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                      <div className="h-full rounded-full bg-amber-400 transition-all duration-150" style={{ width: `${simPct}%` }} />
                    </div>
                    {simDone && <p className="text-[10px] text-emerald-400">Simulación completada — historial guardado</p>}
                    {simError && <p className="text-[10px] font-mono break-all text-destructive">{simError}</p>}
                  </div>
                )}
                <div className="flex gap-2">
                  {!simRunning ? (
                    <button type="button" disabled={!simRouteId || !simVehicleId || simCoords.length < 2}
                      onClick={() => void startSim()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors">
                      <Play className="h-3 w-3" />
                      {simCoords.length > 0 ? `Iniciar (${simCoords.length} pts)` : 'Iniciar'}
                    </button>
                  ) : (
                    <button type="button" onClick={stopSim}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors">
                      <Square className="h-3 w-3" /> Detener
                    </button>
                  )}
                  {!simRunning && (simStep > 0 || simDone) && (
                    <button type="button" onClick={stopSim}
                      className="flex items-center justify-center gap-1 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* ── Desvio tab ── */}
            {tab === 'desvio' && (
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                  <p className="text-[10px] text-destructive font-medium">
                    Simula el vehículo desviado lateralmente N metros fuera de la ruta
                  </p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="dev-route" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ruta</label>
                  <select id="dev-route" value={devRouteId}
                    onChange={(e) => { setDevRouteId(e.target.value); stopDev(); }}
                    disabled={devRunning}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-destructive/50 focus:outline-none disabled:opacity-50">
                    <option value="">— Selecciona una ruta —</option>
                    {routesWithPoly.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.origin_name} → {r.dest_name})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="dev-vehicle" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Vehículo</label>
                  <select id="dev-vehicle" value={devVehicleId}
                    onChange={(e) => { setDevVehicleId(e.target.value); stopDev(); }}
                    disabled={devRunning}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-destructive/50 focus:outline-none disabled:opacity-50">
                    <option value="">— Selecciona —</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.alias ?? v.plate} ({v.plate})</option>
                    ))}
                  </select>
                </div>
                {/* Offset slider */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label htmlFor="dev-offset" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Desvio lateral</label>
                    <span className="text-[10px] font-bold text-destructive">{devOffsetM} m</span>
                  </div>
                  <input id="dev-offset" type="range" min="50" max="500" step="10"
                    value={devOffsetM} disabled={devRunning}
                    onChange={(e) => setDevOffsetM(Number(e.target.value))}
                    className="w-full accent-destructive disabled:opacity-50" />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60">
                    <span>50 m (borde ruta)</span><span>500 m (muy lejos)</span>
                  </div>
                </div>
                {/* Progreso */}
                {devCoords.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Progreso</span>
                      <span>{devStep} / {devCoords.length} · {devPct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                      <div className="h-full rounded-full bg-destructive transition-all duration-150" style={{ width: `${devPct}%` }} />
                    </div>
                    {devDone && <p className="text-[10px] text-emerald-400">Simulación de desvío completada</p>}
                    {devError && <p className="text-[10px] font-mono break-all text-destructive">{devError}</p>}
                  </div>
                )}
                {/* Botones */}
                <div className="flex gap-2">
                  {!devRunning ? (
                    <button type="button"
                      disabled={!devRouteId || !devVehicleId || devCoords.length < 2}
                      onClick={() => void startDev()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-40 transition-colors">
                      <AlertTriangle className="h-3 w-3" />
                      {devCoords.length > 0 ? `Simular desvío (${devCoords.length} pts)` : 'Simular desvío'}
                    </button>
                  ) : (
                    <button type="button" onClick={stopDev}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-background/50 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                      <Square className="h-3 w-3" /> Detener
                    </button>
                  )}
                  {!devRunning && (devStep > 0 || devDone) && (
                    <button type="button" onClick={stopDev}
                      className="flex items-center justify-center gap-1 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
