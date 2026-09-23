import { Check, Copy, Phone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import styles from '../styles/PhoneCopyButton.module.css'

async function copyPhoneNumber(value, container, isCurrentAttempt) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Some browsers deny clipboard access but still allow a selected-text copy.
    }
  }

  if (!isCurrentAttempt()) return

  const previousFocus = document.activeElement
  const field = document.createElement('textarea')
  field.value = value
  field.readOnly = true
  field.tabIndex = -1
  field.setAttribute('aria-label', 'Número de telefone para copiar')
  field.style.cssText = 'position: fixed; left: -9999px; top: 0; font-size: 16px;'
  // Keep temporary focus inside this control so the header menu stays open.
  container.appendChild(field)
  try {
    field.focus({ preventScroll: true })
    field.select()
    if (!document.execCommand('copy')) throw new Error('Copy failed')
  } finally {
    previousFocus?.focus({ preventScroll: true })
    field.remove()
  }
}

function PhoneCopyButton({ phone, variant = 'header' }) {
  const [copyStatus, setCopyStatus] = useState('idle')
  const wrapper = useRef(null)
  const copyTimeout = useRef(null)
  const copyAttempt = useRef(0)

  useEffect(() => () => {
    copyAttempt.current += 1
    window.clearTimeout(copyTimeout.current)
  }, [])

  const handleCopy = async () => {
    const attempt = ++copyAttempt.current
    const container = wrapper.current
    const isCurrentAttempt = () => copyAttempt.current === attempt && container?.isConnected
    window.clearTimeout(copyTimeout.current)
    setCopyStatus('idle')

    let status = 'success'
    try {
      await copyPhoneNumber(phone.copyValue, container, isCurrentAttempt)
    } catch {
      status = 'error'
    }

    // A slower clipboard response must not overwrite a later click or an unmount.
    if (!isCurrentAttempt()) return
    setCopyStatus(status)
    copyTimeout.current = window.setTimeout(() => setCopyStatus('idle'), 2000)
  }

  return (
    <span className={styles.wrapper} ref={wrapper}>
      <button
        className={`${styles.phoneCopy} ${variant === 'contact' ? styles.contact : ''}`}
        type="button"
        onClick={handleCopy}
        aria-label={`Copiar número de telefone da Globalfer: ${phone.display}`}
        title="Copiar telefone"
      >
        {variant === 'contact' && <Phone size={20} aria-hidden="true" />}
        <span className={styles.phoneLabel} aria-hidden="true">
          <span className={copyStatus === 'idle' ? undefined : styles.hiddenLabel}>
            {phone.display}
          </span>
          <span className={copyStatus === 'success' ? undefined : styles.hiddenLabel}>
            Copiado!
          </span>
          <span className={copyStatus === 'error' ? undefined : styles.hiddenLabel}>
            Tente novamente
          </span>
        </span>
        {copyStatus === 'success'
          ? <Check size={16} aria-hidden="true" />
          : <Copy size={16} aria-hidden="true" />}
      </button>
      <span className={styles.copyAnnouncement} role="status" aria-live="polite" aria-atomic="true">
        {copyStatus === 'success' && `Número ${phone.display} copiado.`}
        {copyStatus === 'error' && 'Não foi possível copiar. Tente novamente ou copie o número manualmente.'}
      </span>
    </span>
  )
}

export default PhoneCopyButton
