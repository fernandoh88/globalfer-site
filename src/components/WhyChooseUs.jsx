import { CheckCircle2, MessageCircle, ShieldCheck, Timer, TrendingDown, Users } from 'lucide-react'
import styles from '../styles/WhyChooseUs.module.css'

const values = [
  { title: 'Medidas sob encomenda', icon: CheckCircle2 },
  { title: 'Agilidade no atendimento', icon: Timer },
  { title: 'Qualidade na montagem', icon: ShieldCheck },
  { title: 'Redução de desperdício na obra', icon: TrendingDown },
  { title: 'Praticidade para pedreiros, engenheiros e construtoras', icon: Users },
  { title: 'Atendimento direto e fácil pelo WhatsApp', icon: MessageCircle, href: '#contato' },
]

function WhyChooseUs() {
  return (
    <section className={styles.section} aria-labelledby="diferenciais-title">
      <div className={`container ${styles.container}`}>
        <div className={styles.content}>
          <p className={`eyebrow ${styles.eyebrow}`}>Por que escolher a Globalfer</p>
          <h2 className="section-title" id="diferenciais-title">
            Ferragem organizada, atendimento claro e mais praticidade para sua obra
          </h2>
          <p className={`section-copy ${styles.description}`}>
            Trabalhamos para entregar peças preparadas com atenção às medidas, qualidade na montagem e compromisso com a rotina de quem constrói.
          </p>
        </div>

        <ul className={styles.list} role="list">
          {values.map((value) => {
            const Icon = value.icon
            return (
              <li className={styles.item} key={value.title}>
                <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
                {value.href ? (
                  <a className={styles.itemLink} href={value.href}>{value.title}</a>
                ) : (
                  <span>{value.title}</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default WhyChooseUs
