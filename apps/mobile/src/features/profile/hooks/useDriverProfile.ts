// ─── features/profile/hooks/useDriverProfile.ts ──────────────────────────────
// Hooks para documentos propios del conductor y contactos de emergencia.
// Solo lectura desde la perspectiva del conductor (role=driver).

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DocStatus = 'pending' | 'valid' | 'expired' | 'rejected';
export type DocType   = 'ine' | 'license' | 'proof_of_address' | 'medical_cert' | 'other';

export interface DriverDocument {
  id: string;
  doc_type: DocType;
  title: string;
  doc_number: string | null;
  status: DocStatus;
  rejection_reason: string | null;
  expires_at: string | null;
  issued_at: string | null;
}

export interface EmergencyContact {
  id: string;
  full_name: string;
  relationship: string | null;
  phone: string;
  phone_alt: string | null;
  is_primary: boolean;
}

export interface DriverProfileData {
  curp: string | null;
  rfc: string | null;
  license_number: string | null;
  license_category: string | null;
  license_expiry: string | null;
  avg_rating: number | null;
  total_trips: number;
  on_time_pct: number | null;
  risk_level: 'low' | 'medium' | 'high';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDriverProfile() {
  const [documents, setDocuments]     = useState<DriverDocument[]>([]);
  const [contacts, setContacts]       = useState<EmergencyContact[]>([]);
  const [profile, setProfile]         = useState<DriverProfileData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión activa');

      const [docsRes, contactsRes, profileRes] = await Promise.all([
        supabase
          .from('driver_documents')
          .select('id, doc_type, title, doc_number, status, rejection_reason, expires_at, issued_at')
          .eq('driver_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('emergency_contacts')
          .select('id, full_name, relationship, phone, phone_alt, is_primary')
          .eq('driver_id', user.id)
          .order('is_primary', { ascending: false }),
        supabase
          .from('profiles')
          .select('curp, rfc, license_number, license_category, license_expiry, avg_rating, total_trips, on_time_pct, risk_level')
          .eq('id', user.id)
          .single(),
      ]);

      if (docsRes.error) throw new Error(docsRes.error.message);
      if (contactsRes.error) throw new Error(contactsRes.error.message);

      setDocuments((docsRes.data ?? []) as DriverDocument[]);
      setContacts((contactsRes.data ?? []) as EmergencyContact[]);
      if (!profileRes.error && profileRes.data) {
        setProfile(profileRes.data as DriverProfileData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { documents, contacts, profile, loading, error, refetch: load };
}
