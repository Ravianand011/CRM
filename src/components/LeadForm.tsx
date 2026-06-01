import { useState } from 'react';
import { X } from 'lucide-react';
import type { Lead, LeadStatus } from '../types/Lead';
import { LEAD_STATUSES, STATUS_LABELS } from '../types/Lead';
import type { LeadFormData } from '../services/leadsApi';
import { CallHistory } from './CallHistory';
import {
  formatDateIST,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../utils/datetime';

interface LeadFormProps {
  lead?: Lead | null;
  onSave: (form: LeadFormData, existingId?: string) => Promise<unknown>;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-md border border-line-2 bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-border';
const labelClass = 'block text-[12px] font-medium text-ink-2 mb-1';

export function LeadForm({ lead, onSave, onClose }: LeadFormProps) {
  const [name, setName] = useState(lead?.name ?? '');
  const [phone, setPhone] = useState(lead?.phone ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [qualification, setQualification] = useState(lead?.qualification ?? '');
  const [city, setCity] = useState(lead?.city ?? '');
  const [whenPlanningToJoin, setWhenPlanningToJoin] = useState(
    lead?.whenPlanningToJoin ?? '',
  );
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? 'not_picked');
  const [nextFollowUp, setNextFollowUp] = useState(
    toDatetimeLocalValue(lead?.nextFollowUp),
  );
  const [demoScheduledAt, setDemoScheduledAt] = useState(
    toDatetimeLocalValue(lead?.demoScheduledAt),
  );
  const [comment, setComment] = useState('');
  const [createdAtLocal, setCreatedAtLocal] = useState(
    toDatetimeLocalValue(lead?.createdAt ?? new Date().toISOString()),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (statusOverride?: LeadStatus) => {
    const finalStatus = statusOverride ?? status;
    setError('');

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }
    if (finalStatus === 'demo_scheduled' && !demoScheduledAt) {
      setError('Demo date & time is required when status is Demo Scheduled.');
      return;
    }

    if (finalStatus === 'not_interested') {
      const ok = window.confirm(
        'Mark this lead as Not Interested? If a demo was already scheduled or done, it will be hidden permanently.',
      );
      if (!ok) return;
    }

    const form: LeadFormData = {
      name,
      phone,
      email: email || undefined,
      qualification,
      city,
      whenPlanningToJoin: whenPlanningToJoin || undefined,
      status: finalStatus,
      nextFollowUp: fromDatetimeLocalValue(nextFollowUp),
      demoScheduledAt: fromDatetimeLocalValue(demoScheduledAt),
      comment: comment || undefined,
      source: lead ? lead.source : 'manual',
      createdAt: lead
        ? lead.createdAt
        : fromDatetimeLocalValue(createdAtLocal) ?? new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSave(form, lead?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[15px] font-medium text-ink">
            {lead ? 'Edit Lead' : 'New Lead'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className={labelClass}>Phone *</label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit number"
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className={labelClass}>Qualification</label>
              <input
                className={inputClass}
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="e.g. B.Tech"
              />
            </div>
            <div>
              <label className={labelClass}>City / Location</label>
              <input
                className={inputClass}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div>
              <label className={labelClass}>When Planning to Join</label>
              <input
                className={inputClass}
                value={whenPlanningToJoin}
                onChange={(e) => setWhenPlanningToJoin(e.target.value)}
                placeholder="e.g. Immediately / Next month"
              />
            </div>
            <div>
              <label className={labelClass}>Created date</label>
              {lead ? (
                <input
                  className={`${inputClass} bg-surface-2 text-ink-2`}
                  readOnly
                  value={formatDateIST(lead.createdAt)}
                />
              ) : (
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={createdAtLocal}
                  onChange={(e) => setCreatedAtLocal(e.target.value)}
                />
              )}
            </div>
            <div>
              <label className={labelClass}>Lead Status</label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Next Follow-up</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
              />
            </div>
            {status === 'demo_scheduled' && (
              <div className="sm:col-span-2">
                <label className={labelClass}>Demo Scheduled At *</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={demoScheduledAt}
                  onChange={(e) => setDemoScheduledAt(e.target.value)}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={labelClass}>Comment / Call Note</label>
              <textarea
                className={`${inputClass} min-h-[80px]`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Notes from this call / interaction..."
              />
            </div>
          </div>

          {lead && lead.callHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-[13px] font-medium text-ink">
                Call History
              </h3>
              <CallHistory history={lead.callHistory} />
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-tone-red-bg px-3 py-2 text-[13px] text-tone-red-tx">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line px-6 py-4">
          <button
            onClick={() => submit()}
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-brand-soft hover:opacity-95 disabled:opacity-50"
          >
            Save Lead
          </button>
          <button
            onClick={() => submit()}
            disabled={saving}
            className="rounded-md border border-av-teal-tx/30 bg-av-teal-bg px-4 py-2 text-[13px] font-medium text-av-teal-tx hover:opacity-95 disabled:opacity-50"
          >
            Next Follow-up
          </button>
          <button
            onClick={() => submit('not_picked')}
            disabled={saving}
            className="rounded-md bg-tone-gray-bg px-4 py-2 text-[13px] font-medium text-tone-gray-tx hover:opacity-95 disabled:opacity-50"
          >
            Mark Not Picked
          </button>
          <button
            onClick={() => submit('switch_off')}
            disabled={saving}
            className="rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-surface hover:opacity-95 disabled:opacity-50"
          >
            Switch Off
          </button>
          <button
            onClick={() => submit('not_interested')}
            disabled={saving}
            className="rounded-md bg-tone-red-bg px-4 py-2 text-[13px] font-medium text-tone-red-tx hover:opacity-95 disabled:opacity-50"
          >
            Not Interested
          </button>
        </div>
      </div>
    </div>
  );
}
