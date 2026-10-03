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

## 상태

기획 단계. 아직 코드가 없다.

## License

[MIT](LICENSE)
