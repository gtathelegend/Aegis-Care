import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useRole } from '../hooks/useRole'
import { WalletMapperClient } from '../contracts/WalletMapperClient'
import { AuditLogClient } from '../contracts/AuditLogClient'
import { useSnackbar } from 'notistack'
import { getAlgorandClientFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import algosdk from 'algosdk'
import bcrypt from 'bcryptjs'
import { ShieldCheck, ArrowLeft, Loader2, KeyRound, Wallet } from 'lucide-react'
import ConnectWallet from '../components/ConnectWallet'

const BeneficiaryLogin = () => {
    const { activeAddress, transactionSigner } = useWallet()
    const { shortId, enableProxy } = useRole()
    const navigate = useNavigate()
    const { enqueueSnackbar } = useSnackbar()

    const [ownerId, setOwnerId] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [walletModalOpen, setWalletModalOpen] = useState(false)

    const algorand = useMemo(() => getAlgorandClientFromViteEnvironment(), [])
    const mapperAppId = Number(import.meta.env.VITE_WALLET_MAPPER_APP_ID || 0)
    const auditAppId = Number(import.meta.env.VITE_AUDIT_LOG_APP_ID || 0)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!activeAddress) {
            enqueueSnackbar('Please connect your wallet first.', { variant: 'error' })
            return
        }
        if (!shortId) {
            enqueueSnackbar('You must establish your own digital identity first before acting as a proxy.', { variant: 'warning' })
            return
        }
        if (!ownerId || !password) {
            enqueueSnackbar('Please fill all fields', { variant: 'warning' })
            return
        }

        setLoading(true)
        try {
            const mapper = new WalletMapperClient({ appId: BigInt(mapperAppId), algorand })
            
            // 1. Resolve Owner's Address
            const ownerIdBytes = new Uint8Array(6)
            for (let i = 0; i < 6; i++) ownerIdBytes[i] = ownerId.charCodeAt(i) || 0

            let ownerAddress = ''
            try {
                ownerAddress = await mapper.getWalletFromShortId({ args: { shortId: ownerIdBytes } })
            } catch {
                throw new Error("Owner Medical ID not found on the network.")
            }

            // 2. Fetch Beneficiaries mapping for Owner
            const benBoxName = new Uint8Array([...new TextEncoder().encode('ben_'), ...algosdk.decodeAddress(ownerAddress).publicKey])
            
            let beneficiaries: any[] = []
            try {
                const bResult = await mapper.getBeneficiaries({
                    args: { owner: ownerAddress },
                    sender: activeAddress as string,
                    boxReferences: [{ appId: BigInt(mapperAppId), name: benBoxName }]
                })
                beneficiaries = bResult || []
            } catch (err) {
                console.debug("No beneficiaries array found", err)
                throw new Error("Owner has not configured any proxy access.")
            }

            // 3. Find this caller in the array
            const myRecord = beneficiaries.find(b => {
                const bIdString = String.fromCharCode(...Array.from(b[0] as number[])).trim().replace(/\0/g, '')
                return bIdString === shortId
            })

            if (!myRecord) {
                throw new Error("You are not registered as a beneficiary for this patient.")
            }

            // 4. Verify password
            const storedHash = myRecord[2]
            const isValid = await bcrypt.compare(password, storedHash)

            if (!isValid) {
                throw new Error("Invalid cryptographic passphrase.")
            }

            // 5. Success - Log Access
            const auditC = new AuditLogClient({ appId: BigInt(auditAppId), algorand })
            await auditC.send.logDataAccessed({
                args: {
                    principal: ownerAddress,
                    fiduciary: activeAddress as string,
                    purpose: "BENEFICIARY_ACCESS",
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    isEmergency: true
                },
                sender: activeAddress as string,
                signer: transactionSigner
            })

            enableProxy(ownerAddress, ownerId)
            enqueueSnackbar('Access Granted. Entering Read-Only Patient Subsystem.', { variant: 'success' })
            navigate('/patient')

        } catch (e: any) {
            console.error(e)
            enqueueSnackbar(e.message || 'Access Denied', { variant: 'error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#f4f6f4] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <button 
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-[#5c7a6e] hover:text-[#2d463d] font-bold text-sm mb-6 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Hub
                </button>

                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-emerald-900/5 border border-[#dce3de] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#eaf0e6] rounded-full blur-2xl -mr-10 -mt-10" />
                    
                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-[#2d463d] rounded-2xl flex items-center justify-center text-white shadow-lg mb-6">
                            <KeyRound size={28} />
                        </div>
                        
                        <h2 className="font-['Outfit'] text-2xl font-black text-[#162723] mb-2 tracking-tight">Beneficiary Access</h2>
                        <p className="text-[#647c72] text-sm mb-8">Access read-only medical records on behalf of a principal patient.</p>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#4e6b5f] uppercase tracking-wider block mb-2">Principal 6-Char ID</label>
                                <input
                                    type="text"
                                    value={ownerId}
                                    onChange={(e) => setOwnerId(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    placeholder="e.g. 123ABC"
                                    className="w-full px-4 py-3 bg-[#fcfcfc] border border-[#dce3de] rounded-xl outline-none focus:border-[#5c7a6e] focus:ring-4 focus:ring-[#5c7a6e]/10 transition-all font-mono tracking-widest text-[#162723]"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#4e6b5f] uppercase tracking-wider block mb-2">Secret Passphrase</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 bg-[#fcfcfc] border border-[#dce3de] rounded-xl outline-none focus:border-[#5c7a6e] focus:ring-4 focus:ring-[#5c7a6e]/10 transition-all"
                                />
                            </div>

                            {!activeAddress ? (
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setWalletModalOpen(true); }}
                                    className="w-full bg-[#f0f4f2] hover:bg-[#e4ece8] text-[#3e5249] font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-6 border border-[#dce3de]"
                                >
                                    <Wallet size={18} />
                                    Connect Wallet to Sign In
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[#bfd68c] hover:bg-[#aacc6d] text-[#1f332c] font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-6 shadow-sm"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                    {loading ? 'Verifying Identity...' : 'Unlock Secure View'}
                                </button>
                            )}
                        </form>
                    </div>
                </div>

                <ConnectWallet openModal={walletModalOpen} closeModal={() => setWalletModalOpen(false)} />
            </div>
        </div>
    )
}

export default BeneficiaryLogin
