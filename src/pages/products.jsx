import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import ProductCard from '../components/productCard'
import { formatProductPrice } from '../utils/currency'
import { API_BASE_URL } from '../utils/api'
import '../styles/products.css'

const Products = () => {
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [searchParams] = useSearchParams()
  const searchTerm = searchParams.get('search') || ''

  // Función para normalizar texto (eliminar acentos y convertir a minúsculas)
  const normalizeText = (text) => {
    if (!text) return ''
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  // Función para calcular similitud entre dos textos
  const calculateSimilarity = (text1, text2) => {
    const normalized1 = normalizeText(text1)
    const normalized2 = normalizeText(text2)

    // Si es una coincidencia exacta después de normalizar
    if (normalized1 === normalized2) return 1.0

    // Si uno contiene al otro
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.95
    }

    // Calcular similitud por palabras
    const words1 = normalized1.split(/\s+/)
    const words2 = normalized2.split(/\s+/)

    let matchCount = 0
    for (const word2 of words2) {
      for (const word1 of words1) {
        if (word1.includes(word2) || word2.includes(word1)) {
          matchCount++
          break
        }
      }
    }

    return matchCount / Math.max(words1.length, words2.length)
  }

  useEffect(() => {
     console.log('API_BASE_URL (producción):', API_BASE_URL)
    const fetchProducts = async () => {
      try {
        const fetchAllItems = async (url) => {
          const limit = 100
          let page = 1
          let hasNextPage = true
          const allItems = []

          while (hasNextPage) {
            const response = await axios.get(url, { params: { page, limit } })
            const payload = response.data

            if (Array.isArray(payload)) {
              allItems.push(...payload)
              break
            }

            const data = payload.data || payload
            if (Array.isArray(data)) {
              allItems.push(...data)
            }

            const meta = payload.meta
            if (!meta) {
              break
            }

            const currentPage = meta.currentPage || meta.current_page || page
            const lastPage = meta.lastPage || meta.last_page || currentPage

            hasNextPage = currentPage < lastPage
            page += 1
          }

          return allItems
        }

        // Obtener velas, jabones, esencias, accesorios y extras en paralelo
        const [candlesData, waxCreamData, soapsData, essencesData, accessoriesData, extrasData] = await Promise.all([
          fetchAllItems(`${API_BASE_URL}/candles`),
          fetchAllItems(`${API_BASE_URL}/wax-cream`),
          fetchAllItems(`${API_BASE_URL}/soaps`),
          fetchAllItems(`${API_BASE_URL}/essences`),
          fetchAllItems(`${API_BASE_URL}/accessories`),
          fetchAllItems(`${API_BASE_URL}/extras`),
        ])

        // Función para obtener categoría según type_candle
        const getCategoryByType = (typeCandle) => {
          switch(parseInt(typeCandle)) {
            case 1: return 'Eventos'
            case 3: return 'Velas'
            case 4: return 'Wax Cream y Melts'
            case 5: return 'Flores'
            default: return 'Velas'
          }
        }

        // Transformar velas
        const transformedCandles = candlesData.map((candle) => ({
          ...candle,
          id: `candle-${candle.id}`,
          name: candle.nombre,
          description: `Producto artesanal ${candle.medidas || ''}`,
          price: candle.costo,
          category: getCategoryByType(candle.typeCandle || candle.type_candle),
          size: candle.medidas,
          weight: candle.peso,
          imageUrl: candle.image_url || candle.imageUrl || candle.imagen || 'https://images.unsplash.com/photo-1602874801007-c9aa89ed2b09?w=400',
          isFeatured: Boolean(candle.isFeatured ?? candle.is_featured),
          type: 'candle',
        }))

        const transformedWaxCream = waxCreamData.map((wax) => ({
          id: `wax-${wax.id}`,
          name: wax.nombre,
          description: `Producto wax ${wax.medidas || ''}`,
          price: wax.costo,
          category: 'Wax Cream y Melts',
          size: wax.medidas,
          weight: wax.peso,
          imageUrl: wax.image_url || wax.imageUrl || wax.imagen || 'https://images.unsplash.com/photo-1602874801007-c9aa89ed2b09?w=400',
          type: 'wax',
          ...wax,
        }))

        // Transformar jabones
        const transformedSoaps = soapsData.map((soap) => ({
          ...soap,
          id: `soap-${soap.id}`,
          name: soap.nombre,
          description: 'Jabón artesanal natural',
          price: soap.costo,
          category: 'Jabones',
          imageUrl: soap.image_url || soap.imageUrl || soap.imagen || 'https://images.unsplash.com/photo-1608181078976-e7cb6d3a940a?w=400',
          isFeatured: Boolean(soap.isFeatured ?? soap.is_featured),
          type: 'soap',
        }))

        // Transformar esencias
        const transformedEssences = essencesData.map((essence) => ({
          ...essence,
          id: `essence-${essence.id}`,
          name: `Esencia ${essence.sizeMl || essence.size_ml}ml`,
          description: essence.note || 'Esencia aromática artesanal',
          price: `$${essence.price}`,
          category: 'Esencias',
          size: `${essence.sizeMl || essence.size_ml} ml`,
          weight: `${essence.weightG || essence.weight_g} g / ${essence.weightOz || essence.weight_oz} oz`,
          scents: (essence.aromas || '')
            .split(/[\,\n]+/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
            .filter((item, idx, arr) => arr.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === idx),
          imageUrl: essence.image_url || essence.imageUrl || essence.imagen || 'https://images.unsplash.com/photo-1615634262417-f5dd37a3f5f7?w=400',
          isFeatured: Boolean(essence.isFeatured ?? essence.is_featured),
          type: 'essence',
        }))

        // Transformar accesorios
        const transformedAccessories = accessoriesData.map((accessory) => ({
          ...accessory,
          id: `accessory-${accessory.id}`,
          name: accessory.nombre,
          description: 'Accesorio artesanal',
          price: accessory.costo,
          category: 'Accesorios',
          size: accessory.medidas,
          searchText: `${accessory.nombre || ''} ${accessory.medidas || ''}`,
          imageUrl: accessory.image_url || accessory.imageUrl || accessory.imagen || 'https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?w=400',
          type: 'accessory',
          isFeatured: Boolean(accessory.isFeatured ?? accessory.is_featured),
        }))

        // Transformar extras
        const transformedExtras = extrasData.map((extra) => ({
          ...extra,
          id: `extra-${extra.id}`,
          name: extra.nombre,
          description: 'Complemento para personalizar tu pedido',
          price: extra.costo,
          category: 'Extras',
          searchText: `${extra.nombre || ''}`,
          imageUrl: extra.image_url || extra.imageUrl || extra.imagen || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400',
          type: 'extra',
          isFeatured: Boolean(extra.isFeatured ?? extra.is_featured),
        }))

        // Combinar productos
        const combinedProducts = [
          ...transformedCandles,
          ...transformedWaxCream,
          ...transformedSoaps,
          ...transformedEssences,
          ...transformedAccessories,
          ...transformedExtras,
        ]

        setAllProducts(combinedProducts)

      } catch (error) {
        console.error('Error al cargar productos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  // Efecto separado para filtrar productos
  useEffect(() => {
    let filtered = [...allProducts]

    // Filtrar por búsqueda primero
    if (searchTerm) {
      const normalizedSearch = normalizeText(searchTerm)
      const normalizedWords = normalizedSearch.split(/\s+/).filter((word) => word.length > 0)
      
      // Detectar si hay múltiples términos separados por " y "
      const searchTerms = normalizedSearch.split(' y ').map(term => term.trim()).filter(term => term.length > 0)
      const isAccessoryIntent = searchTerms.some((term) => /accesorio|accesorios|base|yeso/.test(term))
      const isExtrasIntent = searchTerms.some((term) => /extra|extras|caja|cajas|organza|mariposa|pampa|follaje/.test(term))
      
      filtered = filtered
        .map(product => {
          const normalizedName = normalizeText(product.name)
          const normalizedCategory = normalizeText(product.category)
          const normalizedExtra = normalizeText(product.searchText || product.description || '')
          const combinedText = `${normalizedName} ${normalizedExtra} ${normalizedCategory}`
          let priority = -1
          
          // Si hay múltiples términos, buscar si el nombre o categoría incluye CUALQUIERA de ellos
          if (searchTerms.length > 1) {
            for (let i = 0; i < searchTerms.length; i++) {
              const term = searchTerms[i]
              
              // Buscar en nombre
              if (normalizedName.includes(term) || normalizedExtra.includes(term)) {
                priority = i
                break
              }
              
              // Buscar en categoría (incluyendo Eventos cuando buscan "velas")
              if (term === 'velas' && (normalizedCategory === 'velas' || normalizedCategory === 'eventos')) {
                priority = i
                break
              }
              if (normalizedCategory.includes(term)) {
                priority = i
                break
              }
            }
            
            return { ...product, priority }
          }
          
          // Si es un solo término, buscar en nombre y categoría
          const wordByWordMatch = normalizedWords.length > 1
            ? normalizedWords.every((word) => combinedText.includes(word))
            : false

          const matches = normalizedName.includes(normalizedSearch) ||
            normalizedExtra.includes(normalizedSearch) ||
            wordByWordMatch ||
            (normalizedSearch === 'velas' && (normalizedCategory === 'velas' || normalizedCategory === 'eventos')) ||
            (normalizedSearch === 'extras' && normalizedCategory === 'extras') ||
            normalizedCategory.includes(normalizedSearch)
          
          return { ...product, priority: matches ? 0 : -1 }
        })
        .filter(product => product.priority !== -1)
        .sort((a, b) => a.priority - b.priority)

      if (isAccessoryIntent && !isExtrasIntent) {
        filtered = filtered.filter((product) => product.category === 'Accesorios')
      }

      if (isExtrasIntent && !isAccessoryIntent) {
        filtered = filtered.filter((product) => product.category === 'Extras')
      }
    }

    // Luego filtrar por categoría
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => {
        // Si seleccionan "Velas", incluir también "Eventos"
        if (selectedCategory === 'Velas') {
          return product.category === 'Velas' || product.category === 'Eventos'
        }
        return product.category === selectedCategory
      })
    }

    setProducts(filtered)
  }, [allProducts, selectedCategory, searchTerm])

  return (
    <div className="products-page">
      <div className="products-header">
        <h1 className="products-title">
          {searchTerm ? `Resultados para: "${searchTerm}"` : 'TODOS LOS PRODUCTOS'}
        </h1>
        <p className="products-subtitle">
          {searchTerm 
            ? `${products.length} producto${products.length !== 1 ? 's' : ''} encontrado${products.length !== 1 ? 's' : ''}`
            : 'Descubre nuestra colección completa de productos artesanales'
          }
        </p>
      </div>

      <div className="products-filters">
        <button
          type="button"
          className={`filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          Todos
        </button>
        <button
          type="button"
          className={`filter-btn ${selectedCategory === 'Velas' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Velas')}
        >
          Velas
        </button>
        <button
          type="button"
          className={`filter-btn ${selectedCategory === 'Wax Cream y Melts' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Wax Cream y Melts')}
        >
          Wax Cream y Melts
        </button>
        <button
          type="button"
          className={`filter-btn ${selectedCategory === 'Jabones' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Jabones')}
        >
          Jabones
        </button>
        <button
          type="button"
          className={`filter-btn ${selectedCategory === 'Flores' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Flores')}
        >
          Flores
        </button>
        <button
          type="button"
          className={`filter-btn ${selectedCategory === 'Esencias' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Esencias')}
        >
          Esencias
        </button>
        <button
          type="button"
          className={`filter-btn ${selectedCategory === 'Accesorios' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Accesorios')}
        >
          Accesorios
        </button>
        <button
          type="button"
          className={`filter-btn ${selectedCategory === 'Extras' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Extras')}
        >
          Extras
        </button>
      </div>

      {loading ? (
        <div className="loading">Cargando productos...</div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product.category === 'Esencias' ? { ...product, scents: [], size: undefined } : product}
              onClick={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="no-products">
          {searchTerm 
            ? `No se encontraron productos que coincidan con "${searchTerm}"`
            : 'No se encontraron productos'
          }
        </div>
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
                {selectedProduct.category === 'Accesorios' && selectedProduct.size && (
                  <p><strong>Medidas:</strong> {selectedProduct.size}</p>
                )}
                {selectedProduct.category !== 'Esencias' && selectedProduct.category !== 'Accesorios' && selectedProduct.size && (
                  <p><strong>Tamaño:</strong> {selectedProduct.size}</p>
                )}
                {selectedProduct.weight && <p><strong>Peso:</strong> {selectedProduct.weight}</p>}
                {selectedProduct.category === 'Esencias' && selectedProduct.scents?.length > 0 ? (
                  <div>
                    <h4 className="essence-fragrance-title">Fragancias</h4>
                    <div className="essence-fragrance-grid">
                      {selectedProduct.scents.map((aroma) => (
                        <div key={`${selectedProduct.id}-${aroma}`} className="essence-fragrance-item">
                          {aroma}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  selectedProduct.scents?.length > 0 && (
                    <p><strong>Aromas:</strong> {selectedProduct.scents.join(', ')}</p>
                  )
                )}
                {selectedProduct.description && <p className="modal-description">{selectedProduct.description}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Products
