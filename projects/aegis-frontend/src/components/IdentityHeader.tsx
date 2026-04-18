import React from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { Wallet, Shield, Hash, LogOut, LucideIcon } from 'lucide-react'

interface IdentityHeaderProps {
  shortId: string
  role: 'patient' | 'hospital' | 'doctor' | 'admin'
  wallet: string
}

const IdentityHeader = ({ shortId, role, wallet }: IdentityHeaderProps) => {
  const { activeAddress } = useWallet()

  const RoleIcon = (): LucideIcon => {
    switch (role) {
      case 'hospital': return Shield
      case 'doctor': return Shield
      case 'admin': return Shield
      default: return Wallet
    }
  }

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)

  return (
    <header className="flex justify-between items-center mb-10 py-2 animate-fade-in">
      <div className="flex items-center gap-6">
        <div className="identity-card">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-light uppercase tracking-widest leading-none mb-1">Authenticated ID</span>
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-primary" />
              <span className="text-lg font-bold font-display tracking-tightest">{shortId || '---'}</span>
            </div>
          </div>
          
          <div className="h-8 w-px bg-border" />

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-light uppercase tracking-widest leading-none mb-1">Access Tier</span>
            <span className={`role-badge role-${role}`}>{roleLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-light uppercase tracking-widest leading-none mb-1">Wallet Address</span>
            <span className="text-xs font-mono text-muted">{wallet.slice(0, 6)}...{wallet.slice(-6)}</span>
        </div>
        <button className="w-10 h-10 border border-border rounded-xl flex items-center justify-center hover:bg-surface-hover transition-all">
          <LogOut size={18} className="text-text-muted" />
        </button>
      </div>
    </header>
  )
}

export default IdentityHeader
