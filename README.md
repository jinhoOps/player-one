# Player One

> **인생이라는 게임, 주인공은 나.** — 내 몸과 일, 자산을 캐릭터 스탯처럼 기록하고 키우는 포근한 생활 RPG. 무엇을 보여줄지는 항상 내가 정해요.

내 몸·옷·직업·자산을 RPG 캐릭터 정보창처럼 기록하고, 원하는 항목만 골라 공개하는 개인 프로필 서비스.

- **Base Stats** — 키, 몸무게, 골격근량, 체지방률
- **Equipment Slots** — 투구·상의·하의·신발 슬롯에 실제 의상 사이즈를 장비 규격으로 기록
- **Class / Wealth Tier** — 직업군을 RPG 클래스로, 자산을 레어리티 구간으로
- **3D Avatar** — 신체 스탯과 장비가 반영된 치비 토이 캐릭터
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
| `/privacy` | 개인정보처리방침 |

## 문서

- [docs/BRAND.md](docs/BRAND.md) — 브랜드 가이드 "Cozy Quest": 말투, 로고, 컬러, 타이포, 형태, 모션, 이펙트, 캐릭터 아트
- [docs/DESIGN.md](docs/DESIGN.md) — 정보 구조, 프라이버시 모델, 레이아웃, 컴포넌트, 3D 캐릭터 생성

## GitHub 메타데이터

**About:** `인생이라는 게임, 주인공은 나. — 내 몸·일·자산을 캐릭터 스탯처럼 기록하고 키우는 포근한 생활 RPG 프로필.`

**Topics:** `nextjs` `typescript` `supabase` `threejs` `react-three-fiber` `animejs` `rpg` `character-sheet` `quantified-self` `cozy`

## 개발

```bash
cp .env.example .env.local   # Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
npm run build                # 정적 export → out/
```

### 배포

`main`에 푸시하면 `.github/workflows/deploy.yml`이 GitHub Pages(https://jinhoops.github.io/player-one/)로 배포한다. 빌드는 `NEXT_PUBLIC_BASE_PATH=/player-one`으로 하위 경로를 붙이고, Supabase URL·publishable key는 저장소 Variables에서 읽는다.

| 경로 | 내용 |
|---|---|
| `src/app/` | 페이지 (`/`, `/auth/callback`, `/me`, `/me/items`, `/p`, `/village`, `/settings`) |
| `src/components/` | HudPanel, StatRow, EquipSlot, TierBadge, VisibilityToggle, CharacterViewport(R3F) |
| `src/lib/` | Supabase 클라이언트, 게임 어휘(클래스·티어), 이벤트 스토어(zustand), 모션 토큰 |
| `supabase/migrations/` | `profiles`·`items` 테이블, RLS, `get_public_profile`·`get_public_trophies` RPC |

### Supabase

- 마이그레이션은 `supabase/migrations/`에 둔다. 원격 반영: `npx supabase link --project-ref <ref>` 후 `npm run db:push`.
- Auth → URL Configuration: Site URL `https://jinhoops.github.io/player-one/`, Redirect URL `https://jinhoops.github.io/player-one/auth/callback` · `http://localhost:3000/auth/callback`.
- Auth → Providers → Google: Google Cloud OAuth 클라이언트(웹)의 ID/Secret. Google 측 승인된 리디렉션 URI는 `https://<ref>.supabase.co/auth/v1/callback`.
- Security Advisor가 `get_public_profile`을 "anon이 실행 가능한 SECURITY DEFINER"로 경고한다. 공개 프로필 조회용으로 의도된 것이다.
- Google OAuth 동의 화면은 프로덕션 게시 상태다. 기본 범위만 써서 인증 심사는 없다. 브랜딩의 홈페이지·개인정보처리방침(`/privacy`) 링크와 승인된 도메인(`jinhoops.github.io`)이 게시 요건이다.
- 원격 마이그레이션 기록(`supabase_migrations.schema_migrations`)은 `supabase/migrations/`와 맞춰 두었다. SQL Editor로 직접 적용했다면 같은 버전을 기록에도 넣는다.

## 상태

MVP. 로그인 → 캐릭터 시트(인라인 편집, 장비 팝오버, 필드별 공개 설정) → 공개 프로필.
브랜드는 Cozy Quest(흰 바탕·리프 그린·Jua, 캐릭터 무대만 크림 톤), 3D는 리깅된 치비 캐릭터(뼈 크기로 체형 반영), 이펙트 카탈로그(docs/BRAND.md §7)가 구현되어 있다.
남은 것: 상의·하의·신발의 장비 형태 변화(현재는 색으로만 표시).

## License

[MIT](LICENSE)

## 3D 모델 크레딧

캐릭터와 마을(`/village`)에 쓰는 모델. 원본 라이선스 파일은 `public/models/*/license.txt`.

- This work is based on "Free Pack - Chibi Base Mesh (Rigged)" (https://sketchfab.com/3d-models/free-pack-chibi-base-mesh-rigged-fed4fb329f224f1594f631eae8d2626b) by DuNguyn Studio (https://sketchfab.com/dunguyn) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Medieval Fantasy Book" (https://sketchfab.com/3d-models/medieval-fantasy-book-06d5a80a04fc4c5ab552759e9a97d91a) by Pixel (https://sketchfab.com/stefan.lengyel1) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
