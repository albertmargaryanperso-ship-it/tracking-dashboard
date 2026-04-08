import { useState } from 'react'
import { X, KeyRound, ExternalLink, Check, Trash2 } from 'lucide-react'
import { getToken, setToken } from '@/lib/github'
import { GITHUB_OWNER, GITHUB_REPO } from '@/lib/config'

interface TokenModalProps {
  open: boolean
  onClose: () => void
  onTokenChange: () => void
}

export const TokenModal = ({ open, onClose, onTokenChange }: TokenModalProps) => {
  const [value, setValue] = useState(getToken() ?? '')
  const [saved, setSaved] = useState(false)

  if (!open) return null

  const hasCurrent = !!getToken()
  const tokenUrl = `https://github.com/settings/personal-access-tokens/new?name=tracking-dashboard&description=Sync%20tracking%20dashboard%20state.json&expiration=365&contents=write`

  const save = () => {
    setToken(value.trim() || null)
    setSaved(true)
    onTokenChange()
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  const clear = () => {
    setValue('')
    setToken(null)
    onTokenChange()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <KeyRound className="text-amber-400" size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Token GitHub</h2>
              <p className="text-[10px] text-zinc-500">Nécessaire pour sauvegarder les modifications</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 text-[11px] text-zinc-400 leading-relaxed">
            <p className="font-semibold text-zinc-200 mb-2">Pourquoi ce token ?</p>
            <p>Le dashboard utilise GitHub comme base de données. Un token est nécessaire pour écrire dans <code className="text-violet-300 text-[10px] font-mono">{GITHUB_OWNER}/{GITHUB_REPO}</code>.</p>
            <p className="mt-2 font-semibold text-zinc-200">Comment l'obtenir ?</p>
            <ol className="mt-1 space-y-0.5 list-decimal list-inside">
              <li>Clique sur <span className="text-amber-400">Générer</span> ci-dessous</li>
              <li>Repository access : <em>Only select repositories</em> → <code className="text-[10px]">{GITHUB_REPO}</code></li>
              <li>Permissions → Repository → <em>Contents: Read and write</em></li>
              <li>Clique <em>Generate token</em>, copie la valeur <code className="text-[10px]">github_pat_...</code></li>
              <li>Colle-la ci-dessous</li>
            </ol>
          </div>

          <a
            href={tokenUrl}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-all"
          >
            <ExternalLink size={12} /> Générer un token GitHub
          </a>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Personal Access Token</label>
            <input
              type="password"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="github_pat_..."
              className="w-full mt-1.5 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
            />
            {hasCurrent && !value && (
              <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
                <Check size={10} /> Un token est déjà configuré
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={!value.trim() && !hasCurrent}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-900 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saved ? '✓ Enregistré' : 'Enregistrer'}
            </button>
            {hasCurrent && (
              <button
                onClick={clear}
                className="px-3 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[11px]"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <p className="text-[10px] text-zinc-600 text-center">
            Le token est stocké dans le <em>localStorage</em> de ce navigateur uniquement. Aucun serveur externe.
          </p>
        </div>
      </div>
    </div>
  )
}
