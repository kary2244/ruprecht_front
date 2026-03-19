import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ToggleButton } from 'primereact/togglebutton'
import { Tag } from 'primereact/tag'
import {
  ADMIN_LOGIN_PATH,
  canDeleteCatalog,
  canManageCatalog,
  canManageUsers,
  clearAdminSession,
  getAdminToken,
  getAdminUser,
  isAdminSessionActive,
  saveAdminSession,
} from '../utils/adminAuth'
import { API_BASE_URL } from '../utils/api'
import '../styles/admin.css'

const LIST_PAGE_SIZE = 10
const SIDEBAR_DEFAULT_WIDTH = 300
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 420
const SIDEBAR_COLLAPSED_WIDTH = 96

const MODULE_ORDER = ['candles', 'wax', 'soaps', 'essences', 'accessories', 'extras', 'users']

const CANDLE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2.2c-1.3 1.6-2.3 3.1-2.3 4.8 0 1.4 1 2.6 2.3 2.6s2.3-1.2 2.3-2.6c0-1.7-1-3.2-2.3-4.8z" />
    <rect x="9" y="10" width="6" height="9.5" rx="1.4" />
    <rect x="7.5" y="20" width="9" height="1.8" rx="0.9" />
  </svg>
)

const SOAP_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="4" y="9" width="16" height="9" rx="4" />
    <circle cx="7" cy="7" r="2" />
    <circle cx="11" cy="5" r="1.6" />
    <circle cx="15" cy="7" r="1.2" />
  </svg>
)

const WAX_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2.5c2.2 3.1 4 5.8 4 8.5a4 4 0 1 1-8 0c0-2.7 1.8-5.4 4-8.5z" />
    <circle cx="18" cy="8" r="1.2" />
    <circle cx="6" cy="7" r="1" />
  </svg>
)

const MODULE_ICONS = {
  candles: CANDLE_ICON,
  wax: WAX_ICON,
  soaps: SOAP_ICON,
  essences: 'pi pi-sparkles',
  accessories: 'pi pi-gift',
  extras: 'pi pi-box',
  users: 'pi pi-users',
}

const FALLBACK_CANDLE_TYPES = [
  { id: 1, tipo: 'Eventos' },
  { id: 3, tipo: 'Velas' },
  { id: 4, tipo: 'Wax Cream y Melts' },
  { id: 5, tipo: 'Flores' },
]

const CANDLE_TYPE_LABEL = FALLBACK_CANDLE_TYPES.reduce((accumulator, item) => {
  accumulator[item.id] = item.tipo
  return accumulator
}, {})

const ROLE_LABELS = {
  admin: 'Administrador',
  editor: 'Editor',
  reader: 'Solo lectura',
}

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeOptionalString = (value, isUpdate) => {
  const normalized = String(value || '').trim()
  if (normalized) return normalized
  return isUpdate ? null : undefined
}

const normalizeOptionalNumber = (value, isUpdate) => {
  if (value === '' || value === null || value === undefined) {
    return isUpdate ? null : undefined
  }

  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) {
    return isUpdate ? null : undefined
  }

  return numericValue
}

const normalizeOptionalArray = (value, isUpdate) => {
  const parsed = splitCsv(value)
  if (parsed.length > 0) return parsed
  return isUpdate ? null : undefined
}

const normalizeTypeLabel = (tipo, id) => {
  const label = String(tipo || '').trim()
  return label || `Tipo ${id}`
}

const buildCandleTypeOptions = (types) =>
  types
    .filter((item) => Number(item?.id) > 0)
    .filter((item) => {
      const id = Number(item?.id)
      const label = normalizeTypeLabel(item?.tipo, id).toLowerCase()
      if (id === 4) return false
      return !label.includes('wax')
    })
    .map((item) => ({
      value: String(item.id),
      label: normalizeTypeLabel(item.tipo, item.id),
    }))

const buildCandleTypeLabelMap = (types) =>
  types.reduce((accumulator, item) => {
    const id = Number(item?.id)
    if (!Number.isFinite(id) || id <= 0) return accumulator
    accumulator[id] = normalizeTypeLabel(item.tipo, id)
    return accumulator
  }, {})

const normalizePaginatedResponse = (payload, fallbackPage = 1) => {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      meta: {
        currentPage: 1,
        lastPage: 1,
        perPage: payload.length || LIST_PAGE_SIZE,
        total: payload.length,
      },
    }
  }

  const data = Array.isArray(payload?.data) ? payload.data : []
  const meta = payload?.meta || {}

  const currentPage = Number(meta.currentPage || meta.current_page || fallbackPage || 1)
  const perPage = Number(meta.perPage || meta.per_page || LIST_PAGE_SIZE)
  const total = Number(meta.total ?? data.length)
  const computedLastPage = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1
  const lastPage = Number(meta.lastPage || meta.last_page || computedLastPage)

  return {
    data,
    meta: {
      currentPage: Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1,
      lastPage: Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1,
      perPage: Number.isFinite(perPage) && perPage > 0 ? perPage : LIST_PAGE_SIZE,
      total: Number.isFinite(total) && total >= 0 ? total : data.length,
    },
  }
}

const createInitialModulePageState = () =>
  MODULE_ORDER.reduce((accumulator, moduleKey) => {
    accumulator[moduleKey] = 1
    return accumulator
  }, {})

const getErrorMessage = (requestError, fallbackMessage) => {
  const errors = requestError?.response?.data?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    if (typeof errors[0] === 'string') return errors[0]
    if (errors[0]?.message) return errors[0].message
  }

  return requestError?.response?.data?.message || fallbackMessage
}

const getBooleanStatusLabel = (fieldName, checked) => {
  if (fieldName === 'isFeatured') {
    return checked ? 'Destacado' : 'No destacado'
  }

  if (fieldName === 'isActive') {
    return checked ? 'Activo' : 'Inactivo'
  }

  return checked ? 'Sí' : 'No'
}

