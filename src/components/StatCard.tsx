import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'vault' | 'routine' | 'todo' | 'neutral'
  icon?: ReactNode
}

const ACCENT_STYLES: Record<NonNullable<StatCardProps['accent']>, { border: string; text: string; gradient: string; glow: string }> = {
  vault:   { border: 'border-violet-500/30 hover:border-violet-400/50',  text: 'text-violet-300',  gradient: 'from-violet-400 to-violet-200',  glow: 'shadow-violet-500/10' },
  routine: { border: 'border-cyan-500/30 hover:border-cyan-400/50',      text: 'text-cyan-300',    gradient: 'from-cyan-400 to-cyan-200',      glow: 'shadow-cyan-500/10' },
  todo:    { border: 'border-emerald-500/30 hover:border-emerald-400/50', text: 'text-emerald-300', gradient: 'from-emerald-400 to-emerald-200', glow: 'shadow-emerald-500/10' },
  neutral: { border: 'border-zinc-800 hover:border-zinc-700',             text: 'text-zinc-400',    gradient: 'from-zinc-200 to-zinc-400',       glow: 'shadow-zinc-900/10' },
}

export const StatCard = ({ label, value, sub, accent = 'neutral', icon }: StatCardProps) => {
  const style = ACCENT_STYLES[accent]
  return (
    <div className={cn(
      'relative rounded-2xl border bg-zinc-900/60 backdrop-blur-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-xl',
      style.border, style.glow
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        {icon && <div className={style.text}>{icon}</div>}
      </div>
      <p className={cn('text-2xl font-extrabold bg-gradient-to-br bg-clip-text text-transparent', style.gradient)}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-500 mt-1 font-medium">{sub}</p>}
    </div>
  )
}
