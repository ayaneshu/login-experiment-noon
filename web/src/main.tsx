import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'lightweight-ui/styles.css'
import { App } from './site/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
