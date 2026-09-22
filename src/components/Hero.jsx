import { ArrowRight, Check, Ruler } from 'lucide-react'
import styles from '../styles/Hero.module.css'

const companyImage = `${import.meta.env.BASE_URL}assets/globalfer-capa.jpg`

function Hero() {
  return (
    <section className={styles.hero} id="inicio">
      <div className={styles.container}>
        <div className={styles.content}>
          <p className={styles.eyebrow}>Ferragem armada para construção civil</p>
          <h1>
            <span>Ferragem Armada</span>{' '}
            <span className={styles.accent}>Sob Medida</span>{' '}
            <span>para sua Obra</span>
          </h1>
          <p className={styles.subtitle}>
            Soluções em aço para fundações, colunas, vigas, lajes e estruturas de concreto.
          </p>
          <div className={styles.actions}>
            <a className={styles.primaryButton} href="#contato">
              Solicitar Orçamento
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className={styles.secondaryButton} href="#produtos">
              Ver Produtos
            </a>
          </div>
          <ul className={styles.trustBar} role="list">
            <li>
              <Check size={16} aria-hidden="true" />
              Medidas sob encomenda
            </li>
            <li>
              <Check size={16} aria-hidden="true" />
              Atendimento direto
            </li>
            <li>
              <Check size={16} aria-hidden="true" />
              Produção organizada
            </li>
          </ul>
        </div>

        <figure className={styles.visual}>
          <div className={styles.companyPhoto}>
            <img
              src={companyImage}
              alt="Fachada da Globalfer com ferragens armadas sob medida"
              width="640"
              height="480"
              fetchpriority="high"
            />
          </div>
          <figcaption className={styles.visualPanel}>
            <Ruler size={28} aria-hidden="true" />
            <div>
              <strong>Aço preparado</strong>
              <small>para obras mais práticas</small>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

export default Hero
