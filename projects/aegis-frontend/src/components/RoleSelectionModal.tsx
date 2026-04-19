import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useRole } from '../hooks/useRole'
import {
  Building2,
  Stethoscope,
  Users,
  FlaskConical,
  Pill,
  Shield,
  Clipboard,
  LogOut
} from 'lucide-react'

interface RoleSelectionModalProps {
  isOpen: boolean
  onClose: () => void
}

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; label: string; path: string; color: string }> = {
  patient: {
    icon: <Users className="w-8 h-8" />,
    label: 'Patient',
    path: '/patient',
    color: 'text-violet-600'
  },
  hospital: {
    icon: <Building2 className="w-8 h-8" />,
    label: 'Hospital',
    path: '/hospital',
    color: 'text-lime-600'
  },
  doctor: {
    icon: <Stethoscope className="w-8 h-8" />,
    label: 'Doctor',
    path: '/doctor',
    color: 'text-coral-600'
  },
  lab: {
    icon: <FlaskConical className="w-8 h-8" />,
    label: 'Lab',
    path: '/lab',
    color: 'text-sky-600'
  },
  pharmacy: {
    icon: <Pill className="w-8 h-8" />,
    label: 'Pharmacy',
    path: '/pharmacy',
    color: 'text-sun-600'
  },
  insurance: {
    icon: <Shield className="w-8 h-8" />,
    label: 'Insurance',
    path: '/insurance',
    color: 'text-violet-600'
  },
  auditor: {
    icon: <Clipboard className="w-8 h-8" />,
    label: 'Auditor',
    path: '/auditor',
    color: 'text-slate-600'
  },
  admin: {
    icon: <Shield className="w-8 h-8" />,
    label: 'Admin',
    path: '/admin',
    color: 'text-red-600'
  }
}

export default function RoleSelectionModal({ isOpen, onClose }: RoleSelectionModalProps) {
  const { roles, isAdmin, loading } = useRole()
  const navigate = useNavigate()
  const { wallets } = useWallet()

  useEffect(() => {
    if (!loading && isOpen && roles.length > 0) {
      // If user has only one role, auto-navigate
      if (roles.length === 1 && !isAdmin) {
        const role = roles[0]
        const config = ROLE_CONFIG[role]
        if (config) {
          navigate(config.path)
          onClose()
        }
      }
    }
  }, [loading, roles, isAdmin, navigate, isOpen, onClose])

  if (!isOpen || loading) return null

  const displayRoles = isAdmin ? ['admin', ...roles] : roles

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Your Portal</h2>
          <p className="text-gray-600">Choose how you'd like to access Aegis Care</p>
        </div>

        {displayRoles && displayRoles.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {displayRoles.map((role) => {
              const config = ROLE_CONFIG[role]
              if (!config) return null

              return (
                <button
                  key={role}
                  onClick={() => {
                    navigate(config.path)
                    onClose()
                  }}
                  className="group relative p-6 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-400 hover:shadow-lg transition-all"
                >
                  <div className={`${config.color} mb-4 flex justify-center`}>
                    {config.icon}
                  </div>
                  <div className="font-semibold text-gray-900 text-lg">{config.label}</div>
                  <div className="text-sm text-gray-500 mt-1">Access portal</div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-6">Loading your role information...</p>
            <p className="text-sm text-gray-500">Please wait while we verify your access.</p>
          </div>
        )}

        {displayRoles && displayRoles.length > 0 && (
          <div className="border-t border-gray-200 pt-6 flex justify-between">
            <button
              onClick={async () => {
                try {
                  if (wallets) {
                    const activeWallet = wallets.find((w: any) => w.isActive)
                    if (activeWallet) {
                      await activeWallet.disconnect()
                    }
                  }
                } catch (e) {
                  console.warn('Disconnect error', e)
                }
                onClose()
              }}
              className="px-6 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
            >
              <LogOut className="inline mr-2 w-4 h-4" />
              Disconnect
            </button>
            {displayRoles.length > 1 && (
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
