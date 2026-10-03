import type { Metadata } from "next";
import { Jua } from "next/font/google";
import "./globals.css";

// Rounded display face for the wordmark, headings and big numbers (docs/BRAND.md).
const jua = Jua({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-jua",
});

export const metadata: Metadata = {
  title: "Player One",
  description: "인생이라는 게임, 주인공은 나. 내 캐릭터를 키우고 원하는 만큼만 보여주세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={jua.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
