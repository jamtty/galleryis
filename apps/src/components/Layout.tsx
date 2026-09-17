import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import BackToTop from './BackToTop'
import Footer from './Footer'
import Header from './Header'
import PopupLayer from './PopupLayer'

export default function Layout() {
  const { pathname } = useLocation()

  // 라우트 이동 시 스크롤을 최상단으로 되돌립니다.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="app-shell">
      {/*
       * 헤더 · 푸터는 .app-frame 바깥에 두어 배경이 화면 폭 전체를 채웁니다.
       * 내용만 각자 --app-max 로 가운데 정렬해 본문과 같은 기준선에 맞춥니다.
       */}
      <Header />

      <div className="app-frame">
        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <Footer />

      {/* 관리자 > 팝업에서 [사용] 으로 둔 팝업을 띄웁니다. */}
      <PopupLayer />

      {/* 우측 하단 맨 위로 버튼 (모든 공개 페이지 공통) */}
      <BackToTop />
    </div>
  )
}
