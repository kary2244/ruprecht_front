import { useEffect, useState } from 'react'
import axios from 'axios'
import ProductCard from '../components/productCard'
import { formatProductPrice } from '../utils/currency'
import { API_BASE_URL } from '../utils/api'
import '../styles/products.css'

const Wax = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Obtener productos wax cream desde el endpoint correcto
        const response = await axios.get(`${API_BASE_URL}/wax-cream`, {
          params: { limit: 100 }
        })
        const waxData = response.data.data || response.data
        const transformedProducts = waxData.map((wax) => ({
          id: wax.id,
          name: wax.nombre,
          description: `Cera aromática ${wax.medidas || ''}`,
          price: wax.costo,
          category: 'Wax Cream y Melts',
          imageUrl: wax.image_url || wax.imageUrl || wax.imagen || 'https://images.unsplash.com/photo-1602874801007-c9aa89ed2b09?w=400',
          isFeatured: Boolean(wax.isFeatured ?? wax.is_featured),
          ...wax
        }))
        setProducts(transformedProducts)
      } catch (error) {
        console.error('Error al cargar productos wax cream:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const filteredProducts = products.filter(product => {
    if (filter === 'all') return true
    if (filter === 'featured') return product.isFeatured
    return true
  })

  return (
    <div className="products-page">
      <div className="products-header">
        <h1 className="products-title">WAX CREAM Y MELTS</h1>
        <p className="products-subtitle">
          Ceras aromáticas, difusores y accesorios para aromatizar tu hogar
        </p>
      </div>

      <div className="products-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
        <button 
          className={`filter-btn ${filter === 'featured' ? 'active' : ''}`}
          onClick={() => setFilter('featured')}
        >
          Destacados
        </button>
      </div>

      {loading ? (
        <div className="loading">Cargando productos...</div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onClick={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      )}

      {!loading && filteredProducts.length === 0 && (
        <div className="no-products">No se encontraron productos</div>
      )}

      {/* Modal de detalles */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedProduct(null)}>×</button>
            <div className="modal-body">
              <img 
                src={selectedProduct.imageUrl || 'https://via.placeholder.com/400'} 
                alt={selectedProduct.name}
                className="modal-image"
              />
              <div className="modal-info">
                <h2>{selectedProduct.name}</h2>
                <p className="modal-category">{selectedProduct.category}</p>
                <p className="modal-price">{formatProductPrice(selectedProduct.price, selectedProduct.name)}</p>
                {selectedProduct.size && <p><strong>Tamaño:</strong> {selectedProduct.size}</p>}
                {selectedProduct.weight && <p><strong>Peso:</strong> {selectedProduct.weight}</p>}
                {selectedProduct.description && <p className="modal-description">{selectedProduct.description}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información de uso */}
      <section className="product-info-section">
        <div className="info-grid">
          <div className="info-card">
            <i className="pi pi-fire"></i>
            <h3>Fácil de Usar</h3>
            <p>Simplemente derrite en un quemador de cera</p>
          </div>
          <div className="info-card">
            <i className="pi pi-replay"></i>
            <h3>Reutilizable</h3>
            <p>Puedes mezclar diferentes aromas</p>
          </div>
          <div className="info-card">
            <i className="pi pi-home"></i>
            <h3>Sin Llama</h3>
            <p>Perfecto para espacios cerrados</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Wax
