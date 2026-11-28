import http from 'node:http'

const backendOrigin = process.env.VNPAY_PROXY_BACKEND || 'http://127.0.0.1:8000'
const port = Number(process.env.VNPAY_PROXY_PORT || 8010)
const allowedPaths = new Set([
  '/api/payments/vnpay/return',
  '/api/payments/vnpay/ipn',
])

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', 'http://127.0.0.1')

  if (request.method !== 'GET' || !allowedPaths.has(requestUrl.pathname)) {
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ status: 'error', message: 'Not found' }))
    return
  }

  try {
    const upstream = await fetch(`${backendOrigin}${requestUrl.pathname}${requestUrl.search}`, {
      method: 'GET',
      headers: {
        'x-forwarded-for': request.socket.remoteAddress || '',
        'x-forwarded-proto': 'https',
      },
      redirect: 'manual',
    })
    const headers = {}
    for (const name of ['content-type', 'cache-control', 'location']) {
      const value = upstream.headers.get(name)
      if (value) headers[name] = value
    }
    response.writeHead(upstream.status, headers)
    response.end(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ status: 'error', message: 'VNPay callback upstream unavailable' }))
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`VNPay callback proxy listening on http://127.0.0.1:${port}`)
  console.log('Allowed paths: GET /api/payments/vnpay/return, GET /api/payments/vnpay/ipn')
})
