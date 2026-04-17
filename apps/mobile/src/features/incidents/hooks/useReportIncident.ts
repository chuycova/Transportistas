// ─── features/incidents/hooks/useReportIncident.ts ───────────────────────────
// Hook que crea un incidente en Supabase y sube las evidencias al Storage bucket
// "evidence". Retorna { report, uploading, error }.

import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type IncidentType =
  | 'mechanical'
  | 'route_deviation'
  | 'accident'
  | 'weather'
  | 'cargo'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ReportIncidentInput {
  tripId?:     string;
  vehicleId?:  string;
  type:        IncidentType;
  severity:    IncidentSeverity;
  description?: string;
  lat?:        number;
  lng?:        number;
  images:      ImagePicker.ImagePickerAsset[];
}

export interface ReportedIncident {
  id:   string;
  code: string;
}

// ─── Helper: decodifica base64 a Uint8Array sin Buffer ───────────────────────
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReportIncident() {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const report = useCallback(async (input: ReportIncidentInput): Promise<ReportedIncident | null> => {
    setUploading(true);
    setError(null);

    try {
      // ── Auth ───────────────────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión activa');
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string | undefined;
      if (!tenantId) throw new Error('Sin tenant_id en la sesión');

      // ── Generar código ─────────────────────────────────────────────────────
      const { data: code, error: codeErr } = await supabase.rpc('generate_incident_code');
      if (codeErr) throw new Error(codeErr.message);

      // ── Crear incidente ────────────────────────────────────────────────────
      const { data: incident, error: incErr } = await supabase
        .from('incidents')
        .insert({
          tenant_id:   tenantId,
          driver_id:   user.id,
          code:        code as string,
          trip_id:     input.tripId    ?? null,
          vehicle_id:  input.vehicleId ?? null,
          type:        input.type,
          severity:    input.severity,
          description: input.description ?? null,
          lat:         input.lat ?? null,
          lng:         input.lng ?? null,
        })
        .select('id, code')
        .single();
      if (incErr) throw new Error(incErr.message);
      const { id: incidentId, code: incidentCode } = incident as { id: string; code: string };

      // ── Subir evidencias ───────────────────────────────────────────────────
      for (const asset of input.images) {
        const ext      = asset.uri.split('.').pop() ?? 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const filePath = `${tenantId}/${incidentId}/${fileName}`;
        const mimeType = asset.mimeType ?? `image/${ext}`;

        let uploadData: Uint8Array | Blob;
        if (asset.base64) {
          uploadData = base64ToUint8Array(asset.base64);
        } else {
          // Fallback: fetch the local URI and get a blob
          const resp = await fetch(asset.uri);
          uploadData = await resp.blob();
        }

        const { error: storageErr } = await supabase.storage
          .from('evidence')
          .upload(filePath, uploadData, {
            contentType: mimeType,
            upsert: false,
          });
        if (storageErr) {
          // Log pero no abortar — el incidente ya está creado
          console.warn('[evidence upload]', storageErr.message);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('evidence')
          .getPublicUrl(filePath);

        await supabase.from('evidence').insert({
          tenant_id:   tenantId,
          incident_id: incidentId,
          trip_id:     input.tripId ?? null,
          driver_id:   user.id,
          file_url:    publicUrl,
          file_path:   filePath,
          file_name:   fileName,
          media_type:  mimeType,
        });
      }

      return { id: incidentId, code: incidentCode };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { report, uploading, error };
}
