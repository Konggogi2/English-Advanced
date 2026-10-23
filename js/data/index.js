import { U01 } from './u01_10.js';
import { U11 } from './u11_20.js';
import { U21 } from './u21_30.js';
import { U31 } from './u31_40.js';
import { U41 } from './u41_50.js';
import { U51 } from './u51_60.js';

export const UNITS = [...U01, ...U11, ...U21, ...U31, ...U41, ...U51];

export const CHAPTERS = [
  { id: 'c1', from: 1, to: 10, flag: '🗽', city: 'New York', name: 'Chapter 1 · New York', sub: '미국 일상 회화의 기본기', color: '#2f5bd7', story: '뉴욕 JFK 공항에서 여행이 시작돼요. 친구 제이크와 함께 카페, 지하철, 파티, 사무실을 돌며 미국식 일상 표현을 익혀요.' },
  { id: 'c2', from: 11, to: 20, flag: '🛣️', city: 'US Road Trip', name: 'Chapter 2 · US Road Trip', sub: 'LA · 텍사스 · 라스베이거스', color: '#e0703f', story: '렌터카를 빌려 미국 횡단 로드트립! 도로, 텍사스 사투리, 스포츠와 도박에서 나온 숙어를 만나요.' },
  { id: 'c3', from: 21, to: 30, flag: '🇦🇺', city: 'Sydney', name: 'Chapter 3 · Sydney', sub: '호주 슬랭과 비치 라이프', color: '#1a9a8a', story: '비행기를 타고 시드니로! “G’day, mate!” 호주 사람들의 느긋한 말투와 독특한 슬랭에 빠져 봐요.' },
  { id: 'c4', from: 31, to: 40, flag: '🦘', city: 'Melbourne', name: 'Chapter 4 · Melbourne & Beyond', sub: '아웃백 · 영국식 영어 · 구동사', color: '#8a5cd6', story: '멜버른 카페 문화에서 아웃백 사막까지. 영국식 영어와 구동사, 시간·사람 관련 숙어도 정복해요.' },
  { id: 'c5', from: 41, to: 50, flag: '🏙️', city: 'Chicago', name: 'Chapter 5 · Work & Social', sub: '비즈니스와 사회생활 영어', color: '#c0527a', story: '시카고에서 일자리를 얻은 당신! 회의, 이메일, 면접, 협상, 연애까지 사회생활 영어를 익혀요.' },
  { id: 'c6', from: 51, to: 60, flag: '🏔️', city: 'Fluency Summit', name: 'Chapter 6 · Fluency Summit', sub: '상급자의 뉘앙스와 화법', color: '#2f4f8f', story: '마지막 정상! 완곡한 표현, 아이러니, 토론, 이야기하기, 자연스러운 구어체로 원어민다운 마무리를 해요.' },
];
