import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class AppErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, details) {
    console.error('Lỗi khi hiển thị giao diện:', error, details)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-error-fallback" role="alert">
          <span aria-hidden="true">🌿</span>
          <h1>Trang này gặp sự cố</h1>
          <p>Dữ liệu của trang chưa thể hiển thị. Bạn có thể quay về trang mua sắm để tiếp tục.</p>
          <button type="button" onClick={() => window.location.assign('/')}>Về trang chủ</button>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
