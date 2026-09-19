import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router'
import { createLayoutStore } from '@/studio/lib/layoutStore'
import { configureLayoutStore } from '@/studio/store/works'

/**
 * 3D 둘러보기 라우트 — 원본 스튜디오 앱(three.js + R3F)을 그대로 옮긴 화면이라
 * 따로 불러옵니다. 이렇게 감싸 두지 않으면 첫 화면에서도 3D 묶음을 함께 내려받습니다.
 *
 * 원본 스튜디오는 자기 `main.tsx` 에서 배치 저장소(IndexedDB)를 켭니다 —
 * 그 자리를 여기서 대신합니다. (IndexedDB 가 없으면 아무것도 저장하지 않습니다)
 *
 * 라우트는 여기서 한 번 더 걸어 둡니다 — HallView 가 `useParams()` 로 전시장
 * 키를 읽기 때문에, 그냥 그리면 키가 비어 "전시장 정보를 불러오지 못했습니다"
 * 로 끝납니다.
 */
configureLayoutStore(createLayoutStore())

const HallView = lazy(() => import('@/studio/pages/HallView'))

export default function HallStudioRoute() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-ground">
          <p className="text-base text-ink-soft">전시장을 여는 중입니다...</p>
        </div>
      }
    >
      <Routes>
        <Route path="/halls/:key/studio" element={<HallView />} />
      </Routes>
    </Suspense>
  )
}
