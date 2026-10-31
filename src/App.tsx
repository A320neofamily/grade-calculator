import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { loadUserData, saveUserData, type UserData } from "./userDataApi";
import VisitorStats from "./VisitorStats";
import { version as appVersion } from "../package.json";

type Assessment = {
  id: string;
  type: "지필평가" | "수행평가";
  title: string;
  period: string;
  weight: number;
};

type Subject = {
  id: string;
  name: string;
  color: string;
  assessments: Assessment[];
  passOnly?: boolean;
};

type Scores = Record<string, string>;

const mandukSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "10. 2.(금) · 4교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "12. 7.(월) · 2교시", weight: 30 },
      { id: "intro", type: "수행평가", title: "복합 양식 자료를 활용한 소개 글 쓰기", period: "9~10월", weight: 20 },
      { id: "reading", type: "수행평가", title: "한 학기 한 권 읽기 프로젝트", period: "11월", weight: 20 },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      { id: "metaverse", type: "수행평가", title: "가상공간 크리에이터 프로젝트", period: "10월", weight: 50 },
      { id: "newspaper", type: "수행평가", title: "통일 한국 신문 기획하기", period: "11월", weight: 50 },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "12. 8.(화) · 3교시", weight: 40 },
      { id: "revolution", type: "수행평가", title: "산업혁명 바로 알기 프로젝트", period: "10월", weight: 30 },
      { id: "china", type: "수행평가", title: "중국 근대화 운동 보고서", period: "10월", weight: 30 },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "10. 2.(금) · 2교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "12. 7.(월) · 4교시", weight: 30 },
      { id: "geometry", type: "수행평가", title: "도형 프로젝트", period: "9~11월", weight: 20 },
      { id: "essay", type: "수행평가", title: "수학 서술 챌린지", period: "9~12월", weight: 20 },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "10. 1.(목) · 2교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "12. 8.(화) · 4교시", weight: 30 },
      { id: "circulation", type: "수행평가", title: "순환계의 구조와 기능", period: "11월", weight: 20 },
      { id: "experiment", type: "수행평가", title: "몸의 법칙 실험", period: "11월", weight: 20 },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      { id: "construction", type: "수행평가", title: "건설기술 문제해결", period: "9~11월", weight: 50 },
      { id: "resource", type: "수행평가", title: "지속가능한 자원관리", period: "9~10월", weight: 30 },
      { id: "family", type: "수행평가", title: "건강한 가족관계", period: "11월", weight: 20 },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "10. 1.(목) · 4교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "12. 8.(화) · 2교시", weight: 30 },
      { id: "listening", type: "수행평가", title: "영어듣기", period: "9월", weight: 10 },
      { id: "writing", type: "수행평가", title: "영어쓰기", period: "10~11월", weight: 15 },
      { id: "speaking", type: "수행평가", title: "영어말하기", period: "10~11월", weight: 15 },
    ],
  },
  {
    id: "japanese",
    name: "일본어",
    color: "bg-red-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "12. 7.(월) · 3교시", weight: 40 },
      { id: "kana", type: "수행평가", title: "가타카나 받아쓰기", period: "9~10월", weight: 30 },
      { id: "conversation", type: "수행평가", title: "기초회화", period: "11월", weight: 30 },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      { id: "basketball1", type: "수행평가", title: "탁구", period: "9월", weight: 30 },
      { id: "volleyball1", type: "수행평가", title: "배구 Ⅰ", period: "11월", weight: 30 },
      { id: "volleyball2", type: "수행평가", title: "배구 Ⅱ", period: "11~12월", weight: 40 },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      { id: "piano", type: "수행평가", title: "피아노 코드 반주", period: "9월", weight: 40 },
      { id: "drum", type: "수행평가", title: "드럼 반주", period: "10월", weight: 30 },
      { id: "choir", type: "수행평가", title: "2부 합창", period: "11월", weight: 30 },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      { id: "dokdo", type: "수행평가", title: "독도 홍보 포스터", period: "8~10월", weight: 50 },
      { id: "unification", type: "수행평가", title: "통일 홍보 포스터", period: "10~12월", weight: 50 },
    ],
  },
];

const geojeSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "reading", type: "수행평가", title: "한 학기 한 권 읽기", period: "2학기", weight: 20 },
      { id: "brochure", type: "수행평가", title: "한국 소개 소책자 만들기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "unification", type: "수행평가", title: "배움질문 포트폴리오", period: "2학기", weight: 20 },
      { id: "people", type: "수행평가", title: "역사 인물 탐구", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "geometry1", type: "수행평가", title: "기하 프로젝트 Ⅰ", period: "2학기", weight: 20 },
      { id: "geometry2", type: "수행평가", title: "기하 프로젝트 Ⅱ", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "electric", type: "수행평가", title: "전자기 프로젝트", period: "2학기", weight: 20 },
      { id: "rock", type: "수행평가", title: "암석 파헤치기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      { id: "adaptation", type: "수행평가", title: "적응 유연성 프로젝트", period: "2학기", weight: 50 },
      { id: "construction", type: "수행평가", title: "건설기술 프로젝트", period: "2학기", weight: 50 },
    ],
  },
  {
    id: "information",
    name: "정보",
    color: "bg-sky-500",
    assessments: [
      { id: "data", type: "수행평가", title: "실생활 데이터 분석 및 문제 해결", period: "2학기", weight: 50 },
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
      { id: "futsal", type: "수행평가", title: "풋살", period: "2학기", weight: 50 },
      { id: "cheerleading", type: "수행평가", title: "치어리딩", period: "2학기", weight: 50 },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      { id: "folk-song", type: "수행평가", title: "민요 부르기", period: "2학기", weight: 50 },
      { id: "project", type: "수행평가", title: "음악사 프로젝트", period: "2학기", weight: 50 },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      { id: "pattern", type: "수행평가", title: "나만의 모던 책거리", period: "2학기", weight: 50 },
      { id: "tshirt", type: "수행평가", title: "메시지를 디자인하다", period: "2학기", weight: 50 },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "listening", type: "수행평가", title: "영어듣기", period: "2학기", weight: 10 },
      { id: "speaking", type: "수행평가", title: "영어말하기", period: "2학기", weight: 10 },
      { id: "vocabulary", type: "수행평가", title: "어휘력 키우기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "japanese",
    name: "일본어",
    color: "bg-red-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 50 },
      { id: "culture", type: "수행평가", title: "생활어휘력 형성평가", period: "2학기", weight: 25 },
      { id: "portfolio", type: "수행평가", title: "학습활동 포트폴리오", period: "2학기", weight: 25 },
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
];

const buheungSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2일차 · 2교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "1일차 · 3교시", weight: 30 },
      { id: "reading", type: "수행평가", title: "한 학기 한 권 읽기", period: "2학기", weight: 20 },
      { id: "writing", type: "수행평가", title: "주장하는 글쓰기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "3일차 · 2교시", weight: 40 },
      { id: "global-citizen", type: "수행평가", title: "세계 시민 프로젝트 활동하기", period: "2학기", weight: 30 },
      { id: "science-ethics", type: "수행평가", title: "과학윤리 보고서 작성하기", period: "2학기", weight: 30 },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "1일차 · 1교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2일차 · 1교시", weight: 30 },
      { id: "revolution", type: "수행평가", title: "시민혁명 4컷 만화 그리기", period: "2학기", weight: 20 },
      { id: "people", type: "수행평가", title: "역사 인물 탐구하기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "1일차 · 3교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2일차 · 2교시", weight: 30 },
      { id: "plane-figure", type: "수행평가", title: "평면도형 프로젝트 활동하기", period: "2학기", weight: 20 },
      { id: "similarity", type: "수행평가", title: "도형의 닮음 프로젝트 활동하기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2일차 · 1교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "1일차 · 1교시", weight: 30 },
      { id: "parallax", type: "수행평가", title: "별의 시차 탐구하기", period: "2학기", weight: 20 },
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
      { id: "digital", type: "수행평가", title: "디지털 수 표현 분석하기", period: "2학기", weight: 40 },
      { id: "algorithm", type: "수행평가", title: "알고리즘 이해하기", period: "2학기", weight: 30 },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "1일차 · 2교시", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "3일차 · 1교시", weight: 30 },
      {
        id: "speaking",
        type: "수행평가",
        title: "영어 말하기 및 수행활동 발표하기",
        period: "2학기",
        weight: 20,
      },
      { id: "writing", type: "수행평가", title: "인물 소개 글쓰기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "hanmun",
    name: "한문",
    color: "bg-red-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "2일차 · 3교시", weight: 40 },
      { id: "characters", type: "수행평가", title: "한자 쓰기", period: "2학기", weight: 30 },
      { id: "idiom-book", type: "수행평가", title: "나만의 성어 미니북 만들기", period: "2학기", weight: 30 },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      { id: "backhand", type: "수행평가", title: "백핸드 경기 수행하기", period: "2학기", weight: 50 },
      { id: "futsal", type: "수행평가", title: "풋살 경기 수행하기", period: "2학기", weight: 50 },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      { id: "recorder", type: "수행평가", title: "리코더 연주하기", period: "2학기", weight: 40 },
      { id: "singing", type: "수행평가", title: "제재곡 가창하기", period: "2학기", weight: 40 },
      { id: "dansoh", type: "수행평가", title: "단소 연주하기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      { id: "pattern", type: "수행평가", title: "패턴 원포화 제작하기", period: "2학기", weight: 50 },
      { id: "calligraphy", type: "수행평가", title: "캘리그라피 제작하기", period: "2학기", weight: 50 },
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
];

const gaegeumSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "essay", type: "수행평가", title: "이웃을 소재로 산문쓰기", period: "2학기", weight: 20 },
      { id: "reading", type: "수행평가", title: "독서프로젝트", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 40 },
      { id: "relationships", type: "수행평가", title: "타인과 올바른 관계 맺기", period: "2학기", weight: 30 },
      { id: "human-rights", type: "수행평가", title: "사회적 약자의 인권 찾기", period: "2학기", weight: 30 },
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
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
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
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "measurement", type: "수행평가", title: "측정 변화 실험", period: "2학기", weight: 20 },
      { id: "stars", type: "수행평가", title: "별의 특성", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 40 },
      { id: "construction", type: "수행평가", title: "건설 문제 프로젝트", period: "2학기", weight: 30 },
      { id: "question", type: "수행평가", title: "질문 프로젝트", period: "2학기", weight: 30 },
    ],
  },
  {
    id: "english",
    name: "영어",
    color: "bg-blue-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "listening", type: "수행평가", title: "영어듣기능력평가", period: "2학기", weight: 10 },
      { id: "conversation", type: "수행평가", title: "일상생활 대화하기", period: "2학기", weight: 15 },
      { id: "reading", type: "수행평가", title: "영어독서로 위인 탐구하기", period: "2학기", weight: 15 },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      { id: "basketball", type: "수행평가", title: "농구", period: "2학기", weight: 50 },
      { id: "soccer", type: "수행평가", title: "축구", period: "2학기", weight: 50 },
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
      { id: "introduction", type: "수행평가", title: "나만의 음악 소개하기", period: "2학기", weight: 50 },
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
];

const centumSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "reading", type: "수행평가", title: "한 학기 한 권 읽기", period: "9~12월", weight: 40 },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 40 },
      {
        id: "civil-disobedience",
        type: "수행평가",
        title: "시민불복종 사례 보고서",
        period: "9월",
        weight: 30,
      },
      { id: "environment", type: "수행평가", title: "환경신문 만들기", period: "11월", weight: 30 },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
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
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "geometry", type: "수행평가", title: "도형의 성질 미니북 만들기", period: "10월", weight: 20 },
      { id: "probability", type: "수행평가", title: "확률 프로젝트", period: "12월", weight: 20 },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
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
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 40 },
      {
        id: "transportation",
        type: "수행평가",
        title: "수송기술 포트폴리오",
        period: "10~11월",
        weight: 30,
      },
      { id: "meal-plan", type: "수행평가", title: "균형 잡힌 식사 계획", period: "10월", weight: 30 },
    ],
  },
  {
    id: "information",
    name: "정보",
    color: "bg-sky-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 40 },
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
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "listening", type: "수행평가", title: "영어 듣기", period: "9월", weight: 10 },
      { id: "speaking", type: "수행평가", title: "영어 말하기", period: "10월", weight: 20 },
      { id: "writing", type: "수행평가", title: "영어 쓰기", period: "8~12월", weight: 10 },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      { id: "jump-rope", type: "수행평가", title: "줄넘기", period: "9월", weight: 30 },
      { id: "shuttle-run", type: "수행평가", title: "왕복오래달리기", period: "10월", weight: 30 },
      { id: "basketball", type: "수행평가", title: "농구", period: "12월", weight: 40 },
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
      { id: "newspaper", type: "수행평가", title: "음악신문 만들기", period: "11월", weight: 50 },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      { id: "design", type: "수행평가", title: "디자인", period: "9월", weight: 50 },
      { id: "criticism", type: "수행평가", title: "감상비평", period: "10월", weight: 50 },
    ],
  },
];

