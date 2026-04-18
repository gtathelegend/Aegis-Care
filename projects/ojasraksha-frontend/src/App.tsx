import { SupportedWallet, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { SnackbarProvider } from 'notistack'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import BeneficiaryLogin from './pages/BeneficiaryLogin'
import PatientPortal from './pages/PatientPortal'
import HospitalPortal from './pages/HospitalPortal'
import DoctorDashboard from './pages/DoctorDashboard'
import LabDashboard from './pages/LabDashboard'
import PharmacyDashboard from './pages/PharmacyDashboard'
import InsuranceDashboard from './pages/InsuranceDashboard'
import AuditorDashboard from './pages/AuditorDashboard'
import AdminDashboard from './pages/AdminDashboard'
import DashboardShell from './components/DashboardShell'
import { useRole } from './hooks/useRole'
import { getAlgodConfigFromViteEnvironment, getKmdConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
import './styles/App.css'



let supportedWallets: SupportedWallet[]
if (import.meta.env.VITE_ALGOD_NETWORK === 'localnet') {
  const kmdConfig = getKmdConfigFromViteEnvironment()
  supportedWallets = [
    {
      id: WalletId.KMD,
      options: {
        baseServer: kmdConfig.server,
        token: String(kmdConfig.token),
        port: String(kmdConfig.port),
      },
    },
  ]
} else {
  supportedWallets = [
    { id: WalletId.DEFLY },
    { id: WalletId.PERA },
    { id: WalletId.EXODUS },
  ]
}

const algodConfig = getAlgodConfigFromViteEnvironment()

const walletManager = new WalletManager({
  wallets: supportedWallets,
  defaultNetwork: algodConfig.network,
  networks: {
    [algodConfig.network]: {
      algod: {
        baseServer: algodConfig.server,
        port: Number(algodConfig.port),
        token: algodConfig.token as any,
      },
    },
  },
  options: {
    resetNetwork: true,
  },
})

export default function App() {
  return (
    <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <WalletProvider manager={walletManager}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/register" element={<Navigate to="/" replace />} />
            <Route path="/beneficiary-login" element={<BeneficiaryLogin />} />

            {/* Admin — self-gates via isAdmin flag from useRole */}
            <Route path="/admin" element={<AdminDashboard />} />

            {/* Dashboard Protected Routes */}
            <Route path="/patient" element={<DashboardShell><PatientPortal /></DashboardShell>} />
            <Route path="/hospital" element={<DashboardShell><HospitalPortal /></DashboardShell>} />
            <Route path="/doctor" element={<DashboardShell><DoctorDashboard /></DashboardShell>} />
            <Route path="/lab" element={<DashboardShell><LabDashboard /></DashboardShell>} />
            <Route path="/pharmacy" element={<DashboardShell><PharmacyDashboard /></DashboardShell>} />
            <Route path="/insurance" element={<DashboardShell><InsuranceDashboard /></DashboardShell>} />
            <Route path="/auditor" element={<DashboardShell><AuditorDashboard /></DashboardShell>} />

            {/* Patient Sub-routes */}
            <Route path="/records" element={<DashboardShell><PatientPortal /></DashboardShell>} />
            <Route path="/consents" element={<DashboardShell><PatientPortal /></DashboardShell>} />
            <Route path="/audit" element={<DashboardShell><PatientPortal /></DashboardShell>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </SnackbarProvider>
  )
}
