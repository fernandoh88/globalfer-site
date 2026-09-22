import { services } from '../data/services.js'
import styles from '../styles/Services.module.css'

function Services() {
  return (
    <section className={styles.section} id="servicos" aria-labelledby="servicos-title">
      <div className="container">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Serviços</p>
            <h2 className="section-title" id="servicos-title">
              Atendimento completo para quem precisa de aço preparado
            </h2>
          </div>
          <p className="section-copy">
            Da medida ao pedido final, a Globalfer ajuda a organizar a ferragem para obras residenciais, comerciais e estruturais.
          </p>
        </div>

        <div className={styles.grid}>
          {services.map((service, index) => {
            const Icon = service.icon
            return (
              <article className={styles.card} key={service.title}>
                <div className={styles.cardTop}>
                  <div className={styles.iconBox}>
                    <Icon size={26} strokeWidth={1.65} aria-hidden="true" />
                  </div>
                  <span className={styles.number} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Services
