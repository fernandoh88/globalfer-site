import { ArrowUpRight, Mail, MapPin, Phone, Smartphone } from 'lucide-react'
import { businessAddress, phoneNumbers, publicEmail } from '../data/contact.js'
import styles from '../styles/ContactDetails.module.css'
import PhoneCopyButton from './PhoneCopyButton.jsx'

const phones = [
  { phone: phoneNumbers.mobile, label: 'Celular / WhatsApp', Icon: Smartphone },
  { phone: phoneNumbers.landline, label: 'Telefone fixo', Icon: Phone },
]

function ContactDetails() {
  const [emailName, emailDomain] = publicEmail.split('@')

  return (
    <div className={styles.container}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Fale com a Globalfer</p>
          <h2 className={styles.title} id="contact-heading">Atendimento próximo, do início à obra.</h2>
        </div>
        <p className={styles.intro}>
          Tire suas dúvidas, converse sobre as medidas ou solicite seu orçamento à nossa equipe.
        </p>
      </div>

      <ul className={styles.grid} aria-label="Informações de contato da Globalfer">
        {phones.map(({ phone, label, Icon }) => (
          <li className={styles.card} key={phone.telValue}>
            <div className={styles.cardHeading}>
              <Icon size={20} aria-hidden="true" />
              <h3>{label}</h3>
            </div>
            <div className={styles.value}>
              <PhoneCopyButton phone={phone} />
            </div>
            <p className={styles.hint}>Toque no número para copiar.</p>
            <a className={styles.action} href={`tel:${phone.telValue}`} aria-label={`Ligar para ${phone.display}`}>
              Ligar <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </li>
        ))}
        <li className={styles.card}>
          <div className={styles.cardHeading}>
            <Mail size={20} aria-hidden="true" />
            <h3>E-mail</h3>
          </div>
          <a className={`${styles.value} ${styles.email}`} href={`mailto:${publicEmail}`}>
            <span>{emailName}@<wbr />{emailDomain}</span>
          </a>
          <p className={styles.hint}>Envie sua mensagem por e-mail.</p>
        </li>
        <li className={styles.card}>
          <div className={styles.cardHeading}>
            <MapPin size={20} aria-hidden="true" />
            <h3>Endereço</h3>
          </div>
          <address className={`${styles.value} ${styles.address}`}>
            <span>{businessAddress.street}</span>
            <span>{businessAddress.locality}</span>
          </address>
        </li>
      </ul>
    </div>
  )
}

export default ContactDetails
