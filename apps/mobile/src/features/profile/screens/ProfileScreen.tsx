// ─── features/profile/screens/ProfileScreen.tsx ──────────────────────────────
// Perfil del conductor: datos de licencia, estado de documentos y contactos
// de emergencia. Solo lectura (el admin edita desde la web).

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverProfile, type DocStatus, type DocType, type DriverDocument, type EmergencyContact } from '../hooks/useDriverProfile';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocType, string> = {
  ine:              'INE / IFE',
  license:          'Licencia de conducir',
  proof_of_address: 'Comprobante de domicilio',
  medical_cert:     'Certificado médico',
  other:            'Otro documento',
};

const STATUS_META: Record<DocStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: 'Pendiente',  color: '#F59E0B', bg: '#F59E0B22', icon: 'time-outline' },
  valid:    { label: 'Vigente',    color: '#10B981', bg: '#10B98122', icon: 'checkmark-circle-outline' },
  expired:  { label: 'Vencido',   color: '#EF4444', bg: '#EF444422', icon: 'alert-circle-outline' },
  rejected: { label: 'Rechazado', color: '#EF4444', bg: '#EF444422', icon: 'close-circle-outline' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpiringSoon(iso: string | null) {
  if (!iso) return false;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days >= 0 && days <= 30;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label.toUpperCase()}</Text>;
}

function DocumentCard({ doc }: { doc: DriverDocument }) {
  const meta = STATUS_META[doc.status];
  const warnExpiry = doc.status === 'valid' && isExpiringSoon(doc.expires_at);
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.docTitle}>{doc.title || DOC_TYPE_LABELS[doc.doc_type]}</Text>
          {doc.doc_number && (
            <Text style={styles.docSub}>N° {doc.doc_number}</Text>
          )}
          {doc.expires_at && (
            <Text style={[styles.docSub, warnExpiry && { color: '#F59E0B' }]}>
              Vence: {fmtDate(doc.expires_at)}{warnExpiry ? ' ⚠' : ''}
            </Text>
          )}
          {doc.status === 'rejected' && doc.rejection_reason && (
            <Text style={styles.docReject}>Motivo: {doc.rejection_reason}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as any} size={12} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </View>
  );
}

