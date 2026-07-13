import { Outlet } from 'react-router-dom'
import { useCouple } from '../context/CoupleContext'
import { usePublishProfile } from '../hooks/usePublishProfile'
import Onboarding from './Onboarding'
import BottomNav from './BottomNav'

// Gate for every couple page: shows onboarding until a shared space exists,
// then renders the page with the bottom nav and keeps our profile published.
export default function CoupleLayout() {
  const { code } = useCouple()
  usePublishProfile()
  if (!code) return <Onboarding />
  return (
    <div className="pb-24 min-h-screen">
      <Outlet />
      <BottomNav />
    </div>
  )
}
