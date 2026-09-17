import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { PATHS } from '../routes/paths'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader kicker title="페이지를 찾을 수 없습니다" lede="404" />
      <div className="page-body">
        <Link to={PATHS.home} className="btn btn--pill btn--outline">
          첫 화면으로
        </Link>
      </div>
    </>
  )
}
