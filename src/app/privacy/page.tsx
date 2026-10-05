import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";

export const metadata: Metadata = { title: "개인정보처리방침 · Player One" };

const CONTACT = "okho04@gmail.com";

// Required for publishing the Google OAuth consent screen. Keep in sync with
// what the app actually stores (docs/DESIGN.md §1–2, supabase/migrations).
export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, display: "grid", gap: 16, lineHeight: 1.7 }}>
      <h1 className="display" style={{ fontSize: 32 }}>
        개인정보처리방침
      </h1>
      <p className="label">시행일 2026년 10월 4일</p>

      <Card title="모으는 정보">
        <ul style={{ paddingLeft: 20 }}>
          <li>Google 로그인 정보: 이메일 주소, 이름, 프로필 사진 주소 (Google이 넘겨주는 기본 정보만)</li>
          <li>직접 입력한 프로필: 공개 주소(핸들), 닉네임, 칭호, 생년월일, 클래스·직업명, 체형, 헤어스타일, 키·몸무게·골격근량·체지방률, 장비 사이즈, 자산 구간</li>
          <li>인벤토리: 직접 등록한 물건의 이름, 브랜드, 모델명, 구매일, 가격, 구매처, 수량, 후기</li>
        </ul>
        <p>자산은 정확한 금액이 아니라 구간만 저장합니다. 마을 말풍선 채팅은 저장하지 않습니다.</p>
      </Card>

      <Card title="쓰는 곳">
        <p>캐릭터 시트와 공개 프로필을 보여주는 데만 씁니다. 광고, 판매, 제3자 제공에 쓰지 않습니다.</p>
      </Card>

      <Card title="공개 범위">
        <p>
          모든 항목은 본인만 볼 수 있게 저장되고, 직접 공개로 바꾼 항목만 공개 프로필과 마을에 보입니다. 다른 사람이 보는
          캐릭터 체형에도 비공개 수치는 반영되지 않습니다. 생년월일은 공개해도 나이(Lv.)로만 보입니다. 인벤토리는 진열한 물건의 분류·이름·브랜드·구매 연도만 공개됩니다.
        </p>
      </Card>

      <Card title="맡기는 곳">
        <ul style={{ paddingLeft: 20 }}>
          <li>Supabase: 로그인과 데이터 저장</li>
          <li>Google: 로그인 인증</li>
          <li>GitHub Pages: 웹사이트 호스팅</li>
        </ul>
        <p>로그인 상태는 브라우저 저장소(localStorage)에 보관됩니다.</p>
      </Card>

      <Card title="보관과 삭제">
        <p>
          계정을 유지하는 동안 보관합니다. 설정 화면의 &quot;회원 탈퇴&quot;로 계정과 모든 데이터를 바로 지울 수 있고, 아래
          메일로 요청해도 지체 없이 지웁니다.
        </p>
      </Card>

      <Card title="문의">
        <p>
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      </Card>

      <p>
        <Link href="/">처음으로</Link>
      </p>
    </main>
  );
}
