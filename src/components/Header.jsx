import { Menu, MessageCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import styles from '../styles/Header.module.css'

const navLinks = [
  { label: 'Início', href: '#inicio' },
  { label: 'Produtos', href: '#produtos' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Contato', href: '#contato' },
]

function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const menuButton = useRef(null)
  const header = useRef(null)

  const closeMenu = () => setIsOpen(false)

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
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
          <a className={styles.mobileCta} href="#contato" onClick={closeMenu}>
            Solicitar orçamento
          </a>
        </nav>

        <a className={styles.headerCta} href="https://wa.me/5514997094240">
          <MessageCircle size={18} aria-hidden="true" />
          WhatsApp
        </a>

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
