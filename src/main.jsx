import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CoupleProvider } from './context/CoupleContext'
import CoupleLayout from './components/CoupleLayout'
import Dashboard from './pages/Dashboard.jsx'
import CountdownPage from './pages/CountdownPage.jsx'
import Letters from './pages/Letters.jsx'
import Games from './pages/Games.jsx'
import Mood from './pages/Mood.jsx'
import Watch from './pages/Watch.jsx'
import Savings from './pages/Savings.jsx'
import Memories from './pages/Memories.jsx'
import Room from './pages/Room.jsx'
import './index.css'

// No StrictMode: its dev double-mount would claim room/couple peer IDs twice
// and briefly deadlock host election.
ReactDOM.createRoot(document.getElementById('root')).render(
  <CoupleProvider>
    <BrowserRouter>
      <Routes>
        {/* Couple space: gated by onboarding, wrapped with the bottom nav */}
        <Route element={<CoupleLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/countdown" element={<CountdownPage />} />
          <Route path="/letters" element={<Letters />} />
          <Route path="/games" element={<Games />} />
          <Route path="/mood" element={<Mood />} />
          <Route path="/watch" element={<Watch />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/memories" element={<Memories />} />
        </Route>
        {/* Photobooth keeps its own immersive full-screen layout */}
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </BrowserRouter>
  </CoupleProvider>
)
