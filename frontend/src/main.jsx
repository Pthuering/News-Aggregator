import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// DEBUG: Sichtbarer Test-Banner
const root = document.getElementById('root')
root.innerHTML = '<div id="debug-banner" style="background:red;color:white;padding:20px;text-align:center;font-size:20px;font-weight:bold;">🚀 REACT LÄDT... 🚀</div>'

setTimeout(() => {
  const banner = document.getElementById('debug-banner')
  if (banner) banner.remove()
}, 3000)

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
