import { useEffect, useState } from 'react'
import { API } from './api'

export default function EvidenceGallery({ token, complaint }) {
  const [images, setImages] = useState([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const urls = []
    async function load() {
      try {
        const paths = complaint.tep_minh_chung || []
        const loaded = await Promise.all(paths.map(async (_, index) => {
          const response = await fetch(`${API}/complaints/${complaint.ma_khieu_nai}/evidence/${index}`, {
            headers: { Accept: 'image/*', Authorization: `Bearer ${token}` },
          })
          if (!response.ok) throw new Error('Không tải được ảnh minh chứng.')
          const url = URL.createObjectURL(await response.blob())
          urls.push(url)
          return url
        }))
        if (active) setImages(loaded)
      } catch {
        if (active) setFailed(true)
      }
    }
    load()
    return () => {
      active = false
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [complaint.ma_khieu_nai, complaint.tep_minh_chung, token])

  if (failed) return <p className="complaint-evidence-note">Không tải được ảnh minh chứng.</p>
  if (!images.length) return <p className="complaint-evidence-note">Đang tải ảnh minh chứng…</p>
  return <div className="complaint-evidence">{images.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Ảnh minh chứng ${index + 1}`} loading="lazy" /></a>)}</div>
}
