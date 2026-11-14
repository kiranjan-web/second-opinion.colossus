import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  PhoneCall,
  Search,
  ShieldCheck,
} from 'lucide-react';

interface VerificationEntry {
  id: string;
  category: 'Law Enforcement' | 'Banking & RBI' | 'Telecom & Courier';
  agency: string;
  officialChannel: string;
  officialUrl: string;
  commonImpersonationClaim: string;
  statutoryRule: string;
}

const VERIFICATION_DIRECTORY: VerificationEntry[] = [
  {
    id: 'mha-1930',
    category: 'Law Enforcement',
    agency: 'Indian Cyber Crime Coordination Centre (I4C)',
    officialChannel: 'Helpline 1930',
    officialUrl: 'https://cybercrime.gov.in',
    commonImpersonationClaim: 'Caller claims "Digital Arrest Warrant" issued via WhatsApp or Skype video.',
    statutoryRule: 'Digital Arrest does not exist under Indian law. Police never conduct arrests or interrogation over video calls.',
  },
  {
    id: 'cbi-ed',
    category: 'Law Enforcement',
    agency: 'Central Bureau of Investigation (CBI) / Enforcement Directorate (ED)',
    officialChannel: 'Physical Court Summons Only',
    officialUrl: 'https://cbi.gov.in',
    commonImpersonationClaim: 'Caller sends forged PDF arrest warrant with Ashoka emblem and demands secrecy.',
    statutoryRule: 'Genuine agencies serve physical summons and never forbid contacting family or legal counsel.',
  },
  {
    id: 'rbi-sachet',
    category: 'Banking & RBI',
    agency: 'Reserve Bank of India (RBI) — Sachet & Ombudsman',
    officialChannel: '14448 (RBI Contact Centre)',
    officialUrl: 'https://cms.rbi.org.in',
    commonImpersonationClaim: 'Caller demands RTGS/IMPS transfer to a "secret RBI verification escrow account".',
    statutoryRule: 'RBI never holds personal funds in escrow accounts for biometric clearance or money-laundering verification.',
  },
  {
    id: 'sbi-cards',
    category: 'Banking & RBI',
    agency: 'Scheduled Commercial Banks (SBI / HDFC / ICICI / Axis)',
    officialChannel: 'Number printed on physical bank card',
    officialUrl: 'https://sachet.rbi.org.in',
    commonImpersonationClaim: 'Caller claims your Aadhaar opened 5 illicit accounts and pressures immediate FD liquidation.',
    statutoryRule: 'Always hang up and dial the toll-free number printed on the back of your debit/credit card.',
  },
  {
    id: 'dot-sanchar',
    category: 'Telecom & Courier',
    agency: 'Department of Telecommunications (DoT) — Sanchar Saathi',
    officialChannel: 'Chakshu Portal / TAFCOP',
    officialUrl: 'https://sancharsaathi.gov.in',
    commonImpersonationClaim: 'Robocall claims TRAI will disconnect your SIM in 2 hours unless you press 9.',
    statutoryRule: 'TRAI does not disconnect mobile numbers via automated IVR calls or ask for Aadhaar verification on phone.',
  },
  {
    id: 'customs-courier',
    category: 'Telecom & Courier',
    agency: 'Indian Customs & International Couriers (FedEx / DHL)',
    officialChannel: 'Official Airway Bill Tracking Portal',
    officialUrl: 'https://www.cbic.gov.in',
    commonImpersonationClaim: 'Caller claims a parcel with your Aadhaar containing passports or MDMA was seized.',
    statutoryRule: 'Couriers never patch calls directly to Narcotics Bureau or Mumbai Cyber Crime officers.',
  },
];

export function VerificationHubView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [claimInput, setClaimInput] = useState('');

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return VERIFICATION_DIRECTORY.filter((entry) => {
      const matchesCat = categoryFilter === 'All' || entry.category === categoryFilter;
      const matchesQuery =
        !q ||
        entry.agency.toLowerCase().includes(q) ||
        entry.officialChannel.toLowerCase().includes(q) ||
        entry.commonImpersonationClaim.toLowerCase().includes(q) ||
        entry.statutoryRule.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [searchQuery, categoryFilter]);

  const claimEvaluation = useMemo(() => {
    const text = claimInput.trim().toLowerCase();
    if (!text) return null;

    const redFlags = [
      { pattern: /digital arrest|skype|whatsapp video|lock.*door|secret account|rbi verification/i, label: 'Confirmed Digital Arrest / Coercion Scam Modus Operandi' },
      { pattern: /fedex|dhl|customs|parcel|narcotics|trai|press 9|sim.*disconnect/i, label: 'Known Impersonation Hook — Hang Up Immediately' },
      { pattern: /money laundering|cbi|enforcement directorate|warrant|aadhaar.*linked/i, label: 'High-Risk Authority Spoofing Claim' },
    ];

    const matched = redFlags.find((f) => f.pattern.test(text));
    if (matched) {
      return {
        isScamPattern: true,
        headline: matched.label,
        guidance: 'Do NOT transfer funds or stay on video. Verify independently via 1930 or cybercrime.gov.in.',
      };
    }

    return {
      isScamPattern: false,
      headline: 'No Known Impersonation Signature Matched',
      guidance: 'Still verify any caller independently by hanging up and dialing the official number from the organization website.',
    };
  }, [claimInput]);

  return (
    <div className="space-y-6">
      {/* Caller Claim Cross-Reference Tool */}
      <section className="bg-[#131C31] border border-white/10 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Caller Claim &amp; Authority Verifier
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cross-reference a caller&apos;s purported agency, parcel notice, or RBI demand against verified statutory procedures
            </p>
          </div>
          <a
            href="https://cybercrime.gov.in"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 transition-colors whitespace-nowrap"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            National Helpline 1930
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <input
          type="text"
          value={claimInput}
          onChange={(e) => setClaimInput(e.target.value)}
          placeholder='Describe what the caller claims (e.g., "FedEx parcel with narcotics, transferred to CBI on Skype")'
          className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
        />

        {claimEvaluation && (
          <div
            className={`mt-4 p-4 rounded-lg border flex items-start gap-3 ${
              claimEvaluation.isScamPattern
                ? 'bg-rose-950/35 border-rose-500/40'
                : 'bg-[#0A0F1D] border-white/10'
            }`}
          >
            {claimEvaluation.isScamPattern ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div
                className={`text-sm font-semibold ${
                  claimEvaluation.isScamPattern ? 'text-rose-300' : 'text-white'
                }`}
              >
                {claimEvaluation.headline}
              </div>
              <p className="text-xs text-slate-300 mt-1">{claimEvaluation.guidance}</p>
            </div>
          </div>
        )}
      </section>

      {/* Verified Entities & Statutory Directory */}
      <section className="bg-[#131C31] border border-white/10 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-1 p-1 bg-[#0A0F1D] border border-white/10 rounded-lg overflow-x-auto">
            {['All', 'Law Enforcement', 'Banking & RBI', 'Telecom & Courier'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search RBI, CBI, TRAI, 1930..."
              className="w-full bg-[#0A0F1D] border border-white/15 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="divide-y divide-white/10 border-t border-white/10">
          {filteredEntries.map((item) => (
            <div key={item.id} className="py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="text-cyan-400 font-medium">{item.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-300">{item.officialChannel}</span>
                </div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  {item.agency}
                </h3>
                <p className="text-xs text-rose-300/90">
                  Scam Pretext: {item.commonImpersonationClaim}
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {item.statutoryRule}
                </p>
              </div>

              <a
                href={item.officialUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 self-start"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Official Portal
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