const MODULE_CONFIG = {
  candles: {
    label: 'Velas',
    endpoint: 'candles',
    entityName: 'vela',
    fields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'costo', label: 'Costo', type: 'text', required: true },
      { name: 'medidas', label: 'Medidas', type: 'text' },
      { name: 'peso', label: 'Peso', type: 'text' },
      {
        name: 'typeCandle',
        label: 'Tipo de vela',
        type: 'select',
        options: [
          { value: '1', label: 'Eventos' },
          { value: '3', label: 'Velas' },
          { value: '4', label: 'Wax Cream y Melts' },
          { value: '5', label: 'Flores' },
        ],
      },
      { name: 'imageUrl', label: 'URL Imagen', type: 'url' },
      { name: 'isFeatured', label: 'Destacado', type: 'checkbox' },
    ],
    columns: [
      { label: 'Nombre', key: 'nombre' },
      { label: 'Imagen', key: 'imageUrl' },
      { label: 'Costo', key: 'costo' },
      { label: 'Tipo', render: (row) => CANDLE_TYPE_LABEL[row.typeCandle] || row.typeCandle || '—' },
      { label: 'Destacado', render: (row) => (row.isFeatured ? 'Sí' : 'No') },
    ],
    getInitialFormData: () => ({
      nombre: '',
      costo: '',
      medidas: '',
      peso: '',
      typeCandle: '3',
      imageUrl: '',
      isFeatured: false,
    }),
    parseRecord: (record) => ({
      nombre: record.nombre || '',
      costo: record.costo || '',
      medidas: record.medidas || '',
      peso: record.peso || '',
      typeCandle: record.typeCandle ? String(record.typeCandle) : '3',
      imageUrl: record.imageUrl || record.image_url || '',
      isFeatured: Boolean(record.isFeatured ?? record.is_featured),
    }),
    serialize: (formData, isUpdate) => ({
      nombre: String(formData.nombre || '').trim(),
      costo: String(formData.costo || '').trim(),
      medidas: normalizeOptionalString(formData.medidas, isUpdate),
      peso: normalizeOptionalString(formData.peso, isUpdate),
      typeCandle: normalizeOptionalNumber(formData.typeCandle, isUpdate),
      imageUrl: normalizeOptionalString(formData.imageUrl, isUpdate),
      isFeatured: Boolean(formData.isFeatured),
    }),
  },
  wax: {
    label: 'Wax Cream y Melts',
    endpoint: 'wax-cream',
    entityName: 'producto wax',
    fields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'costo', label: 'Costo', type: 'text', required: true },
      { name: 'medidas', label: 'Medidas', type: 'text' },
      { name: 'peso', label: 'Peso', type: 'text' },
      { name: 'imageUrl', label: 'URL Imagen', type: 'url' },
    ],
    columns: [
      { label: 'Nombre', key: 'nombre' },
      { label: 'Imagen', key: 'imageUrl' },
      { label: 'Costo', key: 'costo' },
      { label: 'Medidas', key: 'medidas' },
      { label: 'Peso', key: 'peso' },
    ],
    getInitialFormData: () => ({
      nombre: '',
      costo: '',
      medidas: '',
      peso: '',
      imageUrl: '',
    }),
    parseRecord: (record) => ({
      nombre: record.nombre || '',
      costo: record.costo || '',
      medidas: record.medidas || '',
      peso: record.peso || '',
      imageUrl: record.imageUrl || record.image_url || '',
    }),
    serialize: (formData, isUpdate) => ({
      nombre: String(formData.nombre || '').trim(),
      costo: String(formData.costo || '').trim(),
      medidas: normalizeOptionalString(formData.medidas, isUpdate),
      peso: normalizeOptionalString(formData.peso, isUpdate),
      image_url: normalizeOptionalString(formData.imageUrl, isUpdate),
    }),
  },
  soaps: {
    label: 'Jabones',
    endpoint: 'soaps',
    entityName: 'jabón',
    fields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'costo', label: 'Costo', type: 'text', required: true },
      { name: 'imageUrl', label: 'URL Imagen', type: 'url' },
      { name: 'isFeatured', label: 'Destacado', type: 'checkbox' },
    ],
    columns: [
      { label: 'Nombre', key: 'nombre' },
      { label: 'Imagen', key: 'imageUrl' },
      { label: 'Costo', key: 'costo' },
      { label: 'Destacado', render: (row) => (row.isFeatured ? 'Sí' : 'No') },
    ],
    getInitialFormData: () => ({
      nombre: '',
      costo: '',
      imageUrl: '',
      isFeatured: false,
    }),
    parseRecord: (record) => ({
      nombre: record.nombre || '',
      costo: record.costo || '',
      imageUrl: record.imageUrl || record.image_url || '',
      isFeatured: Boolean(record.isFeatured ?? record.is_featured),
    }),
    serialize: (formData, isUpdate) => ({
      nombre: String(formData.nombre || '').trim(),
      costo: String(formData.costo || '').trim(),
      imageUrl: normalizeOptionalString(formData.imageUrl, isUpdate),
      isFeatured: Boolean(formData.isFeatured),
    }),
  },
  essences: {
    label: 'Esencias',
    endpoint: 'essences',
    entityName: 'esencia',
    fields: [
      { name: 'sizeMl', label: 'Tamaño (ml)', type: 'number', required: true, min: 0 },
      { name: 'weightG', label: 'Peso (g)', type: 'number', required: true, min: 0 },
      { name: 'weightOz', label: 'Peso (oz)', type: 'number', required: true, min: 0, step: 0.1 },
      { name: 'price', label: 'Precio', type: 'number', required: true, min: 0, step: 0.01 },
      { name: 'aromas', label: 'Aromas', type: 'textarea', required: true, rows: 3 },
      { name: 'note', label: 'Nota', type: 'text' },
      { name: 'imageUrl', label: 'URL Imagen', type: 'url' },
      { name: 'isFeatured', label: 'Destacado', type: 'checkbox' },
    ],
    columns: [
      { label: 'ml', key: 'sizeMl' },
      { label: 'Imagen', key: 'imageUrl' },
      { label: 'Precio', key: 'price' },
      { label: 'Aromas', key: 'aromas' },
      { label: 'Destacado', render: (row) => (row.isFeatured ? 'Sí' : 'No') },
    ],
    getInitialFormData: () => ({
      sizeMl: '',
      weightG: '',
      weightOz: '',
      price: '',
      aromas: '',
      note: '',
      imageUrl: '',
      isFeatured: false,
    }),
    parseRecord: (record) => ({
      sizeMl: record.sizeMl ?? '',
      weightG: record.weightG ?? '',
      weightOz: record.weightOz ?? '',
      price: record.price ?? '',
      aromas: record.aromas || '',
      note: record.note || '',
      imageUrl: record.imageUrl || record.image_url || '',
      isFeatured: Boolean(record.isFeatured ?? record.is_featured),
    }),
    serialize: (formData, isUpdate) => ({
      sizeMl: Number(formData.sizeMl),
      weightG: Number(formData.weightG),
      weightOz: Number(formData.weightOz),
      price: Number(formData.price),
      aromas: String(formData.aromas || '').trim(),
      note: normalizeOptionalString(formData.note, isUpdate),
      imageUrl: normalizeOptionalString(formData.imageUrl, isUpdate),
      isFeatured: Boolean(formData.isFeatured),
    }),
  },
  accessories: {
    label: 'Accesorios',
    endpoint: 'accessories',
    entityName: 'accesorio',
    fields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'costo', label: 'Costo', type: 'text', required: true },
      { name: 'medidas', label: 'Medidas', type: 'text' },
      { name: 'imageUrl', label: 'URL Imagen', type: 'url' },
      { name: 'isFeatured', label: 'Destacado', type: 'checkbox' },
    ],
    columns: [
      { label: 'Nombre', key: 'nombre' },
      { label: 'Imagen', key: 'imageUrl' },
      { label: 'Medidas', key: 'medidas' },
      { label: 'Costo', key: 'costo' },
      { label: 'Destacado', render: (row) => (row.isFeatured ? 'Sí' : 'No') },
    ],
    getInitialFormData: () => ({
      nombre: '',
      costo: '',
      medidas: '',
      imageUrl: '',
      isFeatured: false,
    }),
    parseRecord: (record) => ({
      nombre: record.nombre || '',
      costo: record.costo || '',
      medidas: record.medidas || '',
      imageUrl: record.imageUrl || record.image_url || '',
      isFeatured: Boolean(record.isFeatured ?? record.is_featured),
    }),
    serialize: (formData, isUpdate) => ({
      nombre: String(formData.nombre || '').trim(),
      costo: String(formData.costo || '').trim(),
      medidas: normalizeOptionalString(formData.medidas, isUpdate),
      imageUrl: normalizeOptionalString(formData.imageUrl, isUpdate),
      isFeatured: Boolean(formData.isFeatured),
    }),
  },
  extras: {
    label: 'Extras',
    endpoint: 'extras',
    entityName: 'extra',
    fields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'costo', label: 'Costo', type: 'text', required: true },
      { name: 'imageUrl', label: 'URL Imagen', type: 'url' },
      { name: 'isFeatured', label: 'Destacado', type: 'checkbox' },
    ],
    columns: [
      { label: 'Nombre', key: 'nombre' },
      { label: 'Imagen', key: 'imageUrl' },
      { label: 'Costo', key: 'costo' },
      { label: 'Destacado', render: (row) => (row.isFeatured ? 'Sí' : 'No') },
    ],
    getInitialFormData: () => ({
      nombre: '',
      costo: '',
      imageUrl: '',
      isFeatured: false,
    }),
    parseRecord: (record) => ({
      nombre: record.nombre || '',
      costo: record.costo || '',
      imageUrl: record.imageUrl || record.image_url || '',
      isFeatured: Boolean(record.isFeatured ?? record.is_featured),
    }),
    serialize: (formData, isUpdate) => ({
      nombre: String(formData.nombre || '').trim(),
      costo: String(formData.costo || '').trim(),
      imageUrl: normalizeOptionalString(formData.imageUrl, isUpdate),
      isFeatured: Boolean(formData.isFeatured),
    }),
  },
  users: {
    label: 'Usuarios',
    endpoint: 'users',
    entityName: 'usuario',
    fields: [
      { name: 'fullName', label: 'Nombre', type: 'text' },
      { name: 'imageUrl', label: 'Foto', type: 'url' },
      { name: 'email', label: 'Correo', type: 'email', required: true },
      { name: 'contrasena', label: 'Contraseña', type: 'password', required: true, minLength: 8 },
      {
        name: 'rol',
        label: 'Rol',
        type: 'select',
        required: true,
        options: [
          { value: 'admin', label: 'Admin' },
          { value: 'editor', label: 'Editor' },
          { value: 'reader', label: 'Reader' },
        ],
      },
    ],
    columns: [
      { label: 'Nombre', key: 'fullName' },
      { label: 'Foto', key: 'imageUrl' },
      { label: 'Correo', key: 'email' },
      { label: 'Rol', key: 'rol' },
    ],
    getInitialFormData: () => ({
      fullName: '',
      imageUrl: '',
      email: '',
      contrasena: '',
      rol: 'reader',
    }),
    parseRecord: (record) => ({
      fullName: record.fullName || record.full_name || '',
      imageUrl: record.imageUrl || record.image_url || '',
      email: record.email || '',
      contrasena: '',
      rol: record.rol || 'reader',
    }),
    serialize: (formData, isUpdate) => {
      const password = String(formData.contrasena || '').trim()

      return {
        fullName: normalizeOptionalString(formData.fullName, isUpdate),
        imageUrl: normalizeOptionalString(formData.imageUrl, isUpdate),
        email: String(formData.email || '').trim(),
        contrasena: isUpdate ? (password ? password : undefined) : password,
        rol: formData.rol,
      }
    },
  },
  products: {
    label: 'Productos',
    endpoint: 'products',
    entityName: 'producto',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      {
        name: 'description',
        label: 'Descripción',
        type: 'textarea',
        required: true,
        rows: 3,
        minLength: 10,
      },
      { name: 'price', label: 'Precio', type: 'number', required: true, min: 0, step: 0.01 },
      { name: 'stock', label: 'Stock', type: 'number', required: true, min: 0, step: 1 },
      { name: 'category', label: 'Categoría', type: 'text' },
      { name: 'imageUrl', label: 'URL Imagen', type: 'url' },
      { name: 'size', label: 'Tamaño', type: 'text' },
      { name: 'shape', label: 'Forma', type: 'text' },
      { name: 'burnTime', label: 'Tiempo de quemado (h)', type: 'number', min: 0, step: 1 },
      { name: 'colorsText', label: 'Colores (coma)', type: 'text' },
      { name: 'scentsText', label: 'Esencias (coma)', type: 'text' },
      { name: 'ingredientsText', label: 'Ingredientes (coma)', type: 'text' },
      { name: 'isActive', label: 'Activo', type: 'checkbox' },
      { name: 'isFeatured', label: 'Destacado', type: 'checkbox' },
    ],
    columns: [
      { label: 'Nombre', key: 'name' },
      { label: 'Imagen', key: 'imageUrl' },
      { label: 'Categoría', key: 'category' },
      { label: 'Precio', key: 'price' },
      { label: 'Stock', key: 'stock' },
      { label: 'Activo', render: (row) => (row.isActive ? 'Sí' : 'No') },
    ],
    getInitialFormData: () => ({
      name: '',
      description: '',
      price: '',
      stock: '',
      category: '',
      imageUrl: '',
      size: '',
      shape: '',
      burnTime: '',
      colorsText: '',
      scentsText: '',
      ingredientsText: '',
      isActive: true,
      isFeatured: false,
    }),
    parseRecord: (record) => ({
      name: record.name || '',
      description: record.description || '',
      price: record.price ?? '',
      stock: record.stock ?? '',
      category: record.category || '',
      imageUrl: record.imageUrl || '',
      size: record.size || '',
      shape: record.shape || '',
      burnTime: record.burnTime ?? '',
      colorsText: Array.isArray(record.colors) ? record.colors.join(', ') : '',
      scentsText: Array.isArray(record.scents) ? record.scents.join(', ') : '',
      ingredientsText: Array.isArray(record.ingredients) ? record.ingredients.join(', ') : '',
      isActive: Boolean(record.isActive),
      isFeatured: Boolean(record.isFeatured),
    }),
    serialize: (formData, isUpdate) => ({
      name: String(formData.name || '').trim(),
      description: String(formData.description || '').trim(),
      price: Number(formData.price),
      stock: Number(formData.stock),
      category: normalizeOptionalString(formData.category, isUpdate),
      imageUrl: normalizeOptionalString(formData.imageUrl, isUpdate),
      size: normalizeOptionalString(formData.size, isUpdate),
      shape: normalizeOptionalString(formData.shape, isUpdate),
      burnTime: normalizeOptionalNumber(formData.burnTime, isUpdate),
      colors: normalizeOptionalArray(formData.colorsText, isUpdate),
      scents: normalizeOptionalArray(formData.scentsText, isUpdate),
      ingredients: normalizeOptionalArray(formData.ingredientsText, isUpdate),
      isActive: Boolean(formData.isActive),
      isFeatured: Boolean(formData.isFeatured),
    }),
  },
}

