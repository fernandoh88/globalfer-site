import { Check, Copy, Menu, MessageCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import styles from '../styles/Header.module.css'

const navLinks = [
  { label: 'Início', href: '#inicio' },
  { label: 'Produtos', href: '#produtos' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Contato', href: '#contato' },
]

const phoneContact = {
  display: '(14) 99709-4240',
  copyValue: '+55 14 99709-4240',
}

async function copyPhoneNumber(container) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(phoneContact.copyValue)
      return
    } catch {
      // Some browsers deny clipboard access but still allow a selected-text copy.
    }
  }

  const previousFocus = document.activeElement
  const field = document.createElement('textarea')
  field.value = phoneContact.copyValue
  field.readOnly = true
  field.tabIndex = -1
  field.setAttribute('aria-label', 'Número de telefone para copiar')
  field.style.cssText = 'position: fixed; left: -9999px; top: 0; font-size: 16px;'
  // Keep temporary focus inside the header so the mobile menu stays open.
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

function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('idle')
  const copyTimeout = useRef(null)
  const menuButton = useRef(null)
  const header = useRef(null)

  const closeMenu = () => setIsOpen(false)

  const handleCopy = async () => {
    try {
      await copyPhoneNumber(header.current)
      setCopyStatus('success')
    } catch {
      setCopyStatus('error')
    }
    window.clearTimeout(copyTimeout.current)
    copyTimeout.current = window.setTimeout(() => setCopyStatus('idle'), 2000)
  }

  useEffect(() => () => window.clearTimeout(copyTimeout.current), [])

  useEffect(() => {
    if (isOpen) {
      header.current?.querySelector('nav a')?.focus()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        closeMenu()
        menuButton.current?.focus()
      }
    }
    const onPointerDown = (event) => {
      if (!header.current?.contains(event.target)) closeMenu()
    }
    const desktop = window.matchMedia('(min-width: 1001px)')
    const onResize = () => {
      if (desktop.matches) closeMenu()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    desktop.addEventListener('change', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      desktop.removeEventListener('change', onResize)
    }
  }, [isOpen])

  return (
    <header
      className={styles.header}
      ref={header}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeMenu()
      }}
    >
      <div className={styles.container}>
        <a className={styles.logo} href="#inicio" onClick={closeMenu}>
          <span className={styles.logoMark} aria-hidden="true">G</span>
          <span className={styles.logoText}>
            <strong>Globalfer</strong>
            <small>Ferragem armada</small>
          </span>
        </a>

        <nav
          id="navegacao-principal"
          aria-label="Navegação principal"
          className={`${styles.nav} ${isOpen ? styles.navOpen : ''}`}
        >
          <div className={styles.navLinks}>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
            <a className={styles.mobileCta} href="#contato" onClick={closeMenu}>
              Solicitar orçamento
            </a>
          </div>

          <div className={styles.contactActions}>
            <button
              className={styles.phoneCopy}
              type="button"
              onClick={handleCopy}
              aria-label={`Copiar número de telefone da Globalfer: ${phoneContact.display}`}
              title="Copiar telefone"
            >
              <span className={styles.phoneLabel} aria-hidden="true">
                <span className={copyStatus === 'idle' ? undefined : styles.hiddenLabel}>
                  {phoneContact.display}
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
              {copyStatus === 'success' && 'Número copiado.'}
              {copyStatus === 'error' && 'Não foi possível copiar. Tente novamente ou copie o número manualmente.'}
            </span>
            <a className={styles.headerCta} href="#contato" onClick={closeMenu}>
              <MessageCircle size={18} aria-hidden="true" />
              Fale conosco
            </a>
          </div>
        </nav>

        <button
          className={styles.menuButton}
          type="button"
          ref={menuButton}
          onClick={() => setIsOpen((current) => !current)}
          aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={isOpen}
          aria-controls="navegacao-principal"
        >
          {isOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>
    </header>
  )
}

export default Header
