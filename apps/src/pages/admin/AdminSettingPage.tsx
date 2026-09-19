import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  fetchSettingGroups,
  updateSettings,
  type SettingField,
  type SettingGroup,
} from '@/api/settings'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminPage from '@/components/admin/AdminPage'
import RichEditor from '@/components/admin/RichEditor'

/**
 * 관리자 — 개인정보처리방침.
 *
 * 입력칸은 서버(backend/lib/setting.php 의 setting_definitions)가 내려 주는 정의를
 * 그대로 그립니다. 설정을 새로 추가해도 이 화면은 고칠 필요가 없습니다.
 * 내용을 고치려면 값을 바꾸고 [저장] 을 누르면 됩니다.
 */
export default function AdminSettingPage() {
  const [groups, setGroups] = useState<SettingGroup[]>([])
  /** 입력 중인 값 (설정 키 → 값) */
  const [values, setValues] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 저장 완료 안내 알럿 문구 (null 이면 닫힘) */
  const [done, setDone] = useState<string | null>(null)

  /** 서버에서 받은 정의와 값을 화면 상태로 옮깁니다. */
  const apply = useCallback((list: SettingGroup[]) => {
    setGroups(list)
    setValues(
      Object.fromEntries(
        list.flatMap((group) => group.fields.map((field) => [field.key, field.value])),
      ),
    )
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchSettingGroups()
      .then((res) => {
        if (cancelled) return

        apply(res.groups ?? [])
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setLoadError(
          err instanceof Error ? err.message : '개인정보처리방침을 불러오지 못했습니다.',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [apply])

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (saving) return

    setSaving(true)
    setError(null)

    try {
      const res = await updateSettings(values)

      setDone(`개인정보처리방침 ${res.saved}개 항목을 저장했습니다.`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '개인정보처리방침을 저장하지 못했습니다.',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  /** 입력칸 한 개 — 서버가 알려 준 종류대로 그립니다. */
  const renderField = (field: SettingField) => {
    const value = values[field.key] ?? ''
    const over = field.max > 0 && value.length > field.max
    const maxLength = field.max > 0 ? field.max : undefined
    const placeholder = field.required ? '필수 입력' : '비워 두면 표시되지 않습니다'

    return (
      <div className="adm_form_row adm_form_row_col" key={field.key}>
        <label className="adm_form_label" htmlFor={field.key}>
          {field.label}
          {field.required && <span className="required"> *</span>}
        </label>

        {field.type === 'html' && (
          <RichEditor
            value={value}
            disabled={saving}
            placeholder={placeholder}
            onChange={(html) => setValue(field.key, html)}
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            id={field.key}
            className="adm_form_textarea"
            rows={3}
            value={value}
            disabled={saving}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(event) => setValue(field.key, event.target.value)}
          />
        )}

        {field.type !== 'html' && field.type !== 'textarea' && (
          <input
            id={field.key}
            type="text"
            className="adm_form_input"
            value={value}
            disabled={saving}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(event) => setValue(field.key, event.target.value)}
          />
        )}

        <p className="adm_setting_hint">
          {field.hint && <span>{field.hint}</span>}

          {field.max > 0 && (
            <span className={over ? 'adm_setting_count is-over' : 'adm_setting_count'}>
              {value.length} / {field.max}자
            </span>
          )}
        </p>
      </div>
    )
  }

  return (
    <AdminPage title="개인정보처리방침">
      <section className="adm_section">
        <h2 className="adm_section_title">개인정보처리방침</h2>

        {error && <p className="adm_table_notice">{error}</p>}

        {loading && <p className="adm_table_notice">불러오는 중입니다...</p>}

        {/* 테이블이 없거나 권한 문제로 못 불러온 경우 */}
        {!loading && loadError && (
          <>
            <p className="adm_table_notice">{loadError}</p>

            <div className="adm_page_btns">
              <button
                type="button"
                className="adm_btn_primary"
                onClick={() => window.location.reload()}
              >
                다시 시도
              </button>
            </div>
          </>
        )}

        {!loading && !loadError && (
          <form className="adm_form" onSubmit={handleSubmit} noValidate>
            {groups.map((group) => (
              <div className="adm_setting_group" key={group.key}>
                <h3 className="adm_setting_group_title">{group.label}</h3>

                {group.help && <p className="adm_setting_group_help">{group.help}</p>}

                {group.fields.map(renderField)}
              </div>
            ))}

            {/* 저장 — 다른 관리자 폼과 같이 우측 정렬 (adm_form_btns) */}
            <div className="adm_form_btns">
              <button type="submit" className="adm_btn_primary" disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        )}
      </section>

      <AdminAlert
        open={done !== null}
        title="저장되었습니다"
        message={done ?? ''}
        onClose={() => setDone(null)}
      />
    </AdminPage>
  )
}
