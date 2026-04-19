import { useWallet } from '@txnlab/use-wallet-react'
import {
  Shield,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Activity,
  Lock,
  Search,
  Globe,
  Database,
  Users
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ConnectWallet from '../components/ConnectWallet'
import RoleSelectionModal from '../components/RoleSelectionModal'
import { useRole } from '../hooks/useRole'

const LandingPage = () => {
  const { activeAddress } = useWallet()
  const { roles, loading } = useRole()
  const navigate = useNavigate()
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [prevAddress, setPrevAddress] = useState<string | null>(null)

  useEffect(() => {
    if (activeAddress && !prevAddress) {
      setPrevAddress(activeAddress)
      setIsWalletModalOpen(false)
      setIsRoleModalOpen(true)
    } else if (!activeAddress && prevAddress) {
      setPrevAddress(null)
      setIsRoleModalOpen(false)
    }
  }, [activeAddress, prevAddress])

  const handleStart = () => {
    if (activeAddress) {
      navigate('/register')
    } else {
      setIsWalletModalOpen(true)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 1. Header (Glassmorphism) */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-1400 flex justify-between items-center py-4 px-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#3D5141] rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
             </div>
             <span className="text-xl font-bold tracking-tight text-[#3D5141]">Aegis</span>
          </div>
          
          <div className="flex items-center gap-4">
             <button
                onClick={handleStart}
                className="btn-accent"
             >
                {activeAddress ? 'Dashboard' : 'Connect Wallet'}
             </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <main className="pt-32 pb-20">
        <section className="max-w-6xl text-center px-8">
           <div className="inline-flex flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#E8EDE8] mb-12 animate-fade-in shadow-sm" style={{ display: 'inline-flex' }}>
              <span className="w-2 h-2 rounded-full bg-[#10B981]" style={{ animation: 'pulse 2s infinite' }} />
              <span className="text-xs font-bold text-[#3D5141]/60 uppercase tracking-widest">
                Secure Consent Management | <span className="text-[#3B82F6]">v2.4 Released</span>
              </span>
           </div>

           <h1 className="hero-headline mb-8">
              Take Control of Your <br />
              <span className="text-sage">Medical Data</span>
           </h1>

           <p className="text-xl text-muted max-w-2xl mb-12">
              Aegis is a blockchain-powered consent platform that lets patients control who accesses their health records while enabling hospitals to stay compliant.
           </p>

           <div className="flex justify-center gap-4">
              <button 
                onClick={handleStart}
                className="btn-primary"
              >
                Access Patient Portal <ArrowRight size={20} />
              </button>
              <button className="btn-outline">
                Beneficiary Access
              </button>
           </div>
        </section>

        {/* 3. Global Network Visualization */}
        <section className="relative mt-24 py-20 overflow-hidden">
            <div className="max-w-4xl relative px-8 flex justify-center items-center" style={{ height: '600px' }}>
                {/* Connection Lines */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                   <div className="network-ring" />
                   <div className="network-ring-inner" />
                </div>

                {/* Nodes Layout */}
                <div className="grid grid-cols-2 gap-10 relative z-10 w-full" style={{ gridTemplateRows: 'repeat(3, auto)' }}>
                    {/* Top Row */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center border border-[#E8EDE8]">
                            <Activity className="text-[#3D5141]" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#3D5141]">Hospital</span>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-[#F0FDF4] rounded-2xl shadow-lg flex items-center justify-center border border-[#DCFCE7]">
                            <Users className="text-[#15803D]" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#15803D]">Doctor</span>
                    </div>

                    {/* Central Shield */}
                    <div className="col-span-2 flex justify-center py-10" style={{ gridColumn: 'span 2' }}>
                       <div className="w-32 h-32 bg-white rounded-[40px] shadow-premium flex items-center justify-center border border-[#E8EDE8] relative shield-pulse">
                          <ShieldCheck size={54} className="text-[#3B82F6]" />
                       </div>
                    </div>

                    {/* Bottom Row */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center border border-[#E8EDE8]">
                            <Lock className="text-[#3D5141]" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#3D5141]">Patient</span>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-[#FFF7ED] rounded-2xl shadow-lg flex items-center justify-center border border-[#FFEDD5]">
                            <Database className="text-[#C2410C]" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#C2410C]">Lab</span>
                    </div>
                </div>
            </div>
        </section>

        {/* 4. How It Works Section */}
        <section className="max-w-1400 px-8 pt-32 pb-40">
           <div className="text-center mb-20">
              <span className="text-xs font-black text-sage uppercase tracking-widest mb-4 block">How it works</span>
              <h2 className="text-5xl font-black text-[#0F172A]">The Standard for Medical Trust</h2>
              <p className="text-muted mt-4 max-w-xl text-center" style={{ marginInline: 'auto' }}>A seamless flow designed for patients and clinicians — in three simple steps.</p>
           </div>

           <div className="grid grid-cols-3 gap-10">
              {[
                {
                  id: '01',
                  title: 'Patient Grants Consent',
                  desc: 'Patients manage permissions via a secure blockchain-linked wallet with one-tap control.',
                  icon: <Users className="text-white" size={20} />,
                },
                {
                  id: '02',
                  title: 'Hospital Requests Access',
                  desc: 'Verified entities submit real-time access requests through the RBAC-protected portal.',
                  icon: <ShieldCheck className="text-white" size={20} />,
                },
                {
                  id: '03',
                  title: 'Immutable Audit',
                  desc: 'Smart contracts log every interaction on the immutable ledger — tamper-proof, forever.',
                  icon: <Lock className="text-white" size={20} />,
                  special: true
                }
              ].map((step) => (
                <div 
                  key={step.id}
                  className="premium-card"
                  style={{ backgroundColor: step.special ? '#F6F9ED' : 'white' }}
                >
                   <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-[#3D5141]/10 rounded-2xl flex items-center justify-center text-xs font-black text-[#3D5141]">
                        {step.id}
                      </div>
                      <div className="w-10 h-10 bg-[#3D5141] rounded-2xl flex items-center justify-center">
                        {step.icon}
                      </div>
                   </div>
                   <h3 className="text-xl font-black mb-4">{step.title}</h3>
                   <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
                </div>
              ))}
           </div>
        </section>
      </main>

      <ConnectWallet openModal={isWalletModalOpen} closeModal={() => setIsWalletModalOpen(false)} />
      <RoleSelectionModal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} />
    </div>
  )
}

export default LandingPage
