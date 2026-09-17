import { useSiteSettings } from '@/store/useSiteSettings'
import BlankPage from '../components/BlankPage'

export default function HallsPage() {
  /** 제목 아래 문구 — 관리자 [환경설정] 에서 고칩니다. */
  const { pageHallsLede } = useSiteSettings()

  return <BlankPage title="전시장" lede={pageHallsLede} />
}
