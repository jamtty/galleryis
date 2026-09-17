import { Link } from 'react-router-dom'
import { SITE } from '../data/site'
import { PATHS } from '../routes/paths'
import Logo from './Logo'
import { BlogIcon, InstagramIcon } from './icons'

export default function Footer() {
  return (
    <footer className="site-footer">
      {/* 배경은 화면 폭 전체, 내용은 본문과 같은 기준선에 맞춥니다. */}
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <Logo className="site-footer__logo" title={SITE.brandName} />

          <ul className="social">
            <li>
              <a
                href={SITE.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="인스타그램"
                className="social__link social__link--dark"
              >
                <InstagramIcon />
              </a>
            </li>
            <li>
              <a
                href={SITE.blog}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="네이버 블로그"
                className="social__link social__link--dark"
              >
                <BlogIcon />
              </a>
            </li>
          </ul>
        </div>

        <dl className="meta-list">
          <div className="meta">
            <dt>관람시간</dt>
            <dd className="tabular-nums">{SITE.hours}</dd>
          </div>
          <div className="meta">
            <dt>주소</dt>
            <dd>{SITE.address}</dd>
          </div>
          <div className="meta">
            <dt>전화</dt>
            <dd className="tabular-nums">{SITE.tel}</dd>
          </div>
          <div className="meta">
            <dt>팩스</dt>
            <dd className="tabular-nums">{SITE.fax}</dd>
          </div>
          <div className="meta">
            <dt>이메일</dt>
            <dd>
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </dd>
          </div>
        </dl>

        <Link
          to={`${PATHS.about}#visit`}
          className="btn btn--pill btn--on-dark site-footer__cta"
        >
          오시는 길
          <span aria-hidden="true">→</span>
        </Link>

        <div className="site-footer__bottom">
          <Link to={PATHS.privacy} className="site-footer__privacy">
            개인정보처리방침
          </Link>
          <p className="site-footer__copyright">{SITE.copyright}</p>
          <a
            href={SITE.credit.href}
            target="_blank"
            rel="noopener noreferrer"
            className="site-footer__credit"
          >
            {SITE.credit.label}
          </a>
        </div>
      </div>
    </footer>
  )
}
