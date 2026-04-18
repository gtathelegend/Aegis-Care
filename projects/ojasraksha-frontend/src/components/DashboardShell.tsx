import React, { ReactNode, useState, useMemo } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import logoUrl from '../assets/final_logo.jpeg'
import { 
  ShieldCheck, 
  LogOut, 
  Fingerprint,
  Loader2,
  ChevronDown,
  LayoutDashboard,
  FileText,
  Activity,
  Users
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useRole } from '../hooks/useRole'
import { WalletMapperClient } from '../contracts/WalletMapper'
import algosdk from 'algosdk'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { useSnackbar } from 'notistack'

interface DashboardShellProps {
  children: ReactNode
}

const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const { activeAddress, wallets, transactionSigner } = useWallet()
  const { role, roles, shortId, loading, refresh, isProxyActive, proxyShortId, disableProxy } = useRole()
  const location = useLocation()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  
  const [registering, setRegistering] = useState(false)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const mapperAppId = Number(import.meta.env.VITE_WALLET_MAPPER_APP_ID || 0)

  if (!activeAddress && !isProxyActive) return null

  const handleDisconnect = () => {
     if (isProxyActive) disableProxy()
     wallets.forEach(w => w.disconnect())
     window.location.replace('/')
  }

  const handleGenerateShortId = async () => {
    if (!activeAddress || !transactionSigner) return
    
    setRegistering(true)
    const client = new WalletMapperClient({ appId: BigInt(mapperAppId), algorand })
    algorand.setSigner(activeAddress, transactionSigner)

    try {
      // 🔍 MANDATORY PRE-CHECK (Step 1)
      console.debug('[DashboardShell] Performing final on-chain identity check...')
      const boxName = new Uint8Array([...new TextEncoder().encode('adr_'), ...algosdk.decodeAddress(activeAddress).publicKey])
      
      let sidBytesCheck: Uint8Array | null = null
      try {
         const boxResp = await algorand.client.algod.getApplicationBoxByName(mapperAppId, boxName).do()
         if (boxResp && boxResp.value) {
            sidBytesCheck = boxResp.value
         }
      } catch (e) {
         // Silently swallow the 404 block if they are genuinely unregistered
      }
      
      if (sidBytesCheck && sidBytesCheck.length > 0) {
        const existingSid = String.fromCharCode(...Array.from(sidBytesCheck)).trim().replace(/\0/g, '')
        if (existingSid) {
          console.debug(`[DashboardShell] Identity ${existingSid} already exists, aborting registration.`)
          await refresh()
          return
        }
      }

      // ⚙️ GENERATION LOGIC (Step 2: 3-3 format)
      const randomNum = Math.floor(Math.random() * 900) + 100 
      const suffix = activeAddress.slice(-3).toUpperCase()
      const finalId = `${randomNum}${suffix}`
      
      console.debug(`[DashboardShell] Candidate ID: ${finalId}`)

      const sidBytes = new Uint8Array(6)
      for (let i = 0; i < 6; i++) sidBytes[i] = finalId.charCodeAt(i)

      // 🔁 SAFE TRANSACTION CALL (Step 3)
      try {
        await client.send.registerShortId({ 
          args: { shortId: sidBytes },
          sender: activeAddress,
          signer: transactionSigner
        })
        enqueueSnackbar(`Identity linked successfully: ${finalId}`, { variant: 'success' })
      } catch (txErr: any) {
        // Handle "already has a different Short ID" explicitly to prevent redundant errors
        if (txErr.message && txErr.message.includes('already has a different Short ID')) {
            console.warn('[DashboardShell] Transaction failed: Identity already exists.')
        } else {
            throw txErr 
        }
      }

      // Final identity refresh to update UI badge
      await refresh()
      
    } catch (e: any) {
      console.error('[DashboardShell] Identity registration flow failed:', e)
      enqueueSnackbar('Transaction failed. Please ensure you have enough ALGO for MBR.', { variant: 'error' })
    } finally {
      setRegistering(false)
    }
  }

  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/patient') return 'Patient Dashboard'
    if (path === '/hospital') return 'Hospital Portal'
    if (path === '/doctor') return 'Doctor Dashboard'
    if (path === '/lab') return 'Lab Dashboard'
    if (path === '/pharmacy') return 'Pharmacy Dashboard'
    if (path === '/insurance') return 'Insurance Dashboard'
    if (path === '/auditor') return 'Auditor Dashboard'
    if (path === '/admin') return 'Admin Dashboard'
    return 'Dashboard'
  }

  const navItems = useMemo(() => {
    if (role === 'patient') {
      return [
        { name: 'Portal', path: '/patient', icon: LayoutDashboard },
        { name: 'Records', path: '/records', icon: FileText },
        { name: 'Consents', path: '/consents', icon: ShieldCheck },
        { name: 'Audit', path: '/audit', icon: Activity }
      ]
    }
    
    // For other roles, keep it simple or expand as needed
    const items = [
      { name: 'Dashboard', path: `/${role}`, icon: LayoutDashboard },
    ]
    
    if (role === 'hospital') {
      items.push({ name: 'Managed Patients', path: '/patients', icon: Users })
    }
    
    if (role === 'auditor') {
      items.push({ name: 'System Logs', path: '/auditor', icon: Activity })
    }

    return items
  }, [role])

  return (
    <div className="min-h-screen bg-[#f4f6f4] flex">
      <aside className="w-64 bg-[#fcfcfc] border-r border-[#dce3de] flex flex-col flex-shrink-0 relative z-10 hidden lg:flex shadow-[4px_0_24px_rgba(0,0,0,0.02)]">

        {/* Branding */}
        <div className="h-20 flex items-center px-6 border-b border-[#dce3de] bg-[#f4f6f4]">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Ojasraksha Logo" className="w-10 h-10 object-contain rounded-xl shadow-sm" />
            <span className="font-black text-[#162723] tracking-tighter text-xl font-['Outfit']">Ojasraksha</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-1 overflow-y-auto">
           {navItems.map(item => (
              <Link 
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  location.pathname.startsWith(item.path) 
                    ? 'bg-[#eaf0e6] text-[#2d463d] shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <item.icon size={18} className={location.pathname.startsWith(item.path) ? 'text-[#2d463d]' : 'text-gray-400'} />
                {item.name}
              </Link>
           ))}

           {/* If user has a specific role dashboard currently active, show it up */}
           {role !== 'patient' && role !== 'unknown' && location.pathname.startsWith(`/${role}`) && (
              <div className="pt-4 mt-4 border-t border-gray-100">
                <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Workspace</div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-gray-900 text-white shadow-md">
                   <LayoutDashboard size={18} className="opacity-75" />
                   <span className="capitalize">{role} Portal</span>
                </div>
              </div>
           )}
        </div>

        {/* Lower Info */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
           <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">State Configured</span>
                  <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-gray-900 uppercase">TestNet</span>
                  </div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        
        {/* 2. Top Navbar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-50">
          
          {/* Left: Mobile Title or Breadcrumb */}
          <div className="flex-1 flex items-center">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">{getPageTitle()}</h2>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-5">
            
            {/* ShortID Badge / Generate Button */}
            {loading ? (
              <div className="h-9 w-32 bg-gray-100 animate-pulse rounded-full" />
            ) : shortId ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#eaf0e6] border border-[#dce3de] rounded-lg animate-fade-in shadow-inner">
                <Fingerprint size={14} className="text-[#5c7a6e]" />
                <span className="text-xs font-bold text-[#1f332c] font-mono tracking-wider">{shortId}</span>
                <span className="text-[10px] font-black text-[#7ca390] uppercase ml-1 border-l border-[#bdc4be] pl-2">Verified</span>
              </div>
            ) : (
              <button 
                onClick={handleGenerateShortId}
                disabled={registering}
                className="bg-gradient-to-r from-[#2d463d] to-[#5c7a6e] hover:from-[#1f332c] hover:to-[#4e6b5f] text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg shadow-[#5c7a6e]/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {registering ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
                {registering ? 'Generating...' : 'Generate Short ID'}
              </button>
            )}

            {/* Role Switcher Dropdown (if multi-role) */}
            {roles.length > 1 && (
              <div className="relative">
                <button 
                  onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                  title="Switch Portal"
                >
                  <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-gray-500">
                    <LayoutDashboard size={14} />
                  </div>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showRoleDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowRoleDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-2xl z-20 overflow-hidden animate-fade-in-scale transform origin-top-right py-2">
                      <div className="px-4 py-2 border-b border-gray-50 mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Portal</span>
                      </div>
                      {roles.map(r => (
                        <button
                          key={r}
                          onClick={() => {
                            navigate(`/${r === 'admin' ? 'admin' : r}`)
                            setShowRoleDropdown(false)
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${location.pathname.includes(r) ? 'text-[#2d463d] font-bold bg-[#eaf0e6]' : 'text-gray-600 font-medium'}`}
                        >
                           <div className={`w-2 h-2 rounded-full ${location.pathname.includes(r) ? 'bg-[#2d463d]' : 'bg-transparent'}`} />
                           <span className="capitalize text-sm">{r === 'patient' ? 'Patient Portal' : `${r} Dashboard`}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Wallet Info / Proxy Status */}
            {isProxyActive ? (
              <div className="flex items-center gap-3 px-3 py-1.5 bg-[#eaf0e6] border border-[#dce3de] rounded-xl shadow-sm">
                 <div className="flex flex-col">
                   <span className="text-[10px] font-black text-[#5c7a6e] tracking-widest uppercase">Read-Only Proxy</span>
                   <span className="text-xs font-bold text-[#1f332c]">For: {proxyShortId}</span>
                 </div>
                 <button 
                   onClick={() => { disableProxy(); navigate('/') }}
                   className="ml-2 px-2 py-1 bg-white hover:bg-white/80 text-[#2d463d] border border-[#dce3de] text-[10px] font-bold rounded-lg transition-colors"
                 >
                   Exit
                 </button>
              </div>
            ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="font-mono text-xs font-bold text-gray-700">{activeAddress?.slice(0,6)}...{activeAddress?.slice(-4)}</span>
                </div>
            )}

            {/* Disconnect */}
            <button 
              onClick={handleDisconnect}
              className="p-2 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all shadow-sm"
              title="Log Out"
            >
              <LogOut size={16} />
            </button>

          </div>
        </header>

        {/* 3. Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50/50 relative">
          <div className="max-w-6xl mx-auto w-full animate-fade-in-scale">
            {children}
          </div>
        </main>
      </div>

    </div>
  )
}

export default DashboardShell
