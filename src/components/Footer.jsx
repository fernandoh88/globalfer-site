import { FacebookIcon, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
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
                <a href="#contato" aria-label="Ver opções de contato para (14) 99709-4240" title="Ver opções de contato">(14) 99709-4240</a>
              </li>
              <li>
                <Phone size={17} aria-hidden="true" />
                <a href="#contato" aria-label="Ver opções de contato para (14) 3415-1049" title="Ver opções de contato">(14) 3415-1049</a>
              </li>
              <li>
                <Mail size={17} aria-hidden="true" />
                <a href="#contato" aria-label="Ver opções de contato para globalfer_marilia@yahoo.com.br" title="Ver opções de contato">globalfer_marilia@yahoo.com.br</a>
              </li>
              <li className={styles.address}>
                <MapPin size={17} aria-hidden="true" />
                <span>Avenida Sampaio Vidal, 45<br />Marília, SP, Brasil</span>
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
