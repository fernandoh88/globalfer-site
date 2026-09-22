import { ArrowUpRight } from 'lucide-react'
import { products } from '../data/products.js'
import styles from '../styles/Products.module.css'

const getAssetUrl = (path) => `${import.meta.env.BASE_URL}${path}`

const imageDimensions = {
  'assets/products/estribo-nervurado.jpg': [662, 436],
  'assets/products/colunas-pop.jpg': [384, 255],
  'assets/products/colunas-sob-medida.jpg': [640, 480],
  'assets/products/sapatas.jpg': [2048, 1154],
  'assets/products/trelica.jpg': [275, 183],
  'assets/products/vigas.jpg': [251, 201],
  'assets/products/vergalhao-gerdau.jpg': [224, 225],
  'assets/products/arame-recozido.jpg': [480, 640],
  'assets/products/pregos.jpg': [225, 225],
  'assets/products/arame-galvanizado.jpg': [640, 480],
}

function Products() {
  return (
    <section className={styles.section} id="produtos" aria-labelledby="produtos-title">
      <div className="container">
        <div className={styles.sectionHeader}>
          <p className="eyebrow">Produtos</p>
          <h2 className="section-title" id="produtos-title">
            Ferragens prontas para diferentes etapas da construção
          </h2>
          <p className="section-copy">
            Produção sob medida para facilitar a montagem no canteiro, reduzir perdas e manter a obra em movimento.
          </p>
        </div>

        <div className={styles.grid}>
          {products.map((product) => (
            <article className={styles.card} key={product.name}>
              <div className={styles.imageWrap}>
                {product.image ? (
                  <img
                    src={getAssetUrl(product.image)}
                    alt={product.name}
                    width={imageDimensions[product.image]?.[0]}
                    height={imageDimensions[product.image]?.[1]}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className={styles.imagePlaceholder} aria-hidden="true" />
                )}
              </div>
              <div className={styles.cardBody}>
                <h3>{product.name}</h3>
                <p className={styles.description}>{product.description}</p>
                <div className={styles.usage}>
                  <strong>Uso comum</strong>
                  <span>{product.usage}</span>
                </div>
                <a
                  href="#contato"
                  className={styles.cardButton}
                  aria-label={`Solicitar orçamento de ${product.name}`}
                >
                  Solicitar orçamento
                  <ArrowUpRight size={19} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Products
