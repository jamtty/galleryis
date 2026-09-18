import { Suspense, lazy } from 'react'

/**
 * 3D 둘러보기 라우트 — three.js(약 0.5MB)를 따로 불러옵니다.
 *
 * 이렇게 감싸 두지 않으면 첫 화면에서도 three.js 를 함께 내려받게 됩니다.
 */
const HallStudioPage = lazy(() => import('../pages/HallStudioPage'))

export default function HallStudioRoute() {
  return (
    <Suspense
      fallback={
        <div className="page-body">
          <p className="page-note page-note--center">
            3D 둘러보기를 불러오는 중입니다...
          </p>
        </div>
      }
    >
      <HallStudioPage />
    </Suspense>
  )
}
