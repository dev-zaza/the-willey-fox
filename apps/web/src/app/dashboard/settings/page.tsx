'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Save, Shield, Camera } from 'lucide-react';
import { users as usersApi, auth } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

export default function SettingsPage() {
  const { user, setUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState('');
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // 2FA quick status (fetch from profile)
  const [is2faEnabled] = useState(false);

  useEffect(() => {
    auth.me().then((profile) => {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setPhone((profile as any).phone ?? '');
      const prefs = (profile as any).notificationPreferences ?? {};
      setEmailNotif(prefs.email !== false);
      setPushNotif(prefs.push !== false);
      setSmsNotif(prefs.sms === true);
      if (profile.avatarUrl) setAvatarPreview(profile.avatarUrl);
    }).catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updated = await usersApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        notificationPreferences: { email: emailNotif, push: pushNotif, sms: smsNotif },
      });
      if (setUser) setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    uploadAvatar(file);
  }

  async function uploadAvatar(file: File) {
    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await usersApi.uploadAvatar(formData);
      if (setUser) setUser({ ...user!, avatarUrl: result.avatarUrl });
    } catch (e: any) {
      setAvatarError(e?.message ?? 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : '?';

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your profile and notification preferences</p>
        </div>

        {/* Avatar */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Profile Photo</h2>
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-surface-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center border-2 border-surface-border">
                  <span className="text-white text-xl font-bold">{initials}</span>
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="flex items-center gap-2 text-sm border border-surface-border hover:border-brand-500 text-slate-300 hover:text-white px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Change photo
              </button>
              <p className="text-xs text-slate-500">JPG, PNG or WebP · Max 5 MB</p>
              {avatarError && <p className="text-xs text-red-400">{avatarError}</p>}
            </div>
          </div>
        </div>

        <form onSubmit={save} className="space-y-6">
          {/* Profile */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Profile</h2>
            {[
              { label: 'First Name', value: firstName, set: setFirstName, type: 'text', required: true },
              { label: 'Last Name', value: lastName, set: setLastName, type: 'text', required: true },
              { label: 'Phone', value: phone, set: setPhone, type: 'tel', required: false },
            ].map(({ label, value, set, type, required }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  required={required}
                  className="w-full bg-surface border border-surface-border text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 placeholder:text-slate-500"
                />
              </div>
            ))}
          </div>

          {/* Notifications */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Notifications</h2>
            {[
              { label: 'Email notifications', value: emailNotif, set: setEmailNotif },
              { label: 'Push notifications', value: pushNotif, set: setPushNotif },
              { label: 'SMS notifications', value: smsNotif, set: setSmsNotif },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center justify-between">
                <label className="text-sm text-slate-300">{label}</label>
                <button
                  type="button"
                  onClick={() => set(!value)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-brand-500' : 'bg-surface-border'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </form>

        {/* Security */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Security</h2>
          <Link
            href="/dashboard/settings/security"
            className="flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm text-slate-300">Two-Factor Authentication</p>
                <p className="text-xs text-slate-500">Add extra security to your account</p>
              </div>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${is2faEnabled ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
              {is2faEnabled ? 'Enabled' : 'Off'}
            </span>
          </Link>
        </div>

        {/* Account info */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Account</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Email</span>
              <span className="text-slate-300">{user?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Verified</span>
              <span className={user?.isVerified ? 'text-green-400' : 'text-amber-400'}>
                {user?.isVerified ? 'Yes' : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">User ID</span>
              <span className="text-slate-500 font-mono text-xs">{user?.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
