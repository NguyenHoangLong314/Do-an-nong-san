import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API, request } from './api'
import AdminPage from './AdminPage'
import EvidenceGallery from './EvidenceGallery'
import './App.css'

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
const shortDate = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : 'Đang cập nhật'
const isFertilizer = (product) => product?.category?.ten_danh_muc?.toLocaleLowerCase('vi').includes('phân bón') || product?.don_vi_tinh === 'bao'
const searchableText = (...values) => values.filter(Boolean).join(' ').toLocaleLowerCase('vi')
const unitOf = (product) => product?.don_vi_tinh || (isFertilizer(product) ? 'bao' : 'kg')
const quantityStep = (product) => unitOf(product) === 'bao' ? 1 : 0.5
const unitPriceLabel = (product) => `/${unitOf(product)}`
const API_ORIGIN = new URL(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').origin
const lossEvidenceUrl = (path) => `${API}/farm/loss-evidence/${String(path || '').split('/').map(encodeURIComponent).join('/')}`

function productEmoji(product) {
  const name = (product?.ten_san_pham || '').toLocaleLowerCase('vi')
  if (name.includes('cà chua') || name.includes('tomato')) return '🍅'
  if (name.includes('dâu') || name.includes('strawberry')) return '🍓'
  if (name.includes('xà lách') || name.includes('lettuce')) return '🥗'
  if (name.includes('kale')) return '🥬'
  if (name.includes('cà rốt') || name.includes('carrot')) return '🥕'
  return '🌱'
}

function userIdFromToken(token) {
  try {
    const payload = token?.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))).sub || null
  } catch { return null }
}

function readCachedUser(token) {
  if (!token) return null
  try {
    const cached = JSON.parse(localStorage.getItem('nong-san-session-user') || 'null')
    const idFromToken = userIdFromToken(token)
    const payloadPart = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/') || ''
    const payload = JSON.parse(atob(payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, '=')))
    if (cached?.token !== token || !cached.user || Number(cached.user.ma_nguoi_dung) !== Number(idFromToken) || Number(payload.exp) * 1000 <= Date.now()) return null
    return cached.user
  } catch { return null }
}

function cacheSessionUser(token, user) {
  localStorage.setItem('nong-san-session-user', JSON.stringify({
    token,
    user: { ma_nguoi_dung: user.ma_nguoi_dung, ho_ten: user.ho_ten, vai_tro: user.vai_tro },
  }))
}

function readCart(owner) {
  try {
    const cart = JSON.parse(localStorage.getItem(`nong-san-cart:${owner || 'guest'}`) || '[]')
    return Array.isArray(cart) ? cart : []
  } catch { return [] }
}

function readRoute() {
  const path = decodeURIComponent(window.location.pathname).replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(window.location.search)
  const productMatch = path.match(/^\/products\/([^/]+)$/)
  const traceMatch = path.match(/^\/trace\/(.+)$/)
  const lossMatch = path.match(/^\/farm\/batches\/(\d+)\/losses\/new$/)
  const journalMatch = path.match(/^\/farm\/batches\/(\d+)\/logs\/new$/)
  const adminMatch = path.match(/^\/admin(?:\/(products|categories|users|orders|reports|settings))?$/)
  const pagePaths = { '/': 'shop', '/orders': 'orders', '/farm': 'staff', '/admin': 'admin' }
  if (productMatch) return { page: 'shop', productId: productMatch[1] }
  if (traceMatch) return { page: 'trace', traceQr: traceMatch[1] }
  if (path === '/farm/batches/new') return { page: 'staff', farmDialog: 'batch' }
  if (lossMatch) return { page: 'staff', farmDialog: 'loss', farmBatchId: lossMatch[1] }
  if (journalMatch) return { page: 'staff', farmDialog: 'journal', farmBatchId: journalMatch[1] }
  if (adminMatch) return { page: 'admin', adminTab: adminMatch[1] === 'users' ? 'people' : adminMatch[1] || 'overview' }
  if (path === '/cart') return { page: 'shop', modal: 'cart' }
  if (path === '/checkout') return { page: 'shop', modal: 'cart', checkout: true }
  if (path === '/login' || path === '/register') return { page: 'shop', modal: 'auth', authMode: path === '/register' ? 'register' : 'login' }
  if (path === '/subscriptions') return { page: 'shop', modal: 'subscription' }
  if (params.has('trace')) return { page: 'trace', traceQr: params.get('trace') || '' }
  if (params.has('product')) return { page: 'shop', productId: params.get('product') }
  return { page: pagePaths[path] || 'shop' }
}

function App() {
  const locationRequested = useRef(false)
  const [deviceLocation, setDeviceLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('loading')
  const [locationError, setLocationError] = useState('')
  const [page, setPage] = useState(() => readRoute().page)
  const [traceQr, setTraceQr] = useState(() => readRoute().traceQr || '')
  const [routeProductId, setRouteProductId] = useState(() => readRoute().productId || '')
  const [farmDialog, setFarmDialog] = useState(() => readRoute().farmDialog || '')
  const [farmBatchId, setFarmBatchId] = useState(() => readRoute().farmBatchId || '')
  const [adminTab, setAdminTab] = useState(() => readRoute().adminTab || 'overview')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [plans, setPlans] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Tất cả')
  const [token, setToken] = useState(() => localStorage.getItem('nong-san-token') || '')
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem('nong-san-token'))
  const [user, setUser] = useState(() => readCachedUser(localStorage.getItem('nong-san-token') || ''))
  const cartOwner = user?.ma_nguoi_dung || userIdFromToken(token) || 'guest'
  const [cart, setCart] = useState(() => token ? readCart(cartOwner) : [])
  const [modal, setModal] = useState(() => readRoute().modal || '')
  const [routeCheckout, setRouteCheckout] = useState(() => Boolean(readRoute().checkout))
  const [authMode, setAuthMode] = useState(() => readRoute().authMode || 'login')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [addingProductId, setAddingProductId] = useState(null)

  useEffect(() => {
    if (locationRequested.current) return
    locationRequested.current = true
    if (!navigator.geolocation) {
      setLocationStatus('error')
      setLocationError('Trình duyệt này không hỗ trợ lấy vị trí thiết bị.')
      return
    }
    navigator.geolocation.getCurrentPosition((position) => {
      setDeviceLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      setLocationStatus('ready')
      setLocationError('')
    }, (error) => {
      setLocationStatus('error')
      setLocationError(error.code === error.PERMISSION_DENIED
        ? 'Trình duyệt chưa được cấp quyền vị trí. Hãy bật quyền vị trí cho trang web để tính khoảng cách.'
        : 'Không lấy được vị trí thiết bị. Hãy kiểm tra GPS hoặc kết nối mạng.')
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }, [])

  function resetToDefaultRoute() {
    window.history.replaceState({ type: 'page', page: 'shop' }, '', '/')
    setPage('shop')
    setTraceQr('')
    setRouteProductId('')
    setFarmDialog('')
    setFarmBatchId('')
    setAdminTab('overview')
    setSelected(null)
    setModal('')
    setRouteCheckout(false)
    setAuthMode('login')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('payment')) {
      setToast(params.get('payment') === 'success'
        ? `VNPay đã báo thanh toán thành công${params.get('order_id') ? ` cho đơn #${params.get('order_id')}` : ''}. Đơn hàng đang được đồng bộ.`
        : 'Thanh toán VNPay chưa hoàn tất. Đơn hàng sẽ được kiểm tra lại trong mục Đơn hàng.')
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    function handleExpiredSession() {
      localStorage.removeItem('nong-san-token')
      localStorage.removeItem('nong-san-session-user')
      setToken('')
      setAuthReady(true)
      setUser(null)
      setCart([])
      resetToDefaultRoute()
      setToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }
    function handleOtherTabLogout(event) {
      if (event.key === 'nong-san-token' && event.newValue === null && token) handleExpiredSession()
    }
    window.addEventListener('auth:expired', handleExpiredSession)
    window.addEventListener('storage', handleOtherTabLogout)
    return () => {
      window.removeEventListener('auth:expired', handleExpiredSession)
      window.removeEventListener('storage', handleOtherTabLogout)
    }
  }, [token])

  useEffect(() => {
    if (!token) return undefined
    try {
      const encoded = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/') || ''
      const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')))
      if (!Number.isFinite(payload.exp)) return undefined
      const timeout = window.setTimeout(() => window.dispatchEvent(new Event('auth:expired')), Math.max(0, payload.exp * 1000 - Date.now()))
      return () => window.clearTimeout(timeout)
    } catch { return undefined }
  }, [token])

  useEffect(() => {
    if (cartOwner === 'guest') localStorage.removeItem('nong-san-cart:guest')
  }, [cartOwner])

  useEffect(() => {
    localStorage.setItem(`nong-san-cart:${cartOwner}`, JSON.stringify(cart))
  }, [cart, cartOwner])

  async function updateCart(nextCart) {
    if (user?.vai_tro !== 'Customer') return
    setBusy(true)
    try {
      await request('/cart', { token, method: 'PUT', body: { items: nextCart.map((item) => ({ ma_san_pham: item.product.ma_san_pham, so_luong: item.quantity })) } })
      setCart(nextCart)
    } catch (error) { setToast(error.message) } finally { setBusy(false) }
  }

  useEffect(() => {
    let active = true
    const refreshProducts = () => request('/products')
      .then((data) => { if (active) setProducts(data.data || []) })
      .catch(() => { if (active) setProducts([]) })
      .finally(() => { if (active) setLoadingProducts(false) })
    refreshProducts()
    window.addEventListener('catalog-updated', refreshProducts)
    request('/plans').then((data) => { if (active) setPlans(data) }).catch(() => { if (active) setPlans([]) })
    if (token) request('/auth/me', { token }).then((data) => {
      if (!active) return
      cacheSessionUser(token, data.user)
      setUser(data.user)
      setCart(data.user.vai_tro === 'Customer' ? readCart(data.user.ma_nguoi_dung) : [])
      setAuthReady(true)
      if (data.user.vai_tro === 'Customer') {
        request('/cart', { token }).then((cartData) => {
          if (active) setCart(cartData.items || [])
        }).catch(() => {})
      }
    }).catch(() => { if (active) setAuthReady(true) })
    return () => { active = false; window.removeEventListener('catalog-updated', refreshProducts) }
  }, [token])

  useEffect(() => {
    if (!authReady) return
    if (page === 'admin' && user?.vai_tro !== 'Admin') {
      navigatePage('shop', { replace: true })
      return
    }
    if (page === 'staff' && !['Staff', 'Admin'].includes(user?.vai_tro)) {
      navigatePage('shop', { replace: true })
      return
    }
    if (!['Staff', 'Admin'].includes(user?.vai_tro)) return
    if (['shop', 'orders'].includes(page) || modal === 'cart' || modal === 'subscription') {
      navigatePage(user.vai_tro === 'Admin' ? 'admin' : 'staff', { replace: true })
    }
  }, [authReady, user, page, modal])

  useEffect(() => {
    function restoreLocation() {
      const route = readRoute()
      setPage(route.page)
      setTraceQr(route.traceQr || '')
      setRouteProductId(route.productId || '')
      setFarmDialog(route.farmDialog || '')
      setFarmBatchId(route.farmBatchId || '')
      setAdminTab(route.adminTab || 'overview')
      setSelected(route.productId ? products.find((item) => String(item.ma_san_pham) === route.productId) || null : null)
      setModal(route.modal || '')
      setRouteCheckout(Boolean(route.checkout))
      setAuthMode(route.authMode || 'login')
    }
    window.addEventListener('popstate', restoreLocation)
    return () => window.removeEventListener('popstate', restoreLocation)
  }, [products])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  const categories = useMemo(() => ['Tất cả', ...new Set(products.map((item) => item.category?.ten_danh_muc).filter(Boolean))], [products])
  const visibleProducts = useMemo(() => products.filter((item) =>
    (category === 'Tất cả' || item.category?.ten_danh_muc === category) &&
    item.ten_san_pham.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
  ), [products, category, search])
  const currentProduct = selected || products.find((item) => String(item.ma_san_pham) === routeProductId) || null
  const cartCount = cart.length

  function navigatePage(next, { replace = false } = {}) {
    const paths = { shop: '/', orders: '/orders', staff: '/farm', admin: '/admin' }
    const path = paths[next] || '/'
    const state = { type: 'page', page: next }
    if (replace) window.history.replaceState(state, '', path)
    else window.history.pushState(state, '', path)
    setPage(next)
    setTraceQr('')
    setRouteProductId('')
    setFarmDialog('')
    setFarmBatchId('')
    setAdminTab('overview')
    setSelected(null)
    setModal('')
    setRouteCheckout(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function navigateAdminTab(tab) {
    const segment = tab === 'people' ? 'users' : tab
    const path = tab === 'overview' ? '/admin' : `/admin/${segment}`
    window.history.pushState({ type: 'page', page: 'admin', adminTab: tab }, '', path)
    setPage('admin')
    setAdminTab(tab)
    setModal('')
    setRouteCheckout(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function openFarmDialog(dialog, batchId = null) {
    const path = dialog === 'batch' ? '/farm/batches/new' : `/farm/batches/${batchId}/${dialog === 'loss' ? 'losses' : 'logs'}/new`
    window.history.pushState({ type: 'farm-dialog', dialog, batchId }, '', path)
    setPage('staff')
    setFarmDialog(dialog)
    setFarmBatchId(batchId ? String(batchId) : '')
  }

  function closeFarmDialog(replace = false) {
    if (!replace && window.history.state?.type === 'farm-dialog') {
      window.history.back()
      return
    }
    window.history.replaceState({ type: 'page', page: 'staff' }, '', '/farm')
    setFarmDialog('')
    setFarmBatchId('')
  }

  function openModal(next) {
    const paths = { cart: '/cart', auth: authMode === 'register' ? '/register' : '/login', subscription: '/subscriptions' }
    window.history.pushState({ type: 'modal', modal: next }, '', paths[next] || '/')
    setPage('shop')
    setModal(next)
    setRouteCheckout(false)
  }

  function closeModal() {
    if (window.history.state?.type === 'modal') {
      window.history.back()
      return
    }
    window.history.replaceState({ type: 'page', page: 'shop' }, '', '/')
    setPage('shop')
    setTraceQr('')
    setRouteProductId('')
    setSelected(null)
    setModal('')
    setRouteCheckout(false)
  }

  function startCheckout() {
    window.history.pushState({ type: 'modal', modal: 'cart', checkout: true }, '', '/checkout')
    setModal('cart')
    setRouteCheckout(true)
  }

  function switchAuthMode(nextMode) {
    window.history.replaceState({ type: 'modal', modal: 'auth' }, '', nextMode === 'register' ? '/register' : '/login')
    setAuthMode(nextMode)
    setModal('auth')
  }

  async function authenticate(form) {
    setBusy(true)
    try {
      const data = await request(`/auth/${form.get('mode')}`, {
        method: 'POST',
        body: Object.fromEntries(form.entries()),
      })
      localStorage.setItem('nong-san-token', data.token)
      cacheSessionUser(data.token, data.user)
      setToken(data.token)
      setAuthReady(true)
      setUser(data.user)
      setCart(data.user.vai_tro === 'Customer' ? readCart(data.user.ma_nguoi_dung) : [])
      resetToDefaultRoute()
      setToast(`Xin chào ${data.user.ho_ten}!`)
      if (data.user.vai_tro === 'Customer') {
        request('/cart', { token: data.token }).then((cartData) => {
          if (localStorage.getItem('nong-san-token') === data.token) setCart(cartData.items || [])
        }).catch(() => {})
      }
      return ''
    } catch (error) { return error.message } finally { setBusy(false) }
  }

  function signOut() {
    localStorage.setItem(`nong-san-cart:${cartOwner}`, JSON.stringify(cart))
    localStorage.removeItem('nong-san-cart:guest')
    setCart([])
    localStorage.removeItem('nong-san-token')
    localStorage.removeItem('nong-san-session-user')
    setToken('')
    setAuthReady(true)
    setUser(null)
    resetToDefaultRoute()
    setToast('Bạn đã đăng xuất.')
  }

  async function addToCart(product, quantity = 1) {
    if (user?.vai_tro !== 'Customer') {
      setToast(user ? 'Chỉ khách hàng mới có thể sử dụng giỏ hàng.' : 'Vui lòng đăng nhập trước khi thêm sản phẩm vào giỏ hàng.')
      if (!user) openModal('auth')
      return false
    }
    const found = cart.find((item) => item.product.ma_san_pham === product.ma_san_pham)
    const nextCart = found
      ? cart.map((item) => item === found ? { ...item, quantity: item.quantity + quantity } : item)
      : [...cart, { product, quantity }]
    setAddingProductId(product.ma_san_pham)
    try {
      await request('/cart', { token, method: 'PUT', body: { items: nextCart.map((item) => ({ ma_san_pham: item.product.ma_san_pham, so_luong: item.quantity })) } })
      setCart(nextCart)
      setToast('Đã kiểm tra tồn kho và thêm vào giỏ hàng.')
      return true
    } catch (error) {
      setToast(error.message)
      return false
    } finally { setAddingProductId(null) }
  }

  async function checkout(form) {
    setBusy(true)
    try {
      const order = await request('/orders', {
        token,
        method: 'POST',
        body: {
          dia_chi_giao_hang: form.get('address'),
          shipping_destination: {
            province: form.get('province'), district: form.get('district'),
            ward: form.get('ward'), address: form.get('address_detail'),
          },
          phuong_thuc_thanh_toan: form.get('payment'),
          shipping_quote_token: form.get('shipping_quote_token'),
          items: cart.map((item) => ({ ma_san_pham: item.product.ma_san_pham, so_luong: item.quantity })),
        },
      })
      setCart([])
      if (order.payment_url) {
        window.location.assign(order.payment_url)
        return
      }
      setToast(`Đã tạo đơn hàng #${order.order.ma_don_hang}. Thanh toán đang chờ xác nhận.`)
      navigatePage('orders', { replace: true })
    } catch (error) { setToast(error.message) } finally { setBusy(false) }
  }

  async function getShippingQuote(destination, origin) {
    return request('/shipping/quote', { token, method: 'POST', body: {
      destination,
      origin,
      items: cart.map((item) => ({ ma_san_pham: item.product.ma_san_pham, so_luong: item.quantity })),
    } })
  }

  function navTo(next) {
    if (next === 'staff' && !user) { openModal('auth'); return }
    if (next === 'staff' && !['Staff', 'Admin'].includes(user?.vai_tro)) {
      setToast('Khu vực nông trại chỉ dành cho nhân viên Staff hoặc Admin.')
      return
    }
    if (next === 'admin' && !user) { openModal('auth'); return }
    if (next === 'admin' && user?.vai_tro !== 'Admin') {
      setToast('Khu vực quản trị chỉ dành cho tài khoản Admin.')
      return
    }
    navigatePage(next)
  }

  function openProduct(product) {
    window.history.pushState({ type: 'product', productId: product.ma_san_pham }, '', `/products/${encodeURIComponent(product.ma_san_pham)}`)
    setSelected(product)
    setRouteProductId(String(product.ma_san_pham))
    setPage('shop')
    setModal('')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function closeProduct() {
    if (window.history.state?.type === 'product') {
      window.history.back()
      return
    }
    window.history.replaceState({ type: 'page', page: 'shop' }, '', '/')
    setSelected(null)
    setRouteProductId('')
  }

  function goHome() {
    navigatePage('shop')
  }

  function openTrace(qr) {
    window.history.pushState({ type: 'trace' }, '', `/trace/${encodeURIComponent(qr)}`)
    setTraceQr(qr)
    setRouteProductId('')
    setPage('trace')
    setModal('')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function closeTrace() {
    if (window.history.state?.type === 'trace') {
      window.history.back()
      return
    }
    window.history.replaceState({ type: 'page', page: 'shop' }, '', '/')
    setTraceQr('')
    setRouteProductId('')
    setPage('shop')
  }

  const hasWorkAccess = ['Staff', 'Admin'].includes(user?.vai_tro)
  const bootingProtectedRoute = (page === 'admin' && user?.vai_tro !== 'Admin') || (page === 'staff' && !hasWorkAccess)
  const waitingForIdentity = Boolean(token && !authReady && !user)
  const waitingForWorkRedirect = Boolean(token && !authReady && hasWorkAccess && ['shop', 'orders'].includes(page))
  if (waitingForIdentity || waitingForWorkRedirect || bootingProtectedRoute) {
    return <div className="app-shell session-startup" role="status" aria-live="polite"><span className="startup-mark">🌱</span><p>{authReady ? 'Đang đưa bạn về trang phù hợp…' : 'Đang xác thực phiên đăng nhập…'}</p></div>
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="Về trang chủ">
          <span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M16 27V14" /><path d="M16 19C8.7 19 5 15.1 5 8c7.4 0 11 3.6 11 11Z" /><path d="M16 15c0-6.6 3.5-10 10-10 0 6.7-3.4 10-10 10Z" /><path d="m9 12 7 7m7-9-7 7" /></svg></span><span>Nông trại <b>lành</b></span>
        </button>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {!['Staff', 'Admin'].includes(user?.vai_tro) && <><button className={page === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}>Mua sắm</button><button className={page === 'orders' ? 'active' : ''} onClick={() => navTo('orders')}>Đơn hàng</button></>}
          {['Staff', 'Admin'].includes(user?.vai_tro) && <button className={page === 'staff' ? 'active' : ''} onClick={() => navTo('staff')}>Khu vực nông trại</button>}
          {user?.vai_tro === 'Admin' && <button className={page === 'admin' ? 'active' : ''} onClick={() => navTo('admin')}>Quản trị</button>}
        </nav>
        <div className="topbar-actions">
          {user ? <button className="profile-chip" onClick={signOut}><span>{user.ho_ten?.slice(0, 1)}</span><small>{user.ho_ten?.split(' ').at(-1)} · Đăng xuất</small></button> : <button className="login-link" onClick={() => openModal('auth')}>Đăng nhập</button>}
          {!['Staff', 'Admin'].includes(user?.vai_tro) && <button className="cart-button" onClick={() => openModal('cart')} aria-label={`Giỏ hàng, ${cartCount} món`}><span>Giỏ hàng</span><b>{cartCount}</b></button>}
        </div>
      </header>

      <main>
        {page === 'shop' && !['Staff', 'Admin'].includes(user?.vai_tro) && !currentProduct && <ShopPage products={visibleProducts} loading={loadingProducts} categories={categories} category={category} setCategory={setCategory} search={search} setSearch={setSearch} onSelect={openProduct} onAdd={addToCart} addingProductId={addingProductId} />}
        {page === 'shop' && !['Staff', 'Admin'].includes(user?.vai_tro) && currentProduct && <ProductPage key={currentProduct.ma_san_pham} product={currentProduct} onBack={closeProduct} onAdd={addToCart} adding={addingProductId === currentProduct.ma_san_pham} onSubscribe={() => openModal('subscription')} onTrace={openTrace} onToast={setToast} />}
        {page === 'trace' && <TracePage qr={traceQr} onBack={closeTrace} />}
        {page === 'staff' && ['Staff', 'Admin'].includes(user?.vai_tro) && <StaffPage token={token} initialDialog={farmDialog} initialBatchId={farmBatchId} onDialogOpen={openFarmDialog} onDialogClose={closeFarmDialog} onToast={setToast} />}
        {page === 'orders' && !['Staff', 'Admin'].includes(user?.vai_tro) && <OrdersPage token={token} onToast={setToast} onLogin={() => openModal('auth')} />}
        {page === 'admin' && user?.vai_tro === 'Admin' && <AdminPage key={adminTab} initialTab={adminTab} onTabChange={navigateAdminTab} token={token} onToast={setToast} />}
      </main>

      <nav className={`mobile-nav${user?.vai_tro === 'Admin' ? ' admin-enabled' : ''}${['Staff', 'Admin'].includes(user?.vai_tro) ? ' work-only' : ''}`} aria-label="Điều hướng chính">
        {!['Staff', 'Admin'].includes(user?.vai_tro) && <><button className={page === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><span>⌂</span><small>Mua sắm</small></button><button className={page === 'orders' ? 'active' : ''} onClick={() => navTo('orders')}><span>▤</span><small>Đơn hàng</small></button></>}
        {['Staff', 'Admin'].includes(user?.vai_tro) && <button className={page === 'staff' ? 'active' : ''} onClick={() => navTo('staff')}><span>⌖</span><small>Nông trại</small></button>}
        {user?.vai_tro === 'Admin' && <button className={page === 'admin' ? 'active' : ''} onClick={() => navTo('admin')}><span>▦</span><small>Quản trị</small></button>}
      </nav>

      {modal === 'auth' && <AuthModal key={authMode} initialMode={authMode} onClose={closeModal} onModeChange={switchAuthMode} onSubmit={authenticate} busy={busy} />}
      {modal === 'cart' && <CartModal key={routeCheckout ? 'checkout' : 'cart'} initialCheckout={routeCheckout} cart={cart} onUpdateCart={updateCart} user={user} onClose={closeModal} onLogin={() => openModal('auth')} onCheckout={checkout} onStartCheckout={startCheckout} onQuoteShipping={getShippingQuote} farmLocation={deviceLocation} locationStatus={locationStatus} locationError={locationError} busy={busy} />}
      {modal === 'subscription' && <SubscriptionModal plans={plans} token={token} onClose={closeModal} onLogin={() => openModal('auth')} onToast={setToast} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function ShopPage({ products, loading, categories, category, setCategory, search, setSearch, onSelect, onAdd, addingProductId }) {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow"><i /> TỪ VƯỜN NHÀ, TƯƠI MỖI NGÀY</p>
          <h1>Biết rõ rau mình ăn,<br /><em>thấy rõ vườn mình tin.</em></h1>
          <p>Nông sản thu hoạch theo lô, có nhật ký canh tác và ngày hái rõ ràng.</p>
          <button className="primary-button" onClick={() => document.getElementById('fresh-products')?.scrollIntoView({ behavior: 'smooth' })}>Chọn rau quả hôm nay <span>↓</span></button>
          <div className="trust-row"><span>✳ Truy xuất từng lô</span><span>⌁ Thu hoạch theo mùa</span></div>
        </div>
        <div className="hero-art" aria-label="Nông sản tươi từ vườn">
          <div className="hero-stamp">HÁI TRONG<br />NGÀY</div>
          <span className="food food-tomato">🍅</span><span className="food food-leaf">🥬</span><span className="food food-carrot">🥕</span>
          <div className="hero-caption">Vườn nhỏ · Mùa mới · Vị lành</div>
        </div>
      </section>

      <section className="product-section container" id="fresh-products">
        <div className="section-heading"><div><p className="eyebrow">GẦN VƯỜN NHẤT</p><h2>Rau quả đang vào mùa</h2></div><span className="fresh-note"><i /> Có lô đang bán hôm nay</span></div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm rau, củ, quả..." /></label>
        <div className="category-row" aria-label="Lọc danh mục">{categories.map((name) => <button key={name} className={category === name ? 'selected' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div>
        <div className="product-grid">
          {loading && Array.from({ length: 4 }, (_, index) => <div className="product-skeleton" key={`skeleton-${index}`} aria-hidden="true"><div /><i /><i /><i /></div>)}
          {products.map((product, index) => <ProductCard key={product.ma_san_pham} product={product} index={index} adding={addingProductId === product.ma_san_pham} onSelect={() => onSelect(product)} onAdd={() => onAdd(product)} />)}
          {!loading && !products.length && <div className="empty-state"><span>🌱</span><h3>Chưa có nông sản để trưng bày</h3><p>Chạy seeder để thêm dữ liệu mẫu hoặc nhập sản phẩm đầu tiên trong quản trị.</p></div>}
        </div>
      </section>
      <section className="promise-band"><div className="container promise-inner"><span>01 <b>Lô hàng riêng</b><small>Biết chính xác sản phẩm từ lô nào</small></span><span>02 <b>Nhật ký canh tác</b><small>Xem hành trình chăm sóc tại vườn</small></span><span>03 <b>Hạn dùng rõ ràng</b><small>Chọn rau quả còn tươi ngon</small></span></div></section>
    </>
  )
}

function RestrictedPage({ title, onLogin }) {
  return <section className="orders-page container"><div className="admin-empty"><span>🔒</span><h2>{title}</h2><p>Đăng nhập bằng tài khoản có quyền phù hợp để tiếp tục.</p><button className="primary-button" onClick={onLogin}>Đăng nhập</button></div></section>
}

function ProductCard({ product, index, onSelect, onAdd, adding }) {
  const stock = Number(product.ton_kho || 0)
  const unit = unitOf(product)
  return (
    <article className="product-card">
      <button className={`product-art product-art-${index % 4}`} onClick={onSelect} aria-label={`Xem ${product.ten_san_pham}`}>
        {product.hinh_anh ? <img src={product.hinh_anh} alt={product.ten_san_pham} loading="lazy" decoding="async" /> : <span>{productEmoji(product)}</span>}
        {!isFertilizer(product) && <span className="harvest-tag">Tươi theo lô</span>}
      </button>
      <div className="product-card-body">
        <p className="product-category">{product.category?.ten_danh_muc || 'Nông sản sạch'}</p>
        <button className="product-title" onClick={onSelect}>{product.ten_san_pham}</button>
        <p className="product-description">{product.mo_ta || 'Nông sản tươi từ vườn.'}</p>
        <div className="product-meta"><b>{money(product.gia_co_ban)}<small> / {unit}</small></b><span>{stock > 0 ? `Còn ${stock} ${unit}` : 'Hết hàng'}</span></div>
        <div className="product-card-actions"><button className="text-button" onClick={onSelect}>Nguồn gốc <span>↗</span></button><button className="add-button" disabled={adding || stock <= 0} onClick={onAdd}>{adding ? 'Đang kiểm tra…' : stock > 0 ? '+ Thêm' : 'Hết hàng'}</button></div>
      </div>
    </article>
  )
}

function ProductPage({ product: initial, onBack, onAdd, adding, onSubscribe, onTrace, onToast }) {
  const [product, setProduct] = useState(initial)
  const [quantity, setQuantity] = useState(1)
  useEffect(() => {
    let active = true
    request(`/products/${initial.ma_san_pham}`).then((data) => { if (active) setProduct(data) }).catch(() => { if (active) setProduct(initial) })
    return () => { active = false }
  }, [initial])
  const batch = Array.isArray(product.batches) ? product.batches[0] : null
  const unit = unitOf(product)
  const step = quantityStep(product)
  const timeline = Array.isArray(batch?.logs) ? batch.logs : []
  const add = async () => { if (await onAdd(product, quantity)) onBack() }
  const downloadQr = async () => {
    if (!batch) return
    let objectUrl
    try {
      const response = await fetch(`${API}/farm/batches/${batch.ma_lo_hang}/qr`, { headers: { Accept: 'image/svg+xml' } })
      if (!response.ok) throw new Error('Không tải được mã QR.')
      const svgBlob = await response.blob()
      objectUrl = URL.createObjectURL(svgBlob)
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 1200
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.imageSmoothingEnabled = false
      context.drawImage(image, 40, 40, 1120, 1120)
      const png = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Không tạo được ảnh PNG.')), 'image/png'))
      const link = document.createElement('a')
      link.href = URL.createObjectURL(png)
      link.download = `ma-qr-lo-${batch.ma_lo_hang}.png`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      onToast('Đã tải QR PNG độ phân giải cao. Bạn có thể đưa ảnh này vào phần mềm quét trên máy tính.')
    } catch (error) {
      onToast(error.message || 'Không thể tải mã QR.')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }
  return (
    <section className="detail-page container">
      <button className="back-button" onClick={onBack}>← <span>Quay lại nông sản</span></button>
      <div className="detail-layout">
        <div className="detail-visual"><span className="detail-produce">{product.hinh_anh ? <img src={product.hinh_anh} alt={product.ten_san_pham} /> : productEmoji(product)}</span><span className="image-note">{product.hinh_anh ? 'Ảnh sản phẩm tại vườn' : 'Hình minh họa nông sản'}</span></div>
        <div className="detail-content">
          <p className="eyebrow"><i /> {product.category?.ten_danh_muc || 'NÔNG SẢN THEO MÙA'}</p>
          <h1>{product.ten_san_pham}</h1><p className="detail-description">{product.mo_ta}</p>
          <strong className="detail-price">{money(product.gia_co_ban)} <small>/ {unit}</small></strong>
          <div className="batch-box"><div className="batch-heading"><span className="batch-icon">✳</span><div><b>Lô hàng đang bán</b><small>{batch ? `Mã lô #${batch.ma_lo_hang}` : 'Chưa có lô còn hàng'}</small></div><span className="available-pill">{batch ? 'ĐANG CÓ' : 'HẾT LÔ'}</span></div>
            <div className="batch-facts"><span><small>Ngày thu hoạch</small><b>{shortDate(batch?.ngay_thu_hoach)}</b></span><span><small>Hạn sử dụng</small><b>{shortDate(batch?.ngay_het_han)}</b></span><span><small>Còn lại</small><b>{batch?.so_luong_ton || 0} {unit}</b></span></div>
          </div>
          {batch && <div className="quantity-row"><span>Số lượng</span><div><button onClick={() => setQuantity(Math.max(step, quantity - step))}>−</button><b>{quantity} {unit}</b><button onClick={() => setQuantity(quantity + step)}>+</button></div></div>}
          <div className="detail-actions"><button className="primary-button" disabled={!batch || adding} onClick={add}>{adding ? 'Đang kiểm tra tồn kho…' : !batch ? 'Hết hàng' : `Thêm vào giỏ · ${money(product.gia_co_ban * quantity)}`}</button><button className="outline-button" onClick={onSubscribe}>Đặt gói định kỳ</button></div>
          <p className="small-assurance">✓ Số lô và hạn dùng hiển thị trước khi đặt hàng</p>
        </div>
      </div>
      <div className="trace-section"><div className="trace-title"><div><p className="eyebrow">TỪ ĐẤT ĐẾN BÀN ĂN</p><h2>Nhật ký canh tác</h2></div>{batch && <div className="product-qr"><img src={`${API}/farm/batches/${batch.ma_lo_hang}/qr`} alt={`QR truy xuất lô ${batch.ma_lo_hang}`} /><div className="product-qr-info"><span>Mã truy xuất <b>{String(batch.ma_qr || batch.ma_lo_hang || '').slice(0, 8).toUpperCase()}</b></span><button type="button" onClick={downloadQr}>Tải QR PNG</button></div></div>}</div>
        {timeline.length ? <div className="timeline">{timeline.map((item) => <article className="timeline-item" key={item.ma_nhat_ky}><span className="timeline-dot">✳</span><div className="timeline-card"><div><b>{item.hanh_dong}</b><time>{shortDate(item.thoi_gian)}</time></div><p>{item.ghi_chu}</p>{item.hinh_anh_minh_chung?.length > 0 && <div className="journal-media">{item.hinh_anh_minh_chung.map((file) => <EvidenceMedia key={file} path={file} alt="Minh chứng nhật ký canh tác" />)}</div>}</div></article>)}</div> : <div className="timeline-empty"><span>🌿</span><p>Nhật ký canh tác của lô sẽ được cập nhật tại đây.</p></div>}
        {batch && <button className="trace-link" onClick={() => onTrace(batch.ma_qr)}>Mở trang truy xuất nguồn gốc <span>↗</span></button>}
      </div>
    </section>
  )
}

function TracePage({ qr, onBack }) {
  const [batch, setBatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    request(`/trace/${encodeURIComponent(qr)}`).then((data) => { if (active) setBatch(data) }).catch((reason) => { if (active) setError(reason.message || 'Không tìm thấy thông tin lô hàng.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [qr])

  return <section className="trace-public-page container">
    <button className="back-button" onClick={onBack}>← <span>Quay lại</span></button>
    {loading && <div className="trace-public-message"><span>🌿</span><p>Đang tải hành trình của lô hàng...</p></div>}
    {!loading && error && <div className="trace-public-message"><span>🔎</span><h2>Chưa tìm thấy lô hàng</h2><p>{error}</p></div>}
    {!loading && batch && <>
      <header className="trace-public-hero"><p className="eyebrow"><i /> TRUY XUẤT TỪ VƯỜN</p><span className="trace-public-leaf">✳</span><h1>{batch.product?.ten_san_pham || 'Nông sản theo lô'}</h1><p>{batch.product?.category?.ten_danh_muc || 'Nông sản sạch'} · Mã lô #{batch.ma_lo_hang}</p><div className="trace-public-code">MÃ TRUY XUẤT <b>{String(batch.ma_qr || qr).toUpperCase()}</b></div></header>
      <div className="trace-public-facts"><article><small>Ngày thu hoạch</small><b>{shortDate(batch.ngay_thu_hoach)}</b></article><article><small>Hạn sử dụng</small><b>{shortDate(batch.ngay_het_han)}</b></article><article><small>Số lượng còn</small><b>{batch.so_luong_ton} {unitOf(batch.product)}</b></article><article><small>Hao hụt đã ghi nhận</small><b>{batch.so_luong_hao_hut || 0} {unitOf(batch.product)}</b></article></div>
      <div className="trace-section trace-public-journal"><div className="trace-title"><div><p className="eyebrow">HÀNH TRÌNH CHĂM SÓC</p><h2>Nhật ký canh tác</h2></div><span className="available-pill">ĐÃ GHI NHẬN {batch.logs?.length || 0} MỐC</span></div>
        {batch.logs?.length ? <div className="timeline">{batch.logs.map((item) => <article className="timeline-item" key={item.ma_nhat_ky}><span className="timeline-dot">✳</span><div className="timeline-card"><div><b>{item.hanh_dong}</b><time>{new Date(item.thoi_gian).toLocaleString('vi-VN')}</time></div>{item.ghi_chu && <p>{item.ghi_chu}</p>}{item.hinh_anh_minh_chung?.length > 0 && <div className="journal-media">{item.hinh_anh_minh_chung.map((file) => <EvidenceMedia key={file} path={file} alt="Ảnh hoặc video nhật ký canh tác" />)}</div>}</div></article>)}</div> : <div className="timeline-empty"><span>🌱</span><p>Nhật ký chăm sóc của lô này chưa được cập nhật.</p></div>}
      </div>
      <p className="trace-public-note">Thông tin được ghi nhận bởi nhân viên nông trại trong quá trình chăm sóc và quản lý lô hàng.</p>
    </>}
  </section>
}

function EvidenceMedia({ path, alt }) {
  const url = /^https?:\/\//i.test(path) ? path : `${API_ORIGIN}/storage/${path}`
  return /\.(mp4|mov|webm|ogg)(\?.*)?$/i.test(path)
    ? <video controls preload="metadata" aria-label={alt}><source src={url} /></video>
    : <img src={url} alt={alt} loading="lazy" />
}

function AuthModal({ onClose, onModeChange, onSubmit, busy, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setError('')
    const message = await onSubmit(new FormData(event.currentTarget))
    if (message) setError(message)
  }
  return <Modal title={mode === 'login' ? 'Chào bạn trở lại' : 'Tạo tài khoản mới'} onClose={onClose}>
    <form className="stack-form" onSubmit={submit} autoComplete="off">
      <input type="hidden" name="mode" value={mode} />
      {mode === 'register' && <label>Họ và tên<input name="ho_ten" required maxLength="100" autoComplete="name" placeholder="Tên của bạn" /></label>}
      <label>Email<input name="email" type="email" required autoComplete="off" placeholder="ban@email.com" /></label>
      <label>Mật khẩu<input name="mat_khau" type="password" required minLength="8" autoComplete="off" placeholder="Ít nhất 8 ký tự" /></label>
      {mode === 'register' && <label>Nhập lại mật khẩu<input name="mat_khau_confirmation" type="password" required minLength="8" autoComplete="new-password" /></label>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary-button wide" disabled={busy}>{busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
    </form>
    <p className="switch-auth">{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button onClick={() => { setError(''); const nextMode = mode === 'login' ? 'register' : 'login'; setMode(nextMode); onModeChange(nextMode) }}>{mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button></p>
  </Modal>
}

function CartModal({ cart, onUpdateCart, user, onClose, onLogin, onCheckout, onStartCheckout, onQuoteShipping, farmLocation, locationStatus, locationError, busy, initialCheckout = false }) {
  const [destination, setDestination] = useState({ province: '', district: '', ward: '', address: '' })
  const [provinces, setProvinces] = useState([])
  const [wards, setWards] = useState([])
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('')
  const [provinceOptionsLoading, setProvinceOptionsLoading] = useState(false)
  const [wardOptionsLoading, setWardOptionsLoading] = useState(false)
  const [addressOptionsError, setAddressOptionsError] = useState('')
  const [shippingQuote, setShippingQuote] = useState(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const checkout = initialCheckout
  const total = cart.reduce((sum, item) => sum + Number(item.product.gia_co_ban) * item.quantity, 0)
  const address = [destination.address, destination.ward, destination.district, destination.province].filter(Boolean).join(', ')
  function updateDestination(field, value) { setDestination((current) => ({ ...current, [field]: value })); setShippingQuote(null) }
  useEffect(() => {
    if (!checkout) return
    let active = true
    async function loadProvinces() {
      setProvinceOptionsLoading(true)
      try {
        const cached = JSON.parse(sessionStorage.getItem('vn-address-provinces-v2') || 'null')
        if (cached?.savedAt > Date.now() - 30 * 24 * 60 * 60 * 1000 && Array.isArray(cached.data)) {
          if (active) setProvinces(cached.data)
          return
        }
        const response = await fetch('https://provinces.open-api.vn/api/v2/?depth=1')
        if (!response.ok) throw new Error('Không tải được danh sách tỉnh/thành.')
        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('Danh sách tỉnh/thành không đúng định dạng.')
        sessionStorage.setItem('vn-address-provinces-v2', JSON.stringify({ savedAt: Date.now(), data }))
        if (active) setProvinces(data)
      } catch (error) {
        if (active) setAddressOptionsError(error.message || 'Không tải được danh sách địa chỉ.')
      } finally { if (active) setProvinceOptionsLoading(false) }
    }
    loadProvinces()
    return () => { active = false }
  }, [checkout])
  useEffect(() => {
    if (!checkout || !selectedProvinceCode) { setWards([]); return }
    let active = true
    async function loadWards() {
      setWardOptionsLoading(true); setAddressOptionsError('')
      try {
        const cacheKey = `vn-address-wards-v2:${selectedProvinceCode}`
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null')
        if (cached?.savedAt > Date.now() - 30 * 24 * 60 * 60 * 1000 && Array.isArray(cached.data)) {
          if (active) setWards(cached.data)
          return
        }
        const response = await fetch(`https://provinces.open-api.vn/api/v2/w/?province=${encodeURIComponent(selectedProvinceCode)}`)
        if (!response.ok) throw new Error('Không tải được danh sách phường/xã.')
        const data = await response.json()
        const wardList = Array.isArray(data) ? data : Array.isArray(data.wards) ? data.wards : []
        if (!wardList.length) throw new Error('Tỉnh/thành này chưa tải được danh sách phường/xã.')
        sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: wardList }))
        if (active) setWards(wardList)
      } catch (error) {
        if (active) setAddressOptionsError(error.message || 'Không tải được danh sách phường/xã.')
      } finally { if (active) setWardOptionsLoading(false) }
    }
    loadWards()
    return () => { active = false }
  }, [checkout, selectedProvinceCode])
  async function calculateShipping() {
    if (!destination.province.trim() || !destination.ward.trim() || !destination.address.trim()) { setQuoteError('Nhập địa chỉ, tỉnh/thành và phường/xã để tính phí GHTK.'); return }
    if (!farmLocation) { setQuoteError(locationError || 'Đang chờ vị trí thiết bị.'); return }
    setQuoteBusy(true); setQuoteError('')
    try { setShippingQuote(await onQuoteShipping(destination, { latitude: farmLocation.latitude, longitude: farmLocation.longitude })) }
    catch (error) { setQuoteError(error.message) }
    finally { setQuoteBusy(false) }
  }
  if (!cart.length) return <Modal title="Giỏ hàng" onClose={onClose}><div className="empty-cart"><span>🧺</span><p>Giỏ hàng đang trống. Chọn vài món tươi ngon từ vườn nhé.</p><button className="primary-button wide" onClick={onClose}>Tiếp tục mua sắm</button></div></Modal>
  if (checkout && user) return <Modal title="Thông tin giao hàng" onClose={onClose}>
    <form className="stack-form" onSubmit={(e) => { e.preventDefault(); if (!shippingQuote) { setQuoteError('Hãy tính phí giao hàng trước khi đặt.'); return } const form = new FormData(e.currentTarget); form.set('address', address); form.set('address_detail', destination.address); onCheckout(form) }}>
      <label>Địa chỉ / số nhà<input name="address_detail" required maxLength="250" value={destination.address} onChange={(event) => updateDestination('address', event.target.value)} placeholder="Ví dụ: 12 Nguyễn Huệ" /></label>
      <label>Tỉnh / thành phố<select required value={selectedProvinceCode} disabled={provinceOptionsLoading} onChange={(event) => { const selected = provinces.find((province) => String(province.code) === event.target.value); setSelectedProvinceCode(event.target.value); setWards([]); updateDestination('province', selected?.name || ''); updateDestination('district', ''); updateDestination('ward', '') }}><option value="">{provinceOptionsLoading && !provinces.length ? 'Đang tải tỉnh/thành…' : 'Chọn tỉnh/thành phố'}</option>{provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}</select><input type="hidden" name="province" value={destination.province} /></label>
      <label>Phường / xã<select name="ward" required value={destination.ward} onChange={(event) => updateDestination('ward', event.target.value)} disabled={!selectedProvinceCode || wardOptionsLoading || !wards.length}><option value="">{wardOptionsLoading ? 'Đang tải phường/xã…' : 'Chọn phường/xã'}</option>{wards.map((ward) => <option key={ward.code} value={ward.name}>{ward.name}</option>)}</select></label>
      <p className="fine-print">Địa chỉ hiện hành dùng tỉnh/thành và phường/xã; cấp quận/huyện đã được bỏ trong mô hình hành chính mới.</p>
      {addressOptionsError && <p className="inline-error" role="alert">{addressOptionsError} Kiểm tra Internet rồi tải lại trang.</p>}
      {locationStatus === 'loading' && <p className="fine-print">Đang tự lấy vị trí thiết bị…</p>}
      {locationStatus === 'error' && <p className="fine-print">{locationError}</p>}
      <button type="button" className="outline-button" onClick={calculateShipping} disabled={quoteBusy || locationStatus === 'loading' || !farmLocation || !destination.province.trim() || !destination.ward.trim() || !destination.address.trim() || Boolean(shippingQuote)}>{quoteBusy ? 'Đang tìm địa chỉ và tính khoảng cách…' : locationStatus === 'loading' ? 'Đang lấy vị trí thiết bị…' : shippingQuote ? 'Đã tính phí giao hàng' : 'Tính phí giao hàng theo khoảng cách'}</button>
      {quoteError && <p className="inline-error" role="alert">{quoteError}</p>}
      {shippingQuote && <p className="fine-print">Phí vận chuyển: <b>{money(shippingQuote.fee)}</b> · Khoảng cách ước tính {shippingQuote.distance_km} km · Đơn giá {money(shippingQuote.rate_per_km)}/km</p>}
      {shippingQuote && <input type="hidden" name="shipping_quote_token" value={shippingQuote.quote_token} />}
      <label>Phương thức thanh toán<select name="payment"><option value="cod">Thanh toán khi nhận hàng</option><option value="vnpay">VNPay (Sandbox)</option></select></label>
      <div className="checkout-total"><span>Tiền hàng + phí vận chuyển</span><b>{money(total + (shippingQuote?.fee || 0))}</b></div>
      <p className="fine-print">Thanh toán trực tuyến đang chờ cấu hình tài khoản cổng thanh toán.</p>
      <button className="primary-button wide" disabled={busy || !shippingQuote}>{busy ? 'Đang đặt hàng...' : 'Xác nhận đặt hàng'}</button>
    </form>
  </Modal>
  return <Modal title="Giỏ hàng của bạn" onClose={onClose}>
    <div className="cart-items">{cart.map((item) => { const step = quantityStep(item.product); const min = step; const unit = unitOf(item.product); return <div className="cart-item" key={item.product.ma_san_pham}><span className="cart-emoji">{item.product.hinh_anh ? <img src={item.product.hinh_anh} alt={item.product.ten_san_pham} onError={(event) => { event.currentTarget.remove(); event.currentTarget.parentElement.textContent = productEmoji(item.product) }} /> : productEmoji(item.product)}</span><div><b>{item.product.ten_san_pham}</b><small>{money(item.product.gia_co_ban)} / {unit}</small><div className="cart-stepper"><button disabled={busy} onClick={() => onUpdateCart(cart.map((row) => row === item ? { ...row, quantity: Math.max(min, unit === 'bao' ? Math.ceil(Number(row.quantity)) - 1 : Number(row.quantity) - step) } : row))}>−</button><span>{item.quantity} {unit}</span><button disabled={busy} onClick={() => onUpdateCart(cart.map((row) => row === item ? { ...row, quantity: unit === 'bao' ? Math.max(1, Math.ceil(Number(row.quantity))) + 1 : Number(row.quantity) + step } : row))}>+</button></div></div><b>{money(item.product.gia_co_ban * item.quantity)}</b></div> })}</div>
    <div className="checkout-total"><span>Tổng tạm tính</span><b>{money(total)}</b></div>
    {!user ? <button className="primary-button wide" onClick={onLogin}>Đăng nhập để đặt hàng</button> : <button className="primary-button wide" onClick={onStartCheckout}>Tiếp tục · Nhập địa chỉ giao</button>}
  </Modal>
}

function SubscriptionModal({ plans, token, onClose, onLogin, onToast }) {
  const [busy, setBusy] = useState(false)
  const [minDate] = useState(() => new Date().toISOString().slice(0, 10))
  async function submit(event) {
    event.preventDefault()
    if (!token) { onLogin(); return }
    const data = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const result = await request('/subscriptions', { token, method: 'POST', body: {
        ma_goi: Number(data.get('ma_goi')), ngay_bat_dau: data.get('ngay_bat_dau'), ngay_ket_thuc: data.get('ngay_ket_thuc'),
        ngay_giao_trong_tuan: data.getAll('days').map(Number),
      } })
      onToast(`Đã đăng ký gói. Tạo ${result.subscription.deliveries.length} lịch giao.`)
      onClose()
    } catch (error) { onToast(error.message) } finally { setBusy(false) }
  }
  return <Modal title="Rau tươi theo lịch của bạn" onClose={onClose}>
    {!plans.length ? <p className="form-note">Chưa có gói định kỳ. Hãy chạy dữ liệu mẫu hoặc thêm gói trong hệ thống.</p> : <form className="stack-form" onSubmit={submit}>
      <label>Chọn gói<select name="ma_goi">{plans.map((plan) => <option key={plan.ma_goi} value={plan.ma_goi}>{plan.ten_goi} · {money(plan.gia_goi)} / {plan.thoi_han_thang} tháng</option>)}</select></label>
      <div className="form-grid"><label>Bắt đầu<input type="date" name="ngay_bat_dau" required min={minDate} /></label><label>Kết thúc<input type="date" name="ngay_ket_thuc" required /></label></div>
      <fieldset className="weekday-picks"><legend>Ngày giao trong tuần</legend>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => <label key={day}><input type="checkbox" name="days" value={index} defaultChecked={index === 2 || index === 5} /><span>{day}</span></label>)}</fieldset>
      <button className="primary-button wide" disabled={busy}>{busy ? 'Đang lưu...' : 'Đăng ký lịch giao'}</button>
      <p className="fine-print">Bước thanh toán gói sẽ được kết nối sau khi cấu hình cổng thanh toán.</p>
    </form>}
  </Modal>
}

function StaffPage({ token, onToast, initialDialog = '', initialBatchId = '', onDialogOpen, onDialogClose }) {
  const [batches, setBatches] = useState([])
  const [losses, setLosses] = useState([])
  const [alerts, setAlerts] = useState([])
  const [alertDays, setAlertDays] = useState(2)
  const [products, setProducts] = useState([])
  const [batchProductId, setBatchProductId] = useState('')
  const [batchQuery, setBatchQuery] = useState('')
  const [lossQuery, setLossQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [todayLabel] = useState(() => new Date().toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' }))
  const dialog = initialDialog
  const selected = batches.find((item) => String(item.ma_lo_hang) === String(initialBatchId)) || null
  const visibleBatches = batches.filter((batch) => searchableText(batch.ma_lo_hang, batch.product?.ten_san_pham).includes(batchQuery.trim().toLocaleLowerCase('vi')))
  const visibleLosses = losses.filter((loss) => searchableText(loss.ma_lo_hang, loss.batch?.product?.ten_san_pham, loss.staff?.ho_ten, loss.ly_do).includes(lossQuery.trim().toLocaleLowerCase('vi')))
  const refresh = useCallback(() => {
    request('/farm/batches', { token }).then((data) => setBatches(data.data || [])).catch((error) => onToast(error.message))
    request('/farm/losses', { token }).then((data) => setLosses(data.data || [])).catch((error) => onToast(error.message))
    request('/farm/alerts', { token }).then((data) => { setAlerts(data.batches || []); setAlertDays(data.alert_days ?? 2) }).catch(() => {})
    request('/products').then((data) => setProducts(data.data || [])).catch(() => {})
  }, [token, onToast])
  useEffect(() => { refresh() }, [refresh])
  function openDialog(kind, batch = null) {
    onDialogOpen(kind, batch?.ma_lo_hang)
  }
  function closeDialog(replace = false) {
    onDialogClose(replace)
  }
  async function reportLoss(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      await request(`/farm/batches/${selected.ma_lo_hang}/losses`, { token, method: 'POST', body: form })
      onToast('Đã ghi nhận hao hụt và cập nhật tồn kho.')
      closeDialog(true)
      refresh()
    } catch (error) { onToast(error.message) } finally { setBusy(false) }
  }
  async function submitFarmForm(event, kind) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      if (kind === 'batch') {
        await request('/farm/batches', { token, method: 'POST', body: Object.fromEntries(form.entries()) })
        onToast('Đã tạo lô hàng. Mã truy xuất QR đã sẵn sàng.')
      } else if (kind === 'edit-batch') {
        await request(`/farm/batches/${selected.ma_lo_hang}`, { token, method: 'PUT', body: Object.fromEntries(form.entries()) })
        onToast('Đã cập nhật ngày của lô hàng.')
      } else {
        await request(`/farm/batches/${selected.ma_lo_hang}/logs`, { token, method: 'POST', body: form })
        onToast('Đã lưu nhật ký canh tác.')
      }
      closeDialog(true)
      refresh()
    } catch (error) { onToast(error.message) } finally { setBusy(false) }
  }
  return <section className="staff-page container">
    <div className="staff-heading"><div><p className="eyebrow"><i /> KHU VỰC NHÂN VIÊN NÔNG TRẠI</p><h1>Chào buổi sáng,<br /><em>mình kiểm tra vườn nhé.</em></h1></div><span className="staff-avatar">{todayLabel}</span></div>
    <div className="staff-stats"><div><span>Đang quản lý</span><b>{batches.length}</b><small>lô hàng</small></div><div className={alerts.length ? 'warning-stat' : ''}><span>Cần xử lý</span><b>{alerts.length}</b><small>lô sắp hết hạn</small></div></div>
    {alerts.length > 0 && <div className="alert-banner"><span>⚠</span><div><b>Có lô sắp đến hạn</b><small>{alerts.length} lô còn hạn trong {alertDays} ngày. Báo bộ phận bán hàng xử lý sớm.</small></div></div>}
    <div className="staff-section-title"><div><p className="eyebrow">TỒN KHO THEO LÔ</p><h2>Lô hàng trong vườn</h2></div><button className="add-button" onClick={() => openDialog('batch')}>+ Thêm lô</button></div>
    <label className="search-box list-search-box"><span>⌕</span><input value={batchQuery} onChange={(event) => setBatchQuery(event.target.value)} placeholder="Tìm theo tên sản phẩm hoặc mã lô..." /></label>
    <div className="batch-list">{visibleBatches.map((batch) => <article className="staff-batch" key={batch.ma_lo_hang}><div className="staff-batch-top"><span className="batch-icon">✳</span><div><b>{batch.product?.ten_san_pham}</b><small>Lô #{batch.ma_lo_hang} · Thu hoạch {shortDate(batch.ngay_thu_hoach)}</small></div><span className="batch-stock">{batch.so_luong_ton} {unitOf(batch.product)}</span></div><div className="staff-batch-foot"><span>Hạn dùng <b>{shortDate(batch.ngay_het_han)}</b></span><div className="batch-actions"><button onClick={() => openDialog('edit-batch', batch)}>Sửa ngày</button><button onClick={() => openDialog('journal', batch)}>+ Nhật ký</button><button onClick={() => openDialog('loss', batch)}>Ghi hao hụt <span>↗</span></button></div></div></article>)}
      {!visibleBatches.length && <div className="empty-state"><span>🌱</span><h3>{batches.length ? 'Không tìm thấy lô phù hợp' : 'Chưa có lô hàng'}</h3><p>{batches.length ? 'Thử từ khóa hoặc mã lô khác.' : 'Khi có lô hàng trong hệ thống, bạn có thể ghi nhận hao hụt tại đây.'}</p></div>}
    </div>
    <div className="staff-section-title loss-history-heading"><div><p className="eyebrow">PHIẾU ĐÃ GHI NHẬN</p><h2>Lịch sử hao hụt</h2></div><span>{losses.length} phiếu gần đây</span></div>
    <label className="search-box list-search-box"><span>⌕</span><input value={lossQuery} onChange={(event) => setLossQuery(event.target.value)} placeholder="Tìm theo sản phẩm, mã lô, lý do..." /></label>
    <div className="loss-history-list">{visibleLosses.map((loss) => <article className="loss-history-card" key={loss.ma_phieu_hao_hut}><div className="loss-history-top"><span className="loss-history-icon">↘</span><div><b>{loss.batch?.product?.ten_san_pham || 'Sản phẩm'} · Lô #{loss.ma_lo_hang}</b><small>{loss.staff?.ho_ten || 'Nhân viên'} · {new Date(loss.ngay_ghi_nhan).toLocaleString('vi-VN')}</small></div><strong>{loss.so_luong} {unitOf(loss.batch?.product)}</strong></div><p><b>Lý do:</b> {loss.ly_do}</p>{loss.hinh_anh_minh_chung?.length > 0 && <div className="loss-evidence">{loss.hinh_anh_minh_chung.map((path) => { const url = lossEvidenceUrl(path); return <a key={path} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Ảnh minh chứng hao hụt" loading="lazy" /></a> })}</div>}</article>)}
      {!visibleLosses.length && <div className="admin-empty"><span>🌱</span><p>{losses.length ? 'Không tìm thấy phiếu phù hợp.' : 'Chưa có phiếu hao hụt nào được ghi nhận.'}</p></div>}
    </div>
    {dialog === 'loss' && selected && <Modal title={`Ghi hao hụt · Lô #${selected.ma_lo_hang}`} onClose={() => closeDialog()}>
      <form className="stack-form" onSubmit={reportLoss}>
        <p className="stock-hint">{selected.product?.ten_san_pham} · Hiện còn <b>{selected.so_luong_ton} {unitOf(selected.product)}</b></p>
        <label>Số lượng hư hỏng<input name="so_luong" type="number" min={quantityStep(selected.product)} max={selected.so_luong_ton} step={quantityStep(selected.product)} required placeholder={unitOf(selected.product) === 'bao' ? 'Ví dụ: 1' : 'Ví dụ: 0.5'} /></label>
        <label>Lý do<input name="ly_do" required maxLength="255" placeholder="Dập nát, úng, sâu bệnh..." /></label>
        <label>Ảnh hiện trạng<input name="evidence[]" type="file" accept="image/*" capture="environment" multiple /></label>
        <p className="fine-print">Trên điện thoại, nút ảnh sẽ mở camera để chụp tình trạng nông sản.</p>
        <button className="danger-button wide" disabled={busy}>{busy ? 'Đang lưu...' : 'Xác nhận xuất hủy'}</button>
      </form>
    </Modal>}
    {dialog === 'journal' && selected && <Modal title={`Nhật ký canh tác · Lô #${selected.ma_lo_hang}`} onClose={() => closeDialog()}>
      <form className="stack-form" onSubmit={(event) => submitFarmForm(event, 'journal')}>
        <label>Hoạt động<input name="hanh_dong" required maxLength="150" placeholder="Tưới nước, bón phân, thu hoạch..." /></label>
        <label>Ghi chú<textarea name="ghi_chu" rows="3" placeholder="Ghi thêm thông tin về hoạt động" /></label>
        <label>Ảnh / video minh chứng<input name="evidence[]" type="file" accept="image/*,video/mp4,video/quicktime" capture="environment" multiple /></label>
        <button className="primary-button wide" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu nhật ký'}</button>
      </form>
    </Modal>}
    {dialog === 'batch' && <Modal title="Tạo lô hàng mới" onClose={() => closeDialog()}>
      <form className="stack-form" onSubmit={(event) => submitFarmForm(event, 'batch')}>
        <label>Sản phẩm<select name="ma_san_pham" required value={batchProductId || products[0]?.ma_san_pham || ''} onChange={(event) => setBatchProductId(event.target.value)}>{products.map((product) => <option key={product.ma_san_pham} value={product.ma_san_pham}>{product.ten_san_pham}</option>)}</select></label>
        <div className="form-grid"><label>Ngày thu hoạch<input name="ngay_thu_hoach" type="date" required /></label><label>Hạn sử dụng<input name="ngay_het_han" type="date" required /></label></div>
        <label>Số lượng nhập ({unitOf(products.find((product) => String(product.ma_san_pham) === String(batchProductId || products[0]?.ma_san_pham)))} )<input name="so_luong_nhap" type="number" min={unitOf(products.find((product) => String(product.ma_san_pham) === String(batchProductId || products[0]?.ma_san_pham))) === 'bao' ? 1 : 0.1} step={unitOf(products.find((product) => String(product.ma_san_pham) === String(batchProductId || products[0]?.ma_san_pham))) === 'bao' ? 1 : 0.1} required placeholder={unitOf(products.find((product) => String(product.ma_san_pham) === String(batchProductId || products[0]?.ma_san_pham))) === 'bao' ? 'Ví dụ: 20 bao' : 'Ví dụ: 20 kg'} /></label>
        <button className="primary-button wide" disabled={busy || !products.length}>{busy ? 'Đang tạo...' : 'Tạo lô và mã QR'}</button>
      </form>
    </Modal>}
    {dialog === 'edit-batch' && selected && <Modal title={`Sửa ngày lô #${selected.ma_lo_hang}`} onClose={() => closeDialog()}>
      <form className="stack-form" onSubmit={(event) => submitFarmForm(event, 'edit-batch')}>
        <p className="stock-hint">{selected.product?.ten_san_pham} · Còn {selected.so_luong_ton} {unitOf(selected.product)}</p>
        <div className="form-grid"><label>Ngày thu hoạch<input name="ngay_thu_hoach" type="date" required defaultValue={selected.ngay_thu_hoach?.slice(0, 10)} /></label><label>Hạn sử dụng<input name="ngay_het_han" type="date" required min={selected.ngay_thu_hoach?.slice(0, 10)} defaultValue={selected.ngay_het_han?.slice(0, 10)} /></label></div>
        <button className="primary-button wide" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu ngày lô hàng'}</button>
      </form>
    </Modal>}
  </section>
}

function OrdersPage({ token, onToast, onLogin }) {
  const [orders, setOrders] = useState([])
  const [orderQuery, setOrderQuery] = useState('')
  const [loading, setLoading] = useState(Boolean(token))
  const [complaintOrder, setComplaintOrder] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const visibleOrders = orders.filter((order) => searchableText(order.ma_don_hang, orderStatusLabel(order.trang_thai), ...(order.items || []).map((item) => item.batch?.product?.ten_san_pham)).includes(orderQuery.trim().toLocaleLowerCase('vi')))
  async function openOrderDetails(orderId) {
    setDetailOrder({ ma_don_hang: orderId })
    setDetailLoading(true)
    try {
      const data = await request(`/orders/${orderId}`, { token })
      setDetailOrder(data.order || data)
    } catch (error) {
      setDetailOrder(null)
      onToast(error.message)
    } finally { setDetailLoading(false) }
  }
  async function cancelOrder(order) {
    if (!window.confirm(`Bạn muốn hủy đơn hàng #${order.ma_don_hang}?`)) return
    try {
      await request(`/orders/${order.ma_don_hang}/cancel`, { token, method: 'PATCH' })
      setOrders((rows) => rows.map((row) => row.ma_don_hang === order.ma_don_hang ? { ...row, trang_thai: 'cancelled' } : row))
      onToast(`Đã hủy đơn hàng #${order.ma_don_hang}. Tồn kho đã được hoàn lại.`)
    } catch (error) { onToast(error.message) }
  }
  useEffect(() => {
    if (!token) return
    request('/orders', { token }).then((data) => setOrders(data.data || [])).catch((error) => onToast(error.message)).finally(() => setLoading(false))
  }, [token, onToast])
  return <section className="orders-page container"><p className="eyebrow"><i /> HÀNH TRÌNH ĐƠN HÀNG</p><h1>Đơn hàng <em>của bạn</em></h1>
    {!token && <div className="empty-state"><span>📦</span><h3>Đăng nhập để xem đơn hàng</h3><p>Thông tin mua sắm của bạn được lưu an toàn trong tài khoản.</p><button className="primary-button" onClick={onLogin}>Đăng nhập</button></div>}
    {loading && <p className="form-note">Đang tải đơn hàng...</p>}
    {!loading && token && !orders.length && <div className="empty-state"><span>🧺</span><h3>Chưa có đơn hàng nào</h3><p>Khi đặt mua nông sản, hành trình đơn hàng sẽ xuất hiện tại đây.</p></div>}
    {token && orders.length > 0 && <label className="search-box list-search-box"><span>⌕</span><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Tìm theo mã đơn, sản phẩm hoặc trạng thái..." /></label>}
    {token && <div className="orders-list">{visibleOrders.map((order) => {
      const complaint = order.complaints?.[0]
      const complaintLabel = ({ pending: 'Đang chờ xử lý', approved: 'Đã chấp nhận', rejected: 'Đã từ chối', refunded: 'Đã hoàn tiền', replacement: 'Đã đổi sản phẩm' })[complaint?.trang_thai] || complaint?.trang_thai
      return <article className="order-card" key={order.ma_don_hang}>
        <div className="order-top"><b>Đơn #{order.ma_don_hang}</b><span className={`order-status status-${order.trang_thai}`}>{orderStatusLabel(order.trang_thai)}</span></div>
        <p>{order.items?.map((item) => `${item.batch?.product?.ten_san_pham} · ${item.so_luong} ${unitOf(item.batch?.product)}`).join(' / ')}</p>
        <div className="order-bottom"><span>{shortDate(order.ngay_tao)}</span><b>{money(order.tong_tien)}</b></div>
        <div className="order-card-actions">
          <button className="order-details-button" onClick={() => openOrderDetails(order.ma_don_hang)}>Xem chi tiết đơn hàng</button>
          {complaint
            ? <button className="complaint-link" onClick={() => openOrderDetails(order.ma_don_hang)}>Khiếu nại · {complaintLabel}</button>
            : order.trang_thai === 'delivered' && <button className="complaint-link" onClick={() => setComplaintOrder(order)}>Gửi khiếu nại</button>}
          {order.trang_thai === 'pending' && (order.payments?.some((payment) => payment.trang_thai === 'paid')
            ? <button className="order-cancel-button order-cancel-disabled" disabled title="Đơn đã thanh toán, vui lòng liên hệ Admin">Đã thanh toán · liên hệ Admin</button>
            : <button className="order-cancel-button" onClick={() => cancelOrder(order)}>Hủy đơn</button>)}
        </div>
      </article>
    })}{!visibleOrders.length && orders.length > 0 && <div className="empty-state"><span>⌕</span><h3>Không tìm thấy đơn hàng</h3><p>Thử nhập mã đơn, tên sản phẩm hoặc trạng thái khác.</p></div>}</div>}
    {detailOrder && <OrderDetailsModal order={detailOrder} token={token} loading={detailLoading} onClose={() => setDetailOrder(null)} onComplaint={(order) => { setDetailOrder(null); setComplaintOrder(order) }} />}
    {complaintOrder && <ComplaintModal order={complaintOrder} token={token} onClose={() => setComplaintOrder(null)} onSubmitted={(complaint) => setOrders((rows) => rows.map((row) => row.ma_don_hang === complaint.ma_don_hang ? { ...row, complaints: [complaint] } : row))} onToast={onToast} />}
  </section>
}

function orderStatusLabel(status) {
  return ({ pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', shipped: 'Đang giao', delivered: 'Đã hoàn thành đơn hàng', cancelled: 'Đã hủy' })[status] || status || 'Đang cập nhật'
}

function OrderDetailsModal({ order, token, loading, onClose, onComplaint }) {
  const items = order.items || []
  const complaint = order.complaints?.[0]
  const subtotal = items.reduce((sum, item) => sum + Number(item.so_luong || 0) * Number(item.don_gia || 0), 0)
  const paymentLabels = { cod: 'Thanh toán khi nhận hàng', bank_transfer: 'Chuyển khoản', vnpay: 'VNPay', momo: 'MoMo' }
  return <Modal title={`Chi tiết đơn hàng #${order.ma_don_hang}`} onClose={onClose}>
    {loading ? <p className="form-note">Đang tải chi tiết đơn hàng…</p> : <div className="order-detail-content">
      <div className="order-detail-status"><span>Trạng thái đơn hàng</span><b className={`order-status status-${order.trang_thai}`}>{orderStatusLabel(order.trang_thai)}</b></div>
      <p className="order-detail-date">Đặt lúc {order.ngay_tao ? new Date(order.ngay_tao).toLocaleString('vi-VN') : 'Đang cập nhật'}</p>
      <h3>Sản phẩm</h3>
      <div className="order-detail-items">{items.map((item) => <article key={item.ma_chi_tiet}>
        <div><b>{item.batch?.product?.ten_san_pham || 'Sản phẩm'}</b><small>Lô #{item.ma_lo_hang} · {money(item.don_gia)} / {unitOf(item.batch?.product)}</small></div>
        <span>{item.so_luong} {unitOf(item.batch?.product)}</span><strong>{money(Number(item.so_luong) * Number(item.don_gia))}</strong>
      </article>)}{!items.length && <p className="form-note">Đơn hàng chưa có chi tiết sản phẩm.</p>}</div>
      <div className="order-detail-totals"><p><span>Tiền hàng</span><b>{money(subtotal)}</b></p><p><span>Phí vận chuyển</span><b>{money(order.phi_giao_hang)}</b></p><p className="order-grand-total"><span>Tổng thanh toán</span><b>{money(order.tong_tien)}</b></p></div>
      <h3>Giao hàng & thanh toán</h3>
      <div className="order-detail-info"><p><span>Địa chỉ nhận</span><b>{order.dia_chi_giao_hang || 'Chưa có thông tin'}</b></p><p><span>Phương thức</span><b>{paymentLabels[order.phuong_thuc_thanh_toan] || order.phuong_thuc_thanh_toan || 'Chưa có thông tin'}</b></p><p><span>Thanh toán</span><b>{order.payments?.[0]?.trang_thai || 'Chờ xác nhận'}</b></p>{order.ngay_giao_thuc_te && <p><span>Ngày giao</span><b>{new Date(order.ngay_giao_thuc_te).toLocaleString('vi-VN')}</b></p>}</div>
      {complaint ? <div className="order-complaint-action"><h3>Yêu cầu khiếu nại</h3><p><b>Trạng thái:</b> {({ pending: 'Đang chờ xử lý', approved: 'Đã chấp nhận', rejected: 'Đã từ chối', refunded: 'Đã hoàn tiền', replacement: 'Đã đổi sản phẩm' })[complaint.trang_thai] || complaint.trang_thai}</p><p><b>Lý do:</b> {complaint.ly_do}</p>{complaint.ket_qua_xu_ly && <p><b>Kết quả:</b> {complaint.ket_qua_xu_ly}</p>}<EvidenceGallery token={token} complaint={complaint} /></div> : order.trang_thai === 'delivered' && <div className="order-complaint-action"><p className="fine-print">Sản phẩm có vấn đề? Gửi yêu cầu kèm ảnh minh chứng trong vòng 24 giờ sau khi nhận hàng.</p><button className="outline-button" onClick={() => onComplaint(order)}>Gửi yêu cầu khiếu nại</button></div>}
    </div>}
  </Modal>
}

function ComplaintModal({ order, token, onClose, onSubmitted, onToast }) {
  const [busy, setBusy] = useState(false)
  const [evidenceError, setEvidenceError] = useState('')
  function validateEvidence(files) {
    const selected = Array.from(files || [])
    if (!selected.length) return 'Vui lòng chọn ít nhất một ảnh JPG hoặc PNG.'
    if (selected.some((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return !['jpg', 'png'].includes(extension) || (file.type && !['image/jpeg', 'image/png'].includes(file.type))
    })) return 'Chỉ nhận tệp có đuôi .jpg hoặc .png.'
    if (selected.some((file) => file.size >= 5 * 1024 * 1024)) return 'Mỗi ảnh phải nhỏ hơn 5 MB.'
    return ''
  }
  async function submit(event) {
    event.preventDefault()
    const fileError = validateEvidence(event.currentTarget.elements.namedItem('evidence[]').files)
    setEvidenceError(fileError)
    if (fileError) return
    setBusy(true)
    try {
      const result = await request(`/orders/${order.ma_don_hang}/complaints`, { token, method: 'POST', body: new FormData(event.currentTarget) })
      onSubmitted?.(result.complaint)
      onToast('Đã gửi khiếu nại kèm minh chứng cho bộ phận chăm sóc khách hàng.')
      onClose()
    } catch (error) { onToast(error.message) } finally { setBusy(false) }
  }
  return <Modal title={`Khiếu nại đơn #${order.ma_don_hang}`} onClose={onClose}><form className="stack-form" onSubmit={submit}>
    <label>Lý do<input name="ly_do" required maxLength="255" placeholder="Sản phẩm bị dập nát, hư hỏng..." /></label>
    <label>Ảnh minh chứng (JPG/PNG, dưới 5 MB)<input name="evidence[]" type="file" accept=".jpg,.png,image/jpeg,image/png" capture="environment" required multiple onChange={(event) => setEvidenceError(validateEvidence(event.currentTarget.files))} /></label>
    {evidenceError && <p className="inline-error" role="alert">{evidenceError}</p>}
    <p className="fine-print">Bạn có thể gửi khiếu nại trong 24 giờ từ khi nhận đơn.</p>
    <button className="primary-button wide" disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi khiếu nại'}</button>
  </form></Modal>
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Đóng">×</button></div>{children}</section></div>
}

export default App
