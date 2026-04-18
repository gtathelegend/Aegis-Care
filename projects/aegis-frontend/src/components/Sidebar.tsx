import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  ShieldCheck, 
  FileText, 
  Activity, 
  Settings, 
  Users,
  Database,
  Lock,
  HeartPulse
} from 'lucide-react'

const Sidebar = ({ role }: { role: string }) => {
  const isPatient = role === 'patient'
  const isHospital = role === 'hospital'

  return (
    <aside className="sidebar">
      <div className="flex items-center gap-3 px-4 mb-10">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <ShieldCheck className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-bold font-display tracking-tightest">OjasRaksha</span>
      </div>

      <nav className="flex-1">
        <p className="text-xs font-bold text-light uppercase tracking-widest px-4 mb-4">Main Menu</p>
        
        <NavLink to={isPatient ? '/patient' : '/hospital'} className="nav-item">
          <LayoutDashboard /> Dashboard
        </NavLink>

        <NavLink to="/records" className="nav-item">
          <FileText /> {isPatient ? 'My Records' : 'Patient Records'}
        </NavLink>

        <NavLink to="/consent" className="nav-item">
          <Lock /> {isPatient ? 'Consents' : 'Access Manager'}
        </NavLink>

        <NavLink to="/audit" className="nav-item">
          <Activity /> Audit Logs
        </NavLink>

        {isHospital && (
          <NavLink to="/patients" className="nav-item">
            <Users /> Managed Patients
          </NavLink>
        )}

        <div className="mt-8">
          <p className="text-xs font-bold text-light uppercase tracking-widest px-4 mb-4">Registry</p>
          <NavLink to="/providers" className="nav-item">
            <Database /> {isPatient ? 'Hospitals' : 'Registry'}
          </NavLink>
          {isPatient && (
            <NavLink to="/research" className="nav-item">
              <HeartPulse /> Research
            </NavLink>
          )}
        </div>
      </nav>

      <div className="pt-6 border-t border-border mt-auto">
        <NavLink to="/settings" className="nav-item">
          <Settings /> Settings
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
