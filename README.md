# Player One

> **Life is an MMORPG. You are Player One.** — 현실의 나를 RPG 캐릭터 시트로: 스탯, 장비, 클래스, 자산 티어, 그리고 3D 아바타.

내 몸·옷·직업·자산을 MMORPG 캐릭터 정보창처럼 기록하고, 원하는 항목만 골라 공개하는 개인 프로필 서비스.

- **Base Stats** — 키, 몸무게, 골격근량, 체지방률
- **Equipment Slots** — 투구·상의·하의·신발 슬롯에 실제 의상 사이즈를 장비 규격으로 기록
- **Class / Wealth Tier** — 직업군을 RPG 클래스로, 자산을 레어리티 구간으로
- **3D Avatar** — 신체 스탯이 반영된 캐릭터가 중앙에 서 있는 정보창
- **필드 단위 공개 설정** — 모든 항목에 자물쇠, 타인 시점 미리보기

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js (static export) · TypeScript |
| 백엔드 | Supabase (Auth: Google, Postgres + RLS, RPC) |
| 3D | Three.js · React Three Fiber |
| 모션 | anime.js v4 |
| 상태 | zustand (DOM ↔ 3D 이벤트 동기화) |

## 페이지

| 경로 | 내용 |
|---|---|
| `/` | Press Start 랜딩 + Google 로그인 |
| `/me` | 내 캐릭터 시트, 인라인 편집 |
| `/p?u=<handle>` | 공개 프로필 (클라이언트 fetch) |
| `/settings` | 공개 범위 일괄 관리 |

## 문서

- [docs/DESIGN.md](docs/DESIGN.md) — 정보 구조, 프라이버시 모델, 레이아웃, "Quiet HUD" 디자인 시스템, 컴포넌트·이펙트 규칙, 3D 파이프라인

## GitHub 메타데이터

**About:** `Life is an MMORPG. You are Player One. — 현실의 나를 RPG 캐릭터 시트로: 스탯, 장비, 클래스, 자산 티어, 그리고 3D 아바타.`

**Topics:** `nextjs` `typescript` `supabase` `threejs` `react-three-fiber` `animejs` `rpg` `character-sheet` `quantified-self`

## 개발

```bash
cp .env.example .env.local   # Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
npm run build                # 정적 export → out/
```

| 경로 | 내용 |
|---|---|
| `src/app/` | 페이지 (`/`, `/auth/callback`, `/me`, `/p`, `/settings`) |
| `src/components/` | HudPanel, StatRow, EquipSlot, TierBadge, VisibilityToggle, CharacterViewport(R3F) |
| `src/lib/` | Supabase 클라이언트, 게임 어휘(클래스·티어), 이벤트 스토어(zustand), 모션 토큰 |
| `supabase/migrations/` | `profiles` 테이블, RLS, `get_public_profile` RPC |

### Supabase

- 마이그레이션은 `supabase/migrations/`에 둔다. 원격 반영: `npx supabase link --project-ref <ref>` 후 `npm run db:push`.
- Auth → URL Configuration: Site URL `http://localhost:3000`, Redirect URL `http://localhost:3000/auth/callback`. 배포 도메인이 생기면 둘 다 추가.
- Auth → Providers → Google: Google Cloud OAuth 클라이언트(웹)의 ID/Secret. Google 측 승인된 리디렉션 URI는 `https://<ref>.supabase.co/auth/v1/callback`.
- Security Advisor가 `get_public_profile`을 "anon이 실행 가능한 SECURITY DEFINER"로 경고한다. 공개 프로필 조회용으로 의도된 것이다.
- Google OAuth 동의 화면은 "테스트 중" 상태라 등록된 테스트 사용자만 로그인할 수 있다.

## 상태

스캐폴드 단계. 3D는 프리미티브 마네킹 placeholder, 편집은 기본 폼.

## License

[MIT](LICENSE)
