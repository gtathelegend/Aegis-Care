import { useWallet } from '@txnlab/use-wallet-react'
import { ShieldCheck, Fingerprint, Loader2, ArrowRight } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../hooks/useRole'
import ConnectWallet from '../components/ConnectWallet'
import { WalletMapperClient } from '../contracts/WalletMapper'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { useSnackbar } from 'notistack'

const TARGET_WALLET = 'ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM'

const LoginScreen = () => {
  const { activeAddress, transactionSigner, wallets } = useWallet()
  const { shortId, role, roles, loading: roleLoading, refresh } = useRole()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  
  const [registering, setRegistering] = useState(false)

  const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
  const appId = Number(import.meta.env.VITE_WALLET_MAPPER_APP_ID || 0)

  const isCorrectWallet = activeAddress === TARGET_WALLET

  // Smart redirect: Connect Wallet -> Dashboard
  useEffect(() => {
    if (activeAddress && !roleLoading) {
      navigate('/patient')
    }
  }, [activeAddress, roleLoading, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50/50 relative overflow-hidden">
      
      {/* Decorative background elements Stripe-style */}
      <div className="absolute top-0 w-full h-[500px] bg-gradient-to-b from-blue-50 to-transparent -z-10" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-3xl rounded-full mix-blend-multiply -z-10 animate-pulse" />
      <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] bg-teal-400/10 blur-3xl rounded-full mix-blend-multiply -z-10 animate-pulse" />


      <div className="w-full max-w-md animate-fade-in-scale flex flex-col items-center">
        
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center">
           <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4 hover:scale-105 transition-transform">
               <ShieldCheck size={28} />
           </div>
           <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Aegis</h1>
           <p className="text-gray-500 text-sm font-medium">Securing DPDP Health Corridors</p>
        </div>

        {/* Global Card */}
        <div className="vercel-card w-full mb-8">
          
          {!activeAddress ? (
            <div className="flex flex-col items-center justify-center py-6">
               <h2 className="text-xl font-semibold mb-6 text-gray-800 tracking-tight">Connect to Network</h2>
               <ConnectWallet openModal={true} closeModal={() => {}} />
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest tracking-[0.25em]">Entering Patient Node...</p>
             </div>
          )}
        </div>

        <p className="text-xs font-medium text-gray-400 text-center uppercase tracking-wider">
           Algorand Protocol v4.1
        </p>

      </div>
    </div>
  )
}

export default LoginScreen
