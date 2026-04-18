import { useState, useMemo, useEffect } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { ShieldAlert, Database, Search, Filter, ShieldCheck, Fingerprint, ExternalLink, Activity, Loader2 } from 'lucide-react'
import { fetchAuditLogs, AuditLogEntry } from '../utils/auditLog'

const AuditorDashboard = () => {
  const { activeAddress } = useWallet()
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (activeAddress) {
      fetchAuditLogs(activeAddress).then(setAuditLogs)
      const interval = setInterval(() => {
        fetchAuditLogs(activeAddress).then(setAuditLogs)
      }, 30000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [activeAddress])

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900 flex items-center gap-3">
           <ShieldAlert className="text-blue-500 w-6 h-6" /> Compliance Audit Node
        </h1>
        <p className="text-gray-500 text-sm">Verify system-wide DPDP compliance and monitor decentralized access.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="vercel-card px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex flex-col">System Health <span className="text-emerald-500 flex items-center gap-1 mt-1"><ShieldCheck size={12}/> DPDP Compliant</span></div>
          </div>
          <div className="vercel-card px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Immutable Logs Indexed</div>
              <div className="text-2xl font-bold text-gray-900">{auditLogs.length}</div>
          </div>
          <div className="vercel-card px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Session Identity</div>
              <div className="text-xs font-mono text-blue-600 truncate">{activeAddress ? activeAddress.slice(0, 12) + '...' : 'Disconnected'}</div>
          </div>
          <div className="vercel-card px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Integrity Status</div>
              <div className="text-2xl font-bold text-emerald-500 border-l-2 border-emerald-500 pl-2">ACTIVE</div>
          </div>
      </div>

      <section className="vercel-card p-0 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center">
             <div className="flex items-center gap-4 w-1/2">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                       type="text" 
                       placeholder="Filter by Transaction Hash / Fiduciary ID" 
                       className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
             </div>
             <button className="stripe-button-outline text-xs py-2 px-4 shadow-sm">
                 <Filter size={14} /> Log Filters
             </button>
          </div>
          
          <div className="p-8">
             <div className="flex items-center gap-2 mb-6">
                <Fingerprint size={18} className="text-blue-500" />
                <h3 className="font-bold text-gray-900">Recorded Compliance Activity</h3>
             </div>

             {auditLogs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {auditLogs.map((log) => (
                        <div key={log.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col gap-2 hover:border-blue-200 transition-all hover:shadow-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                                   {log.type}
                                </span>
                                <span className="text-gray-400 text-[10px] font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                                <Activity size={12} className="text-gray-400" />
                                {log.provider}
                            </div>
                            <p className="text-[10px] text-gray-500 italic bg-white p-2 rounded-lg border border-gray-50">
                                "{log.purpose}"
                            </p>
                            <a 
                                href={`https://testnet.explorer.perawallet.app/tx/${log.txId}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[9px] text-blue-500 hover:underline flex items-center gap-1 mt-1 font-bold"
                            >
                                <ExternalLink size={10} /> Verify Ledger State
                            </a>
                        </div>
                    ))}
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <Database size={48} className="text-gray-200 mb-4" />
                    <h3 className="text-gray-900 font-semibold mb-2">Blockchain Sync in Progress</h3>
                    <p className="text-gray-500 text-xs max-w-sm">No immutable ledger logs found for this auditor node. Ensure your wallet has performed auditing actions recently.</p>
                </div>
             )}
          </div>

          <div className="p-4 text-center border-t border-gray-100 bg-gray-50">
             <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors">Load Extended Historical Blocks</button>
          </div>
      </section>
    </div>
  )
}

export default AuditorDashboard
