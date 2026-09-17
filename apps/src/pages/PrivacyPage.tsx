import { renderBodyHtml } from '@/utils/html'
import { useSiteSettings } from '@/store/useSiteSettings'
import PageHeader from '../components/PageHeader'

/**
 * 공개 — 개인정보처리방침.
 *
 * 내용은 관리자 [환경설정] → 개인정보처리방침에서 고칩니다. (page_privacy_html)
 * 내용이 비어 있으면 준비 중 안내를 보여 줍니다.
 */
export default function PrivacyPage() {
  const { pagePrivacyHtml } = useSiteSettings()
  const html = renderBodyHtml(pagePrivacyHtml)

  return (
    <>
      <PageHeader title="개인정보처리방침" />

      <div className="page-body">
        {html ? (
          <div
            className="page-doc rich-text"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="page-note">내용을 준비 중입니다.</p>
        )}
      </div>
    </>
  )
}
