'use client'
import { useState } from 'react'

export function DemoRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState({ name: '', email: '', organisation: '', role: '', phone: '', message: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  if (!open) return null
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) { setState('error'); return }
    setState('sending')
    try {
      const r = await fetch('/api/demo-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, source: 'caliber-landing' }) })
      if (!r.ok) throw new Error()
      setState('done')
    } catch { setState('error') }
  }
  const input = 'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-[#8b7bf0]'
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a3a] p-6 text-white" onClick={(e) => e.stopPropagation()}>
        {state === 'done' ? (
          <div className="py-8 text-center"><p className="text-lg font-semibold">Thank you - we&rsquo;ll be in touch shortly.</p></div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h3 className="text-lg font-semibold">Request a demo</h3>
            <p className="text-sm text-white/60">Tell us about your organisation and we&rsquo;ll arrange a walkthrough.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} placeholder="Full name" value={form.name} onChange={set('name')} />
              <input className={input} type="email" placeholder="Work email" value={form.email} onChange={set('email')} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} placeholder="Organisation" value={form.organisation} onChange={set('organisation')} />
              <input className={input} placeholder="Your role" value={form.role} onChange={set('role')} />
            </div>
            <input className={input} placeholder="Phone (optional)" value={form.phone} onChange={set('phone')} />
            <textarea className={input} rows={3} placeholder="Anything we should know? (optional)" value={form.message} onChange={set('message')} />
            {state === 'error' && <p className="text-sm text-red-300">Please check your details and try again.</p>}
            <button type="submit" disabled={state === 'sending'} className="w-full rounded-lg bg-[#8b7bf0] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#7c6ae8] disabled:opacity-60">
              {state === 'sending' ? 'Sending…' : 'Send request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