const busanDaesinSubjects: Subject[] = [
  {
    id: "korean",
    name: "국어",
    color: "bg-rose-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 20 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 20 },
      { id: "reading", type: "수행평가", title: "한 학기 한 권 읽기", period: "2학기", weight: 30 },
      { id: "inquiry", type: "수행평가", title: "주제 탐구 발표", period: "2학기", weight: 30 },
    ],
  },
  {
    id: "ethics",
    name: "도덕",
    color: "bg-amber-500",
    assessments: [
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 40 },
      { id: "debate", type: "수행평가", title: "도덕적 가치 토론", period: "2학기", weight: 30 },
      { id: "cardnews", type: "수행평가", title: "환경 카드 뉴스 만들기", period: "2학기", weight: 30 },
    ],
  },
  {
    id: "history",
    name: "역사",
    color: "bg-orange-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "inquiry", type: "수행평가", title: "주제 탐구", period: "2학기", weight: 20 },
      { id: "writing", type: "수행평가", title: "역사 글쓰기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "math",
    name: "수학",
    color: "bg-indigo-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "triangle", type: "수행평가", title: "삼각형 프로젝트", period: "2학기", weight: 20 },
      { id: "probability", type: "수행평가", title: "실생활 확률 프로젝트", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "science",
    name: "과학",
    color: "bg-emerald-500",
    assessments: [
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "nutrient", type: "수행평가", title: "영양소 검출하기", period: "2학기", weight: 20 },
      { id: "periodic", type: "수행평가", title: "주기율표 탐구하기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "tech",
    name: "기술·가정",
    color: "bg-teal-500",
    assessments: [
      { id: "roleplay", type: "수행평가", title: "가족 갈등 해결 역할극", period: "2학기", weight: 50 },
      { id: "presentation", type: "수행평가", title: "과제 발표", period: "2학기", weight: 25 },
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
      { id: "midterm", type: "지필평가", title: "중간고사", period: "2학기", weight: 30 },
      { id: "final", type: "지필평가", title: "기말고사", period: "2학기", weight: 30 },
      { id: "listening", type: "수행평가", title: "영어 듣기", period: "2학기", weight: 10 },
      { id: "reading", type: "수행평가", title: "영어 리딩 프로그레스", period: "2학기", weight: 15 },
      { id: "writing", type: "수행평가", title: "영어 글쓰기", period: "2학기", weight: 15 },
    ],
  },
  {
    id: "pe",
    name: "체육",
    color: "bg-cyan-500",
    assessments: [
      { id: "flagfootball-skill", type: "수행평가", title: "플래그 풋볼 기능", period: "2학기", weight: 30 },
      { id: "flagfootball-game", type: "수행평가", title: "플래그 풋볼 경기", period: "2학기", weight: 20 },
      { id: "handball-skill", type: "수행평가", title: "핸드볼 기능", period: "2학기", weight: 30 },
      { id: "handball-game", type: "수행평가", title: "핸드볼 경기", period: "2학기", weight: 20 },
    ],
  },
  {
    id: "music",
    name: "음악",
    color: "bg-violet-500",
    assessments: [
      { id: "instrument", type: "수행평가", title: "기악(기타 연주하기)", period: "2학기", weight: 50 },
      { id: "singing", type: "수행평가", title: "가창(뮤지컬 넘버 부르기)", period: "2학기", weight: 50 },
    ],
  },
  {
    id: "art",
    name: "미술",
    color: "bg-fuchsia-500",
    assessments: [
      { id: "goods", type: "수행평가", title: "굿즈 디자인", period: "2학기", weight: 50 },
      { id: "ceramic", type: "수행평가", title: "도자기 도안 제작", period: "2학기", weight: 50 },
    ],
  },
  {
    id: "japanese",
    name: "일본어",
    color: "bg-red-500",
    assessments: [
      { id: "portfolio", type: "수행평가", title: "일본어 기초 포트폴리오", period: "2학기", weight: 50 },
      { id: "project", type: "수행평가", title: "일본어 성장 프로젝트", period: "2학기", weight: 50 },
    ],
  },
  {
    id: "chinese",
    name: "중국어",
    color: "bg-lime-500",
    assessments: [
      { id: "vocabulary", type: "수행평가", title: "중국어 단어 성장 프로젝트", period: "2학기", weight: 50 },
      { id: "culture", type: "수행평가", title: "중국 문화 발표", period: "2학기", weight: 50 },
    ],
  },
  { id: "career", name: "진로", color: "bg-slate-400", assessments: [], passOnly: true },
];

const SUBJECT_ORDER = [
  "korean",
  "math",
  "english",
  "science",
  "social",
  "history",
  "japanese",
  "chinese",
  "hanmun",
  "tech",
  "information",
  "ethics",
  "music",
  "art",
  "pe",
];

function orderSubjects(subjects: Subject[]) {
  const orderById = new Map(SUBJECT_ORDER.map((id, index) => [id, index]));

  return subjects
    .map((subject, originalIndex) => ({ subject, originalIndex }))
    .sort((a, b) => {
      if (a.subject.passOnly !== b.subject.passOnly) return a.subject.passOnly ? 1 : -1;
      if (a.subject.passOnly && b.subject.passOnly) return a.originalIndex - b.originalIndex;

      const aOrder = orderById.get(a.subject.id) ?? SUBJECT_ORDER.length;
      const bOrder = orderById.get(b.subject.id) ?? SUBJECT_ORDER.length;
      return aOrder - bOrder || a.originalIndex - b.originalIndex;
    })
    .map(({ subject }) => subject);
}

const orderedMandukSubjects = orderSubjects(mandukSubjects);
const orderedGeojeSubjects = orderSubjects(geojeSubjects);
const orderedBuheungSubjects = orderSubjects(buheungSubjects);
const orderedGaegeumSubjects = orderSubjects(gaegeumSubjects);
const orderedCentumSubjects = orderSubjects(centumSubjects);
const orderedBusanDaesinSubjects = orderSubjects(busanDaesinSubjects);

const STORAGE_KEY = "semester-score-calculator";
const GEOJE_STORAGE_KEY = "semester-score-calculator-geoje-girls";
const BUHEUNG_STORAGE_KEY = "semester-score-calculator-buheung";
const GAEGEUM_STORAGE_KEY = "semester-score-calculator-gaegeum-girls";
const CENTUM_STORAGE_KEY = "semester-score-calculator-centum";
const BUSAN_DAESIN_STORAGE_KEY = "semester-score-calculator-busan-daesin";
const SCHOOL_STORAGE_KEYS = {
  manduk: STORAGE_KEY,
  "geoje-girls": GEOJE_STORAGE_KEY,
  buheung: BUHEUNG_STORAGE_KEY,
  "gaegeum-girls": GAEGEUM_STORAGE_KEY,
  centum: CENTUM_STORAGE_KEY,
  "busan-daesin": BUSAN_DAESIN_STORAGE_KEY,
} as const;
const THREE_LEVEL_SUBJECT_IDS = new Set(["pe", "music", "art"]);
const schools = [
  { id: "gaegeum-girls", name: "개금여자중학교", shortName: "개금여중" },
  { id: "geoje-girls", name: "거제여자중학교", shortName: "거제여중" },
  { id: "manduk", name: "만덕중학교", shortName: "만덕중" },
  { id: "busan-daesin", name: "부산대신중학교", shortName: "부산대신중" },
  { id: "buheung", name: "부흥중학교", shortName: "부흥중" },
  { id: "centum", name: "센텀중학교", shortName: "센텀중" },
] as const;

function getSubjects(schoolId: (typeof schools)[number]["id"]) {
  if (schoolId === "geoje-girls") return orderedGeojeSubjects;
  if (schoolId === "buheung") return orderedBuheungSubjects;
  if (schoolId === "gaegeum-girls") return orderedGaegeumSubjects;
  if (schoolId === "centum") return orderedCentumSubjects;
  if (schoolId === "busan-daesin") return orderedBusanDaesinSubjects;
  return orderedMandukSubjects;
}

function scoreKey(subjectId: string, assessmentId: string) {
  return `${subjectId}.${assessmentId}`;
}

function getSubjectResult(subject: Subject, scores: Scores) {
  const filled = subject.assessments.filter(
    (item) => scores[scoreKey(subject.id, item.id)] !== undefined && scores[scoreKey(subject.id, item.id)] !== "",
  ).length;
  const score = subject.assessments.reduce((total, item) => {
    const value = Number(scores[scoreKey(subject.id, item.id)] || 0);
    return total + value * (item.weight / 100);
  }, 0);

  return {
    score,
    filled,
    total: subject.assessments.length,
    complete: filled === subject.assessments.length,
  };
}

function getAchievement(score: number, subjectId: string) {
  const roundedScore = Math.round(score);

  if (THREE_LEVEL_SUBJECT_IDS.has(subjectId)) {
    if (roundedScore >= 80) return "A";
    if (roundedScore >= 60) return "B";
    return "C";
  }

  if (roundedScore >= 90) return "A";
  if (roundedScore >= 80) return "B";
  if (roundedScore >= 70) return "C";
  if (roundedScore >= 60) return "D";
  return "E";
}

function Icon({
  name,
  className = "size-5",
}: {
  name: "book" | "chart" | "check" | "spark" | "trash" | "arrow" | "sun" | "moon";
  className?: string;
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
    moon: <path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z" />,
  };

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
  );
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = localStorage.getItem("grade-calculator-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [schoolChoice, setSchoolChoice] = useState<(typeof schools)[number]["id"] | "">("");
  const [activeSchoolId, setActiveSchoolId] = useState<(typeof schools)[number]["id"] | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState(mandukSubjects[0].id);
  const [scoresBySchool, setScoresBySchool] = useState<
    Record<(typeof schools)[number]["id"], Scores>
  >(() => {
    const readScores = (key: string) => {
      try {
        return JSON.parse(localStorage.getItem(key) || "{}");
      } catch {
        return {};
      }
    };
    return {
      manduk: readScores(STORAGE_KEY),
      "geoje-girls": readScores(GEOJE_STORAGE_KEY),
      buheung: readScores(BUHEUNG_STORAGE_KEY),
      "gaegeum-girls": readScores(GAEGEUM_STORAGE_KEY),
      centum: readScores(CENTUM_STORAGE_KEY),
      "busan-daesin": readScores(BUSAN_DAESIN_STORAGE_KEY),
    };
  });
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"local" | "loading" | "saving" | "synced" | "error">("local");
  const scoresRef = useRef<UserData>(scoresBySchool);
  const syncUserIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = `${theme} only`;
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystemTheme = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem("grade-calculator-theme")) {
        setTheme(event.matches ? "dark" : "light");
      }
    };

    media.addEventListener("change", followSystemTheme);
    return () => media.removeEventListener("change", followSystemTheme);
  }, []);

  useEffect(() => {
    scoresRef.current = scoresBySchool;
    Object.entries(SCHOOL_STORAGE_KEYS).forEach(([schoolId, storageKey]) => {
      localStorage.setItem(storageKey, JSON.stringify(scoresBySchool[schoolId as keyof typeof SCHOOL_STORAGE_KEYS]));
    });

    const syncUserId = syncUserIdRef.current;
    if (!syncUserId || auth.currentUser?.uid !== syncUserId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const dataToSave = scoresRef.current;
      setSyncStatus("saving");
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (auth.currentUser?.uid !== syncUserId) return;
          await saveUserData(dataToSave);
          if (auth.currentUser?.uid === syncUserId) setSyncStatus("synced");
        })
        .catch(() => {
          if (auth.currentUser?.uid === syncUserId) setSyncStatus("error");
        });
    }, 600);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [scoresBySchool]);

  useEffect(() => {
    let authGeneration = 0;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const generation = ++authGeneration;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      syncUserIdRef.current = null;
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setSyncStatus("local");
        return;
      }

      setSyncStatus("loading");
      try {
        const { data: cloudData } = await loadUserData();
        if (generation !== authGeneration || auth.currentUser?.uid !== nextUser.uid) return;

        // Cloud values win on conflicts; local-only values are retained and uploaded.
        const localData = scoresRef.current;
        const mergedData = Object.fromEntries(
          Object.keys(SCHOOL_STORAGE_KEYS).map((schoolId) => [
            schoolId,
            { ...(localData[schoolId] || {}), ...(cloudData?.[schoolId] || {}) },
          ]),
        ) as UserData;

        scoresRef.current = mergedData;
        syncUserIdRef.current = nextUser.uid;
        setScoresBySchool(mergedData as Record<keyof typeof SCHOOL_STORAGE_KEYS, Scores>);
        setSyncStatus("synced");
      } catch {
        if (generation === authGeneration) setSyncStatus("error");
      }
    });

    return unsubscribe;
  }, []);

  async function handleSignIn() {
    setSyncStatus("loading");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setSyncStatus("error");
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch {
      setSyncStatus("error");
    }
  }

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      localStorage.setItem("grade-calculator-theme", nextTheme);
      return nextTheme;
    });
  }

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
  );

  const authControl = (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      {user ? (
        <>
          <span className="max-w-44 truncate font-semibold text-slate-600 dark:text-slate-300" title={user.email || undefined}>
            {user.displayName || user.email || "Google 사용자"}
          </span>
          <span className={syncStatus === "error" ? "text-rose-600" : "text-slate-400"}>
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
  );

  const dataSchoolId = activeSchoolId || schoolChoice || schools[0].id;
  const subjects = getSubjects(dataSchoolId);
  const scores = scoresBySchool[dataSchoolId];
  const setScores = (update: Scores | ((current: Scores) => Scores)) => {
    setScoresBySchool((current) => {
      const currentScores = current[dataSchoolId];
      return {
        ...current,
        [dataSchoolId]: typeof update === "function" ? update(currentScores) : update,
      };
    });
  };
  const activeSubject = subjects.find((subject) => subject.id === activeSubjectId) || subjects[0];
  const results = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, getSubjectResult(subject, scores)])),
    [scores, subjects],
  );
  const completedResults = subjects
    .map((subject) => ({ subject, ...results[subject.id] }))
    .filter((result) => !result.subject.passOnly && result.complete);
  const gradedSubjectCount = subjects.filter((subject) => !subject.passOnly).length;
  const average = completedResults.length
    ? completedResults.reduce((sum, result) => sum + result.score, 0) / completedResults.length
    : 0;
  const activeResult = results[activeSubject.id];
  const getExamAverage = (examId: "midterm" | "final") => {
    const exams = subjects.flatMap((subject) =>
      subject.assessments
        .filter((assessment) => assessment.type === "지필평가" && assessment.id === examId)
        .map((assessment) => ({
          key: scoreKey(subject.id, assessment.id),
        })),
    );
    const enteredScores = exams
      .map((exam) => scores[exam.key])
      .filter((score) => score !== undefined && score !== "");

    return {
      average:
        enteredScores.length > 0
          ? enteredScores.reduce((sum, score) => sum + Number(score), 0) / enteredScores.length
          : null,
      entered: enteredScores.length,
      total: exams.length,
    };
  };
  const midtermAverage = getExamAverage("midterm");
  const finalAverage = getExamAverage("final");
  const missingAssessments = activeSubject.assessments.filter(
    (item) => scores[scoreKey(activeSubject.id, item.id)] === undefined || scores[scoreKey(activeSubject.id, item.id)] === "",
  );
  const achievementGuide = (() => {
    if (missingAssessments.length !== 1) return null;

    const remaining = missingAssessments[0];
    const maximumScore = activeResult.score + remaining.weight;
    const roundedMaximumScore = Math.round(maximumScore);
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
        ];
    const target = targets.find((item) => roundedMaximumScore >= item.threshold) || targets[targets.length - 1];
    const minimumRawScore = target.threshold === 0 ? 0 : target.threshold - 0.5;
    const exactMinimum = (minimumRawScore - activeResult.score) / (remaining.weight / 100);
    const minimumScore = Math.min(100, Math.max(0, Math.ceil(exactMinimum)));

    return { remaining, grade: target.grade, minimumScore };
  })();

  function updateScore(key: string, value: string) {
    if (value === "") {
      setScores((current) => ({ ...current, [key]: "" }));
      return;
    }
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setScores((current) => ({ ...current, [key]: String(Math.min(100, Math.max(0, parsed))) }));
    }
  }

  function clearScores() {
    if (Object.values(scores).some((value) => value !== "") && window.confirm("입력한 모든 점수를 초기화할까요?")) {
      setScores({});
    }
  }

  const activeSchool = schools.find((school) => school.id === activeSchoolId);

  if (!activeSchool) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-5 py-12 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
        <div className="absolute right-5 top-5 z-10 sm:right-8 sm:top-8">{themeControl}</div>
        <div className="absolute -left-24 top-16 size-72 rounded-full bg-indigo-500/15 blur-3xl dark:bg-indigo-600/20" />
        <div className="absolute -right-20 bottom-8 size-80 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/15" />
        <main className="relative w-full max-w-lg">
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-indigo-500 text-white"
              style={{ boxShadow: "oklab(0.257 0.0176167 -0.088259) 0px 8px 10px -6px" }}
            >
              <Icon name="book" className="size-7" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              원점수 계산기 by dohoon <span className="font-semibold text-slate-400 dark:text-slate-500">v{appVersion}</span>
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl mt-2">학교를 선택해 주세요</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              학교별 평가계획에 맞춰 수행평가와 지필평가 원점수를 계산합니다.
            </p>
          </div>

          <form
            className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-300/50 sm:p-8 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:shadow-black/30"
            onSubmit={(event) => {
              event.preventDefault();
              if (!schoolChoice) return;
              setActiveSubjectId(getSubjects(schoolChoice)[0].id);
              setActiveSchoolId(schoolChoice);
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-700 dark:text-slate-200">학교 선택</span>
              <div className="relative">
                <select
                  className={`h-14 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-0 pl-4 pr-12 text-base font-bold outline-none transition hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/50 ${
                    schoolChoice ? "text-slate-900 dark:text-white" : "text-slate-400"
                  }`}
                  onChange={(event) =>
                    setSchoolChoice(event.target.value as (typeof schools)[number]["id"] | "")
                  }
                  value={schoolChoice}
                >
                  <option disabled value="">
                    학교를 선택하세요
                  </option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
                <Icon
                  name="arrow"
                  className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 rotate-90 text-slate-500"
                />
              </div>
            </label>

            <button
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-base font-extrabold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:shadow-none"
              disabled={!schoolChoice}
              type="submit"
            >
              원점수 계산기 열기
              <Icon name="arrow" className="size-5" />
            </button>
          </form>
          <div className="mt-4">{authControl}</div>
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
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Icon name="book" className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-indigo-600 dark:text-[#aab2cc]">
                {activeSchool.shortName} · 2-2 평가계획
              </p>
              <p className="text-lg font-extrabold tracking-tight">원점수 계산기</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="mr-1 hidden md:block">{authControl}</div>
            {themeControl}
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
            <p className="mb-1 text-sm font-bold text-indigo-600 dark:text-[#aab2cc]">내 성적 한눈에 보기</p>
            <h1 className="whitespace-nowrap text-[25px] font-black tracking-tight">
              2026 {activeSchool.shortName} 2-2 성적계산기
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm shadow-indigo-100/60 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:shadow-none">
              <div className="mb-4 hidden size-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm sm:flex dark:bg-slate-800 dark:text-[#aab2cc]">
                <Icon name="chart" className="size-5" />
              </div>
              <p className="text-sm font-semibold text-indigo-700 dark:text-[#aab2cc]">중간고사 {midtermAverage.total}과목 평균</p>
              <p className="mt-1 text-2xl font-black text-indigo-950 dark:text-[#c4cadc]">
                {midtermAverage.average === null ? "—" : midtermAverage.average.toFixed(2)}
                {midtermAverage.average !== null && (
                  <span className="ml-1 text-sm font-semibold text-indigo-400 dark:text-[#8f99b8]">점</span>
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
              <p className="text-sm font-semibold text-violet-700 dark:text-[#b5adca]">기말고사 {finalAverage.total}과목 평균</p>
              <p className="mt-1 text-2xl font-black text-violet-950 dark:text-[#cec9da]">
                {finalAverage.average === null ? "—" : finalAverage.average.toFixed(2)}
                {finalAverage.average !== null && (
                  <span className="ml-1 text-sm font-semibold text-violet-400 dark:text-[#978eaf]">점</span>
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
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">입력 완료 과목</p>
              <p className="mt-1 text-2xl font-black">
                {completedResults.length}
                <span className="ml-1 text-sm font-semibold text-slate-400">/ {gradedSubjectCount}과목</span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <div className="mb-4 hidden size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:flex dark:bg-emerald-500/10 dark:text-emerald-300">
                <Icon name="chart" className="size-5" />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">원점수 평균</p>
              <p className="mt-1 text-2xl font-black">
                {completedResults.length ? average.toFixed(1) : "—"}
                {completedResults.length > 0 && <span className="ml-1 text-sm font-semibold text-slate-400">점</span>}
              </p>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="font-extrabold">과목 선택</h2>
              <p className="mt-1 text-xs text-slate-400">과목별 입력 현황을 확인하세요</p>
            </div>
            <nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-visible" aria-label="과목 목록">
              {subjects.map((subject) => {
                const result = results[subject.id];
                const active = subject.id === activeSubject.id;
                const passOnly = subject.passOnly === true;
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
                    <span className={`size-2.5 shrink-0 rounded-full ${subject.color}`} />
                    <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
                      <span className="truncate text-sm font-bold leading-5">{subject.name}</span>
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
                        {passOnly ? "P" : result.complete ? getAchievement(result.score, subject.id) : "—"}
                      </span>
                      <span
                        className={`text-[11px] leading-4 ${active ? "text-indigo-400 dark:text-[#8f99b8]" : "text-slate-400"}`}
                      >
                        {passOnly ? "원점수 미산출" : result.complete ? "입력 완료" : `${result.filled}/${result.total} 입력`}
                      </span>
                      <span
                        className={`text-right text-[11px] font-semibold leading-4 ${
                          active ? "text-indigo-400 dark:text-[#8f99b8]" : "text-slate-400"
                        }`}
                      >
                        {!passOnly && result.complete ? `${result.score.toFixed(1)}점` : ""}
                      </span>
                    </span>
                    {!passOnly && (
                      <Icon name="arrow" className={`size-4 shrink-0 ${active ? "text-indigo-400 dark:text-[#8f99b8]" : "text-slate-300"}`} />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="border-b border-slate-100 px-5 py-6 dark:border-slate-800 sm:px-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className={`size-3 rounded-full ${activeSubject.color}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black">{activeSubject.name}</h2>
                      {activeResult.complete && (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          입력 완료
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {activeResult.filled}개 입력 · 총 {activeResult.total}개 평가
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white sm:min-w-44">
                  <p className="text-xs font-semibold text-slate-400">
                    {activeResult.complete ? "최종 원점수" : "현재 예상 원점수"}
                  </p>
                  <p className="mt-1 text-3xl font-black tabular-nums">
                    {activeResult.score.toFixed(0)}
                    <span className="ml-1 text-sm font-semibold text-slate-400">/ 100</span>
                  </p>
                </div>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${(activeResult.filled / activeResult.total) * 100}%` }}
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
                          남은 &lsquo;{achievementGuide.remaining.title}&rsquo;에서 100점을 받아도 성취도는
                          E입니다.
                        </>
                      ) : (
                        <>
                          남은 &lsquo;{achievementGuide.remaining.title}&rsquo;에서 최소{" "}
                          <strong className="font-black">{achievementGuide.minimumScore}점</strong>
                          을 받으면 성취도 {achievementGuide.grade}를 달성할 수 있습니다.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-7">
              {(["지필평가", "수행평가"] as const).map((type) => {
                const items = activeSubject.assessments.filter((item) => item.type === type);
                if (!items.length) return null;
                return (
                  <div className="mb-8 last:mb-0" key={type}>
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-sm font-extrabold">{type}</h3>
                      <span className="text-xs font-medium text-slate-400">
                        총 {items.reduce((sum, item) => sum + item.weight, 0)}% 반영
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                      {items.map((item) => {
                        const key = scoreKey(activeSubject.id, item.id);
                        const value = scores[key] ?? "";
                        const contribution = Number(value || 0) * (item.weight / 100);
                        return (
                          <div
                            className="grid gap-4 bg-white p-4 dark:bg-slate-900 sm:grid-cols-[minmax(0,1fr)_8rem_8.5rem] sm:items-center sm:px-5"
                            key={item.id}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{item.title}</p>
                              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                                <span>{item.period}</span>
                                <span className="size-1 rounded-full bg-slate-300" />
                                <span className="font-semibold text-indigo-600 dark:text-[#aab2cc]">{item.weight}% 반영</span>
                              </div>
                            </div>
                            <div className="hidden text-right sm:block">
                              <p className="text-[11px] font-medium text-slate-400">반영 점수</p>
                              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-600 dark:text-slate-300">
                                {value === "" ? "—" : contribution.toFixed(1)}점
                              </p>
                            </div>
                            <label className="relative block">
                              <span className="sr-only">{item.title} 점수</span>
                              <input
                                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 text-right text-base font-extrabold tabular-nums outline-none transition placeholder:font-medium placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-600 dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/50"
                                inputMode="decimal"
                                max="100"
                                min="0"
                                onChange={(event) => updateScore(key, event.target.value)}
                                placeholder="0"
                                type="number"
                                value={value}
                              />
                              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                점
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
