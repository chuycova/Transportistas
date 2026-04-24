// ─── useTenantId.ts ─────────────────────────────────────────────────────────
// Lee el tenant_id del MMKV con fallback al JWT.
// Retorna el ID y un ref sincronizado para uso en callbacks.

import { useState, useEffect, useRef } from 'react';
import { getStr } from '@lib/mmkv';
import { supabase } from '@lib/supabase';

export function useTenantId(): { tenantId: string; tenantIdRef: React.MutableRefObject<string> } {
  const [tenantId, setTenantId] = useState<string>(() => getStr('tenantId') ?? '');
  const tenantIdRef = useRef(tenantId);

  useEffect(() => {
    if (tenantId) { tenantIdRef.current = tenantId; return; }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const id = (session?.user?.user_metadata?.tenant_id as string | undefined) ?? '';
      if (id) { setTenantId(id); tenantIdRef.current = id; }
    });
  }, [tenantId]);

  return { tenantId, tenantIdRef };
}