const AdminPanel = () => {
  const navigate = useNavigate()
  const [selectedModule, setSelectedModule] = useState('candles')
  const [formData, setFormData] = useState(MODULE_CONFIG.candles.getInitialFormData())
  const [candleTypes, setCandleTypes] = useState(FALLBACK_CANDLE_TYPES)
  const [records, setRecords] = useState([])
  const [modulePage, setModulePage] = useState(createInitialModulePageState)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: LIST_PAGE_SIZE,
    total: 0,
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 960
  })
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem('ruprecht_sidebar_width'))
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      return Math.min(Math.max(savedWidth, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH)
    }

    return SIDEBAR_DEFAULT_WIDTH
  })
  const resizeState = useRef(null)
  const profileFileInputRef = useRef(null)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  const [user, setUser] = useState(() => getAdminUser())
  const userRole = user?.rol || 'reader'
  const userRoleLabel = ROLE_LABELS[userRole] || 'Usuario'
  const canCreateCatalog = canManageCatalog(user)
  const canDeleteCatalogRecords = canDeleteCatalog(user)
  const canManageUserAccounts = canManageUsers(user)

  const candleTypeOptions = useMemo(
    () => buildCandleTypeOptions(candleTypes),
    [candleTypes]
  )
  const candleTypeLabelMap = useMemo(
    () => buildCandleTypeLabelMap(candleTypes),
    [candleTypes]
  )

  const availableModules = useMemo(
    () => (canManageUserAccounts ? MODULE_ORDER : MODULE_ORDER.filter((moduleKey) => moduleKey !== 'users')),
    [canManageUserAccounts]
  )

  useEffect(() => {
    const loadCandleTypes = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/type-candles`)
        const payload = response?.data
        const rawTypes = Array.isArray(payload) ? payload : payload?.data
        if (Array.isArray(rawTypes) && rawTypes.length > 0) {
          setCandleTypes(rawTypes)
        }
      } catch {
        // Mantener fallback si falla
      }
    }

    loadCandleTypes()
  }, [])

  useEffect(() => {
    if (!availableModules.includes(selectedModule)) {
      setSelectedModule(availableModules[0])
    }
  }, [availableModules, selectedModule])

  useEffect(() => {
    if (selectedModule !== 'candles') return
    if (candleTypeOptions.length === 0) return

    setFormData((prev) => {
      if (!prev) return prev
      const currentValue = String(prev.typeCandle ?? '')
      const hasOption = candleTypeOptions.some((option) => String(option.value) === currentValue)
      if (hasOption) return prev

      return {
        ...prev,
        typeCandle: String(candleTypeOptions[0].value),
      }
    })
  }, [selectedModule, candleTypeOptions])

  const currentModule = useMemo(() => {
    const moduleConfig = MODULE_CONFIG[selectedModule]
    if (!moduleConfig || selectedModule !== 'candles') {
      return moduleConfig
    }

    const updatedFields = moduleConfig.fields.map((field) =>
      field.name === 'typeCandle'
        ? {
            ...field,
            options: candleTypeOptions,
          }
        : field
    )

    const updatedColumns = moduleConfig.columns.map((column) => {
      if (column.label !== 'Tipo') {
        return column
      }

      return {
        ...column,
        render: (row) => {
          const typeValue = row.typeCandle ?? row.type_candle
          return (
            candleTypeLabelMap[typeValue] ||
            CANDLE_TYPE_LABEL[typeValue] ||
            typeValue ||
            '—'
          )
        },
      }
    })

    const getInitialFormData = () => {
      const baseData = moduleConfig.getInitialFormData()
      if (candleTypeOptions.length === 0) return baseData

      const hasOption = candleTypeOptions.some(
        (option) => String(option.value) === String(baseData.typeCandle)
      )
      if (hasOption) return baseData

      return {
        ...baseData,
        typeCandle: String(candleTypeOptions[0].value),
      }
    }

    return {
      ...moduleConfig,
      fields: updatedFields,
      columns: updatedColumns,
      getInitialFormData,
    }
  }, [selectedModule, candleTypeOptions, candleTypeLabelMap])
  const canCreateRecords = selectedModule === 'users' ? canManageUserAccounts : canCreateCatalog
  const canEditRecords = selectedModule === 'users' ? canManageUserAccounts : canCreateCatalog
  const canDeleteRecords = selectedModule === 'users' ? canManageUserAccounts : canDeleteCatalogRecords
  const userName = user?.fullName || user?.full_name || user?.email || ''
  const userInitial = userName ? userName.trim().charAt(0).toUpperCase() : 'A'
  const userAvatarUrl = user?.imageUrl || user?.image_url || ''
  const profileFormName = String(formData?.fullName || formData?.email || '').trim()
  const profileFormInitial = profileFormName ? profileFormName.charAt(0).toUpperCase() : 'U'

  const loadRecords = async (moduleKey = selectedModule, page = modulePage[moduleKey] || 1) => {
    const moduleConfig = MODULE_CONFIG[moduleKey]
    if (!moduleConfig) return

    setLoadingList(true)

    try {
      const response = await axios.get(`${API_BASE_URL}/${moduleConfig.endpoint}`, {
        params: {
          page,
          limit: LIST_PAGE_SIZE,
        },
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      })

      const normalized = normalizePaginatedResponse(response.data, page)

      setRecords(normalized.data)
      setPagination(normalized.meta)
      setModulePage((prev) => ({
        ...prev,
        [moduleKey]: normalized.meta.currentPage,
      }))
    } catch (requestError) {
      setRecords([])
      setPagination({
        currentPage: 1,
        lastPage: 1,
        perPage: LIST_PAGE_SIZE,
        total: 0,
      })
      setStatus({
        type: 'error',
        message: getErrorMessage(requestError, 'No se pudo cargar la lista.'),
      })
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    const validateSession = async () => {
      if (!isAdminSessionActive()) {
        navigate(ADMIN_LOGIN_PATH, { replace: true })
        return
      }

      try {
        const sessionResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        })

        const refreshedUser = sessionResponse?.data?.user
        if (refreshedUser) {
          setUser(refreshedUser)
          const token = getAdminToken()
          if (token) {
            saveAdminSession(token, refreshedUser)
          }
        }

        setCheckingSession(false)
      } catch {
        clearAdminSession()
        navigate(ADMIN_LOGIN_PATH, { replace: true })
      }
    }

    validateSession()
  }, [navigate])

  useEffect(() => {
    setFormData(currentModule.getInitialFormData())
    setEditingId(null)
    setStatus({ type: '', message: '' })
    setIsFormOpen(false)
    loadRecords(selectedModule, modulePage[selectedModule] || 1)
  }, [selectedModule])

  useEffect(() => {
    localStorage.setItem('ruprecht_sidebar_width', String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!resizeState.current) return

      const delta = event.clientX - resizeState.current.startX
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, resizeState.current.startWidth + delta)
      )

      setSidebarWidth(nextWidth)
    }

    const handleMouseUp = () => {
      if (!resizeState.current) return
      resizeState.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const openCreateForm = () => {
    if (!canCreateRecords) {
      return
    }

    setEditingId(null)
    setFormData(currentModule.getInitialFormData())
    setStatus({ type: '', message: '' })
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
    setFormData(currentModule.getInitialFormData())
    setStatus({ type: '', message: '' })
  }

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleOpenProfilePicker = () => {
    if (loadingAction || uploadingImage) return
    profileFileInputRef.current?.click()
  }

  const handleUploadImage = async (event) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setUploadingImage(true)
    setStatus({ type: '', message: '' })

    try {
      const payload = new FormData()
      payload.append('image', selectedFile)

      let uploadTarget = 'products';
      if (selectedModule === 'users') {
        uploadTarget = 'users';
      } else if (selectedModule === 'wax') {
        uploadTarget = 'wax-cream';
      }
      const response = await axios.post(`${API_BASE_URL}/${uploadTarget}/upload-image`, payload, {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      const uploadedUrl = response?.data?.imageUrl || response?.data?.url

      if (!uploadedUrl) {
        throw new Error('No se recibió URL de imagen')
      }

      setFormData((prev) => ({
        ...prev,
        imageUrl: uploadedUrl,
      }))

      setStatus({
        type: 'success',
        message: 'Imagen subida correctamente.',
      })
    } catch (requestError) {
      setStatus({
        type: 'error',
        message: getErrorMessage(requestError, 'No se pudo subir la imagen.'),
      })
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  const handleLogout = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/auth/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      )
    } catch {
      // Si falla el logout remoto, limpiamos sesión local
    } finally {
      sessionStorage.setItem('ruprecht_admin_login_reset', '1')
      clearAdminSession()
      navigate(ADMIN_LOGIN_PATH, { replace: true })
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const isUpdate = Boolean(editingId)

    if ((isUpdate && !canEditRecords) || (!isUpdate && !canCreateRecords)) {
      setStatus({ type: 'error', message: 'No tienes permisos para esta accion.' })
      return
    }

    setLoadingAction(true)
    setStatus({ type: '', message: '' })

    try {
      const payload = currentModule.serialize(formData, isUpdate)
      const url = `${API_BASE_URL}/${currentModule.endpoint}${isUpdate ? `/${editingId}` : ''}`

      const response = isUpdate
        ? await axios.put(url, payload, {
            headers: {
              Authorization: `Bearer ${getAdminToken()}`,
            },
          })
        : await axios.post(url, payload, {
            headers: {
              Authorization: `Bearer ${getAdminToken()}`,
            },
          })

      const refreshedUser = response?.data?.user
      const isEditingOwnUser =
        selectedModule === 'users' &&
        Number(user?.id) > 0 &&
        (refreshedUser ? Number(refreshedUser.id) === Number(user?.id) : Number(editingId) === Number(user?.id))

      if (isEditingOwnUser) {
        const nextUser = refreshedUser || {
          ...user,
          ...payload,
          id: user.id,
        }
        setUser(nextUser)
        const token = getAdminToken()
        if (token) {
          saveAdminSession(token, nextUser)
        }
      }

      setStatus({
        type: 'success',
        message: `Se ${isUpdate ? 'actualizó' : 'creó'} el ${currentModule.entityName} correctamente.`,
      })
      setEditingId(null)
      setFormData(currentModule.getInitialFormData())
      setIsFormOpen(false)
      await loadRecords(selectedModule)
    } catch (requestError) {
      setStatus({
        type: 'error',
        message: getErrorMessage(
          requestError,
          `No se pudo ${isUpdate ? 'actualizar' : 'crear'} el ${currentModule.entityName}.`
        ),
      })
    } finally {
      setLoadingAction(false)
    }
  }

  const handleEdit = (record) => {
    if (!canEditRecords) {
      return
    }

    setEditingId(record.id)
    setFormData(currentModule.parseRecord(record))
    setStatus({ type: '', message: '' })
    setIsFormOpen(true)
  }

  const handleCancelEdit = () => {
    closeForm()
  }

  const handleDelete = async (recordId) => {
    if (!canDeleteRecords) {
      return
    }

    const accepted = window.confirm('¿Seguro que quieres eliminar este registro?')
    if (!accepted) return

    setLoadingAction(true)
    setStatus({ type: '', message: '' })

    try {
      await axios.delete(`${API_BASE_URL}/${currentModule.endpoint}/${recordId}`, {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      })

      if (editingId === recordId) {
        setEditingId(null)
        setFormData(currentModule.getInitialFormData())
      }

      setStatus({
        type: 'success',
        message: `Se eliminó el ${currentModule.entityName} correctamente.`,
      })

      const shouldGoPreviousPage = records.length === 1 && pagination.currentPage > 1
      const targetPage = shouldGoPreviousPage ? pagination.currentPage - 1 : pagination.currentPage

      await loadRecords(selectedModule, targetPage)
    } catch (requestError) {
      setStatus({
        type: 'error',
        message: getErrorMessage(requestError, `No se pudo eliminar el ${currentModule.entityName}.`),
      })
    } finally {
      setLoadingAction(false)
    }
  }

  const handlePageChange = async (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.lastPage || loadingList || loadingAction) {
      return
    }

    await loadRecords(selectedModule, nextPage)
  }

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev)
  }

  const handleResizeStart = (event) => {
    if (isSidebarCollapsed) return

    event.preventDefault()
    resizeState.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const pageStart = pagination.total === 0 ? 0 : (pagination.currentPage - 1) * pagination.perPage + 1
  const pageEnd =
    pagination.total === 0 ? 0 : Math.min(pagination.currentPage * pagination.perPage, pagination.total)

  if (checkingSession) {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <p>Validando sesión...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`admin-dashboard-page ${isSidebarCollapsed ? 'is-collapsed' : ''}`}
      style={{
        '--admin-sidebar-width': `${sidebarWidth}px`,
        '--admin-sidebar-collapsed-width': `${SIDEBAR_COLLAPSED_WIDTH}px`,
      }}
    >
      <aside className="admin-sidebar">
        <div className="admin-brand-block">
          <div className="admin-brand-header">
            <div>
              <h2>Admin</h2>
              <p>Ruprecht</p>
            </div>
            <button
              type="button"
              className="admin-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={isSidebarCollapsed ? 'Mostrar menu' : 'Ocultar menu'}
              title={isSidebarCollapsed ? 'Mostrar menu' : 'Ocultar menu'}
            >
              <i className="pi pi-bars"></i>
            </button>
          </div>
        </div>

        <div className="admin-user-box">
          <div className="admin-user-avatar" aria-hidden="true">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt="" className="admin-user-avatar-image" />
            ) : (
              <span className="admin-user-avatar-initial">{userInitial}</span>
            )}
          </div>
          <div className="admin-user-info">
            <span className="admin-user-title">Sesion activa</span>
            <strong>{user?.email || 'admin@ruprecht.com'}</strong>
            <span className="admin-user-role">{userRoleLabel}</span>
          </div>
        </div>

        <div className="admin-nav-title">Navigation</div>

        <nav className="admin-module-nav">
          {availableModules.map((moduleKey) => (
            <button
              key={moduleKey}
              type="button"
              className={`admin-module-btn ${selectedModule === moduleKey ? 'is-active' : ''}`}
              onClick={() => setSelectedModule(moduleKey)}
            >
              <span className="admin-module-icon" aria-hidden="true">
                {typeof MODULE_ICONS[moduleKey] === 'string' ? (
                  <i className={MODULE_ICONS[moduleKey]}></i>
                ) : (
                  MODULE_ICONS[moduleKey]
                )}
              </span>
              <span className="admin-module-label">{MODULE_CONFIG[moduleKey].label}</span>
            </button>
          ))}
        </nav>

        <button className="admin-btn admin-btn-secondary admin-logout-btn" onClick={handleLogout}>
          <i className="pi pi-sign-out" aria-hidden="true"></i>
          <span className="admin-logout-text">Cerrar sesion</span>
        </button>

        <div
          className="admin-sidebar-resizer"
          onMouseDown={handleResizeStart}
          role="presentation"
        />
      </aside>

      <div
        className="admin-sidebar-backdrop"
        role="presentation"
        onClick={() => setIsSidebarCollapsed(true)}
      />

      <section className="admin-main">
        <div className="admin-main-header">
          <div className="admin-main-title">
            <button
              type="button"
              className="admin-mobile-menu-btn"
              onClick={() => setIsSidebarCollapsed(false)}
              aria-label="Mostrar menu"
            >
              <i className="pi pi-bars" aria-hidden="true"></i>
            </button>
            <div>
              <h1>Gestión de {currentModule.label}</h1>
              <p>
                {editingId
                  ? `Editando registro #${editingId}`
                  : `Crea, edita o elimina ${currentModule.label.toLowerCase()}`}
              </p>
            </div>
          </div>

          <div className="admin-main-actions">
            <button
              type="button"
              className="admin-btn"
              onClick={() => loadRecords(selectedModule, pagination.currentPage)}
              disabled={loadingList || loadingAction}
            >
              {loadingList ? 'Actualizando...' : 'Actualizar lista'}
            </button>
          </div>
        </div>

        {status.message && !isFormOpen && (
          <div className={status.type === 'success' ? 'admin-success' : 'admin-error'}>{status.message}</div>
        )}

        <div className="admin-panel-card">
          <div className="admin-records-header">
            {canCreateRecords && (
              <button
                type="button"
                className="admin-add-btn"
                onClick={openCreateForm}
                disabled={loadingList || loadingAction}
                aria-label={`Agregar ${currentModule.entityName}`}
                title="Agregar"
              >
                +
              </button>
            )}
            <h2>Registros</h2>
          </div>

            {loadingList ? (
              <p className="admin-table-empty">Cargando registros...</p>
            ) : records.length === 0 ? (
              <p className="admin-table-empty">No hay registros en este módulo.</p>
            ) : (
              <>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        {currentModule.columns.map((column) => (
                          <th
                            key={column.label}
                            className={column.label === 'ml' ? 'admin-col-ml' : undefined}
                          >
                            {column.label}
                          </th>
                        ))}
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id}>
                          {currentModule.columns.map((column) => {
                            if (column.label === 'Destacado') {
                              const featuredValue = Boolean(record.isFeatured ?? record.is_featured)

                              return (
                                <td key={`${record.id}-${column.label}`}>
                                  <span
                                    className={`admin-feature-row-badge ${featuredValue ? 'is-yes' : 'is-no'}`}
                                  >
                                    {featuredValue ? 'Sí' : 'No'}
                                  </span>
                                </td>
                              )
                            }

                            if (column.key === 'imageUrl') {
                              const imageUrl = record.imageUrl || record.image_url
                              const nameSource =
                                record.fullName || record.full_name || record.nombre || record.name || record.email
                              const initial = nameSource ? String(nameSource).trim().charAt(0).toUpperCase() : '—'

                              return (
                                <td key={`${record.id}-${column.label}`}>
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={record.nombre || record.name || 'Imagen'}
                                      className="admin-table-image"
                                    />
                                  ) : selectedModule === 'users' ? (
                                    <span className="admin-table-avatar">{initial}</span>
                                  ) : (
                                    <span className="admin-table-image-placeholder">—</span>
                                  )}
                                </td>
                              )
                            }

                            const value = column.render
                              ? column.render(record)
                              : Array.isArray(record[column.key])
                                ? record[column.key].join(', ')
                                : (record[column.key] ?? '—')

                            const displayValue =
                              value === null || value === undefined || value === '' ? '—' : value

                            return (
                              <td
                                key={`${record.id}-${column.label}`}
                                className={column.label === 'ml' ? 'admin-col-ml' : undefined}
                              >
                                {String(displayValue)}
                              </td>
                            )
                          })}

                          <td>
                            {canEditRecords || canDeleteRecords ? (
                              <div className="admin-table-actions">
                                {canEditRecords && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-secondary"
                                    onClick={() => handleEdit(record)}
                                    disabled={loadingAction}
                                    aria-label="Editar"
                                    title="Editar"
                                  >
                                    <i className="pi pi-pencil" aria-hidden="true"></i>
                                  </button>
                                )}
                                {canDeleteRecords && (
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-danger"
                                    onClick={() => handleDelete(record.id)}
                                    disabled={loadingAction}
                                    aria-label="Eliminar"
                                    title="Eliminar"
                                  >
                                    <i className="pi pi-trash" aria-hidden="true"></i>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="admin-table-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="admin-pagination">
                  <p className="admin-pagination-info">
                    Mostrando {pageStart}-{pageEnd} de {pagination.total} registros
                  </p>

                  <div className="admin-pagination-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={loadingList || loadingAction || pagination.currentPage <= 1}
                    >
                      Anterior
                    </button>

                    <span>
                      Página {pagination.currentPage} de {pagination.lastPage}
                    </span>

                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={
                        loadingList || loadingAction || pagination.currentPage >= pagination.lastPage
                      }
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
        </div>

        {isFormOpen && (
          <div className="admin-modal-overlay" onClick={closeForm} role="presentation">
            <div
              className="admin-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="admin-modal-header">
                <h2>{editingId ? 'Editar registro' : 'Crear registro'}</h2>
                <button type="button" className="admin-modal-close" onClick={closeForm} aria-label="Cerrar">
                  ×
                </button>
              </div>

              {status.message && (
                <div className={status.type === 'success' ? 'admin-success' : 'admin-error'}>
                  {status.message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="admin-form-grid">
                {currentModule.fields.map((field) => {
                  if (field.name === 'imageUrl') {
                    return null
                  }

                  if (field.type === 'checkbox') {
                    const isChecked = Boolean(formData[field.name])
                    const isFeaturedField = field.name === 'isFeatured'

                    if (isFeaturedField) {
                      return (
                        <label key={field.name} className="admin-checkbox-field">
                          <span className="admin-checkbox-title">{field.label}</span>

                          <div className="admin-checkbox-basic">
                            <input
                              id={field.name}
                              name={field.name}
                              type="checkbox"
                              checked={isChecked}
                              onChange={handleChange}
                              disabled={loadingAction}
                            />
                            <span>Marcar como destacado</span>
                          </div>
                        </label>
                      )
                    }

                    return (
                      <label key={field.name} className="admin-checkbox-field">
                        <span className="admin-checkbox-title">{field.label}</span>

                        <div className="admin-checkbox-control">
                          <ToggleButton
                            checked={isChecked}
                            onChange={(event) => {
                              setFormData((prev) => ({
                                ...prev,
                                [field.name]: Boolean(event.value),
                              }))
                            }}
                            onLabel="Sí"
                            offLabel="No"
                            onIcon="pi pi-check"
                            offIcon="pi pi-times"
                            className="admin-feature-toggle"
                            disabled={loadingAction}
                            aria-label={field.label}
                          />

                          <Tag
                            value={getBooleanStatusLabel(field.name, isChecked)}
                            severity={isChecked ? 'success' : 'danger'}
                            className="admin-feature-status-tag"
                          />
                        </div>
                      </label>
                    )
                  }

                  return (
                    <div className="admin-field" key={field.name}>
                      <label htmlFor={field.name}>{field.label}</label>

                      {(() => {
                        const isPasswordField = field.name === 'contrasena'
                        const isRequired = field.required && !(editingId && isPasswordField)

                        if (field.type === 'textarea') {
                          return (
                            <textarea
                              id={field.name}
                              name={field.name}
                              value={formData[field.name] ?? ''}
                              onChange={handleChange}
                              required={isRequired}
                              rows={field.rows || 3}
                              minLength={field.minLength}
                              disabled={loadingAction || uploadingImage}
                            />
                          )
                        }

                        if (field.type === 'select') {
                          return (
                            <select
                              id={field.name}
                              name={field.name}
                              value={formData[field.name] ?? ''}
                              onChange={handleChange}
                              required={isRequired}
                              disabled={loadingAction || uploadingImage}
                            >
                              {field.options.map((option) => (
                                <option value={option.value} key={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )
                        }

                        return (
                          <input
                            id={field.name}
                            name={field.name}
                            type={field.type || 'text'}
                            value={formData[field.name] ?? ''}
                            onChange={handleChange}
                            required={isRequired}
                            step={field.step}
                            min={field.min}
                            minLength={field.minLength}
                            disabled={loadingAction || uploadingImage}
                          />
                        )
                      })()}
                    </div>
                  )
                })}

                {'imageUrl' in formData &&
                  (selectedModule === 'users' ? (
                    <div className="admin-profile-upload-field">
                      <div className="admin-profile-header">
                        <div>
                          <span className="admin-profile-title">Foto de perfil</span>
                          <small className="admin-profile-subtitle">Sube la foto de perfil.</small>
                        </div>
                        {formData.imageUrl && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                imageUrl: '',
                              }))
                            }}
                            disabled={loadingAction || uploadingImage}
                          >
                            Eliminar foto
                          </button>
                        )}
                      </div>
                      <div className="admin-profile-preview">
                        {formData.imageUrl ? (
                          <img src={formData.imageUrl} alt="Foto de perfil" />
                        ) : (
                          <span className="admin-profile-placeholder">{profileFormInitial}</span>
                        )}
                      </div>

                      <div className="admin-profile-file-row">
                        <input
                          ref={profileFileInputRef}
                          type="file"
                          accept="image/*"
                          className="admin-file-input-hidden"
                          onChange={handleUploadImage}
                          disabled={loadingAction || uploadingImage}
                        />
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={handleOpenProfilePicker}
                          disabled={loadingAction || uploadingImage}
                        >
                          {formData.imageUrl ? 'Cambiar foto' : 'Subir foto'}
                        </button>
                        <small>
                          {uploadingImage ? 'Subiendo foto...' : 'Recomendado: foto cuadrada.'}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-image-upload-field">
                      <label htmlFor="admin-image-file">Subir imagen desde archivo</label>
                      <input
                        id="admin-image-file"
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        disabled={loadingAction || uploadingImage}
                      />
                      <small>
                        {uploadingImage
                          ? 'Subiendo imagen...'
                          : 'Puedes seleccionar una imagen desde archivos o galería.'}
                      </small>

                      {formData.imageUrl ? (
                        <>
                          <div className="admin-image-preview-wrap">
                            <img src={formData.imageUrl} alt="Vista previa" className="admin-image-preview" />
                          </div>
                          {editingId && (
                            <div className="admin-image-actions">
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                onClick={async () => {
                                  if (selectedModule === 'wax' && editingId) {
                                    try {
                                      setLoadingAction(true)
                                      await axios.delete(`${API_BASE_URL}/wax-cream/${editingId}/image`, {
                                        headers: {
                                          Authorization: `Bearer ${getAdminToken()}`,
                                        },
                                      })
                                      setFormData((prev) => ({
                                        ...prev,
                                        imageUrl: '',
                                      }))
                                      setStatus({ type: 'success', message: 'Imagen eliminada correctamente.' })
                                    } catch (error) {
                                      setStatus({ type: 'error', message: getErrorMessage(error, 'No se pudo eliminar la imagen.') })
                                    } finally {
                                      setLoadingAction(false)
                                    }
                                  } else {
                                    setFormData((prev) => ({
                                      ...prev,
                                      imageUrl: '',
                                    }))
                                  }
                                }}
                                disabled={loadingAction || uploadingImage}
                              >
                                Eliminar imagen
                              </button>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  ))}

                <div className="admin-form-actions">
                  <button className="admin-btn" type="submit" disabled={loadingAction || uploadingImage}>
                    {loadingAction ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear'}
                  </button>

                  {editingId && (
                    <button
                      className="admin-btn admin-btn-secondary"
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={loadingAction || uploadingImage}
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminPanel
