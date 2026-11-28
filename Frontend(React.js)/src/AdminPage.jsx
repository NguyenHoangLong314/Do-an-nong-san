import { useCallback, useEffect, useState } from 'react'
import { API, request } from './api'

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
const date = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : '—'
const unitForCategory = (category) => category?.ten_danh_muc?.toLocaleLowerCase('vi').includes('phân bón') ? 'bao' : 'kg'
const unitOf = (product) => product?.category ? unitForCategory(product.category) : product?.don_vi_tinh || 'kg'
const lossEvidenceUrl = (path) => `${API}/farm/loss-evidence/${String(path || '').split('/').map(encodeURIComponent).join('/')}`
const roles = ['Customer', 'Staff', 'Sales', 'Admin']
const orderTransitions = {
  pending: [['confirmed', 'Xác nhận'], ['cancelled', 'Hủy đơn']],
  confirmed: [['preparing', 'Soạn hàng'], ['cancelled', 'Hủy đơn']],
  preparing: [['shipped', 'Bàn giao vận chuyển'], ['cancelled', 'Hủy đơn']],
  shipped: [['delivered', 'Đã giao']],
}
const tabs = [
  ['overview', 'Tổng quan', '▦'], ['orders', 'Đơn hàng', '▣'], ['products', 'Sản phẩm', '✳'], ['categories', 'Danh mục', '▤'],
  ['people', 'Nhân sự & quyền', '♙'], ['reports', 'Báo cáo', '▥'], ['losses', 'Hao hụt', '↘'], ['settings', 'Cảnh báo', '⚙'],
]

export default function AdminPage({ token, onToast, initialTab = 'overview', onTabChange }) {
  const [tab, setTab] = useState(initialTab)
  const [overview, setOverview] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [losses, setLosses] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderDetailLoading, setOrderDetailLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [settings, setSettings] = useState(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [categoryForm, setCategoryForm] = useState(null)
  const [productForm, setProductForm] = useState(null)
  const [employeeForm, setEmployeeForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadOverview = useCallback(async () => { setOverview(await request('/admin/overview', { token })) }, [token])
  const loadCategories = useCallback(async () => { setCategories(await request('/admin/categories', { token })) }, [token])
  const loadProducts = useCallback(async () => { setProducts(await request('/admin/products', { token })) }, [token])
  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (roleFilter) params.set('vai_tro', roleFilter)
    const result = await request(`/admin/users?${params}`, { token })
    setUsers(result.data || [])
  }, [query, roleFilter, token])
  const loadOrders = useCallback(async () => { const result = await request('/orders', { token }); setOrders(result.data || []) }, [token])

  useEffect(() => {
    let active = true
    const tasks = {
      overview: loadOverview,
      orders: loadOrders,
      products: async () => { const [productRows, categoryRows] = await Promise.all([request('/admin/products', { token }), request('/admin/categories', { token })]); if (active) { setProducts(productRows); setCategories(categoryRows) } },
      categories: loadCategories,
      people: loadUsers,
      reports: async () => setReport(await request('/admin/reports', { token })),
      losses: async () => { const result = await request('/farm/losses', { token }); setLosses(result.data || []) },
      settings: async () => setSettings(await request('/admin/settings', { token })),
    }
    Promise.resolve(tasks[tab]()).catch((error) => { if (active) onToast(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tab, token, query, roleFilter, loadOverview, loadCategories, loadUsers, loadOrders, onToast])

  const refreshOverview = useCallback(async () => {
    try { await loadOverview() } catch (error) { onToast(error.message) }
  }, [loadOverview, onToast])

  async function saveCategory(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    try {
      await request(categoryForm?.ma_danh_muc ? `/admin/categories/${categoryForm.ma_danh_muc}` : '/admin/categories', { token, method: categoryForm?.ma_danh_muc ? 'PUT' : 'POST', body })
      setCategoryForm(null)
      await loadCategories()
      await refreshOverview()
      window.dispatchEvent(new Event('catalog-updated'))
      onToast('Đã lưu danh mục.')
    } catch (error) { onToast(error.message) }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Xóa danh mục “${category.ten_danh_muc}”?`)) return
    try { await request(`/admin/categories/${category.ma_danh_muc}`, { token, method: 'DELETE' }); await loadCategories(); await refreshOverview(); window.dispatchEvent(new Event('catalog-updated')); onToast('Đã xóa danh mục.') }
    catch (error) { onToast(error.message) }
  }

  async function saveProduct(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    body.ma_danh_muc = Number(body.ma_danh_muc)
    body.don_vi_tinh = unitForCategory(categories.find((item) => Number(item.ma_danh_muc) === body.ma_danh_muc))
    body.gia_co_ban = Number(body.gia_co_ban)
    body.trong_luong_don_vi_kg = body.don_vi_tinh === 'bao' ? Number(body.trong_luong_don_vi_kg) : 1
    try {
      await request(productForm?.ma_san_pham ? `/admin/products/${productForm.ma_san_pham}` : '/admin/products', { token, method: productForm?.ma_san_pham ? 'PUT' : 'POST', body })
      setProductForm(null)
      await loadProducts()
      await refreshOverview()
      window.dispatchEvent(new Event('catalog-updated'))
      onToast('Đã lưu sản phẩm.')
    } catch (error) { onToast(error.message) }
  }

  async function toggleProduct(product) {
    try {
      await request(`/admin/products/${product.ma_san_pham}`, { token, method: 'PUT', body: {
        ma_danh_muc: product.ma_danh_muc, ten_san_pham: product.ten_san_pham, mo_ta: product.mo_ta || '',
        hinh_anh: product.hinh_anh || '', gia_co_ban: Number(product.gia_co_ban),
        trang_thai: product.trang_thai === 'active' ? 'inactive' : 'active',
      } })
      await loadProducts()
      window.dispatchEvent(new Event('catalog-updated'))
      onToast(product.trang_thai === 'active' ? 'Đã ngừng bán sản phẩm.' : 'Sản phẩm đã được mở bán.')
    } catch (error) { onToast(error.message) }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Xóa sản phẩm “${product.ten_san_pham}”? Thao tác này chỉ thực hiện được khi sản phẩm chưa có lô hàng.`)) return
    try {
      await request(`/admin/products/${product.ma_san_pham}`, { token, method: 'DELETE' })
      await loadProducts()
      await refreshOverview()
      window.dispatchEvent(new Event('catalog-updated'))
      onToast('Đã xóa sản phẩm.')
    } catch (error) { onToast(error.message) }
  }

  async function changeRole(user, vai_tro) {
    try {
      await request(`/admin/users/${user.ma_nguoi_dung}/role`, { token, method: 'PATCH', body: { vai_tro } })
      await loadUsers()
      await refreshOverview()
      onToast(`Đã cập nhật quyền cho ${user.ho_ten}.`)
    } catch (error) { onToast(error.message); await loadUsers() }
  }

  async function createEmployee(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      await request('/admin/users', { token, method: 'POST', body })
      setEmployeeForm(false)
      setQuery('')
      setRoleFilter('')
      const usersResult = await request('/admin/users', { token })
      setUsers(usersResult.data || [])
      await refreshOverview()
      onToast('Đã tạo tài khoản nhân viên. Hãy gửi email và mật khẩu ban đầu cho nhân viên đó.')
    } catch (error) { onToast(error.message) }
  }

  async function changeOrderStatus(order, status) {
    try {
      await request(`/orders/${order.ma_don_hang}/status`, { token, method: 'PATCH', body: { trang_thai: status } })
      await loadOrders()
      await refreshOverview()
      onToast(`Đã cập nhật đơn #${order.ma_don_hang}.`)
    } catch (error) { onToast(error.message) }
  }

  async function openOrderDetails(orderId) {
    setSelectedOrder({ ma_don_hang: orderId })
    setOrderDetailLoading(true)
    try {
      const result = await request(`/orders/${orderId}`, { token })
      setSelectedOrder(result.order || result)
    } catch (error) {
      setSelectedOrder(null)
      onToast(error.message)
    } finally { setOrderDetailLoading(false) }
  }

  async function saveSettings(event) {
    event.preventDefault()
    try {
      const data = await request('/admin/settings', { token, method: 'PUT', body: { so_ngay_canh_bao_xa_hang: Number(settings.so_ngay_canh_bao_xa_hang) } })
      setSettings(data)
      await refreshOverview()
      onToast('Đã lưu cấu hình cảnh báo.')
    } catch (error) { onToast(error.message) }
  }

  return <section className="admin-page container">
    <header className="admin-heading"><div><p className="eyebrow"><i /> KHÔNG GIAN QUẢN TRỊ</p><h1>Chào bạn,<br /><em>cùng chăm vườn lành.</em></h1></div><span className="admin-mark">ADMIN<br />NÔNG TRẠI</span></header>
    <nav className="admin-tabs" aria-label="Khu vực quản trị">{tabs.map(([key, label, icon]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => { setLoading(true); setTab(key); setProductForm(null); setCategoryForm(null); onTabChange?.(key) }}><span>{icon}</span>{label}</button>)}</nav>
    {loading && <p className="admin-loading">Đang tải dữ liệu quản trị...</p>}

    {tab === 'overview' && <>
      <div className="admin-intro"><div><p className="eyebrow">BẢNG ĐIỀU KHIỂN</p><h2>Tình hình hệ thống</h2></div><button className="admin-refresh" onClick={refreshOverview}>↻ Làm mới</button></div>
      <div className="admin-metrics">
        <Metric label="Danh mục" value={overview?.categories} hint="nhóm nông sản" icon="▤" />
        <Metric label="Sản phẩm đang bán" value={`${overview?.active_products ?? '—'} / ${overview?.products ?? '—'}`} hint="sản phẩm hoạt động" icon="✳" />
        <Metric label="Tài khoản" value={overview?.users} hint={`${overview?.staff ?? 0} nhân viên`} icon="♙" />
        <Metric label="Đơn cần xử lý" value={overview?.pending_orders} hint={`${overview?.orders ?? 0} đơn tổng cộng`} icon="▣" />
        <Metric label="Doanh thu ghi nhận" value={money(overview?.revenue)} hint="không tính đơn đã hủy" icon="↗" />
        <Metric label="Lô sắp xả hàng" value={overview?.expiring_batches} hint={`hết hạn trong ${overview?.alert_days ?? 2} ngày`} icon="⚠" warn={overview?.expiring_batches > 0} />
      </div>
      <div className="admin-note"><span>✳</span><div><b>Quản lý từ vườn đến bàn ăn</b><p>Điều phối danh mục, sản phẩm, nhân sự và theo dõi hoạt động bán hàng tại một nơi.</p></div></div>
    </>}

    {tab === 'products' && <>
      <AdminSection title="Danh mục sản phẩm" action={<button className="primary-button admin-add" onClick={() => setProductForm({})}>+ Thêm sản phẩm</button>} />
      {productForm && <form key={productForm.ma_san_pham || 'new-product'} className="admin-editor" onSubmit={saveProduct}>
        <div className="admin-editor-heading"><b>{productForm.ma_san_pham ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</b><button type="button" onClick={() => setProductForm(null)}>Đóng</button></div>
        <label>Tên sản phẩm<input name="ten_san_pham" required maxLength="150" defaultValue={productForm.ten_san_pham || ''} placeholder="Ví dụ: Cà chua bi" /></label>
        <label>Danh mục<select name="ma_danh_muc" required defaultValue={productForm.ma_danh_muc || categories[0]?.ma_danh_muc || ''} onChange={(event) => setProductForm((current) => ({ ...current, ma_danh_muc: Number(event.target.value) }))}>{categories.map((item) => <option key={item.ma_danh_muc} value={item.ma_danh_muc}>{item.ten_danh_muc}</option>)}</select></label>
        {(() => { const category = categories.find((item) => String(item.ma_danh_muc) === String(productForm.ma_danh_muc || categories[0]?.ma_danh_muc)); const unit = unitForCategory(category); return <>
          <input type="hidden" name="don_vi_tinh" value={unit} />
          <div className="form-grid"><label>Đơn vị bán<input value={unit === 'bao' ? 'Bao' : 'Kilogram (kg)'} readOnly /></label><label>Giá bán (₫/{unit})<input name="gia_co_ban" type="number" min="1" step="any" required defaultValue={productForm.gia_co_ban || ''} /></label></div>
          {unit === 'bao' && <label>Khối lượng mỗi bao (kg)<input name="trong_luong_don_vi_kg" type="number" min="0.01" max="1000" step="0.01" required defaultValue={productForm.trong_luong_don_vi_kg || ''} placeholder="Ví dụ: 25" /><small>Dùng để quy đổi trọng lượng khi tính vận chuyển.</small></label>}
        </> })()}
        <label>Trạng thái<select name="trang_thai" defaultValue={productForm.trang_thai || 'active'}><option value="active">Đang bán</option><option value="inactive">Ngừng bán</option></select></label>
        <label>Đường dẫn ảnh trực tiếp<input name="hinh_anh" type="url" maxLength="2048" defaultValue={productForm.hinh_anh || ''} placeholder="https://.../anh-san-pham.jpg" onInvalid={(event) => { const input = event.currentTarget; input.setCustomValidity(input.validity.tooLong ? 'Link ảnh quá dài (tối đa 2.048 ký tự).' : 'Link ảnh không hợp lệ. Hãy nhập đường dẫn trực tiếp đến ảnh.') }} onInput={(event) => event.currentTarget.setCustomValidity('')} onPaste={(event) => { if (event.clipboardData.getData('text').length > 2048) { event.preventDefault(); onToast('Link ảnh quá dài (tối đa 2.048 ký tự).') } }} /></label>
        <label>Mô tả<textarea name="mo_ta" rows="3" defaultValue={productForm.mo_ta || ''} placeholder="Mô tả ngắn về sản phẩm" /></label>
        <button className="primary-button wide">Lưu sản phẩm</button>
      </form>}
      <div className="admin-card-list">{products.map((product) => <article className="admin-product-card" key={product.ma_san_pham}><div className="admin-product-icon">{product.hinh_anh ? <img src={product.hinh_anh} alt="" /> : '🥬'}</div><div className="admin-product-info"><div className="admin-row-title"><b>{product.ten_san_pham}</b><span className={`admin-status ${product.trang_thai === 'active' ? 'good' : ''}`}>{product.trang_thai === 'active' ? 'Đang bán' : 'Ngừng bán'}</span></div><p>{product.category?.ten_danh_muc || 'Chưa phân loại'} · {product.ton_kho ?? 0} {unitOf(product)} trong kho</p><strong>{money(product.gia_co_ban)} / {unitOf(product)}</strong><div className="admin-actions"><button onClick={() => setProductForm(product)}>Sửa thông tin</button><button onClick={() => toggleProduct(product)}>{product.trang_thai === 'active' ? 'Ngừng bán' : 'Mở bán'}</button><button className="text-danger" onClick={() => deleteProduct(product)}>Xóa</button></div></div></article>)}{!products.length && <EmptyAdmin text="Chưa có sản phẩm. Hãy thêm sản phẩm đầu tiên." />}</div>
    </>}

    {tab === 'orders' && <>
      <AdminSection title="Theo dõi & xử lý đơn hàng" />
      <div className="admin-card-list">{orders.map((order) => <article className="admin-order-card" key={order.ma_don_hang}><div className="admin-row-title"><b>Đơn hàng #{order.ma_don_hang}</b><span className={`order-status status-${order.trang_thai}`}>{adminOrderStatusLabel(order.trang_thai)}</span></div><p>{order.customer?.ho_ten || `Tài khoản #${order.ma_nguoi_dung}`} · {date(order.ngay_tao)}</p><p>{order.items?.map((item) => `${item.batch?.product?.ten_san_pham || 'Nông sản'} · ${item.so_luong} ${unitOf(item.batch?.product)}`).join(' / ')}</p><div className="admin-order-bottom"><b>{money(order.tong_tien)}</b><div><button onClick={() => openOrderDetails(order.ma_don_hang)}>Xem chi tiết</button>{(orderTransitions[order.trang_thai] || []).map(([status, label]) => <button key={status} className={status === 'cancelled' ? 'text-danger' : ''} onClick={() => changeOrderStatus(order, status)}>{label}</button>)}{!orderTransitions[order.trang_thai] && (order.trang_thai === 'cancelled' ? <span className="admin-order-cancelled">Đã hủy</span> : <small>Đơn đã hoàn tất</small>)}</div></div></article>)}{!orders.length && <EmptyAdmin text="Chưa có đơn hàng nào trong hệ thống." />}</div>
    </>}

    {tab === 'categories' && <>
      <AdminSection title="Quản lý danh mục" action={<button className="primary-button admin-add" onClick={() => setCategoryForm({})}>+ Thêm danh mục</button>} />
      {categoryForm && <form key={categoryForm.ma_danh_muc || 'new-category'} className="admin-editor" onSubmit={saveCategory}><div className="admin-editor-heading"><b>{categoryForm.ma_danh_muc ? 'Chỉnh sửa danh mục' : 'Danh mục mới'}</b><button type="button" onClick={() => setCategoryForm(null)}>Đóng</button></div><label>Tên danh mục<input name="ten_danh_muc" required maxLength="100" defaultValue={categoryForm.ten_danh_muc || ''} placeholder="Ví dụ: Rau xanh" /></label><label>Mô tả<textarea name="mo_ta" rows="3" defaultValue={categoryForm.mo_ta || ''} placeholder="Mô tả nhóm sản phẩm" /></label><button className="primary-button wide">Lưu danh mục</button></form>}
      <div className="admin-card-list">{categories.map((item) => <article className="admin-category-card" key={item.ma_danh_muc}><div className="admin-category-icon">✳</div><div className="admin-product-info"><b>{item.ten_danh_muc}</b><p>{item.mo_ta || 'Chưa có mô tả'} · {item.products_count} sản phẩm</p><div className="admin-actions"><button onClick={() => setCategoryForm(item)}>Sửa</button><button className="text-danger" onClick={() => deleteCategory(item)}>Xóa danh mục</button></div></div></article>)}{!categories.length && <EmptyAdmin text="Chưa có danh mục sản phẩm." />}</div>
    </>}

    {tab === 'people' && <>
      <AdminSection title="Tài khoản & phân quyền" action={<button className="primary-button admin-add" onClick={() => setEmployeeForm((open) => !open)}>{employeeForm ? 'Đóng biểu mẫu' : '+ Thêm nhân viên'}</button>} />
      {employeeForm && <form className="admin-editor" onSubmit={createEmployee}>
        <div className="admin-editor-heading"><b>Tạo tài khoản nhân viên</b><span>Nhân viên sẽ đăng nhập bằng email và mật khẩu này.</span></div>
        <label>Họ và tên<input name="ho_ten" required maxLength="100" placeholder="Tên nhân viên" /></label>
        <label>Email đăng nhập<input name="email" type="email" required maxLength="150" placeholder="nhanvien@example.com" /></label>
        <label>Bộ phận<select name="vai_tro" defaultValue="Staff"><option value="Staff">Nhân viên nông trại (Staff)</option><option value="Sales">Nhân viên bán hàng (Sales)</option></select></label>
        <label>Mật khẩu ban đầu<input name="mat_khau" type="password" required minLength="8" autoComplete="new-password" placeholder="Ít nhất 8 ký tự" /></label>
        <button className="primary-button wide">Tạo tài khoản</button>
      </form>}
      <label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => { setLoading(true); setQuery(event.target.value) }} placeholder="Tìm theo tên hoặc email" /></label>
      <div className="admin-role-filter">{['', ...roles].map((role) => <button key={role || 'all'} className={roleFilter === role ? 'selected' : ''} onClick={() => { setLoading(true); setRoleFilter(role) }}>{role || 'Tất cả'}</button>)}</div>
      <div className="admin-card-list">{users.map((item) => <article className="admin-user-card" key={item.ma_nguoi_dung}><div className="admin-user-avatar">{item.ho_ten?.slice(0, 1)}</div><div className="admin-user-info"><b>{item.ho_ten}</b><small>{item.email}</small><small>Tham gia {date(item.ngay_tao)}</small><label>Vai trò<select value={item.vai_tro} onChange={(event) => changeRole(item, event.target.value)}><option value="Customer">Khách hàng</option><option value="Staff">Nhân viên nông trại</option><option value="Sales">Bán hàng</option><option value="Admin">Quản trị viên</option></select></label></div></article>)}{!users.length && <EmptyAdmin text="Không tìm thấy tài khoản phù hợp." />}</div>
      <p className="admin-footnote">Tài khoản Admin không thể tự hạ quyền; hệ thống luôn giữ lại ít nhất một Admin.</p>
    </>}

    {tab === 'reports' && <>
      <AdminSection title="Báo cáo hoạt động" />
      <div className="admin-report-summary"><div><span>Tổng hao hụt</span><b>{report?.loss_by_unit?.length ? report.loss_by_unit.map((row) => `${Number(row.so_luong)} ${row.don_vi_tinh}`).join(' · ') : '0 kg'}</b><small>{report?.loss_records ?? 0} phiếu ghi nhận</small></div><div><span>Sản phẩm bán tốt</span><b>{report?.top_products?.length ?? 0}</b><small>mặt hàng có phát sinh đơn</small></div></div>
      <div className="admin-report-panel"><h3>Doanh thu 7 ngày gần nhất</h3>{report?.sales?.length ? report.sales.map((row) => <div className="admin-report-row" key={row.ngay}><span>{date(row.ngay)}</span><div><b>{money(row.doanh_thu)}</b><small>{row.so_don} đơn</small></div></div>) : <EmptyAdmin text="Chưa phát sinh đơn hàng trong 7 ngày qua." />}</div>
      <div className="admin-report-panel"><h3>Sản phẩm bán chạy</h3>{report?.top_products?.length ? report.top_products.map((row) => <div className="admin-report-row" key={row.ma_san_pham}><span>{row.ten_san_pham}</span><div><b>{row.so_luong_ban} {row.don_vi_tinh || 'kg'}</b><small>{money(row.doanh_thu)}</small></div></div>) : <EmptyAdmin text="Chưa có dữ liệu bán hàng." />}</div>
      <div className="admin-status-summary"><h3>Trạng thái đơn hàng</h3>{(report?.order_statuses || []).map((row) => <span key={row.trang_thai}>{row.trang_thai}<b>{row.so_don}</b></span>)}</div>
    </>}

    {tab === 'losses' && <>
      <AdminSection title="Lịch sử hao hụt theo lô" />
      <p className="admin-losses-note">Xem số lượng, lý do, người ghi nhận và ảnh minh chứng của từng phiếu hao hụt.</p>
      <div className="loss-history-list">{losses.map((loss) => <article className="loss-history-card" key={loss.ma_phieu_hao_hut}>
        <div className="loss-history-top"><span className="loss-history-icon">↘</span><div><b>{loss.batch?.product?.ten_san_pham || 'Sản phẩm'} · Lô #{loss.ma_lo_hang}</b><small>{loss.staff?.ho_ten || 'Nhân viên'} · {loss.ngay_ghi_nhan ? new Date(loss.ngay_ghi_nhan).toLocaleString('vi-VN') : '—'}</small></div><strong>{loss.so_luong} {unitOf(loss.batch?.product)}</strong></div>
        <p><b>Lý do:</b> {loss.ly_do}</p>
        {loss.hinh_anh_minh_chung?.length > 0 && <div className="loss-evidence">{loss.hinh_anh_minh_chung.map((path) => { const url = /^https?:\/\//i.test(path) ? path : lossEvidenceUrl(path); return <a key={path} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Ảnh minh chứng hao hụt" loading="lazy" /></a> })}</div>}
      </article>)}{!loading && !losses.length && <EmptyAdmin text="Chưa có phiếu hao hụt nào được ghi nhận." />}</div>
    </>}

    {tab === 'settings' && <>
      <AdminSection title="Cảnh báo xả hàng" />
      {!loading && settings && <form className="admin-settings-card" onSubmit={saveSettings}><span className="settings-icon">⚠</span><h3>Nhắc lô gần hết hạn</h3><p>Nhân viên sẽ thấy các lô còn tồn kho có hạn sử dụng trong khoảng ngày được chọn. Cấu hình này áp dụng cho bảng cảnh báo khu vực nông trại.</p><label>Số ngày trước hạn<input type="number" min="0" max="30" value={settings.so_ngay_canh_bao_xa_hang} onChange={(event) => setSettings({ so_ngay_canh_bao_xa_hang: event.target.value })} /></label><small>Nhập từ 0 đến 30 ngày. Giá trị 0 chỉ hiển thị lô hết hạn hôm nay.</small><button className="primary-button wide">Lưu cấu hình</button></form>}
      {!loading && !settings && <EmptyAdmin text="Chưa tải được cấu hình cảnh báo. Hãy thử chọn lại mục này." />}
    </>}
    {selectedOrder && <AdminOrderDetails order={selectedOrder} loading={orderDetailLoading} onClose={() => setSelectedOrder(null)} />}
  </section>
}

function adminOrderStatusLabel(status) {
  return ({ pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', shipped: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' })[status] || status || 'Đang cập nhật'
}

function AdminOrderDetails({ order, loading, onClose }) {
  const items = order.items || []
  const subtotal = items.reduce((sum, item) => sum + Number(item.so_luong || 0) * Number(item.don_gia || 0), 0)
  const paymentLabels = { cod: 'Thanh toán khi nhận hàng', bank_transfer: 'Chuyển khoản', vnpay: 'VNPay', momo: 'MoMo' }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={`Chi tiết đơn hàng ${order.ma_don_hang}`}><div className="modal-heading"><h2>Chi tiết đơn hàng #{order.ma_don_hang}</h2><button onClick={onClose} aria-label="Đóng">×</button></div>{loading ? <p className="form-note">Đang tải chi tiết đơn hàng…</p> : <div className="order-detail-content">
    <div className="order-detail-status"><span>Trạng thái đơn hàng</span><b className={`order-status status-${order.trang_thai}`}>{adminOrderStatusLabel(order.trang_thai)}</b></div>
    <p className="order-detail-date">Đặt lúc {order.ngay_tao ? new Date(order.ngay_tao).toLocaleString('vi-VN') : '—'}</p>
    <h3>Khách hàng</h3><div className="order-detail-info"><p><span>Người nhận</span><b>{order.customer?.ho_ten || `Tài khoản #${order.ma_nguoi_dung}`}</b></p><p><span>Email</span><b>{order.customer?.email || '—'}</b></p><p><span>Địa chỉ nhận</span><b>{order.dia_chi_giao_hang || '—'}</b></p></div>
    <h3>Sản phẩm</h3><div className="order-detail-items">{items.map((item) => <article key={item.ma_chi_tiet}><div><b>{item.batch?.product?.ten_san_pham || 'Nông sản'}</b><small>Lô #{item.ma_lo_hang} · {money(item.don_gia)} / {unitOf(item.batch?.product)}</small></div><span>{item.so_luong} {unitOf(item.batch?.product)}</span><strong>{money(Number(item.so_luong) * Number(item.don_gia))}</strong></article>)}{!items.length && <p className="form-note">Đơn hàng chưa có chi tiết sản phẩm.</p>}</div>
    <div className="order-detail-totals"><p><span>Tiền hàng</span><b>{money(subtotal)}</b></p><p><span>Phí vận chuyển</span><b>{money(order.phi_giao_hang)}</b></p><p className="order-grand-total"><span>Tổng thanh toán</span><b>{money(order.tong_tien)}</b></p></div>
    <h3>Thanh toán</h3><div className="order-detail-info"><p><span>Phương thức</span><b>{paymentLabels[order.phuong_thuc_thanh_toan] || order.phuong_thuc_thanh_toan || '—'}</b></p><p><span>Trạng thái</span><b>{order.payments?.[0]?.trang_thai || 'Chờ xác nhận'}</b></p></div>
  </div>}</section></div>
}

function Metric({ label, value, hint, icon, warn }) {
  return <article className={`admin-metric${warn ? ' warning' : ''}`}><span className="metric-icon">{icon}</span><small>{label}</small><b>{value ?? '—'}</b><span className="metric-hint">{hint}</span></article>
}

function AdminSection({ title, action }) { return <div className="admin-section-heading"><div><p className="eyebrow">QUẢN LÝ HỆ THỐNG</p><h2>{title}</h2></div>{action}</div> }
function EmptyAdmin({ text }) { return <div className="admin-empty"><span>🌱</span><p>{text}</p></div> }
