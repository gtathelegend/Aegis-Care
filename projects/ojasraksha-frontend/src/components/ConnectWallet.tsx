import { useWallet, Wallet, WalletId } from '@txnlab/use-wallet-react'
import { X, Wallet as WalletIcon, LogOut } from 'lucide-react'
import Account from './Account'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { wallets, activeAddress } = useWallet()

  const isKmd = (wallet: Wallet) => wallet.id === WalletId.KMD

  if (!openModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in-scale" onClick={closeModal} style={{ animationDuration: '0.2s' }}>
      <div className="w-full max-w-sm vercel-card relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">Connect Account</h3>
          <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {activeAddress ? (
            <>
              <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                 <Account />
              </div>
              
              <button
                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-semibold py-3 px-4 rounded-xl border border-red-100 hover:bg-red-100 transition-colors"
                onClick={async () => {
                  try {
                      if (wallets) {
                        const activeWallet = wallets.find((w) => w.isActive)
                        if (activeWallet) {
                          await activeWallet.disconnect()
                        } else {
                          localStorage.removeItem('@txnlab/use-wallet:v3')
                          window.location.reload()
                        }
                      }
                  } catch (e: any) {
                      console.warn('Disconnect error mitigated', e)
                  }
                }}
              >
                <LogOut size={18} /> Disconnect Active Session
              </button>
            </>
          ) : (
            wallets?.map((wallet) => (
              <button
                key={`provider-${wallet.id}`}
                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-sm transition-all"
                onClick={() => {
                  // Catch connection errors (e.g. Session currently connected) cleanly
                  wallet.connect().catch((e) => {
                      if (e?.message?.includes('currently connected')) {
                          console.warn('Handling concurrent wallet connection request')
                      } else {
                           console.error(e)
                      }
                  })
                  closeModal()
                }}
              >
                <div className="flex items-center gap-3">
                  {!isKmd(wallet) ? (
                    <img
                      alt={wallet.id}
                      src={wallet.metadata.icon}
                      className="w-8 h-8 rounded-lg shadow-sm bg-white"
                    />
                  ) : (
                    <WalletIcon size={32} className="text-blue-500" />
                  )}
                  <span className="font-semibold text-gray-800">{isKmd(wallet) ? 'LocalNet Node (KMD)' : wallet.metadata.name}</span>
                </div>
                {wallet.isActive && <div className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Active</div>}
              </button>
            ))
          )}
        </div>

        {!activeAddress && (
          <p className="mt-8 text-xs font-semibold text-gray-400 text-center px-4 leading-relaxed tracking-wider">
            By connecting, you securely verify interactions on the Algorand blockchain.
          </p>
        )}
      </div>
    </div>
  )
}

export default ConnectWallet
