import { FacebookIcon, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { businessAddress, phoneNumbers, publicEmail } from '../data/contact.js'
import styles from '../styles/Footer.module.css'

const links = [
  { label: 'Início', href: '#inicio' },
  { label: 'Produtos', href: '#produtos' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Contato', href: '#contato' },
]

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <a href="#inicio" className={styles.logo}>
            <span className={styles.logoMark} aria-hidden="true">G</span>
            <span>Globalfer</span>
          </a>
          <p>Ferragem armada para construção civil</p>
        </div>

        <div>
          <h3>Navegue</h3>
          <nav className={styles.links} aria-label="Navegação do rodapé">
            {links.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div>
          <h3>Contato</h3>
          <address>
            <ul className={styles.contactList}>
              <li>
                <Phone size={17} aria-hidden="true" />
                <a href="#contato" aria-label={`Ver opções de contato para ${phoneNumbers.mobile.display}`} title="Ver opções de contato">{phoneNumbers.mobile.display}</a>
              </li>
              <li>
                <Phone size={17} aria-hidden="true" />
                <a href="#contato" aria-label={`Ver opções de contato para ${phoneNumbers.landline.display}`} title="Ver opções de contato">{phoneNumbers.landline.display}</a>
              </li>
              <li>
                <Mail size={17} aria-hidden="true" />
                <a href="#contato" aria-label={`Ver opções de contato para ${publicEmail}`} title="Ver opções de contato">{publicEmail}</a>
              </li>
              <li className={styles.address}>
                <MapPin size={17} aria-hidden="true" />
                <span>{businessAddress.street}<br />{businessAddress.locality}</span>
              </li>
            </ul>
          </address>
        </div>

        <div>
          <h3>Atendimento</h3>
          <div className={styles.socials}>
            <a className={styles.whatsapp} href="#contato" aria-label="WhatsApp: ver opções de contato" title="Ver opções de contato">
              <MessageCircle size={19} aria-hidden="true" />
              WhatsApp
            </a>
            <a href="https://www.facebook.com/ferragistaglobalfer/?locale=pt_BR">
              <FacebookIcon size={19} aria-hidden="true" />
              Facebook
            </a>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span>© {new Date().getFullYear()} Globalfer. Todos os direitos reservados.</span>
          <a href="#inicio">Voltar ao início <span aria-hidden="true">↑</span></a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
