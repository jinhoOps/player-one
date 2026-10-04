# Player One

> **인생이라는 게임, 주인공은 나.**

내 몸과 일, 자산을 캐릭터 스탯처럼 기록하고 키우는 포근한 생활 RPG예요. 무엇을 보여줄지는 항상 내가 정해요.

**▶ 바로 시작하기: https://jinhoops.github.io/player-one/**

## 어떤 서비스인가요

키·몸무게 같은 몸의 기록, 옷 사이즈, 직업, 자산을 게임 캐릭터 정보창처럼 정리해 주는 개인 프로필이에요.
숫자를 좋고 나쁨으로 판정하지 않아요. 몸무게가 늘어난 게 누군가에겐 목표니까요. 그냥 지금의 나를 귀여운 캐릭터로 기록하고, 바뀔 때마다 캐릭터가 함께 반응해요.

- **나를 캐릭터로**: 키·몸무게·골격근량이 그대로 3D 치비 캐릭터의 체형이 돼요
- **옷 사이즈는 장비로**: 모자·상의·하의·신발 사이즈를 장비 슬롯에 기록해요
- **직업은 클래스, 자산은 티어로**: 개발자는 마법사, 디자이너는 레인저. 자산은 정확한 금액 대신 구간(레어리티)만 저장해요
- **보여줄 만큼만**: 모든 항목에 자물쇠가 있어요. 숨긴 값은 다른 사람에게 절대 닿지 않고, 캐릭터 체형에도 드러나지 않아요
- **인벤토리와 진열장**: 오래 쓰려고 산 물건을 기록해 두고, 자랑하고 싶은 6개만 진열해요
- **마을**: 지금 접속한 사람들의 캐릭터가 책 속 마을에 모여요. 걸어 다니고, 말풍선으로 인사해요

## 시작하기

