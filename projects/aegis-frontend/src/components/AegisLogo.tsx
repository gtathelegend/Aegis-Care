import { Shield } from 'lucide-react'

interface AegisLogoProps {
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function AegisLogo({ showText = true, size = 'md' }: AegisLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  const iconSize = {
    sm: 16,
    md: 20,
    lg: 24
  }

  const textSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} bg-gray-900 rounded-xl flex items-center justify-center shadow-md flex-shrink-0`}>
        <Shield size={iconSize[size]} className="text-emerald-400 stroke-[2.5]" />
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-black text-gray-900 tracking-tight ${textSize[size]}`}>Aegis-Care</span>
          <span className="text-[10px] text-gray-500 font-semibold">v2.4</span>
        </div>
      )}
    </div>
  )
}
