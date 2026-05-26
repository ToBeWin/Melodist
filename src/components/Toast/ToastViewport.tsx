import { X } from 'lucide-react'

import { useI18n } from '../../lib/i18n'
import { useToastStore } from '../../stores/toastStore'

export function ToastViewport() {
  const { t } = useI18n()
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <section className={`toast-message ${toast.tone}`} key={toast.id}>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
            {toast.details && toast.details.length > 0 ? (
              <details className="toast-details">
                <summary>{t('common.details')}</summary>
                <ul>
                  {toast.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
          <button aria-label={t('common.dismissNotification')} type="button" onClick={() => dismissToast(toast.id)}>
            <X size={14} />
          </button>
        </section>
      ))}
    </div>
  )
}