1. [Player One](https://jinhoops.github.io/player-one/)에 들어가서 **Google로 시작하기**
2. **공개 주소(핸들)** 를 정해요. `…/p?u=내핸들` 로 나만의 공개 프로필이 생겨요
3. **기본 스탯 · 장비 · 클래스·자산** 카드의 "입력"을 눌러 채워요. 저장할 때마다 캐릭터가 반짝여요
4. 항목 옆 **자물쇠**로 공개/비공개를 정하고, **공개 화면 보기**로 남에게 어떻게 보이는지 확인해요
5. **인벤토리**에 물건을 적고, 마음에 드는 걸 진열장에 올려요
6. **마을**에 놀러 가요

### 마을에서

| 하고 싶은 것 | 방법 |
|---|---|
| 걸어가기 | 땅을 **우클릭** (휴대폰은 탭). 걷는 중에 다시 찍으면 그쪽으로 방향을 틀어요 |
| 내 캐릭터 옮기기 | 내 캐릭터나 **내 이름표를 꾹** 눌러 들어 올린 뒤 원하는 곳에 놓기 |
| 말 걸기 | 다른 사람을 **클릭**하면 `@닉네임`이 입력칸에 들어가요 |
| 프로필 보기·옆으로 가기 | 다른 사람을 **우클릭** |
| 시점 돌리기 | **Space**를 누른 채 드래그 (휴대폰은 두 손가락) |
| 확대·축소 | 마우스 휠 (휴대폰은 두 손가락 오므리기) |
| 마을 전경 ↔ 내 캐릭터 따라가기 | **Y** 또는 화면의 전환 버튼 |

누가 나를 `@닉네임`으로 부르면 알림이 떠요.

### 내 정보와 탈퇴

- 상단 **설정**에서 공개 범위를 한꺼번에 바꾸고, 로그아웃하고, 탈퇴할 수 있어요. 탈퇴하면 모든 기록이 바로 지워져요
- 무엇을 저장하고 어떻게 다루는지는 [개인정보처리방침](https://jinhoops.github.io/player-one/privacy)에 있어요

<details>
<summary><b>개발자 정보</b></summary>

### 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js (static export) · TypeScript |
| 백엔드 | Supabase (Auth: Google, Postgres + RLS, RPC, Realtime) |
| 3D | Three.js · React Three Fiber · three-mesh-bvh |
| 모션 | anime.js v4 |
| 상태 | zustand (DOM ↔ 3D 이벤트, 프로필 공유) |

### 문서

- [docs/BRAND.md](docs/BRAND.md) — 브랜드 가이드 "Cozy Quest": 말투, 로고, 컬러, 타이포, 형태, 모션, 이펙트, 캐릭터 아트
- [docs/DESIGN.md](docs/DESIGN.md) — 정보 구조, 프라이버시 모델, 레이아웃, 컴포넌트(모달 포함), 3D 캐릭터, 마을

### 페이지

| 경로 | 내용 |
|---|---|
| `/` | 랜딩 + Google 로그인 |
| `/me` | 내 캐릭터 시트, 인라인 편집, 진열장 |
| `/me/items` | 인벤토리 |
| `/p?u=<handle>` | 공개 프로필 (클라이언트 fetch) |
| `/village` | 마을 (Realtime presence + 말풍선) |
| `/settings` | 설정 모달을 연 채로 `/me`로 이동 (설정은 상단 바에서 모달로 연다) |
| `/privacy` | 개인정보처리방침 |

### 개발

```bash
cp .env.example .env.local   # Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
npm run build                # 정적 export → out/
npm run typecheck && npm run lint
```

| 경로 | 내용 |
|---|---|
| `src/app/` | 페이지 |
| `src/components/` | 캐릭터 시트, 3D(`CharacterViewport`, `Chibi`), `Modal`, 마을(`village/`: 맵, 지형 물리) |
| `src/lib/` | Supabase 클라이언트, 게임 어휘(클래스·티어), 이벤트·프로필 스토어(zustand), 마을 presence |
| `supabase/migrations/` | `profiles`·`items`, RLS, `get_public_profile`·`get_public_trophies`·`delete_my_account` RPC, 닉네임 변경 제한 트리거 |

### 배포

`main`에 푸시하면 `.github/workflows/deploy.yml`이 GitHub Pages(https://jinhoops.github.io/player-one/)로 배포한다. 빌드는 `NEXT_PUBLIC_BASE_PATH=/player-one`으로 하위 경로를 붙이고, Supabase URL·publishable key는 저장소 Variables에서 읽는다.

### Supabase

- 마이그레이션은 `supabase/migrations/`에 둔다. 원격 반영: `npx supabase link --project-ref <ref>` 후 `npm run db:push`.
- 원격 마이그레이션 기록(`supabase_migrations.schema_migrations`)은 `supabase/migrations/`와 맞춰 두었다. SQL Editor로 직접 적용했다면 같은 버전을 기록에도 넣는다.
- Auth → URL Configuration: Site URL `https://jinhoops.github.io/player-one/`, Redirect URL `https://jinhoops.github.io/player-one/auth/callback` · `http://localhost:3000/auth/callback`.
- Auth → Providers → Google: Google Cloud OAuth 클라이언트(웹)의 ID/Secret. Google 측 승인된 리디렉션 URI는 `https://<ref>.supabase.co/auth/v1/callback`.
- Google OAuth 동의 화면은 프로덕션 게시 상태다. 기본 범위만 써서 인증 심사는 없다. 브랜딩의 홈페이지·개인정보처리방침(`/privacy`) 링크와 승인된 도메인(`jinhoops.github.io`)이 게시 요건이다. 로고를 올리면 심사 대상이 된다.
- Security Advisor가 `get_public_profile`을 "anon이 실행 가능한 SECURITY DEFINER"로 경고한다. 공개 프로필 조회용으로 의도된 것이다.

### GitHub 메타데이터

**About:** `인생이라는 게임, 주인공은 나. — 내 몸·일·자산을 캐릭터 스탯처럼 기록하고 키우는 포근한 생활 RPG 프로필.`

**Topics:** `nextjs` `typescript` `supabase` `threejs` `react-three-fiber` `animejs` `rpg` `character-sheet` `quantified-self` `cozy`

### 남은 일

- 상의·하의·신발의 장비 형태 변화(지금은 색으로만 표시). 계획은 docs/DESIGN.md §10
- 마을 걷기 애니메이션, 접속자가 많을 때의 LOD

</details>

## 크레딧

캐릭터와 마을에 쓰는 3D 모델이에요. 원본 라이선스 파일은 `public/models/*/license.txt`에 있어요.

- This work is based on "Free Pack - Chibi Base Mesh (Rigged)" (https://sketchfab.com/3d-models/free-pack-chibi-base-mesh-rigged-fed4fb329f224f1594f631eae8d2626b) by DuNguyn Studio (https://sketchfab.com/dunguyn) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- This work is based on "Medieval Fantasy Book" (https://sketchfab.com/3d-models/medieval-fantasy-book-06d5a80a04fc4c5ab552759e9a97d91a) by Pixel (https://sketchfab.com/stefan.lengyel1) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

## License

[MIT](LICENSE)
