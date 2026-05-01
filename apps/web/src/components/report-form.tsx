'use client';

import { useState } from 'react';

interface ReportFormProps {
  code: string;
  apiUrl: string;
}

export default function ReportForm({ code, apiUrl }: ReportFormProps) {
  const [finderContact, setFinderContact] = useState('');
  const [finderNotes, setFinderNotes] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoUploaded, setPhotoUploaded] = useState(false);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLat(position.coords.latitude);
        setLocationLng(position.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setError('Unable to retrieve your location.');
        setGeoLoading(false);
      },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, unknown> = {};
      if (finderContact) body.finderContact = finderContact;
      if (finderNotes) body.finderNotes = finderNotes;
      if (locationAddress) body.locationAddress = locationAddress;
      if (locationLat !== null) body.locationLat = locationLat;
      if (locationLng !== null) body.locationLng = locationLng;

      const res = await fetch(`${apiUrl}/api/v1/public/q/${code}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to submit report');
      }

      const data = await res.json().catch(() => null);
      if (data?.id) setReportId(data.id);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError('');
  };

  const handlePhotoUpload = async () => {
    if (!photoFile || !reportId) return;
    setUploading(true);
    setPhotoError('');
    try {
      const formData = new FormData();
      formData.append('file', photoFile);
      const res = await fetch(`${apiUrl}/api/v1/public/reports/${reportId}/photo`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new Error('Photo upload failed');
      }
      setPhotoUploaded(true);
    } catch {
      setPhotoError('Failed to upload photo. You can skip this step.');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    if (photoUploaded) {
      return (
        <div style={styles.successCard}>
          <div style={styles.successIcon}>&#10003;</div>
          <h2 style={styles.successTitle}>All Done!</h2>
          <p style={styles.successText}>Report and photo submitted. The owner has been notified. Thank you!</p>
        </div>
      );
    }

    return (
      <div style={styles.successCard}>
        <div style={styles.successIcon}>&#10003;</div>
        <h2 style={styles.successTitle}>Report Submitted!</h2>
        <p style={styles.successText}>The owner has been notified. Thank you for helping!</p>

        {reportId && !photoUploaded && (
          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <p style={{ fontSize: '14px', color: '#555', marginBottom: '12px', fontWeight: 500 }}>
              (Optional) Add a photo to help the owner identify the item:
            </p>
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Preview"
                style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }}
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'block', marginBottom: '10px', fontSize: '14px' }}
            />
            {photoError && <p style={{ color: '#dc3545', fontSize: '13px', marginBottom: '8px' }}>{photoError}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handlePhotoUpload}
                disabled={!photoFile || uploading}
                style={{ ...styles.submitButton, flex: 1, padding: '10px', fontSize: '14px' }}
              >
                {uploading ? 'Uploading…' : 'Upload Photo'}
              </button>
              <button
                onClick={() => setPhotoUploaded(true)}
                style={{ padding: '10px 16px', fontSize: '14px', background: 'none', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', color: '#888' }}
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.formTitle}>Report Found Item</h2>
      <p style={styles.formSubtitle}>Help the owner recover their item by sharing your details.</p>

      <div style={styles.field}>
        <label style={styles.label}>Your Contact Info (optional)</label>
        <input
          type="text"
          value={finderContact}
          onChange={(e) => setFinderContact(e.target.value)}
          placeholder="Email or phone number"
          style={styles.input}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Notes (optional)</label>
        <textarea
          value={finderNotes}
          onChange={(e) => setFinderNotes(e.target.value)}
          placeholder="Where did you find it? What condition is it in?"
          rows={3}
          style={styles.textarea}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Location Address (optional)</label>
        <input
          type="text"
          value={locationAddress}
          onChange={(e) => setLocationAddress(e.target.value)}
          placeholder="e.g. Central Park, New York"
          style={styles.input}
        />
      </div>

      <div style={styles.field}>
        <button type="button" onClick={getLocation} disabled={geoLoading} style={styles.geoButton}>
          {geoLoading ? 'Getting location...' : locationLat ? `Location: ${locationLat.toFixed(4)}, ${locationLng?.toFixed(4)}` : 'Share My GPS Location'}
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={submitting} style={styles.submitButton}>
        {submitting ? 'Submitting...' : 'Submit Report'}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  formTitle: {
    margin: '0 0 4px',
    fontSize: '20px',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  formSubtitle: {
    margin: '0 0 20px',
    fontSize: '14px',
    color: '#666',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    resize: 'vertical' as const,
    boxSizing: 'border-box',
  },
  geoButton: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#333',
  },
  error: {
    color: '#dc3545',
    fontSize: '14px',
    margin: '0 0 12px',
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 600,
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  successCard: {
    textAlign: 'center' as const,
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  successIcon: {
    width: '64px',
    height: '64px',
    lineHeight: '64px',
    fontSize: '32px',
    backgroundColor: '#ea2e00',
    color: '#fff',
    borderRadius: '50%',
    margin: '0 auto 16px',
  },
  successTitle: {
    margin: '0 0 8px',
    fontSize: '22px',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  successText: {
    margin: 0,
    fontSize: '15px',
    color: '#666',
  },
};
