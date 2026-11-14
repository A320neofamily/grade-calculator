import { useEffect, useMemo, useRef, useState } from "react"
import type { User } from "firebase/auth"
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { auth, googleProvider } from "./firebase"
import { loadUserData, saveUserData, type UserData } from "./userDataApi"
import VisitorStats from "./VisitorStats"
import SchoolManager from "./SchoolManager"
import MarkdownDialog from "./MarkdownDialog"
import {
  getPublishedSchool,
  getSchoolKey,
  listPublishedSchools,
  parseSchoolConfig,
  type PublishedSchoolSummary,
  type SchoolConfig,
} from "./schoolConfigApi"
import { version as appVersion } from "../package.json"

type Assessment = {
  id: string
  type: "지필평가" | "수행평가"
  title: string
  period: string
  weight: number
}

type Subject = {
  id: string
  name: string
  color: string
  assessments: Assessment[]
  passOnly?: boolean
}

type Scores = Record<string, string>

const mandukSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "10. 2.(금) · 4교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "12. 7.(월) · 2교시",
        weight: 30,
      },
      {
        id: "intro",
        type: "수행평가",
        title: "복합 양식 자료를 활용한 소개 글 쓰기",
        period: "9~10월",
        weight: 20,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기 프로젝트",
        period: "11월",
        weight: 20,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "metaverse",
        type: "수행평가",
        title: "가상공간 크리에이터 프로젝트",
        period: "10월",
        weight: 50,
      },
      {
        id: "newspaper",
        type: "수행평가",
        title: "통일 한국 신문 기획하기",
        period: "11월",
        weight: 50,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "12. 8.(화) · 3교시",
        weight: 40,
      },
      {
        id: "revolution",
        type: "수행평가",
        title: "산업혁명 바로 알기 프로젝트",
        period: "10월",
        weight: 30,
      },
      {
        id: "china",
        type: "수행평가",
        title: "중국 근대화 운동 보고서",
        period: "10월",
        weight: 30,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "10. 2.(금) · 2교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "12. 7.(월) · 4교시",
        weight: 30,
      },
      {
        id: "geometry",
        type: "수행평가",
        title: "도형 프로젝트",
        period: "9~11월",
        weight: 20,
      },
      {
        id: "essay",
        type: "수행평가",
        title: "수학 서술 챌린지",
        period: "9~12월",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "10. 1.(목) · 2교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "12. 8.(화) · 4교시",
        weight: 30,
      },
      {
        id: "circulation",
        type: "수행평가",
        title: "순환계의 구조와 기능",
        period: "11월",
        weight: 20,
      },
      {
        id: "experiment",
        type: "수행평가",
        title: "몸의 법칙 실험",
        period: "11월",
        weight: 20,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "construction",
        type: "수행평가",
        title: "건설기술 문제해결",
        period: "9~11월",
        weight: 50,
      },
      {
        id: "resource",
        type: "수행평가",
        title: "지속가능한 자원관리",
        period: "9~10월",
        weight: 30,
      },
      {
        id: "family",
        type: "수행평가",
        title: "건강한 가족관계",
        period: "11월",
        weight: 20,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "10. 1.(목) · 4교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "12. 8.(화) · 2교시",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "영어듣기",
        period: "9월",
        weight: 10,
      },
      {
        id: "writing",
        type: "수행평가",
        title: "영어쓰기",
        period: "10~11월",
        weight: 15,
      },
      {
        id: "speaking",
        type: "수행평가",
        title: "영어말하기",
        period: "10~11월",
        weight: 15,
      },
    ],
  },
  {
    id: "japanese",
    name: "일본어",
    color: "bg-red-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "12. 7.(월) · 3교시",
        weight: 40,
      },
      {
        id: "kana",
        type: "수행평가",
        title: "가타카나 받아쓰기",
        period: "9~10월",
        weight: 30,
      },
      {
        id: "conversation",
        type: "수행평가",
        title: "기초회화",
        period: "11월",
        weight: 30,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "basketball1",
        type: "수행평가",
        title: "탁구",
        period: "9월",
        weight: 30,
      },
      {
        id: "volleyball1",
        type: "수행평가",
        title: "배구 Ⅰ",
        period: "11월",
        weight: 30,
      },
      {
        id: "volleyball2",
        type: "수행평가",
        title: "배구 Ⅱ",
        period: "11~12월",
        weight: 40,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "piano",
        type: "수행평가",
        title: "피아노 코드 반주",
        period: "9월",
        weight: 40,
      },
      {
        id: "drum",
        type: "수행평가",
        title: "드럼 반주",
        period: "10월",
        weight: 30,
      },
      {
        id: "choir",
        type: "수행평가",
        title: "2부 합창",
        period: "11월",
        weight: 30,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "dokdo",
        type: "수행평가",
        title: "독도 홍보 포스터",
        period: "8~10월",
        weight: 50,
      },
      {
        id: "unification",
        type: "수행평가",
        title: "통일 홍보 포스터",
        period: "10~12월",
        weight: 50,
      },
    ],
  },
]

const geojeSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "brochure",
        type: "수행평가",
        title: "한국 소개 소책자 만들기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "unification",
        type: "수행평가",
        title: "배움질문 포트폴리오",
        period: "2학기",
        weight: 20,
      },
      {
        id: "people",
        type: "수행평가",
        title: "역사 인물 탐구",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "geometry1",
        type: "수행평가",
        title: "기하 프로젝트 Ⅰ",
        period: "2학기",
        weight: 20,
      },
      {
        id: "geometry2",
        type: "수행평가",
        title: "기하 프로젝트 Ⅱ",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "electric",
        type: "수행평가",
        title: "전자기 프로젝트",
        period: "2학기",
        weight: 20,
      },
      {
        id: "rock",
        type: "수행평가",
        title: "암석 파헤치기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "adaptation",
        type: "수행평가",
        title: "적응 유연성 프로젝트",
        period: "2학기",
        weight: 50,
      },
      {
        id: "construction",
        type: "수행평가",
        title: "건설기술 프로젝트",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "information",
    name: "정보",
    color: "bg-sky-500",
    assessments: [
      {
        id: "data",
        type: "수행평가",
        title: "실생활 데이터 분석 및 문제 해결",
        period: "2학기",
        weight: 50,
      },
      {
        id: "system",
        type: "수행평가",
        title: "컴퓨팅 시스템 기반 실생활 문제 해결 절차 설계",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "futsal",
        type: "수행평가",
        title: "풋살",
        period: "2학기",
        weight: 50,
      },
      {
        id: "cheerleading",
        type: "수행평가",
        title: "치어리딩",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "folk-song",
        type: "수행평가",
        title: "민요 부르기",
        period: "2학기",
        weight: 50,
      },
      {
        id: "project",
        type: "수행평가",
        title: "음악사 프로젝트",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "pattern",
        type: "수행평가",
        title: "나만의 모던 책거리",
        period: "2학기",
        weight: 50,
      },
      {
        id: "tshirt",
        type: "수행평가",
        title: "메시지를 디자인하다",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "영어듣기",
        period: "2학기",
        weight: 10,
      },
      {
        id: "speaking",
        type: "수행평가",
        title: "영어말하기",
        period: "2학기",
        weight: 10,
      },
      {
        id: "vocabulary",
        type: "수행평가",
        title: "어휘력 키우기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "japanese",
    name: "일본어",
    color: "bg-red-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 50,
      },
      {
        id: "culture",
        type: "수행평가",
        title: "생활어휘력 형성평가",
        period: "2학기",
        weight: 25,
      },
      {
        id: "portfolio",
        type: "수행평가",
        title: "학습활동 포트폴리오",
        period: "2학기",
        weight: 25,
      },
    ],
  },
  {
    id: "career",
    name: "진로와 직업",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
  {
    id: "literacy",
    name: "문해력과 질문1",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
  {
    id: "social-emotional",
    name: "사회 정서 리터러시",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
]

const buheungSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2일차 · 2교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "1일차 · 3교시",
        weight: 30,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "writing",
        type: "수행평가",
        title: "주장하는 글쓰기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "3일차 · 2교시",
        weight: 40,
      },
      {
        id: "global-citizen",
        type: "수행평가",
        title: "세계 시민 프로젝트 활동하기",
        period: "2학기",
        weight: 30,
      },
      {
        id: "science-ethics",
        type: "수행평가",
        title: "과학윤리 보고서 작성하기",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "1일차 · 1교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2일차 · 1교시",
        weight: 30,
      },
      {
        id: "revolution",
        type: "수행평가",
        title: "시민혁명 4컷 만화 그리기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "people",
        type: "수행평가",
        title: "역사 인물 탐구하기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "1일차 · 3교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2일차 · 2교시",
        weight: 30,
      },
      {
        id: "plane-figure",
        type: "수행평가",
        title: "평면도형 프로젝트 활동하기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "similarity",
        type: "수행평가",
        title: "도형의 닮음 프로젝트 활동하기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2일차 · 1교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "1일차 · 1교시",
        weight: 30,
      },
      {
        id: "parallax",
        type: "수행평가",
        title: "별의 시차 탐구하기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "electricity",
        type: "수행평가",
        title: "전류, 저항, 전압의 관계 탐구하기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "information",
    name: "정보",
    color: "bg-sky-500",
    assessments: [
      {
        id: "intelligence",
        type: "수행평가",
        title: "지능인식 특성 보고서 작성하기",
        period: "2학기",
        weight: 30,
      },
      {
        id: "digital",
        type: "수행평가",
        title: "디지털 수 표현 분석하기",
        period: "2학기",
        weight: 40,
      },
      {
        id: "algorithm",
        type: "수행평가",
        title: "알고리즘 이해하기",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "1일차 · 2교시",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "3일차 · 1교시",
        weight: 30,
      },
      {
        id: "speaking",
        type: "수행평가",
        title: "영어 말하기 및 수행활동 발표하기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "writing",
        type: "수행평가",
        title: "인물 소개 글쓰기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "hanmun",
    name: "한문",
    color: "bg-red-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2일차 · 3교시",
        weight: 40,
      },
      {
        id: "characters",
        type: "수행평가",
        title: "한자 쓰기",
        period: "2학기",
        weight: 30,
      },
      {
        id: "idiom-book",
        type: "수행평가",
        title: "나만의 성어 미니북 만들기",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "backhand",
        type: "수행평가",
        title: "백핸드 경기 수행하기",
        period: "2학기",
        weight: 50,
      },
      {
        id: "futsal",
        type: "수행평가",
        title: "풋살 경기 수행하기",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "recorder",
        type: "수행평가",
        title: "리코더 연주하기",
        period: "2학기",
        weight: 40,
      },
      {
        id: "singing",
        type: "수행평가",
        title: "제재곡 가창하기",
        period: "2학기",
        weight: 40,
      },
      {
        id: "dansoh",
        type: "수행평가",
        title: "단소 연주하기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "pattern",
        type: "수행평가",
        title: "패턴 원포화 제작하기",
        period: "2학기",
        weight: 50,
      },
      {
        id: "calligraphy",
        type: "수행평가",
        title: "캘리그라피 제작하기",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "environment",
    name: "부산의 환경과 미래",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
  {
    id: "career-design",
    name: "교과 진로 디자인",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
  {
    id: "growth",
    name: "성장수업",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
]

const gaegeumSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "essay",
        type: "수행평가",
        title: "이웃을 소재로 산문쓰기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "독서프로젝트",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "relationships",
        type: "수행평가",
        title: "타인과 올바른 관계 맺기",
        period: "2학기",
        weight: 30,
      },
      {
        id: "human-rights",
        type: "수행평가",
        title: "사회적 약자의 인권 찾기",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "industrial-revolution",
        type: "수행평가",
        title: "산업혁명 시기 보고서 작성하기",
        period: "2학기",
        weight: 50,
      },
      {
        id: "great-depression",
        type: "수행평가",
        title: "대공황 시기 팜플렛 작성하기",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "triangle-centers",
        type: "수행평가",
        title: "삼각형의 외심과 내심 탐구",
        period: "2학기",
        weight: 20,
      },
      {
        id: "similarity",
        type: "수행평가",
        title: "도형의 닮음과 평행선이 그리는 세계",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "measurement",
        type: "수행평가",
        title: "측정 변화 실험",
        period: "2학기",
        weight: 20,
      },
      {
        id: "stars",
        type: "수행평가",
        title: "별의 특성",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "construction",
        type: "수행평가",
        title: "건설 문제 프로젝트",
        period: "2학기",
        weight: 30,
      },
      {
        id: "question",
        type: "수행평가",
        title: "질문 프로젝트",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "영어듣기능력평가",
        period: "2학기",
        weight: 10,
      },
      {
        id: "conversation",
        type: "수행평가",
        title: "일상생활 대화하기",
        period: "2학기",
        weight: 15,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "영어독서로 위인 탐구하기",
        period: "2학기",
        weight: 15,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "basketball",
        type: "수행평가",
        title: "농구",
        period: "2학기",
        weight: 50,
      },
      {
        id: "soccer",
        type: "수행평가",
        title: "축구",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "history",
        type: "수행평가",
        title: "시대별 음악 감상(바로크, 고전파)",
        period: "2학기",
        weight: 50,
      },
      {
        id: "introduction",
        type: "수행평가",
        title: "나만의 음악 소개하기",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "literacy-2",
    name: "문해력과 질문2",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
  {
    id: "career-design",
    name: "교과 진로 디자인",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
]

const centumSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기",
        period: "9~12월",
        weight: 40,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "civil-disobedience",
        type: "수행평가",
        title: "시민불복종 사례 보고서",
        period: "9월",
        weight: 30,
      },
      {
        id: "environment",
        type: "수행평가",
        title: "환경신문 만들기",
        period: "11월",
        weight: 30,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "modern-history",
        type: "수행평가",
        title: "근현대사 주제탐구 프로젝트",
        period: "8~11월",
        weight: 40,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "geometry",
        type: "수행평가",
        title: "도형의 성질 미니북 만들기",
        period: "10월",
        weight: 20,
      },
      {
        id: "probability",
        type: "수행평가",
        title: "확률 프로젝트",
        period: "12월",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "electricity",
        type: "수행평가",
        title: "전기와 자기 실험 탐구 평가",
        period: "10월",
        weight: 20,
      },
      {
        id: "matter-energy",
        type: "수행평가",
        title: "물질과 에너지 실험 탐구 평가",
        period: "11월",
        weight: 20,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "transportation",
        type: "수행평가",
        title: "수송기술 포트폴리오",
        period: "10~11월",
        weight: 30,
      },
      {
        id: "meal-plan",
        type: "수행평가",
        title: "균형 잡힌 식사 계획",
        period: "10월",
        weight: 30,
      },
    ],
  },
  {
    id: "information",
    name: "정보",
    color: "bg-sky-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "programming",
        type: "수행평가",
        title: "문제해결과 프로그래밍",
        period: "9월",
        weight: 40,
      },
      {
        id: "hardware-software",
        type: "수행평가",
        title: "하드웨어와 소프트웨어 찾기",
        period: "11월",
        weight: 20,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "영어 듣기",
        period: "9월",
        weight: 10,
      },
      {
        id: "speaking",
        type: "수행평가",
        title: "영어 말하기",
        period: "10월",
        weight: 20,
      },
      {
        id: "writing",
        type: "수행평가",
        title: "영어 쓰기",
        period: "8~12월",
        weight: 10,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "jump-rope",
        type: "수행평가",
        title: "줄넘기",
        period: "9월",
        weight: 30,
      },
      {
        id: "shuttle-run",
        type: "수행평가",
        title: "왕복오래달리기",
        period: "10월",
        weight: 30,
      },
      {
        id: "basketball",
        type: "수행평가",
        title: "농구",
        period: "12월",
        weight: 40,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "opera",
        type: "수행평가",
        title: "오페라 감상보고서 및 공연가이드북 만들기",
        period: "9월",
        weight: 50,
      },
      {
        id: "newspaper",
        type: "수행평가",
        title: "음악신문 만들기",
        period: "11월",
        weight: 50,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "design",
        type: "수행평가",
        title: "디자인",
        period: "9월",
        weight: 50,
      },
      {
        id: "criticism",
        type: "수행평가",
        title: "감상비평",
        period: "10월",
        weight: 50,
      },
    ],
  },
]

const busanGirlsSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기",
        period: "9~11월",
        weight: 20,
      },
      {
        id: "conversation",
        type: "수행평가",
        title: "공감하고 조정하는 대화하기",
        period: "8~9월",
        weight: 10,
      },
      {
        id: "multimodal-writing",
        type: "수행평가",
        title: "복합양식 자료를 활용하여 글 쓰기",
        period: "9~10월",
        weight: 10,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "ethical-issue",
        type: "수행평가",
        title: "윤리적 쟁점 탐구 보고서 작성하기",
        period: "9~10월",
        weight: 30,
      },
      {
        id: "film-science",
        type: "수행평가",
        title: "영화로 과학 기술 성찰하기",
        period: "10~11월",
        weight: 30,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "french-revolution",
        type: "수행평가",
        title: "프랑스 혁명 속 여성의 목소리-연설문 작성하기",
        period: "9~10월",
        weight: 20,
      },
      {
        id: "world-war",
        type: "수행평가",
        title: "세계 대전의 교훈을 담은 국제 평화 원칙 만들기",
        period: "11~12월",
        weight: 20,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "triangle-centers",
        type: "수행평가",
        title: "삼각형의 외심과 내심 프로젝트",
        period: "8~9월",
        weight: 20,
      },
      {
        id: "quadrilateral",
        type: "수행평가",
        title: "사각형 탐구하기",
        period: "9월",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "photosynthesis",
        type: "수행평가",
        title: "식물의 광합성과 호흡의 관계 탐구",
        period: "8월",
        weight: 20,
      },
      {
        id: "heart",
        type: "수행평가",
        title: "심장의 혈액 이동 탐구",
        period: "9월",
        weight: 20,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "egg-car",
        type: "수행평가",
        title: "에그 카 크러시 프로젝트",
        period: "10월",
        weight: 50,
      },
      {
        id: "construction",
        type: "수행평가",
        title: "건설 기술 프로젝트",
        period: "12월",
        weight: 50,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "영어 듣기",
        period: "9월",
        weight: 10,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "영어 독서",
        period: "9월",
        weight: 15,
      },
      {
        id: "speaking",
        type: "수행평가",
        title: "영어 말하기(원어민 인터뷰)",
        period: "11~12월",
        weight: 15,
      },
    ],
  },
  {
    id: "hanmun",
    name: "한문",
    color: "bg-red-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "holiday-card",
        type: "수행평가",
        title: "명절 카드 만들기",
        period: "9월",
        weight: 30,
      },
      {
        id: "calendar",
        type: "수행평가",
        title: "절기 달력 제작하기",
        period: "9~10월",
        weight: 30,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "jegichagi",
        type: "수행평가",
        title: "제기차기",
        period: "9~10월",
        weight: 30,
      },
      {
        id: "circuit",
        type: "수행평가",
        title: "서킷 트레이닝",
        period: "10~11월",
        weight: 30,
      },
      {
        id: "soccer",
        type: "수행평가",
        title: "축구볼",
        period: "9~11월",
        weight: 40,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "singing",
        type: "수행평가",
        title: "가창",
        period: "9~10월",
        weight: 50,
      },
      {
        id: "newspaper",
        type: "수행평가",
        title: "음악 신문 만들기",
        period: "10~11월",
        weight: 50,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "munjado",
        type: "수행평가",
        title: "현대 문자도",
        period: "8~10월",
        weight: 50,
      },
      {
        id: "instatoon",
        type: "수행평가",
        title: "인스타툰",
        period: "10~12월",
        weight: 50,
      },
    ],
  },
  {
    id: "health",
    name: "보건",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
  {
    id: "digital-self-directed",
    name: "디지털 자기주도",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
]

const busanCentralGirlsSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기",
        period: "9~11월",
        weight: 20,
      },
      {
        id: "reflection",
        type: "수행평가",
        title: "작품 속 인물과 대화하며 삶 성찰",
        period: "9~10월",
        weight: 20,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "justice",
        type: "수행평가",
        title: "정의로운 사회의 실현",
        period: "9월",
        weight: 30,
      },
      {
        id: "media-ethics",
        type: "수행평가",
        title: "정보 통신 매체를 활용한 바른 제작하기",
        period: "10월",
        weight: 30,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "four-panel",
        type: "수행평가",
        title: "사인펜 네 컷 만화 제작하기",
        period: "9월",
        weight: 20,
      },
      {
        id: "imperialism",
        type: "수행평가",
        title: "제국주의 키워드 연표 작성하기",
        period: "11월",
        weight: 20,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "geometry-life",
        type: "수행평가",
        title: "실생활 속 도형 성질 탐구하기",
        period: "10월",
        weight: 20,
      },
      {
        id: "geometry-summary",
        type: "수행평가",
        title: "도형의 다양한 성질 정리하기",
        period: "11월",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "circulation",
        type: "수행평가",
        title: "순환계의 구조와 기능 탐구 실험",
        period: "9~10월",
        weight: 20,
      },
      {
        id: "energy",
        type: "수행평가",
        title: "전기와 에너지 전환 탐구",
        period: "11월",
        weight: 20,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "family-role",
        type: "수행평가",
        title: "행복한 가족관계를 위한 나의 역할 찾기",
        period: "9월",
        weight: 20,
      },
      {
        id: "car",
        type: "수행평가",
        title: "자동차 장치 만들기",
        period: "10~11월",
        weight: 40,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "영어 듣기",
        period: "9월",
        weight: 10,
      },
      {
        id: "speaking",
        type: "수행평가",
        title: "영어 말하기",
        period: "10~11월",
        weight: 15,
      },
      {
        id: "review",
        type: "수행평가",
        title: "마음을 감동시킨 감상문 쓰기",
        period: "9월",
        weight: 15,
      },
    ],
  },
  {
    id: "hanmun",
    name: "한문",
    color: "bg-red-500",
    assessments: [
      {
        id: "characters",
        type: "수행평가",
        title: "한자 쓰기",
        period: "8~11월",
        weight: 30,
      },
      {
        id: "career-writing",
        type: "수행평가",
        title: "진로 관련 한자 활용 글쓰기",
        period: "9월",
        weight: 30,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한문 풀이",
        period: "11월",
        weight: 40,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "target",
        type: "수행평가",
        title: "표적 경기",
        period: "9월",
        weight: 50,
      },
      {
        id: "jump-rope",
        type: "수행평가",
        title: "음악 줄넘기",
        period: "10월",
        weight: 50,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "dictionary",
        type: "수행평가",
        title: "악기 사전 제작",
        period: "9월",
        weight: 50,
      },
      {
        id: "accompaniment",
        type: "수행평가",
        title: "나만의 반주 만들기",
        period: "11월",
        weight: 50,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "goods",
        type: "수행평가",
        title: "굿즈 디자인",
        period: "8~9월",
        weight: 50,
      },
      {
        id: "mask",
        type: "수행평가",
        title: "자화상 탈 디자인",
        period: "10~11월",
        weight: 50,
      },
    ],
  },
  {
    id: "global-citizen",
    name: "세계시민교육",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
  {
    id: "climate",
    name: "기후변화와 우리",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
  {
    id: "mindfulness",
    name: "청소년 마음챙김",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
]

const daesinGirlsSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "self-directed",
        type: "수행평가",
        title: "자기주도학습 프로젝트",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "project",
        type: "수행평가",
        title: "프로젝트 활동",
        period: "2학기",
        weight: 30,
      },
      {
        id: "classwork",
        type: "수행평가",
        title: "교과활동 평가",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "classwork",
        type: "수행평가",
        title: "교과활동 평가",
        period: "2학기",
        weight: 20,
      },
      {
        id: "project",
        type: "수행평가",
        title: "프로젝트 활동",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "project",
        type: "수행평가",
        title: "프로젝트 활동",
        period: "2학기",
        weight: 20,
      },
      {
        id: "formative",
        type: "수행평가",
        title: "교과활동 중 형성평가",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 25,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 25,
      },
      {
        id: "experiment",
        type: "수행평가",
        title: "실험과정평가",
        period: "2학기",
        weight: 25,
      },
      {
        id: "portfolio",
        type: "수행평가",
        title: "포트폴리오",
        period: "2학기",
        weight: 25,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "portfolio",
        type: "수행평가",
        title: "포트폴리오",
        period: "2학기",
        weight: 30,
      },
      {
        id: "project",
        type: "수행평가",
        title: "프로젝트 활동",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "듣기평가",
        period: "2학기",
        weight: 10,
      },
      {
        id: "speaking",
        type: "수행평가",
        title: "영어 말하기",
        period: "2학기",
        weight: 15,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "독서 포트폴리오",
        period: "2학기",
        weight: 15,
      },
    ],
  },
  {
    id: "japanese",
    name: "일본어",
    color: "bg-red-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "characters",
        type: "수행평가",
        title: "일본어 문자이해",
        period: "2학기",
        weight: 30,
      },
      {
        id: "project",
        type: "수행평가",
        title: "과정형 프로젝트",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "field",
        type: "수행평가",
        title: "필드형 스포츠",
        period: "2학기",
        weight: 50,
      },
      {
        id: "environment",
        type: "수행평가",
        title: "생활환경형 스포츠",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "performance",
        type: "수행평가",
        title: "연주",
        period: "2학기",
        weight: 50,
      },
      {
        id: "appreciation",
        type: "수행평가",
        title: "감상",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "experience",
        type: "수행평가",
        title: "미적 체험",
        period: "2학기",
        weight: 50,
      },
      {
        id: "expression",
        type: "수행평가",
        title: "표현",
        period: "2학기",
        weight: 50,
      },
    ],
  },
]

const chojangSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "선택형 10% · 서답형 10%",
        weight: 20,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "선택형 10% · 서답형 10%",
        weight: 20,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기",
        period: "2학기",
        weight: 25,
      },
      {
        id: "portfolio",
        type: "수행평가",
        title: "탐구활동 포트폴리오",
        period: "2학기",
        weight: 20,
      },
      {
        id: "multimodal",
        type: "수행평가",
        title: "복합 양식 글쓰기 평가",
        period: "2학기",
        weight: 15,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "선택형 40%",
        weight: 40,
      },
      {
        id: "justice",
        type: "수행평가",
        title: "사회 정의 실현 방안 찾기",
        period: "2학기",
        weight: 30,
      },
      {
        id: "moral-problem",
        type: "수행평가",
        title: "사회적 도덕 문제 해결 방안 찾기",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "선택형 18% · 서답형 12%",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "선택형 18% · 서답형 12%",
        weight: 30,
      },
      {
        id: "world-history",
        type: "수행평가",
        title: "세계사 생각 글쓰기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "interview",
        type: "수행평가",
        title: "역사 인물 인터뷰",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "선택형 18% · 서답형 12%",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "선택형 18% · 서답형 12%",
        weight: 30,
      },
      {
        id: "triangle",
        type: "수행평가",
        title: "삼각형 탐구활동",
        period: "2학기",
        weight: 20,
      },
      {
        id: "quadrilateral",
        type: "수행평가",
        title: "사각형 탐구활동",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "선택형 18% · 서답형 12%",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "선택형 18% · 서답형 12%",
        weight: 30,
      },
      {
        id: "nutrient",
        type: "수행평가",
        title: "영양소 검출 반응 실험",
        period: "2학기",
        weight: 20,
      },
      {
        id: "light",
        type: "수행평가",
        title: "광원으로부터의 거리에 따른 빛의 세기 실험",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "선택형 40%",
        weight: 40,
      },
      {
        id: "floor-plan",
        type: "수행평가",
        title: "주택 평면 설계하기",
        period: "2학기",
        weight: 40,
      },
      {
        id: "typography",
        type: "수행평가",
        title: "타이포그래피",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "선택형 15% · 서답형 15%",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "선택형 15% · 서답형 15%",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "듣기평가",
        period: "2학기",
        weight: 10,
      },
      {
        id: "conversation",
        type: "수행평가",
        title: "관심사와 경험 물어보고 답하기",
        period: "2학기",
        weight: 15,
      },
      {
        id: "vocabulary",
        type: "수행평가",
        title: "어휘 포트폴리오",
        period: "2학기",
        weight: 15,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "volleyball",
        type: "수행평가",
        title: "배구 언더핸드 및 오버핸드 리시브",
        period: "2학기",
        weight: 50,
      },
      {
        id: "soccer",
        type: "수행평가",
        title: "축구 리프팅",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "kalimba",
        type: "수행평가",
        title: "칼림바 연주",
        period: "2학기",
        weight: 70,
      },
      {
        id: "portfolio",
        type: "수행평가",
        title: "연주 및 감상 포트폴리오",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "optical-art",
        type: "수행평가",
        title: "착시 아트",
        period: "2학기",
        weight: 40,
      },
      {
        id: "wire-art",
        type: "수행평가",
        title: "저밀도 철조 조형 만들기",
        period: "2학기",
        weight: 40,
      },
      {
        id: "magnet",
        type: "수행평가",
        title: "토형 모양 마그넷 만들기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "life-japanese",
    name: "생활일본어",
    color: "bg-red-500",
    assessments: [
      {
        id: "ordering",
        type: "수행평가",
        title: "일본문화 메뉴 주문하기",
        period: "2학기",
        weight: 50,
      },
      {
        id: "tourism",
        type: "수행평가",
        title: "일본 관광지 소개자료 만들기",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "life-chinese",
    name: "생활중국어",
    color: "bg-lime-500",
    assessments: [
      {
        id: "hobby",
        type: "수행평가",
        title: "취미 소개와 인사말 하기",
        period: "2학기",
        weight: 50,
      },
      {
        id: "sentences",
        type: "수행평가",
        title: "문장 완성하여 쓰기",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "life-spanish",
    name: "생활스페인어",
    color: "bg-orange-400",
    assessments: [
      {
        id: "friend",
        type: "수행평가",
        title: "친구 소개 글쓰기",
        period: "2학기",
        weight: 50,
      },
      {
        id: "hand-mark",
        type: "수행평가",
        title: "핸드마크 소개하기",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "health",
    name: "보건",
    color: "bg-pink-500",
    assessments: [
      {
        id: "cpr",
        type: "수행평가",
        title: "심폐소생술 및 자동심장충격기 실습",
        period: "2학기",
        weight: 50,
      },
      {
        id: "infection",
        type: "수행평가",
        title: "유행성 감염병 발표",
        period: "2학기",
        weight: 50,
      },
    ],
  },
]

const busanDaesinSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 20,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 20,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "한 학기 한 권 읽기",
        period: "2학기",
        weight: 30,
      },
      {
        id: "inquiry",
        type: "수행평가",
        title: "주제 탐구 발표",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 40,
      },
      {
        id: "debate",
        type: "수행평가",
        title: "도덕적 가치 토론",
        period: "2학기",
        weight: 30,
      },
      {
        id: "cardnews",
        type: "수행평가",
        title: "환경 카드 뉴스 만들기",
        period: "2학기",
        weight: 30,
      },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "inquiry",
        type: "수행평가",
        title: "주제 탐구",
        period: "2학기",
        weight: 20,
      },
      {
        id: "writing",
        type: "수행평가",
        title: "역사 글쓰기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "triangle",
        type: "수행평가",
        title: "삼각형 프로젝트",
        period: "2학기",
        weight: 20,
      },
      {
        id: "probability",
        type: "수행평가",
        title: "실생활 확률 프로젝트",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "nutrient",
        type: "수행평가",
        title: "영양소 검출하기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "periodic",
        type: "수행평가",
        title: "주기율표 탐구하기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      {
        id: "roleplay",
        type: "수행평가",
        title: "가족 갈등 해결 역할극",
        period: "2학기",
        weight: 50,
      },
      {
        id: "presentation",
        type: "수행평가",
        title: "과제 발표",
        period: "2학기",
        weight: 25,
      },
      {
        id: "portfolio",
        type: "수행평가",
        title: "신재생 에너지 및 생명·적정 기술 포트폴리오",
        period: "2학기",
        weight: 25,
      },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      {
        id: "midterm",
        type: "지필평가",
        title: "중간고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "final",
        type: "지필평가",
        title: "기말고사",
        period: "2학기",
        weight: 30,
      },
      {
        id: "listening",
        type: "수행평가",
        title: "영어 듣기",
        period: "2학기",
        weight: 10,
      },
      {
        id: "reading",
        type: "수행평가",
        title: "영어 리딩 프로그레스",
        period: "2학기",
        weight: 15,
      },
      {
        id: "writing",
        type: "수행평가",
        title: "영어 글쓰기",
        period: "2학기",
        weight: 15,
      },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      {
        id: "flagfootball-skill",
        type: "수행평가",
        title: "플래그 풋볼 기능",
        period: "2학기",
        weight: 30,
      },
      {
        id: "flagfootball-game",
        type: "수행평가",
        title: "플래그 풋볼 경기",
        period: "2학기",
        weight: 20,
      },
      {
        id: "handball-skill",
        type: "수행평가",
        title: "핸드볼 기능",
        period: "2학기",
        weight: 30,
      },
      {
        id: "handball-game",
        type: "수행평가",
        title: "핸드볼 경기",
        period: "2학기",
        weight: 20,
      },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      {
        id: "instrument",
        type: "수행평가",
        title: "기악(기타 연주하기)",
        period: "2학기",
        weight: 50,
      },
      {
        id: "singing",
        type: "수행평가",
        title: "가창(뮤지컬 넘버 부르기)",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      {
        id: "goods",
        type: "수행평가",
        title: "굿즈 디자인",
        period: "2학기",
        weight: 50,
      },
      {
        id: "ceramic",
        type: "수행평가",
        title: "도자기 도안 제작",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "japanese",
    name: "일본어",
    color: "bg-red-500",
    assessments: [
      {
        id: "portfolio",
        type: "수행평가",
        title: "일본어 기초 포트폴리오",
        period: "2학기",
        weight: 50,
      },
      {
        id: "project",
        type: "수행평가",
        title: "일본어 성장 프로젝트",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "chinese",
    name: "중국어",
    color: "bg-lime-500",
    assessments: [
      {
        id: "vocabulary",
        type: "수행평가",
        title: "중국어 단어 성장 프로젝트",
        period: "2학기",
        weight: 50,
      },
      {
        id: "culture",
        type: "수행평가",
        title: "중국 문화 발표",
        period: "2학기",
        weight: 50,
      },
    ],
  },
  {
    id: "career",
    name: "진로",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  },
]

const SUBJECT_ORDER = [
  "korean",
  "math",
  "english",
  "science",
  "social",
  "history",
  "japanese",
  "life-japanese",
  "chinese",
  "life-chinese",
  "life-spanish",
  "hanmun",
  "tech",
  "information",
  "ethics",
  "music",
  "art",
  "pe",
  "health",
]

function orderSubjects(subjects: Subject[]) {
  const orderById = new Map(SUBJECT_ORDER.map((id, index) => [id, index]))

  return subjects
    .map((subject, originalIndex) => ({ subject, originalIndex }))
    .sort((a, b) => {
      if (a.subject.passOnly !== b.subject.passOnly)
        return a.subject.passOnly ? 1 : -1
      if (a.subject.passOnly && b.subject.passOnly)
        return a.originalIndex - b.originalIndex

      const aOrder = orderById.get(a.subject.id) ?? SUBJECT_ORDER.length
      const bOrder = orderById.get(b.subject.id) ?? SUBJECT_ORDER.length
      return aOrder - bOrder || a.originalIndex - b.originalIndex
    })
    .map(({ subject }) => subject)
}

const THREE_LEVEL_SUBJECT_IDS = new Set(["pe", "music", "art"])

type School = {
  id: string
  name: string
  shortName: string
  /** localStorage key. 배포 후에는 바꾸지 마세요. 바꾸면 기존 사용자의 저장된 점수를 읽지 못합니다. */
  storageKey: string
  subjects: Subject[]
  schoolCode?: string
  grade?: number
  semester?: number
  sourceKey?: string
}

const EMPTY_SCHOOL: School = {
  id: "",
  name: "",
  shortName: "",
  storageKey: "",
  subjects: [
    {
      id: "subject-1",
      name: "",
      color: "bg-slate-400",
      assessments: [],
    },
  ],
}

// 학교 목록(드롭다운 순서)의 단일 출처입니다.
// 학교를 추가하려면 위에 과목 배열을 만들고, 여기에 항목 하나만 추가하면 됩니다.
// 점수 저장·불러오기·클라우드 동기화·화면 선택지는 모두 이 배열에서 만들어집니다.
const schools = [
  {
    id: "gaegeum-girls",
    name: "개금여자중학교",
    shortName: "개금여중",
    storageKey: "semester-score-calculator-gaegeum-girls",
    subjects: orderSubjects(gaegeumSubjects),
  },
  {
    id: "geoje-girls",
    name: "거제여자중학교",
    shortName: "거제여중",
    storageKey: "semester-score-calculator-geoje-girls",
    subjects: orderSubjects(geojeSubjects),
  },
  {
    id: "daesin-girls",
    name: "대신여자중학교",
    shortName: "대신여중",
    storageKey: "semester-score-calculator-daesin-girls",
    subjects: orderSubjects(daesinGirlsSubjects),
  },
  {
    id: "manduk",
    name: "만덕중학교",
    shortName: "만덕중",
    storageKey: "semester-score-calculator",
    subjects: orderSubjects(mandukSubjects),
  },
  {
    id: "busan-daesin",
    name: "부산대신중학교",
    shortName: "부산대신중",
    storageKey: "semester-score-calculator-busan-daesin",
    subjects: orderSubjects(busanDaesinSubjects),
  },
  {
    id: "busan-girls",
    name: "부산여자중학교",
    shortName: "부산여중",
    storageKey: "semester-score-calculator-busan-girls",
    subjects: orderSubjects(busanGirlsSubjects),
  },
  {
    id: "busan-central-girls",
    name: "부산중앙여자중학교",
    shortName: "부산중앙여중",
    storageKey: "semester-score-calculator-busan-central-girls",
    subjects: orderSubjects(busanCentralGirlsSubjects),
  },
  {
    id: "buheung",
    name: "부흥중학교",
    shortName: "부흥중",
    storageKey: "semester-score-calculator-buheung",
    subjects: orderSubjects(buheungSubjects),
  },
  {
    id: "centum",
    name: "센텀중학교",
    shortName: "센텀중",
    storageKey: "semester-score-calculator-centum",
    subjects: orderSubjects(centumSubjects),
  },
  {
    id: "chojang",
    name: "초장중학교",
    shortName: "초장중",
    storageKey: "semester-score-calculator-chojang",
    subjects: orderSubjects(chojangSubjects),
  },
] as const satisfies readonly School[]

type SchoolId = string
type CustomSchool = School & {
  schoolCode: string
  grade: number
  semester: number
}

const CUSTOM_SCHOOLS_STORAGE_KEY = "grade-calculator-custom-schools-v1"

function customSchoolsStorageKey(uid: string) {
  return `${CUSTOM_SCHOOLS_STORAGE_KEY}:${uid}`
}

function configToSchool(
  config: SchoolConfig,
  sourceKey?: string,
): CustomSchool {
  const schoolKey = getSchoolKey(config)
  return {
    id: `custom:${schoolKey}`,
    name: `${config.schoolName} ${config.grade}학년 ${config.semester}학기`,
    shortName: config.schoolName,
    storageKey: `semester-score-calculator-custom-${schoolKey}`,
    // User-created schools keep the explicit order selected in the editor.
    // Their Subject shape and canonical IDs remain compatible with orderSubjects().
    subjects: config.subjects.map((subject) => ({
      ...subject,
      assessments: subject.assessments.map((assessment) => ({ ...assessment })),
    })),
    schoolCode: config.schoolCode,
    grade: config.grade,
    semester: config.semester,
    sourceKey,
  }
}

function schoolToConfig(school: CustomSchool): SchoolConfig {
  return {
    schoolCode: school.schoolCode,
    schoolName: school.shortName,
    grade: school.grade,
    semester: school.semester,
    subjects: school.subjects,
  }
}

function readCustomSchools(uid: string): CustomSchool[] {
  try {
    const data = JSON.parse(
      localStorage.getItem(customSchoolsStorageKey(uid)) || "[]",
    ) as unknown
    if (!Array.isArray(data)) return []
    return data.flatMap((item) => {
      if (typeof item !== "object" || item === null) return []
      const record = item as Record<string, unknown>
      const config = parseSchoolConfig(record.config)
      if (!config) return []
      return [
        configToSchool(
          config,
          typeof record.sourceKey === "string" ? record.sourceKey : undefined,
        ),
      ]
    })
  } catch {
    return []
  }
}

function readStoredScores(storageKey: string): Scores {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}")
  } catch {
    return {}
  }
}

function compactUserData(data: UserData): UserData {
  return Object.fromEntries(
    Object.entries(data).flatMap(([schoolId, scores]) => {
      const enteredScores = Object.fromEntries(
        Object.entries(scores).filter(([, value]) => value !== ""),
      )
      return Object.keys(enteredScores).length > 0
        ? [[schoolId, enteredScores]]
        : []
    }),
  )
}

function scoreKey(subjectId: string, assessmentId: string) {
  return `${subjectId}.${assessmentId}`
}

function getSubjectResult(subject: Subject, scores: Scores) {
  const filled = subject.assessments.filter(
    (item) =>
      scores[scoreKey(subject.id, item.id)] !== undefined &&
      scores[scoreKey(subject.id, item.id)] !== "",
  ).length
  const score = subject.assessments.reduce((total, item) => {
    const value = Number(scores[scoreKey(subject.id, item.id)] || 0)
    return total + value * (item.weight / 100)
  }, 0)

  return {
    score,
    filled,
    total: subject.assessments.length,
    complete: filled === subject.assessments.length,
  }
}

function getAchievement(score: number, subjectId: string) {
  const roundedScore = Math.round(score)

  if (THREE_LEVEL_SUBJECT_IDS.has(subjectId)) {
    if (roundedScore >= 80) return "A"
    if (roundedScore >= 60) return "B"
    return "C"
  }

  if (roundedScore >= 90) return "A"
  if (roundedScore >= 80) return "B"
  if (roundedScore >= 70) return "C"
  if (roundedScore >= 60) return "D"
  return "E"
}

function Icon({
  name,
  className = "size-5",
}: {
  name: "book" | "chart" | "check" | "spark" | "trash" | "arrow" | "sun" | "moon" | "share"
  className?: string
}) {
  const paths = {
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    spark: (
      <>
        <path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3Z" />
        <path d="m5 17-.7 2.3L2 20l2.3.7L5 23l.7-2.3L8 20l-2.3-.7L5 17Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m19 6-1 15H6L5 6" />
        <path d="M10 11v5M14 11v5" />
      </>
    ),
    arrow: (
      <>
        <path d="m9 18 6-6-6-6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </>
    ),
    moon: (
      <path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z" />
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  )
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = localStorage.getItem("grade-calculator-theme")
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  })
  const [customSchools, setCustomSchools] = useState<CustomSchool[]>([])
  const [transientSchools, setTransientSchools] = useState<CustomSchool[]>([])
  const allSchools = useMemo<School[]>(
    () => [...customSchools, ...transientSchools],
    [customSchools, transientSchools],
  )
  const [schoolChoice, setSchoolChoice] = useState<SchoolId | "">("")
  const [schoolSearch, setSchoolSearch] = useState(
    () =>
      new URLSearchParams(window.location.search).get("schoolid")?.trim() || "",
  )
  const [publishedSchools, setPublishedSchools] =
    useState<PublishedSchoolSummary[]>([])
  const [schoolSearchStatus, setSchoolSearchStatus] =
    useState<"loading" | "ready" | "error">("loading")
  const [schoolSearchError, setSchoolSearchError] = useState("")
  const [openingSchoolKey, setOpeningSchoolKey] = useState<string | null>(null)
  const [activeSchoolId, setActiveSchoolId] = useState<SchoolId | null>(null)
  const [activeSubjectId, setActiveSubjectId] = useState("")
  const [scoresBySchool, setScoresBySchool] =
    useState<Record<SchoolId, Scores>>(() =>
      Object.fromEntries(
        allSchools.map((school) => [
          school.id,
          readStoredScores(school.storageKey),
        ]),
      ),
    )
  const [showSchoolManager, setShowSchoolManager] = useState(false)
  const [schoolManagerInitialView, setSchoolManagerInitialView] =
    useState<"mine" | "editor">("mine")
  const [openManagerAfterSignIn, setOpenManagerAfterSignIn] = useState(false)
  const [showPrivacyConsent, setShowPrivacyConsent] = useState(false)
  const [privacyConsents, setPrivacyConsents] = useState({
    policy: false,
    googleAccount: false,
    cloudSync: false,
  })
  const [showNotice, setShowNotice] = useState(
    () =>
      localStorage.getItem(`grade-calculator-notice-hidden:${appVersion}`) !==
      "true",
  )
  const [user, setUser] = useState<User | null>(null)
  const isAdmin =
    Boolean(import.meta.env.VITE_MASTER_UID) &&
    user?.uid === import.meta.env.VITE_MASTER_UID
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  )
  const [authReady, setAuthReady] = useState(false)
  const [syncStatus, setSyncStatus] =
    useState<"local" | "loading" | "saving" | "synced" | "error">("local")
  const scoresRef = useRef<UserData>(scoresBySchool)
  const syncUserIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueueRef = useRef(Promise.resolve())
  const oneTapOpenedRef = useRef(false)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = `${theme} only`
  }, [theme])

  useEffect(() => {
    let cancelled = false
    setSchoolSearchStatus("loading")
    listPublishedSchools()
      .then((items) => {
        if (cancelled) return
        setPublishedSchools(items)
        setSchoolSearchStatus("ready")
      })
      .catch(() => {
        if (cancelled) return
        setSchoolSearchStatus("error")
        setSchoolSearchError(
          "배포된 평가계획을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) return
    localStorage.setItem(
      customSchoolsStorageKey(user.uid),
      JSON.stringify(
        customSchools.map((school) => ({
          config: schoolToConfig(school),
          ...(school.sourceKey ? { sourceKey: school.sourceKey } : {}),
        })),
      ),
    )
  }, [customSchools, user])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const followSystemTheme = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem("grade-calculator-theme")) {
        setTheme(event.matches ? "dark" : "light")
      }
    }

    media.addEventListener("change", followSystemTheme)
    return () => media.removeEventListener("change", followSystemTheme)
  }, [])

  useEffect(() => {
    scoresRef.current = scoresBySchool
    allSchools.forEach((school) => {
      localStorage.setItem(
        school.storageKey,
        JSON.stringify(scoresBySchool[school.id] || {}),
      )
    })

    const syncUserId = syncUserIdRef.current
    if (!syncUserId || auth.currentUser?.uid !== syncUserId) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const dataToSave = compactUserData(scoresRef.current)
      setSyncStatus("saving")
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (auth.currentUser?.uid !== syncUserId) return
          await saveUserData(dataToSave)
          if (auth.currentUser?.uid === syncUserId) setSyncStatus("synced")
        })
        .catch(() => {
          if (auth.currentUser?.uid === syncUserId) setSyncStatus("error")
        })
    }, 600)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [allSchools, scoresBySchool])

  useEffect(() => {
    let authGeneration = 0
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const generation = ++authGeneration
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      syncUserIdRef.current = null
      setUser(nextUser)
      setAuthReady(true)
      setCustomSchools(nextUser ? readCustomSchools(nextUser.uid) : [])

      if (!nextUser) {
        setSyncStatus("local")
        return
      }

      setSyncStatus("loading")
      try {
        const { data: cloudData } = await loadUserData()
        if (
          generation !== authGeneration ||
          auth.currentUser?.uid !== nextUser.uid
        )
          return

        // Cloud values win on conflicts; local-only values are retained and uploaded.
        const localData = scoresRef.current
        const schoolIds = new Set([
          ...Object.keys(localData),
          ...Object.keys(cloudData || {}),
        ])
        const mergedData = Object.fromEntries(
          [...schoolIds].map((id) => [
            id,
            { ...(localData[id] || {}), ...(cloudData?.[id] || {}) },
          ]),
        ) as UserData

        scoresRef.current = mergedData
        syncUserIdRef.current = nextUser.uid
        setScoresBySchool(mergedData)
        setSyncStatus("synced")
      } catch {
        if (generation === authGeneration) setSyncStatus("error")
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user || !openManagerAfterSignIn) return
    setOpenManagerAfterSignIn(false)
    setSchoolManagerInitialView("editor")
    setShowSchoolManager(true)
  }, [openManagerAfterSignIn, user])

  useEffect(() => {
    if (isAdmin || !activeSchoolId) return
    const selected = allSchools.find((school) => school.id === activeSchoolId)
    if (selected?.schoolCode === "0000000") setActiveSchoolId(null)
  }, [activeSchoolId, allSchools, isAdmin])

  async function handleSignIn() {
    setPrivacyConsents({
      policy: false,
      googleAccount: false,
      cloudSync: false,
    })
    setShowPrivacyConsent(true)
  }

  function cancelSignIn() {
    setShowPrivacyConsent(false)
    setPrivacyConsents({
      policy: false,
      googleAccount: false,
      cloudSync: false,
    })
    setOpenManagerAfterSignIn(false)
  }

  async function completeSignIn() {
    if (!Object.values(privacyConsents).every(Boolean)) return
    setShowPrivacyConsent(false)
    setSyncStatus("loading")
    try {
      await signInWithPopup(auth, googleProvider)
    } catch {
      setSyncStatus("error")
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth)
    } catch {
      setSyncStatus("error")
    }
  }

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark"
      localStorage.setItem("grade-calculator-theme", nextTheme)
      return nextTheme
    })
  }

  function openSchoolManager(view: "mine" | "editor" = "mine") {
    setSchoolManagerInitialView(view)
    setShowSchoolManager(true)
  }

  async function requestSchoolAddition() {
    if (user) {
      openSchoolManager(
        isAdmin || customSchools.length === 0 ? "editor" : "mine",
      )
      return
    }
    setOpenManagerAfterSignIn(true)
    await handleSignIn()
  }

  function saveCustomSchool(
    config: SchoolConfig,
    sourceKey?: string,
    previousId?: string,
  ) {
    const nextSchool = configToSchool(config, sourceKey)
    setCustomSchools((current) => {
      const isAdmin =
        Boolean(import.meta.env.VITE_MASTER_UID) &&
        user?.uid === import.meta.env.VITE_MASTER_UID
      if (!isAdmin && !previousId && current.length >= 1) return current
      return [
        ...current.filter(
          (school) => school.id !== nextSchool.id && school.id !== previousId,
        ),
        nextSchool,
      ]
    })
    setScoresBySchool((current) => {
      const next = { ...current }
      const previousScores = previousId ? next[previousId] : undefined
      if (previousId && previousId !== nextSchool.id) delete next[previousId]
      next[nextSchool.id] =
        previousScores ||
        next[nextSchool.id] ||
        readStoredScores(nextSchool.storageKey)
      return next
    })
    if (previousId && previousId !== nextSchool.id) {
      const previous = customSchools.find((school) => school.id === previousId)
      if (previous) localStorage.removeItem(previous.storageKey)
    }
    setSchoolChoice(nextSchool.id)
  }

  function deleteCustomSchool(id: string) {
    const school = customSchools.find((item) => item.id === id)
    if (school) localStorage.removeItem(school.storageKey)
    setCustomSchools((current) => current.filter((item) => item.id !== id))
    setScoresBySchool((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    if (schoolChoice === id) setSchoolChoice("")
    if (activeSchoolId === id) setActiveSchoolId(null)
  }

  function handlePublishedDeletion(schoolKey: string) {
    const matching = allSchools.filter(
      (school) =>
        school.sourceKey === schoolKey || school.id === `custom:${schoolKey}`,
    )
    const ids = new Set(matching.map((school) => school.id))
    matching.forEach((school) => localStorage.removeItem(school.storageKey))
    setCustomSchools((current) =>
      current.filter((school) => !ids.has(school.id)),
    )
    setTransientSchools((current) =>
      current.filter((school) => !ids.has(school.id)),
    )
    setPublishedSchools((current) =>
      current.filter((school) => school.schoolKey !== schoolKey),
    )
    setScoresBySchool((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => !ids.has(id)),
      ),
    )
    if (ids.has(schoolChoice)) setSchoolChoice("")
    if (activeSchoolId && ids.has(activeSchoolId)) setActiveSchoolId(null)
  }

  function openSchool(id: string) {
    const school = allSchools.find((item) => item.id === id)
    if (!school || school.subjects.length === 0) return
    setScoresBySchool((current) => ({
      ...current,
      [id]: current[id] || readStoredScores(school.storageKey),
    }))
    setSchoolChoice(id)
    setActiveSubjectId(
      school.subjects.find((subject) => !subject.passOnly)?.id ||
        school.subjects[0].id,
    )
    setActiveSchoolId(id)
    setShowSchoolManager(false)
  }

  async function openPublishedSchool(
    schoolKey: string,
    allowRestricted = false,
  ) {
    setOpeningSchoolKey(schoolKey)
    setSchoolSearchError("")
    try {
      const config = await getPublishedSchool(schoolKey)
      if (config.schoolCode === "0000000" && !isAdmin && !allowRestricted) {
        setSchoolSearchError("이 평가계획은 허용된 계정에서만 열 수 있습니다.")
        return
      }
      const nextSchool = configToSchool(config, schoolKey)
      setTransientSchools((current) => [
        ...current.filter((school) => school.id !== nextSchool.id),
        nextSchool,
      ])
      setScoresBySchool((current) => ({
        ...current,
        [nextSchool.id]:
          current[nextSchool.id] || readStoredScores(nextSchool.storageKey),
      }))
      setSchoolChoice(nextSchool.id)
      setActiveSubjectId(
        nextSchool.subjects.find((subject) => !subject.passOnly)?.id ||
          nextSchool.subjects[0].id,
      )
      setActiveSchoolId(nextSchool.id)
      setShowSchoolManager(false)
    } catch (error) {
      setSchoolSearchError(
        error instanceof Error
          ? error.message
          : "평가계획을 불러오지 못했습니다.",
      )
    } finally {
      setOpeningSchoolKey(null)
    }
  }

  useEffect(() => {
    if (
      oneTapOpenedRef.current ||
      schoolSearchStatus === "loading" ||
      !/\/onetap\/?$/.test(window.location.pathname)
    )
      return
    const params = new URLSearchParams(window.location.search)
    const schoolKey = (params.get("schooid") || params.get("schoolid"))?.trim()
    if (!schoolKey || !/^\d+-[1-3]-[1-2]$/.test(schoolKey)) return
    oneTapOpenedRef.current = true
    void openPublishedSchool(schoolKey, true)
  }, [schoolSearchStatus])

  const noticeDialog = showNotice ? (
    <MarkdownDialog
      actions={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => {
              localStorage.setItem(
                `grade-calculator-notice-hidden:${appVersion}`,
                "true",
              )
              setShowNotice(false)
            }}
            type="button"
          >
            다시 보지 않기
          </button>
          <button
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-indigo-700"
            onClick={() => setShowNotice(false)}
            type="button"
          >
            확인
          </button>
        </div>
      }
      onClose={() => setShowNotice(false)}
      source={`${import.meta.env.BASE_URL}notice.md`}
      title="공지사항"
    />
  ) : null

  const privacyDialog = showPrivacyConsent ? (
    <MarkdownDialog
      actions={
        <div className="space-y-3">
          <fieldset className="space-y-3">
            <legend className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
              아래 필수 항목에 모두 동의해 주세요.
            </legend>
            {[
              {
                key: "policy" as const,
                label: "개인정보처리방침을 확인했으며 이에 동의합니다.",
              },
              {
                key: "googleAccount" as const,
                label:
                  "Google 로그인 시 계정 식별자, 표시 이름 및 이메일 주소 처리에 동의합니다.",
              },
              {
                key: "cloudSync" as const,
                label:
                  "입력한 점수를 계정별로 저장하고 클라우드에서 동기화하는 것에 동의합니다.",
              },
            ].map((consent) => (
              <label
                className="flex items-start gap-3 text-sm font-bold leading-5 text-slate-700 dark:text-slate-200"
                key={consent.key}
              >
                <input
                  checked={privacyConsents[consent.key]}
                  className="mt-0.5 size-4 shrink-0 accent-indigo-600"
                  onChange={(event) =>
                    setPrivacyConsents((current) => ({
                      ...current,
                      [consent.key]: event.target.checked,
                    }))
                  }
                  required
                  type="checkbox"
                />
                {consent.label}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2 sm:justify-end">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              onClick={cancelSignIn}
              type="button"
            >
              취소
            </button>
            <button
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
              disabled={!Object.values(privacyConsents).every(Boolean)}
              onClick={() => void completeSignIn()}
              type="button"
            >
              동의하고 Google 로그인
            </button>
          </div>
        </div>
      }
      ariaLabel="로그인 전 개인정보 수집 및 이용 동의"
      onClose={cancelSignIn}
      source={`${import.meta.env.BASE_URL}privacy.md`}
      title="개인정보처리방침 및 로그인 동의"
    />
  ) : null

  const themeControl = (
    <button
      aria-label={theme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-slate-800 dark:hover:text-[#aab2cc]"
      onClick={toggleTheme}
      title={theme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}
      type="button"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="size-5" />
    </button>
  )

  const authControl = (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      {user ? (
        <>
          <span
            className="max-w-44 truncate font-semibold text-slate-600 dark:text-slate-300"
            title={user.email || undefined}
          >
            {user.displayName || user.email || "Google 사용자"}
          </span>
          <span
            className={
              syncStatus === "error" ? "text-rose-600" : "text-slate-400"
            }
          >
            {syncStatus === "loading"
              ? "불러오는 중"
              : syncStatus === "saving"
                ? "저장 중"
                : syncStatus === "error"
                  ? "동기화 오류 · 로컬 저장 중"
                  : "동기화됨"}
          </span>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={handleSignOut}
            type="button"
          >
            로그아웃
          </button>
        </>
      ) : (
        <button
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-[#aab2cc]"
          disabled={!authReady || syncStatus === "loading"}
          onClick={handleSignIn}
          type="button"
        >
          Google로 로그인
        </button>
      )}
    </div>
  )
  const noticeControl = (
    <button
      className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      onClick={() => setShowNotice(true)}
      type="button"
    >
      공지사항 열기
    </button>
  )
  const schoolManager = showSchoolManager ? (
    <SchoolManager
      initialView={schoolManagerInitialView}
      isAdmin={isAdmin}
      onClose={() => setShowSchoolManager(false)}
      onDelete={deleteCustomSchool}
      onPublishedDeleted={handlePublishedDeletion}
      onOpen={openSchool}
      onOpenPublished={(schoolKey) => void openPublishedSchool(schoolKey)}
      onRequestSignIn={handleSignIn}
      onSave={saveCustomSchool}
      onShare={(id) => {
        const school = allSchools.find((item) => item.id === id)
        if (school) void shareSchool(school)
      }}
      schools={customSchools.map((school) => ({
        ...schoolToConfig(school),
        id: school.id,
        sourceKey: school.sourceKey,
      }))}
      user={user}
    />
  ) : null

  const dataSchoolId = activeSchoolId || schoolChoice || ""
  const dataSchool =
    allSchools.find((school) => school.id === dataSchoolId) || EMPTY_SCHOOL
  const subjects = dataSchool.subjects
  const scores = scoresBySchool[dataSchoolId] || {}
  const setScores = (update: Scores | ((current: Scores) => Scores)) => {
    setScoresBySchool((current) => {
      const currentScores = current[dataSchoolId] || {}
      return {
        ...current,
        [dataSchoolId]:
          typeof update === "function" ? update(currentScores) : update,
      }
    })
  }
  const activeSubject =
    subjects.find((subject) => subject.id === activeSubjectId) || subjects[0]
  const results = useMemo(
    () =>
      Object.fromEntries(
        subjects.map((subject) => [
          subject.id,
          getSubjectResult(subject, scores),
        ]),
      ),
    [scores, subjects],
  )
  const completedResults = subjects
    .map((subject) => ({ subject, ...results[subject.id] }))
    .filter((result) => !result.subject.passOnly && result.complete)
  const gradedSubjectCount = subjects.filter(
    (subject) => !subject.passOnly,
  ).length
  const average = completedResults.length
    ? completedResults.reduce((sum, result) => sum + result.score, 0) /
      completedResults.length
    : 0
  const activeResult = results[activeSubject.id]
  const getExamAverage = (examId: "midterm" | "final") => {
    const exams = subjects.flatMap((subject) =>
      subject.assessments
        .filter(
          (assessment) =>
            assessment.type === "지필평가" && assessment.id === examId,
        )
        .map((assessment) => ({
          key: scoreKey(subject.id, assessment.id),
        })),
    )
    const enteredScores = exams
      .map((exam) => scores[exam.key])
      .filter((score) => score !== undefined && score !== "")

    return {
      average:
        enteredScores.length > 0
          ? enteredScores.reduce((sum, score) => sum + Number(score), 0) /
            enteredScores.length
          : null,
      entered: enteredScores.length,
      total: exams.length,
    }
  }
  const midtermAverage = getExamAverage("midterm")
  const finalAverage = getExamAverage("final")
  const missingAssessments = activeSubject.assessments.filter(
    (item) =>
      scores[scoreKey(activeSubject.id, item.id)] === undefined ||
      scores[scoreKey(activeSubject.id, item.id)] === "",
  )
  const achievementGuide = (() => {
    if (missingAssessments.length !== 1) return null

    const remaining = missingAssessments[0]
    const maximumScore = activeResult.score + remaining.weight
    const roundedMaximumScore = Math.round(maximumScore)
    const targets = THREE_LEVEL_SUBJECT_IDS.has(activeSubject.id)
      ? [
          { grade: "A", threshold: 80 },
          { grade: "B", threshold: 60 },
          { grade: "C", threshold: 0 },
        ]
      : [
          { grade: "A", threshold: 90 },
          { grade: "B", threshold: 80 },
          { grade: "C", threshold: 70 },
          { grade: "D", threshold: 60 },
          { grade: "E", threshold: 0 },
        ]
    const target =
      targets.find((item) => roundedMaximumScore >= item.threshold) ||
      targets[targets.length - 1]
    const minimumRawScore = target.threshold === 0 ? 0 : target.threshold - 0.5
    const exactMinimum =
      (minimumRawScore - activeResult.score) / (remaining.weight / 100)
    const minimumScore = Math.min(100, Math.max(0, Math.ceil(exactMinimum)))

    return { remaining, grade: target.grade, minimumScore }
  })()

  function updateScore(key: string, value: string) {
    if (value === "") {
      setScores((current) => ({ ...current, [key]: "" }))
      return
    }
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      setScores((current) => ({
        ...current,
        [key]: String(Math.min(100, Math.max(0, parsed))),
      }))
    }
  }

  function clearScores() {
    if (
      Object.values(scores).some((value) => value !== "") &&
      window.confirm("입력한 모든 점수를 초기화할까요?")
    ) {
      setScores({})
    }
  }

  const activeSchool = allSchools.find((school) => school.id === activeSchoolId)
  const activeSchoolDisplayName = activeSchool ? activeSchool.shortName : ""
  async function shareSchool(school: School) {
    const schoolId =
      school.sourceKey ||
      (school.schoolCode && school.grade && school.semester
        ? `${school.schoolCode}-${school.grade}-${school.semester}`
        : "")
    if (!schoolId) {
      setShareStatus("error")
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set("schoolid", schoolId)
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${school.shortName} 평가계획`,
          text: "평가계획을 확인해 보세요.",
          url: url.toString(),
        })
        setShareStatus("copied")
        window.setTimeout(() => setShareStatus("idle"), 1800)
        return
      }
      await navigator.clipboard.writeText(url.toString())
      setShareStatus("copied")
      window.setTimeout(() => setShareStatus("idle"), 1800)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setShareStatus("error")
    }
  }
  const normalizedSchoolSearch = schoolSearch.trim().toLocaleLowerCase("ko")
  const isNumericSchoolSearch = /^\d+$/.test(normalizedSchoolSearch)
  const canSearchSchools =
    normalizedSchoolSearch.length > 0 &&
    (!isNumericSchoolSearch || normalizedSchoolSearch.length >= 7)
  const localSchoolResults = canSearchSchools
    ? allSchools
        .filter((school) => isAdmin || school.schoolCode !== "0000000")
        .filter(
          (school) =>
            school.name
              .toLocaleLowerCase("ko")
              .includes(normalizedSchoolSearch) ||
            school.shortName
              .toLocaleLowerCase("ko")
              .includes(normalizedSchoolSearch) ||
            school.sourceKey?.toLocaleLowerCase("ko") ===
              normalizedSchoolSearch,
        )
        .slice(0, 8)
    : []
  const publishedSchoolResults = canSearchSchools
    ? publishedSchools
        .filter((school) => isAdmin || school.schoolCode !== "0000000")
        .filter(
          (school) =>
            school.schoolName
              .toLocaleLowerCase("ko")
              .includes(normalizedSchoolSearch) ||
            school.schoolKey.toLocaleLowerCase("ko") ===
              normalizedSchoolSearch ||
            school.schoolCode.toLocaleLowerCase("ko") ===
              normalizedSchoolSearch,
        )
        .filter(
          (school) =>
            !localSchoolResults.some(
              (local) => local.sourceKey === school.schoolKey,
            ),
        )
        .slice(0, 12)
    : []

  if (!activeSchool) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-5 py-12 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
        {noticeDialog}
        {privacyDialog}
        {schoolManager}
        <div className="absolute right-5 top-5 z-10 sm:right-8 sm:top-8">
          {themeControl}
        </div>
        <div className="absolute -left-24 top-16 size-72 rounded-full bg-indigo-500/15 blur-3xl dark:bg-indigo-600/20" />
        <div className="absolute -right-20 bottom-8 size-80 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/15" />
        <main className="relative w-full max-w-lg">
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-indigo-500 text-white"
              style={{
                boxShadow: "oklab(0.257 0.0176167 -0.088259) 0px 8px 10px -6px",
              }}
            >
              <Icon name="book" className="size-7" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              원점수 계산기 by dohoon{" "}
              <span className="font-semibold text-slate-400 dark:text-slate-500">
                v{appVersion}
              </span>
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl mt-2">
              학교 평가계획 찾기
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              학교 이름이나 배포 코드로 사용할 수 있는 평가계획을 검색하세요.
            </p>
          </div>

          <form
            className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-300/50 sm:p-8 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:shadow-black/30"
            onSubmit={(event) => {
              event.preventDefault()
              const exactKey = schoolSearch.trim()
              const localMatch = localSchoolResults[0]
              const publishedMatch = publishedSchoolResults[0]
              if (localSchoolResults.length === 1 && localMatch) {
                openSchool(localMatch.id)
              } else if (
                publishedSchoolResults.length === 1 &&
                publishedMatch
              ) {
                void openPublishedSchool(publishedMatch.schoolKey)
              } else if (/^\d+-[1-3]-[1-2]$/.test(exactKey)) {
                void openPublishedSchool(exactKey)
              }
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-700 dark:text-slate-200">
                학교 검색
              </span>
              <div className="relative">
                <input
                  autoComplete="off"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 py-0 pl-4 pr-12 text-base font-bold outline-none transition placeholder:font-semibold placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/50"
                  onChange={(event) => {
                    setSchoolSearch(event.target.value)
                    setSchoolSearchError("")
                  }}
                  placeholder="학교명 또는 학교 코드로 검색"
                  value={schoolSearch}
                />
              </div>
              {isNumericSchoolSearch && !canSearchSchools && (
                <span className="mt-2 block text-xs font-semibold text-slate-400">
                  학교 코드는 7자리 이상 입력해 주세요.
                </span>
              )}
            </label>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {schoolSearchStatus === "loading" && (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-400 dark:bg-slate-800">
                  배포된 평가계획을 불러오는 중...
                </p>
              )}
              {canSearchSchools &&
                [
                  ...localSchoolResults.map((school) => ({
                    kind: "local" as const,
                    id: school.id,
                    key: school.id,
                    name: school.shortName,
                    grade: school.grade || 2,
                    semester: school.semester || 2,
                    code: school.sourceKey || school.schoolCode,
                  })),
                  ...publishedSchoolResults.map((school) => ({
                    kind: "published" as const,
                    id: school.schoolKey,
                    key: school.schoolKey,
                    name: school.schoolName,
                    grade: school.grade,
                    semester: school.semester,
                    code: school.schoolKey,
                  })),
                ].map((result) => (
                  <button
                    className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10"
                    disabled={openingSchoolKey === result.key}
                    key={`${result.kind}:${result.key}`}
                    onClick={() =>
                      result.kind === "local"
                        ? openSchool(result.id)
                        : void openPublishedSchool(result.key)
                    }
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">
                        {result.name}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {result.grade}학년 {result.semester}학기
                        {result.code ? ` · ${result.code}` : " · 기본 평가계획"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-extrabold text-indigo-600 dark:text-indigo-300">
                      {openingSchoolKey === result.key
                        ? "불러오는 중"
                        : "계산기 열기"}
                    </span>
                  </button>
                ))}
              {canSearchSchools &&
                schoolSearchStatus !== "loading" &&
                localSchoolResults.length === 0 &&
                publishedSchoolResults.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm dark:border-slate-700">
                    <p className="text-slate-400">
                      검색 결과가 없습니다. 학교명이나 배포 코드를 확인해
                      주세요.
                    </p>
                    <button
                      className="mt-3 font-extrabold text-orange-600 underline decoration-orange-300 underline-offset-4 transition hover:text-red-600 dark:text-orange-300"
                      onClick={() => void requestSchoolAddition()}
                      type="button"
                    >
                      이 학교를 추가할까요?
                    </button>
                    {!user && (
                      <p className="mt-2 text-xs font-semibold text-slate-400">
                        로그인 하고 우리 학교를 추가할 수 있어요.
                      </p>
                    )}
                  </div>
                )}
            </div>
            {schoolSearchError && (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                {schoolSearchError}
              </p>
            )}
            <div className="my-5 flex items-center gap-3 text-xs font-bold text-slate-300 dark:text-slate-600">
              <span className="h-px flex-1 bg-current" />
              또는
              <span className="h-px flex-1 bg-current" />
            </div>
            <button
              className="flex h-12 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-5 text-sm font-extrabold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
              onClick={() => void requestSchoolAddition()}
              type="button"
            >
              {user ? "내 학교 관리 · 학교 추가" : "Google 로그인 후 학교 추가"}
            </button>
          </form>
          <div className="mt-4">{authControl}</div>
          <div className="mt-2 text-center">{noticeControl}</div>
          <div className="mt-2 text-center">
            <VisitorStats />
          </div>
          <div className="mt-3 text-center">
            <a
              className="text-sm font-semibold text-slate-500 transition hover:text-indigo-600 hover:underline dark:text-slate-400 dark:hover:text-white"
              href="https://www.instagram.com/grade.calculator_/"
              rel="noreferrer"
              target="_blank"
            >
              Instagram · @grade.calculator_
            </a>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {noticeDialog}
      {privacyDialog}
      {schoolManager}
      <header className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-4 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Icon name="book" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold tracking-[-0.02em] text-indigo-600 dark:text-[#aab2cc] sm:text-[11px] sm:tracking-[0.08em]">
                {activeSchoolDisplayName} · {activeSchool.grade || 2}-
                {activeSchool.semester || 2} 평가계획
              </p>
              <p className="text-lg font-extrabold tracking-tight">
                원점수 계산기
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end items-center gap-0.5 sm:gap-1">
            {noticeControl}
            <div className="mr-1 hidden md:block">{authControl}</div>
            {themeControl}
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() => void shareSchool(activeSchool)}
              aria-label="평가계획 공유"
              type="button"
            >
              <Icon name="share" className="size-4" />
              <span className="hidden sm:inline">
                {shareStatus === "copied"
                  ? "링크 복사됨"
                  : shareStatus === "error"
                    ? "공유 실패"
                    : "공유"}
              </span>
            </button>
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() =>
                user ? openSchoolManager("mine") : void handleSignIn()
              }
              type="button"
            >
              <span className="hidden sm:inline">
                {user ? "내 학교 관리" : "로그인 후 학교 추가"}
              </span>
              <span className="sm:hidden">{user ? "관리" : "학교 추가"}</span>
            </button>
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() => setActiveSchoolId(null)}
              type="button"
            >
              <Icon name="arrow" className="size-4 rotate-180" />
              <span className="hidden sm:inline">학교 변경</span>
            </button>
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              disabled={!Object.values(scores).some((value) => value !== "")}
              onClick={clearScores}
              type="button"
            >
              <Icon name="trash" className="size-4" />
              <span className="hidden sm:inline">전체 초기화</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="mb-8">
          <div className="mb-5">
            <p className="mb-1 text-sm font-bold text-indigo-600 dark:text-[#aab2cc]">
              내 성적 한눈에 보기
            </p>
            <h1 className="break-words text-[21px] font-black tracking-[-0.045em] sm:text-[25px] sm:tracking-tight">
              2026 {activeSchoolDisplayName} {activeSchool.grade || 2}-
              {activeSchool.semester || 2} 성적계산기
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm shadow-indigo-100/60 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:shadow-none">
              <div className="mb-4 hidden size-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm sm:flex dark:bg-slate-800 dark:text-[#aab2cc]">
                <Icon name="chart" className="size-5" />
              </div>
              <p className="text-sm font-semibold text-indigo-700 dark:text-[#aab2cc]">
                중간고사 {midtermAverage.total}과목 평균
              </p>
              <p className="mt-1 text-2xl font-black text-indigo-950 dark:text-[#c4cadc]">
                {midtermAverage.average === null
                  ? "—"
                  : midtermAverage.average.toFixed(2)}
                {midtermAverage.average !== null && (
                  <span className="ml-1 text-sm font-semibold text-indigo-400 dark:text-[#8f99b8]">
                    점
                  </span>
                )}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-indigo-400 dark:text-[#8f99b8]">
                {midtermAverage.entered}/{midtermAverage.total}과목 입력
              </p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm shadow-violet-100/60 dark:border-violet-500/30 dark:bg-violet-500/10 dark:shadow-none">
              <div className="mb-4 hidden size-9 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm sm:flex dark:bg-slate-800 dark:text-[#b5adca]">
                <Icon name="chart" className="size-5" />
              </div>
              <p className="text-sm font-semibold text-violet-700 dark:text-[#b5adca]">
                기말고사 {finalAverage.total}과목 평균
              </p>
              <p className="mt-1 text-2xl font-black text-violet-950 dark:text-[#cec9da]">
                {finalAverage.average === null
                  ? "—"
                  : finalAverage.average.toFixed(2)}
                {finalAverage.average !== null && (
                  <span className="ml-1 text-sm font-semibold text-violet-400 dark:text-[#978eaf]">
                    점
                  </span>
                )}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-violet-400 dark:text-[#978eaf]">
                {finalAverage.entered}/{finalAverage.total}과목 입력
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <div className="mb-4 hidden size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:flex dark:bg-indigo-500/10 dark:text-[#aab2cc]">
                <Icon name="check" className="size-5" />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                입력 완료 과목
              </p>
              <p className="mt-1 text-2xl font-black">
                {completedResults.length}
                <span className="ml-1 text-sm font-semibold text-slate-400">
                  / {gradedSubjectCount}과목
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <div className="mb-4 hidden size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:flex dark:bg-emerald-500/10 dark:text-emerald-300">
                <Icon name="chart" className="size-5" />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                원점수 평균
              </p>
              <p className="mt-1 text-2xl font-black">
                {completedResults.length ? average.toFixed(1) : "—"}
                {completedResults.length > 0 && (
                  <span className="ml-1 text-sm font-semibold text-slate-400">
                    점
                  </span>
                )}
              </p>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="font-extrabold">과목 선택</h2>
              <p className="mt-1 text-xs text-slate-400">
                과목별 입력 현황을 확인하세요
              </p>
            </div>
            <nav
              className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-visible"
              aria-label="과목 목록"
            >
              {subjects.map((subject) => {
                const result = results[subject.id]
                const active = subject.id === activeSubject.id
                const passOnly = subject.passOnly === true
                return (
                  <button
                    key={subject.id}
                    className={`group flex min-w-44 items-center gap-3 rounded-xl px-3 py-3 text-left transition lg:w-full ${
                      passOnly
                        ? "cursor-not-allowed bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500"
                        : active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-[#aab2cc]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                    disabled={passOnly}
                    onClick={() => setActiveSubjectId(subject.id)}
                    type="button"
                  >
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${subject.color}`}
                    />
                    <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
                      <span className="truncate text-sm font-bold leading-5">
                        {subject.name}
                      </span>
                      <span
                        className={`text-right text-base font-black leading-5 ${
                          passOnly
                            ? "text-slate-600"
                            : result.complete
                              ? active
                                ? "text-indigo-700 dark:text-[#aab2cc]"
                                : "text-slate-900 dark:text-white"
                              : "text-slate-300 dark:text-slate-600"
                        }`}
                      >
                        {passOnly
                          ? "P"
                          : result.complete
                            ? getAchievement(result.score, subject.id)
                            : "—"}
                      </span>
                      <span
                        className={`text-[11px] leading-4 ${
                          active
                            ? "text-indigo-400 dark:text-[#8f99b8]"
                            : "text-slate-400"
                        }`}
                      >
                        {passOnly
                          ? "원점수 미산출"
                          : result.complete
                            ? "입력 완료"
                            : `${result.filled}/${result.total} 입력`}
                      </span>
                      <span
                        className={`text-right text-[11px] font-semibold leading-4 ${
                          active
                            ? "text-indigo-400 dark:text-[#8f99b8]"
                            : "text-slate-400"
                        }`}
                      >
                        {!passOnly && result.complete
                          ? `${result.score.toFixed(1)}점`
                          : ""}
                      </span>
                    </span>
                    {!passOnly && (
                      <Icon
                        name="arrow"
                        className={`size-4 shrink-0 ${
                          active
                            ? "text-indigo-400 dark:text-[#8f99b8]"
                            : "text-slate-300"
                        }`}
                      />
                    )}
                  </button>
                )
              })}
            </nav>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            {activeSubject.passOnly ? (
              <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
                <span
                  className={`mb-5 size-4 rounded-full ${activeSubject.color}`}
                />
                <h2 className="text-2xl font-black">{activeSubject.name}</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                  이 과목은 원점수를 산출하지 않는 과목입니다. 평가 항목과
                  점수를 입력하지 않으며 과목 목록에는 P로 표시됩니다.
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 px-5 py-6 dark:border-slate-800 sm:px-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`size-3 rounded-full ${activeSubject.color}`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-black">
                            {activeSubject.name}
                          </h2>
                          {activeResult.complete && (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                              입력 완료
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {activeResult.filled}개 입력 · 총 {activeResult.total}
                          개 평가
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white sm:min-w-44">
                      <p className="text-xs font-semibold text-slate-400">
                        {activeResult.complete
                          ? "최종 원점수"
                          : "현재 예상 원점수"}
                      </p>
                      <p className="mt-1 text-3xl font-black tabular-nums">
                        {activeResult.score.toFixed(0)}
                        <span className="ml-1 text-sm font-semibold text-slate-400">
                          / 100
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                      style={{
                        width: `${(activeResult.filled / activeResult.total) * 100}%`,
                      }}
                    />
                  </div>
                  {achievementGuide && (
                    <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600 shadow-sm dark:bg-slate-800 dark:text-amber-300">
                        <Icon name="spark" className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold">
                          {achievementGuide.grade === "E"
                            ? "이런,"
                            : `최고 성취도 ${achievementGuide.grade}까지 도전할 수 있어요`}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                          {achievementGuide.grade === "E" ? (
                            <>
                              남은 &lsquo;{achievementGuide.remaining.title}
                              &rsquo;에서 100점을 받아도 성취도는 E입니다.
                            </>
                          ) : (
                            <>
                              남은 &lsquo;{achievementGuide.remaining.title}
                              &rsquo;에서 최소{" "}
                              <strong className="font-black">
                                {achievementGuide.minimumScore}점
                              </strong>
                              을 받으면 성취도 {achievementGuide.grade}를 달성할
                              수 있습니다.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 sm:p-7">
                  {(["지필평가", "수행평가"] as const).map((type) => {
                    const items = activeSubject.assessments.filter(
                      (item) => item.type === type,
                    )
                    if (!items.length) return null
                    return (
                      <div className="mb-8 last:mb-0" key={type}>
                        <div className="mb-3 flex items-center gap-2">
                          <h3 className="text-sm font-extrabold">{type}</h3>
                          <span className="text-xs font-medium text-slate-400">
                            총{" "}
                            {items.reduce((sum, item) => sum + item.weight, 0)}%
                            반영
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                          {items.map((item) => {
                            const key = scoreKey(activeSubject.id, item.id)
                            const value = scores[key] ?? ""
                            const contribution =
                              Number(value || 0) * (item.weight / 100)
                            return (
                              <div
                                className="grid gap-4 bg-white p-4 dark:bg-slate-900 sm:grid-cols-[minmax(0,1fr)_8rem_8.5rem] sm:items-center sm:px-5"
                                key={item.id}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {item.title}
                                  </p>
                                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                                    <span>
                                      {item.period ||
                                        `${activeSchool.semester}학기`}
                                    </span>
                                    <span className="size-1 rounded-full bg-slate-300" />
                                    <span className="font-semibold text-indigo-600 dark:text-[#aab2cc]">
                                      {item.weight}% 반영
                                    </span>
                                  </div>
                                </div>
                                <div className="hidden text-right sm:block">
                                  <p className="text-[11px] font-medium text-slate-400">
                                    반영 점수
                                  </p>
                                  <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-600 dark:text-slate-300">
                                    {value === ""
                                      ? "—"
                                      : contribution.toFixed(1)}
                                    점
                                  </p>
                                </div>
                                <label className="relative block">
                                  <span className="sr-only">
                                    {item.title} 점수
                                  </span>
                                  <input
                                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 text-right text-base font-extrabold tabular-nums outline-none transition placeholder:font-medium placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-600 dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/50"
                                    inputMode="decimal"
                                    max="100"
                                    min="0"
                                    onChange={(event) =>
                                      updateScore(key, event.target.value)
                                    }
                                    placeholder="0"
                                    type="number"
                                    value={value}
                                  />
                                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                    점
                                  </span>
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