function ContactCard({ contact }: { contact: EmergencyContact }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.contactIcon}>
          <Ionicons name="person-outline" size={18} color="#6C63FF" />
        </View>
        <View style={styles.cardLeft}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{contact.full_name}</Text>
            {contact.is_primary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>Principal</Text>
              </View>
            )}
          </View>
          {contact.relationship && (
            <Text style={styles.docSub}>{contact.relationship}</Text>
          )}
          <Text style={styles.contactPhone}>{contact.phone}</Text>
          {contact.phone_alt && (
            <Text style={styles.docSub}>{contact.phone_alt}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export function ProfileScreen() {
  const { documents, contacts, profile, loading, error, refetch } = useDriverProfile();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline-outline" size={40} color="#4A4A6A" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pendingDocs  = documents.filter((d) => d.status === 'pending').length;
  const expiredDocs  = documents.filter((d) => d.status === 'expired' || d.status === 'rejected').length;
  const warnDocs     = documents.filter((d) => d.status === 'valid' && isExpiringSoon(d.expires_at)).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refetch()}
          tintColor="#6C63FF"
        />
      }
    >
      {/* ── Métricas del conductor ── */}
      {profile && (
        <>
          <SectionTitle label="Mi perfil" />
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {profile.avg_rating != null ? profile.avg_rating.toFixed(1) : '—'}
              </Text>
              <Text style={styles.metricLabel}>Calificación</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{profile.total_trips}</Text>
              <Text style={styles.metricLabel}>Viajes</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {profile.on_time_pct != null ? `${Math.round(profile.on_time_pct)}%` : '—'}
              </Text>
              <Text style={styles.metricLabel}>A tiempo</Text>
            </View>
            <View style={[styles.metricCard, {
              borderColor: profile.risk_level === 'high' ? '#EF4444' : profile.risk_level === 'medium' ? '#F59E0B' : '#10B981',
            }]}>
              <Text style={[styles.metricValue, {
                color: profile.risk_level === 'high' ? '#EF4444' : profile.risk_level === 'medium' ? '#F59E0B' : '#10B981',
              }]}>
                {profile.risk_level === 'low' ? 'Bajo' : profile.risk_level === 'medium' ? 'Medio' : 'Alto'}
              </Text>
              <Text style={styles.metricLabel}>Riesgo</Text>
            </View>
          </View>

          {/* Datos de licencia */}
          {(profile.license_number || profile.license_category || profile.license_expiry) && (
            <View style={styles.licenseCard}>
              <View style={styles.licenseRow}>
                <Ionicons name="card-outline" size={16} color="#6C63FF" />
                <Text style={styles.licenseTitle}>Licencia de conducir</Text>
              </View>
              {profile.license_number && (
                <Text style={styles.licenseField}>N° {profile.license_number}
                  {profile.license_category ? ` · Cat. ${profile.license_category}` : ''}
                </Text>
              )}
              {profile.license_expiry && (
                <Text style={[
                  styles.licenseExpiry,
                  isExpiringSoon(profile.license_expiry) && { color: '#F59E0B' },
                ]}>
                  Vence {fmtDate(profile.license_expiry)}
                  {isExpiringSoon(profile.license_expiry) ? ' — próximo a vencer ⚠' : ''}
                </Text>
              )}
            </View>
          )}
        </>
      )}

      {/* ── Alerta resumen documentos ── */}
      {(pendingDocs > 0 || expiredDocs > 0 || warnDocs > 0) && (
        <View style={styles.alertBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
          <Text style={styles.alertText}>
            {[
              expiredDocs > 0 && `${expiredDocs} doc${expiredDocs > 1 ? 's' : ''} vencido${expiredDocs > 1 ? 's' : ''}`,
              warnDocs > 0   && `${warnDocs} por vencer`,
              pendingDocs > 0 && `${pendingDocs} pendiente${pendingDocs > 1 ? 's' : ''}`,
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}

      {/* ── Documentos ── */}
      <SectionTitle label="Mis documentos" />
      {documents.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-outline" size={36} color="#2A2A3F" />
          <Text style={styles.emptyText}>Sin documentos registrados</Text>
          <Text style={styles.emptySubText}>El administrador debe subir tus documentos desde el panel web</Text>
        </View>
      ) : (
        documents.map((doc) => <DocumentCard key={doc.id} doc={doc} />)
      )}

      {/* ── Contactos de emergencia ── */}
      <SectionTitle label="Contactos de emergencia" />
      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={36} color="#2A2A3F" />
          <Text style={styles.emptyText}>Sin contactos registrados</Text>
          <Text style={styles.emptySubText}>El administrador debe agregar tus contactos de emergencia desde el panel web</Text>
        </View>
      ) : (
        contacts.map((c) => <ContactCard key={c.id} contact={c} />)
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  sectionTitle: {
    color: '#4A4A6A',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 8,
  },
  // Métricas
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#12121C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  metricLabel: {
    color: '#4A4A6A',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // Licencia
  licenseCard: {
    backgroundColor: '#12121C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6C63FF44',
    padding: 14,
    marginBottom: 20,
    gap: 6,
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  licenseTitle: {
    color: '#6C63FF',
    fontSize: 13,
    fontWeight: '700',
  },
  licenseField: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  licenseExpiry: {
    color: '#8888AA',
    fontSize: 12,
  },
  // Alerta
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F59E0B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B44',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  alertText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  // Cards
  card: {
    backgroundColor: '#12121C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    padding: 14,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    gap: 3,
  },
  docTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  docSub: {
    color: '#8888AA',
    fontSize: 12,
  },
  docReject: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Contactos
  contactIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6C63FF22',
    borderWidth: 1,
    borderColor: '#6C63FF44',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  contactName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBadge: {
    backgroundColor: '#6C63FF22',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6C63FF44',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryText: {
    color: '#6C63FF',
    fontSize: 10,
    fontWeight: '700',
  },
  contactPhone: {
    color: '#A0A0C0',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
    marginBottom: 8,
  },
  emptyText: {
    color: '#4A4A6A',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubText: {
    color: '#2A2A3F',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 260,
  },
  // Error
  errorText: {
    color: '#8888AA',
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#6C63FF22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6C63FF44',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
  },
});
