import { Building2, ShieldCheck } from 'lucide-react'
import styles from '../styles/About.module.css'

const companyImage = `${import.meta.env.BASE_URL}assets/globalfer-capa.jpg`

function About() {
  return (
    <section className={styles.section} id="sobre" aria-labelledby="sobre-title">
      <div className={`container ${styles.container}`}>
        <figure className={styles.imageBlock}>
          <img
            src={companyImage}
            alt="Fachada da Globalfer com a identificação de ferragens armadas sob medida"
            width="640"
            height="480"
            loading="lazy"
            decoding="async"
          />
          <figcaption className={styles.badge}>
            <ShieldCheck size={24} strokeWidth={1.7} aria-hidden="true" />
            <span>Compromisso com a obra</span>
          </figcaption>
        </figure>

        <div className={styles.content}>
          <p className="eyebrow">Sobre a Globalfer</p>
          <h2 className="section-title" id="sobre-title">
            Uma fornecedora preparada para simplificar o trabalho no canteiro
          </h2>
          <p className="section-copy">
            A Globalfer atua no fornecimento de ferragem armada para construção civil, oferecendo soluções práticas e sob medida para obras de diferentes portes.
          </p>
          <p className="section-copy">
            Nosso objetivo é facilitar o trabalho no canteiro, entregando peças preparadas com qualidade, organização e compromisso.
          </p>
          <div className={styles.values}>
            <div className={styles.value}>
              <Building2 size={23} strokeWidth={1.7} aria-hidden="true" />
              <div>
                <h3>Obras de diferentes portes</h3>
                <p>Atendimento para clientes residenciais, engenheiros, pedreiros e construtoras.</p>
              </div>
            </div>
            <div className={styles.value}>
              <ShieldCheck size={23} strokeWidth={1.7} aria-hidden="true" />
              <div>
                <h3>Processo organizado</h3>
                <p>Pedidos tratados com clareza para apoiar o planejamento da construção.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default About
