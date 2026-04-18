import { useWallet } from '@txnlab/use-wallet-react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { 
  Building2, 
  Stethoscope, 
  FlaskConical, 
  User, 
  ShieldCheck, 
  ArrowRight,
  Shield,
  Activity,
  UserCheck,
  Lock,
  Clock
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ConnectWallet from '../components/ConnectWallet'
import { useRole } from '../hooks/useRole'
import logoUrl from '../assets/final_logo.jpeg'

const Landing = () => {
  const { activeAddress } = useWallet()
  const { loading } = useRole()
  const navigate = useNavigate()
  const { scrollY } = useScroll()

  const [walletModalOpen, setWalletModalOpen] = useState(false)

  // Auto-redirect if connected
  useEffect(() => {
    if (activeAddress && !loading) {
      navigate('/patient')
    }
  }, [activeAddress, loading, navigate])

  const navBackground = useTransform(scrollY, [0, 50], ['rgba(244, 246, 244, 0)', 'rgba(244, 246, 244, 0.8)'])

  return (
    <div className="min-h-screen bg-[#f4f6f4] overflow-x-hidden font-['Inter'] flex flex-col relative text-slate-800">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[800px] h-[500px] bg-gradient-to-l from-[#a5c3a9]/30 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute top-[-100px] left-[-200px] w-[500px] h-[500px] bg-gradient-to-r from-[#d9e6d8]/50 to-transparent blur-[120px] pointer-events-none" />

      {/* Navbar */}
      <motion.nav 
        style={{ backgroundColor: navBackground }}
        className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between backdrop-blur-md border-b border-transparent transition-colors"
      >
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Ojasraksha Logo" className="w-10 h-10 object-contain" />
          <span className="font-['Outfit'] font-semibold text-2xl tracking-tight text-[#162723]">Ojasraksha</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/admin')}
            className="px-5 py-2.5 rounded-full border border-[#2d463d] text-[#e0e8e4] bg-[#2d463d]/90 font-medium text-sm transition-all hover:bg-[#1f332c]"
          >
            Admin
          </button>
          
          <button 
            type="button"
            onClick={() => setWalletModalOpen(true)}
            className="px-6 py-2.5 rounded-full bg-[#bfd68c] text-[#1f2937] font-semibold text-sm transition-all hover:bg-[#aacc6d] shadow-sm hover:shadow-md"
          >
            Connect Wallet
          </button>
        </div>
      </motion.nav>

      {/* Hidden Wallet Modal logic decoupled from UI */}
      {walletModalOpen && (
         <div className="hidden">
           <ConnectWallet openModal={walletModalOpen} closeModal={() => setWalletModalOpen(false)} />
         </div>
      )}
      <ConnectWallet openModal={walletModalOpen} closeModal={() => setWalletModalOpen(false)} />


      <main className="flex-grow flex flex-col items-center pt-32 pb-24 w-full">
        
        {/* HERO SECTION */}
        <section className="w-full max-w-5xl px-6 flex flex-col items-center text-center mt-12 mb-24 z-10 relative">
          
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm border border-gray-100 mb-8"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-gray-600 tracking-wide uppercase">Secure Consent Management <span className="text-gray-300 mx-1">|</span> <span className="text-blue-500">v2.4 Released</span></span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="font-['Outfit'] font-black text-[5rem] leading-[1.05] tracking-tight text-[#0a1122] mb-6 max-w-4xl"
          >
            Take Control of Your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8eb563] to-[#5a9c73]">Medical Data</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="text-lg text-[#52665e] max-w-2xl mb-10 leading-relaxed"
          >
            Ojasraksha is a blockchain-powered consent platform that lets patients control who accesses their health records while enabling hospitals to stay compliant.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
            className="flex items-center gap-4"
          >
            <button 
              onClick={() => setWalletModalOpen(true)}
              className="px-8 py-3.5 rounded-xl bg-[#2d463d] text-white font-medium flex items-center gap-2 hover:bg-[#1e3029] transition-colors shadow-lg shadow-[#2d463d]/20"
            >
              Access Patient Portal <ArrowRight size={18} />
            </button>
            <button 
              onClick={() => navigate('/beneficiary-login')}
              className="px-8 py-3.5 rounded-xl bg-[#f0f4f2] text-[#3e5249] font-medium border border-transparent hover:border-[#cfdad5] transition-colors"
            >
              Beneficiary Access
            </button>
          </motion.div>
        </section>

        {/* NODE DIAGRAM SECTION */}
        <section className="relative w-full max-w-4xl h-[450px] flex items-center justify-center mb-32 z-10 pointer-events-none">
          {/* Centered rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[300px] h-[300px] rounded-full border border-[#dce3de]/50 absolute" />
            <div className="w-[450px] h-[450px] rounded-full border border-[#dce3de]/30 absolute border-dashed" />
            <div className="w-[600px] h-[600px] rounded-full border border-[#dce3de]/20 absolute" />
          </div>

          {/* Central Shield Shield */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            className="absolute bg-white rounded-[2rem] w-24 h-24 flex items-center justify-center shadow-xl shadow-blue-900/5 z-20"
          >
            <Shield className="w-10 h-10 text-blue-500" />
          </motion.div>

          {/* Connecting Lines */}
          <svg className="absolute inset-0 w-full h-full -z-10" pointerEvents="none">
             {/* Hospital Line */}
             <line x1="250" y1="180" x2="400" y2="225" stroke="#a0b8a3" strokeWidth="1.5" />
             <circle cx="340" cy="206" r="3" fill="#648868" />
             
             {/* Doctor Line */}
             <line x1="600" y1="180" x2="448" y2="225" stroke="#a0b8a3" strokeWidth="1.5" />
             <circle cx="530" cy="202" r="3" fill="#88b56f" />

             {/* Patient Line */}
             <line x1="250" y1="360" x2="400" y2="270" stroke="#a0b8a3" strokeWidth="1.5" />
             <circle cx="350" cy="300" r="3" fill="#30473a" />

             {/* Lab Line */}
             <line x1="600" y1="360" x2="448" y2="270" stroke="#a0b8a3" strokeWidth="1.5" />
             <circle cx="530" cy="315" r="3" fill="#c4906f" />
          </svg>

          {/* Floating Nodes */}
          
          {/* Hospital */}
          <motion.div 
             initial={{ x: -20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
             className="absolute top-[120px] left-[180px] bg-white rounded-2xl p-4 shadow-lg shadow-gray-200/50 flex flex-col items-center gap-2"
          >
             <div className="bg-[#f0f4f4] rounded-xl p-3"><Building2 className="w-5 h-5 text-[#5e777a]" /></div>
             <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Hospital</span>
          </motion.div>

          {/* Doctor */}
          <motion.div 
             initial={{ x: 20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
             className="absolute top-[120px] right-[180px] bg-white text-white rounded-2xl p-4 shadow-lg shadow-gray-200/50 flex flex-col items-center gap-2"
          >
             <div className="bg-[#f8f9eb] rounded-xl p-3"><Stethoscope className="w-5 h-5 text-[#a3c22b]" /></div>
             <span className="text-[10px] font-bold text-[#a3c22b] tracking-widest uppercase text-slate-800">Doctor</span>
          </motion.div>

          {/* Patient */}
          <motion.div 
             initial={{ x: -20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
             className="absolute bottom-[40px] left-[180px] bg-white rounded-2xl p-4 shadow-lg shadow-gray-200/50 flex flex-col items-center gap-2"
          >
             <div className="bg-[#f4f5f7] rounded-xl p-3"><User className="w-5 h-5 text-[#42526e]" /></div>
             <span className="text-[10px] font-bold text-gray-700 tracking-widest uppercase">Patient</span>
          </motion.div>

          {/* Lab */}
          <motion.div 
             initial={{ x: 20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
             className="absolute bottom-[40px] right-[180px] bg-[#fffcf9] rounded-2xl p-4 shadow-lg shadow-orange-900/5 flex flex-col items-center gap-2"
          >
             <div className="bg-[#fff3eb] rounded-xl p-3"><FlaskConical className="w-5 h-5 text-[#d97c45]" /></div>
             <span className="text-[10px] font-bold text-[#d97c45] tracking-widest uppercase">Lab</span>
          </motion.div>

          {/* Floating Patient Portal Title card */}
           <motion.div 
             animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
             className="absolute -top-[50px] -left-[100px] bg-white rounded-[2rem] pl-4 pr-8 py-4 shadow-xl shadow-gray-300/30 flex items-center gap-4 -rotate-6"
          >
             <div className="bg-[#93b052] rounded-2xl w-14 h-14 flex items-center justify-center">
                 <User className="w-6 h-6 text-white" />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#5c7a6e] tracking-widest uppercase">Portal</span>
                <span className="font-['Outfit'] font-bold text-xl text-[#0a1122]">Patient</span>
             </div>
          </motion.div>

        </section>


        {/* HOW IT WORKS MARQUEE & INTRO */}
        <section className="w-full relative py-16 flex flex-col items-center z-10">
          
          <div className="absolute top-0 w-full overflow-hidden flex whitespace-nowrap opacity-30 select-none">
            <motion.div 
              animate={{ x: [0, -1000] }}
              transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
              className="font-['Outfit'] font-black text-6xl text-[#d4dfd4] tracking-tight flex gap-8 whitespace-nowrap"
            >
              <span>Ojasraksha</span> <span className="text-[#a0b8a3]">Your Health Data. Your Control. Always.</span>
              <span className="ml-8">Ojasraksha</span> <span className="text-[#a0b8a3]">Your Health Data. Your Control. Always.</span>
              <span className="ml-8">Ojasraksha</span> <span className="text-[#a0b8a3]">Your Health Data. Your Control. Always.</span>
            </motion.div>
          </div>

          <div className="relative mt-24 text-center max-w-3xl px-6">
            <h3 className="text-xs font-bold tracking-[0.2em] text-[#6b8c7e] uppercase mb-4">How It Works</h3>
            <h2 className="font-['Outfit'] font-black text-5xl text-[#3b5e51] mb-6 tracking-tight">The Standard for Medical Trust</h2>
            <p className="text-[#647c72] text-lg">A seamless flow designed for patients and clinicians — in three simple steps.</p>
            <div className="w-12 h-1 bg-gradient-to-r from-[#9dc26a] to-[#739e7c] mx-auto mt-8 rounded-full" />
          </div>

          {/* Stepper Cards */}
          <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 px-6">
              
              <motion.div whileHover={{ y: -5 }} className="bg-[#eef2ef] rounded-[2.5rem] p-8 border border-[#e5ece7] relative overflow-hidden flex flex-col">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#e0e8e4] rounded-full blur-2xl -mr-10 -mt-10" />
                 <div className="flex items-center gap-3 mb-6 relative">
                    <div className="w-10 h-10 rounded-full bg-[#7ca390] text-white flex items-center justify-center font-bold text-sm">01</div>
                    <UserCheck className="w-6 h-6 text-[#5b2a86]" />
                 </div>
                 <h4 className="font-['Outfit'] font-bold text-2xl text-[#1e2e28] mb-4 relative hover:text-black">Patient Grants Consent</h4>
                 <p className="text-[#597368] text-[0.95rem] leading-relaxed relative flex-grow">
                    Patients manage permissions via a secure blockchain-linked wallet with one-tap control.
                 </p>
              </motion.div>

              <motion.div whileHover={{ y: -5 }} className="bg-[#e4ece7] rounded-[2.5rem] p-8 border border-[#dce6e1] relative overflow-hidden flex flex-col">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#d2e0d8] rounded-full blur-2xl -mr-10 -mt-10" />
                 <div className="flex items-center gap-3 mb-6 relative">
                    <div className="w-10 h-10 rounded-full bg-[#466657] text-white flex items-center justify-center font-bold text-sm">02</div>
                    <Building2 className="w-6 h-6 text-[#d85e9b]" />
                 </div>
                 <h4 className="font-['Outfit'] font-bold text-2xl text-[#1e2e28] mb-4 relative hover:text-black">Hospital Requests Access</h4>
                 <p className="text-[#597368] text-[0.95rem] leading-relaxed relative flex-grow">
                    Verified entities submit real-time access requests through the RBAC-protected portal.
                 </p>
              </motion.div>

              <motion.div whileHover={{ y: -5 }} className="bg-[#ecf5d5] rounded-[2.5rem] p-8 border border-[#e2edc4] relative overflow-hidden flex flex-col">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#dcf0a8] rounded-full blur-2xl -mr-10 -mt-10" />
                 <div className="flex items-center gap-3 mb-6 relative">
                    <div className="w-10 h-10 rounded-full bg-[#a3c255] text-white flex items-center justify-center font-bold text-sm">03</div>
                    <Lock className="w-6 h-6 text-[#e8702a]" />
                 </div>
                 <h4 className="font-['Outfit'] font-bold text-2xl text-[#1e2e28] mb-4 relative hover:text-black">Immutable Audit</h4>
                 <p className="text-[#597368] text-[0.95rem] leading-relaxed relative flex-grow">
                    Smart contracts log every interaction on the Hedera ledger — tamper-proof, forever.
                 </p>
                 {/* Floating Portal Doctor card (from Image 5) */}
                 <div className="absolute -bottom-6 -right-6 bg-white rounded-3xl pr-6 pl-3 py-3 shadow-xl shadow-[#a3c255]/20 flex items-center gap-3">
                   <div className="bg-[#466657] rounded-xl w-12 h-12 flex items-center justify-center">
                     <Stethoscope className="w-5 h-5 text-white" />
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">Portal</span>
                     <span className="font-['Outfit'] font-bold text-lg text-[#0a1122] leading-tight">Doctor</span>
                   </div>
                 </div>
              </motion.div>

          </div>
        </section>

        {/* PLATFORM CAPABILITIES SECTION */}
        <section className="w-full relative py-24 flex flex-col items-center z-10 bg-white mt-12 rounded-[4rem] px-6">
           <div className="text-center max-w-3xl mb-16">
            <h3 className="text-xs font-bold tracking-[0.2em] text-[#6b8c7e] uppercase mb-4">Platform Capabilities</h3>
            <h2 className="font-['Outfit'] font-black text-5xl text-[#1e2e28] mb-6 tracking-tight">Everything Your Practice Needs</h2>
            <p className="text-[#647c72] text-lg">Built ground-up for healthcare compliance and patient sovereignty.</p>
          </div>

          <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
             
             {/* Card 1 */}
             <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm hover:shadow-xl transition-shadow flex flex-col">
                <div className="w-16 h-16 rounded-2xl bg-[#f4faef] flex items-center justify-center mb-8">
                   <ShieldCheck className="w-8 h-8 text-[#90c242]" />
                </div>
                <h4 className="font-['Outfit'] font-bold text-2xl text-[#1e2e28] mb-4">Consent Management</h4>
                <p className="text-[#6b7280] leading-relaxed flex-grow">
                   Granular control over who sees your data and for how long — with one-click revocation at any time.
                </p>
             </div>

             {/* Card 2 */}
             <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm hover:shadow-xl transition-shadow flex flex-col">
                <div className="w-16 h-16 rounded-2xl bg-[#f0f4f8] flex items-center justify-center mb-8">
                   <Clock className="w-8 h-8 text-[#64748b]" />
                </div>
                <h4 className="font-['Outfit'] font-bold text-2xl text-[#1e2e28] mb-4">Immutable Audit Logs</h4>
                <p className="text-[#6b7280] leading-relaxed flex-grow">
                   Tamper-proof logs secured by Algorand blockchain consensus. Proof of every access, forever.
                </p>
             </div>

             {/* Card 3 (Hover active state based on Image 4) */}
             <div className="bg-white rounded-[2rem] p-10 border-t-2 border-t-[#cde0ca] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] flex flex-col relative overflow-hidden -translate-y-2">
                <div className="w-16 h-16 rounded-2xl bg-[#e5e9ec] flex items-center justify-center mb-8 relative z-10">
                   <UserCheck className="w-8 h-8 text-[#334155]" />
                </div>
                <h4 className="font-['Outfit'] font-bold text-2xl text-[#1e2e28] mb-4 relative z-10">Patient Data Ownership</h4>
                <p className="text-[#6b7280] leading-relaxed flex-grow mb-6 relative z-10">
                   You own the keys to your records. No third-party intermediaries, no silent data sales.
                </p>
                <div className="relative z-10">
                  <a href="#" className="font-bold text-sm text-[#1e2e28] hover:underline inline-flex flex-row items-center gap-1 group">
                    Learn more <span className="opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight size={14}/></span>
                  </a>
                </div>
             </div>

          </div>
        </section>

      </main>

      {/* FOOTER SECTION */}
      <footer className="w-full bg-[#1c2e26] pt-16 pb-8 px-12 md:px-24 flex flex-col gap-12 z-20 relative">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          
          {/* Logo & Description */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="w-24 h-24 bg-[#23352d] border border-[#3e5249] rounded-2xl flex items-center justify-center shadow-lg p-3">
              <img src={logoUrl} alt="Ojasraksha Logo" className="w-full h-full object-contain rounded-xl bg-white" />
            </div>
            <p className="text-[#8e9c93] max-w-xs leading-relaxed font-medium">
              Pioneering the future of HIPAA and GDPR compliant health data governance.
            </p>
          </div>

          {/* Compliance Info */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[#bfd68c] text-[10px] font-black uppercase tracking-[0.2em]">Compliance</h4>
            <span className="text-[#cce3d5] text-sm hover:text-white transition-colors cursor-pointer">DPDP Act 2023</span>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[#bfd68c] text-[10px] font-black uppercase tracking-[0.2em]">Contact</h4>
            <a href="mailto:ojasraksha@gmail.com" className="text-[#cce3d5] text-sm hover:text-white transition-colors">ojasraksha@gmail.com</a>
          </div>

        </div>

        <div className="w-full border-t border-[#2e4038] mt-4 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-[#72857a] text-xs font-medium">© 2026 Ojasraksha Inc. All rights reserved.</span>
          <div className="flex items-center gap-8">
            <a href="#" className="text-[#72857a] text-xs font-medium hover:text-[#cce3d5] transition-colors">Privacy Policy</a>
            <a href="#" className="text-[#72857a] text-xs font-medium hover:text-[#cce3d5] transition-colors">Terms of Service</a>
            <a href="#" className="text-[#72857a] text-xs font-medium hover:text-[#cce3d5] transition-colors">Cookie Policy</a>
          </div>
        </div>
      </footer>

    </div>
  )
}

export default Landing
