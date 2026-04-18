import { useWallet } from '@txnlab/use-wallet-react'
import { useMemo } from 'react'
import { ellipseAddress } from '../utils/ellipseAddress'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { ExternalLink, Globe } from 'lucide-react'

const Account = () => {
  const { activeAddress } = useWallet()
  const algoConfig = getAlgodConfigFromViteEnvironment()

  const networkName = useMemo(() => {
    return algoConfig.network === '' ? 'localnet' : algoConfig.network.toLocaleLowerCase()
  }, [algoConfig.network])

  if (!activeAddress) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Connected Account</span>
         <div className="badge badge-success" style={{ fontSize: '0.65rem' }}>Online</div>
      </div>
      
      <a 
        target="_blank" 
        rel="noreferrer"
        href={`https://lora.algokit.io/${networkName}/account/${activeAddress}/`}
        style={{ 
          fontSize: '1.1rem', 
          fontWeight: 600, 
          color: 'var(--primary)', 
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        {ellipseAddress(activeAddress)}
        <ExternalLink size={14} />
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <Globe size={14} />
        <span>Network: <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{networkName}</span></span>
      </div>
    </div>
  )
}

export default Account
