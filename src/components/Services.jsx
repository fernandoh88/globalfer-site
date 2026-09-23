import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { services } from '../data/services.js'
import styles from '../styles/Services.module.css'

function Services() {
  return (
    <section className={styles.section} id="servicos" aria-labelledby="servicos-title">
      <div className="container">
        <div className={styles.sectionHeader}>
          <div>
            <p className={`eyebrow ${styles.eyebrow}`}>Serviços Globalfer</p>
            <h2 className="section-title" id="servicos-title">
              Da medida certa à ferragem pronta.
            </h2>
          </div>
          <div className={styles.introduction}>
            <p className="section-copy">
              Corte, dobra e montagem para cada etapa da sua obra. Conte com a Globalfer para preparar a ferragem de acordo com o seu projeto.
            </p>
            <a className={styles.contactLink} href="#contato">
              Solicitar orçamento
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className={styles.grid}>
          {services.map((service, index) => {
            const Icon = service.icon
            const Card = service.href ? 'a' : 'article'
            const titleId = `servico-${index + 1}-title`
            return (
              <Card
                className={`${styles.card} ${service.href ? styles.contactCard : ''}`}
                key={service.title}
                href={service.href}
                aria-labelledby={service.href ? `${titleId} ${titleId}-action` : titleId}
              >
                <div className={styles.cardTop}>
                  <div className={styles.iconBox}>
                    <Icon size={26} strokeWidth={1.65} aria-hidden="true" />
                  </div>
                  <span className={styles.number} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 id={titleId}>{service.title}</h3>
                <p>{service.description}</p>
                {service.href && (
                  <span className={styles.cardAction} id={`${titleId}-action`}>
                    Falar com a equipe
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </span>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Services
