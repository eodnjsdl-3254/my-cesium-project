import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Cesium from 'cesium'
import './index.css'
import App from './App.jsx'

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkZTAwNTc2NC0yMTUwLTQxNmYtOWI0OC1kNzk0NWJmZjdlOWQiLCJpZCI6MzgxNjIwLCJpYXQiOjE3Njg5OTE2OTd9.f13PdjYpuTAi46N5UZHIeu1lcp_zf90hByqNNteTZ7g';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
